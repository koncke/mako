// =============================================================================
// su-clave — el fallo de la clave del NEGOCIO queda escrito, y «Tus cuentas de IA» lo muestra (IA3, 22/10/2026)
// =============================================================================
// Las reglas (el motivo corto, la marca, la línea de la tarjeta) están en lib/su-clave-reglas.ts. Acá lo que toca la base
// y la red:
//   · `anotarFalloDeSuClave`: la fila del fallo, en el negocio que la pidió y sólo si la clave es SUYA;
//   · `estadoDeSusClaves`: lo que lee la tarjeta (qué claves tiene y su último «anduvo» / «falló»);
//   · `probarSuClave`: el botón «Probar mi clave» del admin, con pedidos que no cobran (count_tokens de Anthropic y la
//     lista de modelos de OpenAI).
// =============================================================================

import 'server-only';
import { recordUsage } from './anthropic-usage';
import { credDelCliente } from './credenciales';
import { susClaves } from './ia-del-negocio';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual, runWithWorkspace, wsSuperAdmin } from './workspace';
import {
  PROVS_SU_CLAVE, estadoDeSuClave, filaDeFallo, motivoCorto, nombreDeSuClave,
  type EstadoSuClave, type FilaUsoClave, type ProvSuClave,
} from './su-clave-reglas';

const CLAVE_DE: Record<ProvSuClave, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'> = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' };

/**
 * Un fallo repetido no llena la tabla: la cascada le vuelve a pegar a la misma clave (hasta 4 intentos si es la última)
 * y cada turno la vuelve a probar. Una fila por negocio, proveedor y motivo cada 5 minutos alcanza para que la tarjeta
 * diga cuándo y por qué. En `globalThis`, como las otras memorias del repo (las instancias de Vercel recargan módulos).
 */
const CADA_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __falloSuClave?: Map<string, number> };
const ultimos = (g.__falloSuClave ??= new Map<string, number>());

/**
 * Anota que la clave del negocio falló. Best-effort: nunca tira, y nunca guarda el texto del proveedor (el 401 de OpenAI
 * trae la clave enmascarada). Sólo en el workspace de un CLIENTE: en el de la plataforma la clave es la de MaKo.
 */
export async function anotarFalloDeSuClave(p: { proveedor: ProvSuClave; error: string; feature?: string; modelo?: string | null }): Promise<void> {
  try {
    const ws = await getWorkspaceActual().catch(() => null);
    if (ws == null || ws === (await wsSuperAdmin().catch(() => null))) return;
    const motivo = motivoCorto(p.error);
    const k = `${ws}:${p.proveedor}:${motivo}`;
    const antes = ultimos.get(k);
    if (antes != null && Date.now() - antes < CADA_MS) return;
    ultimos.set(k, Date.now());
    const fila = filaDeFallo(p.proveedor, p.modelo, motivo);
    console.warn(`[su-clave] ws=${ws}: la clave de ${nombreDeSuClave(p.proveedor)} del negocio falló (${motivo})`);
    await recordUsage(p.feature?.trim() || 'su-clave', fila.model, {}, fila.motivo, p.proveedor, undefined, ws);
  } catch (e) {
    console.warn(`[su-clave] no pude anotar el fallo: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export type SuClaveEnTarjeta = EstadoSuClave & { es: 'propia' | 'copia' | 'ilegible' };

/**
 * Las claves de IA del negocio, con su último «anduvo» y «falló» (30 días). `null` si no se pudo leer: la tarjeta no dice
 * «Todavía no se usó» cuando no sabe (un «no pude leer» no es «no hay»).
 */
export async function estadoDeSusClaves(ws: number): Promise<SuClaveEnTarjeta[] | null> {
  try {
    const guardadas = await susClaves(ws);
    if (!guardadas.length) return [];
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error } = await getSupabaseServer().from('anthropic_usage')
      .select('created_at, provider, model, motivo')
      .eq('workspace_id', ws).in('provider', [...PROVS_SU_CLAVE]).gte('created_at', desde)
      .order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as FilaUsoClave[];
    return PROVS_SU_CLAVE.flatMap((p) => {
      const guardada = guardadas.find((c) => c.clave === CLAVE_DE[p]);
      return guardada ? [{ ...estadoDeSuClave(p, filas), es: guardada.es }] : [];
    });
  } catch (e) {
    console.error(`[su-clave] ws=${ws}: no pude leer el estado de sus claves: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * «Probar mi clave»: un pedido que no cobra. Claude: `count_tokens` (gratis). OpenAI: la lista de modelos. Los dos dicen si
 * la clave es válida; ninguno dice si tiene crédito (eso lo dice la próxima respuesta, y queda en la tarjeta). Si falla,
 * queda la fila como cualquier otro fallo.
 */
export async function probarSuClave(ws: number, proveedor: ProvSuClave): Promise<{ ok: boolean; texto: string }> {
  const nombre = nombreDeSuClave(proveedor);
  let guardada: Awaited<ReturnType<typeof susClaves>>[number] | undefined;
  try { guardada = (await susClaves(ws)).find((c) => c.clave === CLAVE_DE[proveedor]); } catch {
    return { ok: false, texto: 'No pude leer tus claves. Intenta de nuevo en un rato.' };
  }
  if (!guardada) return { ok: false, texto: `No tienes una clave de ${nombre} conectada.` };
  if (guardada.es === 'copia') return { ok: false, texto: `Esa clave de ${nombre} es la de MaKo, no la tuya: pega la de tu cuenta.` };
  if (guardada.es === 'ilegible') return { ok: false, texto: `No puedo leer tu clave de ${nombre}: pégala de nuevo.` };
  const clave = await credDelCliente(CLAVE_DE[proveedor], ws).catch(() => null);
  if (!clave) return { ok: false, texto: 'No pude leer tus claves. Intenta de nuevo en un rato.' };
  let error: string | null = null;
  try {
    const res = proveedor === 'anthropic'
      ? await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
        method: 'POST',
        headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'hola' }] }),
        cache: 'no-store', signal: AbortSignal.timeout(15_000),
      })
      : await fetch('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${clave}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000),
      });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; type?: string; code?: string } };
      error = `HTTP ${res.status} ${body.error?.type ?? ''} ${body.error?.code ?? ''} ${body.error?.message ?? ''}`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (!error) return { ok: true, texto: `Tu clave de ${nombre} es válida.` };
  await runWithWorkspace(ws, () => anotarFalloDeSuClave({ proveedor, error: error!, feature: 'probar-clave', modelo: proveedor === 'anthropic' ? 'count_tokens' : 'models' }));
  return { ok: false, texto: `Tu clave de ${nombre} no anda: ${motivoCorto(error)}.` };
}
