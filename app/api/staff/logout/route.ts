import { cookies } from "next/headers";
import { STAFF_COOKIE } from "@/lib/staff-auth";

export async function POST() {
  (await cookies()).delete(STAFF_COOKIE);
  return Response.json({ ok: true });
}
