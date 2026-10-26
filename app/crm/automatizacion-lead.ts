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

import type { AutomatizacionesDelLead, EnAutomatizacion } from '@/lib/automatizaciones-del-lead-reglas';
import { textoEsperaToque } from '@/lib/botones-social';

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
  // Sin «paso N» (24/10/2026): el número es el de la tarjeta en el lienzo. Lo que espera, en palabras (`pasoEnPalabras`).
  // Sólo en curso: a quien contestó no le espera nada (y su posición queda en la entrada: «La entrada» no dice nada).
  const paso = a.estado === 'activa' && a.paso?.titulo ? ` · ${a.paso.titulo}` : '';
  const nota = a.estado === 'respondio' ? ' · frenada: respondió' : !a.automatizacionActiva ? ' · la automatización está en pausa'
    : a.frenado ? ` · ${a.frenado.texto}` : '';
  return `«${a.nombre}»${paso}${nota}`;
}

/**
 * Lo que dice la ficha de cada una: la respuesta, la pausa, por qué no le sale (en palabras: nunca silencio) o cuándo sale
 * lo próximo. `fecha` formatea la hora del próximo (la ficha la dice en la hora del navegador).
 */
export function estadoDeAutomatizacion(a: EnAutomatizacion, fecha: (iso: string) => string): string {
  if (a.estado === 'respondio') return 'Frenada: respondió';
  if (!a.automatizacionActiva) return 'La automatización está en pausa';
  if (a.frenado) return a.frenado.texto;
  // Parado en un DM con botones (25/10/2026): no «Corriendo», que es lo que se leía de alguien quieto hasta que toque.
  if (a.esperaToque?.length) return textoEsperaToque(a.esperaToque);
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

/**
 * La pregunta de «Frenar» antes de hacerlo: NOMBRA a quién y de dónde, y dice que no se deshace. ⚠️ Hasta el 24/10/2026
 * decía «Para que vuelva, se lo inscribe a mano», y era falso: una inscripción frenada queda 'cancelada' y no se reabre, ni
 * a mano (puede ser una baja: lib/nutricion-inscripcion-manual.ts).
 */
export function preguntaDeFrenar(o: { leads: number; nombre?: string | null; auts?: readonly Pick<EnAutomatizacion, 'nombre'>[] }): { titulo: string; mensaje: string } {
  const quien = o.leads === 1 ? (o.nombre?.trim() || 'este lead') : `${o.leads} leads`;
  const donde = o.auts?.length === 1 ? ` en «${o.auts[0].nombre}»` : o.auts && o.auts.length > 1 ? ` en sus ${o.auts.length} automatizaciones` : '';
  return {
    titulo: `¿Frenar a ${quien}${donde}?`,
    mensaje: `No ${o.leads === 1 ? 'le' : 'les'} sale nada más, y no se puede volver a empezar.`,
  };
}

// =============================================================================
// EL BLOQUE «AUTOMATIZACIONES» DE LA FICHA (23/10/2026)
// =============================================================================
// Martín (23/10/2026): «Tal vez sería bueno crear un bloque dentro del detail de cada lead que esté relacionado a las
// automatizaciones, no? Para tener más claridad de lo que pasa... Y que claro, sea editable como el resto de bloques».
// Lo que lo motivó: sacó a su lead de prueba de «Prospección activa», lo volvió a meter para que «Sprint · apertura» le
// escribiera otra vez, y no pasó nada: la automatización entra UNA sola vez y el lead seguía adentro. La ficha mostraba
// la inscripción vieja como si nada.
//
// LA REFERENCIA: la tarjeta «Sequences» del registro de un contacto en HubSpot (y la de «Workflows»): cada secuencia
// con su estado (Activa, En pausa, Terminó, Desinscripto), «Paso 2 de 5», el próximo paso con su fecha, lo enviado con
// su estado (enviado, abierto, rebotó) y las acciones Pausar / Desinscribir. Acá: Frenar y Empezar de nuevo. Encima,
// lo que HubSpot no tiene y Martín necesitaba: POR QUÉ no entró cuando se lo movió.
//
// Lo de abajo es puro (lo ejecuta tests/ficha-automatizaciones.test.ts). Los datos y las acciones son de Automations
// (app/automations/automatizaciones-del-lead-actions.ts): el detalle (`AutomatizacionesDelLead`, `vistaDeDetalle`) y, de
// respaldo, la lista de siempre (`EnAutomatizacion[]`, `vistaDeEnAutomatizacion`).

/**
 * El estado de una inscripción, como lo guarda el motor (`nutricion_inscripciones.estado`). `handoff`: MaKo le pasó la
 * charla a una persona; `pendiente`: está por arrancar. Uno que no se conoce se trata como en curso.
 */
export type EstadoInscripcion = 'activa' | 'respondio' | 'handoff' | 'pendiente' | 'pausada' | 'completada' | 'no_responde' | 'cancelada' | (string & {});
/**
 * Cómo quedó un envío, el de `nutricion_envios.estado` ('enviado', 'fallo', 'saltado', 'omitido', 'borrador', 'accion').
 * ⚠️ NO hay «entregado» ni «leído» por envío (Automations, 23/10/2026): no se inventa.
 */
export type EstadoEnvio = string;
export type EnvioVista = {
  at: string; paso: string | null; canal: string | null; estado: EstadoEnvio; error: string | null;
  /**
   * Qué salió, en palabras de persona («Hola Victor, ya me llegó tu pago…», «Aviso al equipo»; 24/10/2026), y si le llegó al
   * lead ('mensaje') o lo hizo MaKo por detrás ('accion'). null = no se sabe (un envío de un paso que ya no está).
   */
  que?: string | null;
  clase?: 'mensaje' | 'accion' | 'otro' | null;
};
export type InscripcionVista = {
  secuenciaId: number; nombre: string; link: string;
  estado: EstadoInscripcion; automatizacionActiva: boolean;
  paso: { numero: number; titulo: string; total: number | null } | null;
  /**
   * Lo que sale después y cuándo (ISO). `titulo` null = no se sabe qué tarjeta es (sólo la hora). Desde el 24/10/2026
   * `titulo` es lo que DICE, en palabras de persona; `clase` dice si le llega al lead.
   */
  proximo: { at: string | null; titulo: string | null; clase?: 'mensaje' | 'accion' | 'otro' | null } | null;
  /** Cuándo contestó en esta pasada (ISO). null o ausente = no se sabe. */
  contesto?: string | null;
  /** Qué contestó, citado («No hemos mandado pagos…», «un audio»). null o ausente = no se sabe. */
  respuesta?: string | null;
  /** Por qué no le sale (`porQueNoSale`): la frase entera, la corta, y cuándo sale sola si es el horario. */
  frenado: { texto: string; corto: string; saleAt?: string | null } | null;
  /** Parado en un DM esperando que toque uno de estos botones (25/10/2026). */
  esperaToque?: string[] | null;
  termino: { at: string | null; texto: string } | null;
  /** Lo que ya le salió en ESTA inscripción, del más nuevo al más viejo. */
  enviados: EnvioVista[];
  /** `porQueNo`: por qué no se puede empezar de nuevo (frenada, en pausa, con una persona). */
  puede: { frenar: boolean; empezarDeNuevo: boolean; porQueNo?: string };
  /** «Una sola vez», «Otra reunión» o «Cada vez que vuelve a entrar» (null = no se sabe), y su rótulo. */
  reentrada: 'una_vez' | 'otra_reunion' | 'siempre' | null;
  reentradaTexto?: string | null;
};
/** Una vez que se lo movió a una etapa con una automatización y NO entró, con el porqué ya dicho en palabras. */
export type NoEntroVista = { secuenciaId: number; nombre: string; at: string | null; texto: string; motivo?: string | null };

/** El porqué de una vez que no entró, en dos o tres palabras: el renglón del riel («No volvió a entrar · Entra una sola vez»). */
const MOTIVO_NO_ENTRO: Readonly<Record<string, string>> = {
  en_curso: 'Ya está adentro', una_sola_vez: 'Entra una sola vez', cancelada: 'La frenaron', no_termino: 'Todavía no terminó',
  sin_reunion_futura: 'No tiene una reunión por delante', misma_reunion: 'Es la misma reunión',
};
function motivoDeNoEntro(n: { porque?: string | null; texto?: string | null }): string | null {
  const m = n.porque ? MOTIVO_NO_ENTRO[n.porque] : undefined;
  if (m) return m;
  const t = n.texto?.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : null;
}
export type AutomatizacionesVista = { vivas: InscripcionVista[]; terminadas: InscripcionVista[]; noEntro: NoEntroVista[] };

const TERMINADOS: readonly string[] = ['completada', 'no_responde', 'cancelada'];
/** Viva = no terminó (corriendo, por arrancar, en pausa, con una persona o frenada porque contestó). */
export const estaViva = (i: Pick<InscripcionVista, 'estado'>): boolean => !TERMINADOS.includes(i.estado);

/**
 * Lo que no entró, en una frase: «No volvió a entrar a «X»: ya entró una vez y su reentrada es «Una sola vez».». Sin
 * «(va en el paso N)» desde el 24/10/2026: el número es el de la tarjeta en el lienzo, no le dice nada a quien mira el lead.
 */
function fraseNoEntro(n: { nombre: string; texto?: string | null; porque?: string | null }): string {
  if (!n.texto?.trim()) return textoDeNoEntro({ nombre: n.nombre, porque: n.porque ?? '' });
  return `No volvió a entrar a «${n.nombre}»: ${n.texto.trim()}.`;
}

/** Cuántas veces que no entró se dicen: la última de cada automatización, las más nuevas. */
const TOPE_NO_ENTRO = 3;

/**
 * EL DETALLE DE AUTOMATIONS → LA VISTA DEL BLOQUE. Las vivas arriba y las terminadas (30 días) abajo; lo enviado con el paso
 * en palabras; y lo que no entró, la última vez por automatización, con el paso en el que está (lo cruza acá: el `NoEntro`
 * no lo trae, y siempre hay una inscripción, porque sólo no entra quien ya tiene una).
 */
export function vistaDeDetalle(d: AutomatizacionesDelLead): AutomatizacionesVista {
  const inscripciones: InscripcionVista[] = d.inscripciones.map((i) => ({
    secuenciaId: i.secuenciaId, nombre: i.nombre, link: i.link, estado: i.estado, automatizacionActiva: i.automatizacionActiva,
    paso: i.paso,
    // Lo que sale, en palabras (`que`, 24/10/2026); sin eso, el nombre del lienzo de siempre.
    proximo: i.proximo ? { at: i.proximo.at, titulo: i.proximo.que?.que || i.proximo.titulo || null, clase: i.proximo.que?.clase ?? null } : null,
    frenado: i.frenado ? { texto: i.frenado.texto, corto: i.frenado.corto, saleAt: i.frenado.saleAt ?? null } : null,
    termino: i.termino, puede: i.puede, reentrada: i.reentrada, reentradaTexto: i.reentradaTexto,
    contesto: i.contesto ?? null, respuesta: i.respuesta ?? null, esperaToque: i.esperaToque ?? null,
    enviados: i.enviados.map((e) => ({
      at: e.at, paso: e.paso ? `Paso ${e.paso.numero}: ${e.paso.titulo}` : null, canal: e.canal, estado: e.estado, error: e.error,
      que: e.que?.que ?? null, clase: e.que?.clase ?? null,
    })),
  }));
  const vistas = new Set<number>();
  const noEntro: NoEntroVista[] = [];
  for (const n of [...d.noEntro].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))) {
    if (vistas.has(n.secuenciaId) || noEntro.length >= TOPE_NO_ENTRO) continue;
    vistas.add(n.secuenciaId);
    noEntro.push({ secuenciaId: n.secuenciaId, nombre: n.nombre, at: n.at, texto: fraseNoEntro(n), motivo: motivoDeNoEntro(n) });
  }
  return { vivas: inscripciones.filter(estaViva), terminadas: inscripciones.filter((i) => !estaViva(i)), noEntro };
}

