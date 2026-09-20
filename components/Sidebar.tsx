"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, X, LogOut } from "lucide-react";
import { useTransition } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { navItems } from "@/lib/nav";
import { useMobileNav } from "@/contexts/MobileNavContext";
import { supervisorLogoutAction } from "@/app/logout-actions";

export function Sidebar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const { isOpen, close } = useMobileNav();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`glass-panel-strong flex flex-col w-72 shrink-0 h-screen py-6 px-4
          max-md:fixed max-md:inset-y-0 max-md:end-0 max-md:z-40
          md:sticky md:top-0
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "max-md:ltr:translate-x-full max-md:rtl:-translate-x-full"}`}
        aria-label="Primary"
      >
        <div className="flex items-center justify-between gap-3 px-2 pb-6 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl accent-gradient shadow-[0_0_20px_rgba(79,180,238,0.45)]">
              <Crown size={22} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <p className="font-semibold tracking-wide text-[15px] shimmer-text">{t.platform}</p>
              <p className="text-xs text-[var(--text-muted)]">لوحة المشرف</p>
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close menu"
            className="md:hidden glass-panel h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={close}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all
                  ${
                    active
                      ? "accent-gradient text-white shadow-[0_4px_18px_rgba(91,110,232,0.35)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--glass-highlight)] hover:text-[var(--text-primary)]"
                  }`}
              >
                <Icon size={18} strokeWidth={2} className={active ? "text-white" : "opacity-80"} />
                <span className="font-medium">{t.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        <button
          disabled={isPending}
          onClick={() => startTransition(() => supervisorLogoutAction())}
          className="glass-panel rounded-xl px-3 py-3 flex items-center gap-3 mt-2 text-[var(--text-secondary)] hover:text-[var(--danger)] transition disabled:opacity-60"
        >
          <span className="h-9 w-9 rounded-full bg-[var(--glass-bg)] flex items-center justify-center">
            <LogOut size={16} />
          </span>
          <span className="text-sm font-semibold">تسجيل الخروج</span>
        </button>
      </aside>
    </>
  );
}
