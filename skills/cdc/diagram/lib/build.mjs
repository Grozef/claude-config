// Diagramme generique : model.json (kind class...) -> graphe -> layout -> controles -> <nom>.html + <nom>.png (+ _build/).
// Usage : node build.mjs <model.json> <dossier_sortie> <nom> [--title="..."] (via cdc.sh draw)
// Code de sortie 2 si le modele est invalide, 1 si les controles echouent (rien n'est ecrit hors _build/).
import fs from 'node:fs';
import path from 'node:path';
import { chrome, inChrome, measureChars, screenshot } from './chrome.mjs';
import { toGraph } from './model.mjs';
import { layoutGraph, STYLES } from './layout.mjs';
import { check, BLOCKING } from './check.mjs';
import { renderSvg, SVG_CSS } from './svg.mjs';
import { staticPage, interactivePage } from './render.mjs';

const [, , modelPath, outDir, name, ...rest] = process.argv;
if (!modelPath || !outDir || !name) { console.log('usage : node build.mjs <model.json> <dossier_sortie> <nom> [--title="..."]'); process.exit(2); }
const opt = Object.fromEntries(rest.map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
let g;
try { g = toGraph(JSON.parse(fs.readFileSync(modelPath, 'utf8'))); } catch (e) { console.log('ECHEC : ' + e.message); process.exit(2); }
const build = path.join(outDir, '_build');
fs.mkdirSync(build, { recursive: true });
// livrables d'une execution precedente retires : en cas d'echec, aucun ancien HTML ou PNG ne passe pour le resultat
const htmlPath = path.join(outDir, name + '.html'), pngPath = path.join(outDir, name + '.png');
for (const p of [htmlPath, pngPath]) if (fs.existsSync(p)) fs.rmSync(p);

let cw;
if (chrome) {
  const chars = new Set('«»():.,+-#~ 0123456789*');
  const add = (s) => { for (const ch of String(s ?? '')) chars.add(ch); };
  for (const n of g.nodes) { add(n.title); add(n.stereotype); n.compartments.flat().forEach(add); }
  for (const e of g.edges) Object.values(e.labels).forEach(add);
  g.groups.forEach(add);
  cw = measureChars(path.join(build, 'charwidths.html'), chars, STYLES);
  if (!cw) { console.log('ECHEC : mesure des largeurs de texte impossible (Chrome --dump-dom)'); process.exit(1); }
  console.log(`[texte] largeurs mesurees dans Chrome : ${chars.size} caracteres x ${Object.keys(STYLES).length} styles`);
} else console.log('[texte] ni Chrome, Edge ni Chromium (CDC_CHROME) : largeurs de la table Tahoma figee, debordement non mesure');

let lay, res, spacing;
for (spacing of [1, 1.4, 1.8]) {
  lay = await layoutGraph(g, { cw, spacing });
  res = check(g, lay);
  if (res.ok) break;
}
fs.writeFileSync(path.join(build, 'graph.json'), JSON.stringify(g, null, 1));
fs.writeFileSync(path.join(build, 'layout.json'), JSON.stringify(lay));
fs.writeFileSync(path.join(build, 'check.json'), JSON.stringify(res, null, 1));
console.log(`[${g.kind}] ${Math.round(lay.width)}x${Math.round(lay.height)} espacement=${spacing} ` + BLOCKING.map((k) => `${k}=${res[k].length}`).join(' ') + ` croisements=${res.crossings} -> ${res.ok ? 'OK' : 'ECHEC'}`);
if (!res.ok) {
  for (const k of BLOCKING) for (const x of res[k]) console.log(`   ${k}: ${x}`);
  console.log('ECHEC des controles : aucun livrable ecrit (details dans ' + build + ')');
  process.exit(1);
}

// Debordement de texte mesure par le navigateur : tout texte d'une carte reste dans la carte
if (chrome) {
  const MEASURE = `<script>const out=[];for(const N of document.querySelectorAll('.node')){const c=N.querySelector('.card-bg').getBBox();
for(const t of N.querySelectorAll('text')){const b=t.getBBox();if(b.x<c.x+1||b.x+b.width>c.x+c.width-1||b.y<c.y||b.y+b.height>c.y+c.height)out.push(N.dataset.node+' : "'+t.textContent+'" deborde')}}
const p=document.createElement('pre');p.id='out';p.textContent=JSON.stringify(out);document.body.appendChild(p)</script>`;
  const over = inChrome(path.join(build, 'measure.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${SVG_CSS}</style></head><body>${renderSvg(g, lay)}${MEASURE}</body></html>`);
  if (!over) { console.log('ECHEC : mesure du texte impossible (Chrome --dump-dom)'); process.exit(1); }
  console.log(`[texte] debordements mesures dans Chrome : ${over.length} -> ${over.length ? 'ECHEC' : 'OK'}`);
  if (over.length) { for (const x of over.slice(0, 20)) console.log('   ' + x); console.log('ECHEC : aucun livrable ecrit'); process.exit(1); }
}

const title = opt.title ?? (g.title || name);
fs.writeFileSync(htmlPath, interactivePage(g, lay, { title }));
const staticPath = path.join(build, 'static.html');
fs.writeFileSync(staticPath, staticPage(g, lay));
if (!chrome) console.log('PNG NON PRODUIT par cette execution : ni Chrome, Edge ni Chromium trouves (CDC_CHROME)');
else {
  const W = Math.ceil(lay.width), H = Math.ceil(lay.height);
  screenshot(staticPath, pngPath, W, H);
  console.log(`PNG ${pngPath} (${W * 2}x${H * 2})`);
}
console.log(`HTML ${htmlPath} (${Math.round(fs.statSync(htmlPath).size / 1024)} Ko, ${g.nodes.length} noeuds, ${g.edges.length} relations)`);
