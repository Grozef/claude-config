// Graphe generique (model.mjs) -> positions absolues. ELK layered en une passe : ports libres, routage orthogonal,
// etiquettes de debut / milieu / fin placees par ELK. Groupes = noeuds composes (INCLUDE_CHILDREN).
import ELK from 'elkjs/lib/elk.bundled.js';
import { widthFn } from './text.mjs';

// Styles de texte (cles de la table de chasse mesuree par chrome.mjs) : memes polices que la BDD
export const STYLES = { title: 'font-size:12px;font-weight:700', stereo: 'font-size:10px;font-style:italic',
  row: 'font-size:11px', label: 'font-size:10.5px', group: 'font-size:13px;font-weight:700' };
export const HEAD = 26, STEREO = 13, ROW = 18, PADC = 8, LABEL_H = 13;

export function nodeSize(n, wd) {
  if (n.shape === 'card') {
    const texts = [wd(n.title, 'title') + 16, n.stereotype ? wd(n.stereotype, 'stereo') + 16 : 0,
      ...n.compartments.flat().map((r) => wd(r, 'row') + 16)];
    const h = HEAD + (n.stereotype ? STEREO : 0) + n.compartments.reduce((a, c) => a + c.length * ROW + PADC, 0);
    return { w: Math.ceil(Math.max(110, ...texts)), h };
  }
  throw new Error('forme inconnue : ' + n.shape);
}

// Geometrie d'une carte, partagee par svg.mjs (dessin) et check.mjs (debordement) : y de chaque ligne de compartiment
export function cardRows(n, box) {
  const rows = [];
  let y = box.y + HEAD + (n.stereotype ? STEREO : 0);
  const seps = [];
  for (const c of n.compartments) {
    seps.push(y);
    c.forEach((text, i) => rows.push({ text, y: y + PADC / 2 + ROW * i + ROW / 2 }));
    y += c.length * ROW + PADC;
  }
  return { rows, seps };
}

