// =============================================================================
// Un link ANULADO que igual se paga (15/10/2026): se cierra en la pasarela, y si entra igual, se DICE
// =============================================================================
// Se anula un link porque la cuota se cobró por otro lado (`anularLinksDeCuota`, al marcarla pagada) o porque el
// cobro cambió. Stripe expiraba la sesión; Mercado Pago quedaba ABIERTO, y si el cliente abría el link viejo del
// WhatsApp y pagaba, el pago entraba como una cuota cobrada más: la plata entraba dos veces y nadie se enteraba.
// Lo que se fija:
//   1. anular cierra el link también en Mercado Pago: vence la preferencia o cancela la suscripción sin autorizar,
//      DESPUÉS de marcar el cobro anulado (la base primero; el cierre es best effort, como el de Stripe);
//   2. un pago que igual entra por un link anulado se registra (la plata entró) CON el aviso en el cobro y en el
//      historial, y si la cuota del link ya estaba cobrada por otro lado, dice que entró dos veces;
//   3. el cron también mira los anulados que llegaron a la pasarela: un aviso perdido no lo deja escondido.
// Lo puro se ejecuta; el cableado se lee del FUENTE (lib/cobros.ts es `server-only`), como tests/pagos-medias-b2.test.ts.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 6 pases, 0 fallos. Rota (pases / fallos):
//   · anularCobro sin la rama de Mercado Pago                                        → 5 / 1
//   · la suscripción de MP «cerrada» con vencerPreferenciaMp (no es una preferencia)   → 5 / 1
//   · la transición con `motivo: null` también para un link anulado                   → 5 / 1
//   · el aviso del historial sin `nuevo` (un reintento lo repite)                      → 5 / 1
//   · cuotaCobradaPorOtroLado sin comparar el pago (el que la saldó «ya la cobró»)     → 5 / 1
//   · el cron sin los anulados                                                         → 5 / 1
//   · avisoPagoPorLinkAnulado con el mismo texto para los dos casos                    → 5 / 1
// Correr: node --import tsx --test tests/pago-link-anulado.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoPagoPorLinkAnulado, ESTADOS_QUE_PASAN_A_PAGADO } from '../lib/cobros-reglas';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const COBROS = fuente('lib/cobros.ts');

