// =============================================================================
// focus-diseno — lo que dibuja la hoja Focus con su DISEÑO PROPIO (la copia de Pane), sacado de los datos de General
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Carga los de FOCUS que ya teníamos». La copia y la adaptación están en docs/diseno/mockups-dashboard/focus-pane/;
// acá, de dónde sale cada número con los DATOS REALES: los de los bloques de General (app/general/datos.ts, `DatosGeneral`),
// que ya lee la página de Focus.
//
// LO QUE PANE TIENE Y MaKo NO MIDE NO SE INVENTA:
//   · el temporizador de foco («Focus», 25:00) → «La meta»: la meta objetivo, cuánto lleva y cuánto debería llevar a hoy;
//   · «Right now» (en qué está cada persona del equipo) → «Te está esperando»: los cobros por hacer y los leads por marcar;
//   · las tareas que cerró el equipo cada día → «La semana»: lo que vence cada día en el Plan (hoy, más claro).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaFocus.tsx) y el test. Un dato que no llegó es
// `null`, nunca un cero: el bloque dice que no hay, no inventa.
// =============================================================================

import type { DatosGeneral, TareaVista } from '@/app/general/datos-tipos';
import type { Label } from '@/app/plan/board/types';
import type { ItemCalendario } from './calendario-modelo';
import type { CobroM } from '@/app/m/dashboard/modelo';

export type AnilloFocus = { id: 'tareas' | 'llamadas' | 'kpis'; nombre: string; v: number; de: number };
export type EventoFocus = { id: string; titulo: string; inicio: string; fin: string | null; diaCompleto: boolean; detalle: string | null; href: string | null; llamada: boolean };
export type TareaFocus = { id: string; titulo: string; proyecto: { nombre: string; color: string } | null; cuando: string; prio: 'urgente' | 'alta' | null };
export type DiaSemana = { dia: string; etiqueta: string; n: number; tipo: 'pasado' | 'hoy' | 'futuro' };
export type ProyectoFocus = { id: string; nombre: string; emoji: string; color: string; deadline: string | null; pct: number; abiertas: number };
export type LeadsPorMarcar = { tipo: string; n: number; texto: string };

export type VistaFocus = {
  /** Las tres cifras de arriba. null = no se pudo leer esa parte. */
  resumen: { tareas: { cerradas: number; total: number } | null; llamadas: { pasaron: number; total: number } | null; vencidas: number | null };
  anillos: AnilloFocus[];
  /** Lo que viene hoy en el Calendario, desde ahora: el primero en grande y hasta tres más. null = no se pudo leer. */
  viene: { proxima: EventoFocus | null; despues: EventoFocus[] } | null;
  meta: { titulo: string; pct: number | null; esperado: number; diasRestantes: number; atrasado: boolean | null } | null;
  /** «De hoy y atrasadas»; si no hay ninguna, las que más mueven la aguja (`deHoy: false`). */
  tareas: { lista: TareaFocus[]; deHoy: boolean } | null;
  semana: { dias: DiaSemana[]; total: number; vencidas: number } | null;
  proyectos: ProyectoFocus[] | null;
  espera: { cobros: CobroM[] | null; leads: LeadsPorMarcar[] | null };
};

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
/** Los tipos de los leads por marcar, con el texto del bloque «Pendientes del CRM» (app/general/bloques/Negocio.tsx). */
const TIPOS_PENDIENTE: ReadonlyArray<{ k: 'A' | 'B' | 'C' | 'M'; l: string }> = [
  { k: 'A', l: 'sin asistencia a R1' }, { k: 'B', l: 'sin R2 ni resolución' }, { k: 'C', l: 'sin asistencia a R2' }, { k: 'M', l: 'nutrición manual vencida' },
];

const sumarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lunesDe = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); return sumarDias(iso, -((d.getUTCDay() + 6) % 7)); };
/** El día de un instante en la zona del negocio (YYYY-MM-DD). */
export function diaEnZona(iso: string, tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch { return iso.slice(0, 10); }
}

/** «Hoy», «Ayer» o «dd/mm»: cuándo vence una tarea. */
export function cuandoVence(deadline: string | null | undefined, hoy: string): string {
  if (!deadline) return '';
  if (deadline === hoy) return 'Hoy';
  if (deadline === sumarDias(hoy, -1)) return 'Ayer';
  if (deadline === sumarDias(hoy, 1)) return 'Mañana';
  return `${deadline.slice(8, 10)}/${deadline.slice(5, 7)}`;
}

