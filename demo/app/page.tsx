"use client";

import { products } from "@/lib/products";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";

export default function Home() {
  const { addItem, count } = useCart();

  return (
    <div>
      <h1 style={{ marginBottom: "8px" }}>Products</h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        Browse our catalog. {count > 0 && `${count} item(s) in cart.`}
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px",
      }}>
        {products.map((product) => (
          <div
            key={product.id}
            className="product-card"
            style={{
              background: "#fff",
              borderRadius: "8px",
              padding: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{
              background: "#e8e8e8",
              borderRadius: "4px",
              height: "120px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
              fontSize: "14px",
              color: "#999",
            }}>
              {product.name}
            </div>
            <div className="product-name" style={{ fontWeight: "bold", marginBottom: "4px" }}>
              {product.name}
            </div>
            <div style={{ color: "#666", fontSize: "14px", marginBottom: "8px" }}>
              {product.description}
            </div>
            <div className="product-price" style={{ fontWeight: "bold", color: "#1a1a2e", marginBottom: "12px" }}>
              {formatCurrency(product.price)}
            </div>
            <button
              className="add-to-cart"
              onClick={() => addItem(product.id)}
              style={{
                background: "#1a1a2e",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "8px 16px",
                cursor: "pointer",
                width: "100%",
              }}
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
