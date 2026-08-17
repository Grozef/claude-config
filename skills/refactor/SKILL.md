---
name: refactor
description: |
  Refactoring ciblé. Blocs modifiés uniquement, marqueurs de position inclus.
  TRIGGER when: "refactorise", "simplifie", "nettoie", "réorganise", "réécris ça", "améliore ce code"
---

# Skill : Refactoring

**Contexte requis** — si manquant, demander en une seule fois : le code source (collé ou fichier) ; l'objectif (lisibilité, performance, découplage) ; les contraintes (signature publique à garder ? compatibilité version ? tests existants ?).

**Interne, non affiché :** isoler les seuls blocs qui changent réellement ; ne rien restructurer hors du périmètre demandé ; conserver le style de nommage existant, sauf si c'est précisément ce qu'on corrige.

## Sortie — blocs modifiés uniquement

```php
// fichier: path/to/File.php  ~ligne 45
// AVANT → supprimé
// APRÈS ↓
public function refactoredMethod(Type $param): ReturnType
{
    // nouveau code seulement
}
```

Plusieurs emplacements : séparés par `---`. Bloc déplacé vers un nouveau fichier : l'annoncer par `// NOUVEAU fichier: path/to/NewService.php`.

## Règles

- Jamais de code inchangé en sortie.
- Plus de 5 fichiers touchés : demander confirmation du périmètre avant de continuer.
- Rupture d'une interface publique : la signaler en `[ATTENTION]` AVANT le code.
