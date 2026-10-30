# Manuel de procédures — TVA déductible et facture normalisée des fournisseurs (FNE)

**Réf.** PRO-TVA · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi, dans quel ordre et avec quelle preuve pour **récupérer la TVA** payée sur les achats, notamment en quincaillerie : bon d'achat, facture normalisée électronique (FNE) du fournisseur, justification de la TVA, suivi des fournisseurs, politique d'achat par seuil et rapprochement mensuel avant la déclaration.
**Principe directeur** : la TVA d'un achat n'est récupérable que sur une **FNE établie au nom et au NCC de l'entreprise**. Sans cette pièce, la TVA est perdue : l'entreprise supporte jusqu'à 18 % de l'achat.

> Les noms de boutons sont ceux de **Budget › Demandes d'Achat**, de **Comptabilité › Justif. TVA** et de **Comptabilité › TVA** (déclaration).
> **Réserve** : les conditions de déductibilité rappelées ici sont celles publiées par la DGI et par des sources spécialisées. Elles sont à faire valider par le conseil fiscal de l'entreprise avant d'activer la politique « stricte » (TVA-08).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Acheteur / chantier** | Retire le bon d'achat, exige la FNE chez le fournisseur, la rapporte sous 48 h |
| **Direction / validateur** | Valide les demandes d'achat ; motive toute dérogation à la politique d'achat |
| **Comptabilité** | Enregistre la FNE, justifie les pièces, qualifie les fournisseurs, tient le rapprochement mensuel |
| **Caisse / trésorerie** | Règle l'achat ; ne règle pas sans demande d'achat validée |
| **Responsable fiscal / DAF** | Valide le rapprochement, décide de la politique de déduction, dépose la déclaration |

## 2. Règles d'or

1. **Pas d'achat sans bon d'achat** : le bon rappelle ce qui est autorisé et exige la FNE.
2. **La FNE se demande avant la facture** : communiquer le NCC de l'entreprise au fournisseur *avant* l'établissement de la facture, pas après.
3. **Pas de FNE, pas de TVA déduite** : un reçu, un ticket ou une facture manuscrite ne suffit pas.
4. **La FNE se rapporte sous 48 h** ; au-delà, la demande d'achat apparaît « en retard ».
5. **Une FNE ne justifie qu'une dépense** (sauf règlement en plusieurs pièces, à expliquer).
6. **Aucune pièce n'est modifiée dans la comptabilité** : le logiciel ajoute une justification, il ne touche pas aux écritures.
7. **Les pièces datées d'avant le 01/12/2025 ne sont pas contrôlées** (la FNE n'était pas encore obligatoire).
8. **Le rapprochement se fait avant la déclaration**, jamais après le dépôt.

## 3. Vue d'ensemble du circuit

| Étape | Où | Résultat |
|---|---|---|
| Demande d'achat validée | Budget › Demandes d'Achat | Engagement budgétaire, numéro DA |
| Bon d'achat remis à l'acheteur | 🧾 sur la ligne de la DA | Instructions et NCC de l'entreprise |
| Achat chez le fournisseur | Quincaillerie, etc. | FNE à notre NCC |
| Règlement | Caisse | DA « payée », écriture de dépense |
| FNE enregistrée | 📥 sur la ligne de la DA | TVA de la dépense justifiée automatiquement |
| Suivi et rapprochement | Comptabilité › Justif. TVA | Fournisseurs, manque à gagner, état « prêt à déclarer » |
| Déclaration de TVA | Comptabilité › TVA | Liquidation avec TVA justifiée |

## 4. Procédures

### TVA-01 — Préparer l'entreprise (une fois)

**Qui** : administrateur, comptabilité.

1. Vérifier que le **NCC**, l'adresse, le RCCM et le téléphone de l'entreprise sont renseignés dans **Paramètres › Société** : ils figurent sur le bon d'achat.
2. Vérifier le **régime** et le **prorata de déduction** dans **Comptabilité › TVA** (déclaration).
3. Informer les fournisseurs habituels : l'entreprise exige désormais la FNE à son NCC.
4. Désigner qui valide le rapprochement mensuel (TVA-08).

### TVA-02 — Émettre le bon d'achat

**Qui** : validateur ou comptabilité. **Où** : **Budget › Demandes d'Achat**, bouton **🧾**.

