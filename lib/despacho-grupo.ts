// =============================================================================
// despacho-grupo — MaKo en el grupo es un DESPACHANTE: qué hace él y qué delega (29/10/2026; sin base: puro)
// =============================================================================
// Martín, 29/10/2026, textual: «Si al fin y al cabo sólo tiene que DELEGAR todo... Si quiere una Acción dentro de MaKo, está la API,
// se la delega al Ops Center, al cerebro, y ya el cerebro decide según lo difícil de la petición a qué jefe enviarle y a qué esfuerzo
// o modelo... Y luego le avisa cuando está listo... A menos que sea una tarea muy simple, como cambiar algo del CRM, agendar una reu o
// algo así, que lo haga directamente, eso también lo puede hacer Haiku».
//
// LA REGLA ES EN CÓDIGO, NO EN EL PROMPT (el Cerebro, 29/10): una lista CERRADA de escrituras simples —una sola fila o un solo evento,
// reversibles—. La ACCIÓN corre con ésas y las lecturas; si el turno termina sin proponer ninguna (y no está preguntando un dato que
// falta), no se manda su texto: se DELEGA. En la duda, se delega.
//
// DELEGAR es la Ticketera (medido el 29/10: no existe otra cola para el Ops Center de un negocio cliente; `operaciones_pedidos` exige
// la firma del dispositivo de Martín): un ticket «pedido» marcado `delegado`, que el Runner le lleva al Cerebro con su texto fijo
// («Pedido delegado #N»); el Cerebro elige el jefe, el modelo y el esfuerzo, y al cerrarlo el aviso le llega al grupo (el «listo»).
// =============================================================================

import { SE_APRUEBAN_EN_LA_APP } from './confirmacion-pura';
import { taparClaves } from './claves-en-el-chat';

/**
 * Las escrituras SIMPLES: una sola fila o un solo evento, reversibles, con su confirmación de siempre. Lo que no está aquí se delega.
 * Afuera a propósito: lo que mueve plata (links de pago, reembolsos, bajas, suscripciones; el presupuesto va por pantalla), lo que
 * cancela, crear o editar campañas y automatizaciones, y lo que cambia varias cosas a la vez.
 */
export const ACCIONES_SIMPLES: ReadonlySet<string> = new Set([
  // El CRM: una ficha, una etapa, una nota, una etiqueta, quién la atiende.
  'proponer_lead', 'proponer_cambio_etapa', 'agregar_nota_lead', 'marcar_calificado', 'asignar_closer_setter', 'poner_etiqueta_lead', 'sacar_etiqueta_lead',
  'editar_dato_deal', 'editar_venta_lead', 'editar_cuota', 'marcar_pago_cobrado',
  // El pago de la mensualidad de una agencia o de la entrada de un cliente (12/11/2026, Martín: «Si perfecto, dalo de alta» al
  // comprobante de Código Inmobiliario que MaKo le mandó para revisar). Sólo la plataforma (`soloPlataforma`) y con el «sí» del chat
  // (`confirmacion: 'chat'`). Sin estas, la acción se delegaba al equipo: justo lo que MaKo le acababa de preguntar a Martín.
  'marcar_entrada_pagada', 'marcar_mensualidad_pagada',
  // Y el comprobante entero de una agencia, cuando Martín dice a quiénes va (16/11/2026; lib/agencia-mes-comprobante.ts).
  'aplicar_comprobante_agencia',
  // La agenda: agendar, mover o cambiar UNA reunión, marcar si vino.
  'proponer_agendar_reunion', 'proponer_agendar_agenda', 'proponer_mover_reunion', 'proponer_cambiar_reunion', 'marcar_asistencia_reunion',
  'crear_evento_calendario', 'crear_evento_google',
  // El Plan: una tarea.
  'proponer_tareas_plan', 'mover_tarea_plan', 'cambiar_fecha_tarea_plan', 'actualizar_avance_tarea',
  // Un dato del perfil del negocio que ya estaba cargado (O21, 18/11/2026: Leila, «¿cómo te hago recordar que LíderMente es de
  // 7:30 a 9:30?»): un solo campo, con lo de antes en la tarjeta y su «sí». Sin esto se delegaba al equipo.
  'corregir_campo_perfil',
  // El «sí» y el «no» a lo que MaKo ya propuso.
  'confirmar_accion', 'cancelar_accion',
  // LO QUE MARTÍN MOSTRÓ EN LA LLAMADA CON THIAGO (29/10/2026, el Cerebro: docs/promesas/2910-llamada-thiago.md, «desde el grupo, lo
  // que quieras»): replicar y analizar una landing (deja un borrador en el Web Generator, se puede borrar) y pausar o prender una
  // campaña o un anuncio (reversible; mueve plata, así que el «sí» es el puro de quien la pidió). El estado de las campañas es lectura
  // y ya viaja.
  'replicar_landing', 'analizar_landing', 'proponer_estado_campana', 'proponer_estado_anuncio',
]);

