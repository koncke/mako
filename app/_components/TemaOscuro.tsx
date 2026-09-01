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
    // ⚠️ Si el usuario YA eligió modo oscuro para toda la app, esta pantalla no
    // se lo prestó: se lo encontró puesto. Sacarlo al salir le apagaría su
    // preferencia por haber pasado por acá — y desde /second-brain eso se ve
    // como «la app se puso clara sola».
    const yaEstaba = document.documentElement.getAttribute(MARCA) === VALOR;
    document.documentElement.setAttribute(MARCA, VALOR);
    return () => { if (!yaEstaba) document.documentElement.removeAttribute(MARCA); };
  }, []);

  // ⚠️ NO DEVUELVE NADA, y el `<script>` que evita el flash se mudó a
  // `TemaOscuroScript`, que NO es un componente cliente.
  //
  // React se quejaba en CADA render: «Encountered a script tag while rendering
  // React component. Scripts inside React components are never executed when
  // rendering on the client». Tiene razón —en el pase de cliente no se ejecuta—
  // y el error era permanente y falso, que es la peor clase de ruido: el
  // protocolo de este repo dice que ante un problema lo primero es mirar la
  // consola de quien lo está viendo, y un error falso que sale siempre enseña a
  // ignorarla.
  //
  // Lo que queda acá es lo que el script NO puede hacer: prender el atributo al
  // volver a esta ruta por navegación de cliente, donde no hay documento nuevo
  // que parsear, y apagarlo al salir.
  return null;
}
