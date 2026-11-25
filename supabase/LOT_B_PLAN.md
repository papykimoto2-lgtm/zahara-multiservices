# Lot B — sécurisation serveur de l'attestation de solde (plan)

Statut : **plan, rien d'appliqué.** Origine : revue de l'attestation de solde du 25/11/2026 (sécurité, validation, impression, logique).
Le lot A (côté application) est livré : Zahara #192, Menko #233. Ce lot traite ce qu'il faut garantir **côté serveur**.

## 1. État mesuré le 25/11/2026 (lecture seule)

| | Zahara `ilvusckdanwrckxqvhmr` | Menco `pxwgefdxgrskusjbzrxz` |
|---|---|---|
| Tables `public` (RLS activée) | 205 (205) | 205 |
| Tables avec politique **ouverte** (ALL, vraie, anon / authenticated) | **163** | **177** |
| `personnel_tout` (jeton du personnel, `app_role`) | 164 | 166 |
| Politiques `portail_*` (jetons du portail) | 41 tables | 41 tables |
| Schéma `rls_fermeture` (fonctions de fermeture) | **absent** | installé, non appliqué |
| Fonctions `fc_vue_notaire_*`, `fc_vue_plan_lotissement` | 3 / 3 | 3 / 3 |
| Triggers de garde sur `pi_clients` | **0** | à vérifier |

