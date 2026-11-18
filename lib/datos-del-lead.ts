import 'server-only';

// =============================================================================
// datos-del-lead — «N SIN MARCAR» de UN lead, contado UNA vez para las tres fichas
// =============================================================================
// Lo leen el pop-up del tablero y la ruta /crm/[id] (las dos por `getLeadFullAction`, app/crm/actions.ts)
// y la ficha del teléfono (`fichaV2`, app/m/crm/datos.ts). Pedido del 15/10/2026: la ficha del teléfono
// muestra «N sin marcar» con el MISMO número que el escritorio.
//
// ⚠️ LOS INSUMOS SON PARTE DE LA CUENTA. «N sin marcar» depende del plan (¿hay cuotas?), de los
//    comprobantes que faltan, de si la R2 ya tiene respuestas, de las etapas DEL LEAD y de si el encuentro se
//    graba (Fathom). Hasta el 14/10/2026 la ruta los juntaba a mano, sin `grabable` y con el plan como
//    `true | undefined`, y el número salía distinto que en el pop-up. Por eso aquí van las DOS mitades: la
//    lectura de los insumos (`leerInsumosDatosLead`, con sus caídas) y la cuenta (`datosSinMarcarDeLead`).
//    Quien quiera el número llama a las dos; no arma los insumos por su cuenta. Lo fija tests/m-ficha-bloques.test.ts.
// ⚠️ Las etapas son las DEL LEAD (`getPipelineStagesDeLead`) y, si la lectura falla o viene vacía, las de
//    por defecto: la misma regla que `etapaParaModelo` de MaKo (tests/mako-ficha-lead.test.ts).
// =============================================================================

import { faltantesDeLead, getLeadRespuestas, type Lead, type RespuestaQA } from './leads';
import { getPipelineStagesDeLead } from './funnels';
import { DEFAULT_STAGES, type Stage } from './pipeline';
import { getPagosByLead, type Pago } from './pagos';
import { faltaComprobante } from './pago-comprobante';
import { encuentroGrabable } from './encuentro-ws';
import { estadoDatosDeLead } from './datos-aviso-config';
import type { Step } from './stage-requirements';
import type { EstadoDatos } from './datos-aviso';
import { hoyEnWorkspace } from './timezone';

/** Lo que hace falta leer para contar los datos sin marcar de un lead. La ficha de escritorio usa también el resto. */
export type InsumosDatosLead = {
  pagos: Pago[];
  /** Las etapas DEL LEAD; nunca vacía (cae a DEFAULT_STAGES). */
  stages: Stage[];
  respuestas: { R1: RespuestaQA[]; R2: RespuestaQA[] };
  /** ¿El encuentro se graba? (si no, el Fathom no se pide). */
  grabable: boolean;
  /** HOY en la zona del NEGOCIO (18/11/2026, F125): decide si una reunión sin hora ya pasó. Era el de Tijuana. */
  hoy: string;
};

/** Los insumos, en paralelo. Ninguna lectura tira: cada una cae a lo que ya caía en la ficha de escritorio. */
export async function leerInsumosDatosLead(lead: Lead): Promise<InsumosDatosLead> {
  const [pagos, stagesRaw, respuestas, grabable, hoy] = await Promise.all([
    getPagosByLead(lead.id).catch(() => [] as Pago[]),
    // DEL LEAD: la ficha pinta los requisitos de SU recorrido.
    getPipelineStagesDeLead(lead).catch(() => DEFAULT_STAGES),
    getLeadRespuestas(lead),
    encuentroGrabable(),
    // Nunca tira (sin zona legible, el default): lo mismo que el CRM le pasa a «A revisar» (app/crm/page.tsx).
    hoyEnWorkspace(),
  ]);
  const stages = stagesRaw.length ? stagesRaw : DEFAULT_STAGES;
  return { pagos, stages, respuestas, grabable, hoy };
}

/**
 * Los datos sin marcar del lead: la lista completa (`faltantes`, la que usa el asistente de «Completar datos»)
 * y partida en lo que AVISA y lo escondido (`datos`, con los avisos de la ficha de SU funnel). «N sin marcar»
 * es `datos.avisar.length`.
 */
export async function datosSinMarcarDeLead(lead: Lead, i: InsumosDatosLead): Promise<{ faltantes: Step[]; datos: EstadoDatos }> {
  // Un cobro confirmado por la pasarela no pide comprobante (lib/pago-comprobante.ts).
  const comprobantesFaltantes = i.pagos.filter(faltaComprobante).length;
  const extraReq = { comprobantesFaltantes, r2RespuestasOk: i.respuestas.R2.length > 0, pipeline: i.stages, hoyISO: i.hoy, grabable: i.grabable };
  const faltantes = faltantesDeLead(lead, i.pagos.length > 0, extraReq);
  const datos = await estadoDatosDeLead(lead, faltantes, i.pagos.length > 0, extraReq);
  return { faltantes, datos };
}
