// =============================================================================
// archivero — los documentos del negocio, con procedencia
// =============================================================================
// El brief del negocio (mako.onboarding.answers) se DERIVA de dos fuentes:
//   1. Los archivos que subió el cliente (archivero_files.campos, por archivo) = BASE.
//   2. Las ediciones/respuestas EXPLÍCITAS del usuario, en 'mako.archivero.manual'.
// El efectivo = merge(archivos, ediciones manuales encima). Los DOCS son la base y la
// llenan casi toda; una edición manual explícita GANA sobre el doc (corrección
// intencional). NO hay auto-seed: el auto-seed viejo (copiar answers previas a manual)
// era lo que bloqueaba que un doc actualizara el perfil (bug de Martín). Borrar un
// archivo recalcula y "se lleva" lo que aportó (queda lo editado a mano). Guardamos el
// efectivo en answers para que el contexto de MaKo (perfilNegocioTexto) lo lea igual.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, getRolWsEfectivo, getWorkspaceActual, OWNER_WS } from './workspace';
import { getSchema, saveAnswers, extraerDeArchivo, ANSWERS_KEY } from './onboarding';
import { getSesionAdmin } from './auth';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import {
  computeEffective, idDeContenido, pathEnArchivero, origenDelWs, documentoYaArchivado, answersConDocumento,
  destinoOcupado, binarioHuerfano, type FuenteCampo,
} from './archivero-registro';

// El recálculo del brief vive en lib/archivero-registro.ts (sin server-only) para que un test lo ejecute;
// quien lo importaba de acá lo sigue importando de acá.
export { computeEffective, type FuenteCampo };

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
const PANORAMA_KEY = 'mako.archivero.panorama';

// ── Panorama libre (lo que la IA entendió, más allá de los campos fijos) ──────
export async function getPanorama(): Promise<string> {
  return (await getSetting(PANORAMA_KEY)) ?? '';
}
export async function setPanorama(texto: string): Promise<void> {
  await setSetting(PANORAMA_KEY, texto);
}

export type ArchiveroFile = {
  id: string; nombre: string; mime: string | null; tamano: number | null;
  storage_path: string; razonamiento: string | null;
  campos: Record<string, string>; created_at: string;
};

// ── Manual (huecos + ediciones EXPLÍCITAS del usuario) ───────────────────────
// SIN auto-seed: `manual` guarda SOLO lo que el usuario respondió/editó a mano. El
// auto-seed viejo (copiar las answers previas a manual) era el que BLOQUEABA que un
// doc actualizara el perfil ("las respuestas a mano no cambian con nada" — reporte de
// Martín). Ahora los docs son la base y una edición manual explícita gana sobre ellos.
export async function getManual(): Promise<Record<string, string>> {
  const raw = await getSetting(MANUAL_KEY);
  if (raw == null) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
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
/** URL firmada INLINE (sin forzar descarga): para ver el PDF/imagen en un visor o miniatura. */
export async function urlPreview(path: string): Promise<string | null> {
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
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
  /** Panorama libre: lo que la IA entendió del negocio, más allá de los campos fijos. */
  panorama: string;
  esSuperAdmin: boolean;
};

/** Estado completo para la UI. `persist` guarda el brief efectivo en answers. */
export async function buildEstado(persist: boolean): Promise<ArchiveroEstado> {
  const [files, schema, manual, panorama] = await Promise.all([listFiles(), getSchema(), getManual(), getPanorama()]);
  const { answers, fuente } = computeEffective(files, manual);
  if (persist) await saveAnswers(answers);
  const brief = schema.flatMap((g) => g.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, placeholder: f.placeholder, grupo: g.label }))).filter((c) => esCampoArchivero(c.key));
  const gaps = brief.filter((c) => !(answers[c.key] ?? '').trim()).map((c) => c.key);
  return { files: files.map(pubFile), brief, answers, fuente, gaps, panorama, esSuperAdmin: Boolean(await getSesionAdmin()) };
}

// ── Un documento que llega por OTRA puerta (el chat de Offer) ────────────────
// Decisión de Martín (Ticketera, 15/10/2026 05:32, ref `offer-archivero`): «¿El Archivero del chat
// guarda el archivo y paga una extracción por documento? → A · Sí». Lo que decide (el id de contenido,
// qué claves toca, cuándo un binario es huérfano) está en lib/archivero-registro.ts, con su test.

