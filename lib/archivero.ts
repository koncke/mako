// =============================================================================
// archivero — los documentos del negocio, con procedencia
// =============================================================================
// El brief del negocio (mako.onboarding.answers) se DERIVA de dos fuentes:
//   1. Los archivos que subió el cliente (archivero_files.campos, por archivo).
//   2. Las respuestas manuales (huecos que ningún doc resolvió + ediciones del
//      super-admin), en app_settings 'mako.archivero.manual'.
// El efectivo = merge(archivos en orden, manual encima). Manual siempre gana.
// Por eso borrar un archivo recalcula todo y "se lleva" lo que ese archivo aportó
// (salvo lo que además esté en manual). Guardamos el efectivo en answers para que
// el contexto de MaKo (perfilNegocioTexto) lo lea igual que siempre.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, getRolWsEfectivo, getWorkspaceActual, OWNER_WS } from './workspace';
import { getSchema, getAnswers, saveAnswers } from './onboarding';
import { getSesionAdmin } from './auth';
import { getSetting, setSetting } from './settings';

/**
 * Workspace efectivo para operar el archivero, o null (403). Admin del workspace
 * (cliente) → su ws. El super-admin de la agencia SIN impersonar cae a ws null:
 * en ese caso es "el dueño mirando lo suyo" → OWNER_WS (mismo criterio que el
 * board /plan). Los routes envuelven el trabajo en runWithWorkspace(ws) para que
 * getTenantDb, settings y el path de storage queden todos scopeados a ese ws.
 */
export async function resolverWsAdmin(): Promise<number | null> {
  if ((await getRolWsEfectivo()) !== 'admin') return null;
  const ws = await getWorkspaceActual();
  if (ws != null) return ws;
  return (await getSesionAdmin()) ? OWNER_WS : null;
}

const BUCKET = 'archivero';
const MANUAL_KEY = 'mako.archivero.manual';

export type ArchiveroFile = {
  id: string; nombre: string; mime: string | null; tamano: number | null;
  storage_path: string; razonamiento: string | null;
  campos: Record<string, string>; created_at: string;
};

export type FuenteCampo = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };

// ── Manual (huecos + ediciones del super-admin) ──────────────────────────────
export async function getManual(): Promise<Record<string, string>> {
  const raw = await getSetting(MANUAL_KEY);
  if (raw != null) { try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; } }
  // Primera vez: lo que el dueño ya tenía cargado a mano pasa a ser el manual base,
  // para no perderlo cuando el efectivo se empiece a derivar de los archivos.
  const prev = await getAnswers();
  await setManual(prev);
  return prev;
}
export async function setManual(m: Record<string, string>): Promise<void> {
  await setSetting(MANUAL_KEY, JSON.stringify(m));
}

// El Archivero solo se ocupa del brief que alimenta los ÁNGULOS: a qué te dedicás,
// la OFERTA y el AVATAR. El objetivo/freno (diagnóstico del Norte) y el Personaje de
// Marca se piden en otra parte del onboarding — no salen de docs de avatar/oferta.
export function esCampoArchivero(key: string): boolean {
  return key === 'negocio_que_hace' || key.startsWith('oferta_') || key.startsWith('avatar_');
}

// ── Campos del schema, aplanados (para extraer y para detectar huecos) ───────
export async function flatFields(): Promise<Array<{ key: string; label: string; type: string; placeholder?: string; grupo: string }>> {
  const schema = await getSchema();
  return schema.flatMap((g) => g.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, placeholder: f.placeholder, grupo: g.label }))).filter((f) => esCampoArchivero(f.key));
}

// ── Archivos (tabla, scopeada por workspace) ─────────────────────────────────
export async function listFiles(): Promise<ArchiveroFile[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('archivero_files')
    .select('id,nombre,mime,tamano,storage_path,razonamiento,campos,created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, campos: (r.campos ?? {}) as Record<string, string> })) as ArchiveroFile[];
}

export async function getFile(id: string): Promise<ArchiveroFile | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('archivero_files')
    .select('id,nombre,mime,tamano,storage_path,razonamiento,campos,created_at')
    .eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? ({ ...data, campos: (data.campos ?? {}) as Record<string, string> } as ArchiveroFile) : null;
}

export async function insertFile(ws: number, f: { id: string; nombre: string; mime: string; tamano: number; storage_path: string; razonamiento: string; campos: Record<string, string> }): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('archivero_files').insert({
    id: f.id, workspace_id: ws, nombre: f.nombre, mime: f.mime, tamano: f.tamano,
    storage_path: f.storage_path, razonamiento: f.razonamiento, campos: f.campos,
  });
  if (error) throw new Error(error.message);
}

export async function deleteFileRow(id: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('archivero_files').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Binarios en Storage (bucket privado; scoping manual por path) ────────────
export async function subirBinario(ws: number, fileId: string, buf: Buffer, mime: string): Promise<string> {
  const path = `${ws}/${fileId}`;
  const { error } = await getSupabaseServer().storage.from(BUCKET).upload(path, buf, { contentType: mime || 'application/octet-stream', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}
export async function borrarBinario(path: string): Promise<void> {
  await getSupabaseServer().storage.from(BUCKET).remove([path]).catch(() => {});
}
export async function urlDescarga(path: string, nombre: string): Promise<string | null> {
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(path, 120, { download: nombre });
  return data?.signedUrl ?? null;
}

// ── Brief efectivo (merge archivos + manual) ─────────────────────────────────
export function computeEffective(files: ArchiveroFile[], manual: Record<string, string>): { answers: Record<string, string>; fuente: Record<string, FuenteCampo> } {
  const answers: Record<string, string> = {};
  const fuente: Record<string, FuenteCampo> = {};
  for (const f of files) {
    for (const [k, v] of Object.entries(f.campos || {})) {
      if (v != null && String(v).trim()) { answers[k] = String(v); fuente[k] = { tipo: 'archivo', id: f.id, nombre: f.nombre }; }
    }
  }
  for (const [k, v] of Object.entries(manual || {})) {
    if (v != null && String(v).trim()) { answers[k] = String(v); fuente[k] = { tipo: 'manual' }; }
  }
  return { answers, fuente };
}

/** Vista pública de un archivo (sin la ruta interna de storage). */
export function pubFile(f: ArchiveroFile) {
  return { id: f.id, nombre: f.nombre, mime: f.mime, tamano: f.tamano, razonamiento: f.razonamiento, aporto: Object.keys(f.campos || {}).length, created_at: f.created_at };
}

export type ArchiveroEstado = {
  files: ReturnType<typeof pubFile>[];
  brief: Array<{ key: string; label: string; type: string; placeholder?: string; grupo: string }>;
  answers: Record<string, string>;
  fuente: Record<string, FuenteCampo>;
  gaps: string[];
  esSuperAdmin: boolean;
};

/** Estado completo para la UI. `persist` guarda el brief efectivo en answers. */
export async function buildEstado(persist: boolean): Promise<ArchiveroEstado> {
  const [files, schema, manual] = await Promise.all([listFiles(), getSchema(), getManual()]);
  const { answers, fuente } = computeEffective(files, manual);
  if (persist) await saveAnswers(answers);
  const brief = schema.flatMap((g) => g.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, placeholder: f.placeholder, grupo: g.label }))).filter((c) => esCampoArchivero(c.key));
  const gaps = brief.filter((c) => !(answers[c.key] ?? '').trim()).map((c) => c.key);
  return { files: files.map(pubFile), brief, answers, fuente, gaps, esSuperAdmin: Boolean(await getSesionAdmin()) };
}
