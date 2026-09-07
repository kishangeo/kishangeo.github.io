/* ==========================================================================
   ktiwari.com — depth rail, reveals, and the WebGL meteorite.
   The 3D scene reads the CSS theme tokens, so it re-lights itself
   when the visitor flips between light and dark.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------------------------------------------------------------- theme */
  var STORE = 'kt-theme';
  var btn = document.getElementById('themeBtn');
  var btnLabel = btn && btn.querySelector('.lbl');

  function systemDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
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
  function setTheme(t) {
    if (t) root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    try { t ? localStorage.setItem(STORE, t) : localStorage.removeItem(STORE); } catch (e) {}
    paintButton();
    if (window.__ktScene) window.__ktScene.retheme();
  }
  try {
    var saved = localStorage.getItem(STORE);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) {}
  paintButton();
  if (btn) btn.addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!root.getAttribute('data-theme')) { paintButton(); if (window.__ktScene) window.__ktScene.retheme(); }
  });

  /* ------------------------------------------------------------ depth rail */
  var DEPTHS = [0, 100, 200, 300, 410, 520, 660, 700];
  var track = document.getElementById('track');
  var probe = document.getElementById('probe');
  var ticks = [];

  DEPTHS.forEach(function (d) {
    var t = document.createElement('div');
    t.className = 'tick';
    t.style.top = (d / 700 * 100) + '%';
    t.innerHTML = '<span>' + d + '</span>';
    track.appendChild(t);
    ticks.push({ el: t, d: d });
  });

  function frac() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
  }
  function updateRail() {
    var f = frac();
    probe.style.top = (f * 100) + '%';
    var km = f * 700, best = null, bd = 1e9;
    ticks.forEach(function (t) {
      var dd = Math.abs(t.d - km);
      if (dd < bd) { bd = dd; best = t; }
      t.el.classList.remove('on');
    });
    if (best && bd < 60) best.el.classList.add('on');
  }

  /* --------------------------------------------------------------- reveals */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
    });
  }, { rootMargin: '-8% 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });

  /* ------------------------------------------------------------- the rock */
  var stage = document.getElementById('stage');
  if (!window.THREE || !stage) { updateRail(); window.addEventListener('scroll', updateRail, { passive: true }); return; }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 7.2);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  stage.appendChild(renderer.domElement);

  /* value noise --------------------------------------------------------- */
  function hash(x, y, z) { var n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y, z) {
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    var fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    function c(a, b, d) { return hash(ix + a, iy + b, iz + d); }
    return lerp(
      lerp(lerp(c(0,0,0), c(1,0,0), fx), lerp(c(0,1,0), c(1,1,0), fx), fy),
      lerp(lerp(c(0,0,1), c(1,0,1), fx), lerp(c(0,1,1), c(1,1,1), fx), fy), fz);
  }
  function fbm(x, y, z) {
    var v = 0, a = 0.5, f = 1;
    for (var i = 0; i < 5; i++) { v += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
    return v;
  }

  /* ------------------------------------------------------------------------
     101955 Bennu.

     Not a sphere with noise on it. Bennu is a rubble pile with a specific,
     well-documented shape: an oblate "spinning top" whose rotation has piled
     material into a pronounced equatorial ridge, ~565 x 535 x 508 m, with a
     surface covered in boulders and shallow craters. Built here from that
     morphology — flattening, ridge, boulders, craters, regolith grain — with
     the shock-vein network of the site's own subject burning through it.
     ------------------------------------------------------------------------ */

  function rnd(seed) { var s = Math.sin(seed * 12.9898) * 43758.5453; return s - Math.floor(s); }

  // Scattered surface features, placed on the unit sphere.
  var BOULDERS = [], CRATERS = [];
  (function seedFeatures() {
    var i, u, v, st, ct, ph;
    for (i = 0; i < 34; i++) {                    // boulders — Bennu is strewn with them
      u = rnd(i * 3.1 + 1); v = rnd(i * 7.7 + 2);
      ph = Math.acos(2 * u - 1); st = v * Math.PI * 2;
      BOULDERS.push({
        d: new THREE.Vector3(Math.sin(ph) * Math.cos(st), Math.cos(ph), Math.sin(ph) * Math.sin(st)),
        r: 0.045 + rnd(i * 5.3 + 3) * 0.085,      // angular radius
        h: 0.022 + rnd(i * 9.1 + 4) * 0.052       // height above the datum
      });
    }
    for (i = 0; i < 16; i++) {                    // shallow craters, with raised rims
      u = rnd(i * 4.7 + 40); v = rnd(i * 8.3 + 41);
      ph = Math.acos(2 * u - 1); st = v * Math.PI * 2;
      CRATERS.push({
        d: new THREE.Vector3(Math.sin(ph) * Math.cos(st), Math.cos(ph), Math.sin(ph) * Math.sin(st)),
        r: 0.10 + rnd(i * 6.1 + 42) * 0.20,
        h: 0.016 + rnd(i * 2.9 + 43) * 0.030
      });
    }
  })();

  var _n = new THREE.Vector3();
  function bennuRadius(nx, ny, nz) {
    _n.set(nx, ny, nz);
    var lat = Math.asin(Math.max(-1, Math.min(1, ny)));
    var s = Math.sin(lat);

    var r = 1;
    r *= 1 - 0.105 * s * s;                                  // oblate: polar flattening
    r += 0.082 * Math.exp(-(lat / 0.30) * (lat / 0.30));      // the equatorial ridge
    r += (fbm(nx * 1.7 + 4, ny * 1.7 - 2, nz * 1.7 + 9) - 0.5) * 0.085;  // rubble-pile lumpiness

    var i, f, d, t;
    for (i = 0; i < CRATERS.length; i++) {                    // bowl + rim
      f = CRATERS[i]; d = Math.acos(Math.max(-1, Math.min(1, _n.dot(f.d))));
      if (d < f.r * 1.35) {
        t = d / f.r;
        if (t < 1) r -= f.h * (1 - t * t) * 0.85;
        else r += f.h * 0.30 * Math.exp(-Math.pow((t - 1) / 0.30, 2));
      }
    }
    for (i = 0; i < BOULDERS.length; i++) {                   // boulders sitting proud
      f = BOULDERS[i]; d = Math.acos(Math.max(-1, Math.min(1, _n.dot(f.d))));
      if (d < f.r) { t = d / f.r; r += f.h * Math.pow(1 - t * t, 1.4); }
    }

    r += (fbm(nx * 6.2 - 5, ny * 6.2 + 9, nz * 6.2 - 2) - 0.5) * 0.045;   // coarse regolith
    r += (fbm(nx * 19 + 2, ny * 19 - 8, nz * 19 + 5) - 0.5) * 0.016;      // fine grain
    return r;
  }

  var R0 = 1.62;
  // PolyhedronGeometry subdivides as 20*(detail+1)^2 faces, not 4^detail.
  var geo = new THREE.IcosahedronGeometry(R0, 30);
  var pos = geo.attributes.position;
  var N = pos.count;
  var veinMask = new Float32Array(N);
  var craterMask = new Float32Array(N);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));

  for (var i = 0; i < N; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    var len = Math.sqrt(x * x + y * y + z * z);
    var nx = x / len, ny = y / len, nz = z / len;

    var rad = bennuRadius(nx, ny, nz);
    pos.setXYZ(i, nx * R0 * rad, ny * R0 * rad, nz * R0 * rad);

    // ridged noise: bright only in a narrow band around the mid-value,
    // which is what makes veins read as thin filaments instead of blotches.
    var r = fbm(nx * 4.2 + 30, ny * 4.2 - 14, nz * 4.2 + 21);
    var ridge = 1 - Math.abs(r - 0.5) * 2;
    veinMask[i] = Math.pow(Math.max(0, (ridge - 0.948) / 0.052), 1.5);
    craterMask[i] = Math.max(0, Math.min(1, (rad - 0.90) / 0.24));   // high ground catches the light
  }
  geo.computeVertexNormals();

  // The geometry is non-indexed, so computeVertexNormals gives per-face (flat)
  // normals. Bend them back toward the radial direction: mostly smooth shading,
  // with enough of the facet normal left in to keep the surface reading as rock.
  (function smoothNormals() {
    var nrm = geo.attributes.normal, np = geo.attributes.position;
    var v = new THREE.Vector3(), rv = new THREE.Vector3();
    for (var q = 0; q < np.count; q++) {
      rv.set(np.getX(q), np.getY(q), np.getZ(q)).normalize();
      v.set(nrm.getX(q), nrm.getY(q), nrm.getZ(q));
      v.lerp(rv, 0.68).normalize();
      nrm.setXYZ(q, v.x, v.y, v.z);
    }
    nrm.needsUpdate = true;
  })();

  var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.04 });
  var rock = new THREE.Mesh(geo, mat);
  scene.add(rock);

  // Keep the body clear of the text column on wide screens; centre it on narrow ones.
  var pivot = new THREE.Group();
  scene.add(pivot);
  pivot.add(rock);
  function placeRock() {
    var w = window.innerWidth;
    pivot.position.set(w > 1100 ? 2.55 : w > 760 ? 1.7 : 0.5, w > 760 ? 0.35 : -0.4, 0);
    var s = w > 1100 ? 1 : w > 760 ? 0.85 : 0.62;
    pivot.scale.setScalar(s);
  }
  pivot.rotation.z = -0.16;
  placeRock();

  /* glowing vein points, lifted just off the surface --------------------- */
  var vIdx = [], vPos = [];
  for (var j = 0; j < N; j++) {
    if (veinMask[j] > 0.55) {
      vIdx.push(j);
      vPos.push(pos.getX(j) * 1.012, pos.getY(j) * 1.012, pos.getZ(j) * 1.012);
    }
  }
  var vgeo = new THREE.BufferGeometry();
  vgeo.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  vgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vIdx.length * 3), 3));
  var veins = new THREE.Points(vgeo, new THREE.PointsMaterial({
    size: 0.012, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  rock.add(veins);

  /* debris ring ---------------------------------------------------------- */
  var dp = [];
  for (var k = 0; k < 900; k++) {
    var a = Math.random() * Math.PI * 2, rr = 3.1 + Math.random() * 2.6;
    dp.push(Math.cos(a) * rr, (Math.random() - 0.5) * 0.55, Math.sin(a) * rr);
  }
  var dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  var debrisMat = new THREE.PointsMaterial({ size: 0.024, transparent: true, opacity: 0.55, depthWrite: false });
  var debris = new THREE.Points(dgeo, debrisMat);
  debris.rotation.x = 0.42; debris.rotation.z = -0.18;
  pivot.add(debris);

  /* starfield — dark theme only ----------------------------------------- */
  var sp = [];
  for (var s2 = 0; s2 < 1400; s2++) {
    var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), R = 34 + Math.random() * 24;
    sp.push(R * Math.sin(ph) * Math.cos(th), R * Math.sin(ph) * Math.sin(th), R * Math.cos(ph));
  }
  var sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  var starsMat = new THREE.PointsMaterial({ size: 0.12, transparent: true, opacity: 0.55, depthWrite: false });
  var stars = new THREE.Points(sgeo, starsMat);
  scene.add(stars);

  /* lights --------------------------------------------------------------- */
  var key = new THREE.DirectionalLight(0xFFF3DC, 2.5); key.position.set(5, 3.2, 4.5); scene.add(key);
  var fill = new THREE.DirectionalLight(0x6E96EE, 0.42); fill.position.set(-5, -1.5, -3); scene.add(fill);
  var amb = new THREE.AmbientLight(0xFFFFFF, 0.55); scene.add(amb);
  var glow = new THREE.PointLight(0xD4A72C, 0.55, 9); glow.position.set(-1.2, 0.9, 2.2); scene.add(glow);

  /* ------------------------------------------------- theme-driven repaint */
  var cA = new THREE.Color(), cB = new THREE.Color(), cV = new THREE.Color(), tmp = new THREE.Color();

  function retheme() {
    var dark = isDark();

    // Meteorites are dark rocks. On paper they need to lift a little
    // or they read as a hole punched in the page.
    cA.set(dark ? 0x0B0E13 : 0x171512);   // shadowed side (Bennu's albedo is ~4.4%)
    cB.set(dark ? 0x3A362E : 0x4E463A);   // sunlit regolith
    cV.set(dark ? 0xE0B33C : 0xC8971F);   // vein gold
    var ringC = new THREE.Color(dark ? 0x6E96EE : 0x2A4FB0);

    var col = geo.attributes.color.array;
    for (var i = 0; i < N; i++) {
      tmp.copy(cA).lerp(cB, craterMask[i]);
      tmp.lerp(ringC, veinMask[i] * 0.45);
      tmp.lerp(cV, veinMask[i] * 0.72);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.attributes.color.needsUpdate = true;

    var vc = vgeo.attributes.color.array;
    for (var p = 0; p < vIdx.length; p++) {
      var m = veinMask[vIdx[p]];
      tmp.copy(cV).lerp(ringC, 0.25).multiplyScalar(dark ? (0.5 + m * 0.7) : (0.75 + m * 0.55));
      vc[p * 3] = tmp.r; vc[p * 3 + 1] = tmp.g; vc[p * 3 + 2] = tmp.b;
    }
    vgeo.attributes.color.needsUpdate = true;

    // On paper: no stars, a subtler ring, softer key, much stronger ambient.
    stars.visible = dark;
    debrisMat.color.set(dark ? 0xE8E4DC : 0x9A8E78);
    debrisMat.opacity = dark ? 0.5 : 0.42;
    debrisMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    veins.material.opacity = dark ? 0.62 : 0.34;
    veins.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    starsMat.color.set(0xE8E4DC);

    key.intensity = dark ? 1.55 : 1.35;
    key.color.set(dark ? 0xFFF6E4 : 0xFFFDF7);
    fill.color.set(dark ? 0x6E96EE : 0x9DB4E8);
    fill.intensity = dark ? 0.42 : 0.55;
    amb.color.set(dark ? 0x33405A : 0xEDE6DA);
    amb.intensity = dark ? 0.50 : 0.95;
    glow.color.set(dark ? 0xD4A72C : 0xC8971F);

    mat.roughness = dark ? 0.95 : 0.92;

    var fogHex = dark ? 0x0E1116 : 0xFBF8F2;
    scene.fog = new THREE.FogExp2(fogHex, dark ? 0.055 : 0.038);
    mat.needsUpdate = true;
  }
  window.__ktScene = { retheme: retheme };
  retheme();


  /* ------------------------------------------------------------------------
     Falling meteorites — a 2D layer behind the whole page, not just the hero.
     Sparse and slow on purpose: this is a background, not a screensaver.
     Every streak is one body ablating, so it brightens, peaks, then dies.
     ------------------------------------------------------------------------ */
  (function meteorShower() {
    if (reduce) return;
    var cv = document.createElement('canvas');
    cv.id = 'meteors';
    stage.appendChild(cv);
    var g = cv.getContext('2d');
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio, 2);

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    var shower = [];
    function spawn() {
      // enter from the top edge or the right edge, fall down-left
      var fromTop = Math.random() < 0.62;
      var ang = (Math.PI * 0.5) + 0.30 + Math.random() * 0.34;   // steeply down-left
      var speed = 260 + Math.random() * 520;                      // px/s
      var mag = 0.35 + Math.random() * 0.65;                      // brightness / size
      shower.push({
        x: fromTop ? Math.random() * W * 1.25 : W + 40,
        y: fromTop ? -40 : Math.random() * H * 0.55,
        vx: -Math.cos(ang - Math.PI * 0.5) * speed - speed * 0.55,
        vy: Math.sin(ang) * speed,
        life: 0,
        span: 1.1 + Math.random() * 1.5,
        mag: mag,
        tail: 60 + mag * 190,
        flare: 0.45 + Math.random() * 0.35   // where along its life it peaks
      });
    }

    var acc = 0, last = performance.now();
    (function draw(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      g.clearRect(0, 0, W, H);

      var dark = isDark();
      // On paper the streaks have to be dark to be visible at all; in the dark
      // theme they are light. Same object, opposite polarity.
      var head = dark ? '255,240,205' : '120,86,26';
      var tail = dark ? '224,179,60' : '162,118,15';
      var gain = dark ? 1 : 0.55;

      acc += dt;
      if (acc > 0.85 + Math.random() * 1.6) { acc = 0; spawn(); }

      for (var i = shower.length - 1; i >= 0; i--) {
        var m = shower[i];
        m.life += dt / m.span;
        if (m.life >= 1 || m.y > H + 120 || m.x < -220) { shower.splice(i, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;

        // ablation curve: dark, flare, gone
        var p = m.life, e = Math.exp(-Math.pow((p - m.flare) / 0.26, 2)) * (1 - p * 0.35);
        var a = e * m.mag * gain;
        if (a <= 0.004) continue;

        var len = m.tail * (0.45 + e * 0.55);
        var n = Math.hypot(m.vx, m.vy) || 1;
        var tx = m.x - m.vx / n * len, ty = m.y - m.vy / n * len;

        var grad = g.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, 'rgba(' + head + ',' + (a * 0.95).toFixed(3) + ')');
        grad.addColorStop(0.28, 'rgba(' + tail + ',' + (a * 0.5).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(' + tail + ',0)');
        g.strokeStyle = grad;
        g.lineWidth = 0.7 + m.mag * 1.9;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(m.x, m.y); g.stroke();

        g.fillStyle = 'rgba(' + head + ',' + (a * 0.9).toFixed(3) + ')';
        g.beginPath(); g.arc(m.x, m.y, 0.6 + m.mag * 1.5, 0, 6.2832); g.fill();
      }
      requestAnimationFrame(draw);
    })(last);
  })();

  /* ------------------------------------------------------------- pointers */
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('pointermove', function (e) {
    tmx = e.clientX / window.innerWidth - 0.5;
    tmy = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    placeRock();
  });

  var f = 0, tf = 0;
  window.addEventListener('scroll', function () { updateRail(); tf = frac(); }, { passive: true });
  updateRail(); tf = frac(); f = tf;

  var t0 = performance.now();
  (function tick(now) {
    var t = (now - t0) / 1000;
    f += (tf - f) * 0.075;
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;

    if (!reduce) {
      rock.rotation.y = t * 0.075 + f * 3.1;
      rock.rotation.x = 0.24 + Math.sin(t * 0.22) * 0.06 + f * 0.85;
      debris.rotation.y = -t * 0.05 - f * 1.4;
      glow.intensity = 0.55 + Math.sin(t * 1.7) * 0.12;
    } else {
      rock.rotation.set(0.24, 0.6, 0);
    }

    camera.position.z = 7.2 + f * 15.5;
    camera.position.x = mx * 1.1;
    camera.position.y = -my * 0.75 + f * 1.4;
    camera.lookAt(0, 0, 0);

    // The rock recedes as the reader descends; it never fully disappears.
    var peak = isDark() ? 0.92 : 0.72;   // paper needs the scene quieter
    renderer.domElement.style.opacity = String(0.26 + (1 - Math.min(1, f * 2.4)) * (peak - 0.26));

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })(performance.now());
})();
