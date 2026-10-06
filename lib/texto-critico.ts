// =============================================================================
// Lo que un texto reescrito por la IA NO puede perder
// =============================================================================
// Cuando un modelo reescribe un mensaje —las variantes de un paso, o el paso en modo IA
// que se adapta a cada persona— hay piezas que no son prosa: son DATOS. Un
// `{{lead_nombre}}`, un link a la agenda, un precio. Si el modelo las cambia, el mensaje
// sale con algo que nadie escribió: sin personalizar, con un link roto, con otro número.
//
// Es la regla de la casa de que un dato exacto que pasa por un LLM deja de ser exacto, y
// por eso esto es la SEGUNDA capa: el prompt le pide conservarlas (para que acierte) y este
// módulo lo COMPRUEBA (para cuando no acierte). Sin la segunda, la regla es una expresión
// de deseo.
//
// SIN `server-only` a propósito: lo importan el motor (server) y el test que lo ejecuta.
// Vivía copiado adentro de lib/secuencias-variantes.ts; ahora lo usan los dos lugares que
// reescriben mensajes, y una regla escrita dos veces es la que se queda vieja.

/**
 * Los placeholders que el motor resuelve.
 *
 * ⚠️ CON LLAVE DOBLE Y CON LLAVE SIMPLE. `aplicarVariables` (lib/template-vars.ts) acepta
 * `{{nombre}}` y `{nombre}`, así que un paso escrito con una sola llave también personaliza
 * — y si la lista de piezas sólo mirara las dobles, una reescritura que pierde `{nombre}`
 * pasaba la validación y el mensaje salía sin el nombre. La forma simple va acotada a lo
 * que esa función reconoce (letras y guión bajo): una llave suelta en la prosa no es un dato.
 */
const PLACEHOLDER = /\{\{[^}]+\}\}|\{\s*[a-z_]+\s*\}/gi;
const LINK = /https?:\/\/[^\s)>\]]+/g;

/** Los placeholders y los links que el texto trae. */
export function piezasCriticas(texto: string): string[] {
  return [
    ...(texto.match(PLACEHOLDER) ?? []),
    ...(texto.match(LINK) ?? []),
  ];
}

/**
 * Los números que el texto trae: precios, horas, fechas, cantidades. Se comparan como
 * secuencias de dígitos para no confundir «$1.500» con «$1500» (es el mismo dato) pero sí
 * «$1.500» con «$1.200» (que no lo es).
 */
export function numerosDe(texto: string): string[] {
  // Se sacan los links y los placeholders antes: el «2026» de una URL no es un dato del
  // mensaje, y contarlo haría fallar una reescritura que conservó el link entero.
  const prosa = texto.replace(LINK, ' ').replace(PLACEHOLDER, ' ');
  return (prosa.match(/\d[\d.,:]*/g) ?? []).map((n) => n.replace(/[.,:]/g, ''));
}

export type Veredicto = { ok: true } | { ok: false; motivo: string };

/**
 * ¿La reescritura conserva lo que el original afirma?
 *
 * Tres comprobaciones, y cada una deja escrito por qué rechaza — un rechazo sin motivo
 * hace indistinguibles «el modelo no contestó» de «lo tiramos nosotros».
 *  1. Cada placeholder y cada link del original aparece IGUAL.
 *  2. Ningún número del original desaparece, y no aparece ninguno que el original no
 *     tenga: un modelo que «redondea» un precio o inventa una hora es el caso caro.
 *  3. El largo no se va de proporción: una respuesta de seis párrafos a un mensaje de dos
 *     líneas no es «el mismo mensaje adaptado».
 */
export function respetaElOriginal(
  original: string,
  reescrito: string,
  tope: { min: number; max: number } = { min: 0.4, max: 2.5 },
): Veredicto {
  const base = original.trim();
  const t = reescrito.trim();
  if (!t) return { ok: false, motivo: 'vino vacío' };

  for (const p of piezasCriticas(base)) {
    if (!t.includes(p)) return { ok: false, motivo: `perdió «${p.length > 40 ? p.slice(0, 40) + '…' : p}»` };
  }

  const antes = numerosDe(base);
  const despues = numerosDe(t);
  for (const n of antes) {
    if (!despues.includes(n)) return { ok: false, motivo: `cambió o sacó el número ${n}` };
  }
  for (const n of despues) {
    if (!antes.includes(n)) return { ok: false, motivo: `agregó un número que el original no tiene (${n})` };
  }

  if (t.length > base.length * tope.max) return { ok: false, motivo: `quedó demasiado largo (${t.length} contra ${base.length})` };
  if (t.length < base.length * tope.min) return { ok: false, motivo: `quedó demasiado corto (${t.length} contra ${base.length})` };
  return { ok: true };
}