| Condition | Règle |
|---|---|
| Demande d'achat | Doit être **validée** (la fiche porte un numéro DA) |
| Contenu du bon | Entreprise et NCC, acheteur autorisé, fournisseur, objet, **montant maximum TTC**, lignes autorisées, validité 7 jours, signatures |
| Encadré FNE | Consignes à l'acheteur (TVA-03) |
| Coupon détachable | N° de FNE, date, montant TTC, dont TVA, présence du NCC, reçu par la comptabilité |
| Réimpression | Marquée **DUPLICATA** |

1. Ouvrir la demande d'achat validée et cliquer **🧾**.
2. Imprimer le bon et le remettre à l'acheteur avec le coupon.
3. La ligne passe à l'état **Bon remis**.

### TVA-03 — Acheter chez le fournisseur (acheteur)

1. Présenter le bon d'achat et **annoncer le NCC** de l'entreprise avant la facturation.
2. Faire établir la **FNE au nom de l'entreprise** ; ne pas accepter un reçu ou une facture manuscrite.
3. **Vérifier avant de payer** : logo FNE, QR code, numéro de facture, NCC de l'entreprise, TVA détaillée, montant conforme au bon.
4. Ne pas dépasser le montant maximum du bon ; au-delà, repasser par une nouvelle demande.
5. Rapporter la FNE et le coupon renseigné à la comptabilité **sous 48 h**.
6. Si le fournisseur refuse ou ne peut pas délivrer de FNE : ne pas contourner ; signaler à la comptabilité (TVA-04, « sans FNE »).

### TVA-04 — Enregistrer la FNE reçue

**Qui** : comptabilité. **Où** : **Budget › Demandes d'Achat**, bouton **📥**.

| Champ | Règle |
|---|---|
| **Pièce remise** | « FNE reçue » ou « Aucune FNE délivrée » |
| **N° de la FNE** | Obligatoire si FNE reçue |
| **Montant TTC**, **dont TVA** | Repris de la FNE ; la TVA doit correspondre à la TVA comptabilisée (écart toléré : 1 FCFA) |
| **NCC présent** | À cocher seulement si le NCC de l'entreprise figure sur la FNE |

1. Ouvrir 📥 sur la ligne de la demande d'achat.
2. Saisir les champs et enregistrer.
3. La TVA de l'écriture de la dépense est **justifiée automatiquement** dans Justif. TVA ; le fournisseur y est repris.

| État de la colonne FNE | Sens | Suite |
|---|---|---|
| Bon à remettre / Bon remis | DA validée, pas encore payée | TVA-02, TVA-03 |
| FNE attendue | Payée depuis moins de 48 h | Relancer l'acheteur si besoin |
| **FNE en retard** | Payée depuis plus de 48 h sans FNE | Réclamer la FNE ou enregistrer « sans FNE » |
| FNE reçue | FNE enregistrée | Aucune |
| Sans FNE | Le fournisseur n'a rien délivré | TVA non récupérable ; qualifier le fournisseur (TVA-06) |

### TVA-05 — Justifier une pièce hors demande d'achat

**Qui** : comptabilité. **Où** : **Comptabilité › Justif. TVA › 🧾 Pièces à justifier**.

1. Choisir la période (les pièces antérieures au 01/12/2025 ne sont pas listées).
2. Filtrer sur **À traiter** (à justifier et non déductibles).
3. Cliquer **Justifier** sur la pièce, choisir : FNE reçue, fournisseur sans FNE, ou fournisseur non assujetti.
4. Pour une FNE : numéro, TVA indiquée, case « NCC présent ». Corriger au besoin le **nom du fournisseur**.

| État | Sens |
|---|---|
| **Conforme** | FNE enregistrée, NCC présent, TVA concordante |
| **À justifier** | Aucune FNE ou numéro manquant |
| **Non déductible** | NCC absent, TVA différente, fournisseur sans FNE ou non assujetti |
| Avant FNE | Pièce antérieure au 01/12/2025, non contrôlée |

### TVA-06 — Qualifier et suivre les fournisseurs

**Qui** : comptabilité, direction. **Où** : **Justif. TVA › 🏪 Fournisseurs**.

