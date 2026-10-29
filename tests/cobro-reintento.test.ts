// =============================================================================
// «Volver a intentar» un pago que falló: UNA cuota y UNA suscripción viva (29/10/2026)
// =============================================================================
// La verificación de ddfa645d4 (C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md, dos ALTAs). Una
// suscripción con SEPA cuya primera factura falla se reintenta: «Volver a intentar» arma otra sesión (B), que es OTRA suscripción.
// Lo que pasaba:
//   · un aviso TARDÍO del fallo de A (el segundo aviso del mismo fallo, o un reintento de Stripe sobre su factura) devolvía el
//     cobro a `fallido` con el SEPA de B en curso, y se armaba C: dos cuotas y tres suscripciones vivas;
//   · MaKo nunca cancelaba sub_A: si Stripe reintentaba su factura y entraba, otra cuota «renovación» y dos suscripciones
//     cobrando todos los meses.
// Lo que tiene que pasar (corre lib/cobros.ts, el webhook de Stripe y /pagar REALES en tests/_cobro-reintento-hijo.ts):
//   1. El fallo de una sesión anterior, o de una factura de una suscripción que no es la vigente, se ignora.
//   2. Al armar B, sub_A se cancela. El aviso de esa cancelación no cancela el cobro (la vigente es la de B).
//   3. Un pago tardío de la suscripción vieja no se asienta: queda un ticket para devolverlo.
//   4. Lo que ya andaba sigue: un pago único que falla y se paga con tarjeta, o que falla dos veces, deja UNA cuota.
//
// Probado ROMPIÉNDOLO (29/10/2026), una rotura por vez y restaurando (7 pases y 0 fallos como está):
//   · el fallo de una sesión anterior se aplica                  → 6 / 1
//   · la factura de otra suscripción se aplica (fallo y pago)    → 5 / 2
//   · el pago de una factura de la suscripción vieja se asienta  → 6 / 1
//   · la cancelación de sub_A cancela el cobro                   → 6 / 1
//   · al armar B no se cancela sub_A                             → 4 / 3
//   · el fallo se escribe sin mirar la sesión (la carrera)       → 6 / 1
//
// Correr: node --import tsx --test tests/cobro-reintento.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_cobro-reintento-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const UNA_Y_UNA = (k: string) => {
  const c = R[k];
  assert.ok(c, `falta el caso ${k}`);
  assert.equal(c.final, 'pagado', `${k}: ${JSON.stringify(c.log).slice(0, 600)}`);
  assert.equal(c.sub, 'sub_B', `${k}: la suscripción del cobro es la de B`);
  assert.deepEqual(c.cuotas, ['in_B1:110'], `${k}: UNA cuota`);
  assert.deepEqual(c.subsVivasEnStripe, ['sub_B'], `${k}: UNA suscripción viva en Stripe`);
};

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('S1: el segundo aviso del fallo de A, después de armar B, se ignora (en los dos órdenes)', () => {
  for (const k of ['S1_sus_sepa_factura_primero', 'S1_sus_sepa_sesion_primero']) {
    UNA_Y_UNA(k);
    assert.equal(R[k].rechazosEnElHistorial, 1, 'un solo «Pago rechazado»');
    assert.ok(R[k].log.some((l: unknown) => typeof l === 'string' && /ignorado: el fallo es de una sesión anterior|ignorado: la factura es de una suscripción anterior/.test(l)));
  }
});

test('S2: Stripe reintenta la factura de A con B en curso: si falla no reabre nada; si entra, no es otra cuota y abre un ticket', () => {
  UNA_Y_UNA('S2_sus_sepa_reintento_A_falla');
  UNA_Y_UNA('S2_sus_sepa_reintento_A_entra');
  assert.deepEqual(R.S2_sus_sepa_reintento_A_falla.tickets, []);
  assert.deepEqual(R.S2_sus_sepa_reintento_A_entra.tickets, ['cobro-sub-vieja:in_A1'], 'la plata entró: alguien la devuelve');
});

test('al armar B, sub_A se cancela (S3, el control: nada llega tarde)', () => {
  UNA_Y_UNA('S3_control_sus_sepa_sin_aviso_tardio');
  const armar = R.S3_control_sus_sepa_sin_aviso_tardio.log.find((l: unknown) => l && typeof l === 'object' && 'stripe' in (l as object)) as { stripe: string[] };
  assert.ok(armar.stripe.some((x) => /^DELETE \/v1\/subscriptions\/sub_A \[/.test(x)), `se cancela sub_A antes de armar B: ${armar.stripe.join(' · ')}`);
  assert.ok(armar.stripe.findIndex((x) => x.startsWith('DELETE /v1/subscriptions/sub_A')) < armar.stripe.findIndex((x) => x.startsWith('POST /v1/checkout/sessions')));
});

test('S4: el aviso de la cancelación de sub_A no cancela el cobro, ni con B abierta ni con B pagada', () => {
  const s = R.S4_cancelar_A_no_cancela_el_cobro;
  assert.deepEqual(s.conBAbierta, { estado: 'pendiente', suscripcion: null });
  assert.equal(s.final, 'pagado');
  assert.equal(s.suscripcion, 'activa');
  assert.equal(s.canceladaEnElHistorial, 0, 'ni «Suscripción cancelada» en el historial del lead');
  assert.deepEqual(s.cuotas, ['in_B1:110']);
});

test('lo que ya andaba: un pago único que falla se reintenta con tarjeta, o falla dos veces, y queda UNA cuota', () => {
  assert.equal(R.T1_fallido_reintento_con_tarjeta.final, 'pagado');
  assert.deepEqual(R.T1_fallido_reintento_con_tarjeta.cuotas, ['pi_B_tarjeta:110']);
  assert.equal(R.T2_segundo_voucher_tambien_falla.final, 'pagado');
  assert.deepEqual(R.T2_segundo_voucher_tambien_falla.cuotas, ['pi_C_tarjeta:110']);
});

test('S5, la carrera: el fallo de A que se leyó antes de armar B no se escribe sobre B (compare-and-set por la sesión)', () => {
  const s = R.S5_carrera_fallo_de_A_contra_B;
  assert.equal(s.ref, 'cs_live_B');
  assert.equal(s.estado, 'pendiente', `el cobro sigue esperando a B: ${JSON.stringify(s)}`);
  assert.equal(s.motivo, null);
  assert.equal(s.rechazos, 0, 'ni un «Pago rechazado» en el historial');
});
