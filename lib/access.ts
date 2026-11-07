import "server-only";
import { redirect } from "next/navigation";
import { currentStaff } from "./auth";
import { allows, type Permission } from "./permissions";
import type { StaffMember } from "./types";

export async function requirePermission(permission: Permission): Promise<StaffMember | null> {
  const staff = await currentStaff();
  if (!staff) redirect("/login");
  if (!allows(staff, permission)) return null;
  return staff;
}
