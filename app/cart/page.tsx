import Link from "next/link";
import { CartView } from "./cart-view";

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
      <header className="py-5">
        <Link href="/" className="text-sm text-gray-500">
          ← 메뉴
        </Link>
        <h1 className="mt-2 text-2xl font-bold">장바구니</h1>
      </header>
      <CartView />
    </main>
  );
}
