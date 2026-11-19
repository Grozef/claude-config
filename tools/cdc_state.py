"""cdc_state.py — etat d'un projet pour le skill cdc : quel CDC produire (sous-commande generate, --type auto).

Par source (dossier de repo ou fichier de brief) : stack, code metier, doc fonctionnelle, CDC existant,
outillage de test, source possible du schema de BDD. Puis un mode recommande pour l'ensemble des sources :
  verify       un CDC existe deja : ne pas re-scaffolder (verifier ou monter de version) ;
  hybride      code + doc ;  retro  code seul ;  avant-projet  doc seule ;  fill  rien (questions de cadrage).
Deterministe, lecture seule. Usage : python3 cdc_state.py [--json] <chemin>...
"""
import json
import os
import re
import sys

PRUNE = {'node_modules', 'vendor', '.git', 'dist', 'build', 'storage', '.gradle', '__pycache__', '.venv'}
# Doc qui ne decrit pas le besoin : fichiers de l'outillage Claude, metadonnees de depot.
NOT_FUNCTIONAL = re.compile(r'^(readme|changelog|license|licence|contributing|code_of_conduct|security|claude)\.md$', re.I)
# revue/ : rapports d'audit, jamais une source d'exigences (garde-fou 4 du skill cdc).
NOT_FUNCTIONAL_DIRS = {'documentation_claude', '.claude', '.github', 'documentation_contractuelle', 'revue', 'review', 'audit'}
SRC_EXT = ('.php', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.java', '.kt', '.dart', '.go', '.rb', '.cs', '.rs')
TEST_DIR = re.compile(r'(^|/)(tests?|__tests__|spec|e2e|fixtures)/', re.I)
BRIEF_EXT = ('.md', '.txt', '.docx', '.pdf', '.odt')
CDC_NAME = re.compile(r'cahier.?des.?charges|(^|[-_])cdc([-_.]|$)', re.I)


def walk(root):
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if x not in PRUNE)
        for f in sorted(files):
            yield os.path.join(d, f)


def load_json(path):
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def rel(p, root):
    return os.path.relpath(p, root).replace(os.sep, '/')


def is_cdc(path):
    """Un CDC du skill : nom cahier-des-charges/cdc, ou YAML + titre de la section 6 de la trame."""
    name = os.path.basename(path)
    if not name.lower().endswith('.md'):
        return False
    if CDC_NAME.search(name):
        return True
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            head = fh.read(200_000)
    except OSError:
        return False
    return head.startswith('---') and '# 6. Besoins fonctionnels' in head and '# Annexe A' in head


FRONT = (('vue', 'Vue'), ('@ionic/vue', 'Ionic'), ('quasar', 'Quasar'), ('react', 'React'),
         ('next', 'Next'), ('@angular/core', 'Angular'), ('express', 'Express'), ('prisma', 'Prisma'))
MARKERS = (('manage.py', 'Django'), ('Gemfile', 'Ruby'), ('pyproject.toml', 'Python'), ('requirements.txt', 'Python'))


def stack_of(d):
    """Stack d'un dossier (ses manifestes directs) : (libelles, deps php, deps js)."""
    out = []
    comp = load_json(os.path.join(d, 'composer.json')) or {}
    req = {**comp.get('require', {}), **comp.get('require-dev', {})}
    for pkg, label in (('laravel/framework', 'Laravel'), ('symfony/framework-bundle', 'Symfony')):
        if pkg in req:
            out.append(f'{label} {req[pkg]}')
    pkgj = load_json(os.path.join(d, 'package.json')) or {}
    deps = {**pkgj.get('dependencies', {}), **pkgj.get('devDependencies', {})}
    out += [f'{label} {deps[pkg]}' for pkg, label in FRONT if pkg in deps]
    if pkgj and not req and not any(pkg in deps for pkg, _ in FRONT):  # package.json d'un Laravel = Vite
        out.append('Node')
    out += [label for marker, label in MARKERS if os.path.exists(os.path.join(d, marker))]
    return out, req, deps


