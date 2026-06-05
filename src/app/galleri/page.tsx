"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookText, Search, X } from "lucide-react";
import { useBooks } from "@/lib/useBooks";
import { CATEGORIES, type Book } from "@/lib/books";

const PAGE = 24;

// Filters worth surfacing in the strip (skip the "all"/popular meta-rows).
const FILTERS = CATEGORIES.filter((c) => c.group === "epoke" || c.group === "sjanger");

// Author portraits are stored as Wikimedia `Special:FilePath/…?width=640` URLs.
// Grid thumbnails only render ~190px tall, so request a smaller render to cut
// gallery bandwidth roughly 3-4× (Wikimedia serves any width on demand).
function thumb(url: string, w: number): string {
  return url.replace(/width=\d+/, `width=${w}`);
}

export default function Gallery() {
  const { books } = useBooks();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<Book | null>(null);

  const filtered = useMemo(() => {
    if (!books) return [];
    const needle = q.trim().toLowerCase();
    return books.filter((b) => {
      if (filter && !b.cats.includes(filter)) return false;
      if (!needle) return true;
      return (
        b.title.toLowerCase().includes(needle) ||
        b.author.toLowerCase().includes(needle) ||
        (b.orig?.toLowerCase().includes(needle) ?? false) ||
        b.themes.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [books, q, filter]);

  useEffect(() => setLimit(PAGE), [q, filter]);

  // infinite scroll via IntersectionObserver
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((l) => Math.min(l + PAGE, filtered.length));
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const shown = filtered.slice(0, limit);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      {/* sticky pill toolbar */}
      <div className="sticky top-0 z-30 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/" className="pill-glass focus-ring" aria-label="Tilbake til quiz">
            <ArrowLeft size={16} />
            Quiz
          </Link>
          <div className="pill-glass flex-1 max-w-md !px-3">
            <Search size={16} className="opacity-60 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk tittel, forfatter, tema …"
              className="bg-transparent outline-none w-full placeholder:text-ink-muted"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Tøm søk" className="shrink-0">
                <X size={15} className="opacity-60 hover:opacity-100" />
              </button>
            )}
          </div>
          <span className="pill-glass tabular-nums text-ink-muted hidden sm:flex">{filtered.length} verk</span>
        </div>

        <FilterStrip filter={filter} onPick={setFilter} books={books ?? []} />
      </div>

      {!books ? (
        <div className="grid place-items-center min-h-[40vh] text-ink-muted animate-fade-in">Laster …</div>
      ) : shown.length === 0 ? (
        <div className="grid place-items-center min-h-[40vh] text-ink-muted">Ingen treff.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-2">
          {shown.map((b) => (
            <button
              key={b.id}
              onClick={() => setDetail(b)}
              className="cv-auto glass-flat liquid rounded-3xl p-3 text-left focus-ring transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.03] flex flex-col"
            >
              {b.authorImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb(b.authorImg, 400)}
                  alt={b.author}
                  loading="lazy"
                  decoding="async"
                  width={300}
                  height={384}
                  className="h-48 w-full object-cover object-[50%_16%] rounded-2xl bg-canvas-warm"
                  draggable={false}
                />
              ) : (
                <SpineDecor seed={b.fame} />
              )}
              <div className="font-semibold leading-snug mt-3 line-clamp-2 min-h-[2.6em]">{b.title}</div>
              <div className="text-sm text-ink-muted truncate">{b.author}</div>
              <div className="mt-2 pt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted tabular-nums border-t border-[var(--hairline)]">
                <span>{b.year ?? "—"}</span>
                <span>·</span>
                <span className="truncate">{b.genre ?? "Verk"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div ref={sentinel} className="h-10" />

      {detail && <DetailModal book={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}

// decorative cool-blue band for the handful of authors without a portrait
function SpineDecor({ seed }: { seed: number }) {
  const hues = [210, 224, 198, 236, 188, 250];
  const h = hues[seed % hues.length];
  return (
    <div
      className="h-48 w-full rounded-2xl grid place-items-center text-white/70"
      style={{
        background: `linear-gradient(150deg, hsl(${h} 60% 72%), hsl(${(h + 30) % 360} 55% 58%))`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)",
      }}
    >
      <BookText size={28} className="opacity-80" />
    </div>
  );
}

// ── drag-to-scroll filter strip (see BLUEPRINT §8 gotcha) ───────────────────

function FilterStrip({
  filter,
  onPick,
  books,
}: {
  filter: string;
  onPick: (k: string) => void;
  books: Book[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false, captured: false });

  // tally every category tag once instead of re-scanning all books per pill
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books) for (const c of b.cats) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [books]);
  const count = (key: string) => (key === "" ? books.length : counts.get(key) ?? 0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current!;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false, captured: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = ref.current!;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) {
      drag.current.moved = true;
      if (!drag.current.captured) {
        el.setPointerCapture(e.pointerId);
        drag.current.captured = true;
      }
      el.scrollLeft = drag.current.startScroll - dx;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.captured) {
      ref.current!.releasePointerCapture(e.pointerId);
      drag.current.captured = false;
    }
  };

  const select = (k: string) => {
    if (drag.current.moved) return;
    onPick(k === filter ? "" : k);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="flex gap-2 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing"
    >
      <button onClick={() => select("")} className={`${filter === "" ? "pill-solid" : "pill-glass"} focus-ring shrink-0`}>
        Alt <span className="tabular-nums text-xs opacity-70">{count("")}</span>
      </button>
      {FILTERS.map((c) => {
        const n = count(c.key);
        if (n < 3) return null;
        const active = filter === c.key;
        return (
          <button
            key={c.key}
            onClick={() => select(c.key)}
            className={`${active ? "pill-solid" : "pill-glass"} focus-ring shrink-0`}
          >
            {c.label} <span className={`tabular-nums text-xs ${active ? "opacity-70" : "text-ink-muted"}`}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

function DetailModal({ book, onClose }: { book: Book; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 frost-backdrop animate-fade-in" onClick={onClose}>
      <div className="glass-strong liquid rounded-[28px] w-full max-w-lg p-7 animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            {book.authorImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.authorImg}
                alt={book.author}
                width={112}
                height={112}
                decoding="async"
                className="w-28 h-28 object-cover object-[50%_16%] rounded-2xl glass shrink-0"
                draggable={false}
              />
            )}
            <div>
              <h2 className="text-2xl font-bold leading-tight">{book.title}</h2>
              {book.orig && <div className="text-ink-muted">{book.orig}</div>}
              <div className="text-lg mt-1">{book.author}</div>
            </div>
          </div>
          <button onClick={onClose} className="pill-ghost focus-ring -mr-2 -mt-1" aria-label="Lukk">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {book.year != null && <Chip>{book.year}</Chip>}
          {book.genre && <Chip>{book.genre}</Chip>}
          {book.eraLabel && <Chip>{book.eraLabel}</Chip>}
          {book.themes.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>

        {book.blurb ? (
          <p className="text-ink-soft leading-relaxed mt-4">{book.blurb}</p>
        ) : (
          <p className="text-ink-muted leading-relaxed mt-4 italic">
            {book.genre ? `${book.genre} av ${book.author}` : `Verk av ${book.author}`}
            {book.year != null ? `, utgitt i ${book.year}.` : "."}
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-medium text-ink-soft">
      {children}
    </span>
  );
}
