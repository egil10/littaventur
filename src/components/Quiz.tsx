"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Flag,
  Grid3x3,
  Layers,
  Repeat,
  Sparkles,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  answerFrequency,
  answerWindow,
  buildRound,
  itemWindow,
  mulberry32,
  modeByKey,
  pickItem,
  type Book,
  type ModeKey,
  type Round,
} from "@/lib/books";
import { applyResult, loadElo, opponentRating, resetElo, saveElo, type EloState } from "@/lib/elo";
import { addReport, loadReports, type Report } from "@/lib/reports";
import EloHistoryModal from "./EloBadge";
import ReportsModal from "./ReportsModal";
import Celebration from "./Celebration";

// ── reducer state machine (pure: no IO in here) ─────────────────────────────

type Phase = "idle" | "answered";

type State = {
  current: Round | null;
  queue: Round[];
  recent: string[]; // item recency window (ids)
  recentAnswers: string[]; // answer recency window
  wrong: string[]; // review queue (capped, item ids)
  picked: string | null;
  phase: Phase;
  streak: number;
  best: number;
  total: number;
  correct: number;
  seed: number;
  nonce: number;
};

type Ctx = {
  pool: Book[];
  mode: ReturnType<typeof modeByKey>;
  freq: Map<string, number>;
  byId: Map<string, Book>;
  review: boolean;
  itemWin: number;
  answerWin: number;
};

type Action =
  | { type: "answer"; choice: string }
  | ({ type: "next" } & Ctx)
  | ({ type: "reset"; seed: number } & Ctx);

const LOOKAHEAD = 3;

function freshRound(state: State, ctx: Ctx): { round: Round | null; nonce: number; recent: string[]; recentAnswers: string[] } {
  let recent = state.recent;
  let recentAnswers = state.recentAnswers;
  let nonce = state.nonce;
  let round: Round | null = null;

  const rng = mulberry32(state.seed + nonce * 2654435761);
  nonce++;

  // maybe surface a review item
  const wantReview = ctx.review && state.wrong.length > 0 && rng() < 0.28;
  let item: Book | null = null;
  if (wantReview) {
    const id = state.wrong[Math.floor(rng() * state.wrong.length)];
    item = ctx.byId.get(id) ?? null;
    if (item && ctx.mode.target(item) == null) item = null;
  }
  if (!item) {
    item = pickItem(ctx.pool, new Set(recent), recentAnswers, ctx.mode, ctx.freq, rng);
  }
  if (item) {
    round = buildRound(item, ctx.pool, ctx.mode, rng);
    if (round) {
      recent = [round.item.id, ...recent].slice(0, ctx.itemWin);
      recentAnswers = [round.target, ...recentAnswers].slice(0, ctx.answerWin);
    }
  }
  return { round, nonce, recent, recentAnswers };
}

function fillQueue(state: State, ctx: Ctx): State {
  let s = state;
  const queue = [...s.queue];
  let { recent, recentAnswers, nonce } = s;
  let guard = 0;
  while (queue.length < LOOKAHEAD && guard++ < 40) {
    const r = freshRound({ ...s, recent, recentAnswers, nonce }, ctx);
    nonce = r.nonce;
    if (r.round) {
      queue.push(r.round);
      recent = r.recent;
      recentAnswers = r.recentAnswers;
    }
  }
  return { ...s, queue, recent, recentAnswers, nonce };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "answer": {
      if (state.phase !== "idle" || !state.current) return state;
      const won = action.choice === state.current.target;
      const wrong = won
        ? state.wrong
        : [state.current.item.id, ...state.wrong.filter((id) => id !== state.current!.item.id)].slice(0, 30);
      // a correct answer clears the item from the review queue
      const cleared = won ? state.wrong.filter((id) => id !== state.current!.item.id) : wrong;
      return {
        ...state,
        picked: action.choice,
        phase: "answered",
        streak: won ? state.streak + 1 : 0,
        best: won ? Math.max(state.best, state.streak + 1) : state.best,
        total: state.total + 1,
        correct: state.correct + (won ? 1 : 0),
        wrong: cleared,
      };
    }
    case "next": {
      if (state.phase !== "answered") return state;
      let s: State = { ...state, picked: null, phase: "idle" };
      const queue = [...s.queue];
      const next = queue.shift() ?? null;
      s = { ...s, current: next, queue };
      s = fillQueue(s, action);
      // safety: if somehow no current, pull from refilled queue
      if (!s.current && s.queue.length) {
        s = { ...s, current: s.queue[0], queue: s.queue.slice(1) };
        s = fillQueue(s, action);
      }
      return s;
    }
    case "reset": {
      let s: State = {
        current: null,
        queue: [],
        recent: [],
        recentAnswers: [],
        wrong: [],
        picked: null,
        phase: "idle",
        streak: 0,
        best: state.best,
        total: 0,
        correct: 0,
        seed: action.seed,
        nonce: 0,
      };
      s = fillQueue(s, action);
      s = { ...s, current: s.queue[0] ?? null, queue: s.queue.slice(1) };
      s = fillQueue(s, action);
      return s;
    }
  }
}

