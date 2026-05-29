// Data pipeline for Littåventyr — the Norwegian-literature quiz.
//
// Mirrors the BLUEPRINT's `scripts/fetch-*.mjs` step: instead of querying
// Wikidata SPARQL, this file *is* the curated source of truth — a hand-checked
// list of notable Norwegian works ordered roughly by fame (most famous first).
// We then derive a stable id, a `fame` rank, and category tags, and write
// `public/books.json` (the flat Item[] the app loads).
//
// Run: `npm run data`
//
// Each raw entry: { title, author, year, genre, era, themes[], blurb, orig? }
//   genre  — Roman | Drama | Lyrikk | Noveller | Barnebok | Sakprosa | Eventyr | Krim
//   era    — saga | 1700 | 1800 | 1900 | etterkrig | samtid
//   orig   — English title where there's a well-known one (shown in reveal)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {{title:string,author:string,year:number|null,genre:string,era:string,themes:string[],blurb:string,orig?:string}[]} */
const BOOKS = [
  // ── Henrik Ibsen — verdensdramatikeren ───────────────────────────────────
  { title: "Et dukkehjem", author: "Henrik Ibsen", year: 1879, genre: "Drama", era: "1800", themes: ["kvinnesak", "ekteskap", "frigjøring"], orig: "A Doll's House", blurb: "Nora forlater mann og barn for å finne seg selv — sluttscenens dørsmell rystet hele Europa og gjorde stykket til et samlingspunkt for kvinnesaken." },
  { title: "Peer Gynt", author: "Henrik Ibsen", year: 1867, genre: "Drama", era: "1800", themes: ["identitet", "fantasi", "selvbedrag"], blurb: "Et dramatisk dikt om den skrytende drømmeren Peer, fra norsk fjellbygd via Marokko til hjemkomsten hos Solveig. Grieg skrev musikken; trollkongen og Bøygen ble myte." },
  { title: "Hedda Gabler", author: "Henrik Ibsen", year: 1890, genre: "Drama", era: "1800", themes: ["kvinnesak", "makt", "kjedsomhet"], blurb: "Generalens datter, fanget i et kjedelig ekteskap, manipulerer dem rundt seg mot en tragisk slutt. En av teaterhistoriens mest spilte kvinneroller." },
  { title: "Vildanden", author: "Henrik Ibsen", year: 1884, genre: "Drama", era: "1800", themes: ["livsløgn", "sannhet", "familie"], orig: "The Wild Duck", blurb: "Idealisten Gregers river ned naboens livsløgner — med katastrofale følger. Her formulerer Ibsen tanken om at folk trenger illusjonene sine for å leve." },
  { title: "Gengangere", author: "Henrik Ibsen", year: 1881, genre: "Drama", era: "1800", themes: ["arv", "moral", "sykdom"], orig: "Ghosts", blurb: "Fru Alving konfronteres med arven etter sin utsvevende mann mens sønnen rammes av syfilis. Skandaløst i samtiden for sin tabuberøring av sykdom og hykleri." },
  { title: "En folkefiende", author: "Henrik Ibsen", year: 1882, genre: "Drama", era: "1800", themes: ["sannhet", "demokrati", "individ"], orig: "An Enemy of the People", blurb: "Doktor Stockmann avdekker at byens kurbad er forgiftet, men blir uglesett da sannheten truer økonomien. «Den sterkeste mann i verden, det er han som står mest alene.»" },
  { title: "Brand", author: "Henrik Ibsen", year: 1866, genre: "Drama", era: "1800", themes: ["religion", "vilje", "offer"], blurb: "Den kompromissløse presten Brand krever «alt eller intet» av seg selv og andre. Dramatisk dikt som ga Ibsen sitt gjennombrudd og kravet «Vær den du er, fullt og helt.»" },
  { title: "Rosmersholm", author: "Henrik Ibsen", year: 1886, genre: "Drama", era: "1800", themes: ["skyld", "frigjøring", "død"], blurb: "Den frittenkende Rebekka West og den tvilende godseier Rosmer trekkes mot møllefossen i et psykologisk drama Freud selv analyserte." },
  { title: "Samfundets støtter", author: "Henrik Ibsen", year: 1877, genre: "Drama", era: "1800", themes: ["hykleri", "samfunn", "sannhet"], orig: "Pillars of Society", blurb: "Konsul Bernick bygger sin anseelse på løgn og svik. Det første av Ibsens store samtidsdramaer om dobbeltmoralen i borgerskapet." },
  { title: "Fruen fra havet", author: "Henrik Ibsen", year: 1888, genre: "Drama", era: "1800", themes: ["frihet", "lengsel", "ekteskap"], orig: "The Lady from the Sea", blurb: "Ellida dras mellom trygg ektemann og en gåtefull sjømann fra fortiden — fri først når hun får velge i full frihet og under ansvar." },

  // ── Knut Hamsun — modernismens pioner (Nobel 1920) ───────────────────────
  { title: "Sult", author: "Knut Hamsun", year: 1890, genre: "Roman", era: "1800", themes: ["fattigdom", "psykologi", "Kristiania"], orig: "Hunger", blurb: "En navnløs ung forfatter sulter seg gjennom Kristiania mens sinnet glir mot vanvidd. Banebrytende for sin indre monolog — en grunnstein i moderne litteratur." },
  { title: "Markens grøde", author: "Knut Hamsun", year: 1917, genre: "Roman", era: "1900", themes: ["natur", "nybygger", "jordbruk"], orig: "Growth of the Soil", blurb: "Nybyggeren Isak rydder gård i ødemarka og bygger et liv av jorda. Verket som ga Hamsun Nobelprisen i 1920 — en hyllest til det enkle bondelivet." },
  { title: "Pan", author: "Knut Hamsun", year: 1894, genre: "Roman", era: "1800", themes: ["natur", "kjærlighet", "lengsel"], blurb: "Løytnant Glahn lever ett med naturen i Nordland og forelsker seg ulykkelig i Edvarda. Lyrisk og rusende om mennesket, drift og den nordnorske sommernatten." },
  { title: "Victoria", author: "Knut Hamsun", year: 1898, genre: "Roman", era: "1800", themes: ["kjærlighet", "klasse", "lengsel"], blurb: "Møllersønnen Johannes og slottsfrøkenen Victoria elsker hverandre på tvers av stand, men finner aldri sammen. En av norsk litteraturs ømmeste kjærlighetshistorier." },
  { title: "Mysterier", author: "Knut Hamsun", year: 1892, genre: "Roman", era: "1800", themes: ["psykologi", "fremmedhet", "småby"], blurb: "Den gåtefulle Johan Nagel dukker opp i en småby i gul dress og snur opp ned på alt. Et urolig portrett av et splittet og uberegnelig sinn." },
  { title: "Landstrykere", author: "Knut Hamsun", year: 1927, genre: "Roman", era: "1900", themes: ["vandring", "Nordland", "lengsel"], blurb: "Første bok om vandreren August, eventyreren og skrytehalsen som drar gjennom nordnorske bygder med store planer. Folkelig og humoristisk." },
  { title: "På gjengrodde stier", author: "Knut Hamsun", year: 1949, genre: "Roman", era: "etterkrig", themes: ["alderdom", "rettssak", "forsvar"], blurb: "Hamsuns siste bok, skrevet under landssvikforhørene etter krigen. Et stolt, selvironisk selvforsvar fra den aldrende, landsforræteranklagde dikteren." },

  // ── Sigrid Undset — middelalderens stemme (Nobel 1928) ───────────────────
  { title: "Kristin Lavransdatter", author: "Sigrid Undset", year: 1920, genre: "Roman", era: "1900", themes: ["middelalder", "kjærlighet", "religion"], blurb: "Trilogien (Kransen, Husfrue, Korset) følger Kristin gjennom lidenskap, ekteskap og bot i 1300-tallets Norge. Verket bak Nobelprisen 1928 og en folkekjær klassiker." },
  { title: "Olav Audunssøn", author: "Sigrid Undset", year: 1925, genre: "Roman", era: "1900", themes: ["middelalder", "skyld", "religion"], orig: "The Master of Hestviken", blurb: "Et bredt middelalderepos om Olav og Ingunn, om hemmelig skyld og soning. Undsets andre store historiske romanverk etter Kristin." },
  { title: "Jenny", author: "Sigrid Undset", year: 1911, genre: "Roman", era: "1900", themes: ["kunst", "kvinneliv", "kjærlighet"], blurb: "Malerinnen Jenny i Roma strever mellom kunstnerkall og lengselen etter kjærlighet og barn. En moderne, kompromissløs samtidsroman om kvinnens valg." },
  { title: "Fru Marta Oulie", author: "Sigrid Undset", year: 1907, genre: "Roman", era: "1900", themes: ["utroskap", "ekteskap", "skyld"], blurb: "«Jeg har vært min mann utro» — Undsets debut åpner med en av litteraturens mest berømte førstesetninger, en utro kvinnes dagbok." },

  // ── Bjørnstjerne Bjørnson — nasjonaldikteren (Nobel 1903) ─────────────────
  { title: "Synnøve Solbakken", author: "Bjørnstjerne Bjørnson", year: 1857, genre: "Roman", era: "1800", themes: ["bygd", "kjærlighet", "religion"], blurb: "Bjørnsons gjennombrudd og den første store bondefortellingen: kjærligheten mellom fromme Synnøve og villstyringen Torbjørn. Grunnla en hel sjanger." },
  { title: "En glad gut", author: "Bjørnstjerne Bjørnson", year: 1860, genre: "Roman", era: "1800", themes: ["bygd", "oppvekst", "klasse"], orig: "A Happy Boy", blurb: "Gjeterguttens Øyvinds vei fra fattigdom til skole og kjærligheten til Marit. En lys, optimistisk bondefortelling i nasjonalromantikkens ånd." },
  { title: "Ja, vi elsker dette landet", author: "Bjørnstjerne Bjørnson", year: 1859, genre: "Lyrikk", era: "1800", themes: ["fedreland", "nasjon", "hymne"], blurb: "Diktet som ble Norges nasjonalsang, tonesatt av fetteren Rikard Nordraak. Skrevet i nasjonsbyggingens tiår." },

  // ── Det moderne gjennombruddet — realisme & samfunnskritikk ───────────────
  { title: "Amtmandens Døtre", author: "Camilla Collett", year: 1854, genre: "Roman", era: "1800", themes: ["kvinnesak", "kjærlighet", "samfunn"], orig: "The District Governor's Daughters", blurb: "Norges første tendensroman og et tidlig feministisk verk: et flammende oppgjør med tidens fornuftsekteskap og kvinnens manglende valgfrihet." },
  { title: "Garman & Worse", author: "Alexander Kielland", year: 1880, genre: "Roman", era: "1800", themes: ["klasse", "samfunn", "kystby"], blurb: "Kiellands debut tegner et bredt, ironisk bilde av handelsborgerskapet i en sørlandsk kystby. Elegant samfunnssatire fra det moderne gjennombruddet." },
  { title: "Gift", author: "Alexander Kielland", year: 1883, genre: "Roman", era: "1800", themes: ["skole", "hykleri", "religion"], orig: "Poison", blurb: "Et bitende oppgjør med latinskolen og pugget av døde språk. «Gift» rammer den livsfjerne dannelsen som forgifter de unge." },
  { title: "Skipper Worse", author: "Alexander Kielland", year: 1882, genre: "Roman", era: "1800", themes: ["religion", "vekkelse", "handel"], blurb: "Den haugianske lekmannsbevegelsens inntog i Stavanger-borgerskapet, sett gjennom den godslige skipperen. Kiellands varmeste roman." },
  { title: "Hellemyrsfolket", author: "Amalie Skram", year: 1887, genre: "Roman", era: "1800", themes: ["arv", "fattigdom", "alkohol"], blurb: "Naturalismens hovedverk i Norge: et firebindsepos om en slekt som synker gjennom generasjoner av fattigdom og fyll i Bergen. Nådeløst og medfølende." },
  { title: "Constance Ring", author: "Amalie Skram", year: 1885, genre: "Roman", era: "1800", themes: ["ekteskap", "kvinnesak", "moral"], blurb: "En kvinnes desillusjon i et ekteskap bygget på dobbeltmoral. Skrams debut og et sentralt innlegg i sedelighetsdebatten." },
  { title: "Familien paa Gilje", author: "Jonas Lie", year: 1883, genre: "Roman", era: "1800", themes: ["familie", "kvinnesak", "embetsmann"], orig: "The Family at Gilje", blurb: "Et embetsmannshjem på 1840-tallet der døtrene giftes bort av økonomisk nødvendighet. Lies fineste skildring av kvinnens trange kår." },
  { title: "Bondestudentar", author: "Arne Garborg", year: 1883, genre: "Roman", era: "1800", themes: ["klasse", "oppvekst", "språk"], orig: "Peasant Students", blurb: "Daniel Braut strever seg opp fra bygda til byen og fornekter sin egen bakgrunn. En knusende skildring av streberen, skrevet på landsmål." },
  { title: "Haugtussa", author: "Arne Garborg", year: 1895, genre: "Lyrikk", era: "1800", themes: ["natur", "folketro", "kjærlighet"], blurb: "En diktsyklus på nynorsk om gjeterjenta Veslemøy som ser inn i de underjordiskes verden. Grieg tonesatte flere av diktene." },

  // ── Tidlig lyrikk & nasjonsbygging ───────────────────────────────────────
  { title: "Jeg ser", author: "Sigbjørn Obstfelder", year: 1893, genre: "Lyrikk", era: "1800", themes: ["fremmedhet", "modernisme", "eksistens"], blurb: "«Jeg er vist kommet paa en feil klode!» — det mest siterte enkeltdiktet i norsk modernisme, en fremmedgjort betraktning av en underlig verden." },
  { title: "Digte", author: "Henrik Wergeland", year: 1829, genre: "Lyrikk", era: "1800", themes: ["frihet", "natur", "kjærlighet"], blurb: "Wergelands første samling, full av ungdommelig livskraft. Selve symbolet på 17. mai-ånden og kampen for det frie Norge." },
  { title: "Ferdaminni fraa Sumaren 1860", author: "Aasmund Olavsson Vinje", year: 1861, genre: "Sakprosa", era: "1800", themes: ["reise", "natur", "språk"], blurb: "En reiseskildring fra Kristiania til Trondheim, skrevet på et nyskapende landsmål. Inneholder det udødelige diktet «Ved Rondane»." },

  // ── Mellomkrigstidens store fortellere ───────────────────────────────────
  { title: "En flyktning krysser sitt spor", author: "Aksel Sandemose", year: 1933, genre: "Roman", era: "1900", themes: ["jante", "skyld", "oppvekst"], orig: "A Fugitive Crosses His Tracks", blurb: "Romanen som ga oss Janteloven: «Du skal ikke tro at du er noe.» Espen Arnakkes oppgjør med småbyens kvelende sosiale kontroll." },
  { title: "Alberte og Jakob", author: "Cora Sandel", year: 1926, genre: "Roman", era: "1900", themes: ["kvinneliv", "kunst", "frigjøring"], blurb: "Første bind av Alberte-trilogien: en sky ung kvinne kveles av kulde og konvensjoner i en nordnorsk småby og drømmer om et friere liv." },
  { title: "Juvikfolke", author: "Olav Duun", year: 1918, genre: "Roman", era: "1900", themes: ["slekt", "natur", "moral"], orig: "The People of Juvik", blurb: "Et seksbinds slektsepos på nynorsk om en trøndersk kystslekts vei fra hedensk villskap til moralsk modning. Duuns hovedverk." },
  { title: "Den fjerde nattevakt", author: "Johan Falkberget", year: 1923, genre: "Roman", era: "1900", themes: ["gruvedrift", "kjærlighet", "skyld"], orig: "The Fourth Night Watch", blurb: "Presten Benjamin Sigismund og hans forbudte kjærlighet i bergstaden Røros på 1800-tallet. Falkbergets mest leste roman fra kobberverkets verden." },
  { title: "Dansen gjennom skuggeheimen", author: "Kristofer Uppdal", year: 1911, genre: "Roman", era: "1900", themes: ["arbeider", "rallar", "klassekamp"], blurb: "Uppdals tibinds romanverk skildrer rallarenes og anleggsarbeidernes liv — den norske arbeiderklassens store epos, skrevet på nynorsk." },
  { title: "Møte ved milepelen", author: "Sigurd Hoel", year: 1947, genre: "Roman", era: "etterkrig", themes: ["krig", "svik", "ansvar"], orig: "Meeting at the Milestone", blurb: "En motstandsmann spør hvorfor noen ble nazister — og finner svaret farlig nær seg selv. Et av de skarpeste oppgjørene med okkupasjonen." },

  // ── Lyrikkens modernister ────────────────────────────────────────────────
  { title: "Du må ikke sove", author: "Arnulf Øverland", year: 1937, genre: "Lyrikk", era: "1900", themes: ["krig", "ansvar", "advarsel"], blurb: "«Du må ikke tåle så inderlig vel den urett som ikke rammer dig selv!» — det mektige varselsdiktet mot nazismen, lest opp igjen og igjen." },
  { title: "Til ungdommen", author: "Nordahl Grieg", year: 1936, genre: "Lyrikk", era: "1900", themes: ["fred", "ansvar", "ungdom"], blurb: "«Kringsatt av fiender, gå inn i din tid» — Griegs appell om fred og menneskeverd, tonesatt av Otto Mortensen og sunget etter 22. juli 2011." },
  { title: "Jord og jern", author: "Rolf Jacobsen", year: 1933, genre: "Lyrikk", era: "1900", themes: ["modernitet", "teknologi", "natur"], blurb: "Debutsamlingen som først brakte storbyens maskiner, kraner og telefonstolper inn i norsk poesi. Jacobsen ble vår fremste modernistiske lyriker." },
  { title: "Dropar i austavind", author: "Olav H. Hauge", year: 1966, genre: "Lyrikk", era: "etterkrig", themes: ["natur", "hverdag", "ettertanke"], blurb: "Fra fruktbonden og dikteren i Ulvik: knappe, klare dikt om epletre, vær og det å leve. Her står «Det er den draumen» som folket kåret til tidenes dikt." },
  { title: "Aust-Vågøy", author: "Inger Hagerup", year: 1941, genre: "Lyrikk", era: "1900", themes: ["krig", "motstand", "sorg"], blurb: "«Mars 1941» — Hagerups gripende dikt om tyskernes herjinger i Lofoten ble et illegalt samlingsmerke under okkupasjonen." },

  // ── Etterkrigstidens prosa og skandaler ──────────────────────────────────
  { title: "Sangen om den røde rubin", author: "Agnar Mykle", year: 1956, genre: "Roman", era: "etterkrig", themes: ["seksualitet", "ungdom", "frihet"], blurb: "Ask Burlefots erotiske dannelsesreise utløste Norges mest berømte sedelighetssak — boka ble beslaglagt, og Mykle frikjent i Høyesterett i 1958." },
  { title: "Lasso rundt fru Luna", author: "Agnar Mykle", year: 1954, genre: "Roman", era: "etterkrig", themes: ["oppvekst", "klasse", "drøm"], blurb: "Ask Burlefots oppvekst og veien mot voksenlivet, full av lengsel og opprør. Forløperen til den langt mer beryktede «Rubin»." },
  { title: "Bestialitetens historie", author: "Jens Bjørneboe", year: 1966, genre: "Roman", era: "etterkrig", themes: ["ondskap", "historie", "vold"], blurb: "Første bind av en trilogi som gransker menneskets grusomhet gjennom historien — fra heksebrenning til Auschwitz. Bjørneboes rasende moralfilosofi." },
  { title: "Jonas", author: "Jens Bjørneboe", year: 1955, genre: "Roman", era: "etterkrig", themes: ["skole", "barn", "system"], blurb: "Et oppgjør med en autoritær og knugende skole som svikter de ordblinde og annerledes barna. Boka satte fart i etterkrigstidens skoledebatt." },
  { title: "Thomas F's siste nedtegnelser til almenheten", author: "Kjell Askildsen", year: 1983, genre: "Noveller", era: "samtid", themes: ["alderdom", "ensomhet", "død"], blurb: "Den gamle, bitre Thomas F. betrakter livet med iskald presisjon. Askildsen er Norges store novellist — minimalistisk, tørrvittig og avkledd." },

  // ── Dag Solstad — etterkrigstidens romankunstner ─────────────────────────
  { title: "Genanse og verdighet", author: "Dag Solstad", year: 1994, genre: "Roman", era: "samtid", themes: ["nederlag", "intellektuell", "Oslo"], blurb: "Lektor Elias Rukla får et sammenbrudd over en ødelagt paraply utenfor skolen. Solstads finslipte studie av en manns stille fallitt." },
  { title: "Gymnaslærer Pedersens beretning", author: "Dag Solstad", year: 1982, genre: "Roman", era: "samtid", themes: ["politikk", "AKP", "idealisme"], blurb: "En ironisk og selvransakende beretning om m-l-bevegelsens glødende år sett fra innsiden. Solstads oppgjør med sin egen radikale fortid." },
  { title: "Roman 1987", author: "Dag Solstad", year: 1987, genre: "Roman", era: "samtid", themes: ["politikk", "idealisme", "tilbakeblikk"], blurb: "Fjord ser tilbake på sitt liv som revolusjonær i en roman om håp og desillusjon. Et hovedverk i Solstads forfatterskap." },

  // ── Tarjei Vesaas — nynorsk mester ───────────────────────────────────────
  { title: "Is-slottet", author: "Tarjei Vesaas", year: 1963, genre: "Roman", era: "etterkrig", themes: ["vennskap", "død", "natur"], orig: "The Ice Palace", blurb: "To jenter knytter et skjørt vennskap før den ene forsvinner i den frosne fossen. Vesaas' mest elskede roman, vinner av Nordisk råds litteraturpris." },
  { title: "Fuglane", author: "Tarjei Vesaas", year: 1957, genre: "Roman", era: "etterkrig", themes: ["utenforskap", "natur", "søsken"], orig: "The Birds", blurb: "Den enkle Mattis tyder fugletegn og naturens språk mens søsteren lengter etter et eget liv. En øm roman om den som ikke passer inn." },
  { title: "Kimen", author: "Tarjei Vesaas", year: 1940, genre: "Roman", era: "1900", themes: ["vold", "skyld", "fellesskap"], orig: "The Seed", blurb: "Et drap utløser flokkens blinde hevn på en liten øy. En tett allegori om vold og forsoning, skrevet i krigens skygge." },

  // ── Jon Fosse — Nobel 2023 ───────────────────────────────────────────────
  { title: "Morgon og kveld", author: "Jon Fosse", year: 2000, genre: "Roman", era: "samtid", themes: ["fødsel", "død", "liv"], orig: "Morning and Evening", blurb: "Fiskeren Johannes' første dag i livet og hans siste, fortalt i Fosses hypnotiske, repeterende prosa. En vakker meditasjon over en hel menneskealder." },
  { title: "Det er Ales", author: "Jon Fosse", year: 2004, genre: "Roman", era: "samtid", themes: ["sorg", "minne", "fjord"], blurb: "Signe ser tilbake på mannen som forsvant på fjorden, mens generasjoner glir over i hverandre. Konsentrert sorgmusikk i prosaform." },
  { title: "Det andre namnet", author: "Jon Fosse", year: 2019, genre: "Roman", era: "samtid", themes: ["kunst", "tro", "dobbeltgjenger"], orig: "The Other Name", blurb: "Åpningen på «Septologien» — maleren Asle og hans navnebror, skrevet som én eneste flytende setning. Hovedverket bak Nobelprisen 2023." },
  { title: "Nokon kjem til å komme", author: "Jon Fosse", year: 1996, genre: "Drama", era: "samtid", themes: ["sjalusi", "ensomhet", "angst"], orig: "Someone Is Going to Come", blurb: "Et par flykter til et øde hus ved havet for å være alene, men frykten for en fremmed tærer på dem. Fosses gjennombrudd som dramatiker." },

  // ── Karl Ove Knausgård — Min kamp-fenomenet ──────────────────────────────
  { title: "Min kamp", author: "Karl Ove Knausgård", year: 2009, genre: "Roman", era: "samtid", themes: ["selvbiografi", "far", "hverdag"], orig: "My Struggle", blurb: "Det 3500 sider lange selvbiografiske romanverket i seks bind som rystet norsk offentlighet og gjorde Knausgård til verdensnavn. Bind 1 åpner ved farens død." },
  { title: "Ute av verden", author: "Karl Ove Knausgård", year: 1998, genre: "Roman", era: "samtid", themes: ["forelskelse", "tabu", "skyld"], blurb: "Debuten om en ung lærer som forelsker seg i en 13-årig elev. Knausgård ble første debutant til å vinne Kritikerprisen." },
  { title: "Om hausten", author: "Karl Ove Knausgård", year: 2015, genre: "Roman", era: "samtid", themes: ["natur", "ting", "far"], orig: "Autumn", blurb: "Korte betraktninger om alt fra epler til veps, skrevet som brev til et ufødt barn. Første bok i årstidskvartetten." },

  // ── Per Petterson & samtidsromanen ───────────────────────────────────────
  { title: "Ut og stjæle hester", author: "Per Petterson", year: 2003, genre: "Roman", era: "samtid", themes: ["far", "minne", "krig"], orig: "Out Stealing Horses", blurb: "En aldrende mann i ensomhet ved en innsjø graver i en skjebnesvanger sommer i ungdommen. Internasjonal suksess, oversatt til femti språk." },
  { title: "Jeg forbanner tidens elv", author: "Per Petterson", year: 2008, genre: "Roman", era: "samtid", themes: ["mor", "kommunisme", "samliv"], blurb: "En mann i krise reiser etter sin døende mor til Danmark mens ekteskapet rakner og idealene falmer. Vinner av Nordisk råds litteraturpris." },

  // ── Herbjørg Wassmo — nordnorsk storfortelling ───────────────────────────
  { title: "Dinas bok", author: "Herbjørg Wassmo", year: 1989, genre: "Roman", era: "samtid", themes: ["skyld", "kvinne", "Nordland"], orig: "Dina's Book", blurb: "Den vilskremte og mektige Dina styrer gård og handelssted på 1800-tallet, tynget av en barndomsskyld. Wassmos internasjonale gjennombrudd." },
  { title: "Huset med den blinde glassveranda", author: "Herbjørg Wassmo", year: 1981, genre: "Roman", era: "samtid", themes: ["oppvekst", "overgrep", "krig"], orig: "The House with the Blind Glass Windows", blurb: "Tora vokser opp som «tyskerunge» i et nordnorsk fiskevær, mishandlet hjemme. Første bind av den sterke Tora-trilogien." },
  { title: "Hundreårshistorien", author: "Herbjørg Wassmo", year: 2009, genre: "Roman", era: "samtid", themes: ["slekt", "kvinne", "historie"], blurb: "Wassmos episke slektsroman som følger kvinnene i hennes egen familie over hundre år i Nord-Norge." },

  // ── Lars Saabye Christensen — Oslo-fortelleren ───────────────────────────
  { title: "Halvbroren", author: "Lars Saabye Christensen", year: 2001, genre: "Roman", era: "samtid", themes: ["familie", "Oslo", "etterkrig"], orig: "The Half Brother", blurb: "Et bredt familieepos over fire generasjoner i Oslo, fortalt av den lille Barnum. Vinner av Nordisk råds litteraturpris og en moderne klassiker." },
  { title: "Beatles", author: "Lars Saabye Christensen", year: 1984, genre: "Roman", era: "samtid", themes: ["ungdom", "vennskap", "60-tallet"], blurb: "Fire Oslo-gutter som kaller seg John, Paul, George og Ringo vokser opp på 60-tallet. En av Norges mest leste og elskede ungdomsromaner." },
  { title: "Herman", author: "Lars Saabye Christensen", year: 1988, genre: "Roman", era: "samtid", themes: ["barn", "sykdom", "mot"], blurb: "Elleve år gamle Herman mister håret og må finne mot i en verden som plutselig ser annerledes på ham. Hjertevarm og sårt morsom." },

  // ── Roy Jacobsen — Barrøy og krigen ──────────────────────────────────────
  { title: "De usynlige", author: "Roy Jacobsen", year: 2013, genre: "Roman", era: "samtid", themes: ["øyliv", "natur", "familie"], orig: "The Unseen", blurb: "Livet til familien Barrøy på en knøttliten nordnorsk øy tidlig på 1900-tallet. Nominert til den internasjonale Booker-prisen, første bok i Barrøy-serien." },
  { title: "Vidunderbarn", author: "Roy Jacobsen", year: 2009, genre: "Roman", era: "samtid", themes: ["oppvekst", "Oslo", "60-tallet"], blurb: "En gutt og hans mor på Årvoll i 1960-årene får livet snudd da en halvsøster flytter inn. Stillferdig og presis oppvekstskildring." },

  // ── Erlend Loe — naivismen ───────────────────────────────────────────────
  { title: "Naiv. Super.", author: "Erlend Loe", year: 1996, genre: "Roman", era: "samtid", themes: ["livskrise", "naivisme", "mening"], blurb: "En ung mann mister meningen med alt og begynner å kaste ball og lage lister. Naivismens norske hovedverk — lavmælt morsom og uventet dyp." },
  { title: "Doppler", author: "Erlend Loe", year: 2004, genre: "Roman", era: "samtid", themes: ["sivilisasjonskritikk", "natur", "satire"], blurb: "En mann forlater familie og samfunn for å bo i skogen med en elgkalv ved navn Bongo. Frisk satire over det vellykkede norske livet." },

  // ── Vigdis Hjorth & Hanne Ørstavik — den indre romanen ───────────────────
  { title: "Arv og miljø", author: "Vigdis Hjorth", year: 2016, genre: "Roman", era: "samtid", themes: ["overgrep", "familie", "arv"], orig: "Will and Testament", blurb: "En arvestrid blottlegger et knust familieforhold og fortrengte overgrep. Utløste en heftig «virkelighetslitteratur»-debatt om grensen mot eget liv." },
  { title: "Kjærlighet", author: "Hanne Ørstavik", year: 1997, genre: "Roman", era: "samtid", themes: ["mor og sønn", "ensomhet", "natur"], orig: "Love", blurb: "En mor og sønn i en vinternatt nordpå, så nær hverandre og likevel fatalt fjerne. Kåret til en av de beste norske bøkene de siste 25 år." },

  // ── Kjartan Fløgstad & Kjell Askildsen-generasjonen ──────────────────────
  { title: "Dalen Portland", author: "Kjartan Fløgstad", year: 1977, genre: "Roman", era: "samtid", themes: ["industri", "klasse", "språk"], blurb: "Industristedets framvekst og fall, fortalt med fabulerende språkglede og folkelig kraft. Vinner av Nordisk råds litteraturpris." },
  { title: "Grand Manila", author: "Kjartan Fløgstad", year: 2006, genre: "Roman", era: "samtid", themes: ["industri", "historie", "arbeider"], blurb: "Et bredt anlagt portrett av en industribygd og dens mennesker gjennom et helt århundre. Fløgstads myldrende historieroman." },

  // ── Jan Kjærstad — den store fortellingen ────────────────────────────────
  { title: "Forføreren", author: "Jan Kjærstad", year: 1993, genre: "Roman", era: "samtid", themes: ["identitet", "TV", "fortelling"], orig: "The Seducer", blurb: "Første bind om TV-mannen Jonas Wergeland, fortalt i sprakende, ikke-kronologiske glimt. Wergeland-trilogien er et høydepunkt i 90-tallsromanen." },
  { title: "Erobreren", author: "Jan Kjærstad", year: 1996, genre: "Roman", era: "samtid", themes: ["identitet", "skyld", "fortelling"], orig: "The Conqueror", blurb: "Samme liv som i «Forføreren», men nå i et mørkere lys: var Jonas Wergeland en morder? Kjærstads lek med sannhet og perspektiv." },

  // ── Krim — Norges store eksportvare ──────────────────────────────────────
  { title: "Snømannen", author: "Jo Nesbø", year: 2007, genre: "Krim", era: "samtid", themes: ["seriemorder", "Oslo", "Harry Hole"], orig: "The Snowman", blurb: "Etterforsker Harry Hole jakter en seriemorder som etterlater snømenn ved åstedene. Den mest kjente boka i Norges bestselgende krimserie." },
  { title: "Rødstrupe", author: "Jo Nesbø", year: 2000, genre: "Krim", era: "samtid", themes: ["krig", "landssvik", "Harry Hole"], orig: "The Redbreast", blurb: "Harry Hole nøster opp en sak med røtter i norske frontkjempere på østfronten. Ofte regnet som det beste i Hole-serien." },
  { title: "Flaggermusmannen", author: "Jo Nesbø", year: 1997, genre: "Krim", era: "samtid", themes: ["Harry Hole", "Australia", "debut"], orig: "The Bat", blurb: "Harry Hole sendes til Sydney for å løse drapet på en norsk kvinne. Nesbøs debut og starten på det internasjonale krimeventyret." },
  { title: "Se deg ikke tilbake", author: "Karin Fossum", year: 1996, genre: "Krim", era: "samtid", themes: ["bygd", "Sejer", "psykologi"], orig: "Don't Look Back", blurb: "Etterforsker Konrad Sejer gransker drapet på en ung jente i et lite bygdesamfunn. Fossum, «den norske krimdronningen», dyrker det psykologiske." },
  { title: "Din til døden", author: "Anne Holt", year: 1998, genre: "Krim", era: "samtid", themes: ["Oslo", "politi", "Hanne Wilhelmsen"], blurb: "Politietterforsker Hanne Wilhelmsen i en innfløkt drapssak. Holt, tidligere justisminister, er en av pionerene i moderne norsk krim." },
  { title: "Begravde hunder biter ikke", author: "Gunnar Staalesen", year: 1993, genre: "Krim", era: "samtid", themes: ["Bergen", "privatdetektiv", "Varg Veum"], blurb: "Privatetterforskeren Varg Veum løser saker i regntunge Bergen. Staalesens Veum er den norske hardkokte krimmens nestor." },

  // ── Samtidens kvinnestemmer ──────────────────────────────────────────────
  { title: "Bienes historie", author: "Maja Lunde", year: 2015, genre: "Roman", era: "samtid", themes: ["klima", "natur", "fremtid"], orig: "The History of Bees", blurb: "Tre tidsplan — fortid, nåtid og en biløs fremtid — vevd sammen om menneskets forhold til biene. Klimaromanen ble en internasjonal bestselger." },
  { title: "Dager i stillhetens historie", author: "Merethe Lindstrøm", year: 2011, genre: "Roman", era: "samtid", themes: ["minne", "fortielse", "ekteskap"], orig: "Days in the History of Silence", blurb: "Et eldre ektepars fortielser — om jødisk fortid og et bortadoptert barn — siger frem. Vinner av Nordisk råds litteraturpris." },
  { title: "Innsirkling", author: "Carl Frode Tiller", year: 2007, genre: "Roman", era: "samtid", themes: ["minne", "identitet", "Trøndelag"], orig: "Encircling", blurb: "David har mistet hukommelsen, og tre mennesker forteller hver sin versjon av hvem han var. En formsterk trilogi om hvor upålitelig minnet er." },
  { title: "Tante Ulrikkes vei", author: "Zeshan Shakar", year: 2017, genre: "Roman", era: "samtid", themes: ["innvandring", "klasse", "Oslo øst"], blurb: "To gutter fra Stovner-borettslaget velger ulike veier ut av drabantbyen. En frisk og viktig stemme om det flerkulturelle Norge." },

  // ── Sakprosa, dannelse og barneklassikere ────────────────────────────────
  { title: "Sofies verden", author: "Jostein Gaarder", year: 1991, genre: "Roman", era: "samtid", themes: ["filosofi", "dannelse", "ungdom"], orig: "Sophie's World", blurb: "Femten år gamle Sofie får mystiske brev som leder henne gjennom hele filosofihistorien. Tidenes mest oversatte norske bok, lest verden over." },
  { title: "Norske folkeeventyr", author: "Asbjørnsen og Moe", year: 1841, genre: "Eventyr", era: "1800", themes: ["folketro", "troll", "Askeladden"], blurb: "Samlingen som ga oss Askeladden, de tre bukkene Bruse og Soria Moria slott. Asbjørnsen og Moes innsamling formet det norske språket og selvbildet." },
  { title: "Folk og røvere i Kardemomme by", author: "Thorbjørn Egner", year: 1955, genre: "Barnebok", era: "etterkrig", themes: ["barn", "snillhet", "samfunn"], orig: "When the Robbers Came to Cardamom Town", blurb: "Den fredelige byen med Kasper, Jesper og Jonatan og «Kardemommeloven». Egners syngende univers er innprentet i hver norsk barndom." },
  { title: "Klatremus og de andre dyrene i Hakkebakkeskogen", author: "Thorbjørn Egner", year: 1953, genre: "Barnebok", era: "etterkrig", themes: ["dyr", "barn", "sang"], blurb: "Mikkel Rev, Klatremus og Bestemor Skogmus i skogen der dyrene lover å ikke spise hverandre. Egners andre store barneklassiker, full av sanger." },
  { title: "Mormor og de åtte ungene i skogen", author: "Anne-Cath. Vestly", year: 1957, genre: "Barnebok", era: "etterkrig", themes: ["familie", "barn", "hverdag"], blurb: "En storfamilie som lever enkelt og varmt i skogkanten. Vestly skrev hverdagslivet inn i barnelitteraturen og snakket rett til barna." },
  { title: "Teskjekjerringa", author: "Alf Prøysen", year: 1957, genre: "Barnebok", era: "etterkrig", themes: ["forvandling", "hverdag", "humor"], orig: "Mrs Pepperpot", blurb: "Kjerringa som plutselig krymper til størrelsen av en teskje og må klare seg likevel. Prøysens lune figur ble elsket langt utenfor Norge." },
  { title: "Vaffelhjarte", author: "Maria Parr", year: 2005, genre: "Barnebok", era: "samtid", themes: ["vennskap", "bygd", "barn"], orig: "Waffle Hearts", blurb: "Trille og Lena og deres ville påfunn i ei lita vestlandsbygd. Parr er kalt «den nye Astrid Lindgren» — varm, vill og rørende på nynorsk." },
  { title: "Trollkrittet", author: "Zinken Hopp", year: 1948, genre: "Barnebok", era: "etterkrig", themes: ["fantasi", "magi", "språk"], blurb: "Jon finner et kritt som gjør tegninger levende, blant annet den frekke Sofus. En oppfinnsom og språklekende klassiker i norsk barnelitteratur." },

  // ── Holberg & opplysningstiden (dansk-norsk arv) ─────────────────────────
  { title: "Jeppe på Bjerget", author: "Ludvig Holberg", year: 1722, genre: "Drama", era: "1700", themes: ["komedie", "klasse", "drukkenskap"], orig: "Jeppe of the Hill", blurb: "Den drukne bonden Jeppe vekkes i baronens seng og tror han er blitt herre. Holbergs udødelige komedie om makt, fyll og «hvem er egentlig herre?»." },
  { title: "Erasmus Montanus", author: "Ludvig Holberg", year: 1731, genre: "Drama", era: "1700", themes: ["komedie", "lærdom", "hovmod"], blurb: "Den hjemvendte studenten Rasmus Berg blender bygda med latin og «beviser» at mor er en sten. En skarp satire over tom lærdom og hovmod." },
  { title: "Niels Klims underjordiske reise", author: "Ludvig Holberg", year: 1741, genre: "Roman", era: "1700", themes: ["satire", "utopi", "reise"], orig: "Niels Klim's Underground Travels", blurb: "Niels Klim faller ned i jordens indre og finner samfunn som speiler vårt eget. En lærd og morsom utopisk satire, opprinnelig skrevet på latin." },
  { title: "Nordlands Trompet", author: "Petter Dass", year: 1739, genre: "Lyrikk", era: "1700", themes: ["Nordland", "natur", "topografi"], blurb: "En levende skildring på vers av Nordlands natur, folk og fiske, skrevet av presten på Alstahaug rundt 1700. Norsk barokks fremste verk." },

  // ── Flere samtidsstemmer & moderne klassikere ────────────────────────────
  { title: "Fugletribunalet", author: "Agnes Ravatn", year: 2013, genre: "Roman", era: "samtid", themes: ["skam", "isolasjon", "spenning"], orig: "The Bird Tribunal", blurb: "En vanæret tv-kvinne søker tilflukt som hushjelp hos en gåtefull mann ved fjorden. En sugende, urovekkende kammerroman på nynorsk." },
  { title: "Svøm med dem som drukner", author: "Lars Mytting", year: 2014, genre: "Roman", era: "samtid", themes: ["slekt", "krig", "mysterium"], orig: "The Sixteen Trees of the Somme", blurb: "Edvard nøster opp en familiegåte som strekker seg fra Gudbrandsdalen til slagmarkene ved Somme. En av tiårets store norske leserfavoritter." },
  { title: "Buzz Aldrin, hvor ble det av deg i alt mylderet?", author: "Johan Harstad", year: 2005, genre: "Roman", era: "samtid", themes: ["utenforskap", "Færøyene", "tilhørighet"], blurb: "En gartner som helst vil være usynlig, havner på en psykiatrisk kollektiv på Færøyene. En mild, melankolsk roman om å ville være nummer to." },
  { title: "Før jeg brenner ned", author: "Gaute Heivoll", year: 2010, genre: "Roman", era: "samtid", themes: ["pyroman", "bygd", "selvbiografi"], orig: "Before I Burn", blurb: "En pyromanbølge herjer ei sørlandsbygd samme vår som forfatteren blir født. Heivoll fletter den sanne brannhistorien sammen med sitt eget liv." },
  { title: "Leksikon om lys og mørke", author: "Simon Stranger", year: 2018, genre: "Roman", era: "samtid", themes: ["Holocaust", "minne", "ondskap"], orig: "Keep Saying Their Names", blurb: "Historien om en jødisk familie og deres bøddel, fortalt fra A til Å. En sterk roman om snublesteiner, skyld og hvordan navn holder de døde i live." },
  { title: "Elling: Brødre i blodet", author: "Ingvar Ambjørnsen", year: 1996, genre: "Roman", era: "samtid", themes: ["psykiatri", "vennskap", "Oslo"], blurb: "Den engstelige Elling og storvokste Kjell Bjarne skal mestre livet utenfor institusjonen i en Oslo-leilighet. Ble en folkekjær Oscar-nominert film." },
  { title: "Tonje Glimmerdal", author: "Maria Parr", year: 2009, genre: "Barnebok", era: "samtid", themes: ["barn", "vennskap", "natur"], blurb: "Den fartsfylte Tonje med «fart og sjølvtillit» som motto, alene-barn i ei lita fjellbygd. Parrs varme, eventyrlige andre barnebok." },
  { title: "Berlinerpoplene", author: "Anne B. Ragde", year: 2004, genre: "Roman", era: "samtid", themes: ["familie", "slekt", "hemmeligheter"], orig: "Berlin Poplars", blurb: "Tre brødre samles på slektsgården Neshov når moren ligger for døden, og familiehemmeligheter velter frem. Første bind i den enormt populære Neshov-serien." },
  { title: "Tung tids tale", author: "Olaug Nilssen", year: 2017, genre: "Roman", era: "samtid", themes: ["autisme", "morskap", "system"], blurb: "En utmattet mors kamp for sin autistiske sønn og mot et tungrodd hjelpeapparat. Rå og rørende selvbiografisk roman, vinner av Brageprisen." },
  { title: "Vente, blinke", author: "Gunnhild Øyehaug", year: 2008, genre: "Roman", era: "samtid", themes: ["tilfeldigheter", "kjærlighet", "ironi"], orig: "Wait, Blink", blurb: "Et mylder av menneskeskjebner som krysser hverandre i en lekende, essayistisk roman. Filmatisert som «Women in Oversized Men's Shirts»." },
  { title: "Solaris korrigert", author: "Øyvind Rimbereid", year: 2004, genre: "Lyrikk", era: "samtid", themes: ["fremtid", "språk", "Stavanger"], blurb: "Et langdikt fra et oljefritt Stavanger i 2480, skrevet på et oppdiktet fremtidsspråk av norsk, engelsk og skotsk. Norsk samtidslyrikks vågaleste verk." },
  { title: "Avløsning", author: "Tor Ulven", year: 1993, genre: "Roman", era: "samtid", themes: ["tid", "død", "bevissthet"], blurb: "Tette prosastykker der ulike liv og tidsplan glir over i hverandre. Ulven er kultforfatteren hvis knappe, mørke prosa stadig får nye lesere." },
  { title: "Jo fortere jeg går, jo mindre er jeg", author: "Kjersti Annesdatter Skomsvold", year: 2009, genre: "Roman", era: "samtid", themes: ["alderdom", "ensomhet", "død"], orig: "The Faster I Walk, the Smaller I Am", blurb: "Gamle Mathea Martinsen har levd et nesten usynlig liv og vil bli husket før hun dør. En sær, vittig og vemodig debut." },
  { title: "Mannen som elsket Yngve", author: "Tore Renberg", year: 2003, genre: "Roman", era: "samtid", themes: ["ungdom", "kjærlighet", "Stavanger"], blurb: "Jarle Klepp i Stavanger 1989: punk, kjæreste — og en forvirrende forelskelse i den nye gutten Yngve. Folkekjær oppvekstroman, første bok om Jarle." },
  { title: "Historie om et ekteskap", author: "Geir Gulliksen", year: 2015, genre: "Roman", era: "samtid", themes: ["ekteskap", "utroskap", "kjærlighet"], orig: "The Story of a Marriage", blurb: "En mann forsøker å forstå hvordan kjærligheten og ekteskapet hans gikk i oppløsning, fortalt fra konas perspektiv. Naken og presis samlivsroman." },
  { title: "Bikubesong", author: "Frode Grytten", year: 1999, genre: "Roman", era: "samtid", themes: ["industri", "fellesskap", "bygd"], blurb: "Sammenvevde fortellinger fra beboerne i en arbeiderblokk i en vestlandsk industribygd. Gryttens myldrende «bikube» av menneskeskjebner på nynorsk." },
  { title: "Mengele Zoo", author: "Gert Nygårdshaug", year: 1989, genre: "Roman", era: "samtid", themes: ["regnskog", "økologi", "opprør"], blurb: "Mino vokser opp i regnskogen og blir økoterrorist når storselskapene ødelegger hans verden. Kåret til tidenes beste norske roman av leserne i 2007." },

  // ── Bredere dekning: ett verk fra hver av de 100 mest innflytelsesrike ────
  // (Se docs/norwegian_authors_100.md — disse fyller ut kanonen.)

  // Språk, folkedikting og det nasjonale
  { title: "Symra", author: "Ivar Aasen", year: 1863, genre: "Lyrikk", era: "1800", themes: ["språk", "nasjon", "natur"], blurb: "Diktsamlingen der mannen bak nynorsken viser at det nye skriftspråket også kunne synge — her står «Nordmannen» («Millom bakkar og berg»)." },
  { title: "Norske huldreeventyr og folkesagn", author: "Peter Christen Asbjørnsen", year: 1845, genre: "Eventyr", era: "1800", themes: ["folketro", "natur", "sagn"], blurb: "Asbjørnsens egne sagn og huldreeventyr, rammet inn av levende naturskildringer fra skog og sæter. Folkeminnegranskeren bak de berømte eventyrene." },
  { title: "I Brønden og i Kjernet", author: "Jørgen Moe", year: 1851, genre: "Barnebok", era: "1800", themes: ["barn", "natur", "oppvekst"], blurb: "Moes varme barnefortellinger — den ene halvdelen av eventyrduoen, også en fin lyriker og senere biskop." },
  { title: "Norges Dæmring", author: "Johan Sebastian Welhaven", year: 1834, genre: "Lyrikk", era: "1800", themes: ["dannelse", "polemikk", "nasjon"], blurb: "En sonettsyklus som refser den umodne norske kulturen og tenner den legendariske feiden mot Wergeland om hva slags nasjon Norge skulle bli." },

  // Tidlig roman og krim
  { title: "Mordet paa Maskinbygger Roolfsen", author: "Maurits Hansen", year: 1840, genre: "Krim", era: "1800", themes: ["mord", "etterforskning", "gåte"], blurb: "Regnet blant verdens aller første kriminalromaner — en mordgåte med systematisk etterforskning, skrevet flere år før Poe og Doyle." },

  // Kring 1900 — drama, lyrikk og bredden i prosaen
  { title: "Sneskavlen brast", author: "Hans E. Kinck", year: 1918, genre: "Roman", era: "1900", themes: ["bygd", "psykologi", "natur"], blurb: "Kincks brede romanverk om bygdesamfunnet og menneskesinnets mørke, av en av våre mest særpregede og språkmektige fortellere." },
  { title: "Kjærlighedens tragedie", author: "Gunnar Heiberg", year: 1904, genre: "Drama", era: "1900", themes: ["kjærlighet", "kvinne", "lidenskap"], blurb: "Heibergs intense drama om kjærlighetens krav og kvinnens frihet — sammen med «Balkonen» kjernen i hans erotiske dramatikk." },
  { title: "Oppbrudd", author: "Helge Krog", year: 1936, genre: "Drama", era: "1900", themes: ["kvinne", "frigjøring", "ekteskap"], blurb: "Et samfunnskritisk drama om en kvinne som bryter ut for å leve fritt. Krog var en skarp dramatiker og essayist i Ibsens og kvinnesakens ånd." },
  { title: "Kilden", author: "Gabriel Scott", year: 1918, genre: "Roman", era: "1900", themes: ["natur", "tro", "enkelhet"], orig: "The Wellspring", blurb: "Den fattige fiskeren Markus lever i barnlig samklang med Gud og naturen ved sjøen. Scotts stillferdige perle om det enkle, fromme liv." },
  { title: "Ungen", author: "Oskar Braaten", year: 1911, genre: "Drama", era: "1900", themes: ["arbeider", "kvinne", "Kristiania"], blurb: "Et folkelivsbilde fra fabrikkstrøkene langs Akerselva, der ugifte mødre og arbeidsfolk får liv. Braaten ga arbeiderklassen en scene." },
  { title: "Metope", author: "Olaf Bull", year: 1927, genre: "Lyrikk", era: "1900", themes: ["tid", "kjærlighet", "forgjengelighet"], blurb: "Tittelen på samlingen med Bulls mest berømte dikt — et forsøk på å meisle øyeblikket og den elskede fast i tiden. Vår fremste nyromantiske lyriker." },
  { title: "Nyinger", author: "Herman Wildenvey", year: 1907, genre: "Lyrikk", era: "1900", themes: ["kjærlighet", "natur", "livsglede"], blurb: "Gjennombruddssamlingen med lett, leende og musikalsk vers. Wildenvey ble folkekjær for sin sorgløse erotiske livsglede." },
  { title: "Edderkoppen", author: "Hulda Garborg", year: 1904, genre: "Drama", era: "1900", themes: ["kvinne", "ekteskap", "samfunn"], blurb: "Et skuespill om kvinnens stilling av en sentral kulturpersonlighet — forfatter, dramatiker og forkjemper for folkedans og bunad." },
  { title: "To levende og en død", author: "Sigurd Christiansen", year: 1931, genre: "Roman", era: "1900", themes: ["mot", "skyld", "moral"], blurb: "Et postran der én tjenestemann gjør motstand og dør, mens to overlever — og må leve med spørsmålet om feighet og heltemot. Christiansens hovedverk." },
  { title: "Mannen som elsket rettferdigheten", author: "Ronald Fangen", year: 1934, genre: "Roman", era: "1900", themes: ["moral", "rettferd", "tro"], blurb: "En psykologisk-etisk roman om idealisme som slår om i fanatisme. Fangen var en ledende kristen humanist i mellomkrigstidens debatt." },

  // Lyrikkens mange stemmer
  { title: "Harpe og dolk", author: "Halldis Moren Vesaas", year: 1929, genre: "Lyrikk", era: "1900", themes: ["kvinne", "livskraft", "kjærlighet"], blurb: "En frisk og frimodig debut som ga en ung kvinnestemme plass i nynorsk lyrikk. Hun ble en av landets mest folkekjære poeter." },
  { title: "Mogning i mørkret", author: "Tor Jonsson", year: 1943, genre: "Lyrikk", era: "1900", themes: ["bygd", "ensomhet", "kjærlighet"], blurb: "Husmannssønnen Jonssons gjennombrudd, full av bittert alvor og lengsel. Her finnes kimen til den udødelige «Norsk kjærleikssong»." },
  { title: "De dødes tjern", author: "André Bjerke", year: 1942, genre: "Krim", era: "1900", themes: ["mystikk", "spenning", "psykologi"], orig: "Lake of the Dead", blurb: "En grøsser-krim om et forhekset skogstjern, skrevet under pseudonymet Bernhard Borge. Filmatiseringen ble en norsk klassiker." },
  { title: "Jeg vil hjem til menneskene", author: "Gunvor Hofmo", year: 1946, genre: "Lyrikk", era: "etterkrig", themes: ["sorg", "ensomhet", "krig"], blurb: "Etterkrigsmodernismens mørke, eksistensielle stemme. Diktene bærer tapet av venninnen Ruth Maier, som ble drept i Auschwitz." },
  { title: "Gjennom stillheten en natt", author: "Stein Mehren", year: 1960, genre: "Lyrikk", era: "etterkrig", themes: ["bevissthet", "natur", "filosofi"], blurb: "Debuten til en av etterkrigstidens mest tankefulle og produktive lyrikere, opptatt av språk, erkjennelse og naturens store sammenhenger." },
  { title: "Mor Godhjertas glade versjon. Ja", author: "Jan Erik Vold", year: 1968, genre: "Lyrikk", era: "etterkrig", themes: ["hverdag", "modernisme", "lek"], blurb: "En lekende, talespråklig diktsamling som fornyet norsk poesi på 60-tallet. Vold gjorde lyrikken muntlig, jazzet og folkelig." },

  // Etterkrigs- og samtidsprosa — flere store fortellere
  { title: "Lillelord", author: "Johan Borgen", year: 1955, genre: "Roman", era: "etterkrig", themes: ["oppvekst", "borgerskap", "dobbeltliv"], blurb: "Wilfred «Lillelord» Sagen vokser opp i Kristianias velstående vestkant, splittet mellom finhet og en farlig dobbelthet. Borgens hovedverk, en trilogi." },
  { title: "Insektsommer", author: "Knut Faldbakken", year: 1972, genre: "Roman", era: "etterkrig", themes: ["oppvekst", "seksualitet", "sommer"], blurb: "En ung gutts sanselige og forvirrende sommer på familiehytta. Faldbakkens gjennombrudd, et høydepunkt i 70-tallets oppvekstroman." },
  { title: "Kvinneakvariet", author: "Bjørg Vik", year: 1972, genre: "Noveller", era: "etterkrig", themes: ["kvinne", "frigjøring", "samliv"], blurb: "Novellesamlingen som ble et samlingsmerke for den nye kvinnebevegelsen. Vik var en mester i å skildre kvinneliv og hverdag." },
  { title: "Hvem bestemmer over Bjørg og Unni?", author: "Liv Køltzow", year: 1972, genre: "Roman", era: "etterkrig", themes: ["kvinne", "frigjøring", "bevissthet"], blurb: "En tidlig og sentral roman fra den nyfeministiske bølgen om kvinners oppvåkning og krav på et eget liv." },
  { title: "Zink", author: "Espen Haavardsholm", year: 1971, genre: "Roman", era: "etterkrig", themes: ["politikk", "ungdom", "radikalisme"], blurb: "En formbevisst og politisk roman fra den radikale 70-tallsgenerasjonen, av en sentral skikkelse i tidens venstreorienterte litteratur." },
  { title: "Probok", author: "Tor Åge Bringsværd", year: 1968, genre: "Roman", era: "etterkrig", themes: ["science fiction", "fantasi", "samfunn"], blurb: "Tidlig, sjangersprengende prosa fra pioneren som gjorde science fiction stuerent i Norge — siden også en elsket barnebokforfatter." },
  { title: "Azur, Kapteinenes planet", author: "Jon Bing", year: 1975, genre: "Roman", era: "etterkrig", themes: ["science fiction", "fremtid", "rom"], blurb: "Norsk science fiction fra forfatteren og jusprofessoren som sammen med Bringsværd formet sjangeren her til lands." },
  { title: "Måkespisere", author: "Cecilie Løveid", year: 1983, genre: "Drama", era: "samtid", themes: ["kvinne", "krig", "språk"], blurb: "Et språklig nyskapende radiodrama om en ung kvinne under krigen, prisbelønt internasjonalt. Løveid utvider stadig grensene for dramatikken." },
  { title: "Slåttekar i himmelen", author: "Edvard Hoem", year: 2014, genre: "Roman", era: "samtid", themes: ["slekt", "utvandring", "1800-tallet"], blurb: "Hoem følger sin egen tippoldefars liv i et bredt slektsepos om strev, tro og utvandring på 1800-tallet. Folkekjær dokumentarisk romankunst." },
  { title: "Grøftetildragelsesmysteriet", author: "Thure Erik Lund", year: 1995, genre: "Roman", era: "samtid", themes: ["språk", "sivilisasjon", "essay"], blurb: "En vill, språkrik og tankesprengende roman av en kompromissløs stilist. Lund er en kultforfatter for de som elsker krevende prosa." },
  { title: "Skammen", author: "Bergljot Hobæk Haff", year: 1996, genre: "Roman", era: "samtid", themes: ["skyld", "utstøtelse", "religion"], blurb: "En gammel kvinnes oppgjør med et liv preget av fordømmelse og utstøting. Haffs mørke, bibelsk ladede fortellerkunst på sitt sterkeste." },
  { title: "De urolige", author: "Linn Ullmann", year: 2015, genre: "Roman", era: "samtid", themes: ["far", "minne", "familie"], orig: "Unquiet", blurb: "En datter mimrer om foreldrene — filmskaperen og skuespillerinnen — og om en fars aldring. Ullmanns mest personlige roman." },
  { title: "Gå. Eller kunsten å leve et vilt og poetisk liv", author: "Tomas Espedal", year: 2006, genre: "Roman", era: "samtid", themes: ["vandring", "frihet", "litteratur"], blurb: "En sjangeroverskridende bok om å gå til fots gjennom liv og landskap. Espedal blander essay, selvbiografi og diktning." },
  { title: "Bokhandleren i Kabul", author: "Åsne Seierstad", year: 2002, genre: "Sakprosa", era: "samtid", themes: ["Afghanistan", "familie", "reportasje"], orig: "The Bookseller of Kabul", blurb: "En litterær reportasje fra en afghansk families hverdag etter Taliban. En internasjonal bestselger — og en omstridt rettssak om privatliv." },
  { title: "Latours katalog", author: "Nikolaj Frobenius", year: 1996, genre: "Roman", era: "samtid", themes: ["ondskap", "1700-tallet", "smerte"], orig: "The Subtle Art of Murder", blurb: "En mørk historisk roman om en bøddelsønn i opplysningstidens Paris, besatt av smerte og død. Stemningsfull og uhyggelig." },
  { title: "De beste blant oss", author: "Helene Uri", year: 2006, genre: "Roman", era: "samtid", themes: ["akademia", "ærgjerrighet", "satire"], blurb: "En skarp og morsom satire over intrigene ved et universitetsinstitutt, skrevet av en språkforsker med innsideblikk." },
  { title: "Dette livet eller det neste", author: "Demian Vitanza", year: 2017, genre: "Roman", era: "samtid", themes: ["radikalisering", "Syria", "identitet"], orig: "This Life or the Next", blurb: "Basert på samtaler med en dømt fremmedkriger: en ung norsk-pakistansk manns vei mot Syria. En av samtidens mest dagsaktuelle romaner." },
];

