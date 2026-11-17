/* SAFE : menu mobile, lotus éclaté au défilement, formulaire de contact. */
(function () {
  'use strict';
  document.documentElement.classList.remove('sans-js');

  // Menu mobile
  var bouton = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (bouton && nav) {
    bouton.addEventListener('click', function () {
      var ouvert = nav.classList.toggle('ouvert');
      bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('ouvert'); bouton.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Lotus éclaté : les couches s'écartent puis se referment au fil du défilement.
  var lotus = document.querySelector('.lotus');
  if (lotus && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var couches = {
      feuille: [24, 1.04], ext: [12, 1.05], mid: [0, 1], coeur: [-10, 1], int: [-18, 0.98]
    };
    var imgs = {};
    lotus.querySelectorAll('[data-couche]').forEach(function (i) { imgs[i.dataset.couche] = i; });
    var textes = {};
    lotus.querySelectorAll('[data-phase]').forEach(function (t) { textes[t.dataset.phase] = t; });
    var phaseActuelle = null, attente = false;
    var indice = lotus.querySelector('.lotus-indice');

    function lisse(x) { return x * x * (3 - 2 * x); }
    function maj() {
      attente = false;
      var r = lotus.getBoundingClientRect();
      var course = lotus.offsetHeight - window.innerHeight;
      var p = course > 0 ? Math.min(1, Math.max(0, -r.top / course)) : 0;
      var e;
      if (p < 0.08) e = 0; else if (p < 0.2) e = (p - 0.08) / 0.12; else if (p < 0.78) e = 1; else if (p < 0.9) e = 1 - (p - 0.78) / 0.12; else e = 0;
      e = lisse(e);
      var phase = p < 0.16 ? 'intro' : p < 0.4 ? 'yoga' : p < 0.6 ? 'mind' : p < 0.8 ? 'care' : 'balance';
      var allume = { intro: null, yoga: 'ext', mind: 'mid', care: 'int', balance: null }[phase];
      Object.keys(couches).forEach(function (k) {
        var img = imgs[k]; if (!img) return;
        var c = couches[k];
        img.style.transform = 'translateY(' + (c[0] * e).toFixed(2) + '%) scale(' + (1 + (c[1] - 1) * e).toFixed(3) + ')';
        var actif = !allume || k === allume || (allume === 'int' && k === 'coeur') || k === 'feuille';
        img.style.opacity = actif ? 1 : 0.35;
      });
      if (phase !== phaseActuelle) {
        Object.keys(textes).forEach(function (k) {
          var actif = k === phase;
          textes[k].classList.toggle('actif', actif);
          textes[k].setAttribute('aria-hidden', actif ? 'false' : 'true');
        });
        if (indice) indice.style.opacity = phase === 'intro' ? 1 : 0;
        phaseActuelle = phase;
      }
    }
    window.addEventListener('scroll', function () { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
    window.addEventListener('resize', maj);
    maj();
  } else if (lotus) {
    lotus.querySelectorAll('[data-phase]').forEach(function (t) { t.classList.add('actif'); });
  }
})();
