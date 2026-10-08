import 'server-only';

// =============================================================================
// actor — quién es, en la comunidad, la persona del EQUIPO que tiene la sesión abierta
// =============================================================================
// Lo usan la página (para dibujar con lo que ya trae el HTML) y cada server action de ./actions.ts.
// Vive aparte porque un archivo 'use server' sólo puede exportar funciones async que sean ACCIONES:
// esto no es una acción (no se llama desde el navegador), es la puerta que todas comparten.
//
// ⚠️ LA MISMA PREGUNTA QUE `requireCapa('customer-success')`, SIN redirect: una server action es un
//    POST que se puede invocar directo, sin pasar por la página, y el guard de la página no corre ahí.
//
// ⚠️ LA CLAVE ES `u:<usuarios.id>` (el `sub` de la sesión), NUNCA EL EMAIL: la clave viaja al
//    navegador de los alumnos. Una sesión sin fila propia (`password`, `legacy`, `dev`) no tiene con
//    qué firmar lo que escribe, y no escribe.

import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getCapaActual, getWorkspaceActual, adminDeWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { productoDelWorkspace, type Actor } from '@/lib/comunidad-datos';
import { claveDeUsuario, idValido } from '@/lib/comunidad-reglas';

/** El actor del equipo sobre la comunidad de `productoId`, o el porqué de que no (una frase). */
export async function actorDelEquipo(productoIdRaw: unknown): Promise<Actor | string> {
  const sesion = await getUsuarioActual();
  if (!sesion || !(await getRolWsEfectivo())) return 'Tu sesión venció.';
  if (!tabEnCapa('customer-success', await getCapaActual())) return 'Tu plan no incluye Customer Success.';
  const ws = await getWorkspaceActual();
  if (!ws) return 'Abre un negocio primero.';
  const usuarioId = /^[1-9]\d{0,17}$/.test(sesion.sub ?? '') ? Number(sesion.sub) : null;
  if (!usuarioId) return 'Tu sesión no tiene una cuenta propia.';
  const productoId = idValido(productoIdRaw);
  if (!productoId) return 'Falta el producto.';
  const producto = await productoDelWorkspace(ws, productoId);
  if (!producto) return 'Ese producto no es de este negocio.';
  return {
    ws, productoId, clave: claveDeUsuario(usuarioId), leadId: null,
    nombre: (sesion.nombre || '').trim() || sesion.email.split('@')[0] || 'Equipo',
    equipo: true,
    // Configurar (categorías, nombres de nivel) es de un admin, como editar el curso.
    adminWs: (await adminDeWorkspaceActual()) === ws,
  };
}
