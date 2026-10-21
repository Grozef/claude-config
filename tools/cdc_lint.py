"""cdc_lint.py — gate du skill cdc, BLOQUANT (exit 1) sur :
  1. vocabulaire de dette / audit / WIP (garde-fou 4) ;
  2. référence de source dans le texte (chemin de fichier, Classe::méthode) : le CDC est remis au
     client, qui ne peut pas les vérifier (décision du 2026-10-21) ; la traçabilité reste dans la
     contre-lecture du skill (Étape 3ter) ;
  3. consigne du modèle restée dans un CDC rempli.
Un squelette `fill` (title: resté « [Nom du projet] ») n'est pas bloqué sur les consignes.
Une ligne justifiée comme faux positif porte le commentaire <!-- lint-ok -->.
Usage : python3 cdc_lint.py <f.md>
"""
import re
import sys

DEBT = re.compile(
    r'dette technique|technical debt|\bTODO\b(?!\.md)|\bFIXME\b|\bXXX\b|\bHACK\b|\bWIP\b'
    r'|en cours de d[ée]v|work in progress|[àa] refactor|[àa] corriger|faille|vuln[ée]rab'
    r'|\bCVE\b|known bug|deprecated|code obsol[èe]te|obsolete code|code mort'
    r'|dead code|workaround|contournement|(?<!non-)r[ée]gression|\bplante\b|ne fonctionne pas'
    r'|\bcass(?:é|ée|és|ées)\b|broken', re.I)  # « casse » (des lettres) n'est pas « cassé » ;
# « bug » et « crash » sont exclus : vocabulaire d'exigence (signalement de bug, rapports de crash).
EXT = (r'(?:md|php|tsx|ts|vue|jsx|js|mjs|cjs|yml|yaml|json|csv|py|sh|docx|xlsx|html|png|conf'
       r'|sql|dart|xml|kt|java|gradle)')
PATH = re.compile(r'(?<![\w/.@-])((?:~|[A-Za-z]:)?[\w.~-]*(?:/[\w.@-]+)*\.' + EXT + r')(?![\w/])')
# Nom nu en .js commençant par une majuscule (Vue.js, Node.js, Chart.js) : une technologie.
TECH_JS = re.compile(r'^[A-Z][\w-]*\.js$')
CLASSREF = re.compile(r'\b([A-Z][A-Za-z0-9]+)::[A-Za-z_]\w*')
# « <libellé> » hors backticks : pandoc le lit comme une balise HTML et l'efface du rendu.
EATEN = re.compile(r'<[A-Za-zÀ-ÿ][\wÀ-ÿ-]*>')


def main(md):
    text = open(md, encoding='utf-8').read()
    lines = text.split('\n')
    fill = re.search(r'^title:\s*"?\[Nom du projet\]"?\s*$', text, re.M) is not None

    debt, cited, eaten, consignes, placeholders = [], [], [], 0, 0
    in_comment, in_code = False, False
    for n, line in enumerate(lines, 1):
        if line.startswith('```'):
            in_code = not in_code
            continue
        if in_code:
            continue
        if in_comment:
            if '-->' in line:
                in_comment = False
            continue
        if line.lstrip().startswith('<!--') and '-->' not in line:
            in_comment = True
            continue
        if '<!-- lint-ok -->' in line:
            continue
        body = re.sub(r'<!--.*?-->', '', line)
        placeholders += body.count('[À COMPLÉTER]')
        if 'custom-style="Consigne"' in body:
            consignes += 1
        if DEBT.search(body):
            debt.append((n, line.strip()[:160]))
        for tag in EATEN.findall(re.sub(r'`[^`]*`', '', body)):
            eaten.append((n, tag))
        # Cibles de liens et d'images Markdown hors analyse : ce sont les diagrammes du CDC
        # (`![Titre](<stem>-diagrams/x.png)`, Étape 3bis du skill), pas des sources.
        for tok in PATH.findall(re.sub(r'\]\([^)]*\)', ']()', body)):
            if tok.startswith(('http', 'www.')) or TECH_JS.match(tok):
                continue
            cited.append((n, tok))
        for cls in CLASSREF.findall(body):
            cited.append((n, cls + '::'))

    fail = False
    if debt:
        fail = True
        print('/!\\ LINT garde-fou 4 — vocabulaire de dette/audit/WIP (corriger, ou <!-- lint-ok --> si faux positif) :')
        for n, l in debt:
            print('  l.%d : %s' % (n, l))
    else:
        print('[OK] lint: aucune mention de dette/audit/WIP')
    if cited:
        fail = True
        print('/!\\ LINT garde-fou 2 — référence de source dans un CDC remis au client (la retirer, '
              'ou <!-- lint-ok --> si le nom fait partie de l\'exigence) :')
        for n, t in cited:
            print('  l.%d : %s' % (n, t))
    else:
        print('[OK] lint: aucune référence de source dans le texte')
    if eaten:
        fail = True
        print('/!\\ LINT — texte entre chevrons hors backticks, effacé au rendu (écrire [mot] ou `<mot>`) :')
        for n, t in eaten:
            print('  l.%d : %s' % (n, t))
    if consignes and not fill:
        fail = True
        print('/!\\ LINT — %d ligne(s) portent encore une consigne du modèle (custom-style="Consigne")' % consignes)
    else:
        print('lint: %d consigne(s) du modèle restante(s)%s' % (consignes, ' (squelette fill)' if fill else ''))
    print('lint: %d [À COMPLÉTER]' % placeholders)
    return 1 if fail else 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: cdc_lint.py <f.md>')
    sys.exit(main(sys.argv[1]))
