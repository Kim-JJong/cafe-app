import { describe, expect, it } from "vitest";
import {
  checkPin,
  createSessionToken,
  SESSION_TTL_MS,
  verifySessionToken,
} from "@/lib/staff-auth";

// STAFF_PIN / SESSION_SECRET 테스트 값은 vitest.config.mts의 test.env

describe("checkPin", () => {
  it("맞는 PIN만 통과", () => {
    expect(checkPin(process.env.STAFF_PIN!)).toBe(true);
    expect(checkPin("0000")).toBe(false);
    expect(checkPin("")).toBe(false);
  });
});

describe("세션 토큰", () => {
  const now = Date.UTC(2026, 9, 16, 3);

  it("발급한 토큰은 유효", () => {
    expect(verifySessionToken(createSessionToken(now), now)).toBe(true);
  });

  it("12시간이 지나면 만료", () => {
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now + SESSION_TTL_MS - 1)).toBe(true);
    expect(verifySessionToken(token, now + SESSION_TTL_MS)).toBe(false);
  });

  it("만료시각을 조작하면 거부", () => {
    const [, signature] = createSessionToken(now).split(".");
    const forged = `${now + 10 * SESSION_TTL_MS}.${signature}`;
    expect(verifySessionToken(forged, now)).toBe(false);
  });

  it("다른 비밀키로 서명한 토큰은 거부", () => {
    const token = createSessionToken(now);
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "another-secret-another-secret-xx";
    try {
      expect(verifySessionToken(token, now)).toBe(false);
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });

  it("형식이 틀리면 거부", () => {
    expect(verifySessionToken(undefined, now)).toBe(false);
    expect(verifySessionToken("", now)).toBe(false);
    expect(verifySessionToken("garbage", now)).toBe(false);
  });
});
