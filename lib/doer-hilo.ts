// =============================================================================
// doer-hilo — que MaKo en WhatsApp siga la conversación: el seguimiento y lo que ya se habló (26/10/2026)
// =============================================================================
// Martín, 26/10/2026: «MaKo en WhatsApp (que no funciona muy bien, no guarda contexto)». El Cerebro: «que recuerde la
// conversación y lo que sabe del negocio, como cuando le hablás a Claude».
//
// ⚠️ EL DIAGNÓSTICO OBVIO —«que lea más historial»— ERA EL EQUIVOCADO (docs/hallazgos-comunicacion.md, 16/10). El modelo
// YA ve los 12 turnos de las últimas 14 horas. Lo que no seguía la charla era EL TURNO: la intención y las herramientas se
// decidían SÓLO con el último mensaje (`clasificarIntencion` + `herramientasDelTurno`). Medido con el clasificador real
// (tests/doer-hilo.test.ts): «pausala igual, que ya llenamos el cupo» después de «¿cómo va la campaña del webinar?», «publicá
// la del webinar» después de «¿qué landings tengo?», «mandales un mensaje a esos 5» después de los leads de la semana… caen
// en «capturar (dudosa): sin señal clara», con 2 herramientas. MaKo no puede pausar, publicar ni escribir: lo anota como
// idea o pregunta de qué se habla, y se lee como que perdió el hilo. Cada forma se había parchado de a una
// (`sigueOfrecimiento`: el «sí»; `pedidoPrometido`: «Pasamelo»; `siguePedidoDeAgenda`: el nombre y la dirección que MaKo
// pidió); éste es el arreglo de la red: un seguimiento SIGUE EL PEDIDO del hilo.
//
// Y lo de más atrás de la ventana (14 h, 12 turnos) volvía como NADA: «Mago, probá de vuelta agendarle a Pablo lo que te
// pidió» (ws18, 17/10) pedía algo de 15 horas antes. Vuelve como HECHOS, no como turnos (`bloqueYaSeHablo`): lo que se
// pidió y lo que MaKo propuso o hizo, con su fecha, marcado como fondo (un «sí» de ahora no lo confirma: el bug del 26/07).
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-hilo.test.ts.
// =============================================================================

import { areasDelMensaje, clasificarIntencion, makoPidioDatos, makoPreguntoAlgo, sinPrefijoDeLote, type VeredictoIntencion } from './mako-intencion';
import { esAcusePuro } from './doer-para-quien';
import type { Area } from './api-mako/tipos';

/**
 * ¿Pregunta por algo que se dijo antes en el grupo? (ticket #40, Leila, 3/11/2026). La memoria del turno son 12 turnos de 14 h y
 * hechos de 7 días; lo de antes, si no se busca, no existe. Trae `buscar_en_el_grupo`. Sobre el texto de la persona.
 */
export function pideBuscarEnElGrupo(texto: string): boolean {
  const n = (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\bmensajes? anteriores?\b|\bmensajes? (?:viejos?|pasados?|de hace|de la semana|del mes)\b|\b(?:busca\w*|encontra\w*|encuentra\w*) (?:en (?:el|este) (?:grupo|chat|hilo)|el mensaje|lo que)\b|\b(?:historial|conversacion(?:es)?) (?:de|del) (?:este |el )?grupo\b|\bque (?:te )?(?:dije|dijimos|hablamos|quedamos|conversamos|pedi|mande|escribi|pregunte)\b|\b(?:me|nos) (?:dijiste|escribiste|mandaste|pasaste|contestaste)\b|\bte (?:dije|escribi|mande|pase|pregunte|pedi)\b[^.\n?]{0,40}\b(?:antes|ayer|pasad[oa]|hace)\b/.test(n);
}

/** Las palabras por las que se busca en el hilo (hasta 4, de 3 letras o más), con lo que el ILIKE lee como comodín ya escapado. */
export function palabrasDeBusqueda(texto: string): string[] {
  return (texto || '').split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}@.+-]/gu, '')).filter((p) => p.length >= 3).slice(0, 4);
}

