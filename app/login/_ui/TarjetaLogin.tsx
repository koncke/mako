// =============================================================================
// TarjetaLogin — el envoltorio de las TRES pantallas de entrada
// =============================================================================
// /login, /login/2fa y /login/restablecer son la misma pantalla con distinto
// contenido. Hasta el 14/11/2026 eso estaba COPIADO A MANO tres veces: el
// overlay, la tarjeta, el logo (un `✦` dentro de un cuadrado `#facc15`) y los
// mismos hexes clavados en cada una. El resultado medible: tres radios, tres
// anchos (380/400/400), tres paddings y un logo que no era el logo.
//
// Acá vive una sola vez. Si la pantalla de entrada cambia, cambia en un lugar.
//
// NO es 'use client' a propósito: las tres páginas son Server Components y lo
// único del cliente que arrastra es <MakoLogo/>, que ya lo es.
//
// ⚠️ EL LOGO ES <MakoLogo/>, el de app/_components/MakoBrand.tsx. El `#facc15`
// de antes era un cuarto dorado inventado para una marca que tiene UNO
// (`--mako`, #F2B01E), y encima no dibujaba la chispa del logo sino el carácter
// `✦` de la tipografía del sistema. El wordmark va en `--ink` y no con el
// barrido de <MakoWord/>: un destello permanente deja de significar «MaKo está
// haciendo algo» (la regla está en MakoBrand.tsx y en app/_ui/LEEME.md).

import type { ReactNode } from 'react';
import { MakoLogo } from '@/app/_components/MakoBrand';
import './login.css';

/** El velo que tapa el layout, la marca arriba y la tarjeta centrada. */
export function TarjetaLogin({ children, pie }: {
  children: ReactNode;
  /** Un renglón DEBAJO de la tarjeta: de quién es la sesión, o por qué no hay registro. */
  pie?: ReactNode;
}) {
  return (
    <div className="lg-velo">
      <div className="lg-marco">
        <div className="lg-marca">
          <MakoLogo size={34} />
          <span className="lg-marca__texto">MaKo</span>
        </div>
        <div className="lg-tarjeta">{children}</div>
        {pie != null && <p className="lg-pie">{pie}</p>}
      </div>
    </div>
  );
}

/**
 * El título de la tarjeta y su línea de propósito. Es un <h1>: antes el encabezado
 * de la pantalla era un `<div>` con un `fontSize` a mano, así que /login no tenía
 * encabezado para un lector de pantalla.
 *
 * `sub` dice QUÉ pasa acá, no adorna. Si se deduce del título, va vacía (regla de
 * la casa, app/_ui/LEEME.md).
 */
export function EncabezadoLogin({ titulo, sub }: { titulo: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h1 className="lg-titulo">{titulo}</h1>
      {sub != null && <p className="lg-sub">{sub}</p>}
    </div>
  );
}
