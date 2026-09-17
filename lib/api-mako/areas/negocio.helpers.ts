// =============================================================================
// api-mako/areas/negocio.helpers — lógica del área `negocio` que vivía inline en
// app/api/onboarding/** y app/api/second-brain/** (deuda: debería estar en lib/)
// =============================================================================
// Todo corre ADENTRO de runWithWorkspace(ctx.ws) (lo pone el choke point): las libs
// de settings y getTenantDb scopean solas. Las funciones que ESCRIBEN solo se llaman
// desde ejecutar(); las que leen, desde leer() y preparar().
//
// ⚠️ UN JSON POR CLAVE. Avatares, lead magnets, persona y personalidad viven cada uno
// en UNA clave de app_settings, y getSetting convierte «no pude leer» en null: sobre
// esa lectura, getAvatares() devuelve [] y un «editar uno» reescribe la lista vacía
// + el cambio, borrando el resto sin ningún error. Antes de escribir se lee con
// getSettingEstricto, que TIRA si la base no contesta, y se USA ESE VALOR: volver a
// leer con el getter de la lib reabre el agujero. Donde el normalizador de la lib es
// privado (avatares, lead magnets), el getter tiene que devolver la misma cantidad
// que la lectura estricta, o no se escribe.
//
// DEUDA (lib/ no se toca desde un área): briefSuficiente() debería exportarse de
// lib/onboarding.ts; lib/persona.ts debería tener setters estrictos (aquí se escribe
// mako.persona con setSetting, espejo de su setPersona privado); y
// aplicarSugerenciasProductos, tabsPorConfigurar y regenerarAvatares son copias de
// app/api/onboarding/{productos,listo,avatares}/route.ts que tendrían que vivir en
// lib/productos.ts, lib/onboarding-pendientes.ts y lib/avatares.ts, llamadas por las
// rutas y por aquí.
//
// ⚠️ EL BRIEF NO SE RECALCULA CON buildEstado(true). Esa función hace
// saveAnswers(computeEffective(archivos, manual)) y el efectivo solo trae lo que
// aportaron los documentos + lo manual: lo que el wizard guardó por la otra puerta
// (negocio_objetivo, negocio_freno, marca_*) se borraría. Aquí se quitan solo las
// claves que el efectivo ANTERIOR aportaba y se mezcla el efectivo nuevo encima.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspace } from '@/lib/workspace';
import { getSettingEstricto, setSetting } from '@/lib/settings';
import { capaDef, navEnCapa, type CapaDef, type CapaId } from '@/lib/capas';
import { getSchema, getAnswers, saveAnswers, perfilNegocioTexto } from '@/lib/onboarding';
import { listFiles, getManual, setManual, computeEffective, esCampoArchivero, pubFile, getFile, borrarBinario, deleteFileRow, setPanorama, getPanorama } from '@/lib/archivero';
import { getAvatares, setAvatares, setContextoAvatares, generarAvatares, type Avatar } from '@/lib/avatares';
import { getEntregables, setEntregables, generarEntregables, type Entregable } from '@/lib/entregable';
import { listProductos, upsertProducto, type Producto, type ProductoInput } from '@/lib/productos';
import type { PersonaData } from '@/lib/persona';
import { normalizarPersonalidad, type Personalidad } from '@/lib/personalidad';
import { TAB_ONBOARDINGS } from '@/lib/tab-onboarding-catalogo';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import type { NodoCerebro } from '@/lib/cerebro-modelo';

const limpio = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// ── Lecturas estrictas para read-modify-write (molde de chatbot.helpers) ──────

async function jsonEstricto(key: string): Promise<unknown> {
  const raw = await getSettingEstricto(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { throw new Error(`El setting ${key} no es JSON legible: no se escribe encima para no borrarlo.`); }
}

async function mapaEstricto(key: string): Promise<Record<string, string>> {
  const v = await jsonEstricto(key);
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`El setting ${key} no es un mapa: no se escribe encima.`);
  return v as Record<string, string>;
}

/** Listas con normalizador privado en la lib: el getter tiene que ver lo mismo que la lectura estricta. */
async function listaEstricta<T>(key: string, getter: () => Promise<T[]>): Promise<T[]> {
  const v = await jsonEstricto(key);
  if (v != null && !Array.isArray(v)) throw new Error(`El setting ${key} no es una lista: no se escribe encima.`);
  const esperados = ((v ?? []) as unknown[]).filter((x) => !!x && typeof x === 'object' && !!limpio((x as Record<string, unknown>).nombre)).length;
  const lista = await getter();
  if (lista.length !== esperados) throw new Error(`La lectura de ${key} no coincide (${lista.length} de ${esperados}): no se escribe encima para no borrar nada.`);
  return lista;
}

