#!/usr/bin/env python3
"""Génère les pages intérieures (réservation, charte, pages légales, 404) à partir de outils/pages/*.html.
Chaque fichier source commence par un bloc d'en-tête :
<!--
chemin: reserver/index.html
lang: fr
titre: ...
description: ...
indexer: oui|non
alternate: en/book/   (facultatif : page équivalente dans l'autre langue)
scripts: assets/js/config.js assets/js/reservation.js (facultatif)
-->
puis le contenu de <main>. Lancer : python3 outils/generer_pages.py
"""
import os, re, glob
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://safewellbeing.fr/'

NAV = {
 'fr': [('#offres','Offres'),('#approche','Approche'),('#lieux','Où&nbsp;?'),('#questions','Questions')],
 'en': [('#offres','Offers'),('#approche','Approach'),('#lieux','Where?'),('#questions','Questions')],
}
T = {
 'fr': dict(evitement='Aller au contenu', menu='Menu', accueil='SAFE, accueil', reserver='Réserver', nav='Menu principal', langue='Langue',
   pied1='Yoga chez vous à Marseille, Aix-en-Provence et Aubagne, ou en ligne.',
   pied2='Nos séances ne remplacent pas un suivi médical ou psychologique. Urgence&nbsp;: 15. Pensées suicidaires&nbsp;: 3114.',
   charte='Charte de séance', infos='Informations', ml='Mentions légales', cgv='Conditions de vente', conf='Confidentialité', bas='© 2026 SAFE · Site sans cookie',
   home='', book='reserver/', charter='charte/'),
 'en': dict(evitement='Skip to content', menu='Menu', accueil='SAFE, home', reserver='Book', nav='Main menu', langue='Language',
   pied1='Yoga at your home in Marseille, Aix-en-Provence and Aubagne, or online.',
   pied2='Our sessions do not replace medical or psychological care. Emergency (France): 15. Suicidal thoughts: 3114.',
   charte='Session charter', infos='Information', ml='Legal notice (FR)', cgv='Terms of sale (FR)', conf='Privacy (FR)', bas='© 2026 SAFE · No cookies',
   home='en/', book='en/book/', charter='en/charter/'),
}

