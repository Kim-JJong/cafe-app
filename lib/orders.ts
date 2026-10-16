import { Prisma } from "@/app/generated/prisma/client";
import { resolveCustomer, type CustomerInput } from "@/lib/customer";
import { AppError } from "@/lib/errors";
import { MAX_QUANTITY } from "@/lib/limits";
import { isGroupAvailable } from "@/lib/option-rules";
import type { OrderStatus } from "@/lib/order-status";
import { calcUnitPrice } from "@/lib/price";
import { prisma } from "@/lib/prisma";
import { kstBusinessDate } from "@/lib/time";

const MAX_LINES = 20;
const MAX_EMPLOYEE_NO = 20;
const MAX_NAME = 30;
const MAX_RETRIES = 3;

export type OrderLineInput = { menuItemId: number; quantity: number; optionIds: number[] };
export type OrderInput = CustomerInput & { items: OrderLineInput[] };

function invalid(message: string): never {
  throw new AppError(400, "VALIDATION", message);
}

const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/** 요청 본문의 형식만 검사한다. 메뉴/옵션 존재 여부는 createOrder에서 DB 기준으로 검사. */
export function parseOrderInput(body: unknown): OrderInput {
  if (typeof body !== "object" || body === null) invalid("요청 형식이 올바르지 않습니다.");
  const { employeeNo, name, items } = body as Record<string, unknown>;

  if (typeof employeeNo !== "string" || typeof name !== "string") {
    invalid("사번과 이름을 입력해 주세요.");
  }
  const trimmedNo = employeeNo.trim();
  const trimmedName = name.trim();
  if (!trimmedNo || !trimmedName) invalid("사번과 이름을 입력해 주세요.");
  if (trimmedNo.length > MAX_EMPLOYEE_NO || trimmedName.length > MAX_NAME) {
    invalid("사번 또는 이름이 너무 깁니다.");
  }

  if (!Array.isArray(items) || items.length === 0) invalid("주문할 메뉴가 없습니다.");
  if (items.length > MAX_LINES) invalid(`한 번에 ${MAX_LINES}개 항목까지 주문할 수 있습니다.`);

  const lines = items.map((raw): OrderLineInput => {
    const { menuItemId, quantity, optionIds } = (raw ?? {}) as Record<string, unknown>;
    if (!isPositiveInt(menuItemId)) invalid("메뉴 정보가 올바르지 않습니다.");
    if (!isPositiveInt(quantity) || quantity > MAX_QUANTITY) {
      invalid(`수량은 1~${MAX_QUANTITY}개만 가능합니다.`);
    }
    if (!Array.isArray(optionIds) || !optionIds.every(isPositiveInt)) {
      invalid("옵션 정보가 올바르지 않습니다.");
    }
    if (new Set(optionIds).size !== optionIds.length) invalid("같은 옵션이 중복되었습니다.");
    return { menuItemId, quantity, optionIds };
  });

  return { employeeNo: trimmedNo, name: trimmedName, items: lines };
}

