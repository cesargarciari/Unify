"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, getToken } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type ApiNotification = {
  id: string;
  user_id: string;
  event_id?: string | null;
  kind: "rsvp" | "reminder" | string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string; //
  read_at?: string | null;
};



function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleString();
}

export default function NotificationsPage() {
  //we treat this tab as an "inbox" of unread item
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.replace("/auth?from=notifications");
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);
        const data = await api<ApiNotification[]>(
          "/api/notifications/me",
          {},
          true
        );
        if (!alive) return;

        const list = Array.isArray(data) ? data : [];

        //here we only show unread notifications so "Mark All Read" truly clears the tab.
        setNotifications(list.filter((n) => !n.is_read));
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Failed to load notifications");
        setNotifications([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  async function markAllRead() {
    if (markingAll) return;

    setMarkingAll(true);
    setError(null);

    try {
      await api<{ updated: number }>(
        "/api/notifications/me/mark-all-read",
        { method: "POST" },
        true
      );

      setNotifications([]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  async function markOneRead(n: ApiNotification) {
    try {
      await api<ApiNotification>(
        `/api/notifications/${n.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_read: true }),
        },
        true
      );

      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    } catch {
      // Non-blocking
    }
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Notifications</h1>
            <p className="text-muted-foreground text-lg">
              Stay updated with your events and activities
            </p>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread
              </p>
            )}
          </div>

          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={markingAll || loading || notifications.length === 0}
          >
            {markingAll ? "Clearing..." : "Mark All Read"}
          </Button>
        </div>

        {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

        <div className="space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                onClick={() => markOneRead(notification)}
                className={cn(
                  "transition-colors cursor-pointer hover:bg-muted/50",
                  "bg-blue-500/5 border-blue-500/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm">
                          {notification.title}
                        </h3>
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {!loading && notifications.length === 0 && (
          <Card className="mt-4">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No notifications yet. We&apos;ll notify you when something happens!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
