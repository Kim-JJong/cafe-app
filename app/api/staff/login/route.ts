import { cookies } from "next/headers";
import { AppError, errorResponse } from "@/lib/errors";
import { checkPin, createSessionToken, SESSION_TTL_MS, STAFF_COOKIE } from "@/lib/staff-auth";

const FAIL_DELAY_MS = 1000; // 무차별 대입을 느리게 (DESIGN.md §10)

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = typeof body?.pin === "string" ? body.pin : "";

    if (!checkPin(pin)) {
      await new Promise((resolve) => setTimeout(resolve, FAIL_DELAY_MS));
      throw new AppError(401, "INVALID_PIN", "PIN이 올바르지 않습니다.");
    }

    (await cookies()).set(STAFF_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
