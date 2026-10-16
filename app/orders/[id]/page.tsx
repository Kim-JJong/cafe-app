import { Suspense } from "react";
import { Screen } from "../../_components/screen";
import { OrderStatusView } from "./order-status-view";

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Screen>
      <Suspense fallback={<p className="p-5 text-ink/50">불러오는 중…</p>}>
        <OrderStatusView params={params} />
      </Suspense>
    </Screen>
  );
}
