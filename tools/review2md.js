#!/usr/bin/env node
// review2md.js — convertit le format texte canonique du skill review en markdown
// groupé par CATEGORIE (h2) puis par FICHIER (h3), badges bracketed-span par sévérité.
// Prêt pour md2html.sh.
//
// Entrée (stdin), format produit par /review :
//   [SECU][CRITIQUE] app/Foo.php:42 -- problème + pourquoi
//     -> fix: correction minimale
//   [PERF][WARN]     app/Foo.php:88 -- requête N+1
//   [CLEAN][INFO]    resources/Bar.vue:12 -- nommage ambigu
// Tolérant : ancien format sans catégorie ([SEV] ...) -> catégorie "Autres".
// Lignes non reconnues (ex "Aucune issue detectee.") passées telles quelles (preamble).

const SEV = { CRITIQUE: 'sev-critique', WARN: 'sev-warn', INFO: 'sev-info' };
const CAT_ORDER = ['CLEAN', 'PERF', 'REFACTO', 'BUG', 'SECU', 'AUTRES'];
const CAT_LABEL = {
  SECU: 'Sécurité', BUG: 'Bugs', PERF: 'Performance',
  CLEAN: 'Clean code', REFACTO: 'Refacto', AUTRES: 'Autres',
};

const reCatIssue = /^\[(SECU|BUG|PERF|CLEAN|REFACTO)\]\[(CRITIQUE|WARN|INFO)\]\s+(.+?)\s+--\s+(.+)$/;
const reIssue = /^\[(CRITIQUE|WARN|INFO)\]\s+(.+?)\s+--\s+(.+)$/;
const reFix = /^\s*->\s*fix:\s*(.+)$/i;
const reLoc = /^(.*):(\d+)$/;

const text = require('fs').readFileSync(0, 'utf8');
const lines = text.split(/\r?\n/);

// cat -> { order: [file], files: Map(file -> [{sev,line,msg,fix}]) }
const cats = new Map();
const preamble = [];
let current = null;
let seenIssue = false;

function add(cat, sev, locator, msg) {
  const mLoc = locator.match(reLoc);
  const file = mLoc ? mLoc[1] : locator;
  const line = mLoc ? mLoc[2] : '';
  if (!cats.has(cat)) cats.set(cat, { order: [], files: new Map() });
  const c = cats.get(cat);
  if (!c.files.has(file)) { c.files.set(file, []); c.order.push(file); }
  current = { sev, line, msg: msg.trim(), fix: null };
  c.files.get(file).push(current);
  seenIssue = true;
}

for (const raw of lines) {
  let m = raw.match(reCatIssue);
  if (m) { add(m[1], m[2], m[3], m[4]); continue; }
  m = raw.match(reIssue);
  if (m) { add('AUTRES', m[1], m[2], m[3]); continue; }
  const mFix = raw.match(reFix);
  if (mFix && current) { current.fix = mFix[1].trim(); continue; }
  if (!seenIssue && raw.trim()) preamble.push(raw.trim());
}

const out = [];
for (const p of preamble) out.push(p, '');

for (const cat of CAT_ORDER) {
  const c = cats.get(cat);
  if (!c) continue;
  out.push(`## ${CAT_LABEL[cat]}`, '');
  for (const file of c.order) {
    out.push(`### ${file}`, '');
    for (const it of c.files.get(file)) {
      const loc = it.line ? ` \`:${it.line}\`` : '';
      out.push(`[${it.sev}]{.${SEV[it.sev]}}${loc} — ${it.msg}`, '');
      if (it.fix) out.push(`> fix: ${it.fix}`, '');
    }
  }
}

if (cats.size === 0 && preamble.length === 0) out.push('Aucune issue detectee.', '');

process.stdout.write(out.join('\n'));
