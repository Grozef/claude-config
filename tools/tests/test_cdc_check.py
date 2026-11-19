"""Tests de cdc_check.py : un CDC conforme construit depuis la VRAIE trame (+ cdc_fiches.py), puis une mutation par
controle ; chaque mutation doit produire son constat, et le CDC conforme aucun ERREUR."""
import hashlib
import json
import os
import re
import sys

import pytest

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, '..'))
import cdc_check  # noqa: E402
import cdc_fiches  # noqa: E402
import cdc_manifest  # noqa: E402

# relatif au depot (tools/tests -> skills/cdc) : un clone ailleurs teste SA trame
TRAME = os.path.normpath(os.path.join(HERE, '..', '..', 'skills', 'cdc', 'trames', 'trame-modele.md'))


def set_rows(text, heading, rows, fiche=None):
    """Remplace les lignes du 1er tableau sous `heading` (dans la fiche `fiche` si donnee)."""
    start = 0
    if fiche:
        start = text.index(f'# Annexe A — {fiche} :')
    i = text.index('\n' + heading, start)
    sep = re.compile(r'^\|[\s|:-]+\|\s*$', re.M).search(text, i)
    j = text.index('\n', sep.start()) + 1
    k = j
    while text.startswith('|', k):
        k = text.index('\n', k) + 1
    return text[:j] + ''.join(r + '\n' for r in rows) + text[k:]


@pytest.fixture
def cdc(tmp_path):
    md = tmp_path / 'cahier-des-charges.md'
    md.write_text(open(TRAME, encoding='utf-8').read(), encoding='utf-8')
    t = md.read_text(encoding='utf-8')
    t = set_rows(t, '# 5. Acteurs', ['| Inspecteur | Terrain | Tout | Mobile |', '| Administrateur | Catalogue | Tout | Web |'])
    t = set_rows(t, '## 6.2 ', ['| F1 | Connexion | Se connecter | Must | v1 |', '| F2 | Catalogue | Gerer | Should | v1 |'])
    t = set_rows(t, '## 6.3 ', [
        "| US-01 | En tant qu'inspecteur, je veux me connecter afin de travailler | F1 | Connecte |",
        "| US-02 | En tant qu'administrateur, je veux gerer le catalogue afin de le tenir a jour | F2 | Liste a jour |"])
    t = set_rows(t, '## 6.4 ', ['| RG-01 | Compte inactif refuse | F1 |', '| RG-02 | Nom unique | F2 |'])
    t = set_rows(t, '# 12. ', ['| R-01 | Parcours | OK | F1, F2 |'])
    md.write_text(t, encoding='utf-8')
    cdc_fiches.main(TRAME, str(md), ['F1=Connexion', 'F2=Catalogue'])
    t = md.read_text(encoding='utf-8')
    t = set_rows(t, '### A.2 ', ["| US-01 | Se connecter | Connecte |"], 'F1')
    t = set_rows(t, '### A.3 ', ['| RG-01 | Compte inactif | 403 |'], 'F1')
    t = set_rows(t, '### A.9 ', ['| T-F1-01 | Connexion valide (US-01) | 200 | API |',
                                 '| T-F1-02 | Compte inactif (RG-01) | 403 | API |'], 'F1')
    t = set_rows(t, '### A.2 ', ["| US-02 | Gerer | Liste |"], 'F2')
    t = set_rows(t, '### A.9 ', ['| T-F2-01 | Ajout (US-02, RG-02) | 201 | API |'], 'F2')
    md.write_text(t, encoding='utf-8')
    return md


def run(md):
    return cdc_check.run(str(md), TRAME)


def errors(md):
    return [x['message'] for x in run(md).items if x['niveau'] == 'ERREUR']


def warns(md):
    return [x['message'] for x in run(md).items if x['niveau'] == 'AVERT']


def mutate(md, old, new, count=1):
    t = md.read_text(encoding='utf-8')
    assert t.count(old) >= 1, old
    md.write_text(t.replace(old, new, count), encoding='utf-8')


