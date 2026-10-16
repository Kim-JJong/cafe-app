"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/lib/cart";
import { MAX_QUANTITY } from "@/lib/limits";
import type { MenuItemDetail } from "@/lib/menu";
import { calcUnitPrice, formatWon } from "@/lib/price";

// 필수 그룹은 첫 번째 옵션을 기본 선택 (HOT, Regular 등)
function defaultSelection(item: MenuItemDetail) {
  return item.optionGroups.flatMap((g) => (g.required && g.options[0] ? [g.options[0].id] : []));
}

export function MenuOptionForm({ item }: { item: MenuItemDetail }) {
  const [selected, setSelected] = useState<number[]>(() => defaultSelection(item));
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();

  function toggle(group: MenuItemDetail["optionGroups"][number], optionId: number) {
    const groupIds = group.options.map((o) => o.id);
    const inGroup = selected.filter((id) => groupIds.includes(id));
    const others = selected.filter((id) => !groupIds.includes(id));

    if (inGroup.includes(optionId)) {
      if (group.required && inGroup.length === 1) return; // 필수 그룹은 비울 수 없음
      setSelected([...others, ...inGroup.filter((id) => id !== optionId)]);
    } else if (group.maxSelect === 1) {
      setSelected([...others, optionId]); // 단일 선택은 교체
    } else if (inGroup.length < group.maxSelect) {
      setSelected([...others, ...inGroup, optionId]);
    }
  }

  const unitPrice = calcUnitPrice(item, selected);

  function add() {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      optionIds: selected,
      optionLabels: item.optionGroups.flatMap((g) =>
        g.options.filter((o) => selected.includes(o.id)).map((o) => o.name),
      ),
      unitPrice,
      quantity,
    });
    router.push("/");
  }

  return (
    <div className="mt-6">
      {item.optionGroups.map((group) => (
        <fieldset key={group.id} className="mb-6">
          <legend className="mb-2 font-semibold">
            {group.name}
            {group.required && <span className="ml-1 text-sm text-red-500">필수</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const active = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(group, option.id)}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    active ? "border-foreground bg-foreground text-background" : "border-gray-300"
                  }`}
                >
                  {option.name}
                  {option.extraPrice > 0 && ` +${formatWon(option.extraPrice)}`}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="mb-6 flex items-center justify-between">
        <span className="font-semibold">수량</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="수량 줄이기"
            disabled={quantity <= 1}
            onClick={() => setQuantity(quantity - 1)}
            className="h-9 w-9 rounded-full border border-gray-300 disabled:opacity-30"
          >
            −
          </button>
          <span className="w-6 text-center">{quantity}</span>
          <button
            type="button"
            aria-label="수량 늘리기"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => setQuantity(quantity + 1)}
            className="h-9 w-9 rounded-full border border-gray-300 disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={add}
        className="w-full rounded-lg bg-foreground py-3 font-semibold text-background disabled:opacity-40"
      >
        {formatWon(unitPrice * quantity)} 담기
      </button>
    </div>
  );
}
