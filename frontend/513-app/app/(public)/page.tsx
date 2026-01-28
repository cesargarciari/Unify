import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Search, CalendarPlus, Bell } from "lucide-react";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 text-foreground">
      {/* Hero */}
      <section className="pt-20 pb-16 grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-5">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Discover, plan, and share
            <span className="block text-transparent bg-clip-text bg-linear-to-tr from-[#5b8eff] to-[#7f5bff]">
              campus events
            </span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-prose">
            Your one-stop hub for club meetups, talks, sports, and more. Built for students and organizers with a clean, fast UI.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-[#2a3a66] hover:bg-[#324675] font-bold text-white">
              <Link href="/events">Browse Events</Link>
            </Button>
            <Button asChild variant="outline" className="border-border">
              <Link href="/organizer">Organizer Portal</Link>
            </Button>
            <Button asChild variant="ghost" className="hover:bg-[#171c27]">
              <Link href="/auth">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card dark:bg-linear-to-b dark:from-[#141a27] dark:to-[#111723] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Coming up</div>
            <div className="grid gap-3">
              {[
                { t: "CS Club — Hack Night", s: "Today 6–9pm • ENG 120" },
                { t: "Rec — Volleyball Open Gym", s: "Thu 7–9pm • Gym A" },
                { t: "Annual Career Fair", s: "Fri 10am–4pm • Student Union" },
              ].map((e) => (
                <Card key={e.t} className="bg-card border-border dark:bg-[#111723]">
                  <CardHeader className="pb-2">
                    <div className="font-semibold">{e.t}</div>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-muted-foreground">
                    {e.s}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 pb-16">
        {[
          { title: "Smart discovery", 
            body: "Search and filter by time, category, tags, and price.",
            icon: Search },
          { title: "Organizer tools", 
            body: "Create events, set capacity, and publish in minutes.",
            icon: CalendarPlus },
          { title: "Stay in the loop", 
            body: "Email/push digests keep you updated on what matters.",
            icon: Bell },
        ].map((f) => (
          <Card key={f.title} className="bg-card border-border dark:bg-[#111723]">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground">{f.body}</p>
              <f.icon className="h-6 w-6 mt-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))} 
      </section>
    </div>
  );
}
