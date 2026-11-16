// =============================================================================
// La campaña que trajo a quien aplica, leída de la URL de /accelerator/aplicar (16/11/2026)
// =============================================================================
// Aparte de ./reglas.ts a propósito: esto lo usa sólo el servidor (page.tsx), y lib/compra-plan-reglas.ts se lleva al navegador
// las preguntas del diagnóstico y las pasarelas. Una página no puede exportar nada más que lo suyo (Next lo rechaza al compilar),
// por eso no vive en page.tsx. Lo prueba tests/aplicacion-accelerator.test.ts.
// =============================================================================

import { RUTA_APLICAR } from '@/lib/aplicacion-accelerator';
import { CLAVES_ORIGEN, origenLimpio, type OrigenCompra } from '@/lib/compra-plan-reglas';

/** La campaña de la URL, limpia (`origenLimpio`): sólo las claves de `CLAVES_ORIGEN`, una vez cada una y con su tope. */
export function origenDeLaUrl(sp: Record<string, string | string[] | undefined>): OrigenCompra | null {
  return origenLimpio(Object.fromEntries(CLAVES_ORIGEN.map((k) => [k, typeof sp[k] === 'string' ? sp[k] : undefined])));
}

/**
 * Adonde lleva cada «Aplica ahora» de /accelerator: el formulario, CON la campaña que trajo la landing (revisión del 16/11/2026).
 * El formulario la leía sólo de la página anterior (el referrer): si el navegador no lo mandaba, o la persona volvía otro día a
 * terminar, la aplicación llegaba «sin campaña». Sin campaña, la ruta tal cual.
 */
export function hrefDelFormulario(origen: OrigenCompra | null | undefined): string {
  const q = new URLSearchParams();
  for (const k of CLAVES_ORIGEN) {
    const v = origen?.[k];
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `${RUTA_APLICAR}?${s}` : RUTA_APLICAR;
}

export { CLAVES_ORIGEN };
