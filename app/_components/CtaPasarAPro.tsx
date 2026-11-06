'use client';

// =============================================================================
// CtaPasarAPro — el «Pasar a Pro» de un cartel de tope, o a quién pedírselo (6/11/2026, #494)
// =============================================================================
// Thiago (29/10/2026): «yo no me meto con ese cliente». El cliente de una AGENCIA le pide el cambio de plan A SU AGENCIA:
// su plan ya se lo paga ella. Hasta hoy cada cartel de tope le ofrecía «Pasar a Pro» con un link a /configuraciones/plan,
// y el que hacía clic le pagaba a MaKo un SEGUNDO plan del mismo negocio. Es un bug de plata, no de pantalla.
//
// LO QUE NO CAMBIA: el texto del tope. «Llegaste al tope de tu plan» es verdad para él igual, y la lógica del tope no se
// toca. Lo único que cambia es el CALL-TO-ACTION: donde iba el link, va la frase sin link.
//
// ⚠️ EL LINK ENTRA COMO `children`, y no es un capricho: son ocho carteles con ocho estilos (un botón oscuro, un `<a>` con
//    borde, un Link inline, `className="aa-link"`…). Un componente que dibujara el link habría obligado a pasarle el estilo
//    de cada uno —o a uniformarlos, que es rediseñar ocho pantallas—. Así cada cartel se queda con SU botón y acá vive LA
//    decisión, una sola vez (AGENTS.md → «Una cosa, un lugar»).
//
// El Sidebar y la barra de /m ya lo respetaban por otro camino (`noParaClienteDeAgencia`, lib/nav-visibilidad.ts), que
// decide ÍTEMS DE LA BARRA por su key: esto no es un ítem, es el pie de un cartel, y por eso necesita su propia puerta.
//
// ⚠️ ES COSMÉTICO, como `nav-visibilidad`: el cierre de verdad es el guard de cada pantalla y el tope del servidor.
//    Esconder el link no defiende nada; es dejar de ofrecerle una puerta que no le sirve.
// =============================================================================

import type { ReactNode } from 'react';
import { TEXTO_PEDIR_PRO_A_LA_AGENCIA } from '@/lib/plan-esencial-reglas';
import { useClienteDeAgencia } from './useClienteDeAgencia';

/** El CTA de un cartel de tope: `children` (el link «Pasar a Pro» de ese cartel) o, al cliente de una agencia, el texto. */
export function CtaPasarAPro({ children }: { children: ReactNode }) {
  // ⚠️ POR VERDAD Y NO CONTRA `false`, al revés que los usos de `esClienteDeAgencia` (lib/agencia.ts), y a propósito: acá el
  //    `null` es «el fetch a /api/auth/me no contestó todavía», no «no pude leer la cartera». Ese «no sé» de la BASE ya
  //    llega resuelto como `true` desde la ruta (`cuentaActualEsDeAgencia` compara `!== false`, lib/vista-de-otro.ts), así
  //    que el lado seguro está cubierto antes de llegar acá. Y tratar el `null` del primer dibujo como «sí» le esconderíamos
  //    el link a TODOS por un instante: estos carteles aparecen después de un error, cuando la lectura ya contestó.
  const deAgencia = useClienteDeAgencia();
  if (!deAgencia) return <>{children}</>;
  // Sin link y sin color de acción: no hay nada que toque él. Dim porque no es un error, es a quién pedírselo.
  return <span style={{ fontWeight: 600, color: 'var(--dim)' }}>{TEXTO_PEDIR_PRO_A_LA_AGENCIA}</span>;
}
