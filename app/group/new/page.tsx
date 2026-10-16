import { BackHeader, Screen } from "../../_components/screen";
import { CreateRoomForm } from "./create-room-form";

export default function NewGroupPage() {
  return (
    <Screen>
      <BackHeader href="/" title="단체 주문 만들기" />
      <CreateRoomForm />
    </Screen>
  );
}