/** Una tarea del Plan como fila de «Mis tareas»: atrasada = «Urgente», prioridad alta = «Alta»; nada más se inventa. */
export function tareaFocus(t: TareaVista, etiquetas: readonly Label[], hoy: string): TareaFocus {
  const l = t.labels.map((id) => etiquetas.find((e) => e.id === id)).find(Boolean);
  const atrasada = !!t.deadline && t.deadline < hoy;
  return {
    id: t.id, titulo: t.title,
    proyecto: l ? { nombre: l.name, color: l.color } : null,
    cuando: cuandoVence(t.deadline, hoy),
    prio: atrasada ? 'urgente' : t.priority === 'alta' ? 'alta' : null,
  };
}

/** La semana del Plan: cuántas tareas y proyectos abiertos vencen cada día, de lunes a domingo. */
export function semanaDe(plan: Extract<DatosGeneral['plan'], { ok: true }>['d'], hoy: string): NonNullable<VistaFocus['semana']> {
  const lunes = lunesDe(hoy);
  const fechas = [...plan.deadlines.tareas.map((t) => t.deadline), ...plan.deadlines.proyectos.map((l) => l.deadline ?? '')].filter(Boolean);
  const dias: DiaSemana[] = DIAS.map((etiqueta, i) => {
    const dia = sumarDias(lunes, i);
    return { dia, etiqueta, n: fechas.filter((f) => f === dia).length, tipo: dia < hoy ? 'pasado' : dia === hoy ? 'hoy' : 'futuro' };
  });
  return { dias, total: dias.reduce((s, d) => s + d.n, 0), vencidas: plan.deadlines.tareas.filter((t) => t.deadline && t.deadline < hoy).length };
}

