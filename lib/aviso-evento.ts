// =============================================================================
// aviso-evento — «MaKo en WhatsApp» como automatización: el EMISOR de un evento de MaKo (puro, con test)
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «Te pedí que la parte de WhatsApp de MaKo sea exactamente igual y
// siguen muchas cosas diferentes... Todo ahora es lo mismo... Las tarjetas cambian, cambia el CRON, cambia la
// tarjeta de "MaKo en WhatsApp" cambia todo, y NO debería... debe ser IDENTICO». El diseño entero, con el
// porqué de cada decisión, en docs/diseno-mako-en-whatsapp-unificado.md (§1 y §2 son lo de acá).
//
// QUÉ ES: tres avisos del catálogo que hasta hoy salían solos («MaKo en WhatsApp» de cada negocio) pasan a
// salir SÓLO por las automatizaciones que el negocio agrega desde la galería. Cada una es una fila de
// `nutricion_secuencias` con el CRON «Evento de MaKo» (`TRIGGER_AVISO_MAKO`) y CUÁL evento en
// `disparadores[0].subtipo` (`EVENTOS_MAKO`, lib/disparadores.ts). Decisión de Martín: «Todos arrancan
// vacíos» — sin fila, el aviso NO sale.
//
// CÓMO SALE: el código de cada aviso sigue llamando a `emitirDelCatalogo` como siempre (el `tipo` sigue siendo
// el id del aviso: de él cuelgan el dedup, el rótulo y el feed), y esa puerta desvía estos tres acá
// (`emitirPorEvento`) ANTES de leer el store. Por cada fila prendida, sus tarjetas se traducen a los pasos del
// runner de los flujos (`pasosDelEvento`) y corren ahí (`ejecutarPasos`, lib/flujos.ts): DELAY y CONDITION
// incluidos, con su corrida dormida en `flujo_corridas`.
//
// ⚠️ PURO, A PROPÓSITO: la base, el envío y el runner entran por parámetro (`DepsEvento`), como en
// lib/plantilla-crear.ts, y los enchufa lib/avisos.ts con import dinámico (avisos → flujos → avisos es un
// ciclo). Así tests/aviso-evento.test.ts ejecuta el emisor entero con una base de mentira. Los imports de
// lib/avisos, lib/flujos y lib/perfil son SÓLO de tipos: se borran al compilar.

import type { EmitirAvisoInput, EmitirAvisoResult } from './avisos';
import type { CtxFlujo } from './flujos';
import type { EstadoAviso } from './perfil';
import type { Paso } from './flujos-tipos';
import { EVENTOS_MAKO, TRIGGER_AVISO_MAKO, disparadoresDe, type SubtipoMako, type EventoMako } from './disparadores';
import { claseDe, idDe, indicePorId, raicesSalida, siguienteDe, type PasoGrafo } from './flujo-grafo';
import { OP_AVISAR } from './flujo-legado';
import { DELAY_MAX_HORAS, QUE_ENVEJECEN } from './flujo-pasos';
import { CLAVE_MENSAJE_MAKO, type ContextoDatos } from './variables-aviso';
import { textoLoArmaElCodigo, type AvisoCatalogo } from './avisos-catalogo';
// Puro: la tarjeta «MaKo en WhatsApp» por partes (undécima tanda). Qué partes tiene y si sale tal cual.
import { esTarjetaTalCual, partesDeMako, textoDePartes } from './mako-tarjeta';

// ── Qué aviso es qué evento ─────────────────────────────────────────────────────────────────────

/** Los avisos que salen por un evento de MaKo (y sólo por ahí). Salen de `EVENTOS_MAKO`: una tabla, un lugar. */
export const AVISOS_POR_EVENTO: ReadonlySet<string> = new Set(EVENTOS_MAKO.map((e) => e.aviso));

const porSubtipo = (sub: unknown): EventoMako | null => EVENTOS_MAKO.find((e) => e.subtipo === sub) ?? null;

