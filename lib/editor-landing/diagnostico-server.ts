// =============================================================================
// editor-landing/diagnostico-server — analizar una landing y guardar sus comentarios (tanda 2, T5)
// =============================================================================
// Lo que corre en el server detrás de POST /api/landing-generator/diagnostico. Lo puro (el contrato,
// la búsqueda de una cita, el saneo de lo que devuelve el modelo, la clave que deduplica) vive en
// ./diagnostico.ts, con test: un módulo `server-only` no lo importa ningún test.
//
// LOS DOS CAMINOS DEL ANÁLISIS, como pide T5 (docs/diseno-editor-landing.md):
//   · una landing NUESTRA (`docId`): su texto sale del CONTENIDO guardado (las secciones visibles, en
//     orden: `bloquesDeTexto`), no de bajar la página. Se analiza con el MISMO análisis del Landing
//     Analyst (`analizarCopy`: su prompt editable, su modelo y el cruce con el comportamiento de la URL
//     publicada si la hay) pero NO se guarda en landing_analyses: esa tabla es de páginas por URL y la
//     lista del Panel las mostraría como «de afuera». Cada cita se ubica en su sección con
//     `ubicarCitaEnBloques` (eso es lo que «Solucionar con IA» edita).
//     Tanda 6 (los pendientes de la tanda 2, «Sólo se analiza la página de inicio y el puntaje de una
//     landing nuestra no se guarda»): se analizan TODAS sus páginas (`textoDeLanding`), su último
//     veredicto queda en `landing_docs.diagnostico` (mig 0281, tolerando que falte) y, si la persona la
//     leyó en su navegador, lo que se probó ahí entra al análisis (diagnostico-guardado.ts).
//   · una landing de AFUERA (`url`): `analizarLanding`, exactamente como hoy (baja la página con la
//     guarda anti-SSRF, cruza el comportamiento y guarda la fila de landing_analyses). Tanda 6: o con su
//     `lectura` hecha en el navegador de la persona (lectura-tipos.ts), que reemplaza la bajada; y si la
//     página no se lee desde el server, la falla dice `enNavegador` para que el panel ofrezca el lector.
// Los dos guardan cada hallazgo como una fila de `landing_sugerencias` (mig 0264), con la clave que
// hace que volver a analizar no repita lo que ya está (tampoco lo descartado).
//
// ⚠️ LA PUERTA LA PONE LA RUTA (admin del workspace + la tab en su capa). Acá se vuelve a pedir el
//    workspace y cada consulta lleva su `.eq('workspace_id', …)` además del acote de getTenantDb.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { leerTodo } from '../supabase-paginado';
import { analizarCopy, analizarLanding, getComportamiento, type LandingComportamiento } from '../landing-analyst';
import { errorDeCascada } from '../ai-cheap';
import { normalizarUrl } from '../landing-url';
import { extraerLanding } from '../landing-fetch';
import { abrir } from './server';
import { motivoDePagina, sanearLectura } from './lectura-reglas';
import { urlParaReplicar } from './replicar-reglas';
import type { Lectura, MotivoEnNavegador } from './lectura-tipos';
import {
  TOPES_DIAGNOSTICO, claveSugerencia, estadoValido, normalizarHallazgos,
  objetivoDe, resumenDeAnalisis, ubicarCitaEnBloques,
  type EstadoSugerencia, type HallazgoDiagnostico, type ResumenDiagnostico, type RespuestaListaDiagnostico,
  type Sugerencia,
} from './diagnostico';
import { aColumna, deColumna, esColumnaQueFalta, paginaDeNuestra, textoDeLanding } from './diagnostico-guardado';

export type FallaDiagnostico = { ok: false; error: string; status: number; pegable?: boolean; enNavegador?: true; motivo?: MotivoEnNavegador };
export type ResultadoLista = RespuestaListaDiagnostico | FallaDiagnostico;
export type ResultadoEstado = { ok: true; sugerencia: Sugerencia } | FallaDiagnostico;

