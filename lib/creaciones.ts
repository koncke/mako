// =============================================================================
// creaciones — las creaciones publicadas y sus ESTRELLAS (como GitHub): el server
// =============================================================================
// Pedido de Martín (13/10/2026, punto 10): «Quiero implementar el sistema de "estrellas" de github en todo MaKo...
// para que los usuarios hagan sus creaciones y otros usuarios puedan puntuarles.» Las reglas puras, en
// lib/creaciones-reglas.ts; lo de cada tipo, en lib/creaciones-enchufes.ts; las tablas, en la mig 0273.
//
// ⚠️ LAS TABLAS NO SON DE UN INQUILINO: una creación la lee cualquier negocio (es para compartir). Por eso todo va con el
// cliente crudo (`getSupabaseServer`), con el workspace EXPLÍCITO en cada función, y la columna se llama
// `workspace_origen` (no `workspace_id`, que `getTenantDb` filtraría). El que llama ya comprobó QUIÉN es (la pantalla
// con `requireRolWs([])`, la API con su token y su `gating`).
//   · Lo que sale de acá a otro negocio NUNCA trae el workspace de origen ni el email de quien publicó: trae el nombre
//     de autor que eligió quien publica, y si es tuya (`mia`).
//   · La definición sale sólo en `verCreacion` (y la usa `usarCreacion`): una lista no la necesita, y pesa.
//   · Sin las tablas (la 0273 sin aplicar), `FaltaTablaCreacionesError`: la pantalla y la API dicen que falta.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getCapaActual, wsSuperAdmin } from './workspace';
import { tabEnCapa } from './capas';
import { ENCHUFES, NoExisteError, type Usada } from './creaciones-enchufes';
import {
  INFO_TIPO, POR_ENCHUFAR, POR_PAGINA_CREACIONES, definicionCabe, estaEnchufado, normalizarBusqueda, patronBusqueda,
  porQueNoEstrella, puedeRetirar, sanearPublicacion, type OrdenCreaciones, type TipoCreacion,
} from './creaciones-reglas';

export const FALTA_TABLA_CREACIONES = 'Falta la migración 0273 (creaciones).';
export class FaltaTablaCreacionesError extends Error {
  constructor() { super(FALTA_TABLA_CREACIONES); this.name = 'FaltaTablaCreacionesError'; }
}
/** La TABLA que falta (PGRST205 de PostgREST, 42P01 de Postgres), no otra cosa. */
const faltaLaTabla = (e: { code?: string } | null | undefined): boolean => !!e && (e.code === 'PGRST205' || e.code === '42P01');
function tirar(que: string, e: { code?: string; message: string }): never {
  if (faltaLaTabla(e)) throw new FaltaTablaCreacionesError();
  throw new Error(`${que}: ${e.message}`);
}

/** Lo que alguien NO puede hacer (no existe, no es suyo, ya no está publicada): un 4xx legible, no un 500. */
export class CreacionError extends Error {
  constructor(m: string, readonly status: 400 | 403 | 404 = 400) { super(m); this.name = 'CreacionError'; }
}

// ── Lo que se muestra ────────────────────────────────────────────────────────

type Fila = {
  id: number; tipo: string; titulo: string; descripcion: string; definicion?: unknown; workspace_origen: number;
  origen_id: number | null; autor_nombre: string; de_mako: boolean; estado: string; estrellas: number; usos: number;
  created_at: string; updated_at: string;
};
const COLS = 'id, tipo, titulo, descripcion, workspace_origen, origen_id, autor_nombre, de_mako, estado, estrellas, usos, created_at, updated_at';

export type Creacion = {
  id: number; tipo: string; tipoTitulo: string; titulo: string; descripcion: string; autor: string; deMako: boolean;
  estado: 'publicada' | 'retirada'; estrellas: number; usos: number; publicada: string; actualizada: string;
  /** La publicó ESTE negocio. */
  mia: boolean;
  /** ESTE negocio ya le dio su estrella. */
  conEstrella: boolean;
  /** Ya se puede usar en MaKo (su tipo tiene enchufe). */
  sePuedeUsar: boolean;
};
export type CreacionDetalle = Creacion & { resumen: { nombre: string; detalle: string } | null };

