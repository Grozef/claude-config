// Layout generique (layout.mjs) + graphe (model.mjs) -> SVG. Memes conventions que la BDD : classes CSS sur variables,
// theme sombre par la page, data-* pour le viewer.
import { esc } from './text.mjs';
import { HEAD, STEREO, cardRows } from './layout.mjs';

const PALETTE = ['#98BFDA', '#9FD39B', '#F2C48D', '#C7B3E5', '#8FD3D1', '#E9A3B8', '#BDBDBD', '#E6D58A', '#A9C4EB'];
export const groupColors = (g) => Object.fromEntries(g.groups.map((n, i) => [n, PALETTE[i % PALETTE.length]]));
// longueur de chaque marqueur le long du lien (lue par check.mjs : le segment terminal doit la contenir)
export const MARK_LEN = { none: 0, arrow: 10, open: 10, triangle: 12, diamond: 14, odiamond: 14 };
// demi-largeur de chaque marqueur, perpendiculairement au lien (memes valeurs que marker() ci-dessous)
export const MARK_HALF = { none: 0, arrow: 4.5, open: 5, triangle: 7, diamond: 5, odiamond: 5 };

// Marqueur a l'extremite (x,y), (dx,dy) = direction unitaire VERS l'exterieur de la carte (le long du lien)
export function marker(kind, x, y, dx, dy) {
  const px = -dy, py = dx;
  const at = (d, o) => [x + dx * d + px * o, y + dy * d + py * o].map((v) => +v.toFixed(2));
  const poly = (pts, cls) => `<path class="${cls}" d="M${pts.map((p) => p.join(',')).join('L')}Z"/>`;
  switch (kind) {
    case 'arrow': return poly([at(0, 0), at(10, -4.5), at(10, 4.5)], 'mk-fill');
    case 'open': { const a = at(10, -5), b = at(0, 0), c = at(10, 5); return `<path class="mk-line" d="M${a}L${b}L${c}"/>`; }
    case 'triangle': return poly([at(0, 0), at(12, -7), at(12, 7)], 'mk-hollow');
    case 'diamond': return poly([at(0, 0), at(7, -5), at(14, 0), at(7, 5)], 'mk-fill');
    case 'odiamond': return poly([at(0, 0), at(7, -5), at(14, 0), at(7, 5)], 'mk-hollow');
    default: return '';
  }
}

const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

function card(n, b, color) {
  const { rows, seps } = cardRows(n, b);
  const st = n.stereotype ? `<text x="${b.x + b.w / 2}" y="${b.y + 13}" class="st" text-anchor="middle">${esc(n.stereotype)}</text>` : '';
  const titleY = b.y + (n.stereotype ? STEREO : 0) + 18;
  return `<rect class="card-bg" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3"/>`
    + `<rect class="head" x="${b.x}" y="${b.y}" width="${b.w}" height="${HEAD + (n.stereotype ? STEREO : 0)}" rx="3" fill="${color}"/>`
    + st + `<text x="${b.x + b.w / 2}" y="${titleY}" class="tn${n.stereotype === '«abstract»' ? ' abs' : ''}" text-anchor="middle">${esc(n.title)}</text>`
    + seps.map((y) => `<line class="sep" x1="${b.x}" y1="${y}" x2="${b.x + b.w}" y2="${y}"/>`).join('')
    + rows.map((r) => `<text x="${b.x + 8}" y="${r.y + 4}" class="row">${esc(r.text)}</text>`).join('')
    + `<rect class="card-bd" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3"/>`;
}

export function renderSvg(g, lay) {
  const colors = groupColors(g);
  const W = Math.ceil(lay.width), H = Math.ceil(lay.height);
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" class="dgm" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Tahoma, 'Segoe UI', sans-serif">`,
    `<rect class="bgfill" x="0" y="0" width="${W}" height="${H}"/>`];
  for (const [name, r] of Object.entries(lay.groups)) {
    parts.push(`<g class="grp" data-group="${esc(name)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="${colors[name]}" fill-opacity=".12" stroke="${colors[name]}" stroke-width="1.5"/>`
      + (r.label ? `<text x="${r.label.x}" y="${r.label.y + 13}" class="grp-label" fill="${colors[name]}">${esc(name)}</text>` : '') + '</g>');
  }
  for (const e of lay.edges) {
    const p = e.points;
    if (p.length < 2) continue;
    const d = 'M' + p.map((q) => q.join(',')).join('L');
    const ds = dir(p[1], p[0]), dt = dir(p.at(-2), p.at(-1));
    parts.push(`<g class="rel${e.dashed ? ' dashed' : ''}" data-rel="${esc(e.id)}" data-from="${esc(e.from)}" data-to="${esc(e.to)}">`
      + `<path class="hit" d="${d}"/><path class="ln" d="${d}"/>`
      + marker(e.start, p[0][0], p[0][1], -ds[0], -ds[1]) + marker(e.end, p.at(-1)[0], p.at(-1)[1], -dt[0], -dt[1])
      + e.labels.map((l) => `<text class="lbl" x="${l.x + l.w / 2}" y="${l.y + l.h - 3}" text-anchor="middle">${esc(l.text)}</text>`).join('')
      + '</g>');
  }
  for (const [id, b] of Object.entries(lay.nodes)) {
    const n = byId[id];
    parts.push(`<g class="node" data-node="${esc(id)}" data-group="${esc(n.group ?? '')}">${card(n, b, n.group ? colors[n.group] : '#98BFDA')}</g>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export const SVG_CSS = `
.dgm{--bg:#fff;--ink:#1f2328;--mute:#6a737d;--line:#5b6573;--bd:#8aa4bf;--row:#fff}
.dgm .bgfill{fill:var(--bg)}
.dgm .grp-label{font-size:13px;font-weight:700;letter-spacing:.04em}
.dgm .card-bg{fill:var(--row)} .dgm .card-bd{fill:none;stroke:var(--bd);stroke-width:1}
.dgm .sep{stroke:var(--bd);stroke-width:1}
.dgm .tn{font-size:12px;font-weight:700;fill:#10233a} .dgm .tn.abs{font-style:italic}
.dgm .st{font-size:10px;font-style:italic;fill:#10233a}
.dgm .row{font-size:11px;fill:var(--ink)}
.dgm .rel .ln{fill:none;stroke:var(--line);stroke-width:1.3}
.dgm .rel.dashed .ln{stroke-dasharray:6 4}
.dgm .rel .hit{fill:none;stroke:transparent;stroke-width:9}
.dgm .mk-fill{fill:var(--line);stroke:var(--line);stroke-width:1}
.dgm .mk-hollow{fill:var(--bg);stroke:var(--line);stroke-width:1.3}
.dgm .mk-line{fill:none;stroke:var(--line);stroke-width:1.3}
.dgm .lbl{font-size:10.5px;fill:#8a3b12}
`;
