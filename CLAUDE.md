# SAFE : yoga à domicile à Marseille et en ligne

Fiche de référence du site. Toute session (Claude ou humaine) la lit avant de modifier le site et la met à jour après chaque changement important. Site statique écrit à la main, hébergé sur GitHub Pages, aucun cookie. Les décisions détaillées et les questions en cours sont dans `SAFE-suivi.md` (projet Claude « YOGA » et dossier kDrive), pas dans ce dépôt public.

## 1. Contexte

- **Marque** : SAFE. « Yoga · Coaching · Écoute & conseils ». Devise : « Respirez. Équilibrez. Avancez. »
- **Offre au lancement** : SAFE Yoga seulement (Hatha, Vinyasa, Yin, respiration, méditation, relaxation, étirements). SAFE Mind, SAFE Care et SAFE Balance sont affichés « En développement ».
- **Où** : à domicile depuis Marseille 9e (Marseille, Aix-en-Provence, Aubagne, 35 km de route maximum) ou en ligne (visio, monde entier).
- **Langues** : site et séances en français et en anglais.
- **Domaine prévu** : safewellbeing.fr (pas encore acheté). Adresse provisoire : https://i2taconception.github.io/safe/
- **Contact** : safeinfocontact@gmail.com (compte Google dédié : agenda, e-mails, PayPal).

## 2. Règles à respecter (non négociables)

1. **Aucun nom ni prénom de la fondatrice** sur le site, sauf dans les mentions légales et les conditions de vente (obligation légale, pages exclues de Google). Le test de cohérence le contrôle.
2. **Jamais de tiret cadratin** (contrôlé par le test).
3. **Titres réglementés interdits** : jamais « psychologue », « psychothérapie », « thérapie », « accompagnement psychologique », ni promesse de soigner ou guérir. Garder partout la mention « Nos séances ne remplacent pas un suivi médical ou psychologique. Urgence : 15. Pensées suicidaires : 3114. »
4. **Pas de contenu inventé** : pas de faux avis ni témoignages, aucune formation affichée. Textes marqués `À VALIDER` : en attente de validation.
5. **Typographie française** (espace insécable avant `: ; ? !`), vouvoiement. **Voix : « nous »**, SAFE parle comme une marque.
6. **Son visage n'apparaît pas** ; aucune photo de banque ne doit laisser croire que c'est elle.
7. **Prix** : la source qui fait foi est `CATALOGUE` dans `apps-script/Code.gs` (à écrire). Tout changement se reporte dans `CATALOGUE_DEMO` de `assets/js/reservation.js` et dans les cellules `data-prix` (accueil FR/EN, conditions de vente). Le test de cohérence vérifie.

## 3. Tarifs et règles commerciales (décidés le 17/11/2026)

| Par personne | Seul | À 2 | 3 à 6 | En ligne (seul) |
|---|---|---|---|---|
| 45 min | 25 € | 20 € | 15 € | 20 € |
| 60 min | 30 € | 25 € | 20 € | 25 € |
| 90 min | 40 € | 35 € | 25 € | 35 € |

- Première séance : 5 € de réduction par personne (nouveau client). Rien de gratuit.
- Pack : 11 séances au prix de 10, une durée et un format, valable 1 an, payé en une fois en ligne.
- Déplacement : gratuit dans Marseille (elle y va en transports) ; au-delà, 0,30 € par km sur l'aller-retour en voiture calculé par Google Maps, arrondi à l'euro, une fois par séance, partagé entre participants, stationnement compris ; au-delà de 35 km de route à l'aller : devis.
- Groupes : 6 personnes maximum, groupes privés chez l'un d'eux. En ligne : 1 personne.
- Tapis : apportés gratuitement, 6 maximum.
- Paiement : PayPal (carte sans compte) ou espèces le jour même. Chaque participant paie sa part (lien PayPal par e-mail ou espèces) ; s'il n'a pas payé en ligne 24 h avant, espèces sur place.
- Annulation : gratuite jusqu'à 24 h avant ; après, due. Dans un groupe, un participant qui annule tard ne paie rien et les autres gardent leur prix. Séance arrêtée pour comportement déplacé ou sécurité : due.

## 4. Charte graphique

