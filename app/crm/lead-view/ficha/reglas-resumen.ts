// =============================================================================
// ficha/reglas-resumen — las reglas PURAS de los bloques de la tab Resumen (docs/diseno-ficha-bloques.md §3)
// =============================================================================
// Las ejecuta tests/ficha-armador.test.ts. Los componentes van en ./registro-resumen.tsx. Este archivo y ese
// son del frente del Resumen: otro frente no los toca (ver ./tipos.ts, «Cómo se enchufa un bloque»).
//
// HOY (14/10/2026) son las tarjetas de siempre envueltas, así la ficha con la plantilla de respaldo se ve
// como antes. Lo que cada una ya dibuja adentro va en `incluye`: `contacto` es InfoPrincipalCard ENTERA,
// con la web, las redes, el ingreso estimado, la dirección, el sexo y la cohorte que elige el negocio
// (`crm.resumen.campos`). Cuando un bloque de esos tenga su propio componente, sale de ese `incluye` y la
// tarjeta deja de dibujarlo, en el mismo cambio.
// =============================================================================

import { nutricionPositivaDe } from '@/lib/pipeline';
import { FUENTES_RESPUESTA, type FuenteRespuesta } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import type { CtxFicha, ReglasDeTab } from './tipos';

/** Salió del funnel: perdido o descalificado. Es `leadSalio` (../MotivoYPlazoCard.tsx), que no se puede importar acá. */
export const salio = (estado: string | null | undefined): boolean => estado === 'perdido' || estado === 'descalificado';

/** Las fuentes de «Lo que contestó» que eligió el bloque, en su orden (sin elegir, todas). */
export const fuentesDe = (p: BloquePuesto): readonly FuenteRespuesta[] => p.opciones?.fuentes ?? FUENTES_RESPUESTA;

/**
 * Lo que contestó en las fuentes que se dibujan en el Resumen. Las de la agenda (Calendly, Cal.com) siguen
 * adentro de la reunión (`reunion-1`, ReunionesCard) hasta que este bloque las junte.
 */
export function respuestasDelBloque(ctx: Pick<CtxFicha, 'data'>, p: BloquePuesto): Array<{ fuente: 'meta' | 'landing'; respuestas: ReadonlyArray<{ pregunta: string; respuesta: string }> }> {
  const out: Array<{ fuente: 'meta' | 'landing'; respuestas: ReadonlyArray<{ pregunta: string; respuesta: string }> }> = [];
  for (const f of fuentesDe(p)) {
    if (f === 'meta' && ctx.data.respuestasForm?.length) out.push({ fuente: 'meta', respuestas: ctx.data.respuestasForm });
    if (f === 'landing' && ctx.data.respuestasLanding?.length) out.push({ fuente: 'landing', respuestas: ctx.data.respuestasLanding });
  }
  return out;
}

/**
 * ¿Sabemos de dónde vino? Es la misma pregunta que OrigenCard (`tieneAtribucion`): sin nada de esto, la
 * tarjeta sólo decía «No hay forma de reconstruirlo», y el diseño la calla (§3, Tracking).
 */
export function origenConDatos(ctx: Pick<CtxFicha, 'data' | 'lead'>): boolean {
  const l = ctx.lead;
  return !!(l.origen_lead || l.meta_campaign_name || ctx.data.campana?.texto || l.meta_adset_name || ctx.data.adNombre
    || l.meta_ad_name || ctx.data.adId || l.utm_campaign?.trim() || l.utm_source?.trim() || l.utm_content?.trim());
}

export const REGLAS_RESUMEN = {
  // InfoPrincipalCard entera, con lo que elige el negocio (crm.resumen.campos). No se puede quitar.
  contacto: { incluye: ['redes-y-web', 'ingreso-estimado', 'direccion', 'sexo', 'cohorte'] },
  // El banner «Va bien» (`nutricionPositivaDe`): sin una reunión por delante, no hay nada que decir.
  // ⚠️ `cubre: []`: el banner no tiene los campos de las fechas (viven en la reunión), así que
  //    «Solucionar» una fecha no lo elige a él.
  'proxima-reunion': {
    estaVacio: (ctx) => !nutricionPositivaDe(ctx.lead, ctx.hoy),
    cubre: [],
    disenos: ['banner', 'renglon'],
  },
  calificacion: {},
  // Las dos RespuestasFormulario (Meta y la landing), en el orden de sus fuentes.
  'lo-que-contesto': { estaVacio: (ctx, p) => respuestasDelBloque(ctx, p).length === 0 },
  origen: { estaVacio: (ctx) => !origenConDatos(ctx) },
  notas: {},
  // «Sólo si salió, y se dibuja aunque esté vacío» (§3).
  'motivo-de-salida': { estaVacio: (ctx) => !salio(ctx.lead.estado_lead) },
  // «Sólo en la etapa de nutrición manual».
  'plazo-nutricion': { estaVacio: (ctx) => ctx.etapa !== 'manual' },
} satisfies ReglasDeTab;
