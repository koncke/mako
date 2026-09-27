// =============================================================================
// Dónde cae el popover de la portada
// =============================================================================
// El selector de portada dejó de ser un modal centrado y pasó a colgar del botón
// que lo abre, como el de Notion (27/09/2026). Un modal centrado no se puede
// equivocar de lugar; un popover sí, y se equivoca en silencio: queda medio
// afuera de la ventana, con la mitad de las opciones fuera del alcance y sin un
// solo error. Eso no lo caza el typecheck ni se ve en una captura del caso feliz.
//
// Lo que se fija acá son las tres cosas que la posición tiene que cumplir SIEMPRE,
// con cualquier ancla y cualquier ventana:
//   1. alineado a la DERECHA del ancla, que es de donde cuelga;
//   2. si abajo no entra y arriba hay más lugar, se da vuelta y NO lo tapa;
//   3. nunca, en ningún caso, se sale de la ventana.
//
// ⚠️ La tercera es la que importa de verdad y es la que un caso feliz no prueba:
// el ancla del proyecto vive en la columna derecha de un detalle, o sea pegada al
// borde, que es exactamente donde un panel de 620 px no entra.
//
// PROBADO ROMPIÉNDOLO, que es lo único que distingue un test medido de uno escrito:
//   · sin el clamp horizontal (`left = ancla.right - panel.ancho` pelado) → 5 pasan,
//     2 fallan (los dos bordes).
//   · sin el vuelco vertical (`arriba = false`) → 6 pasan, 1 falla.
//   · con el archivo restaurado → 7 de 7.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ubicarPanel } from '../app/_components/PortadaPicker';

const VENTANA = { ancho: 1400, alto: 900 };
const PANEL = { ancho: 620, alto: 380 };
const MARGEN = 10;

/** Las cuatro invariantes de «está adentro de la ventana», juntas. */
function adentro(pos: { left: number; top: number }) {
  assert.ok(pos.left >= MARGEN, `se sale por la izquierda: left=${pos.left}`);
  assert.ok(pos.left + PANEL.ancho <= VENTANA.ancho - MARGEN, `se sale por la derecha: right=${pos.left + PANEL.ancho}`);
  assert.ok(pos.top >= MARGEN, `se sale por arriba: top=${pos.top}`);
  assert.ok(pos.top + PANEL.alto <= VENTANA.alto - MARGEN, `se sale por abajo: bottom=${pos.top + PANEL.alto}`);
}

test('cuelga del ancla: alineado a su DERECHA y justo debajo', () => {
  const ancla = { left: 600, right: 900, top: 200, bottom: 340 };
  const pos = ubicarPanel(ancla, PANEL, VENTANA);
  // El borde derecho del panel es el borde derecho del botón: es lo que hace que se
  // lea como que salió DE AHÍ y no de cualquier lado.
  assert.equal(pos.left + PANEL.ancho, ancla.right);
  assert.equal(pos.top, ancla.bottom + 8);
  adentro(pos);
});

test('si abajo no entra y arriba sí, se da vuelta — y no tapa al ancla', () => {
  // 190 px libres abajo contra 490 arriba: un panel de 380 abajo quedaría cortado.
  const ancla = { left: 600, right: 900, top: 500, bottom: 700 };
  const pos = ubicarPanel(ancla, PANEL, VENTANA);
  assert.ok(pos.top + PANEL.alto <= ancla.top, `tapa el botón que lo abrió: ${pos.top + PANEL.alto} > ${ancla.top}`);
  adentro(pos);
});

test('con lugar abajo NO se da vuelta, aunque arriba también entre', () => {
  // El default es abajo: dar vuelta sin necesidad mueve el panel a donde nadie lo
  // fue a buscar. Sólo se invierte cuando abajo de verdad no entra.
  const ancla = { left: 600, right: 900, top: 420, bottom: 460 };
  const pos = ubicarPanel(ancla, PANEL, VENTANA);
  assert.equal(pos.top, ancla.bottom + 8);
  adentro(pos);
});

test('ancla pegada a la IZQUIERDA: no se sale por el borde', () => {
  // `right - ancho` da -500. Sin el clamp, medio panel queda fuera de la pantalla.
  const pos = ubicarPanel({ left: 20, right: 120, top: 100, bottom: 200 }, PANEL, VENTANA);
  assert.equal(pos.left, MARGEN);
  adentro(pos);
});

test('ancla pegada a la DERECHA: tampoco', () => {
  // Éste es el caso REAL del proyecto: el campo Portada vive en la columna derecha
  // del detalle, así que el ancla está contra el borde.
  const pos = ubicarPanel({ left: 1200, right: 1395, top: 100, bottom: 200 }, PANEL, VENTANA);
  assert.equal(pos.left + PANEL.ancho, VENTANA.ancho - MARGEN);
  adentro(pos);
});

test('ventana más baja que el panel: se queda pegado arriba, nunca en negativo', () => {
  // Un portátil con el zoom puesto. Va a quedar cortado igual —no hay lugar—, pero
  // cortado por ABAJO, que deja usable la cabecera con las pestañas; un `top`
  // negativo esconde justo las pestañas y no hay forma de volver.
  const chica = { ancho: 1400, alto: 300 };
  const pos = ubicarPanel({ left: 600, right: 900, top: 100, bottom: 160 }, PANEL, chica);
  assert.equal(pos.top, MARGEN);
  assert.ok(pos.left >= MARGEN);
});

test('el ancla más ancha que el panel sigue alineando por la derecha', () => {
  // La portada de la ficha es una banda de 140 px de alto y TODO el ancho del modal:
  // el botón que la abre está al centro, pero el ancla puede ser grande.
  const ancla = { left: 100, right: 1300, top: 120, bottom: 260 };
  const pos = ubicarPanel(ancla, PANEL, VENTANA);
  assert.equal(pos.left + PANEL.ancho, ancla.right);
  adentro(pos);
});
