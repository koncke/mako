// =============================================================================
// ¿Se está mirando la cuenta de OTRO? — lo que dibujan la barra de inspección y el Sidebar
// =============================================================================
// #881 (revisión del 16/10/2026, 47:15), Martín: «al inspeccionar, muchas veces al entrar se bugea y sale
// primero el usuario de perfil de Mauricio y luego sale el usuario que se está inspeccionando».
//
// ⚠️ NO ERA UN BUG DEL PERFIL. El Sidebar nacía con `useState('Mauricio Bustos')` —un resto de cuando la app
// era de una sola cuenta— y con `impersonando = false`; los dos se corregían cuando contestaba
// `/api/auth/me`. Se entra a inspeccionar con una recarga DURA (`<a href="/general?ws=N">`, y la agencia con
// `location.href`), así que ese primer cuadro salía en CADA entrada. Y no sólo al inspeccionar: cualquier
// cliente veía «Mauricio Bustos» abajo a la izquierda hasta que llegaba su nombre. La barra de arriba tenía
// la misma demora: aparecía después y corría la pantalla 50 px.
//
// La salida es que el primer cuadro lo arme el SERVER: el layout llama a esto y se lo pasa al Sidebar y a la
// barra. `/api/auth/me` llama a lo MISMO, para que el cartel y los datos no puedan decir dos clientes distintos.

import 'server-only';
import { getUsuarioActual } from './auth';
import { getWorkspace, getWorkspaceActual, estaImpersonando } from './workspace';
import { rutaDeSalida } from './agencia-cartera';
import { agenciaDeCliente, esClienteDeAgencia } from './agencia';
import { WS_PARAM } from './ws-tab';

export type VistaDeOtro = {
  clienteWs: number;
  clienteNombre: string;
  /** Entró una agencia por su cookie (no el super admin): sale por otra puerta. */
  modoAgencia: boolean;
  /** A dónde vuelve «Salir de la vista». */
  salida: string;
  /** De qué agencia es el cliente, cuando el super admin mira a uno de una agencia. */
  agencia: { ws: number; nombre: string } | null;
};

/**
 * ¿La cuenta que se está mirando es de una agencia? (lo que la barra le esconde: lib/nav-visibilidad.ts). Vive acá y no en la
 * ruta para que `/api/auth/me` tenga UNA sola lectura de «a quién se mira»: esta función lee la MISMA `getWorkspaceActual` que
 * `vistaDeOtro`, y devuelve un sí o un no, que no puede nombrar a otro cliente.
 *
 * ⚠️ ACÁ SE RESUELVE EL «NO SÉ», Y POR ESO SIGUE DEVOLVIENDO `boolean` (P15, 30/10/2026). `esClienteDeAgencia` contesta
 * sí/no/`null`, y esto es la FRONTERA: lo que sale va como JSON a la barra del navegador, que no puede tener un tercer
 * estado. El `null` se resuelve como **sí** (`!== false`): esconder MaKo Partners por una falla de la base cuesta un
 * renglón del menú, mostrárselo al cliente de una agencia le rompe el trato a la agencia (Thiago, 29/10/2026).
 * ⚠️ Y el `boolean` de esta firma NO autoriza a volver `esClienteDeAgencia` booleana: es la resolución de UN uso, no el tipo
 * de la pregunta.
 */
export async function cuentaActualEsDeAgencia(): Promise<boolean> {
  return (await esClienteDeAgencia(await getWorkspaceActual())) !== false;
}

/** null = cada uno en su cuenta (o sin sesión). */
export async function vistaDeOtro(): Promise<VistaDeOtro | null> {
  const sesion = await getUsuarioActual();
  if (!sesion || !(await estaImpersonando())) return null;
  const clienteWs = await getWorkspaceActual();
  if (!clienteWs) return null;
  let clienteNombre: string;
  try { clienteNombre = (await getWorkspace(clienteWs))?.nombre ?? `Workspace ${clienteWs}`; } catch { clienteNombre = `Workspace ${clienteWs}`; }
  const esSuperAdmin = sesion.rol === 'admin';
  // De qué agencia es este cliente, si es de alguna. Decide DOS cosas: la cadena que se dibuja y a qué
  // escalón vuelve «Salir» (el detalle, en /api/auth/me).
  const agencia = esSuperAdmin ? await agenciaDeCliente(clienteWs) : null;
  return {
    clienteWs,
    clienteNombre,
    modoAgencia: !esSuperAdmin,
    salida: agencia ? `/agency?${WS_PARAM}=${agencia.ws}` : rutaDeSalida(esSuperAdmin),
    agencia,
  };
}
