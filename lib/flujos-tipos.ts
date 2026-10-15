// =============================================================================
// flujos-tipos — el "FLUJO" de una automatización: disparador + pasos (data-pura)
// =============================================================================
// Extiende la "plantilla" (referencia de voz) a un FLUJO editable: CUÁNDO dispara
// (evento/cron/umbral/manual) y QUÉ pasos ejecuta (mandar un mensaje, hacer una
// acción, esperar). Módulo SIN 'server-only' (lo importan webhooks, UI y runtime).
//
// El enum de EVENTOS es CERRADO: cada valor corresponde 1:1 a un choke point donde
// ya se llama emitirDelCatalogo (calendly/fathom/meta-leads). No inventar
// eventos sin choke point.
//
// ⚠️ 'lead.wa_entrante' SE QUEDÓ SIN CHOKE POINT el 09/10/2026: lo emitía el webhook de
// Chatwoot, que se borró con la integración. Sigue en el enum porque puede haber flujos
// guardados que lo nombran (pendiente: emitirlo desde la respuesta del número de empresa o
// sacarlo junto con esos flujos).

import type { RamaCondicion } from './flujo-grafo';
import type { ParteMensaje } from './mensaje-partes';

export type EventoFlujo =
  | 'lead.agendo'        // webhooks/calendly invitee.created (R1 y R2)
  | 'lead.cancelo'       // webhooks/calendly invitee.canceled
  | 'reunion.ocurrio'    // webhooks/fathom new-meeting-content-ready
  | 'lead.form_meta'     // webhooks/meta-leads (INSERT)
  | 'lead.wa_entrante';  // ⚠️ sin emisor desde el 09/10/2026 (ver arriba)

/**
 * Los eventos que se pueden ELEGIR en el CRON de un mensaje: cada uno tiene su emisor.
 *
 * ⚠️ «Un lead escribe por WhatsApp» SALIÓ DE ACÁ el 09/10/2026 (sexta tanda, General 15: plantillas
 * «con configuraciones viejas obsoletas»): se ofrecía en el desplegable y un mensaje que lo eligiera
 * no salía nunca, porque nada lo emite (ver arriba). Vive en `EVENTOS_SIN_EMISOR`, para que un flujo
 * guardado con él se siga NOMBRANDO —y diga que ya no se dispara— en vez de quedar en blanco.
 * Medido ese día: ningún store de plantillas lo usa.
 */
export const EVENTOS: Array<{ key: EventoFlujo; label: string }> = [
  { key: 'lead.agendo', label: 'Un lead agenda una reunión' },
  { key: 'lead.cancelo', label: 'Un lead cancela la reunión' },
  { key: 'reunion.ocurrio', label: 'Terminó una reunión (Fathom)' },
  { key: 'lead.form_meta', label: 'Entra un lead por formulario de Meta' },
];

/** Los eventos que quedaron sin emisor: se nombran para leer lo guardado, no se ofrecen. */
export const EVENTOS_SIN_EMISOR: Array<{ key: EventoFlujo; label: string }> = [
  { key: 'lead.wa_entrante', label: 'Un lead escribe por WhatsApp (ya no se dispara)' },
];

/** El rótulo de un evento, también de uno sin emisor. null = no es un evento conocido. */
export function rotuloDeEvento(key: string): string | null {
  return [...EVENTOS, ...EVENTOS_SIN_EMISOR].find((e) => e.key === key)?.label ?? null;
}

export type FiltroEvento = { reunion?: 'R1' | 'R2' };

export type Disparador =
  | { tipo: 'evento'; evento: EventoFlujo; filtro?: FiltroEvento }
  | { tipo: 'manual' };

export type CanalPaso = 'aviso_dueno' | 'wa_lead';
/**
 * ⚠️ VIEJO: SÓLO PARA LEER LO GUARDADO. Eran las tres opciones fijas del paso «⚡ Acción»
 * hasta el 08/10/2026, y ninguna corría: el motor dejaba una pendiente `flujo_<acción>` que
 * ningún área del registro declaraba, y al confirmarla moría como «operación desconocida».
 * Medido ese día: 1 paso así en toda la base (ws1, `crear_tarea`) y 0 corridas. Un paso
 * con esto y sin `operacion` no corre: se dibuja como «Elige una acción».
 */
export type AccionFlujo = 'crear_tarea' | 'inscribir_nutricion' | 'marcar_lead';

