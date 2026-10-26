// =============================================================================
// mako-knowledge — conocimiento de MaKo (RAG con embeddings)
// =============================================================================
// CRUD de entradas de metodología + búsqueda semántica (top-k por coseno).
// Cada entrada pertenece a un CURSO (agrupador por autor/metodología) y tiene un
// ÁREA de aplicación ('mensajes' | 'ads' | 'general'): el conocimiento se enchufa
// donde corresponde (los mensajes de WhatsApp usan area='mensajes', etc.).
//
// Multi-tenant (mig 0071): mako_knowledge está en TENANT_TABLES.
//  - GESTIÓN (list/create/update/delete/…) via getTenantDb → cada cliente ve y
//    edita SOLO lo suyo (cierra el leak + el IDOR destructivo que había antes).
//  - RAG (search/listActiveByArea) via getSupabaseServer + filtro EXPLÍCITO a
//    [workspace propio, dueño] → el método CURADO de la agencia (filas del dueño)
//    se sirve read-only a la IA de todos, y encima cada cliente suma lo suyo.
// Re-embebe SOLO cuando cambia el cuerpo. Resiliente: si no hay conocimiento o
// falla el embedding, search devuelve [] y MaKo se comporta como hoy.

import 'server-only';
import { after } from 'next/server';
import { getSupabaseServer } from './supabase';
import { getTenantDb, getWorkspaceActual, OWNER_WS, runWithWorkspace, WS_NINGUNO, wsSuperAdmin } from './workspace';
import { sePresta, sinLoAjeno } from './rag-prestamo';
import { embed, cosine, hashText, embebedorDelNegocio, modeloDelVector, SinEmbebedor, POR_PALABRAS, type Embebedor } from './embeddings';
import { puntajePorPalabras, UMBRAL_PALABRAS } from './conocimiento-palabras';

/**
 * ¿La base todavía no tiene `embedding_modelo`? (la migración 0337_mako_knowledge_modelo, aplicada en producción el
 * 25/10/2026 20:56; una base local o de prueba puede no tenerla). Sin ella se escribe y se lee sin la columna: el modelo sale
 * del largo del vector (`modeloDelVector`). Una vez medida la falta, no se vuelve a probar en este proceso.
 */
let sinColumnaModelo = false;
const faltaLaColumna = (e: { message?: string; code?: string } | null | undefined): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /embedding_modelo/.test(e.message ?? ''));

export type EstadoIndex = 'indexado' | 'pendiente' | 'error';
export type KnowledgeArea = 'mensajes' | 'ads' | 'general';

// Área reservada al "swipe" de ejemplos: es material de REFERENCIA (few-shot), no
// metodología curada. Se retira del RAG general (searchKnowledge sin área) para no
// contaminar a los consumidores que asumen que todo lo que traen es método.
export const AREA_EJEMPLOS = 'ejemplos';

// Área reservada al conocimiento de PRODUCTO (cómo se construye esta app: reglas
// de diseño, metodología de onboarding, decisiones de arquitectura). Es material
// del super-admin para MaKo cuando trabaja SOBRE el dashboard — no tiene nada que
// ver con el marketing de un cliente, así que se retira del RAG general para no
// contaminar lo que MaKo le responde a un dueño de negocio.
export const AREA_PRODUCTO = 'producto';

/** Áreas que NO entran al RAG general (solo se sirven pidiéndolas por área). */
export const AREAS_RESERVADAS = [AREA_EJEMPLOS, AREA_PRODUCTO];
export type KnowledgeEntry = {
  id: number; titulo: string; categoria: string | null; cuerpo: string;
  curso: string | null; autor: string | null; area: string; fuente: string;
  activo: boolean; estado: EstadoIndex; error: string | null;
  created_at: string; updated_at: string;
};

const COLS = 'id, titulo, categoria, cuerpo, curso, autor, area, fuente, activo, estado, error, created_at, updated_at';

