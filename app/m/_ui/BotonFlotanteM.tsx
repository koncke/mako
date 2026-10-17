'use client';

// =============================================================================
// BotonFlotanteM — el «+» flotante de abajo a la derecha (crear algo nuevo)
// =============================================================================
// El de Canva en el teléfono («+» para crear un diseño) y el del Calendario del teléfono (el de Google Calendar,
// app/m/calendario: misma medida, 56 px y radio 18). Va por portal a #m-pie, FUERA de la columna: adentro de la
// página se correría con el pull-to-refresh (PantallaM le pone `transform`), y en #m-root no hay `--m-abajo`
// (app/m/_ui/LEEME.md). La página deja libre el final con `<HuecoFlotanteM />`, para que el «+» no tape la última fila.
// =============================================================================

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import styles from './BotonFlotanteM.module.css';

export function BotonFlotanteM({ etiqueta, onClick, deshabilitado }: {
  /** Qué crea («Crear un diseño»): el nombre accesible, porque sólo se dibuja el «+». */
  etiqueta: string;
  onClick: () => void;
  deshabilitado?: boolean;
}) {
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setCapa(document.getElementById('m-pie')); }, []);
  if (!capa) return null;
  return createPortal(
    <button type="button" className={styles.fab} aria-label={etiqueta} onClick={onClick} disabled={deshabilitado}>
      <Icon name="plus" size={26} />
    </button>,
    capa,
  );
}

/** El espacio libre al final de la página, del alto del «+». */
export function HuecoFlotanteM() {
  return <div className={styles.hueco} aria-hidden />;
}
