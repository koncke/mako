import 'server-only';

// =============================================================================
// curso-datos — leer y escribir el curso, el avance y el acceso de un cliente
// =============================================================================
// Lo usan la tab Curso, la ficha del cliente, el portal del alumno (rutas públicas, sin sesión)
// y el cron de las llamadas. Las reglas puras viven en lib/curso.ts; el modelo, en la cabecera
// de supabase/migrations/0202_curso.sql.
//
// ⚠️ TODO LO DE ACÁ CORRE ADENTRO DE UN WORKSPACE: usa `getTenantDb()`, que pone el `.eq` del
// inquilino. Desde una ruta pública (el portal del alumno) no hay sesión, así que quien llama
// envuelve en `runWithWorkspace(acceso.ws, …)` con el workspace QUE SALE DE LA FIRMA del link,
// nunca de un parámetro del pedido. Sin eso, `getTenantDb` cae al workspace por defecto.

import crypto from 'node:crypto';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { linkApp } from './app-url';
import { firmarAccesoCurso, leerAccesoCurso, firmarAccesoLider, leerAccesoLider, type AccesoCurso } from './curso-acceso';
import { saneaAlcance, type AlcanceCurso } from './curso-alcance';
import {
  pctVisto, sanearValores, respuestaCompleta, progresoEfectivo, areasDelCliente, nombreDeArea, leerCalificacion,
  type Clase, type Progreso, type Campo, type Valores, type EstadoTarea, type TipoClase, type VideoTipo,
} from './curso';
import { propuestaDeFila, valoresAprobables, mismoInstante, type FilaPropuesta, type FilaRespuesta } from './curso-propuesta';

type FilaClase = {
  id: number; producto_id: number; etapa: string; orden: number; titulo: string; descripcion: string;
  tipo: TipoClase; minutos: number | null; video_tipo: VideoTipo; video_url: string | null; video_path: string | null;
  tarea: string; campos: Campo[] | null; obligatoria: boolean; por_area?: boolean | null;
};
type FilaProgreso = FilaPropuesta & {
  clase_id: number; segundos_max: number | string; duracion_seg: number | string | null; pct: number;
  visto_at: string | null; valores: Valores | null; estado: EstadoTarea; enviada_at: string | null;
  /** De qué área es (mig 0212). `''` = la del cliente. */
  area?: string | null;
  /** La nota de sus quizzes (mig 0218). La corrige el SERVER: no vive en `valores`, que pisa cada autoguardado. */
  calificacion?: unknown;
};

/**
 * ⚠️ TRAE `por_area` (mig 0212), así que la 0212 va ANTES del deploy: sin la columna, PostgREST
 * rechaza la consulta entera y se caen el portal, la ficha, la tab y el cron. Es la diferencia con
 * `grabar` (mig 0208), que se dejó afuera a propósito porque el alumno no la necesita; ésta la
 * necesita justamente el alumno.
 */
export const COLUMNAS_CLASE = 'id, producto_id, etapa, orden, titulo, descripcion, tipo, minutos, video_tipo, video_url, video_path, tarea, campos, obligatoria, por_area';

export const aClase = (f: FilaClase): Clase => ({
  id: Number(f.id), productoId: Number(f.producto_id), etapa: f.etapa, orden: f.orden ?? 0,
  titulo: f.titulo, descripcion: f.descripcion ?? '', tipo: f.tipo, minutos: f.minutos ?? null,
  videoTipo: f.video_tipo, videoUrl: f.video_url ?? null, videoPath: f.video_path ?? null,
  tarea: f.tarea ?? '', campos: Array.isArray(f.campos) ? f.campos : [], obligatoria: f.obligatoria === true,
  porArea: f.por_area === true,
});

const aProgreso = (f: FilaProgreso): Progreso => ({
  claseId: Number(f.clase_id), segundosMax: Number(f.segundos_max) || 0,
  duracionSeg: f.duracion_seg == null ? null : Number(f.duracion_seg), pct: f.pct ?? 0,
  vistoAt: f.visto_at ?? null, valores: f.valores ?? {}, estado: f.estado, enviadaAt: f.enviada_at ?? null,
  // Sólo si la lectura trajo las columnas de la 0213: ausente es «no se pidió», no «no hay».
  ...('ia_estado' in f ? { ia: propuestaDeFila(f) } : {}),
  // Igual: sólo si la lectura trajo la columna de la 0218.
  ...('calificacion' in f ? { calificacion: leerCalificacion(f.calificacion) } : {}),
});

const COLS_PROGRESO = 'clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at, area';
/**
 * Lo mismo, con la PROPUESTA de la IA (mig 0213). Lo leen el portal del alumno y la ficha
 * (`avanceDelCliente`); la tabla Avance de la tab no lo necesita y sigue con `COLS_PROGRESO`.
 * ⚠️ Por esto la 0213 va ANTES del deploy: sin las columnas, PostgREST rechaza la consulta entera.
 * Y la 0218 también (`calificacion`, la nota de los quizzes).
 */
const COLS_PROGRESO_IA = `${COLS_PROGRESO}, valores_ia, ia_estado, ia_recording_id, ia_propuesta_at, ia_resuelta_at, calificacion`;

/**
 * ⚠️ LOS TARGETS DE LOS UPSERT SON LOS ÍNDICES DE LA 0212, letra por letra: un `onConflict` que no
 * coincide con un índice único COMPLETO falla entero («there is no unique or exclusion constraint
 * matching the ON CONFLICT specification»), y uno parcial no sirve. Lo fija
 * tests/curso-por-area.test.ts contra el `.sql`.
 */
const CONFLICTO_PROGRESO = 'workspace_id,lead_id,clase_id,area';
const CONFLICTO_ACCESO = 'workspace_id,lead_id,area';

