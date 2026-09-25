import { createServerClient } from "@/lib/supabase/server";

export interface CourseRow {
  id: string;
  title: string;
  coverUrl: string | null;
  icon: string | null;
  channelId: string | null;
  channelName: string | null;
  studentCount: number;
  lectureCount: number;
  isFree: boolean;
  pricingType: "free" | "paid" | "mixed";
  status: "active" | "hidden";
  created_at: string;
  order_index: number;
}

export interface ChannelOptionForCourse {
  id: string;
  name: string;
  levelNumber: number;
}

export async function getCourses(): Promise<{ courses: CourseRow[]; error: string | null }> {
  const supabase = createServerClient();

  const [coursesRes, channelsRes, lecturesRes, unlocksRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, cover_image, icon, is_active, created_at, channel_id, is_free, pricing_type, order_index"
      )
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase.from("channels").select("id, name"),
    supabase.from("lectures").select("course_id"),
    supabase.from("subject_unlocks").select("student_id, course_id"),
  ]);

  if (coursesRes.error) return { courses: [], error: coursesRes.error.message };
  if (channelsRes.error) return { courses: [], error: channelsRes.error.message };
  if (lecturesRes.error) return { courses: [], error: lecturesRes.error.message };
  if (unlocksRes.error) return { courses: [], error: unlocksRes.error.message };

  const channelNameById = new Map((channelsRes.data ?? []).map((c) => [c.id, c.name]));

  const lectureCountByCourse = new Map<string, number>();
  for (const row of lecturesRes.data ?? []) {
    const courseId = (row as { course_id: string }).course_id;
    lectureCountByCourse.set(courseId, (lectureCountByCourse.get(courseId) ?? 0) + 1);
  }

  const studentsByCourse = new Map<string, Set<string>>();
  for (const row of unlocksRes.data ?? []) {
    const r = row as { student_id: string; course_id: string };
    if (!studentsByCourse.has(r.course_id)) studentsByCourse.set(r.course_id, new Set());
    studentsByCourse.get(r.course_id)!.add(r.student_id);
  }

  const courses: CourseRow[] = (coursesRes.data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    coverUrl: c.cover_image,
    icon: c.icon,
    channelId: c.channel_id,
    channelName: c.channel_id ? channelNameById.get(c.channel_id) ?? null : null,
    studentCount: studentsByCourse.get(c.id)?.size ?? 0,
    lectureCount: lectureCountByCourse.get(c.id) ?? 0,
    isFree: c.is_free,
    pricingType: (c.pricing_type as "free" | "paid" | "mixed") ?? (c.is_free ? "free" : "paid"),
    status: c.is_active ? "active" : "hidden",
    created_at: c.created_at,
    order_index: c.order_index ?? 0,
  }));

  return { courses, error: null };
}

export interface SimpleCourseOption {
  id: string;
  title: string;
  channelId: string | null;
  channelName: string | null;
  levelNumber: number | null;
}

export async function getChannelOptionsForCourses(): Promise<ChannelOptionForCourse[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("channels")
    .select("id, name, level_number")
    .order("level_number")
    .order("name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, levelNumber: c.level_number }));
}

export async function getSimpleCourseOptions(): Promise<SimpleCourseOption[]> {
  const supabase = createServerClient();
  const [{ data: courses }, { data: channels }] = await Promise.all([
    supabase.from("courses").select("id, title, channel_id").order("title"),
    supabase.from("channels").select("id, name, level_number"),
  ]);

  const channelById = new Map(
    (channels ?? []).map((c) => [c.id, { name: c.name, levelNumber: c.level_number as number }])
  );

  return (courses ?? []).map((c) => {
    const channel = c.channel_id ? channelById.get(c.channel_id) : undefined;
    return {
      id: c.id,
      title: c.title,
      channelId: c.channel_id,
      channelName: channel?.name ?? null,
      levelNumber: channel?.levelNumber ?? null,
    };
  });
}
