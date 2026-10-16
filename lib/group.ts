import { randomBytes } from "node:crypto";
import { resolveCustomer } from "@/lib/customer";
import { AppError } from "@/lib/errors";
import { publishGroup } from "@/lib/group-events";
import { DEADLINE_MINUTES, MAX_QUANTITY } from "@/lib/limits";
import { buildOrderLines, createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

// 단체 주문 방 (DESIGN.md §12)

const MAX_ITEMS = 50;
const MAX_NAME = 30;

const newSecret = () => randomBytes(16).toString("base64url");

function invalid(message: string): never {
  throw new AppError(400, "VALIDATION", message);
}

function cleanName(name: unknown) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) invalid("이름을 입력해 주세요.");
  if (trimmed.length > MAX_NAME) invalid("이름이 너무 깁니다.");
  return trimmed;
}

async function getRoomOrThrow(roomId: string) {
  const room = await prisma.groupRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError(404, "NOT_FOUND", "단체 주문 방을 찾을 수 없습니다.");
  return room;
}

async function getMemberOrThrow(roomId: string, memberKey: unknown) {
  const member =
    typeof memberKey === "string"
      ? await prisma.groupMember.findUnique({ where: { roomId_memberKey: { roomId, memberKey } } })
      : null;
  if (!member) throw new AppError(403, "NOT_MEMBER", "방에 먼저 참여해 주세요.");
  return member;
}

/** 방 만들기. 방장 = 결제자 (사번/이름은 일반 주문과 같은 규칙으로 확인) */
export async function createRoom(
  input: { employeeNo: unknown; name: unknown; minutes: unknown },
  now = new Date(),
) {
  const employeeNo = typeof input.employeeNo === "string" ? input.employeeNo.trim() : "";
  if (!employeeNo || employeeNo.length > 20) invalid("사번을 입력해 주세요.");
  const name = cleanName(input.name);
  if (!DEADLINE_MINUTES.includes(input.minutes as (typeof DEADLINE_MINUTES)[number])) {
    invalid("마감 시간을 선택해 주세요.");
  }

  const hostKey = newSecret();
  const room = await prisma.$transaction(async (tx) => {
    await resolveCustomer(tx, { employeeNo, name }); // 사번·이름 불일치는 여기서 거부
    return tx.groupRoom.create({
      data: {
        id: newSecret(),
        hostKey,
        employeeNo,
        hostName: name,
        deadlineAt: new Date(now.getTime() + (input.minutes as number) * 60_000),
        status: "OPEN",
        members: { create: { memberKey: hostKey, name } },
      },
      include: { members: true },
    });
  });
  return { roomId: room.id, hostKey, memberId: room.members[0].id };
}

/** 참여 (같은 브라우저가 다시 들어오면 이름만 갱신) */
export async function joinRoom(roomId: string, input: { name: unknown; memberKey?: unknown }) {
  const room = await getRoomOrThrow(roomId);
  const name = cleanName(input.name);
  const memberKey = typeof input.memberKey === "string" && input.memberKey ? input.memberKey : newSecret();

  const existing = await prisma.groupMember.findUnique({
    where: { roomId_memberKey: { roomId, memberKey } },
  });
  const member = existing
    ? await prisma.groupMember.update({ where: { id: existing.id }, data: { name } })
    : await prisma.groupMember.create({ data: { roomId, memberKey, name } });

  if (!existing) publishGroup(room.id, { activity: `${name}님이 들어왔어요` });
  else if (existing.name !== name) publishGroup(room.id, {});
  return { memberId: member.id, memberKey };
}

export async function addItem(
  roomId: string,
  input: { memberKey: unknown; menuItemId: unknown; quantity: unknown; optionIds: unknown },
  now = new Date(),
) {
  const room = await getRoomOrThrow(roomId);
  if (room.status !== "OPEN") throw new AppError(409, "CLOSED", "이미 주문된 방입니다.");
  if (room.deadlineAt <= now) throw new AppError(409, "CLOSED", "마감 시간이 지나 담을 수 없습니다.");
  const member = await getMemberOrThrow(roomId, input.memberKey);

  const { menuItemId, quantity, optionIds } = input;
  if (!Number.isInteger(menuItemId)) invalid("메뉴 정보가 올바르지 않습니다.");
  if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_QUANTITY) {
    invalid(`수량은 1~${MAX_QUANTITY}개만 가능합니다.`);
  }
  if (!Array.isArray(optionIds) || !optionIds.every(Number.isInteger)) invalid("옵션 정보가 올바르지 않습니다.");
  if ((await prisma.groupItem.count({ where: { roomId } })) >= MAX_ITEMS) {
    invalid(`한 방에는 ${MAX_ITEMS}개 항목까지 담을 수 있습니다.`);
  }

  const [line] = await buildOrderLines([
    { menuItemId: menuItemId as number, quantity: quantity as number, optionIds: optionIds as number[] },
  ]);
  const item = await prisma.groupItem.create({
    data: {
      roomId,
      memberId: member.id,
      menuItemId: line.menuItemId,
      optionIds: (optionIds as number[]).join(","),
      nameSnapshot: line.nameSnapshot,
      optionLabels: line.optionSnapshots.map((o) => o.nameSnapshot.split(": ")[1]).join(" · "),
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    },
  });

  const count = line.quantity > 1 ? ` ${line.quantity}잔` : "";
  publishGroup(roomId, { activity: `${member.name}님이 ${line.nameSnapshot}${count}을(를) 담았어요` });
  return { itemId: item.id };
}

