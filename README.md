# Littåventyr 📚

**Den endeløse quizen om norsk litteratur.** Gjett forfatter, tiår, sjanger og
epoke — fra Holberg og Ibsen til Fosse og Knausgård. Bygd for å gjøre deg til en
skikkelig litteraturkjenner, én runde av gangen.

Re-skinning av "Canvas"-rammeverket beskrevet i [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md):
samme glassaktige, tastatur-først, endeløse quiz — men om bøker i stedet for
malerier.

## Slik spiller du

- Et verk vises (tittel + kontekst). Velg blant **4 svar**.
- **Tastatur:** `1`–`4` for å svare, `Enter` / `Space` / `→` for neste.
- Umiddelbar fasit med en liten omtale av verket — du lærer mens du spiller.
- **Spillmodus:** Hvem skrev den? · **Hvem er forfatteren?** (gjett ut fra
  portrettet) · Hvilket tiår? · Hvilken sjanger? · Hvilken epoke? · Hvilket
  verk? (gjett tittelen ut fra omtalen)
- **Utvalg:** spill på hele biblioteket, de mest kjente, en epoke, en sjanger
  eller et tema.
- **Rating:** en personlig Elo-rating (lagret lokalt) følger framgangen din.
  Obskure verk gir mer uttelling enn de aller mest kjente.
- **Repetisjon:** verk du bommer på dukker opp igjen.
- **Galleri:** bla og søk i hele biblioteket.

## Datagrunnlag

`public/books.json` inneholder **~880 verk av 110 forfattere** — minst ett verk
fra hver av de 100 mest innflytelsesrike norske forfatterne (se
[`docs/norwegian_authors_100.md`](docs/norwegian_authors_100.md)).

Datasettet bygges i to lag av `scripts/build-books.mjs`:

1. **Kuratert kjerne (216 verk):** håndskrevet med korrekt tittel, år, sjanger,
   epoke, temaer og en omtale — kanonen, med dyp katalog for de store.
2. **Wikidata-utvidelse (~670 verk):** hele bibliografien per forfatter hentes
   fra Wikidata på *verk*-nivå. Vi godtar ufullstendige data: et verk uten år
   eller sjanger spilles bare ikke i de modusene som trenger det feltet.

Mange samtids-/mindre forfattere har tynn dekning i Wikidata, så ikke alle når
10 verk. Bibliotek-API-er (nb.no m.fl.) ble vurdert, men returnerer utgaver +
sekundærlitteratur og er for støyete til verksnivå.

**Forfatterportretter** hentes også fra Wikidata (98/110 forfattere — resten
mangler fritt lisensiert bilde), brukt til «Hvem er forfatteren?»-modusen og
gjenkjenning i fasit og galleri.

```bash
npm run images   # forfatterportretter → public/author-images.json
npm run works    # full bibliografi per forfatter → public/wikidata-works.json
npm run data     # bygger public/books.json (kuratert + Wikidata + portretter)
```

Fant du en feil? Trykk flagg-ikonet på et verk — det kopieres til utklippstavlen
og legges i en lokal kø du kan lime inn igjen.

## Utvikling

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # statisk produksjonsbygg
```

Stack: Next.js (App Router) · React 19 · TypeScript · Tailwind CSS ·
lucide-react. Ingen backend — alt er statisk, og brukerdata ligger i
`localStorage`. Klar for deploy på Vercel.

## Arkitektur

```
src/
  app/
    layout.tsx          # rot, metadata
    globals.css         # designsystemet (glass/pill/frost)
    page.tsx            # quiz-ruten — eier utvalg/modus
    galleri/page.tsx    # søkbart galleri med detaljmodal
  components/
    Quiz.tsx            # spillet: reducer-tilstandsmaskin, fasitpanel, rekker
    EloBadge.tsx        # rating-pill + historikk-sparkline
    CategoryPicker.tsx / ModePicker.tsx
    ReportsModal.tsx / Celebration.tsx
  lib/
    books.ts            # typer, kategorier, modi, seedet RNG, valg-bygger
    useBooks.ts         # henter + cacher datasettet
    elo.ts              # Elo-matematikk + localStorage
    reports.ts          # "meld feil"-kø
scripts/
  build-books.mjs       # datapipeline → public/books.json
```
