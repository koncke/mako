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
import { esPublica, esPublicaSoloLectura, esPublicaDeEscritura, esPublicaSoloLeer, PUBLICOS_ESCRITURA } from '../lib/rutas-publicas';

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

test('los datos del informe del Dashboard compartido: la ruta EXACTA acepta POST, y nada colgado abajo', () => {
  // Es POST aunque sólo lea, para que el token del link viaje en el CUERPO (como la comunidad). La
  // credencial entera es ese token y la ruta no lee la cookie (tests/dashboard-compartir-fuente.test.ts).
  // Probado rompiéndolo (11/10/2026): sacando la entrada de PUBLICOS_ESCRITURA, 11 pass / 1 fail (cae éste).
  assert.equal(esPublicaDeEscritura('/api/compartido/graficos'), true);
  assert.equal(esPublica('/api/compartido/graficos'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/graficos/detalle'), false, 'match exacto: nada colgado abajo hereda el POST');
  assert.equal(esPublicaSoloLectura('/api/compartido/graficos/detalle'), true);
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

// Probado rompiéndolo (11/10/2026), cada rotura sola sobre 12 pases: `'/api/pagar/email'` cambiado por
// `'/api/pagar'` en PUBLICOS → 1 fallo / 11 pases; sacarla de PUBLICOS_ESCRITURA → 1 / 11; sacar
// `'/pagar'` de PUBLICOS → 1 / 11 (y 1 / 3 en tests/acciones-sin-sesion.test.ts). Restaurado: 12 pases.
test('el comprador de un link de pago entra sin sesión, y sólo a lo suyo (11/10/2026)', () => {
  // `/pagar/<token>` y su retorno: los abre alguien que no tiene ni va a tener sesión de MaKo. Va
  // como prefijo porque el token es un segmento; siguen siendo PÁGINAS, así que sólo se leen.
  for (const r of ['/pagar/AbCdEfGhIjKlMnOpQrStUvWxYz012345', '/pagar/AbCdEfGhIjKlMnOpQrStUvWxYz012345/listo']) {
    assert.equal(esPublica(r), true, r);
    assert.equal(esPublicaDeEscritura(r), false, `${r} es una página: no escribe`);
  }
  // El prefijo no se hereda a lo que empieza igual: los pagos del CRM siguen detrás del login.
  for (const r of ['/pagos', '/pagarx', '/api/pagos', '/api/pagar']) assert.equal(esPublica(r), false, r);
  // Lo único que escribe es el cambio de email, EXACTO: nada colgado abajo ni al lado hereda el POST.
  assert.equal(esPublica('/api/pagar/email'), true);
  assert.equal(esPublicaDeEscritura('/api/pagar/email'), true);
  assert.equal(esPublica('/api/pagar/email/otra'), true, 'PUBLICOS es por prefijo: por eso la escritura es exacta');
  assert.equal(esPublicaDeEscritura('/api/pagar/email/otra'), false);
  assert.equal(esPublicaDeEscritura('/api/pagar/emails'), false);
  assert.equal(esPublica('/api/pagar/otra'), false, '/api/pagar no es un prefijo público');
  // La política de reembolsos: la abre el revisor de la pasarela sin cuenta.
  assert.equal(esPublica('/reembolsos'), true);
});

test('las landings publicadas (/l) entran sin sesión, y sólo para LEER', () => {
  // Las abre un visitante sin cuenta de MaKo (app/l/**/route.ts, docs/diseno-editor-landing.md D4).
  // Sin esto, en producción el proxy las manda a /login; en local no se ve (el gate está apagado).
  // Probado rompiéndolo (11/10/2026): sacar `/l` de PUBLICOS, corriendo este archivo con
  // tests/editor-landing-publica.test.ts, da 36 pass / 2 fail (cae éste y su gemelo de allá).
  // Restaurado: 38 / 0.
  // `/l/html/<doc>/<bloque>` (tanda 2, T6): el «HTML personalizado» lo pide un IFRAME de la página
  // publicada, sin sesión. Probado rompiéndolo (11/10/2026): un `!pathname.startsWith('/l/html')` en
  // `esPublica` da 1 fallo en este test (y deja intactos los otros tres casos).
  for (const r of ['/l/mi-landing', '/l/mi-landing/gracias', '/l/vista/tok_ABCdef123456', '/l/html/12/h1abc']) {
    assert.equal(esPublica(r), true, r);
    // No es /api/: una página pública que acepta POST ejecuta server actions sin sesión.
    assert.equal(esPublicaSoloLeer(r), true, r);
    assert.equal(esPublicaDeEscritura(r), false, r);
  }
  // El prefijo es «/l» más la barra: la tab del editor (con sesión) también empieza con «/l».
  for (const r of ['/web-generator', '/web-generator/12', '/landing-generator', '/landing-generator/12', '/landing-writer', '/lx']) assert.equal(esPublica(r), false, r);
});

test('el «Botón de pago» de una landing: el paso es de /l (sólo leer) y el POST es UNA ruta exacta de /api (tanda 4)', () => {
  // El paso de nombre y email lo abre un visitante: entra por `/l`, y como no es /api/ sólo se LEE.
  assert.equal(esPublica('/l/mi-landing/pagar/12'), true);
  assert.equal(esPublicaSoloLeer('/l/mi-landing/pagar/12'), true);
  // El formulario postea acá: público y de ESCRITURA (es /api/, el proxy no lo corta por método).
  assert.equal(esPublica('/api/landing-generator/pagar'), true);
  assert.equal(esPublicaSoloLeer('/api/landing-generator/pagar'), false);
  assert.equal(esPublicaSoloLectura('/api/landing-generator/pagar'), false);
  // El editor (con sesión) no se abre por la misma puerta: ni la ruta de los documentos ni sus vecinas.
  for (const r of ['/api/landing-generator', '/api/landing-generator/ia', '/api/landing-generator/dominio', '/api/landing-generator/pagarx', '/api/landing-generator/cobro']) {
    assert.equal(esPublica(r), false, r);
  }
});
