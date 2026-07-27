# Cahier des charges — SaisieMobile (app mobile de remplissage de documents)

> Exemple de référence rempli, à usage de modèle. Projet fictif.

| | |
|---|---|
| Projet | SaisieMobile |
| Commanditaire | Direction des opérations terrain |
| Rédacteur | Service méthodes |
| Version | 1.0 |
| Date | 2026-06-23 |

## 1. Contexte et présentation

Les agents terrain remplissent aujourd'hui des documents papier (rapports d'intervention, états des lieux, fiches de contrôle) ressaisis ensuite manuellement au bureau. Double saisie, délais, erreurs, perte de pièces jointes. SaisieMobile est une application mobile permettant de remplir ces documents directement sur le terrain depuis un smartphone, y compris hors connexion, et de les transmettre automatiquement au système de gestion.

Cible : agents itinérants, gestionnaires de dossiers, administrateurs de modèles de documents.

## 2. Objectifs

- Supprimer la double saisie : un document rempli sur mobile arrive directement exploitable au bureau.
- Permettre le remplissage hors connexion avec synchronisation automatique au retour du réseau.
- Réduire le délai entre l'intervention terrain et la disponibilité du document de 48 h à moins de 5 min après synchronisation.
- Joindre photos et signature manuscrite au document sans matériel additionnel.

## 3. Périmètre

### Inclus
- Application mobile iOS et Android.
- Remplissage de formulaires dynamiques basés sur des modèles de documents.
- Mode hors-ligne + synchronisation.
- Capture photo et signature.
- Export PDF du document rempli.
- Back-office de gestion des modèles de documents.

### Exclu
- Édition collaborative simultanée d'un même document.
- Module de facturation.
- Reconnaissance OCR de documents papier scannés (envisagé en V2).

## 4. Acteurs et rôles

| Acteur | Description | Droits / responsabilités |
|--------|-------------|--------------------------|
| Agent terrain | Utilisateur mobile itinérant | Remplit, signe et soumet des documents ; consulte ses brouillons |
| Gestionnaire | Utilisateur bureau | Consulte, valide et exporte les documents soumis |
| Administrateur | Référent applicatif | Crée et publie les modèles de documents, gère les comptes |

## 5. User stories

> Format : En tant que [rôle], je veux [action], afin de [bénéfice]. Priorité MoSCoW.

### US-1 — Remplir un formulaire dynamique
- En tant qu'agent terrain, je veux remplir un document à partir d'un modèle, afin de produire un livrable conforme sans support papier.
- Priorité : Must
- Critères d'acceptation :
  - [ ] La liste des modèles publiés est affichée.
  - [ ] Les champs obligatoires non remplis bloquent la soumission et sont signalés.
  - [ ] Le brouillon est sauvegardé automatiquement toutes les 30 s.

### US-2 — Travailler hors connexion
- En tant qu'agent terrain, je veux remplir et enregistrer un document sans réseau, afin de continuer à travailler en zone non couverte.
- Priorité : Must
- Critères d'acceptation :
  - [ ] Un document créé hors-ligne est conservé localement.
  - [ ] La synchronisation se déclenche automatiquement au retour du réseau.
  - [ ] En cas de conflit, la version locale est conservée et le conflit signalé au gestionnaire.

### US-3 — Joindre photo et signature
- En tant qu'agent terrain, je veux ajouter des photos et une signature manuscrite, afin d'attester l'intervention.
- Priorité : Must
- Critères d'acceptation :
  - [ ] Au moins 5 photos peuvent être jointes à un document.
  - [ ] La signature est capturée tactilement et intégrée au PDF exporté.

### US-4 — Exporter en PDF
- En tant que gestionnaire, je veux exporter un document soumis en PDF, afin de l'archiver et le transmettre.
- Priorité : Should
- Critères d'acceptation :
  - [ ] Le PDF reprend la mise en forme du modèle, les photos et la signature.

### US-5 — Gérer les modèles de documents
- En tant qu'administrateur, je veux créer et publier des modèles de documents, afin que les agents disposent de formulaires à jour.
- Priorité : Must
- Critères d'acceptation :
  - [ ] Un modèle peut contenir champs texte, listes, cases à cocher, dates, photo, signature.
  - [ ] La publication d'un modèle le rend immédiatement disponible aux agents à la prochaine synchronisation.

### US-6 — Suivre l'état de ses documents
- En tant qu'agent terrain, je veux voir l'état de mes documents (brouillon, soumis, synchronisé, validé), afin de savoir ce qu'il me reste à faire.
- Priorité : Should
- Critères d'acceptation :
  - [ ] Chaque document affiche son état courant et la date de dernière synchronisation.

## 6. Contraintes

| Type | Contrainte |
|------|------------|
| Délais | MVP (US-1 à US-3, US-5) livré sous 3 mois |
| Budget | [À COMPLÉTER] |
| Technique | iOS 15+ / Android 10+ ; fonctionnement hors-ligne obligatoire |
| Légal / RGPD | Données d'intervention pouvant contenir des données personnelles ; chiffrement local et en transit requis |

## 7. Livrables

- Applications mobiles iOS et Android publiées sur les stores internes.
- Back-office de gestion des modèles et des documents.
- Documentation utilisateur (agent + administrateur).
- Documentation technique d'API et de déploiement.

## 8. Critères d'acceptation globaux

- [ ] Un agent peut remplir, signer et soumettre un document hors-ligne, puis le retrouver synchronisé côté bureau après reconnexion.
- [ ] Un administrateur peut publier un nouveau modèle sans intervention technique.
- [ ] Aucune donnée saisie n'est perdue en cas de coupure réseau ou de fermeture de l'app.
