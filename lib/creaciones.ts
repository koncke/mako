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
  INFO_TIPO, POR_ENCHUFAR, POR_PAGINA_CREACIONES, definicionCabe, desdeDelPeriodo, estaEnchufado, estadoDe,
  normalizarBusqueda, patronBusqueda, porQueNoEstrella, puedeRetirar, puedeUsar, puedeVer, rankear, sanearPublicacion,
  type EstadoCreacion, type OrdenCreaciones, type PeriodoRanking, type Rankeada, type TipoCreacion, type TipoEnchufado,
} from './creaciones-reglas';
import { TOPE_DEFINICION_DISENO } from './creaciones-diseno';
import { definicionParaTodos, sinDatosDelNegocio, textoDeFugas, type Visibilidad } from './plantillas-propias-reglas';
import { negocioQueComparte } from './plantillas-propias';
import { leerPorPaginas } from './supabase-paginado';

export const FALTA_TABLA_CREACIONES = 'Falta la migración 0273 (creaciones).';
/** Sin la 0404, `estado = 'privada'` choca con el check de la 0273 (23514): guardar SÓLO para el negocio no se puede. */
export const FALTA_PLANTILLAS_PROPIAS = 'Falta la migración 0404 (plantillas propias): por ahora sólo se puede compartir con la comunidad.';
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
  constructor(m: string, readonly status: 400 | 403 | 404 | 409 | 422 = 400) { super(m); this.name = 'CreacionError'; }
}

// ── Lo que se muestra ────────────────────────────────────────────────────────

type Fila = {
  id: number; tipo: string; titulo: string; descripcion: string; definicion?: unknown; workspace_origen: number;
  origen_id: string | null; autor_nombre: string; de_mako: boolean; estado: string; estrellas: number; usos: number;
  created_at: string; updated_at: string;
};
const COLS = 'id, tipo, titulo, descripcion, workspace_origen, origen_id, autor_nombre, de_mako, estado, estrellas, usos, created_at, updated_at';

export type Creacion = {
  id: number; tipo: string; tipoTitulo: string; titulo: string; descripcion: string; autor: string; deMako: boolean;
  /** 'privada' (mig 0404): una plantilla propia, que sólo ve su negocio. */
  estado: EstadoCreacion; estrellas: number; usos: number; publicada: string; actualizada: string;
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
    autor: autorDe(f), deMako: f.de_mako, estado: estadoDe(f.estado),
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
  if (!f || !puedeVer({ workspaceOrigen: f.workspace_origen, estado: f.estado }, ws)) throw new CreacionError(`No existe la creación #${id}.`, 404);
  const con = await estrellasDe(ws, [f.id]);
  const t = f.tipo as TipoCreacion;
  const resumen = estaEnchufado(t) ? ENCHUFES[t].resumir(f.definicion) : null;
  return { ...vista(f, ws, con.has(f.id)), resumen };
}

/** Lo que guardó o publicó ESTE negocio: sus plantillas propias, lo publicado y lo retirado. */
export async function misCreaciones(ws: number): Promise<Creacion[]> {
  const { data, error } = await getSupabaseServer().from('creaciones').select(COLS).eq('workspace_origen', ws).order('id', { ascending: false }).limit(200);
  if (error) tirar('mis creaciones', error);
  return ((data ?? []) as Fila[]).map((x) => vista(x, ws, false));
}

/** Lo que ESTE negocio puede publicar de un tipo (para el modal). */
export async function opcionesParaPublicar(tipo: TipoCreacion): Promise<Array<{ id: string; nombre: string }>> {
  if (!estaEnchufado(tipo)) return [];
  return ENCHUFES[tipo].opciones();
}

// ── Escrituras ───────────────────────────────────────────────────────────────

/** Por qué no se puede publicar ese tipo todavía, o null. */
export function porQueNoSePublica(tipo: TipoCreacion): string | null {
  if (estaEnchufado(tipo)) return null;
  return `Todavía no se pueden publicar ${INFO_TIPO[tipo].titulo.toLowerCase()}${POR_ENCHUFAR[tipo] ? ' (llega con su pantalla)' : ''}.`;
}

/** Lo que pesa como mucho la definición de un tipo (un diseño del Image Editor puede pesar hasta su tope de 2 MB). */
const topeDe = (t: TipoCreacion): number | undefined => (t === 'formato_imagen' ? TOPE_DEFINICION_DISENO : undefined);

