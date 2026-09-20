"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getLectureItems, type LectureItemRow } from "@/lib/lectures";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type ActionResult = { error: string | null; itemId?: string };

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB, matches the course-pdfs bucket limit

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const R2_BUCKET = process.env.R2_BUCKET_NAME!;

export async function fetchLectureItems(
  lectureId: string
): Promise<{ items: LectureItemRow[]; error: string | null }> {
  return getLectureItems(lectureId);
}

function sanitizeFileName(name: string): string {
  const withoutExt = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  // Supabase Storage keys must be ASCII-safe — strip anything else (Arabic, spaces, symbols)
  const base = withoutExt
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const safeBase = base || "file-" + Date.now();
  return safeBase + ".pdf";
}

export async function createLectureItem(formData: FormData, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const lectureId = String(formData.get("lectureId") || "").trim();
  const courseId = String(formData.get("courseId") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const title = String(formData.get("title") || "").trim();
  let url = String(formData.get("url") || "").trim();
  const pdfFile = formData.get("pdfFile") as File | null;

  // إعدادات حماية الـ PDF اللي المالك/المشرف بيحددها (اختيارية، لها قيم افتراضية)
  const allowDownload = String(formData.get("allowDownload") || "true") === "true";
  const urlExpiryMinutes = Number(formData.get("urlExpiryMinutes") || 60);
  const viewLimitRaw = String(formData.get("viewLimit") || "").trim();
  const pdfViewLimit = viewLimitRaw === "" ? null : Number(viewLimitRaw);

  if (!lectureId) return { error: "المحاضرة مطلوبة" };
  if (type !== "video" && type !== "pdf") return { error: "نوع العنصر غير صحيح" };
  if (!title) return { error: "عنوان العنصر مطلوب" };

  // فيديو جديد بيتربط برابط Cloudinary بعد رفعه من المتصفح (attachCloudinaryVideo)،
  // مش وقت إنشاء العنصر نفسه — فبنسيب "pending" مؤقتًا لحد ما الرفع يخلص.
  if (type === "video" && !url) url = "pending";

  let r2Key: string | null = null;

  if (type === "pdf") {
    if (!pdfFile || pdfFile.size === 0) return { error: "لازم تختار ملف PDF" };
    if (!courseId) return { error: "الدورة مطلوبة لرفع الملف" };
    if (pdfFile.type && pdfFile.type !== "application/pdf") {
      return { error: "الملف لازم يكون PDF" };
    }
    if (pdfFile.size > MAX_PDF_BYTES) return { error: "حجم الملف أكبر من 50MB" };

    const fileName = sanitizeFileName(pdfFile.name || "file.pdf");
    r2Key = courseId + "/" + fileName;

    const bytes = new Uint8Array(await pdfFile.arrayBuffer());

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: bytes,
          ContentType: "application/pdf",
        })
      );
    } catch (e) {
      console.error(e);
      return { error: "فشل رفع الملف إلى R2" };
    }

    url = fileName;
  }

  const { data: maxRow } = await supabase
    .from("lecture_items")
    .select("order_index")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("lecture_items")
    .insert({
      lecture_id: lectureId,
      type,
      title,
      url,
      order_index: nextOrderIndex,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // ربط بيانات R2 وإعدادات الحماية بالعنصر الجديد
  if (type === "pdf" && r2Key) {
    const { error: pdfInsertError } = await supabase.from("lecture_pdfs").insert({
      lecture_item_id: inserted.id,
      r2_key: r2Key,
      allow_download: allowDownload,
      url_expiry_minutes: urlExpiryMinutes,
      view_limit: pdfViewLimit,
    });

    if (pdfInsertError) {
      return { error: "تم رفع الملف لكن فشل حفظ إعداداته: " + pdfInsertError.message };
    }
  }

  revalidatePath(lecturePath);
  return { error: null, itemId: inserted.id as string };
}

export async function updateLectureItem(formData: FormData, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();

  if (!id || !title || !url) return { error: "بيانات غير مكتملة" };

  const { error } = await supabase.from("lecture_items").update({ title, url }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

export async function deleteLectureItem(id: string, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const { error } = await supabase.from("lecture_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

export async function moveLectureItem(
  id: string,
  lectureId: string,
  direction: "up" | "down",
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  const { data: items, error: fetchError } = await supabase
    .from("lecture_items")
    .select("id, order_index")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: true });

  if (fetchError || !items) return { error: fetchError?.message || "خطأ في جلب العناصر" };

  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return { error: "العنصر غير موجود" };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return { error: null };

  const current = items[idx];
  const swap = items[swapIdx];

  const { error: err1 } = await supabase
    .from("lecture_items")
    .update({ order_index: swap.order_index })
    .eq("id", current.id);
  const { error: err2 } = await supabase
    .from("lecture_items")
    .update({ order_index: current.order_index })
    .eq("id", swap.id);

  if (err1 || err2) return { error: err1?.message || err2?.message || "خطأ في إعادة الترتيب" };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  Cloudinary — رفع الفيديو مباشرة من المتصفح                         */
/* ------------------------------------------------------------------ */

type CloudinaryTarget = {
  cloudName: string | null;
  uploadPreset: string | null;
  accountId: string | null;
  error: string | null;
};

/**
 * بيرجع بيانات حساب Cloudinary المربوط بقناة الدورة دي (cloud_name + upload_preset)
 * عشان المتصفح يقدر يرفع الفيديو مباشرة لـCloudinary من غير ما يعدّي على السيرفر بتاعنا.
 * ملحوظة أمان: الـapi_secret مابيترجعش هنا خالص — مش محتاجينه لأن الرفع "unsigned".
 */
export async function getCloudinaryUploadTarget(courseId: string): Promise<CloudinaryTarget> {
  const supabase = createServerClient();

  if (!courseId) {
    return { cloudName: null, uploadPreset: null, accountId: null, error: "الدورة غير محددة" };
  }

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("channel_id")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError || !course?.channel_id) {
    return {
      cloudName: null,
      uploadPreset: null,
      accountId: null,
      error: "تعذر تحديد القناة الخاصة بهذه المادة",
    };
  }

  const { data: account, error: accountError } = await supabase
    .from("cloudinary_accounts")
    .select("id, cloud_name, upload_preset")
    .eq("channel_id", course.channel_id)
    .maybeSingle();

  if (accountError || !account) {
    return {
      cloudName: null,
      uploadPreset: null,
      accountId: null,
      error: "لا يوجد حساب Cloudinary مربوط بقناة هذه المادة",
    };
  }

  if (!account.upload_preset) {
    return {
      cloudName: null,
      uploadPreset: null,
      accountId: null,
      error: "حساب Cloudinary الخاص بهذه القناة بدون upload preset — راجع خطوة الإعداد",
    };
  }

  return {
    cloudName: account.cloud_name,
    uploadPreset: account.upload_preset,
    accountId: account.id,
    error: null,
  };
}

/**
 * بتتنفذ بعد ما الفيديو يخلص رفعه من المتصفح لـCloudinary مباشرة:
 * بتعمل صف lecture_videos وتحدّث رابط lecture_items.url بالرابط النهائي.
 */
export async function attachCloudinaryVideo(
  itemId: string,
  accountId: string,
  cloudinaryUrl: string,
  cloudinaryPublicId: string,
  title: string,
  viewLimit: number | null,
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  if (!itemId || !accountId || !cloudinaryUrl) {
    return { error: "بيانات الفيديو غير مكتملة" };
  }

  const { error: videoError } = await supabase.from("lecture_videos").insert({
    lecture_item_id: itemId,
    title,
    available: true,
    cloudinary_url: cloudinaryUrl,
    cloudinary_public_id: cloudinaryPublicId,
    cloudinary_account_id: accountId,
    view_limit: viewLimit,
  });

  if (videoError) return { error: videoError.message };

  const { error: updateError } = await supabase
    .from("lecture_items")
    .update({ url: cloudinaryUrl })
    .eq("id", itemId);

  if (updateError) return { error: updateError.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  حد المشاهدات — قراءة وتعديل لفيديو موجود بالفعل                     */
/* ------------------------------------------------------------------ */

export type VideoViewLimitInfo = {
  lectureVideoId: string | null;
  viewLimit: number | null;
  error: string | null;
};

/** بترجع lecture_videos.id + حد المشاهدات الحالي لعنصر فيديو معين، عشان نعبّي فورم التعديل */
export async function getVideoViewLimit(lectureItemId: string): Promise<VideoViewLimitInfo> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("lecture_videos")
    .select("id, view_limit")
    .eq("lecture_item_id", lectureItemId)
    .maybeSingle();

  if (error) return { lectureVideoId: null, viewLimit: null, error: error.message };
  if (!data) return { lectureVideoId: null, viewLimit: null, error: null };

  return {
    lectureVideoId: data.id as string,
    viewLimit: (data.view_limit as number | null) ?? null,
    error: null,
  };
}

/** viewLimit = null يعني غير محدود (♾️) */
export async function updateVideoViewLimit(
  lectureVideoId: string,
  viewLimit: number | null,
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("lecture_videos")
    .update({ view_limit: viewLimit })
    .eq("id", lectureVideoId);

  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  إعدادات PDF — قراءة وتعديل (التحميل + حد الفتحات) لملف موجود بالفعل  */
/* ------------------------------------------------------------------ */

export type PdfSettingsInfo = {
  lecturePdfId: string | null;
  allowDownload: boolean;
  viewLimit: number | null;
  error: string | null;
};

/** بترجع lecture_pdfs.id + إعدادات التحميل/حد الفتحات الحالية، عشان نعبّي فورم التعديل */
export async function getPdfSettings(lectureItemId: string): Promise<PdfSettingsInfo> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("lecture_pdfs")
    .select("id, allow_download, view_limit")
    .eq("lecture_item_id", lectureItemId)
    .maybeSingle();

  if (error) return { lecturePdfId: null, allowDownload: false, viewLimit: null, error: error.message };
  if (!data) return { lecturePdfId: null, allowDownload: false, viewLimit: null, error: null };

  return {
    lecturePdfId: data.id as string,
    allowDownload: !!data.allow_download,
    viewLimit: (data.view_limit as number | null) ?? null,
    error: null,
  };
}

/**
 * viewLimit = null يعني غير محدود (♾️).
 * قاعدة إجبارية: لو allowDownload = true، بنفرض viewLimit = null بغض النظر عن القيمة المُرسلة،
 * عشان نتوافق مع قيد قاعدة البيانات chk_pdf_download_requires_unlimited.
 */
export async function updatePdfSettings(
  lecturePdfId: string,
  allowDownload: boolean,
  viewLimit: number | null,
  lecturePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  const finalViewLimit = allowDownload ? null : viewLimit;

  const { error } = await supabase
    .from("lecture_pdfs")
    .update({ allow_download: allowDownload, view_limit: finalViewLimit })
    .eq("id", lecturePdfId);

  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}