const autorDe = (f: Fila): string => (f.de_mako ? 'MaKo' : f.autor_nombre.trim() || 'Un negocio de MaKo');

function vista(f: Fila, ws: number, conEstrella: boolean): Creacion {
  const t = f.tipo as TipoCreacion;
  return {
    id: f.id, tipo: f.tipo, tipoTitulo: INFO_TIPO[t]?.singular ?? f.tipo, titulo: f.titulo, descripcion: f.descripcion,
    autor: autorDe(f), deMako: f.de_mako, estado: f.estado === 'retirada' ? 'retirada' : 'publicada',
    estrellas: f.estrellas, usos: f.usos, publicada: f.created_at, actualizada: f.updated_at,
    mia: f.workspace_origen === ws, conEstrella, sePuedeUsar: t in INFO_TIPO && estaEnchufado(t),
  };
}

/** De estas creaciones, a cuáles ya les dio estrella este negocio. */
async function estrellasDe(ws: number, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { data, error } = await getSupabaseServer().from('creacion_estrellas').select('creacion_id').eq('workspace_estrella', ws).in('creacion_id', ids);
  if (error) tirar('estrellas', error);
  return new Set(((data ?? []) as Array<{ creacion_id: number }>).map((r) => r.creacion_id));
}

async function filaDe(id: number, conDefinicion = false): Promise<Fila | null> {
  const { data, error } = await getSupabaseServer().from('creaciones').select(conDefinicion ? `${COLS}, definicion` : COLS).eq('id', id).maybeSingle();
  if (error) tirar('leer la creación', error);
  return (data as Fila | null) ?? null;
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

export type FiltroCreaciones = { tipo?: TipoCreacion | null; orden?: OrdenCreaciones | null; q?: string | null; pagina?: number | null };

/** La galería: lo publicado, de todos los negocios. */
export async function listarCreaciones(ws: number, f: FiltroCreaciones = {}): Promise<{ creaciones: Creacion[]; hayMas: boolean }> {
  const pagina = Math.max(1, Math.trunc(f.pagina ?? 1));
  const desde = (pagina - 1) * POR_PAGINA_CREACIONES;
  let q = getSupabaseServer().from('creaciones').select(COLS).eq('estado', 'publicada');
  if (f.tipo) q = q.eq('tipo', f.tipo);
  const busca = normalizarBusqueda(f.q);
  if (busca) {
    const pat = patronBusqueda(busca);
    q = q.or(`titulo.ilike.${pat},descripcion.ilike.${pat}`);
  }
  const orden = f.orden ?? 'estrellas';
  if (orden === 'usos') q = q.order('usos', { ascending: false });
  else if (orden === 'estrellas') q = q.order('estrellas', { ascending: false });
  // El último criterio es una columna ÚNICA: el orden de una página no se mueve entre pedidos.
  q = q.order('id', { ascending: false });
  // Una de más: para saber si hay otra página sin contar la tabla entera.
  const { data, error } = await q.range(desde, desde + POR_PAGINA_CREACIONES);
  if (error) tirar('listar las creaciones', error);
  const filas = (data ?? []) as Fila[];
  const hayMas = filas.length > POR_PAGINA_CREACIONES;
  const pag = filas.slice(0, POR_PAGINA_CREACIONES);
  const con = await estrellasDe(ws, pag.map((x) => x.id));
  return { creaciones: pag.map((x) => vista(x, ws, con.has(x.id))), hayMas };
}

/** UNA creación, con el resumen de su definición. Una retirada sólo la ve su autor. */
export async function verCreacion(ws: number, id: number): Promise<CreacionDetalle> {
  const f = await filaDe(id, true);
  if (!f || (f.estado !== 'publicada' && f.workspace_origen !== ws)) throw new CreacionError(`No existe la creación #${id}.`, 404);
  const con = await estrellasDe(ws, [f.id]);
  const t = f.tipo as TipoCreacion;
  const resumen = estaEnchufado(t) ? ENCHUFES[t].resumir(f.definicion) : null;
  return { ...vista(f, ws, con.has(f.id)), resumen };
}

/** Lo que publicó ESTE negocio, publicado y retirado. */
export async function misCreaciones(ws: number): Promise<Creacion[]> {
  const { data, error } = await getSupabaseServer().from('creaciones').select(COLS).eq('workspace_origen', ws).order('id', { ascending: false }).limit(200);
  if (error) tirar('mis creaciones', error);
  return ((data ?? []) as Fila[]).map((x) => vista(x, ws, false));
}

/** Lo que ESTE negocio puede publicar de un tipo (para el modal). */
export async function opcionesParaPublicar(tipo: TipoCreacion): Promise<Array<{ id: number; nombre: string }>> {
  if (!estaEnchufado(tipo)) return [];
  return ENCHUFES[tipo].opciones();
}

// ── Escrituras ───────────────────────────────────────────────────────────────

/** Por qué no se puede publicar ese tipo todavía, o null. */
export function porQueNoSePublica(tipo: TipoCreacion): string | null {
  if (estaEnchufado(tipo)) return null;
  return `Todavía no se pueden publicar ${INFO_TIPO[tipo].titulo.toLowerCase()}${POR_ENCHUFAR[tipo] ? ' (llega con su pantalla)' : ''}.`;
}

/**
 * Publica (o ACTUALIZA, si ya estaba publicada) una cosa de este negocio. La definición la arma el enchufe del tipo
 * desde la base, nunca un JSON que mande el pedido. Volver a publicar la misma cosa reemplaza la definición, el título
 * y la descripción y CONSERVA sus estrellas y sus usos, como un push a un repo.
 */
export async function publicarCreacion(
  ws: number,
  input: { tipo: TipoCreacion; origenId: number; titulo?: unknown; descripcion?: unknown; autorNombre?: unknown },
  quien: string,
): Promise<{ id: number; actualizada: boolean; titulo: string }> {
  const no = porQueNoSePublica(input.tipo);
  if (no || !estaEnchufado(input.tipo)) throw new CreacionError(no ?? 'Ese tipo no se puede publicar.');
  let exp: { definicion: unknown; nombre: string };
  try {
    exp = await ENCHUFES[input.tipo].exportar(input.origenId);
  } catch (e) {
    if (e instanceof NoExisteError) throw new CreacionError(e.message, 404);
    throw e;
  }
  const datos = sanearPublicacion({ titulo: input.titulo || exp.nombre, descripcion: input.descripcion, autorNombre: input.autorNombre });
  if ('error' in datos) throw new CreacionError(datos.error);
  if (!definicionCabe(exp.definicion)) throw new CreacionError('Es demasiado grande para publicarla.');
  const deMako = ws === (await wsSuperAdmin());
  const db = getSupabaseServer();
  const { data: ya, error: eYa } = await db.from('creaciones').select('id').eq('workspace_origen', ws).eq('tipo', input.tipo)
    .eq('origen_id', input.origenId).eq('estado', 'publicada').order('id', { ascending: false }).limit(1);
  if (eYa) tirar('publicar', eYa);
  const fila = {
    titulo: datos.titulo, descripcion: datos.descripcion, autor_nombre: datos.autorNombre, definicion: exp.definicion,
    publicado_por: quien.slice(0, 200), de_mako: deMako, updated_at: new Date().toISOString(),
  };
  const existente = ((ya ?? []) as Array<{ id: number }>)[0];
  if (existente) {
    const { error } = await db.from('creaciones').update(fila).eq('id', existente.id);
    if (error) tirar('actualizar la creación', error);
    return { id: existente.id, actualizada: true, titulo: datos.titulo };
  }
  const { data, error } = await db.from('creaciones').insert({ ...fila, tipo: input.tipo, workspace_origen: ws, origen_id: input.origenId }).select('id').single();
  if (error || !data) tirar('publicar', error ?? { message: 'no se creó' });
  return { id: (data as { id: number }).id, actualizada: false, titulo: datos.titulo };
}

/** Retira una creación de la galería (su autor, o la plataforma). No la borra: quien la usó tiene su copia. */
export async function retirarCreacion(ws: number, id: number): Promise<{ yaEstaba: boolean; titulo: string }> {
  const f = await filaDe(id);
  if (!f) throw new CreacionError(`No existe la creación #${id}.`, 404);
  if (!puedeRetirar({ workspaceOrigen: f.workspace_origen }, ws, ws === (await wsSuperAdmin()))) throw new CreacionError('Sólo la retira quien la publicó.', 403);
  if (f.estado === 'retirada') return { yaEstaba: true, titulo: f.titulo };
  const { error } = await getSupabaseServer().from('creaciones').update({ estado: 'retirada', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) tirar('retirar la creación', error);
  return { yaEstaba: false, titulo: f.titulo };
}

/** La estrella de ESTE negocio. Darla dos veces no suma dos (la PK lo impide): vuelve `yaEstaba`. */
export async function darEstrella(ws: number, id: number, quien: string): Promise<{ yaEstaba: boolean; estrellas: number; titulo: string }> {
  const f = await filaDe(id);
  if (!f || (f.estado !== 'publicada' && f.workspace_origen !== ws)) throw new CreacionError(`No existe la creación #${id}.`, 404);
  const no = porQueNoEstrella({ workspaceOrigen: f.workspace_origen, estado: f.estado }, ws);
  if (no) throw new CreacionError(no, f.workspace_origen === ws ? 403 : 400);
  const { error } = await getSupabaseServer().from('creacion_estrellas').insert({ creacion_id: id, workspace_estrella: ws, quien: quien.slice(0, 200) });
  if (error && error.code !== '23505') tirar('dar la estrella', error);
  const despues = await filaDe(id);
  return { yaEstaba: error?.code === '23505', estrellas: despues?.estrellas ?? f.estrellas, titulo: f.titulo };
}

/** Saca la estrella de ESTE negocio. Si no la tenía, `yaEstaba`. */
export async function quitarEstrella(ws: number, id: number): Promise<{ yaEstaba: boolean; estrellas: number; titulo: string }> {
  const f = await filaDe(id);
  if (!f) throw new CreacionError(`No existe la creación #${id}.`, 404);
  const { data, error } = await getSupabaseServer().from('creacion_estrellas').delete().eq('creacion_id', id).eq('workspace_estrella', ws).select('creacion_id');
  if (error) tirar('quitar la estrella', error);
  const despues = await filaDe(id);
  return { yaEstaba: !(data ?? []).length, estrellas: despues?.estrellas ?? f.estrellas, titulo: f.titulo };
}

/** Usa una creación: la crea en ESTE negocio (apagada) con el enchufe de su tipo, y cuenta el uso. */
export async function usarCreacion(ws: number, id: number): Promise<Usada & { titulo: string }> {
  const f = await filaDe(id, true);
  if (!f || f.estado !== 'publicada') throw new CreacionError(`No existe la creación #${id}, o ya no está publicada.`, 404);
  const t = f.tipo as TipoCreacion;
  if (!estaEnchufado(t)) throw new CreacionError(porQueNoSePublica(t)?.replace('publicar', 'usar') ?? 'Todavía no se puede usar.');
  // Un negocio cuyo plan no tiene la tab no recibe la cosa: nacería donde no la puede abrir.
  if (!tabEnCapa(INFO_TIPO[t].nav, await getCapaActual())) throw new CreacionError(`Tu plan no tiene ${INFO_TIPO[t].feature}.`, 403);
  const r = await ENCHUFES[t].usar(f.definicion);
  // El uso se cuenta DESPUÉS de crear (un uso que falló no es un uso), y su autor no se cuenta a sí mismo.
  if (f.workspace_origen !== ws) await contarUso(id, ws).catch((e) => console.error('[creaciones] contar el uso:', e instanceof Error ? e.message : e));
  return { ...r, titulo: f.titulo };
}

/** Un negocio nuevo suma 1 a `usos` (el trigger); uno que repite sólo actualiza su fila. */
async function contarUso(id: number, ws: number): Promise<void> {
  const db = getSupabaseServer();
  const { error } = await db.from('creacion_usos').insert({ creacion_id: id, workspace_uso: ws });
  if (!error) return;
  if (error.code !== '23505') tirar('contar el uso', error);
  const { data, error: eL } = await db.from('creacion_usos').select('veces').eq('creacion_id', id).eq('workspace_uso', ws).maybeSingle();
  if (eL) tirar('contar el uso', eL);
  const veces = ((data as { veces: number } | null)?.veces ?? 1) + 1;
  const { error: eU } = await db.from('creacion_usos').update({ veces, ultimo_uso: new Date().toISOString() }).eq('creacion_id', id).eq('workspace_uso', ws);
  if (eU) tirar('contar el uso', eU);
}
