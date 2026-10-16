import { BackHeader, Screen } from "../_components/screen";
import { CartView } from "./cart-view";

export default function CartPage() {
  return (
    <Screen>
      <BackHeader href="/" title="장바구니" />
      <CartView />
    </Screen>
  );
}
