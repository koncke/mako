// =============================================================================
// UN MODAL QUE CONTIENE OTROS MODALES: la regla de qué se ve, y sus call sites
// =============================================================================
// «Al abrir una tarea o un proyecto, al intentar abrir el detail se bugea y no abre nada,
// cambia la ruta y luego ya no me deja abrir el cliente» (27/09/2026).
//
// Eran DOS bugs encadenados, los dos medidos en el navegador antes de tocar nada:
//
//  1. LA PILA APAGABA A LA FICHA, Y CON ELLA AL MODAL QUE SE ACABABA DE ABRIR.
//     `FichaCliente` es un `Modal` de la casa que monta el tablero entero adentro, y el
//     tablero abre sus propios modales — que son DESCENDIENTES suyos en el DOM. La pila
//     esconde al de abajo con `display:none`, así que escondía al de arriba también.
//     Medido: `.mk-modal__fondo` en `display:none` con el overlay del detalle adentro,
//     montado, en `display:flex` y z 132. O sea: montado y sin caja.
//  2. EL TABLERO ESCRIBÍA `?tarea=` EN LA URL DE `/customer-success` y lo LEÍA al montar.
//     Con ese parámetro pegado, cada intento de abrir el cliente montaba el tablero, que
//     abría el detalle, que tapaba todo: el cliente dejaba de poder abrirse.
//
// Lo que este archivo fija es la regla PURA de visibilidad y los CALL SITES de las dos
// props nuevas. Los call sites importan tanto como la regla: una prop opcional que nadie
// enchufa compila, pasa los tests y no existe en pantalla (AGENTS.md → «Escribir la salida
// no es ofrecerla»).
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ. Base: **9 pasan, 0 fallan**
// (`node --import tsx --test tests/modal-contenedor.test.ts`). Los números de cada rotura
// están al pie de este comentario, medidos y revertidos:
//
//  #  Qué se rompió                                                        Result.  Qué cayó
//  1  `decidirVisible` sin la rama de `contenedores`                        8 / 1  «una capa CONTENEDOR no la apaga nada»
//  2  `decidirVisible` devolviendo true para un id fuera de la pila         8 / 1  «lo que no está en la pila no se ve»
//  3  `contenedor` fuera del `<Modal>` de FichaCliente                      8 / 1  «la ficha declara que es contenedor»
//  4  `embebido` fuera de `<PlanBoard>` en FichaCliente                     8 / 1  «los dos tableros de la ficha van embebidos»
//  5  `if (embebido) return;` fuera del efecto que ESCRIBE la URL           8 / 1  «embebido no toca la URL: ni la lee ni la escribe»
//  6  `if (embebido) return;` fuera del efecto que LEE la URL               8 / 1  «embebido no toca la URL: ni la lee ni la escribe»
//
// (Los dos últimos se anclan en el VECINO de cada efecto y no en un CONTEO: `embebido`
// apaga más cosas que la URL, así que contarlos se rompía con cada apagado nuevo.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decidirVisible } from '../app/_components/pila-modales';

const RAIZ = resolve(__dirname, '..');
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r/g, '');

const FICHA = leer('app', 'customer-success', 'FichaCliente.tsx');
const MODAL = leer('app', '_ui', 'Modal.tsx');
const SHELL = leer('app', 'plan', 'board', 'BoardShell.tsx');
const PLAN = leer('app', 'plan', 'PlanBoard.tsx');
const TODO = leer('app', 'plan', 'TodoBoard.tsx');

const sinNada = new Set<string>();

// ── la regla ─────────────────────────────────────────────────────────────────

test('lo que no está en la pila no se ve', () => {
  assert.equal(decidirVisible(['a', 'b'], 'z', sinNada, sinNada), false);
  assert.equal(decidirVisible([], 'a', sinNada, sinNada), false);
  // Y ni siquiera estando declarada como contenedor: no estar abierta le gana a todo.
  assert.equal(decidirVisible([], 'a', sinNada, new Set(['a'])), false);
});

test('el default no cambió: el de abajo se apaga', () => {
  // Es la regla que ya tenían las ~25 pantallas que usan la pila. Si esto se moviera,
  // dos overlays superpuestos y el de atrás scrolleando solo.
  assert.equal(decidirVisible(['a'], 'a', sinNada, sinNada), true, 'el único abierto se ve');
  assert.equal(decidirVisible(['a', 'b'], 'a', sinNada, sinNada), false, 'con uno encima, no');
  assert.equal(decidirVisible(['a', 'b'], 'b', sinNada, sinNada), true, 'el de arriba sí');
});

test('una capa anidada no apaga a la de abajo', () => {
  // El «Personalizado…» de la repetición, abierto desde un campo del detalle (26/09/2026).
  assert.equal(decidirVisible(['a', 'b'], 'a', new Set(['b']), sinNada), true);
  // Y con dos anidadas encima sigue valiendo.
  assert.equal(decidirVisible(['a', 'b', 'c'], 'a', new Set(['b', 'c']), sinNada), true);
  // Pero una sola NO anidada arriba de todo alcanza para apagarla: lo que apaga es una
  // pantalla nueva, y basta que haya una.
  assert.equal(decidirVisible(['a', 'b', 'c'], 'a', new Set(['b']), sinNada), false);
});

