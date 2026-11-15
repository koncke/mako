// LA ✓ Y LA ✗ DE /planes, ESCRITAS UNA SOLA VEZ (15/11/2026).
//
// Martín: «que las cruces y los checks sean el mismo diseño de compara los planes que lo que está arriba en las columnas…
// el check verde lo pusiste como muy verde y me gustaba el que estaba arriba». Y enseguida: «las X, siento que hay algunas
// que están no centradas». Había DOS diseños para decir lo mismo: las columnas, un círculo verde pálido de 20 px con la
// letra «✓»; la tabla de abajo, uno de 22 px verde lleno (#16A34A) con la tilde blanca en SVG. Ahora los dos lados dibujan
// con ESTAS declaraciones (app/planes/Tarjetas.tsx y app/planes/estilo.ts), así que no se pueden separar sin tocar acá.
//
// ⚠️ EL SIGNO ES UN DIBUJO, NO UNA LETRA. «✓» y «✕» no están en la letra de la casa (Urbanist): cada sistema los saca de otra
// fuente (Segoe UI Symbol en Windows, Apple Symbols en el Mac, Noto en Android) y cada una los apoya a otra altura dentro del
// círculo. Centrar una letra centra su CAJA, no el trazo. Un SVG con el trazo centrado en su lienzo (las dos figuras van de 4 a
// 12 en un lienzo de 16) queda en el medio en todos lados, y es el mismo en todos lados.
//
// Va en un ::before en los dos lados. El color del trazo va ADENTRO del dibujo: un `background: <color>` posterior (el dorado
// del Acelerador) borra la imagen, por eso cada combinación se arma entera con `signo()`.

const TRAZO_SI = 'M3.5 8.5l3 3 6-7';
const TRAZO_NO = 'M4 4l8 8M12 4l-8 8';

function dibujo(trazo: string, color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='${trazo}' fill='none' stroke='${color}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Las declaraciones del círculo con su signo, para un ::before. `tam` es el lado del dibujo adentro del círculo de 20 px. */
export function signo(cual: 'si' | 'no', trazo: string, fondo: string): string {
  const tam = cual === 'si' ? 12 : 10;
  return `content: ""; flex: none; display: inline-block; box-sizing: border-box; width: 20px; height: 20px; border-radius: 50%; ` +
    `background: ${dibujo(cual === 'si' ? TRAZO_SI : TRAZO_NO, trazo)} center / ${tam}px ${tam}px no-repeat, ${fondo};`;
}

/** La ✓ («lo trae»): verde oscuro sobre verde pálido. La de las columnas desde siempre; Martín la prefirió a la verde llena. */
export const SIGNO_SI = signo('si', '#1F7A4D', '#E3F5EB');
/** La ✗ («no lo trae»): el mismo círculo, rojo sobre rojo pálido. */
export const SIGNO_NO = signo('no', '#D92D20', '#FDE8E7');
/** La ✓ del Acelerador, en su bloque oscuro: tinta oscura sobre el dorado de su botón. */
export const SIGNO_SI_DORADO = signo('si', '#2A1E00', '#F5C451');
