// =============================================================================
// calendario — lo que lee y escribe la tab Calendario
// =============================================================================
// Cinco lecturas en paralelo y cada una con su forma de fallar escrita (ninguna tumba a las otras):
//
//   · PROPIOS   — `calendario_eventos` (mig 0271): lo que se agenda en el Calendario.
//   · CRM       — las reuniones de los leads: `junta_1_at` / `junta_2_at` (el ISO con hora que deja Calendly o
//                 Cal.com); sin hora, `fecha_junta_1` / `fecha_junta_2` como día completo. Lleva a la ficha.
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
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import { leerTodo } from './supabase-paginado';
import { instanteDe } from './cron-aviso';
import { googleCalendarConectado, googleCalendarDueno } from './google-calendar';
import { leerAgendaGoogle } from './calendario-google';
import type { CalendarioGoogle } from './calendario-google-modelo';
import { tableroDelPlan } from './plan-hoy';
import { listObjectives } from './objectives';
import { esRecurrente } from './plan-recurrentes';
import {
  itemDeFila, filaDeEntrada, quartersDelRango, MAX_LOTE, esTipoEvento, esFormato, TOPE_TITULO, TOPE_NOTAS,
  type ItemCalendario, type FilaEvento, type EntradaEvento,
} from './calendario-modelo';

export type FallosCalendario = {
  propios?: boolean;
  crm?: boolean;
  /** 'sin-conexion' no es un fallo: es que no hay agenda de Google conectada (y se ofrece conectarla). */
  google?: 'sin-conexion' | 'error' | null;
  plan?: boolean;
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
  const [propios, crm, google, plan, objetivos] = await Promise.all([
    leerPropios(desdeIso, hastaIso).catch((e) => { console.error('[calendario] propios:', msg(e)); fallos.propios = true; return [] as ItemCalendario[]; }),
    leerCrm(desde, hasta, desdeIso, hastaIso, tz).catch((e) => { console.error('[calendario] crm:', msg(e)); fallos.crm = true; return [] as ItemCalendario[]; }),
    leerGoogle(desdeIso, hastaIso, tz, fallos, meta),
    leerPlan(desde, hasta, tz).catch((e) => { console.error('[calendario] plan:', msg(e)); fallos.plan = true; return [] as ItemCalendario[]; }),
    leerObjetivos(desde, hasta, tz).catch((e) => { console.error('[calendario] objetivos:', msg(e)); fallos.objetivos = true; return [] as ItemCalendario[]; }),
  ]);
  // Los de Google van TODOS: si una reunión del CRM y su evento de Google son la misma, lo decide la pantalla según qué
  // calendarios están prendidos (`sinDuplicarLlamadas`). Apagando las llamadas del CRM, el de Google tiene que verse.
  return { items: [...propios, ...crm, ...google, ...plan, ...objetivos], fallos, google: meta.google };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
  const [a1, a2, f1, f2] = await Promise.all([
    leerTodo<FilaReunion>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.gte('junta_1_at', desdeIso).lt('junta_1_at', hastaIso) }),
    leerTodo<FilaReunion>(db, 'leads', cols, { orden: 'id', filtros: (q) => q.gte('junta_2_at', desdeIso).lt('junta_2_at', hastaIso) }),
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
      diaCompleto: true, href: '/plan', detalle: 'Deadline del proyecto',
    });
  }
  return out;
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
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').update({ ...r.fila, updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw new Error(`No pude cambiar el evento: ${error.message}`);
  return data?.length ? { ok: true } : { ok: false, error: 'Ese evento ya no existe.' };
}

/** Tilda (o destilda) un evento: una publicación que ya salió, un bloque que se hizo. */
export async function marcarEvento(id: string, hecho: boolean): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').update({ estado: hecho ? 'hecho' : 'planeado', updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw new Error(`No pude marcar el evento: ${error.message}`);
  return !!data?.length;
}

/** Lo que se borró, entero (con su origen y su autor): el «Deshacer» lo vuelve a poner tal cual. */
export type EventoBorrado = FilaEvento & { origen: string; creado_por: string | null };

/** Borra un evento propio y devuelve lo que borró (para el «Deshacer», que lo vuelve a poner con el MISMO id). */
export async function borrarEvento(id: string): Promise<EventoBorrado | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('calendario_eventos').delete().eq('id', id).select(`${COLS}, origen, creado_por`);
  if (error) throw new Error(`No pude borrar el evento: ${error.message}`);
  return ((data ?? []) as EventoBorrado[])[0] ?? null;
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
  const db = await getTenantDb();
  const { error } = await db.from('calendario_eventos').insert({
    id: f.id, tipo: f.tipo, formato: f.formato ?? null, titulo: f.titulo, notas: f.notas, inicio: f.inicio, fin: f.fin ?? null,
    dia_completo: !!f.dia_completo, estado: f.estado, origen, creado_por: typeof f.creado_por === 'string' ? f.creado_por.slice(0, 200) : null,
    updated_at: new Date().toISOString(),
  });
  if (error && error.code !== '23505') throw new Error(`No pude volver a poner el evento: ${error.message}`);
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
