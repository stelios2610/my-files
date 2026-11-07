import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { createStaffSession, deleteSession, staffBySession } from "./repo";
import type { StaffMember } from "./types";

const COOKIE = "elia_session";

export async function currentStaff(): Promise<StaffMember | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return staffBySession(getDb(), token);
}

export async function startSession(staffId: string): Promise<void> {
  const token = createStaffSession(getDb(), staffId);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 18 });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(getDb(), token);
  jar.delete(COOKIE);
}
