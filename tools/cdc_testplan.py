"""cdc_testplan.py — plan de tests d'un CDC (lignes A.9 a ID T-F<n>-<k>) -> <stem>-tests.json (sous-commande tests).

Par test : id, f, type, scenario, attendu, refs (US / RG citees), plus le fichier de code qui le porte (ecrit par
--cov, CONSERVE d'une extraction a l'autre par fusion sur l'id) ; un test retire du CDC est retire du JSON. Les lignes dont le resultat
attendu est [À COMPLÉTER] sont gardees avec generable=false : aucun code ne s'ecrit sans resultat attendu.
--cov <repo> : couverture du plan par le code (ID T-F<n>-<k> cites dans les fichiers de code du repo) : planifies
generables sans code, ID de code hors plan ; code de sortie 1 s'il y en a.
Usage : python3 cdc_testplan.py <cdc.md> [--print] | <cdc.md> --cov <repo>
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdc_check import PLACE, TID, clean_id, parse, table  # noqa: E402

TYPES = {'unitaire': 'Unitaire', 'bdd': 'BDD', 'api': 'API', 'composant': 'Composant', 'e2e': 'E2E',
         'performance': 'Performance', 'perf': 'Performance'}


def extract(text):
    heads, tables = parse(text)
    fiches = [m.group(1) for lvl, t, _ in heads if lvl == 1 for m in [re.match(r'Annexe A — (F\d+) :', t)] if m]
    out, errs = [], []
    for f in fiches:
        for t in table(tables, 'A.9 ', f):
            for n, c in t['rows']:
                tid = clean_id(c[0]) if c else ''
                if not TID.match(tid):
                    continue
                c = c + [''] * (4 - len(c))
                typ = TYPES.get(c[3].strip().lower())
                if not typ:
                    errs.append(f'ligne {n} : {tid} type « {c[3]} » (attendu {" / ".join(sorted(set(TYPES.values())))})')
                out.append({'id': tid, 'f': f, 'type': typ or c[3].strip(), 'scenario': c[1], 'attendu': c[2],
                            'refs': sorted(set(re.findall(r'\b(?:US|RG)-\d+\b', ' '.join(c[1:3])))),
                            'generable': bool(typ) and PLACE not in c[2] and bool(c[2].strip()) and PLACE not in c[1],
                            'ligne': n})
    return out, errs


PRUNE = {'node_modules', 'vendor', '.git', 'dist', 'build', 'storage'}
CODE_EXT = ('.php', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.py')


def coverage(cdc, repo):
    """ID T-F<n>-<k> planifies (generables) sans code dans le repo, et ID cites dans du code mais absents du plan."""
    tests, errs = extract(open(cdc, encoding='utf-8').read())
    if errs:
        for e in errs:
            print('ERREUR ' + e)
        return 1
    found = {}
    for d, dirs, files in os.walk(repo):
        dirs[:] = [x for x in dirs if x not in PRUNE]
        for f in files:
            if f.endswith(CODE_EXT):
                p = os.path.join(d, f)
                try:
                    text = open(p, encoding='utf-8', errors='replace').read()
                except OSError:
                    continue
                # ID aussi derriere un « _ » (test_T-F1-01) ; pas au milieu d'un autre identifiant (XT-F1-01, T-F1-012)
                for tid in set(re.findall(r'(?<![A-Za-z0-9-])T-F\d+-\d+(?![\d])', text)):
                    found.setdefault(tid, []).append(os.path.relpath(p, repo).replace(os.sep, '/'))
    plan = {t['id']: t for t in tests}
    # <stem>-tests.json (s'il existe) : fichier de chaque test trouve, pour la tracabilite du dernier etat
    jpath = os.path.splitext(cdc)[0] + '-tests.json'
    if os.path.exists(jpath):
        try:
            data = json.load(open(jpath, encoding='utf-8'))
            for t in data.get('tests', []):
                # fichier efface si le code a disparu : l'etat ne reste jamais perime
                t['fichier'] = found[t['id']][0] if t.get('id') in found else None
            with open(jpath, 'w', encoding='utf-8', newline='\n') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=1)
                fh.write('\n')
        except (ValueError, AttributeError, TypeError):
            print(f'cdc_testplan: {jpath} illisible, non mis a jour')
    missing = [t for t in tests if t['generable'] and t['id'] not in found]
    unknown = sorted(set(found) - set(plan))
    for t in missing:
        print(f"SANS CODE  {t['id']} ({t['type']}) {t['scenario'][:70]}")
    for tid in unknown:
        print(f"HORS PLAN  {tid} dans {', '.join(found[tid][:3])}")
    print(f'cdc_testplan: {len(plan)} planifie(s), {sum(t["id"] in found for t in tests)} avec code, '
          f'{len(missing)} generable(s) sans code, {len(unknown)} ID de code hors plan')
    return 1 if missing or unknown else 0


def main(argv):
    if not argv or argv[0].startswith('-'):
        sys.exit(__doc__)
    cdc = argv[0]
    if '--cov' in argv:
        i = argv.index('--cov')
        if i + 1 >= len(argv):
            sys.exit('cdc_testplan: --cov <repo>')
        sys.exit(coverage(cdc, argv[i + 1]))
    tests, errs = extract(open(cdc, encoding='utf-8').read())
    for e in errs:
        print('ERREUR ' + e)
    if errs:
        sys.exit(1)
    path = os.path.splitext(cdc)[0] + '-tests.json'
    old = {}
    if os.path.exists(path):
        try:
            old = {t['id']: t for t in json.load(open(path, encoding='utf-8')).get('tests', [])}
        except (ValueError, AttributeError, TypeError, KeyError):
            sys.exit(f'cdc_testplan: {path} illisible, rien ecrit (le corriger ou le deplacer)')
    for t in tests:
        prev = old.get(t['id'], {})
        t['fichier'] = prev.get('fichier')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump({'cdc': os.path.basename(cdc), 'tests': tests}, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    by = {}
    for t in tests:
        by[t['type']] = by.get(t['type'], 0) + 1
    gone = sorted(set(old) - {t['id'] for t in tests})
    print(f"cdc_testplan: {len(tests)} test(s) -> {path} ({', '.join(f'{k}={v}' for k, v in sorted(by.items())) or 'aucun'}) ; "
          f"{sum(not t['generable'] for t in tests)} sans resultat attendu (non generables)" + (f" ; retires : {', '.join(gone)}" if gone else ''))
    if '--print' in argv:
        for t in tests:
            print(f"  {t['id']:10} {t['type']:11} {'ok ' if t['generable'] else '---'} {t['scenario'][:70]}")


if __name__ == '__main__':
    main(sys.argv[1:])
