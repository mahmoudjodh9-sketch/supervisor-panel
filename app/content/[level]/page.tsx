import { redirect } from "next/navigation";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { getMyChannels } from "@/lib/supervisor-content";
import { SupervisorChannelsClient } from "@/components/SupervisorChannelsClient";

export const dynamic = "force-dynamic";

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const { level: levelParam } = await params;
  const level = Number(levelParam);

  const { channels, error } = await getMyChannels(supervisorId);
  const channelsInLevel = channels.filter((c) => c.levelNumber === level);

  // لو المشرف مش له أي قناة في الفرقة دي، ميشفش الصفحة دي أصلًا.
  if (channelsInLevel.length === 0 && !error) {
    redirect("/content");
  }

  return <SupervisorChannelsClient level={level} initialChannels={channelsInLevel} loadError={error} />;
}