const falla = (error: string, status = 400, extra: { pegable?: boolean; enNavegador?: true; motivo?: MotivoEnNavegador } = {}): FallaDiagnostico => ({ ok: false, error, status, ...extra });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * El texto de un análisis que la IA no pudo hacer. Antes, `analizarCopy` devolvía el `message` crudo
 * y «Claude vetado — «landing-analyst» no está en la lista blanca…» llegaba TAL CUAL al panel (12/10,
 * ws1); esto lo tapaba con `errorDeCascada([])` — sin errores, porque se habían quedado adentro de
 * `chatClaude` —, y el 15/10 eso fue lo que vio Martín: «Tu IA está conectada pero no pudo…», sin una
 * pista. Desde el 15/10 `analizarCopy` ya devuelve el texto de `errorDeCascada` CON los errores de las
 * keys del negocio; esto queda de red por si un veto crudo llega por otro camino. Los otros mensajes
 * (la URL no vale, la página no se pudo bajar, se arma en el navegador) ya están escritos para la
 * persona y pasan igual.
 */
async function textoDeFalloIA(error: string): Promise<string> {
  if (!/Claude vetado/i.test(error)) return error;
  console.error(`[landing-generator/diagnostico] ${error}`);
  return errorDeCascada([], 'diagnosticar la landing');
}

/**
 * Cómo corre el análisis del Diagnóstico: hay una persona mirando la pantalla.
 *
 * ⚠️ CON RED DE PLATAFORMA (15/10/2026). Pedido de Martín, con la captura del Diagnóstico de la landing
 * de un cliente (ws1): «Intenté analizar la landing y dice "Tu IA está conectada pero no pudo
 * diagnosticar la landing ahora mismo. Prueba de nuevo en un momento."... Soluciona ese error.»
 * Medido en `anthropic_usage`: las keys del ws1 no contestaban — Gemini sin un 200 desde el 08/10
 * (2.143 rebotes 429), Mistral 429 siempre, OpenAI sin crédito, OpenRouter sin una fila buena, y Groq
 * salteado con razón (el pedido pesa ~10.500 tokens contando la salida y su plan gratis topea en
 * 8.000 por minuto). Claude, vetado. La Gemini de la agencia, con el mismo pedido: 200 en 72 s y el
 * JSON entero. Lo que faltaba era pedirla: `chatClaude` no le pasaba la red a la cascada.
 *
 * `hastaMs`: la ruta tiene `maxDuration` 300 (app/api/landing-generator/diagnostico/route.ts) y la red
 * suma intentos de hasta 96 s; quedan 50 s para bajar la página y guardar lo que salió.
 */
const PLAZO_ANALISIS_MS = 250_000;
const comoAnalizar = () => ({ redDePlataforma: true, hastaMs: Date.now() + PLAZO_ANALISIS_MS });

const TABLA = 'landing_sugerencias';
const COLS = 'id, hallazgo, cita, seccion_id, estado, created_at, updated_at';
type Fila = { id: number; hallazgo: unknown; cita: string | null; seccion_id: string | null; estado: string; created_at: string; updated_at: string };

/** «Sin datos»: una landing nuestra sin publicar no tiene visitas que cruzar (el prompt lo dice solo). */
const SIN_COMPORTAMIENTO: LandingComportamiento = {
  visitas: 0, visitantes: 0, plays: 0, medidos: 0, llegaron_al_50: null, llegaron_al_final: null, agendas: 0,
  primer_evento: null, ultimo_evento: null, top_referrers: [], hay_datos: false, visitantes_compartidos: false,
};

function aSugerencia(f: Fila): Sugerencia | null {
  // La fila se vuelve a sanear al leer: el jsonb lo escribió el server, pero el panel no puede
  // recibir un hallazgo sin título o sin cita (nada que mostrar, nada que ubicar).
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
  };
}

async function wsOFalla(): Promise<number | FallaDiagnostico> {
  const ws = await getWorkspaceActual();
  return ws ?? falla('No hay un negocio abierto', 403);
}

type Objetivo = { docId: number } | { url: string };

/** Los comentarios guardados de una landing, del más viejo al más nuevo. Un error de base TIRA. */
async function leerSugerencias(ws: number, obj: Objetivo): Promise<Sugerencia[]> {
  const eq: Record<string, string | number> = 'docId' in obj ? { workspace_id: ws, doc_id: obj.docId } : { workspace_id: ws, url: obj.url };
  // Paginado y por la PK (AGENTS.md, «un número redondo es una hipótesis de truncamiento»).
  const filas = await leerTodo<Fila>(await getTenantDb(), TABLA, COLS, { eq, orden: 'id' });
  return filas.map(aSugerencia).filter((s): s is Sugerencia => s !== null);
}

