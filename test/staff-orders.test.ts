import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { setMenuItemAvailability } from "@/lib/menu";
import { canTransition, ORDER_STATUSES } from "@/lib/order-status";
import { createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { listOrdersByStatus, updateOrderStatus } from "@/lib/staff-orders";

describe("canTransition", () => {
  const allowed = [
    ["RECEIVED", "PREPARING"],
    ["PREPARING", "READY"],
    ["READY", "PICKED_UP"],
  ];

  it("허용표에 있는 전이만 true", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("알 수 없는 상태는 false", () => {
    expect(canTransition("RECEIVED", "DONE")).toBe(false);
    expect(canTransition("??", "PREPARING")).toBe(false);
  });
});

let menuItemId = 0;
let optionId = 0;

beforeAll(async () => {
  const category = await prisma.category.create({ data: { name: "직원테스트" } });
  const item = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "라떼",
      basePrice: 3000,
      optionGroups: { create: [{ name: "온도", required: true, options: { create: [{ name: "HOT" }] } }] },
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

function newOrder(createdAt = new Date("2026-10-16T03:00:00Z")) {
  return createOrder(
    { employeeNo: "10234", name: "김카페", items: [{ menuItemId, quantity: 1, optionIds: [optionId] }] },
    createdAt,
  );
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

describe("updateOrderStatus", () => {
  it("접수 → 제조중 → 픽업대기 → 픽업완료, 픽업 시각 기록", async () => {
    const { id } = await newOrder();
    const pickedUp = new Date("2026-10-16T03:10:00Z");

    await updateOrderStatus(id, "PREPARING");
    await updateOrderStatus(id, "READY");
    await updateOrderStatus(id, "PICKED_UP", pickedUp);

    const order = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(order.status).toBe("PICKED_UP");
    expect(order.pickedUpAt).toEqual(pickedUp);
  });

  it("단계를 건너뛰거나 되돌리면 INVALID_STATUS", async () => {
    const { id } = await newOrder();
    await expectAppError(updateOrderStatus(id, "READY"), "INVALID_STATUS");
    await updateOrderStatus(id, "PREPARING");
    await expectAppError(updateOrderStatus(id, "RECEIVED"), "INVALID_STATUS");
    await expectAppError(updateOrderStatus(id, "CANCELED"), "INVALID_STATUS");
  });

  it("주문 확정 후에는 취소할 수 없음", async () => {
    const { id } = await newOrder();
    await expectAppError(updateOrderStatus(id, "CANCELED"), "INVALID_STATUS");
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe("RECEIVED");
  });

  it("종료된 주문은 변경 불가", async () => {
    const { id } = await newOrder();
    await prisma.order.update({ where: { id }, data: { status: "PICKED_UP" } });
    await expectAppError(updateOrderStatus(id, "PREPARING"), "INVALID_STATUS");
  });

  it("두 직원이 동시에 같은 전이를 시도하면 하나만 성공", async () => {
    const { id } = await newOrder();
    const results = await Promise.allSettled([
      updateOrderStatus(id, "PREPARING"),
      updateOrderStatus(id, "PREPARING"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("없는 주문은 NOT_FOUND", async () => {
    await expectAppError(updateOrderStatus(99999, "PREPARING"), "NOT_FOUND");
  });
});

describe("listOrdersByStatus", () => {
  it("기본값은 진행 중 주문만, 오래된 순", async () => {
    const later = await newOrder(new Date("2026-10-16T04:00:00Z"));
    const earlier = await newOrder(new Date("2026-10-16T03:00:00Z"));
    const done = await newOrder(new Date("2026-10-16T02:00:00Z"));
    await prisma.order.update({ where: { id: done.id }, data: { status: "PICKED_UP" } });

    const orders = await listOrdersByStatus();
    expect(orders.map((o) => o.id)).toEqual([earlier.id, later.id]);
    expect(orders[0].items[0]).toMatchObject({
      nameSnapshot: "라떼",
      options: [{ nameSnapshot: "온도: HOT" }],
    });
  });
});

describe("setMenuItemAvailability", () => {
  it("품절 토글", async () => {
    expect(await setMenuItemAvailability(menuItemId, false)).toBe(true);
    expect((await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } })).isAvailable).toBe(false);
    await setMenuItemAvailability(menuItemId, true);
  });

  it("없는 메뉴는 false", async () => {
    expect(await setMenuItemAvailability(99999, false)).toBe(false);
  });
});
