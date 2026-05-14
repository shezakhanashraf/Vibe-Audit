"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();

  // Demo: always redirect to login (no auth state)
  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return <p>Redirecting to login...</p>;
}
