import { connection } from "next/server";
import { getMenu } from "@/lib/menu";

export async function GET() {
  await connection(); // 품절 상태가 바로 반영되도록 매 요청마다 조회
  return Response.json(await getMenu());
}
