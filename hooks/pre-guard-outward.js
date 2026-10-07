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
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { isBashProducer } = require('./lib/producer.js');

const OUTWARD = /\bgit(\s+-[Cc]\s+\S+|\s+--\S+)*\s+push\b|\bgh\s+pr\s+(create|edit|close|merge)\b/;
const PROTEST = /\?{3,}|tu fais quoi|c'?est quoi (ce|cette|ton|ta)\b|serieusement|putain|merde|connard|fils de pute|bordel/;
// (4) Relecteur avant commit (2026-10-05). Banc de rejeu : 5 defauts connus de septembre retrouves sur 5
// par le sous-agent `relecteur` lisant le seul diff livre. Un `git commit` dont le diff de CODE atteint
// SEUIL_LIGNES, ou touche un chemin a risque, est refuse tant qu'un relecteur n'a pas rendu son rapport
// depuis le commit precedent. Sortie de secours : l'utilisateur ecrit SANS RELECTURE.
// Angles morts assumes : fichiers non suivis ajoutes dans la meme commande, `git -C $variable`, et les
// formes qui cachent le depot ou le verbe (GIT_DIR=, --git-dir, alias, git.exe, bash -c, pushd,
// Set-Location) : le garde vise l'inattention, pas le contournement (relecteur du 2026-10-06).
// La valeur d'une option peut porter des guillemets en son milieu : `-c user.name="A B"`.
const COMMIT = /\bgit((?:\s+-[Cc]\s+(?:[^\s"']|"[^"]*"|'[^']*')+|\s+--\S+)*)\s+commit(?![\w-])/;
// Occurrences de `git commit` HORS chaines : `grep "git commit"` et `echo "... git commit ..."` etaient
// refuses comme des commits (reverification du 2026-10-05). Le chemin de -C peut, lui, etre entre guillemets.
// Lecture a la facon du shell (relecteurs du 2026-10-06) : une apostrophe echappee (`c\'est`), dans un
// commentaire ou dans le corps d'un heredoc n'ouvre pas de chaine, sinon elle avalait le `git commit` qui
// suivait. Le corps d'un heredoc reste lu (`bash <<EOF` l'execute), seuls ses guillemets sont effaces.
// Une chaine jamais refermee ne cache rien. `ps` : en PowerShell l'antislash n'echappe pas.
function commitsDe(s, ps) {
  s = s.replace(/(?<!<)(<<-?\s*(['"]?)(\w+)\2[^\n]*\r?\n)((?:[\s\S]*?\r?\n)?)(?=[ \t]*\3\r?(?:\n|$))/g,
    (x, tete, q, mot, corps) => tete + corps.replace(/['"]/g, ' '));
  const zones = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && !ps) { i++; continue; }
    if (s[i] === '#' && (!i || /\s/.test(s[i - 1]))) { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (s[i] !== "'" && s[i] !== '"') continue;
    const q = s[i], a = i;
    for (i++; i < s.length && s[i] !== q; i++) if (q === '"' && s[i] === '\\' && !ps) i++;
    if (i < s.length) zones.push([a, i]);
  }
  return [...s.matchAll(new RegExp(COMMIT.source, 'g'))].filter(m => !zones.some(([a, b]) => m.index > a && m.index < b));
}
// Arguments de `commit` qui n'envoient que l'index : ni `-a`, ni `-i` / `-o`, ni chemin.
const VAL = '(?:"(?:[^"\\\\]|\\\\.)*"|\'[^\']*\'|[^\\s;&|"\']+)';
const INDEX_SEUL = new RegExp('^(?:\\s+(?:-[qsv]+|--(?:amend|no-edit|quiet|signoff|no-verify)|-[qsv]*[mF]\\s*' + VAL
  + '|--(?:message|file)[=\\s]\\s*' + VAL + '))*\\s*(?:$|[;&|\\n<>])');
const SEUIL_LIGNES = 40;
const NON_CODE = /\.(md|txt|log|csv|jsonl|lock)$|(^|\/)package-lock\.json$/i;
const RISQUE = /(^|\/)migrations?\/|auth|polic(y|ies)|(^|\/)stores?\/|(^|\/)(main|global|theme|app)\.s?css$/i;
// Messages role=user qui ne sont PAS une prise de parole : feedback des hooks, notifications, rapport
// d'un sous-agent (il effacait un GO PUSH ou un SANS RELECTURE donne juste avant, 2026-10-05).
const NOT_A_PROMPT = /^(Stop hook feedback|<task-notification|<system-reminder|\[Request interrupted|Another Claude session sent a message|<agent-message)/;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let j;
try { j = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { process.exit(0); }
const tool = j.tool_name || '';
const cmd = (j.tool_input && j.tool_input.command) || '';
const outward = OUTWARD.test(cmd);
// COMMIT nomme a part : isBashProducer ne voit pas `git -C <depot> commit` (options avant le verbe).
const ps = tool === 'PowerShell';
const writes = ['Write', 'Edit', 'NotebookEdit'].includes(tool) || outward || commitsDe(cmd, ps).length || isBashProducer(cmd);
if (!writes) process.exit(0);

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
}

// Derniere prise de parole de l'utilisateur + reponses aux AskUserQuestion posees depuis.
let prompt = '', answers = [], lu = false;
// Relecteur rendu depuis le dernier commit abouti. Formes relevees dans un transcript reel (2026-10-05) :
// appel Agent {subagent_type}, tool_result « Async agent launched ... agentId: <id> », puis rapport en
// message role user « <agent-message from="<id>"> ». Un appel au premier plan rend dans son tool_result.
// `rendus` garde les BRIEFS des relecteurs rendus : un relecteur ne vaut que pour le depot que son brief
// nomme (sans cela, les 5 relecteurs du banc du 2026-10-05 auraient ouvert le commit d'un autre depot).
let rendus = [];
const commits = new Set(), relecteurs = new Map(), enFond = new Map();
try {
  const asks = new Set();
  for (const l of fs.readFileSync(j.transcript_path, 'utf8').split('\n')) {
    let e;
    try { e = JSON.parse(l); } catch (x) { continue; }
    // Forme relevee le 2026-10-06 : le rapport d'un sous-agent en fond arrive en entree `attachment`
    // (queued_command, origin.handback), sans champ `message`. Sans cette branche `rendus` restait vide.
    const a = e.attachment;
    if (a && a.type === 'queued_command' && a.origin && a.origin.handback && enFond.has(a.origin.from)) rendus.push(enFond.get(a.origin.from));
    const m = e.message;
    if (!m) continue;
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (Array.isArray(m.content) ? m.content : []);
    for (const c of blocks) {
      if (c.type === 'tool_use' && (c.name === 'Bash' || c.name === 'PowerShell') && commitsDe((c.input && c.input.command) || '', c.name === 'PowerShell').length) commits.add(c.id);
      else if (c.type === 'tool_use' && c.name === 'Agent' && c.input && c.input.subagent_type === 'relecteur') relecteurs.set(c.id, String(c.input.prompt || ''));
      else if (c.type === 'tool_result' && commits.has(c.tool_use_id) && !c.is_error) rendus = [];
      else if (c.type === 'tool_result' && relecteurs.has(c.tool_use_id)) {
        const t = typeof c.content === 'string' ? c.content : (c.content || []).map(b => b.text || '').join(' ');
        const id = /Async agent launched/.test(t) && (t.match(/agentId: ([0-9a-f]+)/) || [])[1];
        if (id) enFond.set(id, relecteurs.get(c.tool_use_id)); else if (!c.is_error) rendus.push(relecteurs.get(c.tool_use_id));
      }
      const de = m.role === 'user' && c.type === 'text' && ((c.text || '').match(/<agent-message from="([0-9a-f]+)">/) || [])[1];
      if (de && enFond.has(de)) rendus.push(enFond.get(de));
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

if (commitsDe(cmd, ps).length && !/\bsans relecture\b/.test(norm(prompt + ' ' + answers.join(' ')))) {
  const gros = aRelire();
  if (gros.length) {
    deny('COMMIT DE CODE SANS RELECTEUR (guard, plan qualite du 2026-10-05) :\n' + gros.join('\n') + '\n'
      + 'Seuil : ' + SEUIL_LIGNES + ' lignes de code changees, ou un chemin a risque (migration, auth, policy, store, CSS global).\n'
      + 'Avant de commiter : lance le sous-agent `relecteur` avec l objectif du lot, ses criteres d acceptation\n'
      + 'et la commande de diff ci-dessus, chemin du depot COMPRIS (un relecteur ne vaut que pour le depot que\n'
      + 'son brief nomme). Trie ses constats par GRAVITE et confirme-les a la lecture du code :\n'
      + 'la ligne VERDICT ne suffit pas (banc du 2026-10-05 : un crash connu rendu MINEUR sous NON REFUTE).\n'
      + 'Corrige ce qui est confirme, puis commite.\n'
      + 'Sortie de secours : l utilisateur ecrit SANS RELECTURE (message ou reponse a AskUserQuestion).');
  }
}
process.exit(0);

// Variables, repertoires de base (cwd puis `cd`) et appel git communs aux deux inventaires ci-dessous.
function ctx() {
  const vars = {};
  for (const m of cmd.matchAll(/(?:^|[\s;&])([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|]+)/g)) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  const res = p => p.replace(/^["']|["']$/g, '')
    .replace(/\$\{?([A-Za-z_]\w*)\}?/g, (x, n) => (n in vars ? vars[n] : n === 'HOME' ? os.homedir() : x))
    .replace(/^~(?=[\/\\]|$)/, os.homedir())
    .replace(/^\/([a-zA-Z])\//, (x, d) => d.toUpperCase() + ':/');
  const bases = [j.cwd || process.cwd()];
  for (const m of cmd.matchAll(/(?:^|[\s;&(])cd\s+("[^"]*"|'[^']*'|[^\s;&|)]+)/g)) bases.push(path.resolve(bases[0], res(m[1])));
  const git = (d, ...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  return { res, bases, git };
}

// Depots vises par un `git commit` dont le diff de code appelle un relecteur. Le diff compte est celui
// qui part : l'index (`--cached`) quand les arguments du commit n'envoient que lui (INDEX_SEUL) et que
// la commande n'a pas de `git add`, sinon tout l'arbre (`HEAD`), y compris quand l'index est vide.
function aRelire() {
  const { res, bases, git } = ctx();
  const out = [], vus = new Set();
  const ajoute = /\bgit\b[^;&|\n]*\s(add|rm|mv|stage|apply)\b/.test(cmd);
  for (const m of commitsDe(cmd, ps)) {
    // `-C` seul : `-c cle=valeur` est une option de config, pas un repertoire.
    const c = (m[1].match(/-C\s+("[^"]*"|'[^']*'|\S+)/) || [])[1];
    let top, stat, ref = 'HEAD';
    try {
      top = git(c ? path.resolve(bases[0], res(c)) : bases[bases.length - 1], 'rev-parse', '--show-toplevel');
      // Un depot se compte une fois par mode : `commit -m docs; commit -am code` a deux diffs differents.
      const idx = !ajoute && INDEX_SEUL.test(m.input.slice(m.index + m[0].length));
      if (vus.has(top + idx)) continue;
      vus.add(top + idx);
      const cle = top.replace(/\\/g, '/').toLowerCase();
      if (rendus.some(b => b.replace(/\\/g, '/').toLowerCase().includes(cle))) continue;
      if (idx) stat = git(top, 'diff', '--cached', '--numstat');
      if (stat) ref = '--cached'; else stat = git(top, 'diff', 'HEAD', '--numstat');
    } catch (e) { continue; }
    let n = 0;
    const risque = [];
    for (const l of stat.split('\n')) {
      const [a, d, f] = l.split('\t');
      if (!f || a === '-' || NON_CODE.test(f)) continue;
      n += Number(a) + Number(d);
      if (RISQUE.test(f)) risque.push(f);
    }
    if (n >= SEUIL_LIGNES || risque.length) {
      out.push('  ' + top + ' : ' + n + ' ligne(s) de code changee(s)' + (risque.length ? ', a risque : ' + risque.slice(0, 5).join(', ') : '')
        + '\n    diff a relire : git -C "' + top + '" diff ' + ref);
    }
  }
  return out;
}

// Fichiers FOURNIS (presents sur upstream) renommes, supprimes ou modifies dans les depots vises.
function fournis() {
  const { res, bases, git } = ctx();
  const dirs = new Set(bases), flous = [];
  for (const m of cmd.matchAll(/\bgit\s+-C\s+("[^"]*"|'[^']*'|[^\s;&|]+)/g)) {
    const p = res(m[1]);
    if (p.includes('$')) { flous.push(p); continue; }
    for (const b of bases) dirs.add(path.resolve(b, p));
  }
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
