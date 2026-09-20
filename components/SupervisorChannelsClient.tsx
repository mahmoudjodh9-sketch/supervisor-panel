"use client";

import { useState, useTransition } from "react";
import { Tv, X, ImagePlus } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { AppShell } from "@/components/AppShell";
import { ContentBreadcrumb } from "@/components/ContentBreadcrumb";
import { ContentCard } from "@/components/ContentCard";
import { ImageCropModal } from "@/components/ImageCropModal";
import { updateMyChannel } from "@/app/content/channel-actions";
import type { ChannelRow } from "@/lib/content";

const COVER_ASPECT = 16 / 6.5;

export function SupervisorChannelsClient({
  level,
  initialChannels,
  loadError,
}: {
  level: number;
  initialChannels: ChannelRow[];
  loadError: string | null;
}) {
  const { t } = useLocale();
  const [channels, setChannels] = useState(initialChannels);
  const [editing, setEditing] = useState<ChannelRow | null>(null);

  const levelLabel = t.content.levelLabels[level - 1] ?? level;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <ContentBreadcrumb
          items={[{ label: t.content.breadcrumbRoot, href: "/content" }, { label: levelLabel }]}
        />

        <div>
          <h1 className="text-2xl font-bold accent-gradient-text flex items-center gap-2">
            <Tv size={20} className="text-[var(--ice-300)]" />
            {levelLabel}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t.content.channels.pageSubtitle}</p>
        </div>

        {loadError && (
          <div className="glass-panel rounded-2xl p-4 text-sm text-[var(--danger)]">
            {t.content.loadError}: {loadError}
          </div>
        )}

        {channels.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">{t.content.channels.empty}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {channels.map((c) => (
            <ContentCard
              key={c.id}
              title={c.name}
              coverUrl={c.coverUrl}
              logoUrl={c.logoUrl}
              color={c.colorDay}
              onClick={() => (window.location.href = `/content/${level}/${c.id}`)}
              onEdit={() => setEditing(c)}
              editLabel={t.content.channels.edit}
              deleteLabel={t.content.channels.delete}
            />
          ))}
        </div>
      </div>

      {editing && (
        <ChannelEditModal
          channel={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
            setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

function ChannelEditModal({
  channel,
  onClose,
  onSaved,
}: {
  channel: ChannelRow;
  onClose: () => void;
  onSaved: (saved: ChannelRow) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState(channel.name);
  const [colorDay, setColorDay] = useState(channel.colorDay ?? "#F97316");
  const [colorNight, setColorNight] = useState(channel.colorNight ?? "#F97316");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(channel.logoUrl);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(channel.coverUrl);

  const [cropTarget, setCropTarget] = useState<{ kind: "logo" | "cover"; raw: File } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setCropTarget({ kind: "logo", raw: file });
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setCropTarget({ kind: "cover", raw: file });
  }

  function handleCropConfirm(cropped: File) {
    const url = URL.createObjectURL(cropped);
    if (cropTarget?.kind === "logo") {
      setLogoFile(cropped);
      setLogoPreview(url);
    } else if (cropTarget?.kind === "cover") {
      setCoverFile(cropped);
      setCoverPreview(url);
    }
    setCropTarget(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t.content.channels.fieldName);
    setError(null);

    const formData = new FormData();
    formData.set("id", channel.id);
    formData.set("name", name.trim());
    formData.set("colorDay", colorDay);
    formData.set("colorNight", colorNight);
    if (logoFile) formData.set("logo", logoFile);
    if (coverFile) formData.set("cover", coverFile);

    startTransition(async () => {
      const res = await updateMyChannel(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSaved({
        ...channel,
        name: name.trim(),
        colorDay,
        colorNight,
        color: colorDay,
        logoUrl: logoPreview,
        coverUrl: coverPreview,
      });
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="glass-panel-strong w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tv size={18} className="text-[var(--ice-300)]" />
              <h2 className="font-semibold text-base">{t.content.channels.edit}</h2>
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
              <label className="text-xs text-[var(--text-muted)]">{t.content.channels.fieldLogo}</label>
              <div className="flex items-center gap-3">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="logo"
                    className="h-14 w-14 rounded-full object-cover border border-[var(--glass-border)]"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)]">
                    <ImagePlus size={20} />
                  </span>
                )}
                <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-[var(--glass-border)] px-3 py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--ice-300)] transition text-center">
                  {t.content.channels.fieldLogoHint}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">{t.content.channels.fieldCover}</label>
              {coverPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview}
                  alt="cover"
                  className="w-full h-28 rounded-xl object-cover border border-[var(--glass-border)]"
                />
              )}
              <label className="cursor-pointer rounded-xl border border-dashed border-[var(--glass-border)] px-3 py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--ice-300)] transition text-center">
                {t.content.channels.fieldCoverHint}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleCoverChange} />
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-muted)]">{t.content.channels.fieldName}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ice-300)] transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)]">{t.content.channels.fieldColorDay}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorDay}
                    onChange={(e) => setColorDay(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-[var(--glass-border)] bg-transparent cursor-pointer"
                  />
                  <input
                    value={colorDay}
                    onChange={(e) => setColorDay(e.target.value)}
                    dir="ltr"
                    className="flex-1 min-w-0 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2 py-2.5 text-xs font-mono outline-none focus:border-[var(--ice-300)] transition"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)]">{t.content.channels.fieldColorNight}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorNight}
                    onChange={(e) => setColorNight(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-[var(--glass-border)] bg-transparent cursor-pointer"
                  />
                  <input
                    value={colorNight}
                    onChange={(e) => setColorNight(e.target.value)}
                    dir="ltr"
                    className="flex-1 min-w-0 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2 py-2.5 text-xs font-mono outline-none focus:border-[var(--ice-300)] transition"
                  />
                </div>
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

      {cropTarget && (
        <ImageCropModal
          file={cropTarget.raw}
          aspect={cropTarget.kind === "logo" ? 1 : COVER_ASPECT}
          title={cropTarget.kind === "logo" ? t.content.channels.fieldLogo : t.content.channels.fieldCover}
          onCancel={() => setCropTarget(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
}
