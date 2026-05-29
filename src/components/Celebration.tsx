"use client";

import { useEffect, useMemo } from "react";
import { Award } from "lucide-react";

// A confetti "diploma" modal fired when a streak crosses a multiple of the goal.
export default function Celebration({ streak, onClose }: { streak: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [onClose]);

  const confetti = useMemo(() => {
    const colors = ["#0a6cff", "#3b86ff", "#16a34a", "#9ec5ff", "#0b1220"];
    return Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 2.2 + Math.random() * 1.8,
      size: 5 + Math.random() * 7,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 frost-backdrop animate-fade-in" onClick={onClose}>
      <style>{`@keyframes confettiFall{0%{transform:translateY(-12vh) rotate(0);opacity:1}100%{transform:translateY(112vh) rotate(720deg);opacity:.9}}`}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${c.left}%`,
              top: "-12vh",
              width: c.size,
              height: c.size * 0.5,
              background: c.color,
              transform: `rotate(${c.rot}deg)`,
              borderRadius: 2,
              animation: `confettiFall ${c.dur}s ${c.delay}s linear forwards`,
            }}
          />
        ))}
      </div>
      <div className="frost rounded-[28px] p-8 text-center max-w-sm animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full" style={{ background: "var(--accent-soft)" }}>
          <Award size={32} style={{ color: "var(--accent)" }} />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Rekke på</div>
        <div className="text-6xl font-bold tabular-nums leading-none my-1">{streak}</div>
        <p className="text-ink-soft mt-3">
          {streak >= 30
            ? "Du er en sann litteraturkjenner!"
            : streak >= 20
              ? "Imponerende! Norsk litteratur sitter."
              : "Flott rekke — fortsett sånn!"}
        </p>
        <button onClick={onClose} className="pill-solid focus-ring mt-5">
          Fortsett
        </button>
      </div>
    </div>
  );
}
