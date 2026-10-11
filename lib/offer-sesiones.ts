// =============================================================================
// offer-sesiones — las conversaciones de la tab Offer (tabla offer_sesiones, mig 0254)
// =============================================================================
// El CRUD, la vista que baja a la pantalla y las cuatro funciones del contrato que importan la página
// (app/offer) y el PDF (app/api/offer/pdf): `listarSesionesOffer`, `leerSesion`, `semillaOffer` y
// `nombreNegocioOffer`. Todo corre dentro del workspace actual (`getTenantDb`, tabla en TENANT_TABLES).
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
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual, getWorkspace } from './workspace';
import { seedOfertaDesdeBrief, upsertOferta } from './ofertas';
import {
  faltanMinimas,
  type CalculoDiagnostico, type ConclusionOferta, type DiagnosticoOferta, type EstadoSesion,
  type OfferMensaje, type OfferSesionResumen, type OfferSesionVista, type PiezasSabidas,
} from './offer-marco';
import {
  adjuntoDe, ofertaDesdePropuesta, primerMensaje, sanearDocumentos, sanearMensajes, sanearPiezas,
  type DocumentoGuardado,
} from './offer-reglas';
import { contextoOffer } from './offer-contexto';

const TABLA = 'offer_sesiones';
const COLS = 'id, titulo, estado, mensajes, piezas, documentos, borrador, conclusiones, oferta_id, oferta_version, updated_at';
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
  mensajes: OfferMensaje[];
  piezas: PiezasSabidas;
  documentos: DocumentoGuardado[];
  borrador: BorradorOffer | null;
  conclusiones: ConclusionOferta[];
  ofertaId: number | null;
  ofertaVersion: number | null;
  updatedAt: string;
};

/** Lo que se puede escribir. Lo que no venga, no se toca. */
export type CambioOffer = Partial<{
  titulo: string;
  estado: EstadoSesion;
  mensajes: OfferMensaje[];
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
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}

/** Lo que ve la pantalla. `puedeConcluir` lo calcula el código sobre las piezas, nunca el modelo. */
export function vistaDe(f: FilaOffer): OfferSesionVista {
  return {
    id: f.id,
    titulo: f.titulo,
    estado: f.estado,
    mensajes: f.mensajes,
    piezas: f.piezas,
    docs: f.documentos.map(adjuntoDe),
    conclusion: f.conclusiones.length ? f.conclusiones[f.conclusiones.length - 1] : null,
    versiones: f.conclusiones.length,
    // Sólo si lo guardado es la versión VIGENTE: después de afinar y concluir una v2, la v2 no está
    // guardada aunque la v1 sí, y mostrarla como «Guardada» escondía el botón (revisión 11/10).
    ofertaId: f.ofertaId != null && f.ofertaVersion === (f.conclusiones.length ? f.conclusiones[f.conclusiones.length - 1].version : null) ? f.ofertaId : null,
    puedeConcluir: faltanMinimas(f.piezas).length === 0,
    updatedAt: f.updatedAt,
  };
}

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

// ── Lectura ──────────────────────────────────────────────────────────────────