/** Los campos del brief que lee la extracción, con el rótulo que usan la pantalla y su ruta. */
export async function camposParaExtraer(): Promise<Array<{ key: string; label: string }>> {
  return (await flatFields()).map((f) => ({ key: f.key, label: `${f.grupo} — ${f.label}` }));
}

/**
 * Un setting que es un mapa, leído para ESCRIBIR encima: tira si la base no contesta o si no es un mapa
 * (getAnswers/getManual devuelven {} en los dos casos, y sobre eso saveAnswers borraría el brief). Mismo
 * criterio que `mapaEstricto` de lib/api-mako/areas/negocio.helpers.ts.
 */
/** Un mapa JSON de app_settings leído ESTRICTO, para escribir encima (la lectura caída tira, nunca devuelve {}). Lo usa también el chat de arranque. */
export async function mapaParaEscribir(key: string): Promise<Record<string, string>> {
  const raw = await getSettingEstricto(key);
  if (!raw) return {};
  let v: unknown;
  try { v = JSON.parse(raw); } catch { throw new Error(`El setting ${key} no es JSON legible: no se escribe encima.`); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`El setting ${key} no es un mapa: no se escribe encima.`);
  return v as Record<string, string>;
}

export type RegistroArchivero =
  /** `nuevo: false` = ya estaba (mismo contenido, o mismo nombre y tamaño) o lo está guardando otro envío: acá no se pagó nada. */
  | { ok: true; id: string; nuevo: boolean; aportadas: number; aviso?: string }
  | { ok: false; motivo: string };

type Lugar = 'movido' | 'en-curso' | { error: string };

/**
 * El binario pasa de `origen` a su lugar en El Archivero. MOVER es atómico y no pisa: si dos envíos del
 * mismo archivo llegan juntos, uno solo lo consigue (y uno solo paga la extracción). El que pierde puede
 * enterarse por «el destino ya existe» o, si los dos traían el MISMO origen (un 'leer' repetido), por «el
 * origen ya no está»: en los dos casos el destino existe, y eso es lo que se mira. Un destino ocupado más
 * viejo que lo que dura un registro es basura de uno que se cortó, y se reemplaza.
 */
async function reclamarLugar(origen: string, destino: string): Promise<Lugar> {
  const storage = getSupabaseServer().storage.from(BUCKET);
  const r = await storage.move(origen, destino);
  if (!r.error) return 'movido';
  const { data: info } = await storage.info(destino).catch(() => ({ data: null }));
  if (!info && !destinoOcupado(r.error)) return { error: r.error.message };
  if (!binarioHuerfano(info, Date.now())) return 'en-curso';
  await borrarBinario(destino);
  const r2 = await storage.move(origen, destino);
  return r2.error ? { error: r2.error.message } : 'movido';
}

/**
 * Registra en El Archivero un documento que ya se LEYÓ en otra pantalla (hoy, el chat de Offer): el
 * binario se conserva en `<ws>/<id>` —el lugar y el formato de los que sube el Archivero— y se guarda su
 * fila con la MISMA extracción de campos que hace su pantalla (`extraerDeArchivo`, una por documento: es
 * el gasto que aprobó Martín). `texto` es lo que ya se leyó: no se vuelve a leer el archivo.
 *
 * ⚠️ SE HACE CARGO DEL BINARIO `origen`: al volver, o quedó en El Archivero con su fila, o se borró. Nunca
 *    queda suelto, tampoco si algo tira (la extracción, el Storage, la base).
 * ⚠️ NO RECALCULA EL BRIEF NI LO PISA. `buildEstado(true)` reescribe las answers con el efectivo de los
 *    archivos y lo manual, y se lleva lo que el wizard guardó por la otra puerta (negocio_objetivo,
 *    negocio_freno, marca_*). Acá se suman SÓLO las claves que trae este documento (`answersConDocumento`),
 *    leyendo estricto antes de escribir.
 * ⚠️ El panorama NO se regenera: sería una segunda llamada paga por documento, y lo aprobado es una.
 * NUNCA TIRA: todo fallo vuelve como `{ ok: false, motivo }`, en palabras para el dueño.
 *
 * Corre dentro de runWithWorkspace(ws): la tabla va por getTenantDb y el path se arma con `ws`.
 */
