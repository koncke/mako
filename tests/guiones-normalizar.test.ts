// =============================================================================
// El guion que carga el cliente se ORDENA, y ordenarlo no puede cambiarlo
// =============================================================================
// Los guiones entraron desde un .md y quedaron guardados tal cual: con
// `**negrita**` en el medio y una línea en blanco entre cada frase. El dueño:
// «no normalizó y formateó el texto, eso es importante».
//
// Estos tests cubren las dos mitades del arreglo y, sobre todo, su límite: la
// limpieza saca FORMATO y el ordenado agrega RÓTULOS, pero ninguno de los dos
// puede tocar una sola palabra de lo que el cliente escribió.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarGuion, huellaGuion } from '../lib/guiones-normalizar';
import { numerarLineas, validarCortes, insertarRotulos } from '../lib/guion-estructurar-core';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';

// ── La limpieza ─────────────────────────────────────────────────────────────

test('saca la negrita y deja las palabras', () => {
  const t = normalizarGuion('Él era el **sistema operativo de la empresa**.');
  assert.equal(t, 'Él era el sistema operativo de la empresa.');
});

test('saca viñetas, numeración, citas y encabezados sueltos', () => {
  const t = normalizarGuion([
    '## Contexto',
    '- primer punto',
    '* segundo punto',
    '1. tercero',
    '> una cita',
  ].join('\n'));
  assert.equal(t, 'Contexto\nprimer punto\nsegundo punto\ntercero\nuna cita');
});

test('una fecha al principio de línea NO es una lista numerada', () => {
  // `2024. El año que…` se parece a «1. item». El corte está en 3 dígitos: las
  // listas de un guion no llegan a mil.
  assert.equal(normalizarGuion('2024. El año que todo cambió.'), '2024. El año que todo cambió.');
});

test('un asterisco de multiplicación sobrevive', () => {
  assert.equal(normalizarGuion('Son 5 * 3 pesos por unidad.'), 'Son 5 * 3 pesos por unidad.');
});

test('deja una línea en blanco entre frases, pero no tres', () => {
  const t = normalizarGuion('Primera.\n\n\n\nSegunda.\n\nTercera.');
  assert.equal(t, 'Primera.\n\nSegunda.\n\nTercera.');
});

test('no toca las comillas tipográficas ni los puntos suspensivos', () => {
  // Son español correcto y los eligió quien escribió el guion. «Normalizar» no
  // es «uniformar a lo que a mí me gusta».
  const original = '“Si yo no pregunto, aquí nadie sabe qué está pasando.”… y tenía razón.';
  assert.equal(normalizarGuion(original), original);
});

test('los rótulos de sección quedan intactos', () => {
  const t = normalizarGuion('GANCHO\nEl problema no era la actitud.\n\nCTA\nEn el enlace te muestro cómo.');
  assert.match(t, /^GANCHO$/m);
  assert.match(t, /^CTA$/m);
});

test('el link de markdown deja el texto, no la URL', () => {
  assert.equal(normalizarGuion('Mira [el caso completo](https://x.com/a).'), 'Mira el caso completo.');
});

test('caso real: el primer guion que cargó el dueño', () => {
  const crudo = [
    'Un empresario me dijo algo que me dio risa:',
    '',
    '“Si yo no pregunto, aquí nadie sabe qué está pasando.”',
    '',
    'Él pensaba que era el director general… pero en realidad era el **sistema operativo de la empresa**.',
  ].join('\n');
  const t = normalizarGuion(crudo);
  assert.ok(!t.includes('**'), 'quedaron asteriscos de markdown en el guion');
  assert.ok(t.includes('sistema operativo de la empresa'), 'se comió las palabras de adentro de la negrita');
});

// ── La huella: es lo que permite decir «este guion ya lo grabaste» ──────────

test('el mismo guion con y sin rótulos tiene la MISMA huella', () => {
  // Es lo único que hace posible reconocer un guion ya producido después de que
  // MaKo lo ordenó. Si la huella cambiara al ordenarlo, el guion volvería a
  // figurar como nuevo justo después de haberlo grabado.
  const sin = 'Un empresario me dijo algo.\n\nY tenía razón.\n\nEn el enlace te muestro cómo.';
  const con = 'GANCHO\nUn empresario me dijo algo.\n\nHISTORIA\nY tenía razón.\n\nCTA\nEn el enlace te muestro cómo.';
  assert.equal(huellaGuion(con), huellaGuion(sin));
});

test('la huella ignora acentos, mayúsculas y puntuación', () => {
  assert.equal(huellaGuion('¿Cómo vamos, entonces?'), huellaGuion('como  vamos entonces'));
});

test('la huella distingue dos guiones distintos', () => {
  assert.notEqual(huellaGuion('El incendio del viernes'), huellaGuion('Todos dijeron que sí'));
});

test('limpiar el markdown NO cambia la huella', () => {
  const crudo = 'Él era el **sistema operativo**.\n\n- Y tenía razón.';
  assert.equal(huellaGuion(normalizarGuion(crudo)), huellaGuion(crudo.replace(/\*\*|- /g, '')));
});

// ── Qué respuesta del modelo se acepta ──────────────────────────────────────

const PAS = ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === 'pas')!;
const HISTORIA = ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === 'gancho-historia-cta')!;

const buena = JSON.stringify({
  estructuraId: 'gancho-historia-cta',
  cortes: [
    { etiqueta: 'GANCHO', linea: 1 },
    { etiqueta: 'HISTORIA', linea: 2 },
    { etiqueta: 'CTA', linea: 5 },
  ],
});

