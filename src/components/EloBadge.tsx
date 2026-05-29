"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, RotateCcw, TrendingUp, X } from "lucide-react";
import type { EloState } from "@/lib/elo";

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-24 grid place-items-center text-sm text-ink-muted">Spill noen runder for å se utviklingen.</div>;
  }
  const w = 320;
  const h = 96;
  const pad = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <path d={area} fill="rgba(10,10,10,0.06)" />
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.5} fill="var(--ink)" />
    </svg>
  );
}

export default function EloBadge({ elo, flash, onReset }: { elo: EloState; flash: number | null; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFlash, setShowFlash] = useState<number | null>(null);

  useEffect(() => {
    if (flash == null) return;
    setShowFlash(flash);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setShowFlash(null), 1100);
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [flash]);

  const acc = elo.games > 0 ? Math.round((elo.wins / elo.games) * 100) : 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pill-glass focus-ring tabular-nums"
        title="Din rating — klikk for historikk"
      >
        <TrendingUp size={15} className="opacity-70" />
        <span className="font-semibold">{elo.rating}</span>
        {showFlash != null && (
          <span
            className="font-semibold animate-fade-up"
            style={{ color: showFlash >= 0 ? "var(--good)" : "var(--bad)" }}
          >
            {showFlash >= 0 ? `+${showFlash}` : showFlash}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 frost-backdrop animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="frost rounded-[28px] w-full max-w-md p-6 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} />
                <h2 className="text-lg font-bold leading-tight">Din rating</h2>
              </div>
              <button onClick={() => setOpen(false)} className="pill-ghost focus-ring -mr-2" aria-label="Lukk">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <div className="text-5xl font-bold tabular-nums leading-none">{elo.rating}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted pb-1">rating</div>
            </div>

            <Sparkline data={elo.history} />

            <div className="grid grid-cols-3 gap-2 mt-4 mb-5">
              <Stat label="Topp" value={elo.peak} />
              <Stat label="Spilt" value={elo.games} />
              <Stat label="Treff" value={`${acc}%`} />
            </div>

            <button
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="pill-ghost focus-ring text-ink-muted"
            >
              <RotateCcw size={15} />
              Nullstill rating
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl glass px-3 py-2.5 text-center">
      <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
    </div>
  );
}
