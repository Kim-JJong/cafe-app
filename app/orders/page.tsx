import Link from "next/link";
import { MyOrders } from "./my-orders";

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
      <header className="py-5">
        <Link href="/" className="text-sm text-gray-500">
          ← 메뉴
        </Link>
        <h1 className="mt-2 text-2xl font-bold">내 주문</h1>
      </header>
      <MyOrders />
    </main>
  );
}
