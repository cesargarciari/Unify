"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearToken } from "@/lib/apiClient";

export function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/auth?from=logout");
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Log out
    </Button>
  );
}
