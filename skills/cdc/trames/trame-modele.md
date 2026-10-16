---
title: "[Nom du projet]"
subtitle: "Cahier des charges"
---

<!-- Trame figée — calque de templates/Modele_CDC.docx (modèle unique de tous les CDC depuis le 2026-10-16).
Même plan, mêmes niveaux de titre (H1 sections et Annexe A, H2 sous-sections, H3 A.1 à A.10), mêmes tableaux.
Le skill remplit ce squelette sans ajouter ni retirer de section. Les spans de style Consigne sont les
consignes grises du modèle : les remplacer par le contenu puis les supprimer. Tout champ non dérivable d'une
source reste [À COMPLÉTER]. Les blocs openxml sont les sauts de page du modèle (docx seulement). -->

[*Les textes en gris italique sont des consignes de rédaction : les remplacer par le contenu du projet, puis les supprimer.*]{custom-style="Consigne"}

| Élément | Valeur |
|-----------------------------|-----------------------------------------------------------------------|
| Projet | [*[Nom du projet / module]*]{custom-style="Consigne"} |
| Version / date | [*[v0.x — jj/mm/aaaa]*]{custom-style="Consigne"} |
| Auteurs | [*[Noms]*]{custom-style="Consigne"} |
| Destinataires | [*[Client, Product Owner…]*]{custom-style="Consigne"} |
| Statut | [*[Version de travail / Pour validation / Validé]*]{custom-style="Consigne"} |

## Suivi des versions

| Version | Date | Auteur | Modifications |
|-------------|------------------|----------------------|-----------------------------------------------|
| [*v0.1*]{custom-style="Consigne"} | [*jj/mm/aaaa*]{custom-style="Consigne"} | | [*Création*]{custom-style="Consigne"} |
| | | | |
| | | | |

## Validation

| Rôle | Nom | Date | Signature |
|---------------------------|-------------------------------|------------------|-------------------------|
| Client | | | |
| Product Owner | | | |
| Chef de projet | | | |

```{=openxml}
<w:p><w:r><w:br w:type="page"/></w:r></w:p>
```

# 1. Synthèse

[*Une demi-page maximum. Le problème, la solution proposée, le périmètre de la première version, la date cible et les bénéfices attendus. À rédiger en dernier.*]{custom-style="Consigne"}

# 2. Contexte

