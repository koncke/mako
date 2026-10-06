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
  for (const r of ['/api/agente/plan', '/api/agente/contexto', '/api/agente/telemetria', '/api/agente/hook', '/api/agente/skill', '/api/agente/lead', '/api/agente/metricas']) {
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

test('la excepción de escritura abre las DOS rutas del portal del alumno, y solo esas', () => {
  // `/api/compartido` es solo-lectura porque el early-return del middleware se
  // saltea el chequeo CSRF de Origin. El portal del curso necesita escribir (el
  // progreso del video y la tarea), y puede: se autentica con el token firmado
  // del link, que viaja en el CUERPO y que el navegador no manda solo — no hay
  // autoridad ambiente que abusar.
  for (const r of ['/api/compartido/curso/progreso', '/api/compartido/curso/tarea']) {
    assert.equal(esPublicaDeEscritura(r), true, r);
    assert.equal(esPublicaSoloLectura(r), false, r);
    assert.equal(esPublica(r), true, `${r}: sin esto el middleware pide sesión y el 405 ni se evalúa`);
  }
  // El video subido se SIRVE (GET): no escribe, así que no entra a la excepción.
  assert.equal(esPublicaDeEscritura('/api/compartido/curso/video'), false);
  assert.equal(esPublicaSoloLectura('/api/compartido/curso/video'), true);
});

test('la ruta de tarea del programa VIEJO ya no escribe: se borró el 26/09', () => {
  // `/api/compartido/tarea` se fue con el programa viejo (07d07139) y su entrada
  // quedó en la lista abriendo a POST una ruta que no existe. Una excepción sin
  // dueño la hereda la próxima ruta que se cree con ese nombre.
  //
  // Probado rompiéndolo (06/10/2026): devolver la entrada vieja a
  // PUBLICOS_ESCRITURA da 10 pass / 1 fail (cae éste), y sacar
  // `/api/compartido/curso/progreso` da 10 / 1 (cae el de arriba). Restaurado: 11 / 0.
  assert.equal(esPublicaDeEscritura('/api/compartido/tarea'), false);
  assert.equal(esPublicaSoloLectura('/api/compartido/tarea'), true, 'un POST ahí tiene que dar 405');
});

test('la excepción NO se hereda: es match exacto, nunca prefijo', () => {
  // Un prefijo abriría a POST cualquier ruta futura colgada abajo. Es la misma
  // razón por la que `/api/agente/token` se dejó afuera una por una.
  assert.equal(esPublicaDeEscritura('/api/compartido/curso/tarea/borrar'), false);
  assert.equal(esPublicaSoloLectura('/api/compartido/curso/tarea/borrar'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/curso/tareas'), false);
  assert.equal(esPublicaDeEscritura('/api/compartido/curso'), false, 'la carpeta no hereda lo de sus hijas');
  assert.equal(esPublicaDeEscritura('/api/compartido/archivo'), false);
  assert.equal(esPublicaSoloLectura('/api/compartido/archivo'), true, 'servir un archivo sigue siendo solo GET');
});

test('todo lo que escribe está en PUBLICOS: si no, el middleware lo corta antes', () => {
  for (const r of PUBLICOS_ESCRITURA) assert.equal(esPublica(r), true, r);
});

test('meter un lead se puede; el resto de /api/agente/lead no se hereda', () => {
  // El agente ESCRIBE en el CRM por acá. Se autentica con el bearer, que el navegador
  // no manda solo — no hay autoridad ambiente que abusar, que es lo único que el
  // chequeo de Origin protegía.
  assert.equal(esPublicaDeEscritura('/api/agente/lead'), true);
  assert.equal(esPublicaDeEscritura('/api/agente/lead/borrar'), false, 'match exacto: nada colgado abajo hereda el POST');
});

test('los datos vivos son de LECTURA: entran sin sesión pero no pueden escribir', () => {
  // Las dos devuelven datos del negocio (inversión, visitas, reuniones, leads) y
  // ninguna tiene POST. Que estén en PUBLICOS y no en PUBLICOS_DE_ESCRITURA es lo
  // que hace que agregarles un POST mañana falle acá en vez de quedar abierto en
  // silencio.
  for (const r of ['/api/agente/metricas', '/api/agente/consultar']) {
    assert.equal(esPublica(r), true, `${r} tiene que entrar sin sesión`);
    assert.equal(esPublicaDeEscritura(r), false, `${r} es de solo lectura`);
  }
});
