import { createServerClient } from "@/lib/supabase/server";

export type PermissionScopeType = "app" | "level" | "channel" | "course" | "lecture";
export type PermissionMode = "both" | "record" | "upload";
export type ReviewMode = "auto" | "review";

export interface PermissionScopeInput {
  type: PermissionScopeType;
  id: string | null;
  level: number | null;
}

export interface PermissionRow {
  id: string;
  studentId: string;
  username: string;
  scopeType: PermissionScopeType;
  scopeLevel: number | null;
  scopeName: string | null; // اسم القناة/المادة/المحاضرة
  scopeParent: string | null; // اسم المادة (للمحاضرة)
  mode: PermissionMode;
  reviewMode: ReviewMode;
  grantedByKind: "owner" | "supervisor";
  grantedByName: string | null;
  createdAt: string;
}

export interface PermissionChannelOption {
  id: string;
  name: string;
  levelNumber: number;
}

export interface PickItem {
  id: string;
  title: string;
}

export function modeOf(canRecord: boolean, canUpload: boolean): PermissionMode {
  if (canRecord && canUpload) return "both";
  return canRecord ? "record" : "upload";
}

export function flagsOf(mode: PermissionMode): { canRecord: boolean; canUpload: boolean } {
  return { canRecord: mode !== "upload", canUpload: mode !== "record" };
}

/** كل الصلاحيات (للمالك) أو اللي منحها مشرف معيّن (لو اتبعت supervisorId). */
export async function getRecordingPermissionRows(
  supervisorId?: string
): Promise<{ rows: PermissionRow[]; error: string | null }> {
  const supabase = createServerClient();

  let query = supabase
    .from("recording_permissions")
    .select(
      "id, student_id, scope_type, scope_id, scope_level, can_record, can_upload, review_mode, granted_by_kind, granted_by_supervisor_id, created_at"
    )
    .order("created_at", { ascending: false });
  if (supervisorId) query = query.eq("granted_by_supervisor_id", supervisorId);

  const { data, error } = await query;
  if (error) return { rows: [], error: error.message };
  const perms = data ?? [];
  if (perms.length === 0) return { rows: [], error: null };

  const ids = (type: string) =>
    Array.from(new Set(perms.filter((p) => p.scope_type === type && p.scope_id).map((p) => p.scope_id as string)));
  const studentIds = Array.from(new Set(perms.map((p) => p.student_id as string)));
  const supervisorIds = Array.from(
    new Set(perms.filter((p) => p.granted_by_supervisor_id).map((p) => p.granted_by_supervisor_id as string))
  );
  const channelIds = ids("channel");
  const courseIds = ids("course");
  const lectureIds = ids("lecture");

  const [usersRes, channelsRes, coursesRes, lecturesRes, supervisorsRes] = await Promise.all([
    supabase.from("users").select("id, username").in("id", studentIds),
    channelIds.length ? supabase.from("channels").select("id, name").in("id", channelIds) : Promise.resolve({ data: [] }),
    courseIds.length ? supabase.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] }),
    lectureIds.length
      ? supabase.from("lectures").select("id, title, course_id").in("id", lectureIds)
      : Promise.resolve({ data: [] }),
    supervisorIds.length
      ? supabase.from("supervisors").select("id, name").in("id", supervisorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const usernameById = new Map(((usersRes.data ?? []) as { id: string; username: string }[]).map((u) => [u.id, u.username]));
  const channelName = new Map(((channelsRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const courseTitle = new Map(((coursesRes.data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]));
  const lectureRows = (lecturesRes.data ?? []) as { id: string; title: string; course_id: string }[];
  const lectureTitle = new Map(lectureRows.map((l) => [l.id, l]));
  const supervisorName = new Map(((supervisorsRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  // أسماء مواد المحاضرات (للعرض)
  const lectureCourseIds = Array.from(new Set(lectureRows.map((l) => l.course_id).filter((id) => !courseTitle.has(id))));
  if (lectureCourseIds.length) {
    const { data: more } = await supabase.from("courses").select("id, title").in("id", lectureCourseIds);
    for (const c of (more ?? []) as { id: string; title: string }[]) courseTitle.set(c.id, c.title);
  }

  const rows: PermissionRow[] = perms.map((p) => {
    const scopeType = p.scope_type as PermissionScopeType;
    const scopeId = p.scope_id as string | null;
    let scopeName: string | null = null;
    let scopeParent: string | null = null;
    if (scopeType === "channel" && scopeId) scopeName = channelName.get(scopeId) ?? null;
    if (scopeType === "course" && scopeId) scopeName = courseTitle.get(scopeId) ?? null;
    if (scopeType === "lecture" && scopeId) {
      const l = lectureTitle.get(scopeId);
      scopeName = l?.title ?? null;
      scopeParent = l ? courseTitle.get(l.course_id) ?? null : null;
    }
    return {
      id: p.id as string,
      studentId: p.student_id as string,
      username: usernameById.get(p.student_id as string) ?? "—",
      scopeType,
      scopeLevel: (p.scope_level as number | null) ?? null,
      scopeName,
      scopeParent,
      mode: modeOf(Boolean(p.can_record), Boolean(p.can_upload)),
      reviewMode: p.review_mode as ReviewMode,
      grantedByKind: p.granted_by_kind as "owner" | "supervisor",
      grantedByName: p.granted_by_supervisor_id ? supervisorName.get(p.granted_by_supervisor_id as string) ?? null : null,
      createdAt: p.created_at as string,
    };
  });

  return { rows, error: null };
}
