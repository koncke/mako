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
//
// LA PRUEBA GRATIS (25/10/2026, Martín: fuera la garantía de devolución, entra una prueba de 7 días con tarjeta y cobro
// el día 8). Igual que el precio: la landing la MARCA y la llena la fuente (`PRUEBA_DIAS`, lib/planes-mako.ts, de Planes):
//   · `<span data-mako-prueba="linea">…</span>`: la línea bajo el botón («7 días gratis · Cancela cuando quieras · …»);
//   · `<span data-mako-prueba="boton">…</span>`: el texto del botón («Empieza tus 7 días gratis»);
//   · `<span data-mako-prueba="dias">…</span>` y `="cobro"`: los días, y el día del primer cobro, adentro de una frase.
// Lo que va bajo el botón de CADA plan («Después US$ 97/mes…») lo pone la columna misma (`textoDespuesDeLaPrueba`,
// app/planes/Tarjetas.tsx): las columnas de la landing son las de /planes.
// =============================================================================

/** Las columnas de precios van en el elemento con este atributo (si no hay, donde estaba la agenda o antes del pie). */
export const ATRIBUTO_PLANES = 'data-mako-planes';

type PlanConPrecio = { id: string; precioUsd: number };

/** La línea corta bajo el botón de una landing, con los días de la prueba (`PRUEBA_DIAS`). */
export const lineaDePrueba = (dias: number) => `${dias} días gratis · Cancela cuando quieras · Usas tu propia IA`;
/** El texto del botón de una landing, con los días de la prueba (`PRUEBA_DIAS`). */
export const botonDePrueba = (dias: number) => `Empieza tus ${dias} días gratis`;

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

/**
 * Las etiquetas de FORMATO que pueden envolver el texto de una marca (26/10/2026): la barra «Texto» de un diseño pone
 * negrita, cursiva, un color o un enlace sobre el precio, y con eso adentro la marca no se reconocía: el precio quedaba
 * congelado en el que tenía el día que se publicó.
 */
const FORMATO = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'mark', 'small', 'span', 'a', 'font', 'sub', 'sup']);

/** El índice del cierre de `<tag>` que abrió antes de `desde` (cuenta los del mismo nombre de adentro), o -1. */
function cierreDe(html: string, tag: string, desde: number): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = desde;
  let prof = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) { if (--prof === 0) return m.index; } else if (!m[0].endsWith('/>')) prof++;
  }
  return -1;
}

/**
 * El contenido de una marca con el texto nuevo: si adentro hay sólo texto y etiquetas de formato, el texto va en el
 * primer pedazo (con sus espacios de los costados) y los otros se vacían; las etiquetas quedan. Otra cosa adentro, null.
 */
function conTextoNuevo(adentro: string, nuevo: string): string | null {
  const partes = adentro.split(/(<[^>]*>)/);
  for (const p of partes) {
    if (!p.startsWith('<')) continue;
    const t = /^<\/?([a-z][a-z0-9]*)/i.exec(p)?.[1]?.toLowerCase();
    if (!t || !FORMATO.has(t)) return null;
  }
  let puesto = false;
  const res = partes.map((p) => {
    if (p.startsWith('<') || !p.trim()) return p;
    if (puesto) return '';
    puesto = true;
    const m = /^(\s*)[\s\S]*?(\s*)$/.exec(p);
    return (m?.[1] ?? '') + nuevo + (m?.[2] ?? '');
  });
  if (puesto) return res.join('');
  return partes.some((p) => p.startsWith('<')) ? null : nuevo;
}

/** Cada elemento marcado con `attr` (y su valor, si se pide), con `nuevo` como su texto. Lo demás vuelve byte por byte. */
function ponerEnMarcas(html: string, attr: string, valor: string | undefined, nuevo: string): string {
  const re = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\s${attr}${valor === undefined ? '(?:="[^"]*")?' : `="${valor}"`}[^>]*>`, 'gi');
  let out = '';
  let hecho = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const ini = m.index + m[0].length;
    const fin = cierreDe(html, m[1], ini);
    if (fin < 0) continue;
    const contenido = conTextoNuevo(html.slice(ini, fin), nuevo);
    if (contenido === null) continue;
    out += html.slice(hecho, ini) + contenido;
    hecho = fin;
    re.lastIndex = fin;
  }
  return out + html.slice(hecho);
}

/**
 * El HTML con los precios de hoy (y los días de la prueba gratis, si se pasan) en sus marcas. Un plan que ya no está deja su respaldo;
 * sin planes ni prueba, todo queda como vino. Sólo toca el TEXTO de los elementos marcados: el resto vuelve byte por byte.
 */
export function conPreciosEnHtml(html: string, planes: readonly PlanConPrecio[], diasDePrueba: number | null = null): string {
  if (!html.includes('data-mako-')) return html;
  let out = html;
  if (diasDePrueba != null && Number.isInteger(diasDePrueba) && diasDePrueba > 0) {
    const d = diasDePrueba;
    const textos: Record<string, string> = { linea: lineaDePrueba(d), boton: botonDePrueba(d), dias: String(d), cobro: String(d + 1) };
    for (const [cual, t] of Object.entries(textos)) out = ponerEnMarcas(out, 'data-mako-prueba', cual, t);
  }
  if (!planes.length) return out;
  const desde = precioDesde(planes);
  if (desde != null) out = ponerEnMarcas(out, 'data-mako-desde', undefined, precioUsd(desde));
  for (const p of planes) {
    if (!/^[a-z0-9-]{1,32}$/.test(p.id) || !(p.precioUsd > 0)) continue;
    out = ponerEnMarcas(out, 'data-mako-precio', p.id, precioUsd(p.precioUsd));
  }
  return out;
}
