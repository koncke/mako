// =============================================================================
// La ingesta del replay: la puerta del lote y el formato del objeto sellado
// =============================================================================
// Esto es lo que separa «no llegó» de «lo tiramos nosotros», y lo que decide si
// una grabación se puede reproducir. Lo que se prueba acá es lo que no avisa
// cuando se rompe: un lote que pasa la puerta y después no se puede abrir, un
// recorte que saca la primera línea (y deja una grabación sin su foto del DOM,
// que es una grabación de nada), y un contador de eventos que decide el piso.
//
// PROBADO ROMPIÉNDOLO (05/10/2026). Base: **16 pases, 0 fallos**. Cada rotura,
// una por una, sobre lib/replay-sellado.ts:
//
//   cuerpoDeLote: saca el chequeo de la firma 0x1f8b .............. 15 · 1
//   cuerpoDeLote: acepta `z:0` sin exigir que arranque con `[` .... 15 · 1
//   deBytea: acepta cualquier cadena sin mirar el prefijo ......... 15 · 1
//   lineaDeLote: devuelve el texto crudo sin parsear .............. 13 · 3
//   lineaDeLote: cuenta 1 evento por lote en vez de `x.length` .... 14 · 2
//   armarSellado: recorta del PRINCIPIO (`slice(-n)`) ............. 15 · 1
//   armarSellado: no recorta nada y devuelve el gzip pasado de tope  15 · 1
//   eventosDeSellado: sin el try/catch por línea .................. 15 · 1
//   textoDeLote: descomprime siempre, ignorando `z` ............... 15 · 1
//
// ⚠️ UNA ROTURA NO FALLÓ, y no es un test flojo: es un guard que NINGÚN test
// puede ver. Sacar el chequeo de tamaño que corre ANTES de decodificar
// (`e.length > REPLAY_LOTE_MAX_BYTES * 2`) deja los 16 en verde, y la cuenta dice
// por qué: el chequeo de después es SIEMPRE más estricto —con `z:0` el primero
// dispara a los 524.288 bytes y el segundo a los 262.144; con `z:1`, a 393.216
// contra 262.144—, así que el verdicto nunca cambia. Ese `if` no decide qué
// lote entra: decide si se asigna un Buffer de medio mega antes de tirarlo. Es un
// guard de COSTO, y queda dicho acá en vez de fingir que tiene red.
//
// ⚠️ Y la rotura de `lineaDeLote` sin parsear falla TRES, uno de ellos el del
// salto de línea literal: un texto con un salto adentro pasa derecho y parte el
// JSONL en dos líneas inválidas. El síntoma en producción no sería un error sino
// una grabación que arranca y se corta a la mitad — ése es el test que de verdad
// justifica el costo de parsear.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  aBytea,
  armarSellado,
  cuerpoDeLote,
  deBytea,
  eventosDeSellado,
  leerSellado,
  lineaDeLote,
  REPLAY_LOTE_MAX_BYTES,
  textoDeLote,
} from '../lib/replay-sellado';
import { REPLAY_BEACON_MAX_BYTES, REPLAY_TOPE_BYTES } from '../lib/replay-contrato';

/** Un lote de rrweb de verdad tiene esta forma: un arreglo de eventos con tipo y hora. */
const eventos = (desde: number, cuantos: number) =>
  Array.from({ length: cuantos }, (_, i) => ({ type: 3, timestamp: desde + i, data: { source: 1, x: i } }));

// ─────────────────────────────────────────────────────────────────────────────
// La puerta: qué lote entra
// ─────────────────────────────────────────────────────────────────────────────
test('un lote gzip legítimo entra, y se guardan los bytes comprimidos tal como llegaron', () => {
  const crudo = JSON.stringify(eventos(0, 30));
  const gz = gzipSync(Buffer.from(crudo, 'utf8'));
  const r = cuerpoDeLote(gz.toString('base64'), 1);
  assert.ok('cuerpo' in r, 'un gzip válido tiene que entrar');
  assert.equal(r.z, 1);
  // Se guarda lo que llegó: el servidor no descomprime en el camino caliente.
  assert.deepEqual(r.cuerpo, gz);
});

test('un lote sin comprimir entra sólo si arranca como un arreglo JSON', () => {
  const ok = cuerpoDeLote(JSON.stringify(eventos(0, 3)), 0);
  assert.ok('cuerpo' in ok);
  assert.equal(ok.z, 0);

  // ⚠️ El chequeo del `[` es lo único que separa un lote de un pedazo de HTML, un
  // mensaje de error de un proxy o un cuerpo truncado. Sin esto se guarda, ocupa
  // bytes de la sesión, y el sellador lo descubre cuando ya es tarde.
  const html = cuerpoDeLote('<html>503 Service Unavailable</html>', 0);
  assert.deepEqual(html, { rechazo: 'no_json' });
  assert.deepEqual(cuerpoDeLote('{"no":"es un arreglo"}', 0), { rechazo: 'no_json' });
});

