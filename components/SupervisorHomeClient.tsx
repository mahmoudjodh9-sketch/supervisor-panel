"use client";

import { useRouter } from "next/navigation";
import { Home, Tv, BookOpen, Users } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import type { ChannelRow } from "@/lib/content";

export function SupervisorHomeClient({
  supervisorName,
  channels,
}: {
  supervisorName: string;
  channels: ChannelRow[];
}) {
  const { t } = useLocale();
  const router = useRouter();

  const totalCourses = channels.reduce((sum, c) => sum + c.courseCount, 0);
  const totalStudents = channels.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold accent-gradient-text flex items-center gap-2">
            <Home size={22} className="text-[var(--ice-300)]" />
            {t.supervisorHome.welcome} {supervisorName}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t.supervisorHome.subtitle}</p>
        </div>

        {/* Overview totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(79,180,238,0.14)] text-[var(--ice-300)]">
              <Tv size={20} />
            </span>
            <div>
              <p className="text-xl font-bold">{channels.length}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.supervisorHome.myChannels}</p>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(52,211,153,0.14)] text-[var(--success)]">
              <BookOpen size={20} />
            </span>
            <div>
              <p className="text-xl font-bold">{totalCourses}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.supervisorHome.totalCourses}</p>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(242,184,75,0.14)] text-[var(--warning)]">
              <Users size={20} />
            </span>
            <div>
              <p className="text-xl font-bold">{totalStudents}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.supervisorHome.totalStudents}</p>
            </div>
          </div>
        </div>

        {/* Per-channel cards */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">{t.supervisorHome.myChannels}</h2>
          {channels.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t.supervisorHome.noChannels}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/content/${c.levelNumber}/${c.id}`)}
                  className="group flex flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 text-start transition hover:border-[var(--ice-300)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    {c.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.logoUrl}
                        alt={c.name}
                        className="h-11 w-11 rounded-full object-cover border border-[var(--glass-border)]"
                      />
                    ) : (
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-full text-white font-bold"
                        style={{ background: c.colorDay ?? "var(--ice-300)" }}
                      >
                        {c.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {t.content.levelLabels[c.levelNumber - 1] ?? c.levelNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <BookOpen size={13} />
                      {c.courseCount} {t.supervisorHome.coursesUnit}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} />
                      {c.studentCount} {t.supervisorHome.studentsUnit}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
