import { connection } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { getMenuForStaff } from "@/lib/menu";
import { createMenuItem, parseMenuInput } from "@/lib/menu-admin";
import { requireStaff } from "@/lib/staff-auth";

/** 메뉴 관리 목록: 숨긴 메뉴·빈 분류 포함 */
export async function GET() {
  await connection(); // 아래 catch가 프리렌더 중단 신호를 삼키지 않도록 먼저 동적 라우트로 지정
  try {
    await requireStaff();
    return Response.json(await getMenuForStaff());
  } catch (e) {
    return errorResponse(e);
  }
}

/** 신메뉴 등록 */
export async function POST(request: Request) {
  try {
    await requireStaff();
    const body = await request.json().catch(() => {
      throw new AppError(400, "VALIDATION", "요청 형식이 올바르지 않습니다.");
    });
    const item = await createMenuItem(parseMenuInput(body));
    return Response.json({ id: item.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
