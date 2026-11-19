"""cdc_check.py — verification deterministe d'un CDC rempli (sous-commande verify du skill cdc).

ERREUR (exit 1) :
  structure   titres dans l'ordre de la trame ; fiches annexe A = A.1..A.10 ; en-tetes et separateurs (largeurs)
              des tableaux identiques a la trame (tableaux a colonnes de roles, 5.1 et A.7 : 1re colonne seulement) ;
  references  chaque F de 6.2 a une fiche « # Annexe A — F<n> : Nom », une seule, et inversement ; US / RG / R citent
              des F existantes (« Toutes » / « transverse » = toutes) ; US sans F ; F sans US ; ID en double ; US et
              RG d'une fiche presentes en 6.3 / 6.4 et rattachees a la F de la fiche ;
  tests       si A.9 porte des ID T-F<n>-<k> : ID unique, F du prefixe = F de la fiche, US / RG cites existants,
              chaque US et chaque RG couverte par au moins un T ;
  diagrammes  lien vers <stem>-diagrams/... absent du disque.
AVERT (sans echec) : RG ou R sans F, role d'une US absent de la table 5, nom de fiche different de 6.2, diagramme
  perime (empreinte de sa source changee depuis manifest.json, ecrit par cdc_manifest.py), section hors trame.
INFO : nombre de [À COMPLÉTER] par section.
Usage : python3 cdc_check.py [--json] <cdc.md> <trame.md>
"""
import hashlib
import json
import os
import re
import sys
import unicodedata

FICHE = re.compile(r'^# Annexe A — (F\d+) : (.+?)\s*$')
TRAME_FICHE = '# Annexe A — Fiche technique de fonctionnalité (modèle)'
FID = re.compile(r'\bF\d+\b')
TID = re.compile(r'^T-(F\d+)-\d+$')
PLACE = '[À COMPLÉTER]'
ROLE_COLS = re.compile(r'\[\*\[Rôle \d\]\*\]')  # en-tete de colonne de role dans la trame


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return re.sub(r'\s+', ' ', ''.join(c for c in s if not unicodedata.combining(c))).strip()


def cells(line):
    """Cellules d'une ligne de tableau ; la barre finale est facultative (pandoc l'accepte)."""
    s = line.strip()
    parts = re.split(r'(?<!\\)\|', s)
    return [c.strip() for c in (parts[1:-1] if s.endswith('|') and len(parts) > 1 else parts[1:])]


def first(c):
    return c[0] if c else ''


def parse(text):
    """Blocs : titres (niveau, texte, ligne) et tableaux (cle de section, en-tete, separateur, lignes).
    Section d'un tableau : dernier titre H1/H2 (un ### ajoute dans une section ne la change pas) ; dans une fiche, son A.x."""
    heads, tables = [], []
    lines = text.split('\n')
    fence = None  # ``` ou ~~~ ouvrant le bloc de code en cours
    sec, fiche = '', None
    i = 0
    while i < len(lines):
        l = lines[i]
        m_f = re.match(r'(`{3,}|~{3,})', l)
        if m_f and (fence is None or m_f.group(1)[0] == fence[0]):
            fence = None if fence else m_f.group(1)
        elif not fence and re.match(r'#{1,3} ', l):
            lvl = len(l) - len(l.lstrip('#'))
            title = l[lvl:].strip()
            heads.append((lvl, title, i + 1))
            m = FICHE.match(l)
            if lvl == 1:
                fiche = m.group(1) if m else ('modele' if l.strip() == TRAME_FICHE else None)
            if lvl <= 2 or fiche:
                sec = title
        elif not fence and l.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s|:-]+\|?\s*$', lines[i + 1]):
            rows, j = [], i + 2
            while j < len(lines) and lines[j].startswith('|'):
                rows.append((j + 1, cells(lines[j])))
                j += 1
            tables.append({'sec': sec, 'fiche': fiche, 'head': cells(l), 'sep': lines[i + 1].strip(), 'rows': rows, 'line': i + 1})
            i = j
            continue
        i += 1
    return heads, tables


def main_part(heads):
    """Titres hors fiches annexe A (et hors bloc modele de la trame)."""
    out, skip = [], False
    for lvl, t, n in heads:
        if lvl == 1:
            skip = bool(FICHE.match('# ' + t)) or ('# ' + t) == TRAME_FICHE
        if not skip:
            out.append((lvl, t, n))
    return out


