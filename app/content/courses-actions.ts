"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };
type SupabaseServer = ReturnType<typeof createServerClient>;

async function uploadCourseCover(
  supabase: SupabaseServer,
  courseId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${courseId}/cover.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("course-images")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("course-images").getPublicUrl(path);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}

export async function createCourse(formData: FormData, channelPath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const title = String(formData.get("title") || "").trim();
  const channelId = String(formData.get("channelId") || "").trim() || null;
  const pricingType = String(formData.get("pricingType") || "paid");
  const icon = String(formData.get("icon") || "book").trim();
  const coverFile = formData.get("cover") as File | null;

  if (!["free", "paid", "mixed"].includes(pricingType)) return { error: "نوع تسعير غير صحيح" };
  if (!title) return { error: "اسم الدورة مطلوب" };
  if (!channelId) return { error: "القناة مطلوبة" };

  const { data: maxRow } = await supabase
    .from("courses")
    .select("order_index")
    .eq("channel_id", channelId)
    .order("order_index", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      title,
      channel_id: channelId,
      pricing_type: pricingType,
      icon,
      is_active: true,
      order_index: nextOrderIndex,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (coverFile && coverFile.size > 0) {
    const { url, error: coverError } = await uploadCourseCover(supabase, course.id, coverFile);
    if (coverError) return { error: coverError };
    const { error: updateError } = await supabase
      .from("courses")
      .update({ cover_image: url })
      .eq("id", course.id);
    if (updateError) return { error: updateError.message };
  }

  revalidatePath(channelPath);
  return { error: null };
}

export async function updateCourse(formData: FormData, channelPath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const channelId = String(formData.get("channelId") || "").trim() || null;
  const pricingType = String(formData.get("pricingType") || "paid");
  const icon = String(formData.get("icon") || "book").trim();
  const coverFile = formData.get("cover") as File | null;

  if (!id || !title) return { error: "بيانات غير مكتملة" };
  if (!channelId) return { error: "القناة مطلوبة" };
  if (!["free", "paid", "mixed"].includes(pricingType)) return { error: "نوع تسعير غير صحيح" };

  const updatePayload: Record<string, string | boolean | null> = {
    title,
    channel_id: channelId,
    pricing_type: pricingType,
    icon,
  };

  if (coverFile && coverFile.size > 0) {
    const { url, error: coverError } = await uploadCourseCover(supabase, id, coverFile);
    if (coverError) return { error: coverError };
    updatePayload.cover_image = url;
  }

  const { error } = await supabase.from("courses").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(channelPath);
  return { error: null };
}


export async function deleteCourse(id: string, channelPath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(channelPath);
  return { error: null };
}

export async function moveCourse(
  id: string,
  channelId: string,
  direction: "up" | "down",
  channelPath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  const { data: siblings, error } = await supabase
    .from("courses")
    .select("id, order_index")
    .eq("channel_id", channelId)
    .order("order_index", { ascending: true, nullsFirst: false });

  if (error) return { error: error.message };

  const list = siblings ?? [];
  const index = list.findIndex((c) => c.id === id);
  if (index === -1) return { error: "الدورة غير موجودة" };

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return { error: null };

  const a = list[index];
  const b = list[swapWith];

  const [{ error: errA }, { error: errB }] = await Promise.all([
    supabase.from("courses").update({ order_index: b.order_index }).eq("id", a.id),
    supabase.from("courses").update({ order_index: a.order_index }).eq("id", b.id),
  ]);

  if (errA) return { error: errA.message };
  if (errB) return { error: errB.message };

  revalidatePath(channelPath);
  return { error: null };
}
