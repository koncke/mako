// =============================================================================
// comercial-diseno-server — las llamadas de venta de HOY que lee el diseño de la hoja Comercial (su bloque «Hoy»)
// =============================================================================
// Ningún componente de la hoja lee la agenda: el «Today» de Selvar sale de las llamadas de venta del CRM, la MISMA lectura que
// la vista «Llamadas» del Calendario (`leerLlamadasDeVenta`) y que el diseño de Closing (lib/closing-diseno-server.ts). Lo que
// se dibuja, en `hoyDe` (lib/comercial-diseno.ts, con test).
//
// ⚠️ Sólo para quien ve el CRM: cada llamada nombra a un lead. La página no la pide para el closer ni el setter (que ven su
//    hoja ÚNICA, sin los leads), ni en un link compartido.
// =============================================================================
import 'server-only';
import { leerLlamadasDeVenta, zonaDelCalendario } from './calendario';
import { sumarDias } from './calendario-modelo';
import type { AgendaComercial } from './comercial-diseno';

/** Las llamadas de venta de hoy, o null si no se pudo leer (el bloque dice que no hay, no inventa). */
export async function agendaParaComercial(hoy: string): Promise<AgendaComercial | null> {
  try {
    const tz = await zonaDelCalendario();
    const llamadas = await leerLlamadasDeVenta(hoy, sumarDias(hoy, 1), tz);
    return { tz, llamadas };
  } catch (e) {
    console.error('[comercial-diseno] no pude leer las llamadas de hoy', e);
    return null;
  }
}
