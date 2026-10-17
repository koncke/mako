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

import { CONTRATO, areasDelMensaje, sinPrefijoDeLote, type Intencion, type VeredictoIntencion } from './mako-intencion';
import { toolsDelRegistro, porId, leeDatosDeClientes, type Vista } from './api-mako/registro';
import type { ToolDef } from './anthropic';
import type { Area } from './api-mako/tipos';

/** Las de Calendly. A un negocio sin Calendly no le sirven, y su receta («buscá el lead,
 *  pedile el email, ofrecé 3 huecos») le gana a la de Google: con un evento sin lead,
 *  empujaba a pedir un lead y un email que nadie nombró. */
export const DE_CALENDLY: readonly string[] = ['listar_horarios_reunion', 'proponer_agendar_reunion', 'link_agenda_calendly'];

/**
 * Lo que NO sirve para mover algo a otro DÍA y por eso no viaja cuando el veredicto es mover (`v.mover`).
 * `mover_tarea_plan` (el kanban del Plan, 16/10/2026) cambia la COLUMNA de una tarea, nunca su fecha, y su id —«mover
 * tarea plan»— es justo la relevancia de un «movela al viernes» (`RELEVANCIA_MOVER`): entraba primera al presupuesto
 * y dejaba afuera a `listar_tareas_plan`, la que el turno necesita para encontrar la tarea. El diagnóstico obvio
 * («las 34 acciones del Video Editor») era el equivocado: en ese turno no viaja ninguna de video.
 */
export const NO_MUEVEN_DE_DIA: readonly string[] = ['mover_tarea_plan'];

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

/** ¿Esta herramienta, o esta pendiente por su `tipo`, lleva datos de los clientes del negocio? Lo dice el registro
 *  (`leeDatosDeClientes`), nunca una lista de nombres. Lo que el registro no conoce cuenta como que sí: no saber no es
 *  poder. El `tipo` de una pendiente resuelve igual que un id (el id o el slug viejo, `lead_etapa`). */
export function llevaDatosDeClientes(nombre: string): boolean {
  const d = porId(nombre);
  return !d || leeDatosDeClientes(d);
}

/** La línea del system cuando la red corre sin las herramientas que leen datos de clientes: el modelo no las tiene, y
 *  sin esto contesta como si hubiera mirado (o deduce de la conversación). */
export const SIN_DATOS_DE_CLIENTES = 'EN ESTE TURNO NO PUEDES LEER LEADS, CONVERSACIONES, LLAMADAS NI COBROS: el negocio no tiene una IA propia que conteste, y esos datos no van a la de MaKo. Si lo que te piden los necesita, dilo en una línea y nada más; no los deduzcas de la conversación.';

/** Lo que la red gratis hace con un turno: cortarlo (y por qué) o correrlo con estas herramientas. */
export type TurnoDeLaRed<T> =
  | { cortar: string[] }
  | { cortar: null; tools: T[]; sacadas: string[] };

/**
 * ⛔ EL TURNO QUE PUEDE IR A LA RED GRATIS DE LA PLATAFORMA (17/10/2026).
 *
 * Las keys gratis de la agencia son el plan gratis de Gemini y de Groq, que entrena con lo que recibe, y los datos de
 * los clientes de un cliente nunca van ahí (AGENTS.md, 16/10/2026). La cascada tiene su corte; el bucle propio del doer
 * sobre `provsGratisDePlataforma` (lib/mako-doer-in.ts, «LA RED DE PLATAFORMA») no lo heredaba, y era el agujero más
 * grande: con las keys de un negocio caídas, la conversación sobre sus leads iba a la key gratis de la agencia.
 *
 * POR TURNO y no por negocio. ⚠️ El diagnóstico obvio —«si viaja una herramienta que lee leads, se corta»— cortaba casi
 * todo: las de siempre traen `buscar_leads` y `ficha_lead` en CUALQUIER consulta, y «hola MaKo, ¿cómo estás?» se
 * clasifica `consultar` (medido el 17/10). Sin keys propias, MaKo contestaba «esto lleva datos de tus clientes» a un
 * saludo. Así que:
 *   - se CORTA si hay una pendiente vigente con datos de clientes (su resumen va en el system y `confirmar_accion`
 *     devuelve lo que hizo), o si lo que la persona PIDIÓ es de clientes: el registro sumó herramientas por las áreas
 *     que nombró y TODAS los leen («¿qué leads entraron hoy?», «agéndame una reunión con Juan»);
 *   - si no, corre SIN las herramientas que los leen (`sacadas`), y el system se arma con las que quedan.
 */
