# Mode diagram — diagrammes d'un CDC

Lu par `SKILL.md` (garde-fous communs) ; appele seul (`/cdc diagram <type> <cdc.md> [cible]`) ou par `modes/generate.md` (Etape 3bis).

## Étape 3bis — Diagrammes archify (`cdc`, sauf `--no-diagrams`)

Après le remplissage. Un diagramme ne se dessine QUE depuis des faits déjà écrits dans le CDC : pas de faits -> pas de diagramme, et le dire dans la confirmation finale.

| Diagramme (type archify) | Faits requis | Inséré sous |
|---|---|---|
| `architecture` | lignes Architecture / Technologies / Intégrations de §8 | 8. Contraintes techniques et architecture |
| `workflow` (processus cible) | étapes de §6.1 | 6.1 Processus cible |
| `sequence` (UN flux clé) | routes A.5 de la fiche concernée | A.5 de cette fiche |
| `lifecycle` (UNE entité à statut) | statuts réels (migration, enum, doc) | 9.1 Modèle de données |

Par diagramme (`<dir>` = dossier du .md, `<stem>` = son nom sans .md, `A=~/.claude/skills/archify`) :
1. Écrire `<dir>/<stem>-diagrams/<nom>.json` selon le « Fast authoring path » de `$A/SKILL.md` (`meta.quality_profile: "showcase"`, libellés et `meta.legend.entries` dans la langue du CDC).
2. `node $A/bin/archify.mjs validate <type> <json> --quality showcase --json` (9 contrôles sur 9), réparer selon les diagnostics, puis `node $A/bin/archify.mjs deliver <type> <json> <dir>/<stem>-diagrams/<nom>.html --quality showcase --json`. Exit != 0 -> ne pas insérer, le signaler.
3. `node ~/.claude/tools/archify-snap.mjs <dir>/<stem>-diagrams/<nom>.html <dir>/<stem>-diagrams/<nom>.png`.
4. Lire le PNG (Read), puis insérer : `![<Titre>](<stem>-diagrams/<nom>.png)` + `[Version interactive](<stem>-diagrams/<nom>.html)`.

