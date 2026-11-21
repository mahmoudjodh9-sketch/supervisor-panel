"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { flagsOf, type PermissionMode, type PermissionScopeInput, type PickItem, type ReviewMode } from "@/lib/recording-permissions";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsChannel, ownsCourse, ownsLecture } from "@/lib/supervisor-content";

type ActionResult = { error: string | null };
const PAGE_PATH = "/recording-permissions";

/* المشرف: يقدر يدّي صلاحيات على موادّه ومحاضراته بس، وتسجيلات طلابه دايمًا بتحتاج مراجعة المالك */
interface Actor {
  kind: "owner" | "supervisor";
  supervisorId: string | null;
}

async function getActor(): Promise<Actor | null> {
  const supervisorId = await getSupervisorId();
  return supervisorId ? { kind: "supervisor", supervisorId } : null;
}

async function scopeAllowed(scope: PermissionScopeInput): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  if (scope.type === "course" && scope.id) {
    return (await ownsCourse(supervisorId, scope.id)) ? null : "غير مصرّح";
  }
  if (scope.type === "lecture" && scope.id) {
    return (await ownsLecture(supervisorId, scope.id)) ? null : "غير مصرّح";
  }
  return "المشرف يقدر يدّي صلاحية على المواد والمحاضرات بس";
}

function effectiveReview(_requested: ReviewMode): ReviewMode {
  return "review";
}

async function checkChannel(channelId: string): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  return (await ownsChannel(supervisorId, channelId)) ? null : "غير مصرّح";
}

async function checkCourse(courseId: string): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  return (await ownsCourse(supervisorId, courseId)) ? null : "غير مصرّح";
}

async function ownsPermission(id: string): Promise<string | null> {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) return "غير مصرّح";
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recording_permissions")
    .select("granted_by_supervisor_id")
    .eq("id", id)
    .maybeSingle();
  return data?.granted_by_supervisor_id === supervisorId ? null : "غير مصرّح";
}

function isValidMode(mode: string): mode is PermissionMode {
  return mode === "both" || mode === "record" || mode === "upload";
}

export async function fetchCoursesForChannel(channelId: string): Promise<{ items: PickItem[]; error: string | null }> {
  const denied = await checkChannel(channelId);
  if (denied) return { items: [], error: denied };
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .eq("channel_id", channelId)
    .order("order_index", { ascending: true, nullsFirst: false });
  if (error) return { items: [], error: error.message };
  return { items: (data ?? []).map((c) => ({ id: c.id as string, title: c.title as string })), error: null };
}

export async function fetchLecturesForCourse(courseId: string): Promise<{ items: PickItem[]; error: string | null }> {
  const denied = await checkCourse(courseId);
  if (denied) return { items: [], error: denied };
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("lectures")
    .select("id, title")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true, nullsFirst: false });
  if (error) return { items: [], error: error.message };
  return { items: (data ?? []).map((l) => ({ id: l.id as string, title: l.title as string })), error: null };
}

export async function addRecordingPermissions(input: {
  username: string;
  mode: PermissionMode;
  reviewMode: ReviewMode;
  scopes: PermissionScopeInput[];
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { error: "غير مصرّح" };

  const username = input.username.trim();
  if (!username) return { error: "اكتب يوزر نيم الطالب" };
  if (!isValidMode(input.mode)) return { error: "نوع الصلاحية غير صالح" };
  if (!input.scopes || input.scopes.length === 0) return { error: "اختار نطاق واحد على الأقل" };
  if (input.scopes.length > 200) return { error: "عدد النطاقات كبير جدًا" };

  for (const scope of input.scopes) {
    const denied = await scopeAllowed(scope);
    if (denied) return { error: denied };
  }

  const supabase = createServerClient();
  const { data: studentRows, error: findError } = await supabase.rpc("find_student_by_username", {
    input_username: username,
  });
  if (findError) return { error: findError.message };
  const student = (studentRows as { student_id: string }[] | null)?.[0];
  if (!student) return { error: "لا يوجد طالب بهذا اليوزر نيم" };

  const { canRecord, canUpload } = flagsOf(input.mode);
  const reviewMode = effectiveReview(input.reviewMode);

  for (const scope of input.scopes) {
    // نفس الطالب + نفس النطاق + نفس اللي منح: نستبدل القديم
    let del = supabase
      .from("recording_permissions")
      .delete()
      .eq("student_id", student.student_id)
      .eq("scope_type", scope.type)
      .eq("granted_by_kind", actor.kind);
    del = scope.id ? del.eq("scope_id", scope.id) : del.is("scope_id", null);
    del = scope.type === "level" && scope.level ? del.eq("scope_level", scope.level) : del.is("scope_level", null);
    del = actor.supervisorId ? del.eq("granted_by_supervisor_id", actor.supervisorId) : del.is("granted_by_supervisor_id", null);
    const { error: delError } = await del;
    if (delError) return { error: delError.message };

    const { error: insError } = await supabase.from("recording_permissions").insert({
      student_id: student.student_id,
      scope_type: scope.type,
      scope_id: scope.id,
      scope_level: scope.type === "level" ? scope.level : null,
      can_record: canRecord,
      can_upload: canUpload,
      review_mode: reviewMode,
      granted_by_kind: actor.kind,
      granted_by_supervisor_id: actor.supervisorId,
    });
    if (insError) return { error: insError.message };
  }

  revalidatePath(PAGE_PATH);
  return { error: null };
}

export async function updateRecordingPermission(
  id: string,
  input: { mode: PermissionMode; reviewMode: ReviewMode }
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { error: "غير مصرّح" };
  if (!isValidMode(input.mode)) return { error: "نوع الصلاحية غير صالح" };

  const supabase = createServerClient();
  const denied = await ownsPermission(id);
  if (denied) return { error: denied };

  const { canRecord, canUpload } = flagsOf(input.mode);
  const { error } = await supabase
    .from("recording_permissions")
    .update({ can_record: canRecord, can_upload: canUpload, review_mode: effectiveReview(input.reviewMode) })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PAGE_PATH);
  return { error: null };
}

export async function deleteRecordingPermission(id: string): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { error: "غير مصرّح" };

  const denied = await ownsPermission(id);
  if (denied) return { error: denied };

  const supabase = createServerClient();
  const { error } = await supabase.from("recording_permissions").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(PAGE_PATH);
  return { error: null };
}
