"use client";

import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import { ContentBreadcrumb } from "@/components/ContentBreadcrumb";

const LEVEL_COLORS = ["#7c5ce8", "#2f8fdb", "#34d399", "#f2b84b"];

export function SupervisorContentLevelsClient({
  levels,
}: {
  levels: { levelNumber: number; channelCount: number }[];
}) {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <ContentBreadcrumb items={[{ label: t.content.breadcrumbRoot }]} />

        <div>
          <h1 className="text-2xl font-bold accent-gradient-text flex items-center gap-2">
            <Layers size={22} className="text-[var(--ice-300)]" />
            {t.content.title}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t.content.subtitle}</p>
        </div>

        {levels.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t.content.channels.empty}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {levels.map(({ levelNumber, channelCount }) => {
              const label = t.content.levelLabels[levelNumber - 1] ?? `${levelNumber}`;
              const color = LEVEL_COLORS[levelNumber - 1] ?? LEVEL_COLORS[0];
              return (
                <button
                  key={levelNumber}
                  onClick={() => router.push(`/content/${levelNumber}`)}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 transition hover:border-[var(--ice-300)] hover:-translate-y-0.5"
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-white text-lg font-bold shadow-[var(--shadow-frost)]"
                    style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
                  >
                    {levelNumber}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {channelCount} {t.content.channelCountUnit}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
