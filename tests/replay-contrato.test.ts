// =============================================================================
// El contrato del replay: lo que los tres paquetes NO pueden interpretar distinto
// =============================================================================
// Esto graba a visitantes de los clientes de nuestros clientes. Lo que se prueba
// acá es lo que no se arregla después: que el apagador esté apagado, que los
// campos se tapen, que una sesión tenga techo y que lo que venció se borre.
//
// PROBADO ROMPIÉNDOLO (05/10/2026). Base: 17 pases, 0 fallos. Cada rotura, uno por
// uno, sobre lib/replay-contrato.ts:
//
//   maskAllInputs: true → false ................................ 16 pases · 1 fallo
//   maskInputOptions: sólo password y email (el default rrweb) .. 16 · 1
//   maskTextSelector → '.nada' ................................. 16 · 1
//   inlineStylesheet: true → false ............................. 16 · 1
//   activo: o.activo === true → !!o.activo ..................... 16 · 1
//   grabaA con Math.random() en vez de huellaDeVisitante(visitorId) ....... 16 · 1
//   cabeEnLaSesion: el tope de tiempo antes que el de bytes .... 16 · 1
//   grabacionVencio: fecha ilegible devuelve true ....................... 16 · 1
//   grabacionVencio sin Math.max contra REPLAY_RETENCION_LEAD_DIAS ...... 15 · 2
//   rutaDeSesion sin validar el id de sesión ................... 16 · 1
//   REPLAY_PISO_SEGUNDOS: 10 → 0 ............................... 16 · 1
//   grabaA sin el `if (!cfg.activo) return false` .............. 16 · 1
//
// ⚠️ La PRIMERA rotura de `maskAllInputs` no falló, y no era un test flojo: el
// ancla `maskAllInputs: true` aparece ANTES en el comentario que explica por qué
// va en true, así que el reemplazo cayó en la prosa. Un ancla sobre una cadena que
// la convención de la casa escribe también en los comentarios tiene que llevar el
// inicio de línea y la indentación (`/^  maskAllInputs: true,$/m`).
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cabeEnLaSesion,
  grabaA,
  huellaDeVisitante,
  motivoDeDescarte,
  parsearReplay,
  puedeIrPorBeacon,
  REPLAY_BEACON_MAX_BYTES,
  REPLAY_CONFIG_DEFAULT,
  REPLAY_OPCIONES_RRWEB,
  REPLAY_PISO_SEGUNDOS,
  REPLAY_QUE_SE_GRABA,
  REPLAY_RETENCION_DIAS,
  REPLAY_RETENCION_LEAD_DIAS,
  REPLAY_TOPE_BYTES,
  REPLAY_TOPE_SEGUNDOS,
  rutaDeLibreria,
  rutaDeSesion,
  sesionIdValido,
  grabacionVencio,
} from '../lib/replay-contrato';

// ─────────────────────────────────────────────────────────────────────────────
// Privacidad
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ los campos se tapan desde la primera línea', () => {
  // rrweb viene con maskAllInputs en FALSE: de fábrica manda el teléfono y el
  // mail que la persona teclea, carácter por carácter. Clarity los tapa en sus
  // tres modos, así que el default de la librería es peor que la herramienta que
  // esto viene a reemplazar. Si alguien lo pone en false, este test cae.
  assert.equal(REPLAY_OPCIONES_RRWEB.maskAllInputs, true);
  for (const k of ['password', 'email', 'tel', 'text', 'textarea'] as const) {
    assert.equal(REPLAY_OPCIONES_RRWEB.maskInputOptions[k], true, `falta tapar ${k}`);
  }
});

test('se tapa también el texto YA DIBUJADO, que es otro problema', () => {
  // Una pantalla de gracias que dice «te escribimos al 55…» no es un input, así
  // que maskAllInputs no la ve. Creer que tapar los campos alcanza es la fuga.
  assert.ok(REPLAY_OPCIONES_RRWEB.maskTextSelector.includes('mko-tapar'));
  assert.ok(REPLAY_OPCIONES_RRWEB.maskTextSelector.includes('type="tel"'));
  // Y los precios NO se tapan: sin ellos la grabación no explica por qué se fue.
  assert.match(REPLAY_QUE_SE_GRABA.precios, /precios se graban/i);
  assert.ok(REPLAY_QUE_SE_GRABA.si.length > 0 && REPLAY_QUE_SE_GRABA.no.length > 0);
});

