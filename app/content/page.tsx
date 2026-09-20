import { redirect } from "next/navigation";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { getMyChannels } from "@/lib/supervisor-content";
import { SupervisorContentLevelsClient } from "@/components/SupervisorContentLevelsClient";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const { channels } = await getMyChannels(supervisorId);

  const levels = Array.from(new Set(channels.map((c) => c.levelNumber)))
    .sort((a, b) => a - b)
    .map((levelNumber) => ({
      levelNumber,
      channelCount: channels.filter((c) => c.levelNumber === levelNumber).length,
    }));

  return <SupervisorContentLevelsClient levels={levels} />;
}