/** La lista de siempre (sólo las vivas, sin lo enviado) pasada a la vista del bloque. */
export function vistaDeEnAutomatizacion(auts: readonly EnAutomatizacion[]): AutomatizacionesVista {
  return {
    vivas: auts.map((a) => ({
      secuenciaId: a.secuenciaId, nombre: a.nombre, link: a.link, estado: a.estado, automatizacionActiva: a.automatizacionActiva,
      paso: a.paso ? { ...a.paso, total: null } : null,
      proximo: a.proximoEnvioAt ? { at: a.proximoEnvioAt, titulo: null } : null,
      frenado: a.frenado ? { texto: a.frenado.texto, corto: a.frenado.corto, saleAt: a.frenado.saleAt ?? null } : null,
      esperaToque: a.esperaToque ?? null,
      termino: null, enviados: [],
      // Frenar ya existía; «Empezar de nuevo» espera la acción de Automations (`empezarDeNuevoAction`).
      puede: { frenar: true, empezarDeNuevo: false }, reentrada: null,
    })),
    terminadas: [], noEntro: [],
  };
}

export type TonoChip = 'mako' | 'gris' | 'ok' | 'mal';

/** El chip de estado de una inscripción (el «Active / Paused / Finished» de HubSpot), corto. */
export function chipDeInscripcion(i: InscripcionVista): { texto: string; tono: TonoChip } {
  switch (i.estado) {
    case 'respondio': return { texto: 'Respondió', tono: 'ok' };
    case 'handoff': return { texto: 'Con una persona', tono: 'gris' };
    case 'pendiente': return { texto: 'Por arrancar', tono: 'mako' };
    case 'completada': return { texto: 'Terminó', tono: 'gris' };
    case 'no_responde': return { texto: 'Terminó sin respuesta', tono: 'gris' };
    case 'cancelada': return { texto: 'La frenaron', tono: 'gris' };
    case 'pausada': return { texto: 'En pausa', tono: 'gris' };
  }
  if (!i.automatizacionActiva) return { texto: 'Automatización en pausa', tono: 'gris' };
  if (i.frenado) return { texto: i.frenado.corto, tono: 'gris' };
  if (i.esperaToque?.length) return { texto: 'Espera un toque', tono: 'mako' };
  return { texto: 'Activa', tono: 'mako' };
}

