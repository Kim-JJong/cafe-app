import { Suspense } from "react";
import { SettlementView } from "./settlement-view";

export default function SettlementPage() {
  return (
    <Suspense fallback={<p className="py-10 text-gray-500">불러오는 중…</p>}>
      <SettlementView />
    </Suspense>
  );
}
