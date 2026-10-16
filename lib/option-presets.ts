// 자주 쓰는 옵션 그룹. seed와 직원 메뉴 편집 화면의 "빠른 추가" 버튼이 함께 쓴다.
// "온도"의 "ICE"와 "얼음" 그룹 이름은 lib/option-rules.ts의 규칙(얼음은 ICE일 때만)과 맞아야 한다.

export type OptionPreset = {
  name: string;
  required: boolean;
  maxSelect: number;
  options: { name: string; extraPrice: number }[];
};

export const OPTION_PRESETS: OptionPreset[] = [
  { name: "온도", required: true, maxSelect: 1, options: [{ name: "HOT", extraPrice: 0 }, { name: "ICE", extraPrice: 0 }] },
  { name: "농도", required: false, maxSelect: 1, options: [{ name: "연하게", extraPrice: 0 }] },
  {
    name: "얼음",
    required: false,
    maxSelect: 1,
    options: [{ name: "얼음 많이", extraPrice: 0 }, { name: "얼음 적게", extraPrice: 0 }],
  },
  {
    name: "우유 변경",
    required: false,
    maxSelect: 1,
    options: [{ name: "락토프리 우유", extraPrice: 500 }, { name: "저지방 우유", extraPrice: 0 }],
  },
  {
    name: "크림",
    required: false,
    maxSelect: 1,
    options: [{ name: "크림 많이", extraPrice: 0 }, { name: "크림 적게", extraPrice: 0 }],
  },
];

export function getPreset(name: string) {
  const preset = OPTION_PRESETS.find((p) => p.name === name);
  if (!preset) throw new Error(`옵션 프리셋 없음: ${name}`);
  return preset;
}