/**
 * UNA FECHA CORTA EN LA ZONA DEL NEGOCIO (24/10/2026): «hoy 18:33», «ayer 16:33», «mañana 09:00»; si no, «vie 24 oct,
 * 09:12». Las tarjetas del bloque hablan de lo de las últimas horas y las que vienen: el día de la semana con «de» y el
 * mes («sáb 24 de oct, 18:33») ocupaba media línea para decir «hoy».
 */
export function fechaCorta(iso: string, tz: string, ahoraMs: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
  const dia = diaCorto(iso, tz, ahoraMs);
  return /^(hoy|ayer|mañana)$/.test(dia) ? `${dia} ${hora}` : `${dia}, ${hora}`;
}

/** El día solo, en la zona del negocio: «hoy», «ayer», «mañana» o «vie 24 oct». Para lo que terminó: la hora sobra. */
export function diaCorto(iso: string, tz: string, ahoraMs: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const delDia = dia(d.getTime());
  if (delDia === dia(ahoraMs)) return 'hoy';
  if (delDia === dia(ahoraMs - 86400_000)) return 'ayer';
  if (delDia === dia(ahoraMs + 86400_000)) return 'mañana';
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(d)
    .replace(/\./g, '').replace(/ de /g, ' ');
}

// =============================================================================
// LA TARJETA, REDISEÑADA (24/10/2026, segunda vuelta)
// =============================================================================
// Martín: «Te pedí que rediseñes la tarjeta, no sólo que cambies el texto, se sigue viendo muy fea». La primera vuelta (la
// mañana del 24) arregló QUÉ dice; ésta, CÓMO se ve. El norte (del Cerebro, con su captura): lo que importa se ve antes de
// leer; una línea de tiempo, no un párrafo; las acciones son acciones y la que destruye va aparte y pregunta; la tarjeta
// se cierra sobre sí misma («Hora de Tijuana» se fue); y varias se distinguen de un vistazo.
// Las referencias (investigadas el 24/10, docs/hallazgos-crm.md): el estado con forma y color adelante del nombre (las
// series de Intercom y los workflows de la ficha de HubSpot), el riel vertical con la hora a la derecha (la actividad de
// Customer.io y Braze), y lo destructivo abajo a la izquierda y en rojo (el modal de WhatsApp del Ops Center).
// Un color, un significado (app/_ui/tokens.ts): dorado = MaKo lo está haciendo; naranja = algo lo traba y hay que mirarlo;
// rojo = falló; verde = contestó o terminó; gris = quieto (en pausa, frenada, con una persona).

