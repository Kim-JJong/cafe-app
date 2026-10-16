import { BottomBar, Screen } from "../_components/screen";
import { TabBar } from "../_components/tab-bar";
import { ProfileForm } from "./profile-form";

export default function MePage() {
  return (
    <Screen>
      <h1 className="px-5 py-3.5 text-lg font-semibold">내 정보</h1>
      <ProfileForm />
      <BottomBar>
        <TabBar />
      </BottomBar>
    </Screen>
  );
}
