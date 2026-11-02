// PreToolUse Bash|PowerShell : refuse une suppression directe (rm, rmdir, unlink, del, erase, rd,
// Remove-Item, ri) et renvoie vers tools/trash.sh, corbeille purgee a 48 h (demande du 2026-10-26 :
// recuperer les erreurs d'une session). Les Edit/Write sont deja couverts par file-history (/rewind).
// Le texte entre guillemets est ignore : un `grep "Remove-Item"` ou un `trap 'rm -rf x'` ne compte pas
// (faux positif de producer.js, meta/erreurs.md 2026-10-26). `git rm` passe : le fichier reste dans git.
// Angles morts assumes : corps de heredoc, `find -delete`, `fs.rmSync` d'un node -e, prefixe `VAR=x rm`.
// Toute erreur interne sort en 0 sans rien dire : ce hook ne doit jamais bloquer par accident.
const fs = require('fs');

const DELETE = /(^|[;&|(\n{`]|\b(?:sudo|xargs|then|do|else|exec|command|-exec)\s)\s*(rm|rmdir|unlink|del|erase|rd|Remove-Item|ri)(?![\w-])/i;

try {
  const d = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!['Bash', 'PowerShell'].includes(d.tool_name)) process.exit(0);
  const cmd = String((d.tool_input || {}).command || '');
  const bare = cmd.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");
  const m = bare.match(DELETE);
  if (!m) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `CORBEILLE (pre-trash.js) : \`${m[2]}\` refuse. Deplacer plutot avec l'outil Bash : `
      + 'bash ~/.claude/tools/trash.sh <chemin>... (restaurable 48 h ; --list donne les chemins d\'origine).',
  } }));
} catch (e) { /* silence */ }
process.exit(0);
