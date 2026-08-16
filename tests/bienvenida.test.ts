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

const bienvenida = leer('../app/onboarding/Bienvenida.tsx');

test('los rótulos del segundo nivel salen del catálogo real, no copiados a mano', () => {
  // La bienvenida ya NO monta Grafo.tsx —no sabe arrancar en un nodo solo ni revelar por
  // niveles— pero eso no la habilita a inventar los nombres de las áreas. El nivel 2 se
  // arma desde `AREAS` de lib/cerebro-modelo.ts, que es el mismo catálogo que dibuja
  // /second-brain. Sin esta atadura, el día que se agregue un área esta pantalla queda
  // mostrando un mapa que ya no existe, y nadie se entera: se ve igual de bien.
  assert.ok(/from '@\/lib\/cerebro-modelo'/.test(bienvenida), 'dejó de importar el catálogo real');
  assert.ok(/AREAS\.filter/.test(bienvenida), 'dejó de derivar las áreas del catálogo');
  // Y los cinco rótulos narrativos son del pedido del dueño, en segunda persona.
  for (const et of ['Tus anuncios', 'Tu Oferta', 'Tu Avatar', 'Tu Funnel']) {
    assert.ok(bienvenida.includes(et), `falta el rótulo "${et}"`);
  }
});

test('el cerebro se arma con clicks, y el texto espera a que termine', () => {
  // Es el pedido entero en una línea: cuatro pasos, los tres primeros por click.
  assert.ok(/bv-p\$\{paso\}/.test(bienvenida), 'el paso dejó de gobernar el CSS');
  assert.ok(/setPaso\(\(p\) => \(p < 3 \? p \+ 1 : p\)\)/.test(bienvenida), 'el avance por click cambió de forma');
  assert.ok(/\.bv-p4 \.bv-titulo/.test(bienvenida), 'el texto dejó de esperar al último paso');
  assert.ok(/\.bv-p4 \.bv-mapa \{ transform: translateY/.test(bienvenida), 'el mapa dejó de subir antes del texto');
});

test('el botón es la acción de la pantalla: ancho completo, no un link chico', () => {
  // «hoy en día es mucho texto y el botón chiquito en el medio» (pedido del 16/08).
  // ⚠️ Se busca la REGLA del botón, no la primera aparición del selector: hay una línea
  // previa que lo agrupa con el título y la frase para dejarlos en opacity 0, y un
  // `indexOf` la agarraba a ella. El test falló por eso y el botón estaba perfecto —
  // un test que falla por su propia búsqueda enseña a ignorar los tests.
  const regla = bienvenida.match(/\n\.bv-boton \{[\s\S]{0,400}/);
  assert.ok(regla, 'no encontré la regla .bv-boton');
  assert.ok(/width:\s*100%/.test(regla[0]), 'el botón dejó de ser de ancho completo');
});

test('el bloque de estilos no tiene comillas invertidas adentro', () => {
  // ⚠️ ESTO PASÓ TRES VECES EN UNA SOLA SESIÓN. El CSS vive dentro de un template
  // literal, así que una comilla invertida en un comentario —`.bv-ojo`, escrito como se
  // escribe un identificador— CIERRA el string y rompe el build ENTERO. No hay síntoma
  // parcial: la app no compila.
  //
  // La cabecera del archivo ya lo advertía y volvió a pasar igual, que es exactamente el
  // caso de AGENTS.md: una regla que solo vive en prosa no se cumple, se cumple casi
  // siempre. Esto es la otra capa, la determinista.
  const i = bienvenida.indexOf('const ESTILOS = ');
  assert.ok(i > 0, 'no encontré el bloque ESTILOS');
  const backticks = (bienvenida.slice(i).match(/`/g) ?? []).length;
  assert.equal(backticks, 2, 'hay comillas invertidas DENTRO del template de CSS: rompen el build');
});
