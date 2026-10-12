'use client';

// =============================================================================
// BotonMako — el botón de MaKo: ES EL LOGO (el recuadro negro con la chispa dorada sola, centrada)
// =============================================================================
// Pedido de Martín (10/10/2026): «El botón de IA que está al lado del título, debe ser negro, como el
// logo de MaKo» y, sobre el del editor de WhatsApp, «tiene el botón de MaKo super redondeado, eso está
// mal. Debe ser un estándar el recuadro ese».
//
// DECIMOQUINTA TANDA DE AUTOMATIONS (12/10/2026, punto 3), Martín, textual: «Pon la estrella de MaKo dentro de los
// editores de mensajes, porque pusiste una estrella que no es el logo, que es más chica y tiene una segunda estrella
// arriba, pon la estrella de MaKo». Hasta acá el botón era un recuadro negro propio con `MakoStar` adentro: la chispa
// al 45% del lado y el punto chico arriba a la derecha (lo que él llama «una segunda estrella arriba»). Ya lo había
// dicho del botón de la cabecera en la décima: «el logo de MaKo, que es una estrella en el centro, sin la estrella
// chiquita arriba». Ahora el botón DIBUJA EL LOGO (`MakoLogo`, app/_components/MakoBrand.tsx), el MISMO que lleva el
// botón de la cabecera de una automatización (`BotonLogoMako`, app/automations/SecuenciaPerfil.tsx): un solo dibujo
// para «MaKo», en todos los editores (WhatsApp, Instagram, Messenger, email, MaKo en WhatsApp) y donde más se use.
//
// Encendido (el panel abierto, o la tarjeta que MaKo adapta) se marca con un aro dorado, no cambiando
// el fondo: un botón negro que pasa a crema deja de leerse como el mismo.
// =============================================================================

import type { CSSProperties } from 'react';
import { MakoLogo } from '@/app/_components/MakoBrand';

/** El radio del recuadro del logo (`rx="13"` sobre 48 en `MakoLogo`), para que el aro de encendido lo siga. */
export const radioDelLogo = (lado: number): number => Math.round((lado * 13) / 48);

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
    <button type="button" data-no-pan data-boton-mako onClick={onClick} disabled={deshabilitado} aria-pressed={encendido}
      title={title} aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxSizing: 'border-box',
        width: lado, height: lado, padding: 0, border: 'none', cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? 0.5 : 1,
        boxShadow: encendido ? '0 0 0 2px var(--mako)' : '0 1px 2px rgba(0,0,0,.18)',
        ...style,
        background: 'transparent',
        borderRadius: radioDelLogo(lado),
      }}>
      <MakoLogo size={lado} animate={false} />
    </button>
  );
}
