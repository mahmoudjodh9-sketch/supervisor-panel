"use client";

import { useState, useTransition } from "react";
import {
  PlayCircle,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle,
  HelpCircle,
  ListVideo,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import { ContentBreadcrumb } from "@/components/ContentBreadcrumb";
import { createLecture, updateLecture, deleteLecture, moveLecture } from "@/app/content/lectures-actions";
import type { LectureRow, LectureCategory } from "@/lib/content";

export function ContentLecturesClient({
  level,
  channelId,
  channelName,
  courseId,
  courseTitle,
  courseIsFree,
  initialLectures,
  loadError,
}: {
  level: number;
  channelId: string;
  channelName: string;
  courseId: string;
  courseTitle: string;
  courseIsFree: boolean;
  initialLectures: LectureRow[];
  loadError: string | null;
}) {
  const { t } = useLocale();
  const [lectures, setLectures] = useState(
    initialLectures.slice().sort((a, b) => a.orderIndex - b.orderIndex)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LectureRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LectureRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const coursePath = `/content/${level}/${channelId}/${courseId}`;

  function handleMove(l: LectureRow, direction: "up" | "down") {
    setPendingId(l.id);
    startTransition(async () => {
      await moveLecture(l.id, courseId, direction, coursePath);
      setLectures((prev) => {
        const sorted = prev.slice().sort((a, b) => a.orderIndex - b.orderIndex);
        const idx = sorted.findIndex((x) => x.id === l.id);
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (idx === -1 || swapWith < 0 || swapWith >= sorted.length) return prev;
        const a = sorted[idx];
        const b = sorted[swapWith];
        const tmp = a.orderIndex;
        a.orderIndex = b.orderIndex;
        b.orderIndex = tmp;
        return [...sorted].sort((x, y) => x.orderIndex - y.orderIndex);
      });
      setPendingId(null);
    });
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <ContentBreadcrumb
          items={[
            { label: t.content.breadcrumbRoot, href: "/content" },
            { label: t.content.levelLabels[level - 1] ?? level, href: `/content/${level}` },
            { label: channelName, href: `/content/${level}/${channelId}` },
            { label: courseTitle },
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold accent-gradient-text flex items-center gap-2">
              <PlayCircle size={20} className="text-[var(--ice-300)]" />
              {courseTitle}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">{t.content.lectures.pageSubtitle}</p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="accent-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-frost)] transition hover:brightness-110 w-fit"
          >
            <Plus size={18} />
            {t.content.lectures.addButton}
          </button>
        </div>

        {loadError && (
          <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--danger)]">
            {t.content.loadError}: {loadError}
          </div>
        )}

        {lectures.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">{t.content.lectures.empty}</p>
        )}

        <div className="flex flex-col gap-2">
          {lectures.map((l, idx) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5 hover:border-[var(--ice-300)] transition"
            >
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => handleMove(l, "up")}
                  disabled={idx <= 0 || (isPending && pendingId === l.id)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--ice-300)] disabled:opacity-30 transition"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => handleMove(l, "down")}
                  disabled={idx === lectures.length - 1 || (isPending && pendingId === l.id)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--ice-300)] disabled:opacity-30 transition"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <button
                onClick={() => (window.location.href = `${coursePath}/${l.id}`)}
                className="flex flex-1 items-center gap-3 min-w-0 text-start"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] text-[var(--ice-300)]">
                  <PlayCircle size={16} />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{l.title}</span>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <span>
                      {l.category === "شرح" ? t.content.lectures.categoryExplain : t.content.lectures.categoryReview}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-semibold ${
                        l.isFree || courseIsFree
                          ? "bg-[var(--success)]/15 text-[var(--success)]"
                          : "bg-[var(--ice-300)]/15 text-[var(--ice-300)]"
                      }`}
                    >
                      {l.isFree || courseIsFree ? t.content.lectures.free : t.content.lectures.paid}
                    </span>
                    {l.hasQuiz && (
                      <span className="flex items-center gap-0.5 text-[var(--ice-300)]">
                        <HelpCircle size={11} />
                        {t.content.lectures.quizYes}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <ListVideo size={11} />
                      {l.itemCount}
                    </span>
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setEditing(l);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setDeleteTarget(l)}
                  className="p-1.5 rounded-lg border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10 transition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <LectureModal
          editing={editing}
          courseId={courseId}
          coursePath={coursePath}
          onClose={() => setModalOpen(false)}
          onSaved={(saved, isNew) => {
            setLectures((prev) =>
              (isNew ? [...prev, saved] : prev.map((l) => (l.id === saved.id ? saved : l))).sort(
                (a, b) => a.orderIndex - b.orderIndex
              )
            );
            setModalOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          lecture={deleteTarget}
          coursePath={coursePath}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => {
            setLectures((prev) => prev.filter((l) => l.id !== id));
            setDeleteTarget(null);
          }}
        />
      )}
    </AppShell>
  );
}

function LectureModal({
  editing,
  courseId,
  coursePath,
  onClose,
  onSaved,
}: {
  editing: LectureRow | null;
  courseId: string;
  coursePath: string;
  onClose: () => void;
  onSaved: (l: LectureRow, isNew: boolean) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<LectureCategory>(editing?.category ?? "شرح");
  const [isFree, setIsFree] = useState(editing?.isFree ?? false);
  const [hasQuiz, setHasQuiz] = useState(editing?.hasQuiz ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(t.content.lectures.nameRequired);
    setError(null);

    const formData = new FormData();
    if (editing) formData.set("id", editing.id);
    formData.set("courseId", courseId);
    formData.set("title", title.trim());
    formData.set("category", category);
    formData.set("isFree", String(isFree));
    formData.set("hasQuiz", String(hasQuiz));

    startTransition(async () => {
      const res = editing
        ? await updateLecture(formData, coursePath)
        : await createLecture(formData, coursePath);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved(
        {
          id: editing?.id ?? crypto.randomUUID(),
          courseId,
          title: title.trim(),
          category,
          orderIndex: editing?.orderIndex ?? 999999,
          isFree,
          hasQuiz,
          itemCount: editing?.itemCount ?? 0,
          createdAt: editing?.createdAt ?? new Date().toISOString(),
        },
        !editing
      );
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PlayCircle size={18} className="text-[var(--ice-300)]" />
            <h2 className="font-semibold text-base">
              {editing ? t.content.lectures.modalEditTitle : t.content.lectures.modalAddTitle}
            </h2>
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
            <label className="text-xs text-[var(--text-muted)]">{t.content.lectures.fieldName}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">{t.content.lectures.fieldCategory}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategory("شرح")}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                  category === "شرح"
                    ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                    : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                }`}
              >
                {t.content.lectures.categoryExplain}
              </button>
              <button
                type="button"
                onClick={() => setCategory("مراجعة")}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                  category === "مراجعة"
                    ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                    : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                }`}
              >
                {t.content.lectures.categoryReview}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">{t.content.lectures.fieldAccess}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                  !isFree
                    ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                    : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                }`}
              >
                {t.content.lectures.paid}
              </button>
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                  isFree
                    ? "bg-[var(--success)]/20 border-[var(--success)] text-[var(--success)]"
                    : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                }`}
              >
                {t.content.lectures.free}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t.content.lectures.fieldAccessHint}</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasQuiz}
              onChange={(e) => setHasQuiz(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--ice-300)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">{t.content.lectures.fieldQuiz}</span>
          </label>

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              {t.content.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="accent-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-frost)] transition hover:brightness-110 disabled:opacity-60"
            >
              {isPending ? t.content.saving : t.content.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  lecture,
  coursePath,
  onClose,
  onDeleted,
}: {
  lecture: LectureRow;
  coursePath: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLocale();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const res = await deleteLecture(lecture.id, coursePath);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDeleted(lecture.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3 text-[var(--danger)]">
          <AlertTriangle size={20} />
          <h2 className="font-semibold text-base">{t.content.lectures.deleteConfirmTitle}</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-1">{lecture.title}</p>
        <p className="text-sm text-[var(--text-muted)] mb-4">{t.content.lectures.deleteConfirmBody}</p>

        {error && <p className="text-xs text-[var(--danger)] mb-3">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {t.content.lectures.deleteConfirmCancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-xl bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? t.content.lectures.deleting : t.content.lectures.deleteConfirmProceed}
          </button>
        </div>
      </div>
    </div>
  );
}
