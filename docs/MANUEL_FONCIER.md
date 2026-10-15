# Manuel d'utilisation — Foncier : sécurisation du titre et coordination des démarches

Public : service Foncier, comptabilité, direction. Portails : souscripteur, intervenant, notaire (`portail-unique.html`).
Principe : l'ERP **suit et coordonne** les démarches. « Terminé » ne signifie jamais « accordé par l'administration ».

## 1. Parcours en bref

| Étape | Où | Qui |
|---|---|---|
| Situation du titre de la parcelle | Foncier › 2.1 Situation des titres | Foncier |
| Ouvrir le dossier de la parcelle (titre mère) | Foncier › 2.2 Dossiers fonciers › « Ouvrir un dossier » | Foncier |
| Confier des missions (géomètre, notaire…) | Foncier › 2.3 Intervenants & missions | Responsable |
| Titre individuel du souscripteur | Dossier global › panneau « Titres individuels » (ou ouverture auto au solde) | Foncier |
| Frais du titre, refacturation | Dossier individuel › Frais du titre | Foncier / Comptabilité |
| Informer le souscripteur | Foncier › 2.5 Information souscripteurs | Foncier |
| Suivi quotidien | Foncier › Ma journée, Notifications | Tous |
| Pilotage | Foncier › Pilotage foncier | Direction |

## 2. Ouvrir un dossier

1. Foncier › 2.2 Dossiers fonciers › **Ouvrir un dossier**.
2. Choisir parcelle, situation initiale ou procédure, **responsable** (obligatoire), priorité, échéance.
3. Si un **modèle** existe pour la procédure, les échéances et responsables des étapes se remplissent seuls (§3).
4. Un seul dossier actif par parcelle et procédure : un second demande confirmation.

