#!/usr/bin/env bash
# token-budget.sh — ce que la config coute AVANT la premiere question, et a chaque tour.
# Sans mesure, un audit de verbosite repart en estimation ; avec, c'est une commande.
# Usage : bash ~/.claude/tools/token-budget.sh [dossier-projet]   (defaut : cwd)
# L'estimation en tokens vaut car/4 : ordre de grandeur, pas une facture.
set -uo pipefail

PROJ="${1:-$PWD}"
cd "$HOME/.claude" || exit 2

node - "$PROJ" <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const H = process.env.HOME || process.env.USERPROFILE;
const C = p => path.join(H, '.claude', p);
const proj = process.argv[2];

const car = s => (s || '').length;
const tk = n => Math.round(n / 4);
const lire = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const ligne = (nom, n, note) => console.log('  ' + String(n).padStart(6) + ' car  ~' + String(tk(n)).padStart(5) + ' tk   ' + nom + (note ? '   ' + note : ''));

// --- socle fixe : paye une fois par session ---
console.log('== SOCLE FIXE (une fois par session) ==');
const claudeGlobal = car(lire(C('CLAUDE.md')));
let claudeProjet = 0, projetNom = '(aucun)';
for (const cand of [path.join(proj, 'CLAUDE.md'), path.join(proj, '.claude', 'CLAUDE.md')]) {
  if (fs.existsSync(cand)) { claudeProjet = car(lire(cand)); projetNom = path.relative(proj, cand) || 'CLAUDE.md'; break; }
}
let demarrage = 0;
try { demarrage = car(cp.execFileSync('node', [C('hooks/session-start.js')], { cwd: proj, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) {}

// Descriptions de skills : c'est ce bloc qui est injecte, pas le corps des SKILL.md.
let skills = 0, nSkills = 0;
const rows = [];
const dSkills = C('skills');
for (const s of (fs.existsSync(dSkills) ? fs.readdirSync(dSkills) : [])) {
  const f = path.join(dSkills, s, 'SKILL.md');
  if (!fs.existsSync(f)) continue;
  const m = lire(f).match(/^description: \|?\s*\n?([\s\S]*?)\n(?=[a-z-]+:|---)/m);
  const d = (m ? m[1] : '').trim();
  skills += d.length + s.length; nSkills++;
  rows.push([d.length, s]);
}
ligne('CLAUDE.md global', claudeGlobal);
ligne('CLAUDE.md projet', claudeProjet, '(' + projetNom + ')');
ligne('injection session-start', demarrage);
ligne('descriptions de ' + nSkills + ' skills', skills);
const socle = claudeGlobal + claudeProjet + demarrage + skills;
console.log('  ' + '-'.repeat(58));
ligne('TOTAL SOCLE', socle);
rows.sort((a, b) => b[0] - a[0]);
console.log('  skills les plus lourds : ' + rows.slice(0, 5).map(r => r[1] + '(' + r[0] + ')').join(' '));

// --- cout par tour : paye a CHAQUE prompt, et il reste dans l'historique ---
console.log('\n== PAR TOUR (UserPromptSubmit — cumulatif : chaque injection reste dans l historique) ==');
const temoins = [
  ['neutre     ', 'explique moi le fonctionnement de ce module'],
  ['production ', 'corrige le bug d affichage dans le composant de la carte'],
  ['scope ?    ', 'scope ?'],
];
let prod = 0;
for (const [nom, p] of temoins) {
  let out = '';
  try {
    out = cp.execFileSync('node', [C('hooks/user-prompt-submit.js')], { input: JSON.stringify({ prompt: p }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (e) {}
  let n = 0;
  try { n = car(JSON.parse(out).hookSpecificOutput.additionalContext); } catch (e) {}
  if (nom.trim() === 'production') prod = n;
  ligne(nom, n);
}

// --- projection ---
console.log('\n== PROJECTION session de 30 tours (20 production, 10 neutres) ==');
let neutre = 0;
try {
  neutre = car(JSON.parse(cp.execFileSync('node', [C('hooks/user-prompt-submit.js')], { input: JSON.stringify({ prompt: 'et ensuite' }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })).hookSpecificOutput.additionalContext);
} catch (e) {}
const variable = 20 * prod + 10 * neutre;
ligne('socle', socle);
ligne('injections cumulees', variable);
console.log('  ' + '-'.repeat(58));
ligne('TOTAL', socle + variable);
console.log('\n(le rappel vault du bloc (3c) est CONTEXTUEL : il apporte une note que le');
console.log(' modele n a pas. Ce qui se coupe, c est la redite des regles deja en contexte.)');
NODE
