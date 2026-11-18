# SAFE : yoga à domicile à Marseille et en ligne

Fiche de référence du site. Toute session (Claude ou humaine) la lit avant de modifier le site et la met à jour après chaque changement important. Site statique écrit à la main, hébergé sur GitHub Pages, aucun cookie. Les décisions détaillées et les questions en cours sont dans `SAFE-suivi.md` (projet Claude « YOGA » et dossier kDrive), pas dans ce dépôt public.

## 1. Contexte

- **Marque** : SAFE. « Yoga · Coaching · Écoute & conseils ». Devise : « Respirez. Équilibrez. Avancez. »
- **Offre au lancement** : SAFE Yoga seulement (Hatha, Vinyasa, Yin, respiration, méditation, relaxation, étirements). SAFE Mind, SAFE Care et SAFE Balance sont affichés « En développement ».
- **Où** : à domicile depuis Marseille 9e (Marseille, Aix-en-Provence, Aubagne, 45 km de route maximum) ou en ligne (visio, monde entier).
- **Langues** : site et séances en français et en anglais.
- **Domaine** : https://safewellbeing.fr/ (acheté chez OVH le 18/11/2026, 3 ans, renouvellement en novembre 2029, DNSSEC ; titulaire : voir SAFE-suivi). Fichier `CNAME` à la racine. Ancienne adresse https://i2taconception.github.io/safe/ redirigée par GitHub.
- **Contact** : safeinfocontact@gmail.com (compte Google dédié : agenda, e-mails).

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
- Pack : 11 séances au prix de 10, une durée et un format, valable 1 an, payé en une fois en espèces (enregistré par SAFE dans la page de gestion, code envoyé par e-mail).
- Déplacement : gratuit dans Marseille (elle y va en transports) ; au-delà, 0,30 € par km sur l'aller-retour en voiture calculé par Google Maps, arrondi à l'euro, une fois par séance, partagé entre participants, stationnement compris ; au-delà de 45 km de route à l'aller : devis (limite portée de 35 à 45 km le 18/11 : Aix centre est à environ 40 km).
- Groupes : 6 personnes maximum, groupes privés chez l'un d'eux. En ligne : 1 personne.
- Tapis : apportés gratuitement, 6 maximum.
- Paiement (18/11) : **à domicile, en espèces le jour de la séance** (chaque participant règle sa part) ; **en ligne, avant la séance, par PayPal uniquement** (compte PayPal particulier, envoi manuel par le client ; pas de RIB, pour ne pas exposer le nom de la titulaire, la vérification du bénéficiaire des banques l'afficherait) : adresse PayPal et référence `SAFE-<n° de réservation>` dans l'e-mail de confirmation et dans le rappel de la veille. Adresse dans la propriété du script `PAIEMENT_PAYPAL` (jamais dans le dépôt). Le mode s'appelle `virement` dans le code. Paiement en ligne intégré au site (PayPal Checkout) abandonné. Le code PayPal reste dans Code.gs et reservation.js mais est inactif tant que `CONFIG.paypal.clientId` est vide.
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
- **Élément signature** : le lotus éclaté en ouverture de l'accueil (`.lotus`, `assets/js/site.js`), sur le modèle de la vue éclatée d'I2TA (refait le 18/11). Texte à gauche numéroté « 01 / 04 » à « 04 / 04 », fleur à droite : au défilement, elle se décompose en 3 parties posées côte à côte avec une étiquette chacune (01 Yoga = pétales extérieurs `ext`, 02 Mind = pétales du milieu `mid`, 03 Care = cœur `int` + `coeur`), la partie active ressort, puis la fleur se reforme sur 04 Balance. Barre de progression cliquable en bas (Yoga, Mind, Care, Balance). Réglages : `POSE` et `BORNES` dans site.js. Arrêt complet si l'appareil demande moins d'animations.
- Logos : `assets/img/logo.svg` (en-tête), `logo-clair.svg` (pied de page), `favicon.svg`/`favicon.ico`. Logo photo complet : `SAFE-logo.jpg` (kDrive). Image de partage : `assets/img/og-safe.jpg`.
- À faire : tigre original discret en décor ; photos de jardin balinais.

## 5. Arborescence

```
index.html, en/index.html        Accueil FR et EN (écrits à la main)
reserver/, en/book/              Réservation (générées)
charte/, en/charter/             Charte de séance et attestation de santé (générées)
mentions-legales/, conditions-de-vente/, confidentialite/   Pages légales FR, noindex (générées)
gestion/                         Page de gestion SAFE, noindex, non liée (générée ; script assets/js/gestion.js)
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

Ordre du formulaire : lieu > participants (prénom, nom, sexe Femme/Homme, première séance) > adresse et calcul du déplacement > durée > tapis > créneau > charte et attestation (une case par participant), infos santé facultatives avec consentement > coordonnées et paiement (mode par participant) > confirmation.

- Sexe obligatoire pour chaque participant, à domicile et en ligne (17/11), finalité : sécurité de l'enseignante (écrite dans la politique de confidentialité). Pas de texte d'explication sous le champ ; seulement Femme ou Homme (18/11).
- Prénom et nom obligatoires pour chaque participant ; le nom de la personne qui réserve n'est plus redemandé dans les coordonnées (18/11).
- Réduction première séance (18/11) : refusée seulement si la même personne (même prénom, même nom ET même e-mail, accents et majuscules ignorés) a déjà une séance non annulée ; deux homonymes avec des e-mails différents ne sont pas confondus. Un participant (autre que la personne qui réserve) qui coche « Première séance » doit donner son e-mail (champ qui apparaît alors) ; il reçoit aussi la confirmation. Empreinte `pq_…` (prénom, nom, e-mail) dans les propriétés privées de chaque réservation.
- Tapis : on demande « Combien de tapis avez-vous ? » ; SAFE apporte ceux qui manquent (participants moins tapis déclarés, 6 au plus), affiché « Tapis à apporter » dans l'agenda et l'e-mail à SAFE.
- Infos santé : facultatives, consentement explicite, supprimées 12 mois après la dernière séance.
- Créneaux affichés dans le fuseau horaire du client.
- Lien « Réserver à nouveau » dans l'e-mail de confirmation pour pré-remplir (jamais à partir du seul e-mail).
- Agenda des réservations partagé avec Adrien (sécurité).
- **Mode démonstration** tant que `apiReservation` est vide dans `config.js`.
- **Backend écrit et testé hors ligne** (`apps-script/Code.gs` + `appsscript.json`, 17/11) : config, deplacement (Google Maps), creneaux, reserver, paiement PayPal de la personne qui réserve, liens de paiement des autres participants (`?payer=`), pack (achat `?pack=1`, code `SAFE-XXXXXX`, crédit rendu si annulation dans les délais), annulation par la personne qui réserve ou désinscription d'un participant (`?annulation=…&p=`), « Réserver à nouveau » (`?reprise=`), rappels de la veille à 18 h (part non payée en ligne basculée en espèces), purge mensuelle des infos santé (12 mois).
- Infos santé : jamais dans l'agenda partagé ; seulement dans l'e-mail à SAFE et une propriété privée de l'événement.
- Battement autour des séances (18/11, `CONFIG.battement`) : en ligne 0, à domicile dans Marseille 30 min, hors de Marseille 1 h. La zone (calculée à l'adresse) est envoyée avec la demande de créneaux ; autour d'une séance déjà réservée, on garde le plus grand des deux battements (propriété privée `zone` de chaque réservation).
- Pack : vaut pour la part de la personne qui réserve ; le déplacement éventuel se règle en espèces.
- Pack payé en espèces (18/11) : payé en une fois, enregistré par SAFE dans la page de gestion ; le client reçoit son code par e-mail comme pour un achat PayPal.
- Remboursements PayPal automatiques (18/11, `CONFIG.remboursementAuto: true`) : client qui annule plus de 24 h avant, participant qui se désinscrit, séance annulée par SAFE (remboursement total). PayPal garde ses frais ; remboursement possible 180 jours au plus après le paiement.
- **Page de gestion** `/gestion/` (18/11) : protégée par le code `ADMIN_CODE` (propriété du script, 10 caractères au moins, jamais dans le dépôt), vérifié par le script ; 5 codes faux : blocage 1 h et e-mail à SAFE. Le code n'est gardé qu'en mémoire dans la page. Contenu : séances à venir (participants, paiements, tapis), « Annuler cette séance » (message aux participants, remboursement total, pack recrédité, créneau libéré, « ANNULÉ PAR SAFE » dans l'agenda), enregistrer un pack payé en espèces, liste des packs. Ne jamais supprimer une séance directement dans l'agenda : le client ne serait ni prévenu ni remboursé.

### Mise en service (compte safeinfocontact@gmail.com)
1. Google Agenda : créer « Disponibilités SAFE » et « Réservations SAFE » (partager le second avec Adrien). Noter l'ID de chacun (Paramètres > Intégrer l'agenda).
2. script.google.com > nouveau projet « Réservations SAFE ». Coller `Code.gs` ; Paramètres > afficher le manifeste, coller `appsscript.json`.
3. `CONFIG` : `agendaDispos`, `agendaReservations`. Propriétés du script : `ADRESSE_DEPART` (adresse de départ, jamais dans le dépôt public), `ADMIN_CODE` (code de la page de gestion), `PAIEMENT_PAYPAL` (adresse PayPal envoyée pour les séances en ligne).
4. Exécuter `verifierConfiguration` (autoriser), lire le journal, puis une fois `installerDeclencheurs`.
5. Déployer > Application Web, exécuter en tant que Moi, accès Tout le monde. Copier l'URL `/exec` dans `assets/js/config.js` (`apiReservation`). Après chaque modification : Gérer les déploiements > Nouvelle version.
6. (Abandonné le 18/11, pour mémoire) PayPal Professionnel : app Sandbox (Client ID dans `CONFIG.paypal.clientId`, secret en propriété), tester, puis Live (`env: 'live'`) et activer « Compte PayPal facultatif ».
7. Ouvrir des créneaux : événements « Dispo », « Dispo en ligne » ou « Dispo domicile » dans « Disponibilités SAFE » (répétitions acceptées). Tout événement de l'agenda principal bloque.

Tests : `node outils/tests/tests.mjs` (24 tests du backend, agendas, Maps et PayPal simulés), `node outils/tests/serveur.mjs --api` (aperçu local avec backend simulé ; code de gestion local : `gestion-locale-2026`).

## 7. SEO

Un seul H1 par page, description 120 à 165 caractères, canonical, hreflang FR/EN, Open Graph. Données structurées `HealthAndBeautyBusiness` et `FAQPage` sur les accueils. Adresse de référence : `https://safewellbeing.fr/` (pages, sitemap, robots, `URL` de `generer_pages.py`, `CONFIG.urlSite` de Code.gs). La page 404 utilise des chemins absolus `/`.

DNS (zone OVH) : A vers 185.199.108.153 à 185.199.111.153, AAAA vers 2606:50c0:8000::153 à 2606:50c0:8003::153, CNAME `www` vers `i2taconception.github.io.` ; ne pas toucher aux entrées MX/SPF de la boîte Zimbra.

## 8. Journal

- **18/11/2026** : domaine safewellbeing.fr acheté chez OVH ; adresses du site, sitemap, robots, page 404 et `CONFIG.urlSite` passés sur https://safewellbeing.fr/, fichier `CNAME`.
- **18/11/2026** : battement selon la zone (en ligne 0, Marseille 30 min, hors Marseille 1 h) ; réduction première séance vérifiée par prénom + nom + e-mail, e-mail demandé aux participants qui cochent la case. Tests : 24.
- **18/11/2026** : séances en ligne réglées avant la séance par PayPal seulement (adresse dans l'e-mail de confirmation, depuis la propriété `PAIEMENT_PAYPAL` ; RIB écarté) ; annulation à temps : e-mail « À VÉRIFIER » à SAFE pour rembourser un paiement déjà reçu. Tests : 23.
- **18/11/2026** : PayPal abandonné : paiement en espèces le jour de la séance, pack réglé en espèces et enregistré dans la page de gestion ; textes de l'accueil, des conditions de vente et de la confidentialité mis à jour.
- **18/11/2026** : page de gestion `/gestion/` (code `ADMIN_CODE`) : annulation d'une séance par SAFE avec remboursement total, packs payés en espèces, liste des packs ; remboursements PayPal automatiques. Tests du backend : 22.
- **18/11/2026** : lotus refait sur le modèle d'I2TA (numéros, étiquettes, barre de progression) ; réservation : prénom et nom par participant, sexe Femme/Homme sans texte d'aide, réduction première séance vérifiée pour chaque participant, question des tapis inversée. Tests du backend : 19.
- **18/11/2026** : backend installé sur safeinfocontact@gmail.com (projet Apps Script « Réservations SAFE », agendas « Disponibilités SAFE » et « Réservations SAFE », propriété `ADRESSE_DEPART`, déclencheurs), déployé en application Web (version 1) et branché dans `config.js` : fin du mode démonstration. Paiement en espèces seulement tant que PayPal n'est pas configuré. Limite de déplacement portée à 45 km.
- **17/11/2026** : dépôt `i2taconception/safe` créé, GitHub Pages activé (branche `main`, racine). Ancien dépôt `ihssane-yoga` supprimé.
- **17/11/2026** : backend de réservation écrit (`apps-script/`) et testé hors ligne ; module de réservation complété (pack, paiement des parts, désinscription, réserver à nouveau). Reste : installation sur le compte Google, PayPal.
- **17/11/2026** : création du site SAFE à partir de zéro (remplace « Ihssane Yoga ») : accueil FR/EN avec lotus éclaté, offres et tarifs, réservation complète en mode démonstration, charte, mentions légales, conditions de vente, confidentialité. En attente : backend Apps Script, statut (SIRET, assurance, médiateur), domaine.
