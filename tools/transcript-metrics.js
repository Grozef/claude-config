#!/usr/bin/env node
// transcript-metrics.js — consommation et comportement OBSERVES dans les transcripts Claude Code.
// Complement de token-budget.sh, qui mesure le cout STATIQUE de la config avant la premiere question.
//
// Usage :
//   node ~/.claude/tools/transcript-metrics.js --archive        copie les transcripts dans backups/transcripts
//                                                               et met a jour le journal d'usage, sans rien afficher d'autre
//   node ~/.claude/tools/transcript-metrics.js [--cutoff ISO]    mesure, coupee en avant/apres la date ISO
//   node ~/.claude/tools/transcript-metrics.js --dir DOSSIER     mesure un seul dossier
//   node ~/.claude/tools/transcript-metrics.js --periodes 30,180  fenetres glissantes du compteur d'economie (jours)
//
// L'archive existe parce que cleanupPeriodDays=2 purgeait ~/.claude/projects (30 depuis le 2026-09-14) : le 2026-09-13, la base
// « avant » de l'audit Opus 5 (8 transcripts vus le matin) avait disparu a l'heure de la mesurer.
//
// Schema lu — cles enumerees le 2026-09-13 sur des transcripts reels, a re-enumerer si Claude Code change :
//  - type=assistant : UNE LIGNE PAR BLOC de contenu ; message.id et message.usage y sont repetes a
//    l'identique (79 id sur 83 multi-lignes, 0 usage divergent) -> dedoublonner par message.id.
//  - message.usage : input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens.
//  - effort : sur l'entree assistant.
//  - type=user + isMeta + content "Stop hook feedback:..." : un blocage par un hook Stop.
//  - type=cost-state (absent des sessions encore ouvertes) : totalCostUSD.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { isBashProducer } = require('../hooks/lib/producer.js');

const C = (...p) => path.join(os.homedir(), '.claude', ...p);
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ARCHIVE = C('backups', 'transcripts');
// Journal leger (2026-10-05) : une ligne par appel API, compteurs d'usage seuls, aucun contenu de
// conversation. Il porte le compteur d'economie sur 6 mois sans garder les transcripts (117 Mo pour
// 13 jours, contre quelques centaines d'octets par appel ici).
const JOURNAL = C('backups', 'usage.jsonl');
const ARCHIVER = args.includes('--archive');

function jsonl(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonl(p));
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

if (ARCHIVER) {
  // Transcripts append-only : on recopie si la copie manque ou si la source a grossi.
  let n = 0;
  for (const src of jsonl(C('projects'))) {
    const dst = path.join(ARCHIVE, path.relative(C('projects'), src));
    if (fs.existsSync(dst) && fs.statSync(dst).size >= fs.statSync(src).size) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    n++;
  }
  console.log(n + ' transcript(s) copie(s) dans ' + ARCHIVE + ' (' + jsonl(ARCHIVE).length + ' au total)');
}

// Meme partage que stop-verify.js : produire = ecrire ; verifier = lire, chercher, shell non producteur.
function classify(c) {
  const i = c.input || {};
  if (['Edit', 'Write', 'NotebookEdit'].includes(c.name)) return 'produce';
  if (c.name === 'Bash' || c.name === 'PowerShell') return isBashProducer(i.command || '') ? 'produce' : 'verify';
  if (['Read', 'Grep', 'Glob'].includes(c.name)) return 'verify';
  return null;
}

// Sources : projects + archive, une seule copie par session (la plus grosse = la plus complete).
const files = new Map();
for (const f of (opt('--dir') ? jsonl(opt('--dir')) : [...jsonl(C('projects')), ...jsonl(ARCHIVE)])) {
  const k = path.basename(f);
  if (!files.has(k) || fs.statSync(f).size > fs.statSync(files.get(k)).size) files.set(k, f);
}

const cutoff = opt('--cutoff');
const bucketOf = ts => !cutoff ? 'total' : (new Date(ts) < new Date(cutoff) ? 'avant' : 'apres');
const buckets = {};
const B = k => buckets[k] || (buckets[k] = { sessions: new Set(), calls: 0, in: 0, cc: 0, cr: 0, out: 0, prompts: 0, produce: 0, verify: 0, blocks: {}, effort: {}, models: {} });

