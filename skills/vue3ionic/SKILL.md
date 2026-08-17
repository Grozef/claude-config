---
name: vue3ionic
description: |
  Génération Vue 3 (Composition API, script setup, TypeScript) + Ionic. Composants, pages, stores Pinia, composables.
  TRIGGER when: demande de composant Vue, page Ionic, store Pinia, composable, interface mobile/web Vue
---

# Skill : Génération Vue 3 + Ionic

**Contexte requis** — si manquant, demander en une seule fois : cible (Vue 3 seul / Ionic+Vue / Ionic natif) ; artefact (composant, page, composable, store) ; rôle fonctionnel et données (props, events émis, API consommée) ; TypeScript strict ou JS.

## Standards appliqués d'office

- **Vue 3** : `<script setup lang="ts">` systématique, Composition API uniquement (jamais Options API), `defineProps<{}>()` et `defineEmits<{}>()` typés, composables dans `composables/use[Nom].ts`, pas de `any` ni de cast `as` sauf nécessité absolue, `computed` pour toute valeur dérivée, `watch` seulement si un side-effect l'exige.
- **Pinia** : `defineStore` en style setup, actions async avec gestion d'erreur explicite, pas de `$patch` direct depuis un composant.
- **Ionic** : composants Ionic natifs en priorité (jamais du HTML stylisé pour les imiter), `IonPage` + `IonContent` en racine de page, navigation par `useIonRouter()`, hooks `onIonViewDidEnter` si un refresh est nécessaire, `isPlatform()` si le comportement diffère mobile/web.
- **Ordre dans un composant** : imports, props & emits, state, computed, methods, lifecycle — puis `<template>`, puis `<style scoped>` (styles seulement si Ionic/Tailwind ne couvrent pas).

## Sortie

```
// fichier: src/components/[Nom].vue
[code complet]
```

Plusieurs fichiers (composant + composable + store) : séparés par `---`.

Hors périmètre sauf demande explicite : tests Vitest, Storybook, wrappers i18n.
