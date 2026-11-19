// Moteur de diagrammes du skill cdc (lib/) : validation du modele, mutations des controles, rendu, ligne de commande.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toGraph } from '../lib/model.mjs';
import { layoutGraph } from '../lib/layout.mjs';
import { check, BLOCKING } from '../lib/check.mjs';
import { renderSvg } from '../lib/svg.mjs';
import { interactivePage } from '../lib/render.mjs';
const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const loadModel = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));

// cdc.sh draw : outil du skill (~/.claude/tools), a cote du dossier skills/
const CDC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'tools', 'cdc.sh');
const clone = (x) => structuredClone(x);
let G, L;
before(async () => { G = toGraph(loadModel('class.model.json')); L = await layoutGraph(G); });

test('class : graphe tire du modele (marqueurs, sens, etiquettes, groupes)', () => {
  assert.equal(G.nodes.length, 8);
  const rel = (from, to) => G.edges.find((e) => e.from === from && e.to === to);
  assert.deepEqual([rel('User', 'Model').end, rel('User', 'Model').reverse], ['triangle', true]);
  assert.deepEqual([rel('Inspection', 'Exportable').end, rel('Inspection', 'Exportable').dashed], ['triangle', true]);
  assert.equal(rel('Inspection', 'Subject').start, 'diamond');
  assert.equal(rel('Subject', 'Photo').start, 'odiamond');
  assert.equal(rel('User', 'Inspection').end, 'open'); // association navigable
  assert.equal(rel('Inspection', 'Status').end, 'none'); // association simple
  assert.deepEqual([rel('ReportService', 'Inspection').end, rel('ReportService', 'Inspection').dashed], ['open', true]);
  assert.deepEqual(rel('User', 'Inspection').labels, { start: '1', mid: 'realise', end: '0..*' });
  const status = G.nodes.find((n) => n.id === 'Status');
  assert.equal(status.compartments.length, 1); // enum : un seul compartiment (valeurs)
  assert.equal(G.nodes.find((n) => n.id === 'User').compartments[0][1], '- password : string');
  assert.equal(status.group, 'Domaine');
});

test('modele invalide : refus lisible', () => {
  const base = loadModel('class.model.json');
  const bad = [
    [{ ...base, kind: 'uml' }, /kind "uml"/],
    [{ ...base, classes: [] }, /au moins une classe/],
    [{ ...base, classes: [...base.classes, { name: 'User' }] }, /"User" en double/],
    [{ ...base, relations: [{ from: 'User', to: 'Nope', kind: 'association' }] }, /classe "Nope" inconnue/],
    [{ ...base, relations: [{ from: 'User', to: 'Model', kind: 'herite' }] }, /kind : inheritance/],
    [{ ...base, classes: [{ name: 'A', attributes: [{ name: 'x', visibility: '*' }] }], relations: [], groups: {} }, /visibilite/],
    [{ ...base, groups: { X: ['Nope'] } }, /"Nope" inconnu/],
    [{ ...base, groups: { X: ['User'], Y: ['User'] } }, /dans deux groupes/],
    [{ ...base, classes: [{ name: 'A\nB' }], relations: [], groups: {} }, /caractere de controle/],
    [{ ...base, classes: [{ name: 'A', attributes: [{ name: 'x', type: 'a\tb' }] }], relations: [], groups: {} }, /caractere de controle/],
    // cles heritees d'Object.prototype : jamais prises pour un kind ou une relation connus (contournait la validation)
    [{ kind: 'constructor', nodes: [], edges: [], groups: [] }, /kind "constructor"/],
    [{ kind: 'toString' }, /kind "toString"/],
    [{ ...base, relations: [{ from: 'User', to: 'Model', kind: 'constructor' }] }, /kind : inheritance/],
    [{ ...base, relations: [{ from: 'User', to: 'Model', kind: 'valueOf' }] }, /kind : inheritance/],
    [{ ...base, classes: [{ name: 'A', attributes: [null] }], relations: [], groups: {} }, /attributes\[0\] : objet attendu/],
    [{ ...base, relations: [null] }, /relations\[0\] : objet attendu/],
    [{ ...base, groups: { Vide: [] } }, /groupe vide/],
    [{ ...base, groups: { '': ['User'] } }, /nom de groupe/],
    [null, /objet attendu/],
  ];
  for (const [m, re] of bad) assert.throws(() => toGraph(m), re);
});

