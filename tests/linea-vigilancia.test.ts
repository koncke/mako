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
// ⚠️ Y LA LÍNEA DESVINCULADA (revisión adversarial del 06/10/2026). `desconectar()` borra la
// instancia en Evolution y deja la fila de la de por default con `ultima_conexion_at` puesto;
// la sonda da 404 «does not exist» = `muerto`, y el negocio que soltó su número a propósito
// recibía «se cortó tu WhatsApp» cada 24 h para siempre. Probado rompiéndolo, 1 fallo y 9
// pases cada una (10 tests): sacar el corte `sinInstancia` de `decidirLinea` · que el
// vigilante le pase `sinInstancia: false`.
//
// ⚠️ Y EL «VOLVIÓ» (09/10/2026, decisión de Martín al cerrar el Chatbot: «las dos cosas»). Sale
// sólo si la caída se había avisado; sin aviso previo, y en una línea desvinculada, se limpia en
// silencio. Y los dos avisos los ve y los puede apagar el cliente. Probado rompiéndolo (14 tests,
// 1 fallo y 13 pases cada una, salvo la desvinculada: 2 y 12): que vuelva a dar `limpiar` con la
// caída avisada · que dé `volvio` sin aviso previo · que una desvinculada «vuelva» · el «volvió»
// con un link · el vigilante sin mandar el «volvió» · que lo mande antes de limpiar las marcas ·
// sacar el aviso nuevo de la lista del cliente.
//
// Correr: node --import tsx --test tests/linea-vigilancia.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decidirLinea, textoCaida, textoVolvio, lineaLegible, CONFIRMAR_MIN, CADA_MIN_LINEA, DEDUP_LINEA_MIN,
} from '../lib/linea-vigilancia';
import { CATALOGO_AVISOS, AVISOS_DEL_CLIENTE } from '../lib/avisos-catalogo';

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
    assert.deepEqual(decidirLinea({ sondeo: 'sin_respuesta', vinculadaAlgunaVez: true, sinInstancia: false, marcas, ahoraMs: AHORA }), { que: 'nada' });
  }
});

test('una línea que nunca se vinculó no «se cae»', () => {
  // La del ws13: creada el 18/08, `ultima_conexion_at` en null, y la sonda la da muerta.
  assert.deepEqual(decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: false, sinInstancia: false, marcas: sinMarcas, ahoraMs: AHORA }), { que: 'nada' });
});

test('⚠️ hacen falta DOS mediciones: la primera sólo fija el «desde»', () => {
  // Un reinicio de Evolution deja las instancias unos segundos sin socket.
  assert.deepEqual(decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: false, marcas: sinMarcas, ahoraMs: AHORA }), { que: 'fijar_desde' });
  assert.deepEqual(
    decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: false, marcas: { desde: 'basura', avisado: null }, ahoraMs: AHORA }),
    { que: 'fijar_desde' }, 'un «desde» ilegible tiene que volver a medirse, no confirmar nada');
  // Dos corridas pegadas (un reintento del cron) no confirman: tiene que pasar CONFIRMAR_MIN.
  assert.deepEqual(
    decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: false, marcas: { desde: haceMin(CONFIRMAR_MIN - 1), avisado: null }, ahoraMs: AHORA }),
    { que: 'nada' });
  assert.deepEqual(
    decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: false, marcas: { desde: haceMin(12), avisado: null }, ahoraMs: AHORA }),
    { que: 'avisar' });
});

test('⚠️ la cadencia es la decidida: una vez, y después cada 24 h', () => {
  assert.equal(CADA_MIN_LINEA, 24 * 60);
  const caida = (avisadoHaceMin: number) => decidirLinea({
    sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: false,
    marcas: { desde: haceMin(5000), avisado: haceMin(avisadoHaceMin) }, ahoraMs: AHORA,
  });
  assert.deepEqual(caida(10), { que: 'nada' });
  assert.deepEqual(caida(23 * 60), { que: 'nada' });
  assert.deepEqual(caida(24 * 60 + 1), { que: 'avisar' });
  // Y la red del dedup del catálogo nunca le pisa la cadencia.
  assert.ok(DEDUP_LINEA_MIN < CADA_MIN_LINEA, 'el dedup del catálogo es más largo que la cadencia: la come');
});