def test_cdc_conforme_sans_erreur(cdc):
    assert errors(cdc) == []
    assert warns(cdc) == []


def test_trame_vierge_sans_erreur_de_reference():
    rep = cdc_check.run(TRAME, TRAME)
    assert [x for x in rep.items if x['niveau'] == 'ERREUR'] == []


def test_titre_absent(cdc):
    mutate(cdc, '## 9.3 Conservation et archivage\n', '')
    assert any('titre absent' in e and 'conservation' in e for e in errors(cdc))


def test_ordre_des_titres(cdc):
    t = cdc.read_text(encoding='utf-8')
    a, b = t.index('# 13. Organisation'), t.index('# 14. Risques')
    c = t.index('# 15. Maintenance')
    cdc.write_text(t[:a] + t[b:c] + t[a:b] + t[c:], encoding='utf-8')
    assert any('ordre des titres' in e for e in errors(cdc))


def test_section_hors_trame(cdc):
    mutate(cdc, '# 16. Questions ouvertes', '# 15bis. Bonus\n\n# 16. Questions ouvertes')
    assert any('hors trame' in w for w in warns(cdc))


def test_sous_titre_de_fiche_manquant(cdc):
    t = cdc.read_text(encoding='utf-8')
    i = t.index('# Annexe A — F2 :')
    cdc.write_text(t[:i] + t[i:].replace('### A.6 Écrans\n', '', 1), encoding='utf-8')
    found = [x for x in run(cdc).items if x['niveau'] == 'ERREUR' and x['ou'] == 'fiche F2']
    assert found and 'sous-titres' in found[0]['message'] and "'A.5 API', \"A.7" in found[0]['message']


def test_separateur_modifie(cdc):
    mutate(cdc, '| ID | User story | Fonctionnalité | Critère d\'acceptation |\n|----------|',
           '| ID | User story | Fonctionnalité | Critère d\'acceptation |\n|---|')
    assert any('separateur modifie' in e for e in errors(cdc))


def test_en_tete_modifie(cdc):
    mutate(cdc, '| # | Règle | Fonctionnalité |', '| # | Règle | Module |')
    assert any('en-tete' in e for e in errors(cdc))


def test_colonnes_de_roles_libres(cdc):
    # A.7 : deux roles au lieu de trois colonnes [Rôle n] : admis.
    t = cdc.read_text(encoding='utf-8')
    i = t.index('# Annexe A — F1 :')
    j = t.index('### A.7', i)
    k = t.index('### A.8', j)
    a7 = ('### A.7 Droits d\'accès\n\n| Action | Inspecteur | Administrateur |\n'
          '|--------------------------------------|---------------------|---------------------|\n| Lire | Oui | Oui |\n\n')
    cdc.write_text(t[:j] + a7 + t[k:], encoding='utf-8')
    assert errors(cdc) == []


def test_f_sans_fiche_et_fiche_sans_f(cdc):
    mutate(cdc, '# Annexe A — F2 : Catalogue', '# Annexe A — F9 : Catalogue')
    e = errors(cdc)
    assert any('F2 de 6.2 sans fiche' in x for x in e)
    assert any('fiche F9 absente de 6.2' in x for x in e)


def test_nom_de_fiche_different(cdc):
    mutate(cdc, '# Annexe A — F2 : Catalogue', '# Annexe A — F2 : Referentiel')
    assert any('Referentiel' in w for w in warns(cdc))


def test_us_vers_f_inexistante_et_sans_f(cdc):
    mutate(cdc, 'afin de travailler | F1 |', 'afin de travailler | F7 |')
    mutate(cdc, 'tenir a jour | F2 |', 'tenir a jour | |')
    e = errors(cdc)
    assert any('US-01 cite F7' in x for x in e)
    assert any('US US-02 sans fonctionnalite' in x for x in e)


def test_f_sans_us(cdc):
    mutate(cdc, 'tenir a jour | F2 |', 'tenir a jour | F1 |')
    assert any('F2 sans user story' in x for x in errors(cdc))


