// Stop synchrone : bloque la fin de tour si (1) derniere operation de prod non verifiee
// OU (2) le message final AFFIRME quelque chose sans l'avoir etaye (negation d'existence
// nue, ou completion "c'est fait" sans action ni verif). Bypass [NO-VERIFY:] audite.
// Lance via : cat /dev/stdin | node stop-verify.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const noVerifyLog = path.join(os.homedir(), '.claude', '.no-verify.log');
const pendingLog = path.join(os.homedir(), '.claude', '.pending-verify.log');

// Protocole de verification par surface (~/.claude/verification-protocol.md) : source
// unique de "quel artefact pour quelle surface". Le message de blocage NOMME l'artefact
// attendu au lieu d'un rappel generique. Degrade en silence si le fichier est absent.
function protocole(surface) {
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.claude', 'verification-protocol.md'), 'utf8');
    for (const bloc of raw.split(/\n(?=## )/)) {
      const h = bloc.match(/^## ([a-z-]+) /);
      if (!h || h[1] !== surface) continue;
      const get = cle => (bloc.match(new RegExp('^- ' + cle + ': (.+)$', 'm')) || [])[1] || '';
      const out = [];
      const a = get('artefact'), c = get('commande'), x = get('contre-exemple');
      if (a) out.push('  artefact attendu : ' + a);
      if (c) out.push('  commande         : ' + c);
      if (x) out.push('  deja paye ici    : ' + x);
      if (!out.length) return '';
      return '\nPROTOCOLE [' + surface + '] (~/.claude/verification-protocol.md) :\n' + out.join('\n') + '\n';
    }
  } catch (e) {}
  return '';
}

// Drapeaux de succes silencieux poses par hooks/post-bash-silent-fail.js. Ils survivent
// a un tour BLOQUE (le tour n'est pas fini) et sont purges des qu'un tour se termine
// sans blocage, sinon le gate se bloquerait lui-meme indefiniment.
function readPending() {
  try {
    return fs.readFileSync(pendingLog, 'utf8').split('\n').map(l => l.trim()).filter(Boolean).slice(-5);
  } catch (e) { return []; }
}
function clearPending() {
  try { if (fs.existsSync(pendingLog)) fs.writeFileSync(pendingLog, ''); } catch (e) {}
}

let input = '';
try { input = fs.readFileSync(0, 'utf8'); } catch(e) { process.exit(0); }

let j;
try { j = JSON.parse(input); } catch(e) { process.exit(0); }

const transcript = j.transcript_path || '';
if (!transcript || !fs.existsSync(transcript)) process.exit(0);

const isBashProducer = (cmd) => {
  if (!cmd) return false;
  const patterns = [
    /\bgit\s+(commit|push|reset|checkout\s+--|rm\b|mv\b|merge|rebase|branch\s+-D|tag\s+-d)/,
    /(^|[\s;&|])rm\s+/,
    /(^|[\s;&|])mv\s+/,
    /(^|[\s;&|])cp\s+/,
    /(^|[\s;&|])mkdir\s+/,
    /(^|[\s;&|])touch\s+/,
    /(^|[\s;&|])chmod\s+/,
    /(^|[\s;&|])chown\s+/,
    /\bnpm\s+(install|i\b|update|uninstall|remove|run\s+build|run\s+deploy)/,
    /\bcomposer\s+(install|require|remove|update)/,
    /\bpip\s+(install|uninstall)/,
    /\byarn\s+(add|remove|install)/,
    /\bsed\s+-i\b/,
    /(^|[\s;&|])tee\s+/,
    />\s*(?!\/dev\/null)[^|&\s]/, // redirection vers un fichier reel ; exclut 2>/dev/null & co (suppression stderr, pas une prod)
    /\bcurl\s+.*-X\s+(POST|PUT|DELETE|PATCH)/i,
    /\bgh\s+(pr\s+(create|merge|close)|issue\s+(create|close))/,
  ];
  return patterns.some(p => p.test(cmd));
};

const lines = fs.readFileSync(transcript, 'utf8').split('\n').filter(l => l.trim());
const toolEvents = [];
// Frontiere du TOUR COURANT. Sans elle, "as-tu lance les tests CE TOUR" repondait oui
// sur un run fait deux heures plus tot dans la meme session : les gates 2b/2c/2d/2f
// annoncent "ce tour" et inspectaient tout le transcript (faux negatif silencieux).
// Un message role=user porteur d'un bloc text = une vraie prise de parole ; les
// tool_result reviennent aussi en role=user, d'ou le filtre sur le type de bloc.
let turnStart = 0;
let lastAssistantText = '';

for (const line of lines) {
  try {
    const e = JSON.parse(line);
    const content = e.message && e.message.content;
    if (!Array.isArray(content)) continue;
    const role = e.message.role;
    if (role === 'user' && content.some(c => c && c.type === 'text')) turnStart = toolEvents.length;
    for (const c of content) {
      if (c.type === 'tool_use') {
        let kind = 'verify';
        let target = '';
        if (c.name === 'Edit' || c.name === 'Write' || c.name === 'NotebookEdit') {
          kind = 'produce';
          target = (c.input && c.input.file_path) || '';
        } else if (c.name === 'Bash') {
          const cmd = (c.input && c.input.command) || '';
          kind = isBashProducer(cmd) ? 'produce' : 'verify';
          target = cmd.slice(0, 80);
        } else if (['Read','Grep','Glob'].includes(c.name)) {
          kind = 'verify';
          if (c.name === 'Read') target = (c.input && c.input.file_path) || '';
        } else {
          kind = 'other';
        }
        toolEvents.push({ name: c.name, kind, target, full: (c.name === 'Bash' ? ((c.input && c.input.command) || '') : '') });
      } else if (c.type === 'text' && role === 'assistant') {
        lastAssistantText = c.text || '';
      }
    }
  } catch(err) {}
}

// Outils du TOUR COURANT : c'est sur eux que portent les gates 2b a 2g.
const turnEvents = toolEvents.slice(turnStart);

// --- Bypass audite : tout [NO-VERIFY:] est logge pour revision (review-meta) ---
// Depuis le 2026-09-04 le bypass vaut AVEU, pas dispense generale : il ne couvre plus le
// gate 1 (production non verifiee) et exige une raison non vide. 152 bypass avaient ete
// poses sans que rien ne les relise ; /review-meta les depouille desormais.
let bypass = false;
if (/\[NO-VERIFY:/i.test(lastAssistantText)) {
  try {
    const m = lastAssistantText.match(/\[NO-VERIFY:([^\]]*)\]/i);
    const reason = (m && m[1] ? m[1].trim() : '').replace(/\s+/g, ' ');
    const claim = lastAssistantText.replace(/\s+/g, ' ').trim().slice(0, 180);
    fs.appendFileSync(noVerifyLog, `[${new Date().toISOString()}] reason="${reason}" claim="${claim}"\n`);
  } catch (e) {}
  const raison = ((lastAssistantText.match(/\[NO-VERIFY:([^\]]*)\]/i) || [])[1] || '').trim();
  if (!raison) {
    process.stderr.write('[NO-VERIFY:] VIDE (hook never-assume) :\n'
      + 'Un bypass doit NOMMER ce que tu n as pas pu observer : [NO-VERIFY: <ce que je n ai pas vu>].\n'
      + 'Un marqueur nu est une dispense sans trace — c est ce qui a laisse passer six livraisons\n'
      + 'vertes sur la mauvaise page (meta/erreurs.md, 2026-08-27).\n');
    process.exit(2);
  }
  bypass = true;
}

// --- Gate 1 : derniere operation de PRODUCTION non verifiee (comportement historique) ---
let lastProdIdx = -1;
for (let i = toolEvents.length - 1; i >= 0; i--) {
  if (toolEvents[i].kind === 'produce') { lastProdIdx = i; break; }
}
if (lastProdIdx !== -1) {
  // Fenetre : [lastProdIdx - 5, end]. Couvre les tool_uses paralleles (Claude Code
  // ecrit les entries dans l'ordre de COMPLETION du tool_use, pas d'emission).
  // Quand Bash + Grep sont paralleles, les Grep finissent souvent avant et sont
  // ecrits avant le Bash dans le JSONL meme s'ils sont conceptuellement "ensemble".
  const windowStart = Math.max(0, lastProdIdx - 5);
  const windowVerif = toolEvents.slice(windowStart).find(e => e.kind === 'verify');
  if (!windowVerif) {
    const lastProd = toolEvents[lastProdIdx];
    process.stderr.write(`VERIF MANQUANTE (hook never-assume) :
Ta derniere operation de production
  ${lastProd.name}: ${lastProd.target}
n'est suivie d'AUCUN tool call de verification (Read/Grep/Bash de check).

Action attendue avant fin de tour :
  - lance grep/run/cat/git diff/test
  - confirme que ta modification fait ce qu'elle doit faire

Annoncer "fait/livre/done" sans avoir vu le resultat = violation never-assume.

Bypass legitime : si verif impossible (changement purement declaratif, doc pure, etc.), inclus dans ta prochaine reponse le marqueur :
  [NO-VERIFY: <raison breve>]
`);
    process.exit(2);
  }
}

// Le bypass sert a affirmer SOUS RESERVE : il neutralise les gates d'assertion (2a-2g),
// jamais le gate 1, qui porte sur une production reelle non regardee.
if (bypass) { clearPending(); process.exit(0); }

// --- Gate 2 : AFFIRMATION non etayee dans le message final ---
// On n'inspecte que le dernier bloc texte assistant, ligne par ligne, en ecartant
// les lignes interrogatives / hypothetiques / citees (anti faux-positif).
const cleanLines = lastAssistantText.split('\n')
  .map(l => l.trim())
  .filter(l => l
    && !l.endsWith('?')
    && !/^>/.test(l)
    && !/^(si |est-ce que|et si |au cas|peut-?etre)/i.test(l));
const assertText = cleanLines.join('\n');

// Preuves d'une recherche LARGE dans le tour : Glob, ou des `find/locate` couvrant >=2 racines.
const rootList = ['/c/Users', 'laragon/www', 'Desktop', '/home/', '$HOME', '~/'];
const rootsUnion = new Set();
let sawSearchTool = false;
for (const e of toolEvents) {
  if (e.name === 'Glob') sawSearchTool = true;
  if (e.name === 'Bash' && /\b(find|locate)\b|everything|es\.exe/i.test(e.full || '')) {
    sawSearchTool = true;
    for (const r of rootList) if ((e.full || '').includes(r)) rootsUnion.add(r);
  }
}
const broadSearch = toolEvents.some(e => e.name === 'Glob') || rootsUnion.size >= 2;
// Scope explicite dans le texte ("introuvable SOUS /c/...", "dans le repo X").
const scopeQualified = /\b(sous|dans|à la racine|au sein de)\b/i.test(lastAssistantText)
  && /[\/\\]|laragon|www|Desktop|Users|home|repo|dossier/i.test(lastAssistantText);

// 2a. Negation d'existence nue (ni recherche large, ni scope qualifie).
const NEG = /n['’]existe pas|introuvable|il n['’]y a (pas|aucun)|aucun[e]?\s+\S+\s+(trouvé|trouvée|existe|présent|détecté)|pas de\s+\S+\s+(trouvé|présent|existant)/i;
if (NEG.test(assertText) && !broadSearch && !scopeQualified) {
  process.stderr.write(`AFFIRMATION NEGATIVE NUE (hook never-assume) :
Tu affirmes une INEXISTENCE ("n'existe pas / introuvable / aucun") sans l'etayer.
Une recherche LOCALE ne justifie pas une negation GLOBALE.

Avant de conclure :
  - recherche LARGE (home + www + Desktop), ex: find sur >=2 racines / Glob ; OU
  - qualifie explicitement le scope ("introuvable SOUS <chemin>") ; OU
  - en doute sur l'emplacement, DEMANDE au lieu de trancher.

Bypass si justifie : [NO-VERIFY: <raison breve>]
` + protocole('existence'));
  process.exit(2);
}

// 2b. Completion affirmee SANS aucune action ni verif dans le tour.
const DONE = /(?<![a-zà-ÿ0-9_])(c['’]est fait|c['’]est bon|(termin|livr|corrig|régl)ée?s?|(termin|livr|corrig|régl)és?|ça marche|opérationnel(le)?s?)(?![a-zà-ÿ0-9_])/i;
// Elargi le 2026-09-04 : la condition d'origine (toolEvents.length === 0) ne se declenchait
// que sur un tour SANS AUCUN outil, cas rarissime. Le cas reel est un tour plein d'outils
// dont aucun ne regarde le resultat -> on exige au moins une VERIF dans le tour courant.
if (DONE.test(assertText) && !turnEvents.some(e => e.kind === 'verify')) {
  process.stderr.write(`AFFIRMATION DE COMPLETION SANS PREUVE (hook never-assume) :
Tu annonces "fait / corrige / ca marche" alors qu'AUCUN tool n'a tourne ce tour.
Un build/checkpoint anterieur n'est pas une preuve de l'etat courant.

Avant de conclure : lance une verif (Read/Grep/Bash de check) qui montre le resultat.
Bypass si verif impossible : [NO-VERIFY: <raison breve>]
` + protocole('feature-runtime'));
  process.exit(2);
}

// 2c. "Pret a push / CI vert / tests passent" SANS avoir lance la commande de test ce tour.
// Sous-classe la plus chere et la plus gateable de proxy-vs-artefact-reel (incidents 2026-06-22).
const GREEN = /\b(prêt[es]* (à|a|pour)\s+(le\s+)?push|prêt[es]* à pousser|bon pour (le\s+)?push|on peut pousser|CI\s+(vert|au vert|passe|est vert|green)|suite\s+(verte|au vert)|tests?\s+(passent|sont\s+verts?|au vert|OK\b)|tout\s+est\s+vert)\b/i;
const TESTCMD = /\b(php artisan test|artisan test|phpunit|\bpest\b|npm (run )?test|npm t\b|yarn test|pnpm test|vitest|jest|cypress (run|open)|playwright|pytest|go test|cargo test|mvn (test|verify)|gradle test|\bctest\b)\b/i;
const NODETEST = /\bnode\b[^\n]*test[^\n]*\.(?:c?js|mjs|ts)\b/i; // harnais node maison (ex: node test-X.js)
// Runners supplementaires editables sans toucher au code (1 motif litteral par ligne, # = commentaire).
let extraTest = null;
try {
  const tf = path.join(os.homedir(), '.claude', 'hooks', 'test-runners.txt');
  if (fs.existsSync(tf)) {
    const pats = fs.readFileSync(tf, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (pats.length) extraTest = new RegExp(pats.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  }
} catch (e) {}
const ranTests = turnEvents.some(e => e.name === 'Bash' &&
  (TESTCMD.test(e.full || '') || NODETEST.test(e.full || '') || (extraTest && extraTest.test(e.full || ''))));
if (GREEN.test(assertText) && !ranTests) {
  process.stderr.write(`"PRET A PUSH / CI VERT" SANS RUN (hook never-assume) :
Tu affirmes que c'est vert / poussable sans avoir lance la suite ce tour.
Une revue statique, un build, un SESSION.md "vert" ne sont PAS le CI (cf 2026-06-22 x3).

Avant de conclure : rejoue la commande EXACTE du runner (lire le .yml) depuis une base propre
(ex: php artisan test --parallel / npm test / cypress run), et constate le resultat.
Bypass si run impossible ici : [NO-VERIFY: <raison breve>]
` + protocole('ci'));
  process.exit(2);
}

// 2d. Rendu visuel affirme correct SANS avoir regarde l'image/le pixel ce tour (classe docx/navigateur).
const VISUAL = /(?<![a-zà-ÿ0-9_])(rendu|affichage|mise en page|logo|visuel)(?![a-zà-ÿ0-9_])[^.?!\n]{0,60}(?<![a-zà-ÿ0-9_])(correct|conforme|bon|bonne|nickel|impeccable|(align|centr)ée?s?|(align|centr)és?|propre|entier|visible|bien ((plac|positionn|affich|align)ée?s?|(plac|positionn|affich|align)és?|rendu))(?![a-zà-ÿ0-9_])|s['’]affiche\s+(correctement|bien|comme attendu)/i;
const sawImage = turnEvents.some(e =>
  (e.name === 'Read' && /\.(png|jpe?g|gif|webp|bmp|svg|pdf)$/i.test(e.target || '')) ||
  (e.name === 'Bash' && /pdftoppm|screencapture|ExportAsFixedFormat|--screenshot|\.screenshot\(|import -window/i.test(e.full || '')));
if (VISUAL.test(assertText) && !sawImage) {
  process.stderr.write(`RENDU VISUEL AFFIRME SANS L'AVOIR REGARDE (hook never-assume) :
Tu affirmes qu'un rendu/logo/affichage est correct sans avoir lu d'image ce tour.
Une metrique (taille, position, "le shape existe") n'est PAS le rendu (cf docx 2026-06-23).

Avant de conclure : produis l'image (pdftoppm -png / export PDF / screenshot) et Read-la.
Bypass si verif visuelle impossible ici : [NO-VERIFY: <raison breve>]
` + protocole('visuel'));
  process.exit(2);
}

// 2e. Aveu de SCOPE-CREEP (Karpathy #3 "surgical changes") : le message final admet un
// changement collateral non demande ("au passage / j'en ai profite / tant qu'a faire /
// j'ai aussi refactorise-nettoye"), ET une operation de production a eu lieu ce tour.
// Signal choisi car propre : detecter un diff hors-scope sans l'aveu = trop de faux positifs.
const producedThisTurn = toolEvents.some(e => e.kind === 'produce');
const CREEP = /(?<![a-zà-ÿ0-9_])(au passage|j['’]en ai profité|tant qu['’]à faire|pendant que j['’]y ét[ai]|quitte à|dans la foulée)(?![a-zà-ÿ0-9_])|j['’]ai (aussi|également|par la même occasion)\s+(refactoris|nettoy|simplifi|réécri|reécri|reformat|réorganis|reorganis|amélior|renomm)/i;
if (CREEP.test(assertText) && producedThisTurn) {
  process.stderr.write(`AVEU DE SCOPE-CREEP (hook surgical / Karpathy #3) :
Ton message final admet un changement COLLATERAL non demande
("au passage / j'en ai profite / j'ai aussi refactorise-nettoye...")
alors que tu as modifie du code ce tour.

Regle : chaque ligne modifiee doit tracer DIRECTEMENT a la demande. Interdit d'ameliorer,
refactoriser ou reformater le code adjacent, ou de supprimer du dead code preexistant.

Action attendue :
  - si le changement collateral est HORS-SCOPE : reverte-le, et SIGNALE-le a l'utilisateur
    (sans l'appliquer) pour qu'il decide.
  - s'il etait indispensable a la demande (orphelin cree par ta modif) : reformule sans
    langage d'aveu, ce n'est pas du scope-creep.

Bypass si l'utilisateur a explicitement autorise ce changement : [NO-VERIFY: <raison breve>]
`);
  process.exit(2);
}

// --- Gate 2f : ASSERTION DE CAUSE/HISTORIQUE non etayee (recit-causal-invente, incident 2026-07-17) ---
// J'ai explique un etat git (renames RD) par "staged ce matin / git mv ce matin" — une backstory
// fabriquee pour combler un trou de comprehension, sans artefact (le staging n'est meme pas dans
// le reflog). Signal haute-precision : reference a un moment/session PASSE que je ne peux pas avoir
// observe ce tour ("ce matin", "hier", "la veille", "la derniere session"). Legitime seulement si un
// artefact date a ete consulte ce tour (git log/reflog/show/blame/whatchanged, ou stat/ls -l).
const CAUSAL = /\b(ce matin|cet apr[eè]s-?midi|hier|la veille|avant-?hier|tout à l['’]heure|la derni[eè]re session|lors d['’]une (précédente|autre) session|dans une session (précédente|antérieure))\b/i;
const sawHistoryArtifact = turnEvents.some(e => e.name === 'Bash' &&
  /\bgit\s+(log|reflog|show|blame|whatchanged)\b|(^|[\s;&|])stat\s|(^|[\s;&|])ls\s+-l/i.test(e.full || ''));
if (CAUSAL.test(assertText) && !sawHistoryArtifact) {
  process.stderr.write(`ASSERTION DE CAUSE/HISTORIQUE NON ETAYEE (hook never-assume / recit-causal-invente) :
Tu attribues un etat observe a un moment/session passe ("ce matin / hier / la derniere session")
sans avoir consulte d'artefact date ce tour. Une explication d'HISTOIRE est une assertion, pas du
commentaire de contexte — le staging n'est meme pas dans le reflog (incident 2026-07-17).

Avant de conclure :
  - produis l'artefact date (git log/reflog/show/blame, ou stat/ls -l sur le fichier) ; OU
  - n'affirme AUCUNE cause : dis "origine non verifiee, je ne sais pas quand ni comment".

Bypass si l'artefact est impossible ici : [NO-VERIFY: <raison breve>]
` + protocole('etat-de-session'));
  process.exit(2);
}

// --- Gate 2g : SUCCES SILENCIEUX signale ce tour, et pourtant tu annonces que c'est fait ---
// Alimente par hooks/post-bash-silent-fail.js (PostToolUse Bash|PowerShell). Repond a la
// classe dominante des erreurs du vault : exit 0, aucune erreur affichee, rien n'a tourne
// (38 des 46 entrees de meta/erreurs.md en 2026-08).
const pending = readPending();
if (pending.length && (DONE.test(assertText) || GREEN.test(assertText))) {
  const surface = (pending[0].match(/surface=(\S+)/) || [])[1] || 'feature-runtime';
  process.stderr.write('SUCCES SILENCIEUX NON LEVE (hook never-assume / gate 2g) :\n'
    + 'Une commande de ce tour est sortie en EXIT 0 en n ayant RIEN fait, et tu annonces\n'
    + 'malgre tout que c est fait / vert :\n'
    + pending.map(l => '  ' + l).join('\n') + '\n\n'
    + 'Un lanceur qui ne trouve rien et rend 0 est indiscernable d un lanceur qui passe tout\n'
    + '(meta/erreurs.md, 2026-08-28 : cypress, exit 0, zero test execute).\n\n'
    + 'Avant de conclure : relance en corrigeant la cause (motif d exclusion, chemin, filtre),\n'
    + 'et constate un NOMBRE d unites traitees non nul.\n'
    + 'Bypass si faux positif : [NO-VERIFY: <pourquoi cette sortie est normale>]\n'
    + protocole(surface));
  process.exit(2);
}

clearPending();
process.exit(0);
