"use client";

import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

interface ContentCardProps {
  title: string;
  coverUrl: string | null;
  logoUrl?: string | null;
  color?: string | null;
  badge?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  editLabel: string;
  deleteLabel: string;
}

export function ContentCard({
  title,
  coverUrl,
  logoUrl,
  color,
  badge,
  icon,
  onClick,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  moveUpDisabled,
  moveDownDisabled,
  editLabel,
  deleteLabel,
}: ContentCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] cursor-pointer transition hover:border-[var(--ice-300)] hover:-translate-y-0.5"
    >
      {/* غلاف الكارت */}
      <div
        className="relative h-28 w-full"
        style={{
          background: coverUrl
            ? `center/cover no-repeat url(${coverUrl})`
            : `linear-gradient(135deg, ${color || "#2f8fdb"}55, ${color || "#2f8fdb"}22)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {!coverUrl && icon && (
          <div className="absolute inset-0 flex items-center justify-center opacity-90">{icon}</div>
        )}

        {(onEdit || onDelete || onMoveUp || onMoveDown) && (
          <div
            className="absolute top-2 inset-x-2 flex items-center justify-between transition"
            onClick={(e) => e.stopPropagation()}
          >
            {onDelete ? (
              <button
                onClick={onDelete}
                title={deleteLabel}
                className="p-1.5 rounded-lg bg-black/40 text-[var(--danger)] hover:bg-black/60 transition"
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <span />
            )}

            {(onMoveUp || onMoveDown) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onMoveUp}
                  disabled={moveUpDisabled}
                  className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition disabled:opacity-30"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={moveDownDisabled}
                  className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition disabled:opacity-30"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            )}

            {onEdit && (
              <button
                onClick={onEdit}
                title={editLabel}
                className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        )}

        {badge && <div className="absolute bottom-2 start-2">{badge}</div>}

        <p className="absolute bottom-2 end-3 text-sm font-semibold text-white drop-shadow max-w-[75%] truncate">
          {title}
        </p>

        {logoUrl && (
          <div className="absolute -bottom-4 start-3 h-10 w-10 rounded-full overflow-hidden border-2 border-[var(--glass-bg-strong)] bg-[var(--glass-bg-strong)] shadow-[var(--shadow-frost)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <div className={logoUrl ? "pt-5 pb-2 px-3" : "py-2 px-3"} />
    </div>
  );
}

export function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--ice-300)] hover:text-[var(--ice-300)] transition"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-lg leading-none">
        +
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