/**
 * Workspaces que el RAG puede leer: el propio, la PLATAFORMA (`wsSuperAdmin`) y el ws1 (`OWNER_WS`), que es
 * donde vive HOY el método sembrado (lib/copywriting-metodo.ts) y es un CLIENTE, Mauricio. De los dos ajenos
 * sólo entra lo que sembró MaKo (`sinLoAjeno` + `sePresta`, lib/rag-prestamo.ts): nada de lo que un negocio
 * cargó a mano ni de lo que sacó de sus reuniones. La plataforma está para que el método se pueda mudar ahí
 * sin tocar este lector (docs/relevo/seguridad-aislamiento.md).
 */
async function wsParaRag(): Promise<number[]> {
  const ws = (await getWorkspaceActual()) ?? WS_NINGUNO;
  const plataforma = await wsSuperAdmin().catch(() => null);
  return [...new Set([ws, OWNER_WS, ...(plataforma != null ? [plataforma] : [])])];
}

// El préstamo del workspace del dueño vive en `lib/rag-prestamo.ts`, sin `server-only`
// para que tenga test: es la regla del Reset aplicada a una fuga cross-tenant.

async function getById(id: number): Promise<KnowledgeEntry | null> {
  const { data } = await (await getTenantDb()).from('mako_knowledge').select(COLS).eq('id', id).maybeSingle();
  return (data as KnowledgeEntry) ?? null;
}

/**
 * Embebe el cuerpo y marca su estado. No lanza. Scopeado al workspace. El método de MaKo (`fuente` que se presta), con la de la
 * plataforma; lo del negocio, con SU IA (su OpenAI, o su Gemini si es lo único: lib/embeddings.ts). Sin ninguna, NO es un
 * error: queda `pendiente` (se busca por palabras) y se embebe sola cuando conecte su IA (25/10/2026).
 */
async function embedRow(id: number, cuerpo: string, fuente: string | null | undefined, embebedor?: Embebedor | null): Promise<void> {
  const sb = await getTenantDb();
  const ahora = new Date().toISOString();
  try {
    const { modelo, vector } = await embed(cuerpo, 'documento', { deMako: sePresta(fuente), ...(embebedor !== undefined ? { embebedor } : {}) });
    const fila = { embedding: vector, content_hash: hashText(cuerpo), estado: 'indexado', error: null, updated_at: ahora };
    let r = sinColumnaModelo ? { error: null } : await sb.from('mako_knowledge').update({ ...fila, embedding_modelo: modelo }).eq('id', id);
    if (sinColumnaModelo || faltaLaColumna(r.error)) { sinColumnaModelo = true; r = await sb.from('mako_knowledge').update(fila).eq('id', id); }
    if (r.error) throw new Error(r.error.message);
  } catch (e) {
    if (!(e instanceof SinEmbebedor)) {
      await sb.from('mako_knowledge').update({ estado: 'error', error: e instanceof Error ? e.message : String(e), updated_at: ahora }).eq('id', id);
      return;
    }
    // Sin su IA. Si el vector que tiene es de ESTE texto (re-indexar sin cambios), sigue sirviendo con su modelo: no se toca.
    // Si no lo es (fila nueva, o el cuerpo cambió), sale —ya no es de este texto— y la fila espera su IA, buscándose por palabras.
    const { data } = await sb.from('mako_knowledge').select('content_hash').eq('id', id).maybeSingle();
    if ((data as { content_hash?: string | null } | null)?.content_hash === hashText(cuerpo)) return;
    await sb.from('mako_knowledge').update({ embedding: null, content_hash: null, estado: 'pendiente', error: POR_PALABRAS, updated_at: ahora }).eq('id', id);
  }
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  const { data, error } = await (await getTenantDb()).from('mako_knowledge').select(COLS).order('updated_at', { ascending: false });
  if (error) throw new Error(`listKnowledge: ${error.message}`);
  return (data ?? []) as KnowledgeEntry[];
}

