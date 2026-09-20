"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsChannel } from "@/lib/supervisor-content";

type ActionResult = { error: string | null };
type SupabaseServer = ReturnType<typeof createServerClient>;

async function uploadChannelImage(
  supabase: SupabaseServer,
  channelId: string,
  file: File,
  kind: "logo" | "cover"
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${channelId}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("channel-images")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("channel-images").getPublicUrl(path);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}

export async function updateMyChannel(formData: FormData): Promise<ActionResult> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return { error: "الجلسة منتهية، سجّل الدخول تاني" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const logoFile = formData.get("logo") as File | null;
  const coverFile = formData.get("cover") as File | null;
  const colorDay = String(formData.get("colorDay") || "").trim() || "#F97316";
  const colorNight = String(formData.get("colorNight") || "").trim() || "#F97316";

  if (!id || !name) return { error: "بيانات غير مكتملة" };

  const owned = await ownsChannel(supervisorId, id);
  if (!owned) return { error: "غير مصرح لك بتعديل هذه القناة" };

  const supabase = createServerClient();

  const { data: current } = await supabase
    .from("channels")
    .select("level_number")
    .eq("id", id)
    .maybeSingle();

  const updatePayload: Record<string, string | null> = {
    name,
    color: colorDay,
    color_day: colorDay,
    color_night: colorNight,
  };

  if (logoFile && logoFile.size > 0) {
    const { url, error: logoError } = await uploadChannelImage(supabase, id, logoFile, "logo");
    if (logoError) return { error: logoError };
    updatePayload.logo_image = url;
  }

  if (coverFile && coverFile.size > 0) {
    const { url, error: coverError } = await uploadChannelImage(supabase, id, coverFile, "cover");
    if (coverError) return { error: coverError };
    updatePayload.cover_image = url;
  }

  const { error } = await supabase.from("channels").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  if (current?.level_number) revalidatePath(`/content/${current.level_number}`);
  return { error: null };
}