test('enum avec methodes : les methodes gardent leur compartiment', () => {
  const g = toGraph({ kind: 'class', classes: [{ name: 'E', stereotype: 'enum', attributes: [{ name: 'X' }], methods: [{ name: 'label', returns: 'string' }] }] });
  assert.deepEqual(g.nodes[0].compartments, [['X'], ['label() : string']]);
});

test('auto-composition : boucle a la main, losange sur un segment assez long, controles verts', async () => {
  const g = toGraph({ kind: 'class', classes: [{ name: 'Node', attributes: [{ name: 'v', type: 'int' }] }, { name: 'Tree' }],
    relations: [{ from: 'Node', to: 'Node', kind: 'composition', mult_from: '1', mult_to: '0..*', label: 'enfants' },
      { from: 'Node', to: 'Node', kind: 'association', navigable: true }, { from: 'Tree', to: 'Node', kind: 'aggregation' }] });
  const l = await layoutGraph(g);
  const r = check(g, l);
  assert.ok(r.ok, JSON.stringify(Object.fromEntries(BLOCKING.map((k) => [k, r[k]]))));
  const loop = l.edges.find((e) => e.id === 'e0');
  assert.equal(loop.points.length, 4);
  assert.ok(Math.abs(loop.points[1][0] - loop.points[0][0]) >= 18);
});

test('layout de reference valide, etiquettes et sens d\'origine conserves', () => {
  const r = check(G, clone(L));
  assert.ok(r.ok, JSON.stringify(r).slice(0, 400));
  const inh = L.edges.find((e) => e.from === 'User' && e.to === 'Model');
  const u = L.nodes.User, m = L.nodes.Model;
  // remis dans le sens du modele : depart sur User (enfant, en dessous), arrivee sur Model
  assert.ok(Math.abs(inh.points[0][1] - u.y) < 0.5 && Math.abs(inh.points.at(-1)[1] - (m.y + m.h)) < 0.5);
  const lbl = L.edges.find((e) => e.from === 'User' && e.to === 'Inspection').labels;
  assert.deepEqual(lbl.map((l) => l.pos).sort(), ['end', 'mid', 'start']);
});

// [mutation, controle qui DOIT la detecter]
const M = {
  'noeud pose sur un autre': [(l) => { Object.assign(l.nodes.Photo, { x: l.nodes.Subject.x, y: l.nodes.Subject.y }); }, 'overlapNodes'],
  'noeud sorti de son groupe': [(l) => { l.nodes.Photo.x = l.groups.Domaine.x + l.groups.Domaine.w + 5; }, 'nodeOutsideGroup'],
  'noeud sans groupe dans un cadre': [(l) => { Object.assign(l.nodes.ReportService, { x: l.groups.Domaine.x + 2, y: l.groups.Domaine.y + l.groups.Domaine.h - 70 }); }, 'nodeOutsideGroup'],
  'cadres superposes': [(l) => { l.groups.Autre = { ...l.groups.Domaine, label: null }; }, 'overlapGroups'],
  'lien qui traverse un noeud': [(l) => { const e = l.edges.find((x) => x.from === 'Subject' && x.to === 'Photo'); const r = l.nodes.Status; e.points.splice(1, 0, [r.x + r.w / 2, e.points[0][1]], [r.x + r.w / 2, e.points.at(-1)[1]]); }, 'edgeThroughNode'],
  'deux liens confondus': [(l) => { const [a, b] = l.edges; b.points = [...a.points.map((p) => [...p])]; }, 'sharedSegments'],
  'etiquette sur un noeud': [(l) => { const lb = l.edges.find((e) => e.labels.length).labels[0]; Object.assign(lb, { x: l.nodes.User.x + 5, y: l.nodes.User.y + 5 }); }, 'labelHidden'],
  'etiquette sur le titre d\'un cadre': [(l) => { const lb = l.edges.find((e) => e.labels.length).labels[0]; Object.assign(lb, { x: l.groups.Domaine.label.x, y: l.groups.Domaine.label.y }); }, 'labelHidden'],
  'losange plus long que son segment': [(l) => { const e = l.edges.find((x) => x.start === 'diamond'); const [a, b] = e.points; const d = Math.sign(b[0] - a[0]) || 0, v = Math.sign(b[1] - a[1]) || 0; e.points.splice(1, 0, [a[0] + 6 * d, a[1] + 6 * v], [a[0] + 6 * d + 6 * v, a[1] + 6 * v + 6 * d]); }, 'markerFit'],
  'etiquette sous un marqueur': [(l) => { const e = l.edges.find((x) => x.end === 'triangle'); const p = e.points.at(-1); l.edges.find((x) => x.labels.length).labels[0] = { ...l.edges.find((x) => x.labels.length).labels[0], x: p[0] - 3, y: p[1] + 2 }; }, 'markerFit'],
  'depart hors du bord': [(l) => { l.edges[0].points[0][0] += 3; l.edges[0].points[0][1] += 3; }, 'wrongAnchor'],
  'arrivee sur le mauvais noeud': [(l) => { l.edges[0].to = 'Photo'; }, 'wrongAnchor'],
  'trace hors du dessin': [(l) => { l.edges[0].points.push([l.width + 50, l.edges[0].points.at(-1)[1]]); }, 'outOfBounds'],
  'lien supprime': [(l) => { l.edges.pop(); }, 'incomplete'],
  'etiquette retiree': [(l) => { for (const e of l.edges) e.labels = []; }, 'incomplete'],
};
for (const [name, [mut, key]] of Object.entries(M)) {
  test(`mutation detectee : ${name} -> ${key}`, () => {
    const l = clone(L);
    mut(l);
    const r = check(G, l);
    assert.ok(r[key].length > 0, `${key} vide ; ${JSON.stringify(Object.fromEntries(BLOCKING.map((k) => [k, r[k].length])))}`);
    assert.equal(r.ok, false);
  });
}
test('chaque controle bloquant a au moins une mutation', () => {
  const covered = new Set(Object.values(M).map(([, k]) => k));
  for (const k of BLOCKING) assert.ok(covered.has(k), k);
});