1. Lire le classement par TVA non récupérée : pièces, TVA récupérable, perdue et à justifier, taux de conformité, tendance sur 3 mois.
2. Un fournisseur à **95 % ou plus** est « FNE délivrée » ; à **0 %** (au moins 2 achats) il est « Sans FNE ».
3. Dans la colonne **Qualification d'achat**, laisser « Auto » ou forcer **✓ Agréé** / **✗ Interdit**. Un nouveau fournisseur sans historique se qualifie avec le formulaire « Qualifier un fournisseur » (nom exact).
4. Pour un fournisseur « Sans FNE » : exiger la FNE, ou le remplacer.
5. Exporter en CSV pour la revue trimestrielle des fournisseurs.

### TVA-07 — Politique d'achat par seuil

**Qui** : direction (décision), comptabilité (réglage). **Où** : **Justif. TVA › Fournisseurs › Politique d'achat par seuil**.

| Réglage | Effet |
|---|---|
| **Politique** | Désactivée par défaut |
| **Seuil (FCFA TTC)** | Montant à partir duquel le contrôle s'applique |
| **Avertir** | Le demandeur, puis le validateur, confirment pour continuer |
| **Bloquer sauf dérogation** | Le validateur doit saisir un motif d'au moins 5 caractères ; sans motif, la validation est refusée |

1. Activer d'abord en mode **Avertir** pour mesurer le nombre de demandes concernées.
2. Passer en **Bloquer** quand les fournisseurs habituels sont qualifiés.
3. À la validation d'une demande au-dessus du seuil chez un fournisseur non qualifié, le validateur motive la dérogation : elle est conservée (motif, auteur, date) et signalée par un badge **dérogation fournisseur**.
4. Le contrôle ne couvre que les **demandes d'achat** ; un achat de caisse direct n'est pas contrôlé.

### TVA-08 — Rapprochement mensuel avant la déclaration

**Qui** : comptabilité (préparation), DAF (validation). **Où** : **Justif. TVA › ✅ Rapprochement du mois** ou bouton **✅ Rapprochement** de la déclaration. **Quand** : chaque mois, avant la liquidation (échéance : le 15 du mois suivant).

| Point contrôlé | Niveau |
|---|---|
| Mois précédent liquidé | **Bloquant** s'il a de la TVA non liquidée |
| Pièces du mois sans FNE valide | À traiter |
| Arriéré des mois précédents | À traiter |
| FNE utilisée sur plusieurs pièces | À traiter |
| Pièces sans fournisseur identifié | À traiter |
| Demandes d'achat payées sans FNE depuis plus de 48 h | À traiter |
| Achats au-dessus du seuil validés par dérogation | À traiter |
| Factures de vente non certifiées | À traiter |
| Liquidation déjà passée, échéance, paramètres | Information |

1. Choisir le mois à déclarer (le mois précédent est proposé).
2. Résoudre les points **bloquants**, puis traiter chaque point à traiter avec son bouton d'action.
3. **Imprimer le rapprochement** (deux signatures : comptabilité et direction).
4. **Valider le rapprochement** : le logiciel enregistre qui, quand et le nombre de réserves. Si des pièces changent après, un avertissement l'indique.
5. Ouvrir la déclaration du mois et passer la liquidation. Si le rapprochement est non validé ou non prêt, une confirmation est demandée.

| Politique de déduction | Effet à la liquidation |
|---|---|
| **Signaler** (défaut) | Déclaration inchangée ; la TVA sans FNE reste déduite et est signalée |
| **Stricte** | Seule la TVA justifiée par une FNE conforme est déduite ; le reste passe en **charge (compte 6461)** |

Recommandation : rester en **signaler** tant que l'arriéré n'est pas résorbé ; passer en **stricte** sur décision du DAF, après avis du conseil fiscal.

### TVA-09 — Vérification assistée de la FNE reçue

**Qui** : comptabilité. **Où** : fenêtre d'enregistrement de la FNE (📥 sur la demande d'achat, ou **Justifier** dans Justif. TVA).

La DGI ne publie pas d'interface permettant de vérifier une FNE automatiquement. La vérification reste donc **faite par une personne**, sur le site officiel, et le logiciel en garde la trace.

