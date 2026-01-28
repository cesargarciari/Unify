"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api, getToken } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type UserRole = "student" | "organizer" | "admin";

type CurrentUser = {
  id: string; // UUID
  email: string;
  display_name: string;
  role: UserRole;
};

type EventCreatePayload = {
  organizer_id: string;          
  title: string;
  description: string;
  location: string;
  starts_at: string;             
  ends_at: string;               
  capacity?: number | null;
  is_public: boolean;
  organization_id?: string | null;
  tags: string[];
};

export default function NewEventPage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState(""); 
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [tagsInput, setTagsInput] = useState("");

  const [organizationId] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/auth?from=create-event");
      return;
    }

    async function loadUser() {
      try {
        const me = await api<CurrentUser>("/api/auth/me", {}, true);
        setUser(me);

        if (me.role !== "organizer" && me.role !== "admin") {
          setError("Only organizers can create events.");
        }
      } catch (err) {
        console.error("Failed to load current user", err);
        router.replace("/auth?from=create-event");
      } finally {
        setLoadingUser(false);
      }
    }

    loadUser();
  }, [router]);

  function buildPayload(): EventCreatePayload {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const startsIso = new Date(startsAt).toISOString();
    const endsIso = new Date(endsAt).toISOString();

    return {
      organizer_id: user!.id,
      title,
      description,
      location,
      starts_at: startsIso,
      ends_at: endsIso,
      capacity: capacity ? Number(capacity) : null,
      is_public: isPublic,
      organization_id: organizationId,
      tags,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) return;
    if (user.role !== "organizer" && user.role !== "admin") {
      setError("Only organizers can create events.");
      return;
    }

    if (!title || !description || !location || !startsAt || !endsAt) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = buildPayload();

      await api("/api/organizer/events", {
        method: "POST",
        body: JSON.stringify(payload),
      }, true);

      setSuccess("Event created successfully!");
      setTimeout(() => {
        router.push("/events"); 
      }, 800);
    } catch (err: any) {
      console.error("Create event error", err);
      setError(err?.message ?? "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) {
    return null; 
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Create a new event</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user.display_name}</span> ({user.email})
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/events")}>
            Back to events
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Intro to Engineering Networking Night"
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
                    placeholder="Share what this event is about, who it's for, and what to expect."
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
                    placeholder="Engineering Building, Room 1-001"
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
                    placeholder="e.g. 100"
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
                    Tags (optional)
                    <span className="ml-1 text-xs text-muted-foreground">
                      comma-separated, e.g. &quot;career, networking, engineering&quot;
                    </span>
                  </Label>
                  <Input
                    id="tags"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="career, networking, engineering"
                    className="mt-1"
                  />
                </div>
              </div>

              <CardFooter className="mt-4 flex justify-end gap-2 px-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/events")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create event"}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
