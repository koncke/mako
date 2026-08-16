// La bienvenida apaga el chrome del grafo con CSS, y eso solo se sostiene si las clases
// siguen llamándose igual. Un renombre en Grafo.tsx no rompe nada visible en
// /second-brain y haría REAPARECER el filtro, el tirador y el navegador lateral encima de
// la primera pantalla que ve un cliente nuevo — en silencio, que es lo peor.
//
// Es la regla de la casa: si una regla no se puede validar, es una expresión de deseo.
// Ésta sí se puede, así que se valida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');

const grafo = leer('../app/second-brain/Grafo.tsx');
const bienvenida = leer('../app/onboarding/Bienvenida.tsx');

test('las clases del chrome que la bienvenida apaga siguen existiendo en el grafo', () => {
  for (const clase of ['cbg-barra', 'cbg-tirador', 'cbg-detalle']) {
    assert.ok(grafo.includes(clase), `Grafo.tsx ya no usa "${clase}"`);
    assert.ok(bienvenida.includes(clase), `Bienvenida.tsx dejó de apagar "${clase}"`);
  }
  // La variable del ancho de columna: sin ponerla en cero, el lienzo queda angosto y
  // sobra una franja negra a la derecha donde vivía el panel.
  assert.ok(grafo.includes('--cbg-col'), 'Grafo.tsx ya no usa --cbg-col');
  assert.ok(bienvenida.includes('--cbg-col'), 'Bienvenida.tsx dejó de anular --cbg-col');
});

test('la bienvenida monta el grafo de verdad, no una copia', () => {
  // Si alguien vuelve a dibujar una constelación propia acá, esto lo frena: el pedido
  // del dueño fue textual — «no es necesario que inventes una animación si el grafo que
  // ya hicimos actúa como animación, es interactivo y se ve más impresionante».
  assert.ok(/from '@\/app\/second-brain\/Grafo'/.test(bienvenida), 'la bienvenida ya no importa el Grafo real');
  assert.ok(/<Grafo\s/.test(bienvenida), 'la bienvenida ya no monta <Grafo>');
});

test('el botón es la acción de la pantalla: ancho completo, no un link chico', () => {
  // «hoy en día es mucho texto y el botón chiquito en el medio» (pedido del 16/08).
  const css = bienvenida.slice(bienvenida.indexOf('.bv-boton {'));
  assert.ok(/width:\s*100%/.test(css.slice(0, 400)), 'el botón dejó de ser de ancho completo');
});
