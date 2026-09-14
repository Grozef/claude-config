// Lecture de ~/.claude/todo-map.conf cote node (tools/todo-project.sh le source directement).
// Correspondance dossier de travail -> tag(s) du TODO global. Retourne {} si le fichier
// est absent : l'appelant doit alors le DIRE, pas rendre une liste vide (une absence de
// correspondance ne se lit pas comme une absence de taches).
const fs = require('fs');
const path = require('path');

module.exports = function todoMap() {
  const file = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'todo-map.conf');
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*\["([^"]+)"\]\s*=\s*"([^"]*)"/);
      if (m) out[m[1]] = m[2].split(/\s+/).filter(Boolean);
    }
  } catch (e) { /* pas de config locale */ }
  return out;
};