/** El evento de un aviso (`cuota-vencida` → `cuota_vencida`), o null si no es de los tres. */
export const eventoDeAviso = (avisoId: string): SubtipoMako | null => EVENTOS_MAKO.find((e) => e.aviso === avisoId)?.subtipo ?? null;

/** El aviso que emite un evento (`cuota_vencida` → `cuota-vencida`), o null. */
export const avisoDeEvento = (sub: unknown): string | null => porSubtipo(sub)?.aviso ?? null;

/** El evento de una FILA (su primer CRON), o null si no es un evento de MaKo o no tiene uno que exista. */
export function eventoDeFila(fila: { trigger_tipo: string; disparadores?: unknown } | null | undefined): SubtipoMako | null {
  if (!fila || fila.trigger_tipo !== TRIGGER_AVISO_MAKO) return null;
  return porSubtipo(disparadoresDe({ trigger_tipo: fila.trigger_tipo, disparadores: fila.disparadores })[0]?.subtipo)?.subtipo ?? null;
}

/** ¿El evento trae el texto que arma el código del aviso? (`{{mensaje_mako}}`). Sale del catálogo: `textoDelCodigo`. */
const conMensaje = (ev: EventoMako): boolean => ev.trae.includes('mensaje') && textoLoArmaElCodigo(ev.aviso);

/**
 * LOS DATOS DEL «{ }» EN UNA FILA DE EVENTO: el lead siempre (lo traen los tres desde el 11/10/2026), la cuota
 * en la cobranza y «Lo que arma MaKo» en los dos cuyo texto lo arma el código. Al EQUIPO (es su grupo). Lo
 * usa el lienzo (`EditorMako`) en vez de los datos de siempre. Desde la undécima tanda, además, el PAGO en
 * «Entra un pago» y lo que ESCRIBIÓ el lead en la charla (`trae`, lib/disparadores.ts). Es el mismo contexto
 * con el que Publicar valida (`problemasDeTokens`, lib/tokens-del-flujo.ts).
 */
export function datosDelEvento(sub: unknown): ContextoDatos {
  const ev = porSubtipo(sub);
  if (!ev) return { conLead: false, destino: 'equipo' };
  return {
    conLead: ev.trae.includes('lead'), conCuota: ev.trae.includes('cuota'), conMensaje: conMensaje(ev),
    conPago: ev.trae.includes('pago'), conEscrito: ev.trae.includes('escrito'), conAnalisis: ev.trae.includes('analisis'), destino: 'equipo',
  };
}

// ── Las tarjetas, traducidas al runner de los flujos ────────────────────────────────────────────

/**
 * `firma`: QUÉ TARJETA ES CADA PASO (sus ids y su clase, en orden: `mk_entrada:mensaje>mk_e48:esperar>…`).
 *
 * ⚠️ EXISTE PORQUE UNA CORRIDA DORMIDA GUARDA UNA POSICIÓN, NO UNA TARJETA (revisión del 11/10/2026). `flujo_corridas.paso`
 * es un índice sobre los pasos traducidos, y `retomarCorrida` lo aplica sobre los pasos de AHORA: si mientras dormía en el
 * DELAY de 48 h el negocio publicó una CONDITION delante de la entrada, el índice 1 pasaba a ser la ENTRADA y salía otra
 * vez al grupo (con `{{cuota_dias}}` crudo, porque la corrida duerme sin él) y la cadencia se corría 48 h. Medido con el
 * repro del revisor: «ejecutar 💸 *Cobranza*: la cuota…». Con la firma guardada en la corrida (`CtxFlujo.firma`), una
 * fila que cambió de FORMA corta la corrida (`pasosParaRetomar`); una que sólo cambió un TEXTO, un DELAY o una condición
 * en su lugar sigue con lo de ahora, que es lo publicado. Vacía cuando hay `problema`.
 */
export type TraduccionEvento = { pasos: Paso[]; problema: string | null; tarjeta: string | null; firma: string };

