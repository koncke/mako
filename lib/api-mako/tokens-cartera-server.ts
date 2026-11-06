// =============================================================================
// api-mako/tokens-cartera-server — lo que el token de agencia lee de la base en CADA pedido
// =============================================================================
// La regla es pura (tokens-cartera.ts). Acá las lecturas, ESTRICTAS: «no pude leer» TIRA y `autenticar` (http.ts) lo
// contesta 503. `puedeEntrarAhora` y `esAgencia` (lib/agencia.ts) devuelven false ante un error, que para la pantalla está
// bien (fail-closed) y para la API manda a pensar que el cliente se dio de baja cuando lo que pasó es que la base no
// contestó. No se memoiza entre pedidos: el permiso cambia después de acuñar el token.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import { esWsValido, type FilaCartera, clientesAprobados } from '@/lib/agencia-cartera';
import { creadorDeAgenciaConAcceso } from './tokens-cartera';

/** ¿Sigue siendo agencia? La capa `agencia` Y su fila en `agencias` (la misma regla que `esAgencia`, lib/agencia.ts). */
export async function esAgenciaEstricta(ws: number): Promise<boolean> {
  if (!esWsValido(ws)) return false;
  const db = getSupabaseServer();
  const [w, a] = await Promise.all([
    db.from('workspaces').select('capa').eq('id', ws).maybeSingle(),
    db.from('agencias').select('ws').eq('ws', ws).maybeSingle(),
  ]);
  if (w.error) throw new Error(`workspaces: ${w.error.message}`);
  if (a.error) throw new Error(`agencias: ${a.error.message}`);
  return (w.data as { capa?: string } | null)?.capa === 'agencia' && a.data != null;
}

/** La fila de la cartera de ESTA agencia para ESE cliente (sólo ésa: el juicio no necesita las demás). */
export async function carteraParaCliente(agenciaWs: number, clienteWs: number): Promise<FilaCartera[]> {
  const { data, error } = await getSupabaseServer()
    .from('agencia_clientes').select('agencia_ws, cliente_ws, estado')
    .eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).limit(1);
  if (error) throw new Error(`agencia_clientes: ${error.message}`);
  return (data ?? []) as FilaCartera[];
}

/**
 * Los clientes aprobados de la agencia, con su nombre, para el «¿a cuál va?» del 400 (`disponibles`). Sólo lo de ESTA
 * agencia y sólo aprobados: un pendiente o un revocado no se ofrece. Si la base no contesta, lista vacía: es para guiar,
 * no decide nada.
 */
export async function clientesParaElToken(agenciaWs: number): Promise<Array<{ cliente: number; nombre: string }>> {
  try {
    const db = getSupabaseServer();
    const { data, error } = await db.from('agencia_clientes').select('agencia_ws, cliente_ws, estado').eq('agencia_ws', agenciaWs);
    if (error) return [];
    const ids = clientesAprobados(agenciaWs, (data ?? []) as FilaCartera[]);
    if (!ids.length) return [];
    const { data: ws } = await db.from('workspaces').select('id, nombre').in('id', ids);
    const nombre = new Map(((ws ?? []) as Array<{ id: number; nombre: string | null }>).map((w) => [Number(w.id), w.nombre ?? '']));
    return ids.map((id) => ({ cliente: id, nombre: nombre.get(id) || `Cuenta #${id}` }));
  } catch {
    return [];
  }
}

/** ¿Quien creó el token de agencia sigue administrando la agencia? Tira si no puede leer. Sin creador, vale (ver tokens-creador.ts). */
export async function creadorDeAgenciaVigente(agenciaWs: number, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return true;
  return creadorDeAgenciaConAcceso(agenciaWs, await buscarUsuarioPorEmail(e));
}
