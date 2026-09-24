import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { getMyChannels } from "@/lib/supervisor-content";
import { SupervisorHomeClient } from "@/components/SupervisorHomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const supabase = createServerClient();
  const [{ channels }, supervisorRes] = await Promise.all([
    getMyChannels(supervisorId),
    supabase.from("supervisors").select("name").eq("id", supervisorId).maybeSingle(),
  ]);

  return (
    <SupervisorHomeClient
      supervisorName={supervisorRes.data?.name ?? ""}
      channels={channels}
    />
  );
}
