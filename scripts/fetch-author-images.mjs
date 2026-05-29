// Fetches author portrait images from Wikidata (P18) for recall, and writes
// public/author-images.json as a { "Author Name": imageUrl } map.
//
// Wikidata is reliable for portraits (unlike work titles/years, which default
// to English and are noisy), so we use it only for images. build-books.mjs
// reads the output and attaches a portrait URL to each book.
//
// Run: `npm run images`  (network required)

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const UA = "Littaventyr/1.0 (Norwegian-literature quiz; egilfure@gmail.com)";
const ENDPOINT = "https://query.wikidata.org/sparql";

function fileUrl(commonsName, width = 640) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsName)}?width=${width}`;
}

async function sparql(query) {
  const url = ENDPOINT + "?query=" + encodeURIComponent(query) + "&format=json";
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error(`SPARQL ${r.status}`);
  const j = await r.json();
  return j.results.bindings;
}

// Manual QID overrides for names that won't match a label exactly.
const OVERRIDES = {
  "Asbjørnsen og Moe": "Q355485", // → Peter Christen Asbjørnsen portrait
  "Anne-Cath. Vestly": "Q420026",
  "Olav H. Hauge": "Q1339990",
  "Aasmund Olavsson Vinje": "Q513454",
};

async function main() {
  // 1) all Norwegian-citizen writers with a portrait + their labels
  const rows = await sparql(`
    SELECT ?person ?nb ?nn ?en ?img WHERE {
      ?person wdt:P31 wd:Q5 ; wdt:P27 wd:Q20 ; wdt:P18 ?img .
      ?person wdt:P106 ?occ .
      VALUES ?occ { wd:Q36180 wd:Q49757 wd:Q214917 wd:Q6625963 wd:Q482980 wd:Q1930187 wd:Q4853732 wd:Q12144794 }
      OPTIONAL { ?person rdfs:label ?nb FILTER(LANG(?nb)="nb") }
      OPTIONAL { ?person rdfs:label ?nn FILTER(LANG(?nn)="nn") }
      OPTIONAL { ?person rdfs:label ?en FILTER(LANG(?en)="en") }
    }`);

  const byName = new Map(); // label -> commons filename
  const byQid = new Map(); // Qid -> commons filename
  for (const b of rows) {
    const file = b.img.value.split("/Special:FilePath/").pop();
    const commons = decodeURIComponent(b.img.value.split("/").pop());
    const qid = b.person.value.split("/").pop();
    if (!byQid.has(qid)) byQid.set(qid, commons);
    for (const k of ["nb", "nn", "en"]) {
      if (b[k] && !byName.has(b[k].value)) byName.set(b[k].value, commons);
    }
  }

  // 2) our authors
  const books = JSON.parse(readFileSync(join(root, "public", "books.json"), "utf8"));
  const authors = [...new Set(books.map((b) => b.author))];

  const out = {};
  const missing = [];
  for (const a of authors) {
    let commons = null;
    if (OVERRIDES[a]) commons = byQid.get(OVERRIDES[a]) ?? null;
    if (!commons) commons = byName.get(a) ?? null;
    if (commons) out[a] = fileUrl(commons);
    else missing.push(a);
  }

  // 3) resolve stragglers: search for the QID, then fetch its P18 directly
  //    (catches portraits even when occupation tagging kept them out of step 1)
  async function qidFor(name) {
    if (OVERRIDES[name]) return OVERRIDES[name];
    const u = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=nb&uselang=nb&type=item&limit=5&format=json&origin=*`;
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    const j = await r.json();
    // prefer a hit whose description mentions writer/author/poet
    const hits = j.search ?? [];
    const pref = hits.find((h) => /forfatter|writer|author|poet|dikter|novelist|playwright|dramatiker|lyriker/i.test(h.description || ""));
    return (pref ?? hits[0])?.id ?? null;
  }

  for (const a of missing.slice()) {
    try {
      const qid = await qidFor(a);
      if (!qid) continue;
      const res = await sparql(`SELECT ?img WHERE { wd:${qid} wdt:P18 ?img } LIMIT 1`);
      const img = res[0]?.img?.value;
      if (img) {
        out[a] = fileUrl(decodeURIComponent(img.split("/").pop()));
        missing.splice(missing.indexOf(a), 1);
      }
    } catch {
      /* ignore */
    }
  }

  writeFileSync(join(root, "public", "author-images.json"), JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Matched portraits for ${Object.keys(out).length}/${authors.length} authors.`);
  if (missing.length) console.log("No portrait for:", missing.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