/**
 * EL PASO «⚡ ACCIÓN»: cualquier acción de MaKo, con sus datos.
 *
 * Decisión de Martín (08/10/2026), textual: un paso de un flujo «que pueda hacer todo, sin
 * limitaciones». El dueño confirma la acción al CONFIGURAR el paso; cuando el flujo corre,
 * se EJECUTA sin pedir un «sí» (`ejecutarDesdeFlujo`, lib/api-mako/flujo.ts).
 *
 * ⚠️ NO HAY `requiereAprobacion` ACÁ, Y SE SACÓ A PROPÓSITO: la tarjeta dibujaba «· con tu
 * OK» sobre un paso que, con la decisión, corre solo. Un rótulo que promete un permiso que
 * nadie va a pedir es la misma mentira que la pendiente que nadie podía ejecutar.
 */
export type PasoAccion = {
  tipo: 'accion';
  /** El id de una ACCIÓN del registro de la API de MaKo (`porId`). */
  operacion?: string;
  /** Lo que el dueño fijó al configurarlo. El lead del evento lo pone el motor (`paramsDelPaso`). */
  params?: Record<string, unknown>;
  /** Viejo, sólo para leer lo guardado. Ver `AccionFlujo`. */
  accion?: AccionFlujo;
};

export type Paso =
  /**
   * `partes` (undécima tanda, decisión 2 de la décima): SÓLO en `aviso_dueno` de una fila de EVENTO de MaKo
   * (`pasosDelEvento`, lib/aviso-evento.ts), cuando la tarjeta «MaKo en WhatsApp» guarda su lista
   * (`params.partes`, lib/mako-tarjeta.ts). Con ella la tarjeta sale TAL CUAL, por partes (textos, la Voz de MaKo,
   * archivos); `texto` queda como su espejo (el feed). Sin ella, el texto de siempre. En el store de /mensajes
   * no la escribe nadie.
   */
  | { tipo: 'mensaje'; canal: CanalPaso; texto: string; requiereAprobacion?: boolean; partes?: ParteMensaje[] }
  | PasoAccion
  | { tipo: 'esperar'; horas: number }
  /**
   * La rama. ⚠️ SU `condicion` SALE DE `CONDICIONES_FLUJO` (lib/flujo-pasos.ts), que
   * es la lista que el motor SABE evaluar — y hay un guard que falla si el lienzo
   * dibuja una que `decidir` no resuelve. Un diagrama que muestra una rama que no
   * ocurre afirma algo falso con más autoridad que un campo, porque nadie audita una
   * flecha. El tipo es `string` y no la unión para no arrastrar el import a todos los
   * consumidores; quien decide es el saneo y el guard.
   */
  | { tipo: 'condicional'; condicion: string }
  | { tipo: 'insistir'; texto: string; cadaMin: number; veces: number }
  /**
   * LA CONDITION DE UN EVENTO DE MAKO (11/10/2026, lib/aviso-evento.ts `pasosDelEvento`): la rama de la tarjeta
   * CONDITION del lienzo de las automatizaciones, sobre los hechos del LEAD (`cumpleRama`). Se cumple, sigue;
   * no —o no se sabe—, la corrida termina (`decidir`, lib/flujo-pasos.ts). SÓLO la arma la traducción de una
   * fila de evento: en el store de /mensajes no entra (`esFlujoValido`).
   */
  | { tipo: 'condicion'; rama: RamaCondicion }
  /**
   * «EMAIL A LA PERSONA» DE UN EVENTO DE UNA PERSONA (15/10/2026, `EventoMako.persona`, lib/disparadores.ts): un mail
   * a un USUARIO de MaKo (`datos.usuario_id`), por el remitente de MaKo. A dónde, lo decide `destinoDeUsuario` con el
   * `proposito` del EVENTO, nunca un dato. SÓLO lo arma `pasosDelEvento` (lib/aviso-evento.ts): en el store de
   * /mensajes no entra.
   */
  | { tipo: 'email_persona'; asunto: string; texto: string; html?: string; proposito: 'restablecer' | 'aviso' | 'codigo' };

// ── EL PASO «⚡ ACCIÓN»: qué corre, y cómo se escribe ────────────────────────

/** Lo que dibuja el nodo cuando el paso todavía no tiene acción (o es uno viejo). */
export const SIN_ACCION = 'Elige una acción';

