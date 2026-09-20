import { createServerClient } from "@/lib/supabase/server";

export interface UnlockCodeRow {
  id: string;
  code: string;
  lectureId: string | null;
  lectureTitle: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface LectureOption {
  id: string;
  title: string;
}

export async function getUnlockCodesForCourse(
  courseId: string
): Promise<{ codes: UnlockCodeRow[]; error: string | null }> {
  const supabase = createServerClient();

  const [codesRes, lecturesRes] = await Promise.all([
    supabase
      .from("unlock_codes")
      .select("id, code, lecture_id, max_uses, used_count, expires_at, is_active, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false }),
    supabase.from("lectures").select("id, title").eq("course_id", courseId),
  ]);

  if (codesRes.error) return { codes: [], error: codesRes.error.message };
  if (lecturesRes.error) return { codes: [], error: lecturesRes.error.message };

  const lectureTitleById = new Map((lecturesRes.data ?? []).map((l) => [l.id, l.title]));

  const codes: UnlockCodeRow[] = (codesRes.data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    lectureId: c.lecture_id,
    lectureTitle: c.lecture_id ? lectureTitleById.get(c.lecture_id) ?? null : null,
    maxUses: c.max_uses,
    usedCount: c.used_count ?? 0,
    expiresAt: c.expires_at,
    isActive: c.is_active ?? true,
    createdAt: c.created_at,
  }));

  return { codes, error: null };
}

export async function getLecturesForCourse(courseId: string): Promise<LectureOption[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("lectures")
    .select("id, title")
    .eq("course_id", courseId)
    .order("order_index");
  return data ?? [];
}