// ── Precondiciones de la IA, revisadas SIN IA al proponer ────────────────────

/** DEUDA: la misma regla que generarAvatares/generarEntregables (lib/avatares.ts, lib/entregable.ts). */
export const briefSuficiente = (brief: string): boolean => !!brief.trim() && brief.replace(/[—\-·\s]/g, '').length >= 20;

export async function faltaBrief(): Promise<string | null> {
  return briefSuficiente(await perfilNegocioTexto()) ? null : 'Primero carga tu negocio en El Archivero: de ahí sale lo que MaKo genera.';
}

/** La de sugerirProductos (lib/productos-ia.ts): alcanza con el brief o con el panorama. */
export async function faltaBriefProductos(): Promise<string | null> {
  const [brief, panorama] = await Promise.all([perfilNegocioTexto(), getPanorama().catch(() => '')]);
  return brief.trim() || panorama.trim() ? null : 'Primero carga tu negocio (el brief o algún documento en El Archivero): de ahí salen los productos.';
}

// ── La capa del workspace (sin getCapaActual: su `cache` de React no tiene request fuera de un render) ──

export async function capaDelWs(ws: number): Promise<CapaDef> {
  const w = await getWorkspace(ws).catch(() => null);
  return capaDef((w?.capa ?? null) as CapaId | null);
}

// ── Perfil del negocio ───────────────────────────────────────────────────────

export type CampoPerfil = { grupo: string; key: string; pregunta: string; valor: string | null };

/** Los campos del perfil que ve la capa (briefGrupos), con su valor. `valor: null` = hueco. */
export async function camposPerfil(ws: number): Promise<CampoPerfil[]> {
  const [schema, answers, capa] = await Promise.all([getSchema(), getAnswers(), capaDelWs(ws)]);
  const grupos = capa.briefGrupos ? schema.filter((g) => capa.briefGrupos!.includes(g.key)) : schema;
  return grupos.flatMap((g) => g.fields.map((f) => {
    const v = limpio(answers[f.key]);
    return { grupo: g.label, key: f.key, pregunta: f.label, valor: v || null };
  }));
}

/** Lo que muestra el Archivero, SIN escribir y sin leer la sesión (buildEstado lee getSesionAdmin). */
export async function estadoArchivero() {
  const [files, schema, manual] = await Promise.all([listFiles(), getSchema(), getManual()]);
  const { answers, fuente } = computeEffective(files, manual);
  const brief = schema.flatMap((g) => g.fields.map((f) => ({ key: f.key, label: f.label, grupo: g.label }))).filter((c) => esCampoArchivero(c.key));
  const gaps = brief.filter((c) => !limpio(answers[c.key])).map((c) => c.key);
  return { files: files.map(pubFile), brief, answers, fuente, gaps };
}

/** Lo que arma POST /api/onboarding/archivero/preguntas antes de llamar a la IA. */
export async function faltantesYConocido(): Promise<{ faltantes: Array<{ key: string; label: string }>; conocido: string }> {
  const est = await estadoArchivero();
  const byKey = new Map(est.brief.map((c) => [c.key, c]));
  const faltantes = est.gaps.map((k) => byKey.get(k)).filter((c): c is NonNullable<typeof c> => !!c).map((c) => ({ key: c.key, label: `${c.grupo} — ${c.label}` }));
  const conocido = est.brief.map((c) => { const v = limpio(est.answers[c.key]); return v ? `${c.label}: ${v}` : ''; }).filter(Boolean).join('\n');
  return { faltantes, conocido };
}

/** Recalcula el brief sin pisar lo que no vino del Archivero (ver la cabecera). */
async function persistirBrief(clavesAntes: Iterable<string>): Promise<void> {
  // getAnswers()/getManual() devuelven {} si la base no contesta: sobre eso, saveAnswers borraría el brief.
  const [files, manual, previas] = await Promise.all([listFiles(), mapaEstricto('mako.archivero.manual'), mapaEstricto('mako.onboarding.answers')]);
  const siguiente: Record<string, string> = { ...previas };
  for (const k of clavesAntes) delete siguiente[k];
  Object.assign(siguiente, computeEffective(files, manual).answers);
  await saveAnswers(siguiente);
}

/** ¿El campo ya tiene valor, venga del documento, de lo manual o del wizard? */
export async function campoOcupado(key: string): Promise<boolean> {
  const [files, manual, previas] = await Promise.all([listFiles(), getManual(), getAnswers()]);
  return !!limpio(computeEffective(files, manual).answers[key]) || !!limpio(previas[key]);
}

