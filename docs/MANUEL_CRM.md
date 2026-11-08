# Manuel de procédures — Commercial et CRM

**Réf.** PRO-CRM · **Version** 1.1 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour gérer les prospects, les ordres de mission terrain, les apporteurs d'affaires, les commissions et le plan d'action commercial.
**Principe directeur** : chaque prospect avance d'un stade à l'autre avec une date de relance ; chaque vente génère automatiquement la commission de son commercial et de son apporteur, payée sur preuve.

> Les noms de boutons sont ceux des modules **Pipeline Commercial**, **Ordres de Mission**, **Apporteurs d'affaire**, **Suivi souscripteurs**, **Rapports Commerciaux** et **Plan d'Action Commercial & Marketing**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Commercial** | Saisit et relance ses prospects, signe ses ventes |
| **Responsable commercial** | Répartit les prospects, valide les missions, suit les objectifs |
| **Comptabilité** | Paie les commissions, comptabilise les règlements |
| **Direction** | Valide taux, contrats d'apporteurs et campagnes |

## 2. Règles d'or

1. **Nom et téléphone** sont obligatoires pour tout prospect.
2. Chaque prospect a un **stade**, un **commercial** et une **date de relance**.
3. Faire signer à chaque apporteur un **contrat daté**, avec clause de non-contournement, avant tout apport.
4. Les commissions se calculent **sur les versements** : jamais saisies à la main.
5. Un ordre de mission exige chef, équipe, division, objet, destination et période.

## 3. Procédures

### CRM-01 — Enregistrer un prospect

**Où** : Pipeline Commercial › **+ Nouveau prospect**.

| Champ | Règle |
|---|---|
| **Nom, téléphone** | Obligatoires |
| E-mail, profession, commune | Recommandés |
| Programme, type de logement, budget | Qualification du besoin |
| **Source** | Origine du prospect |
| **Stade** | Prospects par défaut |
| **Commercial** | Responsable du prospect |
| Dates de contact et de relance, notes | Suivi |
| Position GPS | Bouton de capture pour placer le prospect sur la carte |

Enregistrer. Le badge du menu compte les prospects au stade « Prospects ».

### CRM-02 — Faire avancer le pipeline

Les stades se suivent dans cet ordre :

| # | Stade | Sens |
|---|---|---|
| 1 | Prospects | Contact à qualifier |
| 2 | Contacts | Premier échange fait |
| 3 | Visites planifiées | Rendez-vous fixé |
| 4 | Visites effectuées | Visite réalisée |
| 5 | Négociation | Offre en discussion |
| 6 | Convertis | Réservation, souscription |

1. Faire avancer le prospect d'un stade (bouton « Avancer ») ou le modifier.
2. Mettre à jour la **date de relance** à chaque contact.
3. Au dernier stade, **convertir en souscripteur** : procédure SOU-01 du manuel d'enregistrement.
4. Suivre le **tunnel de conversion** par stade.

### CRM-03 — Suivi des souscripteurs

**Où** : Suivi souscripteurs.

1. L'ERP classe chaque souscripteur : retard grave (3 mois et plus), en retard, nouveau (30 jours), financement bancaire, bientôt soldé (80 % et plus), soldé, à jour, résilié.
2. Chaque statut propose une **action** : relance ferme, relance amiable, appel de bienvenue, suivi du financement, préparation du solde, remise d'attestation, point de relation.
3. Utiliser le **message prêt** (WhatsApp ou e-mail) ; consigner l'action dans le journal de la fiche.
4. Remettre l'**accès portail** : onglet Accès portail, un souscripteur à la fois (« envoyer au suivant »).
5. Le **rapport automatique** (statuts, commerciaux, accès portail, retards prioritaires) s'imprime ou s'envoie.

Pour le recouvrement des retards : manuel Relances (PRO-REL).

### CRM-04 — Ordre de mission

**Où** : Ordres de Mission › **+ Nouvel ordre de mission**.

| Champ | Règle |
|---|---|
| **Chef de mission** | Obligatoire |
| **Équipe** | Au moins un agent ; le chef y est ajouté |
| **Divisions participantes** | Au moins une |
| **Objet, destination** | Obligatoires |
| **Période** | Dates de début et de fin ; la fin ne précède pas le début |
| Type, parcelle | Prospection commerciale ou portefeuille foncier |
| Transport | Véhicule de la société (choisi dans le parc auto) ou autre moyen ; immatriculation reprise du véhicule |
| Frais | Détail et total calculé |
| Statut | Planifiée, en cours, terminée, annulée |
| Instructions, compte rendu | Texte libre |

