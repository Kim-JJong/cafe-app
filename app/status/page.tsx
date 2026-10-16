import { BottomBar, Screen } from "../_components/screen";
import { TabBar } from "../_components/tab-bar";
import { CurrentOrder } from "./current-order";

export default function StatusPage() {
  return (
    <Screen>
      <h1 className="px-5 py-3.5 text-lg font-semibold">주문 현황</h1>
      <CurrentOrder />
      <BottomBar>
        <TabBar />
      </BottomBar>
    </Screen>
  );
}
