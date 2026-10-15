// =============================================================================
// editor-landing/diagnostico-aplicar — «Aplicar» un comentario del Diagnóstico y pasarlos a una copia
// =============================================================================
// Decisión (c) de Martín (14/10/2026), textual del relevo: «"Aplicar" de cada comentario del Diagnóstico
// = un clic, con la versión guardada antes y "Deshacer"; más "Aplicar todos" (de a una sección, un solo
// Deshacer) y "Preguntar a MaKo" (el chat de MaKo al costado con el comentario). En una landing externa,
// "Aplicar" lleva a replicar primero y los comentarios pasan a la copia.»
//
// Lo que corre en el server detrás de POST /api/landing-generator/diagnostico/aplicar (la pantalla) y de
// `aplicar_comentario_landing` (la API de MaKo): UNA sola implementación. Lo puro (el contrato, la
// instrucción, los grupos, la pila de Deshacer) vive en ./diagnostico.ts, con test.
//
//   · `aplicarComentarios`: los comentarios de UNA sección de una landing nuestra. Abre la landing (la de
//     AHORA, no la que tenía la pantalla), le pide a la IA esa sección con todos los comentarios juntos
//     (`editar`, alcance sección, el mismo pedido que «Solucionar con IA»), guarda antes la versión
//     «Antes de aplicar el diagnóstico» si se pide, guarda con la versión que abrió (si alguien guardó en
//     el medio: conflicto, no pisa) y marca los comentarios resueltos. «Deshacer» es restaurar esa versión
//     (la pantalla, con `restaurarVersion`, que a su vez deja «Antes de restaurar»).
//   · `pasarACopia`: los comentarios de una página de AFUERA a su copia recién replicada. Se COPIAN (los de
//     la página de afuera quedan: son el diagnóstico de esa página) con su estado, y cada uno se ubica en
//     la sección de la copia que tiene su cita (`ubicarCitaEnBloques`, como al analizar una nuestra).
//   · `leerComentario`: uno solo, para el `preparar` de la API.
//
// ⚠️ ESCRIBE `landing_sugerencias` CON LA MISMA FORMA que `guardarHallazgos` de ./diagnostico-server.ts
//    (columnas, `clave` de `claveSugerencia`, upsert sobre `workspace_id,clave`). Ese módulo no exporta su
//    escritura y lo toca otro carril de la tanda 6: tests/editor-landing-diagnostico-aplicar.test.ts compara
//    las columnas de los dos inserts. Cuando se pueda, que éste use el de allá.
// ⚠️ LA PUERTA LA PONE QUIEN LLAMA (la ruta: admin + la tab; la API: su gating). Acá se vuelve a pedir el
//    workspace y cada consulta lleva su `.eq('workspace_id', …)` además del acote de getTenantDb.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { abrir, guardar, guardarVersion } from './server';
import { editar } from './ia';
import { listar, cambiarEstado } from './diagnostico-server';
import { docPagina, tarjetasDe, type JsonNodo } from './doc';
import { formatoDe } from './api-tipos';
import { bloquesDeLanding } from './diagnostico-guardado';
import {
  MOTIVO_ANTES_DE_APLICAR, claveSugerencia, estadoValido, idsParaAplicar, instruccionDeSugerencias,
  normalizarHallazgos, objetivoDe, ubicarCitaEnBloques,
  type EstadoSugerencia, type RespuestaAplicar, type RespuestaPasar, type Sugerencia,
} from './diagnostico';
// Puro (sin React ni DOM): cómo se aplica la propuesta de la IA, lo mismo que hace el editor.
import { anclasResueltas, idDe, planDeAplicacion } from '@/app/landing-generator/editor/diff-tarjetas';

export type FallaAplicar = { ok: false; error: string; status: number; conflicto?: boolean };

const falla = (error: string, status = 400, extra: { conflicto?: boolean } = {}): FallaAplicar => ({ ok: false, error, status, ...extra });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TABLA = 'landing_sugerencias';

async function wsOFalla(): Promise<number | FallaAplicar> {
  const ws = await getWorkspaceActual();
  return ws ?? falla('No hay un negocio abierto', 403);
}

