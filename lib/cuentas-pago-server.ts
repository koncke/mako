// =============================================================================
// cuentas-pago-server — las cuentas de Stripe y Mercado Pago de un negocio (varias por proveedor, 22/10/2026)
// =============================================================================
// El modelo está en lib/cuentas-integracion.ts (una cuenta = un sufijo en el nombre de sus claves). Acá, lo que lee la base:
//   · `cuentasDePago(ws)`: las cuentas del negocio con su nombre y si cobran (las tres claves de Stripe; token e id en MP);
//   · `credStripeDe` / `credMpDe`: las claves de UNA cuenta;
//   · `cuentaDeIdentificador`: de qué cuenta del negocio es un `acct_…` o un `user_id` (lo usan los avisos de pago).
// Las claves se leen con `credDelCliente` y nada más (AGENTS.md, «Un cobro pasa por lib/cobros.ts…»).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { auditarCredencial, clavesGuardadasConBase, credDelCliente, credWsEstricta, eliminarCredencial, guardarCredencial } from './credenciales';
import {
  CLAVES_BASE, CUENTA_PRINCIPAL, aliasLimpio, claveDeCuenta, cuentaDeClave, idDeCuenta, nombreDeCuenta, partirIdDeCuenta, proximaCuenta,
  type ProveedorConCuentas,
} from './cuentas-integracion';

export type CuentaDePago = {
  /** `stripe:principal`, `mercadopago:c2`. */
  id: string;
  proveedor: ProveedorConCuentas;
  cuenta: string;
  nombre: string;
  principal: boolean;
  /** Cobra: Stripe con su clave, el id de la cuenta y la firma del aviso; Mercado Pago con su token y el id. */
  conectada: boolean;
  /** Tiene guardado el secreto de su aviso (en Mercado Pago es opcional: sin él, sus suscripciones no renuevan en el CRM). */
  conAviso: boolean;
};

const PROVEEDORES: readonly ProveedorConCuentas[] = ['stripe', 'mercadopago'];

/** Las cuentas (por su sufijo) que tienen ALGUNA clave guardada de ese proveedor. La principal primero. */
function cuentasDeNombres(nombres: readonly string[]): string[] {
  const set = new Set<string>();
  for (const n of nombres) { const c = cuentaDeClave(n); if (c) set.add(c); }
  return [...set].sort((a, b) => (a === CUENTA_PRINCIPAL ? -1 : b === CUENTA_PRINCIPAL ? 1 : Number(a.slice(1)) - Number(b.slice(1))));
}

/**
 * Las cuentas de pago del negocio, de los dos proveedores, con su nombre. Tira si no puede leer (el modal de «Vincular
 * cobro» dice el error, no «no hay cuentas»). Sólo las que tienen algo guardado; `conectada` dice si cobran.
 */
export async function cuentasDePago(ws: number, soloProveedor?: ProveedorConCuentas): Promise<CuentaDePago[]> {
  const out: CuentaDePago[] = [];
  for (const p of soloProveedor ? [soloProveedor] : PROVEEDORES) {
    const b = CLAVES_BASE[p];
    const nombres = await clavesGuardadasConBase(ws, [b.clave, b.identificador, b.secretoAviso, b.alias]);
    for (const cuenta of cuentasDeNombres(nombres)) {
      const tiene = (base: string) => nombres.includes(claveDeCuenta(base, cuenta));
      const conectada = p === 'stripe' ? tiene(b.clave) && tiene(b.identificador) && tiene(b.secretoAviso) : tiene(b.clave) && tiene(b.identificador);
      // Una cuenta con sólo el nombre guardado (quedó de una desconexión a medias) no es una cuenta.
      if (!tiene(b.clave) && !tiene(b.identificador)) continue;
      const alias = tiene(b.alias) ? await credDelCliente(claveDeCuenta(b.alias, cuenta), ws) : null;
      out.push({ id: idDeCuenta(p, cuenta), proveedor: p, cuenta, nombre: nombreDeCuenta(p, cuenta, alias), principal: cuenta === CUENTA_PRINCIPAL, conectada, conAviso: tiene(b.secretoAviso) });
    }
  }
  return out;
}

