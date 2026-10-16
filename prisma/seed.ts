import "dotenv/config";
import { getPreset, type OptionPreset } from "../lib/option-presets";
import { prisma } from "../lib/prisma";

type GroupSeed = OptionPreset;
type ItemSeed = { name: string; description?: string; basePrice: number; groups: GroupSeed[] };

const temperature = () => getPreset("온도");
const strength = () => getPreset("농도");
// 화면에서는 ICE를 골랐을 때만 보인다 (ICE 전용 메뉴는 항상)
const ice = () => getPreset("얼음");
// 우유가 들어가는 메뉴만
const milk = () => getPreset("우유 변경");
// 카페모카·초코라떼·바닐라라떼만
const cream = () => getPreset("크림");

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