def test_id_en_double(cdc):
    mutate(cdc, '| RG-02 | Nom unique | F2 |', '| RG-01 | Nom unique | F2 |')
    assert any('RG-01 en double' in x for x in errors(cdc))


def test_scenario_de_recette_vers_f_inexistante(cdc):
    mutate(cdc, '| R-01 | Parcours | OK | F1, F2 |', '| R-01 | Parcours | OK | F1, F5 |')
    assert any('R-01 cite F5' in x for x in errors(cdc))


def test_role_inconnu(cdc):
    mutate(cdc, "En tant qu'inspecteur,", "En tant que comptable,")
    assert any('comptable' in w for w in warns(cdc))


def test_us_de_fiche_absente_ou_mal_rattachee(cdc):
    mutate(cdc, "| US-01 | Se connecter | Connecte |", "| US-02 | Se connecter | Connecte |")
    assert any('US-02 rattachee' in x and 'pas a F1' in x for x in errors(cdc))
    mutate(cdc, "| US-02 | Se connecter | Connecte |", "| US-09 | Se connecter | Connecte |")
    assert any('US-09 absente de 6.3' in x for x in errors(cdc))


def test_rg_de_fiche_mal_rattachee(cdc):
    mutate(cdc, '| RG-01 | Compte inactif | 403 |', '| RG-02 | Compte inactif | 403 |')
    assert any('RG-02 rattachee' in x for x in errors(cdc))


def test_numerotation_locale_admise(cdc):
    mutate(cdc, '| RG-01 | Compte inactif | 403 |', '| 1 | Compte inactif | 403 |')
    assert errors(cdc) == []


def test_tests_id_double_mauvaise_fiche_ref_inconnue(cdc):
    mutate(cdc, '| T-F1-02 | Compte inactif (RG-01) |', '| T-F1-01 | Compte inactif (RG-01) |')
    assert any('T-F1-01 en double' in x for x in errors(cdc))
    mutate(cdc, '| T-F2-01 | Ajout (US-02, RG-02) |', '| T-F1-09 | Ajout (US-02, RG-07) |')
    e = errors(cdc)
    assert any('T-F1-09 dans la fiche F2' in x for x in e)
    assert any('cite RG-07' in x for x in e)


def test_couverture_des_tests(cdc):
    mutate(cdc, '| T-F2-01 | Ajout (US-02, RG-02) |', '| T-F2-01 | Ajout (US-02) |')
    assert any('RG-02 couverte par aucun test' in x for x in errors(cdc))


def test_sans_plan_t_pas_de_couverture_exigee(cdc):
    t = re.sub(r'T-F\d-\d\d', '1', cdc.read_text(encoding='utf-8'))
    cdc.write_text(t, encoding='utf-8')
    assert errors(cdc) == []


def test_lien_de_diagramme_absent(cdc):
    mutate(cdc, '## 9.1 Modèle de données\n', '## 9.1 Modèle de données\n\n![BDD](cahier-des-charges-diagrams/bdd.png)\n')
    assert any('bdd.png introuvable' in x for x in errors(cdc))
    d = cdc.parent / 'cahier-des-charges-diagrams'
    d.mkdir()
    (d / 'bdd.png').write_bytes(b'png')
    assert errors(cdc) == []


def test_diagramme_perime(cdc):
    # manifeste ecrit par son producteur reel (cdc_manifest), pas fabrique par le test
    d = cdc.parent / 'cahier-des-charges-diagrams'
    d.mkdir()
    src = d / 'bdd.model.json'
    src.write_bytes(b'{"a": 1}')
    (d / 'bdd.png').write_bytes(b'png')
    cdc_manifest.record(str(cdc), 'bdd', 'db', 'cahier-des-charges-diagrams/bdd.model.json', '9.1', ['cahier-des-charges-diagrams/bdd.png'])
    man = json.loads((d / 'manifest.json').read_text(encoding='utf-8'))
    assert man['diagrams'][0]['sha256'] == hashlib.sha256(b'{"a": 1}').hexdigest()
    assert warns(cdc) == []
    src.write_bytes(b'{"a": 2}')
    assert any('perime' in w for w in warns(cdc))
    # re-enregistrement : l'entree du meme nom est remplacee, l'avertissement disparait
    cdc_manifest.record(str(cdc), 'bdd', 'db', 'cahier-des-charges-diagrams/bdd.model.json', '9.1')
    assert len(json.loads((d / 'manifest.json').read_text(encoding='utf-8'))['diagrams']) == 1
    assert warns(cdc) == []


