import { AppError } from "@/lib/errors";
import { ACTIVE_STATUSES, canTransition, type OrderStatus } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";

/** 직원 칸반용: 진행 중 주문을 오래된 순으로 */
export function listOrdersByStatus(statuses: OrderStatus[] = ACTIVE_STATUSES) {
  return prisma.order.findMany({
    where: { status: { in: statuses } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerNameSnapshot: true,
      createdAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          nameSnapshot: true,
          quantity: true,
          options: { orderBy: { id: "asc" }, select: { nameSnapshot: true } },
        },
      },
    },
  });
}

export type StaffOrder = Awaited<ReturnType<typeof listOrdersByStatus>>[number];

/** 허용된 전이만 통과시킨다 (DESIGN.md §5). 동시에 다른 직원이 바꿨으면 409. */
export async function updateOrderStatus(id: number, to: OrderStatus, now = new Date()) {
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) throw new AppError(404, "NOT_FOUND", "주문을 찾을 수 없습니다.");
  if (!canTransition(order.status, to)) {
    throw new AppError(409, "INVALID_STATUS", "이 상태로 변경할 수 없습니다.");
  }

  const { count } = await prisma.order.updateMany({
    where: { id, status: order.status },
    data: { status: to, ...(to === "PICKED_UP" ? { pickedUpAt: now } : {}) },
  });
  if (count === 0) {
    throw new AppError(409, "INVALID_STATUS", "다른 곳에서 상태가 먼저 변경되었습니다.");
  }
}
