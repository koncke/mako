// =============================================================================
// todo — tablero kanban de tareas (ruta /todo)
// =============================================================================
// Tareas que nacen de una Retro ("hacé esto"), de un experimento, o a mano.
// AMBOS EJES: columnas de estado (lib/todo-estados.ts) para el drag, y por
// tarjeta: prioridad, avance % (progreso), deadline, categorías (multi) y nota.
// `orden` (float) ordena dentro de la columna e inserta entre dos sin renumerar.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { quarterDeFecha } from '@/app/plan/board/cuando';
import {
  esEstado, esResponsableTipo, estadoTrasProgreso,
  type EstadoTarea, type ResponsableTipo, type CriterioVeredicto,
} from './todo-estados';

export type { EstadoTarea, ResponsableTipo, CriterioVeredicto };

export type Prioridad = 'alta' | 'media' | 'baja' | 'futuro';
export type OrigenTarea = 'manual' | 'mako' | 'retro' | 'experimento';
// Espeja app/plan/board/types.ts: 'ia' = MaKo (la IA del producto), 'code' = Claude
// Code (el agente de desarrollo). En el board del CLIENTE 'code' no se genera —
// ningún dev le escribe tarjetas— pero el tipo lo acepta para que una entrada así
// no se degrade a 'user' al leerla (diría que la escribió el cliente: peor mentira).
export type Actor = 'user' | 'ia' | 'code';
export type ChecklistItem = { id: string; text: string; done: boolean };
export type HistUndo = { field: string; prev: unknown };
export type HistEntry = { id: string; ts: number; actor: Actor; text: string; undo?: HistUndo; kind?: 'task' };

const origenActor = (o: OrigenTarea): Actor => (o === 'manual' ? 'user' : 'ia');

export type Tarea = {
  id: number;
  titulo: string;
  detalle: string | null;        // nota
  estado: EstadoTarea;
  prioridad: Prioridad;
  progreso: number;              // 0-100
  deadline: string | null;       // YYYY-MM-DD
  /** Quarter planificado, `2026-Q3`. NO se deriva del deadline (mig 0156). */
  quarter: string | null;
  /** «Se repite para siempre»: no compite por un puesto ni lleva fecha (mig 0163). */
  recurrente: boolean;
  categorias: number[];          // ids de tarea_categorias
  checklist: ChecklistItem[];    // ítems {id,text,done}
  historial: HistEntry[];        // change history {ts,actor,text} — user|ia
  en_prioridad: boolean;         // marcada "En prioridad" (vista Prioridades)
  score: number;                 // 1-100 del guardián (define la columna)
  score_razon: string | null;    // por qué el guardián le puso ese score
  origen: OrigenTarea;
  /** de dónde salió: {tipo, etiqueta, url}. La url puede traer ?timestamp=<seg>. */
  fuente: { tipo: string; etiqueta?: string; url?: string } | null;
  experimento_id: number | null;
  retro_id: number | null;
  orden: number;
  hecho_at: string | null;
  created_at: string;
  updated_at: string;
  // ── QUIÉN (mig 0159). null = no se sabe, que NO es lo mismo que «es mía». ──
  responsable: string | null;
  responsable_email: string | null;
  responsable_tipo: ResponsableTipo | null;
  /** cliente de la reunión de la que salió: la etiqueta de ORIGEN, no el proyecto. */
  cliente_nombre: string | null;
  cliente_lead_id: number | null;
  tema: string | null;
  // ── EL CRITERIO (mig 0159). Lo escribe el juez; mover la tarjeta NO lo cambia. ──
  criterio_veredicto: CriterioVeredicto | null;
  criterio_regla: string | null;
  criterio_razon: string | null;
  cita: string | null;
};

/** Los campos de QUIÉN: los escribe la extracción y los puede corregir una persona. */
export type CamposResponsable = Partial<Pick<Tarea,
  'responsable' | 'responsable_email' | 'responsable_tipo' | 'cliente_nombre' | 'cliente_lead_id' | 'tema'>>;
/** Los del CRITERIO: solo en el alta. Son lo que dijo el juez; una persona no los edita. */
export type CamposCriterio = Partial<Pick<Tarea, 'criterio_veredicto' | 'criterio_regla' | 'criterio_razon' | 'cita'>>;

