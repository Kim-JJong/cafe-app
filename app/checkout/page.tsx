import { BackHeader, Screen } from "../_components/screen";
import { CheckoutView } from "./checkout-view";

export default function CheckoutPage() {
  return (
    <Screen>
      <BackHeader href="/cart" title="주문 확인" />
      <CheckoutView />
    </Screen>
  );
}