/**
 * La definición LISTA PARA TODOS: lo que no es texto y es del negocio afuera (el enchufe), cada texto sin sus datos
 * (`limpiarTextos`) y, si igual queda algo, NO se comparte (`fugasDe`): es la red de lib/plantillas-propias-reglas.ts.
 */
async function paraTodos(ws: number, tipo: TipoEnchufado, def: unknown, textos: { titulo: string; descripcion: string }):
  Promise<{ definicion: unknown; titulo: string; descripcion: string }> {
  const negocio = await negocioQueComparte(ws);
  const r = definicionParaTodos(def, negocio, ENCHUFES[tipo].paraPublico);
  if (!r.ok) throw new CreacionError(textoDeFugas(r.fugas), 422);
  // El título y la descripción también se ven en la galería de todos (el título nace del nombre de la cosa, que suele
  // llevar el del negocio). La FIRMA no: es lo que quien comparte eligió mostrar.
  return { definicion: r.definicion, titulo: sinDatosDelNegocio(textos.titulo, negocio), descripcion: sinDatosDelNegocio(textos.descripcion, negocio) };
}

/** Un insert o update que choca con el check de estado de la 0273: falta la 0404. */
function tirarEstado(que: string, e: { code?: string; message: string }): never {
  if (e.code === '23514') throw new CreacionError(FALTA_PLANTILLAS_PROPIAS, 409);
  tirar(que, e);
}

/**
 * GUARDA COMO PLANTILLA una cosa de este negocio (6/11/2026): `privada` (sólo su negocio, tal cual) o `publica` (todos,
 * sin los datos del negocio). La definición la arma el enchufe del tipo desde la base, nunca un JSON que mande el pedido.
 * Volver a guardar la misma cosa con la misma visibilidad la ACTUALIZA y conserva sus estrellas y sus usos, como un push
 * a un repo. Guardar pública no toca la privada (cada una es su fila).
 */
export async function guardarCreacion(
  ws: number,
  input: { tipo: TipoCreacion; origenId: string; visibilidad: Visibilidad; titulo?: unknown; descripcion?: unknown; autorNombre?: unknown },
  quien: string,
): Promise<{ id: number; actualizada: boolean; titulo: string; estado: EstadoCreacion }> {
  const no = porQueNoSePublica(input.tipo);
  if (no || !estaEnchufado(input.tipo)) throw new CreacionError(no ?? 'Ese tipo no se puede guardar como plantilla.');
  let exp: { definicion: unknown; nombre: string };
  try {
    exp = await ENCHUFES[input.tipo].exportar(input.origenId);
  } catch (e) {
    if (e instanceof NoExisteError) throw new CreacionError(e.message, 404);
    throw e;
  }
  const datos = sanearPublicacion({ titulo: input.titulo || exp.nombre, descripcion: input.descripcion, autorNombre: input.autorNombre });
  if ('error' in datos) throw new CreacionError(datos.error);
  const estado: EstadoCreacion = input.visibilidad === 'privada' ? 'privada' : 'publicada';
  const lista = estado === 'publicada'
    ? await paraTodos(ws, input.tipo, exp.definicion, datos)
    : { definicion: exp.definicion, titulo: datos.titulo, descripcion: datos.descripcion };
  const definicion = lista.definicion;
  const titulo = lista.titulo.slice(0, 80) || 'Plantilla';
  if (!definicionCabe(definicion, topeDe(input.tipo))) throw new CreacionError('Es demasiado grande para guardarla como plantilla.');
  const deMako = ws === (await wsSuperAdmin());
  const db = getSupabaseServer();
  const { data: ya, error: eYa } = await db.from('creaciones').select('id').eq('workspace_origen', ws).eq('tipo', input.tipo)
    .eq('origen_id', input.origenId).eq('estado', estado).order('id', { ascending: false }).limit(1);
  if (eYa) tirar('guardar la plantilla', eYa);
  const fila = {
    titulo, descripcion: lista.descripcion, autor_nombre: datos.autorNombre, definicion,
    publicado_por: quien.slice(0, 200), de_mako: deMako, updated_at: new Date().toISOString(),
  };
  const existente = ((ya ?? []) as Array<{ id: number }>)[0];
  if (existente) {
    const { error } = await db.from('creaciones').update(fila).eq('id', existente.id);
    if (error) tirar('actualizar la plantilla', error);
    return { id: existente.id, actualizada: true, titulo, estado };
  }
  const { data, error } = await db.from('creaciones').insert({ ...fila, estado, tipo: input.tipo, workspace_origen: ws, origen_id: input.origenId }).select('id').single();
  if (error || !data) tirarEstado('guardar la plantilla', error ?? { message: 'no se creó' });
  return { id: (data as { id: number }).id, actualizada: false, titulo, estado };
}

