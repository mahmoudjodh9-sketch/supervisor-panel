"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getLecturesForCourse, type LectureRow } from "@/lib/lectures";

type ActionResult = { error: string | null };

export async function fetchLectures(
  courseId: string
): Promise<{ lectures: LectureRow[]; error: string | null }> {
  return getLecturesForCourse(courseId);
}

export async function createLecture(formData: FormData, coursePath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const courseId = String(formData.get("courseId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "شرح").trim();
  const isFree = formData.get("isFree") === "true";
  const hasQuiz = formData.get("hasQuiz") === "true";

  if (!courseId) return { error: "الدورة مطلوبة" };
  if (!title) return { error: "عنوان المحاضرة مطلوب" };

  const { data: maxRow } = await supabase
    .from("lectures")
    .select("order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  const { error } = await supabase.from("lectures").insert({
    course_id: courseId,
    title,
    category,
    is_free: isFree,
    has_quiz: hasQuiz,
    order_index: nextOrderIndex,
    access_type: isFree ? "free" : "paid",
  });

  if (error) return { error: error.message };

  revalidatePath(coursePath);
  return { error: null };
}

export async function updateLecture(formData: FormData, coursePath: string): Promise<ActionResult> {
  const supabase = createServerClient();

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "شرح").trim();
  const isFree = formData.get("isFree") === "true";
  const hasQuiz = formData.get("hasQuiz") === "true";

  if (!id || !title) return { error: "بيانات غير مكتملة" };

  const { error } = await supabase
    .from("lectures")
    .update({
      title,
      category,
      is_free: isFree,
      has_quiz: hasQuiz,
      access_type: isFree ? "free" : "paid",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(coursePath);
  return { error: null };
}

export async function deleteLecture(id: string, coursePath: string): Promise<ActionResult> {
  const supabase = createServerClient();
  const { error } = await supabase.from("lectures").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(coursePath);
  return { error: null };
}

export async function moveLecture(
  id: string,
  courseId: string,
  direction: "up" | "down",
  coursePath: string
): Promise<ActionResult> {
  const supabase = createServerClient();

  const { data: siblings, error } = await supabase
    .from("lectures")
    .select("id, order_index")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true, nullsFirst: false });

  if (error) return { error: error.message };

  const list = siblings ?? [];
  const index = list.findIndex((l) => l.id === id);
  if (index === -1) return { error: "المحاضرة غير موجودة" };

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return { error: null };

  const a = list[index];
  const b = list[swapWith];

  const [{ error: errA }, { error: errB }] = await Promise.all([
    supabase.from("lectures").update({ order_index: b.order_index }).eq("id", a.id),
    supabase.from("lectures").update({ order_index: a.order_index }).eq("id", b.id),
  ]);

  if (errA) return { error: errA.message };
  if (errB) return { error: errB.message };

  revalidatePath(coursePath);
  return { error: null };
}
