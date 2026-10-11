// =============================================================================
// «Today» de MaKo Mobile — el COMPOSITOR (server)
// =============================================================================
// Junta lecturas que YA EXISTEN, según lo que este rol en esta capa puede ver
// (`composicionHoy`, lib/hoy-movil-modelo.ts). No calcula nada propio: el Pulso es
// `leerVistaGeneral` (lo mismo que /general), el plan es `leerPlanHoy` (lo mismo que
// /m/plan), las decisiones son `contarParaDecidir` (lo mismo que el badge del Inbox).
//
// ⚠️ CADA LECTURA FALLA POR SEPARADO, Y UNA LECTURA CAÍDA SE DICE. Una sección que no se
// pudo leer vuelve `{ estado: 'error' }` y la pantalla lo escribe; nunca se convierte en
// una lista vacía, que se leería como «no hay nada».
//
// ⚠️ RENDERIZAR TODAY ESCRIBE EN LA BASE, Y ES A PROPÓSITO (UNA vez por render, nunca en
// un sondeo): `leerVistaGeneral` corre `migrarSettingsAObjectives` y `getPendientesDeMarcar`
// (que dispara `adjuntarFathomAutoThrottled` y cierra el historial de etapas derivadas). Por
// eso `getPendientesDeMarcar` se llama a lo sumo UNA vez: el admin-cliente la recibe adentro
// del Pulso, y el closer/setter, sola. `contarParaDecidir` es la versión que NO escribe del
// Inbox (`leerParaDecidir` marca las vencidas: va sólo en /m/inbox).
//
// ⚠️ LA HORA DE UNA REUNIÓN SALE DE `junta_N_at` EN LA ZONA DEL NEGOCIO. `getJuntasProximas`
// trae el día y el contexto pero no la hora (su tipo no expone `junta_N_at`); se completa
// con UNA lectura por ids, scopeada con `getTenantDb`.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getJuntasProximas, getPendientesDeMarcar, type PendienteItem } from './queries';
import { hoyEnWorkspace, tzDeWorkspace } from './timezone';
import { leerVistaGeneral, type VistaGeneral } from './vista-general';
import { leerPlanHoy, type PlanHoy } from './plan-hoy';
import { contarParaDecidir, type ConteoParaDecidir } from './inbox-movil';
import { composicionHoy, horaEnZona, type ComposicionHoy } from './hoy-movil-modelo';
import type { ContextoMovil } from './movil-guard';
import type { RolMovil } from './movil-rutas';

export type Lectura<T> =
  | { estado: 'ok'; dato: T }
  | { estado: 'error'; motivo: string }
  | { estado: 'no-aplica' };

export type ReunionHoy = {
  leadId: number;
  nombre: string;
  empresa: string | null;
  /** J1 = primera reunión, J2 = segunda. */
  tipo: 'J1' | 'J2';
  dia: 'hoy' | 'manana';
  /** «10:00» en la zona del negocio; null = la reunión no tiene hora cargada. */
  hora: string | null;
};

export type LeadsPorDecidir = {
  /** Los primeros, en el orden de la cola del CRM. */
  items: Array<Pick<PendienteItem, 'lead_id' | 'lead_nombre' | 'mensaje'>>;
  total: number;
  /** Si trae texto, la lista puede estar incompleta: se dice. */
  aviso?: string;
};

export type HoyMovil = {
  composicion: ComposicionHoy;
  /** Cuándo se leyó (lo pinta «Actualizado hh:mm»). */
  leidoAt: string;
  pulso: Lectura<VistaGeneral>;
  plan: Lectura<PlanHoy>;
  reuniones: Lectura<ReunionHoy[]>;
  leads: Lectura<LeadsPorDecidir>;
  decidir: Lectura<ConteoParaDecidir>;
};

const TOPE_LEADS = 5;

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function leer<T>(aplica: boolean, nombre: string, f: () => Promise<T>): Promise<Lectura<T>> {
  if (!aplica) return { estado: 'no-aplica' };
  try {
    return { estado: 'ok', dato: await f() };
  } catch (e) {
    console.error(`[hoy-movil] no se pudo leer «${nombre}»:`, motivo(e));
    return { estado: 'error', motivo: motivo(e) };
  }
}

async function leerReuniones(ws: number | null): Promise<ReunionHoy[]> {
  if (ws == null) throw new Error('sin workspace');
  const [hoy, tz] = await Promise.all([hoyEnWorkspace(), tzDeWorkspace(ws)]);
  const juntas = await getJuntasProximas(hoy, 2);
  if (!juntas.length) return [];

  const ids = [...new Set(juntas.map((j) => j.lead_id))];
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, junta_1_at, junta_2_at').in('id', ids);
  if (error) throw new Error(`horas de las reuniones: ${error.message}`);
  const horas = new Map<number, { j1: string | null; j2: string | null }>();
  for (const f of (data ?? []) as Array<{ id: number; junta_1_at: string | null; junta_2_at: string | null }>) {
    horas.set(Number(f.id), { j1: f.junta_1_at, j2: f.junta_2_at });
  }

  const out: Array<ReunionHoy & { orden: string }> = [];
  for (const j of juntas) {
    const h = horas.get(Number(j.lead_id));
    const at = h ? (j.tipo === 'J1' ? h.j1 : h.j2) : null;
    out.push({
      leadId: j.lead_id,
      nombre: j.nombre,
      empresa: j.empresa,
      tipo: j.tipo,
      dia: j.fecha === hoy ? 'hoy' : 'manana',
      hora: horaEnZona(at, tz),
      // Las sin hora van al final de su día.
      orden: `${j.fecha} ${horaEnZona(at, tz) ?? '99:99'}`,
    });
  }
  out.sort((a, b) => a.orden.localeCompare(b.orden));
  return out.map(({ orden: _o, ...r }) => r);
}

async function leerLeads(): Promise<LeadsPorDecidir> {
  // ⚠️ ESCRIBE (ver la cabecera): una sola llamada por render.
  const p = await getPendientesDeMarcar(await hoyEnWorkspace());
  return {
    items: p.items.slice(0, TOPE_LEADS).map((i) => ({ lead_id: i.lead_id, lead_nombre: i.lead_nombre, mensaje: i.mensaje })),
    total: p.total,
    aviso: p.aviso || undefined,
  };
}

async function leerDecidir(rol: RolMovil, capa: string | null): Promise<ConteoParaDecidir> {
  return contarParaDecidir({ rol, capa });
}

/** Today de quien mira. Exige el contexto del guard (`requireMovil`): sesión, rol y capa. */
export async function componerHoy(ctx: Pick<ContextoMovil, 'rol' | 'capa' | 'ws'>): Promise<HoyMovil> {
  const rol = ctx.rol as RolMovil;
  const composicion = composicionHoy(rol, ctx.capa);
  const leidoAt = new Date().toISOString();
  const [pulso, plan, reuniones, leads, decidir] = await Promise.all([
    leer(composicion.pulso, 'pulso', () => leerVistaGeneral()),
    leer(composicion.plan, 'plan', () => leerPlanHoy()),
    leer(composicion.reuniones, 'reuniones', () => leerReuniones(ctx.ws)),
    leer(composicion.leadsPorDecidir, 'leads', () => leerLeads()),
    leer(true, 'decidir', () => leerDecidir(rol, ctx.capa)),
  ]);
  return { composicion, leidoAt, pulso, plan, reuniones, leads, decidir };
}