/**
 * Listado para la vista /conocimiento (solo-agencia): el conocimiento del
 * workspace actual MÁS el curado del dueño, que es el que el RAG ya sirve a
 * todos (wsParaRag). Sin esto, un miembro de la agencia que trabaja desde SU
 * workspace no veía NINGÚN curso de la casa — solo lo suyo.
 *
 * `esDelDueno` marca los que no son editables desde acá: las mutaciones van por
 * getTenantDb y fallan cerrado (getById no los encuentra), así que el flag es
 * para que la UI lo diga en vez de dejar que el usuario intente y falle.
 */
export async function listKnowledgeAgencia(): Promise<Array<KnowledgeEntry & { esDelDueno: boolean }>> {
  const ws = (await getWorkspaceActual()) ?? WS_NINGUNO;
  const { data, error } = await getSupabaseServer()
    .from('mako_knowledge')
    .select(`${COLS}, workspace_id`)
    .in('workspace_id', await wsParaRag())
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`listKnowledgeAgencia: ${error.message}`);
  // ⚠️ EL MISMO PRÉSTAMO QUE EL RAG, Y ACÁ ES PEOR: esto no alimenta un prompt, se DIBUJA.
  // Sin el filtro, abrir esta pantalla desde otro workspace listaba las 22 entradas del
  // glosario del dueño —nombres y apellidos de gente de sus reuniones— una debajo de la
  // otra. Lo encontró el test del cableado: `searchKnowledge` y `listActiveKnowledgeByArea`
  // ya filtraban y éste era el TERCER lector de `wsParaRag`, que se había pasado por alto.
  // No se pierde nada editable: lo del dueño ya venía con `esDelDueno: true`, o sea de solo
  // lectura desde acá.
  return sinLoAjeno((data ?? []) as Array<KnowledgeEntry & { workspace_id: number }>, ws)
    .map((r) => ({ ...r, esDelDueno: r.workspace_id !== ws }));
}

export type NewKnowledge = { titulo: string; categoria?: string | null; cuerpo: string; curso?: string | null; autor?: string | null; area?: string; fuente?: string; activo?: boolean };

export async function createKnowledge(input: NewKnowledge): Promise<KnowledgeEntry | null> {
  const { data, error } = await (await getTenantDb())
    .from('mako_knowledge')
    .insert({
      titulo: input.titulo, categoria: input.categoria ?? null, cuerpo: input.cuerpo,
      curso: input.curso ?? null, autor: input.autor ?? null,
      area: input.area ?? 'general', fuente: input.fuente ?? 'manual',
      activo: input.activo ?? true, estado: 'pendiente',
    })
    .select(COLS).single();
  if (error) throw new Error(`createKnowledge: ${error.message}`);
  const row = data as KnowledgeEntry;
  if (row.cuerpo.trim()) await embedRow(row.id, row.cuerpo, row.fuente);
  return getById(row.id);
}

export type PatchKnowledge = { titulo?: string; categoria?: string | null; cuerpo?: string; curso?: string | null; autor?: string | null; area?: string; fuente?: string; activo?: boolean };

export async function updateKnowledge(id: number, fields: PatchKnowledge): Promise<KnowledgeEntry | null> {
  const current = await getById(id);
  if (!current) return null; // no existe o es de otro workspace → no se toca
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.titulo !== undefined) patch.titulo = fields.titulo;
  if (fields.categoria !== undefined) patch.categoria = fields.categoria;
  if (fields.curso !== undefined) patch.curso = fields.curso;
  if (fields.autor !== undefined) patch.autor = fields.autor;
  if (fields.area !== undefined) patch.area = fields.area;
  if (fields.fuente !== undefined) patch.fuente = fields.fuente;
  if (fields.activo !== undefined) patch.activo = fields.activo;
  const cuerpoCambia = fields.cuerpo !== undefined && fields.cuerpo !== current.cuerpo;
  if (fields.cuerpo !== undefined) patch.cuerpo = fields.cuerpo;
  if (cuerpoCambia) patch.estado = 'pendiente';
  const { error } = await (await getTenantDb()).from('mako_knowledge').update(patch).eq('id', id);
  if (error) throw new Error(`updateKnowledge: ${error.message}`);
  // Re-embeber SOLO si cambió el cuerpo.
  if (cuerpoCambia && (fields.cuerpo ?? '').trim()) await embedRow(id, fields.cuerpo!, fields.fuente ?? current.fuente);
  return getById(id);
}

