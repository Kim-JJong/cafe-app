import { ACTIVE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import { currentKstMonth, kstMonthRange, parseMonth } from "@/lib/time";

// DESIGN.md §7: 주문 시각(createdAt)이 KST 해당 월이고 픽업 완료된 주문만 정산한다.
const SETTLED: OrderStatus = "PICKED_UP";

export type SettlementRow = {
  employeeNo: string;
  name: string;
  orderCount: number;
  total: number;
};

export async function getSettlement(year: number, month: number) {
  const { start, end } = kstMonthRange(year, month);
  const inMonth = { createdAt: { gte: start, lt: end } };

  const [groups, pendingCount] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { ...inMonth, status: SETTLED },
      _count: { _all: true },
      _sum: { totalPrice: true },
    }),
    // 월말 직후 정산할 때 아직 진행 중인 주문이 빠지지 않도록 경고용
    prisma.order.count({ where: { ...inMonth, status: { in: ACTIVE_STATUSES } } }),
  ]);

  const customers = await prisma.customer.findMany({
    where: { id: { in: groups.map((g) => g.customerId) } },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));

  const rows: SettlementRow[] = groups
    .map((g) => {
      const customer = byId.get(g.customerId)!;
      return {
        employeeNo: customer.employeeNo,
        name: customer.name,
        orderCount: g._count._all,
        total: g._sum.totalPrice ?? 0,
      };
    })
    .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo));

  return {
    rows,
    pendingCount,
    grandTotal: rows.reduce((sum, r) => sum + r.total, 0),
  };
}

/** 정산 상세: 한 사람의 해당 월 정산 대상 주문 */
export function getSettlementOrders(year: number, month: number, employeeNo: string) {
  const { start, end } = kstMonthRange(year, month);
  return prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end }, status: SETTLED, customer: { employeeNo } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalPrice: true,
      items: { orderBy: { id: "asc" }, select: { nameSnapshot: true, quantity: true } },
    },
  });
}

export type SettlementOrder = Awaited<ReturnType<typeof getSettlementOrders>>[number];

/** 주문자 화면의 "이번 달 급여 공제 예정": 정산과 같은 기준(KST 이번 달, 픽업 완료) */
export async function getMonthlyCharge(employeeNo: string, now = new Date()) {
  const month = currentKstMonth(now);
  const { year, month: m } = parseMonth(month)!;
  const { start, end } = kstMonthRange(year, m);
  const result = await prisma.order.aggregate({
    where: { createdAt: { gte: start, lt: end }, status: SETTLED, customer: { employeeNo } },
    _sum: { totalPrice: true },
    _count: { _all: true },
  });
  return { month, total: result._sum.totalPrice ?? 0, orderCount: result._count._all };
}
