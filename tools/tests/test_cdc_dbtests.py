"""Tests de cdc_dbtests.py : modeles synthetiques au format model.json de dbschema. Chaque test lit le CORPS genere
(code d'erreur attendu, plage des valeurs, assertions), pas seulement les titres ; le PHP passe php -l si PHP est la."""
import json
import os
import re
import shutil
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import cdc_dbtests  # noqa: E402


def col(name, type_='int', **o):
    return {'name': name, 'type': type_, 'nullable': False, 'default': None, 'extra': '', 'comment': '', 'pk': False,
            'fk': False, 'unique': False, **o}


def table(name, cols, indexes=()):
    return {'name': name, 'comment': '', 'columns': cols, 'indexes': list(indexes)}


def rel(name, frm, cols, to, refs, on_delete='CASCADE'):
    return {'name': name, 'from': frm, 'to': to, 'columns': cols, 'ref_columns': refs, 'on_update': 'NO ACTION',
            'on_delete': on_delete, 'card_parent': '1', 'card_child': '0..N'}


ID = col('id', 'bigint unsigned', pk=True, extra='auto_increment')
PK = {'name': 'PRIMARY', 'unique': True, 'columns': ['id']}
UQ = lambda name, *cols: {'name': name, 'unique': True, 'columns': list(cols)}


def model():
    return {'tables': {
        'users': table('users', [ID, col('email', 'varchar(190)'), col('nick', 'varchar(40)', nullable=True)], [PK, UQ('users_email_unique', 'email')]),
        'countries': table('countries', [col('iso', 'char(2)', pk=True), col('kind', "enum('eu','other')"), col('flag', 'char(1)')],
                           [UQ('PRIMARY', 'iso')]),
        'statuses': table('statuses', [col('id', 'smallint unsigned', pk=True, extra='auto_increment'), col('label', 'varchar(20)')],
                          [UQ('PRIMARY', 'id')]),
        'posts': table('posts', [ID, col('user_id', 'bigint unsigned', fk=True), col('country', 'char(2)', fk=True, nullable=True),
                                 col('status_id', 'smallint unsigned', fk=True, default='1'),
                                 col('price', 'decimal(2,2)'), col('created_at', 'timestamp', default='CURRENT_TIMESTAMP', extra='DEFAULT_GENERATED'),
                                 col('slug', 'varchar(60)', nullable=True), col('prénom', 'varchar(10)'),
                                 col('total', 'int', extra='VIRTUAL GENERATED'), col('flag', 'tinyint(1)')],
                       [PK, UQ('posts_country_slug', 'country', 'slug'), UQ('posts_lower', None), UQ('posts_total', 'total'),
                        UQ('posts_id_slug', 'id', 'slug'), UQ('posts_flag', 'flag')]),
        'tags': table('tags', [ID, col('post_id', 'bigint unsigned', fk=True, nullable=True)], [PK]),
        'logs': table('logs', [col('post_id', 'bigint unsigned', fk=True), col('msg', 'varchar(20)')]),
        'a': table('a', [ID, col('b_id', 'bigint unsigned', fk=True)], [PK]),
        'b': table('b', [ID, col('a_id', 'bigint unsigned', fk=True)], [PK]),
        'user-roles': table('user-roles', [ID], [PK]), 'user_roles': table('user_roles', [ID], [PK]),
        'db.audit': table('db.audit', [ID], [PK]),
    }, 'relations': [
        rel('posts_user', 'posts', ['user_id'], 'users', ['id'], 'CASCADE'),
        rel('posts_country', 'posts', ['country'], 'countries', ['iso'], 'RESTRICT'),
        rel('posts_status', 'posts', ['status_id'], 'statuses', ['id'], 'NO ACTION'),
        rel('tags_post', 'tags', ['post_id'], 'posts', ['id'], 'SET NULL'),
        rel('logs_post', 'logs', ['post_id'], 'posts', ['id'], 'CASCADE'),
        rel('a_b', 'a', ['b_id'], 'b', ['id']), rel('b_a', 'b', ['a_id'], 'a', ['id']),
    ], 'groups': {}, 'external_fks': []}


