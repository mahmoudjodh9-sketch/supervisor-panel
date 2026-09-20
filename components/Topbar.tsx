"use client";

import { useRouter } from "next/navigation";
import { Search, Moon, Sun, Languages, Bell, Menu } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMobileNav } from "@/contexts/MobileNavContext";

export function Topbar() {
  const { t, locale, toggleLocale } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useMobileNav();
  const router = useRouter();

  return (
    <header className="glass-panel sticky top-0 z-20 mx-4 mt-4 md:mx-6 md:mt-6 rounded-2xl px-4 py-3 flex items-center gap-3">
      <button
        onClick={toggle}
        aria-label="Toggle menu"
        className="md:hidden glass-panel h-10 w-10 shrink-0 rounded-xl flex items-center justify-center hover:border-[var(--ice-300)] transition-colors"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 flex items-center gap-2 glass-panel rounded-xl px-3 py-2 max-w-md">
        <Search size={16} className="text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder={t.topbar.search}
          className="bg-transparent outline-none text-sm w-full placeholder:text-[var(--text-muted)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLocale}
          aria-label="Toggle language"
          title={locale === "ar" ? "English" : "عربي"}
          className="glass-panel h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold hover:border-[var(--ice-300)] transition-colors"
        >
          <Languages size={16} />
          {locale === "ar" ? "EN" : "AR"}
        </button>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="glass-panel h-10 w-10 rounded-xl flex items-center justify-center hover:border-[var(--ice-300)] transition-colors"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={() => router.push("/notifications")}
          aria-label="Notifications"
          className="relative glass-panel h-10 w-10 rounded-xl flex items-center justify-center hover:border-[var(--ice-300)] transition-colors"
        >
          <Bell size={18} />
          <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-[var(--danger)] text-[10px] leading-4 text-white text-center font-bold">
            12
          </span>
        </button>
      </div>
    </header>
  );
}
