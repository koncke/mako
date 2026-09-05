// =============================================================================
// De dónde puede venir una plantilla, y qué NO puede quedar guardado en ella
// =============================================================================
// `sanearPlantillas` decide qué se persiste de un pedido autenticado del cliente.
// Es la frontera entre «el navegador vio esto» y «esto quedó en nuestra base», así
// que sus dos guards son de seguridad, no de higiene.
//
// ① EL ORIGEN SE COMPARA POR `origin`, NUNCA POR PREFIJO.
//    Una plantilla lleva la url a la que MaKo va a repetir el pedido, con las
//    credenciales del cliente. Un `startsWith` se lee igual de seguro y no lo es.
//    Medido con node, los cinco casos de abajo son literales.
//
// ② EL `at` SE REDACTA TAMBIÉN EN UN CUERPO QUE NO ES JSON.
//    La redacción vieja hacía `JSON.parse(cuerpo)` y, si tiraba, dejaba el cuerpo
//    «como vino» — razonable cuando todo era JSON. El cuerpo de BOQ es
//    `f.req=...&at=...`, o sea que caía en el `catch` y el token anti-CSRF de la
//    sesión de Google se guardaba entero. El camino de error de una capa se
//    volvió el camino normal de la siguiente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esOrigenDeFlow, sinAtDeBoq, sanearPlantillas } from '../lib/flow-plantillas';

test('`esOrigenDeFlow` acepta los dos orígenes reales', () => {
  assert.equal(esOrigenDeFlow('https://aisandbox-pa.googleapis.com/v1/credits'), true);
  assert.equal(esOrigenDeFlow('https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=YhhmEf'), true);
});

test('`esOrigenDeFlow` rechaza los parecidos que un `startsWith` deja pasar', () => {
  // ⚠️ Los cinco están MEDIDOS: con el prefijo `https://flow.google.com`, los
  // cuatro primeros dan `startsWith === true`. El tercero es el peor — su `origin`
  // real es `https://evil.tld`, o sea un pedido nuestro a un tercero con las
  // credenciales del cliente, y la url se lee bien en cualquier listado.
  const parecidos = [
    'https://flow.google.com.evil.tld/x',
    'https://flow.google.com@evil.tld/x',
    'https://flow.google.comevil.tld/',
    'https://flow.google.com:8443/x',
    'http://flow.google.com/x',            // sin TLS
  ];
  for (const u of parecidos) {
    assert.equal(esOrigenDeFlow(u), false, `dejó pasar ${u}`);
  }
});

test('`esOrigenDeFlow` se abstiene ante una url que no parsea', () => {
  for (const u of ['', 'no-es-una-url', '//flow.google.com/x', 'javascript:alert(1)']) {
    assert.equal(esOrigenDeFlow(u), false, `dejó pasar ${JSON.stringify(u)}`);
  }
});

test('`sinAtDeBoq` saca el token anti-CSRF de un cuerpo form-urlencoded', () => {
  const conAt = 'f.req=%5B%5B%5B%22YhhmEf%22%5D%5D%5D&at=AAbbCC_secretoDeVerdad%3A123&';
  const limpio = sinAtDeBoq(conAt);
  assert.ok(!limpio.includes('AAbbCC_secretoDeVerdad'), 'el `at` sigue adentro');
  assert.ok(limpio.includes('at=__MAKO_AT__'), 'no dejó la marca');
  assert.ok(limpio.includes('f.req='), 'se llevó puesto el payload');
});

test('`sinAtDeBoq` no confunde un campo que TERMINA en «at»', () => {
  // `format=x` o `chat=y` no son el token. Un redactor que se lleva de más rompe la
  // plantilla y el síntoma es un 400 de Google, que se lee como culpa nuestra.
  const cuerpo = 'format=json&chat=hola&at=SECRETO&repeat=2';
  const limpio = sinAtDeBoq(cuerpo);
  assert.ok(limpio.includes('format=json'), 'se llevó `format`');
  assert.ok(limpio.includes('chat=hola'), 'se llevó `chat`');
  assert.ok(limpio.includes('repeat=2'), 'se llevó `repeat`');
  assert.ok(!limpio.includes('SECRETO'), 'dejó el `at`');
});

test('el saneo no guarda un `at` aunque el cuerpo no sea JSON', () => {
  // El caso completo, de punta a punta: es lo que habría pasado el día que se
  // abriera el allowlist a BOQ sin esta redacción.
  const guardadas = sanearPlantillas([{
    clase: 'credits',                       // una clase del protocolo viejo, para que pase el allowlist
    url: 'https://aisandbox-pa.googleapis.com/v1/credits',
    metodo: 'POST',
    headers: {},
    cuerpo: 'f.req=%5B%5D&at=TOKEN_ANTI_CSRF_DEL_CLIENTE',
    cuando: 1,
  }]);
  assert.equal(guardadas.length, 1, 'la plantilla no pasó el saneo; el test perdió su objeto');
  assert.ok(
    !String(guardadas[0].cuerpo).includes('TOKEN_ANTI_CSRF_DEL_CLIENTE'),
    'El `at` quedó guardado en la base. Es una credencial de la sesión de Google del\n'
    + 'cliente: la redacción tiene que cubrir los cuerpos que no son JSON.',
  );
});

test('el saneo conserva `sentinela`', () => {
  // Sin esto el respaldo devuelve la plantilla sin lo único que dice para qué sirve,
  // y el popup vuelve a pedir un clip pagado sobre algo que ya sabíamos. Es el mismo
  // defecto del objeto armado campo por campo, una capa más arriba.
  const guardadas = sanearPlantillas([{
    clase: 'credits',
    url: 'https://aisandbox-pa.googleapis.com/v1/credits',
    metodo: 'POST',
    headers: {},
    cuerpo: null,
    sentinela: 'form',
    cuando: 1,
  }]);
  assert.equal(guardadas.length, 1);
  assert.equal(guardadas[0].sentinela, 'form');
});

test('el saneo sigue rechazando un origen ajeno', () => {
  // La razón de existir del guard, fijada por su caso.
  const guardadas = sanearPlantillas([{
    clase: 'credits',
    url: 'https://flow.google.com@evil.tld/v1/credits',
    metodo: 'POST',
    headers: {},
    cuerpo: null,
    cuando: 1,
  }]);
  assert.deepEqual(guardadas, [], 'guardó una plantilla que apunta a un tercero');
});