@pytest.fixture
def repo(tmp_path):
    r = tmp_path / 'app'
    r.mkdir()
    (r / 'composer.json').write_text(json.dumps({'require': {'laravel/framework': '^12.0'}, 'require-dev': {'pestphp/pest': '^3'},
                                                 'autoload-dev': {'psr-4': {'Tests\\': 'tests/'}}}), encoding='utf-8')
    m = tmp_path / 'model.json'
    m.write_text(json.dumps(model()), encoding='utf-8')
    return r, m


def gen(repo, *extra):
    r, m = repo
    cdc_dbtests.main([str(m), str(r), '--trait', 'DatabaseTransactions', '--force', *extra])
    d = r / 'tests' / 'Cdc' / 'Database'
    return (d / 'CdcRows.php').read_text(encoding='utf-8'), (d / 'CdcDatabaseTest.php').read_text(encoding='utf-8')


def case(tests, title):
    """Corps du test Pest dont le titre contient `title`."""
    m = re.search(r"it\('[^']*" + re.escape(title) + r"[^\n]*\n(.*?)\n\}\);", tests, re.S)
    assert m, title
    return m.group(1)


def fn(rows, tname):
    i = rows.index('function ' + cdc_dbtests.ident(tname) + '(')
    return rows[i:rows.index('return $row;', i)]


def test_refus_verifies_par_code(repo):
    rows, tests = gen(repo)
    assert "'null' => $code === 1048" in rows and "'fk' => $code === 1452" in rows and "'fkparent' => $code === 1451" in rows
    assert "CdcRows::assertRefus(fn () => CdcRows::" in case(tests, 'users : email NOT NULL refuse NULL') and "'null');" in case(tests, 'users : email NOT NULL')
    assert "'unique');" in case(tests, 'index unique users_email_unique refuse un doublon')
    assert 'expectException' not in tests  # plus aucune « exception quelconque »


def test_orphelin_dans_la_plage_du_type(repo):
    _, tests = gen(repo)
    assert "'status_id' => 65534]" in case(tests, 'FK posts_status refuse un parent inexistant')   # smallint unsigned
    assert "'user_id' => 2147483646]" in case(tests, 'FK posts_user refuse un parent inexistant')    # bigint : borne prudente
    assert "'country' => 'zz']" in case(tests, 'FK posts_country refuse un parent inexistant')       # char(2)
    assert "'fk');" in case(tests, 'FK posts_status refuse un parent inexistant')


def test_on_delete(repo):
    _, tests = gen(repo)
    c = case(tests, "ON DELETE CASCADE posts_user supprime l\\'enfant")
    assert c.index('assertTrue($q()->exists())') < c.index('->delete();') < c.index('assertFalse($q()->exists())')
    s = case(tests, 'ON DELETE SET NULL tags_post vide la FK')
    assert s.index('->delete();') < s.index('assertTrue($q()->exists())') < s.index("assertNull($q()->value('post_id'))")
    assert "'fkparent');" in case(tests, 'ON DELETE RESTRICT posts_country bloque la suppression du parent')
    assert "'fkparent');" in case(tests, 'ON DELETE NO ACTION posts_status bloque la suppression du parent')
    assert "ON DELETE CASCADE logs_post')->skip('enfant sans cle primaire" in tests


def test_fk_not_null_avec_defaut_et_fk_nullable_unique_remplies(repo):
    rows, _ = gen(repo)
    body = fn(rows, 'posts')
    assert 'self::' + cdc_dbtests.ident('statuses') + '()' in body   # status_id NOT NULL avec defaut 1 : parent fabrique
    assert 'self::' + cdc_dbtests.ident('countries') + '()' in body  # country nullable mais dans un index unique
    assert "$row['slug']" in body
    assert "'created_at'" not in body and "'total'" not in body      # defaut / generee : non remplies