/**
 * Los sufijos que ya nombra algún cobro o vínculo del negocio. Una cuenta desconectada deja sus cobros (`cobros.cuenta`)
 * y sus vínculos (`cobro_etapa_vinculos.cuentas`): si la próxima cuenta reusara su `c2`, un link pendiente de la vieja se
 * pagaría con las claves de la nueva y un reembolso iría a otra cuenta de Stripe. Tira si no puede leer: mejor no conectar.
 */
async function sufijosUsados(ws: number, p: ProveedorConCuentas): Promise<string[]> {
  const db = getSupabaseServer();
  const [c, v] = await Promise.all([
    db.from('cobros').select('cuenta').eq('workspace_id', ws).eq('proveedor', p).not('cuenta', 'is', null).limit(5000),
    db.from('cobro_etapa_vinculos').select('cuentas').eq('workspace_id', ws).limit(5000),
  ]);
  if (c.error) throw new Error(`No pude leer las cuentas de los cobros: ${c.error.message}`);
  // Sin la 0326 no hay vínculos (como `cuentasDelVinculoDelProducto`): no es un error, es «ninguno».
  const sinVinculos = !!v.error && (v.error.code === 'PGRST205' || v.error.code === '42P01' || /cobro_etapa_vinculos/i.test(v.error.message ?? ''));
  if (v.error && !sinVinculos) throw new Error(`No pude leer las cuentas de los vínculos: ${v.error.message}`);
  const out = new Set<string>();
  for (const f of (c.data ?? []) as Array<{ cuenta: string | null }>) if (f.cuenta) out.add(f.cuenta);
  for (const f of (sinVinculos ? [] : v.data ?? []) as Array<{ cuentas: string[] | null }>) {
    for (const id of f.cuentas ?? []) { const x = partirIdDeCuenta(id); if (x && x.proveedor === p) out.add(x.cuenta); }
  }
  return [...out];
}

/** La cuenta que sigue para conectar otra de ese proveedor (`c2`, `c3`…): nunca una que ya nombre un cobro o un vínculo. */
export async function proximaCuentaDe(ws: number, p: ProveedorConCuentas): Promise<string> {
  const b = CLAVES_BASE[p];
  const [nombres, usados] = await Promise.all([clavesGuardadasConBase(ws, [b.clave, b.identificador, b.secretoAviso, b.alias]), sufijosUsados(ws, p)]);
  return proximaCuenta([...cuentasDeNombres(nombres), ...usados]);
}

/** Las claves de UNA cuenta de Stripe, si cobra (las tres: sin la firma del aviso, su pago nunca volvería al CRM). */
export async function credStripeDe(ws: number, cuenta: string = CUENTA_PRINCIPAL): Promise<{ pasarela: 'stripe'; key: string; acct: string; cuenta: string } | null> {
  const b = CLAVES_BASE.stripe;
  const [key, acct, secreto] = await Promise.all([
    credDelCliente(claveDeCuenta(b.clave, cuenta), ws),
    credDelCliente(claveDeCuenta(b.identificador, cuenta), ws),
    credDelCliente(claveDeCuenta(b.secretoAviso, cuenta), ws),
  ]);
  return key && acct && secreto ? { pasarela: 'stripe', key, acct: acct.trim(), cuenta } : null;
}

/** Las claves de UNA cuenta de Mercado Pago, si cobra. */
export async function credMpDe(ws: number, cuenta: string = CUENTA_PRINCIPAL): Promise<{ pasarela: 'mercadopago'; token: string; userId: string; cuenta: string } | null> {
  const b = CLAVES_BASE.mercadopago;
  const [token, userId] = await Promise.all([
    credDelCliente(claveDeCuenta(b.clave, cuenta), ws),
    credDelCliente(claveDeCuenta(b.identificador, cuenta), ws),
  ]);
  return token && userId ? { pasarela: 'mercadopago', token, userId: userId.trim(), cuenta } : null;
}