1. Enregistrer l'ordre ; l'imprimer pour l'équipe.
2. À la fin, saisir le **compte rendu** et le **PV de mission** structuré ; passer à « terminée ».

### CRM-05 — Apporteurs d'affaires

**Où** : Apporteurs d'affaire › **+ Nouvel apporteur**.

| Bloc | Champs |
|---|---|
| Identité | Nom et téléphone obligatoires ; prénoms, société, profession, pièce d'identité |
| **Contrat** | Date, durée (12 mois par défaut), date d'expiration, clause de non-contournement, programmes autorisés, clauses |
| **Commissions** | Taux sur souscription (10 % par défaut) et taux régulier (5 % par défaut), propres à l'apporteur |
| Paiement | Mode, banque, agence, IBAN, compte, Mobile Money |

1. Faire signer le contrat avant tout apport.
2. Modifier une fiche conserve le code d'accès portail et les statistiques de connexion.

### CRM-06 — Commissions

1. À chaque versement, l'ERP génère la commission du **commercial** et de l'**apporteur** du souscripteur, une seule fois par bénéficiaire.
2. Taux : celui de la fiche apporteur s'il est renseigné (même à 0 %), sinon le taux général des paramètres (10 % à la souscription, 5 % ensuite). Un deuxième mode calcule la commission sur la valeur du bien.
3. Les **frais de souscription** ne génèrent pas de commission, sauf option activée dans les paramètres.
4. Statut initial **à payer** ; la suppression d'un versement retire les commissions non payées.
5. **Paiement** : saisir mode, date, référence ; l'ERP passe l'écriture de règlement (caisse 571 ou banque 521 selon le mode).
6. Suivre les commissions dans Rapports Commerciaux.

### CRM-06 bis — Contrôler les commissions

**Qui** : comptabilité, responsable commercial. **Où** : Comptabilité › Commissions › **🔎 Contrôles commissions** (annuler, rattacher et réaffecter : managers). À faire chaque mois et avant tout paiement.

| Onglet | Ce qu'il repère | Action |
|---|---|---|
| **Orphelines** | Commission dont le versement n'existe plus (versement supprimé, souscripteur recréé à l'import) | **🔗 Rattacher** si un seul versement du souscripteur a la même date et le même montant ; sinon **🚫 Annuler** (la charge comptabilisée est extournée) |
| **Doublons** | Plusieurs commissions actives du même type pour un versement | On garde la plus ancienne ; les autres sont annulées et extournées |
| **Bénéficiaire ≠ fiche** | Le bénéficiaire n'est plus le commercial ou l'apporteur de la fiche du souscripteur | Vérifier qui a réellement apporté la vente, puis **↪ Réaffecter** à la personne de la fiche (le montant ne change pas) |
| **Versements sans commission** | Versements dont le souscripteur a un commercial ou un apporteur, sans commission (tableau par année) | Constat seul : le droit à commission des périodes anciennes est une décision de la direction |

**Règle** : une commission n'est jamais supprimée quand sa charge est comptabilisée ; elle est **annulée** (visible, avec motif) et sa charge **extournée**. Les commissions payées ne sont jamais touchées.

### CRM-06 ter — Payer les commissions par bénéficiaire

**Qui** : comptabilité (préparation), direction (validation). **Où** : Comptabilité › Commissions › **🧾 États de paiement**.

1. Le tableau regroupe, par bénéficiaire, les commissions « à payer » **saines** (versement et souscripteur existants, pas de doublon, souscripteur non résilié). Les autres sont exclues et comptées en bas, avec un lien vers les contrôles : les régulariser d'abord.
2. Un **⚠** signale les commissions dont le bénéficiaire diffère de la fiche (CRM-06 bis).
3. **🖨️ Bordereau** : imprime la liste (dossier, souscripteur, date du versement, base, taux, commission, total) avec les signatures *établi par*, *validé par* et *reçu par le bénéficiaire*.
4. **📨 Valider** : soumet le bordereau au circuit de validation (type « Bordereau de commissions »).
5. Une fois validé, **💰 Payer** règle en une fois les commissions validées du bénéficiaire : une référence, un mode (virement, espèces, chèque, Mobile Money), une confirmation. Le paiement est refusé tant que le bordereau n'est pas validé. Les écritures de règlement sont générées comme pour un paiement unitaire.

### CRM-07 — Plan d'action commercial et marketing (PAC)

**Où** : Plan d'Action Commercial & Marketing.