test('acepta una respuesta bien formada', () => {
  const ok = validarCortes(buena, ESTRUCTURAS_GUION_DEFAULT, 6);
  assert.ok(ok);
  assert.equal(ok.estructura.id, 'gancho-historia-cta');
  assert.equal(ok.cortes.length, 3);
});

test('rechaza una estructura que no está en el catálogo', () => {
  const r = validarCortes(
    JSON.stringify({ estructuraId: 'inventada', cortes: [{ etiqueta: 'GANCHO', linea: 1 }] }),
    ESTRUCTURAS_GUION_DEFAULT, 6,
  );
  assert.equal(r, null);
});

test('rechaza si falta una etiqueta', () => {
  // Un guion sin CTA marcado no quedó ordenado a medias: el parser de la UI lo
  // corta en tarjetas que no son.
  const r = validarCortes(
    JSON.stringify({
      estructuraId: 'gancho-historia-cta',
      cortes: [{ etiqueta: 'GANCHO', linea: 1 }, { etiqueta: 'HISTORIA', linea: 2 }],
    }),
    ESTRUCTURAS_GUION_DEFAULT, 6,
  );
  assert.equal(r, null);
});

test('rechaza las etiquetas desordenadas', () => {
  const r = validarCortes(
    JSON.stringify({
      estructuraId: 'gancho-historia-cta',
      cortes: [{ etiqueta: 'GANCHO', linea: 1 }, { etiqueta: 'CTA', linea: 2 }, { etiqueta: 'HISTORIA', linea: 5 }],
    }),
    ESTRUCTURAS_GUION_DEFAULT, 6,
  );
  assert.equal(r, null);
});

test('rechaza líneas que no crecen o que no existen', () => {
  const repetida = JSON.stringify({
    estructuraId: 'gancho-historia-cta',
    cortes: [{ etiqueta: 'GANCHO', linea: 1 }, { etiqueta: 'HISTORIA', linea: 2 }, { etiqueta: 'CTA', linea: 2 }],
  });
  assert.equal(validarCortes(repetida, ESTRUCTURAS_GUION_DEFAULT, 6), null);
  // Fuera de rango: el modelo contó líneas que no le mandamos.
  assert.equal(validarCortes(buena, ESTRUCTURAS_GUION_DEFAULT, 4), null);
});

test('rechaza si el primer bloque no arranca en la línea 1', () => {
  // Si arrancara más abajo, el principio del guion quedaría fuera de todo bloque.
  const r = validarCortes(
    JSON.stringify({
      estructuraId: 'gancho-historia-cta',
      cortes: [{ etiqueta: 'GANCHO', linea: 2 }, { etiqueta: 'HISTORIA', linea: 3 }, { etiqueta: 'CTA', linea: 5 }],
    }),
    ESTRUCTURAS_GUION_DEFAULT, 6,
  );
  assert.equal(r, null);
});

test('rechaza basura que no es JSON', () => {
  assert.equal(validarCortes('perdón, no puedo ayudarte con eso', ESTRUCTURAS_GUION_DEFAULT, 6), null);
  assert.equal(validarCortes('', ESTRUCTURAS_GUION_DEFAULT, 6), null);
});

test('el catálogo que usa el prompt sigue teniendo las etiquetas esperadas', () => {
  // Si alguien renombra una etiqueta, los guiones ya ordenados con la anterior
  // dejan de parsearse. El propio módulo lo avisa: «renombrar etiquetas de una
  // existente, no».
  assert.deepEqual(HISTORIA.etiquetas, ['GANCHO', 'HISTORIA', 'CTA']);
  assert.deepEqual(PAS.etiquetas, ['GANCHO', 'PROBLEMA', 'AGITACION', 'SOLUCION', 'CTA']);
});

// ── Dónde caen los rótulos ──────────────────────────────────────────────────

const GUION = [
  'Un empresario me dijo algo que me dio risa.',
  '',
  'Y tenía razón.',
  '',
  'Entonces hicimos algo incómodo.',
  '',
  'En el enlace te muestro cómo.',
].join('\n');

test('el rótulo cae en la línea de contenido correcta, no en la vacía', () => {
  const cortes = [
    { etiqueta: 'GANCHO', linea: 1 },
    { etiqueta: 'HISTORIA', linea: 2 },
    { etiqueta: 'CTA', linea: 4 },
  ];
  const out = insertarRotulos(GUION, cortes);
  const lineas = out.split('\n').filter((l) => l.trim());
  assert.equal(lineas[0], 'GANCHO');
  assert.equal(lineas[1], 'Un empresario me dijo algo que me dio risa.');
  assert.equal(lineas[2], 'HISTORIA');
  assert.equal(lineas[3], 'Y tenía razón.');
  assert.equal(lineas[5], 'CTA');
  assert.equal(lineas[6], 'En el enlace te muestro cómo.');
});

test('poner los rótulos no cambia una sola palabra', () => {
  // Es la red que hace seguro dejar que un modelo decida los cortes: si el
  // resultado no dice exactamente lo mismo, arriba se descarta todo.
  const out = insertarRotulos(GUION, [
    { etiqueta: 'GANCHO', linea: 1 },
    { etiqueta: 'HISTORIA', linea: 2 },
    { etiqueta: 'CTA', linea: 4 },
  ]);
  assert.equal(huellaGuion(out), huellaGuion(GUION));
});

test('numerarLineas cuenta solo las líneas con contenido', () => {
  const n = numerarLineas(GUION);
  assert.equal(n.length, 4);
  assert.deepEqual(n.map((x) => x.n), [1, 2, 3, 4]);
  // Y guarda el índice REAL, que es donde hay que insertar.
  assert.deepEqual(n.map((x) => x.i), [0, 2, 4, 6]);
});
