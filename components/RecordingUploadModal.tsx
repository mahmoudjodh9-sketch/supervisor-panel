"use client";

import { useRef, useState, useTransition } from "react";
import { Mic, X, UploadCloud } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import {
  createRecordingUpload,
  finalizeRecording,
  renameRecording,
} from "@/app/content/recordings-actions";
import type { LectureItemRow } from "@/lib/lectures";

const TXT = {
  ar: {
    titleNew: "ريكورد صوتي",
    titleEdit: "تعديل الريكورد",
    nameLabel: "اسم الريكورد",
    fileLabel: "ملف الصوت",
    chooseFile: "اختار ملف صوت",
    formats: "الصيغ المدعومة: mp3 و m4a و aac و wav و ogg و opus و flac — حد أقصى 300MB (الأفضل m4a أو mp3)",
    webmNotSupported:
      "ملفات webm غير مدعومة (غالبًا بتبقى مسجّلة من المتصفح، والتقديم جوه الريكورد مش بيشتغل معاها). حوّلها لـ m4a أو mp3 وارفعها تاني.",
    nameRequired: "اسم الريكورد مطلوب",
    fileRequired: "اختار ملف الصوت",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "جارٍ الحفظ...",
    upload: "رفع الريكورد",
    uploading: "جارٍ الرفع...",
    analyzing: "جارٍ تحليل الصوت...",
    finalizing: "جارٍ الإنهاء...",
    corsHint:
      "فشل الرفع إلى R2. غالبًا إعداد CORS على الـBucket ناقص أو مش بيسمح بدومين اللوحة، راجع إعداد CORS في Cloudflare.",
    uploadError: "فشل الرفع",
    editHint: "ملف الصوت نفسه مش بيتغيّر من هنا. لو عايز تستبدله احذف الريكورد وارفع واحد جديد.",
  },
  en: {
    titleNew: "Audio recording",
    titleEdit: "Edit recording",
    nameLabel: "Recording name",
    fileLabel: "Audio file",
    chooseFile: "Choose an audio file",
    formats: "Supported: mp3, m4a, aac, wav, ogg, opus, flac — max 300MB (m4a or mp3 recommended)",
    webmNotSupported:
      "WebM files aren't supported (they're usually browser recordings, and seeking inside them doesn't work). Convert to m4a or mp3 and upload again.",
    nameRequired: "Recording name is required",
    fileRequired: "Choose an audio file",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    upload: "Upload recording",
    uploading: "Uploading...",
    analyzing: "Analyzing audio...",
    finalizing: "Finishing...",
    corsHint:
      "Upload to R2 failed. The bucket's CORS setting is probably missing or doesn't allow this panel's domain. Check CORS in Cloudflare.",
    uploadError: "Upload failed",
    editHint: "The audio file itself can't be changed here. To replace it, delete the recording and upload a new one.",
  },
} as const;

const ERROR_EN: Record<string, string> = {
  "غير مصرّح": "Not authorized",
  "المحاضرة مطلوبة": "Lecture is required",
  "نوع الملف غير مدعوم (mp3, m4a, aac, wav, ogg, opus, flac)":
    "Unsupported file type (mp3, m4a, aac, wav, ogg, opus, flac)",
  "ملفات webm غير مدعومة (التقديم جوه الريكورد مش بيشتغل معاها) — حوّلها لـ m4a أو mp3 وارفعها تاني":
    "WebM files aren't supported (seeking inside them doesn't work) — convert to m4a or mp3 and upload again",
  "الملف فاضي": "The file is empty",
  "حجم الملف أكبر من 300MB": "The file is larger than 300MB",
  "المحاضرة غير موجودة": "Lecture not found",
  "المادة غير مرتبطة بقناة": "The course is not linked to a channel",
  "القناة دي مش مربوطة بحساب R2 — اربطها من لوحة المالك (حسابات R2)":
    "This channel is not linked to an R2 account — link it from the owner panel (R2 Accounts)",
  "حساب R2 غير موجود": "R2 account not found",
  "تعذر تجهيز الرفع": "Could not prepare the upload",
  "عنوان الريكورد مطلوب": "Recording name is required",
  "مفتاح الملف غير صالح": "Invalid file key",
  "الملف مش موجود على R2 — الرفع ما اكتملش": "The file isn't on R2 — the upload didn't complete",
  "الريكورد غير موجود": "Recording not found",
};

const inputClass =
  "w-full rounded-lg bg-[var(--glass-highlight)] border border-[var(--glass-border)] px-3 py-2 text-sm outline-none focus:border-[var(--ice-300)] transition";

/**
 * بيحسب "علو الصوت" على طول الريكورد (قيمة 0..255 لكل 1/10 ثانية) عشان التطبيق يحرّك النيون.
 * بيتعمل في المتصفح وقت الرفع. لو الملف كبير أو المتصفح مقدرش يفكّه بيرجّع null
 * (الريكورد بيترفع عادي، بس النيون بيبقى نبض هادي بدل ما يتفاعل مع الصوت).
 */
const ENVELOPE_HZ = 10;
const ENVELOPE_MAX_FILE_BYTES = 60 * 1024 * 1024;
const ENVELOPE_MAX_POINTS = 120_000; // حوالي 3.3 ساعة

