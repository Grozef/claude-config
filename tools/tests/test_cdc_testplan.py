"""Tests de cdc_testplan.py sur le CDC conforme de test_cdc_check (meme fixture, vraie trame)."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
import cdc_testplan  # noqa: E402
from test_cdc_check import cdc, mutate  # noqa: E402,F401  (fixture importee)


def run(md, *extra):
    cdc_testplan.main([str(md), *extra])
    return json.loads(md.with_name(md.stem + '-tests.json').read_text(encoding='utf-8'))


def test_extraction(cdc):
    data = run(cdc)
    assert [t['id'] for t in data['tests']] == ['T-F1-01', 'T-F1-02', 'T-F2-01']
    t = data['tests'][2]
    assert (t['f'], t['type'], t['attendu'], t['refs'], t['generable']) == ('F2', 'API', '201', ['RG-02', 'US-02'], True)


def test_sans_resultat_attendu_non_generable(cdc):
    mutate(cdc, '| T-F1-02 | Compte inactif (RG-01) | 403 | API |', '| T-F1-02 | Compte inactif (RG-01) | [À COMPLÉTER] | API |')
    t = {x['id']: x for x in run(cdc)['tests']}
    assert t['T-F1-02']['generable'] is False and t['T-F1-01']['generable'] is True


def test_type_inconnu_refuse_sans_ecrire(cdc):
    mutate(cdc, '| T-F2-01 | Ajout (US-02, RG-02) | 201 | API |', '| T-F2-01 | Ajout (US-02, RG-02) | 201 | Fumee |')
    with pytest.raises(SystemExit):
        cdc_testplan.main([str(cdc)])
    assert not cdc.with_name(cdc.stem + '-tests.json').exists()


def test_fusion_conserve_fichier_et_statut_retire_les_disparus(cdc):
    path = cdc.with_name(cdc.stem + '-tests.json')
    data = run(cdc)
    data['tests'][0].update(fichier='tests/Cdc/Feature/F1Test.php')
    path.write_text(json.dumps(data), encoding='utf-8')
    mutate(cdc, '| T-F1-02 | Compte inactif (RG-01) | 403 | API |\n', '')
    t = {x['id']: x for x in run(cdc)['tests']}
    assert t['T-F1-01']['fichier'] == 'tests/Cdc/Feature/F1Test.php'
    assert 'T-F1-02' not in t


def test_couverture_du_plan_par_le_code(cdc, tmp_path, capsys):
    repo = tmp_path / 'repo'
    (repo / 'tests' / 'Cdc').mkdir(parents=True)
    (repo / 'node_modules' / 'x').mkdir(parents=True)
    (repo / 'tests' / 'Cdc' / 'F1Test.php').write_text("it('T-F1-01 connexion', fn () => 1);\nit('T-F9-01 inconnu', fn () => 1);", encoding='utf-8')
    (repo / 'node_modules' / 'x' / 'a.js').write_text('T-F1-02', encoding='utf-8')  # elague : ne couvre rien
    (repo / 'vendor' / 'y').mkdir(parents=True)
    (repo / 'vendor' / 'y' / 'b.php').write_text('T-F2-01', encoding='utf-8')       # elague aussi
    with pytest.raises(SystemExit) as e:
        cdc_testplan.main([str(cdc), '--cov', str(repo)])
    out = capsys.readouterr().out
    assert e.value.code == 1
    assert 'SANS CODE  T-F1-02' in out and 'SANS CODE  T-F2-01' in out and 'SANS CODE  T-F1-01' not in out
    assert 'HORS PLAN  T-F9-01' in out
    (repo / 'tests' / 'Cdc' / 'F1Test.php').write_text("function test_T-F1-01() {} T-F1-02 T-F2-01", encoding='utf-8')
    run(cdc)  # <stem>-tests.json present : testcov y reporte le fichier de chaque test
    with pytest.raises(SystemExit) as e:
        cdc_testplan.main([str(cdc), '--cov', str(repo)])
    assert e.value.code == 0  # T-F1-01 trouve derriere « test_ »
    path = cdc.with_name(cdc.stem + '-tests.json')
    assert {t['fichier'] for t in json.loads(path.read_text(encoding='utf-8'))['tests']} == {'tests/Cdc/F1Test.php'}
    # code retire : le fichier est efface du JSON, pas laisse perime
    (repo / 'tests' / 'Cdc' / 'F1Test.php').write_text("T-F1-02 T-F2-01", encoding='utf-8')
    with pytest.raises(SystemExit):
        cdc_testplan.main([str(cdc), '--cov', str(repo)])
    t = {x['id']: x for x in json.loads(path.read_text(encoding='utf-8'))['tests']}
    assert t['T-F1-01']['fichier'] is None and t['T-F1-02']['fichier'] == 'tests/Cdc/F1Test.php'


def test_json_existant_illisible_rien_ecrit(cdc):
    path = cdc.with_name(cdc.stem + '-tests.json')
    path.write_text('[1, 2]', encoding='utf-8')
    with pytest.raises(SystemExit):
        cdc_testplan.main([str(cdc)])
    assert path.read_text(encoding='utf-8') == '[1, 2]'