export type Categoria = { id: number; nombre: string; color: string; emoji: string; prioridad: number; score_razon: string | null; deadline: string | null; /** `2026-Q3`; se deriva del deadline cuando está vacío (mig 0162). */ quarter: string | null;
  /**
   * «Se repite para siempre» a nivel PROYECTO (mig 0164): Customer Success, las reuniones
   * de marketing. No lleva deadline ni quarter y no compite por un puesto.
   *
   * ⚠️ ESTA ES LA MITAD DEL CLIENTE, Y ES LA QUE SE OLVIDÓ LA VEZ PASADA. `BoardShell` es
   * UNO y lo montan los dos tableros; si la columna, el mapper y el `upd` de acá no nombran
   * el campo, el control se dibuja en el tablero de Mauricio y no guarda nada — que en este
   * repo ya se leyó dos veces como que la app está rota.
   */
  recurrente: boolean; detalle: string; historial: HistEntry[]; created_at: string };

const COLS = '*';
const rowTo = (r: Record<string, unknown>): Tarea => {
  const t = r as unknown as Tarea;
  // categorias viene como jsonb → array; blindamos a number[].
  const cats = (r.categorias as unknown);
  t.categorias = Array.isArray(cats) ? cats.map(Number).filter((n) => Number.isFinite(n)) : [];
  t.progreso = clampPct((r.progreso as number) ?? 0);
  t.checklist = checklistOk(r.checklist);
  t.historial = histOk(r.historial);
  t.en_prioridad = !!r.en_prioridad;
  // `!!` y no el valor crudo: `rowTo` castea la fila entera, así que un campo ausente
  // llegaría como `undefined` y cualquier `if (t.recurrente)` lo leería como false igual —
  // pero el tipo diría `boolean` y mentiría. Acá se normaliza una vez.
  t.recurrente = !!r.recurrente;
  t.score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  t.score_razon = typeof r.score_razon === 'string' && r.score_razon.trim() ? (r.score_razon as string) : null;
  t.estado = estadoOk(r.estado);
  t.responsable = txtOk(r.responsable);
  t.responsable_email = txtOk(r.responsable_email);
  t.responsable_tipo = esResponsableTipo(r.responsable_tipo) ? r.responsable_tipo : null;
  t.cliente_nombre = txtOk(r.cliente_nombre);
  t.cliente_lead_id = leadIdOk(r.cliente_lead_id);
  t.tema = txtOk(r.tema);
  t.criterio_veredicto = veredictoOk(r.criterio_veredicto);
  t.criterio_regla = txtOk(r.criterio_regla);
  t.criterio_razon = txtOk(r.criterio_razon);
  t.cita = txtOk(r.cita);
  return t;
};

// estado derivado del avance: 100→hecho, >0→en_curso, 0→por_hacer.
// score representativo de cada columna, para tareas nuevas (hasta que el guardián puntúe).
const scoreDePrioridad = (p: Prioridad): number => ({ alta: 85, media: 62, baja: 37, futuro: 12 }[p] ?? 62);

const checklistOk = (c: unknown): ChecklistItem[] =>
  Array.isArray(c)
    ? c.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((o) => ({ id: String(o.id ?? ''), text: String(o.text ?? ''), done: !!o.done }))
        .filter((i) => i.id)
    : [];
const histOk = (h: unknown): HistEntry[] =>
  Array.isArray(h)
    ? h.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((o) => {
          const ts = Number(o.ts) || 0;
          // La autoría se preserva tal cual: degradar un 'code' a 'user' diría que el
          // cambio lo hizo el cliente, que es peor mentira que no saber quién fue.
          const actor: Actor = o.actor === 'ia' ? 'ia' : o.actor === 'code' ? 'code' : 'user';
          const e: HistEntry = { id: typeof o.id === 'string' && o.id ? o.id : 'h' + ts, ts, actor, text: String(o.text ?? '') };
          const u = o.undo as Record<string, unknown> | undefined;
          if (u && typeof u === 'object' && typeof u.field === 'string') e.undo = { field: u.field, prev: u.prev };
          if (o.kind === 'task') e.kind = 'task';
          return e;
        })
    : [];

