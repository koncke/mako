/* MaKo connect animation — shared canvas renderer.
   window.MakoAnim.draw(ctx, t, W, H) draws ONE frame at time t (ms) in [0,DURATION).
   Does NOT paint a background (transparent) — caller clears / fills as desired. */
(function () {
  'use strict';
  var DURATION = 9000;

  // 10 logos REALES de empresas (mismos que las features y el VSL).
  var LOGOS = [
    { type: 'meta',     color: '#0866FF', label: '¿Meta?',     fx: 0.13, fy: 0.26, slot: 0, img: 'meta.png' },
    { type: 'youtube',  color: '#FF0000', label: '¿YouTube?',  fx: 0.37, fy: 0.17, slot: 2, img: 'youtube.png' },
    { type: 'gmail',    color: '#EA4335', label: '¿Gmail?',    fx: 0.62, fy: 0.19, slot: 4, img: 'gmail.png' },
    { type: 'gdocs',    color: '#4285F4', label: '¿Docs?',     fx: 0.86, fy: 0.27, slot: 6, img: 'docs.png' },
    { type: 'meet',     color: '#00832D', label: '¿Meet?',     fx: 0.10, fy: 0.55, slot: 8, img: 'meet.png' },
    { type: 'gsheets',  color: '#0F9D58', label: '¿Sheets?',   fx: 0.90, fy: 0.55, slot: 9, img: 'sheets.png' },
    { type: 'whatsapp', color: '#25D366', label: '¿WhatsApp?', fx: 0.15, fy: 0.80, slot: 1, img: 'whatsapp.png' },
    { type: 'calendly', color: '#006BFF', label: '¿Calendly?', fx: 0.40, fy: 0.84, slot: 3, img: 'calendly.png' },
    { type: 'claude',   color: '#D97757', label: '¿Claude?',   fx: 0.64, fy: 0.84, slot: 5, img: 'claude.png' },
    { type: 'panda',    color: '#111111', label: '¿Panda?',    fx: 0.88, fy: 0.80, slot: 7, img: 'panda.png' }
  ];

  // Caché de imágenes de logos (cargadas una vez). La animación va en bucle, así
  // que apenas cargan aparecen dibujadas; hasta entonces cae al ícono dibujado.
  var LOGO_IMG = {}, logosLoading = false;
  function ensureLogos() {
    if (logosLoading || typeof window === 'undefined') return;
    logosLoading = true;
    for (var i = 0; i < LOGOS.length; i++) {
      var im = new Image(); im.src = '/vsl-assets/logos/' + LOGOS[i].img;
      LOGO_IMG[LOGOS[i].type] = im;
    }
  }
  function logoReady(type) {
    var im = LOGO_IMG[type];
    return im && im.complete && im.naturalWidth > 0 ? im : null;
  }

  // ---- timeline (ms) ----
  var appearStart = 300, appearStep = 330, appearDur = 360;
  var lblFadeStart = 3250, lblFadeDur = 360;
  var convStart = 3550, collideEnd = 4520;
  var flashStart = 4340, flashPeak = 4560, flashEnd = 5000;
  var starStart = 4470, starPop = 4790, starSettle = 5080;
  var slideStart = 5220, slideEnd = 6050;
  var wordStart = 5320, wordEnd = 6100;
  var glowStart = 6150, glowEnd = 6750, holdEnd = 7950, fadeEnd = 8650;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function eoCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function eiCubic(x) { return x * x * x; }
  function eInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eoBack(x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawIcon(ctx, type, s, color) {
    ctx.lineWidth = s * 0.072; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = color; ctx.fillStyle = color;
    if (type === 'meta') {
      var r = s * 0.145, off = s * 0.155;
      ctx.beginPath(); ctx.arc(-off, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(off, 0, r, 0, Math.PI * 2); ctx.stroke();
    } else if (type === 'claude') {
      var n = 12, inner = s * 0.06, outer = s * 0.25; ctx.lineWidth = s * 0.05;
      for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n; ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); ctx.stroke(); }
    } else if (type === 'gdocs') {
      rr(ctx, -s * 0.19, -s * 0.27, s * 0.38, s * 0.54, s * 0.04); ctx.stroke();
      ctx.lineWidth = s * 0.05;
      [-0.07, 0.04, 0.15].forEach(function (yy) { ctx.beginPath(); ctx.moveTo(-s * 0.10, s * yy); ctx.lineTo(s * 0.10, s * yy); ctx.stroke(); });
    } else if (type === 'youtube') {
      rr(ctx, -s * 0.26, -s * 0.17, s * 0.52, s * 0.34, s * 0.10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.10); ctx.lineTo(-s * 0.06, s * 0.10); ctx.lineTo(s * 0.11, 0); ctx.closePath(); ctx.fill();
    } else if (type === 'whatsapp') {
      rr(ctx, -s * 0.24, -s * 0.24, s * 0.48, s * 0.40, s * 0.13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.13, s * 0.14); ctx.lineTo(-s * 0.22, s * 0.27); ctx.lineTo(-s * 0.04, s * 0.15); ctx.stroke();
      [-0.10, 0, 0.10].forEach(function (xx) { ctx.beginPath(); ctx.arc(s * xx, -s * 0.03, s * 0.028, 0, Math.PI * 2); ctx.fill(); });
    } else if (type === 'gmail') {
      rr(ctx, -s * 0.26, -s * 0.18, s * 0.52, s * 0.36, s * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.13); ctx.lineTo(0, s * 0.06); ctx.lineTo(s * 0.26, -s * 0.13); ctx.stroke();
    } else if (type === 'calendly') {
      rr(ctx, -s * 0.23, -s * 0.20, s * 0.46, s * 0.44, s * 0.07); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.23, -s * 0.07); ctx.lineTo(s * 0.23, -s * 0.07); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.11, -s * 0.28); ctx.lineTo(-s * 0.11, -s * 0.16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.11, -s * 0.28); ctx.lineTo(s * 0.11, -s * 0.16); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, s * 0.07, s * 0.045, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'gsheets') {
      rr(ctx, -s * 0.21, -s * 0.26, s * 0.42, s * 0.52, s * 0.05); ctx.stroke();
      ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.26); ctx.lineTo(0, s * 0.26); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.21, -s * 0.08); ctx.lineTo(s * 0.21, -s * 0.08); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.21, s * 0.09); ctx.lineTo(s * 0.21, s * 0.09); ctx.stroke();
    }
  }

  function chip(ctx, cx, cy, s, scale, opacity, type, color) {
    if (opacity <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    ctx.save();
    ctx.shadowColor = 'rgba(16,19,25,0.20)'; ctx.shadowBlur = s * 0.34; ctx.shadowOffsetY = s * 0.13;
    ctx.fillStyle = '#fff'; rr(ctx, -s / 2, -s / 2, s, s, s * 0.27); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(16,19,25,0.07)'; ctx.lineWidth = 1; rr(ctx, -s / 2, -s / 2, s, s, s * 0.27); ctx.stroke();
    var im = logoReady(type);
    if (im) {
      var box = s * 0.62, fit = box / Math.max(im.naturalWidth, im.naturalHeight);
      var w = im.naturalWidth * fit, h = im.naturalHeight * fit;
      ctx.save(); rr(ctx, -s / 2, -s / 2, s, s, s * 0.27); ctx.clip();
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    } else {
      drawIcon(ctx, type, s, color);
    }
    ctx.restore();
  }

  function sparkle(ctx, cx, cy, r, color) {
    var k = r / 11;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.bezierCurveTo(1.5, -4.5, 4.5, -1.5, 11, 0);
    ctx.bezierCurveTo(4.5, 1.5, 1.5, 4.5, 0, 11);
    ctx.bezierCurveTo(-1.5, 4.5, -4.5, 1.5, -11, 0);
    ctx.bezierCurveTo(-4.5, -1.5, -1.5, -4.5, 0, -11);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  function starBadge(ctx, cx, cy, size, scale, opacity) {
    if (opacity <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy); ctx.scale(scale, scale);
    ctx.save();
    ctx.shadowColor = 'rgba(26,23,18,0.45)'; ctx.shadowBlur = size * 0.4; ctx.shadowOffsetY = size * 0.16;
    ctx.fillStyle = '#1A1712'; rr(ctx, -size / 2, -size / 2, size, size, size * 0.28); ctx.fill();
    ctx.restore();
    sparkle(ctx, 0, 0, size * 0.32, '#F2B01E');
    ctx.restore();
  }

  function draw(ctx, t, W, H) {
    ensureLogos();
    var cx = W / 2, cy = H * 0.50;
    var chipSize = Math.max(40, Math.min(W, H) * 0.17);
    var starSize = chipSize * 1.18;
    var wordSize = starSize * 0.86;
    var fade = (t >= holdEnd) ? (1 - clamp((t - holdEnd) / (fadeEnd - holdEnd), 0, 1)) : 1;

    // warm glow (final beat) — behind lockup
    if (t >= glowStart) {
      var gp = clamp((t - glowStart) / (glowEnd - glowStart), 0, 1);
      var gA = gp * fade;
      if (gA > 0.001) {
        ctx.save();
        var gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.34);
        gr.addColorStop(0, 'rgba(242,165,22,' + (0.55 * gA).toFixed(3) + ')');
        gr.addColorStop(0.45, 'rgba(242,138,28,' + (0.28 * gA).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(242,165,22,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // logos
    for (var i = 0; i < LOGOS.length; i++) {
      var L = LOGOS[i], px = L.fx * W, py = L.fy * H;
      var fl = Math.sin(t / 780 + i * 1.7) * (chipSize * 0.05);
      if (t < convStart) {
        var ai = appearStart + L.slot * appearStep;
        var ap = clamp((t - ai) / appearDur, 0, 1);
        if (ap <= 0) continue;
        chip(ctx, px, py + fl, chipSize, 0.55 + 0.45 * eoBack(ap), ap, L.type, L.color);
        var lo = clamp((t - lblFadeStart) / lblFadeDur, 0, 1);
        var labelA = ap * (1 - lo) * fade;
        if (labelA > 0.01) {
          ctx.save();
          ctx.globalAlpha = labelA;
          ctx.fillStyle = '#8A92A1';
          ctx.font = '600 ' + Math.round(chipSize * 0.27) + "px 'Geist', system-ui, sans-serif";
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(L.label, px, py + fl + chipSize * 0.62);
          ctx.restore();
        }
      } else if (t < collideEnd) {
        var cp = clamp((t - convStart) / (collideEnd - convStart), 0, 1);
        var e = eiCubic(cp);
        chip(ctx, lerp(px, cx, e), lerp(py, cy, e), chipSize, lerp(1, 0.12, e), cp < 0.82 ? 1 : clamp(1 - (cp - 0.82) / 0.18, 0, 1), L.type, L.color);
      }
    }

    // collision flash
    if (t >= flashStart && t < flashEnd) {
      var fop, fsc;
      if (t < flashPeak) { var f = clamp((t - flashStart) / (flashPeak - flashStart), 0, 1); fop = 0.95 * f; fsc = lerp(0.4, 1, f); }
      else { var f2 = clamp((t - flashPeak) / (flashEnd - flashPeak), 0, 1); fop = 0.95 * (1 - f2); fsc = lerp(1, 1.7, f2); }
      ctx.save();
      ctx.globalAlpha = fop;
      var R = starSize * 1.9 * fsc;
      var fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      fg.addColorStop(0, 'rgba(255,255,255,0.95)');
      fg.addColorStop(0.45, 'rgba(47,111,237,0.40)');
      fg.addColorStop(1, 'rgba(47,111,237,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // lockup: star slides left, "MaKo" word appears to its right
    ctx.font = '700 ' + Math.round(wordSize) + "px 'Geist', system-ui, sans-serif";
    var wordW = ctx.measureText('MaKo').width;
    var gap = starSize * 0.34;
    var groupLeft = cx - (starSize + gap + wordW) / 2;
    var starCenterFinal = groupLeft + starSize / 2;
    var wordLeft = groupLeft + starSize + gap;

    var starOp = 0, starScale = 0, starX = cx;
    if (t >= starStart) {
      starOp = 1;
      if (t < starPop) starScale = 1.14 * eoBack(clamp((t - starStart) / (starPop - starStart), 0, 1));
      else if (t < starSettle) starScale = lerp(1.14, 1, eoCubic(clamp((t - starPop) / (starSettle - starPop), 0, 1)));
      else starScale = 1;
      if (t >= slideStart) { var sp = clamp((t - slideStart) / (slideEnd - slideStart), 0, 1); starX = lerp(cx, starCenterFinal, eInOut(sp)); }
    }

    var wOp = 0, wShift = 0;
    if (t >= wordStart) { var wp = clamp((t - wordStart) / (wordEnd - wordStart), 0, 1); wOp = eoCubic(wp); wShift = lerp(-12, 0, eoCubic(wp)); }
    if (wOp > 0.001) {
      ctx.save();
      ctx.globalAlpha = wOp * fade;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      var tx = wordLeft + wShift;
      var phase = (t % 2600) / 2600;
      var gxc = tx - wordW * 0.4 + phase * (wordW * 1.8);
      var lg = ctx.createLinearGradient(gxc - wordW * 0.5, 0, gxc + wordW * 0.5, 0);
      lg.addColorStop(0, '#171A21'); lg.addColorStop(0.42, '#171A21');
      lg.addColorStop(0.5, '#F2A516');
      lg.addColorStop(0.58, '#171A21'); lg.addColorStop(1, '#171A21');
      ctx.fillStyle = lg;
      // +6% del tamaño de la estrella: compensa el centro óptico de la tipografía,
      // así el wordmark queda centrado con la estrella (mismo fix que el logo de abajo)
      ctx.fillText('MaKo', tx, cy + starSize * 0.06);
      ctx.restore();
    }

    starBadge(ctx, starX, cy, starSize, starScale, starOp * fade);
  }

  window.MakoAnim = { draw: draw, DURATION: DURATION, LOGOS: LOGOS };
})();
