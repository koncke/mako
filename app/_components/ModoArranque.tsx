// =============================================================================
// ModoArranque — el claro/oscuro de CADA PERSONA, en la computadora, antes del primer pintado (17/10/2026)
// =============================================================================
// Tarjeta #883 (llamadas del 16/10): «que cada persona elija tema claro u oscuro en la computadora (hoy sólo en el
// teléfono) y que todas las pantallas lo respeten». La preferencia es la MISMA que la del teléfono: `mako.modo` en el
// navegador (lib/temas-candidatos.ts → LS_MODO), que escribe el interruptor de la barra (InterruptorModo).
//
// ⚠️ CLARO POR DEFECTO, NUNCA EL DEL SISTEMA. Martín (11/10/2026, en el teléfono): «por defecto es white mode», y el
// 16/10 pidió el onboarding claro «como todo». Hubo una versión que seguía `prefers-color-scheme`, y un cliente nuevo con
// Windows en oscuro abrió MaKo en oscuro sin haber elegido nada (app/_components/TemaCandidato.tsx lo cuenta). Oscuro
// SÓLO si la persona lo eligió.
//
// ⚠️ SIN 'use client': renderizado desde el layout (server), el <script> entra en el HTML y corre mientras el navegador
// parsea, antes de pintar. Un efecto de React correría DESPUÉS: un fogonazo blanco en cada carga para quien eligió
// oscuro. La otra mitad, volver a ponerlo al navegar, es `ModoDelUsuario` (cliente).
//
// ⚠️ UN SOLO template literal (tests/minificador-templates.test.ts): partido con `+`, el minificador del build se come
// el texto entre las partes y el script no corre nunca.

import { ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';

// ⚠️ Y NUNCA EN UNA PÁGINA PÚBLICA (la landing de venta, el VSL, /compartido, el curso del alumno, el retorno de un pago):
// la mira alguien de afuera con los colores de la marca, y quien la previsualiza desde su MaKo en oscuro la vería de
// otro color. Son las de `isPublicLandingPath` (app/_components/PublicRouteGate.tsx); tests/tema-por-persona.test.ts
// las compara.
export const MODO_ANTES_DE_PINTAR =
  `(function(){try{var p=location.pathname,b=function(r){return p===r||p.indexOf(r+'/')===0};if(p==='/'||b('/vsl')||b('/compartido')||b('/mi-curso')||p.indexOf('/pagar/')===0)return;if(localStorage.getItem('${LS_MODO}')==='oscuro')document.documentElement.setAttribute('${ATTR_MODO}','oscuro');}catch(e){}})()`;

export function ModoArranque() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: MODO_ANTES_DE_PINTAR }} />;
}
