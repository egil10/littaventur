# Littåventyr — Blueprint

A complete, portable spec for **Littåventyr**, the endless Norwegian-literature
quiz. This document captures the design system, architecture, data model, and
the interaction rules that give the app its feel — enough to rebuild it from
scratch, or to re-skin the framework for a different topic.

> **Two layers.** The *personality* (the blue liquid-glass design system + the
> "instant, keyboard-first, no layout jump" interaction rules) is in §3–§4 and
> should be preserved verbatim when adapting. The *topic* (the `Book` data model
> + game modes) is in §5 and is the part you swap. The generic framework
> ancestor lives in [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md).

---

## 1. What it is

An **endless multiple-choice quiz** about Norwegian literature. One question at a
time: a prompt (a book title, an author portrait, a blurb…) plus four answer
pills. Pick one → instant reveal (*Riktig! / Ikke helt*) with rich context about
the work → next. There is no score screen and no "game over" — you just keep
going. A searchable **gallery** browses all ~880 works, and a per-device **Elo
rating** tracks skill over time.

Six game modes turn different fields into the answer:

| Mode | Prompt | Answer |
| --- | --- | --- |
| **Hvem skrev den?** | book title | author |
| **Hvem er forfatteren?** | author portrait (image) | author |
| **Hvilket tiår?** | book title | decade |
| **Hvilken sjanger?** | book title | genre |
| **Hvilken epoke?** | book title | literary era |
| **Hvilket verk?** | a blurb | title |

The whole UI is in **Norwegian (Bokmål)**.

Core feelings to preserve:

- **Instant.** The dataset is preloaded and cached; the next ~3 questions'
  portraits prefetch so advancing never waits on the network.
- **Keyboard-first.** `1`–`4` to answer, `Enter` / `Space` / `→` for next,
  `Esc` to close any modal.
- **No layout jump.** Both the prompt card and the reveal panel are
  **fixed-height** (`lg:h-[480px]`); answering never shifts the page. Pills are
  fixed-height too, so labels of any length never resize them.
- **Calm, glassy, cool-blue.** Frosted translucent surfaces floating over a soft
  blue-paper gradient. No hard chrome, no solid toolbars.

---

## 2. Tech stack

- **Next.js 15 (App Router)** + **React 19**, components are all `"use client"`
  — it builds to fully static pages and runs SPA-style in the browser.
- **TypeScript**, strict.
- **Tailwind CSS 3.4** with a small custom design-token layer (§3).
- **lucide-react** for icons.
- **No backend, no database.** The dataset is a static JSON file in `public/`.
  All per-user state (rating, prefs, reports) lives in `localStorage`.
- Deploys to any static host (Vercel) — `next build` emits prerendered pages.

```
src/
  app/
    layout.tsx          # root html/body, metadata, viewport, resource hints
    globals.css         # design tokens + component classes (THE design system)
    page.tsx            # quiz route — owns category/mode state, renders <Quiz>
    galleri/page.tsx    # searchable grid + drag-scroll filter strip + detail modal
  components/
    Quiz.tsx            # the game: reducer state machine, reveal panels, streaks
    EloBadge.tsx        # rating history modal with an inline SVG sparkline
    CategoryPicker.tsx  # full-screen "which books?" chooser
    ModePicker.tsx      # full-screen "what do you guess?" chooser
    ReportsModal.tsx    # queue of user-flagged data errors
    Celebration.tsx     # confetti "diploma" modal on streak milestones
  lib/
    books.ts            # data types, CATEGORIES, MODES, seeded RNG, choice + picker
    useBooks.ts         # fetch + module-level in-memory cache of the dataset
    elo.ts              # pure Elo maths + localStorage persistence
    reports.ts          # localStorage-backed "report this item" queue
scripts/
    build-books.mjs     # assembles public/books.json (curated + fetched works)
    fetch-works.mjs     # Wikidata SPARQL → public/wikidata-works.json
    fetch-author-images.mjs  # author portrait URLs → public/author-images.json
public/
    books.json          # the dataset (~880 works), sorted by "fame" (most notable first)
```

---

## 3. Design system

The entire visual identity is ~200 lines of CSS (`globals.css`) plus a handful
of Tailwind tokens (`tailwind.config.ts`). Reproduce both and you have the look.