// ── auto-advance preference (localStorage) ──────────────────────────────────

const AUTO_KEY = "litt.autoadvance.v1";
const REVIEW_KEY = "litt.review.v1";
const AUTO_STEPS = [0, 1000, 3000, 5000];

function loadNum(key: string, def: number): number {
  if (typeof window === "undefined") return def;
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}

// ── component ───────────────────────────────────────────────────────────────

export default function Quiz({
  books,
  category,
  mode,
  onOpenCategory,
  onOpenMode,
}: {
  books: Book[];
  category: string;
  mode: ModeKey;
  onOpenCategory: () => void;
  onOpenMode: () => void;
}) {
  const m = useMemo(() => modeByKey(mode), [mode]);
  const pool = useMemo(
    () => (category ? books.filter((b) => b.cats.includes(category)) : books),
    [books, category],
  );
  const freq = useMemo(() => answerFrequency(pool, m), [pool, m]);
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  const [reviewOn, setReviewOn] = useState(false);
  const ctx: Ctx = useMemo(() => {
    const eligible = pool.reduce((n, b) => n + (m.target(b) != null ? 1 : 0), 0);
    return {
      pool,
      mode: m,
      freq,
      byId,
      review: reviewOn,
      itemWin: itemWindow(eligible),
      answerWin: answerWindow(freq.size),
    };
  }, [pool, m, freq, byId, reviewOn]);

  const [state, dispatch] = useReducer(reducer, undefined, (): State =>
    reducer(
      {
        current: null,
        queue: [],
        recent: [],
        recentAnswers: [],
        wrong: [],
        picked: null,
        phase: "idle",
        streak: 0,
        best: 0,
        total: 0,
        correct: 0,
        seed: 1,
        nonce: 0,
      },
      {
        type: "reset",
        seed: 1,
        pool,
        mode: m,
        freq,
        byId,
        review: reviewOn,
        itemWin: itemWindow(pool.length),
        answerWin: answerWindow(freq.size),
      },
    ),
  );

  // re-seed the game whenever the pool or mode changes
  const poolKey = `${category}|${mode}|${pool.length}`;
  const lastPoolKey = useRef(poolKey);
  useEffect(() => {
    if (lastPoolKey.current !== poolKey) {
      lastPoolKey.current = poolKey;
      dispatch({ type: "reset", seed: (Date.now() & 0xffff) + 1, ...ctx });
    }
  }, [poolKey, ctx]);

  // ── Elo (hydrate after mount; score once per round in an effect) ──────────
  const [elo, setElo] = useState<EloState>(() => loadElo());
  const [eloFlash, setEloFlash] = useState<number | null>(null);
  const [eloOpen, setEloOpen] = useState(false);
  useEffect(() => setElo(loadElo()), []);
  const scoredRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.phase !== "answered" || !state.current || state.picked == null) return;
    const key = `${state.current.item.id}#${state.total}`;
    if (scoredRef.current === key) return;
    scoredRef.current = key;
    const won = state.picked === state.current.target;
    const opp = opponentRating(state.current.item.fame, books.length);
    const { state: next, delta } = applyResult(loadElo(), opp, won);
    saveElo(next);
    setElo(next);
    setEloFlash(delta);
  }, [state.phase, state.picked, state.current, state.total, books.length]);

  // ── prefs ─────────────────────────────────────────────────────────────────
  const [autoIdx, setAutoIdx] = useState(0);
  useEffect(() => {
    setAutoIdx(loadNum(AUTO_KEY, 0));
    setReviewOn(loadNum(REVIEW_KEY, 0) === 1);
  }, []);
  const autoMs = AUTO_STEPS[autoIdx] ?? 0;

  // ── reports ─────────────────────────────────────────────────────────────
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  useEffect(() => setReports(loadReports()), []);

  // ── celebration on crossing a streak goal ─────────────────────────────────
  const GOAL = 10;
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const lastStreak = useRef(0);
  useEffect(() => {
    if (state.streak > lastStreak.current && state.streak > 0 && state.streak % GOAL === 0) {
      setCelebrate(state.streak);
    }
    lastStreak.current = state.streak;
  }, [state.streak]);

  // ── next + answer helpers ─────────────────────────────────────────────────
  const next = useCallback(() => dispatch({ type: "next", ...ctx }), [ctx]);
  const answer = useCallback(
    (choice: string) => {
      if (state.phase === "idle") dispatch({ type: "answer", choice });
    },
    [state.phase],
  );

  // ── preload upcoming portraits so advancing never waits on the network ───
  useEffect(() => {
    const urls = [state.current, ...state.queue]
      .map((r) => r?.item.authorImg)
      .filter((u): u is string => !!u);
    for (const u of urls) {
      const img = new Image();
      img.src = u;
    }
  }, [state.current, state.queue]);

  // ── auto-advance timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "answered" || autoMs <= 0 || celebrate != null) return;
    const t = setTimeout(() => next(), autoMs);
    return () => clearTimeout(t);
  }, [state.phase, autoMs, next, celebrate, state.total]);

  // ── keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (celebrate != null) {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          setCelebrate(null);
        }
        return;
      }
      if (state.phase === "idle" && state.current) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= state.current.choices.length) {
          e.preventDefault();
          answer(state.current.choices[n - 1]);
        }
      } else if (state.phase === "answered") {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, state.current, answer, next, celebrate]);

  const cur = state.current;
  const won = state.phase === "answered" && state.picked === cur?.target;
  const item = cur?.item;
  const acc = state.total > 0 ? Math.round((state.correct / state.total) * 100) : 0;

  const cycleAuto = () => {
    const ni = (autoIdx + 1) % AUTO_STEPS.length;
    setAutoIdx(ni);
    localStorage.setItem(AUTO_KEY, String(ni));
  };
  const toggleReview = () => {
    const nv = !reviewOn;
    setReviewOn(nv);
    localStorage.setItem(REVIEW_KEY, nv ? "1" : "0");
  };

  const report = () => {
    if (!item) return;
    const r = { id: item.id, title: item.title, author: item.author, note: "" };
    setReports(addReport(r));
    const md = `- [ ] **${item.title}** — ${item.author}`;
    navigator.clipboard?.writeText(md).catch(() => {});
  };

  if (!cur || !item) {
    return (
      <div className="grid place-items-center min-h-[60vh] text-ink-muted">
        <div className="animate-fade-in">Ingen verk i dette utvalget — velg et annet.</div>
      </div>
    );
  }

  // dot tracker toward the streak goal
  const dots = Array.from({ length: GOAL }, (_, i) => i < state.streak % GOAL || (state.streak > 0 && state.streak % GOAL === 0));

  // the 4 answer pills — fixed height so content never resizes them. Laid out
  // differently per mode (2-col below the prompt, or 1-col beside the portrait).
  const answerPills = (gridCls: string) => (
    <div className={gridCls} role="group" aria-label="Svaralternativer">
      {cur.choices.map((c, i) => {
        const isTarget = c === cur.target;
        const isPicked = c === state.picked;
        let cls = "glass hover:brightness-[1.03]";
        if (state.phase === "answered") {
          if (isTarget) cls = "text-white border-transparent shadow-[0_8px_22px_-8px_rgba(22,163,74,0.7)]";
          else if (isPicked) cls = "text-white border-transparent shadow-[0_8px_22px_-8px_rgba(229,72,77,0.7)]";
          else cls = "glass opacity-50";
        }
        const bg =
          state.phase === "answered" && isTarget
            ? "linear-gradient(180deg,#22c55e,#16a34a)"
            : state.phase === "answered" && isPicked
              ? "linear-gradient(180deg,#f0686d,#e5484d)"
              : undefined;
        return (
          <button
            key={c}
            onClick={() => answer(c)}
            disabled={state.phase === "answered"}
            style={bg ? { background: bg } : undefined}
            className={`focus-ring text-left rounded-2xl h-14 px-4 transition-[transform,filter,opacity] duration-150 active:scale-[0.98] flex items-center gap-3 ${cls}`}
          >
            <span
              className={`grid place-items-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${
                state.phase === "answered" && (isTarget || isPicked)
                  ? "bg-white/25 text-white"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {i + 1}
            </span>
            <span className="font-medium leading-tight line-clamp-2">{c}</span>
            {state.phase === "answered" && isTarget && <Check size={18} className="ml-auto shrink-0" />}
            {state.phase === "answered" && isPicked && !isTarget && <X size={18} className="ml-auto shrink-0" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      {/* toolbar: one fixed-height scrollable row of floating pills */}
      <div className="sticky top-0 z-30 py-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="pill-glass shrink-0">
            <BookOpen size={15} className="text-accent" />
            <span className="font-semibold">Littåventyr</span>
          </span>
          <button
            onClick={onOpenMode}
            className="pill-glass focus-ring shrink-0 min-w-[152px] !justify-start"
            title="Bytt spillmodus"
          >
            <Layers size={15} className="opacity-70 shrink-0" />
            <span className="truncate">{m.label}</span>
          </button>
          <button onClick={onOpenCategory} className="pill-glass focus-ring shrink-0" title="Bytt utvalg">
            <Sparkles size={15} className="opacity-70" />
            <span className="tabular-nums text-ink-muted">{pool.length}</span> verk
          </button>
          <button
            onClick={cycleAuto}
            className="pill-glass focus-ring shrink-0 min-w-[120px] !justify-start"
            title="Auto-advance"
          >
            <Timer size={15} className="opacity-70 shrink-0" />
            {autoMs === 0 ? "Manuell" : `${autoMs / 1000}s auto`}
          </button>
          <button
            onClick={toggleReview}
            className={`focus-ring shrink-0 ${reviewOn ? "pill-solid" : "pill-glass"}`}
            title="Repeter verk du har bommet på"
          >
            <Repeat size={15} className={reviewOn ? "" : "opacity-70"} />
            Repetisjon
          </button>
          <Link href="/galleri" className="pill-glass focus-ring shrink-0" title="Bla i hele biblioteket">
            <Grid3x3 size={15} className="opacity-70" />
            Galleri
          </Link>
          <button
            onClick={() => setReportsOpen(true)}
            className="pill-glass focus-ring shrink-0 !px-3"
            title="Rapporterte verk"
          >
            <Flag size={15} className="opacity-70" />
            {reports.length > 0 && <span className="tabular-nums">{reports.length}</span>}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4 mt-2">
        {/* prompt card — fixed height so titles of any length never shift it */}
        <div
          key={item.id}
          className="glass-strong liquid rounded-[28px] p-6 sm:p-8 animate-pop relative flex flex-col lg:h-[480px]"
        >
          <button
            onClick={report}
            className="absolute top-3 right-3 z-10 pill-ghost focus-ring text-ink-muted !px-2"
            title="Meld feil i dette verket"
            aria-label="Meld feil"
          >
            <Flag size={16} />
          </button>

          {mode === "portrait" ? (
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center h-full">
              <div className="flex-1 min-h-0 grid place-items-center">
                {item.authorImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.authorImg}
                    alt="Forfatterportrett"
                    width={400}
                    height={400}
                    fetchPriority="high"
                    decoding="async"
                    className="w-full max-w-[260px] lg:max-w-[400px] aspect-square object-cover object-[50%_20%] rounded-[28px] glass"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full max-w-[260px] aspect-square grid place-items-center rounded-[28px] glass text-ink-muted">
                    (mangler bilde)
                  </div>
                )}
              </div>
              <div className="lg:w-[300px] flex flex-col gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Hvem er forfatteren?
                </div>
                {answerPills("grid grid-cols-1 gap-3")}
              </div>
            </div>
          ) : (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {m.question}
              </div>
              <div className="flex-1 min-h-0 flex flex-col justify-center py-4">
                <PromptBody mode={mode} item={item} />
              </div>
              {answerPills("grid sm:grid-cols-2 gap-3")}
            </>
          )}
        </div>

        {/* feedback / idle panel — fixed height; holds the live rating */}
        <div className="lg:h-[480px]">
          <div className="glass liquid rounded-[28px] p-6 h-full flex flex-col">
            {state.phase === "idle" ? (
              <div className="animate-fade-in flex flex-col h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Runde</div>
                    <div className="text-4xl font-bold tabular-nums leading-tight">{state.total + 1}</div>
                  </div>
                  <RatingChip rating={elo.rating} onClick={() => setEloOpen(true)} />
                </div>
                <div className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Modus</div>
                <div className="text-lg font-semibold">{m.label}</div>
                <div className="mt-auto pt-6 flex items-center gap-2 text-sm text-ink-muted">
                  <kbd className="glass rounded-md px-1.5 py-0.5 text-xs">1</kbd>–
                  <kbd className="glass rounded-md px-1.5 py-0.5 text-xs">4</kbd>
                  for å svare
                </div>
              </div>
            ) : (
              <div className="animate-fade-up flex flex-col h-full min-h-0" role="status" aria-live="polite">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: won ? "var(--good)" : "var(--bad)" }}
                  >
                    {won ? "Riktig!" : "Ikke helt"}
                  </div>
                  <RatingChip rating={elo.rating} delta={eloFlash} onClick={() => setEloOpen(true)} />
                </div>
                <div className="mt-1 text-2xl font-bold leading-tight">{cur.target}</div>
                {!won && (
                  <div className="text-sm text-ink-muted mt-1">
                    Du svarte <span className="font-medium text-ink">{state.picked}</span>
                  </div>
                )}

                <div className="mt-3 h-px bg-[var(--hairline)]" />

                <div className="mt-3 flex gap-3">
                  {item.authorImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.authorImg}
                      alt={item.author}
                      width={96}
                      height={96}
                      decoding="async"
                      className="w-24 h-24 object-cover object-[50%_18%] rounded-2xl glass shrink-0"
                      draggable={false}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-lg font-semibold leading-snug">
                      {item.title}
                      {item.orig && <span className="text-ink-muted font-normal"> · {item.orig}</span>}
                    </div>
                    <div className="text-sm text-ink-muted">
                      {item.author}
                      {item.year != null && ` · ${item.year}`}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.genre && <Tag>{item.genre}</Tag>}
                      {item.eraLabel && <Tag>{item.eraLabel}</Tag>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
                  <p className="text-sm leading-relaxed text-ink-soft">{item.blurb ?? describe(item)}</p>
                </div>

                <button onClick={next} className="pill-solid focus-ring mt-3 self-start">
                  Neste
                  <span className="opacity-70 text-xs">Enter ↵</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* streak + stats footer */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-5">
        <div className="flex items-center gap-1.5" title="Rekke mot 10" aria-hidden="true">
          {dots.map((on, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full transition"
              style={{ background: on ? "var(--streak)" : "rgba(20,50,130,0.14)" }}
            />
          ))}
        </div>
        <Stat label="Rekke" value={state.streak} />
        <Stat label="Best" value={state.best} />
        <Stat label="Treff" value={`${acc}%`} />
        <Stat label="Svart" value={state.total} />
      </div>

      {eloOpen && (
        <EloHistoryModal
          elo={elo}
          onClose={() => setEloOpen(false)}
          onReset={() => {
            setElo(resetElo());
            setEloFlash(null);
          }}
        />
      )}
      {reportsOpen && (
        <ReportsModal reports={reports} onChange={setReports} onClose={() => setReportsOpen(false)} />
      )}
      {celebrate != null && <Celebration streak={celebrate} onClose={() => setCelebrate(null)} />}
    </div>
  );
}

function PromptBody({ mode, item }: { mode: ModeKey; item: Book }) {
  if (mode === "title") {
    // hide the title; the blurb is the prompt
    return (
      <div>
        <p className="text-xl sm:text-2xl font-serif leading-relaxed">{item.blurb}</p>
        <div className="text-sm text-ink-muted mt-4">
          skrevet av <span className="font-medium text-ink">{item.author}</span>
          {item.year != null && ` (${item.year})`}
        </div>
      </div>
    );
  }
  // author / decade / genre / era: the title is the prompt.
  // Show helpful context tags that don't give the current answer away.
  return (
    <div>
      <h1 className="text-3xl sm:text-5xl font-bold leading-[1.05] tracking-tight">{item.title}</h1>
      <div className="flex flex-wrap gap-1.5 mt-4">
        {/* author helps for everything except when the author IS the answer */}
        {mode !== "author" && <Tag>{item.author}</Tag>}
        {/* genre helps except when genre is the answer */}
        {mode !== "genre" && item.genre && <Tag>{item.genre}</Tag>}
      </div>
    </div>
  );
}

// fallback reveal text for fetched works that have no curated blurb
function describe(item: Book): string {
  const parts: string[] = [];
  parts.push(item.genre ? `${item.genre} av ${item.author}` : `Verk av ${item.author}`);
  if (item.year != null) parts.push(`utgitt i ${item.year}`);
  return parts.join(", ") + ".";
}

// Live rating chip living in the feedback/idle panel. Shows the rating and,
// after answering, the +N / -N change. Click opens the history modal.
function RatingChip({ rating, delta, onClick }: { rating: number; delta?: number | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pill-glass focus-ring tabular-nums !h-8 !px-3 shrink-0"
      title="Din rating — klikk for historikk"
    >
      <TrendingUp size={14} className="text-accent" />
      <span className="font-semibold">{rating}</span>
      {delta != null && (
        <span className="font-semibold animate-scale-in" style={{ color: delta >= 0 ? "var(--good)" : "var(--bad)" }}>
          {delta >= 0 ? `+${delta}` : delta}
        </span>
      )}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold tabular-nums leading-none">{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
    </div>
  );
}
