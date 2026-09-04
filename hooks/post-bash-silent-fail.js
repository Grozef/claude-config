// PostToolUse (Bash|PowerShell) : detecte le SUCCES SILENCIEUX — la commande sort en
// exit 0 mais n'a rien fait. Ecrit un drapeau dans .pending-verify.log, que le gate 2g
// de stop-verify.js lit en fin de tour.
//
// Pourquoi ce hook existe : post-fail-vault.js ne se declenche que sur un ECHEC d'outil,
// or la classe d'erreur dominante du vault (38 des 46 entrees de meta/erreurs.md en
// 2026-08) sort en exit 0. Incidents fondateurs :
//   2026-08-28 « Cypress rend exit 0 en n'ayant execute AUCUN test » (excludeSpecPattern
//               mangeait la spec ; le code de sortie ne distingue pas "tout passe" de
//               "rien n'a tourne")
//   2026-08-28 « Bash a VIDE une ligne de code sans rien signaler » (le script affichait
//               "test remplace" et rendait 0 ; rien n'avait ete ecrit)
//
// Contrat de sortie : AUCUNE sortie stdout/stderr, aucun code != 0. La doc des hooks
// donne la sortie d'un PostToolUse pour ignoree ; le seul canal fiable est donc l'effet
// de bord sur disque, relu au Stop (meme mecanique que stop-capture-reminder.js).
// Duree de vie d'un drapeau : UN tour. stop-verify.js vide le fichier apres evaluation.

const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG = path.join(os.homedir(), '.claude', '.pending-verify.log');

// Motifs a HAUTE PRECISION uniquement. Un gate bruyant entraine le reflexe [NO-VERIFY]
// et s'erode (meta/concepts/mecanismes-bloquants-sup-rappels-textuels.md) : on prefere
// rater un cas que crier a tort. Chaque motif est tire d'un incident reel.
const SIGNALS = [
  { re: /can't run because no spec files were found/i, surface: 'ci', quoi: 'aucune spec trouvee' },
  { re: /\b0 passing\b/i,                              surface: 'ci', quoi: '0 test passant' },
  { re: /\bTests:\s+0\b/i,                             surface: 'ci', quoi: '0 test' },
  { re: /\bRan 0 tests?\b/i,                           surface: 'ci', quoi: '0 test execute' },
  { re: /\bno tests? (ran|found|executed|were executed)\b/i, surface: 'ci', quoi: 'aucun test execute' },
  { re: /\bNo test files found\b/i,                    surface: 'ci', quoi: 'aucun fichier de test' },
  { re: /\bNo tests found\b/i,                         surface: 'ci', quoi: 'aucun test trouve' },
  { re: /nothing to commit, working tree clean/i,      surface: 'feature-runtime', quoi: 'rien a commiter : la passe n\'a rien ecrit' },
  { re: /^\s*0 files? changed/mi,                      surface: 'feature-runtime', quoi: '0 fichier modifie' },
];

let j;
try { j = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { process.exit(0); }

const tool = j.tool_name || '';
if (tool !== 'Bash' && tool !== 'PowerShell') process.exit(0);

const cmd = (j.tool_input && (j.tool_input.command || '')) || '';

// La forme de tool_response n'est pas figee par la doc : on accepte les formes plausibles
// et, a defaut, on relit le tool_result dans le transcript (canal prouve, utilise par
// stop-verify.js). Jamais de supposition sur une seule forme.
function outputText() {
  const r = j.tool_response;
  if (typeof r === 'string' && r) return r;
  if (r && typeof r === 'object') {
    for (const k of ['stdout', 'output', 'content', 'text', 'result']) {
      if (typeof r[k] === 'string' && r[k]) return r[k];
    }
    if (Array.isArray(r.content)) {
      const t = r.content.map(c => (c && typeof c.text === 'string') ? c.text : '').join('\n');
      if (t.trim()) return t;
    }
    try { return JSON.stringify(r); } catch (e) {}
  }
  const tp = j.transcript_path;
  const id = j.tool_use_id;
  if (!tp || !id || !fs.existsSync(tp)) return '';
  try {
    const lines = fs.readFileSync(tp, 'utf8').split('\n').filter(l => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      let e; try { e = JSON.parse(lines[i]); } catch (err) { continue; }
      const content = e.message && e.message.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c.type === 'tool_result' && c.tool_use_id === id) {
          if (typeof c.content === 'string') return c.content;
          if (Array.isArray(c.content)) return c.content.map(x => x && x.text ? x.text : '').join('\n');
        }
      }
    }
  } catch (e) {}
  return '';
}

const out = outputText();
if (!out) process.exit(0);

const hits = [];
for (const s of SIGNALS) {
  const m = out.match(s.re);
  if (m) {
    const line = (out.split('\n').find(l => s.re.test(l)) || m[0]).trim().slice(0, 160);
    hits.push({ surface: s.surface, quoi: s.quoi, line });
  }
}
if (hits.length === 0) process.exit(0);

const one = l => String(l).replace(/\s+/g, ' ').replace(/"/g, "'");
try {
  const ts = new Date().toISOString();
  const rows = hits.map(h =>
    `[${ts}] surface=${h.surface} quoi="${one(h.quoi)}" cmd="${one(cmd).slice(0, 100)}" sortie="${one(h.line)}"`);
  fs.appendFileSync(LOG, rows.join('\n') + '\n');
} catch (e) {}
process.exit(0);
