// =============================================================================
// La barra de búsqueda: por defecto SOLO el título
// =============================================================================
// El pedido, textual: «es incómodo y contraintuitivo que intente buscar coincidencia en
// un título y me salgan muchas tareas porque está leyendo el detalle y otras cosas».
//
// Estos tests fijan las dos mitades de eso: que por defecto NO mire el detalle, y que
// cuando se lo pide explícitamente SÍ lo mire.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTarea, resumenCampos, coincide, CAMPOS, CAMPOS_TODOS, CAMPOS_POR_DEFECTO } from '../lib/buscar-tareas';

const T = {
  num: 412,
  title: 'Reescribir el copy de la landing',
  detalle: '**Por qué**\nEl semáforo de seguridad pinta verde por falta de datos.',
  notas: 'hablar con Mauricio antes',
  scoreRazon: 'Le gana a «BYOK de verdad» porque trae cash directo',
  deadlineRazon: 'Cae en la franja de prioridad Media',
  checklist: [{ text: 'Medir la retención del VSL' }, { text: 'Aprobar con el cliente' }],
};

test('EL PEDIDO: por defecto NO busca en el detalle', () => {
  assert.equal(matchTarea(T, 'landing'), true);          // está en el título
  assert.equal(matchTarea(T, 'semáforo'), false);        // está SOLO en el detalle
  assert.equal(matchTarea(T, 'Mauricio'), false);        // solo en las notas
  assert.equal(matchTarea(T, 'retención'), false);       // solo en la checklist
  assert.equal(matchTarea(T, 'BYOK'), false);            // solo en la razón del score
});

test('…y con la búsqueda avanzada sí, campo por campo', () => {
  assert.equal(matchTarea(T, 'semáforo', ['titulo', 'detalle']), true);
  assert.equal(matchTarea(T, 'Mauricio', ['titulo', 'notas']), true);
  assert.equal(matchTarea(T, 'BYOK', ['titulo', 'razones']), true);
  // Elegir un campo NO arrastra a los otros: pedir «detalle» no trae las notas.
  assert.equal(matchTarea(T, 'Mauricio', ['titulo', 'detalle']), false);
  // ⛔ Acá se probaba el campo `checklist`, que se fue el 26/09/2026 con la opción de la
  //    búsqueda avanzada: las checklists salieron del producto el 22/09 y el campo quedó
  //    ofreciendo buscar adentro de algo que ya nadie escribe.
});

test('el #número se busca SIEMPRE, aunque el título no coincida', () => {
  assert.equal(matchTarea(T, '#412'), true);
  assert.equal(matchTarea(T, '412'), true);
  assert.equal(matchTarea(T, '#413'), false);
  // Y no depende de los campos: es un atajo a una tarea puntual, no una búsqueda.
  assert.equal(matchTarea(T, '#412', []), true);
});

test('busca por palabras en cualquier orden, sin acentos', () => {
  assert.equal(matchTarea(T, 'landing copy'), true);   // invertidas
  assert.equal(matchTarea(T, 'COPY'), true);           // mayúsculas
  assert.equal(matchTarea(T, 'reescribir landing'), true);
  assert.equal(coincide('Añadí el botón', 'anadi boton'), true);
});

test('sin campos activos no hay resultados, y una búsqueda vacía los trae todos', () => {
  assert.equal(matchTarea(T, 'landing', []), false);
  assert.equal(matchTarea(T, ''), true);
  assert.equal(matchTarea(T, '   '), true);
});

test('el chip dice dónde se está buscando', () => {
  assert.equal(resumenCampos(CAMPOS_POR_DEFECTO), 'Título');
  assert.equal(resumenCampos(CAMPOS_TODOS), 'Todos los campos');
  assert.equal(resumenCampos(['titulo', 'detalle']), 'Título y 1 más');
  assert.equal(resumenCampos([]), 'Ningún campo');
});

