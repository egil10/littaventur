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
- **Spillmodus:** Hvem skrev den? · Hvilket tiår? · Hvilken sjanger? · Hvilken
  epoke? · Hvilket verk? (gjett tittelen ut fra omtalen)
- **Utvalg:** spill på hele biblioteket, de mest kjente, en epoke, en sjanger
  eller et tema.
- **Rating:** en personlig Elo-rating (lagret lokalt) følger framgangen din.
  Obskure verk gir mer uttelling enn de aller mest kjente.
- **Repetisjon:** verk du bommer på dukker opp igjen.
- **Galleri:** bla og søk i hele biblioteket.

## Datagrunnlag

`public/books.json` inneholder **160 verk av 110 forfattere** — minst ett verk
fra hver av de 100 mest innflytelsesrike norske forfatterne (se
[`docs/norwegian_authors_100.md`](docs/norwegian_authors_100.md)). Hvert verk har
tittel, forfatter, år, sjanger, epoke, temaer og en kort omtale.

Datasettet bygges fra en kuratert kilde i `scripts/build-books.mjs`:

```bash
npm run data     # regenererer public/books.json
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
