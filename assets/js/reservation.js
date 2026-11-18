/* SAFE : module de réservation SAFE Yoga.
   Ordre (CLAUDE.md § 7) : lieu > participants > adresse et déplacement > durée > tapis > créneau > santé et charte > coordonnées et paiement.
   Parle au script Google (apps-script/Code.gs). Sans URL configurée : mode démonstration. */
(function () {
  'use strict';
  var racine = document.getElementById('resa');
  if (!racine) return;

  var LANG = document.documentElement.lang === 'en' ? 'en' : 'fr';
  var LOCALE = LANG === 'en' ? 'en-GB' : 'fr-FR';
  var TZ_SEANCE = 'Europe/Paris';
  var TZ_CLIENT = (Intl.DateTimeFormat().resolvedOptions().timeZone) || TZ_SEANCE;
  var cfg = window.SITE_CONFIG || {};
  var API = cfg.apiReservation || '';
  var DEMO = !API;
  var JOURS_FENETRE = 14;
  var RACINE_SITE = LANG === 'en' ? '../../' : '../';
  var NB = ' ';

  // ------------------------------------------------------------------ Textes
  var TXT = {
    fr: {
      demo: 'Mode démonstration : les créneaux et le calcul du déplacement sont fictifs, aucune réservation n\'est enregistrée.',
      chargement: 'Chargement…',
      erreurChargement: 'Impossible de charger les disponibilités. Réessayez dans un instant ou écrivez-nous.',
      etapes: ['Où ?', 'Combien de personnes ?', 'Adresse de la séance', 'Quelle durée ?', 'Tapis', 'Quand ?', 'Santé et charte', 'Coordonnées et paiement'],
      domicile: 'Chez vous', domicileAide: 'Marseille, Aix-en-Provence, Aubagne et alentours. Seul ou jusqu\'à 6 personnes.',
      enligne: 'En ligne', enligneAide: 'En visio, où que vous soyez. Une personne par séance.',
      personnes: function (n) { return n + (n > 1 ? ' personnes' : ' personne'); },
      moins: 'Une personne de moins', plus: 'Une personne de plus',
      participant: function (i) { return i === 0 ? 'Vous (la personne qui réserve)' : 'Participant ' + (i + 1); },
      prenom: 'Prénom', nomP: 'Nom', sexe: 'Sexe', femme: 'Femme', homme: 'Homme',
      premiere: 'Première séance chez SAFE (5 € de réduction)',
      adresse: 'Adresse', cp: 'Code postal', ville: 'Ville', calculer: 'Calculer le déplacement',
      calcul: 'Calcul du trajet…', adresseAide: 'L\'adresse exacte, pour calculer le trajet depuis Marseille 9e.',
      dansMarseille: 'Dans Marseille : déplacement gratuit.',
      horsMarseille: function (km, m) { return 'Trajet : ' + km + ' km aller-retour, soit ' + m + ' € de déplacement pour la séance (0,30 € par km).'; },
      tropLoin: 'Cette adresse est au-delà de notre zone (Aix-en-Provence, Aubagne et alentours). Écrivez-nous pour un devis :',
      introuvable: 'Adresse introuvable. Vérifiez-la (numéro, rue, code postal) et réessayez.',
      min: 'min', parPers: '/ pers.',
      tapis: 'Combien de tapis avez-vous ?', tapisAide: 'Nous apportons gratuitement ceux qui manquent.',
      tapisApportes: function (n) { return n ? 'Nous apporterons ' + n + ' tapis.' : 'Chacun a son tapis : nous n\'en apportons pas.'; },
      precedent: 'Semaines précédentes', suivant: 'Semaines suivantes',
      periode: function (a, b) { return 'Du ' + a + ' au ' + b; },
      aucunJour: 'Aucun créneau libre sur ces deux semaines. Regardez les semaines suivantes.',
      aucun: 'aucun créneau', creneaux: function (n) { return n + (n > 1 ? ' créneaux' : ' créneau'); },
      heuresDu: function (j) { return 'Horaires du ' + j; },
      fuseau: function (tz) { return 'Horaires affichés à votre heure (' + tz + ').'; },
      sante: 'Informations utiles pour la séance (facultatif)', santeAide: 'Blessure, douleur, grossesse, opération récente, traitement…',
      consentSante: 'J\'accepte que SAFE utilise ces informations uniquement pour adapter la séance. Elles ne sont transmises à personne et sont supprimées 12 mois après la dernière séance.',
      consentRequis: 'Cochez cette case pour envoyer ces informations, ou videz le champ.',
      charte: function (p) { return (p ? p + ' a lu' : 'J\'ai lu') + ' et accepte la <a href="' + RACINE_SITE + (LANG === 'en' ? 'en/charter/' : 'charte/') + '" target="_blank" rel="noopener">charte de séance</a> et confirme l\'attestation de santé.'; },
      charteMoi: 'Pour vous', charteRequis: 'Chaque participant doit accepter la charte.',
      attestation: 'Attestation de santé : je sais que le yoga sollicite le corps et peut entraîner courbatures, douleurs ou, plus rarement, une blessure si je dépasse mes limites. Je suis en état de pratiquer une activité physique douce, ou j\'ai demandé l\'avis de mon médecin en cas de doute (grossesse, opération récente, problème cardiaque ou de tension, dos, articulations, vertiges, épilepsie). Je signale tout changement et pratique à mon rythme. Les séances ne remplacent pas un suivi médical ou psychologique.',
      nom: 'Nom', email: 'E-mail', emailAide: 'La confirmation arrive à cette adresse.',
      tel: 'Téléphone', telAide: 'Utile en cas d\'imprévu le jour même.',
      cgv: 'J\'accepte les <a href="' + RACINE_SITE + 'conditions-de-vente/" target="_blank" rel="noopener">conditions de vente</a>, dont les règles d\'annulation.',
      cgvRequis: 'Merci d\'accepter les conditions de vente.',
      votrePaiement: 'Votre part', paiementDe: function (p) { return 'Part de ' + p; },
      payerEnLigne: 'En ligne maintenant', payerEnLigneAide: 'PayPal ou carte bancaire, sans compte PayPal.',
      lienEmail: 'Lien de paiement par e-mail', lienEmailAide: 'PayPal ou carte, à régler au plus tard 24 h avant.',
      especes: 'En espèces le jour de la séance', especesAide: 'Le montant exact est apprécié.',
      emailParticipant: function (p) { return 'E-mail de ' + p; },
      confirmer: 'Confirmer la réservation', envoi: 'Réservation en cours…',
      simuler: 'Simuler le paiement en ligne', paypalChargement: 'Chargement du paiement sécurisé…',
      paypalIndispo: 'Le paiement en ligne est momentanément indisponible. Choisissez un autre mode ou réessayez plus tard.',
      recap: 'Votre séance', recapVide: 'Choisissez où se passe la séance pour commencer.',
      rLieu: 'Lieu', rPers: 'Personnes', rDuree: 'Durée', rDate: 'Date', rHeure: 'Heure', rTapis: 'Tapis apportés par SAFE',
      lSeance: function (n, p) { return n + ' × ' + p + ' €'; }, lPremiere: function (n) { return 'Première séance (' + n + ' × −5 €)'; },
      lDeplacement: 'Déplacement', gratuit: 'gratuit', total: 'Total', votrePart: 'Votre part',
      recapNote: 'Annulation gratuite jusqu\'à 24 h avant la séance.',
      champRequis: 'Champ obligatoire.', emailInvalide: 'Adresse e-mail invalide.', telInvalide: 'Numéro incomplet.',
      ok: 'Votre séance est réservée',
      okEmail: function (e) { return 'Un e-mail de confirmation vient de partir à ' + e + '. Pensez à vérifier vos indésirables.'; },
      okLiens: 'Les autres participants qui paient en ligne reçoivent leur lien de paiement par e-mail.',
      okVisio: 'Le lien de la visio se trouve dans l\'e-mail.',
      ajouterAgenda: 'Ajouter à mon agenda', accueil: 'Retour à l\'accueil',
      gerer: 'Votre réservation', annulerBtn: 'Annuler cette séance', confirmerAnnulation: 'Confirmer l\'annulation', garder: 'Garder ma séance',
      annulee: 'Cette séance est annulée.', annulationOk: 'C\'est fait : la séance est annulée et un e-mail de confirmation vous a été envoyé.',
      remboursement: 'Annulation gratuite (plus de 24\u00a0h avant)\u00a0: rien n\'est dû, et un paiement en ligne éventuel sera remboursé.', pasRemboursement: 'L\'annulation intervient moins de 24 h avant la séance : elle reste due (conditions de vente).',
      passee: 'Cette séance est déjà passée.',
      avecPack: 'Avec mon pack', avecPackAide: 'Le déplacement éventuel se règle en espèces.',
      codePack: 'Code du pack', codePackAide: 'Reçu par e-mail à l\'achat. Utilisez la même adresse e-mail.', codeInvalide: 'Code au format SAFE-XXXXXX.',
      lPack: 'Pack (votre séance)',
      desinscrireBtn: 'Me désinscrire', confirmerDesinscription: 'Confirmer ma désinscription', garderPlace: 'Garder ma place',
      desinscriptionInfo: 'Vous ne payez rien et le prix des autres participants ne change pas.',
      desinscriptionOk: 'C\'est fait\u00a0: vous êtes désinscrit et un e-mail de confirmation vous a été envoyé.',
      partTitre: 'Votre part',
      partTexte: function (p, m, q) { return p + ', votre part pour la séance SAFE Yoga du ' + q + '\u00a0: <strong>' + m + '</strong>.'; },
      partPayee: 'Votre part est déjà réglée. Merci\u00a0!', partNonPayable: 'Cette part se règle en espèces le jour de la séance.',
      partOk: 'Paiement reçu, merci\u00a0! Un e-mail de confirmation vous a été envoyé.', partAnnulee: 'Cette séance ou cette participation est annulée.',
      repriseInfo: 'Vos informations sont pré-remplies. Vérifiez-les, puis choisissez votre créneau.',
      lienPack: 'Pack de 11 séances au prix de 10\u00a0: réglé en espèces, demandez-le lors d\'une séance.',
      packTitre: 'Acheter un pack', packIntro: '11 séances au prix de 10, valables 1 an, pour une durée et un format. Paiement en une fois en ligne. Vous recevez votre code par e-mail.',
      packFormat: 'Format', packDuree: 'Durée', packTaille: 'Nombre de personnes', seul: 'Seul', aDeux: 'À 2', troisSix: 'De 3 à 6',
      packPrix: function (m, pp) { return 'Prix du pack\u00a0: <strong>' + m + '</strong> (11 séances à ' + pp + ' par personne, la 11e incluse).'; },
      packNom: 'Nom et prénom', acheterPack: 'Payer le pack', simulerPack: 'Simuler le paiement du pack',
      packOk: function (c) { return 'Merci\u00a0! Votre code de pack est <strong>' + c + '</strong>. Il vous a aussi été envoyé par e-mail.'; },
      packIndispo: 'Le pack se règle en espèces, en une fois, lors d\'une séance. Vous recevez ensuite votre code par e-mail. Une question\u00a0? Écrivez-nous\u00a0:',
      packTaillePers: 'Le pack vaut pour la personne qui réserve, sur des séances de ce nombre de personnes.'
    },
    en: {
      demo: 'Demo mode: time slots and travel cost are fictitious, no booking is saved.',
      chargement: 'Loading…',
      erreurChargement: 'Availability could not be loaded. Please try again in a moment or write to us.',
      etapes: ['Where?', 'How many people?', 'Address of the session', 'How long?', 'Mats', 'When?', 'Health and charter', 'Details and payment'],
      domicile: 'At your home', domicileAide: 'Marseille, Aix-en-Provence, Aubagne and around. Alone or up to 6 people.',
      enligne: 'Online', enligneAide: 'On video, wherever you are. One person per session.',
      personnes: function (n) { return n + (n > 1 ? ' people' : ' person'); },
      moins: 'One person less', plus: 'One person more',
      participant: function (i) { return i === 0 ? 'You (the person booking)' : 'Participant ' + (i + 1); },
      prenom: 'First name', nomP: 'Last name', sexe: 'Sex', femme: 'Female', homme: 'Male',
      premiere: 'First session with SAFE (€5 off)',
      adresse: 'Address', cp: 'Postcode', ville: 'City', calculer: 'Calculate travel cost',
      calcul: 'Calculating the route…', adresseAide: 'The exact address, to calculate the route from Marseille 9th district.',
      dansMarseille: 'Within Marseille: free travel.',
      horsMarseille: function (km, m) { return 'Route: ' + km + ' km round trip, i.e. €' + m + ' travel cost for the session (€0.30 per km).'; },
      tropLoin: 'This address is beyond our area (Aix-en-Provence, Aubagne and around). Write to us for a quote:',
      introuvable: 'Address not found. Please check it (number, street, postcode) and try again.',
      min: 'min', parPers: '/ person',
      tapis: 'How many mats do you have?', tapisAide: 'We bring the missing ones free of charge.',
      tapisApportes: function (n) { return n ? 'We will bring ' + n + (n > 1 ? ' mats.' : ' mat.') : 'Everyone has a mat: we will not bring any.'; },
      precedent: 'Previous weeks', suivant: 'Next weeks',
      periode: function (a, b) { return a + ' to ' + b; },
      aucunJour: 'No free slot in these two weeks. Have a look at the next weeks.',
      aucun: 'no slot', creneaux: function (n) { return n + (n > 1 ? ' slots' : ' slot'); },
      heuresDu: function (j) { return 'Times on ' + j; },
      fuseau: function (tz) { return 'Times shown in your time zone (' + tz + ').'; },
      sante: 'Useful information for the session (optional)', santeAide: 'Injury, pain, pregnancy, recent surgery, treatment…',
      consentSante: 'I agree that SAFE uses this information only to adapt the session. It is shared with no one and deleted 12 months after the last session.',
      consentRequis: 'Tick this box to send this information, or clear the field.',
      charte: function (p) { return (p ? p + ' has read' : 'I have read') + ' and accept the <a href="' + RACINE_SITE + 'en/charter/" target="_blank" rel="noopener">session charter</a> and confirm the health statement.'; },
      charteMoi: 'For you', charteRequis: 'Every participant must accept the charter.',
      attestation: 'Health statement: I know that yoga works the body and may cause stiffness, pain or, more rarely, an injury if I go beyond my limits. I am fit for gentle physical activity, or I have asked my doctor if in doubt (pregnancy, recent surgery, heart or blood pressure problem, back, joints, dizziness, epilepsy). I report any change and practise at my own pace. Sessions do not replace medical or psychological care.',
      nom: 'Last name', email: 'Email', emailAide: 'Your confirmation will be sent here.',
      tel: 'Phone', telAide: 'Useful if something comes up on the day.',
      cgv: 'I accept the <a href="' + RACINE_SITE + 'conditions-de-vente/" target="_blank" rel="noopener">terms of sale</a> (in French), including the cancellation rules.',
      cgvRequis: 'Please accept the terms of sale.',
      votrePaiement: 'Your share', paiementDe: function (p) { return p + '’s share'; },
      payerEnLigne: 'Online now', payerEnLigneAide: 'PayPal or bank card, no PayPal account needed.',
      lienEmail: 'Payment link by email', lienEmailAide: 'PayPal or card, to be paid at least 24 hours before.',
      especes: 'Cash on the day', especesAide: 'The exact amount is appreciated.',
      emailParticipant: function (p) { return p + '’s email'; },
      confirmer: 'Confirm booking', envoi: 'Booking…',
      simuler: 'Simulate online payment', paypalChargement: 'Loading secure payment…',
      paypalIndispo: 'Online payment is temporarily unavailable. Choose another option or try again later.',
      recap: 'Your session', recapVide: 'Choose where the session takes place to start.',
      rLieu: 'Place', rPers: 'People', rDuree: 'Duration', rDate: 'Date', rHeure: 'Time', rTapis: 'Mats brought by SAFE',
      lSeance: function (n, p) { return n + ' × €' + p; }, lPremiere: function (n) { return 'First session (' + n + ' × −€5)'; },
      lDeplacement: 'Travel', gratuit: 'free', total: 'Total', votrePart: 'Your share',
      recapNote: 'Free cancellation up to 24 hours before the session.',
      champRequis: 'Required field.', emailInvalide: 'Invalid email address.', telInvalide: 'Incomplete number.',
      ok: 'Your session is booked',
      okEmail: function (e) { return 'A confirmation email has just been sent to ' + e + '. Please check your spam folder too.'; },
      okLiens: 'The other participants who pay online receive their payment link by email.',
      okVisio: 'The video call link is in the email.',
      ajouterAgenda: 'Add to my calendar', accueil: 'Back to home page',
      gerer: 'Your booking', annulerBtn: 'Cancel this session', confirmerAnnulation: 'Confirm cancellation', garder: 'Keep my session',
      annulee: 'This session is cancelled.', annulationOk: 'Done: the session is cancelled and a confirmation email has been sent to you.',
      remboursement: 'Free cancellation (more than 24 hours before): nothing is due, and any online payment will be refunded.', pasRemboursement: 'The cancellation is less than 24 hours before the session: it remains due (terms of sale).',
      passee: 'This session has already taken place.',
      avecPack: 'With my pack', avecPackAide: 'Any travel cost is paid in cash.',
      codePack: 'Pack code', codePackAide: 'Sent by email when you bought it. Use the same email address.', codeInvalide: 'Code format: SAFE-XXXXXX.',
      lPack: 'Pack (your session)',
      desinscrireBtn: 'Cancel my place', confirmerDesinscription: 'Confirm', garderPlace: 'Keep my place',
      desinscriptionInfo: 'You pay nothing and the price for the other participants does not change.',
      desinscriptionOk: 'Done: your place is cancelled and a confirmation email has been sent to you.',
      partTitre: 'Your share',
      partTexte: function (p, m, q) { return p + ', your share for the SAFE Yoga session on ' + q + ': <strong>' + m + '</strong>.'; },
      partPayee: 'Your share is already paid. Thank you!', partNonPayable: 'This share is paid in cash on the day.',
      partOk: 'Payment received, thank you! A confirmation email has been sent to you.', partAnnulee: 'This session or this place has been cancelled.',
      repriseInfo: 'Your details are pre-filled. Check them, then choose your time slot.',
      lienPack: 'Pack of 11 sessions for the price of 10: paid in cash, ask for it during a session.',
      packTitre: 'Buy a pack', packIntro: '11 sessions for the price of 10, valid for 1 year, for one length and format. Paid once online. You receive your code by email.',
      packFormat: 'Format', packDuree: 'Length', packTaille: 'Number of people', seul: 'Alone', aDeux: '2 people', troisSix: '3 to 6',
      packPrix: function (m, pp) { return 'Pack price: <strong>' + m + '</strong> (11 sessions at ' + pp + ' per person, the 11th included).'; },
      packNom: 'Full name', acheterPack: 'Pay for the pack', simulerPack: 'Simulate pack payment',
      packOk: function (c) { return 'Thank you! Your pack code is <strong>' + c + '</strong>. It has also been sent to you by email.'; },
      packIndispo: 'The pack is paid in cash, in one go, during a session. You then receive your code by email. Any question? Write to us:',
      packTaillePers: 'The pack is for the person booking, on sessions with this number of people.'
    }
  }[LANG];

  var ERREURS_EN = {
    pris: 'This slot has just been booked. Please choose another one.', zone: 'This address is outside our area.',
    cgv: 'Please accept the terms of sale.', charte: 'Every participant must accept the charter.', email: 'Invalid email address.',
    tel: 'Invalid phone number.', adresse: 'Address not found.', client: 'First and last name are required.',
    limite: 'Too many bookings today with this email. Please contact us directly.',
    refus_carte: 'The payment method was declined. Please try another one.', lien: 'This link is invalid.',
    passee: 'This session has already taken place.', paypal: 'Payment not found or expired. Please start again.',
    serveur: 'Something went wrong. Please try again or contact us directly.',
    pack: 'Unknown, expired or non-matching pack code for this email address.', premiere: 'One of the participants has already booked with SAFE: the first-session discount does not apply. Untick "First session" for this person.',
    montant: 'The price has changed. Please reload the page and start again.', part: 'This share can no longer be paid online: please pay in cash on the day.',
    participants: 'First name, last name and sex are required for every participant.', paiement: 'Invalid payment option.', tapis: 'Invalid number of mats.'
  };
  function messageErreur(r) {
    if (LANG === 'en') return ERREURS_EN[r.code] || ERREURS_EN.serveur;
    return r.message || 'Une erreur est survenue. Réessayez ou contactez-nous directement.';
  }

  // ------------------------------------------------------------------ Dates
  function aujourdhui() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_SEANCE }).format(new Date()); }
  function plusJours(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function fmtJour(iso, opts) { return new Intl.DateTimeFormat(LOCALE, Object.assign({ timeZone: 'UTC' }, opts)).format(new Date(iso + 'T12:00:00Z')); }
  function fmtInstant(instant, opts, tz) { return new Intl.DateTimeFormat(LOCALE, Object.assign({ timeZone: tz || TZ_CLIENT }, opts)).format(new Date(instant)); }
  function jourClient(instant) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_CLIENT }).format(new Date(instant)); }
  function decalage(date) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ_SEANCE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - date.getTime() + date.getSeconds() * 1000 + date.getMilliseconds()) / 60000;
  }
  function instantParis(jour, hhmm) { var a = new Date(jour + 'T' + hhmm + ':00Z'); return new Date(a.getTime() - decalage(a) * 60000); }

  // ------------------------------------------------------------------ Serveur
  function get(params) {
    if (DEMO) return demo(params.action, params);
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(API + '?' + q).then(function (r) { return r.json(); });
  }
  function post(corps) {
    corps.lang = LANG;
    if (DEMO) return demo(corps.action, corps);
    return fetch(API, { method: 'POST', body: JSON.stringify(corps) }).then(function (r) { return r.json(); });
  }

  // ------------------------------------------------------------------ Démonstration
  // Doit rester identique à CATALOGUE et TARIFS de apps-script/Code.gs (contrôlé par outils/tests/coherence.mjs).
  var CATALOGUE_DEMO = {
    durees: [45, 60, 90],
    domicile: { 45: [25, 20, 15], 60: [30, 25, 20], 90: [40, 35, 25] },
    enligne: { 45: 20, 60: 25, 90: 35 },
    maxPersonnes: 6, maxTapis: 6, reductionPremiere: 5, tarifKm: 0.3,
    pack: { seances: 11, payees: 10, validiteJours: 365 }
  };
  function demo(action, p) {
    var rep;
    if (action === 'config') {
      rep = { ok: true, catalogue: CATALOGUE_DEMO, annulationHeures: 24, horizonJours: 60, preavisHeures: 24, paypal: { clientId: 'demo', devise: 'EUR' } };
    } else if (action === 'deplacement') {
      var a = (p.adresse || '').toLowerCase();
      if (/\b130(0[1-9]|1[0-6])\b/.test(a) || /marseille/.test(a)) rep = { ok: true, zone: 'marseille', km: 0, montant: 0 };
      else if (/paris|lyon|nice|toulon|avignon/.test(a)) rep = { ok: true, zone: 'trop_loin' };
      else if (/aix/.test(a)) rep = { ok: true, zone: 'hors', km: 66, montant: 20 };
      else if (/aubagne/.test(a)) rep = { ok: true, zone: 'hors', km: 36, montant: 11 };
      else rep = { ok: true, zone: 'hors', km: 24, montant: 7 };
    } else if (action === 'creneaux') {
      var jours = [], j = p.debut, limite = Date.now() + 24 * 3600e3, duree = Number(p.duree);
      while (j <= p.fin) {
        var js = new Date(j + 'T12:00:00Z').getUTCDay(), fen = [];
        if (js >= 1 && js <= 5) { fen.push(['09:00', '12:30', null]); fen.push(['17:30', '20:30', 'enligne']); }
        if (js === 6) fen.push(['09:00', '13:00', 'domicile']);
        var cr = [];
        fen.forEach(function (f) {
          if (f[2] && f[2] !== p.format) return;
          var t = instantParis(j, f[0]).getTime(), fin = instantParis(j, f[1]).getTime();
          for (; t + duree * 60e3 <= fin; t += 30 * 60e3) if (t >= limite && (j.charCodeAt(9) + t / 1800e3) % 5 !== 0) cr.push({ debut: new Date(t).toISOString() });
        });
        if (cr.length) jours.push({ date: j, creneaux: cr });
        j = plusJours(j, 1);
      }
      rep = { ok: true, jours: jours };
    } else if (action === 'reserver' || action === 'paypal_valider') {
      var c = calcul();
      rep = { ok: true, reservation: { id: 'demo', cle: 'demo', duree: etat.duree, total: c.total, part: c.parts[0],
        debut: etat.creneau.debut, fin: new Date(Date.parse(etat.creneau.debut) + etat.duree * 60e3).toISOString(),
        format: etat.format, visio: etat.format === 'enligne' ? 'https://meet.google.com/' : '' } };
    } else if (action === 'reservation') {
      rep = { ok: true, reservation: { id: 'demo', statut: 'confirmee', duree: 60, format: 'domicile', personnes: 2,
        debut: new Date(Date.now() + 3 * 86400e3).toISOString(), dansLesDelais: true, annulable: true, participant: !!p.p, prenom: p.p ? 'Tom' : '' } };
    } else if (action === 'part') {
      rep = { ok: true, part: { prenom: 'Tom', montant: 25, statut: 'a_regler', mode: 'lien', payable: true, duree: 60, format: 'domicile',
        debut: new Date(Date.now() + 3 * 86400e3).toISOString(), statutSeance: 'confirmee' } };
    } else if (action === 'reprise') {
      rep = { ok: true, reprise: { format: 'domicile', duree: 60, tapis: 1, participants: [{ prenom: 'Léa', nom: 'Martin', sexe: 'femme', email: '' }, { prenom: 'Tom', nom: 'Martin', sexe: 'homme', email: 'tom@exemple.fr' }],
        adresse: { rue: '12 rue Paradis', cp: '13006', ville: 'Marseille' }, client: { nom: 'Martin', email: 'lea@exemple.fr', tel: '06 12 34 56 78' }, sante: '' } };
    } else if (action === 'paypal_valider_pack') {
      rep = { ok: true, pack: { code: 'SAFE-DEMO01', restant: 11, total: 11, expire: new Date(Date.now() + 365 * 86400e3).toISOString() } };
    } else {
      rep = { ok: true };
    }
    return new Promise(function (res) { setTimeout(function () { res(rep); }, 350); });
  }

  // ------------------------------------------------------------------ Outils
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function annoncer(m) { var a = document.getElementById('annonce'); if (a) { a.textContent = ''; setTimeout(function () { a.textContent = m; }, 50); } }
  function euros(v) {
    var s = (Math.round(v * 100) / 100).toFixed(Math.round(v) === v ? 0 : 2);
    return LANG === 'en' ? '€' + s : s.replace('.', ',') + NB + '€';
  }

  // ------------------------------------------------------------------ État
  var ORDRE = ['format', 'personnes', 'adresse', 'duree', 'tapis', 'creneau', 'sante', 'paiement'];
  var etat = {
    config: null, format: null, nb: 1,
    participants: [{ prenom: '', nom: '', sexe: '', premiere: false, charte: false, mode: 'enligne', email: '' }],
    adresse: { rue: '', cp: '', ville: '' }, deplacement: null, duree: null, tapis: 1, tapisPerso: 0,
    fenetre: aujourdhui(), jours: null, jour: null, creneau: null,
    sante: '', consentSante: false, client: { nom: '', email: '', tel: '' }, cgv: false, envoi: false, packCode: ''
  };
  var params = new URLSearchParams(window.location.search);

  function prixParPersonne(format, duree, nb) {
    var cat = etat.config.catalogue;
    if (format === 'enligne') return cat.enligne[duree];
    var t = cat.domicile[duree];
    return t[Math.min(nb, 3) - 1];
  }
  // Même calcul que calculerMontants() dans Code.gs.
  function calcul() {
    var cat = etat.config.catalogue, n = etat.nb;
    var pp = etat.duree ? prixParPersonne(etat.format, etat.duree, n) : 0;
    var dep = etat.format === 'domicile' && etat.deplacement ? (etat.deplacement.montant || 0) : 0;
    var partDep = Math.round(dep / n * 100) / 100;
    var pack0 = etat.participants[0].mode === 'pack';
    var parts = etat.participants.slice(0, n).map(function (p, i) {
      if (i === 0 && pack0) return partDep;
      return Math.max(0, pp - (p.premiere ? cat.reductionPremiere : 0)) + partDep;
    });
    // L'arrondi du partage du déplacement est absorbé par la personne qui réserve.
    parts[0] = Math.round((parts[0] + (dep - partDep * n)) * 100) / 100;
    var nbPremiere = etat.participants.slice(0, n).filter(function (p, i) { return p.premiere && !(i === 0 && pack0); }).length;
    var total = parts.reduce(function (a, b) { return a + b; }, 0);
    return { pp: pp, dep: dep, partDep: partDep, parts: parts, nbPremiere: nbPremiere, pack0: pack0, total: Math.round(total * 100) / 100 };
  }

  // ------------------------------------------------------------------ Squelette
  function squelette() {
    racine.innerHTML = '';
    var cadre = el('<div class="resa"><div class="resa-etapes"></div><aside class="recap" aria-labelledby="titre-recap"></aside></div>');
    var col = cadre.querySelector('.resa-etapes');
    if (DEMO) col.appendChild(el('<p class="bandeau-demo">' + TXT.demo + '</p>'));
    ORDRE.forEach(function (id, i) {
      col.appendChild(el('<section class="etape" id="e-' + id + '"' + (i ? ' hidden' : '') + ' aria-labelledby="t-' + id + '">' +
        '<h2 id="t-' + id + '" tabindex="-1"><span class="num" aria-hidden="true"></span>' + TXT.etapes[i] + '</h2><div class="corps"></div></section>'));
    });
    col.appendChild(el('<div id="annonce" class="visuellement-cache" aria-live="polite"></div>'));
    racine.appendChild(cadre);
  }
  function corps(id) { return document.querySelector('#e-' + id + ' .corps'); }
  function numeroter() {
    var n = 0;
    ORDRE.forEach(function (id) {
      var s = document.getElementById('e-' + id);
      var saute = (id === 'adresse' || id === 'tapis') && etat.format === 'enligne';
      if (!saute) n++;
      s.querySelector('.num').textContent = saute ? '' : n;
    });
  }
  function montrer(id, focus) {
    var s = document.getElementById('e-' + id);
    var deja = !s.hidden;
    s.hidden = false;
    numeroter();
    if (focus && !deja) {
      s.querySelector('h2').focus({ preventScroll: true });
      s.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function cacherApres(id) {
    ORDRE.slice(ORDRE.indexOf(id) + 1).forEach(function (x) { document.getElementById('e-' + x).hidden = true; });
  }
  function suivante(id) {
    var i = ORDRE.indexOf(id) + 1;
    while (i < ORDRE.length && (ORDRE[i] === 'adresse' || ORDRE[i] === 'tapis') && etat.format === 'enligne') i++;
    return ORDRE[i];
  }
  function ouvrir(id, focus) {
    ({ personnes: etapePersonnes, adresse: etapeAdresse, duree: etapeDuree, tapis: etapeTapis,
       creneau: etapeCreneau, sante: etapeSante, paiement: etapePaiement })[id](focus);
  }

  function groupeRadio(nom, options, valeur, surChoix, etiquette) {
    var g = el('<div class="choix" role="radiogroup" aria-labelledby="' + (etiquette || ('t-' + nom)) + '"></div>');
    options.forEach(function (o) {
      var id = nom + '-' + o.valeur;
      var opt = el('<div class="option"><input type="radio" name="' + nom + '" id="' + id + '" value="' + esc(o.valeur) + '"' +
        (String(o.valeur) === String(valeur) ? ' checked' : '') + (o.desactive ? ' disabled' : '') + '>' +
        '<label for="' + id + '"><b>' + esc(o.titre) + '</b>' + (o.detail ? '<span>' + o.detail + '</span>' : '') + '</label></div>');
      opt.querySelector('input').addEventListener('change', function () { surChoix(o.valeur); });
      g.appendChild(opt);
    });
    return g;
  }

  // ------------------------------------------------------------------ 1. Lieu
  function etapeFormat() {
    var c = corps('format'); c.innerHTML = '';
    c.appendChild(groupeRadio('format', [
      { valeur: 'domicile', titre: TXT.domicile, detail: esc(TXT.domicileAide) },
      { valeur: 'enligne', titre: TXT.enligne, detail: esc(TXT.enligneAide) }
    ], etat.format, function (v) {
      etat.format = v; etat.creneau = null; etat.duree = null;
      if (v === 'enligne') { etat.nb = 1; etat.tapis = 0; } else majTapis();
      cacherApres('format'); etapePersonnes(true); recap();
    }));
    numeroter();
  }

  // ------------------------------------------------------------------ 2. Participants
  function etapePersonnes(focus) {
    var c = corps('personnes'); c.innerHTML = '';
    var max = etat.format === 'enligne' ? 1 : etat.config.catalogue.maxPersonnes;
    if (max > 1) {
      var cpt = el('<div class="compteur"><button type="button" class="m" aria-label="' + TXT.moins + '">−</button><output aria-live="polite">' + etat.nb +
        '</output><span>' + TXT.personnes(etat.nb).replace(/^\d+\s/, '') + '</span><button type="button" class="p" aria-label="' + TXT.plus + '">+</button></div>');
      cpt.querySelector('.m').disabled = etat.nb <= 1;
      cpt.querySelector('.p').disabled = etat.nb >= max;
      cpt.querySelector('.m').addEventListener('click', function () { changerNb(-1); });
      cpt.querySelector('.p').addEventListener('click', function () { changerNb(1); });
      c.appendChild(cpt);
    }
    var liste = el('<div class="participants"></div>');
    for (var i = 0; i < etat.nb; i++) liste.appendChild(blocParticipant(i));
    c.appendChild(liste);
    var ok = el('<p style="margin:1.2rem 0 0"><button type="button" class="btn">' + (LANG === 'en' ? 'Continue' : 'Continuer') + '</button></p>');
    ok.querySelector('button').addEventListener('click', function () {
      if (!validerParticipants()) return;
      var s = suivante('personnes'); ouvrir(s, true);
    });
    c.appendChild(ok);
    montrer('personnes', focus);
  }
  function changerNb(d) {
    etat.nb = Math.max(1, Math.min(etat.config.catalogue.maxPersonnes, etat.nb + d));
    while (etat.participants.length < etat.nb) etat.participants.push({ prenom: '', nom: '', sexe: '', premiere: false, charte: false, mode: 'especes', email: '' });
    majTapis();
    etapePersonnes(false);
    annoncer(TXT.personnes(etat.nb));
    recap();
    if (!document.getElementById('e-duree').hidden) majDurees();
    if (!document.getElementById('e-tapis').hidden) etapeTapisSeul();
    if (!document.getElementById('e-paiement').hidden) etapePaiement(false);
    if (!document.getElementById('e-sante').hidden) etapeSante(false);
  }
  function blocParticipant(i) {
    var p = etat.participants[i];
    var b = el('<fieldset class="participant" style="border:0;margin:0;padding:.8rem 0 0"><legend class="titre-p">' + esc(TXT.participant(i)) + '</legend>' +
      '<div class="champ"><label for="p' + i + '-prenom">' + TXT.prenom + '</label><input id="p' + i + '-prenom" autocomplete="' + (i ? 'off' : 'given-name') + '" required aria-required="true" value="' + esc(p.prenom) + '"></div>' +
      '<div class="champ"><label for="p' + i + '-nom">' + TXT.nomP + '</label><input id="p' + i + '-nom" autocomplete="' + (i ? 'off' : 'family-name') + '" required aria-required="true" value="' + esc(p.nom || '') + '"></div>' +
      '<div class="champ"><label for="p' + i + '-sexe">' + TXT.sexe + '</label><select id="p' + i + '-sexe" required aria-required="true"><option value="">' + (LANG === 'en' ? 'Choose' : 'Choisir') + '</option>' +
        ['femme', 'homme'].map(function (s) { return '<option value="' + s + '"' + (p.sexe === s ? ' selected' : '') + '>' + TXT[s] + '</option>'; }).join('') + '</select></div>' +
      '<div class="case" style="grid-column:1/-1;margin:0"><input type="checkbox" id="p' + i + '-premiere"' + (p.premiere ? ' checked' : '') + '><label for="p' + i + '-premiere">' + TXT.premiere + '</label></div>' +
      '</fieldset>');
    b.querySelector('#p' + i + '-prenom').addEventListener('input', function (e) { p.prenom = e.target.value; recap(); });
    b.querySelector('#p' + i + '-nom').addEventListener('input', function (e) { p.nom = e.target.value; if (!i) etat.client.nom = e.target.value; });
    b.querySelector('#p' + i + '-sexe').addEventListener('change', function (e) { p.sexe = e.target.value; });
    b.querySelector('#p' + i + '-premiere').addEventListener('change', function (e) { p.premiere = e.target.checked; recap(); });
    return b;
  }
  function erreurChamp(input, msg) {
    var ch = input.closest('.champ');
    var ancien = ch && ch.querySelector('.message-erreur'); if (ancien) ancien.remove();
    input.removeAttribute('aria-invalid');
    if (ch) ch.classList.remove('erreur');
    if (!msg) return false;
    input.setAttribute('aria-invalid', 'true');
    if (ch) { ch.classList.add('erreur'); var m = el('<p class="message-erreur" id="' + input.id + '-err">' + msg + '</p>'); ch.appendChild(m); input.setAttribute('aria-describedby', input.id + '-err'); }
    return true;
  }
  function validerParticipants() {
    var premier = null;
    for (var i = 0; i < etat.nb; i++) {
      var pr = document.getElementById('p' + i + '-prenom');
      if (erreurChamp(pr, pr.value.trim() ? '' : TXT.champRequis) && !premier) premier = pr;
      var nm = document.getElementById('p' + i + '-nom');
      if (erreurChamp(nm, nm.value.trim() ? '' : TXT.champRequis) && !premier) premier = nm;
      var sx = document.getElementById('p' + i + '-sexe');
      if (sx && erreurChamp(sx, sx.value ? '' : TXT.champRequis) && !premier) premier = sx;
    }
    if (premier) { premier.focus(); return false; }
    return true;
  }

  // ------------------------------------------------------------------ 3. Adresse et déplacement
  function etapeAdresse(focus) {
    var c = corps('adresse'); c.innerHTML = '';
    var f = el('<form novalidate><div class="grille-champs">' +
      '<div class="champ large"><label for="a-rue">' + TXT.adresse + '</label><input id="a-rue" autocomplete="street-address" required aria-required="true" aria-describedby="a-aide" value="' + esc(etat.adresse.rue) + '"><span class="aide" id="a-aide">' + TXT.adresseAide + '</span></div>' +
      '<div class="champ"><label for="a-cp">' + TXT.cp + '</label><input id="a-cp" autocomplete="postal-code" inputmode="numeric" required aria-required="true" value="' + esc(etat.adresse.cp) + '"></div>' +
      '<div class="champ"><label for="a-ville">' + TXT.ville + '</label><input id="a-ville" autocomplete="address-level2" required aria-required="true" value="' + esc(etat.adresse.ville || 'Marseille') + '"></div>' +
      '</div><button type="submit" class="btn btn-clair">' + TXT.calculer + '</button><div class="resultat" aria-live="polite" style="margin-top:1rem"></div></form>');
    f.addEventListener('input', function () {
      etat.adresse = { rue: f.querySelector('#a-rue').value, cp: f.querySelector('#a-cp').value, ville: f.querySelector('#a-ville').value };
      if (etat.deplacement) { etat.deplacement = null; f.querySelector('.resultat').innerHTML = ''; cacherApres('adresse'); recap(); }
    });
    f.addEventListener('submit', function (e) { e.preventDefault(); calculerDeplacement(f); });
    c.appendChild(f);
    if (etat.deplacement) afficherDeplacement(f.querySelector('.resultat'));
    montrer('adresse', focus);
  }
  function adresseComplete() { return [etat.adresse.rue, etat.adresse.cp + ' ' + etat.adresse.ville].join(', ').trim(); }
  function calculerDeplacement(f) {
    var vides = ['a-rue', 'a-cp', 'a-ville'].map(function (id) { var x = f.querySelector('#' + id); return erreurChamp(x, x.value.trim() ? '' : TXT.champRequis) ? x : null; }).filter(Boolean);
    if (vides.length) { vides[0].focus(); return; }
    var zone = f.querySelector('.resultat');
    zone.innerHTML = '<p class="chargement">' + TXT.calcul + '</p>';
    get({ action: 'deplacement', adresse: adresseComplete() }).then(function (r) {
      if (!r.ok) throw r;
      etat.deplacement = r;
      afficherDeplacement(zone);
      recap();
      if (r.zone !== 'trop_loin') ouvrir('duree', true);
    }).catch(function (r) { etat.deplacement = null; zone.innerHTML = '<p class="statut ko">' + (r && r.code === 'adresse' ? TXT.introuvable : messageErreur(r || {})) + '</p>'; });
  }
  function afficherDeplacement(zone) {
    var d = etat.deplacement;
    if (d.zone === 'marseille') zone.innerHTML = '<p class="statut ok">' + TXT.dansMarseille + '</p>';
    else if (d.zone === 'hors') zone.innerHTML = '<p class="statut ok">' + TXT.horsMarseille(String(d.km).replace('.', LANG === 'en' ? '.' : ','), String(d.montant)) + '</p>';
    else zone.innerHTML = '<p class="statut ko">' + TXT.tropLoin + ' <a href="mailto:' + esc(cfg.emailContact) + '">' + esc(cfg.emailContact) + '</a></p>';
  }

  // ------------------------------------------------------------------ 4. Durée
  function etapeDuree(focus) {
    var durees = etat.config.catalogue.durees;
    if (durees.indexOf(etat.duree) < 0) etat.duree = 60;
    var c = corps('duree'); c.innerHTML = '';
    c.appendChild(groupeRadio('duree', durees.map(function (d) {
      return { valeur: d, titre: d + ' ' + TXT.min, detail: euros(prixParPersonne(etat.format, d, etat.nb)) + ' ' + TXT.parPers };
    }), etat.duree, function (v) {
      etat.duree = Number(v); etat.creneau = null; recap();
      cacherApres('duree'); ouvrir(suivante('duree'), true);
    }));
    montrer('duree', focus);
    recap();
    ouvrir(suivante('duree'), false);
  }

  function majDurees() {
    document.querySelectorAll('#e-duree .option').forEach(function (o) {
      var d = Number(o.querySelector('input').value);
      o.querySelector('label span').textContent = euros(prixParPersonne(etat.format, d, etat.nb)) + ' ' + TXT.parPers;
    });
  }

  // ------------------------------------------------------------------ 5. Tapis
  function etapeTapisSeul(focus) {
    var c = corps('tapis'); c.innerHTML = '';
    var opts = []; for (var i = 0; i <= etat.nb; i++) opts.push({ valeur: i, titre: String(i) });
    c.appendChild(el('<p class="titre-p" id="aide-tapis" style="font-weight:650;margin:0 0 .3rem">' + TXT.tapis + '</p>'));
    c.appendChild(el('<p class="petit discret" style="margin:0 0 .6rem">' + TXT.tapisAide + '</p>'));
    var info = el('<p class="petit" role="status" style="margin:.7rem 0 0"></p>');
    var g = groupeRadio('tapis', opts, etat.tapisPerso, function (v) { etat.tapisPerso = Number(v); majTapis(); info.textContent = TXT.tapisApportes(etat.tapis); recap(); }, 'aide-tapis');
    g.style.gridTemplateColumns = 'repeat(auto-fill,minmax(4.5rem,1fr))';
    c.appendChild(g);
    majTapis(); info.textContent = TXT.tapisApportes(etat.tapis);
    c.appendChild(info);
    montrer('tapis', focus);
  }
  function etapeTapis(focus) { etapeTapisSeul(focus); etapeCreneau(false); }
  // Tapis à apporter = participants qui n'en ont pas (6 au plus).
  function majTapis() {
    if (etat.tapisPerso > etat.nb) etat.tapisPerso = etat.nb;
    etat.tapis = etat.format === 'enligne' ? 0 : Math.min(etat.config ? etat.config.catalogue.maxTapis : 6, Math.max(0, etat.nb - etat.tapisPerso));
  }

  // ------------------------------------------------------------------ 6. Créneau
  function etapeCreneau(focus) { montrer('creneau', focus); chargerCreneaux(); }
  function chargerCreneaux() {
    var c = corps('creneau');
    c.innerHTML = '<p class="chargement">' + TXT.chargement + '</p>';
    var debut = etat.fenetre, fin = plusJours(debut, JOURS_FENETRE - 1);
    var demande = [etat.format, etat.duree, debut].join('|');
    etat.demande = demande;
    get({ action: 'creneaux', format: etat.format, duree: etat.duree, debut: debut, fin: fin })
      .then(function (r) { if (etat.demande !== demande) return; if (!r.ok) throw r; etat.jours = r.jours; dessinerCreneaux(debut, fin); })
      .catch(function () { c.innerHTML = '<p class="statut ko">' + TXT.erreurChargement + '</p>'; });
  }
  function dessinerCreneaux(debut, fin) {
    var c = corps('creneau'); c.innerHTML = '';
    var horizon = plusJours(aujourdhui(), etat.config.horizonJours || 60);
    var nav = el('<div class="nav-semaines"><button type="button" class="prec">' + TXT.precedent + '</button><span>' +
      TXT.periode(fmtJour(debut, { day: 'numeric', month: 'long' }), fmtJour(fin, { day: 'numeric', month: 'long' })) +
      '</span><button type="button" class="suiv">' + TXT.suivant + '</button></div>');
    nav.querySelector('.prec').disabled = debut <= aujourdhui();
    nav.querySelector('.suiv').disabled = plusJours(debut, JOURS_FENETRE) > horizon;
    nav.querySelector('.prec').addEventListener('click', function () { etat.fenetre = plusJours(etat.fenetre, -JOURS_FENETRE); if (etat.fenetre < aujourdhui()) etat.fenetre = aujourdhui(); etat.creneau = null; cacherApres('creneau'); recap(); chargerCreneaux(); });
    nav.querySelector('.suiv').addEventListener('click', function () { etat.fenetre = plusJours(etat.fenetre, JOURS_FENETRE); etat.creneau = null; cacherApres('creneau'); recap(); chargerCreneaux(); });
    c.appendChild(nav);
    if (TZ_CLIENT !== TZ_SEANCE) c.appendChild(el('<p class="petit discret">' + esc(TXT.fuseau(TZ_CLIENT)) + '</p>'));
    // Regroupement par jour de l'heure du client.
    var parDate = {};
    etat.jours.forEach(function (j) { j.creneaux.forEach(function (cr) { var d = jourClient(cr.debut); (parDate[d] = parDate[d] || []).push(cr); }); });
    var dates = Object.keys(parDate).sort();
    if (!dates.length) { c.appendChild(el('<p>' + TXT.aucunJour + '</p>')); return; }
    var grille = el('<div class="jours"></div>'), heures = el('<div class="heures"></div>');
    for (var i = 0; i < JOURS_FENETRE; i++) {
      (function (d) {
        var n = (parDate[d] || []).length;
        var b = el('<button type="button" class="jour" aria-pressed="false"' + (n ? '' : ' disabled') + '>' + fmtJour(d, { weekday: 'short' }) + '<b>' + fmtJour(d, { day: 'numeric' }) + '</b><small>' + (n ? TXT.creneaux(n) : TXT.aucun) + '</small></button>');
        b.setAttribute('aria-label', fmtJour(d, { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + (n ? TXT.creneaux(n) : TXT.aucun));
        b.dataset.date = d;
        b.addEventListener('click', function () { choisirJour(d, grille, heures, parDate); });
        grille.appendChild(b);
      })(plusJours(debut, i));
    }
    c.appendChild(grille); c.appendChild(heures);
    choisirJour(etat.jour && parDate[etat.jour] ? etat.jour : dates[0], grille, heures, parDate);
  }
  function choisirJour(d, grille, heures, parDate) {
    etat.jour = d;
    grille.querySelectorAll('.jour').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.date === d ? 'true' : 'false'); });
    heures.innerHTML = '';
    var titre = fmtJour(d, { weekday: 'long', day: 'numeric', month: 'long' });
    heures.appendChild(el('<p class="petit discret" id="titre-heures">' + TXT.heuresDu(titre) + '</p>'));
    var liste = el('<div class="pastilles" role="group" aria-labelledby="titre-heures"></div>');
    (parDate[d] || []).forEach(function (cr) {
      var h = fmtInstant(cr.debut, { hour: '2-digit', minute: '2-digit' });
      var b = el('<button type="button" class="pastille" aria-pressed="' + (etat.creneau && etat.creneau.debut === cr.debut ? 'true' : 'false') + '">' + h + '</button>');
      b.addEventListener('click', function () {
        etat.creneau = { debut: cr.debut, date: d, heure: h };
        liste.querySelectorAll('.pastille').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        annoncer(titre + ', ' + h); recap();
        etapeSante(true);
      });
      liste.appendChild(b);
    });
    heures.appendChild(liste);
  }

  // ------------------------------------------------------------------ 7. Santé et charte
  function etapeSante(focus) {
    var c = corps('sante'); c.innerHTML = '';
    var noms = etat.participants.slice(0, etat.nb).map(function (p, i) { return i ? (p.prenom || TXT.participant(i)) : null; });
    c.appendChild(el('<div class="encadre"><p>' + TXT.attestation + '</p></div>'));
    noms.forEach(function (nom, i) {
      var p = etat.participants[i];
      var cs = el('<div class="case"><input type="checkbox" id="charte-' + i + '"' + (p.charte ? ' checked' : '') + '><label for="charte-' + i + '">' + TXT.charte(nom ? esc(nom) : null) + '</label></div>');
      cs.querySelector('input').addEventListener('change', function (e) { p.charte = e.target.checked; });
      c.appendChild(cs);
    });
    c.appendChild(el('<p class="message-erreur" id="err-charte" hidden></p>'));
    var s = el('<div class="champ" style="margin-top:1rem"><label for="sante">' + TXT.sante + '</label><textarea id="sante" maxlength="1000" aria-describedby="sante-aide">' + esc(etat.sante) + '</textarea><span class="aide" id="sante-aide">' + TXT.santeAide + '</span></div>');
    s.querySelector('textarea').addEventListener('input', function (e) { etat.sante = e.target.value; caseSante(); });
    c.appendChild(s);
    var cc = el('<div class="case" id="bloc-consent"><input type="checkbox" id="consent-sante"' + (etat.consentSante ? ' checked' : '') + '><label for="consent-sante">' + TXT.consentSante + '</label></div>');
    cc.querySelector('input').addEventListener('change', function (e) { etat.consentSante = e.target.checked; });
    c.appendChild(cc);
    c.appendChild(el('<p class="message-erreur" id="err-consent" hidden></p>'));
    caseSante();
    montrer('sante', focus);
    etapePaiement(false);
  }
  function caseSante() { var b = document.getElementById('bloc-consent'); if (b) b.hidden = !etat.sante.trim(); }

  // ------------------------------------------------------------------ 8. Coordonnées et paiement
  function enLignePossible() { return !!(etat.config.paypal && etat.config.paypal.clientId); }
  function etapePaiement(focus) {
    var c = corps('paiement'); c.innerHTML = '';
    var cl = etat.client, m = calcul();
    var f = el('<form id="f-coord" novalidate><div class="grille-champs">' +
      '<div class="champ"><label for="c-tel">' + TXT.tel + '</label><input id="c-tel" type="tel" inputmode="tel" autocomplete="tel" required aria-required="true" aria-describedby="c-tel-aide" value="' + esc(cl.tel) + '"><span class="aide" id="c-tel-aide">' + TXT.telAide + '</span></div>' +
      '<div class="champ large"><label for="c-email">' + TXT.email + '</label><input id="c-email" type="email" autocomplete="email" required aria-required="true" aria-describedby="c-email-aide" value="' + esc(cl.email) + '"><span class="aide" id="c-email-aide">' + TXT.emailAide + '</span></div>' +
      '</div><div class="piege" aria-hidden="true"><label for="c-site">Site web</label><input id="c-site" tabindex="-1" autocomplete="off"></div></form>');
    f.addEventListener('input', function () { cl.tel = f.querySelector('#c-tel').value; cl.email = f.querySelector('#c-email').value; });
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    c.appendChild(f);

    // Mode de paiement de chaque participant.
    var enLigne = enLignePossible();
    etat.participants.slice(0, etat.nb).forEach(function (p, i) {
      if (!enLigne && (p.mode === 'enligne' || p.mode === 'lien')) p.mode = 'especes';
      if (i === 0 && p.mode === 'lien') p.mode = 'enligne';
      if (i > 0 && p.mode === 'enligne') p.mode = 'lien';
      var titre = i === 0 ? TXT.votrePaiement : TXT.paiementDe(p.prenom || TXT.participant(i));
      var bloc = el('<div style="margin-top:1.2rem"><p class="titre-p" id="tp-' + i + '" style="font-weight:650;margin:0 0 .5rem">' + esc(titre) + ' · ' + euros(m.parts[i]) + '</p></div>');
      var opts = [];
      if (enLigne) opts.push(i === 0 ? { valeur: 'enligne', titre: TXT.payerEnLigne, detail: esc(TXT.payerEnLigneAide) } : { valeur: 'lien', titre: TXT.lienEmail, detail: esc(TXT.lienEmailAide) });
      opts.push({ valeur: 'especes', titre: TXT.especes, detail: esc(TXT.especesAide) });
      if (i === 0) opts.push({ valeur: 'pack', titre: TXT.avecPack, detail: esc(TXT.avecPackAide) });
      bloc.appendChild(groupeRadio('mode' + i, opts, p.mode, function (v) { p.mode = v; recap(); etapePaiement(false); var r = document.getElementById('mode' + i + '-' + v); if (r) r.focus(); }, 'tp-' + i));
      if (i === 0 && p.mode === 'pack') {
        var cp = el('<div class="champ" style="margin-top:.7rem"><label for="c-pack">' + TXT.codePack + '</label><input id="c-pack" autocomplete="off" autocapitalize="characters" placeholder="SAFE-XXXXXX" required aria-required="true" aria-describedby="c-pack-aide" value="' + esc(etat.packCode) + '"><span class="aide" id="c-pack-aide">' + TXT.codePackAide + '</span></div>');
        cp.querySelector('input').addEventListener('input', function (e) { etat.packCode = e.target.value; });
        bloc.appendChild(cp);
      }
      if (i > 0 && p.mode === 'lien') {
        var ch = el('<div class="champ" style="margin-top:.7rem"><label for="p' + i + '-email">' + esc(TXT.emailParticipant(p.prenom || TXT.participant(i))) + '</label><input id="p' + i + '-email" type="email" required aria-required="true" value="' + esc(p.email) + '"></div>');
        ch.querySelector('input').addEventListener('input', function (e) { p.email = e.target.value; });
        bloc.appendChild(ch);
      }
      c.appendChild(bloc);
    });

    var cg = el('<div class="case" style="margin-top:1.4rem"><input type="checkbox" id="c-cgv"' + (etat.cgv ? ' checked' : '') + '><label for="c-cgv">' + TXT.cgv + '</label></div>');
    cg.querySelector('input').addEventListener('change', function (e) { etat.cgv = e.target.checked; });
    c.appendChild(cg);
    c.appendChild(el('<p class="message-erreur" id="err-cgv" hidden></p>'));
    c.appendChild(el('<div id="zone-paiement" style="margin-top:1rem"></div>'));
    c.appendChild(el('<p class="statut ko" id="err-paiement" role="alert" hidden></p>'));
    montrer('paiement', focus);
    zonePaiement();
  }
  function msg(id, texte) { var e = document.getElementById(id); if (e) { e.hidden = !texte; e.textContent = texte || ''; } }
  function valider() {
    var premier = null;
    function verifier(input, m) { if (erreurChamp(input, m) && !premier) premier = input; }
    var tel = document.getElementById('c-tel'), email = document.getElementById('c-email');
    verifier(tel, !tel.value.trim() ? TXT.champRequis : (tel.value.replace(/\D/g, '').length < 9 ? TXT.telInvalide : ''));
    verifier(email, !email.value.trim() ? TXT.champRequis : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) ? '' : TXT.emailInvalide));
    var cpk = document.getElementById('c-pack');
    if (cpk) verifier(cpk, /^SAFE-[A-Z0-9]{6}$/i.test(cpk.value.trim()) ? '' : TXT.codeInvalide);
    etat.participants.slice(1, etat.nb).forEach(function (p, j) {
      var x = document.getElementById('p' + (j + 1) + '-email');
      if (x) verifier(x, !x.value.trim() ? TXT.champRequis : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.value.trim()) ? '' : TXT.emailInvalide));
    });
    var chartesOk = etat.participants.slice(0, etat.nb).every(function (p) { return p.charte; });
    msg('err-charte', chartesOk ? '' : TXT.charteRequis);
    if (!chartesOk && !premier) premier = document.querySelector('[id^="charte-"]:not(:checked)');
    var consentOk = !etat.sante.trim() || etat.consentSante;
    msg('err-consent', consentOk ? '' : TXT.consentRequis);
    if (!consentOk && !premier) premier = document.getElementById('consent-sante');
    msg('err-cgv', etat.cgv ? '' : TXT.cgvRequis);
    if (!etat.cgv && !premier) premier = document.getElementById('c-cgv');
    if (premier) { premier.focus(); return null; }
    return donnees();
  }
  function donnees() {
    return {
      format: etat.format, duree: etat.duree, debut: etat.creneau.debut, tapis: etat.tapis,
      adresse: etat.format === 'domicile' ? { rue: etat.adresse.rue.trim(), cp: etat.adresse.cp.trim(), ville: etat.adresse.ville.trim() } : null,
      participants: etat.participants.slice(0, etat.nb).map(function (p, i) {
        return { prenom: p.prenom.trim(), nom: (p.nom || '').trim(), sexe: p.sexe, premiere: !!p.premiere, charte: !!p.charte,
          paiement: p.mode, email: i ? (p.mode === 'lien' ? p.email.trim() : '') : etat.client.email.trim() };
      }),
      client: { nom: (etat.participants[0].nom || '').trim(), email: etat.client.email.trim(), tel: etat.client.tel.trim() },
      sante: etat.sante.trim() && etat.consentSante ? etat.sante.trim() : '', consentSante: !!(etat.sante.trim() && etat.consentSante),
      cgv: etat.cgv, montantAttendu: calcul().total, pack: etat.participants[0].mode === 'pack' ? etat.packCode.trim().toUpperCase() : '',
      piege: (document.getElementById('c-site') || {}).value || ''
    };
  }
  function zonePaiement() {
    var z = document.getElementById('zone-paiement'); z.innerHTML = '';
    msg('err-paiement', '');
    if (etat.participants[0].mode !== 'enligne' || !(calcul().parts[0] > 0)) { z.appendChild(boutonConfirmer()); return; }
    if (DEMO) {
      var b = el('<button type="button" class="btn">' + TXT.simuler + '</button>');
      b.addEventListener('click', function () { var d = valider(); if (!d) return; post({ action: 'paypal_valider', orderID: 'DEMO' }).then(function (r) { confirmation(r.reservation, d); }); });
      z.appendChild(b); return;
    }
    z.appendChild(el('<div id="paypal-boutons"><p class="chargement">' + TXT.paypalChargement + '</p></div>'));
    chargerPaypal().then(rendrePaypal).catch(function () { msg('err-paiement', TXT.paypalIndispo); document.getElementById('paypal-boutons').innerHTML = ''; });
  }
  function boutonConfirmer() {
    var b = el('<button type="button" class="btn">' + TXT.confirmer + '</button>');
    b.addEventListener('click', function () {
      var d = valider(); if (!d || etat.envoi) return;
      etat.envoi = true; b.disabled = true; b.textContent = TXT.envoi; msg('err-paiement', '');
      d.action = 'reserver';
      post(d).then(function (r) { if (r.ok) return confirmation(r.reservation, d); traiterErreur(r); })
        .catch(function () { traiterErreur({ code: 'serveur' }); })
        .then(function () { etat.envoi = false; b.disabled = false; b.textContent = TXT.confirmer; });
    });
    return b;
  }
  function traiterErreur(r) {
    msg('err-paiement', messageErreur(r));
    if (r.code === 'pris') { etat.creneau = null; recap(); cacherApres('creneau'); montrer('creneau', true); chargerCreneaux(); annoncer(messageErreur(r)); }
  }
  var promessePaypal = null;
  function chargerPaypal() {
    if (window.paypal) return Promise.resolve();
    if (promessePaypal) return promessePaypal;
    promessePaypal = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(etat.config.paypal.clientId) + '&currency=' + (etat.config.paypal.devise || 'EUR') +
        '&intent=capture&components=buttons&disable-funding=paylater,venmo&locale=' + (LANG === 'en' ? 'en_GB' : 'fr_FR');
      s.onload = ok; s.onerror = function () { promessePaypal = null; ko(); };
      document.head.appendChild(s);
    });
    return promessePaypal;
  }
  function rendrePaypal() {
    var conteneur = document.getElementById('paypal-boutons');
    if (!conteneur) return;
    conteneur.innerHTML = '';
    var derniere = null, envoyees = null;
    window.paypal.Buttons({
      style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 },
      onClick: function (data, actions) { msg('err-paiement', ''); envoyees = valider(); return envoyees ? actions.resolve() : actions.reject(); },
      createOrder: function () {
        return post(Object.assign({}, envoyees || donnees(), { action: 'paypal_creer' })).then(function (r) {
          if (!r.ok) { derniere = r; throw new Error(r.code); }
          return r.orderID;
        });
      },
      onApprove: function (data, actions) {
        return post({ action: 'paypal_valider', orderID: data.orderID }).then(function (r) {
          if (r.ok) return confirmation(r.reservation, envoyees || donnees());
          if (r.code === 'refus_carte') { msg('err-paiement', messageErreur(r)); return actions.restart(); }
          traiterErreur(r);
        });
      },
      onError: function () { traiterErreur(derniere || { code: 'serveur' }); derniere = null; }
    }).render(conteneur).catch(function () { msg('err-paiement', TXT.paypalIndispo); });
  }

  // ------------------------------------------------------------------ Récapitulatif
  function recap() {
    var a = racine.querySelector('.recap');
    if (!a) return;
    if (!etat.format) { a.innerHTML = '<h2 id="titre-recap">' + TXT.recap + '</h2><p>' + TXT.recapVide + '</p>'; return; }
    var lignes = [[TXT.rLieu, etat.format === 'domicile' ? TXT.domicile : TXT.enligne], [TXT.rPers, TXT.personnes(etat.nb)]];
    if (etat.duree) lignes.push([TXT.rDuree, etat.duree + ' ' + TXT.min]);
    if (etat.format === 'domicile' && etat.duree) lignes.push([TXT.rTapis, String(etat.tapis)]);
    if (etat.creneau) {
      lignes.push([TXT.rDate, fmtInstant(etat.creneau.debut, { weekday: 'long', day: 'numeric', month: 'long' })]);
      lignes.push([TXT.rHeure, etat.creneau.heure]);
    }
    var html = '<h2 id="titre-recap">' + TXT.recap + '</h2><dl>' + lignes.map(function (l) { return '<dt>' + l[0] + '</dt><dd>' + esc(l[1]) + '</dd>'; }).join('') + '</dl>';
    if (etat.duree) {
      var m = calcul();
      html += '<div class="ligne" style="margin-top:1rem"><span>' + TXT.lSeance(etat.nb, String(m.pp)) + '</span><span>' + euros(m.pp * etat.nb) + '</span></div>';
      if (m.pack0) html += '<div class="ligne"><span>' + TXT.lPack + '</span><span>−' + euros(m.pp) + '</span></div>';
      if (m.nbPremiere) html += '<div class="ligne"><span>' + TXT.lPremiere(m.nbPremiere) + '</span><span>−' + euros(m.nbPremiere * etat.config.catalogue.reductionPremiere) + '</span></div>';
      if (etat.format === 'domicile' && etat.deplacement) html += '<div class="ligne"><span>' + TXT.lDeplacement + '</span><span>' + (m.dep ? euros(m.dep) : TXT.gratuit) + '</span></div>';
      html += '<div class="total"><span>' + TXT.total + '</span><span>' + euros(m.total) + '</span></div>';
      if (etat.nb > 1) html += '<div class="ligne"><span>' + TXT.votrePart + '</span><span>' + euros(m.parts[0]) + '</span></div>';
    }
    html += '<p>' + TXT.recapNote + '</p>';
    a.innerHTML = html;
  }

  // ------------------------------------------------------------------ Confirmation
  function confirmation(resa, d) {
    var quand = fmtInstant(resa.debut, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    var liens = d.participants.some(function (p) { return p.paiement === 'lien'; });
    racine.innerHTML = '';
    var bloc = el('<div class="confirmation" role="status">' +
      '<h2 tabindex="-1"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#5D6B2E"/><path d="M12 20.5l5.5 5.5L29 14.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' + TXT.ok + '</h2>' +
      '<p><strong>SAFE Yoga</strong>, ' + resa.duree + ' ' + TXT.min + ', ' + esc(quand) + '.</p>' +
      '<p>' + TXT.okEmail(esc(d.client.email)) + (resa.format === 'enligne' ? ' ' + TXT.okVisio : '') + '</p>' +
      (liens ? '<p>' + TXT.okLiens + '</p>' : '') +
      '<p style="display:flex;flex-wrap:wrap;gap:.8rem;margin-top:1.4rem"><button type="button" class="btn ics">' + TXT.ajouterAgenda + '</button>' +
      '<a class="btn btn-clair" href="' + RACINE_SITE + (LANG === 'en' ? 'en/' : '') + '">' + TXT.accueil + '</a></p></div>');
    bloc.querySelector('.ics').addEventListener('click', function () { telechargerIcs(resa); });
    racine.appendChild(bloc);
    racine.scrollIntoView({ block: 'start' });
    bloc.querySelector('h2').focus({ preventScroll: true });
  }
  function telechargerIcs(resa) {
    var f = function (x) { return new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SAFE//Reservation//FR', 'BEGIN:VEVENT', 'UID:' + resa.id + '-' + Date.now(),
      'DTSTAMP:' + f(Date.now()), 'DTSTART:' + f(resa.debut), 'DTEND:' + f(resa.fin), 'SUMMARY:SAFE Yoga',
      'LOCATION:' + (resa.visio || '').replace(/[,;]/g, ' '), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'seance-safe.ics';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ Annulation (lien de l'e-mail)
  function modeAnnulation(id, cle, p) {
    racine.innerHTML = '<div class="confirmation"><h2 tabindex="-1">' + TXT.gerer + '</h2><div class="contenu-a"><p class="chargement">' + TXT.chargement + '</p></div></div>';
    var zone = racine.querySelector('.contenu-a');
    var q = { action: 'reservation', id: id, cle: cle };
    if (p) q.p = p;
    get(q).then(function (r) {
      if (!r.ok) { zone.innerHTML = '<p class="statut ko">' + messageErreur(r) + '</p>'; return; }
      var s = r.reservation;
      var quand = fmtInstant(s.debut, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      zone.innerHTML = '<p>' + (s.participant ? esc(s.prenom) + ', ' : '') + '<strong>SAFE Yoga</strong>, ' + s.duree + ' ' + TXT.min + ', ' + TXT.personnes(s.personnes || 1) + ', ' + esc(quand) + '.</p>';
      if (s.statut !== 'confirmee') { zone.appendChild(el('<p>' + TXT.annulee + '</p>')); return; }
      if (!s.annulable) { zone.appendChild(el('<p>' + TXT.passee + '</p>')); return; }
      zone.appendChild(el('<p>' + (s.participant ? TXT.desinscriptionInfo : (s.dansLesDelais ? TXT.remboursement : TXT.pasRemboursement)) + '</p>'));
      var actions = el('<p style="display:flex;flex-wrap:wrap;gap:.8rem"><button type="button" class="btn">' + (s.participant ? TXT.desinscrireBtn : TXT.annulerBtn) + '</button></p>');
      zone.appendChild(actions);
      actions.querySelector('button').addEventListener('click', function () {
        actions.innerHTML = '';
        var oui = el('<button type="button" class="btn">' + (s.participant ? TXT.confirmerDesinscription : TXT.confirmerAnnulation) + '</button>');
        var non = el('<a class="btn btn-clair" href="' + RACINE_SITE + (LANG === 'en' ? 'en/' : '') + '">' + (s.participant ? TXT.garderPlace : TXT.garder) + '</a>');
        actions.appendChild(oui); actions.appendChild(non); oui.focus();
        oui.addEventListener('click', function () {
          oui.disabled = true;
          var corpsA = { action: 'annuler', id: id, cle: cle };
          if (p) corpsA.p = Number(p);
          post(corpsA).then(function (x) {
            zone.innerHTML = x.ok ? '<p class="statut ok" role="status">' + (s.participant ? TXT.desinscriptionOk : TXT.annulationOk) + '</p>' : '<p class="statut ko" role="alert">' + messageErreur(x) + '</p>';
          }).catch(function () { zone.innerHTML = '<p class="statut ko" role="alert">' + messageErreur({ code: 'serveur' }) + '</p>'; });
        });
      });
    }).catch(function () { zone.innerHTML = '<p class="statut ko">' + messageErreur({ code: 'serveur' }) + '</p>'; });
  }

  // ------------------------------------------------------------------ Payer sa part (lien reçu par e-mail)
  function boutonsPaypal(conteneur, creer, valider, surOk, surErreur) {
    if (DEMO) {
      var b = el('<button type="button" class="btn">' + TXT.simuler + '</button>');
      b.addEventListener('click', function () { b.disabled = true; valider('DEMO').then(surOk); });
      conteneur.appendChild(b); return;
    }
    conteneur.innerHTML = '<p class="chargement">' + TXT.paypalChargement + '</p>';
    chargerPaypal().then(function () {
      conteneur.innerHTML = '';
      window.paypal.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 },
        createOrder: function () { return creer().then(function (r) { if (!r.ok) { surErreur(r); throw new Error(r.code); } return r.orderID; }); },
        onApprove: function (data, actions) { return valider(data.orderID).then(function (r) { if (r.ok) return surOk(r); if (r.code === 'refus_carte') { surErreur(r); return actions.restart(); } surErreur(r); }); },
        onError: function () { }
      }).render(conteneur);
    }).catch(function () { surErreur({ code: 'serveur' }); conteneur.innerHTML = '<p class="statut ko">' + TXT.paypalIndispo + '</p>'; });
  }
  function modePayer(id, p, cle) {
    racine.innerHTML = '<div class="confirmation"><h2 tabindex="-1">' + TXT.partTitre + '</h2><div class="contenu-a"><p class="chargement">' + TXT.chargement + '</p></div></div>';
    var zone = racine.querySelector('.contenu-a');
    Promise.all([get({ action: 'config' }), get({ action: 'part', id: id, p: p, cle: cle })]).then(function (r) {
      etat.config = r[0];
      if (!r[1].ok) { zone.innerHTML = '<p class="statut ko">' + messageErreur(r[1]) + '</p>'; return; }
      var x = r[1].part;
      var quand = fmtInstant(x.debut, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      zone.innerHTML = '<p>' + TXT.partTexte(esc(x.prenom), euros(x.montant), esc(quand)) + '</p>';
      if (x.statutSeance !== 'confirmee' || x.statut === 'annule' || x.statut === 'rembourse') { zone.appendChild(el('<p>' + TXT.partAnnulee + '</p>')); return; }
      if (x.statut === 'paye') { zone.appendChild(el('<p class="statut ok">' + TXT.partPayee + '</p>')); return; }
      if (!x.payable || !enLignePossible()) { zone.appendChild(el('<p>' + TXT.partNonPayable + '</p>')); return; }
      var err = el('<p class="statut ko" role="alert" hidden></p>'), boutons = el('<div style="max-width:24rem"></div>');
      zone.appendChild(boutons); zone.appendChild(err);
      boutonsPaypal(boutons,
        function () { return post({ action: 'paypal_creer_part', id: id, p: Number(p), cle: cle }); },
        function (o) { return post({ action: 'paypal_valider_part', orderID: o }); },
        function () { zone.innerHTML = '<p class="statut ok" role="status">' + TXT.partOk + '</p>'; },
        function (e) { err.hidden = false; err.textContent = messageErreur(e); });
    }).catch(function () { zone.innerHTML = '<p class="statut ko">' + messageErreur({ code: 'serveur' }) + '</p>'; });
  }

  // ------------------------------------------------------------------ Acheter un pack
  function modePack() {
    racine.innerHTML = '<p class="chargement">' + TXT.chargement + '</p>';
    get({ action: 'config' }).then(function (c) {
      etat.config = c;
      var a = { format: 'domicile', duree: 60, taille: 1, nom: '', email: '', cgv: false };
      racine.innerHTML = '';
      var bloc = el('<section class="etape" aria-labelledby="t-pack"><h2 id="t-pack" tabindex="-1">' + TXT.packTitre + '</h2><p>' + TXT.packIntro + '</p><div class="corps"></div></section>');
      racine.appendChild(bloc);
      var zone = bloc.querySelector('.corps');
      function dessiner() {
        zone.innerHTML = '';
        if (DEMO) zone.appendChild(el('<p class="bandeau-demo">' + TXT.demo + '</p>'));
        zone.appendChild(el('<p class="titre-p" id="pk-f" style="font-weight:650;margin:1rem 0 .5rem">' + TXT.packFormat + '</p>'));
        zone.appendChild(groupeRadio('pkf', [{ valeur: 'domicile', titre: TXT.domicile }, { valeur: 'enligne', titre: TXT.enligne }], a.format, function (v) { a.format = v; if (v === 'enligne') a.taille = 1; dessiner(); }, 'pk-f'));
        zone.appendChild(el('<p class="titre-p" id="pk-d" style="font-weight:650;margin:1rem 0 .5rem">' + TXT.packDuree + '</p>'));
        zone.appendChild(groupeRadio('pkd', c.catalogue.durees.map(function (d) { return { valeur: d, titre: d + ' ' + TXT.min }; }), a.duree, function (v) { a.duree = Number(v); dessiner(); }, 'pk-d'));
        if (a.format === 'domicile') {
          zone.appendChild(el('<p class="titre-p" id="pk-t" style="font-weight:650;margin:1rem 0 .5rem">' + TXT.packTaille + '</p>'));
          zone.appendChild(groupeRadio('pkt', [{ valeur: 1, titre: TXT.seul }, { valeur: 2, titre: TXT.aDeux }, { valeur: 3, titre: TXT.troisSix }], a.taille, function (v) { a.taille = Number(v); dessiner(); }, 'pk-t'));
          zone.appendChild(el('<p class="petit discret">' + TXT.packTaillePers + '</p>'));
        }
        var pp = a.format === 'enligne' ? c.catalogue.enligne[a.duree] : c.catalogue.domicile[a.duree][a.taille - 1];
        zone.appendChild(el('<div class="encadre"><p>' + TXT.packPrix(euros(pp * c.catalogue.pack.payees), euros(pp)) + '</p></div>'));
        if (!enLignePossible()) { zone.appendChild(el('<p class="">' + TXT.packIndispo + ' <a href="mailto:' + esc(cfg.emailContact) + '">' + esc(cfg.emailContact) + '</a></p>')); return; }
        var f = el('<div class="grille-champs"><div class="champ"><label for="pk-nom">' + TXT.packNom + '</label><input id="pk-nom" autocomplete="name" required value="' + esc(a.nom) + '"></div>' +
          '<div class="champ"><label for="pk-email">' + TXT.email + '</label><input id="pk-email" type="email" autocomplete="email" required value="' + esc(a.email) + '"></div></div>');
        f.querySelector('#pk-nom').addEventListener('input', function (e) { a.nom = e.target.value; });
        f.querySelector('#pk-email').addEventListener('input', function (e) { a.email = e.target.value; });
        zone.appendChild(f);
        var cg = el('<div class="case"><input type="checkbox" id="pk-cgv"' + (a.cgv ? ' checked' : '') + '><label for="pk-cgv">' + TXT.cgv + '</label></div>');
        cg.querySelector('input').addEventListener('change', function (e) { a.cgv = e.target.checked; });
        zone.appendChild(cg);
        var err = el('<p class="statut ko" role="alert" hidden></p>'), boutons = el('<div style="max-width:24rem;margin-top:1rem"></div>');
        zone.appendChild(boutons); zone.appendChild(err);
        function verifierPack() {
          var nom = document.getElementById('pk-nom'), em = document.getElementById('pk-email'), premier = null;
          if (erreurChamp(nom, nom.value.trim() ? '' : TXT.champRequis)) premier = premier || nom;
          if (erreurChamp(em, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim()) ? '' : TXT.emailInvalide)) premier = premier || em;
          err.hidden = a.cgv; err.textContent = a.cgv ? '' : TXT.cgvRequis;
          if (!a.cgv) premier = premier || document.getElementById('pk-cgv');
          if (premier) { premier.focus(); return null; }
          return { format: a.format, duree: a.duree, taille: a.taille, client: { nom: a.nom.trim(), email: a.email.trim() }, cgv: true };
        }
        function fini(r) {
          racine.innerHTML = '';
          var ok = el('<div class="confirmation" role="status"><h2 tabindex="-1">' + TXT.packTitre + '</h2><p>' + TXT.packOk(esc(r.pack.code)) + '</p>' +
            '<p><a class="btn" href="./">' + (LANG === 'en' ? 'Book a session' : 'Réserver une séance') + '</a></p></div>');
          racine.appendChild(ok); ok.querySelector('h2').focus();
        }
        if (DEMO) {
          var b = el('<button type="button" class="btn">' + TXT.simulerPack + '</button>');
          b.addEventListener('click', function () { if (!verifierPack()) return; post({ action: 'paypal_valider_pack', orderID: 'DEMO' }).then(fini); });
          boutons.appendChild(b);
        } else {
          chargerPaypal().then(function () {
            window.paypal.Buttons({
              style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 },
              onClick: function (data, actions) { return verifierPack() ? actions.resolve() : actions.reject(); },
              createOrder: function () { return post(Object.assign({ action: 'paypal_creer_pack' }, verifierPack())).then(function (r) { if (!r.ok) { err.hidden = false; err.textContent = messageErreur(r); throw new Error(r.code); } return r.orderID; }); },
              onApprove: function (data, actions) { return post({ action: 'paypal_valider_pack', orderID: data.orderID }).then(function (r) { if (r.ok) return fini(r); err.hidden = false; err.textContent = messageErreur(r); if (r.code === 'refus_carte') return actions.restart(); }); }
            }).render(boutons);
          }).catch(function () { err.hidden = false; err.textContent = TXT.paypalIndispo; });
        }
      }
      dessiner();
    }).catch(function () { racine.innerHTML = '<p class="statut ko">' + TXT.erreurChargement + '</p>'; });
  }

  // ------------------------------------------------------------------ Réserver à nouveau (pré-remplissage)
  function appliquerReprise(r) {
    etat.format = r.format; etat.duree = r.duree; etat.nb = r.participants.length; etat.tapisPerso = Math.max(0, etat.nb - (r.tapis || 0)); majTapis();
    etat.participants = r.participants.map(function (x, i) {
      return { prenom: x.prenom, nom: x.nom || (i ? '' : r.client.nom), sexe: x.sexe === 'homme' || x.sexe === 'femme' ? x.sexe : '', premiere: false, charte: false, mode: i ? (x.email && enLignePossible() ? 'lien' : 'especes') : (enLignePossible() ? 'enligne' : 'especes'), email: x.email || '' };
    });
    if (r.adresse) etat.adresse = r.adresse;
    etat.client = { nom: r.client.nom, email: r.client.email, tel: r.client.tel };
    etat.sante = r.sante || '';
    etapeFormat();
    etapePersonnes(false);
    if (etat.format === 'domicile') etapeAdresse(false); else etapeDuree(false);
    var col = racine.querySelector('.resa-etapes');
    col.insertBefore(el('<p class="encadre" role="status">' + TXT.repriseInfo + '</p>'), col.firstChild);
    recap();
  }

  // ------------------------------------------------------------------ Démarrage
  if (params.get('annulation') && params.get('cle')) { modeAnnulation(params.get('annulation'), params.get('cle'), params.get('p')); return; }
  if (params.get('payer') && params.get('cle') && params.get('p')) { modePayer(params.get('payer'), params.get('p'), params.get('cle')); return; }
  if (params.get('pack')) { modePack(); return; }
  racine.innerHTML = '<p class="chargement">' + TXT.chargement + '</p>';
  get({ action: 'config' }).then(function (c) {
    if (!c.ok) throw c;
    etat.config = c;
    squelette();
    etapeFormat();
    recap();
    var fmt = params.get('format');
    if (params.get('reprise') && params.get('cle')) {
      get({ action: 'reprise', id: params.get('reprise'), cle: params.get('cle') }).then(function (r) { if (r.ok) appliquerReprise(r.reprise); });
    } else if (fmt === 'domicile' || fmt === 'enligne') { etat.format = fmt; etapeFormat(); etapePersonnes(false); recap(); }
    var lienPack = el('<p class="petit discret" style="margin-top:1.5rem">' + TXT.lienPack + '</p>');
    racine.appendChild(lienPack);
  }).catch(function () {
    racine.innerHTML = '<p class="statut ko">' + TXT.erreurChargement + ' <a href="mailto:' + esc(cfg.emailContact || '') + '">' + esc(cfg.emailContact || '') + '</a></p>';
  });
})();