const idValido = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Aplica los comentarios `ids` (pendientes, de UNA sección) a la landing `docId`. Ver la cabecera.
 * `versionAntes`: guardar antes la versión «Antes de aplicar el diagnóstico». `version`: si viene, la
 * landing tiene que seguir en esa versión (las vueltas de «Aplicar todos» encadenadas).
 */
export async function aplicarComentarios(p: { docId?: unknown; ids?: unknown; versionAntes?: unknown; version?: unknown }): Promise<RespuestaAplicar | FallaAplicar> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const docId = idValido(p.docId);
  if (!docId) return falla('Falta la landing');
  const ids = idsParaAplicar(p.ids);
  if (!ids) return falla('Faltan los comentarios');
  const esperada = p.version === undefined || p.version === null ? null : idValido(p.version);
  if (p.version !== undefined && p.version !== null && !esperada) return falla('La versión no vale');

  try {
    const lista = await listar({ docId });
    if (!lista.ok) return falla(lista.error, lista.status);
    const elegidas = ids.map((id) => lista.sugerencias.find((s) => s.id === id)).filter((s): s is Sugerencia => !!s);
    if (elegidas.length !== ids.length) return falla('Ese comentario no es de esta landing.', 404);
    if (elegidas.some((s) => s.estado !== 'pendiente')) return falla('Ese comentario ya no está pendiente.', 409);
    const seccionId = elegidas[0].seccionId;
    if (!seccionId) return falla('No sé en qué sección está ese comentario: usa «Preguntar a MaKo».', 422);
    if (elegidas.some((s) => s.seccionId !== seccionId)) return falla('Los comentarios son de secciones distintas.');

    const a = await abrir(docId);
    if (!a.ok) return falla(a.error, a.status);
    if (esperada && a.doc.version !== esperada) return falla('La landing cambió mientras tanto. Vuelve a intentarlo.', 409, { conflicto: true });
    const pag = a.doc.contenido.paginas.find((x) => tarjetasDe(x).some((t) => idDe(t) === seccionId));
    const todas = pag ? tarjetasDe(pag) : [];
    const original = todas.find((t) => idDe(t) === seccionId);
    if (!pag || !original) return falla('Esa sección ya no está.', 409);

    const r = await editar({
      instruccion: instruccionDeSugerencias(elegidas.map((s) => s.hallazgo)),
      tarjetas: [original],
      alcance: 'seccion',
      params: { formato: formatoDe(a.doc.config) },
    });
    if (!r.ok) return falla(r.error, r.status);
    if (!r.tarjetas.length) return falla('MaKo no propuso cambios.', 422);
    const propuestas: JsonNodo[] = anclasResueltas(r.tarjetas, [original], todas);
    const resultado = planDeAplicacion(todas, propuestas, { anclaNuevas: seccionId }).resultado;
    const contenido = { ...a.doc.contenido, paginas: a.doc.contenido.paginas.map((x) => (x.id === pag.id ? { ...x, doc: docPagina(resultado) } : x)) };

    // La versión de antes ANTES de tocar nada: si no se pudo dejar, no se aplica (sin ella no hay Deshacer).
    let versionAntes: RespuestaAplicar['versionAntes'] = null;
    if (p.versionAntes === true) {
      const v = await guardarVersion(docId, MOTIVO_ANTES_DE_APLICAR);
      if (!v.ok) return falla('No pude guardar la versión de antes. Vuelve a intentarlo.', 500);
      versionAntes = v.version;
    }
    const g = await guardar({ accion: 'guardar', id: docId, version: a.doc.version, contenido });
    if (!g.ok) return g.conflicto ? falla('La landing cambió mientras tanto. Vuelve a intentarlo.', 409, { conflicto: true }) : falla(g.error, g.status);

    // Los comentarios, resueltos. Si alguno no se pudo marcar, el cambio ya está guardado: se devuelve
    // como estaba (la pantalla lo muestra pendiente y se marca a mano).
    const aplicadas: Sugerencia[] = [];
    for (const s of elegidas) {
      const e = await cambiarEstado({ id: s.id, estado: 'resuelta' });
      aplicadas.push(e.ok ? e.sugerencia : s);
    }
    const otra = await abrir(docId);
    const doc = otra.ok ? otra.doc : { ...a.doc, contenido, version: g.version, actualizado: g.actualizado, cambiosSinPublicar: g.cambiosSinPublicar };
    const nuevas = resultado.filter((t) => propuestas.some((x) => idDe(x) === idDe(t)));
    return { ok: true, doc, aplicadas, original, nuevas, versionAntes, versionAbierta: a.doc.version };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * Los comentarios de una página de AFUERA (`url`) a su copia (`docId`): se copian con su estado y cada
 * uno se ubica en la sección de la copia que tiene su cita. Los repetidos (por su clave) no se duplican:
 * volver a pasarlos no hace nada. `mapa`: id de afuera → id en la copia.
 */
export async function pasarACopia(p: { url?: unknown; docId?: unknown }): Promise<RespuestaPasar | FallaAplicar> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const docId = idValido(p.docId);
  const de = objetivoDe({ url: p.url });
  if (!docId || !de || !('url' in de)) return falla('Falta la página o su copia');
  try {
    const [afuera, copia] = await Promise.all([listar(de), abrir(docId)]);
    if (!afuera.ok) return falla(afuera.error, afuera.status);
    if (!copia.ok) return falla(copia.error, copia.status);
    // Las secciones de TODAS las páginas de la copia (verificación de la tanda 6): una cita de la página de
    // gracias se ubica en la gracias de la copia, no queda «sin sección» (y sin «Aplicar»).
    const bloques = bloquesDeLanding(copia.doc.contenido);
    const destino = { docId };
    const filas = afuera.sugerencias.map((s) => ({
      workspace_id: ws,
      doc_id: docId,
      url: null,
      hallazgo: s.hallazgo,
      cita: s.cita,
      seccion_id: ubicarCitaEnBloques(s.cita, bloques),
      estado: s.estado as EstadoSugerencia,
      clave: claveSugerencia(destino, s.hallazgo),
    }));
    let pasadas = 0;
    if (filas.length) {
      const db = await getTenantDb();
      const { data, error } = await db.from(TABLA).upsert(filas, { onConflict: 'workspace_id,clave', ignoreDuplicates: true }).select('id');
      if (error) return falla(`No pude pasar los comentarios: ${error.message}`, 500);
      pasadas = Array.isArray(data) ? data.length : 0;
    }
    const lista = await listar(destino);
    if (!lista.ok) return falla(lista.error, lista.status);
    // El mapa por la clave (título y cita normalizados): es lo que hace a un comentario «el mismo».
    const porClave = new Map(lista.sugerencias.map((s) => [claveSugerencia(destino, s.hallazgo), s.id] as const));
    const mapa: Record<string, number> = {};
    for (const s of afuera.sugerencias) {
      const id = porClave.get(claveSugerencia(destino, s.hallazgo));
      if (id) mapa[String(s.id)] = id;
    }
    return { ok: true, sugerencias: lista.sugerencias, mapa, pasadas };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/** Un comentario con su landing (para el `preparar` de la API): `docId` de una nuestra o `url` de afuera. */
export type ComentarioConLanding = Sugerencia & { docId: number | null; url: string | null };

/** Un comentario guardado del workspace, o null si no existe. Un error de base TIRA. */
export async function leerComentario(idRaw: unknown): Promise<ComentarioConLanding | null> {
  const ws = await getWorkspaceActual();
  const id = idValido(idRaw);
  if (!ws || !id) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA)
    .select('id, doc_id, url, hallazgo, cita, seccion_id, estado, created_at, updated_at')
    .eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { id: number; doc_id: number | null; url: string | null; hallazgo: unknown; cita: string | null; seccion_id: string | null; estado: string; created_at: string; updated_at: string } | null;
  if (!f) return null;
  const [h] = normalizarHallazgos([f.hallazgo]);
  if (!h) return null;
  return {
    id: Number(f.id),
    hallazgo: h,
    cita: (f.cita ?? '') || h.cita,
    seccionId: f.seccion_id ?? null,
    estado: estadoValido(f.estado) ? f.estado : 'pendiente',
    creado: f.created_at,
    actualizado: f.updated_at,
    docId: f.doc_id == null ? null : Number(f.doc_id),
    url: f.url ?? null,
  };
}
