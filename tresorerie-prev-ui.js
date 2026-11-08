/* Trésorerie prévisionnelle 13 semaines — interface et extraction des données (page Trésorerie).
   Dépend de tresorerie-prev.js et des globales de l'ERP (DATA, tresoPosition, tresoParams, echeancierClient, ecrLignes…). */
var TP = { scenario: 'base', edit: null };
function tpH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function tpF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))); }
function tpIso(t) { var d = new Date(t); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function tpManuels() { return (DATA.params && DATA.params.treso_previsions) || []; }

/* ── Extraction ───────────────────────────────────────────────────────── */
/* Décaissements réels des 90 derniers jours, d'après le grand livre (écritures qui font sortir de l'argent d'un compte de trésorerie). */
function tpSortiesGrandLivre(depuis) {
  var out = [], prefixes = Object.assign({}, TresoPrev.PREFIXES, (DATA.params && DATA.params.treso_prev_prefixes) || {});
  (DATA.ecritures || []).forEach(function (e) {
    var d = String(e.date || '').slice(0, 10); if (!d || d < depuis || d > tpIso(Date.now())) return;
    if (e.type === 'cloture' || e.journal === 'CLO') return;
    var L = ecrLignes(e), cD = 0, cC = 0, deb = [];
    L.forEach(function (l) {
      var c = String(l.compte || ''), m = parseFloat(l.montant) || 0;
      if (c.charAt(0) === '5') { if (l.sens === 'D') cD += m; else cC += m; }
      else if (l.sens === 'D') deb.push({ c: c, m: m });
    });
    if (!(cC > 0) || cD > 0 || !deb.length) return;                 /* pas une sortie, ou virement interne */
    var tot = deb.reduce(function (t, x) { return t + x.m; }, 0) || 1;
    deb.forEach(function (x) { out.push({ date: d, montant: cC * x.m / tot, cat: TresoPrev.categorieDe(x.c, prefixes) }); });
  });
  return out;
}
/* Repli : sorties de caisse brutes, si le grand livre n'en porte presque pas (caisse non journalisée). */
function tpSortiesCaisse(depuis) {
  return (DATA.caisse_mouvements || []).filter(function (m) { return m.type === 'sortie' && String(m.date || '').slice(0, 10) >= depuis; })
    .map(function (m) { return { date: String(m.date).slice(0, 10), montant: parseFloat(m.montant) || 0, cat: 'autres' }; });
}

function tpDonnees() {
  var now = Date.now(), depuis = tpIso(now - 90 * 86400000);
  var pos = tresoPosition(), solde = pos.caisses + pos.banques + pos.credits, pl = tresoParams();

  var gl = tpSortiesGrandLivre(depuis), caisse = tpSortiesCaisse(depuis);
  var totGl = gl.reduce(function (t, x) { return t + x.montant; }, 0), totCa = caisse.reduce(function (t, x) { return t + x.montant; }, 0);
  var source = totGl >= totCa * 0.8 ? 'grand livre' : 'sorties de caisse (non ventilées)';
  var hist = source === 'grand livre' ? gl : caisse;
  var profil = TresoPrev.profilSorties(hist, now, 90);

  var verses = {}, versesRecents = {};
  (DATA.versements || []).forEach(function (v) {
    if (v.statut === 'annule' || !_versementSurPrix(v)) return;
    var m = parseFloat(v.montant) || 0; verses[v.client_id] = (verses[v.client_id] || 0) + m;
    if (String(v.date || '').slice(0, 10) >= depuis) versesRecents[v.client_id] = (versesRecents[v.client_id] || 0) + m;
  });
  var echeances = [], theorique = 0, encaisse = 0, nbClients = 0, dateNow = new Date(now);
  (DATA.clients || []).forEach(function (c) {
    var total = parseFloat(c.montant_total) || 0, verse = verses[c.id] || 0;
    if (!(total > 0) || verse >= total || c.statut === 'resilie' || c.statut === 'inactif' || clientFinancementBancaire(c)) return;
    var e = echeancierClient(c, dateNow, verse); if (!e || !(e.mensualite > 0)) return;
    var reste = total - verse; nbClients++;
    TresoPrev.echeancesClient({ client_id: c.id, ancre: e.dateAncre, mensualite: e.mensualite, reste: reste }, now, TresoPrev.SEMAINES).forEach(function (x) { echeances.push(x); });
    theorique += Math.min(e.mensualite * 3, reste); encaisse += versesRecents[c.id] || 0;
  });
  var mesure = TresoPrev.tauxRecouvrement(encaisse, theorique, 0.7);
  if (encaisse === 0) mesure = { taux: 0.7, mesure: false };      /* aucun versement saisi en 90 j : on ne conclut pas à 0 % */
  var saisi = DATA.params && DATA.params.treso_prev_taux != null && DATA.params.treso_prev_taux !== '' ? parseFloat(DATA.params.treso_prev_taux) : null;
  var taux = saisi != null && !isNaN(saisi) ? Math.max(0, Math.min(1.2, saisi / 100)) : mesure.taux;

  var retards = (typeof getRetardataires === 'function') ? getRetardataires() : [];
  return { now: now, soldeInitial: solde, position: pos, echeances: echeances, tauxRecouvrement: taux, tauxMesure: mesure.mesure, tauxSaisi: saisi != null && !isNaN(saisi),
    theorique: theorique, encaisse: encaisse, nbClients: nbClients, profil: profil, sourceSorties: source, manuels: tpManuels(), seuil: pl.seuilSolde,
    impayes: retards.reduce(function (t, r) { return t + (r.montantDu || 0); }, 0), nbImpayes: retards.length };
}

/* ── Affichage ────────────────────────────────────────────────────────── */
function tpScenario(k) { TP.scenario = k; tpRendre(); }
function tpTaux(v) {
  if (v === '') { delete DATA.params.treso_prev_taux; } else { var x = parseFloat(v); if (isNaN(x) || x < 0 || x > 120) { toast('Taux entre 0 et 120 %.', 'error'); return; } DATA.params.treso_prev_taux = x; }
  tpSauverParams(); tpRendre();
}
function tpSauverParams() { dbPut('params', DATA.params); if (typeof syncToSupabase === 'function') syncToSupabase('pi_params', DATA.params); }

function tpGraphique(sc, seuil) {
  var W = 760, H = 200, P = 36, N = 13, series = ['prudent', 'base', 'optimiste'].map(function (k) { return { k: k, v: [sc[k].solde_initial].concat(sc[k].semaines.map(function (s) { return s.solde; })) }; });
  var all = [].concat.apply([], series.map(function (s) { return s.v; })).concat([0]), mx = Math.max.apply(null, all), mn = Math.min.apply(null, all), span = (mx - mn) || 1;
  var x = function (i) { return P + i * (W - 2 * P) / N; }, y = function (v) { return H - 24 - (v - mn) / span * (H - 40); };
  var col = { prudent: '#DC2626', base: '#4F46E5', optimiste: '#16A34A' };
  var g = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;max-height:240px;" role="img" aria-label="Solde de trésorerie projeté sur 13 semaines, trois scénarios">'
    + '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#64748b" stroke-dasharray="4 3"/>'
    + (seuil > 0 && seuil < mx ? '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y(seuil) + '" y2="' + y(seuil) + '" stroke="#d97706" stroke-dasharray="2 3"/><text x="' + (W - P) + '" y="' + (y(seuil) - 3) + '" font-size="9" fill="#d97706" text-anchor="end">seuil</text>' : '');
  series.forEach(function (s) { g += '<polyline fill="none" stroke="' + col[s.k] + '" stroke-width="' + (s.k === 'base' ? 2.5 : 1.5) + '" points="' + s.v.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ') + '"/>'; });
  for (var i = 0; i <= N; i += 2) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" font-size="9" fill="#64748b" text-anchor="middle">S' + i + '</text>';
  g += '<text x="' + P + '" y="12" font-size="9" fill="#64748b">' + tpH(tpF(mx)) + ' F</text><text x="' + P + '" y="' + (H - 14) + '" font-size="9" fill="#64748b">' + tpH(tpF(mn)) + ' F</text></svg>'
    + '<div style="font-size:11px;display:flex;gap:12px;flex-wrap:wrap;"><span style="color:#DC2626;">● Prudent</span><span style="color:#4F46E5;">● Base</span><span style="color:#16A34A;">● Optimiste</span></div>';
  return g;
}

function tpRendre() {
  var box = document.getElementById('treso-prev-box'); if (!box || !window.TresoPrev) return;
  var d = tpDonnees(), sc = TresoPrev.comparer(d), p = sc[TP.scenario], al = TresoPrev.alertes(p, d.seuil), cats = {};
  p.semaines.forEach(function (s) { Object.keys(s.sorties).forEach(function (c) { cats[c] = (cats[c] || 0) + s.sorties[c]; }); });
  var kpi = function (l, v, c) { return '<div class="kpi-card"><div class="kpi-label">' + l + '</div><div class="kpi-value" style="font-size:16px;' + (c ? 'color:' + c + ';' : '') + '">' + v + '</div></div>'; };
  var h = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;"><div class="card-title" style="margin:0;">🔮 Trésorerie prévisionnelle — 13 semaines</div><div class="spacer" style="flex:1;"></div>'
    + Object.keys(TresoPrev.SCENARIOS).map(function (k) { return '<button class="btn btn-' + (k === TP.scenario ? 'primary' : 'secondary') + ' btn-sm" onclick="tpScenario(\'' + k + '\')">' + TresoPrev.SCENARIOS[k].label + '</button>'; }).join('')
    + '<button class="btn btn-secondary btn-sm" onclick="tpExporter()">⬇ CSV</button></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;">'
    + kpi('Trésorerie aujourd\'hui', tpH(tpF(d.soldeInitial)) + ' F') + kpi('Dans 13 semaines', tpH(tpF(p.solde_final)) + ' F', p.solde_final < 0 ? 'var(--rouge)' : '')
    + kpi('Creux (semaine ' + (p.semaine_min || '—') + ')', tpH(tpF(p.solde_min)) + ' F', p.solde_min < 0 ? 'var(--rouge)' : p.solde_min < d.seuil ? 'var(--or)' : '')
    + kpi('Besoin pour tenir le seuil', p.besoin > 0 ? tpH(tpF(p.besoin)) + ' F' : '✅ aucun', p.besoin > 0 ? 'var(--rouge)' : 'var(--vert)') + '</div>';
  al.forEach(function (a) { h += '<div class="alert ' + (a.niveau === 'rouge' ? 'alert-danger' : 'alert-warn') + '" style="margin-bottom:8px;">' + (a.niveau === 'rouge' ? '🔴 ' : '🟠 ') + tpH(a.texte) + '</div>'; });
  if (p.besoin > 0 && d.impayes > 0) h += '<div class="alert alert-info" style="margin-bottom:8px;">💡 Levier : <strong>' + tpH(tpF(d.impayes)) + ' F</strong> d\'impayés (' + d.nbImpayes + ' souscripteur(s)). Recouvrer ' + Math.min(100, Math.ceil(p.besoin / d.impayes * 100)) + ' % de ce montant couvre le besoin. <a href="#" onclick="goTo(\'relances\');return false;">Ouvrir les relances ›</a></div>';
  h += tpGraphique(sc, d.seuil);

  h += '<div class="table-wrap" style="margin-top:10px;max-height:420px;overflow:auto;"><table><thead><tr><th>Sem.</th><th>Du</th><th style="text-align:right;">Encaissements</th><th style="text-align:right;">Décaissements</th><th style="text-align:right;">Net</th><th style="text-align:right;">Solde</th></tr></thead><tbody>'
    + p.semaines.map(function (s) {
      var tip = 'Souscripteurs : ' + tpF(s.clients) + '\nAutres entrées : ' + tpF(s.manuel_in) + '\n' + Object.keys(s.sorties).map(function (c) { return TresoPrev.CATEGORIES[c] + ' : ' + tpF(s.sorties[c]); }).join('\n') + '\nLignes manuelles (sorties) : ' + tpF(s.manuel_out);
      return '<tr title="' + tpH(tip) + '"><td>S' + s.i + '</td><td>' + tpH(s.debut) + '</td><td style="text-align:right;">' + tpH(tpF(s.entrees)) + '</td><td style="text-align:right;">' + tpH(tpF(s.total_sorties)) + '</td>'
        + '<td style="text-align:right;color:' + (s.net < 0 ? 'var(--rouge)' : 'var(--vert)') + ';">' + tpH(tpF(s.net)) + '</td><td style="text-align:right;font-weight:700;color:' + (s.solde < 0 ? 'var(--rouge)' : s.solde < d.seuil ? 'var(--or)' : 'inherit') + ';">' + tpH(tpF(s.solde)) + '</td></tr>';
    }).join('') + '</tbody></table></div>';

  h += '<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:600;">Hypothèses (à vérifier avant de décider)</summary><div style="font-size:12px;line-height:1.6;margin-top:8px;">'
    + '<div>• <strong>Encaissements souscripteurs</strong> : ' + d.nbClients + ' dossier(s) actif(s), échéances contractuelles × taux de recouvrement <strong>' + Math.round(p.taux * 100) + ' %</strong> (scénario ' + tpH(TresoPrev.SCENARIOS[TP.scenario].label.toLowerCase()) + '). '
    + (d.tauxSaisi ? 'Taux saisi par vous.' : d.tauxMesure ? 'Taux mesuré sur 90 jours : ' + tpH(tpF(d.encaisse)) + ' F encaissés pour ' + tpH(tpF(d.theorique)) + ' F dus.' : '<span style="color:var(--or);">Taux NON mesurable (aucun versement saisi sur 90 jours) : 70 % par défaut. Saisissez le vôtre ci-dessous.</span>')
    + ' <label>Forcer le taux (%) <input class="form-control" style="width:80px;display:inline-block;" type="number" min="0" max="120" value="' + (d.tauxSaisi ? DATA.params.treso_prev_taux : '') + '" placeholder="auto" onchange="tpTaux(this.value)"></label></div>'
    + '<div>• <strong>Décaissements</strong> : rythme des 90 derniers jours, source « ' + tpH(d.sourceSorties) + ' ». ' + (Object.keys(d.profil).length ? Object.keys(d.profil).map(function (c) { var q = d.profil[c]; return tpH(TresoPrev.CATEGORIES[c]) + ' ' + tpH(tpF(q.mensuel)) + ' F/mois' + (q.mode === 'mensuel' ? ' (vers le ' + q.jour + ')' : ''); }).join(' · ') : '<span style="color:var(--or);">aucune sortie trouvée sur 90 jours : projetez vos charges en lignes manuelles.</span>') + '</div>'
    + '<div>• <strong>Exclus</strong> : investissements ponctuels, financements bancaires (déblocages), nouvelles ventes, cessions foncières : à saisir en lignes manuelles ci-dessous.</div>'
    + '<div>• Projection « si les 90 derniers jours se répètent » : ce n\'est pas une prévision certaine.</div></div></details></div>';

  h += tpManuelsHtml();
  box.innerHTML = h;
}

/* ── Lignes manuelles ─────────────────────────────────────────────────── */
function tpManuelsHtml() {
  var L = tpManuels(), REC = { unique: 'Une fois', hebdo: 'Chaque semaine', mensuel: 'Chaque mois' };
  var h = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div class="card-title" style="margin:0;">🧾 Engagements et prévisions saisis</div><div class="spacer" style="flex:1;"></div><button class="btn btn-primary btn-sm" onclick="tpLigneOuvrir()">+ Ajouter</button></div>';
  if (!L.length) return h + '<p style="font-size:12px;color:var(--blanc-dim);">Aucune ligne. Ajoutez ce que l\'historique ne montre pas : achat de terrain, déblocage bancaire, vente attendue, impôt annuel…</p></div>';
  return h + '<div class="table-wrap"><table><thead><tr><th>Libellé</th><th>Sens</th><th style="text-align:right;">Montant</th><th>Date</th><th>Rythme</th><th>Proba.</th><th></th></tr></thead><tbody>'
    + L.map(function (l) {
      return '<tr><td>' + tpH(l.libelle) + '</td><td>' + (l.sens === 'entree' ? '🟢 Entrée' : '🔴 Sortie') + '</td><td style="text-align:right;">' + tpH(tpF(l.montant)) + '</td><td>' + tpH(l.date) + (l.fin ? ' → ' + tpH(l.fin) : '') + '</td><td>' + tpH(REC[l.recurrence] || '') + '</td><td>' + Math.round((l.proba == null ? 1 : l.proba) * 100) + ' %</td>'
        + '<td style="white-space:nowrap;"><button class="btn btn-secondary btn-sm" onclick="tpLigneOuvrir(\'' + tpH(l.id) + '\')">✏️</button> <button class="btn btn-secondary btn-sm" onclick="tpLigneSupprimer(\'' + tpH(l.id) + '\')">🗑</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';
}
function tpLigneOuvrir(id) {
  TP.edit = id || null; var l = id ? tpManuels().find(function (x) { return x.id === id; }) : null; l = l || { sens: 'sortie', recurrence: 'unique', proba: 1, date: tpIso(Date.now() + 7 * 86400000) };
  var m = document.getElementById('modal-tp-ligne');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-tp-ligne';
    m.innerHTML = '<div class="modal" style="max-width:480px;"><div class="modal-header"><h3>Engagement / prévision</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-tp-ligne\')">✕</button></div><div class="modal-body">'
      + '<div class="form-group"><label>Libellé</label><input class="form-control" id="tpl-lib" maxlength="80"></div>'
      + '<div class="form-grid"><div class="form-group"><label>Sens</label><select class="form-control" id="tpl-sens"><option value="sortie">🔴 Sortie</option><option value="entree">🟢 Entrée</option></select></div>'
      + '<div class="form-group"><label>Montant (FCFA)</label><input class="form-control" type="number" min="1" id="tpl-mt"></div>'
      + '<div class="form-group"><label>Date (1re échéance)</label><input class="form-control" type="date" id="tpl-date"></div>'
      + '<div class="form-group"><label>Rythme</label><select class="form-control" id="tpl-rec"><option value="unique">Une fois</option><option value="hebdo">Chaque semaine</option><option value="mensuel">Chaque mois</option></select></div>'
      + '<div class="form-group"><label>Dernière date (facultatif)</label><input class="form-control" type="date" id="tpl-fin"></div>'
      + '<div class="form-group"><label>Probabilité (%)</label><input class="form-control" type="number" min="0" max="100" id="tpl-pr"></div></div></div>'
      + '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-tp-ligne\')">Annuler</button><button class="btn btn-primary" onclick="tpLigneEnregistrer()">Enregistrer</button></div></div>';
    document.body.appendChild(m);
  }
  document.getElementById('tpl-lib').value = l.libelle || ''; document.getElementById('tpl-sens').value = l.sens; document.getElementById('tpl-mt').value = l.montant || '';
  document.getElementById('tpl-date').value = l.date || ''; document.getElementById('tpl-rec').value = l.recurrence || 'unique'; document.getElementById('tpl-fin').value = l.fin || '';
  document.getElementById('tpl-pr').value = Math.round((l.proba == null ? 1 : l.proba) * 100);
  openModal('modal-tp-ligne');
}
function tpLigneEnregistrer() {
  var lib = document.getElementById('tpl-lib').value.trim(), mt = parseFloat(document.getElementById('tpl-mt').value), dt = document.getElementById('tpl-date').value, pr = parseFloat(document.getElementById('tpl-pr').value);
  if (!lib) { toast('Libellé obligatoire.', 'error'); return; }
  if (!(mt > 0)) { toast('Montant invalide.', 'error'); return; }
  if (!dt) { toast('Date obligatoire.', 'error'); return; }
  if (isNaN(pr) || pr < 0 || pr > 100) { toast('Probabilité entre 0 et 100.', 'error'); return; }
  var fin = document.getElementById('tpl-fin').value; if (fin && fin < dt) { toast('La dernière date précède la première.', 'error'); return; }
  var l = { id: TP.edit || uid(), libelle: lib, sens: document.getElementById('tpl-sens').value, montant: mt, date: dt, recurrence: document.getElementById('tpl-rec').value, fin: fin || '', proba: pr / 100 };
  DATA.params = DATA.params || {}; var L = (DATA.params.treso_previsions || []).slice(), i = L.findIndex(function (x) { return x.id === l.id; });
  if (i >= 0) L[i] = l; else L.push(l); DATA.params.treso_previsions = L;
  tpSauverParams(); closeModal('modal-tp-ligne'); tpRendre(); toast('Enregistré.', 'success');
}
function tpLigneSupprimer(id) {
  if (!confirm('Supprimer cette ligne ?')) return;
  DATA.params.treso_previsions = tpManuels().filter(function (x) { return x.id !== id; }); tpSauverParams(); tpRendre();
}

/* ── Export CSV (séparateur « ; », accents Excel) ─────────────────────── */
function tpExporter() {
  var d = tpDonnees(), p = TresoPrev.projeter(Object.assign({}, d, { scenario: TP.scenario })), cats = Object.keys(TresoPrev.CATEGORIES).filter(function (c) { return c !== 'manuel'; });
  var q = function (v) { var s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; };   /* neutralise l'injection de formule */
  var rows = [['Semaine', 'Du', 'Au', 'Encaissements souscripteurs', 'Autres entrées'].concat(cats.map(function (c) { return TresoPrev.CATEGORIES[c]; })).concat(['Sorties manuelles', 'Net', 'Solde'])];
  p.semaines.forEach(function (s) { rows.push([s.i, s.debut, s.fin, Math.round(s.clients), Math.round(s.manuel_in)].concat(cats.map(function (c) { return Math.round(s.sorties[c] || 0); })).concat([Math.round(s.manuel_out), Math.round(s.net), Math.round(s.solde)])); });
  var csv = '﻿' + rows.map(function (r) { return r.map(q).join(';'); }).join('\r\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'tresorerie-previsionnelle-' + TP.scenario + '-' + tpIso(Date.now()) + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
