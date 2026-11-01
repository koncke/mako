// =============================================================================
// El retrato de un referente, adentro de su criatura (1/11/2026)
// =============================================================================
// Martín rechazó dos tandas de caricaturas, y las de public/asesores/<id>.png las aprobó después de ocho vueltas: «esos sí me gustan». Las
// generó el Cerebro con IA a partir de fotos públicas: cómo y qué no perder al regenerarlas, en docs/hallazgos-ops-center.md. Antes eran SVG dibujados
// acá; se borraron para que no quede en ningún lado una cara que él ya rechazó.
//
// ⚠️ UN PNG NO PARPADEA, Y LOS OJOS DE UNA CRIATURA DICEN EL ESTADO DEL CHAT (Muneco.tsx). Decidido: la cara es la misma en todos lados, y el estado sale
//    de afuera de la foto: un ANILLO que late mientras trabaja, y la foto apagada si está cansada o dormida. Flotar sigue (`.mun-cuerpo`). Lo que se pierde es
//    el parpadeo, a sabiendas: conservar el SVG para el chat activo era mostrarle dos caras a la misma persona, y una ya rechazada.
// ⚠️ Con las reglas de Muneco.tsx: SVG en 40×40, sin hooks y sin ids; por eso el círculo es un `clip-path` de CSS y no un <clipPath>. Abajo de la foto va un disco:
//    si la imagen tarda o no está, se ve eso y no un agujero.

import type { CSSProperties } from 'react';
import type { IdAsesor } from '@/lib/asesores/catalogo';
import type { Animo } from './Muneco';

const CIRCULO: CSSProperties = { clipPath: 'circle(20px at 20px 20px)' };

/** Dónde está la imagen de un referente. */
export const rutaDelRetrato = (id: IdAsesor): string => `/asesores/${id}.png`;

/** La foto, según el estado del chat. Trabajando y despierta, tal cual: la señal de que trabaja es el anillo. */
function apagadoDe(animo: Animo): CSSProperties | undefined {
  if (animo === 'dormido') return { filter: 'grayscale(1) opacity(.6)' };
  if (animo === 'cansado') return { filter: 'saturate(.55) opacity(.85)' };
  return undefined;
}

export function Retrato({ id, animo }: { id: IdAsesor; animo: Animo }) {
  return (
    <>
      <g style={CIRCULO}>
        <circle cx="20" cy="20" r="20" fill="var(--surface-2)" />
        <image href={rutaDelRetrato(id)} x="0" y="0" width="40" height="40" preserveAspectRatio="xMidYMid slice" style={apagadoDe(animo)} />
      </g>
      {animo === 'trabajando' && <circle className="mun-anillo" cx="20" cy="20" r="19.2" fill="none" stroke="var(--primary)" strokeWidth="1.6" />}
    </>
  );
}