### 3.1 Colour & type tokens

Defined in both `:root` (CSS vars) and `tailwind.config.ts` (utility colours).

```
--canvas        #f4f7fc   cool near-white paper (page base)
--canvas-warm   #e9eef9   slightly deeper panel tint
--ink           #0b1220   primary text (near-black, cool)
--ink-soft      #1c2533   body copy
--ink-muted     #647084   secondary / labels
--hairline      rgba(11,18,32,.08)  1px dividers

--accent        #0a6cff   the signature blue (links, focus, streaks, primary buttons)
--accent-soft   rgba(10,108,255,.12)
--good          #16a34a   correct answers only
--bad           #e5484d   wrong answers only
--streak        #0a6cff   streak dots
```

- **Fonts:** no web font is loaded — a **system sans stack** keeps it instant
  (`ui-sans-serif, -apple-system, BlinkMacSystemFont, Inter, "SF Pro Text",
  "Segoe UI", sans-serif`). A **serif stack** (`Iowan Old Style, Palatino
  Linotype, Georgia, ui-serif, serif`) is used only for the `title`-mode blurb
  prompt, for a literary touch. `font-feature-settings: "ss01","cv11"` +
  `tabular-nums` on every number.
- **Type rules:** tight headings (`font-bold leading-tight`), and the recurring
  tiny eyebrow label `text-[11px] font-semibold uppercase tracking-wider
  text-ink-muted`.

### 3.2 The backdrop

A trio of soft cool-blue radial glows over the canvas, painted on a **single
fixed pseudo-element** (`body::before`, `position:fixed; z-index:-1`) — *not*
`background-attachment: fixed`, which repaints the whole gradient every scroll
frame and janks on mobile.

```css
body::before {
  content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(1100px 620px at 84% -12%, #cfe0ff 0%, transparent 60%),
    radial-gradient(900px 540px at 6% 108%, #dde7ff 0%, transparent 58%),
    radial-gradient(760px 760px at 50% 46%, #ecf2ff 0%, transparent 72%);
}
```

### 3.3 Glass surfaces (the heart of the look)

Translucent, glossy, cool surfaces with a specular sheen *baked into the
background* (a top radial-gradient highlight) so it always sits over the frosted
fill but behind content — no z-index pitfalls.

| Class | Use | Cost |
| --- | --- | --- |
| `.glass` | pills, side panel, small cards | `backdrop-filter: blur(20px)` |
| `.glass-strong` | the main prompt card | `blur(28px)` |
| `.glass-flat` | **gallery grid cards** — same look, **no** `backdrop-filter` | cheap |
| `.frost` | modal panels (near-opaque so text reads) | `blur(36px)` |
| `.frost-backdrop` | dimmed blurred scrim behind modals | `blur(16px)` |

> **Performance rule:** every live `backdrop-filter: blur()` is its own
> compositing pass. The quiz screen has only a handful, so they use real glass.
> The gallery shows dozens of cards at once, so they use **`.glass-flat`**
> (opaque-ish white gradient, no blur) — visually almost identical, fractionally
> the GPU cost. Offscreen gallery cards also get `content-visibility: auto`
> (`.cv-auto`) so the browser skips rendering them entirely.

Every glass surface carries an inner top highlight + soft blue drop shadow
(`--glass-shadow`) and a near-white 1px stroke (`--glass-stroke`).

### 3.4 Pills — the universal control

One base `.pill` (fixed `h-9`, `rounded-full`, `active:scale-.96`), three fills:

- `.pill-glass` — default frosted control (toolbar buttons, chips).
- `.pill-solid` — the blue gradient CTA (`#2f86ff → #0a6cff`) for the primary
  action and active selections.
- `.pill-ghost` — bare text button (close buttons, destructive actions).
- `.focus-ring` — shared `focus-visible` ring (`ring-accent/45 ring-offset-2`).

The toolbar is **a row of individual floating pills** over the scrolling content
(`sticky top-0 z-30`, no background band), horizontally scrollable on narrow
screens (`overflow-x-auto no-scrollbar`).

### 3.5 Shape, motion, misc

- **Radii are generous:** pills `rounded-full`; big cards `rounded-[28px]`;
  inner thumbs/chips `rounded-2xl`.
