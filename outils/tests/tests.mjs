// Tests du backend de réservation SAFE : node outils/tests/tests.mjs
import assert from 'node:assert/strict';
import { creerSimulateur, remplirDemo, jourParis } from './simulateur.mjs';

let ok = 0;
const test = (nom, f) => { try { f(); ok++; console.log('  ok  ' + nom); } catch (e) { console.error('ÉCHEC ' + nom + '\n', e); process.exitCode = 1; } };
const debut = jourParis(new Date(), 0), fin = jourParis(new Date(), 20);
function preparer() { const sim = creerSimulateur(); remplirDemo(sim); return sim; }
const creneau = (sim, format, duree, n = 1, k = 0) =>
  sim.get({ action: 'creneaux', format, duree: String(duree), debut, fin }).jours[n].creneaux[k].debut;
const part = (prenom, sexe, x = {}) => ({ prenom, nom: 'Martin', sexe, premiere: false, charte: true, paiement: 'especes', email: '', ...x });
function demande(sim, x = {}) {
  return {
    action: 'reserver', lang: 'fr', format: 'domicile', duree: 60, tapis: 1,
    debut: creneau(sim, x.format || 'domicile', x.duree || 60),
    adresse: { rue: '12 rue Paradis', cp: '13006', ville: 'Marseille' },
    participants: [part('Léa', 'femme')],
    client: { nom: 'Martin', email: 'lea@exemple.fr', tel: '06 12 34 56 78' },
    sante: '', consentSante: false, cgv: true, piege: '', ...x
  };
}

// ---------- Calculs purs ----------
test('prix : grille par personne, tranches 1 / 2 / 3 à 6, en ligne', () => {
  const c = creerSimulateur().contexte;
  assert.equal(c.prixParPersonne('domicile', 45, 1), 25);
  assert.equal(c.prixParPersonne('domicile', 60, 2), 25);
  assert.equal(c.prixParPersonne('domicile', 90, 6), 25);
  assert.equal(c.prixParPersonne('enligne', 60, 1), 25);
  assert.equal(c.prixPack('domicile', 60, 1), 300);
});
test('montants : réduction première séance, déplacement partagé, arrondi pour la personne qui réserve', () => {
  const c = creerSimulateur().contexte;
  const m = c.calculerMontants('domicile', 60, [true, false, false], 20, false);
  assert.equal(m.pp, 20);
  assert.deepEqual([...m.parts], [21.66, 26.67, 26.67]);
  assert.equal(Math.round(m.parts.reduce((a, b) => a + b, 0) * 100) / 100, m.total);
  assert.equal(m.total, 20 * 3 - 5 + 20);
  const p = c.calculerMontants('domicile', 60, [false, false], 10, true);
  assert.deepEqual([...p.parts], [5, 30]);
});
test('déplacement : Marseille gratuit, Aix au km aller-retour, au-delà de 45 km devis', () => {
  const c = creerSimulateur().contexte;
  assert.equal(c.calculerDeplacement('12 Rue Paradis, 13006 Marseille, France', 4000).montant, 0);
  const aix = c.calculerDeplacement('Cours Mirabeau, 13100 Aix-en-Provence, France', 33000);
  assert.equal(aix.zone, 'hors'); assert.equal(aix.km, 66); assert.equal(aix.montant, 20);
  assert.equal(c.calculerDeplacement('69002 Lyon', 315000).zone, 'trop_loin');
  { const r = c.calculerDeplacement('Cours Mirabeau, 13100 Aix-en-Provence', 40150); assert.equal(r.zone, 'hors'); assert.equal(r.montant, 24); }
  assert.equal(c.calculerDeplacement('13100 Aix-en-Provence', 45100).zone, 'trop_loin');
});
test('créneaux : battement autour d\'un événement occupé', () => {
  const c = creerSimulateur().contexte, h = (x, m = 0) => Date.UTC(2030, 0, 7, x, m);
  const r = c.calculerCreneaux([{ debut: h(8), fin: h(13), formats: null }], [{ debut: h(10), fin: h(11) }], { format: 'domicile', duree: 60, pas: 30, battement: 30, debutMin: 0 });
  assert.deepEqual([...r].map(t => (t - h(0)) / 60000), [480, 510, 690, 720]);
});

