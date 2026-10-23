// =============================================================================
// cuentas-agenda-server — las cuentas de Calendly y Cal.com de un negocio (varias por proveedor, fase B, 23/10/2026)
// =============================================================================
// El modelo está en lib/cuentas-integracion.ts (una cuenta = un sufijo en el nombre de sus claves, `CLAVES_AGENDA`).
// Lo que se lee de la base:
//   · `cuentasDeAgenda(ws, p)`: las cuentas del negocio con su nombre y si pueden leer su agenda (token / API key);
//   · `tokensDeAgenda(p, ws?)`: el token de CADA cuenta que lo tiene, para leer reuniones en todas;
//   · `firmasDeAgenda(ws, p)`: el secreto de cada cuenta, ESTRICTO, para verificar el aviso con el que corresponda.
// La principal se sigue leyendo con `credWs`, como siempre (el ws1 la tiene en el entorno); las demás sólo existen en
// la base. Calendly y Cal.com no cobran: lo de la plata está en lib/cuentas-pago-server.ts.
// =============================================================================

import 'server-only';
import { auditarCredencial, clavesGuardadasConBase, credWs, credWsEstricta, eliminarCredencial, guardarCredencial } from './credenciales';
import { getWorkspaceActual } from './workspace';
import {
  CLAVES_AGENDA, CUENTA_PRINCIPAL, aliasLimpio, claveDeCuenta, cuentaDeClave, nombreDeCuenta, proximaCuenta,
  type ProveedorAgendaConCuentas,
} from './cuentas-integracion';

export type CuentaDeAgenda = {
  proveedor: ProveedorAgendaConCuentas;
  /** 'principal' o 'c2', 'c3'… */
  cuenta: string;
  nombre: string;
  principal: boolean;
  /** Puede leer y crear sus tipos de evento: tiene su token (Calendly) o su API key (Cal.com). */
  conToken: boolean;
  /** Tiene el secreto de su aviso: sin él, sus reservas no se pueden verificar. */
  conFirma: boolean;
};

/** Las cuentas (por su sufijo) con ALGUNA clave guardada de ese proveedor. La principal primero. */
function cuentasDeNombres(nombres: readonly string[]): string[] {
  const set = new Set<string>();
  for (const n of nombres) { const c = cuentaDeClave(n); if (c) set.add(c); }
  return [...set].sort((a, b) => (a === CUENTA_PRINCIPAL ? -1 : b === CUENTA_PRINCIPAL ? 1 : Number(a.slice(1)) - Number(b.slice(1))));
}

/** Los nombres de las claves de agenda de un negocio (sin valores). Tira si no puede leer. */
const nombresDe = (ws: number, p: ProveedorAgendaConCuentas): Promise<string[]> => {
  const b = CLAVES_AGENDA[p];
  return clavesGuardadasConBase(ws, [b.clave, b.firmaAviso, b.alias]);
};

/**
 * Las cuentas de agenda del negocio, con su nombre. Sólo las que tienen su token o su secreto guardado (una que quedó
 * sólo con el nombre no es una cuenta). La principal sale aunque viva en el entorno (el ws1): se pregunta con `credWs`.
 * Tira si no puede leer.
 */
export async function cuentasDeAgenda(ws: number, p: ProveedorAgendaConCuentas): Promise<CuentaDeAgenda[]> {
  const b = CLAVES_AGENDA[p];
  const nombres = await nombresDe(ws, p);
  const tiene = (base: string, cuenta: string) => nombres.includes(claveDeCuenta(base, cuenta));
  const out: CuentaDeAgenda[] = [];
  const cuentas = cuentasDeNombres(nombres);
  if (!cuentas.includes(CUENTA_PRINCIPAL)) cuentas.unshift(CUENTA_PRINCIPAL);
  for (const cuenta of cuentas) {
    const principal = cuenta === CUENTA_PRINCIPAL;
    // La principal puede estar en el entorno (el ws1): ahí la lectura es `credWs`, como siempre.
    const conToken = principal ? !!(await credWs(b.clave, ws)) : tiene(b.clave, cuenta);
    const conFirma = principal ? !!(await credWs(b.firmaAviso, ws)) : tiene(b.firmaAviso, cuenta);
    if (!conToken && !conFirma) continue;
    const alias = tiene(b.alias, cuenta) ? await credWs(claveDeCuenta(b.alias, cuenta), ws) : null;
    out.push({ proveedor: p, cuenta, nombre: nombreDeCuenta(p, cuenta, alias), principal, conToken, conFirma });
  }
  return out;
}