export const esAccionSimple = (nombre: string): boolean => ACCIONES_SIMPLES.has(nombre);

/**
 * LO QUE SE CONFIRMA EN UNA PANTALLA: cambiar un presupuesto (es plata). MaKo lo propone desde el grupo y el link lleva a
 * /mako/revisar, donde se aprueba (`confirmacion: 'pantalla'` en lib/api-mako/areas/ads.def.ts): no se delega, y por WhatsApp no
 * se confirma.
 */
export const ACCIONES_CON_PANTALLA: ReadonlySet<string> = new Set([
  'proponer_presupuesto_campana', 'proponer_presupuesto_conjunto',
  // «Súbeme este anuncio» con un Drive, un video o una imagen (29/10/2026; lib/anuncio-desde-archivo.ts): el anuncio queda EN PAUSA
  // y se aprueba en /mako/revisar. Detrás de ZERNIO_ANUNCIOS_PROBADO: apagada, la operación lo dice; MaKo no lo delega igual.
  'proponer_anuncio_desde_archivo',
]);

/** ¿Viaja en el turno de una ACCIÓN? Las simples, las de pantalla y el WhatsApp a un lead (que se aprueba en la app). */
export const viajaEnLaAccion = (nombre: string): boolean =>
  ACCIONES_SIMPLES.has(nombre) || ACCIONES_CON_PANTALLA.has(nombre) || SE_APRUEBAN_EN_LA_APP.has(nombre);

/** La línea que va cuando quedó propuesto un WhatsApp a un lead: sale con un toque en la app, nunca con un «sí» por aquí. */
export const lineaApruebaEnLaApp = (link: string): string => `Ese WhatsApp sale cuando lo apruebas con un toque aquí 👉 ${link}`;

// ── EL PEDIDO COMPUESTO («moveme la reunión y mandale un WhatsApp», la llamada con Thiago) ─────────────────────────────────────────
// La IA lista las PARTES de lo que pide (`partes`, lib/mako-intencion-ia.ts). El turno hace lo que puede; si hizo menos escrituras o
// propuestas que partes, lo demás va al equipo como pedido delegado. Nunca se pierde una parte en silencio. Por cantidad, a propósito:
// no se adivina qué parte fue cuál, y delegar de más cuesta un ticket; perder una parte cuesta la promesa.

/** ¿Quedó alguna parte sin hacer ni proponer? `hechas`: las escrituras o propuestas que corrieron en el turno. Las `partes`, las que
 *  CUENTAN (`partesQueCuentan`): sin los datos de una escritura del turno ni las lecturas que el turno ya hizo. */
export function faltaAlgunaParte(partes: readonly string[], hechas: number): boolean {
  return partes.length >= 2 && hechas > 0 && hechas < partes.length;
}

// ── UNA «PARTE» QUE NO ES UNA PARTE (18/11/2026, los pedidos #111 y #101 de Código Inmobiliario) ──────────────────────────────────
// #111: «agenda un evento en mi calendario hoy 18 a las 18hs, que dure 1hora, que se llame Misa Fasta SAM». La IA listó dos partes
// («Crear evento hoy 18 a las 18hs» y «Duración 1 hora (Nombre: Misa Fasta SAM)»), MaKo propuso UN `crear_evento_calendario` con todo
// —la hora, la hora de duración y el título— y `faltaAlgunaParte` (1 de 2) le dijo «Lo demás lo pasé al equipo (pedido #111)». La
// segunda «parte» eran los ARGUMENTOS de la primera. #101 (16/11): «Buscar la reunión de Rodrigo» y «Mover el lead a descalificado»;
// MaKo buscó y lo movió, y la búsqueda contó como una parte sin escritura. Medido en anthropic_usage: 3 «delegada-parte» en 7 días,
// 2 falsos así (docs/hallazgos-comunicacion.md). Sigue siendo por cantidad, pero sin lo que no pide una escritura propia.

