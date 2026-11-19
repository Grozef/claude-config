"""cdc_dbtests.py — tests BDD DETERMINISTES (Laravel, Pest ou PHPUnit) tires du model.json de dbschema.

Par table : une ligne valide s'insere ; chaque colonne NOT NULL sans defaut refuse NULL ; chaque index UNIQUE refuse un
doublon ; chaque FK refuse un parent inexistant ; ON DELETE CASCADE / SET NULL / RESTRICT / NO ACTION se comporte comme
declare. Chaque refus verifie le CODE d'erreur attendu (MySQL / MariaDB 1048, 1062, 1452, 1451 ; message de contrainte
SQLite), jamais « une exception quelconque » : une valeur hors plage ne passe pas pour une FK.
Les lignes sont construites par type de colonne, parents d'abord, avec une sequence PAR TABLE. Ce qui ne se construit
pas sans deviner est SAUTE avec sa raison : FK composite, cycle de FK NOT NULL, auto-reference, type non construit,
PK composite avec auto-increment, nom que le constructeur de requetes de Laravel reinterpreterait, index unique sur
expression, sur colonne generee, contenant la PK auto ou sur une colonne a valeur constante.
Limite : les contraintes CHECK ne sont pas dans model.json (dont le JSON de MariaDB, longtext + CHECK json_valid) ; un
rouge sur une table a CHECK est une limite du generateur, pas un ecart de l'application.
Sortie (dans le repo Laravel) : tests/Cdc/Database/CdcRows.php (fabrique) + CdcDatabaseTest.php. ID : T-BDD-<table>-<k>.
Fichiers generes : ne pas les modifier, regenerer (--force). Rien n'est ecrase sans --force.
Usage : python3 cdc_dbtests.py <model.json> <repo_laravel> --trait RefreshDatabase|DatabaseTransactions|DatabaseMigrations
                               [--style pest|phpunit] [--force]
"""
import hashlib
import json
import os
import re
import sys

TRAITS = ('RefreshDatabase', 'DatabaseTransactions', 'DatabaseMigrations')
SPATIAL = re.compile(r'^(geometry|point|linestring|polygon|multipoint|multilinestring|multipolygon|geometrycollection|geomcollection)\b')
GENERATED = re.compile(r'\b(VIRTUAL|STORED) GENERATED\b', re.I)
# Laravel (Grammar::wrap) lit « . » comme schema.table, « as » comme alias, « -> » comme chemin JSON
LARAVEL_SPECIAL = re.compile(r'\.|\s+as\s+|->', re.I)
INT_MAX = {'tinyint': (127, 255), 'smallint': (32767, 65535), 'mediumint': (8388607, 16777215),
           'int': (2147483647, 4294967295), 'integer': (2147483647, 4294967295), 'bigint': (2147483647, 2147483647)}


