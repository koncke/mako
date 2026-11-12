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
// Martín, 12/11/2026: «en lugar de que sea el CTA en todos lados, comienza tu prueba gratuita, me gustaría que sea pruébalo
// gratis, ahora. Que sea bien marketinero».
export const TEXTO_CTA = PRUEBA_GRATIS_PRENDIDA ? 'Pruébalo gratis ahora' : 'Empieza con MaKo';
/**
 * La frase de la banda final de cada landing, al lado del botón: lo que el botón NO dice (Martín, 12/11/2026, de la que repetía
 * «Prueba MaKo 7 días gratis»: «eso no tiene sentido, ya que eso mismo ya lo dice el propio botón»). Es la regla de /reembolsos.
 */
export const TEXTO_CIERRE = PRUEBA_GRATIS_PRENDIDA
  ? `${PRUEBA_DIAS} días gratis. Si te das de baja antes del día ${PRUEBA_DIAS + 1}, no pagas nada.`
  : 'Eliges tu plan y entras a MaKo en el acto.';