export async function registrarDocumentoSinPisar(ws: number, d: {
  origen: string; contenido: Uint8Array; nombre: string; mime: string; texto: string;
  /** Para el Saldo de IA: de dónde vino el documento. La feature es la del Archivero. */
  motivo: string;
  /** Plazo ABSOLUTO (epoch ms) de la extracción: la ruta tiene un maxDuration. */
  hastaMs?: number;
}): Promise<RegistroArchivero> {
  // Un path que no es de una pantalla de ESTE workspace no se toca: ni se mueve ni se borra.
  if (!origenDelWs(ws, d.origen)) return { ok: false, motivo: 'el archivo no es de esta cuenta' };
  const soltarOrigen = () => borrarBinario(d.origen);
  const id = idDeContenido(ws, d.contenido);
  const destino = pathEnArchivero(ws, id);
  const tamano = d.contenido.byteLength;
  const nombre = d.nombre.trim().slice(0, 200) || 'documento';
  try {
    // 1) ¿Ya está? Antes de pagar nada.
    const ya = documentoYaArchivado(await listFiles(), { id, nombre, tamano });
    if (ya) { await soltarOrigen(); return { ok: true, id: ya, nuevo: false, aportadas: 0 }; }
    if (!d.texto.trim()) { await soltarOrigen(); return { ok: false, motivo: 'no tiene texto para leer' }; }

    // 2) El lugar, ANTES de la extracción: el que no lo consigue no paga.
    const lugar = await reclamarLugar(d.origen, destino);
    if (lugar !== 'movido') {
      await soltarOrigen();
      // Lo está guardando otro envío del mismo archivo (o ya lo guardó): ese paga, y si falla, su chip lo dice.
      if (lugar === 'en-curso') return { ok: true, id, nuevo: false, aportadas: 0 };
      console.error(`[archivero:registrar] no pude mover ${d.origen} a ${destino}: ${lugar.error}`);
      return { ok: false, motivo: 'falló el almacenamiento de MaKo' };
    }

    // 3) Desde acá el binario está en `destino`: si no llega a tener su fila, se borra.
    let conFila = false;
    try {
      const ex = await extraerDeArchivo(d.texto, await camposParaExtraer(), 24000, { motivo: d.motivo, hastaMs: d.hastaMs });
      if (ex.sinIA) return { ok: false, motivo: ex.motivoSinIA ? `la IA no pudo leerlo (${ex.motivoSinIA})` : 'la IA no pudo leerlo ahora' };
      // Estrictas ANTES de insertar: si la base no contesta, no queda una fila que el brief no conoce.
      const [manual, previas] = await Promise.all([mapaParaEscribir(MANUAL_KEY), mapaParaEscribir(ANSWERS_KEY)]);
      await insertFile(ws, { id, nombre, mime: d.mime, tamano, storage_path: destino, razonamiento: ex.razonamiento, campos: ex.campos });
      conFila = true;
      const { siguiente, aportadas } = answersConDocumento(previas, manual, ex.campos);
      if (aportadas.length) {
        try { await saveAnswers(siguiente); } catch (e) {
          console.error(`[archivero:registrar] «${nombre}» quedó guardado pero no pude sumar sus campos al perfil:`, e instanceof Error ? e.message : e);
          return { ok: true, id, nuevo: true, aportadas: 0, aviso: 'quedó en El Archivero, pero no pude sumarlo a tu perfil' };
        }
      }
      return { ok: true, id, nuevo: true, aportadas: aportadas.length };
    } finally {
      if (!conFila) await borrarBinario(destino);
    }
  } catch (e) {
    // Si el binario ya se movió, borrar el origen no hace nada; el destino lo limpió el finally de arriba.
    await soltarOrigen();
    console.error(`[archivero:registrar] «${nombre}»:`, e instanceof Error ? e.message : e);
    return { ok: false, motivo: 'algo falló de nuestro lado al guardarlo' };
  }
}
