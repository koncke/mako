// =============================================================================
// editor-video/propuestas-server — las propuestas de la API en un proyecto del Video Editor (`video_editor_propuestas`)
// =============================================================================
// Las reglas viven en ./propuestas.ts (puro, con test); acá sólo la base. Lo usan las acciones del editor en la API
// (lib/api-mako/areas/video.run.ts, que proponen) y /api/video-editor/propuestas (el editor las lee y las resuelve).
//   · Proponer lee la COPIA del proyecto (0299) para revisar las refs, y suma la operación a la propuesta abierta del
//     mismo canal con compare-and-set (dos acciones que llegan juntas no se pisan; se reintenta una vez).
//   · SIN TABLA (la migración no se aplicó): `sinTabla`, y quien llama lo dice. Sólo la TABLA que falta se tolera.
// =============================================================================

import 'server-only';
import { getTenantDb } from '../workspace';
import { validarOperaciones, type OperacionChat } from './chat-catalogo';
import { unirRefs } from './espejo';
import { leerEspejo } from './espejo-server';
import { VENTANA_JUNTAR_MS, leerVista, lineaDeOperacion, revisarContraCopia } from './propuestas';

const TABLA = 'video_editor_propuestas';
const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => e?.code === 'PGRST205' || e?.code === '42P01';

export type Falla = { ok: false; error: string; sinTabla?: true };
const falla = (e: { code?: string | null; message: string }): Falla =>
  faltaLaTabla(e) ? { ok: false, error: 'sin tabla', sinTabla: true } : { ok: false, error: e.message };

type Fila = {
  id: string; proyecto_id: string; canal: string; escena_id: string; refs: unknown; operaciones: unknown; lineas: unknown;
  version: number; created_at: string;
};
const COLUMNAS = 'id, proyecto_id, canal, escena_id, refs, operaciones, lineas, version, created_at';

/** Una propuesta como la lee el editor. */
export type PropuestaAbierta = {
  id: string; canal: string; escenaId: string; refs: Array<[string, string]>; operaciones: OperacionChat[]; lineas: string[]; creada: string;
};
const aAbierta = (f: Fila): PropuestaAbierta => ({
  id: f.id,
  canal: f.canal,
  escenaId: f.escena_id,
  refs: unirRefs(f.refs, []),
  operaciones: validarOperaciones(f.operaciones).operaciones,
  lineas: Array.isArray(f.lineas) ? f.lineas.filter((l): l is string => typeof l === 'string') : [],
  creada: f.created_at,
});

export type Propuesto = { ok: true; id: string; nueva: boolean; lineas: string[]; sinRevisar?: true } | Falla | { ok: false; motivo: string };

/**
 * Suma una operación (ya validada en su forma) a la propuesta abierta del proyecto en este canal, o abre una. La
 * revisa antes contra la copia del proyecto: lo que no está en la línea de tiempo se rechaza con su motivo.
 */
export async function proponerOperacion(p: {
  ws: number; canal: 'whatsapp' | 'app' | 'http'; canalKey: string; actor: string | null; proyecto: string; titulo: string; op: OperacionChat;
}): Promise<Propuesto> {
  const copia = await leerEspejo(p.ws, p.proyecto);
  if (!copia.ok) return copia;
  if (!copia.fila) return { ok: false, motivo: `no hay un proyecto «${p.proyecto}» (los de listar_proyectos_video): se abre una vez en el editor y aparece` };
  const vista = copia.fila.demasiado_grande || !copia.fila.vista ? null : leerVista(copia.fila.vista);
  const db = await getTenantDb();

  for (let intento = 0; intento < 2; intento++) {
    const desde = new Date(Date.now() - VENTANA_JUNTAR_MS).toISOString();
    const { data, error } = await db.from(TABLA).select(COLUMNAS)
      .eq('workspace_id', p.ws).eq('proyecto_id', p.proyecto).eq('canal_key', p.canalKey).eq('estado', 'abierta')
      .gte('created_at', desde).order('created_at', { ascending: false }).limit(1);
    if (error) return falla(error);
    const abierta = ((data ?? [])[0] as Fila | undefined) ?? null;
    const previas = abierta ? validarOperaciones(abierta.operaciones).operaciones : [];
    // Una plantilla va sola: con una propuesta abierta de otra cosa, va en una propuesta nueva sólo si la abierta
    // está vacía; la regla de `revisarContraCopia` lo dice con su motivo.
    const r = revisarContraCopia({ op: p.op, vista, previas });
    if (!r.ok) return r;
    const linea = lineaDeOperacion(p.titulo, p.op, vista);
    const ahora = new Date().toISOString();

    if (!abierta) {
      const { data: alta, error: e2 } = await db.from(TABLA).insert({
        proyecto_id: p.proyecto, canal: p.canal, canal_key: p.canalKey, escena_id: copia.fila.escena_id,
        refs: unirRefs(copia.fila.refs, []), operaciones: [p.op], lineas: [linea], propuesto_por: p.actor, updated_at: ahora,
      }).select('id').single();
      if (e2) return falla(e2);
      return { ok: true, id: (alta as { id: string }).id, nueva: true, lineas: [linea], ...(vista ? {} : { sinRevisar: true as const }) };
    }

    const lineas = [...(Array.isArray(abierta.lineas) ? (abierta.lineas as string[]) : []), linea];
    const { data: cambio, error: e3 } = await db.from(TABLA).update({
      operaciones: [...previas, p.op], lineas, refs: unirRefs(abierta.refs, copia.fila.refs), version: abierta.version + 1, updated_at: ahora,
    }).eq('workspace_id', p.ws).eq('id', abierta.id).eq('estado', 'abierta').eq('version', abierta.version).select('id');
    if (e3) return falla(e3);
    if ((cambio ?? []).length) return { ok: true, id: abierta.id, nueva: false, lineas, ...(vista ? {} : { sinRevisar: true as const }) };
    // Otra acción la cambió en el medio (o se resolvió): se vuelve a leer, una vez.
  }
  return { ok: false, motivo: 'la propuesta cambió mientras se sumaba este cambio: vuelve a pedirlo' };
}

/** Las propuestas abiertas de un proyecto, de la más vieja a la más nueva (el editor las muestra en su chat). */
export async function propuestasAbiertas(ws: number, proyecto: string): Promise<{ ok: true; propuestas: PropuestaAbierta[] } | Falla> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLUMNAS)
    .eq('workspace_id', ws).eq('proyecto_id', proyecto).eq('estado', 'abierta').order('created_at', { ascending: true }).limit(20);
  if (error) return falla(error);
  return { ok: true, propuestas: ((data ?? []) as Fila[]).map(aAbierta) };
}

/** La cierra quien la miró en el editor: aplicada o descartada. Sólo una abierta (un segundo clic no la reescribe). */
export async function resolverPropuesta(p: {
  ws: number; id: string; estado: 'aplicada' | 'descartada'; persona: string; descartes: string[];
}): Promise<{ ok: true } | Falla | { ok: false; yaResuelta: true }> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).update({
    estado: p.estado, resuelto_por: p.persona, resuelto_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    descartes: p.descartes.slice(0, 40).map((d) => d.slice(0, 300)),
  }).eq('workspace_id', p.ws).eq('id', p.id).eq('estado', 'abierta').select('id');
  if (error) return falla(error);
  return (data ?? []).length ? { ok: true } : { ok: false, yaResuelta: true };
}
