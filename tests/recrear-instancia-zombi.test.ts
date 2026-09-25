import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hayQueRecrear } from '../lib/evolution-sonda';

// =============================================================================
// Recuperar una línea desvinculada sin borrar una que anda ni una que está por vincularse
// =============================================================================
// Una sesión que WhatsApp desvinculó (403) queda ZOMBI: existe, dice `connecting` para
// siempre y `/instance/connect` puede devolver `base64: null`. Sin salida desde la app, la
// línea del cliente se queda muerta — medido el 25/09/2026: la de Mauricio llevaba 22 días.
//
// La decisión es peligrosa en las DOS direcciones, y las dos veces el costo es del cliente:
//   · rotar una sesión ABIERTA le borra el WhatsApp a alguien que está trabajando;
//   · rotar una que está ESPERANDO EL ESCANEO le borra el QR que tiene en la mano. Una zombi
//     y un pairing en curso dicen las dos `connecting`: lo único que las separa es el 403.
//     (Ese segundo corte se agregó el mismo día, antes de desplegar: la primera versión
//     habría borrado el QR de Mauricio si abría la tab dos veces.)
//
// Probado rompiéndolo:
//   · sin `if (p.abierta) return false` → cae «una sesión que anda no se toca» (5 pasan / 1 falla).
//   · sin `if (!p.desvinculada) return false` → cae «la que espera el escaneo no se toca» (5 / 1).
//   · devolviendo siempre false → caen los dos de recuperación (4 / 2).
// Como está: 6/6. (El guard del cableado falló primero sobre código CORRECTO, porque el
// comentario de al lado del borrado nombra `revertirEstadoNoOficial`: por eso se comparan los
// cuerpos sin comentarios.)

const ZOMBI = { abierta: false, desvinculada: true };

test('una sesión que anda no se toca, aunque no devuelva QR', () => {
  // Evolution no da QR sobre una sesión ya conectada: eso NO es una zombi.
  assert.equal(hayQueRecrear({ abierta: true, desvinculada: false, qrBase64: null, conectarOk: true }), false);
  assert.equal(hayQueRecrear({ abierta: true, desvinculada: true, qrBase64: null, conectarOk: false }), false);
  assert.equal(hayQueRecrear({ abierta: true, desvinculada: false, qrBase64: 'data:image/png;base64,AAA', conectarOk: true }), false);
});

test('la que está esperando el escaneo NO se toca, aunque todavía no haya QR', () => {
  // Instancia en `connecting` sin 403: pairing en curso. Abrir la tab de nuevo no puede
  // borrarle el QR al dueño justo cuando lo tiene en la pantalla del celular.
  assert.equal(hayQueRecrear({ abierta: false, desvinculada: false, qrBase64: null, conectarOk: true }), false);
  assert.equal(hayQueRecrear({ abierta: false, desvinculada: false, qrBase64: null, conectarOk: false }), false);
});

test('la zombi (desvinculada por 403 y sin QR) se recrea', () => {
  assert.equal(hayQueRecrear({ ...ZOMBI, qrBase64: null, conectarOk: true }), true);
  assert.equal(hayQueRecrear({ ...ZOMBI, qrBase64: undefined, conectarOk: true }), true);
  assert.equal(hayQueRecrear({ ...ZOMBI, qrBase64: '', conectarOk: true }), true);
});

test('si Evolution rechaza el connect de una sesión desvinculada, también se recrea', () => {
  assert.equal(hayQueRecrear({ ...ZOMBI, qrBase64: null, conectarOk: false }), true);
});

test('con QR de verdad NO se recrea: alcanza con escanear', () => {
  // Es el camino normal de re-vincular, y es lo que pasó en producción el 25/09: la instancia
  // de Mauricio tenía el 403 pero el connect SÍ devolvió QR, así que no se tocó nada.
  assert.equal(hayQueRecrear({ ...ZOMBI, qrBase64: 'data:image/png;base64,AAA', conectarOk: true }), false);
});

test('conectar() usa la decisión y no borra sin preguntarle', () => {
  // Guard del cableado: el borrado vive en `conectar`, que no se puede importar (arrastra el
  // runtime de Next). Sin esto, alguien puede colgar el logout+delete de otra condición y los
  // tests de arriba seguirían en verde.
  const src = readFileSync(new URL('../lib/evolution.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const i = src.indexOf('export async function conectar(');
  const cuerpoConComentarios = src.slice(i, src.indexOf('\n}\n', i));
  const cuerpo = cuerpoConComentarios.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(cuerpo, /hayQueRecrear\(\{ abierta, desvinculada, qrBase64: c\.ok \? c\.data\.base64 : null, conectarOk: c\.ok \}\)/);
  // El 403/401 tiene que salir de la instancia, no de una constante optimista.
  assert.match(cuerpo, /disconnectionReasonCode/);
  // Y el delete tiene que estar DENTRO de ese if, no suelto en la función.
  const desde = cuerpo.indexOf('hayQueRecrear(');
  assert.match(cuerpo.slice(desde, desde + 700), /\/instance\/delete\//);
  // Tampoco puede arrastrar el reseteo del onboarding: esto es re-vincular, no desvincular.
  assert.doesNotMatch(cuerpo, /revertirEstadoNoOficial/);
});
