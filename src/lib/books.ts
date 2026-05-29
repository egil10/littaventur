// Data types, category/mode definitions, the seeded RNG, choice builder and
// the smart weighted question picker. Topic-specific layer of the BLUEPRINT.

export type Book = {
  id: string;
  title: string;
  author: string; // the primary "answer" field
  year: number | null;
  decade: string | null;
  genre: string;
  era: string;
  eraLabel: string;
  themes: string[];
  blurb: string;
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
    target: (b) => b.title,
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
// Sample K candidates and weight them by recency penalties + a rarity boost,
// then pick proportionally. Keeps the endless stream from feeling repetitive.

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

  const K = Math.min(24, eligible.length);
  const sample: Book[] = [];
  const used = new Set<number>();
  while (sample.length < K) {
    const idx = Math.floor(rnd() * eligible.length);
    if (used.has(idx)) continue;
    used.add(idx);
    sample.push(eligible[idx]);
  }

  const weights = sample.map((b) => {
    let w = 1;
    if (recent.has(b.id)) w *= 0.05; // strong penalty: shown recently
    const ans = mode.target(b)!;
    const ai = recentAnswers.indexOf(ans);
    if (ai >= 0) w *= 0.2 + 0.1 * ai; // decaying penalty: answer seen recently
    const freq = answerFreq.get(ans) ?? 1;
    w *= 1 / Math.sqrt(freq); // boost under-represented answers
    return w;
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

// recency window scaled to pool size
export function recencyWindow(poolSize: number): number {
  return Math.max(6, Math.min(40, Math.floor(poolSize * 0.35)));
}
