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

/** La pregunta de «Frenar» antes de hacerlo: NOMBRA a quién y de dónde, y dice que no se deshace. */
export function preguntaDeFrenar(o: { leads: number; nombre?: string | null; auts?: readonly Pick<EnAutomatizacion, 'nombre'>[] }): { titulo: string; mensaje: string } {
  const quien = o.leads === 1 ? (o.nombre?.trim() || 'este lead') : `${o.leads} leads`;
  const donde = o.auts?.length === 1 ? ` en «${o.auts[0].nombre}»` : o.auts && o.auts.length > 1 ? ` en sus ${o.auts.length} automatizaciones` : '';
  return {
    titulo: `¿Frenar a ${quien}${donde}?`,
    mensaje: `No ${o.leads === 1 ? 'le' : 'les'} sale nada más. Para que ${o.leads === 1 ? 'vuelva' : 'vuelvan'}, se ${o.leads === 1 ? 'lo inscribe' : 'los inscribe'} a mano.`,
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
  frenado: { texto: string; corto: string } | null;
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
export type NoEntroVista = { secuenciaId: number; nombre: string; at: string | null; texto: string };
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
    frenado: i.frenado ? { texto: i.frenado.texto, corto: i.frenado.corto } : null,
    termino: i.termino, puede: i.puede, reentrada: i.reentrada, reentradaTexto: i.reentradaTexto,
    contesto: i.contesto ?? null, respuesta: i.respuesta ?? null,
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
    noEntro.push({ secuenciaId: n.secuenciaId, nombre: n.nombre, at: n.at, texto: fraseNoEntro(n) });
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
      frenado: a.frenado ? { texto: a.frenado.texto, corto: a.frenado.corto } : null,
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
  return { texto: 'Activa', tono: 'mako' };
}

/** «Paso 2 de 5: WHATSAPP: Hola…», o sin el total si no se sabe. */
export function lineaDelPaso(i: Pick<InscripcionVista, 'paso'>): string | null {
  if (!i.paso) return null;
  return `Paso ${i.paso.numero}${i.paso.total ? ` de ${i.paso.total}` : ''}: ${i.paso.titulo}`;
}

/**
 * QUÉ SALE DESPUÉS Y CUÁNDO, o por qué no sale. Nunca silencio: si algo lo frena (el horario, la línea, un fallo) lo dice
 * con su porqué; en una que terminó, cómo terminó. `fecha` formatea en la zona del negocio.
 */
export function lineaDelProximo(i: InscripcionVista, fecha: (iso: string) => string): string {
  if (!estaViva(i)) return i.termino?.texto ?? 'Terminó.';
  if (i.estado === 'respondio') return 'Se frenó porque respondió: no le sale nada más de esta automatización.';
  if (i.estado === 'handoff') return 'MaKo le pasó la charla a una persona: la automatización no le escribe más.';
  if (i.estado === 'pausada') return 'En pausa: no le sale nada hasta que se reanude.';
  if (!i.automatizacionActiva) return 'La automatización está en pausa: el lead quedó en su paso y no le sale nada hasta que se active.';
  if (i.frenado) return i.frenado.texto;
  if (!i.proximo?.at) return 'Esperando: no hay nada agendado.';
  // Un mensaje, por lo que dice y cuándo le llega (24/10/2026); lo demás (una espera, una condición) no se le dice al
  // dueño por su nombre de lienzo: sólo cuándo sigue.
  if (i.proximo.clase === 'mensaje' && i.proximo.titulo) return `Le sale ${fecha(i.proximo.at)}: ${i.proximo.titulo}`;
  if (i.proximo.clase === 'accion' && i.proximo.titulo) return `${i.proximo.titulo} · ${fecha(i.proximo.at)}`;
  if (i.proximo.clase === 'otro') return `Sigue ${fecha(i.proximo.at)}`;
  return `Lo próximo${i.proximo.titulo ? `: ${i.proximo.titulo}` : ''} · ${fecha(i.proximo.at)}`;
}

const NOMBRE_ESTADO_ENVIO: Readonly<Record<string, string>> = {
  enviado: 'Enviado', fallo: 'Falló', saltado: 'Se saltó', omitido: 'No salió', borrador: 'Quedó en borrador, sin mandar', accion: 'Hecho', pendiente: 'Por salir',
};
const TONO_ENVIO: Readonly<Record<string, TonoChip>> = { enviado: 'ok', accion: 'ok', fallo: 'mal' };
const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', sms: 'SMS' };

/**
 * Un envío: «Le salió vie 23 oct, 16:33: «Hola Victor, ya me llegó…»», «Aviso al equipo · …» o «No le salió …: el número
 * no tiene WhatsApp». Con lo que DICE (`que`, 24/10/2026); sin eso, como antes («Enviado · WhatsApp · …»).
 */
export function lineaDelEnvio(e: EnvioVista, fecha: (iso: string) => string): { texto: string; tono: TonoChip } {
  if (e.que) {
    const tono = TONO_ENVIO[e.estado] ?? 'gris';
    if (e.estado === 'fallo') return { texto: `No le salió ${e.que} (${fecha(e.at)})${e.error ? `: ${e.error}` : ''}`, tono };
    if (e.clase === 'accion') return { texto: `${e.que} · ${fecha(e.at)}`, tono };
    if (e.estado === 'enviado') return { texto: `Le salió ${fecha(e.at)}: ${e.que}`, tono };
    if (e.estado === 'borrador') return { texto: `Quedó en borrador, sin mandar (${fecha(e.at)}): ${e.que}`, tono };
  }
  const canal = e.canal ? ` · ${NOMBRE_CANAL[e.canal] ?? e.canal}` : '';
  const nombre = NOMBRE_ESTADO_ENVIO[e.estado] ?? (e.estado ? e.estado[0].toUpperCase() + e.estado.slice(1) : 'Sin estado');
  const estado = e.error && e.estado !== 'enviado' && e.estado !== 'accion' ? `${nombre}: ${e.error}` : nombre;
  return { texto: `${estado}${canal} · ${fecha(e.at)}`, tono: TONO_ENVIO[e.estado] ?? 'gris' };
}

/**
 * UNA FECHA CORTA EN LA ZONA DEL NEGOCIO (24/10/2026): «hoy 18:33», «ayer 16:33», «mañana 09:00»; si no, «vie 24 oct,
 * 09:12». Las tarjetas del bloque hablan de lo de las últimas horas y las que vienen: el día de la semana con «de» y el
 * mes («sáb 24 de oct, 18:33») ocupaba media línea para decir «hoy».
 */
export function fechaCorta(iso: string, tz: string, ahoraMs: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
  const delDia = dia(d.getTime());
  if (delDia === dia(ahoraMs)) return `hoy ${hora}`;
  if (delDia === dia(ahoraMs - 86400_000)) return `ayer ${hora}`;
  if (delDia === dia(ahoraMs + 86400_000)) return `mañana ${hora}`;
  const resto = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(d)
    .replace(/\./g, '').replace(/ de /g, ' ');
  return `${resto}, ${hora}`;
}

/**
 * LO QUE DICE UNA TARJETA DEL BLOQUE, EN TRES RENGLONES (24/10/2026, Martín: «está bastante fea... No es funcional,
 * rediseñala bien»). Antes decía el paso con el nombre del lienzo («Paso 5 de 9: CRON») y abajo el historial; para saber
 * qué le había pasado a ese lead había que leerlo entero. Ahora, lo que se pregunta quien abre la ficha, en orden:
 *   1. qué le salió por última vez y cuándo (el MENSAJE que le llegó, citado; si falló, por qué). Sin envíos, lo dice;
 *   2. si contestó, cuándo;
 *   3. qué sigue: qué le sale y cuándo, por qué no le sale (el horario, la pausa), o cómo terminó.
 * El historial entero queda plegado debajo. Ningún renglón queda vacío ni dice «falta»: si no se sabe, no se dice.
 */
export type RenglonTarjeta = { tipo: 'salio' | 'contesto' | 'sigue' | 'frenado' | 'termino'; texto: string; tono: TonoChip };

export function renglonesDeTarjeta(i: InscripcionVista, fecha: (iso: string) => string): RenglonTarjeta[] {
  const out: RenglonTarjeta[] = [];
  // 1. Lo último que le llegó: el último MENSAJE (o el último fallo); una acción sola (el aviso al equipo) no le llega.
  const ultimo = i.enviados.find((e) => e.clase === 'mensaje' || e.estado === 'fallo') ?? i.enviados[0];
  if (ultimo) out.push({ tipo: 'salio', ...lineaDelEnvio(ultimo, fecha) });
  else if (estaViva(i) && i.estado !== 'respondio') out.push({ tipo: 'salio', texto: 'Todavía no le salió nada.', tono: 'gris' });
  // 2. Si contestó.
  if (i.contesto) out.push({ tipo: 'contesto', texto: `Contestó ${fecha(i.contesto)}${i.respuesta ? `: ${i.respuesta}` : ''}`, tono: 'ok' });
  else if (i.estado === 'respondio') out.push({ tipo: 'contesto', texto: 'Contestó.', tono: 'ok' });
  // 3. Qué sigue.
  if (!estaViva(i)) {
    out.push({ tipo: 'termino', texto: `${i.termino?.texto ?? 'Terminó'}${i.termino?.at ? ` · ${fecha(i.termino.at)}` : ''}`, tono: 'gris' });
  } else if (i.estado === 'respondio') {
    out.push({ tipo: 'sigue', texto: 'No le sale nada más de esta automatización.', tono: 'gris' });
  } else {
    const frenada = !!i.frenado || !i.automatizacionActiva || i.estado === 'pausada';
    out.push({ tipo: frenada ? 'frenado' : 'sigue', texto: lineaDelProximo(i, fecha), tono: frenada ? 'gris' : 'mako' });
  }
  return out;
}

/** La pregunta antes de «Empezar de nuevo»: nombra a quién y dónde, y que le vuelve a escribir desde el paso 1. */
export function preguntaDeEmpezarDeNuevo(o: { nombre?: string | null; aut: Pick<InscripcionVista, 'nombre' | 'estado'> }): { titulo: string; mensaje: string } {
  const quien = o.nombre?.trim() || 'este lead';
  const desde = estaViva(o.aut) ? 'Lo saca del paso en el que está y ' : '';
  return {
    titulo: `¿Empezar de nuevo «${o.aut.nombre}» para ${quien}?`,
    mensaje: `${desde}${desde ? 'le' : 'Le'} vuelve a salir todo desde el primer paso, como si recién entrara. Lo que ya le salió queda en el historial.`,
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
