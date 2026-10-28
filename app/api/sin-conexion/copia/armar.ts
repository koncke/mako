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
import { leerFunnels } from '@/lib/funnels';
import { leerPlanHoyConTablero } from '@/lib/plan-hoy';
import { leerColumnasPlan } from '@/lib/plan-columnas-server';
import { proyectosDelTablero, recurrentesDelTablero, tareasDelTablero } from '@/app/m/plan/tableros';
import { getTenantDb, getWorkspace } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { filasDeNotas } from '@/lib/sin-conexion/notas-copia';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { VERSION_COPIA, type CopiaV1, type NotaCopia, type PlanCopia } from '@/lib/sin-conexion/reglas';

/** Tarjetas por columna: todas, con un techo por si un negocio tiene una columna gigante. */
export const TOPE_COLUMNA_COPIA = 3_000;
/** Las notas que viajan por lead (las filas se leen paginadas y con tope: lib/sin-conexion/notas-copia.ts). */
export const NOTAS_POR_LEAD = 5;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * El CRM de la copia. Lo que falla de una PARTE (el tablero de otro funnel, la lista de funnels, las notas) no tumba el
 * resto: va a `faltan` (en palabras) y a `huecos` (para que la renovación no pise lo que había: `conLoDeAntes`). Sin el
 * tablero del negocio, el CRM entero falla.
 */
async function crmDeLaCopia(faltan: string[], huecos: NonNullable<CopiaV1['huecos']>): Promise<NonNullable<CopiaV1['crm']>> {
  // ⚠️ `leerFunnels` y no `listarFunnels`: ésa NUNCA falla (si la base no contesta devuelve `[]`, «no hay otros funnels»), y
  // la copia guardaba sólo el del negocio sin decir nada. `leerFunnels` devuelve null cuando falla.
  const funnels = await leerFunnels().catch(() => null);
  if (!funnels) {
    faltan.push('los otros funnels del CRM');
    huecos.otrosFunnels = true;
  }
  // El del negocio primero (null), después los demás: el mismo orden del selector.
  const otros = (funnels ?? []).filter((f) => !f.esDefault);
  const ids: Array<number | null> = [null, ...otros.map((f) => f.id)];
  const tableros: TableroCrmM[] = [];
  for (const id of ids) {
    const t = await tableroCrm(id, { tope: TOPE_COLUMNA_COPIA, conContacto: true }).catch((e) => {
      if (id == null) throw e;
      console.error(`[sin-conexion] tablero ${id}: ${msg(e)}`);
      return null;
    });
    if (t) { tableros.push(t); continue; }
    if (id == null) throw new Error('no se pudo leer el tablero del negocio');
    faltan.push(`el CRM de «${otros.find((f) => f.id === id)?.nombre ?? 'otro funnel'}»`);
    (huecos.funnels ??= []).push(id);
  }
  const enTablero = new Set(tableros.flatMap((t) => t.tarjetas.map((c) => c.id)));
  const n = await notasDe(enTablero);
  if (!n) { faltan.push('las notas del CRM'); huecos.notas = true; }
  return { tableros, notas: n?.notas ?? {}, ...(n?.recortado ? { notasRecortadas: true } : {}) };
}

/** Las últimas notas de los leads de la copia, con el nombre de quien la escribió. null = no se pudieron leer. */
async function notasDe(leads: Set<number>): Promise<{ notas: Record<string, NotaCopia[]>; recortado: boolean } | null> {
  try {
    const leido = await filasDeNotas(await getTenantDb(), [...leads]);
    // Las tandas son de leads distintos: el orden de cada lead (lo único que importa) ya viene de la base.
    const filas = leido.filas;
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
    return { notas: out, recortado: leido.recortado };
  } catch (e) {
    console.error(`[sin-conexion] notas: ${msg(e)}`);
    return null;
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

export async function armarCopia(p: { ws: number; persona: string; email: string }): Promise<CopiaV1> {
  const [negocio, tz] = await Promise.all([
    getWorkspace(p.ws).catch(() => null),
    tzDeWorkspace(p.ws).catch(() => TZ_DEFAULT),
  ]);
  const faltan: string[] = [];
  const huecos: NonNullable<CopiaV1['huecos']> = {};
  const [crm, plan] = await Promise.all([
    crmDeLaCopia(faltan, huecos).catch((e) => { console.error(`[sin-conexion] crm ws ${p.ws}: ${msg(e)}`); faltan.push('el CRM'); return null; }),
    planDeLaCopia().catch((e) => { console.error(`[sin-conexion] plan ws ${p.ws}: ${msg(e)}`); faltan.push('el Plan'); return null; }),
  ]);
  return {
    version: VERSION_COPIA,
    hecha: new Date().toISOString(),
    tz,
    negocio: { id: p.ws, nombre: negocio?.nombre?.trim() || `Negocio ${p.ws}` },
    persona: { nombre: p.persona, email: p.email },
    crm,
    plan,
    faltan,
    ...(crm && Object.keys(huecos).length ? { huecos } : {}),
  };
}
