// Lecture de ~/.claude/vault.conf cote node (les hooks shell le sourcent directement).
// Retourne {} si le fichier est absent -> l'appelant doit degrader en silence.
const fs = require('fs');
const path = require('path');

module.exports = function vaultConf() {
  const file = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'vault.conf');
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch (e) { /* pas de config locale */ }
  return out;
};