function clampPct(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

const estadoOk = (e: unknown): EstadoTarea => (esEstado(e) ? e : 'por_hacer');
/** texto con contenido o null: un '' guardado se leería como «hay responsable». */
const txtOk = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);
/** resolverClienteDeReunion devuelve leadId 0 cuando el cliente es un WORKSPACE, no un
 *  lead: 0 no es un lead, y guardarlo rompería la FK a leads. */
const leadIdOk = (n: unknown): number | null => {
  const v = Number(n);
  return Number.isInteger(v) && v > 0 ? v : null;
};
const veredictoOk = (v: unknown): CriterioVeredicto | null => (v === 'cumple' || v === 'no_cumple' ? v : null);
/** Los de QUIÉN, saneados, SOLO los que vinieron: `undefined` no toca la columna. */
function camposResponsableOk(p: CamposResponsable): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (p.responsable !== undefined) o.responsable = txtOk(p.responsable);
  if (p.responsable_email !== undefined) o.responsable_email = txtOk(p.responsable_email)?.toLowerCase() ?? null;
  if (p.responsable_tipo !== undefined) o.responsable_tipo = esResponsableTipo(p.responsable_tipo) ? p.responsable_tipo : null;
  if (p.cliente_nombre !== undefined) o.cliente_nombre = txtOk(p.cliente_nombre);
  if (p.cliente_lead_id !== undefined) o.cliente_lead_id = leadIdOk(p.cliente_lead_id);
  if (p.tema !== undefined) o.tema = txtOk(p.tema);
  return o;
}
const prioridadOk = (p: unknown): Prioridad =>
  p === 'alta' || p === 'baja' || p === 'futuro' ? p : 'media';
const origenOk = (o: unknown): OrigenTarea =>
  o === 'mako' || o === 'retro' || o === 'experimento' ? o : 'manual';
const dateOk = (d: unknown): string | null =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
/**
 * El Quarter, `AAAA-QN`. Lo que no matchee entra como null.
 *
 * ⚠️ EL SANEO NO ES PROLIJIDAD. Un string libre guardado acá deja la tarea en una
 * ventana que ninguna vista sabe leer, y el síntoma no es un error: es que la tarea
 * desaparece de todos los filtros de tiempo sin que nada lo diga.
 */
const quarterOk = (q: unknown): string | null =>
  typeof q === 'string' && /^\d{4}-Q[1-4]$/.test(q.trim()) ? q.trim() : null;
/**
 * El Quarter elegido, o el que le toca por su deadline. SÓLO rellena lo vacío: el que
 * alguien eligió a mano no se pisa nunca — la pantalla avisa si no coinciden.
 * Gemelo de `quarterEfectivo` en `lib/plan-board.ts`, que hace lo mismo del lado del dueño.
 */
const quarterDeDeadline = (q: unknown, deadline: unknown): string | null =>
  quarterOk(q) ?? (typeof deadline === 'string' ? (quarterDeFecha(deadline) || null) : null);
const catsOk = (c: unknown): number[] =>
  Array.isArray(c) ? c.map(Number).filter((n) => Number.isFinite(n)) : [];

/**
 * Las tareas que nacieron de UNA retro. Es el insumo de la rendición de cuentas:
 * la Retro necesita saber qué pasó DE VERDAD con lo que propuso la vez pasada, no
 * si tocaste "Aceptar". Scopeada por workspace como todo lo demás (getTenantDb).
 */
export async function listTareasDeRetro(retroId: number): Promise<Tarea[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('experimento_tareas').select(COLS).eq('retro_id', retroId);
  if (error) throw new Error(`listTareasDeRetro: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(rowTo);
}

export async function listTareas(): Promise<Tarea[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase
    .from('experimento_tareas')
    .select(COLS)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listTareas: ${error.message}`);
  return (data ?? []).map(rowTo);
}

export type NuevaTarea = {
  titulo: string;
  detalle?: string | null;
  estado?: EstadoTarea;
  prioridad?: Prioridad;
  progreso?: number;
  deadline?: string | null;
  /** «Se repite para siempre» (mig 0163). Nace sin fecha: ver `crearTarea`. */
  recurrente?: boolean;
  categorias?: number[];
  origen?: OrigenTarea;
  /** de dónde salió (reunión de Fathom con su minuto, WhatsApp, archivo…). */
  fuente?: { tipo: string; etiqueta?: string; url?: string } | null;
  experimento_id?: number | null;
  retro_id?: number | null;
} & CamposResponsable & CamposCriterio;

