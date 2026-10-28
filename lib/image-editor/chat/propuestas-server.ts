// =============================================================================
// image-editor/chat/propuestas-server — las propuestas de la API en un diseño del Image Editor (`image_editor_propuestas`)
// =============================================================================
// El espejo de lib/editor-video/propuestas-server.ts (27/10/2026). Las reglas viven en ./propuestas.ts (puro, con
// test); acá sólo la base. Lo usan las acciones del editor en la API (lib/api-mako/areas/imagen.run.ts, que proponen) y
// /api/image-editor/propuestas (el editor las lee y las cierra).
//   · Proponer lee el DISEÑO GUARDADO (image_disenos) para probar la propuesta entera sobre una copia, y suma la operación
//     a la propuesta abierta del mismo canal con compare-and-set (dos acciones que llegan juntas no se pisan; se
//     reintenta una vez).
//   · SIN TABLA (la migración no se aplicó): `sinTabla`, y quien llama lo dice. Sólo la TABLA que falta se tolera.
// =============================================================================

import 'server-only';
import { getTenantDb } from '../../workspace';
import { leerDiseno } from '../server';
import { validarOperacionesDePropuesta, type OperacionImagen } from './catalogo';
import {
  VENTANA_JUNTAR_MS, lineaDeOperacionImagen, refsUsadas, restarOperaciones, revisarContraDiseno, vistaGuardada, type FilaImagen,
} from './propuestas';

const TABLA = 'image_editor_propuestas';
const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => e?.code === 'PGRST205' || e?.code === '42P01';

export type FallaImagen = { ok: false; error: string; sinTabla?: true };
const falla = (e: { code?: string | null; message: string }): FallaImagen =>
  faltaLaTabla(e) ? { ok: false, error: 'sin tabla', sinTabla: true } : { ok: false, error: e.message };

/** Las de una propuesta guardada: las del catálogo, con sus imágenes con IA SIN generar (se crean al aceptar). */
const operacionesDe = (x: unknown): OperacionImagen[] => validarOperacionesDePropuesta(x, { iaPendiente: true }).operaciones;

type Fila = {
  id: string; diseno_id: string; canal: string; pagina_id: string | null; refs: unknown; paginas: unknown; operaciones: unknown; lineas: unknown;
  version: number; created_at: string;
};
const COLUMNAS = 'id, diseno_id, canal, pagina_id, refs, paginas, operaciones, lineas, version, created_at';

