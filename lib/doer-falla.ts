// =============================================================================
// doer-falla — cuando la persona le cuenta a MaKo que algo NO ANDA: el ticket a mano, y la causa si se sabe (27/10/2026)
// =============================================================================
// Leila (26/10), cuatro intentos: «no puede analizar la llamada de fathom» → MaKo: «puede deberse a un problema con la
// grabación». Ella: «y tú eres el servicio técnico». La causa era SU Claude sin crédito, y el propio MaKo se lo había avisado a
// las 15:31. Dos huecos:
//   · el reporte caía en charlar o en «capturar (dudosa)», y `levantar_ticket` sólo viaja en «actuar»
//     (lib/doer-herramientas.ts): MaKo no podía ofrecer el ticket, contestaba como un manual;
//   · MaKo no sabía que SU IA estaba fallando: eso vive en `anthropic_usage` (lib/su-clave.ts, `estadoDeSusClaves`).
// El mismo criterio que el chat de la app («lo que no existe se dice y sale el ticket», «MaKo inteligente»).
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-falla.test.ts.
// =============================================================================

import type { EstadoSuClave, ProvSuClave } from './su-clave-reglas';
import type { Area } from './api-mako/tipos';
import { RELEVANCIA_AGENDA, type VeredictoIntencion } from './mako-intencion';
import { corrigeUnMonto } from './doer-falla-frases';
import { esFallaTragada } from './no-pude-frases';

// Los detectores de lo que la persona escribe («sos el soporte», «abrime la agenda») viven aparte: nombran las formas de vos y
// van fuera de la guarda de voseo; la nota de abajo, no (lib/doer-falla-frases.ts).
export { reportaFalla, pideVerAgenda, corrigeUnMonto } from './doer-falla-frases';

/**
 * EL TICKET DE UNA FALLA EN EL GRUPO: «propone» (viaja `levantar_ticket` y queda esperando el «sí») o «abre» (la regla de
 * Martín del 27/10/2026: «siempre que MaKo responda "No lo pude hacer" debe levantar automáticamente un ticket»). Con «abre»,
 * `levantar_ticket` no viaja por la falla, y la nota le pide al modelo la marca `[[no-pude: …]]`: el ticket y su línea los
 * pone el código (`conTicketsDeMaKo`, lib/no-pude-server.ts, después del saneo en lib/mako-doer-in.ts). Es el único lugar.
 */
export const TICKET_DE_LA_FALLA: 'propone' | 'abre' = 'abre';

/** De dónde sale el ticket de un CARTEL del grupo: del negocio (uno por negocio y causa, se cierra solo), o NUESTRO (la huella
 *  global de lib/errores-app.ts, que avisa al grupo cuando se arregla). */
export type CausaDelCartel = 'configuracion' | 'proveedor' | 'nuestro';

/**
 * La causa del ticket de un cartel, por su `cartel` (lib/fallo-ia-texto.ts) y no por el texto (la revisión del Cerebro):
 * le falta algo SUYO (su IA, su cupo, la red cortada por datos) → configuración; la IA no contestó (caída, lenta, sin una
 * segunda clave) → proveedor; lo hicimos mal nosotros (descartamos lo que contestó, el mensaje no entra) → nuestro.
 */
export function causaDelCartel(cartel: string): CausaDelCartel | null {
  if (cartel === 'sin_keys' || cartel === 'sin_cuota' || cartel === 'sin_red_por_datos') return 'configuracion';
  if (cartel === 'proveedor_caido' || cartel === 'ia_lenta' || cartel === 'sin_respaldo') return 'proveedor';
  if (cartel === 'fallo_nuestro' || cartel === 'mensaje_muy_largo') return 'nuestro';
  return null;
}

/** El cartel con la línea del ticket: la del negocio («(ticket #n)») pegada al aviso; la nuestra, en su propio párrafo. */
export function conLaLineaDelTicket(aviso: string, linea: string | null, causa: CausaDelCartel | null): string {
  if (!linea) return aviso;
  return causa === 'nuestro' ? `${aviso}\n\n${linea}` : `${aviso} ${linea}`;
}