async function computeEnvelope(file: File): Promise<string | null> {
  if (file.size > ENVELOPE_MAX_FILE_BYTES) return null;
  try {
    const w = window as unknown as {
      OfflineAudioContext?: typeof OfflineAudioContext;
      webkitOfflineAudioContext?: typeof OfflineAudioContext;
    };
    const Ctx = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
    if (!Ctx) return null;

    // نفك الصوت بسرعة عينات واطية (8kHz) علشان الذاكرة، ومحتاجين بس مستوى الصوت
    const ctx = new Ctx(1, 8000, 8000);
    const audioBuffer = await ctx.decodeAudioData(await file.arrayBuffer());

    const sampleRate = audioBuffer.sampleRate;
    const win = Math.max(1, Math.floor(sampleRate / ENVELOPE_HZ));
    const points = Math.ceil(audioBuffer.length / win);
    if (points <= 0 || points > ENVELOPE_MAX_POINTS) return null;

    const rms = new Float32Array(points);
    const channels = audioBuffer.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < points; i++) {
        const start = i * win;
        const end = Math.min(start + win, data.length);
        let sum = 0;
        for (let j = start; j < end; j++) sum += data[j] * data[j];
        rms[i] += sum / Math.max(1, end - start);
      }
    }
    for (let i = 0; i < points; i++) rms[i] = Math.sqrt(rms[i] / channels);

    // المرجع = المستوى رقم 95% علشان الصوت العادي يطلع نيون واضح، والصمت يفضل صفر
    const sorted = Float32Array.from(rms).sort();
    const reference = sorted[Math.min(points - 1, Math.floor(points * 0.95))];
    if (!reference || reference < 1e-4) return null;

    const bytes = new Uint8Array(points);
    for (let i = 0; i < points; i++) {
      let x = rms[i] / reference;
      if (x < 0.04) x = 0; // صمت
      x = Math.pow(Math.min(1, x), 0.7);
      bytes[i] = Math.round(x * 255);
    }

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio.duration) ? audio.duration : null;
        URL.revokeObjectURL(url);
        resolve(d);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.src = url;
    } catch {
      resolve(null);
    }
  });
}

export function RecordingUploadModal({
  lectureId,
  lecturePath,
  editing,
  onClose,
  onSaved,
}: {
  lectureId: string;
  lecturePath: string;
  editing: LectureItemRow | null;
  onClose: () => void;
  onSaved: (item: LectureItemRow, isNew: boolean) => void;
}) {
  const { locale } = useLocale();
  const b = TXT[locale];
  const tr = (msg: string | null) => (msg && locale === "en" ? ERROR_EN[msg] ?? msg : msg);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "uploading" | "finalizing">("idle");
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const busy = phase !== "idle" || isPending;

  function putToR2(uploadUrl: string, contentType: string, f: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`${b.uploadError} (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error(b.corsHint));
      xhr.onabort = () => reject(new Error(b.uploadError));
      xhr.send(f);
    });
  }

  async function handleUpload() {
    if (!title.trim()) return setError(b.nameRequired);
    if (!file) return setError(b.fileRequired);
    if (file.name.toLowerCase().endsWith(".webm")) return setError(b.webmNotSupported);
    setError(null);
    setPhase("uploading");
    setProgress(0);

    try {
      const prep = await createRecordingUpload(lectureId, file.name, file.size);
      if (prep.error || !prep.uploadUrl || !prep.key || !prep.contentType) {
        setError(tr(prep.error) ?? b.uploadError);
        setPhase("idle");
        return;
      }

      const duration = await readDuration(file);

      // تحليل علو الصوت للنيون (بيتعمل قبل الرفع، ولو فشل الرفع بيكمّل عادي)
      setPhase("analyzing");
      const envelope = await computeEnvelope(file);

      setPhase("uploading");
      setProgress(0);
      await putToR2(prep.uploadUrl, prep.contentType, file);

      setPhase("finalizing");
      const res = await finalizeRecording(lectureId, title.trim(), prep.key, duration, envelope, lecturePath);
      if (res.error || !res.itemId) {
        setError(tr(res.error) ?? b.uploadError);
        setPhase("idle");
        return;
      }

      setPhase("idle");
      onSaved(
        {
          id: res.itemId,
          lectureId,
          type: "record",
          title: title.trim(),
          url: prep.key,
          orderIndex: 999999,
          createdAt: new Date().toISOString(),
        },
        true
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : b.uploadError);
      setPhase("idle");
    }
  }

  function handleRename() {
    if (!editing) return;
    if (!title.trim()) return setError(b.nameRequired);
    setError(null);
    startTransition(async () => {
      const res = await renameRecording(editing.id, title, lecturePath);
      if (res.error) {
        setError(tr(res.error));
        return;
      }
      onSaved({ ...editing, title: title.trim() }, false);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) handleRename();
    else handleUpload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-md rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-[var(--ice-300)]" />
            <h2 className="font-semibold text-base">{editing ? b.titleEdit : b.titleNew}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-highlight)] transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--text-muted)]">{b.nameLabel}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={inputClass} />
          </div>

          {!editing ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">{b.fileLabel}</label>
              <label className="cursor-pointer rounded-xl border border-dashed border-[var(--glass-border)] px-3 py-4 text-xs text-[var(--text-secondary)] hover:border-[var(--ice-300)] transition text-center">
                {file ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : b.chooseFile}
                <input
                  type="file"
                  accept=".mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/flac"
                  disabled={busy}
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-[11px] text-[var(--text-muted)]">{b.formats}</p>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)]">{b.editHint}</p>
          )}

          {phase !== "idle" && (
            <div className="flex flex-col gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--glass-highlight)]">
                <div
                  className="h-full accent-gradient transition-all"
                  style={{ width: `${phase === "finalizing" ? 100 : phase === "analyzing" ? 0 : progress}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {phase === "finalizing"
                  ? b.finalizing
                  : phase === "analyzing"
                    ? b.analyzing
                    : `${b.uploading} ${progress}%`}
              </p>
            </div>
          )}

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-40"
            >
              {b.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="accent-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {!editing && <UploadCloud size={14} />}
              {editing ? (isPending ? b.saving : b.save) : phase !== "idle" ? b.uploading : b.upload}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
