/* ==========================================================================
   Calculations — three tools for impact and shock petrology.

   Each model is a published closed form or a standard finite-difference
   scheme, not a fit. The reference for each is printed under its panel so a
   reader can check the arithmetic against the source.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { return parseFloat($(id).value); };
  var fmt = function (v, d) {
    if (!isFinite(v)) return '—';
    if (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e6)) return v.toExponential(d == null ? 3 : d);
    return v.toFixed(d == null ? 3 : d);
  };

  /* Abramowitz & Stegun 7.1.26 — max error 1.5e-7, ample here. */
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  /* ---------------------------------------------------------------- charts */
  var charts = {};
  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function plot(key, canvasId, cfg) {
    if (charts[key]) charts[key].destroy();
    var grid = isDark() ? 'rgba(236,231,221,.10)' : 'rgba(33,30,25,.10)';
    var ink = tok('--text-dim') || '#5F594D';
    var lbl = tok('--text-faint') || '#8C8578';

    cfg.options = Object.assign({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: ink, font: { family: 'IBM Plex Mono, monospace', size: 10 }, boxWidth: 10, boxHeight: 2 } },
        tooltip: {
          backgroundColor: isDark() ? '#1D242E' : '#FFFFFF',
          titleColor: tok('--text'), bodyColor: ink,
          borderColor: tok('--line'), borderWidth: 1, padding: 10,
          titleFont: { family: 'IBM Plex Mono, monospace', size: 10 },
          bodyFont: { family: 'IBM Plex Mono, monospace', size: 11 }
        }
      },
      elements: { point: { radius: 0, hoverRadius: 4 }, line: { borderWidth: 2, tension: 0.12 } }
    }, cfg.options || {});

    ['x', 'y'].forEach(function (ax) {
      var s = cfg.options.scales[ax];
      s.grid = { color: grid, drawBorder: false };
      s.ticks = Object.assign({ color: lbl, font: { family: 'IBM Plex Mono, monospace', size: 10 } }, s.ticks || {});
      s.title = Object.assign({ display: true, color: lbl, font: { family: 'IBM Plex Mono, monospace', size: 10 } }, s.title || {});
    });

    charts[key] = new Chart($(canvasId).getContext('2d'), cfg);
    return charts[key];
  }

  var GOLD = '#C8971F', RING = '#2A4FB0', OLIV = '#6E7A18', HOT = '#B4442A';

  /* -------------------------------------------------------------- exports */
  var results = {};   // key -> {name, head:[], rows:[[]], meta:[[k,v]]}

  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }
  function csvCell(v) {
    v = String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCSV(key) {
    var r = results[key]; if (!r) return;
    var lines = [];
    lines.push('# ' + r.name);
    lines.push('# ktiwari.com — generated ' + new Date().toISOString().slice(0, 19).replace('T', ' '));
    r.meta.forEach(function (m) { lines.push('# ' + m[0] + ',' + m[1]); });
    lines.push('');
    lines.push(r.head.map(csvCell).join(','));
    r.rows.forEach(function (row) { lines.push(row.map(csvCell).join(',')); });
    download(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), r.file + '.csv');
  }
  function exportXLSX(key) {
    var r = results[key]; if (!r) return;
    if (!window.XLSX) { exportCSV(key); return; }
    var wb = XLSX.utils.book_new();

    var aoa = [r.head].concat(r.rows);
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = r.head.map(function (h) { return { wch: Math.max(12, String(h).length + 2) }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    var pa = [['Parameter', 'Value']].concat(r.meta);
    pa.push([], ['Model', r.name], ['Reference', r.ref || ''],
            ['Generated', new Date().toISOString().slice(0, 19).replace('T', ' ')],
            ['Source', 'ktiwari.com/calculations.html']);
    var ws2 = XLSX.utils.aoa_to_sheet(pa);
    ws2['!cols'] = [{ wch: 42 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Parameters');

    XLSX.writeFile(wb, r.file + '.xlsx');
  }
  function exportPNG(key, canvasId) {
    var c = $(canvasId), r = results[key];
    var out = document.createElement('canvas');
    out.width = c.width; out.height = c.height;
    var g = out.getContext('2d');
    g.fillStyle = isDark() ? '#0E1116' : '#FBF8F2';
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(c, 0, 0);
    out.toBlob(function (b) { download(b, (r ? r.file : 'chart') + '.png'); });
  }

  function table(key, tbodyId, head, rows, limit) {
    var t = $(tbodyId);
    var thead = '<tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
    var n = Math.min(rows.length, limit || 24);
    var step = Math.max(1, Math.floor(rows.length / n));
    var body = '';
    for (var i = 0; i < rows.length; i += step) {
      body += '<tr>' + rows[i].map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }
    t.innerHTML = thead + body;
    $(tbodyId + '-note').textContent = rows.length > n
      ? 'Showing every ' + step +(step === 1 ? 'st' : 'th') + ' row of ' + rows.length + '. The export contains all ' + rows.length + '.'
      : rows.length + ' rows.';
  }

  /* ======================================================================
     1 — Shock-melt vein cooling
     A vein of half-width a, initially molten at Tm, embedded in host rock at
     Th, cooling by conduction into an effectively infinite medium. Exact
     solution for that initial condition (Carslaw & Jaeger 1959, §2.3):

       T(x,t) = Th + (Tm-Th)/2 [ erf((a-x)/2sqrt(at)) + erf((a+x)/2sqrt(at)) ]

     This is what sets whether a high-pressure phase has time to nucleate and
     grow before the vein quenches.
     ====================================================================== */
  function runVein() {
    var a = num('v-halfwidth') * 1e-6;          // µm -> m
    var Tm = num('v-tmelt'), Th = num('v-thost');
    var k = num('v-k'), rho = num('v-rho'), cp = num('v-cp');
    var tmax = num('v-tmax'), thr = num('v-thresh');

    var err = [];
    if (!(a > 0)) err.push('half-width');
    if (!(k > 0)) err.push('thermal conductivity');
    if (!(rho > 0)) err.push('density');
    if (!(cp > 0)) err.push('heat capacity');
    if (!(tmax > 0)) err.push('duration');
    if (!(Tm > Th)) err.push('melt temperature must exceed host temperature');
    if (err.length) { $('v-err').textContent = 'Check: ' + err.join(', ') + '.'; $('v-err').hidden = false; return; }
    $('v-err').hidden = true;

    var alpha = k / (rho * cp);                 // m^2/s
    var tq = a * a / alpha;                     // characteristic conduction time

    function T(x, t) {
      if (t <= 0) return Math.abs(x) <= a ? Tm : Th;
      var d = 2 * Math.sqrt(alpha * t);
      return Th + (Tm - Th) / 2 * (erf((a - x) / d) + erf((a + x) / d));
    }

    var STEPS = 400;
    var probes = [
      { x: 0,       lab: 'Vein centre',        c: HOT },
      { x: a * 0.5, lab: 'Half-way to margin', c: GOLD },
      { x: a,       lab: 'Vein margin',        c: RING },
      { x: a * 2,   lab: 'Host, 1 a out',      c: OLIV }
    ];

    var rows = [], labels = [], series = probes.map(function () { return []; });
    for (var i = 0; i <= STEPS; i++) {
      var t = tmax * i / STEPS;
      labels.push(t);
      var row = [fmt(t, 6)];
      probes.forEach(function (p, j) {
        var val = T(p.x, t);
        series[j].push(val);
        row.push(fmt(val, 2));
      });
      rows.push(row);
    }

    // when does the centre fall through the threshold?
    var tCross = null;
    for (var s = 1; s <= STEPS; s++) {
      if (series[0][s] <= thr) {
        var t0 = tmax * (s - 1) / STEPS, t1 = tmax * s / STEPS;
        var y0 = series[0][s - 1], y1 = series[0][s];
        tCross = t0 + (t1 - t0) * (y0 - thr) / (y0 - y1 || 1);
        break;
      }
    }

    $('v-out').innerHTML =
      stat('Thermal diffusivity α', fmt(alpha, 3) + ' m²/s') +
      stat('Conduction time a²/α', fmt(tq, 4) + ' s') +
      stat('Centre T at t<sub>max</sub>', fmt(series[0][STEPS], 1) + ' K') +
      stat('Below ' + thr + ' K after', tCross == null ? 'not within t<sub>max</sub>' : fmt(tCross, 4) + ' s');

    plot('vein', 'v-chart', {
      type: 'line',
      data: {
        labels: labels.map(function (t) { return t.toPrecision(3); }),
        datasets: probes.map(function (p, j) {
          return { label: p.lab, data: series[j], borderColor: p.c, backgroundColor: p.c, fill: false };
        })
      },
      options: {
        scales: {
          x: { title: { text: 'Time since quench (s)' }, ticks: { maxTicksLimit: 9 } },
          y: { title: { text: 'Temperature (K)' } }
        }
      }
    });

    var head = ['Time (s)', 'T centre (K)', 'T at a/2 (K)', 'T at margin (K)', 'T host +a (K)'];
    table('vein', 'v-table', head, rows);
    results.vein = {
      name: 'Shock-melt vein cooling — 1D conduction into an infinite host',
      file: 'vein-cooling',
      ref: 'Carslaw & Jaeger (1959) Conduction of Heat in Solids, 2nd ed., §2.3',
      head: head, rows: rows,
      meta: [
        ['Vein half-width a (µm)', num('v-halfwidth')],
        ['Initial melt temperature Tm (K)', Tm],
        ['Host temperature Th (K)', Th],
        ['Thermal conductivity k (W/m/K)', k],
        ['Density rho (kg/m3)', rho],
        ['Heat capacity cp (J/kg/K)', cp],
        ['Thermal diffusivity alpha (m2/s)', alpha],
        ['Conduction time a^2/alpha (s)', tq],
        ['Threshold temperature (K)', thr],
        ['Centre crosses threshold at (s)', tCross == null ? 'not reached' : tCross]
      ]
    };
  }

  /* ======================================================================
     2 — Peak shock pressure, planar impact approximation
     Linear shock-particle Hugoniot Us = C0 + S*up. For a symmetric impact
     (like striking like) up = v/2; otherwise the impedance match is solved
     for the interface pressure. Melosh (1989) ch. 4.
     ====================================================================== */
  var MATERIALS = {
    'olivine':     { n: 'Olivine (Fo90)',        rho: 3320, C0: 6.31, S: 0.90 },
    'enstatite':   { n: 'Enstatite',             rho: 3200, C0: 6.20, S: 0.90 },
    'lchond':      { n: 'L ordinary chondrite',  rho: 3350, C0: 4.90, S: 1.40 },
    'hchond':      { n: 'H ordinary chondrite',  rho: 3700, C0: 4.60, S: 1.45 },
    'basalt':      { n: 'Basalt (Deccan/Lonar)', rho: 2860, C0: 3.50, S: 1.32 },
    'granite':     { n: 'Granite',               rho: 2630, C0: 3.68, S: 1.24 },
    'iron':        { n: 'Iron meteorite',        rho: 7850, C0: 3.80, S: 1.58 },
    'ice':         { n: 'Water ice',             rho:  920, C0: 1.32, S: 1.53 }
  };

  function fillMaterials() {
    ['p-imp-mat', 'p-tgt-mat'].forEach(function (id) {
      var sel = $(id);
      Object.keys(MATERIALS).forEach(function (k) {
        var o = document.createElement('option');
        o.value = k; o.textContent = MATERIALS[k].n;
        sel.appendChild(o);
      });
    });
    $('p-imp-mat').value = 'lchond';
    $('p-tgt-mat').value = 'lchond';
    ['p-imp-mat', 'p-tgt-mat'].forEach(function (id) {
      $(id).addEventListener('change', function () { syncMat(); runShock(); });
    });
  }
  function syncMat() {
    var a = MATERIALS[$('p-imp-mat').value], b = MATERIALS[$('p-tgt-mat').value];
    $('p-imp-rho').value = a.rho; $('p-imp-c0').value = a.C0; $('p-imp-s').value = a.S;
    $('p-tgt-rho').value = b.rho; $('p-tgt-c0').value = b.C0; $('p-tgt-s').value = b.S;
  }

  // Impedance match: find up_target such that both sides carry the same pressure.
  function shockPressure(v, ri, ci, si, rt, ct, st) {
    var lo = 0, hi = v, up;
    for (var i = 0; i < 60; i++) {
      up = (lo + hi) / 2;
      var Pt = rt * (ct + st * up) * up;                       // target, particle velocity up
      var w = v - up;                                          // impactor, in its own frame
      var Pi = ri * (ci + si * w) * w;
      if (Pi > Pt) lo = up; else hi = up;
    }
    var Us = ct + st * up;
    return { up: up, Us: Us, P: rt * Us * up, comp: Us / (Us - up || 1e-9), E: 0.5 * up * up };
  }

  // Stöffler et al. (1991, 2018) shock stages for ordinary chondrites.
  var STAGES = [
    [0,  5,  'S1', 'Unshocked — sharp optical extinction in olivine'],
    [5, 10,  'S2', 'Very weakly shocked — undulose extinction'],
    [10, 15, 'S3', 'Weakly shocked — planar fractures'],
    [15, 25, 'S4', 'Moderately shocked — mosaicism, planar fractures'],
    [25, 45, 'S5', 'Strongly shocked — mosaicism, maskelynite'],
    [45, 90, 'S6', 'Very strongly shocked — local melting, high-pressure phases'],
    [90, 1e9,'—',  'Whole-rock melting']
  ];
  function stageFor(P) {
    for (var i = 0; i < STAGES.length; i++) if (P >= STAGES[i][0] && P < STAGES[i][1]) return STAGES[i];
    return STAGES[0];
  }

  function runShock() {
    var v = num('p-vel');
    var ri = num('p-imp-rho'), ci = num('p-imp-c0'), si = num('p-imp-s');
    var rt = num('p-tgt-rho'), ct = num('p-tgt-c0'), st = num('p-tgt-s');

    if (!(v > 0) || !(ri > 0) || !(rt > 0) || !(ci > 0) || !(ct > 0)) {
      $('p-err').textContent = 'Check: velocity, densities and bulk sound speeds must all be positive.';
      $('p-err').hidden = false; return;
    }
    $('p-err').hidden = true;

    var r = shockPressure(v, ri, ci, si, rt, ct, st);
    var P = r.P;                        // kg/m3 * km/s * km/s = 1e6 Pa = MPa -> /1e3 = GPa
    var Pgpa = P * 1e6 / 1e9;
    var st_ = stageFor(Pgpa);

    $('p-out').innerHTML =
      stat('Peak shock pressure', '<b>' + fmt(Pgpa, 2) + ' GPa</b>') +
      stat('Shock stage', '<b>' + st_[2] + '</b> — ' + st_[3]) +
      stat('Particle velocity u<sub>p</sub>', fmt(r.up, 3) + ' km/s') +
      stat('Shock velocity U<sub>s</sub>', fmt(r.Us, 3) + ' km/s') +
      stat('Compression ρ/ρ₀', fmt(r.comp, 3)) +
      stat('Specific internal energy', fmt(r.E * 1e6 / 1e3, 1) + ' kJ/kg');

    // sweep velocity so the single answer sits on a curve
    var xs = [], ps = [], rows = [];
    for (var i = 0; i <= 120; i++) {
      var vv = 0.5 + (25 - 0.5) * i / 120;
      var rr = shockPressure(vv, ri, ci, si, rt, ct, st);
      var pp = rr.P * 1e6 / 1e9;
      xs.push(vv); ps.push(pp);
      rows.push([fmt(vv, 2), fmt(pp, 3), fmt(rr.up, 4), fmt(rr.Us, 4), fmt(rr.comp, 4), stageFor(pp)[2]]);
    }

    plot('shock', 'p-chart', {
      type: 'line',
      data: {
        labels: xs.map(function (x) { return x.toFixed(1); }),
        datasets: [
          { label: 'Peak pressure', data: ps, borderColor: GOLD, backgroundColor: GOLD, fill: false },
          { label: 'Your impact', data: xs.map(function (x) { return Math.abs(x - v) < 0.11 ? Pgpa : null; }),
            borderColor: HOT, backgroundColor: HOT, pointRadius: 6, showLine: false, spanGaps: false }
        ]
      },
      options: {
        scales: {
          x: { title: { text: 'Impact velocity (km/s)' }, ticks: { maxTicksLimit: 10 } },
          y: { title: { text: 'Peak shock pressure (GPa)' } }
        }
      }
    });

    var head = ['Impact velocity (km/s)', 'Peak pressure (GPa)', 'up (km/s)', 'Us (km/s)', 'rho/rho0', 'Shock stage'];
    table('shock', 'p-table', head, rows);
    results.shock = {
      name: 'Peak shock pressure — planar impact approximation with impedance match',
      file: 'shock-pressure',
      ref: 'Melosh (1989) Impact Cratering, ch. 4; shock stages after Stöffler et al. (1991, 2018)',
      head: head, rows: rows,
      meta: [
        ['Impact velocity (km/s)', v],
        ['Impactor', MATERIALS[$('p-imp-mat').value].n],
        ['Impactor density (kg/m3)', ri], ['Impactor C0 (km/s)', ci], ['Impactor S', si],
        ['Target', MATERIALS[$('p-tgt-mat').value].n],
        ['Target density (kg/m3)', rt], ['Target C0 (km/s)', ct], ['Target S', st],
        ['Peak pressure (GPa)', Pgpa],
        ['Particle velocity up (km/s)', r.up],
        ['Shock velocity Us (km/s)', r.Us],
        ['Compression rho/rho0', r.comp],
        ['Shock stage', st_[2]]
      ]
    };
  }

  /* ======================================================================
     3 — Crater scaling
     Pi-group scaling in the gravity regime for competent rock:
       D_tc = 1.161 (ri/rt)^1/3 L^0.78 v^0.44 g^-0.22 (sin theta)^1/3
     Simple craters finalise at ~1.25 D_tc. On Earth the simple-to-complex
     transition is near 3.2 km, above which D_f is enlarged further.
     ====================================================================== */
  function runCrater() {
    var L = num('c-diam'), v = num('c-vel') * 1000, th = num('c-angle') * Math.PI / 180;
    var ri = num('c-rho-i'), rt = num('c-rho-t'), g = num('c-g');

    if (!(L > 0) || !(v > 0) || !(ri > 0) || !(rt > 0) || !(g > 0) || !(th > 0)) {
      $('c-err').textContent = 'Check: every field must be positive, and the angle between 1 and 90°.';
      $('c-err').hidden = false; return;
    }
    $('c-err').hidden = true;

    function crater(Lm) {
      var Dtc = 1.161 * Math.pow(ri / rt, 1 / 3) * Math.pow(Lm, 0.78) *
                Math.pow(v, 0.44) * Math.pow(g, -0.22) * Math.pow(Math.sin(th), 1 / 3);
      var Dsimple = 1.25 * Dtc;
      var Dc = 3200;                                  // simple/complex transition on Earth, m
      var Df = Dsimple < Dc ? Dsimple : 1.17 * Math.pow(Dsimple, 1.13) / Math.pow(Dc, 0.13);
      var m = ri * Math.PI / 6 * Lm * Lm * Lm;
      return { Dtc: Dtc, Df: Df, m: m, E: 0.5 * m * v * v, depth: Dsimple < Dc ? Df / 5 : Df / 12 };
    }

    var r = crater(L);
    var mt = r.E / 4.184e15;                           // megatons TNT

    $('c-out').innerHTML =
      stat('Transient crater', fmt(r.Dtc / 1000, 3) + ' km') +
      stat('Final crater', '<b>' + fmt(r.Df / 1000, 3) + ' km</b>' + (r.Df < 3200 ? ' (simple)' : ' (complex)')) +
      stat('Apparent depth', fmt(r.depth, 0) + ' m') +
      stat('Impactor mass', fmt(r.m, 3) + ' kg') +
      stat('Kinetic energy', fmt(r.E, 3) + ' J · ' + fmt(mt, 3) + ' Mt TNT');

    var xs = [], ds = [], rows = [];
    var lo = Math.max(1, L / 25), hi = L * 25;
    for (var i = 0; i <= 120; i++) {
      var Lm = lo * Math.pow(hi / lo, i / 120);
      var c = crater(Lm);
      xs.push(Lm); ds.push(c.Df / 1000);
      rows.push([fmt(Lm, 2), fmt(c.Dtc / 1000, 4), fmt(c.Df / 1000, 4), fmt(c.m, 3), fmt(c.E, 3), fmt(c.E / 4.184e15, 4)]);
    }

    plot('crater', 'c-chart', {
      type: 'line',
      data: {
        labels: xs.map(function (x) { return x < 100 ? x.toFixed(1) : Math.round(x); }),
        datasets: [
          { label: 'Final crater diameter', data: ds, borderColor: RING, backgroundColor: RING, fill: false },
          { label: 'Your impactor', data: xs.map(function (x) { return Math.abs(x - L) / L < 0.05 ? r.Df / 1000 : null; }),
            borderColor: HOT, backgroundColor: HOT, pointRadius: 6, showLine: false }
        ]
      },
      options: {
        scales: {
          x: { title: { text: 'Impactor diameter (m, log-spaced)' }, ticks: { maxTicksLimit: 9 } },
          y: { type: 'logarithmic', title: { text: 'Final crater diameter (km)' } }
        }
      }
    });

    var head = ['Impactor diameter (m)', 'Transient crater (km)', 'Final crater (km)', 'Mass (kg)', 'Energy (J)', 'Energy (Mt TNT)'];
    table('crater', 'c-table', head, rows);
    results.crater = {
      name: 'Crater scaling — pi-group, gravity regime, competent rock',
      file: 'crater-scaling',
      ref: 'Schmidt & Housen (1987); Melosh (1989) Impact Cratering, §7.8',
      head: head, rows: rows,
      meta: [
        ['Impactor diameter (m)', L], ['Impact velocity (km/s)', num('c-vel')],
        ['Impact angle (deg from horizontal)', num('c-angle')],
        ['Impactor density (kg/m3)', ri], ['Target density (kg/m3)', rt],
        ['Surface gravity (m/s2)', g],
        ['Transient crater diameter (m)', r.Dtc], ['Final crater diameter (m)', r.Df],
        ['Impactor mass (kg)', r.m], ['Kinetic energy (J)', r.E], ['Energy (Mt TNT)', mt]
      ]
    };
  }

  function stat(k, v) {
    return '<div class="stat"><dt>' + k + '</dt><dd>' + v + '</dd></div>';
  }

  /* ---------------------------------------------------------------- presets */
  var PRESETS = {
    'katol':    { note: 'Katol L6 — a 100 µm vein quenching from a chondritic melt',
                  set: { 'v-halfwidth': 100, 'v-tmelt': 2300, 'v-thost': 1000, 'v-k': 3.0, 'v-rho': 3350, 'v-cp': 1200, 'v-tmax': 0.05, 'v-thresh': 1500 }, run: runVein },
    'thinvein': { note: 'A thin 20 µm vein — quenches two orders of magnitude faster',
                  set: { 'v-halfwidth': 20, 'v-tmelt': 2300, 'v-thost': 1000, 'v-k': 3.0, 'v-rho': 3350, 'v-cp': 1200, 'v-tmax': 0.005, 'v-thresh': 1500 }, run: runVein },
    'thickvein':{ note: 'A 1 mm vein — long enough for high-pressure phases to grow',
                  set: { 'v-halfwidth': 1000, 'v-tmelt': 2300, 'v-thost': 1000, 'v-k': 3.0, 'v-rho': 3350, 'v-cp': 1200, 'v-tmax': 5, 'v-thresh': 1500 }, run: runVein }
  };
  var CPRESETS = {
    'lonar':  { set: { 'c-diam': 80, 'c-vel': 18, 'c-angle': 45, 'c-rho-i': 3350, 'c-rho-t': 2860, 'c-g': 9.81 } },
    'meteor': { set: { 'c-diam': 50, 'c-vel': 12.8, 'c-angle': 45, 'c-rho-i': 7850, 'c-rho-t': 2500, 'c-g': 9.81 } },
    'chicx':  { set: { 'c-diam': 10000, 'c-vel': 20, 'c-angle': 45, 'c-rho-i': 2600, 'c-rho-t': 2500, 'c-g': 9.81 } }
  };

  function apply(map) { Object.keys(map).forEach(function (k) { $(k).value = map[k]; }); }

  /* ------------------------------------------------------------------ wire */
  function ready() {
    fillMaterials(); syncMat();

    $('v-run').addEventListener('click', runVein);
    $('p-run').addEventListener('click', runShock);
    $('c-run').addEventListener('click', runCrater);

    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = PRESETS[b.dataset.preset]; apply(p.set); p.run();
      });
    });
    document.querySelectorAll('[data-cpreset]').forEach(function (b) {
      b.addEventListener('click', function () { apply(CPRESETS[b.dataset.cpreset].set); runCrater(); });
    });

    document.querySelectorAll('[data-export]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.dataset.export.split(':');   // kind:key:canvas
        if (d[0] === 'csv') exportCSV(d[1]);
        else if (d[0] === 'xlsx') exportXLSX(d[1]);
        else exportPNG(d[1], d[2]);
      });
    });

    // recompute on Enter, and live as the reader drags a number
    document.querySelectorAll('.calc input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var panel = inp.closest('.calc');
        if (panel.id === 'calc-vein') runVein();
        else if (panel.id === 'calc-shock') runShock();
        else runCrater();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.dispatchEvent(new Event('change')); } });
    });

    // the charts carry theme colours, so redraw them when the theme flips
    var obs = new MutationObserver(function () { runVein(); runShock(); runCrater(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    runVein(); runShock(); runCrater();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
