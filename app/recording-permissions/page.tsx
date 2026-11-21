import { redirect } from "next/navigation";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { getMyChannels } from "@/lib/supervisor-content";
import { getRecordingPermissionRows, type PermissionChannelOption } from "@/lib/recording-permissions";
import { RecordingPermissionsClient } from "@/components/RecordingPermissionsClient";

export const dynamic = "force-dynamic";

export default async function RecordingPermissionsPage() {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const [{ rows, error }, { channels }] = await Promise.all([
    getRecordingPermissionRows(supervisorId),
    getMyChannels(supervisorId),
  ]);

  const channelOptions: PermissionChannelOption[] = channels.map((c) => ({
    id: c.id,
    name: c.name,
    levelNumber: c.levelNumber,
  }));

  return (
    <RecordingPermissionsClient initialRows={rows} channelOptions={channelOptions} isSupervisor loadError={error} />
  );
}
