// =============================================================================
// editor-landing/server — las operaciones de los documentos del editor copiado de Gamma
// =============================================================================
// Todo lo que pide `PedidoDocs` (lib/editor-landing/api-tipos.ts) menos publicar, despublicar y el
// interruptor del sitio, que viven en publicar.ts. Lo llama UNA ruta, /api/landing-generator, que
// ya puso la puerta (admin del workspace + la tab en su capa). Diseño:
// docs/diseno-editor-landing.md (D2, D8).
//
// Las reglas que este archivo no negocia:
//   · TODO va por `getTenantDb()` (acota por workspace) Y con el `.eq('workspace_id', ws)` escrito:
//     el segundo es la red por si la línea de TENANT_TABLES se pierde al juntar las partes.
//   · GUARDAR ES COMPARE-AND-SET por `version`: `update … where id and version = v`. Si otro guardó
//     en el medio, 0 filas = conflicto con la versión actual, y la pantalla ofrece recargar. Nunca
//     se pisa en silencio el trabajo de otra pestaña.
//   · Lo que se guarda pasa por `sanearContenido` / `sanearConfig` (validar.ts) y lo que el saneo
//     tira queda en el log con su motivo: «no llegó» y «lo tiramos nosotros» no pueden verse igual.
//   · Una lectura que FALLA no se convierte en «no hay»: los temas propios se leen estrictos, y la
//     analítica devuelve `null` donde no se midió, nunca un 0 inventado.
// =============================================================================

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { getSupabaseServer } from '../supabase';
import { getUsuarioActual } from '../auth';
import { getSettingEstricto, cambiarSettingSi } from '../settings';
import { baseLandings, basesLandings, urlPublicaLanding, urlVistaLanding } from '../app-url';
import { leerTodo, leerPorPaginas } from '../supabase-paginado';
import { tzDeWorkspace } from '../timezone';
import { hoyEnTz } from '../date-utils';
import type { LandingSpec } from '../landing-spec';
import { contenidoVacio, slugDe, slugValido, type JsonNodo, type LandingContenido } from './doc';
import { CONFIG_DEFAULT, formatoDe, proporcionDe } from './api-tipos';
import type {
  Analitica, Comentario, ConfigLanding, Falla, LandingCompleta, LandingResumen, PedidoDocs,
  TemaPropio, VersionResumen,
} from './api-tipos';
import { sanearContenido, sanearConfig, excedeTope } from './validar';
import { sanearTemaPropio } from './temas';
import { specADoc } from './spec-a-doc';
import { soltarDominioDeVercel } from './dominios';
import {
  MOTIVO, TOPE_VERSIONES_AUTO, TOPE_TEMAS, CLAVE_TEMAS, cambiosSinPublicar, candidatosSlug, esUrlMedida,
  idValido, mezclarConfig, motivoSlugInvalido, prefiltroVisitas, primeraLibre, puedeBorrarse,
  sanearMotivo, sanearTemasPropios, sanearTitulo, slugPedido, tarjetaIdValido, esComentarioPropio, puedeBorrarComentario,
  tocaVersionAutomatica, urlsAMedir, visitasPorDia,
} from './server-reglas';

// ─────────────────────────────────────────────────────────────────────────────
// Las respuestas (el contrato de cada acción hacia la pantalla)
// ─────────────────────────────────────────────────────────────────────────────

export type AccionDocs = PedidoDocs['accion'];
export type BorradorViejo = { id: number; titulo: string; pedido: string; objetivo: string | null; creado: string };
export type VersionCompleta = VersionResumen & { contenido: LandingContenido; config: ConfigLanding };
type Nada = Record<never, never>;

/** Exige que estén TODAS las acciones: una acción nueva en `PedidoDocs` sin su respuesta no tipa. */
type CubreTodas<T extends Record<AccionDocs, object>> = T;

/** Lo que devuelve cada acción además de `ok: true`. La pantalla lo importa con `import type`. */
export type RespuestasDocs = CubreTodas<{
  listar: { docs: LandingResumen[] };
  abrir: { doc: LandingCompleta };
  crear: { doc: LandingCompleta };
  /** `descartes` = cuántas cosas tiró el saneo (la pantalla puede avisarlo; el detalle va al log). */
  guardar: { version: number; actualizado: string; cambiosSinPublicar: boolean; descartes: number };
  duplicar: { doc: LandingResumen };
  renombrar: { version: number; titulo: string };
  papelera: Nada;
  restaurar: Nada;
  borrar: Nada;
  versiones: { versiones: VersionResumen[] };
  version: { version: VersionCompleta };
  guardarVersion: { version: VersionResumen };
  restaurarVersion: { doc: LandingCompleta };
  /** `motivo` = por qué no está disponible (texto corto), o null. */
  slugDisponible: { slug: string; disponible: boolean; sugerencia: string | null; motivo: string | null };
  publicar: { url: string; slug: string; publicadoAt: string; version: number };
  despublicar: Nada;
  sitioActivo: { sitioActivo: boolean };
  vistaPrevia: { url: string };
  comentarios: { comentarios: Comentario[] };
  comentar: { comentario: Comentario };
  resolverComentario: { resuelto: boolean };
  borrarComentario: Nada;
  analitica: { analitica: Analitica };
  temas: { temas: TemaPropio[] };
  guardarTema: { tema: TemaPropio; temas: TemaPropio[] };
  borrarTema: { temas: TemaPropio[] };
  borradoresViejos: { borradores: BorradorViejo[] };
  importarBorrador: { doc: LandingCompleta };
}>;

/** La respuesta de una acción tal como la ve la pantalla. */
export type RespuestaDocs<A extends AccionDocs> = ({ ok: true } & RespuestasDocs[A]) | Falla;

/** La falla con el código HTTP que la ruta usa y NO manda en el cuerpo. */
export type FallaHttp = Falla & { status: number };
export type Resultado<A extends AccionDocs> = ({ ok: true } & RespuestasDocs[A]) | FallaHttp;

export const falla = (error: string, status = 400): FallaHttp => ({ ok: false, error, status });

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─────────────────────────────────────────────────────────────────────────────
// Filas y conversiones
// ─────────────────────────────────────────────────────────────────────────────