- **Motion is brief & soft:** `animate-pop` for entering cards, `animate-fade-up`
  for reveals, `animate-fade-in` for backdrops, `animate-scale-in` for the Elo
  flash. All keyframes live in `tailwind.config.ts`.
- **`prefers-reduced-motion`** collapses every animation/transition to ~0ms.
- **Custom scrollbars:** thin floating blue capsules (`::-webkit-scrollbar` +
  `scrollbar-width: thin`); `.no-scrollbar` hides them on the pill rows.
- **Colour is restrained:** almost everything is `ink` on `canvas` with the one
  blue accent. Green/red are reserved *strictly* for answer feedback.

---

## 4. UX patterns (the parts that make it feel good)

1. **Fixed-height, no jump.** Desktop is a two-column grid
   (`lg:grid-cols-[1fr_360px]`): the prompt card on the left, a fixed-width side
   panel on the right that swaps between an **idle** state (round number, mode,
   `1–4` hint) and a **reveal** state (correct/not, the answer, portrait, blurb,
   tags). Both columns are `lg:h-[480px]`. The card never resizes. Below them: a
   streak-dot tracker and the `Rekke / Best / Treff / Svart` stat row.
2. **Keyboard-first.** A global `keydown` listener: digits `1`–`4` answer while
   idle; `Enter` / `Space` / `→` advance after answering; `Esc` closes modals.
   Keys are ignored when focus is in an input.
3. **Optional auto-advance.** A toolbar pill cycles Manual → 1s → 3s → 5s
   (`AUTO_STEPS`), persisted to `localStorage`. A timer fires `next` after the
   reveal (suppressed while a celebration is showing).
4. **Look-ahead + image preload.** The reducer keeps a 3-deep `queue` of
   upcoming rounds; an effect `new Image()`s the current + queued author
   portraits so advancing is instant. The dataset is fetched once and held in a
   module-level cache (`useBooks`).
5. **Streaks + celebration.** Current/best streak tracked; a 10-dot tracker
   fills toward the goal, and crossing a multiple of 10 fires a confetti
   "diploma" (`Celebration.tsx`, auto-dismiss after 4.2s).
6. **Review mode.** Wrong items go into a capped (30) queue; with "Repetisjon"
   on, each round has a ~28% chance to re-surface a missed item.
7. **Report flow.** Every work has a flag button that queues a report in
   `localStorage` *and* copies a markdown line to the clipboard — a zero-backend
   way to collect data-quality feedback ("paste it back in chat").
8. **Per-device Elo (see §6).** A rating chip in the side panel flashes `+N/-N`
   per answer; click it for a sparkline history modal.

---

## 5. Data model + pipeline

`public/books.json` is a flat array, **sorted by `fame`** (0 = most notable
first). That ordering is itself a signal: it drives the `tag:popular` category
and the Elo opponent difficulty.

```ts
type Book = {
  id: string;              // stable slug, e.g. "henrik-ibsen--et-dukkehjem"
  title: string;
  author: string;          // the primary answer field
  year: number | null;
  decade: string | null;   // e.g. "1870-tallet"
  genre: string | null;    // null on fetched works → excluded from genre mode
  era: string | null;      // "1700" | "1800" | "1900" | "etterkrig" | "samtid"
  eraLabel: string | null; // human label for era mode
  themes: string[];
  blurb: string | null;    // only curated works → enables title mode + rich reveal
  orig: string | null;     // English/original title, if any
  authorImg: string | null;// Wikimedia Special:FilePath portrait URL (?width=640)
  cats: string[];          // tags: "era:1800", "genre:roman", "theme:natur", "tag:popular"
  fame: number;            // 0 = most famous; Elo difficulty + popular tagging
};
```

~880 works, ~860 with portraits, ~216 with curated blurbs.

- **Categories** (`CATEGORIES` in `books.ts`) are a typed list (`key`, `label`,
  `hint`, `group`) grouped for the picker UI: *start / epoke / sjanger / tema*.
  A `key` matches a value in `book.cats`; filtering is just
  `books.filter(b => b.cats.includes(key))`. The picker hides categories with
  fewer than 4 works.
- **Game modes** (`MODES`) each expose `target: (b: Book) => string | null`.
  Items returning `null` are excluded from that mode's pool (e.g. only works
  with a `blurb` are guessable by title; only works with `authorImg` appear in
  portrait mode). A mode is offered only if ≥4 distinct answers exist.

