// =============================================================================
// Qué herramientas viajan en un turno del doer de WhatsApp.
//
// Vivía adentro de lib/mako-doer-in.ts, que tiene `server-only`, así que el test de la
// agenda armaba el turno POR SU CUENTA: fijaba `incluirAcciones: true` y se salteaba el
// clasificador y el filtro de «en una pregunta MaKo ofrece». Daba verde mientras 3 de sus
// 5 frases de escritura llegaban al turno real SIN la herramienta (medido el 08/10/2026,
// con el pedido de un cliente: «Mako, agenda me una reunión mañana 12hs…» → `capturar`,
// dos herramientas, y MaKo contestó «por aquí no puedo agendarte»).
//
// Ahora el doer y el test llaman a la misma función: un test que arma el turno a mano
// prueba otra cosa que lo que corre.
//
// SIN `server-only`: lo importan el doer y tests/agenda-whatsapp.test.ts.
// =============================================================================

import { CONTRATO, areasDelMensaje, sinPrefijoDeLote, esMoverSinObjeto, type Intencion, type VeredictoIntencion } from './mako-intencion';
import { toolsDelRegistro, porId, type Vista } from './api-mako/registro';
import type { ToolDef } from './anthropic';
import type { Area } from './api-mako/tipos';

/** Las de Calendly. A un negocio sin Calendly no le sirven, y su receta («buscá el lead,
 *  pedile el email, ofrecé 3 huecos») le gana a la de Google: con un evento sin lead,
 *  empujaba a pedir un lead y un email que nadie nombró. */
export const DE_CALENDLY: readonly string[] = ['listar_horarios_reunion', 'proponer_agendar_reunion', 'link_agenda_calendly'];

/** Lo que el doer le pasa al presupuesto del registro (los mismos números de siempre). */
export const PRESUPUESTO_REGISTRO_CHARS = 12_000;

/**
 * ¿Esta herramienta ESCRIBE? Lo dice el registro (lib/api-mako): las 25 viejas tienen ahí
 * su gemela con el mismo id (medido el 08/10: 25 de 25). Sin def no se sabe, y se deja:
 * sacar una lectura deja a MaKo sin poder contestar, y una escritura en una pregunta sólo
 * puede PROPONER, nunca ejecutar.
 */
export function escribe(nombre: string): boolean {
  const d = porId(nombre);
  return !!d && d.tipo !== 'lectura';
}

/**
 * Qué tools ve el modelo en este turno. LO DECIDE LA INTENCIÓN, no el tier.
 *
 * Antes lo decidía el `motivo` del router, que contesta otra pregunta (cuánto
 * gastar). El resultado: todo lo que no caía en `(plan)` o `(confirmación)`
 * recibía las veinte tools y ninguna obligación — y el mismo mensaje terminaba
 * en un borrador o en un ensayo según el día. Ver lib/mako-intencion.ts.
 */
export function toolsParaIntencion<T extends { name: string }>(intencion: Intencion, todas: T[], dudosa = false): T[] {
  const permitidas = CONTRATO[intencion].tools;
  const base = permitidas === null ? todas : todas.filter((t) => permitidas.includes(t.name));

  // ⚠️ UNA ADIVINANZA NO PUEDE CREAR NADA. `dudosa: true` significa, textual, «sin
  // señal clara», y el default de ese caso es `capturar` — o sea que un mensaje que
  // NO se pudo clasificar llegaba con `proponer_tareas_plan` sobre la mesa.
  //
  // EL CASO (2026-08-25). El cliente escribió tres cosas conversacionales —«ahí
  // hice la prueba», «hay un problema chiquito, que cuando le das a prueba del
  // pixel no se abre la landing», «probá de vuelta, ya agregué otra api key»— y
  // recibió tres «Listo, te armé el borrador» con un link a revisar un plan que
  // nunca pidió. El dueño: «¿qué sentido tiene?».
  //
  // Sacarle la tool NO pierde el material: el mensaje sigue en la conversación y
  // el preámbulo le pide a MaKo que OFREZCA anotarlo. Es la diferencia entre
  // preguntar y hacer, que es toda la doctrina de la casa: «un canal PROPONE, una
  // persona confirma». Crear un borrador que nadie pidió es hacer.
  //
  // ⛔ Y no se toca el default del clasificador: ante la duda, seguir capturando es
  // correcto para el dueño volcando ideas. Lo que se corrige es que la duda no
  // EJECUTE.
  if (!dudosa) return base;
  return base.filter((t) => t.name !== 'proponer_tareas_plan');
}

export type EntradaTurno<T extends { name: string }> = {
  veredicto: VeredictoIntencion;
  /** Lo que escribió la persona en ESTE turno. */
  texto: string;
  /**
   * Cuando el turno es un «sí» a lo que MaKo ofreció: el ofrecimiento y el último pedido
   * de la persona. «sí, dale» no nombra ningún área, y el presupuesto de 12.000 caracteres
   * ordena por relevancia CONTRA EL TEXTO: con «sí, dale» la acción ofrecida quedaba afuera
   * (medido el 08/10: entraban 20 lecturas y ninguna escritura de agenda).
   */
  contextoDelSi?: string | null;
  /** Hay un pedido de agenda abierto (el código le acaba de mostrar opciones). */
  agendaAbierta: boolean;
  /** Las de siempre (lib/mako-tools.ts + lib/mako-doer-acciones.ts). */
  deSiempre: T[];
  vista: Vista;
  hayPendientes: boolean;
  /** Los resúmenes de las pendientes vigentes: «no, mejor a las 13» corrige UNA de ellas. */
  resumenesPendientes?: readonly string[];
  /** El negocio no tiene Calendly: sus herramientas no viajan. */
  sinCalendly?: boolean;
};

