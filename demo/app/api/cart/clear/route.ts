import { NextResponse } from "next/server";
import { clearCart } from "@/lib/cart-store";

export async function POST() {
  const cart = clearCart();
  return NextResponse.json({
    items: cart.items,
    totalPrice: cart.totalPrice,
    itemCount: cart.itemCount,
  });
}
