// =============================================================================
// El residuo contra la base: a quién inscribir, si sigue siéndolo al mandar, y
// a qué hora le toca
// =============================================================================
// La DECISIÓN vive en lib/nutricion-residuo.ts (pura, con test). Acá sólo se lee
// lo que esa decisión necesita y se le pasa. Es un módulo aparte de
// lib/nutricion.ts para que el motor sólo tenga que llamar tres funciones: ese
// archivo lo tocan varias sesiones a la vez.
//
// Todo lo que se lee va PAGINADO (lib/supabase-paginado.ts) y por TANDAS de 200
// ids: una lista de candidatos de cien ids en un `.in()` suelto es la otra forma
// de truncar sin un error.
//
// ⚠️ `db` TIENE QUE SER EL CLIENTE DE `getTenantDb()`. El scoping por workspace lo
// pone ese proxy; este módulo no sabe de inquilinos.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerTodo, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { enTandas } from '@/lib/ids-con-filas';
import {
  COLS_RESIDUO, ESTADOS_OCUPADO, TRIGGER_RESIDUO,
  esResiduo, soloDigitos, turnosResiduo,
  type CtxResiduo, type LeadResiduo,
} from '@/lib/nutricion-residuo';

const TANDA = 200;

type Prefiltro = {
  eq(col: string, val: unknown): Prefiltro;
  is(col: string, val: null): Prefiltro;
  not(col: string, op: string, val: null): Prefiltro;
};

/**
 * Las secuencias del residuo, ARCHIVADAS INCLUIDAS: una inscripción en una
 * secuencia del residuo que ya se archivó sigue diciendo «a este lead ya se le
 * mandó la reactivación».
 */
async function secuenciasDelResiduo(db: SupabaseClient): Promise<Set<number>> {
  const filas = await leerTodo<{ id: number }>(db, 'nutricion_secuencias', 'id', {
    orden: 'id', eq: { trigger_tipo: TRIGGER_RESIDUO },
  });
  return new Set(filas.map((f) => f.id));
}

/**
 * Lo que la decisión necesita saber de estos leads: quién pagó, qué teléfonos
 * están bloqueados, quién está ocupado en OTRA secuencia, y —aparte— quién ya
 * pasó por el residuo alguna vez (`yaEnResiduo`).
 *
 * Una lectura que falla TIRA. «No pude leer los pagos» no es «nadie pagó»: es la
 * dirección que le manda una reactivación a un cliente.
 */
async function contextoDe(db: SupabaseClient, leadIds: readonly number[], ahoraMs: number): Promise<{ ctx: CtxResiduo; yaEnResiduo: Set<number> }> {
  const delResiduo = await secuenciasDelResiduo(db);
  const pagados = new Set<number>();
  const ocupados = new Set<number>();
  const yaEnResiduo = new Set<number>();
  for (const tanda of enTandas([...new Set(leadIds)], TANDA)) {
    const pagos = await leerTodo<{ lead_id: number | null }>(db, 'pagos', 'id, lead_id', {
      orden: 'id', eq: { pagado: true }, filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
    });
    for (const p of pagos) if (p.lead_id != null) pagados.add(Number(p.lead_id));
    const insc = await leerTodo<{ lead_id: number | null; secuencia_id: number | null; estado: string | null }>(
      db, 'nutricion_inscripciones', 'id, lead_id, secuencia_id, estado',
      { orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada },
    );
    for (const i of insc) {
      if (i.lead_id == null) continue;
      const lead = Number(i.lead_id);
      if (i.secuencia_id != null && delResiduo.has(Number(i.secuencia_id))) yaEnResiduo.add(lead);
      else if (ESTADOS_OCUPADO.includes(i.estado ?? '')) ocupados.add(lead);
    }
  }
  const bloq = await leerTodo<{ telefono: string | null }>(db, 'wa_bloqueados', 'id, telefono', { orden: 'id' });
  const bloqueados = new Set(bloq.map((b) => soloDigitos(b.telefono)).filter(Boolean));
  return { ctx: { ahoraMs, pagados, bloqueados, ocupados }, yaEnResiduo };
}

/**
 * La cohorte del trigger `residuo_sin_cierre`: los que tuvieron reunión hace más
 * de 45 días, abiertos y sin pago, menos quien ya pasó por el residuo (una vez
 * por lead, como la familia de la post-agenda: la regla es de FAMILIA, no de
 * secuencia, para que dos secuencias del residuo no le manden dos reactivaciones).
 *
 * `conAmbito` es el filtro del embudo de la secuencia, que el motor ya resolvió.
 *
 * El prefiltro del server pide `fecha_junta_1`: el residuo con reunión siempre
 * tiene una R1. Medido en ws1 el 06/10/2026: 0 leads con R2 y sin R1, y 0 con la
 * hora de la R1 (`junta_1_at`) y sin la fecha.
 */
