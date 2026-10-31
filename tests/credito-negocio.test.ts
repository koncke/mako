// =============================================================================
// El crédito de la cuenta 1 como el Claude del ws1, con su interruptor en SuperAdmin › Uso (22/10/2026)
// =============================================================================
// Martín, textual: «habilita los tokens de la API de la cuenta de Mauricio, esos 200, para su Ops Center, que lo pueda usar,
// así puedo seguir probando en Automations», y «dame luego una opción para deshabilitarle esa API a Mauricio en SuperAdmin,
// tal vez en USO, que pueda desactivar». Lo que fija este test (la parte de verdad, tests/_credito-negocio-hijo.ts):
//   1. prendido (sin fila: el default), el ws1 usa el crédito de la cuenta 1 como su Claude: el chat con herramientas (Ops
//      Center, la estrella de cada tab) y el de Automations, con Haiku, y su gasto con la marca del crédito; el Plan no;
//      otro negocio no; y no se escribe NADA en el ws1;
//   2. la tarjeta de «Tus cuentas de IA» dice «crédito» y no «Es la clave de MaKo»; la caja y /integraciones, que tiene IA;
//   3. el interruptor vive en el workspace de la plataforma, apaga y prende; «no pude leerlo» es apagado; sólo un negocio de
//      la lista; su clave propia, si la conecta, gana;
//   4. el Uso: lo que lleva gastado ESE negocio de ese crédito, y lo de «su clave es el crédito» a la cuenta del negocio;
//   5. la pantalla: el interruptor, sólo para el super admin, en la computadora y en el teléfono.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { creditoQuePago, gastoDelAsignado, type FilaGasto, type LecturaCredito } from '../lib/credito-api';
import { CREDITO_DE_UN_NEGOCIO, MOTIVO_CREDITO_SU_CLAVE, claveDelInterruptorDeCredito, esInterruptorPrendido } from '../lib/veto-claude';
import { VistaCredito } from '../app/admin/operaciones/UsoCredito';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_credito-negocio-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@CREDITO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@CREDITO@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const CREDITO1 = 'sk-ant-api03-credito-cuenta1-ccc';

test('1. prendido, el ws1 usa el crédito de la cuenta 1 en sus chats (Haiku, con la marca), nunca el Plan; otro negocio no', () => {
  const r = correr();
  for (const caso of ['permisoChat', 'permisoAutomations']) {
    assert.deepEqual(r[caso], { clave: CREDITO1, modelo: 'claude-haiku-4-5', esCredito: true }, `${caso}: ${JSON.stringify(r[caso])}`);
  }
  assert.equal(r.permisoPlan, null, 'el Plan pagó con el crédito de Martín');
  assert.equal(r.permisoWs13, null, 'un negocio sin crédito asignado lo usó');
  assert.equal(r.chat, 'hola desde Claude', `el chat con herramientas no contestó: ${r.chat}`);
  assert.equal(r.automations, 'hola desde Claude', `el chat de Automations no contestó: ${r.automations}`);
  for (const caso of ['chatAnthropic', 'automationsAnthropic']) {
    assert.deepEqual(r[caso], [{ camino: '/v1/messages', clave: CREDITO1, modelo: 'claude-haiku-4-5' }], `${caso}: ${JSON.stringify(r[caso])}`);
  }
  assert.ok(r.gasto.length >= 2 && r.gasto.every((g: { motivo: string; costo: number }) => g.motivo.startsWith(MOTIVO_CREDITO_SU_CLAVE) && g.costo > 0), `el gasto no quedó como del crédito: ${JSON.stringify(r.gasto)}`);
  assert.deepEqual(r.ajustesWs1, [], 'se escribió en el ws1 (la marca del crédito u otra cosa)');
  // Automations: la API de MaKo pregunta antes de proponer un flujo, y su Claude (el crédito) cuenta.
  assert.equal(r.hayIAParaCrear, true, 'la API de MaKo diría «conecta tu IA» con el crédito prendido');
});