/** El tono de una tarjeta, del vocabulario de la casa (`TONO`, app/_ui/tokens.ts). */
export type TonoTarjeta = 'mako' | 'good' | 'warn' | 'bad' | 'neutral';
/** La forma del sello, para que el estado se distinga aunque no se vean los colores. */
export type FormaSello = 'disco' | 'tilde' | 'tilde-suave' | 'cuadro' | 'pausa' | 'persona' | 'aro' | 'reloj' | 'alerta' | 'alerta-llena';
/**
 * Qué clase de freno es, leído de lo que ya dice `porQueNoSale` (lib/por-que-no-sale.ts) sin tocar el motor: `espera` =
 * fuera de horario (sale sola cuando abre), `fila` = un tope de la línea (sale cuando se libere), `traba` = algo del negocio
 * que hay que arreglar (el WhatsApp apagado, sin línea), `fallo` = el último envío falló, `pausa` = la automatización.
 */
export type TipoFreno = 'espera' | 'fila' | 'traba' | 'fallo' | 'pausa';

export function tipoDeFreno(f: { corto: string; saleAt?: string | null }): TipoFreno {
  const c = f.corto.trim();
  if (c === 'Falló al mandar') return 'fallo';
  if (c === 'Tope del día' || c === 'Tope de la hora') return 'fila';
  if (c === 'En pausa') return 'pausa';
  if (c.startsWith('Abre ') || c === 'Fuera de horario' || f.saleAt) return 'espera';
  return 'traba';
}