[*L'organisation, le processus métier concerné, et pourquoi le projet est lancé maintenant. Situer le projet dans son environnement (autres applications, projets liés).*]{custom-style="Consigne"}

# 3. Situation actuelle

[*Comment le processus fonctionne aujourd'hui : outils utilisés, étapes, acteurs. Puis les limites constatées (temps perdu, ressaisies, absence de suivi, de traçabilité…).*]{custom-style="Consigne"}

## 3.1 Fonctionnement actuel

## 3.2 Limites

| # | Limite | Conséquence |
|-------|--------------------------------------------|-------------------------------------------------|
| 1 | | |
| 2 | | |
| 3 | | |

# 4. Objectifs et périmètre

## 4.1 Objectifs

[*Objectifs mesurables lorsque c'est possible (ex. : supprimer la ressaisie des fiches, suivre l'avancement en temps réel).*]{custom-style="Consigne"}

| # | Objectif | Indicateur |
|---------|-----------------------------------------------------|--------------------------------------|
| O1 | | |
| O2 | | |
| O3 | | |

## 4.2 Périmètre

| Inclus dans la première version | Exclu / versions ultérieures |
|--------------------------------------------------|--------------------------------------------------|
| | |
| | |
| | |

# 5. Acteurs et rôles

[*Chaque type d'utilisateur, son rôle et ses droits. Préciser si les rôles sont globaux ou attribués par projet.*]{custom-style="Consigne"}

| Rôle | Description | Droits principaux | Appareil |
|--------------------|-------------------------------|-------------------------------|------------------|
| | | | |
| | | | |
| | | | |

## 5.1 Matrice RACI (optionnelle)

[*R = réalise, A = approuve, C = consulté, I = informé.*]{custom-style="Consigne"}

| Activité | [*[Rôle 1]*]{custom-style="Consigne"} | [*[Rôle 2]*]{custom-style="Consigne"} | [*[Rôle 3]*]{custom-style="Consigne"} |
|--------------------------------------|---------------------|---------------------|---------------------|
| | | | |
| | | | |

# 6. Besoins fonctionnels

## 6.1 Processus cible

[*Les étapes du processus dans l'application, dans l'ordre. Un schéma de flux peut être placé en annexe.*]{custom-style="Consigne"}

## 6.2 Liste des fonctionnalités

[*Une ligne par fonctionnalité. Chaque fonctionnalité fait ensuite l'objet d'une fiche technique (annexe A).*]{custom-style="Consigne"}

| # | Fonctionnalité | Description | Priorité | Livrable |
|--------|----------------------|-----------------------------------|----------------|--------------------|
| [*F1*]{custom-style="Consigne"} | | | [*Must / Should / Could*]{custom-style="Consigne"} | |
| [*F2*]{custom-style="Consigne"} | | | | |
| [*F3*]{custom-style="Consigne"} | | | | |

## 6.3 User stories

[*Format : En tant que [rôle], je veux [action] afin de [bénéfice].*]{custom-style="Consigne"}

| ID | User story | Fonctionnalité | Critère d'acceptation |
|----------|---------------------------------------|--------------------|-------------------------------|
| [*US-01*]{custom-style="Consigne"} | | | |
| | | | |

## 6.4 Règles de gestion

| # | Règle | Fonctionnalité |
|-----------|---------------------------------------------------------------------|--------------------|
| [*RG-01*]{custom-style="Consigne"} | | |
| | | |

# 7. Exigences non fonctionnelles

| Catégorie | Exigence |
|-----------------------------|-----------------------------------------------------------------------|
| Ergonomie | [*[Usage tablette, tailles d'écran, saisie tactile]*]{custom-style="Consigne"} |
| Appareils et navigateurs | [*[Liste supportée]*]{custom-style="Consigne"} |
| Langue | [*[Langue de l'interface et des documents]*]{custom-style="Consigne"} |
| Performance | [*[Temps de réponse attendus, volumes]*]{custom-style="Consigne"} |
| Disponibilité | [*[Horaires, taux de disponibilité]*]{custom-style="Consigne"} |
| Sécurité | [*[Authentification, droits, journalisation]*]{custom-style="Consigne"} |
| Traçabilité | [*[Historique, horodatage]*]{custom-style="Consigne"} |
| Hors connexion | [*[Requis / non requis / version ultérieure]*]{custom-style="Consigne"} |

# 8. Contraintes techniques et architecture

[*Architecture (API, frontend), hébergement, technologies imposées, réutilisation de composants existants, intégrations avec d'autres applications.*]{custom-style="Consigne"}

| Sujet | Contrainte / choix |
|-----------------------------|-----------------------------------------------------------------------|
| Architecture | |
| Hébergement | |
| Technologies | |
| Réutilisation | |
| Intégrations | |

# 9. Données

[*Renvoyer au schéma de base de données plutôt que de le recopier. Décrire ici les principes et les règles.*]{custom-style="Consigne"}

## 9.1 Modèle de données

[*Référence du schéma, tables principales, liens avec d'autres bases.*]{custom-style="Consigne"}

## 9.2 Import et reprise de données

[*Sources, format, règles de validation, traitement des erreurs.*]{custom-style="Consigne"}

## 9.3 Conservation et archivage

[*Durées de conservation, format d'archive, suppression.*]{custom-style="Consigne"}

## 9.4 Choix de conception

| # | Choix | Conséquence pour les utilisateurs |
|-------|--------------------------------------------|-------------------------------------------------|
| 1 | | |
| 2 | | |

# 10. Livrables

| Livrable | Description | Format | Échéance |
|-------------------------|------------------------------------|-------------------|--------------------|
| | | | |
| | | | |
| | | | |

# 11. Planning et jalons

## 11.1 Hypothèses

[*Équipe, disponibilité, prérequis (serveur, données, réponses du client).*]{custom-style="Consigne"}

## 11.2 Estimation par fonctionnalité

| # | Fonctionnalité | Heures | Difficulté (1-10) | Stack | Approche |
|--------|----------------------------|------------|--------------|-----------|---------------------------|
| | | | | | |
| | | | | | |
| | **Sous-total** | | | | |
| | Marge (… %) | | | | |
| | **Total** | | | | |

## 11.3 Calendrier

| Semaine / jalon | Contenu | Résultat à montrer |
|------------------|-----------------------------------|-----------------------------------------------|
| | | |
| | | |

# 12. Recette et critères d'acceptation

[*Organisation de la recette, participants, environnement, scénarios et critères de réussite. Le procès-verbal de recette clôt la phase.*]{custom-style="Consigne"}

| # | Scénario | Résultat attendu | Fonctionnalités |
|----------|-----------------------------------|-----------------------------------|--------------------|
| [*R-01*]{custom-style="Consigne"} | | | |
| | | | |

# 13. Organisation et gouvernance

| Sujet | Description |
|-----------------------------|-----------------------------------------------------------------------|
| Comité de pilotage | [*[Participants, fréquence]*]{custom-style="Consigne"} |
| Validation des documents | [*[Qui valide quoi]*]{custom-style="Consigne"} |
| Demandes de changement | [*[Processus : demande, estimation, validation]*]{custom-style="Consigne"} |
| Points d'avancement | [*[Fréquence, format]*]{custom-style="Consigne"} |

# 14. Risques et hypothèses

| # | Risque | Probabilité | Impact | Mesure |
|-------|---------------------------------|--------------|--------------|-------------------------------|
| | | | | |
| | | | | |

# 15. Maintenance, support et formation

[*Support après livraison, délais de correction des anomalies, évolutions, formation des utilisateurs et documentation.*]{custom-style="Consigne"}

# 16. Questions ouvertes

| # | Question | Impact | Réponse / décision |
|-------|------------------------------------------|----------------------|-----------------------------|
| | | | |
| | | | |

# 17. Annexes

## 17.1 Glossaire

| Terme | Définition |
|-----------------------------|-----------------------------------------------------------------------|
| | |
| | |

## 17.2 Documents de référence

| Document | Version | Emplacement |
|--------------------------------------------|----------------|----------------------------------------|
| | | |
| | | |

```{=openxml}
<w:p><w:r><w:br w:type="page"/></w:r></w:p>
```

# Annexe A — Fiche technique de fonctionnalité (modèle)

[*Copier cette annexe pour chaque fonctionnalité. À rédiger avant le développement et à faire relire par le développeur.*]{custom-style="Consigne"}

| Élément | Valeur |
|-----------------------------|-----------------------------------------------------------------------|
| Fonctionnalité | [*[F… — Nom]*]{custom-style="Consigne"} |
| Version / date | |
| Auteur | |
| Développeur | |
| Estimation / difficulté | [*[… h — …/10]*]{custom-style="Consigne"} |
| Statut | [*[À rédiger / En relecture / Validée]*]{custom-style="Consigne"} |

### A.1 Objectif

[*Ce que la fonctionnalité permet, en deux ou trois phrases.*]{custom-style="Consigne"}

### A.2 User stories

| ID | User story | Critère d'acceptation |
|-----------|-------------------------------------------------|----------------------------------------|
| | | |
| | | |

### A.3 Règles de gestion

| # | Règle | Message / comportement en cas de non-respect |
|----------|-------------------------------------------------|-----------------------------------------|
| | | |
| | | |

### A.4 Données concernées

| Table | Colonnes | Lecture / écriture | Remarque |
|----------------------|----------------------------------|------------------|---------------------------|
| | | | |
| | | | |

### A.5 API

| Méthode | Route | Description | Entrée | Sortie | Erreurs |
|-------------|---------------------|-------------------|----------------|----------------|----------------|
| | | | | | |
| | | | | | |

### A.6 Écrans

[*Écrans concernés, référence au prototype, comportements (filtres, tri, validation de saisie).*]{custom-style="Consigne"}

### A.7 Droits d'accès

| Action | [*[Rôle 1]*]{custom-style="Consigne"} | [*[Rôle 2]*]{custom-style="Consigne"} | [*[Rôle 3]*]{custom-style="Consigne"} |
|--------------------------------------|---------------------|---------------------|---------------------|
| | | | |
| | | | |

### A.8 Cas d'erreur

| Cas | Comportement attendu |
|--------------------------------------------|--------------------------------------------------------|
| | |
| | |

### A.9 Tests

| # | Scénario | Résultat attendu | Type |
|--------|----------------------------------------|-----------------------------------|------------------|
| | | | [*Unitaire / API / E2E*]{custom-style="Consigne"} |
| | | | |

### A.10 Dépendances

[*Fonctionnalités, données ou décisions nécessaires avant de commencer.*]{custom-style="Consigne"}
