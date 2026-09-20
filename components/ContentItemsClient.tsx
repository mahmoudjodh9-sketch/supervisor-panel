"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Video,
  FileText,
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  UploadCloud,
  ChevronUp,
  ChevronDown,
  Eye,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import { ContentBreadcrumb } from "@/components/ContentBreadcrumb";
import { AddCard } from "@/components/ContentCard";
import {
  createLectureItem,
  updateLectureItem,
  deleteLectureItem,
  moveLectureItem,
  getCloudinaryUploadTarget,
  attachCloudinaryVideo,
  getVideoViewLimit,
  updateVideoViewLimit,
  getPdfSettings,
  updatePdfSettings,
} from "@/app/content/items-actions";
import { setLectureHasQuiz } from "@/app/content/quiz-actions";
import {
  fetchQuizQuestions,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  uploadQuizSheet,
  fetchQuizSettings,
  updateQuizSettings,
  archiveLectureQuiz,
  grantExtraQuizAttempt,
  fetchQuizLeaderboard,
  deleteQuizAttempt,
  fetchQuizAttemptDetail,
  type QuizQuestionRow,
  type QuizQuestionType,
  type QuizSettings,
  type QuizReviewMode,
  type QuizLeaderboardEntry,
  type QuizAttemptDetail,
} from "@/app/content/quiz-actions";
import type { LectureItemRow } from "@/lib/content";

