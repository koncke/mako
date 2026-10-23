// =============================================================================
// Las cuentas publicitarias de los PORTAFOLIOS del token (business_management)
// =============================================================================
// `/me/adaccounts` trae sólo las cuentas asignadas al usuario del sistema. Una
// cuenta que es del portafolio (o que el portafolio administra para un cliente)
// pero que nadie le asignó no aparecía para elegir: el 23/10/2026 la segunda
// cuenta del portafolio de Sergio (ws20) se leía con su token y MaKo no la
// ofrecía (docs/hallazgos-ads.md, «Creé la campaña en Meta y no me aparece»).
//
// Es además el uso real de `business_management` que pide la revisión de la app
// MaKo (segunda tanda, 23/10): `/me/businesses` y las cuentas de cada portafolio.
//
// SIN `server-only` y con el GET inyectado: la regla la ejecuta un test sin red.
// Nunca tira y nunca agrega avisos: un token sin `business_management` (los de
// apps propias de los clientes, o el del botón mientras Meta no lo da) sigue
// exactamente como antes, con lo de `/me/adaccounts`.
// =============================================================================

export type CuentaListada = { id: string; nombre: string; activa: boolean; moneda?: string };

type Json = Record<string, unknown>;
/** El mismo contrato que el `get` de lib/meta-descubrir.ts: el error de Meta en `error`, nunca un throw. */
export type GetGraph = (path: string, params?: Record<string, string>) => Promise<{ body: Json; error?: string }>;

/** Topes: un portafolio de agencia puede tener cientos de cuentas, y cada una nueva cuesta un GET de prueba. */
export const MAX_PORTAFOLIOS = 10;
export const MAX_CUENTAS_NUEVAS = 25;

const arr = (b: Json): Json[] => (Array.isArray(b.data) ? (b.data as Json[]) : []);
const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/**
 * Las cuentas de los portafolios que NO estaban en `yaVistas` y que el token PUEDE leer.
 *
 * ⚠️ Se prueba cada una con un GET antes de ofrecerla: el portafolio lista también cuentas
 * a las que este usuario del sistema no tiene acceso, y Meta contesta ese «no» con un error
 * dentro de un 200 (`#200 Ad account owner has NOT grant…`, medido el 23/10 con el token del
 * ws1 contra una cuenta del portafolio de Sergio). Ofrecerla daría una conexión que no lee.
 */
export async function cuentasDePortafolios(get: GetGraph, yaVistas: ReadonlySet<string>): Promise<CuentaListada[]> {
  // ⚠️ DOS fuentes de portafolios: para un USUARIO DEL SISTEMA, `/me/businesses` devuelve `[]` sin error
  // (medido el 23/10 con los tokens de ws20 y ws22), así que el portafolio sale también del `business` de
  // sus cuentas. Es un pedido APARTE del de `/me/adaccounts` del descubrimiento: si a un token sin
  // `business_management` el campo le diera error, acá se pierde sólo esto y no la lista de cuentas.
  const [bs, dueños] = await Promise.all([
    get('/me/businesses', { fields: 'id', limit: String(MAX_PORTAFOLIOS) }),
    get('/me/adaccounts', { fields: 'business{id}', limit: '50' }),
  ]);
  const deMe = bs.error ? [] : arr(bs.body).map((b) => s(b.id));
  const deCuentas = dueños.error ? [] : arr(dueños.body).map((c) => s((c.business as Json | undefined)?.id));
  const portafolios = [...new Set([...deMe, ...deCuentas].filter(Boolean))].slice(0, MAX_PORTAFOLIOS);
  if (!portafolios.length) return [];

  const listas = await Promise.all(portafolios.flatMap((id) => (['owned_ad_accounts', 'client_ad_accounts'] as const).map(
    (edge) => get(`/${id}/${edge}`, { fields: 'id,name,account_status,currency', limit: '50' }),
  )));

  const candidatas = new Map<string, CuentaListada>();
  for (const l of listas) {
    if (l.error) continue;
    for (const c of arr(l.body)) {
      const id = s(c.id);
      if (!id || yaVistas.has(id) || candidatas.has(id)) continue;
      candidatas.set(id, { id, nombre: s(c.name) || id, activa: Number(c.account_status) === 1, moneda: s(c.currency) || undefined });
    }
  }

  const aProbar = [...candidatas.values()].slice(0, MAX_CUENTAS_NUEVAS);
  const pruebas = await Promise.all(aProbar.map((c) => get(`/${c.id}`, { fields: 'id' })));
  return aProbar.filter((_, i) => !pruebas[i].error);
}
