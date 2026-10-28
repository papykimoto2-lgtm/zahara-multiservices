# Cahier des charges — Arc-en-Ciel Connect

**Plateforme numérique de gouvernance et de développement de la Cité Arc-en-Ciel de Songon Kassamblé**
Application développée par **Sanix Africa** · Côte d'Ivoire · Version 1.0

| | |
|---|---|
| **Projet** | Arc-en-Ciel Connect (nom provisoire) |
| **Nature** | Plateforme de gestion communautaire et de gouvernance de copropriété |
| **Finalité** | Transparence, cohésion sociale, bonne gouvernance, développement de la cité |
| **Cible technique** | Web responsive, PWA, Supabase / PostgreSQL (RLS), mobile first |
| **Référentiel comptable** | SYSCOHADA révisé |

---

## 1. Vision et objectifs

**Vision** : une communauté moderne, organisée et solidaire où chaque membre accède en permanence aux informations utiles, comprend la gestion du syndic et participe aux décisions.

**Acteurs** : présidence, bureau, copropriétaires et résidents, commissions, prestataires, partenaires, sécurité et entretien.

**Objectifs**
1. Garantir la transparence financière et administrative.
2. Renforcer la confiance membres–dirigeants.
3. Tracer recettes, dépenses et décisions.
4. Faciliter paiement et suivi des cotisations.
5. Organiser réunions, assemblées et consultations.
6. Planifier les projets (court, moyen, long terme).
7. Informer les membres de l'activité du syndic.
8. Développer l'entraide et les actions sociales.
9. Gérer équipements et infrastructures communes.
10. Créer un historique numérique fiable.
11. Encourager la participation aux décisions.
12. Améliorer le cadre de vie et valoriser le patrimoine.

**Six principes**

| Principe | Application |
|---|---|
| Transparence | Les membres autorisés consultent états financiers et rapports publiés |
| Traçabilité | Chaque opération garde auteur, date, statut, historique |
| Responsabilité | Missions et pouvoirs clairement définis |
| Participation | Propositions, votes autorisés, signalements |
| Solidarité | Assistance encadrée aux membres en difficulté |
| Développement | Ressources orientées vers des projets mesurables |

> Aucune opération financière importante sans validation conforme aux règles du syndic. Les données personnelles sensibles restent réservées aux personnes habilitées.

## 2. Présentation générale

Plateforme web accessible sur ordinateur, tablette et smartphone, installable sur l'écran d'accueil (PWA).

**Portail unique du membre** : identité, statut, lot, situation financière, cotisations (appelées / payées / en attente), reçus, annonces, réunions, PV publiés, projets, consultations et votes, notifications, demandes, aides accessibles.

**12 espaces** : portail membres · administration du syndic · finances et trésorerie · réunions et décisions · planification et projets · communication · solidarité · infrastructures · réclamations et incidents · documents et archives · contrôle interne et audit · tableau de bord général.

## 3. Membres et copropriétaires

**Fiche membre** : identifiant unique, nom, téléphone, e-mail, statut (copropriétaire, résident, locataire, représentant), lot, date d'adhésion, situation administrative, statut du compte, historiques (cotisations, demandes, participations). Pièces d'identité collectées seulement si nécessaire.

**Logements et lots** : fiches avec référence unique, propriétaires, occupants, historique des mutations, indivision, lots vacants/occupés, recherche par lot, nom ou référence. Propriétaire, résident, locataire et représentant ont des droits distincts (consultation, vote, paiement).

**Fonctions du syndic** : président, vice-président, secrétaire général et adjoint, trésorier et adjoint, responsables de commissions, contrôleurs financiers, membres ordinaires. Historique des mandats (début, fin, fonction, droits).

> Un changement de président ou de trésorier ne fait jamais perdre l'historique.

## 4. Trésorerie et transparence financière

### 4.1 Recettes
Cotisations ordinaires et exceptionnelles, contributions aux travaux, dons, subventions, activités, contributions volontaires, autres.
Champs : référence, date, montant, catégorie, contributeur, mode de paiement (espèces, virement, chèque, Mobile Money), justificatif, statut de validation et d'encaissement, responsable de saisie, référence de rapprochement.

