import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMenuItem } from "@/lib/menu";
import { formatWon } from "@/lib/price";
import { MenuPhoto } from "../../_components/menu-photo";
import { Screen } from "../../_components/screen";
import { MenuOptionForm } from "./menu-option-form";

export default function MenuPage({ params }: PageProps<"/menu/[id]">) {
  return (
    <Screen>
      <Suspense fallback={<p className="p-5 text-ink/50">불러오는 중…</p>}>
        <MenuDetail params={params} />
      </Suspense>
    </Screen>
  );
}

async function MenuDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const item = await getMenuItem(id);
  if (!item) notFound();

  return (
    <>
      <div className="relative">
        <MenuPhoto url={item.imageUrl} className="h-[196px] w-full" />
        <Link
          href="/"
          aria-label="메뉴로 돌아가기"
          className="absolute top-3.5 left-4 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/90 text-base"
        >
          ‹
        </Link>
      </div>
      <div className="px-5 pt-[18px]">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[21px] font-semibold">{item.name}</h1>
          <span className="text-[17px] font-bold">{formatWon(item.basePrice)}</span>
        </div>
        {item.description && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/55">{item.description}</p>
        )}
      </div>
      {item.isAvailable ? (
        <MenuOptionForm item={item} />
      ) : (
        <p className="mx-5 mt-8 rounded-2xl bg-surface p-4 text-center text-sm text-ink/55">
          오늘 준비된 수량이 모두 소진되었습니다.
        </p>
      )}
    </>
  );
}