/** El estado de la tarjeta: la forma y el tono del sello, la línea corta y su cuándo, y el porqué entero (al pasar). */
export type EstadoTarjeta = { forma: FormaSello; tono: TonoTarjeta; texto: string; at: string | null; soloDia: boolean; porque: string | null };

export function estadoDeTarjeta(i: InscripcionVista): EstadoTarjeta {
  const e = (forma: FormaSello, tono: TonoTarjeta, texto: string, at: string | null = null, soloDia = false): EstadoTarjeta =>
    ({ forma, tono, texto, at, soloDia, porque: i.frenado?.texto ?? null });
  switch (i.estado) {
    case 'respondio': return e('tilde', 'good', 'Respondió', i.contesto ?? null);
    case 'handoff': return e('persona', 'neutral', 'Con una persona');
    case 'completada': return e('tilde-suave', 'good', 'Terminó', i.termino?.at ?? null, true);
    case 'no_responde': return e('tilde-suave', 'good', 'Terminó sin respuesta', i.termino?.at ?? null, true);
    case 'cancelada': return e('cuadro', 'neutral', 'Frenada', i.termino?.at ?? null, true);
    case 'pausada': return e('pausa', 'neutral', 'En pausa');
  }
  if (!i.automatizacionActiva) return e('pausa', 'neutral', 'Automatización en pausa');
  if (i.estado === 'pendiente') return e('aro', 'mako', 'Por arrancar');
  if (i.frenado) {
    switch (tipoDeFreno(i.frenado)) {
      case 'espera': return e('reloj', 'mako', 'Fuera de horario');
      case 'fila': return e('reloj', 'mako', i.frenado.corto);
      case 'fallo': return e('alerta-llena', 'bad', 'Falló al mandar');
      case 'pausa': return e('pausa', 'neutral', 'Automatización en pausa');
      default: return e('alerta', 'warn', i.frenado.corto);
    }
  }
  // Parado en un DM con botones (25/10/2026): espera que el lead toque; no está «En curso» de nada.
  if (i.esperaToque?.length) return e('reloj', 'mako', textoEsperaToque(i.esperaToque));
  return e('disco', 'mako', 'En curso');
}