/** Las clases de un producto, en el orden de cada etapa. Tira si no puede leer. */
export async function clasesDelProducto(productoId: number): Promise<Clase[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select(COLUMNAS_CLASE)
    .eq('producto_id', productoId).order('etapa').order('orden').order('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaClase[]).map(aClase);
}

/** Una clase por id (del workspace en curso). `null` = no existe o es de otro inquilino. */
export async function claseDeId(claseId: number): Promise<Clase | null> {
  if (!Number.isInteger(claseId) || claseId <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select(COLUMNAS_CLASE).eq('id', claseId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? aClase(data as FilaClase) : null;
}

/**
 * Los ids de las clases POR ÁREA del workspace (mig 0212). Son pocas (13 en el programa de
 * Mauricio) y se piden una vez por lectura de avance, sin importar de qué producto.
 */
async function idsDeClasesPorArea(): Promise<Set<number>> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number }>(db, 'curso_clases', 'id', { filtros: (q) => q.eq('por_area', true), orden: 'id' });
  return new Set(filas.map((f) => Number(f.id)));
}

/**
 * El avance de UN cliente con sus áreas (#665): lo que cuenta (`progreso`), lo que contestó cada
 * área (`porArea`, claseId → área → progreso) y las áreas que declaró (`areas`).
 *
 * ⚠️ `progreso` ES EL EFECTIVO (`progresoEfectivo`): una clase por área figura enviada sólo con
 * TODAS sus áreas enviadas. Es lo que leen el paso automático, el portal, la ficha y el cron, y por
 * eso la regla «la etapa exige todas las áreas» se cumple sin que ninguno sepa de áreas.
 */
export type AvanceCliente = {
  progreso: Map<number, Progreso>;
  porArea: Map<number, Map<string, Progreso>>;
  areas: string[];
};

/** Arma el avance de un cliente desde sus filas. Puro sobre lo leído: lo comparten las dos lecturas. */
function avanceDeFilas(filas: readonly FilaProgreso[], idsPorArea: ReadonlySet<number>): AvanceCliente {
  const delCliente = new Map<number, Progreso>();
  const porArea = new Map<number, Map<string, Progreso>>();
  for (const f of filas) {
    const area = f.area ?? '';
    const p = aProgreso(f);
    if (!area) { delCliente.set(p.claseId, p); continue; }
    if (!porArea.has(p.claseId)) porArea.set(p.claseId, new Map());
    porArea.get(p.claseId)!.set(area, p);
  }
  const areas = areasDelCliente(delCliente.values());
  return { progreso: progresoEfectivo(delCliente, porArea, idsPorArea, areas), porArea, areas };
}

export async function avanceDelCliente(leadId: number): Promise<AvanceCliente> {
  const db = await getTenantDb();
  const [{ data, error }, idsPorArea] = await Promise.all([
    // Con la propuesta de la IA: la dibujan el portal (al cliente) y la ficha (al equipo).
    db.from('curso_progreso').select(COLS_PROGRESO_IA).eq('lead_id', leadId),
    idsDeClasesPorArea(),
  ]);
  if (error) throw new Error(error.message);
  return avanceDeFilas((data ?? []) as FilaProgreso[], idsPorArea);
}

/**
 * El avance de un cliente: claseId → progreso. Las clases que nunca abrió no están. Es el EFECTIVO
 * (ver `avanceDelCliente`): una clase por área está enviada cuando la enviaron todas sus áreas.
 */
export async function progresoDelCliente(leadId: number): Promise<Map<number, Progreso>> {
  return (await avanceDelCliente(leadId)).progreso;
}

/** El avance de VARIOS clientes (la tab Curso): leadId → claseId → progreso (el efectivo). */
export async function progresoDeClientes(leadIds: readonly number[]): Promise<Map<number, Map<number, Progreso>>> {
  const out = new Map<number, Map<number, Progreso>>();
  if (!leadIds.length) return out;
  const db = await getTenantDb();
  // ⚠️ PAGINADO: son clientes × clases (14 × 107 en el ws1 ya pasan las 1000 filas), y PostgREST
  // corta en 1000 SIN error — la tabla Avance mostraría tareas enviadas como pendientes. Con las
  // áreas son más todavía.
  const [filas, idsPorArea] = await Promise.all([
    leerTodo<FilaProgreso & { lead_id: number }>(db, 'curso_progreso', `id, lead_id, ${COLS_PROGRESO}`,
      { filtros: (q) => q.in('lead_id', [...leadIds]), orden: 'id' }),
    idsDeClasesPorArea(),
  ]);
  const porLead = new Map<number, FilaProgreso[]>();
  for (const f of filas) {
    const lead = Number(f.lead_id);
    if (!porLead.has(lead)) porLead.set(lead, []);
    porLead.get(lead)!.push(f);
  }
  for (const [lead, fs] of porLead) out.set(lead, avanceDeFilas(fs, idsPorArea).progreso);
  return out;
}

/**
 * En qué quedó la tarea de UN área (o la del cliente, con `''`). `undefined` = nunca la tocó. Lo
 * usa la ruta de la tarea para no dejar que un borrador pise una enviada: con áreas, el estado
 * efectivo de la clase no sirve para eso (está «pendiente» aunque esta área ya la haya mandado).
 */
export async function estadoDeTareaEnArea(leadId: number, claseId: number, area: string): Promise<EstadoTarea | undefined> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_progreso').select('estado')
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { estado: EstadoTarea } | null)?.estado;
}

/**
 * Registra hasta dónde vio un video. Guarda el MÁXIMO (volver atrás no resta) y el % lo calcula
 * acá con la duración — nunca se cree un % que llega armado del navegador.
 *
 * ⚠️ VA SIEMPRE A LA FILA DEL CLIENTE (área `''`), también cuando mira el líder de un área: cuánto
 * se vio un video es un dato del cliente, no de un área. Una fila por área partiría el «Visto» de
 * la ficha en N números que nadie pidió.
 */
export async function guardarVisto(leadId: number, clase: Clase, segundos: number, duracion: number | null): Promise<Progreso> {
  const db = await getTenantDb();
  const { data: previa, error: errPrevia } = await db.from('curso_progreso')
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at')
    .eq('lead_id', leadId).eq('clase_id', clase.id).eq('area', '').maybeSingle();
  // Sin leer el error, una lectura caída daba `previa = null` y el upsert PISABA lo ya visto.
  if (errPrevia) throw new Error(errPrevia.message);
  const p = previa ? aProgreso(previa as FilaProgreso) : null;
  const seg = Math.max(p?.segundosMax ?? 0, Number.isFinite(segundos) && segundos > 0 ? Math.min(segundos, 24 * 3600) : 0);
  // ⚠️ LA DURACIÓN SE FIJA CON LA PRIMERA QUE LLEGA, y no se pisa. Los dos números vienen del
  // navegador: si cada pedido pudiera traer su duración, `{seg: 1, dur: 1}` dejaba cualquier clase
  // en 100% de un golpe (lo armó la revisión del 06/10/2026). Con la clase declarando sus minutos,
  // una duración de menos del 80% de lo declarado no se cree.
  const piso = clase.minutos && clase.minutos > 0 ? clase.minutos * 60 * 0.8 : 0;
  const nueva = duracion && Number.isFinite(duracion) && duracion > 0 ? Math.min(Math.max(duracion, piso), 24 * 3600) : null;
  const dur = p?.duracionSeg ?? nueva;
  const ahora = new Date().toISOString();
  const fila = {
    lead_id: leadId, clase_id: clase.id, area: '', segundos_max: seg, duracion_seg: dur,
    pct: pctVisto(seg, dur), visto_at: p?.vistoAt ?? ahora, updated_at: ahora,
  };
  const { data, error } = await db.from('curso_progreso')
    .upsert([fila], { onConflict: CONFLICTO_PROGRESO })
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at').single();
  if (error) throw new Error(error.message);
  return aProgreso(data as FilaProgreso);
}

