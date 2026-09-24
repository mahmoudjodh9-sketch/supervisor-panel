import { redirect } from "next/navigation";
import { getSupervisorId } from "@/lib/supervisor-auth";
import { getMyPayments } from "@/lib/payments";
import { getMyCourseOptions } from "@/lib/supervisor-content";
import { PaymentsClient } from "@/components/PaymentsClient";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supervisorId = await getSupervisorId();
  if (!supervisorId) redirect("/login");

  const [{ payments, error }, courseOptions] = await Promise.all([
    getMyPayments(supervisorId),
    getMyCourseOptions(supervisorId),
  ]);

  return <PaymentsClient initialPayments={payments} courseOptions={courseOptions} loadError={error} />;
}
