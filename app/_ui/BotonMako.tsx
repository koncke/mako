'use client';

// =============================================================================
// BotonMako — el botón de MaKo (✦): NEGRO, como el logo, y con el recuadro de la casa
// =============================================================================
// Pedido de Martín (10/10/2026): «El botón de IA que está al lado del título, debe ser negro, como el
// logo de MaKo» y, sobre el del editor de WhatsApp, «tiene el botón de MaKo super redondeado, eso está
// mal. Debe ser un estándar el recuadro ese». Los dos son el mismo botón: el fondo del logo
// (app/_components/MakoBrand.tsx, `MakoLogo`), la estrella dorada y el radio de `RADIO_CAJA`.
//
// Encendido (el panel abierto, o la tarjeta que MaKo adapta) se marca con un aro dorado, no cambiando
// el fondo: un botón negro que pasa a crema deja de leerse como el mismo.
// =============================================================================

import type { CSSProperties } from 'react';
import { MakoStar } from '@/app/_components/MakoBrand';
import { RADIO_CAJA } from './BotonBorrar';

export function BotonMako({ onClick, title, encendido = false, lado = 32, deshabilitado, style }: {
  onClick: () => void;
  /** Qué hace, en una frase: va al `title` y al `aria-label`. */
  title: string;
  encendido?: boolean;
  /** El lado del cuadrado: 32 en un editor, 38 al lado del título del lienzo. */
  lado?: number;
  deshabilitado?: boolean;
  style?: Omit<CSSProperties, 'background' | 'borderRadius'>;
}) {
  return (
    <button type="button" data-no-pan onClick={onClick} disabled={deshabilitado} aria-pressed={encendido}
      title={title} aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxSizing: 'border-box',
        width: lado, height: lado, padding: 0, cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? 0.5 : 1,
        border: '1px solid rgba(201,162,74,.45)',
        boxShadow: encendido ? '0 0 0 2px var(--mako)' : '0 1px 2px rgba(0,0,0,.18)',
        ...style,
        background: 'linear-gradient(135deg, #2A251C, #171511)',
        borderRadius: RADIO_CAJA,
      }}>
      <MakoStar size={Math.round(lado * 0.45)} animate={false} />
    </button>
  );
}