### Choice builder (`buildRound`)

Take the correct answer, gather up to 12 distinct same-type distractors from the
pool, pick 3, shuffle all four. **Decade mode is special:** distractors are
sorted by closeness to the real decade (then a random 3 of the nearest 6) so it
isn't trivially far apart. All randomness flows through a seeded **mulberry32**
PRNG so generation is deterministic per seed.

### Smart question picker (`pickItem`) — stops it feeling repetitive

1. Drop items shown inside the **item recency window** (scales with pool size,
   `itemWindow`).
2. Prefer items whose **answer** isn't in the **answer recency window**
   (`answerWindow`) — so e.g. in author mode you cycle through many authors
   before any repeats, even though some authors have far more works.
3. Sample K (≤28) survivors and weight by `1 / sqrt(answerFrequency)` so
   under-represented answers surface more; pick proportionally.

### Pipeline (`scripts/*.mjs`)

`fetch-works.mjs` queries **Wikidata SPARQL** for Norwegian literary works
(tiered by sitelink count as a fame proxy), `fetch-author-images.mjs` resolves
author portraits, and `build-books.mjs` merges those with the curated set, tags
categories, sorts by fame, and writes `public/books.json`. Bump `DATA_VERSION`
in `useBooks.ts` to bust the browser cache when you regenerate. Portrait URLs are
`commons.wikimedia.org/.../Special:FilePath/<file>?width=640`; the gallery
rewrites `width=` down to 400 for thumbnails (`thumb()`), the quiz uses the full
640 (and reuses that exact URL on the reveal so it's a cache hit).

> **Why `Special:FilePath` and not a direct `upload.wikimedia.org` URL?**
> Tempting, since it would skip the redirect hop — but it's a trap. Wikimedia
> only serves *already-generated* thumbnails from `upload.wikimedia.org`; a
> direct hit on a width that isn't cached returns **HTTP 400** (no on-demand
> generation), and the cached buckets vary per file (e.g. for one portrait 500px
> and 960px exist but 400/640/800 all 400). `Special:FilePath?width=N` is the
> only URL that reliably *generates/serves* a render — it rounds up to the
> nearest available bucket — and it's what makes the gallery's `width=400`
> downsizing work. The redirect costs one RTT on first load (mitigated by the
> `preconnect` in `layout.tsx`, then browser-cached), which is well worth the
> reliability + resizability. If you ever need to truly kill the redirect,
> **self-host** the ~100 portraits in `public/` instead of rewriting the URLs.

---

## 6. Elo rating (per-device, no backend)

Each question is a "match": the player (starts at **1200**) vs the work's
difficulty, derived from its fame rank — obscure works are stronger opponents
worth more. Standard logistic Elo:

```
expected = 1 / (1 + 10^((opponent - rating) / 400))
rating   = rating + K * ((won ? 1 : 0) - expected)     // floored at 100
```

- **Opponent rating** from rank: `700 + (rank / (total-1)) * (2000 - 700)`.
- **K-factor** tapers: 40 (<30 games) → 24 (<100) → 16.
- **Persistence:** `{ rating, peak, games, wins, history[] }` in `localStorage`
  under a versioned key, behind `loadElo()` / `saveElo()` so a server backend
  (cross-device accounts, leaderboards) can swap in later.
- **UI:** a rating chip in the side panel with a `+N/-N` flash; click opens a
  `frost` modal with an inline **SVG sparkline** of the history, peak / games /
  accuracy, and a reset.

**SSR-safe persistence pattern (reuse for everything device-local):**

```ts
const KEY = "litt.feature.v1";                 // always versioned
export function load(): T {
  if (typeof window === "undefined") return def();      // SSR returns default
  try { return { ...def(), ...JSON.parse(localStorage.getItem(KEY) || "") }; }
  catch { return def(); }
}
```

Hydrate **after** mount (`useState(def)` then `useEffect(() => setState(load()), [])`)
so server and client first render the same default and there's no hydration
mismatch. Same pattern backs prefs (`AUTO_KEY`, `REVIEW_KEY`) and reports.

---

## 7. Game state shape

