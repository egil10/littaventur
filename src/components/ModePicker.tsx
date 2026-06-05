"use client";

import { useEffect, useMemo } from "react";
import { X, Check } from "lucide-react";
import { MODES, type Book, type Mode, type ModeKey } from "@/lib/books";

export default function ModePicker({
  books,
  current,
  onPick,
  onClose,
}: {
  books: Book[];
  current: ModeKey;
  onPick: (key: ModeKey) => void;
  onClose: () => void;
}) {
  // a mode is playable if enough items expose distinct answers for it.
  // Computed once for the whole list rather than re-scanning per mode.
  const playableSet = useMemo(() => {
    const ok = new Set<ModeKey>();
    for (const m of MODES) {
      const answers = new Set<string>();
      for (const b of books) {
        const v = m.target(b);
        if (v != null) {
          answers.add(v);
          if (answers.size >= 4) break;
        }
      }
      if (answers.size >= 4) ok.add(m.key);
    }
    return ok;
  }, [books]);
  const playable = (m: Mode) => playableSet.has(m.key);

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
          aria-label="Spillmodus"
          className="frost rounded-[28px] w-full max-w-md p-6 sm:p-8 animate-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Spillmodus</div>
              <h2 className="text-2xl font-bold leading-tight">Hva skal du gjette?</h2>
            </div>
            <button onClick={onClose} className="pill-ghost focus-ring -mr-2" aria-label="Lukk">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {MODES.map((m) => {
              const active = current === m.key;
              const ok = playable(m);
              return (
                <button
                  key={m.key}
                  disabled={!ok}
                  onClick={() => onPick(m.key)}
                  style={active ? { background: "linear-gradient(180deg,#2f86ff,#0a6cff)" } : undefined}
                  className={`flex items-center justify-between text-left rounded-2xl px-4 py-3 transition focus-ring ${
                    active ? "text-white shadow-[0_8px_22px_-8px_rgba(10,108,255,0.7)]" : "glass hover:brightness-[1.03]"
                  } ${!ok ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <div>
                    <div className="font-semibold">{m.label}</div>
                    <div className={`text-sm ${active ? "text-white/75" : "text-ink-muted"}`}>{m.hint}</div>
                  </div>
                  {active && <Check size={18} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
