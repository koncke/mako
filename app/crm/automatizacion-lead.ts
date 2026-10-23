// =============================================================================
// El lead en una automatización, en el CRM: el chip de la tarjeta, su detalle y la pregunta de «Frenar» (22/10/2026)
// =============================================================================
// Martín (22/10/2026): «en el CRM debería indicar en la tarjeta o en algún lugar que esos leads están en una
// automatización activa, y que desde el CRM también se pueda frenar». Es para el Sprint de Mauricio: la #289 le escribe
// sola, desde su línea, a quien entra a «Prospección activa».
//   · La tarjeta: un chip chico, de la familia de «Datos pendientes», que dice que está en una automatización. Al pasar,
//     cuál y en qué paso (`detalle`, en el `title`); tocando, la ficha rápida lo dice en una fila.
//   · El clic derecho de la tarjeta y la barra de lote: «Frenar automatización». No se deshace: se pregunta antes.
//   · La ficha: el bloque «Automatizaciones en curso», con el paso y un «Frenar» por automatización.
// Los datos y el frenar son de Automations (app/automations/automatizaciones-del-lead-actions.ts y
// lib/automatizaciones-del-lead-reglas.ts). Puro: lo prueba
// tests/crm-automatizacion-lead.test.ts.
// =============================================================================

import type { EnAutomatizacion } from '@/lib/automatizaciones-del-lead-reglas';

/** Hasta cuántos leads por pedido (el tope de `enAutomatizacionesAction`): un tablero más grande se pide en tandas. */
export const TANDA_AUTOMATIZACIONES = 500;

export function enTandasDe<T>(xs: readonly T[], n = TANDA_AUTOMATIZACIONES): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Le está corriendo: la inscripción sigue activa y la automatización no está en pausa. */
export const corre = (a: EnAutomatizacion): boolean => a.estado === 'activa' && a.automatizacionActiva;

/**
 * «Sprint · apertura» · paso 2: WHATSAPP: Hola… — con la pausa, la respuesta o POR QUÉ NO LE SALE (23/10/2026, P0 de #289:
 * «No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale mañana 9:00.», lib/por-que-no-sale.ts).
 */
export function lineaDeAutomatizacion(a: EnAutomatizacion): string {
  const paso = a.paso ? `paso ${a.paso.numero}: ${a.paso.titulo}` : 'paso sin ubicar';
  const nota = a.estado === 'respondio' ? ' · frenada: respondió' : !a.automatizacionActiva ? ' · la automatización está en pausa'
    : a.frenado ? ` · ${a.frenado.texto}` : '';
  return `«${a.nombre}» · ${paso}${nota}`;
}

/**
 * Lo que dice la ficha de cada una: la respuesta, la pausa, por qué no le sale (en palabras: nunca silencio) o cuándo sale
 * lo próximo. `fecha` formatea la hora del próximo (la ficha la dice en la hora del navegador).
 */
export function estadoDeAutomatizacion(a: EnAutomatizacion, fecha: (iso: string) => string): string {
  if (a.estado === 'respondio') return 'Frenada: respondió';
  if (!a.automatizacionActiva) return 'La automatización está en pausa';
  if (a.frenado) return a.frenado.texto;
  return a.proximoEnvioAt ? `Lo próximo sale ${fecha(a.proximoEnvioAt)}` : 'Corriendo';
}

export type ChipAutomatizacion = { texto: string; tono: 'mako' | 'gris'; detalle: string };

/**
 * El chip de la tarjeta. `mako` (el color de lo que hace MaKo) si le está corriendo alguna; gris si todas están en pausa o
 * frenadas porque respondió: está adentro, pero no le sale nada. Sin ninguna, no hay chip.
 */
export function chipDeAutomatizacion(auts: readonly EnAutomatizacion[] | undefined | null): ChipAutomatizacion | null {
  if (!auts?.length) return null;
  const corriendo = auts.filter(corre);
  // ⚠️ SI A TODAS LAS QUE LE CORREN ALGO LAS FRENA (el horario, el envío apagado, un fallo), EL CHIP LO DICE (23/10/2026,
  // P0 de #289: Martín y su esposa entraron a las 21:47 de Tijuana y nada lo decía). Corto («Sale mañana 9:00»), gris (ahora
  // no le sale nada), y el porqué entero en el `title`.
  const frenadas = corriendo.filter((a) => a.frenado);
  if (corriendo.length && frenadas.length === corriendo.length) {
    return { texto: frenadas[0].frenado!.corto, tono: 'gris', detalle: auts.map(lineaDeAutomatizacion).join('\n') };
  }
  const texto = corriendo.length
    ? (corriendo.length === 1 ? 'En automatización' : `En ${corriendo.length} automatizaciones`)
    : auts.every((a) => a.estado === 'respondio') ? 'Respondió: frenada' : 'Automatización en pausa';
  return { texto, tono: corriendo.length ? 'mako' : 'gris', detalle: auts.map(lineaDeAutomatizacion).join('\n') };
}

/** La pregunta de «Frenar» antes de hacerlo: NOMBRA a quién y de dónde, y dice que no se deshace. */
export function preguntaDeFrenar(o: { leads: number; nombre?: string | null; auts?: readonly EnAutomatizacion[] }): { titulo: string; mensaje: string } {
  const quien = o.leads === 1 ? (o.nombre?.trim() || 'este lead') : `${o.leads} leads`;
  const donde = o.auts?.length === 1 ? ` en «${o.auts[0].nombre}»` : o.auts && o.auts.length > 1 ? ` en sus ${o.auts.length} automatizaciones` : '';
  return {
    titulo: `¿Frenar a ${quien}${donde}?`,
    mensaje: `No ${o.leads === 1 ? 'le' : 'les'} sale nada más. Para que ${o.leads === 1 ? 'vuelva' : 'vuelvan'}, se ${o.leads === 1 ? 'lo inscribe' : 'los inscribe'} a mano.`,
  };
}
