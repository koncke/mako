// =============================================================================
// lib/cobros.ts, el ÚNICO escritor de `cobros`: las reglas que se leen del FUENTE
// =============================================================================
// lib/cobros.ts habla con la base, con Stripe y con Mercado Pago, así que no se ejecuta acá: lo que
// se fija es su forma, extrayendo cada función (AGENTS.md: «se extrae el BLOQUE antes de buscar»,
// sin comentarios — la prosa que explica una trampa la nombra). Cada pregunta es una regla de
// docs/diseno-pasarela-pagos.md §3 y §4.4 que, rota, sigue compilando:
//   · las claves de la pasarela se leen con `credDelCliente(clave, ws)` y con NADA más: credWs,
//     credWsEstricta y process.env caen al ws1 (Mauricio, un cliente) y envCred resuelve contra él.
//     (tests/pasarela-sin-env.test.ts barre el repo buscando los NOMBRES de las claves; éste mira
//     el módulo entero, también una lectura con la clave en una variable, que aquél no ve);
//   · la fila del cobro se escribe ANTES de llamar al proveedor (si la función se corta en el
//     medio queda el rastro, y la clave de idempotencia sale de SU id);
//   · el alta automática de MaKo corre sólo en la plataforma, escrita en POSITIVO, y se RECLAMA con
//     compare-and-set antes de crear nada (dos avisos simultáneos no dan dos altas);
//   · el lead se gana por setPipelineStage con la etapa de SU embudo, nunca con `estado_lead:`;
//   · reembolsar y cancelar llevan la clave DETERMINÍSTICA del cobro (una confirmación repetida no
//     devuelve dos veces), sin vueltas que lo repitan;
//   · la reconciliación usa el MISMO id que el webhook: la factura en una suscripción y el payment
//     intent en un pago único — nunca el id de la sesión (la primera cuota se duplicaba).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 6 pases, 0 fallos. Rota (pases / fallos):
//   · `credWsEstricta('STRIPE_WEBHOOK_SECRET', ws)` en credStripe                        → 5 / 1
//     (tests/pasarela-sin-env.test.ts sigue 3 / 0: busca `credWs(` y credWsEstricta es legítima
//     en el ruteo de un webhook, así que no la puede prohibir en todo el repo)
//   · `credWs(CLAVE_MP_USER, ws)` — la clave en una variable                              → 5 / 1
//     (pasarela-sin-env también 3 / 0: busca el NOMBRE de la clave)
//   · un crearCheckout ANTES del insert en crearCobro                                     → 5 / 1
//   · altaSiCorresponde sin `if (c.workspace_id !== plataforma) return;`                  → 5 / 1
//   · altaSiCorresponde sin `if (!reclamo) return` (el reclamo no frena)                  → 5 / 1
//   · ganarLead escribiendo `estado_lead: 'ganado'` en el update                          → 5 / 1
//   · reembolsarCobro con `crypto.randomUUID()` en vez de idemReembolso                   → 5 / 1
//   · cancelarSuscripcionCobro (Stripe) con una clave con `Date.now()`                    → 5 / 1
//   · reconciliar con el viejo `s.paymentIntent ?? s.invoice ?? s.id`                     → 5 / 1
// Correr: node --import tsx --test tests/cobros-servicio.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
/** Sin comentarios: las líneas PRIMERO y los bloques después (AGENTS.md). */
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const SRC = sinComentarios(readFileSync(join(RAIZ, 'lib/cobros.ts'), 'utf8'));

