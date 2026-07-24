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

  // ── recorrido de la cinta: se DESLIZA suave de un paso al siguiente y PARA en
  // cada uno el tiempo suficiente para leerlo. Ni saltos secos ni un scroll
  // continuo donde los pasos pasan borrosos.
  const DESLIZA = 700, LEE = 900;         // moverse / quedarse quieto en cada paso
  const EXTRA_CAE = 1000;                 // en el que se cae, un toque más (no eterno)
  const FIN = 1100;
  const paso = DESLIZA + LEE;
  const tTotal = (n - 1) * paso + LEE + EXTRA_CAE + FIN;
  const tt = t % tTotal;

  // avanzar paso por paso acumulando, con la pausa extra en el que falla
  let foco = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    const espera = LEE + (i === iCae ? EXTRA_CAE : 0);
    if (tt < acc + espera) { foco = i; break; }        // quieto, leyendo este paso
    acc += espera;
    if (i === n - 1) { foco = n - 1; break; }
    if (tt < acc + DESLIZA) { foco = i + eInOut((tt - acc) / DESLIZA); break; }
    acc += DESLIZA;
    foco = i + 1;
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
    const ap = eoC(clamp((tt - (iCae * paso)) / 300, 0, 1));
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

// cabecera de WhatsApp: avatar de MaKo, nombre, y los íconos de la derecha
function waHeader(ctx: CanvasRenderingContext2D, W: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#202C33'; ctx.fillRect(0, 0, W, h);
  // avatar: badge oscuro con la estrella dorada
  const cx = 26, cy = h / 2;
  ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fillStyle = '#1A1712'; ctx.fill();
  sparkle(ctx, cx, cy, 8, '#F2B01E');
  ctx.fillStyle = '#E9EDEF'; ctx.font = "700 13px 'Geist', system-ui, sans-serif";
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('MaKo', 50, cy - 1);
  ctx.fillStyle = 'rgba(233,237,239,0.55)'; ctx.font = "400 10.5px 'Geist', system-ui, sans-serif";
  ctx.fillText('en línea', 50, cy + 12);
  // íconos: videollamada, llamada, ⋮
  ctx.strokeStyle = '#AEBAC1'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ix = W - 86;
  rr(ctx, ix, cy - 6, 14, 12, 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ix + 15, cy - 3); ctx.lineTo(ix + 20, cy - 6); ctx.lineTo(ix + 20, cy + 6); ctx.lineTo(ix + 15, cy + 3); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ix + 36, cy - 6); ctx.lineTo(ix + 40, cy - 2); ctx.lineTo(ix + 37, cy + 1); ctx.lineTo(ix + 43, cy + 7); ctx.lineTo(ix + 46, cy + 4); ctx.stroke();
  ctx.fillStyle = '#AEBAC1';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(W - 22, cy - 6 + k * 6, 1.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
// barra de abajo: +, sticker, "Escribe un mensaje", micrófono
function waFooter(ctx: CanvasRenderingContext2D, W: number, H: number, h: number) {
  const y = H - h;
  ctx.save();
  ctx.fillStyle = '#111B21'; ctx.fillRect(0, y, W, h);
  const cy = y + h / 2;
  ctx.strokeStyle = '#8696A0'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(16, cy - 6); ctx.lineTo(16, cy + 6); ctx.moveTo(10, cy); ctx.lineTo(22, cy); ctx.stroke();  // +
  ctx.beginPath(); ctx.arc(42, cy, 7, 0, Math.PI * 2); ctx.stroke();                                                      // sticker
  ctx.beginPath(); ctx.arc(39.5, cy - 2, 1, 0, Math.PI * 2); ctx.arc(44.5, cy - 2, 1, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(42, cy + 1, 3.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  rr(ctx, 58, cy - 13, W - 58 - 40, 26, 13); ctx.fillStyle = '#2A3942'; ctx.fill();                                       // campo
  ctx.fillStyle = '#8696A0'; ctx.font = "400 11.5px 'Geist', system-ui, sans-serif";
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Escribe un mensaje', 70, cy);
  const mx = W - 22;                                                                                                       // micrófono
  ctx.strokeStyle = '#8696A0'; rr(ctx, mx - 3.5, cy - 9, 7, 11, 3.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, cy + 1, 6, 0, Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, cy + 7); ctx.lineTo(mx, cy + 10); ctx.stroke();
  ctx.restore();
}

function drawChat(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, msgs: Msg[], ownSide: 'mako' | 'yo') {
  ctx.save();
  ctx.fillStyle = WA_BG; ctx.fillRect(0, 0, W, H);

  const HEAD = 48, FOOT = 46;
  const FS = 12.5, LH = 17, PAD = 9, RAD = 9, maxBub = W * 0.72;
  const PASO = 2100, LOOP = msgs.length * PASO + 3800;   // que dé tiempo a leer
  const tt = t % LOOP;
  const vistos = Math.min(msgs.length, Math.floor(tt / PASO) + 1);

  // medir todo para poder anclar el chat abajo (como WhatsApp: crece hacia arriba)
  ctx.font = `400 ${FS}px 'Geist', system-ui, sans-serif`;
  const bloques = msgs.map((m) => {
    if (m.tipo === 'pdf') return { m, lineas: [] as string[], h: 96 };
    const l = wrap(ctx, m.t!, maxBub - PAD * 2 - 30);
    return { m, lineas: l, h: l.length * LH + PAD * 2 + 6 };
  });
  // Anclado abajo (sobre la barra de escribir): cuando ya no entra, los más
  // viejos se van por arriba — igual que un chat de verdad.
  let total = 0; for (let i = 0; i < vistos; i++) total += bloques[i].h + 8;
  let y = H - FOOT - 10 - total;
  ctx.save(); ctx.beginPath(); ctx.rect(0, HEAD, W, H - HEAD - FOOT); ctx.clip();

  for (let i = 0; i < vistos; i++) {
    const b = bloques[i], m = b.m, mia = m.de === ownSide;
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
  ctx.restore();                       // fin del clip de la zona de mensajes
  waHeader(ctx, W, HEAD);
  waFooter(ctx, W, H, FOOT);
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
    const paint = (t: number) => { ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0); ctx.clearRect(0, 0, c._w, c._h); try { drawChat(ctx, t, c._w, c._h, CHAT, 'mako'); } catch { /* ignore */ } };
    const loop = (now: number) => { if (dead) return; if (t0 == null) t0 = now; const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - c._w) > 1 || Math.abs(r.height - c._h) > 1) size(); paint(now - t0); raf = requestAnimationFrame(loop); };
    size(); raf = requestAnimationFrame(loop);
    const onResize = () => size(); window.addEventListener('resize', onResize);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 480, display: 'block', borderRadius: 14 }} />;
}

