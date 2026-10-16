import { Suspense } from "react";
import { Screen } from "../../_components/screen";
import { GroupRoomView } from "./group-room-view";

export default function GroupRoomPage({ params }: PageProps<"/group/[id]">) {
  return (
    <Screen>
      <Suspense fallback={<p className="p-5 text-ink/50">불러오는 중…</p>}>
        <GroupRoomView params={params} />
      </Suspense>
    </Screen>
  );
}