/** Una escritura o propuesta del turno, con lo que se le pasó. */
export type EscrituraDelTurno = { nombre: string; args: unknown };

const sinTildes = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lo que nombra un DATO de una acción, al principio de la parte: «Duración 1 hora», «Hora: 15:00», «Nombre del evento…». Sin los
 *  ambiguos: «Mensaje a Juan», «Correo a Ana» o «Presupuesto nuevo…» pueden ser otra acción. */
const RX_PARAMETRO = /^\s*(?:(?:la|el|los|las|su|sus|con|y)\s+)?(?:duracion|horario|hora|fecha|dia|titulo|nombre|monto|precio|importe|etapa|lugar|ubicacion|direccion|descripcion|cantidad|valor|moneda|formato|color|asunto)\b/;
/** Una parte que sólo LEE: «Buscar la reunión de Rodrigo», «Ver el lead», «Revisar la campaña». La hace el turno, sin escribir. */
const RX_LECTURA = /^\s*(?:buscar?|busca(?:rla|rlo|rlas|rlos)|ver|mirar?|revisar?|fijarse|consultar?|leer|encontrar|ubicar|chequear?|averiguar|identificar|localizar)\b/;
/** Lo que no dice NADA de una parte: artículos, preposiciones, y los verbos con que se dice un dato («que dure», «que se llame»). */
const VACIAS = new Set(['que', 'los', 'las', 'del', 'con', 'por', 'para', 'una', 'unos', 'unas', 'este', 'esta', 'esto', 'sus', 'mis', 'tus',
  'dure', 'dura', 'llame', 'sea', 'quede', 'diga', 'nombre', 'titulo', 'duracion', 'hora', 'horas', 'minuto', 'minutos', 'min', 'hs']);

/** Los valores CORTOS de lo que se pasó (los textos largos —una nota, un mensaje— no cuentan: que la parte esté adentro de una nota
 *  no dice que sea un dato de ella, y puede ser justo lo que falta hacer). */
function valoresCortos(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'number' && Number.isFinite(x)) out.push(String(x));
  else if (typeof x === 'string' && x.length <= 80) out.push(x);
  else if (Array.isArray(x)) for (const v of x) valoresCortos(v, out);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!k.startsWith('__')) valoresCortos(v, out);
  return out;
}
const palabras = (s: string): string[] => sinTildes(s).split(/[^a-z0-9ñ]+/).filter(Boolean);

/** Lo que dice la parte: palabras de 3 letras o más que no son vacías, y números; «1 hora» vale también como 60 (minutos). «18hs» no:
 *  es la hora del reloj, no una duración. */
function significativas(parte: string): string[] {
  const t = sinTildes(parte).replace(/\b(\d{1,2})\s*(?:hora|horas)\b/g, (_m, n: string) => `${n} ${Number(n) * 60}`);
  return palabras(t).map((p) => p.replace(/^(\d+)hs?$/, '$1')).filter((p) => (/^\d+$/.test(p) || p.length >= 3) && !VACIAS.has(p));
}

/** La parte arranca con un VERBO en infinitivo («Crear…», «Replicar…», «Mandarle…»): es una ACCIÓN, no el dato de otra. ⚠️ Sin esto
 *  la parte que ES la acción coincide con sus propios argumentos («replicar la landing https://…» contra `url`) y se descartaba: la
 *  OTRA parte quedaba sola y ya no se delegaba (la escena «compuesto» de tests/clase-del-grupo.test.ts). */
const RX_EMPIEZA_CON_VERBO = /^\s*(?:y\s+)?[a-zñ]{2,}(?:ar|er|ir)(?:l[aeo]s?|me|te|se|nos|selo|sela)?\b/;

/** ¿Esta parte es un DATO de una escritura del turno? Empieza por el nombre de un dato, o no es una acción y lo que dice está en sus
 *  valores cortos. */
export function esDatoDeUnaEscritura(parte: string, escrituras: readonly EscrituraDelTurno[]): boolean {
  if (!escrituras.length) return false;
  const t = sinTildes(parte);
  if (RX_PARAMETRO.test(t)) return true;
  if (RX_EMPIEZA_CON_VERBO.test(t)) return false;
  const sig = significativas(parte);
  if (!sig.length) return false;
  const valores = new Set(palabras(valoresCortos(escrituras.map((e) => e.args)).join(' ')));
  const dentro = sig.filter((p) => valores.has(p));
  // Tres cuartos o más, y al menos una PALABRA (un número suelto coincide con cualquier fecha).
  return dentro.length / sig.length >= 0.75 && dentro.some((p) => !/^\d+$/.test(p));
}

