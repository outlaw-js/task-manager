"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api(`/api/auth/${mode}`, { body: form });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-500/30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="11" rx="1.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{isLogin ? "ورود به تسک منیجر" : "ساخت حساب کاربری"}</h1>
          <p className="mt-1 text-sm text-slate-500">{isLogin ? "برای مدیریت تسک‌ها وارد شوید" : "چند ثانیه بیشتر طول نمی‌کشد"}</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/60">
          {!isLogin && (
            <div>
              <label className="label" htmlFor="name">نام و نام خانوادگی</label>
              <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">ایمیل</label>
            <input id="email" type="email" dir="ltr" className="input text-left" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="password">رمز عبور</label>
            <input
              id="password"
              type="password"
              dir="ltr"
              className="input text-left"
              required
              minLength={isLogin ? undefined : 6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "لطفاً صبر کنید…" : isLogin ? "ورود" : "ثبت‌نام"}
          </button>
          <p className="text-center text-sm text-slate-500">
            {isLogin ? "حساب ندارید؟ " : "حساب دارید؟ "}
            <Link href={isLogin ? "/register" : "/login"} className="font-medium text-brand-600 hover:underline">
              {isLogin ? "ثبت‌نام کنید" : "وارد شوید"}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
