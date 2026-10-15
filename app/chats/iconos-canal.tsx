'use client';

// =============================================================================
// Las insignias de canal de Chats: WhatsApp, Instagram y Messenger
// =============================================================================
// Copiadas de respond.io (docs/diseno-chats.md §3): el avatar de cada fila lleva abajo a la
// derecha una insignia REDONDA de 16 px —el ícono de 12 + un aro de 2 px del color del fondo—
// y el selector de canal del composer lista cada canal con su ícono redondo de 24.
//
//   · `IconoCanal({ canal, size })`   → el círculo de marca solo (24 en el selector, 12 adentro
//                                        de la insignia, 16 en la fila «Canales» del drawer).
//   · `InsigniaCanal({ canal, size })` → el círculo con su aro, para ir encima de un avatar.
//
// ⚠️ SVG PROPIOS Y NO LOS DE LUCIDE: lucide no trae marcas (su política es no dibujar logos), y
// el set de la casa (app/_components/icons.tsx) no tiene Messenger. Los glifos son los de la
// marca simplificados a 24×24; el de WhatsApp es el trazo de Simple Icons (CC0).
//
// ⚠️ LOS DEGRADADOS NECESITAN UN ID ÚNICO POR DIBUJO (`useId`): una lista de 50 filas con
// `id="ig"` repetido pinta todas con el `<linearGradient>` de la primera que el navegador
// encuentre, y si ésa sale de la pantalla (virtualizada o en un menú cerrado) el resto queda
// sin relleno. Por eso este archivo es de cliente.

import { useId, type CSSProperties } from 'react';
import type { CanalChat } from '@/lib/chats-tipos';

/** El nombre del canal tal como se dice en la pantalla (para el `title` y el lector de pantalla). */
const NOMBRE: Record<CanalChat, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

// El trazo de WhatsApp (globo con el teléfono), en 24×24.
const WA =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

// El rayo de Messenger, en 24×24 (centrado en el globo).
const RAYO = 'M6.6 14.6 10.3 8.7l2.9 2.3 3.9-2.3-3.7 5.9-2.9-2.3z';

/** El círculo de marca del canal, sin aro. */
export function IconoCanal({ canal, size = 24 }: { canal: CanalChat; size?: number }) {
  const uid = `rio-canal-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const comun = { width: size, height: size, viewBox: '0 0 24 24', role: 'img' as const, 'aria-label': NOMBRE[canal], style: { display: 'block', flex: 'none' } satisfies CSSProperties };
  if (canal === 'whatsapp') {
    return (
      <svg {...comun}>
        <title>{NOMBRE[canal]}</title>
        <circle cx="12" cy="12" r="12" fill="#25D366" />
        {/* El glifo entero al 62 %, centrado: a 12 px de diámetro un glifo más grande toca el borde. */}
        <path d={WA} fill="#fff" transform="translate(4.56 4.56) scale(0.62)" />
      </svg>
    );
  }
  if (canal === 'instagram') {
    return (
      <svg {...comun}>
        <title>{NOMBRE[canal]}</title>
        <defs>
          <radialGradient id={uid} cx="0.3" cy="1.07" r="1.3">
            <stop offset="0" stopColor="#FFDD55" />
            <stop offset="0.1" stopColor="#FFDD55" />
            <stop offset="0.5" stopColor="#FF543E" />
            <stop offset="1" stopColor="#C837AB" />
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="12" fill={`url(#${uid})`} />
        <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.4" fill="none" stroke="#fff" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="2.75" fill="none" stroke="#fff" strokeWidth="1.7" />
        <circle cx="15.3" cy="8.7" r="0.95" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg {...comun}>
      <title>{NOMBRE[canal]}</title>
      <defs>
        <linearGradient id={uid} x1="0.15" y1="0.95" x2="0.85" y2="0.05">
          <stop offset="0" stopColor="#0099FF" />
          <stop offset="0.6" stopColor="#A033FF" />
          <stop offset="0.9" stopColor="#FF5280" />
          <stop offset="1" stopColor="#FF7061" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill={`url(#${uid})`} />
      {/* El globo blanco y el rayo calado: la forma de la marca, a 24 px y a 12. */}
      <path d="M12 5.2c-3.9 0-6.9 2.8-6.9 6.6 0 2 .8 3.7 2.2 4.9v2.4l2.1-1.2c.8.2 1.6.4 2.6.4 3.9 0 6.9-2.8 6.9-6.5S15.9 5.2 12 5.2z" fill="#fff" />
      <path d={RAYO} fill={`url(#${uid})`} />
    </svg>
  );
}

/**
 * La insignia de canal que va encima del avatar: el círculo de marca con un aro del color del
 * fondo (2 px a 16). El aro sale de `--rio-bg`, así que en una fila seleccionada (fondo azul
 * claro) se ve igual que en respond.io: el aro es del color de la página, no de la fila.
 */
export function InsigniaCanal({ canal, size = 16 }: { canal: CanalChat; size?: number }) {
  const aro = Math.max(1, Math.round(size / 8));
  return (
    <span className="rio-insignia" title={NOMBRE[canal]}
      style={{ width: size, height: size, padding: aro }}>
      <IconoCanal canal={canal} size={size - aro * 2} />
    </span>
  );
}

/** El nombre visible de un canal («WhatsApp», «Instagram», «Messenger»). */
export function nombreCanal(canal: CanalChat): string {
  return NOMBRE[canal];
}