Conséquences :
- La clé anon est publique : toute la base est lisible et modifiable depuis un navigateur. Une attestation peut être « validée », publiée ou transmise au notaire sans passer par l'ERP.
- Le jeton `staff-login` porte `app_role` (rôle de l'utilisateur) : les gardes serveur peuvent s'appuyer dessus.
- `portail_client_self` renvoie la fiche entière du souscripteur (motifs de rejet, annulations, notes) : le filtrage ne se fait qu'à l'affichage.

## 2. Phases (ordre recommandé)

Chaque phase a un critère d'arrêt et un retour arrière. On fait **Zahara d'abord**, puis Menko avec les mêmes scripts.

### Phase 1 — Document servi en iframe `sandbox` (client seul, sans SQL)
- `portail-unique.html` : remplacer `document.write(a.html)` (souscripteur : `docAttSolde` ; foncier : `fonOuvrirAttestation` ; notaire) par une `iframe sandbox="allow-modals"` en `srcdoc`, **sans** `allow-same-origin`. Le script du moteur de pagination s'exécute, mais ne peut plus lire `sessionStorage['pp_token']`.
- Impression : `allow-modals` pour `print()` ; vérifier l'impression depuis l'iframe sur mobile.
- Test : un `<script>` injecté dans `a.html` ne lit ni `sessionStorage` ni `localStorage` ; la pagination et l'impression restent identiques.
- Retour arrière : revert d'un fichier. **À faire en premier** : corrige le XSS stocké sans toucher à la base.

### Phase 2 — Préalables de fermeture RLS (déjà décrits dans `RLS_RECETTE_FERMETURE.md` §3)
1. Sauvegarde fraîche + export JSON de l'ERP ; **branche Supabase** pour répéter.
2. Zahara : exécuter `rls_03_fermeture.sql` (crée seulement les fonctions et la table de sauvegarde).
3. `tools/rls_sonde_anon.js` : état « avant ».
4. `IMMO_SYNC_ANON_FALLBACK = false`, déployer, vérifier le badge de session du personnel.
5. Prévenir les utilisateurs : jeton de 8 h non renouvelable.

### Phase 3 — Fermeture par vagues (script existant)
- Vague **A** (tables internes) → recette ERP.
- Vague **B** (tables exposées au portail, qui ont déjà `portail_*`) : repasser d'abord les 4 vues publiques en `security_invoker = false`. Contient `pi_clients`, `pi_versements`, `pi_cessions_foncieres`.
- Vague **C**, **une table à la fois** : `pi_validations`, `pi_params`, `pi_users`, `pi_suppressions`, `pi_documents`…
- Chaque vague : simulation → lecture de la liste → application → recette (ERP, portail de chaque profil, visiteur anonyme) → `rls_sonde_anon.js --attendu-ferme`.
- Arrêt immédiat + `rls_fermeture.restaurer('X')` si : échec ERP (création / sync), souscripteur qui voit autrui, 401/403 persistants, formulaire public en échec.

### Phase 4 — Garde serveur des transitions d'attestation (SQL)
Triggers `BEFORE UPDATE` sur `pi_clients` (et `pi_cessions_foncieres`) pour les objets `attestation_solde`, `attestation_solde_finale` :
- Passage à `statut = 'valide'`, ou `publie_portail`, `transmis_notaire` à vrai : exige `auth.jwt()->>'app_role'` ∈ {admin, manager}.
- Une attestation `valide` est **immuable** (`html`, `numero`, `valide_par`, `valide_le`, `prix`, `verse`) sauf deux chemins : annulation (retour `brouillon` avec une entrée de plus dans `annulations`) et visa (une entrée de plus dans `visa_historique`).
- `pi_validations` : transitions autorisées `en_attente → valide | rejete | annule`, puis `valide → annule` ; rejette une 2e décision (règle le « dernier écrit gagne » entre postes).
- Unicité du numéro d'attestation validée (index partiel ou contrôle dans le trigger).
- Tests SQL sur la branche : un jeton portail ou un agent non autorisé est refusé ; l'ERP (admin / manager) passe ; l'annulation et le visa passent.
- Retour arrière : `drop trigger` (script fourni avec le trigger).

### Phase 5 — Vue limitée pour le souscripteur
- RPC `SECURITY DEFINER` (sans paramètre, identité lue dans le jeton) renvoyant la fiche **sans** champs internes : motifs de rejet, `annulations`, `html_notaire`, `notaire_intervenant_id`, `transmission_notaire`, notes ; attestations seulement si `valide` ET `publie_portail`.
- `portail-unique.html` : remplacer `pi_clients?select=id,data&id=eq.<id>` par la RPC ; puis retirer la politique `portail_client_self` (lecture directe).
- Même principe pour l'acquéreur foncier (`portail_cession_self`).

### Phase 6 — Sceau, vérification et journal
- **Empreinte** : à la validation, enregistrer `sha256(html)`, valideur et date dans une table `pi_attestations_sceau` (écriture réservée au trigger / au personnel). Refuser l'affichage d'un texte dont l'empreinte ne correspond pas (portail, notaire).
- **Vérification publique** : RPC `verifier_attestation(numero, code)` qui répond seulement « authentique / annulée / inconnue », la date et le dossier masqué. Le QR encode l'URL de vérification (le texte actuel ne vérifie rien : il a été reformulé dans le lot A).
- **Journal serveur** : `fc_vue_notaire_attestations` et l'ouverture côté souscripteur passent par une RPC qui écrit un événement (qui, quand, quelle attestation). Aujourd'hui, seule la trace du navigateur existe.
- **Essais de connexion** : compteur persistant côté serveur (table) au lieu de la mémoire d'instance de `portal-login` et du `localStorage`.

### Phase 7 — Hors périmètre direct, à planifier
Dépôt `portail-medias` (écriture restreinte au personnel), secrets dans `pi_params` (clé FNE, Twilio, EmailJS) à sortir vers le coffre des Edge Functions, jeton de 8 h non renouvelable, autres applications (`agro_state`, hub Menko).

## 3. Dépendances et risques

| Risque | Parade |
|---|---|
| Couper l'accès du personnel (RLS) | Branche d'abord, vague A d'abord, `restaurer()` testée, sonde avant / après |
| Vues publiques vides après fermeture | Repasser les 4 vues en `security_invoker = false` avant la vague B |
| Envois différés si jeton expiré | Avertissement 10 min avant ; reconnexion guidée ; file locale conservée |
| Trigger trop strict qui bloque l'ERP | Tests sur la branche avec un jeton réel par rôle ; mode « journal seul » avant blocage |
| Impression cassée par l'iframe | Test sur mobile et desktop avant de déployer |

## 4. Décisions à prendre avant de commencer

1. Fenêtre de fermeture et ordre : Zahara puis Menko, hors heures d'encaissement ?
2. Rôles autorisés à valider / diffuser : `admin` et `manager` seulement (état actuel du lot A) ?
3. Jeton de 8 h : acceptable en l'état, ou renouvellement à prévoir avant la vague A ?
4. URL publique de vérification des QR (domaine de chaque promoteur).
5. Même séquence sur Menko, ou lot B Zahara d'abord puis bilan ?

## 5. Critères de réussite

- `rls_sonde_anon.js --attendu-ferme` : code de sortie 0 ; la clé anon ne lit plus `pi_clients`, `pi_validations`, `pi_versements`.
- Écrire `statut = 'valide'` depuis la clé anon ou un jeton portail : refusé.
- Un souscripteur ne reçoit que sa fiche filtrée ; les attestations non publiées ou annulées sont absentes de sa réponse.
- Une attestation validée dont le texte est modifié en base n'est plus affichée (empreinte).
- Un `<script>` dans `a.html` n'exfiltre aucun jeton.
