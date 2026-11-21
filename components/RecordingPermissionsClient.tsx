"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, Plus, Pencil, Trash2, X, Search, AlertTriangle } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import {
  addRecordingPermissions,
  updateRecordingPermission,
  deleteRecordingPermission,
  fetchCoursesForChannel,
  fetchLecturesForCourse,
} from "@/app/recording-permissions/actions";
import type {
  PermissionChannelOption,
  PermissionMode,
  PermissionRow,
  PermissionScopeInput,
  PermissionScopeType,
  PickItem,
  ReviewMode,
} from "@/lib/recording-permissions";

const TXT = {
  ar: {
    title: "صلاحيات الريكوردات",
    subtitleOwner:
      "تحدد أي طالب يقدر يسجّل بالمايك أو يرفع ملف صوت في المحاضرات، وفي أي نطاق، وهل تسجيلاته تنزل على طول ولا تحتاج مراجعتك.",
    subtitleSupervisor:
      "تدّي طالب صلاحية الريكورد على موادّك ومحاضراتك. تسجيلات الطلاب دول بتحتاج مراجعة المالك قبل ما تظهر للطلاب.",
    add: "إضافة صلاحية",
    search: "ابحث بيوزر الطالب...",
    colStudent: "الطالب",
    colScope: "النطاق",
    colMode: "الصلاحية",
    colReview: "المراجعة",
    colBy: "منحها",
    colActions: "إجراءات",
    empty: "لا توجد صلاحيات بعد",
    modeBoth: "تسجيل + رفع ملف",
    modeRecord: "تسجيل بالمايك فقط",
    modeUpload: "رفع ملف فقط",
    reviewAuto: "تنزل على طول",
    reviewReview: "تحتاج مراجعة",
    byOwner: "المالك",
    modalAdd: "إضافة صلاحية ريكورد",
    modalEdit: "تعديل الصلاحية",
    username: "يوزر نيم الطالب",
    permissionType: "نوع الصلاحية",
    reviewRule: "قاعدة المراجعة",
    reviewSupervisorNote: "تسجيلات الطالب ده هتحتاج مراجعة المالك قبل ما تظهر للطلاب.",
    scopes: "النطاقات",
    scopesHint: "اختار واحد أو أكتر. لو الطالب ليه أكتر من نطاق بقواعد مختلفة بيتطبق الأشد (المراجعة).",
    scopeType: "نوع النطاق",
    scopeApp: "التطبيق كله",
    scopeLevel: "فرقة أو أكتر",
    scopeChannel: "قناة أو أكتر",
    scopeCourse: "مادة أو أكتر",
    scopeLecture: "محاضرة أو أكتر",
    level: "الفرقة",
    channel: "القناة",
    course: "المادة",
    chooseLevel: "اختار الفرقة",
    chooseChannel: "اختار القناة",
    chooseCourse: "اختار المادة",
    loading: "جاري التحميل...",
    nothingToPick: "لا يوجد",
    addToScopes: "إضافة للنطاقات",
    appWholeLabel: "التطبيق كله",
    noScopesYet: "لسه ما اخترتش نطاقات",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "جارٍ الحفظ...",
    deleteTitle: "حذف الصلاحية",
    deleteBody: "الطالب هيفقد الصلاحية دي. التسجيلات اللي اتعملت قبل كده بتفضل زي ما هي.",
    delete: "حذف",
    deleting: "جارٍ الحذف...",
  },
  en: {
    title: "Recording Permissions",
    subtitleOwner:
      "Choose which students can record with the mic or upload an audio file in lectures, in which scope, and whether their recordings go live immediately or need your review.",
    subtitleSupervisor:
      "Give a student recording permission on your courses and lectures. These students' recordings need the owner's review before students can see them.",
    add: "Add permission",
    search: "Search by student username...",
    colStudent: "Student",
    colScope: "Scope",
    colMode: "Permission",
    colReview: "Review",
    colBy: "Granted by",
    colActions: "Actions",
    empty: "No permissions yet",
    modeBoth: "Record + upload a file",
    modeRecord: "Mic recording only",
    modeUpload: "Upload a file only",
    reviewAuto: "Goes live immediately",
    reviewReview: "Needs review",
    byOwner: "Owner",
    modalAdd: "Add recording permission",
    modalEdit: "Edit permission",
    username: "Student username",
    permissionType: "Permission type",
    reviewRule: "Review rule",
    reviewSupervisorNote: "This student's recordings will need the owner's review before they become visible.",
    scopes: "Scopes",
    scopesHint: "Pick one or more. If a student has several scopes with different rules, the strictest (review) applies.",
    scopeType: "Scope type",
    scopeApp: "Whole app",
    scopeLevel: "One or more years",
    scopeChannel: "One or more channels",
    scopeCourse: "One or more courses",
    scopeLecture: "One or more lectures",
    level: "Year",
    channel: "Channel",
    course: "Course",
    chooseLevel: "Choose a year",
    chooseChannel: "Choose a channel",
    chooseCourse: "Choose a course",
    loading: "Loading...",
    nothingToPick: "None",
    addToScopes: "Add to scopes",
    appWholeLabel: "Whole app",
    noScopesYet: "No scopes selected yet",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    deleteTitle: "Delete permission",
    deleteBody: "The student will lose this permission. Recordings made earlier stay as they are.",
    delete: "Delete",
    deleting: "Deleting...",
  },
} as const;

