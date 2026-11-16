// =============================================================================
// La campaña que trajo a quien aplica, leída de la URL de /accelerator/aplicar (16/11/2026)
// =============================================================================
// Aparte de ./reglas.ts a propósito: esto lo usa sólo el servidor (page.tsx), y lib/compra-plan-reglas.ts se lleva al navegador
// las preguntas del diagnóstico y las pasarelas. Una página no puede exportar nada más que lo suyo (Next lo rechaza al compilar),
// por eso no vive en page.tsx. Lo prueba tests/aplicacion-accelerator.test.ts.
// =============================================================================

import { CLAVES_ORIGEN, origenLimpio, type OrigenCompra } from '@/lib/compra-plan-reglas';

/** La campaña de la URL, limpia (`origenLimpio`): sólo las claves de `CLAVES_ORIGEN`, una vez cada una y con su tope. */
export function origenDeLaUrl(sp: Record<string, string | string[] | undefined>): OrigenCompra | null {
  return origenLimpio(Object.fromEntries(CLAVES_ORIGEN.map((k) => [k, typeof sp[k] === 'string' ? sp[k] : undefined])));
}

export { CLAVES_ORIGEN };
