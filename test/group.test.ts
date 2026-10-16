import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { addItem, createRoom, getRoomSnapshot, joinRoom, placeGroupOrder, removeItem } from "@/lib/group";
import { publishGroup, subscribeGroup, type GroupEvent } from "@/lib/group-events";
import { prisma } from "@/lib/prisma";

const ids = { latte: 0, hot: 0, ice: 0, soldOut: 0 };

beforeAll(async () => {
  const category = await prisma.category.create({ data: { name: "단체테스트" } });
  const latte = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: "카페라떼",
      basePrice: 3000,
      optionGroups: {
        create: [{ name: "온도", required: true, options: { create: [{ name: "HOT" }, { name: "ICE" }] } }],
      },
    },
    include: { optionGroups: { include: { options: true } } },
  });
  ids.latte = latte.id;
  [ids.hot, ids.ice] = latte.optionGroups[0].options.map((o) => o.id);
  ids.soldOut = (
    await prisma.menuItem.create({
      data: { categoryId: category.id, name: "품절음료", basePrice: 3000, isAvailable: false },
    })
  ).id;
});

beforeEach(async () => {
  await prisma.groupItem.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.groupRoom.deleteMany();
  await prisma.orderItemOption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
});

afterAll(() => prisma.$disconnect());

const NOW = new Date("2026-10-16T03:00:00Z");

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

async function setup() {
  const host = await createRoom({ employeeNo: "10234", name: "김과장", minutes: 10 }, NOW);
  const member = await joinRoom(host.roomId, { name: "이대리" });
  return { host, member, roomId: host.roomId };
}

function latte(memberKey: string, optionIds = [ids.ice], quantity = 1) {
  return { memberKey, menuItemId: ids.latte, quantity, optionIds };
}

describe("createRoom", () => {
  it("방장이 첫 참여자로 들어가고 마감 시각이 정해진다", async () => {
    const { roomId } = await createRoom({ employeeNo: "10234", name: "김과장", minutes: 10 }, NOW);
    const room = await getRoomSnapshot(roomId);
    expect(room).toMatchObject({ hostName: "김과장", status: "OPEN", total: 0 });
    expect(room?.deadlineAt.toISOString()).toBe("2026-10-16T03:10:00.000Z");
    expect(room?.members).toEqual([expect.objectContaining({ name: "김과장", isHost: true })]);
  });

  it("허용되지 않은 마감 시간은 거부", async () => {
    await expectAppError(createRoom({ employeeNo: "10234", name: "김과장", minutes: 7 }), "VALIDATION");
  });

  it("사번과 이름이 기존 기록과 다르면 거부", async () => {
    await createRoom({ employeeNo: "10234", name: "김과장", minutes: 10 });
    await expectAppError(createRoom({ employeeNo: "10234", name: "다른사람", minutes: 10 }), "CUSTOMER_MISMATCH");
  });

  it("스냅샷에 비밀값이 들어가지 않는다", async () => {
    const { roomId, hostKey } = await createRoom({ employeeNo: "10234", name: "김과장", minutes: 10 });
    expect(JSON.stringify(await getRoomSnapshot(roomId))).not.toContain(hostKey);
  });
});

describe("joinRoom", () => {
  it("같은 memberKey로 다시 들어오면 새 참여자를 만들지 않고 이름만 바꾼다", async () => {
    const { roomId, member } = await setup();
    const again = await joinRoom(roomId, { name: "이과장", memberKey: member.memberKey });
    expect(again.memberId).toBe(member.memberId);
    const room = await getRoomSnapshot(roomId);
    expect(room?.members.map((m) => m.name)).toEqual(["김과장", "이과장"]);
  });

  it("없는 방은 NOT_FOUND", async () => {
    await expectAppError(joinRoom("nope", { name: "이대리" }), "NOT_FOUND");
  });
});

describe("addItem / removeItem", () => {
  it("담은 음료가 담은 사람과 함께 보이고 합계에 반영된다", async () => {
    const { roomId, member } = await setup();
    await addItem(roomId, latte(member.memberKey, [ids.ice], 2), NOW);
    const room = await getRoomSnapshot(roomId);
    expect(room?.items).toEqual([
      expect.objectContaining({ memberId: member.memberId, name: "카페라떼", optionLabels: "ICE", quantity: 2 }),
    ]);
    expect(room?.total).toBe(6000);
  });

  it("참여하지 않은 사람은 담을 수 없다", async () => {
    const { roomId } = await setup();
    await expectAppError(addItem(roomId, latte("stranger"), NOW), "NOT_MEMBER");
  });

  it("마감 시각이 지나면 담을 수 없다", async () => {
    const { roomId, member } = await setup();
    await expectAppError(addItem(roomId, latte(member.memberKey), new Date("2026-10-16T03:10:00Z")), "CLOSED");
  });

  it("일반 주문과 같은 규칙으로 검증 (품절, 필수 옵션)", async () => {
    const { roomId, member } = await setup();
    await expectAppError(
      addItem(roomId, { memberKey: member.memberKey, menuItemId: ids.soldOut, quantity: 1, optionIds: [] }, NOW),
      "SOLD_OUT",
    );
    await expectAppError(addItem(roomId, latte(member.memberKey, []), NOW), "VALIDATION");
  });

  it("본인 항목은 본인이, 남의 항목은 방장만 뺄 수 있다", async () => {
    const { roomId, host, member } = await setup();
    const other = await joinRoom(roomId, { name: "박사원" });
    const { itemId } = await addItem(roomId, latte(member.memberKey), NOW);

    await expectAppError(removeItem(roomId, itemId, other.memberKey), "FORBIDDEN");
    await removeItem(roomId, itemId, member.memberKey);

    const second = await addItem(roomId, latte(member.memberKey), NOW);
    await removeItem(roomId, second.itemId, host.hostKey);
    expect((await getRoomSnapshot(roomId))?.items).toEqual([]);
  });
});

