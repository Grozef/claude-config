"""Tests de cdc_state.py : un cas par mode recommande, monorepo, exclusions (revue/, fixtures de tests)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import cdc_state  # noqa: E402


def write(root, rel, text=''):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')
    return p


def laravel(root, sub=''):
    base = root / sub if sub else root
    write(base, 'composer.json', json.dumps({'require': {'laravel/framework': '^12.0'}}))
    write(base, 'package.json', json.dumps({'devDependencies': {'vite': '^6'}}))
    write(base, 'routes/api.php', '<?php')
    write(base, 'database/migrations/2024_01_01_create_users.php', '<?php')
    write(base, 'app/Models/User.php', '<?php')


def mode(*paths):
    return cdc_state.recommend([cdc_state.scan(str(p)) for p in paths])[0]


def test_vide_donne_fill(tmp_path):
    assert mode(tmp_path) == 'fill'


def test_doc_seule_donne_avant_projet(tmp_path):
    write(tmp_path, 'docs/besoin.md', '# Besoin')
    assert mode(tmp_path) == 'avant-projet'


def test_brief_fichier_donne_avant_projet(tmp_path):
    brief = write(tmp_path, 'brief.md', '# Brief')
    assert mode(brief) == 'avant-projet'


def test_code_seul_donne_retro(tmp_path):
    laravel(tmp_path)
    write(tmp_path, 'README.md', '# x')  # README : pas une doc fonctionnelle
    assert mode(tmp_path) == 'retro'


def test_code_et_doc_donne_hybride(tmp_path):
    laravel(tmp_path)
    write(tmp_path, 'docs/workflow.md', '# Workflow')
    assert mode(tmp_path) == 'hybride'


def test_cdc_existant_donne_verify(tmp_path):
    laravel(tmp_path)
    write(tmp_path, 'documentation_contractuelle/cahier-des-charges.md', '---\ntitle: X\n---\n')
    s = cdc_state.scan(str(tmp_path))
    assert s['cdc'] == ['documentation_contractuelle/cahier-des-charges.md']
    assert mode(tmp_path) == 'verify'


def test_cdc_reconnu_a_sa_structure(tmp_path):
    write(tmp_path, 'specs/projet.md', '---\ntitle: X\n---\n# 6. Besoins fonctionnels\n# Annexe A — Fiche\n')
    assert cdc_state.scan(str(tmp_path))['cdc'] == ['specs/projet.md']


def test_monorepo_stack_et_source_laravel(tmp_path):
    laravel(tmp_path, 'back')
    write(tmp_path, 'front/package.json', json.dumps({'dependencies': {'vue': '^3.5', '@ionic/vue': '^8'},
                                                      'devDependencies': {'vitest': '^3'}}))
    s = cdc_state.scan(str(tmp_path))
    assert 'Laravel ^12.0 (back)' in s['stack']
    assert 'Vue ^3.5 (front)' in s['stack'] and 'Ionic ^8 (front)' in s['stack']
    assert not any(x.startswith('Node') for x in s['stack'])  # package.json Vite du Laravel
    assert s['db_source'].startswith('--laravel back ')
    assert 'vitest' in s['tests']


def test_revue_et_outillage_claude_ne_sont_pas_de_la_doc(tmp_path):
    write(tmp_path, 'revue/audit.md')
    write(tmp_path, 'documentation_claude/SESSION.md')
    write(tmp_path, 'CLAUDE.md')
    write(tmp_path, 'CHANGELOG.md')
    assert cdc_state.scan(str(tmp_path))['doc'] == []


def test_sql_de_fixture_ignore_sql_projet_retenu(tmp_path):
    write(tmp_path, 'tests/fixtures/demo.sql')
    assert cdc_state.scan(str(tmp_path))['db_source'] is None
    write(tmp_path, 'db/schema.sql')
    assert cdc_state.scan(str(tmp_path))['db_source'] == '--sql db/schema.sql'


def test_dossiers_elagues(tmp_path):
    write(tmp_path, 'node_modules/x/doc.md')
    write(tmp_path, 'vendor/y/index.php')
    s = cdc_state.scan(str(tmp_path))
    assert s['doc'] == [] and s['code'] == {}


def test_chemin_introuvable(tmp_path):
    import pytest
    with pytest.raises(SystemExit):
        cdc_state.scan(str(tmp_path / 'absent'))
