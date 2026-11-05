import 'server-only';

// =============================================================================
// El Centro de Operaciones — la cola y los carteros, del lado del servidor
// =============================================================================
// Las reglas puras (el pedido firmado, los estados, la guarda de plataforma) viven en
// lib/operaciones-reglas.ts; acá sólo se lee y se escribe la base. Las tablas son de la
// PLATAFORMA (mig 0285, sin workspace_id): se leen con el cliente de servicio, y el que llame a
// esto tiene que haber pasado antes por `puedeOperar` (la pantalla) o por el token de los carteros
// (la ruta). Nada de acá mira la cookie.
//
// ⚠️ EL SERVIDOR NO ARMA NI TOCA EL TEXTO FIRMADO. Lo guarda como llegó y lo devuelve como está:
// el cartero entrega lo que dice ese texto, verificado con una clave que este servidor no tiene.
// Si MaKo entera estuviera comprometida, lo peor que puede hacer con la cola es no entregar.
//
// ⚠️ UN PEDIDO SE ENTREGA UNA VEZ. Se reclama con compare-and-set (`estado = 'escrito'` en el
// WHERE) antes de devolvérselo a un cartero; un acuse sólo cuenta sobre un pedido `tomado`, y un
// cierre sólo sobre uno `entregado`. Dos carteros o un reintento no pueden mandar dos veces lo
// mismo — y además cada cartero lleva su registro de lo entregado (scripts/operaciones/).
//
// ⚠️ HAY UN CARTERO POR CUENTA (las tres corren a la vez). Cada uno reclama SÓLO pedidos para los
// chats vivos que él mismo subió en esa vuelta: el de la cuenta 2 no se lleva lo de la 3. Y desde la
// 1.4.0 (16/10/2026), sólo los que dice `entregables`: SendMessage no cruza carpetas de config, así
// que un chat vivo sin un Runner en su carpeta no se reclama (queda escrito hasta que se abra).
//
// ⚠️ EN LA MISMA VUELTA VAN LOS AVISOS DE LA TICKETERA (15/10/2026): cuando Martín contesta una
// tarjeta, el cartero del chat que la preguntó le avisa. Las reglas, en lib/decisiones-aviso.ts. Un
// aviso no lleva texto de la base: el cartero lo arma con el `ref`, así que no necesita firma.
// =============================================================================

import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { AVISO_CLAVE_EN_EL_CENTRO, hayClave } from './claves-en-el-chat';
import {
  CUENTA_RE, DESTINO_NUEVO, POR_VUELTA, TOMADO_VENCE_MS, UUID_RE, claveIdDe, faltaColumnaDeLaVuelta, filaDeLaVuelta, sanearAbre, sanearServicio, vistoDeLaFila, estadoDeCierre, fotosDeFirmado, leerFirmable, nombresDeAdjuntos, vozDeFirmado, sanearAcuses, sanearChats,
  sanearCierres, sanearClaves, sanearEntregables, sanearTurnos, todosLosChats, type ChatCartero, type Cierre, type EstadoPedido, type ServicioPc, type VozDelPedido,
} from './operaciones-reglas';
import { cuentaDeLaSemana, sanearCuota, type Cuota } from './centro-uso';
import { MOTIVO_VENCIO, VENCE_PEDIDO_MS } from './centro-limbo';
import { guardarTurnos } from './centro-turnos-db';
import { guardarTitular } from './centro-titulares-db';
import { guardarPasos } from './centro-pasos-db';
import { after } from 'next/server';
import { anotarTurnosDelPlan, aplicarPlanDeLosChats } from './centro-plan-auto';
import { guardarPreguntas, preguntasParaDecidir } from './centro-preguntas-chat-db';
import { cadenasDeSesiones } from './centro-chats';
import { MOTIVO_IGNORADA, ignoradaQueContesta, preguntaDeTrabajo, sanearPreguntas, type PreguntaChat } from './centro-preguntas-chat';
import { AVISOS_POR_VUELTA, destinoDeDecision, filaAviso, mismoInstante, necesitaAviso } from './decisiones-aviso';
import { borrarAdjuntosDe } from './operaciones-adjuntos';
import { acusarTicket, acusarTicketNuevo, ticketsNuevosParaElCartero, ticketsNuevosSinEntregar, ticketsParaElCartero, ticketsSinEntregar, type TicketNuevoParaEntregar, type TicketParaEntregar } from './tickets-runner';
import { VERSION_CARTERO_TICKETS, VERSION_CARTERO_TICKETS_NUEVOS, esElCerebro, versionAlMenos } from './tickets-aviso';
import { LIMBO_TOPE, VERSION_CARTERO_LIMBO, avisosDeLimbo, type AvisoDeLimbo } from './limbo-al-cerebro';

const T_PEDIDOS = 'operaciones_pedidos';
const T_CARTEROS = 'operaciones_carteros';
const T_TOKEN = 'operaciones_token';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export type Pedido = {
  id: string;
  created_at: string;
  autor: string;
  destino: string;
  destino_cuenta: string | null;
  destino_titulo: string | null;
  texto: string;
  clave_id: string;
  estado: EstadoPedido;
  motivo: string | null;
  tomado_at: string | null;
  entregado_at: string | null;
  cerrado_at: string | null;
  cierre: Cierre | null;
  /** Los nombres de las fotos y los PDF que llevó (17/10/2026), sacados de su texto firmado. */
  adjuntos?: string[];
  /** De esos, los que son fotos (23/10/2026): su miniatura se puede pedir al servidor (lib/operaciones-adjuntos.ts). */
  fotos?: string[];
  /** Lo mandó como nota de voz (26/10/2026): `texto` es su transcripción, y el MP3 se pide al servidor. */
  voz?: VozDelPedido;
};

