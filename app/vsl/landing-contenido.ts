// =============================================================================
// El CONTENIDO de la landing de MaKo que antes se armaba en el navegador (app/vsl/Landing.tsx)
// =============================================================================
// Desde el 23/10/2026 la landing de hola-mako.com es un documento de Web Generator («Diseño editable»,
// lib/editor-landing/html-editable.ts): lo que se ve se edita ahí. Este módulo guarda las dos piezas que
// convirtieron el HTML de Claude Design (landing-html.ts) en la landing que se ve, para que la importación
// (scripts/landing-mako-a-web-generator.ts) las aplique UNA vez, igual que el navegador:
//   · `aplicarContenidoLanding(root)`: las secciones de detalle fuera, las cards que faltaban, los hooks, los
//     enlaces a /vsl/<slug>, el CTA de la grilla, el realce de #beta y el «Entrar» del header.
//   · `CSS_LANDING`: la hoja de la landing (sobre `.vsl-root`).
// Y las sigue usando Landing.tsx cuando no hay documento publicado (la landing de siempre, de respaldo).
// Idempotente: correrla dos veces sobre el mismo DOM no duplica nada.
// =============================================================================

import { SHOWCASE_BY_SLUG, INJECT_ORDER, OCULTAS } from './showcase';

/** Las mutaciones de contenido de la landing, sobre el contenedor que tiene el HTML del diseño. */
export function aplicarContenidoLanding(root: HTMLElement): void {
  const doc = root.ownerDocument;
  // Título de sección refrescado.
  const secH = root.querySelector<HTMLElement>('#como-funciona h2');
  if (secH) secH.textContent = 'Tu equipo de ventas High Ticket, en una sola app';

  // ── "Entrar" en el header ────────────────────────────────────────────────
  // Desde que la landing es la RAÍZ del dominio, esta es la única puerta de
  // entrada visible a la app. Apunta a /inicio y no a /login a propósito: sirve
  // para los dos casos sin tener que saber si hay sesión — con sesión entra
  // derecho, y sin sesión el gate lo manda a /login?next=/inicio y vuelve solo.
  // Va en runtime como el resto: landing-html.ts es auto-generado desde el diseño.
  const barra = root.querySelector<HTMLElement>('.mk-hdr-cupos')?.parentElement;
  if (barra && !barra.querySelector('#mk-hdr-login')) {
    const login = doc.createElement('a');
    login.id = 'mk-hdr-login';
    login.href = '/inicio';
    login.textContent = 'Entrar';
    login.style.cssText =
      'font-size:14px;font-weight:600;color:#5B6472;text-decoration:none;padding:9px 4px;white-space:nowrap';
    login.addEventListener('mouseenter', () => { login.style.color = '#171A21'; });
    login.addEventListener('mouseleave', () => { login.style.color = '#5B6472'; });
    barra.insertBefore(login, barra.firstChild);
  }

  // (1) Fuera las secciones de detalle "abajo": ahora cada feature tiene su landing.
  root.querySelectorAll('.mk-deep[id^="m-"]').forEach((s) => s.remove());

  // (2) Card nueva: Prioridades — El Perro Guardián, justo tras Experimentos.
  // Las 9 features que no vienen en el HTML del diseño se inyectan como card
  // [slug, después-de]. El orden respeta las dependencias (cada "después-de" ya
  // tiene que existir cuando se inserta el siguiente).
  // El orden vive en showcase.ts (INJECT_ORDER): lo comparten esta grilla y la
  // que arman las páginas de funcionalidad, para que sean idénticas.
  const INJECT = INJECT_ORDER;
  const featGrid = root.querySelector<HTMLElement>('.mk-feature-grid');
  const makeCard = (slug: string): HTMLAnchorElement => {
    const f = SHOWCASE_BY_SLUG[slug];
    const paths = f.icon.map((d) => `<path d="${d}" />`).join('');
    const title = f.name.split(' — ')[0]; // "Prioridades — El Perro Guardián" → "Prioridades"
    const a = doc.createElement('a');
    a.setAttribute('href', '#m-' + slug);
    a.setAttribute('data-feature', slug);
    a.style.cssText =
      'display:flex;flex-direction:column;background:#fff;border:1px solid #EAECF1;border-radius:12px;padding:28px 26px;min-height:206px;text-decoration:none;box-shadow:0 1px 2px rgba(16,19,25,.03);transition:box-shadow .22s ease,transform .22s ease';
    a.innerHTML =
      '<div style="width:46px;height:46px;border-radius:12px;background:#EAF1FE;display:flex;align-items:center;justify-content:center;margin-bottom:18px">' +
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;color:#2F6FED">${paths}</svg>` +
      '</div>' +
      `<div style="font-size:17px;font-weight:600;color:#12151B;letter-spacing:-0.01em;line-height:1.25">${title}</div>` +
      `<div style="font-size:14px;line-height:1.55;color:#6B7280;margin-top:9px">${f.hook}</div>`;
    return a;
  };
  if (featGrid) {
    // Funcionalidades que todavía no se muestran (Customer Success): fuera de
    // la grilla, así queda el 4×6 exacto y no sobra una card suelta abajo.
    for (const s of OCULTAS) featGrid.querySelector(`a[href="#m-${s}"]`)?.remove();
    for (const [slug, after] of INJECT) {
      if (!SHOWCASE_BY_SLUG[slug]) continue;
      if (featGrid.querySelector(`a[data-feature="${slug}"]`)) continue; // idempotente
      const prev = featGrid.querySelector<HTMLElement>(`a[href="#m-${after}"]`);
      const card = makeCard(slug);
      if (prev) prev.insertAdjacentElement('afterend', card);
      else featGrid.appendChild(card);
    }
  }

  // (3) Cada card: subtítulo = hook nuevo + href real a su landing /vsl/<slug>.
  // El id `feat-<slug>` permite volver EXACTAMENTE a esta card desde el detalle.
  root.querySelectorAll<HTMLAnchorElement>('.mk-feature-grid a[href^="#m-"]').forEach((a) => {
    const slug = a.getAttribute('href')!.replace('#m-', '');
    const f = SHOWCASE_BY_SLUG[slug];
    if (!f) return;
    const sub = a.querySelector<HTMLElement>(':scope > div:last-child');
    if (sub) sub.textContent = f.hook;
    a.setAttribute('data-feature', slug);
    a.id = 'feat-' + slug;
    a.setAttribute('href', '/vsl/' + slug); // click → landing dedicada de la feature
  });

  // (4) CTA debajo de la grilla: es el punto donde el visitante ya vio TODO lo
  // que hace el producto — el mejor momento para pedirle la llamada.
  if (featGrid && !featGrid.parentElement?.querySelector('.mk-grid-cta')) {
    const cta = doc.createElement('div');
    cta.className = 'mk-grid-cta';
    cta.innerHTML =
      '<div class="mk-grid-cta-h">¿Lo quieres funcionando en tu negocio?</div>' +
      '<p class="mk-grid-cta-p">Agenda una llamada y te mostramos MaKo con tus propios números.</p>' +
      '<a href="#beta" class="mk-grid-cta-b">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /><path d="M8 15h2v2h-2z" /></svg>Agenda tu llamada</a>';
    featGrid.insertAdjacentElement('afterend', cta);
  }

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
      const trust = doc.createElement('div');
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
}

