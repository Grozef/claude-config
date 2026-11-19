"""cdc_fiches.py — génère les fiches annexe A d'un CDC (une par fonctionnalité) depuis la trame.
Remplace, dans <f.md>, le bloc « Annexe A — Fiche technique de fonctionnalité (modèle) »
(saut de page compris, jusqu'au titre H1 suivant ; refus si le bloc a été modifié) par une copie par F : titre « # Annexe A — F<n> : <Nom> »,
consigne de tête retirée, cellule Fonctionnalité posée, séparateurs (largeurs) et autres
consignes conservés pour le remplissage.
--append : CDC dont les fiches existent déjà ; les nouvelles F sont ajoutées après la dernière fiche (F déjà présente = refus).
Usage : python3 cdc_fiches.py <trame.md> <f.md> [--append] "F1=Nom" "F2=Nom" ...
"""
import io
import re
import sys

HEAD = '# Annexe A — Fiche technique de fonctionnalité (modèle)'
BREAK = '```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n\n'


def template_block(trame):
    t = io.open(trame, encoding='utf-8').read()
    i = t.index(HEAD)
    return t[i:].rstrip('\n') + '\n'


def fiche(block, fid, name):
    lines = block.split('\n')
    lines[0] = '# Annexe A — %s : %s' % (fid, name)
    out = []
    for i, l in enumerate(lines):
        # consigne de tête : la 1re ligne Consigne qui suit le titre
        if i <= 3 and l.startswith('[*Copier cette annexe'):
            continue
        if l.startswith('| Fonctionnalité |'):
            l = '| Fonctionnalité | %s — %s |' % (fid, name)
        out.append(l)
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(out))


def append(block, md, text, specs):
    """--append : fiches ajoutées après la dernière fiche existante (bloc modèle déjà consommé)."""
    have = re.findall(r'^# Annexe A — (F\d+) :', text, re.M)
    if not have:
        sys.exit('cdc_fiches: --append sans fiche existante dans %s (utiliser la génération normale)' % md)
    # Fin de la dernière fiche : titre H1 suivant HORS bloc de code qui n'est pas une fiche, avec le saut de page
    # qui le précède ; sinon fin du fichier. Un « # commentaire » dans un bloc ```bash n'est pas un titre.
    lines = text.split('\n')
    fence, last, end_line = None, None, None
    for k, l in enumerate(lines):
        f = re.match(r'(`{3,}|~{3,})', l)
        if f and (fence is None or f.group(1)[0] == fence[0]):
            fence = None if fence else f.group(1)
            continue
        if fence or not l.startswith('# '):
            continue
        if re.match(r'# Annexe A — F\d+ :', l):
            last, end_line = k, None
        elif last is not None and end_line is None:
            end_line = k
    if end_line is None:
        end = len(text)
    else:
        k = end_line
        if k >= 4 and lines[k - 1] == '' and lines[k - 2] == '```' and lines[k - 4] == '```{=openxml}':
            k -= 4
        end = len('\n'.join(lines[:k])) + 1
    parts, seen = [], set(have)
    for s in specs:
        fid, sep, name = s.partition('=')
        if not sep or not re.fullmatch(r'F\d+', fid) or not name.strip() or '|' in name or fid in seen:
            sys.exit('cdc_fiches: argument invalide ou fiche déjà présente « %s », rien écrit' % s)
        seen.add(fid)
        parts.append(BREAK + fiche(block, fid, name.strip()))
    new = text[:end].rstrip('\n') + '\n\n' + '\n'.join(parts)
    if text[end:].strip():
        new = new.rstrip('\n') + '\n\n' + text[end:].lstrip('\n')
    io.open(md, 'w', encoding='utf-8', newline='\n').write(new.rstrip('\n') + '\n')
    print('cdc_fiches: %d fiche(s) annexe A ajoutée(s) dans %s' % (len(specs), md))


def main(trame, md, specs, mode='replace'):
    block = template_block(trame)
    text = io.open(md, encoding='utf-8').read()
    if mode == 'append':
        return append(block, md, text, specs)
    if HEAD not in text:
        sys.exit('cdc_fiches: bloc « %s » absent de %s (fiches déjà générées ? --append pour en ajouter)' % (HEAD, md))
    i = text.index(HEAD)
    j = text.rfind(BREAK, 0, i)
    cut = j if j != -1 and text[j + len(BREAK):i].strip() == '' else i
    # Fin du bloc : titre H1 suivant (saut de page qui le précède compris), sinon fin du fichier.
    m = re.search(r'\n(?:```\{=openxml\}\n[^\n]*\n```\n\n)?# ', text[i + 1:])
    end = i + 1 + m.start() + 1 if m else len(text)
    if text[i:end].strip() != block.strip():
        sys.exit('cdc_fiches: le bloc modèle de %s a été modifié, rien écrit (contenu perdu sinon)' % md)
    parts, seen = [], set()
    for s in specs:
        fid, sep, name = s.partition('=')
        if not sep or not re.fullmatch(r'F\d+', fid) or not name.strip() or '|' in name or fid in seen:
            sys.exit('cdc_fiches: argument invalide « %s » (attendu F<n>=Nom, F unique, sans |)' % s)
        seen.add(fid)
        parts.append(BREAK + fiche(block, fid, name.strip()))
    new = text[:cut].rstrip('\n') + '\n\n' + '\n'.join(parts)
    if text[end:].strip():
        new = new.rstrip('\n') + '\n\n' + text[end:].lstrip('\n')
    io.open(md, 'w', encoding='utf-8', newline='\n').write(new.rstrip('\n') + '\n')
    print('cdc_fiches: %d fiche(s) annexe A générée(s) dans %s' % (len(specs), md))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--append']
    if len(args) < 3:
        sys.exit(__doc__)
    main(args[0], args[1], args[2:], 'append' if '--append' in sys.argv else 'replace')