/**
 * La operación que el paso CORRE, o null. Es la única pregunta que el motor y el lienzo
 * se hacen, y la contestan acá los dos: con dos lecturas, un paso viejo podría dibujarse
 * «sin acción» y correr igual, o al revés.
 *
 * ⚠️ El `accion` viejo NO cuenta: sus tres valores no son ids del registro, y adivinarles
 * una operación sería hacer correr, sin que nadie la eligiera, una acción que el dueño
 * aprobó cuando todavía era «MaKo te lo propone y se hace con tu sí».
 */
export function operacionDelPaso(p: Pick<PasoAccion, 'operacion'>): string | null {
  const op = typeof p.operacion === 'string' ? p.operacion.trim() : '';
  return op || null;
}

/** «mover_lead_etapa» → «Mover lead etapa». El título real lo trae el catálogo del registro. */
export function rotuloOperacion(op: string): string {
  const s = op.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * El paso que sale del editor (`EditorAccionMako`): la operación y SUS parámetros, nada más.
 *
 * ⚠️ SE ARMA ENTERO A PROPÓSITO, y es la única excepción a «se conserva lo que no se
 * conoce»: lo que había en el paso era la acción ANTERIOR. El `accion` viejo y el
 * `requiereAprobacion` describen una regla que ya no existe; dejarlos colgando haría que
 * el paso dijera dos cosas a la vez. Los parámetros sólo viajan si son un objeto plano.
 */
export function pasoDeAccion(v: { operacion?: string; params?: Record<string, unknown> }): PasoAccion {
  const operacion = typeof v.operacion === 'string' ? v.operacion.trim() : '';
  const params = v.params && typeof v.params === 'object' && !Array.isArray(v.params) ? v.params : {};
  return operacion ? { tipo: 'accion', operacion, params } : { tipo: 'accion' };
}

// ── EL TECHO DE LA INSISTENCIA ───────────────────────────────────────────────
/**
 * El caso que pidió esto, textual: «ellos quieren que cuando un lead de sus clientes
 * entre al CRM, MaKo en WhatsApp le reviente a mensajes insistiendo que le LLAME».
 *
 * ⚠️ EL TECHO LO IMPONE EL PRODUCTO, NO LA CONFIANZA. «Reventar a mensajes» quema la
 * línea de WhatsApp de un cliente —y la línea es suya, no nuestra—, así que estos dos
 * números NO son configurables: el cliente elige cuántas y cada cuánto DENTRO de este
 * marco, y `sanearInsistir` recorta lo que se pase. Un número que el cliente puede
 * subir no protege nada.
 *
 * Decisión de Martín, 28/09/2026: hasta 5 repeticiones, nunca menos de 30 minutos entre
 * una y otra. Y dos cortes más que no se discuten: se termina en cuanto alguien acusa
 * recibo en el grupo, y de noche no sale (VENTANA_HORARIA).
 */
export const INSISTIR_MAX_VECES = 5;
export const INSISTIR_MIN_MINUTOS = 30;
/** Hora local del workspace: fuera de esta franja, la insistencia espera a la mañana. */
export const INSISTIR_VENTANA = { desde: 8, hasta: 21 } as const;

/** Palabras que cuentan como «lo vi» en el grupo y cortan la insistencia. */
export const ACUSES = ['ok', 'okey', 'oka', 'dale', 'listo', 'visto', 'lo vi', 'ya está', 'ya esta', 'perfecto', 'gracias', 'enterado', 'anotado', '👍', '✅', '🙏'];

/** ¿Este texto del grupo es un acuse de recibo? Tolerante: cualquier mensaje corto que lo contenga. */
/**
 * ¿Este mensaje del grupo corta los recordatorios?
 *
 * ⚠️ LAS PALABRAS SON UN PARÁMETRO CON DEFAULT, y eso es lo que permite que el
 * negocio las configure sin tocar a nadie: los diez tests que comparan contra
 * `ACUSES` siguen llamando con un solo argumento y siguen en verde.
 *
 * Pedido textual: «también se debería poder configurar qué palabra hacen que paren
 * los recordatorios, no solo un ok».
 */
export function esAcuse(texto: string, palabras: readonly string[] = ACUSES): boolean {
  const t = (texto || '').trim().toLowerCase();
  if (!t || t.length > 40) return false;   // un mensaje largo es otra conversación, no un «ok»
  return palabras.some((a) => t === a || t.startsWith(a + ' ') || t.endsWith(' ' + a) || t.includes(a));
}

/**
 * CUÁNDO vuelve el próximo. Respeta la noche: si el turno cae fuera de la franja, se
 * corre al comienzo de la siguiente. Un aviso que insiste a las 3 de la mañana no lo
 * lee nadie y sí quema la línea.
 *
 * Vive acá y no en lib/insistencias.ts porque aquel tiene 'server-only' y ningún test
 * lo podría importar — y esto es lo que decide a qué hora le suena el teléfono a una
 * persona. Es la misma razón por la que el techo está acá.
 *
 * `horaLocal` es la hora del workspace AHORA. El salto se estima sumándole las horas
 * del intervalo: es una estimación deliberada, porque el cron vuelve a chequear la
 * ventana al drenar. Un error de borde retrasa un mensaje, nunca lo adelanta.
 */
export function proximaSalida(desde: Date, cadaMin: number, horaLocal: number): Date {
  const prox = new Date(desde.getTime() + cadaMin * 60_000);
  const horaProx = (horaLocal + Math.floor(cadaMin / 60)) % 24;
  if (horaProx >= INSISTIR_VENTANA.desde && horaProx < INSISTIR_VENTANA.hasta) return prox;
  const salto = (24 - horaProx + INSISTIR_VENTANA.desde) % 24;
  return new Date(prox.getTime() + salto * 3_600_000);
}

/** Recorta un paso de insistencia al marco que impone el producto. */
export function sanearInsistir(p: { texto?: string; cadaMin?: number; veces?: number }): { tipo: 'insistir'; texto: string; cadaMin: number; veces: number } {
  const veces = Math.max(1, Math.min(INSISTIR_MAX_VECES, Math.floor(Number(p.veces) || 1)));
  const cadaMin = Math.max(INSISTIR_MIN_MINUTOS, Math.floor(Number(p.cadaMin) || INSISTIR_MIN_MINUTOS));
  return { tipo: 'insistir', texto: (p.texto ?? '').trim(), cadaMin, veces };
}

export type Flujo = {
  version: 1;
  activo: boolean;
  disparador: Disparador;
  pasos: Paso[];
};

/** Flujo vacío por default (para arrancar a editar en la UI). */
export function flujoVacio(): Flujo {
  return { version: 1, activo: false, disparador: { tipo: 'manual' }, pasos: [] };
}

/** Descripción legible del disparador (para la card del flujo). */
export function describirDisparador(d: Disparador): string {
  if (d.tipo === 'manual') return 'Manual (lo disparas tú)';
  const ev = rotuloDeEvento(d.evento) ?? d.evento;
  const f = d.filtro?.reunion ? ` (solo ${d.filtro.reunion})` : '';
  return `${ev}${f}`;
}

/** Descripción legible de un paso. */
export function describirPaso(p: Paso): string {
  if (p.tipo === 'mensaje') {
    const canal = p.canal === 'aviso_dueno' ? 'Avisar al dueño' : 'Mensaje al lead (WhatsApp)';
    return `${canal}${p.requiereAprobacion ? ' · con tu OK' : ''}`;
  }
  if (p.tipo === 'accion') {
    // El TÍTULO de la acción vive en el registro de la API de MaKo, que no se importa
    // desde acá (este módulo lo lee el navegador). Acá va el id legible; el lienzo lo
    // pisa con el título del catálogo cuando lo tiene (app/agencia/FlujoAviso.tsx).
    // Un paso VIEJO (`accion` sin `operacion`) no corre: se dibuja sin acción elegida.
    const op = operacionDelPaso(p);
    return op ? rotuloOperacion(op) : SIN_ACCION;
  }
  if (p.tipo === 'email_persona') return 'Email a la persona';
  if (p.tipo === 'insistir') {
    const cada = p.cadaMin % 60 === 0 ? `${p.cadaMin / 60} h` : `${p.cadaMin} min`;
    return `Insistir hasta que confirmes · cada ${cada}, hasta ${p.veces} ${p.veces === 1 ? 'vez' : 'veces'}`;
  }
  // ⚠️ El rótulo del condicional se escribe ACÁ y no se importa de `flujo-pasos`:
  // ese módulo importa el tipo `Paso` de este, y traer un VALOR de vuelta cierra el
  // ciclo. Lo que impide que las dos listas se separen es el guard de
  // `tests/flujo-condicional.test.ts`, que es más honesto que un import: un import
  // garantiza el mismo string, y lo que hay que garantizar es que el motor SEPA
  // evaluar lo que el lienzo dibuja.
  if (p.tipo === 'condicional') {
    return p.condicion === 'contestaron' ? 'Si alguien contestó en el grupo' : 'Si nadie contestó';
  }
  if (p.tipo === 'condicion') return 'Si se cumple la condición';
  return `Esperar ${p.horas}h`;
}

/**
 * Valida la forma de un Flujo (defensivo: viene del store/JSON).
 *
 * ⚠️ UNA `condicion` NO ENTRA AL STORE (11/10/2026): sólo la arma la traducción de un evento de MaKo, que corre
 * con los hechos del lead. Guardada en /mensajes, `decidir` la evaluaría sin hechos y cortaría siempre: el
 * lienzo de /mensajes no la dibuja ni la ofrece.
 */
export function esFlujoValido(x: unknown): x is Flujo {
  if (!x || typeof x !== 'object') return false;
  const f = x as Flujo;
  return f.version === 1 && typeof f.activo === 'boolean' && !!f.disparador && Array.isArray(f.pasos)
    && !f.pasos.some((p) => (p as { tipo?: unknown } | null)?.tipo === 'condicion');
}

// ── CADA CUÁNTO INSISTE, EN UNIDADES QUE ALGUIEN PUEDE ELEGIR ──────────────
// El paso guarda MINUTOS y los va a seguir guardando: es lo que el motor lee de la
// fila (`insistencias.cada_min`) y lo que el CHECK de la migración 0180 valida. Lo
// que falta es el vocabulario para elegirlos, porque «cada 43200 minutos» no es una
// frase. Pedido textual: «solo está configurado para recordatorios por minutos, se
// debería poder recordar 1 vez al día, a la semana, al mes».
//
// ⚠️ NO HACE FALTA MIGRACIÓN NI CAMPO NUEVO, y está medido: el CHECK de
// `cada_min` es un PISO (`>= 30`) y `sanearInsistir` tampoco tiene techo, así que
// 1440, 10080 y 43200 entran tal cual. Y los tres conservan la hora de pared,
// porque `proximaSalida` avanza en horas y los tres son múltiplos de 24 h.

export type UnidadRecordatorio = 'min' | 'hora' | 'dia' | 'semana' | 'mes';

export const UNIDADES_RECORDATORIO: Array<{ key: UnidadRecordatorio; label: string; plural: string; min: number }> = [
  { key: 'min', label: 'minuto', plural: 'minutos', min: 1 },
  { key: 'hora', label: 'hora', plural: 'horas', min: 60 },
  { key: 'dia', label: 'día', plural: 'días', min: 1440 },
  { key: 'semana', label: 'semana', plural: 'semanas', min: 10080 },
  { key: 'mes', label: 'mes', plural: 'meses', min: 43200 },
];

/** Minutos → el par (cuántos, de qué). Elige la unidad MÁS GRANDE que divida justo. */
export function cadaDeMin(min: number): { n: number; u: UnidadRecordatorio } {
  for (const u of [...UNIDADES_RECORDATORIO].reverse()) {
    if (u.min > 1 && min >= u.min && min % u.min === 0) return { n: min / u.min, u: u.key };
  }
  return { n: Math.max(1, Math.round(min)), u: 'min' };
}

/** El par → minutos, ya recortado por el piso que el motor exige. */
export function aMinutos(n: number, u: UnidadRecordatorio): number {
  const base = UNIDADES_RECORDATORIO.find((x) => x.key === u)?.min ?? 1;
  const v = Math.floor(Number(n));
  return Math.max(INSISTIR_MIN_MINUTOS, (Number.isFinite(v) && v > 0 ? v : 1) * base);
}

/**
 * LAS PALABRAS DE CORTE QUE ESCRIBE EL NEGOCIO, saneadas.
 *
 * Se topean en 12 y en 24 caracteres cada una por la misma razón que `esAcuse` no
 * mira mensajes largos: una palabra de corte que sea una frase común convierte
 * cualquier charla del grupo en un «lo vi», y el recordatorio deja de existir sin
 * que nadie lo apague.
 */
export function sanearAcuses(v: unknown): string[] {
  const crudo = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const out: string[] = [];
  for (const x of crudo) {
    const p = String(x).trim().toLowerCase().replace(/[!¡.,;:]+$/g, '');
    if (p && p.length <= 24 && !out.includes(p)) out.push(p);
    if (out.length >= 12) break;
  }
  return out;
}
