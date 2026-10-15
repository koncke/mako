// =============================================================================
// todo — tablero kanban de tareas (ruta /todo)
// =============================================================================
// Tareas que nacen de una Retro ("hacé esto"), de un experimento, o a mano.
// AMBOS EJES: columnas de estado (lib/todo-estados.ts) para el drag, y por
// tarjeta: prioridad, avance % (progreso), deadline, categorías (multi) y nota.
// `orden` (float) ordena dentro de la columna e inserta entre dos sin renumerar.
// =============================================================================

import 'server-only';
import { saneaPortada, saneaIcono, yPortada } from '@/lib/portadas';
import { getTenantDb } from './workspace';
import { quarterDeFecha } from '@/app/plan/board/cuando';
// «Cada cuánto se repite» (mig 0165). El enum, el saneo y la invariante salen del módulo
// compartido —el MISMO que usa la mitad del dueño— y no se reescriben acá: dos saneos son
// dos listas de valores válidos, y la segunda se queda vieja el día que se agregue uno.
import { recurrenciaDe } from '@/lib/plan-recurrentes';
// La lista blanca del detalle y las notas al GUARDAR (ver `sanearDetalle`). Puro y sin `server-only`:
// es la misma que corre en el navegador al dibujar.
import { sanearHtmlEmail } from './email-html-seguro';
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
  /**
   * CÓMO se repite (mig 0167): una RRULE de RFC 5545 como la que guarda Google Calendar
   * (`FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR`), en el lugar del deadline y el quarter que la
   * 0163 le sacó. `null` = se repite y nadie dijo cada cuánto, que NO es «no se repite».
   * Sólo existe con `recurrente`: la invariante la aplica `recurrenciaDe` en `rowTo` y en
   * los dos escritores (`crearTarea`, `editarTarea`).
   */
  recurrencia: string | null;
  categorias: number[];          // ids de tarea_categorias
  checklist: ChecklistItem[];    // ítems {id,text,done}
  historial: HistEntry[];        // change history {ts,actor,text} — user|ia
  en_prioridad: boolean;         // marcada "En prioridad" (vista Prioridades)
  score: number;                 // 1-100 del guardián (define la columna)
  score_razon: string | null;    // por qué el guardián le puso ese score
  /**
   * Los TRES que el tablero del cliente dibujaba y no guardaba (#157, medido el
   * 30/09/2026). Las columnas existen desde las migs 0114 y 0115; lo que faltaba era
   * todo el resto del camino, y el síntoma es el de siempre: el campo se edita, la
   * request contesta 200 y al recargar volvió como estaba.
   */
  notas: string;                 // la libreta de la tarjeta (mig 0114)
  deadline_razon: string | null; // por qué el guardián puso ESA fecha (mig 0114)
  hacelo_en: string | null;      // cuándo conviene hacerla, según MaKo (mig 0115)
  /** Los dos ejes con los que el Perro arma el score (mig 0177). El tablero del dueño
   *  los tiene desde siempre; acá la columna no existía, así que el panel de una tarea
   *  del cliente los mostraba vacíos y no había dónde escribirlos. */
  impacto: number | null;        // 1-100: cuánto mueve la aguja
  esfuerzo: number | null;       // 1-100: cuánto cuesta hacerla
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
  recurrente: boolean;
  /** Cómo se repite (mig 0167). Gemelo de `Tarea.recurrencia`: la misma RRULE, el mismo
   *  saneo y la misma invariante — y la misma mitad que ya se olvidó dos veces. */
  recurrencia: string | null;
  /**
   * DE QUIÉN es este proyecto: el lead GANADO del CRM (mig 0172). Ata TODAS sus tareas a
   * ese cliente de una sola vez, que es el nivel donde la pregunta se contesta bien: un
   * cliente casi nunca tiene tareas sueltas, tiene un proyecto del que cuelgan las de cada
   * semana.
   *
   * ⚠️ ES LA MITAD DEL CLIENTE Y TIENE SU GEMELA EN `plan_proyectos`. `BoardShell` es UNO
   * y lo montan los dos tableros; si la columna, el mapper o el `upd` de acá no nombran el
   * campo, el control se dibuja y no guarda nada — tres veces ya en este archivo
   * (prioridad, Quarter, recurrencia).
   */
  cliente_lead_id: number | null;
  /** Etiqueta para pintar sin ir a buscar `leads`. La clave es `cliente_lead_id`. */
  cliente_nombre: string | null;
  /**
   * SU PORTADA (mig 0173): `grad:<id>`, una URL https de un origen permitido, o `null`
   * —que es el default y significa «el degradado derivado de su color», no un dato
   * faltante.
   *
   * ⚠️ ES LA MITAD DEL CLIENTE Y TIENE SU GEMELA EN `plan_proyectos.portada`. Si la
   * columna, este tipo, `catRow` o el `upd` de `editarCategoria` no la nombran, el
   * control se dibuja en el tablero del cliente y contesta 200 sin guardar nada. Cuatro
   * veces ya en este archivo.
   */
  portada: string | null;
  /** El encuadre vertical de la portada, 0-100, o `null` = centrado (mig 0174). */
  portada_y: number | null;
  /**
   * SU ÍCONO (mig 0174): `icon:<set>:<nombre>` o una URL https. `null` = usar `emoji`.
   *
   * ⚠️ NO SE GUARDA EN `emoji`, y acá está la razón medida: doce líneas más abajo,
   * `crearCategoria` y `editarCategoria` hacen `(emoji || '🏷').slice(0, 4)`. Una URL
   * ahí queda en «http», la request contesta 200 y en la tarjeta se dibuja ese texto.
   * La mitad del dueño (`plan_proyectos`) NO trunca, así que el mismo componente
   * guardaría bien en un tablero y destruiría en el otro.
   */
  icono: string | null;
  /** Los mismos tres de #157, del lado del proyecto. `notas` existe desde la mig 0114
   *  y no la leía nadie; `impacto`/`esfuerzo` los agrega la 0177. */
  notas: string; impacto: number | null; esfuerzo: number | null;
  detalle: string; historial: HistEntry[]; created_at: string };

