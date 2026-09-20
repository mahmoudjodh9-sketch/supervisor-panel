import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createServerClient } from "./supabase/server";

const COOKIE_NAME = "supervisor_session";
const SESSION_DURATION = 60 * 60 * 24 * 30; // 30 يوم

function getSecret() {
  const secret = process.env.SUPERVISOR_SESSION_SECRET;
  if (!secret) throw new Error("SUPERVISOR_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface SupervisorAccount {
  id: string;
  name: string;
  username: string;
}

/**
 * Checks username + password against the `supervisors` table (shared with the
 * owner panel — same Supabase project). Only "active" supervisors can log in.
 */
export async function verifySupervisorCredentials(
  username: string,
  password: string
): Promise<SupervisorAccount | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("supervisors")
    .select("id, name, username, password_hash, status")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== "active") return null;

  const valid = await bcrypt.compare(password, data.password_hash);
  if (!valid) return null;

  return { id: data.id, name: data.name, username: data.username };
}

export async function createSupervisorSession(supervisorId: string) {
  const token = await new SignJWT({ role: "supervisor", supervisorId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });

  // best-effort last_login stamp — never blocks the login itself
  const supabase = createServerClient();
  await supabase
    .from("supervisors")
    .update({ last_login: new Date().toISOString() })
    .eq("id", supervisorId);
}

export async function destroySupervisorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** For use in Server Components / Server Actions — returns the logged-in supervisor's id, or null. */
export async function getSupervisorId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.supervisorId === "string" ? payload.supervisorId : null;
  } catch {
    return null;
  }
}
