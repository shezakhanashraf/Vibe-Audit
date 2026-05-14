"use client";

import { useEffect, useState } from "react";
import { CartResponse } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function CheckoutSummary() {
  const [cartData, setCartData] = useState<CartResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data) => setCartData(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/cart/clear", { method: "POST" });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="order-confirmation" style={{
        background: "#fff",
        borderRadius: "8px",
        padding: "32px",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <h2>Your order has been placed</h2>
        <p style={{ color: "#666" }}>Thank you for your purchase.</p>
        <a href="/" style={{ color: "#1a1a2e" }}>Continue shopping</a>
      </div>
    );
  }

  if (!cartData) return <div>Loading...</div>;

  return (
    <div className="checkout-summary">
      <h2>Order Summary</h2>
      <p>{cartData.itemCount} item(s)</p>
      <p className="checkout-total" style={{
        fontWeight: "bold",
        fontSize: "20px",
        margin: "16px 0",
      }}>
        Total: {formatCurrency(cartData.totalPrice)}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-name" style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            Name
          </label>
          <input id="checkout-name" type="text" required style={{
            width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd",
          }} />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-email" style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            Email
          </label>
          <input id="checkout-email" type="email" required style={{
            width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd",
          }} />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-address" style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            Address
          </label>
          <input id="checkout-address" type="text" required style={{
            width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd",
          }} />
        </div>
        <button id="checkout-submit" type="submit" style={{
          background: "#1a1a2e",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "12px 24px",
          cursor: "pointer",
          width: "100%",
          fontWeight: "bold",
          fontSize: "16px",
        }}>
          Place Order
        </button>
      </form>
    </div>
  );
}