def test_manifeste_mal_forme_sans_exception(cdc):
    d = cdc.parent / 'cahier-des-charges-diagrams'
    d.mkdir()
    for bad in ('[]', '{"diagrams": [1]}', '{"diagrams": 3}', '{'):
        (d / 'manifest.json').write_text(bad, encoding='utf-8')
        assert any('manifest.json illisible' in e for e in errors(cdc))


def test_en_tete_vide_de_tableau_de_roles_sans_exception(cdc):
    t = cdc.read_text(encoding='utf-8')
    i = t.index('# Annexe A — F1 :')
    j = t.index('### A.7', i)
    k = t.index('### A.8', j)
    cdc.write_text(t[:j] + "### A.7 Droits d'accès\n\n|\n|----|\n| Lire |\n\n" + t[k:], encoding='utf-8')
    assert any('1re colonne «  »' in e for e in errors(cdc))  # en-tete sans cellule : constat, pas d'exception
    cdc.write_text(t[:j] + "### A.7 Droits d'accès\n\n| Acteur | Inspecteur |\n|----|----|\n| Lire | Oui |\n\n" + t[k:], encoding='utf-8')
    assert any('1re colonne « Acteur »' in e for e in errors(cdc))


def test_doublons_de_f_d_us_et_de_fiche(cdc):
    mutate(cdc, '| F2 | Catalogue | Gerer | Should | v1 |', '| F2 | Catalogue | Gerer | Should | v1 |\n| F2 | Bis | x | | |')
    mutate(cdc, "| US-02 | En tant qu'administrateur", "| US-01 | En tant qu'administrateur")
    e = errors(cdc)
    assert any('F2 en double' in x for x in e) and any('US-01 en double' in x for x in e)


def test_fiche_en_double_sans_plan_de_tests(cdc):
    t = re.sub(r'T-F\d-\d\d', '1', cdc.read_text(encoding='utf-8'))
    i = t.index('```{=openxml}', t.index('# Annexe A — F1 :') - 80)
    j = t.index('# Annexe A — F2 :')
    block = t[i:j]
    cdc.write_text(t + '\n' + block.replace('F1 : Connexion', 'F2 : Catalogue'), encoding='utf-8')
    assert any('fiche F2 en double' in x for x in errors(cdc))


def test_rg_de_fiche_absente_de_6_4(cdc):
    mutate(cdc, '| RG-01 | Compte inactif | 403 |', '| RG-09 | Compte inactif | 403 |')
    assert any('RG-09 absente de 6.4' in x for x in errors(cdc))


def test_regle_transverse_et_regle_sans_f(cdc):
    mutate(cdc, '| RG-02 | Nom unique | F2 |', '| RG-02 | Nom unique | F2 |\n| RG-03 | Journalisation | Toutes |\n| RG-04 | Archivage | [À COMPLÉTER] |')
    mutate(cdc, '| T-F2-01 | Ajout (US-02, RG-02) |', '| T-F2-01 | Ajout (US-02, RG-02, RG-03, RG-04) |')
    assert errors(cdc) == []
    w = warns(cdc)
    assert any('RG-04 sans fonctionnalite' in x for x in w)
    assert not any('RG-03' in x for x in w)  # « Toutes » = toutes les F, rien a signaler


def test_ligne_sans_barre_finale(cdc):
    mutate(cdc, '| RG-02 | Nom unique | F2 |', '| RG-02 | Nom unique | F2')
    assert errors(cdc) == [] and warns(cdc) == []  # la derniere cellule (F2) est lue


