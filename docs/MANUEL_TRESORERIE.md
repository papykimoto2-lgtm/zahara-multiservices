# Manuel de procédures — Trésorerie et prévisionnel

**Réf.** PRO-TRE · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour suivre la trésorerie de l'entreprise (encaissements, décaissements, solde cumulé) et construire le prévisionnel / business plan destiné à la direction et aux banques.
**Principe directeur** : la trésorerie se lit sur les mouvements réels (versements, caisse, écritures) ; le prévisionnel est un scénario daté, comparable au réel, figé quand il est envoyé à une banque.

> Les noms de boutons sont ceux des modules **Trésorerie** et **Prévisionnel / Business Plan**. Pour la caisse, voir le manuel Caisse (PRO-CAI).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Trésorier / comptable** | Suit les flux, rapproche, signale les écarts |
| **Direction** | Décide financements et décaissements, valide le prévisionnel |
| **Responsable financier** | Construit et fige les scénarios, prépare le dossier bancaire |

## 2. Règles d'or

1. La trésorerie se **lit** ; elle ne se saisit pas : les montants viennent des versements, des mouvements de caisse et des écritures.
2. Toute sortie de caisse non ventilée est **comptée** dans les décaissements ; la ventilation évite le double comptage.
3. Un prévisionnel envoyé à une banque est **figé** : on ne modifie plus la version transmise.
4. Une trésorerie négative au plus bas appelle un **financement** ou un décalage de dépenses.

## 3. Procédures

### TRE-01 — Lire la trésorerie

**Où** : Trésorerie. Choisir l'**année**.

1. Pour chaque mois : **encaissements** (versements des souscripteurs, paiements de cessions, entrées de caisse non rattachées à un versement), **décaissements** (charges comptabilisées de classe 6, sorties de caisse non encore comptées), **solde du mois** et **solde cumulé**.
2. Le filtre de division de la comptabilité s'applique : lire la trésorerie par entité.
3. Expliquer chaque écart important avec la comptabilité.

### TRE-02 — Contrôles mensuels de trésorerie

1. Comparer soldes banque, caisse et Mobile Money aux relevés et aux comptages (voir manuel Comptabilité, COM-07).
2. Vérifier que les sorties de caisse sont ventilées (voir manuel Caisse, CAI-07).
3. Suivre les échéances fournisseurs et clients à venir (Comptabilité › Comptes tiers › Échéances).
4. Alerter la direction si le solde cumulé devient négatif.

### TRE-03 — Construire un scénario de prévisionnel

**Où** : Prévisionnel / Business Plan.

1. **+ Nouveau** scénario (nom, hypothèses) ou **⚡ Pré-remplir depuis le programme** (lots, prix, calendrier de ventes).
2. Compléter les hypothèses : ventes, échéancier acheteurs, coûts, financement, taux d'actualisation, horizon, plafond de lots.
3. **📥 Reprendre les charges du Budget** : frais généraux, personnel, impôts et dotations repris du budget validé de l'exercice de départ (module Budget).
4. **💾 Enregistrer** ; une marque indique les modifications non enregistrées.

### TRE-04 — Lire les résultats

L'écran présente :

| Bloc | Contenu |
|---|---|
| Verdict bancaire | Nombre de critères satisfaits |
| Indicateurs | CA cumulé, résultat net, **VAN**, **TRI**, délai de récupération, **DSCR minimum** (cible 1,2), trésorerie minimum, seuil de rentabilité |
| Graphiques | CA et résultat, trésorerie cumulée, VAN par scénario |
| Sensibilité | Trois scénarios comparés |
| États | Compte d'exploitation (soldes SYSCOHADA), compte de résultat, plan de financement, trésorerie des 12 premiers mois |

Alertes : plafond de lots atteint ; trésorerie négative au plus bas ; échéances acheteurs après l'horizon.

### TRE-05 — Dossier bancaire

1. Vérifier le verdict et les alertes ; corriger les hypothèses si besoin.
2. **📌 Figer pour la banque** : la version et sa synthèse sont conservées telles quelles.
3. **🏦 Dossier bancaire PDF** : générer le document ; le transmettre.
4. Comparer plus tard le **prévisionnel figé** au réel (bloc d'écart par version).

### TRE-06 — Gérer les versions

1. **Supprimer** un scénario obsolète (confirmation demandée).
2. Conserver les versions figées : elles servent de preuve de ce qui a été annoncé à la banque.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Solde cumulé négatif | Alerte de trésorerie à traiter |
| Version figée | Non modifiable |
| Modifications non enregistrées | Marque visible avant de quitter |
| Plafond de lots atteint | Ventes arrêtées avant la fin de l'horizon |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Flux | Versements, mouvements de caisse, écritures (sources) |
| Scénario | Table des scénarios de prévisionnel |
| Version figée | Version horodatée avec hypothèses et synthèse |

## 6. RACI

| Procédure | Trésorier | Resp. financier | Direction |
|---|---|---|---|
| TRE-01/02 Lecture et contrôles | R | C | I |
| TRE-03 Scénario | C | R | A |
| TRE-04 Résultats | C | R | A |
| TRE-05 Dossier bancaire | C | R | A |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| Encaissements trop faibles | Versements non saisis, entrées de caisse non rattachées | Vérifier les sources |
| Décaissements incohérents | Sorties de caisse non ventilées | Ventiler (CAI-07) |
| Trésorerie négative au prévisionnel | Calendrier de ventes ou différé de financement | Ajuster hypothèses ou financement |
| Charges absentes | Budget non repris | Utiliser « Reprendre les charges du Budget » |

## 8. Liste de contrôle

1. ☐ Trésorerie du mois lue et expliquée
2. ☐ Sorties de caisse ventilées
3. ☐ Soldes rapprochés
4. ☐ Prévisionnel à jour, alertes traitées
5. ☐ Version bancaire figée avant envoi

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