// Prix publics en $/MTok, lus le 2026-10-05 sur platform.claude.com/docs/en/about-claude/pricing.md :
// [entree, ecriture cache 1 h, lecture cache, sortie]. Cout PONDERE = comparaison entre modeles, pas
// une facture (abonnement). Prefixe de message.model ; modele absent de la table -> cout non calcule.
// La PREMIERE cle qui prefixe le modele gagne : `-5-5` se place avant `-5`.
// Relu le 2026-10-08 (sonde /dispatch : haiku-5-5 et opus-5 sans prix, sonnet-5-5 compte au cache lu de
// sonnet-5). Haiku 5.5 : palier des prompts de 100 k tokens au plus, celui d'un lot `exec-simple` ; au-dela
// la page donne [0.50, 1, 0.05, 2.50].
const PRIX = {
  'claude-fable-5-1': [10, 20, 0.25, 50],
  'claude-opus-5-5': [4, 8, 0.20, 20],
  'claude-opus-5': [5, 10, 0.50, 25],
  'claude-sonnet-5-5': [2, 4, 0.10, 10],
  'claude-sonnet-5': [2, 4, 0.20, 10],
  'claude-haiku-5-5': [0.10, 0.20, 0.01, 0.50],
  'claude-haiku-4-5': [1, 2, 0.10, 5],
};
const cout = (model, m) => {
  const p = PRIX[Object.keys(PRIX).find(k => (model || '').startsWith(k))];
  return p ? (m.in * p[0] + m.cc * p[1] + m.cr * p[2] + m.out * p[3]) / 1e6 : null;
};

const rows = [];
const appels = []; // un par appel API, pour le compteur d'economie par periode
for (const [name, f] of files) {
  const usages = new Map(), tools = new Set();
  // Transcript de sous-agent : <session>/subagents/agent-<id>.jsonl (constate le 2026-10-05). Ses appels
  // comptent dans la periode et dans la ligne « dont sous-agents », pas comme une session ni un prompt.
  const isAgent = path.basename(path.dirname(f)) === 'subagents';
  const s = { id: (isAgent ? path.basename(path.dirname(path.dirname(f))) : name).slice(0, 8), proj: path.basename(path.dirname(f)).slice(-30), first: '', calls: 0, out: 0, prompts: 0, blocks: 0, cost: null };
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch (x) { continue; }
    if (e.type === 'cost-state') { s.cost = e.totalCostUSD; continue; }
    const ts = e.timestamp;
    if (!ts) continue;
    if (!s.first || ts < s.first) s.first = ts;
    const b = B(bucketOf(ts));
    b.sessions.add(s.id);
    const m = e.message;
    if (e.type === 'assistant' && m) {
      // Un message = plusieurs lignes au meme id. Leur usage peut DIVERGER : sur un transcript de
      // sous-agent du 2026-10-05, output_tokens valait 1 puis 176 pour le meme id (13 contre 983 au
      // total). On garde la ligne a la plus grande sortie, pas la premiere.
      const prev = usages.get(m.id);
      if (m.usage && (!prev || (m.usage.output_tokens || 0) > (prev.u.output_tokens || 0))) {
        usages.set(m.id, { u: m.usage, b, effort: (prev && prev.effort) || e.effort || '?', model: m.model || '?', ts: (prev && prev.ts) || ts });
      }
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c.type !== 'tool_use' || tools.has(c.id)) continue;
        tools.add(c.id);
        const kind = classify(c);
        if (kind) b[kind]++;
      }
    } else if (e.type === 'user' && m) {
      const c = m.content;
      if (e.isMeta) {
        if (typeof c === 'string' && c.startsWith('Stop hook feedback:')) {
          const g = (c.match(/([^\n]*?)\s*\(hook [^)]*\)/) || [])[1];
          const label = g ? g.replace(/^.*\]:\s*/, '').trim().slice(0, 40) : 'non identifie';
          b.blocks[label] = (b.blocks[label] || 0) + 1;
          s.blocks++;
        }
      // Ecrits en role user sans etre tapes : sortie de commande locale (« Enabled plan mode »), et
      // notification de tache de fond (origin.kind = task-notification). Une slash-command n'a pas d'origin.
      } else if (!isAgent && !(e.origin && e.origin.kind !== 'human')
        && ((typeof c === 'string' && !c.startsWith('<local-command-')) || (Array.isArray(c) && !c.some(x => x.type === 'tool_result')))) {
        b.prompts++; s.prompts++;
      }
    }
  }
  const sid = isAgent ? path.basename(path.dirname(path.dirname(f))) : name.replace(/\.jsonl$/, '');
  for (const [id, { u, b, effort, model, ts }] of usages) {
    const t = { in: u.input_tokens || 0, cc: u.cache_creation_input_tokens || 0, cr: u.cache_read_input_tokens || 0, out: u.output_tokens || 0 };
    appels.push({ id, ts, sid, isAgent, model, t });
    const mk = model + (isAgent ? ' (sous-agent)' : '');
    const mm = b.models[mk] || (b.models[mk] = { calls: 0, in: 0, cc: 0, cr: 0, out: 0, model });
    for (const x of [b, mm]) { x.calls++; x.in += t.in; x.cc += t.cc; x.cr += t.cr; x.out += t.out; }
    b.effort[effort] = (b.effort[effort] || 0) + 1;
    s.calls++; s.out += t.out;
  }
  if (!isAgent) rows.push(s);
}