/** Publica para todos (lo de siempre de /creaciones y de `publicar_creacion`): guardar con visibilidad pública. */
export async function publicarCreacion(
  ws: number,
  input: { tipo: TipoCreacion; origenId: string; titulo?: unknown; descripcion?: unknown; autorNombre?: unknown },
  quien: string,
): Promise<{ id: number; actualizada: boolean; titulo: string }> {
  const r = await guardarCreacion(ws, { ...input, visibilidad: 'publica' }, quien);
  return { id: r.id, actualizada: r.actualizada, titulo: r.titulo };
}

/**
 * COMPARTE con la comunidad una plantilla privada de este negocio: crea (o actualiza) su copia PÚBLICA, limpia, desde lo
 * guardado (la cosa de origen puede no existir ya). La privada queda: es la de este negocio, con sus datos.
 */
export async function compartirCreacion(ws: number, id: number, quien: string, autorNombre?: unknown): Promise<{ id: number; actualizada: boolean; titulo: string }> {
  const f = await filaDe(id, true);
  if (!f || f.workspace_origen !== ws || f.estado !== 'privada') throw new CreacionError(`No existe la plantilla #${id} en tu negocio.`, 404);
  const t = f.tipo as TipoCreacion;
  if (!estaEnchufado(t)) throw new CreacionError(porQueNoSePublica(t) ?? 'Todavía no se puede compartir.');
  const lista = await paraTodos(ws, t, f.definicion, { titulo: f.titulo, descripcion: f.descripcion });
  const definicion = lista.definicion;
  if (!definicionCabe(definicion, topeDe(t))) throw new CreacionError('Es demasiado grande para compartirla.');
  const autor = sanearPublicacion({ titulo: f.titulo, descripcion: f.descripcion, autorNombre: autorNombre ?? f.autor_nombre });
  if ('error' in autor) throw new CreacionError(autor.error);
  const titulo = lista.titulo.slice(0, 80) || 'Plantilla';
  const db = getSupabaseServer();
  const fila = {
    titulo, descripcion: lista.descripcion, autor_nombre: autor.autorNombre, definicion,
    publicado_por: quien.slice(0, 200), de_mako: ws === (await wsSuperAdmin()), updated_at: new Date().toISOString(),
  };
  let q = db.from('creaciones').select('id').eq('workspace_origen', ws).eq('tipo', t).eq('estado', 'publicada');
  q = f.origen_id ? q.eq('origen_id', f.origen_id) : q.is('origen_id', null).eq('titulo', titulo);
  const { data: ya, error: eYa } = await q.order('id', { ascending: false }).limit(1);
  if (eYa) tirar('compartir la plantilla', eYa);
  const existente = ((ya ?? []) as Array<{ id: number }>)[0];
  if (existente) {
    const { error } = await db.from('creaciones').update(fila).eq('id', existente.id);
    if (error) tirar('compartir la plantilla', error);
    return { id: existente.id, actualizada: true, titulo };
  }
  const { data, error } = await db.from('creaciones').insert({ ...fila, estado: 'publicada', tipo: t, workspace_origen: ws, origen_id: f.origen_id }).select('id').single();
  if (error || !data) tirar('compartir la plantilla', error ?? { message: 'no se creó' });
  return { id: (data as { id: number }).id, actualizada: false, titulo };
}

/**
 * Las plantillas de UN tipo para «Nuevo …» de su tab: las de este negocio (privadas y compartidas) y las más valoradas
 * de la comunidad. Sin la 0273, vacío: la tab se dibuja con las suyas de siempre.
 */
export async function plantillasDelTipo(ws: number, tipo: TipoCreacion, comunidad = 6): Promise<{ mias: Creacion[]; comunidad: Creacion[] }> {
  const db = getSupabaseServer();
  const [m, c] = await Promise.all([
    db.from('creaciones').select(COLS).eq('workspace_origen', ws).eq('tipo', tipo).in('estado', ['privada', 'publicada'])
      .order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(40),
    db.from('creaciones').select(COLS).eq('tipo', tipo).eq('estado', 'publicada').neq('workspace_origen', ws)
      .order('estrellas', { ascending: false }).order('usos', { ascending: false }).order('id', { ascending: false }).limit(Math.max(0, comunidad)),
  ]);
  if (m.error) { if (faltaLaTabla(m.error)) return { mias: [], comunidad: [] }; tirar('tus plantillas', m.error); }
  if (c.error) tirar('las plantillas de la comunidad', c.error);
  const mias = (m.data ?? []) as Fila[];
  const otras = (c.data ?? []) as Fila[];
  const con = await estrellasDe(ws, otras.map((x) => x.id));
  return { mias: mias.map((x) => vista(x, ws, false)), comunidad: otras.map((x) => vista(x, ws, con.has(x.id))) };
}

