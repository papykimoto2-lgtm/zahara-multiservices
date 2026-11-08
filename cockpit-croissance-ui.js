/* Cockpit — collecte des signaux de croissance et ajout à la file d'actions existante (ckActions).
   Chaque source est isolée : si l'une échoue, les autres s'affichent quand même. Résultat gardé 60 s (le Cockpit se redessine souvent). */
var CCR = { cache: null, le: 0 };

function ccrSignaux() {
  var S = { jour: today() }, aujourd = today(), now = Date.now();

  try {
    var d = tpDonnees(), p = TresoPrev.projeter(Object.assign({}, d, { scenario: 'base' }));
    S.tresorerie = { premierNegatif: p.premier_negatif, besoin: p.besoin, soldeMin: p.solde_min, semaineMin: p.semaine_min, seuil: d.seuil };
  } catch (e) { console.error('[cockpit-croissance] trésorerie', e); }

  try {
    var cfg = (DATA.params && DATA.params.wa_relances) || {};
    if (cfg.actif) {
      var dejaAuj = {}; (DATA.relances || []).forEach(function (r) { if ((r.date || '') === aujourd) dejaAuj[r.client_id] = true; });
      var f = WaRelances.construireFile(waRelEntrees(new Date()), {}, {}, new Date()).file.filter(function (x) { return !dejaAuj[x.client_id]; });
      S.wa = { actif: true, nb: f.length, montant: f.reduce(function (t, x) { return t + x.montant; }, 0) };
    }
  } catch (e) { console.error('[cockpit-croissance] whatsapp', e); }

  try {
    lsPreparer();
    var cl = LeadScore.classer(DATA.leads || [], LS.ctx, now), L = { chauds: 0, budgetChauds: 0, dormantsNego: 0, budgetNego: 0, relancesRetard: 0 };
    cl.forEach(function (x) {
      var b = parseFloat(x.lead.budget) || 0;
      if (x.s.niveau === 'chaud') { L.chauds++; L.budgetChauds += b; }
      if (x.lead.stade === 'negociation' && x.s.jours != null && x.s.jours >= 7) { L.dormantsNego++; L.budgetNego += b; }
      if (x.lead.date_relance && String(x.lead.date_relance).slice(0, 10) < aujourd) L.relancesRetard++;
    });
    S.leads = L;
  } catch (e) { console.error('[cockpit-croissance] leads', e); }

  try {
    var pr = parDonnees();
    if (pr.cfg.actif) S.parrainage = { aValider: pr.a_creer.length, montant: pr.a_creer.reduce(function (t, x) { return t + x.montant; }, 0) };
  } catch (e) { console.error('[cockpit-croissance] parrainage', e); }

  try {
    var cible = mpCible(), M = { rouge: 0, orange: 0, incomplets: 0, premier: '' };
    (DATA.programmes || []).filter(function (p) { return p.statut !== 'archive'; }).forEach(function (p) {
      var ev = MargeProg.evaluer(mpResume(p).r, cible);
      if (ev.statut === 'rouge') { M.rouge++; if (!M.premier) M.premier = p.nom || ''; } else if (ev.statut === 'orange') M.orange++;
      if (!ev.fiable) M.incomplets++;
    });
    S.marges = M;
  } catch (e) { console.error('[cockpit-croissance] marges', e); }

  try {
    var ap = aprDonnees(), tous = ap.classes.concat(ap.autres);
    S.apporteurs = { dormants: ap.nb_dormants, contrats: tous.filter(function (r) { return r.tags.some(function (t) { return t.k === 'contrat'; }); }).length };
  } catch (e) { console.error('[cockpit-croissance] apporteurs', e); }

  try {
    var rl = rloDonnees(), cnt = function (k) { return new Set(rl.alertes.filter(function (a) { return a.k === k; }).map(function (a) { return a.bien_id; })).size; };
    S.locatif = { vacants: cnt('vacance'), perteMensuelle: rl.alertes.filter(function (a) { return a.k === 'vacance'; }).reduce(function (t, a) { return t + (rl.biens.find(function (l) { return l.bien.id === a.bien_id; }) || { loyer: 0 }).loyer; }, 0),
      recouvrement: cnt('recouvrement'), sousLoues: cnt('sous_loue'), finsProches: cnt('fin_proche') };
  } catch (e) { console.error('[cockpit-croissance] locatif', e); }
  return S;
}

/* Appelée par ckActions() : ajoute les actions à la file avec le même filtre de report que les autres règles. */
function ckActionsCroissance(push) {
  if (!window.CockpitCroissance) return;
  if (!CCR.cache || Date.now() - CCR.le > 60000 || CCR.cache.jour !== today()) { CCR.cache = { jour: today(), actions: CockpitCroissance.construire(ccrSignaux(), function (n) { return fmtF(Math.round(n || 0)); }) }; CCR.le = Date.now(); }
  CCR.cache.actions.forEach(push);
}