/** Un turno del historial del grupo (lib/mako-doer-conv.ts). */
export type TurnoDelHilo = { role: 'user' | 'assistant'; content: unknown };

/** Hasta cuánto un mensaje es un SEGUIMIENTO. Uno más largo es un pedido o un volcado nuevo: se lee solo. */
export const LARGO_SEGUIMIENTO = 180;

/**
 * Un verbo con pronombre pegado («pausala», «mandales», «cambiale», «pasale», «hacelo»), que apunta a algo ya nombrado.
 * Las raíces van escritas: una regla de «termina en -la» se quedaba con «hola», «escuela» y «solo».
 */
const VERBO_CON_PRONOMBRE = /\b(?:paus|public|mand|cambi|pas|borr|sub|baj|pon|hac|agreg|muev|mov|cancel|archiv|duplic|envi|respond|contest|agend|reagend|activ|desactiv|prend|apag|renombr|edit|corrig|correg|arregl|elimin|quit|sac|copi|guard|program|reprogram|asign|marc|cerr|abr|mostr|muestr|dej|llam|escrib|reenvi|recuerd|record|avis|carg|actualiz|termin|complet|fij|resum|analiz|revis|mir|busc|despublic|repet|repit)[a-záéíóúñ]{0,4}(?:la|lo|le|las|los|les|me|nos|selo|sela|selos|selas|melo|mela)\b/i;

/** Una referencia a algo de la charla: «la segunda», «la del webinar», «esa», «esos 5», «también», «de vuelta». */
// «¿cuáles son?», «¿quiénes?», «sus nombres» (27/10/2026, Código Inmobiliario): piden el detalle detrás del número de recién.
const REFERENCIA = /\b(?:(?:la|el|las|los|lo)\s+(?:primer[ao]?s?|segund[ao]s?|tercer[ao]?s?|cuart[ao]s?|[uú]ltim[ao]s?|otr[ao]s?|de|del|que|mism[ao]s?)|es[aeo]s?|aquel(?:la|lo)?s?|tambi[eé]n|de vuelta|otra vez|lo mismo|(?:los|sus)\s+nombres|cu[aá]les(?:\s+son)?|qui[eé]nes(?:\s+son)?)(?![\p{L}])/iu;

/** Una muletilla no es una respuesta: «mmm», «eh», «bueno», «ok» después de «¿Quieres que la pause?» no la pausan. */
const MULETILLA = /^(?:m+|e+h*|a+h*|uh+|hmm+|bueno+|ok+|okey|ya|aj[aá]|ahí va|ah[ií] va)[\s.!…,]*$/i;

/** Lo que MaKo mostró en su última respuesta cuenta para el hilo: «la segunda» es de SU lista («Hoy Pablo tiene 3 tareas: …»). */
export const LARGO_DE_MAKO_EN_EL_HILO = 400;

/**
 * De qué habla lo que contestó MaKo: las áreas de su PRIMERA frase que nombra alguna. Una respuesta nombra de paso otras cosas
 * («3 tareas: llamar a Nancy, mandar el presupuesto, revisar la landing»): el tema es lo primero, no todo lo que aparece.
 */
export function areasDeLaRespuesta(respuesta: string | null | undefined): string[] {
  for (const frase of (respuesta ?? '').slice(0, LARGO_DE_MAKO_EN_EL_HILO).split(/[.:;!?\n]+/)) {
    const a = areasDelMensaje(frase);
    if (a.length) return a;
  }
  return [];
}

/**
 * Un seguimiento que nombra un día o una hora («pasale la segunda para mañana», «la de Ana al jueves a las 12») pide moverla:
 * suma estas palabras a la relevancia, que es lo que ordena el presupuesto de herramientas (sin ellas, «pasale» no comparte
 * ninguna raíz con `cambiar_fecha_tarea_plan` y quedaba afuera).
 */
