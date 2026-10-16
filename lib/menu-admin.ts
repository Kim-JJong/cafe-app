import type { Prisma } from "@/app/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// 직원 메뉴 관리: 신메뉴 등록, 기존 메뉴 수정 (DESIGN.md §8 메뉴 관리)

const LIMITS = {
  name: 30,
  description: 100,
  category: 20,
  groupName: 20,
  optionName: 20,
  groups: 10,
  options: 10,
  price: 100_000,
  extraPrice: 10_000,
};

export type MenuOptionInput = { id?: number; name: string; extraPrice: number };
export type MenuGroupInput = {
  id?: number;
  name: string;
  required: boolean;
  maxSelect: number;
  options: MenuOptionInput[];
};
export type MenuInput = {
  name: string;
  description: string | null;
  basePrice: number;
  /** 기존 분류 ID 또는 새 분류 이름 중 하나 */
  categoryId: number | null;
  newCategoryName: string | null;
  optionGroups: MenuGroupInput[];
};

function invalid(message: string): never {
  throw new AppError(400, "VALIDATION", message);
}

function text(value: unknown, label: string, max: number) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) invalid(`${label}을(를) 입력해 주세요.`);
  if (trimmed.length > max) invalid(`${label}은(는) ${max}자까지 입력할 수 있습니다.`);
  return trimmed;
}

function price(value: unknown, label: string, max: number) {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > max) {
    invalid(`${label}은(는) 0~${max.toLocaleString("ko-KR")}원 사이의 정수여야 합니다.`);
  }
  return value as number;
}

const optionalId = (value: unknown) => (Number.isInteger(value) ? (value as number) : undefined);

function noDuplicates(names: string[], message: string) {
  if (new Set(names).size !== names.length) invalid(message);
}

/** 요청 본문 검증 */
export function parseMenuInput(body: unknown): MenuInput {
  if (typeof body !== "object" || body === null) invalid("요청 형식이 올바르지 않습니다.");
  const b = body as Record<string, unknown>;

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length > LIMITS.description) invalid(`설명은 ${LIMITS.description}자까지 입력할 수 있습니다.`);

  const categoryId = optionalId(b.categoryId) ?? null;
  const newCategoryName =
    typeof b.newCategoryName === "string" && b.newCategoryName.trim()
      ? text(b.newCategoryName, "새 분류 이름", LIMITS.category)
      : null;
  if (!categoryId && !newCategoryName) invalid("분류를 선택해 주세요.");

  if (!Array.isArray(b.optionGroups)) invalid("옵션 정보가 올바르지 않습니다.");
  if (b.optionGroups.length > LIMITS.groups) invalid(`옵션 그룹은 ${LIMITS.groups}개까지 만들 수 있습니다.`);

  const optionGroups = b.optionGroups.map((raw): MenuGroupInput => {
    const g = (raw ?? {}) as Record<string, unknown>;
    const name = text(g.name, "옵션 그룹 이름", LIMITS.groupName);
    if (!Array.isArray(g.options) || g.options.length === 0) invalid(`'${name}'에 선택지를 하나 이상 넣어 주세요.`);
    if (g.options.length > LIMITS.options) invalid(`'${name}'의 선택지는 ${LIMITS.options}개까지입니다.`);

    const options = g.options.map((o): MenuOptionInput => {
      const opt = (o ?? {}) as Record<string, unknown>;
      return {
        id: optionalId(opt.id),
        name: text(opt.name, `'${name}'의 선택지 이름`, LIMITS.optionName),
        extraPrice: price(opt.extraPrice, `'${name}'의 추가 금액`, LIMITS.extraPrice),
      };
    });
    noDuplicates(options.map((o) => o.name), `'${name}'에 같은 이름의 선택지가 있습니다.`);

    const maxSelect = Number.isInteger(g.maxSelect) ? (g.maxSelect as number) : 1;
    if (maxSelect < 1 || maxSelect > options.length) invalid(`'${name}'의 최대 선택 수가 올바르지 않습니다.`);

    return { id: optionalId(g.id), name, required: g.required === true, maxSelect, options };
  });
  noDuplicates(optionGroups.map((g) => g.name), "같은 이름의 옵션 그룹이 있습니다.");

  return {
    name: text(b.name, "메뉴 이름", LIMITS.name),
    description: description || null,
    basePrice: price(b.basePrice, "가격", LIMITS.price),
    categoryId,
    newCategoryName,
    optionGroups,
  };
}