test('una capa CONTENEDOR no la apaga nada', () => {
  // Éste es el caso de la ficha: lo que se abre encima vive ADENTRO suyo.
  const cont = new Set(['a']);
  assert.equal(decidirVisible(['a', 'b'], 'a', sinNada, cont), true, 'con una pantalla encima');
  assert.equal(decidirVisible(['a', 'b', 'c', 'd'], 'a', sinNada, cont), true, 'con tres encima');
  // Y no contagia: el hijo del medio sigue apagándose cuando le abren algo encima, que es
  // lo correcto — el detalle de un proyecto abierto desde una tarea la reemplaza.
  assert.equal(decidirVisible(['a', 'b', 'c'], 'b', sinNada, cont), false);
});

test('ser contenedor no es ser anidada: son dos preguntas distintas', () => {
  // `anidada` la declara el de ARRIBA («yo no tapo»); `contenedor`, el de ABAJO («no me
  // apagues»). Si fueran lo mismo, marcar la ficha como anidada la dejaría sin tapar a la
  // pantalla de atrás, que no es lo que se quiere.
  assert.equal(decidirVisible(['a', 'b'], 'b', new Set(['b']), sinNada), true, 'anidada arriba se ve');
  assert.equal(decidirVisible(['a', 'b'], 'a', sinNada, new Set(['b'])), false,
    'marcar contenedor al de ARRIBA no salva al de abajo');
});

// ── los call sites ───────────────────────────────────────────────────────────

test('la ficha declara que es contenedor', () => {
  // Sin esta línea vuelve el bug entero: click en una tarea = pantalla en blanco.
  assert.match(FICHA, /\n\s+contenedor\n/, 'FichaCliente le pasa `contenedor` a Modal');
  assert.match(MODAL, /contenedor\?: boolean;/, 'Modal lo declara');
  assert.match(MODAL, /useCapaModal\(true, \{ anidada, contenedor \}\)/, 'y lo pasa a la pila');
});

test('los dos tableros de la ficha van embebidos', () => {
  // ⚠️ LOS DOS. `BoardShell` es UNO y lo montan dos mitades (AGENTS.md): pasarlo en una
  // sola deja el bug vivo para la mitad de los workspaces, que es el modo de falla que
  // este repo ya pagó cuatro veces con las columnas del tablero.
  // Sin el flag `s`: `[^>]` ya matchea saltos de línea, y ese flag necesita un target
  // más nuevo que el del repo (tsc lo rechaza con TS1501).
  assert.match(FICHA, /<PlanBoard[^>]*embebido/, 'PlanBoard');
  assert.match(FICHA, /<TodoBoard[^>]*embebido/, 'TodoBoard');
  assert.match(PLAN, /embebido\?: boolean;/, 'PlanBoard lo declara');
  assert.match(TODO, /embebido\?: boolean;/, 'TodoBoard lo declara');
  assert.match(PLAN, /embebido=\{embebido\}/, 'PlanBoard lo pasa a BoardShell');
  assert.match(TODO, /embebido=\{embebido\}/, 'TodoBoard lo pasa a BoardShell');
});

test('embebido no toca la URL: ni la lee ni la escribe', () => {
  // Son DOS efectos y hacen falta los dos cortes. Con sólo el de escritura, volver a abrir
  // la ficha con un `?tarea=` viejo reabre el detalle solo; con sólo el de lectura, el
  // tablero sigue ensuciando la URL de `/customer-success`.
  // ⚠️ ANCLADO EN EL VECINO DE CADA EFECTO, NO EN UN CONTEO. `embebido` apaga más cosas
  // que la URL (la bienvenida, los borradores de reunión), así que contar
  // `if (embebido) return;` se rompe con cada apagado nuevo y no dice nada de los dos que
  // importan. Un test que falla por un cambio que no tiene nada que ver es ruido.
  assert.match(SHELL, /if \(embebido\) return;\n\s+if \(urlPrev\.current === urlEstado\) return;/,
    'el efecto que ESCRIBE la URL');
  assert.match(SHELL, /if \(embebido\) return;\n\s+try \{\n\s+const sp = new URLSearchParams/,
    'el efecto que LEE la URL (deep-link)');
  assert.match(SHELL, /embebido\?: boolean;/, 'BoardShell lo declara');
});

test('las preferencias del tablero se scopean por CLIENTE', () => {
  // Si no, el filtro «solo el proyecto P33» que quedó puesto en /plan se aplica adentro de
  // la ficha —donde ese proyecto casi nunca está— y el tablero del cliente aparece vacío.
  // Se lee como «no tiene nada asignado», que es una afirmación falsa sobre su cartera.
  assert.match(PLAN, /scope=\{clienteFijo \? `agencia:cli\$\{clienteFijo\.leadId\}` : 'agencia'\}/);
  assert.match(TODO, /clienteFijo \? `:cli\$\{clienteFijo\.leadId\}` : ''/);
});
