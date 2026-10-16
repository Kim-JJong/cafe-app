"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/lib/cart";
import { groupMemberships } from "@/lib/group-membership";
import type { MenuItemDetail } from "@/lib/menu";
import { isGroupAvailable } from "@/lib/option-rules";
import { calcUnitPrice, formatWon } from "@/lib/price";
import { BottomBar } from "../../_components/screen";
import { Stepper } from "../../_components/stepper";

type Group = MenuItemDetail["optionGroups"][number];

// 필수 그룹은 첫 번째 옵션을 기본 선택 (HOT 등)
function defaultSelection(item: MenuItemDetail) {
  return item.optionGroups.flatMap((g) => (g.required && g.options[0] ? [g.options[0].id] : []));
}

/** 고를 수 없게 된 그룹(HOT으로 바꾼 뒤의 얼음 등)의 선택을 지운다 */
function dropUnavailable(groups: Group[], selected: number[]) {
  const blocked = new Set(
    groups.filter((g) => !isGroupAvailable(groups, g, selected)).flatMap((g) => g.options.map((o) => o.id)),
  );
  return selected.filter((id) => !blocked.has(id));
}

export function MenuOptionForm({ item }: { item: MenuItemDetail }) {
  const [selected, setSelected] = useState<number[]>(() => defaultSelection(item));
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();
  const groupId = useSearchParams().get("group");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = item.optionGroups;

  function toggle(group: Group, optionId: number) {
    const groupIds = group.options.map((o) => o.id);
    const inGroup = selected.filter((id) => groupIds.includes(id));
    const others = selected.filter((id) => !groupIds.includes(id));

    let next = selected;
    if (inGroup.includes(optionId)) {
      if (group.required && inGroup.length === 1) return; // 필수 그룹은 비울 수 없음
      next = [...others, ...inGroup.filter((id) => id !== optionId)];
    } else if (group.maxSelect === 1) {
      next = [...others, optionId]; // 단일 선택은 교체
    } else if (inGroup.length < group.maxSelect) {
      next = [...others, ...inGroup, optionId];
    }
    setSelected(dropUnavailable(groups, next));
  }

  const unitPrice = calcUnitPrice(item, selected);
  const visible = groups.filter((g) => isGroupAvailable(groups, g, selected));
  // 선택지가 여럿이면 버튼 묶음, 하나뿐이면 "추가 옵션" 목록의 스위치 (디자인 1b)
  const choiceGroups = visible.filter((g) => g.options.length > 1);
  const toggleGroups = visible.filter((g) => g.options.length === 1);

  async function add() {
    if (groupId) {
      await addToGroup(groupId);
      return;
    }
    addToCart({
      menuItemId: item.id,
      name: item.name,
      optionIds: selected,
      optionLabels: groups.flatMap((g) => g.options.filter((o) => selected.includes(o.id)).map((o) => o.name)),
      unitPrice,
      quantity,
    });
    router.push("/");
  }

  /** 단체 주문 방에 담기 (?group=방ID로 들어왔을 때) */
  async function addToGroup(roomId: string) {
    const membership = groupMemberships.read()[roomId];
    if (!membership) {
      router.push(`/group/${roomId}`); // 참여부터
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/group/${roomId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberKey: membership.memberKey, menuItemId: item.id, quantity, optionIds: selected }),
      });
      if (!res.ok) {
        setError((await res.json()).error?.message ?? "담지 못했습니다.");
        return;
      }
      router.push(`/group/${roomId}`);
    } catch {
      setError("네트워크 오류로 담지 못했습니다.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="px-5 pb-6">
        {choiceGroups.map((group) => (
          <fieldset key={group.id} className="mt-5">
            <legend className="flex items-center gap-1.5 text-[13px] font-semibold">
              {group.name}
              <RequiredTag required={group.required} />
            </legend>
            <div className="mt-2.5 flex gap-2">
              {group.options.map((option) => {
                const active = selected.includes(option.id);
                const style = !active
                  ? "border border-ink/12 bg-white font-medium"
                  : group.required
                    ? "bg-ink font-semibold text-white"
                    : "border-[1.5px] border-brand bg-brand-soft font-semibold text-brand";
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(group, option.id)}
                    className={`flex-1 rounded-xl py-[11px] text-center text-[13.5px] ${style}`}
                  >
                    {option.name}
                    {option.extraPrice > 0 && ` +${option.extraPrice.toLocaleString("ko-KR")}`}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        {toggleGroups.length > 0 && (
          <section className="mt-[18px]">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
              추가 옵션
              <RequiredTag required={false} />
            </h2>
            <ul className="mt-2.5 divide-y divide-ink/[.06] overflow-hidden rounded-[14px] border border-ink/[.08]">
              {toggleGroups.map((group) => {
                const option = group.options[0];
                const on = selected.includes(option.id);
                return (
                  <li key={group.id} className="flex items-center justify-between px-[15px] py-[13px]">
                    <span className="text-[13.5px] font-medium">
                      {option.name}
                      {option.extraPrice > 0 && (
                        <span className="text-ink/45"> +{formatWon(option.extraPrice)}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={option.name}
                      onClick={() => toggle(group, option.id)}
                      className={`relative h-[23px] w-10 rounded-full transition-colors ${on ? "bg-brand" : "bg-ink/15"}`}
                    >
                      <span
                        className={`absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white transition-all ${
                          on ? "right-[3px]" : "left-[3px]"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <BottomBar>
        <div className="flex items-center gap-3 border-t border-ink/[.07] px-5 pt-3.5 pb-2.5">
          <Stepper value={quantity} onChange={setQuantity} label={item.name} />
          <button
            type="button"
            onClick={add}
            disabled={adding}
            className="flex-1 rounded-[14px] bg-brand py-3.5 text-center text-[14.5px] font-semibold text-white disabled:opacity-40"
          >
            {formatWon(unitPrice * quantity)} {groupId ? "단체 주문에 담기" : "담기"}
          </button>
        </div>
      </BottomBar>
    </>
  );
}

/** 옵션 그룹 이름 옆 "필수" / "선택" 표시 */
function RequiredTag({ required }: { required: boolean }) {
  return required ? (
    <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-brand">필수</span>
  ) : (
    <span className="rounded-full bg-chip px-1.5 py-0.5 text-[10.5px] font-medium text-ink/50">선택</span>
  );
}
