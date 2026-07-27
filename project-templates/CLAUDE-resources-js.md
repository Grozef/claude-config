# Règles — Frontend Vue 3 + Ionic (resources/js/)

## Conventions
- Composition API uniquement (`<script setup lang="ts">`)
- Pas d'Options API
- Stores Pinia dans `stores/`, composables dans `composables/`
- Composants : PascalCase, un composant = un fichier
- Props typées avec defineProps<{}>(), emits avec defineEmits<{}>()

## Patterns attendus
- Logique réutilisable → composable, pas inline dans le composant
- Appels API via un service dédié (`services/api.ts`), pas directement dans les composants
- Ionic : utiliser les composants Ionic natifs, pas de div custom pour le layout mobile

## Skills actifs dans ce contexte
`/vue3ionic` `/debug` `/review`