const DIA_U_HORA = /\b(?:hoy|mañana|manana|pasado mañana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|semana que viene|pr[oó]xima semana|a las \d|\d{1,2}[:/]\d{2})/i;
export const RELEVANCIA_FECHA = 'cambiar fecha mover dia reprogramar reagendar';

/** ¿El mensaje apunta a algo ya hablado? */
export function refiereAlHilo(texto: string): boolean {
  const t = sinPrefijoDeLote(texto || '');
  return VERBO_CON_PRONOMBRE.test(t) || REFERENCIA.test(t);
}

const texto = (c: unknown): string => (typeof c === 'string' ? c : '');

/** El pedido que un seguimiento continúa: su texto, cómo se leyó y de qué áreas habla. */
export type PedidoDelHilo = { texto: string; veredicto: VeredictoIntencion; areas: string[] };

/**
 * El pedido VIVO del hilo: el más reciente de los tres últimos de la persona que se leyó como un pedido de verdad (no
 * dudoso: actuar, consultar o pensar), y sólo si MaKo ya contestó (el último turno es suyo). Sin eso no hay hilo que seguir:
 * dos mensajes seguidos de la persona son un lote, y uno después de un silencio de MaKo no sigue nada.
 */
export function pedidoDelHilo(historial: readonly TurnoDelHilo[], clasificar: (t: string) => VeredictoIntencion = (t) => clasificarIntencion(t)): PedidoDelHilo | null {
  if (!historial.length || historial[historial.length - 1].role !== 'assistant') return null;
  const suyos = historial.filter((t) => t.role === 'user').map((t) => texto(t.content)).filter(Boolean).slice(-3).reverse();
  for (const t of suyos) {
    const v = clasificar(t);
    if (v.dudosa || !['actuar', 'consultar', 'pensar'].includes(v.intencion)) continue;
    return { texto: t, veredicto: v, areas: [...new Set([...areasDelMensaje(t), ...(v.areas ?? [])])] };
  }
  return null;
}

/**
 * EL TURNO CON EL HILO: cómo se lee el mensaje sabiendo de qué se venía hablando. Devuelve el veredicto que corre y el texto
 * del pedido para elegir herramientas (`hilo`, lib/doer-herramientas.ts); sin hilo que seguir, el veredicto queda como vino.
 *
 *   1. El cajón de «sin señal clara» (`capturar` dudoso) con un seguimiento corto —apunta a lo hablado, o contesta una
 *      pregunta o un pedido de datos de MaKo— SIGUE el pedido: se actúa (o se consulta, si es una pregunta sobre una
 *      consulta) con las áreas del pedido. Lo NUEVO que se haga pasa por el «sí» (las acciones de WhatsApp proponen); lo que
 *      YA está pendiente no se toca (`noResuelvePendientes`): sin `confirmar_accion` ni `cancelar_accion`. ⚠️ La revisión
 *      del 26/10/2026: con la #400 «Eliminar la etapa Seguimiento» pendiente y MaKo preguntando «¿Confirmás?», «esperá,
 *      primero movamos esos leads» llegaba con `confirmar_accion`, y una mala lectura del modelo la ejecutaba (irreversible,
 *      y `confirmacionPura` sólo frena lo que va a terceros o mueve plata).
 *      Un «bueno», «mmm» o «mañana tengo que llamar al contador» sin MaKo preguntando nada queda como estaba: una idea.
 *   2. Un pedido corto que apunta a lo hablado pero no nombra el área del pedido («ya lo conecté, analizá la última»
 *      después de «¿estás analizando mis fathom?») suma las áreas del pedido a las suyas.
 */
/** Las áreas de un mensaje del grupo sin señal clara: MaKo (lo que hace, y los tickets del negocio) y las lecturas del CRM. */
export const AREAS_SIN_SENAL: readonly Area[] = ['mako', 'crm'];
/** Lo que suma relevancia en ese turno, para que entren el catálogo de MaKo y los tickets antes que otra lectura. */
const RELEVANCIA_SIN_SENAL = 'qué hace MaKo capacidades funciones ticket pedido reporte soporte lead';