1. **Segments cibles** : définir les cibles et objectifs.
2. **Budget marketing** : fixer l'enveloppe.
3. **+ Nouvelle campagne** : saisir la campagne (onglet Campagnes).
4. **Calendrier** : planifier les actions.
5. **ROI & Performance** : analyser les résultats des campagnes.

### CRM-08 — Rapports commerciaux

**Où** : Rapports Commerciaux : performance, objectifs, commissions, analyses, impression. À lire chaque mois avec la direction.

### CRM-09 — Entonnoir commercial

**Qui** : direction commerciale. **Où** : Pipeline Commercial › **🔻 Entonnoir**.

1. Choisir la période d'entrée des prospects, puis au besoin la source, le commercial ou le programme.
2. Lire le **parcours** : prospects ayant atteint chaque étape, part qui passe à l'étape suivante, perdus à chaque étape, durée médiane. 🚧 marque le **goulot** (étape au plus faible passage, effectif d'au moins 5).
3. Lire le **levier n°1** : ventes en plus si ce passage gagnait 10 points (indicatif, pas une prévision).
4. Lire **Pourquoi on perd** : motifs classés, valeur perdue.
5. Comparer sources, commerciaux et programmes. Une ligne atténuée (⚠) a moins de 5 prospects : non concluante.
6. Relancer les **prospects dormants** (sans mouvement depuis 14 jours), classés par budget.

**Perdre un prospect** : bouton **✕** sur la carte, **motif obligatoire**. Le prospect quitte le pipeline ; **↩ Rouvrir** le remet en jeu.

> Chaque changement de stade est daté et attribué. Les prospects antérieurs à cette fonction sont comptés d'après leur stade actuel (mention « estimé »).

### CRM-10 — Scoring des prospects

**Qui** : commerciaux et direction. **Où** : Pipeline Commercial › **🎯 À appeler** et pastille sur chaque carte.

1. Le score (0 à 100) est **recalculé à chaque affichage** ; rien n'est saisi à la main.
2. Niveaux : 🔥 chaud (65 et plus), 🟠 tiède (40 à 64), ❄️ froid (moins de 40).
3. Survoler la pastille : détail des points par critère et action recommandée.
4. **🎯 À appeler** : les 25 prospects ouverts à traiter en premier (score, puis budget), avec appel et WhatsApp en un clic.
5. Dans chaque colonne du pipeline, les plus chauds sont en haut.

| Critère | Points | Lecture |
|---|---|---|
| Avancement | 30 | Plus le stade est avancé, plus le score monte |
| Fraîcheur | 20 | Dernier mouvement : 3 j ou moins = maximum, plus de 30 j = zéro |
| Budget | 15 | Budget comparé au prix du programme (ou au ticket moyen) |
| Source | 15 | Taux de conversion réel de la source (au moins 5 prospects, sinon neutre) |
| Joignabilité | 10 | Téléphone, e-mail, programme ciblé, commercial affecté |
| Suivi | 10 | Relance planifiée ; relance en retard = 2 points |

> Les poids sont des repères métier, pas un modèle appris. Les revoir quand au moins 50 prospects sont clos (convertis ou perdus).
> Un score bas sur un prospect « sans budget » signifie « à qualifier », pas « à abandonner ».

### CRM-11 — Classement des apporteurs

**Qui** : direction commerciale. **Où** : Apporteurs d'affaire › **🏆 Classement**. À consulter chaque mois.

1. Choisir la période (30 jours, 90 jours, 12 mois, depuis le début).
2. Le classement suit l'**argent encaissé** sur la période (versements des clients apportés, hors frais de souscription), pas le nombre de promesses de vente.
3. Lire pour chaque apporteur : part de l'encaissé, ventes et valeur vendue, résiliations, **coût de commission** (commissions ÷ encaissé), clients en retard, dernière vente.
4. Signaux : 💤 sans vente depuis 90 jours · 🕳 aucune vente depuis la signature (60 jours et plus) · ⚠️ 40 % ou plus de clients en retard (au moins 3 clients) · 📄 contrat expiré ou expirant sous 60 jours · 🔒 non-contournement non signé.
5. **Poids des 3 premiers** : au-delà de 80 % (avec plus de 3 apporteurs), le réseau dépend de trop peu de personnes.
6. **À réveiller** : 💬 ouvre WhatsApp avec un message prêt, 📞 appelle, ✏️ ouvre la fiche.
7. **⬇ CSV** : exporte le classement.

**Paliers** (ventes sur 12 mois) : Bronze 1 · Argent 3 · Or 6 · Platine 12. Ce sont des niveaux de reconnaissance ; aucune prime n'est calculée ni versée. Les seuils se modifient dans `params.apporteurs_paliers`.

