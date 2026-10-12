// =============================================================================
// El tema del CONTENIDO de /m (lógica pura, sin 'use client')
// =============================================================================
// La preferencia ya existía: `mako.modo` en el navegador (lib/temas-candidatos.ts)
// y, si nadie eligió, la del sistema. En escritorio sólo la aplica el Cliente de
// Diseño; en /m se aplica siempre, porque el teléfono se usa de noche y al sol.
// El CROMO (header y barra) no depende de esto: es --sidebar en los dos modos.
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
 */
export const TEMA_ANTES_DE_PINTAR =
  `(function(){try{var d=document.documentElement,g=localStorage.getItem('${LS_MODO}');` +
  `var o=g?g==='oscuro':window.matchMedia('(prefers-color-scheme: dark)').matches;` +
  `if(o){d.setAttribute('${ATTR_MODO}','oscuro');d.setAttribute('${MARCA_TEMA_M}','1');}}catch(e){}})()`;
