"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: any credentials work
    setError("");
    window.location.href = "/";
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto" }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="login-email" style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            Email
          </label>
          <input id="login-email" type="email" required style={{
            width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd",
          }} />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="login-password" style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>
            Password
          </label>
          <input id="login-password" type="password" required style={{
            width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd",
          }} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" style={{
          background: "#1a1a2e",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          padding: "12px 24px",
          cursor: "pointer",
          width: "100%",
          fontWeight: "bold",
        }}>
          Log in
        </button>
      </form>
    </div>
  );
}
