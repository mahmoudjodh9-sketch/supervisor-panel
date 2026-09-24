import { createServerClient } from "@/lib/supabase/server";

export type PaymentStatus = "pending" | "confirmed" | "rejected";

export interface PaymentRow {
  id: string;
  studentId: string;
  studentName: string | null;
  studentUsername: string;
  courseId: string;
  courseTitle: string;
  channelId: string | null;
  channelName: string | null;
  status: PaymentStatus;
  note: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export async function getMyPayments(
  supervisorId: string
): Promise<{ payments: PaymentRow[]; error: string | null }> {
  const supabase = createServerClient();

  const [paymentsRes, usersRes, coursesRes, channelsRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, status, note, created_at, confirmed_at, student_id, course_id")
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, full_name, username"),
    supabase.from("courses").select("id, title, channel_id"),
    supabase.from("channels").select("id, name, supervisor_id"),
  ]);

  if (paymentsRes.error) return { payments: [], error: paymentsRes.error.message };
  if (usersRes.error) return { payments: [], error: usersRes.error.message };
  if (coursesRes.error) return { payments: [], error: coursesRes.error.message };
  if (channelsRes.error) return { payments: [], error: channelsRes.error.message };

  const myChannelIds = new Set(
    (channelsRes.data ?? []).filter((c) => c.supervisor_id === supervisorId).map((c) => c.id)
  );
  const channelNameById = new Map((channelsRes.data ?? []).map((c) => [c.id, c.name]));
  const userById = new Map((usersRes.data ?? []).map((u) => [u.id, u]));
  const courseById = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));

  const payments: PaymentRow[] = (paymentsRes.data ?? [])
    .filter((p) => {
      const course = courseById.get(p.course_id) as { channel_id: string | null } | undefined;
      return course?.channel_id ? myChannelIds.has(course.channel_id) : false;
    })
    .map((p) => {
      const student = userById.get(p.student_id) as
        | { full_name: string | null; username: string }
        | undefined;
      const course = courseById.get(p.course_id) as
        | { title: string; channel_id: string | null }
        | undefined;

      return {
        id: p.id,
        studentId: p.student_id,
        studentName: student?.full_name ?? null,
        studentUsername: student?.username ?? "",
        courseId: p.course_id,
        courseTitle: course?.title ?? "",
        channelId: course?.channel_id ?? null,
        channelName: course?.channel_id ? channelNameById.get(course.channel_id) ?? null : null,
        status: p.status as PaymentStatus,
        note: p.note,
        created_at: p.created_at,
        confirmed_at: p.confirmed_at,
      };
    });

  return { payments, error: null };
}
