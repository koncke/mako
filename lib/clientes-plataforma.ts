// =============================================================================
// clientes-plataforma — los clientes de MaKo para el super admin: quién es quién y cuánto factura (25/10/2026)
// =============================================================================
// Lo lee la vista Customers (app/customers) y la API (`ver_clientes_de_mako`). Las reglas, en
// lib/clientes-plataforma-reglas.ts. ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta quien llama) y sólo lo
// de la plataforma (sus workspaces, sus cobros, la cartera de las agencias y los códigos de Partners). Nada del negocio
// de un cliente.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { listarWorkspaces, wsSuperAdmin } from './workspace';
import { agenciasHabilitadas, todasLasCarteras } from './agencia';
import { esCarteraVigente } from './agencia-cartera';
import { cobrosDeLugares } from './plan-acceso';
import { enPrueba, enRiesgo, kpisDeClientes, mrrDe, segmentosDe, type CobroMrr, type Segmento } from './clientes-plataforma-reglas';

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
};

export type VistaClientes = {
  filas: FilaCliente[];
  kpis: ReturnType<typeof kpisDeClientes>;
  /** Alguna lectura falló: lo que se muestra puede quedarse corto, y se dice cuál. */
  avisos: string[];
};

/** Quién tiene su link de Partners (el código nace al unirse). */
async function partnersConLink(): Promise<Set<number>> {
  const { data, error } = await getSupabaseServer().from('partner_codigos').select('workspace_id').limit(5000);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ workspace_id: number }>).map((f) => Number(f.workspace_id)));
}

export async function vistaDeClientes(ahoraMs: number = Date.now()): Promise<VistaClientes> {
  const plataforma = await wsSuperAdmin();
  const avisos: string[] = [];
  const conAviso = <T,>(que: string, vacio: T) => (e: unknown): T => {
    avisos.push(`${que}: ${e instanceof Error ? e.message : String(e)}`);
    return vacio;
  };
  const [wss, agencias, carteras, partners, cobros] = await Promise.all([
    listarWorkspaces(),
    agenciasHabilitadas(),
    todasLasCarteras(),
    partnersConLink().catch(conAviso('los Partners', new Set<number>())),
    cobrosDeLugares(plataforma).catch(conAviso('los cobros (el MRR)', [])),
  ]);
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
  const sets = { partners, agencias: new Set(agencias.map((a) => a.ws)), deAgencia };
  const filas: FilaCliente[] = wss.filter((w) => w.id !== plataforma).map((w) => {
    const cs = cobrosDe.get(w.id) ?? [];
    const mrr = mrrDe(cs);
    const ag = deAgencia.get(w.id);
    return {
      ws: w.id, nombre: w.nombre, capa: w.capa, estado: w.estado, creado: w.created_at,
      segmentos: segmentosDe(w.id, sets),
      agencia: ag != null ? (nombre.get(ag) ?? `Workspace ${ag}`) : null,
      mrrUsd: mrr.usd, sinDolares: mrr.sinDolares, prueba: enPrueba(cs), riesgo: enRiesgo(w.estado, cs),
    };
  });
  return { filas, kpis: kpisDeClientes(filas, ahoraMs), avisos };
}