### 4.2 Cotisations
Libellé, montant, périodicité, échéance, catégorie de membres, motif, modalités, dates de campagne. Appels individuels générés automatiquement. États : appelé, payé, partiel, impayé, en retard, contesté. Reçus numériques et rappels.

> Distinguer sommes **appelées** et sommes **encaissées** : une cotisation non payée n'est jamais une recette disponible.

### 4.3 Dépenses
Référence, objet, montant, catégorie, fournisseur, date, ligne budgétaire, justificatifs, demandeur, validateurs, statut, date et moyen de paiement, preuve de règlement.
Catégories : entretien, sécurité, éclairage, eau/électricité communes, réparations, nettoyage, prestations externes, frais administratifs, actions sociales, réunions, travaux et investissements, exceptionnelles.

### 4.4 Circuit de validation
1. Demande de dépense (motif, montant, pièces).
2. Contrôle budgétaire (budget, engagements, solde prévisionnel).
3. Validation administrative (président ou habilité).
4. Validation financière (trésorier : fonds et justificatifs).
5. Autorisation de paiement.
6. Paiement et référence.
7. Archivage et reporting.

Matrice indicative (seuils paramétrables sans développeur, à adopter par les organes de la cité) :

| Montant | Circuit |
|---|---|
| ≤ 25 000 FCFA | Responsable habilité + trésorier |
| 25 001 – 100 000 FCFA | Président + trésorier |
| 100 001 – 500 000 FCFA | Président + trésorier + second approbateur |
| > 500 000 FCFA | Autorisation spéciale (décision ou vote) |

> Séparation des tâches : qui saisit une dépense ne peut ni la valider ni enregistrer son paiement à lui seul.

### 4.5 Caisse et rapprochement
Solde d'ouverture, entrées, sorties, solde théorique, solde constaté, écarts, mouvements bancaires, rapprochement, opérations en attente, justificatifs manquants. Dépenses engagées non payées présentées à part.

### 4.6 Aucune suppression silencieuse
Une opération validée ne s'efface pas : annulation ou contrepassation, motif obligatoire, auteur et date conservés, opération d'origine consultable.

### 4.7 Rapports périodiques
Recettes et dépenses mensuelles, cotisations, impayés, trésorerie, budget prévisionnel et exécuté, écarts, engagements, dépenses en attente, rapports trimestriel, semestriel, annuel et de fin de mandat. Export PDF et Excel. Données sensibles masquées selon les droits.

## 5. Gouvernance et décisions

