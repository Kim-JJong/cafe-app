import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getMenu } from "@/lib/menu";
import { formatWon } from "@/lib/price";
import { CartLink } from "./cart-link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-2xl font-bold">사내 카페</h1>
        <div className="flex items-center gap-3">
          <Link href="/orders" className="text-sm text-gray-500">
            내 주문
          </Link>
          <CartLink />
        </div>
      </header>
      <Suspense fallback={<p className="text-gray-500">메뉴를 불러오는 중…</p>}>
        <MenuList />
      </Suspense>
    </main>
  );
}

async function MenuList() {
  await connection(); // 품절 상태가 바로 반영되도록 매 요청마다 조회
  const categories = await getMenu();

  return (
    <>
      <nav className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-background px-4 py-3">
        {categories.map((c) => (
          <a
            key={c.id}
            href={`#category-${c.id}`}
            className="shrink-0 rounded-full border border-gray-300 px-4 py-1.5 text-sm"
          >
            {c.name}
          </a>
        ))}
      </nav>

      {categories.map((c) => (
        <section key={c.id} id={`category-${c.id}`} className="scroll-mt-16 pt-4">
          <h2 className="mb-2 text-lg font-semibold">{c.name}</h2>
          <ul className="divide-y divide-gray-500/30">
            {c.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/menu/${item.id}`}
                  className={`flex items-center justify-between py-4 ${item.isAvailable ? "" : "opacity-50"}`}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-gray-500">{item.description}</p>
                    )}
                  </div>
                  <span className="text-sm">
                    {item.isAvailable ? formatWon(item.basePrice) : "품절"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
