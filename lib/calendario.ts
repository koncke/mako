// =============================================================================
// calendario — lo que lee y escribe la tab Calendario
// =============================================================================
// Siete lecturas en paralelo y cada una con su forma de fallar escrita (ninguna tumba a las otras):
//
//   · PROPIOS   — `calendario_eventos` (mig 0271): lo que se agenda en el Calendario.
//   · CRM       — las reuniones de los leads: `junta_1_at` / `junta_2_at` (el ISO con hora que deja Calendly o
//                 Cal.com); sin hora, `fecha_junta_1` / `fecha_junta_2` como día completo. Lleva a la ficha.
//                 ⚠️ UNA REUNIÓN CANCELADA CONSERVA SU `junta_X_at` (cancelarJuntaEnLead, lib/leads.ts: sólo borra la
//                 fecha, a propósito, por la regla de No Show). Así que la hora sola no dice que la reunión siga: se
//                 lee con `fecha_junta_X` puesta, la misma definición de «cancelada» que el CRM automático
//                 (`r1Cancelada`, lib/crm-auto-plan.ts). Hasta el 14/10/2026 el Calendario dibujaba las canceladas.
//   · RECURRENTES — las PRÓXIMAS veces de las tareas que se repiten (`proximasVeces`, lib/calendario-modelo.ts),
//                 contadas desde su ancla (`recurrente_desde`) como las cuenta el generador. No se crea ninguna fila.
//   · COBROS    — las cuotas sin cobrar (`pagos`) que vencen en el rango, con el nombre del lead. Lleva a la ficha.
//   · GOOGLE    — TODOS los calendarios de la cuenta conectada (lib/calendario-google.ts, 14/10/2026). Las que ya son una reunión del
//                 CRM las saca la pantalla (`sinDuplicarLlamadas`). ⚠️ No viaja a ningún modelo: sólo se dibuja.
//   · PLAN      — los deadlines de las tareas abiertas y de los proyectos (`tableroDelPlan`, lib/plan-hoy.ts: la
//                 misma lectura del tablero que el teléfono). Sin las recurrentes: no tienen deadline.
//   · OBJETIVOS — el inicio y el fin de cada Quarter del rango, y los objetivos que cierran con él.
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY». Cada lectura que falla queda en `fallos` y la pantalla lo dice en una línea; un
//    calendario vacío sobre una lectura caída le diría a la persona que tiene la semana libre.
// ⚠️ EL RANGO ES DE FECHAS DEL NEGOCIO ('YYYY-MM-DD', `hasta` exclusivo): se convierte a instantes con su zona.

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from './timezone';
import { leerTodo } from './supabase-paginado';
import { instanteDe } from './cron-aviso';
import { googleCalendarConectado, googleCalendarDueno } from './google-calendar';
import { leerAgendaGoogle } from './calendario-google';
import type { CalendarioGoogle } from './calendario-google-modelo';
import { tableroDelPlan } from './plan-hoy';
import { tableroActual, type QueTablero } from './tablero-actual';
import { tablasDe } from './tablero-de-capa';
import { listObjectives } from './objectives';
import { esRecurrente, recurrenciaDe, textoRepeticionCorto } from './plan-recurrentes';
import {
  itemDeFila, filaDeEntrada, quartersDelRango, proximasVeces, itemDeCuota, itemDeEdicion, MAX_LOTE, esTipoEvento, esFormato, TOPE_TITULO, TOPE_NOTAS,
  type ItemCalendario, type FilaEvento, type EntradaEvento,
} from './calendario-modelo';
import type { LlamadaDeVenta } from './calendario-llamadas';
import { bloqueoEnLaRed, esSinMigracion, leerPublicaciones } from './calendario-publicar';
import { rutaValida, TOPE_TEXTO, type DatosPublicacion } from './calendario-publicar-reglas';
import { PREFIJO_SEGMENTO_NEWSLETTER } from './newsletter-reglas';

export type FallosCalendario = {
  propios?: boolean;
  crm?: boolean;
  /** 'sin-conexion' no es un fallo: es que no hay agenda de Google conectada (y se ofrece conectarla). */
  google?: 'sin-conexion' | 'error' | null;
  plan?: boolean;
  recurrentes?: boolean;
  cobros?: boolean;
  newsletters?: boolean;
  objetivos?: boolean;
};

/** La cuenta de Google conectada: sus calendarios (la barra lateral), si se puede escribir y lo que no se pudo leer. */
export type GoogleDelCalendario = { calendarios: CalendarioGoogle[]; puedeEscribir: boolean; fallaron: string[]; recortado: boolean; cuenta: string | null };

export type LecturaCalendario = { items: ItemCalendario[]; fallos: FallosCalendario; google: GoogleDelCalendario | null };

const COLS = 'id, tipo, formato, titulo, notas, inicio, fin, dia_completo, estado';

/** El instante del inicio de un día del negocio. */
function inicioDelDia(fecha: string, tz: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return instanteDe(tz, y, m, d, 0, 0).toISOString();
}

