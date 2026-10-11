'use client';

// =============================================================================
// HoraM — «Actualizado 10:42», en el reloj de quien mira
// =============================================================================
// ⚠️ SE ESCRIBE DESPUÉS DE MONTAR, a propósito. El server formatea con SU zona
// horaria y el teléfono con la suya: formatear en el render da un texto distinto
// en cada lado y React lo marca como error de hidratación. El HTML del server sale
// sin hora (es un dato de frescura, no de contenido) y el cliente la completa.
// =============================================================================

import { useEffect, useState } from 'react';
import { horaCorta } from './formato';

export function HoraM({ momento, prefijo = 'Actualizado' }: {
  momento: Date | number | string | null | undefined;
  /** Lo que va antes de la hora. «Actualizado» arriba de una lista viva. */
  prefijo?: string;
}) {
  const ms = momento == null ? null : momento instanceof Date ? momento.getTime() : new Date(momento).getTime();
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    setTexto(ms == null || Number.isNaN(ms) ? null : horaCorta(ms));
  }, [ms]);
  if (!texto || ms == null) return null;
  return <time className="m-actualizado" dateTime={new Date(ms).toISOString()}>{`${prefijo} ${texto}`}</time>;
}