/**
 * Completa UN hueco. Lee estricto y vuelve a mirar que siga vacío.
 * Cada campo tiene UNA puerta: los del Archivero (negocio_que_hace, oferta_*, avatar_*)
 * van a lo manual; los demás (negocio_objetivo, negocio_freno, marca_*) van directo a
 * las answers, como el wizard. En lo manual ganarían para siempre en computeEffective,
 * y la próxima corrección del dueño en el wizard se perdería al recalcular el brief.
 */
export async function completarHuecoPerfil(key: string, valor: string): Promise<{ ok: boolean; motivo?: string }> {
  const [files, manual, previas] = await Promise.all([listFiles(), mapaEstricto('mako.archivero.manual'), mapaEstricto('mako.onboarding.answers')]);
  const efectivo = computeEffective(files, manual).answers;
  if (limpio(efectivo[key]) || limpio(previas[key])) return { ok: false, motivo: 'ese campo ya tiene valor; corregirlo se hace en /onboarding' };
  if (!esCampoArchivero(key)) {
    await saveAnswers({ ...previas, [key]: valor });
    return { ok: true };
  }
  await setManual({ ...manual, [key]: valor });
  await persistirBrief(Object.keys(efectivo));
  return { ok: true };
}

/** El borrado en cascada de DELETE /api/onboarding/archivero. */
export async function borrarDocumentoArchivero(id: string): Promise<{ ok: boolean; motivo?: string; panoramaVaciado?: boolean }> {
  const f = await getFile(id);
  if (!f) return { ok: false, motivo: 'el documento ya no existe' };
  const [files, manual] = await Promise.all([listFiles(), mapaEstricto('mako.archivero.manual')]);
  const antes = Object.keys(computeEffective(files, manual).answers);
  await borrarBinario(f.storage_path);
  await deleteFileRow(id);
  const quedan = (await listFiles()).length;
  if (quedan === 0) await setPanorama('');
  await persistirBrief(antes);
  return { ok: true, panoramaVaciado: quedan === 0 };
}

// ── Avatares ─────────────────────────────────────────────────────────────────

/** Lectura para ESCRIBIR: tira si la base no contesta, en vez de devolver []. */
export async function avataresParaEscribir(): Promise<Avatar[]> {
  return listaEstricta('mako.avatares', getAvatares);
}

export type PasoRespuesta = { pregunta: string; respuesta: string };

const normLinea = (v: string) => v.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Regenera los avatares (con respuestas: las suma al contexto que lee la IA). Los ids
 * viejos se conservan por POSICIÓN para que las razones sigan colgadas; `idsQuitados`
 * son los que sobraban si la IA devolvió menos.
 *
 * ⚠️ EL CONTEXTO NO QUEDA ESCRITO SI LA IA FALLA: no se borra desde ninguna pantalla y
 * entra a todos los prompts de avatares. generarAvatares() lo lee de la base y no
 * acepta uno en memoria (lib/avatares.ts no se toca desde aquí), así que se escribe,
 * se genera, y si la lista nueva no llegó a guardarse se RESTAURA el valor anterior.
 * Las líneas que ya estaban (texto normalizado) no se vuelven a sumar.
 */
export async function regenerarAvatares(respuestas?: PasoRespuesta[]): Promise<{ ok: true; nombres: string[]; idsQuitados: string[] } | { ok: false; error: string }> {
  const viejos = await avataresParaEscribir();
  let restaurar: string | null = null;
  if (respuestas?.length) {
    const previoRaw = (await getSettingEstricto('mako.avatares.contexto')) ?? '';
    const previo = limpio(previoRaw);
    const ya = new Set(previo.split('\n').map(normLinea).filter(Boolean));
    const lineas = respuestas.map((r) => `- ${r.pregunta} → ${r.respuesta}`).filter((l) => {
      const k = normLinea(l);
      if (ya.has(k)) return false;
      ya.add(k);
      return true;
    });
    if (lineas.length) {
      await setContextoAvatares([previo, ...lineas].filter(Boolean).join('\n'));
      restaurar = previoRaw;
    }
  }
  let guardado = false;
  try {
    const r = await generarAvatares();
    if (!r.ok) return { ok: false, error: r.error };
    const lista = r.avatares.map((a, i) => (viejos[i] ? { ...a, id: viejos[i].id } : a));
    await setAvatares(lista);
    guardado = true;
    return { ok: true, nombres: lista.map((a) => a.nombre), idsQuitados: viejos.slice(lista.length).map((a) => a.id) };
  } finally {
    if (!guardado && restaurar != null) await setContextoAvatares(restaurar).catch(() => {});
  }
}

