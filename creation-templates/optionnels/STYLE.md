# STYLE — Règles formelles du projet
# [NOM DU PROJET]

> Règles techniques et formelles applicables à tout contenu du projet.
> Ce fichier se remplit en premier, avant d'avoir du contenu narratif.
> Une règle = une ligne. Pas de justification longue ici.

---

<!--
  INSTRUCTIONS POUR REMPLIR CE FICHIER
  ─────────────────────────────────────
  Section 1 : Format technique — spécifique à ton moteur / format de sortie
  Section 2 : Ponctuation et registre — par personnage ou par contexte
  Section 3 : Règles sur les éléments spéciaux (si applicable)
  Section 4 : Anti-patterns — liste courte des erreurs à éviter

  Supprimer les sections qui ne s'appliquent pas à ton projet.
  Garder ce fichier court et scannable — max 2-3 pages.
-->

---

## 1. Format de sortie

<!--
  Décrire le format dans lequel le contenu doit être produit.
  Exemples : ScriptNode TypeScript, JSON, Markdown, prose, Twine...
-->

**Format utilisé :** [nom du format — ex: ScriptNode TypeScript / prose Markdown / JSON / autre]

**Structure de base :**
```
[Exemple de structure vide dans ton format]
```

**Types de nœuds / blocs disponibles :**

| Type | Utilisation | Exemple |
|------|------------|---------|
| [Type 1] | [Quand l'utiliser] | [Exemple court] |
| [Type 2] | | |
| [Type 3] | | |

**Règles de nommage des IDs (si applicable) :**
```
Convention : [décrire la convention]
Exemple :   [montrer un exemple]
```

---

## 2. Ponctuation et registre par personnage

<!--
  Remplir un bloc par personnage ou groupe de personnages ayant le même registre.
  Être le plus précis possible — c'est ce qui différencie les voix.
-->

### [Personnage / groupe 1]
- Majuscules : [oui / non / première lettre uniquement]
- Point final : [toujours / jamais / seulement sur courtes phrases définitives]
- Style général : [formel / familier / mixte]
- Longueur des phrases : [très courtes / moyennes / longues]

### [Personnage / groupe 2]
- Majuscules : [...]
- Point final : [...]
- Style : [...]

---

## 3. Règles sur les éléments spéciaux

<!--
  Remplir uniquement si ton projet utilise ces éléments.
  Supprimer les sections inutiles.
-->

### Images / médias (si applicable)
- [Règle 1]
- [Règle 2]

### Flags / variables d'état (si applicable)
- [Règle sur la gestion des flags]
- [Règle sur la cohérence des états]

### Choix / embranchements (si applicable)
- [Règle sur la formulation des choix]
- [Règle sur le nombre de choix par nœud]

### Transitions / séparateurs
- [Comment indiquer un changement de temps]
- [Comment indiquer un changement de lieu]
- [Comment indiquer une ellipse narrative]

---

## 4. Règles de cohérence temporelle

<!--
  Si ton projet a une chronologie ou des timestamps.
-->

- [Règle sur la progression temporelle]
- [Règle sur les retours en arrière]
- [Règle sur les ellipses]

---

## 5. Anti-patterns — ce qu'il ne faut jamais faire

<!--
  Liste courte et directe. Maximum 15 lignes.
  Format : ✗ [l'anti-pattern]
-->

```
✗ [Anti-pattern 1]
✗ [Anti-pattern 2]
✗ [Anti-pattern 3]
✗ [Anti-pattern 4]
✗ [Anti-pattern 5]
```

---

## 6. Checklist avant intégration

<!--
  Cocher avant d'intégrer du contenu généré dans le projet.
-->

- [ ] IDs uniques (pas de doublon dans le fichier)
- [ ] Timestamps cohérents (pas de retour en arrière)
- [ ] Registre correct pour chaque personnage
- [ ] Références aux assets vérifiées
- [ ] Pas d'anti-patterns détectés
- [ ] [Vérification spécifique à ton projet]
- [ ] [Vérification spécifique à ton projet]
