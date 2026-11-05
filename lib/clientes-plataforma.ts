// =============================================================================
// clientes-plataforma — los clientes de MaKo para el super admin: quién es quién, cuánto factura y quién se está yendo
// =============================================================================
// Lo lee la vista Customers (app/customers) y la API (`ver_clientes_de_mako`). Las reglas, en
// lib/clientes-plataforma-reglas.ts. ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta quien llama) y sólo lo
// de la plataforma (sus workspaces, sus cobros y cuotas, la cartera de las agencias y los códigos de Partners) más SEÑALES
// de uso de cada negocio: cuándo entró alguien, cuándo terminó su onboarding, cuántos leads tiene y cuándo llegó el último,
// y cuántas sesiones del agente cerró. Nunca el contenido de su negocio (ni un lead, ni un mensaje).
//
// ⚠️ CADA LECTURA FALLA SOLA (26/10/2026): si una no se pudo leer, la vista se dibuja igual sin eso, y `avisos` dice cuál.
// Un «no pude leer» nunca se convierte en un cero (la regla de Martín: «sin tarjetas en cero cuando falta el dato»).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { leerPorPaginas, leerTodo } from './supabase-paginado';
import { listarWorkspaces, wsSuperAdmin } from './workspace';
import { agenciasHabilitadas, todasLasCarteras } from './agencia';
import { esCarteraVigente } from './agencia-cartera';
import { cobrosDeLugares } from './plan-acceso';
import { planesAManoPorNegocio } from './plan-a-mano';
import { regaloParaMirar, textoDePlanAMano, type PlanAMano } from './plan-a-mano-reglas';
import { usdPrimerMesVigente } from './primer-mes-reglas';
import { estadoDeLoGuardado } from './onboarding-contrato';
import { ONBOARDING_KEY } from './onboarding-state';
import { vistaDeIngresos } from './admin-ingresos';
import {
  cobradoPorMes, diasDesde, enPrueba, enRiesgo, kpisDeClientes, mrrDe, pagoPendiente, paraMirar, segmentosDe, sinUso,
  type CobroMrr, type ItemParaMirar, type PagoEntrado, type Segmento,
} from './clientes-plataforma-reglas';

export type MotivoRiesgo = 'pausado' | 'cobro' | 'sin-uso';

export type FilaCliente = {
  ws: number;
  nombre: string;
  capa: string;
  estado: string;
  creado: string;
  segmentos: Segmento[];
  /** El nombre de su agencia, si es cliente de una. */
  agencia: string | null;
  mrrUsd: number;
  /** Suscripciones que facturan sin su valor en dólares (no se inventa una tasa). */
  sinDolares: number;
  prueba: boolean;
  riesgo: boolean;
  /** Por qué está en riesgo (el primero que aplica). */
  motivoRiesgo: MotivoRiesgo | null;
  /** Días desde que entró alguien de su equipo. `null` = nunca, o no se pudo leer (`actividadLeida`). */
  sinEntrar: number | null;
  /** Días desde su último lead. `null` = no tiene leads. */
  sinLeads: number | null;
  /** Cuántos leads tiene. `null` = no se pudo leer. */
  leads: number | null;
  /** `null` = no se pudo leer (y se dice en `avisos`): no es «no lo terminó». */
  onboardingHecho: boolean | null;
  /** Sesiones del agente (su Claude Code) en los últimos 30 días. */
  sesionesAgente: number;
  /** Un link de cobro de su lugar sin pagar (el primer mes, una renovación por autorizar o un cobro que falló). */
  pagoPendiente: boolean;
  /** Hasta cuándo va su plan a mano, ya dicho («Gratis hasta el 1 de mayo de 2027»). null = no tiene. */
  planAManoTxt: string | null;
  regaloPorTerminar: string | null;
  /** Lo que pagó su primer mes en dólares, mientras corre ese mes con el 50%. null = no aplica. */
  primerMesUsd: number | null;
};

