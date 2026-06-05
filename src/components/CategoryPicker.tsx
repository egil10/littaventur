"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { CATEGORIES, CATEGORY_GROUPS, type Book } from "@/lib/books";

export default function CategoryPicker({
  books,
  current,
  onPick,
  onClose,
}: {
  books: Book[];
  current: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  // tally every category tag once rather than re-filtering all books per pill
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books) for (const c of b.cats) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [books]);
  const count = (key: string) => (key === "" ? books.length : counts.get(key) ?? 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 frost-backdrop animate-fade-in overflow-y-auto" onClick={onClose}>
      <div className="min-h-full grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Velg utvalg"
          className="frost rounded-[28px] w-full max-w-2xl p-6 sm:p-8 animate-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Velg utvalg</div>
              <h2 className="text-2xl font-bold leading-tight">Hvilke bøker vil du øve på?</h2>
            </div>
            <button onClick={onClose} className="pill-ghost focus-ring -mr-2" aria-label="Lukk">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-6">
            {CATEGORY_GROUPS.map((g) => {
              const items = CATEGORIES.filter((c) => c.group === g.key && count(c.key) >= (c.key ? 4 : 0));
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  {g.label && (
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                      {g.label}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {items.map((c) => {
                      const active = current === c.key;
                      return (
                        <button
                          key={c.key || "all"}
                          onClick={() => onPick(c.key)}
                          className={`${active ? "pill-solid" : "pill-glass"} focus-ring`}
                          title={c.hint}
                        >
                          {c.label}
                          <span className={`tabular-nums text-xs ${active ? "opacity-70" : "text-ink-muted"}`}>
                            {count(c.key)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