/** La fila entera (con el texto de los documentos), o null si no es de este workspace. */
export async function leerFila(id: number): Promise<FilaOffer | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLS).eq('id', id).limit(1);
  if (error) throw fallo(`leer la conversación #${id}`, error.message);
  const fila = ((data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  return fila ? aFila(fila) : null;
}

/** Contrato: la sesión como la ve la pantalla, o null. */
export async function leerSesion(id: number): Promise<OfferSesionVista | null> {
  const f = await leerFila(id);
  return f ? vistaDe(f) : null;
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
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r): OfferSesionResumen => {
    const conc = sanearConclusiones(r.conclusiones);
    const ult = conc.length ? conc[conc.length - 1] : null;
    return {
      id: num(r.id) ?? 0,
      titulo: typeof r.titulo === 'string' && r.titulo.trim() ? r.titulo : TITULO_DEFAULT,
      estado: r.estado === 'concluida' ? 'concluida' : 'conversando',
      total: ult && typeof ult.calculo?.total === 'number' ? ult.calculo.total : null,
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : '',
    };
  });
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
export async function crearSesion(inicial: { piezas: PiezasSabidas; mensajes: OfferMensaje[]; creadoPor?: string | null; documentos?: DocumentoGuardado[] }): Promise<FilaOffer> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).insert({
    titulo: TITULO_DEFAULT,
    estado: 'conversando',
    piezas: inicial.piezas,
    mensajes: inicial.mensajes,
    documentos: inicial.documentos ?? [],
    creado_por: inicial.creadoPor ?? null,
  }).select(COLS);
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
  for (let intento = 0; intento < 5; intento++) {
    const actual = await leerFila(id);
    if (!actual) throw new ErrorOffer('No encontré esa conversación. Puede que la hayan borrado.', 404);
    const c = cambio(actual);
    if (!c) return actual;
    const db = await getTenantDb();
    const { data, error } = await db.from(TABLA)
      .update({ ...aColumnas(c), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('updated_at', actual.updatedAt)
      .select(COLS);
    if (error) throw fallo(`guardar la conversación #${id}`, error.message);
    const fila = ((data ?? []) as unknown as Array<Record<string, unknown>>)[0];
    if (fila) return aFila(fila);
    // Cero filas: otra escritura cambió `updated_at` entre la lectura y ésta. Se espera un poco y se
    // vuelve a leer, así el cambio se aplica sobre lo que dejó la otra.
    await new Promise((r) => setTimeout(r, 80 + Math.floor(Math.random() * 120)));
  }
  throw new ErrorOffer('La conversación se está guardando desde otra pestaña. Vuelve a intentarlo en un momento.', 409);
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
 * El nombre choca con el índice único de `ofertas` (workspace + nombre) si el negocio ya tiene una
 * oferta que se llama igual: se prueba con «· versión N» y con un número al final antes de rendirse.
 */
export async function guardarComoOferta(id: number): Promise<{ ofertaId: number; fila: FilaOffer }> {
  const f = await leerFila(id);
  if (!f) throw new ErrorOffer('No encontré esa conversación.', 404);
  const conc = f.conclusiones.length ? f.conclusiones[f.conclusiones.length - 1] : null;
  if (!conc) throw new ErrorOffer('Primero arma la oferta: todavía no hay una conclusión para guardar.', 409);

  if (f.ofertaId != null && f.ofertaVersion === conc.version) {
    const db = await getTenantDb();
    const { data, error } = await db.from('ofertas').select('id').eq('id', f.ofertaId).limit(1);
    if (error) throw fallo('verificar la oferta guardada', error.message);
    if (((data ?? []) as unknown[]).length) return { ofertaId: f.ofertaId, fila: f };
  }

  // La oferta principal del negocio sale del brief, sembrada la PRIMERA vez que alguien abre el
  // editor de ofertas (seedOfertaDesdeBrief, con su guard). Si la primera fila de `ofertas` la
  // escribiera Offer, ese seed vería «ya hay ofertas», se marcaría hecho y la principal del brief no
  // se crearía nunca (revisión del 11/10). Por eso se siembra ANTES, igual que la ruta del onboarding.
  try {
    const { getAnswers } = await import('./onboarding');
    const { listarFunnels } = await import('./funnels');
    const funnels = await listarFunnels().catch(() => []);
    const def = funnels.find((x) => x.esDefault) ?? funnels[0] ?? null;
    await seedOfertaDesdeBrief(await getAnswers().catch(() => ({} as Record<string, string>)), def?.id ?? null);
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
  const fila = await actualizarSesion(id, () => ({ ofertaId: guardada, ofertaVersion: conc.version }));
  return { ofertaId: guardada, fila };
}
