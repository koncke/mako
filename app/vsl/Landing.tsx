'use client';

// =============================================================================
// Landing de venta de MaKo (/vsl) — port del diseño hecho en Claude Design
// =============================================================================
// El markup vive en ./landing-html.ts (auto-generado desde "MaKo Landing.dc.html").
// Acá: se inyecta dentro de una capa fija a pantalla completa (para no heredar el
// sidebar del layout raíz, sin tocar layout.tsx ni Sidebar) y se cablea la
// interactividad del diseño: carruseles con autoplay, animación de red en canvas,
// Calendly embebido, reveal on-scroll y autoplay de videos.

import { useEffect, useRef } from 'react';
import { LANDING_HTML } from './landing-html';

declare global {
  interface Window {
    MakoAnim?: { draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void; DURATION: number };
    Calendly?: { initInlineWidget: (opts: { url: string; parentElement: Element }) => void };
  }
}

const CALENDLY_CSS = 'https://assets.calendly.com/assets/external/widget.css';
const CALENDLY_JS = 'https://assets.calendly.com/assets/external/widget.js';
const CALENDLY_URL = 'https://calendly.com/koncke/asesoria';

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cleanup: Array<() => void> = [];

    // ── CSS externo (Calendly). Los íconos van como SVG inline en el HTML. ───
    const ensureCss = (id: string, href: string) => {
      if (document.getElementById(id)) return;
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
    };
    ensureCss('vsl-calendly-css', CALENDLY_CSS);

    // ── Sub-link "Saber más" debajo del CTA de cada sección de feature ───────
    // Inyectado en runtime (no en landing-html.ts, que es auto-generado) para
    // sobrevivir a regeneraciones del diseño. Cada sección #m-<slug> linkea a
    // su página de detalle /vsl/<slug>.
    const DETALLE_LABELS: Record<string, string> = {
      funnel: 'tu funnel',
      crm: 'el CRM automatizado',
      api: 'la API de Meta',
      ads: 'el Ads Manager',
      script: 'Script Analyst',
      closing: 'Closing Analyst',
      seguimiento: 'el seguimiento automático',
      cobranza: 'cobranza y revenue',
      contrato: 'la lectura de contratos',
      customer: 'Customer Success',
      semaforo: 'el Semáforo del negocio',
      experimentos: 'Experimentos',
      whatsapp: 'WhatsApp',
      email: 'Email Marketing',
      mako: 'MaKo IA',
    };
    root.querySelectorAll<HTMLElement>('.mk-deep[id^="m-"]').forEach((section) => {
      const cta = section.querySelector<HTMLAnchorElement>('a[href="#beta"]');
      if (!cta || section.querySelector('[data-detalle-link]')) return;
      const slug = section.id.replace(/^m-/, '');
      const label = DETALLE_LABELS[slug];
      if (!label) return;
      const link = document.createElement('a');
      link.href = '/vsl/' + slug;
      link.setAttribute('data-detalle-link', '');
      link.textContent = 'Saber más sobre ' + label + ' →';
      link.style.cssText =
        'display:block;text-align:center;margin-top:14px;color:#2F6FED;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.01em';
      cta.insertAdjacentElement('afterend', link);
    });

    // ── Realce de la sección CTA (#beta): escasez + oferta a la vista ────────
    // Override en runtime (no en landing-html.ts auto-generado). Idempotente.
    const beta = root.querySelector<HTMLElement>('#beta');
    if (beta && !beta.hasAttribute('data-beta-on')) {
      beta.setAttribute('data-beta-on', '');
      const header = beta.querySelector<HTMLElement>('[data-reveal]');

      // 1) Rescatar la línea de oferta (div sin estilo) y reescribirla.
      if (header) {
        const urgency = Array.from(header.children).find(
          (el) => el.tagName === 'DIV' && /no se van a repetir/i.test(el.textContent || ''),
        ) as HTMLElement | undefined;
        if (urgency) {
          urgency.classList.add('mk-beta-oferta');
          urgency.innerHTML =
            'Los primeros 5 no solamente entran antes que nadie: entran en ' +
            '<strong class="mk-beta-hl">condiciones que no se van a repetir</strong>.';
        }
      }

      // 2) Cards: clase para acento de color + hover.
      const grid = beta.querySelector<HTMLElement>('div[style*="repeat(auto-fit"]');
      if (grid) grid.classList.add('mk-beta-cards');

      // 4) Micro-confianza (reversión de riesgo) justo antes del Calendly.
      const cal = beta.querySelector<HTMLElement>('#cal-embed');
      if (cal && cal.parentElement) {
        const trust = document.createElement('div');
        trust.className = 'mk-beta-trust';
        trust.innerHTML = ['Sin costo', '60 min con Martín']
          .map(
            (t) =>
              '<span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l9 -10"/></svg>' +
              t +
              '</span>',
          )
          .join('');
        cal.parentElement.insertBefore(trust, cal);
      }
    }

    // ── Carruseles (caso de éxito, QS Media, Social Media Lab) ───────────────
    const lens: Record<string, number> = { case: 3, qs: 2, sml: 4 };
    const idx: Record<string, number> = { case: 0, qs: 0, sml: 0 };
    const dotColors: Record<string, [string, string]> = {
      case: ['#FFFFFF', 'rgba(255,255,255,.5)'],
      qs: ['#2F6FED', 'rgba(255,255,255,.85)'],
      sml: ['#2F6FED', 'rgba(255,255,255,.85)'],
    };
    const renderCar = (car: string) => {
      const track = root.querySelector<HTMLElement>('[data-track="' + car + '"]');
      if (track) track.style.transform = 'translateX(-' + idx[car] * 100 + '%)';
      root.querySelectorAll<HTMLElement>('[data-car="' + car + '"][data-dot]').forEach((b) => {
        const i = parseInt(b.getAttribute('data-dot') || '0', 10);
        const active = i === idx[car];
        b.style.width = active ? '22px' : '8px';
        b.style.background = active ? dotColors[car][0] : dotColors[car][1];
      });
    };
    const go = (car: string, i: number) => {
      const n = lens[car];
      idx[car] = ((i % n) + n) % n;
      renderCar(car);
    };
    (['case', 'qs', 'sml'] as const).forEach(renderCar);

    let caseTimer = 0, carTimer = 0;
    const startTimers = () => {
      caseTimer = window.setInterval(() => go('case', idx.case + 1), 6000);
      carTimer = window.setInterval(() => { go('qs', idx.qs + 1); go('sml', idx.sml + 1); }, 5000);
    };
    const restartTimers = () => { clearInterval(caseTimer); clearInterval(carTimer); startTimers(); };
    startTimers();
    cleanup.push(() => { clearInterval(caseTimer); clearInterval(carTimer); });

    const onClick = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-car]') as HTMLElement | null;
      if (!target || !root.contains(target)) return;
      const car = target.getAttribute('data-car') as string;
      if (target.hasAttribute('data-dot')) go(car, parseInt(target.getAttribute('data-dot') || '0', 10));
      else if (target.getAttribute('data-act') === 'prev') go(car, idx[car] - 1);
      else if (target.getAttribute('data-act') === 'next') go(car, idx[car] + 1);
      else return;
      restartTimers();
    };
    root.addEventListener('click', onClick);
    cleanup.push(() => root.removeEventListener('click', onClick));

    // ── Reveal on-scroll ─────────────────────────────────────────────────────
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    reveals.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1)';
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'none';
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });
      reveals.forEach((el) => io.observe(el));
      const failsafe = window.setTimeout(() => reveals.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; }), 2400);
      cleanup.push(() => { io.disconnect(); clearTimeout(failsafe); });
    } else {
      reveals.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
    }

    // ── Autoplay de videos (muted/loop) ──────────────────────────────────────
    root.querySelectorAll<HTMLVideoElement>('video[data-autoplay]').forEach((v) => {
      try {
        v.muted = true; v.defaultMuted = true;
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      } catch { /* ignore */ }
    });

    // ── Animación de red (canvas + mako-anim.js) ─────────────────────────────
    let netRaf = 0, netStarted = false, t0: number | null = null, waited = 0;
    const startNet = () => {
      if (netStarted) return;
      const canvas = root.querySelector<HTMLCanvasElement>('#mk-net-canvas');
      if (!canvas || !window.MakoAnim) { if (waited++ < 120) window.setTimeout(startNet, 80); return; }
      netStarted = true;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const c = canvas as HTMLCanvasElement & { _cssw: number; _cssh: number; _dpr: number };
      let reduce = false;
      try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
      const size = () => {
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        c._cssw = Math.max(1, r.width); c._cssh = Math.max(1, r.height); c._dpr = dpr;
        canvas.width = Math.round(c._cssw * dpr); canvas.height = Math.round(c._cssh * dpr);
      };
      const paint = (t: number) => {
        ctx.setTransform(c._dpr, 0, 0, c._dpr, 0, 0);
        ctx.clearRect(0, 0, c._cssw, c._cssh);
        try { window.MakoAnim!.draw(ctx, t, c._cssw, c._cssh); } catch { /* ignore */ }
      };
      size();
      if (reduce) { paint(7000); return; }
      const loop = (now: number) => {
        if (!canvas.isConnected) return;
        const r = canvas.getBoundingClientRect();
        if (Math.abs(r.width - (c._cssw || 0)) > 1 || Math.abs(r.height - (c._cssh || 0)) > 1) size();
        if (t0 == null) t0 = now;
        paint((now - t0) % window.MakoAnim!.DURATION);
        netRaf = requestAnimationFrame(loop);
      };
      netRaf = requestAnimationFrame(loop);
    };
    if (window.MakoAnim) {
      startNet();
    } else if (!document.getElementById('vsl-makoanim')) {
      const sc = document.createElement('script');
      sc.id = 'vsl-makoanim'; sc.src = '/vsl-assets/mako-anim.js'; sc.onload = startNet;
      document.body.appendChild(sc);
    } else {
      startNet();
    }
    cleanup.push(() => { if (netRaf) cancelAnimationFrame(netRaf); });

    // ── Calendly inline ──────────────────────────────────────────────────────
    const initCal = () => {
      const el = root.querySelector('#cal-embed');
      if (!el) return;
      if (window.Calendly && !el.getAttribute('data-cal-init')) {
        el.setAttribute('data-cal-init', '1');
        window.Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: el });
      } else if (!el.getAttribute('data-cal-init')) {
        window.setTimeout(initCal, 300);
      }
    };
    if (window.Calendly) {
      initCal();
    } else if (!document.getElementById('vsl-calendly-js')) {
      const sc = document.createElement('script');
      sc.id = 'vsl-calendly-js'; sc.src = CALENDLY_JS; sc.async = true; sc.onload = initCal;
      document.body.appendChild(sc);
    } else {
      initCal();
    }

    return () => cleanup.forEach((fn) => fn());
  }, []);

  return (
    <div className="vsl-root" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
    </div>
  );
}