**Propositions** : titre, description, auteur, date, catégorie, estimation, priorité, statut (reçue, à l'étude, acceptée, rejetée avec motif, planifiée, réalisée), réponse du syndic.

**Registre des décisions** : numéro, date, organe, sujet, votants, résolution, responsable, délai, budget, avancement, pièces.

**Votes et consultations** : consultations simples, votes sur projets, sondages, choix multiples, consultations budgétaires, votes formels si le cadre juridique l'autorise. Éligibilité, période, quorum, majorité, anti-doublon, preuve vérifiable.

> Un sondage numérique n'est pas une assemblée générale valable. La validité d'un vote à distance dépend des statuts, du règlement et des textes applicables.

## 6. Réunions et procès-verbaux

**Planification** : type (bureau, commission, AG ordinaire / extraordinaire, information, chantier, communautaire), date, lieu, participants, ordre du jour, documents, responsable et secrétaire de séance, convocations, notifications, confirmations de présence.

**PV numériques** : référence, présents et représentés, quorum, ordre du jour, synthèse, résolutions, votes, responsables, délais, prochaine réunion, signatures. Export PDF, validation, publication au portail, versions conservées avant approbation.

**Suivi** : chaque résolution devient une action (responsable, échéance, priorité, budget, indicateur, avancement, preuves). Tableau de bord : exécutées, en cours, en retard, bloquées.

## 7. Planification stratégique

| Horizon | Période | Exemples |
|---|---|---|
| Court terme | 0–12 mois | Lampadaires, nettoyage, fuites, sécurité, mise à jour des fiches, réclamations |
| Moyen terme | 1–3 ans | Voies internes, éclairage, contrôle d'accès, espaces de détente, collecte des déchets, réserve travaux |
| Long terme | 3–10 ans | Rénovation globale, équipements communautaires, résilience aux inondations, énergie, espaces verts, fonds de grosses réparations |

**Fiche de projet** : code, intitulé, problème, objectifs, bénéficiaires, priorité, coût estimé, financement, responsable, calendrier, étapes, indicateurs, documents, prestataires, décision d'autorisation, avancement, coût réel, bilan.

**Suivi** : budget prévu / dépensé / avancement / responsable. Alertes : dépassement de budget, retard, financement manquant.

## 8. Communication et notifications

**Annonces** : officielles, financières, convocations, travaux, coupures, sécurité, résultats de consultations, rapports, solidarité, projets. Dates de publication et d'expiration, catégorie.

**Notifications** : cotisations à échéance, paiements, réunions, PV, votes, décisions, projets, alertes, demandes de soutien, réponses aux réclamations. Canaux : application, e-mail, SMS, WhatsApp (intégration autorisée). Coût des SMS à budgéter.

**Accusés de lecture** : reçus, consultés, présences confirmées. Un accusé n'est pas une preuve juridique de notification.

## 9. Actions sociales et solidarité

**Demandes d'aide** : maladie grave, hospitalisation, décès, accident, difficulté exceptionnelle, sinistre, urgence communautaire.

**Circuit** : dépôt → accusé → vérification par la commission sociale → évaluation → proposition → validation → mobilisation → soutien → compte rendu → clôture. Règles d'éligibilité et montants fixés par la cité.

**Fonds de solidarité** : solde initial, contributions, dons, aides, dépenses, solde, historique, rapports. Reporting distinct, comptabilité intégrée. Aucune aide sans validation conforme.

**Dignité** : dossiers confidentiels, accès commission sociale, décisions publiables sans détails personnels (ex. « aide de 100 000 FCFA accordée »).

**Autres actions** : salubrité, sport et culture, cérémonies, enfants, personnes âgées, soutien scolaire, sensibilisation, collectes, vivre-ensemble. Responsable, budget, calendrier, bilan.

## 10. Infrastructures et cadre de vie

**Inventaire** : lampadaires, voies, canalisations, évacuations, espaces verts, aires de jeux, locaux, portails, sécurité, équipements collectifs. Localisation, photo, date d'installation, état, historique.

**Signalements** (photo, localisation) : éclairage, voirie, fuite, obstruction, dépôt sauvage, dégradation, sécurité, nuisance.

**Interventions** : référence, date, catégorie, priorité, responsable, délai cible, prestataire, budget, historique, preuve de résolution. Statuts : nouveau, en analyse, planifié, en intervention, résolu, rejeté avec motif. Le déclarant est informé.

**Cartographie (V3)** : lots, voies, équipements, incidents, travaux, projets. Aucune donnée personnelle sur la carte publique.

## 11. Réclamations et médiation

Objets : erreur de cotisation, dépense contestée, défaut d'entretien, problème administratif, communication, conflit d'usage, décision contestée, autre.

Circuit traçable : dépôt → enregistrement → accusé → affectation → analyse → réponse motivée → demande de réexamen → clôture. Délais indicatifs par type.

Médiation : espace confidentiel réservé aux personnes habilitées. Le logiciel n'est pas substitut à la médiation humaine ni aux procédures légales.

## 12. Documentation et archivage

Statuts, règlement de copropriété, documents constitutifs, règlements intérieurs, PV, convocations, rapports, budgets, factures, devis, contrats, travaux, décisions, assurances, correspondances, rapports de contrôle, archives de mandats.

Classement par catégorie, recherche (mot-clé, date, référence), versions, contrôle d'accès, téléchargement autorisé, historique des consultations sensibles, archivage par exercice ou mandat, sauvegardes périodiques. La version approuvée est conservée.

## 13. Tableaux de bord

| Profil | Indicateurs |
|---|---|
| Président | Membres, comptes actifs, recouvrement, trésorerie, budget consommé, dépenses à valider, projets, décisions en retard, réclamations ouvertes, actions sociales, réunions, alertes |
| Trésorier | Soldes caisses et comptes, recettes / dépenses du mois, cotisations, impayés, justificatifs manquants, paiements à faire, budget par catégorie, écarts de caisse, rapprochements, prévisions |
| Membre | Situation financière, échéances, annonces, réunions, projets, travaux, consultations, PV, décisions, actions, demandes, alertes |
| Développement | Projets réalisés / en cours / en retard, investissements, budget mobilisé, incidents résolus, participation, actions sociales, objectifs annuels |

## 14. Contrôle interne et audit

**Journal d'audit** (protégé contre modification et suppression, y compris par les administrateurs fonctionnels) : recettes, validation de dépense, paiement, annulation, budget, droits utilisateurs, documents, règles de validation, paramètres de trésorerie. Auteur, heure, objet, valeurs avant / après.

**Alertes** : dépassement budgétaire, dépenses similaires rapprochées, absence de justificatif, paiement sans validation, écart de caisse, annulation après validation, modification inhabituelle de droits, projet hors budget. Une alerte n'est pas une preuve de fraude.

**Contrôle périodique** : rapports mensuel, trimestriel, annuel, fin de mandat, anomalies détectées et corrigées, recommandations. Accès contrôleur indépendant des droits du trésorier.

## 15. Prestataires et achats

Répertoire : identité, prestations, documents, historique, contrats, devis, factures, paiements, évaluations.

Comparatif de devis : prix, délai, qualité technique, garantie, conditions de paiement, références, décision justifiée, rattachée à la décision de travaux.

Suivi contrats et travaux : signature, montant, échéances, avancement, paiements, retenues, réception, réserves, garanties, clôture.

## 16. Participation citoyenne

Boîte à idées (sécurité, environnement, infrastructures, solidarité, activités, finances, modernisation, développement économique). Priorisation collective des projets (consultative, ne remplace pas la décision de l'organe compétent). Calendrier communautaire partagé. Répertoire facultatif des compétences, visibilité selon préférences du membre.

## 17. Budget et prévisions

**Budget annuel** : recettes attendues, dépenses de fonctionnement, entretien, sécurité, social, investissements, réserve, échéancier.

**Simulations** : cotisation nécessaire à un projet, délai de collecte, part du budget engagée, financement simultané, impact d'une baisse de recouvrement, réserve travaux.

| Scénario | Hypothèse | Utilité |
|---|---|---|
| Prudent | Recettes inférieures | Anticiper les difficultés |
| Réaliste | Proches des prévisions | Budget de référence |
| Ambitieux | Recettes ou financements en plus | Étudier de nouveaux projets |

Les projections restent distinctes des montants réels.

## 18. Fonctions complémentaires

Urgences (coordonnées utiles, sans se présenter comme un service d'intervention) · assurances et sinistres · consommations communes (eau, électricité) · enquêtes de satisfaction (résultats agrégés) · rapport annuel de performance de la cité (finances, projets, travaux, difficultés, social, incidents, objectifs, priorités N+1).

## 19. Architecture technique

| Couche | Technologie | Fonction |
|---|---|---|
| Interface | HTML5, CSS3, JavaScript, PWA | Portails et tableaux de bord |
| Authentification | Supabase Auth | Connexion, sessions, MFA sensible |
| Base de données | PostgreSQL (Supabase) | Données structurées, RLS |
| Documents | Storage privé | Factures, PV, contrats, pièces |
| Notifications | E-mail, SMS, push | Alertes et rappels |
| Documents générés | PDF et Excel | États, rapports, reçus |
| Cartographie | Service adapté | Équipements |
| Sauvegardes | Automatiques + restauration testée | Continuité |
| Supervision | Journaux et alertes | Détection d'incidents |

**Principes** : séparation interface / données / règles métier ; droits appliqués au serveur et en base ; validation financière côté serveur ; transactions sur opérations critiques ; journalisation ; pagination ; requêtes optimisées ; sauvegardes et tests de restauration ; évolutivité sans réécriture.

> Aucune clé secrète dans le code public. RLS configurée et testée. Masquer un bouton ne protège rien.

## 20. Modèle de données principal

| Domaine | Tables |
|---|---|
| Membres | members, member_contacts, member_roles |
| Logements | lots, lot_ownerships, occupancies |
| Utilisateurs | profiles, roles, permissions, user_roles |
| Cotisations | contributions, contribution_calls, payments |
| Trésorerie | cash_accounts, cash_movements, bank_reconciliations |
| Dépenses | expense_requests, expense_approvals, expense_documents |
| Budgets | budgets, budget_lines, budget_commitments |
| Réunions | meetings, meeting_attendees, minutes, resolutions |
| Votes | consultations, ballots, votes, results |
| Projets | projects, project_tasks, project_milestones |
| Social | social_cases, social_aid_decisions, solidarity_fund_movements |
| Incidents | incidents, interventions, maintenance_assets |
| Prestataires | suppliers, quotes, contracts, work_orders |
| Communication | announcements, notifications, notification_receipts |
| Réclamations | complaints, complaint_updates, mediation_cases |
| Documents | documents, document_versions, document_permissions |
| Audit | audit_logs, security_events |

Paiements, cotisations et mouvements de trésorerie liés de façon cohérente (aucun double comptage). Droits appliqués par catégorie de données, pas seulement par page.

## 21. Sécurité, confidentialité, continuité

**Authentification** : connexion sécurisée, réinitialisation, expiration de session, authentification renforcée pour les fonctions sensibles, suspension d'un compte compromis, révocation des anciens responsables, limitation des tentatives.

**Autorisations** : chacun ne voit que ce qui relève de sa fonction. L'administrateur technique n'a pas automatiquement de droit de validation financière.

**Données** : politique de confidentialité, habilitations, durées de conservation, rectification, dossiers sensibles, sauvegardes sécurisées, gestion des incidents. Conformité à la loi ivoirienne n° 2013-450 du 19 juin 2013 (à vérifier selon les obligations du projet).

**Disponibilité** : supervision, sauvegardes, tests de restauration, reprise après incident, protection contre les accès frauduleux.

## 22. Ergonomie

Accueil personnalisé · navigation par thèmes (Ma cité, Finances, Réunions, Projets, Solidarité, Documents, Réclamations) · actions rapides (payer ou déclarer un paiement, reçu, rapport, incident, proposition, consultation, PV) · mobile d'abord · statuts compréhensibles · aide intégrée · pages légères adaptées aux réseaux modestes.

## 23. Organisation du projet

**Comité de pilotage** : présidence, trésorerie, secrétariat, représentants des membres, commission de contrôle, responsable informatique.

**Règles à valider avant développement** : qui crée, approuve, paie une dépense ; seuils ; documents accessibles ; publication des PV ; organisation des consultations ; droit de vote par catégorie ; archivage des décisions ; transmission des comptes entre bureaux ; traitement des réclamations ; règles du fonds de solidarité. Cohérence avec statuts, règlement de copropriété et textes applicables.

## 24. Phasage

| Phase | Contenu |
|---|---|
| **V1 — Transparence et gestion courante** | Membres et logements · portail individuel · cotisations · recettes et dépenses · circuit de validation · tableau de trésorerie · publication des états financiers · réunions · PV · annonces et notifications · archivage · journal d'audit · droits d'accès |
| **V2 — Participation et développement** | Planification stratégique · projets · budgets d'investissement · votes et consultations · réclamations · social et fonds de solidarité · infrastructures · incidents · prestataires · contrôle interne avancé · rapports automatisés · enquêtes |
| **V3 — Cité intelligente et durable** | Cartographie · géolocalisation · prévisions avancées · investissements pluriannuels · performance du syndic · automatisation · assurances et sinistres · évolution des charges · qualité de vie · aide à la décision par IA |

L'IA peut résumer, repérer les retards et signaler des anomalies. Elle n'autorise jamais seule un paiement, une sanction ni une aide sociale.

## 25. Indicateurs de performance

Taux de membres enregistrés · activation des comptes · recouvrement des cotisations · délai de validation des dépenses · part des dépenses avec justificatif · délai de publication des états · exécution du budget · exécution des projets · résolution des incidents · délai de traitement des réclamations · participation aux consultations · actions sociales réalisées · décisions exécutées dans les délais. Cibles définies après situation de référence.

## 26. Livrables

Cahier des charges validé · maquettes · architecture · modèle de données · application responsive · portail membres · administration du syndic · module financier · circuit de validation · états et rapports · réunions et PV · projets et planification · notifications · module social · documentation utilisateur et technique · procédure de sauvegarde et restauration · plan de tests · rapport de recette · formation · guide d'administration · transfert de responsabilités · mise en production · période de correction. Responsabilités développeur / syndic / hébergeur précisées.

## 27. Recette

| Domaine | Tests |
|---|---|
| Financier | Recette dans le bon état · paiement partiel correct · dépense non payable sans validations · annulation historisée · états conformes · engagements distingués des sorties |
| Gouvernance | Dossiers privés inaccessibles · validation hors habilitation refusée · PV versionnés · résultats = votes valides · changements de rôle tracés |
| Sécurité | Accès non autorisés refusés · fichiers privés non accessibles par lien public · RLS testée directement · révocation de sessions et comptes · restauration de sauvegarde · journalisation |
| Usage | Smartphone · connexion limitée · erreurs compréhensibles · informations retrouvables · rapports sans manipulation complexe |

## 28. Décisions stratégiques avant lancement

1. **Transparence** : états accessibles à tous (recettes, dépenses, trésorerie, budget, projets) avec protection des données personnelles.
2. **Validation** : le président peut-il engager seul ? Quels montants exigent double validation ou décision collective ?
3. **Cotisations** : obligatoires, facultatives, exceptionnelles ; qui modifie et comment.
4. **Votes** : qui vote, quelles décisions en ligne, lesquelles en assemblée formelle.
5. **Solidarité** : part des ressources, évaluateur, approbateur.
6. **Continuité** : l'historique demeure, les droits passent aux nouveaux responsables, les anciens accès sont révoqués.
7. **Propriété du logiciel** : cession, licence ou service ; accès aux données, sauvegarde, réversibilité, maintenance contractuels.

## 29. Positionnement

**Arc-en-Ciel Connect — plateforme numérique de gouvernance et de développement de la cité.** Quatre piliers : transparence financière · gouvernance participative · solidarité communautaire · développement durable. Le système reste utile quand les responsables changent.

## 30. Contrat de confiance numérique

Espace de redevabilité par période de gestion : objectifs annoncés, budget adopté, ressources collectées, dépenses engagées et payées, projets réalisés et en cours, retards expliqués, décisions, résultats, priorités suivantes. Bilan standardisé publié chaque trimestre.

| Engagement | Responsable | Échéance | Statut | Justificatif |
|---|---|---|---|---|
| Réparer l'éclairage de la voie principale | Commission technique | À définir | En cours | Rapport d'intervention |
| Publier le rapport financier trimestriel | Trésorerie | À définir | À publier | État financier |
| Organiser une journée de salubrité | Commission communautaire | À définir | Planifié | Compte rendu |

Outil de clarté, non de confrontation : remplacer les suspicions par des informations vérifiables, les promesses isolées par des engagements suivis.

---

**Conclusion** — Commencer par une V1 solide : portail des membres, trésorerie, validations, rapports périodiques, réunions, journal d'audit. Solidarité, infrastructures, planification stratégique et IA viennent ensuite.

*Arc-en-Ciel Connect · Application développée par Sanix Africa*
