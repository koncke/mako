// ===== Tutoriales de MaKo, 3.ª forma (Martín, 18/11): SÓLO texto al ritmo de su voz + el Martín en cubos acompañando todo el video =====
// Sin capturas de la app: dónde tocar lo marca la app misma. El texto es el del VSL de julio (Geist 800, énfasis azul, MaKo en
// dorado). El personaje (voxel-martin.mjs, en #vox) cambia según el momento — UNA vez acá, para los 35 videos:
//   heroe  → el gancho, el qué es y el cierre: grande, centrado y con zoom; las letras SALEN POR DETRÁS de él y quedan arriba.
//   lado   → las explicaciones: chico a la derecha, el texto a la izquierda; señala o cuenta con la mano.
//   titulo → un título que pasa (el golpe azul): no está.
// Reacciona: cambia de pose en cada pantalla (con transición), salta un poco al entrar como héroe, mueve la boca sólo mientras
// suena una palabra, parpadea y respira.
var CREAM_A = '#FFFFFF', CREAM_B = '#F0F0F0', INK = '#171310', BLUE = '#2F6FED', GOLD = '#F2A516';
var BLUE_A = '#3B7BF5', BLUE_B = '#1E4FBF', GOLD_1 = '#F6D365', GOLD_2 = '#EF9F27';
var FONT = "'Geist', system-ui, sans-serif";
var CH = window.BEATS || [], PAL = window.PALABRAS || [];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function eoCubic(x) { return 1 - Math.pow(1 - x, 3); }
function eoBack(x) { var c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function eInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
function norm(w) { return w.toLowerCase().replace(/[.,:;¿?¡!…"«»“”()]/g, ''); }
window.assetsReady = new Promise(function (res) { (function esperar() { if (window.__voxListo) res(); else setTimeout(esperar, 60); })(); });

function bg(ctx, W, H, modo) {
  var g;
  if (modo === 'blue') { g = ctx.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, BLUE_A); g.addColorStop(1, BLUE_B); }
  else { g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, H * 1.05); g.addColorStop(0, CREAM_A); g.addColorStop(1, CREAM_B); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function layout(ctx, text, size, maxW) {
  ctx.font = '800 ' + size + 'px ' + FONT;
  var words = text.split(' '), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) { var t = cur ? cur + ' ' + words[i] : words[i]; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
// the words, line by line; `alinear` center or left; colors by position (emphIdx) — MaKo always gold
function pintarTexto(ctx, c, lines, size, x, y0, lh, alinear, sobreAzul) {
  ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  var idx = c.emphIdx || [], base = sobreAzul ? '#FFFFFF' : INK, hi = sobreAzul ? '#FFFFFF' : BLUE, gi = 0;
  for (var li = 0; li < lines.length; li++) {
    var ws = lines[li].split(' '), widths = ws.map(function (w) { return ctx.measureText(w).width; }), sp = ctx.measureText(' ').width;
    var tot = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1), xx = alinear === 'centro' ? x - tot / 2 : x;
    for (var wi = 0; wi < ws.length; wi++, gi++) {
      ctx.fillStyle = norm(ws[wi]) === 'mako' ? GOLD : idx.indexOf(gi) >= 0 ? hi : base;
      ctx.fillText(ws[wi], xx, y0 + li * lh); xx += widths[wi] + sp;
    }
  }
}
function ajustar(ctx, text, size, maxW, maxLines, minSize) {
  var lines = layout(ctx, text, size, maxW);
  while (lines.length > maxLines && size > minSize) { size -= 6; lines = layout(ctx, text, size, maxW); }
  return { lines: lines, size: size };
}

// ── the text of each kind of moment ──
function textoHeroe(ctx, W, H, c, age, life) {
  // big, centered, ABOVE the character; it enters rising from behind him (it is drawn before him, so his body hides it at first)
  var A = layoutArriba(ctx, W, H, c), f = A.f, lh = A.lh, alto = A.alto, yFin = A.yFin;
  // it starts at his chest (hidden by him) and rises until it clears his head: the letters come out from behind him
  var E = entrada(age), sube = E.sube, sc = E.sc;
  var op = eoCubic(clamp(age / 160, 0, 1)); if (age > life - 200) op *= 1 - clamp((age - (life - 200)) / 200, 0, 1) * 0.9;
  ctx.save(); ctx.globalAlpha = op; ctx.translate(W / 2, yFin + sube + alto / 2 - lh / 2); ctx.scale(sc, sc);
  pintarTexto(ctx, c, f.lines, f.size, 0, -alto / 2 + lh / 2, lh, 'centro', false); ctx.restore();
}
// The entrance of the big text (the Cerebro, 18/11): it still rises from behind him, but it is in place after ENTRA ms —
// so is he, coming from the side. The covered-letters rule holds in EVERY frame after the first quarter of a second.
var ENTRA = 240;
function entrada(age) { var p = eoCubic(clamp(age / ENTRA, 0, 1)); return { sube: lerp(300, 0, p), sc: lerp(0.86, 1, p) }; }
// «Letters behind the person» (the Cerebro, 18/11): the text is BIG and its LAST line passes behind his head, which covers only
// the lower half of the letters of that line's longest word — letters, never a whole word: everything stays readable. Where he
// stands (cx, top) comes from the text, so it is measured once per screen.
var _detras = {};
function layoutDetras(ctx, W, H, c) {
  var k = CH.indexOf(c); if (_detras[k]) return _detras[k];
  // a short sentence goes on ONE line, smaller if it must («Eso es el Ops Center:» must not break between «Ops» and «Center»)
  var f = c.text.split(' ').length <= 6 ? ajustar(ctx, c.text, 172, W * 0.9, 1, 118) : null;
  if (!f || f.lines.length > 1) f = ajustar(ctx, c.text, 172, W * 0.88, 2, 110);
  var lh = f.size * 1.08, n = f.lines.length;
  var yLast = n === 1 ? 470 : 520, y0 = yLast - (n - 1) * lh;
  ctx.font = '800 ' + f.size + 'px ' + FONT;
  var ult = f.lines[n - 1], ws = ult.split(' '), sp = ctx.measureText(' ').width, wd = ws.map(function (w) { return ctx.measureText(w).width; });
  // his head goes over the longest PLAIN word of the last line: never over a name in blue or over MaKo, which are what must read
  var tot = wd.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1), x = W / 2 - tot / 2, mejor = null, cualquiera = null;
  var desde = c.text.split(' ').length - ws.length, em = c.emphIdx || [];
  ws.forEach(function (w, i) {
    var cand = { w: wd[i], c: x + wd[i] / 2 };
    if (!cualquiera || wd[i] > cualquiera.w) cualquiera = cand;
    if (em.indexOf(desde + i) < 0 && norm(w) !== 'mako' && (!mejor || wd[i] > mejor.w)) mejor = cand;
    x += wd[i] + sp;
  });
  mejor = mejor || cualquiera;
  // The Cerebro's rule (18/11), measured: his hair top (canvas y 134, a dome that widens downwards) sits 12 % of the font size
  // below the centre of the last line, so it can only cover the LOWER THIRD of those letters — every word stays ≥ 70 % visible.
  var s = 1.2, cx = clamp(mejor.c, 700, 1220);
  return (_detras[k] = { lines: f.lines, size: f.size, lh: lh, y0: y0, lugar: { s: s, cx: cx, top: yLast + 0.16 * f.size - (PELO - 100) * s, a: 1 } });   // 0.16, not 0.12: his head tilts while he talks (measured: 62 % → it must be ≥ 66 %)
}
var PELO = 134;   // the top of his hair in the #vox canvas (measured: prueba-vox/medir.cjs); raised hands never go above it
// big and centered with the text ABOVE him (the close and the rest): nothing covered, his hair 40 px under the text
var _arriba = {};
function layoutArriba(ctx, W, H, c) {
  var k = CH.indexOf(c); if (_arriba[k]) return _arriba[k];
  var f = ajustar(ctx, c.text, 128, W * 0.86, 2, 80), lh = f.size * 1.12, alto = f.lines.length * lh;
  var yFin = 205 - alto / 2 + lh / 2, abajo = yFin - lh / 2 + alto, s = 1.3;
  return (_arriba[k] = { f: f, lh: lh, alto: alto, yFin: yFin, lugar: { s: s, cx: 960, top: abajo + 40 - (PELO - 100) * s, a: 1 } });
}
function textoDetras(ctx, W, H, c, age, life) {
  var L = layoutDetras(ctx, W, H, c);
  var E = entrada(age), sube = E.sube, sc = E.sc;
  var op = eoCubic(clamp(age / 160, 0, 1)); if (age > life - 200) op *= 1 - clamp((age - (life - 200)) / 200, 0, 1) * 0.9;
  var mid = L.y0 + (L.lines.length - 1) * L.lh / 2;
  ctx.save(); ctx.globalAlpha = op; ctx.translate(W / 2, mid + sube); ctx.scale(sc, sc);
  pintarTexto(ctx, c, L.lines, L.size, 0, L.y0 - mid, L.lh, 'centro', false); ctx.restore();
}
function textoLado(ctx, W, H, c, age, life) {
  var f = ajustar(ctx, c.text, 112, W * 0.52, 3, 72), lh = f.size * 1.14, alto = f.lines.length * lh;
  // when he is still crossing over from the center, the text waits for him (it would show through his head)
  var espera = CH[CH.indexOf(c) - 1] && CH[CH.indexOf(c) - 1].modo !== 'lado' ? 220 : 0, a2 = age - espera;
  var op = eoCubic(clamp(a2 / 300, 0, 1)), dx = lerp(-36, 0, eoBack(clamp(a2 / 420, 0, 1)));
  if (age > life - 200) op *= 1 - clamp((age - (life - 200)) / 200, 0, 1) * 0.9;
  ctx.save(); ctx.globalAlpha = op; ctx.translate(dx, 0);
  pintarTexto(ctx, c, f.lines, f.size, 140, H * 0.5 - alto / 2 + lh / 2, lh, 'izq', false); ctx.restore();
}
function textoTitulo(ctx, W, H, c, age, life, azul) {
  var f = ajustar(ctx, c.text, 132, W * 0.84, 2, 60), lh = f.size * 1.14, alto = f.lines.length * lh;
  var op = eoCubic(clamp(age / 300, 0, 1)), dy = lerp(40, 0, eoBack(clamp(age / 400, 0, 1))), sc = lerp(0.94, 1, eoBack(clamp(age / 400, 0, 1)));
  if (age > life - 220) { var o = clamp((age - (life - 220)) / 220, 0, 1); op *= 1 - o * 0.9; dy -= o * 20; }
  ctx.save(); ctx.globalAlpha = op; ctx.translate(W / 2, H / 2 + dy); ctx.scale(sc, sc);
  pintarTexto(ctx, c, f.lines, f.size, 0, -alto / 2 + lh / 2, lh, 'centro', azul); ctx.restore();
}

// ── the character: where it stands in each kind of moment (canvas #vox is 800×1100, the body spans ~ y 100…950) ──
var VOX_W = 800, VOX_H = 1100;
var LUGAR = {
  heroe: { s: 1.46, cx: 960, top: 300, a: 1 },     // head under the text, cut at the knees: big and centered
  lado: { s: 0.82, cx: 1500, top: 353, a: 1 },     // the whole body on the right, ~60 % of the height, feet near the bottom
  titulo: { s: 0.82, cx: 2450, top: 353, a: 0 },   // gone (slides out to the right)
};
var _ctx = null;
function lugarDe(b) {
  if (b && b.detras && _ctx) return layoutDetras(_ctx, 1920, 1080, b).lugar;
  if (b && b.modo === 'heroe' && _ctx) return layoutArriba(_ctx, 1920, 1080, b).lugar;
  return LUGAR[(b && b.modo) || 'lado'];
}
function hablando(t) { for (var i = 0; i < PAL.length; i++) { if (t >= PAL[i][0] - 30 && t <= PAL[i][1]) return true; if (PAL[i][0] > t) break; } return false; }
function dibujarPersonaje(ctx, W, H, k, t) {
  var c = CH[k], prev = CH[k - 1] || c, age = t - c.s;
  var a = lugarDe(prev), b = lugarDe(c), p = eInOut(clamp(age / ENTRA, 0, 1));
  var L = { s: lerp(a.s, b.s, p), cx: lerp(a.cx, b.cx, p), top: lerp(a.top, b.top, p), al: lerp(a.a, b.a, p) };
  if (L.al < 0.02) return;
  var hop = 0;   // no jump: it pushed his head into the text above him (the Cerebro, 18/11: the close is never covered)
  var turn = c.modo === 'lado' ? -0.38 : 0, prevTurn = prev.modo === 'lado' ? -0.38 : 0;
  window.__vox.render(t / 1000, { talk: hablando(t), pose: c.pose || 'reposo', prevPose: (prev !== c && prev.pose) || 'reposo',
    since: age / 1000, jump: hop, turn: lerp(prevTurn, turn, p), objeto: c.objeto || null });
  var vox = document.getElementById('vox');
  ctx.save(); ctx.globalAlpha = L.al;
  ctx.shadowColor = 'rgba(40,30,15,0.16)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.drawImage(vox, L.cx - VOX_W * L.s / 2, L.top - 100 * L.s, VOX_W * L.s, VOX_H * L.s);
  ctx.restore();
}

// ── MaKo watermark (VSL's drawMakoLogo), bottom left: the character owns the center ──
function sparkPath(ctx, cx, cy, r) {
  var k = r / 11; ctx.beginPath(); ctx.moveTo(cx, cy - 11 * k);
  ctx.bezierCurveTo(cx + 1 * k, cy - 4 * k, cx + 4 * k, cy - 1 * k, cx + 11 * k, cy);
  ctx.bezierCurveTo(cx + 4 * k, cy + 1 * k, cx + 1 * k, cy + 4 * k, cx, cy + 11 * k);
  ctx.bezierCurveTo(cx - 1 * k, cy + 4 * k, cx - 4 * k, cy + 1 * k, cx - 11 * k, cy);
  ctx.bezierCurveTo(cx - 4 * k, cy - 1 * k, cx - 1 * k, cy - 4 * k, cx, cy - 11 * k); ctx.closePath();
}
function rrp(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawMakoLogo(ctx, left, cy, S, t, claro) {
  ctx.save(); ctx.font = '800 ' + Math.round(S * 0.9) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  var word = 'MaKo', ww = ctx.measureText(word).width, gap = S * 0.34, by = cy - S / 2;
  var bgd = ctx.createLinearGradient(left, by, left + S, by + S); bgd.addColorStop(0, '#2A251C'); bgd.addColorStop(1, '#171511');
  ctx.save(); rrp(ctx, left, by, S, S, S * 0.27); ctx.fillStyle = bgd; ctx.fill(); ctx.lineWidth = Math.max(1, S * 0.022); ctx.strokeStyle = 'rgba(239,159,39,0.4)'; ctx.stroke(); ctx.restore();
  var gg = ctx.createLinearGradient(left, by, left + S, by + S); gg.addColorStop(0, GOLD_1); gg.addColorStop(1, GOLD_2);
  sparkPath(ctx, left + S / 2, by + S / 2, S * 0.34); ctx.fillStyle = gg; ctx.fill();
  var tinta = claro ? '#FFFFFF' : '#1A1813', wx = left + S + gap, ph = (t % 2600) / 2600, cxg = wx + ww * (-0.3 + ph * 1.6);
  var lg = ctx.createLinearGradient(cxg - ww * 0.55, 0, cxg + ww * 0.55, 0);
  lg.addColorStop(0, tinta); lg.addColorStop(0.42, tinta); lg.addColorStop(0.5, GOLD_1); lg.addColorStop(0.58, tinta); lg.addColorStop(1, tinta);
  ctx.fillStyle = lg; ctx.fillText(word, wx, cy + S * 0.06); ctx.restore();
}

// The Cerebro's rule, MEASURED (18/11): every word ≥ 70 % visible, and his head only over the LOWER third of the letters.
// At time t (a screen with text and him, already in place) it draws him alone on a spare canvas and counts, word by word, how
// much of the word's letter box (centre ± 0.36 × size) his pixels cover, and from which height down.
window.medirTapado = function (t) {
  var k = 0; for (var i = 0; i < CH.length; i++) { if (t >= CH[i].s && t < CH[i].e) { k = i; break; } }
  var c = CH[k]; if (c.modo !== 'heroe') return null;
  var W = 1920, H = 1080, ctx = document.getElementById('c').getContext('2d'); _ctx = ctx;
  var age = t - c.s, E = entrada(age), lines, size, lh, cy0, primera;
  // the text exactly where it is drawn at time t (textoDetras / textoHeroe): centre cy0 + E.sube, scale E.sc
  if (c.detras) { var D = layoutDetras(ctx, W, H, c); lines = D.lines; size = D.size; lh = D.lh; var mid = D.y0 + (lines.length - 1) * lh / 2; cy0 = mid; primera = D.y0 - mid; }
  else { var A = layoutArriba(ctx, W, H, c); lines = A.f.lines; size = A.f.size; lh = A.lh; cy0 = A.yFin + A.alto / 2 - lh / 2; primera = -A.alto / 2 + lh / 2; }
  var cy = cy0 + E.sube, sc = E.sc;
  var off = document.createElement('canvas'); off.width = W; off.height = H; var oc = off.getContext('2d');
  dibujarPersonaje(oc, W, H, k, t);
  var px = oc.getImageData(0, 0, W, H).data, res = [];
  ctx.font = '800 ' + size + 'px ' + FONT; var sp = ctx.measureText(' ').width;
  lines.forEach(function (ln, li) {
    var ws = ln.split(' '), wd = ws.map(function (w) { return ctx.measureText(w).width; });
    var tot = wd.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1), x = -tot / 2, yl = cy + (primera + li * lh) * sc;
    var top = Math.round(yl - 0.36 * size * sc), bot = Math.round(yl + 0.36 * size * sc);
    ws.forEach(function (w, wi) {
      var x0 = Math.round(W / 2 + x * sc), x1 = Math.round(W / 2 + (x + wd[wi]) * sc), tap = 0, area = 0, yMin = bot + 1;
      for (var yy = Math.max(0, top); yy <= Math.min(H - 1, bot); yy += 2) for (var xx = Math.max(0, x0); xx <= Math.min(W - 1, x1); xx += 2) {
        area++; if (px[(yy * W + xx) * 4 + 3] > 40) { tap++; if (yy < yMin) yMin = yy; }
      }
      var visible = area ? 1 - tap / area : 1, desde = tap ? (yMin - top) / (bot - top) : 1;
      res.push({ palabra: w, visible: +visible.toFixed(2), tapadoDesde: +desde.toFixed(2), ok: visible >= 0.7 && desde >= 0.66 - 0.001 });
      x += wd[wi] + sp;
    });
  });
  return { texto: c.text, t: t, edad: age, detras: !!c.detras, palabras: res.filter(function (r) { return r.visible < 1; }), ok: res.every(function (r) { return r.ok; }) };
};

function setSize(cv) { var W = 1920, H = 1080; if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; return [W, H]; }
window.renderFrame = function (t) {
  var cv = document.getElementById('c'); var s = setSize(cv), W = s[0], H = s[1];
  var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H); _ctx = ctx;
  var k = 0; for (var i = 0; i < CH.length; i++) { if (t >= CH[i].s && t < CH[i].e) { k = i; break; } if (t >= CH[i].e) k = i; }
  var c = CH[k], age = t - c.s, life = c.e - c.s, azul = c.bg === 'blue';
  bg(ctx, W, H, azul ? 'blue' : 'claro');
  if (c.modo === 'heroe' && c.detras) { textoDetras(ctx, W, H, c, age, life); dibujarPersonaje(ctx, W, H, k, t); }
  else if (c.modo === 'heroe') { textoHeroe(ctx, W, H, c, age, life); dibujarPersonaje(ctx, W, H, k, t); }
  else if (c.modo === 'titulo') { dibujarPersonaje(ctx, W, H, k, t); textoTitulo(ctx, W, H, c, age, life, azul); }
  else { dibujarPersonaje(ctx, W, H, k, t); textoLado(ctx, W, H, c, age, life); }
  drawMakoLogo(ctx, 64, H - 58, 34, t, azul);
  return true;
};