/** Orden para el tope de una columna (las nuevas entran arriba). */
async function ordenTope(estado: EstadoTarea): Promise<number> {
  const supabase = (await getTenantDb());
  const { data } = await supabase
    .from('experimento_tareas')
    .select('orden')
    .eq('estado', estado)
    .order('orden', { ascending: true })
    .limit(1);
  const min = data && data.length ? Number((data[0] as { orden: number }).orden) : 0;
  return min - 1;
}

export async function crearTarea(input: NuevaTarea): Promise<Tarea> {
  const estado = estadoOk(input.estado);
  const origen = origenOk(input.origen);
  const fila = {
    titulo: (input.titulo || '').trim() || 'Tarea',
    detalle: input.detalle ?? null,
    estado,
    prioridad: prioridadOk(input.prioridad),
    progreso: input.progreso != null ? clampPct(input.progreso) : 0,
    // ⚠️ UNA RECURRENTE NACE SIN FECHA. La misma regla que `editarTarea`, acá arriba del
    // insert: si entra con deadline, el motor de vencimientos la hace titilar para siempre
    // pidiendo que se cierre algo que por definición no cierra.
    deadline: input.recurrente ? null : dateOk(input.deadline),
    recurrente: !!input.recurrente,
    categorias: catsOk(input.categorias),
    checklist: [] as ChecklistItem[],
    historial: [{ id: 'h' + Date.now(), ts: Date.now(), actor: origenActor(origen), text: 'Creó la tarjeta' }] as HistEntry[],
    en_prioridad: false,
    fuente: input.fuente ?? null,
    score: scoreDePrioridad(prioridadOk(input.prioridad)),
    origen,
    experimento_id: input.experimento_id ?? null,
    retro_id: input.retro_id ?? null,
    orden: await ordenTope(estado),
    updated_at: new Date().toISOString(),
    // ⚠️ Esta lista es una de las TRES que se comían los campos nuevos de la
    // extracción (docs/hallazgos-plan.md): lo que no se copia acá no llega a la fila.
    ...camposResponsableOk(input),
    criterio_veredicto: veredictoOk(input.criterio_veredicto),
    criterio_regla: txtOk(input.criterio_regla),
    criterio_razon: txtOk(input.criterio_razon),
    cita: txtOk(input.cita),
  };
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').insert(fila).select(COLS).single();
  if (error) throw new Error(`crearTarea: ${error.message}`);
  return rowTo(data);
}

/** Alta en lote (desde una Retro o un experimento). Devuelve cuántas creó.
 *  `categorias` por ítem: sin esto el lote insertaba SIEMPRE `[]` hardcodeado, así que
 *  todo lo que entra por acá nacía sin proyecto — y ninguna tarea debería. */
export async function crearTareasDesde(
  items: Array<{ titulo: string; detalle?: string | null; prioridad?: Prioridad; categorias?: number[] }>,
  meta: { origen: OrigenTarea; retro_id?: number | null; experimento_id?: number | null },
): Promise<number> {
  const base = await ordenTope('por_hacer');
  const validos = items.filter((it) => (it.titulo || '').trim());
  const n = validos.length;
  // item[0] queda con el orden MENOR → arriba (la columna ordena ascendente),
  // preservando el orden de prioridad con el que MaKo/Retro entregan el lote.
  const filas = validos.map((it, i) => ({
    titulo: it.titulo.trim(),
    detalle: it.detalle ?? null,
    estado: 'por_hacer' as EstadoTarea,
    prioridad: prioridadOk(it.prioridad),
    progreso: 0,
    deadline: null,
    categorias: catsOk(it.categorias ?? []),
    checklist: [] as ChecklistItem[],
    historial: [{ id: 'h' + Date.now() + i, ts: Date.now(), actor: 'ia' as Actor, text: 'Creó la tarjeta' }] as HistEntry[],
    score: scoreDePrioridad(prioridadOk(it.prioridad)),
    origen: origenOk(meta.origen),
    retro_id: meta.retro_id ?? null,
    experimento_id: meta.experimento_id ?? null,
    orden: base - (n - i),
    updated_at: new Date().toISOString(),
  }));
  if (!filas.length) return 0;
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('experimento_tareas').insert(filas);
  if (error) throw new Error(`crearTareasDesde: ${error.message}`);
  return filas.length;
}