/** 본인 항목은 본인이, 모든 항목은 방장이 뺄 수 있다 */
export async function removeItem(roomId: string, itemId: number, memberKey: unknown) {
  const room = await getRoomOrThrow(roomId);
  if (room.status !== "OPEN") throw new AppError(409, "CLOSED", "이미 주문된 방입니다.");
  const member = await getMemberOrThrow(roomId, memberKey);

  const item = await prisma.groupItem.findFirst({ where: { id: itemId, roomId } });
  if (!item) throw new AppError(404, "NOT_FOUND", "항목을 찾을 수 없습니다.");
  const isHost = member.memberKey === room.hostKey;
  if (item.memberId !== member.id && !isHost) {
    throw new AppError(403, "FORBIDDEN", "다른 사람이 담은 음료는 방장만 뺄 수 있습니다.");
  }

  await prisma.groupItem.delete({ where: { id: item.id } });
  publishGroup(roomId, { activity: `${member.name}님이 ${item.nameSnapshot}을(를) 뺐어요` });
}

/** 방장이 주문: 담긴 음료 전체를 방장 사번의 주문 1건으로 만든다 */
export async function placeGroupOrder(roomId: string, hostKey: unknown, now = new Date()) {
  const room = await getRoomOrThrow(roomId);
  if (hostKey !== room.hostKey) throw new AppError(403, "FORBIDDEN", "방장만 주문할 수 있습니다.");

  const items = await prisma.groupItem.findMany({ where: { roomId }, orderBy: { id: "asc" } });
  if (items.length === 0) invalid("담긴 음료가 없습니다.");

  // 두 번 눌러도 주문이 하나만 생기도록 먼저 상태를 잠근다
  const { count } = await prisma.groupRoom.updateMany({
    where: { id: roomId, status: "OPEN" },
    data: { status: "ORDERING" },
  });
  if (count === 0) throw new AppError(409, "CLOSED", "이미 주문된 방입니다.");

  try {
    const order = await createOrder(
      {
        employeeNo: room.employeeNo,
        name: room.hostName,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          optionIds: i.optionIds ? i.optionIds.split(",").map(Number) : [],
        })),
      },
      now,
    );
    await prisma.groupRoom.update({ where: { id: roomId }, data: { status: "ORDERED", orderId: order.id } });
    publishGroup(roomId, { activity: `${room.hostName}님이 주문했어요! 대기번호 ${order.orderNumber}` });
    return { orderId: order.id, orderNumber: order.orderNumber };
  } catch (e) {
    // 품절 등으로 주문이 실패하면 방을 다시 연다
    await prisma.groupRoom.update({ where: { id: roomId }, data: { status: "OPEN" } });
    throw e;
  }
}

/** 화면에 보여 줄 방 상태. 비밀값(hostKey, memberKey)은 내보내지 않는다 */
export async function getRoomSnapshot(roomId: string) {
  const room = await prisma.groupRoom.findUnique({
    where: { id: roomId },
    include: {
      members: { orderBy: { id: "asc" } },
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!room) return null;

  const order = room.orderId
    ? await prisma.order.findUnique({ where: { id: room.orderId }, select: { orderNumber: true } })
    : null;

  return {
    id: room.id,
    hostName: room.hostName,
    deadlineAt: room.deadlineAt,
    status: room.status === "ORDERED" ? "ORDERED" : "OPEN",
    orderId: room.orderId,
    orderNumber: order?.orderNumber ?? null,
    members: room.members.map((m) => ({ id: m.id, name: m.name, isHost: m.memberKey === room.hostKey })),
    items: room.items.map((i) => ({
      id: i.id,
      memberId: i.memberId,
      name: i.nameSnapshot,
      optionLabels: i.optionLabels,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
    })),
    total: room.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
  };
}

export type RoomSnapshot = NonNullable<Awaited<ReturnType<typeof getRoomSnapshot>>>;