test('no se graban el canvas ni las fuentes, y sí la hoja de estilos', () => {
  // La hoja va adentro: sin ella el reproductor dibuja la página sin estilo el
  // día que el cliente la rediseña. Las fuentes no: son cientos de kB por sesión.
  assert.equal(REPLAY_OPCIONES_RRWEB.inlineStylesheet, true);
  assert.equal(REPLAY_OPCIONES_RRWEB.collectFonts, false);
  assert.equal(REPLAY_OPCIONES_RRWEB.recordCanvas, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Siempre prendida (06/10/2026: ya no hay apagador)
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ la grabación está SIEMPRE prendida: un «activo:false» guardado de antes no la apaga', () => {
  // Decisión de Martín, textual: «elimina lo de "Grabar las visitas" eso por default
  // debe estar siempre activado». Hasta ese día era un interruptor apagado por default,
  // y los negocios sin fila (cinco de nueve) no grababan aunque tuvieran el Pixel nuevo.
  //
  // PROBADO ROMPIENDOLO: devolviendo `if (!cfg.activo) return false` a `grabaA` (con
  // el campo de vuelta en el tipo y en `parsearReplay`) → 2 fallan: éste y el del reparto
  // del muestreo, que con el apagador de vuelta deja de grabar al 100 %.
  assert.ok(!('activo' in REPLAY_CONFIG_DEFAULT), 'volvió el apagador al default');
  for (const v of [null, '', 'no es json', '[]', '{"activo":false}', '{"activo":"no"}', '{"muestreo":100}']) {
    const cfg = parsearReplay(v);
    assert.ok(!('activo' in cfg), `«${v}» devolvió un apagador`);
    assert.equal(grabaA(cfg, 'a1b2c3d4-0000-0000-0000-000000000001'), true, `«${v}» dejó de grabar`);
  }
});

test('y el interruptor ya no tiene pantalla ni action', () => {
  // Sacarlo del contrato y dejar el control sería un interruptor que no hace nada.
  //
  // PROBADO ROMPIENDOLO: volviendo a poner el rótulo en el modal → 1 falla (éste).
  const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const board = sinComentarios(readFileSync(new URL('../app/integraciones/IntegracionesBoard.tsx', import.meta.url), 'utf8'));
  assert.doesNotMatch(board, /Grabar las visitas/, 'volvió el interruptor al modal del Pixel');
  const acciones = sinComentarios(readFileSync(new URL('../app/integraciones/landing-config-actions.ts', import.meta.url), 'utf8'));
  assert.doesNotMatch(acciones, /guardarGrabacionAction/, 'volvió la action que lo guardaba');
});

test('el muestreo y la retención se acotan, no se creen', () => {
  assert.equal(parsearReplay('{"muestreo":999}').muestreo, 100);
  assert.equal(parsearReplay('{"muestreo":-5}').muestreo, 0);
  assert.equal(parsearReplay('{"muestreo":"30"}').muestreo, 30);
  assert.equal(parsearReplay('{"muestreo":"ay"}').muestreo, 100);
  assert.equal(parsearReplay('{"retencionDias":0}').retencionDias, 1);
  assert.equal(parsearReplay('{"retencionDias":99999}').retencionDias, 365);
  assert.equal(parsearReplay('{}').retencionDias, REPLAY_RETENCION_DIAS);
});

// ─────────────────────────────────────────────────────────────────────────────
// El muestreo
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ el muestreo es DETERMINISTA por visitante, no azar por página', () => {
  // Con Math.random() la misma persona entra al 30 % en la landing y queda afuera
  // en la página de gracias: media sesión guardada, que muestra a alguien que se
  // va y esconde que volvió.
  const cfg = { muestreo: 30, retencionDias: 30 };
  const uno = grabaA(cfg, 'a1b2c3d4-0000-0000-0000-000000000001');
  for (let i = 0; i < 50; i++) {
    assert.equal(grabaA(cfg, 'a1b2c3d4-0000-0000-0000-000000000001'), uno);
  }
  assert.equal(huellaDeVisitante('mismo'), huellaDeVisitante('mismo'));
  assert.notEqual(huellaDeVisitante('mismo'), huellaDeVisitante('distinto'));
});

