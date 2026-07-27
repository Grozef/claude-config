---
name: refactor
description: |
  Refactoring ciblé. Blocs modifiés uniquement, marqueurs de position inclus.
  TRIGGER when: "refactorise", "simplifie", "nettoie", "réorganise", "réécris ça", "améliore ce code"
---

# Skill : Refactoring

## Déclenchement
Quand l'utilisateur demande de refactoriser, simplifier, réorganiser ou nettoyer du code.

## Contexte requis avant d'agir
Si manquant, demander en une seule fois :
1. Le code source (coller ou indiquer le fichier)
2. L'objectif du refactoring : lisibilité / performance / découplage / autre ?
3. Contraintes : garder la signature publique ? compatibilité version ? tests existants à respecter ?

## Processus interne (ne pas afficher)
- Identifier les seuls blocs qui changent réellement
- Ne pas restructurer ce qui n'est pas dans le scope demandé
- Conserver le style de nommage existant sauf si c'est le problème à corriger

## Format de sortie

Uniquement les blocs modifiés :

```php
// fichier: path/to/File.php  ~ligne 45
// AVANT → supprimé
// APRÈS ↓
public function refactoredMethod(Type $param): ReturnType
{
    // nouveau code seulement
}
```

Si plusieurs emplacements modifiés, les séparer par `---`.

Si un bloc est déplacé vers un nouveau fichier, indiquer :
```
// NOUVEAU fichier: path/to/NewService.php
```

## Règles
- Jamais de code inchangé en sortie
- Si le refactoring implique plus de 5 fichiers : demander confirmation du périmètre avant de continuer
- Si une modification casse une interface publique : le signaler en `[ATTENTION]` avant le code