export type FilaDoc = {
  id: number;
  workspace_id: number;
  titulo: string;
  contenido: unknown;
  config: unknown;
  version: number;
  slug: string | null;
  publicado: unknown;
  publicado_at: string | null;
  publicado_version: number | null;
  sitio_activo: boolean;
  vista_token: string | null;
  favorito: boolean;
  carpeta: string | null;
  papelera_at: string | null;
  creado_por: string | null;
  creado_por_nombre: string | null;
  created_at: string;
  updated_at: string;
};

/** Las columnas de una landing ENTERA. Las que no trae la lectura no existen para la conversión. */
export const COLS_DOC = 'id, workspace_id, titulo, contenido, config, version, slug, publicado_at, publicado_version, sitio_activo, vista_token, favorito, carpeta, papelera_at, creado_por, creado_por_nombre, created_at, updated_at';

/**
 * Las del Panel. `primera` sale de la base por camino JSON (la primera sección de la primera
 * página) y NO se trae el contenido entero: con 40 landings de 200 KB, el Panel bajaría 8 MB para
 * dibujar 40 miniaturas.
 */
// `dominio`/`dominio_estado` (mig 0263, tanda 4): el Panel reconoce como NUESTRA una página analizada en
// el dominio propio de una landing. Medido el 14/10/2026: la columna existe en producción (la ruta del
// dominio la consulta por cada host ajeno y contestó 404, no 503).
const COLS_RESUMEN = 'id, titulo, tema:config->>tema, formato:config->>formato, proporcion:config->>proporcion, created_at, updated_at, creado_por_nombre, favorito, carpeta, papelera_at, slug, publicado_at, dominio, dominio_estado, primera:contenido->paginas->0->doc->content->0';

type FilaResumen = {
  id: number; titulo: string; tema: string | null; formato: string | null; proporcion: string | null; created_at: string; updated_at: string;
  creado_por_nombre: string | null; favorito: boolean; carpeta: string | null; papelera_at: string | null;
  slug: string | null; publicado_at: string | null; dominio?: string | null; dominio_estado?: string | null; primera: unknown;
};

const esNodo = (v: unknown): v is JsonNodo => !!v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string';

function aResumen(f: FilaResumen): LandingResumen {
  return {
    id: Number(f.id),
    titulo: f.titulo,
    tema: f.tema || CONFIG_DEFAULT.tema,
    creado: f.created_at,
    actualizado: f.updated_at,
    creadoPor: f.creado_por_nombre,
    favorito: !!f.favorito,
    carpeta: f.carpeta,
    papelera: !!f.papelera_at,
    slug: f.slug,
    publicadoAt: f.publicado_at,
    // Sólo el VERIFICADO: uno pendiente todavía no sirve nada, y otra cuenta se lo puede quitar.
    dominio: f.dominio_estado === 'verificado' && typeof f.dominio === 'string' && f.dominio ? f.dominio : null,
    primera: esNodo(f.primera) ? f.primera : null,
    // T1/T3: el ícono del renglón del Panel y la forma de la miniatura. Sin el campo (lo guardado
    // antes de la tanda 2) es una página: las mismas funciones que `sanearConfig`.
    formato: formatoDe(f),
    proporcion: proporcionDe(f),
  };
}

/** Saneo de lo que se GUARDA, con el log de lo descartado. */
export function limpiarContenido(raw: unknown, donde: string): { contenido: LandingContenido; descartes: number; grande: boolean } {
  const r = sanearContenido(raw);
  if (r.descartes.length) console.warn(`[editor-landing] ${donde}: el saneo descartó ${r.descartes.length}`, JSON.stringify(r.descartes.slice(0, 12)).slice(0, 2000));
  return { contenido: r.contenido, descartes: r.descartes.length, grande: excedeTope(r) };
}

export function limpiarConfig(raw: unknown, donde: string): { config: ConfigLanding; descartes: number } {
  const r = sanearConfig(raw);
  if (r.descartes.length) console.warn(`[editor-landing] ${donde}: el saneo de la configuración descartó ${r.descartes.length}`, JSON.stringify(r.descartes.slice(0, 12)).slice(0, 2000));
  return { config: r.config, descartes: r.descartes.length };
}

/**
 * La landing como la recibe el editor. El contenido se vuelve a sanear al LEER: una fila escrita por
 * otro camino (o por una versión vieja del validador) llega igual con la forma que el editor espera.
 */
export function aCompleta(f: FilaDoc): LandingCompleta {
  const contenido = limpiarContenido(f.contenido, `abrir #${f.id}`).contenido;
  const config = limpiarConfig(f.config, `abrir #${f.id}`).config;
  return {
    id: Number(f.id),
    titulo: f.titulo,
    contenido,
    config,
    version: f.version,
    slug: f.slug,
    publicadoAt: f.publicado_at,
    cambiosSinPublicar: cambiosSinPublicar(f),
    sitioActivo: !!f.sitio_activo,
    urlPublica: f.slug && f.publicado_at ? urlPublicaLanding(f.slug) : null,
    baseLandings: baseLandings(),
    creado: f.created_at,
    actualizado: f.updated_at,
    favorito: f.favorito === true,
    creadoPor: (f.creado_por_nombre ?? '').trim() || null,
  };
}

/**
 * Quién está haciendo esto, para el autor de una versión o de un comentario. `superAdmin` es el rol
 * de PLATAFORMA (`rol === 'admin'` en la sesión), no el del workspace: la ruta ya exige admin del
 * negocio a todos, así que «el admin puede borrar» no distinguiría a nadie.
 */
async function quienSoy(): Promise<{ sub: string | null; nombre: string; superAdmin: boolean }> {
  const s = await getUsuarioActual();
  return { sub: s?.sub ?? null, nombre: (s?.nombre || s?.email || '').trim(), superAdmin: s?.rol === 'admin' };
}

/** El workspace del request, o la falla. La ruta ya lo exigió: esto es la red por si otro llama. */
async function wsOFalla(): Promise<number | FallaHttp> {
  const ws = await getWorkspaceActual();
  return ws ?? falla('No hay un negocio abierto', 403);
}

