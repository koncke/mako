'use client';

// =============================================================================
// El crédito que exige la licencia de Doory, cada vez que se abre el editor
// =============================================================================
// El motor del editor es Doory (Attribution Assurance License, _doory/LICENSE-DOORY).
// Su condición 2 pide, «each time the resulting executable program … is launched,
// a prominent display (e.g., splash screen or banner text)» con el nombre del
// autor, su identificación y la URL. Servir el JS al navegador es redistribuirlo
// (docs/editor-imagen/repos/doory.md §1.3), así que el cartel sale en CADA
// apertura del editor, en inglés literal para no discutir la traducción.
//
// Martín eligió el 14/10 portar Doory y después transformarlo. Modificarlo no
// saca la obligación (lo derivado sigue siendo derivado): el cartel se va sólo
// con permiso escrito del autor o con un editor reescrito sin su código.
// Se puede cerrar, pero vuelve la próxima vez que se abre un diseño.
// Con el armazón de Canva (tanda 2) va como franja fina al pie del editor
// (PantallaEditor), debajo de la barra inferior: no compite con la barra superior.

import { useState } from 'react';
import styles from './credito.module.css';

export const CREDITO_DOORY = 'Doory by Siam, Creator and maintainer of Doory';
export const URL_DOORY = 'https://github.com/shaongitbd/doory';

export function CreditoDoory() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className={styles.credito} role="note">
      <span>
        {CREDITO_DOORY} · <a href={URL_DOORY} target="_blank" rel="noreferrer">{URL_DOORY}</a>
      </span>
      <button type="button" className={styles.cerrar} onClick={() => setVisible(false)} aria-label="Cerrar">×</button>
    </div>
  );
}
