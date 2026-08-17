---
name: laravel
description: |
  Génération de code Laravel (PHP 8.2+, PSR-12). Controllers, models, migrations, services, policies, jobs.
  TRIGGER when: demande de code PHP/Laravel — controller, model, migration, service, middleware, form request, job, event, policy
---

# Skill : Génération Laravel

**Contexte requis** — si manquant, demander en une seule fois : version Laravel (10/11/autre) ; artefact à générer ; contexte métier minimal (ressource, relations clés) ; conventions visibles du projet (API Resource ? Repository ? Actions ?).

## Standards appliqués d'office

- **Général** : PHP 8.2+ (types stricts, enums, readonly si pertinent), PSR-12 strict, pas de `mixed` évitable, injection par constructeur — pas de facades dans les services.
- **Controllers** : thin, logique en services/actions ; Form Request pour toute validation ; API Resource pour toute réponse JSON ; un seul `try/catch`, au niveau du controller, si nécessaire.
- **Models** : `$fillable` explicite (jamais `$guarded = []`), relations avec return type hints, scopes en `scope[Nom]`, accessors/mutators via `Attribute::make()`.
- **Migrations** : `->comment()` sur les colonnes non évidentes, index explicites sur les FK et les colonnes filtrées souvent, `down()` toujours présent et correct.
- **Services / Actions** : une responsabilité par classe, retour typé strict (jamais `array` si une DTO ou une Resource est possible).

## Sortie

```php
// fichier: app/Http/Controllers/[Nom]Controller.php
<?php
// code complet du fichier
```

Plusieurs fichiers : séparés par `---`, chemin en en-tête de chacun.

Hors périmètre sauf demande explicite : tests, seeders, factories.
