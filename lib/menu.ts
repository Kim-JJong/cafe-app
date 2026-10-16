import { prisma } from "@/lib/prisma";

const byOrder = { sortOrder: "asc" } as const;

const itemInclude = {
  optionGroups: {
    orderBy: byOrder,
    include: { options: { orderBy: byOrder } },
  },
} as const;

/** 손님 화면용: 숨긴 메뉴와 보일 메뉴가 없는 분류는 뺀다 */
export async function getMenu() {
  const categories = await prisma.category.findMany({
    orderBy: byOrder,
    include: { items: { where: { isHidden: false }, orderBy: byOrder, include: itemInclude } },
  });
  return categories.filter((c) => c.items.length > 0);
}

/** 직원 메뉴 관리용: 숨긴 메뉴와 빈 분류까지 모두 */
export function getMenuForStaff() {
  return prisma.category.findMany({
    orderBy: byOrder,
    include: { items: { orderBy: byOrder, include: itemInclude } },
  });
}

/** 손님 화면용: 숨긴 메뉴는 없는 것으로 본다 */
export function getMenuItem(id: number) {
  return prisma.menuItem.findFirst({ where: { id, isHidden: false }, include: itemInclude });
}

/** 직원 편집 화면용 */
export function getMenuItemForStaff(id: number) {
  return prisma.menuItem.findUnique({ where: { id }, include: itemInclude });
}

/** 품절·숨김 토글. 메뉴가 없으면 false */
export async function setMenuItemFlags(id: number, flags: { isAvailable?: boolean; isHidden?: boolean }) {
  const { count } = await prisma.menuItem.updateMany({ where: { id }, data: flags });
  return count > 0;
}

export type MenuItemDetail = NonNullable<Awaited<ReturnType<typeof getMenuItem>>>;
