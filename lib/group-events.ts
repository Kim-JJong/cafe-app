// 단체 주문 방의 실시간 알림 (SSE). 구독자는 서버 메모리에만 있으므로
// 서버가 한 프로세스로 돌 때만 동작한다 (DESIGN.md §12).

export type GroupEvent = {
  /** 화면에 잠깐 띄울 알림. 없으면 조용히 갱신만 한다 */
  activity?: string;
};

type Listener = (event: GroupEvent) => void;

// 개발 모드의 핫 리로드에도 구독 목록이 유지되도록 전역에 보관
const globalForGroups = globalThis as unknown as { groupListeners?: Map<string, Set<Listener>> };
const listeners = (globalForGroups.groupListeners ??= new Map());

export function subscribeGroup(roomId: string, listener: Listener) {
  let set = listeners.get(roomId);
  if (!set) listeners.set(roomId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(roomId);
  };
}

export function publishGroup(roomId: string, event: GroupEvent) {
  for (const listener of listeners.get(roomId) ?? []) {
    try {
      listener(event);
    } catch {} // 끊어진 연결 하나 때문에 다른 구독자가 영향받지 않도록
  }
}
