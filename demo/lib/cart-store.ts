import { CartItem } from "./types";

// Persist cart across Next.js dev-mode hot reloads by attaching to globalThis.
// In production this is just a regular in-memory store (resets on restart).
const globalStore = globalThis as unknown as { __vibeAuditCart?: CartItem[] };

function getItems(): CartItem[] {
  if (!globalStore.__vibeAuditCart) {
    globalStore.__vibeAuditCart = [];
  }
  return globalStore.__vibeAuditCart;
}

export function getCart() {
  const items = getItems();
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, totalPrice, itemCount };
}

export function addToCart(item: CartItem) {
  const items = getItems();
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    items.push({ ...item });
  }
  return getCart();
}

export function clearCart() {
  globalStore.__vibeAuditCart = [];
  return getCart();
}
