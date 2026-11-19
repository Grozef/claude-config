"""cdc_manifest.py — enregistre un diagramme d'un CDC dans <stem>-diagrams/manifest.json (lu par cdc_check.py).

Entree : {name, type, source, sha256, section, files}. `source` = fichier dont le diagramme est tire (modele JSON
du diagramme, model.json de la base...), chemin relatif au dossier du CDC ; son sha256 permet a /cdc verify de
signaler un diagramme perime. Une entree du meme nom est remplacee.
Usage : python3 cdc_manifest.py <cdc.md> <nom> <type> <source> <section> [fichier...]
"""
import hashlib
import json
import os
import sys


def record(cdc, name, kind, source, section, files=()):
    d = os.path.dirname(os.path.abspath(cdc))
    stem = os.path.splitext(os.path.basename(cdc))[0]
    ddir = os.path.join(d, stem + '-diagrams')
    src = source if os.path.isabs(source) else os.path.join(d, source)
    if not os.path.isfile(src):
        sys.exit(f'cdc_manifest: source introuvable : {source}')
    for f in files:
        if not os.path.isfile(f if os.path.isabs(f) else os.path.join(d, f)):
            sys.exit(f'cdc_manifest: fichier introuvable : {f}')
    rel = lambda p: os.path.relpath(p if os.path.isabs(p) else os.path.join(d, p), d).replace(os.sep, '/')
    os.makedirs(ddir, exist_ok=True)
    path = os.path.join(ddir, 'manifest.json')
    data = {'diagrams': []}
    if os.path.exists(path):
        data = json.load(open(path, encoding='utf-8'))
        if not isinstance(data, dict) or not isinstance(data.get('diagrams'), list):
            sys.exit(f'cdc_manifest: {path} illisible (objet {{"diagrams": [...]}} attendu), rien ecrit')
    entry = {'name': name, 'type': kind, 'source': rel(src), 'sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(),
             'section': section, 'files': [rel(f) for f in files]}
    data['diagrams'] = [e for e in data['diagrams'] if e.get('name') != name] + [entry]
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'cdc_manifest: {name} ({kind}, section {section}) enregistre dans {path}')


if __name__ == '__main__':
    if len(sys.argv) < 6:
        sys.exit(__doc__)
    record(*sys.argv[1:6], files=sys.argv[6:])
