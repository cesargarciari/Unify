"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoutButton } from "./logout-button";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/apiClient";
import {
  CalendarDays,
  LayoutPanelLeft,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";

/** Icon-first routes */
const routes = [
  { href: "/events", label: "Events", Icon: CalendarDays },
  { href: "/organizer", label: "Organizer", Icon: LayoutPanelLeft },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function Brand() {
  return (
    <Link href="/events" className="flex items-center gap-2">
      <Image src="/logo-new.png" alt="Unify Logo" width={36} height={36} />
      <span className="text-xl font-semibold leading-none">Unify</span>
    </Link>
  );
}

function NavIcon({
  href,
  label,
  active,
  Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "group relative grid h-10 w-12 place-items-center rounded-lg transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      {/* subtle top indicator (no bg fill) */}
      <span
        className={cn(
          "pointer-events-none absolute inset-x-3 -top-[6px] h-[3px] rounded-full bg-primary opacity-0 transition-opacity",
          active && "opacity-100"
        )}
      />
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function handleMobileLogout() {
    clearToken();
    router.push("/auth");
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 text-foreground">
        {/* Left: brand */}
        <Brand />

        {/* Center: icon nav (desktop) */}
        <div className="hidden md:flex items-center justify-center">
          <div className="flex items-center gap-10 rounded-full px-1 py-1">
            {routes.map(({ href, label, Icon }) => (
              <NavIcon
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
              />
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <ModeToggle />
          <LogoutButton />
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>


      <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-5 px-2 py-2">
          {routes.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={cn(
                  "group relative mx-auto grid h-10 w-12 place-items-center rounded-lg transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}

          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={handleMobileLogout}
            className="relative mx-auto grid h-10 w-12 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
