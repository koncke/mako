'use client';

// =============================================================================
// Landing de venta de MaKo (/vsl) — port del diseño hecho en Claude Design
// =============================================================================
// El markup vive en ./landing-html.ts (auto-generado desde "MaKo Landing.dc.html").
// Acá: se inyecta dentro de una capa fija a pantalla completa (para no heredar el
// sidebar del layout raíz, sin tocar layout.tsx ni Sidebar) y se cablea la
// interactividad del diseño: carruseles con autoplay, animación de red en canvas,
// Calendly embebido, reveal on-scroll y autoplay de videos.

import { useEffect, useMemo, useRef } from 'react';
import { EMAIL_MAKO } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';
import { debeMedir, esAgendaDeCalendly, PIXEL_META_MAKO } from '@/lib/meta-pixel-mako';

import { SCRIPT_DISENO } from '@/lib/editor-landing/html-editable';
import { PARAM_CARGADOR, RUTA_CARGADOR } from '@/lib/pixel-cargador';
import { LANDING_HTML } from './landing-html';
import { CSS_CAPA, CSS_LANDING, aplicarContenidoLanding } from './landing-contenido';

/**
 * La landing hecha en Web Generator (23/10/2026, lib/editor-landing/landing-mako.ts): el HTML de la página
 * publicada (`div.gm-libre`), la base y la hoja del diseño, y CSS_CONTENIDO sólo si trae secciones de Gamma.
 * Sin esto (no hay documento publicado o la base no contestó), la landing de siempre: landing-html.ts.
 */
export type DisenoLanding = { html: string; css: string; cssContenido?: string | null; pixelToken?: string | null };

/** Una hoja no puede cerrar su `<style>`: segunda capa sobre `cssDisenoLimpio` (lib/editor-landing/html-editable.ts). */
export function sinCierreDeStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}

