---
name: vue3ionic
description: |
  Génération Vue 3 (Composition API, script setup, TypeScript) + Ionic. Composants, pages, stores Pinia, composables.
  TRIGGER when: demande de composant Vue, page Ionic, store Pinia, composable, interface mobile/web Vue
---

# Skill : Génération Vue 3 + Ionic

## Déclenchement
Quand l'utilisateur demande de générer un composant Vue 3, une page Ionic, un composable, un store Pinia, ou toute interface mobile/web avec ces frameworks.

## Contexte requis avant d'agir
Si manquant, demander en une seule fois :
1. Cible : Vue 3 seul / Ionic + Vue / Ionic mobile natif ?
2. Ce qu'on génère : composant / page / composable / store / autre
3. Rôle fonctionnel et données manipulées (props attendues, events émis, API consommée ?)
4. TypeScript strict ou JS ?

## Standards appliqués automatiquement

### Vue 3
- `<script setup lang="ts">` systématiquement
- Composition API uniquement (jamais Options API)
- Props via `defineProps<{}>()` avec types explicites
- Emits via `defineEmits<{}>()` typés
- Composables dans `composables/use[Nom].ts`
- Pas de `any`, pas de cast `as` sauf nécessité absolue
- `computed` pour toute valeur dérivée
- `watch` uniquement si side-effect nécessaire (préférer `computed`)

### Pinia
- `defineStore` avec Composition API style (`setup store`)
- Actions async avec gestion d'erreur explicite
- Pas de `$patch` direct depuis les composants

### Ionic
- Composants Ionic natifs en priorité (pas de HTML brut stylisé pour imiter Ionic)
- `IonPage` + `IonContent` comme racine de page
- Navigation via `useIonRouter()`
- Lifecycle hooks Ionic (`onIonViewDidEnter`) si besoin de refresh
- Platform check via `isPlatform()` si comportement différent mobile/web

### Structure d'un composant
```
<script setup lang="ts">
// imports
// props & emits
// state
// computed
// methods
// lifecycle
</script>

<template>
  <!-- template -->
</template>

<style scoped>
/* styles uniquement si non couverts par Ionic/Tailwind */
</style>
```

## Format de sortie
```
// fichier: src/components/[Nom].vue
[code complet]
```
Si plusieurs fichiers (composant + composable + store) : séparés par `---`.

## Ce qui n'est pas inclus sauf si demandé
- Tests unitaires (Vitest)
- Storybook
- i18n wrappers