// =============================================================================
// Estilos. Capa fija full-screen (oculta el sidebar de la app sin tocarlo) +
// el CSS global del diseño, scopeado bajo .vsl-root.
// =============================================================================
const CSS = `
/* Oculta el Sidebar del layout raíz SOLO con esta página montada. */
body:has(.vsl-root) aside { display: none !important; }

.vsl-root {
  position: fixed; inset: 0; z-index: 100;
  overflow-y: auto; overflow-x: hidden;
  background: #FFFFFF; color: #171A21;
  font-family: 'Geist', system-ui, sans-serif;
  scroll-behavior: smooth; scroll-padding-top: 84px;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.vsl-root * { box-sizing: border-box; }
.vsl-root img { max-width: 100%; }
.vsl-root a { color: inherit; }
.vsl-root ::selection { background: rgba(47,111,237,.15); }
.vsl-root .ti { line-height: 1; }
/* Copia del CTA del hero que solo se muestra en mobile (debajo del video). */
.vsl-root .mk-hero-cta-mobile { display: none; }

@keyframes mkLive { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
@keyframes mkText { 0% { background-position: 130% 0 } 55%,100% { background-position: -30% 0 } }

/* Hover de las cards de features (reemplaza el style-hover del diseño). */
.vsl-root .mk-feature-grid > a { transition: box-shadow .22s ease, transform .22s ease; }
.vsl-root .mk-feature-grid > a:hover { transform: translateY(-3px); box-shadow: 0 20px 44px -22px rgba(16,19,25,.26); }

/* "¿Para quién es esto?": las dos columnas (✓ / ✕) a la misma altura. */
.vsl-root .mk-pq-grid { align-items: stretch !important; }
/* Calendly: más ancho que alto. Ensanchamos SOLO el bloque del embed (breakout
   del contenedor de 900px, sin tocar las cards) para que Calendly use su layout
   horizontal y baje el alto. Objetivo: sin scroll interno y sin espacio de sobra. */
.vsl-root #beta [data-reveal]:last-child { width: min(1060px, calc(100vw - 48px)); margin-left: 50%; transform: translateX(-50%); }
.vsl-root #cal-embed { height: 720px !important; }
@media (max-width: 768px) {
  .vsl-root #beta [data-reveal]:last-child { width: auto; margin-left: 0; transform: none; }
  .vsl-root #cal-embed { height: 1080px !important; }
}

/* ── Realce de la sección CTA (#beta) — fondo azul de marca + texto claro ── */
.vsl-root #beta { background: linear-gradient(180deg,#2F6FED 0%,#2A63DE 100%) !important; border-top: 1px solid rgba(255,255,255,.12) !important; }
.vsl-root #beta p:empty { display: none !important; }
.vsl-root #beta h2 { margin-top: 0 !important; margin-bottom: 14px !important; color: #FFFFFF !important; }
.vsl-root #beta [data-reveal]:first-child p { color: rgba(255,255,255,.88) !important; }
.vsl-root #beta p strong { color: #FFD15C !important; font-weight: 700 !important; }

.vsl-root .mk-beta-oferta { max-width: 620px; margin: 20px auto 0; text-align: center; font-size: 18px; line-height: 1.55; font-weight: 500; color: rgba(255,255,255,.92); }
.vsl-root .mk-beta-hl { font-weight: 700; color: #FFD15C; }

.vsl-root .mk-beta-cards { margin-top: 44px !important; }
.vsl-root .mk-beta-cards > div { transition: transform .2s ease, box-shadow .2s ease; box-shadow: 0 16px 40px -24px rgba(8,12,30,.5) !important; border-top-width: 3px !important; }
.vsl-root .mk-beta-cards > div:hover { transform: translateY(-3px); box-shadow: 0 22px 50px -24px rgba(8,12,30,.55) !important; }
.vsl-root .mk-beta-cards > div:nth-child(1) { border-top-color: #F2B01E !important; }
.vsl-root .mk-beta-cards > div:nth-child(2) { border-top-color: #8B7CF6 !important; }
.vsl-root .mk-beta-cards > div:nth-child(3) { border-top-color: #1E9E57 !important; }

.vsl-root #beta [data-reveal]:last-child > div:first-child { display: none !important; }
.vsl-root .mk-beta-trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; margin: 0 auto 18px; font-size: 13.5px; color: rgba(255,255,255,.9); }
.vsl-root .mk-beta-trust span { display: inline-flex; align-items: center; gap: 6px; }

@media (max-width:600px){ .vsl-root .mk-hdr-cupos{display:none !important} }
@media (max-width:768px){
  .vsl-root .mk-root h1{font-size:36px !important;line-height:1.14 !important}
  .vsl-root .mk-root h2{font-size:27px !important;line-height:1.2 !important}
  .vsl-root .mk-root h3{font-size:22px !important}
  .vsl-root #top{padding:48px 20px 0 !important}
  .vsl-root .mk-hero-text{text-align:center}
  .vsl-root .mk-hero-text > a{margin-left:auto !important;margin-right:auto !important}
  .vsl-root #historia{margin-top:56px !important}
  .vsl-root #historia > div{padding:60px 20px !important}
  .vsl-root .mk-story-row{justify-content:center}
  .vsl-root #que-es{padding:64px 20px 0 !important}
  .vsl-root #como-funciona{padding:64px 20px 30px !important}
  .vsl-root .mk-feature-grid{grid-template-columns:repeat(2,1fr) !important}
  .vsl-root .mk-feature-mako{grid-column:auto !important}
  .vsl-root .mk-deep{flex-direction:column !important;gap:30px !important;padding:44px 0 !important}
  .vsl-root .mk-deep-panel{min-height:210px !important}
  .vsl-root #para-quien > div{padding:64px 20px !important}
  .vsl-root .mk-pq-grid{grid-template-columns:1fr !important}
  .vsl-root #beta > div{padding:60px 20px 72px !important}
  .vsl-root .mk-testi-row{flex-direction:column !important;gap:24px !important;padding:20px !important}
  .vsl-root #testimonios > div{padding:64px 20px 76px !important}
}
@media (max-width:480px){
  .vsl-root .mk-root h1{font-size:30px !important}
  .vsl-root .mk-root h2{font-size:24px !important}
  .vsl-root .mk-root h3{font-size:20px !important}
  .vsl-root header > div{padding:0 16px !important}
  .vsl-root header a[href="#beta"]{padding:8px 13px !important;font-size:13px !important}
  .vsl-root #top{padding:34px 18px 0 !important}
  .vsl-root #historia{margin-top:44px !important}
  .vsl-root #historia > div{padding:46px 18px !important}
  .vsl-root #que-es{padding:50px 18px 0 !important}
  .vsl-root #como-funciona{padding:50px 18px 22px !important}
  .vsl-root #para-quien > div{padding:54px 18px !important}
  .vsl-root #beta > div{padding:50px 18px 60px !important}
  .vsl-root .mk-feature-grid{grid-template-columns:1fr !important}
  .vsl-root .mk-feature-grid > a{min-height:0 !important;padding:22px 20px !important}
  .vsl-root .mk-checklist{grid-template-columns:1fr !important;gap:16px !important}
  .vsl-root #cal-embed{min-width:0 !important;width:100% !important;height:1200px !important}
  .vsl-root #testimonios > div{padding:52px 18px 62px !important}
}

/* ── Refinamientos mobile propios (sobre las media queries del diseño) ── */
@media (max-width:768px){
  /* Filas que pasan a columna: el flex-basis estaba pensado para ancho (layout
     horizontal); en columna se interpreta como ALTO y genera huecos enormes.
     Lo reseteamos para que cada bloque ocupe su alto natural y todo el ancho. */
  .vsl-root .mk-deep > div { flex: 0 0 auto !important; width: 100% !important; min-width: 0 !important; max-width: none !important; }
  .vsl-root .mk-testi-row > div { flex: 0 0 auto !important; width: 100% !important; min-width: 0 !important; max-width: none !important; }
  .vsl-root .mk-story-row > div { min-width: 0 !important; max-width: none !important; }
  .vsl-root #que-es > div > div { min-width: 0 !important; }
  .vsl-root #top > div > div { min-width: 0 !important; }
  /* Sin sticky en mobile: evita que el video/imagen quede pinneado al hacer scroll. */
  .vsl-root .mk-story-row div[style*="position:sticky"] { position: static !important; top: auto !important; }
  /* Paneles decorativos de las secciones, más compactos. */
  .vsl-root .mk-deep-panel { min-height: 176px !important; }
  .vsl-root .mk-deep { gap: 22px !important; padding: 40px 0 !important; }
  /* Las cards de Beta en una sola columna ordenada. */
  .vsl-root #beta div[style*="repeat(auto-fit"] { grid-template-columns: 1fr !important; }
  /* Subtítulo del hero: sin los saltos de línea manuales (eran para desktop); fluye natural. */
  .vsl-root .mk-hero-br { display: none !important; }
  /* Historia (bloque 2): el carrusel de Mauricio va ARRIBA del texto "No existe ningún método…". */
  .vsl-root .mk-story-row[style*="border-top"] { flex-direction: column-reverse !important; }
  /* Hero: en mobile el CTA va DEBAJO del video. Se oculta el CTA y el "Diagnostico…"
     del bloque de texto y se muestra una copia (.mk-hero-cta-mobile) tras el video. */
  .vsl-root #top .mk-hero-text > a,
  .vsl-root #top .mk-hero-text > p:last-of-type { display: none !important; }
  .vsl-root #top .mk-hero-cta-mobile { display: block !important; width: 100%; text-align: center; margin-top: 4px; }
  .vsl-root #top .mk-hero-cta-mobile > a { margin-left: auto !important; margin-right: auto !important; }
  /* El gap de 40px del hero es para las 2 columnas del desktop; en mobile (apilado)
     achica el espacio entre subtítulo y video. */
  .vsl-root #top > div { gap: 24px !important; }
  .vsl-root #top .mk-hero-text > p:first-of-type { margin-bottom: 0 !important; }
}
@media (max-width:480px){
  /* Grilla de features: 2 columnas en mobile, con cards más cuadradas y compactas. */
  .vsl-root .mk-feature-grid { grid-template-columns: repeat(2,1fr) !important; gap: 12px !important; }
  .vsl-root .mk-feature-grid > a { min-height: 158px !important; padding: 18px 15px !important; }
  .vsl-root .mk-feature-grid > a > div:first-child { width: 40px !important; height: 40px !important; margin-bottom: 12px !important; }
  .vsl-root .mk-feature-grid > a > div:nth-child(2) { font-size: 15px !important; line-height: 1.22 !important; }
  .vsl-root .mk-feature-grid > a > div:nth-child(3) { font-size: 12.5px !important; line-height: 1.45 !important; }
}
@media (max-width:420px){
  /* Grid de iconos de "¿Qué es MaKo?": apretar un poco el gap. */
  .vsl-root #que-es div[style*="repeat(4,1fr)"] { gap: 8px !important; }
}
`;
