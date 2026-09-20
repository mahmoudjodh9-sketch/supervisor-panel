import { redirect } from "next/navigation";
import { getCoursesByChannel, getBreadcrumbNames } from "@/lib/content";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { ownsChannel } from "@/lib/supervisor-content";
import { ContentCoursesClient } from "@/components/ContentCoursesClient";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ level: string; channelId: string }>;
}) {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const { level: levelParam, channelId } = await params;
  const level = Number(levelParam);

  const owned = await ownsChannel(supervisorId, channelId);
  if (!owned) redirect("/content");

  const [{ courses, error }, { channelName }] = await Promise.all([
    getCoursesByChannel(channelId),
    getBreadcrumbNames({ channelId }),
  ]);

  return (
    <ContentCoursesClient
      level={level}
      channelId={channelId}
      channelName={channelName ?? ""}
      initialCourses={courses}
      loadError={error}
    />
  );
}
