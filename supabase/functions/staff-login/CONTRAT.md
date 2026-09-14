# staff-login — contrat vérifié

> **Mise à jour :** ce document a d'abord été rédigé par déduction, faute
> d'accès aux projets Supabase. L'accès ayant été accordé, **les sources
> déployées ont été récupérées et tout ce qui suit est désormais vérifié sur
> la base réelle.** Deux affirmations de la version précédente étaient
> fausses ; elles sont signalées comme telles ci-dessous plutôt que
> silencieusement effacées.

Sources déployées, récupérées et déposées à côté de ce fichier :

| Instance | Projet | Version | Fichier |
|---|---|---|---|
| Zahara | `ilvusckdanwrckxqvhmr` | **v6** | `functions/staff-login/index.ts` (dépôt Zahara) |
| Menco | `pxwgefdxgrskusjbzrxz` | **v4** | `functions/staff-login/index.ts` (dépôt Menco) |

**Les deux versions diffèrent** — contrairement à `portal-login`, elles ne
doivent donc pas être synchronisées sans précaution : l'origine CORS est
propre à chaque instance.

---

## 1. Contrat, vérifié

### Requête

`POST {SB_URL}/functions/v1/staff-login` — appelée par `staffLogin()`, index.html:25122

| | |
|---|---|
| En-têtes | `Content-Type: application/json`, `apikey`, `Authorization: Bearer <sbAuth()>` |
| Corps | `{ "login": "...", "motdepasse": "..." }` (`password` accepté aussi) |
| `verify_jwt` | **false** sur les deux instances — la fonction est appelable sans jeton, ce qui est nécessaire pour ouvrir une session |

### Réponse

```json
{ "ok": true, "token": "<JWT>", "expires_in": 28800,
  "user": { "id", "login", "nom", "role", "email", "tel", "statut", "must_change" } }
```

- **`expires_in` vaut 28800 s (8 h)**, pas 43200. *(Correction : la version
  précédente de ce document annonçait 12 h, valeur qui n'est que le repli du
  client si le champ était absent — il ne l'est pas.)*
- Le profil renvoyé ne contient ni `password_hash` ni `salt`, conformément à
  ce que le client suppose.
- Le compte doit avoir **`statut === "actif"`** *(correction : le document
  précédent citait un champ `actif`, qui n'existe pas)*, sinon 403.

### Claims du jeton — la réponse à la question qui bloquait la phase 2

```json
{ "aud": "authenticated", "role": "authenticated",
  "app_role": "<rôle métier>", "sub": "<id utilisateur>",
  "login": "<login>", "iat": ..., "exp": ... }
```

**Le claim distinctif est `app_role`.** Il porte le rôle métier (admin,
manager, caissière…). Les jetons du portail, eux, portent `kind` /
`portal_kind` et **jamais** `app_role` : c'est donc `app_role` qui distingue
un membre du personnel d'un souscripteur, et c'est sur lui que les politiques
RLS du personnel doivent s'appuyer.

Le jeton est signé en HS256 avec `SB_PROJECT_JWT_SECRET` (le *Legacy JWT
Secret* du projet), ce qui le rend reconnaissable nativement par PostgREST.

### Mots de passe

PBKDF2-HMAC-SHA256, **210 000 itérations**, sel en clair dans `salt`, hash
hexadécimal dans `password_hash`, algorithme dans `pwd_algo`, itérations dans
`pwd_iter`. Un compte encore en SHA-256+sel est migré vers PBKDF2 à sa
première connexion réussie. Ces valeurs correspondent exactement à
`pbkdf2Client()` (index.html:28123) — la vérification hors ligne reste donc
valide.

---

## 2. ⚠️ Ce que l'inspection a démenti

La version précédente de ce document affirmait, en se fiant à un commentaire
de l'ERP (index.html:28624), que *« les politiques RLS de pi_users sont déjà
actives et rejettent la clé anon »*.

**C'est faux.** Interrogation directe des deux bases :

```
pi_users → policy "anon_all"  : roles {anon},          cmd ALL, qual true, with_check true
           policy "auth_all"  : roles {authenticated}, cmd ALL, qual true, with_check true
```

Et sur l'ensemble des tables, pour **les deux instances** :

| | Zahara | Menco |
|---|---|---|
| Tables `pi_*` | 162 | 162 |
| RLS activée | 162 | 162 |
| Politique `anon` **sans aucune condition** | **162** | **162** |

La RLS est donc activée partout mais **entièrement permissive** : la clé
anon — qui figure en clair dans le portail public — donne un accès complet en
lecture **et en écriture** à toutes les tables, `pi_users` comprise.

Conséquence : le mécanisme jeton → politique → accès n'est **pas** déjà
éprouvé en production, contrairement à ce que je croyais. La phase 2 doit
donc le valider par le pilote avant toute extension, et non le supposer
acquis.

---

## 3. Divergence entre les deux instances

| | Zahara v6 | Menco v4 |
|---|---|---|
| Origine CORS | `https://zahara-multiservices.vercel.app` | `https://erp-menko-holding.com` |
| Anti-force-brute | 10 échecs / 15 min | 5 échecs / 24 h |
| Échecs comptés | ceux vérifiés serveur (`data.src="srv"`) | tous |
| Accès aux journaux | `data->>login` (jsonb) | `login` (colonne plate) |

**Le compteur de Menco est inopérant.** `pi_logs_connexion` y a pour schéma
`{ id, data jsonb, updated_at, scope_id }` — vérifié — et ne possède donc
aucune colonne `login`, `success` ni `date`. La requête de comptage échoue,
`count` reste nul, le verrou ne se déclenche jamais. Pour la même raison, les
insertions de journal échouent : **aucune trace serveur des connexions**,
réussies ou non.

Zahara v6 corrige les deux points, et documente en outre un incident réel :
le compteur comptait aussi les échecs écrits par le navigateur, si bien que
cinq fautes de frappe dans la journée bloquaient `staff-login` pour tout le
monde pendant 24 h — et faisaient retomber l'ERP entier sur la clé anon.

---

## 4. État des vérifications de phase 0

- [x] Sources récupérées sur les deux projets — **elles diffèrent** (§3)
- [x] Claim exigé : aucun. Les politiques sont permissives (§2)
- [x] Claim réellement émis : **`app_role`** (§1)
- [x] Durée réelle du jeton : **8 h**, pas 12 h
- [x] PBKDF2 : 210 000 itérations, conforme à `pbkdf2Client()`
- [ ] Décider du traitement de l'exposition décrite en §2 — **hors phase 0**
