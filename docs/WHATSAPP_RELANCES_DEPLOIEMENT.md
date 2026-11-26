# Relances WhatsApp — déploiement

**Principe** : un clic sur **📲 Campagne WhatsApp** (page Relances Clients) calcule la file du jour, génère un lien de paiement unique par client, envoie un modèle WhatsApp approuvé et journalise (envoyé → remis → lu).

## Cadence
| Palier | Condition | Montant demandé |
|---|---|---|
| J−3 | À jour, retard à la prochaine échéance (dans 1 à 3 j) | Mensualité due |
| J 0 | Échéance dépassée de 0 à 2 j | Montant en retard |
| J +3 | 3 à 9 j après l'échéance | Montant en retard |
| J +10 | 10 j et plus | Montant en retard |

- ≥ 3 mois de retard : aucun envoi automatique (mise en demeure = décision humaine, REL-04).
- Un palier ne part qu'une fois par client et par échéance (contrainte SQL unique).
- Exclus : soldés, financement bancaire, résiliés, désinscrits (STOP), téléphone invalide.

## Mise en route (ordre)
1. SQL : exécuter `supabase/wa_relances.sql`.
2. Secrets Supabase : `WA_TOKEN`, `WA_PHONE_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` (+ `WA_LANG`, défaut `fr`).
3. Déployer :
```bash
supabase functions deploy wa-relances
supabase functions deploy wa-webhook --no-verify-jwt
```
4. Meta › WhatsApp › Configuration : URL de rappel `https://ilvusckdanwrckxqvhmr.supabase.co/functions/v1/wa-webhook`, jeton = `WA_VERIFY_TOKEN`, champ **messages** abonné.
5. Créer et faire approuver 4 modèles (catégorie **Utility**, langue `fr`), 5 variables chacun :

| Nom | Corps |
|---|---|
| `rel_j_moins3` | Bonjour {{1}}, votre échéance de {{2}} ({{3}}) arrive dans 3 jours. Réglez en un clic (Wave, Orange Money, MTN, carte) : {{4}} — {{5}}. Répondez STOP pour ne plus recevoir ces messages. |
| `rel_j0` | Bonjour {{1}}, votre échéance de {{2}} ({{3}}) est due aujourd'hui. Réglez en un clic : {{4}} — {{5}}. Répondez STOP pour ne plus recevoir ces messages. |
| `rel_j3` | Bonjour {{1}}, sauf erreur de notre part, {{2}} ({{3}}) reste à régler. Évitez tout retard supplémentaire : {{4}} — {{5}}. Répondez STOP pour ne plus recevoir ces messages. |
| `rel_j10` | Bonjour {{1}}, {{2}} ({{3}}) est en retard de paiement. Régularisez dès maintenant : {{4}}. Besoin d'un échéancier ? Répondez à ce message. — {{5}}. Répondez STOP pour ne plus recevoir ces messages. |

Variables : {{1}} prénom · {{2}} montant · {{3}} dossier/lot · {{4}} lien de paiement · {{5}} société.

6. Dans l'ERP : **📲 Campagne WhatsApp › Activer** (administrateur). La passerelle (`cinetpay` / `paydunya`) se règle dans `pi_params.data.wa_relances.provider`.
7. Test à blanc : appeler `wa-relances` avec `{"items":[…],"dry":true}` (aucun envoi).

## Sécurité
- Jeton du personnel exigé (`verify_jwt` actif + claim `app_role`) ; portail et anon refusés.
- Numéro et nom lus dans `pi_clients` côté serveur, jamais fournis par le navigateur.
- Webhook : signature `X-Hub-Signature-256` vérifiée (HMAC-SHA256, comparaison à temps constant).
- Aucun secret côté navigateur. Écriture des tables réservée à la clé de service ; lecture au personnel (RLS).
- 100 envois maximum par appel ; l'ERP envoie par lots de 20.

## Hors périmètre (phase 2)
Envoi 100 % automatique sans clic (pg_cron) : demande de porter le calcul d'échéancier en SQL. À faire après validation de cette version.

## Rollback
```sql
drop table public.wa_relances_log; drop table public.wa_optout;
```
Retirer les 2 balises `<script>` et le bouton dans `index.html`.