1. Coller le **lien du QR code** de la FNE (adresse de vérification de la DGI).
2. Cliquer **🔎 Vérifier sur le site de la DGI** : la page officielle s'ouvre. Seules les adresses du domaine de la DGI sont ouvertes.
3. Comparer à l'écran : **fournisseur**, **NCC de l'entreprise** et **montant TTC** avec la FNE papier.
4. Cocher **« Vérifiée sur le site de la DGI »** : le logiciel enregistre qui et quand.
5. Une FNE dont le lien n'ouvre pas une page valide, ou dont les données diffèrent, est **refusée** : enregistrer « sans FNE » et alerter le responsable.
6. Contrôle croisé recommandé en fin de mois : la FNE doit aussi figurer dans l'onglet **« Reçus et factures réceptionnés »** de l'espace FNE de l'entreprise sur la plateforme de la DGI.

Une FNE non vérifiée reste comptée comme conforme si les autres conditions sont remplies, mais elle est signalée dans le rapprochement mensuel.

### TVA-10 — Suivi du manque à gagner

**Qui** : direction, DAF. **Où** : **Justif. TVA › 📉 Manque à gagner**. **Quand** : revue mensuelle puis trimestrielle.

1. Lire les totaux de la période : TVA sur achats, récupérable, perdue, à justifier, taux de récupération.
2. Lire les ventilations par fournisseur, par mois et par programme (par acheteur si l'auteur est renseigné sur les pièces).
3. Décider : changer de fournisseur, renégocier, former les acheteurs, abaisser le seuil de la politique d'achat.

## 5. Traçabilité

| Élément | Où il est conservé |
|---|---|
| Justification d'une pièce | Sur l'écriture comptable (numéro de FNE, TVA, NCC, fournisseur, date) |
| FNE d'une demande d'achat | Sur la demande d'achat (suivi, état, date, auteur) |
| Dérogation d'achat | Sur la demande d'achat (motif, auteur, date) |
| Rapprochement validé | Dans les paramètres TVA (mois, auteur, date, nombre de réserves) |
| Qualification d'un fournisseur | Dans les paramètres TVA (statut, auteur, date) |

## 6. RACI

| Étape | Acheteur | Compta | Direction / DAF | Caisse |
|---|---|---|---|---|
| TVA-01 | I | R | A | I |
| TVA-02 | I | R | A | I |
| TVA-03 | R/A | I | I | I |
| TVA-04 | C | R/A | I | I |
| TVA-05 | I | R/A | I | I |
| TVA-06 | I | R | A | I |
| TVA-07 | I | R | A | I |
| TVA-08 | I | R | A | I |
| TVA-09 | I | R/A | I | I |
| TVA-10 | I | R | A | I |

## 7. Erreurs fréquentes

- Demander la FNE **après** avoir payé, ou sans donner le NCC : la facture est établie sans NCC et la TVA est perdue.
- Accepter un ticket de caisse, un reçu ou une facture manuscrite.
- Dépasser le montant du bon d'achat sans nouvelle demande.
- Enregistrer la FNE sans cocher « NCC présent » alors qu'il manque : la pièce devient non conforme.
- Saisir une TVA différente de celle comptabilisée.
- Laisser les fournisseurs sans nom : le classement et le suivi sont faussés.
- Passer en politique stricte avant d'avoir résorbé l'arriéré : la TVA de toutes les pièces non justifiées est alors exclue.
- Déclarer sans valider le rapprochement.

## 8. Liste de contrôle

**Avant l'achat**
- [ ] Demande d'achat validée et bon d'achat remis
- [ ] NCC de l'entreprise communiqué au fournisseur

**Après l'achat (48 h)**
- [ ] FNE rapportée avec le coupon
- [ ] FNE enregistrée (📥) et vérifiée (TVA-09)

**Chaque mois, avant la déclaration**
- [ ] Mois précédent liquidé
- [ ] Aucune demande d'achat « en retard » sans explication
- [ ] Pièces à justifier traitées ou expliquées
- [ ] Rapprochement imprimé, signé et validé

## 9. Limites à connaître

- Le logiciel ne vérifie pas lui-même l'authenticité d'une FNE : TVA-09 repose sur un contrôle humain.
- Seules les pièces comportant de la TVA déductible (comptes 445x) sont suivies.
- Le lien automatique FNE → écriture ne joue que pour les dépenses passées par une **demande d'achat payée en caisse** ; les autres pièces se justifient à la main (TVA-05).
- La validité du bon (7 jours) et le délai de la FNE (48 h) sont fixés par le logiciel.
- Le fournisseur est reconnu par son **nom** (sans tenir compte des accents ni des majuscules).

## 10. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
