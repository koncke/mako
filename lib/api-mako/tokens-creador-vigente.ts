// =============================================================================
// api-mako/tokens-creador-vigente — ¿quien acuñó un token sigue administrando el workspace?
// =============================================================================
// El juicio es puro y vive en tokens-creador.ts (`creadorConAcceso`); acá está la LECTURA de la
// base que lo alimenta, con su memoria de un minuto. Vivía adentro de tokens.ts y se mudó acá el
// 14/10/2026 porque desde ese día la usan las DOS clases de token: los detallados de /api/v1
// (tokens.ts) y el clásico de la skill (lib/agente-token.ts). El clásico no puede importar
// tokens.ts: ésa es LA FRONTERA que fija tests/api-mako-tokens.test.ts (/api/agente pasaría a
// aceptar tokens con nombre), así que la lectura compartida tiene que estar afuera de los dos.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import type { FilaCartera } from '@/lib/agencia-cartera';
import { creadorConAcceso } from './tokens-creador';

/**
 * ¿Quien creó un token de `ws` sigue administrándolo? (el juicio, en tokens-creador.ts).
 *
 * Se mira en CADA pedido, como el permiso de agencia: una persona sale del negocio después de
 * acuñar el token. Con un minuto de memoria por (workspace, email) —la clave lleva el ws: esta
 * caché es de todos los inquilinos del proceso— para no sumar dos lecturas a cada llamada; o
 * sea que sacar a alguien apaga sus tokens en menos de un minuto.
 *
 * `fresco` saltea la memoria (y la renueva con lo leído): lo pide la revocación, que corre justo
 * después de sacarle el acceso a alguien y no puede creerle a un «sí» de hace 59 segundos.
 *
 * «No pude leer» TIRA (lo contesta 503, como el resto del resolvedor): un corte de la base no
 * puede decir «tu token dejó de valer» sobre uno bueno.
 */
const CREADOR_TTL_MS = 60_000;
const creadoresVistos = new Map<string, { ok: boolean; hasta: number }>();
export async function creadorVigente(ws: number, email: string, fresco = false): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return true;   // sin creador no hay a quién revisar (ver tokens-creador.ts)
  const clave = `${ws}|${e}`;
  const visto = creadoresVistos.get(clave);
  if (!fresco && visto && visto.hasta > Date.now()) return visto.ok;
  const u = await buscarUsuarioPorEmail(e);
  let cartera: FilaCartera[] = [];
  if (u && u.rol !== 'admin' && u.workspace_id != null && u.workspace_id !== ws) {
    const { data, error } = await getSupabaseServer()
      .from('agencia_clientes').select('agencia_ws, cliente_ws, estado')
      .eq('agencia_ws', u.workspace_id).eq('cliente_ws', ws).limit(1);
    if (error) throw new Error(`agencia_clientes: ${error.message}`);
    cartera = (data ?? []) as FilaCartera[];
  }
  const ok = creadorConAcceso(ws, u, cartera);
  creadoresVistos.set(clave, { ok, hasta: Date.now() + CREADOR_TTL_MS });
  return ok;
}
