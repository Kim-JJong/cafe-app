import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { getMenu, getMenuItem, getMenuForStaff, setMenuItemFlags } from "@/lib/menu";
import { createMenuItem, parseMenuInput, updateMenuItem, type MenuInput } from "@/lib/menu-admin";
import { getPreset } from "@/lib/option-presets";
import { createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

beforeEach(async () => {
  await prisma.orderItemOption.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.groupItem.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.groupRoom.deleteMany();
  await prisma.option.deleteMany();
  await prisma.optionGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
});

afterAll(() => prisma.$disconnect());

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AppError && e.code === code);
}

function input(overrides: Partial<MenuInput> = {}): MenuInput {
  return parseMenuInput({
    name: "흑당라떼",
    description: "흑당 시럽",
    basePrice: 4000,
    newCategoryName: "시즌",
    optionGroups: [getPreset("온도"), getPreset("우유 변경")],
    ...overrides,
  });
}

describe("parseMenuInput", () => {
  const valid = { name: "라떼", basePrice: 3000, categoryId: 1, optionGroups: [] };
  const expectInvalid = (body: unknown) => expect(() => parseMenuInput(body)).toThrow(AppError);

  it("앞뒤 공백 제거, 빈 설명은 null", () => {
    expect(parseMenuInput({ ...valid, name: "  라떼 ", description: "  " })).toMatchObject({
      name: "라떼",
      description: null,
      categoryId: 1,
      newCategoryName: null,
    });
  });

  it("이름·가격·분류 검증", () => {
    expectInvalid({ ...valid, name: " " });
    expectInvalid({ ...valid, basePrice: -1 });
    expectInvalid({ ...valid, basePrice: 1.5 });
    expectInvalid({ ...valid, basePrice: 100_001 });
    expectInvalid({ ...valid, categoryId: undefined });
  });

  it("옵션 그룹 검증: 선택지 없음, 이름 중복, 최대 선택 수", () => {
    const group = { name: "온도", required: true, maxSelect: 1, options: [{ name: "HOT", extraPrice: 0 }] };
    expectInvalid({ ...valid, optionGroups: [{ ...group, options: [] }] });
    expectInvalid({ ...valid, optionGroups: [group, group] });
    expectInvalid({ ...valid, optionGroups: [{ ...group, options: [group.options[0], group.options[0]] }] });
    expectInvalid({ ...valid, optionGroups: [{ ...group, maxSelect: 2 }] });
    expectInvalid({ ...valid, optionGroups: [{ ...group, options: [{ name: "HOT", extraPrice: -100 }] }] });
  });
});

describe("createMenuItem", () => {
  it("새 분류와 함께 등록되고 손님 메뉴에 판매중으로 보인다", async () => {
    const item = await createMenuItem(input());
    const menu = await getMenu();
    expect(menu.map((c) => c.name)).toEqual(["시즌"]);
    expect(menu[0].items[0]).toMatchObject({ id: item.id, name: "흑당라떼", basePrice: 4000, isAvailable: true });
    expect(menu[0].items[0].optionGroups.map((g) => g.name)).toEqual(["온도", "우유 변경"]);
    expect(menu[0].items[0].optionGroups[1].options.map((o) => o.extraPrice)).toEqual([500, 0]);
  });

  it("같은 이름의 새 분류는 기존 분류를 쓰고, 메뉴는 분류 맨 뒤에 붙는다", async () => {
    await createMenuItem(input({ name: "A" }));
    await createMenuItem(input({ name: "B" }));
    const staff = await getMenuForStaff();
    expect(staff).toHaveLength(1);
    expect(staff[0].items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  it("없는 분류 ID는 거부", async () => {
    await expectAppError(createMenuItem(input({ newCategoryName: null, categoryId: 99999 })), "VALIDATION");
  });
});

describe("updateMenuItem", () => {
  it("가격·이름 수정, 남긴 옵션은 ID 유지, 새 옵션 추가, 빠진 옵션 삭제", async () => {
    const created = await createMenuItem(input());
    const before = (await getMenuItem(created.id))!;
    const [temp, milk] = before.optionGroups;
    const hot = temp.options[0];

    await updateMenuItem(
      created.id,
      input({
        name: "흑당 라떼",
        basePrice: 4500,
        optionGroups: [
          // 온도: HOT만 남기고 이름 유지, ICE 삭제, 새 선택지 추가
          {
            id: temp.id,
            name: "온도",
            required: true,
            maxSelect: 1,
            options: [
              { id: hot.id, name: "HOT", extraPrice: 0 },
              { name: "미지근", extraPrice: 0 },
            ],
          },
          // 우유 변경 그룹은 통째로 삭제, 크림 그룹 새로 추가
          getPreset("크림"),
        ],
      }),
    );

    const after = (await getMenuItem(created.id))!;
    expect(after).toMatchObject({ name: "흑당 라떼", basePrice: 4500 });
    expect(after.optionGroups.map((g) => g.name)).toEqual(["온도", "크림"]);
    expect(after.optionGroups[0].id).toBe(temp.id);
    expect(after.optionGroups[0].options.map((o) => [o.id === hot.id, o.name])).toEqual([
      [true, "HOT"],
      [false, "미지근"],
    ]);
    expect(await prisma.optionGroup.count({ where: { id: milk.id } })).toBe(0);
    expect(await prisma.option.count({ where: { optionGroupId: milk.id } })).toBe(0);
  });

  it("다른 메뉴의 옵션 ID로는 수정할 수 없다", async () => {
    const a = await createMenuItem(input({ name: "A" }));
    const b = (await getMenuItem((await createMenuItem(input({ name: "B" }))).id))!;
    const foreignGroup = b.optionGroups[0];
    await expectAppError(
      updateMenuItem(a.id, input({ optionGroups: [{ ...getPreset("온도"), id: foreignGroup.id }] })),
      "VALIDATION",
    );
  });

  it("분류를 옮기면 새 분류의 맨 뒤로 간다", async () => {
    const first = await createMenuItem(input({ name: "A", newCategoryName: "가" }));
    await createMenuItem(input({ name: "B", newCategoryName: "나" }));
    await updateMenuItem(first.id, input({ name: "A", newCategoryName: "나" }));
    const staff = await getMenuForStaff();
    expect(staff.find((c) => c.name === "나")?.items.map((i) => i.name)).toEqual(["B", "A"]);
  });

  it("없는 메뉴는 NOT_FOUND", async () => {
    await expectAppError(updateMenuItem(99999, input()), "NOT_FOUND");
  });
});

describe("숨기기", () => {
  it("숨긴 메뉴는 손님 메뉴·상세에서 빠지고 주문도 거부, 직원 목록에는 남는다", async () => {
    const item = await createMenuItem(input());
    const hot = (await getMenuItem(item.id))!.optionGroups[0].options[0];
    expect(await setMenuItemFlags(item.id, { isHidden: true })).toBe(true);

    expect(await getMenu()).toEqual([]); // 보일 메뉴가 없는 분류도 빠짐
    expect(await getMenuItem(item.id)).toBeNull();
    expect((await getMenuForStaff())[0].items[0]).toMatchObject({ id: item.id, isHidden: true });
    await expectAppError(
      createOrder({ employeeNo: "1", name: "김", items: [{ menuItemId: item.id, quantity: 1, optionIds: [hot.id] }] }),
      "VALIDATION",
    );

    await setMenuItemFlags(item.id, { isHidden: false });
    expect(await getMenuItem(item.id)).not.toBeNull();
  });
});
