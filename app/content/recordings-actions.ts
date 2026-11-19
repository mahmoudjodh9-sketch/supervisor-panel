"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient } from "@/lib/supabase/server";
import {
  AUDIO_TYPES,
  MAX_RECORDING_BYTES,
  getLectureR2Context,
  makeR2Client,
} from "@/lib/recordings-storage";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsLecture } from "@/lib/supervisor-content";

type ActionResult = { error: string | null };

/* فحص الصلاحية: المشرف لازم يكون مالك المحاضرة */
async function checkLecture(lectureId: string): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  if (!lectureId) return "المحاضرة مطلوبة";
  const owned = await ownsLecture(supervisorId, lectureId);
  return owned ? null : "غير مصرّح";
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * الخطوة 1: بنجهّز رابط رفع مؤقت (ساعة) مباشر من المتصفح لـR2،
 * علشان الملف يعدّي من غير ما يمر على السيرفر (حد Vercel حوالي 4.5MB للطلب).
 */
export async function createRecordingUpload(
  lectureId: string,
  fileName: string,
  sizeBytes: number
): Promise<{ uploadUrl: string | null; key: string | null; contentType: string | null; error: string | null }> {
  const fail = (error: string) => ({ uploadUrl: null, key: null, contentType: null, error });

  const denied = await checkLecture(lectureId);
  if (denied) return fail(denied);

  const ext = extensionOf(fileName);
  const contentType = AUDIO_TYPES[ext];
  if (!contentType) return fail("نوع الملف غير مدعوم (mp3, m4a, aac, wav, ogg, opus, webm, flac)");
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return fail("الملف فاضي");
  if (sizeBytes > MAX_RECORDING_BYTES) return fail("حجم الملف أكبر من 300MB");

  const { ctx, error } = await getLectureR2Context(lectureId);
  if (error || !ctx) return fail(error ?? "تعذر تجهيز الرفع");

  const key = `recordings/${ctx.courseId}/${lectureId}/${randomUUID()}.${ext}`;
  const client = makeR2Client(ctx);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: ctx.bucketName, Key: key, ContentType: contentType }),
    { expiresIn: 3600 }
  );

  return { uploadUrl, key, contentType, error: null };
}

/**
 * الخطوة 2: بعد ما الرفع يخلص بنتأكد إن الملف موجود فعلًا على R2،
 * وبنعمل عنصر المحاضرة (type = record) وسجل الريكورد.
 */
export async function finalizeRecording(
  lectureId: string,
  title: string,
  key: string,
  durationSeconds: number | null,
  lecturePath: string
): Promise<ActionResult & { itemId?: string }> {
  const denied = await checkLecture(lectureId);
  if (denied) return { error: denied };

  const cleanTitle = title.trim();
  if (!cleanTitle) return { error: "عنوان الريكورد مطلوب" };

  const { ctx, error: ctxError } = await getLectureR2Context(lectureId);
  if (ctxError || !ctx) return { error: ctxError };

  // المفتاح لازم يكون جوه مسار المحاضرة دي بالظبط (منع ربط ملف تاني)
  if (!key.startsWith(`recordings/${ctx.courseId}/${lectureId}/`)) return { error: "مفتاح الملف غير صالح" };

  const client = makeR2Client(ctx);
  let sizeBytes: number | null = null;
  let mimeType: string | null = null;
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: ctx.bucketName, Key: key }));
    sizeBytes = head.ContentLength ?? null;
    mimeType = head.ContentType ?? null;
  } catch {
    return { error: "الملف مش موجود على R2 — الرفع ما اكتملش" };
  }

  const supabase = createServerClient();
  const { data: maxRow } = await supabase
    .from("lecture_items")
    .select("order_index")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  const { data: item, error: itemError } = await supabase
    .from("lecture_items")
    .insert({ lecture_id: lectureId, type: "record", title: cleanTitle, url: key, order_index: nextOrderIndex })
    .select("id")
    .single();
  if (itemError) return { error: itemError.message };

  const { error: recError } = await supabase.from("lecture_recordings").insert({
    lecture_item_id: item.id,
    r2_account_id: ctx.r2AccountRowId,
    r2_key: key,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    duration_seconds: durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : null,
    status: "approved",
    uploaded_by_kind: "staff",
  });
  if (recError) {
    // تراجع: نمسح العنصر والملف علشان ماحدش يفضل معلّق
    await supabase.from("lecture_items").delete().eq("id", item.id);
    try {
      await client.send(new DeleteObjectCommand({ Bucket: ctx.bucketName, Key: key }));
    } catch {}
    return { error: recError.message };
  }

  revalidatePath(lecturePath);
  return { error: null, itemId: item.id as string };
}

/** تغيير اسم الريكورد (عنصر المحاضرة). */
export async function renameRecording(itemId: string, title: string, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const { data: item } = await supabase
    .from("lecture_items")
    .select("lecture_id, type")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.type !== "record") return { error: "الريكورد غير موجود" };

  const denied = await checkLecture(item.lecture_id as string);
  if (denied) return { error: denied };

  const cleanTitle = title.trim();
  if (!cleanTitle) return { error: "عنوان الريكورد مطلوب" };

  const { error } = await supabase.from("lecture_items").update({ title: cleanTitle }).eq("id", itemId);
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}
