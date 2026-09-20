"use server";

import { verifySupervisorCredentials, createSupervisorSession } from "@/lib/supervisor-auth";

export async function supervisorLoginAction(username: string, password: string) {
  const account = await verifySupervisorCredentials(username.trim(), password);
  if (!account) return { success: false };

  await createSupervisorSession(account.id);
  return { success: true };
}
