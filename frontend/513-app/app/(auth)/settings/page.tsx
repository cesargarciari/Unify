"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { UserRoundPen, ShieldCheck, BellRing, Badge } from "lucide-react";
import { api } from "@/lib/apiClient";
import CircularText from "@/components/CircularText";

type Panel = "profile" | "account" | "security" | "notifications";

const NAV: { key: Panel; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profile", icon: <UserRoundPen /> },
  { key: "account", label: "Account", icon: <Badge /> },
  { key: "security", label: "Security", icon: <ShieldCheck /> },
  { key: "notifications", label: "Notifications", icon: <BellRing /> },
];

type ApiUserSettings = {
  theme?: string | null;
  email_notifications?: boolean | null;
  push_notifications?: boolean | null;
};

type ApiMe = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_data?: string | null;
  settings?: ApiUserSettings | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function extractErrorMessage(err: unknown, fallback: string) {
  const raw = getErrorMessage(err) || fallback;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "detail" in parsed &&
      parsed !== null
    ) {
      const detail = (parsed as { detail: unknown }).detail;
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    }
  } catch {
    // ignore JSON parse errors
  }
  return raw || fallback;
}

function triggerAvatarFileDialog() {
  if (typeof document === "undefined") return;
  const input = document.getElementById("avatar-upload") as HTMLInputElement | null;
  if (input) {
    input.click();
  }
}

