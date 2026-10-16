import { connection } from "next/server";
import { Suspense } from "react";
import { getMenu } from "@/lib/menu";
import { BottomBar, Screen } from "./_components/screen";
import { TabBar } from "./_components/tab-bar";
import { CartBar } from "./cart-bar";
import { HomeHeader } from "./home-header";
import { MenuBrowser } from "./menu-browser";

export default function Home() {
  return (
    <Screen>
      <HomeHeader />
      <Suspense fallback={<p className="px-5 text-ink/50">메뉴를 불러오는 중…</p>}>
        <MenuSection />
      </Suspense>
      <BottomBar>
        <CartBar />
        <TabBar />
      </BottomBar>
    </Screen>
  );
}

async function MenuSection() {
  await connection(); // 품절 상태가 바로 반영되도록 매 요청마다 조회
  return <MenuBrowser categories={await getMenu()} />;
}