export type Cartero = {
  cuenta: string;
  /** ⚠️ La última vuelta de un RUNNER (`runner_visto_at`, 30/10/2026): es lo que pregunta todo el que lo lee (`carteroVivo`). */
  vistoAt: string | null;
  /** La última vuelta de cualquiera, también del servicio de la PC (`visto_at`): «¿hay noticias de la PC?» (lib/centro-chats.ts). */
  noticiasAt?: string | null;
  /** Lo que dijo de sí mismo el servicio de la PC en su última vuelta. null = nunca subió, o falta la mig 0355. */
  servicio?: (ServicioPc & { visto_at: string | null }) | null;
  version: string | null;
  chats: ChatCartero[];
  claves: string[];
  /** El Uso de esa cuenta (lib/centro-uso.ts): lo anota la barra de estado de su Runner. null = no midió. */
  cuota: Cuota | null;
};

export type EstadoCarteros = {
  carteros: Cartero[];
  tokenPista: string | null;
  tokenCreadoAt: string | null;
};

const COLS = 'id, created_at, autor, destino, destino_cuenta, destino_titulo, texto, clave_id, estado, motivo, tomado_at, entregado_at, cerrado_at, cierre';

/** La sesión y el texto firmado de un trabajo de la cola, para comprobar que una respuesta salió (las preguntas de los
 *  chats, lib/centro-preguntas-chat.ts). null = no está. */
export async function trabajoDeLaCola(id: string): Promise<{ destino: string; texto: string; estado: string; creado: string; titulo: string | null } | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await getSupabaseServer().from(T_PEDIDOS).select('destino, texto, estado, created_at, destino_titulo').eq('id', id).maybeSingle();
  if (error) throw new Error(`no pude leer el trabajo: ${error.message}`);
  // `estado`, `creado` y `titulo` (17/10/2026): «las más prioritarias» se leen del jefe al que Martín le mandó ESE pedido.
  return data ? { destino: String(data.destino), texto: String(data.texto ?? ''), estado: String(data.estado ?? ''), creado: String(data.created_at ?? ''), titulo: data.destino_titulo ? String(data.destino_titulo) : null } : null;
}

export async function listarPedidos(limite = 100): Promise<Pedido[]> {
  const db = getSupabaseServer();
  const { data: recientes, error } = await db
    .from(T_PEDIDOS).select(`${COLS}, firmado`).order('created_at', { ascending: false }).limit(limite);
  if (error) throw new Error(`no pude leer la cola: ${error.message}`);
  // ⚠️ LOS ÚLTIMOS 100 NO ALCANZAN (30/10/2026): un mensaje que espera un chat cerrado es justo el que se va quedando viejo, y sale
  // de esa ventana sin haber salido nunca. Lo que no se entregó y lo vencido vienen siempre (lib/centro-limbo.ts): son pocos.
  const { data: sinSalir, error: e2 } = await db.from(T_PEDIDOS).select(`${COLS}, firmado`)
    .or(`estado.eq.escrito,and(estado.eq.no_entregado,motivo.eq."${MOTIVO_VENCIO}")`).order('created_at', { ascending: false }).limit(200);
  if (e2) throw new Error(`no pude leer la cola: ${e2.message}`);
  const ya = new Set((recientes ?? []).map((p) => p.id));
  const data = [...(recientes ?? []), ...(sinSalir ?? []).filter((p) => !ya.has(p.id))];
  // El texto firmado no sale de acá: sólo los nombres de sus adjuntos, si tiene, cuáles son fotos, y si fue una nota de voz.
  return data.map(({ firmado, ...p }) => {
    const adjuntos = nombresDeAdjuntos(firmado as string | null);
    const fotos = fotosDeFirmado(firmado as string | null).map((f) => f.nombre);
    const voz = vozDeFirmado(firmado as string | null);
    return { ...p, ...(adjuntos.length ? { adjuntos, ...(fotos.length ? { fotos } : {}) } : {}), ...(voz ? { voz } : {}) } as Pedido;
  });
}

export async function leerCarteros(): Promise<EstadoCarteros> {
  const db = getSupabaseServer();
  const leer = async (cols: string) => {
    const { data, error } = await db.from(T_CARTEROS).select(cols).order('cuenta');
    return { filas: (data ?? []) as unknown as Array<Record<string, unknown>>, error };
  };
  const [primera, { data: tok, error: e2 }] = await Promise.all([
    leer('cuenta, visto_at, runner_visto_at, servicio, version, chats, claves, cuota'),
    db.from(T_TOKEN).select('token_pista, creado_at').eq('id', 1).maybeSingle(),
  ]);
  // Sin la mig 0355 se lee como antes: `vistoDeLaFila` usa `visto_at` para las dos preguntas.
  const { filas, error: e1 } = faltaColumnaDeLaVuelta(primera.error) ? await leer('cuenta, visto_at, version, chats, claves, cuota') : primera;
  if (e1) throw new Error(`no pude leer los carteros: ${e1.message}`);
  if (e2) throw new Error(`no pude leer el token: ${e2.message}`);
  return {
    carteros: filas.map((f) => ({
      cuenta: f.cuenta as string,
      ...vistoDeLaFila(f),
      servicio: f.servicio && typeof f.servicio === 'object' ? (f.servicio as Cartero['servicio']) : null,
      version: (f.version as string | null) ?? null,
      chats: sanearChats(f.chats),
      claves: sanearClaves(f.claves),
      cuota: sanearCuota(f.cuota),
    })),
    tokenPista: tok?.token_pista ?? null,
    tokenCreadoAt: tok?.creado_at ?? null,
  };
}

/** Verifica que `firma` (ECDSA P-256, r||s en base64, como la devuelve WebCrypto) sea de la
 *  clave pública `spkiB64` sobre `texto`. Acá NO decide confianza —eso lo hace el cartero con las
 *  claves que tiene en la PC—: sólo evita guardar un pedido roto que el cartero va a rechazar. */