test('SVG : un groupe par noeud et par lien, marqueurs UML, textes echappes', () => {
  const svg = renderSvg(G, L);
  assert.equal((svg.match(/class="node"/g) ?? []).length, 8);
  assert.equal((svg.match(/class="rel/g) ?? []).length, 9);
  assert.equal((svg.match(/class="mk-hollow"/g) ?? []).length, 5); // 4 triangles + 1 losange creux
  assert.equal((svg.match(/class="mk-fill"/g) ?? []).length, 1);   // losange plein
  assert.equal((svg.match(/class="rel dashed"/g) ?? []).length, 2);
  const m = loadModel('class.model.json');
  m.classes[0].name = '<script>x</script>';
  m.relations = [];
  m.groups = {};
  const g2 = toGraph(m);
  assert.ok(!renderSvg(g2, { ...L, nodes: { [g2.nodes[0].id]: L.nodes.Model }, edges: [], groups: {} }).includes('<script>x'));
});

test('page interactive : CSP par empreinte, aucun script inline non autorise', () => {
  const html = interactivePage(G, L, { title: 'T <b>' });
  assert.match(html, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.ok(!html.includes('unsafe-inline\'; script') && !html.includes('<b>'));
  assert.equal((html.match(/<script>/g) ?? []).length, 1);
});

test('cdc.sh draw : modele invalide = code 2 et rien d\'ecrit ; option fautive = code 1 (die de cdc.sh)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dgm-cli-'));
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ kind: 'class', classes: [] }));
  const r = spawnSync('bash', [CDC, 'draw', '--model', bad, '--out', path.join(dir, 'o'), '--name', 'x'], { encoding: 'utf8' });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /au moins une classe/);
  assert.ok(!fs.existsSync(path.join(dir, 'o', 'x.html')));
  const r2 = spawnSync('bash', [CDC, 'draw', '--model', path.join(FIX, 'class.model.json'), '--out', dir, '--name', 'a b'], { encoding: 'utf8' });
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /--name sans espace/);
  const r3 = spawnSync('bash', [CDC, 'draw', '--name', 'x', '--model'], { encoding: 'utf8' });
  assert.equal(r3.status, 1);
  assert.match(r3.stderr, /--model sans valeur/);
  // modele invalide : le dossier de sortie n'est meme pas cree
  const r4 = spawnSync('bash', [CDC, 'draw', '--model', bad, '--out', path.join(dir, 'neuf', 'sub'), '--name', 'x'], { encoding: 'utf8' });
  assert.equal(r4.status, 2);
  assert.ok(!fs.existsSync(path.join(dir, 'neuf')));
});