test('⛔ una línea que el negocio DESVINCULÓ no «se cae»: no avisa nunca', () => {
  // `desconectar()` borra la instancia en Evolution y, si era la de por default, deja su fila
  // en «desconectado» con `ultima_conexion_at` puesto. La sonda contesta 404 «does not
  // exist» = `muerto`. Sin el corte, «se cortó tu WhatsApp» cada 24 h a quien soltó su número.
  const desvinculada = (marcas: { desde: string | null; avisado: string | null }) => decidirLinea({
    sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: true, marcas, ahoraMs: AHORA,
  });
  assert.deepEqual(desvinculada(sinMarcas), { que: 'nada' }, 'la primera medición sobre una línea soltada ya fija un «desde»');
  // Con el «desde» viejo de antes de soltarla, tampoco avisa: el caso que más se repite.
  assert.deepEqual(desvinculada({ desde: haceMin(60), avisado: null }), { que: 'limpiar' });
  assert.deepEqual(desvinculada({ desde: haceMin(5000), avisado: haceMin(24 * 60 + 1) }), { que: 'limpiar' },
    'una línea soltada vuelve a recibir el aviso de las 24 h');
});

test('al volver se limpian las marcas; sin marcas, no se escribe nada', () => {
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, sinInstancia: false, marcas: sinMarcas, ahoraMs: AHORA }), { que: 'nada' });
  // Se cortó y volvió entre dos corridas, sin que se llegara a avisar: no hay nada que desmentir.
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, sinInstancia: false, marcas: { desde: haceMin(30), avisado: null }, ahoraMs: AHORA }), { que: 'limpiar' });
});

test('⚠️ si la caída SE AVISÓ, al volver sale el «volvió»; una desvinculada no «vuelve»', () => {
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, sinInstancia: false, marcas: { desde: haceMin(3000), avisado: haceMin(30) }, ahoraMs: AHORA }), { que: 'volvio' });
  assert.deepEqual(decidirLinea({ sondeo: 'vivo', vinculadaAlgunaVez: true, sinInstancia: false, marcas: { desde: null, avisado: haceMin(30) }, ahoraMs: AHORA }), { que: 'volvio' });
  assert.deepEqual(decidirLinea({ sondeo: 'muerto', vinculadaAlgunaVez: true, sinInstancia: true, marcas: { desde: haceMin(3000), avisado: haceMin(30) }, ahoraMs: AHORA }), { que: 'limpiar' });
});

test('el «volvió» nombra la línea y no manda a hacer nada', () => {
  const t = textoVolvio({ linea: '+5215512345678' });
  assert.match(t, /Volvió tu WhatsApp\* \(\+5215512345678\)/);
  assert.ok(!/https?:\/\/|escanear|reconect/i.test(t), `el «volvió» manda a hacer algo: «${t}»`);
  assert.match(textoVolvio({ linea: null }), /^🟢 \*Volvió tu WhatsApp\*\./);
});

test('⚠️ el vigilante limpia las marcas y DESPUÉS manda el «volvió», con su propia clave de dedup', () => {
  const src = sinComentarios(leer('../lib/lineas-vigilante.ts'));
  const i = src.indexOf("if (decision.que === 'limpiar' || decision.que === 'volvio') {");
  assert.ok(i > 0, 'el vigilante no maneja el «volvió»');
  const rama = src.slice(i, src.indexOf("if (decision.que !== 'avisar') return base;", i));
  const iLimpia = rama.indexOf('setSetting(keyAvisado(linea), \'\')');
  const iEmite = rama.indexOf("emitirDelCatalogo('wa-reconectado'");
  assert.ok(iLimpia > 0 && iEmite > iLimpia, 'el «volvió» sale antes de limpiar las marcas (o no sale)');
  assert.match(rama, /texto: textoVolvio\(\{ linea: lineaLegible\(f\) \}\), dedupKey: `volvio:\$\{linea\}`/);
});

test('⚠️ el cliente los VE y los puede apagar: los dos avisos están en su lista, prendidos por defecto', () => {
  for (const id of ['wa-desconectado', 'wa-reconectado']) {
    assert.ok(AVISOS_DEL_CLIENTE.includes(id), `«${id}» no está en la lista del cliente: no lo puede apagar`);
    const cat = CATALOGO_AVISOS.find((c) => c.id === id);
    assert.equal(cat?.porDefecto, 'on', `«${id}» nace apagado`);
    assert.equal(cat?.yaImplementado, 'si');
  }
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
  // Lo que separa «se cayó» de «la soltaron» sale de lo que contestó ESTA sonda.
  assert.match(src, /sinInstancia: esInstanciaInexistente\(\{ status: d\.status, error: d\.detalle \}\)/,
    'el vigilante no le dice a la decisión que la instancia no existe: le avisa al que desvinculó su número');
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