const RE_MENSAJE_MAKO = new RegExp(`\\{\\{${CLAVE_MENSAJE_MAKO}\\}\\}`, 'i');
const RE_QUE_ENVEJECE = new RegExp(`\\{\\{(${QUE_ENVEJECEN.join('|')})\\}\\}`, 'i');

/** Los motivos, cortos: los dice el lienzo al lado de la tarjeta y `setSecuenciaPasos` los contesta 400. */
export const MOTIVO_EVENTO = {
  sinEvento: 'Elige el evento de MaKo.',
  sinMako: 'Falta la tarjeta «MaKo en WhatsApp».',
  noExiste: 'Una flecha lleva a una tarjeta que no existe.',
  alLead: 'Un evento de MaKo no le escribe al lead: sólo va «MaKo en WhatsApp».',
  accion: 'Una ⚡ Acción no corre en un evento de MaKo.',
  respuesta: '«Si responde» y el AI Step no van en un evento de MaKo.',
  irA: '«Ir a» no va en un evento de MaKo.',
  paralelo: 'Un evento de MaKo va en una sola fila, sin flechas en paralelo.',
  delayReunion: 'El DELAY de un evento de MaKo es por tiempo.',
  delayTope: 'El DELAY va de un minuto a 30 días.',
  condicion: 'La CONDITION de un evento tiene una salida: «Sí» sigue y «Si no» termina.',
  makoVacia: 'La tarjeta «MaKo en WhatsApp» está vacía.',
  sinMensaje: 'Este evento no trae «Lo que arma MaKo».',
  envejece: 'Después de un DELAY no va «Hace cuánto venció»: diría el de ese día.',
  mensajeViejo: 'Después de un DELAY no va «Lo que arma MaKo»: es el de ese momento.',
  vuelta: 'Un evento de MaKo no vuelve atrás.',
  afuera: 'Hay tarjetas que no salen: conéctalas o bórralas.',
} as const;

/**
 * LAS TARJETAS DE UNA FILA DE EVENTO, EN LOS PASOS DEL RUNNER DE LOS FLUJOS (`Paso`, lib/flujos-tipos.ts), o
 * qué le falta. Recorre UNA fila desde la raíz de la salida (`raicesSalida`), como el recordatorio
 * (`toquesDeLaAutomatizacion`, lib/recordatorio-automatizacion.ts):
 *   · «MaKo en WhatsApp» (`avisar_al_equipo`) → `{ tipo: 'mensaje', canal: 'aviso_dueno', texto }`, y con su lista
 *     (`params.partes`, la tarjeta TAL CUAL de la undécima) además `partes`;
 *   · DELAY por tiempo → `{ tipo: 'esperar', horas }`, hasta 30 días (`DELAY_MAX_HORAS`);
 *   · CONDITION de UNA rama, con «Si no» vacío → `{ tipo: 'condicion', rama }`: se cumple, sigue; no, termina.
 * Todo lo demás se rechaza con su tarjeta (`MOTIVO_EVENTO`): el runner no le escribe al lead, no corre una
 * acción ni una IA, no salta y no tiene hilos. Es la regla de la casa: sólo se dibuja lo que el motor EJECUTA.
 */