/** Las partes que piden una escritura propia: sin los datos de lo que el turno escribió o propuso, y sin las lecturas si el turno leyó. */
export function partesQueCuentan(partes: readonly string[], o: { escrituras: readonly EscrituraDelTurno[]; leyo: boolean }): string[] {
  return partes.filter((p) => !esDatoDeUnaEscritura(p, o.escrituras) && !(o.leyo && RX_LECTURA.test(sinTildes(p))));
}

/** La línea que dice que lo demás se delegó. El número lo escribe el código. */
export const lineaDeLoQueFalta = (id: number): string => `Lo demás que me pediste lo pasé al equipo de MaKo (pedido #${id}). Te aviso por aquí cuando esté.`;

// ── EL PEDIDO DELEGADO QUE NADIE TOMÓ (el Cerebro, 29/10/2026: «si un pedido delegado no se toma en 30 minutos, MaKo avisa») ──────────

export const MIN_SIN_TOMAR = 30;
/** Sólo los de hoy: un delegado de hace días ya no se avisa (y en el primer deploy no sale una tanda de viejos). */
export const HORAS_MAX_SIN_TOMAR = 6;

export type DelegadoSinTomar = { id: number; workspace_id: number; titulo: string; estado: string; created_at: string; canal: string | null; contexto: unknown };

/** Los delegados por WhatsApp que siguen sin tomar (nuevos o esperando la decisión) entre 30 minutos y 6 horas, y sin avisar. */
export function delegadosParaAvisar(filas: readonly DelegadoSinTomar[], yaAvisados: ReadonlySet<number>, ahoraMs: number): DelegadoSinTomar[] {
  return filas.filter((f) => {
    const edad = ahoraMs - Date.parse(f.created_at);
    const delegado = !!f.contexto && typeof f.contexto === 'object' && (f.contexto as { delegado?: unknown }).delegado === true;
    return delegado && f.canal === 'whatsapp' && ['nuevo', 'esperando_decision'].includes(f.estado) && !yaAvisados.has(f.id)
      && edad >= MIN_SIN_TOMAR * 60_000 && edad <= HORAS_MAX_SIN_TOMAR * 3600_000;
  });
}

/** Lo que dice MaKo en el grupo. Sin promesas de hora: dice dónde está. */
export const textoDelegadoSinTomar = (id: number, titulo: string): string =>
  `Tu pedido #${id} («${titulo.trim().replace(/[.\s]+$/u, '').slice(0, 120)}») todavía no lo tomó nadie del equipo: sigue en la fila. Cuando esté, te aviso por aquí.`;

/**
 * Lo que falta, pedido sin signo de pregunta (20/11/2026, el ticket #120): «Pásame el título, el día y la hora y lo agendo» también pide
 * un dato. Sólo con el signo final, un pedido así se delegaba. Va por la raíz del verbo (no por cada forma: el guard de copy lee el
 * texto de la regex) y tiene que nombrar el dato.
 */
const PIDE_EL_DATO = /\b(?:p[aá]sa|d[ií]|ind[ií]ca|cu[eé]nta|m[aá]nda|env[ií]a|escr[ií]be|conf[ií]rma)me\b[^\n]{0,140}?\b(?:d[ií]as?|horas?|horarios?|fechas?|t[ií]tulos?|nombres?|datos?|cuándo|tel[eé]fonos?|emails?|correos?)\b|\bnecesito\b[^\n]{0,80}?\b(?:d[ií]as?|horas?|horarios?|fechas?|t[ií]tulos?|nombres?|datos?)\b/i;

/** ¿La respuesta pide un dato que falta («¿a qué hora?», «pásame el día y la hora»)? Entonces la acción simple sigue: no se delega. */
export function preguntaUnDato(respuesta: string): boolean {
  const t = (respuesta || '').trim();
  return /\?\s*$/.test(t) || /¿[^?]{3,200}\?\s*$/.test(t.split('\n').filter(Boolean).pop() ?? '') || PIDE_EL_DATO.test(t);
}

