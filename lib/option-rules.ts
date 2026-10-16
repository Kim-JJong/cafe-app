// 서버(주문 검증)와 클라이언트(옵션 화면)가 함께 쓰는 순수 함수. DB 접근 금지.

type RuleGroup = { name: string; options: { id: number; name: string }[] };

const ICE_GROUP = "얼음";
const ICE_OPTION = "ICE";

/**
 * 얼음 옵션은 ICE를 골랐을 때만 고를 수 있다.
 * HOT/ICE 선택지가 없는 메뉴(ICE 전용 에이드 등)는 항상 고를 수 있다.
 */
export function isGroupAvailable(groups: RuleGroup[], group: RuleGroup, selectedIds: number[]) {
  if (group.name !== ICE_GROUP) return true;
  const iceOption = groups.flatMap((g) => g.options).find((o) => o.name === ICE_OPTION);
  return !iceOption || selectedIds.includes(iceOption.id);
}
