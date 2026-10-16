import type { NextRequest } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { createOrder, listOrdersByEmployee, parseOrderInput } from "@/lib/orders";

export async function GET(request: NextRequest) {
  const employeeNo = request.nextUrl.searchParams.get("employeeNo")?.trim();
  if (!employeeNo) {
    return errorResponse(new AppError(400, "VALIDATION", "사번이 필요합니다."));
  }
  return Response.json(await listOrdersByEmployee(employeeNo));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new AppError(400, "VALIDATION", "요청 형식이 올바르지 않습니다.");
    });
    const order = await createOrder(parseOrderInput(body));
    return Response.json(
      { id: order.id, orderNumber: order.orderNumber, totalPrice: order.totalPrice },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