/** Lo que pregunta MaKo cuando le piden mover algo sin decir qué. Es lo único que ve la
 *  persona: corto, y sin nada de su agenda (la agenda no pasa por la IA, lib/agenda-sin-ia.ts). */
export const PREGUNTA_REUNION_O_TAREA = '¿La reunión o la tarea?';

/**
 * La instrucción de un «movela al viernes» sin pendiente ni agenda abierta (decisión de Martín
 * del 09/10/2026). Viaja con el VEREDICTO y no como receta de una herramienta: las dos que
 * entran (mover una reunión, cambiarle la fecha a una tarea) viajan también en pedidos que
 * sí dicen qué mover, y ahí preguntar sería fricción. Preguntar antes de leer nada: la
 * respuesta («la reunión», «la tarea») ya llega con lo suyo (lib/mako-intencion.ts, 3-ter-bis).
 */
const INSTRUCCION_MOVER_SIN_OBJETO = `TE PIDEN MOVER ALGO A OTRO DÍA U HORA SIN DECIR QUÉ: puede ser una reunión de su agenda o una tarea del plan. Si la conversación no deja claro cuál es, pregunta UNA sola vez, en una línea y antes de llamar ninguna herramienta: «${PREGUNTA_REUNION_O_TAREA}». Si queda claro, sigue con eso sin preguntar.`;

export type Turno<T> = {
  tools: Array<T | ToolDef>; delRegistro: ToolDef[]; areas: Area[]; ofrece: boolean;
  /** Una línea más para el system de ESTE turno, o null. Hoy, sólo la de mover sin objeto. */
  instruccion: string | null;
};

/** Las herramientas de ESTE turno. */
export function herramientasDelTurno<T extends { name: string }>(p: EntradaTurno<T>): Turno<T> {
  const v = p.veredicto;
  // Lo que escribió la persona: el encabezado de un lote es nuestro y no puede puntuar.
  const propio = sinPrefijoDeLote(p.texto);
  const sobre = v.sigueOfrecimiento && p.contextoDelSi ? `${p.contextoDelSi}\n${propio}` : propio;
  const areasDelTexto = CONTRATO[v.intencion].tools === null && !v.dudosa ? areasDelMensaje(sobre) : [];
  const areas = [...new Set<Area>([
    ...areasDelTexto,
    // El clasificador ya sabe de qué habla un pedido de agenda (lib/mako-intencion.ts).
    ...(CONTRATO[v.intencion].tools === null && !v.dudosa ? v.areas ?? [] : []),
    // Con un pedido de agenda abierto, «la de las 16» no nombra ningún área: el CRM va igual.
    ...(p.agendaAbierta && v.intencion === 'actuar' ? (['crm'] as Area[]) : []),
  ])];
  const relevanteA = [sobre, v.relevancia ?? '', ...(p.resumenesPendientes ?? [])].filter(Boolean).join('\n');
  const deSiempre = p.sinCalendly ? p.deSiempre.filter((t) => !DE_CALENDLY.includes(t.name)) : p.deSiempre;
  const delRegistro = areas.length
    ? toolsDelRegistro({
        vista: p.vista, areas, incluirAcciones: v.intencion === 'actuar',
        excluir: new Set([...p.deSiempre.map((t) => t.name), ...(p.sinCalendly ? DE_CALENDLY : [])]),
        maxChars: PRESUPUESTO_REGISTRO_CHARS, relevanteA,
      })
    : [];
  /**
   * ⚠️ EN UNA PREGUNTA NO VIAJAN LAS HERRAMIENTAS QUE ESCRIBEN: MaKo OFRECE la acción.
   *
   * Decisión de Martín del 08/10/2026 («la ofrece»). Las 7 `proponer_*` viejas más
   * confirmar/cancelar viajaban en consultar y pensar —10.380 caracteres de esquema en CADA
   * pedido del turno, que el loop re-manda entero— mientras el registro ya mandaba sus
   * acciones sólo en `actuar`. El «sí» al ofrecimiento llega como `actuar`, con todo. Si hay
   * algo pendiente de confirmar, confirmar/cancelar quedan (la persona puede contestarlo).
   */
  const ofrece = v.intencion === 'consultar' || v.intencion === 'pensar';
  const tools = toolsParaIntencion<T | ToolDef>(v.intencion, [...deSiempre, ...delRegistro], v.dudosa)
    .filter((t) => !ofrece || !escribe(t.name) || (p.hayPendientes && (t.name === 'confirmar_accion' || t.name === 'cancelar_accion')));
  // La agenda Y el plan viajan sólo cuando el clasificador no supo cuál de los dos: con una
  // propuesta de agenda abierta el veredicto trae sólo el CRM, y no hay nada que preguntar.
  const preguntaQue = v.intencion === 'actuar' && !v.sigueOfrecimiento && (v.areas ?? []).includes('plan')
    && (v.areas ?? []).includes('crm') && esMoverSinObjeto(p.texto);
  return { tools, delRegistro, areas, ofrece, instruccion: preguntaQue ? INSTRUCCION_MOVER_SIN_OBJETO : null };
}
