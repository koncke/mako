// =============================================================================
// offer-sesiones — las conversaciones de la tab Offer (tabla offer_sesiones, migs 0254 y 0256)
// =============================================================================
// El CRUD, la vista que baja a la pantalla y las funciones del contrato que importan la página
// (app/offer) y el PDF (app/api/offer/pdf): `arbolOffer` (v2), `leerSesion`, `nombreNegocioOffer`, y las
// de la v1 que quedan por compatibilidad (`listarSesionesOffer`, `semillaOffer`). Todo corre dentro del
// workspace actual (`getTenantDb`, tabla en TENANT_TABLES).
//
// ⚠️ LA VISTA NUNCA LLEVA EL TEXTO DE LOS DOCUMENTOS. Vive en `documentos[].texto` (hasta 40.000
//    caracteres cada uno, hasta 12) y sólo lo lee el motor para armar el prompt: bajarlo al navegador
//    sería mandar en cada respuesta hasta medio MB que nadie dibuja.
// ⚠️ TODA ESCRITURA ES COMPARE-AND-SET SOBRE `updated_at` (`actualizarSesion`). La pantalla sube varios
//    archivos a la vez y cada «leer» agrega a `documentos`: con un read-modify-write pelado, dos lecturas
//    en paralelo se pisan y un documento desaparece sin un error. Y un turno tarda hasta un minuto: lo
//    que se agrega al final se agrega a la fila DE ESE MOMENTO, no a la que se leyó al empezar.
// ⚠️ SE LEE EL `error` DE CADA CONSULTA (AGENTS.md «Un select de PostgREST con UNA columna que no
//    existe rechaza la consulta ENTERA»): un error no leído se ve como «no hay conversaciones».
// ⚠️ v2: `funnel_id` y `oferta_base_id` (mig 0256) están en COLS. Sin la migración aplicada, TODA lectura
//    de esta tabla falla (es la regla de arriba): la 0256 va ANTES del deploy, no hay lectura tolerante.
// =============================================================================

import 'server-only';
import { limpiarParaBase } from './texto-para-base';
import { getTenantDb, getWorkspaceActual, getWorkspace } from './workspace';
import { seedOfertaDesdeBrief, upsertOferta, borrarOferta, listarOfertas, ofertasDeFunnels, ligarOfertaAFunnel } from './ofertas';
import { leerTodo } from './supabase-paginado';
import { leerFunnels } from './funnels';
import {
  faltanMinimas,
  type ArbolOffer, type CalculoDiagnostico, type ConclusionOferta, type DiagnosticoOferta, type EstadoSesion,
  type OfferMensaje, type OfferSesionResumen, type OfferSesionVista, type PiezasSabidas,
} from './offer-marco';
import {
  INTENTOS_CAS, adjuntoDe, construirArbol, esperaCAS, ligadaParaVista, mensajeParaVista, ofertaDesdePropuesta, ofertaYaAnotada, primerMensaje,
  sanearDocumentos, sanearMensajes, sanearPiezas,
  type DocumentoGuardado, type MensajeGuardado, type SesionParaArbol,
} from './offer-reglas';
import { contextoOffer } from './offer-contexto';

const TABLA = 'offer_sesiones';
const COLS = 'id, titulo, estado, mensajes, piezas, documentos, borrador, conclusiones, oferta_id, oferta_version, funnel_id, oferta_base_id, updated_at';
/** El título con el que nace una conversación (el default de la columna). */
export const TITULO_DEFAULT = 'Mi oferta';
/** Cuántas conversaciones lista la tab. */
const MAX_LISTA = 60;

/** Un error que la ruta convierte en un status y un mensaje para el dueño. */
export class ErrorOffer extends Error {
  constructor(mensaje: string, public status: number) { super(mensaje); }
}

/** El diagnóstico entre «diagnosticar» y «generar». */
export type BorradorOffer = { diagnostico: DiagnosticoOferta; calculo: CalculoDiagnostico; modelo: string; at: string };

