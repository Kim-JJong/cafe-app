import { describe, expect, it } from "vitest";
import { calcUnitPrice, formatWon } from "@/lib/price";
import { kstBusinessDate } from "@/lib/time";

const item = {
  basePrice: 2500,
  optionGroups: [
    { options: [{ id: 1, extraPrice: 0 }, { id: 2, extraPrice: 0 }] },
    { options: [{ id: 3, extraPrice: 0 }, { id: 4, extraPrice: 500 }] },
    { options: [{ id: 5, extraPrice: 500 }] },
  ],
};

describe("calcUnitPrice", () => {
  it("옵션이 없으면 기본가", () => {
    expect(calcUnitPrice(item, [])).toBe(2500);
  });

  it("선택한 옵션의 추가금을 더한다", () => {
    expect(calcUnitPrice(item, [2, 4, 5])).toBe(3500);
  });

  it("이 메뉴에 없는 옵션 ID는 무시한다", () => {
    expect(calcUnitPrice(item, [999])).toBe(2500);
  });
});

describe("formatWon", () => {
  it("천 단위 구분", () => {
    expect(formatWon(12500)).toBe("12,500원");
  });
});

describe("kstBusinessDate", () => {
  it("UTC 14:59는 KST 같은 날 23:59", () => {
    expect(kstBusinessDate(new Date("2026-10-16T14:59:59Z"))).toBe("2026-10-16");
  });

  it("UTC 15:00은 KST 다음 날 00:00", () => {
    expect(kstBusinessDate(new Date("2026-10-16T15:00:00Z"))).toBe("2026-10-17");
  });

  it("월말 경계", () => {
    expect(kstBusinessDate(new Date("2026-10-31T15:00:00Z"))).toBe("2026-11-01");
  });
});