// ---------- API ----------
test('config et déplacement publics', () => {
  const sim = preparer();
  const c = sim.get({ action: 'config' });
  assert.equal(c.catalogue.domicile[90][2], 25);
  const d = sim.get({ action: 'deplacement', adresse: '10 cours Mirabeau, 13100 Aix' });
  assert.deepEqual([d.zone, d.km, d.montant], ['hors', 66, 20]);
  assert.equal(sim.get({ action: 'deplacement', adresse: 'adresse introuvable' }).code, 'adresse');
  sim.get({ action: 'deplacement', adresse: '10 cours Mirabeau, 13100 Aix' });
  assert.equal(sim.trajets.length, 2, 'trajet mis en cache');
});

test('créneaux : préavis 24 h, samedi domicile seulement', () => {
  const sim = preparer();
  const r = sim.get({ action: 'creneaux', format: 'enligne', duree: '60', debut, fin });
  const tous = r.jours.flatMap(j => j.creneaux);
  assert.ok(tous.length > 10);
  assert.ok(tous.every(c => Date.parse(c.debut) >= Date.now() + 24 * 3600e3));
  assert.equal(r.jours.filter(j => new Date(j.date + 'T12:00:00Z').getUTCDay() === 6).length, 0);
});

test('réservation à 3 à Aix : prix serveur, événement, e-mails, santé hors agenda', () => {
  const sim = preparer();
  const d = demande(sim, {
    adresse: { rue: '10 cours Mirabeau', cp: '13100', ville: 'Aix-en-Provence' }, tapis: 2,
    participants: [part('Léa', 'femme', { premiere: true }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' }), part('Inès', 'femme')],
    sante: 'Genou droit fragile', consentSante: true, montantAttendu: 20 * 3 - 5 + 20
  });
  sim.CONFIG.paypal.clientId = 'client-test';
  const r = sim.post(d);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.reservation.total, 75);
  const e = sim.agendas.resas[0], q = e.extendedProperties.private;
  assert.match(e.summary, /Yoga · Léa Martin · 3 pers\. \(domicile\)/);
  assert.equal(q.sante, 'Genou droit fragile');
  assert.ok(!e.description.includes('Genou'), 'pas de santé dans l\'agenda partagé');
  assert.match(e.description, /Tom Martin \(H\) : lien de paiement envoyé, 26,67 €/);
  assert.equal(JSON.parse(q.p0).a, 21.66);
  // e-mails : enseignante, personne qui réserve, Tom (Inès n'a pas d'e-mail)
  assert.deepEqual(sim.emails.map(m => m.to), ['safe@test.fr', 'lea@exemple.fr', 'tom@exemple.fr']);
  assert.match(sim.emails[0].body, /Genou droit fragile/);
  assert.match(sim.emails[0].body, /Déplacement : 20 € \(66 km aller-retour\)/);
  assert.match(sim.emails[1].htmlBody, /reprise=/);
  assert.match(sim.emails[2].htmlBody, /payer=/);
  assert.ok(!/—/.test(sim.emails.map(m => (m.body || '') + (m.htmlBody || '')).join('')), 'pas de tiret cadratin');
  assert.ok(!/ihss?ane|tamenaoul/i.test(JSON.stringify(sim.emails)), 'jamais son nom');
  // double réservation refusée
  assert.equal(sim.post({ ...d, tapis: 0, client: { ...d.client, email: 'autre@exemple.fr' }, participants: [part('Zoé', 'femme')], montantAttendu: undefined }).code, 'pris');
});

test('contrôles : zone, charte, sexe, CGV, prix modifié, piège, pack inconnu', () => {
  const sim = preparer();
  const d = demande(sim);
  assert.equal(sim.post({ ...d, adresse: { rue: 'Place Bellecour', cp: '69002', ville: 'Lyon' } }).code, 'zone');
  assert.equal(sim.post({ ...d, participants: [part('Léa', 'femme', { charte: false })] }).code, 'charte');
  assert.equal(sim.post({ ...d, participants: [part('Léa', '')] }).code, 'participants');
  assert.equal(sim.post({ ...d, cgv: false }).code, 'cgv');
  assert.equal(sim.post({ ...d, montantAttendu: 12 }).code, 'montant');
  assert.equal(sim.post({ ...d, piege: 'robot' }).code, 'spam');
  assert.equal(sim.post({ ...d, participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: 'SAFE-AAAAAA' }).code, 'pack');
  sim.CONFIG.paypal.clientId = '';
  assert.equal(sim.post({ ...d, participants: [part('Léa', 'femme'), part('Tom', 'homme', { paiement: 'lien', email: 'tom@x.fr' })] }).code, 'paiement');
  assert.equal(sim.agendas.resas?.length || 0, 0);
});

test('réduction première séance refusée pour un e-mail qui a déjà réservé', () => {
  const sim = preparer();
  assert.equal(sim.post(demande(sim)).ok, true);
  const r = sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), participants: [part('Léa', 'femme', { premiere: true })] }));
  assert.equal(r.code, 'premiere');
});

