'use client';

// =============================================================================
// TemaOscuro — una pantalla que se pinta oscura, sin modo oscuro global
// =============================================================================
// Marca `<html data-tema="oscuro">` mientras esta pantalla está montada y lo saca
// al salir. Los tokens redefinidos viven en app/globals.css (`[data-tema="oscuro"]`);
// acá solo se prende el interruptor.
//
// POR QUÉ EN <html> Y NO EN UN DIV DE LA PANTALLA: el fondo de la página lo pinta
// un contenedor del layout raíz que está ARRIBA del `<main>`, y `--bg` tiene que
// redefinirse en un ancestro suyo para que lo tome. Puesto en un div de adentro,
// la pantalla quedaba oscura por dentro y con un marco claro alrededor — que es
// exactamente el «contenedor con otro color» que este rediseño vino a sacar.
//
// ⚠️ EL <script> NO ES OPCIONAL Y NO ES UN DUPLICADO DEL EFECTO. Un `useEffect`
// corre DESPUÉS de la hidratación: entre el primer pintado y esa línea hay un
// flash blanco de pantalla completa, que en una pantalla que es casi toda lienzo
// se ve como un fogonazo. El script inline se ejecuta mientras el navegador
// todavía está parseando el `<head>`, antes de pintar nada. El efecto sigue
// haciendo falta para el caso que el script no cubre: volver a esta ruta por
// navegación de cliente, donde no hay documento nuevo que parsear.
//
// El cleanup es la otra mitad: sin él, ir de /second-brain a /plan deja el
// atributo puesto y el tablero entero sale oscuro.
// =============================================================================

import { useEffect } from 'react';

const MARCA = 'data-tema';
const VALOR = 'oscuro';

export function TemaOscuro() {
  useEffect(() => {
    document.documentElement.setAttribute(MARCA, VALOR);
    return () => { document.documentElement.removeAttribute(MARCA); };
  }, []);

  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute('${MARCA}','${VALOR}')` }}
    />
  );
}