export type CreacionRankeada = Rankeada<Creacion>;

/**
 * El RANKING de lo publicado: en la semana o el mes, por las estrellas que recibió en ese período; de siempre, por las
 * de siempre (lib/creaciones-reglas.ts → `rankear`). Las estrellas del período se cuentan en memoria, de a páginas: el
 * techo de 1000 filas de PostgREST no da error (AGENTS.md).
 */
export async function rankingCreaciones(ws: number, f: { periodo: PeriodoRanking; tipo?: TipoCreacion | null }, ahora = new Date()): Promise<CreacionRankeada[]> {
  const db = getSupabaseServer();
  const desde = desdeDelPeriodo(f.periodo, ahora);
  let delPeriodo: Map<number, number> | null = null;
  let ids: number[] | null = null;
  if (desde) {
    delPeriodo = new Map();
    const conteo = delPeriodo;
    await leerPorPaginas<{ creacion_id: number }>(db, 'creacion_estrellas', 'creacion_id, workspace_estrella', (filas) => {
      for (const r of filas) conteo.set(r.creacion_id, (conteo.get(r.creacion_id) ?? 0) + 1);
    }, { orden: ['creacion_id', 'workspace_estrella'], filtros: (q) => q.gte('created_at', desde.toISOString()) });
    ids = [...conteo.keys()];
    if (!ids.length) return [];
  }
  const filas: Fila[] = [];
  if (ids) {
    for (let i = 0; i < ids.length; i += 200) {
      let q = db.from('creaciones').select(COLS).eq('estado', 'publicada').in('id', ids.slice(i, i + 200));
      if (f.tipo) q = q.eq('tipo', f.tipo);
      const { data, error } = await q;
      if (error) tirar('el ranking', error);
      filas.push(...((data ?? []) as Fila[]));
    }
  } else {
    let q = db.from('creaciones').select(COLS).eq('estado', 'publicada');
    if (f.tipo) q = q.eq('tipo', f.tipo);
    const { data, error } = await q.order('estrellas', { ascending: false }).order('usos', { ascending: false }).order('id', { ascending: true }).limit(100);
    if (error) tirar('el ranking', error);
    filas.push(...((data ?? []) as Fila[]));
  }
  const top = rankear(filas, delPeriodo);
  const con = await estrellasDe(ws, top.map((x) => x.id));
  return top.map((x) => ({ ...vista(x, ws, con.has(x.id)), puesto: x.puesto, delPeriodo: x.delPeriodo }));
}

/** Retira una creación de la galería (su autor, o la plataforma). No la borra: quien la usó tiene su copia. */
export async function retirarCreacion(ws: number, id: number): Promise<{ yaEstaba: boolean; titulo: string }> {
  const f = await filaDe(id);
  // Una privada no la ve nadie más, tampoco la plataforma: para cualquier otro negocio no existe.
  if (!f || !puedeVer({ workspaceOrigen: f.workspace_origen, estado: f.estado }, ws)) throw new CreacionError(`No existe la creación #${id}.`, 404);
  if (!puedeRetirar({ workspaceOrigen: f.workspace_origen }, ws, ws === (await wsSuperAdmin()))) throw new CreacionError('Sólo la retira quien la publicó.', 403);
  if (f.estado === 'retirada') return { yaEstaba: true, titulo: f.titulo };
  const { error } = await getSupabaseServer().from('creaciones').update({ estado: 'retirada', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) tirar('retirar la creación', error);
  return { yaEstaba: false, titulo: f.titulo };
}

/** La estrella de ESTE negocio. Darla dos veces no suma dos (la PK lo impide): vuelve `yaEstaba`. */
export async function darEstrella(ws: number, id: number, quien: string): Promise<{ yaEstaba: boolean; estrellas: number; titulo: string }> {
  const f = await filaDe(id);
  if (!f || !puedeVer({ workspaceOrigen: f.workspace_origen, estado: f.estado }, ws)) throw new CreacionError(`No existe la creación #${id}.`, 404);
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
  if (!f || !puedeUsar({ workspaceOrigen: f.workspace_origen, estado: f.estado }, ws)) throw new CreacionError(`No existe la creación #${id}, o ya no está publicada.`, 404);
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
