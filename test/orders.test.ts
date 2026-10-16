import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  cancelOrderByCustomer,
  createOrder,
  getOrder,
  listOrdersByEmployee,
  parseOrderInput,
  type OrderInput,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

const ids = {
  americano: 0,
  soldOut: 0,
  tea: 0,
  hot: 0,
  ice: 0,
  syrupA: 0,
  syrupB: 0,
  syrupC: 0,
  teaHot: 0,
};

beforeAll(async () => {
  const category = await prisma.category.create({ data: { name: "커피" } });

  const americano = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "아메리카노",
      basePrice: 2500,
      optionGroups: {
        create: [
          {
            name: "온도",
            required: true,
            options: { create: [{ name: "HOT" }, { name: "ICE", extraPrice: 0 }] },
          },
          {
            name: "시럽",
            required: false,
            maxSelect: 2,
            options: {
              create: [
                { name: "바닐라", extraPrice: 300 },
                { name: "헤이즐넛", extraPrice: 300 },
                { name: "카라멜", extraPrice: 300 },
              ],
            },
          },
        ],
      },
    },
    include: { optionGroups: { include: { options: true } } },
  });
  const [temp, syrup] = americano.optionGroups;
  ids.americano = americano.id;
  ids.hot = temp.options[0].id;
  ids.ice = temp.options[1].id;
  [ids.syrupA, ids.syrupB, ids.syrupC] = syrup.options.map((o) => o.id);

  const soldOut = await prisma.menuItem.create({
    data: { categoryId: category.id, name: "품절라떼", basePrice: 3000, isAvailable: false },
  });
  ids.soldOut = soldOut.id;

  const tea = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "얼그레이",
      basePrice: 2000,
      optionGroups: {
        create: [{ name: "온도", required: true, options: { create: [{ name: "HOT" }] } }],
      },
    },
    include: { optionGroups: { include: { options: true } } },
  });
  ids.tea = tea.id;
  ids.teaHot = tea.optionGroups[0].options[0].id;
});

beforeEach(async () => {
  await prisma.orderItemOption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
});

afterAll(() => prisma.$disconnect());

const NOW = new Date("2026-10-16T03:00:00Z"); // KST 2026-10-16 12:00

