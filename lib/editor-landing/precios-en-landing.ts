// =============================================================================
// precios-en-landing — los precios de MaKo ADENTRO de una landing de Web Generator, siempre los de hoy (25/10/2026)
// =============================================================================
// Pedido del Cerebro con la investigación de cómo venden los demás (docs/hallazgos-editor-landing.md, «Las landings de MaKo
// con lo que hace la competencia»): el precio a la vista desde la portada y UNA sola fuente de los precios, lib/planes-mako.ts
// (con el setting `planes.mako` que el super admin cambia sin deploy). Una landing de Web Generator es una foto publicada:
// un «US$47» escrito en su HTML se queda viejo el día que cambia el plan. Por eso la landing no escribe el precio, lo MARCA:
//   · `<span data-mako-desde>…</span>`: el precio del plan más barato que se vende hoy («Desde US$47 al mes»);
//   · `<span data-mako-precio="pro">…</span>`: el de ese plan;
//   · `<div data-mako-planes>…</div>`: el lugar de las columnas de precios (app/vsl/PreciosLanding.tsx las pone ahí).
// Lo de adentro es el respaldo (lo que se ve en el editor y en hola-mako.site): hola-mako.com lo pisa con el precio de hoy
// (app/vsl/Landing.tsx). Puro: lo usan la portada, el script que arma las landings y los tests.
// =============================================================================

/** Las columnas de precios van en el elemento con este atributo (si no hay, donde estaba la agenda o antes del pie). */
export const ATRIBUTO_PLANES = 'data-mako-planes';

type PlanConPrecio = { id: string; precioUsd: number };

/** «US$47», «US$1.500», «US$62,30»: como se escriben los precios en la casa. */
export function precioUsd(n: number): string {
  const entero = Number.isInteger(n);
  return `US$${n.toLocaleString('es-AR', { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** El más barato de los que se venden hoy; null si no hay ninguno. */
export function precioDesde(planes: readonly PlanConPrecio[]): number | null {
  const precios = planes.map((p) => p.precioUsd).filter((n) => Number.isFinite(n) && n > 0);
  return precios.length ? Math.min(...precios) : null;
}

/** Un elemento marcado con `attr` (y su valor, si se pide) cuyo contenido es sólo texto: la apertura, el texto, el cierre. */
const marca = (attr: string, valor?: string) =>
  new RegExp(`(<([a-z][a-z0-9]*)\\b[^>]*\\s${attr}${valor === undefined ? '(?:="[^"]*")?' : `="${valor}"`}[^>]*>)([^<]*)(</\\2>)`, 'gi');

/**
 * El HTML con los precios de hoy en sus marcas. Un plan que ya no está deja su respaldo; sin planes, todo queda como vino.
 * Sólo toca el TEXTO de los elementos marcados: el resto del HTML vuelve byte por byte.
 */
export function conPreciosEnHtml(html: string, planes: readonly PlanConPrecio[]): string {
  if (!planes.length || !html.includes('data-mako-')) return html;
  let out = html;
  const desde = precioDesde(planes);
  if (desde != null) out = out.replace(marca('data-mako-desde'), (_t, abre: string, _tag: string, _txt: string, cierra: string) => `${abre}${precioUsd(desde)}${cierra}`);
  for (const p of planes) {
    if (!/^[a-z0-9-]{1,32}$/.test(p.id) || !(p.precioUsd > 0)) continue;
    out = out.replace(marca('data-mako-precio', p.id), (_t, abre: string, _tag: string, _txt: string, cierra: string) => `${abre}${precioUsd(p.precioUsd)}${cierra}`);
  }
  return out;
}