/** Mueve una tarea de columna y/o la reordena. Al pasar a 'hecho' completa el avance. */
export async function moverTarea(id: number, estado: EstadoTarea, orden?: number, historial?: HistEntry[]): Promise<Tarea> {
  const est = estadoOk(estado);
  const patch: Record<string, unknown> = {
    estado: est,
    orden: orden ?? (await ordenTope(est)),
    hecho_at: est === 'hecho' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (est === 'hecho') patch.progreso = 100;
  if (historial !== undefined) patch.historial = histOk(historial);
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').update(patch).eq('id', id).select(COLS).single();
  if (error) throw new Error(`moverTarea: ${error.message}`);
  return rowTo(data);
}

export async function editarTarea(
  id: number,
  patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; quarter?: string | null; recurrente?: boolean; categorias?: number[]; checklist?: ChecklistItem[]; historial?: HistEntry[]; en_prioridad?: boolean; score?: number; score_razon?: string | null; fuente?: { tipo: string; etiqueta?: string; url?: string } | null } & CamposResponsable,
): Promise<Tarea> {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString(), ...camposResponsableOk(patch) };
  if (patch.titulo != null) upd.titulo = patch.titulo.trim() || 'Tarea';
  if (patch.detalle !== undefined) upd.detalle = patch.detalle;
  if (patch.prioridad != null) upd.prioridad = prioridadOk(patch.prioridad);
  // El estado se DERIVA del avance (el board /todo ya no muestra "Estado" aparte):
  // 100→hecho, >0→en_curso, 0→por_hacer. hecho_at se sella SOLO en la transición
  // a hecho — si ya estaba hecha, se preserva (no re-sellar en cada edición).
  // ⚠️ Desde la 0159 la derivación mira DÓNDE ESTÁ la tarea: aplicada a ciegas
  // sacaba de «No cumplen criterio» a cualquiera que le tocaran el avance, que es
  // promoverla sin que nadie lo decida (estadoTrasProgreso, lib/todo-estados.ts).
  if (patch.progreso != null) {
    const p = clampPct(patch.progreso);
    const { data: cur } = await (await getTenantDb()).from('experimento_tareas').select('estado, hecho_at').eq('id', id).single();
    const actual = cur as { estado?: unknown; hecho_at?: string | null } | null;
    const est = estadoTrasProgreso(estadoOk(actual?.estado), p);
    upd.progreso = p;
    upd.estado = est;
    upd.hecho_at = est !== 'hecho' ? null : (actual?.hecho_at ?? new Date().toISOString());
  }
  if (patch.deadline !== undefined) upd.deadline = dateOk(patch.deadline);
  // El Quarter se SANEA contra su formato: lo que no sea `AAAA-QN` entra como null.
  // Guardar un string libre dejaria una tarea en una ventana que ninguna vista sabe
  // leer, y el sintoma seria que la tarea desaparece de todos los filtros.
  if (patch.quarter !== undefined) upd.quarter = quarterOk(patch.quarter);
  // ⚠️ MARCARLA «SE REPITE» LE SACA LA FECHA Y EL QUARTER, en la MISMA escritura. Una
  // recurrente no tiene fin, así que una fecha suya es una promesa que nadie puede cumplir
  // —y el motor de vencimientos la haría titilar para siempre—. Va acá, que es por donde
  // pasan TODAS las ediciones de este tablero, y no en la pantalla: el mismo campo lo
  // escriben el navegador, el Doer y los lotes.
  if (patch.recurrente !== undefined) {
    upd.recurrente = !!patch.recurrente;
    if (upd.recurrente) { upd.deadline = null; upd.quarter = null; }
  }
  if (patch.categorias !== undefined) upd.categorias = catsOk(patch.categorias);
  if (patch.checklist !== undefined) upd.checklist = checklistOk(patch.checklist);
  if (patch.historial !== undefined) upd.historial = histOk(patch.historial);
  if (patch.en_prioridad !== undefined) upd.en_prioridad = !!patch.en_prioridad;
  if (patch.score !== undefined) upd.score = Math.max(0, Math.min(100, Math.round(patch.score)));
  if (patch.score_razon !== undefined) upd.score_razon = patch.score_razon;
  // De dónde salió (reunión + minuto). Faltaba: una tarea de Fathom se guardaba sin
  // fuente y quedaba sin chip de origen ni link a la grabación.
  if (patch.fuente !== undefined) upd.fuente = patch.fuente;
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('experimento_tareas').update(upd).eq('id', id).select(COLS).single();
  if (error) throw new Error(`editarTarea: ${error.message}`);
  return rowTo(data);
}

