/* Santé des marges — interface (page Bilan de Promotion). Dépend de marge-prog.js et de bpCompute. */
function mpH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function mpF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))) + ' F'; }
var MP_STATUT = { rouge: ['#fee2e2', '#b91c1c', '🔴 Marge négative'], orange: ['#fef3c7', '#92400e', '🟠 Sous la cible'], vert: ['#dcfce7', '#166534', '🟢 Dans la cible'], inconnu: ['#e2e8f0', '#475569', '⚪ Non calculable'] };

function mpCible() { var v = DATA.params && DATA.params.marge_cible_pct; return v == null || v === '' || isNaN(parseFloat(v)) ? MargeProg.CIBLE_DEFAUT : parseFloat(v); }
function mpResume(p) {
  var b = bpCompute(p.id);
  return { b: b, r: { produitsEngages: b.produits, produitsPotentiel: b.produitsPotentiel, couts: b.couts, margePot: b.margePot, caRestant: b.caLotsPotentiel - b.caLotsVendus,
    nbLotsRestants: b.lots.length - b.lotsVendus.length, coutFoncier: b.coutFoncier, coutTravaux: b.coutTravaux, foncierLie: !!b.parcelle,
    programmeConstruction: (p.nature || 'construction') === 'construction', nbLogements: b.lotsLogement.length,
    nbLotsSansPrix: b.lots.filter(function (l) { return !(parseFloat(l.prix) > 0); }).length, coutCommercial: b.coutCommercial, commissionsAVenir: b.commissionsAVenir,
    encaisse: b.encaisse, nbCommissions: b.nbCommissions } };
}
function mpCibleSauver(v) {
  var x = parseFloat(v); if (isNaN(x) || x < 0 || x >= 100) { toast('Marge cible entre 0 et 99 %.', 'error'); return; }
  DATA.params = DATA.params || {}; DATA.params.marge_cible_pct = x;
  dbPut('params', DATA.params); if (typeof syncToSupabase === 'function') syncToSupabase('pi_params', DATA.params); mpRendre();
}
function mpOuvrirProgramme(id) { var s = document.getElementById('bp-programme'); if (s) { s.value = id; if (typeof bpRender === 'function') bpRender(); window.scrollTo(0, 0); } }

function mpRendre() {
  var box = document.getElementById('bp-sante'); if (!box || !window.MargeProg || typeof bpCompute !== 'function') return;
  var cible = mpCible(), progs = (DATA.programmes || []).filter(function (p) { return p.statut !== 'archive'; });
  if (!progs.length) { box.innerHTML = ''; return; }
  var L = progs.map(function (p) { var x = mpResume(p); return { p: p, b: x.b, r: x.r, e: MargeProg.evaluer(x.r, cible) }; });
  var C = MargeProg.classer(L), nb = { rouge: 0, orange: 0, vert: 0, inconnu: 0 }, nbInfiables = 0;
  C.forEach(function (x) { nb[x.e.statut]++; if (!x.e.fiable) nbInfiables++; });
  var h = '<div class="card"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;"><div class="card-title" style="margin:0;">🚦 Santé des marges — tous programmes</div><div style="flex:1;"></div>'
    + '<label style="font-size:12px;">Marge cible (%) <input class="form-control" type="number" min="0" max="99" step="1" value="' + mpH(cible) + '" style="width:80px;display:inline-block;" onchange="mpCibleSauver(this.value)"></label></div>'
    + '<div style="font-size:12px;margin-bottom:8px;">🔴 ' + nb.rouge + ' · 🟠 ' + nb.orange + ' · 🟢 ' + nb.vert + (nb.inconnu ? ' · ⚪ ' + nb.inconnu : '') + (nbInfiables ? ' · <span style="color:var(--or);">⚠ ' + nbInfiables + ' programme(s) à données incomplètes</span>' : '') + '</div>'
    + '<div class="table-wrap"><table style="width:100%;font-size:12px;"><thead><tr><th style="text-align:left;">Programme</th><th>Statut</th><th style="text-align:right;">Marge potentielle</th><th style="text-align:right;">Commissions à venir</th><th style="text-align:right;">Prix moyen plancher</th><th style="text-align:left;">Fiabilité</th></tr></thead><tbody>'
    + C.map(function (x) {
      var s = MP_STATUT[x.e.statut], pl = x.e.plancher;
      var plTxt = !pl ? '—' : pl.deja_insuffisant ? '<span style="color:var(--rouge);" title="Même au prix catalogue, la cible n\'est pas tenue">' + mpH(mpF(pl.prix_moyen_min)) + ' > ' + mpH(mpF(pl.prix_moyen_actuel)) + ' (catalogue)</span>'
        : mpH(mpF(pl.prix_moyen_min)) + ' <span style="color:var(--blanc-dim);">/ ' + mpH(mpF(pl.prix_moyen_actuel)) + ' · remise max ' + pl.remise_max_pct + ' %</span>';
      return '<tr style="border-top:1px solid var(--bord);cursor:pointer;" onclick="mpOuvrirProgramme(\'' + mpH(x.p.id) + '\')"><td style="padding:7px 0;"><strong>' + mpH(x.p.nom || x.p.id) + '</strong></td>'
        + '<td><span class="pl-chip" style="background:' + s[0] + ';color:' + s[1] + ';">' + s[2] + '</span></td>'
        + '<td style="text-align:right;">' + (x.e.taux_pot == null ? '—' : mpH(mpF(x.r.margePot)) + ' (' + x.e.taux_pot + ' %)' + (x.e.taux_net != null ? '<br><span style="font-size:10px;color:var(--blanc-dim);">nette : ' + x.e.taux_net + ' %</span>' : '')) + '</td>'
        + '<td style="text-align:right;">' + (x.r.commissionsAVenir == null ? '<span title="Taux non observable : aucune commission ou aucun encaissement">—</span>' : mpH(mpF(x.r.commissionsAVenir))) + '</td>'
        + '<td style="text-align:right;">' + plTxt + '</td>'
        + '<td style="font-size:11px;">' + (x.e.fiable ? '<span style="color:var(--vert);">✓ complète</span>' : x.e.manques.map(function (m) { return '<div style="color:var(--or);">⚠ ' + mpH(m.t) + '</div>'; }).join('')) + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    + '<div style="font-size:11px;color:var(--blanc-dim);margin-top:8px;">Une marge élevée sur des coûts manquants est trompeuse : traitez d\'abord les ⚠. Prix plancher = prix moyen minimal des lots restants pour tenir la marge cible sur toute l\'opération (hors commissions à venir). Commissions à venir = taux réellement observé sur le programme × reste à encaisser.</div></div>';
  box.innerHTML = h;
}
