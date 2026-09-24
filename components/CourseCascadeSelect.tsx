"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import type { SimpleCourseOption } from "@/lib/courses";

export function CourseCascadeSelect({
  courseOptions,
  value,
  onChange,
  disabled,
}: {
  courseOptions: SimpleCourseOption[];
  value: string;
  onChange: (courseId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();

  const selectedCourse = courseOptions.find((c) => c.id === value) ?? null;

  const [level, setLevel] = useState<number | "">(selectedCourse?.levelNumber ?? "");
  const [channelId, setChannelId] = useState<string>(selectedCourse?.channelId ?? "");

  const levels = useMemo(() => {
    const nums = Array.from(
      new Set(courseOptions.map((c) => c.levelNumber).filter((n): n is number => n != null))
    ).sort((a, b) => a - b);
    return nums;
  }, [courseOptions]);

  const channelsInLevel = useMemo(() => {
    if (level === "") return [];
    const seen = new Map<string, string>();
    for (const c of courseOptions) {
      if (c.levelNumber === level && c.channelId && !seen.has(c.channelId)) {
        seen.set(c.channelId, c.channelName ?? c.channelId);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [courseOptions, level]);

  const coursesInChannel = useMemo(() => {
    if (!channelId) return [];
    return courseOptions.filter((c) => c.channelId === channelId);
  }, [courseOptions, channelId]);

  const selectClass =
    "w-full rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-[var(--text-muted)]">{t.courseCascade.level}</label>
        <select
          value={level}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : "";
            setLevel(v);
            setChannelId("");
            onChange("");
          }}
          className={selectClass}
        >
          <option value="">{t.courseCascade.selectLevel}</option>
          {levels.map((n) => (
            <option key={n} value={n}>
              {t.content.levelLabels[n - 1] ?? n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-[var(--text-muted)]">{t.courseCascade.channel}</label>
        <select
          value={channelId}
          disabled={disabled || level === ""}
          onChange={(e) => {
            setChannelId(e.target.value);
            onChange("");
          }}
          className={selectClass}
        >
          <option value="">{t.courseCascade.selectChannel}</option>
          {channelsInLevel.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-[var(--text-muted)]">{t.courseCascade.course}</label>
        <select
          value={value}
          disabled={disabled || !channelId}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          <option value="">{t.courseCascade.selectCourse}</option>
          {coursesInChannel.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