/**
 * AMPLIAR tarjetas que YA existen, en vez de crear una segunda igual. Gemelo de
 * `ampliarTareasPlanOwner` (lib/plan-board.ts) para el tablero del cliente.
 *
 * Sin esto, "no duplicar" degradaba a "perder el contexto": `editarTarea` PISA el
 * detalle, así que la única jugada segura era descartar la tarea nueva y con ella todo
 * lo que se dijo en esa reunión. Acá el texto viejo manda y lo nuevo se suma abajo.
 * NO se tocan score, prioridad, deadline ni proyecto: ampliar es agregar contexto, no
 * volver a decidir la tarea.
 */
export async function ampliarTareasCliente(items: Array<{ id: number; detalle: string }>, desde = 'MaKo'): Promise<number> {
  const validos = items.filter((it) => Number.isFinite(it.id) && (it.detalle || '').trim());
  if (!validos.length) return 0;
  const supabase = await getTenantDb();
  const { data } = await supabase.from('experimento_tareas').select('id, detalle, historial').in('id', validos.map((v) => v.id));
  const previas = new Map(((data ?? []) as Array<{ id: number; detalle: string | null; historial: unknown }>).map((r) => [r.id, r]));
  const ahora = Date.now();
  let n = 0;
  for (const it of validos) {
    const p = previas.get(it.id);
    if (!p) { console.warn(`[todo] ampliar: la tarea ${it.id} no existe`); continue; }
    const viejo = (p.detalle ?? '').trim();
    const nuevo = it.detalle.trim();
    // Lo viejo PRIMERO y nunca se pisa; si lo nuevo ya lo contiene, se queda lo nuevo.
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const cabeza = norm(viejo).slice(0, 60);
    const detalle = !viejo ? nuevo
      : cabeza.length >= 20 && norm(nuevo).includes(cabeza) ? nuevo
        : `${viejo}\n\n${nuevo}`;
    if (detalle === viejo) continue;
    const entrada: HistEntry = { id: `h${ahora}${it.id}`, ts: ahora, actor: 'ia', text: `MaKo le sumó contexto (no la duplicó) — ${desde}`.slice(0, 220) };
    const historial = [entrada, ...(Array.isArray(p.historial) ? (p.historial as HistEntry[]) : [])].slice(0, 40);
    try { await editarTarea(it.id, { detalle: detalle.slice(0, 6000), historial }); n++; }
    catch (e) { console.error(`[todo] ampliar ${it.id}:`, e instanceof Error ? e.message : String(e)); }
  }
  return n;
}