export async function deleteKnowledge(id: number): Promise<void> {
  const { error } = await (await getTenantDb()).from('mako_knowledge').delete().eq('id', id);
  if (error) throw new Error(`deleteKnowledge: ${error.message}`);
}

export async function reindexKnowledge(id: number): Promise<KnowledgeEntry | null> {
  const row = await getById(id);
  if (!row) return null;
  if (row.cuerpo.trim()) await embedRow(id, row.cuerpo, row.fuente);
  return getById(id);
}

/**
 * Cuando el negocio conecta su IA (su OpenAI o su Gemini), lo que guardó sin vector, o con el de OTRO modelo, se embebe con su
 * cuenta (25/10/2026; IA16 lo hacía sólo con su Gemini). De a poco: `limite` filas por vez, para no gastarle todo de golpe ni
 * pasarse del tiempo de la invocación; lo que queda, en la próxima. Lo llama /integraciones al guardar su clave, en segundo
 * plano (lib/reembeber-al-conectar.ts). El método de MaKo se queda con la de la plataforma (`deMako`). Devuelve cuántas embebió.
 * No lanza por fila (cada una queda con su estado); sin su IA, no hace nada.
 */
export const REEMBEBER_DE_A = 40;
export async function reembeberLoQueFalta(limite = REEMBEBER_DE_A): Promise<number> {
  const sb = await getTenantDb();
  type Fila = { id: number; cuerpo: string | null; fuente: string | null; estado: string | null; embedding: unknown; embedding_modelo?: unknown };
  const leerFilas = async (conModelo: boolean) => {
    const { data, error } = await sb.from('mako_knowledge').select(`id, cuerpo, fuente, estado, embedding${conModelo ? ', embedding_modelo' : ''}`).order('id');
    return { data: data as unknown as Fila[] | null, error };
  };
  let r = sinColumnaModelo ? null : await leerFilas(true);
  if (!r || faltaLaColumna(r.error)) { if (r) sinColumnaModelo = true; r = await leerFilas(false); }
  if (r.error) throw new Error(`reembeberLoQueFalta: ${r.error.message}`);
  const delNegocio = await embebedorDelNegocio().catch(() => null);
  let n = 0;
  // Las que ya fallaron, al final: una que falla siempre no ocupa la tanda de las que sí se pueden embeber.
  const filas = (r.data ?? []).sort((a, b) => Number(a.estado === 'error') - Number(b.estado === 'error'));
  for (const f of filas) {
    if (n >= limite) break;
    if (!(f.cuerpo ?? '').trim()) continue;
    const deMako = sePresta(f.fuente);
    const actual = modeloDelVector(f);
    // El método de MaKo: con la de la plataforma (Gemini), una vez. Lo del negocio: con su IA, si el vector es de otro modelo.
    if (deMako ? actual === 'gemini-embedding-001' : !delNegocio || actual === delNegocio.modelo) continue;
    await embedRow(f.id, f.cuerpo!, f.fuente, deMako ? undefined : delNegocio);
    n++;
  }
  return n;
}

/** Activar/desactivar todas las entradas de un curso de un tirón (del workspace). */
export async function setCursoActivo(curso: string, activo: boolean): Promise<void> {
  const { error } = await (await getTenantDb()).from('mako_knowledge').update({ activo, updated_at: new Date().toISOString() }).eq('curso', curso);
  if (error) throw new Error(`setCursoActivo: ${error.message}`);
}

