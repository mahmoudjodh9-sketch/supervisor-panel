"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, UploadCloud } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  fetchBankQuestions,
  fetchBankSettings,
  updateBankSettings,
  createBankQuestion,
  updateBankQuestion,
  deleteBankQuestion,
  deleteQuestionBank,
  uploadBankSheet,
  type BankQuestionRow,
  type BankQuestionType,
  type BankSettings,
  type BankUnlockMode,
  type BankOrderMode,
} from "@/app/content/bank-actions";
import type { LectureItemRow } from "@/lib/content";

const inputClass =
  "w-full rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition";

type Lang = "ar" | "en";

const TXT = {
  ar: {
    title: "بنك الأسئلة",
    tabQuestions: "الأسئلة",
    tabUpload: "رفع إكسل",
    tabSettings: "الإعدادات",
    loading: "جاري التحميل...",
    empty: "لسه مفيش أسئلة في البنك",
    addQuestion: "إضافة سؤال",
    bigQuestion: " • سؤال كبير",
    confirmDeleteQuestion: "متأكد إنك عايز تحذف السؤال ده؟",
    typeTrueFalse: "صح/غلط",
    typeMcq: "اختيارات",
    typeEssay: "مقالي",
    groupNone: "سؤال مستقل (بدون مجموعة)",
    groupNew: "سؤال كبير جديد (مجموعة جديدة)",
    groupAddTo: "إضافة لمجموعة:",
    questionPlaceholder: "نص السؤال (أو المعطيات لو سؤال كبير)",
    requirementPlaceholder: "المطلوب (بيظهر بلون مختلف)",
    requirementMissing: "اكتب المطلوب لهذا السؤال",
    answerPlaceholder: "الإجابة",
    correctTitle: "الإجابة الصحيحة",
    optionN: "اختيار",
    addOption: "إضافة اختيار",
    explanationPlaceholder: "تعليل الإجابة (اختياري)",
    chooseFile: "اختار ملف Excel",
    sheetHint:
      "الأعمدة: type (mcq أو true_false أو essay)، question_text، option_1 إلى option_4، correct_option (رقم الاختيار، ولصح/غلط: 1 = صح و2 = غلط)، answer_text (للمقالي)، explanation، requirement، group_id. لازم requirement و group_id يتكتبوا مع بعض، والصفوف اللي ليها نفس group_id بتكوّن سؤال كبير واحد.",
    replaceExisting: "استبدال الأسئلة الموجودة",
    uploading: "جاري الرفع...",
    upload: "رفع الملف",
    unlockTitle: "شرط فتح البنك للطالب",
    unlockImmediate: "يفتح على طول (بدون شرط)",
    unlockAll: "بعد ما الطالب يشوف كل محتوى المحاضرة",
    unlockSelected: "بعد ما الطالب يشوف ملفات محددة",
    noFiles: "مفيش فيديو أو PDF في المحاضرة دي",
    video: "فيديو",
    pdf: "PDF",
    orderTitle: "ترتيب الأسئلة",
    orderSheet: "بترتيب الشيت / الإدخال",
    orderRandom: "عشوائي (المجموعة بتفضل مع بعض)",
    studyOnly: "بنك الأسئلة للمذاكرة فقط ومش بيدخل في نسبة التقدم.",
    saved: "تم الحفظ",
    confirmDeleteBank: "هيتم حذف كل أسئلة البنك نهائيًا وإخفاء الكارت. متأكد؟",
    deleteBank: "حذف بنك الأسئلة",
    trueText: "صح",
    falseText: "غلط",
  },
  en: {
    title: "Question Bank",
    tabQuestions: "Questions",
    tabUpload: "Excel upload",
    tabSettings: "Settings",
    loading: "Loading...",
    empty: "No questions in the bank yet",
    addQuestion: "Add question",
    bigQuestion: " • Big question",
    confirmDeleteQuestion: "Are you sure you want to delete this question?",
    typeTrueFalse: "True/False",
    typeMcq: "Multiple choice",
    typeEssay: "Essay",
    groupNone: "Standalone question (no group)",
    groupNew: "New big question (new group)",
    groupAddTo: "Add to group:",
    questionPlaceholder: "Question text (or the given data for a big question)",
    requirementPlaceholder: "Requirement (shown in a different color)",
    requirementMissing: "Write the requirement for this question",
    answerPlaceholder: "Answer",
    correctTitle: "Correct answer",
    optionN: "Option",
    addOption: "Add option",
    explanationPlaceholder: "Answer explanation (optional)",
    chooseFile: "Choose an Excel file",
    sheetHint:
      "Columns: type (mcq, true_false or essay), question_text, option_1 to option_4, correct_option (option number; for true_false: 1 = True, 2 = False), answer_text (essay), explanation, requirement, group_id. requirement and group_id must be filled together; rows sharing the same group_id form one big question.",
    replaceExisting: "Replace existing questions",
    uploading: "Uploading...",
    upload: "Upload file",
    unlockTitle: "When the bank unlocks for the student",
    unlockImmediate: "Immediately (no condition)",
    unlockAll: "After the student views all lecture content",
    unlockSelected: "After the student views specific files",
    noFiles: "This lecture has no video or PDF",
    video: "Video",
    pdf: "PDF",
    orderTitle: "Question order",
    orderSheet: "Sheet / entry order",
    orderRandom: "Random (a group stays together)",
    studyOnly: "The question bank is for study only and does not count toward progress.",
    saved: "Saved",
    confirmDeleteBank: "All bank questions will be permanently deleted and the card hidden. Are you sure?",
    deleteBank: "Delete question bank",
    trueText: "True",
    falseText: "False",
  },
} as const;

