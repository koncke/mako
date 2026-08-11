// =============================================================================
// Qué entra sin sesión — la lista que dejó una integración muerta
// =============================================================================
// Las rutas del agente se autentican por Bearer y NO estaban en la lista de
// públicas, así que el middleware las cortaba con «no autenticado» antes de que
// nadie mirara el token: la integración con Claude nunca funcionó desde afuera.
//
// Por qué no se notó, que es la parte que hay que blindar: en local
// `gateConfigurado()` es false y el middleware hace no-op, así que contra
// `localhost` andaba perfecto y fallaba solo en producción. Ningún test lo podía
// ver porque la lista vivía adentro del middleware.
//
// Este test es de DOS FILOS a propósito: verifica que las tres del bearer estén, y
// que las que se autentican por COOKIE no. Solo la primera mitad dejaría pasar un
// `/api/agente` suelto que abriría también la acuñación del token.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esPublica, esPublicaSoloLectura, esPublicaDeEscritura, PUBLICOS_ESCRITURA } from '../lib/rutas-publicas';

test('las rutas del agente que hablan por Bearer entran sin sesión', () => {
  // Son las que corren en la máquina del cliente, donde no hay cookie posible.
  for (const r of ['/api/agente/plan', '/api/agente/contexto', '/api/agente/telemetria', '/api/agente/hook', '/api/agente/skill']) {
    assert.equal(esPublica(r), true, r);
  }
  // Y con querystring, que es como las llama la skill de verdad.
  assert.equal(esPublica('/api/agente/contexto'), true);
});

test('acuñar el token sigue exigiendo NAVEGADOR', () => {
  // Es lo único de esa carpeta que crea una credencial, así que es lo único que no
  // puede abrirse. Un prefijo `/api/agente` suelto —la solución obvia— lo abriría junto
  // con el resto: por eso van una por una.
  assert.equal(esPublica('/api/agente/token'), false);
});

test('lo que nunca puede ser público, no lo es', () => {
  for (const r of ['/api/leads', '/api/crm', '/second-brain', '/plan', '/api/second-brain/exportar', '/metodo', '/admin']) {
    assert.equal(esPublica(r), false, r);
  }
});

test('el prefijo matchea la ruta exacta y sus hijas, no a las que empiezan igual', () => {
  assert.equal(esPublica('/api/track'), true);
  assert.equal(esPublica('/api/track/evento'), true);
  // ⚠️ Sin el `/` del final, `/api/trackers-secretos` entraría por parecerse.
  assert.equal(esPublica('/api/trackers-secretos'), false);
  assert.equal(esPublica('/vsl-assets'), true);
  assert.equal(esPublica('/loginfalso'), false);
});

test('los públicos de solo lectura son un subconjunto de los públicos', () => {
  // Si uno se cae de `PUBLICOS` pero queda acá, la guarda de método deja de correr
  // y nadie se entera: la ruta pasa a pedir sesión y el 405 nunca se evalúa.
  for (const r of ['/compartido', '/api/compartido']) {
    assert.equal(esPublicaSoloLectura(r), true, r);
    assert.equal(esPublica(r), true, r);
  }
  assert.equal(esPublicaSoloLectura('/api/agente/plan'), false, 'el agente hace POST: no puede ser solo-lectura');
});

test('la excepción de escritura abre UNA ruta, y solo esa', () => {
  // `/api/compartido` es solo-lectura porque el early-return del middleware se
  // saltea el chequeo CSRF de Origin. La tarea del cliente necesita escribir, y
  // puede: se autentica con el token del link, que viaja en el CUERPO y que el
  // navegador no manda solo — no hay autoridad ambiente que abusar.
  assert.equal(esPublicaDeEscritura('/api/compartido/tarea'), true);
  assert.equal(esPublicaSoloLectura('/api/compartido/tarea'), false);
  assert.equal(esPublica('/api/compartido/tarea'), true, 'sin esto el middleware pide sesión y el 405 ni se evalúa');
});

test('la excepción NO se hereda: es match exacto, nunca prefijo', () => {
  // Un prefijo abriría a POST cualquier ruta futura colgada abajo. Es la misma
  // razón por la que `/api/agente/token` se dejó afuera una por una.
  assert.equal(esPublicaDeEscritura('/api/compartido/tarea/borrar'), false);
  assert.equal(esPublicaSoloLectura('/api/compartido/tarea/borrar'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/tareas'), false);
  assert.equal(esPublicaDeEscritura('/api/compartido/archivo'), false);
  assert.equal(esPublicaSoloLectura('/api/compartido/archivo'), true, 'servir un archivo sigue siendo solo GET');
});

test('todo lo que escribe está en PUBLICOS: si no, el middleware lo corta antes', () => {
  for (const r of PUBLICOS_ESCRITURA) assert.equal(esPublica(r), true, r);
});