/** La fila entera, con el texto de los documentos. Sólo para el motor: la pantalla recibe `vistaDe`. */
export type FilaOffer = {
  id: number;
  titulo: string;
  estado: EstadoSesion;
  mensajes: MensajeGuardado[];
  piezas: PiezasSabidas;
  documentos: DocumentoGuardado[];
  borrador: BorradorOffer | null;
  conclusiones: ConclusionOferta[];
  ofertaId: number | null;
  ofertaVersion: number | null;
  /** v2: el funnel (fila de `funnels`) y la oferta que se analiza. No cambian después del alta. */
  funnelId: number | null;
  ofertaBaseId: number | null;
  updatedAt: string;
};

/** Lo que se puede escribir. Lo que no venga, no se toca. */
export type CambioOffer = Partial<{
  titulo: string;
  estado: EstadoSesion;
  mensajes: MensajeGuardado[];
  piezas: PiezasSabidas;
  documentos: DocumentoGuardado[];
  borrador: BorradorOffer | null;
  conclusiones: ConclusionOferta[];
  ofertaId: number | null;
  ofertaVersion: number | null;
}>;

const fallo = (que: string, m: string) => new Error(`${que} falló: ${m}`);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Las versiones de la conclusión. Las escribe sólo este módulo, así que se mira la forma, no cada campo. */
function sanearConclusiones(raw: unknown): ConclusionOferta[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is ConclusionOferta =>
    esObjeto(c) && esObjeto(c.diagnostico) && esObjeto(c.calculo) && esObjeto(c.propuesta) && typeof c.version === 'number');
}

function sanearBorrador(raw: unknown): BorradorOffer | null {
  return esObjeto(raw) && esObjeto(raw.diagnostico) && esObjeto(raw.calculo) ? (raw as unknown as BorradorOffer) : null;
}

