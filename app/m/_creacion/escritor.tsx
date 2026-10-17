'use client';

// =============================================================================
// Las piezas de los WRITERS del teléfono (Reels, Stories, Carousels): el campo, elegir una opción y el error
// =============================================================================
// Las tres tabs piden lo mismo que en escritorio (un tema o una idea + opciones CERRADAS) y MaKo escribe la pieza.
// En escritorio el pedido es un formulario a la izquierda; en el teléfono es una hoja que sube desde abajo, como el
// compositor de Instagram: el campo grande arriba y las opciones como filas que se tocan (la selección de iOS, un
// ✓ a la derecha), nunca un <select> que abre la ruedita del sistema con textos largos cortados.
// =============================================================================

import type { ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { FilaM, ListaM } from '@/app/m/_ui';
import styles from './escritor.module.css';

/** El campo de texto grande de una hoja (16 px: iOS no hace zoom). */
export function CampoM({ valor, onCambio, etiqueta, placeholder, deshabilitado, filas = 4 }: {
  valor: string;
  onCambio: (v: string) => void;
  /** El nombre accesible (lo que pregunta). */
  etiqueta: string;
  placeholder?: string;
  deshabilitado?: boolean;
  filas?: number;
}) {
  return (
    <textarea
      className={styles.campo}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      aria-label={etiqueta}
      placeholder={placeholder}
      readOnly={deshabilitado}
      rows={filas}
    />
  );
}

/** Elegir UNA opción de un catálogo cerrado: filas con su explicación y un ✓ en la elegida. */
export function OpcionesM<T extends string>({ opciones, valor, onCambio, etiqueta, deshabilitado }: {
  opciones: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  return (
    <ListaM etiqueta={etiqueta}>
      {opciones.map((o) => {
        const es = o.value === valor;
        return (
          <FilaM
            key={o.value}
            titulo={o.label}
            segunda={o.hint}
            chevron={false}
            deshabilitada={deshabilitado}
            etiqueta={es ? `${o.label}, elegida` : o.label}
            riel={es ? <span className={styles.tilde}><Icon name="check" size={20} /></span> : undefined}
            onClick={() => { if (!es) onCambio(o.value); }}
          />
        );
      })}
    </ListaM>
  );
}

/** Lo que no salió: el punto rojo y la frase en tinta (el rojo como texto no pasa AA a este tamaño). */
export function ErrorLineaM({ children }: { children: ReactNode }) {
  return <p className={styles.error} role="alert"><i aria-hidden />{children}</p>;
}

/** Un rótulo chico de una parte de la pieza («Gancho», «Escena 2»). */
export function RotuloM({ children }: { children: ReactNode }) {
  return <p className={styles.rotulo}>{children}</p>;
}
