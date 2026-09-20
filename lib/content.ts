import { createServerClient } from "@/lib/supabase/server";
import { getChannels, getSupervisorOptions, type ChannelRow, type SupervisorOption } from "@/lib/channels";
import { getCourses, type CourseRow } from "@/lib/courses";
import { getLecturesForCourse, type LectureRow, type LectureCategory, type LectureItemRow, type LectureItemType } from "@/lib/lectures";

export type { ChannelRow, SupervisorOption, CourseRow, LectureRow, LectureCategory, LectureItemRow, LectureItemType };

/* ------------------------------------------------------------------ */
/*  الفرقة → القنوات                                                   */
/* ------------------------------------------------------------------ */

export async function getChannelsByLevel(
  level: number
): Promise<{ channels: ChannelRow[]; error: string | null }> {
  const { channels, error } = await getChannels();
  if (error) return { channels: [], error };
  return { channels: channels.filter((c) => c.levelNumber === level), error: null };
}

export { getSupervisorOptions };

/* ------------------------------------------------------------------ */
/*  القناة → الدورات                                                   */
/* ------------------------------------------------------------------ */

export async function getCoursesByChannel(
  channelId: string
): Promise<{ courses: CourseRow[]; error: string | null }> {
  const { courses, error } = await getCourses();
  if (error) return { courses: [], error };
  return { courses: courses.filter((c) => c.channelId === channelId), error: null };
}

/* ------------------------------------------------------------------ */
/*  الدورة → المحاضرات                                                  */
/* ------------------------------------------------------------------ */

export { getLecturesForCourse };

/* ------------------------------------------------------------------ */
/*  Breadcrumb — أسماء العناصر في المسار (الفرقة > القناة > الدورة > المحاضرة) */
/* ------------------------------------------------------------------ */

export interface BreadcrumbNames {
  channelName: string | null;
  courseTitle: string | null;
  lectureTitle: string | null;
}

export async function getBreadcrumbNames(opts: {
  channelId?: string;
  courseId?: string;
  lectureId?: string;
}): Promise<BreadcrumbNames> {
  const supabase = createServerClient();

  const [channelRes, courseRes, lectureRes] = await Promise.all([
    opts.channelId
      ? supabase.from("channels").select("name").eq("id", opts.channelId).maybeSingle()
      : Promise.resolve({ data: null }),
    opts.courseId
      ? supabase.from("courses").select("title").eq("id", opts.courseId).maybeSingle()
      : Promise.resolve({ data: null }),
    opts.lectureId
      ? supabase.from("lectures").select("title").eq("id", opts.lectureId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    channelName: (channelRes.data as { name: string } | null)?.name ?? null,
    courseTitle: (courseRes.data as { title: string } | null)?.title ?? null,
    lectureTitle: (lectureRes.data as { title: string } | null)?.title ?? null,
  };
}