/**
 * ⚠️ EL DEFAULT DEL GRUPO NO ES CAPTURAR (28/10/2026, la crítica del diagnóstico del Cerebro, G1: la causa más grande).
 *
 * Lo que ningún clasificador reconocía caía en `capturar` dudosa, y llegaba con SÓLO `ver_plan` y `listar_pendientes`: el
 * 35 % de los turnos del 23 al 28/10. Ahí estaban el pedido de Leandro («Tal cual como lo hace manychat»), todo el soporte de
 * Leila («Fabi Pedraza no aparece en el SRM», «y tú eres el servicio técnico»), «Ya conteste» y los saludos: sin herramientas
 * de CRM ni de tickets, el modelo no podía mirar ni reportar nada, y contestaba con el plan («No hay tareas abiertas en el
 * plan» a un «bien»). La app lo arregló el 20/10 (lib/mako-intencion.ts, el canal app); el grupo no.
 *
 * Va DESPUÉS de `conElHilo`, que usa esa misma duda para seguir el pedido vivo («pausala» sigue lo que MaKo acaba de contestar):
 *   · un acuse o un saludo («Bien», «Buendiaa», «Okk perfe») es charla (si nada espera respuesta, ni llega: lleva el 👍);
 *   · lo demás es una CONSULTA con las áreas del hilo, MaKo (lo que hace y los tickets del negocio) y las lecturas del CRM.
 * Nunca el Plan por default.
 */
export function enElGrupoSinSenal(v: VeredictoIntencion, mensaje: string, areasDelHilo: readonly string[] = []): VeredictoIntencion {
  if (!v.sinSenal) return v;
  const propio = sinPrefijoDeLote(mensaje || '').trim();
  if (esAcusePuro(propio)) return { intencion: 'charlar', dudosa: false, porque: 'grupo: acuse o saludo' };
  return {
    intencion: 'consultar', dudosa: false, porque: 'grupo: sin señal clara; consulta (MaKo, sus pedidos y el CRM)',
    // Las del hilo salen de `areasDelMensaje` (`PedidoDelHilo.areas`), como en `conElHilo`.
    areas: [...new Set<Area>([...(areasDelHilo as readonly Area[]), ...AREAS_SIN_SENAL])], relevancia: RELEVANCIA_SIN_SENAL,
  };
}

