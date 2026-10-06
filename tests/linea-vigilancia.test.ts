// =============================================================================
// Cuando se cae la línea de WhatsApp de un CLIENTE, se le avisa a él — y sólo a él
// =============================================================================
// #784. La línea por QR del ws1 estuvo muerta del 03/09 al 29/09/2026 (26 días, medido en
// `wa_mensajes`) sin un solo aviso: la vigilancia existía sólo para la voz de MaKo. Decisión
// de Martín, 06/10/2026: «c: solo al cliente», una vez al confirmarse la caída y después
// cada 24 h mientras siga caída.
//
// Lo que persigue este archivo: que «no pude preguntar» no sea «está caída», que una sola
// medición no alcance, que una línea que nunca se vinculó no se «caiga», que la cadencia sea
// la decidida, que el texto mande a re-escanear SÓLO cuando WhatsApp cerró la sesión, y que
// el vigilante recorra las FILAS, deje afuera la voz de MaKo y no le escriba a la agencia.
//
// ⚠️ PROBADOS ROMPIÉNDOLOS, 06/10/2026, con un arnés que restaura DE MEMORIA. Las DIEZ
// roturas se cazan, cada una con 1 fallo (de 9 tests):
//   · tratar `sin_respuesta` como una caída
//   · avisar sobre una línea que nunca se vinculó
//   · avisar con UNA sola medición (sin `CONFIRMAR_MIN`)
//   · repetir el aviso antes de las 24 h
//   · mandar a re-escanear también en un corte que puede volver solo
//   · sacar el vigilante del cron de alertas
//   · dejar de excluir la voz de MaKo
//   · mandarlo al grupo de la agencia (`alDueno: true`)
//   · poner la marca de «ya avisé» aunque el aviso no haya llegado
//   · sacarle el `porDefecto: 'on'` al aviso del catálogo
//
// Correr: node --import tsx --test tests/linea-vigilancia.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decidirLinea, textoCaida, lineaLegible, CONFIRMAR_MIN, CADA_MIN_LINEA, DEDUP_LINEA_MIN,
} from '../lib/linea-vigilancia';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const sinComentarios = (src: string): string => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const AHORA = Date.parse('2026-10-06T15:00:00Z');
const haceMin = (m: number): string => new Date(AHORA - m * 60_000).toISOString();
const sinMarcas = { desde: null, avisado: null };

test('⚠️ «no pude preguntar» no es «está caída»: no toca ninguna marca', () => {
  // Con Evolution inalcanzable la sonda da `sin_respuesta`. Un aviso que manda a
  // re-escanear una línea sana la TUMBA.
  for (const marcas of [sinMarcas, { desde: haceMin(60), avisado: null }, { desde: haceMin(3000), avisado: haceMin(2000) }]) {
    assert.deepEqual(decidirLinea({ sondeo: 'sin_respuesta', vinculadaAlgunaVez: true, marcas, ahoraMs: AHORA }), { que: 'nada' });
  }
});

test('una línea que nunca se vinculó no «se cae»', () => {
  // La del ws13: creada el 18/08, `ultima_conexion_at` en null, y la sonda la da muerta.
  assert.deepEqual(decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: false, marcas: sinMarcas, ahoraMs: AHORA }), { que: 'nada' });
});

test('⚠️ hacen falta DOS mediciones: la primera sólo fija el «desde»', () => {
  // Un reinicio de Evolution deja las instancias unos segundos sin socket.
  assert.deepEqual(decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, marcas: sinMarcas, ahoraMs: AHORA }), { que: 'fijar_desde' });
  assert.deepEqual(
    decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, marcas: { desde: 'basura', avisado: null }, ahoraMs: AHORA }),
    { que: 'fijar_desde' }, 'un «desde» ilegible tiene que volver a medirse, no confirmar nada');
  // Dos corridas pegadas (un reintento del cron) no confirman: tiene que pasar CONFIRMAR_MIN.
  assert.deepEqual(
    decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, marcas: { desde: haceMin(CONFIRMAR_MIN - 1), avisado: null }, ahoraMs: AHORA }),
    { que: 'nada' });
  assert.deepEqual(
    decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, marcas: { desde: haceMin(12), avisado: null }, ahoraMs: AHORA }),
    { que: 'avisar' });
});

test('⚠️ la cadencia es la decidida: una vez, y después cada 24 h', () => {
  assert.equal(CADA_MIN_LINEA, 24 * 60);
  const caida = (avisadoHaceMin: number) => decidirLinea({
    sondeo: 'muerto', vinculadaAlgunaVez: true,
    marcas: { desde: haceMin(5000), avisado: haceMin(avisadoHaceMin) }, ahoraMs: AHORA,
  });
  assert.deepEqual(caida(10), { que: 'nada' });
  assert.deepEqual(caida(23 * 60), { que: 'nada' });
  assert.deepEqual(caida(24 * 60 + 1), { que: 'avisar' });
  // Y la red del dedup del catálogo nunca le pisa la cadencia.
  assert.ok(DEDUP_LINEA_MIN < CADA_MIN_LINEA, 'el dedup del catálogo es más largo que la cadencia: la come');
});