export async function leerCalendario(desde: string, hasta: string, tz: string): Promise<LecturaCalendario> {
  const desdeIso = inicioDelDia(desde, tz);
  const hastaIso = inicioDelDia(hasta, tz);
  const fallos: FallosCalendario = {};
  const meta: { google: GoogleDelCalendario | null } = { google: null };
  const [propios, crm, google, plan, recurrentes, cobros, newsletters, objetivos, series] = await Promise.all([
    leerPropios(desdeIso, hastaIso).catch((e) => { console.error('[calendario] propios:', msg(e)); fallos.propios = true; return [] as ItemCalendario[]; }),
    leerCrm(desde, hasta, desdeIso, hastaIso, tz).catch((e) => { console.error('[calendario] crm:', msg(e)); fallos.crm = true; return [] as ItemCalendario[]; }),
    leerGoogle(desdeIso, hastaIso, tz, fallos, meta),
    leerPlan(desde, hasta, tz).catch((e) => { console.error('[calendario] plan:', msg(e)); fallos.plan = true; return [] as ItemCalendario[]; }),
    leerRecurrentes(desde, hasta, tz).catch((e) => { console.error('[calendario] recurrentes:', msg(e)); fallos.recurrentes = true; return [] as ItemCalendario[]; }),
    leerCobros(desde, hasta, tz).catch((e) => { console.error('[calendario] cobros:', msg(e)); fallos.cobros = true; return [] as ItemCalendario[]; }),
    leerNewsletters(desdeIso, hastaIso).catch((e) => { console.error('[calendario] newsletters:', msg(e)); fallos.newsletters = true; return [] as ItemCalendario[]; }),
    leerObjetivos(desde, hasta, tz).catch((e) => { console.error('[calendario] objetivos:', msg(e)); fallos.objetivos = true; return [] as ItemCalendario[]; }),
    // Las próximas veces de las Publicaciones que se repiten (29/10/2026, lib/calendario-recurrentes.ts): en la capa «Se repite».
    import('./calendario-recurrentes').then((m) => m.seriesParaDibujar(desde, hasta, desdeIso, tz))
      .catch((e) => { console.error('[calendario] series:', msg(e)); fallos.recurrentes = true; return [] as ItemCalendario[]; }),
  ]);
  // Los de Google van TODOS: si una reunión del CRM y su evento de Google son la misma, lo decide la pantalla según qué
  // calendarios están prendidos (`sinDuplicarLlamadas`). Apagando las llamadas del CRM, el de Google tiene que verse.
  return { items: [...propios, ...crm, ...google, ...plan, ...recurrentes, ...cobros, ...newsletters, ...objetivos, ...series], fallos, google: meta.google };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Las ediciones del newsletter (29/10/2026): un broadcast cuyo segmento es el CRM del newsletter (lib/newsletter-reglas.ts).
 * Se leen de donde viven, como el CRM y el Plan: la programada por su fecha de salida, la enviada por cuándo salió. Dos
 * lecturas y no un `or`: los instantes llevan `:` y `.`, que la sintaxis del `or` de PostgREST reserva.
 */
async function leerNewsletters(desdeIso: string, hastaIso: string): Promise<ItemCalendario[]> {
  const db = await getTenantDb();
  type Fila = { id: number; asunto: string | null; estado: string; programado_at: string | null; enviado_at: string | null };
  const cols = 'id, asunto, estado, programado_at, enviado_at';
  const [programadas, enviadas] = await Promise.all([
    leerTodo<Fila>(db, 'email_broadcasts', cols, { orden: 'id', eq: { estado: 'programado' }, filtros: (q) => q.like('segmento', `${PREFIJO_SEGMENTO_NEWSLETTER}%`).gte('programado_at', desdeIso).lt('programado_at', hastaIso) }),
    leerTodo<Fila>(db, 'email_broadcasts', cols, { orden: 'id', filtros: (q) => q.like('segmento', `${PREFIJO_SEGMENTO_NEWSLETTER}%`).gte('enviado_at', desdeIso).lt('enviado_at', hastaIso) }),
  ]);
  const vistas = new Map<number, Fila>();
  for (const f of [...programadas, ...enviadas]) vistas.set(Number(f.id), f);
  const out: ItemCalendario[] = [];
  for (const f of vistas.values()) {
    const it = itemDeEdicion({ id: Number(f.id), asunto: f.asunto ?? '', estado: f.estado, programadoAt: f.programado_at, enviadoAt: f.enviado_at });
    if (it) out.push(it);
  }
  return out;
}

async function leerPropios(desdeIso: string, hastaIso: string): Promise<ItemCalendario[]> {
  const db = await getTenantDb();
  const filas = await leerTodo<FilaEvento>(db, 'calendario_eventos', COLS, {
    orden: 'id', filtros: (q) => q.gte('inicio', desdeIso).lt('inicio', hastaIso),
  });
  return filas.map(itemDeFila);
}

type FilaReunion = { id: number; nombre: string | null; closer: string | null; junta_1_at: string | null; junta_2_at: string | null; fecha_junta_1: string | null; fecha_junta_2: string | null };

/** Las reuniones del CRM: R1 y R2 de cada lead, con su hora si la hay. Dos lecturas por columna, sin `or()`. */
async function leerCrm(desde: string, hasta: string, desdeIso: string, hastaIso: string, tz: string): Promise<ItemCalendario[]> {
  const db = await getTenantDb();
  const cols = 'id, nombre, closer, junta_1_at, junta_2_at, fecha_junta_1, fecha_junta_2';
  // `fecha_junta_X` puesta = la reunión sigue en pie: una cancelada conserva su hora y pierde la fecha (ver arriba).
  const [a1, a2, f1, f2] = await Promise.all([
    leerTodo<FilaReunion>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.gte('junta_1_at', desdeIso).lt('junta_1_at', hastaIso).not('fecha_junta_1', 'is', null) }),
    leerTodo<FilaReunion>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.gte('junta_2_at', desdeIso).lt('junta_2_at', hastaIso).not('fecha_junta_2', 'is', null) }),
    leerTodo<FilaReunion>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.is('junta_1_at', null).gte('fecha_junta_1', desde).lt('fecha_junta_1', hasta) }),
    leerTodo<FilaReunion>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.is('junta_2_at', null).gte('fecha_junta_2', desde).lt('fecha_junta_2', hasta) }),
  ]);
  const out: ItemCalendario[] = [];
  const poner = (l: FilaReunion, cual: 'R1' | 'R2', iso: string | null, fecha: string | null) => {
    const inicio = iso ?? (fecha ? inicioDelDia(fecha.slice(0, 10), tz) : null);
    if (!inicio) return;
    out.push({
      id: `crm:${l.id}:${cual}`, fuente: 'crm', capa: 'llamadas', titulo: (l.nombre ?? '').trim() || `Lead #${l.id}`,
      inicio, fin: null, diaCompleto: !iso, href: `/crm/${l.id}`,
      detalle: [cual, l.closer ? `closer ${l.closer}` : null].filter(Boolean).join(' · '),
    });
  };
  for (const l of a1) poner(l, 'R1', l.junta_1_at, null);
  for (const l of a2) poner(l, 'R2', l.junta_2_at, null);
  for (const l of f1) poner(l, 'R1', null, l.fecha_junta_1);
  for (const l of f2) poner(l, 'R2', null, l.fecha_junta_2);
  return out;
}

