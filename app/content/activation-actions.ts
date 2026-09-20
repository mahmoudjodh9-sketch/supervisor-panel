"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  getUnlockCodesForCourse,
  getLecturesForCourse,
  type UnlockCodeRow,
  type LectureOption,
} from "@/lib/unlockCodes";

type ActionResult = { error: string | null };

export async function fetchUnlockCodes(
  courseId: string
): Promise<{ codes: UnlockCodeRow[]; error: string | null }> {
  return getUnlockCodesForCourse(courseId);
}

export async function fetchLecturesForCourse(courseId: string): Promise<LectureOption[]> {
  return getLecturesForCourse(courseId);
}

function randomCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function activateCourseForStudent(
  courseId: string,
  username: string,
  channelPath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  const cleanUsername = username.trim();
  if (!cleanUsername) return { error: "اسم المستخدم مطلوب" };

  const { data: student, error: studentError } = await supabase
    .from("users")
    .select("id")
    .eq("username", cleanUsername)
    .eq("role", "student")
    .maybeSingle();

  if (studentError) return { error: studentError.message };
  if (!student) return { error: "لا يوجد طالب بهذا الاسم" };

  const { data: existing } = await supabase
    .from("subject_unlocks")
    .select("id")
    .eq("student_id", student.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return { error: "الدورة مُفعّلة بالفعل لهذا الطالب" };

  const { error } = await supabase.from("subject_unlocks").insert({
    student_id: student.id,
    course_id: courseId,
    activated_by: "owner",
    unlocked_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath(channelPath);
  revalidatePath("/users");
  return { error: null };
}

export async function createUnlockCode(formData: FormData, channelPath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const courseId = String(formData.get("courseId") || "");
  const lectureId = String(formData.get("lectureId") || "").trim() || null;
  const customCode = String(formData.get("code") || "").trim().toUpperCase();
  const maxUsesRaw = String(formData.get("maxUses") || "").trim();
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();

  if (!courseId) return { error: "الدورة مطلوبة" };

  const code = customCode || randomCode();
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  const { error } = await supabase.from("unlock_codes").insert({
    code,
    course_id: courseId,
    lecture_id: lectureId,
    max_uses: maxUses,
    used_count: 0,
    expires_at: expiresAt,
    is_active: true,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return { error: "الكود ده مستخدم بالفعل، جرب كود تاني" };
    }
    return { error: error.message };
  }

  revalidatePath(channelPath);
  return { error: null };
}

export async function toggleUnlockCodeActive(
  id: string,
  currentActive: boolean,
  channelPath: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("unlock_codes")
    .update({ is_active: !currentActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(channelPath);
  return { error: null };
}

export async function deleteUnlockCode(id: string, channelPath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const { error } = await supabase.from("unlock_codes").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(channelPath);
  return { error: null };
}
