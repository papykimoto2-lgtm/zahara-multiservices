# Manuel de procédures — Stock : matériaux et fournitures

**Réf.** PRO-STK · **Version** 1.0 · **Date** Octobre 2026
**Objet** : fixer qui fait quoi pour approvisionner, sortir, transférer et inventorier les stocks de matériaux et de fournitures, valorisés au coût unitaire moyen pondéré (CUMP).
**Principe directeur** : chaque mouvement est daté, rattaché à un dépôt et à un article, et génère son écriture comptable ; le stock réel se compare au stock théorique par inventaire.

> Les noms de boutons sont ceux du module **Stock — Matériaux & Fournitures**. Pour les achats sur bon de commande, voir le manuel Achats (PRO-ACH).

---

## 1. Rôles

| Rôle | Responsabilités |
|---|---|
| **Magasinier** | Enregistre entrées, sorties, transferts et inventaires |
| **Chef de chantier** | Demande les sorties, justifie les consommations |
| **Comptabilité** | Contrôle les écritures de stock et d'achat |
| **Direction** | Valide les écarts d'inventaire significatifs |

## 2. Règles d'or

1. **Un article, un dépôt** : le magasin central ne peut pas être supprimé.
2. Une sortie ne dépasse **jamais** le stock disponible au dépôt.
3. Le **matériel réutilisable** (outillage) ne se consomme pas : il se **transfère** vers le dépôt du chantier.
4. La valorisation suit le **CUMP** ; les frais d'approche s'ajoutent au coût d'acquisition.
5. Un dépôt non vide ne se supprime pas.

## 3. Procédures

### STK-01 — Catalogue et dépôts

1. **Catalogue** : créer chaque article (**➕ Nouvel article**) avec unité ; chercher avant de créer.
2. **Dépôts** : ajouter un dépôt par chantier ou par usage ; les fournitures disposent d'un dépôt dédié avec ses propres comptes.
3. Renseigner le **seuil d'alerte** et la case « réutilisable » à la première entrée.

### STK-02 — Entrée (approvisionnement direct)

**Où** : **➕ Entrée (appro)**.

| Champ | Règle |
|---|---|
| **Article** ou désignation libre | Obligatoire |
| **Quantité** | Supérieure à zéro |
| Prix unitaire HT, frais d'approche | Coût d'acquisition = HT + frais |
| Dépôt | Magasin central par défaut |
| Fournisseur | Détermine le compte et l'AIRSI |
| **Mode** | À crédit (compte fournisseur) ou **comptant** (compte de trésorerie obligatoire) |
| TVA | Déductible 18 %, non déductible, exonérée |
| Écriture | Case « générer l'écriture comptable » |

1. Enregistrer : le mouvement est créé ; le CUMP est recalculé.
2. L'écriture passe : achat (ou achat fournitures) au débit, fournisseur ou trésorerie au crédit ; **TVA déductible** et **AIRSI** (si le fournisseur y est soumis) en écritures séparées.

**[bloquant]** Article et désignation absents ; quantité nulle ; comptant sans compte de trésorerie ; compte d'achat, de TVA ou d'AIRSI non paramétré.

### STK-03 — Sortie (consommation, perte)

**Où** : sortie de stock.

1. Choisir le **dépôt**, l'**article**, la **quantité**, la **nature** (consommation sur chantier, perte ou casse) et le **chantier**.
2. Valider : la sortie est valorisée au **CUMP**.
3. En stock permanent : écriture de consommation (ou de **perte/casse**) au coût de sortie.

**[bloquant]** Stock insuffisant ; quantité nulle ; consommation d'un matériel réutilisable (utiliser un transfert).

### STK-04 — Transfert entre dépôts

1. Choisir dépôt **source** et **destination** (différents), article, quantité, motif.
2. Valider : sortie du source, entrée à la destination ; **pas d'écriture** (même propriétaire).

**[bloquant]** Dépôts identiques ; stock insuffisant à la source.

### STK-05 — Inventaire

**Qui** : magasinier, avec un témoin. **Où** : inventaire.

1. Choisir dépôt et article ; saisir le **stock physique compté**.
2. L'ERP affiche l'**écart** en quantité et en valeur (écart × CUMP).
3. Saisir le **motif** ; enregistrer : un mouvement « ajustement » remet le stock au comptage.
4. En stock permanent, l'écart d'inventaire (**boni** ou **mali**) passe en écriture.

### STK-06 — Suivi et analyse

| Onglet | Usage |
|---|---|
| État des stocks | Quantités, CUMP, valeur, alertes de seuil |
| Par dépôt | Stock de chaque dépôt |
| Mouvements | Journal de tous les mouvements |
| Consommation par chantier | Coût consommé par chantier |
| Marge chantiers | Marge des chantiers |

### STK-07 — Corriger ou supprimer un mouvement

**Où** : journal des mouvements › supprimer. Confirmer : les écritures liées (achat, TVA, AIRSI, entrée en stock, consommation, écart d'inventaire) sont supprimées avec le mouvement. **[bloquant]** Écriture d'un exercice clôturé : suppression refusée ; contre-passer (Comptabilité) et saisir le mouvement correct.

## 4. Contrôles

| Contrôle | Effet |
|---|---|
| Sortie supérieure au stock | Refusée |
| Consommation de matériel réutilisable | Refusée |
| Transfert vers le même dépôt | Refusé |
| Suppression du magasin central ou d'un dépôt non vide | Refusée |
| Compte comptable manquant | Rien n'est enregistré, message précis |

## 5. Traçabilité

| Événement | Conservé dans |
|---|---|
| Mouvement | Table des mouvements de stock (type, quantité, dépôt, date) |
| Écriture | Journal comptable (ACH-, SOR-, PRT-, INV-) |
| Seuil, réutilisable | Paramètres du stock |

## 6. RACI

| Procédure | Magasinier | Chef de chantier | Comptabilité | Direction |
|---|---|---|---|---|
| STK-01 Catalogue | R | C | I | I |
| STK-02 Entrée | R | I | C | I |
| STK-03 Sortie | R | R | I | I |
| STK-04 Transfert | R | C | – | – |
| STK-05 Inventaire | R | C | C | A |

## 7. Erreurs fréquentes

| Symptôme | Cause | Action |
|---|---|---|
| « Stock insuffisant » | Entrée non saisie ou mauvais dépôt | Vérifier l'état du dépôt, saisir l'entrée |
| Valeur de stock inattendue | CUMP faussé par un prix mal saisi | Corriger le mouvement concerné |
| Pas d'écriture générée | Case décochée | Régénérer ou saisir l'écriture |
| Consommation refusée | Matériel réutilisable | Utiliser un transfert |

## 8. Liste de contrôle mensuelle

1. ☐ Entrées et sorties saisies et rattachées
2. ☐ Écritures vérifiées
3. ☐ Inventaire tournant fait, écarts motivés
4. ☐ Seuils d'alerte examinés

## 9. Révisions

| Version | Date | Objet |
|---|---|---|
| 1.0 | Octobre 2026 | Création |
