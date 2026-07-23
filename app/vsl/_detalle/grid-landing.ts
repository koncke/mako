// =============================================================================
// La grilla de funcionalidades, COPIADA de la landing principal
// =============================================================================
// No se reconstruye ni se reescribe: se toman las cards del HTML de /vsl y se
// repite EXACTAMENTE lo que Landing.tsx hace en runtime —
//   1. inyectar las cards que el HTML no trae, en sus posiciones (INJECT_ORDER)
//   2. reemplazar el subtítulo de TODAS por el hook del showcase
//   3. apuntar cada href a /vsl/<slug>
// …más lo propio de esta página: ocultar las funcionalidades que todavía no se
// muestran y marcar la actual con "Estás acá".
//
// Así los colores por marca (el verde de WhatsApp, el rojo de Gmail), la card
// oscura de MaKo, el orden y los textos son los mismos, sin copia paralela que
// se desincronice.

import { LANDING_HTML } from '../landing-html';
import { FEATURES } from './features';
import { SHOWCASE_BY_SLUG, INJECT_ORDER, OCULTAS } from '../showcase';

/** Cards de la landing, en crudo. Vacío si el HTML cambió de forma. */
function cardsDeLaLanding(): string {
  const i = LANDING_HTML.indexOf('mk-feature-grid');
  if (i < 0) return '';
  const ini = LANDING_HTML.lastIndexOf('<div', i);
  let d = 0, j = ini, fin = -1;
  while (j < LANDING_HTML.length) {
    if (LANDING_HTML.startsWith('<div', j)) d++;
    else if (LANDING_HTML.startsWith('</div>', j)) { d--; if (d === 0) { fin = j; break; } }
    j++;
  }
  if (fin < 0) return '';
  return LANDING_HTML.slice(LANDING_HTML.indexOf('>', ini) + 1, fin);
}

const CARD_STYLE = 'display:flex;flex-direction:column;background:#fff;border:1px solid #EAECF1;border-radius:12px;padding:28px 26px;min-height:206px;text-decoration:none;box-shadow:0 1px 2px rgba(16,19,25,.03);transition:box-shadow .22s ease,transform .22s ease';

/** Card inyectada — idéntica a la que arma Landing.tsx (makeCard). */
function cardInyectada(slug: string): string {
  const f = SHOWCASE_BY_SLUG[slug];
  if (!f) return '';
  const paths = f.icon.map((d) => `<path d="${d}" />`).join('');
  const titulo = f.name.split(' — ')[0];
  return `<a href="#m-${slug}" style="${CARD_STYLE}">` +
    '<div style="width:46px;height:46px;border-radius:12px;background:#EAF1FE;display:flex;align-items:center;justify-content:center;margin-bottom:18px">' +
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;color:#2F6FED">${paths}</svg>` +
    '</div>' +
    `<div style="font-size:17px;font-weight:600;color:#12151B;letter-spacing:-0.01em;line-height:1.25">${titulo}</div>` +
    `<div style="font-size:14px;line-height:1.55;color:#6B7280;margin-top:9px">${f.hook}</div>` +
    '</a>';
}

const BADGE = '<span style="position:absolute;top:16px;right:16px;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#2F6FED;background:#E4EEFD;padding:4px 9px;border-radius:999px">Estás acá</span>';

/** Corta el HTML en cards `<a href="#m-slug">…</a>`, en orden. */
function partir(html: string): { slug: string; html: string }[] {
  const out: { slug: string; html: string }[] = [];
  const re = /<a href="#m-([a-z-]+)"[\s\S]*?<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ slug: m[1], html: m[0] });
  return out;
}

/**
 * HTML de la grilla para la página de `slug`: mismo contenido y mismo orden que
 * la landing, con la funcionalidad actual marcada y sin link.
 */
export function gridHtml(slug: string): string {
  const cards = partir(cardsDeLaLanding());
  if (!cards.length) return '';

  // 1. inyectar las que el HTML no trae, en su posición
  for (const [nuevo, despuesDe] of INJECT_ORDER) {
    if (!SHOWCASE_BY_SLUG[nuevo] || cards.some((c) => c.slug === nuevo)) continue;
    const i = cards.findIndex((c) => c.slug === despuesDe);
    const card = { slug: nuevo, html: cardInyectada(nuevo) };
    if (i >= 0) cards.splice(i + 1, 0, card); else cards.push(card);
  }

  return cards
    .filter((c) => !OCULTAS.has(c.slug) && FEATURES[c.slug])
    .map((c) => {
      // 2. el subtítulo SIEMPRE es el hook del showcase (lo mismo que hace la landing)
      let h = c.html;
      const hook = SHOWCASE_BY_SLUG[c.slug]?.hook;
      if (hook) h = h.replace(/(margin-top:9px">)[\s\S]*?(<\/div>)/, `$1${hook}$2`);
      // 3. la actual: deja de ser link y se marca
      if (c.slug === slug) {
        return h
          .replace(/^<a href="#m-[a-z-]+"/, '<div aria-current="page"')
          .replace('style="', 'style="position:relative;cursor:default;')
          .replace(/<\/a>$/, `${BADGE}</div>`);
      }
      return h.replace(/href="#m-[a-z-]+"/, `href="/vsl/${c.slug}"`);
    })
    .join('');
}