/** El visitante del Pixel de MaKo (`nqe_visitor_id`), o null. */
function visitanteMako(): string | null {
  const m = document.cookie.match(/(?:^|; )nqe_visitor_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

declare global {
  interface Window {
    MakoAnim?: { draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void; DURATION: number };
    Calendly?: { initInlineWidget: (opts: { url: string; parentElement: Element }) => void };
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** La cola de comandos del píxel de Meta, con la forma que espera fbevents.js. */
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

/**
 * El código base del píxel de Meta, escrito en TS en vez de pegado como string: es
 * la misma cola que arma el snippet oficial (los comandos se encolan hasta que
 * fbevents.js carga y los procesa). Idempotente: StrictMode re-ejecuta el efecto.
 */
function cargarPixelMeta(): Fbq {
  if (window.fbq) return window.fbq;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Fbq;
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  const sc = document.createElement('script');
  sc.id = 'vsl-meta-pixel'; sc.async = true; sc.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(sc);
  return n;
}

const CALENDLY_CSS = 'https://assets.calendly.com/assets/external/widget.css';
const CALENDLY_JS = 'https://assets.calendly.com/assets/external/widget.js';
const CALENDLY_URL = 'https://calendly.com/koncke/asesoria';

export default function Landing({ diseno }: { diseno?: DisenoLanding | null }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // ── La landing de Web Generator: el contenido ya viene armado en el documento, y lo que se mueve
  // (reveal, carruseles, videos, la red de MaKo, Calendly y el Schedule) lo pone el script del diseño,
  // el MISMO de la página publicada en hola-mako.site (SCRIPT_DISENO). Acá sólo queda lo de esta portada:
  // volver a la card, y el Píxel de Meta de MaKo en producción (el script manda el Schedule si lo ve).
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !diseno) return;
    volverALaCard(root);
    if (!document.getElementById('gm-diseno-js')) {
      const sc = document.createElement('script');
      sc.id = 'gm-diseno-js';
      sc.textContent = SCRIPT_DISENO;
      document.body.appendChild(sc);
    }
  }, [diseno]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || diseno) return;
    const cleanup: Array<() => void> = [];

    // ── CSS externo (Calendly). Los íconos van como SVG inline en el HTML. ───
    const ensureCss = (id: string, href: string) => {
      if (document.getElementById(id)) return;
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
    };
    ensureCss('vsl-calendly-css', CALENDLY_CSS);

    // ── Showcase: la card lleva DIRECTO a la landing de la feature ───────────
    // Antes cada feature tenía una sección `.mk-deep` DEBAJO de la grilla (scroll).
    // Ahora: (1) se quitan esas secciones, (2) se agrega la card que faltaba
    // (Prioridades / Perro Guardián), (3) cada card muestra su hook y (4) al click
    // navega a /vsl/<slug> (la landing dedicada, mucho más completa que un pop-up).
    // Todo en runtime (no en landing-html.ts, auto-generado). Idempotente:
    // StrictMode re-ejecuta el efecto sobre el MISMO DOM.

    aplicarContenidoLanding(root);

    volverALaCard(root);

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
      // ?v= obligatorio: el archivo vive en una ruta fija, así que sin versión el
      // navegador puede seguir sirviendo la copia vieja de la animación (nos pasó:
      // en el server ya estaban los logos reales y en pantalla seguían los viejos).
      // Subir el número cada vez que se toque mako-anim.js.
      sc.id = 'vsl-makoanim'; sc.src = '/vsl-assets/mako-anim.js?v=3'; sc.onload = startNet;
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

  // ── Píxel de Meta de MaKo: la visita y la agenda ─────────────────────────
  // UN solo punto de carga para las dos landings (tests/meta-pixel-mako.test.ts): un doble init duplicaría
  // eventos. Sólo en el dominio de producción (debeMedir): un preview o localhost ensuciaría las audiencias.
  // Con la landing de Web Generator, primero el Pixel de MaKo (crea el visitante, el ORIGEN de la cuenta:
  // lib/origen-cuenta.ts) y después Meta, con ese visitante como external_id (el mismo UID que manda el server
  // por CAPI al agendar). El Schedule de esa landing lo manda el script del diseño (SCRIPT_DISENO); el de
  // siempre, acá: un solo Schedule por carga (Calendly puede repetir el mensaje y Meta lo contaría dos veces).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cleanup: Array<() => void> = [];
    if (debeMedir(window.location.hostname)) {
      const iniciar = () => {
        if (root.getAttribute('data-pixel-init')) return;
        root.setAttribute('data-pixel-init', '1');
        const fbq = cargarPixelMeta();
        const uid = visitanteMako();
        if (uid) fbq('init', PIXEL_META_MAKO, { external_id: uid }); else fbq('init', PIXEL_META_MAKO);
        fbq('track', 'PageView');
      };
      if (diseno?.pixelToken && !document.getElementById('mako-pixel')) {
        const sc = document.createElement('script');
        sc.id = 'mako-pixel'; sc.defer = true; sc.onload = iniciar; sc.onerror = iniciar;
        sc.src = `${RUTA_CARGADOR}?${PARAM_CARGADOR}=${encodeURIComponent(diseno.pixelToken)}`;
        document.body.appendChild(sc);
        const t = window.setTimeout(iniciar, 2500);
        cleanup.push(() => window.clearTimeout(t));
      } else iniciar();
      if (!diseno) {
        let agendo = false;
        const onMensaje = (e: MessageEvent) => {
          if (agendo || !esAgendaDeCalendly(e.origin, e.data)) return;
          agendo = true;
          window.fbq?.('track', 'Schedule');
        };
        window.addEventListener('message', onMensaje);
        cleanup.push(() => window.removeEventListener('message', onMensaje));
      }
    }
    return () => cleanup.forEach((fn) => fn());
  }, [diseno]);

  // El markup del diseño se inyecta UNA vez y su identidad se memoiza: así los
  // re-renders (abrir/cerrar el modal) NO re-aplican el innerHTML y no pisan las
  // mutaciones imperativas del efecto (cards, secciones, subtítulos).
  const injectedHtml = useMemo(
    () => <div dangerouslySetInnerHTML={{ __html: diseno?.html ?? LANDING_HTML }} />,
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="vsl-root" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: diseno ? CSS_CAPA : CSS }} />
      {/* La hoja viene saneada (sin `<`: cssDisenoLimpio), y igual se re-escapa como en pagina-publica.ts. */}
      {diseno && <style dangerouslySetInnerHTML={{ __html: sinCierreDeStyle(diseno.css) }} />}
      {diseno?.cssContenido && <style dangerouslySetInnerHTML={{ __html: sinCierreDeStyle(diseno.cssContenido) }} />}
      {injectedHtml}
      <PieLegal />
    </div>
  );
}

