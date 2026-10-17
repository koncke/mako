// =============================================================================
// El cobro de un cliente de AGENCIA (#866 y #867, 17/10/2026) — las reglas EJECUTADAS y el cableado
// =============================================================================
// La llamada «Revisión de MaKo» con Código Inmobiliario (16/10/2026):
//   · #866: al abrirle la cuenta a un cliente, la agencia ve en el acto el link de Mercado Pago de su primer mes; pagarlo
//     lo habilita sin que Martín lo apruebe, y renueva cada mes en la misma fecha. 47 dólares por cliente.
//   · #867: ese mes corre desde que el cliente TERMINA EL ONBOARDING; ahí MaKo crea la suscripción mensual con
//     `start_date` un mes después (lo único que Mercado Pago documenta: mover la fecha de una ya autorizada, no).
// El porqué entero, en docs/hallazgos-pagos.md, «El mes de un cliente de agencia».
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte. Con
// el código como está: 12 pases, 0 fallos. Rota (pases / fallos):
//   · `desdeDelMes` sin el máximo con el pago (el onboarding anterior le come días al mes)      → 11 / 1
//   · `inicioDeRenovacion` sin el margen (una suscripción que empieza en el pasado)             → 11 / 1
//   · un link viejo pendiente se ofrece aunque el primer mes ya esté pagado                     → 11 / 1
//   · habilitar sin el compare-and-set sobre `pendiente` (un pago reabre una cartera revocada)  → 11 / 1
//   · `crearCobro` acepta `paraCliente` en cualquier workspace                                  → 11 / 1
//   · la renovación también habilita (`if (!renovacion)` fuera)                                 → 11 / 1
// Correr: npx tsx --test tests/agencia-cobro.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRECIO_CLIENTE_AGENCIA_DEFAULT, cobrosParaLaAgencia, desdeDelMes, inicioDeRenovacion, sanearPrecioClienteAgencia, unMesDespues,
  type CobroDeCliente,
} from '../lib/agencia-cobro-reglas';

/** Sin comentarios y con LF: lo que se fija es el código, no lo que dice un comentario. */
const fuente = (rel: string) => readFileSync(rel, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el precio: 47 dólares por defecto y SIN monto en pesos (MaKo no inventa una tasa); lo que no se entiende cae al default', () => {
  assert.deepEqual(PRECIO_CLIENTE_AGENCIA_DEFAULT, { usd: 47, mp: null });
  assert.deepEqual(sanearPrecioClienteAgencia(null), { usd: 47, mp: null });
  assert.deepEqual(sanearPrecioClienteAgencia('{"usd":47,"mp":{"moneda":"ars","monto":"70000"}}'), { usd: 47, mp: { moneda: 'ARS', monto: 70000 } });
  assert.deepEqual(sanearPrecioClienteAgencia({ usd: -3, mp: { moneda: 'pesos', monto: 10 } }), { usd: 47, mp: null }, 'moneda de 3 letras o nada');
  assert.deepEqual(sanearPrecioClienteAgencia({ usd: 50, mp: { moneda: 'ARS', monto: 0 } }), { usd: 50, mp: null });
});

test('⚠️ el mes corre desde el fin del onboarding, y nunca antes del pago', () => {
  assert.equal(desdeDelMes({ onboardingCompletoAt: null, pagadoAt: '2026-10-17T12:00:00Z' }), null, 'sin onboarding terminado, el mes no arrancó');
  assert.equal(desdeDelMes({ onboardingCompletoAt: '2026-10-30T15:00:00.000Z', pagadoAt: '2026-10-17T12:00:00Z' }), '2026-10-30T15:00:00.000Z');
  assert.equal(desdeDelMes({ onboardingCompletoAt: '2026-10-10T09:00:00Z', pagadoAt: '2026-10-17T12:00:00.000Z' }), '2026-10-17T12:00:00.000Z');
});