export async function cohorteResiduo(
  db: SupabaseClient,
  conAmbito: (q: ConsultaPaginada) => ConsultaPaginada,
  ahoraMs: number = Date.now(),
): Promise<number[]> {
  let leads: LeadResiduo[];
  try {
    leads = await leerTodo<LeadResiduo>(db, 'leads', COLS_RESIDUO, {
      orden: 'id',
      // La firma mínima que se usa: encadenar los tres sobre el tipo de supabase-js
      // revienta el typecheck («excessively deep»), igual que en lib/email-marketing.ts.
      filtros: (q) => conAmbito((q as unknown as Prefiltro)
        .eq('estado_lead', 'abierto')
        .is('fecha_primer_pago', null)
        .not('fecha_junta_1', 'is', null) as unknown as ConsultaPaginada),
    });
    if (leads.length === 0) return [];
    const { ctx, yaEnResiduo } = await contextoDe(db, leads.map((l) => l.id), ahoraMs);
    return leads.filter((l) => !yaEnResiduo.has(l.id) && esResiduo(l, ctx)).map((l) => l.id);
  } catch (e) {
    throw new Error(`cohorte ${TRIGGER_RESIDUO}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * De estos leads, los que SIGUEN siendo residuo AHORA. Lo llama el motor al
 * mandar cada paso de una secuencia del residuo (ver `esResiduo`).
 *
 * Acá NO se mira `yaEnResiduo`: el lead está, por definición, en la secuencia
 * que lo está por mandar.
 */
export async function residuoVigente(db: SupabaseClient, leadIds: readonly number[], ahoraMs: number = Date.now()): Promise<Set<number>> {
  const ids = [...new Set(leadIds)];
  if (ids.length === 0) return new Set();
  const leads: LeadResiduo[] = [];
  for (const tanda of enTandas(ids, TANDA)) {
    leads.push(...await leerTodo<LeadResiduo>(db, 'leads', COLS_RESIDUO, {
      orden: 'id', filtros: (q) => q.in('id', tanda) as ConsultaPaginada,
    }));
  }
  const { ctx } = await contextoDe(db, ids, ahoraMs);
  return new Set(leads.filter((l) => esResiduo(l, ctx)).map((l) => l.id));
}

/**
 * El horario del primer paso para los leads nuevos del residuo, ESCALONADO
 * (`turnosResiduo`) desde el último primer turno que ya está agendado y todavía
 * no salió, en CUALQUIER secuencia del residuo.
 *
 * Lo comparten el dry-run y el commit, igual que el resto de los horarios: si sólo
 * escalonara el commit, la vista previa prometería que los 63 salen hoy.
 *
 * ⚠️ LO QUE NO VE: si todos los primeros turnos ya salieron, arranca desde ahora,
 * aunque el último haya salido hace una hora. En el peor caso sale un turno de más
 * dentro de un mismo espacio; contarlo exigiría leer `nutricion_envios`, y para el
 * goteo de leads que cumplen 45 días cada día no cambia nada.
 */
export async function horariosResiduo(
  db: SupabaseClient,
  o: { pendientes: readonly number[]; pasos: number; delayHoras: number; ahoraMs?: number },
): Promise<Map<number, string>> {
  const ahoraMs = o.ahoraMs ?? Date.now();
  if (o.pendientes.length === 0) return new Map();
  const delResiduo = [...await secuenciasDelResiduo(db)];
  let ultimoMs: number | null = null;
  if (delResiduo.length) {
    const { data, error } = await db.from('nutricion_inscripciones')
      .select('proximo_envio_at')
      .eq('estado', 'activa')
      .eq('paso_actual', 0)
      .in('secuencia_id', delResiduo)
      .not('proximo_envio_at', 'is', null)
      .order('proximo_envio_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`horariosResiduo: ${error.message}`);
    const ms = Date.parse(((data ?? []) as Array<{ proximo_envio_at: string | null }>)[0]?.proximo_envio_at ?? '');
    ultimoMs = Number.isFinite(ms) ? ms : null;
  }
  const turnos = turnosResiduo({
    desdeMs: ahoraMs + Math.max(0, o.delayHoras) * 3_600_000,
    ultimoMs,
    n: o.pendientes.length,
    pasos: o.pasos,
  });
  return new Map(o.pendientes.map((id, k) => [id, new Date(turnos[k]).toISOString()]));
}
