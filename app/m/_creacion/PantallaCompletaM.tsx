'use client';

// =============================================================================
// PantallaCompletaM — un EDITOR a pantalla completa en el teléfono (el de CapCut, el de Canva)
// =============================================================================
// En CapCut y en Canva del teléfono el editor ocupa TODA la pantalla, con su propia barra arriba (cerrar, el nombre,
// exportar): no hay encabezado de la app ni barra de abajo. Esto es esa capa: fija, de borde a borde, con las áreas
// seguras del teléfono, por encima del encabezado del shell (z 41 > 40) y por debajo de las hojas y del toast.
//
// Va por portal a <body>, FUERA de #m-root: los motores de los editores (OpenCut en `.ce`, Doory en `.cv`) traen sus
// propios estilos y tokens, y las reglas del shell de /m (`[data-m] :is(h1,h2,h3,p) { margin: 0 }`, los 16 px de
// los campos) no les tienen que caer encima. Lleva `data-m-sin-pull`: tirar hacia abajo adentro de un editor es
// mover algo, no refrescar la página de atrás (PantallaM lo mira).
// El HTML del server no la dibuja (un portal necesita `document`): la ruta ya es de trabajo (app/m/_ui/cabecera.ts →
// `esTrabajo`), así que mientras hidrata se ve el encabezado sin la barra de abajo.
// =============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './PantallaCompletaM.module.css';

export function PantallaCompletaM({ etiqueta, oscura = false, children }: {
  /** El nombre de la región («Editor de video»), para el lector de pantalla. */
  etiqueta: string;
  /** Fondo oscuro (el de CapCut); si no, el de la app. */
  oscura?: boolean;
  children: ReactNode;
}) {
  const [montada, setMontada] = useState(false);
  useEffect(() => { setMontada(true); }, []);
  if (!montada) return null;
  return createPortal(
    <div className={oscura ? `${styles.capa} ${styles.oscura}` : styles.capa} role="region" aria-label={etiqueta} data-m-sin-pull>
      {children}
    </div>,
    document.body,
  );
}