def php_str(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"


def ident(name):
    """Nom PHP sur et UNIQUE pour une table (empreinte du nom exact : « user-roles » et « user_roles » different)."""
    return 't_' + re.sub(r'\W', '_', name)[:40] + '_' + hashlib.sha1(name.encode()).hexdigest()[:8]


def doc(text):
    """Texte place dans un docblock : ni fin de commentaire, ni annotation PHPUnit (@depends, @group...)."""
    return text.replace('*/', '* /').replace('@', '(a)')


def base_type(col):
    t = col['type'].lower()
    return t.split('(')[0].split()[0], t


def constant_domain(col):
    """Colonne dont le generateur ne peut produire qu'une valeur (booleen, bit, enum a une valeur)."""
    base, t = base_type(col)
    if base in ('bool', 'boolean', 'bit') or (base == 'tinyint' and re.search(r'\(1\)', t)):
        return True
    return base in ('enum', 'set') and len(re.findall(r"'((?:[^']|'')*)'", col['type'])) == 1


def value_expr(col):
    """Expression PHP d'une valeur valide de la colonne, distincte selon $k (sequence de la table)."""
    base, t = base_type(col)
    m = re.search(r'\((\d+)', t)
    n = int(m.group(1)) if m else None
    if base in ('enum', 'set'):
        vals = [v.replace("''", "'") for v in re.findall(r"'((?:[^']|'')*)'", col['type'])]
        return '[' + ', '.join(php_str(v) for v in vals) + f'][$k % {len(vals)}]' if vals else None
    if base in ('bool', 'boolean', 'bit') or (base == 'tinyint' and n == 1):
        return '1'
    if base == 'tinyint':
        return '($k % 100) + 1'
    if base == 'year':
        return '2000 + ($k % 100)'
    if base in ('smallint', 'mediumint', 'int', 'integer', 'bigint'):
        return '$k'
    if base in ('decimal', 'numeric'):
        return 'round((($k % 89) + 1) / 100, 2)'  # 0.01 a 0.89 : tient dans decimal(2,2) comme dans decimal(10,2)
    if base in ('float', 'double', 'real'):
        return '$k'
    if base == 'date':
        return "date('Y-m-d', 1767225600 + 86400 * $k)"
    if base in ('datetime', 'timestamp'):
        return "date('Y-m-d H:i:s', 1767225600 + 60 * $k)"
    if base == 'time':
        return "sprintf('%02d:%02d:00', intdiv($k, 60) % 24, $k % 60)"
    if base == 'json':
        return "json_encode(['k' => $k])"
    if base == 'uuid' or (base == 'char' and n == 36):
        return "sprintf('00000000-0000-4000-8000-%012d', $k)"
    if base in ('char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'binary', 'varbinary',
                'tinyblob', 'blob', 'mediumblob', 'longblob'):
        lim = n if n else 60
        # >= 8 : 'v<k>_colonne' coupe en CARACTERES (mb_substr : un nom non ASCII reste de l'UTF-8 valide) ;
        # plus court : k en base 36, borne a 36^lim valeurs pour ne jamais depasser la largeur
        if lim >= 8:
            return f"mb_substr('v' . $k . '_' . {php_str(col['name'])}, 0, {lim})"
        return f"str_pad(base_convert((string) ($k % {36 ** lim}), 10, 36), {lim}, '0', STR_PAD_LEFT)"
    return None


class Table:
    def __init__(self, t, rels):
        self.name = t['name']
        self.cols = {c['name']: c for c in t['columns']}
        self.pk = [c['name'] for c in t['columns'] if c['pk']]
        self.auto = [c['name'] for c in t['columns'] if 'auto_increment' in (c['extra'] or '')]
        self.uniques, self.skipped_uniques = [], []
        for i in t['indexes']:
            if not i['unique'] or i['name'] == 'PRIMARY':
                continue
            why = self.unique_skip(i)
            (self.skipped_uniques.append((i, why)) if why else self.uniques.append(i))
        self.fks = [r for r in rels if r['from'] == self.name]
        fk_cols = {c for r in self.fks for c in r['columns']}
        uniq_cols = {c for i in self.uniques for c in i['columns']}
        self.required = [c['name'] for c in t['columns']
                         if not GENERATED.search(c['extra'] or '') and c['name'] not in self.auto
                         and ((not c['nullable'] and c['default'] is None) or c['name'] in uniq_cols or c['name'] in self.pk)
                         and c['name'] not in fk_cols]
        # FK remplies : toute FK NOT NULL (meme avec defaut : le parent du defaut n'existe pas forcement), ou membre
        # d'un index UNIQUE (NULL y serait admis en double : test faux)
        self.req_fks = [r for r in self.fks if any(not self.cols[c]['nullable'] or c in uniq_cols for c in r['columns'])]
        self.skip = None
        if LARAVEL_SPECIAL.search(self.name) or any(LARAVEL_SPECIAL.search(c) for c in self.cols):
            self.skip = 'nom avec « . », « as » ou « -> » : reinterprete par le constructeur de requetes de Laravel'
        if len(self.pk) > 1 and self.auto:
            self.skip = 'cle primaire composite avec auto-increment : identifiant de la ligne non recuperable'
        for c in self.required:
            if SPATIAL.match(self.cols[c]['type'].lower()) or value_expr(self.cols[c]) is None:
                self.skip = f"colonne {c} de type {self.cols[c]['type']} : valeur non construite automatiquement"
        for r in self.req_fks:
            if len(r['columns']) > 1:
                self.skip = f"FK composite {r['name']} : non construite automatiquement"

    def unique_skip(self, i):
        cols = i['columns']
        if not cols or any(c is None or c not in self.cols for c in cols):
            return 'index sur expression : colonnes non connues'
        if any(GENERATED.search(self.cols[c]['extra'] or '') for c in cols):
            return 'index sur colonne generee : valeur non maitrisee'
        if any(c in self.pk and 'auto_increment' in (self.cols[c]['extra'] or '') for c in cols):
            return 'index contenant la cle auto-increment : le doublon viendrait de la cle, pas de l\'index'
        if all(constant_domain(self.cols[c]) for c in cols):
            return 'index sur valeurs constantes (booleen, enum a une valeur) : deux lignes valides impossibles'
        return None


def order_and_cycles(tables):
    """Tables dont la fabrique termine : un cycle de FK NOT NULL (auto-reference comprise) est saute."""
    state, bad = {}, {}

    def visit(n, stack):
        if state.get(n) == 'done':
            return
        if state.get(n) == 'open':
            for x in stack[stack.index(n):]:
                bad[x] = 'cycle de FK NOT NULL (' + ' -> '.join(stack[stack.index(n):] + [n]) + ')'
            return
        state[n] = 'open'
        for r in tables[n].req_fks:
            if r['to'] in tables:
                visit(r['to'], stack + [n])
        state[n] = 'done'
    for n in tables:
        visit(n, [])
    for n, why in bad.items():
        tables[n].skip = tables[n].skip or why
    # un parent saute, ou dont la colonne referencee n'est pas dans la ligne fabriquee, rend l'enfant non constructible
    changed = True
    while changed:
        changed = False
        for t in tables.values():
            if t.skip:
                continue
            for r in t.req_fks:
                p = tables.get(r['to'])
                if not p or p.skip:
                    t.skip, changed = f"parent {r['to']} non constructible", True
                elif not returned(p, r['ref_columns'][0]):
                    t.skip, changed = f"colonne {r['to']}.{r['ref_columns'][0]} referencee mais non fabriquee", True


def returned(t, col):
    """La ligne rendue par la fabrique de t contient-elle col ?"""
    return col in t.required or (len(t.pk) == 1 and col == t.pk[0] and col in t.auto)


RAISES = '''
    /** Refus attendu, verifie par son code : 'null' (1048), 'unique' (1062), 'fk' (1452), 'fkparent' (1451) ; SQLite : message. */
    public static function assertRefus(\\Closure $f, string $kind): void
    {
        try {
            $f();
        } catch (QueryException $e) {
            $code = (int) ($e->errorInfo[1] ?? 0);
            $msg = $e->getMessage();
            $ok = match ($kind) {
                'null' => $code === 1048 || str_contains($msg, 'NOT NULL constraint'),
                'unique' => $code === 1062 || str_contains($msg, 'UNIQUE constraint'),
                'fk' => $code === 1452 || str_contains($msg, 'FOREIGN KEY constraint'),
                'fkparent' => $code === 1451 || str_contains($msg, 'FOREIGN KEY constraint'),
            };
            Assert::assertTrue($ok, "refus attendu ($kind), autre erreur obtenue : " . $msg);
            return;
        }
        Assert::fail("aucun refus ($kind) : la contrainte n'est pas en base");
    }
'''


def rows_class(tables, sha):
    out = ['<?php', '', f'// Genere par cdc_dbtests.py depuis model.json (sha256 {sha}). Ne pas modifier : regenerer.', '',
           'namespace Tests\\Cdc\\Database;', '', 'use Illuminate\\Database\\QueryException;', 'use Illuminate\\Support\\Facades\\DB;',
           'use PHPUnit\\Framework\\Assert;', '',
           '/** Fabrique de lignes valides, une methode par table ; $over remplace des valeurs (null compris). */',
           'final class CdcRows', '{', '    /** @var array<string, int> sequence par table */', '    private static array $seq = [];',
           RAISES]
    for t in tables.values():
        if t.skip:
            continue
        out.append(f'    /** Table {doc(t.name)} */')
        out.append(f'    public static function {ident(t.name)}(array $over = []): array')
        out.append('    {')
        out.append(f"        $k = self::$seq[{php_str(t.name)}] = (self::$seq[{php_str(t.name)}] ?? 0) + 1;")
        out.append('        $row = [];')
        for r in t.req_fks:
            c, rc = r['columns'][0], r['ref_columns'][0]
            out.append(f"        if (!array_key_exists({php_str(c)}, $over)) {{")
            out.append(f"            $p = self::{ident(r['to'])}();")
            out.append(f"            $row[{php_str(c)}] = $p[{php_str(rc)}];")
            out.append('        }')
        for c in t.required:
            out.append(f"        $row[{php_str(c)}] = {value_expr(t.cols[c])};")
        out.append('        $row = array_merge($row, $over);')
        if len(t.pk) == 1 and t.pk[0] in t.auto:
            out.append(f"        $row[{php_str(t.pk[0])}] = DB::table({php_str(t.name)})->insertGetId($row);")
        else:
            out.append(f"        DB::table({php_str(t.name)})->insert($row);")
        out.append('        return $row;')
        out.append('    }')
        out.append('')
    out.append('}')
    return '\n'.join(out) + '\n'


def orphan(col):
    """Valeur DANS LA PLAGE du type, sans parent (une valeur hors plage leverait 22003 et ferait passer le test sans FK)."""
    base, t = base_type(col)
    if base in ('char', 'varchar'):
        m = re.search(r'\((\d+)', t)
        return php_str('zz-orphelin-cdc'[:int(m.group(1)) if m else 15])
    if base in INT_MAX:
        mx = INT_MAX[base][1 if 'unsigned' in t else 0]
        return str(mx - 1)
    return None


def cases(tables):
    """(id, titre, corps PHP en liste de lignes, raison de saut ou None)."""
    out = []
    for t in tables.values():
        k = 0

        def add(title, body, skip=None):
            nonlocal k
            k += 1
            out.append((f'T-BDD-{t.name}-{k:02d}', f'{t.name} : {title}', body, skip))
        f = f'CdcRows::{ident(t.name)}'
        refus = lambda kind, call: [f"CdcRows::assertRefus(fn () => {call}, '{kind}');"]
        if t.skip:
            add('ligne valide', [], t.skip)
            continue
        key = t.pk if t.pk and all(returned(t, c) for c in t.pk) else t.required[:1]
        add("une ligne valide s'insere", [f'$row = {f}();',
                                          f"$this->assertTrue(DB::table({php_str(t.name)})->where(array_intersect_key($row, array_flip({json_like(key)})))->exists());"])
        for c in t.required + [x for r in t.req_fks for x in r['columns']]:
            col = t.cols[c]
            if not col['nullable'] and col['default'] is None:
                add(f'{c} NOT NULL refuse NULL', refus('null', f"{f}([{php_str(c)} => null])"))
        for i in t.uniques:
            add(f"index unique {i['name']} refuse un doublon",
                [f'$a = {f}();'] + refus('unique', f"{f}(array_intersect_key($a, array_flip({json_like(i['columns'])})))"))
        for i, why in t.skipped_uniques:
            add(f"index unique {i['name']}", [], why)
        for r in t.fks:
            if len(r['columns']) > 1:
                add(f"FK {r['name']}", [], 'FK composite : non construite automatiquement')
                continue
            c, rc = r['columns'][0], r['ref_columns'][0]
            parent = tables.get(r['to'])
            if r['to'] == t.name or not parent or parent.skip or not returned(parent, rc):
                add(f"FK {r['name']}", [], 'auto-reference, parent non constructible ou colonne referencee non fabriquee')
                continue
            o = orphan(t.cols[c])
            if o is None:
                add(f"FK {r['name']} refuse un parent inexistant", [], f"type {t.cols[c]['type']} : valeur orpheline non construite")
            else:
                add(f"FK {r['name']} refuse un parent inexistant", refus('fk', f"{f}([{php_str(c)} => {o}])"))
            pf = f'CdcRows::{ident(r["to"])}'
            od = (r['on_delete'] or '').upper()
            ck = t.pk if t.pk and all(returned(t, x) for x in t.pk) else None
            body = [f'$p = {pf}();', f"$row = {f}([{php_str(c)} => $p[{php_str(rc)}]]);"]
            if ck:
                body.append(f"$q = fn () => DB::table({php_str(t.name)})->where(array_intersect_key($row, array_flip({json_like(ck)})));")
            delete = f"DB::table({php_str(r['to'])})->where({php_str(rc)}, $p[{php_str(rc)}])->delete()"
            if not ck and od in ('CASCADE', 'SET NULL'):
                add(f"ON DELETE {od} {r['name']}", [], 'enfant sans cle primaire fabriquee : non retrouvable apres la suppression')
            elif od == 'CASCADE':
                add(f"ON DELETE CASCADE {r['name']} supprime l'enfant",
                    body + ['$this->assertTrue($q()->exists());', delete + ';', '$this->assertFalse($q()->exists());'])
            elif od == 'SET NULL':
                # l'enfant doit EXISTER encore (sinon un CASCADE passerait pour un SET NULL)
                add(f"ON DELETE SET NULL {r['name']} vide la FK",
                    body + [delete + ';', '$this->assertTrue($q()->exists());', f"$this->assertNull($q()->value({php_str(c)}));"])
            elif od in ('RESTRICT', 'NO ACTION'):
                add(f"ON DELETE {od} {r['name']} bloque la suppression du parent", body + refus('fkparent', delete))
    return out


def json_like(cols):
    return '[' + ', '.join(php_str(c) for c in cols) + ']'


def render_tests(cs, style, trait, sha):
    head = ['<?php', '', f'// Genere par cdc_dbtests.py depuis model.json (sha256 {sha}). Ne pas modifier : regenerer.',
            '// Rouge : ecart entre la base et son schema declare (le rapporter), ou limite du generateur (CHECK : voir',
            '// cdc_dbtests.py). Jamais d\'assertion ajustee a la main.', '']
    if style == 'pest':
        out = head + [f'use Illuminate\\Foundation\\Testing\\{trait};', 'use Illuminate\\Support\\Facades\\DB;',
                      'use Tests\\Cdc\\Database\\CdcRows;', 'use Tests\\TestCase;', '', f'uses(TestCase::class, {trait}::class);', '']
        for tid, title, body, skip in cs:
            name = php_str(f'{tid} {title}')
            if skip:
                out.append(f"it({name})->skip({php_str(skip)});")
            else:
                out.append(f'it({name}, function () {{')
                out += ['    ' + l for l in body]
                out.append('});')
            out.append('')
        return '\n'.join(out) + '\n'
    out = head + ['namespace Tests\\Cdc\\Database;', '', f'use Illuminate\\Foundation\\Testing\\{trait};',
                  'use Illuminate\\Support\\Facades\\DB;', 'use Tests\\TestCase;', '',
                  'final class CdcDatabaseTest extends TestCase', '{', f'    use {trait};', '']
    seen = set()
    for tid, title, body, skip in cs:
        table, num = re.match(r'T-BDD-(.*)-(\d+)$', tid).groups()
        meth = f'test_{ident(table)}_{num}'
        assert meth not in seen, meth
        seen.add(meth)
        out.append(f'    /** {doc(tid + " " + title)} */')
        out.append(f'    public function {meth}(): void')
        out.append('    {')
        out += ['        ' + l for l in (body if not skip else [f'$this->markTestSkipped({php_str(skip)});'])]
        out.append('    }')
        out.append('')
    out.append('}')
    return '\n'.join(out) + '\n'


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) if '=' in a else (a[2:], True) for a in argv if a.startswith('--'))
    for i, a in enumerate(argv):  # --trait X / --style X en deux mots
        if a in ('--trait', '--style') and i + 1 < len(argv):
            opts[a[2:]] = argv[i + 1]
            args = [x for x in args if x != argv[i + 1]]
    if len(args) != 2 or opts.get('trait') not in TRAITS:
        sys.exit(__doc__ + f'\n--trait requis : {" | ".join(TRAITS)} (celui des tests existants du projet ; sinon demander)')
    model_path, repo = args
    raw = open(model_path, 'rb').read()
    model = json.loads(raw)
    comp_path = os.path.join(repo, 'composer.json')
    comp = json.load(open(comp_path, encoding='utf-8')) if os.path.exists(comp_path) else {}
    if 'laravel/framework' not in comp.get('require', {}):
        sys.exit(f'cdc_dbtests: {repo} n\'est pas un projet Laravel (composer.json sans laravel/framework)')
    if comp.get('autoload-dev', {}).get('psr-4', {}).get('Tests\\') not in ('tests/', 'tests'):
        sys.exit('cdc_dbtests: autoload-dev sans "Tests\\\\": "tests/" : Tests\\Cdc\\Database\\CdcRows ne serait pas charge')
    style = opts.get('style') or ('pest' if 'pestphp/pest' in {**comp.get('require', {}), **comp.get('require-dev', {})} else 'phpunit')
    if style not in ('pest', 'phpunit'):
        sys.exit('cdc_dbtests: --style pest|phpunit')
    tables = {n: Table(t, model['relations']) for n, t in model['tables'].items()}
    order_and_cycles(tables)
    sha = hashlib.sha256(raw).hexdigest()
    cs = cases(tables)
    out_dir = os.path.join(repo, 'tests', 'Cdc', 'Database')
    files = {os.path.join(out_dir, 'CdcRows.php'): rows_class(tables, sha),
             os.path.join(out_dir, 'CdcDatabaseTest.php'): render_tests(cs, style, opts['trait'], sha)}
    for p in files:
        if os.path.exists(p) and not opts.get('force'):
            sys.exit(f'cdc_dbtests: {p} existe deja (--force pour regenerer), rien ecrit')
    os.makedirs(out_dir, exist_ok=True)
    for p, text in files.items():
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
    skipped = [c for c in cs if c[3]]
    print(f'cdc_dbtests: {len(cs)} test(s) {style} ({len(skipped)} sautes) dans {out_dir}')
    for tid, title, _, why in skipped:
        print(f'  saute {tid} {title} : {why}')


if __name__ == '__main__':
    main(sys.argv[1:])
