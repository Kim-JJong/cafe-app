// 서버(주문 생성)와 클라이언트(화면 표시)가 함께 쓰는 순수 함수. DB 접근 금지.

type PricedItem = {
  basePrice: number;
  optionGroups: { options: { id: number; extraPrice: number }[] }[];
};

export function calcUnitPrice(item: PricedItem, selectedOptionIds: number[]) {
  const selected = new Set(selectedOptionIds);
  let price = item.basePrice;
  for (const group of item.optionGroups) {
    for (const option of group.options) {
      if (selected.has(option.id)) price += option.extraPrice;
    }
  }
  return price;
}

export function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
