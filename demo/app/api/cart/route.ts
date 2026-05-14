import { NextRequest, NextResponse } from "next/server";
import { getCart, addToCart } from "@/lib/cart-store";
import { products } from "@/lib/products";

export async function GET() {
  const cart = getCart();
  return NextResponse.json({
    items: cart.items,
    totalPrice: cart.totalPrice,
    itemCount: cart.itemCount,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const product = products.find((p) => p.id === body.productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const cart = addToCart({
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: body.quantity || 1,
  });

  return NextResponse.json({
    items: cart.items,
    totalPrice: cart.totalPrice,
    itemCount: cart.itemCount,
  });
}