test('2. la tarjeta dice «crédito» (no «Es la clave de MaKo»); la caja y /integraciones, que tiene IA', () => {
  const r = correr();
  assert.deepEqual(r.tarjeta, ['anthropic:credito'], 'con el crédito prendido, la tarjeta muestra las copias de MaKo');
  assert.deepEqual(r.tarjetaWs13, ['anthropic:copia', 'openai:copia'], 'sin crédito, como siempre');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  // 23/10/2026 (Martín): «Usa el crédito de Claude que te dio MaKo» no va en el panel del cliente; el crédito se ve en SuperAdmin.
  assert.doesNotMatch(ui, /crédito de Claude que te dio MaKo|Tu clave de/, 'el panel del cliente muestra el crédito o la clave');
  assert.match(sinComentarios(leer('app/admin/operaciones/UsoCredito.tsx')), /function FilaAsignado\(/, 'el crédito asignado ya no se ve en SuperAdmin');
  assert.match(sinComentarios(leer('app/api/mako/chat/route.ts')), /if \(await claveDelCreditoAsignado\(persona\.ws\)\) return true;/, 'la caja sigue ofreciendo «Conectar tu IA»');
  assert.match(sinComentarios(leer('lib/integraciones.ts')), /if \(key === 'anthropic' && \(await \(await import\('\.\/credito-negocio'\)\)\.claveDelCreditoAsignado\(ws\)\)\) return \{ fila: true, propia: true \};/);
});

test('3. el interruptor: en la plataforma, apaga y prende; sin leerlo, apagado; sólo de la lista; su clave propia gana', () => {
  const r = correr();
  assert.deepEqual(r.ajustesPlataforma, [`${claveDelInterruptorDeCredito(1)}=apagado`]);
  assert.equal(r.apagadoPermiso, null, 'apagado, siguió usando el crédito');
  assert.equal(r.apagadoClave, null);
  assert.equal(r.apagadoHayIAParaCrear, false, 'apagado, Automations siguió creyendo que tiene IA');
  assert.deepEqual(r.apagadoTarjeta, ['anthropic:copia', 'openai:copia'], 'apagado, vuelve a como estaba');
  assert.deepEqual(r.apagadoUso, [false]);
  assert.equal(r.otroNegocio, 'tiró: Ese negocio no tiene un crédito asignado.');
  assert.deepEqual(r.prendidoOtraVez, { clave: CREDITO1, modelo: 'claude-haiku-4-5', esCredito: true });
  assert.equal(r.sinLeer, null, 'sin poder leer el interruptor, gastó el crédito');
  assert.deepEqual(r.conLaSuya, { clave: 'sk-ant-api03-propia-de-mauricio-', modelo: 'claude-haiku-4-5', esCredito: false }, 'el crédito tapó su clave propia');
  assert.equal(esInterruptorPrendido(null), true, 'sin fila, prendido (lo pidió Martín)');
  assert.equal(esInterruptorPrendido('apagado'), false);
  assert.deepEqual(CREDITO_DE_UN_NEGOCIO.map((c) => [c.ws, c.clave]), [[1, 'ANTHROPIC_CREDITO_CUENTA1']]);
  // La acción es del super admin.
  const acc = sinComentarios(leer('app/admin/operaciones/acciones.ts'));
  const i = acc.indexOf('export async function creditoDelNegocioAction(');
  assert.ok(i > 0 && /if \(!puedeOperar\(admin, await wsSuperAdmin\(\)\)\) return \{ ok: false, error: NO_PUEDE \};/.test(acc.slice(i, i + 400)), 'el interruptor no pasa por la puerta del super admin');
});

test('4. el Uso: lo que lleva gastado ese negocio; y «su clave es el crédito» va a la cuenta del NEGOCIO', () => {
  const r = correr();
  assert.deepEqual(r.uso, [{ ws: 1, quien: 'Mauricio (ws1)', cuenta: 'claude1', prendido: true, gastadoUsd: 0.004, llamadas: 2 }]);
  const fila = (p: Partial<FilaGasto>): FilaGasto => ({ workspace_id: 1, created_at: '2026-10-22T12:00:00Z', motivo: `${MOTIVO_CREDITO_SU_CLAVE} · Chat`, cuenta: 1, cost_usd: 0.01, provider: 'anthropic', model: 'claude-haiku-4-5', ...p });
  // El ws10 tiene la clave de la cuenta 2 como su Claude: lo suyo con esa marca va a la cuenta 2 (antes, a la 1).
  assert.deepEqual(creditoQuePago(fila({ workspace_id: 10 }), new Map([[10, 'claude2']])), { cuenta: 'claude2', negocio: 10 });
  assert.deepEqual(creditoQuePago(fila({}), new Map()), { cuenta: 'claude1', negocio: 1 }, 'el ws1, por su crédito asignado');
  assert.deepEqual(gastoDelAsignado([fila({}), fila({ workspace_id: 13 }), fila({ motivo: 'Chat del Ops Center' }), fila({ created_at: '2026-09-01T00:00:00Z' })], 1, Date.parse('2026-10-01T03:00:00Z')),
    { usd: 0.01, llamadas: 1 }, 'cuenta otra cosa que lo del negocio con la marca del crédito, en el ciclo');
  assert.equal(gastoDelAsignado(null, 1, 0), null, 'sin registro, sin número inventado');
});

test('5. la pantalla: el interruptor con lo gastado; apagado dice qué pasa; en la computadora y en el teléfono', () => {
  const lectura = (prendido: boolean | null): LecturaCredito => ({
    ok: true, filas: [], total: { gastadoUsd: 0, vinculadas: 0, rindeUsd: 0, totalUsd: 0 }, negociosSinLeer: false,
    asignados: [{ ws: 1, quien: 'Mauricio (ws1)', cuenta: 'claude1', prendido, gastadoUsd: 1.5, llamadas: 30 }],
  });
  const cuentas = [{ cuenta: 'claude1', vistoAt: null, cuota: null, titular: { nombre: 'Mauricio Bustos', email: null, alias: null } }];
  const html = (prendido: boolean | null) => renderToStaticMarkup(createElement(VistaCredito, { lectura: lectura(prendido), cuentas: cuentas as never, onCambiar: () => {} }));
  assert.match(html(true), /Crédito de Claude para Mauricio \(ws1\)/);
  assert.match(html(true), /role="switch" aria-checked="true"[^>]*>Prendido</);
  assert.match(html(true), /Lleva US\$1,50 de Mauricio Bustos este mes/);
  assert.match(html(false), /aria-checked="false"[^>]*>Apagado</);
  assert.match(html(false), /apagado: le pide «Conecta tu IA»/);
  assert.match(html(null), /No pude leerlo/);
  // Llega a las dos pantallas del super admin.
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /onCambiarCredito=\{k\.cambiarCreditoDelNegocio\}/);
  assert.match(sinComentarios(leer('app/m/operaciones/CentroAppMovil.tsx')), /onCambiarCredito=\{k\.cambiarCreditoDelNegocio\}/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Uso.tsx')), /<SeccionCredito leer=\{onLeerCredito\} cambiar=\{onCambiarCredito\}/);
  assert.match(sinComentarios(leer('app/m/operaciones/RunnerMovil.tsx')), /<SeccionCredito leer=\{onLeerCredito\} cambiar=\{onCambiarCredito\}/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, romper.mjs, una por vez): ver docs/hallazgos-ia.md («El crédito de la cuenta 1 como el
// Claude del ws1»).
