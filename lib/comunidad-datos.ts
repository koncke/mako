import 'server-only';

// =============================================================================
// comunidad-datos — leer y escribir la comunidad de un producto (tipo Skool)
// =============================================================================
// Lo usan la tab del equipo (/customer-success/comunidad, por sus server actions) y el portal del
// alumno (/api/compartido/comunidad, con el token de su link). Las reglas puras viven en
// lib/comunidad-reglas.ts y lib/comunidad-niveles.ts; el modelo y su porqué, en la cabecera de
// supabase/migrations/0217_comunidad.sql; las decisiones, en docs/diseno-curso-skool.md (D8).
//
// ⚠️ TODO RECIBE UN `Actor` YA RESUELTO, y el actor sale de la SESIÓN (el equipo) o de la FIRMA del
//    token (el alumno), nunca de un parámetro del pedido. Acá adentro se vuelve a preguntar cada
//    permiso (`puedeBorrar`, `puedeFijar`…) antes de escribir: esconder un botón no protege nada.
//
// ⚠️ EL WORKSPACE VA A MANO EN CADA CONSULTA (`.eq('workspace_id', ws)` y `workspace_id` en cada
//    insert), y no por `getTenantDb()`. Las tablas de la 0217 todavía NO están en TENANT_TABLES
//    (lib/workspace.ts) y para una tabla que no está ahí `getTenantDb()` es PASSTHROUGH: devolvería
//    los posts de TODOS los negocios sin un solo error (AGENTS.md, `avisos_programados`). Con el
//    filtro escrito acá, registrarlas después no cambia nada — y olvidarse de registrarlas tampoco abre
//    nada. `leads`, `curso_accesos` y `usuarios` también llevan su `.eq` explícito por lo mismo.
//
// ⚠️ LOS PUNTOS SE CUENTAN, NO SE GUARDAN: cada fila de `comunidad_likes` es un punto para su
//    `autor_miembro`. Sacar el like borra la fila y el punto se va solo.
//
// LA SEGUNDA MITAD vive en tres módulos hermanos que usan las puertas de acá (`de`, `actorDelAlumno`,
// `miembrosDeLaComunidad`…): el calendario (lib/comunidad-calendario.ts), la campana y los
// seguimientos (lib/comunidad-campana.ts) y la moderación (lib/comunidad-moderacion.ts). El About y la
// búsqueda están acá abajo.

import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { leerTodo } from './supabase-paginado';
import { esDelProducto } from '@/app/customer-success/pertenencia';
import {
  NIVEL_MAX, nivelDe, puntosParaSubir, nombreDeNivel, sanearNombresNivel, distribucionDeNiveles,
} from './comunidad-niveles';
import {
  claveDeLead, claveDeUsuario, leerClave, esClaveDeEquipo, idValido,
  extracto, tokensDeTexto, videoDePost, encuestaGuardada, resultadosEncuesta, mencionesGuardadas,
  padreDeRespuesta, arbolDeComentarios, validarPost, validarComentario, validarCategoria,
  puedeEditar, puedeBorrar, puedeFijar, puedeConfigurar, puedeDarLike, hayLugarParaFijar, puedePostearPorNivel, puedePublicarEnLaComunidad,
  consultaDeOrden, ordenarPorLikes, esOrden, puntosPorMiembro, tablaDeRanking, enLinea, fotoDeLead,
  sanearPerfil, linksGuardados, aperturasPorNivel, nombreCoincide, esMimeAdjunto, esImagen, pathDeAdjunto,
  pathEsDeLaComunidad, sanearTexto, puedeComentar, puedeModerar, puedeEditarAbout, puedeGestionarEventos, puedeSacar,
  sanearAbout, textoDeAbout, patronDeBusqueda, textoCoincide,
  BUCKET_COMUNIDAD, PAGINA_FEED, TOPE_ADJUNTO_BYTES, MAX_FIJADOS, MIN_BUSQUEDA,
  type ActorRegla, type CategoriaRegla, type OrdenFeed, type PermisoCategoria,
} from './comunidad-reglas';
import { destinatarios, avisosDeComentario, type AvisoPendiente } from './comunidad-notificaciones';
import { esZonaValida } from './comunidad-eventos';
import { moduloPermitido, type AlcanceCurso } from './curso-alcance';
import type {
  MiembroVista, CategoriaVista, PostVista, PostDetalle, ComentarioVista, FeedVista, ComunidadVista,
  YoVista, FilaRanking, RankingVista, MiembroDirectorio, MiembrosVista, PerfilVista, FiltroMiembros,
  Resultado, AdjuntoVista, AboutVista, BusquedaVista,
} from './comunidad-tipos';

// ── Quién actúa ───────────────────────────────────────────────────────────────────

/**
 * Quién actúa, sobre QUÉ comunidad. Lo arman:
 *   · la action del equipo (app/customer-success/comunidad/actions.ts) desde la sesión, después de
 *     comprobar que el producto es de su workspace;
 *   · la ruta del alumno (`actorDelAlumno`, abajo) desde la firma del token.
 */
export type Actor = ActorRegla & {
  ws: number;
  productoId: number;
  /** El lead del alumno; `null` en el equipo. */
  leadId: number | null;
  /** Su nombre al actuar (se guarda en `autor_nombre` como respaldo). */
  nombre: string;
  /**
   * Los módulos del curso que ve el ALUMNO (mig 0219, lib/curso-alcance.ts): decide si entra a un
   * evento «con un módulo». `null` = todos. Lo trae la MISMA lectura que abre su token
   * (`resolverAccesoPortal`); en el equipo no aplica.
   */
  alcance?: AlcanceCurso;
};

export const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

// ── El acceso a las tablas, con el workspace puesto ──────────────────────────────

export type TablaComunidad =
  | 'comunidad_ajustes' | 'comunidad_categorias' | 'comunidad_posts' | 'comunidad_comentarios'
  | 'comunidad_likes' | 'comunidad_votos' | 'comunidad_perfiles' | 'comunidad_notificaciones'
  | 'comunidad_baneos' | 'comunidad_seguimientos' | 'comunidad_eventos';

export type Fila = Record<string, unknown>;
const conWs = (filas: Fila | Fila[], ws: number) =>
  Array.isArray(filas) ? filas.map((f) => ({ ...f, workspace_id: ws })) : { ...filas, workspace_id: ws };

/**
 * Una tabla de la comunidad con el workspace YA puesto: cada select, update y delete sale con
 * `.eq('workspace_id', ws)` y cada insert/upsert con `workspace_id: ws`. Es la única puerta de este
 * archivo —y de sus tres hermanos de la segunda mitad— a las tablas de la 0217 (ver la cabecera: no
 * se confía en `getTenantDb`).
 */
export function de(ws: number, t: TablaComunidad) {
  const sb = getSupabaseServer();
  return {
    // ⚠️ NO GENÉRICO, y no es estilo: TIRABA EL TYPECHECK DEL REPO ENTERO (08/10/2026). Con
    // `<Q extends string>` supabase-js corre su parser de tipos sobre CADA lista de columnas (40
    // llamadas, hasta 20 columnas) contra la UNIÓN de las 11 tablas de `t`, y `tsc` se quedaba sin
    // memoria a 4, 8 y 14 GB — o sea que el pre-push de TODAS las sesiones quedaba bloqueado. Con
    // `string` a secas tipa cada fila como un error de parseo, por eso va como `'*'`: el parser ve un
    // asterisco (filas `any`) y cada llamada castea a su `Fila…`, que es lo que ya hacía.
    select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => sb.from(t).select(cols as '*', opts).eq('workspace_id', ws),
    insert: (filas: Fila | Fila[]) => sb.from(t).insert(conWs(filas, ws)),
    upsert: (filas: Fila | Fila[], opts: { onConflict: string; ignoreDuplicates?: boolean }) => sb.from(t).upsert(conWs(filas, ws), opts),
    update: (vals: Fila) => sb.from(t).update(vals).eq('workspace_id', ws),
    delete: () => sb.from(t).delete().eq('workspace_id', ws),
  };
}

/** Parte una lista en lotes (un `.in()` con miles de ids arma una URL que PostgREST rechaza). */
export function lotes<T>(lista: readonly T[], n = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}

// ── Las filas ─────────────────────────────────────────────────────────────────────

export const COLS_POST = 'id, producto_id, categoria_id, miembro, lead_id, autor_nombre, titulo, cuerpo, menciones, video_url, adjunto_path, adjunto_nombre, adjunto_mime, adjunto_bytes, encuesta, fijado_at, actividad_at, editado_at, comentarios_cerrados_at, created_at';
export type FilaPost = {
  id: number; producto_id: number; categoria_id: number | null; miembro: string; lead_id: number | null;
  autor_nombre: string; titulo: string; cuerpo: string; menciones: unknown; video_url: string | null;
  adjunto_path: string | null; adjunto_nombre: string | null; adjunto_mime: string | null; adjunto_bytes: number | null;
  encuesta: unknown; fijado_at: string | null; actividad_at: string; editado_at: string | null;
  comentarios_cerrados_at: string | null; created_at: string;
};

const COLS_COMENTARIO = 'id, post_id, padre_id, miembro, lead_id, autor_nombre, cuerpo, menciones, editado_at, created_at';
type FilaComentario = {
  id: number; post_id: number; padre_id: number | null; miembro: string; lead_id: number | null;
  autor_nombre: string; cuerpo: string; menciones: unknown; editado_at: string | null; created_at: string;
};

const COLS_CATEGORIA = 'id, nombre, permiso, orden_default, orden';
type FilaCategoria = { id: number; nombre: string; permiso: PermisoCategoria; orden_default: OrdenFeed; orden: number };

const aCategoria = (f: FilaCategoria): CategoriaVista => ({
  id: Number(f.id), nombre: f.nombre, permiso: f.permiso === 'equipo' ? 'equipo' : 'todos',
  ordenDefault: esOrden(f.orden_default) ? f.orden_default : 'default',
});

/** El lead de una clave de alumno, o `null` (equipo). Es lo que va en las columnas `*lead_id`. */
export const leadDe = (clave: string): number | null => { const c = leerClave(clave); return c?.tipo === 'alumno' ? c.id : null; };

// ── Lecturas de base ──────────────────────────────────────────────────────────────

/** ¿El producto es de este workspace? Lo pregunta la action del equipo antes de armar el actor. */
export async function productoDelWorkspace(ws: number, productoId: number): Promise<{ id: number; nombre: string } | null> {
  if (!Number.isInteger(productoId) || productoId <= 0) return null;
  const { data, error } = await getSupabaseServer().from('productos').select('id, nombre')
    .eq('workspace_id', ws).eq('id', productoId).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { id: number; nombre: string | null } | null;
  return f ? { id: Number(f.id), nombre: (f.nombre ?? '').trim() || 'Comunidad' } : null;
}