function aFila(r: Record<string, unknown>): FilaOffer {
  return {
    id: num(r.id) ?? 0,
    titulo: typeof r.titulo === 'string' && r.titulo.trim() ? r.titulo : TITULO_DEFAULT,
    estado: r.estado === 'concluida' ? 'concluida' : 'conversando',
    mensajes: sanearMensajes(r.mensajes),
    piezas: sanearPiezas(r.piezas),
    documentos: sanearDocumentos(r.documentos),
    borrador: sanearBorrador(r.borrador),
    conclusiones: sanearConclusiones(r.conclusiones),
    ofertaId: num(r.oferta_id),
    ofertaVersion: num(r.oferta_version),
    funnelId: num(r.funnel_id),
    ofertaBaseId: num(r.oferta_base_id),
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}

/**
 * Lo que la vista muestra y la fila no guarda (se lee: el funnel o la oferta pueden renombrarse, la liga
 * pudo fallar). `ligada` ausente = true (ver el porqué en `OfferSesionVista.ligada`).
 */
export type NombresSesion = { funnel?: string; ofertaBase?: string; ligada?: boolean };

/**
 * Lo que ve la pantalla. `puedeConcluir` lo calcula el código sobre las piezas, nunca el modelo. Sync a
 * propósito (la llaman el 502 del turno y los tests): los nombres vienen de afuera (`vistaSesion`) y sin
 * ellos quedan ''.
 */
export function vistaDe(f: FilaOffer, nombres: NombresSesion = {}): OfferSesionVista {
  return {
    id: f.id,
    titulo: f.titulo,
    estado: f.estado,
    mensajes: f.mensajes.map((m) => mensajeParaVista(f.id, m)),
    piezas: f.piezas,
    docs: f.documentos.map(adjuntoDe),
    conclusion: f.conclusiones.length ? f.conclusiones[f.conclusiones.length - 1] : null,
    versiones: f.conclusiones.length,
    // Sólo si lo guardado es la versión VIGENTE: después de afinar y concluir una v2, la v2 no está
    // guardada aunque la v1 sí, y mostrarla como «Guardada» escondía el botón (revisión 11/10).
    ofertaId: f.ofertaId != null && f.ofertaVersion === (f.conclusiones.length ? f.conclusiones[f.conclusiones.length - 1].version : null) ? f.ofertaId : null,
    puedeConcluir: faltanMinimas(f.piezas).length === 0,
    updatedAt: f.updatedAt,
    funnelId: f.funnelId,
    funnelNombre: nombres.funnel ?? '',
    ofertaBaseId: f.ofertaBaseId,
    ofertaBaseNombre: nombres.ofertaBase ?? '',
    modo: f.ofertaBaseId != null ? 'analizar' : 'crear',
    ofertaGuardadaId: f.ofertaId,
    ligada: ligadaParaVista(f, nombres.ligada),
  };
}

/**
 * Los nombres del funnel y de la oferta analizada, leídos. NUNCA tira: un nombre que no se pudo leer es
 * un rótulo vacío, no una conversación que no abre (el funnel pudo archivarse, la oferta borrarse).
 */
export async function nombresDeSesion(f: Pick<FilaOffer, 'funnelId' | 'ofertaBaseId' | 'ofertaId'>): Promise<NombresSesion> {
  const out: NombresSesion = {};
  await Promise.all([
    // ¿Falta la liga de la oferta guardada a su funnel? Sólo se pregunta si hay las dos cosas. TOLERANTE a
    // propósito: si falla, `ligada` queda ausente (= true) y no se invita a reintentar en falso.
    f.funnelId != null && f.ofertaId != null
      ? (async () => {
        const db = await getTenantDb();
        const liga = await db.from('funnel_ofertas').select('id').eq('funnel_id', f.funnelId as number).eq('oferta_id', f.ofertaId as number).limit(1);
        if (liga.error) throw new Error(liga.error.message);
        if (((liga.data ?? []) as unknown[]).length) { out.ligada = true; return; }
        // Sin liga: si el funnel ya no existe, reintentar no lo arregla, así que tampoco se ofrece.
        const fun = await db.from('funnels').select('id').eq('id', f.funnelId as number).limit(1);
        if (fun.error) throw new Error(fun.error.message);
        out.ligada = !((fun.data ?? []) as unknown[]).length;
      })().catch((e) => console.warn('[offer] no pude mirar si la oferta está ligada a su funnel:', e instanceof Error ? e.message : e))
      : null,
    f.funnelId != null
      ? leerFunnels().then((fs) => {
        const x = (fs ?? []).find((y) => y.id === f.funnelId);
        if (x) out.funnel = (x.producto ?? '').trim() || x.nombre;
      }).catch((e) => console.warn('[offer] no pude leer el nombre del funnel:', e instanceof Error ? e.message : e))
      : null,
    f.ofertaBaseId != null
      ? (async () => {
        const db = await getTenantDb();
        const { data, error } = await db.from('ofertas').select('id, nombre').eq('id', f.ofertaBaseId as number).limit(1);
        if (error) throw new Error(error.message);
        const fila = ((data ?? []) as Array<{ nombre?: unknown }>)[0];
        if (fila && typeof fila.nombre === 'string') out.ofertaBase = fila.nombre;
      })().catch((e) => console.warn('[offer] no pude leer el nombre de la oferta analizada:', e instanceof Error ? e.message : e))
      : null,
  ]);
  return out;
}

/** La vista con los nombres leídos. Es la que devuelve la ruta. */
export async function vistaSesion(f: FilaOffer): Promise<OfferSesionVista> {
  return vistaDe(f, await nombresDeSesion(f));
}

/** Las rutas de los audios de una conversación (para borrar los binarios cuando se borra la conversación). */
export const audiosDe = (f: Pick<FilaOffer, 'mensajes'>): string[] =>
  f.mensajes.map((m) => m.audio?.path).filter((p): p is string => !!p);

function aColumnas(c: CambioOffer): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (c.titulo !== undefined) r.titulo = c.titulo;
  if (c.estado !== undefined) r.estado = c.estado;
  if (c.mensajes !== undefined) r.mensajes = c.mensajes;
  if (c.piezas !== undefined) r.piezas = c.piezas;
  if (c.documentos !== undefined) r.documentos = c.documentos;
  if (c.borrador !== undefined) r.borrador = c.borrador;
  if (c.conclusiones !== undefined) r.conclusiones = c.conclusiones;
  if (c.ofertaId !== undefined) r.oferta_id = c.ofertaId;
  if (c.ofertaVersion !== undefined) r.oferta_version = c.ofertaVersion;
  return r;
}

