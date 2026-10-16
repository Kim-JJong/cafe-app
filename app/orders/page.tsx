import { BottomBar, Screen } from "../_components/screen";
import { TabBar } from "../_components/tab-bar";
import { MyOrders } from "./my-orders";

export default function OrdersPage() {
  return (
    <Screen>
      <h1 className="px-5 py-3.5 text-lg font-semibold">주문 내역</h1>
      <MyOrders />
      <BottomBar>
        <TabBar />
      </BottomBar>
    </Screen>
  );
}
