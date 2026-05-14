"use client";

import { useCart } from "@/hooks/useCart";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, total, count } = useCart();

  return (
    <div>
      <h1>Your Cart ({count} items)</h1>
      {items.length === 0 ? (
        <p style={{ color: "#666" }}>Your cart is empty. <a href="/">Browse products</a></p>
      ) : (
        <>
          <div className="cart-items" style={{ marginBottom: "24px" }}>
            {items.map((item) => (
              <div
                key={item.productId}
                className="cart-item"
                style={{
                  background: "#fff",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <div>
                  <div style={{ fontWeight: "bold" }}>{item.name}</div>
                  <div style={{ color: "#666", fontSize: "14px" }}>
                    Qty: {item.quantity} x {formatCurrency(item.price)}
                  </div>
                </div>
                <div style={{ fontWeight: "bold" }}>
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
          <div
            className="cart-total"
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "16px",
              fontWeight: "bold",
              fontSize: "18px",
              textAlign: "right",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            Total: {formatCurrency(total)}
          </div>
          <a
            href="/checkout"
            id="proceed-to-checkout"
            style={{
              display: "block",
              background: "#1a1a2e",
              color: "#fff",
              textAlign: "center",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "16px",
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            Proceed to Checkout
          </a>
        </>
      )}
    </div>
  );
}
