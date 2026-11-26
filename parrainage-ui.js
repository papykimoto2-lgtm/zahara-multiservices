/* Parrainage souscripteur — interface. Dépend de parrainage.js et des globales de l'ERP.
   Les récompenses sont validées et versées PAR UN HUMAIN ; le paiement se passe hors module (caisse / virement) :
   le journal garde mode, référence, date et auteur. Aucune écriture comptable n'est générée ici. */
var PAR = { onglet: 'suivi' };
function parH(x) { return typeof escHtml === 'function' ? escHtml(x) : String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function parF(n) { return (typeof fmtF === 'function' ? fmtF(Math.round(n || 0)) : String(Math.round(n || 0))) + ' F'; }
function parNom(c) { return ((c.prenoms || '') + ' ' + (c.nom || '')).trim() || c.id; }
function parQui() { return (APP.currentUser && APP.currentUser.nom) || ''; }
function parManager() { return typeof hasRole === 'function' && hasRole('manager'); }
var PAR_ETAT = { eligible: ['#fef3c7', '#92400e'], due: ['#e0f2fe', '#075985'], versee: ['#dcfce7', '#166534'], prospect: ['#e2e8f0', '#475569'], attente_versement: ['#e2e8f0', '#475569'],
  perdu: ['#e2e8f0', '#475569'], annulee: ['#fee2e2', '#b91c1c'], annulee_resilie: ['#fee2e2', '#b91c1c'], refuse_auto: ['#fee2e2', '#b91c1c'], refuse_parrain: ['#fee2e2', '#b91c1c'], bloque_retard: ['#fef3c7', '#92400e'], plafond: ['#fef3c7', '#92400e'], parrain_inconnu: ['#fee2e2', '#b91c1c'] };

function parDonnees() {
  var enRetard = {}; ((typeof getRetardataires === 'function') ? getRetardataires() : []).forEach(function (r) { enRetard[r.id] = true; });
  return Parrainage.analyser({ params: DATA.params && DATA.params.parrainage, clients: DATA.clients || [], leads: DATA.leads || [], versements: DATA.versements || [], enRetard: enRetard, now: Date.now() });
}
function parSauverClient(c) { return dbPut('clients', c).then(function () { if (typeof syncToSupabase === 'function') syncToSupabase('pi_clients', c); }); }

/* Pastille sur la carte du pipeline. */
function parChip(l) {
  if (!l.parrain_id) return '';
  var p = (DATA.clients || []).find(function (c) { return c.id === l.parrain_id; });
  return '<span class="pl-chip" style="background:#fef3c7;color:#92400e;" title="Parrain">🤝 ' + parH(p ? parNom(p) : 'parrain') + '</span>';
}

function parOuvrir(onglet) {
  if (onglet) PAR.onglet = onglet;
  var m = document.getElementById('modal-par');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-par';
    m.innerHTML = '<div class="modal" style="max-width:1040px;width:97vw;"><div class="modal-header"><h3>🤝 Parrainage</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-par\')">✕</button></div>'
      + '<div class="modal-body" id="par-body"></div><div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-par\')">Fermer</button></div></div>';
    document.body.appendChild(m);
  }
  openModal('modal-par'); parRendre();
}
function parOnglet(o) { PAR.onglet = o; parRendre(); }

function parRendre() {
  var b = document.getElementById('par-body'); if (!b) return;
  var r = parDonnees(), P = r.cfg;
  var tab = function (k, l) { return '<button class="btn btn-' + (PAR.onglet === k ? 'primary' : 'secondary') + ' btn-sm" onclick="parOnglet(\'' + k + '\')">' + l + '</button>'; };
  var h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">' + tab('suivi', '📋 Suivi') + tab('ambassadeurs', '🌟 Ambassadeurs (' + r.ambassadeurs.length + ')') + tab('attribuer', '➕ Enregistrer un parrainage') + tab('reglages', '⚙️ Règles') + '</div>';
  if (!P.actif) h += '<div class="alert alert-warn" style="margin-bottom:10px;">🟠 Programme <strong>désactivé</strong> : aucune offre n\'est annoncée dans les messages. Activez-le dans « Règles » (administrateur).</div>';
  h += PAR.onglet === 'ambassadeurs' ? parHtmlAmbassadeurs(r) : PAR.onglet === 'attribuer' ? parHtmlAttribuer() : PAR.onglet === 'reglages' ? parHtmlReglages(r) : parHtmlSuivi(r);
  b.innerHTML = h;
}