/**
 * Guarda lo que contestó en la tarea de una clase. Con `enviar`, la marca como ENVIADA sólo si
 * lo contestado alcanza (`respuestaCompleta`): enviar un formulario vacío no es hacer la tarea.
 * Una tarea ya aprobada que se vuelve a editar queda enviada (la revisa Mauricio de nuevo).
 *
 * `area`: de qué área es la respuesta (#665). `''` = la del cliente, que es la única de una clase
 * que no es por área. ⚠️ Quién puede escribir QUÉ área lo decide la ruta (`areaDeLaTarea`, en
 * lib/curso-portal.ts); acá se rechaza sólo lo que nunca puede ser: un área sobre una clase que no
 * es por área dejaría una fila que nadie lee.
 */
export async function guardarTarea(leadId: number, clase: Clase, raw: unknown, enviar: boolean, area = ''): Promise<{ progreso: Progreso; faltaCompletar: boolean }> {
  if (area && (!clase.porArea || nombreDeArea(area) !== area)) throw new Error('esa área no corresponde a la clase');
  const valores = sanearValores(clase.campos, raw);
  const completo = respuestaCompleta(clase, valores);
  const db = await getTenantDb();
  const { data: previa, error: errPrevia } = await db.from('curso_progreso').select('estado, enviada_at')
    .eq('lead_id', leadId).eq('clase_id', clase.id).eq('area', area).maybeSingle();
  if (errPrevia) throw new Error(errPrevia.message);
  const antes = previa as { estado: EstadoTarea; enviada_at: string | null } | null;
  const ahora = new Date().toISOString();
  const pasaAEnviada = enviar && completo;
  const fila: Record<string, unknown> = { lead_id: leadId, clase_id: clase.id, area, valores, updated_at: ahora };
  if (pasaAEnviada) { fila.estado = 'enviada'; fila.enviada_at = antes?.enviada_at ?? ahora; fila.aprobada_at = null; }
  const { data, error } = await db.from('curso_progreso').upsert([fila], { onConflict: CONFLICTO_PROGRESO })
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at').single();
  if (error) throw new Error(error.message);
  // ⚠️ MANDAR SU VERSIÓN RESUELVE LA PROPUESTA DE LA IA (paso 5 de #665): la «corrigió» — usó
  // «Corregir», o editó la suya y la reenvió. Sin esto quedaría pendiente una propuesta armada sobre
  // una respuesta que ya no es la que tiene, y «Aprobar» le pisaría lo que acaba de mandar. Va
  // DESPUÉS del upsert, no leída antes: una propuesta que el cron haya escrito entre la lectura y el
  // upsert también se resuelve (y una posterior no puede existir: el cron escribe con compare-and-set
  // sobre `updated_at`, que el upsert acaba de cambiar). Si falla, la respuesta ya está guardada.
  if (pasaAEnviada) {
    const { error: errIa } = await db.from('curso_progreso')
      .update({ ia_estado: 'corregida', ia_resuelta_at: ahora })
      .eq('lead_id', leadId).eq('clase_id', clase.id).eq('area', area)
      .eq('ia_estado', 'pendiente');
    if (errIa) console.error('[curso] la tarea se guardó y la propuesta de la IA quedó pendiente:', errIa.message);
  }
  return { progreso: aProgreso(data as FilaProgreso), faltaCompletar: enviar && !completo };
}

// ── La propuesta de la IA (paso 5 de #665, mig 0213) ───────────────────────────
// La IA reescribe la respuesta con lo hablado en la llamada y el CLIENTE la aprueba o la corrige.
// Las reglas puras viven en lib/curso-propuesta.ts; el disparo, en lib/curso-propuesta-ia.ts.

/**
 * Las respuestas de un cliente (la suya y las de sus áreas) como se leen para PROPONER, con el
 * `updated_at` de cada fila: es el token del compare-and-set de `guardarPropuestaIA`. Y sus áreas
 * declaradas (`areasDelCliente`), que salen de las mismas filas.
 */
export async function respuestasParaPropuesta(leadId: number): Promise<{ filas: FilaRespuesta[]; areas: string[] }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_progreso')
    .select('clase_id, area, estado, enviada_at, valores, updated_at').eq('lead_id', leadId);
  if (error) throw new Error(error.message);
  const filas = ((data ?? []) as Array<{ clase_id: number; area: string | null; estado: EstadoTarea; enviada_at: string | null; valores: Valores | null; updated_at: string }>)
    .map((f) => ({
      claseId: Number(f.clase_id), area: f.area ?? '', estado: f.estado, enviadaAt: f.enviada_at ?? null,
      valores: f.valores ?? {}, updatedAt: f.updated_at,
    }));
  return { filas, areas: areasDelCliente(filas.filter((f) => !f.area)) };
}

/**
 * Deja la propuesta de la IA AL LADO de una respuesta. `true` = quedó escrita.
 *
 * ⚠️ NUNCA ESCRIBE `valores`: lo que contestó el cliente no lo toca nadie más que él.
 *
 * ⚠️ COMPARE-AND-SET SOBRE `updated_at`: la propuesta se armó con la respuesta que había en
 * `baseUpdatedAt`. Si el cliente la cambió mientras la IA pensaba (o volvió a borrador), la
 * propuesta habla de otra cosa y no se escribe. Y sólo sobre una respuesta ENVIADA o revisada.
 *
 * Una propuesta nueva reemplaza a la anterior (de otra llamada): vuelve a `pendiente`, con su
 * `ia_propuesta_at` nuevo — el token con el que el cliente aprueba, así que «Aprobar» sobre la vieja
 * ya no aplica nada.
 */