/**
 * Un renglón del riel. `titulo` es corto y de persona («Le salió», «Contestó», «Aviso al equipo»); `cita`, lo que dice el
 * mensaje o la respuesta tal como llegó (ya viene cortada a 70: `LARGO_CITA`); `detalle`, el porqué de un fallo o de lo que
 * no entró. `apagado`: lo próximo que hoy NO sale (en pausa, trabado, en fila), en gris.
 */
export type NodoRiel = {
  tipo: 'mensaje' | 'contesto' | 'fallo' | 'borrador' | 'quieto' | 'noentro' | 'proximo';
  titulo: string; at: string | null; cita: string | null; detalle: string | null; apagado?: boolean;
};
/** El riel de una tarjeta: los renglones a la vista, cuántos quedaron plegados antes, y si no hay nada que contar. */
export type RielTarjeta = { antes: number; nodos: NodoRiel[]; vacio: boolean };

const NOMBRE_ESTADO_ENVIO: Readonly<Record<string, string>> = {
  enviado: 'Enviado', fallo: 'Falló', saltado: 'Se saltó', omitido: 'No salió', borrador: 'Borrador sin mandar', accion: 'Hecho', pendiente: 'Por salir',
};
const nombreDeEstado = (e: string): string => NOMBRE_ESTADO_ENVIO[e] ?? (e ? e[0].toUpperCase() + e.slice(1) : 'Sin estado');

/** Un envío como renglón: el mensaje que le llegó, el que falló (con su error), el borrador, o una acción de MaKo. */
function nodoDeEnvio(e: EnvioVista): NodoRiel {
  const mensaje = e.clase === 'mensaje' ? e.que ?? null : null;
  if (e.estado === 'fallo') {
    return { tipo: 'fallo', titulo: e.clase === 'accion' && e.que ? `${e.que}: no salió` : 'No le salió', at: e.at, cita: mensaje, detalle: e.error };
  }
  if (e.estado === 'borrador') return { tipo: 'borrador', titulo: 'Borrador sin mandar', at: e.at, cita: e.que ?? null, detalle: null };
  if (e.clase === 'mensaje' && (e.estado === 'enviado' || e.estado === 'simulado')) return { tipo: 'mensaje', titulo: 'Le salió', at: e.at, cita: mensaje, detalle: null };
  if (e.clase === 'accion' && e.que) return { tipo: 'quieto', titulo: e.que, at: e.at, cita: null, detalle: null };
  return { tipo: 'quieto', titulo: nombreDeEstado(e.estado), at: e.at, cita: mensaje, detalle: e.error && e.estado !== 'enviado' ? e.error : null };
}

/** Lo que viene, o lo que hoy no sale y por qué en una palabra. null = no hay nada por delante (respondió, terminó…). */
function nodoProximo(i: InscripcionVista, ahoraMs: number): NodoRiel | null {
  if (!estaViva(i) || i.estado === 'respondio' || i.estado === 'handoff' || i.estado === 'pausada') return null;
  const p = i.proximo;
  const cita = p?.clase === 'mensaje' ? p.titulo : null;
  const nodo = (titulo: string, at: string | null, apagado = false): NodoRiel => ({ tipo: 'proximo', titulo, at, cita, detalle: null, ...(apagado ? { apagado } : {}) });
  if (!i.automatizacionActiva) return nodo('En pausa', null, true);
  if (i.frenado) {
    switch (tipoDeFreno(i.frenado)) {
      case 'espera': return nodo('Abre', i.frenado.saleAt ?? null);
      case 'fila': return nodo('En fila', null, true);
      case 'pausa': return nodo('En pausa', null, true);
      case 'fallo': return p?.at && Date.parse(p.at) > ahoraMs ? nodo('Reintenta', p.at) : nodo('No sale', null, true);
      default: return nodo('No sale', null, true);
    }
  }
  if (!p?.at) return null;
  if (i.estado === 'pendiente') return nodo('Arranca', p.at);
  if (p.clase === 'mensaje') return nodo('Le sale', p.at);
  if (p.clase === 'accion' && p.titulo) return nodo(p.titulo, p.at);
  if (p.clase === 'otro') return nodo('Sigue', p.at);
  return nodo(p.titulo || 'Lo próximo', p.at);
}