/** Lo que trae una corrección de monto: encontrar el lead y su cobranza, y PROPONER el cambio. Mueven plata (D2): en el
 *  grupo se confirman con un «sí» solo (lib/confirmacion-pura.ts). */
export const HERRAMIENTAS_CORRECCION = ['buscar_leads', 'cobranza_lead', 'editar_venta_lead', 'editar_cuota'] as const;

/**
 * QUÉ HACE UNA CORRECCIÓN DE MONTO CON EL TURNO, en una sola función: la intención Y las herramientas (la revisión adversarial
 * de 82ab77cd8: se decidían en dos lugares y se probaban por separado). Con la foto, el pedido era «pensar», y ahí las
 * escrituras no viajan a propósito (se OFRECE): por eso no llegaban `editar_venta_lead` ni `editar_cuota` (Leila, hallazgo 6).
 *   · Sin corrección, o un «sí» a algo pendiente (`confirmar`): nada. Con una pendiente, otra `editar_cuota` dejaría dos
 *     pendientes con montos opuestos.
 *   · Un «capturar» EXPLÍCITO (anotar, sin duda) o un pedido de agenda o de mover: la intención queda como está, con su
 *     contrato y su presupuesto (agenda_del_dia, listar_tareas_plan). Las cuatro se suman después del presupuesto.
 *   · Lo demás, también una DUDA («pensar», «consultar», «charlar», un «capturar» dudoso): ACTUAR en cobros y CRM, sin la duda.
 *     ⚠️ Respetar la duda (82ab77cd8) dejó al seguimiento de Leila sin foto («son 423, no 4235», capturar dudosa) en el camino
 *     barato SIN herramientas (la verificación de 4d1d0a010). La duda se saca porque el detector ya exige plata a la vista.
 *     Y ACTUAR trae lo de siempre (la verificación de bb41ede4a): `proponer_tareas_plan` (un borrador del plan, el bug del
 *     25/08), `confirmar_accion` y `cancelar_accion` (que actúa sin tarjeta). En una corrección no van (`sinEstas`).
 * `antes`: lo último de la charla, para el seguimiento que no nombra la plata (`corrigeUnMonto`).
 */
export function laCorreccion(v: VeredictoIntencion, texto: string, antes = ''): { veredicto: VeredictoIntencion; herramientas: readonly string[]; sinEstas: readonly string[] } {
  if (v.intencion === 'confirmar' || !corrigeUnMonto(texto, antes)) return { veredicto: v, herramientas: [], sinEstas: [] };
  const deAgenda = !!v.mover || (v.relevancia ?? '').includes(RELEVANCIA_AGENDA);
  if ((v.intencion === 'capturar' && !v.dudosa) || deAgenda) return { veredicto: v, herramientas: HERRAMIENTAS_CORRECCION, sinEstas: [] };
  const areas = [...new Set<Area>([...(v.areas ?? []), 'cobros', 'crm'])];
  const relevancia = [v.relevancia, 'editar venta cuota monto mensualidad cobranza'].filter(Boolean).join(' ');
  return {
    veredicto: { ...v, intencion: 'actuar', dudosa: false, areas, relevancia, porque: `corrige un monto (antes: ${v.porque})` },
    herramientas: HERRAMIENTAS_CORRECCION,
    sinEstas: FUERA_DE_LA_CORRECCION,
  };
}

/**
 * ¿La salida de una herramienta es una falla que el runner se TRAGÓ? (el error técnico entre paréntesis, `esFallaTragada` de
 * lib/no-pude-frases.ts: «❌ No se pudo aplicar (Error guardando …).», o un JSON con ese `error`). No trae isError, así que
 * `errorParaTicket` no la ve, y la guarda de otra herramienta del turno le comía el ticket (la verificación de 96e7840e8).
 */
