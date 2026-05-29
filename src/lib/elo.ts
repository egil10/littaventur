"use client";

// Per-device Elo rating. Each question is a "match": player vs the book's
// difficulty (derived from its fame rank). Pure maths + localStorage, behind
// load/save so a server backend could swap in later.

const KEY = "litt.elo.v1";

const MIN_OPP = 700;
const MAX_OPP = 2000;
const FLOOR = 100;

export type EloState = {
  rating: number;
  peak: number;
  games: number;
  wins: number;
  history: number[]; // rating after each game (capped)
};

function def(): EloState {
  return { rating: 1200, peak: 1200, games: 0, wins: 0, history: [1200] };
}

export function loadElo(): EloState {
  if (typeof window === "undefined") return def();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def();
    return { ...def(), ...JSON.parse(raw) };
  } catch {
    return def();
  }
}

export function saveElo(s: EloState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode — ignore */
  }
}

// Opponent rating from fame rank: obscure books are stronger opponents.
export function opponentRating(fameRank: number, total: number): number {
  if (total <= 1) return (MIN_OPP + MAX_OPP) / 2;
  const t = fameRank / (total - 1); // 0 (famous) → 1 (obscure)
  return Math.round(MIN_OPP + t * (MAX_OPP - MIN_OPP));
}

function kFactor(games: number): number {
  if (games < 30) return 40;
  if (games < 100) return 24;
  return 16;
}

export type EloResult = { state: EloState; delta: number };

export function applyResult(prev: EloState, opponent: number, won: boolean): EloResult {
  const expected = 1 / (1 + Math.pow(10, (opponent - prev.rating) / 400));
  const k = kFactor(prev.games);
  const next = Math.max(FLOOR, Math.round(prev.rating + k * ((won ? 1 : 0) - expected)));
  const delta = next - prev.rating;
  const history = [...prev.history, next];
  if (history.length > 200) history.splice(0, history.length - 200);
  return {
    state: {
      rating: next,
      peak: Math.max(prev.peak, next),
      games: prev.games + 1,
      wins: prev.wins + (won ? 1 : 0),
      history,
    },
    delta,
  };
}

export function resetElo(): EloState {
  const d = def();
  saveElo(d);
  return d;
}