export function pasosDelEvento(pasosIn: readonly PasoGrafo[], evento: unknown): TraduccionEvento {
  const pasos: Paso[] = [];
  /** Qué tarjeta es cada paso de `pasos`, en el mismo orden: de acá sale la `firma`. */
  const huella: string[] = [];
  const mal = (problema: string, tarjeta: string | null): TraduccionEvento => ({ pasos: [], problema, tarjeta, firma: '' });
  const ev = porSubtipo(evento);
  if (!ev) return mal(MOTIVO_EVENTO.sinEvento, null);

  // Lo que no va, esté donde esté (conectado o suelto): el motivo dice QUÉ es, no sólo que sobra.
  for (let i = 0; i < pasosIn.length; i++) {
    const p = pasosIn[i];
    const id = idDe(p, i);
    const clase = claseDe(p);
    if (clase === 'mensaje') return mal(MOTIVO_EVENTO.alLead, id);
    if (clase === 'respuesta') return mal(MOTIVO_EVENTO.respuesta, id);
    if (clase === 'ir_a') return mal(MOTIVO_EVENTO.irA, id);
    if (clase === 'accion' && (p.accion as { operacion?: unknown } | null)?.operacion !== OP_AVISAR) return mal(MOTIVO_EVENTO.accion, id);
    if (Array.isArray(p.paralelos) && p.paralelos.length) return mal(MOTIVO_EVENTO.paralelo, clase === 'inicio' ? null : id);
  }
  const raices = raicesSalida(pasosIn);
  if (raices.length > 1) return mal(MOTIVO_EVENTO.paralelo, null);

  const vistos = new Set<string>();
  let huboDelay = false;
  let makos = 0;
  let cur: string | null = raices[0] ?? null;
  while (cur) {
    if (vistos.has(cur)) return mal(MOTIVO_EVENTO.vuelta, cur);
    const i = indicePorId(pasosIn, cur);
    if (i < 0) return mal(MOTIVO_EVENTO.noExiste, null);
    vistos.add(cur);
    const p = pasosIn[i];
    const clase = claseDe(p);
    if (clase === 'accion') {
      const params = (p.accion as { params?: Record<string, unknown> } | null)?.params;
      // ⚠️ UNDÉCIMA TANDA (decisión 2 de la décima): la tarjeta puede guardar su lista (`params.partes`, la misma que
      // un WhatsApp: textos, la Voz de MaKo, archivos). Con ella sale TAL CUAL y POR PARTES (`emitirTarjetaDelEvento`,
      // lib/flujos.ts); `texto` es su espejo (el feed). Vacía —sin ninguna parte— sigue siendo `makoVacia`. Lo que se
      // revisa abajo es TODO lo escrito (cada texto y cada pie), no el espejo, que se recorta.
      const talCual = esTarjetaTalCual(params);
      const lista = partesDeMako(params);
      if (!lista.length) return mal(MOTIVO_EVENTO.makoVacia, cur);
      const texto = talCual ? textoDePartes(lista) : String(params?.mensaje ?? '').trim();
      const escrito = talCual ? lista.flatMap((x) => (x.tipo === 'audio' ? [] : [x.cuerpo ?? ''])).join('\n') : texto;
      if (RE_MENSAJE_MAKO.test(escrito) && !conMensaje(ev)) return mal(MOTIVO_EVENTO.sinMensaje, cur);
      if (huboDelay && RE_QUE_ENVEJECE.test(escrito)) return mal(MOTIVO_EVENTO.envejece, cur);
      // ⚠️ «LO QUE ARMA MAKO» TAMBIÉN ES UNA FOTO (revisión del 11/10/2026). Es un mensaje entero redactado por el
      // código en el momento del evento («⏰ En 30 min tienes la R1…»), y viaja dormido en la corrida (`ctx.texto`):
      // después de un DELAY de una hora salía tal cual, con la reunión ya empezada. No es un dato que se pueda
      // recalcular al despertar (lo arma el llamador, no la corrida), así que no va después de un DELAY en NINGÚN
      // evento: la charla («No le preparé respuesta…») también puede haber dejado de ser cierta. Un recordatorio
      // posterior se escribe con los datos estables («{{lead_nombre}}», «{{link_lead}}»).
      if (huboDelay && RE_MENSAJE_MAKO.test(escrito)) return mal(MOTIVO_EVENTO.mensajeViejo, cur);
      // La de ANTES (sin lista) sale EXACTAMENTE como hasta hoy: el paso no lleva `partes`.
      pasos.push(talCual ? { tipo: 'mensaje', canal: 'aviso_dueno', texto, partes: lista } : { tipo: 'mensaje', canal: 'aviso_dueno', texto });
      huella.push(`${cur}:mensaje`);
      makos += 1;
      cur = siguienteDe(pasosIn, i);
    } else if (clase === 'esperar') {
      if (p.espera?.modo !== 'tiempo') return mal(MOTIVO_EVENTO.delayReunion, cur);
      const horas = Number(p.espera.minutos) / 60;
      if (!Number.isFinite(horas) || horas <= 0 || horas > DELAY_MAX_HORAS) return mal(MOTIVO_EVENTO.delayTope, cur);
      pasos.push({ tipo: 'esperar', horas });
      huella.push(`${cur}:esperar`);
      huboDelay = true;
      cur = siguienteDe(pasosIn, i);
    } else if (clase === 'condicion') {
      const ramas = p.ramas ?? [];
      if (ramas.length !== 1 || p.si_no) return mal(MOTIVO_EVENTO.condicion, cur);
      if (ramas[0].paralelos?.length || p.paralelos_si_no?.length) return mal(MOTIVO_EVENTO.paralelo, cur);
      pasos.push({ tipo: 'condicion', rama: ramas[0] });
      huella.push(`${cur}:condicion`);
      cur = ramas[0].siguiente ?? null;
    } else {
      // El inicio no se recorre (la raíz ya lo saltea) y lo demás se rechazó arriba: llegar acá es un
      // grafo que no se entiende, y no se adivina.
      return mal(MOTIVO_EVENTO.noExiste, cur);
    }
  }
  if (!makos) return mal(MOTIVO_EVENTO.sinMako, null);
  const afuera = pasosIn.map((p, i) => idDe(p, i)).filter((id, i) => !vistos.has(id) && claseDe(pasosIn[i]) !== 'inicio');
  if (afuera.length) return mal(MOTIVO_EVENTO.afuera, afuera[0]);
  return { pasos, problema: null, tarjeta: null, firma: huella.join('>') };
}

