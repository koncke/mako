// =============================================================================
// El comprobante que una agencia manda por el grupo de la APP se lee, como en WhatsApp (13/11/2026)
// =============================================================================
// Martín (13/11/2026): «vamos a implementar todo directamente dentro de MaKo y vamos a dejar los grupos por ahora». En WhatsApp, la foto o el PDF de una persona en el grupo de una agencia con la
// mensualidad prendida se lee como comprobante ANTES de la cola (lib/mako-doer-in.ts, `comprobanteDeLaMensualidad`): Juan Francisco mandó así el de Nico Sellers el 9 y el 11/11, y le contestaron
// «Recibí tu comprobante». En la app nadie lo leía: la foto suelta ni entraba a la cola (`vaALaCola`) y, aunque entrara, el turno de la app no pasaba por el comprobante.
// El hijo corre el POST real, el cron real y el turno real: tests/_comprobante-en-la-app-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_comprobante-en-la-app-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
const RECIBI = 'Recibí tu comprobante. Lo revisa el equipo de MaKo y te confirmo por aquí.';

test('⛔ la foto suelta del comprobante, en el grupo de la app de la agencia, se lee y se contesta en el hilo', () => {
  const s = R().suelta;
  assert.equal(s.status, 200);
  assert.equal(s.llamadas.length, 1, 'nadie leyó el comprobante: Juan Francisco lo manda y no pasa nada');
  assert.equal(s.llamadas[0].ws, 13);
  assert.match(s.llamadas[0].id, /^app:\d+$/, 'el id del mensaje de la app: es la llave de «una lectura por mensaje»');
  assert.equal(s.llamadas[0].png, true, 'la foto se lee del bucket, no de Evolution');
  assert.deepEqual(s.hilo.map((f: { autor: string }) => f.autor), ['persona', 'equipo']);
  assert.equal(s.hilo[1].texto, RECIBI);
  assert.equal(s.modelo, 0, 'el turno de MaKo no corre: contestaría dos veces');
  assert.deepEqual(s.cola, [], 'un comprobante no entra a la cola: un turno que juntara mensajes del grupo se lo llevaría');
  assert.ok(!s.evolution.some((c: string) => c.includes('getBase64FromMediaMessage')), 'la foto de la app no se pide a Evolution');
});

test('⛔ con «mako» en el texto y era un comprobante, MaKo no contesta dos veces', () => {
  const s = R().nombrada;
  assert.equal(s.llamadas, 1);
  assert.equal(s.modelo, 0);
  assert.deepEqual(s.cola, []);
  assert.deepEqual(s.hilo.map((f: { autor: string }) => f.autor), ['persona', 'equipo']);
});

test('no era un comprobante y le habla a MaKo: entra a la cola y MaKo contesta, como siempre', () => {
  const s = R().noEra;
  assert.equal(s.llamadas, 1);
  assert.ok(s.modelo >= 1, 'la foto que no era un comprobante quedó sin respuesta');
  assert.deepEqual(s.cola.map((c: { estado: string }) => c.estado), ['procesado']);
  assert.deepEqual(s.hilo.filter((f: { autor: string }) => f.autor === 'mako').map((f: { texto: string }) => f.texto), ['Es una captura de la campaña.']);
});

test('no era un comprobante y es una foto suelta entre personas: MaKo no se mete (la regla del 3/11)', () => {
  const s = R().sueltaNoEra;
  assert.equal(s.llamadas, 1);
  assert.equal(s.modelo, 0);
  assert.deepEqual(s.cola, []);
});

test('la foto de un invitado no se lee como comprobante', () => {
  assert.equal(R().invitado.llamadas, 0);
});

test('un negocio sin la mensualidad sigue igual: la foto que nombra a MaKo va a la cola y MaKo contesta', () => {
  const s = R().sinMensualidad;
  assert.equal(s.llamadas, 0);
  assert.ok(s.modelo >= 1);
  assert.deepEqual(s.hilo.filter((f: { autor: string }) => f.autor === 'mako').map((f: { texto: string }) => f.texto), ['Veo la foto.']);
});

test('sin el autollamado, lo que iba para MaKo entra a la cola igual (lo levanta doer-flush); la foto suelta no', () => {
  const s = R().sinAutollamado;
  assert.deepEqual(s.conMaKo.map((c: { estado: string }) => c.estado), ['pendiente'], 'el mensaje se perdía si el autollamado no llegaba');
  assert.deepEqual(s.suelta, []);
});

// PROBADO ROMPIÉNDOLO (13/11/2026), sobre el código real, corriendo este archivo, y restaurado:
//   · la ruta y el cron como están en main 639a9a014 → 4 en rojo: la foto suelta, la nombrada, «no era y le habla a MaKo» y «no era y es
//     suelta» (nadie leía el comprobante: 0 llamadas). Los otros 3 siguen verdes: son la regla de antes.
//   · `puedeSerComprobante` también para un invitado → sigue VERDE: `comprobanteDeLaApp` lo vuelve a frenar con su letra. Son dos guardas a
//     propósito; sacar las dos daría rojo en «la foto de un invitado».