| Rôle | Couleur | Variable CSS |
|---|---|---|
| Fond crème | #F7F0E6 | `--creme` |
| Surfaces | #FFFBF4 | `--ivoire` |
| Fond secondaire (feuille de lotus) | #EEF0E1 | `--sauge` |
| Marque, boutons, liens (orchidée) | #742834 | `--orchidee` |
| Lotus (décor) | #D97A8E | `--rose` |
| Étiquettes (matcha) | #5D6B2E | `--matcha` |
| Pied de page, récapitulatif (jungle) | #2F3A27 | `--jungle` |
| Texte | #2E3A2B | `--encre` |
| Or (décor) | #B8914F | `--or` |

- Polices (dans `assets/fonts`, licence OFL) : **Marcellus** (titres), **Tenor Sans** (étiquettes en capitales espacées, boutons), **Figtree** (texte).
- Ambiance : planche d'inspiration Asie tropicale et Bali (baie aux falaises, jardin, bassin, lotus, orchidée, matcha, lumière dorée). Fond clair.
- **Élément signature** : le lotus éclaté en ouverture de l'accueil (`.lotus`, `assets/js/site.js`). 5 couches (`assets/img/lotus/` : feuille, ext, mid, coeur, int) qui s'écartent au défilement ; chaque phase présente une offre (Yoga, Mind, Care) puis la fleur se referme sur Balance. Arrêt complet si l'appareil demande moins d'animations.
- Logos : `assets/img/logo.svg` (en-tête), `logo-clair.svg` (pied de page), `favicon.svg`/`favicon.ico`. Logo photo complet : `SAFE-logo.jpg` (kDrive). Image de partage : `assets/img/og-safe.jpg`.
- À faire : tigre original discret en décor ; photos de jardin balinais.

## 5. Arborescence

```
index.html, en/index.html        Accueil FR et EN (écrits à la main)
reserver/, en/book/              Réservation (générées)
charte/, en/charter/             Charte de séance et attestation de santé (générées)
mentions-legales/, conditions-de-vente/, confidentialite/   Pages légales FR, noindex (générées)
404.html, robots.txt, sitemap.xml, favicon.ico
assets/css/site.css              Toute la mise en forme
assets/js/config.js              URL du script Google + e-mail de contact
assets/js/site.js                Menu mobile, lotus éclaté
assets/js/reservation.js         Module de réservation (FR/EN, mode démonstration intégré)
outils/pages/*.html              Sources des pages intérieures (en-tête et pied de page communs)
outils/generer_pages.py          Génère les pages intérieures : python3 outils/generer_pages.py
outils/tests/coherence.mjs       Contrôles : node outils/tests/coherence.mjs
```

Modifier l'en-tête ou le pied de page : dans `generer_pages.py` ET dans les deux accueils.

## 6. Réservation

Ordre du formulaire : lieu > participants (prénom, sexe, première séance) > adresse et calcul du déplacement > durée > tapis > créneau > charte et attestation (une case par participant), infos santé facultatives avec consentement > coordonnées et paiement (mode par participant) > confirmation.

- Sexe obligatoire pour chaque participant, à domicile et en ligne (17/11), finalité : sécurité de l'enseignante (écrite dans la politique de confidentialité).
- Infos santé : facultatives, consentement explicite, supprimées 12 mois après la dernière séance.
- Créneaux affichés dans le fuseau horaire du client.
- Lien « Réserver à nouveau » dans l'e-mail de confirmation pour pré-remplir (jamais à partir du seul e-mail).
- Agenda des réservations partagé avec Adrien (sécurité).
- **Mode démonstration** tant que `apiReservation` est vide dans `config.js`.
- **Backend à écrire** (`apps-script/Code.gs`, repris du site précédent et adapté) : config, deplacement (Maps), creneaux, reserver, paypal_creer/valider, liens de paiement des participants, pack, annulation, rappels.

## 7. SEO

Un seul H1 par page, description 120 à 165 caractères, canonical, hreflang FR/EN, Open Graph. Données structurées `HealthAndBeautyBusiness` et `FAQPage` sur les accueils. Au branchement du domaine : remplacer `https://i2taconception.github.io/safe/` partout (pages, sitemap, robots, `URL` de `generer_pages.py`) et les chemins `/safe/` de la page 404, ajouter le fichier `CNAME`.

## 8. Journal

- **17/11/2026** : dépôt `i2taconception/safe` créé, GitHub Pages activé (branche `main`, racine). Ancien dépôt `ihssane-yoga` supprimé.
- **17/11/2026** : création du site SAFE à partir de zéro (remplace « Ihssane Yoga ») : accueil FR/EN avec lotus éclaté, offres et tarifs, réservation complète en mode démonstration, charte, mentions légales, conditions de vente, confidentialité. En attente : backend Apps Script, statut (SIRET, assurance, médiateur), domaine.
