import { connection } from "next/server";
import { Suspense } from "react";
import { getMenu } from "@/lib/menu";
import { MenuBrowser } from "../../../menu-browser";
import { BackHeader, Screen } from "../../../_components/screen";

/** 단체 주문 방에 담을 음료 고르기 */
export default function GroupMenuPage({ params }: PageProps<"/group/[id]/menu">) {
  return (
    <Screen>
      <Suspense fallback={<p className="p-5 text-ink/50">메뉴를 불러오는 중…</p>}>
        <GroupMenu params={params} />
      </Suspense>
    </Screen>
  );
}

async function GroupMenu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection(); // 품절 상태가 바로 반영되도록 매 요청마다 조회
  return (
    <>
      <BackHeader href={`/group/${id}`} title="단체 주문에 담기" />
      <MenuBrowser categories={await getMenu()} groupId={id} />
    </>
  );
}
