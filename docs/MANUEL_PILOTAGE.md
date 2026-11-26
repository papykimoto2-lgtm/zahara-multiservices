# Manuel de procédures — Pilotage (tableau de bord, validations, bilan de promotion, filière foncière)

**Réf.** PRO-PIL · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer comment la Direction lit les indicateurs, traite les décisions en attente, mesure la rentabilité d'un programme et suit la chaîne foncière.
**Principe directeur** : on pilote sur des **chiffres de l'ERP**, jamais sur des tableaux recopiés ; chaque alerte est **traitée** ou **justifiée**.

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Direction** | Lit le tableau de bord, décide les validations |
| **Contrôle de gestion** | Prépare bilan de promotion et suivi des écarts |
| **Responsable RH** | Lit le Cockpit RH |
| **Responsable foncier** | Suit la filière foncière |

## 2. Règles d'or

1. Choisir la **période** (mois, trimestre, année, tout) avant de comparer deux chiffres.
2. Les montants d'un tableau de bord dépendent du **périmètre** de l'utilisateur ; deux utilisateurs peuvent voir des totaux différents.
3. Une décision en attente se traite depuis **Validations**, pas par message.
4. Les hypothèses du simulateur sont **enregistrées** par programme.

## 3. Procédures

### PIL-01 — Lire le tableau de bord

**Où** : Tableau de bord.

