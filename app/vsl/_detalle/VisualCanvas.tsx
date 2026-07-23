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
  // scale ~0 colapsa el rounded-rect y el canvas lo puede pintar como una raya
  if (opacity <= 0.001 || scale <= 0.02) return;
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
  if (opacity <= 0.001 || scale <= 0.02) return;   // idem: escala 0 = raya
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
// Plural: acá hablamos de los leads en general, no de uno.
// `caen` marca el escalón donde se pierde la mayoría → salta el warning y la
// cinta se FRENA ahí (es el punto de la sección: ver dónde estás fallando).
// Logos que la gente RECONOCE de una: YouTube para el VSL y Meet para la
// reunión (más conocidos que Panda y Calendly, que hacen lo mismo).
const JOURNEY = [
  { img: 'meta.png', label: 'Vieron tu anuncio', n: '9.140' },
  { img: 'landing.svg', label: 'Entraron a la landing', n: '2.310' },
  { img: 'youtube.png', label: 'Miraron tu VSL', n: '1.204' },
  { img: 'meet.png', label: 'Agendaron', n: '186', caen: true },
  { img: 'whatsapp.png', label: 'Hablaron con vos', n: '92' },
  { img: 'pago.svg', label: 'Pagaron', n: '31' },
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

// Cinta HORIZONTAL: los pasos van pasando de derecha a izquierda y la cinta se
// FRENA en el escalón donde se cae la mayoría, con un warning. Sin título: un
// gráfico nunca lleva título (lo dice el copy al lado).
function drawJourney(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  ensureJourney();
  const BLUE = '#2F6FED', INK = '#12151B', DIM = '#6B7280', LINE = '#DFE6F1', GREEN = '#1E9E57', RED = '#DC2626';
  const n = JOURNEY.length, iCae = JOURNEY.findIndex((s) => s.caen);
  const tile = Math.min(76, W * 0.21), gap = tile * 1.5, step = tile + gap;
  const cy = H * 0.46;

  // ── recorrido de la cinta. Movimiento CONTINUO (nada de saltos de paso en
  // paso): la cinta se desliza parejo y solo se detiene donde se cae la mayoría.
  const VEL = 1500;                       // ms por paso, deslizando
  const FRENO = 2800, FIN = 1400;
  const tTotal = iCae * VEL + FRENO + (n - 1 - iCae) * VEL + FIN;
  const tt = t % tTotal;
  let foco: number;                       // posición continua sobre la cinta
  if (tt < iCae * VEL) {
    foco = eInOut(tt / (iCae * VEL)) * iCae;          // arranca y llega suave al freno
  } else if (tt < iCae * VEL + FRENO) {
    foco = iCae;                                       // FRENA: es el punto de la sección
  } else {
    const d = tt - (iCae * VEL + FRENO), tramo2 = (n - 1 - iCae) * VEL;
    foco = iCae + eInOut(clamp(d / tramo2, 0, 1)) * (n - 1 - iCae);
  }
  const originX = W * 0.30 - foco * step;  // el paso enfocado queda a la izquierda-centro

  // ── línea base + tramos ya recorridos
  ctx.save();
  ctx.strokeStyle = LINE; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(originX, cy); ctx.lineTo(originX + (n - 1) * step, cy); ctx.stroke();
  ctx.strokeStyle = BLUE; ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 7]); ctx.lineDashOffset = -(t / 20) % 14;
  ctx.beginPath(); ctx.moveTo(originX, cy); ctx.lineTo(originX + foco * step, cy); ctx.stroke();
  ctx.restore();

  for (let i = 0; i < n; i++) {
    const x = originX + i * step;
    if (x < -tile * 1.6 || x > W + tile * 1.6) continue;
    const activo = i <= foco + 0.02, esCae = i === iCae, last = i === n - 1;
    // el enfocado se agranda; los ya pasados quedan atenuados
    const cerca = 1 - Math.min(1, Math.abs(i - foco));
    const sc = lerp(0.82, 1.06, cerca), al = activo ? lerp(0.45, 1, cerca) : 0.3;
    const borde = esCae && activo ? RED : last && activo ? GREEN : LINE;

    ctx.save(); ctx.globalAlpha = al; ctx.translate(x, cy); ctx.scale(sc, sc);
    ctx.save(); ctx.shadowColor = 'rgba(16,19,25,0.18)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    rr(ctx, -tile / 2, -tile / 2, tile, tile, tile * 0.28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    rr(ctx, -tile / 2, -tile / 2, tile, tile, tile * 0.28);
    ctx.lineWidth = borde === LINE ? 1 : 2.2; ctx.strokeStyle = borde; ctx.stroke();
    const im = jReady(JOURNEY[i].img);
    if (im) {
      const box = tile * 0.56, fit = box / Math.max(im.naturalWidth, im.naturalHeight);
      const w = im.naturalWidth * fit, h = im.naturalHeight * fit;
      ctx.save(); rr(ctx, -tile / 2, -tile / 2, tile, tile, tile * 0.28); ctx.clip();
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    }
    ctx.restore();

    // label + cuántos llegaron
    ctx.save(); ctx.globalAlpha = al; ctx.textAlign = 'center';
    ctx.font = "600 12px 'Geist', system-ui, sans-serif";
    ctx.fillStyle = esCae && activo ? RED : last && activo ? GREEN : DIM; ctx.textBaseline = 'top';
    ctx.fillText(JOURNEY[i].label, x, cy + tile * 0.62);
    ctx.font = "700 15px 'Geist Mono', ui-monospace, monospace";
    ctx.fillStyle = INK; ctx.fillText(JOURNEY[i].n, x, cy + tile * 0.62 + 17);
    ctx.restore();
  }

  // ── WARNING sobre el escalón que se cae
  if (Math.abs(foco - iCae) < 0.06) {
    const x = originX + iCae * step;
    const ap = eoC(clamp((tt - iCae * VEL) / 340, 0, 1));
    const txt = 'Acá se cae la mayoría';
    ctx.save();
    ctx.font = "700 12.5px 'Geist', system-ui, sans-serif";
    const wTxt = ctx.measureText(txt).width, padH = 13, bw = wTxt + padH * 2 + 22, bh = 32;
    const by = cy - tile * 0.62 - bh - 12 + lerp(8, 0, ap);
    ctx.globalAlpha = ap;
    ctx.save(); ctx.shadowColor = 'rgba(220,38,38,0.28)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    rr(ctx, x - bw / 2, by, bw, bh, 10); ctx.fillStyle = '#FEF2F2'; ctx.fill(); ctx.restore();
    rr(ctx, x - bw / 2, by, bw, bh, 10); ctx.lineWidth = 1.4; ctx.strokeStyle = '#F7C6C6'; ctx.stroke();
    // "!" en círculo
    ctx.beginPath(); ctx.arc(x - bw / 2 + padH + 7, by + bh / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = RED; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = "800 11px 'Geist', system-ui, sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x - bw / 2 + padH + 7, by + bh / 2 + 0.5);
    ctx.font = "700 12.5px 'Geist', system-ui, sans-serif"; ctx.fillStyle = '#B91C1C'; ctx.textAlign = 'left';
    ctx.fillText(txt, x - bw / 2 + padH + 20, by + bh / 2);
    // punta hacia el tile
    ctx.beginPath(); ctx.moveTo(x, by + bh + 7); ctx.lineTo(x - 6, by + bh); ctx.lineTo(x + 6, by + bh);
    ctx.closePath(); ctx.fillStyle = '#FEF2F2'; ctx.fill();
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

// ── cxChat: MaKo avisándote por WhatsApp, con los mensajes llegando de a uno ──
// Es lo que MaKo YA hace. Diseño calcado de WhatsApp (oscuro, burbuja verde a la
// derecha = MaKo, gris a la izquierda = vos) y en bucle.
type Msg =
  | { de: 'mako' | 'yo'; t: string; hora: string; tipo?: undefined }
  | { de: 'mako'; tipo: 'pdf'; nombre: string; meta: string; hora: string; t?: undefined };
const CHAT: Msg[] = [
  { de: 'mako', t: '🔵 Entró un lead nuevo: *José Rodríguez*, de la campaña RECON de Julio.', hora: '09:14' },
  { de: 'mako', t: 'Vio tu VSL hasta el *27%* y se fue. Todavía no agendó.', hora: '09:16' },
  { de: 'mako', t: 'Volvió a entrar y esta vez llegó al *88%*, pero no agendó. ¿Le mando el seguimiento?', hora: '12:41' },
  { de: 'yo', t: 'Sí, dale', hora: '12:43' },
  { de: 'mako', t: '✅ Listo. *José agendó* para mañana a las 15:00.', hora: '18:02' },
  { de: 'mako', tipo: 'pdf', nombre: 'Ficha del lead — José Rodríguez.PDF', meta: '2 páginas · PDF · 148 kB', hora: '18:02' },
];
const WA_BG = '#0B141A', WA_VERDE = '#005C4B', WA_GRIS = '#202C33', WA_TXT = '#E9EDEF', WA_HORA = 'rgba(233,237,239,0.5)';

function wrap(ctx: CanvasRenderingContext2D, txt: string, maxW: number): string[] {
  const out: string[] = [];
  for (const parr of txt.split('\n')) {
    let linea = '';
    for (const w of parr.split(' ')) {
      const p = linea ? linea + ' ' + w : w;
      if (ctx.measureText(p.replace(/\*/g, '')).width > maxW && linea) { out.push(linea); linea = w; } else linea = p;
    }
    out.push(linea);
  }
  return out;
}
// pinta un texto con *negritas* entre asteriscos
function txtBold(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) {
  let cx = x;
  for (const parte of s.split(/(\*[^*]+\*)/g)) {
    if (!parte) continue;
    const bold = parte.startsWith('*') && parte.endsWith('*');
    const limpio = bold ? parte.slice(1, -1) : parte;
    ctx.font = `${bold ? 700 : 400} ${size}px 'Geist', system-ui, sans-serif`;
    ctx.fillText(limpio, cx, y);
    cx += ctx.measureText(limpio).width;
  }
}

function drawChat(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  ctx.save();
  ctx.fillStyle = WA_BG; ctx.fillRect(0, 0, W, H);

  const FS = 12.5, LH = 17, PAD = 9, RAD = 9, maxBub = W * 0.72;
  const PASO = 1400, LOOP = CHAT.length * PASO + 2600;
  const tt = t % LOOP;
  const vistos = Math.min(CHAT.length, Math.floor(tt / PASO) + 1);

  // medir todo para poder anclar el chat abajo (como WhatsApp: crece hacia arriba)
  ctx.font = `400 ${FS}px 'Geist', system-ui, sans-serif`;
  const bloques = CHAT.map((m) => {
    if (m.tipo === 'pdf') return { m, lineas: [] as string[], h: 96 };
    const l = wrap(ctx, m.t!, maxBub - PAD * 2 - 30);
    return { m, lineas: l, h: l.length * LH + PAD * 2 + 6 };
  });
  // Anclado abajo: cuando ya no entra, los más viejos se van por arriba —
  // igual que un chat de verdad.
  let total = 0; for (let i = 0; i < vistos; i++) total += bloques[i].h + 8;
  let y = H - 12 - total;

  for (let i = 0; i < vistos; i++) {
    const b = bloques[i], m = b.m, mia = m.de === 'mako';
    const ap = eoC(clamp((tt - i * PASO) / 320, 0, 1));
    const dy = lerp(10, 0, ap);
    const wBub = m.tipo === 'pdf' ? maxBub
      : Math.min(maxBub, Math.max(...b.lineas.map((l) => ctx.measureText(l.replace(/\*/g, '')).width)) + PAD * 2 + 34);
    const x = mia ? W - 12 - wBub : 12;

    ctx.save(); ctx.globalAlpha = ap; ctx.translate(0, dy);
    rr(ctx, x, y, wBub, b.h, RAD);
    ctx.fillStyle = mia ? WA_VERDE : WA_GRIS; ctx.fill();

    if (m.tipo === 'pdf') {
      // vista previa + fila del documento, como el adjunto de WhatsApp
      rr(ctx, x + 6, y + 6, wBub - 12, 40, 6); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.fillStyle = '#B8C4CC'; ctx.font = `400 7px 'Geist', system-ui, sans-serif`;
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 14, y + 15 + k * 7, (wBub - 40) * (k === 3 ? 0.4 : 0.8), 2.5);
      // ícono PDF
      rr(ctx, x + 10, y + 54, 26, 30, 4); ctx.fillStyle = '#E74C3C'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 8.5px 'Geist', system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.fillText('PDF', x + 23, y + 72); ctx.textAlign = 'left';
      ctx.fillStyle = WA_TXT; ctx.font = `600 11.5px 'Geist', system-ui, sans-serif`;
      ctx.fillText(m.nombre.length > 34 ? m.nombre.slice(0, 33) + '…' : m.nombre, x + 44, y + 66);
      ctx.fillStyle = WA_HORA; ctx.font = `400 10px 'Geist', system-ui, sans-serif`;
      ctx.fillText(m.meta, x + 44, y + 80);
    } else {
      ctx.fillStyle = WA_TXT; ctx.textBaseline = 'alphabetic';
      b.lineas.forEach((l, k) => txtBold(ctx, l, x + PAD, y + PAD + LH * (k + 0.75), FS));
    }
    // hora + doble check
    ctx.fillStyle = WA_HORA; ctx.font = `400 9.5px 'Geist', system-ui, sans-serif`;
    ctx.textAlign = 'right'; ctx.fillText(m.hora, x + wBub - (mia ? 20 : 8), y + b.h - 7); ctx.textAlign = 'left';
    if (mia) {
      ctx.strokeStyle = '#53BDEB'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      const cx0 = x + wBub - 16, cy0 = y + b.h - 11;
      ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + 2.6, cy0 + 3); ctx.lineTo(cx0 + 7, cy0 - 2.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx0 + 4, cy0); ctx.lineTo(cx0 + 6.6, cy0 + 3); ctx.lineTo(cx0 + 11, cy0 - 2.6); ctx.stroke();
    }
    ctx.restore();
    y += b.h + 8;
  }
  ctx.restore();
}

function ChatCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const c = canvas as HTMLCanvasElement & { _w: number; _h: number; _dpr: number };
    let raf = 0, t0: number | null = null, dead = false;
    const size = () => {
      const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c._w = Math.max(1, r.width); c._h = Math.max(1, r.height); c._dpr = dpr;
      canvas.width = Math.round(c._w * dpr); canvas.height = Math.round(c._h * dpr);
    };
    const paint = (t: number) => { ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0); ctx.clearRect(0, 0, c._w, c._h); try { drawChat(ctx, t, c._w, c._h); } catch { /* ignore */ } };
    const loop = (now: number) => { if (dead) return; if (t0 == null) t0 = now; const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - c._w) > 1 || Math.abs(r.height - c._h) > 1) size(); paint(now - t0); raf = requestAnimationFrame(loop); };
    size(); raf = requestAnimationFrame(loop);
    const onResize = () => size(); window.addEventListener('resize', onResize);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 430, display: 'block', borderRadius: 14 }} />;
}

const CANVAS_REGISTRY: Record<string, () => React.ReactElement> = { cxConnect: ConnectCanvas, cxJourney: JourneyCanvas, cxChat: ChatCanvas };

export function VisualCanvas({ type }: { type: string }) {
  const C = CANVAS_REGISTRY[type];
  return C ? <C /> : null;
}