test('⚠️ un cuerpo que DICE venir comprimido y no trae la firma de gzip se rechaza', () => {
  // Es base64 perfectamente válido y no es un gzip: `Buffer.from(x,'base64')` no
  // se queja de nada. Si entra, el sellador no lo puede abrir y esa parte de la
  // grabación se pierde sin que nadie sepa por qué.
  const r = cuerpoDeLote(Buffer.from('[{"type":3}]', 'utf8').toString('base64'), 1);
  assert.deepEqual(r, { rechazo: 'no_gzip' });
});

test('un `e` que no es base64 se rechaza por base64, no por gzip', () => {
  // El motivo importa: distingue «el navegador comprime mal» de «llegó basura».
  assert.deepEqual(cuerpoDeLote('no es base64 {}', 1), { rechazo: 'base64' });
});

test('un lote vacío se rechaza, y el motivo lo dice', () => {
  assert.deepEqual(cuerpoDeLote('', 0), { rechazo: 'vacio' });
  assert.deepEqual(cuerpoDeLote(undefined, 0), { rechazo: 'vacio' });
  assert.deepEqual(cuerpoDeLote(42, 0), { rechazo: 'vacio' });
});

test('un lote que pasa el tope se rechaza, venga crudo o en base64', () => {
  // El tope son 4 cuotas de sendBeacon. Un lote legítimo pesa ~17 kB.
  assert.equal(REPLAY_LOTE_MAX_BYTES, 4 * REPLAY_BEACON_MAX_BYTES);

  const enorme = '[' + 'a'.repeat(REPLAY_LOTE_MAX_BYTES * 2 + 10);
  assert.deepEqual(cuerpoDeLote(enorme, 0), { rechazo: 'pesado' });
  const justo = '[' + 'a'.repeat(REPLAY_LOTE_MAX_BYTES + 5);
  assert.deepEqual(cuerpoDeLote(justo, 0), { rechazo: 'pesado' });
  // Y comprimido: lo que se mide son los bytes que se van a GUARDAR, no el largo
  // del base64 — si no, el mismo lote entraría o no según cómo viajó.
  const gzGrande = gzipSync(randomBytes(REPLAY_LOTE_MAX_BYTES + 1024));
  assert.deepEqual(cuerpoDeLote(gzGrande.toString('base64'), 1), { rechazo: 'pesado' });
});

// ─────────────────────────────────────────────────────────────────────────────
// `bytea` sobre el cable
// ─────────────────────────────────────────────────────────────────────────────
test('los bytes van y vuelven de la columna bytea sin perder nada', () => {
  const buf = gzipSync(Buffer.from(JSON.stringify(eventos(0, 50)), 'utf8'));
  const ida = aBytea(buf);
  assert.ok(ida.startsWith('\\x'), 'PostgREST quiere el hexadecimal de Postgres');
  assert.deepEqual(deBytea(ida), buf);
  // Con la barra escapada, que es cómo llega en algunos drivers.
  assert.deepEqual(deBytea('\\' + ida), buf);
});