`Quiz` is a `useReducer` state machine kept **pure** — no `localStorage`/IO in
the reducer; all side effects (Elo scoring, image preload, timers, persistence)
live in effects.

```ts
type Phase = "idle" | "answered";
type State = {
  current: Round | null;     // { item, choices[], target }
  queue: Round[];            // 3-deep look-ahead for preloading
  recent: string[];          // item recency window (ids)
  recentAnswers: string[];   // answer recency window
  wrong: string[];           // review queue (capped at 30)
  picked: string | null;
  phase: Phase;
  streak: number; best: number; total: number; correct: number;
  seed: number; nonce: number;
};
type Action =
  | { type: "answer"; choice: string }
  | ({ type: "next" } & Ctx)               // Ctx = pool, mode, freq, byId, review, windows
  | ({ type: "reset"; seed: number } & Ctx);
```

- **`answer`**: mark `answered`, update streak/best/total/correct, push or clear
  the review queue.
- **`next`**: shift the look-ahead `queue`, then `fillQueue` back to depth 3
  (each fresh round may inject a review item, else runs the weighted picker and
  advances both recency windows).
- **`reset`**: re-seed and refill — fired when the pool (`category|mode|length`)
  changes.
- Elo is scored in an **effect** keyed on the phase transition, guarded by a ref
  (`scoredRef`) so each round scores exactly once.

---

## 8. Component inventory

- **`<Quiz>`** — owns the game; toolbar pills (brand / mode / count / auto /
  review / gallery / reports), the prompt card (text or portrait), the
  idle/reveal side panel with the Elo chip, streak dots + stats, and mounts the
  Elo / reports / celebration modals.
- **`<EloBadge>`** (`EloHistoryModal`) — rating modal with a hand-rolled SVG
  sparkline (area fill + line + end dot).
- **`<CategoryPicker>` / `<ModePicker>`** — full-screen `frost` overlays;
  `role="dialog" aria-modal`, close on backdrop click or `Esc`. Counts/playable
  flags are memoized.
- **Gallery page** — sticky pill toolbar (back, search input, drag-scroll filter
  strip), responsive `glass-flat` grid (2→5 cols) with `IntersectionObserver`
  infinite scroll (24/page), and a `glass-strong` detail modal.

### Gotcha worth copying: drag-to-scroll vs click

The gallery filter strip supports mouse drag-to-scroll. **Do not call
`setPointerCapture` on pointer-down** — capturing routes the subsequent `click`
to the container instead of the child button, silently breaking plain clicks.
Capture **lazily**, only after movement exceeds ~4px, and use a `moved` flag to
suppress the click that ends a real drag. (See `FilterStrip` in
`galleri/page.tsx`.)

---

## 9. Performance notes (what's already done)

- **No web fonts** — system stack, zero font round-trips.
- Dataset **preloaded** (`<link rel="preload" as="fetch">`) in parallel with the
  JS bundle and cached module-level; `DATA_VERSION` query busts it on regen.
- `preconnect` to `upload.wikimedia.org` + `dns-prefetch` to
  `commons.wikimedia.org` to warm the portrait connection.
- Upcoming portraits **prefetched** via the look-ahead queue.
- Backdrop on a **fixed pseudo-element**, not `background-attachment: fixed`.
- Gallery cards use **`.glass-flat`** (no `backdrop-filter`) + `content-visibility:
  auto`; thumbnails request a **400px** Wikimedia render instead of 640.
- Category/filter counts and mode-playability are **memoized** (one pass over the
  dataset, not one filter-scan per pill).
- First Load JS ≈ **117 kB** for the quiz route, ≈ 111 kB for the gallery.

---

## 10. Re-skinning checklist for a new topic

1. Write `scripts/*.mjs` to produce `public/books.json` as your `Item[]`, sorted
   by a notability metric; keep ids stable.
2. Update the `Book` type + `CATEGORIES` + `MODES` (`target` map) for your
   facets. Everything downstream (pool filtering, choice building, the weighted
   picker, Elo difficulty) is generic.
3. Replace the prompt rendering (`PromptBody` / portrait branch) with your
   question medium — text, image, audio, map. The 4-pill answer UI stays.
4. Rename metadata + the strings (they're Norwegian here) and the theme colour;
   **keep the glass/pill CSS and the interaction rules** — that's the
   personality.
5. `next build` → deploy static.