export async function layoutGraph(g, o = {}) {
  const wd = widthFn(o.cw);
  const SP = o.spacing ?? 1;
  const base = {
    'elk.algorithm': 'layered', 'elk.direction': g.direction ?? 'DOWN', 'elk.edgeRouting': 'ORTHOGONAL',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.json.shapeCoords': 'ROOT', 'elk.json.edgeCoords': 'ROOT',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', 'elk.layered.thoroughness': '60',
    'elk.spacing.nodeNode': String(60 * SP), 'elk.layered.spacing.nodeNodeBetweenLayers': String(70 * SP),
    'elk.spacing.edgeEdge': String(14 * SP), 'elk.spacing.edgeNode': String(24 * SP),
    'elk.layered.spacing.edgeEdgeBetweenLayers': String(14 * SP), 'elk.layered.spacing.edgeNodeBetweenLayers': String(30 * SP),
    'elk.spacing.edgeLabel': '5', 'elk.spacing.labelLabel': '4', 'elk.spacing.componentComponent': String(70 * SP),
    'elk.padding': '[top=40,left=40,bottom=40,right=40]',
  };
  // Piege ELK connu (SKILL.md) : en INCLUDE_CHILDREN, les noeuds de groupe portent les memes options que la racine
  const groupOpts = { ...base, 'elk.padding': '[top=40,left=20,bottom=20,right=20]' };
  const size = Object.create(null);
  const root = { id: 'root', layoutOptions: base, children: [], edges: [] };
  const gnodes = Object.create(null);
  const GID = (name) => '\u0000g' + name;
  for (const n of g.nodes) {
    size[n.id] = nodeSize(n, wd);
    const node = { id: n.id, width: size[n.id].w, height: size[n.id].h };
    if (n.group) (gnodes[n.group] ??= { id: GID(n.group), layoutOptions: groupOpts, children: [],
      labels: [{ text: n.group, width: wd(n.group, 'group'), height: 16 }] }).children.push(node);
    else root.children.push(node);
  }
  root.children.push(...Object.values(gnodes));
  const PL = { start: 'TAIL', mid: 'CENTER', end: 'HEAD' };
  // auto-relations tracees a la main apres ELK (sa boucle de 10 px ne laisse pas la place a un losange de 14 px)
  for (const e of g.edges.filter((x) => x.from !== x.to)) {
    // reverse : arete posee a l'envers pour le placement (parent au-dessus de l'enfant), remise dans le sens du modele apres
    const lab = Object.entries(e.labels).filter(([, t]) => t).map(([pos, text]) => {
      const p = e.reverse ? { start: 'end', end: 'start', mid: 'mid' }[pos] : pos;
      return { id: e.id + ':' + pos, text, width: Math.ceil(wd(text, 'label')) + 4, height: LABEL_H, layoutOptions: { 'elk.edgeLabels.placement': PL[p] } };
    });
    root.edges.push({ id: e.id, sources: [e.reverse ? e.to : e.from], targets: [e.reverse ? e.from : e.to], labels: lab });
  }
  const res = await new ELK().layout(root);

  const out = { kind: g.kind, title: g.title, width: res.width, height: res.height, nedges: g.edges.length,
    nodes: Object.create(null), groups: Object.create(null), edges: [] };
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const walk = (n) => {
    for (const c of n.children ?? []) {
      if (c.id.startsWith('\u0000g')) {
        const lb = c.labels?.[0];
        out.groups[c.id.slice(2)] = { x: c.x, y: c.y, w: c.width, h: c.height, label: lb ? { x: c.x + 12, y: c.y + 8, w: lb.width, h: 16 } : null };
      } else out.nodes[c.id] = { x: c.x, y: c.y, w: c.width, h: c.height, group: byId[c.id].group };
      walk(c);
    }
  };
  walk(res);
  const elkEdges = [];
  const collect = (n) => { for (const e of n.edges ?? []) elkEdges.push(e); for (const c of n.children ?? []) collect(c); };
  collect(res);
  const meta = Object.fromEntries(g.edges.map((e) => [e.id, e]));
  for (const e of elkEdges) {
    const m = meta[e.id];
    let pts = [];
    for (const s of e.sections ?? []) pts.push([s.startPoint.x, s.startPoint.y], ...(s.bendPoints ?? []).map((b) => [b.x, b.y]), [s.endPoint.x, s.endPoint.y]);
    if (m.reverse) pts = pts.reverse();
    const labels = (e.labels ?? []).map((l) => ({ pos: l.id.split(':').at(-1), text: l.text, x: l.x, y: l.y, w: l.width, h: l.height }));
    out.edges.push({ id: m.id, from: m.from, to: m.to, start: m.start, end: m.end, dashed: m.dashed, points: pts, labels });
  }
  // boucle d'auto-relation : sort du bord est, revient plus bas. Plusieurs boucles du meme noeud s'emboitent vers
  // l'exterieur : chacune plus large (apres l'etiquette du milieu de la precedente) et plus haute (20 px par rang).
  const loops = Object.create(null);
  const lw = (t) => Math.ceil(wd(t, 'label')) + 4;
  for (const e of g.edges.filter((x) => x.from === x.to)) {
    const r = out.nodes[e.from];
    const st = loops[e.from] ??= { i: -1, right: 40 };
    const i = ++st.i;
    const x0 = r.x + r.w, x1 = x0 + st.right;
    st.right += (e.labels.mid ? lw(e.labels.mid) + 8 : 0) + 24;
    const y1 = Math.max(r.y + 4, r.y + r.h / 2 - 10 - 20 * i), y2 = Math.min(r.y + r.h - 4, r.y + r.h / 2 + 10 + 20 * i);
    const labels = [];
    if (e.labels.start) labels.push({ pos: 'start', text: e.labels.start, x: x0 + 18, y: y1 - LABEL_H - 2, w: lw(e.labels.start), h: LABEL_H });
    if (e.labels.end) labels.push({ pos: 'end', text: e.labels.end, x: x0 + 18, y: y2 + 2, w: lw(e.labels.end), h: LABEL_H });
    if (e.labels.mid) labels.push({ pos: 'mid', text: e.labels.mid, x: x1 + 4, y: (y1 + y2) / 2 - LABEL_H / 2, w: lw(e.labels.mid), h: LABEL_H });
    out.edges.push({ id: e.id, from: e.from, to: e.to, start: e.start, end: e.end, dashed: e.dashed,
      points: [[x0, y1], [x1, y1], [x1, y2], [x0, y2]], labels });
    out.width = Math.max(out.width, x1 + 40, ...labels.map((l) => l.x + l.w + 40));
  }
  return out;
}
