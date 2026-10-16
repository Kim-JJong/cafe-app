// DESIGN.md §5. 주문은 들어오는 즉시 확정(RECEIVED)되며 취소할 수 없다.
// CANCELED는 취소 기능이 있던 때의 기존 주문을 표시하기 위해서만 남겨 둔다.
export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: "주문 확정",
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
  RECEIVED: ["PREPARING"],
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