/** El veredicto guardado de una landing de afuera (landing_analyses), o null. */
async function resumenGuardado(url: string): Promise<ResumenDiagnostico | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_analyses').select('status, score, veredicto, resumen, analyzed_at').eq('url', url).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { status?: string; score?: number | null; veredicto?: string | null; resumen?: string | null; analyzed_at?: string | null } | null;
  if (!f || f.status !== 'analizada') return null;
  return resumenDeAnalisis({ score: f.score, veredicto: f.veredicto, resumen: f.resumen }, f.analyzed_at ?? null);
}

/**
 * El último veredicto de una landing NUESTRA (`landing_docs.diagnostico`, mig 0281), o null.
 *
 * ⚠️ EN UN SELECT APARTE, A PROPÓSITO: nunca en `COLS_RESUMEN` ni en el select del Panel. Con la 0281
 *    sin aplicar, PostgREST rechaza la consulta ENTERA (42703) y con ella se caería el Panel. Acá, una
 *    columna que falta es «sin puntaje» (y queda en el log); cualquier otro error TIRA, como los
 *    comentarios.
 */
async function resumenDeNuestra(ws: number, docId: number): Promise<ResumenDiagnostico | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_docs').select('diagnostico').eq('workspace_id', ws).eq('id', docId).maybeSingle();
  if (error) {
    if (!esColumnaQueFalta(error)) throw new Error(error.message);
    console.warn(`[landing-generator/diagnostico] falta landing_docs.diagnostico (mig 0281): el puntaje no se lee (${error.message})`);
    return null;
  }
  return deColumna((data as { diagnostico?: unknown } | null)?.diagnostico);
}

/**
 * Guarda el veredicto de una landing NUESTRA. Nunca tira: el análisis ya se pagó y los comentarios ya
 * se guardaron, y fallar acá los escondería detrás de un error. Sin la 0281 lo dice el log; con otro
 * error, también (y el puntaje se ve igual en esta respuesta, sólo no queda para la próxima vez).
 * No toca `version` ni `updated_at`: diagnosticar no es editar (ni reordena el Panel ni le gana un
 * guardado a la pantalla abierta).
 */
async function guardarResumenDeNuestra(ws: number, docId: number, analysis: unknown, fecha: string): Promise<void> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('landing_docs').update({ diagnostico: aColumna(analysis, fecha) }).eq('workspace_id', ws).eq('id', docId);
    if (!error) return;
    if (esColumnaQueFalta(error)) console.warn(`[landing-generator/diagnostico] falta landing_docs.diagnostico (mig 0281): el puntaje de #${docId} no se guarda (${error.message})`);
    else console.error(`[landing-generator/diagnostico] no pude guardar el puntaje de #${docId}: ${error.message}`);
  } catch (e) {
    console.error(`[landing-generator/diagnostico] no pude guardar el puntaje de #${docId}: ${msg(e)}`);
  }
}

/** Guarda los hallazgos nuevos (los repetidos, por su clave, no se tocan). Devuelve cuántos entraron. */
async function guardarHallazgos(ws: number, obj: Objetivo, hallazgos: ReadonlyArray<{ h: HallazgoDiagnostico; seccionId: string | null }>): Promise<number> {
  if (!hallazgos.length) return 0;
  const filas = hallazgos.map(({ h, seccionId }) => ({
    workspace_id: ws,
    doc_id: 'docId' in obj ? obj.docId : null,
    url: 'url' in obj ? obj.url : null,
    hallazgo: h,
    cita: h.cita,
    seccion_id: seccionId,
    estado: 'pendiente' as EstadoSugerencia,
    clave: claveSugerencia(obj, h),
  }));
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).upsert(filas, { onConflict: 'workspace_id,clave', ignoreDuplicates: true }).select('id');
  if (error) throw new Error(`No pude guardar los comentarios: ${error.message}`);
  return Array.isArray(data) ? data.length : 0;
}

