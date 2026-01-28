"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getToken } from "@/lib/apiClient";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      // avoid any weird self-looping edge cases
      if (pathname !== "/auth") router.replace("/auth");
      setReady(false);
      return;
    }

    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Redirecting...
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="app-surface min-h-screen">{children}</main>
    </>
  );
}