// ── cxCrmChat: MaKo maneja el CRM solo y te avisa por WhatsApp ────────────────
// Mismo motor que cxChat, pero acá MaKo va a la IZQUIERDA (gris, entrante) y vos
// a la DERECHA (verde, saliente) — como WhatsApp de verdad. Cada mensaje es una
// cosa que MaKo hizo sola en el CRM, a lo largo de TODO el recorrido del lead:
// entró → se agendó → vino → se enfrió → reactivación. Se entiende solo cada uno.
const CRM_CHAT: Msg[] = [
  { de: 'mako', t: 'Nuevo lead: *José Rodríguez*, de tu campaña de Julio. Lo cargué al CRM.', hora: '09:14' },
  { de: 'mako', t: '*José Rodríguez* se agendó para dentro de 3 días. ¿Te armo su ficha para la reunión?', hora: '09:15' },
  { de: 'yo', t: 'Dale 👍', hora: '09:16' },
  { de: 'mako', tipo: 'pdf', nombre: 'Ficha — José Rodríguez.PDF', meta: '2 páginas · PDF · 148 kB', hora: '09:16' },
  { de: 'mako', t: '*José Rodríguez* asistió a la llamada. Lo marqué *Presente* en el CRM.', hora: '15:42' },
  { de: 'mako', t: '*José Rodríguez* lleva 1 día sin responder. Su freno en la llamada fue el precio.', hora: '10:20' },
  { de: 'mako', t: '*José Rodríguez* lleva 2 días sin responder. Lo muevo a *Nutrición de Reactivación*.', hora: '11:05' },
];

