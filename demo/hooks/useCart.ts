"use client";

import { useState, useEffect, useCallback } from "react";
import { CartItem } from "@/lib/types";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items);
        setTotal(data.totalPrice);
        setCount(data.itemCount);
      });
  }, []);

  useEffect(() => {
    refresh();

    // Re-fetch when user navigates back to this page
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const addItem = useCallback(
    async (productId: string) => {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      refresh();
    },
    [refresh]
  );

  return { items, total, count, addItem, refresh };
}