def scan_dir(root):
    s = {'path': root, 'kind': 'repo', 'stack': [], 'code': {}, 'doc': [], 'cdc': [], 'tests': [], 'db_source': None}
    # Monorepo : chaque sous-projet porte ses manifestes (racine + 2 niveaux, hors dossiers elagues).
    laravel_dirs, req, deps = [], {}, {}
    for d, dirs, _ in os.walk(root):
        dirs[:] = sorted(x for x in dirs if x not in PRUNE and not x.startswith('.'))
        depth = 0 if d == root else rel(d, root).count('/') + 1
        if depth >= 2:
            dirs[:] = []
        labels, r_, d_ = stack_of(d)
        req.update(r_)
        deps.update(d_)
        where = '' if d == root else f' ({rel(d, root)})'
        s['stack'] += [x + where for x in labels]
        if 'laravel/framework' in r_ and os.path.isdir(os.path.join(d, 'database', 'migrations')):
            laravel_dirs.append(rel(d, root))

    code = {'routes': 0, 'migrations': 0, 'models': 0, 'vue': 0, 'source': 0, 'sql': 0}
    sql_files = []
    for p in walk(root):
        r = rel(p, root)
        low = r.lower()
        if re.match(r'(.*/)?routes/[^/]+\.php$', low):
            code['routes'] += 1
        elif re.match(r'(.*/)?database/migrations/[^/]+\.php$', low):
            code['migrations'] += 1
        elif re.match(r'(.*/)?app/models/[^/]+\.php$', low):
            code['models'] += 1
        elif low.endswith('.vue'):
            code['vue'] += 1
        elif low.endswith(SRC_EXT) and not TEST_DIR.search(low):
            code['source'] += 1
        elif low.endswith('.sql') and r.count('/') <= 3 and not TEST_DIR.search(low):
            code['sql'] += 1
            sql_files.append(r)
        if low.endswith('.md'):
            parts = r.split('/')
            if is_cdc(p):
                s['cdc'].append(r)
            elif not NOT_FUNCTIONAL.match(parts[-1]) and not NOT_FUNCTIONAL_DIRS.intersection(parts[:-1]):
                s['doc'].append(r)
        base = os.path.basename(low)
        if base in ('phpunit.xml', 'phpunit.xml.dist'):
            s['tests'].append('phpunit')
        elif low.endswith('tests/pest.php'):
            s['tests'].append('pest')
        elif re.match(r'vitest\.config\.[cm]?[jt]s$', base):
            s['tests'].append('vitest')
        elif re.match(r'playwright\.config\.[cm]?[jt]s$', base):
            s['tests'].append('playwright')
    for pkg, label in (('vitest', 'vitest'), ('@playwright/test', 'playwright')):
        if pkg in deps:
            s['tests'].append(label)
    if 'pestphp/pest' in req:
        s['tests'].append('pest')
    s['tests'] = sorted(set(s['tests']))
    s['code'] = {k: v for k, v in code.items() if v}
    if laravel_dirs:
        s['db_source'] = f'--laravel {laravel_dirs[0]} (demander si le depot est de confiance)'
    elif sql_files:
        s['db_source'] = '--sql ' + sql_files[0]
    elif any(x.split()[0] in ('Symfony', 'Django', 'Ruby', 'Prisma', 'Express') for x in s['stack']):
        s['db_source'] = '--db (base de dev deja migree)'
    return s


def scan(path):
    if os.path.isdir(path):
        return scan_dir(path)
    if not os.path.isfile(path):
        raise SystemExit(f'cdc_state: introuvable: {path}')
    s = {'path': path, 'kind': 'fichier', 'stack': [], 'code': {}, 'doc': [], 'cdc': [], 'tests': [], 'db_source': None}
    if is_cdc(path):
        s['cdc'].append(os.path.basename(path))
    elif path.lower().endswith(BRIEF_EXT):
        s['doc'].append(os.path.basename(path))
    else:
        raise SystemExit(f'cdc_state: fichier non pris en charge (attendu {"/".join(BRIEF_EXT)}): {path}')
    return s


def recommend(sources):
    has_cdc = any(s['cdc'] for s in sources)
    has_code = any(s['code'].get(k) for s in sources for k in ('routes', 'migrations', 'models', 'vue', 'source'))
    has_doc = any(s['doc'] for s in sources)
    if has_cdc:
        return 'verify', 'un CDC existe deja : /cdc verify, ou nouvelle version (v0.N) plutot qu un nouveau scaffold'
    if has_code and has_doc:
        return 'hybride', 'socle technique depuis le code, objectifs et workflows depuis la doc'
    if has_code:
        return 'retro', 'code sans doc fonctionnelle : exigences tirees du code, le reste en [À COMPLÉTER]'
    if has_doc:
        return 'avant-projet', 'doc sans code : CDC rempli depuis la doc'
    return 'fill', 'ni code ni doc : questions de cadrage, sinon squelette vierge'


def main(argv):
    as_json = '--json' in argv
    paths = [a for a in argv if a != '--json']
    if not paths:
        raise SystemExit('usage: cdc_state.py [--json] <chemin>...')
    sources = [scan(p) for p in paths]
    mode, why = recommend(sources)
    if as_json:
        print(json.dumps({'sources': sources, 'mode': mode, 'raison': why}, ensure_ascii=False, indent=2))
        return
    for s in sources:
        print(f"== {s['path']} ({s['kind']})")
        print(f"  stack      : {', '.join(s['stack']) or 'non detectee'}")
        print(f"  code       : {', '.join(f'{k}={v}' for k, v in s['code'].items()) or 'aucun'}")
        print(f"  doc        : {len(s['doc'])} fichier(s)" + (f" ({', '.join(s['doc'][:5])}{' ...' if len(s['doc']) > 5 else ''})" if s['doc'] else ''))
        print(f"  cdc        : {', '.join(s['cdc']) or 'aucun'}")
        print(f"  tests      : {', '.join(s['tests']) or 'aucun outillage'}")
        print(f"  source bdd : {s['db_source'] or 'aucune'}")
    print(f'MODE RECOMMANDE : {mode} — {why}')


if __name__ == '__main__':
    main(sys.argv[1:])