test('réduction première séance : chaque participant est vérifié par prénom et nom', () => {
  const sim = preparer();
  assert.equal(sim.post(demande(sim, { participants: [part('Léa', 'femme'), part('Tom', 'homme')] })).ok, true);
  // Tom revient avec une autre personne qui réserve : sa « première séance » est refusée (accents et casse ignorés)
  const r = sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), client: { nom: 'Durand', email: 'zoe@exemple.fr', tel: '0611223344' },
    participants: [part('Zoé', 'femme', { premiere: true, nom: 'Durand' }), part('TOM', 'homme', { premiere: true, nom: 'martin' })] }));
  assert.equal(r.code, 'premiere');
  assert.match(r.message, /TOM martin/);
  // sans la case pour Tom, la réservation passe et Zoé garde sa réduction
  const ok = sim.post(demande(sim, { debut: creneau(sim, 'domicile', 60, 3), client: { nom: 'Durand', email: 'zoe@exemple.fr', tel: '0611223344' },
    participants: [part('Zoé', 'femme', { premiere: true, nom: 'Durand' }), part('Tom', 'homme')] }));
  assert.equal(ok.ok, true);
});

test('participants : nom obligatoire, sexe femme ou homme uniquement', () => {
  const sim = preparer();
  assert.equal(sim.post(demande(sim, { participants: [part('Léa', 'femme', { nom: '' })] })).code, 'participants');
  assert.equal(sim.post(demande(sim, { participants: [part('Léa', 'autre')] })).code, 'participants');
});

test('PayPal : la personne qui réserve paie sa part, capture, puis un participant paie par son lien', () => {
  const sim = preparer();
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' })] });
  const cr = sim.post(d);
  assert.equal(cr.ok, true, JSON.stringify(cr));
  assert.equal(sim.commandesPaypal[cr.orderID].montant.value, '25.00');
  const v = sim.post({ action: 'paypal_valider', orderID: cr.orderID });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(sim.post({ action: 'paypal_valider', orderID: cr.orderID }).ok, false, 'pas de doublon');
  const q = sim.agendas.resas[0].extendedProperties.private;
  assert.equal(JSON.parse(q.p0).t, 'paye');
  const tom = JSON.parse(q.p1);
  const info = sim.get({ action: 'part', id: q.resaId, p: '1', cle: tom.k });
  assert.equal(info.part.montant, 25); assert.equal(info.part.payable, true);
  assert.equal(sim.get({ action: 'part', id: q.resaId, p: '1', cle: 'f'.repeat(32) }).code, 'lien');
  const c2 = sim.post({ action: 'paypal_creer_part', id: q.resaId, p: 1, cle: tom.k });
  const v2 = sim.post({ action: 'paypal_valider_part', orderID: c2.orderID });
  assert.equal(v2.ok, true, JSON.stringify(v2));
  assert.equal(JSON.parse(sim.agendas.resas[0].extendedProperties.private.p1).t, 'paye');
  assert.match(sim.agendas.resas[0].description, /Tom Martin \(H\) : payé en ligne 25 €/);
  assert.equal(sim.post({ action: 'paypal_creer_part', id: q.resaId, p: 1, cle: tom.k }).code, 'part');
});