def test_sous_titre_dans_6_3_ne_casse_pas_les_us(cdc):
    mutate(cdc, '## 6.3 User stories\n', '## 6.3 User stories\n\n### Inspecteur\n')
    assert errors(cdc) == []
    assert any('hors trame' in w for w in warns(cdc))


def test_blocs_de_code_tilde_ignores(cdc):
    mutate(cdc, '# 16. Questions ouvertes', '~~~\n# pas un titre\n| a | b |\n|---|---|\n| F9 | x |\n~~~\n\n# 16. Questions ouvertes')
    assert errors(cdc) == [] and warns(cdc) == []


def test_us_citee_dans_le_resultat_attendu(cdc):
    mutate(cdc, '| T-F2-01 | Ajout (US-02, RG-02) | 201 |', '| T-F2-01 | Ajout (RG-02) | 201 (US-02) |')
    assert errors(cdc) == []


def test_role_sans_virgule(cdc):
    mutate(cdc, "En tant qu'inspecteur, je veux", "En tant que comptable je veux")
    assert any('comptable' in w for w in warns(cdc))


def test_liens_avec_titre_et_point_slash(cdc):
    mutate(cdc, '## 9.1 Modèle de données\n', '## 9.1 Modèle de données\n\n![a](cahier-des-charges-diagrams/a.png "Titre")\n[b](./cahier-des-charges-diagrams/b.html)\n')
    e = errors(cdc)
    assert any('a.png introuvable' in x for x in e) and any('b.html introuvable' in x for x in e)


def test_append_preserve_annexe_b_et_blocs_de_code(cdc):
    t = cdc.read_text(encoding='utf-8')
    cdc.write_text(t.rstrip('\n') + '\n\n```bash\n# installer\nmake\n```\n\n# Annexe B — Glossaire etendu\n\nTexte B.\n', encoding='utf-8')
    before = cdc.read_text(encoding='utf-8')
    cdc_fiches.main(TRAME, str(cdc), ['F3=Export'], 'append')
    after = cdc.read_text(encoding='utf-8')
    f3, b = after.index('# Annexe A — F3 : Export'), after.index('# Annexe B — Glossaire etendu')
    assert after.index('```bash\n# installer\nmake\n```') < f3 < b
    assert after.endswith('# Annexe B — Glossaire etendu\n\nTexte B.\n')
    # rien de l'existant n'est perdu : chaque ligne d'avant est encore la
    assert all(l in after for l in before.split('\n'))


def test_fiches_append_corrige_f_sans_fiche(cdc):
    mutate(cdc, '| F2 | Catalogue | Gerer | Should | v1 |', '| F2 | Catalogue | Gerer | Should | v1 |\n| F3 | Export | Exporter | | |')
    mutate(cdc, 'tenir a jour | F2 | Liste a jour |',
           "tenir a jour | F2 | Liste a jour |\n| US-03 | En tant qu'inspecteur, je veux exporter, afin de partager | F3 | [À COMPLÉTER] |")
    assert any('F3 de 6.2 sans fiche' in e for e in errors(cdc))
    cdc_fiches.main(TRAME, str(cdc), ['F3=Export'], 'append')
    t = cdc.read_text(encoding='utf-8')
    assert t.index('# Annexe A — F2 :') < t.index('# Annexe A — F3 : Export')
    assert not any('sans fiche' in e for e in errors(cdc))
    with pytest.raises(SystemExit):
        cdc_fiches.main(TRAME, str(cdc), ['F3=Export'], 'append')


def test_compte_des_a_completer(cdc):
    mutate(cdc, '| F1 | Connexion | Se connecter | Must | v1 |', '| F1 | Connexion | Se connecter | [À COMPLÉTER] | [À COMPLÉTER] |')
    infos = [x for x in run(cdc).items if x['niveau'] == 'INFO' and x['ou'].startswith('6.2')]
    assert infos and infos[0]['message'].startswith('2 ')