/** Los renglones que cuentan algo que le LLEGÓ (o tenía que llegarle): desde el penúltimo de éstos se ve sin abrir. */
const FUERTES: ReadonlySet<NodoRiel['tipo']> = new Set(['mensaje', 'fallo', 'borrador']);

/**
 * EL RIEL: lo que pasó del más viejo al más nuevo —lo que le salió (con su cita), lo que contestó (con lo que dijo), lo que
 * falló, las veces que no volvió a entrar— y al final lo que viene. Sin `todo`, lo viejo se pliega: se ve desde el PENÚLTIMO
 * mensaje (el último y el anterior, para leer la conversación), y lo de antes es «Ver N antes». `noEntro` va adentro del
 * riel: es parte de lo que le pasó con ESA automatización.
 */
export function rielDeTarjeta(i: InscripcionVista, noEntro: readonly NoEntroVista[], o: { todo?: boolean; ahoraMs?: number } = {}): RielTarjeta {
  const hechos: NodoRiel[] = [...i.enviados].reverse().map(nodoDeEnvio);
  for (const n of noEntro) {
    if (n.secuenciaId === i.secuenciaId) hechos.push({ tipo: 'noentro', titulo: 'No volvió a entrar', at: n.at, cita: null, detalle: n.motivo ?? null });
  }
  if (i.contesto || i.estado === 'respondio') hechos.push({ tipo: 'contesto', titulo: 'Contestó', at: i.contesto ?? null, cita: i.respuesta ?? null, detalle: null });
  // Del más viejo al más nuevo; lo que no tiene hora, al final (en el orden en que entró).
  const t = (n: NodoRiel) => (n.at ? Date.parse(n.at) : Number.POSITIVE_INFINITY);
  const ordenados = hechos.map((n, k) => ({ n, k })).sort((a, b) => (t(a.n) - t(b.n)) || (a.k - b.k)).map((x) => x.n);
  const fuertes = ordenados.flatMap((n, k) => (FUERTES.has(n.tipo) ? [k] : []));
  const desde = o.todo || fuertes.length < 2 ? (o.todo || !fuertes.length ? 0 : fuertes[0]) : fuertes[fuertes.length - 2];
  const proximo = nodoProximo(i, o.ahoraMs ?? Date.now());
  const nodos = [...ordenados.slice(desde), ...(proximo ? [proximo] : [])];
  return { antes: desde, nodos, vacio: !nodos.length && estaViva(i) && i.estado !== 'respondio' };
}

const RANGO_TONO: Readonly<Record<TonoTarjeta, number>> = { bad: 0, warn: 1, good: 2, mako: 3, neutral: 4 };

/**
 * EL ORDEN DE LAS VIVAS: lo que hay que mirar primero arriba (lo que falló, lo trabado, quien contestó), después lo que MaKo
 * está haciendo por lo que sale antes, y lo quieto al final. Estable: dentro de lo mismo, el orden del server.
 */
export function ordenarTarjetas(vivas: readonly InscripcionVista[]): InscripcionVista[] {
  const sale = (i: InscripcionVista) => (i.proximo?.at ? Date.parse(i.proximo.at) : Number.POSITIVE_INFINITY);
  return vivas.map((i, k) => ({ i, k, tono: estadoDeTarjeta(i).tono }))
    .sort((a, b) => (RANGO_TONO[a.tono] - RANGO_TONO[b.tono]) || (a.tono === 'mako' ? sale(a.i) - sale(b.i) : 0) || (a.k - b.k))
    .map((x) => x.i);
}

/** El primer nombre, para las preguntas. Local a propósito: `primerNombre` vive en lib/automatizaciones-del-lead-reglas.ts, que
 * importa el grafo del motor, y esta vista corre en el navegador. */
const primerNombreDe = (n: string | null | undefined): string | null => (n ?? '').trim().split(/\s+/)[0] || null;