export async function guardarPropuestaIA(
  leadId: number, claseId: number, area: string, valores: Valores, recordingId: number, baseUpdatedAt: string,
): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_progreso')
    .update({ valores_ia: valores, ia_estado: 'pendiente', ia_recording_id: recordingId, ia_propuesta_at: new Date().toISOString(), ia_resuelta_at: null })
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area)
    .eq('updated_at', baseUpdatedAt).in('estado', ['enviada', 'aprobada'])
    .select('clase_id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * El cliente APRUEBA la propuesta de la IA: su respuesta pasa a ser la de la IA. Devuelve el
 * progreso que quedó, o `null` si no se aprobó nada (ya no hay propuesta pendiente, no es la que vio,
 * o ya no alcanza para enviar).
 *
 * ⚠️ COMPARE-AND-SET, en el WHERE y no en el código: sólo sobre una propuesta que SIGUE `pendiente`
 * Y es la misma que vio (`ia_propuesta_at` = `desde`). Con dos pestañas, un doble click o una
 * propuesta nueva de otra llamada en el medio, el segundo pedido no encuentra la fila y no pisa nada.
 *
 * La tarea queda ENVIADA (si el equipo la había revisado, vuelve a revisión: la respuesta cambió) y
 * no mueve de etapa ni manda nada: ya estaba enviada.
 */
export async function aprobarPropuestaIA(leadId: number, clase: Clase, area: string, desde: string): Promise<Progreso | null> {
  const db = await getTenantDb();
  const { data: previa, error: errPrevia } = await db.from('curso_progreso')
    .select('valores_ia, ia_estado, ia_propuesta_at')
    .eq('lead_id', leadId).eq('clase_id', clase.id).eq('area', area).maybeSingle();
  if (errPrevia) throw new Error(errPrevia.message);
  const p = previa as { valores_ia: unknown; ia_estado: string | null; ia_propuesta_at: string | null } | null;
  if (!p || p.ia_estado !== 'pendiente' || !p.ia_propuesta_at || !mismoInstante(p.ia_propuesta_at, desde)) return null;
  const valores = valoresAprobables(clase.campos, p.valores_ia);
  if (!valores) return null;
  const ahora = new Date().toISOString();
  const { data, error } = await db.from('curso_progreso')
    .update({ valores, estado: 'enviada', aprobada_at: null, ia_estado: 'aprobada', ia_resuelta_at: ahora, updated_at: ahora })
    .eq('lead_id', leadId).eq('clase_id', clase.id).eq('area', area)
    .eq('ia_estado', 'pendiente').eq('ia_propuesta_at', p.ia_propuesta_at).in('estado', ['enviada', 'aprobada'])
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at');
  if (error) throw new Error(error.message);
  const fila = (data ?? [])[0] as FilaProgreso | undefined;
  return fila ? aProgreso(fila) : null;
}

// ── El acceso del cliente ─────────────────────────────────────────────────────

type FilaAcceso = {
  id: number; lead_id: number; area: string | null; version: number; revocado_at: string | null; ingresos: number; ultimo_ingreso_at: string | null;
  email: string | null; invitacion_enviada_at: string | null; invitado_por: string | null;
  /** Los permisos del alumno (mig 0219). Llega crudo del jsonb: se sanea al mapear. */
  alcance?: unknown;
};
/**
 * El acceso de un cliente (o del líder de una de sus áreas). ⚠️ «Tiene fila» NO es «lo invitaron»
 * (mig 0206): lo que lo dice es `invitacionEnviadaAt`, que se escribe sólo si el mail salió.
 *
 * `alcance` (mig 0219): qué módulos ve. `null` = todo. Sólo significa algo en la fila del CLIENTE
 * (`area` null): el de un líder es siempre `null` y el portal le aplica el del cliente.
 */
export type EstadoAcceso = {
  version: number; revocado: boolean; ingresos: number; ultimoIngresoAt: string | null;
  email: string | null; invitacionEnviadaAt: string | null; invitadoPor: string | null;
  alcance: AlcanceCurso;
};
/** El acceso del LÍDER de un área: lo mismo, más su área y el id de su fila (va adentro del link). */
export type EstadoAccesoLider = EstadoAcceso & { id: number; area: string };
/**
 * ⚠️ TRAE `alcance` (mig 0219), así que la 0219 va ANTES del deploy: sin la columna PostgREST
 * rechaza la consulta entera y se caen la ficha, el portal y el cron de recordatorios.
 */
const COLS_ACCESO = 'id, lead_id, area, version, revocado_at, ingresos, ultimo_ingreso_at, email, invitacion_enviada_at, invitado_por, alcance';

const aEstado = (f: FilaAcceso): EstadoAcceso => ({
  version: f.version, revocado: f.revocado_at != null, ingresos: f.ingresos ?? 0, ultimoIngresoAt: f.ultimo_ingreso_at,
  email: f.email ?? null, invitacionEnviadaAt: f.invitacion_enviada_at ?? null, invitadoPor: f.invitado_por ?? null,
  // Se sanea al LEER y no se cree lo guardado: el jsonb lo escribió una action con lo que mandó un
  // navegador. `saneaAlcance` nunca tira; lo ilegible es `null` (ve todo), que es lo de siempre.
  alcance: saneaAlcance(f.alcance),
});

/**
 * La fila de UN acceso: la del cliente (`area` null) o la del líder de esa área.
 *
 * ⚠️ TODA LECTURA O ESCRITURA DE UN ACCESO PASA POR ACÁ, y el filtro de área no es opcional: desde la
 * 0212 un cliente tiene una fila suya y una por cada líder. Un `.eq('lead_id')` pelado contesta con
 * VARIAS filas — `maybeSingle` tira y el portal del cliente deja de abrir el día que se invita a un
 * líder — o, en un update, le escribe a todos (marcar la invitación del líder como la del cliente).
 */
const conArea = <Q>(q: Q, area: string | null): Q => {
  const b = q as unknown as { is: (c: string, v: null) => Q; eq: (c: string, v: string) => Q };
  return area == null ? b.is('area', null) : b.eq('area', area);
};

/** El acceso de un cliente (o del líder de un área), sin crearlo. `null` = nunca se le dio. */
export async function accesoDe(leadId: number, area: string | null = null): Promise<EstadoAcceso | null> {
  const f = await filaDeAcceso(leadId, area);
  return f ? aEstado(f) : null;
}

async function filaDeAcceso(leadId: number, area: string | null): Promise<FilaAcceso | null> {
  const db = await getTenantDb();
  const { data, error } = await conArea(db.from('curso_accesos').select(COLS_ACCESO).eq('lead_id', leadId), area).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as FilaAcceso | null) ?? null;
}