describe("placeGroupOrder", () => {
  it("방장 사번으로 주문 1건이 만들어지고 방이 닫힌다", async () => {
    const { roomId, host, member } = await setup();
    await addItem(roomId, latte(member.memberKey, [ids.ice], 2), NOW);
    await addItem(roomId, latte(host.hostKey, [ids.hot]), NOW);

    const { orderId, orderNumber } = await placeGroupOrder(roomId, host.hostKey, NOW);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: true } });
    expect(order).toMatchObject({ totalPrice: 9000, status: "RECEIVED", customerNameSnapshot: "김과장" });
    expect(order.customer.employeeNo).toBe("10234");
    expect(order.items.map((i) => i.quantity)).toEqual([2, 1]);

    const room = await getRoomSnapshot(roomId);
    expect(room).toMatchObject({ status: "ORDERED", orderId, orderNumber });
    await expectAppError(addItem(roomId, latte(member.memberKey), NOW), "CLOSED");
  });

  it("방장이 아니면 주문할 수 없다", async () => {
    const { roomId, member } = await setup();
    await addItem(roomId, latte(member.memberKey), NOW);
    await expectAppError(placeGroupOrder(roomId, member.memberKey, NOW), "FORBIDDEN");
  });

  it("빈 방은 주문할 수 없다", async () => {
    const { roomId, host } = await setup();
    await expectAppError(placeGroupOrder(roomId, host.hostKey, NOW), "VALIDATION");
  });

  it("두 번 눌러도 주문은 하나만 생긴다", async () => {
    const { roomId, host, member } = await setup();
    await addItem(roomId, latte(member.memberKey), NOW);
    const results = await Promise.allSettled([
      placeGroupOrder(roomId, host.hostKey, NOW),
      placeGroupOrder(roomId, host.hostKey, NOW),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("주문이 실패하면(품절 등) 방이 다시 열린다", async () => {
    const { roomId, host, member } = await setup();
    await addItem(roomId, latte(member.memberKey), NOW);
    await prisma.menuItem.update({ where: { id: ids.latte }, data: { isAvailable: false } });
    try {
      await expectAppError(placeGroupOrder(roomId, host.hostKey, NOW), "SOLD_OUT");
    } finally {
      await prisma.menuItem.update({ where: { id: ids.latte }, data: { isAvailable: true } });
    }
    expect((await getRoomSnapshot(roomId))?.status).toBe("OPEN");
  });
});

describe("실시간 알림", () => {
  it("담기·빼기·참여·주문 때 누가 무엇을 했는지 알린다", async () => {
    const { roomId, hostKey } = await createRoom({ employeeNo: "10234", name: "김과장", minutes: 10 }, NOW);
    const events: GroupEvent[] = [];
    const unsubscribe = subscribeGroup(roomId, (e) => events.push(e));

    const member = await joinRoom(roomId, { name: "이대리" });
    const { itemId } = await addItem(roomId, latte(member.memberKey, [ids.ice], 2), NOW);
    await removeItem(roomId, itemId, member.memberKey);
    await addItem(roomId, latte(member.memberKey), NOW);
    await placeGroupOrder(roomId, hostKey, NOW);
    unsubscribe();

    expect(events.map((e) => e.activity)).toEqual([
      "이대리님이 들어왔어요",
      "이대리님이 카페라떼 2잔을(를) 담았어요",
      "이대리님이 카페라떼을(를) 뺐어요",
      "이대리님이 카페라떼을(를) 담았어요",
      expect.stringMatching(/^김과장님이 주문했어요! 대기번호 \d+$/),
    ]);
  });

  it("다른 방의 알림은 받지 않고, 구독 해제 후에는 받지 않는다", () => {
    const received: string[] = [];
    const unsubscribe = subscribeGroup("room-a", (e) => received.push(e.activity ?? ""));
    publishGroup("room-b", { activity: "b" });
    publishGroup("room-a", { activity: "a" });
    unsubscribe();
    publishGroup("room-a", { activity: "after" });
    expect(received).toEqual(["a"]);
  });
});