/** Lo que `retomarCorrida` (lib/flujos.ts) relee de la fila de una corrida dormida. */
export type FilaParaRetomar = { activa: boolean | null; archivada_at: string | null; pasos: unknown; trigger_tipo: string; disparadores?: unknown };

/**
 * ¿CON QUÉ PASOS SIGUE UNA CORRIDA DORMIDA DE UNA FILA DE EVENTO? Los de AHORA (lo publicado después de dormirse es lo
 * que el negocio quiere que salga), salvo que no se pueda, y entonces se corta con su motivo (para el log):
 *   · la fila no está, está archivada o pausada → `apagada` (lo de siempre con un flujo apagado);
 *   · ya no tiene una forma que el emisor sepa correr → `rota`;
 *   · cambió de FORMA mientras dormía (otra `firma`: se sumó, se sacó o se movió una tarjeta) → `cambio`. El índice
 *     guardado apuntaría a otra tarjeta. Una corrida sin firma (no debería existir: la pone `emitirPorEvento`) también
 *     se corta: sin saber qué tarjeta era, cualquier índice es una adivinanza.
 * Pura, para que tenga test: la lectura de la base vive en lib/flujos.ts.
 */
export function pasosParaRetomar(
  fila: FilaParaRetomar | null, firmaGuardada: unknown,
): { pasos: Paso[] } | { corta: 'apagada' | 'rota' | 'cambio' } {
  if (!fila || fila.archivada_at || fila.activa !== true) return { corta: 'apagada' };
  const t = pasosDelEvento(Array.isArray(fila.pasos) ? (fila.pasos as PasoGrafo[]) : [], eventoDeFila(fila));
  if (t.problema) return { corta: 'rota' };
  if (typeof firmaGuardada !== 'string' || firmaGuardada !== t.firma) return { corta: 'cambio' };
  return { pasos: t.pasos };
}

