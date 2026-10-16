import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { isGroupAvailable } from "@/lib/option-rules";
import { countOrdersAhead, createOrder, listOrdersByEmployee } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { getMonthlyCharge } from "@/lib/settlement";

describe("isGroupAvailable (얼음은 ICE일 때만)", () => {
  const temp = { name: "온도", options: [{ id: 1, name: "HOT" }, { id: 2, name: "ICE" }] };
  const ice = { name: "얼음", options: [{ id: 3, name: "얼음 많이" }, { id: 4, name: "얼음 적게" }] };
  const strength = { name: "농도", options: [{ id: 5, name: "연하게" }] };

  it("ICE를 고르면 얼음 선택 가능", () => {
    expect(isGroupAvailable([temp, ice], ice, [2])).toBe(true);
  });
  it("HOT이면 얼음 선택 불가", () => {
    expect(isGroupAvailable([temp, ice], ice, [1])).toBe(false);
  });
  it("HOT/ICE 선택지가 없는 ICE 전용 메뉴는 항상 가능", () => {
    expect(isGroupAvailable([ice], ice, [])).toBe(true);
  });
  it("얼음이 아닌 그룹은 항상 가능", () => {
    expect(isGroupAvailable([temp, strength], strength, [1])).toBe(true);
  });
});

const ids = { latte: 0, hot: 0, ice: 0, moreIce: 0, weak: 0, ade: 0, adeIce: 0 };

beforeAll(async () => {
  const category = await prisma.category.create({ data: { name: "추가기능테스트" } });
  const latte = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "카페라떼",
      basePrice: 3000,
      optionGroups: {
        create: [
          { name: "온도", required: true, options: { create: [{ name: "HOT" }, { name: "ICE" }] } },
          { name: "농도", options: { create: [{ name: "연하게" }] } },
          { name: "얼음", options: { create: [{ name: "얼음 많이" }, { name: "얼음 적게" }] } },
        ],
      },
    },
    include: { optionGroups: { include: { options: true } } },
  });
  const [temp, strength, ice] = latte.optionGroups;
  Object.assign(ids, {
    latte: latte.id,
    hot: temp.options[0].id,
    ice: temp.options[1].id,
    weak: strength.options[0].id,
    moreIce: ice.options[0].id,
  });

  const ade = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "레몬에이드",
      basePrice: 3500,
      optionGroups: { create: [{ name: "얼음", options: { create: [{ name: "얼음 많이" }] } }] },
    },
    include: { optionGroups: { include: { options: true } } },
  });
  ids.ade = ade.id;
  ids.adeIce = ade.optionGroups[0].options[0].id;
});

beforeEach(async () => {
  await prisma.orderItemOption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
});

afterAll(() => prisma.$disconnect());

const NOW = new Date("2026-10-16T03:00:00Z");

function latte(optionIds: number[], at = NOW, employeeNo = "10234", name = "김카페") {
  return createOrder({ employeeNo, name, items: [{ menuItemId: ids.latte, quantity: 1, optionIds }] }, at);
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

describe("createOrder 옵션 규칙", () => {
  it("ICE + 얼음 많이 + 연하게는 주문 가능", async () => {
    const order = await latte([ids.ice, ids.moreIce, ids.weak]);
    expect(order.totalPrice).toBe(3000);
  });

  it("HOT + 얼음은 거부", async () => {
    await expectAppError(latte([ids.hot, ids.moreIce]), "VALIDATION");
  });

  it("ICE 전용 메뉴는 얼음 옵션만으로 주문 가능", async () => {
    const order = await createOrder(
      { employeeNo: "10234", name: "김카페", items: [{ menuItemId: ids.ade, quantity: 1, optionIds: [ids.adeIce] }] },
      NOW,
    );
    expect(order.totalPrice).toBe(3500);
  });
});

describe("countOrdersAhead", () => {
  it("먼저 들어와 접수/제조중인 주문만 센다", async () => {
    const pickedUp = await latte([ids.hot], new Date("2026-10-16T02:00:00Z"));
    await prisma.order.update({ where: { id: pickedUp.id }, data: { status: "PICKED_UP" } });
    await latte([ids.hot], new Date("2026-10-16T02:10:00Z")); // RECEIVED
    const preparing = await latte([ids.hot], new Date("2026-10-16T02:20:00Z"));
    await prisma.order.update({ where: { id: preparing.id }, data: { status: "PREPARING" } });
    const ready = await latte([ids.hot], new Date("2026-10-16T02:30:00Z"));
    await prisma.order.update({ where: { id: ready.id }, data: { status: "READY" } });
    const mine = await latte([ids.hot], new Date("2026-10-16T02:40:00Z"));
    await latte([ids.hot], new Date("2026-10-16T02:50:00Z")); // 나보다 늦음

    expect(await countOrdersAhead(mine)).toBe(2);
  });
});

describe("listOrdersByEmployee", () => {
  it("목록에 항목 이름과 수량이 포함된다", async () => {
    await latte([ids.ice]);
    const [summary] = await listOrdersByEmployee("10234");
    expect(summary.items).toEqual([{ nameSnapshot: "카페라떼", quantity: 1 }]);
  });
});

describe("getMonthlyCharge", () => {
  it("이번 달(KST) 픽업 완료 주문만 합산", async () => {
    const done = await latte([ids.hot], new Date("2026-10-02T03:00:00Z"));
    await prisma.order.update({ where: { id: done.id }, data: { status: "PICKED_UP" } });
    await latte([ids.hot], new Date("2026-10-03T03:00:00Z")); // 진행 중 → 제외
    const lastMonth = await latte([ids.hot], new Date("2026-09-30T14:00:00Z")); // KST 9/30
    await prisma.order.update({ where: { id: lastMonth.id }, data: { status: "PICKED_UP" } });

    expect(await getMonthlyCharge("10234", new Date("2026-10-16T03:00:00Z"))).toEqual({
      month: "2026-10",
      total: 3000,
      orderCount: 1,
    });
  });

  it("주문이 없으면 0", async () => {
    expect(await getMonthlyCharge("99999", NOW)).toEqual({ month: "2026-10", total: 0, orderCount: 0 });
  });
});
