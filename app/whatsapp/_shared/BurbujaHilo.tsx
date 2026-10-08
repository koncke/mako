'use client';

// =============================================================================
// BurbujaHilo — un mensaje de WhatsApp tal como LLEGA
// =============================================================================
// ⚠️ ESQUELETO DEL CONTRATO (08/10/2026). La parte del composer lo reemplaza por el render
// que hoy vive adentro de ChatHilo (imagen, documento, video, audio con su transcripción,
// texto con las marcas de WhatsApp). Lo usan ChatHilo, la tarjeta del mensaje en el lienzo
// (`compacta`) y la vista previa del editor.

import type { ReactNode } from 'react';

export type ContenidoBurbuja = {
  /** El texto, el pie del audio o el caption del archivo. */
  texto?: string;
  audio?: { url: string | null; titulo?: string; transcript?: string | null; duracion_s?: number | null } | null;
  media?: { url: string | null; mime: string; nombre?: string | null } | null;
  /** MaKo lo reescribe para cada lead: la burbuja lo marca. */
  ia?: boolean;
};

export type BurbujaHiloProps = {
  contenido: ContenidoBurbuja;
  /** Saliente (del negocio, a la derecha) o entrante. */
  saliente?: boolean;
  /** Versión chica, para la tarjeta del lienzo. */
  compacta?: boolean;
  /** Firma de la burbuja (el nombre del negocio). */
  autor?: string;
  hora?: string;
  pie?: ReactNode;
};

export function BurbujaHilo({ contenido }: BurbujaHiloProps) {
  return <div style={{ whiteSpace: 'pre-wrap' }}>{contenido.texto ?? ''}</div>;
}