/** Lo que dice MaKo cuando le piden agendar sin decir qué ni cuándo (el ticket #120). El ejemplo es el pedido que sí agenda. */
export const PIDE_DATOS_AGENDA = 'Claro. Para agendarlo dime qué es, qué día y a qué hora. Por ejemplo: «MaKo, agenda la reunión con Ana el 25 de noviembre de 16 a 17».';

const CREA_EN_LA_AGENDA = /\b(agreg|cre|pon|anot|sum|program|arm|carg)\w*/;
const LA_AGENDA = /\b(eventos?|calendarios?|calendar|reunion|reuniones|citas?|llamadas?)\b/;
const NO_CREA = /\b(cancel|borr|elimin|quit|sac|anul|suspend)\w*/;
const TIENE_FECHA_U_HORA = /\b(hoy|manana|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\b\d{1,2}\s*(de|\/|-)\s*(\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)|\b\d{1,2}([:.]\d{2})?\s*(h|hs|horas|am|pm)\b|\ba las \d/;

/**
 * ¿SE PIDEN LOS DATOS EN VEZ DE DELEGAR? (20/11/2026, el ticket #120: «Marcela quiere probar la funcionalidad de agregar un evento al
 * calendario de google»). Agendar UN evento es una escritura simple (`crear_evento_google`, arriba): MaKo la hace sola, con su «sí».
 * Sin qué, qué día ni a qué hora no hay nada que proponer, el turno terminó sin proponer y se DELEGABA. Como lo había pedido alguien
 * que no administra el negocio, el pedido quedó esperando a Martín, y el grupo recibió «Lo pasé al equipo de MaKo» por algo que MaKo
 * hace sola. Ahora se piden los datos (`PIDE_DATOS_AGENDA`). Sólo para CREAR algo en la agenda y sin fecha ni hora en el pedido: con
 * fecha, el turno pudo proponerlo, y si no lo hizo es otra cosa (se delega como antes). Nunca si cancela, mueve o borra.
 */
export function pideDatosEnVezDeDelegar(pedido: string): string | null {
  const t = sinTildes(pedido);
  if (NO_CREA.test(t)) return null;
  const esCrearEnLaAgenda = /\bagend\w*/.test(t) || (CREA_EN_LA_AGENDA.test(t) && LA_AGENDA.test(t));
  if (!esCrearEnLaAgenda || TIENE_FECHA_U_HORA.test(t)) return null;
  return PIDE_DATOS_AGENDA;
}

/**
 * ¿Se DELEGA la acción? Sí, si el turno terminó sin proponer ni hacer una escritura simple y no está preguntando un dato. Una
 * escritura que no es simple ni siquiera viaja (el turno de la ACCIÓN lleva sólo las simples), así que no hay otra forma de hacerla.
 * Salvo que haya LEÍDO y contestado sin decir que algo quedó hecho (`afirmaHecho`, el saneo del grupo): era un pedido de datos
 * tomado por acción («pásame la misma lista con el teléfono», conv:1563 del banco), y su respuesta es la lista.
 */
export function delegaLaAccion(t: { propuso: boolean; escribio: boolean; respuesta: string; leyo?: boolean; afirmaHecho?: boolean }): boolean {
  if (t.leyo && !t.afirmaHecho) return false;
  return !t.propuso && !t.escribio && !preguntaUnDato(t.respuesta);
}

// ── EL TICKET del grupo (lib/tickets-del-grupo.ts lo abre; esto es lo puro) ──────────────────────────────────────────────────────

export type TicketAbierto = { id: number; sumado: boolean };

/** El ticket que MaKo acaba de nombrar en el grupo («Abrí el ticket #31: …»): lo que sigue de la misma persona se suma a ése. */
export function ticketQueAcabaDeNombrar(ultimoDeMaKo: string | null): number | null {
  const m = /\bticket\s+#(\d{1,9})\b/i.exec(ultimoDeMaKo ?? '');
  return m ? Number(m[1]) : null;
}

/** Lo que dice MaKo: el número, el resumen y qué va a pasar. Lo arma el código. */
/**
 * ⚠️ LLEVA EL LINK PARA MIRAR CÓMO VA, y es un pedido de Martín del 2/11/2026 después de que Joan
 * preguntara por WhatsApp «¿cómo van esos tickets?»: «que le diga, mira el progreso de tu ticket
 * aquí, y que él pueda ir viendo: tu ticket fue levantado, el equipo lo revisó, ya lo están
 * desarrollando».
 *
 * La pantalla y los estados YA existían —`/tickets?t=<id>` dibuja la línea de tiempo del ticket
 * (`pasosDelTicket`, lib/tickets-reglas.ts: recibido → en curso → arreglado → resuelto)—. Lo que
 * faltaba era decirle que existe: la respuesta terminaba en «te aviso por aquí cuando esté», así
 * que la única forma de saber algo era esperar o preguntar, que es exactamente lo que hizo Joan.
 *
 * ⚠️ `base` ES UN PARÁMETRO Y NO UN IMPORT a propósito: este módulo es PURO (sin base de datos, sin
 * `server-only`) y sus tests lo ejecutan directo. Importar `APP_BASE_URL` arrastraría `ws-tab` y las
 * landings acá adentro. Sin `base` la frase es la de antes, palabra por palabra.
 */
export function respuestaDelTicket(t: TicketAbierto, resumen: string, base?: string): string {
  const que = resumen.trim().replace(/[.\s]+$/u, '');
  const donde = base ? ` Mira el progreso de tu ticket aquí: ${base.replace(/\/+$/u, '')}/tickets?t=${t.id}` : '';
  return t.sumado
    ? `Lo sumé al ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por aquí cuando esté.${donde}`
    : `Abrí el ticket #${t.id}${que ? `: ${que}` : ''}. Lo toma el equipo y te aviso por aquí cuando esté.${donde}`;
}

/** Lo que dice MaKo al delegar. El número lo escribe el código. */
export function respuestaDeLaDelegacion(id: number, resumen: string): string {
  const que = resumen.trim().replace(/[.\s]+$/u, '');
  return `Lo pasé al equipo de MaKo (pedido #${id})${que ? `: ${que}` : ''}. Te aviso por aquí cuando esté.`;
}

// ── EL DEBUG (sólo el grupo de SuperAdmin): lo mira el código con `diagnosticar_negocio` y lo delega al Cerebro con la evidencia ──

/** El nombre del negocio que leyó `diagnosticar_negocio`, si lo encontró (uno solo). */
export function negocioLeido(leido: Record<string, unknown> | null): string | null {
  const n = leido?.negocio as { nombre?: unknown } | undefined;
  return leido && leido.encontrado !== false && n && typeof n.nombre === 'string' && n.nombre.trim() ? n.nombre.trim() : null;
}

/**
 * Lo que dice MaKo en un DEBUG, armado por el código: sin el negocio, lo pregunta; con varios, nombra los candidatos; encontrado, el
 * número del ticket y 2 o 3 hechos de la lectura (`hechosDelDiagnostico`). `ticket`: el número, o null si no se pudo abrir.
 */
export function respuestaDelDebug(p: { pedido: string; leido: Record<string, unknown> | null; crudo: string; hechos: readonly string[]; ticket?: number | null }): string {
  if (!p.pedido.trim()) return '¿De qué negocio es? Dime su nombre y lo miro.';
  if (p.leido && p.leido.encontrado === false) {
    const cand = Array.isArray(p.leido.candidatos) ? (p.leido.candidatos as Array<{ ws: number; nombre: string }>) : [];
    return cand.length
      ? `«${p.pedido}» calza con más de un negocio: ${cand.slice(0, 4).map((c) => `${c.nombre} (${c.ws})`).join(', ')}. ¿Cuál es?`
      : `No encontré un negocio que se llame «${p.pedido}». ¿Cuál es?`;
  }
  const nombre = negocioLeido(p.leido);
  // El texto crudo de la lectura, sin claves (la revisión de privacidad, B3).
  if (!nombre) return `No pude mirar ${p.pedido} ahora${p.crudo && !p.leido ? ` (${taparClaves(p.crudo).texto.slice(0, 120)})` : ''}.`;
  const loQueVeo = p.hechos.length ? `: ${p.hechos.join('; ')}` : '';
  return p.ticket
    ? `Lo pasé al Cerebro (ticket #${p.ticket}) con lo que veo de ${nombre}${loQueVeo}.`
    : `Miré ${nombre}${loQueVeo}. No pude abrir el ticket ahora: pásaselo al Cerebro a mano.`;
}

/** El ws del dueño de la agencia (Mauricio): lo suyo se ejecuta con cuidado (AGENTS.md, «el ws1»). */
export const WS_CON_CUIDADO = 1;