/**
 * La CAPA de la portada en la app (la landing de Web Generator la usa sola; la de siempre, dentro de
 * CSS_LANDING): tapa la app a pantalla completa y es el contenedor que scrollea. Más lo que necesita el pie
 * legal (PieLegal, en Landing.tsx), que va FUERA del documento.
 */
export const CSS_CAPA = [
  'body:has(.vsl-root) aside { display: none !important; }',
  ".vsl-root { position: fixed; inset: 0; z-index: 100; overflow-y: auto; overflow-x: hidden; background: #FFFFFF; color: #171A21; font-family: 'Geist', system-ui, sans-serif; scroll-behavior: smooth; scroll-padding-top: 84px; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }",
  '.vsl-root * { box-sizing: border-box; }',
  '.vsl-root img { max-width: 100%; }',
  '.vsl-root a { color: inherit; }',
  '.vsl-root ::selection { background: rgba(47,111,237,.15); }',
].join('\n');

/**
 * La hoja del DISEÑO para el documento de Web Generator: CSS_LANDING sin la capa (que es de la app), colgada
 * de `.gm-libre` (la raíz de la página libre, html-editable.ts) en vez de `.vsl-root`. La especificidad queda
 * igual: `.vsl-root .mk-root X` → `.gm-libre.gm-libre X` (dos clases), `.vsl-root X` → `.gm-libre X`.
 * Arriba, lo que la capa le daba al diseño (fuente, tinta, fondo) y el scroll con el header pegajoso, y la
 * fuente Geist (en la app la carga el layout; en hola-mako.site y en el editor, esto).
 */