type FilaLlamada = FilaReunion & { setter: string | null; asistio_j1: boolean | null; asistio_j2: boolean | null; calificado: boolean | null };

/**
 * «Llamadas» del Calendario (24/10/2026, la lista de citas de venta, lib/calendario-llamadas.ts): las R1 y R2 del CRM en
 * la ventana, CON las canceladas (conservan la hora y pierden la fecha: la grilla no las dibuja, la lista las muestra en
 * su pestaña) y con la asistencia. Las mismas lecturas que `leerCrm`, sin `or()`.
 */
export async function leerLlamadasDeVenta(desde: string, hasta: string, tz: string): Promise<LlamadaDeVenta[]> {
  const db = await getTenantDb();
  const desdeIso = inicioDelDia(desde, tz);
  const hastaIso = inicioDelDia(hasta, tz);
  const cols = 'id, nombre, closer, setter, junta_1_at, junta_2_at, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, calificado';
  const [a1, a2, f1, f2] = await Promise.all([
    leerTodo<FilaLlamada>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.gte('junta_1_at', desdeIso).lt('junta_1_at', hastaIso) }),
    leerTodo<FilaLlamada>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.gte('junta_2_at', desdeIso).lt('junta_2_at', hastaIso) }),
    leerTodo<FilaLlamada>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.is('junta_1_at', null).gte('fecha_junta_1', desde).lt('fecha_junta_1', hasta) }),
    leerTodo<FilaLlamada>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.is('junta_2_at', null).gte('fecha_junta_2', desde).lt('fecha_junta_2', hasta) }),
  ]);
  const out: LlamadaDeVenta[] = [];
  const poner = (l: FilaLlamada, cual: 'R1' | 'R2', iso: string | null, fecha: string | null) => {
    const inicio = iso ?? (fecha ? inicioDelDia(fecha.slice(0, 10), tz) : null);
    if (!inicio) return;
    out.push({
      id: `crm:${l.id}:${cual}`, leadId: Number(l.id), nombre: (l.nombre ?? '').trim() || `Lead #${l.id}`, cual, inicio, diaCompleto: !iso,
      closer: l.closer, setter: l.setter, asistio: cual === 'R1' ? l.asistio_j1 : l.asistio_j2, calificado: l.calificado,
      // Con hora y sin fecha: cancelada (la regla de `leerCrm`).
      cancelada: !!iso && !(cual === 'R1' ? l.fecha_junta_1 : l.fecha_junta_2),
    });
  };
  for (const l of a1) poner(l, 'R1', l.junta_1_at, null);
  for (const l of a2) poner(l, 'R2', l.junta_2_at, null);
  for (const l of f1) poner(l, 'R1', null, l.fecha_junta_1);
  for (const l of f2) poner(l, 'R2', null, l.fecha_junta_2);
  return out;
}

/** Las tareas y proyectos del Plan con deadline en la ventana (lo mismo que la capa «Plan» de la grilla). */
export const leerTareasConFecha = (desde: string, hasta: string, tz: string): Promise<ItemCalendario[]> => leerPlan(desde, hasta, tz);

