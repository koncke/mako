// Los valores medidos de las plantillas que Martín mandó copiar, en el Web Generator y en el cartel de la landing (31/10/2026).
// Cada número sale de docs/diseno/: si la referencia cambia, se vuelve a leer del navegador, no se ajusta el test a ojo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const gamma = leer('app/web-generator/gamma.css');
const oscuro = gamma.slice(gamma.indexOf('[data-tema="oscuro"] .gma {'), gamma.indexOf('}', gamma.indexOf('[data-tema="oscuro"] .gma {')));

test('el editor está en Tilvo: fondo no blanco, tarjeta un tono arriba, líneas de tinta con alfa', () => {
  assert.match(gamma, /--gma-fondo-app: #eef1f5;/);
  assert.match(gamma, /--gma-superficie: #fbfcfd;/);
  assert.match(gamma, /--gma-borde-suave: #12182614;/);
  assert.match(gamma, /--gma-primario: #1f55d6;/);
});

test('en oscuro se invierte la luminosidad del acento y la sombra es negro real, no la paleta clara oscurecida', () => {
  assert.match(oscuro, /--gma-primario: #6e98ff;/);
  assert.match(oscuro, /--gma-sobre-primario: #0b1222;/);
  assert.match(oscuro, /--gma-sombra-md: 0 1px 2px #0000004d/);
});

test('la letra es Urbanist, y la hoja carga la misma que declara', () => {
  assert.match(gamma, /--gma-fuente: 'Urbanist'/);
  assert.doesNotMatch(gamma.slice(gamma.indexOf('.gma {')), /Instrument Sans/);
  assert.match(leer('app/web-generator/cliente.ts'), /URL_FUENTE_CHROME = 'https:\/\/fonts\.googleapis\.com\/css2\?family=Urbanist/);
});

test('el rebote es el «pop» medido: el único de la familia', () => {
  assert.match(gamma, /--gma-rebote: cubic-bezier\(\.25, 1\.1, \.4, 1\);/);
});

test('los temas de las landings NO se tocan: son el contenido de cada cliente, no el chrome', () => {
  assert.match(leer('lib/editor-landing/temas.ts'), /'Instrument Sans': \{ pesos/);
});

test('el teléfono va al final de la hoja: antes, el margen del lienzo de más abajo le gana', () => {
  const margen = gamma.indexOf('.gma-lienzo[data-dispositivo="escritorio"] > .gm-doc:not([data-formato="presentacion"]) { margin-left: 88px; }');
  const telefono = gamma.indexOf('@media (max-width: 760px) {');
  assert.ok(margen > 0 && telefono > margen);
  assert.match(gamma.slice(telefono), /\.gma-cuerpo \{ flex-direction: column; \}/);
});

test('en el cartel, el naranja de «esto es ahora» es sólo del reloj', () => {
  const cartel = leer('app/vsl/CartelPromo.tsx');
  assert.match(cartel, /\.mk-promo-reloj \{[^}]*color: #e2603a;/);
  assert.equal((cartel.match(/color: #e2603a/g) ?? []).length, 1);
});
