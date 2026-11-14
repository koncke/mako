// =============================================================================
// Crear una automatización con MaKo termina aunque se cierre la pestaña (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 00:34): «¿existe y termina sola?». Si se cerraba o se recargaba la pestaña
// mientras el modelo escribía, `req.signal` cortaba y no quedaba nada. Ahora, con la fila (nace en el modal), es un trabajo
// del servidor (`after`): la pestaña que se va no lo corta, sólo «Cancelar» (una marca). Al terminar el chat de la fila lo
// dice y, si nadie miraba, le llega un push a quien lo pidió. Sigue naciendo pausada (lib/flujo-ia-crear-core.ts).
//
// Correr: node --import tsx --test tests/flujo-ia-trabajo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canceladaDesde, pushDeTrabajo, trabajoEnElServidor, TOPE_TRABAJO_MS } from '../lib/flujo-ia-trabajo-reglas';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_flujo-ia-trabajo-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
const sinComentarios = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('⛔ cerrar la pestaña mientras MaKo escribe NO corta el trabajo: queda creada, en el chat, y avisa por push', () => {
  assert.equal(R().cerroCortada, false, 'la pestaña que se cerró cortó el trabajo');
  assert.deepEqual(R().cerroChat, ['yo: Dale la bienvenida a cada lead nuevo', 'mako: Creé «Bienvenida». Quedó pausada.']);
  assert.deepEqual(R().cerroPush.map((p: { a: string; titulo: string }) => [p.a, p.titulo]), [['https://push.test/ana', '«Bienvenida» está lista']]);
});

test('«Cancelar» sí lo corta, antes de escribir: no queda nada y no suena nada', () => {
  assert.deepEqual(R().cancelar, { ok: true });
  assert.equal(R().cancelCortada, true);
  assert.deepEqual(R().cancelChat, ['yo: Recordar la reunión'], 'sin la respuesta de MaKo');
  assert.equal(R().cancelPush, 0);
});

test('quien se queda mirando lo ve en el chat, sin push', () => {
  assert.equal(R().miraCortada, false);
  assert.equal(R().miraPush, 0);
});

test('al volver: MaKo la sigue armando sólo con el pedido sin respuesta y dentro del tope; la marca vieja no cancela', () => {
  const ahora = Date.parse('2026-11-14T12:00:00Z');
  const hace = (ms: number) => new Date(ahora - ms).toISOString();
  assert.equal(trabajoEnElServidor([{ de: 'yo', at: hace(40_000) }], ahora), true);
  assert.equal(trabajoEnElServidor([{ de: 'yo', at: hace(40_000) }, { de: 'mako', at: hace(1_000) }], ahora), false, 'ya contestó');
  assert.equal(trabajoEnElServidor([{ de: 'yo', at: hace(TOPE_TRABAJO_MS + 1) }], ahora), false, 'pasado el tope de la función, se cortó');
  assert.equal(trabajoEnElServidor([], ahora), false);
  assert.equal(canceladaDesde(String(ahora - 1), ahora), false, 'una marca de otro pedido');
  assert.equal(canceladaDesde(String(ahora + 5), ahora), true);
  assert.equal(canceladaDesde(null, ahora), false);
  assert.deepEqual(pushDeTrabajo({ t: 'error', nombre: '', error: 'Sin proveedor' }), { titulo: 'MaKo no pudo armar Tu automatización', cuerpo: 'Sin proveedor' });
});

test('la pantalla: «Cancelar» deja la marca, al volver lo dice y no larga otro pedido encima', () => {
  const chat = sinComentarios('app/automations/ChatMako.tsx');
  assert.match(chat, /const cancelarTurno = useCallback\(\(\) => \{\n\s*if \(crea\) cancelarEnElServidor\(p\.secuenciaId\);\n\s*cancelar\(\);/);
  assert.match(chat, /onCancelar=\{cancelarTurno\}/);
  assert.match(chat, /e\.stopImmediatePropagation\(\); cancelarTurno\(\); return; \}/, 'Escape también');
  assert.match(chat, /const enServidor = crea && !trabajando && trabajoEnElServidor\(mensajes, ahoraServidor\);/);
  assert.match(chat, /if \(trabajando \|\| enServidor \|\| p\.deshabilitado \|\| sinApp\)/);
  assert.match(chat, /if \(enServidorRef\.current && !trabajoEnElServidor\(guardados, Date\.now\(\)\)\) \{ window\.location\.reload\(\); return; \}/, 'cuando MaKo contestó, recarga');
  assert.match(chat, /: enServidor \? <EnElServidor \/>/);
  const ruta = sinComentarios('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(ruta, /if \(deServidor\) after\(\(\) => trabajo\);/);
});
