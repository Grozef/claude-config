# BRIEF — Guide opérationnel rapide
# [NOM DU PROJET] — mis à jour le YYYY-MM-DD via /update-brief

> Fichier PIVOT : suffit pour 90 % des tâches d'écriture. Max ~120 lignes, format dense.
> Mettre à jour via /update-brief après chaque session. Le canon détaillé vit dans CONTINUITE.md.
> Une section encore "[à remplir]" ne fait PAS foi — dans ce cas, s'appuyer sur le corpus réel.

---

## Personnages — voix

### [Nom] ([rôle technique : npc/hero/narrateur...]) — [métier / fonction narrative]
- Registre : [minuscules ? longueur de bulles/phrases ? direct/évasif ?]
- Emojis autorisés : [palette] · JAMAIS : [interdits durs]
- Ponctuation : [règles : points finaux, ?, ...]
- Patterns :
  ```
  V "[exemple canonique de réplique]"
  V "[deuxième exemple]"
  X "[contre-exemple : ce que ce perso ne dirait jamais]"
  ```

[Répéter par personnage. Règle : un dialogue attribuable à deux persos est mal écrit.]

---

## Format technique

[Format de sortie : prose libre / ScriptNode .ts / nodes.json / autre.
Si moteur : structure exacte d'un nœud, convention d'ID, types spéciaux (day/wave/media/choix).]

## Intégration (comment le contenu entre dans le projet)

- Commande d'inspection : [ex. `npx tsx tools/content-editor.ts list <arc> <chapter> <perso>` — ou "aucune : prose"]
- Commande d'insertion : [ex. `npx tsx tools/content-editor.ts insert ...` / `npm run edit -- replace <id> drafts/x.nodes.json`]
- Arborescence du contenu : [ex. `src/data/arcs/<arc>/<chapter>/<perso>.ts`]
- Edit direct autorisé : [NON si moteur+serializer / OUI si prose — préciser les fichiers]
- Cadence / calibrage volume : [ex. ~2,5-3 s/bulle -> 10 min = 200-250 bulles ; ou nb mots/page]
- Plancher scène NSFW : [ex. ~500 bulles ±20 % — ou n/a]

---

## Canon actuel (résumé — détail dans CONTINUITE.md)

[Nom] : [faits durs en 1 ligne]
[Nom] : [...]

Où en est l'histoire :
- [arc/chapitre en cours, dernier événement majeur]

Faits non résolus :
- [fils ouverts]

---

## Assets établis

| Série / fichier | Sujet |
|-----------------|-------|
| [à remplir]     |       |

---

## Règles absolues

- Choix narratifs (lieux, objets, dialogues, ambiance) -> demander AVANT de générer
- [contraintes dures propres au projet : timestamps croissants, perso hors-champ, spoiler à ne pas citer...]
- Aucune initiative sur les détails non spécifiés