test('⚠️ la renovación empieza a cobrar un mes después, a la misma hora; si el cron llegó tarde, dentro de una hora', () => {
  const ahora = Date.parse('2026-10-31T00:00:00Z');
  assert.equal(inicioDeRenovacion('2026-10-30T15:00:00.000Z', ahora), '2026-11-30T15:00:00.000Z');
  assert.equal(unMesDespues('2026-01-31T10:00:00.000Z'), '2026-02-28T10:00:00.000Z', 'el día capado al último del mes');
  assert.equal(inicioDeRenovacion('2026-09-01T00:00:00.000Z', ahora), '2026-10-31T01:00:00.000Z', 'nunca en el pasado');
});

const cobro = (x: Partial<CobroDeCliente>): CobroDeCliente => ({
  cliente_ws: 21, tipo: 'unico', estado: 'pendiente', suscripcion_estado: null, link: 'https://hola-mako.com/pagar/a', inicio_at: null, created_at: '2026-10-17T12:00:00Z', ...x,
});

test('lo que ve la agencia: el link del primer mes mientras se puede pagar, y la renovación mientras espera', () => {
  assert.deepEqual(cobrosParaLaAgencia([cobro({})]), { 21: { pagar: 'https://hola-mako.com/pagar/a', renovacion: null } });
  assert.deepEqual(cobrosParaLaAgencia([cobro({ estado: 'anulado' })]), {}, 'un link anulado no se ofrece');
  assert.deepEqual(cobrosParaLaAgencia([cobro({ estado: 'pagado' })]), {}, 'pagado: no pide nada');
  const renov = cobro({ tipo: 'suscripcion', link: 'https://hola-mako.com/pagar/r', inicio_at: '2026-11-30T15:00:00Z', created_at: '2026-10-30T15:30:00Z' });
  assert.deepEqual(cobrosParaLaAgencia([cobro({ estado: 'pagado' }), renov]), { 21: { pagar: null, renovacion: { link: 'https://hola-mako.com/pagar/r', desde: '2026-11-30T15:00:00Z', activada: false } } });
  assert.equal(cobrosParaLaAgencia([{ ...renov, suscripcion_estado: 'activa' }])[21].renovacion?.activada, true, 'autorizada, esperando el primer cobro');
  assert.deepEqual(cobrosParaLaAgencia([{ ...renov, suscripcion_estado: 'cancelada' }]), {});
  assert.deepEqual(cobrosParaLaAgencia([{ ...renov, estado: 'pagado', suscripcion_estado: 'activa' }]), {}, 'ya cobra: no pide nada');
});

test('⚠️ un link viejo pendiente NO se ofrece si el primer mes ya está pagado (se pagaría dos veces)', () => {
  const pagado = cobro({ estado: 'pagado', created_at: '2026-10-16T12:00:00Z', link: 'https://hola-mako.com/pagar/b' });
  // En los dos órdenes: el pendiente más nuevo que el pagado, y el más viejo.
  assert.deepEqual(cobrosParaLaAgencia([cobro({ created_at: '2026-10-17T12:00:00Z' }), pagado]), {});
  assert.deepEqual(cobrosParaLaAgencia([cobro({ created_at: '2026-10-15T12:00:00Z' }), pagado]), {});
});

test('⚠️ el pago HABILITA: compare-and-set sobre `pendiente`, sólo la plataforma, sólo el primer mes pagado', () => {
  const h = fuente('lib/agencia-habilitar.ts');
  assert.match(h, /if \(c\.estado !== 'pagado' \|\| c\.tipo !== 'unico'\) return;/);
  assert.match(h, /if \(c\.workspace_id !== \(await wsSuperAdmin\(\)\)\) return;/);
  assert.match(h, /\.eq\('agencia_ws', agenciaWs\)\.eq\('cliente_ws', clienteWs\)\.eq\('estado', 'pendiente'\)/, 'una cartera revocada no la reabre un pago');
  assert.match(h, /decidido_por: `pago:\$\{c\.proveedor\}`/);
  assert.match(h, /const aviso = await avisarClienteAprobado\(clienteWs\);/);
  // La firma del super admin manda el MISMO aviso.
  assert.match(fuente('app/api/admin/agencia/route.ts'), /const aviso = estado === 'aprobado' \? await avisarClienteAprobado\(clienteWs\) : null;/);
});