/** بيترجم رسائل الخطأ اللي راجعة من السيرفر (عربي) للإنجليزي لما الواجهة إنجليزي. */
const ERROR_EN: Record<string, string> = {
  "غير مصرّح": "Not authorized",
  "المحاضرة مطلوبة": "Lecture is required",
  "نص السؤال مطلوب": "Question text is required",
  "المطلوب واسم المجموعة لازم يتحددوا مع بعض": "Requirement and group must be set together",
  "إجابة السؤال المقالي مطلوبة": "The essay answer is required",
  "سؤال صح/غلط لازم يبقى فيه اختيارين": "A true/false question needs exactly two options",
  "لازم خيارين على الأقل": "At least two options are required",
  "فيه خيار فاضي": "One of the options is empty",
  "لازم تحدد إجابة صحيحة واحدة": "Select exactly one correct answer",
  "اختار ملف واحد على الأقل لشرط الفتح": "Select at least one file for the unlock condition",
  "العناصر المختارة غير صالحة": "The selected items are not valid",
  "السؤال غير موجود": "Question not found",
  "لازم تختار ملف Excel": "Choose an Excel file",
  "مكتبة xlsx غير مثبتة على السيرفر — شغّل npm install xlsx": "xlsx is not installed on the server — run npm install xlsx",
  "الملف فاضي": "The file is empty",
  "لا توجد صفوف في الملف": "No rows in the file",
  "نص السؤال مفقود": "question text is missing",
  "النوع لازم يكون mcq أو true_false أو essay": "type must be mcq, true_false or essay",
  "group_id و requirement لازم يتكتبوا مع بعض": "group_id and requirement must be filled together",
  "answer_text مطلوب للسؤال المقالي": "answer_text is required for an essay question",
  "correct_option لازم يكون 1 (صح) أو 2 (غلط)": "correct_option must be 1 (True) or 2 (False)",
  "correct_option غير صحيح": "correct_option is invalid",
};

function translateError(msg: string | null, lang: Lang): string | null {
  if (!msg || lang === "ar") return msg;
  const row = msg.match(/^صف (\d+): (.*)$/);
  if (row) return `Row ${row[1]}: ${ERROR_EN[row[2]] ?? row[2]}`;
  return ERROR_EN[msg] ?? msg;
}