export function firmaCoincide(texto: string, firmaB64: string, spkiB64: string): boolean {
  try {
    const clave = createPublicKey({ key: Buffer.from(spkiB64, 'base64'), format: 'der', type: 'spki' });
    return verify('sha256', Buffer.from(texto, 'utf8'), { key: clave, dsaEncoding: 'ieee-p1363' }, Buffer.from(firmaB64, 'base64'));
  } catch {
    return false;
  }
}

export const claveIdDeSpki = (spkiB64: string): string =>
  claveIdDe(createHash('sha256').update(Buffer.from(spkiB64, 'base64')).digest('hex'));

export type ResultadoEncolar = { ok: true; id: string } | { ok: false; error: string };

export async function encolarPedido(entrada: {
  firmado: string; firma: string; clavePublica: string; autor: string;
}, ahora = Date.now()): Promise<ResultadoEncolar> {
  const l = leerFirmable(entrada.firmado, ahora);
  if (!l.ok) return { ok: false, error: `Vuelve a mandarlo (${l.motivo}).` };
  // Una clave en el texto no se guarda (22/10/2026): firmado, no se puede tapar, así que no entra. El navegador ya lo frena
  // (mandar.ts); esto es para una pestaña con la versión de antes.
  if (hayClave(l.p.texto)) return { ok: false, error: AVISO_CLAVE_EN_EL_CENTRO };
  if (!firmaCoincide(entrada.firmado, entrada.firma, entrada.clavePublica)) {
    return { ok: false, error: 'Vuelve a mandarlo: la firma no coincide con tu Token.' };
  }
  const { error } = await getSupabaseServer().from(T_PEDIDOS).insert({
    id: l.p.id,
    autor: entrada.autor.slice(0, 200),
    destino: l.p.destino,
    destino_cuenta: l.p.cuenta,
    destino_titulo: l.p.titulo,
    texto: l.p.texto,
    firmado: entrada.firmado,
    firma: entrada.firma,
    clave_id: claveIdDeSpki(entrada.clavePublica),
  });
  if (error) {
    // 23505: el id ya existe. Es el mismo pedido firmado dos veces (doble clic, reintento): no se
    // duplica, y se contesta como lo que es.
    if (error.code === '23505') return { ok: false, error: 'Ya estaba mandado.' };
    return { ok: false, error: `No pude guardarlo, vuelve a mandarlo: ${error.message}` };
  }
  return { ok: true, id: l.p.id };
}

/**
 * Al IGNORAR una pregunta (5/11/2026), la respuesta suya que todavía no salió (contestada en otro dispositivo, o esperando a un chat
 * cerrado) se cancela: no la entrega ningún Runner, y no queda en el cartel de lo que espera. Con compare-and-set: lo que la PC ya
 * tomó salió. Lo que se le escape a esto lo frena igual la vuelta del Runner (`sinRespuestasIgnoradas`). Devuelve cuántas cancela.
 */
export async function cancelarRespuestasDe(local: string, idPregunta: string): Promise<number> {
  const db = getSupabaseServer();
  const { data, error } = await db.from(T_PEDIDOS).select('id, texto').eq('destino', local).eq('estado', 'escrito').limit(200);
  if (error) throw new Error(error.message);
  let n = 0;
  for (const f of data ?? []) {
    if (preguntaDeTrabajo(f.texto as string | null) !== idPregunta) continue;
    const { data: hecho, error: e2 } = await db.from(T_PEDIDOS)
      .update({ estado: 'cancelado', motivo: MOTIVO_IGNORADA, updated_at: new Date().toISOString() })
      .eq('id', f.id as string).eq('estado', 'escrito').select('id');
    if (e2) throw new Error(e2.message);
    n += (hecho ?? []).length;
  }
  return n;
}

/**
 * Lo que una vuelta va a reclamar, sin las respuestas de una pregunta IGNORADA (5/11/2026, Martín: «un botón de ignorar»): ésas se
 * cancelan con su motivo y no llegan al chat. Si no se pueden leer las preguntas de su destino, ese trabajo NO se reclama en esta
 * vuelta (queda escrito y se vuelve a mirar en la siguiente): no entregar es lo único que puede hacer MaKo sin saber. Un trabajo
 * que no contesta una pregunta pasa tal cual, y el orden de entrega es el de siempre (el de la cola).
 */
async function sinRespuestasIgnoradas(cand: ReadonlyArray<{ id: string; destino: string; texto: string | null }>, ahoraIso: string): Promise<string[]> {
  const respuestas = cand.filter((c) => preguntaDeTrabajo(c.texto));
  if (!respuestas.length) return cand.map((c) => c.id);
  let porDestino: Map<string, PreguntaChat[]> | null = null;
  try {
    porDestino = await preguntasParaDecidir(respuestas.map((c) => c.destino));
  } catch (err) {
    console.error('[operaciones] no pude leer las preguntas para entregar sus respuestas:', err instanceof Error ? err.message : err);
  }
  const db = getSupabaseServer();
  const out: string[] = [];
  for (const c of cand) {
    if (!preguntaDeTrabajo(c.texto)) { out.push(c.id); continue; }
    if (!porDestino) continue;
    if (!ignoradaQueContesta(c.texto, porDestino.get(c.destino) ?? [])) { out.push(c.id); continue; }
    const { error } = await db.from(T_PEDIDOS).update({ estado: 'cancelado', motivo: MOTIVO_IGNORADA, updated_at: ahoraIso })
      .eq('id', c.id).eq('estado', 'escrito');
    if (error) console.error('[operaciones] no pude cancelar la respuesta de una ignorada:', error.message);
  }
  return out;
}

/** Sólo un pedido que todavía no tomó un cartero se puede cancelar. Sus adjuntos se borran (no van a bajar). */
export async function cancelarPedido(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from(T_PEDIDOS)
    .update({ estado: 'cancelado', motivo: 'Lo canceló Martín', updated_at: new Date().toISOString() })
    .eq('id', id).eq('estado', 'escrito').select('id, firmado');
  if (error) throw new Error(error.message);
  await borrarAdjuntosDe((data ?? []).map((f) => f.firmado as string | null));
  return (data ?? []).length > 0;
}