/** Lee UNA landing del workspace. `null` = no existe (o es de otro negocio); un error de base TIRA. */
export async function leerFilaDoc(ws: number, id: number, cols = COLS_DOC): Promise<FilaDoc | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_docs').select(cols).eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as FilaDoc | null) ?? null;
}

/** Deja una instantánea de la fila tal como está. */
export async function crearVersion(ws: number, f: Pick<FilaDoc, 'id' | 'titulo' | 'contenido' | 'config'>, motivo: string, autor: string | null): Promise<VersionResumen> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_doc_versiones')
    .insert({ workspace_id: ws, doc_id: f.id, titulo: f.titulo, contenido: f.contenido, config: f.config ?? {}, motivo: sanearMotivo(motivo), autor: autor || null })
    .select('id, created_at, motivo, autor, titulo').single();
  if (error) throw new Error(error.message);
  const v = data as { id: number; created_at: string; motivo: string; autor: string | null; titulo: string };
  return { id: Number(v.id), creado: v.created_at, motivo: v.motivo, autor: v.autor, titulo: v.titulo };
}

/**
 * Las instantáneas AUTOMÁTICAS más viejas que las últimas `TOPE_VERSIONES_AUTO` se borran (las
 * publicadas y las manuales quedan todas). Sin esto, una landing editada todos los días acumula una
 * fila de hasta 1,5 MB cada diez minutos de edición, para siempre. Lo que se poda queda en el log.
 */
async function podarVersionesAuto(ws: number, docId: number): Promise<void> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_doc_versiones').select('id')
    .eq('workspace_id', ws).eq('doc_id', docId).eq('motivo', MOTIVO.auto)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(TOPE_VERSIONES_AUTO, TOPE_VERSIONES_AUTO + 199);
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as { id: number }[]).map((r) => r.id);
  if (!ids.length) return;
  const { error: e2 } = await db.from('landing_doc_versiones').delete().eq('workspace_id', ws).eq('doc_id', docId).in('id', ids);
  if (e2) throw new Error(e2.message);
  console.log(`[editor-landing] #${docId}: se borraron ${ids.length} versiones automáticas viejas`);
}

/** La versión actual de una landing (para el conflicto), o null si no existe. */
async function versionActual(ws: number, id: number): Promise<number | null> {
  const f = await leerFilaDoc(ws, id, 'id, version');
  return f ? f.version : null;
}

/**
 * Un cambio que SUBE la versión desde una pantalla que no conoce la versión abierta (renombrar desde
 * el Panel). Lee la versión y escribe con compare-and-set; si otro guardó en el medio, reintenta con
 * la nueva (el cambio es de un campo, no pisa nada del editor). Tres vueltas y se rinde.
 */
async function cambiarSubiendoVersion(ws: number, id: number, patch: Record<string, unknown>): Promise<{ version: number } | FallaHttp> {
  const db = await getTenantDb();
  for (let i = 0; i < 3; i++) {
    const v = await versionActual(ws, id);
    if (v == null) return falla('No existe', 404);
    const { data, error } = await db.from('landing_docs')
      .update({ ...patch, version: v + 1, updated_at: new Date().toISOString() })
      .eq('workspace_id', ws).eq('id', id).eq('version', v).select('version');
    if (error) return falla(error.message, 500);
    if ((data ?? []).length) return { version: (data as { version: number }[])[0].version };
  }
  return falla('Hay otro cambio a la vez', 409);
}

/** Un cambio de METADATOS (favorito, carpeta, papelera): no sube la versión ni toca lo publicable. */
async function cambiarMetadatos(ws: number, id: number, patch: Record<string, unknown>): Promise<true | FallaHttp> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_docs').update(patch).eq('workspace_id', ws).eq('id', id).select('id');
  if (error) return falla(error.message, 500);
  return (data ?? []).length ? true : falla('No existe', 404);
}

// ─────────────────────────────────────────────────────────────────────────────
// Documentos
// ─────────────────────────────────────────────────────────────────────────────

export async function listar(): Promise<Resultado<'listar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  try {
    // Paginado y con orden por la PK: la tabla crece con el uso, y un select suelto corta en 1000
    // filas sin avisar (AGENTS.md, «Un número redondo es una hipótesis de truncamiento»).
    const filas = await leerTodo<FilaResumen>(await getTenantDb(), 'landing_docs', COLS_RESUMEN, { eq: { workspace_id: ws }, orden: 'id' });
    const docs = filas.map(aResumen).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
    return { ok: true, docs };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

export async function abrir(idRaw: unknown): Promise<Resultado<'abrir'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const f = await leerFilaDoc(ws, id);
    return f ? { ok: true, doc: aCompleta(f) } : falla('No existe', 404);
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/** Crea una landing. La comparten crear (Panel, plantillas, IA) e importar del generador anterior. */
async function crearEn(ws: number, titulo: unknown, contenidoRaw: unknown, configParcial: unknown): Promise<Resultado<'crear'>> {
  const yo = await quienSoy();
  const { contenido, grande } = contenidoRaw === undefined || contenidoRaw === null
    ? { contenido: contenidoVacio(), grande: false }
    : limpiarContenido(contenidoRaw, 'crear');
  if (grande) return falla('La landing es demasiado grande', 413);
  const { config } = limpiarConfig(mezclarConfig(configParcial), 'crear');
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_docs').insert({
    workspace_id: ws,
    titulo: sanearTitulo(titulo),
    contenido,
    config,
    creado_por: yo.sub,
    creado_por_nombre: yo.nombre || null,
  }).select(COLS_DOC).single();
  if (error) return falla(error.message, 500);
  return { ok: true, doc: aCompleta(data as unknown as FilaDoc) };
}

