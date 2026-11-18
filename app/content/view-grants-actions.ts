"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsLecture } from "@/lib/supervisor-content";

type ActionResult = { error: string | null };

export interface ExtraViewGrantRow {
  id: string;
  username: string;
  extraViews: number;
  grantedAt: string;
}

/* فحص الصلاحية: المشرف لازم يكون مالك المحاضرة */
async function checkLecture(lectureId: string): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  const owned = await ownsLecture(supervisorId, lectureId);
  return owned ? null : "غير مصرّح";
}

/** يتأكد إن العنصر فيديو أو PDF ويرجّع محاضرته. */
async function lectureOfItem(
  lectureItemId: string
): Promise<{ lectureId: string | null; error: string | null }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("lecture_items")
    .select("lecture_id, type")
    .eq("id", lectureItemId)
    .maybeSingle();
  if (error) return { lectureId: null, error: error.message };
  if (!data) return { lectureId: null, error: "العنصر غير موجود" };
  if (data.type !== "video" && data.type !== "pdf") {
    return { lectureId: null, error: "المحاولات الإضافية للفيديو والـPDF فقط" };
  }
  return { lectureId: data.lecture_id as string, error: null };
}

export async function fetchExtraViewGrants(
  lectureItemId: string
): Promise<{ grants: ExtraViewGrantRow[]; error: string | null }> {
  const item = await lectureOfItem(lectureItemId);
  if (item.error || !item.lectureId) return { grants: [], error: item.error };
  const denied = await checkLecture(item.lectureId);
  if (denied) return { grants: [], error: denied };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("view_extra_grants")
    .select("id, student_id, extra_views, granted_at")
    .eq("lecture_item_id", lectureItemId)
    .order("granted_at", { ascending: false });
  if (error) return { grants: [], error: error.message };
  if (!data || data.length === 0) return { grants: [], error: null };

  const studentIds = Array.from(new Set(data.map((g) => g.student_id as string)));
  const { data: users } = await supabase.from("users").select("id, username").in("id", studentIds);
  const usernameById = new Map((users ?? []).map((u) => [u.id as string, u.username as string]));

  return {
    grants: data.map((g) => ({
      id: g.id as string,
      username: usernameById.get(g.student_id as string) ?? "—",
      extraViews: g.extra_views as number,
      grantedAt: g.granted_at as string,
    })),
    error: null,
  };
}

export async function addExtraViewGrant(
  lectureItemId: string,
  username: string,
  extraViews: number,
  lecturePath: string
): Promise<ActionResult> {
  const item = await lectureOfItem(lectureItemId);
  if (item.error || !item.lectureId) return { error: item.error };
  const denied = await checkLecture(item.lectureId);
  if (denied) return { error: denied };

  const trimmed = username.trim();
  if (!trimmed) return { error: "اكتب يوزر نيم الطالب" };
  if (!Number.isInteger(extraViews) || extraViews < 1 || extraViews > 100) {
    return { error: "عدد المحاولات لازم يكون من 1 إلى 100" };
  }

  const supabase = createServerClient();
  const { data: studentRows, error: findError } = await supabase.rpc("find_student_by_username", {
    input_username: trimmed,
  });
  if (findError) return { error: findError.message };

  const student = (studentRows as { student_id: string; student_username: string }[] | null)?.[0];
  if (!student) return { error: "لا يوجد طالب بهذا اليوزر نيم" };

  const { error } = await supabase.from("view_extra_grants").insert({
    lecture_item_id: lectureItemId,
    student_id: student.student_id,
    extra_views: extraViews,
  });
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}

export async function deleteExtraViewGrant(grantId: string, lecturePath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const { data: grant } = await supabase
    .from("view_extra_grants")
    .select("lecture_item_id")
    .eq("id", grantId)
    .maybeSingle();
  if (!grant) return { error: "المنح غير موجود" };

  const item = await lectureOfItem(grant.lecture_item_id as string);
  if (item.error || !item.lectureId) return { error: item.error };
  const denied = await checkLecture(item.lectureId);
  if (denied) return { error: denied };

  const { error } = await supabase.from("view_extra_grants").delete().eq("id", grantId);
  if (error) return { error: error.message };

  revalidatePath(lecturePath);
  return { error: null };
}
