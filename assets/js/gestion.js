/* SAFE : page de gestion (séances à venir, annulation par SAFE, packs payés en espèces).
   Le code est vérifié par le script Google (propriété ADMIN_CODE) ; il n'est gardé qu'en mémoire, jamais enregistré. */
(function () {
  'use strict';
  document.documentElement.classList.remove('sans-js');
  var API = (window.SITE_CONFIG || {}).apiReservation;
  var code = '', donnees = null;
  var form = document.getElementById('g-connexion'), zone = document.getElementById('g-contenu'), err = document.getElementById('g-erreur');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function euros(v) { var n = Math.round(Number(v) * 100) / 100; return (n % 1 ? n.toFixed(2).replace('.', ',') : n) + ' €'; }
  function date(iso, opts) { return new Intl.DateTimeFormat('fr-FR', Object.assign({ timeZone: 'Europe/Paris' }, opts)).format(new Date(iso)); }
  function post(corps) {
    corps.code = code; corps.lang = corps.lang || 'fr';
    return fetch(API, { method: 'POST', body: JSON.stringify(corps) }).then(function (r) { return r.json(); });
  }
  var STATUTS = { paye: 'payé en ligne', a_regler: 'à régler', sans_objet: 'rien à payer', annule: 'annulé', rembourse: 'remboursé' };
  var MODES = { enligne: 'PayPal', lien: 'lien PayPal', especes: 'espèces', pack: 'pack', virement: 'virement ou PayPal avant la séance' };

  if (!API) { err.hidden = false; err.textContent = 'Le site est en mode démonstration : la gestion n\'est pas disponible.'; form.querySelector('button').disabled = true; return; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    code = document.getElementById('g-code').value.trim();
    err.hidden = true;
    charger();
  });

  function charger() {
    zone.hidden = false; zone.innerHTML = '<p class="chargement">Chargement…</p>';
    post({ action: 'admin_liste' }).then(function (r) {
      if (!r.ok) { zone.hidden = true; err.hidden = false; err.textContent = r.message || 'Erreur.'; return; }
      donnees = r; form.hidden = true; dessiner();
    }).catch(function () { zone.hidden = true; err.hidden = false; err.textContent = 'Le serveur ne répond pas. Réessayez.'; });
  }

  function dessiner() {
    zone.innerHTML = '';
    zone.appendChild(el('<p style="display:flex;gap:.8rem;flex-wrap:wrap"><a class="btn btn-clair" href="#g-seances">Séances</a><a class="btn btn-clair" href="#g-nouveau-pack">Pack payé en espèces</a><a class="btn btn-clair" href="#g-packs">Packs</a></p>'));
    zone.appendChild(sectionSeances());
    zone.appendChild(sectionNouveauPack());
    zone.appendChild(sectionPacks());
  }

  // ---------------------------------------------------------------- Séances à venir
  function sectionSeances() {
    var s = el('<section id="g-seances" style="margin-top:2rem"><h2>Séances à venir</h2></section>');
    var aVenir = donnees.seances.filter(function (x) { return !x.passee; });
    if (!aVenir.length) { s.appendChild(el('<p>Aucune séance réservée pour le moment.</p>')); return s; }
    aVenir.forEach(function (x) {
      var annulee = x.statut !== 'confirmee';
      var lignes = x.participants.map(function (p) {
        return '<li>' + esc(p.nom) + ' : ' + esc(MODES[p.mode] || p.mode) + ', ' + esc(STATUTS[p.statut] || p.statut) + (p.montant ? ' (' + euros(p.montant) + ')' : '') + '</li>';
      }).join('');
      var carte = el('<article class="encadre" style="margin-bottom:1rem' + (annulee ? ';opacity:.55' : '') + '">' +
        '<p style="margin:0 0 .3rem;font-weight:650">' + esc(date(x.debut, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) +
        ' · ' + x.duree + ' min · ' + (x.format === 'domicile' ? 'chez le client' + (x.ville ? ' (' + esc(x.ville) + ')' : '') : 'en ligne') +
        (annulee ? ' · <strong>ANNULÉE</strong>' : '') + '</p>' +
        '<ul style="margin:.2rem 0 .5rem">' + lignes + '</ul>' +
        (x.format === 'domicile' ? '<p style="margin:0" class="petit">Tapis à apporter : ' + x.tapis + (x.pack ? ' · Pack ' + esc(x.pack) : '') + '</p>' : '') +
        '<div class="actions"></div></article>');
      if (!annulee) {
        var b = el('<button type="button" class="btn btn-clair" style="margin-top:.8rem">Annuler cette séance</button>');
        b.addEventListener('click', function () { confirmerAnnulation(carte.querySelector('.actions'), x); });
        carte.querySelector('.actions').appendChild(b);
      }
      s.appendChild(carte);
    });
    return s;
  }

  function confirmerAnnulation(zoneActions, x) {
    var payes = x.participants.filter(function (p) { return p.statut === 'paye'; });
    zoneActions.innerHTML = '';
    var f = el('<div style="margin-top:.8rem">' +
      '<div class="champ"><label for="m-' + x.id + '">Message pour les participants (facultatif)</label><textarea id="m-' + x.id + '" rows="3" maxlength="1000" placeholder="Par exemple : empêchement de dernière minute, toutes nos excuses."></textarea></div>' +
      '<p class="petit">Tous les participants qui ont donné leur e-mail seront prévenus.' +
      (payes.length ? ' Remboursement automatique en totalité : ' + payes.map(function (p) { return esc(p.nom) + ' (' + euros(p.montant) + ')'; }).join(', ') + '.' : '') +
      (x.pack ? ' La séance sera recréditée sur le pack.' : '') + ' Cette action ne peut pas être annulée.</p>' +
      '<p style="display:flex;gap:.8rem;flex-wrap:wrap"><button type="button" class="btn oui">Confirmer l\'annulation</button><button type="button" class="btn btn-clair non">Garder la séance</button></p>' +
      '<p class="statut" role="status"></p></div>');
    f.querySelector('.non').addEventListener('click', function () { dessiner(); });
    f.querySelector('.oui').addEventListener('click', function () {
      var btn = this; btn.disabled = true;
      var st = f.querySelector('.statut'); st.className = 'statut'; st.textContent = 'Annulation en cours…';
      post({ action: 'admin_annuler', id: x.id, message: document.getElementById('m-' + x.id).value }).then(function (r) {
        if (!r.ok) { btn.disabled = false; st.className = 'statut ko'; st.textContent = r.message || 'Erreur.'; return; }
        st.className = 'statut ok';
        st.textContent = 'Séance annulée. ' + r.prevenus + ' personne(s) prévenue(s)' + (r.rembourses ? ', ' + r.rembourses + ' remboursement(s) fait(s)' : '') +
          (r.aRembourser ? '. ATTENTION : ' + r.aRembourser + ' remboursement(s) à faire dans PayPal (voir l\'e-mail)' : '') + '.';
        setTimeout(charger, 2500);
      }).catch(function () { btn.disabled = false; st.className = 'statut ko'; st.textContent = 'Le serveur ne répond pas. Réessayez.'; });
    });
    zoneActions.appendChild(f);
  }

  // ---------------------------------------------------------------- Pack payé en espèces
  function sectionNouveauPack() {
    var cat = donnees.catalogue;
    var s = el('<section id="g-nouveau-pack" style="margin-top:2.5rem"><h2>Enregistrer un pack payé en espèces</h2>' +
      '<p>Le client reçoit aussitôt son code par e-mail, comme pour un achat en ligne.</p>' +
      '<form novalidate style="max-width:40rem"><div class="grille-champs">' +
      '<div class="champ"><label for="pk-nom">Nom et prénom du client</label><input id="pk-nom" required></div>' +
      '<div class="champ"><label for="pk-email">E-mail du client</label><input id="pk-email" type="email" required><span class="aide">Le client devra utiliser cette adresse pour réserver avec son pack.</span></div>' +
      '<div class="champ"><label for="pk-format">Format</label><select id="pk-format"><option value="domicile">Chez le client</option><option value="enligne">En ligne</option></select></div>' +
      '<div class="champ"><label for="pk-duree">Durée</label><select id="pk-duree">' + cat.durees.map(function (d) { return '<option value="' + d + '"' + (d === 60 ? ' selected' : '') + '>' + d + ' min</option>'; }).join('') + '</select></div>' +
      '<div class="champ"><label for="pk-taille">Nombre de personnes par séance</label><select id="pk-taille"><option value="1">Seul</option><option value="2">À 2</option><option value="3">De 3 à 6</option></select></div>' +
      '<div class="champ"><label for="pk-lang">Langue des e-mails</label><select id="pk-lang"><option value="fr">Français</option><option value="en">Anglais</option></select></div>' +
      '</div><div class="encadre" id="pk-prix"></div>' +
      '<div class="case"><input type="checkbox" id="pk-recu"><label for="pk-recu" id="pk-recu-texte"></label></div>' +
      '<p><button type="submit" class="btn">Enregistrer le pack</button></p><p class="statut" role="status"></p></form></section>');
    var f = s.querySelector('form');
    function prix() {
      var format = f.querySelector('#pk-format').value, duree = Number(f.querySelector('#pk-duree').value), taille = Number(f.querySelector('#pk-taille').value);
      f.querySelector('#pk-taille').disabled = format === 'enligne';
      var pp = format === 'enligne' ? cat.enligne[duree] : cat.domicile[duree][taille - 1];
      var total = pp * cat.pack.payees;
      f.querySelector('#pk-prix').innerHTML = 'Prix du pack : <strong>' + euros(total) + '</strong> (' + cat.pack.seances + ' séances à ' + euros(pp) + ' par personne, la ' + cat.pack.seances + 'e offerte).';
      f.querySelector('#pk-recu-texte').textContent = 'J\'ai bien reçu ' + euros(total) + ' en espèces.';
      return total;
    }
    f.addEventListener('change', prix); prix();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = f.querySelector('.statut'), btn = f.querySelector('button[type=submit]');
      var format = f.querySelector('#pk-format').value;
      var corps = { action: 'admin_pack_especes', format: format, duree: Number(f.querySelector('#pk-duree').value),
        taille: format === 'enligne' ? 1 : Number(f.querySelector('#pk-taille').value), lang: f.querySelector('#pk-lang').value,
        client: { nom: f.querySelector('#pk-nom').value.trim(), email: f.querySelector('#pk-email').value.trim() }, recu: f.querySelector('#pk-recu').checked };
      btn.disabled = true; st.className = 'statut'; st.textContent = 'Enregistrement…';
      post(corps).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { st.className = 'statut ko'; st.textContent = r.message || 'Erreur.'; return; }
        st.className = 'statut ok';
        st.textContent = 'Pack enregistré : code ' + r.pack.code + ' (' + r.pack.formule + '), envoyé au client par e-mail.';
        f.reset(); prix();
        post({ action: 'admin_liste' }).then(function (x) { if (x.ok) { donnees = x; var anc = document.getElementById('g-packs'); anc.parentNode.replaceChild(sectionPacks(), anc); } });
      }).catch(function () { btn.disabled = false; st.className = 'statut ko'; st.textContent = 'Le serveur ne répond pas. Réessayez.'; });
    });
    return s;
  }

  // ---------------------------------------------------------------- Packs
  function sectionPacks() {
    var s = el('<section id="g-packs" style="margin-top:2.5rem"><h2>Packs</h2></section>');
    if (!donnees.packs.length) { s.appendChild(el('<p>Aucun pack vendu pour le moment.</p>')); return s; }
    var t = el('<div style="overflow-x:auto"><table class="tarifs"><thead><tr><th>Client</th><th>Formule</th><th>Restant</th><th>Valable jusqu\'au</th><th>Paiement</th><th>Code</th></tr></thead><tbody></tbody></table></div>');
    donnees.packs.forEach(function (p) {
      var expire = Date.parse(p.expire) < Date.now();
      t.querySelector('tbody').appendChild(el('<tr' + (expire || !p.restant ? ' style="opacity:.55"' : '') + '><td>' + esc(p.nom) + '<br><span class="petit">' + esc(p.email) + '</span></td><td>' + esc(p.formule) + '</td><td>' + p.restant + ' / ' + p.total + '</td><td>' +
        esc(date(p.expire, { day: 'numeric', month: 'short', year: 'numeric' })) + (expire ? ' (expiré)' : '') + '</td><td>' + (p.paiement === 'especes' ? 'espèces' : 'PayPal') + ' · ' + euros(p.montant) + '</td><td>' + esc(p.code) + '</td></tr>'));
    });
    s.appendChild(t);
    return s;
  }
})();
