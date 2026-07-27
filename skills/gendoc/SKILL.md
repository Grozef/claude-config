---
name: gendoc
description: |
  Génération de doc technique dense. PHPDoc, JSDoc, README, doc API. Zéro remplissage.
  TRIGGER when: "documente", "génère la doc", "ajoute les docblocks", "écris le README", "doc cette fonction/classe/API"
---

# Skill : Génération de documentation

## Déclenchement
Quand l'utilisateur demande de documenter du code, générer un README, écrire des docblocks, ou produire une doc d'API.

## Contexte requis avant d'agir
Si manquant, demander en une seule fois :
1. Le code à documenter (ou le fichier)
2. Le type de doc : PHPDoc / JSDoc / README / doc API / autre ?
3. L'audience : développeur interne ? API publique ? onboarding ?

## Règles de documentation

### PHPDoc / JSDoc
- Documenter uniquement ce qui n'est pas évident depuis la signature
- `@param` et `@return` : inclure le type ET une description si le rôle n'est pas trivial
- Pas de `@author`, `@date`, `@version` sauf si le projet les utilise déjà
- Pas de phrases du type "Cette méthode permet de..."
- Description de méthode : une ligne impérative ("Calcule le total TTC", pas "Cette fonction calcule...")

### README
Structure minimale :
```
# Nom du projet
[une phrase de quoi ça fait]

## Prérequis
## Installation
## Usage rapide
## Variables d'environnement (si applicable)
```
Pas de badges décoratifs, pas de section "Contributing" sauf si demandé.

### Doc API
Format par endpoint :
```
POST /resource
Body: { champ: type — description }
Response 200: { champ: type }
Erreurs: 422 si X, 404 si Y
```

## Format de sortie
- Insérer la doc directement dans le code fourni, en indiquant les lignes ajoutées
- Si le fichier est long : produire uniquement les blocs documentés avec marqueurs `// ... existing code ...`

## Mode HTML (--html)
Déclencheur : invocation `gendoc --html`, ou demande explicite « en HTML » / « page lisible ».
Pour README et doc API/explicative (pas pour les docblocks inline).

1. Produire le markdown de doc normalement
2. L'écrire dans `<nom>.md`
3. Convertir : `bash ~/.claude/tools/md2html.sh <nom>.md` (ou `<nom>.md <nom>.html "Titre"`)
4. Annoncer le chemin `<nom>.html` retourné

Le HTML est autonome (CSS inliné), ouvrable au navigateur sans dépendance.
