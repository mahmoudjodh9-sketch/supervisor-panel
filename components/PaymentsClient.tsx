"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CreditCard,
  Plus,
  Search,
  X,
  Check,
  Ban,
  Trash2,
  Clock,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import { createPayment, confirmPayment, rejectPayment, deletePayment } from "@/app/payments/actions";
import type { PaymentRow, PaymentStatus } from "@/lib/payments";
import type { SimpleCourseOption } from "@/lib/courses";
import { CourseCascadeSelect } from "@/components/CourseCascadeSelect";

type StatusFilter = "all" | PaymentStatus;

export function PaymentsClient({
  initialPayments,
  courseOptions,
  loadError,
}: {
  initialPayments: PaymentRow[];
  courseOptions: SimpleCourseOption[];
  loadError: string | null;
}) {
  const { t, locale } = useLocale();
  const [payments, setPayments] = useState(initialPayments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.studentName ?? "").toLowerCase().includes(q) ||
        p.studentUsername.toLowerCase().includes(q) ||
        p.courseTitle.toLowerCase().includes(q)
      );
    });
  }, [payments, search, statusFilter]);

  function handleConfirm(p: PaymentRow) {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await confirmPayment(p.id);
      if (!res.error) {
        setPayments((prev) =>
          prev.map((x) =>
            x.id === p.id ? { ...x, status: "confirmed", confirmed_at: new Date().toISOString() } : x
          )
        );
      }
      setPendingId(null);
    });
  }

  function handleReject(p: PaymentRow) {
    setPendingId(p.id);
    startTransition(async () => {
      const res = await rejectPayment(p.id);
      if (!res.error) {
        setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "rejected" } : x)));
      }
      setPendingId(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setPendingId(id);
    startTransition(async () => {
      const res = await deletePayment(id);
      if (!res.error) {
        setPayments((prev) => prev.filter((x) => x.id !== id));
      }
      setPendingId(null);
      setDeleteTarget(null);
    });
  }

  function statusBadge(status: PaymentStatus) {
    const map: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
      pending: { label: t.payments.statusPending, color: "var(--warning)", bg: "rgba(242,184,75,0.14)" },
      confirmed: { label: t.payments.statusConfirmed, color: "var(--success)", bg: "rgba(52,211,153,0.14)" },
      rejected: { label: t.payments.statusRejected, color: "var(--danger)", bg: "rgba(239,77,94,0.14)" },
    };
    const s = map[status];
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ color: s.color, backgroundColor: s.bg }}
      >
        {s.label}
      </span>
    );
  }

  const filterOptions: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t.payments.filterAll },
    { key: "pending", label: t.payments.filterPending },
    { key: "confirmed", label: t.payments.filterConfirmed },
    { key: "rejected", label: t.payments.filterRejected },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold accent-gradient-text">{t.payments.title}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">{t.payments.subtitle}</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="accent-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-frost)] transition hover:brightness-110 w-fit"
          >
            <Plus size={18} />
            {t.payments.addButton}
          </button>
        </div>

        {loadError && (
          <div className="glass-panel rounded-xl p-3 text-sm text-[var(--danger)]">
            {t.payments.loadError}: {loadError}
          </div>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.payments.searchPlaceholder}
              className="w-full glass-panel rounded-xl ps-9 pe-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {filterOptions.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition border ${
                  statusFilter === f.key
                    ? "border-[var(--ice-300)] text-[var(--ice-300)] bg-[rgba(79,180,238,0.1)]"
                    : "border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--ice-300)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)] text-[var(--text-muted)]">
                <th className="px-4 py-3 font-medium text-start">{t.payments.colStudent}</th>
                <th className="px-4 py-3 font-medium text-start">{t.payments.colCourse}</th>
                <th className="px-4 py-3 font-medium text-start">{t.payments.colChannel}</th>
                <th className="px-4 py-3 font-medium text-start">{t.payments.colStatus}</th>
                <th className="px-4 py-3 font-medium text-start">{t.payments.colNote}</th>
                <th className="px-4 py-3 font-medium text-start">{t.payments.colDate}</th>
                <th className="px-4 py-3 font-medium text-start">{t.payments.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    {t.payments.empty}
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[var(--glass-border)] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.studentName || p.studentUsername}</p>
                    <p className="text-xs text-[var(--text-muted)]" dir="ltr">
                      @{p.studentUsername}
                    </p>
                  </td>
                  <td className="px-4 py-3">{p.courseTitle}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{p.channelName || "—"}</td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] max-w-[220px] truncate" title={p.note ?? ""}>
                    {p.note || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                    {dateFormatter.format(new Date(p.created_at))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {p.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleConfirm(p)}
                            disabled={isPending && pendingId === p.id}
                            title={t.payments.confirm}
                            className="p-1.5 rounded-lg text-[var(--success)] hover:bg-[rgba(52,211,153,0.14)] transition disabled:opacity-50"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleReject(p)}
                            disabled={isPending && pendingId === p.id}
                            title={t.payments.reject}
                            className="p-1.5 rounded-lg text-[var(--warning)] hover:bg-[rgba(242,184,75,0.14)] transition disabled:opacity-50"
                          >
                            <Ban size={16} />
                          </button>
                        </>
                      )}
                      {p.status === "confirmed" && (
                        <span className="p-1.5 text-[var(--text-muted)]" title={t.payments.colConfirmedAt}>
                          <Clock size={16} />
                        </span>
                      )}
                      <button
                        onClick={() => setDeleteTarget(p)}
                        title={t.payments.delete}
                        className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[rgba(239,77,94,0.14)] transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <AddPaymentModal
          courseOptions={courseOptions}
          onClose={() => setModalOpen(false)}
          onCreated={(row) => {
            setPayments((prev) => [row, ...prev]);
            setModalOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={18} className="text-[var(--danger)]" />
              <h2 className="font-semibold text-base">{t.payments.delete}</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-5">{t.payments.confirmDeleteMessage}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold border border-[var(--glass-border)] hover:border-[var(--ice-300)] transition"
              >
                {t.payments.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-[var(--danger)] hover:brightness-110 transition disabled:opacity-50"
              >
                {t.payments.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AddPaymentModal({
  courseOptions,
  onClose,
  onCreated,
}: {
  courseOptions: SimpleCourseOption[];
  onClose: () => void;
  onCreated: (row: PaymentRow) => void;
}) {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [courseId, setCourseId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return setError(t.payments.usernameRequired);
    if (!courseId) return setError(t.payments.courseRequired);
    setError(null);

    const formData = new FormData();
    formData.set("username", username.trim());
    formData.set("courseId", courseId);
    formData.set("note", note.trim());

    startTransition(async () => {
      const res = await createPayment(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      const course = courseOptions.find((c) => c.id === courseId);
      onCreated({
        id: crypto.randomUUID(),
        studentId: "",
        studentName: null,
        studentUsername: username.trim(),
        courseId,
        courseTitle: course?.title ?? "",
        channelName: course?.channelName ?? null,
        status: "pending",
        note: note.trim() || null,
        created_at: new Date().toISOString(),
        confirmed_at: null,
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-[var(--ice-300)]" />
            <h2 className="font-semibold text-base">{t.payments.modalAddTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">{t.payments.fieldUsername}</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition"
              dir="ltr"
            />
            <p className="text-[11px] text-[var(--text-muted)]">{t.payments.fieldUsernameHint}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">{t.payments.fieldCourse}</label>
            <CourseCascadeSelect courseOptions={courseOptions} value={courseId} onChange={setCourseId} />
            {courseOptions.length === 0 && (
              <p className="text-[11px] text-[var(--warning)]">{t.payments.noCoursesAvailable}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">{t.payments.fieldNote}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t.payments.fieldNoteHint}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition resize-none"
            />
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-[var(--glass-border)] hover:border-[var(--ice-300)] transition"
            >
              {t.payments.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="accent-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {isPending ? t.payments.saving : t.payments.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