/** La función entera, desde su firma hasta la `}` de la columna 0 que la cierra. */
function bloque(firma: string): string {
  const i = SRC.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}» en lib/cobros.ts`);
  const fin = SRC.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return SRC.slice(i, fin + 2);
}
const veces = (s: string, sub: string) => s.split(sub).length - 1;

test('las claves de la pasarela: credDelCliente(clave, ws) y nada más (ni credWs*, ni envCred, ni process.env)', () => {
  const lecturas = SRC.match(/credDelCliente\([^)]*\)/g) ?? [];
  assert.ok(lecturas.length >= 5, `esperaba las 5 lecturas (3 de Stripe, 2 de MP), hay ${lecturas.length}`);
  for (const l of lecturas) assert.match(l, /^credDelCliente\('[A-Z_]+', ws\)$/, `una lectura sin el ws explícito: ${l}`);
  assert.doesNotMatch(SRC, /\bcredWs\w*\(/, 'credWs/credWsEstricta caen a process.env para el ws1 (Mauricio)');
  assert.doesNotMatch(SRC, /\benvCred\(/, 'envCred resuelve contra OWNER_WS');
  assert.doesNotMatch(SRC, /process\.env/);
  assert.doesNotMatch(SRC, /\bOWNER_WS\b/, 'lo de MaKo va con wsSuperAdmin(), no con el ws1');
});

test('crearCobro: la fila se escribe ANTES de llamar al proveedor, y la idempotencia sale de SU id', () => {
  const b = bloque('export async function crearCobro(');
  const iInsert = b.indexOf(".from('cobros').insert(");
  const iCheckout = b.indexOf('crearCheckout(');
  assert.ok(iInsert > 0, 'crearCobro ya no inserta la fila');
  assert.ok(iCheckout > iInsert, 'el checkout se crea antes de que exista la fila del cobro');
  // Lo que CREA algo en el proveedor pasa sólo por crearCheckout (después del insert).
  assert.doesNotMatch(b, /crearCheckoutStripe\(|crearPreferenciaMp\(|crearSuscripcionMp\(/);
  // Si el proveedor rechaza, la fila queda anulada con el motivo: no se borra el rastro.
  assert.match(b, /estado: 'anulado', motivo: checkout\.error/);
  assert.doesNotMatch(b, /\.delete\(/);
  // Y las tres creaciones llevan la clave del cobro (`mako-cobro-<id>`), no una al azar.
  const c = bloque('async function crearCheckout(');
  assert.equal(veces(c, 'idem: idemCobro(c.id, vuelta)'), 3);
  assert.equal(veces(c, 'idem:'), 3);
});

test('el alta de MaKo: sólo la plataforma (en positivo) y reclamada con compare-and-set ANTES de darDeAltaCliente', () => {
  const a = bloque('async function altaSiCorresponde(');
  assert.match(a, /const plataforma = await wsSuperAdmin\(\);/);
  const iCorte = a.indexOf('if (c.workspace_id !== plataforma) return;');
  const iReclamo = a.indexOf(".update({ alta_estado: 'pendiente'");
  const iSoloLibre = a.indexOf('.or(`alta_estado.is.null');
  const iFrena = a.indexOf('if (!reclamo) return');
  const iAlta = a.indexOf('darDeAltaCliente(');
  assert.ok(iCorte > 0, 'el alta no corta cuando el cobro no es de la plataforma (un cliente con Stripe crearía inquilinos)');
  assert.ok(iReclamo > iCorte && iSoloLibre > iReclamo, 'el reclamo no es un compare-and-set sobre alta_estado');
  assert.ok(iFrena > iSoloLibre, 'el reclamo no frena: dos avisos simultáneos darían dos altas');
  assert.ok(iAlta > iFrena, 'darDeAltaCliente corre antes de reclamar');
  assert.match(a.slice(iReclamo, iFrena), /\.eq\('workspace_id', plataforma\)/);
  // Una sola puerta al alta en todo el módulo, y crearCobro rechaza el plan fuera de la plataforma.
  assert.equal(veces(SRC, 'darDeAltaCliente('), 1);
  const crear = bloque('export async function crearCobro(');
  assert.match(crear, /if \(ws !== plataforma\) return \{ ok: false/);
  assert.match(crear, /if \(!esCapaVendible\(p\.altaCapa\)\) return \{ ok: false/);
});

