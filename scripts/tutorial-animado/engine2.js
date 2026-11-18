// ===== Tutoriales de MaKo · el lenguaje del VSL de julio y de la muestra del Second Brain (engine.js) =====
// Generalizado para las 34 pestañas: el texto entra al ritmo de la voz (Geist 800, énfasis azul, MaKo en dorado, golpe en
// fondo azul) y, en el paso que dice dónde tocar, la pestaña real dibujada con lo marcado y la cámara que se acerca.
// Todo lo que cambia por tutorial viene en window.BEATS (lo arma beats2.mjs): textos, tiempos, ícono, imagen y marca.
var CREAM_A = '#FFFFFF', CREAM_B = '#F0F0F0', INK = '#171310', BLUE = '#2F6FED', GOLD = '#F2A516';
var BLUE_A = '#3B7BF5', BLUE_B = '#1E4FBF';
var GOLD_1 = '#F6D365', GOLD_2 = '#EF9F27';
var FONT = "'Geist', system-ui, sans-serif";

var CH = window.BEATS || [];
var ICONS = {}, IMGS = {};

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
function load(src, cb) { return new Promise(function (res) { var im = new Image(); im.onload = function () { try { cb(im); } catch (e) {} res(); }; im.onerror = function () { console.error('no carga ' + src); res(); }; im.src = src; }); }
var _carga = [];
CH.forEach(function (c) {
  if (c.icon && !ICONS[c.icon]) { ICONS[c.icon] = null; _carga.push(load(c.icon, function (im) { ICONS[c.icon] = trimImg(im); })); }
  if (c.img && !IMGS[c.img]) { IMGS[c.img] = null; _carga.push(load(c.img, function (im) { IMGS[c.img] = im; })); }
});
window.assetsReady = Promise.all(_carga);

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function eoCubic(x) { return 1 - Math.pow(1 - x, 3); }
function eoBack(x) { var c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function eInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

function bg(ctx, W, H, modo) {
  var g;
  if (modo === 'blue') { g = ctx.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, BLUE_A); g.addColorStop(1, BLUE_B); }
  else { g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, H * 1.05); g.addColorStop(0, CREAM_A); g.addColorStop(1, CREAM_B); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function norm(w) { return w.toLowerCase().replace(/[.,:;¿?¡!…"«»“”()]/g, ''); }
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
function colorDe(c, modo) {
  var emph = (c.emph || []).map(norm);
  var base = modo === 'claro' ? INK : '#FFFFFF';
  var hi = modo === 'blue' ? '#FFFFFF' : BLUE;
  return function (w) { var n = norm(w); return n === 'mako' ? GOLD : emph.indexOf(n) >= 0 ? hi : base; };
}

// ── the text beat (VSL's drawTextChunk, same timings) ──
function drawTextChunk(ctx, W, H, c, age, life, modo) {
  var maxW = W * 0.84, size = 120;
  var lines = layout(ctx, c.text, size, maxW);
  while (lines.length > 2 && size > 54) { size -= 8; lines = layout(ctx, c.text, size, maxW); }
  var lh = size * 1.14, textH = lines.length * lh;
  var emS = c.icon ? size * 1.55 : 0, emGap = c.icon ? size * 0.34 : 0;
  var groupH = textH + emS + emGap, top = -groupH / 2;
  var op = eoCubic(clamp(age / 300, 0, 1)), dy = lerp(40, 0, eoBack(clamp(age / 400, 0, 1))), sc = lerp(0.94, 1, eoBack(clamp(age / 400, 0, 1)));
  var outStart = life - 220; if (age > outStart) { var o = clamp((age - outStart) / 220, 0, 1); op *= (1 - o * 0.9); dy -= o * 20; }
  ctx.save(); ctx.globalAlpha = op; ctx.translate(W / 2, H / 2 + dy); ctx.scale(sc, sc); ctx.textBaseline = 'middle';
  if (c.icon) { var ib = eoBack(clamp(age / 440, 0, 1)); drawIcon(ctx, ICONS[c.icon], 0, top + emS / 2, emS, 1, lerp(0.45, 1, ib), lerp(-0.18, 0, ib)); }
  ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'left';
  var col = colorDe(c, modo), y0 = top + emS + emGap + lh / 2, gi = 0;
  var idx = c.emphIdx || null, base = modo === 'claro' ? INK : '#FFFFFF', hi = modo === 'blue' ? '#FFFFFF' : BLUE;
  for (var li = 0; li < lines.length; li++) {
    var ws = lines[li].split(' '), widths = ws.map(function (w) { return ctx.measureText(w).width; }), sp = ctx.measureText(' ').width;
    var tot = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1), x = -tot / 2;
    for (var wi = 0; wi < ws.length; wi++, gi++) {
      // by position when the beat says which words (emphIdx); MaKo is always gold
      ctx.fillStyle = norm(ws[wi]) === 'mako' ? GOLD : idx ? (idx.indexOf(gi) >= 0 ? hi : base) : col(ws[wi]);
      ctx.fillText(ws[wi], x, y0 + li * lh); x += widths[wi] + sp;
    }
  }
  ctx.restore();
}

// ── MaKo watermark (VSL's drawMakoLogo) ──
function sparkPath(ctx, cx, cy, r) {
  var k = r / 11; ctx.beginPath(); ctx.moveTo(cx, cy - 11 * k);
  ctx.bezierCurveTo(cx + 1 * k, cy - 4 * k, cx + 4 * k, cy - 1 * k, cx + 11 * k, cy);
  ctx.bezierCurveTo(cx + 4 * k, cy + 1 * k, cx + 1 * k, cy + 4 * k, cx, cy + 11 * k);
  ctx.bezierCurveTo(cx - 1 * k, cy + 4 * k, cx - 4 * k, cy + 1 * k, cx - 11 * k, cy);
  ctx.bezierCurveTo(cx - 4 * k, cy - 1 * k, cx - 1 * k, cy - 4 * k, cx, cy - 11 * k); ctx.closePath();
}
function rrp(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function rrpSub(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawMakoLogo(ctx, cx, cy, S, t, claro) {
  ctx.save();
  ctx.font = '800 ' + Math.round(S * 0.9) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  var word = 'MaKo', ww = ctx.measureText(word).width, gap = S * 0.34, groupW = S + gap + ww, left = cx - groupW / 2, by = cy - S / 2;
  var bgd = ctx.createLinearGradient(left, by, left + S, by + S); bgd.addColorStop(0, '#2A251C'); bgd.addColorStop(1, '#171511');
  ctx.save(); rrp(ctx, left, by, S, S, S * 0.27); ctx.fillStyle = bgd; ctx.fill(); ctx.lineWidth = Math.max(1, S * 0.022); ctx.strokeStyle = 'rgba(239,159,39,0.4)'; ctx.stroke(); ctx.restore();
  var gg = ctx.createLinearGradient(left, by, left + S, by + S); gg.addColorStop(0, GOLD_1); gg.addColorStop(1, GOLD_2);
  sparkPath(ctx, left + S / 2, by + S / 2, S * 0.34); ctx.fillStyle = gg; ctx.fill();
  var tinta = claro ? '#FFFFFF' : '#1A1813';
  var wx = left + S + gap, ph = (t % 2600) / 2600, cxg = wx + ww * (-0.3 + ph * 1.6);
  var lg = ctx.createLinearGradient(cxg - ww * 0.55, 0, cxg + ww * 0.55, 0);
  lg.addColorStop(0, tinta); lg.addColorStop(0.42, tinta); lg.addColorStop(0.5, GOLD_1); lg.addColorStop(0.58, tinta); lg.addColorStop(1, tinta);
  ctx.fillStyle = lg; ctx.fillText(word, wx, cy + S * 0.06);
  ctx.restore();
}

// ── The real tab, everything dark except what the voice points at; the camera goes from the whole screen to it ──
// c.marca is the element's rect in the 1920×1080 frame (CSS px of a 1600×900 page × 1.2).
// The Cerebro's review (18/11): the app stays LIGHT (a slight veil, never a dark mode) and the camera goes CLOSE, so the
// interface text reads at 1080p on a phone — the yardstick is CRM's «+ Nuevo lead / ⋮» frame, at 2.4×. No `marca`: the voice
// says «aquí» about the whole tab, so the whole tab, light, with a slow push-in.
function drawApp(ctx, W, H, c, t) {
  var age = t - c.s, life = c.e - c.s, img = IMGS[c.img], m = c.marca;
  if (!m) {
    var zt = lerp(1.0, 1.12, eInOut(clamp(age / Math.max(1, life), 0, 1)));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(zt, zt); ctx.translate(-W / 2, -H / 2);
    if (img) ctx.drawImage(img, 0, 0, W, H); ctx.restore(); return;
  }
  // a very tall or very wide thing (a whole column, a panel) is marked by its top-left: its title and what comes first
  if (m.h > H * 0.30) m = { x: m.x, y: m.y, w: m.w, h: H * 0.30 };
  if (m.w > W * 0.42) m = { x: m.x, y: m.y, w: W * 0.42, h: m.h };
  var pad = 8, hx = m.x - pad, hy = m.y - pad, hw = m.w + pad * 2, hh = m.h + pad * 2;
  // how close: as close as the marked thing allows with some air around it, between 2.2× and 2.6×
  var zMax = clamp(Math.min(W * 0.62 / hw, H * 0.62 / hh), 2.2, 2.6);
  var p = eInOut(clamp((age - 60) / 700, 0, 1)), z = lerp(1.35, zMax, p);
  var fx = lerp(W / 2, m.x + m.w / 2, p), fy = lerp(H / 2, m.y + m.h / 2, p);
  fx = clamp(fx, W / (2 * z), W - W / (2 * z)); fy = clamp(fy, H / (2 * z), H - H / (2 * z));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-fx, -fy);
  if (img) ctx.drawImage(img, 0, 0, W, H); else { ctx.fillStyle = '#EEE'; ctx.fillRect(0, 0, W, H); }
  var va = eoCubic(clamp((age - 150) / 380, 0, 1));
  ctx.save(); ctx.globalAlpha = va; ctx.fillStyle = 'rgba(20,24,34,0.14)';
  ctx.beginPath(); ctx.rect(-W, -H, W * 3, H * 3); rrpSub(ctx, hx, hy, hw, hh, 12); ctx.fill('evenodd'); ctx.restore();
  // the ring, with a pulse on the word that names what to touch (c.pulso, ms)
  var pulso = c.pulso ? Math.exp(-Math.pow((t - c.pulso - 120) / 240, 2)) : 0;
  ctx.save(); ctx.globalAlpha = va; ctx.strokeStyle = BLUE; ctx.lineWidth = (4 + pulso * 3) / Math.max(1, z * 0.7); ctx.shadowColor = 'rgba(47,111,237,0.85)'; ctx.shadowBlur = 18 + pulso * 26;
  rrp(ctx, hx, hy, hw, hh, 12); ctx.stroke(); ctx.restore();
  ctx.restore();
}

function setSize(cv) { var W = 1920, H = 1080; if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; cv.style.width = W + 'px'; cv.style.height = H + 'px'; return [W, H]; }
window.renderFrame = function (t) {
  var cv = document.getElementById('c'); var s = setSize(cv), W = s[0], H = s[1];
  var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H);
  var c = null; for (var i = 0; i < CH.length; i++) { if (t >= CH[i].s && t < CH[i].e) { c = CH[i]; break; } }
  if (!c) c = (t >= CH[CH.length - 1].e) ? CH[CH.length - 1] : CH[0];
  var modo = c.type === 'app' ? 'app' : c.bg === 'blue' ? 'blue' : 'claro';
  if (modo === 'app') drawApp(ctx, W, H, c, t);
  else { bg(ctx, W, H, modo); drawTextChunk(ctx, W, H, c, t - c.s, c.e - c.s, modo); }
  if (modo !== 'app') drawMakoLogo(ctx, W / 2, H - 70, 40, t, modo !== 'claro');
  return true;
};
