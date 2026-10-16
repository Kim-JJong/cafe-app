import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { settlementCsv } from "@/lib/csv";
import type { OrderStatus } from "@/lib/order-status";
import { createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { getSettlement, getSettlementOrders } from "@/lib/settlement";
import { currentKstMonth, kstMonthRange, parseMonth } from "@/lib/time";

describe("월 범위 (KST)", () => {
  it("parseMonth", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-1")).toBeNull();
    expect(parseMonth(null)).toBeNull();
  });

  it("10월 = 9/30 15:00Z 이상, 10/31 15:00Z 미만", () => {
    const { start, end } = kstMonthRange(2026, 10);
    expect(start.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T15:00:00.000Z");
  });

  it("12월은 다음 해 1월 1일 KST까지", () => {
    expect(kstMonthRange(2026, 12).end.toISOString()).toBe("2026-12-31T15:00:00.000Z");
  });

  it("현재 월은 KST 기준", () => {
    expect(currentKstMonth(new Date("2026-10-31T14:59:59Z"))).toBe("2026-10");
    expect(currentKstMonth(new Date("2026-10-31T15:00:00Z"))).toBe("2026-11");
  });
});

let menuItemId = 0;
let optionId = 0;

beforeAll(async () => {
  const category = await prisma.category.create({ data: { name: "정산테스트" } });
  const item = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "아메리카노",
      basePrice: 2500,
      optionGroups: { create: [{ name: "온도", required: true, options: { create: [{ name: "ICE" }] } }] },
    },
    include: { optionGroups: { include: { options: true } } },
  });
  menuItemId = item.id;
  optionId = item.optionGroups[0].options[0].id;
});

beforeEach(async () => {
  await prisma.orderItemOption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
});

afterAll(() => prisma.$disconnect());

async function place(employeeNo: string, name: string, at: string, status: OrderStatus, quantity = 1) {
  const order = await createOrder(
    { employeeNo, name, items: [{ menuItemId, quantity, optionIds: [optionId] }] },
    new Date(at),
  );
  await prisma.order.update({ where: { id: order.id }, data: { status } });
  return order;
}

describe("getSettlement", () => {
  it("KST 해당 월의 픽업 완료 주문만 사번별로 합산", async () => {
    await place("10234", "김카페", "2026-09-30T15:00:00Z", "PICKED_UP"); // KST 10/1 00:00 → 10월
    await place("10234", "김카페", "2026-10-15T03:00:00Z", "PICKED_UP", 2);
    await place("10234", "김카페", "2026-10-31T15:00:00Z", "PICKED_UP"); // KST 11/1 00:00 → 11월
    await place("10234", "김카페", "2026-09-30T14:59:59Z", "PICKED_UP"); // KST 9/30 23:59 → 9월
    await place("10234", "김카페", "2026-10-16T03:00:00Z", "CANCELED");
    await place("10567", "이라떼", "2026-10-20T03:00:00Z", "PICKED_UP");
    await place("10567", "이라떼", "2026-10-31T14:00:00Z", "READY"); // 진행 중 → 경고 대상

    const result = await getSettlement(2026, 10);

    expect(result.rows).toEqual([
      { employeeNo: "10234", name: "김카페", orderCount: 2, total: 7500 },
      { employeeNo: "10567", name: "이라떼", orderCount: 1, total: 2500 },
    ]);
    expect(result.grandTotal).toBe(10000);
    expect(result.pendingCount).toBe(1);
  });

  it("주문이 없는 달은 빈 결과", async () => {
    expect(await getSettlement(2026, 1)).toEqual({ rows: [], pendingCount: 0, grandTotal: 0 });
  });
});

describe("getSettlementOrders", () => {
  it("해당 사번의 해당 월 정산 대상 주문만", async () => {
    const a = await place("10234", "김카페", "2026-10-02T03:00:00Z", "PICKED_UP");
    await place("10234", "김카페", "2026-10-03T03:00:00Z", "CANCELED");
    await place("10567", "이라떼", "2026-10-02T03:00:00Z", "PICKED_UP");

    const orders = await getSettlementOrders(2026, 10, "10234");
    expect(orders.map((o) => o.id)).toEqual([a.id]);
    expect(orders[0].items).toEqual([{ nameSnapshot: "아메리카노", quantity: 1 }]);
  });
});

describe("settlementCsv", () => {
  it("BOM + 헤더 + CRLF", () => {
    const csv = settlementCsv([{ employeeNo: "10234", name: "김카페", orderCount: 2, total: 7500 }]);
    expect(csv).toBe("﻿사번,이름,주문 수,합계\r\n10234,김카페,2,7500\r\n");
  });

  it("쉼표/따옴표는 감싸고, 수식처럼 보이는 값은 문자로 고정", () => {
    const csv = settlementCsv([
      { employeeNo: "1", name: '홍,"길동"', orderCount: 1, total: 100 },
      { employeeNo: "2", name: "=HYPERLINK(1)", orderCount: 1, total: 100 },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('1,"홍,""길동""",1,100');
    expect(lines[2]).toBe("2,'=HYPERLINK(1),1,100");
  });
});
