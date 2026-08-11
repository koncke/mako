// =============================================================================
// cs-cartera — la cartera del programa, como la mira Mauricio antes de la semana
// =============================================================================
// Contesta las tres preguntas que hoy solo se podían contestar entrando a la
// base, y en el orden en que le importan:
//
//   1. ¿A quién le toca que YO haga algo?   → esperando su ok, o vio y no contestó
//   2. ¿Quién se quedó?                     → días sin tocar nada
//   3. ¿En qué bloque va cada uno?
//
// El ORDEN de la lista no es alfabético ni por fecha: es por urgencia. Una lista
// de 13 clientes ordenada por id obliga a leerla entera todas las semanas para
// encontrar los dos que importan.

import 'server-only';
import { getTenantDb } from './workspace';
import { listarShares } from './shares';
import { bloquesDeCliente, type Bloque } from './cs-respuestas';
import { TOTAL_CLASES, rotuloDe, PROGRAMA } from './programa-catalogo';

export const RECURSO_TAREA = 'tarea-cs';

export type ClienteCartera = {
  leadId: number;
  nombre: string;
  email: string | null;
  /** Cuántos links VIVOS tiene. Más de uno es un problema: dos formas de entrar
   *  y una sola que alguien se acuerde de revocar. */
  links: number;
  contestados: number;
  aprobados: number;
  /** Vio la clase en Whop y no contestó la tarea. Dispara el recordatorio. */
  vistosSinContestar: number;
  /** MaKo ya reescribió y el cliente todavía no aprobó. Es lo más urgente: está
   *  frenado esperándolo a él, no a Mauricio. */
  esperandoSuOk: number;
  /** Días desde que tocó algo. null = nunca tocó nada. */
  diasSinTocar: number | null;
  /** El bloque en el que está parado, para saber de qué hablar en la sesión. */
  bloqueActual: string | null;
};

const dias = (iso: string | null): number | null =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

/** El bloque donde está parado: el que espera su ok gana, después el primero sin
 *  contestar. Es la misma regla con la que abre su pantalla. */
function bloqueActual(filas: Bloque[]): string | null {
  const esperando = filas.find(f => f.estado === 'revisada_ia');
  if (esperando) return rotuloDe(esperando.clase_id);
  const contestadas = new Set(filas.filter(f => f.estado !== 'pendiente').map(f => f.clase_id));
  for (const m of PROGRAMA) {
    for (const c of m.clases) if (!contestadas.has(c.id)) return rotuloDe(c.id);
  }
  return null;
}

export async function cartera(): Promise<ClienteCartera[]> {
  const db = await getTenantDb();
  const { data } = await db.from('leads')
    .select('id, nombre, email').eq('estado_lead', 'ganado').order('id');
  const leads = (data as { id: number; nombre: string; email: string | null }[] | null) ?? [];

  // Los shares se piden UNA vez para todos, no uno por cliente: 13 clientes eran
  // 13 consultas idénticas a una tabla que no está scopeada por workspace.
  const shares = await listarShares(await wsDeLaSesion(), RECURSO_TAREA).catch(() => []);
  const vivosPorLead = new Map<string, number>();
  for (const s of shares as { recurso_id?: unknown; revocado_at?: string | null }[]) {
    if (s.revocado_at) continue;
    const k = String(s.recurso_id ?? '');
    vivosPorLead.set(k, (vivosPorLead.get(k) ?? 0) + 1);
  }

  const filas = await Promise.all(leads.map(async (l) => {
    const bs = await bloquesDeCliente(l.id).catch(() => [] as Bloque[]);
    const ultimo = bs.map(b => b.updated_at).sort().at(-1) ?? null;
    return {
      leadId: l.id,
      nombre: l.nombre,
      email: l.email,
      links: vivosPorLead.get(String(l.id)) ?? 0,
      contestados: bs.filter(b => b.estado !== 'pendiente').length,
      aprobados: bs.filter(b => b.estado === 'aprobada').length,
      vistosSinContestar: bs.filter(b => b.visto_at && b.estado === 'pendiente').length,
      esperandoSuOk: bs.filter(b => b.estado === 'revisada_ia').length,
      diasSinTocar: dias(ultimo),
      bloqueActual: bloqueActual(bs),
    } satisfies ClienteCartera;
  }));

  // Por URGENCIA, no por id: primero el que está frenado esperando su ok,
  // después el que vio y no contestó, después el que hace más que no toca nada.
  return filas.sort((a, b) =>
    b.esperandoSuOk - a.esperandoSuOk ||
    b.vistosSinContestar - a.vistosSinContestar ||
    (b.diasSinTocar ?? -1) - (a.diasSinTocar ?? -1) ||
    a.nombre.localeCompare(b.nombre));
}

/** El workspace de la sesión, para `listarShares` — que NO está scopeada por
 *  `getTenantDb` a propósito (mig 0098: la resolución token→workspace es
 *  cross-workspace por diseño), así que hay que pasárselo explícito. */
async function wsDeLaSesion(): Promise<number> {
  const { getWorkspaceActual, OWNER_WS } = await import('./workspace');
  return (await getWorkspaceActual()) ?? OWNER_WS;
}

export const TOTAL = TOTAL_CLASES;