def fiche_heads(heads):
    out, cur = {}, None
    for lvl, t, n in heads:
        if lvl == 1:
            m = FICHE.match('# ' + t)
            cur = m.group(1) if m else ('modele' if ('# ' + t) == TRAME_FICHE else None)
            if cur:
                out[cur] = []
        elif cur and lvl == 3:
            out[cur].append(re.sub(r'\s+', ' ', t))
    return out


class Report:
    def __init__(self):
        self.items = []

    def add(self, level, where, msg):
        self.items.append({'niveau': level, 'ou': where, 'message': msg})

    def errors(self):
        return [x for x in self.items if x['niveau'] == 'ERREUR']


def ids_of(cell):
    return FID.findall(cell)


def clean_id(c):
    """Identifiant d'une cellule ; vide si cellule vide, [À COMPLÉTER] ou consigne seule de la trame."""
    c = c.strip()
    if re.fullmatch(r'\[\*.*\*\]\{custom-style="Consigne"\}', c):
        return ''
    c = c.strip('*').strip()
    return '' if c in ('', PLACE) else c


def check_structure(rep, cdc_heads, trame_heads, cdc_tables, trame_tables):
    want = [(lvl, norm(t)) for lvl, t, _ in main_part(trame_heads)]
    got = main_part(cdc_heads)
    got_n = [(lvl, norm(t)) for lvl, t, _ in got]
    for h in want:
        if h not in got_n:
            rep.add('ERREUR', 'structure', f"titre absent : {'#' * h[0]} {h[1]}")
    order = [h for h in got_n if h in want]
    expected = [h for h in want if h in got_n]
    if order != expected:
        for a, b in zip(order, expected):
            if a != b:
                rep.add('ERREUR', 'structure', f"ordre des titres : « {a[1]} » trouve ou « {b[1]} » est attendu")
                break
    for (lvl, t, n), key in zip(got, got_n):
        if key not in want:
            rep.add('AVERT', 'structure', f"ligne {n} : section hors trame « {t} »")
    tf = fiche_heads(trame_heads).get('modele', [])
    for f, hs in fiche_heads(cdc_heads).items():
        if [norm(h) for h in hs] != [norm(h) for h in tf]:
            rep.add('ERREUR', f'fiche {f}', f"sous-titres {hs} au lieu de A.1 a A.10 de la trame")
    # Tableaux : par section (et pour les fiches, par sous-titre A.x de la fiche modele).
    ref = {}
    for t in trame_tables:
        key = ('A', norm(t['sec'])) if t['fiche'] == 'modele' else ('M', norm(t['sec']))
        ref.setdefault(key, []).append(t)
    seen = {}
    for t in cdc_tables:
        key = ('A', norm(t['sec'])) if t['fiche'] and t['fiche'] != 'modele' else ('M', norm(t['sec']))
        k2 = (key, t['fiche'])
        idx = seen.get(k2, 0)
        seen[k2] = idx + 1
        model = ref.get(key, [])
        if idx >= len(model):
            continue  # tableau ajoute dans une section : le lint et la contre-lecture en jugent
        m = model[idx]
        where = f"ligne {t['line']} ({t['sec']}{', ' + t['fiche'] if t['fiche'] else ''})"
        if any(ROLE_COLS.search(c) for c in m['head']):
            if norm(first(t['head'])) != norm(first(m['head'])):
                rep.add('ERREUR', 'structure', f"{where} : 1re colonne « {first(t['head'])} » au lieu de « {first(m['head'])} »")
            continue
        if [norm(c) for c in t['head']] != [norm(c) for c in m['head']]:
            rep.add('ERREUR', 'structure', f"{where} : en-tete {t['head']} au lieu de {m['head']}")
        elif t['sep'] != m['sep']:
            rep.add('ERREUR', 'structure', f"{where} : separateur modifie (largeurs du modele perdues)")


def table(tables, sec_prefix, fiche=None):
    return [t for t in tables if norm(t['sec']).startswith(norm(sec_prefix)) and t['fiche'] == fiche]


