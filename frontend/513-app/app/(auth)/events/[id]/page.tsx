"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ApiEventDetail = {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  is_public: boolean;
  tags: string[];
  capacity?: number | null;
};

// added rsvpstatus to save later to db.

type RsvpStatus = "rsvped" | "checked_in" | "waitlisted" | "cancelled" | string;

type ApiRSVP = {
  id: string;
  user_id: string;

  event_id: string;

  status: RsvpStatus;

  created_at: string;
};

function extractErrorMessage(err: unknown) {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.detail) return String(parsed.detail);
    } catch {
      // ignore
    }
    return err.message || "Request failed";
  }
  return "Request failed";
}


export default function EventDetails() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [event, setEvent] = useState<ApiEventDetail | null>(null);

  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(null);
  const [loadingRsvp, setLoadingRsvp] = useState(true);

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isYes = useMemo(
    () => rsvpStatus === "rsvped" || rsvpStatus === "checked_in",
    [rsvpStatus]
  );

  // Load event
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await api<ApiEventDetail>(`/api/events/${id}`);
        if (alive) setEvent(data);
      } catch {
        if (alive) setEvent(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  //load my RSVP for this event
  useEffect(() => {
    let alive = true;
    setLoadingRsvp(true);

    (async () => {
      try {
        const data = await api<ApiRSVP | null>(
          `/api/rsvps/me/${id}`,
          {},
          true
        );
        if (alive) setRsvpStatus(data?.status ?? null);
      } catch {
        if (alive) setRsvpStatus(null);
      } finally {
        if (alive) setLoadingRsvp(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function toggleRSVP() {
    setSaving(true);
    setActionError(null);

    const nextStatus: RsvpStatus = isYes ? "cancelled" : "rsvped";

    try {
      const data = await api<ApiRSVP>(
        "/api/rsvps",
        {
          method: "POST",
          body: JSON.stringify({
            event_id: id,
            status: nextStatus,
          }),
        },
        true
      );

      setRsvpStatus(data.status);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!event) return <div className="p-6">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-foreground space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Event Details</h1>
        <Button variant="outline" onClick={() => router.push("/events")}>
          ← Back to Events
        </Button>
      </div>

      {/* Event details WITH embedded RSVP */}
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-3">
          <div className="text-xl font-semibold">{event.title}</div>
          <div className="text-sm text-muted-foreground">{event.location}</div>
          <div className="text-sm text-muted-foreground">
            {new Date(event.starts_at).toLocaleString()} —{" "}
            {new Date(event.ends_at).toLocaleString()}
          </div>

          {!!event.tags?.length && (
            <div className="flex flex-wrap gap-2 pt-1">
              {event.tags.map((t) => (
                <span
                  key={`${event.id}-${t}`}
                  className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-1">
            Capacity: {event.capacity ?? "Unlimited"}
          </div>

          <p className="pt-2">{event.description}</p>

          {/* Embedded RSVP row */}
          <div className="pt-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Button
                onClick={toggleRSVP}
                disabled={saving || loadingRsvp}
                className={cn(
                  isYes && "bg-green-600 hover:bg-green-600/90 text-white"
                )}
                variant={isYes ? "default" : "outline"}
              >
                {saving ? "Saving..." : isYes ? "Un-RSVP" : "RSVP"}
              </Button>

              {loadingRsvp && (
                <span className="text-xs text-muted-foreground">
                  Loading your RSVP...
                </span>
              )}

              {!loadingRsvp && (
                <span
                  className={cn(
                    "text-sm",
                    isYes ? "text-green-500" : "text-muted-foreground"
                  )}
                >
                  {isYes ? "You are RSVP’d" : "Not RSVP’d"}
                </span>
              )}
            </div>

            {/* Only show errors from a user action */}
            {actionError && (
              <div className="text-sm text-red-500">{actionError}</div>
            )}

            <div className="text-xs text-muted-foreground">
              If the event is at capacity, the server will block new RSVPs.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
