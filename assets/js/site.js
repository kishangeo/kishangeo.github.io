/* ==========================================================================
   ktiwari.com, version two

   The scroll is the interface. GSAP ScrollTrigger drives four set pieces:
     1. a hero that assembles, then gets left behind
     2. a pinned five-step sequence that scrubs a diagram as you descend
     3. a horizontal rail of papers
     4. a timeline whose line draws itself

   Behind all of it, a Moon that travels the whole page and a sky that never
   stops. Everything is guarded: with reduced motion or without JavaScript
   the page is a plain, complete, readable document.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  root.classList.add('js');

  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* --------------------------------------------------------------- theme
     The head script already set data-theme before the first paint, so all
     this does is wire the switch and tell the sky and the Moon about it.
     A choice sticks; until one is made the OS setting wins, live. */
  var THEME_KEY = 'kt-theme';
  function currentTheme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  (function themeSwitch() {
    var btn = document.getElementById('themeBtn');
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

    function stored() {
      try { var v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : null; }
      catch (e) { return null; }
    }

    function apply(mode, remember) {
      root.setAttribute('data-theme', mode);
      if (remember) { try { localStorage.setItem(THEME_KEY, mode); } catch (e) {} }
      if (btn) {
        var light = mode === 'light';
        btn.setAttribute('aria-checked', String(light));
        btn.setAttribute('aria-label', light ? 'Use dark theme' : 'Use light theme');
      }
      // keep the phone status bar in step with the page it is sitting above
      var m = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
      m.setAttribute('content', mode === 'light' ? '#EEF2F8' : '#04060B');

      window.dispatchEvent(new CustomEvent('kt:theme', { detail: { mode: mode } }));
    }

    apply(currentTheme(), false);

    if (btn) {
      btn.addEventListener('click', function () {
        apply(currentTheme() === 'light' ? 'dark' : 'light', true);
      });
    }
    // follow the system only while the reader has not chosen for themselves
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (e) {
        if (!stored()) apply(e.matches ? 'light' : 'dark', false);
      });
    }
  })();

  /* ---------------------------------------------------------------- menu */
  (function drawer() {
    var btn = document.getElementById('menuBtn');
    var panel = document.getElementById('drawer');
    if (!btn || !panel) return;

    function open(yes) {
      btn.setAttribute('aria-expanded', String(yes));
      btn.setAttribute('aria-label', yes ? 'Close menu' : 'Open menu');
      panel.hidden = !yes;
      document.body.style.overflow = yes ? 'hidden' : '';
      if (yes) {
        var first = panel.querySelector('a');
        if (first) first.focus();
      }
    }
    btn.addEventListener('click', function () {
      open(btn.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') open(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { open(false); btn.focus(); }
    });
    // a resize past the breakpoint should not leave the page scroll-locked
    window.addEventListener('resize', function () {
      if (window.innerWidth > 880 && btn.getAttribute('aria-expanded') === 'true') open(false);
    });
  })();

  /* ====================================================================== */
  /*  SKY                                                                   */
  /* ====================================================================== */
  (function sky() {
    var host = document.getElementById('sky');
    if (!host) return;

    /* Two layers, on purpose.

       The starfield never changes. It is painted once into an offscreen canvas,
       handed to a plain div as a background image, and then only ever moved with
       a transform. The compositor keeps it as a static layer, so it costs
       nothing per frame no matter what is drawn on top of it.

       The canvas above it carries just the things that actually move: a few
       twinkling stars, drifting dust, and the meteors. That is roughly eighty
       small operations a frame instead of five hundred, and it is what stopped
       the photo galleries re-compositing nineteen images sixty times a second. */
    var stars = document.createElement('div');
    stars.className = 'starfield';
    host.appendChild(stars);

    var cv = document.createElement('canvas');
    host.appendChild(cv);
    var g = cv.getContext('2d');

    var W = 0, H = 0, DPR = 1, TILE = 0;
    var shower = [], dust = [], twinklers = [];

    function bake() {
      TILE = Math.max(700, Math.round(H));
      var t = document.createElement('canvas');
      t.width = Math.round(W); t.height = TILE;
      var tg = t.getContext('2d');
      var n = Math.round(Math.min(520, (W * TILE) / 4200));
      for (var i = 0; i < n; i++) {
        var r = Math.pow(Math.random(), 2.3) * 1.5 + 0.24;
        var a = (0.34 + r * 0.46) * (0.55 + Math.random() * 0.45);
        tg.beginPath();
        tg.arc(Math.random() * W, Math.random() * TILE, r, 0, 6.2832);
        tg.fillStyle = 'rgba(' + (Math.random() > 0.78 ? '255,232,198' : '222,234,255') + ',' + a.toFixed(3) + ')';
        tg.fill();
      }
      stars.style.backgroundImage = 'url(' + t.toDataURL('image/png') + ')';
      stars.style.backgroundSize = W + 'px ' + TILE + 'px';
      stars.style.height = (TILE * 2) + 'px';

      twinklers = [];
      for (var k = 0; k < 30; k++) {
        twinklers.push({ x: Math.random(), y: Math.random(), r: 0.7 + Math.random() * 1.1,
          tw: Math.random() * 6.283, sp: 0.35 + Math.random() * 1.5, warm: Math.random() > 0.76 });
      }
      dust = [];
      for (var d = 0; d < 44; d++) {
        dust.push({ x: Math.random(), y: Math.random(), r: Math.random() * 0.9 + 0.2, v: 0.004 + Math.random() * 0.013 });
      }
    }

    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      bake();
    }
    size();
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 160); });

    // moving the field is a transform on a static layer, so it is compositor work
    function drift() {
      if (!TILE) return;
      stars.style.transform = 'translate3d(0,' + (-((window.scrollY * 0.055) % TILE)).toFixed(1) + 'px,0)';
    }
    window.addEventListener('scroll', drift, { passive: true });
    drift();

    function spawn() {
      var top = Math.random() < 0.6, sp = 250 + Math.random() * 560, mag = 0.3 + Math.random() * 0.7;
      shower.push({
        x: top ? Math.random() * W * 1.3 : W + 40,
        y: top ? -50 : Math.random() * H * 0.5,
        vx: -sp * (0.55 + Math.random() * 0.3), vy: sp * (0.72 + Math.random() * 0.3),
        life: 0, span: 1 + Math.random() * 1.6, mag: mag,
        tail: 66 + mag * 220, flare: 0.42 + Math.random() * 0.34
      });
    }

    var acc = 0, last = performance.now(), prev = 0;
    var FRAME = 1000 / 34;

    /* In daylight the stars and the shower are gone. The stylesheet hides the
       layers; this stops the work. Drawing eighty invisible sprites a second
       costs exactly as much as drawing eighty visible ones. */
    var night = currentTheme() === 'dark', wiped = false;
    window.addEventListener('kt:theme', function (e) {
      night = e.detail.mode === 'dark';
      if (night) { wiped = false; last = prev = performance.now(); }
    });

    (function draw(now) {
      requestAnimationFrame(draw);
      if (!night) {
        if (!wiped) { g.clearRect(0, 0, W, H); shower.length = 0; wiped = true; }
        return;
      }
      if (now - prev < FRAME) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now; prev = now;

      g.clearRect(0, 0, W, H);
      var phase = window.scrollY * 0.055;

      for (var i = 0; i < twinklers.length; i++) {
        var s = twinklers[i];
        var y = (s.y * H + phase * 0.5) % (H + 60) - 30;
        var tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(now / 1000 * s.sp + s.tw);
        g.beginPath(); g.arc(s.x * W, y, s.r, 0, 6.2832);
        g.fillStyle = 'rgba(' + (s.warm ? '255,232,198' : '222,234,255') + ',' + (tw * 0.8).toFixed(3) + ')';
        g.fill();
      }

      for (var d = 0; d < dust.length; d++) {
        var p = dust[d];
        p.y -= p.v * dt; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        g.beginPath();
        g.arc(p.x * W, ((p.y * H) + phase * 0.1) % (H + 40) - 20, p.r, 0, 6.2832);
        g.fillStyle = 'rgba(233,163,58,0.15)'; g.fill();
      }

      if (!reduce) { acc += dt; if (acc > 0.65 + Math.random() * 1.4) { acc = 0; spawn(); } }
      for (var m = shower.length - 1; m >= 0; m--) {
        var o = shower[m];
        o.life += dt / o.span;
        if (o.life >= 1 || o.y > H + 140 || o.x < -240) { shower.splice(m, 1); continue; }
        o.x += o.vx * dt; o.y += o.vy * dt;
        var e = Math.exp(-Math.pow((o.life - o.flare) / 0.26, 2)) * (1 - o.life * 0.35);
        var al = e * o.mag;
        if (al <= 0.004) continue;
        var len = o.tail * (0.45 + e * 0.55), nn = Math.hypot(o.vx, o.vy) || 1;
        var tx = o.x - o.vx / nn * len, ty = o.y - o.vy / nn * len;
        var gr = g.createLinearGradient(o.x, o.y, tx, ty);
        gr.addColorStop(0, 'rgba(255,244,214,' + (al * 0.95).toFixed(3) + ')');
        gr.addColorStop(0.28, 'rgba(233,163,58,' + (al * 0.5).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(233,163,58,0)');
        g.strokeStyle = gr; g.lineWidth = 0.7 + o.mag * 1.9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(o.x, o.y); g.stroke();
        g.fillStyle = 'rgba(255,244,214,' + (al * 0.9).toFixed(3) + ')';
        g.beginPath(); g.arc(o.x, o.y, 0.6 + o.mag * 1.5, 0, 6.2832); g.fill();
      }
    })(last);
  })();

  /* ====================================================================== */
  /*  DEPTH METER                                                           */
  /*  Same idea as version one, different instrument: the number is pinned  */
  /*  to the corner and names the boundary you are passing.                 */
  /* ====================================================================== */
  var dm = document.getElementById('dm'), dmLabel = document.getElementById('dmLabel');
  var railBar = document.getElementById('rail');
  var stops = [].slice.call(document.querySelectorAll('[data-depth]')).map(function (n) {
    return { node: n, d: parseFloat(n.dataset.depth), label: n.dataset.label || '' };
  });

  // The calculators page has no depths, so its meter counts tools instead of
  // kilometres. Labelling it "km" there would simply be a lie.
  var STEP_MODE = document.body.dataset.rail === 'step';

  var shown = 0, target = 0, easing = false;
  function ease() {
    shown += (target - shown) * 0.16;
    if (Math.abs(target - shown) < 0.6) { shown = target; easing = false; }
    else { easing = true; requestAnimationFrame(ease); }
    if (!dm) return;
    var v = Math.round(shown);
    dm.textContent = STEP_MODE ? String(v).padStart(2, '0') : v.toLocaleString('en-US');
  }

  function meter() {
    // the 404 page carries no depth sections at all
    if (!stops.length) { if (railBar) railBar.style.transform = 'scaleX(0)'; return; }
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var f = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    if (railBar) railBar.style.transform = 'scaleX(' + f.toFixed(4) + ')';

    var y = window.scrollY + window.innerHeight * 0.42, cur = stops[0], next = stops[0];
    for (var i = 0; i < stops.length; i++) {
      var top = stops[i].node.getBoundingClientRect().top + window.scrollY;
      if (y >= top) { cur = stops[i]; next = stops[Math.min(i + 1, stops.length - 1)]; }
    }
    var curTop = cur.node.getBoundingClientRect().top + window.scrollY;
    var nextTop = next.node.getBoundingClientRect().top + window.scrollY;
    var raw = nextTop > curTop ? Math.min(1, Math.max(0, (y - curTop) / (nextTop - curTop))) : 0;
    // hold the section's own depth, then ramp over its last third
    var t = STEP_MODE ? 0 : (raw < 0.66 ? 0 : (raw - 0.66) / 0.34);
    target = cur.d + (next.d - cur.d) * t;
    if (!easing) ease();
    if (dmLabel && dmLabel.textContent !== cur.label) dmLabel.textContent = cur.label;
  }
  var tick = false;
  window.addEventListener('scroll', function () {
    if (tick) return; tick = true;
    requestAnimationFrame(function () { meter(); tick = false; });
  }, { passive: true });
  window.addEventListener('resize', meter);
  meter();

  /* ====================================================================== */
  /*  SCROLL CHOREOGRAPHY                                                   */
  /* ====================================================================== */
  if (hasGSAP && !reduce) {

    /* --- the hero assembles, every width ------------------------------- */
    var lines = document.querySelectorAll('.hero h1 .ln > span');
    gsap.set(lines, { yPercent: 115 });
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(lines, { yPercent: 0, duration: 1.25, stagger: 0.12 })
      .from('.hero .kicker', { opacity: 0, y: 14, duration: 0.8 }, 0.1)
      .from('.hero .deck', { opacity: 0, y: 22, duration: 0.9 }, 0.45)
      .from('.hero .fact', { opacity: 0, y: 20, duration: 0.8, stagger: 0.08 }, 0.6)
      .from('.hero .cta .b', { opacity: 0, y: 18, duration: 0.7, stagger: 0.07 }, 0.75)
      .from('.scrollcue', { opacity: 0, duration: 0.8 }, 1.0);

    /* --- generic reveals, every width ---------------------------------- */
    gsap.utils.toArray('.up').forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    gsap.utils.toArray('.stag').forEach(function (group) {
      gsap.to(group.children, { opacity: 1, y: 0, duration: 0.85, ease: 'expo.out', stagger: 0.055,
        scrollTrigger: { trigger: group, start: 'top 86%' } });
    });
    // One batched trigger instead of one per figure. With two galleries that
    // is 1 trigger rather than 17, and the reveal is a plain `to` so it can
    // never inherit opacity 0 as its end value the way `from` did.
    ScrollTrigger.batch('.mason figure', {
      start: 'top 92%',
      onEnter: function (batch) {
        gsap.to(batch, { opacity: 1, y: 0, duration: 0.85, ease: 'expo.out',
                         stagger: 0.06, overwrite: true });
      }
    });

    /* --- the timeline draws its own line ------------------------------- */
    var line = document.getElementById('drawline');
    if (line) {
      gsap.to(line, { strokeDashoffset: 0, ease: 'none',
        scrollTrigger: { trigger: '.tline', start: 'top 80%', end: 'bottom 62%', scrub: 0.4 } });
    }

    /* --- collaborator marquee ------------------------------------------ */
    var mrow = document.getElementById('mrow');
    if (mrow) {
      mrow.innerHTML += mrow.innerHTML;
      gsap.to(mrow, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
    }

    /* ------------------------------------------------------------------ */
    /*  Pinned set pieces, wide screens only.                             */
    /*  Pinning a 100svh panel on a phone means the reader scrolls four    */
    /*  screens to read five short paragraphs, and iOS toolbars resize the */
    /*  viewport mid-pin. Below 881px these become ordinary stacked        */
    /*  sections instead, which is what the CSS already lays out.          */
    /* ------------------------------------------------------------------ */
    var mm = gsap.matchMedia();

    mm.add('(min-width: 881px)', function () {

      /* the hero drifts away rather than simply scrolling off */
      gsap.to('.hero-in', { yPercent: -14, opacity: 0.25, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.4 } });

      /* the ghost numerals drift */
      gsap.utils.toArray('.ghost').forEach(function (el) {
        gsap.fromTo(el, { yPercent: 12 }, { yPercent: -12, ease: 'none',
          scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
      });

      /* five-step sequence */
      var steps = gsap.utils.toArray('.step');
      var bars = gsap.utils.toArray('.stepbar i');
      if (steps.length) {
        gsap.set(steps, { opacity: 0, y: 26 });
        gsap.set(steps[0], { opacity: 1, y: 0 });
        if (bars[0]) bars[0].classList.add('on');

        var seq = gsap.timeline({
          scrollTrigger: {
            trigger: '.seq', start: 'top top', end: 'bottom bottom',
            pin: '.seq-pin', scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: function (self) {
              // progress already spans only the pinned stretch, start 'top top'
              // to end 'bottom bottom' is (sectionHeight - viewportHeight)
              var i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length * 0.999));
              steps.forEach(function (st, k) {
                gsap.to(st, { opacity: k === i ? 1 : 0, y: k === i ? 0 : 26, duration: 0.35, overwrite: true });
              });
              bars.forEach(function (bb, k) { bb.classList.toggle('on', k <= i); });
            }
          }
        });
        seq.to('#gWave', { opacity: 1, duration: 1 }, 0.9)
           .fromTo('#gWave g circle', { attr: { r: 0 } }, { attr: { r: 300 }, duration: 1.4, stagger: 0.1 }, 0.9)
           .to('#gVein', { opacity: 1, duration: 1 }, 2.0)
           .to('#gPhase', { opacity: 1, duration: 0.9 }, 3.0)
           .to('#gQuench', { opacity: 1, duration: 0.9 }, 4.0);

        gsap.utils.toArray('#gVein path').forEach(function (pth) {
          var L = pth.getTotalLength();
          gsap.set(pth, { strokeDasharray: L, strokeDashoffset: L });
          seq.to(pth, { strokeDashoffset: 0, duration: 1.1, ease: 'none' }, 2.0);
        });
      }

      /* horizontal rail of papers */
      var row = document.querySelector('.hrow');
      var htrack = document.querySelector('.htrack');
      if (row && htrack) {
        var travel = function () { return Math.max(0, row.scrollWidth - window.innerWidth + 80); };
        // the section must be exactly as tall as the sideways journey, or the
        // pin releases early and leaves a screen of empty space behind it
        var sizeTrack = function () { htrack.style.height = (window.innerHeight + travel()) + 'px'; };
        ScrollTrigger.addEventListener('refreshInit', sizeTrack);
        sizeTrack();

        gsap.to(row, { x: function () { return -travel(); }, ease: 'none',
          scrollTrigger: {
            trigger: '.htrack', start: 'top top', end: function () { return '+=' + travel(); },
            pin: '.hpin', scrub: 0.45, invalidateOnRefresh: true, anticipatePin: 1
          } });

        return function () {
          ScrollTrigger.removeEventListener('refreshInit', sizeTrack);
          htrack.style.height = '';
          gsap.set(row, { clearProps: 'transform' });
        };
      }
    });

    mm.add('(max-width: 880px)', function () {
      // stacked, so every step is simply visible
      gsap.set('.step', { clearProps: 'all' });
      gsap.utils.toArray('.stepbar i').forEach(function (bb) { bb.classList.add('on'); });
      ['#gWave', '#gVein', '#gPhase', '#gQuench'].forEach(function (sel) {
        var n = document.querySelector(sel); if (n) gsap.set(n, { opacity: 1 });
      });
      gsap.set('#gVein path', { clearProps: 'strokeDasharray,strokeDashoffset' });
    });

    /* Late-loading images change every trigger position. */
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }

  } else {
    // no GSAP, or the reader asked for less motion: show everything
    document.querySelectorAll('.up, .stag > *, .step, .mason figure').forEach(function (el) {
      el.style.opacity = 1; el.style.transform = 'none';
    });
    document.querySelectorAll('.hero h1 .ln > span').forEach(function (el) { el.style.transform = 'none'; });
    var dl = document.getElementById('drawline'); if (dl) dl.setAttribute('stroke-dashoffset', '0');
    ['#gWave', '#gVein', '#gPhase', '#gQuench'].forEach(function (sel) {
      var n = document.querySelector(sel); if (n) n.setAttribute('opacity', '1');
    });
    document.querySelectorAll('.stepbar i').forEach(function (b) { b.classList.add('on'); });
  }

  /* ====================================================================== */
  /*  THE MOON                                                              */
  /*  It does not sit in the hero. It crosses the entire document, so the   */
  /*  page reads as one continuous fall past a single body.                 */
  /* ====================================================================== */
  if (!window.THREE || !window.KTMoonMaps) return;

  var host = document.getElementById('sky');
  var maps = window.KTMoonMaps();
  var texA = new THREE.CanvasTexture(maps.albedo);
  var texN = new THREE.CanvasTexture(maps.normal);
  var texD = new THREE.CanvasTexture(maps.height);
  [texA, texN, texD].forEach(function (t) { t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; });

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0, 9);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // this class carries the stacking order in the stylesheet, and without it the
  // Moon and the sky were fighting over which sat on top
  renderer.domElement.className = 'moon-canvas';
  host.appendChild(renderer.domElement);

  var moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 200, 120),
    new THREE.MeshStandardMaterial({
      map: texA, normalMap: texN, normalScale: new THREE.Vector2(1.6, 1.6),
      displacementMap: texD, displacementScale: 0.06, displacementBias: -0.03,
      roughness: 1, metalness: 0
    })
  );
  moon.rotation.z = 0.14;
  var pivot = new THREE.Group();
  pivot.add(moon);
  scene.add(pivot);

  var sun = new THREE.DirectionalLight(0xFFF6E8, 3.2);
  sun.position.set(-5.5, 2.4, 3.0);
  scene.add(sun);
  var shine = new THREE.DirectionalLight(0x4C6BA8, 0.16);
  shine.position.set(4.5, -1.5, 1.5);
  scene.add(shine);
  var ambient = new THREE.AmbientLight(0xFFFFFF, 0.05);
  scene.add(ambient);

  /* A daytime moon is a real sight, so it stays. It is lit differently: the
     night sky puts almost nothing back into the shadowed limb, daylight
     fills it, and the whole disc sits back into the haze rather than
     glowing out of it. */
  var moonFade = 1;
  function relight(mode) {
    var day = mode === 'light';
    sun.intensity = day ? 2.1 : 3.2;
    shine.color.set(day ? 0xBFD2F0 : 0x4C6BA8);
    shine.intensity = day ? 0.55 : 0.16;
    ambient.intensity = day ? 0.46 : 0.05;
    moonFade = day ? 0.5 : 1;
  }
  relight(document.documentElement.getAttribute('data-theme'));
  window.addEventListener('kt:theme', function (e) { relight(e.detail.mode); });

  var mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('pointermove', function (e) {
    tmx = e.clientX / window.innerWidth - 0.5;
    tmy = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* Its path down the page. Four waypoints in view-space, interpolated by
     scroll: enters upper right, swings left and away, returns small and
     distant at the bottom. */
  /* The hero is the only place it is allowed to be a subject. After that it
     is scenery: a limb at the edge of the frame, dimmed, never over type. */
  /* By the time the reader is past the core to mantle boundary they are five
     thousand kilometres underground. A Moon hanging there makes no sense, and
     it is also a full-viewport WebGL layer sitting under the photo galleries,
     which forces every image above it to be re-composited on every frame. So
     it fades out as the descent deepens and the layer is then culled entirely.
     Measured: 49.9ms a frame through the galleries with it lit, 16.7ms without. */
  var PATH = [
    { at: 0.00, x:  4.15, y:  0.70, s: 0.92, o: 0.92 },
    { at: 0.14, x:  6.90, y:  1.35, s: 0.74, o: 0.62 },
    { at: 0.28, x:  1.60, y: -5.60, s: 0.68, o: 0.46 },
    { at: 0.42, x: -6.70, y: -0.95, s: 0.58, o: 0.42 },
    { at: 0.56, x: -1.40, y: -5.40, s: 0.52, o: 0.24 },
    { at: 0.68, x:  6.50, y:  0.70, s: 0.46, o: 0.05 },
    { at: 1.00, x: -5.60, y: -1.45, s: 0.36, o: 0.00 }
  ];
  function pathAt(f) {
    var i = 0;
    for (var k = 0; k < PATH.length - 1; k++) if (f >= PATH[k].at) i = k;
    var a = PATH[i], b = PATH[Math.min(i + 1, PATH.length - 1)];
    var span = (b.at - a.at) || 1;
    var t = Math.min(1, Math.max(0, (f - a.at) / span));
    t = t * t * (3 - 2 * t);                                  // smoothstep
    return {
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
      s: a.s + (b.s - a.s) * t, o: a.o + (b.o - a.o) * t
    };
  }

  var BASE_DPR = Math.min(window.devicePixelRatio || 1, 1.5), curDPR = BASE_DPR;
  var _v = new THREE.Vector3(), _e = new THREE.Vector3(), moonShown = true;
  var f = 0, t0 = performance.now(), lastMoon = 0;
  (function loop(now) {
    var t = (now - t0) / 1000;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var target = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    f += (target - f) * 0.07;
    mx += (tmx - mx) * 0.045;
    my += (tmy - my) * 0.045;

    // On narrow screens there is no margin to hide in, so it goes further
    // out and gets smaller rather than sliding over the text.
    var narrow = window.innerWidth < 900;
    var p = pathAt(f);
    pivot.position.set(p.x * (narrow ? 1.25 : 1) + mx * 0.6, p.y - my * 0.45, 0);
    pivot.scale.setScalar(p.s * (narrow ? 0.5 : 0.92));
    renderer.domElement.style.opacity = (p.o * (narrow ? 0.62 : 1) * moonFade).toFixed(3);

    if (!reduce) {
      moon.rotation.y = t * 0.026 + f * 2.2;
      pivot.rotation.z = Math.sin(t * 0.1) * 0.03;
    } else {
      moon.rotation.y = 0.6;
    }

    camera.lookAt(0, 0, 0);

    /* The Moon is a full-viewport WebGL layer, and everything drawn above it
       has to be re-composited each time it renders. In the hero it deserves
       full resolution. Past that it is a small dim body at the edge of the
       frame, so it drops to a quarter of the pixels and nobody can tell. */
    var wantDPR = f < 0.16 ? BASE_DPR : (f < 0.4 ? 1 : 0.7);
    if (wantDPR !== curDPR) {
      curDPR = wantDPR;
      renderer.setPixelRatio(curDPR);
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /* Cull it properly. Its path takes it right out of frame for long
       stretches, and a hidden layer is not composited at all, whereas an
       opacity-zero one still is. */
    var centre = _v.copy(pivot.position).project(camera);
    var edge = _e.set(pivot.position.x + 2.1 * pivot.scale.x, pivot.position.y, 0).project(camera);
    var rad = Math.abs(edge.x - centre.x) + 0.02;
    var onScreen = Math.abs(centre.x) - rad < 1 && Math.abs(centre.y) - rad * (window.innerWidth / window.innerHeight) < 1;
    var vis = parseFloat(renderer.domElement.style.opacity || '1');
    var show = onScreen && vis > 0.06;

    if (show !== moonShown) {
      moonShown = show;
      renderer.domElement.style.visibility = show ? 'visible' : 'hidden';
    }
    if (show && (now - lastMoon) > 22) { renderer.render(scene, camera); lastMoon = now; }
    requestAnimationFrame(loop);
  })(performance.now());
})();
