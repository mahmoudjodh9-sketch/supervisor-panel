"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, ZoomIn } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

interface ImageCropModalProps {
  file: File;
  /** width / height of the crop box, e.g. 16/6.5 for a cover image or 1 for a square profile image */
  aspect: number;
  title: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

// حجم مربع/مستطيل المعاينة على الشاشة — الإخراج النهائي بيتحسب بدقة أعلى دايمًا
const PREVIEW_WIDTH = 380;

export function ImageCropModal({ file, aspect, title, onCancel, onConfirm }: ImageCropModalProps) {
  const { t } = useLocale();
  const previewHeight = Math.round(PREVIEW_WIDTH / aspect);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; startOffset: { x: number; y: number } }>(
    { dragging: false, startX: 0, startY: 0, startOffset: { x: 0, y: 0 } }
  );

  const objectUrl = useRef<string>("");

  useEffect(() => {
    objectUrl.current = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.src = objectUrl.current;
    imgRef.current = img;
    return () => URL.revokeObjectURL(objectUrl.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // أصغر zoom يخلي الصورة تغطي مربع المعاينة بالكامل دايمًا (زي object-fit: cover)
  const baseScale = useCallback(() => {
    if (!naturalSize.w || !naturalSize.h) return 1;
    return Math.max(PREVIEW_WIDTH / naturalSize.w, previewHeight / naturalSize.h);
  }, [naturalSize, previewHeight]);

  function clampOffset(next: { x: number; y: number }, currentZoom: number) {
    const scale = baseScale() * currentZoom;
    const scaledW = naturalSize.w * scale;
    const scaledH = naturalSize.h * scale;
    const maxX = Math.max(0, (scaledW - PREVIEW_WIDTH) / 2);
    const maxY = Math.max(0, (scaledH - previewHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, startOffset: offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(clampOffset({ x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy }, zoom));
  }
  function onPointerUp() {
    dragState.current.dragging = false;
  }

  function handleZoomChange(next: number) {
    setZoom(next);
    setOffset((prev) => clampOffset(prev, next));
  }

  function handleConfirm() {
    if (!imgRef.current || !naturalSize.w) return;
    const OUTPUT_WIDTH = aspect >= 1 ? 1200 : 800;
    const outputHeight = Math.round(OUTPUT_WIDTH / aspect);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = OUTPUT_WIDTH / PREVIEW_WIDTH;
    const scale = baseScale() * zoom * ratio;
    const scaledW = naturalSize.w * scale;
    const scaledH = naturalSize.h * scale;

    const drawX = OUTPUT_WIDTH / 2 - scaledW / 2 + offset.x * ratio;
    const drawY = outputHeight / 2 - scaledH / 2 + offset.y * ratio;

    ctx.drawImage(imgRef.current, drawX, drawY, scaledW, scaledH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cropped = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
          type: "image/jpeg",
        });
        onConfirm(cropped);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-md rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
          <button onClick={onCancel} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-xl bg-black/40 touch-none select-none"
          style={{ width: PREVIEW_WIDTH, height: previewHeight, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {imgLoaded && (
            <img
              src={objectUrl.current}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: naturalSize.w * baseScale() * zoom,
                height: naturalSize.h * baseScale() * zoom,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                maxWidth: "none",
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ZoomIn size={16} className="text-[var(--text-secondary)] shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-5">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            {t.content.cancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!imgLoaded}
            className="accent-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-frost)] transition hover:brightness-110 disabled:opacity-60"
          >
            {t.content.save}
          </button>
        </div>
      </div>
    </div>
  );
}
