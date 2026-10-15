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
// chats vivos que él mismo subió en esa vuelta: el de la cuenta 2 no se lleva lo de la 3.
// =============================================================================

import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import {
  CUENTA_RE, POR_VUELTA, claveIdDe, estadoDeCierre, leerFirmable, sanearAcuses, sanearChats,
  sanearCierres, sanearClaves, type ChatCartero, type Cierre, type EstadoPedido,
} from './operaciones-reglas';

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
};

export type Cartero = {
  cuenta: string;
  vistoAt: string | null;
  version: string | null;
  chats: ChatCartero[];
  claves: string[];
};

export type EstadoCarteros = {
  carteros: Cartero[];
  tokenPista: string | null;
  tokenCreadoAt: string | null;
};

const COLS = 'id, created_at, autor, destino, destino_cuenta, destino_titulo, texto, clave_id, estado, motivo, tomado_at, entregado_at, cerrado_at, cierre';

export async function listarPedidos(limite = 100): Promise<Pedido[]> {
  const { data, error } = await getSupabaseServer()
    .from(T_PEDIDOS).select(COLS).order('created_at', { ascending: false }).limit(limite);
  if (error) throw new Error(`no pude leer la cola: ${error.message}`);
  return (data ?? []) as Pedido[];
}

export async function leerCarteros(): Promise<EstadoCarteros> {
  const db = getSupabaseServer();
  const [{ data: filas, error: e1 }, { data: tok, error: e2 }] = await Promise.all([
    db.from(T_CARTEROS).select('cuenta, visto_at, version, chats, claves').order('cuenta'),
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
  if (!l.ok) return { ok: false, error: `El pedido no es válido: ${l.motivo}.` };
  if (!firmaCoincide(entrada.firmado, entrada.firma, entrada.clavePublica)) {
    return { ok: false, error: 'La firma no corresponde a la clave de este dispositivo.' };
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
    if (error.code === '23505') return { ok: false, error: 'Ese pedido ya estaba en la cola.' };
    return { ok: false, error: `No pude guardar el pedido: ${error.message}` };
  }
  return { ok: true, id: l.p.id };
}

/** Sólo un pedido que todavía no tomó un cartero se puede cancelar. */
export async function cancelarPedido(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from(T_PEDIDOS)
    .update({ estado: 'cancelado', motivo: 'Lo canceló Martín', updated_at: new Date().toISOString() })
    .eq('id', id).eq('estado', 'escrito').select('id');
  if (error) throw new Error(error.message);
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
export type SalidaCiclo = { pedidos: PedidoParaEntregar[]; vencidos: number; acuses: number; cierres: number };

/**
 * Una vuelta de UN cartero, en un solo pedido (como el puente de Flow): sube lo que ve en su
 * cuenta y los acuses de la vuelta anterior, y se lleva lo que puede entregar ahora.
 * Devuelve null si el token no vale; tira si falta la cuenta.
 */
export async function cicloCartero(token: string, entrada: unknown): Promise<SalidaCiclo | null> {
  if (!token.startsWith('mkop_')) return null;
  const db = getSupabaseServer();
  const { data: tok, error: eTok } = await db.from(T_TOKEN).select('id').eq('token_hash', hash(token)).maybeSingle();
  if (eTok) throw new Error(eTok.message);
  if (!tok) return null;

  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const cuenta = typeof e.cuenta === 'string' && CUENTA_RE.test(e.cuenta) ? e.cuenta : null;
  if (!cuenta) throw new Error('falta la cuenta del cartero');
  const chats = sanearChats(e.chats).map((c) => ({ ...c, cuenta }));
  const claves = sanearClaves(e.claves);
  const version = typeof e.version === 'string' ? e.version.slice(0, 40) : null;
  const ahoraIso = new Date().toISOString();

  const { error: eUp } = await db.from(T_CARTEROS)
    .upsert({ cuenta, visto_at: ahoraIso, version, chats, claves, updated_at: ahoraIso }, { onConflict: 'cuenta' });
  if (eUp) throw new Error(eUp.message);

  // Los acuses de la vuelta anterior: sólo sobre un pedido TOMADO.
  let acuses = 0;
  for (const a of sanearAcuses(e.acuses)) {
    const { data } = await db.from(T_PEDIDOS).update({
      estado: a.estado, motivo: a.motivo, updated_at: ahoraIso,
      ...(a.estado === 'entregado' ? { entregado_at: ahoraIso } : {}),
    }).eq('id', a.id).eq('estado', 'tomado').select('id');
    acuses += (data ?? []).length;
  }

  // Los cierres que dejaron los chats: sólo sobre un pedido ENTREGADO.
  let cierres = 0;
  for (const c of sanearCierres(e.cierres)) {
    const { data } = await db.from(T_PEDIDOS).update({
      estado: estadoDeCierre(c.cierre), cierre: c.cierre, cerrado_at: ahoraIso, updated_at: ahoraIso,
    }).eq('id', c.id).eq('estado', 'entregado').select('id');
    cierres += (data ?? []).length;
  }

  // Lo vencido no se entrega: se dice, con el motivo.
  const limite = new Date(Date.now() - 15 * 86_400_000).toISOString();
  const { data: venc } = await db.from(T_PEDIDOS)
    .update({ estado: 'no_entregado', motivo: 'Venció sin que su chat estuviera abierto', updated_at: ahoraIso })
    .eq('estado', 'escrito').lt('created_at', limite).select('id');

  // Lo que ESTE cartero puede entregar ahora: pedidos escritos para uno de SUS chats vivos.
  const vivos = chats.filter((c) => c.vivo).map((c) => c.local);
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
  return { pedidos, vencidos: (venc ?? []).length, acuses, cierres };
}
