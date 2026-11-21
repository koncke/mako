'use client';
// =============================================================================
// «AUTOCOMPLETAR» en la barra del administrador (21/11/2026; Martín: en lugar de «Datos de Mauricio»)
// =============================================================================
// Contesta la pregunta de ahora del onboarding con la respuesta de ejemplo (lib/onboarding-v2/saltar.ts → `respuestaDeEjemplo`). Se
// dibuja SÓLO si el chat lo ofrece (lib/onboarding-v2/autocompletar.ts), y el chat lo ofrece sólo en la revisión: alguien de MaKo en un
// negocio de prueba. Nunca a un cliente.
// =============================================================================
import type { CSSProperties } from 'react';
import { useAutocompletar } from '@/lib/onboarding-v2/autocompletar';

const chip: CSSProperties = {
  fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
};

export function Autocompletar() {
  const hacer = useAutocompletar();
  if (!hacer) return null;
  return (
    <button type="button" onClick={hacer} style={chip} title="Contesta la pregunta de ahora con la respuesta de ejemplo (sólo en la revisión)">
      Autocompletar
    </button>
  );
}
