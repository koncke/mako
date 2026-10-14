// =============================================================================
// El tema del CONTENIDO de /m (lógica pura, sin 'use client')
// =============================================================================
// La preferencia ya existía: `mako.modo` en el navegador (lib/temas-candidatos.ts)
// y, si nadie eligió, la del sistema. En escritorio sólo la aplica el Cliente de
// Diseño; en /m se aplica siempre, porque el teléfono se usa de noche y al sol.
// v2: el CROMO también lo sigue (el encabezado es --bg y la barra --surface), y ShellM
// le escribe a la meta theme-color el --bg resuelto.
//
// Vive aparte (y sin 'use client') porque lo leen las dos mitades: el layout del
// server, que mete el script antes del primer pintado, y el shell del cliente,
// que lo mantiene y lo saca al salir de /m.
// =============================================================================

import { ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';

/** La marca que dice «este oscuro lo puso /m»: es lo que permite sacarlo al salir. */
export const MARCA_TEMA_M = 'data-m-tema';

/**
 * El <script> que va en el HTML del layout de /m: sin él, quien usa el teléfono en
 * oscuro ve un fogonazo blanco en cada carga (un efecto de React corre DESPUÉS de
 * pintar).
 *
 * Claro por defecto (pedido de Martín, 11/10/2026: «por defecto es white mode»): oscuro SÓLO si la
 * persona lo eligió. Seguir al sistema ponía oscuro a quien tiene Windows o iOS en oscuro.
 *
 * ⚠️ UN SOLO template literal, a propósito (13/10/2026). Estaba partido en tres con `+`, y el
 * minificador del build (SWC) junta los templates cuyas `${…}` son constantes y se COME el texto
 * que queda entre ellos: producción servía `getItem('mako.modoif(o){…` —sin `');var o=g==='oscuro';`—,
 * un SyntaxError en cada página de /m, y el script no corría nunca. El fuente se leía perfecto.
 * Lo fija tests/minificador-templates.test.ts (y explica el bug, con la reproducción).
 */
export const TEMA_ANTES_DE_PINTAR =
  `(function(){try{var d=document.documentElement,g=localStorage.getItem('${LS_MODO}');var o=g==='oscuro';if(o){d.setAttribute('${ATTR_MODO}','oscuro');d.setAttribute('${MARCA_TEMA_M}','1');}}catch(e){}})()`;