export type VistaClientes = {
  filas: FilaCliente[];
  kpis: ReturnType<typeof kpisDeClientes>;
  /** Lo que entró cada mes por la plataforma, los últimos 6 meses. `null` = no entró nada (o no se pudo leer). */
  cobrado: Array<{ mes: string; usd: number }> | null;
  /** Cuotas del CRM de la plataforma que vencieron sin pagarse. `null` = no se pudo leer. */
  vencido: { cuotas: number; usd: number } | null;
  /** Lo que pide atención, el más grave primero (lib/clientes-plataforma-reglas.ts, `paraMirar`). */
  paraMirar: ItemParaMirar[];
  /** Si la actividad se pudo leer: sin ella, «sin uso» no se afirma de nadie. */
  actividadLeida: boolean;
  /** Alguna lectura falló: lo que se muestra puede quedarse corto, y se dice cuál. */
  avisos: string[];
};

/** Quién tiene su link de Partners (el código nace al unirse). */
async function partnersConLink(): Promise<Set<number>> {
  // ⚠️ PAGINADO (revisión del tren, hallazgo 5): `.limit(5000)` no pasa el techo de 1000 de PostgREST y el corte llega
  // sin error y sin orden (AGENTS.md, lib/supabase-paginado.ts). Las cuatro lecturas de acá crecen con el uso.
  const filas = await leerTodo<{ workspace_id: number }>(getSupabaseServer(), 'partner_codigos', 'workspace_id', { orden: 'workspace_id' });
  return new Set(filas.map((f) => Number(f.workspace_id)));
}

/** El último ingreso de alguien de cada negocio. */
async function ultimosIngresos(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  await leerPorPaginas<{ workspace_id: number; ultimo_login: string | null }>(getSupabaseServer(), 'usuarios', 'workspace_id, ultimo_login', (filas) => {
    for (const u of filas) {
      if (!u.ultimo_login) continue;
      const ws = Number(u.workspace_id);
      const prev = out.get(ws);
      if (!prev || u.ultimo_login > prev) out.set(ws, u.ultimo_login);
    }
  }, { filtros: (q) => q.not('workspace_id', 'is', null), orden: 'id' });
  return out;
}

/** Qué negocios terminaron su onboarding (la misma lectura que el cron de las renovaciones). */
async function onboardingsHechos(ids: readonly number[]): Promise<Set<number>> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value').in('workspace_id', [...ids]).eq('key', ONBOARDING_KEY);
  if (error) throw new Error(error.message);
  const out = new Set<number>();
  for (const f of (data ?? []) as Array<{ workspace_id: number; value: unknown }>) {
    const crudo = f.value == null ? null : typeof f.value === 'string' ? f.value : JSON.stringify(f.value);
    if (estadoDeLoGuardado(crudo).status === 'done') out.add(Number(f.workspace_id));
  }
  return out;
}

