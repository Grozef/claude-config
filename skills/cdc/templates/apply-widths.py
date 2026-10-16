# Reporte les largeurs de colonnes du modele Word (gridCol) dans les lignes de separation
# des tableaux markdown : pandoc en tire les largeurs relatives (avec --columns=1).
# Usage : python3 apply-widths.py <Modele_CDC.docx | document.xml> <f.md>
# Tableau reconnu par son en-tete ; matrice par role (1re cellule Activite / Action) :
# 1re colonne du modele, le reste reparti egal.
import re, sys, io, zipfile

doc, md = sys.argv[1], sys.argv[2]
if doc.lower().endswith('.docx'):
    x = zipfile.ZipFile(doc).read('word/document.xml').decode('utf-8')
else:
    x = io.open(doc, encoding='utf-8').read()
spec = []  # (cellules d'en-tete, largeurs)
for t in re.findall(r'<w:tbl>.*?</w:tbl>', x, re.S):
    g = [int(v) for v in re.findall(r'<w:gridCol w:w="(\d+)"', t)]
    row = re.search(r'<w:tr>.*?</w:tr>', t, re.S).group(0)
    cells = [''.join(re.findall(r'<w:t[^>]*>([^<]*)', c)).replace('&apos;', "'")
             for c in re.findall(r'<w:tc>.*?</w:tc>', row, re.S)]
    spec.append((cells, g))

STRIP = str.maketrans('', '', '*[]\\')


def norm(s):
    return s.translate(STRIP).strip().lower()


by_header, by_first = {}, {}
for cells, g in spec:
    by_header.setdefault(tuple(norm(c) for c in cells), g)
    by_first.setdefault(norm(cells[0]), g)


def sep(widths):
    tot = sum(widths)
    return '|' + '|'.join('-' * max(3, round(w * 100 / tot)) for w in widths) + '|'


lines = io.open(md, encoding='utf-8').read().split('\n')
done, miss = 0, []
for i in range(1, len(lines)):
    if re.fullmatch(r'\|(\s*:?-+:?\s*\|)+', lines[i]) and lines[i - 1].startswith('|'):
        head = [norm(c) for c in lines[i - 1].strip().strip('|').split('|')]
        n = len(head)
        g = by_header.get(tuple(head))
        if g is None and head[0] in by_first:
            g0 = by_first[head[0]]
            if len(g0) == n:
                g = g0
            elif head[0] in ('activité', 'action') and n >= 2:
                # matrices par role : 1re colonne du modele, le reste reparti egal
                rest = (sum(g0) - g0[0]) / (n - 1)
                g = [g0[0]] + [rest] * (n - 1)
        if g is None or len(g) != n:
            miss.append((i + 1, lines[i - 1][:70]))
            continue
        lines[i] = sep(g)
        done += 1
io.open(md, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('separateurs reecrits:', done)
for m in miss:
    print('SANS LARGEUR l.%d : %s' % m)