function CrmChatCanvas() {
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
    const paint = (t: number) => { ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0); ctx.clearRect(0, 0, c._w, c._h); try { drawChat(ctx, t, c._w, c._h, CRM_CHAT, 'yo'); } catch { /* ignore */ } };
    const loop = (now: number) => { if (dead) return; if (t0 == null) t0 = now; const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - c._w) > 1 || Math.abs(r.height - c._h) > 1) size(); paint(now - t0); raf = requestAnimationFrame(loop); };
    size(); raf = requestAnimationFrame(loop);
    const onResize = () => size(); window.addEventListener('resize', onResize);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} style={{ width: '100%', height: 480, display: 'block', borderRadius: 14 }} />;
}

// ── Factory de canvas: mismo bucle rAF para cualquier draw(ctx,t,W,H) ─────────
// (evita repetir el boilerplate por cada gráfico nuevo; los que faltan son 20+)
function makeCanvas(draw: (ctx: CanvasRenderingContext2D, t: number, W: number, H: number) => void, height: number) {
  return function Fx() {
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
      const paint = (t: number) => { ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0); ctx.clearRect(0, 0, c._w, c._h); try { draw(ctx, t, c._w, c._h); } catch { /* ignore */ } };
      const loop = (now: number) => { if (dead) return; if (t0 == null) t0 = now; const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - c._w) > 1 || Math.abs(r.height - c._h) > 1) size(); paint(now - t0); raf = requestAnimationFrame(loop); };
      size(); raf = requestAnimationFrame(loop);
      const onResize = () => size(); window.addEventListener('resize', onResize);
      return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
    }, []);
    return <canvas ref={ref} style={{ width: '100%', height, display: 'block', borderRadius: 14 }} />;
  };
}

// ── Kanban compartido (gráficos del CRM) ─────────────────────────────────────
type KTone = 'blue' | 'green' | 'amber' | 'gray';
type KCard = { name: string; tag: string; tone: KTone; star?: boolean };
const KB_INK = '#1B2432', KB_DIM = '#8A94A6', KB_LINE = '#E6EAF1', KB_COLBG = '#F1F4F9';
const KB_TONE: Record<KTone, string> = { blue: '#2F6FED', green: '#1E9E57', amber: '#E0890C', gray: '#9AA5B5' };
const KB_TITLES = ['Nuevos', 'Agendados', 'Ganados'];
const COL_HEAD = 26, CARD_H = 42, CARD_GAP = 9, KB_PAD = 14, KB_COLGAP = 10;

