"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartLink() {
  const count = useCart().reduce((sum, l) => sum + l.quantity, 0);
  return (
    <Link href="/cart" className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background">
      장바구니{count > 0 && ` ${count}`}
    </Link>
  );
}