test('lo que no es el hexadecimal de Postgres NO se interpreta como bytes', () => {
  // Si esto devolviera algo, un valor corrupto entraría al objeto sellado como si
  // fuera una grabación.
  assert.equal(deBytea('deadbeef'), null, 'sin prefijo no es una bytea');
  assert.equal(deBytea('\\xzz'), null, 'hexadecimal inválido');
  assert.equal(deBytea('\\x123'), null, 'cantidad impar de dígitos');
  assert.equal(deBytea(null), null);
  assert.equal(deBytea(7), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Una línea del objeto, y la cuenta de eventos que decide el piso
// ─────────────────────────────────────────────────────────────────────────────
test('el texto de un lote se descomprime según su `z`, no según lo que parezca', () => {
  const crudo = JSON.stringify(eventos(0, 4));
  assert.equal(textoDeLote(gzipSync(Buffer.from(crudo, 'utf8')), 1), crudo);
  assert.equal(textoDeLote(Buffer.from(crudo, 'utf8'), 0), crudo);
  // Un cuerpo que no se puede abrir devuelve null y NO tira: el sellador lo
  // cuenta y sigue con los otros lotes.
  assert.equal(textoDeLote(Buffer.from('basura que no es gzip', 'utf8'), 1), null);
  assert.equal(textoDeLote(Buffer.alloc(0), 0), null);
});

test('⚠️ la cuenta de eventos sale de la longitud del arreglo: es la mitad del piso', () => {
  // `motivoDeDescarte(segundos, eventos)` tira todo lo que no llegue a 20
  // eventos. Si esto contara «1 por lote», una sesión de 3 lotes con 200 eventos
  // se descartaría como vacía — y al revés, 25 lotes de un evento pasarían.
  const r = lineaDeLote(JSON.stringify(eventos(0, 37)));
  assert.ok(r);
  assert.equal(r.eventos, 37);
  const vacio = lineaDeLote('[]');
  assert.deepEqual(vacio, { linea: '[]', eventos: 0 });
});

test('una línea que no es un arreglo JSON no entra al objeto', () => {
  assert.equal(lineaDeLote('{"type":3}'), null, 'un objeto no es un lote');
  assert.equal(lineaDeLote('no es json'), null);
  assert.equal(lineaDeLote('"un string"'), null);
});

test('⚠️ un salto de línea literal adentro del lote NO puede partir el JSONL', () => {
  // Esto es lo que justifica parsear en vez de confiar: un salto de línea crudo
  // adentro del texto convierte UNA línea en dos, las dos inválidas, y la
  // grabación se corta a la mitad sin un solo error.
  const r = lineaDeLote('[\n  {"type":3},\n  {"type":2}\n]');
  assert.ok(r);
  assert.equal(r.eventos, 2);
  assert.ok(!r.linea.includes('\n'), 'la línea tiene que ser UNA línea');
});

// ─────────────────────────────────────────────────────────────────────────────
// El objeto sellado
// ─────────────────────────────────────────────────────────────────────────────
test('N lotes se vuelven UN objeto y los eventos vuelven EN ORDEN', () => {
  const lotes = [eventos(0, 5), eventos(100, 5), eventos(200, 5)];
  const lineas = lotes.map((l) => JSON.stringify(l));
  const s = armarSellado(lineas, lotes.map((l) => l.length));

  assert.equal(s.lineas, 3);
  assert.equal(s.recortadas, 0, 'tres lotes chicos no recortan nada');
  assert.equal(s.eventos, 15);
  assert.equal(leerSellado(s.gz).length, 3);

  const vuelta = eventosDeSellado(s.gz) as Array<{ timestamp: number }>;
  assert.equal(vuelta.length, 15);
  // El orden es el de `n`, no el de llegada: es la razón de ser de esa columna.
  assert.deepEqual(vuelta.map((e) => e.timestamp).slice(0, 6), [0, 1, 2, 3, 4, 100]);
});

test('⚠️ el recorte por el tope de bytes saca del FINAL y la primera línea sobrevive', () => {
  // La primera línea de rrweb es el FullSnapshot: la foto del DOM entero. Sin
  // ella los eventos siguientes no se pueden aplicar a nada, así que una
  // grabación sin su primera línea no es corta — es ninguna.
  //
  // Se usa un tope chico para que el recorte ocurra sin tener que fabricar 2 MiB
  // de datos incompresibles.
  // ⚠️ El ruido tiene que ser INCOMPRESIBLE o el test no prueba nada: la primera
  // versión usaba `Math.random().toString(36).repeat(60)`, que gzip aplasta a
  // nada, y los 40 lotes entraban holgados en 4 kB — el test daba verde sobre un
  // recorte que nunca ocurría.
  const lineas = Array.from({ length: 40 }, (_, i) =>
    JSON.stringify([{ type: 3, i, ruido: randomBytes(300).toString('hex') }]),
  );
  const s = armarSellado(lineas, lineas.map(() => 1), 4096);

  assert.ok(s.recortadas > 0, 'con 40 líneas ruidosas y 4 kB de tope tiene que recortar');
  assert.equal(s.lineas + s.recortadas, 40);
  assert.ok(s.bytes <= 4096, `el objeto tiene que entrar en el tope (quedó en ${s.bytes})`);

  const primera = leerSellado(s.gz)[0];
  assert.equal(primera, lineas[0], 'lo que se tira es el final, nunca el principio');
  // Y la cuenta de eventos es la de lo que QUEDÓ, no la de lo que llegó: es lo
  // que se guarda en la fila índice.
  assert.equal(s.eventos, s.lineas);
});

test('una sesión que entra en el tope no se recorta, y el tope por default es el del contrato', () => {
  const lineas = [JSON.stringify(eventos(0, 100))];
  const s = armarSellado(lineas, [100]);
  assert.equal(s.recortadas, 0);
  assert.ok(s.bytes < REPLAY_TOPE_BYTES);
});

test('una línea rota del objeto no se lleva la grabación entera', () => {
  // Por esto el objeto es JSONL y no un único arreglo: con un arreglo gigante, un
  // byte mal en el medio deja la sesión sin reproducir.
  const gz = gzipSync(Buffer.from('[{"type":2}]\n{roto\n[{"type":3}]\n', 'utf8'));
  const vuelta = eventosDeSellado(gz) as Array<{ type: number }>;
  assert.deepEqual(vuelta.map((e) => e.type), [2, 3]);
});
