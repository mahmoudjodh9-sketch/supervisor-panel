"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BookOpen,
  X,
  AlertTriangle,
  UserCheck,
  KeyRound,
  RefreshCw,
  Plus,
  Power,
  Trash2,
  Copy,
  Check,
  BarChart3,
  Calculator,
  Landmark,
  Users,
  ImagePlus,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import { ContentBreadcrumb } from "@/components/ContentBreadcrumb";
import { ContentCard, AddCard } from "@/components/ContentCard";
import { ImageCropModal } from "@/components/ImageCropModal";
import { createCourse, updateCourse, deleteCourse, moveCourse } from "@/app/content/courses-actions";
import {
  fetchUnlockCodes,
  fetchLecturesForCourse,
  activateCourseForStudent,
  createUnlockCode,
  toggleUnlockCodeActive,
  deleteUnlockCode,
} from "@/app/content/activation-actions";
import type { UnlockCodeRow, LectureOption } from "@/lib/unlockCodes";
import type { CourseRow } from "@/lib/content";

const COVER_ASPECT = 16 / 6.5;

const COURSE_ICONS: { key: string; icon: typeof BookOpen }[] = [
  { key: "book", icon: BookOpen },
  { key: "chart", icon: BarChart3 },
  { key: "calculator", icon: Calculator },
  { key: "balance", icon: Landmark },
  { key: "group", icon: Users },
];

function courseIconComponent(key: string | null) {
  return COURSE_ICONS.find((i) => i.key === key)?.icon ?? BookOpen;
}

