"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api, getToken, setToken } from "@/lib/apiClient";

type Role = "student" | "organizer";
type AuthTab = "login" | "register";

function rawErrorString(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function parseBackendDetail(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      const detail = (parsed as any).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail.length && detail[0]?.msg) {
        return String(detail[0].msg);
      }
      return JSON.stringify(detail);
    }
  } catch {
  }
  return raw;
}

function getAuthErrorMessage(err: unknown, context: "login" | "register"): string {
  const raw = rawErrorString(err);
  const detailFull = parseBackendDetail(raw) ?? "";
  const detail = detailFull.toLowerCase();

  if (context === "login") {
    if (detail.includes("incorrect email or password")) {
      return "Invalid email or password.";
    }
    if (detail.includes("not authenticated") || detail.includes("unauthorized")) {
      return "Your session has expired. Please sign in again.";
    }
    return detailFull || "Unable to sign in. Please try again.";
  }

  if (detail.includes("email already registered")) {
    return "An account with that email already exists.";
  }

  return detailFull || "Could not create your account. Please try again.";
}

export default function AuthPage() {
  const router = useRouter();

  const [tab, setTab] = useState<AuthTab>("login");
  const [role, setRole] = useState<Role>("student");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }

    (async () => {
      try {
        await api("/api/auth/me", { method: "GET" }, true);
        router.push("/events");
      } catch {
        setChecking(false);
      }
    })();
  }, [router]);

  if (checking) {
    return <div className="p-6 text-muted-foreground">Checking session…</div>;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api<{ access_token: string; token_type: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: loginEmail,
            password: loginPassword,
          }),
        }
      );

      setToken(data.access_token);
      router.push("/events");
    } catch (err: any) {
      setError(getAuthErrorMessage(err, "login"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const display_name = `${firstName} ${lastName}`.trim();

      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: regEmail,
          display_name,
          first_name: firstName,
          last_name: lastName,
          password: regPassword,
          role,
        }),
      });
    } catch (err: any) {
      setError(getAuthErrorMessage(err, "register"));
      console.error("Register error", err);
      setLoading(false);
      return;
    }

    try {
      const data = await api<{ access_token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
        }),
      });

      setToken(data.access_token);
      router.push("/events");
    } catch (err) {
      console.error("Auto-login after register failed", err);
      router.push("/auth?from=register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-foreground">
      <div className="mb-6 w-full max-w-lg">
        <Link href="/" className="inline-block">
          <Button variant="outline" className="border-border hover:bg-accent">
            ← Back to Home
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-lg bg-card border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {tab === "login" ? "Welcome back" : "Create your account"}
            </h2>

            <div className="min-w-[180px]">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-9 bg-background border-border text-foreground">
                  <SelectValue placeholder="Account type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="student" className="data-highlighted:bg-accent">
                    Student account
                  </SelectItem>
                  <SelectItem value="organizer" className="data-highlighted:bg-accent">
                    Organizer account
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-2">
              {error}
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as AuthTab);
              setError(null);
            }}
            className="w-full"
          >
            <TabsList className="mx-auto grid w-full max-w-sm grid-cols-2 rounded-lg bg-muted border border-border">
              <TabsTrigger
                value="login"
                className={cn(
                  "rounded-md text-sm transition-colors",
                  tab === "login"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className={cn(
                  "rounded-md text-sm transition-colors",
                  tab === "register"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Create account
              </TabsTrigger>
            </TabsList>

            {/* LOGIN */}
            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="grid gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="name@university.ca"
                    className="border-border bg-background placeholder:text-muted-foreground"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="border-border bg-background placeholder:text-muted-foreground"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    className="flex-1 border-border hover:bg-accent"
                    onClick={() =>
                      setError("Password reset is not implemented yet.")
                    }
                  >
                    Forgot?
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* REGISTER */}
            <TabsContent value="register" className="mt-0">
              <form onSubmit={handleRegister} className="grid gap-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      First name
                    </label>
                    <Input
                      placeholder="First name"
                      className="border-border bg-background placeholder:text-muted-foreground"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Last name
                    </label>
                    <Input
                      placeholder="Last name"
                      className="border-border bg-background placeholder:text-muted-foreground"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@university.ca"
                    className="border-border bg-background placeholder:text-muted-foreground"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    className="border-border bg-background placeholder:text-muted-foreground"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {loading ? "Creating..." : "Create account"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    className="flex-1 border-border hover:bg-accent"
                    onClick={() => {
                      setTab("login");
                      setError(null);
                    }}
                  >
                    I already have an account
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="mx-auto pt-2 text-center text-xs text-muted-foreground">
          {tab === "login"
            ? role === "student"
              ? "Are you an organizer? Switch above."
              : "Back to student login using the switch above."
            : "Use your university email to speed up verification later."}
        </CardFooter>
      </Card>
    </main>
  );
}
