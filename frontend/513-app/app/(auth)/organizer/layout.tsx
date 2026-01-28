"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, clearToken } from "@/lib/apiClient";

type Me = {
  id: string;
  email: string;
  display_name: string;
  role: "student" | "organizer" | string;
};

export default function OrganizerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }

    (async () => {
      try {
        const me = await api<Me>("/api/auth/me", { method: "GET" }, true);
        if (me.role !== "organizer") {
          router.replace("/events?forbidden=organizer");
          return;
        }
        setChecking(false); 
      } catch {

        clearToken();
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      }
    })();
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
