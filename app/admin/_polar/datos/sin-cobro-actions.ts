'use server'

// «Habilitado sin cobro» (19/11/2026): la acción del interruptor de la ficha de Admin › Customers. Va en su archivo y NO en app/admin/cobros/actions.ts
// porque actúa sobre UN negocio que se elige en pantalla (como `desconectarComputadoraAction`, app/admin/operaciones/acciones.ts), y el test de
// cobros prohíbe un `ws` como parámetro de ESAS acciones. ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA: el id de una server action viaja en el bundle y cualquiera
// podría llamarla; sólo el super admin de la plataforma prende o apaga, y el negocio es el que eligió él en la ficha (un id entero positivo, validado adentro).

import { revalidatePath } from 'next/cache';
import { getSesionAdmin } from '@/lib/auth';
import { ponerSinCobro, revisarSinCobro } from '@/lib/cuenta-sin-cobro';
import type { SinCobro } from '@/lib/cuenta-sin-cobro-reglas';

export async function ponerSinCobroAction(ws: number, activo: boolean): Promise<{ ok: true; sinCobro: SinCobro } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: 'Sólo el super admin cambia si un negocio se cobra.' };
  const r = await ponerSinCobro(Number(ws), activo === true, String((admin as { email?: string }).email ?? 'super admin'));
  if (r.ok) {
    // Prenderlo levanta en el acto la pausa de «prueba terminada» (lib/cuenta-sin-cobro.ts); apagarlo no pausa nada hoy: abre los 7 días.
    await revisarSinCobro({ soloWs: Number(ws) }).catch(() => null);
    revalidatePath('/admin/customers', 'layout');
  }
  return r;
}
