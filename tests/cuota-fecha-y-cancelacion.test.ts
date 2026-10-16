// =============================================================================
// La cuota lleva la fecha del PAGO, y una suscripción cancelada sale del MRR en el acto (15/10/2026)
// =============================================================================
// Dos cuentas que se corrían sin error:
//   1. la cuota de un pago de la pasarela se asentaba con la fecha en que MaKo PROCESÓ el aviso. Un aviso reintentado o
//      el cron que repara días después la corría de día, y un pago del 31 caía en el mes siguiente del cash. Ahora va
//      la fecha del pago: el `created` del evento de Stripe (cuándo pasó, no cuándo llegó), `date_approved` en Mercado
//      Pago, y el `pagado_at` del cobro al reparar;
//   2. cancelar una suscripción de la pasarela la pasaba a «plazo = meses transcurridos, mínimo 1»: cancelada en el
//      primer mes, el MRR la seguía contando hasta cumplir el mes. Ahora queda CANCELADA CON FECHA (como la manual) y el
//      MRR no cuenta ninguna cancelada; los meses que duró son las mensualidades que cobró ese cobro.
// Lo puro se EJECUTA (el sobre del evento); el cableado se lee del fuente (módulos `server-only`).
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 4 pases, 0 fallos. Rota (pases / fallos):
//   · eventoStripe sin leer `created`                                                → 3 / 1
//   · aplicarPagoAprobado con la fecha de hoy siempre                                → 3 / 1
//   · el webhook de MP sin `pagadoAt: pago.fecha`                                     → 3 / 1
//   · la cancelación sin `suscripcion_cancelada_at`                                   → 3 / 1
//   · getMrrActivo contando las canceladas                                            → 3 / 1
//   · la que TERMINÓ su plazo marcada cancelada igual (sin `termino`)                → 3 / 1
// Correr: node --import tsx --test tests/cuota-fecha-y-cancelacion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eventoStripe } from '../lib/cobros-eventos';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('el evento de Stripe dice CUÁNDO pasó (su `created`), no cuándo llegó', () => {
  const ev = eventoStripe({ id: 'evt_1NG8Du2eZvKYlo2CUI79vXWy', object: 'event', type: 'invoice.paid', created: 1760486399, livemode: false, data: { object: {} } });
  assert.equal(ev?.creado, '2025-10-14T23:59:59.000Z');
  assert.equal(eventoStripe({ id: 'evt_1NG8Du2eZvKYlo2CUI79vXWy', object: 'event', type: 'invoice.paid', data: { object: {} } })?.creado, null);
});

test('la cuota se asienta con la fecha del pago: los avisos y la reparación la pasan', () => {
  const c = fuente('lib/cobros.ts');
  const a = cuerpo(c, 'aplicarPagoAprobado');
  assert.match(a, /const cuando = p\.pagadoAt \? Date\.parse\(p\.pagadoAt\) : NaN;\s*const fecha = await hoyEnWorkspace\(Number\.isFinite\(cuando\) \? new Date\(cuando\) : new Date\(\)\);/,
    'la cuota con la fecha de HOY: un aviso reintentado la corre de día (y de mes)');
  const w = fuente('lib/cobros-webhook.ts');
  assert.equal((w.match(/pagadoAt: ev\.creado \?\? null/g) ?? []).length, 2, 'Stripe: la sesión y la factura, con el `created` del evento');
  assert.match(w, /suscripcionId: pago\.preapprovalId, pagadoAt: pago\.fecha \}/, 'Mercado Pago: date_approved');
  const r = cuerpo(c, 'reconciliarCobros');
  assert.match(r, /pagadoAt: c\.pagado_at/, 'reparar días después no la corre al día de la reparación');
  assert.match(r, /pagadoAt: aprobado\.fecha/);
});

test('cancelar por la pasarela: cancelada CON FECHA, el plazo de antes guardado, y los meses = las mensualidades cobradas', () => {
  const f = cuerpo(fuente('lib/cobros.ts'), 'aplicarSuscripcionCancelada');
  assert.match(f, /suscripcion_cancelada_at: `\$\{hoy\}T12:00:00Z`/, 'sin la fecha, el MRR la sigue contando (y la ficha no dice «Cancelada»)');
  assert.match(f, /suscripcion_meses_antes: lead\.suscripcion_meses \?\? null/);
  assert.match(f, /const meses = Math\.max\(1, pagadas \|\| mesesTranscurridos\(lead\.fecha_cierre, hoy\)\);/);
  // Una con plazo que cobró TODAS sus mensualidades no se canceló: terminó (Stripe la cierra sola con el `cancel_at`).
  assert.match(f, /termino = lead\.suscripcion_meses != null && lead\.suscripcion_meses > 0 && pagadas >= lead\.suscripcion_meses;/);
  assert.match(f, /const \{ error \} = termino \? \{ error: null \} : await db\.from\('leads'\)\.update\(/, 'la que terminó su plazo quedaba «Cancelada»');
});

test('el MRR no cuenta ninguna cancelada, quede o no plazo por cumplir', () => {
  const q = fuente('lib/queries.ts');
  const ini = q.indexOf('async function _getMrrActivo(');
  const f = q.slice(ini, q.indexOf('\nexport const ', ini));
  assert.match(f, /\.select\('suscripcion_monto_usd, suscripcion_meses, fecha_cierre, suscripcion_cancelada_at'\)/);
  assert.match(f, /if \(r\.suscripcion_cancelada_at\) continue;/);
});