Titre individuel : s'ouvre depuis le dossier global (un lot, un souscripteur). Sans titre mère disponible, l'ouverture exige une dérogation motivée. Réglage « Ouverture automatique » : Foncier › Notifications (le dossier s'ouvre quand le souscripteur a soldé le prix initial).

## 3. Modèles de dossier (Foncier › Modèles de dossier)

Réservé à la direction et aux administrateurs.
- Par procédure : **durée en jours** et **responsable par défaut** de chaque étape.
- À l'ouverture : échéance de chaque étape = date d'ouverture + cumul des durées. Les échéances restent modifiables dossier par dossier.
- « Proposer les durées observées » : reprend les durées réelles des dossiers terminés (au moins 3 observations par étape).
- Case « Imposer l'ordre des étapes » : voir §4.
- **Échéances estimées** : pour une étape sans durée dans le modèle, l'échéance reprend la durée habituelle de vos dossiers terminés (3 sur 4 se sont terminés plus vite ; au moins 3 dossiers observés). Elle est marquée 📈 *estimée* ; la saisie d'une échéance propose cette suggestion. Réglage « Estimer les échéances d'après vos dossiers ».

## 4. Faire avancer un dossier

Dans le détail du dossier, chaque étape a un statut, un responsable, une échéance, des justificatifs, une visibilité.

- **Statuts** : à préparer, à venir, en cours, en attente (intervenant, document, administration, décision), bloqué, rejeté, terminé, annulé.
- **Motif obligatoire** pour bloqué, rejeté, annulé.
- **Justificatif** : une étape qui en exige un ne se termine pas sans lui. Source obligatoire (promoteur, prestataire, administration déclarée, document officiel contrôlé).
- **Ordre des étapes** (actif par défaut) : 🔒 *Attend : …* sous une étape = ses étapes préalables ne sont pas terminées. Démarrer ou terminer exige alors une **dérogation motivée**, réservée au responsable du dossier ou à un administrateur, journalisée. « Bloqué », « rejeté », « annulé » restent toujours possibles. Une étape annulée compte comme franchie.
- **Dérogation** (justificatif manquant, contrôles non conclus, clôture avec étapes restantes) : motif obligatoire, journalisée.
- **Étape terminée** : plus de modification directe ; utiliser **Corriger** (motif obligatoire, ancienne valeur conservée).
- **Modifications simultanées** : si un collègue a enregistré le même dossier entre-temps, votre modification est refusée sans rien écraser, les données sont actualisées, recommencez. Hors ligne, le travail n'est pas bloqué.
- **Clôture** : panneau « Avant la clôture » en haut du dossier. Sont exigés : pièces contrôlées, missions validées ou clôturées, demandes de complément closes, contrôles sans anomalie, et pour un titre individuel frais comptabilisés et notes de débours encaissées. Dérogation motivée du responsable, journalisée.
- **Historique** : ajout seul, jamais modifié ni supprimé.
- **Retards** : « retard interne » et « délai administratif dépassé » sont distingués ; aucun retard n'est imputé à un tiers sans donnée.

## 5. Ma journée (Foncier › Ma journée)

Badge rouge = nombre d'éléments à traiter. Sections :
retards · à faire aujourd'hui · dans les 7 jours · étapes prêtes à démarrer · pièces à contrôler · livrables à valider · demandes de complément · notes de débours en retard · incohérences de séquence · dossiers sans mise à jour (14 jours).

Actions en un clic : **Démarrer**, **Terminer** (mêmes garde-fous que l'écran du dossier), **+7 j** (report journalisé), **Accepter / Refuser** une pièce (motif obligatoire au refus, communiqué au souscripteur), **Ouvrir**.
La direction peut consulter la journée d'un autre utilisateur (lecture seule).

### Score de risque

Chaque dossier ouvert porte un score de 0 à 100 (faible < 20, modéré, élevé à partir de 45, critique à partir de 70), visible en badge dans la liste (bouton « Trier par risque »), en détail dans le dossier (facteurs et points), dans Pilotage › 🚨 Dossiers à risque et dans Ma journée. Il repose sur des faits : blocage, retards internes, inactivité, pièces expirées ou non contrôlées, missions en retard, incohérences, notes en retard. Un délai d'administration dépassé pèse peu et n'est jamais une faute imputée. C'est une aide à la priorisation, pas un jugement.

## 6. Pièces et documents

- Dépôt par étape, versions, contrôle d'intégrité, expiration (alerte à 30 jours), archivage motivé. Foncier › Documents : classement et recherche.
- Les fichiers sont stockés dans un espace **privé** ; ouverture par lien signé de 60 secondes.
- **Souscripteur** : l'étape publiée peut ouvrir un dépôt ; il envoie ses fichiers depuis son portail (10 pièces au plus par demande). Vous acceptez ou refusez.
- **Confidentialité** : une pièce « restreinte » n'apparaît jamais côté portail.

## 7. Intervenants et missions

- Répertoire (notaire, géomètre, …) avec statut de relation. Accès au portail : code, expiration, révocation (fiche de l'intervenant).
- **Créer une mission** : choisir le dossier et l'intervenant, puis cliquer une **mission type** (boutons propres à son métier : bornage, acte de mutation, dépôt et suivi…). Titre, consignes, livrables cochables, échéance et étape sont préremplis ; ajustez puis « Créer la mission » ou « Créer et envoyer ». La direction adapte les modèles dans « 🧩 Modèles de mission par type d'intervenant ».
- Mission : acceptation, démarrage, livrables par versions, soumission, vérification, validation ou correction. Messagerie par mission.
- Le notaire voit **uniquement** ce qui lui est transmis : identité, bien, avancement, pièces cochées « transmis au notaire », attestations. Chaque consultation est journalisée.

### Courriers types

Dans le dossier, **✉️ Courriers types** : choisir le modèle (pièces complémentaires, point d'avancement, rappel de règlement, remise du titre, lettre de mission, rappel d'échéance, transmission au notaire, demande à l'administration, courrier libre) et le destinataire. Le courrier est prérempli avec les données du dossier ; complétez les « [à compléter] », modifiez le texte si besoin, puis **imprimer / PDF**, **copier** ou **envoyer par e-mail**. Chaque action est journalisée avec une référence COU-AAAA-NNNN. La direction adapte les textes dans Modèles de dossier › « Modèles de courrier ».

## 8. Information du souscripteur

- Foncier › 2.5 : publier une information (source obligatoire), la retirer (motif), prévisualiser ce que voit le souscripteur.
- Le portail affiche : progression pondérée des étapes publiables (jamais une probabilité), prochaine étape, pièces demandées, attestations, frais de titre à rembourser.

## 9. Frais du titre et refacturation

1. **Saisir** un frais (dossier individuel uniquement) : nature, HT, TVA, date, **pièce justificative obligatoire**, prestataire, qui supporte (promoteur ou souscripteur). Les droits d'enregistrement ne portent pas de TVA.
2. **Comptabiliser** (droit Comptabilité) : écriture **en brouillard**, équilibrée. Promoteur : D charge + TVA déductible / C fournisseurs. Avancé pour le souscripteur : D 4111 (avances) / C fournisseurs.
3. **Régler** le prestataire : D fournisseurs / C trésorerie.
4. **Refacturer** : cocher les frais avancés comptabilisés › « Émettre la note de débours » (`NDF-AAAA-NNNN`, prix coûtant, sans marge, document figé, échéance par défaut 30 jours).
5. **Publier** la note au portail : e-mail au souscripteur, une seule fois par note.
6. **Encaisser** : mode et date › écriture en brouillard D trésorerie / C compte d'avances. Une note encaissée ne s'annule pas (contre-passation en comptabilité). Une note émise s'annule avec motif et libère ses frais.

Prérequis : Paramètres › Comptes par défaut › Titre foncier (honoraires notaire / géomètre, droits d'enregistrement, frais d'actes, fournisseurs, avances souscripteur). Compte absent = refus clair, aucune écriture.
TVA des débours : traitement à confirmer par l'expert-comptable.

## 10. Notifications

Foncier › Notifications : alertes d'échéances (interne, e-mail), file d'envoi, relances paramétrables (avant, jour J, après, escalade). Un contrôle serveur quotidien (07 h) génère aussi les alertes sans que l'ERP soit ouvert.
Rapport de pilotage automatique : jamais / chaque semaine / chaque mois (envoyé à la direction à l'ouverture de l'ERP).

## 11. Pilotage foncier

Filtres communs : programme, parcelle, procédure, responsable, niveau, période d'ouverture.
Onglets : Promoteur · Responsable foncier · Intervenants · Direction · **Coûts du titre** · **Rapport périodique** (les trois derniers : direction).
- Une valeur reposant sur moins de 3 observations est **indicative**.
- Coûts : frais engagés TTC, part promoteur / souscripteur, à refacturer, refacturé, encaissé, notes en retard, par nature et par opération.
- Rapport : hebdomadaire, mensuel, trimestriel ; comparaison à la période précédente ; PDF, CSV, envoi à la direction (une fois par période).

## 12. Droits

| Action | Droit requis |
|---|---|
| Modifier dossiers, étapes, pièces | Écriture sur le module Foncier |
| Déroger à l'ordre, publier, émettre une note | Responsable du dossier ou administrateur |
| Comptabiliser, encaisser | Écriture sur la Comptabilité |
| Modèles, rapports, coûts | Direction ou administrateur |
| Exports | Profil autorisé à exporter |

## 13. Bonnes pratiques

- Un **responsable** par dossier, toujours ; réaffecter avant une absence.
- Renseigner les **modèles** avant d'ouvrir les dossiers : les échéances se calculent seules.
- Ouvrir **Ma journée** chaque matin ; viser un badge à zéro.
- Joindre le justificatif **au moment** de la saisie, pas à la clôture.
- Ne publier au souscripteur que des informations vérifiées ; indiquer la source.
- Garder « Imposer l'ordre des étapes » actif ; ne désactiver que si le travail est massivement parallèle.

## 14. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| « Étape(s) préalable(s) non terminée(s) » | Ordre imposé | Terminer le préalable, ou dérogation motivée (responsable) |
| « Cette étape exige un justificatif » | Justificatif manquant | Ajouter le justificatif (bouton +) |
| « Compte non paramétré » | Comptes par défaut incomplets | Paramètres › Comptes par défaut › Titre foncier |
| « Ce dossier a été modifié par … » | Un collègue a enregistré avant vous | Recommencer après actualisation (automatique) |
| « Clôture impossible, à traiter d'abord » | Points ouverts (pièces, missions, frais…) | Les traiter, ou dérogation motivée du responsable |
| « Titre mère non disponible » | Titre de l'opération absent | Compléter le dossier global (références + document officiel contrôlé) |
| Onglet Coûts / Rapport absent | Profil non direction | Demander le droit à un administrateur |
| Le souscripteur ne voit pas la note | Note non publiée | Publier la note au portail |
| Pièce illisible côté portail | Fichier non synchronisé | Attendre la synchronisation (40 s) ou rouvrir Documents |

Limites connues : l'envoi d'e-mails part depuis l'ERP (pas encore côté serveur) ; la TVA des débours n'est pas ventilée.