def page(meta, contenu):
    lang = meta['lang']; t = T[lang]
    prof = meta['chemin'].count('/')
    r = '../' * prof
    autre = 'en' if lang == 'fr' else 'fr'
    alt = meta.get('alternate')
    url = URL + meta['chemin'].replace('index.html', '')
    hreflang = ''
    if alt is not None:
        u_fr = url if lang == 'fr' else URL + alt
        u_en = url if lang == 'en' else URL + alt
        hreflang = (f'<link rel="alternate" hreflang="fr" href="{u_fr}">\n<link rel="alternate" hreflang="en" href="{u_en}">\n'
                    f'<link rel="alternate" hreflang="x-default" href="{u_fr}">\n')
    robots = '' if meta.get('indexer', 'oui') == 'oui' else '<meta name="robots" content="noindex">\n'
    canon = f'<link rel="canonical" href="{url}">\n' if meta.get('indexer', 'oui') == 'oui' else ''
    if meta['chemin'] == '404.html':
        r = '/'  # la page 404 est servie à n'importe quelle adresse : chemins absolus
    lien_autre = r + (alt if alt is not None else T[autre]['home'])
    langues = ('<span aria-current="true" lang="fr">FR</span><a href="%s" lang="en" hreflang="en">EN</a>' % lien_autre) if lang == 'fr' else \
              ('<a href="%s" lang="fr" hreflang="fr">FR</a><span aria-current="true" lang="en">EN</span>' % lien_autre)
    nav = ''.join(f'<a href="{r}{t["home"]}{h}">{x}</a>' for h, x in NAV[lang])
    scripts = ''.join(f'<script src="{r}{s}" defer></script>\n' for s in meta.get('scripts', '').split())
    return f'''<!doctype html>
<html lang="{lang}" class="sans-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta['titre']}</title>
<meta name="description" content="{meta['description']}">
{robots}{canon}{hreflang}<meta property="og:type" content="website">
<meta property="og:site_name" content="SAFE">
<meta property="og:title" content="{meta['titre']}">
<meta property="og:description" content="{meta['description']}">
<meta property="og:image" content="{URL}assets/img/og-safe.jpg">
<meta name="theme-color" content="#F7F0E6">
<link rel="icon" href="{r}favicon.ico" sizes="any">
<link rel="icon" href="{r}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{r}assets/img/apple-touch-icon.png">
<link rel="stylesheet" href="{r}assets/css/site.css">
</head>
<body>
<a class="lien-evitement" href="#contenu">{t['evitement']}</a>
<header class="entete">
  <div class="conteneur">
    <a class="marque" href="{r}{t['home']}" aria-label="{t['accueil']}"><img src="{r}assets/img/logo.svg" alt="SAFE" width="120" height="46"></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav">{t['menu']}</button>
    <nav class="nav" id="nav" aria-label="{t['nav']}">
      {nav}
      <a class="btn" href="{r}{t['book']}">{t['reserver']}</a>
      <div class="langues" role="group" aria-label="{t['langue']}">{langues}</div>
    </nav>
  </div>
</header>
<main id="contenu">
{contenu.strip()}
</main>
<footer class="pied">
  <div class="conteneur">
    <div class="grille">
      <div>
        <img src="{r}assets/img/logo-clair.svg" alt="SAFE" width="146" height="56">
        <p>{t['pied1']}</p>
        <p>{t['pied2']}</p>
      </div>
      <div>
        <h2>SAFE</h2>
        <ul>
          <li><a href="{r}{t['book']}">{t['reserver']}</a></li>
          <li><a href="{r}{t['charter']}">{t['charte']}</a></li>
          <li><a href="mailto:contact@safewellbeing.fr">contact@safewellbeing.fr</a></li>
        </ul>
      </div>
      <div>
        <h2>{t['infos']}</h2>
        <ul>
          <li><a href="{r}mentions-legales/">{t['ml']}</a></li>
          <li><a href="{r}conditions-de-vente/">{t['cgv']}</a></li>
          <li><a href="{r}confidentialite/">{t['conf']}</a></li>
        </ul>
      </div>
    </div>
    <p class="bas">{t['bas']} <a class="acces" href="{r}gestion/" rel="nofollow" aria-label="Espace SAFE" title="Espace SAFE"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 4c1.6 1.8 2.4 3.9 2.4 6.2S13.6 14.6 12 16c-1.6-1.4-2.4-3.5-2.4-5.8S10.4 5.8 12 4zm-7 5c2.3.2 4.1 1.2 5.3 3 .5.8.8 1.7.9 2.6-2.2-.2-4-1.2-5.2-2.9-.6-.8-.9-1.7-1-2.7zm14 0c-.1 1-.4 1.9-1 2.7-1.2 1.7-3 2.7-5.2 2.9.1-.9.4-1.8.9-2.6 1.2-1.8 3-2.8 5.3-3zM4 17.2c2.6-.9 5.3-.9 8 0 2.7-.9 5.4-.9 8 0-2.6 1.2-5.3 1.6-8 1.2-2.7.4-5.4 0-8-1.2z"/></svg></a></p>
  </div>
</footer>
<script src="{r}assets/js/site.js" defer></script>
{scripts}</body>
</html>
'''

for src in sorted(glob.glob(os.path.join(RACINE, 'outils/pages/*.html'))):
    txt = open(src, encoding='utf-8').read()
    m = re.match(r'\s*<!--(.*?)-->', txt, re.S)
    meta = {}
    for ligne in m.group(1).strip().splitlines():
        k, _, v = ligne.partition(':'); meta[k.strip()] = v.strip()
    html = page(meta, txt[m.end():])
    dest = os.path.join(RACINE, meta['chemin'])
    os.makedirs(os.path.dirname(dest) or RACINE, exist_ok=True)
    open(dest, 'w', encoding='utf-8').write(html)
    print('écrit', meta['chemin'])