function order(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    employeeNo: "10234",
    name: "김카페",
    items: [{ menuItemId: ids.americano, quantity: 1, optionIds: [ids.ice] }],
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

describe("createOrder", () => {
  it("서버에서 가격을 계산하고 이름/가격을 스냅샷으로 저장한다", async () => {
    const created = await createOrder(
      order({
        items: [
          { menuItemId: ids.americano, quantity: 2, optionIds: [ids.ice, ids.syrupA, ids.syrupB] },
          { menuItemId: ids.tea, quantity: 1, optionIds: [ids.teaHot] },
        ],
      }),
      NOW,
    );

    // (2500 + 300 + 300) * 2 + 2000
    expect(created.totalPrice).toBe(8200);
    expect(created.status).toBe("RECEIVED");
    expect(created.businessDate).toBe("2026-10-16");
    expect(created.customerNameSnapshot).toBe("김카페");

    const items = await prisma.orderItem.findMany({
      where: { orderId: created.id },
      include: { options: true },
      orderBy: { id: "asc" },
    });
    expect(items[0]).toMatchObject({ nameSnapshot: "아메리카노", unitPrice: 3100, quantity: 2 });
    expect(items[0].options.map((o) => o.nameSnapshot)).toEqual([
      "온도: ICE",
      "시럽: 바닐라",
      "시럽: 헤이즐넛",
    ]);

    // 메뉴 가격이 바뀌어도 저장된 주문 금액은 그대로
    await prisma.menuItem.update({ where: { id: ids.tea }, data: { basePrice: 9999 } });
    const reloaded = await prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(reloaded.totalPrice).toBe(8200);
    await prisma.menuItem.update({ where: { id: ids.tea }, data: { basePrice: 2000 } });
  });

  it("주문번호는 KST 영업일마다 1부터 증가한다", async () => {
    const a = await createOrder(order(), new Date("2026-10-16T14:58:00Z"));
    const b = await createOrder(order(), new Date("2026-10-16T14:59:59Z"));
    const c = await createOrder(order(), new Date("2026-10-16T15:00:00Z")); // KST 10/17 00:00

    expect([a.businessDate, a.orderNumber]).toEqual(["2026-10-16", 1]);
    expect([b.businessDate, b.orderNumber]).toEqual(["2026-10-16", 2]);
    expect([c.businessDate, c.orderNumber]).toEqual(["2026-10-17", 1]);
  });

  it("동시에 주문해도 주문번호가 겹치지 않는다", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createOrder(order({ employeeNo: `200${i}` }), NOW)),
    );
    expect(results.map((r) => r.orderNumber).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("같은 사번은 같은 Customer로 묶는다", async () => {
    const a = await createOrder(order(), NOW);
    const b = await createOrder(order(), NOW);
    expect(a.customerId).toBe(b.customerId);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("사번은 있는데 이름이 다르면 거부한다", async () => {
    await createOrder(order(), NOW);
    await expectAppError(createOrder(order({ name: "박다른" }), NOW), "CUSTOMER_MISMATCH");
    expect(await prisma.order.count()).toBe(1);
  });

  it("필수 옵션이 없으면 거부한다", async () => {
    await expectAppError(
      createOrder(order({ items: [{ menuItemId: ids.americano, quantity: 1, optionIds: [] }] }), NOW),
      "VALIDATION",
    );
  });

  it("다른 메뉴의 옵션은 거부한다", async () => {
    await expectAppError(
      createOrder(
        order({ items: [{ menuItemId: ids.americano, quantity: 1, optionIds: [ids.teaHot] }] }),
        NOW,
      ),
      "VALIDATION",
    );
  });

  it("maxSelect를 넘으면 거부한다", async () => {
    await expectAppError(
      createOrder(
        order({
          items: [
            {
              menuItemId: ids.americano,
              quantity: 1,
              optionIds: [ids.ice, ids.syrupA, ids.syrupB, ids.syrupC],
            },
          ],
        }),
        NOW,
      ),
      "VALIDATION",
    );
  });

  it("단일 선택 그룹에서 두 개를 고르면 거부한다", async () => {
    await expectAppError(
      createOrder(
        order({ items: [{ menuItemId: ids.americano, quantity: 1, optionIds: [ids.hot, ids.ice] }] }),
        NOW,
      ),
      "VALIDATION",
    );
  });

  it("품절 메뉴는 거부한다", async () => {
    await expectAppError(
      createOrder(order({ items: [{ menuItemId: ids.soldOut, quantity: 1, optionIds: [] }] }), NOW),
      "SOLD_OUT",
    );
  });

  it("존재하지 않는 메뉴는 거부한다", async () => {
    await expectAppError(
      createOrder(order({ items: [{ menuItemId: 99999, quantity: 1, optionIds: [] }] }), NOW),
      "VALIDATION",
    );
  });
});

describe("getOrder / listOrdersByEmployee", () => {
  it("주문 상세에 항목과 옵션 스냅샷이 포함된다", async () => {
    const created = await createOrder(order(), NOW);
    const detail = await getOrder(created.id);
    expect(detail).toMatchObject({ orderNumber: 1, status: "RECEIVED", totalPrice: 2500 });
    expect(detail?.items[0]).toMatchObject({
      nameSnapshot: "아메리카노",
      quantity: 1,
      options: [{ nameSnapshot: "온도: ICE" }],
    });
  });

  it("없는 주문은 null", async () => {
    expect(await getOrder(99999)).toBeNull();
  });

  it("내 주문 목록은 해당 사번의 주문만 최신순으로", async () => {
    const first = await createOrder(order(), new Date("2026-10-16T01:00:00Z"));
    const second = await createOrder(order(), new Date("2026-10-16T02:00:00Z"));
    await createOrder(order({ employeeNo: "55555", name: "다른사람" }), NOW);

    const mine = await listOrdersByEmployee("10234");
    expect(mine.map((o) => o.id)).toEqual([second.id, first.id]);
  });
});

describe("cancelOrderByCustomer", () => {
  it("RECEIVED 상태의 본인 주문은 취소된다", async () => {
    const created = await createOrder(order(), NOW);
    await cancelOrderByCustomer(created.id, "10234");
    expect((await getOrder(created.id))?.status).toBe("CANCELED");
  });

  it("다른 사번이면 NOT_FOUND", async () => {
    const created = await createOrder(order(), NOW);
    await expectAppError(cancelOrderByCustomer(created.id, "55555"), "NOT_FOUND");
    expect((await getOrder(created.id))?.status).toBe("RECEIVED");
  });

  it("제조가 시작된 주문은 INVALID_STATUS", async () => {
    const created = await createOrder(order(), NOW);
    await prisma.order.update({ where: { id: created.id }, data: { status: "PREPARING" } });
    await expectAppError(cancelOrderByCustomer(created.id, "10234"), "INVALID_STATUS");
  });

  it("없는 주문은 NOT_FOUND", async () => {
    await expectAppError(cancelOrderByCustomer(99999, "10234"), "NOT_FOUND");
  });
});

describe("parseOrderInput", () => {
  const valid = {
    employeeNo: " 10234 ",
    name: " 김카페 ",
    items: [{ menuItemId: 1, quantity: 1, optionIds: [2] }],
  };

  function expectInvalid(body: unknown) {
    expect(() => parseOrderInput(body)).toThrow(AppError);
  }

  it("앞뒤 공백을 제거하고, 클라이언트가 보낸 가격 필드는 버린다", () => {
    const parsed = parseOrderInput({ ...valid, totalPrice: 1, items: [{ ...valid.items[0], unitPrice: 1 }] });
    expect(parsed).toEqual({
      employeeNo: "10234",
      name: "김카페",
      items: [{ menuItemId: 1, quantity: 1, optionIds: [2] }],
    });
  });

  it("본문이 객체가 아니면 거부", () => expectInvalid(null));
  it("빈 이름 거부", () => expectInvalid({ ...valid, name: "   " }));
  it("빈 사번 거부", () => expectInvalid({ ...valid, employeeNo: "" }));
  it("주문 항목 없음 거부", () => expectInvalid({ ...valid, items: [] }));
  it("수량 0 거부", () => expectInvalid({ ...valid, items: [{ ...valid.items[0], quantity: 0 }] }));
  it("수량 21 거부", () => expectInvalid({ ...valid, items: [{ ...valid.items[0], quantity: 21 }] }));
  it("소수 수량 거부", () => expectInvalid({ ...valid, items: [{ ...valid.items[0], quantity: 1.5 }] }));
  it("중복 옵션 거부", () =>
    expectInvalid({ ...valid, items: [{ ...valid.items[0], optionIds: [2, 2] }] }));
  it("문자열 메뉴 ID 거부", () =>
    expectInvalid({ ...valid, items: [{ ...valid.items[0], menuItemId: "1" }] }));
});
