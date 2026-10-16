import { prisma } from "@/lib/prisma";

const byOrder = { sortOrder: "asc" } as const;

const itemInclude = {
  optionGroups: {
    orderBy: byOrder,
    include: { options: { orderBy: byOrder } },
  },
} as const;

export function getMenu() {
  return prisma.category.findMany({
    orderBy: byOrder,
    include: { items: { orderBy: byOrder, include: itemInclude } },
  });
}

export function getMenuItem(id: number) {
  return prisma.menuItem.findUnique({ where: { id }, include: itemInclude });
}

/** 품절 토글. 메뉴가 없으면 false */
export async function setMenuItemAvailability(id: number, isAvailable: boolean) {
  const { count } = await prisma.menuItem.updateMany({ where: { id }, data: { isAvailable } });
  return count > 0;
}

export type MenuItemDetail = NonNullable<Awaited<ReturnType<typeof getMenuItem>>>;