export function QuestionBankModal({
  lectureId,
  lecturePath,
  items,
  onClose,
  onDeleted,
}: {
  lectureId: string;
  lecturePath: string;
  items: LectureItemRow[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useLocale();
  const b = TXT[locale];
  const typeLabel: Record<BankQuestionType, string> = {
    true_false: b.typeTrueFalse,
    mcq: b.typeMcq,
    essay: b.typeEssay,
  };
  const [tab, setTab] = useState<"questions" | "upload" | "settings">("questions");
  const [questions, setQuestions] = useState<BankQuestionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankQuestionRow | null | "new">(null);
  const [isPending, startTransition] = useTransition();

  function reload() {
    fetchBankQuestions(lectureId).then((res) => {
      setQuestions(res.questions);
      setLoadError(translateError(res.error, locale));
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(q: BankQuestionRow) {
    if (!window.confirm(b.confirmDeleteQuestion)) return;
    startTransition(async () => {
      await deleteBankQuestion(q.id, lecturePath);
      reload();
    });
  }

  const tabs: { id: "questions" | "upload" | "settings"; label: string }[] = [
    { id: "questions", label: b.tabQuestions },
    { id: "upload", label: b.tabUpload },
    { id: "settings", label: b.tabSettings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">{b.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 mb-4">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => {
                setTab(tb.id);
                setEditing(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
                tab === tb.id
                  ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                  : "border-[var(--glass-border)] text-[var(--text-secondary)]"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "questions" && (
          <>
            {editing ? (
              <BankQuestionForm
                lectureId={lectureId}
                lecturePath={lecturePath}
                editing={editing === "new" ? null : editing}
                existingQuestions={questions ?? []}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  reload();
                }}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {loadError && <p className="text-xs text-[var(--danger)]">{loadError}</p>}
                {questions === null && <p className="text-xs text-[var(--text-muted)]">{b.loading}</p>}
                {questions?.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-4">{b.empty}</p>
                )}
                {questions?.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-2 rounded-xl border border-[var(--glass-border)] p-2.5"
                  >
                    <span className="text-[11px] text-[var(--text-muted)] pt-0.5 w-5 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <p className="text-sm truncate">{q.questionText}</p>
                      {q.requirement && (
                        <span className="text-[11px] text-red-400 truncate">{q.requirement}</span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {typeLabel[q.type]}
                        {q.groupId ? b.bigQuestion : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => setEditing(q)}
                      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--glass-highlight)] transition shrink-0"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(q)}
                      disabled={isPending}
                      className="p-1.5 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition shrink-0 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setEditing("new")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--glass-border)] py-2.5 text-xs text-[var(--ice-300)] hover:border-[var(--ice-300)] transition"
                >
                  <Plus size={14} />
                  {b.addQuestion}
                </button>
              </div>
            )}
          </>
        )}

        {tab === "upload" && (
          <BankUploadForm
            lectureId={lectureId}
            lecturePath={lecturePath}
            onDone={() => {
              reload();
              setTab("questions");
            }}
          />
        )}

        {tab === "settings" && (
          <BankSettingsPanel
            lectureId={lectureId}
            lecturePath={lecturePath}
            items={items}
            onDeleted={onDeleted}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  نموذج السؤال                                                        */
/* ------------------------------------------------------------------ */

function BankQuestionForm({
  lectureId,
  lecturePath,
  editing,
  existingQuestions,
  onCancel,
  onSaved,
}: {
  lectureId: string;
  lecturePath: string;
  editing: BankQuestionRow | null;
  existingQuestions: BankQuestionRow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useLocale();
  const b = TXT[locale];
  const typeLabel: Record<BankQuestionType, string> = {
    true_false: b.typeTrueFalse,
    mcq: b.typeMcq,
    essay: b.typeEssay,
  };
  const [type, setType] = useState<BankQuestionType>(editing?.type ?? "mcq");
  const [questionText, setQuestionText] = useState(editing?.questionText ?? "");
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>(
    editing && editing.type !== "essay" && editing.options.length > 0
      ? editing.options.map((o) => ({ text: o.optionText, isCorrect: o.isCorrect }))
      : [
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
        ]
  );
  const [answerText, setAnswerText] = useState(editing?.answerText ?? "");
  const [explanation, setExplanation] = useState(editing?.explanation ?? "");
  const [requirement, setRequirement] = useState(editing?.requirement ?? "");
  // "none" = مستقل، "new" = مجموعة جديدة، أو id مجموعة موجودة
  const [groupChoice, setGroupChoice] = useState<string>(editing?.groupId ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groups = Array.from(
    existingQuestions
      .filter((q) => q.groupId)
      .reduce((m, q) => {
        const g = m.get(q.groupId!) ?? { id: q.groupId!, stem: q.questionText, count: 0 };
        g.count += 1;
        m.set(q.groupId!, g);
        return m;
      }, new Map<string, { id: string; stem: string; count: number }>())
      .values()
  );

  function handleTypeChange(next: BankQuestionType) {
    setType(next);
    if (next === "true_false") {
      setOptions([
        { text: "صح", isCorrect: true },
        { text: "غلط", isCorrect: false },
      ]);
    } else if (next === "mcq" && type === "true_false") {
      setOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ]);
    }
  }

  function setCorrect(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
  }

  function updateOption(idx: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  }

  function addOption() {
    setOptions((prev) => (prev.length >= 4 ? prev : [...prev, { text: "", isCorrect: false }]));
  }

  function removeOption(idx: number) {
    setOptions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (!next.some((o) => o.isCorrect) && next.length > 0) next[0].isCorrect = true;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const isGrouped = groupChoice !== "none";
    if (isGrouped && !requirement.trim()) return setError(b.requirementMissing);

    const input = {
      type,
      questionText,
      options: type === "essay" ? [] : options,
      answerText,
      explanation,
      requirement: isGrouped ? requirement : "",
      groupId: isGrouped ? (groupChoice === "new" ? crypto.randomUUID() : groupChoice) : null,
    };

    startTransition(async () => {
      const res = editing
        ? await updateBankQuestion(editing.id, input, lecturePath)
        : await createBankQuestion(lectureId, input, lecturePath);
      if (res.error) {
        setError(translateError(res.error, locale));
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["mcq", "true_false", "essay"] as BankQuestionType[]).map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => handleTypeChange(tp)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition ${
              type === tp
                ? "bg-[var(--ice-300)]/20 border-[var(--ice-300)] text-[var(--ice-300)]"
                : "border-[var(--glass-border)] text-[var(--text-secondary)]"
            }`}
          >
            {typeLabel[tp]}
          </button>
        ))}
      </div>

      <select
        value={groupChoice}
        onChange={(e) => {
          const v = e.target.value;
          setGroupChoice(v);
          if (v !== "none" && v !== "new" && !questionText.trim()) {
            const g = groups.find((x) => x.id === v);
            if (g) setQuestionText(g.stem);
          }
        }}
        className={inputClass}
      >
        <option value="none">{b.groupNone}</option>
        <option value="new">{b.groupNew}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {`${b.groupAddTo} ${g.stem.slice(0, 40)}${g.stem.length > 40 ? "…" : ""} (${g.count})`}
          </option>
        ))}
      </select>

      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder={b.questionPlaceholder}
        rows={3}
        className={inputClass}
      />

      {groupChoice !== "none" && (
        <input
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder={b.requirementPlaceholder}
          className={`${inputClass} text-red-400`}
        />
      )}

      {type === "essay" ? (
        <textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder={b.answerPlaceholder}
          rows={3}
          className={inputClass}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {options.map((o, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="bank-correct"
                checked={o.isCorrect}
                onChange={() => setCorrect(idx)}
                className="h-4 w-4 accent-[var(--success)] shrink-0"
                title={b.correctTitle}
              />
              <input
                value={type === "true_false" ? (idx === 0 ? b.trueText : b.falseText) : o.text}
                onChange={(e) => updateOption(idx, e.target.value)}
                disabled={type === "true_false"}
                placeholder={`${b.optionN} ${idx + 1}`}
                className={`${inputClass} flex-1 min-w-0 disabled:opacity-60`}
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
              {b.addOption}
            </button>
          )}
        </div>
      )}

      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder={b.explanationPlaceholder}
        rows={2}
        className={inputClass}
      />

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

/* ------------------------------------------------------------------ */
/*  رفع إكسل                                                            */
/* ------------------------------------------------------------------ */

function BankUploadForm({
  lectureId,
  lecturePath,
  onDone,
}: {
  lectureId: string;
  lecturePath: string;
  onDone: () => void;
}) {
  const { locale } = useLocale();
  const b = TXT[locale];
  const [file, setFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const res = await uploadBankSheet(lectureId, file, replaceExisting, lecturePath);
      if (res.error) {
        setError(translateError(res.error, locale));
        return;
      }
      setFile(null);
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="cursor-pointer rounded-xl border border-dashed border-[var(--glass-border)] px-3 py-4 text-xs text-[var(--text-secondary)] hover:border-[var(--ice-300)] transition text-center">
        {file ? file.name : b.chooseFile}
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{b.sheetHint}</p>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={replaceExisting}
          onChange={(e) => setReplaceExisting(e.target.checked)}
          className="h-4 w-4 rounded accent-[var(--ice-300)]"
        />
        <span className="text-sm text-[var(--text-secondary)]">{b.replaceExisting}</span>
      </label>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || isPending}
        className="accent-gradient flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        <UploadCloud size={16} />
        {isPending ? b.uploading : b.upload}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  الإعدادات: شرط الفتح + ترتيب الأسئلة + حذف البنك                    */
/* ------------------------------------------------------------------ */

function BankSettingsPanel({
  lectureId,
  lecturePath,
  items,
  onDeleted,
}: {
  lectureId: string;
  lecturePath: string;
  items: LectureItemRow[];
  onDeleted: () => void;
}) {
  const { t, locale } = useLocale();
  const b = TXT[locale];
  const unlockOptions: { value: BankUnlockMode; label: string }[] = [
    { value: "immediate", label: b.unlockImmediate },
    { value: "all", label: b.unlockAll },
    { value: "selected", label: b.unlockSelected },
  ];
  const orderOptions: { value: BankOrderMode; label: string }[] = [
    { value: "sheet", label: b.orderSheet },
    { value: "random", label: b.orderRandom },
  ];
  const [settings, setSettings] = useState<BankSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectableItems = items.filter((i) => i.type === "video" || i.type === "pdf");

  useEffect(() => {
    fetchBankSettings(lectureId).then((res) => {
      setSettings(res.settings);
      setError(translateError(res.error, locale));
    });
  }, [lectureId]);

  if (!settings) {
    return <p className="text-xs text-[var(--text-muted)]">{error ?? b.loading}</p>;
  }

  function toggleItem(id: string) {
    setSaved(false);
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            unlockItemIds: prev.unlockItemIds.includes(id)
              ? prev.unlockItemIds.filter((x) => x !== id)
              : [...prev.unlockItemIds, id],
          }
        : prev
    );
  }

  function handleSave() {
    if (!settings) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateBankSettings(lectureId, settings, lecturePath);
      if (res.error) setError(translateError(res.error, locale));
      else setSaved(true);
    });
  }

  function handleDeleteBank() {
    if (!window.confirm(b.confirmDeleteBank)) return;
    startTransition(async () => {
      const res = await deleteQuestionBank(lectureId, lecturePath);
      if (res.error) setError(translateError(res.error, locale));
      else onDeleted();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--text-secondary)]">{b.unlockTitle}</p>
        {unlockOptions.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="bank-unlock"
              checked={settings.unlockMode === o.value}
              onChange={() => {
                setSaved(false);
                setSettings({ ...settings, unlockMode: o.value });
              }}
              className="h-4 w-4 accent-[var(--ice-300)]"
            />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}

        {settings.unlockMode === "selected" && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--glass-border)] p-2.5">
            {selectableItems.length === 0 && (
              <p className="text-[11px] text-[var(--text-muted)]">{b.noFiles}</p>
            )}
            {selectableItems.map((i) => (
              <label key={i.id} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.unlockItemIds.includes(i.id)}
                  onChange={() => toggleItem(i.id)}
                  className="h-4 w-4 rounded accent-[var(--ice-300)]"
                />
                <span className="text-sm truncate">
                  {i.title} <span className="text-[10px] text-[var(--text-muted)]">({i.type === "video" ? b.video : b.pdf})</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--text-secondary)]">{b.orderTitle}</p>
        {orderOptions.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="bank-order"
              checked={settings.orderMode === o.value}
              onChange={() => {
                setSaved(false);
                setSettings({ ...settings, orderMode: o.value });
              }}
              className="h-4 w-4 accent-[var(--ice-300)]"
            />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">{b.studyOnly}</p>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      {saved && <p className="text-xs text-[var(--success)]">{b.saved}</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="accent-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? t.content.saving : t.content.save}
      </button>

      <button
        onClick={handleDeleteBank}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--danger)]/30 py-2 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 transition disabled:opacity-50"
      >
        <Trash2 size={13} />
        {b.deleteBank}
      </button>
    </div>
  );
}
