# Type `class` — diagramme de classes UML

Lu par `../SKILL.md` (garde-fous communs). Commande : `bash ~/.claude/skills/dbschema/dbschema.sh diagram --model <f.json> --out <dossier> --name <NOM> [--title "..."]`.

## Modele JSON
```json
{"kind": "class", "title": "...",
 "classes": [{"name": "User", "stereotype": "abstract|interface|enum|...", "attributes": [{"visibility": "+|-|#|~", "name": "email", "type": "string"}],
              "methods": [{"visibility": "+", "name": "save", "params": "x: int", "returns": "bool"}]}],
 "relations": [{"from": "User", "to": "Model", "kind": "inheritance|realization|composition|aggregation|association|dependency",
                "mult_from": "1", "mult_to": "0..*", "label": "...", "navigable": true}],
 "groups": {"Domaine": ["User"]}}
```
Exemple complet : `~/.claude/skills/dbschema/tests/fixtures/class.model.json`.

## Sens des relations
- `inheritance` / `realization` : from = enfant, to = parent (triangle creux cote parent, parent dessine au-dessus ; realisation en pointilles).
- `composition` / `aggregation` : from = tout, to = partie (losange plein / creux cote tout).
- `association` : fleche ouverte vers `to` si `navigable` ; `dependency` : pointilles, fleche ouverte vers `to`.
- `mult_from` / `mult_to` : multiplicites aux extremites `from` / `to` ; `label` : au milieu.
- Auto-relation (from = to) : boucle tracee a cote de la classe.

## Regles du modele
- Enum : valeurs dans `attributes` (un seul compartiment) ; ses methodes eventuelles dans un second.
- `groups` : chaque groupe non vide, une classe dans un groupe au plus.
- Tout texte non vide, sans caractere de controle ; `kind` et relations limites aux valeurs ci-dessus.
- Modele invalide : code 2 et message, ni dossier de sortie cree ni livrable ecrit. Controles en echec : code 1, et les `<NOM>.html` / `.png` d'une execution precedente sont retires.

## Depuis le code
- Laravel / Eloquent : classe = modele de `app/Models` ; attributs depuis `$fillable`, `$casts`, migrations ; relations depuis `hasMany` / `hasOne` (composition ou association selon la doc, sinon association), `belongsTo`, `belongsToMany` (association `*` - `*`), `morphTo` (association) ; heritage depuis `extends` ; interfaces depuis `implements`.
- Autres langages : classes, interfaces, enums declares ; relations depuis les types des attributs et des parametres.
- Vue d'ensemble : classes metier seulement (pas les controleurs ni le framework) ; au-dela d'une vingtaine de classes, une vue par domaine (`groups`) ou par fonctionnalite.