type Text = (typeof TXT)["ar"] | (typeof TXT)["en"];

const ERROR_EN: Record<string, string> = {
  "غير مصرّح": "Not authorized",
  "اكتب يوزر نيم الطالب": "Enter the student's username",
  "نوع الصلاحية غير صالح": "Invalid permission type",
  "اختار نطاق واحد على الأقل": "Select at least one scope",
  "عدد النطاقات كبير جدًا": "Too many scopes",
  "نطاق غير صالح": "Invalid scope",
  "لا يوجد طالب بهذا اليوزر نيم": "No student with this username",
  "المشرف يقدر يدّي صلاحية على المواد والمحاضرات بس": "Supervisors can grant permissions on courses and lectures only",
};

const inputClass =
  "w-full rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition";

interface SelectedScope {
  key: string;
  type: PermissionScopeType;
  id: string | null;
  level: number | null;
  label: string;
}

export function RecordingPermissionsClient({
  initialRows,
  channelOptions,
  isSupervisor,
  loadError,
}: {
  initialRows: PermissionRow[];
  channelOptions: PermissionChannelOption[];
  isSupervisor: boolean;
  loadError: string | null;
}) {
  const { locale, t: fullT } = useLocale();
  const router = useRouter();
  const t = TXT[locale === "ar" ? "ar" : "en"];
  const levelLabels = fullT.content.levelLabels;
  const tr = (msg: string | null) => (msg && locale !== "ar" ? ERROR_EN[msg] ?? msg : msg);

  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; row: PermissionRow } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? initialRows.filter((r) => r.username.toLowerCase().includes(q)) : initialRows;
  }, [initialRows, query]);

  const modeLabel = (m: PermissionMode) => (m === "both" ? t.modeBoth : m === "record" ? t.modeRecord : t.modeUpload);

  function scopeLabel(r: PermissionRow): string {
    switch (r.scopeType) {
      case "app":
        return t.appWholeLabel;
      case "level":
        return `${t.level}: ${levelLabels[(r.scopeLevel ?? 1) - 1] ?? r.scopeLevel}`;
      case "channel":
        return `${t.channel}: ${r.scopeName ?? "—"}`;
      case "course":
        return `${t.course}: ${r.scopeName ?? "—"}`;
      case "lecture":
        return `${r.scopeName ?? "—"}${r.scopeParent ? ` (${r.scopeParent})` : ""}`;
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold accent-gradient-text">{t.title}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
              {isSupervisor ? t.subtitleSupervisor : t.subtitleOwner}
            </p>
          </div>
          <button
            onClick={() => setModal({ mode: "add" })}
            className="accent-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-frost)] transition hover:brightness-110 w-fit"
          >
            <Plus size={18} />
            {t.add}
          </button>
        </div>

        {loadError && <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--danger)]">{loadError}</div>}

        <div className="relative max-w-sm">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-[var(--text-muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} className={`${inputClass} ps-9`} dir="ltr" />
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)] text-xs text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-medium text-start">{t.colStudent}</th>
                  <th className="px-4 py-3 font-medium text-start">{t.colScope}</th>
                  <th className="px-4 py-3 font-medium text-start">{t.colMode}</th>
                  <th className="px-4 py-3 font-medium text-start">{t.colReview}</th>
                  {!isSupervisor && <th className="px-4 py-3 font-medium text-start">{t.colBy}</th>}
                  <th className="px-4 py-3 font-medium text-start">{t.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={isSupervisor ? 5 : 6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      {t.empty}
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--glass-highlight)] transition">
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      <span className="inline-flex items-center gap-2">
                        <Mic size={13} className="text-[var(--ice-300)]" />@{r.username}
                      </span>
                    </td>
                    <td className="px-4 py-3">{scopeLabel(r)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--glass-border)] bg-[var(--glass-highlight)] px-2.5 py-0.5 text-xs whitespace-nowrap">
                        {modeLabel(r.mode)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${
                          r.reviewMode === "auto" ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {r.reviewMode === "auto" ? t.reviewAuto : t.reviewReview}
                      </span>
                    </td>
                    {!isSupervisor && (
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        {r.grantedByKind === "owner" ? t.byOwner : r.grantedByName ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModal({ mode: "edit", row: r })}
                          className="rounded-lg border border-[var(--glass-border)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="rounded-lg border border-[var(--danger)]/30 p-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <PermissionModal
          t={t}
          tr={tr}
          levelLabels={levelLabels}
          isSupervisor={isSupervisor}
          channelOptions={channelOptions}
          editing={modal.mode === "edit" ? modal.row : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-panel-strong w-full max-w-sm rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3 text-[var(--danger)]">
              <AlertTriangle size={20} />
              <h2 className="font-semibold text-base">{t.deleteTitle}</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-1" dir="ltr">
              @{deleteTarget.username}
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-4">{t.deleteBody}</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                {t.cancel}
              </button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteRecordingPermission(deleteTarget.id);
                    setDeleteTarget(null);
                    router.refresh();
                  })
                }
                disabled={isPending}
                className="rounded-xl bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {isPending ? t.deleting : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PermissionModal({
  t,
  tr,
  levelLabels,
  isSupervisor,
  channelOptions,
  editing,
  onClose,
  onSaved,
}: {
  t: Text;
  tr: (msg: string | null) => string | null;
  levelLabels: readonly string[];
  isSupervisor: boolean;
  channelOptions: PermissionChannelOption[];
  editing: PermissionRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<PermissionMode>(editing?.mode ?? "record");
  const [reviewMode, setReviewMode] = useState<ReviewMode>(isSupervisor ? "review" : editing?.reviewMode ?? "review");
  const [scopes, setScopes] = useState<SelectedScope[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = editing
        ? await updateRecordingPermission(editing.id, { mode, reviewMode })
        : await addRecordingPermissions({
            username,
            mode,
            reviewMode,
            scopes: scopes.map<PermissionScopeInput>((s) => ({ type: s.type, id: s.id, level: s.level })),
          });
      if (res.error) {
        setError(tr(res.error));
        return;
      }
      onSaved();
    });
  }

  const modes: { value: PermissionMode; label: string }[] = [
    { value: "both", label: t.modeBoth },
    { value: "record", label: t.modeRecord },
    { value: "upload", label: t.modeUpload },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-xl rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-[var(--ice-300)]" />
            <h2 className="font-semibold text-base">{editing ? t.modalEdit : t.modalAdd}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!editing ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">{t.username}</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" placeholder="@username" className={inputClass} />
            </div>
          ) : (
            <p className="text-sm font-mono" dir="ltr">
              @{editing.username}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--text-muted)]">{t.permissionType}</p>
            {modes.map((m) => (
              <label key={m.value} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="radio" name="perm-mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="h-4 w-4 accent-[var(--ice-300)]" />
                <span className="text-sm">{m.label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--text-muted)]">{t.reviewRule}</p>
            {isSupervisor ? (
              <p className="text-sm text-amber-400">{t.reviewSupervisorNote}</p>
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="perm-review" checked={reviewMode === "auto"} onChange={() => setReviewMode("auto")} className="h-4 w-4 accent-[var(--ice-300)]" />
                  <span className="text-sm">{t.reviewAuto}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="perm-review" checked={reviewMode === "review"} onChange={() => setReviewMode("review")} className="h-4 w-4 accent-[var(--ice-300)]" />
                  <span className="text-sm">{t.reviewReview}</span>
                </label>
              </>
            )}
          </div>

          {!editing && (
            <ScopeBuilder
              t={t}
              levelLabels={levelLabels}
              isSupervisor={isSupervisor}
              channelOptions={channelOptions}
              scopes={scopes}
              onChange={setScopes}
            />
          )}

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
              {t.cancel}
            </button>
            <button type="submit" disabled={isPending} className="accent-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-frost)] transition hover:brightness-110 disabled:opacity-60">
              {isPending ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScopeBuilder({
  t,
  levelLabels,
  isSupervisor,
  channelOptions,
  scopes,
  onChange,
}: {
  t: Text;
  levelLabels: readonly string[];
  isSupervisor: boolean;
  channelOptions: PermissionChannelOption[];
  scopes: SelectedScope[];
  onChange: (next: SelectedScope[]) => void;
}) {
  const typeOptions: { value: PermissionScopeType; label: string }[] = isSupervisor
    ? [
        { value: "course", label: t.scopeCourse },
        { value: "lecture", label: t.scopeLecture },
      ]
    : [
        { value: "app", label: t.scopeApp },
        { value: "level", label: t.scopeLevel },
        { value: "channel", label: t.scopeChannel },
        { value: "course", label: t.scopeCourse },
        { value: "lecture", label: t.scopeLecture },
      ];

  const levels = useMemo(
    () => Array.from(new Set(channelOptions.map((c) => c.levelNumber))).sort((a, b) => a - b),
    [channelOptions]
  );

  const [scopeType, setScopeType] = useState<PermissionScopeType>(typeOptions[0].value);
  const [level, setLevel] = useState<number | "">("");
  const [channelId, setChannelId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<PickItem[] | null>(null);
  const [lectures, setLectures] = useState<PickItem[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [levelChecks, setLevelChecks] = useState<Set<number>>(new Set());

  const channelsOfLevel = channelOptions.filter((c) => c.levelNumber === level);

  function resetPickers(type: PermissionScopeType) {
    setScopeType(type);
    setLevel("");
    setChannelId("");
    setCourseId("");
    setCourses(null);
    setLectures(null);
    setChecked(new Set());
    setLevelChecks(new Set());
  }

  // المواد بتتحمّل لما نختار قناة (لنطاق مادة أو محاضرة)
  useEffect(() => {
    if (!channelId || (scopeType !== "course" && scopeType !== "lecture")) return;
    let cancelled = false;
    setCourses(null);
    fetchCoursesForChannel(channelId).then((res) => {
      if (!cancelled) setCourses(res.items);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, scopeType]);

  // المحاضرات بتتحمّل لما نختار مادة (لنطاق محاضرة)
  useEffect(() => {
    if (!courseId || scopeType !== "lecture") return;
    let cancelled = false;
    setLectures(null);
    fetchLecturesForCourse(courseId).then((res) => {
      if (!cancelled) setLectures(res.items);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId, scopeType]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCurrent() {
    const additions: SelectedScope[] = [];
    if (scopeType === "app") {
      additions.push({ key: "app", type: "app", id: null, level: null, label: t.appWholeLabel });
    } else if (scopeType === "level") {
      for (const lv of levelChecks) {
        additions.push({ key: `level-${lv}`, type: "level", id: null, level: lv, label: `${t.level}: ${levelLabels[lv - 1] ?? lv}` });
      }
    } else if (scopeType === "channel") {
      for (const id of checked) {
        const ch = channelOptions.find((c) => c.id === id);
        additions.push({ key: `channel-${id}`, type: "channel", id, level: null, label: `${t.channel}: ${ch?.name ?? id}` });
      }
    } else if (scopeType === "course") {
      for (const id of checked) {
        const c = courses?.find((x) => x.id === id);
        additions.push({ key: `course-${id}`, type: "course", id, level: null, label: `${t.course}: ${c?.title ?? id}` });
      }
    } else if (scopeType === "lecture") {
      const parent = courses?.find((x) => x.id === courseId)?.title;
      for (const id of checked) {
        const l = lectures?.find((x) => x.id === id);
        additions.push({ key: `lecture-${id}`, type: "lecture", id, level: null, label: `${l?.title ?? id}${parent ? ` (${parent})` : ""}` });
      }
    }
    if (additions.length === 0) return;
    const existing = new Set(scopes.map((s) => s.key));
    onChange([...scopes, ...additions.filter((a) => !existing.has(a.key))]);
    setChecked(new Set());
    setLevelChecks(new Set());
  }

  const levelSelect = (
    <select
      value={level}
      onChange={(e) => {
        setLevel(e.target.value ? Number(e.target.value) : "");
        setChannelId("");
        setCourseId("");
        setCourses(null);
        setLectures(null);
        setChecked(new Set());
      }}
      className={inputClass}
    >
      <option value="">{t.chooseLevel}</option>
      {levels.map((lv) => (
        <option key={lv} value={lv}>
          {levelLabels[lv - 1] ?? lv}
        </option>
      ))}
    </select>
  );

  const channelSelect = (
    <select
      value={channelId}
      onChange={(e) => {
        setChannelId(e.target.value);
        setCourseId("");
        setCourses(null);
        setLectures(null);
        setChecked(new Set());
      }}
      disabled={level === ""}
      className={inputClass}
    >
      <option value="">{t.chooseChannel}</option>
      {channelsOfLevel.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  function checkboxList(items: { id: string; title: string }[] | null, ready: boolean) {
    if (!ready) return null;
    if (items === null) return <p className="text-[11px] text-[var(--text-muted)]">{t.loading}</p>;
    if (items.length === 0) return <p className="text-[11px] text-[var(--text-muted)]">{t.nothingToPick}</p>;
    return (
      <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto rounded-xl border border-[var(--glass-border)] p-2.5">
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={checked.has(it.id)} onChange={() => toggle(it.id)} className="h-4 w-4 rounded accent-[var(--ice-300)]" />
            <span className="text-sm">{it.title}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-[var(--text-muted)]">{t.scopes}</p>
      <p className="text-[11px] text-[var(--text-muted)]">{t.scopesHint}</p>

      <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--glass-border)] p-3">
        <label className="text-[11px] text-[var(--text-muted)]">{t.scopeType}</label>
        <select value={scopeType} onChange={(e) => resetPickers(e.target.value as PermissionScopeType)} className={inputClass}>
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {scopeType === "level" && (
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((lv) => (
              <label key={lv} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={levelChecks.has(lv)}
                  onChange={() =>
                    setLevelChecks((prev) => {
                      const next = new Set(prev);
                      if (next.has(lv)) next.delete(lv);
                      else next.add(lv);
                      return next;
                    })
                  }
                  className="h-4 w-4 rounded accent-[var(--ice-300)]"
                />
                <span className="text-sm">{levelLabels[lv - 1] ?? lv}</span>
              </label>
            ))}
          </div>
        )}

        {scopeType === "channel" && (
          <>
            {levelSelect}
            {level !== "" && (
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto rounded-xl border border-[var(--glass-border)] p-2.5">
                {channelsOfLevel.length === 0 && <p className="text-[11px] text-[var(--text-muted)]">{t.nothingToPick}</p>}
                {channelsOfLevel.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded accent-[var(--ice-300)]" />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        {scopeType === "course" && (
          <>
            {levelSelect}
            {channelSelect}
            {checkboxList(courses, channelId !== "")}
          </>
        )}

        {scopeType === "lecture" && (
          <>
            {levelSelect}
            {channelSelect}
            {channelId !== "" && (
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setLectures(null);
                  setChecked(new Set());
                }}
                className={inputClass}
              >
                <option value="">{t.chooseCourse}</option>
                {(courses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
            {checkboxList(lectures, courseId !== "")}
          </>
        )}

        <button
          type="button"
          onClick={addCurrent}
          className="self-start flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--ice-300)] hover:border-[var(--ice-300)] transition"
        >
          <Plus size={13} />
          {t.addToScopes}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {scopes.length === 0 && <span className="text-[11px] text-[var(--text-muted)]">{t.noScopesYet}</span>}
        {scopes.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-highlight)] ps-2.5 pe-1.5 py-0.5 text-xs">
            {s.label}
            <button type="button" onClick={() => onChange(scopes.filter((x) => x.key !== s.key))} className="p-0.5 rounded-full text-[var(--text-muted)] hover:text-[var(--danger)] transition">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
