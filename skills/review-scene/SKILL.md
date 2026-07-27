---
name: review-scene
description: |
  Vérifie voix, continuité, dispositif et calibrage d'une scène ou d'un chapitre. BRIEF-first : lit creation/BRIEF.md + CONTINUITE.md, guides optionnels seulement s'ils existent et sont remplis.
  TRIGGER when: "review-scene", "vérifie la scène", "contrôle la voix", "est-ce que la voix est bonne", "vérifie la cohérence"
allowed-tools: Read, Glob, Grep, Bash
---

# Skill : review-scene
# Invocation : /review-scene [fichier | dossier | (vide = git diff)]

> **NE JAMAIS MODIFIER les fichiers narratifs.** Rapport uniquement.

**Scope :** $ARGUMENTS

## Étapes

1. **Résoudre le scope** :
   - Fichier précis → lire ce fichier
   - Dossier → lire les fichiers narratifs dedans
   - Vide → `git diff --name-only HEAD 2>/dev/null`

2. **Charger les références (BRIEF-first)** :
   - `~/.claude/creation-templates/PRINCIPES-ECRITURE.md` → toujours
   - `creation/BRIEF.md` → toujours (voix, format, règles absolues, section Intégration)
   - `creation/CONTINUITE.md` → toujours si présent
   - `creation/NSFW.md` → si la scène contient de l'intime
   - Guides `creation/optionnels/` → uniquement s'ils existent ET ne contiennent pas
     "[à remplir]" (un template vide ne fait pas foi — ne jamais s'y référer)

3. **Vérifier :**
   - **Voix** : patterns du BRIEF respectés, contre-exemples absents, voix différenciées
     (test : chaque réplique attribuable à un seul personnage)
   - **Continuité** : pas de contradiction avec BRIEF/CONTINUITE, phrases canoniques correctes
   - **Dispositif** : cohérence présentiel/distance, qui est où, plausibilité physique
   - **Cohérence interne** : pas de changement d'état incohérent, ellipses signalées,
     timestamps croissants (si moteur)
   - **Calibrage** : volume vs cible de la section Intégration (NSFW : plancher ~500 ±20 %
     sauf dérogation actée) ; test anti-padding sur les passages faibles
   - **Si NSFW** : consentement montré (safeword/opt-in/recheck/aftercare), intensité conforme
     à la courbe de l'arc, montée ~50 % avant l'explicite

4. **Rapport :**

```
## /review-scene [scope]

### Voix
[violations ou "RAS"]

### Continuité / canon
[contradictions ou "RAS"]

### Dispositif / cohérence interne
[incohérences ou "RAS"]

### Calibrage (volume, structure)
[écarts ou "RAS"]

### NSFW (si applicable)
[écarts consentement/courbe ou "RAS"]
```

Si tout propre : `RAS — scène cohérente avec le BRIEF et le canon.`
