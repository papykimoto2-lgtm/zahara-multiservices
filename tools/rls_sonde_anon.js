#!/usr/bin/env node
/* Sonde RLS : que peut faire la clé ANON (celle du portail public) sur chaque table ?
   Usage :  SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... node tools/rls_sonde_anon.js [--attendu-ferme]
   Sûre : lecture = nombre de lignes seulement (jamais le contenu) ; écriture = PATCH/DELETE sur un identifiant
   inexistant (aucune ligne ne peut être modifiée), jamais d'insertion.
   --attendu-ferme : code de sortie 1 si une table non listée dans AUTORISE_ANON reste lisible/modifiable. */
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_ANON_KEY || '';
if (!URL_ || !KEY) { console.error('Définir SUPABASE_URL et SUPABASE_ANON_KEY.'); process.exit(2); }
const attenduFerme = process.argv.includes('--attendu-ferme');
/* Ce que le portail public doit continuer à faire en anonyme (lecture filtrée ou insertion de formulaire). */
const AUTORISE_ANON = {
  pi_portail_medias: 'lecture (médias visibles)', pi_params: 'lecture (ligne « portail » seulement)',
  pi_leads: 'insertion', pi_logs_connexion: 'insertion', pi_portail_analytics: 'insertion', pi_af_manifestations: 'insertion',
  pi_lots_public: 'vue', pi_programmes_public: 'vue', pi_stats_publiques: 'vue', pi_parcelles_public: 'vue',
  pi_operations_public: 'vue', pi_biens_louer_public: 'vue', pi_appel_financiers_public: 'vue'
};
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
async function j(path, opt) { const r = await fetch(URL_ + '/rest/v1/' + path, Object.assign({ headers: H }, opt)); return r; }
(async () => {
  const spec = await (await fetch(URL_ + '/rest/v1/', { headers: H })).json().catch(() => ({}));
  const tables = Object.keys(spec.paths || {}).map(p => p.replace(/^\//, '')).filter(p => /^(pi_|agro_|menko_)/.test(p) && !p.includes('/')).sort();
  if (!tables.length) { console.error('Schéma non lisible avec la clé anon (c’est bon signe) : fournir une liste avec --tables a,b,c'); }
  const liste = (process.argv.find(a => a.startsWith('--tables=')) || '').slice(9).split(',').filter(Boolean);
  const cibles = liste.length ? liste : tables;
  let ouverts = 0, inattendus = 0; const lignes = [];
  for (const t of cibles) {
    let lecture = '?', ecriture = '?';
    try {
      const r = await j(t + '?select=id&limit=1', { headers: Object.assign({ Prefer: 'count=exact' }, H) });
      if (r.ok) { const n = parseInt(String(r.headers.get('content-range') || '').split('/')[1]); lecture = isNaN(n) ? 'ok' : n + ' ligne(s) lisible(s)'; } else lecture = 'refusée (' + r.status + ')';
    } catch (e) { lecture = 'erreur'; }
    try {
      const p = await j(t + '?id=eq.__sonde_inexistant__', { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: '{}' });
      const d = await j(t + '?id=eq.__sonde_inexistant__', { method: 'DELETE' });
      ecriture = (p.ok || d.ok) ? 'MODIFIABLE / SUPPRIMABLE' : 'refusée (' + p.status + '/' + d.status + ')';
    } catch (e) { ecriture = 'erreur'; }
    const lisible = /ligne|ok/.test(lecture) && !/^0 /.test(lecture), modifiable = /MODIFIABLE/.test(ecriture);
    const attendu = Object.prototype.hasOwnProperty.call(AUTORISE_ANON, t);
    const etat = (lisible || modifiable) ? (attendu ? 'attendu' : 'OUVERT') : 'fermé';
    if (etat === 'OUVERT') { ouverts++; if (attenduFerme) inattendus++; }
    lignes.push([t, lecture, ecriture, etat + (attendu ? ' — ' + AUTORISE_ANON[t] : '')]);
  }
  const w = lignes.reduce((m, l) => Math.max(m, l[0].length), 5);
  lignes.forEach(l => console.log(l[0].padEnd(w) + ' | lecture : ' + l[1].padEnd(24) + ' | écriture : ' + l[2].padEnd(26) + ' | ' + l[3]));
  console.log('\n' + cibles.length + ' table(s) sondée(s) ; ' + ouverts + ' accessible(s) à anon sans être prévue(s).');
  process.exit(attenduFerme && inattendus ? 1 : 0);
})();