/**
 * El «volver a la card»: el detalle de una funcionalidad vuelve con `/#feat-<slug>`, y al cargar la portada
 * se devuelve el scroll a la card de donde salió. Lo usan las dos landings (la de Web Generator y la de siempre).
 */
function volverALaCard(root: HTMLElement): void {
  // (5) "Volver" desde una landing (/vsl#feat-<slug>): al cargar, devolver el
  // scroll a la card de donde salió el usuario. Los ids se agregan recién arriba,
  // así que el scroll nativo no la encuentra. Además .vsl-root tiene
  // scroll-behavior:smooth, que anima (y a veces pisa) el scrollTop — por eso lo
  // forzamos a 'auto', calculamos el destino a mano y reintentamos tras el layout.
  const hash = window.location.hash;
  if (hash.startsWith('#feat-')) {
    // scrollIntoView centra la card en SU posición actual (se auto-corrige, no
    // sobrepasa). Forzamos scroll-behavior:auto (el smooth de .vsl-root animaba
    // y pisaba el scroll) y reintentamos mientras el layout asienta (fuentes,
    // videos del hero, reveal). Se corta si el usuario empieza a scrollear.
    let userScrolled = false;
    const onUser = () => { userScrolled = true; };
    root.addEventListener('wheel', onUser, { passive: true });
    root.addEventListener('touchmove', onUser, { passive: true });
    const centerCard = () => {
      if (userScrolled) return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      target.scrollIntoView({ block: 'center' });
      root.style.scrollBehavior = prev;
    };
    requestAnimationFrame(centerCard);
    [120, 320, 650].forEach((ms) => window.setTimeout(centerCard, ms));
    window.setTimeout(() => {
      root.removeEventListener('wheel', onUser);
      root.removeEventListener('touchmove', onUser);
    }, 800);
  }
}

// =============================================================================
// Estilos. Capa fija full-screen (oculta el sidebar de la app sin tocarlo) +
// el CSS global del diseño, scopeado bajo .vsl-root.
// =============================================================================
const CSS = CSS_LANDING;

/**
 * Los enlaces legales, pegados debajo del pie que trae el diseño.
 *
 * POR QUÉ EXISTE: Google EXIGE, para verificar una app que pide scopes sensibles,
 * que la política de privacidad sea alcanzable DESDE la página principal —
 * declararla en la consola no alcanza, y esta landing es la página principal
 * pública de MaKo.
 *
 * ⚠️ POR QUÉ EN JSX Y NO INYECTADO EN EL EFECTO, que es como se agrega todo lo
 * demás acá: lo que se inyecta en el `useEffect` NO está en el HTML servido, y el
 * verificador de un tercero puede no ejecutar JavaScript. Un enlace que solo
 * existe después de hidratar es, para quien tiene que encontrarlo, un enlace que
 * no está.
 *
 * ⚠️ Y NO REPITE EL «© 2026»: el diseño ya trae su propio <footer> con el logo y
 * el copyright. La primera versión de esto era un footer completo y quedaban dos,
 * uno encima del otro, cada uno con su año. Esto es la segunda mitad de ese pie,
 * no un pie nuevo.
 */
function PieLegal() {
  const link: React.CSSProperties = { color: '#6B7280', textDecoration: 'underline' };
  return (
    <div style={{
      background: '#FFFFFF', padding: '0 28px 30px', textAlign: 'center',
      fontFamily: "'Geist', sans-serif", fontSize: 13.5, color: '#6B7280',
      display: 'flex', flexWrap: 'wrap', gap: '6px 18px', justifyContent: 'center', alignItems: 'center',
    }}>
      <a href="/privacidad" style={link}>Privacidad</a>
      <a href="/terminos" style={link}>Términos</a>
      {/* La política que piden Stripe y Mercado Pago para aprobar la cuenta (11/10/2026). */}
      <a href="/reembolsos" style={link}>Reembolsos</a>
      <a href={`mailto:${EMAIL_MAKO}`} style={link}>{EMAIL_MAKO}</a>
      {/* Meta rechazó la verificación del negocio porque la razón social no estaba en el
          sitio (08/10/2026): ver lib/titular-mako.ts. */}
      {/* Un solo nodo de texto: con «Razón social: {X}» React mete un comentario
          entre el rótulo y el nombre, y una búsqueda de la frase entera no la encuentra. */}
      <span>{`Razón social: ${RAZON_SOCIAL_MAKO}`}</span>
    </div>
  );
}