/** 1..100 o null. Los dos ejes del Perro: un 0 y un 140 son los dos «no lo sé» y
 *  entran como null, que es lo que la pantalla sabe dibujar (vacío, no un cero). */
const pct1a100 = (v: unknown): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
};

const COLS = '*';
/** ⚠️ EXPORTADO por lo mismo que `rowToTask` en `lib/plan-board.ts`: Customer Success
 *  lee filas sueltas de esta tabla y no puede tener su propia copia de este mapper. */
export const rowTo = (r: Record<string, unknown>): Tarea => {
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
  // La recurrencia se SANEA al leer, y por `recurrenciaDe` (mig 0167): la columna no tiene
  // `check` en la base a propósito, así que ésta es la única guarda contra una RRULE que
  // ninguna pantalla sabe pintar — y de paso aplica la invariante, para que una fila
  // desalineada no salga de acá afirmando «cada semana» sobre algo que vence.
  t.recurrencia = recurrenciaDe({ recurrente: t.recurrente, recurrencia: r.recurrencia });
  t.score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
  t.score_razon = typeof r.score_razon === 'string' && r.score_razon.trim() ? (r.score_razon as string) : null;
  t.estado = estadoOk(r.estado);
  t.responsable = txtOk(r.responsable);
  t.responsable_email = txtOk(r.responsable_email);
  t.responsable_tipo = esResponsableTipo(r.responsable_tipo) ? r.responsable_tipo : null;
  t.cliente_nombre = txtOk(r.cliente_nombre);
  t.cliente_lead_id = leadIdOk(r.cliente_lead_id);
  t.notas = typeof r.notas === 'string' ? r.notas : '';
  t.deadline_razon = txtOk(r.deadline_razon);
  t.hacelo_en = txtOk(r.hacelo_en);
  t.impacto = pct1a100(r.impacto);
  t.esfuerzo = pct1a100(r.esfuerzo);
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

// ── El detalle y las notas se GUARDAN saneados (auditoría de seguridad, 14/10/2026) ───────────
// /api/todo no mira el rol (closer y setter tienen la tab Plan por diseño) y esto guardaba
// `detalle` tal cual llegaba: un `<b>` más un `<img src=x onerror=…>` corría en la sesión del
// admin que abría la tarjeta. El tablero ahora sanea al DIBUJAR (app/plan/board/RichText.tsx,
// `paraDibujar`), que es la guarda que alcanza también a las filas viejas; esto es la segunda
// capa, para que la base no guarde lo que ninguna pantalla debería dibujar.
//
// ⚠️ SÓLO SE SANEA LO QUE ES HTML. El detalle que escribe MaKo (extracción, Perro, ampliar) es
//    MARKDOWN y se dibuja ESCAPADO (`mdAHtml`); pasarlo por la lista blanca lo rompería: un `a & b`
//    se guardaría `a &amp; b` y la pantalla, que lo escapa de nuevo, mostraría «&amp;». Un texto
//    sin etiquetas de formato queda como está — y está a salvo, porque las tres pantallas que lo
//    dibujan (RichText, `stripHtml`, NotasLista) lo tratan como texto.
// ⚠️ GEMELOS de `CODIGO` / `ES_HTML` / `esHtml` de RichText.tsx: un `'use client'` no se puede
//    importar desde el server, y la regla que decide «esto es HTML» tiene que ser la misma de los
//    dos lados. tests/seguridad-xss.test.ts compara los dos lados sobre el mismo corpus.
// ⚠️ La lista blanca es `sanearHtmlEmail` y no `sanearHtml` (lib/html-seguro.ts): aquélla no tiene
//    `div`, el renglón del editor, y juntaba todos los renglones de un detalle en uno (medido). El
//    porqué entero está en `sanitizeHtml` de RichText.tsx.
const ES_HTML_DETALLE = /<(div|p|br|ul|ol|li|strong|b|u|em|i|span|h[1-6]|a)[\s>/]/i;
const CODIGO_CITADO = /`[^`\n<>]*<\/?[a-zA-Z][^`\n<>]*>[^`\n<>]*`/g;
/** ¿Es HTML (lo escribió el editor) o markdown/texto? Lo citado entre comillas invertidas no cuenta. */
export const esHtmlDetalle = (texto: string): boolean => ES_HTML_DETALLE.test(texto.replace(CODIGO_CITADO, ''));

/**
 * El detalle (o una nota) como se GUARDA: si es HTML, por la lista blanca; si no, intacto.
 * Idempotente. Si el saneo se lleva TODAS las etiquetas de formato (un `<a href="javascript:…">`
 * era la única), lo que queda va envuelto en un `<div>`: sin él, al volver a leerlo se tomaría
 * por markdown y un `&amp;` que ya es HTML se escaparía otra vez.
 */
export function sanearDetalle(texto: string): string {
  if (!texto || !esHtmlDetalle(texto)) return texto;
  const limpio = sanearHtmlEmail(texto.replace(CODIGO_CITADO, (c) => c.replace(/</g, '&lt;').replace(/>/g, '&gt;')));
  return !limpio || esHtmlDetalle(limpio) ? limpio : `<div>${limpio}</div>`;
}

/**
 * Las notas como se GUARDAN. El campo es texto con un JSON adentro (`[{ id, ts, texto }]`, ver
 * app/plan/board/NotasLista.tsx) o una nota vieja suelta: se sanea el `texto` de cada una con la
 * regla del detalle, y lo demás de cada nota viaja intacto. Si nada cambió, vuelve el campo tal
 * cual llegó (ni un espacio de diferencia en el JSON).
 */
export function sanearNotas(raw: string): string {
  if (!raw) return raw;
  if (!raw.trimStart().startsWith('[')) return sanearDetalle(raw);
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return sanearDetalle(raw); }
  if (!Array.isArray(arr)) return sanearDetalle(raw);
  let cambio = false;
  const out = arr.map((n: unknown) => {
    if (typeof n === 'string') { const s = sanearDetalle(n); if (s !== n) cambio = true; return s; }
    if (!n || typeof n !== 'object') return n;
    const crudo = (n as { texto?: unknown }).texto;
    if (crudo == null) return n;
    // Como lo lee NotasLista (`String(n.texto ?? '')`): un `texto` que no es string también se
    // dibuja, así que también se sanea.
    const s = sanearDetalle(typeof crudo === 'string' ? crudo : String(crudo));
    if (s === crudo) return n;
    cambio = true;
    return { ...(n as Record<string, unknown>), texto: s };
  });
  return cambio ? JSON.stringify(out) : raw;
}

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
  /**
   * Cómo se repite (mig 0167): la RRULE. Sin `recurrente` no se guarda: `recurrenciaDe`.
   *
   * `unknown` A PROPÓSITO, y no `string | null`: lo que entra por acá viene de un body de
   * `/api/todo`, de una extracción de reunión o de un modelo, y el saneo de verdad
   * —`recurrenciaOk`, que además canoniza— vive adentro de `recurrenciaDe`. Un tipo
   * estrecho en la puerta invita a un cast, y el cast es lo que mete texto libre en una
   * columna que no tiene `check`.
   */
  recurrencia?: unknown;
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
    detalle: typeof input.detalle === 'string' ? sanearDetalle(input.detalle) : (input.detalle ?? null),
    estado,
    prioridad: prioridadOk(input.prioridad),
    progreso: input.progreso != null ? clampPct(input.progreso) : 0,
    // ⚠️ UNA RECURRENTE NACE SIN FECHA. La misma regla que `editarTarea`, acá arriba del
    // insert: si entra con deadline, el motor de vencimientos la hace titilar para siempre
    // pidiendo que se cierre algo que por definición no cierra.
    deadline: input.recurrente ? null : dateOk(input.deadline),
    recurrente: !!input.recurrente,
    // La recurrencia también VIAJA DESDE EL ALTA (mig 0167), y por la misma razón por la
    // que viaja `recurrente`: si sólo se pudiera poner editando, una recurrente extraída
    // de una reunión nacería sin ritmo, y el ritmo es lo único temporal que puede tener.
    // `recurrenciaDe` es lo que impide que una tarea con fin nazca con una recurrencia, y
    // de paso canoniza la RRULE que vino de afuera.
    recurrencia: recurrenciaDe(input),
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
    detalle: typeof it.detalle === 'string' ? sanearDetalle(it.detalle) : (it.detalle ?? null),
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

/**
 * ¿SE REPITE HOY ESTA FILA? Es lo que la invariante de la recurrencia necesita saber cuando
 * el patch no lo dice — el board del cliente manda el objeto entero, pero el Doer, los lotes
 * y `ampliarTareasCliente` llaman a `editarTarea` con dos campos.
 *
 * ⚠️ UNA SOLA COLUMNA DESDE LA 0167: antes eran tres (`recurrente`, `frecuencia`,
 * `frecuencia_dia`) y había que leerlas juntas para que no se vieran estados distintos. Con
 * la RRULE en un campo, el patch trae la recurrencia entera y lo único que falta de la fila
 * es el flag.
 *
 * Ante un error de lectura contesta `false`, que es el lado que NO escribe un dato: perder
 * una recurrencia se ve; ponerle una a algo que vence, no.
 */
/**
 * ⚠️ UN ERROR DE LECTURA NO ES «NO SE REPITE». Acá se ignoraba el `error` de Supabase y se
 * devolvía `!!data?.recurrente`, o sea `false` — y quien llama usa ese false para BORRAR la
 * recurrencia en la misma escritura. Con la base caída un segundo, editar cualquier otro
 * campo de la tarjeta se llevaba puesto su ritmo, sin un error y sin forma de saber que pasó.
 *
 * Es la regla de la casa: «no puedo hacer X con este dato» no es «este dato es falso», y el
 * default de un fallo de lectura nunca puede ser el que DESTRUYE. Ahora tira, y quien llama
 * decide — que es lo correcto porque acá la única salida honesta es no escribir.
 */
async function repiteTarea(id: number): Promise<boolean> {
  const { data, error } = await (await getTenantDb()).from('experimento_tareas').select('recurrente').eq('id', id).single();
  if (error) throw new Error(`repiteTarea(${id}): ${error.message}`);
  return !!(data as { recurrente?: unknown } | null)?.recurrente;
}

export async function editarTarea(
  id: number,
  patch: { titulo?: string; detalle?: string | null; prioridad?: Prioridad; progreso?: number; deadline?: string | null; quarter?: string | null; recurrente?: boolean; recurrencia?: unknown; categorias?: number[]; checklist?: ChecklistItem[]; historial?: HistEntry[]; en_prioridad?: boolean; score?: number; score_razon?: string | null; fuente?: { tipo: string; etiqueta?: string; url?: string } | null; notas?: string; deadline_razon?: string | null; hacelo_en?: string | null; impacto?: number | null; esfuerzo?: number | null } & CamposResponsable,
): Promise<Tarea> {
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString(), ...camposResponsableOk(patch) };
  if (patch.titulo != null) upd.titulo = patch.titulo.trim() || 'Tarea';
  // Saneado al guardar: ver `sanearDetalle`.
  if (patch.detalle !== undefined) upd.detalle = typeof patch.detalle === 'string' ? sanearDetalle(patch.detalle) : patch.detalle;
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
  // Los cinco de #157. `!== undefined` y no `!= null`: `null` es un valor real acá
  // —«no hay razón», «sin impacto estimado»— y con `!= null` no habría forma de
  // BORRARLOS, que es la mitad de poder editarlos.
  if (patch.notas !== undefined) upd.notas = sanearNotas(String(patch.notas ?? '')).slice(0, 6000);
  if (patch.deadline_razon !== undefined) upd.deadline_razon = txtOk(patch.deadline_razon);
  if (patch.hacelo_en !== undefined) upd.hacelo_en = txtOk(patch.hacelo_en);
  if (patch.impacto !== undefined) upd.impacto = pct1a100(patch.impacto);
  if (patch.esfuerzo !== undefined) upd.esfuerzo = pct1a100(patch.esfuerzo);
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
    // ⚠️ Y LA SIMÉTRICA (mig 0167): al DEJAR de repetirse se va la recurrencia. Si no se
    // borrara acá, la fila quedaría con `recurrente: false` y una RRULE viva — un valor que
    // ninguna pantalla dibuja (el campo sólo existe al lado de «Se repite») y que la API de
    // MaKo sí publica. El porqué completo, con las alternativas que se descartaron, está en
    // `recurrenciaDe` (lib/plan-recurrentes.ts).
    else upd.recurrencia = null;
  }
  /**
   * LA RECURRENCIA, CON SU INVARIANTE (mig 0167).
   *
   * ⚠️ NECESITA SABER SI LA TAREA SE REPITE, Y EL PATCH PUEDE NO DECIRLO. El board del
   * cliente manda el objeto entero (`editPatch` en TodoBoard.tsx), pero esta función también
   * la llaman el Doer, los lotes y `ampliarTareasCliente` con dos campos: sin leer la fila,
   * un patch `{ recurrencia }` suelto le pondría un ritmo a una tarea que vence. La consulta
   * extra sólo corre cuando la recurrencia viaja sin su flag.
   *
   * ⚠️ Y ESTE `upd` SE ARMA CAMPO POR CAMPO: lo que no se nombre acá no llega. Es la mitad
   * del CLIENTE, la que ya se olvidó dos veces con `recurrente` — el control se dibuja en
   * el tablero compartido, contesta 200, y no guarda nada.
   */
  if (patch.recurrencia !== undefined) {
    const repite = patch.recurrente !== undefined ? !!patch.recurrente : await repiteTarea(id);
    upd.recurrencia = recurrenciaDe({ recurrente: repite, recurrencia: patch.recurrencia });
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

export const catRow = (r: Record<string, unknown>): Categoria => {
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
  // Mismo saneo y misma invariante que en `rowTo` (mig 0167).
  c.recurrencia = recurrenciaDe({ recurrente: c.recurrente, recurrencia: r.recurrencia });
  // DE QUIÉN es (mig 0172). `leadIdOk` y no el valor crudo: un 0 no es un lead y rompería
  // la FK; lo mismo que hace `rowTo` con la columna gemela de las tareas.
  c.cliente_lead_id = leadIdOk(r.cliente_lead_id);
  c.cliente_nombre = typeof r.cliente_nombre === 'string' && r.cliente_nombre.trim() ? (r.cliente_nombre as string) : null;
  // SU PORTADA (mig 0173). Acá se normaliza el vacío a `null` una sola vez: el tipo dice
  // `string | null` y este cast es de la fila ENTERA, así que una columna ausente llegaría
  // como `undefined` con el tipo mintiendo.
  c.portada = typeof r.portada === 'string' && r.portada.trim() ? (r.portada as string) : null;
  // El encuadre y el ícono (mig 0174), por lo mismo que la portada de arriba.
  c.portada_y = yPortada(r.portada_y);
  c.icono = typeof r.icono === 'string' && r.icono.trim() ? (r.icono as string) : null;
  return c;
};

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(`listCategorias: ${error.message}`);
  return (data ?? []).map(catRow);
}

export async function crearCategoria(nombre: string, color: string, emoji?: string, prioridad?: number, detalle?: string, historial?: HistEntry[], score_razon?: string | null, deadline?: string | null, quarter?: string | null, recurrente?: boolean, recurrencia?: unknown, cliente?: { lead_id?: number | null; nombre?: string | null }, portada?: string | null, portada_y?: number | null, icono?: string | null): Promise<Categoria> {
  const supabase = (await getTenantDb());
  // Un proyecto que se repite NACE sin fecha, acá mismo (mig 0164). No alcanza con que el
  // editar la borre: si el alta la escribiera, la fila nacería con un deadline que después
  // nadie va a poder ver ni sacar — y el aviso de vencimientos lo leería igual.
  const repite = !!recurrente;
  const { data, error } = await supabase.from('tarea_categorias')
    .insert({ nombre: (nombre || '').trim().slice(0, 40) || 'Categoría', color: color || '#9b9ba2', emoji: (emoji || '🏷').slice(0, 4), prioridad: Math.max(1, Math.min(100, Math.round(prioridad ?? 50))), score_razon: score_razon ?? null, deadline: repite ? null : dateOk(deadline), quarter: repite ? null : quarterDeDeadline(quarter, deadline), recurrente: repite, recurrencia: recurrenciaDe({ recurrente: repite, recurrencia }), cliente_lead_id: leadIdOk(cliente?.lead_id), cliente_nombre: txtOk(cliente?.nombre), portada: saneaPortada(portada), portada_y: yPortada(portada_y), icono: saneaIcono(icono), detalle: typeof detalle === 'string' ? sanearDetalle(detalle) : (detalle ?? ''), historial: histOk(historial ?? []) })
    .select('*').single();
  if (error) throw new Error(`crearCategoria: ${error.message}`);
  return catRow(data);
}

/** ¿Se repite hoy la fila de un PROYECTO del cliente? La gemela de `repiteTarea`, y por lo
 *  mismo: el patch puede traer la recurrencia sin el flag que la autoriza. */
async function repiteCategoria(id: number): Promise<boolean> {
  // Misma cura que `repiteTarea`, y por el mismo motivo: ver el comentario de allá.
  const { data, error } = await (await getTenantDb()).from('tarea_categorias').select('recurrente').eq('id', id).single();
  if (error) throw new Error(`repiteCategoria(${id}): ${error.message}`);
  return !!(data as { recurrente?: unknown } | null)?.recurrente;
}

export async function editarCategoria(id: number, patch: { nombre?: string; color?: string; emoji?: string; prioridad?: number; detalle?: string; historial?: HistEntry[]; score_razon?: string | null; deadline?: string | null; quarter?: string | null; recurrente?: boolean; recurrencia?: unknown; cliente_lead_id?: number | null; cliente_nombre?: string | null; portada?: string | null; portada_y?: number | null; icono?: string | null; notas?: string; impacto?: number | null; esfuerzo?: number | null }): Promise<Categoria> {
  const upd: Record<string, unknown> = {};
  if (patch.nombre !== undefined) upd.nombre = (patch.nombre || '').trim().slice(0, 40) || 'Categoría';
  if (patch.color !== undefined) upd.color = patch.color || '#9b9ba2';
  if (patch.emoji !== undefined) upd.emoji = (patch.emoji || '🏷').slice(0, 4);
  if (patch.prioridad !== undefined) upd.prioridad = Math.max(1, Math.min(100, Math.round(patch.prioridad)));
  if (patch.score_razon !== undefined) upd.score_razon = patch.score_razon;
  // Los tres de #157 del lado del proyecto. Ver `editarTarea`.
  if (patch.notas !== undefined) upd.notas = sanearNotas(String(patch.notas ?? '')).slice(0, 6000);
  if (patch.impacto !== undefined) upd.impacto = pct1a100(patch.impacto);
  if (patch.esfuerzo !== undefined) upd.esfuerzo = pct1a100(patch.esfuerzo);
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
    else upd.recurrencia = null;   // la simétrica (mig 0167): ver `editarTarea`
  }
  // La recurrencia, con la misma invariante y la misma consulta de respaldo que en
  // `editarTarea`: este `upd` también se arma campo por campo, así que lo que no se nombre
  // acá no llega — y el control se dibujaría en el tablero del cliente sin guardar nada.
  if (patch.recurrencia !== undefined) {
    const repite = patch.recurrente !== undefined ? !!patch.recurrente : await repiteCategoria(id);
    upd.recurrencia = recurrenciaDe({ recurrente: repite, recurrencia: patch.recurrencia });
  }
  // DE QUIÉN es (mig 0172). Este `upd` también se arma campo por campo: lo que no se nombre
  // acá no llega, y el desplegable del tablero contestaría 200 sin guardar nada.
  // `undefined` = «no lo toques»; `null` = «sacale el cliente». Son dos cosas y las dos
  // tienen que poder viajar, o desasignar sería imposible.
  if (patch.cliente_lead_id !== undefined) upd.cliente_lead_id = leadIdOk(patch.cliente_lead_id);
  if (patch.cliente_nombre !== undefined) upd.cliente_nombre = txtOk(patch.cliente_nombre);
  // SU PORTADA (mig 0173). Este `upd` también se arma campo por campo: lo que no se nombre
  // acá no llega. `undefined` = «no la toques»; `null` = «sacala», que es volver al
  // degradado derivado del color y tiene que poder viajar.
  // ⚠️ `saneaPortada` Y NO `txtOk`. `txtOk` es un `trim`: por este camino entraba
  // cualquier `https://`, o sea la portada de un proyecto de un cliente podía apuntar
  // a un tercero y cargarse con el referer de quien abriera el tablero. El comentario
  // de `labelToRow` decía que el saneo lo corría «quien recibe la elección»; medido el
  // 27/09/2026, el único call site en todo el repo era el de la ficha del cliente.
  if (patch.portada !== undefined) upd.portada = saneaPortada(patch.portada);
  if (patch.portada_y !== undefined) upd.portada_y = yPortada(patch.portada_y);
  if (patch.icono !== undefined) upd.icono = saneaIcono(patch.icono);
  if (patch.detalle !== undefined) upd.detalle = typeof patch.detalle === 'string' ? sanearDetalle(patch.detalle) : patch.detalle;
  if (patch.historial !== undefined) upd.historial = histOk(patch.historial);
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('tarea_categorias').update(upd).eq('id', id).select('*').single();
  if (error) throw new Error(`editarCategoria: ${error.message}`);
  return catRow(data);
}

