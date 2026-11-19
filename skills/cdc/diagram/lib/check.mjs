// Controles geometriques d'un layout generique (layout.mjs). Bloquants : un dessin qui en echoue un n'est pas livre.
import { MARK_LEN, MARK_HALF } from './svg.mjs';

export const BLOCKING = ['overlapNodes', 'nodeOutsideGroup', 'overlapGroups', 'edgeThroughNode', 'sharedSegments',
  'labelHidden', 'markerFit', 'wrongAnchor', 'outOfBounds', 'incomplete'];

export function check(g, lay) {
  const res = { crossings: 0, length: 0, bends: 0 };
  for (const k of BLOCKING) res[k] = [];
  const inter = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
  const N = Object.entries(lay.nodes), G = Object.entries(lay.groups);

  // completude : chaque arete du modele est dessinee, avec chacune de ses etiquettes declarees
  const drawn = Object.fromEntries(lay.edges.map((e) => [e.id, e]));
  for (const e of g.edges) {
    const d = drawn[e.id];
    if (!d || d.points.length < 2) { res.incomplete.push(`${e.id} (${e.from}->${e.to}) non dessinee`); continue; }
    for (const [pos, text] of Object.entries(e.labels)) {
      if (text && !d.labels.some((l) => l.pos === pos && l.text === text)) res.incomplete.push(`${e.id} etiquette ${pos} "${text}" absente`);
    }
  }
  for (const n of g.nodes) if (!lay.nodes[n.id]) res.incomplete.push(`noeud ${n.id} non place`);

  // extremites sur le bord de leur noeud (dans sa largeur ou sa hauteur)
  const onBorder = (id, [x, y]) => {
    const r = lay.nodes[id];
    if (!r) return false;
    const inX = x >= r.x - 0.5 && x <= r.x + r.w + 0.5, inY = y >= r.y - 0.5 && y <= r.y + r.h + 0.5;
    return (inY && (Math.abs(x - r.x) < 0.5 || Math.abs(x - r.x - r.w) < 0.5)) || (inX && (Math.abs(y - r.y) < 0.5 || Math.abs(y - r.y - r.h) < 0.5));
  };
  const segLen = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (const e of lay.edges) {
    if (e.points.length < 2) continue;
    if (!onBorder(e.from, e.points[0])) res.wrongAnchor.push(`${e.id} depart hors du bord de ${e.from}`);
    if (!onBorder(e.to, e.points.at(-1))) res.wrongAnchor.push(`${e.id} arrivee hors du bord de ${e.to}`);
    // un marqueur (losange, triangle, fleche) tient sur son segment terminal, sinon il deborde du coude
    const s = MARK_LEN[e.start] ?? 0, t = MARK_LEN[e.end] ?? 0;
    if (s && segLen(e.points[0], e.points[1]) < s + 4) res.markerFit.push(`${e.id} marqueur ${e.start} (${s} px) sur un segment de ${Math.round(segLen(e.points[0], e.points[1]))} px`);
    if (t && segLen(e.points.at(-1), e.points.at(-2)) < t + 4) res.markerFit.push(`${e.id} marqueur ${e.end} (${t} px) sur un segment de ${Math.round(segLen(e.points.at(-1), e.points.at(-2)))} px`);
    // le marqueur ne recouvre aucune etiquette
    for (const [len, half, p, q] of [[s, MARK_HALF[e.start], e.points[0], e.points[1]], [t, MARK_HALF[e.end], e.points.at(-1), e.points.at(-2)]]) {
      if (!len) continue;
      const d = segLen(p, q) || 1, tip = [p[0] + (q[0] - p[0]) * len / d, p[1] + (q[1] - p[1]) * len / d];
      const box = { x: Math.min(p[0], tip[0]) - half, y: Math.min(p[1], tip[1]) - half, w: Math.abs(p[0] - tip[0]) + 2 * half, h: Math.abs(p[1] - tip[1]) + 2 * half };
      for (const x of lay.edges) for (const l of x.labels) if (inter(box, l, -1)) res.markerFit.push(`${e.id} marqueur sous l'etiquette "${l.text}" de ${x.id}`);
    }
  }

  const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + (b.w ?? 0) <= lay.width && b.y + (b.h ?? 0) <= lay.height;
  for (const [n, r] of N) if (!inside(r)) res.outOfBounds.push(`noeud ${n}`);
  for (const [n, r] of G) if (!inside(r)) res.outOfBounds.push(`groupe ${n}`);
  for (const e of lay.edges) {
    if (e.points.some(([x, y]) => !inside({ x, y }))) res.outOfBounds.push(`${e.id} trace`);
    for (const l of e.labels) if (!inside(l)) res.outOfBounds.push(`${e.id} etiquette "${l.text}"`);
  }

  for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++)
    if (inter(N[i][1], N[j][1], 10)) res.overlapNodes.push(`${N[i][0]} / ${N[j][0]}`);
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++)
    if (inter(G[i][1], G[j][1])) res.overlapGroups.push(`${G[i][0]} / ${G[j][0]}`);
  for (const [n, r] of N) {
    if (!r.group) { for (const [gn, gr] of G) if (inter(r, gr)) res.nodeOutsideGroup.push(`${n} (sans groupe) dans le cadre ${gn}`); continue; }
    const gr = lay.groups[r.group];
    if (!gr || r.x < gr.x || r.y < gr.y || r.x + r.w > gr.x + gr.w || r.y + r.h > gr.y + gr.h) res.nodeOutsideGroup.push(`${n} hors du cadre ${r.group}`);
    if (gr?.label && inter(r, gr.label)) res.nodeOutsideGroup.push(`${n} sur le titre du cadre ${r.group}`);
  }

  const segs = [];
  for (const e of lay.edges) {
    for (let k = 0; k + 1 < e.points.length; k++) segs.push({ e, a: e.points[k], b: e.points[k + 1] });
    res.bends += Math.max(0, e.points.length - 2);
  }
  const segBox = (s) => ({ x: Math.min(s.a[0], s.b[0]), y: Math.min(s.a[1], s.b[1]), w: Math.abs(s.a[0] - s.b[0]), h: Math.abs(s.a[1] - s.b[1]) });
  for (const s of segs) {
    res.length += Math.hypot(s.a[0] - s.b[0], s.a[1] - s.b[1]);
    for (const [n, r] of N) {
      // noeuds tiers : bord compris ; noeuds du lien : l'interieur seulement (le lien part et arrive sur le bord)
      const m = n === s.e.from || n === s.e.to ? 2 : 1;
      if (inter(segBox(s), { x: r.x + m, y: r.y + m, w: r.w - 2 * m, h: r.h - 2 * m })) res.edgeThroughNode.push(`${s.e.id} (${s.e.from}->${s.e.to}) traverse ${n}`);
    }
  }
  const cross = new Set();
  const horiz = (s) => Math.abs(s.a[1] - s.b[1]) < 0.5, vert = (s) => Math.abs(s.a[0] - s.b[0]) < 0.5;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const p = segs[i], q = segs[j];
    if (p.e.id === q.e.id) continue;
    const P = segBox(p), Q = segBox(q);
    if (horiz(p) && horiz(q) && Math.abs(p.a[1] - q.a[1]) < 3) {
      if (Math.min(P.x + P.w, Q.x + Q.w) - Math.max(P.x, Q.x) > 4) res.sharedSegments.push(`${p.e.id}/${q.e.id} y=${Math.round(p.a[1])}`);
    } else if (vert(p) && vert(q) && Math.abs(p.a[0] - q.a[0]) < 3) {
      if (Math.min(P.y + P.h, Q.y + Q.h) - Math.max(P.y, Q.y) > 4) res.sharedSegments.push(`${p.e.id}/${q.e.id} x=${Math.round(p.a[0])}`);
    } else if ((horiz(p) && vert(q)) || (vert(p) && horiz(q))) {
      const Hh = horiz(p) ? P : Q, V = horiz(p) ? Q : P;
      if (V.x > Hh.x + 1 && V.x < Hh.x + Hh.w - 1 && Hh.y > V.y + 1 && Hh.y < V.y + V.h - 1) cross.add(Math.round(V.x) + ',' + Math.round(Hh.y));
    }
  }
  res.crossings = cross.size;

  const labels = lay.edges.flatMap((e) => e.labels.map((l) => ({ id: e.id, ...l })));
  const titles = G.filter(([, r]) => r.label).map(([n, r]) => ({ n, ...r.label }));
  for (let i = 0; i < labels.length; i++) {
    const L = labels[i];
    for (const [n, r] of N) if (inter(L, r, -1)) res.labelHidden.push(`${L.id} "${L.text}" sur ${n}`);
    for (const t of titles) if (inter(L, t, -1)) res.labelHidden.push(`${L.id} "${L.text}" sur le titre du cadre ${t.n}`);
    for (let j = i + 1; j < labels.length; j++) if (inter(L, labels[j], -1)) res.labelHidden.push(`${L.id} "${L.text}" sur etiquette ${labels[j].id} "${labels[j].text}"`);
    for (const s of segs) if (s.e.id !== L.id && inter(L, segBox(s), -1)) { res.labelHidden.push(`${L.id} "${L.text}" sur lien ${s.e.id}`); break; }
  }
  res.ok = BLOCKING.every((k) => !res[k].length);
  return res;
}
