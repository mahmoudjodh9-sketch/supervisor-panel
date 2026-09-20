import { createServerClient } from "@/lib/supabase/server";

export interface ChannelRow {
  id: string;
  name: string;
  logoUrl: string | null;
  supervisorName: string | null;
  supervisorId: string | null;
  courseCount: number;
  studentCount: number;
  status: "active" | "hidden";
  created_at: string;
  order_index: number;
  levelNumber: number;
  color: string | null;
  colorDay: string | null;
  colorNight: string | null;
  coverUrl: string | null;
}

export interface SupervisorOption {
  id: string;
  name: string;
}

export async function getChannels(): Promise<{ channels: ChannelRow[]; error: string | null }> {
  const supabase = createServerClient();

  const [channelsRes, supervisorsRes, coursesRes, unlocksRes] = await Promise.all([
    supabase
      .from("channels")
      .select(
        "id, name, logo_image, cover_image, is_active, created_at, supervisor_id, order_index, level_number, color, color_day, color_night"
      )
      .order("order_index", { ascending: true, nullsFirst: false }),
    supabase.from("supervisors").select("id, name"),
    supabase.from("courses").select("id, channel_id"),
    supabase.from("subject_unlocks").select("student_id, course_id"),
  ]);

  if (channelsRes.error) return { channels: [], error: channelsRes.error.message };
  if (supervisorsRes.error) return { channels: [], error: supervisorsRes.error.message };
  if (coursesRes.error) return { channels: [], error: coursesRes.error.message };
  if (unlocksRes.error) return { channels: [], error: unlocksRes.error.message };

  const supervisorNameById = new Map((supervisorsRes.data ?? []).map((s) => [s.id, s.name]));

  const courseIdsByChannel = new Map<string, Set<string>>();
  for (const c of coursesRes.data ?? []) {
    const row = c as { id: string; channel_id: string | null };
    if (!row.channel_id) continue;
    if (!courseIdsByChannel.has(row.channel_id)) courseIdsByChannel.set(row.channel_id, new Set());
    courseIdsByChannel.get(row.channel_id)!.add(row.id);
  }

  const studentsByCourse = new Map<string, Set<string>>();
  for (const u of unlocksRes.data ?? []) {
    const row = u as { student_id: string; course_id: string };
    if (!studentsByCourse.has(row.course_id)) studentsByCourse.set(row.course_id, new Set());
    studentsByCourse.get(row.course_id)!.add(row.student_id);
  }

  const channels: ChannelRow[] = (channelsRes.data ?? []).map((c) => {
    const courseIds = courseIdsByChannel.get(c.id) ?? new Set<string>();
    const studentIds = new Set<string>();
    for (const courseId of courseIds) {
      for (const studentId of studentsByCourse.get(courseId) ?? []) studentIds.add(studentId);
    }
    return {
      id: c.id,
      name: c.name,
      logoUrl: c.logo_image,
      supervisorName: c.supervisor_id ? supervisorNameById.get(c.supervisor_id) ?? null : null,
      supervisorId: c.supervisor_id ?? null,
      courseCount: courseIds.size,
      studentCount: studentIds.size,
      status: c.is_active ? "active" : "hidden",
      created_at: c.created_at,
      order_index: c.order_index ?? 0,
      levelNumber: c.level_number,
      color: c.color,
      colorDay: c.color_day ?? c.color,
      colorNight: c.color_night ?? c.color,
      coverUrl: c.cover_image,
    };
  });

  return { channels, error: null };
}

export async function getSupervisorOptions(): Promise<SupervisorOption[]> {
  const supabase = createServerClient();
  const { data } = await supabase.from("supervisors").select("id, name").order("name");
  return data ?? [];
}
