/* Entonnoir commercial — interface (page Pipeline Commercial). Dépend de entonnoir.js et des globales de l'ERP. */
var ENT = { periode: '90', source: '', commercial: '', programme: '', perduId: null };
var ENT_SOURCES = { bouche_oreille: 'Bouche-à-oreille', reseaux_sociaux: 'Réseaux sociaux', site_web: 'Site web', salon: 'Salon', affichage: 'Affichage', commercial: 'Agent commercial', partenaire: 'Partenaire' };

function entH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function entF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))) + ' F'; }
function entPar() { return (APP.currentUser && APP.currentUser.nom) || ''; }
function entNomSegment(champ, k) {
  if (k === '—') return 'Non renseigné';
  if (champ === 'source') return ENT_SOURCES[k] || k;
  if (champ === 'programme_id') { var p = (DATA.programmes || []).find(function (x) { return x.id === k; }); return p ? p.nom : k; }
  if (champ === 'commercial_id') { try { return (typeof _itiResolveCommercial === 'function' && _itiResolveCommercial(k)) || k; } catch (e) { return k; } }
  return k;
}
function entSauver(l) { dbPut('leads', l); if (typeof syncToSupabase === 'function') syncToSupabase('pi_leads', l); }

/* ── Marquer perdu (motif obligatoire) ───────────────────────────────── */
function entPerduOuvrir(id) {
  var l = (DATA.leads || []).find(function (x) { return x.id === id; }); if (!l) return;
  ENT.perduId = id;
  var m = document.getElementById('modal-ent-perdu');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-ent-perdu';
    m.innerHTML = '<div class="modal" style="max-width:460px;"><div class="modal-header"><h3>✕ Prospect perdu</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-ent-perdu\')">✕</button></div>'
      + '<div class="modal-body"><p id="ent-perdu-nom" style="margin-bottom:10px;"></p>'
      + '<div class="form-group"><label>Motif (obligatoire)</label><select class="form-control" id="ent-perdu-motif"><option value="">— Choisir —</option>'
      + Object.keys(Entonnoir.MOTIFS).map(function (k) { return '<option value="' + k + '">' + entH(Entonnoir.MOTIFS[k]) + '</option>'; }).join('') + '</select></div>'
      + '<div class="form-group"><label>Précision (facultatif)</label><textarea class="form-control" id="ent-perdu-note" maxlength="300" style="min-height:60px;"></textarea></div></div>'
      + '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-ent-perdu\')">Annuler</button><button class="btn btn-danger" onclick="entPerduConfirmer()">Marquer perdu</button></div></div>';
    document.body.appendChild(m);
  }
  document.getElementById('ent-perdu-nom').textContent = l.nom + ' — ' + (Entonnoir.LIBELLES[l.stade] || l.stade);
  document.getElementById('ent-perdu-motif').value = ''; document.getElementById('ent-perdu-note').value = '';
  openModal('modal-ent-perdu');
}
function entPerduConfirmer() {
  var l = (DATA.leads || []).find(function (x) { return x.id === ENT.perduId; }); if (!l) return;
  var motif = document.getElementById('ent-perdu-motif').value;
  if (!motif) { toast('Choisissez le motif de la perte.', 'error'); return; }
  if (!Entonnoir.marquerPerdu(l, motif, document.getElementById('ent-perdu-note').value, Date.now(), entPar())) return;
  entSauver(l); closeModal('modal-ent-perdu'); renderPipeline(); toast('« ' + l.nom + ' » marqué perdu.', 'success');
  if (document.getElementById('modal-entonnoir') && document.getElementById('modal-entonnoir').classList.contains('open')) entRendre();
}
function entRouvrir(id) {
  var l = (DATA.leads || []).find(function (x) { return x.id === id; });
  if (l && Entonnoir.rouvrir(l)) { entSauver(l); renderPipeline(); entRendre(); toast('« ' + l.nom + ' » rouvert.', 'success'); }
}

/* ── Tableau de bord de l'entonnoir ──────────────────────────────────── */
function entOuvrir() {
  var m = document.getElementById('modal-entonnoir');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-entonnoir';
    m.innerHTML = '<div class="modal" style="max-width:980px;width:96vw;"><div class="modal-header"><h3>🔻 Entonnoir commercial</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-entonnoir\')">✕</button></div>'
      + '<div class="modal-body" id="ent-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-entonnoir\')">Fermer</button></div></div>';
    document.body.appendChild(m);
  }
  openModal('modal-entonnoir'); entRendre();
}
function entFiltre(k, v) { ENT[k] = v; entRendre(); }

