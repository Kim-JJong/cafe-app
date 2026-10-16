// DESIGN.md §5
export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: "접수",
  PREPARING: "제조중",
  READY: "픽업대기",
  PICKED_UP: "픽업완료",
  CANCELED: "취소",
};

/** 더 이상 바뀌지 않는 상태 — 주문자 화면은 이 상태가 되면 폴링을 멈춘다 */
export const FINAL_STATUSES: readonly string[] = ["PICKED_UP", "CANCELED"];

/** 직원 칸반에 보이는 진행 중 상태 */
export const ACTIVE_STATUSES: OrderStatus[] = ["RECEIVED", "PREPARING", "READY"];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ["PREPARING", "CANCELED"],
  PREPARING: ["READY"],
  READY: ["PICKED_UP"],
  PICKED_UP: [],
  CANCELED: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

export function canTransition(from: string, to: string) {
  return isOrderStatus(from) && isOrderStatus(to) && TRANSITIONS[from].includes(to);
}
