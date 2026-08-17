---
name: gendoc
description: |
  Génération de doc technique dense. PHPDoc, JSDoc, README, doc API. Zéro remplissage.
  TRIGGER when: "documente", "génère la doc", "ajoute les docblocks", "écris le README", "doc cette fonction/classe/API"
---

# Skill : Génération de documentation

**Contexte requis** — si manquant, demander en une seule fois : le code ou le fichier à documenter ; le type (PHPDoc, JSDoc, README, doc API) ; l'audience (dev interne, API publique, onboarding).

## Règles

- **Docblocks** : documenter uniquement ce que la signature ne dit pas. `@param`/`@return` avec type ET description si le rôle n'est pas trivial. Pas de `@author`/`@date`/`@version` sauf si le projet en utilise déjà. Description en une ligne impérative ("Calcule le total TTC"), jamais "Cette méthode permet de...".
- **README** — structure minimale, sans badges décoratifs ni section Contributing non demandée :
  ```
  # Nom du projet
  [une phrase de ce que ça fait]
  ## Prérequis
  ## Installation
  ## Usage rapide
  ## Variables d'environnement (si applicable)
  ```
- **Doc API**, par endpoint :
  ```
  POST /resource
  Body: { champ: type — description }
  Response 200: { champ: type }
  Erreurs: 422 si X, 404 si Y
  ```

## Sortie

Doc insérée directement dans le code fourni, lignes ajoutées signalées. Fichier long : uniquement les blocs documentés, avec `// ... existing code ...`.

**Mode `--html`** (ou « en HTML » / « page lisible ») — pour README et doc API, pas pour les docblocks inline : produire le markdown, l'écrire dans `<nom>.md`, convertir par `bash ~/.claude/tools/md2html.sh <nom>.md`, annoncer le chemin `<nom>.html` retourné. Le HTML est autonome (CSS inliné), ouvrable sans dépendance.
