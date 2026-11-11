"use client";

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = opts.body !== undefined;
  const res = await fetch(url, {
    method: opts.method ?? (hasBody ? "POST" : "GET"),
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    window.location.href = "/login";
  }
  if (!res.ok) throw new Error(data.error ?? "خطایی رخ داد");
  return data as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "خطایی رخ داد");
