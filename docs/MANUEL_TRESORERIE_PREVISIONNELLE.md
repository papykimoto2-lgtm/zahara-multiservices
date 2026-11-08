# Manuel de procédures — Trésorerie prévisionnelle (13 semaines)

**Réf.** PRO-TRP · **Objet** : voir à l'avance les semaines où la caisse et la banque manqueront d'argent, et agir avant.
**Où** : **Trésorerie**, bloc **🔮 Trésorerie prévisionnelle**.

## 1. Ce que la projection calcule
| Poste | Méthode |
|---|---|
| Position de départ | Caisses + banques + crédits de trésorerie, d'après la comptabilité du jour |
| Encaissements souscripteurs | Échéances contractuelles de chaque dossier actif × **taux de recouvrement réel** des 90 derniers jours |
| Paie, impôts, emprunts | Montant mensuel moyen des 90 derniers jours, posé au jour du mois habituel |
| Fournisseurs, autres charges | Rythme hebdomadaire moyen des 90 derniers jours |
| Engagements saisis | Lignes manuelles (une fois, chaque semaine, chaque mois), avec probabilité |

**Exclus** : investissements ponctuels, déblocages de financement bancaire, nouvelles ventes, cessions foncières. À saisir en lignes manuelles.
C'est une projection « si les 90 derniers jours se répètent », pas une prévision certaine.

## 2. Procédures
### TRP-01 — Lire la projection
1. Choisir le scénario : **Prudent** (recouvrement −20 %, sorties diffuses +10 %), **Base**, **Optimiste** (recouvrement +10 %, sorties −5 %). La paie ne varie pas.
2. Lire : trésorerie aujourd'hui, dans 13 semaines, **creux** (semaine et montant), **besoin** pour tenir le seuil de sécurité.
3. Survoler une semaine : détail des encaissements et des sorties par catégorie.
4. 🔴 = solde négatif prévu. 🟠 = sous le seuil (Paramètres › Trésorerie).

### TRP-02 — Vérifier les hypothèses
1. Ouvrir **Hypothèses**.
2. Taux de recouvrement : « mesuré » (versements des 90 jours ÷ dû théorique) ou « NON mesurable ». Dans ce cas 70 % s'applique : **saisir le vôtre** (champ « Forcer le taux »).
3. Contrôler la source des sorties : « grand livre » est la plus fiable ; « sorties de caisse (non ventilées) » signale une comptabilité de caisse incomplète.

### TRP-03 — Saisir un engagement
1. **+ Ajouter** : libellé, sens, montant, date, rythme, dernière date, probabilité.
2. Exemples : achat de terrain (sortie, une fois), déblocage bancaire (entrée, 70 %), loyer (sortie, chaque mois), impôt annuel.
3. Modifier ✏️ ou supprimer 🗑.

### TRP-04 — Agir sur un creux
1. Si un **besoin** apparaît, lire le levier : part des impayés à recouvrer pour le couvrir.
2. Ouvrir **Relances** (campagne WhatsApp avec lien de paiement), décaler un décaissement, ou prévoir un financement.
3. Relire la projection après chaque action.

### TRP-05 — Exporter
**⬇ CSV** : projection du scénario affiché, semaine par semaine (Excel).

## 3. Limites à connaître
- Le rythme des sorties est celui d'une période de 90 jours : un trimestre atypique fausse la projection.
- Le plan comptable de l'ERP range le personnel en 64x et les intérêts en 661. Un autre plan se règle par `params.treso_prev_prefixes`.
- Pas de dates d'échéance fournisseurs dans les données : les factures à payer sont couvertes par le rythme historique, pas par leur échéance.

## 4. Révisions
| Version | Date | Objet |
|---|---|---|
| 1.0 | Novembre 2026 | Création |
