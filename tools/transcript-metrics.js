#!/usr/bin/env node
// transcript-metrics.js — consommation et comportement OBSERVES dans les transcripts Claude Code.
// Complement de token-budget.sh, qui mesure le cout STATIQUE de la config avant la premiere question.
//
// Usage :
//   node ~/.claude/tools/transcript-metrics.js --archive        copie les transcripts dans backups/transcripts
//   node ~/.claude/tools/transcript-metrics.js [--cutoff ISO]    mesure, coupee en avant/apres la date ISO
//   node ~/.claude/tools/transcript-metrics.js --dir DOSSIER     mesure un seul dossier
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

if (args.includes('--archive')) {
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
  process.exit(0);
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
const B = k => buckets[k] || (buckets[k] = { sessions: new Set(), calls: 0, in: 0, cc: 0, cr: 0, out: 0, prompts: 0, produce: 0, verify: 0, blocks: {}, effort: {} });

const rows = [];
for (const [name, f] of files) {
  const seen = new Set(), tools = new Set();
  const s = { id: name.slice(0, 8), proj: path.basename(path.dirname(f)).slice(-30), first: '', calls: 0, out: 0, prompts: 0, blocks: 0, cost: null };
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
      if (m.usage && !seen.has(m.id)) {
        seen.add(m.id);
        const u = m.usage;
        b.calls++; b.in += u.input_tokens || 0; b.cc += u.cache_creation_input_tokens || 0;
        b.cr += u.cache_read_input_tokens || 0; b.out += u.output_tokens || 0;
        b.effort[e.effort || '?'] = (b.effort[e.effort || '?'] || 0) + 1;
        s.calls++; s.out += u.output_tokens || 0;
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
      } else if (!(e.origin && e.origin.kind !== 'human')
        && ((typeof c === 'string' && !c.startsWith('<local-command-')) || (Array.isArray(c) && !c.some(x => x.type === 'tool_result')))) {
        b.prompts++; s.prompts++;
      }
    }
  }
  rows.push(s);
}

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
}
// Ecart constate le 2026-09-13 sur la session 3f4b6898 : le transcript somme 2,74M de cache lu, son cost-state
// 3,15M (sortie 71 636 contre 71 737). Des appels factures n'apparaissent pas dans le transcript.
console.log('\nLimites : tokens = usage des appels VISIBLES dans le transcript, en dessous de la facture (cout$ = cost-state, quand present).');
console.log('Des sessions de taches differentes ne se comparent pas entre elles.');
console.log('Detail par gate : ~/.claude/.gate-blocks.log (alimente depuis le 2026-09-13).');