export async function crear(p: Extract<PedidoDocs, { accion: 'crear' }>): Promise<Resultado<'crear'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  try {
    return await crearEn(ws, p.titulo, p.contenido, p.config);
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * Guarda lo que mandó el editor, sólo si la versión que tiene es la de la base.
 *
 * ⚠️ PARCIAL A PROPÓSITO: cada campo que no vino (`titulo`, `contenido`, `config`) queda como estaba.
 * El autoguardado del título no tiene por qué mandar 1 MB de contenido.
 */
export async function guardar(p: Extract<PedidoDocs, { accion: 'guardar' }>): Promise<Resultado<'guardar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(p.id);
  const abierta = typeof p.version === 'number' && Number.isSafeInteger(p.version) && p.version >= 1 ? p.version : null;
  if (!id || !abierta) return falla('Falta la landing o su versión');

  const ahora = new Date().toISOString();
  const patch: Record<string, unknown> = { version: abierta + 1, updated_at: ahora };
  let descartes = 0;
  if (p.titulo !== undefined) patch.titulo = sanearTitulo(p.titulo);
  if (p.contenido !== undefined) {
    const r = limpiarContenido(p.contenido, `guardar #${id}`);
    if (r.grande) return falla('La landing es demasiado grande', 413);
    patch.contenido = r.contenido;
    descartes += r.descartes;
  }
  if (p.config !== undefined) {
    const r = limpiarConfig(p.config, `guardar #${id}`);
    patch.config = r.config;
    descartes += r.descartes;
  }

  try {
    const db = await getTenantDb();
    // Sin nada que guardar no se escribe: subir la versión en vano encendería «cambios sin
    // publicar» sobre una landing idéntica. Se contesta el estado (o el conflicto) y listo.
    if (p.titulo === undefined && p.contenido === undefined && p.config === undefined) {
      const f = await leerFilaDoc(ws, id, 'id, version, updated_at, publicado_at, publicado_version');
      if (!f) return falla('No existe', 404);
      if (f.version !== abierta) return { ok: false, error: 'Hay una versión más nueva', conflicto: true, versionActual: f.version, status: 409 };
      return { ok: true, version: f.version, actualizado: f.updated_at, cambiosSinPublicar: cambiosSinPublicar(f), descartes: 0 };
    }
    // EL COMPARE-AND-SET: `version = v` en el WHERE. Si otra pestaña guardó en el medio, la fila ya
    // tiene v+1 y esto no toca nada.
    const { data, error } = await db.from('landing_docs').update(patch)
      .eq('workspace_id', ws).eq('id', id).eq('version', abierta)
      .select('id, version, updated_at, publicado_at, publicado_version');
    if (error) return falla(error.message, 500);
    const fila = ((data ?? []) as Pick<FilaDoc, 'id' | 'version' | 'updated_at' | 'publicado_at' | 'publicado_version'>[])[0];
    if (!fila) {
      const actual = await versionActual(ws, id);
      if (actual == null) return falla('No existe', 404);
      return { ok: false, error: 'Hay una versión más nueva', conflicto: true, versionActual: actual, status: 409 };
    }

    // La versión AUTOMÁTICA, y es accesoria: si falla, el guardado ya está hecho y no se deshace
    // por no haber podido dejar la instantánea. Queda en el log.
    try {
      const { data: ult, error: eUlt } = await db.from('landing_doc_versiones').select('created_at')
        .eq('workspace_id', ws).eq('doc_id', id).order('created_at', { ascending: false }).limit(1);
      if (eUlt) throw new Error(eUlt.message);
      const ultima = ((ult ?? []) as { created_at: string }[])[0]?.created_at ?? null;
      if (tocaVersionAutomatica(ultima, Date.now())) {
        const completa = await leerFilaDoc(ws, id, 'id, titulo, contenido, config');
        if (completa) {
          await crearVersion(ws, completa, MOTIVO.auto, (await quienSoy()).nombre);
          await podarVersionesAuto(ws, id);
        }
      }
    } catch (e) {
      console.warn(`[editor-landing] guardar #${id}: no pude dejar la versión automática: ${msg(e)}`);
    }

    // El onboarding de la tab se completa usándola (TAB_ONBOARDINGS). La primera vez que se guarda
    // ESTA landing (versión 1 → 2); marcar es idempotente, y si el paso anterior no está hecho la
    // guarda de `marcarPasoTab` lo frena: es accesorio, no puede tumbar el guardado.
    if (abierta === 1) {
      try {
        const { marcarPasoTab } = await import('../tab-onboarding-state');
        await marcarPasoTab('landing-writer', 'guardar');
      } catch { /* accesorio al guardado */ }
    }

    return { ok: true, version: fila.version, actualizado: fila.updated_at, cambiosSinPublicar: cambiosSinPublicar(fila), descartes };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

export async function duplicar(idRaw: unknown): Promise<Resultado<'duplicar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const f = await leerFilaDoc(ws, id, 'id, titulo, contenido, config, carpeta');
    if (!f) return falla('No existe', 404);
    const yo = await quienSoy();
    const db = await getTenantDb();
    // La copia NO hereda lo público (slug, foto, link privado): son de la original. Y nace como un
    // documento nuevo (versión 1, sin historial).
    const { data, error } = await db.from('landing_docs').insert({
      workspace_id: ws,
      titulo: sanearTitulo(`${f.titulo} (copia)`),
      contenido: f.contenido,
      config: f.config ?? {},
      carpeta: f.carpeta,
      creado_por: yo.sub,
      creado_por_nombre: yo.nombre || null,
    }).select(COLS_RESUMEN).single();
    if (error) return falla(error.message, 500);
    return { ok: true, doc: aResumen(data as unknown as FilaResumen) };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/** El título es parte de lo publicable: renombrar SUBE la versión (el editor abierto en otra pestaña se entera). */
export async function renombrar(idRaw: unknown, tituloRaw: unknown): Promise<Resultado<'renombrar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  const titulo = sanearTitulo(tituloRaw);
  try {
    const r = await cambiarSubiendoVersion(ws, id, { titulo });
    return 'version' in r ? { ok: true, version: r.version, titulo } : r;
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// «Favorito» y «Mover a carpeta» se fueron con la tanda 2 (T1, 11/10/2026): el Panel ya no tiene las
// vistas de Favoritos ni las Carpetas, así que marcar algo no se veía en ningún lado. Las columnas
// favorito y carpeta quedan en la tabla sin uso (no se borra un dato por una pantalla).

/**
 * A la papelera. Lo publicado NO se borra: la página pública deja de servirla mientras esté en la
 * papelera (`leerPublicado` exige `papelera_at` vacío) y vuelve tal cual al restaurarla.
 */
export async function mandarAPapelera(idRaw: unknown): Promise<Resultado<'papelera'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const r = await cambiarMetadatos(ws, id, { papelera_at: new Date().toISOString() });
    return r === true ? { ok: true } : r;
  } catch (e) {
    return falla(msg(e), 500);
  }
}

export async function restaurarDePapelera(idRaw: unknown): Promise<Resultado<'restaurar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const r = await cambiarMetadatos(ws, id, { papelera_at: null });
    return r === true ? { ok: true } : r;
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * Borrar para siempre. SÓLO desde la papelera, y la condición se pregunta dos veces: en la lectura
 * (para contestar el motivo) y en el propio `delete` (`papelera_at is not null`), que es la que de
 * verdad protege — si la landing salió de la papelera en el medio, no se va. Se lleva sus versiones
 * y comentarios (cascade); las imágenes quedan en la biblioteca del negocio, que es compartida.
 */
export async function borrar(idRaw: unknown): Promise<Resultado<'borrar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const f = await leerFilaDoc(ws, id, 'id, papelera_at');
    if (!f) return falla('No existe', 404);
    if (!puedeBorrarse(f)) return falla('Primero va a la papelera', 409);
    const db = await getTenantDb();
    // T7: el dominio propio se suelta de Vercel ANTES de borrar la fila, como `quitarDominio`
    // (revisión de la tanda 2, BAJA): después, en el hueco, otra cuenta lo reclama y el DELETE se lo
    // saca del proyecto. Y si Vercel falla, la landing NO se borra: sin la fila nadie sabría qué
    // dominio quedó colgado. Se lee aparte: sin la migración 0263 la columna no existe (42703, se
    // tolera: no hay dominio que soltar), y un select con una columna que falta rechazaría el borrado
    // entero. Cualquier otro error de lectura frena: «no pude leer» no es «no tiene dominio».
    const { data: conDominio, error: eDominio } = await db.from('landing_docs').select('dominio, dominio_agregado_por_mako').eq('workspace_id', ws).eq('id', id).maybeSingle();
    if (eDominio && (eDominio as { code?: string }).code !== '42703') return falla(eDominio.message, 500);
    const fd = eDominio ? null : (conDominio as { dominio?: string | null; dominio_agregado_por_mako?: boolean | null } | null);
    if (fd?.dominio) {
      try {
        await soltarDominioDeVercel(fd.dominio, fd.dominio_agregado_por_mako);
      } catch (e) {
        console.error(`[landing-editor:borrar] #${id}: no pude soltar ${fd.dominio} de Vercel, no se borra: ${msg(e)}`);
        return falla('No pude soltar el dominio propio de esta landing. Vuelve a intentar.', 502);
      }
    }
    const { data, error } = await db.from('landing_docs').delete()
      .eq('workspace_id', ws).eq('id', id).not('papelera_at', 'is', null).select('id');
    if (error) return falla(error.message, 500);
    if (!(data ?? []).length) return falla('Primero va a la papelera', 409);
    return { ok: true };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Versiones
// ─────────────────────────────────────────────────────────────────────────────

export async function versiones(idRaw: unknown): Promise<Resultado<'versiones'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_doc_versiones').select('id, created_at, motivo, autor, titulo')
      .eq('workspace_id', ws).eq('doc_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(300);
    if (error) return falla(error.message, 500);
    const lista = ((data ?? []) as { id: number; created_at: string; motivo: string; autor: string | null; titulo: string }[])
      .map((v) => ({ id: Number(v.id), creado: v.created_at, motivo: v.motivo, autor: v.autor, titulo: v.titulo }));
    return { ok: true, versiones: lista };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

type FilaVersion = { id: number; created_at: string; motivo: string; autor: string | null; titulo: string; contenido: unknown; config: unknown };

async function leerVersion(ws: number, docId: number, versionId: number): Promise<FilaVersion | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_doc_versiones').select('id, created_at, motivo, autor, titulo, contenido, config')
    .eq('workspace_id', ws).eq('doc_id', docId).eq('id', versionId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaVersion | null) ?? null;
}

export async function verVersion(idRaw: unknown, versionIdRaw: unknown): Promise<Resultado<'version'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  const versionId = idValido(versionIdRaw);
  if (!id || !versionId) return falla('Falta la versión');
  try {
    const v = await leerVersion(ws, id, versionId);
    if (!v) return falla('No existe', 404);
    return {
      ok: true,
      version: {
        id: Number(v.id), creado: v.created_at, motivo: v.motivo, autor: v.autor, titulo: v.titulo,
        contenido: limpiarContenido(v.contenido, `versión #${versionId}`).contenido,
        config: limpiarConfig(v.config, `versión #${versionId}`).config,
      },
    };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/** «Guardar versión» a mano, y la que deja la IA antes de aplicar un cambio (con su motivo). */
export async function guardarVersion(idRaw: unknown, motivoRaw: unknown): Promise<Resultado<'guardarVersion'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const f = await leerFilaDoc(ws, id, 'id, titulo, contenido, config');
    if (!f) return falla('No existe', 404);
    const v = await crearVersion(ws, f, sanearMotivo(motivoRaw), (await quienSoy()).nombre);
    return { ok: true, version: v };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * Vuelve la landing a una versión. ANTES deja una instantánea de lo que había («Antes de
 * restaurar»): restaurar es reversible por construcción. El cambio sube la versión con
 * compare-and-set contra la que se acaba de leer.
 */
export async function restaurarVersion(idRaw: unknown, versionIdRaw: unknown): Promise<Resultado<'restaurarVersion'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  const versionId = idValido(versionIdRaw);
  if (!id || !versionId) return falla('Falta la versión');
  try {
    const [actual, v] = await Promise.all([leerFilaDoc(ws, id), leerVersion(ws, id, versionId)]);
    if (!actual || !v) return falla('No existe', 404);
    const yo = await quienSoy();
    await crearVersion(ws, actual, MOTIVO.antesDeRestaurar, yo.nombre);
    const contenido = limpiarContenido(v.contenido, `restaurar #${id}`).contenido;
    const config = limpiarConfig(v.config, `restaurar #${id}`).config;
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_docs')
      .update({ titulo: sanearTitulo(v.titulo), contenido, config, version: actual.version + 1, updated_at: new Date().toISOString() })
      .eq('workspace_id', ws).eq('id', id).eq('version', actual.version).select(COLS_DOC);
    if (error) return falla(error.message, 500);
    const fila = ((data ?? []) as unknown as FilaDoc[])[0];
    if (!fila) {
      const va = await versionActual(ws, id);
      return { ok: false, error: 'Hay una versión más nueva', conflicto: true, versionActual: va ?? undefined, status: 409 };
    }
    return { ok: true, doc: aCompleta(fila) };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La dirección pública y el link privado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Está libre esta dirección? Contesta también una SUGERENCIA libre (el pedido pasado por `slugDe`,
 * con sufijo si está tomado).
 *
 * ⚠️ LA UNICIDAD ES GLOBAL, así que la pregunta va con el cliente CRUDO (`getSupabaseServer`) y no
 * con `getTenantDb`: acotada al workspace, contestaría «libre» sobre el slug de otro negocio y el
 * publicar chocaría contra el índice único. Sólo se lee si existe (la columna `slug`), nunca de quién.
 */
export async function slugDisponible(idRaw: unknown, slugRaw: unknown): Promise<Resultado<'slugDisponible'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  const slug = slugPedido(slugRaw);
  try {
    const propia = await leerFilaDoc(ws, id, 'id, titulo');
    if (!propia) return falla('No existe', 404);
    const candidatos = candidatosSlug(slug || propia.titulo);
    const ocupados = await slugsOcupados([...new Set([slug, ...candidatos].filter(Boolean))], id);
    const sugerencia = primeraLibre(candidatos, ocupados);
    const invalido = motivoSlugInvalido(slug);
    if (invalido) return { ok: true, slug, disponible: false, sugerencia, motivo: invalido };
    const libre = !ocupados.has(slug);
    return { ok: true, slug, disponible: libre, sugerencia: libre ? null : sugerencia, motivo: libre ? null : 'Ya está tomada' };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/** Cuáles de estos slugs tiene OTRA landing (de cualquier negocio). Global a propósito. */
export async function slugsOcupados(slugs: readonly string[], menosId: number): Promise<Set<string>> {
  const validos = slugs.filter(slugValido);
  if (!validos.length) return new Set();
  const { data, error } = await getSupabaseServer().from('landing_docs').select('slug').in('slug', validos).neq('id', menosId);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
}

/**
 * El link privado al BORRADOR (/l/vista/<token>): lo guardado, sin publicar, sin Pixel y con
 * `noindex`. Se crea la primera vez y se reusa; `regenerar` lo cambia e invalida el anterior (el
 * «dejar de compartir» de un link que ya se mandó).
 */
export async function vistaPrevia(idRaw: unknown, regenerar: unknown): Promise<Resultado<'vistaPrevia'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const f = await leerFilaDoc(ws, id, 'id, vista_token');
    if (!f) return falla('No existe', 404);
    let token = f.vista_token;
    if (!token || regenerar === true) {
      // 32 bytes de `crypto`: el link ES la llave, así que no puede ser adivinable ni secuencial.
      token = randomBytes(32).toString('base64url');
      const r = await cambiarMetadatos(ws, id, { vista_token: token });
      if (r !== true) return r;
    }
    return { ok: true, url: urlVistaLanding(token) };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comentarios
// ─────────────────────────────────────────────────────────────────────────────

type FilaComentario = { id: number; tarjeta_id: string; parent_id: number | null; texto: string; autor_nombre: string; autor_sub: string | null; resuelto: boolean; created_at: string };
const COLS_COMENTARIO = 'id, tarjeta_id, parent_id, texto, autor_nombre, autor_sub, resuelto, created_at';

const aComentario = (c: FilaComentario, miSub: string | null): Comentario => ({
  id: Number(c.id), tarjetaId: c.tarjeta_id, parentId: c.parent_id == null ? null : Number(c.parent_id),
  texto: c.texto, autor: c.autor_nombre, autorSub: c.autor_sub, resuelto: !!c.resuelto, creado: c.created_at,
  propio: esComentarioPropio(c.autor_sub, miSub),
});

export async function comentarios(idRaw: unknown): Promise<Resultado<'comentarios'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const lista = await leerTodo<FilaComentario>(await getTenantDb(), 'landing_doc_comentarios', COLS_COMENTARIO, {
      eq: { workspace_id: ws, doc_id: id }, orden: ['created_at', 'id'],
    });
    const yo = await quienSoy();
    return { ok: true, comentarios: lista.map((c) => aComentario(c, yo.sub)) };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

export async function comentar(p: Extract<PedidoDocs, { accion: 'comentar' }>): Promise<Resultado<'comentar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(p.id);
  if (!id) return falla('Falta la landing');
  if (!tarjetaIdValido(p.tarjetaId)) return falla('Falta la sección');
  const texto = typeof p.texto === 'string' ? p.texto.trim().slice(0, 5000) : '';
  if (!texto) return falla('Escribe algo');
  const parentId = p.parentId == null ? null : idValido(p.parentId);
  if (p.parentId != null && !parentId) return falla('Falta el comentario');
  try {
    const doc = await leerFilaDoc(ws, id, 'id');
    if (!doc) return falla('No existe', 404);
    const db = await getTenantDb();
    if (parentId) {
      // La respuesta tiene que colgar de un comentario de ESTA landing: un parent de otra (o de otro
      // negocio) armaría un hilo cruzado.
      const { data: padre, error: eP } = await db.from('landing_doc_comentarios').select('id')
        .eq('workspace_id', ws).eq('doc_id', id).eq('id', parentId).maybeSingle();
      if (eP) return falla(eP.message, 500);
      if (!padre) return falla('Ese comentario ya no existe', 404);
    }
    const yo = await quienSoy();
    const { data, error } = await db.from('landing_doc_comentarios').insert({
      workspace_id: ws, doc_id: id, tarjeta_id: p.tarjetaId, parent_id: parentId, texto,
      autor_sub: yo.sub, autor_nombre: yo.nombre,
    }).select(COLS_COMENTARIO).single();
    if (error) return falla(error.message, 500);
    return { ok: true, comentario: aComentario(data as FilaComentario, yo.sub) };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

export async function resolverComentario(idRaw: unknown, comentarioIdRaw: unknown, valor: unknown): Promise<Resultado<'resolverComentario'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  const cid = idValido(comentarioIdRaw);
  if (!id || !cid) return falla('Falta el comentario');
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_doc_comentarios').update({ resuelto: valor === true })
      .eq('workspace_id', ws).eq('doc_id', id).eq('id', cid).select('id');
    if (error) return falla(error.message, 500);
    return (data ?? []).length ? { ok: true, resuelto: valor === true } : falla('No existe', 404);
  } catch (e) {
    return falla(msg(e), 500);
  }
}

export async function borrarComentario(idRaw: unknown, comentarioIdRaw: unknown): Promise<Resultado<'borrarComentario'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  const cid = idValido(comentarioIdRaw);
  if (!id || !cid) return falla('Falta el comentario');
  try {
    const db = await getTenantDb();
    // Sólo quien lo escribió (o el super admin): esconder el tacho no protege nada (AGENTS.md).
    // Se lee primero para distinguir «no existe» (404) de «no es tuyo» (403); el delete vuelve a
    // exigir el autor en el WHERE, así que un cambio entre las dos consultas no abre nada.
    const { data: fila, error: eL } = await db.from('landing_doc_comentarios').select('id, autor_sub')
      .eq('workspace_id', ws).eq('doc_id', id).eq('id', cid).maybeSingle();
    if (eL) return falla(eL.message, 500);
    if (!fila) return falla('No existe', 404);
    const yo = await quienSoy();
    const autorSub = (fila as { autor_sub: string | null }).autor_sub;
    if (!puedeBorrarComentario(autorSub, yo)) return falla('Solo quien lo escribió', 403);
    let q = db.from('landing_doc_comentarios').delete().eq('workspace_id', ws).eq('doc_id', id).eq('id', cid);
    if (!yo.superAdmin) q = q.eq('autor_sub', yo.sub as string);
    const { data, error } = await q.select('id');
    if (error) return falla(error.message, 500);
    return (data ?? []).length ? { ok: true } : falla('No existe', 404);
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analítica
// ─────────────────────────────────────────────────────────────────────────────

const DIAS_ANALITICA = 30;

/** Las rutas de las páginas que tiene la FOTO publicada (lo que de verdad se sirve). */
export function rutasDeFoto(publicado: unknown): string[] {
  const paginas = (publicado as { paginas?: unknown } | null)?.paginas;
  if (!Array.isArray(paginas)) return [];
  return paginas.map((p) => (p as { ruta?: unknown })?.ruta).filter((r): r is string => typeof r === 'string');
}

/**
 * Visitas, visitantes y leads de los últimos 30 días de las URLs PUBLICADAS (D8).
 *
 *   · Las visitas salen de `landing_visits` (las escribe el Pixel de MaKo que carga la página
 *     publicada), filtradas por `prueba is null` (el probador de /integraciones no es tráfico) y
 *     cruzadas por la URL NORMALIZADA — el `ilike` sólo trae candidatos.
 *   · Los leads son los de esos visitantes (`leads.visitor_id`) creados en la ventana: el formulario
 *     de la landing entra al CRM por el opt-in del Pixel, que guarda el visitante.
 *   · `alcancePorSeccion` es `null`: el Pixel mide la profundidad de la PÁGINA por hitos (25/50/75/100,
 *     lib/landing-pulso.ts), no qué sección vio cada persona. Repartir ese porcentaje entre secciones
 *     sería inventar un dato con cara de medido; null = no medido, NUNCA 0.
 */
export async function analitica(idRaw: unknown): Promise<Resultado<'analitica'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const db = await getTenantDb();
    const { data: fila, error } = await db.from('landing_docs').select('id, slug, publicado_at, publicado')
      .eq('workspace_id', ws).eq('id', id).maybeSingle();
    if (error) return falla(error.message, 500);
    if (!fila) return falla('No existe', 404);
    const f = fila as { slug: string | null; publicado_at: string | null; publicado: unknown };
    const urls = f.publicado_at ? urlsAMedir(basesLandings(), f.slug, rutasDeFoto(f.publicado)) : [];
    if (!f.slug || !urls.length) {
      // Sin publicar no hay nada que medir: los ceros acá son ciertos (no hubo página que visitar).
      return { ok: true, analitica: { publicada: false, urls: [], visitas30: 0, visitantes30: 0, leads30: 0, porDia: [], alcancePorSeccion: null, enAnalyst: false } };
    }
    const medidas = new Set(urls);
    const desde = new Date(Date.now() - DIAS_ANALITICA * 86_400_000).toISOString();
    const slug = f.slug;

    const fechas: string[] = [];
    const visitantes = new Set<string>();
    await leerPorPaginas<{ id: number; visitor_id: string | null; landing_url: string | null; created_at: string }>(
      db, 'landing_visits', 'id, visitor_id, landing_url, created_at',
      (filas) => {
        for (const v of filas) {
          if (!esUrlMedida(v.landing_url, medidas)) continue;
          fechas.push(v.created_at);
          if (v.visitor_id) visitantes.add(v.visitor_id);
        }
      },
      { eq: { workspace_id: ws }, orden: 'id', filtros: (q) => q.gte('created_at', desde).is('prueba', null).ilike('landing_url', prefiltroVisitas(slug)) },
    );

    // Los leads, en tandas: `leads` es la tabla más grande del inquilino y un `.in` de miles de ids
    // no entra en una URL.
    const leadIds = new Set<number>();
    const ids = [...visitantes];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: eL } = await db.from('leads').select('id')
        .eq('workspace_id', ws).in('visitor_id', ids.slice(i, i + 200)).gte('created_at', desde);
      if (eL) throw new Error(eL.message);
      for (const l of (data ?? []) as { id: number }[]) leadIds.add(Number(l.id));
    }

    const { data: analizadas, error: eA } = await db.from('landing_analyses').select('url').eq('workspace_id', ws).in('url', urls).limit(1);
    if (eA) throw new Error(eA.message);

    const tz = await tzDeWorkspace(ws);
    return {
      ok: true,
      analitica: {
        publicada: true,
        urls,
        visitas30: fechas.length,
        visitantes30: visitantes.size,
        leads30: leadIds.size,
        porDia: visitasPorDia(fechas, hoyEnTz(tz), DIAS_ANALITICA, tz),
        alcancePorSeccion: null,
        enAnalyst: (analizadas ?? []).length > 0,
      },
    };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Temas propios del workspace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los temas propios de UN workspace, leídos con el workspace EXPLÍCITO.
 *
 * ⚠️ Explícito y no por `getSetting`: la página pública y el link privado no tienen cookie, y sin
 * cookie `getSetting` cae al ws1 (Mauricio, un cliente) — la landing de otro negocio se dibujaría con
 * los temas de él. Y ESTRICTO: si la lectura falla, tira. Publicar con «no hay temas propios» porque
 * la base parpadeó dibujaría la landing con el tema de fábrica y nadie sabría por qué.
 */
export async function temasPropiosDe(ws: number): Promise<TemaPropio[]> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value')
    .eq('workspace_id', ws).eq('key', CLAVE_TEMAS).maybeSingle();
  if (error) throw new Error(`No pude leer los temas: ${error.message}`);
  return sanearTemasPropios((data as { value?: unknown } | null)?.value ?? null);
}

export async function temas(): Promise<Resultado<'temas'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  try {
    return { ok: true, temas: await temasPropiosDe(ws) };
  } catch (e) {
    return falla(msg(e), 503);
  }
}

