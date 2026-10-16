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
const strength = (): GroupSeed => ({
  name: "농도",
  required: false,
  options: [{ name: "연하게" }],
});
// 화면에서는 ICE를 골랐을 때만 보인다 (ICE 전용 메뉴는 항상)
const ice = (): GroupSeed => ({
  name: "얼음",
  required: false,
  options: [{ name: "얼음 많이" }, { name: "얼음 적게" }],
});

// 우유가 들어가는 메뉴만
const milk = (): GroupSeed => ({
  name: "우유 변경",
  required: false,
  options: [{ name: "락토프리 우유", extraPrice: 500 }, { name: "저지방 우유" }],
});
// 카페모카·초코라떼·바닐라라떼만
const cream = (): GroupSeed => ({
  name: "크림",
  required: false,
  options: [{ name: "크림 많이" }, { name: "크림 적게" }],
});

// 온도만 필수, 나머지는 모두 선택
const hotOrIce = (...extra: GroupSeed[]) => [temperature(), strength(), ice(), ...extra];

const menu: { category: string; items: ItemSeed[] }[] = [
  {
    category: "커피",
    items: [
      { name: "아메리카노", basePrice: 2500, groups: hotOrIce() },
      { name: "카페라떼", basePrice: 3000, groups: hotOrIce(milk()) },
      { name: "바닐라라떼", basePrice: 3500, groups: hotOrIce(milk(), cream()) },
      { name: "카페모카", basePrice: 3500, groups: hotOrIce(milk(), cream()) },
    ],
  },
  {
    category: "논커피",
    items: [
      { name: "초코라떼", basePrice: 3000, groups: hotOrIce(milk(), cream()) },
      { name: "녹차라떼", basePrice: 3000, groups: hotOrIce(milk()) },
    ],
  },
  {
    category: "티",
    items: [
      { name: "캐모마일", basePrice: 2500, groups: hotOrIce() },
      { name: "얼그레이", basePrice: 2500, groups: hotOrIce() },
    ],
  },
  {
    category: "에이드",
    items: [{ name: "레몬에이드", description: "ICE 전용", basePrice: 3500, groups: [ice()] }],
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