> Les apporteurs suspendus ou résiliés ne sont jamais classés. Les commissions restent gérées par CRM-06.

### CRM-12 — Parrainage souscripteur

**Qui** : commerciaux (attribution), responsables (validation et versement), administrateur (règles). **Où** : Pipeline Commercial ou Suivi souscripteurs › **🤝 Parrainage**.

1. **Règles** (administrateur) : activer le programme, montant de la récompense, % du prix que le filleul doit avoir **versé**, plafond par parrain, parrain à jour exigé. Programme désactivé : aucune offre n'est annoncée.
2. **Solliciter** (onglet Ambassadeurs) : souscripteurs soldés ou à 50 % et plus, à jour. 💬 ouvre WhatsApp avec le message ; **Sollicité** date la demande (pas de relance avant 90 jours).
3. **Enregistrer un parrainage** : choisir le parrain, puis le filleul (prospect ou souscripteur). Le prospect passe en source « Parrainage » ; devenu souscripteur, il est retrouvé par son téléphone.
4. **Suivi** : un filleul est *éligible* quand l'argent versé atteint le seuil (frais de souscription exclus). Rien n'est créé automatiquement.
5. **✓ Valider** (responsable) : la récompense passe « à verser ». **Valider toutes** pour le lot.
6. **💰 Marquer versée** : mode et **référence obligatoires**, date. **✕** annule avec motif obligatoire.

| État | Sens |
|---|---|
| Refusé : auto-parrainage | Même fiche ou même téléphone que le parrain |
| Bloqué : parrain en retard | Règle « à jour exigé » |
| Parrain inactif / filleul résilié | Aucune récompense |
| Plafond atteint | Les plus anciens filleuls sont servis d'abord |

> Le paiement se fait hors module (caisse ou virement). Aucune écriture comptable n'est générée : la passer en comptabilité avec la référence du journal.
> Le journal vit dans la fiche du parrain (récompenses, demandes) et se synchronise avec elle.

## 4. Contrôles et blocages

| Contrôle | Effet |
|---|---|
| Prospect sans nom ou téléphone | Refusé |
| Ordre de mission sans chef, équipe, division, objet, destination ou période | Refusé |
| Fin de mission avant le début | Refusé |
| Apporteur sans nom ou téléphone | Refusé |
| Commission déjà générée pour le bénéficiaire | Pas de doublon |
| Frais de souscription | Pas de commission par défaut |
| Commission orpheline ou doublon dont la charge est comptabilisée | Annulée et extournée, jamais supprimée |
| Commission payée | Jamais modifiée par les contrôles |
| Bordereau non validé | Paiement groupé refusé |
| Commission orpheline, doublon ou souscripteur résilié | Exclue des états de paiement |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Prospect | Table des leads (stade, dates, commercial) |
| Action de suivi | Journal de la fiche souscripteur |
| Commission | Table des commissions (versement, taux, statut, règlement) |
| Ordre de mission | Table des ordres de mission, PV rattaché |

## 6. RACI

| Procédure | Commercial | Resp. commercial | Compta | Direction |
|---|---|---|---|---|
| CRM-01/02 Pipeline | R | A | – | I |
| CRM-03 Suivi souscripteurs | R | A | C | I |
| CRM-04 Ordre de mission | R | A | C | I |
| CRM-05 Apporteurs | C | R | I | A |
| CRM-06 Commissions | I | C | R | A |
| CRM-07 PAC | C | R | C | A |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Pas de commission sur un versement | Souscripteur sans commercial ni apporteur, ou frais de souscription | Renseigner la fiche, vérifier le paramètre |
| Mauvais taux de commission | Taux de la fiche apporteur | Corriger la fiche |
| Prospect absent de la carte | Pas de coordonnées GPS | Capturer la position |
| Commission restée après annulation | Déjà payée | Traiter manuellement |

## 8. Liste de contrôle hebdomadaire

1. ☐ Prospects relancés ; dates de relance à jour
2. ☐ Visites planifiées confirmées
3. ☐ Souscripteurs en retard traités (PRO-REL)
4. ☐ Missions clôturées avec compte rendu
5. ☐ Commissions à payer examinées
6. ☐ Contrôles commissions passés : aucune orpheline ni doublon en attente
7. ☐ Bordereaux validés avant tout paiement

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
| 1.1 | Octobre 2026 | Contrôles des commissions (orphelines, doublons, bénéficiaire ≠ fiche), états de paiement par bénéficiaire avec validation |