export function conElHilo(
  v: VeredictoIntencion, mensaje: string, pedido: PedidoDelHilo | null, ultimoDeMako: string | null,
): { veredicto: VeredictoIntencion; hilo: string | null } {
  const propio = sinPrefijoDeLote(mensaje || '').trim();
  if (!pedido || !propio || propio.length > LARGO_SEGUIMIENTO) return { veredicto: v, hilo: null };
  const apunta = refiereAlHilo(propio);
  const leContesta = !MULETILLA.test(propio) && (makoPreguntoAlgo(ultimoDeMako) || makoPidioDatos(ultimoDeMako));
  const corto = `«${pedido.texto.replace(/\s+/g, ' ').slice(0, 50)}»`;
  // El hilo que elige herramientas es el PEDIDO (`hilo`, lib/doer-herramientas.ts lee sus áreas y su relevancia). De lo que
  // contestó MaKo cuenta el tema, y sólo si el pedido no nombró ninguna área («¿qué tiene que hacer Pablo hoy?» → «Hoy tiene 3
  // tareas»): sumar todo lo que su respuesta nombra de paso («revisar la landing», «9 leads») corría el presupuesto y dejaba
  // afuera la herramienta del pedido (medido: `publicar_landing` y `cambiar_fecha_tarea_plan` quedaban afuera).
  const hilo = pedido.texto;
  const areasDelHilo = pedido.areas.length ? pedido.areas : areasDeLaRespuesta(ultimoDeMako);
  if (v.intencion === 'capturar' && v.dudosa && (apunta || leContesta)) {
    const pregunta = /\?\s*$/.test(propio);
    return {
      veredicto: {
        intencion: pregunta && pedido.veredicto.intencion !== 'actuar' ? 'consultar' : 'actuar',
        dudosa: false,
        porque: `sigue el hilo de ${corto}`,
        areas: areasDelHilo as VeredictoIntencion['areas'],
        relevancia: [pedido.veredicto.relevancia, v.relevancia, DIA_U_HORA.test(propio) ? RELEVANCIA_FECHA : ''].filter(Boolean).join(' ') || undefined,
        sigueElHilo: true,
        // Siempre: un «sí» o un «no» de verdad nunca llega acá (la regla 1 del clasificador los lee como 'confirmar', con
        // confirmar y cancelar). Lo fija tests/doer-hilo.test.ts 3-bis.
        noResuelvePendientes: true,
      },
      hilo,
    };
  }
  const propias = new Set<string>([...areasDelMensaje(propio), ...(v.areas ?? [])]);
  if (apunta && !v.dudosa && ['actuar', 'consultar', 'pensar'].includes(v.intencion) && areasDelHilo.some((a) => !propias.has(a))) {
    return {
      veredicto: { ...v, areas: [...new Set([...(v.areas ?? []), ...areasDelHilo])] as VeredictoIntencion['areas'], porque: `${v.porque} · sigue el hilo de ${corto}`, sigueElHilo: true },
      hilo,
    };
  }
  return { veredicto: v, hilo: null };
}

// ── LO QUE YA SE HABLÓ (más atrás de la ventana) ────────────────────────────────────────────────────────────────────

/** Una fila vieja de la memoria del grupo, con su fecha. */
export type FilaDelHilo = { role: 'user' | 'assistant'; content: string; created_at: string };
/** Una acción que MaKo propuso en el grupo (lib/mako-pendientes.ts), ya resuelta. */
export type AccionDelHilo = { id: number; resumen: string; estado: string; resultado?: string | null; created_at: string };

/**
 * Parte la memoria de un grupo (las filas de lo más NUEVO a lo más viejo, como las trae la base): la charla reciente como
 * turnos —los primeros `turnos` que caen en las últimas `horas`, sin saltear ninguno— y todo lo demás como «antes», en orden
 * cronológico. Lo de antes nunca vuelve como turno (el «sí, cargalo» del 26/07): vuelve como hechos (`bloqueYaSeHablo`).
 */
export function partirMemoria(
  filasNuevasPrimero: readonly FilaDelHilo[], ahoraMs: number, { turnos = 12, horas = 14 }: { turnos?: number; horas?: number } = {},
): { reciente: Array<{ role: 'user' | 'assistant'; content: string }>; antes: FilaDelHilo[] } {
  const corte = ahoraMs - horas * 3600_000;
  const recientes: FilaDelHilo[] = [];
  const antes: FilaDelHilo[] = [];
  for (const f of filasNuevasPrimero) {
    if (recientes.length < turnos && Date.parse(f.created_at) >= corte) recientes.push(f);
    else antes.push(f);
  }
  return { reciente: recientes.reverse().map((f) => ({ role: f.role, content: f.content })), antes: antes.reverse() };
}

/** Cuántos días para atrás se miran los hechos, y cuánto ocupan como máximo en el system. */
export const DIAS_DE_HECHOS = 7;
export const TOPE_HECHOS = 2400;
const LINEAS_MAX = 18;

