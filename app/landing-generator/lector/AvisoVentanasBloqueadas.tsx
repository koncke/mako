'use client';

// =============================================================================
// El aviso «Habilita las ventanas emergentes», con la flecha a la barra del navegador (tanda 6)
// =============================================================================
// Pedido de Martín (14/10/2026): «previo a abrir la página, es muy importante que si el usuario no tiene
// la opción de "habilitar ventanas emergentes" de Chrome, no continue, no abra la página, sino que
// indique dentro de MaKo que lo tiene que habilitar. Me imagino como el mensaje que tenemos en Video
// Generator que es una flecha apuntando arriba con el mensaje. Esto para ambos, para esto y para el
// pixel hazlo.» Lo usan el lector de landings (useLectorEnNavegador.tsx) y el «Probar» del Pixel
// (app/integraciones/ProbarTracking.tsx).
//
// EL MOLDE ES EL DEL VIDEO GENERATOR (`PunteroALaExtension`, app/video-generator/puente-avisos.tsx, y las
// clases `.mk-puntero` de app/_ui/ui.css): un cartel FIJO arriba a la derecha con una flecha curva que
// sale del mensaje y apunta a la barra. Dos diferencias, las dos medidas en Chrome:
//   · el ícono de «ventana bloqueada» vive ADENTRO de la barra de direcciones, a su derecha, y no con
//     las extensiones contra el borde: la flecha se corre a la izquierda (`right`) para caer ahí;
//   · va en un PORTAL al `body`: un `position: fixed` adentro de un modal con `transform` (el del Pixel)
//     queda fijo AL MODAL y la flecha apuntaría al medio de la pantalla.
// No existe ninguna API que diga dónde está el ícono (lo mismo que en el Video Generator): el cartel dice
// «allá arriba», que es cierto, y no pretende saber más.
// =============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';

/** El id del cartel (para un test o para señalarlo). */
export const ID_AVISO_VENTANAS = 'mk-aviso-ventanas';

/** El título: lo que hay que hacer, corto (es lo que se dibuja grande). */
export const TITULO_VENTANAS = 'Habilita las ventanas emergentes';
/** El cómo, en un renglón: el ícono de la barra → «Permitir siempre» → otra vez. */
export const COMO_VENTANAS = 'Toca el ícono de la barra, elige «Permitir siempre» y vuelve a intentarlo.';

export function AvisoVentanasBloqueadas({ abierto, onCerrar, texto }: {
  abierto: boolean;
  onCerrar: () => void;
  /** Un renglón propio en vez de `COMO_VENTANAS` (corto). */
  texto?: string;
}) {
  // El portal necesita el `document`: en el server (y en el primer render) no se dibuja nada.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);
  if (!abierto || !montado) return null;
  return createPortal(
    <div className="mk-puntero" id={ID_AVISO_VENTANAS} role="alert" style={{ right: 96, zIndex: 10_000 }}>
      {/* La flecha nace en la caja y termina arriba a la derecha, contra la barra (el trazo del Video Generator). */}
      <svg className="mk-puntero__flecha" width="86" height="46" viewBox="0 0 86 46" fill="none" aria-hidden="true">
        <path d="M8 44C8 26 22 8 74 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M62 2.5L75 5L67.5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mk-puntero__caja" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{TITULO_VENTANAS}</strong>
          <div>{texto ?? COMO_VENTANAS}</div>
        </div>
        <IconButton title="Cerrar" small onClick={onCerrar}><Icon name="x" size={14} /></IconButton>
      </div>
    </div>,
    document.body,
  );
}
