// Notes de session du projet courant dans le vault (sessions/<repo>/YYYY-MM-DD.md), plus recentes
// d'abord. Lues au nom du dossier courant ET de la racine git : depuis un sous-dossier d'un monorepo
// (sous-projet), le seul basename retombait sur des notes de septembre.
// Retourne [] sans vault ou sans note -> l'appelant degrade en silence.
const fs = require('fs');
const path = require('path');

module.exports = function sessionNotes(cwd, n = 3) {
  const vault = require('./vault-conf.js')().CLAUDE_VAULT;
  if (!vault || !cwd) return [];
  const noms = new Set([path.basename(cwd)]);
  for (let d = cwd; d !== path.dirname(d); d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) { noms.add(path.basename(d)); break; }
  }
  const notes = [];
  for (const nom of noms) {
    try {
      for (const f of fs.readdirSync(path.join(vault, 'sessions', nom))) {
        if (/^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)) notes.push({ fichier: f, rel: `sessions/${nom}/${f}`, chemin: path.join(vault, 'sessions', nom, f) });
      }
    } catch (e) { /* pas de dossier pour ce nom */ }
  }
  return notes.sort((a, b) => b.fichier.localeCompare(a.fichier)).slice(0, n);
};
