'use client';

// =============================================================================
// BotonBorrar · IconoBorrar — «borrar», con UN dibujo y SIEMPRE en rojo
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, general 9), textual: «Cambia el botón de BORRAR con ese
// ícono de basura que no se ve, no se entiende, busca un ícono más reconocible o otro icono de basura,
// porque ese no se entiende. Esto en TODOS lados. Y que siempre el ícono de borrar sea rojo.»
//
// Medido antes de escribir esto: «borrar» se dibujaba de CINCO formas (el 🗑 en `--faint` del panel
// del lienzo, `IconTrash` del composer, `Icon name="trash"` del sidebar, el 🗑 suelto de Retros, y la ✕
// de varias listas), casi todas en gris. Un control destructivo en gris se lee como decoración.
//
// ⚠️ EL ROJO NO ES UN PROP. `color` no se puede pasar: «siempre rojo» es una propiedad del control, y
//    un prop para cambiarlo es la puerta para que vuelva el gris. Lo mismo el dibujo: sale de
//    `TRAZOS_BORRAR` (./iconos-menu.tsx), el mismo que pinta un menú con `icono: 'borrar'`.
// ⚠️ EL `title` Y EL `aria-label` NOMBRAN QUÉ SE BORRA («Borrar esta tarjeta», «Eliminar la flecha»):
//    un ícono sin texto necesita su frase, y ahí sí entra una (no ocupa un píxel). El default
//    «Eliminar» es la red, no el uso.
//
// El barrido por toda la app NO es de esta pieza: la lista de lugares quedó en la cosecha de la
// sexta tanda (docs/hallazgos-chatbot.md, parte «editores»).
// =============================================================================

import { useState, type CSSProperties, type MouseEvent } from 'react';
import { TRAZOS_BORRAR } from './iconos-menu';

/** Los tamaños del botón: el lado del cuadrado y el del ícono. `lg` es el de los editores grandes. */
export const TALLAS_BORRAR = { sm: { lado: 26, icono: 15 }, md: { lado: 32, icono: 18 }, lg: { lado: 44, icono: 22 } } as const;
export type TallaBorrar = keyof typeof TALLAS_BORRAR;

/** El tacho, rojo. Para meter adentro de un botón propio (el de una burbuja, el de una fila). */
export function IconoBorrar({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', display: 'block', color: 'var(--bad)' }}>
      {TRAZOS_BORRAR}
    </svg>
  );
}

/**
 * El botón de borrar de la casa: el tacho rojo, sin caja, y un fondo rojo suave al pasar el cursor.
 * Con `texto`, el texto al lado (también rojo): para cuando hay lugar y la acción merece decirse.
 */
export function BotonBorrar({ onClick, title = 'Eliminar', disabled, talla = 'md', texto, style }: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Qué se borra, en una frase: va al `title` y al `aria-label`. */
  title?: string;
  disabled?: boolean;
  talla?: TallaBorrar;
  /** El texto al lado del ícono («Eliminar»). Sin esto, sólo el ícono. */
  texto?: string;
  /** Lo que acomoda el botón en su fila (margen, alineación). No puede cambiar el color. */
  style?: Omit<CSSProperties, 'color' | 'background'>;
}) {
  const [encima, setEncima] = useState(false);
  const t = TALLAS_BORRAR[talla];
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 'none',
        minWidth: t.lado, height: t.lado, padding: texto ? '0 10px' : 0, borderRadius: Math.round(t.lado / 3.2),
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit', fontSize: talla === 'lg' ? 15 : 13, fontWeight: 600, transition: 'background .12s',
        ...style,
        color: 'var(--bad)',
        background: encima && !disabled ? 'var(--bad-bg)' : 'transparent',
      }}>
      <IconoBorrar size={t.icono} />
      {texto && <span>{texto}</span>}
    </button>
  );
}