test('el muestreo reparte parecido a lo que dice, y 0 y 100 son absolutos', () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `v-${i}-${i * 7919}`);
  const cuenta = (m: number) =>
    ids.filter((v) => grabaA({ muestreo: m, retencionDias: 30 }, v)).length;
  assert.equal(cuenta(100), 2000);
  assert.equal(cuenta(0), 0);
  const mitad = cuenta(50) / 2000;
  assert.ok(mitad > 0.44 && mitad < 0.56, `al 50 % dio ${(mitad * 100).toFixed(1)} %`);
  // Sin visitor_id no se graba: no habría a qué atar la grabación.
  assert.equal(grabaA({ muestreo: 100, retencionDias: 30 }, ''), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Los topes
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ la sesión tiene techo, y el de bytes gana porque salta de golpe', () => {
  // El tope de tiempo NO acota los bytes: un carrusel que se mueve solo tira
  // megas por minuto y los 10 minutos lo dejan pasar entero.
  assert.deepEqual(cabeEnLaSesion({ segundos: 10, bytes: 1000 }, { segundos: 10, bytes: 1000 }),
    { cabe: true, corte: null });
  assert.deepEqual(cabeEnLaSesion({ segundos: REPLAY_TOPE_SEGUNDOS, bytes: 0 }, { segundos: 1, bytes: 0 }),
    { cabe: false, corte: 'tiempo' });
  assert.deepEqual(cabeEnLaSesion({ segundos: 0, bytes: REPLAY_TOPE_BYTES }, { segundos: 0, bytes: 1 }),
    { cabe: false, corte: 'bytes' });
  // Justo en el borde todavía cabe: el tope es «hasta», no «antes de».
  assert.equal(cabeEnLaSesion({ segundos: 0, bytes: 0 }, { segundos: REPLAY_TOPE_SEGUNDOS, bytes: REPLAY_TOPE_BYTES }).cabe, true);
  // Y los dos a la vez cortan por bytes, que es el que se evalúa primero.
  assert.equal(cabeEnLaSesion({ segundos: REPLAY_TOPE_SEGUNDOS, bytes: REPLAY_TOPE_BYTES }, { segundos: 1, bytes: 1 }).corte, 'bytes');
});

test('⚠️ el 32 % de las sesiones medidas son rebotes y no se guardan', () => {
  // Septiembre de 2026: el 32,4 % de las sesiones del ws 1 duran menos de 10 s
  // (28,5 % en el 13, 46,6 % en el 11). Una grabación de 2 segundos no se puede
  // mirar y ocupa una fila, un objeto y una llamada igual que una de 10 minutos.
  assert.equal(motivoDeDescarte(2, 500), 'corta');
  assert.equal(motivoDeDescarte(600, 3), 'vacia');
  assert.equal(motivoDeDescarte(REPLAY_PISO_SEGUNDOS, 20), null);
  assert.equal(motivoDeDescarte(120, 400), null);
  // Un número que no es número no se guarda: NaN pasaría cualquier `<`.
  assert.equal(motivoDeDescarte(Number.NaN, 400), 'corta');
  assert.equal(motivoDeDescarte(120, Number.NaN), 'vacia');
});