test('los campos sirven para los dos tableros (title y titulo)', () => {
  // El del dueño usa `title`; el de los clientes, `titulo`. Un solo buscador para los dos.
  assert.equal(matchTarea({ titulo: 'Conectar Meta Ads' }, 'meta'), true);
  assert.equal(matchTarea({ title: 'Conectar Meta Ads' }, 'meta'), true);
  // Y el DETALLE también, que es lo que quedó después de que las checklists salieran.
  assert.equal(matchTarea({ titulo: 'x', detalle: 'pixel' }, 'pixel', ['detalle']), true);
});

// ---------------------------------------------------------------------------
// El caso «CAC»: un término NUNCA cae en el medio de una palabra
// ---------------------------------------------------------------------------
// Buscar «CAC» en el tablero devolvía casi todo, y no era casualidad: «cac» vive
// adentro de un montón de palabras larguísimas y comunísimas en español. Estos son
// los títulos REALES que volvieron en esa búsqueda.
const RUIDO_CAC = [
  'Implementar autenticación/2FA con Meta',                            // autentiCACión
  'Optimizar notificaciones de MaKo por WhatsApp para Mauricio',       // notifiCACiones
  'Ajustar la lógica de cualificación de leads según facturación',     // cualifiCACión
  'Agregar filtro por fecha de publicación en vista de guiones',       // publiCACión
  'Mejorar el flujo de onboarding dentro de la aplicación',            // apliCACión
  'Automatizar recordatorios de planificación de Quarters futuros',    // planifiCACión
];
const CON_CAC = [
  'Modelar la viabilidad financiera de comisiones recurrentes basadas en CAC',
  'Armar el modelo financiero de CAC, LTV y margen unitario del freemium',
];

test('CAC no matchea adentro de notifiCACión, autentiCACión ni publiCACión', () => {
  for (const t of RUIDO_CAC) assert.equal(matchTarea({ title: t }, 'CAC'), false, t);
  for (const t of CON_CAC) assert.equal(matchTarea({ title: t }, 'CAC'), true, t);
});

test('el espacio cierra la palabra: «CAC » pide la palabra entera', () => {
  for (const t of RUIDO_CAC) assert.equal(matchTarea({ title: t }, 'CAC '), false, t);
  for (const t of CON_CAC) assert.equal(matchTarea({ title: t }, 'CAC '), true, t);
  // Sin cerrar, sigue siendo un prefijo: mientras se escribe hay que ver de más.
  assert.equal(coincide('revisar el cacheo del dashboard', 'cac'), true);
  assert.equal(coincide('revisar el cacheo del dashboard', 'cac '), false);
});

test('cerrar una palabra tolera el plural, que es la misma palabra', () => {
  assert.equal(coincide('Optimizar las notificaciones', 'notificacion '), true);
  assert.equal(coincide('Optimizar la notificación', 'notificaciones '), false); // al revés no
  assert.equal(coincide('Reparto de tareas de la reunión', 'reunion tarea'), true);
});

test('un término que no es el último también está cerrado', () => {
  // «cac ltv» → «cac» quedó cerrado por el espacio que le sigue.
  assert.equal(coincide('Armar el modelo financiero de CAC, LTV', 'cac ltv'), true);
  assert.equal(coincide('Implementar autenticación con LTV', 'cac ltv'), false);
});

test('la coma también cierra la palabra', () => {
  assert.equal(coincide('basadas en CAC', 'cac,'), true);
  assert.equal(coincide('revisar el cacheo', 'cac,'), false);
});

test('el detalle se busca sin sus etiquetas HTML', () => {
  const t = { title: 'x', detalle: '<div><strong>Conectar</strong> el pixel</div>' };
  assert.equal(matchTarea(t, 'div', ['detalle']), false);
  assert.equal(matchTarea(t, 'strong', ['detalle']), false);
  assert.equal(matchTarea(t, 'pixel', ['detalle']), true);
});

test('cada campo declara su etiqueta y su ayuda (los pinta el panel)', () => {
  for (const c of CAMPOS) {
    assert.ok(c.label.length > 0, `${c.id} sin label`);
    assert.ok(c.ayuda.length > 0, `${c.id} sin ayuda`);
    assert.equal(typeof c.texto({}), 'string', `${c.id} no devuelve string con una tarea vacía`);
  }
});
