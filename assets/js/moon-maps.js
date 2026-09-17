/* ==========================================================================
   Lunar map generator, shared by both versions of the site.

   Produces three equirectangular canvases: a height field of maria and
   craters, an albedo map derived from it, and a normal map taken from its
   gradient. Nothing is downloaded, it is all drawn at load.
   ========================================================================== */
window.KTMoonMaps = (function () {
  'use strict';
  var PI = Math.PI;

  var TEX_W = 2048, TEX_H = 1024;

  function makeMoonMaps() {
    var rnd = Math.random;

    /* --- height field -------------------------------------------------- */
    var hc = document.createElement('canvas');
    hc.width = TEX_W; hc.height = TEX_H;
    var h = hc.getContext('2d');
    h.fillStyle = '#808080';
    h.fillRect(0, 0, TEX_W, TEX_H);

    // broad highland roughness, so nothing reads as glassy flat
    for (var b = 0; b < 900; b++) {
      var bx = rnd() * TEX_W, by = rnd() * TEX_H, br = 30 + rnd() * 190;
      var tone = Math.round(128 + (rnd() - 0.5) * 30);
      var bg = h.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, 'rgba(' + tone + ',' + tone + ',' + tone + ',0.30)');
      bg.addColorStop(1, 'rgba(128,128,128,0)');
      h.fillStyle = bg;
      h.beginPath(); h.arc(bx, by, br, 0, 6.2832); h.fill();
    }

    /* Craters: a dark bowl inside a bright rim. An equirectangular map
       stretches horizontally near the poles, so widen them by 1/cos(lat) or
       they come out as slits. */
    function crater(cx, cy, r, depth) {
      var lat = (cy / TEX_H - 0.5) * PI;
      var sx = Math.min(9, 1 / Math.max(0.11, Math.cos(lat)));
      h.save();
      h.translate(cx, cy); h.scale(sx, 1);

      var rim = h.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.22);
      rim.addColorStop(0, 'rgba(255,255,255,0)');
      rim.addColorStop(0.62, 'rgba(255,255,255,' + (0.30 * depth).toFixed(3) + ')');
      rim.addColorStop(1, 'rgba(255,255,255,0)');
      h.fillStyle = rim;
      h.beginPath(); h.arc(0, 0, r * 1.22, 0, 6.2832); h.fill();

      var bowl = h.createRadialGradient(0, 0, 0, 0, 0, r);
      bowl.addColorStop(0, 'rgba(0,0,0,' + (0.42 * depth).toFixed(3) + ')');
      bowl.addColorStop(0.72, 'rgba(0,0,0,' + (0.28 * depth).toFixed(3) + ')');
      bowl.addColorStop(1, 'rgba(0,0,0,0)');
      h.fillStyle = bowl;
      h.beginPath(); h.arc(0, 0, r, 0, 6.2832); h.fill();
      h.restore();
    }

    var i;
    for (i = 0; i < 40; i++)   crater(rnd() * TEX_W, rnd() * TEX_H, 26 + rnd() * 62, 0.9);
    for (i = 0; i < 260; i++)  crater(rnd() * TEX_W, rnd() * TEX_H, 8 + rnd() * 24, 0.75);
    for (i = 0; i < 1400; i++) crater(rnd() * TEX_W, rnd() * TEX_H, 2 + rnd() * 7, 0.55);

    /* --- albedo -------------------------------------------------------- */
    // Start from the height field so relief and brightness agree, then lay
    // the maria over it: large, dark, smooth basalt plains.
    var ac = document.createElement('canvas');
    ac.width = TEX_W; ac.height = TEX_H;
    var a = ac.getContext('2d');
    a.drawImage(hc, 0, 0);

    var MARIA = [
      [0.30, 0.34, 0.16], [0.40, 0.30, 0.10], [0.22, 0.44, 0.13],
      [0.36, 0.46, 0.09], [0.47, 0.40, 0.07], [0.15, 0.36, 0.08],
      [0.28, 0.25, 0.07], [0.52, 0.52, 0.06], [0.44, 0.58, 0.05]
    ];
    MARIA.forEach(function (m) {
      var cx = m[0] * TEX_W, cy = m[1] * TEX_H, r = m[2] * TEX_W;
      for (var k = 0; k < 26; k++) {
        var ox = cx + (rnd() - 0.5) * r * 1.5, oy = cy + (rnd() - 0.5) * r * 1.1;
        var rr = r * (0.45 + rnd() * 0.6);
        var mg = a.createRadialGradient(ox, oy, 0, ox, oy, rr);
        mg.addColorStop(0, 'rgba(46,46,50,0.55)');
        mg.addColorStop(0.7, 'rgba(52,52,56,0.32)');
        mg.addColorStop(1, 'rgba(60,60,64,0)');
        a.fillStyle = mg;
        a.beginPath(); a.arc(ox, oy, rr, 0, 6.2832); a.fill();
      }
    });

    /* Ejecta rays. Real ones are faint, broken and start a little way out
       from the crater, never a clean starburst radiating from one point. */
    for (i = 0; i < 11; i++) {
      var rx = rnd() * TEX_W, ry = TEX_H * (0.18 + rnd() * 0.64);
      var nRays = 10 + Math.round(rnd() * 12);
      for (var ray = 0; ray < nRays; ray++) {
        var ang = rnd() * PI * 2;
        var gap = 26 + rnd() * 50;                 // rays begin outside the rim
        var L = 70 + rnd() * 190;
        var x0 = rx + Math.cos(ang) * gap, y0 = ry + Math.sin(ang) * gap;
        var x1 = rx + Math.cos(ang) * (gap + L), y1 = ry + Math.sin(ang) * (gap + L);
        var rg = a.createLinearGradient(x0, y0, x1, y1);
        rg.addColorStop(0, 'rgba(226,226,230,0.052)');
        rg.addColorStop(0.45, 'rgba(226,226,230,0.030)');
        rg.addColorStop(1, 'rgba(226,226,230,0)');
        a.strokeStyle = rg;
        a.lineWidth = 1.5 + rnd() * 5;
        a.beginPath(); a.moveTo(x0, y0); a.lineTo(x1, y1); a.stroke();
      }
    }

    // pull it toward real lunar albedo, about 0.12, roughly worn asphalt
    var img = a.getImageData(0, 0, TEX_W, TEX_H), px = img.data;
    for (i = 0; i < px.length; i += 4) {
      var v = 17 + px[i] * 0.50;
      px[i] = Math.min(255, v * 1.02); px[i + 1] = v; px[i + 2] = v * 0.95;
    }
    a.putImageData(img, 0, 0);

    /* --- normal map from the height gradient --------------------------- */
    var hd = h.getImageData(0, 0, TEX_W, TEX_H).data;
    var nc = document.createElement('canvas');
    nc.width = TEX_W; nc.height = TEX_H;
    var nctx = nc.getContext('2d');
    var nimg = nctx.createImageData(TEX_W, TEX_H), np = nimg.data;
    var STR = 2.6;
    for (var y = 0; y < TEX_H; y++) {
      var yUp = (y === 0 ? 0 : y - 1) * TEX_W;
      var yDn = (y === TEX_H - 1 ? y : y + 1) * TEX_W;
      var yC = y * TEX_W;
      for (var x = 0; x < TEX_W; x++) {
        var xl = (x === 0 ? TEX_W - 1 : x - 1), xr = (x === TEX_W - 1 ? 0 : x + 1);
        var dx = (hd[(yC + xr) * 4] - hd[(yC + xl) * 4]) / 255 * STR;
        var dy = (hd[(yDn + x) * 4] - hd[(yUp + x) * 4]) / 255 * STR;
        var len = Math.sqrt(dx * dx + dy * dy + 1);
        var o = (yC + x) * 4;
        np[o]     = (-dx / len * 0.5 + 0.5) * 255;
        np[o + 1] = (-dy / len * 0.5 + 0.5) * 255;
        np[o + 2] = (1 / len * 0.5 + 0.5) * 255;
        np[o + 3] = 255;
      }
    }
    nctx.putImageData(nimg, 0, 0);

    return { albedo: ac, normal: nc, height: hc };
  }


  return makeMoonMaps;
})();
