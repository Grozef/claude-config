---
name: todo
description: |
  Gere le toDo global du vault ($CLAUDE_VAULT/TODO.md) depuis n'importe quel projet : add / list / done, organise par projet avec tags [op]/[idee]/[revue].
  TRIGGER when: "/todo", "ajoute au todo", "mes taches en attente", "coche", "todo global"
allowed-tools: Read, Edit, Bash
effort: low
---

# Skill : todo
# Invocation : /todo [add|list|done] [args]

**Arguments fournis :** $ARGUMENTS

Fichier cible (chemin ABSOLU, jamais relatif au projet courant) :
`$CLAUDE_VAULT/TODO.md` — `$CLAUDE_VAULT` est injecté au démarrage par le hook `session-start`
(ligne `Vault : <chemin>`). Sans cette ligne, aucun vault n'est configuré : le dire et s'arrêter,
ne jamais inventer de chemin.

## Structure du fichier (depuis 2026-07-15 : organisation PAR PROJET)

- Un bloc `## Projets (index + chemins)` en tête : liste TOUS les projets + chemin réel (incl. hors-www). Reference, pas des taches.
- Puis un titre `## <projet>` par projet ayant des taches (ex `## projet-a`, `## projet-b`, `## carte / libelle-compose`).
- Item : `- [ ] [type] (YYYY-MM-DD) texte [[projet]]` — `type` ∈ {op, idee, revue}, placé juste après la case.
- Plus récent en haut de chaque bloc projet. Les `- [x]` (faits) restent sous leur projet.

## Règle commune

Toujours **Read** `TODO.md` avant tout Edit (never-assume : on agit sur la donnée réelle, pas sur
une structure supposée). Confirmer en UNE ligne dense. Pas de fioriture.

## Sous-commandes

### `add <projet> <type> "<texte>"`
`<type>` ∈ {op, idee, revue}. Exemple : `/todo add projet-a op "corriger le récap"`
1. Date du jour : `date +%Y-%m-%d` (Bash).
2. Read TODO.md. Chercher le titre `## <projet>` (insensible casse ; le projet peut avoir un
   libellé composé comme `## carte / libelle-compose` — matcher sur le mot-clé).
3. Si le titre existe : Edit, insérer `- [ ] [<type>] (YYYY-MM-DD) <texte> [[<projet>]]`
   **juste après** la ligne de titre (= plus récent en haut du projet).
4. Si le titre n'existe PAS : créer `## <projet>` + l'item, inséré **avant** la ligne `---` finale
   qui précède `#todo` (ou avant `## global` s'il existe). Vérifier au passage que le projet figure
   dans l'index en tête ; l'y ajouter (ligne `- <projet> — <chemin>`) s'il manque.
5. Confirmer : `Ajouté [projet-a/op] : corriger le récap`.

### `list [projet|type]`
Sans argument → tous les items non cochés, groupés par projet. Avec un nom de projet → seulement
ce projet. Avec un type (op|idee|revue) → seulement les items de ce type, tous projets.
1. Read TODO.md.
2. Afficher les items **non cochés** (`- [ ]`) numérotés par projet (repartir de 1 par projet),
   dans l'ordre du fichier. Ignorer les `- [x]`. Ignorer le bloc index.
3. Format dense :
   ```
   [projet-a]
   1. [op] (2026-07-14) verifier le graphe de la page resultats
   2. [op] (2026-07-04) phase 4 seuil T-5
   [projet-b]
   1. [op] (2026-07-05) rebasculer cypress.yml ref main
   ```
   Projet sans item non coché : ne pas l'afficher (il reste dans l'index).

### `done <projet> <n>`
Coche le n-ième item NON coché du projet. Exemple : `/todo done projet-b 1`
1. Read TODO.md.
2. Sous le titre `## <projet>`, compter les `- [ ]` ; cibler le n-ième.
3. Edit : remplacer son `- [ ]` par `- [x]` (laisser texte + tag de type en place).
4. Confirmer : `Fait [projet-b] 1 : rebasculer cypress.yml`.

### sans argument
Équivaut à `list` (tous les projets).

## Notes
- Ne jamais réécrire tout le fichier : Edit ciblé uniquement (préserve frontmatter, index, ordre, `[x]`).
- Le compteur op/idee/revue au démarrage (`session-start.js`) lit les tags `[type]` inline, pas les
  titres de section — ne pas retirer le tag de type d'un item.
- Purge optionnelle sur demande explicite ("nettoie le todo") : retirer les `- [x]` datés de plus
  de 30 jours. Ne jamais purger sans demande.
