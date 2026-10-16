// 음료 완료(READY) 팝업에서 쓰는 순수 함수. 화면 간에 공유된다.

/** 알린 주문 ID는 최근 것만 기억한다 (localStorage가 계속 커지지 않도록) */
export const MAX_REMEMBERED = 50;

/** 아직 알리지 않은 픽업 대기 주문 중 가장 먼저 들어온 것 */
export function findOrderToNotify<T extends { id: number; status: string; createdAt: string }>(
  orders: T[],
  notifiedIds: number[],
) {
  return (
    orders
      .filter((o) => o.status === "READY" && !notifiedIds.includes(o.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  );
}

export function rememberNotified(notifiedIds: number[], id: number) {
  return [...notifiedIds.filter((n) => n !== id), id].slice(-MAX_REMEMBERED);
}
