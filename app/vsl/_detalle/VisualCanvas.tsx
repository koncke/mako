'use client';

// =============================================================================
// VisualCanvas — animaciones canvas para las landings /vsl (tipos `cx*`).
// =============================================================================
// cxConnect: la MISMA animación del hero de la landing (los logos de las
// herramientas dispersas convergen al centro y nace la estrella MaKo). El código
// de dibujo va INLINE (portado de public/vsl-assets/mako-anim.js) para no depender
// de cargar un script async — así renderiza siempre, también en captura headless.

import { useEffect, useRef } from 'react';

type Logo = { type: string; color: string; label: string; fx: number; fy: number; slot: number; img: string };
// 10 logos REALES de empresas (PNG en /vsl-assets/logos) — los mismos del VSL.
const LOGOS: Logo[] = [
  { type: 'meta', color: '#0866FF', label: '¿Meta?', fx: 0.13, fy: 0.26, slot: 0, img: 'meta.png' },
  { type: 'youtube', color: '#FF0000', label: '¿YouTube?', fx: 0.37, fy: 0.17, slot: 2, img: 'youtube.png' },
  { type: 'gmail', color: '#EA4335', label: '¿Gmail?', fx: 0.62, fy: 0.19, slot: 4, img: 'gmail.png' },
  { type: 'gdocs', color: '#4285F4', label: '¿Docs?', fx: 0.86, fy: 0.27, slot: 6, img: 'docs.png' },
  { type: 'meet', color: '#00832D', label: '¿Meet?', fx: 0.10, fy: 0.55, slot: 8, img: 'meet.png' },
  { type: 'gsheets', color: '#0F9D58', label: '¿Sheets?', fx: 0.90, fy: 0.55, slot: 9, img: 'sheets.png' },
  { type: 'whatsapp', color: '#25D366', label: '¿WhatsApp?', fx: 0.15, fy: 0.80, slot: 1, img: 'whatsapp.png' },
  { type: 'calendly', color: '#006BFF', label: '¿Calendly?', fx: 0.40, fy: 0.84, slot: 3, img: 'calendly.png' },
  { type: 'claude', color: '#D97757', label: '¿Claude?', fx: 0.64, fy: 0.84, slot: 5, img: 'claude.png' },
  { type: 'panda', color: '#111111', label: '¿Panda?', fx: 0.88, fy: 0.80, slot: 7, img: 'panda.png' },
];