/** POST {accion:'listar'}: los comentarios guardados y, de una de afuera, su veredicto. */
export async function listar(p: { docId?: unknown; url?: unknown }): Promise<ResultadoLista> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const obj = objetivoDe(p);
  if (!obj) return falla('Elige una landing o pega un enlace.');
  try {
    if ('docId' in obj) {
      const r = await abrir(obj.docId);
      if (!r.ok) return falla(r.error, r.status);
      const [sugerencias, resumen] = await Promise.all([leerSugerencias(ws, obj), resumenDeNuestra(ws, obj.docId)]);
      return { ok: true, sugerencias, resumen, url: null };
    }
    const [sugerencias, resumen] = await Promise.all([leerSugerencias(ws, obj), resumenGuardado(obj.url)]);
    return { ok: true, sugerencias, resumen, url: obj.url };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * POST {accion:'analizar'}: analiza, guarda lo nuevo y devuelve la lista entera.
 *
 * Tanda 6: de una landing de afuera, `lectura` (la página leída en el navegador de la persona) reemplaza
 * la bajada, y la URL se baja TAL CUAL la pegó (`leer`): la normalizada (sin www ni query) es la LLAVE de
 * landing_analyses, no una dirección, y hay hosts que sólo existen con www.
 * De una NUESTRA, la lectura se sanea ANTES de separar los caminos (antes el corte del `docId` la tiraba
 * sin mirarla): el texto lo sigue poniendo el documento, y lo que se probó en el navegador se suma.
 */
export async function analizar(p: { docId?: unknown; url?: unknown; texto?: unknown; lectura?: unknown }): Promise<ResultadoLista> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const obj = objetivoDe(p);
  if (!obj) return falla('Elige una landing o pega un enlace.');
  const lectura = p.lectura === undefined || p.lectura === null ? null : sanearLectura(p.lectura);
  if (p.lectura !== undefined && p.lectura !== null && !lectura) return falla('La lectura de la página llegó vacía.');
  if ('docId' in obj) return analizarNuestra(ws, obj, lectura);
  return analizarDeAfuera(ws, obj, {
    texto: typeof p.texto === 'string' ? p.texto : undefined,
    lectura: lectura ?? undefined,
    leer: typeof p.url === 'string' ? p.url : undefined,
  });
}