/**
 * TODOS los calendarios de la cuenta de Google conectada y sus eventos (14/10/2026: la copia fiel de Google Calendar).
 * Se leen todos, no sólo los tildados: prender uno en la barra lateral no tiene que esperar otra lectura. Arranca
 * prendido lo que la persona tiene tildado en Google.
 */
async function leerGoogle(desdeIso: string, hastaIso: string, tz: string, fallos: FallosCalendario, meta: { google: GoogleDelCalendario | null }): Promise<ItemCalendario[]> {
  try {
    if (!(await googleCalendarConectado())) { fallos.google = 'sin-conexion'; return []; }
    const r = await leerAgendaGoogle(desdeIso, hastaIso, tz, 'todos');
    if (!r.ok) { fallos.google = r.codigo === 'sin-conexion' ? 'sin-conexion' : 'error'; return []; }
    meta.google = { calendarios: r.calendarios, puedeEscribir: r.puedeEscribir, fallaron: r.fallaron, recortado: r.recortado, cuenta: await googleCalendarDueno().catch(() => null) };
    return r.eventos.map((e) => ({
      id: `google:${e.calendarioId}:${e.id}`, fuente: 'google' as const, capa: 'llamadas' as const, titulo: e.titulo,
      inicio: e.inicio, fin: e.fin, diaCompleto: e.diaCompleto, href: e.enlace, detalle: null, google: e,
    }));
  } catch (e) {
    console.error('[calendario] google:', msg(e));
    fallos.google = 'error';
    return [];
  }
}

/** Los deadlines del Plan: tareas abiertas y proyectos con fecha en el rango. Lleva a la tarjeta del tablero. */
async function leerPlan(desde: string, hasta: string, tz: string): Promise<ItemCalendario[]> {
  const t = await tableroDelPlan();
  const enRango = (f: string | undefined | null) => !!f && f >= desde && f < hasta;
  const proyecto = new Map(t.proyectos.map((p) => [p.id, p]));
  const out: ItemCalendario[] = [];
  for (const x of t.tareas) {
    if (!enRango(x.deadline) || x.progress >= 100 || esRecurrente(x)) continue;
    const p = x.labels.map((id) => proyecto.get(id)).find(Boolean);
    out.push({
      id: `plan:t:${x.id}`, fuente: 'plan', capa: 'plan', titulo: x.title, inicio: inicioDelDia(x.deadline, tz), fin: null,
      diaCompleto: true, href: `/plan?tarea=${encodeURIComponent(x.id)}`, detalle: p ? `${p.emoji} ${p.name}` : 'Deadline',
    });
  }
  for (const p of t.proyectos) {
    if (!enRango(p.deadline) || esRecurrente(p)) continue;
    out.push({
      id: `plan:p:${p.id}`, fuente: 'plan', capa: 'plan', titulo: `${p.emoji} ${p.name}`, inicio: inicioDelDia(p.deadline!, tz), fin: null,
      // `?proyecto=` abre ESE proyecto en el tablero (BoardShell lo lee, como `?tarea=`), no la grilla entera.
      diaCompleto: true, href: `/plan?proyecto=${encodeURIComponent(p.id)}`, detalle: 'Deadline del proyecto',
    });
  }
  return out;
}

type FilaPlantilla = Record<string, unknown>;

/**
 * Las PRÓXIMAS veces de las tareas que se repiten (Martín, 14/10/2026: «ver las tareas recurrentes allí»).
 *
 * Una tarea que se repite es una PLANTILLA (`recurrente = true` + su RRULE + `recurrente_desde`, mig 0185) y el
 * generador (lib/plan-recurrentes-generar.ts) le crea UNA instancia normal, con deadline, el día que toca. Esa instancia
 * ya se ve en «Plan». Esto dibuja el RITMO hacia adelante, con la misma cuenta que el generador (`proximasVeces` usa
 * `ocurrenciasEntre` con el mismo ancla), sin escribir nada.
 *
 * ⚠️ El ancla (`recurrente_desde`) y el vínculo instancia → plantilla (`recurrente_de`) no los trae el mapper del
 *    tablero, así que se leen acá, de la tabla que le toca a quien mira (`tableroActual` + `tablasDe`, la misma
 *    decisión que `tableroDelPlan`). Y la columna del título se llama distinto en cada mitad (`title` / `titulo`):
 *    PostgREST rechaza la consulta ENTERA si se pide una que no existe.
 */
async function leerRecurrentes(desde: string, hasta: string, tz: string): Promise<ItemCalendario[]> {
  return (await recurrentesDelRango(desde, hasta)).map((v) => ({
    id: `rec:${v.tareaId}:${v.fecha}`, fuente: 'plan' as const, capa: 'recurrentes' as const, titulo: v.titulo, inicio: inicioDelDia(v.fecha, tz), fin: null,
    diaCompleto: true, href: `/plan?tarea=${encodeURIComponent(v.tareaId)}`, detalle: v.ritmo ?? 'Se repite',
  }));
}

/** Una próxima vez de una tarea que se repite: qué tarea, cuándo y con qué ritmo. */
export type VezRecurrente = { tareaId: string; titulo: string; ritmo: string | null; fecha: string };