// Fusion journal + transcripts lus : cle session + id de message, on garde la plus grande sortie (un
// transcript encore ouvert se complete). Reecrit en entier puis renomme, pour ne jamais laisser un journal tronque.
const fusion = new Map();
const cle = a => a.sid + ' ' + a.id;
try {
  for (const l of fs.readFileSync(JOURNAL, 'utf8').split('\n')) {
    if (!l) continue;
    try { const a = JSON.parse(l); fusion.set(cle(a), a); } catch (x) {}
  }
} catch (x) {}
for (const a of appels) {
  const v = fusion.get(cle(a));
  if (!v || a.t.out > v.t.out) fusion.set(cle(a), a);
}
appels.length = 0;
appels.push(...[...fusion.values()].sort((x, y) => (x.ts < y.ts ? -1 : 1)));
fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
fs.writeFileSync(JOURNAL + '.tmp', appels.map(a => JSON.stringify(a)).join('\n') + '\n');
fs.renameSync(JOURNAL + '.tmp', JOURNAL);
if (ARCHIVER) { console.log(appels.length + ' appel(s) dans ' + JOURNAL); process.exit(0); }

const k = x => (x / 1000).toFixed(1) + 'k';
console.log('== SESSIONS (' + rows.length + ') ==');
console.log('  session   debut (UTC)       appels  sortie  prompts  blocages   cout$  projet');
for (const s of rows.sort((a, b) => (a.first < b.first ? -1 : 1))) {
  console.log('  ' + s.id + '  ' + s.first.slice(0, 16) + '  ' + String(s.calls).padStart(6) + '  ' + k(s.out).padStart(6)
    + '  ' + String(s.prompts).padStart(7) + '  ' + String(s.blocks).padStart(8) + '  ' + (s.cost == null ? '     -' : s.cost.toFixed(2).padStart(6)) + '  ' + s.proj);
}

