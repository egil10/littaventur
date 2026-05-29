"use client";

import { useState } from "react";
import { X, Copy, Trash2, Check } from "lucide-react";
import { clearReports, reportMarkdown, type Report } from "@/lib/reports";

export default function ReportsModal({
  reports,
  onChange,
  onClose,
}: {
  reports: Report[];
  onChange: (r: Report[]) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    const md = reports.map(reportMarkdown).join("\n");
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 frost-backdrop animate-fade-in" onClick={onClose}>
      <div className="frost rounded-[28px] w-full max-w-lg p-6 animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Rapporterte verk</div>
            <h2 className="text-lg font-bold leading-tight">Datafeil du har meldt</h2>
          </div>
          <button onClick={onClose} className="pill-ghost focus-ring -mr-2" aria-label="Lukk">
            <X size={18} />
          </button>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-ink-muted py-6 text-center">
            Ingen rapporter ennå. Trykk flagg-ikonet på et verk hvis noe er feil — det havner her og kopieres til
            utklippstavlen så du kan lime det inn i en chat.
          </p>
        ) : (
          <>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto mb-4 pr-1">
              {reports.map((r, i) => (
                <li key={i} className="text-sm glass rounded-2xl px-3 py-2">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-ink-muted"> — {r.author}</span>
                  {r.note && <span className="text-ink-muted"> · {r.note}</span>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button onClick={copyAll} className="pill-solid focus-ring">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Kopiert!" : "Kopier alle"}
              </button>
              <button
                onClick={() => onChange(clearReports())}
                className="pill-ghost focus-ring text-ink-muted"
              >
                <Trash2 size={15} />
                Tøm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