/**
 * De qué cuenta del negocio es este identificador (el `acct_…` de Stripe, el `user_id` de Mercado Pago). null si no es de
 * ninguna. Lo usan los avisos de pago: el ruteo dice el NEGOCIO; esto, con qué claves verificar y releer.
 * ESTRICTA: tira si no puede leer. Con la base caída, un null («de ninguna») hacía releer con la principal un aviso de la
 * segunda cuenta de Mercado Pago, que se ignoraba con un 200 y no volvía (MP no reintenta un 200).
 */
export async function cuentaDeIdentificador(ws: number, p: ProveedorConCuentas, identificador: string | null | undefined): Promise<string | null> {
  const id = (identificador ?? '').trim();
  if (!id) return null;
  const b = CLAVES_BASE[p];
  const nombres = (await clavesGuardadasConBase(ws, [b.identificador])).filter((n) => cuentaDeClave(n));
  // En paralelo: la usan /pagar y los avisos, y una por una sumaba dos lecturas por cuenta en serie.
  const halladas = await Promise.all(nombres.map(async (n) => {
    // La estricta pregunta «¿pude leer?» (tira si no) y la del cliente da el valor: el mismo par que `credPasarela`.
    await credWsEstricta(n, ws);
    const v = await credDelCliente(n, ws);
    return v && v.trim() === id ? cuentaDeClave(n) : null;
  }));
  return halladas.find((x) => x != null) ?? null;
}

/**
 * El sufijo que usaron los cobros de esa cuenta del proveedor (el más nuevo): `undefined` si no tiene cobros; null es la
 * principal. Tira si no puede leer.
 */
async function sufijoDeSusCobros(ws: number, p: ProveedorConCuentas, ref: string): Promise<string | null | undefined> {
  const { data, error } = await getSupabaseServer().from('cobros').select('cuenta')
    .eq('workspace_id', ws).eq('proveedor', p).eq('cuenta_ref', ref).order('id', { ascending: false }).limit(1);
  if (error) throw new Error(`No pude leer los cobros de esa cuenta: ${error.message}`);
  const f = ((data ?? []) as Array<{ cuenta: string | null }>)[0];
  return f ? f.cuenta : undefined;
}

/**
 * En qué cuenta del negocio entra una clave que se pega en «Conectar otra cuenta» (revisión de plata del 22/10/2026):
 *   1. si volvió una que se fue, en el sufijo de SUS cobros, si está libre: sus links y vínculos lo nombran;
 *   2. si no, la que sigue. La principal sólo si el negocio no tiene ninguna: nunca hereda la principal de otra cuenta.
 * Una cuenta que YA está conectada no entra acá: la conexión contesta «ya está conectada aquí» (`yaConectadaComoOtra`).
 * Cambiarle la clave por este botón la pisaba sin avisar: la de PRUEBA de la misma cuenta de Stripe trae el mismo `acct`,
 * y la principal quedaba cobrando en modo prueba (segunda revisión de plata, 22/10/2026).
 * `ref`: el id en el proveedor (null si la clave no sirve: la conexión lo va a decir).
 */
export async function cuentaParaConectar(ws: number, p: ProveedorConCuentas, ref: string | null): Promise<string> {
  const cuentas = await cuentasDePago(ws, p);
  if (ref) {
    const previo = await sufijoDeSusCobros(ws, p, ref);
    if (previo !== undefined) {
      const s = previo ?? CUENTA_PRINCIPAL;
      if (!cuentas.some((c) => c.cuenta === s)) return s;
    }
  }
  return cuentas.length ? proximaCuentaDe(ws, p) : CUENTA_PRINCIPAL;
}

/** Le pone (o le cambia) el nombre a una cuenta. '' borra el nombre (vuelve a «Stripe 2»). */
export async function guardarAliasCuenta(ws: number, p: ProveedorConCuentas, cuenta: string, nombre: string, autor: string | null): Promise<void> {
  const clave = claveDeCuenta(CLAVES_BASE[p].alias, cuenta);
  const limpio = aliasLimpio(nombre);
  if (limpio) await guardarCredencial(ws, clave, limpio, p, autor);
  else await eliminarCredencial(ws, clave);
  await auditarCredencial(ws, clave, limpio ? 'guardar' : 'borrar', autor);
}
