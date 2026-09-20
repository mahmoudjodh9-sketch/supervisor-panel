import { createServerClient } from "@/lib/supabase/server";

export interface CourseOptionForLectures {
  id: string;
  title: string;
  channelName: string | null;
  isFree: boolean;
}

export async function getCourseOptionsForLectures(): Promise<CourseOptionForLectures[]> {
  const supabase = createServerClient();
  const [{ data: courses }, { data: channels }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, channel_id, is_free")
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase.from("channels").select("id, name"),
  ]);

  const channelNameById = new Map((channels ?? []).map((c) => [c.id, c.name]));

  return (courses ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    channelName: c.channel_id ? channelNameById.get(c.channel_id) ?? null : null,
    isFree: c.is_free,
  }));
}

export type LectureCategory = "شرح" | "مراجعة";

export interface LectureRow {
  id: string;
  courseId: string;
  title: string;
  category: LectureCategory;
  orderIndex: number;
  isFree: boolean;
  hasQuiz: boolean;
  itemCount: number;
  createdAt: string;
}

export async function getLecturesForCourse(
  courseId: string
): Promise<{ lectures: LectureRow[]; error: string | null }> {
  const supabase = createServerClient();

  const [lecturesRes, itemsRes] = await Promise.all([
    supabase
      .from("lectures")
      .select("id, course_id, title, category, order_index, is_free, has_quiz, created_at")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase.from("lecture_items").select("lecture_id"),
  ]);

  if (lecturesRes.error) return { lectures: [], error: lecturesRes.error.message };
  if (itemsRes.error) return { lectures: [], error: itemsRes.error.message };

  const itemCountByLecture = new Map<string, number>();
  for (const row of itemsRes.data ?? []) {
    const lectureId = (row as { lecture_id: string }).lecture_id;
    itemCountByLecture.set(lectureId, (itemCountByLecture.get(lectureId) ?? 0) + 1);
  }

  const lectures: LectureRow[] = (lecturesRes.data ?? []).map((l) => ({
    id: l.id,
    courseId: l.course_id,
    title: l.title,
    category: (l.category ?? "شرح") as LectureCategory,
    orderIndex: l.order_index ?? 0,
    isFree: l.is_free ?? false,
    hasQuiz: l.has_quiz ?? false,
    itemCount: itemCountByLecture.get(l.id) ?? 0,
    createdAt: l.created_at,
  }));

  return { lectures, error: null };
}

export type LectureItemType = "video" | "pdf";

export interface LectureItemRow {
  id: string;
  lectureId: string;
  type: LectureItemType;
  title: string;
  url: string;
  orderIndex: number;
  createdAt: string;
}

export async function getLectureItems(
  lectureId: string
): Promise<{ items: LectureItemRow[]; error: string | null }> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("lecture_items")
    .select("id, lecture_id, type, title, url, order_index, created_at")
    .eq("lecture_id", lectureId)
    .order("order_index", { ascending: true, nullsFirst: false });

  if (error) return { items: [], error: error.message };

  const items: LectureItemRow[] = (data ?? []).map((i) => ({
    id: i.id,
    lectureId: i.lecture_id,
    type: i.type,
    title: i.title,
    url: i.url,
    orderIndex: i.order_index ?? 0,
    createdAt: i.created_at,
  }));

  return { items, error: null };
}