def test_valeurs_par_type(repo):
    rows, _ = gen(repo)
    assert "$k = self::$seq['posts'] = (self::$seq['posts'] ?? 0) + 1;" in rows               # sequence par table
    assert "str_pad(base_convert((string) ($k % 1296), 10, 36), 2, '0', STR_PAD_LEFT)" in rows  # char(2)
    assert "str_pad(base_convert((string) ($k % 36), 10, 36), 1, '0', STR_PAD_LEFT)" in rows    # char(1) : jamais 2 caracteres
    assert "mb_substr('v' . $k . '_' . 'prénom', 0, 10)" in rows                                # coupe en caracteres
    assert "['eu', 'other'][$k % 2]" in rows and "round((($k % 89) + 1) / 100, 2)" in rows


def test_index_uniques_non_fabricables_sautes(repo, capsys):
    _, tests = gen(repo)
    out = capsys.readouterr().out
    for name, why in [('posts_lower', 'index sur expression'), ('posts_total', 'colonne generee'),
                      ('posts_id_slug', 'cle auto-increment'), ('posts_flag', 'valeurs constantes')]:
        assert f"index unique {name}')->skip(" in tests and why in out, name


def test_tables_sautees_avec_raison(repo, capsys):
    _, tests = gen(repo)
    out = capsys.readouterr().out
    assert 'cycle de FK NOT NULL' in out and "it('T-BDD-a-01 a : ligne valide')->skip(" in tests
    assert "T-BDD-db.audit-01 db.audit : ligne valide')->skip(" in tests and 'reinterprete par le constructeur' in out


def test_phpunit_methodes_uniques_et_docblocks_surs(repo):
    r, m = repo
    mm = model()
    mm['tables']['x @depends y */'] = table('x @depends y */', [ID], [PK])
    m.write_text(json.dumps(mm), encoding='utf-8')
    _, tests = gen(repo, '--style', 'phpunit')
    meths = re.findall(r'public function (test_\w+)\(\)', tests)
    assert len(meths) == len(set(meths))
    assert cdc_dbtests.ident('user-roles') != cdc_dbtests.ident('user_roles')
    docblocks = [l for l in tests.split('\n') if l.strip().startswith('/**')]
    assert not any('@' in l for l in docblocks) and any('(a)depends y * /' in l for l in docblocks)


def test_refus(repo):
    r, m = repo
    gen(repo)
    with pytest.raises(SystemExit):  # existant sans --force
        cdc_dbtests.main([str(m), str(r), '--trait', 'DatabaseTransactions'])
    with pytest.raises(SystemExit):  # --trait obligatoire
        cdc_dbtests.main([str(m), str(r), '--force'])
    # projet non Laravel, autoload-dev CORRECT : refuse par le seul controle laravel/framework
    (r / 'composer.json').write_text(json.dumps({'require': {}, 'autoload-dev': {'psr-4': {'Tests\\': 'tests/'}}}), encoding='utf-8')
    with pytest.raises(SystemExit) as e:
        cdc_dbtests.main([str(m), str(r), '--trait', 'RefreshDatabase', '--force'])
    assert 'pas un projet Laravel' in str(e.value)


@pytest.mark.skipif(not shutil.which('php'), reason='php absent : syntaxe du PHP genere non verifiee')
@pytest.mark.parametrize('style', ['pest', 'phpunit'])
def test_php_valide(repo, style):
    mm = model()
    mm['tables']["o'brien*/"] = table("o'brien*/", [ID, col("na'me", 'varchar(20)')], [PK])
    repo[1].write_text(json.dumps(mm), encoding='utf-8')
    gen(repo, '--style', style)
    for f in (repo[0] / 'tests' / 'Cdc' / 'Database').glob('*.php'):
        r = subprocess.run(['php', '-l', str(f)], capture_output=True, text=True)
        assert r.returncode == 0, r.stdout + r.stderr