export function esFallaTragadaDeHerramienta(out: unknown): boolean {
  if (!out) return false;
  const o = out as { isError?: unknown; content?: unknown };
  if (typeof out === 'object' && o.isError === true) return false;
  const t = (typeof out === 'string' ? out : typeof o.content === 'string' ? o.content : '').trim();
  if (esFallaTragada(t)) return true;
  try {
    const j = JSON.parse(t) as { error?: unknown };
    return !!j && typeof j.error === 'string' && esFallaTragada(j.error);
  } catch {
    return false;
  }
}

/**
 * ¿El «no pude» del turno es la REGLA de una guarda? (base 7: no abre ticket). Sólo si la ÚLTIMA herramienta que corrió devolvió
 * una guarda, y nada falló de verdad: ni un error (`errorParaTicket`) ni una falla tragada. Con «hubo alguna guarda» (96e7840e8),
 * «falta el monto» + un reintento que se tragó el error de la base dejaba la falla sin ticket, y una guarda vieja le comía el
 * ticket a un «no pude» de otra cosa.
 */
export function esLaReglaDeUnaGuarda(t: { ultimaFueGuarda: boolean; errores: number; tragadas: number }): boolean {
  return t.ultimaFueGuarda && t.errores === 0 && t.tragadas === 0;
}

/** Lo que ACTUAR trae de siempre y una corrección de monto no lleva: el plan y las que resuelven lo pendiente. */
export const FUERA_DE_LA_CORRECCION = ['proponer_tareas_plan', 'confirmar_accion', 'cancelar_accion'] as const;

const NOMBRE: Record<ProvSuClave, string> = { anthropic: 'tu Claude', openai: 'tu GPT', gemini: 'tu Gemini' };

/** Las claves del negocio que están FALLANDO ahora: su último fallo es más nuevo que su último «anduvo». */
export function clavesQueFallan(estados: readonly EstadoSuClave[] | null | undefined): EstadoSuClave[] {
  return (estados ?? []).filter((e) => e.fallo && (!e.anduvo || Date.parse(e.fallo.at) > Date.parse(e.anduvo)));
}

const hace = (iso: string, ahora: number): string => {
  const min = Math.max(1, Math.round((ahora - Date.parse(iso)) / 60_000));
  return min < 60 ? `hace ${min} min` : min < 48 * 60 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
};

/**
 * La nota del system para un turno que REPORTA una falla: el ticket (`TICKET_DE_LA_FALLA`) en vez de contestar como un manual,
 * y nombrar la causa si una IA del negocio está fallando. Sin `estados` (no se pudieron leer), no se afirma nada.
 */
export function bloqueDeLaFalla(estados: readonly EstadoSuClave[] | null | undefined, ahora: number, ticket: 'propone' | 'abre' = TICKET_DE_LA_FALLA): string {
  const fallan = clavesQueFallan(estados);
  const causa = fallan.length
    ? `\nLO QUE YA SABES: ${fallan.map((e) => `${NOMBRE[e.proveedor]} viene fallando (${hace(e.fallo!.at, ahora)}: «${e.fallo!.motivo}»)`).join('; ')}. Si lo que no anda depende de su IA, ÉSA es la causa: dila primero, con el link para arreglarla, y no inventes otra («puede deberse a la grabación»).`
    : '';
  const elTicket = ticket === 'abre'
    ? 'termina tu respuesta con una línea aparte, exactamente así: [[no-pude: lo que no anda, en una frase]]. El ticket lo abre el sistema solo y la línea con su número la escribe el código: no propongas un ticket, no pidas un «sí» y no digas que lo reportaste.'
    : 'propón levantar un ticket con levantar_ticket, con lo que pasó y cuántas veces lo intentó; queda propuesto hasta su «sí».';
  return `LA PERSONA TE CUENTA QUE ALGO NO ANDA. Si es una falla de MaKo (no de un lead ni de un tercero): no contestes como un manual de soporte. Di qué sabes de la causa, y ${elTicket}${causa}`;
}