export function cssDisenoDeLanding(css: string = CSS_LANDING): string {
  const sinCapa = css
    .replace(/\/\* Oculta el Sidebar[^\n]*\n/, '')
    .replace(/body:has\(\.vsl-root\) aside \{[^}]*\}\n?/, '')
    .replace(/\.vsl-root \{[^}]*\}\n?/, '');
  return [
    "@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');",
    'html { scroll-behavior: smooth; scroll-padding-top: 84px; }',
    ".gm-libre { background: #FFFFFF; color: #171A21; font-family: 'Geist', system-ui, sans-serif; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }",
    sinCapa.replace(/\.vsl-root \.mk-root /g, '.gm-libre.gm-libre ').replace(/\.vsl-root/g, '.gm-libre').trim(),
  ].join('\n');
}

/** La hoja de la landing (sobre `.vsl-root`). La primera regla y la de `.vsl-root` son de la capa de la app. */
export const CSS_LANDING = `
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
.vsl-root .mk-feature-grid > a { transition: box-shadow .22s ease, transform .22s ease; cursor: pointer; }
.vsl-root .mk-feature-grid > a:hover { transform: translateY(-3px); box-shadow: 0 20px 44px -22px rgba(16,19,25,.26); }
/* Flecha al pie de cada card: deja claro que se puede entrar. */
.vsl-root .mk-feature-grid > a { position: relative; }
.vsl-root .mk-feature-grid > a::after { content: '→'; margin-top: auto; padding-top: 14px; align-self: flex-end; font-size: 17px; font-weight: 600; color: #2F6FED; transition: transform .22s ease; }
.vsl-root .mk-feature-grid > a:hover::after { transform: translateX(4px); }
/* La card de MaKo es oscura: el azul no se ve. */
.vsl-root .mk-feature-grid > a.mk-feature-mako::after { color: #fff; }
/* CTA debajo de la grilla (mismo bloque que en las páginas de funcionalidad) */
.vsl-root .mk-grid-cta { margin-top: 26px; padding: 40px 32px; border-radius: 22px; text-align: center; background: linear-gradient(160deg,#EFF4FE,#F8FAFD); border: 1px solid #E3EAF6; }
.vsl-root .mk-grid-cta-h { font-size: 25px; font-weight: 600; letter-spacing: -0.01em; color: #12151B; }
.vsl-root .mk-grid-cta-p { margin: 8px 0 22px; font-size: 16px; line-height: 1.55; color: #5B6472; }
.vsl-root .mk-grid-cta-b { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 16px 30px; border-radius: 12px; background: #2F6FED; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; box-shadow: 0 12px 26px -14px rgba(47,111,237,.5); }

/* Grilla a 4 columnas (16 features quedan parejas). Las media queries de más
   abajo la bajan a 2 en tablet/móvil. */
.vsl-root .mk-feature-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; }
.vsl-root .mk-feature-grid > a { min-height: 190px !important; }

/* "¿Para quién es esto?": las dos columnas (✓ / ✕) a la misma altura. */
.vsl-root .mk-pq-grid { align-items: stretch !important; }
/* Calendly: más ancho que alto. Ensanchamos el contenedor del CTA (no con
   transform — el reveal-on-scroll pisa el transform y descentra el embed). El
   texto sigue centrado y angosto por sus propios max-width; solo se ensanchan
   las cards y el calendario, que así usa su layout horizontal (menos alto). */
.vsl-root #beta > div { max-width: 1140px !important; }
.vsl-root #cal-embed { height: 700px !important; }
@media (max-width: 768px) {
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
