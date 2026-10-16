import type { Prisma } from "@/app/generated/prisma/client";
import { AppError } from "@/lib/errors";

export type CustomerInput = { employeeNo: string; name: string };

/**
 * 현재 주문자를 Customer로 확정한다. (DESIGN.md §6)
 * 지금은 입력한 사번/이름을 쓰고, 로그인 도입 시 이 함수만 세션 기반으로 바꾼다.
 */
export async function resolveCustomer(tx: Prisma.TransactionClient, input: CustomerInput) {
  const existing = await tx.customer.findUnique({ where: { employeeNo: input.employeeNo } });
  if (!existing) {
    return tx.customer.create({ data: { employeeNo: input.employeeNo, name: input.name } });
  }
  if (existing.name !== input.name) {
    throw new AppError(400, "CUSTOMER_MISMATCH", "사번과 이름이 일치하지 않습니다.");
  }
  return existing;
}