/** Pares [ref, id] guardados, saneados. */
const pares = (x: unknown): Array<[string, string]> =>
  (Array.isArray(x) ? x : []).flatMap((p) => (Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string' ? [[p[0], p[1]] as [string, string]] : []));
/** Une dos listas de pares (gana lo último). */
const unir = (a: unknown, b: ReadonlyArray<[string, string]>): Array<[string, string]> => [...new Map([...pares(a), ...b])];

/** Una propuesta como la lee el editor. */
export type PropuestaImagenAbierta = {
  id: string; canal: string; paginaId: string | null; refs: Array<[string, string]>; paginas: Array<[string, string]>;
  operaciones: OperacionImagen[]; lineas: string[]; creada: string; version: number;
};
const aAbierta = (f: Fila): PropuestaImagenAbierta => ({
  id: f.id,
  canal: f.canal,
  paginaId: f.pagina_id,
  refs: pares(f.refs),
  paginas: pares(f.paginas),
  operaciones: operacionesDe(f.operaciones),
  lineas: Array.isArray(f.lineas) ? f.lineas.filter((l): l is string => typeof l === 'string') : [],
  creada: f.created_at,
  version: Number(f.version) || 0,
});

/** `filas`: la propuesta ENTERA como «Original | Modificado» contra el diseño guardado; `titulo`, el del diseño. */
export type PropuestoImagen =
  | { ok: true; id: string; nueva: boolean; lineas: string[]; filas: FilaImagen[]; total: number; titulo: string }
  | FallaImagen | { ok: false; motivo: string };

/**
 * Suma una operación (ya validada en su forma) a la propuesta abierta del diseño en este canal, o abre una. La prueba
 * antes contra el diseño guardado: lo que no cambia nada se rechaza con su motivo.
 */
export async function proponerOperacionImagen(p: {
  ws: number; canal: 'whatsapp' | 'app' | 'http'; canalKey: string; actor: string | null; disenoId: string; titulo: string; op: OperacionImagen;
}): Promise<PropuestoImagen> {
  const d = await leerDiseno(p.ws, p.disenoId);
  if (!d.ok) return d.status === 404 ? { ok: false, motivo: `no hay un diseño con id «${p.disenoId}» (los de listar_disenos_imagen)` } : { ok: false, error: d.error };
  const doc = d.diseno.doc;
  const v = vistaGuardada(doc);
  const db = await getTenantDb();

  for (let intento = 0; intento < 2; intento++) {
    const desde = new Date(Date.now() - VENTANA_JUNTAR_MS).toISOString();
    const { data, error } = await db.from(TABLA).select(COLUMNAS)
      .eq('workspace_id', p.ws).eq('diseno_id', p.disenoId).eq('canal_key', p.canalKey).eq('estado', 'abierta')
      .gte('created_at', desde).order('created_at', { ascending: false }).limit(1);
    if (error) return falla(error);
    const abierta = ((data ?? [])[0] as Fila | undefined) ?? null;
    const previas = abierta ? operacionesDe(abierta.operaciones) : [];
    const r = revisarContraDiseno({ op: p.op, doc, previas });
    if (!r.ok) return r;
    const linea = lineaDeOperacionImagen(p.titulo, p.op, v);
    const usadas = refsUsadas([p.op], v);
    const ahora = new Date().toISOString();

    if (!abierta) {
      const { data: alta, error: e2 } = await db.from(TABLA).insert({
        diseno_id: p.disenoId, canal: p.canal, canal_key: p.canalKey, pagina_id: v.paginaId,
        refs: usadas.refs, paginas: usadas.paginas, operaciones: [p.op], lineas: [linea], propuesto_por: p.actor, updated_at: ahora,
      }).select('id').single();
      if (e2) return falla(e2);
      return { ok: true, id: (alta as { id: string }).id, nueva: true, lineas: [linea], filas: r.filas, total: 1, titulo: d.diseno.titulo };
    }

    const lineas = [...(Array.isArray(abierta.lineas) ? (abierta.lineas as string[]) : []), linea];
    const { data: cambio, error: e3 } = await db.from(TABLA).update({
      operaciones: [...previas, p.op], lineas, refs: unir(abierta.refs, usadas.refs), paginas: unir(abierta.paginas, usadas.paginas),
      version: abierta.version + 1, updated_at: ahora,
    }).eq('workspace_id', p.ws).eq('id', abierta.id).eq('estado', 'abierta').eq('version', abierta.version).select('id');
    if (e3) return falla(e3);
    if ((cambio ?? []).length) {
      return { ok: true, id: abierta.id, nueva: false, lineas, filas: r.filas, total: previas.length + 1, titulo: d.diseno.titulo };
    }
    // Otra acción la cambió en el medio (o se resolvió): se vuelve a leer, una vez.
  }
  return { ok: false, motivo: 'la propuesta cambió mientras se sumaba este cambio: vuelve a pedirlo' };
}

/** Cuántas abiertas trae el editor de un diseño, y cuántas pide por id como mucho. */
const TOPE_ABIERTAS = 20;
export const TOPE_INCLUIR_IMAGEN = 40;

/** Las propuestas abiertas de un diseño, de la más vieja a la más nueva; las que el editor pide por id, siempre. */
export async function propuestasAbiertasImagen(ws: number, disenoId: string, incluir: readonly string[] = []): Promise<{ ok: true; propuestas: PropuestaImagenAbierta[] } | FallaImagen> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLUMNAS)
    .eq('workspace_id', ws).eq('diseno_id', disenoId).eq('estado', 'abierta').order('created_at', { ascending: false }).limit(TOPE_ABIERTAS);
  if (error) return falla(error);
  const filas = ((data ?? []) as Fila[]).reverse();
  const faltan = [...new Set(incluir)].filter((id) => !filas.some((f) => f.id === id)).slice(0, TOPE_INCLUIR_IMAGEN);
  if (faltan.length) {
    const { data: mas, error: e2 } = await db.from(TABLA).select(COLUMNAS)
      .eq('workspace_id', ws).eq('diseno_id', disenoId).eq('estado', 'abierta').in('id', faltan);
    if (e2) return falla(e2);
    filas.unshift(...((mas ?? []) as Fila[]));
  }
  return { ok: true, propuestas: filas.map(aAbierta) };
}