/** Los accesos de los LÍDERES de un cliente, en el orden en que se crearon. */
export async function accesosDeLideres(leadId: number): Promise<EstadoAccesoLider[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_accesos').select(COLS_ACCESO)
    .eq('lead_id', leadId).not('area', 'is', null).order('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaAcceso[]).map((f) => ({ ...aEstado(f), id: Number(f.id), area: f.area ?? '' }));
}

/** Crea la fila del acceso si no estaba. Nunca pisa una que ya existe (su versión, su revocación). */
async function asegurarAcceso(leadId: number, area: string | null, porQuien: string | null): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_accesos')
    .upsert([{ lead_id: leadId, area, creado_por: porQuien }], { onConflict: CONFLICTO_ACCESO, ignoreDuplicates: true });
  // Un upsert caído no es «acceso cortado»: es un fallo, y tira.
  if (error) throw new Error(error.message);
}

/**
 * El link del cliente, creando su acceso si no lo tiene. `null` = está REVOCADO (no se le manda un
 * link que no abre) o no hay secreto para firmar.
 *
 * ⚠️ EL WORKSPACE DE LA FIRMA ES EL DEL CONTEXTO: quien llama tiene que estar adentro del
 * workspace del cliente (sesión, `runWithWorkspace`). Lo lee de `curso_accesos` recién escrito
 * para no deducirlo.
 */
export async function linkDeAcceso(leadId: number, ws: number, porQuien: string | null = null): Promise<string | null> {
  await asegurarAcceso(leadId, null, porQuien);
  const a = await accesoDe(leadId);
  if (!a || a.revocado) return null;
  const token = firmarAccesoCurso({ ws, leadId, version: a.version });
  return token ? urlDeToken(token) : null;
}

/**
 * El link del cliente SIN CREAR su acceso. `null` = nunca se le dio, está revocado o no hay secreto.
 *
 * Lo usa el recordatorio de clases (#780, lib/curso-mensajes.ts), que sólo le escribe a quien YA
 * fue invitado o ya entró: un mensaje automático no le abre una puerta a nadie. Misma firma que
 * `linkDeAcceso` (la versión vigente), así que el link es el mismo que ya tiene.
 *
 * ⚠️ El workspace es el del contexto, igual que en `linkDeAcceso`.
 */
export async function linkDeAccesoExistente(leadId: number, ws: number): Promise<string | null> {
  const a = await accesoDe(leadId);
  if (!a || a.revocado) return null;
  const token = firmarAccesoCurso({ ws, leadId, version: a.version });
  return token ? urlDeToken(token) : null;
}

/**
 * El link del LÍDER de un área, creando su acceso si no lo tiene (#665). `null` = está REVOCADO o no
 * hay secreto. Mismo contrato que `linkDeAcceso`.
 *
 * ⚠️ QUE EL ÁREA SEA DEL CLIENTE LO MIRA QUIEN LLAMA (la action de la ficha, contra sus áreas
 * declaradas): acá sólo se normaliza, para que el nombre que se guarda sea la misma clave que usa
 * `curso_progreso.area`.
 */
export async function linkDeAccesoLider(leadId: number, ws: number, area: string, porQuien: string | null = null): Promise<string | null> {
  const nombre = nombreDeArea(area);
  if (!nombre) throw new Error('falta el área');
  await asegurarAcceso(leadId, nombre, porQuien);
  const f = await filaDeAcceso(leadId, nombre);
  if (!f || f.revocado_at) return null;
  const token = firmarAccesoLider({ ws, leadId, acceso: Number(f.id), version: f.version });
  return token ? urlDeToken(token) : null;
}

/** El link de un líder YA creado, firmado al leer (no escribe). `null` = cortado o sin secreto. */
export function linkDeLiderLeido(a: EstadoAccesoLider, ws: number, leadId: number): string | null {
  if (a.revocado) return null;
  const token = firmarAccesoLider({ ws, leadId, acceso: a.id, version: a.version });
  return token ? urlDeToken(token) : null;
}

/** La URL pública del portal para un token. Sin `?ws=`: el workspace viaja adentro de la firma. */
export const urlDeToken = (token: string): string => linkApp(`/compartido/curso/${token}`, null);

/**
 * Deja escrito que la invitación SALIÓ: a qué dirección, cuándo y quién. Lo llama quien manda el
 * mail DESPUÉS de que el envío contestó bien — nunca antes, o «Invitado» mentiría sobre un mail que
 * no llegó (el falso éxito que tienen los avisos de aprobación de agencia).
 *
 * `area` null = la del cliente. ⚠️ El email de un líder NUNCA lo lee el login con Google
 * (`accesoInvitadoPorEmail` filtra `area is null`): si lo leyera, el líder entraría como el cliente.
 */
export async function marcarInvitacion(leadId: number, email: string, porQuien: string | null, area: string | null = null): Promise<void> {
  const db = await getTenantDb();
  // `invitando_at: null`: el reclamo de la invitación sin sesión (`reclamarInvitacion`) se suelta
  // en la misma escritura que dice que salió — con dos escrituras, un fallo entre las dos dejaría
  // la fila reclamada (y otro disparo esperando 5 minutos) sobre una invitación ya anotada.
  const { error } = await conArea(db.from('curso_accesos')
    .update({ email: email.trim().toLowerCase(), invitacion_enviada_at: new Date().toISOString(), invitado_por: porQuien, invitando_at: null })
    .eq('lead_id', leadId), area);
  if (error) throw new Error(error.message);
}

// ── El reclamo de la invitación sin sesión (mig 0219) ─────────────────────────

/** Cuánto vale un reclamo. Un envío que murió a mitad no puede dejar al cliente sin invitación para siempre. */
const RECLAMO_MS = 5 * 60_000;

/**
 * Reclama la invitación del CLIENTE para mandarla UNA vez. `true` = es tuya: nadie la mandó
 * todavía (`invitacion_enviada_at` null) y nadie la está mandando (sin reclamo, o uno vencido).
 *
 * ⚠️ COMPARE-AND-SET EN EL WHERE, no un «leer y después escribir»: dos disparos del mismo «pasó a
 * Ganado» (lib/curso-invitar.ts lo explica) leían los dos «sin invitar» y mandaban dos mails. Acá
 * el segundo no encuentra la fila. La fila tiene que existir (la crea `linkDeAcceso` antes).
 */
