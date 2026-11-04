// =============================================================================
// closing-diseno-server — la agenda que lee el diseño de la hoja Closing (las llamadas que vienen)
// =============================================================================
// Ningún componente de la hoja lee la agenda: las barras rayadas de «Llamadas de esta semana» y «Próxima llamada» (lo
// que en Halden son «Forecast» y «Next up») salen de las llamadas de venta del CRM, la MISMA lectura que la vista
// «Llamadas» del Calendario (`leerLlamadasDeVenta`). Lo que se cuenta, en `agendaDe` (lib/closing-diseno.ts, con test).
//
// ⚠️ Sólo para quien ve el CRM: la próxima llamada nombra a un lead. La página no la pide para el closer ni el setter
//    (que ven su hoja ÚNICA, sin los leads: lib/graficos-plantillas.ts, HOJA_DE_ROL), ni en un link compartido.
// =============================================================================
import 'server-only';
import { leerLlamadasDeVenta, zonaDelCalendario } from './calendario';
import { sumarDias } from './calendario-modelo';
import { agendaDe, lunesDe, type AgendaClosing } from './closing-diseno';

/** Hasta dos semanas adelante: el resto de esta semana para las barras y una próxima llamada aunque caiga la otra. */
const DIAS_ADELANTE = 14;

/** La agenda del diseño de Closing, o null si no se pudo leer (el bloque dice que no hay, no inventa). */
export async function agendaParaElClosing(hoy: string): Promise<AgendaClosing | null> {
  try {
    const tz = await zonaDelCalendario();
    const lista = await leerLlamadasDeVenta(lunesDe(hoy), sumarDias(hoy, DIAS_ADELANTE), tz);
    return agendaDe(lista, hoy, tz, new Date().toISOString());
  } catch (e) {
    console.error('[closing-diseno] no pude leer la agenda', e);
    return null;
  }
}
