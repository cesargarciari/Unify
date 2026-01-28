"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";

import { api, getToken } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type UserRole = "student" | "organizer" | "admin";

type CurrentUser = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
};

type BackendEventDetail = {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  capacity: number | null;
  is_public: boolean;
  organization_id: string | null;
  tags: string[];
};

type EventUpdatePayload = {
  title?: string;
  description?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  capacity?: number | null;
  is_public?: boolean;
  organization_id?: string | null;
  tags?: string[];
};

function fmtDateRange(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const shortMonth = s.toLocaleString(undefined, { month: "short" });
  const day = s.getDate();
  const sTime = s.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const eTime = e.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${shortMonth} ${day} • ${sTime}–${eTime}`;
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrganizerEventDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const id = params?.id; // 👈 dynamic segment from URL

  const editFromQuery = searchParams.get("edit") === "1";

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [event, setEvent] = useState<BackendEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(editFromQuery);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    setEditMode(editFromQuery);
  }, [editFromQuery]);

  // Load user + event
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/auth?from=organizer-event");
      return;
    }

    // Don't try to fetch until we actually have an id from the URL
    if (!id) {
      setLoading(false);
      setError("Invalid event ID.");
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const me = await api<CurrentUser>("/api/auth/me", {}, true);
        if (me.role !== "organizer" && me.role !== "admin") {
          setError("Only organizers can access this page.");
          setLoading(false);
          return;
        }
        setUser(me);

        const ev = await api<BackendEventDetail>(
          `/api/organizer/events/${id}`,
          {},
          true
        );
        setEvent(ev);

        // Prefill form
        setTitle(ev.title);
        setDescription(ev.description);
        setLocation(ev.location);
        setStartsAt(toLocalInputValue(ev.starts_at));
        setEndsAt(toLocalInputValue(ev.ends_at));
        setCapacity(ev.capacity != null ? String(ev.capacity) : "");
        setIsPublic(ev.is_public);
        setTagsInput(ev.tags.join(", "));
      } catch (err: any) {
        console.error("Failed to load event", err);
        setError(err?.message ?? "Failed to load event.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, router]);

  const dateRange = useMemo(() => {
    if (!event) return "";
    return fmtDateRange(event.starts_at, event.ends_at);
  }, [event]);

  function buildUpdatePayload(): EventUpdatePayload {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const startsIso = startsAt ? new Date(startsAt).toISOString() : undefined;
    const endsIso = endsAt ? new Date(endsAt).toISOString() : undefined;

    return {
      title,
      description,
      location,
      starts_at: startsIso,
      ends_at: endsIso,
      capacity: capacity ? Number(capacity) : null,
      is_public: isPublic,
      organization_id: event?.organization_id ?? null,
      tags,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError(null);
    setSuccess(null);

    if (!title || !description || !location || !startsAt || !endsAt) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);
      const payload = buildUpdatePayload();

      const updated = await api<BackendEventDetail>(
        `/api/organizer/events/${event.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        true
      );

      setEvent(updated);
      setSuccess("Changes saved.");
      setEditMode(false);
      router.replace(`/organizer/events/${event.id}`); // drop ?edit=1 from URL
    } catch (err: any) {
      console.error("Update event error", err);
      setError(err?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading event…</p>
      </main>
    );
  }

  if (!event || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{error ?? "Event not found."}</p>
      </main>
    );
  }

  if (!editMode) {
    // VIEW MODE
    return (
      <main className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
        <div className="w-full max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{event.title}</h1>
              <p className="text-sm text-muted-foreground">
                {dateRange} • {event.location}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push("/organizer")}>
                Back to my events
              </Button>
              <Button
                onClick={() =>
                  router.push(`/organizer/events/${event.id}?edit=1`)
                }
              >
                Edit
              </Button>
            </div>
          </div>

          {error && (
            <Card className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </Card>
          )}
          {success && (
            <Card className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">
              {success}
            </Card>
          )}

          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Event overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Description
                </h2>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </section>

              <section className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Location
                  </div>
                  <div>{event.location}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Visibility
                  </div>
                  <div>{event.is_public ? "Public" : "Private"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Capacity
                  </div>
                  <div>{event.capacity ?? "No limit"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {event.tags.length === 0 ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      event.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                        >
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // EDIT MODE
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Edit event</h1>
            <p className="text-sm text-muted-foreground">
              Updating <span className="font-medium">{event.title}</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.replace(`/organizer/events/${event.id}`)}
          >
            Cancel
          </Button>
        </header>

        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Event details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
                {success}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="starts_at">Starts at</Label>
                  <Input
                    id="starts_at"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ends_at">Ends at</Label>
                  <Input
                    id="ends_at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="capacity">Capacity (optional)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="is_public"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  <Label htmlFor="is_public">Public event</Label>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="tags">
                    Tags
                    <span className="ml-1 text-xs text-muted-foreground">
                      comma-separated
                    </span>
                  </Label>
                  <Input
                    id="tags"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <CardFooter className="mt-4 flex justify-end gap-2 px-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    router.replace(`/organizer/events/${event.id}`)
                  }
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