export function ContentCoursesClient({
  level,
  channelId,
  channelName,
  initialCourses,
  loadError,
}: {
  level: number;
  channelId: string;
  channelName: string;
  initialCourses: CourseRow[];
  loadError: string | null;
}) {
  const { t } = useLocale();
  const [courses, setCourses] = useState(
    initialCourses.slice().sort((a, b) => a.order_index - b.order_index)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [activateTarget, setActivateTarget] = useState<CourseRow | null>(null);
  const [codesTarget, setCodesTarget] = useState<CourseRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const channelPath = `/content/${level}/${channelId}`;

  function handleMove(c: CourseRow, direction: "up" | "down") {
    setPendingId(c.id);
    startTransition(async () => {
      await moveCourse(c.id, channelId, direction, channelPath);
      setCourses((prev) => {
        const sorted = prev.slice().sort((a, b) => a.order_index - b.order_index);
        const idx = sorted.findIndex((x) => x.id === c.id);
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (idx === -1 || swapWith < 0 || swapWith >= sorted.length) return prev;
        const a = sorted[idx];
        const b = sorted[swapWith];
        const tmp = a.order_index;
        a.order_index = b.order_index;
        b.order_index = tmp;
        return [...sorted].sort((x, y) => x.order_index - y.order_index);
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
            { label: channelName },
          ]}
        />

        <div>
          <h1 className="text-2xl font-bold accent-gradient-text flex items-center gap-2">
            <BookOpen size={20} className="text-[var(--ice-300)]" />
            {channelName}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t.content.courses.pageSubtitle}</p>
        </div>

        {loadError && (
          <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--danger)]">
            {t.content.loadError}: {loadError}
          </div>
        )}

        {courses.length === 0 && <p className="text-sm text-[var(--text-muted)]">{t.content.courses.empty}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {courses.map((c, idx) => {
            const CourseIcon = courseIconComponent(c.icon);
            return (
            <div key={c.id} className="flex flex-col gap-2">
              <ContentCard
                title={c.title}
                coverUrl={c.coverUrl}
                color="#6d5ce8"
                icon={<CourseIcon size={34} className="text-white/90" strokeWidth={1.6} />}
                badge={
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      c.pricingType === "free"
                        ? "bg-[var(--success)]/80 text-white"
                        : c.pricingType === "mixed"
                          ? "bg-[var(--warning,#c9820a)]/80 text-white"
                          : "bg-black/50 text-white"
                    }`}
                  >
                    {c.pricingType === "free"
                      ? t.content.courses.free
                      : c.pricingType === "mixed"
                        ? t.content.courses.mixed
                        : t.content.courses.paid}
                  </span>
                }
                onClick={() => (window.location.href = `${channelPath}/${c.id}`)}
                onEdit={() => {
                  setEditing(c);
                  setModalOpen(true);
                }}
                onDelete={() => setDeleteTarget(c)}
                onMoveUp={() => handleMove(c, "up")}
                onMoveDown={() => handleMove(c, "down")}
                moveUpDisabled={idx === 0 || (isPending && pendingId === c.id)}
                moveDownDisabled={idx === courses.length - 1 || (isPending && pendingId === c.id)}
                editLabel={t.content.courses.edit}
                deleteLabel={t.content.courses.delete}
              />
              {!c.isFree && (
                <div className="flex items-center justify-center gap-1.5 px-1">
                  <button
                    onClick={() => setActivateTarget(c)}
                    title={t.content.courses.activateForStudent}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--glass-border)] py-1.5 text-[11px] text-[var(--text-secondary)] hover:border-[var(--success)] hover:text-[var(--success)] transition"
                  >
                    <UserCheck size={12} />
                  </button>
                  <button
                    onClick={() => setCodesTarget(c)}
                    title={t.content.courses.unlockCodes}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--glass-border)] py-1.5 text-[11px] text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition"
                  >
                    <KeyRound size={12} />
                  </button>
                </div>
              )}
            </div>
            );
          })}
          <AddCard
            label={t.content.courses.addButton}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          />
        </div>
      </div>

      {modalOpen && (
        <CourseModal
          channelId={channelId}
          channelPath={channelPath}
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={(saved, isNew) => {
            setCourses((prev) => (isNew ? [...prev, saved] : prev.map((c) => (c.id === saved.id ? saved : c))));
            setModalOpen(false);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          course={deleteTarget}
          channelPath={channelPath}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => {
            setCourses((prev) => prev.filter((c) => c.id !== id));
            setDeleteTarget(null);
          }}
        />
      )}

      {activateTarget && (
        <ActivateForStudentModal
          course={activateTarget}
          channelPath={channelPath}
          onClose={() => setActivateTarget(null)}
        />
      )}

      {codesTarget && (
        <UnlockCodesModal course={codesTarget} channelPath={channelPath} onClose={() => setCodesTarget(null)} />
      )}
    </AppShell>
  );
}

function CourseModal({
  channelId,
  channelPath,
  editing,
  onClose,
  onSaved,
}: {
  channelId: string;
  channelPath: string;
  editing: CourseRow | null;
  onClose: () => void;
  onSaved: (c: CourseRow, isNew: boolean) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [pricingType, setPricingType] = useState<"free" | "paid" | "mixed">(
    editing?.pricingType ?? "paid"
  );
  const [icon, setIcon] = useState(editing?.icon ?? "book");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(editing?.coverUrl ?? null);
  const [showCoverUpload, setShowCoverUpload] = useState(Boolean(editing?.coverUrl));
  const [cropRaw, setCropRaw] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setCropRaw(file);
  }

  function handleCropConfirm(cropped: File) {
    setCoverFile(cropped);
    setCoverPreview(URL.createObjectURL(cropped));
    setCropRaw(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError(t.content.courses.nameRequired);
    setError(null);

    const formData = new FormData();
    if (editing) formData.set("id", editing.id);
    formData.set("title", title.trim());
    formData.set("channelId", channelId);
    formData.set("pricingType", pricingType);
    formData.set("icon", icon);
    if (coverFile) formData.set("cover", coverFile);

    startTransition(async () => {
      const res = editing
        ? await updateCourse(formData, channelPath)
        : await createCourse(formData, channelPath);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved(
        {
          id: editing?.id ?? crypto.randomUUID(),
          title: title.trim(),
          coverUrl: coverPreview,
          icon,
          channelId,
          channelName: editing?.channelName ?? null,
          studentCount: editing?.studentCount ?? 0,
          lectureCount: editing?.lectureCount ?? 0,
          isFree: pricingType === "free",
          pricingType,
          status: editing?.status ?? "active",
          created_at: editing?.created_at ?? new Date().toISOString(),
          order_index: editing?.order_index ?? 999999,
        },
        !editing
      );
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-[var(--ice-300)]" />
              <h2 className="font-semibold text-base">
                {editing ? t.content.courses.modalEditTitle : t.content.courses.modalAddTitle}
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
              <label className="text-xs text-[var(--text-muted)]">{t.content.courses.fieldIcon}</label>
              <div className="grid grid-cols-5 gap-2">
                {COURSE_ICONS.map(({ key, icon: IconComp }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-3 transition ${
                      icon === key
                        ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                        : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <IconComp size={20} />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">{t.content.courses.fieldIconHint}</p>
            </div>

            {showCoverUpload ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)]">{t.content.courses.fieldCover}</label>
                {coverPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt="cover"
                    className="w-full h-28 rounded-xl object-cover border border-[var(--glass-border)]"
                  />
                )}
                <label className="cursor-pointer rounded-xl border border-dashed border-[var(--glass-border)] px-3 py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--ice-300)] transition text-center">
                  {t.content.courses.fieldCoverHint}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleCoverChange} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCoverUpload(false);
                    setCoverFile(null);
                    setCoverPreview(null);
                  }}
                  className="self-start text-[11px] text-[var(--danger)] hover:brightness-110 transition"
                >
                  {t.content.courses.removeCover}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCoverUpload(true)}
                className="flex items-center gap-1.5 self-start text-xs text-[var(--text-secondary)] hover:text-[var(--ice-300)] transition"
              >
                <ImagePlus size={14} />
                {t.content.courses.addCustomCover}
              </button>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">{t.content.courses.fieldName}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">{t.content.courses.fieldFree}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPricingType("paid")}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                    pricingType === "paid"
                      ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                      : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                  }`}
                >
                  {t.content.courses.paid}
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType("mixed")}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                    pricingType === "mixed"
                      ? "bg-[var(--warning,#c9820a)]/20 border-[var(--warning,#c9820a)] text-[var(--warning,#c9820a)]"
                      : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                  }`}
                >
                  {t.content.courses.mixed}
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType("free")}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
                    pricingType === "free"
                      ? "bg-[var(--success)]/20 border-[var(--success)] text-[var(--success)]"
                      : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                  }`}
                >
                  {t.content.courses.free}
                </button>
              </div>
            </div>

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

      {cropRaw && (
        <ImageCropModal
          file={cropRaw}
          aspect={COVER_ASPECT}
          title={t.content.courses.fieldCover}
          onCancel={() => setCropRaw(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
}

function DeleteConfirmModal({
  course,
  channelPath,
  onClose,
  onDeleted,
}: {
  course: CourseRow;
  channelPath: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLocale();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const res = await deleteCourse(course.id, channelPath);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDeleted(course.id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3 text-[var(--danger)]">
          <AlertTriangle size={20} />
          <h2 className="font-semibold text-base">{t.content.courses.deleteConfirmTitle}</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-1">{course.title}</p>
        <p className="text-sm text-[var(--text-muted)] mb-4">{t.content.courses.deleteConfirmBody}</p>

        {error && <p className="text-xs text-[var(--danger)] mb-3">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {t.content.courses.deleteConfirmCancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-xl bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? t.content.courses.deleting : t.content.courses.deleteConfirmProceed}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivateForStudentModal({
  course,
  channelPath,
  onClose,
}: {
  course: CourseRow;
  channelPath: string;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleActivate() {
    if (!username.trim()) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await activateCourseForStudent(course.id, username.trim(), channelPath);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setUsername("");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-[var(--success)]" />
            <h2 className="font-semibold text-base">{t.content.courses.activateForStudent}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4">{course.title}</p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[var(--text-muted)]">{t.content.courses.studentUsername}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            dir="ltr"
            placeholder="username"
            className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition"
          />
        </div>

        {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}
        {success && <p className="text-xs text-[var(--success)] mt-2">{t.content.courses.activateSuccess}</p>}

        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {t.content.cancel}
          </button>
          <button
            onClick={handleActivate}
            disabled={!username.trim() || isPending}
            className="accent-gradient flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
            {t.content.courses.activateAction}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnlockCodesModal({
  course,
  channelPath,
  onClose,
}: {
  course: CourseRow;
  channelPath: string;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const [codes, setCodes] = useState<UnlockCodeRow[] | null>(null);
  const [lectures, setLectures] = useState<LectureOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scope, setScope] = useState<"course" | "lecture">("course");
  const [lectureId, setLectureId] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function reload() {
    Promise.all([fetchUnlockCodes(course.id), fetchLecturesForCourse(course.id)]).then(
      ([codesRes, lecturesRes]) => {
        if (codesRes.error) setLoadError(codesRes.error);
        else setCodes(codesRes.codes);
        setLectures(lecturesRes);
      }
    );
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  function handleCreate() {
    setCreateError(null);
    const formData = new FormData();
    formData.set("courseId", course.id);
    if (scope === "lecture") {
      if (!lectureId) {
        setCreateError(t.content.courses.lectureRequired);
        return;
      }
      formData.set("lectureId", lectureId);
    }
    if (customCode) formData.set("code", customCode);
    if (maxUses) formData.set("maxUses", maxUses);
    if (expiresAt) formData.set("expiresAt", expiresAt);

    startTransition(async () => {
      const res = await createUnlockCode(formData, channelPath);
      if (res.error) {
        setCreateError(res.error);
        return;
      }
      setCustomCode("");
      setMaxUses("");
      setExpiresAt("");
      setLectureId("");
      reload();
    });
  }

  function handleToggle(code: UnlockCodeRow) {
    setPendingId(code.id);
    startTransition(async () => {
      await toggleUnlockCodeActive(code.id, code.isActive, channelPath);
      reload();
      setPendingId(null);
    });
  }

  function handleDelete(code: UnlockCodeRow) {
    setPendingId(code.id);
    startTransition(async () => {
      await deleteUnlockCode(code.id, channelPath);
      reload();
      setPendingId(null);
    });
  }

  async function handleCopy(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[var(--ice-300)]" />
            <h2 className="font-semibold text-base">{t.content.courses.unlockCodes}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4">{course.title}</p>

        <div className="flex flex-col gap-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 mb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope("course")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
                scope === "course"
                  ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                  : "border-[var(--glass-border)] text-[var(--text-secondary)]"
              }`}
            >
              {t.content.courses.scopeCourse}
            </button>
            <button
              type="button"
              onClick={() => setScope("lecture")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
                scope === "lecture"
                  ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                  : "border-[var(--glass-border)] text-[var(--text-secondary)]"
              }`}
            >
              {t.content.courses.scopeLecture}
            </button>
          </div>

          {scope === "lecture" && (
            <select
              value={lectureId}
              onChange={(e) => setLectureId(e.target.value)}
              className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition"
            >
              <option value="">{t.content.courses.selectLecture}</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder={t.content.courses.customCodePlaceholder}
              dir="ltr"
              className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--ice-300)] transition"
            />
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))}
              placeholder={t.content.courses.maxUsesPlaceholder}
              className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition"
            />
          </div>

          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition"
          />

          {createError && <p className="text-xs text-[var(--danger)]">{createError}</p>}

          <button
            onClick={handleCreate}
            disabled={isPending}
            className="accent-gradient flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {t.content.courses.createCode}
          </button>
        </div>

        {loadError && <p className="text-xs text-[var(--danger)] mb-2">{loadError}</p>}
        {codes === null && !loadError && (
          <p className="text-xs text-[var(--text-muted)]">{t.content.courses.loadingCodes}</p>
        )}
        {codes !== null && codes.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">{t.content.courses.noCodes}</p>
        )}
        {codes !== null && codes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {codes.map((code) => (
              <li
                key={code.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold">{code.code}</span>
                    <button
                      onClick={() => handleCopy(code.id, code.code)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--ice-300)] transition"
                    >
                      {copiedId === code.id ? (
                        <Check size={12} className="text-[var(--success)]" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] truncate">
                    {code.lectureTitle ?? t.content.courses.scopeCourse} · {code.usedCount}/{code.maxUses ?? "∞"} ·{" "}
                    {code.expiresAt ? dateFormatter.format(new Date(code.expiresAt)) : t.content.courses.noExpiry}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(code)}
                    disabled={isPending && pendingId === code.id}
                    title={code.isActive ? t.content.courses.codeDisable : t.content.courses.codeEnable}
                    className={`p-1.5 rounded-md transition disabled:opacity-50 ${
                      code.isActive
                        ? "text-[var(--success)] hover:bg-[var(--success)]/10"
                        : "text-[var(--danger)] hover:bg-[var(--danger)]/10"
                    }`}
                  >
                    <Power size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(code)}
                    disabled={isPending && pendingId === code.id}
                    className="p-1.5 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {t.content.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