/**
 * Reemplaza la lista de temas con compare-and-set sobre el valor que se leyó (`cambiarSettingSi`):
 * dos pestañas guardando temas a la vez no se pisan, la segunda vuelve a leer y aplica lo suyo encima.
 * La lectura es ESTRICTA: si falla, no se escribe — con «no hay temas» se borrarían los que hay.
 */
async function cambiarTemas(cambio: (lista: TemaPropio[]) => TemaPropio[] | FallaHttp): Promise<TemaPropio[] | FallaHttp> {
  for (let i = 0; i < 3; i++) {
    const crudo = await getSettingEstricto(CLAVE_TEMAS);
    const nueva = cambio(sanearTemasPropios(crudo));
    if (!Array.isArray(nueva)) return nueva;
    if (await cambiarSettingSi(CLAVE_TEMAS, crudo, JSON.stringify(nueva))) return nueva;
  }
  return falla('Hay otro cambio a la vez', 409);
}

export async function guardarTema(raw: unknown): Promise<Resultado<'guardarTema'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const t = (raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}) as Record<string, unknown>;
  // Un tema nuevo llega sin id: se le da uno estable que sale del nombre (el que guarda la config
  // como `ws:<id>`), con un sufijo al azar para que dos «Mi tema» no choquen.
  if (typeof t.id !== 'string' || !t.id.trim()) {
    t.id = `${slugDe(String(t.nombre ?? 'tema')).slice(0, 30)}-${randomBytes(3).toString('hex')}`;
  }
  const tema = sanearTemaPropio(t);
  if (!tema) return falla('Ese tema no tiene la forma');
  try {
    const r = await cambiarTemas((lista) => {
      const i = lista.findIndex((x) => x.id === tema.id);
      if (i >= 0) return lista.map((x, j) => (j === i ? tema : x));
      if (lista.length >= TOPE_TEMAS) return falla('Llegaste al tope de temas', 409);
      return [...lista, tema];
    });
    return Array.isArray(r) ? { ok: true, tema, temas: r } : r;
  } catch (e) {
    return falla(msg(e), 503);
  }
}

