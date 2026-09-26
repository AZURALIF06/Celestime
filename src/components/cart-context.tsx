"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCartId } from "@/lib/editor";

interface CartCtx {
  cartId: string;
  count: number;
  total: number;
  ready: boolean;
  refresh: () => void;
}

const Ctx = createContext<CartCtx>({ cartId: "", count: 0, total: 0, ready: false, refresh: () => {} });

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartId, setCartId] = useState("");
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCartId(getCartId());
  }, []);

  const refresh = useCallback(() => {
    if (!cartId) return;
    fetch(`/api/cart?cartId=${encodeURIComponent(cartId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.items)) {
          setCount(d.items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0));
          setTotal(d.price?.total ?? 0);
        } else {
          setCount(0);
          setTotal(0);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [cartId]);

  useEffect(() => {
    if (cartId) refresh();
  }, [cartId, refresh]);

  const value = useMemo(() => ({ cartId, count, total, ready, refresh }), [cartId, count, total, ready, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  return useContext(Ctx);
}