test('al volver se limpian las marcas; sin marcas, no se escribe nada', () => {
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, marcas: sinMarcas, ahoraMs: AHORA }), { que: 'nada' });
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, marcas: { desde: haceMin(30), avisado: null }, ahoraMs: AHORA }), { que: 'limpiar' });
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, marcas: { desde: null, avisado: haceMin(30) }, ahoraMs: AHORA }), { que: 'limpiar' });
});

test('⚠️ el texto manda a re-escanear SÓLO cuando WhatsApp cerró la sesión (401/403)', () => {
  const link = 'https://hola-mako.com/whatsapp?ws=11';
  const cerrada = textoCaida({
    motivo: { desvinculado: true, cuando: '2026-10-03T18:00:00Z' }, desde: haceMin(30),
    linea: '+5215512345678', link, tz: 'America/Mexico_City',
  });
  assert.match(cerrada, /Vuelve a escanear el QR/);
  assert.match(cerrada, /el 3 de octubre/, 'la fecha de la caída es la que dio Evolution, no la nuestra');
  assert.match(cerrada, /tu teléfono está bien/, 'el dueño abre WhatsApp, lo ve andando y no entiende el aviso');
  assert.ok(cerrada.includes(link) && cerrada.includes('+5215512345678'));
  // Cualquier otro motivo, o no saberlo: puede volver solo, y re-escanear ahí la tumba.
  for (const motivo of [{ desvinculado: false, cuando: null }, null]) {
    const corte = textoCaida({ motivo, desde: '2026-10-05T18:00:00Z', linea: null, link, tz: 'America/Mexico_City' });
    assert.ok(!/escanear/i.test(corte), `un corte que puede volver solo manda a re-escanear: «${corte}»`);
    assert.match(corte, /Puede volver solo/);
    assert.match(corte, /desde el 5 de octubre/, 'sin fecha de Evolution, el respaldo es el «desde» medido');
  }
});

test('la línea se nombra con lo que le puso el negocio, o con su número', () => {
  assert.equal(lineaLegible({ etiqueta: 'Ventas', numero: '5215512345678' }), '«Ventas»');
  assert.equal(lineaLegible({ etiqueta: '  ', numero: '52 1 55 1234 5678' }), '+5215512345678');
  assert.equal(lineaLegible({ etiqueta: null, numero: null }), null);
});

test('⚠️ el vigilante recorre las FILAS, deja afuera la voz y le avisa SÓLO al cliente', () => {
  const src = sinComentarios(leer('../lib/lineas-vigilante.ts'));
  // Desde 0198/0199 un negocio tiene N líneas con sufijo al azar: el nombre no se deriva.
  assert.match(src, /\.from\('evolution_instancias'\)/, 'el vigilante dejó de recorrer las filas de las líneas');
  assert.ok(!/instanceNameDeWs/.test(src), 'el vigilante deriva el nombre de la línea del workspace');
  // La voz de MaKo la vigila canal-vigilante y la avisa por mail a la agencia.
  assert.match(src, /instanciaVoz\(\{ estricto: true \}\)/, 'la voz se lee tolerante: un 5xx la confunde con la línea de un cliente');
  assert.match(src, /f\.instance_name !== voz/, 'la voz de MaKo entró a la lista de líneas de clientes');
  assert.match(src, /f\.workspace_id !== plataforma/, 'las líneas de la plataforma entraron como si fueran de un cliente');
  // «c: solo al cliente»: por su catálogo, en SU workspace, sin mail a la agencia.
  assert.match(src, /emitirDelCatalogo\('wa-desconectado', \{\s*ws,/, 'el aviso dejó de salir por el catálogo del cliente');
  assert.ok(!/alDueno|sendEmail|avisarPorEmail|EMAILS_ALERTA_VOZ/.test(src),
    'el aviso de la línea de un cliente le llega a la agencia: la decisión fue «solo al cliente»');
  // La marca de «ya avisé» va sólo si le llegó: si no, la próxima corrida vuelve a probar.
  assert.match(src, /if \(llego\) await runWithWorkspace\(ws, \(\) => setSetting\(keyAvisado\(linea\), ahora\)\)/,
    'la marca de «ya avisé» se pone aunque el aviso no haya llegado: calla el reintento 24 h');
});

test('alguien lo MIRA: va en el cron de alertas, después de la voz y antes de lo de Meta', () => {
  const cron = sinComentarios(leer('../app/api/cron/alerta-critica/route.ts'));
  assert.match(cron, /vigilarLineasClientes\(\)\.catch\(/, 'nadie corre la vigilancia de las líneas, o dejó de ser best-effort');
  const iVoz = cron.indexOf('vigilarVozMaKo()');
  const iLineas = cron.indexOf('vigilarLineasClientes()');
  const iMeta = cron.indexOf('const cuentasYaAvisadas');
  assert.ok(iVoz > 0 && iVoz < iLineas && iLineas < iMeta, 'la vigilancia de las líneas quedó fuera de su lugar en el cron');
  // Y el aviso existe para el motor: sin `porDefecto`, nace apagado y no sale en ningún lado.
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'wa-desconectado');
  assert.equal(cat?.porDefecto, 'on', 'el aviso nace apagado: el vigilante mide la caída y se calla');
  assert.equal(cat?.yaImplementado, 'si');
});
