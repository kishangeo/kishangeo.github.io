/* ==========================================================================
   ktiwari.com

   Four things live here:
     1. the theme switch
     2. the depth rail, whose ticks sit where their sections actually sit
     3. scroll-triggered reveals
     4. the sky, a starfield and meteor shower behind every section, plus a
        WebGL Moon in the hero

   The sky and the Moon both read the CSS tokens, so they repaint themselves
   when the reader flips between light and dark.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var PI = Math.PI;

  // gate the reveal CSS, so the page is fully readable with JavaScript off
  root.classList.add('js');

  /* ---------------------------------------------------------------- theme */
  var STORE = 'kt-theme';
  var btn = document.getElementById('themeBtn');
  var btnLabel = btn && btn.querySelector('.lbl');
  var themeHooks = [];

  function systemDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t === 'dark' || (!t && systemDark());
  }
  function paintButton() {
    if (!btn) return;
    var dark = isDark();
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('title', dark ? 'Switch to light' : 'Switch to dark');
    if (btnLabel) btnLabel.textContent = dark ? 'Light' : 'Dark';
  }
  function retheme() { themeHooks.forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function setTheme(t) {
    if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    try { t ? localStorage.setItem(STORE, t) : localStorage.removeItem(STORE); } catch (e) {}
    paintButton(); retheme();
  }
  try {
    var saved = localStorage.getItem(STORE);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) {}
  paintButton();
  if (btn) btn.addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!root.getAttribute('data-theme')) { paintButton(); retheme(); }
  });

  /* ------------------------------------------------------------ depth rail
     The rail is not a linear ruler from 0 to 6371 km. Each tick is pinned to
     the scroll position of the section that carries that depth, so when the
     reader is looking at the 660 km section the rail reads 660. The eyebrow
     on every section heading names the same number.
     ---------------------------------------------------------------------- */
  var track = document.getElementById('track');
  var probe = document.getElementById('probe');
  var readout = document.getElementById('depthNow');
  var marks = [];

  // The calculations page has no depths, so its rail counts sections instead
  // of kilometres. Labelling it "km" there would be a lie.
  var STEP_MODE = document.body && document.body.dataset.rail === 'step';

  function label(d) {
    if (STEP_MODE) return String(d).padStart(2, '0');
    if (d >= 1000) {
      var k = d / 1000;
      return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'k';
    }
    return String(d);
  }

  function buildRail() {
    if (!track) return;
    var nodes = [].slice.call(document.querySelectorAll('[data-depth]'));
    if (!nodes.length) return;

    marks.forEach(function (m) { m.el.remove(); });
    marks = [];

    var docH = document.documentElement.scrollHeight - window.innerHeight;
    nodes.forEach(function (n) {
      var d = parseFloat(n.dataset.depth);
      var top = n.getBoundingClientRect().top + window.scrollY;
      var f = docH > 0 ? Math.min(1, Math.max(0, (top - 90) / docH)) : 0;
      var el = document.createElement('div');
      el.className = 'tick';
      el.style.top = (f * 100) + '%';
      el.innerHTML = '<span>' + label(d) + '</span>';
      track.appendChild(el);
      marks.push({ el: el, d: d, f: f, node: n });
    });
    marks.sort(function (a, b) { return a.f - b.f; });
    updateRail();
  }

  function frac() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
  }

  /* The readout eases toward the true depth in its own frame loop. Driving
     it from the scroll handler alone left it stranded mid-count whenever the
     reader stopped moving. */
  var shownDepth = 0, targetDepth = 0, easing = false;
  function easeReadout() {
    if (!readout) return;
    var d = targetDepth - shownDepth;
    shownDepth += d * 0.18;
    if (Math.abs(targetDepth - shownDepth) < 0.5) { shownDepth = targetDepth; easing = false; }
    else { easing = true; requestAnimationFrame(easeReadout); }
    var v = Math.round(shownDepth);
    readout.textContent = v >= 1000 ? v.toLocaleString('en-US') : String(v);
  }

  function updateRail() {
    if (!marks.length) return;
    var f = frac();
    if (probe) probe.style.top = (f * 100) + '%';

    var i = 0;
    for (var k = 0; k < marks.length; k++) if (f >= marks[k].f - 0.002) i = k;
    var a = marks[i], b = marks[Math.min(i + 1, marks.length - 1)];
    var span = (b.f - a.f) || 1;
    var t = Math.min(1, Math.max(0, (f - a.f) / span));
    var depth = a.d + (b.d - a.d) * t;

    for (var j = 0; j < marks.length; j++) marks[j].el.classList.toggle('on', j === i);

    if (readout && !STEP_MODE) {
      targetDepth = depth;
      if (!easing) easeReadout();
    }
  }

  /* --------------------------------------------------------------- reveals
     Everything is legible with JavaScript off and at first paint. These add
     movement on arrival, they never hide content.
     ---------------------------------------------------------------------- */
  if (!reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var kids = el.querySelectorAll(':scope > *');
        if (el.hasAttribute('data-stagger')) {
          [].forEach.call(kids, function (c, i) {
            c.style.transitionDelay = Math.min(i * 55, 460) + 'ms';
          });
        }
        el.classList.add('seen');
        io.unobserve(el);
      });
    }, { rootMargin: '-6% 0px -10% 0px' });
    document.querySelectorAll('.rv, [data-stagger]').forEach(function (el) { io.observe(el); });

    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, to = parseFloat(el.dataset.count), pad = parseInt(el.dataset.pad || '1', 10), t0 = null;
        (function step(now) {
          if (!t0) t0 = now;
          var p = Math.min(1, (now - t0) / 900);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(to * eased)).padStart(pad, '0');
          if (p < 1) requestAnimationFrame(step);
        })(performance.now());
        cio.unobserve(el);
      });
    }, { rootMargin: '-10% 0px' });
    document.querySelectorAll('[data-count]').forEach(function (el) { cio.observe(el); });
  } else {
    document.querySelectorAll('.rv, [data-stagger]').forEach(function (el) { el.classList.add('seen'); });
  }

  var paraEls = reduce ? [] : [].slice.call(document.querySelectorAll('[data-parallax]'));
  function parallax() {
    var vh = window.innerHeight;
    paraEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) return;
      var mid = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.setProperty('--py', (mid * parseFloat(el.dataset.parallax)).toFixed(2) + 'px');
    });
  }

  var bar = document.getElementById('progress');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateRail();
      parallax();
      if (bar) bar.style.transform = 'scaleX(' + frac().toFixed(4) + ')';
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { buildRail(); parallax(); });
  window.addEventListener('load', function () { buildRail(); parallax(); });
  buildRail(); parallax();
  if (bar) bar.style.transform = 'scaleX(' + frac().toFixed(4) + ')';

  /* ====================================================================== */
  /*  THE SKY                                                               */
  /*  One fixed layer behind the whole document: stars, slow dust, meteors. */
  /*  It is not confined to the hero. Every section is a pane of glass on   */
  /*  top of it.                                                            */
  /* ====================================================================== */
  var stage = document.getElementById('stage');
  if (!stage) return;

  (function sky() {
    var cv = document.createElement('canvas');
    cv.className = 'sky-canvas';
    stage.appendChild(cv);
    var g = cv.getContext('2d');
    var W = 0, H = 0, DPR = 1;
    var stars = [], dust = [], shower = [];

    function seed() {
      stars = [];
      var n = Math.round(Math.min(430, (W * H) / 5000));
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random(), y: Math.random(),
          r: Math.pow(Math.random(), 2.2) * 1.5 + 0.25,
          tw: Math.random() * PI * 2,
          sp: 0.4 + Math.random() * 1.6,
          warm: Math.random() > 0.76
        });
      }
      dust = [];
      for (var j = 0; j < 70; j++) {
        dust.push({ x: Math.random(), y: Math.random(), r: Math.random() * 0.9 + 0.2, v: 0.004 + Math.random() * 0.012 });
      }
    }

    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }
    size();
    window.addEventListener('resize', size);

    function spawn() {
      var fromTop = Math.random() < 0.6;
      var speed = 240 + Math.random() * 540;
      var mag = 0.32 + Math.random() * 0.68;
      shower.push({
        x: fromTop ? Math.random() * W * 1.3 : W + 40,
        y: fromTop ? -50 : Math.random() * H * 0.5,
        vx: -speed * (0.55 + Math.random() * 0.3),
        vy: speed * (0.72 + Math.random() * 0.3),
        life: 0, span: 1.0 + Math.random() * 1.6,
        mag: mag, tail: 60 + mag * 210,
        flare: 0.42 + Math.random() * 0.34
      });
    }

    var acc = 0, last = performance.now();

    (function draw(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var dark = isDark();
      g.clearRect(0, 0, W, H);

      // the field drifts with the page, so scrolling reads as descending
      var phase = window.scrollY * 0.06;

      /* stars. In daylight they are still there, you simply cannot normally
         see them. From altitude you can, faintly. That is the light theme. */
      var starA = dark ? 1 : 0.34;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var y = (s.y * H + phase * (0.25 + s.r * 0.5)) % (H + 60) - 30;
        var tw = reduce ? 1 : 0.62 + 0.38 * Math.sin(now / 1000 * s.sp + s.tw);
        var al = tw * starA * (0.35 + s.r * 0.45);
        if (al < 0.012) continue;
        g.beginPath();
        g.arc(s.x * W, y, s.r, 0, 6.2832);
        g.fillStyle = dark
          ? 'rgba(' + (s.warm ? '255,232,196' : '226,236,255') + ',' + al.toFixed(3) + ')'
          : 'rgba(62,74,104,' + (al * 0.92).toFixed(3) + ')';
        g.fill();
      }

      /* suspended dust */
      for (var d = 0; d < dust.length; d++) {
        var p = dust[d];
        p.y -= p.v * dt;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        g.beginPath();
        g.arc(p.x * W, ((p.y * H) + phase * 0.12) % (H + 40) - 20, p.r, 0, 6.2832);
        g.fillStyle = dark ? 'rgba(200,151,31,0.16)' : 'rgba(120,110,90,0.10)';
        g.fill();
      }

      /* meteors */
      if (!reduce) {
        acc += dt;
        if (acc > 0.7 + Math.random() * 1.5) { acc = 0; spawn(); }
      }
      var head = dark ? '255,242,210' : '86,66,24';
      var tailc = dark ? '224,179,60' : '146,104,16';
      var gain = dark ? 1 : 0.62;

      for (var m = shower.length - 1; m >= 0; m--) {
        var o = shower[m];
        o.life += dt / o.span;
        if (o.life >= 1 || o.y > H + 140 || o.x < -240) { shower.splice(m, 1); continue; }
        o.x += o.vx * dt; o.y += o.vy * dt;

        // ablation: dark, flare, gone
        var e = Math.exp(-Math.pow((o.life - o.flare) / 0.26, 2)) * (1 - o.life * 0.35);
        var a2 = e * o.mag * gain;
        if (a2 <= 0.004) continue;

        var len = o.tail * (0.45 + e * 0.55);
        var n = Math.hypot(o.vx, o.vy) || 1;
        var tx = o.x - o.vx / n * len, ty = o.y - o.vy / n * len;

        var grad = g.createLinearGradient(o.x, o.y, tx, ty);
        grad.addColorStop(0, 'rgba(' + head + ',' + (a2 * 0.95).toFixed(3) + ')');
        grad.addColorStop(0.28, 'rgba(' + tailc + ',' + (a2 * 0.5).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(' + tailc + ',0)');
        g.strokeStyle = grad;
        g.lineWidth = 0.7 + o.mag * 1.9;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(o.x, o.y); g.stroke();

        g.fillStyle = 'rgba(' + head + ',' + (a2 * 0.9).toFixed(3) + ')';
        g.beginPath(); g.arc(o.x, o.y, 0.6 + o.mag * 1.5, 0, 6.2832); g.fill();
      }

      requestAnimationFrame(draw);
    })(last);
  })();

  /* ====================================================================== */
  /*  THE MOON                                                              */
  /*  Built from generated maps rather than vertex colours: a height field  */
  /*  of maria and craters, an albedo map derived from it, and a normal map */
  /*  taken from its gradient. One hard sun and almost no fill. That last   */
  /*  part is what actually sells it as a body lit by a star.               */
  /* ====================================================================== */
  if (!window.THREE) return;

  var maps = window.KTMoonMaps();
  var texA = new THREE.CanvasTexture(maps.albedo);
  var texN = new THREE.CanvasTexture(maps.normal);
  var texD = new THREE.CanvasTexture(maps.height);
  [texA, texN, texD].forEach(function (t) { t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; });

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 0, 8.6);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.className = 'moon-canvas';
  stage.appendChild(renderer.domElement);

  var R = 2.0;
  var moonMat = new THREE.MeshStandardMaterial({
    map: texA,
    normalMap: texN,
    normalScale: new THREE.Vector2(1.5, 1.5),
    displacementMap: texD,
    displacementScale: 0.055,
    displacementBias: -0.0275,
    roughness: 1.0,
    metalness: 0.0
  });
  var moon = new THREE.Mesh(new THREE.SphereGeometry(R, 200, 120), moonMat);
  moon.rotation.z = 0.12;

  var pivot = new THREE.Group();
  pivot.add(moon);
  scene.add(pivot);

  function placeMoon() {
    var w = window.innerWidth;
    // On a phone there is no margin to sit in, so it moves up and mostly out
    // of frame rather than floating over the paragraph.
    if (w <= 820) {
      pivot.position.set(1.45, 2.05, 0);
      pivot.scale.setScalar(0.52);
      narrowMoon = true;
    } else {
      pivot.position.set(w > 1180 ? 3.25 : 2.2, 0.45, 0);
      pivot.scale.setScalar(w > 1180 ? 0.86 : 0.74);
      narrowMoon = false;
    }
  }
  var narrowMoon = false;
  placeMoon();

  /* One sun, hard. The fill stays tiny so the night side goes properly
     black, which is the thing that sells it. Earthshine is a whisper. */
  var sun = new THREE.DirectionalLight(0xFFF6E8, 3.1);
  sun.position.set(-5.5, 2.4, 3.2);
  scene.add(sun);
  var earthshine = new THREE.DirectionalLight(0x4C6BA8, 0.14);
  earthshine.position.set(4.5, -1.5, 1.5);
  scene.add(earthshine);
  var amb = new THREE.AmbientLight(0xFFFFFF, 0.04);
  scene.add(amb);

  themeHooks.push(function () {
    var dark = isDark();
    // against a pale sky the terminator has to soften, or the body reads as
    // a hole punched through the page
    sun.intensity = dark ? 3.1 : 2.55;
    earthshine.intensity = dark ? 0.14 : 0.30;
    amb.intensity = dark ? 0.04 : 0.20;
  });
  retheme();

  var mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('pointermove', function (e) {
    tmx = e.clientX / window.innerWidth - 0.5;
    tmy = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    placeMoon();
  });

  var f = 0, t0 = performance.now();
  (function tick(now) {
    var t = (now - t0) / 1000;
    f += (frac() - f) * 0.075;
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;

    if (!reduce) {
      moon.rotation.y = t * 0.028 + f * 1.35;      // slow, like the real one
      pivot.rotation.x = Math.sin(t * 0.12) * 0.02;
    } else {
      moon.rotation.y = 0.6;
    }

    camera.position.z = 8.6 + f * 13;
    camera.position.x = mx * 0.8;
    camera.position.y = -my * 0.55 + f * 1.1;
    camera.lookAt(0, 0, 0);

    var peak = narrowMoon ? 0.42 : 1.0;
    renderer.domElement.style.opacity = String((0.22 + (1 - Math.min(1, f * 2.2)) * 0.78) * peak);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })(performance.now());
})();