/**
 * Las próximas veces de TODAS las tareas que se repiten, en [desde, hasta) (fechas del negocio). La leen el Calendario
 * (capa «Se repite») y la API de MaKo (`ver_proximas_recurrentes`): una sola cuenta para las dos.
 *
 * ⚠️ `que` (qué mitad del tablero) lo pasa la API: por WhatsApp no hay cookie y `tableroActual()` contestaría
 *    «cliente» para el super admin (lib/api-mako/areas/cs.run.ts ya lo pagó). La pantalla no lo pasa: decide quien mira,
 *    como `tableroDelPlan`.
 */
export async function recurrentesDelRango(desde: string, hasta: string, forzado?: QueTablero): Promise<VezRecurrente[]> {
  const que = forzado ?? await tableroActual();
  const { tareas: tabla } = tablasDe(que);
  const colTitulo = que === 'dueno' ? 'title' : 'titulo';
  const db = await getTenantDb();
  const [plantillas, instancias, hoy] = await Promise.all([
    leerTodo<FilaPlantilla>(db, tabla, `id, ${colTitulo}, recurrencia, recurrente_desde`, { orden: 'id', eq: { recurrente: true } }),
    leerTodo<FilaPlantilla>(db, tabla, 'id, recurrente_de, deadline', {
      orden: 'id', filtros: (q) => q.not('recurrente_de', 'is', null).gte('deadline', desde).lt('deadline', hasta),
    }),
    hoyEnWorkspace(),
  ]);
  const conInstancia = new Map<string, Set<string>>();
  for (const i of instancias) {
    const k = String(i.recurrente_de);
    const f = String(i.deadline ?? '').slice(0, 10);
    if (!f) continue;
    if (!conInstancia.has(k)) conInstancia.set(k, new Set());
    conInstancia.get(k)!.add(f);
  }
  const out: VezRecurrente[] = [];
  for (const p of plantillas) {
    const rrule = recurrenciaDe({ recurrente: true, recurrencia: p.recurrencia });
    if (!rrule) continue;   // «se repite y nadie dijo cada cuánto»: sin regla no hay fecha, y una inventada es peor
    const id = String(p.id);
    const ancla = typeof p.recurrente_desde === 'string' ? p.recurrente_desde.slice(0, 10) : null;
    const titulo = String(p[colTitulo] ?? '').trim() || 'Tarea que se repite';
    const ritmo = textoRepeticionCorto(rrule);
    for (const fecha of proximasVeces({ rrule, ancla, desde, hasta, hoy, conInstancia: conInstancia.get(id) ?? new Set() })) {
      out.push({ tareaId: id, titulo, ritmo, fecha });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, 'es'));
}

type FilaCuota = { id: number; lead_id: number; numero: number; monto_usd: number | string; fecha_esperada: string };

/**
 * Las cuotas SIN COBRAR que vencen en el rango (`pagos`, las del plan de pagos de cada ficha del CRM), con el nombre
 * del lead. Lo cobrado no aparece: ya no es algo que hacer. El lead se lee en una segunda consulta por ids.
 */
async function leerCobros(desde: string, hasta: string, tz: string): Promise<ItemCalendario[]> {
  const db = await getTenantDb();
  const cuotas = await leerTodo<FilaCuota>(db, 'pagos', 'id, lead_id, numero, monto_usd, fecha_esperada', {
    orden: 'id', filtros: (q) => q.eq('pagado', false).gte('fecha_esperada', desde).lt('fecha_esperada', hasta),
  });
  if (!cuotas.length) return [];
  const ids = [...new Set(cuotas.map((c) => c.lead_id))];
  const nombres = new Map<number, string | null>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('leads').select('id, nombre').in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`no pude leer los leads de las cuotas: ${error.message}`);
    for (const l of (data ?? []) as Array<{ id: number; nombre: string | null }>) nombres.set(Number(l.id), l.nombre);
  }
  // Una cuota de un lead que ya no está no es un cobro que se pueda hacer: no se dibuja.
  return cuotas
    .filter((c) => nombres.has(Number(c.lead_id)))
    .map((c) => itemDeCuota(
      { id: c.id, leadId: Number(c.lead_id), numero: Number(c.numero) || 0, montoUsd: Number(c.monto_usd) || 0, vence: String(c.fecha_esperada).slice(0, 10) },
      nombres.get(Number(c.lead_id)) ?? null, inicioDelDia(String(c.fecha_esperada).slice(0, 10), tz),
    ));
}

