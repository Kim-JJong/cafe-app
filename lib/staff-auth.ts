import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";

// DESIGN.md §10. Proxy(proxy.ts)에서도 쓰므로 DB를 import하지 않는다.

export const STAFF_COOKIE = "cafe_staff";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function requireEnv(name: "STAFF_PIN" | "SESSION_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}가 설정되지 않았습니다.`);
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", requireEnv("SESSION_SECRET")).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  // 길이가 달라도 비교 시간이 같도록 해시끼리 비교
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPin(pin: string) {
  return safeEqual(pin, requireEnv("STAFF_PIN"));
}

/** 토큰 형식: "<만료시각ms>.<HMAC 서명>" */
export function createSessionToken(now = Date.now()) {
  const expiresAt = String(now + SESSION_TTL_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()) {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;
  if (!safeEqual(signature, sign(expiresAt))) return false;
  return Number(expiresAt) > now;
}

/** 직원 API 맨 앞에서 호출. 세션이 없으면 401. */
export async function requireStaff() {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    throw new AppError(401, "UNAUTHORIZED", "직원 로그인이 필요합니다.");
  }
}
