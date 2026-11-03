// =============================================================================
// Las muletillas y el relleno de MaKo en el grupo (29/10/2026, Martín: «Es una verdadera desgracia cómo está respondiendo MaKo»)
// =============================================================================
// Las respuestas son las REALES de los grupos del 21 al 29/10 (mako_doer_conv, ws9/ws10/ws11, y los grupos de la verificación de
// c358fd0c4). Lo que fija este archivo (`sinMuletillas`, lib/doer-salida.ts):
//   1. la muletilla de la punta de una oración se va y lo que queda arranca con mayúscula; dos seguidas, también;
//   2. la oración que es SÓLO relleno («tienes toda la razón», «te agradezco», «ya tomé nota», «MaKo ya tiene tu contexto») se va
//      entera, aunque arranque con «te entiendo perfecto y …»;
//   3. lo que dice algo queda tal cual (un «Mira el lead…» es una indicación, no una muletilla), y la marca de un ticket no se toca;
//   4. si no queda nada (era todo relleno), `texto` es null: va la reacción.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinMuletillas } from '../lib/doer-salida';

const QUEDA_EMPEZANDO = /^(?:te voy a ser|te soy|seamos|mira\b|ojo\b|te entiendo|entendido|perfecto\b|excelente\b)/im;

test('1. la muletilla de la punta se va y lo que queda arranca con mayúscula', () => {
  // 1711 (ws9, a Martín por la consulta reenviada de un cliente).
  const r1711 = sinMuletillas('Te voy a ser directo, Martín: olvídate del método viejo de crear una app en Meta, sacar tokens largos y pegarlos a mano. Eso ya se retiró y por eso no te toma el botón.\n\nEntra aquí para hacerlo bien → https://hola-mako.com/integraciones?abrir=zernio');
  assert.equal(r1711.texto, 'Olvídate del método viejo de crear una app en Meta, sacar tokens largos y pegarlos a mano. Eso ya se retiró y por eso no te toma el botón.\n\nEntra aquí para hacerlo bien → https://hola-mako.com/integraciones?abrir=zernio');
  assert.deepEqual(r1711.muletillas, ['Te voy a ser directo, Martín:']);
  // 1643 (ws10): «Mira…» es su propia oración.
  assert.match(sinMuletillas('Mira… replicar la automatización de ManyChat por WhatsApp o DM no es arrancar por los flujos locos.').texto ?? '', /^Replicar la automatización de ManyChat/);
  // 1586 (ws11): dos seguidas.
  assert.match(sinMuletillas('Mira, te voy a ser directo: si Ana no tiene los datos de FATOM, puede ser que la grabación no esté cargada.').texto ?? '', /^Si Ana no tiene los datos de FATOM/);
  // 1663 (ws11).
  assert.match(sinMuletillas('Mira, si Nadia tiene un costo de 12,000 MXN por 6 meses, eso suma 72,000 MXN.').texto ?? '', /^Si Nadia tiene un costo/);
});

test('2. la oración de puro relleno se va entera', () => {
  // 1713 (ws9): el ticket queda, el relleno y la promesa sin respaldo no.
  const r1713 = sinMuletillas('Seamos honestos: tienes razón en que la transición entre el sistema viejo y el nuevo de Zernio deja estos baches de coexistencia, y te agradezco que lo estés tomando para simplificarlo y dejarlo unificado en una sola pestaña.\n\nYa tomé nota para barrer con cualquier rastro viejo de los tokens manuales y asegurar que todo quede limpio y directo por Zernio.\n\nQuedó el ticket #28 para el equipo de MaKo.');
  assert.equal(r1713.texto, 'Quedó el ticket #28 para el equipo de MaKo.');
  // 1682 (ws10): «Te soy sincero: tienes toda la razón.» se va; lo que sigue queda.
  const r1682 = sinMuletillas('Te soy sincero: tienes toda la razón. El disparador de comentarios en Instagram hoy está pensado de forma muy general.');
  assert.equal(r1682.texto, 'El disparador de comentarios en Instagram hoy está pensado de forma muy general.');
  // 1700 (ws10): arranca con «Te entiendo perfecto y …».
  assert.equal(sinMuletillas('Te entiendo perfecto y tienes toda la razón en cada punto. Cuando estás automatizando por API, la documentación te frena.').texto,
    'Cuando estás automatizando por API, la documentación te frena.');
  // 1719 (ws10): «Mira… te voy a ser directo: tienes toda la razón, te mandé…».
  assert.doesNotMatch(sinMuletillas('Mira… te voy a ser directo: tienes toda la razón, te mandé a revisar un plan sin que me lo pidieras.\n\nVamos a lo concreto: el bucle de «Ya te sigo» lo ve el equipo.').texto ?? '', /razón|directo|Mira/);
});

test('3. lo que dice algo queda tal cual; la marca del ticket no se toca', () => {
  for (const t of [
    'Mira el lead de Teodoro: tiene el resumen de la R1.',
    'Tienes 4 reuniones hoy: Matías Molina a las 13:00 y Pablo Rodriguez a las 14:00.',
    'Entendido el pedido: te agendo el viernes a las 11. ¿Confirmas con un «sí»?',
    'Abrí el ticket #31: el disparador de comentarios no filtra por palabra clave.',
  ]) assert.deepEqual(sinMuletillas(t), { texto: t, muletillas: [] }, t);
  const marca = 'Perfecto. [[no-pude: tienes toda la razón en que no anda (falta el filtro)]]';
  assert.match(sinMuletillas(marca).texto ?? '', /\[\[no-pude: tienes toda la razón/, 'la marca del ticket perdió su texto');
});

test('4. si era todo relleno, no queda texto: va la reacción', () => {
  // 1721 (ws9), a la explicación de Zernio de Martín.
  const r1721 = sinMuletillas('Entendido perfectamente, Martín. Es una clave gigante para evitar sorpresas con los cobros de Zernio cuando superan las dos cuentas y para manejarlo multi-API por cliente de forma prolija.\n\nMaKo ya tiene tu contexto sobre cómo se maneja esto en Zernio.');
  assert.equal(r1721.texto, null);
  assert.equal(r1721.muletillas.length, 3);
  // Los acuses de Brigitte y de Joan (ws15, ws19), contestados con sermones.
  for (const t of ['Bien ahí por la velocidad.', 'Seguimos firmes.', 'Excelente, quedo atento.', 'Tiene todo el sentido separar las aguas.', 'Buen ritmo, Brigitte.'])
    assert.equal(sinMuletillas(t).texto, null, t);
  for (const t of ['Excelente, quedo atento. En cuanto los pasen mañana los revisamos.']) assert.doesNotMatch(sinMuletillas(t).texto ?? '', QUEDA_EMPEZANDO);
});