/** Borra la categoría y la quita de todas las tareas que la tenían. */
export async function borrarCategoria(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  // ⚠️ `contains` SOBRE UNA COLUMNA `jsonb` LLEVA JSON, NO UN ARRAY DE JS. supabase-js
  // serializa `[x]` como el literal de array de Postgres (`{x}`) y Postgres contesta
  // «invalid input syntax for type json» — o sea que la consulta FALLA ENTERA. Y como
  // acá se ignora el `error`, `data` viene `null`, el `?? []` lo vuelve vacío y el
  // bucle no hace nada: el borrado reporta éxito y deja las tareas apuntando a un
  // proyecto que ya no existe. Medido el 26/09/2026: cero filas colgadas en el ws1,
  // porque el NAVEGADOR las limpia por su cuenta antes de guardar — o sea que este
  // guard del server nunca corrió, y sólo iba a hacer falta el día que borre otro
  // camino (MaKo, un script, la API).
  const { data: conCat } = await supabase.from('experimento_tareas').select('id, categorias').contains('categorias', JSON.stringify([id]));
  await Promise.all((conCat ?? []).map((t) => {
    const cats = catsOk((t as { categorias: unknown }).categorias).filter((c) => c !== id);
    return supabase.from('experimento_tareas').update({ categorias: cats, updated_at: new Date().toISOString() }).eq('id', (t as { id: number }).id);
  }));
  const { error } = await supabase.from('tarea_categorias').delete().eq('id', id);
  if (error) throw new Error(`borrarCategoria: ${error.message}`);
}
