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
//
// ⚠️ Y LA AGENCIA ADENTRO DE SU CLIENTE NO ES «EL CLIENTE» (12/11/2026, ticket #89): Código Inmobiliario, operando dentro de
//    «Sellers», leyó «Pídele a tu agencia que te pase a Pro» — se lo decía a ella misma. La cuenta es cliente de una agencia,
//    pero quien la mira es la agencia: a ella le toca el botón que sale de la vista y abre la ficha de esa cuenta en el Agency
//    Dashboard, donde está «Pasar a Pro». La decisión es `ctaDeTope` (lib/plan-esencial-reglas.ts).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { ctaDeTope } from '@/lib/plan-esencial-reglas';
import { WS_PARAM } from '@/lib/ws-tab';
import { useAgenciaAdentro, useClienteDeAgencia, useSuperAdminMira } from './useClienteDeAgencia';

/**
 * Salir de la vista e ir a la ficha, por la MISMA puerta que «Salir» de la barra (app/_components/ImpersonationBanner.tsx):
 * la agencia borra `mako_agencia`; el super admin, si entró con la cookie (sin `?ws=` en la URL), borra su impersonación, y si
 * entró por la URL no toca nada global (las otras pestañas miran a otros clientes).
 */
async function irALaFicha(href: string, puerta: 'agencia' | 'admin'): Promise<void> {
  const porUrl = new URLSearchParams(window.location.search).has(WS_PARAM);
  try {
    if (puerta === 'agencia') await fetch('/api/agencia/entrar', { method: 'DELETE' });
    else if (!porUrl) await fetch('/api/admin/impersonate', { method: 'DELETE' });
  } catch { /* sin red: igual se intenta */ }
  window.location.href = href;
}

/** El CTA de un cartel de tope: `children` (el link «Pasar a Pro» de ese cartel) o, al cliente de una agencia, el texto. */
export function CtaPasarAPro({ children }: { children: ReactNode }) {
  const [yendo, setYendo] = useState(false);
  // ⚠️ POR VERDAD Y NO CONTRA `false`, al revés que los usos de `esClienteDeAgencia` (lib/agencia.ts), y a propósito: acá el
  //    `null` es «el fetch a /api/auth/me no contestó todavía», no «no pude leer la cartera». Ese «no sé» de la BASE ya
  //    llega resuelto como `true` desde la ruta (`cuentaActualEsDeAgencia` compara `!== false`, lib/vista-de-otro.ts), así
  //    que el lado seguro está cubierto antes de llegar acá. Y tratar el `null` del primer dibujo como «sí» le esconderíamos
  //    el link a TODOS por un instante: estos carteles aparecen después de un error, cuando la lectura ya contestó.
  const cta = ctaDeTope({ clienteDeAgencia: useClienteDeAgencia(), agenciaAdentroDe: useAgenciaAdentro(), superAdminMira: useSuperAdminMira() });
  if (cta.tipo === 'link') return <>{children}</>;
  if (cta.tipo === 'agencia') {
    return (
      <button type="button" disabled={yendo} onClick={() => { setYendo(true); void irALaFicha(cta.href, cta.puerta); }}
        style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--primary)', cursor: yendo ? 'default' : 'pointer', textDecoration: 'underline' }}>
        {yendo ? 'Abriendo…' : cta.rotulo}
      </button>
    );
  }
  // Sin link y sin color de acción: no hay nada que toque él. Dim porque no es un error, es a quién pedírselo.
  return <span style={{ fontWeight: 600, color: 'var(--dim)' }}>{cta.texto}</span>;
}
