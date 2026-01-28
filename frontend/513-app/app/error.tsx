"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void; // re-render the route segment
}) {
  useEffect(() => {
    // Send to your logging service if you have one
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred. You can try again, or head back home.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => reset()} className="bg-primary text-primary-foreground hover:opacity-90">
              Try again
            </Button>
            <Button variant="outline" className="border-border" asChild>
              <Link href="/events">Go to Events</Link>
            </Button>
            <Button variant="ghost" asChild>
              <a href={`mailto:support@example.com?subject=Unify%20Error&body=Digest:%20${error.digest ?? "n/a"}`}>
                Report issue
              </a>
            </Button>
          </div>

          {process.env.NODE_ENV !== "production" && (
            <pre className="mt-6 max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 text-xs">
              {error.message}
            </pre>
          )}
        </div>
      </body>
    </html>
  );
}
