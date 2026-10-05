// =============================================================================
// ChipTri — el chip de un sí / no / sin marcar
// =============================================================================
// Vive en su propio archivo, SIN directiva, porque lo dibujan las dos mitades de
// la ficha: la tarjeta de Reuniones (server) y el campo editable (client). Con
// una copia en cada lado, el chip de «Asistió» y el de elegirlo se despintaban
// solos a la primera corrección de estilo.

import type { ReactNode } from 'react';

/** Un tri-estado dibujado: verde el sí, rojo el no, sin color lo que nadie marcó. */
export function ChipTri({ valor, si, no }: { valor: boolean | null; si: string; no: string }): ReactNode {
  if (valor === true) return <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--good)', background: 'var(--good-bg)' }}>{si}</span>;
  if (valor === false) return <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: 'var(--bad)', background: 'var(--bad-bg)' }}>{no}</span>;
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>Sin marcar</span>;
}
