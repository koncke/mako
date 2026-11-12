// =============================================================================
// El llamado a la acción de las landings de /vsl y del sitio estilo beehiiv (12/11/2026)
// =============================================================================
// Vive aparte de ./marca.tsx porque marca importa el registro, y los .ts de cada landing (ads.ts, …) también usan la frase:
// importarla desde marca armaba un ciclo marca → registro → ads → marca.
// =============================================================================

import { PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA } from '@/lib/planes-mako';

/**
 * EL ÚNICO LLAMADO A LA ACCIÓN de las landings de /vsl y del sitio estilo beehiiv: empezar con MaKo en /planes, donde se elige
 * el plan y se entra. Martín (12/11/2026): «ya no, ningún lado debería estar agendar llamadas, solamente iniciar la prueba
 * gratuita, que es el CTA principal ahora, la prueba gratuita de 7 días». Antes era agendar una llamada (`CALENDLY`).
 * El botón y la frase del cierre SIGUEN AL INTERRUPTOR de la prueba (`PRUEBA_GRATIS_PRENDIDA`, lib/planes-mako.ts): con la
 * prueba apagada, /planes cobra al empezar, y la landing no puede prometer días gratis que el cobro no da.
 */
export const RUTA_CTA = '/planes';
export const TEXTO_CTA = PRUEBA_GRATIS_PRENDIDA ? 'Comienza tu prueba gratuita' : 'Empieza con MaKo';
/** La frase de la banda final de cada landing, debajo de su titular y al lado del botón. */
export const TEXTO_CIERRE = PRUEBA_GRATIS_PRENDIDA
  ? `Prueba MaKo ${PRUEBA_DIAS} días gratis en tu negocio.`
  : 'Eliges tu plan y entras a MaKo en el acto.';