/** El inicio y el fin de cada Quarter del rango, y los objetivos que cierran con él. Lleva a /general. */
async function leerObjetivos(desde: string, hasta: string, tz: string): Promise<ItemCalendario[]> {
  const out: ItemCalendario[] = [];
  for (const q of quartersDelRango(desde, hasta)) {
    if (q.inicio >= desde && q.inicio < hasta) {
      out.push({ id: `q:${q.anio}:${q.q}:ini`, fuente: 'objetivo', capa: 'objetivos', titulo: `Empieza el Q${q.q}`, inicio: inicioDelDia(q.inicio, tz), fin: null, diaCompleto: true, href: '/general', detalle: String(q.anio) });
    }
    if (q.fin >= desde && q.fin < hasta) {
      const objetivos = await listObjectives({ anio: q.anio, q: q.q });
      // Los del Quarter cierran con él; los ANUALES, con el Q4.
      const cierran = objetivos.filter((o) => o.quarter === q.q || (o.quarter == null && q.q === 4));
      out.push({ id: `q:${q.anio}:${q.q}:fin`, fuente: 'objetivo', capa: 'objetivos', titulo: `Cierra el Q${q.q}`, inicio: inicioDelDia(q.fin, tz), fin: null, diaCompleto: true, href: '/general', detalle: String(q.anio) });
      for (const o of cierran) {
        out.push({ id: `obj:${o.id}`, fuente: 'objetivo', capa: 'objetivos', titulo: o.titulo, inicio: inicioDelDia(q.fin, tz), fin: null, diaCompleto: true, href: '/general', detalle: `Objetivo del Q${q.q}` });
      }
    }
  }
  return out;
}

// ── Escrituras (sólo lo propio) ─────────────────────────────────────────────────────────────

