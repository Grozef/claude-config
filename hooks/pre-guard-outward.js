// PreToolUse Bash|PowerShell|Write|Edit|NotebookEdit : garde-fou des actions SORTANTES + mode STOP.
// Incident 2026-09-10 (meta/erreurs.md, soutenance) : PR d'evaluation poussees sans accord, puis un
// renommage pousse deux minutes apres une protestation, la question n'etant posee qu'APRES. Session en
// mode auto : un "ask" y retombe sur le classifieur (doc hooks, PreToolUse) ; seul "deny" bloque. D'ou :
//  (1) git push / gh pr create|edit|close|merge refuses tant que l'utilisateur n'a pas ecrit GO PUSH,
//      dans son dernier message ou dans une reponse a AskUserQuestion posee depuis ;
//  (2) le refus liste les fichiers FOURNIS par upstream renommes / supprimes / modifies ;
//  (3) dernier message = protestation -> aucune ecriture tant qu'une question n'a pas recu de reponse.
// PostToolUse ne se declenche pas sur AskUserQuestion (doc) : l'etat est relu dans le transcript.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { isBashProducer } = require('./lib/producer.js');

const OUTWARD = /\bgit(\s+-[Cc]\s+\S+|\s+--\S+)*\s+push\b|\bgh\s+pr\s+(create|edit|close|merge)\b/;
const PROTEST = /\?{3,}|tu fais quoi|c'?est quoi (ce|cette|ton|ta)\b|serieusement|putain|merde|connard|fils de pute|bordel/;
// Messages role=user qui ne sont PAS une prise de parole : feedback des hooks, notifications.
const NOT_A_PROMPT = /^(Stop hook feedback|<task-notification|<system-reminder|\[Request interrupted)/;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let j;
try { j = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { process.exit(0); }
const tool = j.tool_name || '';
const cmd = (j.tool_input && j.tool_input.command) || '';
const outward = OUTWARD.test(cmd);
const writes = ['Write', 'Edit', 'NotebookEdit'].includes(tool) || outward || isBashProducer(cmd);
if (!writes) process.exit(0);

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
}

// Derniere prise de parole de l'utilisateur + reponses aux AskUserQuestion posees depuis.
let prompt = '', answers = [], lu = false;
try {
  const asks = new Set();
  for (const l of fs.readFileSync(j.transcript_path, 'utf8').split('\n')) {
    let e;
    try { e = JSON.parse(l); } catch (x) { continue; }
    const m = e.message;
    if (!m) continue;
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (Array.isArray(m.content) ? m.content : []);
    for (const c of blocks) {
      if (m.role === 'user' && c.type === 'text' && !NOT_A_PROMPT.test((c.text || '').trim())) { prompt = c.text; answers = []; }
      else if (c.type === 'tool_use' && c.name === 'AskUserQuestion') asks.add(c.id);
      else if (c.type === 'tool_result' && asks.has(c.tool_use_id)) {
        const t = typeof c.content === 'string' ? c.content : (c.content || []).map(b => b.text || '').join(' ');
        // Seules les REPONSES ("question"="reponse") comptent, jamais le texte des questions que j'ai redigees.
        answers.push((t.match(/"="([^"]*)"/g) || []).join(' '));
      }
    }
  }
  lu = true;
} catch (e) {}

if (!lu) {
  if (outward) deny('PUSH/PR BLOQUE (guard) : transcript illisible, accord GO PUSH non verifiable. Demande a l utilisateur.');
  process.exit(0);
}

if (PROTEST.test(norm(prompt)) && !answers.length) {
  deny('MODE STOP (guard, incident 2026-09-10) : le dernier message de l utilisateur est une protestation :\n'
    + '  « ' + prompt.replace(/\s+/g, ' ').slice(0, 160) + ' »\n'
    + 'Aucune ecriture ni push tant qu il n a pas repondu a une question. Lecture seule autorisee.\n'
    + '1. Relis ce qu il cite et l etat reel (git status/log, fichier, PR).\n'
    + '2. AskUserQuestion avec des options NEUTRES : jamais l etat que tu viens de creer en option 1.\n'
    + '3. N agis qu apres sa reponse.');
}

if (outward && !/\bgo push\b/.test(norm(prompt + ' ' + answers.join(' ')))) {
  deny('PUSH/PR SANS ACCORD (guard, incident 2026-09-10) :\n  ' + cmd.replace(/\s+/g, ' ').slice(0, 200) + '\n'
    + 'Montre a l utilisateur ce qui part (branches, commits, fichiers) et la liste ci-dessous, puis\n'
    + 'demande-lui d ecrire GO PUSH (message ou reponse a AskUserQuestion). Pas d accord = pas de push.\n\n'
    + fournis());
}
process.exit(0);

// Fichiers FOURNIS (presents sur upstream) renommes, supprimes ou modifies dans les depots vises.
function fournis() {
  const vars = {};
  for (const m of cmd.matchAll(/(?:^|[\s;&])([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|]+)/g)) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  const res = p => p.replace(/^["']|["']$/g, '')
    .replace(/\$\{?([A-Za-z_]\w*)\}?/g, (x, n) => (n in vars ? vars[n] : x))
    .replace(/^\/([a-zA-Z])\//, (x, d) => d.toUpperCase() + ':/');
  const bases = [j.cwd || process.cwd()];
  for (const m of cmd.matchAll(/(?:^|[\s;&(])cd\s+("[^"]*"|'[^']*'|[^\s;&|)]+)/g)) bases.push(path.resolve(bases[0], res(m[1])));
  const dirs = new Set(bases), flous = [];
  for (const m of cmd.matchAll(/\bgit\s+-C\s+("[^"]*"|'[^']*'|[^\s;&|]+)/g)) {
    const p = res(m[1]);
    if (p.includes('$')) { flous.push(p); continue; }
    for (const b of bases) dirs.add(path.resolve(b, p));
  }
  const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  const out = [], vus = new Set();
  for (const d of dirs) {
    let top;
    try { top = git(d, 'rev-parse', '--show-toplevel'); } catch (e) { continue; }
    if (vus.has(top)) continue;
    vus.add(top);
    try { git(top, 'remote', 'get-url', 'upstream'); } catch (e) { continue; }
    const ref = ['upstream/HEAD', 'upstream/main', 'upstream/master'].find(r => {
      try { git(top, 'rev-parse', '--verify', '--quiet', r); return true; } catch (e) { return false; }
    });
    if (!ref) { out.push('  ' + top + ' : remote upstream sans branche locale (git fetch upstream)'); continue; }
    const lignes = git(top, 'diff', '--name-status', '-M', ref, 'HEAD').split('\n').filter(l => /^[RDM]/.test(l));
    out.push('  ' + top + ' (git diff --name-status -M ' + ref + ' HEAD) : ' + lignes.length + ' fichier(s) fourni(s) touche(s)');
    for (const l of lignes.slice(0, 40)) {
      const [st, a, b] = l.split('\t');
      out.push('    ' + (st[0] === 'M' ? 'M ' : '/!\\ ' + st[0] + ' ') + a + (b ? ' -> ' + b : ''));
    }
  }
  if (!out.length) out.push('  liste NON calculee : aucun depot avec remote upstream parmi ' + [...dirs].join(', '));
  if (flous.length) out.push('  chemins a variables NON resolus (boucle ?) : ' + flous.join(', '));
  return 'FICHIERS FOURNIS PAR UPSTREAM :\n' + out.join('\n');
}