export function turnoParaLaRed<T extends { name: string }>(p: {
  tools: readonly T[];
  /** Lo que el registro sumó por las áreas que nombró la persona (`Turno.delRegistro`). */
  delRegistro: readonly { name: string }[];
  /** Los `tipo` de las pendientes vigentes que ve el turno. */
  tiposPendientes: readonly string[];
}): TurnoDeLaRed<T> {
  const pendientes = p.tiposPendientes.filter(llevaDatosDeClientes);
  if (pendientes.length) return { cortar: pendientes.map((t) => `pendiente ${t}`) };
  if (p.delRegistro.length && p.delRegistro.every((t) => llevaDatosDeClientes(t.name))) {
    return { cortar: p.delRegistro.map((t) => t.name) };
  }
  const tools = p.tools.filter((t) => !llevaDatosDeClientes(t.name));
  const sacadas = p.tools.filter((t) => llevaDatosDeClientes(t.name)).map((t) => t.name);
  // Un turno que traía herramientas y se queda sin ninguna no tiene con qué hacer lo que se le pidió.
  if (p.tools.length && !tools.length) return { cortar: sacadas };
  return { cortar: null, tools, sacadas };
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
 * ¿El último mensaje de MaKo hizo ESA pregunta? Es lo único que convierte «la reunión» o «la
 * tarea» en la respuesta (lib/mako-intencion.ts, 3-ter-bis). ⚠️ No alcanza con «MaKo preguntó
 * algo» (`makoPreguntoAlgo`): con eso, después de CUALQUIER «¿…?» —«¿Quieres el detalle?»—,
 * «la agenda de mañana?» dejaba de ser una consulta y llegaba como acción, con las herramientas
 * que escriben (medido por el revisor el 09/10/2026). Mira la ÚLTIMA pregunta del final y
 * acepta que el modelo la diga con sus palabras («¿Te refieres a la reunión o a la tarea?»):
 * las dos palabras en la misma pregunta.
 */
export function preguntoReunionOTarea(ultimoDeMako: string | null | undefined): boolean {
  const preguntas = (ultimoDeMako ?? '').slice(-280).match(/[^?.!\n]*\?/g);
  const ultima = preguntas?.[preguntas.length - 1] ?? '';
  return /reuni[oó]n/i.test(ultima) && /\btarea/i.test(ultima);
}

/**
 * La herramienta que le cambia la fecha a una tarea. ⚠️ Al 09/10/2026 NO viaja por WhatsApp: en
 * main no existe, y en la rama que la trae (wip/api-acciones-0910) es `canales: HTTP`. O sea que
 * «la tarea» no tiene con qué moverse por aquí, y sin decírselo el modelo improvisa (la única
 * escritura del plan que viaja es `proponer_tareas_plan`, que CREA una tarea).
 */
const CAMBIA_FECHA_DE_TAREA = 'cambiar_fecha_tarea_plan';
export const SIN_FECHA_DE_TAREA = 'Si es una tarea: en este turno no tienes con qué cambiarle la fecha. Dilo en una línea (se cambia desde el plan) y no la cargues como tarea nueva.';

/**
 * La instrucción de un «movela al viernes» sin pendiente ni agenda abierta (decisión de Martín
 * del 09/10/2026). Viaja con el VEREDICTO y no como receta de una herramienta: las dos que
 * entran (mover una reunión, cambiarle la fecha a una tarea) viajan también en pedidos que
 * sí dicen qué mover, y ahí preguntar sería fricción. Preguntar antes de leer nada: la
 * respuesta («la reunión», «la tarea») ya llega con lo suyo (lib/mako-intencion.ts, 3-ter-bis),
 * siempre que MaKo la haya preguntado con esas dos palabras (`preguntoReunionOTarea`).
 */
const INSTRUCCION_MOVER_SIN_OBJETO = `TE PIDEN MOVER ALGO A OTRO DÍA U HORA SIN DECIR QUÉ: puede ser una reunión de su agenda o una tarea del plan. Si la conversación no deja claro cuál es, pregunta UNA sola vez, en una línea y antes de llamar ninguna herramienta: «${PREGUNTA_REUNION_O_TAREA}». Si queda claro, sigue con eso sin preguntar.`;

export type Turno<T> = {
  tools: Array<T | ToolDef>; delRegistro: ToolDef[]; areas: Area[]; ofrece: boolean;
  /** Una línea más para el system de ESTE turno, o null. Hoy, sólo la de mover sin decir qué
   *  y la de «la tarea» cuando no viaja con qué cambiarle la fecha. */
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
        excluir: new Set([...p.deSiempre.map((t) => t.name), ...(p.sinCalendly ? DE_CALENDLY : []), ...(v.mover ? NO_MUEVEN_DE_DIA : [])]),
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
  // Lo dice el VEREDICTO, no el texto leído otra vez: con una propuesta de agenda abierta el
  // clasificador ya decidió que es la reunión y no marca nada. Re-leer el texto acá tenía su
  // propio preludio, y «buen día, movela al viernes» llegaba con la agenda y el plan y SIN la
  // pregunta (el saludo lo pela el clasificador; el preludio del CRM no conoce «buen día»).
  const sinFecha = tools.some((t) => t.name === CAMBIA_FECHA_DE_TAREA) ? null : SIN_FECHA_DE_TAREA;
  const instruccion = v.intencion !== 'actuar' ? null
    : v.mover === 'sin-decir-que' ? [INSTRUCCION_MOVER_SIN_OBJETO, sinFecha].filter(Boolean).join(' ')
    : v.mover === 'tarea' ? sinFecha
    : null;
  return { tools, delRegistro, areas, ofrece, instruccion };
}