/** Un id corto y al azar (como objectives y kpis: texto, lo genera el código). */
const nuevoId = () => `ev${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type Origen = 'user' | 'plantilla' | 'ia' | 'api';

/** Crea uno o varios eventos. Valida TODO antes de escribir: un lote con un evento malo no escribe ninguno. */
export async function crearEventos(entradas: readonly EntradaEvento[], tz: string, opts: { origen: Origen; autor: string | null }): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  if (!entradas.length) return { ok: false, error: 'No hay nada para agendar.' };
  if (entradas.length > MAX_LOTE) return { ok: false, error: `Hasta ${MAX_LOTE} eventos de una vez.` };
  const filas = [];
  for (const e of entradas) {
    const r = filaDeEntrada(e, tz);
    if (!r.ok) return { ok: false, error: r.error };
    filas.push({ id: nuevoId(), ...r.fila, estado: 'planeado', origen: opts.origen, creado_por: opts.autor });
  }
  const db = await getTenantDb();
  const { error } = await db.from('calendario_eventos').insert(filas);
  if (error) {
    if (/calendario_eventos/.test(error.message) && /(does not exist|schema cache)/i.test(error.message)) return { ok: false, error: 'Falta la migración 0271 (calendario_eventos).' };
    throw new Error(`No pude guardar el evento: ${error.message}`);
  }
  return { ok: true, ids: filas.map((f) => f.id) };
}

/** Cambia un evento propio. `{ ok: false }` si no existe en este negocio (no se da por bueno un update vacío). */
export async function cambiarEvento(id: string, e: EntradaEvento, tz: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = filaDeEntrada(e, tz);
  if (!r.ok) return r;
  // Lo que espera a Zernio sale a esa hora con ese contenido: moverlo acá no lo mueve allá (28/10/2026). Primero se cancela. La
  // condición va EN la escritura (la verificación del 28/10: leer «libre» y escribir sin condición movía uno recién programado).
  const db = await getTenantDb();
  const fila = { ...r.fila, updated_at: new Date().toISOString() };
  const w = await sinPublicacionEnCurso((c) => conCondicion(db.from('calendario_eventos').update(fila).eq('id', id), c).select('id'));
  if ('error' in w) throw new Error(`No pude cambiar el evento: ${w.error}`);
  if (w.filas.length) return { ok: true };
  return { ok: false, error: (await bloqueoEnLaRed(id, 'cambiar')) ?? 'Ese evento ya no existe.' };
}

/**
 * Uno que espera a Zernio no se borra: el motivo (`bloqueoEnLaRed`, el texto verdadero para cada estado) llega a la persona. Es
 * una clase para que la action lo distinga de un error de la base sin comparar textos.
 */
export class BloqueadaEnLaRed extends Error {}

type Condicion = 'nulo' | 'libres' | 'sin';
type Filtrable = { is(c: string, v: null): Filtrable; in(c: string, v: readonly string[]): Filtrable };
/**
 * La condición «no espera a Zernio» sobre un UPDATE o DELETE: sin publicación, o ya publicada o fallida. 'sin': sin la 0342.
 * `.is` y `.in` del constructor de Supabase devuelven el mismo constructor: el cast es estructural (inferir `T` contra ese tipo
 * daba «Type instantiation is excessively deep» en tsc).
 */
function conCondicion<Q>(q: Q, c: Condicion): Q {
  const f = q as unknown as Filtrable;
  return (c === 'nulo' ? f.is('publicacion', null) : c === 'libres' ? f.in('publicacion', ['publicada', 'fallo']) : f) as unknown as Q;
}

/**
 * Escribe SÓLO si el evento no espera a Zernio, en la misma escritura (dos pasos: sin publicación, o publicada/fallida; un
 * `or` con `in` no lo entiende el PostgREST de los tests). Sin la 0342 no hay nada programado: se escribe sin condición.
 */
async function sinPublicacionEnCurso<T>(armar: (c: Condicion) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<{ filas: T[] } | { error: string }> {
  for (const c of ['nulo', 'libres'] as const) {
    const { data, error } = await armar(c);
    if (error) {
      if (!esSinMigracion(error.message)) return { error: error.message };
      const r = await armar('sin');
      return r.error ? { error: r.error.message } : { filas: r.data ?? [] };
    }
    if (data?.length) return { filas: data };
  }
  return { filas: [] };
}

/**
 * Tilda (o destilda) un evento: una publicación que ya salió, un bloque que se hizo. `{ bloqueo }` si espera a Zernio, con el
 * porqué de su estado (la verificación del 28/10: la tarjeta la tildaba y quedaba «hecha» y programada a la vez; la del 29/10:
 * «se tilda sola cuando sale» no es cierto de una `dudosa` ni de una programada con otra clave).
 */
export async function marcarEvento(id: string, hecho: boolean): Promise<boolean | { bloqueo: string }> {
  const db = await getTenantDb();
  const fila = { estado: hecho ? 'hecho' : 'planeado', updated_at: new Date().toISOString() };
  const w = await sinPublicacionEnCurso((c) => conCondicion(db.from('calendario_eventos').update(fila).eq('id', id), c).select('id'));
  if ('error' in w) throw new Error(`No pude marcar el evento: ${w.error}`);
  if (w.filas.length) return true;
  const bloqueo = await bloqueoEnLaRed(id, 'tildar');
  return bloqueo ? { bloqueo } : false;
}

/**
 * Lo que se borró, entero (con su origen y su autor): el «Deshacer» lo vuelve a poner tal cual. Con la publicación que tenía
 * armada (la cuenta, el archivo y el texto; mig 0342), sin lo de Zernio: un evento programado no se borra.
 */
export type EventoBorrado = FilaEvento & {
  origen: string; creado_por: string | null;
  publicacion?: Pick<DatosPublicacion, 'red' | 'cuenta_red' | 'archivo' | 'archivo_tipo' | 'texto'>;
  /**
   * Su lugar en una Publicación que se repite (mig 0349): `de` = el molde, si es una de sus veces; `hasta` = lo que el cron ya
   * atendió, si es el molde. Sin esto, el «Deshacer» devolvía la vez SUELTA, su «Repetir» abría otra serie y salían dos posts por
   * día (re-verificación de privacidad del 29/10, N1); y el molde volvía sin su marca, y lo borrado renacía (N8).
   */
  serie?: { de: string | null; hasta: string | null };
};

/** El lugar en una serie de un evento, ANTES de borrarlo. Sin la 0349 (o sin poder leerlo), null: el evento vuelve como antes. */
async function serieDelEvento(id: string): Promise<EventoBorrado['serie'] | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').select('serie_de, repetir_hasta').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const f = data as { serie_de?: string | null; repetir_hasta?: string | null };
  return f.serie_de || f.repetir_hasta ? { de: f.serie_de ?? null, hasta: f.repetir_hasta ?? null } : null;
}

/**
 * Lo de la serie que se vuelve a escribir, VALIDADO (lo manda el navegador): el molde tiene que ser un evento de ESTE negocio
 * (`getTenantDb`) y otro que éste; si ya no está, la vez vuelve suelta (su serie se borró: no hay con qué duplicarse). Si no se puede
 * leer, TIRA: volver suelta una vez de una serie viva es justo lo que abría la segunda serie.
 */
async function serieParaVolver(id: string, s: EventoBorrado['serie']): Promise<{ serie_de?: string; repetir_hasta?: string }> {
  if (!s || typeof s !== 'object') return {};
  const out: { serie_de?: string; repetir_hasta?: string } = {};
  if (typeof s.hasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.hasta)) out.repetir_hasta = s.hasta;
  if (typeof s.de === 'string' && /^[a-z0-9]{1,40}$/i.test(s.de) && s.de !== id) {
    const db = await getTenantDb();
    const { data, error } = await db.from('calendario_eventos').select('id').eq('id', s.de).maybeSingle();
    if (error) throw new Error(`No pude volver a poner el evento: ${error.message}`);
    if (data) out.serie_de = s.de;
  }
  return out;
}

/** Borra un evento propio y devuelve lo que borró (para el «Deshacer», que lo vuelve a poner con el MISMO id). */
export async function borrarEvento(id: string): Promise<EventoBorrado | null> {
  // Uno que espera a Zernio se publicaría igual: primero se cancela (28/10/2026). La condición va EN el DELETE.
  const pub = (await leerPublicaciones([id])).get(id);
  // Aparte del DELETE (que no puede nombrar columnas de la 0349: sin ella, PostgREST rechazaría el borrado entero).
  const serie = await serieDelEvento(id);
  const db = await getTenantDb();
  const w = await sinPublicacionEnCurso<EventoBorrado>((c) => conCondicion(db.from('calendario_eventos').delete().eq('id', id), c).select(`${COLS}, origen, creado_por`) as never);
  if ('error' in w) throw new Error(`No pude borrar el evento: ${w.error}`);
  const b = w.filas[0] ?? null;
  if (!b) {
    const bloqueo = await bloqueoEnLaRed(id, 'borrar');
    if (bloqueo) throw new BloqueadaEnLaRed(bloqueo);
    return null;
  }
  // El «Deshacer» devuelve el archivo y el texto, NUNCA la cuenta: la cuenta se vuelve a elegir entre las del negocio.
  if (pub && (pub.archivo || pub.texto)) b.publicacion = { red: null, cuenta_red: null, archivo: pub.archivo, archivo_tipo: pub.archivo_tipo, texto: pub.texto };
  if (serie) b.serie = serie;
  return b;
}

/**
 * Deshace un borrado: la MISMA fila, con el MISMO id (AGENTS.md: deshacer devuelve la misma identidad). Es un
 * INSERT (getTenantDb le estampa el workspace); si ya volvió por otro lado (dos «Deshacer»), el 23505 no es un error.
 * ⚠️ LO QUE LLEGA LO MANDÓ EL NAVEGADOR: se vuelve a validar campo por campo y sólo se escriben las columnas de un
 *    evento. Los CHECK de la tabla son la segunda red, no la primera.
 */
export async function restaurarEvento(f: EventoBorrado): Promise<void> {
  const ok = f && typeof f === 'object'
    && typeof f.id === 'string' && /^[a-z0-9]{1,40}$/i.test(f.id)
    && esTipoEvento(f.tipo) && (f.formato == null || esFormato(f.formato))
    && typeof f.titulo === 'string' && f.titulo.length <= TOPE_TITULO
    && typeof f.notas === 'string' && f.notas.length <= TOPE_NOTAS
    && Number.isFinite(Date.parse(f.inicio)) && (f.fin == null || Number.isFinite(Date.parse(f.fin)))
    && (f.estado === 'planeado' || f.estado === 'hecho');
  if (!ok) throw new Error('Ese evento no se puede volver a poner.');
  const origen = ['user', 'plantilla', 'ia', 'api'].includes(f.origen) ? f.origen : 'user';
  // ⚠️ La serie va EN el insert (todo o nada): una vez que vuelve sin su `serie_de` puede abrir otra serie (N1). La regla del molde
  //    (`repetir`) NO vuelve: se vuelve a poner con su confirmación; su marca (`repetir_hasta`) sí, para que lo atendido no renazca.
  const serie = await serieParaVolver(f.id, f.serie);
  const db = await getTenantDb();
  const { error } = await db.from('calendario_eventos').insert({
    id: f.id, tipo: f.tipo, formato: f.formato ?? null, titulo: f.titulo, notas: f.notas, inicio: f.inicio, fin: f.fin ?? null,
    dia_completo: !!f.dia_completo, estado: f.estado, origen, creado_por: typeof f.creado_por === 'string' ? f.creado_por.slice(0, 200) : null,
    updated_at: new Date().toISOString(), ...serie,
  });
  if (error && error.code !== '23505') throw new Error(`No pude volver a poner el evento: ${error.message}`);
  // Ya había vuelto (dos «Deshacer»): la publicación la escribió el primero, y ésta no se escribe encima (la verificación del
  // 29/10: el segundo pisaba el archivo y el texto de un evento que ya estaba programado otra vez, y Zernio publicaba lo de antes).
  if (error) return;
  // La publicación que tenía armada, validada como todo lo demás (lo manda el navegador). Aparte: sin la 0342, el evento
  // vuelve igual. Nunca vuelve programada: lo de Zernio se canceló antes de borrar.
  const p = f.publicacion;
  const ws = await getWorkspaceActual();
  if (p && typeof p === 'object' && ws != null) {
    // ⚠️ La cuenta NO vuelve (lo manda el navegador y no se valida contra las del negocio sin ir a Zernio): se vuelve a elegir.
    const fila = {
      archivo: typeof p.archivo === 'string' && rutaValida(p.archivo, ws, f.id) ? p.archivo : null,
      archivo_tipo: p.archivo_tipo === 'image' || p.archivo_tipo === 'video' ? p.archivo_tipo : null,
      texto: typeof p.texto === 'string' ? p.texto.slice(0, TOPE_TEXTO) : '',
    };
    if (!fila.archivo) fila.archivo_tipo = null;
    // Y sólo sobre uno que no espera a Zernio: lo que se programó es lo que sale.
    const { error: eP } = await db.from('calendario_eventos').update(fila).eq('id', f.id).is('publicacion', null);
    if (eP) console.warn(`[calendario] el evento ${f.id} volvió sin su publicación: ${eP.message}`);
  }
}

/** Los eventos propios de un rango, para la API de MaKo (sin Google ni el CRM: lo propio y nada más). */
export async function listarPropios(desde: string, hasta: string, tz: string): Promise<FilaEvento[]> {
  const db = await getTenantDb();
  return leerTodo<FilaEvento>(db, 'calendario_eventos', COLS, {
    orden: 'id', filtros: (q) => q.gte('inicio', inicioDelDia(desde, tz)).lt('inicio', inicioDelDia(hasta, tz)),
  });
}

/** La zona del negocio en curso: la de todo lo que el Calendario convierte (lib/timezone.ts, con su default único). */
export async function zonaDelCalendario(): Promise<string> {
  const ws = await getWorkspaceActual();
  return ws != null ? tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;
}