export async function borrarTarea(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('experimento_tareas').delete().eq('id', id);
  if (error) throw new Error(`borrarTarea: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Categorías (etiquetas con color)
// ─────────────────────────────────────────────────────────────────────────────

const catRow = (r: Record<string, unknown>): Categoria => {
  const c = r as unknown as Categoria;
  c.emoji = typeof r.emoji === 'string' && r.emoji ? (r.emoji as string) : '🏷';
  c.prioridad = Math.max(1, Math.min(100, Math.round(Number(r.prioridad) || 50)));
  c.score_razon = typeof r.score_razon === 'string' && r.score_razon.trim() ? (r.score_razon as string) : null;
  c.deadline = dateOk(r.deadline);
  c.quarter = quarterOk(r.quarter);
  c.detalle = typeof r.detalle === 'string' ? (r.detalle as string) : '';
  c.historial = histOk(r.historial);
  // `!!` por lo mismo que en `rowTo`: esto castea la fila entera, así que una columna
  // ausente llegaría como `undefined` con el tipo diciendo `boolean`. Acá se normaliza una
  // vez y nadie más tiene que acordarse (mig 0164).
  c.recurrente = !!r.recurrente;
  return c;
};

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(`listCategorias: ${error.message}`);
  return (data ?? []).map(catRow);
}

export async function crearCategoria(nombre: string, color: string, emoji?: string, prioridad?: number, detalle?: string, historial?: HistEntry[], score_razon?: string | null, deadline?: string | null, quarter?: string | null, recurrente?: boolean): Promise<Categoria> {
  const supabase = (await getTenantDb());
  // Un proyecto que se repite NACE sin fecha, acá mismo (mig 0164). No alcanza con que el
  // editar la borre: si el alta la escribiera, la fila nacería con un deadline que después
  // nadie va a poder ver ni sacar — y el aviso de vencimientos lo leería igual.
  const repite = !!recurrente;
  const { data, error } = await supabase.from('tarea_categorias')
    .insert({ nombre: (nombre || '').trim().slice(0, 40) || 'Categoría', color: color || '#9b9ba2', emoji: (emoji || '🏷').slice(0, 4), prioridad: Math.max(1, Math.min(100, Math.round(prioridad ?? 50))), score_razon: score_razon ?? null, deadline: repite ? null : dateOk(deadline), quarter: repite ? null : quarterDeDeadline(quarter, deadline), recurrente: repite, detalle: detalle ?? '', historial: histOk(historial ?? []) })
    .select('*').single();
  if (error) throw new Error(`crearCategoria: ${error.message}`);
  return catRow(data);
}

export async function editarCategoria(id: number, patch: { nombre?: string; color?: string; emoji?: string; prioridad?: number; detalle?: string; historial?: HistEntry[]; score_razon?: string | null; deadline?: string | null; quarter?: string | null; recurrente?: boolean }): Promise<Categoria> {
  const upd: Record<string, unknown> = {};
  if (patch.nombre !== undefined) upd.nombre = (patch.nombre || '').trim().slice(0, 40) || 'Categoría';
  if (patch.color !== undefined) upd.color = patch.color || '#9b9ba2';
  if (patch.emoji !== undefined) upd.emoji = (patch.emoji || '🏷').slice(0, 4);
  if (patch.prioridad !== undefined) upd.prioridad = Math.max(1, Math.min(100, Math.round(patch.prioridad)));
  if (patch.score_razon !== undefined) upd.score_razon = patch.score_razon;
  if (patch.deadline !== undefined) upd.deadline = dateOk(patch.deadline);
  // El Quarter se manda SIEMPRE que se toque la fecha, aunque el formulario no lo edite:
  // si no, un proyecto del cliente con deadline queda para siempre sin trimestre.
  if (patch.quarter !== undefined || patch.deadline !== undefined) upd.quarter = quarterDeDeadline(patch.quarter, patch.deadline);
  // ⚠️ ESTE `upd` SE ARMA CAMPO POR CAMPO: LO QUE NO SE NOMBRA NO LLEGA. Es la gemela de
  // `editarTarea` (mig 0163) y va DESPUÉS de deadline/quarter a propósito — al marcarlo se
  // los borra en la MISMA escritura, así que tiene que pisar lo que las dos líneas de
  // arriba hayan puesto en este mismo patch. Sin esto el control se dibuja en el tablero
  // del cliente, contesta 200, y no guarda nada.
  if (patch.recurrente !== undefined) {
    upd.recurrente = !!patch.recurrente;
    if (upd.recurrente) { upd.deadline = null; upd.quarter = null; }
  }
  if (patch.detalle !== undefined) upd.detalle = patch.detalle;
  if (patch.historial !== undefined) upd.historial = histOk(patch.historial);
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').update(upd).eq('id', id).select('*').single();
  if (error) throw new Error(`editarCategoria: ${error.message}`);
  return catRow(data);
}

/** Borra la categoría y la quita de todas las tareas que la tenían. */
export async function borrarCategoria(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { data: conCat } = await supabase.from('experimento_tareas').select('id, categorias').contains('categorias', [id]);
  await Promise.all((conCat ?? []).map((t) => {
    const cats = catsOk((t as { categorias: unknown }).categorias).filter((c) => c !== id);
    return supabase.from('experimento_tareas').update({ categorias: cats, updated_at: new Date().toISOString() }).eq('id', (t as { id: number }).id);
  }));
  const { error } = await supabase.from('tarea_categorias').delete().eq('id', id);
  if (error) throw new Error(`borrarCategoria: ${error.message}`);
}
