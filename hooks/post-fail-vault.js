// PostToolUseFailure : cherche dans le vault une note deja ecrite sur CET echec
// et l'injecte a cote du resultat d'outil, AVANT toute commande de diagnostic.
//
// Cause d'incident 2026-08-10 : `composer create-project` echoue en "self-signed
// certificate in certificate chain" ; six appels d'outils pour rediagnostiquer une
// interception TLS Cato documentee depuis le 2026-07-16 (meta/concepts/cato-tls-interception.md
// + learnings.md). La trace existait, rien ne declenchait sa lecture.
//
// Selection par IDF : un terme present dans beaucoup de notes ne discrimine rien,
// un terme rare designe la note. Pas de cache — ~460 Ko de markdown se lisent en
// quelques ms et un index sur disque introduirait un bug de peremption.

const fs = require('fs');
const path = require('path');

const MIN_TERM_LEN = 5;
const MIN_SCORE = 0.2;    // un terme present dans <=5 unites, ou deux dans <=10. En dessous : coincidence de vocabulaire
const MAX_HITS = 3;

// L'IDF seul ne suffit pas : dans un vault francophone, un mot anglais banal
// ("while", "fully", "loaded") est RARE donc surevalue, et remonte devant la vraie
// note. Le stoplist retire le vocabulaire non technique des deux langues ; l'IDF
// se charge ensuite du vocabulaire technique trop courant (composer, docker, laravel).
const STOP = new Set([
  'https', 'http', 'error', 'erreur', 'erreurs', 'failed', 'failure', 'warning', 'fatal',
  'while', 'fully', 'loaded', 'could', 'would', 'should', 'about', 'after', 'before',
  'where', 'which', 'their', 'there', 'these', 'those', 'other', 'being', 'because',
  'cannot', 'again', 'already', 'always', 'never', 'please', 'first', 'found', 'given',
  'inside', 'instead', 'maybe', 'might', 'above', 'below', 'under', 'until', 'without',
  'information', 'problem', 'problems', 'chain', 'value', 'values', 'result', 'results',
  'trying', 'during', 'still', 'every', 'means', 'known', 'unknown', 'available',
  'expected', 'received', 'required', 'missing', 'invalid', 'unable', 'total', 'level',
  'dans', 'pour', 'avec', 'cette', 'comme', 'tout', 'tous', 'toute', 'toutes', 'mais',
  'plus', 'sans', 'sous', 'leur', 'leurs', 'elle', 'elles', 'meme', 'memes', 'donc',
  'alors', 'entre', 'depuis', 'apres', 'avant', 'encore', 'aussi', 'ainsi', 'chaque',
  'quand', 'quoi', 'dont', 'celui', 'celle', 'faire', 'fait', 'etait', 'etre', 'avoir',
  'peut', 'doit', 'fichier', 'fichiers', 'ligne', 'lignes', 'exemple',
]);

// Journaux append-only : une note utile = une SECTION `## ...`, pas le fichier entier.
const JOURNALS = /^(erreurs|learnings|decisions-recurrentes|archive-[0-9]{4})\.md$/;
// meta/ = memoire d'incident, infra/ + technos/ = etat et contraintes du parc.
// tools/ est volontairement exclu : ce sont des docs de reference externes (git,
// rspack, vscode) qui ne racontent aucun incident vecu et qui, testees le 2026-08-10,
// ramassaient des termes generiques (syntax, parse, command) sur des echecs sans rapport.
const SCAN = ['meta', 'meta/concepts', 'infra', 'technos'];

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Les nombres de 4 chiffres et plus sont gardes : un port (3306, 8080) ou un code
// d'erreur est souvent LE token qui designe la note, la ou le reste du message
// ("address already in use") n'existe dans aucune note francophone.
const keep = t => !STOP.has(t) && (t.length >= MIN_TERM_LEN || (t.length >= 4 && /^\d+$/.test(t)));
const terms = s => new Set(norm(s).split(/[^a-z0-9]+/).filter(keep));

