// Correspondance dossier de travail -> tag(s) du TODO global, cote node
// (tools/todo-project.sh lit les memes fichiers en shell).
//
// Deux sources, tags additionnes par cle :
//   - $CLAUDE_VAULT/claude/projets-map.conf : carte PARTAGEE, versionnee dans le vault.
//     Avant le 2026-10-05 la table ne vivait que dans un fichier local non versionne :
//     un poste neuf demarrait avec une table vide et aucun toDo projet charge.
//   - ~/.claude/todo-map.conf : complement local au poste, optionnel.
//
// Retourne {} si rien n'est lisible : l'appelant doit alors le DIRE, pas rendre une liste
// vide (une absence de correspondance ne se lit pas comme une absence de taches).
const fs = require('fs');
const path = require('path');

module.exports = function todoMap() {
  const out = {};
  const read = file => {
    try {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*\["([^"]+)"\]\s*=\s*"([^"]*)"/);
        if (m) out[m[1]] = [...new Set([...(out[m[1]] || []), ...m[2].split(/\s+/).filter(Boolean)])];
      }
    } catch (e) { /* source absente */ }
  };
  const vault = require('./vault-conf.js')().CLAUDE_VAULT;
  if (vault) read(path.join(vault, 'claude', 'projets-map.conf'));
  read(path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'todo-map.conf'));
  return out;
};