export async function borrarTema(temaIdRaw: unknown): Promise<Resultado<'borrarTema'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const temaId = typeof temaIdRaw === 'string' ? temaIdRaw.trim().replace(/^ws:/, '') : '';
  if (!temaId) return falla('Falta el tema');
  try {
    const r = await cambiarTemas((lista) => lista.filter((x) => x.id !== temaId));
    return Array.isArray(r) ? { ok: true, temas: r } : r;
  } catch (e) {
    return falla(msg(e), 503);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// El generador anterior (landing_drafts, que NO se toca)
// ─────────────────────────────────────────────────────────────────────────────

export async function borradoresViejos(): Promise<Resultado<'borradoresViejos'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_drafts').select('id, titulo, pedido, objetivo, created_at')
      .eq('workspace_id', ws).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
    if (error) return falla(error.message, 500);
    const borradores = ((data ?? []) as { id: number; titulo: string | null; pedido: string | null; objetivo: string | null; created_at: string }[])
      .map((d) => ({ id: Number(d.id), titulo: (d.titulo || '').trim() || 'Sin título', pedido: d.pedido ?? '', objetivo: d.objetivo, creado: d.created_at }));
    return { ok: true, borradores };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * Convierte un borrador del generador anterior en una landing nueva (Importar → Del generador
 * anterior). El borrador queda como está: lo siguen leyendo la API de MaKo y su historial.
 */
export async function importarBorrador(draftIdRaw: unknown): Promise<Resultado<'importarBorrador'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const draftId = idValido(draftIdRaw);
  if (!draftId) return falla('Falta el borrador');
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_drafts').select('id, titulo, pedido, objetivo, basado_en_url, spec')
      .eq('workspace_id', ws).eq('id', draftId).maybeSingle();
    if (error) return falla(error.message, 500);
    if (!data) return falla('No existe', 404);
    const d = data as { titulo: string | null; pedido: string | null; objetivo: string | null; basado_en_url: string | null; spec: unknown };
    const spec = d.spec as LandingSpec | null;
    if (!spec || typeof spec !== 'object' || !Array.isArray(spec.bloques)) return falla('Ese borrador no se puede leer', 422);
    const contenido = specADoc(spec);
    const config = {
      sitio: { seoTitulo: spec.meta_titulo ?? '', seoDescripcion: spec.meta_descripcion ?? '' },
      origen: { modo: 'generador', pedido: d.pedido ?? '', objetivo: d.objetivo ?? spec.objetivo, basadoEnUrl: d.basado_en_url },
    };
    const r = await crearEn(ws, d.titulo || spec.nombre, contenido, config);
    return r.ok ? { ok: true, doc: r.doc } : r;
  } catch (e) {
    return falla(msg(e), 500);
  }
}
