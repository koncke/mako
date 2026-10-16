// =============================================================================
// ficha/reglas-resumen — las reglas PURAS de los bloques de la tab Resumen (docs/diseno-ficha-bloques.md §3)
// =============================================================================
// Las ejecutan los tests (tests/ficha-resumen.test.ts, tests/ficha-armador.test.ts). Los componentes van en
// ./registro-resumen.tsx y ./resumen/; lo que DICEN los bloques, en ./resumen/logica.ts. Este archivo y ésos son del
// frente del Resumen (ver ./tipos.ts, «Cómo se enchufa un bloque»).
//
// 16/10/2026 — EL RESUMEN NATIVO. Martín: «completamente diferente en diseño y funcionalidad... NO tengas miedo a
// ELIMINAR todo lo que existe hoy». Hasta acá cada bloque envolvía una tarjeta de antes (InfoPrincipalCard ENTERA era el
// contacto, con las redes, el ingreso, la dirección, el sexo y la cohorte adentro). Ahora cada bloque del catálogo es
// UNA pieza que lee su dato y escribe SU campo en el lugar, con su diseño normal y el épico. El contacto sólo incluye la
// cohorte, que es de Reuniones y todavía no tiene su bloque.
//
// ⚠️ `estaVacio` de un bloque que «se calla» (`sinDatos: 'se-calla'` del catálogo) dice cuándo no tiene NADA para este
//    lead: mirando no se dibuja ni deja hueco. Los de «raya» (contacto, redes, setter, calificación…) se dibujan siempre
//    para que los llenen, y sólo devuelven true cuando no APLICAN (el motivo de un lead que no salió).
// ⚠️ `disenos` son los que el componente sabe dibujar, en el orden del catálogo (el primero es el de entrada). Con
//    menos de dos no se ofrece «Diseño».
// =============================================================================

import { FUENTES_RESPUESTA, REDES, type FuenteRespuesta } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import { entradaSocialGuardada } from '@/lib/canal-social';
import type { CtxFicha, ReglasDeTab } from './tipos';
import {
  ETAPAS_SIN_RELOJ, PASOS_DE_REUNION, estadoReuniones, ingresoNoAplica, origenDelLead, paginaLegible, respuestaA, respuestasPorFuente,
  reunionesVacias, siguienteAccionDe, type CualReunion, type EstadoReuniones, type RespuestasDeFuente, type SiguienteAccion,
} from './resumen/logica';

/** Salió del funnel: perdido o descalificado (la condición del motivo, la misma que aplica `updateLead`). */
export const salio = (estado: string | null | undefined): boolean => estado === 'perdido' || estado === 'descalificado';

/** Las fuentes de «Lo que contestó» que eligió el bloque, en su orden (sin elegir, todas). */
export const fuentesDe = (p: BloquePuesto): readonly FuenteRespuesta[] => p.opciones?.fuentes ?? FUENTES_RESPUESTA;

/**
 * LO QUE CONTESTÓ en las fuentes del bloque: el formulario de Meta, el de la landing y lo que contestó al agendar (que
 * hasta el 16/10/2026 vivía plegado en la reunión y no se veía sin etapa de reunión).
 */
export function respuestasDelBloque(ctx: Pick<CtxFicha, 'data'>, p: BloquePuesto): RespuestasDeFuente[] {
  return respuestasPorFuente(ctx.data, fuentesDe(p));
}

/** ¿Sabemos de dónde vino? Sin nada de atribución, el bloque se calla. */
export const origenConDatos = (ctx: Pick<CtxFicha, 'data' | 'lead'>): boolean => origenDelLead(ctx.lead, ctx.data) !== null;

/** Las reuniones del lead y lo que su etapa pide de ellas (los «datos sin marcar» completos). */
export function reunionesDelCtx(ctx: Pick<CtxFicha, 'lead' | 'hoy' | 'data'>, ahoraMs = Date.now()): EstadoReuniones {
  return estadoReuniones(ctx.lead, { ahoraMs, hoy: ctx.hoy, pide: (ctx.data?.faltantes ?? []).map((f) => f.id) });
}

/**
 * LA SIGUIENTE ACCIÓN de este lead (./resumen/logica.ts, `siguienteAccionDe`): la reunión sin marcar o la que viene, el
 * próximo paso de la última llamada, lo que sigue según MaKo, o los datos sin marcar que avisan (los de la cabecera).
 */
