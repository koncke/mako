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

import type { EnAutomatizacion } from '@/lib/automatizaciones-del-lead-reglas';

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
  const paso = a.paso ? `paso ${a.paso.numero}: ${a.paso.titulo}` : 'paso sin ubicar';
  const nota = a.estado === 'respondio' ? ' · frenada: respondió' : !a.automatizacionActiva ? ' · la automatización está en pausa'
    : a.frenado ? ` · ${a.frenado.texto}` : '';
  return `«${a.nombre}» · ${paso}${nota}`;
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
// (app/automations/automatizaciones-del-lead-actions.ts); la vista sale de lo que haya: la lista de siempre
// (`EnAutomatizacion[]`) o el detalle, cuando llega.

/** El estado de una inscripción, como lo guarda el motor (`nutricion_inscripciones.estado`). */
export type EstadoInscripcion = 'activa' | 'respondio' | 'pausada' | 'completada' | 'no_responde' | 'cancelada';
/** Cómo quedó un envío: lo que dice la línea (WhatsApp) o el proveedor (email). */
export type EstadoEnvio = 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallo';
export type EnvioVista = { at: string; paso: string | null; canal: string | null; estado: EstadoEnvio; error: string | null };
export type InscripcionVista = {
  secuenciaId: number; nombre: string; link: string;
  estado: EstadoInscripcion; automatizacionActiva: boolean;
  paso: { numero: number; titulo: string; total: number | null } | null;
  /** Lo que sale después y cuándo (ISO). `titulo` null = no se sabe qué tarjeta es (sólo la hora). */
  proximo: { at: string | null; titulo: string | null } | null;
  frenado: { texto: string; corto: string } | null;
  termino: { at: string | null; texto: string } | null;
  /** Lo que ya le salió en ESTA inscripción, del más nuevo al más viejo. */
  enviados: EnvioVista[];
  puede: { frenar: boolean; empezarDeNuevo: boolean };
  /** «Una sola vez» o «Cada vez que vuelve a entrar» (null = no se sabe). */
  reentrada: 'una_vez' | 'siempre' | null;
};
/** Una vez que se lo movió a una etapa con una automatización y NO entró, con el porqué ya dicho en palabras. */
export type NoEntroVista = { secuenciaId: number; nombre: string; at: string | null; texto: string };
export type AutomatizacionesVista = { vivas: InscripcionVista[]; terminadas: InscripcionVista[]; noEntro: NoEntroVista[] };

const VIVOS: readonly EstadoInscripcion[] = ['activa', 'respondio', 'pausada'];
export const estaViva = (i: Pick<InscripcionVista, 'estado'>): boolean => VIVOS.includes(i.estado);

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
  if (i.estado === 'pausada') return 'En pausa: no le sale nada hasta que se reanude.';
  if (!i.automatizacionActiva) return 'La automatización está en pausa: el lead quedó en su paso y no le sale nada hasta que se active.';
  if (i.frenado) return i.frenado.texto;
  if (!i.proximo?.at) return 'Esperando: no hay nada agendado.';
  return `Lo próximo${i.proximo.titulo ? `: ${i.proximo.titulo}` : ''} · ${fecha(i.proximo.at)}`;
}

const NOMBRE_ESTADO_ENVIO: Record<EstadoEnvio, string> = { pendiente: 'Por salir', enviado: 'Enviado', entregado: 'Entregado', leido: 'Leído', fallo: 'Falló' };
const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', sms: 'SMS' };

/** Un envío: «Entregado · WhatsApp · 23 oct, 09:00» o «Falló: el número no tiene WhatsApp · …». */
export function lineaDelEnvio(e: EnvioVista, fecha: (iso: string) => string): { texto: string; tono: TonoChip } {
  const canal = e.canal ? ` · ${NOMBRE_CANAL[e.canal] ?? e.canal}` : '';
  const estado = e.estado === 'fallo' && e.error ? `Falló: ${e.error}` : NOMBRE_ESTADO_ENVIO[e.estado];
  return { texto: `${estado}${canal} · ${fecha(e.at)}`, tono: e.estado === 'fallo' ? 'mal' : e.estado === 'pendiente' ? 'gris' : 'ok' };
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
    case 'en_curso': return `No volvió a empezar «${o.nombre}»: ya está adentro${o.paso ? ` (paso ${o.paso.numero})` : ''}.`;
    case 'una_sola_vez': return `No volvió a entrar a «${o.nombre}»: entra una sola vez.`;
    case 'cancelada': return `No volvió a entrar a «${o.nombre}»: la frenaron y no vuelve sola.`;
    default: return `No entró a «${o.nombre}».`;
  }
}

/** Lo que dice el bloque en una línea (el diseño «Una línea»): las vivas con su estado; sin vivas, la última terminada. */
export function lineaDelBloque(v: AutomatizacionesVista): string {
  if (v.vivas.length) return v.vivas.map((i) => `${i.nombre} (${chipDeInscripcion(i).texto}${i.paso ? `, paso ${i.paso.numero}` : ''})`).join(' · ');
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
    const o = x as { texto?: unknown; nombre?: unknown; porque?: unknown; paso?: { numero?: unknown } | null };
    if (typeof o.texto === 'string' && o.texto.trim()) return [o.texto.trim()];
    if (typeof o.nombre !== 'string') return [];
    const n = o.paso && typeof o.paso.numero === 'number' ? { numero: o.paso.numero } : null;
    return [textoDeNoEntro({ nombre: o.nombre, porque: typeof o.porque === 'string' ? o.porque : '', paso: n })];
  });
}
