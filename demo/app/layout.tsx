import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ShopApp",
  description: "Demo e-commerce app for Vibe Audit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f5" }}>
        <nav style={{
          background: "#1a1a2e",
          color: "#fff",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <a href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "20px", fontWeight: "bold" }}>
            ShopApp
          </a>
          <div style={{ display: "flex", gap: "16px" }}>
            <a href="/cart" style={{ color: "#ccc", textDecoration: "none" }} className="cart-icon">
              Cart <span className="cart-count" id="nav-cart-count"></span>
            </a>
            <a href="/login" style={{ color: "#ccc", textDecoration: "none" }}>Login</a>
          </div>
        </nav>
        <main style={{ maxWidth: "960px", margin: "0 auto", padding: "24px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