// ── derive id, fame rank, and category tags ─────────────────────────────────

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ERA_LABELS = {
  saga: "Sagatid",
  "1700": "1700-tallet",
  "1800": "1800-tallet",
  "1900": "Tidlig 1900-tall",
  etterkrig: "Etterkrigstid",
  samtid: "Samtid",
};

function decadeOf(year) {
  if (year == null) return null;
  return `${Math.floor(year / 10) * 10}-tallet`;
}

const items = BOOKS.map((b, i) => {
  const cats = [];
  cats.push(`era:${b.era}`);
  cats.push(`genre:${slugify(b.genre)}`);
  for (const t of b.themes) cats.push(`theme:${slugify(t)}`);
  // "Populær" tag for the most famous quartile — used for difficulty hinting.
  if (i < Math.ceil(BOOKS.length / 4)) cats.push("tag:popular");

  return {
    id: `${slugify(b.author)}--${slugify(b.title)}`,
    title: b.title,
    author: b.author,
    year: b.year,
    decade: decadeOf(b.year),
    genre: b.genre,
    era: b.era,
    eraLabel: ERA_LABELS[b.era] ?? b.era,
    themes: b.themes,
    blurb: b.blurb,
    orig: b.orig ?? null,
    cats,
    fame: i, // array order == notability rank (most famous first)
  };
});

const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "books.json");
writeFileSync(out, JSON.stringify(items, null, 2) + "\n", "utf8");

// quick sanity stats
const authors = new Set(items.map((i) => i.author));
const byGenre = items.reduce((m, i) => ((m[i.genre] = (m[i.genre] || 0) + 1), m), {});
console.log(`Wrote ${items.length} books by ${authors.size} authors → ${out}`);
console.log("By genre:", byGenre);