/** Una operación guardada como la ve el editor (validada), para compararla por contenido. */
const comoLaVe = (op: unknown): unknown => operacionesDe([op])[0] ?? op;

/**
 * Cierra en la base lo que se aceptó o se descartó en el editor: EXACTAMENTE las operaciones que el editor tenía en ese
 * mensaje (`vistas`), por contenido (como el video: lib/editor-video/propuestas-server.ts → resolverPropuesta). Si no
 * queda ninguna, la propuesta se cierra; si quedan (llegaron después), sigue abierta con el mismo id.
 *
 * ⚠️ Una imagen con IA que se aceptó llega al cierre YA GENERADA (agregar_imagen / reemplazar_imagen, con su URL de
 * «Subidos»): no es igual a la crear_imagen guardada. El editor manda las operaciones COMO LAS MOSTRÓ (con la crear_imagen),
 * no como las aplicó.
 */
export async function resolverPropuestaImagen(p: {
  ws: number; id: string; estado: 'aplicada' | 'descartada'; persona: string; descartes: string[]; vistas?: readonly OperacionImagen[];
}): Promise<{ ok: true; quedan: number } | FallaImagen | { ok: false; yaResuelta: true } | { ok: false; cambio: true }> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  for (let intento = 0; intento < 2; intento++) {
    const { data: leida, error: e1 } = await db.from(TABLA).select('id, operaciones, lineas, version')
      .eq('workspace_id', p.ws).eq('id', p.id).eq('estado', 'abierta').limit(1);
    if (e1) return falla(e1);
    const fila = ((leida ?? [])[0] as { operaciones: unknown; lineas: unknown; version: number } | undefined) ?? null;
    if (!fila) return { ok: false, yaResuelta: true };
    const ops = Array.isArray(fila.operaciones) ? fila.operaciones : [];
    const lineas = Array.isArray(fila.lineas) ? fila.lineas : [];
    // Lo que ya no valida (una versión vieja del catálogo) ningún editor lo puede mostrar ni aceptar: se saca al cerrar.
    const valida = ops.map((op) => operacionesDe([op]).length > 0);
    const quedan = p.vistas ? restarOperaciones(ops.map(comoLaVe), p.vistas).filter((i) => valida[i]) : [];
    if (p.vistas && quedan.length === ops.length) return { ok: true, quedan: ops.length };
    const cambio = quedan.length === 0
      ? { estado: p.estado, resuelto_por: p.persona, resuelto_at: ahora, updated_at: ahora, descartes: p.descartes.slice(0, 40).map((d) => d.slice(0, 300)) }
      : {
        operaciones: quedan.map((i) => ops[i]),
        lineas: lineas.length === ops.length ? quedan.map((i) => lineas[i]) : lineas,
        version: (Number(fila.version) || 0) + 1, updated_at: ahora,
      };
    const { data, error } = await db.from(TABLA).update(cambio)
      .eq('workspace_id', p.ws).eq('id', p.id).eq('estado', 'abierta').eq('version', fila.version).select('id');
    if (error) return falla(error);
    if ((data ?? []).length) return { ok: true, quedan: quedan.length };
  }
  return { ok: false, cambio: true };
}