test('PayPal : créneau pris entre-temps -> pas de capture ; carte refusée -> message', () => {
  const sim = preparer();
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' })] });
  const cr = sim.post(d);
  sim.post({ ...d, action: 'reserver', client: { ...d.client, email: 'rapide@exemple.fr' }, participants: [part('Zoé', 'femme')] });
  assert.equal(sim.post({ action: 'paypal_valider', orderID: cr.orderID }).code, 'pris');
  assert.equal(sim.commandesPaypal[cr.orderID].capturee, false);
  const d2 = demande(sim, { action: 'paypal_creer', debut: creneau(sim, 'domicile', 60, 4), participants: [part('Léa', 'femme', { paiement: 'enligne' })] });
  const c2 = sim.post(d2);
  sim.commandesPaypal[c2.orderID].refus = true;
  assert.equal(sim.post({ action: 'paypal_valider', orderID: c2.orderID }).code, 'refus_carte');
});

test('pack : achat, code par e-mail, réservation avec le pack, recrédit si annulation à temps', () => {
  const sim = preparer();
  const cr = sim.post({ action: 'paypal_creer_pack', format: 'domicile', duree: 60, taille: 1, client: { nom: 'Léa Martin', email: 'lea@exemple.fr' }, cgv: true, lang: 'fr' });
  assert.equal(sim.commandesPaypal[cr.orderID].montant.value, '300.00');
  const v = sim.post({ action: 'paypal_valider_pack', orderID: cr.orderID });
  assert.equal(v.ok, true, JSON.stringify(v));
  const code = v.pack.code;
  assert.match(code, /^SAFE-[A-Z0-9]{6}$/);
  assert.match(sim.emails.find(m => m.to === 'lea@exemple.fr').htmlBody, new RegExp(code));
  // mauvais format
  const mauvais = sim.post(demande(sim, { duree: 90, debut: creneau(sim, 'domicile', 90), participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: code }));
  assert.equal(mauvais.code, 'pack');
  const r = sim.post(demande(sim, { adresse: { rue: 'Cours Foch', cp: '13400', ville: 'Aubagne' }, participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: code }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.reservation.part, 11, 'reste le déplacement');
  assert.equal(sim.post({ action: 'pack', code, email: 'lea@exemple.fr' }).pack.restant, 10);
  const q = sim.agendas.resas[0].extendedProperties.private;
  assert.equal(sim.post({ action: 'annuler', id: q.resaId, cle: q.cle }).ok, true);
  assert.equal(sim.post({ action: 'pack', code, email: 'lea@exemple.fr' }).pack.restant, 11);
});

test('annulation par la personne qui réserve : remboursement automatique, créneau libéré, participants prévenus', () => {
  const sim = preparer();
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' })] });
  const { reservation } = sim.post({ action: 'paypal_valider', orderID: sim.post(d).orderID });
  const lu = sim.get({ action: 'reservation', id: reservation.id, cle: reservation.cle });
  assert.equal(lu.reservation.annulable, true); assert.equal(lu.reservation.dansLesDelais, true);
  sim.emails.length = 0;
  const a = sim.post({ action: 'annuler', id: reservation.id, cle: reservation.cle });
  assert.equal(a.ok, true); assert.equal(a.rembourse, true);
  assert.match(sim.emails[0].body, /Remboursé automatiquement : 25 € à Léa/);
  assert.equal(JSON.parse(sim.agendas.resas[0].extendedProperties.private.p0).t, 'rembourse');
  assert.deepEqual(sim.emails.map(m => m.to), ['safe@test.fr', 'lea@exemple.fr', 'tom@exemple.fr']);
  assert.match(sim.agendas.resas[0].summary, /^ANNULÉ/);
  const libres = sim.get({ action: 'creneaux', format: 'domicile', duree: '60', debut, fin }).jours.flatMap(j => j.creneaux.map(x => x.debut));
  assert.ok(libres.includes(d.debut));
  assert.equal(sim.post({ action: 'annuler', id: reservation.id, cle: reservation.cle }).dejaAnnulee, true);
});

test('désinscription d\'un participant : il ne paie rien, les autres gardent leur prix', () => {
  const sim = preparer();
  sim.CONFIG.paypal.clientId = 'client-test';
  const r = sim.post(demande(sim, { participants: [part('Léa', 'femme'), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' }), part('Inès', 'femme')] }));
  const q = sim.agendas.resas[0].extendedProperties.private, tom = JSON.parse(q.p1);
  assert.equal(sim.get({ action: 'reservation', id: q.resaId, cle: tom.k, p: '1' }).reservation.participant, true);
  sim.emails.length = 0;
  assert.equal(sim.post({ action: 'annuler', id: q.resaId, cle: tom.k, p: 1 }).ok, true);
  const apres = sim.agendas.resas[0].extendedProperties.private;
  assert.equal(apres.statut, 'confirmee');
  assert.equal(JSON.parse(apres.p1).t, 'annule');
  assert.equal(JSON.parse(apres.p0).a, 20, 'prix de Léa inchangé');
  assert.match(sim.agendas.resas[0].description, /Tom Martin \(H\) : annulé/);
  assert.deepEqual(sim.emails.map(m => m.to), ['safe@test.fr', 'lea@exemple.fr', 'tom@exemple.fr']);
  assert.ok(r.ok);
});

test('réserver à nouveau : données de pré-remplissage avec la seule clé de la personne qui réserve', () => {
  const sim = preparer();
  sim.post(demande(sim, { sante: 'Dos', consentSante: true, participants: [part('Léa', 'femme'), part('Tom', 'homme')] }));
  const q = sim.agendas.resas[0].extendedProperties.private;
  const r = sim.get({ action: 'reprise', id: q.resaId, cle: q.cle });
  assert.equal(r.reprise.client.email, 'lea@exemple.fr');
  assert.equal(r.reprise.participants[1].prenom, 'Tom');
  assert.equal(r.reprise.participants[1].nom, 'Martin');
  assert.equal(r.reprise.sante, 'Dos');
  assert.equal(sim.get({ action: 'reprise', id: q.resaId, cle: JSON.parse(q.p1).k }).code, 'lien');
});

test('rappels de la veille : une seule fois, part non payée en ligne basculée en espèces', () => {
  const sim = preparer();
  sim.CONFIG.paypal.clientId = 'client-test';
  const jour = jourParis(new Date(), 1);
  sim.ajouter('dispos', 'Dispo', jour, '00:00', '23:59');
  const c = sim.get({ action: 'creneaux', format: 'domicile', duree: '60', debut: jour, fin: jourParis(new Date(), 2) })
    .jours.flatMap(j => j.creneaux).find(x => Date.parse(x.debut) < Date.now() + 29 * 3600e3);
  if (!c) { console.log('      (pas de créneau dans la fenêtre de rappel à cette heure, test sauté)'); return; }
  sim.post(demande(sim, { debut: c.debut, participants: [part('Léa', 'femme'), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' })] }));
  sim.emails.length = 0;
  sim.contexte.envoyerRappels();
  assert.deepEqual(sim.emails.map(m => m.to), ['lea@exemple.fr', 'tom@exemple.fr']);
  assert.match(sim.emails[1].htmlBody, /en espèces/);
  assert.equal(JSON.parse(sim.agendas.resas[0].extendedProperties.private.p1).m, 'especes');
  sim.contexte.envoyerRappels();
  assert.equal(sim.emails.length, 2, 'un seul rappel');
});

test('purge des informations de santé après 12 mois', () => {
  const sim = preparer();
  const vieux = new Date(Date.now() - 400 * 86400e3);
  sim.agendas.resas = [{ id: 'old', start: { dateTime: vieux.toISOString() }, end: { dateTime: new Date(vieux.getTime() + 3600e3).toISOString() },
    extendedProperties: { private: { sante: 'Dos', statut: 'confirmee' } } }];
  sim.contexte.purgerDonneesSante();
  assert.equal(sim.agendas.resas[0].extendedProperties.private.sante, '');
});


test('gestion : code obligatoire, blocage après 5 essais faux', () => {
  const sim = preparer();
  assert.equal(sim.post({ action: 'admin_liste', code: 'nimporte' }).code, 'admin');
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  for (let i = 0; i < 5; i++) assert.equal(sim.post({ action: 'admin_liste', code: 'faux' }).code, 'code');
  assert.equal(sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' }).code, 'bloque');
  assert.match(sim.emails.at(-1).subject, /bloquée/);
});

test('gestion : pack payé en espèces, utilisable ensuite pour réserver', () => {
  const sim = preparer();
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  const base = { action: 'admin_pack_especes', code: 'lotus-rose-2026', format: 'domicile', duree: 60, taille: 1, client: { nom: 'Léa Martin', email: 'lea@exemple.fr' }, lang: 'fr' };
  assert.equal(sim.post(base).code, 'recu');
  const r = sim.post({ ...base, recu: true });
  assert.equal(r.ok, true); assert.equal(r.pack.montant, 300);
  assert.ok(sim.emails.some(m => m.to === 'lea@exemple.fr' && /SAFE-/.test(m.htmlBody)));
  assert.match(sim.emails.find(m => m.to === 'safe@test.fr').body, /payé en espèces/);
  const liste = sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' });
  assert.equal(liste.packs[0].paiement, 'especes'); assert.equal(liste.packs[0].restant, 11);
  const resa = sim.post(demande(sim, { participants: [part('Léa', 'femme', { paiement: 'pack' })], pack: r.pack.code }));
  assert.equal(resa.ok, true);
  assert.equal(sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' }).packs[0].restant, 10);
});

test('gestion : séance annulée par SAFE, remboursement total, pack recrédité, tout le monde prévenu', () => {
  const sim = preparer();
  sim.proprietes.set('ADMIN_CODE', 'lotus-rose-2026');
  const d = demande(sim, { action: 'paypal_creer', participants: [part('Léa', 'femme', { paiement: 'enligne' }), part('Tom', 'homme', { paiement: 'lien', email: 'tom@exemple.fr' }), part('Inès', 'femme')] });
  const { reservation } = sim.post({ action: 'paypal_valider', orderID: sim.post(d).orderID });
  const liste = sim.post({ action: 'admin_liste', code: 'lotus-rose-2026' });
  assert.equal(liste.seances.length, 1); assert.equal(liste.seances[0].participants[0].statut, 'paye');
  sim.emails.length = 0;
  const a = sim.post({ action: 'admin_annuler', code: 'lotus-rose-2026', id: reservation.id, message: 'Empêchement, désolée.' });
  assert.equal(a.ok, true); assert.equal(a.rembourses, 1); assert.equal(a.prevenus, 2);
  assert.match(sim.agendas.resas[0].summary, /^ANNULÉ PAR SAFE/);
  const client = sim.emails.find(m => m.to === 'lea@exemple.fr');
  assert.match(client.htmlBody, /Empêchement, désolée\./); assert.match(client.htmlBody, /remboursé en totalité/);
  assert.ok(sim.emails.some(m => m.to === 'tom@exemple.fr'));
  assert.match(sim.emails.find(m => m.to === 'safe@test.fr').body, /Remboursé automatiquement : 20 € à Léa/);
  assert.equal(sim.post({ action: 'admin_annuler', code: 'lotus-rose-2026', id: reservation.id }).dejaAnnulee, true);
  const libres = sim.get({ action: 'creneaux', format: 'domicile', duree: '60', debut, fin }).jours.flatMap(j => j.creneaux.map(x => x.debut));
  assert.ok(libres.includes(d.debut));
});

console.log(`\n${ok} tests réussis` + (process.exitCode ? ', des échecs ci-dessus' : ''));