/**
 * La pregunta antes de «Frenar» EN LA FICHA: nombra la automatización y dice la verdad. Una inscripción frenada queda
 * 'cancelada' y no se vuelve a abrir, ni a mano ni sola (puede ser una baja: lib/nutricion-inscripcion-manual.ts).
 */
export function preguntaDeFrenarEnFicha(o: { nombre?: string | null; aut: Pick<InscripcionVista, 'nombre'> }): { titulo: string; mensaje: string } {
  const quien = primerNombreDe(o.nombre);
  return {
    titulo: `Frenar «${o.aut.nombre}»`,
    mensaje: `${quien ? `A ${quien} no` : 'No'} le sale nada más, y no se puede volver a empezar.`,
  };
}

/** La pregunta antes de «Empezar de nuevo»: que le vuelve a salir todo desde el principio. */
export function preguntaDeEmpezarDeNuevo(o: { nombre?: string | null; aut: Pick<InscripcionVista, 'nombre' | 'estado'> }): { titulo: string; mensaje: string } {
  const quien = primerNombreDe(o.nombre);
  return {
    titulo: `Empezar de nuevo «${o.aut.nombre}»`,
    mensaje: `${quien ? `A ${quien} le` : 'Le'} vuelve a salir todo desde el principio.`,
  };
}

/** El texto de una vez que no entró, si viene sin decir (el respaldo: nunca una línea vacía). */
export function textoDeNoEntro(o: { nombre: string; porque: string; paso?: { numero: number } | null }): string {
  switch (o.porque) {
    case 'en_curso': return `No volvió a empezar «${o.nombre}»: ya está adentro.`;
    case 'una_sola_vez': return `No volvió a entrar a «${o.nombre}»: entra una sola vez.`;
    case 'cancelada': return `No volvió a entrar a «${o.nombre}»: la frenaron y no vuelve sola.`;
    default: return `No entró a «${o.nombre}».`;
  }
}

/** Lo que dice el bloque en una línea (el diseño «Una línea»): las vivas con su estado; sin vivas, la última terminada. */
export function lineaDelBloque(v: AutomatizacionesVista): string {
  // Sin «paso N» (24/10/2026): el número es el de la tarjeta en el lienzo, que cuenta la entrada, las esperas y las
  // condiciones («paso 5 de 9» de un lead al que le salieron 2 mensajes). No le dice nada a quien mira la ficha.
  if (v.vivas.length) return v.vivas.map((i) => `${i.nombre} (${chipDeInscripcion(i).texto})`).join(' · ');
  const t = v.terminadas[0];
  return t ? `${t.nombre} (${chipDeInscripcion(t).texto})` : '';
}

/** ¿Hay algo que mostrar? Sin vivas, terminadas ni «no entró», el bloque se calla. */
export const vistaVacia = (v: AutomatizacionesVista): boolean => !v.vivas.length && !v.terminadas.length && !v.noEntro.length;

/**
 * LO QUE NO ENTRÓ AL MOVERLO, de la respuesta del movimiento (23/10/2026): `setLeadStageAction`, `completeStageMoveAction`
 * y «¿Qué hacer ahora?» suman `automatizaciones.noEntro` (lo arma Automations: `enrolarPorEvento` ya no hace `continue` en
 * silencio). El toast del tablero lo dice al lado de «Martin Koncke → Prospección activa»: «No volvió a empezar «Sprint ·
 * apertura»: ya está adentro (paso 2).». Lee la respuesta sin suponer la forma: una respuesta sin el campo es «nada».
 */
export function noEntroDelMovimiento(r: unknown): string[] {
  const lista = (r as { automatizaciones?: { noEntro?: unknown } } | null | undefined)?.automatizaciones?.noEntro;
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((x) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as { texto?: unknown; nombre?: unknown; porque?: unknown };
    const texto = typeof o.texto === 'string' ? o.texto : null;
    // El `texto` de Automations es el motivo SIN el nombre: con el nombre, la frase entera.
    if (typeof o.nombre === 'string') return [fraseNoEntro({ nombre: o.nombre, texto, porque: typeof o.porque === 'string' ? o.porque : null })];
    return texto?.trim() ? [texto.trim()] : [];
  });
}
