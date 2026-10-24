// Pieges recidivants que la capture dans meta/ n'a pas fait cesser (audit du vault, 2026-10-24) :
// une regle ecrite revient en rappel textuel, un refus mecanique non
// (meta/concepts/mecanismes-bloquants-sup-rappels-textuels.md).
//  PreToolUse Bash        (1) heredoc dont le corps porte un antislash double : l'outil Bash le reduit
//                             (`\\` arrive `\`, regex `/\s/` ecrite `/s/`) -> refus, passer par Write.
//                             Incidents 2026-09-13, 2026-10-13 (x3), 2026-10-24.
//                         (2) `sed -i` sur un fichier CRLF nomme en clair : sed de Git Bash le reecrit
//                             en LF -> refus, passer par Edit. Incidents 2026-10-13, 2026-10-20,
//                             2026-10-22, 2026-10-24. Angle mort : fichier designe par variable ou glob.
//  PostToolUse TaskStop   (3) rappel : le shell arrete, ses fils (serveur de dev npx) gardent le port.
//                             5 recidives titrees entre le 2026-09-23 et le 2026-10-19.
//  PostToolUse Edit|Write (4) meta/erreurs.md : l'entree de tete doit finir par `Detecte : <mode>` de
//                             meta/INDEX.md ; 46 des 64 erreurs du 16 au 24/10 n'en avaient pas (meta-tally).
//                             `decision: block` + `continueOnBlock: true` dans settings.json (changelog
//                             2.1.139) : la raison revient a Claude et le tour continue.
// Toute erreur interne sort en 0 sans rien dire : ce hook ne doit jamais bloquer par accident.
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODES = ['avant-livraison', 'gate', 'relecteur', 'apres-livraison', 'reverif-demandee', 'utilisateur', 'indetermine'];

function out(o) { process.stdout.write(JSON.stringify(o)); process.exit(0); }
function deny(reason) {
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
}

// Corps des heredocs d'une commande : du saut de ligne qui suit `<<MOT` jusqu'a la ligne `MOT`.
// Seul un heredoc FERME compte : un here-string `<<< mot` ou un decalage `1<<x` n'ont pas de ligne
// delimiteur, leur « corps » courait jusqu'a la fin de la commande (relecteur du 2026-10-24).
function heredocBodies(cmd) {
  const bodies = [];
  const re = /(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;
  let m;
  while ((m = re.exec(cmd))) {
    const nl = cmd.indexOf('\n', m.index);
    if (nl < 0) continue;
    const body = [];
    let closed = false;
    for (const l of cmd.slice(nl + 1).split('\n')) {
      if (l.replace(/^\t+/, '').trimEnd() === m[2]) { closed = true; break; }
      body.push(l);
    }
    if (closed) bodies.push(body.join('\n'));
  }
  return bodies;
}

// Chemin tel qu'ecrit dans la commande -> chemin lisible par node (Windows) : ~, /c/..., relatif au cwd.
function resolve(p, cwd) {
  if (p.startsWith('~/')) p = path.join(os.homedir(), p.slice(2));
  const drive = /^\/([a-zA-Z])\/(.*)$/.exec(p);
  if (drive) p = drive[1].toUpperCase() + ':/' + drive[2];
  return path.isAbsolute(p) ? p : path.join(cwd || process.cwd(), p);
}

// Fichiers CRLF passes en clair a un `sed -i` (un segment de commande par sed).
function sedCrlfTargets(cmd, cwd) {
  const hits = [];
  for (const seg of cmd.split(/&&|\|\||[;|\n]/)) {
    const toks = (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(t => t.replace(/^(["'])(.*)\1$/, '$2'));
    const i = toks.indexOf('sed');
    if (i < 0 || !toks.slice(i + 1).some(t => /^-[a-zA-Z]*i/.test(t) || t.startsWith('--in-place'))) continue;
    for (const t of toks.slice(i + 1)) {
      if (t.startsWith('-') || /[$*?]/.test(t)) continue;
      const f = resolve(t, cwd);
      let buf;
      try { if (!fs.statSync(f).isFile()) continue; buf = fs.readFileSync(f); } catch (e) { continue; }
      if (buf.includes('\r\n')) hits.push(t);
    }
  }
  return hits;
}

function topEntryHasMode(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(l => /^## \d{4}-\d{2}-\d{2}/.test(l));
  if (start < 0) return true;
  let end = lines.findIndex((l, k) => k > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  // Meme lecture que meta-tally.sh ($3 exact) : le mode est suivi d'un espace ou de la fin de ligne.
  const re = new RegExp('^Detecte : (' + MODES.join('|') + ')(\\s|$)');
  return lines.slice(start, end).some(l => re.test(l));
}

let j;
try { j = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { process.exit(0); }
try {
  const ev = j.hook_event_name, tool = j.tool_name, inp = j.tool_input || {};

  if (ev === 'PreToolUse' && tool === 'Bash') {
    const cmd = String(inp.command || '');
    if (heredocBodies(cmd).some(b => b.includes('\\\\'))) {
      deny('HEREDOC + ANTISLASH DOUBLE (pitfalls.js, 6 incidents meta/erreurs.md) : l\'outil Bash reduit `\\\\` en `\\` '
        + 'dans le corps d\'un heredoc (regex `/\\s/` ecrite `/s/`). Ecrire le script avec Write dans le scratchpad, '
        + 'puis le lancer par son chemin.');
    }
    const crlf = sedCrlfTargets(cmd, j.cwd);
    if (crlf.length) {
      deny('SED -I SUR FICHIER CRLF (pitfalls.js, 4 incidents meta/erreurs.md) : ' + crlf.join(', ')
        + ' finit en CRLF et sed de Git Bash le reecrit en LF. Passer par Edit, ou compter les CRLF avant/apres '
        + '(`file <f>`) dans une commande separee.');
    }
  }

  if (ev === 'PostToolUse' && tool === 'TaskStop') {
    out({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext:
      'TaskStop arrete le shell, pas toujours ses fils (serveur de dev lance par npx, node) : avant d\'ecrire « arrete », '
      + 'controler le port (`netstat -ano | grep :<port>`). 5 recidives dans meta/erreurs.md.' } });
  }

  if (ev === 'PostToolUse' && (tool === 'Edit' || tool === 'Write')) {
    const f = String(inp.file_path || '').replace(/\\/g, '/');
    if (/(^|\/)meta\/erreurs\.md$/i.test(f)) {
      let text = '';
      try { text = fs.readFileSync(inp.file_path, 'utf8'); } catch (e) { process.exit(0); }
      if (!topEntryHasMode(text)) {
        out({ decision: 'block', reason: 'meta/erreurs.md : l\'entree de tete n\'a pas de ligne `Detecte : <mode>` '
          + 'avec un mode de meta/INDEX.md (' + MODES.join(', ') + '). L\'ajouter en derniere ligne de l\'entree.' });
      }
    }
  }
} catch (e) { /* jamais bloquant par accident */ }
process.exit(0);