1. Choisir la période.
2. Parcourir les onglets : Cockpit, Vue générale, Finance, Compta & Trésorerie, Commercial, Travaux, RH, Stock & Achats, Foncier, Juridique, Direction, Alertes.
3. Commencer par le **Cockpit** (briefing et file d'actions), finir par **Alertes**.

### PIL-01 bis — Actions de croissance du Cockpit

**Où** : Tableau de bord › **Cockpit**, dans la file d'actions (triée avec les autres règles). À traiter chaque matin.

| Action | Condition | Priorité |
|---|---|---|
| 🔮 Trésorerie négative prévue | Projection de base 13 semaines : solde négatif (urgent si dans 4 semaines ou moins) | 110 / 80 |
| 🔴 Programme à marge négative | Santé des marges | 88 |
| 📲 Relances WhatsApp prêtes | Campagne active, clients à relancer aujourd'hui | 84 |
| 💤 Négociations sans mouvement | Stade négociation, 7 jours sans mouvement | 82 |
| 🔥 Prospects chauds à appeler | Score de 65 et plus | 78 |
| ⏰ Relances prospects en retard | Date de relance dépassée | 72 |
| 🤝 Récompenses de parrainage à valider | Programme actif, seuil versé | 50 |
| 📄 Contrats d'apporteurs | Expirés ou sous 60 jours | 48 |
| 💤 Apporteurs dormants | 90 jours sans vente | 42 |

1. Chaque ligne ouvre directement l'écran qui permet d'agir.
2. **Reporter** ou **ignorer** une action ne la masque que pour la journée : elle revient demain si le problème persiste.
3. Les montants affichés sont l'**enjeu** (à recouvrer, budget en jeu, besoin de trésorerie), pas un chiffre d'affaires garanti.
4. Si une source de données échoue, les autres actions s'affichent quand même.

### PIL-02 — Cockpit RH

**Où** : Cockpit RH.

1. Choisir la période.
2. Lire effectif, masse salariale, pyramide des âges, tendance de la masse salariale, départements, absentéisme.
3. Traiter les **alertes & actions RH**.

### PIL-03 — Traiter les validations

**Où** : Validations.

1. Parcourir les cinq files : mouvements de caisse, engagements de dépense, transferts budgétaires, budget prévisionnel, réapprovisionnement.
2. Pour chaque ligne, ouvrir, décider (valider ou rejeter avec motif) selon les procédures de PRO-CAI (caisse et réapprovisionnement) et PRO-BUD (budget).
3. Consulter l'historique par file.

### PIL-04 — Bilan de promotion

**Où** : Bilan de Promotion.

1. Choisir le programme.
2. Lire les indicateurs : produits engagés (logements, terrains), coûts, marge actuelle et potentielle, ROI, TRI annualisé, coût par lot, prix de revient au m², cash net.
3. Examiner produits, coûts, compte de résultat, cash-flow, seuil de rentabilité, prévisionnel de trésorerie sur 12 mois, alertes, classement des programmes.
4. **Imprimer** pour le comité.

### PIL-04 bis — Santé des marges

**Où** : Bilan de Promotion, bloc **🚦 Santé des marges** (tous les programmes). À consulter chaque mois.

1. Régler la **marge cible** (15 % par défaut).
2. Lire le statut : 🔴 marge négative · 🟠 sous la cible · 🟢 dans la cible. La marge est jugée **nette des commissions à venir** quand elles sont observables.
3. Traiter d'abord les **⚠ données incomplètes** : foncier absent, aucun marché de travaux pour des logements, lots sans prix, encaissements sans commission. Une marge élevée sur des coûts manquants est trompeuse.
4. Lire le **prix moyen plancher** : prix minimal moyen des lots restants pour tenir la marge cible sur toute l'opération, face au prix catalogue actuel et à la remise maximale possible. Si le plancher dépasse le catalogue, la cible n'est plus atteignable sans revoir les prix ou les coûts.
5. Cliquer une ligne pour ouvrir le détail du programme.

> **Frais commerciaux** : les commissions réelles (commercial et apporteur, hors annulées) sont comptées dans les coûts du programme. Elles ne l'étaient pas auparavant, ce qui surévaluait les marges.
> **Commissions à venir** : taux réellement observé sur le programme × reste à encaisser. Jamais un taux supposé.

### PIL-04 ter — Prix dynamique des lots

**Qui** : direction commerciale (lecture), responsables (application), administrateur (réglages). **Où** : Lots › **💹 Prix dynamique**.

1. Pour chaque programme, lire le **signal** : lots disponibles, ventes sur 90 jours (et les 90 jours d'avant), mois de stock au rythme actuel, prospects chauds.
2. L'ERP propose :
   - **📈 Hausse** (+5 % par défaut) : au moins 3 ventes sur 90 jours, 2 mois de stock ou moins, au moins un prospect chaud par lot disponible ;
   - **📉 Baisse ciblée** (−5 %) : 12 mois de stock ou plus et peu de prospects chauds ; **seuls les lots anciens** (180 jours par défaut) sont concernés ;
   - **⏸ Maintenir** dans les autres cas.
3. **Plancher de marge** : une baisse ne descend jamais sous coût de revient du lot ÷ (1 − marge cible). Sans coût de lot, le plancher du programme (Santé des marges) s'applique, **s'il est fiable**. Sinon la baisse est **⛔ bloquée** : compléter les coûts, ou agir sur le financement ou le produit.
4. Cocher les lots retenus puis **Appliquer la sélection** (responsable) : confirmation avec la variation cumulée.
5. Chaque changement est tracé dans l'**historique du lot** (date, ancien et nouveau prix, motif, auteur). Un lot vendu ou réservé n'est jamais modifié ; si le prix a changé entre-temps, la ligne est refusée.
6. **Mesurer** : relire le signal 30 jours plus tard. Une proposition est un **test**, pas une promesse de volume.

> Les prix sont arrondis (50 000 F par défaut). Les prix déjà acceptés par des souscripteurs ne changent pas. Réglages (pas, seuils de stock, arrondi, ancienneté) dans le bloc « Réglages ».

### PIL-05 — Plan de financement

1. Ajouter une ligne de financement : **montant prévu obligatoire**.
2. Modifier ou supprimer au fil des déblocages.

### PIL-06 — Simulateur de montage (compte à rebours foncier)

1. Sélectionner un programme ; **Pré-remplir du réel**.
2. Ajuster : chiffre d'affaires, surface, coût de construction, honoraires, frais commerciaux, frais financiers, gestion, aléas, marge cible.
3. Lire la **charge foncière admissible** (prix maximum du terrain qui préserve la marge cible) et le comparer au prix demandé.
4. **Enregistrer l'hypothèse**.

### PIL-07 — Filière foncière

**Où** : Filière Foncière.

1. Vue d'ensemble : opérations, superficie maîtrisée, lots créés, vendus et cédés, trésorerie des cessions ; tableau par opération et parcelle avec son **étape**.
2. Choisir une opération pour suivre la chaîne : opération → parcelle / titre → morcellement → lots → cessions.
3. **Actualiser** avant une réunion.

## 4. Traçabilité

Les indicateurs sont calculés à la demande depuis les données ; l'hypothèse du simulateur est enregistrée par programme.

## 5. RACI

| Étape | Direction | Contrôle de gestion | RH | Foncier |
|---|---|---|---|---|
| PIL-01 | R/A | C | I | I |
| PIL-02 | I | I | R/A | I |
| PIL-03 | R/A | C | I | I |
| PIL-04/05/06 | A | R | I | C |
| PIL-07 | I | C | I | R/A |

## 6. Erreurs fréquentes

- Comparer deux périodes différentes.
- Prendre les totaux d'un utilisateur restreint pour le total du groupe.
- Oublier d'enregistrer l'hypothèse du simulateur.
- Laisser des alertes sans réponse.

## 7. Liste de contrôle

- [ ] Alertes du jour traitées
- [ ] Validations en attente vidées
- [ ] Bilan de promotion à jour avant chaque comité

## 8. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