/** 새 분류 이름이 오면 (같은 이름이 없을 때) 맨 뒤에 만든다 */
async function resolveCategoryId(tx: Prisma.TransactionClient, input: MenuInput) {
  if (input.newCategoryName) {
    const existing = await tx.category.findFirst({ where: { name: input.newCategoryName } });
    if (existing) return existing.id;
    const last = await tx.category.aggregate({ _max: { sortOrder: true } });
    const created = await tx.category.create({
      data: { name: input.newCategoryName, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return created.id;
  }
  const category = await tx.category.findUnique({ where: { id: input.categoryId! } });
  if (!category) invalid("존재하지 않는 분류입니다.");
  return category.id;
}

async function nextItemSortOrder(tx: Prisma.TransactionClient, categoryId: number) {
  const last = await tx.menuItem.aggregate({ where: { categoryId }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}

/** 신메뉴 등록: 분류의 맨 뒤에 판매중 상태로 추가 */
export async function createMenuItem(input: MenuInput) {
  return prisma.$transaction(async (tx) => {
    const categoryId = await resolveCategoryId(tx, input);
    return tx.menuItem.create({
      data: {
        categoryId,
        name: input.name,
        description: input.description,
        basePrice: input.basePrice,
        sortOrder: await nextItemSortOrder(tx, categoryId),
        optionGroups: {
          create: input.optionGroups.map((g, gi) => ({
            name: g.name,
            required: g.required,
            maxSelect: g.maxSelect,
            sortOrder: gi,
            options: {
              create: g.options.map((o, oi) => ({ name: o.name, extraPrice: o.extraPrice, sortOrder: oi })),
            },
          })),
        },
      },
    });
  });
}

/**
 * 기존 메뉴 수정. 옵션은 ID가 있으면 그대로 고치고(ID 유지), 없으면 새로 만들고, 빠진 것은 지운다.
 * ID를 유지해야 아직 주문하지 않은 단체 주문 방의 담긴 음료가 계속 유효하다.
 */
export async function updateMenuItem(id: number, input: MenuInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.menuItem.findUnique({
      where: { id },
      include: { optionGroups: { include: { options: true } } },
    });
    if (!current) throw new AppError(404, "NOT_FOUND", "메뉴를 찾을 수 없습니다.");

    const categoryId = await resolveCategoryId(tx, input);
    await tx.menuItem.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        basePrice: input.basePrice,
        ...(categoryId !== current.categoryId
          ? { categoryId, sortOrder: await nextItemSortOrder(tx, categoryId) }
          : {}),
      },
    });

    const groupsById = new Map(current.optionGroups.map((g) => [g.id, g]));
    const keptGroupIds = new Set<number>();

    for (const [gi, g] of input.optionGroups.entries()) {
      const existing = g.id !== undefined ? groupsById.get(g.id) : undefined;
      if (g.id !== undefined && !existing) invalid("이 메뉴의 옵션 그룹이 아닙니다.");

      const groupData = { name: g.name, required: g.required, maxSelect: g.maxSelect, sortOrder: gi };
      const groupId = existing
        ? (await tx.optionGroup.update({ where: { id: existing.id }, data: groupData })).id
        : (await tx.optionGroup.create({ data: { ...groupData, menuItemId: id } })).id;
      keptGroupIds.add(groupId);

      const optionIds = new Set(existing?.options.map((o) => o.id) ?? []);
      const keptOptionIds = new Set<number>();
      for (const [oi, o] of g.options.entries()) {
        if (o.id !== undefined && !optionIds.has(o.id)) invalid(`'${g.name}'의 선택지가 아닙니다.`);
        const optionData = { name: o.name, extraPrice: o.extraPrice, sortOrder: oi };
        const optionId =
          o.id !== undefined
            ? (await tx.option.update({ where: { id: o.id }, data: optionData })).id
            : (await tx.option.create({ data: { ...optionData, optionGroupId: groupId } })).id;
        keptOptionIds.add(optionId);
      }
      await tx.option.deleteMany({ where: { optionGroupId: groupId, id: { notIn: [...keptOptionIds] } } });
    }

    const removedGroupIds = current.optionGroups.map((g) => g.id).filter((gid) => !keptGroupIds.has(gid));
    await tx.option.deleteMany({ where: { optionGroupId: { in: removedGroupIds } } });
    await tx.optionGroup.deleteMany({ where: { id: { in: removedGroupIds } } });

    return tx.menuItem.findUniqueOrThrow({ where: { id } });
  });
}
