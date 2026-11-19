// أدوات تخزين الريكوردات على R2. ملف عادي (مش "use server") عشان الدوال اللي فيه
// مش تتحوّل لـ server actions يقدر أي حد ينادي عليها من المتصفح.
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createServerClient } from "@/lib/supabase/server";

export interface R2Context {
  courseId: string;
  r2AccountRowId: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export const MAX_RECORDING_BYTES = 300 * 1024 * 1024; // 300MB

// الامتداد → الـContent-Type اللي بنوقّع بيه الرفع (مش بنثق في اللي المتصفح يقوله)
export const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  flac: "audio/flac",
};

export function makeR2Client(c: { accountId: string; accessKeyId: string; secretAccessKey: string }) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    // R2 مش بيقبل الـchecksum الافتراضي في SDK الجديد، وبيبوّظ الـpresigned URLs
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** حساب R2 بتاع قناة المحاضرة: محاضرة ← مادة ← قناة ← حساب. */
export async function getLectureR2Context(
  lectureId: string
): Promise<{ ctx: R2Context | null; error: string | null }> {
  const supabase = createServerClient();

  const { data: lecture } = await supabase.from("lectures").select("course_id").eq("id", lectureId).maybeSingle();
  if (!lecture?.course_id) return { ctx: null, error: "المحاضرة غير موجودة" };

  const { data: course } = await supabase.from("courses").select("channel_id").eq("id", lecture.course_id).maybeSingle();
  if (!course?.channel_id) return { ctx: null, error: "المادة غير مرتبطة بقناة" };

  const { data: channel } = await supabase
    .from("channels")
    .select("r2_account_id")
    .eq("id", course.channel_id)
    .maybeSingle();
  if (!channel?.r2_account_id) {
    return { ctx: null, error: "القناة دي مش مربوطة بحساب R2 — اربطها من لوحة المالك (حسابات R2)" };
  }

  const { data: acc } = await supabase
    .from("r2_accounts")
    .select("id, account_id, access_key_id, secret_access_key, bucket_name")
    .eq("id", channel.r2_account_id)
    .maybeSingle();
  if (!acc) return { ctx: null, error: "حساب R2 غير موجود" };

  return {
    ctx: {
      courseId: lecture.course_id as string,
      r2AccountRowId: acc.id as string,
      accountId: acc.account_id as string,
      accessKeyId: acc.access_key_id as string,
      secretAccessKey: acc.secret_access_key as string,
      bucketName: acc.bucket_name as string,
    },
    error: null,
  };
}

/** بيمسح ملف الريكورد من R2 (لو العنصر ريكورد). best-effort: الفشل مش بيمنع حذف العنصر. */
export async function deleteRecordingObject(lectureItemId: string): Promise<void> {
  try {
    const supabase = createServerClient();
    const { data: rec } = await supabase
      .from("lecture_recordings")
      .select("r2_account_id, r2_key")
      .eq("lecture_item_id", lectureItemId)
      .maybeSingle();
    if (!rec?.r2_account_id || !rec.r2_key) return;

    const { data: acc } = await supabase
      .from("r2_accounts")
      .select("account_id, access_key_id, secret_access_key, bucket_name")
      .eq("id", rec.r2_account_id)
      .maybeSingle();
    if (!acc) return;

    const client = makeR2Client({
      accountId: acc.account_id as string,
      accessKeyId: acc.access_key_id as string,
      secretAccessKey: acc.secret_access_key as string,
    });
    await client.send(new DeleteObjectCommand({ Bucket: acc.bucket_name as string, Key: rec.r2_key as string }));
  } catch {
    // نتجاهل: الملف ممكن يتمسح يدويًا من Cloudflare
  }
}
