'use client';

// =============================================================================
// El marco del Image Editor SIN un diseño montado: la tarjeta de la izquierda con tus diseños y, a su derecha, lo que va
// en lugar del editor (la vista de crear, «Abriendo…», «Este diseño no existe»)
// =============================================================================
// Es el MISMO armazón que dibuja EditorApp con un diseño abierto (las clases `.marco`, `.chat` y `.columna` de
// ../_doory/editor/EditorApp.module.css, importadas tal cual): la tarjeta no salta de lugar ni de tamaño al ir de un
// diseño a la vista de crear, como en el Web Generator. En la pantalla chica (< 1024 px) la tarjeta no está, igual que
// el chat fijo (`ChatFijo`): ahí la lista es «Proyectos» de la tira de abajo y «Mis diseños» de la vista de crear.
// =============================================================================

import type { ReactNode } from 'react';
import armazon from '../_doory/editor/EditorApp.module.css';
import { ListaDisenos } from '../mako/ListaDisenos';
import styles from './estudio.module.css';

export function Marco({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <div className={armazon.marco}>
      <section className={`${armazon.chat} ${styles.tarjeta}`} role="complementary" aria-label="Tus diseños">
        <ListaDisenos />
      </section>
      <div className={`${armazon.columna} ${styles.lugar}`} role="region" aria-label={etiqueta}>
        {children}
      </div>
    </div>
  );
}