/** «hoy 10:20», «ayer 18:40», «el lun 20/10 09:00», en la zona del negocio. */
export function cuando(iso: string, ahora: Date, tz: string): string {
  const f = new Date(iso);
  const dia = (d: Date) => new Intl.DateTimeFormat('es', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const hora = new Intl.DateTimeFormat('es', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(f);
  if (dia(f) === dia(ahora)) return `hoy ${hora}`;
  if (dia(f) === dia(new Date(ahora.getTime() - 86_400_000))) return `ayer ${hora}`;
  const fecha = new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit' }).format(f).replace(',', '');
  return `el ${fecha} ${hora}`;
}

const enUnaLinea = (s: string, max: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
};

const ESTADO: Record<string, string> = {
  ejecutada: 'hecha', confirmada: 'confirmada', cancelada: 'cancelada', vencida: 'venció sin confirmar', error: 'falló',
};

/**
 * LO QUE YA SE HABLÓ EN ESTE GRUPO, como hechos (el system del doer, nunca como turnos): los pedidos de la persona y lo
 * que contestó MaKo de más atrás de la ventana, y las acciones que MaKo propuso, con su fecha y cómo terminaron. Más
 * reciente al final, cortado por líneas y por caracteres (es INPUT de cada turno). Vacío si no hay nada.
 */
export function bloqueYaSeHablo(filas: readonly FilaDelHilo[], acciones: readonly AccionDelHilo[], ahora: Date, tz: string): string {
  const lineas: string[] = [];
  for (const f of filas) {
    if (!f.content?.trim()) continue;
    lineas.push(f.role === 'user'
      ? `- ${cuando(f.created_at, ahora, tz)}, te escribieron: «${enUnaLinea(f.content, 170)}»`
      : `  tú: «${enUnaLinea(f.content.split('\n')[0] ?? '', 110)}»`);
  }
  const charla = lineas.slice(-LINEAS_MAX);
  const hechas = acciones.slice(0, 8).map((a) => {
    const fin = ESTADO[a.estado] ?? a.estado;
    const res = a.resultado && a.estado !== 'ejecutada' ? ` (${enUnaLinea(a.resultado, 70)})` : '';
    return `- ${cuando(a.created_at, ahora, tz)}: #${a.id} ${enUnaLinea(a.resumen, 110)} → ${fin}${res}`;
  });
  if (!charla.length && !hechas.length) return '';
  const partes = [
    'LO QUE YA SE HABLÓ EN ESTE GRUPO (de antes de la charla de arriba, hasta 7 días). Es FONDO: sirve para entender a qué se refiere la persona («lo de ayer», «de vuelta», «lo que te pidió», «esa tarea»). ⛔ No son pedidos de ahora: no los hagas ni los confirmes por un «sí» de ahora; si la persona retoma uno, tómalo como pedido nuevo y usa lo que ya te dijo en vez de volver a preguntarlo.',
    ...(charla.length ? ['', ...charla] : []),
    ...(hechas.length ? ['', 'LO QUE PROPUSISTE O HICISTE AHÍ (cómo terminó):', ...hechas] : []),
  ];
  let out = partes.join('\n');
  // Si no entra, se van las líneas de charla más VIEJAS, nunca el encabezado ni las acciones.
  while (out.length > TOPE_HECHOS && charla.length > 1) {
    charla.shift();
    out = [partes[0], '', ...charla, ...(hechas.length ? ['', 'LO QUE PROPUSISTE O HICISTE AHÍ (cómo terminó):', ...hechas] : [])].join('\n');
  }
  return out.slice(0, TOPE_HECHOS);
}

// ── LO QUE MOSTRARON LAS HERRAMIENTAS (los ids del turno anterior) ───────────────────────────────────────────────────
// La memoria del grupo guarda el TEXTO de MaKo, no lo que devolvieron sus herramientas: «descartá esa», «la segunda» o «esos
// 5» se refieren a ids que el turno siguiente no veía (lo pidió «MaKo inteligente», 26/10/2026: sin las `clave` de
// `que_recomienda_mako`, «lo de la landing no aplica» no podía armar `decidir_recomendacion`). Se guarda, por grupo, lo que
// mostraron las herramientas del último turno —sus ids y sus nombres, nada más— y vuelve al system del siguiente.

/** Lo que una herramienta mostró: su nombre y, de cada cosa, el id y cómo se llama. `at`: cuándo (al guardarlo). */
export type RefDelTurno = { herramienta: string; items: Array<{ id: string; nombre: string }>; at?: number };
export const CLAVE_REFS = (jid: string) => `mako.doer.refs.${jid}`;
/** Lo que se mostró hace más que esto ya no es «la segunda» de nadie: la misma ventana que la charla. */
export const VIGENCIA_REFS_MS = 14 * 3600_000;
/** Cuántas cosas por lista, y en total por herramienta. */
const ITEMS_MAX = 10;
const ITEMS_TOTAL = 14;
const CLAVES_ID = ['clave', 'id', 'lead_id', 'tarea_id', 'campana_id', 'landing_id', 'pendiente_id'] as const;
// `hacer`: lo que dice una recomendación de `que_recomienda_mako` (lib/api-mako/areas/mako.run.ts, «MaKo inteligente»).
// `motivo` y `como`: los de una recomendación descartada (`descartadas`), que no trae otro nombre.
const CLAVES_NOMBRE = ['titulo', 'nombre', 'hacer', 'title', 'name', 'resumen', 'texto', 'asunto', 'etapa', 'motivo', 'como'] as const;
/** Cuántas herramientas se recuerdan a la vez: las últimas, cada una con lo último que mostró. */
const HERRAMIENTAS_MAX = 6;

const comoTexto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
function itemDe(o: unknown): { id: string; nombre: string } | null {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const id = CLAVES_ID.map((k) => comoTexto(r[k])).find(Boolean);
  if (!id) return null;
  const nombre = CLAVES_NOMBRE.map((k) => comoTexto(r[k])).find(Boolean) ?? '';
  return { id, nombre: enUnaLinea(nombre, 70) };
}
/**
 * TODAS las listas de cosas con id de la salida, en orden, con el nombre de su campo (`{ recomendaciones: [...], descartadas:
 * [...] }`: la `clave` de una descartada es la que pide una «reabierta»). Si no hay ninguna lista, la cosa con id que haya
 * (`{ ok, landing: { id, nombre } }`).
 */
function listasConIds(v: unknown, donde = '', prof = 0): Array<{ donde: string; items: Array<{ id: string; nombre: string }> }> {
  if (Array.isArray(v)) {
    const items = v.map(itemDe).filter((x): x is { id: string; nombre: string } => !!x);
    return items.length ? [{ donde, items: items.slice(0, ITEMS_MAX) }] : [];
  }
  if (!v || typeof v !== 'object' || prof > 2) return [];
  const listas = Object.entries(v as Record<string, unknown>).flatMap(([k, hijo]) => listasConIds(hijo, k, prof + 1));
  if (listas.length) return listas;
  const solo = itemDe(v);
  return solo ? [{ donde, items: [solo] }] : [];
}

/** Lo que mostró una herramienta, si mostró cosas con id. Un texto que no es JSON, o JSON sin ids, no deja nada. */
export function referenciasDeLaSalida(herramienta: string, salida: unknown): RefDelTurno | null {
  const crudo = typeof salida === 'string' ? salida : salida && typeof salida === 'object' && 'content' in (salida as object) ? (salida as { content: unknown }).content : salida;
  let v: unknown = crudo;
  if (typeof crudo === 'string') { try { v = JSON.parse(crudo); } catch { return null; } }
  const listas = listasConIds(v);
  // Con más de una lista, cada cosa dice de cuál viene («[descartadas]»): la primera va sin marca.
  const items = listas.flatMap((l, i) => l.items.map((it) => (i > 0 && l.donde ? { id: it.id, nombre: `${it.nombre}${it.nombre ? ' ' : ''}[${l.donde}]` } : it)));
  return items.length ? { herramienta, items: items.slice(0, ITEMS_TOTAL) } : null;
}

/** Lo guardado, vigente: cada herramienta con su hora (o la del guardado, en el formato de antes), sin lo vencido. */
function refsVigentes(guardado: string | null | undefined, ahoraMs: number): RefDelTurno[] {
  if (!guardado) return [];
  let g: { at?: number; refs?: RefDelTurno[] };
  try { g = JSON.parse(guardado); } catch { return []; }
  if (!Array.isArray(g.refs)) return [];
  return g.refs
    .map((r) => ({ ...r, at: typeof r.at === 'number' ? r.at : g.at }))
    .filter((r): r is RefDelTurno & { at: number } => typeof r.at === 'number' && ahoraMs - r.at <= VIGENCIA_REFS_MS && Array.isArray(r.items) && r.items.length > 0);
}

/**
 * Lo que se guarda al final de un turno: lo de antes que sigue vigente y lo de este turno, que pisa lo de la MISMA
 * herramienta. Así las `clave` de `que_recomienda_mako` siguen ahí aunque en el medio corra otra herramienta («descartá
 * esa» dos mensajes después). Las últimas `HERRAMIENTAS_MAX`.
 */
export function unirRefs(guardado: string | null | undefined, nuevas: readonly RefDelTurno[], ahoraMs: number): string {
  const de = new Set(nuevas.map((r) => r.herramienta));
  const refs = [...refsVigentes(guardado, ahoraMs).filter((r) => !de.has(r.herramienta)), ...nuevas.map((r) => ({ ...r, at: ahoraMs }))];
  return JSON.stringify({ refs: refs.slice(-HERRAMIENTAS_MAX) });
}

/** Lo que mostraste, para el system del turno siguiente. Vacío si no hay, o si es de hace más de la ventana. */
export function bloqueLoQueMostraste(guardado: string | null | undefined, ahoraMs: number): string {
  const vigentes = refsVigentes(guardado, ahoraMs);
  if (!vigentes.length) return '';
  const hace = (at: number) => {
    const min = Math.max(1, Math.round((ahoraMs - at) / 60_000));
    return min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
  };
  const lineas = vigentes.flatMap((r) => [
    `- ${r.herramienta} (${hace(r.at!)}):`,
    ...r.items.map((it, i) => `  ${i + 1}) ${it.id}${it.nombre ? ` «${it.nombre}»` : ''}`),
  ]);
  return ['LO QUE MOSTRARON TUS HERRAMIENTAS EN EL TURNO ANTERIOR (los ids, para resolver «esa», «la segunda», «esos 5», «descarta esa»: úsalos en vez de volver a buscar o preguntar; si la persona habla de otra cosa, ignóralo):', ...lineas].join('\n');
}

// ── LO QUE DICE UNA FOTO O UN PDF (27/10/2026) ──────────────────────────────────────────────────────────────────────

/** Hasta cuánto de lo leído viaja al turno (es INPUT): una captura o un PDF corto entran enteros. */
export const TOPE_LECTURA_ADJUNTO = 6000;

/** Lo que leyó el código de una imagen o un PDF, como texto para el turno. Sin lectura, lo dice: el modelo no puede
 *  inventar lo que no vio (la imagen nativa sólo la ve Claude). */
export function textoDelAdjunto(leido: string | null | undefined, tipo: 'image' | 'document' | 'texto'): string {
  const que = tipo === 'image' ? 'la imagen' : 'el archivo';
  const t = (leido ?? '').trim();
  if (!t) return `(No pude leer ${que} que mandaste: si es importante, escríbeme lo que dice.)`;
  return `[Lo que dice ${que} que mandaste]\n${t.length > TOPE_LECTURA_ADJUNTO ? `${t.slice(0, TOPE_LECTURA_ADJUNTO)}…` : t}`;
}

/** La consulta al conocimiento del negocio (Second Brain): el mensaje y, si sigue un hilo, el pedido. «y eso?» solo no
 *  encuentra nada. */
export function consultaDelTurno(mensaje: string, hilo: string | null): string {
  return [hilo, sinPrefijoDeLote(mensaje || '')].filter(Boolean).join('\n').slice(0, 1200);
}
