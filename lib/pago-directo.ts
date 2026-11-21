// =============================================================================
// pago-directo — lee y guarda los datos de MaKo para «Transferencia o Binance» (18/11/2026)
// =============================================================================
// El setting `CLAVE_PAGO_DIRECTO` del negocio de la plataforma (lib/pago-directo-reglas.ts). Lo lee la página pública de /planes/<plan> (sin
// sesión: con el cliente de servicio y el ws de la plataforma, nunca el de la sesión) y lo edita el super admin en Settings › Payments.
// Si no se puede leer, devuelve SIN DATOS: la opción no se muestra (y el aviso queda en el log): nunca se ofrece pagar a un dato dudoso.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { CLAVE_PAGO_DIRECTO, DATOS_VACIOS, datosDeSetting, datosLimpios, type DatosDePagoDirecto } from './pago-directo-reglas';

export async function leerDatosDePagoDirecto(): Promise<DatosDePagoDirecto> {
  try {
    const ws = await wsSuperAdmin();
    const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_PAGO_DIRECTO).maybeSingle();
    if (error) throw new Error(error.message);
    return datosDeSetting(((data as { value?: string } | null)?.value) ?? null);
  } catch (e) {
    console.warn(`[pago-directo] no pude leer los datos de pago: ${e instanceof Error ? e.message : String(e)}. La opción no se muestra.`);
    return { ...DATOS_VACIOS };
  }
}

export async function guardarDatosDePagoDirecto(crudo: unknown): Promise<{ ok: true; datos: DatosDePagoDirecto } | { ok: false; error: string }> {
  // ⚠️ EL INTERRUPTOR DEL CHECKOUT NO SE PIERDE AL GUARDAR UN DATO (20/11/2026): el editor de Settings › Payments manda sólo los campos de texto;
  // sin `checkoutPublico` en lo que llega, se conserva el guardado (y si no se puede leer, queda apagado: nunca se prende por accidente).
  const o = crudo && typeof crudo === 'object' && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
  const checkoutPublico = typeof o.checkoutPublico === 'boolean' ? o.checkoutPublico : (await leerDatosDePagoDirecto()).checkoutPublico;
  const datos = datosLimpios({ ...o, checkoutPublico });
  try {
    const ws = await wsSuperAdmin();
    const { error } = await getSupabaseServer().from('app_settings')
      .upsert({ workspace_id: ws, key: CLAVE_PAGO_DIRECTO, value: JSON.stringify(datos), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
    if (error) return { ok: false, error: `No pude guardar: ${error.message}` };
    return { ok: true, datos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardar los datos de pago.' };
  }
}
