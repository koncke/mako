// La plancha sobre un fondo DESENFOCADO: lo que no se puede borrar se rellena desde sus bordes, no con un parche liso (20/11/2026,
// la llamada con Leila, Fathom 205366178, 00:51:03: la plantilla que eligió «tiene como su blur», y la réplica «hizo cualquier
// cosa»).
//
// Sobre un blur, `borrarZona` no puede continuar el fondo (de un lado a otro del renglón el color cambia más de lo que acepta) y el
// carrusel la TAPABA con el color dominante de alrededor (`taparZona`): un rectángulo liso de otro tono detrás de cada renglón.
// Ahora `planchar` con `tapar` usa `rellenarZona`: la superficie de Coons desde los cuatro bordes. Esto fija:
//   1. sobre un degradé desenfocado en dos direcciones, el renglón borrado queda a menos de 6 niveles del fondo que tenía detrás
//      (el parche liso de antes se apartaba más de 40);
//   2. en una miniatura (sin `tapar`) el camino es el de siempre (nada del relleno de los bordes);
//   3. pegado al borde de la lámina, toma el lado de enfrente (no se rompe).
//
// Correr: node --import tsx --test tests/carruseles-plancha-blur.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planchar, rellenarZona, taparZona, type Rgba } from '../lib/carruseles/plancha-local';

const W = 240;
const H = 300;
/** El fondo «con blur»: un degradé suave en las dos direcciones (azul oscuro arriba a la izquierda, ocre abajo a la derecha). */
const fondo = (x: number, y: number): [number, number, number] => [Math.round(30 + 170 * (x / W)), Math.round(40 + 120 * (y / H)), Math.round(120 - 80 * (x / W))];
function lamina(): Rgba {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.set([...fondo(x, y), 255], (y * W + x) * 4);
  // Un renglón de «letras» blancas (palos de 3 px cada 10, con un espacio entre palabras) entre y = 120 y 150, de x = 30 a 210.
  for (let y = 120; y < 150; y++) for (let x = 30; x < 210; x++) if (x % 10 < 3 && (x - 30) % 60 < 45) px.set([250, 250, 250, 255], (y * W + x) * 4);
  return { ancho: W, alto: H, px };
}
const peorDiferencia = (img: Rgba, zona: { x: number; y: number; ancho: number; alto: number }) => {
  let peor = 0;
  for (let y = zona.y; y < zona.y + zona.alto; y++) for (let x = zona.x; x < zona.x + zona.ancho; x++) {
    const i = (y * W + x) * 4;
    const f = fondo(x, y);
    peor = Math.max(peor, ...[0, 1, 2].map((c) => Math.abs(img.px[i + c] - f[c])));
  }
  return peor;
};
const renglon = { n: 1, caja: { x: 30, y: 120, ancho: 180, alto: 30 } };

test('1 · sobre un blur, el renglón borrado queda como el fondo que tenía detrás (no un parche liso)', () => {
  const img = lamina();
  const r = planchar(img, { renglones: [renglon], figuras: [] }, { textos: [{ renglones: [1] }], personas: [], tapar: true });
  assert.equal(r.ok, true);
  const zona = { x: 30, y: 120, ancho: 180, alto: 30 };
  const ahora = peorDiferencia(img, zona);
  assert.ok(ahora <= 6, `el relleno se aparta ${ahora} niveles del fondo`);
  // Lo de antes, para comparar: el parche del color dominante.
  const antes = lamina();
  taparZona(antes, zona, 3);
  assert.ok(peorDiferencia(antes, zona) > 40, 'el parche liso de antes ya se apartaba poco: el caso no prueba nada');
});

test('2 · en una miniatura (sin tapar) el camino es el de siempre: nada del relleno de los bordes', () => {
  // Sin `tapar` (una miniatura o la portada de un reel) no se usa `rellenarZona`: lo que pasa es lo de antes del 20/11.
  const img = lamina();
  planchar(img, { renglones: [renglon], figuras: [] }, { textos: [{ renglones: [1] }], personas: [] });
  const conRelleno = lamina();
  planchar(conRelleno, { renglones: [renglon], figuras: [] }, { textos: [{ renglones: [1] }], personas: [], tapar: true });
  assert.notDeepEqual(img.px, conRelleno.px, 'la miniatura tomó el camino del carrusel');
});

test('3 · pegado al borde de la lámina toma el lado de enfrente', () => {
  const img = lamina();
  rellenarZona(img, { x: 0, y: 0, ancho: 60, alto: 20 }, 0);
  assert.ok(peorDiferencia(img, { x: 0, y: 0, ancho: 60, alto: 20 }) <= 30, 'el borde de la lámina rompió el relleno');
});