/** ¿Ya existe al menos una entrada de este curso en el workspace? (para no re-sembrar). */
export async function cursoExiste(curso: string): Promise<boolean> {
  const { count, error } = await (await getTenantDb()).from('mako_knowledge').select('id', { count: 'exact', head: true }).eq('curso', curso);
  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * POR QUÉ EL RAG NO DEVOLVIÓ NADA LA ÚLTIMA VEZ. `null` = la última corrida anduvo.
 *
 * ⚠️ EXISTE PORQUE «NO HAY CONOCIMIENTO» Y «NO PUDE LEERLO» SON DOS COSAS, Y
 * `searchKnowledge` DEVUELVE `[]` PARA LAS DOS. Medido el 04/10/2026 contra producción:
 * `embed()` tiraba `embeddings: You have no credits remaining` —OpenAI, que es su único
 * proveedor y no tiene cascada— y el `catch { return []; }` de abajo lo convertía en una
 * lista vacía. O sea: **el RAG entero del producto estaba caído y ninguna pantalla, ningún
 * log y ningún aviso lo decían.** La nutrición, el copywriting y el contexto de MaKo
 * seguían generando, sin método adentro, exactamente igual de convencidos.
 *
 * ⚠️ Y LA CURA NO ES UNA CASCADA A OTRO PROVEEDOR. Los vectores guardados son de
 * `text-embedding-3-small`: un vector de Gemini contra ésos da un coseno sin sentido, o sea
 * resultados PLAUSIBLES Y EQUIVOCADOS — peor que vacío. Cambiar de proveedor obliga a
 * re-embeber las 119 filas, y eso es una decisión, no un fallback.
 *
 * Es sólo lectura y vive en memoria del proceso: alcanza para que una pantalla de salud o
 * un log puedan decir la verdad en vez de un cero plausible.
 */
let ultimoFalloRag: { cuando: string; motivo: string } | null = null;
export const falloDelRag = (): { cuando: string; motivo: string } | null => ultimoFalloRag;

/**
 * EL GOTEO (25/10/2026): una búsqueda que encontró filas DEL NEGOCIO sin el vector de su IA (sin vector, o con el de otro
 * modelo) re-embebe unas pocas, en segundo plano. Es lo que hace que el resto se embeba solo, de a poco: guardar la clave
 * (lib/reembeber-al-conectar.ts) hace una tanda, pero un negocio que ya tenía su GPT conectado antes de esto no la vuelve a
 * guardar, y sus filas sin vector (las que IA16 dejó en `error` por no tener su Gemini) se quedarían por palabras para siempre.
 * Una vez cada `GOTEO_CADA_MS` por negocio y proceso; sin pedido en curso (`after` tira), lo hace la próxima búsqueda que sí.
 */
export const GOTEO_DE_A = 10;
const GOTEO_CADA_MS = 10 * 60_000;
const ultimoGoteo = new Map<number, number>();
function gotear(ws: number): void {
  const ahora = Date.now();
  if (ahora - (ultimoGoteo.get(ws) ?? 0) < GOTEO_CADA_MS) return;
  try {
    after(() => runWithWorkspace(ws, () => reembeberLoQueFalta(GOTEO_DE_A))
      .then((n) => { if (n) console.log(`[conocimiento] ws ${ws}: re-embebí ${n} entradas con su IA (goteo)`); })
      .catch((e) => console.error(`[conocimiento] ws ${ws}: el goteo no pudo re-embeber:`, e instanceof Error ? e.message : e)));
    ultimoGoteo.set(ws, ahora);
  } catch { /* sin pedido en curso: la próxima búsqueda */ }
}

/**
 * Top-k entradas activas más relevantes a la consulta (coseno). Lee el conocimiento
 * del workspace propio + el método curado del dueño (RAG compartido, read-only).
 * opts.area filtra por área de aplicación (ej. 'mensajes' para WhatsApp).
 *
 * ⚠️ SIGUE DEVOLVIENDO `[]` ANTE UN FALLO, a propósito: los siete call sites inyectan esto
 * en un prompt y ninguno puede romperse porque el RAG no conteste. Lo que cambia es que el
 * fallo deja RASTRO (`falloDelRag()` + un `console.error` con el motivo del proveedor) en
 * vez de desaparecer.
 */
export async function searchKnowledge(
  query: string,
  k = 4,
  opts: { area?: string } = {},
): Promise<Array<{ titulo: string; categoria: string | null; cuerpo: string; score: number }>> {
  const q = query.trim();
  if (!q) return [];
  let data: Array<{ titulo: string; categoria: string | null; cuerpo: string; area: string; fuente: string; workspace_id: number; embedding: number[] | null; embedding_modelo?: string | null }>;
  const wsPropio = (await getWorkspaceActual()) ?? WS_NINGUNO;
  try {
    const wss = await wsParaRag();
    const leer = (columnas: string) => {
      let sel = getSupabaseServer()
        .from('mako_knowledge')
        // `workspace_id` y `fuente` viajan para poder sacar lo que es del NEGOCIO del dueño
        // y no método (ver `sinLoAjeno`). Sin las dos columnas el filtro no se puede
        // escribir, y era por donde se colaban sus 22 nombres propios.
        // Sin `.not('embedding', 'is', null)` desde el 25/10/2026: lo que no tiene vector se encuentra por palabras.
        .select(columnas)
        .in('workspace_id', wss)
        .eq('activo', true);
      // El swipe y el conocimiento de producto solo se sirven pidiéndolos por área:
      // ninguno es metodología de marketing para el chat de un cliente. El filtro
      // va en JS (encadenar .neq() acá dispara TS2589 en el tipo del builder).
      if (opts.area) sel = sel.eq('area', opts.area);
      return sel;
    };
    const base = 'titulo, categoria, cuerpo, area, fuente, workspace_id, embedding';
    let r = await leer(sinColumnaModelo ? base : `${base}, embedding_modelo`);
    if (!sinColumnaModelo && faltaLaColumna(r.error)) { sinColumnaModelo = true; r = await leer(base); }
    // ⚠️ EL ERROR DE LA CONSULTA SE LEE Y SE SEPARA DEL VACÍO. Un `select` de PostgREST con
    // una columna inexistente rechaza la consulta entera y `data` vuelve `undefined`: sin
    // esto, un esquema cambiado se lee igual que «este workspace no cargó nada».
    if (r.error) { ultimoFalloRag = { cuando: new Date().toISOString(), motivo: `no pude leer el conocimiento: ${r.error.message}` }; console.error('[mako-knowledge] RAG caído —', ultimoFalloRag.motivo); return []; }
    if (!r.data || r.data.length === 0) { ultimoFalloRag = null; return []; }
    data = r.data as unknown as typeof data;
  } catch (e) {
    ultimoFalloRag = { cuando: new Date().toISOString(), motivo: `no pude leer el conocimiento: ${e instanceof Error ? e.message : String(e)}` };
    console.error('[mako-knowledge] RAG caído —', ultimoFalloRag.motivo);
    return [];
  }

  // La pregunta, con la IA del negocio (su OpenAI, o su Gemini si es lo único). Sin ninguna, no es un fallo: por palabras.
  let qv: { modelo: string; vector: number[] } | null = null;
  try {
    qv = await embed(q, 'consulta');
    ultimoFalloRag = null;
  } catch (e) {
    if (e instanceof SinEmbebedor) ultimoFalloRag = null;
    else {
      // ⚠️ ACÁ HAY FILAS Y SU IA NO CONTESTÓ: se busca por palabras igual, pero queda dicho. Sin esto, una lista corta afirmaría
      // «este negocio no tiene método cargado» sobre un negocio con 119 entradas y un proveedor sin crédito.
      ultimoFalloRag = { cuando: new Date().toISOString(), motivo: `no pude embeber la consulta (busqué por palabras): ${e instanceof Error ? e.message : String(e)}` };
      console.error(`[mako-knowledge] RAG sin vectores con ${data.length} entradas disponibles —`, ultimoFalloRag.motivo);
    }
  }

  const candidatas = sinLoAjeno(data, wsPropio)
    // Sin área pedida, las reservadas quedan afuera del RAG general.
    .filter((r) => (opts.area ? true : !AREAS_RESERVADAS.includes(r.area)));
  // Por vector, sólo las del MISMO modelo que la pregunta: uno de OpenAI contra uno de Gemini da un coseno sin sentido
  // (lib/embeddings.ts). Las demás —sin vector, o de otro modelo, como el método de MaKo para quien embebe con su OpenAI— por
  // palabras, después: completan, no compiten con el coseno.
  const mismoModelo = (r: (typeof candidatas)[number]) => !!qv && modeloDelVector(r) === qv.modelo;
  const porVector = qv
    ? candidatas.filter(mismoModelo)
        .map((r) => ({ titulo: r.titulo, categoria: r.categoria, cuerpo: r.cuerpo, score: cosine(qv!.vector, r.embedding as number[]) }))
        .filter((r) => r.score > 0.15)
        .sort((a, b) => b.score - a.score)
    : [];
  // Lo DEL NEGOCIO sin el vector de su IA (el método de MaKo se queda con el de la plataforma): unas pocas, a re-embeber.
  if (qv && candidatas.some((r) => r.workspace_id === wsPropio && !sePresta(r.fuente) && !mismoModelo(r) && r.cuerpo?.trim())) gotear(wsPropio);
  const porPalabras = candidatas.filter((r) => !mismoModelo(r))
    .map((r) => ({ titulo: r.titulo, categoria: r.categoria, cuerpo: r.cuerpo, score: puntajePorPalabras(q, r) }))
    .filter((r) => r.score >= UMBRAL_PALABRAS)
    .sort((a, b) => b.score - a.score);
  return [...porVector, ...porPalabras].slice(0, k);
}

/** Todas las entradas ACTIVAS de un área (workspace propio + método curado del dueño),
 *  para inyectar una metodología completa. Ordenadas por id (orden de carga del curso). */
export async function listActiveKnowledgeByArea(area: string): Promise<Array<{ titulo: string; categoria: string | null; cuerpo: string }>> {
  const wsPropio = (await getWorkspaceActual()) ?? WS_NINGUNO;
  const { data, error } = await getSupabaseServer()
    .from('mako_knowledge')
    // Las dos columnas de más son las que permiten aplicar la MISMA regla de préstamo que
    // `searchKnowledge`: este lector inyecta una metodología ENTERA en un prompt, así que
    // sin el filtro era la otra puerta por la que salía el glosario del dueño.
    .select('titulo, categoria, cuerpo, fuente, workspace_id')
    .in('workspace_id', await wsParaRag())
    .eq('activo', true)
    .eq('area', area)
    .order('id', { ascending: true });
  if (error || !data) return [];
  return sinLoAjeno(data as Array<{ titulo: string; categoria: string | null; cuerpo: string; fuente: string; workspace_id: number }>, wsPropio)
    .map((r) => ({ titulo: r.titulo, categoria: r.categoria, cuerpo: r.cuerpo }));
}

export function formatKnowledge(items: Array<{ titulo: string; cuerpo: string }>): string {
  if (items.length === 0) return '';
  return items.map((i) => `### ${i.titulo}\n${i.cuerpo}`).join('\n\n');
}

/**
 * Metodología de un área para inyectar en un system prompt. Incluye TODAS las
 * entradas activas si caben (< maxChars); si no, cae al top-k semántico por la
 * consulta. Así el advisor siempre tiene la metodología a mano sin explotar.
 */
export async function metodologiaDeArea(area: string, query: string, maxChars = 20000): Promise<string> {
  try {
    const todas = await listActiveKnowledgeByArea(area);
    if (todas.length === 0) return '';
    const full = formatKnowledge(todas);
    if (full.length <= maxChars) return full;
    // Corpus grande: caemos a top-k semántico PERO garantizamos que las bases
    // (las primeras entradas del curso: fundamento, estructura y reglas/guardarraíles)
    // siempre entren, aunque no matcheen la consulta puntual.
    const bases = todas.slice(0, 3);
    const seen = new Set(bases.map((b) => b.titulo));
    const top = (await searchKnowledge(query, 6, { area })).filter((t) => !seen.has(t.titulo));
    return formatKnowledge([...bases, ...top]);
  } catch {
    return '';
  }
}