/** Lo de hoy en el Calendario desde ahora (lo de día completo cuenta todo el día), en orden. */
export function loQueViene(items: readonly ItemCalendario[], hoy: string, tz: string, ahora: number): VistaFocus['viene'] {
  const deHoy = items.filter((i) => diaEnZona(i.inicio, tz) === hoy)
    .filter((i) => i.diaCompleto || new Date(i.fin ?? i.inicio).getTime() >= ahora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((i): EventoFocus => ({ id: i.id, titulo: i.titulo, inicio: i.inicio, fin: i.fin, diaCompleto: i.diaCompleto, detalle: i.detalle ?? null, href: i.href, llamada: i.fuente === 'crm' }));
  const primera = deHoy.find((e) => !e.diaCompleto) ?? deHoy[0] ?? null;
  return { proxima: primera, despues: deHoy.filter((e) => e !== primera).slice(0, 3) };
}

/** Todo lo que dibuja la hoja, de los datos de General. `ahora`: el reloj (lo que viene, las llamadas que ya pasaron). */
export function vistaFocus(d: DatosGeneral, ahora: number, avance: (labelId: string) => { pct: number; total: number }): VistaFocus {
  const plan = d.plan.ok ? d.plan.d : null;
  const cal = d.calendario.ok ? d.calendario.d : null;
  const hoy = plan?.hoy ?? cal?.hoy ?? new Date(ahora).toISOString().slice(0, 10);

  const llamadasHoy = cal ? cal.items.filter((i) => i.fuente === 'crm' && diaEnZona(i.inicio, cal.tz) === hoy) : null;
  const llamadas = llamadasHoy ? { pasaron: llamadasHoy.filter((i) => new Date(i.inicio).getTime() < ahora).length, total: llamadasHoy.length } : null;
  const tareasHoy = plan?.deHoy ?? null;
  const diarios = d.kpis.ok ? d.kpis.d.kpis.filter((k) => k.cadencia === 'diaria') : null;

  const anillos: AnilloFocus[] = [
    { id: 'tareas', nombre: 'Tareas', v: tareasHoy?.cerradas ?? 0, de: tareasHoy?.total ?? 0 },
    { id: 'llamadas', nombre: 'Llamadas', v: llamadas?.pasaron ?? 0, de: llamadas?.total ?? 0 },
    { id: 'kpis', nombre: 'KPIs del día', v: diarios?.filter((k) => k.estado === 'verde').length ?? 0, de: diarios?.length ?? 0 },
  ];

  let meta: VistaFocus['meta'] = null;
  if (d.cabecera.ok && d.cabecera.d.objetivo) {
    const o = d.cabecera.d.objetivo;
    const esperado = Math.round(Math.max(0, Math.min(1, d.cabecera.d.fraccion)) * 100);
    meta = { titulo: o.titulo, pct: o.pct == null ? null : Math.round(o.pct), esperado, diasRestantes: d.cabecera.d.progreso.diasRestantes, atrasado: o.pct == null ? null : o.pct < esperado };
  }

  let tareas: VistaFocus['tareas'] = null;
  if (plan) {
    const deHoy = plan.deadlines.tareas.filter((t) => t.deadline && t.deadline <= hoy);
    const lista = (deHoy.length ? deHoy : plan.top).slice(0, 7).map((t) => tareaFocus(t, plan.etiquetas, hoy));
    tareas = { lista, deHoy: deHoy.length > 0 };
  }

  const proyectos: VistaFocus['proyectos'] = plan
    ? plan.proyectos.slice(0, 5).map((l) => {
      const av = avance(l.id);
      return { id: l.id, nombre: l.name, emoji: l.emoji, color: l.color, deadline: l.deadline ?? null, pct: av.pct, abiertas: plan.tareasDeProyectos.filter((t) => t.labels.includes(l.id) && t.progress < 100).length };
    })
    : null;

  const leads = d.pendientes.ok
    ? TIPOS_PENDIENTE.map((t) => ({ tipo: t.k, n: d.pendientes.ok ? d.pendientes.d.porTipo[t.k] ?? 0 : 0, texto: t.l })).filter((t) => t.n > 0)
    : null;

  return {
    resumen: { tareas: tareasHoy, llamadas, vencidas: plan?.vencidas ?? null },
    anillos,
    viene: cal ? loQueViene(cal.items, hoy, cal.tz, ahora) : null,
    meta,
    tareas,
    semana: plan ? semanaDe(plan, hoy) : null,
    proyectos,
    espera: { cobros: d.cobranza.ok ? d.cobranza.d.cobros : null, leads },
  };
}

/** «en 20 min», «en 2 h», «ahora»: cuánto falta para lo próximo. */
export function enCuanto(inicio: string, ahora: number): string {
  const min = Math.round((new Date(inicio).getTime() - ahora) / 60000);
  if (min <= 0) return 'ahora';
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}

/** La hora de un instante en la zona del negocio («11:30»). */
export function horaEn(iso: string, tz: string): string {
  try { return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); } catch { return iso.slice(11, 16); }
}

/** «30/11»: el día y el mes sin ceros, como los escribe Pane. */
const diaMes = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/** Lo de debajo del nombre de un proyecto: «En curso · vence el 30/11». Sin deadline, sólo el estado. */
export function lineaProyecto(p: Pick<ProyectoFocus, 'pct' | 'deadline'>, hoy: string): string {
  const estado = p.pct >= 100 ? 'Completo' : p.pct > 0 ? 'En curso' : 'Por iniciar';
  if (!p.deadline) return estado;
  const vence = p.deadline < hoy ? `venció el ${diaMes(p.deadline)}` : p.deadline === hoy ? 'vence hoy' : `vence el ${diaMes(p.deadline)}`;
  return `${estado} · ${vence}`;
}

/**
 * La línea de debajo del saludo: «Miércoles 4 de noviembre · 3 llamadas y 5 tareas para hoy». `fecha` es la variable
 * {{fecha}} de General («miércoles 4 de noviembre»); lo que no se pudo leer (null) no se cuenta, y no se afirma un cero.
 */
export function subtituloFocus(fecha: string | null | undefined, llamadas: number | null, tareas: number | null): string {
  const f = fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : '';
  const partes: string[] = [];
  if (llamadas) partes.push(`${llamadas} ${llamadas === 1 ? 'llamada' : 'llamadas'}`);
  if (tareas) partes.push(`${tareas} ${tareas === 1 ? 'tarea' : 'tareas'}`);
  const dia = partes.length ? `${partes.join(' y ')} para hoy` : llamadas === 0 && tareas === 0 ? 'Nada que vence hoy' : '';
  return [f, dia].filter(Boolean).join(' · ');
}
