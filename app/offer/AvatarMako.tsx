'use client';

// =============================================================================
// AvatarMako — la foto de perfil de MaKo en el chat de Offer
// =============================================================================
// Pedido de Martín (11/10/2026): «el que pregunta, que sería MaKo, la foto de perfil que sea la
// estrella de MaKo, que tiene una sola estrella sin una estrellita pequeña arriba, y el fondo negro».
//
// Por qué un componente propio y no `MakoStar` (app/_components/MakoBrand.tsx): `MakoStar` dibuja la
// chispa Y la estrellita chica de arriba (`<circle class="…-mini">`), y apagada la deja igual a media
// opacidad. `MakoLogo` sí trae la chispa sola, pero en un cuadrado redondeado con su borde dorado:
// recortado en círculo se le cortan las esquinas del borde. Lo que se copia de MakoBrand es SÓLO el
// trazo de la chispa (`SPARK`, que no se exporta) y el degradé de marca (--mako-lite → --mako).
//
// El negro es `--sidebar`: el fondo de la isla oscura, que es el mismo en claro y en oscuro (en
// oscuro el lienzo es #22262E y el avatar queda más negro que él, que es lo que se pidió).
//
// `animar` lo pide la burbuja de «MaKo está escribiendo»: la chispa late. Con «reducir movimiento»,
// quieta (estilos.ts → .of-av-latido).

import { useId } from 'react';

/** La chispa de 4 puntas de MaKo, centrada en (0,0) y de radio ~11. Copia de `SPARK` (MakoBrand.tsx). */
const CHISPA = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

export function AvatarMako({ size = 30, animar = false }: { size?: number; animar?: boolean }) {
  const uid = `ofav${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const estrella = Math.round(size * 0.6);
  return (
    <span role="img" aria-label="MaKo" style={{
      flex: 'none', width: size, height: size, borderRadius: '50%', background: 'var(--sidebar)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={estrella} height={estrella} viewBox="-12 -12 24 24" aria-hidden style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--mako-lite)" />
            <stop offset="100%" stopColor="var(--mako)" />
          </linearGradient>
        </defs>
        <path className={animar ? 'of-av-latido' : undefined} d={CHISPA} fill={`url(#${uid}-g)`} />
      </svg>
    </span>
  );
}