/** DESIGN.md §4: 가격은 서버에서 계산하고, 이름/가격은 스냅샷으로 저장한다. */
export async function createOrder(input: OrderInput, now = new Date()) {
  const menuItemIds = [...new Set(input.items.map((l) => l.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    include: { optionGroups: { include: { options: true } } },
  });
  const menuById = new Map(menuItems.map((m) => [m.id, m]));

  const lines = input.items.map((line) => {
    const item = menuById.get(line.menuItemId);
    if (!item) invalid("존재하지 않는 메뉴입니다.");
    if (!item.isAvailable) throw new AppError(400, "SOLD_OUT", `${item.name}은(는) 품절입니다.`);

    const selected = new Set(line.optionIds);
    const ownOptionIds = new Set(item.optionGroups.flatMap((g) => g.options.map((o) => o.id)));
    if (line.optionIds.some((id) => !ownOptionIds.has(id))) {
      invalid(`${item.name}에 선택할 수 없는 옵션입니다.`);
    }

    const optionSnapshots: { nameSnapshot: string; extraPrice: number }[] = [];
    for (const group of item.optionGroups) {
      const chosen = group.options.filter((o) => selected.has(o.id));
      if (group.required && chosen.length === 0) invalid(`${item.name}의 ${group.name}을(를) 선택해 주세요.`);
      if (chosen.length > group.maxSelect) {
        invalid(`${item.name}의 ${group.name}은(는) ${group.maxSelect}개까지 선택할 수 있습니다.`);
      }
      if (chosen.length > 0 && !isGroupAvailable(item.optionGroups, group, line.optionIds)) {
        invalid(`${item.name}의 ${group.name} 옵션은 ICE에서만 선택할 수 있습니다.`);
      }
      for (const o of chosen) {
        optionSnapshots.push({ nameSnapshot: `${group.name}: ${o.name}`, extraPrice: o.extraPrice });
      }
    }

    return {
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPrice: calcUnitPrice(item, line.optionIds),
      quantity: line.quantity,
      optionSnapshots,
    };
  });

  const totalPrice = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const businessDate = kstBusinessDate(now);

  // 동시 주문으로 주문번호(또는 신규 사번)가 겹치면 unique 제약에 걸리므로 재시도
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const customer = await resolveCustomer(tx, input);
        const last = await tx.order.aggregate({
          where: { businessDate },
          _max: { orderNumber: true },
        });
        return tx.order.create({
          data: {
            businessDate,
            orderNumber: (last._max.orderNumber ?? 0) + 1,
            status: "RECEIVED" satisfies OrderStatus,
            totalPrice,
            customerId: customer.id,
            customerNameSnapshot: customer.name,
            createdAt: now,
            items: {
              create: lines.map(({ optionSnapshots, ...l }) => ({
                ...l,
                options: { create: optionSnapshots },
              })),
            },
          },
        });
      });
    } catch (e) {
      const isUniqueConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isUniqueConflict || attempt >= MAX_RETRIES) throw e;
    }
  }
}

export function getOrder(id: number) {
  return prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      businessDate: true,
      status: true,
      totalPrice: true,
      customerNameSnapshot: true,
      createdAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          nameSnapshot: true,
          unitPrice: true,
          quantity: true,
          options: { orderBy: { id: "asc" }, select: { nameSnapshot: true } },
        },
      },
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

const WAITING_STATUSES: OrderStatus[] = ["RECEIVED", "PREPARING"];

/** 대기번호 화면의 "앞에 N팀": 이 주문보다 먼저 들어와 아직 제조가 끝나지 않은 주문 수 */
export function countOrdersAhead(order: { id: number; createdAt: Date }) {
  return prisma.order.count({
    where: {
      status: { in: WAITING_STATUSES },
      OR: [
        { createdAt: { lt: order.createdAt } },
        { createdAt: order.createdAt, id: { lt: order.id } },
      ],
    },
  });
}

export function listOrdersByEmployee(employeeNo: string) {
  return prisma.order.findMany({
    where: { customer: { employeeNo } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      businessDate: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      items: { orderBy: { id: "asc" }, select: { nameSnapshot: true, quantity: true } },
    },
  });
}

export type OrderSummary = Awaited<ReturnType<typeof listOrdersByEmployee>>[number];

/** 주문자 취소: 본인 주문이고 RECEIVED 상태일 때만 (DESIGN.md §5) */
export async function cancelOrderByCustomer(id: number, employeeNo: string) {
  const { count } = await prisma.order.updateMany({
    where: { id, status: "RECEIVED" satisfies OrderStatus, customer: { employeeNo } },
    data: { status: "CANCELED" satisfies OrderStatus },
  });
  if (count > 0) return;

  const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
  if (!order || order.customer.employeeNo !== employeeNo) {
    throw new AppError(404, "NOT_FOUND", "주문을 찾을 수 없습니다.");
  }
  throw new AppError(409, "INVALID_STATUS", "이미 제조가 시작되어 취소할 수 없습니다.");
}
