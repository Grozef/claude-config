// Modeles de diagramme (hors BDD) -> graphe generique : noeuds a compartiments, aretes typees, groupes.
// Un kind = un validateur + un adaptateur. Toute erreur de modele est un refus lisible (jamais un dessin faux).
//
// Graphe : { kind, title, direction, nodes: [{ id, title, stereotype, shape, compartments: [[texte]], group }],
//            edges: [{ id, from, to, start, end, dashed, reverse, labels: { start, mid, end } }], groups: [nom] }
// Marqueurs : none | arrow (pleine) | open (ouverte) | triangle (creux, generalisation) | diamond (plein) | odiamond (creux)

const VIS = new Set(['+', '-', '#', '~']);
export const MARKERS = ['none', 'arrow', 'open', 'triangle', 'diamond', 'odiamond'];

function fail(msg) { throw new Error('modele invalide : ' + msg); }
const ctrl = /[\u0000-\u001f\u007f]/;
// tout texte du modele : non vide, sans caractere de controle (mesure puis aplati par le SVG sinon)
const str = (v, where) => {
  if (typeof v !== 'string' || !v.trim()) fail(`${where} : texte non vide attendu`);
  if (ctrl.test(v)) fail(`${where} : caractere de controle`);
  return v;
};
const optStr = (v, where) => (v === undefined || v === null ? '' : str(v, where));
const arr = (v, where) => { if (v === undefined) return []; if (!Array.isArray(v)) fail(`${where} : liste attendue`); return v; };
const obj = (v, where) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${where} : objet attendu`); return v; };
// table de correspondance lue par une cle venue du modele : propres seulement (« constructor », « toString »... refuses)
const own = (table, key) => (typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined);

function groupsOf(model, ids) {
  const g = model.groups ?? {};
  if (typeof g !== 'object' || Array.isArray(g)) fail('groups : objet {"Groupe": [ids]} attendu');
  const of = Object.create(null);
  for (const [name, members] of Object.entries(g)) {
    str(name, 'groups : nom de groupe');
    if (!arr(members, `groups.${name}`).length) fail(`groups.${name} : groupe vide`);
    for (const m of members) {
      if (!ids.has(m)) fail(`groups.${name} : "${m}" inconnu`);
      if (of[m]) fail(`"${m}" dans deux groupes (${of[m]}, ${name})`);
      of[m] = name;
    }
  }
  return of;
}

function uniqueIds(list, key, where) {
  const ids = new Set();
  for (const [i, x] of list.entries()) {
    const id = str(obj(x, `${where}[${i}]`)[key], `${where}[${i}].${key}`);
    if (ids.has(id)) fail(`${where} : "${id}" en double`);
    ids.add(id);
  }
  return ids;
}

// ---- class : classes, attributs, methodes ; generalisation, realisation, composition, agregation, association, dependance
const CLASS_REL = {
  // from = enfant, to = parent : triangle cote parent ; placement inverse (parent au-dessus)
  inheritance: { end: 'triangle', reverse: true },
  realization: { end: 'triangle', dashed: true, reverse: true },
  // from = tout, to = partie : losange cote tout
  composition: { start: 'diamond' },
  aggregation: { start: 'odiamond' },
  association: {},
  dependency: { end: 'open', dashed: true },
};

function classGraph(m) {
  const classes = arr(m.classes, 'classes');
  if (!classes.length) fail('classes : au moins une classe');
  const ids = uniqueIds(classes, 'name', 'classes');
  const groupOf = groupsOf(m, ids);
  const vis = (v, where) => { if (v === undefined) return ''; if (!VIS.has(v)) fail(`${where} : visibilite + - # ~ attendue`); return v + ' '; };
  const nodes = classes.map((c, i) => {
    const w = `classes[${i}]`;
    const attrs = arr(c.attributes, w + '.attributes').map((a, j) => (obj(a, `${w}.attributes[${j}]`),
      vis(a.visibility, `${w}.attributes[${j}]`) + str(a.name, `${w}.attributes[${j}].name`) + (a.type ? ' : ' + str(a.type, `${w}.attributes[${j}].type`) : '')));
    const meths = arr(c.methods, w + '.methods').map((x, j) => (obj(x, `${w}.methods[${j}]`),
      vis(x.visibility, `${w}.methods[${j}]`) + str(x.name, `${w}.methods[${j}].name`) + '(' + optStr(x.params, `${w}.methods[${j}].params`) + ')'
      + (x.returns ? ' : ' + str(x.returns, `${w}.methods[${j}].returns`) : '')));
    const st = optStr(c.stereotype, w + '.stereotype');
    // enum : valeurs seules ; ses methodes, s'il en a, gardent leur compartiment (rien n'est perdu)
    return { id: c.name, title: c.name, stereotype: st ? '«' + st + '»' : '', shape: 'card',
      compartments: st === 'enum' && !meths.length ? [attrs] : [attrs, meths], group: groupOf[c.name] ?? null };
  });
  const edges = arr(m.relations, 'relations').map((r, i) => {
    const w = `relations[${i}]`;
    obj(r, w);
    for (const k of ['from', 'to']) if (!ids.has(str(r[k], `${w}.${k}`))) fail(`${w}.${k} : classe "${r[k]}" inconnue`);
    const t = own(CLASS_REL, r.kind);
    if (!t) fail(`${w}.kind : ${Object.keys(CLASS_REL).join(' | ')} attendu`);
    const end = r.kind === 'association' && r.navigable ? 'open' : t.end ?? 'none';
    return { id: 'e' + i, from: r.from, to: r.to, start: t.start ?? 'none', end, dashed: !!t.dashed, reverse: !!t.reverse,
      labels: { start: optStr(r.mult_from, w + '.mult_from'), mid: optStr(r.label, w + '.label'), end: optStr(r.mult_to, w + '.mult_to') } };
  });
  return { nodes, edges, direction: 'DOWN' };
}

const KINDS = { class: classGraph };
export const KIND_NAMES = Object.keys(KINDS);

export function toGraph(model) {
  obj(model, 'racine');
  const build = own(KINDS, model.kind);
  if (!build) fail(`kind "${model.kind}" : ${KIND_NAMES.join(' | ')} attendu`);
  const g = build(model);
  return { kind: model.kind, title: optStr(model.title, 'title'), groups: Object.keys(model.groups ?? {}), ...g };
}
