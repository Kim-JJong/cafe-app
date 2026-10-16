import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMenuItem } from "@/lib/menu";
import { MenuOptionForm } from "./menu-option-form";

export default function MenuPage({ params }: PageProps<"/menu/[id]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10">
      <header className="py-5">
        <Link href="/" className="text-sm text-gray-500">
          ← 메뉴
        </Link>
      </header>
      <Suspense fallback={<p className="text-gray-500">불러오는 중…</p>}>
        <MenuDetail params={params} />
      </Suspense>
    </main>
  );
}

async function MenuDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const item = await getMenuItem(id);
  if (!item) notFound();

  return (
    <>
      <h1 className="text-2xl font-bold">{item.name}</h1>
      {item.description && <p className="mt-1 text-gray-500">{item.description}</p>}
      {item.isAvailable ? (
        <MenuOptionForm item={item} />
      ) : (
        <p className="mt-8 rounded-lg bg-gray-500/15 p-4 text-center text-gray-500">
          현재 품절된 메뉴입니다.
        </p>
      )}
    </>
  );
}