export async function reclamarInvitacion(leadId: number, ahora: Date = new Date()): Promise<boolean> {
  const db = await getTenantDb();
  const vencido = new Date(ahora.getTime() - RECLAMO_MS).toISOString();
  const { data, error } = await db.from('curso_accesos')
    .update({ invitando_at: ahora.toISOString() })
    .eq('lead_id', leadId).is('area', null).is('revocado_at', null).is('invitacion_enviada_at', null)
    .or(`invitando_at.is.null,invitando_at.lt.${vencido}`)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Suelta el reclamo sin anotar nada (el mail no salió): el próximo intento puede mandarla. No tira. */
export async function soltarInvitacion(leadId: number): Promise<void> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('curso_accesos').update({ invitando_at: null }).eq('lead_id', leadId).is('area', null);
    if (error) throw new Error(error.message);
  } catch (e) {
    // Si no se pudo soltar, vence solo a los 5 minutos: se dice y se sigue.
    console.warn('[curso] no pude soltar el reclamo de la invitación:', e instanceof Error ? e.message : e);
  }
}

// ── Los permisos del alumno (mig 0219) ────────────────────────────────────────

/**
 * Guarda el ALCANCE del cliente (qué módulos ve), creando su acceso si no lo tenía: darle permisos a
 * alguien antes de invitarlo es un orden legítimo, y la fila es donde viven.
 *
 * ⚠️ QUÉ CLAVES EXISTEN LO VALIDA QUIEN LLAMA (`alcanceValido`, contra los módulos de SUS
 * productos): acá sólo se sanea la forma, que es lo único que esta capa sabe. Devuelve lo que
 * quedó en la base, releído: la pantalla pinta eso y no lo que pidió.
 */
export async function guardarAlcance(leadId: number, alcance: AlcanceCurso, porQuien: string | null = null): Promise<AlcanceCurso> {
  await asegurarAcceso(leadId, null, porQuien);
  const db = await getTenantDb();
  const { error } = await db.from('curso_accesos').update({ alcance: saneaAlcance(alcance) }).eq('lead_id', leadId).is('area', null);
  if (error) throw new Error(error.message);
  return (await accesoDe(leadId))?.alcance ?? null;
}

// ── Entrar con el email (mig 0219): el link mágico de /login ──────────────────

/** No se emite más de un link por minuto por acceso, y lo cuenta la base (el rate limit en memoria es por instancia). */
const LINK_MAGICO_ESPERA_MS = 60_000;

/**
 * Emite el nonce de un link de entrada por email para el acceso DEL CLIENTE en esa versión.
 * `null` = no se emite: no está vigente (revocado, otra versión) o ya se mandó uno hace menos de un
 * minuto. Reemplaza al anterior: el link que se haya mandado antes deja de abrir.
 *
 * ⚠️ COMPARE-AND-SET con la espera en el WHERE: dos pedidos a la vez no mandan dos mails.
 */
export async function emitirLinkMagico(leadId: number, version: number, ahora: Date = new Date()): Promise<string | null> {
  const db = await getTenantDb();
  const nonce = crypto.randomBytes(18).toString('base64url');
  const antes = new Date(ahora.getTime() - LINK_MAGICO_ESPERA_MS).toISOString();
  const { data, error } = await db.from('curso_accesos')
    .update({ link_magico_nonce: nonce, link_magico_at: ahora.toISOString() })
    .eq('lead_id', leadId).is('area', null).eq('version', version).is('revocado_at', null)
    .or(`link_magico_at.is.null,link_magico_at.lt.${antes}`)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length ? nonce : null;
}

/**
 * Consume el link: `true` = era el vigente y se acaba de gastar (nadie más puede entrar con él).
 *
 * ⚠️ UN SOLO USO POR CONSTRUCCIÓN: el update pide el nonce en el WHERE y lo borra. Dos clics, dos
 * pestañas o el mail reenviado a otra persona: el segundo no encuentra la fila. Y la versión y el
 * «no revocado» también van en el WHERE: cortar el acceso entre que se pidió y se usó, lo corta.
 */