function parHtmlSuivi(r) {
  var t = r.totaux, kpi = function (l, v) { return '<div class="kpi-card"><div class="kpi-label">' + l + '</div><div class="kpi-value" style="font-size:16px;">' + parH(v) + '</div></div>'; };
  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;">' + kpi('Filleuls', t.liens) + kpi('Souscrits', t.souscrits) + kpi('Valeur des contrats', parF(t.valeur)) + kpi('À verser', parF(t.due)) + kpi('Versé', parF(t.versee))
    + kpi('Coût / valeur', t.valeur > 0 ? Math.round((t.due + t.versee) / t.valeur * 1000) / 10 + ' %' : '—') + '</div>';
  if (r.a_creer.length) h += '<div class="alert alert-info" style="margin-bottom:10px;">✅ <strong>' + r.a_creer.length + ' récompense(s) éligible(s)</strong> (' + parH(parF(r.a_creer.reduce(function (s, x) { return s + x.montant; }, 0))) + ').'
    + (parManager() ? ' <button class="btn btn-primary btn-sm" onclick="parValiderTout()">Valider toutes</button>' : '') + '</div>';
  if (!r.liens.length) return h + '<p style="text-align:center;color:var(--blanc-dim);padding:18px;">Aucun parrainage enregistré. Onglet « Enregistrer un parrainage » pour commencer.</p>';
  h += '<div class="table-wrap"><table><thead><tr><th>Filleul</th><th>Parrain</th><th style="text-align:right;">Versé</th><th>État</th><th></th></tr></thead><tbody>'
    + r.liens.map(function (e) {
      var s = PAR_ETAT[e.etat] || ['#e2e8f0', '#475569'], act = '';
      if (parManager() && e.parrain) {
        if (e.etat === 'eligible') act = '<button class="btn btn-primary btn-sm" onclick="parValider(\'' + parH(e.parrain_id) + '\',\'' + parH(e.key) + '\')">✓ Valider</button>';
        if (e.etat === 'due') act = '<button class="btn btn-primary btn-sm" onclick="parVerserOuvrir(\'' + parH(e.parrain_id) + '\',\'' + parH(e.key) + '\')">💰 Marquer versée</button> <button class="btn btn-secondary btn-sm" onclick="parAnnuler(\'' + parH(e.parrain_id) + '\',\'' + parH(e.key) + '\')">✕</button>';
      }
      return '<tr><td><strong>' + parH(e.nom) + '</strong><br><span style="font-size:11px;color:var(--blanc-dim);">' + (e.client ? 'souscripteur' : 'prospect') + (e.tel ? ' · +' + parH(e.tel) : '') + '</span></td>'
        + '<td>' + (e.parrain ? parH(parNom(e.parrain)) : '—') + '</td><td style="text-align:right;">' + (e.client ? e.verse_pct + ' %' : '—') + '</td>'
        + '<td><span class="pl-chip" style="background:' + s[0] + ';color:' + s[1] + ';">' + parH(Parrainage.LIBELLES[e.etat] || e.etat) + '</span></td><td style="white-space:nowrap;">' + act + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  if (r.classement.length) h += '<h4 style="margin:14px 0 6px;">Meilleurs parrains</h4><div class="table-wrap"><table><thead><tr><th>Parrain</th><th style="text-align:right;">Filleuls</th><th style="text-align:right;">Souscrits</th><th style="text-align:right;">Valeur</th><th style="text-align:right;">À verser</th><th style="text-align:right;">Versé</th></tr></thead><tbody>'
    + r.classement.slice(0, 10).map(function (s) { return '<tr><td>' + parH(s.parrain ? parNom(s.parrain) : s.parrain_id) + '</td><td style="text-align:right;">' + s.liens + '</td><td style="text-align:right;">' + s.souscrits + '</td><td style="text-align:right;">' + parH(parF(s.valeur)) + '</td><td style="text-align:right;">' + parH(parF(s.due)) + '</td><td style="text-align:right;">' + parH(parF(s.versee)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  return h + '<p style="font-size:11px;color:var(--blanc-dim);margin-top:8px;">Le paiement se fait hors module (caisse ou virement) : ici on trace mode, référence et date. Aucune écriture comptable n\'est générée : à passer en comptabilité.</p>';
}

function parHtmlAmbassadeurs(r) {
  if (!r.ambassadeurs.length) return '<p style="text-align:center;color:var(--blanc-dim);padding:18px;">Aucun souscripteur à solliciter (satisfaits = soldés ou 50 % et plus versés, à jour, non sollicités depuis 90 jours).</p>';
  var soc = (DATA.params && DATA.params.societe) || '';
  return '<p style="font-size:12px;color:var(--blanc-dim);margin-bottom:8px;">Souscripteurs soldés ou à 50 % et plus, à jour de leurs versements. Un clic ouvre WhatsApp avec le message ; « Sollicité » date la demande (pas de relance avant 90 jours).</p>'
    + '<div class="table-wrap"><table><thead><tr><th>Souscripteur</th><th>Avancement</th><th></th></tr></thead><tbody>' + r.ambassadeurs.slice(0, 40).map(function (a) {
      var c = a.client, wa = (typeof telWhatsApp === 'function') ? 'https://wa.me/' + telWhatsApp(c.tel) + '?text=' + encodeURIComponent(Parrainage.messageDemande(c, r.cfg, soc)) : '';
      return '<tr><td><strong>' + parH(parNom(c)) + '</strong></td><td>' + (a.solde ? '✅ Soldé' : a.pct + ' %') + '</td><td style="white-space:nowrap;"><a class="btn btn-primary btn-sm" href="' + parH(wa) + '" target="_blank" rel="noopener">💬 Message</a> '
        + '<button class="btn btn-secondary btn-sm" onclick="parSollicite(\'' + parH(c.id) + '\')">Sollicité</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}
async function parSollicite(id) {
  var c = (DATA.clients || []).find(function (x) { return x.id === id; }); if (!c) return;
  c.parrainage_demandes = (c.parrainage_demandes || []).concat([{ date: new Date().toISOString().slice(0, 10), par: parQui() }]);
  await parSauverClient(c); parRendre(); toast('Sollicitation datée.', 'success');
}

/* ── Enregistrer un parrainage ───────────────────────────────────────── */
function parLibelleClient(c) { return parNom(c) + ' — ' + (c.tel || '') + ' [' + c.id + ']'; }
function parHtmlAttribuer() {
  var cl = (DATA.clients || []).filter(function (c) { return c.statut !== 'resilie'; }), ld = (DATA.leads || []).filter(function (l) { return l.statut !== 'perdu' && l.statut !== 'converti' && l.stade !== 'reservation'; });
  return '<datalist id="par-dl-parrains">' + cl.map(function (c) { return '<option value="' + parH(parLibelleClient(c)) + '">'; }).join('') + '</datalist>'
    + '<datalist id="par-dl-filleuls">' + ld.map(function (l) { return '<option value="' + parH('Prospect : ' + l.nom + ' — ' + (l.tel || '') + ' [lead:' + l.id + ']') + '">'; }).join('')
    + cl.filter(function (c) { return !c.parrain_id; }).map(function (c) { return '<option value="' + parH('Souscripteur : ' + parLibelleClient(c).replace(/\[(.*)\]$/, '[client:$1]')) + '">'; }).join('') + '</datalist>'
    + '<div class="form-grid"><div class="form-group"><label>Parrain (souscripteur)</label><input class="form-control" id="par-parrain" list="par-dl-parrains" placeholder="Rechercher un nom ou un numéro…"></div>'
    + '<div class="form-group"><label>Filleul (prospect ou souscripteur)</label><input class="form-control" id="par-filleul" list="par-dl-filleuls" placeholder="Rechercher…"></div></div>'
    + '<button class="btn btn-primary" onclick="parEnregistrer()">Enregistrer le parrainage</button>'
    + '<p style="font-size:12px;color:var(--blanc-dim);margin-top:8px;">Un prospect parrainé passe en source « Parrainage ». S\'il devient souscripteur, le lien est retrouvé par son numéro de téléphone.</p>';
}
async function parEnregistrer() {
  var idDe = function (v, pref) { var m = String(v || '').match(/\[(?:(lead|client):)?([^\]]+)\]\s*$/); return m ? { type: m[1] || pref, id: m[2] } : null; };
  var p = idDe(document.getElementById('par-parrain').value, 'client'), f = idDe(document.getElementById('par-filleul').value, '');
  if (!p || p.type !== 'client') { toast('Choisissez le parrain dans la liste.', 'error'); return; }
  if (!f || !f.type) { toast('Choisissez le filleul dans la liste.', 'error'); return; }
  var parrain = (DATA.clients || []).find(function (c) { return c.id === p.id; }); if (!parrain) { toast('Parrain introuvable.', 'error'); return; }
  if (f.type === 'client') {
    var c = (DATA.clients || []).find(function (x) { return x.id === f.id; }); if (!c) { toast('Filleul introuvable.', 'error'); return; }
    if (c.id === parrain.id) { toast('Un souscripteur ne peut pas se parrainer lui-même.', 'error'); return; }
    c.parrain_id = parrain.id; await parSauverClient(c);
  } else {
    var l = (DATA.leads || []).find(function (x) { return x.id === f.id; }); if (!l) { toast('Filleul introuvable.', 'error'); return; }
    if (Parrainage.tel(l.tel) && Parrainage.tel(l.tel) === Parrainage.tel(parrain.tel)) { toast('Même numéro que le parrain : auto-parrainage refusé.', 'error'); return; }
    l.parrain_id = parrain.id; l.source = 'parrainage';
    await dbPut('leads', l); if (typeof syncToSupabase === 'function') syncToSupabase('pi_leads', l); if (typeof renderPipeline === 'function') renderPipeline();
  }
  toast('Parrainage enregistré.', 'success'); PAR.onglet = 'suivi'; parRendre();
}

/* ── Récompenses : valider, verser, annuler (tout est tracé dans la fiche du parrain) ─── */
function parLigneJournal(parrain, key) { return (parrain.parrainage_recompenses || []).filter(function (r) { return r.filleul_key === key && r.statut !== 'annulee'; })[0]; }
async function parCreer(x) {
  var parrain = (DATA.clients || []).find(function (c) { return c.id === x.parrain_id; }); if (!parrain || parLigneJournal(parrain, x.filleul_key)) return false;
  parrain.parrainage_recompenses = (parrain.parrainage_recompenses || []).concat([{ id: uid(), parrain_id: parrain.id, filleul_key: x.filleul_key, filleul_nom: x.filleul_nom, montant: x.montant, type: x.type, statut: 'due',
    valide_le: new Date().toISOString().slice(0, 10), valide_par: parQui() }]);
  await parSauverClient(parrain); return true;
}
async function parValider(parrainId, key) {
  if (!parManager()) { toast('Réservé aux responsables.', 'error'); return; }
  var x = parDonnees().a_creer.find(function (a) { return a.parrain_id === parrainId && a.filleul_key === key; });
  if (!x) { toast('Plus éligible.', 'warn'); parRendre(); return; }
  if (await parCreer(x)) toast('Récompense validée : à verser.', 'success'); parRendre();
}
async function parValiderTout() {
  if (!parManager()) { toast('Réservé aux responsables.', 'error'); return; }
  var L = parDonnees().a_creer; if (!L.length || !confirm('Valider ' + L.length + ' récompense(s) ?')) return;
  var n = 0; for (var i = 0; i < L.length; i++) if (await parCreer(L[i])) n++;
  toast(n + ' récompense(s) validée(s).', 'success'); parRendre();
}
function parVerserOuvrir(parrainId, key) {
  PAR.cible = { parrainId: parrainId, key: key };
  var m = document.getElementById('modal-par-verse');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'modal-par-verse';
    m.innerHTML = '<div class="modal" style="max-width:420px;"><div class="modal-header"><h3>💰 Récompense versée</h3><button class="btn btn-secondary btn-icon" onclick="closeModal(\'modal-par-verse\')">✕</button></div><div class="modal-body">'
      + '<div class="form-group"><label>Mode de paiement</label><select class="form-control" id="parv-mode"><option value="especes">Espèces</option><option value="virement">Virement</option><option value="mobile_money">Mobile Money</option><option value="cheque">Chèque</option><option value="remise">Remise sur le solde</option></select></div>'
      + '<div class="form-group"><label>Référence (obligatoire)</label><input class="form-control" id="parv-ref" maxlength="60"></div>'
      + '<div class="form-group"><label>Date</label><input class="form-control" type="date" id="parv-date"></div></div>'
      + '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal(\'modal-par-verse\')">Annuler</button><button class="btn btn-primary" onclick="parVerserConfirmer()">Enregistrer</button></div></div>';
    document.body.appendChild(m);
  }
  document.getElementById('parv-ref').value = ''; document.getElementById('parv-date').value = new Date().toISOString().slice(0, 10); openModal('modal-par-verse');
}
async function parVerserConfirmer() {
  if (!parManager()) { toast('Réservé aux responsables.', 'error'); return; }
  var ref = document.getElementById('parv-ref').value.trim(); if (!ref) { toast('Référence obligatoire.', 'error'); return; }
  var parrain = (DATA.clients || []).find(function (c) { return c.id === PAR.cible.parrainId; }), r = parrain && parLigneJournal(parrain, PAR.cible.key);
  if (!r || r.statut !== 'due') { toast('Récompense introuvable.', 'error'); return; }
  r.statut = 'versee'; r.mode = document.getElementById('parv-mode').value; r.reference = ref; r.versee_le = document.getElementById('parv-date').value || new Date().toISOString().slice(0, 10); r.versee_par = parQui();
  await parSauverClient(parrain); closeModal('modal-par-verse'); toast('Versement tracé.', 'success'); parRendre();
}
async function parAnnuler(parrainId, key) {
  if (!parManager()) { toast('Réservé aux responsables.', 'error'); return; }
  var parrain = (DATA.clients || []).find(function (c) { return c.id === parrainId; }), r = parrain && parLigneJournal(parrain, key);
  if (!r || r.statut !== 'due') return;
  var motif = prompt('Motif de l\'annulation (obligatoire) :'); if (!motif || !motif.trim()) return;
  r.statut = 'annulee'; r.motif = motif.trim().slice(0, 200); r.annulee_par = parQui(); await parSauverClient(parrain); parRendre();
}

/* ── Règles (administrateur) ─────────────────────────────────────────── */
function parHtmlReglages(r) {
  var P = r.cfg, adm = typeof hasRole === 'function' && hasRole('admin'), d = adm ? '' : ' disabled';
  return '<div class="form-grid"><div class="form-group"><label><input type="checkbox" id="parr-actif"' + (P.actif ? ' checked' : '') + d + '> Programme actif</label></div>'
    + '<div class="form-group"><label>Récompense par filleul (FCFA)</label><input class="form-control" type="number" min="0" id="parr-montant" value="' + parH(P.montant) + '"' + d + '></div>'
    + '<div class="form-group"><label>Déclencheur : % du prix versé par le filleul</label><input class="form-control" type="number" min="0" max="100" id="parr-seuil" value="' + parH(P.seuil_pct) + '"' + d + '></div>'
    + '<div class="form-group"><label>Plafond de récompenses par parrain (0 = aucun)</label><input class="form-control" type="number" min="0" id="parr-plafond" value="' + parH(P.plafond) + '"' + d + '></div>'
    + '<div class="form-group"><label><input type="checkbox" id="parr-retard"' + (P.exige_a_jour ? ' checked' : '') + d + '> Parrain à jour de ses versements exigé</label></div></div>'
    + (adm ? '<button class="btn btn-primary" onclick="parReglagesSauver()">Enregistrer</button>' : '<p style="font-size:12px;color:var(--blanc-dim);">Réservé à l\'administrateur.</p>')
    + '<p style="font-size:12px;color:var(--blanc-dim);margin-top:8px;">Le déclencheur porte sur l\'argent réellement encaissé (hors frais de souscription), pas sur la simple signature. Une récompense est toujours validée par un responsable.</p>';
}
async function parReglagesSauver() {
  if (typeof hasRole !== 'function' || !hasRole('admin')) { toast('Réservé à l\'administrateur.', 'error'); return; }
  var m = parseFloat(document.getElementById('parr-montant').value), s = parseFloat(document.getElementById('parr-seuil').value), pl = parseFloat(document.getElementById('parr-plafond').value);
  if (isNaN(m) || m < 0 || isNaN(s) || s < 0 || s > 100 || isNaN(pl) || pl < 0) { toast('Valeurs invalides.', 'error'); return; }
  DATA.params = DATA.params || {};
  DATA.params.parrainage = { actif: document.getElementById('parr-actif').checked, montant: m, seuil_pct: s, plafond: Math.floor(pl), exige_a_jour: document.getElementById('parr-retard').checked, type: 'prime' };
  await dbPut('params', DATA.params); if (typeof syncToSupabase === 'function') syncToSupabase('pi_params', DATA.params); toast('Règles enregistrées.', 'success'); parRendre();
}
