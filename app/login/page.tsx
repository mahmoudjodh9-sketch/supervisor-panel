"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supervisorLoginAction } from "./actions";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await supervisorLoginAction(username, password);
      if (result.success) {
        router.push("/");
        router.refresh();
      } else {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center glass-bg">
      <form
        onSubmit={handleSubmit}
        className="glass-panel p-8 w-full max-w-sm space-y-4"
        dir="rtl"
      >
        <h1 className="text-xl font-bold text-center">دخول لوحة المشرف</h1>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="اسم المستخدم"
          className="w-full rounded-lg px-4 py-2 bg-white/10 border border-white/20 outline-none"
          dir="ltr"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          className="w-full rounded-lg px-4 py-2 bg-white/10 border border-white/20 outline-none"
          dir="ltr"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg py-2 bg-blue-600 hover:bg-blue-500 transition disabled:opacity-50"
        >
          {isPending ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
