// =============================================================================
// La copia de MaKo sin conexión de quien mira (servidor, 28/10/2026)
// =============================================================================
// NINGUNA regla propia de quién ve qué: cada parte es la lectura que ya usa el teléfono, con la sesión de la persona.
//   · CRM  → `tableroCrm` (app/m/crm/datos.ts) de cada funnel del negocio, con TODAS las tarjetas y su contacto; y las
//            últimas notas de cada lead que está en esos tableros (el historial `Nota`, como la ficha del teléfono).
//   · Plan → `leerPlanHoyConTablero` y los tableros del teléfono (app/m/plan/tableros.ts), como app/m/plan/page.tsx.
// Una parte que no se pudo leer va en null y en `faltan`: la copia de lo demás se guarda igual.
// Medido el 28/10/2026: el negocio más grande tiene 1.173 leads y el Plan más grande 630 tareas (menos de 3 MB en JSON).
// =============================================================================

import 'server-only';
import { tableroCrm, type TableroCrmM } from '@/app/m/crm/datos';
import { listarFunnels } from '@/lib/funnels';
import { leerPlanHoyConTablero } from '@/lib/plan-hoy';
import { leerColumnasPlan } from '@/lib/plan-columnas-server';
import { proyectosDelTablero, recurrentesDelTablero, tareasDelTablero } from '@/app/m/plan/tableros';
import { getTenantDb, getWorkspace } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { VERSION_COPIA, type CopiaV1, type NotaCopia, type PlanCopia } from '@/lib/sin-conexion/reglas';

/** Tarjetas por columna: todas, con un techo por si un negocio tiene una columna gigante. */
export const TOPE_COLUMNA_COPIA = 3_000;
/** Las notas que viajan por lead, y cuántas filas del historial se leen como mucho. */
export const NOTAS_POR_LEAD = 5;
export const TOPE_FILAS_NOTAS = 3_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function crmDeLaCopia(): Promise<NonNullable<CopiaV1['crm']>> {
  const funnels = await listarFunnels().catch(() => []);
  // El del negocio primero (null), después los demás: el mismo orden del selector.
  const ids: Array<number | null> = [null, ...funnels.filter((f) => !f.esDefault).map((f) => f.id)];
  const tableros: TableroCrmM[] = [];
  for (const id of ids) {
    const t = await tableroCrm(id, { tope: TOPE_COLUMNA_COPIA, conContacto: true });
    if (t) tableros.push(t);
    else if (id == null) throw new Error('no se pudo leer el tablero del negocio');
  }
  const enTablero = new Set(tableros.flatMap((t) => t.tarjetas.map((c) => c.id)));
  return { tableros, notas: await notasDe(enTablero) };
}

/** Las últimas notas de los leads de la copia, con el nombre de quien la escribió. Sin leer, ninguna (no tumba la copia). */
async function notasDe(leads: Set<number>): Promise<Record<string, NotaCopia[]>> {
  try {
    const { data, error } = await (await getTenantDb()).from('lead_audit')
      .select('lead_id, valor_nuevo, autor, created_at')
      .eq('campo', 'Nota')
      .order('created_at', { ascending: false })
      .limit(TOPE_FILAS_NOTAS);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as Array<{ lead_id: number | string; valor_nuevo: string | null; autor: string | null; created_at: string }>;
    const emails = [...new Set(filas.map((f) => f.autor ?? '').filter((a) => a.includes('@')))];
    const nombres = new Map<string, string>();
    if (emails.length) {
      const { data: us } = await getSupabaseServer().from('usuarios').select('email, nombre').in('email', emails);
      for (const u of (us ?? []) as Array<{ email: string; nombre: string | null }>) nombres.set(u.email, u.nombre?.trim() || u.email.split('@')[0]);
    }
    const out: Record<string, NotaCopia[]> = {};
    for (const f of filas) {
      const id = Number(f.lead_id);
      const texto = (f.valor_nuevo ?? '').trim();
      if (!leads.has(id) || !texto) continue;
      const lista = (out[id] ??= []);
      if (lista.length >= NOTAS_POR_LEAD) continue;
      const autor = f.autor ?? '';
      lista.push({ texto, cuando: f.created_at, autor: nombres.get(autor) ?? (autor.includes('@') ? autor.split('@')[0] : autor) });
    }
    return out;
  } catch (e) {
    console.error(`[sin-conexion] notas: ${msg(e)}`);
    return {};
  }
}

async function planDeLaCopia(): Promise<PlanCopia> {
  const [{ plan, tareas, proyectos }, columnas] = await Promise.all([leerPlanHoyConTablero(), leerColumnasPlan()]);
  const kanban = tareasDelTablero({ tareas, proyectos, hoy: plan.fecha, conNum: plan.tablero === 'dueno', columnas });
  return {
    fecha: plan.fecha,
    prioridades: plan.prioridades,
    columnas: kanban.columnas,
    tareas: kanban.tareas,
    proyectos: proyectosDelTablero({ tareas, proyectos }),
    recurrentes: recurrentesDelTablero({ tareas, proyectos }),
    recortado: plan.recortado,
  };
}

export async function armarCopia(p: { ws: number; persona: string }): Promise<CopiaV1> {
  const [negocio, tz] = await Promise.all([
    getWorkspace(p.ws).catch(() => null),
    tzDeWorkspace(p.ws).catch(() => TZ_DEFAULT),
  ]);
  const faltan: string[] = [];
  const [crm, plan] = await Promise.all([
    crmDeLaCopia().catch((e) => { console.error(`[sin-conexion] crm ws ${p.ws}: ${msg(e)}`); faltan.push('el CRM'); return null; }),
    planDeLaCopia().catch((e) => { console.error(`[sin-conexion] plan ws ${p.ws}: ${msg(e)}`); faltan.push('el Plan'); return null; }),
  ]);
  return {
    version: VERSION_COPIA,
    hecha: new Date().toISOString(),
    tz,
    negocio: { id: p.ws, nombre: negocio?.nombre?.trim() || `Negocio ${p.ws}` },
    persona: { nombre: p.persona },
    crm,
    plan,
    faltan,
  };
}