/**
 * EL FRENO DE UNA FILA DE EVENTO, con la forma del de Publicar (`frenoDelFlujo` / `frenoDelRecordatorio`): el
 * porqué y la tarjeta a abrir. Lo suma el lienzo cuando el CRON es `aviso_mako`, y `setSecuenciaPasos`
 * (lib/nutricion.ts) frena lo mismo en el server: Publicar y Activar.
 */
export function frenoDelEvento(pasos: readonly PasoGrafo[], sub: unknown): { error: string; tarjeta: string | null } | null {
  const r = pasosDelEvento(pasos, sub);
  return r.problema ? { error: r.problema, tarjeta: r.tarjeta } : null;
}

// ── El emisor ───────────────────────────────────────────────────────────────────────────────────

/**
 * EL ESTADO CON QUE EMITE LA TARJETA «MaKo en WhatsApp» de un evento (`EmitirAvisoInput.estado`): por
 * WhatsApp, sin email ni espaciado propio. Presente, `emitirAviso` no lee el store (`estadoAviso`) ni abre
 * una insistencia: de estos tres el store ya no se lee (diseño §2 y §8).
 */
export const ESTADO_EVENTO: EstadoAviso = { activo: true, wa: true, email: false, frecuenciaMin: 0 };
/** Sin una fila prendida: se escribe el feed como un apagado de siempre, y no sale. */
export const APAGADO: EstadoAviso = { activo: false, wa: false, email: false, frecuenciaMin: 0 };

/** Lo que `emitirDelCatalogo` recibe y este emisor usa. `cuotaId` lo pasa la cobranza: corta la corrida al pagar. */
export type OptsEvento = {
  texto?: string; ws?: number; dedupTtlMin?: number; dedupKey?: string;
  lead?: { id: number; nombre?: string | null };
  datos?: Record<string, string>;
  cuotaId?: number;
};

/** Una fila de evento, como la lee el emisor. */
export type FilaEvento = { id: number; nombre: string | null; activa: boolean | null; pasos: unknown; trigger_tipo: string; disparadores?: unknown };

export type DepsEvento = {
  /** Las filas `aviso_mako` sin archivar del negocio, por id. TIRA si no se pudieron leer. */
  leerFilas: (ws: number) => Promise<FilaEvento[]>;
  /** `emitirAviso` (lib/avisos.ts): acá sólo para el apagado. */
  emitirAviso: (a: EmitirAvisoInput) => Promise<EmitirAvisoResult>;
  /** `reclamarEspaciado` (lib/espaciado.ts). */
  reclamar: (ws: number, tipo: string, minutos: number, clave?: string) => Promise<boolean>;
  /** `ejecutarPasos` (lib/flujos.ts) adentro del workspace. */
  correr: (flujoId: string, pasos: Paso[], ws: number, ctx: CtxFlujo) => Promise<void>;
  log?: (m: string) => void;
};

export type ResultadoEvento = EmitirAvisoResult & { filas: number };

/** El id de corrida de una fila de evento (`flujo_corridas.aviso_id`): `retomarCorrida` relee la fila por él. */
export const idCorridaDeFila = (filaId: number): string => `sec:${filaId}`;
/** La fila de un id de corrida `sec:<id>`, o null si la corrida no es de una fila de evento. */
export function filaDeIdCorrida(avisoId: string): number | null {
  const m = /^sec:(\d+)$/.exec(avisoId);
  return m ? Number(m[1]) : null;
}

/**
 * EMITE UN EVENTO DE MAKO: corre las automatizaciones prendidas de ese evento. Lo llama `emitirDelCatalogo`
 * (lib/avisos.ts) para los tres de `AVISOS_POR_EVENTO`, con el `ws` ya resuelto.
 *
 *   1. LEE LAS FILAS. Una lectura que falla → `ok: false`, sin caer al store: «no pude leer» no es «no
 *      tiene». La reunión no marca y reintenta; la cobranza no reclama y reintenta.
 *   2. NINGUNA PRENDIDA (o ninguna que se pueda correr) → el feed como un apagado de siempre, sin reclamar el
 *      dedup (un apagado nunca se dijo), y `deduped: true`: así la cobranza no lo cuenta como entrado.
 *   3. EL DEDUP, UNA VEZ POR EVENTO, con la misma clave de siempre (`mako.aviso.last.<tipo>:<hash>`): las
 *      ventanas vivas el día del deploy siguen valiendo. Cada tarjeta emite después SIN `dedupTtlMin`, así
 *      la segunda fila del mismo evento no la frena la primera.
 *   4. CADA FILA corre sus pasos (`pasosDelEvento`) en el runner; una con problema se saltea con su log.
 */