/**
 * ¿Ya se puede instalar el servicio de la PC? El orden es migración → deploy → `instalar-servicio` (docs/diseno-cartero-servicio.md §2.6): un
 * servidor sin las columnas lee cada vuelta del servicio como «hay Runner». Esto lo contesta un servidor con el código nuevo y las columnas.
 */
export async function servicioListoEnMako(): Promise<boolean> {
  const { error } = await getSupabaseServer().from(T_CARTEROS).select('runner_visto_at, servicio').limit(1);
  if (faltaColumnaDeLaVuelta(error)) return false;
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Dar de baja un mensaje del cartel de los que no salieron (30/10/2026, lib/centro-limbo.ts): lo que espera, y también lo que ya venció,
 * que `cancelarPedido` no mira. Con compare-and-set: si la PC lo tomó entretanto, salió y no se toca.
 */
export async function descartarDelLimbo(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from(T_PEDIDOS)
    .update({ estado: 'cancelado', motivo: 'Lo descartó Martín', updated_at: new Date().toISOString() })
    .eq('id', id).in('estado', ['escrito', 'no_entregado']).select('id, firmado');
  if (error) throw new Error(error.message);
  await borrarAdjuntosDe((data ?? []).map((f) => f.firmado as string | null));
  return (data ?? []).length > 0;
}

/** Acuña el token de los carteros. Se muestra UNA vez; se guarda por hash. Acuñar uno nuevo
 *  invalida el anterior: hay que pegarlo de nuevo en la PC. */
export async function crearTokenCartero(): Promise<{ token: string }> {
  const token = `mkop_${randomBytes(24).toString('base64url')}`;
  const { error } = await getSupabaseServer().from(T_TOKEN).upsert({
    id: 1, token_hash: hash(token), token_pista: token.slice(-4), creado_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw new Error(`no pude guardar el token: ${error.message}`);
  return { token };
}

export type PedidoParaEntregar = { id: string; firmado: string; firma: string };
/** Un aviso de la Ticketera: el id del intento (va al acuse), el ref de la tarjeta y a qué chat. */
export type AvisoParaEntregar = { id: string; ref: string; destino: string };
export type SalidaCiclo = {
  pedidos: PedidoParaEntregar[];
  avisos: AvisoParaEntregar[];
  /** Si los avisos no se pudieron calcular (p. ej., falta la mig 0288): los pedidos salen igual. */
  avisosError: string | null;
  vencidos: number;
  acuses: number;
  cierres: number;
  /** Los cierres que entraron (cartero 1.4.0): la PC borra ésos y vuelve a subir los demás. */
  cierresIds: string[];
  /** Si lo que se dijo en los chats entró (cartero 1.8.0): sin esto la PC no avanza su marca y lo vuelve a subir. */
  turnosOk: boolean;
  /** Las preguntas de los chats que entraron (17/10/2026, `cartero.mjs preguntar`): la PC borra ésas y vuelve a subir las
   *  demás, el molde de `cierresIds`. */
  preguntasIds: string[];
  /** Los bugs del triage que este Runner le entrega al Cerebro con un texto FIJO (cartero 1.15.0, lib/tickets-runner.ts).
   *  Un cartero de antes no los recibe (`VERSION_CARTERO_TICKETS`). */
  tickets: TicketParaEntregar[];
  ticketsError: string | null;
  /** Los tickets que esperan la decisión de Martín, con OTRO texto fijo y su propia marca (cartero 1.23.0, 29/10/2026,
   *  lib/tickets-runner.ts). Aparte de `tickets`: un cartero de antes los mandaría con el texto de un bug del triage. */
  ticketsNuevos: TicketNuevoParaEntregar[];
  /** Si no se pudieron calcular (p. ej., falta la migración de `cerebro_*`): lo demás sale igual. */
  ticketsNuevosError: string | null;
  /** Los mensajes de Martín que esperan un chat cerrado, para que la PC se lo diga al Cerebro con un texto FIJO (cartero 1.26.0,
   *  lib/limbo-al-cerebro.ts). Sólo id, cuenta y fecha: ni su texto ni el título de su chat. */
  limbo: AvisoDeLimbo[];
  limboError: string | null;
};

const T_DECISIONES = 'admin_decisiones';

/**
 * Las respuestas de la Ticketera que ESTE cartero tiene que avisar ahora: contestadas, sin recoger,
 * sin un aviso entregado, y cuyo chat es de esta cuenta y está abierto. Si el chat está cerrado, la
 * tarjeta espera a la vuelta en que se abra: no se pierde. Cada una se reclama con compare-and-set
 * sobre la respuesta y el intento anterior, así dos vueltas (o dos carteros) no la avisan dos veces.
 */
async function avisosParaElCartero(
  cuenta: string, chatsDeEste: ChatCartero[], entregables: ReadonlySet<string>, ahoraIso: string,
): Promise<AvisoParaEntregar[]> {
  const db = getSupabaseServer();
  const ahora = Date.parse(ahoraIso);
  const { data: filas, error } = await db.from(T_DECISIONES)
    .select('id, ref, chat, destino, respuesta, respondida_at, recogida_at, archivada_at, aviso_id, aviso_de, aviso_estado, aviso_at, aviso_intentos')
    .not('respuesta', 'is', null).is('recogida_at', null).is('archivada_at', null)
    .order('respondida_at', { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  const pendientes = (filas ?? []).filter((f) => necesitaAviso(filaAviso(f), ahora));
  if (!pendientes.length) return [];

  // El título de una tarjeta sin destino se busca entre los chats de TODOS los carteros: con dos
  // chats del mismo nombre en dos cuentas, no se adivina. Los de este cartero, en su versión de ahora.
  const { data: kart, error: eK } = await db.from(T_CARTEROS).select('cuenta, visto_at, chats');
  if (eK) throw new Error(eK.message);
  const otros = (kart ?? []).filter((k) => k.cuenta !== cuenta)
    .map((k) => ({ cuenta: String(k.cuenta), vistoAt: (k.visto_at as string | null) ?? null, chats: sanearChats(k.chats) }));
  const todos = todosLosChats([{ cuenta, vistoAt: ahoraIso, chats: chatsDeEste }, ...otros]);

  const out: AvisoParaEntregar[] = [];
  for (const f of pendientes) {
    const d = filaAviso(f);
    const r = destinoDeDecision(d, todos);
    if (!r.ok || r.chat.cuenta !== cuenta) continue;
    const mio = chatsDeEste.find((c) => c.local === r.chat.local);
    if (!mio?.vivo || !entregables.has(mio.local)) continue;
    const id = randomUUID();
    let q = db.from(T_DECISIONES).update({
      aviso_id: id, aviso_de: f.respondida_at, aviso_destino: mio.local, aviso_estado: 'tomado', aviso_at: ahoraIso,
      aviso_intentos: mismoInstante(d.avisoDe, d.respondidaAt) ? d.avisoIntentos + 1 : 1, aviso_motivo: null,
    }).eq('id', f.id).eq('respondida_at', f.respondida_at as string).is('recogida_at', null);
    q = f.aviso_id ? q.eq('aviso_id', f.aviso_id as string) : q.is('aviso_id', null);
    const { data, error: eUp } = await q.select('id');
    if (eUp) throw new Error(eUp.message);
    if (data && data[0]) out.push({ id, ref: d.ref, destino: mio.local });
    if (out.length >= AVISOS_POR_VUELTA) break;
  }
  return out;
}

/**
 * Lo que espera un chat cerrado, si este Runner tiene el Cerebro abierto (cartero 1.26.0). Si no lo tiene, no se pierde: la lista se
 * calcula de nuevo en cada vuelta, y sale en la que lo tenga.
 * ⚠️ SIN `texto` NI `destino_titulo` en el select: no están firmados para el Cerebro, y lo que no se lee no viaja.
 */
async function limboParaElCartero(version: string | null, chatsDeEste: readonly ChatCartero[], entregables: ReadonlySet<string>, ahora: number): Promise<AvisoDeLimbo[]> {
  if (!versionAlMenos(version, VERSION_CARTERO_LIMBO)) return [];
  const cerebro = chatsDeEste.find((c) => c.vivo && esElCerebro(c.titulo) && entregables.has(c.local));
  if (!cerebro) return [];
  const db = getSupabaseServer();
  const [{ data: pedidos, error: e1 }, { data: filas, error: e2 }] = await Promise.all([
    db.from(T_PEDIDOS).select('id, created_at, destino, destino_cuenta, estado').eq('estado', 'escrito').order('created_at', { ascending: true }).limit(LIMBO_TOPE),
    // `cuenta` y `visto_at`: una foto vieja no dice «cerrado» (`comoEstaElDestino`). `visto_at` existe sin la mig 0355.
    db.from(T_CARTEROS).select('cuenta, visto_at, chats'),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  return avisosDeLimbo(pedidos ?? [], (filas ?? []).map((f) => ({ cuenta: f.cuenta as string, noticiasAt: f.visto_at as string | null, chats: sanearChats(f.chats) })), cerebro.local, ahora);
}

/**
 * Una vuelta de UN cartero, en un solo pedido (como el puente de Flow): sube lo que ve en su
 * cuenta y los acuses de la vuelta anterior, y se lleva lo que puede entregar ahora.
 * Devuelve null si el token no vale; tira si falta la cuenta.
 */
/**
 * ¿Hay algo para entregar en estas cuentas? (cartero 1.12.0, `vigilar`; Martín: «Envié un mensaje y no pasó nada por
 * varios segundos».) Es la consulta LIVIANA que la PC hace cada pocos segundos: devuelve SÓLO un número, sin escribir
 * nada. Cuenta lo `escrito` para los entregables que cada cuenta subió en su última vuelta, y los `nuevo` sólo de las
 * cuentas que la PC dice que abre (si no, una vuelta completa no los reclamaría y la PC preguntaría en falso para
 * siempre). Quien llama ya validó el token del cartero.
 */
export async function hayParaElCartero(cuentas: readonly string[], abre: readonly string[]): Promise<number> {
  const validas = [...new Set(cuentas.filter((c) => CUENTA_RE.test(c)))].slice(0, 10);
  if (!validas.length) return 0;
  const db = getSupabaseServer();
  const { data: filas, error } = await db.from(T_CARTEROS).select('cuenta, chats, version').in('cuenta', validas);
  if (error) throw new Error(error.message);
  const vivos = (filas ?? []).flatMap((f) => sanearChats(f.chats)
    .filter((c) => c.vivo && c.runner !== false && !c.esRunner && !c.nube).map((c) => c.local));
  // Un bug del triage para el Cerebro (cartero 1.15.0): cuenta SÓLO si el chat «Cerebro» está vivo en una de estas cuentas
  // y su Runner lo entiende. Con un Runner de antes, contarlo haría que `vigilar` salga apenas entra, en cada vuelta, por
  // algo que la vuelta no le va a dar nunca.
  const conCerebro = (filas ?? []).some((f) => versionAlMenos(f.version as string | null, VERSION_CARTERO_TICKETS)
    && sanearChats(f.chats).some((c) => c.vivo && c.runner !== false && !c.esRunner && !c.nube && esElCerebro(c.titulo)));
  let n = 0;
  if (vivos.length) {
    const { count, error: e } = await db.from(T_PEDIDOS).select('id', { count: 'exact', head: true })
      .eq('estado', 'escrito').in('destino', vivos);
    if (e) throw new Error(e.message);
    n += count ?? 0;
  }
  const abren = validas.filter((c) => abre.includes(c));
  if (abren.length) {
    const { count, error: e } = await db.from(T_PEDIDOS).select('id', { count: 'exact', head: true })
      .eq('estado', 'escrito').eq('destino', DESTINO_NUEVO).in('destino_cuenta', abren);
    if (e) throw new Error(e.message);
    n += count ?? 0;
  }
  if (conCerebro) n += await ticketsSinEntregar();
  // Los tickets nuevos (cartero 1.23.0), con la misma condición y su versión. Sin la migración no cuentan: `vigilar` no se cae.
  const conCerebroNuevos = (filas ?? []).some((f) => versionAlMenos(f.version as string | null, VERSION_CARTERO_TICKETS_NUEVOS)
    && sanearChats(f.chats).some((c) => c.vivo && c.runner !== false && !c.esRunner && !c.nube && esElCerebro(c.titulo)));
  if (conCerebroNuevos) n += await ticketsNuevosSinEntregar().catch(() => 0);
  return n;
}

/** ¿Es el token de los carteros? Lo usan la vuelta y la bajada de un adjunto (app/api/operaciones/cartero/route.ts). */
export async function tokenDelCarteroValido(token: string): Promise<boolean> {
  if (!token.startsWith('mkop_')) return false;
  const { data: tok, error } = await getSupabaseServer().from(T_TOKEN).select('id').eq('token_hash', hash(token)).maybeSingle();
  if (error) throw new Error(error.message);
  return !!tok;
}

/** Las sesiones de cada chat en todas las cuentas (lib/centro-chats.ts → cadenasDeSesiones), de lo que subió cada cartero. Si no
 *  se pueden leer, ninguna: cada pregunta se supera sólo con los turnos de su sesión, como antes del 25/10/2026. */
async function cadenaDeLasCuentas(): Promise<Map<string, string[]> | undefined> {
  const { data, error } = await getSupabaseServer().from(T_CARTEROS).select('chats');
  if (error) { console.error('[operaciones] la cadena de los chats:', error.message); return undefined; }
  return cadenasDeSesiones((data ?? []).map((f) => ({ chats: sanearChats(f.chats) })));
}

export async function cicloCartero(token: string, entrada: unknown): Promise<SalidaCiclo | null> {
  if (!(await tokenDelCarteroValido(token))) return null;
  const db = getSupabaseServer();

  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const cuenta = typeof e.cuenta === 'string' && CUENTA_RE.test(e.cuenta) ? e.cuenta : null;
  if (!cuenta) throw new Error('falta la cuenta del cartero');
  const chats = sanearChats(e.chats).map((c) => ({ ...c, cuenta }));
  const claves = sanearClaves(e.claves);
  const version = typeof e.version === 'string' ? e.version.slice(0, 40) : null;
  // El Uso de la cuenta (cartero 1.4.0, la barra de estado de su Runner). Sin medición no se pisa la anterior.
  let cuota = sanearCuota(e.uso);
  // ⚠️ LA HUELLA DE LA SEMANA (20/10/2026, la segunda vez): una cuota cuyo reinicio semanal es el de OTRA cuenta vigente es de
  // ésa (el marcador de la PC estaba mal), y no se guarda. Frena también a un cartero de antes de la 1.16.1.
  if (cuota?.semana?.reinicia) {
    const { data: otras } = await db.from(T_CARTEROS).select('cuenta, cuota').neq('cuenta', cuenta);
    const de = cuentaDeLaSemana(cuenta, cuota, (otras ?? []).map((f) => ({ cuenta: f.cuenta as string, cuota: sanearCuota(f.cuota) })), Date.now());
    if (de) { console.warn(`[operaciones] la cuota que subió ${cuenta} es de ${de} (su semana): no se guarda`); cuota = null; }
  }
  const ahoraIso = new Date().toISOString();

  // Quién da esta vuelta (cartero 1.25.0): el servicio de la PC, o un Runner. Una del servicio dice que la PC está, nunca que hay quien entregue.
  const servicio = sanearServicio(e.servicio);
  const escribir = filaDeLaVuelta({ cuenta, version, chats, claves, cuota, servicio, ahoraIso });
  let { error: eUp } = await db.from(T_CARTEROS).upsert(escribir.fila, { onConflict: 'cuenta' });
  // Sin la mig 0355 la vuelta sigue como antes. ⚠️ Con el servicio instalado y sin la migración, «hay Runner» miente: va ANTES de instalarlo.
  if (faltaColumnaDeLaVuelta(eUp)) ({ error: eUp } = await db.from(T_CARTEROS).upsert(escribir.sinColumnas, { onConflict: 'cuenta' }));
  if (eUp) throw new Error(eUp.message);
  // El nombre y el email de la cuenta (cartero 1.15.2, la G): de cuentas.tsv de la PC. Sólo escribe si cambió; si falla, la
  // vuelta sigue (el Uso dice «Cuenta N»).
  if (e.titular) await guardarTitular(cuenta, e.titular).catch((err) => console.error('[operaciones] titular:', err instanceof Error ? err.message : err));
  // Lo que están haciendo sus chats ocupados (cartero 1.15.3, la E): la foto de esta cuenta, que se pisa entera.
  if (e.pasos) await guardarPasos(cuenta, e.pasos).catch((err) => console.error('[operaciones] pasos:', err instanceof Error ? err.message : err));

  // Lo que se dijo en cada chat desde la vuelta anterior (cartero 1.8.0, 17/10/2026: «los chats no se entienden»). Si no se
  // pudo guardar, la vuelta sigue: la PC no avanza su marca hasta que MaKo diga que entró (`turnosOk`).
  let turnosOk = true;
  const turnos = sanearTurnos(e.turnos);
  const preguntas = sanearPreguntas(e.preguntas);
  // LA CADENA de cada chat (25/10/2026): sus sesiones en TODAS las cuentas, las que el Ops Center junta por el nombre. Un turno
  // de la cuenta 1 supera la pregunta que el mismo chat hizo en la cuenta 2 («Ventas de MaKo», 23/10). Sin poder leerla, se
  // supera como antes, por sesión (`cadenaDeLasCuentas`).
  const cadena = turnos.length || preguntas.length ? await cadenaDeLasCuentas() : undefined;
  if (turnos.length) {
    try { await guardarTurnos(turnos, cadena); } catch (err) { turnosOk = false; console.error('[operaciones] turnos:', err instanceof Error ? err.message : err); }
  }
  // Las preguntas de los chats (17/10/2026, Martín: «en lugar de darme las opciones tipo multiple select»): el formulario de
  // su conversación (lib/centro-preguntas-chat.ts). Si no se pudieron guardar, la PC las vuelve a subir en la vuelta siguiente.
  let preguntasIds: string[] = [];
  if (preguntas.length) {
    // Si no se pudieron guardar, la vuelta NO avanza las marcas (`turnosOk`): una pregunta de wrap_up sale de una línea del
    // transcript, y con la marca adelante nadie la volvía a leer (la revisión de caja-voz, 20/10/2026).
    try { preguntasIds = await guardarPreguntas(preguntas, cadena); } catch (err) { turnosOk = false; console.error('[operaciones] preguntas:', err instanceof Error ? err.message : err); }
  }
  // El Plan de cada chat se arma solo (17/10/2026, la D): «Voy a trabajar en…» crea su tarea y «Ya está» la marca hecha.
  // Anotarlo es rápido; aplicarlo en el Plan pasa por el Perro (hasta un minuto por paso) y va DESPUÉS de contestarle al
  // Runner, que corta a los 120 s (lib/centro-plan-auto.ts). Si falla, la vuelta sigue igual.
  // ⚠️ DESPUÉS DE LAS PREGUNTAS Y SÓLO SI LA VUELTA AVANZA (revisión de la ola 1, 21/10/2026): si las preguntas fallan, la
  //    PC re-sube la MISMA tanda, y anotarla dos veces creaba una tarea de más (`anotarTurnos` además ya es idempotente).
  if (turnos.length && turnosOk) {
    const titulos = new Map(chats.map((c) => [c.local, c.titulo]));
    await anotarTurnosDelPlan(turnos, titulos).catch((err) => console.error('[operaciones] plan de los chats:', err instanceof Error ? err.message : err));
  }
  // Lo pendiente del Plan de los chats (de esta vuelta o de una que no terminó), después de contestar.
  after(() => aplicarPlanDeLosChats(200_000).catch((err) => console.error('[operaciones] plan de los chats:', err instanceof Error ? err.message : err)));

  // Los acuses de la vuelta anterior: sólo sobre un pedido TOMADO, o sobre un aviso de la
  // Ticketera TOMADO (comparten el formato de id, y cada id es de uno solo de los dos).
  let acuses = 0;
  // Con el acuse, el trabajo terminó para la PC: lo que tenía que bajar ya bajó (o no va a bajar). Sus adjuntos se borran.
  const terminados: Array<string | null> = [];
  for (const a of sanearAcuses(e.acuses)) {
    const { data } = await db.from(T_PEDIDOS).update({
      estado: a.estado, motivo: a.motivo, updated_at: ahoraIso,
      ...(a.estado === 'entregado' ? { entregado_at: ahoraIso } : {}),
    }).eq('id', a.id).eq('estado', 'tomado').select('id, firmado');
    acuses += (data ?? []).length;
    for (const f of data ?? []) terminados.push(f.firmado as string | null);
    if ((data ?? []).length) continue;
    // Si falta la mig 0288 esto da error: un acuse de aviso no puede existir sin ella, así que se ignora.
    const { data: av } = await db.from(T_DECISIONES).update({ aviso_estado: a.estado, aviso_motivo: a.motivo, aviso_at: ahoraIso })
      .eq('aviso_id', a.id).eq('aviso_estado', 'tomado').select('id');
    acuses += (av ?? []).length;
    if ((av ?? []).length) continue;
    // Un bug del triage que el Runner le entregó al Cerebro (cartero 1.15.0): el mismo formato de id. Si falta la mig 0311,
    // no puede existir un acuse así, y el error se ignora.
    acuses += await acusarTicket(a, ahoraIso).catch(() => 0);
    // Un ticket nuevo (cartero 1.23.0): su propia marca. Sin la migración de `cerebro_*` no puede existir un acuse así.
    acuses += await acusarTicketNuevo(a, ahoraIso).catch(() => 0);
  }

  // Los cierres que dejaron los chats: sólo sobre un pedido ENTREGADO.
  let cierres = 0;
  const cierresIds: string[] = [];
  for (const c of sanearCierres(e.cierres)) {
    const { data } = await db.from(T_PEDIDOS).update({
      estado: estadoDeCierre(c.cierre), cierre: c.cierre, cerrado_at: ahoraIso, updated_at: ahoraIso,
    }).eq('id', c.id).eq('estado', 'entregado').select('id');
    cierres += (data ?? []).length;
    if ((data ?? []).length) cierresIds.push(c.id);
  }

  // Lo vencido no se entrega: se dice, con el motivo.
  // Con su motivo, que lo distingue de los otros `no_entregado` (lib/centro-limbo.ts). El cartel que lo mostraba se sacó el 31/10/2026.
  const limite = new Date(Date.now() - VENCE_PEDIDO_MS).toISOString();
  const { data: venc } = await db.from(T_PEDIDOS)
    .update({ estado: 'no_entregado', motivo: MOTIVO_VENCIO, updated_at: ahoraIso })
    .eq('estado', 'escrito').lt('created_at', limite).select('id, firmado');
  for (const f of venc ?? []) terminados.push(f.firmado as string | null);
  // Lo tomado que nunca acusó (17/10/2026, la revisión de seguridad de los adjuntos): el acuse era su ÚNICA salida, y
  // cancelar y vencer miran sólo lo `escrito`. Quedaba `tomado` para siempre, con su adjunto servido y sin borrar.
  const tomadoLimite = new Date(Date.now() - TOMADO_VENCE_MS).toISOString();
  const { data: perdidos } = await db.from(T_PEDIDOS)
    .update({ estado: 'incierto', motivo: 'El Runner no confirmó si le llegó: míralo en el chat', updated_at: ahoraIso })
    .eq('estado', 'tomado').lt('tomado_at', tomadoLimite).select('id, firmado');
  for (const f of perdidos ?? []) terminados.push(f.firmado as string | null);
  await borrarAdjuntosDe(terminados);

  // Lo que ESTE cartero puede entregar ahora: pedidos escritos para uno de SUS chats vivos que la PC alcanza.
  // ⚠️ El servicio no reclama, diga lo que diga su lista: sin un chat, lo tomado se pierde (la PC igual lo devuelve).
  const vivos = servicio ? [] : sanearEntregables(e.entregables, chats);
  const pedidos: PedidoParaEntregar[] = [];
  if (vivos.length) {
    const { data: cand, error: eCand } = await db.from(T_PEDIDOS).select('id, destino, texto')
      .eq('estado', 'escrito').in('destino', vivos).order('created_at', { ascending: true }).limit(POR_VUELTA);
    if (eCand) throw new Error(eCand.message);
    // Una respuesta de una pregunta que Martín ignoró no sale (5/11/2026): se cancela acá, antes de reclamarla.
    const aReclamar = await sinRespuestasIgnoradas((cand ?? []).map((f) => ({ id: f.id as string, destino: f.destino as string, texto: (f.texto as string | null) ?? null })), ahoraIso);
    for (const id of aReclamar) {
      const { data } = await db.from(T_PEDIDOS)
        .update({ estado: 'tomado', tomado_at: ahoraIso, updated_at: ahoraIso })
        .eq('id', id).eq('estado', 'escrito').select('id, firmado, firma');
      if (data && data[0]) pedidos.push(data[0] as PedidoParaEntregar);
    }
  }
  // Los chats NUEVOS de esta cuenta (cartero 1.11.0, «un clic»): sólo a un cartero que dice que los abre (`abre`: una
  // terminal de esa cuenta y el permiso local prendido). Sin eso quedan escritos, y la pantalla dice qué hacer.
  if (!servicio && sanearAbre(e.abre).includes(cuenta) && pedidos.length < POR_VUELTA) {
    const { data: nuevos, error: eNuevos } = await db.from(T_PEDIDOS).select('id')
      .eq('estado', 'escrito').eq('destino', DESTINO_NUEVO).eq('destino_cuenta', cuenta)
      .order('created_at', { ascending: true }).limit(POR_VUELTA - pedidos.length);
    if (eNuevos) throw new Error(eNuevos.message);
    for (const { id } of nuevos ?? []) {
      const { data } = await db.from(T_PEDIDOS)
        .update({ estado: 'tomado', tomado_at: ahoraIso, updated_at: ahoraIso })
        .eq('id', id).eq('estado', 'escrito').select('id, firmado, firma');
      if (data && data[0]) pedidos.push(data[0] as PedidoParaEntregar);
    }
  }

  // Los avisos de la Ticketera van aparte: si fallan (la base, una columna que falta), los pedidos
  // firmados salen igual, y el error viaja para que el cartero lo diga.
  let avisos: AvisoParaEntregar[] = [];
  let avisosError: string | null = null;
  try {
    if (vivos.length) avisos = await avisosParaElCartero(cuenta, chats, new Set(vivos), ahoraIso);
  } catch (err) {
    avisosError = err instanceof Error ? err.message.slice(0, 200) : 'error';
  }
  // Los bugs del triage para el Cerebro (cartero 1.15.0), aparte como los avisos: si fallan, lo demás sale igual.
  let tickets: TicketParaEntregar[] = [];
  let ticketsError: string | null = null;
  try {
    if (vivos.length) tickets = await ticketsParaElCartero(version, chats, new Set(vivos), ahoraIso);
  } catch (err) {
    ticketsError = err instanceof Error ? err.message.slice(0, 200) : 'error';
  }
  // Los tickets que esperan a Martín (cartero 1.23.0), aparte de los del triage: si fallan, lo demás sale igual.
  let ticketsNuevos: TicketNuevoParaEntregar[] = [];
  let ticketsNuevosError: string | null = null;
  try {
    if (vivos.length) ticketsNuevos = await ticketsNuevosParaElCartero(version, chats, new Set(vivos), ahoraIso);
  } catch (err) {
    ticketsNuevosError = err instanceof Error ? err.message.slice(0, 200) : 'error';
  }
  // Lo que espera un chat cerrado (cartero 1.26.0): si falla, lo demás sale igual. ⚠️ `hayParaElCartero` NO lo cuenta: MaKo no sabe qué
  // avisó la PC (lleva ella la cuenta), así que `vigilar` saldría en cada vuelta. No es urgente: sale en la vuelta del cron.
  let limbo: AvisoDeLimbo[] = [];
  let limboError: string | null = null;
  try {
    if (vivos.length) limbo = await limboParaElCartero(version, chats, new Set(vivos), Date.parse(ahoraIso));
  } catch (err) {
    limboError = err instanceof Error ? err.message.slice(0, 200) : 'error';
  }
  return { pedidos, avisos, avisosError, tickets, ticketsError, ticketsNuevos, ticketsNuevosError, limbo, limboError, vencidos: (venc ?? []).length, acuses, cierres, cierresIds, turnosOk, preguntasIds };
}
