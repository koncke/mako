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
import {
  CUENTA_RE, POR_VUELTA, TOMADO_VENCE_MS, claveIdDe, estadoDeCierre, leerFirmable, nombresDeAdjuntos, sanearAcuses, sanearChats,
  sanearCierres, sanearClaves, sanearEntregables, sanearTurnos, todosLosChats, type ChatCartero, type Cierre, type EstadoPedido,
} from './operaciones-reglas';
import { sanearCuota, type Cuota } from './centro-uso';
import { guardarTurnos } from './centro-turnos-db';
import { AVISOS_POR_VUELTA, destinoDeDecision, filaAviso, mismoInstante, necesitaAviso } from './decisiones-aviso';
import { borrarAdjuntosDe } from './operaciones-adjuntos';

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
};

export type Cartero = {
  cuenta: string;
  vistoAt: string | null;
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

export async function listarPedidos(limite = 100): Promise<Pedido[]> {
  const { data, error } = await getSupabaseServer()
    .from(T_PEDIDOS).select(`${COLS}, firmado`).order('created_at', { ascending: false }).limit(limite);
  if (error) throw new Error(`no pude leer la cola: ${error.message}`);
  // El texto firmado no sale de acá: sólo los nombres de sus adjuntos, si tiene.
  return (data ?? []).map(({ firmado, ...p }) => {
    const adjuntos = nombresDeAdjuntos(firmado as string | null);
    return (adjuntos.length ? { ...p, adjuntos } : p) as Pedido;
  });
}

export async function leerCarteros(): Promise<EstadoCarteros> {
  const db = getSupabaseServer();
  const [{ data: filas, error: e1 }, { data: tok, error: e2 }] = await Promise.all([
    db.from(T_CARTEROS).select('cuenta, visto_at, version, chats, claves, cuota').order('cuenta'),
    db.from(T_TOKEN).select('token_pista, creado_at').eq('id', 1).maybeSingle(),
  ]);
  if (e1) throw new Error(`no pude leer los carteros: ${e1.message}`);
  if (e2) throw new Error(`no pude leer el token: ${e2.message}`);
  return {
    carteros: (filas ?? []).map((f) => ({
      cuenta: f.cuenta as string,
      vistoAt: (f.visto_at as string | null) ?? null,
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

/** Sólo un pedido que todavía no tomó un cartero se puede cancelar. Sus adjuntos se borran (no van a bajar). */
export async function cancelarPedido(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from(T_PEDIDOS)
    .update({ estado: 'cancelado', motivo: 'Lo canceló Martín', updated_at: new Date().toISOString() })
    .eq('id', id).eq('estado', 'escrito').select('id, firmado');
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
 * Una vuelta de UN cartero, en un solo pedido (como el puente de Flow): sube lo que ve en su
 * cuenta y los acuses de la vuelta anterior, y se lleva lo que puede entregar ahora.
 * Devuelve null si el token no vale; tira si falta la cuenta.
 */
/** ¿Es el token de los carteros? Lo usan la vuelta y la bajada de un adjunto (app/api/operaciones/cartero/route.ts). */
export async function tokenDelCarteroValido(token: string): Promise<boolean> {
  if (!token.startsWith('mkop_')) return false;
  const { data: tok, error } = await getSupabaseServer().from(T_TOKEN).select('id').eq('token_hash', hash(token)).maybeSingle();
  if (error) throw new Error(error.message);
  return !!tok;
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
  const cuota = sanearCuota(e.uso);
  const ahoraIso = new Date().toISOString();

  const { error: eUp } = await db.from(T_CARTEROS)
    .upsert({ cuenta, visto_at: ahoraIso, version, chats, claves, updated_at: ahoraIso, ...(cuota ? { cuota } : {}) }, { onConflict: 'cuenta' });
  if (eUp) throw new Error(eUp.message);

  // Lo que se dijo en cada chat desde la vuelta anterior (cartero 1.8.0, 17/10/2026: «los chats no se entienden»). Si no se
  // pudo guardar, la vuelta sigue: la PC no avanza su marca hasta que MaKo diga que entró (`turnosOk`).
  let turnosOk = true;
  const turnos = sanearTurnos(e.turnos);
  if (turnos.length) {
    try { await guardarTurnos(turnos); } catch (err) { turnosOk = false; console.error('[operaciones] turnos:', err instanceof Error ? err.message : err); }
  }

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
  const limite = new Date(Date.now() - 15 * 86_400_000).toISOString();
  const { data: venc } = await db.from(T_PEDIDOS)
    .update({ estado: 'no_entregado', motivo: 'Venció con el chat cerrado: ábrelo y vuelve a mandarlo', updated_at: ahoraIso })
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
  const vivos = sanearEntregables(e.entregables, chats);
  const pedidos: PedidoParaEntregar[] = [];
  if (vivos.length) {
    const { data: cand, error: eCand } = await db.from(T_PEDIDOS).select('id')
      .eq('estado', 'escrito').in('destino', vivos).order('created_at', { ascending: true }).limit(POR_VUELTA);
    if (eCand) throw new Error(eCand.message);
    for (const { id } of cand ?? []) {
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
  return { pedidos, avisos, avisosError, vencidos: (venc ?? []).length, acuses, cierres, cierresIds, turnosOk };
}