test('⚠️ sendBeacon tiene 64 KiB y devuelve false; fetch(keepalive) no avisa', () => {
  assert.equal(puedeIrPorBeacon(1), true);
  assert.equal(puedeIrPorBeacon(REPLAY_BEACON_MAX_BYTES), true);
  assert.equal(puedeIrPorBeacon(REPLAY_BEACON_MAX_BYTES + 1), false);
  assert.equal(puedeIrPorBeacon(0), false);
  assert.equal(puedeIrPorBeacon(-1), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// La retención
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ el lead conserva 180 días: es el agujero de Clarity que ya nos mordió', () => {
  // Sus 30 días son los que hicieron falta para que exista el aviso
  // `clarity-grabacion-por-vencer`. El lead que entró hace tres semanas y recién
  // se está por cerrar es justo el que uno quiere mirar.
  const hace40 = '2026-08-26T00:00:00.000Z';
  const ahora = '2026-10-05T00:00:00.000Z';
  assert.equal(grabacionVencio(hace40, ahora, false), true, 'a los 40 días, sin lead, se borra');
  assert.equal(grabacionVencio(hace40, ahora, true), false, 'a los 40 días, con lead, se conserva');
  const hace200 = '2026-03-19T00:00:00.000Z';
  assert.equal(grabacionVencio(hace200, ahora, true), true, 'a los 200 días se borra igual');
  assert.ok(REPLAY_RETENCION_LEAD_DIAS > REPLAY_RETENCION_DIAS);
});

test('la retención del workspace no puede acortar la del lead', () => {
  // Alguien que se pone 7 días no está diciendo «tirá la grabación del lead que
  // estoy por cerrar»: está bajando el ruido. El piso del lead manda.
  const hace40 = '2026-08-26T00:00:00.000Z';
  const ahora = '2026-10-05T00:00:00.000Z';
  assert.equal(grabacionVencio(hace40, ahora, false, 7), true);
  assert.equal(grabacionVencio(hace40, ahora, true, 7), false);
  // Y una retención más larga que la del lead sí manda.
  assert.equal(grabacionVencio('2026-01-05T00:00:00.000Z', ahora, false, 365), false);
});

test('⚠️ una fecha ilegible NO se borra', () => {
  // Borrar es irreversible. Ante un dato que no se entiende, la respuesta segura
  // es no tocar nada y que alguien lo mire, no limpiar por las dudas.
  const ahora = '2026-10-05T00:00:00.000Z';
  for (const mala of ['', 'ayer', 'null', '0000-99-99']) {
    assert.equal(grabacionVencio(mala, ahora, false), false, `«${mala}» no puede autorizar un borrado`);
  }
  assert.equal(grabacionVencio('2026-01-01T00:00:00.000Z', 'cuando sea', false), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// La ruta y el id
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ un id con ../ adentro no puede escribir en la carpeta de otro cliente', () => {
  // Acá no hay RLS que ataje: el que escribe en el bucket es el service role.
  assert.equal(rutaDeSesion(7, 'rs_' + 'a'.repeat(22), '2026-10-05T12:00:00.000Z'),
    `7/2026-10-05/rs_${'a'.repeat(22)}.jsonl.gz`);
  for (const malo of ['../../1/x', 'rs_../otro', 'rs_corto', '', 'rs_' + 'a'.repeat(40), 'rs_a/b/c/d/e/f/g/h/i/j']) {
    assert.equal(rutaDeSesion(7, malo, '2026-10-05T12:00:00.000Z'), null, `«${malo}» no puede armar ruta`);
    assert.equal(sesionIdValido(malo), false, `«${malo}» no es un id`);
  }
  // Y un workspace que no es un workspace tampoco.
  assert.equal(rutaDeSesion(0, 'rs_' + 'a'.repeat(22), '2026-10-05T12:00:00.000Z'), null);
  assert.equal(rutaDeSesion(-1, 'rs_' + 'a'.repeat(22), '2026-10-05T12:00:00.000Z'), null);
  assert.equal(rutaDeSesion(1.5, 'rs_' + 'a'.repeat(22), '2026-10-05T12:00:00.000Z'), null);
  assert.equal(rutaDeSesion(7, 'rs_' + 'a'.repeat(22), 'cuando sea'), null);
});

test('la fecha está en la ruta para poder purgar por prefijo', () => {
  // Un objeto cuya fila de índice se perdió no aparece en ninguna consulta y queda
  // pagándose para siempre. Con el día en la ruta se puede enumerar sin el índice.
  const r = rutaDeSesion(13, 'rs_' + 'b'.repeat(22), '2026-09-30T23:59:59.000Z');
  assert.ok(r?.startsWith('13/2026-09-30/'), `dio ${r}`);
});

test('la librería se sirve con la versión EN la ruta', () => {
  // El código va pegado en la página de un tercero y nadie lo vuelve a pegar:
  // medido, el workspace con 7.052 visitas corre la versión 14 del snippet y la
  // actual es la 20. Subir el grabador no puede depender de que alguien repegue.
  assert.equal(rutaDeLibreria(1), '/replay/1/r.js');
  assert.equal(rutaDeLibreria(9), '/replay/9/r.js');
  assert.match(rutaDeLibreria(), /^\/replay\/\d+\/r\.js$/);
  assert.equal(rutaDeLibreria(0), '/replay/1/r.js');
});
