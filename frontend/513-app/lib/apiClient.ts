// lib/apiClient.ts
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("unify_token");
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("unify_token", token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("unify_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = false
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (requireAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();

  if (!res.ok) {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.warn("API error", {
        path,
        status: res.status,
        body: text,
      });
    }

    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "detail" in parsed) {
        const detail = (parsed as any).detail;
        if (typeof detail === "string") {
          message = detail;
        } else {
          message = JSON.stringify(detail);
        }
      }
    } catch {
    }

    throw new Error(message || `Request failed (${res.status})`);
  }

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}