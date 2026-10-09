// =============================================================================
// ¿De quién es el perfil que se está mirando? — la decisión, sola y testeable
// =============================================================================
// Normalmente, el de la persona logueada. Pero en una «vista de otro» —el super admin
// parado en un cliente, o una agencia inspeccionando a uno de su cartera— quien mira está
// ADENTRO de esa cuenta, y /perfil tiene que mostrar el perfil de ESE cliente.
//
// ⚠️ EL BUG QUE CIERRA (09/10/2026): la regla vivía en lib/perfil.ts como
// `if (sesion.rol !== 'admin') return propio`, o sea que sólo el super admin cambiaba de
// sujeto. La agencia —que NO es rol global admin: entra por su cookie firmada— caía en
// `propio`, y Joan, inspeccionando a Brigitte Eberlin, veía en /perfil los datos de
// Código Inmobiliario debajo de un cartel que decía «Estás viendo el dashboard de
// Brigitte Eberlin». Peor: «Guardar» habría escrito sobre su propio usuario creyendo
// tocar el del cliente.
//
// ⚠️ Y EL OTRO MODO DE FALLA: con el cliente SIN NADIE ADENTRO (ws15, 0 usuarios desde el
// 28/09), la lectura caía a `?? propio`. Un vacío se rellenaba con los datos de quien
// mira. Acá ese caso devuelve null y la pantalla lo dice; nunca cae al perfil propio.
//
// SIN `server-only` a propósito, igual que lib/agencia-cartera.ts: la condición que decide
// de quién son los datos tiene que poder importarla un test.

import { aQuienReinvitar, esWsValido } from './agencia-cartera';

export type SujetoPerfil = { tipo: 'propio' } | { tipo: 'cliente'; ws: number };

const PROPIO: SujetoPerfil = { tipo: 'propio' };

/**
 * De quién es el perfil, con los datos YA resueltos por el server.
 *
 * - `wsActual`: lo que contesta `getWorkspaceActual()` en este request.
 * - `clienteDeAgencia`: lo que contesta `contextoDeAgencia()` — la cookie firmada de la
 *   agencia, de ESTA sesión, con la cartera aprobada AHORA. Es el permiso, no un dato de la URL.
 *
 * ⚠️ EN POSITIVO: un usuario que no es super admin sólo cambia de sujeto si HAY contexto de
 * agencia y es exactamente el workspace que se mira. Cualquier otra combinación es su propio
 * perfil — nunca el de un workspace que llegó por otro lado.
 */
export function deQuienEsElPerfil(p: {
  esSuperAdmin: boolean;
  wsPropio: number | null | undefined;
  wsActual: number | null | undefined;
  clienteDeAgencia: number | null | undefined;
}): SujetoPerfil {
  if (!esWsValido(p.wsActual) || p.wsActual === p.wsPropio) return PROPIO;
  if (p.esSuperAdmin) return { tipo: 'cliente', ws: p.wsActual };
  if (esWsValido(p.clienteDeAgencia) && p.clienteDeAgencia === p.wsActual) {
    return { tipo: 'cliente', ws: p.wsActual };
  }
  return PROPIO;
}

/**
 * La persona cuyo perfil es «el del cliente»: su admin (`rol_ws` nulo cuenta como admin), y
 * si no hay admin, la primera de ESE workspace. `null` = la cuenta no tiene a nadie adentro.
 *
 * Es la MISMA persona a la que se le manda el acceso (`aQuienReinvitar`): «el dueño de la
 * cuenta» es uno solo, y con dos reglas la ficha y el perfil podrían nombrar a dos.
 * El filtro por workspace va adentro: una lista con gente de otro inquilino no puede
 * prestarle a nadie un perfil ajeno.
 */
export function titularDelCliente<T extends { id: number; workspace_id: number | null; rol_ws?: string | null }>(
  gente: T[],
  ws: number,
): T | null {
  return aQuienReinvitar(gente, ws);
}