export function ContentItemsClient({
  level,
  channelId,
  channelName,
  courseId,
  courseTitle,
  lectureId,
  lectureTitle,
  hasQuizInitial,
  quizSettingsInitial,
  initialItems,
  loadError,
}: {
  level: number;
  channelId: string;
  channelName: string;
  courseId: string;
  courseTitle: string;
  lectureId: string;
  lectureTitle: string;
  hasQuizInitial: boolean;
  quizSettingsInitial: QuizSettings;
  initialItems: LectureItemRow[];
  loadError: string | null;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState(initialItems.slice().sort((a, b) => a.orderIndex - b.orderIndex));
  const [hasQuiz, setHasQuiz] = useState(hasQuizInitial);
  const [pickTypeOpen, setPickTypeOpen] = useState(false);
  const [formState, setFormState] = useState<{ type: "video" | "pdf"; editing: LectureItemRow | null } | null>(
    null
  );
  const [quizOpen, setQuizOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const lecturePath = `/content/${level}/${channelId}/${courseId}/${lectureId}`;

  function handleMove(item: LectureItemRow, direction: "up" | "down") {
    setPendingId(item.id);
    startTransition(async () => {
      await moveLectureItem(item.id, lectureId, direction, lecturePath);
      setItems((prev) => {
        const sorted = prev.slice().sort((a, b) => a.orderIndex - b.orderIndex);
        const idx = sorted.findIndex((x) => x.id === item.id);
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

  function handleDelete(item: LectureItemRow) {
    setPendingId(item.id);
    startTransition(async () => {
      await deleteLectureItem(item.id, lecturePath);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setPendingId(null);
    });
  }

  function handleAddQuizCard() {
    if (!hasQuiz) {
      startTransition(async () => {
        await setLectureHasQuiz(lectureId, true, lecturePath);
        setHasQuiz(true);
        setQuizOpen(true);
      });
    } else {
      setQuizOpen(true);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <ContentBreadcrumb
          items={[
            { label: t.content.breadcrumbRoot, href: "/content" },
            { label: t.content.levelLabels[level - 1] ?? level, href: `/content/${level}` },
            { label: channelName, href: `/content/${level}/${channelId}` },
            { label: courseTitle, href: `/content/${level}/${channelId}/${courseId}` },
            { label: lectureTitle },
          ]}
        />

        <div>
          <h1 className="text-2xl font-bold accent-gradient-text">{lectureTitle}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t.content.items.pageSubtitle}</p>
        </div>

        {loadError && (
          <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--danger)]">
            {t.content.loadError}: {loadError}
          </div>
        )}

        {items.length === 0 && !hasQuiz && (
          <p className="text-sm text-[var(--text-muted)]">{t.content.items.empty}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--glass-highlight)] text-[var(--ice-300)]">
                  {item.type === "video" ? <Video size={17} /> : <FileText size={17} />}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleMove(item, "up")}
                    disabled={idx <= 0 || (isPending && pendingId === item.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--ice-300)] disabled:opacity-30 transition"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => handleMove(item, "down")}
                    disabled={idx === items.length - 1 || (isPending && pendingId === item.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--ice-300)] disabled:opacity-30 transition"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium truncate">{item.title}</p>
              <div className="flex items-center gap-1.5 mt-auto pt-1">
                <button
                  onClick={() => setFormState({ type: item.type, editing: item })}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--glass-border)] py-1.5 text-[11px] text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition"
                >
                  <Pencil size={12} />
                  {t.content.items.edit}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={isPending && pendingId === item.id}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--danger)]/30 py-1.5 text-[11px] text-[var(--danger)] hover:bg-[var(--danger)]/10 transition disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {t.content.items.delete}
                </button>
              </div>
            </div>
          ))}

          {hasQuiz && (
            <button
              onClick={() => setQuizOpen(true)}
              className="group flex flex-col gap-2 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 hover:border-[var(--ice-300)] transition text-start"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--glass-highlight)] text-[var(--ice-300)]">
                <HelpCircle size={17} />
              </span>
              <p className="text-sm font-medium">{t.content.items.typeQuiz}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{t.content.quiz.manage}</p>
            </button>
          )}

          <AddCard
            label={t.content.channels.addButton === "Add Channel" ? "Add" : "إضافة"}
            onClick={() => setPickTypeOpen(true)}
          />
        </div>
      </div>

      {pickTypeOpen && (
        <PickTypeModal
          hasQuiz={hasQuiz}
          onClose={() => setPickTypeOpen(false)}
          onPick={(type) => {
            setPickTypeOpen(false);
            if (type === "quiz") handleAddQuizCard();
            else setFormState({ type, editing: null });
          }}
        />
      )}

      {formState && (
        <ItemFormModal
          type={formState.type}
          editing={formState.editing}
          lectureId={lectureId}
          courseId={courseId}
          lecturePath={lecturePath}
          onClose={() => setFormState(null)}
          onSaved={(saved, isNew) => {
            setItems((prev) =>
              (isNew ? [...prev, saved] : prev.map((i) => (i.id === saved.id ? saved : i))).sort(
                (a, b) => a.orderIndex - b.orderIndex
              )
            );
            setFormState(null);
          }}
        />
      )}

      {quizOpen && (
        <QuizManagerModal
          lectureId={lectureId}
          lecturePath={lecturePath}
          quizSettingsInitial={quizSettingsInitial}
          onClose={() => setQuizOpen(false)}
          onArchived={() => {
            setHasQuiz(false);
            setQuizOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

function PickTypeModal({
  hasQuiz,
  onClose,
  onPick,
}: {
  hasQuiz: boolean;
  onClose: () => void;
  onPick: (type: "video" | "pdf" | "quiz") => void;
}) {
  const { t } = useLocale();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">{t.content.items.pickTypeTitle}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onPick("video")}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--glass-border)] py-4 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition"
          >
            <Video size={20} />
            {t.content.items.typeVideo}
          </button>
          <button
            onClick={() => onPick("pdf")}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--glass-border)] py-4 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition"
          >
            <FileText size={20} />
            {t.content.items.typePdf}
          </button>
          <button
            onClick={() => onPick("quiz")}
            disabled={hasQuiz}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--glass-border)] py-4 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition disabled:opacity-40"
          >
            <HelpCircle size={20} />
            {t.content.items.typeQuiz}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemFormModal({
  type,
  editing,
  lectureId,
  courseId,
  lecturePath,
  onClose,
  onSaved,
}: {
  type: "video" | "pdf";
  editing: LectureItemRow | null;
  lectureId: string;
  courseId: string;
  lecturePath: string;
  onClose: () => void;
  onSaved: (item: LectureItemRow, isNew: boolean) => void;
}) {
  const { t } = useLocale();
  const [itemTitle, setItemTitle] = useState(editing?.title ?? "");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isUnlimitedViews, setIsUnlimitedViews] = useState(true);
  const [viewLimitValue, setViewLimitValue] = useState("");
  const [editingLectureVideoId, setEditingLectureVideoId] = useState<string | null>(null);
  const [isPdfDownloadAllowed, setIsPdfDownloadAllowed] = useState(false);
  const [isPdfUnlimitedViews, setIsPdfUnlimitedViews] = useState(false);
  const [pdfViewLimitValue, setPdfViewLimitValue] = useState("1");
  const [editingLecturePdfId, setEditingLecturePdfId] = useState<string | null>(null);

  const isNewPdf = type === "pdf" && !editing;
  const isNewVideo = type === "video" && !editing;
  const isBusy = isPending || isUploadingVideo;

  useEffect(() => {
    if (editing && editing.type === "video") {
      getVideoViewLimit(editing.id).then((res) => {
        if (res.lectureVideoId) {
          setEditingLectureVideoId(res.lectureVideoId);
          if (res.viewLimit === null) {
            setIsUnlimitedViews(true);
            setViewLimitValue("");
          } else {
            setIsUnlimitedViews(false);
            setViewLimitValue(String(res.viewLimit));
          }
        }
      });
    }
    if (editing && editing.type === "pdf") {
      getPdfSettings(editing.id).then((res) => {
        if (res.lecturePdfId) {
          setEditingLecturePdfId(res.lecturePdfId);
          setIsPdfDownloadAllowed(res.allowDownload);
          if (res.viewLimit === null) {
            setIsPdfUnlimitedViews(true);
            setPdfViewLimitValue("1");
          } else {
            setIsPdfUnlimitedViews(false);
            setPdfViewLimitValue(String(res.viewLimit));
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function uploadToCloudinary(
    file: File,
    cloudName: string,
    uploadPreset: string
  ): Promise<{ secureUrl: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ secureUrl: data.secure_url, publicId: data.public_id });
          } catch {
            reject(new Error("رد غير متوقع من Cloudinary"));
          }
        } else {
          reject(new Error(`فشل الرفع لـCloudinary (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("فشل الاتصال بـCloudinary"));
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      xhr.send(formData);
    });
  }

  async function handleVideoUploadFlow() {
    if (!videoFile) {
      setFormError(t.content.items.pdfFileRequired);
      return;
    }
    setFormError(null);
    setIsUploadingVideo(true);
    setUploadProgress(0);

    try {
      const target = await getCloudinaryUploadTarget(courseId);
      if (target.error || !target.cloudName || !target.uploadPreset || !target.accountId) {
        setFormError(target.error || "تعذر تجهيز الرفع");
        setIsUploadingVideo(false);
        return;
      }

      const { secureUrl, publicId } = await uploadToCloudinary(videoFile, target.cloudName, target.uploadPreset);

      const createFormData = new FormData();
      createFormData.set("lectureId", lectureId);
      createFormData.set("courseId", courseId);
      createFormData.set("type", "video");
      createFormData.set("title", itemTitle.trim());

      const createRes = await createLectureItem(createFormData, lecturePath);
      if (createRes.error || !createRes.itemId) {
        setFormError(createRes.error || "فشل إنشاء عنصر المحاضرة");
        setIsUploadingVideo(false);
        return;
      }

      const parsedLimit = isUnlimitedViews ? null : Math.max(1, parseInt(viewLimitValue, 10) || 1);
      const attachRes = await attachCloudinaryVideo(
        createRes.itemId,
        target.accountId,
        secureUrl,
        publicId,
        itemTitle.trim(),
        parsedLimit,
        lecturePath
      );
      if (attachRes.error) {
        setFormError(attachRes.error);
        setIsUploadingVideo(false);
        return;
      }

      setIsUploadingVideo(false);
      onSaved(
        {
          id: createRes.itemId,
          lectureId,
          type: "video",
          title: itemTitle.trim(),
          url: secureUrl,
          orderIndex: 999999,
          createdAt: new Date().toISOString(),
        },
        true
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "حدث خطأ أثناء رفع الفيديو");
      setIsUploadingVideo(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemTitle.trim()) return setFormError(t.content.items.itemNameRequired);

    if (isNewVideo) {
      handleVideoUploadFlow();
      return;
    }

    if (isNewPdf && !pdfFile) return setFormError(t.content.items.pdfFileRequired);
    setFormError(null);

    const formData = new FormData();
    if (editing) formData.set("id", editing.id);
    formData.set("lectureId", lectureId);
    formData.set("courseId", courseId);
    formData.set("type", type);
    formData.set("title", itemTitle.trim());
    if (isNewPdf && pdfFile) {
      formData.set("pdfFile", pdfFile);
      formData.set("allowDownload", String(isPdfDownloadAllowed));
      const pdfLimit =
        isPdfDownloadAllowed || isPdfUnlimitedViews
          ? ""
          : String(Math.max(1, parseInt(pdfViewLimitValue, 10) || 1));
      formData.set("viewLimit", pdfLimit);
    } else if (editing) {
      formData.set("url", editing.url);
    }

    startTransition(async () => {
      const res = editing
        ? await updateLectureItem(formData, lecturePath)
        : await createLectureItem(formData, lecturePath);
      if (res.error) {
        setFormError(res.error);
        return;
      }

      if (editing && type === "video" && editingLectureVideoId) {
        const parsedLimit = isUnlimitedViews ? null : Math.max(1, parseInt(viewLimitValue, 10) || 1);
        await updateVideoViewLimit(editingLectureVideoId, parsedLimit, lecturePath);
      }

      if (editing && type === "pdf" && editingLecturePdfId) {
        const parsedPdfLimit =
          isPdfDownloadAllowed || isPdfUnlimitedViews
            ? null
            : Math.max(1, parseInt(pdfViewLimitValue, 10) || 1);
        await updatePdfSettings(editingLecturePdfId, isPdfDownloadAllowed, parsedPdfLimit, lecturePath);
      }

      onSaved(
        {
          id: editing?.id ?? (res.itemId as string),
          lectureId,
          type,
          title: itemTitle.trim(),
          url: editing?.url ?? "",
          orderIndex: editing?.orderIndex ?? 999999,
          createdAt: editing?.createdAt ?? new Date().toISOString(),
        },
        !editing
      );
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {type === "video" ? (
              <Video size={18} className="text-[var(--ice-300)]" />
            ) : (
              <FileText size={18} className="text-[var(--ice-300)]" />
            )}
            <h2 className="font-semibold text-base">
              {type === "video" ? t.content.items.typeVideo : t.content.items.typePdf}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isUploadingVideo}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            placeholder={t.content.items.itemNamePlaceholder}
            disabled={isUploadingVideo}
            className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition disabled:opacity-60"
          />

          <div className="flex flex-col gap-1">
            {isNewVideo ? (
              <>
                <input
                  type="file"
                  accept="video/*"
                  disabled={isUploadingVideo}
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition file:mr-2 file:rounded-md file:border-0 file:bg-[var(--ice-300)]/20 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[var(--ice-300)] disabled:opacity-60"
                />
                {videoFile && !isUploadingVideo && (
                  <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate" dir="ltr">
                    {videoFile.name} — {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
                  </p>
                )}
                {isUploadingVideo && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--ice-300)]">
                      <UploadCloud size={13} className="animate-pulse" />
                      {t.content.items.videoUploading} — {uploadProgress}%
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--glass-highlight)] overflow-hidden">
                      <div className="h-full accent-gradient transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-[var(--text-muted)]">{t.content.items.videoFileHint}</p>
              </>
            ) : isNewPdf ? (
              <>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition file:mr-2 file:rounded-md file:border-0 file:bg-[var(--ice-300)]/20 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[var(--ice-300)]"
                />
                {pdfFile && (
                  <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate" dir="ltr">
                    {pdfFile.name} — {(pdfFile.size / (1024 * 1024)).toFixed(1)}MB
                  </p>
                )}
                <p className="text-[11px] text-[var(--text-muted)]">{t.content.items.pdfFileHint}</p>
              </>
            ) : null}
          </div>

          {type === "video" && (isNewVideo || (editing && editingLectureVideoId)) && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--glass-border)] p-2.5">
              <label className="text-xs text-[var(--text-muted)]">{t.content.items.viewLimitLabel}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  disabled={isUnlimitedViews || isUploadingVideo}
                  value={viewLimitValue}
                  onChange={(e) => setViewLimitValue(e.target.value)}
                  placeholder={t.content.items.viewLimitPlaceholder}
                  className="flex-1 min-w-0 rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition disabled:opacity-40"
                />
                <button
                  type="button"
                  disabled={isUploadingVideo}
                  onClick={() => setIsUnlimitedViews((v) => !v)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition disabled:opacity-50 ${
                    isUnlimitedViews
                      ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                      : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                  }`}
                >
                  <span>♾️</span>
                  {t.content.items.viewLimitUnlimited}
                </button>
              </div>
            </div>
          )}

          {(isNewPdf || (editing && editingLecturePdfId)) && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--glass-border)] p-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[var(--text-muted)]">السماح بتحميل الملف على الجهاز</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsPdfDownloadAllowed((v) => {
                      const next = !v;
                      if (next) setIsPdfUnlimitedViews(true);
                      return next;
                    });
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                    isPdfDownloadAllowed
                      ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                      : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                  }`}
                >
                  {isPdfDownloadAllowed ? "مسموح" : "غير مسموح"}
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)]">حد عدد مرات الفتح</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    disabled={isPdfUnlimitedViews || isPdfDownloadAllowed}
                    value={pdfViewLimitValue}
                    onChange={(e) => setPdfViewLimitValue(e.target.value)}
                    placeholder="عدد مرات الفتح المسموحة"
                    className="flex-1 min-w-0 rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition disabled:opacity-40"
                  />
                  <button
                    type="button"
                    disabled={isPdfDownloadAllowed}
                    onClick={() => setIsPdfUnlimitedViews((v) => !v)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition disabled:opacity-50 ${
                      isPdfUnlimitedViews
                        ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                        : "border-[var(--glass-border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <span>♾️</span>
                    غير محدود
                  </button>
                </div>
                {isPdfDownloadAllowed && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    مفعّل تلقائيًا "غير محدود" لأن التحميل مسموح — مينفعش يتحدد عدد فتحات مع تفعيل التحميل.
                  </p>
                )}
              </div>
            </div>
          )}

          {formError && <p className="text-xs text-[var(--danger)]">{formError}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploadingVideo}
              className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-50"
            >
              {t.content.cancel}
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="accent-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {isUploadingVideo
                ? `${t.content.items.videoUploading} ${uploadProgress}%`
                : isPending
                ? t.content.saving
                : t.content.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  إدارة الكويز — كتابة يدوية أو رفع من Excel                          */
/* ------------------------------------------------------------------ */

function QuizManagerModal({
  lectureId,
  lecturePath,
  quizSettingsInitial,
  onClose,
  onArchived,
}: {
  lectureId: string;
  lecturePath: string;
  quizSettingsInitial: QuizSettings;
  onClose: () => void;
  onArchived: () => void;
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState<"manual" | "upload" | "settings" | "results">("manual");
  const [questions, setQuestions] = useState<QuizQuestionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestionRow | null | "new">(null);

  function reload() {
    fetchQuizQuestions(lectureId).then((res) => {
      setQuestions(res.questions);
      setLoadError(res.error);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-[var(--ice-300)]" />
            <h2 className="font-semibold text-base">{t.content.quiz.manage}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
              tab === "manual"
                ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)]"
            }`}
          >
            {t.content.quiz.manualTab}
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
              tab === "upload"
                ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)]"
            }`}
          >
            {t.content.quiz.uploadTab}
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
              tab === "settings"
                ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)]"
            }`}
          >
            {t.content.quiz.settingsTab}
          </button>
          <button
            onClick={() => setTab("results")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
              tab === "results"
                ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)]"
            }`}
          >
            {t.content.quiz.resultsTab}
          </button>
        </div>

        {tab === "manual" && (
          <>
            {editingQuestion ? (
              <QuestionForm
                lectureId={lectureId}
                lecturePath={lecturePath}
                editing={editingQuestion === "new" ? null : editingQuestion}
                onCancel={() => setEditingQuestion(null)}
                onSaved={() => {
                  setEditingQuestion(null);
                  reload();
                }}
              />
            ) : (
              <>
                <button
                  onClick={() => setEditingQuestion("new")}
                  className="accent-gradient flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 w-full mb-4"
                >
                  <Plus size={16} />
                  {t.content.quiz.addQuestion}
                </button>

                {loadError && <p className="text-xs text-[var(--danger)] mb-2">{loadError}</p>}
                {questions !== null && (
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    {t.content.quiz.questionsCount}: {questions.length}
                  </p>
                )}
                {questions !== null && questions.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">{t.content.quiz.noQuestions}</p>
                )}
                {questions !== null && questions.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {questions.map((q) => (
                      <li
                        key={q.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">{q.questionText}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {q.type === "mcq" ? t.content.quiz.typeMcq : t.content.quiz.typeTrueFalse}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingQuestion(q)}
                            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--ice-300)] hover:bg-[var(--glass-highlight)] transition"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() =>
                              startTransitionDelete(q.id, lecturePath, () => reload())
                            }
                            className="p-1.5 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}

        {tab === "upload" && <UploadSheetForm lectureId={lectureId} lecturePath={lecturePath} onDone={reload} />}

        {tab === "settings" && (
          <QuizSettingsPanel
            lectureId={lectureId}
            lecturePath={lecturePath}
            initial={quizSettingsInitial}
            onArchived={onArchived}
          />
        )}

        {tab === "results" && <QuizResultsPanel lectureId={lectureId} lecturePath={lecturePath} />}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {t.content.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// حذف سؤال بدون الحاجة لـuseTransition جوه الـmap نفسه
function startTransitionDelete(questionId: string, lecturePath: string, done: () => void) {
  deleteQuizQuestion(questionId, lecturePath).then(done);
}

/* ------------------------------------------------------------------ */
/*  إعدادات الاختبار: عدد الأسئلة/المحاولات/الإجبارية/وضع المراجعة       */
/*  + حذف الاختبار (أرشفة) عشان يترفع من جديد                          */
/* ------------------------------------------------------------------ */

function QuizSettingsPanel({
  lectureId,
  lecturePath,
  initial,
  onArchived,
}: {
  lectureId: string;
  lecturePath: string;
  initial: QuizSettings;
  onArchived: () => void;
}) {
  const { t } = useLocale();
  const [settings, setSettings] = useState<QuizSettings>(initial);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [grantUsername, setGrantUsername] = useState("");
  const [isGranting, startGrantTransition] = useTransition();
  const [grantMessage, setGrantMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function toDatetimeLocalValue(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateQuizSettings(lectureId, settings, lecturePath);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  function handleDelete() {
    if (!window.confirm(t.content.quiz.deleteQuizConfirm)) return;
    startDeleteTransition(async () => {
      const res = await archiveLectureQuiz(lectureId, lecturePath);
      if (res.error) {
        setError(res.error);
        return;
      }
      onArchived();
    });
  }

  function handleGrant() {
    setGrantMessage(null);
    startGrantTransition(async () => {
      const res = await grantExtraQuizAttempt(lectureId, grantUsername, lecturePath);
      if (res.error) {
        setGrantMessage({ text: res.error, ok: false });
        return;
      }
      setGrantMessage({ text: t.content.quiz.grantAttemptSuccess, ok: true });
      setGrantUsername("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.settingsQuestionCount}
        </label>
        <input
          type="number"
          min={1}
          value={settings.quizQuestionCount ?? ""}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              quizQuestionCount: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
            }))
          }
          placeholder={t.content.quiz.settingsQuestionCountHint}
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)]"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">{t.content.quiz.settingsQuestionCountHint}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.settingsMaxAttempts}
        </label>
        <input
          type="number"
          min={1}
          value={settings.quizMaxAttempts ?? ""}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              quizMaxAttempts: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
            }))
          }
          placeholder={t.content.quiz.settingsMaxAttemptsHint}
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)]"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">{t.content.quiz.settingsMaxAttemptsHint}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.settingsDuration}
        </label>
        <input
          type="number"
          min={1}
          value={settings.quizDurationMinutes ?? ""}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              quizDurationMinutes: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
            }))
          }
          placeholder={t.content.quiz.settingsDurationHint}
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)]"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">{t.content.quiz.settingsDurationHint}</p>
      </div>

      <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5">
        <span className="text-sm">{t.content.quiz.settingsMandatory}</span>
        <input
          type="checkbox"
          checked={settings.quizMandatory}
          onChange={(e) => setSettings((s) => ({ ...s, quizMandatory: e.target.checked }))}
          className="h-4 w-4 accent-[var(--ice-300)]"
        />
      </label>
      <p className="text-[11px] text-[var(--text-muted)] -mt-3">{t.content.quiz.settingsMandatoryHint}</p>

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.settingsReviewMode}
        </label>
        <div className="flex flex-col gap-2">
          {(["never", "anytime", "scheduled"] as QuizReviewMode[]).map((mode) => (
            <label
              key={mode}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                settings.quizReviewMode === mode
                  ? "border-[var(--ice-300)] bg-[var(--ice-300)]/10"
                  : "border-[var(--glass-border)]"
              }`}
            >
              <input
                type="radio"
                name="quizReviewMode"
                checked={settings.quizReviewMode === mode}
                onChange={() => setSettings((s) => ({ ...s, quizReviewMode: mode }))}
                className="accent-[var(--ice-300)]"
              />
              {mode === "never" && t.content.quiz.reviewModeNever}
              {mode === "anytime" && t.content.quiz.reviewModeAnytime}
              {mode === "scheduled" && t.content.quiz.reviewModeScheduled}
            </label>
          ))}
        </div>
      </div>

      {settings.quizReviewMode === "scheduled" && (
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            {t.content.quiz.settingsReviewAt}
          </label>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(settings.quizReviewAvailableAt)}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                quizReviewAvailableAt: e.target.value ? new Date(e.target.value).toISOString() : null,
              }))
            }
            className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)]"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.settingsReviewLockedMessage}
        </label>
        <textarea
          rows={2}
          value={settings.quizReviewLockedMessage ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, quizReviewLockedMessage: e.target.value }))}
          placeholder={t.content.quiz.settingsReviewLockedMessageHint}
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.settingsAttemptsExhaustedMessage}
        </label>
        <textarea
          rows={2}
          value={settings.quizAttemptsExhaustedMessage ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, quizAttemptsExhaustedMessage: e.target.value }))}
          placeholder={t.content.quiz.settingsAttemptsExhaustedMessageHint}
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] resize-none"
        />
      </div>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {saved && !error && <p className="text-xs text-emerald-500">{t.content.quiz.settingsSaved}</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="accent-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {t.content.quiz.settingsSave}
      </button>

      <div className="border-t border-[var(--glass-border)] pt-4 mt-1">
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t.content.quiz.grantAttemptLabel}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={grantUsername}
            onChange={(e) => setGrantUsername(e.target.value)}
            placeholder={t.content.quiz.grantAttemptPlaceholder}
            className="flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)]"
          />
          <button
            onClick={handleGrant}
            disabled={isGranting || !grantUsername.trim()}
            className="rounded-lg border border-[var(--ice-300)] text-[var(--ice-300)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--ice-300)]/10 disabled:opacity-50"
          >
            {t.content.quiz.grantAttemptButton}
          </button>
        </div>
        {grantMessage && (
          <p className={`text-xs mt-1.5 ${grantMessage.ok ? "text-emerald-500" : "text-[var(--danger)]"}`}>
            {grantMessage.text}
          </p>
        )}
      </div>

      <div className="border-t border-[var(--glass-border)] pt-4 mt-1">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[var(--danger)] text-[var(--danger)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--danger)]/10 disabled:opacity-60"
        >
          <Trash2 size={16} />
          {t.content.quiz.deleteQuiz}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  نتائج الطلاب في الاختبار، من الأعلى للأقل                          */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function QuizResultsPanel({ lectureId, lecturePath }: { lectureId: string; lecturePath: string }) {
  const { t } = useLocale();
  const [entries, setEntries] = useState<QuizLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function load() {
    fetchQuizLeaderboard(lectureId).then((res) => {
      if (res.error) {
        setError(res.error);
        return;
      }
      setEntries(res.entries);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId]);

  function handleDelete(resultId: string) {
    if (!window.confirm(t.content.quiz.deleteAttemptConfirm)) return;
    setPendingDeleteId(resultId);
    startDeleteTransition(async () => {
      const res = await deleteQuizAttempt(resultId, lecturePath);
      setPendingDeleteId(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEntries((prev) => (prev ? prev.filter((e) => e.resultId !== resultId) : prev));
    });
  }

  if (error) return <p className="text-xs text-[var(--danger)]">{error}</p>;
  if (entries === null) {
    return <p className="text-sm text-[var(--text-secondary)]">{t.content.quiz.resultsLoading}</p>;
  }
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">{t.content.quiz.resultsEmpty}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
        {entries.map((entry, i) => (
          <div
            key={entry.resultId}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 text-xs text-[var(--text-secondary)] font-medium shrink-0">#{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm truncate">{entry.username}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {entry.answeredCount}/{entry.totalCount} · {formatDuration(entry.durationSeconds)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`text-sm font-semibold ${entry.passed ? "text-emerald-500" : "text-[var(--danger)]"}`}
              >
                {entry.score}%
              </span>
              <button
                onClick={() => setReviewingId(entry.resultId)}
                title={t.content.quiz.reviewAttempt}
                className="p-1.5 rounded-md text-[var(--ice-300)] hover:bg-[var(--ice-300)]/10 transition"
              >
                <Eye size={15} />
              </button>
              <button
                onClick={() => handleDelete(entry.resultId)}
                disabled={deletingId && pendingDeleteId === entry.resultId}
                title={t.content.quiz.deleteAttempt}
                className="p-1.5 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {reviewingId && (
        <QuizAttemptReviewModal resultId={reviewingId} onClose={() => setReviewingId(null)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  تفاصيل محاولة طالب: كل سؤال ظهرله، اختياره، والإجابة الصح          */
/* ------------------------------------------------------------------ */

function QuizAttemptReviewModal({ resultId, onClose }: { resultId: string; onClose: () => void }) {
  const { t } = useLocale();
  const [detail, setDetail] = useState<QuizAttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchQuizAttemptDetail(resultId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        return;
      }
      setDetail(res.detail);
    });
    return () => {
      active = false;
    };
  }, [resultId]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="glass-panel rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t.content.quiz.reviewAttempt}</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

        {!error && !detail && (
          <p className="text-sm text-[var(--text-secondary)]">{t.content.quiz.resultsLoading}</p>
        )}

        {detail && (
          <>
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-2 border-b border-[var(--glass-border)]">
              <span>
                {detail.answeredCount}/{detail.totalCount} · {formatDuration(detail.durationSeconds)}
              </span>
              <span className={`font-semibold ${detail.passed ? "text-emerald-500" : "text-[var(--danger)]"}`}>
                {detail.score}%
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {detail.answers.map((a, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 text-sm"
                >
                  <p className="font-medium mb-1.5">
                    {i + 1}. {a.questionText}
                  </p>
                  <p className={a.isCorrect ? "text-emerald-500" : "text-[var(--danger)]"}>
                    {t.content.quiz.studentAnswerLabel}: {a.selectedOptionText ?? t.content.quiz.noAnswerLabel}
                  </p>
                  {!a.isCorrect && (
                    <p className="text-emerald-500">
                      {t.content.quiz.correctAnswerLabel}: {a.correctOptionText ?? "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionForm({
  lectureId,
  lecturePath,
  editing,
  onCancel,
  onSaved,
}: {
  lectureId: string;
  lecturePath: string;
  editing: QuizQuestionRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [questionText, setQuestionText] = useState(editing?.questionText ?? "");
  const [type, setType] = useState<QuizQuestionType>(editing?.type ?? "mcq");
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>(
    editing
      ? editing.options.map((o) => ({ text: o.optionText, isCorrect: o.isCorrect }))
      : [
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
        ]
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTypeChange(next: QuizQuestionType) {
    setType(next);
    if (next === "true_false") {
      setOptions([
        { text: "صح", isCorrect: true },
        { text: "خطأ", isCorrect: false },
      ]);
    } else {
      setOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ]);
    }
  }

  function updateOption(idx: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  }

  function setCorrect(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
  }

  function addOption() {
    if (options.length >= 4) return;
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionText.trim()) return setError(t.content.quiz.questionRequired);
    const cleanOptions = options.filter((o) => o.text.trim().length > 0);
    if (cleanOptions.length < 2) return setError(t.content.quiz.optionsRequired);
    if (!cleanOptions.some((o) => o.isCorrect)) return setError(t.content.quiz.correctRequired);
    setError(null);

    startTransition(async () => {
      const res = editing
        ? await updateQuizQuestion(editing.id, questionText.trim(), type, cleanOptions, lecturePath)
        : await createQuizQuestion(lectureId, questionText.trim(), type, cleanOptions, lecturePath);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 mb-4"
    >
      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder={t.content.quiz.questionText}
        rows={2}
        className="rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition resize-none"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleTypeChange("mcq")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
            type === "mcq"
              ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
              : "border-[var(--glass-border)] text-[var(--text-secondary)]"
          }`}
        >
          {t.content.quiz.typeMcq}
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange("true_false")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
            type === "true_false"
              ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
              : "border-[var(--glass-border)] text-[var(--text-secondary)]"
          }`}
        >
          {t.content.quiz.typeTrueFalse}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((o, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={o.isCorrect}
              onChange={() => setCorrect(idx)}
              className="h-4 w-4 accent-[var(--success)] shrink-0"
              title={t.content.quiz.correctOption}
            />
            <input
              value={o.text}
              onChange={(e) => updateOption(idx, e.target.value)}
              disabled={type === "true_false"}
              placeholder={`${t.content.quiz.option} ${idx + 1}`}
              className="flex-1 min-w-0 rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition disabled:opacity-60"
            />
            {type === "mcq" && options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="p-1.5 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {type === "mcq" && options.length < 4 && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 self-start text-xs text-[var(--ice-300)] hover:brightness-110 transition"
          >
            <Plus size={13} />
            {t.content.quiz.addOption}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          {t.content.cancel}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="accent-gradient rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? t.content.saving : t.content.save}
        </button>
      </div>
    </form>
  );
}

function UploadSheetForm({
  lectureId,
  lecturePath,
  onDone,
}: {
  lectureId: string;
  lecturePath: string;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload() {
    if (!file) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await uploadQuizSheet(lectureId, file, replaceExisting, lecturePath);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(res.imported ?? 0);
      setFile(null);
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="cursor-pointer rounded-xl border border-dashed border-[var(--glass-border)] px-3 py-4 text-xs text-[var(--text-secondary)] hover:border-[var(--ice-300)] transition text-center">
        {file ? file.name : t.content.quiz.uploadSheetButton}
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <p className="text-[11px] text-[var(--text-muted)]">{t.content.quiz.uploadSheetHint}</p>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={replaceExisting}
          onChange={(e) => setReplaceExisting(e.target.checked)}
          className="h-4 w-4 rounded accent-[var(--ice-300)]"
        />
        <span className="text-sm text-[var(--text-secondary)]">{t.content.quiz.replaceExisting}</span>
      </label>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {success !== null && (
        <p className="text-xs text-[var(--success)]">
          {t.content.quiz.uploadSuccess} ({success})
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isPending}
        className="accent-gradient flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        <UploadCloud size={16} />
        {isPending ? t.content.quiz.uploading : t.content.quiz.uploadSheetButton}
      </button>
    </div>
  );
}