async function analizarNuestra(ws: number, obj: { docId: number }, lectura: Lectura | null): Promise<ResultadoLista> {
  const plazo = comoAnalizar();
  const r = await abrir(obj.docId);
  if (!r.ok) return falla(r.error, r.status);
  const doc = r.doc;
  // Todas las páginas, cada una con su renglón; los bloques de todas ubican cada cita en su sección.
  const { bloques, texto, palabras, paginas, afuera } = textoDeLanding(doc.contenido);
  if (palabras < TOPES_DIAGNOSTICO.palabras) return falla('Tiene muy poco texto para diagnosticarla.');

  let url: string | null = null;
  try { url = doc.urlPublica ? normalizarUrl(doc.urlPublica) : null; } catch { url = null; }
  try {
    // Publicada: el comportamiento real de su URL (visitas, scroll, agendas). Sin publicar: «sin
    // datos», y el prompt del Landing Analyst ya sabe decirlo sin inventar.
    const comp = url ? await getComportamiento(url) : SIN_COMPORTAMIENTO;
    const pagina = paginaDeNuestra({
      titulo: doc.titulo, seoTitulo: doc.config.sitio.seoTitulo, seoDescripcion: doc.config.sitio.seoDescripcion,
      url, texto, palabras, lectura,
    });
    const res = await analizarCopy(pagina, comp, plazo);
    if (!res.ok) return falla(await textoDeFalloIA(res.error), 502);
    const hallazgos = normalizarHallazgos(res.analysis).map((h) => ({ h, seccionId: ubicarCitaEnBloques(h.cita, bloques) }));
    const nuevas = await guardarHallazgos(ws, obj, hallazgos);
    const fecha = new Date().toISOString();
    await guardarResumenDeNuestra(ws, obj.docId, res.analysis, fecha);
    console.log(`[landing-generator/diagnostico] doc #${obj.docId}: ${paginas} páginas${afuera ? ` (${afuera} afuera por el tope)` : ''}${lectura ? ', con lectura del navegador' : ''}, ${hallazgos.length} hallazgos, ${nuevas} nuevos, ${hallazgos.filter((x) => !x.seccionId).length} sin ubicar`);
    return {
      ok: true,
      sugerencias: await leerSugerencias(ws, obj),
      resumen: resumenDeAnalisis(res.analysis, fecha),
      url: null,
      nuevas,
    };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

async function analizarDeAfuera(ws: number, obj: { url: string }, entrada: { texto?: string; lectura?: Lectura; leer?: string }): Promise<ResultadoLista> {
  try {
    const res = await analizarLanding(obj.url, entrada.texto, { lectura: entrada.lectura, leer: entrada.leer, ...comoAnalizar() });
    // No es un 500: la página de afuera falló (404, armada en el navegador, plazo), no nuestro server.
    if (!res.ok) {
      return falla(await textoDeFalloIA(res.error), 200, {
        pegable: res.pegable === true,
        ...(res.enNavegador && res.motivo ? { enNavegador: true as const, motivo: res.motivo } : {}),
      });
    }
    const row = res.row;
    const url = row.url;
    const destino = { url };
    const hallazgos = normalizarHallazgos(row.hallazgos ?? []).map((h) => ({ h, seccionId: null }));
    const nuevas = await guardarHallazgos(ws, destino, hallazgos);
    return {
      ok: true,
      sugerencias: await leerSugerencias(ws, destino),
      resumen: resumenDeAnalisis({ score: row.score, veredicto: row.veredicto, resumen: row.resumen }, row.analyzed_at),
      url,
      nuevas,
    };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * POST {accion:'probarLectura'} (tanda 7): ¿el server puede leer esta página de afuera SOLO, sin el navegador?
 *
 * Martín (15/10/2026): «Si no pudo leer la landing, no me debe saltar el botón de "MaKo no pudo leerla sola"...
 * Por defecto si no pudo de una manera que vaya directo a abrir la ventana emergente y a analizar la landing».
 * La pantalla abre la ventana de lectura EN EL CLIC (el único momento en que Chrome la deja abrir) sin saber
 * si va a hacer falta, y esto corre AL LADO del pedido de siempre: si contesta `legible`, la cierra enseguida
 * en vez de dejarla abierta los 1-3 minutos que piensa la IA (lib/editor-landing/lector-navegador.ts,
 * `pedirConVentana`). No decide nada más: si la prueba se equivoca, decide la respuesta del pedido.
 *
 * Es la MISMA regla que Replicar (`pedirEsquema` en modo importar, ia.ts): la página bajada TAL CUAL y
 * `motivoDePagina` (lectura-reglas.ts), no una copia. Un error de bajada (404, DNS, un 403 de un antibots)
 * es `legible: false`: la ventana queda y el pedido dice qué pasó. Sin IA, sin base y sin escribir nada
 * (tampoco la fila de fallo que `analizarLanding` guarda en landing_analyses): es una pregunta.
 *
 * ⚠️ NO ESTÁ EN LA API DE MaKo (lib/api-mako), a propósito: no es una capacidad que un agente pueda pedir
 *    («leé esta landing» ya es `analizar`/`replicar_landing`), es un paso interno de la PANTALLA para
 *    manejar SU ventana. Un agente no tiene ventana que cerrar, y exponerla sería dar un «bajame esta URL»
 *    suelto. La puerta es la de la ruta (admin del workspace + la tab en su capa), arriba del switch.
 */
export async function probarLectura(p: { url?: unknown }): Promise<{ ok: true; legible: boolean } | FallaDiagnostico> {
  const url = urlParaReplicar(p.url);
  if (!url) return falla('Revisa el enlace.');
  try {
    return { ok: true, legible: motivoDePagina(await extraerLanding(url, { talCual: true })) === null };
  } catch {
    return { ok: true, legible: false };
  }
}

/** POST {accion:'estado'}: pendiente / resuelta / descartada. Nunca borra. */
export async function cambiarEstado(p: { id?: unknown; estado?: unknown }): Promise<ResultadoEstado> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = typeof p.id === 'number' ? p.id : Number(p.id);
  if (!Number.isSafeInteger(id) || id <= 0) return falla('Falta el comentario');
  if (!estadoValido(p.estado)) return falla('Estado desconocido');
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from(TABLA)
      .update({ estado: p.estado, updated_at: new Date().toISOString() })
      .eq('workspace_id', ws).eq('id', id)
      .select(COLS).maybeSingle();
    if (error) return falla(error.message, 500);
    const s = data ? aSugerencia(data as Fila) : null;
    return s ? { ok: true, sugerencia: s } : falla('No existe', 404);
  } catch (e) {
    return falla(msg(e), 500);
  }
}