/** El total de la última conclusión, para el resumen (sin bajar la conclusión entera a la pantalla). */
function totalDe(raw: unknown): number | null {
  const conc = sanearConclusiones(raw);
  const ult = conc.length ? conc[conc.length - 1] : null;
  return ult && typeof ult.calculo?.total === 'number' ? ult.calculo.total : null;
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/** La fila entera (con el texto de los documentos), o null si no es de este workspace. */
export async function leerFila(id: number): Promise<FilaOffer | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLS).eq('id', id).limit(1);
  if (error) throw fallo(`leer la conversación #${id}`, error.message);
  const fila = ((data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  return fila ? aFila(fila) : null;
}

/** Contrato: la sesión como la ve la pantalla (con los nombres del funnel y de la oferta), o null. */
export async function leerSesion(id: number): Promise<OfferSesionVista | null> {
  const f = await leerFila(id);
  return f ? vistaSesion(f) : null;
}

/** Contrato: las conversaciones del negocio, la más reciente primero. */
export async function listarSesionesOffer(): Promise<OfferSesionResumen[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA)
    .select('id, titulo, estado, conclusiones, updated_at')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_LISTA);
  if (error) throw fallo('listar las conversaciones de Offer', error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r): OfferSesionResumen => ({
    id: num(r.id) ?? 0,
    titulo: typeof r.titulo === 'string' && r.titulo.trim() ? r.titulo : TITULO_DEFAULT,
    estado: r.estado === 'concluida' ? 'concluida' : 'conversando',
    total: totalDe(r.conclusiones),
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : '',
  }));
}

/**
 * Contrato v2: el árbol del selector (funnel → ofertas → conversaciones). Lo arma `construirArbol`
 * (lib/offer-reglas.ts, puro y con test) con cuatro lecturas.
 *
 * ⚠️ «No pude leer los funnels» TIRA: un árbol sin funnels se lee como «este negocio no tiene funnels» y
 * deja a la persona sin forma de crear una oferta, que es peor que un error que dice que reintente. Las
 * ligas y las ofertas también tiran (sin ellas el árbol mentiría: cada conversación caería en «nuevas»).
 */
export async function arbolOffer(): Promise<ArbolOffer> {
  const db = await getTenantDb();
  const [funnels, ligas, ofertas, filas] = await Promise.all([
    leerFunnels(),
    ofertasDeFunnels(),
    listarOfertas(true),
    // TODAS, paginando por id (la tabla crece con el uso y nada la borra): un tope fijo dejaba las más
    // viejas fuera del selector —la única puerta para abrirlas— sin un aviso (revisión adversarial del
    // 11/10/2026). El orden por fecha lo pone construirArbol en memoria. leerTodo TIRA si la lectura falla.
    leerTodo<Record<string, unknown>>(db, TABLA, 'id, titulo, estado, conclusiones, oferta_id, funnel_id, oferta_base_id, updated_at', { orden: ['id'] }),
  ]);
  if (funnels == null) throw new ErrorOffer('No pude leer tus funnels (falló la base de MaKo, no es nada tuyo). Prueba de nuevo en un momento.', 502);
  const sesiones = filas.map((r): SesionParaArbol => ({
    id: num(r.id) ?? 0,
    titulo: typeof r.titulo === 'string' && r.titulo.trim() ? r.titulo : TITULO_DEFAULT,
    estado: r.estado === 'concluida' ? 'concluida' : 'conversando',
    total: totalDe(r.conclusiones),
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : '',
    funnelId: num(r.funnel_id),
    ofertaId: num(r.oferta_id),
    ofertaBaseId: num(r.oferta_base_id),
  }));
  return construirArbol({
    funnels: funnels.map((f) => ({ id: f.id, nombre: f.nombre, producto: f.producto })),
    ofertas: ofertas.map((o) => ({ id: o.id, nombre: o.nombre })),
    ligas,
    sesiones,
  });
}

/** Cuántas candidatas mira «Nueva oferta» antes de crear una conversación. */
const CANDIDATAS_VACIAS = 20;

/** ¿Nadie hizo nada en esta conversación? (ni un mensaje del dueño, ni un documento, ni una conclusión) */
const estaVacia = (f: Pick<FilaOffer, 'mensajes' | 'documentos' | 'conclusiones'>): boolean =>
  !f.mensajes.some((m) => m.de === 'yo') && !f.documentos.length && !f.conclusiones.length;

