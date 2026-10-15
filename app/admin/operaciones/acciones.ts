'use server';

// =============================================================================
// /admin/operaciones — las acciones del Centro de Operaciones
// =============================================================================
// ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA DE CADA UNA. El id de una server action viaja en el
//    bundle y Next la ejecuta por cualquier puerta que lo tenga: que la página sea de /admin no
//    protege nada. Lo fija tests/operaciones.test.ts.
// ⚠️ Y NO ALCANZA CON SER ADMIN: esto es una puerta a la PC de Martín. Encolar y acuñar el token
//    piden además `puedeOperar` (lib/operaciones-reglas.ts): el workspace de la plataforma, una
//    sesión con fila y un segundo factor de verdad. Leer también, porque los pedidos son prompts.
// ⚠️ EL TEXTO FIRMADO VIAJA DESDE EL NAVEGADOR Y NO SE TOCA. Se firma allá con una clave que no
//    se puede exportar; acá sólo se valida y se guarda (lib/operaciones.ts).

import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import {
  cancelarPedido, crearTokenCartero, encolarPedido, leerCarteros, listarPedidos,
  type EstadoCarteros, type Pedido,
} from '@/lib/operaciones';

const NO_PUEDE = 'Sólo Martín, con su segundo factor, opera el Centro.';
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Algo falló.');

export type FotoCentro = { ok: true; pedidos: Pedido[]; carteros: EstadoCarteros } | { ok: false; error: string };

export async function fotoCentroAction(): Promise<FotoCentro> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    const [pedidos, carteros] = await Promise.all([listarPedidos(), leerCarteros()]);
    return { ok: true, pedidos, carteros };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function encolarPedidoAction(entrada: {
  firmado: string; firma: string; clavePublica: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof entrada?.firmado !== 'string' || typeof entrada.firma !== 'string' || typeof entrada.clavePublica !== 'string') {
    return { ok: false, error: 'Falta la firma del trabajo.' };
  }
  try {
    return await encolarPedido({ ...entrada, autor: admin.email || admin.nombre || admin.sub });
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cancelarPedidoAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  if (typeof id !== 'string') return { ok: false, error: 'Falta el trabajo.' };
  try {
    const hecho = await cancelarPedido(id);
    return hecho ? { ok: true } : { ok: false, error: 'Ya salió: no se puede cancelar.' };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function crearTokenCarteroAction(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!puedeOperar(admin, await wsSuperAdmin())) return { ok: false, error: NO_PUEDE };
  try {
    return { ok: true, ...(await crearTokenCartero()) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
