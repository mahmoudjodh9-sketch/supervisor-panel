"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  fetchExtraViewGrants,
  addExtraViewGrant,
  deleteExtraViewGrant,
  type ExtraViewGrantRow,
} from "@/app/content/view-grants-actions";

const TXT = {
  ar: {
    title: "محاولات فتح إضافية لطالب معين",
    hint: "بتتضاف على حد الفتحات العادي للطالب ده بس. مفيدة لما يستنفد فتحاته.",
    username: "يوزر نيم الطالب",
    count: "العدد",
    add: "إضافة",
    adding: "جاري الإضافة...",
    success: "تمت إضافة المحاولات",
    empty: "مفيش محاولات إضافية ممنوحة لسه",
    loading: "جاري التحميل...",
    confirmDelete: "تحذف المحاولات الإضافية دي؟",
    extra: "محاولة إضافية",
  },
  en: {
    title: "Extra open attempts for a specific student",
    hint: "Added on top of the normal open limit for this student only. Useful when they run out of opens.",
    username: "Student username",
    count: "Count",
    add: "Add",
    adding: "Adding...",
    success: "Attempts added",
    empty: "No extra attempts granted yet",
    loading: "Loading...",
    confirmDelete: "Remove these extra attempts?",
    extra: "extra attempts",
  },
} as const;

const ERROR_EN: Record<string, string> = {
  "غير مصرّح": "Not authorized",
  "المحاضرة مطلوبة": "Lecture is required",
  "العنصر غير موجود": "Item not found",
  "المحاولات الإضافية للفيديو والـPDF فقط": "Extra attempts apply to videos and PDFs only",
  "اكتب يوزر نيم الطالب": "Enter the student's username",
  "عدد المحاولات لازم يكون من 1 إلى 100": "The number of attempts must be between 1 and 100",
  "لا يوجد طالب بهذا اليوزر نيم": "No student with this username",
  "المنح غير موجود": "Grant not found",
};

export function ExtraViewGrants({
  lectureItemId,
  lecturePath,
}: {
  lectureItemId: string;
  lecturePath: string;
}) {
  const { locale } = useLocale();
  const b = TXT[locale];
  const tr = (msg: string | null) => (msg && locale === "en" ? ERROR_EN[msg] ?? msg : msg);

  const [grants, setGrants] = useState<ExtraViewGrantRow[] | null>(null);
  const [username, setUsername] = useState("");
  const [count, setCount] = useState("1");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function reload() {
    fetchExtraViewGrants(lectureItemId).then((res) => {
      setGrants(res.grants);
      if (res.error) setMessage({ text: tr(res.error) ?? res.error, ok: false });
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureItemId]);

  function handleAdd() {
    setMessage(null);
    startTransition(async () => {
      const res = await addExtraViewGrant(lectureItemId, username, parseInt(count, 10), lecturePath);
      if (res.error) {
        setMessage({ text: tr(res.error) ?? res.error, ok: false });
        return;
      }
      setMessage({ text: b.success, ok: true });
      setUsername("");
      setCount("1");
      reload();
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm(b.confirmDelete)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteExtraViewGrant(id, lecturePath);
      if (res.error) setMessage({ text: tr(res.error) ?? res.error, ok: false });
      reload();
    });
  }

  // الكومبوننت جوه <form> الخاص بنافذة العنصر، فلازم نمنع Enter من إنه يحفظ العنصر
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isPending) handleAdd();
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--glass-border)] p-2.5">
      <p className="text-xs font-medium text-[var(--text-secondary)]">{b.title}</p>
      <p className="text-[11px] text-[var(--text-muted)]">{b.hint}</p>

      <div className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={b.username}
          dir="ltr"
          className="flex-1 min-w-0 rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition"
        />
        <input
          type="number"
          min={1}
          max={100}
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={b.count}
          className="w-16 shrink-0 rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-2 py-2 text-sm text-center outline-none focus:border-[var(--ice-300)] transition"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !username.trim()}
          className="shrink-0 flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white accent-gradient transition hover:brightness-110 disabled:opacity-50"
        >
          <Plus size={13} />
          {isPending ? b.adding : b.add}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${message.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</p>
      )}

      {grants === null && <p className="text-[11px] text-[var(--text-muted)]">{b.loading}</p>}
      {grants?.length === 0 && <p className="text-[11px] text-[var(--text-muted)]">{b.empty}</p>}
      {grants?.map((g) => (
        <div
          key={g.id}
          className="flex items-center justify-between gap-2 rounded-md bg-[var(--glass-highlight)] px-2.5 py-1.5"
        >
          <span className="text-sm truncate" dir="ltr">
            {g.username}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[var(--ice-300)]">
              +{g.extraViews} {b.extra}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(g.id)}
              disabled={isPending}
              className="p-1 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
