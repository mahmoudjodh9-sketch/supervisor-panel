import { redirect } from "next/navigation";
import { getLecturesForCourse, getBreadcrumbNames } from "@/lib/content";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsCourse } from "@/lib/supervisor-content";
import { ContentLecturesClient } from "@/components/ContentLecturesClient";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ level: string; channelId: string; courseId: string }>;
}) {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const { level: levelParam, channelId, courseId } = await params;
  const level = Number(levelParam);

  const owned = await ownsCourse(supervisorId, courseId);
  if (!owned) redirect("/content");

  const supabase = createServerClient();
  const [{ lectures, error }, { channelName, courseTitle }, courseRes] = await Promise.all([
    getLecturesForCourse(courseId),
    getBreadcrumbNames({ channelId, courseId }),
    supabase.from("courses").select("is_free").eq("id", courseId).maybeSingle(),
  ]);

  return (
    <ContentLecturesClient
      level={level}
      channelId={channelId}
      channelName={channelName ?? ""}
      courseId={courseId}
      courseTitle={courseTitle ?? ""}
      courseIsFree={Boolean(courseRes.data?.is_free)}
      initialLectures={lectures}
      loadError={error}
    />
  );
}