export function siguienteDelCtx(ctx: Pick<CtxFicha, 'lead' | 'hoy' | 'data'>, o: {
  nombreReunion?: (c: CualReunion) => string; hora?: (iso: string) => string | null; ahoraMs?: number;
} = {}): SiguienteAccion | null {
  const d = ctx.data;
  return siguienteAccionDe({
    reuniones: reunionesDelCtx(ctx, o.ahoraMs),
    nombreReunion: o.nombreReunion ?? ((c) => (c === 'r1' ? 'la reunión 1' : 'la reunión 2')),
    hora: o.hora ?? (() => null),
    pasoLlamada: d?.insights?.[0]?.next_step ?? null,
    proximaAccion: d?.insightGen?.contenido?.proxima_accion ?? null,
    faltan: d?.datos?.avisar ?? [],
  });
}

const sinEmailNiTelefono = (ctx: Pick<CtxFicha, 'lead'>): boolean =>
  !ctx.lead.email?.trim() && !ctx.lead.telefono?.trim() && !ctx.lead.telefono_normalizado?.trim();

export const REGLAS_RESUMEN = {
  // Lo de arriba: lo que toca hacer y lo que hay que mirar antes de escribirle.
  'siguiente-accion': { estaVacio: (ctx) => !siguienteDelCtx(ctx), disenos: ['banner', 'fila', 'chip'] },
  // Sin email ni teléfono no se busca (por el nombre solo es caro y casi siempre un falso parecido).
  'posibles-duplicados': { estaVacio: sinEmailNiTelefono, disenos: ['banner', 'lista'] },
  // El contacto ya no es la tarjeta entera: cada dato es SU bloque. Sólo la cohorte (de Reuniones) sigue adentro.
  contacto: { incluye: ['cohorte'], disenos: ['grilla', 'renglon', 'botonera'] },
  // Sin ninguna red elegida no hay nada que dibujar ni que llenar.
  'redes-y-web': { estaVacio: (_ctx, p) => (p.opciones?.redes ?? REDES).length === 0, disenos: ['chips', 'filas', 'destacada'] },
  direccion: { disenos: ['fila'] },
  sexo: { disenos: ['chip', 'fila'] },
  'setter-y-closer': { disenos: ['cajas', 'chips', 'renglon'] },
  // ⚠️ `cubre` son las fechas y las asistencias: el bloque las carga AHÍ cuando la etapa las pide (`fechasPedidas`,
  //    `sinMarcar`), así que «Solucionar» puede venir. Sin reunión por delante ni nada que cargar, se calla.
  'proxima-reunion': {
    estaVacio: (ctx) => reunionesVacias(reunionesDelCtx(ctx)),
    cubre: PASOS_DE_REUNION,
    disenos: ['automatico', 'numero', 'renglon', 'banner'],
  },
  calificacion: { disenos: ['botones', 'chip', 'fila'] },
  // No es una venta: en un ganado se calla (§3).
  'ingreso-estimado': { estaVacio: (ctx) => ingresoNoAplica(ctx.lead.estado_lead), disenos: ['numero', 'fila'] },
  // En una etapa que terminó no hay reloj (la regla de `puedeTenerPlazo`, lib/lead-quieto.ts).
  'tiempo-en-etapa': { estaVacio: (ctx) => ETAPAS_SIN_RELOJ.includes(ctx.etapa), disenos: ['chip', 'barra', 'numero'] },
  // «Sólo si salió, y se dibuja aunque esté vacío» (§3).
  'motivo-de-salida': { estaVacio: (ctx) => !salio(ctx.lead.estado_lead), disenos: ['texto', 'chips'] },
  // «Sólo en la etapa de nutrición manual».
  'plazo-nutricion': { estaVacio: (ctx) => ctx.etapa !== 'manual', disenos: ['fecha', 'cuenta'] },
  'lo-que-contesto': { estaVacio: (ctx, p) => respuestasDelBloque(ctx, p).length === 0, disenos: ['lista', 'tabla', 'linea', 'tarjetas', 'plegado'] },
  // Sin la pregunta elegida (Opciones, en «Personalizar») o sin respuesta a ella en este lead, no hay nada que destacar.
  'respuesta-destacada': { estaVacio: (ctx, p) => !respuestaA(ctx.data, p.opciones?.pregunta), disenos: ['grande', 'chip', 'fila'] },
  origen: { estaVacio: (ctx) => !origenConDatos(ctx), disenos: ['linea', 'migas', 'chip'] },
  'pagina-de-registro': { estaVacio: (ctx) => !paginaLegible(ctx.lead.pagina_registro), disenos: ['linea', 'fila'] },
  'publicacion-de-entrada': { estaVacio: (ctx) => !entradaSocialGuardada(ctx.lead.entrada_social), disenos: ['linea'] },
  notas: { disenos: ['caja', 'tres', 'ultima'] },
} satisfies ReglasDeTab;
