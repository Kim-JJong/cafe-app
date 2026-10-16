import { Suspense } from "react";
import { EditMenu } from "./edit-menu";

export default function EditMenuPage({ params }: PageProps<"/staff/menu/[id]">) {
  return (
    <Suspense fallback={<p className="py-10 text-ink/50">불러오는 중…</p>}>
      <EditMenu params={params} />
    </Suspense>
  );
}