/** La cuenta que sigue para conectar otra de ese proveedor (`c2`, `c3`…). */
export async function proximaCuentaDeAgenda(ws: number, p: ProveedorAgendaConCuentas): Promise<string> {
  return proximaCuenta(cuentasDeNombres(await nombresDe(ws, p)));
}

/**
 * El token (o la API key) de CADA cuenta que lo tiene, la principal primero. Sin `ws`, el del contexto (como `credWs`).
 * Para leer las reuniones de alguien hay que mirar en TODAS: una reserva de la segunda cuenta no aparece con el token de
 * la primera. Nunca tira por las cuentas de más: si su lista no se puede leer, quedan sólo la principal.
 */
export async function tokensDeAgenda(p: ProveedorAgendaConCuentas, ws?: number): Promise<Array<{ cuenta: string; token: string }>> {
  const b = CLAVES_AGENDA[p];
  const out: Array<{ cuenta: string; token: string }> = [];
  const principal = await credWs(b.clave, ws);
  if (principal) out.push({ cuenta: CUENTA_PRINCIPAL, token: principal });
  const w = ws ?? (await getWorkspaceActual());
  if (w == null) return out;
  const nombres = await clavesGuardadasConBase(w, [b.clave]).catch(() => [] as string[]);
  for (const n of nombres) {
    const cuenta = cuentaDeClave(n);
    if (!cuenta || cuenta === CUENTA_PRINCIPAL) continue;
    const token = await credWs(n, w);
    if (token) out.push({ cuenta, token });
  }
  return out;
}

/** El token de UNA cuenta (la principal, como siempre, con `credWs`). null si no lo tiene. */
export async function tokenDeAgenda(p: ProveedorAgendaConCuentas, cuenta: string = CUENTA_PRINCIPAL, ws?: number): Promise<string | null> {
  return credWs(claveDeCuenta(CLAVES_AGENDA[p].clave, cuenta), ws);
}

/**
 * El secreto del aviso de CADA cuenta del negocio, leído ESTRICTO (con la base caída, tira: el aviso contesta 503 y el
 * proveedor reintenta, en vez de rechazar una firma buena). Lo usan los webhooks para verificar con el de la cuenta que
 * firmó. La principal primero.
 */
export async function firmasDeAgenda(ws: number, p: ProveedorAgendaConCuentas): Promise<Array<{ cuenta: string; firma: string }>> {
  const b = CLAVES_AGENDA[p];
  const nombres = await clavesGuardadasConBase(ws, [b.firmaAviso]);
  const cuentas = cuentasDeNombres(nombres);
  if (!cuentas.includes(CUENTA_PRINCIPAL)) cuentas.unshift(CUENTA_PRINCIPAL);
  const out: Array<{ cuenta: string; firma: string }> = [];
  for (const cuenta of cuentas) {
    const firma = await credWsEstricta(claveDeCuenta(b.firmaAviso, cuenta), ws);
    if (firma) out.push({ cuenta, firma });
  }
  return out;
}

/** Le pone (o le cambia) el nombre a una cuenta de agenda. '' borra el nombre (vuelve a «Calendly 2»). */
export async function guardarAliasAgenda(ws: number, p: ProveedorAgendaConCuentas, cuenta: string, nombre: string, autor: string | null): Promise<void> {
  const clave = claveDeCuenta(CLAVES_AGENDA[p].alias, cuenta);
  const limpio = aliasLimpio(nombre);
  if (limpio) await guardarCredencial(ws, clave, limpio, p, autor);
  else await eliminarCredencial(ws, clave);
  await auditarCredencial(ws, clave, limpio ? 'guardar' : 'borrar', autor);
}