/** Cuántos leads tiene cada negocio y cuándo llegó el último. Una consulta chica por negocio (son decenas). */
async function leadsDe(ids: readonly number[]): Promise<Map<number, { n: number; ultimo: string | null }>> {
  const db = getSupabaseServer();
  const out = new Map<number, { n: number; ultimo: string | null }>();
  await Promise.all(ids.map(async (ws) => {
    const { data, count, error } = await db.from('leads').select('created_at', { count: 'exact' })
      .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    out.set(ws, { n: count ?? 0, ultimo: (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null });
  }));
  return out;
}

/** Sesiones del agente de cada negocio en los últimos 30 días. */
async function sesionesDelAgente(ahoraMs: number): Promise<Map<number, number>> {
  const desde = new Date(ahoraMs - 30 * 86_400_000).toISOString();
  const out = new Map<number, number>();
  await leerPorPaginas<{ workspace_id: number }>(getSupabaseServer(), 'agente_sesiones', 'workspace_id', (filas) => {
    for (const s of filas) out.set(Number(s.workspace_id), (out.get(Number(s.workspace_id)) ?? 0) + 1);
  }, { filtros: (q) => q.gte('created_at', desde), orden: 'id' });
  return out;
}

/** Las cuotas del CRM de la plataforma: lo que entró (con su fecha) y lo que venció sin pagarse. */
async function cuotasDeLaPlataforma(plataforma: number, ahoraMs: number): Promise<{ entrados: PagoEntrado[]; vencido: { cuotas: number; usd: number } }> {
  const data = await leerTodo<{ pagado: boolean; fecha_pago: string | null; fecha_esperada: string | null; monto_usd: number | null }>(
    getSupabaseServer(), 'pagos', 'pagado, fecha_pago, fecha_esperada, monto_usd', { eq: { workspace_id: plataforma }, orden: 'id' });
  const hoy = new Date(ahoraMs).toISOString().slice(0, 10);
  const entrados: PagoEntrado[] = [];
  const vencido = { cuotas: 0, usd: 0 };
  for (const p of data) {
    const usd = typeof p.monto_usd === 'number' && Number.isFinite(p.monto_usd) ? p.monto_usd : null;
    if (p.pagado && p.fecha_pago) entrados.push({ fecha: p.fecha_pago, usd });
    else if (!p.pagado && p.fecha_esperada && p.fecha_esperada < hoy) { vencido.cuotas += 1; vencido.usd += usd ?? 0; }
  }
  vencido.usd = Math.round(vencido.usd * 100) / 100;
  return { entrados, vencido };
}

export async function vistaDeClientes(ahoraMs: number = Date.now()): Promise<VistaClientes> {
  const plataforma = await wsSuperAdmin();
  const avisos: string[] = [];
  const conAviso = <T,>(que: string, vacio: T) => (e: unknown): T => {
    avisos.push(`${que}: ${e instanceof Error ? e.message : String(e)}`);
    return vacio;
  };
  const wss = (await listarWorkspaces()).filter((w) => w.id !== plataforma);
  const ids = wss.map((w) => w.id);
  const [agencias, carteras, partners, cobros, ingresos, hechos, leads, sesiones, cuotas, planesAMano] = await Promise.all([
    agenciasHabilitadas(),
    todasLasCarteras(),
    partnersConLink().catch(conAviso('los Partners', new Set<number>())),
    cobrosDeLugares(plataforma).catch(conAviso('los cobros (el MRR)', [])),
    ultimosIngresos().catch(conAviso('los ingresos de cada equipo', null)),
    onboardingsHechos(ids).catch(conAviso('los onboardings', null)),
    leadsDe(ids).catch(conAviso('los leads de cada negocio', null)),
    sesionesDelAgente(ahoraMs).catch(conAviso('las sesiones del agente', new Map<number, number>())),
    cuotasDeLaPlataforma(plataforma, ahoraMs).catch(conAviso('las cuotas de la plataforma', null)),
    planesAManoPorNegocio().catch(conAviso('los planes a mano', new Map<number, PlanAMano>())),
  ]);
  // ⚠️ EL MRR ES EL DE REVENUE (5/11/2026, lib/admin-ingresos.ts): lo que cada negocio PAGÓ como su mensualidad, a mano o por
  // la pasarela. Medido ese día: todo lo cobrado entró a mano, así que `mrrDe(cobros)` daba 0 para todos y Customers decía lo
  // contrario que Revenue. Si Revenue no se pudo leer, queda el de los cobros (y se dice).
  const revenue = await vistaDeIngresos(new Date(ahoraMs)).catch(conAviso('los ingresos (el MRR de lo cobrado a mano)', null));
  const mrrPagado = new Map<number, number>();
  for (const c of revenue?.clientes ?? []) if (c.ws != null && c.mrr > 0) mrrPagado.set(c.ws, (mrrPagado.get(c.ws) ?? 0) + c.mrr);
  const nombre = new Map(wss.map((w) => [w.id, w.nombre]));
  // De qué agencia es cada cliente: las vigentes (un revocado ya no es suyo, AdminView 28/09/2026).
  const deAgencia = new Map<number, number>();
  for (const f of carteras) if (esCarteraVigente(f)) deAgencia.set(Number(f.cliente_ws), Number(f.agencia_ws));
  const cobrosDe = new Map<number, CobroMrr[]>();
  for (const c of cobros) {
    const ws = Number(c.cliente_ws ?? c.alta_ws);
    if (!Number.isFinite(ws)) continue;
    const l = cobrosDe.get(ws) ?? [];
    l.push(c as unknown as CobroMrr);
    cobrosDe.set(ws, l);
  }
  const actividadLeida = ingresos != null && hechos != null;
  const sets = { partners, agencias: new Set(agencias.map((a) => a.ws)), deAgencia };
  const filas: FilaCliente[] = wss.map((w) => {
    const cs = cobrosDe.get(w.id) ?? [];
    const mrr = revenue ? { usd: mrrPagado.get(w.id) ?? 0, sinDolares: 0 } : mrrDe(cs);
    const ag = deAgencia.get(w.id);
    const l = leads?.get(w.id) ?? null;
    const actividad = {
      sinEntrar: ingresos ? diasDesde(ingresos.get(w.id), ahoraMs) : null,
      sinLeads: l ? diasDesde(l.ultimo, ahoraMs) : null,
      // `null` si no se pudo leer (hallazgo 4): sin el dato no se afirma ni «Sin empezar» ni «Terminada».
      onboardingHecho: hechos ? hechos.has(w.id) : null,
    };
    const porCobro = enRiesgo(w.estado, cs);
    // ⚠️ NO DE LOS CLIENTES DE UNA AGENCIA (hallazgo 7): la agencia entra a su cuenta con su propia sesión (/api/agencia/entrar)
    // y la base no anota esa entrada, así que «nadie de su equipo entró» es lo normal aunque la agencia la opere todos los días.
    const porUso = actividadLeida && !deAgencia.has(w.id) && sinUso(actividad);
    const mano = planesAMano.get(w.id) ?? null;
    const motivoRiesgo: MotivoRiesgo | null = w.estado === 'pausado' ? 'pausado' : porCobro ? 'cobro' : porUso ? 'sin-uso' : null;
    return {
      ws: w.id, nombre: w.nombre, capa: w.capa, estado: w.estado, creado: w.created_at,
      segmentos: segmentosDe(w.id, sets),
      agencia: ag != null ? (nombre.get(ag) ?? `Workspace ${ag}`) : null,
      mrrUsd: mrr.usd, sinDolares: mrr.sinDolares, prueba: enPrueba(cs),
      riesgo: motivoRiesgo != null, motivoRiesgo,
      sinEntrar: actividad.sinEntrar, sinLeads: actividad.sinLeads, leads: l?.n ?? null, onboardingHecho: actividad.onboardingHecho,
      sesionesAgente: sesiones.get(w.id) ?? 0,
      pagoPendiente: pagoPendiente(cs),
      planAManoTxt: mano ? textoDePlanAMano(mano, ahoraMs) : null,
      primerMesUsd: cs.map((c) => usdPrimerMesVigente(c, ahoraMs)).find((n) => n != null) ?? null,
      // A quien ya factura o está en su prueba con tarjeta, un vencimiento viejo no le pide atención.
      regaloPorTerminar: mano && mrr.usd === 0 && mrr.sinDolares === 0 && !enPrueba(cs) ? regaloParaMirar(mano, ahoraMs) : null,
    };
  });
  return {
    filas,
    kpis: kpisDeClientes(filas, ahoraMs),
    cobrado: cuotas ? cobradoPorMes(cuotas.entrados, ahoraMs) : null,
    vencido: cuotas?.vencido ?? null,
    paraMirar: paraMirar(filas, ahoraMs),
    actividadLeida,
    avisos,
  };
}