export type PatchAvatar = Partial<Pick<Avatar, 'nombre' | 'segmento' | 'senalesMeta' | 'situacion' | 'dolor'>>;

/** Cambia UN avatar (o agrega uno si no hay id). Relee y reescribe solo ese. */
export async function editarAvatar(id: string | null, patch: PatchAvatar): Promise<{ ok: boolean; motivo?: string; id?: string }> {
  const lista = await avataresParaEscribir();
  if (id) {
    const i = lista.findIndex((a) => a.id === id);
    if (i < 0) return { ok: false, motivo: 'el avatar ya no existe' };
    lista[i] = { ...lista[i], ...patch };
    await setAvatares(lista);
    return { ok: true, id };
  }
  const nuevo: Avatar = { id: randomUUID(), nombre: patch.nombre ?? '', segmento: patch.segmento ?? '', senalesMeta: patch.senalesMeta ?? '', situacion: patch.situacion ?? '', dolor: patch.dolor ?? '' };
  if (!nuevo.nombre) return { ok: false, motivo: 'un avatar nuevo necesita nombre' };
  await setAvatares([...lista, nuevo]);
  return { ok: true, id: nuevo.id };
}

export async function borrarAvatar(id: string): Promise<{ ok: boolean; motivo?: string }> {
  const lista = await avataresParaEscribir();
  if (!lista.some((a) => a.id === id)) return { ok: false, motivo: 'el avatar ya no existe' };
  await setAvatares(lista.filter((a) => a.id !== id));
  return { ok: true };
}

// ── Lead magnets ─────────────────────────────────────────────────────────────

export async function leadMagnetsParaEscribir(): Promise<Entregable[]> {
  return listaEstricta('mako.entregable', getEntregables);
}

const norm = (v: string) => v.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Regenera los lead magnets CONSERVANDO los que tienen enlace (los usan las secuencias). */
export async function regenerarLeadMagnets(respuestas?: PasoRespuesta[]): Promise<{ ok: true; conservados: number; nuevos: number } | { ok: false; error: string }> {
  const r = await generarEntregables(respuestas?.length ? respuestas : undefined);
  if (!r.ok) return { ok: false, error: r.error };
  const conEnlace = (await leadMagnetsParaEscribir()).filter((e) => e.enlace);
  const nombres = new Set(conEnlace.map((e) => norm(e.nombre)));
  const nuevos = r.entregables.filter((e) => !nombres.has(norm(e.nombre)));
  await setEntregables([...conEnlace, ...nuevos]);
  return { ok: true, conservados: conEnlace.length, nuevos: nuevos.length };
}

export type PatchLeadMagnet = Partial<Pick<Entregable, 'nombre' | 'tipo' | 'queEs' | 'fomo' | 'enlace'>>;

/** Cambia UN lead magnet por id; lo que no viene (incluido el enlace) se conserva. */
export async function editarLeadMagnet(id: string, patch: PatchLeadMagnet): Promise<{ ok: boolean; motivo?: string }> {
  const lista = await leadMagnetsParaEscribir();
  const i = lista.findIndex((e) => e.id === id);
  if (i < 0) return { ok: false, motivo: 'el lead magnet ya no existe' };
  lista[i] = { ...lista[i], ...patch };
  await setEntregables(lista);
  return { ok: true };
}

// ── Productos (la IA COMPLETA, nunca pisa: copia de app/api/onboarding/productos) ──

function completar(actual: Producto, sug: ProductoInput): ProductoInput {
  const texto = (a: string | null, b: string | null | undefined) => (a?.trim() ? a : (b?.trim() || null));
  return {
    nombre: actual.nombre, tipo: actual.tipo,
    monto_usd: actual.monto_usd ?? sug.monto_usd ?? null,
    suscripcion_meses: actual.tipo === 'suscripcion' ? (actual.suscripcion_meses ?? sug.suscripcion_meses ?? null) : null,
    promesa: texto(actual.promesa, sug.promesa), incluye: texto(actual.incluye, sug.incluye),
    garantia: texto(actual.garantia, sug.garantia), descripcion: texto(actual.descripcion, sug.descripcion),
    activo: actual.activo, orden: actual.orden,
  };
}