console.log('\n== PAR PERIODE' + (cutoff ? ' (coupure ' + cutoff + ')' : '') + ' ==');
for (const [name, b] of Object.entries(buckets)) {
  const ctx = b.in + b.cc + b.cr;
  console.log('\n[' + name + '] ' + b.sessions.size + ' session(s), ' + b.calls + ' appels API, ' + b.prompts + ' prompts');
  console.log('  tokens entree : ' + k(ctx) + ' (dont cache lu ' + k(b.cr) + ', cache ecrit ' + k(b.cc) + ')   | contexte moyen par appel : ' + (b.calls ? k(ctx / b.calls) : '-'));
  console.log('  tokens sortie : ' + k(b.out) + '   | par prompt : ' + (b.prompts ? k(b.out / b.prompts) : '-'));
  console.log('  outils        : ' + b.produce + ' production(s), ' + b.verify + ' verification(s)   | verif par production : ' + (b.produce ? (b.verify / b.produce).toFixed(2) : '-'));
  console.log('  blocages Stop : ' + (Object.entries(b.blocks).map(([g, c]) => g + ' x' + c).join(', ') || 'aucun'));
  console.log('  effort        : ' + Object.entries(b.effort).map(([e, c]) => e + ' x' + c).join(', '));
  console.log('  par modele    :  appels   ctx moy   cache lu   sortie   cout pondere $');
  let total = 0;
  for (const [mk, m] of Object.entries(b.models).sort((x, y) => y[1].calls - x[1].calls)) {
    const c = cout(m.model, m);
    if (c != null) total += c;
    console.log('    ' + mk.padEnd(44) + String(m.calls).padStart(6) + '  ' + k((m.in + m.cc + m.cr) / m.calls).padStart(8) + '  ' + k(m.cr).padStart(9)
      + '  ' + k(m.out).padStart(7) + '  ' + (c == null ? '?' : c.toFixed(2)).padStart(8));
  }
  console.log('    cout pondere total : ' + total.toFixed(2) + ' $ (prix publics, cache ecrit compte a 1 h)');
}
// --- Compteur d'economie de la delegation (/dispatch), par fenetre glissante ---
// Reel : cout pondere de tous les appels de la fenetre. Contrefactuel : chaque appel de sous-agent recompte
// comme s'il avait tourne dans la session principale, c'est-a-dire en relisant le contexte qu'elle avait a
// ce moment-la (dernier appel principal anterieur), au prix de son modele, avec la meme sortie.
// C'est une BORNE, pas une mesure : le brief et la verification de l'orchestrateur sont deja dans le reel,
// et rien ne dit qu'un autre modele aurait fait le meme nombre d'appels.
const parSession = {};
for (const a of appels) if (!a.isAgent) (parSession[a.sid] || (parSession[a.sid] = [])).push(a);
for (const l of Object.values(parSession)) l.sort((x, y) => (x.ts < y.ts ? -1 : 1));
console.log('\n== ECONOMIE DE LA DELEGATION (fenetres glissantes, $ ponderes) ==');
console.log('  fenetre   appels  dont sous-agents   reel $   sous-agents $   contrefactuel $   economie $   % du sans-delegation');
for (const jours of (opt('--periodes') || '30,180').split(',').map(Number).filter(n => n > 0)) {
  const depuis = new Date(Date.now() - jours * 864e5).toISOString();
  let n = 0, nA = 0, reel = 0, reelA = 0, contre = 0, orphelins = 0;
  for (const a of appels) {
    if (a.ts < depuis) continue;
    const c = cout(a.model, a.t);
    n++; if (c != null) reel += c;
    if (!a.isAgent) continue;
    nA++;
    const parent = (parSession[a.sid] || []).filter(x => x.ts <= a.ts).pop();
    const cf = parent && cout(parent.model, { in: 0, cc: 0, cr: parent.t.in + parent.t.cc + parent.t.cr, out: a.t.out });
    if (c == null || cf == null) { orphelins++; continue; }
    reelA += c; contre += cf;
  }
  const eco = contre - reelA;
  console.log('  ' + (jours + ' j').padStart(7) + '  ' + String(n).padStart(7) + '  ' + String(nA).padStart(16) + '  ' + reel.toFixed(2).padStart(7) + '  ' + reelA.toFixed(2).padStart(14)
    + '  ' + contre.toFixed(2).padStart(16) + '  ' + eco.toFixed(2).padStart(11) + '  ' + (reel + eco > 0 ? (100 * eco / (reel + eco)).toFixed(1) + ' %' : '-').padStart(21)
    + (orphelins ? '   (' + orphelins + ' appel(s) de sous-agent sans session parente ou sans prix, non comptes)' : ''));
}
console.log('  Borne haute de l economie : voir le commentaire du script. Source : backups/usage.jsonl (journal d usage) + transcripts encore presents ; une fenetre ne couvre que ce que le journal contient.');

// Ecart constate le 2026-09-13 sur la session 3f4b6898 : le transcript somme 2,74M de cache lu, son cost-state
// 3,15M (sortie 71 636 contre 71 737). Des appels factures n'apparaissent pas dans le transcript.
console.log('\nLimites : tokens = usage des appels VISIBLES dans le transcript, en dessous de la facture (cout$ = cost-state, quand present).');
console.log('Des sessions de taches differentes ne se comparent pas entre elles.');
console.log('Detail par gate : ~/.claude/.gate-blocks.log (alimente depuis le 2026-09-13).');
