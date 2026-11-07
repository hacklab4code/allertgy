const KEY = "allertgy-piano-v2";
const ORIGIN = "2026-11-03";
const HORIZON = "2027-01-31";
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

let state = null;
let lastView = "";

function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daySpan(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

function horizonDays() {
  return daySpan(ORIGIN, HORIZON) + 1;
}

function leftPct(value) {
  return (daySpan(ORIGIN, value) / horizonDays()) * 100;
}

function shortDate(value) {
  const date = parseDate(value);
  return date.getDate() + " " + MESI[date.getMonth()];
}

function labelSpan(start, end, loose) {
  if (loose && start === end) return "gennaio";
  if (loose) return shortDate(start) + " – gennaio";
  if (start === end) return shortDate(start);
  return shortDate(start) + " – " + shortDate(end);
}

function todayIso() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + m + "-" + d;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

function pointValue(points) {
  if (points == null || points === "") return null;
  const number = Number(points);
  return Number.isFinite(number) ? number : null;
}

function pointsFilled() {
  return state.stories.some((story) => pointValue(story.points) != null);
}

function scopeOf() {
  return state.stories.reduce((sum, story) => sum + (pointValue(story.points) || 0), 0);
}

function doneOf() {
  return state.stories
    .filter((story) => story.status === "done")
    .reduce((sum, story) => sum + (pointValue(story.points) || 0), 0);
}

function sprintIndex(id) {
  return state.sprints.findIndex((sprint) => sprint.id === id);
}

function doneThrough(index) {
  return state.stories
    .filter((story) => story.status === "done" && sprintIndex(story.sprint) > -1 && sprintIndex(story.sprint) <= index)
    .reduce((sum, story) => sum + (pointValue(story.points) || 0), 0);
}

function storyText(story) {
  if (!story.want) return "Storia ancora senza capacità";
  return "Come " + story.persona + ", voglio " + story.want + ", così da " + story.so + ".";
}

function storyFormula(story) {
  return "Come <b class=\"part\">" + esc(story.persona) + "</b>, voglio <b class=\"part\">" + esc(story.want) + "</b>, così da <b class=\"part\">" + esc(story.so) + "</b>.";
}

function statusLabel(status) {
  return { backlog: "Backlog", sprint: "Sprint", doing: "In corso", done: "Fatto" }[status] || status;
}

function findStory(id) {
  return state.stories.find((story) => story.id === id);
}

function findWbs(id) {
  return state.wbs.find((node) => node.id === id);
}

function codeOf(id) {
  const node = findWbs(id);
  return node ? node.code : "";
}

function kidsOf(id) {
  return state.wbs.filter((node) => node.parent === id);
}

function spanOf(node) {
  const kids = kidsOf(node.id);
  if (!kids.length) return { start: node.start, end: node.end };
  const spans = kids.map(spanOf);
  const starts = spans.map((span) => span.start).sort();
  const ends = spans.map((span) => span.end).sort();
  return { start: starts[0], end: ends[ends.length - 1] };
}

function linksOf(node) {
  if (Array.isArray(node.links) && node.links.length) return node.links;
  return (node.depends || []).map((id) => ({ id, type: "FS", lag: 0, why: "" }));
}

function formatLinks(node) {
  return linksOf(node)
    .map((link) => {
      const code = codeOf(link.id);
      return code ? code + " " + link.type : "";
    })
    .filter(Boolean)
    .join(", ");
}

function resourceKey(owner) {
  const name = String(owner || "");
  if (name.startsWith("Registrar")) return "registrar";
  if (name.startsWith("Matteo")) return "matteo";
  return name || "n";
}

function resourceTone(owner) {
  const key = resourceKey(owner);
  if (key === "matteo" || key === "registrar") return key;
  return "other";
}

function resourceLabel(tone, owner) {
  if (tone === "matteo") return "Matteo";
  if (tone === "registrar") return "Registrar";
  return owner || "Altra risorsa";
}

const RACI_NAMES = {
  matteo: "Matteo",
  hacklab: "hacklab.digital",
  docente: "Docente PM",
  registrar: "Registrar",
  hostinger: "Hostinger",
  legale: "Studio legale",
  ristoratore: "Ristoratore",
  referente: "Referente allergeni",
  cliente: "Cliente"
};

const RACI_ROWS = [
  { id: "w211", group: "gantt", R: ["registrar"], A: ["hacklab"], C: ["matteo"], I: ["docente"], why: "Il registrar registra il dominio e lo punta al VPS. hacklab.digital risponde: il dominio è suo e costa. Matteo indica quale server. Il docente riceve l’esito alla milestone, non sceglie il DNS." },
  { id: "w212", group: "gantt", R: ["matteo"], A: ["hacklab"], C: ["registrar"], I: ["docente"], why: "Matteo mette il certificato e il redirect dalla porta 80. Il registrar si consulta prima, perché senza DNS puntato il certificato non ha un nome. hacklab.digital risponde del risultato." },
  { id: "w213", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo verifica che l’HTTP non restituisca i piatti. Nessun fornitore decide questo controllo. hacklab.digital risponde se la prova fallisce." },
  { id: "w214", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo fa usare a QR e app solo l’HTTPS. I ristoratori vengono avvisati quando il QR si stampa, non durante questo controllo." },
  { id: "w221", group: "gantt", R: ["matteo"], A: ["hacklab"], C: ["hostinger"], I: ["docente"], why: "Matteo scrive il dump datato. Hostinger si consulta perché il file sta sul suo VPS, in /var/backups. hacklab.digital risponde del canone e del file." },
  { id: "w222", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo chiude il percorso del .sql. In beta il dump non contiene allergie, quindi non è un parere dello studio legale." },
  { id: "w231", group: "gantt", R: ["matteo"], A: ["hacklab"], C: ["hostinger"], I: ["docente"], why: "Matteo ripristina su staging e lascia la beta intatta. Hostinger si consulta sul secondo database. hacklab.digital risponde che la beta non venga sovrascritta." },
  { id: "w232", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo rilegge un piatto noto. È la prova che il restore ha funzionato. hacklab.digital risponde dell’esito." },
  { id: "w233", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo scrive data, esito e id del piatto. Il docente è informato: il verbale è il report di questa milestone." },
  { id: "w241", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo toglie pagamento e AI dalla beta. La A è hacklab.digital perché è una decisione di scope, non un dettaglio di codice." },
  { id: "w242", group: "gantt", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo spegne il menù dimostrativo. Non dipende dalle chiavi: sono due controlli distinti. hacklab.digital risponde di entrambi." },
  { id: "w11", group: "altro", R: ["matteo"], A: ["hacklab"], C: ["docente"], I: [], why: "Matteo scrive il charter e lo firma come project manager. hacklab.digital dà il Go di scope e di cassa. Il docente si consulta perché autorizza il mandato di aula." },
  { id: "w13", group: "altro", R: ["matteo"], A: ["hacklab"], C: ["legale"], I: ["docente"], why: "Matteo prepara il dossier. Lo studio legale si consulta sul perimetro dell’incarico. hacklab.digital autorizza la spesa e si ferma se il preventivo supera 2.000 €." },
  { id: "w33", group: "altro", R: ["matteo"], A: ["hacklab"], C: ["legale"], I: ["docente", "cliente"], why: "Matteo scrive colore(). hacklab.digital risponde della regola: il vuoto non è verde. Lo studio legale si consulta sulla frase «idoneo secondo i dati dichiarati»." },
  { id: "w41", group: "altro", R: ["matteo"], A: ["hacklab"], C: ["referente"], I: ["ristoratore", "docente"], why: "Matteo costruisce scheda e verifica. Il referente allergeni si consulta su nome, data e su che cosa sta confermando. Il ristoratore viene informato, non decide il campo." },
  { id: "w51", group: "altro", R: ["matteo"], A: ["hacklab"], C: ["ristoratore"], I: ["docente"], why: "Matteo fa l’onboarding, al massimo dieci locali, a zero euro. Il ristoratore si consulta perché porta un menù vero. hacklab.digital risponde del perimetro della cohort." },
  { id: "w52", group: "altro", R: ["ristoratore"], A: ["matteo"], C: ["cliente"], I: ["docente", "hacklab"], why: "Le 15 persone le recluta il locale, non una campagna. Qui la A è Matteo: il criterio è suo. hacklab.digital è solo informato, perché non è una decisione di cassa." },
  { id: "w61", group: "altro", R: ["legale", "matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Lo studio legale scrive il parere. Matteo lo archivia prima del pubblico. hacklab.digital risponde: senza parere, e se il preventivo sta entro 2.000 €, non si apre." },
  { id: "w62", group: "altro", R: ["matteo"], A: ["hacklab"], C: [], I: ["docente"], why: "Matteo invia le due build. Apple e Google non stanno in matrice: ricevono il pacchetto e l’esito della review non è un criterio di successo." },
  { id: "w63", group: "altro", R: ["matteo"], A: ["hacklab"], C: ["docente", "legale"], I: ["ristoratore"], why: "Matteo porta i numeri. hacklab.digital decide se si apre al pubblico o si chiude. Docente e studio legale si consultano prima. I ristoratori vengono informati dopo." }
];

const RACI_SHORT = {
  matteo: "Matteo",
  hacklab: "hacklab",
  docente: "Docente",
  registrar: "Registrar",
  hostinger: "Hostinger",
  legale: "Legale",
  ristoratore: "Ristoratore",
  referente: "Referente",
  cliente: "Cliente"
};

const RACI_PEOPLE = ["matteo", "hacklab", "docente", "registrar", "hostinger", "legale", "ristoratore", "referente", "cliente"];

function raciNames(keys, short) {
  if (!keys || !keys.length) return "—";
  const dict = short ? RACI_SHORT : RACI_NAMES;
  return keys.map((key) => dict[key] || key).join(", ");
}

function raciLetter(row, person) {
  if ((row.A || []).includes(person)) return "A";
  if ((row.R || []).includes(person)) return "R";
  if ((row.C || []).includes(person)) return "C";
  if ((row.I || []).includes(person)) return "I";
  return "";
}

function absStartOf(node) {
  return daySpan(ORIGIN, node.start) + (Number(node.at) || 0);
}

function absEndOf(node) {
  const kids = kidsOf(node.id);
  if (!kids.length) {
    const dur = node.days != null ? Number(node.days) : daySpan(node.start, node.end) + 1;
    return absStartOf(node) + dur;
  }
  return Math.max(...kids.map(absEndOf));
}

function applyInfraGantt(wbs) {
  const byId = {};
  wbs.forEach((node) => { byId[node.id] = node; });
  const tie = (id, type, why) => ({ id, type, lag: 0, why });
  const place = (id, start, at, links) => {
    const node = byId[id];
    if (!node) return;
    node.start = start;
    node.at = at;
    node.end = start;
    node.links = links;
    node.depends = links.map((item) => item.id);
    node.looseEnd = false;
  };
  place("w211", "2026-11-18", 0, [
    tie("w12", "FS", "Il DNS punta il VPS della baseline. Senza quel server il dominio non ha una destinazione.")
  ]);
  place("w212", "2026-11-19", 0, [
    tie("w211", "FS", "Certificato e redirect chiedono il dominio già puntato al VPS.")
  ]);
  place("w213", "2026-11-20", 0, [
    tie("w212", "FS", "Il controllo sull'HTTP ha senso dopo il redirect dalla porta 80.")
  ]);
  place("w214", "2026-11-23", 0, [
    tie("w212", "FS", "QR e app usano il dominio HTTPS. Non dipendono dal controllo HTTP: partono lunedì perché venerdì Matteo verifica il file .sql.")
  ]);
  place("w221", "2026-11-18", 0, [
    tie("w12", "FS", "Il dump legge il database della beta, già presente dalla baseline.")
  ]);
  place("w222", "2026-11-20", 0.5, [
    tie("w221", "FS", "Il file deve già esistere."),
    tie("w213", "FS", "Il web non deve poterlo servire: l'HTTP è già chiuso.")
  ]);
  place("w231", "2026-11-24", 0.5, [
    tie("w221", "FS", "Il ripristino usa il dump, pronto dal 18. Parte il 24 perché nel mezzo Matteo chiude certificato, HTTP, file, QR e demo. È la risorsa, non un lag.")
  ]);
  place("w232", "2026-11-25", 0, [
    tie("w231", "FS", "Il piatto noto si rilegge a ripristino finito. È la prova.")
  ]);
  place("w233", "2026-11-25", 0.25, [
    tie("w232", "FF", "Il verbale si chiude dopo la prova. Finish-to-Finish: la fine del report segue la fine del test.")
  ]);
  place("w241", "2026-11-23", 0.5, [
    tie("w12", "FS", "Le chiavi di pagamento e AI si tolgono dalla beta già avviata.")
  ]);
  place("w242", "2026-11-24", 0, [
    tie("w12", "FS", "Il menù dimostrativo si spegne sulla beta. Non dipende dalle chiavi: sono due controlli diversi. Matteo li mette in fila perché è uno solo.")
  ]);
  const absStart = (node) => daySpan(ORIGIN, node.start) + (Number(node.at) || 0);
  const absEnd = (node) => {
    const kids = wbs.filter((item) => item.parent === node.id);
    if (!kids.length) {
      const dur = node.days != null ? Number(node.days) : daySpan(node.start, node.end) + 1;
      return absStart(node) + dur;
    }
    return Math.max(...kids.map(absEnd));
  };
  const dateFromAbs = (abs, edge) => {
    const whole = edge === "end" ? Math.floor(abs - 1e-9) : Math.floor(abs + 1e-9);
    const date = parseDate(ORIGIN);
    date.setDate(date.getDate() + whole);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  };
  ["w21", "w22", "w23", "w24", "w2"].forEach((id) => {
    const node = byId[id];
    if (!node) return;
    const kids = wbs.filter((item) => item.parent === id);
    if (!kids.length) return;
    const begin = Math.min(...kids.map(absStart));
    const finish = absEnd(node);
    node.start = dateFromAbs(begin, "start");
    node.at = Math.round((begin - Math.floor(begin)) * 1000) / 1000;
    node.end = dateFromAbs(finish, "end");
    node.looseEnd = false;
  });
}

function tree(rootId) {
  const rows = [];
  const walk = (parent, depth) => {
    state.wbs.filter((node) => node.parent === parent).forEach((node) => {
      rows.push({ node, depth, group: kidsOf(node.id).length > 0 });
      walk(node.id, depth + 1);
    });
  };
  if (!rootId) {
    walk(null, 0);
    return rows;
  }
  const root = findWbs(rootId);
  if (!root) return rows;
  rows.push({ node: root, depth: 0, group: kidsOf(root.id).length > 0 });
  walk(rootId, 1);
  return rows;
}

function underWbs(id, rootId) {
  let node = findWbs(id);
  while (node) {
    if (node.id === rootId) return true;
    node = node.parent ? findWbs(node.parent) : null;
  }
  return false;
}

const ESTIMATES = {
  "US-S1": 8,
  "US-S2": 5,
  "US-S3": 5,
  "US-S4": 3,
  "US-S5": 3,
  "US-S6": 2,
  "US-S7": 5,
  "US-S8": 2,
  "US-S9": 8,
  "US-S10": 5,
  "US-S11": 2,
  "US-S12": 5,
  "US-S13": 5,
  "US-S14": 5,
  "US-S15": 5,
  "US-S16": 2,
  "US-S17": 3,
  "US-S18": 5,
  "US-S19": 3
};

const CAPACITY = 20;
const SPRINT_LIMIT = 21;
const SPRINT_PLAN = {
  "US-S9": ["s1", 1],
  "US-S8": ["s1", 2],
  "US-S5": ["s1", 3],
  "US-S2": ["s2", 1],
  "US-S3": ["s2", 2],
  "US-S13": ["s2", 3],
  "US-S1": ["s3", 1],
  "US-S14": ["s3", 2],
  "US-S18": ["s4", 1],
  "US-S7": ["s4", 2],
  "US-S4": ["s4", 3],
  "US-S6": ["s4", 4]
};
const END_COLUMNS = {
  "US-S8": ["done", "done", "done"],
  "US-S5": ["done", "done", "review", "review"],
  "US-S9": ["done", "review", "doing", "doing"]
};
const BOARD_COLUMNS = [
  ["backlog", "Backlog", "Tutto il progetto, fuori da questo sprint"],
  ["todo", "To do", "Pronte per iniziare"],
  ["doing", "In lavorazione", "Prese in carico"],
  ["review", "Review", "In verifica"],
  ["done", "Completato", "Finite: restano qui"]
];
const STORY_WASH = {
  "US-S1": "#f1fec8",
  "US-S2": "#d9f2e6",
  "US-S3": "#cfe7dd",
  "US-S4": "#ffe0c2",
  "US-S5": "#ffd0a8",
  "US-S6": "#f7d6e8",
  "US-S7": "#e7e0ff",
  "US-S8": "#e4f5a4",
  "US-S9": "#c9d9ff",
  "US-S10": "#d7f3f1",
  "US-S11": "#ffe8a3",
  "US-S12": "#f8d7d2",
  "US-S13": "#d5e4f7",
  "US-S14": "#f3e0ff",
  "US-S15": "#cfeeda",
  "US-S16": "#f6f0c4",
  "US-S17": "#e5f4d8",
  "US-S18": "#f8e1ea",
  "US-S19": "#dce8ff"
};
const SPRINT_GOALS = {
  s1: "Tre ambienti distinti. La frase legale c'è prima della registrazione. La persona indica le allergie, senza referti.",
  s2: "Il locale compila il libro, ingredienti e tracce distinti. Backup e ripristino sono lo stesso lavoro.",
  s3: "La persona vede se quel piatto va bene per lei, e perché. Un dato mancante non è verde.",
  s4: "Il ristoratore pubblica il menù. Al tavolo il QR lo apre, il colore si vede prima di chiedere, e si guarda lo stesso semaforo."
};
const WHY = {
  "US-S8": "Il parere serve prima che qualcuno si registri. È la prima cosa.",
  "US-S5": "Il profilo arriva prima del semaforo. Si indicano le allergie, anche oltre i 14, e niente referti.",
  "US-S2": "Il locale compila gli allergeni. Senza questo libro lo sprint dopo non ha dati da leggere.",
  "US-S3": "Ingredienti e tracce restano distinti, con nome e data di chi conferma.",
  "US-S1": "Il semaforo confronta profilo e piatto. Sta dopo il libro, perché usa quei dati.",
  "US-S7": "Il QR apre il menù di quel locale al tavolo, e si può stampare.",
  "US-S4": "Il cliente ha già visto il colore prima di chiedere in sala.",
  "US-S6": "A tavola si guarda lo stesso semaforo, quello di chi ha l'allergia.",
  "US-S9": "Sviluppo, staging e beta stanno separati. Senza questo il resto si prova sulla demo.",
  "US-S10": "Privacy, termini, disclaimer e articolo 9 partono insieme, prima che qualcuno si registri.",
  "US-S11": "Niente registrazione pubblica e niente paywall finché il parere non c'è.",
  "US-S12": "Il libro non si apre in chiaro. HTTPS viene prima dei dati del locale.",
  "US-S13": "Backup e ripristino restano una sola storia. Non si spezzano in due giornate.",
  "US-S14": "Sotto il colore c'è il perché. Il cliente non decide solo dal semaforo.",
  "US-S15": "Rosso, giallo, verde e vuoto sono provati prima di rilasciare il motore.",
  "US-S16": "In beta non restano pagamenti, AI e dati dimostrativi.",
  "US-S17": "Menù e QR sono di un locale con un nome. Senza scheda non si pubblica.",
  "US-S18": "In sala arriva solo il menù pubblicato, non la bozza del libro.",
  "US-S19": "Un piatto incompleto non si pubblica e non diventa verde. Resta intera nel product backlog."
};
const TASKS = {
  "US-S8": [
    "Testo fisso «idoneo secondo i dati dichiarati dal locale» sul menù e sulla scheda piatto",
    "A schermo non compaiono «sicuro», «zero rischi», «privo di allergeni»",
    "La frase si legge anche senza account, prima della registrazione"
  ],
  "US-S5": [
    "Elenco di partenza con i 14 allergeni del regolamento, e un campo per aggiungerne altre",
    "Schermata profilo: si indicano le allergie, anche oltre i 14, senza foto, PDF o referto",
    "Salvataggio del profilo sul telefono",
    "Il profilo consegna al semaforo tutto l'elenco scelto, non solo i 14"
  ],
  "US-S2": [
    "Accesso del ristoratore al libro del proprio locale",
    "Scheda piatto: nome e i 14 allergeni da segnare",
    "Salvataggio del piatto",
    "Riapertura e correzione di un piatto già salvato",
    "Piatto senza allergeni compilati marcato incompleto"
  ],
  "US-S3": [
    "Sulla scheda del piatto ci sono due elenchi separati: ingredienti e tracce",
    "Una traccia non si salva dentro gli ingredienti",
    "Nome e data di chi conferma il piatto restano visibili"
  ],
  "US-S1": [
    "Lettura delle allergie dal profilo",
    "Lettura degli allergeni dichiarati sul piatto",
    "Match tra profilo e piatto: rosso",
    "Allergene solo nelle tracce: giallo",
    "Dati presenti e nessun match: verde",
    "Un'allergia del profilo che il piatto non dichiara non diventa verde",
    "Piatto incompleto o profilo vuoto: nessun colore, il vuoto non è verde",
    "Schermata del piatto con colore e frase"
  ],
  "US-S7": [
    "Il QR apre il menù di quel locale, senza chiedere un account",
    "Il QR di un altro locale non apre questo menù",
    "Il ristoratore può stampare il QR"
  ],
  "US-S4": [
    "Il colore del semaforo è sulla scheda del piatto prima che il cliente chiami la sala",
    "In sala si può ancora confermare il piatto al tavolo",
    "Il colore è quello calcolato dal semaforo, non uno scelto a mano"
  ],
  "US-S6": [
    "Si segue un solo profilo, quello di chi ha l'allergia",
    "Il colore non cambia se a guardare è un familiare senza allergie",
    "Due profili non si mescolano nello stesso confronto"
  ],
  "US-S9": [
    "Tre configurazioni separate: sviluppo, staging, beta",
    "Tre database. Un dato di sviluppo non compare negli altri due",
    "Tre indirizzi. La beta non serve la build di sviluppo",
    "Un deploy in staging non scrive sul database di beta"
  ],
  "US-S10": [
    "Testo privacy: quali dati, perché, per quanto. Le allergie restano sul telefono",
    "Termini: l'app non promette l'assenza di una reazione",
    "Nel pacchetto c'è la stessa frase del menù",
    "Un solo invio allo studio, prima di aprire la registrazione"
  ],
  "US-S11": [
    "In beta la registrazione pubblica è chiusa",
    "Non c'è una schermata di pagamento"
  ],
  "US-S12": [
    "Certificato HTTPS sul dominio di beta",
    "L'API e il libro non rispondono in HTTP",
    "HTTP reindirizza a HTTPS",
    "Una chiamata in HTTP non restituisce i piatti"
  ],
  "US-S13": [
    "Backup del database di beta, con data nel nome del file",
    "Il file di backup non è pubblico",
    "Ripristino di prova su staging, con verbale di ora ed esito",
    "Dopo il ripristino un piatto noto si legge di nuovo"
  ],
  "US-S14": [
    "Sotto il colore una riga sola, presa dal risultato del motore",
    "Rosso, giallo e verde hanno ciascuna la propria frase",
    "Senza colore non compare la riga"
  ],
  "US-S15": [
    "Prova automatica: ingrediente in comune, rosso",
    "Prova automatica: solo tracce, giallo",
    "Prova automatica: piatto completo e nessun match, verde",
    "Prova automatica: piatto incompleto, nessun colore",
    "Se una prova fallisce, la beta non si aggiorna"
  ],
  "US-S16": [
    "In beta non ci sono chiavi di pagamento né di AI",
    "Il menù dimostrativo non viene caricato"
  ],
  "US-S17": [
    "Scheda locale: id e nome",
    "Menù e QR usano quell'id. Senza locale non si salvano",
    "Il nome del locale è in testa al menù pubblico"
  ],
  "US-S18": [
    "Pubblica è un'azione del ristoratore, solo sul proprio locale",
    "In pubblico vanno solo i piatti completi",
    "Un piatto non pubblicato non compare al tavolo",
    "Togliere la pubblicazione lascia il piatto nel libro e lo toglie dal menù"
  ],
  "US-S19": [
    "Pubblica rifiuta un piatto incompleto",
    "Se un piatto pubblicato diventa incompleto, esce dal menù nello stesso salvataggio",
    "Quel piatto non riceve il verde"
  ]
};

function makeBoard(stories, moment) {
  const cards = [];
  stories.forEach((story) => {
    const tasks = Array.isArray(story.tasks) && story.tasks.length ? story.tasks : (TASKS[story.id] || []);
    tasks.forEach((title, index) => {
      let column = "backlog";
      if (story.sprint === "s1") {
        column = moment === "start" ? "todo" : ((END_COLUMNS[story.id] || [])[index] || "doing");
      }
      cards.push({ id: story.id + "-" + index, storyId: story.id, title, column, order: index });
    });
  });
  return cards;
}

function storyBase(id, name, persona, want, so, priority, wbs) {
  return { id, name, persona, want, so, points: ESTIMATES[id] ?? null, priority, status: "backlog", sprint: "", wbs, acceptance: [] };
}

function infraLeaves() {
  const beta = ["2026-11-18", "2026-12-01"];
  const restore = ["2026-11-25", "2026-12-01"];
  const row = (id, parent, code, name, span, owner, days, cost, note) => ({
    id,
    parent,
    code,
    name,
    start: span[0],
    end: span[1],
    milestone: false,
    done: true,
    progress: 1.0,
    depends: [],
    owner,
    days,
    cost,
    note: note || ""
  });
  return [
    row("w211", "w21", "2.1.1", "Dominio e DNS verso il VPS", beta, "Registrar, esterno", 0.5, 12, "Stima di un .it per un anno. Se il dominio c'è già, questa riga va a 0 €."),
    row("w212", "w21", "2.1.2", "Certificato HTTPS e redirect dalla porta 80", beta, "Matteo, interno", 1, 0),
    row("w213", "w21", "2.1.3", "HTTP non restituisce i piatti", beta, "Matteo, interno", 0.5, 0),
    row("w214", "w21", "2.1.4", "QR e app solo sul dominio HTTPS", beta, "Matteo, interno", 0.5, 0),
    row("w221", "w22", "2.2.1", "Dump datato in /var/backups", beta, "Matteo, interno · Hostinger", 1, 7, "I 7 € sono il canone del mese. Centro della fascia 6–8 € del pitch, non un preventivo."),
    row("w222", "w22", "2.2.2", "Il file .sql non si scarica dal web", beta, "Matteo, interno", 0.5, 0),
    row("w231", "w23", "2.3.1", "Ripristino su staging, beta intatta", restore, "Matteo, interno", 0.5, 0),
    row("w232", "w23", "2.3.2", "Piatto noto riletto", restore, "Matteo, interno", 0.25, 0),
    row("w233", "w23", "2.3.3", "Verbale di esito", restore, "Matteo, interno", 0.25, 0),
    row("w241", "w24", "2.4.1", "Beta senza chiavi di pagamento e AI", beta, "Matteo, interno", 0.5, 0),
    row("w242", "w24", "2.4.2", "Menù dimostrativo spento", beta, "Matteo, interno", 0.5, 0)
  ];
}

function seed() {
  const stories = [
    storyBase("US-S1", "Mangiare più tranquilli", "persona con un'allergia", "vedere se quel piatto va bene per me", "mangiare fuori più tranquillo", "alta", "w33"),
    storyBase("US-S2", "Il libro allergeni", "ristoratore", "un'app chiara per il libro degli allergeni", "aggiornare il menù senza riscriverlo a mano", "alta", "w41"),
    storyBase("US-S3", "Piatto per piatto", "referente allergeni", "segnare ingredienti e tracce di ogni piatto", "tenere il libro aggiornato", "alta", "w41"),
    storyBase("US-S4", "Il colore in sala", "personale di sala", "che il cliente abbia già visto il colore", "confermare il piatto al tavolo", "media", "w34"),
    storyBase("US-S5", "Solo le allergie", "cliente", "indicare solo le mie allergie", "usare l'app senza consegnare un referto", "media", "w31"),
    storyBase("US-S6", "Ordinare insieme", "familiare", "guardare il semaforo insieme a chi ha l'allergia", "ordinare senza indovinare", "media", "w31"),
    storyBase("US-S7", "Il QR in sala", "ristoratore", "un QR da mettere in sala", "far leggere il menù al tavolo", "media", "w43"),
    storyBase("US-S8", "Le scritte giuste", "studio legale", "leggere «idoneo secondo i dati dichiarati dal locale»", "dare il parere prima che qualcuno si registri", "bassa", "w61"),
    storyBase("US-S9", "Tre ambienti", "responsabile del prodotto", "sviluppo, staging e beta separati", "non provare sulla demo", "alta", "w12"),
    storyBase("US-S10", "Il pacchetto al legale", "studio legale", "privacy, termini, disclaimer e articolo 9 in un solo pacchetto", "scrivere il parere prima che qualcuno si registri", "alta", "w13"),
    storyBase("US-S11", "Registrazione chiusa", "sponsor", "il paywall spento e nessuna registrazione pubblica", "non aprire prima del parere", "media", "w13"),
    storyBase("US-S12", "Il server in HTTPS", "ristoratore", "il libro su un indirizzo HTTPS", "non lasciare allergeni e accessi in chiaro", "alta", "w21"),
    storyBase("US-S13", "Backup e ripristino", "responsabile del prodotto", "un backup del database e la prova di ripristino nello stesso lavoro", "aprire la beta con un verbale", "alta", "w23"),
    storyBase("US-S14", "Perché questo colore", "persona con un'allergia", "leggere perché il piatto è rosso, giallo o verde", "non decidere solo dal colore", "alta", "w33"),
    storyBase("US-S15", "I casi del motore", "responsabile del prodotto", "rosso, giallo, verde e vuoto già provati", "non rilasciare un semaforo che indovina", "alta", "w33"),
    storyBase("US-S16", "Demo spenta", "responsabile del prodotto", "pagamenti, AI e dati dimostrativi spenti in beta", "non far vedere una demo al pilota", "media", "w24"),
    storyBase("US-S17", "La scheda del locale", "ristoratore", "una scheda con il nome del locale", "legare menù e QR a quel ristorante", "alta", "w41"),
    storyBase("US-S18", "Pubblicare il menù", "ristoratore", "pubblicare il menù quando i piatti sono completi", "mostrarlo in sala", "alta", "w42"),
    storyBase("US-S19", "Incompleto non si pubblica", "cliente", "che un piatto incompleto non esca come verde", "non mangiare su un dato mancante", "alta", "w42")
  ];
  const acceptance = {
    "US-S1": [
      "Il semaforo confronta il piatto con il profilo",
      "Un dato mancante non è verde"
    ],
    "US-S2": [
      "Il ristoratore compila gli allergeni di un piatto",
      "Può correggere un piatto già salvato"
    ],
    "US-S3": [
      "Ingredienti e tracce sono distinti",
      "Nome e data di chi conferma sono visibili"
    ],
    "US-S4": [
      "Il cliente vede il colore prima di chiedere",
      "In sala si può ancora confermare"
    ],
    "US-S5": [
      "Il profilo chiede le allergie, anche oltre i 14",
      "Non si caricano referti"
    ],
    "US-S6": [
      "Si guarda un solo profilo",
      "Il colore è quello di chi ha l'allergia"
    ],
    "US-S7": [
      "Il QR apre il menù di quel locale",
      "Si può stampare"
    ],
    "US-S8": [
      "La frase c'è su menù e piatto",
      "Non compare la parola «sicuro»"
    ],
    "US-S9": [
      "Sviluppo, staging e beta hanno database diversi",
      "Un deploy in staging non tocca la beta"
    ],
    "US-S10": [
      "Il pacchetto ha privacy, termini, disclaimer e articolo 9",
      "Parte prima della registrazione pubblica"
    ],
    "US-S11": [
      "In beta non ci si registra",
      "Non compare un pagamento"
    ],
    "US-S12": [
      "Il libro si apre solo in HTTPS",
      "Una chiamata in HTTP non restituisce i piatti"
    ],
    "US-S13": [
      "C'è un backup datato e non pubblico",
      "Il ripristino di prova ha un verbale, ed è lo stesso lavoro del backup"
    ],
    "US-S14": [
      "Sotto il colore c'è una riga che dice il perché",
      "Senza colore non c'è la riga"
    ],
    "US-S15": [
      "Ci sono le prove di rosso, giallo, verde e vuoto",
      "Se una prova fallisce, la beta non si aggiorna"
    ],
    "US-S16": [
      "In beta non ci sono pagamenti né AI",
      "Non si carica un menù dimostrativo"
    ],
    "US-S17": [
      "Il locale ha id e nome",
      "Il nome si legge in testa al menù"
    ],
    "US-S18": [
      "In sala si vedono solo i piatti pubblicati",
      "Si può togliere la pubblicazione"
    ],
    "US-S19": [
      "Un piatto incompleto non entra nel menù pubblico",
      "Non riceve il verde"
    ]
  };
  stories.forEach((story) => {
    story.acceptance = acceptance[story.id] || [];
    story.tasks = TASKS[story.id] ? TASKS[story.id].slice() : [];
  });
  assignPlan(stories);
  const board = makeBoard(stories, "end");
  const wbs = [
    { id: "w1", parent: null, code: "1", name: "Avvio e Go", start: "2026-11-03", end: "2026-11-17", milestone: false, done: true, progress: 1.0, depends: [], owner: "Matteo" },
    { id: "w11", parent: "w1", code: "1.1", name: "Charter firmato", start: "2026-11-03", end: "2026-11-03", milestone: true, done: true, progress: 1.0, depends: [], owner: "Matteo" },
    { id: "w12", parent: "w1", code: "1.2", name: "Baseline e tre ambienti", start: "2026-11-03", end: "2026-11-17", milestone: true, done: true, progress: 1.0, depends: ["w11"], owner: "Matteo" },
    { id: "w13", parent: "w1", code: "1.3", name: "Testi al legale e incarico", start: "2026-11-04", end: "2026-11-17", milestone: false, done: true, progress: 1.0, depends: ["w11"], owner: "Matteo", cost: 500 },
    { id: "w2", parent: null, code: "2", name: "Infrastruttura", start: "2026-11-18", end: "2026-12-01", milestone: false, done: true, progress: 1.0, depends: ["w12"], owner: "Matteo" },
    { id: "w21", parent: "w2", code: "2.1", name: "HTTPS", start: "2026-11-18", end: "2026-12-01", milestone: false, done: true, progress: 1.0, depends: ["w12"], owner: "Matteo" },
    { id: "w22", parent: "w2", code: "2.2", name: "Backup eseguito", start: "2026-11-18", end: "2026-12-01", milestone: false, done: true, progress: 1.0, depends: ["w12"], owner: "Matteo" },
    { id: "w23", parent: "w2", code: "2.3", name: "Restore di prova scritto", start: "2026-11-25", end: "2026-12-01", milestone: true, done: true, progress: 1.0, depends: ["w22"], owner: "Matteo" },
    { id: "w24", parent: "w2", code: "2.4", name: "Demo spenta in beta", start: "2026-11-18", end: "2026-12-01", milestone: false, done: true, progress: 1.0, depends: ["w12"], owner: "Matteo" },
    { id: "w3", parent: null, code: "3", name: "Percorso cliente", start: "2026-11-18", end: "2026-12-15", milestone: false, done: true, progress: 1.0, depends: ["w12"], owner: "Matteo" },
    { id: "w31", parent: "w3", code: "3.1", name: "Profilo allergeni", start: "2026-11-18", end: "2026-12-15", milestone: false, done: true, progress: 1.0, depends: ["w12"], owner: "Matteo" },
    { id: "w32", parent: "w3", code: "3.2", name: "QR o codice del locale", start: "2026-11-18", end: "2026-12-15", milestone: false, done: true, progress: 1.0, depends: ["w214"], owner: "Matteo" },
    { id: "w33", parent: "w3", code: "3.3", name: "Semaforo, vuoto mai verde", start: "2026-11-18", end: "2026-12-15", milestone: false, done: true, progress: 1.0, depends: ["w31"], owner: "Matteo" },
    { id: "w34", parent: "w3", code: "3.4", name: "Disclaimer sul menù e sul piatto", start: "2026-12-08", end: "2026-12-15", milestone: true, done: true, progress: 1.0, depends: ["w33"], owner: "Matteo" },
    { id: "w4", parent: null, code: "4", name: "Percorso ristoratore", start: "2026-12-16", end: "2026-12-29", milestone: false, done: false, progress: 0.45, depends: ["w33"], owner: "Matteo" },
    { id: "w41", parent: "w4", code: "4.1", name: "Scheda, menù, verifica di cucina", start: "2026-12-16", end: "2026-12-29", milestone: false, done: false, progress: 0.45, status: "doing", depends: ["w33"], owner: "Matteo" },
    { id: "w42", parent: "w4", code: "4.2", name: "Pubblicazione, incompleto non verde", start: "2026-12-16", end: "2026-12-29", milestone: false, done: false, progress: 0.0, status: "todo", depends: ["w41"], owner: "Matteo" },
    { id: "w43", parent: "w4", code: "4.3", name: "QR stampabile", start: "2026-12-22", end: "2026-12-29", milestone: true, done: false, progress: 0.0, status: "todo", depends: ["w42"], owner: "Matteo" },
    { id: "w5", parent: null, code: "5", name: "Cohort", start: "2026-12-30", end: "2027-01-12", milestone: false, done: false, progress: 0.0, depends: ["w43", "w23"], owner: "Matteo" },
    { id: "w51", parent: "w5", code: "5.1", name: "Da 5 a 10 locali, a zero euro", start: "2026-12-30", end: "2027-01-12", milestone: true, done: false, progress: 0.0, depends: ["w43", "w23"], owner: "Matteo" },
    { id: "w52", parent: "w5", code: "5.2", name: "15 persone, profilo e una scansione", start: "2026-12-30", end: "2027-01-31", milestone: false, done: false, progress: 0.0, depends: ["w34", "w51"], owner: "Matteo", looseEnd: true },
    { id: "w53", parent: "w5", code: "5.3", name: "Registro cohort, senza dati sanitari", start: "2026-12-30", end: "2027-01-12", milestone: false, done: false, progress: 0.0, depends: ["w51"], owner: "Matteo" },
    { id: "w6", parent: null, code: "6", name: "Chiusura", start: "2026-11-18", end: "2027-01-31", milestone: false, done: false, progress: 6 / 331, depends: ["w13"], owner: "Matteo", looseEnd: true },
    { id: "w61", parent: "w6", code: "6.1", name: "Parere archiviato", start: "2026-11-18", end: "2027-01-31", milestone: false, done: false, progress: 0.1, status: "doing", depends: ["w13"], owner: "Matteo", looseEnd: true, cost: 331 },
    { id: "w62", parent: "w6", code: "6.2", name: "Due invii agli store", start: "2027-01-13", end: "2027-01-31", milestone: false, done: false, progress: 0.0, depends: ["w34", "w43"], owner: "Matteo", looseEnd: true },
    { id: "w63", parent: "w6", code: "6.3", name: "Decisione: pubblico o chiusura", start: "2027-01-31", end: "2027-01-31", milestone: true, done: false, progress: 0.0, depends: ["w61", "w62", "w51"], owner: "hacklab.digital", looseEnd: true }
  ];
  const at = wbs.findIndex((node) => node.id === "w3");
  wbs.splice(at, 0, ...infraLeaves());
  applyInfraGantt(wbs);
  return {
    version: 20,
    ganttScope: "mid",
    mode: "agile",
    view: "kanban",
    currentSprint: "s1",
    viewSprint: "s1",
    selectedStory: "US-S9",
    selectedCard: "US-S9-2",
    board,
    boardMoment: "end",
    selectedWbs: "w12",
    evmScenario: "v1",
    selectedEvmWbs: "w4",
    notice: "",
    baseline: null,
    sprints: [
      { id: "s1", name: "Sprint 1", goal: SPRINT_GOALS.s1, start: "2026-11-03", end: "2026-11-17", closed: false },
      { id: "s2", name: "Sprint 2", goal: SPRINT_GOALS.s2, start: "2026-11-18", end: "2026-12-01", closed: false },
      { id: "s3", name: "Sprint 3", goal: SPRINT_GOALS.s3, start: "2026-12-02", end: "2026-12-15", closed: false },
      { id: "s4", name: "Sprint 4", goal: SPRINT_GOALS.s4, start: "2026-12-16", end: "2026-12-29", closed: false },
      { id: "s5", name: "Sprint 5", goal: "Da 5 a 10 locali in cohort, a zero euro.", start: "2026-12-30", end: "2027-01-12", closed: false },
      { id: "s6", name: "Sprint 6", goal: "Parere archiviato, due build inviate, decisione di uscita.", start: "2027-01-13", end: "2027-01-31", closed: false, looseEnd: true }
    ],
    stories,
    wbs,
    history: []
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || ![8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(raw.version) || !Array.isArray(raw.stories) || !Array.isArray(raw.wbs)) return seed();
    raw.version = 20;
    raw.evmScenario = raw.evmScenario === "mix" ? "v1" : (raw.evmScenario || "v1");
    raw.selectedEvmWbs = raw.selectedEvmWbs || "w4";
    raw.wbs.forEach((node) => {
      if (node.end === "2027-01-26" || node.start === "2027-01-26") {
        if (node.start === "2027-01-26") node.start = "2027-01-31";
        if (node.end === "2027-01-26") node.end = "2027-01-31";
        node.looseEnd = true;
      }
    });
    raw.sprints.forEach((sprint) => {
      if (sprint.end === "2027-01-26") {
        sprint.end = "2027-01-31";
        sprint.looseEnd = true;
      }
    });
    raw.viewSprint = raw.viewSprint || raw.currentSprint || "s1";
    raw.notice = "";
    raw.stories.forEach((story) => {
      if ((story.points == null || story.points === "") && ESTIMATES[story.id] != null) story.points = ESTIMATES[story.id];
      if ((!Array.isArray(story.tasks) || !story.tasks.length) && TASKS[story.id]) story.tasks = TASKS[story.id].slice();
      if (story.id === "US-S5" && story.tasks && story.tasks[0] === "Elenco dei 14 allergeni del Regolamento UE 1169/2011") {
        story.tasks = TASKS["US-S5"].slice();
      }
      if (story.id === "US-S1" && story.tasks && !story.tasks.includes("Allergene solo nelle tracce: giallo")) {
        const at = story.tasks.indexOf("Match tra profilo e piatto: rosso");
        const line = "Allergene solo nelle tracce: giallo";
        if (at >= 0) story.tasks.splice(at + 1, 0, line);
        else story.tasks.push(line);
      }
      if (story.id === "US-S1" && story.tasks && !story.tasks.includes("Un'allergia del profilo che il piatto non dichiara non diventa verde")) {
        const at = story.tasks.indexOf("Dati presenti e nessun match: verde");
        const line = "Un'allergia del profilo che il piatto non dichiara non diventa verde";
        if (at >= 0) story.tasks.splice(at + 1, 0, line);
        else story.tasks.push(line);
      }
      if (story.id === "US-S5" && Array.isArray(story.acceptance) && story.acceptance[0] === "Il profilo chiede solo le allergie") {
        story.acceptance[0] = "Il profilo chiede le allergie, anche oltre i 14";
      }
    });
    seed().stories.forEach((story) => {
      if (!raw.stories.some((item) => item.id === story.id)) raw.stories.push(story);
    });
    const scope = raw.stories.reduce((sum, story) => sum + Number(story.points || 0), 0);
    if (!Array.isArray(raw.history) || !raw.history.length) {
      raw.history = [{ scope, done: 0 }];
    } else if (raw.history.length === 1 && raw.history[0].scope === 0 && raw.history[0].done === 0 && scope > 0) {
      raw.history[0].scope = scope;
    }
    if (typeof raw.baseline !== "number") raw.baseline = null;
    const lastPoint = raw.history[raw.history.length - 1];
    if (lastPoint && lastPoint.scope !== scope) raw.history.push({ scope, done: lastPoint.done || 0 });
    assignPlan(raw.stories);
    raw.sprints.forEach((sprint) => {
      if (SPRINT_GOALS[sprint.id]) sprint.goal = SPRINT_GOALS[sprint.id];
    });
    if (raw.version < 16 || !Array.isArray(raw.board)) {
      raw.board = makeBoard(raw.stories, "end");
      raw.boardMoment = "end";
      raw.mode = "agile";
      raw.view = "kanban";
      raw.selectedCard = "US-S9-2";
      raw.selectedStory = "US-S9";
    } else {
      const fresh = makeBoard(raw.stories, raw.boardMoment === "start" ? "start" : "end");
      const kept = new Map(raw.board.map((card) => [card.id, card]));
      raw.board = fresh.map((card) => {
        const prev = kept.get(card.id);
        if (!prev) return card;
        return { ...card, column: prev.column, title: card.title };
      });
      raw.boardMoment = raw.boardMoment || "end";
      raw.selectedCard = raw.selectedCard || "";
    }
    if (!raw.wbs.some((node) => node.id === "w211")) {
      const at = raw.wbs.findIndex((node) => node.id === "w3");
      const leaves = infraLeaves();
      if (at >= 0) raw.wbs.splice(at, 0, ...leaves);
      else raw.wbs.push(...leaves);
    }
    if (raw.version < 18) applyInfraGantt(raw.wbs);
    if (raw.version < 20) {
      applyInfraGantt(raw.wbs);
      raw.wbs.forEach((node) => {
        if (["w1", "w11", "w12", "w13", "w2", "w21", "w22", "w23", "w24", "w211", "w212", "w213", "w214", "w221", "w222", "w231", "w232", "w233", "w241", "w242", "w3", "w31", "w32", "w33", "w34"].includes(node.id)) {
          node.done = true;
          node.progress = 1.0;
        } else if (node.id === "w4") {
          node.done = false;
          node.progress = 0.45;
        } else if (node.id === "w41") {
          node.done = false;
          node.progress = 0.45;
          node.status = "doing";
        } else if (node.id === "w6") {
          node.done = false;
          node.progress = 6 / 331;
        } else if (node.id === "w61") {
          node.done = false;
          node.progress = 0.1;
          node.status = "doing";
          node.cost = 331;
        }
        if (node.id === "w13") node.cost = 500;
      });
      raw.ganttScope = raw.ganttScope || "mid";
    }
    raw.version = 20;
    return raw;
  } catch (error) {
    return seed();
  }
}

function assignPlan(stories) {
  Object.entries(SPRINT_PLAN).forEach(([id, plan]) => {
    const story = stories.find((item) => item.id === id);
    if (!story) return;
    story.status = "sprint";
    story.sprint = plan[0];
    story.order = plan[1];
  });
  stories.forEach((story) => {
    if (SPRINT_PLAN[story.id] || !/^US-S\d+$/.test(story.id)) return;
    story.status = "backlog";
    story.sprint = "";
    story.order = 0;
  });
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function pushHistory() {
  const point = { scope: scopeOf(), done: doneOf() };
  const prev = state.history[state.history.length - 1];
  if (prev && prev.scope === point.scope && prev.done === point.done) return;
  state.history.push(point);
  if (state.history.length > 40) state.history.shift();
}

function apply(fn) {
  const beforeScope = scopeOf();
  const beforeDone = doneOf();
  state.notice = "";
  fn();
  if (scopeOf() !== beforeScope || doneOf() !== beforeDone) pushHistory();
  save();
}

function commit(fn) {
  apply(fn);
  render();
}

function priorityLabel(value) {
  return { alta: "Alta", media: "Media", bassa: "Bassa" }[value] || "Media";
}

function sortedStories() {
  const rank = { alta: 1, media: 2, bassa: 3 };
  return state.stories.slice().sort((a, b) => (rank[a.priority] || 2) - (rank[b.priority] || 2) || a.id.localeCompare(b.id));
}

function openSprint() {
  return state.sprints.find((sprint) => sprint.id === state.currentSprint) || state.sprints[0];
}

function shownSprint() {
  return state.sprints.find((sprint) => sprint.id === state.viewSprint) || openSprint();
}

function moveStory(id, dest) {
  commit(() => {
    const story = findStory(id);
    if (!story) return;
    if (dest === "backlog") {
      story.status = "backlog";
      story.sprint = "";
      story.order = 0;
      return;
    }
    const sprintId = state.viewSprint || "s1";
    const incoming = pointValue(story.points) || 0;
    const others = state.stories.filter((item) => item.id !== story.id && item.sprint === sprintId && item.status !== "backlog");
    const sum = others.reduce((total, item) => total + (pointValue(item.points) || 0), 0);
    if (sum + incoming > SPRINT_LIMIT) {
      state.notice = "Oltre 21 questa storia non entra. Fino a 21 resta intera, senza spezzarla in due giornate.";
      return;
    }
    story.sprint = sprintId;
    story.order = story.order || others.length + 1;
    story.status = dest === "sprint" ? "sprint" : dest;
  });
}

function addStory() {
  commit(() => {
    const id = uid("us");
    state.stories.push({
      id,
      persona: "cliente",
      want: "",
      so: "",
      name: "Nuova storia",
      points: null,
      priority: "media",
      status: "backlog",
      sprint: "",
      wbs: "",
      acceptance: []
    });
    state.selectedStory = id;
    state.mode = "agile";
    state.view = "backlog";
  });
}

function deleteStory(id) {
  commit(() => {
    state.stories = state.stories.filter((story) => story.id !== id);
    if (state.selectedStory === id) state.selectedStory = state.stories[0] ? state.stories[0].id : null;
  });
}

function addWbs() {
  commit(() => {
    const parentId = state.selectedWbs || null;
    const parent = parentId ? findWbs(parentId) : null;
    const kids = state.wbs.filter((node) => node.parent === parentId);
    const code = parent ? parent.code + "." + (kids.length + 1) : String(state.wbs.filter((node) => !node.parent).length + 1);
    const id = uid("w");
    state.wbs.push({
      id,
      parent: parentId,
      code,
      name: "Nuova voce",
      start: parent ? parent.start : ORIGIN,
      end: parent ? parent.end : HORIZON,
      milestone: false,
      done: false,
      depends: [],
      owner: "Matteo"
    });
    state.selectedWbs = id;
    state.mode = "predictive";
    state.view = "wbs";
  });
}

function deleteWbs(id) {
  commit(() => {
    if (kidsOf(id).length) {
      state.notice = "Questa voce ha dei figli. Togli prima quelli.";
      return;
    }
    state.wbs = state.wbs.filter((node) => node.id !== id);
    state.wbs.forEach((node) => {
      node.depends = node.depends.filter((dep) => dep !== id);
      if (Array.isArray(node.links)) node.links = node.links.filter((link) => link.id !== id);
    });
    state.stories.forEach((story) => {
      if (story.wbs === id) story.wbs = "";
    });
    if (state.selectedWbs === id) state.selectedWbs = state.wbs[0] ? state.wbs[0].id : null;
  });
}

function closeSprint() {
  commit(() => {
    const current = openSprint();
    state.stories.forEach((story) => {
      if (story.sprint === current.id && story.status !== "done") {
        story.status = "backlog";
        story.sprint = "";
      }
    });
    current.closed = true;
    const next = state.sprints.find((sprint) => !sprint.closed);
    if (next) {
      state.currentSprint = next.id;
      state.viewSprint = next.id;
    }
  });
}

function patchStory(id, field, input) {
  const story = findStory(id);
  if (!story) return;
  if (field === "priority") {
    story.priority = ["alta", "media", "bassa"].includes(input.value) ? input.value : "media";
    return;
  }
  if (field === "points") {
    const raw = String(input.value).trim();
    story.points = raw === "" ? null : Math.max(0, Number(raw) || 0);
    return;
  }
  if (field === "acceptance" || field === "tasks") {
    story[field] = input.value.split("\n").map((line) => line.trim()).filter(Boolean);
    return;
  }
  if (field === "status") {
    story.status = input.value;
    if (story.status === "backlog") story.sprint = "";
    else if (!story.sprint) story.sprint = state.currentSprint;
    return;
  }
  story[field] = input.value;
}

function patchWbs(id, field, input) {
  const node = findWbs(id);
  if (!node) return;
  if (field === "milestone" || field === "done") {
    node[field] = input.checked;
    return;
  }
  if (field === "depends") {
    const links = [];
    input.value.split(",").map((part) => part.trim()).filter(Boolean).forEach((part) => {
      const bits = part.split(/\s+/);
      const type = (bits[1] || "FS").toUpperCase();
      const pred = state.wbs.find((item) => item.code === bits[0]);
      if (!pred || !["FS", "SS", "FF", "SF"].includes(type)) return;
      const prev = (node.links || []).find((link) => link.id === pred.id && link.type === type);
      links.push({ id: pred.id, type, lag: 0, why: prev ? prev.why : "" });
    });
    node.links = links;
    node.depends = links.map((link) => link.id);
    return;
  }
  if (field === "days" || field === "cost") {
    const raw = String(input.value).trim().replace(",", ".");
    node[field] = raw === "" ? null : Math.max(0, Number(raw) || 0);
    return;
  }
  node[field] = input.value;
  if (field === "start" || field === "end") node.looseEnd = false;
  if (node.end < node.start) node.end = node.start;
}

function onClick(event) {
  const button = event.target.closest("[data-act]");
  if (!button) return;
  const act = button.dataset.act;
  const id = button.dataset.id;
  if (act === "mode") {
    commit(() => {
      state.mode = button.dataset.mode;
      state.view = state.mode === "agile" ? "backlog" : "wbs";
    });
  } else if (act === "view") {
    commit(() => { state.view = button.dataset.view; });
  } else if (act === "sprint") {
    commit(() => {
      state.viewSprint = id;
      state.view = "sprint";
      state.mode = "agile";
    });
  } else if (act === "close-brief") {
    document.getElementById("brief").close();
  } else if (act === "select-story") {
    commit(() => { state.selectedStory = id; });
    openBrief(id);
  } else if (act === "select-card") {
    const cardId = button.dataset.card;
    commit(() => {
      state.selectedCard = cardId;
      state.selectedStory = id;
      state.mode = "agile";
    });
  } else if (act === "board-moment") {
    const moment = button.dataset.moment === "start" ? "start" : "end";
    commit(() => {
      state.board = makeBoard(state.stories, moment);
      state.boardMoment = moment;
      state.mode = "agile";
      if (state.view !== "charts") state.view = "kanban";
    });
  } else if (act === "select-wbs") {
    commit(() => {
      state.selectedWbs = id;
      state.mode = "predictive";
    });
  } else if (act === "add-story") {
    addStory();
  } else if (act === "delete-story") {
    deleteStory(id);
  } else if (act === "add-wbs") {
    addWbs();
  } else if (act === "delete-wbs") {
    deleteWbs(id);
  } else if (act === "set-evm-scenario") {
    commit(() => {
      state.evmScenario = button.dataset.scenario;
    });
  } else if (act === "select-evm-wbs") {
    commit(() => {
      state.selectedEvmWbs = id;
    });
  } else if (act === "gantt-scope") {
    commit(() => {
      state.ganttScope = button.dataset.scope;
    });
  }
}

function onChange(event) {
  const input = event.target;
  if (input.dataset.acceptance != null) {
    apply(() => patchStory(input.dataset.acceptance, "acceptance", input));
  } else if (input.dataset.tasks != null) {
    apply(() => patchStory(input.dataset.tasks, "tasks", input));
  } else if (input.dataset.field && state.selectedStory) {
    apply(() => patchStory(state.selectedStory, input.dataset.field, input));
  } else if (input.dataset.wfield && state.selectedWbs) {
    apply(() => patchWbs(state.selectedWbs, input.dataset.wfield, input));
  } else if (input.dataset.evmfield) {
    commit(() => {
      if (!state.customEvm) state.customEvm = {};
      state.customEvm[input.dataset.evmfield] = Number(input.value) || 0;
      state.evmScenario = "custom";
    });
  } else {
    return;
  }
  setTimeout(render, 0);
}

function onDragStart(event) {
  if (event.target.closest(".pts")) {
    event.preventDefault();
    return;
  }
  const card = event.target.closest("[data-card]");
  if (card) {
    event.dataTransfer.setData("text/plain", "card:" + card.dataset.card);
    event.dataTransfer.effectAllowed = "move";
    return;
  }
  const row = event.target.closest("[data-story]");
  if (!row) return;
  event.dataTransfer.setData("text/plain", row.dataset.story);
  event.dataTransfer.effectAllowed = "move";
}

function onDragOver(event) {
  const zone = event.target.closest("[data-drop]");
  if (!zone) return;
  event.preventDefault();
  zone.classList.add("over");
}

function onDragLeave(event) {
  const zone = event.target.closest("[data-drop]");
  if (zone) zone.classList.remove("over");
}

function moveCard(id, column) {
  if (!BOARD_COLUMNS.some((item) => item[0] === column)) return;
  commit(() => {
    const card = (state.board || []).find((item) => item.id === id);
    if (!card || card.column === column) return;
    card.column = column;
    state.boardMoment = "custom";
    state.selectedCard = id;
    state.selectedStory = card.storyId;
  });
}

function onDrop(event) {
  const zone = event.target.closest("[data-drop]");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("over");
  const id = event.dataTransfer.getData("text/plain");
  if (!id) return;
  if (id.startsWith("card:")) moveCard(id.slice(5), zone.dataset.drop);
  else moveStory(id, zone.dataset.drop);
}

function navButton(view, num, label) {
  const on = state.view === view;
  return `<button type="button" data-act="view" data-view="${view}" ${on ? 'aria-current="true"' : ""}><i>${num}</i><span>${label}</span></button>`;
}

const TECH = {
  "US-S8": [
    { dove: "Expo · costante unica", cosa: "Un solo export. Menù e scheda piatto importano FRASE. Due stringhe letterali uguali in due file sono un errore: al cambio se ne aggiorna una sola.", codice: "export const FRASE =\n  \"idoneo secondo i dati dichiarati dal locale\";" },
    { dove: "Expo · filtro prima del render", cosa: "Normalizza in minuscolo e senza accenti. Se il testo del piatto contiene una delle tre sequenze, quel nodo non si monta. Al suo posto si monta solo FRASE.", codice: "const VIETATE = [\"sicuro\", \"zero rischi\", \"privo di allergeni\"];\nfunction testoVisibile(raw) {\n  const n = raw.toLowerCase().normalize(\"NFD\").replace(/\\p{M}/gu, \"\");\n  return VIETATE.some((w) => n.includes(w)) ? FRASE : raw;\n}" },
    { dove: "FastAPI · GET pubblica", cosa: "GET /m/{locale_id} non ha Depends(get_current_user). Status 200 anche con Authorization assente. Il JSON non include le tre sequenze: se un nome piatto le contiene, il campo esce come null e l'app mostra FRASE.", codice: "GET /m/{locale_id}\n200 { \"locale\": {\"id\", \"nome\"}, \"piatti\": [...] }\n401 non si usa su questa route" },
    { dove: "Prova", cosa: "Senza token, apri /m/{locale_id} e la scheda. Nel testo del DOM cerca sicuro, zero rischi, privo di allergeni: zero match. FRASE c'è due volte, menù e piatto, dallo stesso import." }
  ],
  "US-S5": [
    { dove: "Expo · 14 id fissi", cosa: "Gli interruttori usano gli stessi VARCHAR della tabella allergeni. Seed MySQL e lista Expo sono la stessa tupla, nello stesso ordine. Il locale non può aggiungere un quindicesimo id.", codice: "ALLERGENI = (\n  \"glutine\", \"crostacei\", \"uova\", \"pesce\",\n  \"arachidi\", \"soia\", \"latte\", \"frutta_guscio\",\n  \"sedano\", \"senape\", \"sesamo\", \"solfiti\",\n  \"lupini\", \"molluschi\"\n)" },
    { dove: "Expo · extra[]", cosa: "Campo testo «Altra allergia». onSubmit fa trim, scarta la stringa vuota e le duplica case-insensitive, poi push su extra. Non è una colonna clinica e non ha un id in allergeni.", codice: "type Profilo = { ids: AllergeneId[]; extra: string[] };" },
    { dove: "Expo · niente file", cosa: "La schermata non monta ImagePicker, DocumentPicker, input file, né una route di upload. Un referto non ha un campo dove finire." },
    { dove: "SecureStore, non MySQL", cosa: "L'elenco è dato dell'articolo 9. Non esiste la tabella profili_allergie. Nessuna POST /profilo. Si persiste solo sul telefono.", codice: "SecureStore.setItemAsync(\n  \"allertgy.profilo\",\n  JSON.stringify({ ids, extra })\n);" },
    { dove: "Contratto verso colore()", cosa: "leggiProfilo() ritorna solo { ids, extra }. Se la chiave manca, ritorna { ids: [], extra: [] }. Non ritorna nome, email, uri di un file." }
  ],
  "US-S9": [
    { dove: "Tre env, tre DATABASE_URL", cosa: "sviluppo, staging e beta sono tre processi. Ognuno legge il proprio file. APP_ENV è il selettore. Il file di sviluppo non contiene l'hostname del database di beta.", codice: "APP_ENV=sviluppo|staging|beta\nDATABASE_URL=mysql://user:pass@127.0.0.1:3306/allertgy_sviluppo\nDATABASE_URL=mysql://user:pass@127.0.0.1:3306/allertgy_staging\nDATABASE_URL=mysql://user:pass@127.0.0.1:3306/allertgy_beta" },
    { dove: "MySQL · tre schema", cosa: "Tre database sul VPS. Stesso DDL, dati diversi. Un INSERT in allertgy_sviluppo non è visibile con USE allertgy_beta.", codice: "CREATE DATABASE allertgy_sviluppo;\nCREATE DATABASE allertgy_staging;\nCREATE DATABASE allertgy_beta;" },
    { dove: "Tre host", cosa: "Tre vhost. Il processo di beta serve solo la build il cui APP_ENV è beta. Una build di sviluppo puntata al vhost di beta non parte: all'avvio si confronta APP_ENV con il nome del vhost e si esce." },
    { dove: "Deploy di staging", cosa: "Lo script di staging esporta solo il DATABASE_URL di allertgy_staging. Prova: INSERT di un piatto con id fisso in staging, SELECT dello stesso id in beta, zero righe." }
  ],
  "US-S10": [
    { dove: "Quattro pezzi, un invio", cosa: "Il pacchetto è un solo PDF o un solo markdown con quattro sezioni, in quest'ordine: privacy, termini, FRASE, articolo 9. Privacy dice quali dati, la finalità, la conservazione. Le allergie non sono tra i dati del server.", codice: "1. privacy — account locale e menù in MySQL; allergie no\n2. termini — nessuna promessa di assenza di reazione\n3. disclaimer — il valore di FRASE, importato\n4. art. 9 — il JSON {ids, extra} resta su SecureStore" },
    { dove: "Stessa costante", cosa: "La sezione 3 non è riscritta a mano. Si genera leggendo export FRASE. Se il testo del pacchetto e la costante divergono, l'invio non parte." },
    { dove: "Prima della route pubblica", cosa: "Finché l'invio allo studio non ha una data archiviata, POST /auth/registrazione risponde 403. La route esiste, il corpo non crea righe in account." }
  ],
  "US-S11": [
    { dove: "FastAPI · APP_ENV=beta", cosa: "POST /auth/registrazione risponde 403 con un corpo fisso. Non esegue INSERT in account. GET della schermata di iscrizione non è montata nel router di beta.", codice: "if settings.app_env == \"beta\":\n    raise HTTPException(403, \"registrazione chiusa\")" },
    { dove: "Expo · nessun pagamento", cosa: "Nella build di beta non ci sono schermate con 9,00 €, 19,90 €, 39,90 €, né il boost da 9,90 €, né Stripe. Nessun import di @stripe. Il paywall del dopo non è in questo bundle." }
  ],
  "US-S2": [
    { dove: "JWT · locale_id", cosa: "Il token del ristoratore ha il claim locale_id. Ogni query filtra su quel valore. Se il path o il body portano un altro id, la risposta è 404 e il body è vuoto: non si conferma che l'altro locale esiste.", codice: "if piatto.locale_id != token.locale_id:\n    raise HTTPException(404)" },
    { dove: "POST e PUT /piatti", cosa: "nome è obbligatorio, VARCHAR(160), stringa vuota rifiutata con 422. Gli id allergene, se presenti, devono stare in ALLERGENI. Un id sconosciuto è 422.", codice: "class PiattoIn(BaseModel):\n    nome: str = Field(min_length=1, max_length=160)\n    locale_id: str\n    allergeni: list[AllergeneIn] = []" },
    { dove: "UPDATE, non un secondo INSERT", cosa: "PUT /piatti/{id} fa UPDATE sulla riga con quella primary key. Se l'id non è del locale del token, 404. Il secondo salvataggio non aumenta COUNT(*) dei piatti di quel locale." },
    { dove: "completo default 0", cosa: "La colonna nasce a 0. Resta 0 finché il client non manda completo: 1 nel body di Salva. Una checkbox mai toccata non si traduce in una riga «assente»: l'assenza di riga in piatto_allergeni si legge solo a completo = 1." }
  ],
  "US-S3": [
    { dove: "MySQL · enum e chiave", cosa: "dove accetta solo due valori. La primary key è (piatto_id, allergene_id): lo stesso allergene non può avere due righe, quindi non può stare insieme in ingredienti e tracce.", codice: "CREATE TABLE piatto_allergeni (\n  piatto_id CHAR(36) NOT NULL,\n  allergene_id VARCHAR(32) NOT NULL,\n  dove ENUM('ingredienti','tracce') NOT NULL,\n  PRIMARY KEY (piatto_id, allergene_id),\n  FOREIGN KEY (piatto_id) REFERENCES piatti(id),\n  FOREIGN KEY (allergene_id) REFERENCES allergeni(id)\n);" },
    { dove: "Due scritture", cosa: "Il form ha due gruppi di 14 checkbox. Salvare le tracce fa INSERT/DELETE solo sulle righe con dove = 'tracce'. Non tocca le righe ingredienti, tranne il caso del punto dopo." },
    { dove: "Se diventa ingrediente", cosa: "Mettere allergene_id negli ingredienti fa UPSERT con dove = 'ingredienti'. La eventuale riga tracce dello stesso id sparisce perché la primary key è una sola." },
    { dove: "Chi ha confermato", cosa: "Alla conferma si scrivono due colonne e l'app le mostra sulla scheda, lette dal GET, non solo tenute in memoria.", codice: "piatti.confermato_da VARCHAR(120) NOT NULL\npiatti.confermato_il DATETIME NOT NULL\n-- mostrati come \"Confermato da {nome}, {data}\"" }
  ],
  "US-S12": [
    { dove: "Solo il dominio", cosa: "Il certificato sta sul dominio. Uvicorn è dietro il proxy del VPS. QR e baseURL dell'app Expo sono https://{dominio}. Nessun IP nudo, nessuna porta pubblica in HTTP.", codice: "EXPO_PUBLIC_API=https://{dominio}" },
    { dove: "HTTP non porta i piatti", cosa: "Il vhost :80 risponde 301 verso https. Il body del 301 è vuoto. Non c'è un secondo server FastAPI in ascolto su 80 che serializzi i piatti.", codice: "curl -sI http://{dominio}/m/{locale_id}\nHTTP/1.1 301\nLocation: https://{dominio}/m/{locale_id}" },
    { dove: "Prova incrociata", cosa: "GET http non contiene la chiave \"piatti\". GET https con il token del locale, su una route autenticata, la contiene. La GET pubblica /m/{locale_id} risponde 200 solo in HTTPS." }
  ],
  "US-S13": [
    { dove: "Dump di beta, stesso lavoro del restore", cosa: "Un solo script. Prima scrive il dump, poi lo ripristina su staging, poi fa la SELECT di controllo. Non sono due storie e non sono due lanci manuali staccati.", codice: "mysqldump allertgy_beta > /var/backups/allertgy_beta_YYYYMMDD.sql\nmysql allertgy_staging < /var/backups/allertgy_beta_YYYYMMDD.sql" },
    { dove: "File fuori dal web", cosa: "Il percorso è /var/backups, non la directory che FastAPI monta come static. Un GET su qualsiasi path dell'API non restituisce il .sql. Prova: curl dell'URL indovinato dà 404." },
    { dove: "Verbale", cosa: "Lo script appende una riga: data ora ISO, chi (utente di sistema), esito ok o ko, id del piatto cercato. Il ripristino è su allertgy_staging. allertgy_beta non viene sovrascritta.", codice: "2026-12-01T09:00:00Z matteo ok piatto=..." },
    { dove: "SELECT di controllo", cosa: "Dopo il restore, SELECT id, nome FROM piatti WHERE id = '{id noto}'. Zero righe: esito ko e lo script esce con codice diverso da 0. Una riga: esito ok." }
  ],
  "US-S1": [
    { dove: "Expo · la funzione già scritta", cosa: "Si modifica colore(), non se ne aggiunge un'altra. Ritorna uno di quattro valori e si ferma al primo if vero. Il chiamante non ricalcola.", codice: "type Colore = \"rosso\" | \"giallo\" | \"verde\" | null;\nfunction colore(profilo: Profilo, piatto: Piatto): Colore" },
    { dove: "null, primo e secondo caso", cosa: "Profilo senza scelte, oppure piatto non chiuso. null non ha una classe CSS verde e non ha un colore di ripiego.", codice: "if (profilo.ids.length === 0 && profilo.extra.length === 0) return null;\nif (piatto.completo !== 1) return null;" },
    { dove: "extra fuori dai 14", cosa: "Il piatto dichiara solo gli id di allergeni. Una stringa in extra non ha colonna. Il confronto non può dire verde.", codice: "if (profilo.extra.some((x) => !ALLERGENI.includes(x))) return null;" },
    { dove: "rosso, poi giallo, poi verde", cosa: "L'ordine è fisso. Un id presente sia come ingrediente sia come traccia non esiste: la primary key di piatto_allergeni lo impedisce. Se è ingrediente, è rosso e il giallo non si valuta.", codice: "const ing = idsDove(piatto, \"ingredienti\");\nconst tr = idsDove(piatto, \"tracce\");\nif (profilo.ids.some((id) => ing.includes(id))) return \"rosso\";\nif (profilo.ids.some((id) => tr.includes(id))) return \"giallo\";\nreturn \"verde\";" },
    { dove: "Scheda", cosa: "La scheda monta il valore ritornato e, sotto, FRASE importata. Quattro assert: completo 0 → null; glutine in ingredienti → rosso; glutine solo in tracce → giallo; glutine assente e completo 1 → verde." }
  ],
  "US-S14": [
    { dove: "Una riga dal ritorno", cosa: "Sotto il pallino, un solo Text. La stringa esce da una mappa sul valore di colore(). Non c'è un campo motivo editabile sulla scheda e non c'è una colonna motivo in piatti.", codice: "const PERCHE = {\n  rosso: \"questo allergene è negli ingredienti\",\n  giallo: \"è solo nelle tracce\",\n  verde: \"nei dati del locale non risulta\"\n};" },
    { dove: "null non monta la riga", cosa: "Se colore() è null, PERCHE non si indicizza e il componente ritorna null. Non si mostra la frase del verde e non si mostra un trattino al posto del colore." }
  ],
  "US-S15": [
    { dove: "Quattro casi, fixture esplicite", cosa: "I test chiamano colore() con oggetti in memoria. Non passano dal database. Ogni caso fissa completo, gli ids del profilo e le righe dove.", codice: "completo 0, ids [glutine]            -> null\nglutine in ingredienti            -> rosso\nglutine solo in tracce            -> giallo\ncompleto 1, nessun id in comune   -> verde" },
    { dove: "Il verde ha completo 1", cosa: "La fixture verde ha completo: 1 e allergeni che non intersecano ids. Una fixture con completo: 0 non è annotata come verde atteso." },
    { dove: "Il deploy di beta dipende dai test", cosa: "Lo script di beta lancia il test di colore prima di riavviare uvicorn. Exit code diverso da 0: il processo di beta non viene sostituito e resta la build precedente." }
  ],
  "US-S16": [
    { dove: "Env di beta senza segreti di servizio", cosa: "Nel file di beta le chiavi non ci sono, non sono stringa vuota da leggere. Settings non ha campi stripe_key né ai_key quando APP_ENV è beta. Un import del client AI nel processo di beta è un errore di avvio.", codice: "APP_ENV=beta\n# assenti: STRIPE_SECRET_KEY, AI_API_KEY" },
    { dove: "Niente seed dimostrativo", cosa: "seed_demo() ritorna subito se APP_ENV == beta. Non inserisce locali finti né piatti finti. Il primo SELECT dei piatti del pilota, a database vuoto, dà zero righe." }
  ],
  "US-S17": [
    { dove: "MySQL · locali", cosa: "id è la chiave che useranno piatti e QR. nome non accetta NULL né stringa vuota: il CHECK o la validazione Pydantic rifiuta nome \"\".", codice: "CREATE TABLE locali (\n  id CHAR(36) PRIMARY KEY,\n  nome VARCHAR(120) NOT NULL\n);" },
    { dove: "FK obbligatoria", cosa: "piatti.locale_id è NOT NULL e FOREIGN KEY verso locali.id. INSERT di un piatto senza locale_id fallisce. Il QR non ha un altro identificatore: codifica solo questo id.", codice: "locale_id CHAR(36) NOT NULL,\nFOREIGN KEY (locale_id) REFERENCES locali(id)" },
    { dove: "Testa della GET pubblica", cosa: "La risposta mette il nome prima dell'array. L'app Expo lo disegna come titolo, sopra la lista. Se il locale non esiste, 404 e piatti non c'è.", codice: "GET /m/{locale_id}\n200 { \"locale\": {\"id\", \"nome\"}, \"piatti\": [ ... ] }" }
  ],
  "US-S18": [
    { dove: "POST /piatti/{id}/pubblica", cosa: "Richiede il Bearer del ristoratore. locale_id del piatto deve essere quello del token, altrimenti 404. Non è una route pubblica.", codice: "POST /piatti/{id}/pubblica\nAuthorization: Bearer {token}\n404 se token.locale_id != piatti.locale_id" },
    { dove: "Filtro della sala", cosa: "La GET pubblica tiene solo le righe che soddisfano entrambi i flag. Una bozza salvata resta in MySQL e non entra nell'array.", codice: "SELECT * FROM piatti\nWHERE locale_id = :id\n  AND pubblicato = 1\n  AND completo = 1;" },
    { dove: "POST /piatti/{id}/ritira", cosa: "Mette pubblicato = 0. Non fa DELETE. La riga, gli allergeni, confermato_da e confermato_il restano. La GET pubblica, subito dopo, non contiene più quell'id." }
  ],
  "US-S19": [
    { dove: "Pubblica rifiuta completo 0", cosa: "Se completo è 0, POST /piatti/{id}/pubblica risponde 409 e non esegue l'UPDATE. pubblicato resta com'era.", codice: "if piatto.completo != 1:\n    raise HTTPException(409, \"piatto incompleto\")" },
    { dove: "Stesso UPDATE", cosa: "PUT /piatti/{id} con completo: 0, su una riga che aveva pubblicato = 1, scrive le due colonne nella stessa istruzione. Non c'è un job che ci passa dopo.", codice: "UPDATE piatti\nSET completo = 0, pubblicato = 0\nWHERE id = :id AND locale_id = :locale_id;" },
    { dove: "colore() resta null", cosa: "Con completo 0 la funzione esce al secondo if e ritorna null. La scheda in sala non riceve quel piatto, perché la GET pubblica lo ha già escluso. Nel libro del ristoratore il pallino non usa la classe verde." }
  ],
  "US-S7": [
    { dove: "Payload del QR", cosa: "Una sola stringa, l'URL assoluto del dominio. Niente query, niente token, niente id di un altro locale.", codice: "https://{dominio}/m/{locale_id}" },
    { dove: "GET senza sessione", cosa: "La route non legge Authorization. Senza header risponde 200 se il locale esiste, 404 se l'id non è in locali. Non risponde 401." },
    { dove: "Id diverso", cosa: "GET /m/{altro} filtra WHERE locale_id = altro. I piatti di questo locale non sono nel JSON. Se l'altro id non esiste, 404, non il menù di questo." },
    { dove: "Stampa", cosa: "Il pulsante nell'app del ristoratore genera il QR da quella stringa e lo manda al foglio. Non stampa un PNG messo negli asset." }
  ],
  "US-S4": [
    { dove: "Ordine nella scheda", cosa: "Il pallino è nel primo render della scheda piatto. Il pulsante «chiedi in sala» sta sotto e non è la condizione per montare il colore.", codice: "<Colore value={colore(profilo, piatto)} />\n<ConfermaAlTavolo />" },
    { dove: "Conferma al tavolo", cosa: "onPress segna solo che la sala ha visto la richiesta. Non chiama colore() e non scrive su piatti. Il value del pallino resta quello del render precedente." },
    { dove: "Nessun setter del colore", cosa: "Non esiste un controllo con tre opzioni rosso, giallo, verde. L'unica assegnazione del pallino è il ritorno di colore(profilo, piatto)." }
  ],
  "US-S6": [
    { dove: "Una chiave, un profilo", cosa: "SecureStore ha una sola chiave allertgy.profilo. Non c'è allertgy.profili[] e non c'è un profiloId attivo da scegliere a tavola.", codice: "SecureStore.getItemAsync(\"allertgy.profilo\")" },
    { dove: "Argomento di colore()", cosa: "Il chiamante passa l'oggetto letto da quella chiave. Il dispositivo di chi guarda, se è un altro telefono, apre lo stesso profilo già condiviso a schermo: non legge un secondo SecureStore e non lo passa alla funzione." },
    { dove: "Familiare senza allergie", cosa: "Un profilo vuoto di chi guarda non entra nel calcolo. Se il profilo attivo ha ids, il risultato resta rosso, giallo o verde di quegli ids. Non si forza verde perché lo spettatore non ha allergie." },
    { dove: "Niente OR", cosa: "Non esiste una funzione che unisca due Profilo. colore() riceve un solo argomento profilo. Un ids concatenato di due persone è un bug." }
  ]
};
function pointsButton(story) {
  const points = pointValue(story.points);
  if (points == null) return "";
  return esc(points);
}

function briefHtml(storyId) {
  const story = findStory(storyId);
  if (!story) return "";
  const steps = TECH[story.id] || [];
  const items = steps.length
    ? steps.map((step, index) => {
        const dove = typeof step === "string" ? "" : `<strong>${esc(step.dove)}</strong>`;
        const cosa = typeof step === "string" ? step : step.cosa;
        const code = step.codice ? `<pre>${esc(step.codice)}</pre>` : "";
        return `<li><b>${index + 1}</b><div>${dove}<p>${esc(cosa)}</p>${code}</div></li>`;
      }).join("")
    : `<li><b>–</b><p>Per questa storia non ci sono ancora attività tecniche.</p></li>`;
  const points = pointValue(story.points);
  return `
    <div class="brief-head">
      <p class="kicker"><b>Attività tecniche</b> ${esc(points == null ? "" : points + " story point")}</p>
      <button type="button" class="act" data-act="close-brief">Chiudi</button>
    </div>
    <h2>${esc(story.name || "Storia")}</h2>
    <p class="brief-story">${storyFormula(story)}</p>
    <p class="meta">Expo sull'app. FastAPI sul VPS. MySQL. QR e app passano solo dal dominio in HTTPS. Il confronto già scritto non si riscrive.</p>
    <ol class="steps">${items}</ol>
  `;
}

function openBrief(id) {
  const dialog = document.getElementById("brief");
  if (!dialog) return;
  dialog.innerHTML = briefHtml(id);
  if (!dialog.open) dialog.showModal();
}

function sprintPick() {
  const shown = state.sprints.filter((item) => ["s1", "s2", "s3", "s4"].includes(item.id));
  return `<nav class="sprint-pick" aria-label="Sprint">${shown.map((item) => {
    const points = sprintPoints(sprintStories(item));
    const on = state.viewSprint === item.id;
    return `<button type="button" data-act="sprint" data-id="${item.id}" ${on ? 'aria-current="true"' : ""}><span>${esc(item.name)}</span><em>${points}/${CAPACITY}</em></button>`;
  }).join("")}</nav>`;
}

function railHtml() {
  const agile = state.mode === "agile";
  return `
    <a class="brand" href="index.html" aria-label="AllerTgy, torna al pitch"><img src="assets/wordmark-dark.png" alt="" width="923" height="272"></a>
    <div class="modes">
      <button type="button" data-act="mode" data-mode="agile" ${agile ? 'aria-current="true"' : ""}>Agile · Scrum</button>
      <button type="button" data-act="mode" data-mode="predictive" ${agile ? "" : 'aria-current="true"'}>Predittiva</button>
    </div>
    <nav aria-label="Viste del piano">
      ${agile
        ? navButton("backlog", "01", "Backlog") + navButton("sprint", "02", "Sprint") + navButton("kanban", "03", "Kanban") + navButton("charts", "04", "Avanzamento")
        : navButton("wbs", "04", "WBS") + navButton("gantt", "05", "Gantt") + navButton("raci", "06", "RACI") + navButton("costi", "07", "Costi & EVM")}
    </nav>
    <p class="rail-links"><a href="index.html">Pitch</a><a href="index.html#lavoro">Fasi</a></p>
  `;
}

function storyRow(story) {
  const open = state.selectedStory === story.id;
  const on = open ? " is-on" : "";
  const done = story.status === "done" ? " is-done" : "";
  return `<div class="entry">
    <div role="button" tabindex="0" class="row${on}${done}" draggable="true" data-story="${story.id}" data-act="select-story" data-id="${story.id}">
      <span><strong>${esc(story.name || "")}</strong>${storyFormula(story)}</span>
      <b>${esc(priorityLabel(story.priority))}</b>
      <em>${pointsButton(story)}</em>
    </div>
  </div>`;
}

function sprintName(id) {
  const sprint = state.sprints.find((item) => item.id === id);
  return sprint ? sprint.name : "Backlog";
}

function backlogRow(story) {
  const open = state.selectedStory === story.id;
  return `<div class="entry">
    <div role="button" tabindex="0" class="row${open ? " is-on" : ""}" draggable="true" data-story="${story.id}" data-act="select-story" data-id="${story.id}">
      <span><strong>${esc(story.name || "")}</strong>${storyFormula(story)}</span>
      <b>${esc(sprintName(story.sprint))}</b>
      <em>${pointsButton(story)}</em>
    </div>
  </div>`;
}

function backlogHtml() {
  const open = state.stories
    .filter((story) => story.status !== "done")
    .sort((a, b) => {
      const as = sprintIndex(a.sprint);
      const bs = sprintIndex(b.sprint);
      return (as < 0 ? 99 : as) - (bs < 0 ? 99 : bs) || (a.order || 99) - (b.order || 99) || a.id.localeCompare(b.id);
    });
  const done = state.stories.filter((story) => story.status === "done");
  return `
    <p class="kicker"><b>01</b> Agile · Scrum</p>
    <h1>Product backlog</h1>
    <p class="lede">Tutte le storie. La colonna sprint dice in quale delle quattro entrano.</p>
    <div class="table-head"><span>User story</span><span>Sprint</span><span>Story point</span></div>
    <div class="list" data-drop="backlog">${open.map(backlogRow).join("")}</div>
    ${done.length ? `<h2 class="sub">Fatto</h2><div class="list">${done.map(backlogRow).join("")}</div>` : ""}
    <p class="actions"><button type="button" class="act" data-act="add-story">Aggiungi una storia</button></p>
  `;
}

function sprintStories(sprint) {
  if (!sprint) return [];
  return state.stories
    .filter((story) => story.sprint === sprint.id && story.status !== "backlog")
    .sort((a, b) => (a.order || 99) - (b.order || 99) || a.id.localeCompare(b.id));
}

function sprintPoints(list) {
  return list.reduce((sum, story) => sum + (pointValue(story.points) || 0), 0);
}

function taskList(story) {
  const items = (TECH[story.id] && TECH[story.id].length) ? TECH[story.id] : (story.tasks || []);
  if (!items.length) return "";
  return `<ol class="steps">${items.map((task, index) => `<li><b>${index + 1}</b><p>${esc(task)}</p></li>`).join("")}</ol>`;
}

function sprintRow(story, index) {
  const open = state.selectedStory === story.id;
  const why = WHY[story.id] ? `<p class="why">${esc(WHY[story.id])}</p>` : "";
  return `<div class="entry">
    <div role="button" tabindex="0" class="row${open ? " is-on" : ""}" draggable="true" data-story="${story.id}" data-act="select-story" data-id="${story.id}">
      <span><strong>${index + 1}. ${esc(story.name || "")}</strong>${storyFormula(story)}${why}</span>
      <b>${esc(priorityLabel(story.priority))}</b>
      <em>${pointsButton(story)}</em>
    </div>
  </div>`;
}

function sprintHtml() {
  const shown = state.sprints.filter((item) => ["s1", "s2", "s3", "s4"].includes(item.id));
  const sprint = shown.find((item) => item.id === state.viewSprint) || shown[0];
  const chosen = sprintStories(sprint);
  const taken = sprintPoints(chosen);
  const intro = `<p class="lede">${esc(sprint.goal || "")}</p>`;
  const ceiling = taken > CAPACITY
    ? `<p class="note">${taken} story point. Il tetto è 20. Si arriva a 21 per non spezzare la storia in due giornate.</p>`
    : "";
  const empty = chosen.length ? "" : `<p class="empty">Nessuna user story in questo sprint.</p>`;
  return `
    ${sprintPick()}
    <p class="kicker"><b>02</b> Sprint backlog · ${esc(labelSpan())}</p>
    <h1>${esc(sprint.name)}</h1>
    ${intro}
    ${ceiling}
    <div class="table-head"><span>Ordine nello sprint</span><span>Priorità</span><span>Story point</span></div>
    <div class="list" data-drop="sprint">${chosen.map(sprintRow).join("")}</div>
    ${empty}
  `;
}

function looseSpan(node) {
  const span = spanOf(node);
  const loose = node.looseEnd || kidsOf(node.id).some((kid) => looseSpan(kid).loose);
  return { start: span.start, end: span.end, loose: !!loose && span.end >= "2027-01-31" };
}

function formatAmount(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return String(rounded).replace(".", ",");
}

function formatDays(value) {
  return formatAmount(value) + " g";
}

function formatEuro(value) {
  return formatAmount(value) + " €";
}

function effortOf(node) {
  const kids = kidsOf(node.id);
  if (!kids.length) {
    const known = node.days != null || node.cost != null;
    return { days: Number(node.days) || 0, cost: Number(node.cost) || 0, known };
  }
  const parts = kids.map(effortOf);
  return {
    days: parts.reduce((sum, part) => sum + part.days, 0),
    cost: parts.reduce((sum, part) => sum + part.cost, 0),
    known: parts.some((part) => part.known)
  };
}

function wbsRow(entry) {
  const span = looseSpan(entry.node);
  const effort = effortOf(entry.node);
  const on = state.selectedWbs === entry.node.id ? " is-on" : "";
  const mark = entry.node.milestone ? " ◆" : "";
  const who = entry.node.days != null ? `<small class="who">${esc(entry.node.owner)}</small>` : "";
  const days = effort.known ? esc(formatDays(effort.days)) : "";
  const cost = effort.known ? esc(formatEuro(effort.cost)) : "";
  return `<button type="button" class="wrow${on}" data-act="select-wbs" data-id="${entry.node.id}" style="--d:${entry.depth}" title="${esc(labelSpan(span.start, span.end, span.loose))}">
    <b>${esc(entry.node.code)}</b>
    <span>${esc(entry.node.name)}${mark}${who}</span>
    <em class="num">${days}</em>
    <em class="num">${cost}</em>
  </button>`;
}

function nodeBox(node, leaf) {
  const effort = leaf ? null : effortOf(node);
  const days = effort ? effort.days : node.days;
  const cost = effort ? effort.cost : node.cost;
  const known = effort ? effort.known : days != null || cost != null;
  const meta = known ? formatDays(days || 0) + " · " + formatEuro(cost || 0) : "";
  const on = state.selectedWbs === node.id ? " is-on" : "";
  const who = leaf && node.owner ? `<small>${esc(node.owner)}</small>` : "";
  return `<button type="button" class="node${on}" data-act="select-wbs" data-id="${node.id}">
    <b>${esc(node.code)}</b>
    <strong>${esc(node.name)}</strong>
    ${meta ? `<em>${esc(meta)}</em>` : ""}
    ${who}
  </button>`;
}

function infraChartHtml() {
  const root = findWbs("w2");
  const packages = kidsOf("w2");
  if (!root || !packages.length) return "";
  const columns = packages.map((node) => {
    const kids = kidsOf(node.id).map((kid) => nodeBox(kid, true)).join("");
    return `<div class="wbs-col">${nodeBox(node, false)}<div class="wbs-kids">${kids}</div></div>`;
  }).join("");
  return `
    <h2 class="sub">Diagramma</h2>
    <div class="wbs-diagram" role="group" aria-label="Diagramma WBS del pacchetto 2, Infrastruttura. In cima il pacchetto, sotto i quattro rami, poi le sotto-attività.">
      <div class="wbs-tree">
        <div class="wbs-root">${nodeBox(root, false)}</div>
        <div class="wbs-arms">${columns}</div>
      </div>
    </div>
  `;
}

function wbsHtml() {
  const infra = findWbs("w2");
  const effort = infra ? effortOf(infra) : { known: false };
  const pack = effort.known ? ` Il pacchetto 2 somma ${formatDays(effort.days)} e ${formatEuro(effort.cost)} di cassa.` : "";
  return `
    <p class="kicker"><b>04</b> Predittiva · dopo il Go</p>
    <h1>WBS</h1>
    <p class="lede">Solo l'infrastruttura di beta.${esc(pack)} Il lavoro di Matteo non entra nel conto.</p>
    ${infraChartHtml()}
    <h2 class="sub">Elenco</h2>
    <div class="wbs-head"><span></span><span>Voce</span><span>Giorni</span><span>Cassa</span></div>
    <div class="list wbs-list">${tree("w2").map(wbsRow).join("")}</div>
    <p class="note">Il diagramma è la scomposizione. Le date stanno nel Gantt: 18–25 novembre, con i legami e la risorsa.</p>
    <p class="actions"><button type="button" class="act" data-act="add-wbs">Aggiungi sotto la voce selezionata</button></p>
  `;
}

function ganttWindow() {
  const rows = tree("w2");
  let min = Infinity;
  let max = -Infinity;
  rows.forEach((entry) => {
    min = Math.min(min, absStartOf(entry.node));
    max = Math.max(max, absEndOf(entry.node));
  });
  if (!Number.isFinite(min)) return { from: "2026-11-17", to: "2026-11-27", days: 11 };
  const fromAbs = Math.max(0, Math.floor(min) - 1);
  const toAbs = Math.ceil(max) + 1;
  const fromDate = parseDate(ORIGIN);
  fromDate.setDate(fromDate.getDate() + fromAbs);
  const toDate = parseDate(ORIGIN);
  toDate.setDate(toDate.getDate() + toAbs);
  const iso = (date) => {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + m + "-" + d;
  };
  const from = iso(fromDate);
  const to = iso(toDate);
  return { from, to, days: daySpan(from, to) + 1 };
}

function ganttPct(abs, win) {
  return ((abs - daySpan(ORIGIN, win.from)) / win.days) * 100;
}

// ─── CPM ────────────────────────────────────────────────────────────────────
// Forward / backward pass sul sottoalbero w2.
// Restituisce una Map<id, { es, ef, ls, lf, slack, critical }> (valori in giorni assoluti dalla ORIGIN).

function computeCpm() {
  const leaves = state.wbs.filter((node) => node.days != null && underWbs(node.id, "w2"));
  if (!leaves.length) return new Map();

  // Costruiamo un grafo diretto per le sole foglie.
  // Consideriamo solo i legami interni al pacchetto w2.
  const internalIds = new Set(leaves.map((node) => node.id));
  const predecessors = {};
  leaves.forEach((node) => {
    predecessors[node.id] = linksOf(node)
      .filter((link) => internalIds.has(link.id))
      .map((link) => ({ id: link.id, type: link.type }));
  });

  // Durate
  const dur = {};
  leaves.forEach((node) => { dur[node.id] = Number(node.days) || 0; });

  // Ordine topologico (Kahn)
  const adj = {};
  const inDegree = {};
  leaves.forEach((node) => { adj[node.id] = []; inDegree[node.id] = 0; });
  leaves.forEach((node) => {
    predecessors[node.id].forEach((link) => {
      adj[link.id].push(node.id);
      inDegree[node.id]++;
    });
  });
  const queue = leaves.filter((node) => !inDegree[node.id]).map((node) => node.id);
  const topo = [];
  while (queue.length) {
    const id = queue.shift();
    topo.push(id);
    (adj[id] || []).forEach((succId) => {
      inDegree[succId]--;
      if (!inDegree[succId]) queue.push(succId);
    });
  }

  // Forward pass: le radici partono dal loro absStartOf pianificato, gli altri dal max(EF predecessori)
  const es = {};
  const ef = {};
  topo.forEach((id) => {
    const node = state.wbs.find((n) => n.id === id);
    const preds = predecessors[id];
    if (!preds.length) {
      es[id] = absStartOf(node);
    } else {
      let maxPred = -Infinity;
      preds.forEach((link) => {
        if (link.type === "FS") maxPred = Math.max(maxPred, ef[link.id] ?? 0);
        else if (link.type === "SS") maxPred = Math.max(maxPred, es[link.id] ?? 0);
        else if (link.type === "FF") maxPred = Math.max(maxPred, (ef[link.id] ?? 0));
        else if (link.type === "SF") maxPred = Math.max(maxPred, (es[link.id] ?? 0) + dur[id]);
      });
      es[id] = isFinite(maxPred) ? maxPred : absStartOf(node);
    }
    ef[id] = es[id] + dur[id];
  });

  // Data di fine progetto = EF massimo
  const projectEnd = Math.max(...topo.map((id) => ef[id] || 0));

  // Successori per il backward pass
  const successors = {};
  leaves.forEach((node) => { successors[node.id] = []; });
  leaves.forEach((node) => {
    predecessors[node.id].forEach((link) => {
      if (successors[link.id]) {
        successors[link.id].push({ id: node.id, type: link.type });
      }
    });
  });

  // Backward pass: LF (Late Finish), LS (Late Start)
  const lf = {};
  const ls = {};
  [...topo].reverse().forEach((id) => {
    const succs = (successors[id] || []).filter((s) => ls[s.id] != null || lf[s.id] != null);
    if (!succs.length) {
      lf[id] = projectEnd;
    } else {
      let minSucc = Infinity;
      succs.forEach((link) => {
        if (link.type === "FS") minSucc = Math.min(minSucc, ls[link.id] ?? Infinity);
        else if (link.type === "SS") minSucc = Math.min(minSucc, ls[link.id] ?? Infinity);
        else if (link.type === "FF") minSucc = Math.min(minSucc, lf[link.id] ?? Infinity);
        else if (link.type === "SF") minSucc = Math.min(minSucc, lf[link.id] ?? Infinity);
      });
      lf[id] = isFinite(minSucc) ? minSucc : projectEnd;
    }
    ls[id] = lf[id] - dur[id];
  });

  // Risultato finale
  const result = new Map();
  leaves.forEach((node) => {
    const slackRaw = (ls[node.id] ?? 0) - (es[node.id] ?? 0);
    const slack = Math.max(0, Math.round(slackRaw * 1000) / 1000);
    result.set(node.id, {
      es: es[node.id],
      ef: ef[node.id],
      ls: ls[node.id],
      lf: lf[node.id],
      slack,
      critical: slackRaw <= 0.001
    });
  });
  return result;
}

function samePersonHits() {
  const leaves = state.wbs.filter((node) => node.days != null && underWbs(node.id, "w2"));
  const busy = {};
  const hits = [];
  leaves.forEach((node) => {
    const key = resourceKey(node.owner);
    const start = absStartOf(node);
    const end = absEndOf(node);
    (busy[key] || []).forEach((other) => {
      if (start < other.end - 1e-9 && other.start < end - 1e-9) hits.push(node.code + " e " + other.code);
    });
    if (!busy[key]) busy[key] = [];
    busy[key].push({ start, end, code: node.code });
  });
  return hits;
}

function ganttHtml() {
  const win = ganttWindow();
  const cpm = computeCpm();
  const ticks = [];
  const cursor = parseDate(win.from);
  const end = parseDate(win.to);
  while (cursor <= end) {
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    ticks.push(cursor.getFullYear() + "-" + m + "-" + d);
    cursor.setDate(cursor.getDate() + 1);
  }
  const today = todayIso();
  const showToday = today >= win.from && today <= win.to;
  const weekend = ticks
    .filter((tick) => {
      const day = parseDate(tick).getDay();
      return day === 0 || day === 6;
    })
    .map((tick) => `<i class="weekend" style="left:${ganttPct(daySpan(ORIGIN, tick), win)}%;width:${100 / win.days}%"></i>`)
    .join("");
  const grid = ticks.map((tick) => `<i class="tick" style="left:${ganttPct(daySpan(ORIGIN, tick), win)}%"></i>`).join("");
  const head = ticks.map((tick) => `<b style="left:${ganttPct(daySpan(ORIGIN, tick), win)}%">${esc(shortDate(tick))}</b>`).join("");
  const todayLine = showToday ? `<i class="today" style="left:${ganttPct(daySpan(ORIGIN, today), win)}%"></i>` : "";
  const rows = tree("w2").map((entry) => {
    const done = entry.node.done ? " done" : "";
    const group = entry.group ? " group" : "";
    const tone = !entry.group && entry.node.days != null ? " who-" + resourceTone(entry.node.owner) : "";
    const cpmInfo = !entry.group && entry.node.days != null ? (cpm.get(entry.node.id) || null) : null;
    const isCritical = cpmInfo && cpmInfo.critical;
    const critical = isCritical ? " critical" : "";
    const rowCls = isCritical ? " is-critical" : (cpmInfo && cpmInfo.slack > 0 ? " has-float" : "");
    const start = absStartOf(entry.node);
    const finish = absEndOf(entry.node);
    const single = entry.node.milestone && entry.node.days == null && entry.node.start === entry.node.end && !entry.group;
    const bar = single ? "" : `<i class="bar${done}${group}${tone}${critical}" data-id="${esc(entry.node.id)}" style="left:${Math.max(ganttPct(start, win), 0)}%;width:${Math.max(ganttPct(finish, win) - ganttPct(start, win), 0.4)}%"></i>`;
    // Barra float: da EF a LF, visibile solo per attività con slack > 0
    let floatBar = "";
    if (cpmInfo && cpmInfo.slack > 0.001 && !entry.group) {
      const floatLeft = ganttPct(cpmInfo.ef, win);
      const floatWidth = ganttPct(cpmInfo.lf, win) - floatLeft;
      if (floatWidth > 0.1) {
        floatBar = `<i class="bar-float" title="Float: ${esc(formatDays(cpmInfo.slack))}" style="left:${Math.max(floatLeft, 0)}%;width:${floatWidth}%"></i>`;
      }
    }
    const diamond = entry.node.milestone ? `<i class="diamond${done}" style="left:${ganttPct(finish, win)}%"></i>` : "";
    const rel = linksOf(entry.node).map((link) => link.type + " " + codeOf(link.id)).filter((line) => !line.endsWith(" ")).join(" · ");
    const effort = effortOf(entry.node);
    const effortHint = effort.known
      ? formatDays(effort.days) + ", " + formatEuro(effort.cost) + (entry.node.days != null ? ", " + entry.node.owner : "")
      : "";
    const slackHint = cpmInfo ? (isCritical ? "slack 0 — critica" : "slack " + formatDays(cpmInfo.slack)) : "";
    const title = [rel ? rel : "", effortHint, slackHint].filter(Boolean).join(". ");
    const chip = entry.node.days != null && rel ? `<em class="rel">${esc(rel)}</em>` : "";
    const critTag = isCritical ? `<span class="cpm-inline-tag">◆ critica</span>` : "";
    return `<div class="grow${rowCls}">
      <button type="button" data-act="select-wbs" data-id="${entry.node.id}" style="--d:${entry.depth}" ${title ? `title="${esc(title)}"` : ""}><span>${esc(entry.node.code)} ${esc(entry.node.name)}${critTag}</span>${chip}</button>
      <div class="track">${weekend}${grid}${todayLine}${bar}${floatBar}${diamond}</div>
    </div>`;
  }).join("");
  const logic = tree("w2")
    .filter((entry) => entry.node.days != null)
    .map((entry) => {
      const links = linksOf(entry.node);
      const tie = links.map((link) => link.type + " dopo " + codeOf(link.id)).join(" e ");
      const why = links.map((link) => link.why).filter(Boolean).join(" ");
      return `<li><b>${esc(entry.node.code)}</b> ${esc(tie)}. ${esc(why)}</li>`;
    })
    .join("");
  const seen = new Set();
  const legend = tree("w2")
    .filter((entry) => entry.node.days != null)
    .map((entry) => {
      const tone = resourceTone(entry.node.owner);
      if (seen.has(tone)) return "";
      seen.add(tone);
      return `<span><i class="swatch who-${tone}"></i> ${esc(resourceLabel(tone, entry.node.owner))}</span>`;
    })
    .filter(Boolean)
    .join("");
  const hits = samePersonHits();
  const check = hits.length
    ? `<p class="notice">Stessa persona su due barre: ${esc(hits.join("; "))}.</p>`
    : `<p class="note">Check: i legami reggono e Matteo non è su due barre insieme. Chiudono un ramo, senza successore nel pacchetto: QR sul dominio, file non pubblico, chiavi, menù demo, verbale.</p>`;

  // ─── Sezione CPM ─────────────────────────────────────────────────────────────────────────────
  const cpmLeaves = tree("w2").filter((entry) => entry.node.days != null);
  const cpmRows = cpmLeaves.map((entry) => {
    const info = cpm.get(entry.node.id);
    if (!info) return "";
    const isCrit = info.critical;
    const slackStr = info.slack === 0 ? "0 g" : formatDays(info.slack);
    const mark = isCrit ? ` <b class="cpm-tag">critica</b>` : "";
    return `<tr class="${isCrit ? "cpm-critical" : "cpm-float"}">
      <td>${esc(entry.node.code)}</td>
      <td>${esc(entry.node.name)}${mark}</td>
      <td class="cpm-num">${esc(formatDays(info.ef - info.es))}</td>
      <td class="cpm-num">${esc(slackStr)}</td>
    </tr>`;
  }).join("");
  const criticalPath = cpmLeaves
    .filter((entry) => (cpm.get(entry.node.id) || {}).critical)
    .map((entry) => entry.node.code + " " + entry.node.name);
  const criticalLegend = criticalPath.length
    ? `<span><i class="swatch" style="background:#ef4444;border-radius:2px"></i> Float 0 — percorso critico</span>`
    : "";
  const floatLegend = `<span><i class="swatch-float"></i> Float positivo</span>`;
  const cpmSection = `
    <h2 class="sub">CPM — Percorso critico e float</h2>
    <p class="note">Le barre rosse hanno <b>float = 0</b>: un giorno di ritardo su una di esse ritarda l\'intero pacchetto. Le barre tratteggiate mostrano il <b>float positivo</b>: il margine disponibile prima di toccare la fine del progetto. Più la barra tratteggiata è lunga, più quell\'attività è flessibile.</p>
    <p class="cpm-path"><b>Percorso critico:</b> ${esc(criticalPath.length ? criticalPath.join(" → ") : "nessuno")}</p>
    <div class="cpm-table-wrap">
      <table class="cpm-table">
        <thead><tr><th>Codice</th><th>Attività</th><th>Durata</th><th>Float (slack)</th></tr></thead>
        <tbody>${cpmRows}</tbody>
      </table>
    </div>
  `;

  return `
    <p class="kicker"><b>05</b> Predittiva · infrastruttura</p>
    <h1>Gantt</h1>
    <p class="lede">Dal 18 al 25 novembre. Il colore è la risorsa, cioè chi esegue. Matteo ha 5,5 giorni e non ne fa due insieme. Il registrar lavora solo la mattina del 18, in parallelo col dump. Sabato e domenica restano vuoti. Nessun lead e nessun lag. La freccia è il legame: FS entra all'inizio della barra, FF alla fine.</p>
    <p class="note">La barra è solo la R. Accountable, Consulted e Informed stanno nella <button type="button" class="quiet" data-act="view" data-view="raci">matrice RACI</button>.</p>
    <p class="legend">${legend}${criticalLegend}${floatLegend}</p>
    <div class="gantt">
      <div class="ghead"><span></span><div class="scale">${weekend}${grid}${head}${todayLine}</div></div>
      <div class="gbody">${rows}</div>
    </div>
    ${check}
    <h2 class="sub">Legami</h2>
    <ul class="logic">${logic}</ul>
    ${cpmSection}
  `;
}

function raciHtml() {
  const groups = [
    ["gantt", "Sul Gantt", "Sono le barre dell’infrastruttura. Il colore della barra era solo chi esegue."],
    ["altro", "Altre attività del mandato", "Stesse quattro lettere, dove il ruolo cambia: parere, cohort, decisione di uscita."]
  ];
  const body = groups.map(([group, title, note]) => {
    const rows = RACI_ROWS.filter((row) => row.group === group).map((row) => {
      const node = findWbs(row.id);
      const code = node ? node.code : row.id;
      const name = node ? node.name : row.id;
      const on = state.selectedWbs === row.id ? " is-on" : "";
      const cells = RACI_PEOPLE.map((person) => {
        const letter = raciLetter(row, person);
        const cls = letter ? ` raci-cell is-${letter.toLowerCase()}` : " raci-cell is-empty";
        const label = letter ? `${letter}, ${RACI_NAMES[person]}` : "";
        return `<td class="${cls.trim()}"${label ? ` title="${esc(label)}"` : ""}>${letter ? esc(letter) : ""}</td>`;
      }).join("");
      return `<tr class="raci-row${on}" role="button" data-act="select-wbs" data-id="${esc(row.id)}" tabindex="0" aria-label="${esc(code + " " + name)}">
        <td><b>${esc(code)}</b> ${esc(name)}</td>
        ${cells}
      </tr>`;
    }).join("");
    const head = RACI_PEOPLE.map((person) => `<th>${esc(RACI_SHORT[person])}</th>`).join("");
    return `<h2 class="sub">${esc(title)}</h2><p class="note">${esc(note)}</p>
      <div class="raci-wrap"><table class="raci-table"><thead><tr><th>Attività</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
  return `
    <p class="kicker"><b>06</b> Predittiva · sul Gantt</p>
    <h1>Matrice RACI</h1>
    <p class="lede">Una sola A per riga. La persona sulla barra del Gantt non diventa automaticamente accountable.</p>
    <p class="legend"><span><b>R</b> esegue</span><span><b>A</b> risponde</span><span><b>C</b> si consulta prima</span><span><b>I</b> si avvisa dopo</span></p>
    ${body}
    <p class="note">Apple e Google non hanno una lettera: ricevono la build e l’esito della review non è un criterio. Il quadro normativo resta fuori dalla matrice, come nel registro stakeholder.</p>
  `;
}

function raciSideHtml() {
  const row = RACI_ROWS.find((item) => item.id === state.selectedWbs) || RACI_ROWS[0];
  const node = findWbs(row.id);
  const title = node ? node.code + " " + node.name : row.id;
  return `
    <p class="kicker"><b>RACI</b> ${esc(node ? node.code : "")}</p>
    <h2>${esc(title)}</h2>
    <p class="note">${esc(row.why)}</p>
    <p class="note"><b>R</b> ${esc(raciNames(row.R))}</p>
    <p class="note"><b>A</b> ${esc(raciNames(row.A))}. Una sola.</p>
    <p class="note"><b>C</b> ${esc(raciNames(row.C))}</p>
    <p class="note"><b>I</b> ${esc(raciNames(row.I))}</p>
  `;
}

function ganttBox(bar, origin) {
  const rect = bar.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    right: rect.right - origin.left,
    mid: rect.top - origin.top + rect.height / 2
  };
}

function ganttRoute(from, to, type) {
  const fromStart = type === "SS" || type === "SF";
  const intoStart = type === "FS" || type === "SS";
  const x1 = fromStart ? from.left : from.right;
  const x2 = intoStart ? to.left : to.right;
  const y1 = from.mid;
  const y2 = to.mid;
  const out = fromStart ? -1 : 1;
  const into = intoStart ? -1 : 1;
  if (Math.abs(x2 - x1) < 14) {
    return { d: `M ${x1} ${y1} V ${y2}`, lx: x1 + 6, ly: (y1 + y2) / 2 };
  }
  const xOut = x1 + out * 8;
  const xIn = x2 + into * 8;
  if (out === 1 && into === -1 && xIn >= xOut - 1) {
    const lx = Math.abs(xIn - x1) < 40 ? xIn + 5 : (x1 + xIn) / 2;
    const ly = Math.abs(xIn - x1) < 40 ? (y1 + y2) / 2 : y1 - 5;
    return { d: `M ${x1} ${y1} H ${xIn} V ${y2} H ${x2}`, lx, ly };
  }
  if (out === 1) {
    const lane = Math.max(x1, x2) + 12;
    return { d: `M ${x1} ${y1} H ${lane} V ${y2} H ${x2}`, lx: lane + 5, ly: (y1 + y2) / 2 };
  }
  const lane = Math.min(x1, x2) - 12;
  return { d: `M ${x1} ${y1} H ${lane} V ${y2} H ${x2}`, lx: lane - 4, ly: (y1 + y2) / 2 };
}

function drawGanttLinks() {
  const body = document.querySelector(".gbody");
  if (!body) return;
  const previous = body.querySelector(".glinks");
  if (previous) previous.remove();
  const origin = body.getBoundingClientRect();
  const bars = {};
  body.querySelectorAll(".bar[data-id]").forEach((bar) => {
    if (bar.classList.contains("group")) return;
    bars[bar.dataset.id] = ganttBox(bar, origin);
  });
  const onChart = new Set(Object.keys(bars));
  const arrows = [];
  tree("w2").forEach((entry) => {
    if (entry.node.days == null) return;
    linksOf(entry.node).forEach((link) => {
      if (onChart.has(link.id) && bars[entry.node.id]) {
        arrows.push({ from: link.id, to: entry.node.id, type: link.type, outside: false });
      } else if (bars[entry.node.id]) {
        arrows.push({ from: link.id, to: entry.node.id, type: link.type, outside: true, code: codeOf(link.id) });
      }
    });
  });
  const width = body.clientWidth;
  const height = body.clientHeight;
  const pieces = arrows.map((arrow) => {
    const target = bars[arrow.to];
    if (!target) return "";
    if (arrow.outside) {
      const intoStart = arrow.type === "FS" || arrow.type === "SS";
      const x2 = intoStart ? target.left : target.right;
      const x1 = intoStart ? x2 - 26 : x2 + 26;
      return `<path d="M ${x1} ${target.mid} H ${x2}" marker-end="url(#garrow)"></path><text x="${x1 - 3}" y="${target.mid - 5}" text-anchor="end">${esc(arrow.code)} ${esc(arrow.type)}</text>`;
    }
    const route = ganttRoute(bars[arrow.from], target, arrow.type);
    return `<path d="${route.d}" marker-end="url(#garrow)"></path><text x="${route.lx}" y="${route.ly}">${esc(arrow.type)}</text>`;
  }).join("");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "glinks");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-label", "Frecce dei legami fra le attività");
  svg.innerHTML = `<defs><marker id="garrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>${pieces}`;
  body.appendChild(svg);
}

function storyWash(id) {
  return STORY_WASH[id] || "#f1fec8";
}

function columnCards(column) {
  const pri = { alta: 0, media: 1, bassa: 2 };
  const sprintOrder = { s1: 0, s2: 1, s3: 2, s4: 3, s5: 4, s6: 5 };
  return (state.board || [])
    .filter((card) => card.column === column)
    .sort((a, b) => {
      const sa = findStory(a.storyId);
      const sb = findStory(b.storyId);
      const ra = sa ? (sprintOrder[sa.sprint] ?? 9) : 9;
      const rb = sb ? (sprintOrder[sb.sprint] ?? 9) : 9;
      const oa = sa ? (sa.order || 50) : 50;
      const ob = sb ? (sb.order || 50) : 50;
      const pa = sa ? (pri[sa.priority] ?? 1) : 1;
      const pb = sb ? (pri[sb.priority] ?? 1) : 1;
      return ra - rb || oa - ob || pa - pb || a.storyId.localeCompare(b.storyId) || a.order - b.order;
    });
}

function boardCard(card) {
  const story = findStory(card.storyId);
  const name = story ? story.name : card.storyId;
  const points = story ? pointValue(story.points) : null;
  const on = state.selectedCard === card.id ? " is-on" : "";
  const pt = points == null ? "" : " · " + points;
  return `<article class="card${on}" draggable="true" data-card="${esc(card.id)}" data-act="select-card" data-id="${esc(card.storyId)}" style="--wash:${storyWash(card.storyId)}">
    <small>${esc(name)}${esc(pt)}</small>
    <p>${esc(card.title)}</p>
  </article>`;
}

function cardsOf(storyId) {
  return (state.board || []).filter((card) => card.storyId === storyId);
}

function storyIsDone(story) {
  const cards = cardsOf(story.id);
  return cards.length > 0 && cards.every((card) => card.column === "done");
}

function sprintOne() {
  return state.stories
    .filter((story) => story.sprint === "s1")
    .sort((a, b) => (a.order || 99) - (b.order || 99));
}

function sp(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

function openWhere(story) {
  const labels = { backlog: "nel backlog", todo: "in To do", doing: "in lavorazione", review: "in review" };
  const counts = {};
  cardsOf(story.id).forEach((card) => {
    if (card.column === "done") return;
    counts[card.column] = (counts[card.column] || 0) + 1;
  });
  const text = Object.entries(counts).map(([column, count]) => count + " " + (labels[column] || column)).join(", ");
  return text || "non è in Completato";
}

const DELIVERS = {
  "US-S8": "La frase legale è sul menù, prima della registrazione. Si può usare.",
  "US-S5": "La persona indica le allergie, senza referti.",
  "US-S9": "Sviluppo, staging e beta sono separati."
};

function sprintRead() {
  const stories = sprintOne();
  const scope = stories.reduce((sum, story) => sum + (pointValue(story.points) || 0), 0);
  const doneStories = stories.filter(storyIsDone);
  const openStories = stories.filter((story) => !storyIsDone(story));
  const done = doneStories.reduce((sum, story) => sum + (pointValue(story.points) || 0), 0);
  const small = stories.find((story) => story.id === "US-S8");
  const scripted = (state.boardMoment || "end") === "end" && small && storyIsDone(small) && openStories.some((story) => story.id !== "US-S8");
  const mid = scripted ? (pointValue(small.points) || 0) : null;
  return { stories, scope, done, doneStories, openStories, mid };
}

function yieldItem(story, line) {
  const points = pointValue(story.points);
  return `<li style="--wash:${storyWash(story.id)}"><b class="pt">${points == null ? "" : sp(points)}</b><span>${esc(story.name || "")}</span><em>${esc(line)}</em></li>`;
}

function incrementHtml(read) {
  const moment = state.boardMoment || "end";
  const goal = (state.sprints.find((sprint) => sprint.id === "s1") || {}).goal || "";
  const rule = "Definition of Done di questa board: tutte le attività della storia sono in Completato. Review e in lavorazione non bastano. Se ne manca una, la storia non entra nell'incremento e torna nel product backlog.";
  const enters = read.doneStories.map((story) => yieldItem(story, DELIVERS[story.id] || "Tutte le attività sono in Completato.")).join("");
  const returns = read.openStories.map((story) => yieldItem(story, openWhere(story) + ". Non è fatta.")).join("");
  const enterList = enters ? `<ul class="yield">${enters}</ul>` : `<p class="empty">Niente. Nessuna storia dello sprint è davvero fatta.</p>`;
  const returnList = returns ? `<ul class="yield">${returns}</ul>` : `<p class="empty">Niente torna indietro. Lo sprint è chiuso.</p>`;
  const returnTitle = moment === "start" ? "Ancora nello sprint" : "Torna nel product backlog";
  const allDone = read.stories.length > 0 && read.openStories.length === 0;
  let release = "";
  if (moment === "start") {
    release = "È il giorno zero. L'incremento si costruisce durante le due settimane, e solo ciò che è davvero fatto ci entra. Il release è un'altra cosa: una versione portata agli utenti, e non coincide per forza con la fine dello sprint.";
  } else if (allDone) {
    release = "Lo sprint goal è chiuso. L'incremento si può portare agli utenti, ma il release resta una scelta a parte: non scatta da solo a fine sprint.";
  } else {
    release = "Non si rilascia. L'incremento c'è solo per ciò che è fatto, lo sprint goal no. Il release non coincide con la fine dello sprint.";
  }
  const head = moment === "start"
    ? "A inizio sprint l'incremento è vuoto."
    : "A fine sprint entra solo ciò che è fatto e si può usare.";
  return `
    <h2 class="sub">Incremento</h2>
    <p class="lede">${esc(head)} Sprint goal: ${esc(goal)}</p>
    <div class="split">
      <div>
        <h3>Entra · ${sp(read.done)} story point</h3>
        ${enterList}
      </div>
      <div>
        <h3>${esc(returnTitle)} · ${sp(read.scope - read.done)} story point</h3>
        ${returnList}
      </div>
    </div>
    <p class="note">${esc(rule)}</p>
    <p class="note">${esc(release)}</p>
  `;
}

function chartSeries(read) {
  const scope = read.scope;
  const points = [
    { label: "Inizio", done: 0 },
    { label: "1 settimana", done: read.mid },
    { label: "Fine", done: (state.boardMoment || "end") === "start" ? null : read.done }
  ];
  return points.map((point) => ({ label: point.label, done: point.done, scope }));
}

function burnChart(kind, series, scope) {
  const width = 640;
  const height = 210;
  const left = 38;
  const right = 14;
  const top = 16;
  const bottom = 34;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const yMax = Math.max(scope, 1);
  const yOf = (value) => top + plotH - (value / yMax) * plotH;
  const xOf = (index) => left + (series.length === 1 ? 0 : (index / (series.length - 1)) * plotW);
  const valueOf = (point) => {
    if (point.done == null) return null;
    return kind === "down" ? point.scope - point.done : point.done;
  };
  const coords = series.map((point, index) => {
    const value = valueOf(point);
    return value == null ? null : [xOf(index), yOf(value)];
  });
  const line = [];
  coords.forEach((coord) => {
    if (!coord) return;
    line.push((line.length ? "L" : "M") + coord[0].toFixed(1) + " " + coord[1].toFixed(1));
  });
  const ideal = kind === "down"
    ? `M${xOf(0).toFixed(1)} ${yOf(scope).toFixed(1)} L${xOf(series.length - 1).toFixed(1)} ${yOf(0).toFixed(1)}`
    : `M${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)} L${xOf(series.length - 1).toFixed(1)} ${yOf(scope).toFixed(1)}`;
  const scopeLine = kind === "up"
    ? `<path d="M${xOf(0).toFixed(1)} ${yOf(scope).toFixed(1)} L${xOf(series.length - 1).toFixed(1)} ${yOf(scope).toFixed(1)}" fill="none" stroke="#23212c" stroke-opacity="0.35" stroke-width="2"></path>`
    : "";
  const dots = coords.map((coord) => coord ? `<circle cx="${coord[0].toFixed(1)}" cy="${coord[1].toFixed(1)}" r="4.5" fill="#f1fec8" stroke="#23212c" stroke-width="2"></circle>` : "").join("");
  const labels = series.map((point, index) => `<text x="${xOf(index).toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="#64748b" font-size="12" font-family="Nunito, sans-serif">${esc(point.label)}</text>`).join("");
  const axis = `<path d="M${left} ${top} V${top + plotH} H${left + plotW}" fill="none" stroke="#23212c" stroke-opacity="0.15"></path>`;
  const marks = [0, scope].map((value) => `<text x="${left - 8}" y="${(yOf(value) + (value === 0 ? -6 : 4)).toFixed(1)}" text-anchor="end" fill="#64748b" font-size="12" font-family="Nunito, sans-serif">${esc(sp(value))}</text>`).join("");
  const last = [...series].reverse().find((point) => point.done != null);
  const lastValue = last ? (kind === "down" ? last.scope - last.done : last.done) : 0;
  const title = kind === "down"
    ? `Burn-down. Quanto manca: ${sp(lastValue)} su ${sp(scope)}.`
    : `Burn-up. Quanto è fatto: ${sp(lastValue)} su ${sp(scope)}.`;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">${axis}${marks}<path d="${ideal}" fill="none" stroke="#64748b" stroke-dasharray="5 4" stroke-width="1.5"></path>${scopeLine}<path d="${line.join(" ")}" fill="none" stroke="#23212c" stroke-width="2.5"></path>${dots}${labels}</svg>`;
}

function progressHtml(read) {
  const moment = state.boardMoment || "end";
  const series = chartSeries(read);
  const left = read.scope - read.done;
  const flat = read.mid != null
    ? " Dopo una settimana le scritte, da " + sp(read.mid) + " story point, sono fatte. Poi la linea si ferma: il resto è in review o in lavorazione, e non conta come fatto."
    : "";
  const reading = moment === "start"
    ? "A inizio sprint parte dall'impegno e deve scendere a zero. La linea tratteggiata è il passo ideale."
    : `Fatti ${sp(read.done)} su ${sp(read.scope)}. Ne mancano ${sp(left)}. Non è a zero.${flat}`;
  const why = "Il burn-down è il grafico di questo sprint. L'impegno resta " + sp(read.scope) + " story point: non è entrata nessuna storia nuova. La domanda è se ciò che manca scende a zero. Il burn-up serve quando lo scope cresce, per non mescolare il lavoro fatto con le richieste aggiunte. Qui lo scope è fermo, quindi diceva la stessa cosa al contrario.";
  return `
    <h2 class="sub">Stato di avanzamento</h2>
    <p class="lede">Burn-down: quanto manca. Deve scendere a zero.</p>
    <div class="figs read">
      <div><b>${esc(sp(read.scope))}</b><span>Impegno, story point</span></div>
      <div><b>${esc(sp(read.done))}</b><span>Nell'incremento</span></div>
      <div><b>${esc(sp(left))}</b><span>Manca</span></div>
    </div>
    <div class="charts one">
      <figure>
        <h3>Burn-down</h3>
        ${burnChart("down", series, read.scope)}
        <figcaption>Deve scendere a zero. ${moment === "start" ? "Parte da " + esc(sp(read.scope)) + "." : "Si ferma a " + esc(sp(left)) + "."}</figcaption>
      </figure>
    </div>
    <p class="key"><span class="swatch"></span> Andamento <span class="swatch ideal"></span> Passo ideale</p>
    <p class="note">${esc(reading)}</p>
    <p class="note">${esc(why)}</p>
  `;
}

function kanbanHtml() {
  const moment = state.boardMoment || "end";
  const lede = {
    start: "Giorno zero dello Sprint 1. L'elencone sta nel backlog. In To do entrano solo le attività scelte per queste due settimane: tre ambienti, le scritte, il profilo. Il resto del progetto non si muove.",
    end: "Fine delle due settimane. Le attività da 2 e da 3 story point sono quasi tutte in completato. Tre ambienti vale 8 e non è finita. In review si è formato un collo: chi sviluppa lavora in parallelo, chi verifica è una persona sola.",
    custom: "Hai spostato delle schede. Inizio sprint rimette lo sprint 1 in To do. Fine sprint rimette la simulazione a due settimane."
  }[moment] || "";
  const tabs = [
    ["start", "Inizio sprint"],
    ["end", "Fine sprint"]
  ].map(([id, label]) => `<button type="button" data-act="board-moment" data-moment="${id}" ${moment === id ? 'aria-current="true"' : ""}>${label}</button>`).join("");
  const legend = ["US-S9", "US-S8", "US-S5"].map((id) => {
    const story = findStory(id);
    if (!story) return "";
    const points = pointValue(story.points);
    return `<li style="--wash:${storyWash(id)}"><b>${esc(story.name)}</b> ${points == null ? "" : points + " pt"}</li>`;
  }).join("");
  const columns = BOARD_COLUMNS.map(([id, title, hint]) => {
    const cards = columnCards(id);
    let empty = "";
    if (!cards.length && id === "todo" && moment === "end") empty = `<p class="empty">Lo sprint le ha prese tutte.</p>`;
    else if (!cards.length) empty = `<p class="empty">Niente qui.</p>`;
    const pile = id === "review" && cards.length >= 3 ? `<p class="pile">Più schede di quante una persona sola riesce a verificare.</p>` : "";
    return `<section data-drop="${id}">
      <header>
        <h2>${esc(title)} <em>${cards.length}</em></h2>
        <p>${esc(hint)}</p>
        ${pile}
      </header>
      <div class="col-body">${cards.map(boardCard).join("")}${empty}</div>
    </section>`;
  }).join("");
  return `
    <div class="kanban-split">
      <section class="kanban-top">
        <p class="kicker"><b>03</b> Agile · Sprint 1 · due settimane</p>
        <h1>Kanban</h1>
        <p class="lede">${esc(lede)}</p>
        <div class="sprint-tabs">${tabs}</div>
        <ul class="legend">${legend}</ul>
        <div class="board kanban">${columns}</div>
      </section>
    </div>
  `;
}

function getEvmData() {
  let scenario = state.evmScenario || "v1";
  if (scenario === "mix") scenario = "v1";
  if (scenario === "critico") scenario = "v2";
  if (scenario === "virtuoso") scenario = "v3";
  if (scenario === "linea") scenario = "v4";
  const custom = state.customEvm || {};
  
  // WBS base per AllerTgy con budget e avanzamento al 17 dicembre 2026.
  const items = [
    { id: "w1", code: "1", name: "Avvio e Go", bac: 500, pPlan: 1.0, pReal: 1.0, ac: 520, note: "Charter firmato, baseline e acconto parere legale sui testi." },
    { id: "w2", code: "2", name: "Infrastruttura beta", bac: 19, pPlan: 1.0, pReal: 1.0, ac: 24, note: "Dominio .it, HTTPS, VPS Hostinger e procedura di restore." },
    { id: "w3", code: "3", name: "Percorso cliente", bac: 400, pPlan: 1.0, pReal: 1.0, ac: 460, note: "Profilo allergeni locale, QR scanner e semaforo a 3 colori." },
    { id: "w4", code: "4", name: "Percorso ristoratore", bac: 500, pPlan: 0.15, pReal: 0.45, ac: 340, note: "Libro allergeni, scheda piatto, verifica cucina e QR sala." },
    { id: "w5", code: "5", name: "Cohort", bac: 250, pPlan: 0.0, pReal: 0.0, ac: 0, note: "Test con 5-10 locali a zero euro e 15 clienti allergici." },
    { id: "w6", code: "6", name: "Chiusura & Store", bac: 331, pPlan: 6 / 331, pReal: 6 / 331, ac: 6, note: "Saldo parere legale, invio build store Apple e Google." }
  ];

  if (scenario === "v2") {
    items[2].pReal = 281 / 400; items[2].ac = 470;
    items[3].pReal = 0.0; items[3].ac = 0;
    items[5].pReal = 0.0; items[5].ac = 0;
    items[0].ac = 550; items[1].ac = 30;
  } else if (scenario === "v3") {
    items[0].ac = 480; items[1].ac = 19; items[2].ac = 380; items[3].ac = 95; items[3].pReal = 0.45;
  } else if (scenario === "v4") {
    items.forEach(it => {
      it.pReal = it.pPlan;
      it.ac = Math.round(it.bac * it.pPlan);
    });
  } else if (scenario === "custom") {
    if (custom.w4_pReal != null) items[3].pReal = Math.max(0, Math.min(1, custom.w4_pReal / 100));
    if (custom.w4_ac != null) items[3].ac = Math.max(0, custom.w4_ac);
  }

  let bacTot = 0, pvTot = 0, evTot = 0, acTot = 0;
  const rows = items.map(it => {
    const pv = Math.round(it.bac * it.pPlan * 100) / 100;
    const ev = Math.round(it.bac * it.pReal * 100) / 100;
    const ac = it.ac;
    const sv = Math.round((ev - pv) * 100) / 100;
    const cv = Math.round((ev - ac) * 100) / 100;
    const spi = pv > 0 ? Math.round((ev / pv) * 100) / 100 : (ev > 0 ? 1 : 1);
    const cpi = ac > 0 ? Math.round((ev / ac) * 100) / 100 : 1;
    let status = "Da avviare";
    if (it.pReal >= 1) status = "Completato";
    else if (it.pReal > 0) status = "In corso";

    bacTot += it.bac;
    pvTot += pv;
    evTot += ev;
    acTot += ac;

    return { ...it, pv, ev, ac, sv, cv, spi, cpi, status };
  });

  pvTot = Math.round(pvTot * 100) / 100;
  evTot = Math.round(evTot * 100) / 100;
  acTot = Math.round(acTot * 100) / 100;
  const svTot = Math.round((evTot - pvTot) * 100) / 100;
  const cvTot = Math.round((evTot - acTot) * 100) / 100;
  const spiTot = pvTot > 0 ? Math.round((evTot / pvTot) * 100) / 100 : 1;
  const cpiTot = acTot > 0 ? Math.round((evTot / acTot) * 1000) / 1000 : 1;
  const eac = cpiTot > 0 ? Math.round((bacTot / cpiTot) * 100) / 100 : bacTot;
  const etc = Math.max(0, Math.round((eac - acTot) * 100) / 100);
  const vac = Math.round((bacTot - eac) * 100) / 100;

  return {
    scenario,
    statusDate: "2026-12-17",
    statusWeek: 6,
    totalWeeks: 12,
    bac: bacTot,
    pv: pvTot,
    ev: evTot,
    ac: acTot,
    sv: svTot,
    cv: cvTot,
    spi: spiTot,
    cpi: Math.round(cpiTot * 100) / 100,
    cpiRaw: cpiTot,
    eac,
    etc,
    vac,
    rows
  };
}

function evmChartSvg(d) {
  const w = 860;
  const h = 340;
  const padL = 72;
  const padR = 16;
  const padT = 16;
  const padB = 44;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxEuro = 2800;
  const font = "Nunito, sans-serif";

  const x = (week) => padL + (week / 12) * plotW;
  const y = (euro) => padT + plotH - (Math.min(Math.max(euro, 0), maxEuro) / maxEuro) * plotH;

  const pvPoints = [
    [0, 0], [2, 120], [4, 519], [6, d.pv], [8, 1450], [10, 1750], [12, d.bac]
  ];
  const pvPath = "M " + pvPoints.map(([wk, euro]) => `${x(wk)},${y(euro)}`).join(" L ");
  const evPoints = [[0, 0], [2, 100], [4, 519], [6, d.ev]];
  const evPath = "M " + evPoints.map(([wk, euro]) => `${x(wk)},${y(euro)}`).join(" L ");
  const acPoints = [[0, 0], [2, 140], [4, 544], [6, d.ac]];
  const acPath = "M " + acPoints.map(([wk, euro]) => `${x(wk)},${y(euro)}`).join(" L ");
  const eacPath = `M ${x(6)},${y(d.ac)} L ${x(12)},${y(d.eac)}`;

  const yBac = y(d.bac);
  const yCap = y(2600);
  const xNow = x(6);
  const plotBottom = padT + plotH;

  const ticks = [0, 500, 1000, 1500, 2000, 2500];
  const grid = ticks.map((euro) => `
    <line x1="${padL}" y1="${y(euro)}" x2="${padL + plotW}" y2="${y(euro)}" stroke="rgba(35,33,44,0.08)" stroke-width="1"/>
    <text x="${padL - 8}" y="${y(euro) + 4}" fill="#64748b" font-family="${font}" font-size="11" text-anchor="end">${euro === 0 ? "0" : euro.toLocaleString("it-IT")}</text>
  `).join("");

  const weeks = [0, 2, 4, 6, 8, 10, 12].map((wk) => {
    const label = wk === 0 ? "3 nov" : wk === 6 ? "17 dic" : wk === 12 ? "31 gen" : "W" + wk;
    const today = wk === 6;
    return `
      <line x1="${x(wk)}" y1="${padT}" x2="${x(wk)}" y2="${plotBottom}" stroke="${today ? "#ef4444" : "rgba(35,33,44,0.08)"}" stroke-width="${today ? 1.5 : 1}" stroke-dasharray="${today ? "none" : "2,3"}"/>
      <text x="${x(wk)}" y="${plotBottom + 16}" fill="${today ? "#dc2626" : "#64748b"}" font-family="${font}" font-size="12" font-weight="${today ? 800 : 600}" text-anchor="middle">${label}</text>
      ${today ? `<text x="${x(wk)}" y="${plotBottom + 30}" fill="#dc2626" font-family="${font}" font-size="10" font-weight="700" text-anchor="middle">oggi</text>` : ""}
    `;
  }).join("");

  function spreadLabels(marks) {
    const gap = 26;
    const placed = marks
      .map((mark) => ({ ...mark, y: y(mark.euro) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].y < placed[i - 1].y + gap) placed[i].y = placed[i - 1].y + gap;
    }
    const maxY = plotBottom - 8;
    const overflow = placed[placed.length - 1].y - maxY;
    if (overflow > 0) placed.forEach((mark) => { mark.y -= overflow; });
    const minY = padT + 14;
    if (placed[0].y < minY) {
      const shift = minY - placed[0].y;
      placed.forEach((mark) => { mark.y += shift; });
    }
    return placed;
  }

  const nowLabels = spreadLabels([
    { euro: d.pv, color: "#475569", text: "PV " + formatEuro(d.pv) },
    { euro: d.ev, color: "#1f7a4d", text: "EV " + formatEuro(d.ev) },
    { euro: d.ac, color: "#dc2626", text: "AC " + formatEuro(d.ac) }
  ]);
  const labelX = xNow + 22;

  function pill(px, py, text, color) {
    const width = text.length * 7.2 + 18;
    const height = 22;
    return `
      <rect x="${px}" y="${py - height / 2}" width="${width}" height="${height}" rx="6" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>
      <text x="${px + 9}" y="${py + 4}" fill="#23212c" font-family="${font}" font-size="13" font-weight="700">${text}</text>
    `;
  }

  const leaders = nowLabels.map((mark) => `
    <line x1="${xNow}" y1="${y(mark.euro)}" x2="${labelX - 2}" y2="${mark.y}" stroke="${mark.color}" stroke-width="1.25"/>
  `).join("");
  const pills = nowLabels.map((mark) => pill(labelX, mark.y, mark.text, mark.color)).join("");

  const eacText = "EAC " + formatEuro(d.eac);
  const eacW = eacText.length * 7.2 + 18;
  const eacX = x(12) - eacW - 12;
  let eacY = y(d.eac) - 20;
  if (eacY < padT + 14) eacY = y(d.eac) + 22;
  if (Math.abs(eacY - yCap) < 16) eacY = y(d.eac) + 22;
  if (Math.abs(eacY - yBac) < 16 && Math.abs(y(d.eac) - yBac) < 24) eacY = yBac - 20;

  function dot(cx, cy, color) {
    return `<circle cx="${cx}" cy="${cy}" r="6.5" fill="#fff" stroke="${color}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="3" fill="${color}"/>`;
  }

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="Curve di earned value. Al 17 dicembre, PV ${formatEuro(d.pv)}, EV ${formatEuro(d.ev)}, AC ${formatEuro(d.ac)}, EAC ${formatEuro(d.eac)}.">
      <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="#fff"/>
      ${grid}
      <line x1="${padL}" y1="${yBac}" x2="${padL + plotW}" y2="${yBac}" stroke="#23212c" stroke-width="1.25" stroke-dasharray="5,4"/>
      <text x="${padL + 8}" y="${yBac - 7}" fill="#23212c" font-family="${font}" font-size="11" font-weight="700">BAC ${formatEuro(d.bac)}</text>
      <line x1="${padL}" y1="${yCap}" x2="${padL + plotW}" y2="${yCap}" stroke="#dc2626" stroke-width="1.25" stroke-dasharray="2,3"/>
      <text x="${padL + 8}" y="${yCap - 7}" fill="#dc2626" font-family="${font}" font-size="11" font-weight="700">Tetto charter ${formatEuro(2600)}</text>
      ${weeks}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${plotBottom}" stroke="rgba(35,33,44,0.35)" stroke-width="1"/>
      <line x1="${padL}" y1="${plotBottom}" x2="${padL + plotW}" y2="${plotBottom}" stroke="rgba(35,33,44,0.35)" stroke-width="1"/>

      <path d="${pvPath}" fill="none" stroke="#64748b" stroke-width="2.5"/>
      <path d="${eacPath}" fill="none" stroke="#c46b2c" stroke-width="2" stroke-dasharray="6,4"/>
      <path d="${evPath}" fill="none" stroke="#1f7a4d" stroke-width="3"/>
      <path d="${acPath}" fill="none" stroke="#dc2626" stroke-width="3"/>

      ${leaders}
      ${pvPoints.filter(([wk]) => wk !== 6).map(([wk, euro]) => dot(x(wk), y(euro), "#64748b")).join("")}
      ${dot(xNow, y(d.pv), "#475569")}
      ${dot(xNow, y(d.ev), "#1f7a4d")}
      ${dot(xNow, y(d.ac), "#dc2626")}
      ${dot(x(12), y(d.eac), "#c46b2c")}
      ${pills}
      ${pill(eacX, eacY, eacText, "#c46b2c")}
    </svg>
  `;
}

function evmHtml() {
  const d = getEvmData();
  const sc = d.scenario;

  const scenarios = [
    ["v1", "Versione 1 · Anticipo con extracosti"],
    ["v2", "Versione 2 · Ritardo con extracosti"],
    ["v3", "Versione 3 · Anticipo con risparmio"],
    ["v4", "Versione 4 · In linea con la baseline"]
  ];

  const scenarioTabs = scenarios.map(([id, label]) => `
    <button type="button" data-act="set-evm-scenario" data-scenario="${id}" ${sc === id ? 'aria-current="true"' : ""}>${esc(label)}</button>
  `).join("");

  const svSign = d.sv > 0 ? "+" : "";
  const cvSign = d.cv > 0 ? "+" : "";
  const vacSign = d.vac > 0 ? "+" : "";

  const charterAlert = d.eac > 2600
    ? `<div class="scenario-callout" style="border-left-color:#ef4444;background:#fef2f2;color:#991b1b;margin-top:1rem;"><strong>Attenzione:</strong> La stima a finire EAC (${formatEuro(d.eac)}) supera il vincolo V1 di cassa del Project Charter (tetto massimo 2.600 €). È richiesta escalation immediata allo sponsor hacklab.digital!</div>`
    : `<div class="scenario-callout" style="border-left-color:#2a6b4f;background:#f0fdf4;color:#166534;margin-top:1rem;"><strong>Conforme al Charter:</strong> La stima a finire EAC (${formatEuro(d.eac)}) rispetta il vincolo di cassa autorizzato (1.300–2.600 €).</div>`;

  const tableRows = d.rows.map(r => {
    const isSelected = state.selectedEvmWbs === r.id;
    const svS = r.sv > 0 ? "+" : "";
    const cvS = r.cv > 0 ? "+" : "";
    const svCls = r.sv > 0 ? "color:#166534;font-weight:700" : (r.sv < 0 ? "color:#991b1b;font-weight:700" : "");
    const cvCls = r.cv > 0 ? "color:#166534;font-weight:700" : (r.cv < 0 ? "color:#991b1b;font-weight:700" : "");
    const cpiCls = r.ac > 0 ? (r.cpi > 1 ? "color:#166534;font-weight:700" : (r.cpi < 1 ? "color:#991b1b;font-weight:700" : "")) : "";
    const cpiCell = r.ac > 0 ? r.cpi.toFixed(2) : "—";
    return `
      <tr style="cursor:pointer;${isSelected ? 'background:var(--vanilla);' : ''}" data-act="select-evm-wbs" data-id="${r.id}">
        <td><strong>${esc(r.code)}</strong></td>
        <td><strong>${esc(r.name)}</strong></td>
        <td class="num">${formatEuro(r.bac)}</td>
        <td class="num">${Math.round(r.pReal * 100)}% <small style="color:var(--muted)">(prev ${Math.round(r.pPlan * 100)}%)</small></td>
        <td class="num">${formatEuro(r.pv)}</td>
        <td class="num" style="font-weight:700">${formatEuro(r.ev)}</td>
        <td class="num">${formatEuro(r.ac)}</td>
        <td class="num" style="${svCls}">${svS}${formatEuro(r.sv)}</td>
        <td class="num" style="${cvCls}">${cvS}${formatEuro(r.cv)}</td>
        <td class="num" style="${cpiCls}">${cpiCell}</td>
        <td><span class="evm-badge ${r.status === 'Completato' ? 'good' : (r.status === 'In corso' ? 'warn' : '')}">${r.status}</span></td>
      </tr>
    `;
  }).join("");

  return `
    <p class="kicker"><b>07</b> Predittiva · Metà Progetto (17 Dicembre 2026)</p>
    <h1>Costi &amp; Earned Value</h1>

    <div class="scenario-nav">
      ${scenarioTabs}
    </div>

    <!-- 4 Grandi Card KPI -->
    <div class="evm-grid">
      <div class="evm-card">
        <small>Planned Value (PV)</small>
        <div class="val">${formatEuro(d.pv)}</div>
        <p>Valore pianificato da baseline al 17/12 (50% del budget).</p>
      </div>
      <div class="evm-card is-accent">
        <small>Earned Value (EV)</small>
        <div class="val">${formatEuro(d.ev)}</div>
        <p>Valore economico del lavoro realmente prodotto a budget.</p>
      </div>
      <div class="evm-card ${d.ac > d.ev ? 'is-danger' : 'is-accent'}">
        <small>Actual Cost (AC)</small>
        <div class="val">${formatEuro(d.ac)}</div>
        <p>Costo reale effettivo sostenuto fino alla data di stato.</p>
      </div>
      <div class="evm-card">
        <small>Budget at Completion (BAC)</small>
        <div class="val">${formatEuro(d.bac)}</div>
        <p>Budget totale approvato nel Project Charter.</p>
      </div>
    </div>

    <!-- Duo: Tempi vs Costi -->
    <div class="evm-duo">
      <!-- Blocco Tempi/Piano -->
      <div class="evm-duo-box">
        <h3>TEMPI / PIANO · Stiamo avanzando come previsto?</h3>
        <div class="metrics">
          <div class="evm-metric-item">
            <b>Schedule Variance (SV = EV - PV)</b>
            <div class="num" style="${d.sv >= 0 ? 'color:#166534' : 'color:#991b1b'}">${svSign}${formatEuro(d.sv)}</div>
            <div class="desc">${d.sv >= 0 ? 'Lavoro realizzato superiore a quanto pianificato.' : 'Lavoro realizzato inferiore al pianificato.'}</div>
          </div>
          <div class="evm-metric-item">
            <b>Schedule Performance Index (SPI = EV / PV)</b>
            <div class="num" style="${d.spi >= 1 ? 'color:#166534' : 'color:#991b1b'}">${d.spi.toFixed(2)}</div>
            <div class="desc">${d.spi >= 1 ? `Realizzato il ${Math.round(d.spi * 100)}% del lavoro previsto alla data.` : `Realizzato solo l'${Math.round(d.spi * 100)}% di quanto previsto.`}</div>
          </div>
        </div>
      </div>

      <!-- Blocco Costi -->
      <div class="evm-duo-box">
        <h3>COSTI · Stiamo spendendo in modo efficiente?</h3>
        <div class="metrics">
          <div class="evm-metric-item">
            <b>Cost Variance (CV = EV - AC)</b>
            <div class="num" style="${d.cv >= 0 ? 'color:#166534' : 'color:#991b1b'}">${cvSign}${formatEuro(d.cv)}</div>
            <div class="desc">${d.cv >= 0 ? 'Costi inferiori al valore prodotto (risparmio).' : 'Costi superiori al valore prodotto (extracosto).'}</div>
          </div>
          <div class="evm-metric-item">
            <b>Cost Performance Index (CPI = EV / AC)</b>
            <div class="num" style="${d.cpi >= 1 ? 'color:#166534' : 'color:#991b1b'}">${d.cpi.toFixed(2)}</div>
            <div class="desc">Per ogni 1,00 € speso abbiamo prodotto <strong>${formatEuro(d.cpi)}</strong> di valore a budget.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Previsioni a finire (Forecasting) -->
    <h2 class="sub" style="margin-top:1.6rem;">Previsioni a finire (Forecasting)</h2>
    <div class="evm-forecast-grid">
      <div class="evm-forecast-card">
        <b>Estimate at Completion (EAC = BAC / CPI)</b>
        <div class="val" style="${d.eac > d.bac ? 'color:#991b1b' : 'color:#166534'}">${formatEuro(d.eac)}</div>
        <div class="desc">Stima del costo finale complessivo di progetto mantenendo l'attuale efficienza di spesa.</div>
      </div>
      <div class="evm-forecast-card">
        <b>Estimate to Complete (ETC = EAC - AC)</b>
        <div class="val">${formatEuro(d.etc)}</div>
        <div class="desc">Spesa ancora necessaria da sostenere per completare tutto il lavoro residuo.</div>
      </div>
      <div class="evm-forecast-card">
        <b>Variance at Completion (VAC = BAC - EAC)</b>
        <div class="val" style="${d.vac >= 0 ? 'color:#166534' : 'color:#991b1b'}">${vacSign}${formatEuro(d.vac)}</div>
        <div class="desc">${d.vac >= 0 ? 'Risparmio finale previsto rispetto al budget approvato.' : 'Scostamento economico negativo atteso a fine progetto.'}</div>
      </div>
    </div>
    ${charterAlert}

    <!-- Grafico Curve S -->
    <div class="evm-chart-card">
      <h3>Andamento Temporale · Curve a S (Earned Value S-Curve)</h3>
      <div class="evm-chart-legend">
        <span><i class="evm-swatch-pv"></i> PV <b>${formatEuro(d.pv)}</b></span>
        <span><i class="evm-swatch-ev"></i> EV <b>${formatEuro(d.ev)}</b></span>
        <span><i class="evm-swatch-ac"></i> AC <b>${formatEuro(d.ac)}</b></span>
        <span><i class="evm-swatch-eac"></i> EAC <b>${formatEuro(d.eac)}</b></span>
        <span><i class="evm-swatch-today"></i> Controllo <b>17 dic</b></span>
      </div>
      ${evmChartSvg(d)}
    </div>

    <!-- Tabella Analitica WBS -->
    <div class="evm-table-wrap" style="margin-top:1.8rem;">
      <table class="evm-table">
        <thead>
          <tr>
            <th>WBS</th>
            <th>Voce</th>
            <th class="num">Budget (BAC)</th>
            <th class="num">Avanzamento</th>
            <th class="num">PV (17/12)</th>
            <th class="num">EV (17/12)</th>
            <th class="num">AC (17/12)</th>
            <th class="num">SV (€)</th>
            <th class="num">CV (€)</th>
            <th class="num">CPI</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">Totale Progetto AllerTgy</td>
            <td class="num">${formatEuro(d.bac)}</td>
            <td class="num">${Math.round((d.ev / d.bac) * 100)}%</td>
            <td class="num">${formatEuro(d.pv)}</td>
            <td class="num">${formatEuro(d.ev)}</td>
            <td class="num">${formatEuro(d.ac)}</td>
            <td class="num" style="${d.sv >= 0 ? 'color:#166534' : 'color:#991b1b'}">${svSign}${formatEuro(d.sv)}</td>
            <td class="num" style="${d.cv >= 0 ? 'color:#166534' : 'color:#991b1b'}">${cvSign}${formatEuro(d.cv)}</td>
            <td class="num" style="${d.cpi >= 1 ? 'color:#166534' : 'color:#991b1b'}">${d.cpi.toFixed(2)}</td>
            <td>Metà Progetto</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function evmSideHtml() {
  const d = getEvmData();
  const selected = d.rows.find(r => r.id === state.selectedEvmWbs);

  if (selected) {
    const svS = selected.sv > 0 ? "+" : "";
    const cvS = selected.cv > 0 ? "+" : "";
    return `
      <p class="kicker"><b>WBS ${esc(selected.code)}</b> Dettaglio Voce</p>
      <h2>${esc(selected.name)}</h2>
      <p class="note">${esc(selected.note)}</p>

      <label>Budget a completamento (BAC)
        <input readonly value="${formatEuro(selected.bac)}">
      </label>
      <div class="pair">
        <label>Avanzamento reale
          <input readonly value="${Math.round(selected.pReal * 100)}%">
        </label>
        <label>Avanzamento pianificato
          <input readonly value="${Math.round(selected.pPlan * 100)}%">
        </label>
      </div>

      <div class="pair">
        <label>Planned Value (PV)
          <input readonly value="${formatEuro(selected.pv)}">
        </label>
        <label>Earned Value (EV)
          <input readonly value="${formatEuro(selected.ev)}">
        </label>
      </div>

      <div class="pair">
        <label>Actual Cost (AC)
          <input readonly value="${formatEuro(selected.ac)}">
        </label>
        <label>Stato
          <input readonly value="${selected.status}">
        </label>
      </div>

      <div class="pair">
        <label>Schedule Variance (SV)
          <input readonly style="${selected.sv >= 0 ? 'color:#166534;font-weight:700' : 'color:#991b1b;font-weight:700'}" value="${svS}${formatEuro(selected.sv)}">
        </label>
        <label>Cost Variance (CV)
          <input readonly style="${selected.cv >= 0 ? 'color:#166534;font-weight:700' : 'color:#991b1b;font-weight:700'}" value="${cvS}${formatEuro(selected.cv)}">
        </label>
      </div>

      <div class="pair">
        <label>SPI (Efficienza tempi)
          <input readonly value="${selected.spi.toFixed(2)}">
        </label>
        <label>CPI (Efficienza costi)
          <input readonly value="${selected.cpi.toFixed(2)}">
        </label>
      </div>

      <p class="actions" style="margin-top:1.2rem;">
        <button type="button" class="quiet" data-act="select-evm-wbs" data-id="">Chiudi selezione</button>
      </p>
    `;
  }

  return `
    <p class="kicker"><b>GUIDA EVM</b> Slide &amp; Formule</p>
    <h2>Earned Value</h2>
    <p class="note">Riferimento didattico per l'analisi dei costi di progetto alla data di controllo (17 dicembre 2026):</p>

    <div style="margin-top:0.9rem;font-size:0.86rem;line-height:1.45;">
      <p><strong>PV (Planned Value)</strong><br>Valore pianificato da baseline del lavoro che doveva essere completato a oggi.<br><em>PV = Budget × % Pianificata</em></p>
      
      <p style="margin-top:0.7rem;"><strong>EV (Earned Value)</strong><br>Valore calcolato secondo il budget del lavoro effettivamente realizzato.<br><em>EV = Budget × % Realizzata</em></p>

      <p style="margin-top:0.7rem;"><strong>AC (Actual Cost)</strong><br>Costo reale sostenuto per ottenere il lavoro prodotto.</p>

      <p style="margin-top:0.7rem;"><strong>SV (Schedule Variance)</strong><br>Scostamento temporale in valore economico: <em>SV = EV - PV</em>.<br>SV &gt; 0 avanti, SV &lt; 0 ritardo.</p>

      <p style="margin-top:0.7rem;"><strong>CV (Cost Variance)</strong><br>Scostamento di costo: <em>CV = EV - AC</em>.<br>CV &gt; 0 risparmio, CV &lt; 0 extracosto.</p>

      <p style="margin-top:0.7rem;"><strong>SPI (Schedule Performance Index)</strong><br>Efficienza temporale: <em>SPI = EV / PV</em>.<br>SPI &gt; 1 favorevole, SPI &lt; 1 ritardo.</p>

      <p style="margin-top:0.7rem;"><strong>CPI (Cost Performance Index)</strong><br>Efficienza di costo: <em>CPI = EV / AC</em>.<br>CPI &gt; 1 risparmio, CPI &lt; 1 inefficienza.</p>

      <p style="margin-top:0.7rem;"><strong>EAC (Estimate at Completion)</strong><br>Costo totale finale previsto: <em>EAC = BAC / CPI</em>.</p>
    </div>

    <div class="under" style="margin-top:1.2rem;border-radius:0.5rem;padding:0.7rem 0.8rem;">
      <label>Simulatore Rapido (Custom)</label>
      <p class="note" style="margin-top:0.2rem;font-size:0.78rem;">Modifica i parametri del pacchetto ristoratore (WBS 4):</p>
      <label>Avanzamento WBS 4 (%)
        <input data-evmfield="w4_pReal" type="number" min="0" max="100" step="5" value="${Math.round((d.rows[3].pReal) * 100)}">
      </label>
      <label>Costo AC WBS 4 (€)
        <input data-evmfield="w4_ac" type="number" min="0" step="10" value="${d.rows[3].ac}">
      </label>
    </div>
  `;
}

function chartsHtml() {
  const moment = state.boardMoment || "end";
  const tabs = [
    ["start", "Inizio sprint"],
    ["end", "Fine sprint"]
  ].map(([id, label]) => `<button type="button" data-act="board-moment" data-moment="${id}" ${moment === id ? 'aria-current="true"' : ""}>${label}</button>`).join("");
  const read = sprintRead();
  return `
    <p class="kicker"><b>04</b> Agile · Sprint 1</p>
    <h1>Avanzamento</h1>
    <p class="lede">Il burn-down dello Sprint 1, letto dalla Kanban. L'impegno non è cambiato, quindi è il grafico che dice se manca ancora lavoro.</p>
    <div class="sprint-tabs">${tabs}</div>
    ${progressHtml(read)}
    ${incrementHtml(read)}
  `;
}

function mainHtml() {
  const views = {
    backlog: backlogHtml,
    sprint: sprintHtml,
    kanban: kanbanHtml,
    charts: chartsHtml,
    wbs: wbsHtml,
    gantt: ganttHtml,
    raci: raciHtml,
    costi: evmHtml
  };
  const draw = views[state.view] || backlogHtml;
  const notice = state.notice ? `<p class="notice" role="status">${esc(state.notice)}</p>` : "";
  return notice + draw();
}

function storySide(story) {
  const card = (state.board || []).find((item) => item.id === state.selectedCard && item.storyId === story.id);
  const activity = card ? `<p class="note">${esc(card.title)}</p>` : "";
  const options = ["backlog", "sprint", "doing", "done"].map((status) => `<option value="${status}" ${story.status === status ? "selected" : ""}>${esc(statusLabel(status))}</option>`).join("");
  const nodes = [`<option value="" ${story.wbs ? "" : "selected"}>—</option>`]
    .concat(state.wbs.map((node) => `<option value="${node.id}" ${story.wbs === node.id ? "selected" : ""}>${esc(node.code)} ${esc(node.name)}</option>`))
    .join("");
  return `
    <p class="kicker"><b>${esc(story.name || "Storia")}</b></p>
    ${activity}
    <label>Nome <input data-field="name" value="${esc(story.name || "")}"></label>
    <label>Persona <input data-field="persona" value="${esc(story.persona)}"></label>
    <label>Voglio <textarea data-field="want" rows="3">${esc(story.want)}</textarea></label>
    <label>Così da <textarea data-field="so" rows="2">${esc(story.so)}</textarea></label>
    <div class="pair">
      <label>Story point <input data-field="points" type="number" min="0" step="1" placeholder="vuoto" value="${pointValue(story.points) == null ? "" : esc(pointValue(story.points))}"></label>
      <label>Priorità
        <select data-field="priority">
          <option value="alta" ${story.priority === "alta" ? "selected" : ""}>Alta</option>
          <option value="media" ${story.priority === "media" ? "selected" : ""}>Media</option>
          <option value="bassa" ${story.priority === "bassa" ? "selected" : ""}>Bassa</option>
        </select>
      </label>
    </div>
    <label>Stato <select data-field="status">${options}</select></label>
    <label>Voce WBS <select data-field="wbs">${nodes}</select></label>
    <p class="actions">
      <button type="button" class="quiet" data-act="delete-story" data-id="${story.id}">Togli la storia</button>
    </p>
  `;
}

function wbsSide(node) {
  const kids = kidsOf(node.id);
  const effort = effortOf(node);
  const roll = kids.length && effort.known
    ? `<p class="note">I figli sommano ${esc(formatDays(effort.days))} e ${esc(formatEuro(effort.cost))}.</p>`
    : "";
  const measure = kids.length ? "" : `
    <div class="pair">
      <label>Giorni <input data-wfield="days" type="number" min="0" step="0.25" value="${node.days == null ? "" : esc(node.days)}"></label>
      <label>Cassa, euro <input data-wfield="cost" type="number" min="0" step="1" value="${node.cost == null ? "" : esc(node.cost)}"></label>
    </div>`;
  const note = node.note ? `<p class="note">${esc(node.note)}</p>` : "";
  const reasons = linksOf(node)
    .filter((link) => link.why)
    .map((link) => `<p class="note"><b>${esc(codeOf(link.id))} ${esc(link.type)}</b> ${esc(link.why)}</p>`)
    .join("");
  const half = node.days != null && node.at
    ? `<p class="note">${node.at >= 0.5 ? "Parte a mezza giornata." : "Parte dopo un quarto di giornata."} La durata è ${esc(formatDays(node.days))}.</p>`
    : "";
  return `
    <p class="kicker"><b>${esc(node.code)}</b> WBS</p>
    <label>Codice <input data-wfield="code" value="${esc(node.code)}"></label>
    <label>Nome <input data-wfield="name" value="${esc(node.name)}"></label>
    <label>Responsabile operativo <input data-wfield="owner" value="${esc(node.owner)}"></label>
    ${roll}
    ${measure}
    ${note}
    ${half}
    ${reasons}
    <p class="note">Inizio e fine non hanno una data di calendario. La barra tiene solo la sequenza.</p>
    <label>Legami, codice e tipo <input data-wfield="depends" value="${esc(formatLinks(node))}"></label>
    <label class="check"><input data-wfield="milestone" type="checkbox" ${node.milestone ? "checked" : ""}> Milestone</label>
    <label class="check"><input data-wfield="done" type="checkbox" ${node.done ? "checked" : ""}> Fatto</label>
    <p class="actions">
      <button type="button" class="act" data-act="add-wbs">Aggiungi sotto</button>
      <button type="button" class="quiet" data-act="delete-wbs" data-id="${node.id}">Togli la voce</button>
    </p>
  `;
}

function sideHtml() {
  if (state.view === "costi") {
    return evmSideHtml();
  }
  if (state.view === "raci") {
    return raciSideHtml();
  }
  if (state.mode === "agile") {
    const story = findStory(state.selectedStory);
    if (story) return storySide(story);
  } else {
    const node = findWbs(state.selectedWbs);
    if (node) return wbsSide(node);
  }
  return `<p class="kicker"><b>ALT</b> MVP</p><h2>Seleziona una voce</h2><p class="note">Il piano resta in questo browser. Date e costi non sono specificati.</p>`;
}

function render() {
  if (state.view === "criteri" || state.view === "stima") state.view = "backlog";
  if (state.mode === "predictive" && state.view !== "costi" && state.view !== "raci" && !underWbs(state.selectedWbs, "w2")) state.selectedWbs = "w2";
  if (state.view === "raci" && !RACI_ROWS.some((row) => row.id === state.selectedWbs)) state.selectedWbs = "w211";
  const main = document.getElementById("main");
  const side = document.getElementById("side");
  const key = state.mode + state.view;
  const keep = lastView === key;
  const mainY = keep ? main.scrollTop : 0;
  const sideY = side.scrollTop;
  document.body.dataset.view = state.view;
  document.getElementById("rail").innerHTML = railHtml();
  main.innerHTML = mainHtml();
  side.innerHTML = sideHtml();
  main.scrollTop = mainY;
  side.scrollTop = sideY;
  lastView = key;
  if (state.view === "gantt") requestAnimationFrame(drawGanttLinks);
}

document.addEventListener("DOMContentLoaded", () => {
  state = load();
  save();
  document.body.addEventListener("click", onClick);
  document.getElementById("brief").addEventListener("click", (event) => {
    if (event.target.id === "brief") event.target.close();
  });
  document.body.addEventListener("change", onChange);
  document.body.addEventListener("dragstart", onDragStart);
  document.body.addEventListener("dragover", onDragOver);
  document.body.addEventListener("dragleave", onDragLeave);
  document.body.addEventListener("drop", onDrop);
  document.body.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("input, textarea, select, button")) return;
    const row = event.target.closest(".row, .card, .wrow, .raci-row");
    if (!row) return;
    event.preventDefault();
    row.click();
  });
  render();
  window.addEventListener("resize", () => {
    if (state && state.view === "gantt") drawGanttLinks();
  });
});
