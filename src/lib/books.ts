// Data types, category/mode definitions, the seeded RNG, choice builder and
// the smart weighted question picker. Topic-specific layer of the BLUEPRINT.

export type Book = {
  id: string;
  title: string;
  author: string; // the primary "answer" field
  year: number | null;
  decade: string | null;
  genre: string | null; // null when unknown (fetched works) → excluded from genre mode
  era: string | null;
  eraLabel: string | null;
  themes: string[];
  blurb: string | null; // only curated works have a blurb → used for "title" mode + reveal
  orig: string | null; // English title, if any
  authorImg: string | null; // author portrait URL (recall; shown on reveal + in portrait mode)
  cats: string[]; // category tags this item belongs to ("era:samtid", "genre:roman", "theme:natur", "tag:popular")
  fame: number; // 0 == most famous; used for Elo difficulty + "popular" tagging
};

// ── Categories: typed list grouped for the picker UI ────────────────────────

export type Category = {
  key: string; // matches a value in book.cats, or "" for "all"
  label: string;
  hint: string;
  group: string;
};

export const CATEGORIES: Category[] = [
  { key: "", label: "Alt", hint: "Hele biblioteket", group: "start" },
  { key: "tag:popular", label: "De mest kjente", hint: "Kanon-verkene alle bør kjenne", group: "start" },

  { key: "era:1700", label: "1700-tallet", hint: "Holberg & opplysningstiden", group: "epoke" },
  { key: "era:1800", label: "1800-tallet", hint: "Nasjonsbygging & det moderne gjennombrudd", group: "epoke" },
  { key: "era:1900", label: "Tidlig 1900-tall", hint: "Undset, Hamsun, mellomkrigstid", group: "epoke" },
  { key: "era:etterkrig", label: "Etterkrigstid", hint: "1945–1980", group: "epoke" },
  { key: "era:samtid", label: "Samtid", hint: "1980 til i dag", group: "epoke" },

  { key: "genre:roman", label: "Roman", hint: "", group: "sjanger" },
  { key: "genre:drama", label: "Drama", hint: "Skuespill for scenen", group: "sjanger" },
  { key: "genre:lyrikk", label: "Lyrikk", hint: "Dikt og poesi", group: "sjanger" },
  { key: "genre:krim", label: "Krim", hint: "Norges store eksportvare", group: "sjanger" },
  { key: "genre:barnebok", label: "Barnebøker", hint: "Klassikere for de små", group: "sjanger" },
  { key: "genre:eventyr", label: "Eventyr", hint: "Folkediktning", group: "sjanger" },
  { key: "genre:noveller", label: "Noveller", hint: "Kortprosa", group: "sjanger" },

  { key: "theme:kvinnesak", label: "Kvinnesak", hint: "", group: "tema" },
  { key: "theme:natur", label: "Natur", hint: "", group: "tema" },
  { key: "theme:krig", label: "Krig & okkupasjon", hint: "", group: "tema" },
  { key: "theme:kjaerlighet", label: "Kjærlighet", hint: "", group: "tema" },
  { key: "theme:religion", label: "Religion & tro", hint: "", group: "tema" },
  { key: "theme:klasse", label: "Klasse & samfunn", hint: "", group: "tema" },
];

export const CATEGORY_GROUPS: { key: string; label: string }[] = [
  { key: "start", label: "" },
  { key: "epoke", label: "Epoke" },
  { key: "sjanger", label: "Sjanger" },
  { key: "tema", label: "Tema" },
];

// ── Game modes: each turns a field into the answer string ───────────────────

export type ModeKey = "author" | "portrait" | "decade" | "genre" | "era" | "title";

export type Mode = {
  key: ModeKey;
  label: string;
  hint: string;
  // The "question" verb shown on the prompt card.
  question: string;
  // Map an item to its answer for this mode (null => excluded from the pool).
  target: (b: Book) => string | null;
  // True if the prompt is an image (portrait) rather than text.
  image?: boolean;
};

export const MODES: Mode[] = [
  {
    key: "author",
    label: "Hvem skrev den?",
    hint: "Gjett forfatteren ut fra tittelen",
    question: "Hvem skrev",
    target: (b) => b.author,
  },
  {
    key: "portrait",
    label: "Hvem er forfatteren?",
    hint: "Kjenn igjen forfatteren på bildet",
    question: "Hvem er dette",
    target: (b) => (b.authorImg ? b.author : null),
    image: true,
  },
  {
    key: "decade",
    label: "Hvilket tiår?",
    hint: "Gjett utgivelsestiåret",
    question: "Når kom",
    target: (b) => b.decade,
  },
  {
    key: "genre",
    label: "Hvilken sjanger?",
    hint: "Roman, drama, lyrikk …",
    question: "Hvilken sjanger er",
    target: (b) => b.genre,
  },
  {
    key: "era",
    label: "Hvilken epoke?",
    hint: "Plasser verket i litteraturhistorien",
    question: "Hvilken epoke er",
    target: (b) => b.eraLabel,
  },
  {
    key: "title",
    label: "Hvilket verk?",
    hint: "Gjett tittelen ut fra omtalen",
    question: "Hvilket verk omtales",
    // only works with a real blurb can be guessed from their description
    target: (b) => (b.blurb ? b.title : null),
  },
];