export default function SettingsPage() {
  const [panel, setPanel] = useState<Panel>("profile");

  const [me, setMe] = useState<ApiMe | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null); // ✅ new

  const [emailNotif, setEmailNotif] = useState<boolean>(true);
  const [pushNotif, setPushNotif] = useState<boolean>(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);

  const [username, setUsername] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await api<ApiMe>("/api/users/me", {}, true);
        if (!alive) return;

        setMe(data);

        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarData(data.avatar_data ?? null);
        setUsername(data.username ?? "");

        const settings = data.settings ?? {};
        setEmailNotif(settings.email_notifications ?? true);
        setPushNotif(settings.push_notifications ?? false);
      } catch (err: unknown) {
        if (!alive) return;
        setError(extractErrorMessage(err, "Failed to load settings"));
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function updateSettings(patch: Partial<ApiUserSettings>) {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updated = await api<ApiUserSettings>(
        "/api/users/me/settings",
        { method: "PATCH", body: JSON.stringify(patch) },
        true
      );

      setMe((prev) => (prev ? { ...prev, settings: updated } : prev));

      setEmailNotif(updated.email_notifications ?? emailNotif);
      setPushNotif(updated.push_notifications ?? pushNotif);

      setSuccess("Preferences saved.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save preferences"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotifications() {
    await updateSettings({
      email_notifications: emailNotif,
      push_notifications: pushNotif,
    });
  }

  function handleAvatarChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setAvatarData(result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    if (!me) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const updated = await api<ApiMe>(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            display_name: displayName,
            bio,
            avatar_data: avatarData,
          }),
        },
        true
      );

      setMe(updated);
      setDisplayName(updated.display_name ?? "");
      setBio(updated.bio ?? "");
      setAvatarData(updated.avatar_data ?? null);

      setSuccess("Profile updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAccount() {
    if (!me) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const updated = await api<ApiMe>(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify({ username }),
        },
        true
      );
      setMe(updated);
      setUsername(updated.username ?? "");

      setSuccess("Account updated.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save account"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setSecurityError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError("New password and confirmation do not match.");
      return;
    }

    try {
      setSaving(true);
      await api<void>(
        "/api/users/me/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
        true
      );

      setSecuritySuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setSecurityError(extractErrorMessage(err, "Failed to update password"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-8 mx-auto max-w-7xl text-foreground">
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="bg-linear-to-b from-sidebar to-sidebar-accent border border-sidebar-border text-sidebar-foreground rounded-xl p-2">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setPanel(item.key);
                setError(null);
                setSuccess(null);
                setSecurityError(null);
                setSecuritySuccess(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left border",
                panel === item.key
                  ? "text-foreground"
                  : "text-muted-foreground border-transparent hover:bg-accent"
              )}
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </aside>

        <section className="bg-card dark:bg-linear-to-b dark:from-[#131826] dark:to-[#0f1421] border border-border rounded-xl p-6 space-y-6">
          <header>
            <h2 className="text-lg font-semibold">
              {panel[0].toUpperCase() + panel.slice(1)}
            </h2>
            <p className="text-muted-foreground">
              {panel === "profile" && "Update your name, avatar, and public info."}
              {panel === "account" && "Manage your email, username, and connections."}
              {panel === "security" && "Update your password and enable extra protection."}
              {panel === "notifications" &&
                "Choose how you want to hear about events."}
            </p>
          </header>

          {panel === "notifications" && loadingMe && (
            <div className="text-sm text-muted-foreground">
              Loading your preferences...
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-2">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2">
              {success}
            </div>
          )}

          {/* PROFILE */}
          {panel === "profile" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-dashed border-[#2a3550] p-4 grid grid-cols-[96px_1fr] gap-4 items-center">
                <div className="w-24 h-24 rounded-xl border border-(--profile-img-border) bg-linear-to-tr from-(--profile-img-from) to-(--profile-img-to) grid place-items-center text-muted-foreground overflow-hidden">
                  {avatarData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarData}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs">IMG</span>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Profile Photo</Label>
                  <div className="text-sm text-muted-foreground">
                    <label htmlFor="avatar-upload">
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-1 h-8 px-3 border-border"
                        disabled={saving}
                        onClick={triggerAvatarFileDialog}
                      >
                        Upload
                      </Button>
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAvatarChange(e.target.files)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">First name</Label>
                  <Input
                    placeholder="first name"
                    className="mt-1 border-border text-foreground"
                    value={firstName}
                    disabled
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Last name</Label>
                  <Input
                    placeholder="last name"
                    className="mt-1 border-border text-foreground"
                    value={lastName}
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Display name</Label>
                <Input
                  placeholder="display name"
                  className="mt-1 border-border text-foreground"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <Label className="text-muted-foreground">Bio</Label>
                <Textarea
                  placeholder="Tell others about yourself…"
                  className="mt-1 border-border text-foreground placeholder:text-muted-foreground"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  className="hover:bg-[#324675]"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          )}

          {/* ACCOUNT */}
          {panel === "account" && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  className="mt-1 border-border text-foreground placeholder:text-muted-foreground"
                  value={me?.email ?? ""}
                  readOnly
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  We&apos;ll send confirmations to this address.
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Username</Label>
                <Input
                  placeholder="username"
                  className="mt-1 border-border text-foreground"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="hover:bg-[#324675]"
                  onClick={handleSaveAccount}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {panel === "security" && (
            <form className="space-y-4" onSubmit={handleUpdatePassword}>
              {securityError && (
                <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-2">
                  {securityError}
                </div>
              )}
              {securitySuccess && (
                <div className="text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2">
                  {securitySuccess}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Current password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="mt-1 border-border text-foreground"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">New password</Label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    className="mt-1 border-border text-foreground"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Confirm new password
                  </Label>
                  <Input
                    type="password"
                    placeholder="Repeat new password"
                    className="mt-1 border-border text-foreground"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="hover:bg-[#324675]"
                  disabled={saving}
                >
                  {saving ? "Updating..." : "Update password"}
                </Button>
              </div>
            </form>
          )}

          {/* NOTIFICATIONS */}
          {panel === "notifications" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 dark:bg-[#111723]">
                <span>Email notifications</span>
                <Switch
                  checked={emailNotif}
                  disabled={loadingMe || saving}
                  onCheckedChange={(checked) => {
                    setEmailNotif(checked);
                  }}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  className="hover:bg-[#324675]"
                  onClick={handleSaveNotifications}
                  disabled={loadingMe || saving}
                >
                  {saving ? "Saving..." : "Save preferences"}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <CircularText
          text={"UNIFY • UNIFY • "}
          className="text-sidebar-foreground "
        />
      </div>
    </div>
  );
}
