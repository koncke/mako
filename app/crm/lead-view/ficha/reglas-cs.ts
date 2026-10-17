// =============================================================================
// ficha/reglas-cs — las reglas PURAS de los bloques propios de Customer Success, y su plantilla FIJA
// =============================================================================
// `senal-de-atencion` y `reloj-del-programa` (§3, Customer Success) todavía no tienen componente: este
// registro queda vacío hasta que se dibujen.
//
// 17/10/2026: la tab PAGOS de la ficha de un cliente (app/customer-success/PagosCliente.tsx) pasó a los MISMOS
// bloques que la del CRM, con la plantilla fija de CS (`PLANTILLA_CS['cs-pagos']`, lib/ficha/plantillas.ts:
// no se personaliza en la v1 y no hereda la del CRM). `listaFijaDeCs` arma esa lista como la armaría el
// armador para una tab que nadie tocó. Y como el Resumen de CS todavía no está en bloques, lo que su plantilla pone
// y la tarjeta de siempre no dibuja (el estado de cuenta, el servicio vendido, la promesa y las obligaciones, que
// vivían en la tarjeta vieja del deal) va debajo, con el mismo armador.
// =============================================================================

import { bloqueDef, type BloqueId, type TabCs } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import { PLANTILLA_CS } from '@/lib/ficha/plantillas';
import type { ReglasDeTab } from './tipos';

export const REGLAS_CS = {} satisfies ReglasDeTab;

/**
 * La lista de una tab de CS: cada bloque de su plantilla fija, con el ancho y el diseño de entrada del catálogo.
 * `sin`: los que esa pantalla ya dibuja con su tarjeta de siempre (el Resumen de CS todavía monta el contacto y las
 * notas a mano: app/customer-success/FichaPestanas.tsx).
 */
export function listaFijaDeCs(tab: TabCs, opts?: { sin?: readonly BloqueId[] }): BloquePuesto[] {
  return PLANTILLA_CS[tab].flatMap((id) => {
    const def = bloqueDef(id);
    if (!def || opts?.sin?.includes(id)) return [];
    const p: BloquePuesto = { id, ancho: def.ancho, diseno: def.disenos[0]?.id ?? '' };
    return [p];
  });
}
