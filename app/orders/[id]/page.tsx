import Link from "next/link";
import { Suspense } from "react";
import { OrderStatusView } from "./order-status-view";

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
      <header className="flex justify-between py-5 text-sm text-gray-500">
        <Link href="/">← 메뉴</Link>
        <Link href="/orders">내 주문</Link>
      </header>
      <Suspense fallback={<p className="text-gray-500">불러오는 중…</p>}>
        <OrderStatusView params={params} />
      </Suspense>
    </main>
  );
}
