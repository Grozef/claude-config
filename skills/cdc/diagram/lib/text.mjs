// Texte : largeur d'une chaine par style (table mesuree dans Chrome par build.mjs, sinon table Tahoma figee
// assets/charwidths.json) et echappement HTML/SVG.
import fs from 'node:fs';

const CW = JSON.parse(fs.readFileSync(new URL('../assets/charwidths.json', import.meta.url), 'utf8'));
// style du diagramme -> table de la police figee, quand aucune mesure n'a pu etre faite
const FALLBACK = { title: 'bold', stereo: 'col', row: 'col', label: 'col', group: 'bold' };

export const widthFn = (cw) => (s, kind) => {
  const m = cw?.[kind] ?? CW[FALLBACK[kind]];
  return [...String(s)].reduce((a, ch) => a + (m[ch] ?? m.__fallback), 0);
};

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
