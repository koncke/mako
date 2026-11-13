// =============================================================================
// Una marca larga del sistema no le llega a la persona (13/11/2026)
// =============================================================================
// El 4/11/2026 Natalia (ws19) le pidió a MaKo en el grupo de la APP la lista de leads de una campaña. MaKo contestó, y la respuesta terminó con la marca entera:
// «[[no-pude: traer el número de contacto de los leads. Los datos mostrados tienen id, nombre y etapa, …]]» (~430 letras). Medido en `grupo_mensajes`, fila de MaKo después de la 14.
// La regex de `sacarNoPude` tenía tope de 300 letras y sin saltos: una marca más larga no matcheaba, no se sacaba y tampoco abría el ticket. La de `sacarNoExiste`, igual.
// Pasa por el mismo camino en WhatsApp: no es cosa de la app.
//
// PROBADO ROMPIÉNDOLO (13/11/2026): con lib/no-pude.ts y lib/no-existe.ts de main 639a9a014 (`{3,300}` sin saltos), los 3 primeros dan rojo; el cuarto es el control.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sacarNoPude } from '../lib/no-pude';
import { sacarNoExiste } from '../lib/no-existe';

// Lo que salió el 4/11, tal cual (sin el nombre de la persona).
const DEL_4_11 = 'Te traigo los 113 leads entrantes en tu cartera. Ahora necesito buscar sus números de contacto: dame un momento.\n\n'
  + '[[no-pude: traer el número de contacto de los leads. Los datos mostrados tienen id, nombre y etapa, pero para sacar el número completo necesito ficha_lead de cada uno, '
  + 'que solo trae UN lead a la vez. Esto sería 113 llamadas y se vería como 50+ líneas de datos en el chat. Mejor opción: exporta la lista desde la tab CRM → aplica el filtro '
  + '«Lead entrante» → descarga como CSV (lleva contacto, nombre, teléfono). O dame el rango de fechas de esa campaña y busco por período.]]';

test('⛔ la marca [[no-pude]] del 4/11 (~430 letras) no le llega al cliente, y abre su ticket', () => {
  const r = sacarNoPude(DEL_4_11);
  assert.ok(!r.texto.includes('[['), `la marca llegó al hilo: ${r.texto}`);
  assert.ok(!r.texto.includes('ficha_lead'), 'el nombre de una herramienta interna le llegó al cliente');
  assert.equal(r.texto, 'Te traigo los 113 leads entrantes en tu cartera. Ahora necesito buscar sus números de contacto: dame un momento.');
  assert.ok(r.noPudo?.startsWith('traer el número de contacto de los leads'), 'sin lo que no pudo, no hay ticket');
  assert.ok((r.noPudo ?? '').length <= 200, 'lo que se guarda sigue cortado');
});

test('⛔ una marca [[no-pude]] en varias líneas tampoco llega', () => {
  const r = sacarNoPude('Hecho a medias.\n[[no-pude: mandar el recurso\na los dos contactos]]');
  assert.equal(r.texto, 'Hecho a medias.');
  assert.equal(r.noPudo, 'mandar el recurso a los dos contactos');
});

test('⛔ la marca [[no-existe]] larga no llega', () => {
  const largo = 'que MaKo arme un tablero con '.repeat(20);
  const r = sacarNoExiste(`Eso todavía no existe.\n[[no-existe: ${largo}]]`);
  assert.equal(r.texto, 'Eso todavía no existe.');
  assert.ok(r.falta?.startsWith('que MaKo arme un tablero'));
});

test('lo de siempre sigue igual: una marca corta se saca, y un texto sin marca no se toca', () => {
  assert.deepEqual(sacarNoPude('No lo encontré.\n[[no-pude: buscar el lead]]'), { texto: 'No lo encontré.', noPudo: 'buscar el lead' });
  assert.deepEqual(sacarNoPude('Listo [x] hecho.'), { texto: 'Listo [x] hecho.', noPudo: null });
  assert.deepEqual(sacarNoExiste('No existe.\n[[no-existe: exportar a Excel]]'), { texto: 'No existe.', falta: 'exportar a Excel' });
});