test('el aviso de la pasarela y el cron habilitan; una renovación no', () => {
  const c = fuente('lib/cobros.ts');
  assert.match(c, /await altaSiCorresponde\(actual\);\s*if \(!renovacion\) await habilitarClienteDeAgencia\(actual\);/);
  assert.match(c, /for \(const c of pagados\) \{\s*await habilitarClienteDeAgencia\(c\);/);
});

test('⚠️ `crearCobro`: el lugar de un cliente lo cobra SÓLO la plataforma, y un inicio diferido sólo en una suscripción de Mercado Pago', () => {
  const c = fuente('lib/cobros.ts');
  assert.match(c, /if \(p\.paraCliente\) \{\s*if \(ws !== \(await wsSuperAdmin\(\)\)\) return \{ ok: false/);
  assert.match(c, /if \(inicioAt && \(p\.tipo !== 'suscripcion' \|\| p\.pasarela !== 'mercadopago'/);
  // Las columnas de la 0308 se mandan sólo en ESE cobro: una base sin la migración no rompe ningún otro.
  assert.match(c, /\.\.\.\(paraCliente \? \{ agencia_ws: paraCliente\.agenciaWs, cliente_ws: paraCliente\.clienteWs \} : \{\}\)/);
  assert.doesNotMatch(fuente('lib/cobros-tipos.ts'), /agencia_ws|cliente_ws|inicio_at/, 'COLS_COBRO sin las columnas de la 0308');
  assert.match(c, /cobros_un_vivo_por_cliente_de_agencia/, 'dos pedidos a la vez devuelven el que ganó');
});

test('Mercado Pago recibe `start_date` sólo cuando hay inicio', () => {
  const m = fuente('lib/mercadopago-api.ts');
  assert.match(m, /\.\.\.\(p\.inicioAt \? \{ start_date: p\.inicioAt \} : \{\}\)/);
});

test('abrir la cuenta crea el link del primer mes y, sin link, la cuenta queda como siempre', () => {
  const a = fuente('app/customer-success/actions.ts');
  const i = a.indexOf('await crearUsuario({');
  const j = a.indexOf('const cobro = await linkPrimerMes({ agenciaWs, clienteWs: ws.id');
  assert.ok(i > 0 && j > i, 'el link sale después de crear la cuenta y su usuario');
  assert.match(a, /return \{ ok: true, clienteWs: ws\.id, estado: 'pendiente', link: cobro\.ok \? cobro\.link : null, sinLink: cobro\.ok \? null : cobro\.motivo \};/);
});

test('⚠️ una agencia ve SÓLO sus cobros: la lectura filtra por `agencia_ws`', () => {
  const s = fuente('lib/agencia-cobro.ts');
  assert.match(s, /\.eq\('workspace_id', plataforma\)\.eq\('agencia_ws', agenciaWs\)/);
  assert.match(fuente('app/customer-success/page.tsx'), /cobrosPorWs: esAg && agenciaWs \? await cobrosDeClientesDeAgencia\(agenciaWs\) : \{\}/);
});

test('la renovación nace del cron al terminar el onboarding, con su inicio, y el cron no corta la respuesta', () => {
  const s = fuente('lib/agencia-cobro.ts');
  assert.match(s, /if \(estado\.status !== 'done'\) continue;/);
  assert.match(s, /inicioAt: inicioDeRenovacion\(desde, Date\.now\(\)\)/);
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /agencia = await renovacionesDeAgencia\(\)\.catch\(\(e\) => \(\{ error: msg\(e\) \}\)\);/);
});