export async function emitirPorEvento(
  cat: Pick<AvisoCatalogo, 'id' | 'titulo' | 'categoria' | 'semaforo'>,
  ws: number,
  opts: OptsEvento,
  deps: DepsEvento,
): Promise<ResultadoEvento> {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const evento = eventoDeAviso(cat.id);
  if (!evento) return { ok: false, feedId: null, wa: false, deduped: false, filas: 0 };

  let filas: FilaEvento[];
  try {
    filas = await deps.leerFilas(ws);
  } catch (e) {
    log(`[aviso-evento] ${cat.id} (ws ${ws}): no pude leer sus automatizaciones — ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, feedId: null, wa: false, deduped: false, filas: 0 };
  }

  // ⚠️ SE TRADUCE ANTES DE RECLAMAR. Una fila prendida que no se puede correr (Publicar no la deja llegar así,
  // pero la base sí) no puede consumir la ventana del dedup: en la cobranza son 120 días sin ese aviso.
  const corren: Array<{ fila: FilaEvento; pasos: Paso[]; firma: string }> = [];
  for (const fila of filas) {
    if (fila.activa !== true || eventoDeFila(fila) !== evento) continue;
    const t = pasosDelEvento(Array.isArray(fila.pasos) ? (fila.pasos as PasoGrafo[]) : [], evento);
    if (t.problema) { log(`[aviso-evento] ${cat.id} (ws ${ws}): la automatización #${fila.id} no corre — ${t.problema}`); continue; }
    corren.push({ fila, pasos: t.pasos, firma: t.firma });
  }

  if (!corren.length) {
    const r = await deps.emitirAviso({
      tipo: cat.id, titulo: cat.titulo, texto: opts.texto ?? cat.titulo,
      categoria: cat.categoria, semaforo: cat.semaforo, ws, estado: APAGADO,
    });
    return { ...r, ok: true, wa: false, deduped: true, apagado: true, filas: 0 };
  }

  if (opts.dedupTtlMin && !(await deps.reclamar(ws, cat.id, opts.dedupTtlMin, opts.dedupKey))) {
    return { ok: true, feedId: null, wa: false, deduped: true, filas: 0 };
  }

  let n = 0;
  for (const { fila, pasos, firma } of corren) {
    const ctx: CtxFlujo = {
      ws,
      ...(opts.lead ? { leadId: opts.lead.id, ...(opts.lead.nombre ? { leadNombre: opts.lead.nombre } : {}) } : {}),
      ...(opts.cuotaId != null ? { cuotaId: opts.cuotaId } : {}),
      ...(opts.datos ? { datos: opts.datos } : {}),
      ...(opts.texto != null ? { texto: opts.texto } : {}),
      aviso: { id: cat.id, titulo: fila.nombre?.trim() || cat.titulo },
      // Qué tarjeta es cada paso: viaja dormida con la corrida y `retomarCorrida` la compara (`pasosParaRetomar`).
      firma,
    };
    try {
      await deps.correr(idCorridaDeFila(fila.id), pasos, ws, ctx);
      n += 1;
    } catch (e) {
      log(`[aviso-evento] ${cat.id} (ws ${ws}): la automatización #${fila.id} falló — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // El envío lo afirma cada tarjeta (con su feed y su `wa`); ningún llamador de estos tres lee `wa`.
  return { ok: true, feedId: null, wa: false, deduped: false, filas: n };
}