/** Los productos NUEVOS nacen INACTIVOS: el monto lo puso la IA y nadie lo vio antes de escribirlo. */
export async function aplicarSugerenciasProductos(sugeridos: ProductoInput[]): Promise<{ creados: number; completados: number }> {
  const previos = await listProductos();
  let creados = 0; let completados = 0;
  for (const p of sugeridos) {
    const igual = previos.find((x) => norm(x.nombre) === norm(p.nombre));
    await upsertProducto(igual ? completar(igual, p) : { ...p, activo: false }, igual?.id);
    if (igual) completados++; else creados++;
  }
  return { creados, completados };
}

// ── Persona y personalidad: lectura estricta antes de escribir ───────────────

/** Espejo de getPersona() sobre la lectura estricta: setPersonaDescripcion y deletePersonaFoto releen sin ella. */
async function personaEstricta(): Promise<PersonaData> {
  const v = await jsonEstricto('mako.persona');
  if (v == null) return { descripcion: '', fotos: [] };
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error('El setting mako.persona no es un objeto: no se escribe encima.');
  const p = v as Partial<PersonaData>;
  return { descripcion: limpio(p.descripcion), fotos: Array.isArray(p.fotos) ? p.fotos.filter((f) => f && f.path) : [] };
}

export async function guardarDescripcionPersona(texto: string): Promise<void> {
  const p = await personaEstricta();
  await setSetting('mako.persona', JSON.stringify({ ...p, descripcion: limpio(texto) }));
}

/** false = la foto ya no existe (deletePersonaFoto reescribía igual con un id inexistente). */
export async function borrarFotoPersona(id: string): Promise<boolean> {
  const p = await personaEstricta();
  const foto = p.fotos.find((f) => f.id === id);
  if (!foto) return false;
  // Primero la metadata: si esa escritura falla, la foto sigue entera y no queda apuntando a nada.
  await setSetting('mako.persona', JSON.stringify({ ...p, fotos: p.fotos.filter((f) => f.id !== id) }));
  await borrarBinario(foto.path); // mismo bucket (archivero) que lib/persona.ts; no lanza
  return true;
}

export async function personalidadParaEscribir(): Promise<Personalidad> {
  return normalizarPersonalidad(await jsonEstricto('mako.personalidad'));
}

// ── Glosario: SOLO el del workspace ──────────────────────────────────────────
// glosarioTexto() usa listActiveKnowledgeByArea, que lee [ws, OWNER_WS]: le sirve a
// todo cliente la jerga del negocio del ws 1. Aquí se lee con getTenantDb (solo el propio).

export const TOPE_GLOSARIO = 500;

export async function glosarioPropio(): Promise<{ terminos: Array<{ termino: string; definicion: string }>; recortado: boolean }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('mako_knowledge').select('titulo, cuerpo')
    .eq('area', 'glosario').eq('activo', true).order('id', { ascending: true }).limit(TOPE_GLOSARIO + 1);
  if (error) throw new Error(`api-mako: glosario: ${error.message}`);
  const filas = (data ?? []) as Array<{ titulo: string; cuerpo: string }>;
  return { terminos: filas.slice(0, TOPE_GLOSARIO).map((f) => ({ termino: f.titulo, definicion: f.cuerpo })), recortado: filas.length > TOPE_GLOSARIO };
}

// ── Tabs por configurar (app/api/onboarding/listo, solo la lista `config`) ───

const ORDEN_CONFIG = ['ads-writer', 'video-generator', 'whatsapp', 'setting', 'instagram', 'carousels', 'reels', 'stories', 'email'];

export async function tabsPorConfigurar(capa: CapaDef): Promise<Array<{ key: string; titulo: string; href: string }>> {
  const config: Array<{ key: string; titulo: string; href: string }> = [];
  for (const def of Object.values(TAB_ONBOARDINGS)) {
    if (!navEnCapa(def.key, capa.id)) continue;
    if (!(await onboardingTabPendiente(def.key).catch(() => false))) continue;
    config.push({ key: def.key, titulo: def.nombre ?? def.titulo, href: def.href ?? `/${def.key}` });
  }
  const rank = (k: string) => { const i = ORDEN_CONFIG.indexOf(k); return i < 0 ? ORDEN_CONFIG.length : i; };
  return config.sort((a, b) => rank(a.key) - rank(b.key));
}

// ── Segundo cerebro ──────────────────────────────────────────────────────────

/** Los nodos que son DATOS: sin la raíz, los de área ni los de nivel 1 (andamiaje del grafo). */
export const nodosDeDatos = (nodos: NodoCerebro[]): NodoCerebro[] =>
  nodos.filter((n) => n.id !== 'raiz' && !n.id.startsWith('area:') && !n.id.startsWith('n1:'));