export async function consumirLinkMagico(leadId: number, version: number, nonce: string): Promise<boolean> {
  if (!nonce || nonce.length < 16 || nonce.length > 64) return false;
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_accesos')
    .update({ link_magico_nonce: null })
    .eq('lead_id', leadId).is('area', null).eq('version', version).is('revocado_at', null)
    .eq('link_magico_nonce', nonce)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * Corta un acceso: sube la versión (todos los links mandados dejan de abrir) y lo marca revocado.
 *
 * ⚠️ CORTAR AL CLIENTE (`area` null) CORTA TAMBIÉN A SUS LÍDERES: el que corta está diciendo «este
 * cliente ya no entra», y los líderes son su gente. Volver a habilitarlo NO los habilita: cada líder
 * vuelve con su «Volver a habilitar» y con un link NUEVO (su versión también subió). Cortar a un
 * líder corta sólo a ése.
 *
 * ⚠️ ESTO SÓLO ALCANZA A LOS LÍDERES QUE EXISTEN AL CORTAR. Los que nazcan o se habiliten mientras el
 * cliente siga cortado los frenan otras dos puertas: `resolverAccesoPortal` (no abre el `c2.` de un
 * cliente cortado) y las actions de la ficha (no crean ni habilitan un líder de un cliente cortado).
 */
export async function revocarAcceso(leadId: number, area: string | null = null): Promise<void> {
  const db = await getTenantDb();
  const filas = area == null
    ? [await filaDeAcceso(leadId, null), ...(await accesosDeLideres(leadId)).filter((l) => !l.revocado).map((l) => ({ id: l.id, version: l.version }))]
    : [await filaDeAcceso(leadId, area)];
  const ahora = new Date().toISOString();
  for (const f of filas) {
    if (!f) continue;
    const { error } = await db.from('curso_accesos').update({ version: f.version + 1, revocado_at: ahora }).eq('id', f.id).eq('lead_id', leadId);
    if (error) throw new Error(error.message);
  }
}

/** Lo vuelve a habilitar con un link NUEVO (la versión ya subió al revocar). Sólo ESE acceso. */
export async function reactivarAcceso(leadId: number, area: string | null = null): Promise<void> {
  const db = await getTenantDb();
  const { error } = await conArea(db.from('curso_accesos').update({ revocado_at: null }).eq('lead_id', leadId), area);
  if (error) throw new Error(error.message);
}

/**
 * Lo que abre un token del cliente, con sus PERMISOS (mig 0219): `alcance` = qué módulos ve
 * (`null` = todo). Lo aplica el portal en la misma puerta que los bloqueos (lib/curso-alcance.ts).
 */
export type AccesoResuelto = AccesoCurso & { alcance: AlcanceCurso };

/**
 * ¿Este token abre? Verifica la firma y, ADENTRO del workspace que dice la firma, que la versión
 * siga vigente, que no esté revocado y que el lead siga siendo un cliente ganado.
 *
 * ⚠️ SÓLO EL ACCESO DEL CLIENTE (`c1.`, la fila con `area` null). Lo usan la entrada del mail —que
 * deja la cookie del alumno— y la cookie misma: un líder que pasara por acá quedaría con la cookie
 * DEL CLIENTE. El portal, que sí abre los dos, usa `resolverAccesoPortal`.
 *
 * ⚠️ Quien llama envuelve en `runWithWorkspace(leerAccesoCurso(token).ws, …)`: acá se usa
 * `getTenantDb`, así que fuera de ese contexto miraría otro inquilino y contestaría que no.
 */
export async function resolverAcceso(token: string): Promise<AccesoResuelto | null> {
  const a = leerAccesoCurso(token);
  if (!a) return null;
  const db = await getTenantDb();
  const [{ data: acc, error: e1 }, { data: lead, error: e2 }] = await Promise.all([
    // `alcance` viaja en la MISMA lectura que decide si abre: es de la misma fila y del mismo
    // momento. Leerlo aparte sería una segunda consulta que puede contestar otra cosa.
    db.from('curso_accesos').select('version, revocado_at, alcance').eq('lead_id', a.leadId).is('area', null).maybeSingle(),
    db.from('leads').select('id').eq('id', a.leadId).eq('estado_lead', 'ganado').maybeSingle(),
  ]);
  // ⚠️ Un error de base no es «este link ya no está activo»: tira, y la página muestra su fallo.
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const f = acc as { version: number; revocado_at: string | null; alcance?: unknown } | null;
  if (!f || f.revocado_at || f.version !== a.version || !lead) return null;
  return { ...a, alcance: saneaAlcance(f.alcance) };
}

/**
 * Quién abre el PORTAL con este token: el cliente (`area` null) o el líder de un área (#665).
 * `null` = no abre. Tira si la base no contesta (igual que `resolverAcceso`).
 *
 * Para un líder (`c2.`), en la base y adentro del workspace de la firma: que su fila exista, sea de
 * ESE lead, tenga área, la versión siga vigente y no esté revocada, y que el lead siga ganado. El
 * ÁREA SALE DE LA FILA, nunca del link ni del pedido: es lo que decide qué clases ve.
 *
 * ⚠️ Y QUE EL CLIENTE NO ESTÉ CORTADO. `revocarAcceso(lead)` corta a los líderes que existen en ese
 * momento, y nada más: un líder creado después (un «Copiar link» de su área) o vuelto a habilitar
 * nacía con su fila sana y entraba a escribir tareas de un cliente que dejó de pagar. La pregunta
 * «¿el cliente sigue adentro?» se hace ACÁ, en cada pedido, y no sólo al cortar. Sin fila del cliente
 * (nunca se le dio acceso a él, sólo a su líder) no hay nada cortado: el líder entra.
 */
/**
 * `alcance` (mig 0219): los módulos que ve quien abre. ⚠️ ES SIEMPRE EL DEL CLIENTE, también para
 * su LÍDER de área: los permisos se le dan a la persona que compró, y su gente ve, dentro de lo
 * suyo (las clases por área), sólo los módulos que el cliente tiene abiertos. Un líder con un
 * alcance propio sería una segunda pantalla de permisos que nadie pidió.
 */
export type AccesoPortal = { ws: number; leadId: number; area: string | null; accesoId: number | null; alcance: AlcanceCurso };
export async function resolverAccesoPortal(token: string): Promise<AccesoPortal | null> {
  const lider = leerAccesoLider(token);
  if (!lider) {
    const a = await resolverAcceso(token);
    return a ? { ws: a.ws, leadId: a.leadId, area: null, accesoId: null, alcance: a.alcance } : null;
  }
  const db = await getTenantDb();
  const [{ data: acc, error: e1 }, { data: lead, error: e2 }, { data: delCliente, error: e3 }] = await Promise.all([
    db.from('curso_accesos').select('id, area, version, revocado_at')
      .eq('id', lider.acceso).eq('lead_id', lider.leadId).not('area', 'is', null).maybeSingle(),
    db.from('leads').select('id').eq('id', lider.leadId).eq('estado_lead', 'ganado').maybeSingle(),
    db.from('curso_accesos').select('revocado_at, alcance').eq('lead_id', lider.leadId).is('area', null).maybeSingle(),
  ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);
  const f = acc as { id: number; area: string | null; version: number; revocado_at: string | null } | null;
  const cliente = delCliente as { revocado_at: string | null; alcance?: unknown } | null;
  const area = nombreDeArea(f?.area);
  if (!f || !area || f.revocado_at || f.version !== lider.version || !lead) return null;
  if (cliente?.revocado_at) return null;
  return { ws: lider.ws, leadId: lider.leadId, area, accesoId: Number(f.id), alcance: saneaAlcance(cliente?.alcance) };
}

/** Cuenta un ingreso al portal, en el acceso de quien entró. No tira: un contador que falla no puede cerrarle la puerta. */
export async function contarIngreso(leadId: number, area: string | null = null): Promise<void> {
  try {
    const db = await getTenantDb();
    const a = await accesoDe(leadId, area);
    if (!a) return;
    await conArea(db.from('curso_accesos').update({ ingresos: a.ingresos + 1, ultimo_ingreso_at: new Date().toISOString() }).eq('lead_id', leadId), area);
  } catch (e) {
    console.warn('[curso] no pude contar el ingreso:', e instanceof Error ? e.message : e);
  }
}

// ── Las llamadas de la entrega ────────────────────────────────────────────────

export type Sesion = { id: number; leadId: number; productoId: number | null; fecha: string; nota: string | null; avisoPrevioAt: string | null; avisoPosteriorAt: string | null; avisoMotivo: string | null };

/** Las llamadas de un cliente, de la más próxima a la más vieja. */
export async function sesionesDe(leadId: number): Promise<Sesion[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_sesiones')
    .select('id, lead_id, producto_id, fecha, nota, aviso_previo_at, aviso_posterior_at, aviso_motivo')
    .eq('lead_id', leadId).order('fecha', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    id: Number(f.id), leadId: Number(f.lead_id), productoId: f.producto_id == null ? null : Number(f.producto_id),
    fecha: String(f.fecha), nota: (f.nota as string | null) ?? null,
    avisoPrevioAt: (f.aviso_previo_at as string | null) ?? null, avisoPosteriorAt: (f.aviso_posterior_at as string | null) ?? null,
    avisoMotivo: (f.aviso_motivo as string | null) ?? null,
  }));
}