def check_refs(rep, heads, tables):
    feats = {}
    for t in table(tables, '6.2 '):
        for n, c in t['rows']:
            fid = clean_id(c[0]) if c else ''
            if fid and re.fullmatch(r'F\d+', fid):
                if fid in feats:
                    rep.add('ERREUR', '6.2', f'ligne {n} : {fid} en double')
                feats[fid] = c[1] if len(c) > 1 else ''
    fiches = {}
    for lvl, t, n in heads:
        m = FICHE.match('# ' + t) if lvl == 1 else None
        if m:
            if m.group(1) in fiches:
                rep.add('ERREUR', 'annexe A', f'ligne {n} : fiche {m.group(1)} en double (aussi ligne {fiches[m.group(1)][1]})')
            fiches.setdefault(m.group(1), (m.group(2), n))
    for f in feats:
        if f not in fiches:
            rep.add('ERREUR', 'annexe A', f'{f} de 6.2 sans fiche « # Annexe A — {f} : ... »')
        elif norm(fiches[f][0]) != norm(feats[f]):
            rep.add('AVERT', 'annexe A', f"ligne {fiches[f][1]} : fiche {f} « {fiches[f][0]} » vs 6.2 « {feats[f]} »")
    for f, (_, n) in fiches.items():
        if f not in feats:
            rep.add('ERREUR', 'annexe A', f'ligne {n} : fiche {f} absente de 6.2')

    roles = []
    for t in table(tables, '5. acteurs'):
        roles += [norm(re.sub(r'\(.*?\)', '', c[0])) for _, c in t['rows'] if c and clean_id(c[0])]

    # strict : une US sans F est une ERREUR (« jamais d'US sans F ») ; RG et R sans F : AVERT (regle transverse, ou
    # [À COMPLÉTER] pose par verify faute de source). « Toutes » / « transverse » = toutes les F.
    def registry(sec, fcol, label, strict):
        reg, where = {}, sec.strip()
        for t in table(tables, sec):
            for n, c in t['rows']:
                rid = clean_id(first(c))
                if not rid:
                    continue
                if rid in reg:
                    rep.add('ERREUR', where, f'ligne {n} : {rid} en double')
                cell = c[fcol] if len(c) > fcol else ''
                fs = ids_of(cell)
                if not fs and re.search(r'\b(toutes|transverse)\b', norm(cell)):
                    fs = list(feats)
                if not fs:
                    rep.add('ERREUR' if strict else 'AVERT', where, f'ligne {n} : {label} {rid} sans fonctionnalite')
                for f in fs:
                    if f not in feats:
                        rep.add('ERREUR', where, f'ligne {n} : {rid} cite {f}, absente de 6.2')
                reg[rid] = {'f': fs, 'line': n, 'text': c[1] if len(c) > 1 else ''}
        return reg

    us = registry('6.3 ', 2, 'US', True)
    rg = registry('6.4 ', 2, 'regle', False)
    registry('12. ', 3, 'scenario', False)
    for f in feats:
        if not any(f in u['f'] for u in us.values()):
            rep.add('ERREUR', '6.3', f'{f} sans user story')
    for rid, u in us.items():
        m = re.search(r"en tant qu[e']\s*(?:un |une |l'|le |la )?(.+?)(?:,|\s+je\s|$)", u['text'], re.I)
        if m and roles:
            r = norm(m.group(1))
            if not any(r == x or r.startswith(x) or x.startswith(r) for x in roles):
                rep.add('AVERT', '6.3', f"ligne {u['line']} : role « {m.group(1).strip()} » de {rid} absent de la table 5")

    for f in fiches:
        for t in table(tables, 'A.2 ', f):
            for n, c in t['rows']:
                rid = clean_id(c[0]) if c else ''
                if not re.fullmatch(r'US-\d+', rid):
                    continue  # numerotation locale a la fiche : admise par la trame
                if rid not in us:
                    rep.add('ERREUR', f'fiche {f}', f'ligne {n} : {rid} absente de 6.3')
                elif f not in us[rid]['f']:
                    rep.add('ERREUR', f'fiche {f}', f'ligne {n} : {rid} rattachee a {us[rid]["f"]} en 6.3, pas a {f}')
        for t in table(tables, 'A.3 ', f):
            for n, c in t['rows']:
                rid = clean_id(c[0]) if c else ''
                if not re.fullmatch(r'RG-\d+', rid):
                    continue
                if rid not in rg:
                    rep.add('ERREUR', f'fiche {f}', f'ligne {n} : {rid} absente de 6.4')
                elif f not in rg[rid]['f']:
                    rep.add('ERREUR', f'fiche {f}', f'ligne {n} : {rid} rattachee a {rg[rid]["f"]} en 6.4, pas a {f}')
    check_tests(rep, fiches, tables, us, rg)