// Caché de imágenes de logos, cargadas una vez a nivel de módulo. Como la
// animación va en bucle, apenas cargan aparecen dibujadas.
const LOGO_IMG: Record<string, HTMLImageElement> = {};
let logosLoading = false;
function ensureLogos() {
  if (logosLoading || typeof window === 'undefined') return;
  logosLoading = true;
  for (const L of LOGOS) {
    const im = new Image();
    im.src = `/vsl-assets/logos/${L.img}`;
    LOGO_IMG[L.type] = im;
  }
}
function logoReady(type: string): HTMLImageElement | null {
  const im = LOGO_IMG[type];
  return im && im.complete && im.naturalWidth > 0 ? im : null;
}
const appearStart = 300, appearStep = 330, appearDur = 360;
const lblFadeStart = 3250, lblFadeDur = 360;
const convStart = 3550, collideEnd = 4520;
const flashStart = 4340, flashPeak = 4560, flashEnd = 5000;
const starStart = 4470, starPop = 4790, starSettle = 5080;
const slideStart = 5220, slideEnd = 6050;
const wordStart = 5320, wordEnd = 6100;
const glowStart = 6150, glowEnd = 6750, holdEnd = 7950, fadeEnd = 8650;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const eoCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const eiCubic = (x: number) => x * x * x;
const eInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eoBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawIcon(ctx: CanvasRenderingContext2D, type: string, s: number, color: string) {
  ctx.lineWidth = s * 0.072; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.fillStyle = color;
  if (type === 'meta') { const r = s * 0.145, off = s * 0.155; ctx.beginPath(); ctx.arc(-off, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(off, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  else if (type === 'claude') { const n = 12, inner = s * 0.06, outer = s * 0.25; ctx.lineWidth = s * 0.05; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); ctx.stroke(); } }
  else if (type === 'gdocs') { rr(ctx, -s * 0.19, -s * 0.27, s * 0.38, s * 0.54, s * 0.04); ctx.stroke(); ctx.lineWidth = s * 0.05;[-0.07, 0.04, 0.15].forEach((yy) => { ctx.beginPath(); ctx.moveTo(-s * 0.10, s * yy); ctx.lineTo(s * 0.10, s * yy); ctx.stroke(); }); }
  else if (type === 'youtube') { rr(ctx, -s * 0.26, -s * 0.17, s * 0.52, s * 0.34, s * 0.10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.10); ctx.lineTo(-s * 0.06, s * 0.10); ctx.lineTo(s * 0.11, 0); ctx.closePath(); ctx.fill(); }
  else if (type === 'whatsapp') { rr(ctx, -s * 0.24, -s * 0.24, s * 0.48, s * 0.40, s * 0.13); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.13, s * 0.14); ctx.lineTo(-s * 0.22, s * 0.27); ctx.lineTo(-s * 0.04, s * 0.15); ctx.stroke();[-0.10, 0, 0.10].forEach((xx) => { ctx.beginPath(); ctx.arc(s * xx, -s * 0.03, s * 0.028, 0, Math.PI * 2); ctx.fill(); }); }
  else if (type === 'gmail') { rr(ctx, -s * 0.26, -s * 0.18, s * 0.52, s * 0.36, s * 0.05); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.13); ctx.lineTo(0, s * 0.06); ctx.lineTo(s * 0.26, -s * 0.13); ctx.stroke(); }
  else if (type === 'calendly') { rr(ctx, -s * 0.23, -s * 0.20, s * 0.46, s * 0.44, s * 0.07); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.23, -s * 0.07); ctx.lineTo(s * 0.23, -s * 0.07); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.11, -s * 0.28); ctx.lineTo(-s * 0.11, -s * 0.16); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 0.11, -s * 0.28); ctx.lineTo(s * 0.11, -s * 0.16); ctx.stroke(); ctx.beginPath(); ctx.arc(0, s * 0.07, s * 0.045, 0, Math.PI * 2); ctx.fill(); }
  else if (type === 'gsheets') { rr(ctx, -s * 0.21, -s * 0.26, s * 0.42, s * 0.52, s * 0.05); ctx.stroke(); ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(0, -s * 0.26); ctx.lineTo(0, s * 0.26); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.21, -s * 0.08); ctx.lineTo(s * 0.21, -s * 0.08); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.21, s * 0.09); ctx.lineTo(s * 0.21, s * 0.09); ctx.stroke(); }
}
function chip(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, scale: number, opacity: number, type: string, color: string) {
  if (opacity <= 0.001) return;
  ctx.save(); ctx.globalAlpha = opacity; ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.save(); ctx.shadowColor = 'rgba(16,19,25,0.20)'; ctx.shadowBlur = s * 0.34; ctx.shadowOffsetY = s * 0.13;
  ctx.fillStyle = '#fff'; rr(ctx, -s / 2, -s / 2, s, s, s * 0.27); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(16,19,25,0.07)'; ctx.lineWidth = 1; rr(ctx, -s / 2, -s / 2, s, s, s * 0.27); ctx.stroke();
  const im = logoReady(type);
  if (im) {
    // logo real, encajado dentro del tile con padding
    const box = s * 0.62, iw = im.naturalWidth, ih = im.naturalHeight, fit = box / Math.max(iw, ih);
    const w = iw * fit, h = ih * fit;
    ctx.save(); rr(ctx, -s / 2, -s / 2, s, s, s * 0.27); ctx.clip();
    ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  } else {
    drawIcon(ctx, type, s, color); // fallback mientras carga
  }
  ctx.restore();
}
function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const k = r / 11; ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.beginPath(); ctx.moveTo(0, -11);
  ctx.bezierCurveTo(1.5, -4.5, 4.5, -1.5, 11, 0); ctx.bezierCurveTo(4.5, 1.5, 1.5, 4.5, 0, 11);
  ctx.bezierCurveTo(-1.5, 4.5, -4.5, 1.5, -11, 0); ctx.bezierCurveTo(-4.5, -1.5, -1.5, -4.5, 0, -11);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
function starBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, scale: number, opacity: number) {
  if (opacity <= 0.001) return;
  ctx.save(); ctx.globalAlpha = opacity; ctx.translate(cx, cy); ctx.scale(scale, scale);
  ctx.save(); ctx.shadowColor = 'rgba(26,23,18,0.45)'; ctx.shadowBlur = size * 0.4; ctx.shadowOffsetY = size * 0.16;
  ctx.fillStyle = '#1A1712'; rr(ctx, -size / 2, -size / 2, size, size, size * 0.28); ctx.fill(); ctx.restore();
  sparkle(ctx, 0, 0, size * 0.32, '#F2B01E'); ctx.restore();
}
function drawMako(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  const cx = W / 2, cy = H * 0.50;
  const chipSize = Math.max(40, Math.min(60, Math.min(W, H) * 0.155));
  const starSize = chipSize * 1.18, wordSize = starSize * 0.86;
  const fade = t >= holdEnd ? 1 - clamp((t - holdEnd) / (fadeEnd - holdEnd), 0, 1) : 1;
  if (t >= glowStart) {
    const gp = clamp((t - glowStart) / (glowEnd - glowStart), 0, 1), gA = gp * fade;
    if (gA > 0.001) { ctx.save(); const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.34); gr.addColorStop(0, `rgba(242,165,22,${(0.55 * gA).toFixed(3)})`); gr.addColorStop(0.45, `rgba(242,138,28,${(0.28 * gA).toFixed(3)})`); gr.addColorStop(1, 'rgba(242,165,22,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  for (let i = 0; i < LOGOS.length; i++) {
    const L = LOGOS[i], px = L.fx * W, py = L.fy * H, fl = Math.sin(t / 780 + i * 1.7) * (chipSize * 0.05);
    if (t < convStart) {
      const ai = appearStart + L.slot * appearStep, ap = clamp((t - ai) / appearDur, 0, 1);
      if (ap <= 0) continue;
      chip(ctx, px, py + fl, chipSize, 0.55 + 0.45 * eoBack(ap), ap, L.type, L.color);
      const lo = clamp((t - lblFadeStart) / lblFadeDur, 0, 1), labelA = ap * (1 - lo) * fade;
      if (labelA > 0.01) { ctx.save(); ctx.globalAlpha = labelA; ctx.fillStyle = '#8A92A1'; ctx.font = `600 ${Math.round(chipSize * 0.27)}px 'Geist', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(L.label, px, py + fl + chipSize * 0.62); ctx.restore(); }
    } else if (t < collideEnd) {
      const cp = clamp((t - convStart) / (collideEnd - convStart), 0, 1), e = eiCubic(cp);
      chip(ctx, lerp(px, cx, e), lerp(py, cy, e), chipSize, lerp(1, 0.12, e), cp < 0.82 ? 1 : clamp(1 - (cp - 0.82) / 0.18, 0, 1), L.type, L.color);
    }
  }
  if (t >= flashStart && t < flashEnd) {
    let fop, fsc;
    if (t < flashPeak) { const f = clamp((t - flashStart) / (flashPeak - flashStart), 0, 1); fop = 0.95 * f; fsc = lerp(0.4, 1, f); }
    else { const f2 = clamp((t - flashPeak) / (flashEnd - flashPeak), 0, 1); fop = 0.95 * (1 - f2); fsc = lerp(1, 1.7, f2); }
    ctx.save(); ctx.globalAlpha = fop; const R = starSize * 1.9 * fsc;
    const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R); fg.addColorStop(0, 'rgba(255,255,255,0.95)'); fg.addColorStop(0.45, 'rgba(47,111,237,0.40)'); fg.addColorStop(1, 'rgba(47,111,237,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.font = `700 ${Math.round(wordSize)}px 'Geist', system-ui, sans-serif`;
  const wordW = ctx.measureText('MaKo').width, gap = starSize * 0.34;
  const groupLeft = cx - (starSize + gap + wordW) / 2, starCenterFinal = groupLeft + starSize / 2, wordLeft = groupLeft + starSize + gap;
  let starOp = 0, starScale = 0, starX = cx;
  if (t >= starStart) {
    starOp = 1;
    if (t < starPop) starScale = 1.14 * eoBack(clamp((t - starStart) / (starPop - starStart), 0, 1));
    else if (t < starSettle) starScale = lerp(1.14, 1, eoCubic(clamp((t - starPop) / (starSettle - starPop), 0, 1)));
    else starScale = 1;
    if (t >= slideStart) { const sp = clamp((t - slideStart) / (slideEnd - slideStart), 0, 1); starX = lerp(cx, starCenterFinal, eInOut(sp)); }
  }
  let wOp = 0, wShift = 0;
  if (t >= wordStart) { const wp = clamp((t - wordStart) / (wordEnd - wordStart), 0, 1); wOp = eoCubic(wp); wShift = lerp(-12, 0, eoCubic(wp)); }
  if (wOp > 0.001) {
    ctx.save(); ctx.globalAlpha = wOp * fade; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tx = wordLeft + wShift, phase = (t % 2600) / 2600, gxc = tx - wordW * 0.4 + phase * (wordW * 1.8);
    const lg = ctx.createLinearGradient(gxc - wordW * 0.5, 0, gxc + wordW * 0.5, 0);
    lg.addColorStop(0, '#171A21'); lg.addColorStop(0.42, '#171A21'); lg.addColorStop(0.5, '#F2A516'); lg.addColorStop(0.58, '#171A21'); lg.addColorStop(1, '#171A21');
    // +6% del tamaño de la estrella: compensa el centro óptico de la tipografía
    ctx.fillStyle = lg; ctx.fillText('MaKo', tx, cy + starSize * 0.06); ctx.restore();
  }
  starBadge(ctx, starX, cy, starSize, starScale, starOp * fade);
}

function ConnectCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ensureLogos();
    const c = canvas as HTMLCanvasElement & { _w: number; _h: number; _dpr: number };
    let raf = 0, t0: number | null = null, dead = false;
    const size = () => {
      const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c._w = Math.max(1, r.width); c._h = Math.max(1, r.height); c._dpr = dpr;
      canvas.width = Math.round(c._w * dpr); canvas.height = Math.round(c._h * dpr);
    };
    let reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    // En BUCLE, igual que el hero de la landing: se sostiene en el lockup un rato
    // y vuelve a empezar. Antes corría una sola vez y se congelaba — quien llegaba
    // scrolleando encontraba una imagen quieta y se perdía la animación entera.
    const HOLD = 1400;                    // cuánto se queda mostrando el lockup
    const CICLO = holdEnd - 40 + HOLD;
    const paint = (t: number) => { ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0); ctx.clearRect(0, 0, c._w, c._h); try { drawMako(ctx, t, c._w, c._h); } catch { /* ignore */ } };
    const loop = (now: number) => { if (dead) return; if (t0 == null) t0 = now; const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - c._w) > 1 || Math.abs(r.height - c._h) > 1) size(); const t = (now - t0) % CICLO; paint(Math.min(t, holdEnd - 40)); raf = requestAnimationFrame(loop); };
    size();
    if (reduce) { paint(holdEnd - 40); return () => { dead = true; }; } // sin movimiento: frame final estático
    raf = requestAnimationFrame(loop);
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 264, display: 'block', borderRadius: 14 }} />;
}

// ── cxJourney: el recorrido del lead como los logos conectándose con flechas ──
// Estilo VSL: cada app aparece, una flecha se dibuja hacia la siguiente, y un
// pulso recorre el camino. En bucle. Real logos.
const JOURNEY = [
  { img: 'meta.png', label: 'Vio el anuncio' },
  { img: 'landing.svg', label: 'Entró a tu web' },
  { img: 'vsl.png', label: 'Miró tu VSL' },
  { img: 'calendly.png', label: 'Agendó' },
  { img: 'whatsapp.png', label: 'Habló con vos' },
  { img: 'pago.svg', label: 'Pagó' },
];
const JIMG: Record<string, HTMLImageElement> = {};
let jLoading = false;
function ensureJourney() {
  if (jLoading || typeof window === 'undefined') return;
  jLoading = true;
  for (const s of JOURNEY) { const im = new Image(); im.src = `/vsl-assets/logos/${s.img}`; JIMG[s.img] = im; }
}
function jReady(img: string): HTMLImageElement | null {
  const im = JIMG[img];
  return im && im.complete && im.naturalWidth > 0 ? im : null;
}
const eoC = (x: number) => 1 - Math.pow(1 - x, 3);
const eoB = (x: number) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function drawJourney(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  ensureJourney();
  const BLUE = '#2F6FED', INK = '#12151B', DIM = '#6B7280', LINE = '#DFE6F1', GREEN = '#1E9E57';
  const n = JOURNEY.length;
  // dos filas de 3 para que entren cómodas y grandes
  const cols = 3, rows = 2, tile = Math.min(58, W * 0.15);
  const cw = W / cols, rh = (H - 30) / rows;
  const pos = JOURNEY.map((_, i) => {
    const r = Math.floor(i / cols); let c = i % cols;
    if (r % 2 === 1) c = cols - 1 - c;                 // serpentea: fila 2 al revés
    return { x: cw * c + cw / 2, y: 34 + rh * r + rh / 2 - 6 };
  });
  const STEP = 620, APP = 380, ARR = 300, LOOP = STEP * n + 1400;
  const tt = t % LOOP;

  ctx.font = "700 13px 'Geist', system-ui, sans-serif";
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('El recorrido de tu cliente', 22, 22);

  // flechas entre pasos (se dibujan en secuencia)
  for (let i = 0; i < n - 1; i++) {
    const born = i * STEP + APP, p = clamp((tt - born) / ARR, 0, 1);
    if (p <= 0) continue;
    const a = pos[i], b = pos[i + 1], e = eoC(p);
    // punto de salida/entrada en el borde del tile
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const sx = a.x + ux * (tile * 0.62), sy = a.y + uy * (tile * 0.62);
    const exf = b.x - ux * (tile * 0.62), eyf = b.y - uy * (tile * 0.62);
    const cx2 = lerp(sx, exf, e), cy2 = lerp(sy, eyf, e);
    ctx.save();
    ctx.strokeStyle = BLUE; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -(t / 22) % 12;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx2, cy2); ctx.stroke();
    ctx.setLineDash([]);
    if (p > 0.9) {                                     // punta de flecha
      const hh = 6;
      ctx.beginPath(); ctx.moveTo(exf, eyf);
      ctx.lineTo(exf - ux * hh - uy * hh * 0.7, eyf - uy * hh + ux * hh * 0.7);
      ctx.lineTo(exf - ux * hh + uy * hh * 0.7, eyf - uy * hh - ux * hh * 0.7);
      ctx.closePath(); ctx.fillStyle = BLUE; ctx.fill();
    }
    ctx.restore();
  }

  // tiles con logo + label
  for (let i = 0; i < n; i++) {
    const born = i * STEP, ap = clamp((tt - born) / APP, 0, 1);
    if (ap <= 0) continue;
    const last = i === n - 1;
    const sc = lerp(0.6, 1, eoB(ap)), P = pos[i];
    ctx.save(); ctx.globalAlpha = eoC(ap); ctx.translate(P.x, P.y); ctx.scale(sc, sc);
    ctx.save(); ctx.shadowColor = 'rgba(16,19,25,0.16)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    rr(ctx, -tile / 2, -tile / 2, tile, tile, tile * 0.28);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    rr(ctx, -tile / 2, -tile / 2, tile, tile, tile * 0.28);
    ctx.lineWidth = last ? 2 : 1; ctx.strokeStyle = last ? GREEN : LINE; ctx.stroke();
    const im = jReady(JOURNEY[i].img);
    if (im) {
      const box = tile * 0.6, fit = box / Math.max(im.naturalWidth, im.naturalHeight);
      const w = im.naturalWidth * fit, h = im.naturalHeight * fit;
      ctx.save(); rr(ctx, -tile / 2, -tile / 2, tile, tile, tile * 0.28); ctx.clip();
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    }
    ctx.restore();
    // label
    ctx.save(); ctx.globalAlpha = eoC(ap);
    ctx.font = "600 11.5px 'Geist', system-ui, sans-serif";
    ctx.fillStyle = last ? GREEN : DIM; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(JOURNEY[i].label, P.x, P.y + tile / 2 + 6);
    ctx.restore();
  }
}

function JourneyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ensureJourney();
    const c = canvas as HTMLCanvasElement & { _w: number; _h: number; _dpr: number };
    let raf = 0, t0: number | null = null, dead = false;
    const size = () => {
      const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c._w = Math.max(1, r.width); c._h = Math.max(1, r.height); c._dpr = dpr;
      canvas.width = Math.round(c._w * dpr); canvas.height = Math.round(c._h * dpr);
    };
    const paint = (t: number) => { ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0); ctx.clearRect(0, 0, c._w, c._h); try { drawJourney(ctx, t, c._w, c._h); } catch { /* ignore */ } };
    const loop = (now: number) => { if (dead) return; if (t0 == null) t0 = now; const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - c._w) > 1 || Math.abs(r.height - c._h) > 1) size(); paint(now - t0); raf = requestAnimationFrame(loop); };
    size(); raf = requestAnimationFrame(loop);
    const onResize = () => size(); window.addEventListener('resize', onResize);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 264, display: 'block', borderRadius: 14 }} />;
}

const CANVAS_REGISTRY: Record<string, () => React.ReactElement> = { cxConnect: ConnectCanvas, cxJourney: JourneyCanvas };

export function VisualCanvas({ type }: { type: string }) {
  const C = CANVAS_REGISTRY[type];
  return C ? <C /> : null;
}
