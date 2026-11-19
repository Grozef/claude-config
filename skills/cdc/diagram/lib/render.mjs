// HTML autonome d'un diagramme generique (aucune ressource externe) + page statique pour le PNG. Le script
// n'est autorise que par son empreinte sha256, pas de 'unsafe-inline'.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { esc } from './text.mjs';
import { renderSvg, SVG_CSS, groupColors } from './svg.mjs';

// fins de ligne ramenees a LF : le navigateur normalise avant de calculer l'empreinte (clone Windows en CRLF)
const VIEWER = fs.readFileSync(new URL('../assets/dgm-viewer.js', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const VIEWER_SHA = 'sha256-' + crypto.createHash('sha256').update(VIEWER, 'utf8').digest('base64');
const KIND_LABEL = { class: 'classes' };

export function staticPage(g, lay) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}${SVG_CSS}</style></head><body>${renderSvg(g, lay)}</body></html>`;
}

export function interactivePage(g, lay, { title }) {
  const colors = groupColors(g);
  const legend = g.groups.map((n) => `<span class="lg"><i style="background:${colors[n]}"></i>${esc(n)}</span>`).join('');
  const data = { file: title.replace(/[^\w.-]+/g, '_') };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${VIEWER_SHA}'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--ui:#f6f7f9;--uib:#d9dee5;--uit:#1f2328;--uim:#6a737d;--acc:#d9480f;--panel:#fff;color-scheme:light}
:root[data-theme=dark]{--ui:#1b1e24;--uib:#343a45;--uit:#e6e8ec;--uim:#98a1b0;--panel:#22262d;color-scheme:dark}
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{font:13px/1.4 'Segoe UI',Tahoma,sans-serif;background:var(--ui);color:var(--uit);display:flex;flex-direction:column;overflow:hidden}
header{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--uib)}
header h1{font-size:15px;margin:0 6px 0 0}header .stat{color:var(--uim)}
header button{padding:5px 9px;border:1px solid var(--uib);border-radius:6px;background:var(--panel);color:var(--uit);cursor:pointer;font:inherit}
.lg{display:inline-flex;gap:5px;align-items:center;font-size:12px;margin-right:8px}.lg i{width:10px;height:10px;border-radius:2px;display:inline-block}
main{flex:1;position:relative;overflow:hidden;cursor:grab}main.drag{cursor:grabbing}
#stage{position:absolute;left:0;top:0;transform-origin:0 0}
.hint{position:absolute;left:12px;bottom:10px;color:var(--uim);font-size:12px;background:var(--ui);padding:3px 8px;border-radius:6px;border:1px solid var(--uib)}
${SVG_CSS}
:root[data-theme=dark] .dgm{--bg:#16181d;--ink:#e6e8ec;--mute:#98a1b0;--line:#9aa4b2;--bd:#4a5668;--row:#22262d}
:root[data-theme=dark] .dgm .lbl{fill:#ffb37a}
.dgm .node,.dgm .rel{transition:opacity .12s}
.focus .dgm .node:not(.on):not(.nb),.focus .dgm .rel:not(.on),.focus .dgm .grp{opacity:.15}
.dgm .rel.on .ln{stroke:var(--acc);stroke-width:2.4}.dgm .node.on .card-bd{stroke:var(--acc);stroke-width:3}
.dgm .node,.dgm .rel .hit{cursor:pointer}
</style></head><body>
<header><h1>${esc(title)}</h1><span class="stat">${g.nodes.length} ${esc(KIND_LABEL[g.kind] ?? 'noeuds')} &middot; ${g.edges.length} relations</span>
<button id="fit">Ajuster</button><button id="zin">+</button><button id="zout">&minus;</button><button id="theme">Thème</button><button id="png">Export PNG</button>
<span>${legend}</span></header>
<main id="main"><div id="stage">${renderSvg(g, lay)}</div>
<div class="hint">Molette : zoom &middot; glisser : déplacer &middot; survol / clic : relations d'un élément &middot; Échap : tout afficher</div></main>
<script type="application/json" id="dgm-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>${VIEWER}</script></body></html>`;
}