def check_tests(rep, fiches, tables, us, rg):
    tids, cover = {}, set()
    for f in fiches:
        for t in table(tables, 'A.9 ', f):
            for n, c in t['rows']:
                tid = clean_id(c[0]) if c else ''
                m = TID.match(tid)
                if not m:
                    continue
                if tid in tids:
                    rep.add('ERREUR', 'tests', f'ligne {n} : {tid} en double')
                tids[tid] = n
                if m.group(1) != f:
                    rep.add('ERREUR', 'tests', f'ligne {n} : {tid} dans la fiche {f}')
                for ref in re.findall(r'\b(?:US|RG)-\d+\b', ' '.join(c[1:])):
                    if ref not in us and ref not in rg:
                        rep.add('ERREUR', 'tests', f'ligne {n} : {tid} cite {ref}, inexistante')
                    cover.add(ref)
    if not tids:
        return
    for rid in list(us) + list(rg):
        if rid not in cover:
            rep.add('ERREUR', 'tests', f'{rid} couverte par aucun test T-...')


def check_diagrams(rep, path, text):
    d = os.path.dirname(os.path.abspath(path))
    stem = os.path.splitext(os.path.basename(path))[0]
    # lien Markdown, cible eventuellement entre <...> et suivie d'un titre "..." ; ./ en tete admis
    for m in re.finditer(r'\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)', text):
        target = re.sub(r'^\./', '', m.group(1))
        if target.startswith(stem + '-diagrams/') and not os.path.exists(os.path.join(d, target)):
            line = text.count('\n', 0, m.start()) + 1
            rep.add('ERREUR', 'diagrammes', f'ligne {line} : {target} introuvable')
    man = os.path.join(d, stem + '-diagrams', 'manifest.json')
    if not os.path.exists(man):
        return
    try:
        data = json.load(open(man, encoding='utf-8'))
        entries = data.get('diagrams', []) if isinstance(data, dict) else None
        if not isinstance(entries, list) or not all(isinstance(e, dict) for e in entries):
            raise ValueError('objet {"diagrams": [{...}]} attendu')
    except ValueError as e:
        rep.add('ERREUR', 'diagrammes', f'manifest.json illisible : {e}')
        return
    for e in entries:
        src = e.get('source')
        if not src or not e.get('sha256'):
            continue
        sp = src if os.path.isabs(src) else os.path.join(d, src)
        if not os.path.exists(sp):
            rep.add('AVERT', 'diagrammes', f"{e.get('name')} : source {src} introuvable (diagramme non verifiable)")
        elif hashlib.sha256(open(sp, 'rb').read()).hexdigest() != e['sha256']:
            rep.add('AVERT', 'diagrammes', f"{e.get('name')} : source modifiee depuis le dessin, diagramme perime")


def placeholders(rep, heads, text):
    lines = text.split('\n')
    marks = [(n, t) for lvl, t, n in heads if lvl <= 2] + [(len(lines) + 1, '')]
    for (n, t), (n2, _) in zip(marks, marks[1:]):
        k = sum(l.count(PLACE) for l in lines[n - 1:n2 - 1])
        if k:
            rep.add('INFO', t, f'{k} {PLACE}')


def run(path, trame):
    text = open(path, encoding='utf-8').read()
    ttext = open(trame, encoding='utf-8').read()
    rep = Report()
    heads, tables = parse(text)
    theads, ttables = parse(ttext)
    check_structure(rep, heads, theads, tables, ttables)
    check_refs(rep, heads, tables)
    check_diagrams(rep, path, text)
    placeholders(rep, heads, text)
    return rep


def main(argv):
    as_json = '--json' in argv
    args = [a for a in argv if a != '--json']
    if len(args) != 2:
        sys.exit(__doc__)
    rep = run(*args)
    if as_json:
        print(json.dumps(rep.items, ensure_ascii=False, indent=2))
    else:
        for x in rep.items:
            print(f"{x['niveau']:6} [{x['ou']}] {x['message']}")
        n = {k: sum(1 for x in rep.items if x['niveau'] == k) for k in ('ERREUR', 'AVERT', 'INFO')}
        print(f"cdc_check: {n['ERREUR']} erreur(s), {n['AVERT']} avertissement(s), "
              f"{sum(int(x['message'].split()[0]) for x in rep.items if x['niveau'] == 'INFO')} {PLACE}")
    sys.exit(1 if rep.errors() else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
