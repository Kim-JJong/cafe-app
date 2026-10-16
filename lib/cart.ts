"use client";

import { MAX_QUANTITY } from "@/lib/limits";
import { createLocalStore } from "@/lib/local-store";

/** 장바구니 한 줄. 가격은 표시용이며 주문 시 서버가 다시 계산한다. */
export type CartLine = {
  key: string; // 메뉴 + 옵션 조합이 같으면 같은 줄로 합침
  menuItemId: number;
  name: string;
  optionIds: number[];
  optionLabels: string[];
  unitPrice: number;
  quantity: number;
};

const cart = createLocalStore<CartLine[]>("cafe.cart", []);

export const useCart = cart.useValue;

export function addToCart(line: Omit<CartLine, "key">) {
  const optionIds = [...line.optionIds].sort((a, b) => a - b);
  const key = `${line.menuItemId}:${optionIds.join(",")}`;
  const lines = cart.read();
  const existing = lines.find((l) => l.key === key);

  cart.write(
    existing
      ? lines.map((l) =>
          l.key === key ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QUANTITY) } : l,
        )
      : [...lines, { ...line, optionIds, key }],
  );
}

export function setQuantity(key: string, quantity: number) {
  const q = Math.max(1, Math.min(quantity, MAX_QUANTITY));
  cart.write(cart.read().map((l) => (l.key === key ? { ...l, quantity: q } : l)));
}

export function removeFromCart(key: string) {
  cart.write(cart.read().filter((l) => l.key !== key));
}

export function clearCart() {
  cart.write([]);
}