function readInput() {
  try {
    // UNIQUEMENT `error`. Joindre la commande paraissait utile (elle nomme l'outil)
    // mais ses tokens generiques — docker, compose, artisan, tests — matchent une note
    // sur trois : verifie le 2026-08-10, un `php artisan test` en echec remontait
    // trois notes sur les gates de verification, sans aucun rapport avec l'echec.
    // Tronque : le message utile est en tete, la suite est du remplissage d'outil
    // (banniere d'usage, liste de flags, stack trace). Verifie le 2026-08-10 sur un
    // `composer show` en echec — les flags --locked/--strict/--patch-only devenaient
    // des termes de scoring et ejectaient les notes Cato du top 3.
    return (JSON.parse(fs.readFileSync(0, 'utf8')).error || '').slice(0, 1200);
  } catch (e) { return ''; }
}

function walk(dir, recurse) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (recurse) out.push(...walk(full, recurse)); }
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// Une unite = ce qu'on proposera de lire : une section de journal, ou un fichier entier.
function units(vault) {
  const out = [];
  for (const rel of SCAN) {
    const dir = path.join(vault, rel);
    // Scan a plat : meta/ recursif remonterait meta/concepts/ une seconde fois.
    for (const file of walk(dir, false)) {
      let raw;
      try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
      const label = path.relative(vault, file).replace(/\\/g, '/');
      if (JOURNALS.test(path.basename(file))) {
        for (const chunk of raw.split(/\n(?=## )/)) {
          const title = (chunk.match(/^## (.+)$/m) || [])[1];
          if (title) out.push({ label, title, text: chunk });
        }
      } else {
        const title = (raw.match(/^# (.+)$/m) || [])[1] || path.basename(file, '.md');
        out.push({ label, title, text: raw });
      }
    }
  }
  return out;
}

function excerpt(u) {
  const body = u.text.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';
  return body.trim().length > 170 ? body.trim().slice(0, 167) + '...' : body.trim();
}

const conf = require('./lib/vault-conf.js')();
const VAULT = conf.CLAUDE_VAULT || '';
const errText = readInput();
const wanted = terms(errText);

if (!VAULT || !fs.existsSync(VAULT) || wanted.size === 0) process.exit(0);

const all = units(VAULT);
if (all.length === 0) process.exit(0);

// df par terme, puis score = somme des 1/df des termes distinctifs presents.
const df = new Map();
const present = all.map(u => {
  const bag = new Set();
  const text = norm(u.text);
  for (const t of wanted) {
    if (text.includes(t)) { bag.add(t); df.set(t, (df.get(t) || 0) + 1); }
  }
  return bag;
});

// Pas de coupure dure sur le df : un terme courant (composer, docker) pese peu via
// 1/df mais departage deux notes a egalite. C'est le seuil de score global qui exige
// qu'au moins un terme soit reellement discriminant.
const scored = [];
all.forEach((u, i) => {
  let score = 0;
  for (const t of present[i]) score += 1 / df.get(t);
  // Penalite de longueur : un document de reference de 14 Ko (tools/git.md) ramasse
  // des termes generiques par accumulation et passait devant une fiche concept de
  // 400 octets qui, elle, parle exactement du sujet.
  score /= Math.max(1, Math.log10(u.text.length / 400));
  if (score >= MIN_SCORE) {
    const matched = [...present[i]].sort((a, b) => df.get(a) - df.get(b)).slice(0, 4);
    scored.push({ u, score, matched });
  }
});

if (scored.length === 0) process.exit(0);

scored.sort((a, b) => b.score - a.score);
const lines = ['VAULT — notes deja ecrites qui pourraient couvrir cet echec. Les lire AVANT toute commande de diagnostic :'];
for (const { u, matched } of scored.slice(0, MAX_HITS)) {
  lines.push('  ' + u.label + (u.label.includes('/concepts/') ? '' : ' :: ' + u.title) + '   [' + matched.join(' ') + ']');
  const ex = excerpt(u);
  if (ex) lines.push('      ' + ex);
}
lines.push("Si aucune ne correspond, dis-le et diagnostique. Sinon : Read la note, applique ce qu'elle documente, ne redecouvre pas.");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PostToolUseFailure', additionalContext: lines.join('\n') }
}));
