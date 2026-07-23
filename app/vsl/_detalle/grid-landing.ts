// =============================================================================
// La grilla de funcionalidades, COPIADA de la landing principal
// =============================================================================
// No se reconstruye: se extraen las cards tal cual del HTML de /vsl y solo se
// tocan los href (#m-slug → /vsl/slug). Así los colores por marca (el verde de
// WhatsApp, el rojo de Gmail) y la card oscura de MaKo quedan idénticos, sin
// tener que mantener una copia paralela que siempre se desincroniza.
//
// Las features que la landing NO trae en su HTML se agregan con el mismo molde
// que usa Landing.tsx al inyectarlas en vivo (tile azul + ícono Tabler).

import { LANDING_HTML } from '../landing-html';
import { FEATURES, FEATURE_ORDER } from './features';
import { SHOWCASE_BY_SLUG } from '../showcase';

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
  const abre = LANDING_HTML.indexOf('>', ini) + 1;
  return LANDING_HTML.slice(abre, fin);
}

const CARD_STYLE = 'display:flex;flex-direction:column;background:#fff;border:1px solid #EAECF1;border-radius:12px;padding:28px 26px;min-height:206px;text-decoration:none;box-shadow:0 1px 2px rgba(16,19,25,.03);transition:box-shadow .22s ease,transform .22s ease';

/** Card para una feature que la landing no trae (mismo molde que Landing.tsx). */
function cardExtra(slug: string): string {
  const f = FEATURES[slug];
  if (!f) return '';
  const paths = f.icon.map((d) => `<path d="${d}" />`).join('');
  const nombre = f.name.split(' — ')[0];
  const hook = f.hook ?? SHOWCASE_BY_SLUG[slug]?.hook ?? f.metaDesc;
  return `<a href="/vsl/${slug}" style="${CARD_STYLE}">` +
    '<div style="width:46px;height:46px;border-radius:12px;background:#EAF1FE;display:flex;align-items:center;justify-content:center;margin-bottom:18px">' +
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;color:#2F6FED">${paths}</svg>` +
    '</div>' +
    `<div style="font-size:17px;font-weight:600;color:#12151B;letter-spacing:-0.01em;line-height:1.25">${nombre}</div>` +
    `<div style="font-size:14px;line-height:1.55;color:#6B7280;margin-top:9px">${hook}</div>` +
    '</a>';
}

const BADGE = '<span style="position:absolute;top:16px;right:16px;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#2F6FED;background:#E4EEFD;padding:4px 9px;border-radius:999px">Estás acá</span>';

/**
 * HTML de la grilla para la página de `slug`:
 * los href apuntan a /vsl/<slug> y la feature actual queda marcada y sin link.
 */
export function gridHtml(slug: string): string {
  let html = cardsDeLaLanding();
  if (!html) return '';

  const yaEstan = new Set([...html.matchAll(/href="#m-([a-z-]+)"/g)].map((m) => m[1]));

  // la feature actual: deja de ser <a> y se marca
  const re = new RegExp(`<a href="#m-${slug}"([\\s\\S]*?)<\\/a>`);
  html = html.replace(re, (_m, resto: string) =>
    `<div aria-current="page"${resto.replace('style="', 'style="position:relative;cursor:default;')}${BADGE}</div>`);

  // el resto: a su landing
  html = html.replace(/href="#m-([a-z-]+)"/g, (_m, s: string) => `href="/vsl/${s}"`);

  // las que la landing no trae, al final y en el orden del catálogo
  const faltan = FEATURE_ORDER.filter((s) => !yaEstan.has(s) && s !== slug).map(cardExtra).join('');
  return html + faltan;
}
