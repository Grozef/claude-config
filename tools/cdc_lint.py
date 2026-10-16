"""cdc_lint.py — gate du skill cdc, BLOQUANT (exit 1) sur :
  1. vocabulaire de dette / audit / WIP (garde-fou 4) ;
  2. fichier cité introuvable dans le dépôt (garde-fou 2 : une source citée doit exister) ;
  3. consigne du modèle restée dans un CDC rempli.
Un squelette `fill` (title: resté « [Nom du projet] ») n'est pas bloqué sur les consignes.
Une ligne justifiée comme faux positif porte le commentaire <!-- lint-ok -->.
Les sources citées sont cherchées dans le dépôt du CDC et dans les dépôts listés par la clé
YAML `sources:` (CDC multi-sources, ex. un front et un back) ou passés en arguments.
Usage : python3 cdc_lint.py <f.md> [depot source ...]
"""
import os
import re
import subprocess
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
# Façades Laravel et classes de framework : sous vendor/ (non indexé), jamais un fichier du dépôt.
FACADES = {'App', 'Artisan', 'Auth', 'Blade', 'Broadcast', 'Bus', 'Cache', 'Carbon', 'Config',
           'Cookie', 'Crypt', 'DB', 'Event', 'File', 'Gate', 'Hash', 'Http', 'Lang', 'Log',
           'Mail', 'Notification', 'Password', 'Queue', 'Redirect', 'Request', 'Response',
           'Route', 'Schema', 'Session', 'Storage', 'Str', 'Arr', 'URL', 'Validator', 'View'}
# « <libellé> » hors backticks : pandoc le lit comme une balise HTML et l'efface du rendu.
EATEN = re.compile(r'<[A-Za-zÀ-ÿ][\wÀ-ÿ-]*>')
SKIP_DIRS = {'node_modules', 'vendor', '.git', 'dist', 'build', '.gradle', 'storage', '.next', 'coverage'}


def repo_root(md_dir):
    try:
        out = subprocess.run(['git', '-C', md_dir, 'rev-parse', '--show-toplevel'],
                             capture_output=True, text=True, check=True).stdout.strip()
        return out or md_dir
    except (subprocess.CalledProcessError, FileNotFoundError):
        return md_dir


def index_files(root):
    rels, names = set(), set()
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            rel = os.path.relpath(os.path.join(d, f), root).replace('\\', '/')
            rels.add(rel)
            names.add(f)
    return rels, names


def exists(tok, root, md_dir, rels, names):
    t = tok
    if t.startswith('~/'):
        return os.path.exists(os.path.expanduser(t))
    mnt = re.match(r'^/([A-Za-z])/(.*)', t)  # /c/laragon/... (Git Bash) -> C:/laragon/...
    if mnt and os.name == 'nt':
        t = mnt.group(1) + ':/' + mnt.group(2)
    elif t.startswith('/') and os.name == 'nt':
        return True  # chemin serveur POSIX (/etc/nginx/...) : non vérifiable depuis ce poste
    if re.match(r'^[A-Za-z]:/', t) or t.startswith('/'):
        return os.path.exists(t)
    if '/' not in t:
        return t in names
    if os.path.exists(os.path.join(md_dir, t)) or os.path.exists(os.path.join(root, t)):
        return True
    t = t.lstrip('./') if t.startswith('./') else t
    return any(r == t or r.endswith('/' + t) for r in rels)


def yaml_sources(text):
    """Liste `sources:` du front matter YAML (forme bloc `- chemin` ou en ligne `[a, b]`)."""
    m = re.match(r'---\n(.*?)\n---\n', text, re.S)
    if not m:
        return []
    fm = m.group(1).split('\n')
    out = []
    for i, l in enumerate(fm):
        if not l.startswith('sources:'):
            continue
        rest = l[len('sources:'):].strip()
        if rest.startswith('['):
            return [s.strip().strip('"\'') for s in rest.strip('[]').split(',') if s.strip()]
        if rest:
            return [rest.strip('"\'')]  # scalaire : un seul dépôt
        for item in fm[i + 1:]:
            mm = re.match(r'\s+-\s+(.+)', item)
            if not mm:
                break
            out.append(mm.group(1).strip().strip('"\''))
    return out


def main(md, extra=()):
    extra = list(extra)
    md = os.path.abspath(md)
    md_dir = os.path.dirname(md)
    text = open(md, encoding='utf-8').read()
    lines = text.split('\n')
    fill = re.search(r'^title:\s*"?\[Nom du projet\]"?\s*$', text, re.M) is not None
    # Racines où chercher les sources citées : le dépôt du CDC, plus les dépôts sources d'un CDC
    # multi-sources (clé YAML `sources:` en liste, ou arguments en ligne de commande).
    roots = [repo_root(md_dir)]
    bad_roots = []
    # sources: YAML relatives au dossier du .md ; arguments relatifs au répertoire courant.
    for r in [os.path.join(md_dir, os.path.expanduser(s)) for s in yaml_sources(text)] + extra:
        r = os.path.expanduser(r)
        if os.path.isdir(r):
            roots.append(repo_root(r))
        else:
            bad_roots.append(r)
    indexes = [(r,) + index_files(r) for r in dict.fromkeys(roots)]
    names = set().union(*(i[2] for i in indexes))
    root = ', '.join(i[0] for i in indexes)

    debt, missing, eaten, consignes, placeholders = [], [], [], 0, 0
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
        for tok in PATH.findall(body):
            if tok.startswith(('http', 'www.')) or '*' in tok or '<' in tok or TECH_JS.match(tok):
                continue
            if not any(exists(tok, r, md_dir, rels, nm) for r, rels, nm in indexes):
                missing.append((n, tok))
        for cls in CLASSREF.findall(body):
            if cls not in FACADES and cls + '.php' not in names and cls + '.ts' not in names:
                missing.append((n, cls + '::'))

    fail = False
    if bad_roots:
        fail = True
        print('/!\\ LINT — dépôt source introuvable (YAML sources: ou argument) : ' + ', '.join(bad_roots))
    if debt:
        fail = True
        print('/!\\ LINT garde-fou 4 — vocabulaire de dette/audit/WIP (corriger, ou <!-- lint-ok --> si faux positif) :')
        for n, l in debt:
            print('  l.%d : %s' % (n, l))
    else:
        print('[OK] lint: aucune mention de dette/audit/WIP')
    if missing:
        fail = True
        print('/!\\ LINT garde-fou 2 — source citée introuvable sous %s :' % root)
        for n, t in missing:
            print('  l.%d : %s' % (n, t))
    else:
        print('[OK] lint: toutes les sources citées existent (racine %s)' % root)
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
    if len(sys.argv) < 2:
        sys.exit('usage: cdc_lint.py <f.md> [depot source ...]')
    sys.exit(main(sys.argv[1], sys.argv[2:]))
