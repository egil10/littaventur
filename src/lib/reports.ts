"use client";

// localStorage-backed "report this item" queue — a zero-backend way to collect
// data-quality feedback. Each report copies a markdown line to the clipboard.

const KEY = "litt.reports.v1";

export type Report = { id: string; title: string; author: string; note: string; at: number };

export function loadReports(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveReports(r: Report[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

export function addReport(r: Omit<Report, "at">): Report[] {
  const list = loadReports();
  const next = [{ ...r, at: Date.now() }, ...list].slice(0, 100);
  saveReports(next);
  return next;
}

export function clearReports(): Report[] {
  saveReports([]);
  return [];
}

export function reportMarkdown(r: Report): string {
  return `- [ ] **${r.title}** — ${r.author}${r.note ? ` — ${r.note}` : ""}`;
}
