"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function ContentBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { locale } = useLocale();
  const Sep = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-4">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <Sep size={14} className="text-[var(--text-muted)]" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-[var(--ice-300)] transition">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-[var(--text-primary)] font-medium" : ""}>{item.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