type Ajustes = { nombre: string | null; descripcion: string; nombresNivel: string[]; nivelParaPostear: number };
export async function leerAjustes(ws: number, productoId: number): Promise<Ajustes> {
  const { data, error } = await de(ws, 'comunidad_ajustes').select('nombre, descripcion, nombres_nivel, nivel_para_postear')
    .eq('producto_id', productoId).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { nombre: string | null; descripcion: string | null; nombres_nivel: unknown; nivel_para_postear: number | null } | null;
  return {
    nombre: f?.nombre?.trim() || null,
    descripcion: f?.descripcion ?? '',
    nombresNivel: sanearNombresNivel(f?.nombres_nivel),
    nivelParaPostear: Math.min(NIVEL_MAX, Math.max(1, Number(f?.nivel_para_postear) || 1)),
  };
}

async function categoriasDe(ws: number, productoId: number): Promise<CategoriaVista[]> {
  const { data, error } = await de(ws, 'comunidad_categorias').select(COLS_CATEGORIA)
    .eq('producto_id', productoId).order('orden').order('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaCategoria[]).map(aCategoria);
}

const aRegla = (c: CategoriaVista): CategoriaRegla => ({ id: c.id, nombre: c.nombre, permiso: c.permiso });

/** Los puntos de unos miembros (likes recibidos en este producto). Sólo los pedidos. */
async function puntosDe(ws: number, productoId: number, claves: readonly string[]): Promise<Map<string, number>> {
  const unicas = [...new Set(claves)];
  const out = new Map<string, number>();
  for (const lote of lotes(unicas)) {
    const filas = await leerTodo<{ id: number; autor_miembro: string; created_at: string }>(
      getSupabaseServer(), 'comunidad_likes', 'id, autor_miembro, created_at',
      { orden: 'id', eq: { workspace_id: ws, producto_id: productoId }, filtros: (q) => q.in('autor_miembro', lote) },
    );
    for (const [k, n] of puntosPorMiembro(filas.map((f) => ({ autor: f.autor_miembro, creado: f.created_at })))) out.set(k, n);
  }
  return out;
}

/** Todos los likes del producto (el ranking y el directorio los cuentan en memoria). */
async function likesDelProducto(ws: number, productoId: number): Promise<Array<{ autor: string; creado: string }>> {
  const filas = await leerTodo<{ id: number; autor_miembro: string; created_at: string }>(
    getSupabaseServer(), 'comunidad_likes', 'id, autor_miembro, created_at',
    { orden: 'id', eq: { workspace_id: ws, producto_id: productoId } },
  );
  return filas.map((f) => ({ autor: f.autor_miembro, creado: f.created_at }));
}

/** Los puntos de UN miembro: un conteo, sin traer las filas. */
export async function contarPuntos(ws: number, productoId: number, clave: string): Promise<number> {
  const { count, error } = await de(ws, 'comunidad_likes').select('id', { count: 'exact', head: true })
    .eq('producto_id', productoId).eq('autor_miembro', clave);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Los puntos de un ALUMNO en la comunidad de un producto: el contrato que usa el bloqueo por nivel
 * del curso (`{ tipo: 'nivel', nivel }`, lib/curso-bloqueo.ts). Corre en el workspace del CONTEXTO
 * (sesión o `runWithWorkspace` con el de la firma).
 *
 * ⚠️ TIRA SI NO PUEDE LEER, y no devuelve 0: «no pude leer» no es «no tiene puntos». Quien decide si
 *    abre una clase decide también qué hacer con la duda (lo más seguro es dejarla cerrada esa vez).
 */
export async function puntosDeLead(productoId: number, leadId: number): Promise<number> {
  const ws = await getWorkspaceActual();
  if (!ws) throw new Error('No hay un negocio en el contexto.');
  if (!Number.isInteger(productoId) || productoId <= 0 || !Number.isInteger(leadId) || leadId <= 0) return 0;
  return contarPuntos(ws, productoId, claveDeLead(leadId));
}

// ── Las caras: nombres y fotos ────────────────────────────────────────────────────

export type Info = { nombre: string; foto: string | null };

/**
 * El nombre y la foto de cada clave: el equipo desde `usuarios`, el alumno desde su lead. Lo que no se
 * pudo leer cae al `respaldo` (el `autor_nombre` guardado al escribir) o a «Miembro»: una cara sin
 * nombre no tumba el feed. NO tira.
 */
export async function infoDeMiembros(ws: number, claves: Iterable<string>, respaldo: ReadonlyMap<string, string> = new Map()): Promise<Map<string, Info>> {
  const usuarios = new Set<number>();
  const leads = new Set<number>();
  for (const k of claves) {
    const c = leerClave(k);
    if (c) (c.tipo === 'equipo' ? usuarios : leads).add(c.id);
  }
  const out = new Map<string, Info>();
  const sb = getSupabaseServer();
  try {
    await Promise.all([
      ...lotes([...usuarios]).map(async (ids) => {
        // Sin filtro de workspace a propósito: un post del super admin lo firma alguien que no es una
        // fila del workspace, y de esta fila sólo sale su nombre y su foto.
        const { data, error } = await sb.from('usuarios').select('id, nombre, foto_url').in('id', ids);
        if (error) throw new Error(error.message);
        for (const f of (data ?? []) as Array<{ id: number; nombre: string | null; foto_url: string | null }>) {
          out.set(claveDeUsuario(Number(f.id)), { nombre: (f.nombre ?? '').trim(), foto: f.foto_url && /^https:\/\//i.test(f.foto_url) ? f.foto_url : null });
        }
      }),
      ...lotes([...leads]).map(async (ids) => {
        const { data, error } = await sb.from('leads').select('id, nombre, avatar_url, icono, foto_auto_url')
          .eq('workspace_id', ws).in('id', ids);
        if (error) throw new Error(error.message);
        for (const f of (data ?? []) as Array<{ id: number; nombre: string | null; avatar_url: string | null; icono: string | null; foto_auto_url: string | null }>) {
          out.set(claveDeLead(Number(f.id)), { nombre: (f.nombre ?? '').trim(), foto: fotoDeLead(f) });
        }
      }),
    ]);
  } catch (e) {
    console.warn('[comunidad] no pude leer los nombres:', msg(e, ''));
  }
  for (const k of new Set([...usuarios].map(claveDeUsuario).concat([...leads].map(claveDeLead)))) {
    const i = out.get(k);
    if (!i || !i.nombre) out.set(k, { nombre: respaldo.get(k)?.trim() || i?.nombre || 'Miembro', foto: i?.foto ?? null });
  }
  return out;
}

export const miembroVista = (clave: string, info: Map<string, Info>, puntos: ReadonlyMap<string, number>): MiembroVista => {
  const i = info.get(clave);
  return { clave, nombre: i?.nombre || 'Miembro', foto: i?.foto ?? null, nivel: nivelDe(puntos.get(clave) ?? 0), equipo: esClaveDeEquipo(clave) };
};

// ── Quiénes son miembros ──────────────────────────────────────────────────────────

type MiembroBase = { clave: string; desde: string | null };
export type Comunidad = { equipo: Map<string, MiembroBase>; alumnos: Map<string, MiembroBase & { leadId: number }> };

/**
 * Los miembros de la comunidad de un producto, DERIVADOS (no hay una tabla de miembros que se
 * desincronice):
 *   · el EQUIPO: las cuentas del workspace que no están suspendidas;
 *   · los ALUMNOS: los clientes ganados que son de ESE producto (la misma regla del kanban de Customer
 *     Success: su casa del CRM o una fila en `cliente_entrega`) y tienen el acceso al curso VIGENTE
 *     (`curso_accesos` del cliente, sin revocar), menos los baneados de esta comunidad.
 *
 * ⚠️ TIRA SI CUALQUIER LECTURA FALLA (`universoDeLaEntrega` es la lectura estricta): con la entrega
 *    caída, «nadie es miembro» se leería como una comunidad vacía.
 * ⚠️ CORRE EN EL WORKSPACE DEL CONTEXTO, y se comprueba que sea el del actor: la entrega se lee con
 *    `getTenantDb()`, y un contexto distinto mezclaría los clientes de otro negocio.
 */
/** La fila del acceso al curso que hace miembro a un alumno. (Un alias y no el tipo en línea: el guard de
 * tests/curso-accesos-area.test.ts corta la sentencia en el primer punto y coma, y uno adentro del
 * genérico la dejaba sin el filtro de área a la vista.) */
type FilaAccesoMiembro = { id: number; lead_id: number; created_at: string; revocado_at: string | null };

export async function miembrosDeLaComunidad(ws: number, productoId: number): Promise<Comunidad> {
  if ((await getWorkspaceActual()) !== ws) throw new Error('El negocio del pedido no coincide.');
  const sb = getSupabaseServer();
  const { universoDeLaEntrega } = await import('@/app/customer-success/entrega');
  const [u, usuarios, accesos, baneos] = await Promise.all([
    universoDeLaEntrega(),
    sb.from('usuarios').select('id, created_at, estado').eq('workspace_id', ws),
    leerTodo<FilaAccesoMiembro>(
      sb, 'curso_accesos', 'id, lead_id, created_at, revocado_at',
      { orden: 'id', eq: { workspace_id: ws }, filtros: (q) => q.is('area', null) },
    ),
    de(ws, 'comunidad_baneos').select('miembro').eq('producto_id', productoId).is('levantado_at', null),
  ]);
  if (usuarios.error) throw new Error(usuarios.error.message);
  if (baneos.error) throw new Error(baneos.error.message);

  const equipo = new Map<string, MiembroBase>();
  for (const f of (usuarios.data ?? []) as Array<{ id: number; created_at: string | null; estado: string | null }>) {
    if (f.estado === 'suspendido') continue;
    const k = claveDeUsuario(Number(f.id));
    equipo.set(k, { clave: k, desde: f.created_at ?? null });
  }

  const vigente = new Map<number, string>();
  for (const a of accesos) if (!a.revocado_at) vigente.set(Number(a.lead_id), a.created_at);
  const baneados = new Set(((baneos.data ?? []) as Array<{ miembro: string }>).map((b) => b.miembro));
  const asignacion = u.filas[productoId] ?? {};
  const alumnos = new Map<string, MiembroBase & { leadId: number }>();
  for (const g of u.ganados) {
    const leadId = Number(g.id);
    if (!vigente.has(leadId)) continue;
    if (!esDelProducto(leadId, productoId, u.casa, asignacion)) continue;
    const k = claveDeLead(leadId);
    if (baneados.has(k)) continue;
    alumnos.set(k, { clave: k, desde: vigente.get(leadId) ?? null, leadId });
  }
  return { equipo, alumnos };
}

/** ¿Esta clave es miembro? (el equipo siempre es del workspace; el alumno, de este producto). */
export const esMiembroDe = (c: Comunidad) => (k: string) => c.equipo.has(k) || c.alumnos.has(k);

/**
 * Los nombres de los que se PIDE mencionar, sólo si son miembros de esta comunidad. Es lo que
 * `sanearMenciones` usa para decidir: lo que no está acá no se menciona (ni notifica).
 */
async function nombresMencionables(a: Actor, pedidas: unknown): Promise<Map<string, string>> {
  const claves = Array.isArray(pedidas) ? pedidas.map(leerClave).filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.clave) : [];
  if (!claves.length) return new Map();
  const comunidad = await miembrosDeLaComunidad(a.ws, a.productoId);
  const validas = claves.filter(esMiembroDe(comunidad)).slice(0, 40);
  const info = await infoDeMiembros(a.ws, validas);
  return new Map(validas.map((k) => [k, info.get(k)?.nombre ?? '']));
}

// ── El portón del alumno ──────────────────────────────────────────────────────────

/**
 * El actor de un ALUMNO que abre la comunidad con el token de su portal, o `null` (no entra: 404).
 *
 * Valida, ADENTRO del workspace de la firma (quien llama envuelve en `runWithWorkspace(firma.ws)`):
 *   · que el token abra (`resolverAccesoPortal`: versión vigente, no revocado, lead ganado);
 *   · que NO sea el link de un LÍDER de área (`c2.`): el líder no es un miembro, y con su link
 *     escribiría con el nombre del cliente;
 *   · que el producto sea uno de SUS productos (la misma regla que el portal del curso);
 *   · que no esté baneado de esta comunidad.
 * Un rechazo es siempre `null`, sin decir cuál: contestar distinto ayudaría a enumerar.
 */
export async function actorDelAlumno(token: string, productoId: number): Promise<Actor | null> {
  if (!Number.isInteger(productoId) || productoId <= 0) return null;
  const { resolverAccesoPortal, productosDelAlumno } = await import('./curso-datos');
  const acceso = await resolverAccesoPortal(token);
  if (!acceso || acceso.area != null) return null;
  if ((await getWorkspaceActual()) !== acceso.ws) return null;
  const productos = await productosDelAlumno(acceso.leadId);
  if (!productos.includes(productoId)) return null;
  const clave = claveDeLead(acceso.leadId);
  const [{ data: ban, error: e1 }, { data: lead, error: e2 }] = await Promise.all([
    de(acceso.ws, 'comunidad_baneos').select('id').eq('producto_id', productoId).eq('miembro', clave).is('levantado_at', null).maybeSingle(),
    getSupabaseServer().from('leads').select('nombre').eq('workspace_id', acceso.ws).eq('id', acceso.leadId).maybeSingle(),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  // ⚠️ SACADO = NO ENTRA, NI A LEER: este `null` es un 404 para TODA acción de la ruta del alumno
  //    (feed, post, calendario, campana, búsqueda…), porque todas pasan por acá antes del `switch`.
  //    Lo fija tests/comunidad-moderacion.test.ts.
  if (ban) return null;
  return {
    ws: acceso.ws, productoId, clave, leadId: acceso.leadId, equipo: false, adminWs: false,
    nombre: ((lead as { nombre: string | null } | null)?.nombre ?? '').trim() || 'Alumno',
    alcance: acceso.alcance ?? null,
  };
}

// ── La presencia («en línea») ─────────────────────────────────────────────────────

const ultimoLatido = new Map<string, number>();

/**
 * Anota que este miembro está activo (`comunidad_perfiles.ultima_actividad_at`). «En línea» = los
 * últimos 5 minutos. No tira: un contador que falla no puede cortar el pedido que lo disparó.
 *
 * ⚠️ UNA ESCRITURA POR MINUTO Y POR PERSONA COMO MUCHO (por instancia): el feed, los likes y el
 *    latido del portal llaman acá en cada pedido, y la ventana de 5 minutos no necesita más.
 */
export async function marcarActividad(ws: number, clave: string): Promise<void> {
  const c = leerClave(clave);
  if (!c || !Number.isInteger(ws) || ws <= 0) return;
  const k = `${ws}:${c.clave}`;
  const ahora = Date.now();
  if ((ultimoLatido.get(k) ?? 0) > ahora - 60_000) return;
  if (ultimoLatido.size > 5000) for (const [x, t] of ultimoLatido) if (t < ahora - 60_000) ultimoLatido.delete(x);
  ultimoLatido.set(k, ahora);
  try {
    // Upsert con SÓLO estas columnas: el ON CONFLICT actualiza las que vienen, no pisa la bio.
    const { error } = await de(ws, 'comunidad_perfiles').upsert(
      { miembro: c.clave, lead_id: leadDe(c.clave), ultima_actividad_at: new Date(ahora).toISOString() },
      { onConflict: 'workspace_id,miembro' },
    );
    if (error) throw new Error(error.message);
  } catch (e) {
    ultimoLatido.delete(k);
    console.warn('[comunidad] no pude anotar la actividad:', msg(e, ''));
  }
}

/**
 * Lo mismo, para un alumno que anda por el CURSO (no por la comunidad): lo llaman las rutas del portal
 * que ya saben quién es (progreso, tarea). Corre en el workspace del contexto. No tira.
 */
export async function marcarActividadDeLead(leadId: number): Promise<void> {
  try {
    const ws = await getWorkspaceActual();
    if (ws && Number.isInteger(leadId) && leadId > 0) await marcarActividad(ws, claveDeLead(leadId));
  } catch { /* ver arriba */ }
}

// ── Notificaciones (las lee la campana: lib/comunidad-campana.ts) ────────────────

/**
 * Deja las notificaciones de lo que acaba de pasar. Quién recibe qué lo decide `destinatarios`
 * (lib/comunidad-notificaciones.ts, puro y con test): nunca a uno mismo, sólo a claves válidas, y
 * UNA por persona por acción (la de más prioridad: a quien comentan su post y mencionan a la vez le
 * llega una, no dos). NO TIRA: lo publicado ya está guardado y eso es lo que no se puede perder.
 */
export async function notificar(a: Actor, avisos: readonly AvisoPendiente[]): Promise<void> {
  const filas: Fila[] = destinatarios(a.clave, avisos).map((x) => ({
    producto_id: a.productoId, para_miembro: x.para, para_lead_id: leadDe(x.para), tipo: x.tipo,
    de_miembro: a.clave, de_lead_id: a.leadId, post_id: x.postId, comentario_id: x.comentarioId ?? null,
  }));
  if (!filas.length) return;
  try {
    const { error } = await de(a.ws, 'comunidad_notificaciones').insert(filas);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.warn('[comunidad] no pude dejar las notificaciones:', msg(e, ''));
  }
}

// ── Adjuntos ──────────────────────────────────────────────────────────────────────

/** Una hora: lo que dura mirar un post. Al volver a abrirlo se firma de nuevo. */
const VIDA_ADJUNTO_SEG = 3600;

/** Las URLs firmadas de los adjuntos de unos posts. Lo que no se pudo firmar queda sin URL (no tira). */
async function firmarAdjuntos(filas: readonly FilaPost[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const conAdjunto = filas.filter((f) => f.adjunto_path);
  if (!conAdjunto.length) return out;
  const bucket = getSupabaseServer().storage.from(BUCKET_COMUNIDAD);
  await Promise.all(conAdjunto.map(async (f) => {
    try {
      // Lo que no se ve en el navegador (una planilla, un Word) se baja con su nombre original: la
      // ruta es un uuid.
      const opciones = esImagen(f.adjunto_mime) || f.adjunto_mime === 'application/pdf' ? undefined : { download: f.adjunto_nombre || true };
      const { data } = await bucket.createSignedUrl(f.adjunto_path!, VIDA_ADJUNTO_SEG, opciones);
      if (data?.signedUrl) out.set(f.id, data.signedUrl);
    } catch { /* sin URL: la tarjeta dice el nombre y no abre */ }
  }));
  return out;
}

/**
 * La URL firmada para que el NAVEGADOR suba un adjunto directo al bucket (PUT a `signedUrl`, 2 h).
 *
 * ⚠️ SÓLO A QUIEN PUEDE PUBLICAR (`puedePublicarEnLaComunidad`, la regla que apaga «Escribe algo»).
 *    La pantalla no ofrece subir a quien no llega al nivel, pero la acción se pide sola: sin esta
 *    pregunta, un alumno que no puede publicar nada se llevaba URLs de 25 MB de a decenas por minuto,
 *    y un archivo que ningún post nombra se queda en el bucket (todavía no hay purga: ver el informe).
 */
export async function urlSubidaAdjunto(a: Actor, mime: unknown, bytes: unknown): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>> {
  try {
    if (!esMimeAdjunto(mime)) return { ok: false, error: 'Ese formato no va.' };
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'El archivo está vacío.' };
    if (n > TOPE_ADJUNTO_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
    if (!a.equipo) {
      const [ajustes, categorias] = await Promise.all([leerAjustes(a.ws, a.productoId), categoriasDe(a.ws, a.productoId)]);
      const nivel = ajustes.nivelParaPostear > 1 ? nivelDe(await contarPuntos(a.ws, a.productoId, a.clave)) : 1;
      if (!puedePublicarEnLaComunidad(a, nivel, ajustes.nivelParaPostear, categorias.map(aRegla))) {
        return { ok: false, error: 'Aquí no puedes publicar.' };
      }
    }
    const path = pathDeAdjunto(a.ws, a.productoId, mime, randomUUID());
    if (!path) return { ok: false, error: 'No pude armar la subida.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_COMUNIDAD).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? 'No pude firmar la subida.' };
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude preparar la subida.') };
  }
}

/**
 * Borra un adjunto del bucket SÓLO si es de esta comunidad y ningún post lo nombra. Lo usa el
 * compositor al quitar un archivo que subió y no publicó, y el borrado de un post. No tira.
 */
export async function descartarAdjunto(a: Actor, path: unknown): Promise<Resultado> {
  try {
    if (!pathEsDeLaComunidad(path, a.ws, a.productoId)) return { ok: false, error: 'Ese archivo no es de esta comunidad.' };
    const { data, error } = await de(a.ws, 'comunidad_posts').select('id').eq('adjunto_path', path as string).limit(1);
    if (error) return { ok: false, error: error.message };
    if ((data ?? []).length) return { ok: true };
    const { error: e2 } = await getSupabaseServer().storage.from(BUCKET_COMUNIDAD).remove([path as string]);
    if (e2) console.warn(`[comunidad] no pude borrar el adjunto ${String(path)}: ${e2.message}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo descartar.') };
  }
}

// ── Las tarjetas ──────────────────────────────────────────────────────────────────

/** Los likes de unos objetivos (`p:1`, `c:2`): cuántos tiene cada uno y si quien mira dio el suyo. */
async function likesDe(ws: number, objetivos: readonly string[], yo: string): Promise<{ cuenta: Map<string, number>; mios: Set<string> }> {
  const cuenta = new Map<string, number>();
  const mios = new Set<string>();
  for (const lote of lotes([...new Set(objetivos)])) {
    const filas = await leerTodo<{ id: number; objetivo: string; miembro: string }>(
      getSupabaseServer(), 'comunidad_likes', 'id, objetivo, miembro',
      { orden: 'id', eq: { workspace_id: ws }, filtros: (q) => q.in('objetivo', lote) },
    );
    for (const f of filas) {
      cuenta.set(f.objetivo, (cuenta.get(f.objetivo) ?? 0) + 1);
      if (f.miembro === yo) mios.add(f.objetivo);
    }
  }
  return { cuenta, mios };
}

/** Cuántos comentarios tiene cada post. */
async function comentariosPorPost(ws: number, postIds: readonly number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const lote of lotes([...new Set(postIds)])) {
    const filas = await leerTodo<{ id: number; post_id: number }>(
      getSupabaseServer(), 'comunidad_comentarios', 'id, post_id',
      { orden: 'id', eq: { workspace_id: ws }, filtros: (q) => q.in('post_id', lote) },
    );
    for (const f of filas) out.set(Number(f.post_id), (out.get(Number(f.post_id)) ?? 0) + 1);
  }
  return out;
}

/** Los votos de las encuestas de unos posts. */
async function votosDe(ws: number, postIds: readonly number[]): Promise<Map<number, Array<{ opcion: string; miembro: string }>>> {
  const out = new Map<number, Array<{ opcion: string; miembro: string }>>();
  for (const lote of lotes([...new Set(postIds)])) {
    const filas = await leerTodo<{ id: number; post_id: number; opcion: string; miembro: string }>(
      getSupabaseServer(), 'comunidad_votos', 'id, post_id, opcion, miembro',
      { orden: 'id', eq: { workspace_id: ws }, filtros: (q) => q.in('post_id', lote) },
    );
    for (const f of filas) {
      const k = Number(f.post_id);
      out.set(k, [...(out.get(k) ?? []), { opcion: f.opcion, miembro: f.miembro }]);
    }
  }
  return out;
}

/** Arma las tarjetas de unos posts para quien mira. Todo lo que hace falta, en una tanda. */
export async function tarjetas(a: Actor, filas: readonly FilaPost[]): Promise<PostVista[]> {
  if (!filas.length) return [];
  const ids = filas.map((f) => Number(f.id));
  const conEncuesta = filas.filter((f) => encuestaGuardada(f.encuesta)).map((f) => Number(f.id));
  const autores = filas.map((f) => f.miembro);
  const respaldo = new Map(filas.map((f) => [f.miembro, f.autor_nombre]));
  const [likes, comentarios, votos, info, puntos, firmas] = await Promise.all([
    likesDe(a.ws, ids.map((id) => `p:${id}`), a.clave),
    comentariosPorPost(a.ws, ids),
    conEncuesta.length ? votosDe(a.ws, conEncuesta) : Promise.resolve(new Map<number, Array<{ opcion: string; miembro: string }>>()),
    infoDeMiembros(a.ws, autores, respaldo),
    puntosDe(a.ws, a.productoId, autores),
    firmarAdjuntos(filas),
  ]);
  return filas.map((f) => {
    const id = Number(f.id);
    const enc = encuestaGuardada(f.encuesta);
    const video = f.video_url ? videoDePost(f.video_url) : null;
    const adjunto: AdjuntoVista | null = f.adjunto_path && f.adjunto_nombre ? {
      nombre: f.adjunto_nombre, mime: f.adjunto_mime ?? '', bytes: Number(f.adjunto_bytes) || 0,
      imagen: esImagen(f.adjunto_mime), url: firmas.get(id) ?? null,
    } : null;
    return {
      id,
      autor: miembroVista(f.miembro, info, puntos),
      categoriaId: f.categoria_id == null ? null : Number(f.categoria_id),
      titulo: f.titulo,
      extracto: extracto(f.cuerpo),
      creado: f.created_at,
      editado: f.editado_at != null,
      fijado: f.fijado_at != null,
      likes: likes.cuenta.get(`p:${id}`) ?? 0,
      meGusta: likes.mios.has(`p:${id}`),
      comentarios: comentarios.get(id) ?? 0,
      video: video ? { proveedor: video.proveedor, embed: video.embed, url: video.url } : null,
      adjunto,
      encuesta: enc ? resultadosEncuesta(enc, votos.get(id) ?? [], a.clave) : null,
      puedoEditar: puedeEditar(a, f.miembro),
      puedoBorrar: puedeBorrar(a, f.miembro),
      puedoLikear: puedeDarLike(a, f.miembro),
      cerrado: f.comentarios_cerrados_at != null,
    };
  });
}

export async function postDe(a: Actor, postId: number): Promise<FilaPost | null> {
  const { data, error } = await de(a.ws, 'comunidad_posts').select(COLS_POST)
    .eq('producto_id', a.productoId).eq('id', postId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaPost | null) ?? null;
}

// ── Lo que se ve al entrar: la cabecera y la columna lateral ─────────────────────

/** Quien mira, con sus puntos y su nivel. */
function yoVista(a: Actor, info: Map<string, Info>, puntos: number, nombres: readonly string[]): YoVista {
  const i = info.get(a.clave);
  const nivel = nivelDe(puntos);
  return {
    clave: a.clave, nombre: i?.nombre || a.nombre, foto: i?.foto ?? null, nivel, equipo: a.equipo,
    puntos, puntosParaSubir: puntosParaSubir(puntos), nombreNivel: nombreDeNivel(nombres, nivel),
  };
}

/**
 * La comunidad al entrar: nombre, descripción, categorías, quién mira, los conteos (miembros, en línea,
 * equipo) y el top 5 de 30 días de la columna lateral.
 *
 * ⚠️ LOS CONTEOS Y EL TOP SON BEST-EFFORT, Y LO DICEN: si la entrega no se pudo leer van `null` y la
 *    columna dice «—», en vez de un «0 miembros» que se leería como una comunidad vacía.
 */
export async function inicioComunidad(a: Actor): Promise<ComunidadVista> {
  const [ajustes, categorias, producto, puntosYo] = await Promise.all([
    leerAjustes(a.ws, a.productoId),
    categoriasDe(a.ws, a.productoId),
    productoDelWorkspace(a.ws, a.productoId),
    contarPuntos(a.ws, a.productoId, a.clave),
  ]);
  const infoYo = await infoDeMiembros(a.ws, [a.clave], new Map([[a.clave, a.nombre]]));
  const yo = yoVista(a, infoYo, puntosYo, ajustes.nombresNivel);

  let conteos: ComunidadVista['conteos'] = null;
  let top30: FilaRanking[] | null = null;
  try {
    const comunidad = await miembrosDeLaComunidad(a.ws, a.productoId);
    const todos = [...comunidad.equipo.keys(), ...comunidad.alumnos.keys()];
    const actividad = await actividadDe(a.ws, todos);
    const ahora = Date.now();
    conteos = {
      miembros: todos.length,
      enLinea: todos.filter((k) => enLinea(actividad.get(k)?.ultima ?? null, ahora)).length,
      equipo: comunidad.equipo.size,
    };
    const likes = await likesDelProducto(a.ws, a.productoId);
    const filas = tablaDeRanking(puntosPorMiembro(likes, ahora - 30 * 86_400_000), esMiembroDe(comunidad), 5);
    const totales = puntosPorMiembro(likes);
    const info = await infoDeMiembros(a.ws, filas.map((f) => f.clave));
    top30 = filas.map((f) => ({ puesto: f.puesto, puntos: f.puntos, miembro: miembroVista(f.clave, info, totales) }));
  } catch (e) {
    console.warn('[comunidad] no pude leer los miembros:', msg(e, ''));
  }

  return {
    productoId: a.productoId,
    nombre: ajustes.nombre ?? producto?.nombre ?? 'Comunidad',
    descripcion: ajustes.descripcion,
    categorias,
    yo,
    conteos,
    nombresNivel: ajustes.nombresNivel,
    top30,
    puedoConfigurar: puedeConfigurar(a),
    puedoFijar: puedeFijar(a),
    nivelParaPostear: ajustes.nivelParaPostear,
    // La MISMA regla que el server pregunta antes de firmar una subida (`urlSubidaAdjunto`).
    puedoPublicar: puedePublicarEnLaComunidad(a, yo.nivel, ajustes.nivelParaPostear, categorias.map(aRegla)),
    puedoModerar: puedeModerar(a),
    puedoEditarAbout: puedeEditarAbout(a),
    puedoGestionarEventos: puedeGestionarEventos(a),
  };
}

// ── El feed ───────────────────────────────────────────────────────────────────────

/** Cuántos posts recientes entran al cálculo de un «Top»: una comunidad de un programa no pasa de esto en un mes. */
const TOPE_TOP = 500;

/**
 * Una página del feed. Los fijados van arriba en la PRIMERA página (y no se repiten abajo), filtrados
 * por la categoría elegida como el resto. `orden` y `categoriaId` llegan del navegador y se validan.
 */
export async function feedComunidad(a: Actor, q: { categoriaId?: unknown; orden?: unknown; pagina?: unknown }): Promise<FeedVista> {
  const pagina = Math.min(500, Math.max(0, Math.floor(Number(q.pagina)) || 0));
  const categoriaId = idValido(q.categoriaId);
  const orden: OrdenFeed = esOrden(q.orden) ? q.orden : 'default';
  const { columna, desde, porLikes } = consultaDeOrden(orden, Date.now());
  const base = () => {
    let x = de(a.ws, 'comunidad_posts').select(COLS_POST).eq('producto_id', a.productoId);
    if (categoriaId) x = x.eq('categoria_id', categoriaId);
    return x;
  };

  let fijados: FilaPost[] = [];
  if (pagina === 0) {
    const { data, error } = await base().not('fijado_at', 'is', null).order('fijado_at', { ascending: true }).limit(MAX_FIJADOS);
    if (error) throw new Error(error.message);
    fijados = (data ?? []) as FilaPost[];
  }

  let filas: FilaPost[];
  let hayMas: boolean;
  if (!porLikes) {
    const ini = pagina * PAGINA_FEED;
    // Uno de más para saber si hay otra página sin contar la tabla entera.
    const { data, error } = await base().is('fijado_at', null)
      .order(columna, { ascending: false }).order('id', { ascending: false }).range(ini, ini + PAGINA_FEED);
    if (error) throw new Error(error.message);
    const todas = (data ?? []) as FilaPost[];
    hayMas = todas.length > PAGINA_FEED;
    filas = todas.slice(0, PAGINA_FEED);
  } else {
    const { data, error } = await base().is('fijado_at', null).gte('created_at', desde!)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(TOPE_TOP);
    if (error) throw new Error(error.message);
    const recientes = (data ?? []) as FilaPost[];
    const { cuenta } = await likesDe(a.ws, recientes.map((f) => `p:${f.id}`), a.clave);
    const ordenados = ordenarPorLikes(recientes.map((f) => ({ id: Number(f.id), likes: cuenta.get(`p:${f.id}`) ?? 0, creado: f.created_at, fila: f })));
    const ini = pagina * PAGINA_FEED;
    hayMas = ordenados.length > ini + PAGINA_FEED;
    filas = ordenados.slice(ini, ini + PAGINA_FEED).map((x) => x.fila);
  }

  const vistas = await tarjetas(a, [...fijados, ...filas]);
  void marcarActividad(a.ws, a.clave);
  return { fijados: vistas.slice(0, fijados.length), posts: vistas.slice(fijados.length), hayMas, pagina };
}

// ── El post abierto ───────────────────────────────────────────────────────────────

/** El post entero con sus comentarios en dos niveles. `null` = no existe en ESTA comunidad. */
export async function detallePost(a: Actor, postIdRaw: unknown): Promise<PostDetalle | null> {
  const postId = idValido(postIdRaw);
  if (!postId) return null;
  const f = await postDe(a, postId);
  if (!f) return null;
  const comentarios = await leerTodo<FilaComentario>(getSupabaseServer(), 'comunidad_comentarios', COLS_COMENTARIO,
    { orden: 'id', eq: { workspace_id: a.ws, post_id: postId }, maxPaginas: 20 });

  const mencionesPost = mencionesGuardadas(f.menciones);
  const autores = [f.miembro, ...comentarios.map((c) => c.miembro)];
  const nombrados = [...mencionesPost, ...comentarios.flatMap((c) => mencionesGuardadas(c.menciones))];
  const respaldo = new Map<string, string>([[f.miembro, f.autor_nombre], ...comentarios.map((c) => [c.miembro, c.autor_nombre] as [string, string])]);
  const [[tarjeta], likes, info, puntos, sigo] = await Promise.all([
    tarjetas(a, [f]),
    likesDe(a.ws, comentarios.map((c) => `c:${c.id}`), a.clave),
    infoDeMiembros(a.ws, [...autores, ...nombrados], respaldo),
    puntosDe(a.ws, a.productoId, autores),
    sigueElPost(a, postId),
  ]);
  const nombradas = (claves: readonly string[]) => claves.map((k) => ({ clave: k, nombre: info.get(k)?.nombre ?? '' })).filter((m) => m.nombre);

  const vistaComentario = (c: FilaComentario): ComentarioVista => {
    const menc = nombradas(mencionesGuardadas(c.menciones));
    return {
      id: Number(c.id), padreId: c.padre_id == null ? null : Number(c.padre_id),
      autor: miembroVista(c.miembro, info, puntos),
      cuerpo: tokensDeTexto(c.cuerpo, menc), texto: c.cuerpo,
      creado: c.created_at, editado: c.editado_at != null,
      likes: likes.cuenta.get(`c:${c.id}`) ?? 0, meGusta: likes.mios.has(`c:${c.id}`),
      puedoEditar: puedeEditar(a, c.miembro), puedoBorrar: puedeBorrar(a, c.miembro), puedoLikear: puedeDarLike(a, c.miembro),
      respuestas: [],
    };
  };
  const hilo: ComentarioVista[] = arbolDeComentarios(comentarios.map(vistaComentario));
  const menciones = nombradas(mencionesPost);
  void marcarActividad(a.ws, a.clave);
  return { ...tarjeta, cuerpo: tokensDeTexto(f.cuerpo, menciones), texto: f.cuerpo, menciones, hilo, sigo };
}

// ── Seguir un post (la campana del post) ──────────────────────────────────────────

const objetivoPost = (postId: number) => `p:${postId}`;

/** ¿Quien mira sigue este post? No tira: sin poder leerlo, la campana del post dice «no». */
async function sigueElPost(a: Actor, postId: number): Promise<boolean> {
  try {
    const { data, error } = await de(a.ws, 'comunidad_seguimientos').select('id')
      .eq('producto_id', a.productoId).eq('objetivo', objetivoPost(postId)).eq('miembro', a.clave).limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  } catch (e) {
    console.warn('[comunidad] no pude leer si sigue el post:', msg(e, ''));
    return false;
  }
}

/**
 * Quiénes siguen un post (para avisarles de un comentario nuevo). TIRA si no puede leer: quien llama
 * lo atrapa y avisa a los que sí sabe (el comentario ya está guardado).
 */
async function seguidoresDe(a: Actor, postId: number): Promise<string[]> {
  const filas = await leerTodo<{ id: number; miembro: string }>(
    getSupabaseServer(), 'comunidad_seguimientos', 'id, miembro',
    { orden: 'id', eq: { workspace_id: a.ws, producto_id: a.productoId, objetivo: objetivoPost(postId) } },
  );
  return filas.map((f) => f.miembro);
}

/**
 * Sigue (o deja de seguir) un post. Idempotente en los dos sentidos. Cualquier miembro: seguir no
 * escribe nada que otro vea, sólo decide a quién le llega un aviso.
 */
export async function seguirPost(a: Actor, postIdRaw: unknown, si: boolean): Promise<Resultado<{ sigo: boolean }>> {
  try {
    const postId = idValido(postIdRaw);
    const f = postId ? await postDe(a, postId) : null;
    if (!f) return { ok: false, error: 'Ese post ya no está.' };
    if (si) {
      const { error } = await de(a.ws, 'comunidad_seguimientos').upsert({
        producto_id: a.productoId, miembro: a.clave, lead_id: a.leadId, objetivo: objetivoPost(f.id), post_id: f.id,
      }, { onConflict: 'workspace_id,producto_id,objetivo,miembro', ignoreDuplicates: true });
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await de(a.ws, 'comunidad_seguimientos').delete()
        .eq('producto_id', a.productoId).eq('objetivo', objetivoPost(f.id)).eq('miembro', a.clave);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, sigo: si };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

// ── Publicar, editar, borrar, fijar ───────────────────────────────────────────────

/** Publica un post. Lo que escribe lo valida `validarPost`; quién puede, las reglas de la comunidad. */
export async function publicarPost(a: Actor, raw: unknown): Promise<Resultado<{ post: PostVista }>> {
  try {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const [ajustes, categorias] = await Promise.all([leerAjustes(a.ws, a.productoId), categoriasDe(a.ws, a.productoId)]);
    if (!a.equipo && ajustes.nivelParaPostear > 1) {
      const nivel = nivelDe(await contarPuntos(a.ws, a.productoId, a.clave));
      if (!puedePostearPorNivel(a, nivel, ajustes.nivelParaPostear)) return { ok: false, error: `Publicas desde el nivel ${ajustes.nivelParaPostear}.` };
    }
    const nombres = await nombresMencionables(a, b.menciones);
    const v = validarPost(b, { actor: a, categorias: categorias.map(aRegla), ws: a.ws, productoId: a.productoId, nombreDe: (k) => nombres.get(k) });
    if (!v.ok) return v;
    const p = v.post;
    if (p.adjunto) {
      const { data: hay } = await getSupabaseServer().storage.from(BUCKET_COMUNIDAD).exists(p.adjunto.path);
      if (!hay) return { ok: false, error: 'El archivo no terminó de subir.' };
    }
    const ahora = new Date().toISOString();
    const { data, error } = await de(a.ws, 'comunidad_posts').insert({
      producto_id: a.productoId, categoria_id: p.categoriaId, miembro: a.clave, lead_id: a.leadId, autor_nombre: a.nombre,
      titulo: p.titulo, cuerpo: p.cuerpo, menciones: p.menciones, video_url: p.videoUrl,
      adjunto_path: p.adjunto?.path ?? null, adjunto_nombre: p.adjunto?.nombre ?? null,
      adjunto_mime: p.adjunto?.mime ?? null, adjunto_bytes: p.adjunto?.bytes ?? null,
      encuesta: p.encuesta, actividad_at: ahora, created_at: ahora,
    }).select(COLS_POST).single();
    if (error) return { ok: false, error: error.message };
    const fila = data as FilaPost;
    // El autor SIGUE lo suyo por default (le avisan los comentarios nuevos); lo puede dejar de seguir
    // con la campana del post. Si esto falla el post ya está: sólo se pierde ese aviso.
    const { error: eSigue } = await de(a.ws, 'comunidad_seguimientos').upsert({
      producto_id: a.productoId, miembro: a.clave, lead_id: a.leadId, objetivo: objetivoPost(Number(fila.id)), post_id: fila.id,
    }, { onConflict: 'workspace_id,producto_id,objetivo,miembro', ignoreDuplicates: true });
    if (eSigue) console.warn('[comunidad] no pude anotar que el autor sigue su post:', eSigue.message);
    await notificar(a, p.menciones.map((k) => ({ para: k, tipo: 'mencion' as const, postId: Number(fila.id) })));
    void marcarActividad(a.ws, a.clave);
    const [post] = await tarjetas(a, [fila]);
    return { ok: true, post };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo publicar.') };
  }
}

/**
 * Edita el TEXTO de un post propio: título, cuerpo, categoría y video. La encuesta y el adjunto no
 * se tocan (un voto guarda el id de su opción; cambiarla le cambiaría el voto a alguien).
 */
export async function editarPost(a: Actor, postIdRaw: unknown, raw: unknown): Promise<Resultado<{ post: PostVista }>> {
  try {
    const postId = idValido(postIdRaw);
    const f = postId ? await postDe(a, postId) : null;
    if (!f) return { ok: false, error: 'Ese post ya no está.' };
    if (!puedeEditar(a, f.miembro)) return { ok: false, error: 'Solo quien lo escribió lo edita.' };
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const [categorias, nombres] = await Promise.all([categoriasDe(a.ws, a.productoId), nombresMencionables(a, b.menciones)]);
    const v = validarPost(b, { actor: a, categorias: categorias.map(aRegla), ws: a.ws, productoId: a.productoId, nombreDe: (k) => nombres.get(k), soloTexto: true });
    if (!v.ok) return v;
    const antes = new Set(mencionesGuardadas(f.menciones));
    const { data, error } = await de(a.ws, 'comunidad_posts').update({
      titulo: v.post.titulo, cuerpo: v.post.cuerpo, categoria_id: v.post.categoriaId, video_url: v.post.videoUrl,
      menciones: v.post.menciones, editado_at: new Date().toISOString(),
    }).eq('producto_id', a.productoId).eq('id', f.id).select(COLS_POST).single();
    if (error) return { ok: false, error: error.message };
    // Sólo las menciones NUEVAS avisan: editar una coma no vuelve a notificar a todos.
    await notificar(a, v.post.menciones.filter((k) => !antes.has(k)).map((k) => ({ para: k, tipo: 'mencion' as const, postId: Number(f.id) })));
    const [post] = await tarjetas(a, [data as FilaPost]);
    return { ok: true, post };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

/** Borra un post (sus comentarios, likes y votos se van en cascada): quien lo escribió o el equipo. */
export async function borrarPost(a: Actor, postIdRaw: unknown): Promise<Resultado> {
  try {
    const postId = idValido(postIdRaw);
    const f = postId ? await postDe(a, postId) : null;
    if (!f) return { ok: true };
    if (!puedeBorrar(a, f.miembro)) return { ok: false, error: 'Solo quien lo escribió o el equipo lo borra.' };
    const { error } = await de(a.ws, 'comunidad_posts').delete().eq('producto_id', a.productoId).eq('id', f.id);
    if (error) return { ok: false, error: error.message };
    if (f.adjunto_path) await descartarAdjunto(a, f.adjunto_path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar.') };
  }
}

/** Fija o suelta un post arriba del feed. Sólo el equipo, y hasta 3 fijados por comunidad. */
export async function fijarPost(a: Actor, postIdRaw: unknown, si: boolean): Promise<Resultado<{ fijado: boolean }>> {
  try {
    if (!puedeFijar(a)) return { ok: false, error: 'Solo el equipo fija posts.' };
    const postId = idValido(postIdRaw);
    const f = postId ? await postDe(a, postId) : null;
    if (!f) return { ok: false, error: 'Ese post ya no está.' };
    if (si) {
      const { count, error } = await de(a.ws, 'comunidad_posts').select('id', { count: 'exact', head: true })
        .eq('producto_id', a.productoId).not('fijado_at', 'is', null);
      if (error) return { ok: false, error: error.message };
      if (!hayLugarParaFijar(count ?? 0, f.fijado_at != null)) return { ok: false, error: `Hasta ${MAX_FIJADOS} fijados. Suelta uno antes.` };
    }
    const { error } = await de(a.ws, 'comunidad_posts').update({ fijado_at: si ? (f.fijado_at ?? new Date().toISOString()) : null })
      .eq('producto_id', a.productoId).eq('id', f.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, fijado: si };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo fijar.') };
  }
}

// ── Comentarios ───────────────────────────────────────────────────────────────────

async function comentarioDe(a: Actor, id: number): Promise<FilaComentario | null> {
  const { data, error } = await de(a.ws, 'comunidad_comentarios').select(COLS_COMENTARIO)
    .eq('producto_id', a.productoId).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaComentario | null) ?? null;
}

/**
 * Comenta un post, o responde a un comentario. Dos niveles: responder a una RESPUESTA la cuelga del
 * mismo comentario (`padreDeRespuesta`). Avisa a quien se le contestó, a los mencionados, al autor del
 * post (si lo sigue) y a los que siguen el post (`avisosDeComentario`); y el post sube en el orden
 * «Recientes» (`actividad_at`). Con los comentarios CERRADOS no comenta nadie (`puedeComentar`).
 */
export async function comentar(a: Actor, postIdRaw: unknown, raw: unknown): Promise<Resultado<{ comentario: ComentarioVista }>> {
  try {
    const postId = idValido(postIdRaw);
    const post = postId ? await postDe(a, postId) : null;
    if (!post) return { ok: false, error: 'Ese post ya no está.' };
    if (!puedeComentar({ cerrado: post.comentarios_cerrados_at != null })) return { ok: false, error: 'Los comentarios están cerrados.' };
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const nombres = await nombresMencionables(a, b.menciones);
    const v = validarComentario(b, (k) => nombres.get(k));
    if (!v.ok) return v;

    let padre: FilaComentario | null = null;
    // A quién se le contestó: el del hilo y, si se respondió a una RESPUESTA, también quien la escribió.
    let contestados: string[] = [];
    if (v.responderA) {
      const objetivo = await comentarioDe(a, v.responderA);
      if (!objetivo || Number(objetivo.post_id) !== Number(post.id)) return { ok: false, error: 'Ese comentario ya no está.' };
      const padreId = padreDeRespuesta({ id: Number(objetivo.id), padreId: objetivo.padre_id == null ? null : Number(objetivo.padre_id) });
      padre = padreId === Number(objetivo.id) ? objetivo : await comentarioDe(a, padreId!);
      if (!padre) return { ok: false, error: 'Ese comentario ya no está.' };
      contestados = [objetivo.miembro, padre.miembro];
    }

    const ahora = new Date().toISOString();
    const { data, error } = await de(a.ws, 'comunidad_comentarios').insert({
      producto_id: a.productoId, post_id: post.id, padre_id: padre ? padre.id : null,
      miembro: a.clave, lead_id: a.leadId, autor_nombre: a.nombre, cuerpo: v.cuerpo, menciones: v.menciones, created_at: ahora,
    }).select(COLS_COMENTARIO).single();
    if (error) return { ok: false, error: error.message };
    const c = data as FilaComentario;

    // La actividad del post: comentarlo lo sube en «Recientes». Si falla, el comentario ya está.
    const { error: e2 } = await de(a.ws, 'comunidad_posts').update({ actividad_at: ahora }).eq('producto_id', a.productoId).eq('id', post.id);
    if (e2) console.warn('[comunidad] no pude subir la actividad del post:', e2.message);

    let seguidores: string[] = [];
    try {
      seguidores = await seguidoresDe(a, Number(post.id));
    } catch (e) {
      // Sin poder leer quién sigue, se avisa a los que se sabe (respuesta y mención): el comentario ya está.
      console.warn('[comunidad] no pude leer quién sigue el post:', msg(e, ''));
    }
    await notificar(a, avisosDeComentario({
      autorPost: post.miembro, seguidores, contestados, menciones: v.menciones, postId: Number(post.id), comentarioId: Number(c.id),
    }));
    void marcarActividad(a.ws, a.clave);

    const info = await infoDeMiembros(a.ws, [a.clave, ...v.menciones], new Map([[a.clave, a.nombre]]));
    const puntos = await puntosDe(a.ws, a.productoId, [a.clave]);
    const menc = v.menciones.map((k) => ({ clave: k, nombre: info.get(k)?.nombre ?? '' })).filter((m) => m.nombre);
    return {
      ok: true,
      comentario: {
        id: Number(c.id), padreId: c.padre_id == null ? null : Number(c.padre_id),
        autor: miembroVista(a.clave, info, puntos), cuerpo: tokensDeTexto(c.cuerpo, menc), texto: c.cuerpo,
        creado: c.created_at, editado: false, likes: 0, meGusta: false,
        puedoEditar: true, puedoBorrar: true, puedoLikear: false, respuestas: [],
      },
    };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo comentar.') };
  }
}

/** Edita un comentario propio. Devuelve el cuerpo ya partido para dibujar. */
export async function editarComentario(a: Actor, idRaw: unknown, raw: unknown): Promise<Resultado<{ cuerpo: ComentarioVista['cuerpo']; texto: string }>> {
  try {
    const id = idValido(idRaw);
    const c = id ? await comentarioDe(a, id) : null;
    if (!c) return { ok: false, error: 'Ese comentario ya no está.' };
    if (!puedeEditar(a, c.miembro)) return { ok: false, error: 'Solo quien lo escribió lo edita.' };
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const nombres = await nombresMencionables(a, b.menciones);
    const v = validarComentario(b, (k) => nombres.get(k));
    if (!v.ok) return v;
    const antes = new Set(mencionesGuardadas(c.menciones));
    const { error } = await de(a.ws, 'comunidad_comentarios').update({ cuerpo: v.cuerpo, menciones: v.menciones, editado_at: new Date().toISOString() })
      .eq('producto_id', a.productoId).eq('id', c.id);
    if (error) return { ok: false, error: error.message };
    await notificar(a, v.menciones.filter((k) => !antes.has(k)).map((k) => ({ para: k, tipo: 'mencion' as const, postId: Number(c.post_id), comentarioId: Number(c.id) })));
    const menc = v.menciones.map((k) => ({ clave: k, nombre: nombres.get(k) ?? '' })).filter((m) => m.nombre);
    return { ok: true, cuerpo: tokensDeTexto(v.cuerpo, menc), texto: v.cuerpo };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

/** Borra un comentario (y sus respuestas, en cascada): quien lo escribió o el equipo. */
export async function borrarComentario(a: Actor, idRaw: unknown): Promise<Resultado> {
  try {
    const id = idValido(idRaw);
    const c = id ? await comentarioDe(a, id) : null;
    if (!c) return { ok: true };
    if (!puedeBorrar(a, c.miembro)) return { ok: false, error: 'Solo quien lo escribió o el equipo lo borra.' };
    const { error } = await de(a.ws, 'comunidad_comentarios').delete().eq('producto_id', a.productoId).eq('id', c.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar.') };
  }
}

// ── Likes ─────────────────────────────────────────────────────────────────────────

/**
 * Da o saca un like (`objetivo` = `p:<post>` o `c:<comentario>`). Idempotente en los dos sentidos: dar
 * dos veces no suma dos (índice único), sacar uno que no estaba no resta nada. Devuelve cuántos quedaron.
 *
 * ⚠️ NO A LO PROPIO (`puedeDarLike`): ver lib/comunidad-reglas.ts.
 */
export async function cambiarLike(a: Actor, objetivoRaw: unknown, si: boolean): Promise<Resultado<{ likes: number; meGusta: boolean }>> {
  try {
    const m = typeof objetivoRaw === 'string' ? /^(p|c):([1-9]\d{0,14})$/.exec(objetivoRaw) : null;
    if (!m) return { ok: false, error: 'Eso ya no está.' };
    const id = Number(m[2]);
    const objetivo = `${m[1]}:${id}`;
    let autor: string;
    let postId: number;
    if (m[1] === 'p') {
      const f = await postDe(a, id);
      if (!f) return { ok: false, error: 'Ese post ya no está.' };
      autor = f.miembro; postId = Number(f.id);
    } else {
      const c = await comentarioDe(a, id);
      if (!c) return { ok: false, error: 'Ese comentario ya no está.' };
      autor = c.miembro; postId = Number(c.post_id);
    }
    if (!puedeDarLike(a, autor)) return { ok: false, error: 'No puedes darte like.' };

    if (si) {
      const { data, error } = await de(a.ws, 'comunidad_likes').upsert({
        producto_id: a.productoId, objetivo,
        post_id: m[1] === 'p' ? id : null, comentario_id: m[1] === 'c' ? id : null,
        miembro: a.clave, lead_id: a.leadId, autor_miembro: autor, autor_lead_id: leadDe(autor),
      }, { onConflict: 'workspace_id,objetivo,miembro', ignoreDuplicates: true }).select('id');
      if (error) return { ok: false, error: error.message };
      // Sólo si el like es NUEVO (un doble clic no avisa dos veces).
      if ((data ?? []).length) await notificar(a, [{ para: autor, tipo: 'like', postId, comentarioId: m[1] === 'c' ? id : null }]);
    } else {
      // Sólo el like de QUIEN lo saca (`miembro`): sin esa línea, un «Quitar like» borraba los de todos.
      const { error } = await de(a.ws, 'comunidad_likes').delete().eq('producto_id', a.productoId).eq('objetivo', objetivo).eq('miembro', a.clave);
      if (error) return { ok: false, error: error.message };
    }
    const { count, error } = await de(a.ws, 'comunidad_likes').select('id', { count: 'exact', head: true }).eq('objetivo', objetivo);
    if (error) return { ok: false, error: error.message };
    void marcarActividad(a.ws, a.clave);
    return { ok: true, likes: count ?? 0, meGusta: si };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

// ── Encuestas ─────────────────────────────────────────────────────────────────────

/** Vota (o cambia el voto) en la encuesta de un post. Un voto por persona. */
export async function votar(a: Actor, postIdRaw: unknown, opcionRaw: unknown): Promise<Resultado<{ encuesta: NonNullable<PostVista['encuesta']> }>> {
  try {
    const postId = idValido(postIdRaw);
    const f = postId ? await postDe(a, postId) : null;
    const enc = f ? encuestaGuardada(f.encuesta) : null;
    if (!f || !enc) return { ok: false, error: 'Esa encuesta ya no está.' };
    const opcion = typeof opcionRaw === 'string' ? opcionRaw : '';
    if (!enc.opciones.some((o) => o.id === opcion)) return { ok: false, error: 'Esa opción no existe.' };
    const { error } = await de(a.ws, 'comunidad_votos').upsert({
      producto_id: a.productoId, post_id: f.id, opcion, miembro: a.clave, lead_id: a.leadId, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,post_id,miembro' });
    if (error) return { ok: false, error: error.message };
    const votos = await votosDe(a.ws, [Number(f.id)]);
    void marcarActividad(a.ws, a.clave);
    return { ok: true, encuesta: resultadosEncuesta(enc, votos.get(Number(f.id)) ?? [], a.clave) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo votar.') };
  }
}

// ── Ranking ───────────────────────────────────────────────────────────────────────

/**
 * Lo que abre cada nivel: los módulos y las clases del curso de ESTE producto con bloqueo por nivel.
 *
 * ⚠️ LOS MÓDULOS SALEN DE `modulosDelCurso` (lib/curso-modulos-datos.ts), la derivación del curso y
 *    del portal (revisión del 08/10/2026). Leyendo `curso_modulos` a mano, el nivel de un módulo
 *    VINCULADO no salía nunca: su fila guarda sólo el candado (el nombre es el de su etapa) y llegaba
 *    sin nombre. Y una fila de una etapa sacada del curso no es un módulo.
 * ⚠️ A UN ALUMNO SE LE RECORTA A SUS PERMISOS (mig 0219): el leaderboard no le nombra un módulo, ni una
 *    clase de uno, que en el portal no le viaja «ni el nombre». Tampoco una clase de un módulo que ya
 *    no existe.
 * ⚠️ BEST-EFFORT: lo que no se puede leer vuelve vacío («no abre nada»), con un aviso en el log.
 */
async function aperturasDelCurso(a: Actor): Promise<Record<number, string[]>> {
  const ve = (clave: string) => a.equipo || moduloPermitido(a.alcance ?? null, a.productoId, clave);
  const items: Array<{ nombre: string; bloqueo: unknown }> = [];
  try {
    const { modulosDelCurso } = await import('./curso-modulos-datos');
    const cur = await modulosDelCurso(a.productoId);
    for (const m of cur.modulos) if (ve(m.clave)) items.push({ nombre: m.nombre, bloqueo: m.bloqueo });
    const existen = new Set(cur.modulos.map((m) => m.clave));
    const { data, error } = await getSupabaseServer().from('curso_clases').select('titulo, etapa, bloqueo')
      .eq('workspace_id', a.ws).eq('producto_id', a.productoId);
    if (error) throw new Error(error.message);
    for (const f of (data ?? []) as Array<{ titulo: string; etapa: string; bloqueo: unknown }>) {
      if (existen.has(f.etapa) && ve(f.etapa)) items.push({ nombre: f.titulo, bloqueo: f.bloqueo });
    }
  } catch (e) {
    console.warn('[comunidad] no pude leer lo que abre cada nivel:', msg(e, ''));
  }
  return aperturasPorNivel(items);
}

/** La pantalla de Leaderboards: mi nivel, los 9 niveles con su % y lo que abren, y las tres tablas. */
export async function rankingComunidad(a: Actor): Promise<RankingVista> {
  const ahora = Date.now();
  const [comunidad, likes, ajustes, aperturas] = await Promise.all([
    miembrosDeLaComunidad(a.ws, a.productoId),
    likesDelProducto(a.ws, a.productoId),
    leerAjustes(a.ws, a.productoId),
    aperturasDelCurso(a),
  ]);
  const esMiembro = esMiembroDe(comunidad);
  const totales = puntosPorMiembro(likes);
  const semana = tablaDeRanking(puntosPorMiembro(likes, ahora - 7 * 86_400_000), esMiembro);
  const mes = tablaDeRanking(puntosPorMiembro(likes, ahora - 30 * 86_400_000), esMiembro);
  const total = tablaDeRanking(totales, esMiembro);
  const claves = new Set([...semana, ...mes, ...total].map((f) => f.clave));
  claves.add(a.clave);
  const info = await infoDeMiembros(a.ws, claves, new Map([[a.clave, a.nombre]]));
  const fila = (f: { clave: string; puntos: number; puesto: number }): FilaRanking => ({ puesto: f.puesto, puntos: f.puntos, miembro: miembroVista(f.clave, info, totales) });
  // El % de cada nivel es de los ALUMNOS (el equipo no está en el leaderboard): uno sin likes cuenta en el 1.
  const dist = distribucionDeNiveles([...comunidad.alumnos.keys()].map((k) => totales.get(k) ?? 0));
  void marcarActividad(a.ws, a.clave);
  return {
    yo: a.equipo ? null : yoVista(a, info, totales.get(a.clave) ?? 0, ajustes.nombresNivel),
    niveles: dist.map((d) => ({ ...d, nombre: nombreDeNivel(ajustes.nombresNivel, d.nivel), abre: aperturas[d.nivel] ?? [] })),
    semana: semana.map(fila), mes: mes.map(fila), total: total.map(fila),
    actualizado: new Date(ahora).toISOString(),
  };
}

// ── Miembros y perfiles ───────────────────────────────────────────────────────────

type Actividad = { ultima: string | null; bio: string; links: unknown; ubicacion: string };

/** La fila de perfil de cada clave (bio, links, última actividad). Las que no tienen, no están. */
export async function actividadDe(ws: number, claves: readonly string[]): Promise<Map<string, Actividad>> {
  const out = new Map<string, Actividad>();
  for (const lote of lotes([...new Set(claves)])) {
    const filas = await leerTodo<{ id: number; miembro: string; ultima_actividad_at: string | null; bio: string; links: unknown; ubicacion: string }>(
      getSupabaseServer(), 'comunidad_perfiles', 'id, miembro, ultima_actividad_at, bio, links, ubicacion',
      { orden: 'id', eq: { workspace_id: ws }, filtros: (q) => q.in('miembro', lote) },
    );
    for (const f of filas) out.set(f.miembro, { ultima: f.ultima_actividad_at, bio: f.bio ?? '', links: f.links, ubicacion: f.ubicacion ?? '' });
  }
  return out;
}

/** Hasta cuántos devuelve el directorio por pedido: el buscador acota el resto. */
const TOPE_DIRECTORIO = 300;

/**
 * El directorio: buscar por nombre y filtrar Todos / Equipo / En línea. Va de la actividad más
 * reciente a la más vieja (como Skool). Los conteos de los filtros son de la comunidad entera, no de
 * lo que dejó el buscador.
 */
export async function miembrosComunidad(a: Actor, q: { filtro?: unknown; q?: unknown }): Promise<MiembrosVista> {
  const filtro: FiltroMiembros = q.filtro === 'equipo' || q.filtro === 'en_linea' ? q.filtro : 'todos';
  const busca = sanearTexto(q.q, { unaLinea: true }).slice(0, 60);
  const comunidad = await miembrosDeLaComunidad(a.ws, a.productoId);
  const base = [...comunidad.equipo.values(), ...comunidad.alumnos.values()];
  const claves = base.map((m) => m.clave);
  const [info, actividad, likes] = await Promise.all([
    infoDeMiembros(a.ws, claves),
    actividadDe(a.ws, claves),
    likesDelProducto(a.ws, a.productoId),
  ]);
  const puntos = puntosPorMiembro(likes);
  const ahora = Date.now();
  const todos: MiembroDirectorio[] = base.map((m) => {
    const act = actividad.get(m.clave);
    return {
      ...miembroVista(m.clave, info, puntos),
      bio: act?.bio ?? '',
      enLinea: enLinea(act?.ultima ?? null, ahora),
      ultimaActividad: act?.ultima ?? null,
      desde: m.desde,
    };
  });
  const conteos = { todos: todos.length, equipo: comunidad.equipo.size, enLinea: todos.filter((m) => m.enLinea).length };
  const ultima = (m: MiembroDirectorio) => (m.ultimaActividad ? Date.parse(m.ultimaActividad) : 0);
  const miembros = todos
    .filter((m) => (filtro === 'equipo' ? m.equipo : filtro === 'en_linea' ? m.enLinea : true))
    .filter((m) => nombreCoincide(m.nombre, busca))
    .sort((x, y) => ultima(y) - ultima(x) || x.nombre.localeCompare(y.nombre, 'es'))
    .slice(0, TOPE_DIRECTORIO);
  void marcarActividad(a.ws, a.clave);
  return { miembros, conteos };
}

/** El perfil de un miembro de ESTA comunidad (o el propio). `null` = no es miembro. */
export async function perfilDe(a: Actor, claveRaw: unknown): Promise<PerfilVista | null> {
  const c = leerClave(claveRaw);
  if (!c) return null;
  const esYo = c.clave === a.clave;
  const comunidad = await miembrosDeLaComunidad(a.ws, a.productoId);
  const base = comunidad.equipo.get(c.clave) ?? comunidad.alumnos.get(c.clave);
  if (!base && !esYo) return null;
  const [info, actividad, puntos, ajustes] = await Promise.all([
    infoDeMiembros(a.ws, [c.clave], esYo ? new Map([[a.clave, a.nombre]]) : new Map()),
    actividadDe(a.ws, [c.clave]),
    contarPuntos(a.ws, a.productoId, c.clave),
    leerAjustes(a.ws, a.productoId),
  ]);
  const act = actividad.get(c.clave);
  const pts = new Map([[c.clave, puntos]]);
  const m = miembroVista(c.clave, info, pts);
  return {
    ...m,
    bio: act?.bio ?? '', enLinea: enLinea(act?.ultima ?? null, Date.now()), ultimaActividad: act?.ultima ?? null,
    desde: base?.desde ?? null, links: linksGuardados(act?.links), ubicacion: act?.ubicacion ?? '',
    puntos, nombreNivel: nombreDeNivel(ajustes.nombresNivel, m.nivel), esYo,
    puedoSacar: puedeSacar(a, c.clave),
  };
}

/** Guarda el perfil PROPIO (bio, links, ubicación). Nadie edita el de otro. */
export async function guardarPerfil(a: Actor, raw: unknown): Promise<Resultado<{ perfil: PerfilVista }>> {
  try {
    const v = sanearPerfil(raw);
    if (!v.ok) return v;
    const { error } = await de(a.ws, 'comunidad_perfiles').upsert({
      miembro: a.clave, lead_id: a.leadId, bio: v.perfil.bio, links: v.perfil.links, ubicacion: v.perfil.ubicacion,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,miembro' });
    if (error) return { ok: false, error: error.message };
    const perfil = await perfilDe(a, a.clave);
    if (!perfil) return { ok: false, error: 'No pude leer tu perfil.' };
    return { ok: true, perfil };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

// ── Configurar: categorías y nombres de nivel (un admin del workspace) ────────────

const NO_CONFIGURA = { ok: false as const, error: 'Solo un administrador configura la comunidad.' };

/** Crea (sin `id`) o edita una categoría. Devuelve la lista como quedó. */
export async function guardarCategoria(a: Actor, raw: unknown): Promise<Resultado<{ categorias: CategoriaVista[] }>> {
  try {
    if (!puedeConfigurar(a)) return NO_CONFIGURA;
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const existentes = await categoriasDe(a.ws, a.productoId);
    const editando = b.id != null ? idValido(b.id) : null;
    if (b.id != null && (!editando || !existentes.some((c) => c.id === editando))) return { ok: false, error: 'Esa categoría ya no está.' };
    const v = validarCategoria(b, existentes, editando);
    if (!v.ok) return v;
    const fila = { nombre: v.categoria.nombre, permiso: v.categoria.permiso, orden_default: v.categoria.ordenDefault };
    if (editando) {
      const { error } = await de(a.ws, 'comunidad_categorias').update(fila).eq('producto_id', a.productoId).eq('id', editando);
      if (error) return { ok: false, error: error.message };
    } else {
      // Al final de los chips. Un empate con una que dejó hueco al borrarse lo desempata el id.
      const { error } = await de(a.ws, 'comunidad_categorias').insert({ ...fila, producto_id: a.productoId, orden: existentes.length });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, categorias: await categoriasDe(a.ws, a.productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

/** Borra una categoría. Sus posts quedan sin categoría (no se borran). */
export async function borrarCategoria(a: Actor, idRaw: unknown): Promise<Resultado<{ categorias: CategoriaVista[] }>> {
  try {
    if (!puedeConfigurar(a)) return NO_CONFIGURA;
    const id = idValido(idRaw);
    if (id) {
      const { error } = await de(a.ws, 'comunidad_categorias').delete().eq('producto_id', a.productoId).eq('id', id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, categorias: await categoriasDe(a.ws, a.productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar.') };
  }
}

/** Sube o baja una categoría en los chips. Reescribe el orden entero (0..N), así nunca quedan empates. */
export async function moverCategoria(a: Actor, idRaw: unknown, dir: unknown): Promise<Resultado<{ categorias: CategoriaVista[] }>> {
  try {
    if (!puedeConfigurar(a)) return NO_CONFIGURA;
    const id = idValido(idRaw);
    const lista = await categoriasDe(a.ws, a.productoId);
    const i = lista.findIndex((c) => c.id === id);
    const j = dir === 'arriba' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true, categorias: lista };
    const nueva = lista.slice();
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    for (let k = 0; k < nueva.length; k++) {
      const { error } = await de(a.ws, 'comunidad_categorias').update({ orden: k }).eq('producto_id', a.productoId).eq('id', nueva[k].id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, categorias: await categoriasDe(a.ws, a.productoId) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo mover.') };
  }
}

/** Guarda los nombres de los 9 niveles (`''` = «Nivel N»). */
export async function guardarNombresNivel(a: Actor, raw: unknown): Promise<Resultado<{ nombresNivel: string[] }>> {
  try {
    if (!puedeConfigurar(a)) return NO_CONFIGURA;
    const nombres = sanearNombresNivel(raw);
    const { error } = await de(a.ws, 'comunidad_ajustes').upsert({
      producto_id: a.productoId, nombres_nivel: nombres, actualizado_por: a.nombre, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,producto_id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, nombresNivel: nombres };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

// ── El About (la segunda mitad) ───────────────────────────────────────────────────

/**
 * La pantalla About: el nombre, la descripción corta, el texto largo y las reglas; los conteos
 * (miembros, en línea, equipo) y las caras del equipo. Los conteos son BEST-EFFORT y lo dicen (`null`
 * = no se pudo leer la entrega), como en la columna lateral.
 */
export async function aboutComunidad(a: Actor): Promise<AboutVista> {
  const [{ data, error }, producto] = await Promise.all([
    de(a.ws, 'comunidad_ajustes').select('nombre, descripcion, about, reglas, nivel_para_postear, zona_horaria')
      .eq('producto_id', a.productoId).maybeSingle(),
    productoDelWorkspace(a.ws, a.productoId),
  ]);
  if (error) throw new Error(error.message);
  const f = data as { nombre: string | null; descripcion: string | null; about: unknown; reglas: string | null; nivel_para_postear: number | null; zona_horaria: string | null } | null;
  let conteos: AboutVista['conteos'] = null;
  let equipo: MiembroVista[] = [];
  try {
    const comunidad = await miembrosDeLaComunidad(a.ws, a.productoId);
    const todos = [...comunidad.equipo.keys(), ...comunidad.alumnos.keys()];
    const [actividad, info, likes] = await Promise.all([
      actividadDe(a.ws, todos),
      infoDeMiembros(a.ws, comunidad.equipo.keys()),
      likesDelProducto(a.ws, a.productoId),
    ]);
    const ahora = Date.now();
    conteos = { miembros: todos.length, enLinea: todos.filter((k) => enLinea(actividad.get(k)?.ultima ?? null, ahora)).length, equipo: comunidad.equipo.size };
    const puntos = puntosPorMiembro(likes);
    equipo = [...comunidad.equipo.keys()].slice(0, 24).map((k) => miembroVista(k, info, puntos));
  } catch (e) {
    console.warn('[comunidad] no pude leer los miembros del About:', msg(e, ''));
  }
  const nombrePropio = f?.nombre?.trim() || null;
  return {
    nombre: nombrePropio ?? producto?.nombre ?? 'Comunidad',
    nombrePropio,
    descripcion: f?.descripcion ?? '',
    texto: textoDeAbout(f?.about),
    reglas: f?.reglas ?? '',
    conteos,
    equipo,
    nivelParaPostear: Math.min(NIVEL_MAX, Math.max(1, Number(f?.nivel_para_postear) || 1)),
    zona: f?.zona_horaria && esZonaValida(f.zona_horaria) ? f.zona_horaria : null,
    puedoEditar: puedeEditarAbout(a),
    puedoConfigurar: puedeConfigurar(a),
  };
}

/** Guarda el About (nombre, descripción corta, texto y reglas): el equipo. */
export async function guardarAbout(a: Actor, raw: unknown): Promise<Resultado<{ about: AboutVista }>> {
  try {
    if (!puedeEditarAbout(a)) return { ok: false, error: 'Solo el equipo edita el About.' };
    const v = sanearAbout(raw);
    if (!v.ok) return v;
    // Upsert con SÓLO estas columnas: el ON CONFLICT no pisa los nombres de nivel ni el nivel para postear.
    const { error } = await de(a.ws, 'comunidad_ajustes').upsert({
      producto_id: a.productoId, nombre: v.about.nombre, descripcion: v.about.descripcion,
      about: { texto: v.about.texto }, reglas: v.about.reglas, actualizado_por: a.nombre, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,producto_id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, about: await aboutComunidad(a) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

/**
 * Los ajustes de un ADMIN del workspace: desde qué nivel publican los alumnos (el plugin «Unlock
 * Posting at Level N» de Skool; 1 = todos) y la zona por defecto del calendario (`null` = la del negocio).
 */
export async function guardarAjustesComunidad(a: Actor, raw: unknown): Promise<Resultado<{ about: AboutVista }>> {
  try {
    if (!puedeConfigurar(a)) return NO_CONFIGURA;
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const nivel = Number(b.nivelParaPostear);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAX) return { ok: false, error: 'Elige un nivel del 1 al 9.' };
    const zona = b.zona == null || b.zona === '' ? null : b.zona;
    if (zona != null && !esZonaValida(zona)) return { ok: false, error: 'Esa zona horaria no existe.' };
    const { error } = await de(a.ws, 'comunidad_ajustes').upsert({
      producto_id: a.productoId, nivel_para_postear: nivel, zona_horaria: zona, actualizado_por: a.nombre, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,producto_id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, about: await aboutComunidad(a) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

// ── Buscar (posts y miembros) ─────────────────────────────────────────────────────

/** Cuántos candidatos trae cada columna antes de comparar de verdad. */
const CANDIDATOS_BUSQUEDA = 200;

/**
 * Busca en los posts (título y cuerpo) y en los miembros (nombre). Sin mayúsculas ni acentos.
 *
 * Los posts salen en dos pasos (`patronDeBusqueda` → `textoCoincide`): un `ilike` trae candidatos de
 * más (las vocales van como comodín, porque la base no tiene `unaccent`) y la comparación exacta en
 * memoria decide. ⚠️ El `ilike` trae los 200 más NUEVOS de cada columna: con una consulta muy común
 * («la»), lo más viejo no aparece. Es una búsqueda de comunidad, no un archivo.
 */
export async function buscarEnComunidad(a: Actor, qRaw: unknown): Promise<BusquedaVista> {
  const q = sanearTexto(qRaw, { unaLinea: true }).slice(0, 60);
  if (q.length < MIN_BUSQUEDA) return { posts: [], miembros: [] };
  const patron = patronDeBusqueda(q);
  const candidatos = async (col: 'titulo' | 'cuerpo') => {
    const { data, error } = await de(a.ws, 'comunidad_posts').select(COLS_POST).eq('producto_id', a.productoId)
      .ilike(col, patron).order('created_at', { ascending: false }).limit(CANDIDATOS_BUSQUEDA);
    if (error) throw new Error(error.message);
    return (data ?? []) as FilaPost[];
  };
  // Los miembros son best-effort: con la entrega caída, la búsqueda de posts igual contesta.
  const gente = miembrosComunidad(a, { q }).then((m) => m.miembros).catch((e: unknown) => {
    console.warn('[comunidad] no pude buscar miembros:', msg(e, ''));
    return [] as MiembroDirectorio[];
  });
  const [porTitulo, porCuerpo, miembros] = await Promise.all([candidatos('titulo'), candidatos('cuerpo'), gente]);
  const vistos = new Set<number>();
  const filas = [...porTitulo, ...porCuerpo]
    .filter((f) => (vistos.has(Number(f.id)) ? false : (vistos.add(Number(f.id)), true)))
    .filter((f) => textoCoincide(`${f.titulo}\n${f.cuerpo}`, q))
    .sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : Number(y.id) - Number(x.id)))
    .slice(0, 20);
  return { posts: await tarjetas(a, filas), miembros: miembros.slice(0, 8) };
}

// ── El onboarding de la tab ───────────────────────────────────────────────────────

/**
 * Lo que dicen los datos del workspace para el onboarding de la tab (app/customer-success/comunidad/
 * onboarding-comunidad.ts). `null` = no se pudo leer (no es cero). No tira.
 */
export async function hechosDeLaComunidad(ws: number): Promise<{ categorias: number | null; posts: number | null; participacion: number | null }> {
  const contar = async (t: TablaComunidad, filtro?: 'alumno') => {
    try {
      let q = de(ws, t).select('id', { count: 'exact', head: true });
      if (filtro === 'alumno') q = q.not('lead_id', 'is', null);
      const { count, error } = await q;
      return error || count == null ? null : count;
    } catch {
      return null;
    }
  };
  const [categorias, posts, delAlumnoP, delAlumnoC] = await Promise.all([
    contar('comunidad_categorias'), contar('comunidad_posts'), contar('comunidad_posts', 'alumno'), contar('comunidad_comentarios', 'alumno'),
  ]);
  // Con una de las dos sin leer, sólo se puede afirmar que HAY participación (la otra dio > 0); un
  // cero con la otra caída no es un cero.
  const suma = (delAlumnoP ?? 0) + (delAlumnoC ?? 0);
  const participacion = delAlumnoP != null && delAlumnoC != null ? suma : suma > 0 ? suma : null;
  return { categorias, posts, participacion };
}
