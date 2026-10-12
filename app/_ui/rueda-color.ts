// =============================================================================
// rueda-color — el círculo arcoíris de «Otro color», UNO para toda la app
// =============================================================================
// Estaba escrito dos veces, igual carácter por carácter: en el selector de portada (app/_components/PortadaPicker.tsx)
// y en el de láminas de los cursos (app/_cursos/laminas/SelectorLaminas.tsx). El Dashboard lo necesitaba una
// tercera vez (tanda v5, punto 17: «Otro color» del estilo de la hoja pasa a ser un círculo más). Una cosa, un
// lugar: los tres lo importan de acá.
//
// Se usa igual en los tres: un círculo del tamaño de las muestras con este fondo y el `<input type="color">`
// encima con `opacity: 0` (abre el selector del sistema).
//
// ⚠️ ES LA ÚNICA EXCEPCIÓN A «SÓLO TOKENS»: una rueda de colores no se da vuelta en el modo oscuro, y está
//    bien. Por eso va como constante de TS y nunca en una hoja de estilos de las que el repo barre buscando un
//    hex (el editor del Dashboard, app/dashboard/editor-css.ts, lo frena tests/dashboard-pantalla.test.ts).

export const RUEDA_COLOR = 'conic-gradient(from 90deg, #ff0000, #ffea00, #21d24a, #00c2ff, #2b5cff, #c000ff, #ff0090, #ff0000)';