/** El cuerpo de una función de lib/cobros.ts, hasta la siguiente declaración de primer nivel. */
function cuerpo(nombre: string): string {
  const i = COBROS.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en lib/cobros.ts`);
  const resto = COBROS.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('el aviso: un link anulado pagado se registra, y si la cuota ya estaba cobrada dice que la plata entró DOS veces', () => {
  assert.ok(ESTADOS_QUE_PASAN_A_PAGADO.includes('anulado'), 'la plata entró: esconder el pago sería peor');
  const dos = avisoPagoPorLinkAnulado(true);
  const uno = avisoPagoPorLinkAnulado(false);
  assert.match(dos, /ANULADO/);
  assert.match(dos, /dos veces/, 'con la cuota ya cobrada, lo que hay que decir es que entró dos veces');
  assert.match(uno, /ANULADO/);
  assert.doesNotMatch(uno, /dos veces/, 'sin cuota cobrada no se sabe si entró dos veces: no se afirma');
  assert.notEqual(dos, uno);
});

test('anular cierra el link también en Mercado Pago, DESPUÉS de marcarlo anulado en la base', () => {
  const f = cuerpo('anularCobro');
  const marca = f.indexOf("estado: 'anulado'");
  const rama = f.indexOf("c.proveedor === 'mercadopago' && c.proveedor_ref");
  assert.ok(marca > 0, 'anularCobro no marca el cobro anulado');
  assert.ok(rama > marca, 'anularCobro no cierra el link de Mercado Pago (o lo hace antes de marcarlo en la base)');
  const mp = f.slice(rama);
  // Una suscripción de MP es un preapproval, no una preferencia: se cancela (todavía nadie la autorizó).
  assert.match(mp, /c\.tipo === 'suscripcion'\s*\?\s*await cancelarSuscripcionMp\(mp\.token, c\.proveedor_ref, idemAnular\(c\.id\)\)\s*:\s*await vencerPreferenciaMp\(mp\.token, c\.proveedor_ref, idemAnular\(c\.id\)\)/);
  // Best effort, como el de Stripe: si falla, el cobro ya está anulado y un pago que igual entre lleva su aviso.
  assert.match(mp, /if \(!e\.ok\) console\.warn\(/);
});

test('un pago por un link anulado: el aviso en el cobro desde la transición, y en el historial sólo la corrida que la ganó', () => {
  const f = cuerpo('aplicarPagoAprobado');
  const detecta = f.indexOf("const porLinkAnulado = c.estado === 'anulado';");
  const transicion = f.indexOf('if (pasaAPagado(c.estado))');
  assert.ok(detecta > 0 && detecta < transicion, 'el estado se mira ANTES de la transición: después ya es «pagado»');
  assert.match(f, /motivo: porLinkAnulado \? avisoPagoPorLinkAnulado\(false\) : null,/, 'la transición borra el motivo de un link anulado');
  const bloque = f.slice(f.indexOf('if (porLinkAnulado && nuevo) {'));
  assert.ok(f.includes('if (porLinkAnulado && nuevo) {'), 'el aviso del historial no está atado a la corrida que ganó la transición');
  assert.match(bloque, /const dosVeces = !!actual\.pago_id && await cuotaCobradaPorOtroLado\(actual\.pago_id, p\.proveedorPagoId\);/);
  assert.match(bloque, /logLeadEvent\(actual\.lead_id, 'Pago por un link anulado', aviso, autor\)/);
  // Va DESPUÉS de asentar la cuota: «ya estaba cobrada» se lee cuando el pago ya decidió si la saldaba o no.
  assert.ok(f.indexOf('if (porLinkAnulado && nuevo) {') > f.indexOf('registrarCobroDeProveedor('), 'el aviso se decide antes de asentar el pago');
});

test('«ya estaba cobrada» es cobrada por OTRO pago: la que saldó este mismo pago no cuenta', () => {
  const f = cuerpo('cuotaCobradaPorOtroLado');
  assert.match(f, /return !!q\.pagado && q\.proveedor_pago_id !== proveedorPagoId;/,
    'si este mismo pago saldó la cuota del link, no entró dos veces');
  assert.match(f, /if \(error \|\| !data\) return false;/, 'si no se puede leer, el aviso genérico (no se afirma lo que no se sabe)');
});

test('el cron también relee los anulados que llegaron a la pasarela, con su propio tope', () => {
  const f = cuerpo('reconciliarCobros');
  assert.match(f, /\.eq\('estado', 'anulado'\)\.not\('proveedor_ref', 'is', null\)\.gte\('updated_at', desde\)/);
  assert.match(f, /\.order\('updated_at', \{ ascending: false \}\)\.limit\(20\),/);
  assert.match(f, /const pendientes = \[\.\.\.\(pend\.data \?\? \[\]\), \.\.\.\(anul\.data \?\? \[\]\)\]/, 'los anulados no entran al recorrido');
  assert.match(f, /if \(anul\.error\) throw new Error\(/);
});

test('la llamada a Mercado Pago existe y lleva su clave de idempotencia propia', () => {
  const mp = fuente('lib/mercadopago-api.ts');
  assert.match(mp, /export async function vencerPreferenciaMp\(accessToken: string, id: string, idem: string\)/);
  assert.match(mp, /llamar\(accessToken, 'PUT', `\/checkout\/preferences\/\$\{id\}`, \{ expires: true, expiration_date_to: instanteMp\(Date\.now\(\)\) \}, idem\)/);
  assert.match(fuente('lib/cobros-reglas.ts'), /export const idemAnular = \(cobroId: number\): string => `mako-anular-\$\{cobroId\}`;/);
});
