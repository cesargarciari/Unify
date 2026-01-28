"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { api, getToken } from "@/lib/apiClient";

type Status = "upcoming" | "past" | "draft";

type UserRole = "student" | "organizer" | "admin";

type CurrentUser = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
};

type BackendEventListItem = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  ends_at: string;
  tags: string[];
};

type MyEvent = {
  id: string;
  title: string;
  location: string;
  startsAt: string;   
  endsAt: string;     
  status: Status;
  rsvp?: { count: number; capacity?: number };
  paid?: boolean;
  notes?: string;
};

function fmtDateRange(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);

  const shortMonth = s.toLocaleString(undefined, { month: "short" });
  const day = s.getDate();
  const sTime = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const eTime = e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return `${shortMonth} ${day} • ${sTime}–${eTime}`;
}

function fillPercent(e: MyEvent) {
  const c = e.rsvp?.count ?? 0;
  const cap = e.rsvp?.capacity ?? 0;
  if (!cap) return null;
  return Math.round((c / cap) * 100);
}

export default function OrganizerPage() {
  const [segment, setSegment] = useState<Status>("upcoming");
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushLoadingId, setPushLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Not logged in → send to auth
      window.location.replace("/auth?from=organizer");
      return;
    }

    async function load() {
      try {
        setError(null);
        setLoading(true);

        const me = await api<CurrentUser>("/api/auth/me", {}, true);

        if (me.role !== "organizer" && me.role !== "admin") {
          setError("Only organizers can view this page.");
          setEvents([]);
          return;
        }

        const data = await api<BackendEventListItem[]>(
          "/api/organizer/events",
          {},
          true
        );

        const now = new Date();

        const mapped: MyEvent[] = data.map((ev) => {
          const ends = new Date(ev.ends_at);

          let status: Status;
          if (ends.getTime() < now.getTime()) {
            status = "past";
          } else {
            status = "upcoming";
          }

          return {
            id: ev.id,
            title: ev.title,
            location: ev.location,
            startsAt: ev.starts_at,
            endsAt: ev.ends_at,
            status,
            // rsvp / paid / notes can come later from backend if needed
          };
        });

        setEvents(mapped);
      } catch (err: any) {
        console.error("Failed to load organizer events", err);
        setError(err?.message ?? "Failed to load your events.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return events
      .filter((ev) => ev.status === segment)
      .filter((ev) => {
        if (!query) return true;
        return (
          ev.title.toLowerCase().includes(query) ||
          ev.location.toLowerCase().includes(query) ||
          (ev.notes ?? "").toLowerCase().includes(query)
        );
      });
  }, [events, segment, q]);

  function exportCSV() {
    const rows = [
      ["id", "title", "location", "startsAt", "endsAt", "status", "rsvpCount", "capacity", "paid"],
      ...filtered.map((e) => [
        e.id,
        e.title,
        e.location,
        e.startsAt,
        e.endsAt,
        e.status,
        String(e.rsvp?.count ?? ""),
        String(e.rsvp?.capacity ?? ""),
        e.paid ? "yes" : "no",
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-events-${segment}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function handleSendPush(eventId: string) {
    if (pushLoadingId) return;
  
    setPushLoadingId(eventId);
  
    try {
      const res = await api<{ sent: number }>(
        `/api/organizer/events/${eventId}/send-push`,
        { method: "POST" },
        true
      );
  
      const count = res?.sent ?? 0;
  
      if (count === 0) {
        alert("No RSVP’d attendees to notify yet.");
      } else {
        alert(`Sent reminder to ${count} attendee${count === 1 ? "" : "s"}.`);
      }
    } catch (err: any) {
      alert(err?.message ?? "Failed to send push");
    } finally {
      setPushLoadingId(null);
    }
  }
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading your events…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold">Organizer — My Events</div>
        </div>
        <div className="flex gap-2">
          <Button className="bg-primary text-primary-foreground hover:opacity-90" asChild>
            <Link href="/organizer/events/new">+ New event</Link>
          </Button>
          <Button
            variant="outline"
            className="border-border hover:bg-accent"
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </Card>
      )}

      <Card className="bg-card border border-border">
        <div className="grid grid-cols-1 items-center gap-3 p-3 md:grid-cols-[1fr_auto_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className="text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your hosted events…"
              className="h-8 border-none bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
            />
          </label>

          <Tabs value={segment} onValueChange={(v) => setSegment(v as Status)}>
            <TabsList className="h-9 rounded-md border border-border bg-muted">
              <TabsTrigger
                value="upcoming"
                className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
              >
                Upcoming
              </TabsTrigger>
              <TabsTrigger
                value="past"
                className="data-[state=active]:bg-accent data-[state=active]:text-foreground"
              >
                Past
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="justify-self-end text-sm text-muted-foreground">
            Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </Card>

      <Card className="bg-card border border-border">
        <div className="grid gap-3 p-3">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No events in this segment yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e) => {
                const pct = fillPercent(e);
                return (
                  <div
                    key={e.id}
                    className="grid overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border bg-background"
                  >
                    <div className="relative h-[120px] bg-linear-to-br from-(--profile-img-from) to-(--profile-img-to)">
                      <span className="absolute left-2 top-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                        {e.status === "draft"
                          ? "Draft"
                          : fmtDateRange(e.startsAt, e.endsAt)}
                      </span>
                    </div>

                    <div className="grid gap-2 p-3">
                      <div className="text-base font-semibold">{e.title}</div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{e.location}</span>
                        {e.rsvp && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                            {e.rsvp.count}{" "}
                            {e.rsvp.capacity ? `/ ${e.rsvp.capacity}` : ""} RSVP
                          </span>
                        )}
                        {typeof pct === "number" && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                            Fill: {pct}%
                          </span>
                        )}
                        {e.paid && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                            Entry: Paid
                          </span>
                        )}
                      </div>
                    </div>
                    {e.notes && (
                      <div className="px-3 pb-3 text-sm text-muted-foreground">
                        {e.notes}
                      </div>
                    )}

                    <div className="flex gap-2 p-3 pt-0">
                      {e.status !== "draft" ? (
                        <>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="border-border hover:bg-accent"
                          >
                            <Link href={`/organizer/events/${e.id}?edit=1`}>
                              Edit
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border hover:bg-accent"
                            onClick={() => handleSendPush(e.id)}
                            disabled={pushLoadingId === e.id}
                          >
                            {pushLoadingId === e.id ? "Sending..." : "Send push"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border hover:bg-accent"
                            onClick={() => {
                              const base =
                                typeof window !== "undefined"
                                  ? window.location.origin
                                  : "";
                              navigator.clipboard.writeText(
                                `${base}/events/${e.id}`
                              );
                            }}
                          >
                            Copy link
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            asChild
                            size="sm"
                            className="bg-primary text-primary-foreground hover:opacity-90"
                          >
                            <Link href={`/organizer/events/${e.id}?edit=1`}>
                              Edit
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border hover:bg-accent"
                            onClick={() => alert("Preview (mock)")}
                          >
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="hover:opacity-90"
                            onClick={() =>
                              confirm("Delete this draft?") &&
                              alert("Deleted (mock)")
                            }
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