test('ganar el lead: setPipelineStage con la etapa de SU embudo, nunca `estado_lead` a mano', () => {
  const g = bloque('async function ganarLead(');
  assert.match(g, /const etapa = etapaDeGanado\(await getPipelineStagesDeLead\(lead\)\);/);
  assert.match(g, /await setPipelineStage\(lead\.id, etapa, \{/);
  assert.match(bloque('export async function aplicarPagoAprobado('), /await ganarLead\(actual, autor, plazo\)/);
  // En TODO el módulo: escribir estado_lead saltea la cascada de ganar (tests/crm-curso-al-ganar.test.ts).
  assert.doesNotMatch(SRC, /\bestado_lead\s*:/);
});

test('reembolsar y cancelar llevan la clave DETERMINÍSTICA del cobro, y una sola llamada por pasarela', () => {
  const r = bloque('export async function reembolsarCobro(');
  assert.equal(veces(r, 'idemReembolso(c.id)'), 1, 'Mercado Pago con la clave del cobro');
  // Stripe también, salvo DESPUÉS de una devolución que falló (15/10/2026): la misma clave dentro de las 24 h devolvería
  // la respuesta vieja sin crear otra devolución. El reintento lleva el `updated_at` que dejó la falla: también fijo.
  assert.match(r, /const idem = idemReembolso\(c\.id, esDevolucionFallida\(c\.motivo\) \? String\(Date\.parse\(c\.updated_at\)\) : null\);\s*const r = await reembolsarStripe\(stripe\.key, \{ idem,/);
  assert.equal(veces(r, 'reembolsarStripe('), 1);
  assert.equal(veces(r, 'reembolsarMp('), 1);
  const k = bloque('export async function cancelarSuscripcionCobro(');
  assert.equal(veces(k, 'idemBaja(c.id)'), 2);
  assert.equal(veces(k, 'cancelarSuscripcionStripe('), 1);
  assert.equal(veces(k, 'cancelarSuscripcionMp('), 1);
  for (const [nombre, f] of [['reembolsarCobro', r], ['cancelarSuscripcionCobro', k]] as const) {
    assert.doesNotMatch(f, /randomUUID|Math\.random|Date\.now|mako-(?:reembolso|baja)-/, `${nombre}: una clave que cambia en cada llamada`);
    assert.doesNotMatch(f, /\bfor\s*\(|\bwhile\s*\(/, `${nombre}: una vuelta que repite lo que mueve plata`);
  }
});

test('reconciliar: suscripción → la FACTURA, pago único → el payment intent; nunca el id de la sesión', () => {
  const rc = bloque('export async function reconciliarCobros(');
  assert.match(rc, /const pagoId = c\.tipo === 'suscripcion' \? s\.invoice : s\.paymentIntent;/);
  assert.match(rc, /if \(pagoId\) \{\s*const r = await aplicarPagoAprobado\(c, \{ proveedorPagoId: pagoId,/);
  assert.doesNotMatch(rc, /\?\?\s*s\.id\b/, 'el id de la sesión como pago: la factura llega después como una RENOVACIÓN');
  assert.doesNotMatch(rc, /proveedorPagoId:\s*(?:s\.id|c\.proveedor_ref|c\.token)\b/);
  // Y Mercado Pago sólo aplica lo que cobró la cuenta del negocio, para ESTE cobro.
  assert.match(rc, /x\.estado === 'approved' && x\.cobradorId === mp\.userId && x\.referencia === c\.token/);
});

// Revisión del 11/10/2026: el cron REPARA los cobros «pagados a medias» (el cobro pasa a pagado antes de
// asentar la cuota; si se corta después del 200 al proveedor, nadie lo reintentaba). Roto a propósito
// (el recorrido de los pagados que no repara a nadie): 6 pass / 1 fail; restaurado: 7 / 0.
test('reconciliar: un pagado sin su cuota en el CRM o con el alta sin terminar vuelve a pasar por aplicarPagoAprobado', () => {
  const rc = bloque('export async function reconciliarCobros(');
  assert.match(rc, /\.eq\('estado', 'pagado'\)/, 'el cron no mira los pagados');
  assert.match(rc, /\.in\('cobro_id', pagados\.map/, 'no cruza los pagados contra sus cuotas');
  assert.match(rc, /const faltaCuota = [^;]*!conCuota\.has\(c\.id\)/);
  assert.match(rc, /if \(!faltaCuota && !faltaAlta\) continue;/);
  assert.match(rc, /if \(c\.proveedor_pago_id\) await aplicarPagoAprobado\(c, \{ proveedorPagoId: c\.proveedor_pago_id \}\)/);
  assert.match(rc, /\.gte\('updated_at', desde\)/, 'la ventana de los pendientes cuenta desde el último movimiento, no desde que se creó');
});