function entRendre() {
  var b = document.getElementById('ent-body'); if (!b) return;
  var now = Date.now(), tous = DATA.leads || [];
  var debut = ENT.periode === 'tout' ? '' : new Date(now - (+ENT.periode) * 86400000).toISOString().slice(0, 10);
  var ticket = (typeof _cmrcTicketMoyen === 'function') ? _cmrcTicketMoyen() : 0;
  var r = Entonnoir.analyser(tous, { debut: debut, source: ENT.source, commercial_id: ENT.commercial, programme_id: ENT.programme, ticket: ticket }, now);
  var opt = function (val, lib, cur) { return '<option value="' + entH(val) + '"' + (val === cur ? ' selected' : '') + '>' + entH(lib) + '</option>'; };
  var coms = {}; tous.forEach(function (l) { if (l.commercial_id) coms[l.commercial_id] = 1; });
  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
    + '<select class="form-control" style="max-width:170px;" onchange="entFiltre(\'periode\',this.value)">' + [['30', '30 derniers jours'], ['90', '90 derniers jours'], ['365', '12 derniers mois'], ['tout', 'Tout']].map(function (x) { return opt(x[0], x[1], ENT.periode); }).join('') + '</select>'
    + '<select class="form-control" style="max-width:190px;" onchange="entFiltre(\'source\',this.value)">' + opt('', 'Toutes sources', ENT.source) + Object.keys(ENT_SOURCES).map(function (k) { return opt(k, ENT_SOURCES[k], ENT.source); }).join('') + '</select>'
    + '<select class="form-control" style="max-width:190px;" onchange="entFiltre(\'commercial\',this.value)">' + opt('', 'Tous commerciaux', ENT.commercial) + Object.keys(coms).map(function (k) { return opt(k, entNomSegment('commercial_id', k), ENT.commercial); }).join('') + '</select>'
    + '<select class="form-control" style="max-width:190px;" onchange="entFiltre(\'programme\',this.value)">' + opt('', 'Tous programmes', ENT.programme) + (DATA.programmes || []).map(function (p) { return opt(p.id, p.nom, ENT.programme); }).join('') + '</select></div>';

  if (!r.total) { b.innerHTML = h + '<p style="text-align:center;padding:24px;color:var(--blanc-dim);">Aucun prospect entré sur cette période.</p>'; return; }

  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px;">'
    + [['Prospects entrés', r.total], ['Conversion globale', r.conversion_globale + '%'], ['Perdus', r.perdus], ['Valeur perdue', entF(r.valeur_perdue)]]
      .map(function (k) { return '<div class="kpi-card"><div class="kpi-label">' + k[0] + '</div><div class="kpi-value" style="font-size:18px;">' + entH(k[1]) + '</div></div>'; }).join('') + '</div>';
  if (r.estimes_part >= 30) h += '<div class="alert alert-warn" style="margin-bottom:12px;">ℹ️ ' + r.estimes_part + ' % des prospects datent d\'avant le suivi d\'historique : leur parcours est estimé d\'après leur stade actuel. La précision augmente avec chaque mouvement saisi.</div>';

  var max = r.etapes[0].atteint || 1;
  h += '<h4 style="margin:6px 0;">Parcours</h4>' + r.etapes.map(function (e, i) {
    var d = r.durees[i], isG = r.goulot === e.stade;
    return '<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;gap:8px;flex-wrap:wrap;">'
      + '<span>' + (isG ? '🚧 ' : '') + '<strong>' + entH(e.libelle) + '</strong>' + (isG ? ' <span style="color:#b91c1c;">goulot</span>' : '') + '</span>'
      + '<span><strong>' + e.atteint + '</strong>' + (i ? ' · ' + e.taux_etape + '% passent' + (e.fiable ? '' : ' <span title="Effectif trop faible pour conclure">(peu fiable)</span>') : '')
      + (e.perdus ? ' · <span style="color:#b91c1c;">−' + e.perdus + ' perdus ici</span>' : '') + (d && d.mediane != null ? ' · ⏱ ' + d.mediane + ' j (médiane)' : '') + '</span></div>'
      + '<div style="height:16px;background:var(--bord,#eef);border-radius:4px;overflow:hidden;"><div style="width:' + Math.max(3, Math.round(e.atteint / max * 100)) + '%;height:100%;background:' + (isG ? '#DC2626' : '#6366F1') + ';"></div></div></div>';
  }).join('');

  if (r.scenario) h += '<div class="alert alert-info" style="margin:10px 0;">🎯 <strong>Levier n°1 : « ' + entH(r.scenario.etape) + ' »</strong> — si ce passage gagnait +' + r.scenario.gain_points + ' points, ≈ <strong>+' + r.scenario.ventes_en_plus + ' vente(s)</strong>'
    + (r.scenario.valeur_en_plus ? ' soit ≈ <strong>' + entF(r.scenario.valeur_en_plus) + '</strong> (ticket moyen ' + entF(ticket) + ')' : '') + '. Estimation indicative, pas une prévision.</div>';

  h += '<h4 style="margin:14px 0 6px;">Pourquoi on perd</h4>';
  if (!r.perdus) h += '<p style="color:var(--blanc-dim);font-size:12px;">Aucune perte enregistrée. Utilisez ✕ sur une carte du pipeline pour consigner le motif : c\'est lui qui montre quoi corriger (prix, financement, concurrence…).</p>';
  else {
    h += '<div class="table-wrap"><table><thead><tr><th>Motif</th><th>Prospects</th><th>Valeur perdue</th></tr></thead><tbody>'
      + r.motifs.map(function (m) { return '<tr><td>' + entH(m.libelle) + '</td><td>' + m.n + '</td><td>' + entH(entF(m.valeur)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (r.sans_motif) h += '<p style="font-size:12px;color:#b45309;">' + r.sans_motif + ' perte(s) sans motif exploitable.</p>';
  }

  [['par_source', 'source', 'Par source'], ['par_commercial', 'commercial_id', 'Par commercial'], ['par_programme', 'programme_id', 'Par programme']].forEach(function (g) {
    var seg = r[g[0]]; if (!seg.length || (seg.length === 1 && seg[0].cle === '—')) return;
    h += '<h4 style="margin:14px 0 6px;">' + g[2] + '</h4><div class="table-wrap"><table><thead><tr><th></th><th>Prospects</th><th>Convertis</th><th>Taux</th><th>Perdus</th></tr></thead><tbody>'
      + seg.map(function (s) { return '<tr' + (s.fiable ? '' : ' style="opacity:.55;"') + '><td>' + entH(entNomSegment(g[1], s.cle)) + '</td><td>' + s.n + '</td><td>' + s.convertis + '</td><td><strong>' + s.taux + '%</strong>' + (s.fiable ? '' : ' <span title="Moins de ' + Entonnoir.MIN_EFFECTIF + ' prospects : non concluant">⚠</span>') + '</td><td>' + s.perdus + '</td></tr>'; }).join('') + '</tbody></table></div>';
  });

  var dor = Entonnoir.dormants(tous, now, Entonnoir.DORMANT_JOURS).slice(0, 15);
  h += '<h4 style="margin:14px 0 6px;">💤 Prospects dormants (sans mouvement depuis ' + Entonnoir.DORMANT_JOURS + ' j)</h4>';
  if (!dor.length) h += '<p style="color:var(--vert);font-size:12px;">✅ Aucun prospect ouvert ne dort.</p>';
  else h += '<div class="table-wrap"><table><thead><tr><th>Prospect</th><th>Stade</th><th>Budget</th><th>Inactif</th><th></th></tr></thead><tbody>'
    + dor.map(function (x) {
      var l = x.lead, wa = (typeof telWhatsApp === 'function' && l.tel) ? 'https://wa.me/' + telWhatsApp(l.tel) : '';
      return '<tr><td>' + entH(l.nom) + '</td><td>' + entH(Entonnoir.LIBELLES[l.stade] || l.stade) + '</td><td>' + (l.budget ? entH(entF(l.budget)) : '—') + '</td><td>' + x.jours + ' j</td>'
        + '<td style="white-space:nowrap;">' + (wa ? '<a class="btn btn-secondary btn-sm" href="' + entH(wa) + '" target="_blank" rel="noopener">💬 Relancer</a> ' : '')
        + '<button class="btn btn-secondary btn-sm" onclick="closeModal(\'modal-entonnoir\');openLead(\'' + entH(l.id) + '\')">✏️</button></td></tr>';
    }).join('') + '</tbody></table></div>';

  var per = tous.filter(function (l) { return l.statut === 'perdu'; }).slice(-10).reverse();
  if (per.length) h += '<h4 style="margin:14px 0 6px;">Derniers perdus</h4><div class="table-wrap"><table><tbody>'
    + per.map(function (l) { return '<tr><td>' + entH(l.nom) + '</td><td>' + entH((l.perte && Entonnoir.MOTIFS[l.perte.motif]) || 'Motif non renseigné') + '</td><td><button class="btn btn-secondary btn-sm" onclick="entRouvrir(\'' + entH(l.id) + '\')">↩ Rouvrir</button></td></tr>'; }).join('') + '</tbody></table></div>';
  b.innerHTML = h;
}
