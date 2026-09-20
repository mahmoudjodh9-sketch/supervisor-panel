"use server";

import { redirect } from "next/navigation";
import { destroySupervisorSession } from "@/lib/supervisor-auth";

export async function supervisorLogoutAction() {
  await destroySupervisorSession();
  redirect("/login");
}