/**
 * Una conversación de este funnel (y de esta oferta analizada, o de ninguna) donde el dueño todavía no
 * hizo nada: «Nueva oferta» dos veces seguidas no deja dos conversaciones vacías en el árbol.
 *
 * Mira varias CANDIDATAS, no sólo la más reciente: con una vacía vieja y otra del mismo funnel con
 * mensajes más nueva, mirar sólo la primera creaba una tercera vacía (revisión adversarial del 11/10/2026).
 * La lista viene liviana (sin el texto de los documentos ni las conclusiones: sólo si hay alguno) y la
 * elegida se RELEE entera y se vuelve a juzgar: la consulta liviana es un prefiltro, la decisión la toma la
 * fila completa. Si la lectura falla se devuelve null — reusar es una comodidad, y sin ella se crea otra.
 */
export async function sesionVaciaDe(funnelId: number, ofertaBaseId: number | null): Promise<FilaOffer | null> {
  try {
    const db = await getTenantDb();
    let q = db.from(TABLA).select('id, mensajes, primer_doc:documentos->0, primera_conclusion:conclusiones->0').eq('funnel_id', funnelId);
    q = ofertaBaseId == null ? q.is('oferta_base_id', null) : q.eq('oferta_base_id', ofertaBaseId);
    const { data, error } = await q.order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(CANDIDATAS_VACIAS);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      if (r.primer_doc != null || r.primera_conclusion != null) continue;
      if (sanearMensajes(r.mensajes).some((m) => m.de === 'yo')) continue;
      const id = num(r.id);
      const f = id ? await leerFila(id) : null;
      if (f && estaVacia(f)) return f;
    }
    return null;
  } catch (e) {
    console.warn('[offer] no pude buscar una conversación vacía para reusar; se crea otra:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Contrato: lo que MaKo ya sabe del negocio y su primer mensaje, SIN IA. Lo dibuja la bienvenida
 * antes de que exista una conversación, y con lo mismo nace la sesión al primer mensaje del dueño.
 */
export async function semillaOffer(): Promise<{ piezas: PiezasSabidas; primerMensaje: OfferMensaje }> {
  const ctx = await contextoOffer();
  return { piezas: ctx.semilla, primerMensaje: primerMensaje(ctx.semilla, { hayContexto: !!ctx.texto.trim() }) };
}

/** Contrato: el nombre del negocio para el PDF ('' si no hay). */
export async function nombreNegocioOffer(): Promise<string> {
  const ws = await getWorkspaceActual();
  if (ws == null) return '';
  const w = await getWorkspace(ws);
  return (w?.nombre ?? '').trim();
}

// ── Escritura ────────────────────────────────────────────────────────────────

/** Una conversación nueva, con lo que MaKo ya sabe y su primer mensaje. */
export async function crearSesion(inicial: {
  piezas: PiezasSabidas; mensajes: MensajeGuardado[]; creadoPor?: string | null; documentos?: DocumentoGuardado[];
  funnelId?: number | null; ofertaBaseId?: number | null;
}): Promise<FilaOffer> {
  const db = await getTenantDb();
  // limpiarParaBase: un carácter que Postgres no acepta en un jsonb (el NUL de un PDF) tira la fila
  // entera; ver lib/texto-para-base.ts.
  const { data, error } = await db.from(TABLA).insert(limpiarParaBase({
    titulo: TITULO_DEFAULT,
    estado: 'conversando',
    piezas: inicial.piezas,
    mensajes: inicial.mensajes,
    documentos: inicial.documentos ?? [],
    creado_por: inicial.creadoPor ?? null,
    funnel_id: inicial.funnelId ?? null,
    oferta_base_id: inicial.ofertaBaseId ?? null,
  })).select(COLS);
  if (error) throw fallo('crear la conversación de Offer', error.message);
  const fila = ((data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  if (!fila) throw new Error('crear la conversación de Offer: la base no devolvió la fila.');
  return aFila(fila);
}

/**
 * Lee, aplica `cambio` sobre la fila de ESE momento y escribe sólo si nadie la tocó en el medio
 * (`.eq('updated_at', <lo que se leyó>)`). Si alguien se adelantó, vuelve a leer y reintenta.
 *
 * `cambio` puede tirar un `ErrorOffer` para abortar (por ejemplo, «ya hay 12 documentos»): se propaga
 * tal cual. Devolver null es «no hay nada que escribir».
 */
export async function actualizarSesion(id: number, cambio: (f: FilaOffer) => CambioOffer | null): Promise<FilaOffer> {
  for (let intento = 0; intento < INTENTOS_CAS; intento++) {
    const actual = await leerFila(id);
    if (!actual) throw new ErrorOffer('No encontré esa conversación. Puede que la hayan borrado.', 404);
    const c = cambio(actual);
    if (!c) return actual;
    const db = await getTenantDb();
    const { data, error } = await db.from(TABLA)
      .update(limpiarParaBase({ ...aColumnas(c), updated_at: new Date().toISOString() }))
      .eq('id', id)
      .eq('updated_at', actual.updatedAt)
      .select(COLS);
    if (error) throw fallo(`guardar la conversación #${id}`, error.message);
    const fila = ((data ?? []) as unknown as Array<Record<string, unknown>>)[0];
    if (fila) return aFila(fila);
    // Cero filas: otra escritura cambió `updated_at` entre la lectura y ésta. Se espera (cada vez más, con
    // azar: `esperaCAS`) y se vuelve a leer, así el cambio se aplica sobre lo que dejó la otra.
    await new Promise((r) => setTimeout(r, esperaCAS(intento)));
  }
  // ⚠️ No culpa a «otra pestaña»: lo más común es la MISMA pantalla subiendo varios archivos a la vez.
  throw new ConflictoCAS();
}

/**
 * El CAS se rindió: demasiadas escrituras a la vez sobre la misma conversación. Subclase aparte para que
 * quien perdió algo (un documento ya leído, cuyo binario ya se borró) lo pueda decir con su nombre.
 */
export class ConflictoCAS extends ErrorOffer {
  constructor() {
    super('Hay otros cambios guardándose en esta conversación (por ejemplo, varios archivos a la vez). Vuelve a intentarlo en un momento.', 409);
  }
}

export async function borrarSesion(id: number): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).delete().eq('id', id).select('id');
  if (error) throw fallo(`borrar la conversación #${id}`, error.message);
  return ((data ?? []) as unknown[]).length > 0;
}

/** Duplicado del índice único de `ofertas` (workspace + nombre normalizado). */
const esNombreRepetido = (e: unknown): boolean =>
  /ofertas_nombre_uk|duplicate key|23505/i.test(e instanceof Error ? e.message : String(e));

/**
 * «Guardar como oferta»: crea una fila NUEVA en `ofertas` con la conclusión vigente (nunca la principal)
 * y anota en la conversación qué fila y de qué versión.
 *
 * Idempotente por versión: si esta versión ya se guardó y la fila sigue existiendo, devuelve esa
 * (un doble clic no crea dos ofertas). Una versión nueva de la conclusión crea otra fila: no se pisa
 * la anterior, que el dueño pudo haber editado a mano en su editor.
 *
 * ⚠️ DOS PEDIDOS A LA VEZ (dos pestañas, o «Seguir afinando» → «Ver oferta» → Guardar otra vez: el guard
 *    es estado local de la pantalla) leen los dos «no hay nada guardado» y crean los dos. La anotación es
 *    un compare-and-set que MIRA lo que hay: si otro pedido ya anotó una oferta de esta misma versión, gana
 *    ésa y la recién creada se BORRA (revisión adversarial del 11/10/2026). Y si la anotación falla, la
 *    recién creada también se borra: sin conversación que la nombre queda huérfana y el reintento crearía
 *    otra igual.
 *
 * El nombre choca con el índice único de `ofertas` (workspace + nombre) si el negocio ya tiene una
 * oferta que se llama igual: se prueba con «· versión N» y con un número al final antes de rendirse.
 *
 * v2: la oferta creada se LIGA al funnel de la conversación (`funnel_ofertas`, `ligarOfertaAFunnel`), así
 * aparece en el árbol y en el CRM. En modo 'analizar' es lo mismo: una fila NUEVA ligada al mismo funnel,
 * nunca se pisa la oferta que se analizaba. Sólo queda como PRINCIPAL del funnel si el funnel no tenía
 * ninguna: robarle la marca a otra en silencio cambia lo que el CRM ofrece primero al cerrar. La liga corre
 * también en el camino idempotente (si la vez anterior falló, el segundo clic la arregla), y si falla NO
 * tira: la oferta ya quedó guardada y la respuesta lo dice en `aviso`, con `avisoReintentable` diciendo si
 * volver a tocar «Guardar» lo puede arreglar.
 */
export async function guardarComoOferta(id: number): Promise<{ ofertaId: number; fila: FilaOffer } & ResultadoLiga> {
  const f = await leerFila(id);
  if (!f) throw new ErrorOffer('No encontré esa conversación.', 404);
  const conc = f.conclusiones.length ? f.conclusiones[f.conclusiones.length - 1] : null;
  if (!conc) throw new ErrorOffer('Primero arma la oferta: todavía no hay una conclusión para guardar.', 409);

  if (f.ofertaId != null && f.ofertaVersion === conc.version) {
    const db = await getTenantDb();
    const { data, error } = await db.from('ofertas').select('id').eq('id', f.ofertaId).limit(1);
    if (error) throw fallo('verificar la oferta guardada', error.message);
    if (((data ?? []) as unknown[]).length) {
      return { ofertaId: f.ofertaId, fila: f, ...(await ligarAlFunnel(f.funnelId, f.ofertaId)) };
    }
  }

  // La oferta principal del negocio sale del brief, sembrada la PRIMERA vez que alguien abre el
  // editor de ofertas (seedOfertaDesdeBrief, con su guard). Si la primera fila de `ofertas` la
  // escribiera Offer, ese seed vería «ya hay ofertas», se marcaría hecho y la principal del brief no
  // se crearía nunca (revisión del 11/10). Por eso se siembra ANTES, igual que la ruta del onboarding.
  // ⚠️ La siembra QUEMA su guard la primera vez, así que no decide con una lectura que cayó al default:
  // con los funnels sin leer (`leerFunnels` → null) la principal nacería sin funnel para siempre. Se
  // saltea y la próxima vez se vuelve a intentar (revisión adversarial del 11/10/2026).
  try {
    const funnels = await leerFunnels();
    if (funnels == null) {
      console.warn('[offer] no pude leer los funnels: la siembra de la oferta principal queda para la próxima.');
    } else {
      const { getAnswers } = await import('./onboarding');
      const def = funnels.find((x) => x.esDefault) ?? funnels[0] ?? null;
      await seedOfertaDesdeBrief(await getAnswers(), def?.id ?? null);
    }
  } catch (e) {
    console.warn('[offer] no se pudo sembrar la oferta principal antes de guardar:', e instanceof Error ? e.message : e);
  }

  const base = ofertaDesdePropuesta(conc.propuesta, f.titulo === TITULO_DEFAULT ? '' : f.titulo);
  const candidatos = [base.nombre, `${base.nombre} · versión ${conc.version}`, ...[2, 3, 4, 5].map((n) => `${base.nombre} (${n})`)];
  let ofertaId: number | null = null;
  for (const nombre of candidatos) {
    try {
      ofertaId = await upsertOferta({ ...base, nombre });
      break;
    } catch (e) {
      // Sólo el nombre repetido se reintenta con otro nombre; cualquier otro fallo de la base sube tal cual.
      if (!esNombreRepetido(e)) throw e;
    }
  }
  if (ofertaId == null) {
    throw new ErrorOffer(`Ya hay ofertas con el nombre «${base.nombre}». Cámbiale el nombre a la conversación y vuelve a guardarla.`, 409);
  }
  const guardada = ofertaId;
  // Un objeto y no un `let`: TypeScript no ve la asignación adentro del callback del CAS.
  const ganadora: { id: number | null } = { id: null };
  let fila: FilaOffer;
  try {
    fila = await actualizarSesion(id, (cur) => {
      const ya = ofertaYaAnotada(cur, conc.version, guardada);
      if (ya != null) { ganadora.id = ya; return null; }
      return { ofertaId: guardada, ofertaVersion: conc.version };
    });
  } catch (e) {
    await descartarOferta(guardada, 'la anotación en la conversación falló');
    throw e;
  }
  if (ganadora.id != null) {
    await descartarOferta(guardada, `otro pedido ya había guardado esta versión como la oferta #${ganadora.id}`);
    return { ofertaId: ganadora.id, fila, ...(await ligarAlFunnel(f.funnelId, ganadora.id)) };
  }
  return { ofertaId: guardada, fila, ...(await ligarAlFunnel(f.funnelId, guardada)) };
}

/** Borra una oferta que este pedido creó y no va a quedar anotada. Nunca tira: lo que no se pudo borrar se loguea. */
async function descartarOferta(ofertaId: number, porque: string): Promise<void> {
  try {
    await borrarOferta(ofertaId);
  } catch (e) {
    console.error(`[offer] no pude borrar la oferta #${ofertaId} (${porque}); queda en el editor de ofertas sin conversación que la nombre:`, e instanceof Error ? e.message : e);
  }
}

/** Lo que devuelve la liga al funnel: nada si salió bien; si no, el aviso y si reintentar lo puede arreglar. */
export type ResultadoLiga = { aviso?: string; avisoReintentable?: boolean };

/** El fallo que sí se arregla volviendo a tocar «Guardar»: la base no contestó. */
const AVISO_LIGA_REINTENTABLE = 'La oferta quedó guardada, pero no pude sumarla a tu funnel (falló la base de MaKo). Vuelve a tocar «Guardar» en un momento.';

/**
 * Liga la oferta al funnel de la conversación. Principal sólo si el funnel no tiene ninguna principal.
 * Nunca tira (la oferta ya está guardada): devuelve el aviso para el dueño.
 *
 * ⚠️ Primero se mira, con una lectura ESTRICTA, si el funnel sigue existiendo. Un funnel eliminado del CRM
 *    (la 0256 deja `funnel_id` sin FK, así que la conversación conserva el id) hacía tirar a
 *    `ligarOfertaAFunnel` y el aviso decía «falló la base, vuelve a tocar Guardar»: falso, y reintentar
 *    falla siempre igual. Uno ARCHIVADO se liga igual (es el funnel de la conversación y vuelve si lo
 *    recuperan), pero se avisa que no se va a ver en el selector. Ninguno de los dos se arregla reintentando.
 */
async function ligarAlFunnel(funnelId: number | null, ofertaId: number): Promise<ResultadoLiga> {
  if (funnelId == null) return {};
  let estado: 'activo' | 'archivado' | 'no-existe';
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('funnels').select('id, activo').eq('id', funnelId).limit(1);
    if (error) throw new Error(error.message);
    const fila = ((data ?? []) as Array<{ activo?: unknown }>)[0];
    estado = !fila ? 'no-existe' : fila.activo === false ? 'archivado' : 'activo';
  } catch (e) {
    console.error(`[offer] no pude leer el funnel #${funnelId} para ligarle la oferta #${ofertaId}:`, e instanceof Error ? e.message : e);
    return { aviso: AVISO_LIGA_REINTENTABLE, avisoReintentable: true };
  }
  if (estado === 'no-existe') {
    return { aviso: 'La oferta quedó guardada en tu negocio, pero ese funnel ya no existe en el CRM.', avisoReintentable: false };
  }
  try {
    const ligas = await ofertasDeFunnels();
    const delFunnel = ligas.filter((l) => l.funnel_id === funnelId);
    if (!delFunnel.some((l) => l.oferta_id === ofertaId)) {
      await ligarOfertaAFunnel(funnelId, ofertaId, !delFunnel.some((l) => l.es_principal));
    }
  } catch (e) {
    console.error(`[offer] no pude ligar la oferta #${ofertaId} al funnel #${funnelId}:`, e instanceof Error ? e.message : e);
    return { aviso: AVISO_LIGA_REINTENTABLE, avisoReintentable: true };
  }
  if (estado === 'archivado') {
    return { aviso: 'La oferta quedó guardada en tu funnel, pero ese funnel está archivado en el CRM: no la vas a ver aquí hasta que lo recuperes.', avisoReintentable: false };
  }
  return {};
}
