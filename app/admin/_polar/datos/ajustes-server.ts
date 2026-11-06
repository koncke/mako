// =============================================================================
// Admin › Settings — la lectura (los datos del recibo, los precios y los interruptores de cobros)
// =============================================================================
// Las reglas viven en ajustes.ts (puro, testeado). Lo llama un page.tsx de /admin DESPUÉS de `exigirSuperAdmin()`. Todo es de
// la PLATAFORMA: lib/recibos.ts lee y escribe en `wsSuperAdmin()`, y las acciones de app/admin/cobros/actions.ts también.
// Para los precios se usan las mismas acciones que los guardan (preguntan `getSesionAdmin()` otra vez): una lectura, un lugar.

import 'server-only'
import { leerEmisor, leerWaSolo } from '@/lib/recibos'
import { pasarelasConectadas } from '@/lib/cobros'
import { wsSuperAdmin } from '@/lib/workspace'
import { precioClienteAgenciaAction, preciosLocalesAction } from '@/app/admin/cobros/actions'
import type { DatosGeneral, DatosNotificaciones, DatosPagos } from './ajustes'

const msg = (e: unknown, def: string): string => (e instanceof Error && e.message ? e.message : def)

export async function leerAjustesGeneral(): Promise<DatosGeneral> {
  try {
    return { ok: true, emisor: await leerEmisor() }
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude leer los datos del recibo.') }
  }
}

export async function leerAjustesPagos(): Promise<DatosPagos> {
  const [locales, agencia, pasarelas] = await Promise.all([
    preciosLocalesAction().catch((e: unknown) => ({ ok: false as const, error: msg(e, 'No pude leer los planes.') })),
    precioClienteAgenciaAction().catch((e: unknown) => ({ ok: false as const, error: msg(e, 'No pude leer el precio.') })),
    wsSuperAdmin().then(pasarelasConectadas).catch(() => null),
  ])
  return {
    locales: locales.ok ? { moneda: locales.moneda, planes: locales.planes } : null,
    errorLocales: locales.ok ? null : locales.error,
    precioAgencia: agencia.ok ? agencia.precio : null,
    errorAgencia: agencia.ok ? null : agencia.error,
    conMercadoPago: !!pasarelas?.includes('mercadopago'),
  }
}

export async function leerAjustesNotificaciones(): Promise<DatosNotificaciones> {
  try {
    const [emisor, waSolo] = await Promise.all([leerEmisor(), leerWaSolo()])
    return { ok: true, emisor, waSolo }
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude leer cómo le llega el recibo a quien paga.') }
  }
}
