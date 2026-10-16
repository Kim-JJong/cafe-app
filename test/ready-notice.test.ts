import { describe, expect, it } from "vitest";
import { findOrderToNotify, MAX_REMEMBERED, rememberNotified } from "@/lib/ready-notice";

const order = (id: number, status: string, createdAt: string) => ({ id, status, createdAt });

describe("findOrderToNotify", () => {
  const orders = [
    order(3, "READY", "2026-10-16T05:00:00Z"),
    order(2, "PREPARING", "2026-10-16T04:00:00Z"),
    order(1, "READY", "2026-10-16T03:00:00Z"),
    order(0, "PICKED_UP", "2026-10-16T02:00:00Z"),
  ];

  it("픽업 대기 중 가장 먼저 들어온 주문", () => {
    expect(findOrderToNotify(orders, [])?.id).toBe(1);
  });

  it("이미 알린 주문은 건너뜀", () => {
    expect(findOrderToNotify(orders, [1])?.id).toBe(3);
    expect(findOrderToNotify(orders, [1, 3])).toBeNull();
  });

  it("픽업 대기 주문이 없으면 null", () => {
    expect(findOrderToNotify([order(1, "PREPARING", "2026-10-16T03:00:00Z")], [])).toBeNull();
  });
});

describe("rememberNotified", () => {
  it("중복 없이 추가", () => {
    expect(rememberNotified([1, 2], 2)).toEqual([1, 2]);
    expect(rememberNotified([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("최근 MAX_REMEMBERED개만 유지", () => {
    const many = Array.from({ length: MAX_REMEMBERED }, (_, i) => i);
    const next = rememberNotified(many, 999);
    expect(next).toHaveLength(MAX_REMEMBERED);
    expect(next[0]).toBe(1);
    expect(next.at(-1)).toBe(999);
  });
});
