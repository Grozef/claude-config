---
name: laravel
description: |
  Génération de code Laravel (PHP 8.2+, PSR-12). Controllers, models, migrations, services, policies, jobs.
  TRIGGER when: demande de code PHP/Laravel — controller, model, migration, service, middleware, form request, job, event, policy
---

# Skill : Génération Laravel

## Déclenchement
Quand l'utilisateur demande de générer du code Laravel : controller, model, migration, service, policy, form request, job, event, listener, middleware, etc.

## Contexte requis avant d'agir
Si manquant, demander en une seule fois :
1. Version Laravel (10 / 11 / autre)
2. Type d'artefact à générer
3. Contexte métier minimal (nom de la ressource, relations clés)
4. Conventions du projet visibles (API Resource ? Repository pattern ? Actions ?)

## Standards appliqués automatiquement

### Général
- PHP 8.2+ : types stricts, enums, readonly properties si pertinent
- PSR-12 strict
- Pas de `mixed` si évitable
- Injection de dépendances via constructeur, pas de facades dans les services

### Controllers
- Thin controllers : logique dans services/actions
- Form Request pour toute validation
- API Resource pour toute réponse JSON
- Un seul `try/catch` au niveau du controller si nécessaire

### Models
- `$fillable` explicite (jamais `$guarded = []`)
- Relations typées avec return type hints
- Scopes nommés en `scope[Nom]`
- Accessors/mutators avec `Attribute::make()`

### Migrations
- `->comment()` sur les colonnes non évidentes
- Index explicites sur les foreign keys et colonnes filtrées fréquemment
- Down method toujours présent et correct

### Services / Actions
- Une responsabilité par classe
- Retour typé strict (jamais `array` si une DTO/Resource est possible)

## Format de sortie
```php
// fichier: app/Http/Controllers/[Nom]Controller.php
<?php
// code complet du fichier généré
```

Si plusieurs fichiers : les séparer par `---` avec le chemin en en-tête.

## Ce qui n'est pas inclus sauf si demandé
- Tests (demander `/debug` ou spécifier "avec tests")
- Seeders
- Factories