type Col = { title: string; x: number; y: number; w: number; h: number };
function kbColumns(W: number, top: number, h: number): Col[] {
  const n = KB_TITLES.length;
  const colW = (W - KB_PAD * 2 - KB_COLGAP * (n - 1)) / n;
  return KB_TITLES.map((title, i) => ({ title, x: KB_PAD + i * (colW + KB_COLGAP), y: top, w: colW, h }));
}
function kbSlot(col: Col, idx: number) {
  return { x: col.x + 8, y: col.y + COL_HEAD + 8 + idx * (CARD_H + CARD_GAP), w: col.w - 16 };
}
function kbColShell(ctx: CanvasRenderingContext2D, col: Col) {
  rr(ctx, col.x, col.y, col.w, col.h, 12); ctx.fillStyle = KB_COLBG; ctx.fill();
  ctx.fillStyle = KB_DIM; ctx.font = "700 10px 'Geist', system-ui, sans-serif";
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(col.title.toUpperCase(), col.x + 12, col.y + 14);
}
function kbCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, card: KCard, alpha = 1, lift = 0) {
  const h = CARD_H;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.save(); ctx.shadowColor = `rgba(20,28,45,${(0.08 + lift * 0.14).toFixed(3)})`; ctx.shadowBlur = 7 + lift * 16; ctx.shadowOffsetY = 2 + lift * 7;
  rr(ctx, x, y - lift * 3, w, h, 9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  const yy = y - lift * 3;
  rr(ctx, x, yy, w, h, 9); ctx.strokeStyle = KB_LINE; ctx.lineWidth = 1; ctx.stroke();
  rr(ctx, x, yy + 8, 3.5, h - 16, 2); ctx.fillStyle = KB_TONE[card.tone]; ctx.fill();
  ctx.fillStyle = KB_INK; ctx.font = "600 11.5px 'Geist', system-ui, sans-serif";
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(card.name, x + 12, yy + 18);
  ctx.fillStyle = KB_DIM; ctx.font = "400 9.5px 'Geist', system-ui, sans-serif"; ctx.fillText(card.tag, x + 12, yy + 32);
  if (card.star) { rr(ctx, x + w - 22, yy + 6, 15, 15, 4); ctx.fillStyle = '#1A1712'; ctx.fill(); sparkle(ctx, x + w - 14.5, yy + 13.5, 4.2, '#F2B01E'); }
  ctx.restore();
}

// ── cxCrmExcel: el Excel precario que CORTA al tablero limpio de MaKo ─────────
// Situación A del cliente (llenar el CRM a mano en un Excel, con errores) y de
// golpe el corte al tablero ordenado. Sin títulos: el contraste ES el mensaje.
type ECell = { t: string; red?: boolean };
const EXCEL_HEADS = ['Nombre', 'Teléfono', 'Estado', 'Fecha', 'Nota'];
const EXCEL_ROWS: ECell[][] = [
  [{ t: 'José Rodríguez' }, { t: '55 1234' }, { t: 'agendó?', red: true }, { t: '12/7' }, { t: '' }],
  [{ t: 'laura m.' }, { t: '' }, { t: '???', red: true }, { t: '' }, { t: 'llamar!!' }],
  [{ t: '#REF!', red: true }, { t: '', red: true }, { t: '', red: true }, { t: '' }, { t: '' }],
  [{ t: 'Carlos' }, { t: '55 99..' }, { t: 'perdido?', red: true }, { t: '3/7' }, { t: 'no contesta' }],
  [{ t: '' }, { t: '' }, { t: '' }, { t: '' }, { t: '' }],
  [{ t: 'PEDRO G' }, { t: '5577' }, { t: 'GANADO' }, { t: '' }, { t: '' }],
  [{ t: 'Marcelo' }, { t: '55 8' }, { t: '__EDIT__' }, { t: '' }, { t: '' }],
  [{ t: 'Jose Rodriguez' }, { t: '55 1234' }, { t: '', red: true }, { t: '' }, { t: 'dup?' }],
];
// vidrio que se astilla ENTERO: radiales largas (llegan a los bordes) + anillos
// de telaraña. Generado una sola vez, determinista (sin random en cada frame).
function buildShatter() {
  let s = 7; const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const N = 18, RINGS = [46, 112, 195, 300, 430];
  const br: { x: number; y: number }[][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    br.push(RINGS.map((r) => { const aa = a + (rnd() - 0.5) * 0.26, rd = r * (0.82 + rnd() * 0.45); return { x: Math.cos(aa) * rd, y: Math.sin(aa) * rd }; }));
  }
  return br;
}
const SHATTER = buildShatter();
function drawCracks(ctx: CanvasRenderingContext2D, cx: number, cy: number, p: number) {
  const e = eoCubic(clamp(p, 0, 1)); if (e <= 0.001) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = clamp(p * 1.5, 0, 1);
  const paint = () => {
    for (const b of SHATTER) { ctx.beginPath(); ctx.moveTo(cx, cy); for (const pt of b) ctx.lineTo(cx + pt.x * e, cy + pt.y * e); ctx.stroke(); }
    for (let ring = 0; ring < 3; ring++) { ctx.beginPath(); for (let i = 0; i <= SHATTER.length; i++) { const b = SHATTER[i % SHATTER.length][ring]; const x = cx + b.x * e, y = cy + b.y * e; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  };
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.4; paint();
  ctx.strokeStyle = '#2B303A'; ctx.lineWidth = 0.9; paint();
  ctx.restore();
}

function drawExcel(ctx: CanvasRenderingContext2D, W: number, H: number, tt: number) {
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  // barra de archivo (acento verde tipo Excel)
  ctx.fillStyle = '#F3F4F2'; ctx.fillRect(0, 0, W, 24);
  ctx.fillStyle = '#1E7145'; ctx.fillRect(0, 0, 4, 24);
  ctx.fillStyle = '#5A6470'; ctx.font = "600 11px 'Geist', system-ui, sans-serif";
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('CRM_leads_FINAL_v3.xlsx', 14, 12);
  // rejilla
  const gut = 26, top = 24, headH = 22, rowH = (H - top - headH) / EXCEL_ROWS.length;
  const cols = EXCEL_HEADS.length, tableW = W - gut;
  const frac = [0.30, 0.18, 0.20, 0.15, 0.17];
  const cx: number[] = [gut]; for (let i = 0; i < cols; i++) cx.push(cx[i] + tableW * frac[i]);
  // encabezado verde
  ctx.fillStyle = '#217346'; ctx.fillRect(gut, top, tableW, headH);
  ctx.fillStyle = '#F3F4F2'; ctx.fillRect(0, top, gut, headH);
  ctx.fillStyle = '#FFFFFF'; ctx.font = "700 10.5px 'Geist', system-ui, sans-serif"; ctx.textBaseline = 'middle';
  EXCEL_HEADS.forEach((h, i) => { ctx.textAlign = 'left'; ctx.fillText(h, cx[i] + 6, top + headH / 2); });
  // filas
  let editBox: { x: number; y: number; w: number; h: number; txt: string } | null = null;
  EXCEL_ROWS.forEach((row, r) => {
    const y = top + headH + r * rowH;
    // gutter con número de fila
    ctx.fillStyle = '#F3F4F2'; ctx.fillRect(0, y, gut, rowH);
    ctx.fillStyle = '#98A2AE'; ctx.font = "400 9px 'Geist', system-ui, sans-serif";
    ctx.textAlign = 'center'; ctx.fillText(String(r + 1), gut / 2, y + rowH / 2);
    row.forEach((cell, i) => {
      const x = cx[i], w = cx[i + 1] - cx[i];
      if (cell.red && cell.t) { ctx.fillStyle = 'rgba(226,86,86,0.10)'; ctx.fillRect(x, y, w, rowH); }
      const editing = cell.t === '__EDIT__';
      if (editing) { editBox = { x, y, w, h: rowH, txt: 'Presen' }; }
      else if (cell.t) {
        ctx.fillStyle = cell.red ? '#D64545' : '#3A424E';
        ctx.font = "400 10px 'Geist', system-ui, sans-serif"; ctx.textAlign = 'left';
        const s = cell.t.length > 16 ? cell.t.slice(0, 15) + '…' : cell.t;
        ctx.fillText(s, x + 6, y + rowH / 2);
      }
    });
  });
  // gridlines
  ctx.strokeStyle = '#E3E6E1'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= cols; i++) { const x = cx[i] ?? W; ctx.moveTo(x + 0.5, top); ctx.lineTo(x + 0.5, H); }
  for (let r = 0; r <= EXCEL_ROWS.length; r++) { const y = top + headH + r * rowH; ctx.moveTo(gut, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.moveTo(gut + 0.5, top); ctx.lineTo(gut + 0.5, H); ctx.stroke();
  // celda en edición: borde verde de selección + cursor que parpadea
  if (editBox) {
    const b = editBox as { x: number; y: number; w: number; h: number; txt: string };
    ctx.strokeStyle = '#217346'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = '#3A424E'; ctx.font = "400 10px 'Geist', system-ui, sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(b.txt, b.x + 6, b.y + b.h / 2);
    if (Math.floor(tt / 500) % 2 === 0) {
      const cxx = b.x + 6 + ctx.measureText(b.txt).width + 1;
      ctx.strokeStyle = '#3A424E'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cxx, b.y + 5); ctx.lineTo(cxx, b.y + b.h - 5); ctx.stroke();
    }
  }
}

// BASTA cae del cielo y astilla el Excel entero como un vidrio; después van
// apareciendo las líneas de a una (se leen de a poco), centradas y espaciadas.
// El Excel se sigue viendo atrás (velo tenue + sombra en el texto).
function drawCrmExcel(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  const EXCEL = 2400, DROP = 460, POST = 4600, LOOP = EXCEL + DROP + POST, tt = t % LOOP;
  const cx = W / 2, impactY = H * 0.28;
  const ai = tt - (EXCEL + DROP);                 // ms desde el impacto (< 0 si aún no cayó)
  let sx = 0, sy = 0;                              // temblor breve al romperse
  if (ai > 0 && ai < 300) { const d = 1 - ai / 300; sx = Math.sin(ai * 0.9) * 8 * d; sy = Math.cos(ai * 1.1) * 5 * d; }
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = '#F5F7FB'; ctx.fillRect(-8, -8, W + 16, H + 16);
  drawExcel(ctx, W, H, tt);                        // el Excel SIEMPRE detrás
  if (ai > 0) {
    ctx.save(); ctx.globalAlpha = 0.42 * clamp(ai / 280, 0, 1); ctx.fillStyle = '#F7F8FB'; ctx.fillRect(-8, -8, W + 16, H + 16); ctx.restore();
    drawCracks(ctx, cx, impactY, ai / 180);        // astilla RÁPIDO y llega a los bordes
    if (ai < 160) { ctx.save(); ctx.globalAlpha = (1 - ai / 160) * 0.9; const g = ctx.createRadialGradient(cx, impactY, 0, cx, impactY, W * 0.6); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  ctx.restore();

  // TEXTO (con el mismo temblor). Cada línea aparece en su momento.
  ctx.save(); ctx.translate(sx, sy);
  const linea = (txt: string, y: number, font: string, color: string, appearAt: number, star: boolean) => {
    const a = eoC(clamp((ai - appearAt) / 400, 0, 1)); if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(10,12,18,0.34)'; ctx.shadowBlur = 13; ctx.shadowOffsetY = 4;
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle';
    if (star) {
      const wlab = ctx.measureText(txt).width, sk = 14, startX = cx - (wlab + sk + 10) / 2;
      sparkle(ctx, startX + sk / 2, y, sk / 2, '#F2B01E');
      ctx.textAlign = 'left'; ctx.fillText(txt, startX + sk + 10, y);
    } else { ctx.textAlign = 'center'; ctx.fillText(txt, cx, y); }
    ctx.restore();
  };
  if (tt >= EXCEL) {                                // BASTA cae PRIMERO
    const dropP = clamp((tt - EXCEL) / DROP, 0, 1);
    const by = tt < EXCEL + DROP ? lerp(-60, impactY, eiCubic(dropP)) : impactY;
    const scale = ai > 0 ? lerp(1.2, 1, eoCubic(clamp(ai / 160, 0, 1))) : 1;
    ctx.save(); ctx.translate(cx, by); ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(10,12,18,0.4)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#14171D'; ctx.font = "800 62px 'Geist', system-ui, sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BASTA', 0, 0); ctx.restore();
  }
  linea('de planillas aburridas', impactY + 66, "600 20px 'Geist', system-ui, sans-serif", '#3A424E', 600, false);
  linea('Con MaKo', impactY + 118, "700 24px 'Geist', system-ui, sans-serif", '#14171D', 1300, true);
  linea('Nunca más.', impactY + 166, "700 21px 'Geist', system-ui, sans-serif", '#2F6FED', 2000, false);
  ctx.restore();
}

// ── cxCrmSecuencia: pregunta → MaKo responde moviendo el lead, con barrido ────
// Sin manos. Un texto pregunta ("¿entró un lead?"), MaKo responde ("lo agrega
// al CRM") y la card aparece / se mueve sola con un barrido dorado.
type SeqBeat = { q: string; a: string; kind: 'reveal' | 'move'; to: number };
const SEQ_STATIC: { col: number; card: KCard }[] = [
  { col: 0, card: { name: 'Ana Torres', tag: 'Entró por Meta', tone: 'blue' } },
  { col: 1, card: { name: 'Diego Sosa', tag: 'Martes 16:00', tone: 'amber' } },
  { col: 2, card: { name: 'Marta Pérez', tag: 'Cerró · $4.500', tone: 'green' } },
];
const SEQ_BEATS: SeqBeat[] = [
  { q: '¿Entró un lead nuevo por Meta?', a: 'MaKo lo agrega al CRM', kind: 'reveal', to: 0 },
  { q: '¿Ese lead agendó la llamada?', a: 'MaKo lo mueve solo', kind: 'move', to: 1 },
  { q: '¿Cerró la venta?', a: 'MaKo lo pasa a Ganados', kind: 'move', to: 2 },
];
const SEQ_TAGS = ['Entró por Meta', 'Jueves 15:00', 'Cerró · $4.500'];
const SEQ_TONES: KTone[] = ['blue', 'amber', 'green'];

function goldSweep(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: number) {
  ctx.save(); ctx.beginPath(); rr(ctx, x, y, w, h, 9); ctx.clip();
  const g = ctx.createLinearGradient(edge - 16, 0, edge + 8, 0);
  g.addColorStop(0, 'rgba(242,176,30,0)'); g.addColorStop(0.65, 'rgba(242,176,30,0.9)'); g.addColorStop(1, 'rgba(255,246,214,0.95)');
  ctx.fillStyle = g; ctx.fillRect(edge - 16, y - 2, 26, h + 4); ctx.restore();
}

// Ritmo en dos tiempos por paso: PRIMERO la pregunta en grande y centrada (sin
// kanban); DESPUÉS desaparece y aparece el kanban con la respuesta de MaKo y el
// barrido dorado agregando / moviendo la card. Nunca todo junto.
function drawCrmSecuencia(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  ctx.fillStyle = '#F5F7FB'; ctx.fillRect(0, 0, W, H);
  const trav: KCard = { name: 'José Rodríguez', tag: SEQ_TAGS[0], tone: 'blue', star: true };

  const STEP = 3100, TEXT = 1350, LOOP = SEQ_BEATS.length * STEP, tt = t % LOOP;
  const step = Math.min(SEQ_BEATS.length - 1, Math.floor(tt / STEP)), local = tt - step * STEP;
  const beat = SEQ_BEATS[step];

  if (local < TEXT) {
    // FASE A — la pregunta en grande, centrada, SOLA (sin kanban)
    const inP = eoC(clamp(local / 400, 0, 1));
    const outP = local > TEXT - 300 ? clamp((local - (TEXT - 300)) / 300, 0, 1) : 0;
    const a = inP * (1 - outP); if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(0, lerp(12, 0, inP));
    ctx.font = "700 27px 'Geist', system-ui, sans-serif"; ctx.fillStyle = '#14171D';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrap(ctx, beat.q, W * 0.84), lh = 34, y0 = H / 2 - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * lh));
    ctx.restore();
    return;
  }

  // FASE B — desaparece el texto, aparece el kanban + respuesta + barrido
  const lb = local - TEXT, kA = eoC(clamp(lb / 300, 0, 1));
  const capTop = 14, boardTop = 76, boardH = H - boardTop - 12;
  const cols = kbColumns(W, boardTop, boardH);
  const aA = eoC(clamp((lb - 150) / 340, 0, 1));
  if (aA > 0.001) {
    ctx.save(); ctx.globalAlpha = aA; ctx.font = "700 15px 'Geist', system-ui, sans-serif"; ctx.textBaseline = 'middle';
    const lab = beat.a, wlab = ctx.measureText(lab).width, sk = 12, startX = W / 2 - (wlab + sk + 8) / 2;
    sparkle(ctx, startX + sk / 2, capTop + 16, sk / 2, '#F2B01E');
    ctx.fillStyle = '#14171D'; ctx.textAlign = 'left'; ctx.fillText(lab, startX + sk + 8, capTop + 16); ctx.restore();
  }

  ctx.save(); ctx.globalAlpha = kA;
  cols.forEach((col) => kbColShell(ctx, col));
  SEQ_STATIC.forEach(({ col, card }) => { const s = kbSlot(cols[col], 0); kbCard(ctx, s.x, s.y, s.w, card); });
  const slotFor = (colIdx: number) => kbSlot(cols[colIdx], 1);
  trav.tag = SEQ_TAGS[beat.to]; trav.tone = SEQ_TONES[beat.to];
  const actP = clamp((lb - 560) / 700, 0, 1);

  if (beat.kind === 'reveal') {
    const s = slotFor(beat.to);
    if (actP <= 0) { rr(ctx, s.x, s.y, s.w, CARD_H, 9); ctx.setLineDash([4, 4]); ctx.strokeStyle = KB_LINE; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
    else if (actP < 1) {
      const rw = s.w * eoCubic(actP);
      ctx.save(); ctx.beginPath(); rr(ctx, s.x, s.y, Math.max(2, rw), CARD_H, 9); ctx.clip(); kbCard(ctx, s.x, s.y, s.w, trav); ctx.restore();
      goldSweep(ctx, s.x, s.y, s.w, CARD_H, s.x + rw);
    } else { kbCard(ctx, s.x, s.y, s.w, trav); }
  } else {
    const from = slotFor(beat.to - 1), to = slotFor(beat.to);
    if (actP <= 0) { kbCard(ctx, from.x, from.y, from.w, trav); }
    else if (actP < 1) {
      const p = eInOut(actP), mx = lerp(from.x, to.x, p), my = lerp(from.y, to.y, p);
      kbCard(ctx, mx, my, to.w, trav, 1, 1);
      goldSweep(ctx, mx, my, to.w, CARD_H, mx + (actP * 1.3 - 0.15) * to.w);
    } else { kbCard(ctx, to.x, to.y, to.w, trav); }
  }
  ctx.restore();
}

const ExcelCanvas = makeCanvas(drawCrmExcel, 420);
const SecuenciaCanvas = makeCanvas(drawCrmSecuencia, 430);

const CANVAS_REGISTRY: Record<string, () => React.ReactElement> = { cxConnect: ConnectCanvas, cxJourney: JourneyCanvas, cxChat: ChatCanvas, cxCrmChat: CrmChatCanvas, cxCrmExcel: ExcelCanvas, cxCrmSecuencia: SecuenciaCanvas };

export function VisualCanvas({ type }: { type: string }) {
  const C = CANVAS_REGISTRY[type];
  return C ? <C /> : null;
}
