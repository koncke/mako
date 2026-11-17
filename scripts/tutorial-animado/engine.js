// ===== Tutorial animado de MaKo · el mismo lenguaje del VSL de julio (kinetic-full.js) =====
// Fondo blanco, letra negra Geist 800, énfasis azul #2F6FED, dorado SOLO para MaKo, golpes en fondo azul con letra blanca,
// máximo 2 líneas, cada pantalla entra con fade + subida + escala con rebote y sale con fade. Marca de agua de MaKo abajo.
// Nuevo para los tutoriales: el grafo del Second Brain (oscuro, como en la app) y la pantalla real de la app con lo marcado.
var CREAM_A = '#FFFFFF', CREAM_B = '#F0F0F0', INK = '#171310', BLUE = '#2F6FED', GOLD = '#F2A516';
var BLUE_A = '#3B7BF5', BLUE_B = '#1E4FBF';
var GOLD_1 = '#F6D365', GOLD_2 = '#EF9F27';
var DARK_A = '#15151A', DARK_B = '#09090B', BLUE_DARK = '#7AA7FF';
var FONT = "'Geist', system-ui, sans-serif";

var CH = window.BEATS || [];
var ICONS = {}, APP = null;

function trimImg(img) {
  var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  var oc = document.createElement('canvas'); oc.width = w; oc.height = h; var ox = oc.getContext('2d'); ox.drawImage(img, 0, 0);
  var data; try { data = ox.getImageData(0, 0, w, h).data; } catch (e) { return { canvas: oc, w: w, h: h }; }
  var minX = w, minY = h, maxX = -1, maxY = -1;
  for (var y = 0; y < h; y++) { var row = y * w; for (var x = 0; x < w; x++) { if (data[(row + x) * 4 + 3] > 18) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } } }
  if (maxX < 0) return { canvas: oc, w: w, h: h };
  var tw = maxX - minX + 1, th = maxY - minY + 1, tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(oc, minX, minY, tw, th, 0, 0, tw, th); return { canvas: tc, w: tw, h: th };
}
function load(src, cb) { return new Promise(function (res) { var im = new Image(); im.onload = function () { try { cb(im); } catch (e) {} res(); }; im.onerror = function () { res(); }; im.src = src; }); }
window.assetsReady = Promise.all([
  load('./icons/brain.svg', function (im) { ICONS['brain.svg'] = trimImg(im); }),
  load('./icons/message-circle.svg', function (im) { ICONS['message-circle.svg'] = trimImg(im); }),
  load('./app-ops.png', function (im) { APP = im; }),
]);

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function eoCubic(x) { return 1 - Math.pow(1 - x, 3); }
function eoBack(x) { var c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function eInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

function bg(ctx, W, H, modo) {
  var g;
  if (modo === 'blue') { g = ctx.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, BLUE_A); g.addColorStop(1, BLUE_B); }
  else if (modo === 'oscuro') { g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, H * 1.05); g.addColorStop(0, DARK_A); g.addColorStop(1, DARK_B); }
  else { g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, H * 1.05); g.addColorStop(0, CREAM_A); g.addColorStop(1, CREAM_B); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function norm(w) { return w.toLowerCase().replace(/[.,:;¿?¡!…"]/g, ''); }
function layout(ctx, text, size, maxW) {
  ctx.font = '800 ' + size + 'px ' + FONT;
  var words = text.split(' '), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) { var t = cur ? cur + ' ' + words[i] : words[i]; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function drawIcon(ctx, tr, cx, cy, box, alpha, scale, rot) {
  if (!tr) return; var fit = box / Math.max(tr.w, tr.h) * (scale || 1), w = tr.w * fit, h = tr.h * fit;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
  ctx.drawImage(tr.canvas, -w / 2, -h / 2, w, h); ctx.restore();
}
/** Words in a line, colored: MaKo gold, emphasis blue (or the light blue on dark), the rest ink. */
function pintarLinea(ctx, ws, x, y, sp, widths, colores) {
  for (var wi = 0; wi < ws.length; wi++) { ctx.fillStyle = colores(ws[wi]); ctx.fillText(ws[wi], x, y); x += widths[wi] + sp; }
}
function colorDe(c, modo) {
  var emph = (c.emph || []).map(norm);
  var base = modo === 'claro' ? INK : '#FFFFFF';
  var hi = modo === 'blue' ? '#FFFFFF' : modo === 'oscuro' ? BLUE_DARK : BLUE;
  return function (w) { var n = norm(w); return n === 'mako' ? GOLD : emph.indexOf(n) >= 0 ? hi : base; };
}

// ── the text beat (VSL's drawTextChunk, same timings) ──
function drawTextChunk(ctx, W, H, c, age, life, modo, cy) {
  var maxW = W * 0.84, size = c.big ? 210 : 120;
  var lines = layout(ctx, c.text, size, maxW);
  while (lines.length > 2 && size > 54) { size -= 8; lines = layout(ctx, c.text, size, maxW); }
  var lh = size * 1.14, textH = lines.length * lh;
  var emS = c.icon ? size * 1.55 : 0, emGap = c.icon ? size * 0.34 : 0;
  var groupH = textH + emS + emGap, top = -groupH / 2;
  var op = eoCubic(clamp(age / 300, 0, 1)), dy = lerp(40, 0, eoBack(clamp(age / 400, 0, 1))), sc = lerp(0.94, 1, eoBack(clamp(age / 400, 0, 1)));
  var outStart = life - 220; if (age > outStart) { var o = clamp((age - outStart) / 220, 0, 1); op *= (1 - o * 0.9); dy -= o * 20; }
  ctx.save(); ctx.globalAlpha = op; ctx.translate(W / 2, (cy || H / 2) + dy); ctx.scale(sc, sc); ctx.textBaseline = 'middle';
  if (c.icon) { var ib = eoBack(clamp(age / 440, 0, 1)); drawIcon(ctx, ICONS[c.icon], 0, top + emS / 2, emS, 1, lerp(0.45, 1, ib), lerp(-0.18, 0, ib)); }
  ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'left';
  var col = colorDe(c, modo), y0 = top + emS + emGap + lh / 2;
  for (var li = 0; li < lines.length; li++) {
    var ws = lines[li].split(' '), widths = ws.map(function (w) { return ctx.measureText(w).width; }), sp = ctx.measureText(' ').width;
    var tot = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1);
    pintarLinea(ctx, ws, -tot / 2, y0 + li * lh, sp, widths, col);
  }
  ctx.restore();
}

// ── MaKo watermark (VSL's drawMakoLogo, unchanged) ──
function sparkPath(ctx, cx, cy, r) {
  var k = r / 11; ctx.beginPath(); ctx.moveTo(cx, cy - 11 * k);
  ctx.bezierCurveTo(cx + 1 * k, cy - 4 * k, cx + 4 * k, cy - 1 * k, cx + 11 * k, cy);
  ctx.bezierCurveTo(cx + 4 * k, cy + 1 * k, cx + 1 * k, cy + 4 * k, cx, cy + 11 * k);
  ctx.bezierCurveTo(cx - 1 * k, cy + 4 * k, cx - 4 * k, cy + 1 * k, cx - 11 * k, cy);
  ctx.bezierCurveTo(cx - 4 * k, cy - 1 * k, cx - 1 * k, cy - 4 * k, cx, cy - 11 * k); ctx.closePath();
}
function rrp(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function badge(ctx, bx, by, S) {
  var bgd = ctx.createLinearGradient(bx, by, bx + S, by + S); bgd.addColorStop(0, '#2A251C'); bgd.addColorStop(1, '#171511');
  ctx.save(); rrp(ctx, bx, by, S, S, S * 0.27); ctx.fillStyle = bgd; ctx.fill(); ctx.lineWidth = Math.max(1, S * 0.022); ctx.strokeStyle = 'rgba(239,159,39,0.4)'; ctx.stroke(); ctx.restore();
  var gg = ctx.createLinearGradient(bx, by, bx + S, by + S); gg.addColorStop(0, GOLD_1); gg.addColorStop(1, GOLD_2);
  sparkPath(ctx, bx + S / 2, by + S / 2, S * 0.34); ctx.fillStyle = gg; ctx.fill();
}
function drawMakoLogo(ctx, cx, cy, S, t, claro) {
  ctx.save();
  ctx.font = '800 ' + Math.round(S * 0.9) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  var word = 'MaKo', ww = ctx.measureText(word).width, gap = S * 0.34, groupW = S + gap + ww, left = cx - groupW / 2;
  badge(ctx, left, cy - S / 2, S);
  var tinta = claro ? '#FFFFFF' : '#1A1813';
  var wx = left + S + gap, ph = (t % 2600) / 2600, cxg = wx + ww * (-0.3 + ph * 1.6);
  var lg = ctx.createLinearGradient(cxg - ww * 0.55, 0, cxg + ww * 0.55, 0);
  lg.addColorStop(0, tinta); lg.addColorStop(0.42, tinta); lg.addColorStop(0.5, GOLD_1); lg.addColorStop(0.58, tinta); lg.addColorStop(1, tinta);
  ctx.fillStyle = lg; ctx.fillText(word, wx, cy + S * 0.06);
  ctx.restore();
}

// ── The Second Brain graph: MaKo in the middle, each node appears when the voice names it; then it grows by itself ──
var GRAFO_T0 = 1e9; CH.forEach(function (c) { if (c.type === 'grafo' && c.s < GRAFO_T0) GRAFO_T0 = c.s; });
var NODOS = []; CH.forEach(function (c) { if (c.nodos) NODOS = c.nodos; });
var CRECE = CH.filter(function (c) { return c.crece; })[0];
var CY_GRAFO = 0.40;
var POS = [{ x: 0.22, y: 0.20, c: '#6FD3B5' }, { x: 0.78, y: 0.20, c: '#8AB4F8' }, { x: 0.50, y: 0.60, c: '#F4A6A0' }];
// the dots that appear by themselves ("se arma solo"): fixed, seeded positions around the three nodes and the middle,
// never on top of a name (the names hang below each node): above the two top nodes, to the sides of the bottom one
var EXTRA = (function () {
  var r = 7, out = [], seed = function () { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
  for (var i = 0; i < 22; i++) {
    var padre = i % 4; // 0..2 = a node, 3 = the middle
    var u = seed(), ang;
    if (padre < 2) ang = -Math.PI * (0.08 + u * 0.84);                       // above
    else if (padre === 2) ang = (u < 0.5 ? 0 : Math.PI) + (seed() - 0.5) * 0.9; // to the sides
    else ang = -Math.PI * (0.15 + u * 0.7) + (seed() < 0.5 ? 0 : Math.PI * 0.0); // above the middle
    var dist = 0.07 + seed() * 0.08;
    var cols = ['#6FD3B5', '#8AB4F8', '#F4A6A0', '#C9B6F2', '#FBD38D'];
    out.push({ padre: padre, ang: ang, dist: dist, rad: 6 + seed() * 6, c: cols[Math.floor(seed() * cols.length)], d: i * 38 + seed() * 30 });
  }
  return out;
})();
function nodoXY(i, W, H) { return { x: POS[i].x * W, y: POS[i].y * H }; }
function punto(ctx, x, y, r, color, a) {
  ctx.save(); ctx.globalAlpha = a;
  var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.globalAlpha = a * 0.35; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function linea(ctx, x0, y0, x1, y1, p, a, w) {
  if (p <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = w || 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, p), lerp(y0, y1, p)); ctx.stroke(); ctx.restore();
}
function drawGrafo(ctx, W, H, c, t) {
  var cx = W * 0.5, cy = H * CY_GRAFO;
  // the camera: a slow push-in while the nodes appear, and a gentle pull-back when it grows by itself (so the new dots fit)
  var z = c.crece ? lerp(1.06, 0.97, eInOut(clamp((t - c.s) / (c.e - c.s), 0, 1))) : lerp(1.0, 1.06, eInOut(clamp((t - c.s) / (c.e - c.s), 0, 1)));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
  var desdeInicio = t - GRAFO_T0;
  // dots that appear by themselves
  if (c.crece) {
    for (var k = 0; k < EXTRA.length; k++) {
      var e = EXTRA[k], tt = t - c.s - e.d; if (tt <= 0) continue;
      var base = e.padre < 3 ? nodoXY(e.padre, W, H) : { x: cx, y: cy };
      var ex = base.x + Math.cos(e.ang) * e.dist * W, ey = Math.max(H * 0.04, base.y + Math.sin(e.ang) * e.dist * H * 1.25);
      var lp = eoCubic(clamp(tt / 260, 0, 1)), ap = eoBack(clamp((tt - 120) / 320, 0, 1));
      linea(ctx, base.x, base.y, ex, ey, lp, 0.75, 1.6);
      if (tt > 120) punto(ctx, ex, ey, e.rad * clamp(ap, 0, 1.2), e.c, clamp((tt - 120) / 200, 0, 1));
    }
  }
  // the three named nodes
  for (var i = 0; i < NODOS.length; i++) {
    var n = NODOS[i], age = t - n.s; if (age < 0) continue;
    var p = nodoXY(i, W, H);
    var lp2 = eoCubic(clamp(age / 340, 0, 1));
    linea(ctx, cx, cy, p.x, p.y, lp2, 1, 3);
    var ap2 = clamp((age - 180) / 380, 0, 1);
    if (age > 180) {
      punto(ctx, p.x, p.y, 20 * lerp(0.4, 1, eoBack(ap2)), POS[i].c, clamp(ap2 * 1.4, 0, 1));
      var size = 74, op = eoCubic(clamp((age - 200) / 300, 0, 1)), dy = lerp(26, 0, eoBack(clamp((age - 200) / 420, 0, 1)));
      ctx.save(); ctx.globalAlpha = op; ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#FFFFFF';
      var label = n.text.charAt(0).toUpperCase() + n.text.slice(1);
      ctx.fillText(label, p.x, p.y + 44 + dy); ctx.restore();
    }
  }
  // MaKo in the middle: it is what MaKo knows
  var aC = eoBack(clamp(desdeInicio / 420, 0, 1)), S = 132 * lerp(0.5, 1, aC) * (1 + 0.025 * Math.sin(t / 260));
  ctx.save(); ctx.globalAlpha = clamp(desdeInicio / 200, 0, 1);
  var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 1.6); halo.addColorStop(0, 'rgba(246,211,101,0.28)'); halo.addColorStop(1, 'rgba(246,211,101,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, S * 1.6, 0, Math.PI * 2); ctx.fill();
  badge(ctx, cx - S / 2, cy - S / 2, S); ctx.restore();
  ctx.restore();
  // the spoken words when there is no node to carry them ("se arma solo.")
  if (c.crece) drawLineaAbajo(ctx, W, H, c, t - c.s, 'oscuro');
}
function drawLineaAbajo(ctx, W, H, c, age, modo) {
  var size = 104, op = eoCubic(clamp(age / 300, 0, 1)), dy = lerp(30, 0, eoBack(clamp(age / 400, 0, 1)));
  ctx.save(); ctx.globalAlpha = op; ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  var ws = c.text.split(' '), widths = ws.map(function (w) { return ctx.measureText(w).width; }), sp = ctx.measureText(' ').width;
  var tot = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1);
  pintarLinea(ctx, ws, W / 2 - tot / 2, H * 0.83 + dy, sp, widths, colorDe(c, modo)); ctx.restore();
}

// ── The real screen of the app, everything dark except what the voice points at (like the tour in the onboarding mock) ──
var MARCA = { x: 290, y: 977, w: 335, h: 43 };   // "Second Brain", at the foot of the chat list (app-rects.json × 1.2)
function drawApp(ctx, W, H, c, t) {
  var age = t - c.s, life = c.e - c.s;
  // the camera goes from the whole screen to the corner where "Second Brain" lives, so it reads even in the small video box;
  // the frame never leaves the picture (focus clamped to what the zoom can show)
  var p = eInOut(clamp((age - 120) / 900, 0, 1)), z = lerp(1.0, 2.1, p);
  var fx = lerp(W / 2, MARCA.x + MARCA.w / 2, p), fy = lerp(H / 2, MARCA.y - 190, p);
  fx = clamp(fx, W / (2 * z), W - W / (2 * z)); fy = clamp(fy, H / (2 * z), H - H / (2 * z));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-fx, -fy);
  if (APP) ctx.drawImage(APP, 0, 0, W, H);
  // the veil with a hole where the voice points
  var pad = 10, hx = MARCA.x - pad, hy = MARCA.y - pad, hw = MARCA.w + pad * 2, hh = MARCA.h + pad * 2;
  var va = eoCubic(clamp((age - 150) / 380, 0, 1));
  ctx.save(); ctx.globalAlpha = va; ctx.fillStyle = 'rgba(8,10,16,0.66)';
  ctx.beginPath(); ctx.rect(-W, -H, W * 3, H * 3); rrpSub(ctx, hx, hy, hw, hh, 14); ctx.fill('evenodd'); ctx.restore();
  // the ring, with a pulse when the voice says "aquí"
  var aqui = (c.palabras || []).filter(function (p) { return /^aquí/i.test(p.t); })[0];
  var pulso = aqui ? Math.exp(-Math.pow((t - aqui.s - 120) / 220, 2)) : 0;
  ctx.save(); ctx.globalAlpha = va; ctx.strokeStyle = BLUE; ctx.lineWidth = 4 + pulso * 3; ctx.shadowColor = 'rgba(47,111,237,0.85)'; ctx.shadowBlur = 18 + pulso * 26;
  rrp(ctx, hx, hy, hw, hh, 14); ctx.stroke(); ctx.restore();
  ctx.restore();
}
function rrpSub(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function setSize(cv) { var W = 1920, H = 1080; if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; return [W, H]; }
window.renderFrame = function (t) {
  var cv = document.getElementById('c'); var s = setSize(cv), W = s[0], H = s[1];
  var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H);
  var c = null; for (var i = 0; i < CH.length; i++) { if (t >= CH[i].s && t < CH[i].e) { c = CH[i]; break; } }
  if (!c) c = (t >= CH[CH.length - 1].e) ? CH[CH.length - 1] : CH[0];
  var modo = c.bg === 'blue' ? 'blue' : c.type === 'grafo' ? 'oscuro' : c.type === 'app' ? 'app' : 'claro';
  if (modo !== 'app') bg(ctx, W, H, modo);
  if (c.type === 'grafo') drawGrafo(ctx, W, H, c, t);
  else if (c.type === 'app') drawApp(ctx, W, H, c, t);
  else drawTextChunk(ctx, W, H, c, t - c.s, c.e - c.s, modo);
  // the watermark, as in the VSL; not over the app screen, where the camera ends right on it (and the screen is MaKo already)
  if (modo !== 'app') drawMakoLogo(ctx, W / 2, H - 70, 40, t, modo !== 'claro');
  return true;
};