/** Anota una llamada de la entrega. De acá salen el aviso del día antes y el de después (cron). */
export async function agendarSesion(leadId: number, productoId: number | null, fechaIso: string, nota: string | null = null): Promise<Sesion> {
  const t = Date.parse(fechaIso);
  if (!Number.isFinite(t)) throw new Error('La fecha de la llamada no se entiende.');
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_sesiones')
    .insert([{ lead_id: leadId, producto_id: productoId, fecha: new Date(t).toISOString(), nota: nota?.trim() || null }])
    .select('id, lead_id, producto_id, fecha, nota, aviso_previo_at, aviso_posterior_at, aviso_motivo').single();
  if (error) throw new Error(error.message);
  const f = data as Record<string, unknown>;
  return {
    id: Number(f.id), leadId: Number(f.lead_id), productoId: f.producto_id == null ? null : Number(f.producto_id),
    fecha: String(f.fecha), nota: (f.nota as string | null) ?? null, avisoPrevioAt: null, avisoPosteriorAt: null, avisoMotivo: null,
  };
}

/** Borra una llamada anotada (sólo de ese cliente: el id solo no alcanza). */
export async function borrarSesion(leadId: number, sesionId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_sesiones').delete().eq('id', sesionId).eq('lead_id', leadId);
  if (error) throw new Error(error.message);
}

/**
 * Marca una tarea ENVIADA como revisada por el equipo. No cambia la etapa: la etapa cierra al enviar.
 *
 * ⚠️ EN UNA CLASE POR ÁREA REVISA TODAS SUS ÁREAS a la vez (el filtro es por clase, sin área): la
 * ficha ofrece «Marcar revisada» sobre el estado de la clase entera, que es «enviada» sólo cuando
 * la mandaron todas (`progresoEfectivo`). Revisar un área suelta no existe todavía.
 */
export async function aprobarTarea(leadId: number, claseId: number, aprobada = true): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_progreso')
    .update(aprobada ? { estado: 'aprobada', aprobada_at: new Date().toISOString() } : { estado: 'enviada', aprobada_at: null })
    .eq('lead_id', leadId).eq('clase_id', claseId).in('estado', aprobada ? ['enviada'] : ['aprobada']);
  if (error) throw new Error(error.message);
}

// ── Dónde está el cliente ────────────────────────────────────────────────────

/**
 * Los productos del cliente, con la MISMA regla que el kanban de Customer Success (su casa en
 * el CRM o una fila en `cliente_entrega`). El portal sólo muestra el curso de ésos: un link
 * válido no abre el curso de un producto que el cliente no compró.
 */
export async function productosDelAlumno(leadId: number): Promise<number[]> {
  const { productosDelCliente } = await import('@/app/customer-success/entrega');
  return (await productosDelCliente(leadId)).productos;
}

/**
 * La etapa en la que está HOY el cliente en la entrega de un producto. `null` = no es de ese
 * producto (o el producto no tiene etapas).
 *
 * ⚠️ SIN FILA ESTÁ EN LA PRIMERA ETAPA, no «en ninguna»: es la regla del kanban
 * (`repartirEnEtapas`). Preguntarle sólo a `cliente_entrega` contestaría «ninguna» para los
 * clientes que nunca se movieron — que al arrancar son todos.
 */
export async function etapaActualDe(leadId: number, productoId: number, productosYaLeidos?: readonly number[]): Promise<string | null> {
  return (await ubicacionEnEntregaDe(leadId, productoId, productosYaLeidos)).etapa;
}

/**
 * Lo mismo que `etapaActualDe`, y además si su fila apunta a una etapa BORRADA.
 *
 * `etapa` sigue la regla del curso y del portal: con la etapa borrada, la PRIMERA (el alumno
 * tiene que poder ver algo, y el paso automático decide desde ahí). `borrada` es la CLAVE que
 * dice su fila cuando el catálogo ya no la tiene; `null` si no es el caso.
 *
 * ⚠️ EXISTE PARA QUE LA FICHA NO SE CONTRADIGA. La cabecera de la ficha (FichaEntrega) dice
 * «Etapa borrada» para ese cliente y la pestaña Curso, leyendo sólo `etapaActualDe`, marcaba
 * «Actual» la primera etapa: la misma pantalla diciendo dos cosas del mismo cliente. El equipo
 * necesita ver el hecho (está en una etapa que ya no existe: hay que moverlo); el alumno, no.
 * Por eso son dos campos y no un cambio de la regla: la regla la usan el portal, los mensajes y
 * el paso automático, y ésos siguen igual.
 */
export async function ubicacionEnEntregaDe(leadId: number, productoId: number, productosYaLeidos?: readonly number[]): Promise<{ etapa: string | null; borrada: string | null }> {
  // `productosYaLeidos`: quien ya los tiene (la ficha, el portal) los pasa. Leerlos son dos
  // rondas de consultas (catálogo, embudos, filas), y repetirlas por producto alargaba la ficha.
  const [{ entregaDeProductoEstricta, entregaDeCliente }, { entregaPorDefecto }, productos] = await Promise.all([
    import('./entrega-servicio'),
    import('./servicio-etapas'),
    productosYaLeidos ?? productosDelAlumno(leadId),
  ]);
  if (!productos.includes(productoId)) return { etapa: null, borrada: null };
  const [leida, fila] = await Promise.all([entregaDeProductoEstricta(productoId), entregaDeCliente(leadId, productoId)]);
  // `leida ?? default` es EXACTAMENTE lo que contesta `entregaDeProducto`: la `etapa` sale igual
  // que siempre. La lectura estricta es para `borrada`, de abajo.
  const cfg = leida ?? entregaPorDefecto(productoId);
  if (fila && cfg.etapas.some((e) => e.key === fila.etapa)) return { etapa: fila.etapa, borrada: null };
  // ⚠️ «BORRADA» SÓLO CON EL CATÁLOGO LEÍDO. Con la lectura caída, `cfg` son las etapas de
  // fábrica y CUALQUIER clave declarada «no está»: se afirmaría una etapa borrada sobre un
  // cliente que está bien. No poder leer no es un valor del dato.
  return { etapa: cfg.etapas[0]?.key ?? null, borrada: fila && leida ? fila.etapa : null };
}
