"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsCourse } from "@/lib/supervisor-content";

type ActionResult = { error: string | null };

export async function createPayment(formData: FormData): Promise<ActionResult> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return { error: "الجلسة منتهية، سجّل الدخول تاني" };

  const supabase = createServerClient();

  const username = String(formData.get("username") || "").trim();
  const courseId = String(formData.get("courseId") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!username) return { error: "اسم المستخدم مطلوب" };
  if (!courseId) return { error: "الدورة مطلوبة" };

  const owned = await ownsCourse(supervisorId, courseId);
  if (!owned) return { error: "غير مصرح لك بهذه الدورة" };

  const { data: student, error: studentError } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .eq("role", "student")
    .maybeSingle();

  if (studentError) return { error: studentError.message };
  if (!student) return { error: "لا يوجد طالب بهذا الاسم" };

  const { data: existingUnlock } = await supabase
    .from("subject_unlocks")
    .select("id")
    .eq("student_id", student.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingUnlock) return { error: "الدورة مُفعّلة بالفعل لهذا الطالب" };

  const { error } = await supabase.from("payments").insert({
    student_id: student.id,
    course_id: courseId,
    note: note || null,
    status: "pending",
    created_by: "supervisor",
  });

  if (error) return { error: error.message };

  revalidatePath("/payments");
  return { error: null };
}

export async function confirmPayment(id: string): Promise<ActionResult> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return { error: "الجلسة منتهية، سجّل الدخول تاني" };

  const supabase = createServerClient();

  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("id, student_id, course_id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!payment) return { error: "عملية الدفع غير موجودة" };

  const owned = await ownsCourse(supervisorId, payment.course_id);
  if (!owned) return { error: "غير مصرح لك بهذه العملية" };

  if (payment.status === "confirmed") return { error: null };

  const { data: existingUnlock } = await supabase
    .from("subject_unlocks")
    .select("id")
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle();

  if (!existingUnlock) {
    const { error: unlockError } = await supabase.from("subject_unlocks").insert({
      student_id: payment.student_id,
      course_id: payment.course_id,
      activated_by: "supervisor",
      unlocked_at: new Date().toISOString(),
    });
    if (unlockError) return { error: unlockError.message };
  }

  const { error } = await supabase
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: "supervisor",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/payments");
  return { error: null };
}

export async function rejectPayment(id: string): Promise<ActionResult> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return { error: "الجلسة منتهية، سجّل الدخول تاني" };

  const supabase = createServerClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("course_id")
    .eq("id", id)
    .maybeSingle();
  if (!payment) return { error: "عملية الدفع غير موجودة" };

  const owned = await ownsCourse(supervisorId, payment.course_id);
  if (!owned) return { error: "غير مصرح لك بهذه العملية" };

  const { error } = await supabase.from("payments").update({ status: "rejected" }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/payments");
  return { error: null };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return { error: "الجلسة منتهية، سجّل الدخول تاني" };

  const supabase = createServerClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("course_id")
    .eq("id", id)
    .maybeSingle();
  if (!payment) return { error: "عملية الدفع غير موجودة" };

  const owned = await ownsCourse(supervisorId, payment.course_id);
  if (!owned) return { error: "غير مصرح لك بهذه العملية" };

  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/payments");
  return { error: null };
}
