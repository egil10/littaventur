// Fetches the fuller bibliography for each author from Wikidata and writes
// public/wikidata-works.json. build-books.mjs merges these with the curated
// set (curated wins on conflicts, keeping the good blurbs).
//
// Wikidata is queried at the *work* level (not editions), which gives clean,
// mostly-Norwegian titles + years. Per the project decision, we accept partial
// metadata: a work missing a year/genre is simply excluded from the modes that
// need that field (decade/genre), but still playable in author/portrait modes.
//
// Run: `npm run works`  (network required, ~2-3 min)

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const UA = "Littaventyr/1.0 (Norwegian-literature quiz; egilfure@gmail.com)";
const ENDPOINT = "https://query.wikidata.org/sparql";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query, tries = 4) {
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(query);
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } });
    if (r.status === 429 || r.status === 503) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (!r.ok) throw new Error(`SPARQL ${r.status}`);
    return (await r.json()).results.bindings;
  }
  throw new Error("SPARQL retries exhausted");
}

// Author-name overrides where entity search is unreliable.
const QID_OVERRIDES = {
  "Henrik Ibsen": "Q36661",
  "Knut Hamsun": "Q40826",
  "Sigrid Undset": "Q44306",
  "Bjørnstjerne Bjørnson": "Q81960",
  "Jon Fosse": "Q443868",
  "Ludvig Holberg": "Q212499",
  "Asbjørnsen og Moe": "Q355485", // Peter Christen Asbjørnsen
  "Aasmund Olavsson Vinje": "Q513454",
  "Olav H. Hauge": "Q1339990",
  "Anne-Cath. Vestly": "Q420026",
};

async function qidFor(name) {
  if (QID_OVERRIDES[name]) return QID_OVERRIDES[name];
  const u = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=nb&uselang=nb&type=item&limit=6&format=json&origin=*`;
  const j = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  const hits = j.search ?? [];
  const pref = hits.find((h) => /forfatter|writer|author|poet|dikter|novelist|playwright|dramatiker|lyriker/i.test(h.description || ""));
  return (pref ?? hits[0])?.id ?? null;
}

function mapGenre(labels) {
  const s = labels.join(" ").toLowerCase();
  if (/crime|detective|thriller|mystery/.test(s)) return "Krim";
  if (/poem|poetry|lyric|verse/.test(s)) return "Lyrikk";
  if (/(stage )?play|drama|theatr|tragedy|comedy/.test(s)) return "Drama";
  if (/children|picture book|juvenile|young adult/.test(s)) return "Barnebok";
  if (/fairy tale|folk|legend/.test(s)) return "Eventyr";
  if (/short story|novella|short fiction/.test(s)) return "Noveller";
  if (/essay|non-fiction|nonfiction|autobiograph|memoir|biography|treatise|textbook/.test(s)) return "Sakprosa";
  if (/novel|roman|fiction/.test(s)) return "Roman";
  return null;
}

async function worksFor(qid) {
  const rows = await sparql(`
    SELECT DISTINCT ?work ?nb ?nn ?en ?year ?genreLabel ?typeLabel WHERE {
      ?work wdt:P50 wd:${qid} ; wdt:P31 ?type .
      ?type wdt:P279* ?root . VALUES ?root { wd:Q47461344 wd:Q7725634 wd:Q25379 }
      MINUS { ?work wdt:P31 wd:Q3331189 }
      OPTIONAL { ?work rdfs:label ?nb FILTER(LANG(?nb)="nb") }
      OPTIONAL { ?work rdfs:label ?nn FILTER(LANG(?nn)="nn") }
      OPTIONAL { ?work rdfs:label ?en FILTER(LANG(?en)="en") }
      OPTIONAL { ?work wdt:P577 ?d . BIND(YEAR(?d) AS ?year) }
      OPTIONAL { ?work wdt:P136 ?g . ?g rdfs:label ?genreLabel FILTER(LANG(?genreLabel)="en") }
      OPTIONAL { ?work wdt:P31 ?ty . ?ty rdfs:label ?typeLabel FILTER(LANG(?typeLabel)="en") }
    }`);

  // aggregate the (possibly multiple) rows per work
  const byWork = new Map();
  for (const r of rows) {
    const id = r.work.value;
    let w = byWork.get(id);
    if (!w) {
      w = { nb: null, nn: null, en: null, years: new Set(), genres: new Set() };
      byWork.set(id, w);
    }
    if (r.nb) w.nb = r.nb.value;
    if (r.nn) w.nn = r.nn.value;
    if (r.en) w.en = r.en.value;
    if (r.year) w.years.add(parseInt(r.year.value, 10));
    if (r.genreLabel) w.genres.add(r.genreLabel.value);
    if (r.typeLabel) w.genres.add(r.typeLabel.value);
  }

  const works = [];
  for (const w of byWork.values()) {
    const title = w.nb || w.nn || w.en;
    if (!title) continue;
    // skip QID-looking labels and obvious non-titles
    if (/^Q\d+$/.test(title)) continue;
    const year = w.years.size ? Math.min(...w.years) : null;
    works.push({
      title: title.trim(),
      lang: w.nb ? "nb" : w.nn ? "nn" : "en",
      year,
      genre: mapGenre([...w.genres]),
    });
  }
  return works;
}

function normTitle(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9æøå]+/g, " ").trim();
}

async function main() {
  const books = JSON.parse(readFileSync(join(root, "public", "books.json"), "utf8"));
  const authors = [...new Set(books.map((b) => b.author))];

  const out = {};
  let totalWorks = 0;
  for (const name of authors) {
    try {
      const qid = await qidFor(name);
      if (!qid) {
        console.log(`! no QID for ${name}`);
        continue;
      }
      const works = await worksFor(qid);
      // dedupe by normalized title, keep earliest year
      const seen = new Map();
      for (const w of works) {
        const k = normTitle(w.title);
        if (!k) continue;
        const ex = seen.get(k);
        if (!ex) seen.set(k, w);
        else if (w.year && (!ex.year || w.year < ex.year)) seen.set(k, w);
      }
      let list = [...seen.values()].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
      if (list.length > 60) list = list.slice(0, 60); // cap so no author runs away
      out[name] = { qid, works: list };
      totalWorks += list.length;
      console.log(`${name} (${qid}): ${list.length} works`);
      await sleep(550);
    } catch (e) {
      console.log(`! error for ${name}: ${e.message}`);
      await sleep(1500);
    }
  }

  writeFileSync(join(root, "public", "wikidata-works.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nDone. ${totalWorks} works across ${Object.keys(out).length} authors → public/wikidata-works.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
