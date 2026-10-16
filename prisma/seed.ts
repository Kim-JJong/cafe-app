import "dotenv/config";
import { prisma } from "../lib/prisma";

type OptionSeed = { name: string; extraPrice?: number };
type GroupSeed = { name: string; required: boolean; maxSelect?: number; options: OptionSeed[] };
type ItemSeed = { name: string; description?: string; basePrice: number; groups: GroupSeed[] };

const temperature = (): GroupSeed => ({
  name: "온도",
  required: true,
  options: [{ name: "HOT" }, { name: "ICE" }],
});
const size = (): GroupSeed => ({
  name: "사이즈",
  required: true,
  options: [{ name: "Regular" }, { name: "Large", extraPrice: 500 }],
});
const extraShot = (): GroupSeed => ({
  name: "샷 추가",
  required: false,
  options: [{ name: "샷 추가", extraPrice: 500 }],
});

const menu: { category: string; items: ItemSeed[] }[] = [
  {
    category: "커피",
    items: [
      { name: "아메리카노", basePrice: 2500, groups: [temperature(), size(), extraShot()] },
      { name: "카페라떼", basePrice: 3000, groups: [temperature(), size(), extraShot()] },
      { name: "바닐라라떼", basePrice: 3500, groups: [temperature(), size(), extraShot()] },
      { name: "카페모카", basePrice: 3500, groups: [temperature(), size(), extraShot()] },
    ],
  },
  {
    category: "논커피",
    items: [
      { name: "초코라떼", basePrice: 3000, groups: [temperature(), size()] },
      { name: "녹차라떼", basePrice: 3000, groups: [temperature(), size()] },
    ],
  },
  {
    category: "티",
    items: [
      { name: "캐모마일", basePrice: 2500, groups: [temperature()] },
      { name: "얼그레이", basePrice: 2500, groups: [temperature()] },
    ],
  },
  {
    category: "에이드",
    items: [{ name: "레몬에이드", description: "ICE 전용", basePrice: 3500, groups: [size()] }],
  },
];

async function main() {
  // WAL 모드는 DB 파일에 저장되므로 한 번만 켜면 유지된다 (DESIGN.md §2)
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");

  if ((await prisma.category.count()) > 0) {
    console.log("메뉴가 이미 있어 seed를 건너뜁니다.");
    return;
  }

  for (const [ci, { category, items }] of menu.entries()) {
    await prisma.category.create({
      data: {
        name: category,
        sortOrder: ci,
        items: {
          create: items.map((item, ii) => ({
            name: item.name,
            description: item.description,
            basePrice: item.basePrice,
            sortOrder: ii,
            optionGroups: {
              create: item.groups.map((g, gi) => ({
                name: g.name,
                required: g.required,
                maxSelect: g.maxSelect ?? 1,
                sortOrder: gi,
                options: {
                  create: g.options.map((o, oi) => ({
                    name: o.name,
                    extraPrice: o.extraPrice ?? 0,
                    sortOrder: oi,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }
  console.log("메뉴 seed 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
