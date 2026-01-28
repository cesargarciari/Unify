"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type ApiEventListItem = {
  id: string;
  title: string;
  location: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  tags: string[];
};

// addded typed rsvp, check, waitlist, and canceled.
type RsvpStatus =
  | "rsvped"
  | "checked_in"
  | "waitlisted"

  | "cancelled"
  | string;

type RsvpMap = Record<string, RsvpStatus>;

function formatRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);

  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return "Time TBA";
  }

  const datePart = s.toLocaleDateString();
  const startTime = s.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = e.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${datePart} • ${startTime} - ${endTime}`;
}

function getRsvpDisplay(status?: RsvpStatus) {
  if (!status || status === "cancelled") {
    return { label: "No", tone: "muted" as const };
  }
  if (status === "waitlisted") {
    return { label: "Waitlisted", tone: "waitlisted" as const };
  }
  if (status === "rsvped" || status === "checked_in") {
    return { label: "Yes", tone: "yes" as const };
  }
  // fallback for any future status
  return { label: status, tone: "muted" as const };
}

export default function EventsPage() {
  const [query, setQuery] = useState("");

  const [tag, setTag] = useState("All");
  const [sort, setSort] = useState("relevance");

  const [events, setEvents] = useState<ApiEventListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [rsvpMap, setRsvpMap] = useState<RsvpMap>({});

  // fetch events
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await api<ApiEventListItem[]>(
          "/api/events",
          {},

          false
        );
        if (alive) setEvents(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // current user's RSVP map
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await api<RsvpMap>("/api/rsvps/me/map", {}, true);
        if (alive && data && typeof data === "object") {
          setRsvpMap(data);
        }
      } catch {
        if (alive) setRsvpMap({});
      }
    })();

    return () => {
      alive = false;
    };
  }, []);



  // build tag list from real events so the filter always mattches backend data
  const TAGS = useMemo(() => {

    const s = new Set<string>();
    for (const e of events) {
      (e.tags ?? []).forEach((t) => s.add(t));
    }
    return ["All", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = events.filter((e) => {
      const matchesQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q);

      const matchesTag =
        tag === "All" || (e.tags ?? []).some((t) => t === tag);

      return matchesQuery && matchesTag;
    });

    if (sort === "title") {
      return [...base].sort((a, b) => a.title.localeCompare(b.title));
    }

    // "relevance" keeps backend order
    return base;
  }, [events, query, tag, sort]);

  
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8 text-foreground">
      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <Input
          placeholder="Browse events, clubs, keywords…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border-border text-foreground placeholder:text-muted-foreground"
        />

        <Select value={tag} onValueChange={(v) => setTag(v)}>
          <SelectTrigger className="border-border text-foreground">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {TAGS.map((t) => (
              <SelectItem
                key={t}
                value={t}
                className="text-foreground data-[highlighted]:bg-accent"
              >
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="border-border text-foreground">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem
              value="relevance"
              className="text-foreground data-[highlighted]:bg-accent"
            >
              Sort: Relevance
            </SelectItem>
            <SelectItem
              value="title"
              className="text-foreground data-[highlighted]:bg-accent"
            >
              Sort: Title
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading events...</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e) => {
                const rsvpStatus = rsvpMap[e.id];
                const display = getRsvpDisplay(rsvpStatus);

                const rsvpClass = cn(
                  "text-xs mt-2",
                  display.tone === "yes" && "text-green-500",
                  display.tone === "waitlisted" && "text-amber-500",
                  display.tone === "muted" && "text-muted-foreground"
                );

                return (
                  <Link key={e.id} href={`/events/${e.id}`} className="group">
                    <Card className="bg-card border-[#23304a] dark:bg-[#111723] overflow-hidden transition-colors hover:border-[#2b3a59] lift-on-hover">
                      <CardHeader className="pb-2">
                        <div className="text-xs text-muted-foreground mb-1">
                          {formatRange(e.starts_at, e.ends_at)}
                        </div>
                        <div className="font-semibold">{e.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.location}
                        </div>

                        {/* RSVP status line */}
                        <div className={rsvpClass}>
                          RSVP: {display.label}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-2">
                        <div className="flex gap-2 flex-wrap">
                          {(e.tags ?? []).map((t) => (
                            <span
                              key={`${e.id}-${t}`}
                              className="text-xs px-2 py-1 rounded-full border border-[#23304a] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="text-sm text-muted-foreground mt-4">
                No events match your filters.
              </div>
            )}

            <div className="text-sm text-muted-foreground mt-4">
              {`Showing ${filtered.length} event${
                filtered.length !== 1 ? "s" : ""
              }`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
