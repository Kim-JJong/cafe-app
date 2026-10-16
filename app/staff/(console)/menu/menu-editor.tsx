"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { OPTION_PRESETS, type OptionPreset } from "@/lib/option-presets";
import { useStaffApi } from "../staff-fetch";
import { Switch } from "../switch";

const NEW_CATEGORY = "new";
const inputClass = "w-full rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm";

type OptionRow = { key: number; id?: number; name: string; extraPrice: string };
type GroupRow = { key: number; id?: number; name: string; required: boolean; multi: boolean; options: OptionRow[] };
type Category = { id: number; name: string };
type ItemJson = {
  name: string;
  description: string | null;
  basePrice: number;
  categoryId: number;
  isHidden: boolean;
  optionGroups: {
    id: number;
    name: string;
    required: boolean;
    maxSelect: number;
    options: { id: number; name: string; extraPrice: number }[];
  }[];
};

/** 신메뉴 등록(itemId 없음)과 기존 메뉴 수정에 같이 쓰는 폼 */
export function MenuEditor({ itemId }: { itemId?: number }) {
  const api = useStaffApi();
  const router = useRouter();
  const nextKey = useRef(0);
  const key = () => nextKey.current++;

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loaded, setLoaded] = useState(itemId === undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [category, setCategory] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [isHidden, setIsHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.staffFetch("/api/staff/menu").then(async (res) => {
      if (!active || !res.ok) return;
      const menu: Category[] = await res.json();
      setCategories(menu.map((c) => ({ id: c.id, name: c.name })));
      setCategory((current) => current || (menu[0] ? String(menu[0].id) : NEW_CATEGORY));
    });
    if (itemId !== undefined) {
      api.staffFetch(`/api/staff/menu/${itemId}`).then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setError((await res.json()).error?.message ?? "메뉴를 불러오지 못했습니다.");
          return;
        }
        const item: ItemJson = await res.json();
        setName(item.name);
        setDescription(item.description ?? "");
        setBasePrice(String(item.basePrice));
        setCategory(String(item.categoryId));
        setIsHidden(item.isHidden);
        setGroups(
          item.optionGroups.map((g) => ({
            key: nextKey.current++,
            id: g.id,
            name: g.name,
            required: g.required,
            multi: g.maxSelect > 1,
            options: g.options.map((o) => ({
              key: nextKey.current++,
              id: o.id,
              name: o.name,
              extraPrice: String(o.extraPrice),
            })),
          })),
        );
        setLoaded(true);
      });
    }
    return () => {
      active = false;
    };
  }, [api, itemId]);

  const updateGroup = (groupKey: number, patch: Partial<GroupRow>) =>
    setGroups((list) => list.map((g) => (g.key === groupKey ? { ...g, ...patch } : g)));

  const updateOption = (groupKey: number, optionKey: number, patch: Partial<OptionRow>) =>
    setGroups((list) =>
      list.map((g) =>
        g.key === groupKey
          ? { ...g, options: g.options.map((o) => (o.key === optionKey ? { ...o, ...patch } : o)) }
          : g,
      ),
    );

  function addPreset(preset: OptionPreset) {
    setGroups((list) => [
      ...list,
      {
        key: key(),
        name: preset.name,
        required: preset.required,
        multi: preset.maxSelect > 1,
        options: preset.options.map((o) => ({ key: key(), name: o.name, extraPrice: String(o.extraPrice) })),
      },
    ]);
  }

  function addEmptyGroup() {
    setGroups((list) => [
      ...list,
      { key: key(), name: "", required: false, multi: false, options: [{ key: key(), name: "", extraPrice: "0" }] },
    ]);
  }

  function moveGroup(groupKey: number, delta: number) {
    setGroups((list) => {
      const i = list.findIndex((g) => g.key === groupKey);
      const j = i + delta;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name,
      description,
      basePrice: Number(basePrice),
      categoryId: category === NEW_CATEGORY ? null : Number(category),
      newCategoryName: category === NEW_CATEGORY ? newCategoryName : null,
      optionGroups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        maxSelect: g.multi ? g.options.length : 1,
        options: g.options.map((o) => ({ id: o.id, name: o.name, extraPrice: Number(o.extraPrice) })),
      })),
    };
    try {
      const res = await api.staffFetch(itemId === undefined ? "/api/staff/menu" : `/api/staff/menu/${itemId}`, {
        method: itemId === undefined ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError((await res.json()).error?.message ?? "저장하지 못했습니다.");
        return;
      }
      router.push("/staff/menu");
    } catch {
      setError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden() {
    if (itemId === undefined) return;
    const next = !isHidden;
    const res = await api.patchJson(`/api/staff/menu/${itemId}`, { isHidden: next }).catch(() => null);
    if (res?.ok) setIsHidden(next);
    else setError("숨김 상태를 바꾸지 못했습니다.");
  }

  if (!loaded || !categories) {
    return <p className="py-10 text-ink/50">{error ?? "불러오는 중…"}</p>;
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl pb-10">
      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{itemId === undefined ? "새 메뉴 등록" : "메뉴 수정"}</h1>
        <Link href="/staff/menu" className="text-sm text-ink/50">
          목록으로
        </Link>
      </div>

      <section className="mt-4 grid gap-3 rounded-xl border border-ink/[.08] p-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink/55">메뉴 이름</span>
          <input required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink/55">가격 (원)</span>
          <input
            required
            type="number"
            min={0}
            max={100000}
            step={100}
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink/55">분류</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>＋ 새 분류 추가</option>
          </select>
        </label>
        {category === NEW_CATEGORY && (
          <label className="block sm:col-span-2">
            <span className="text-xs text-ink/55">새 분류 이름</span>
            <input
              required
              maxLength={20}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="예: 디저트"
              className={inputClass}
            />
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink/55">설명 (선택)</span>
          <input
            maxLength={100}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: ICE 전용"
            className={inputClass}
          />
        </label>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">옵션</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {OPTION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={groups.some((g) => g.name === preset.name)}
              onClick={() => addPreset(preset)}
              className="rounded-full border border-ink/12 px-3 py-1.5 text-sm disabled:opacity-30"
            >
              ＋ {preset.name}
            </button>
          ))}
          <button
            type="button"
            onClick={addEmptyGroup}
            className="rounded-full border border-dashed border-ink/25 px-3 py-1.5 text-sm text-ink/60"
          >
            ＋ 직접 만들기
          </button>
        </div>
        <p className="mt-2 text-xs text-ink/45">
          &lsquo;얼음&rsquo; 옵션은 손님이 &lsquo;온도&rsquo;에서 ICE를 고를 때만 보입니다 (온도 옵션이 없는 메뉴는 항상 보임).
        </p>

        {groups.length === 0 && <p className="mt-4 text-sm text-ink/40">옵션 없이 판매합니다.</p>}

        <div className="mt-4 flex flex-col gap-3">
          {groups.map((g, gi) => (
            <fieldset key={g.key} className="rounded-xl border border-ink/[.08] p-4">
              <legend className="sr-only">옵션 그룹 {gi + 1}</legend>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  required
                  maxLength={20}
                  value={g.name}
                  onChange={(e) => updateGroup(g.key, { name: e.target.value })}
                  placeholder="그룹 이름 (예: 시럽)"
                  aria-label="옵션 그룹 이름"
                  className={`${inputClass} max-w-48 font-semibold`}
                />
                <label className="flex items-center gap-1.5 text-sm">
                  <Switch
                    checked={g.required}
                    onChange={(required) => updateGroup(g.key, { required })}
                    label={`${g.name || "옵션 그룹"} 필수`}
                  />
                  필수
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <Switch
                    checked={g.multi}
                    onChange={(multi) => updateGroup(g.key, { multi })}
                    label={`${g.name || "옵션 그룹"} 여러 개 선택`}
                  />
                  여러 개 선택
                </label>
                <div className="ml-auto flex gap-1 text-sm">
                  <button type="button" onClick={() => moveGroup(g.key, -1)} aria-label="위로" className="px-2 text-ink/50">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveGroup(g.key, 1)} aria-label="아래로" className="px-2 text-ink/50">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroups((list) => list.filter((x) => x.key !== g.key))}
                    className="px-2 text-red-600"
                  >
                    그룹 삭제
                  </button>
                </div>
              </div>

              <ul className="mt-3 flex flex-col gap-2">
                {g.options.map((o) => (
                  <li key={o.key} className="flex items-center gap-2">
                    <input
                      required
                      maxLength={20}
                      value={o.name}
                      onChange={(e) => updateOption(g.key, o.key, { name: e.target.value })}
                      placeholder="선택지 (예: 바닐라)"
                      aria-label="선택지 이름"
                      className={inputClass}
                    />
                    <span className="text-sm text-ink/50">+</span>
                    <input
                      required
                      type="number"
                      min={0}
                      max={10000}
                      step={100}
                      value={o.extraPrice}
                      onChange={(e) => updateOption(g.key, o.key, { extraPrice: e.target.value })}
                      aria-label={`${o.name || "선택지"} 추가 금액`}
                      className={`${inputClass} w-28`}
                    />
                    <span className="text-sm text-ink/50">원</span>
                    <button
                      type="button"
                      disabled={g.options.length <= 1}
                      onClick={() => updateGroup(g.key, { options: g.options.filter((x) => x.key !== o.key) })}
                      aria-label={`${o.name || "선택지"} 삭제`}
                      className="px-2 text-ink/40 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => updateGroup(g.key, { options: [...g.options, { key: key(), name: "", extraPrice: "0" }] })}
                className="mt-2 text-sm text-brand"
              >
                ＋ 선택지 추가
              </button>
            </fieldset>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-6 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          {saving ? "저장 중…" : itemId === undefined ? "등록" : "저장"}
        </button>
        {itemId !== undefined && (
          <button type="button" onClick={toggleHidden} className="rounded-lg border border-ink/12 px-4 py-2.5 text-sm">
            {isHidden ? "손님 화면에 다시 보이기" : "손님 화면에서 숨기기"}
          </button>
        )}
        {isHidden && <span className="text-sm text-ink/50">지금 손님 화면에서 숨겨져 있습니다.</span>}
      </div>
    </form>
  );
}