export function modeByKey(k: ModeKey): Mode {
  return MODES.find((m) => m.key === k) ?? MODES[0];
}

// ── Seeded RNG (mulberry32) — deterministic question generation ─────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Choice builder: correct answer + 3 distinct distractors of same type ────

export type Round = {
  item: Book;
  choices: string[];
  target: string; // the correct answer
};

export function buildRound(item: Book, pool: Book[], mode: Mode, rnd: () => number): Round | null {
  const target = mode.target(item);
  if (target == null) return null;

  // Gather distinct candidate answers of the same type from the pool.
  const seen = new Set<string>([target]);
  const distractors: string[] = [];
  // For decade mode, prefer near-in-time distractors so it isn't trivial.
  const candidates = shuffle(pool, rnd);
  for (const c of candidates) {
    const v = mode.target(c);
    if (v == null || seen.has(v)) continue;
    seen.add(v);
    distractors.push(v);
    if (distractors.length >= 12) break;
  }

  let picked: string[];
  if (mode.key === "decade" && item.year != null) {
    // sort distractors by closeness to the real decade for a fairer challenge
    const realDec = Math.floor(item.year / 10) * 10;
    picked = distractors
      .sort((a, b) => Math.abs(decNum(a) - realDec) - Math.abs(decNum(b) - realDec))
      .slice(0, 6);
    picked = shuffle(picked, rnd).slice(0, 3);
  } else {
    picked = distractors.slice(0, 3);
  }

  if (picked.length < 3) return null; // not enough distractors

  const choices = shuffle([target, ...picked], rnd);
  return { item, choices, target };
}

function decNum(s: string): number {
  const m = /(\d{3,4})/.exec(s);
  return m ? parseInt(m[1], 10) : 0;
}

// ── Smart weighted question picker ──────────────────────────────────────────
// Goal: spread things out so nothing repeats too soon. Two hard guarantees plus
// a soft rarity boost:
//   1. Never re-show an *item* that's inside the recency window (if avoidable).
//   2. Prefer items whose *answer* hasn't appeared inside the answer window —
//      so e.g. in author mode you cycle through many authors before repeating
//      one, even though some authors have far more works than others.
// Among the surviving candidates we sample K and weight by a 1/sqrt(frequency)
// rarity boost (under-represented answers surface more), then pick proportionally.

export function pickItem(
  pool: Book[],
  recent: Set<string>,
  recentAnswers: string[],
  mode: Mode,
  answerFreq: Map<string, number>,
  rnd: () => number,
): Book | null {
  const eligible = pool.filter((b) => mode.target(b) != null);
  if (eligible.length === 0) return null;

  // (1) drop items shown recently, as long as something remains
  let candidates = eligible.filter((b) => !recent.has(b.id));
  if (candidates.length === 0) candidates = eligible;

  // (2) prefer items whose answer isn't in the recent-answer window
  const answerSet = new Set(recentAnswers);
  const freshAnswer = candidates.filter((b) => !answerSet.has(mode.target(b)!));
  if (freshAnswer.length > 0) candidates = freshAnswer;

  // sample K and weight by rarity (under-represented answers get a boost)
  const K = Math.min(28, candidates.length);
  const sample: Book[] = [];
  const used = new Set<number>();
  while (sample.length < K) {
    const idx = Math.floor(rnd() * candidates.length);
    if (used.has(idx)) continue;
    used.add(idx);
    sample.push(candidates[idx]);
  }

  const weights = sample.map((b) => {
    const ans = mode.target(b)!;
    const freq = answerFreq.get(ans) ?? 1;
    return 1 / Math.sqrt(freq);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return sample[0];
  let r = rnd() * total;
  for (let i = 0; i < sample.length; i++) {
    r -= weights[i];
    if (r <= 0) return sample[i];
  }
  return sample[sample.length - 1];
}

// frequency of each answer within a pool (for the rarity boost)
export function answerFrequency(pool: Book[], mode: Mode): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of pool) {
    const v = mode.target(b);
    if (v == null) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

// How many recent *items* to avoid repeating. Scales with the eligible pool so
// large pools spread far, small pools still leave room to pick from.
export function itemWindow(eligibleCount: number): number {
  return Math.max(6, Math.min(250, Math.floor(eligibleCount * 0.6)));
}

// How many recent *answers* to avoid repeating. Scales with the number of
// distinct answers for the mode (e.g. ~110 authors → ~66; only ~8 genres → ~4).
export function answerWindow(distinctAnswers: number): number {
  return Math.max(2, Math.min(80, Math.floor(distinctAnswers * 0.6)));
}
