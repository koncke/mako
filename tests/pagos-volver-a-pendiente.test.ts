// =============================================================================
// Una cuota cobrada por error vuelve a pendiente, y una cobrada se corrige sin mentir (14/11/2026)
// =============================================================================
// Mauricio (ws1), en su grupo: «por error digo que un cobro de diciembre o próximo futuro se cobró, no hay forma de deshacer
// o editar, es dentro del crm los ganados». Medido en la base: el 06/11 marcó cobrada la Cuota 2 de Raúl Landeros (vencía el
// 30/11), y el 14/11, para devolverla, le cambió la fecha al 30/11. La ficha ya tenía un botón «Deshacer» en la cobrada, pero
// esa fecha es el DÍA DEL PAGO: quedó «cobrada el 30/11», un pago en el futuro, y el historial anotó «vence 06/11 → vence
// 30/11». Lo que se fija acá:
//   1. el botón de la cobrada a mano dice «Volver a pendiente»; la de la pasarela no lleva ninguno;
//   2. el día del pago no puede ser después de hoy, y el error dice cómo se hace lo que se quería;
//   3. el historial de una cobrada corregida dice «cobrada el …», y el de la vuelta a pendiente, cuál y de cuándo era el pago;
//   4. el cableado: la corrección y el cobro a mano miran la fecha, y las dos maneras de desmarcar (la ficha y la API de MaKo)
//      escriben el mismo historial, con quién lo hizo (el autor ya lo ponían `autorActual` y `autorDe`).
//
// PROBADO ROMPIÉNDOLO (14/11/2026), una rotura por vez, cada una restaurada antes de la siguiente:
//   · el botón de la cobrada vuelve a decir «Deshacer»                                  → cae el 1;
//   · `diaDePagoFuturo` con `<` en vez de `<=` (hoy deja de valer)                       → cae el 2;
//   · `diaDePagoFuturo` siempre null (el pago al futuro pasa)                             → cae el 2;
//   · la línea de la cobrada con «vence» en vez de «cobrada el»                           → cae el 3;
//   · el historial de desmarcar sin el número de cuota                                    → cae el 3;
//   · `editarCuotaAction` vuelve a `lineasDeCuotas` para la cobrada                       → cae el 4;
//   · `cobrarCuota` sin el chequeo de la fecha                                            → cae el 4.
// Correr: node --import tsx --test tests/pagos-volver-a-pendiente.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renglonDeCuota, type CuotaDelLead } from '../lib/pagos-vistazo';
import { BOTON_VOLVER_A_PENDIENTE, diaDePagoFuturo, lineaDeCobradaEditada, textoDeVueltaAPendiente } from '../lib/pagos-campo';

const HOY = '2026-11-14';
const codigo = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
type Q = CuotaDelLead & { concepto?: string | null; metodo?: string | null };
let n = 0;
const cuota = (o: Partial<Q> & { numero: number; monto_usd: number }): Q =>
  ({ id: ++n, pagado: false, fecha_esperada: null, fecha_pago: null, proveedor: null, cobro_id: null, moneda: null, monto_original: null, ...o });

test('1. la cobrada a mano lleva «Volver a pendiente»; la de la pasarela, ningún botón; la impaga, «Marcar pagada»', () => {
  // La Cuota 2 de Raúl Landeros como quedó el 06/11: cobrada a mano, vencía el 30/11.
  const raul = renglonDeCuota(cuota({ numero: 2, monto_usd: 2500, fecha_esperada: '2026-11-30', pagado: true, fecha_pago: '2026-11-06' }), HOY);
  assert.deepEqual([raul.estado, raul.accion, raul.boton], ['cobrada', 'deshacer', 'Volver a pendiente']);
  assert.equal(BOTON_VOLVER_A_PENDIENTE, 'Volver a pendiente');
  const stripe = renglonDeCuota(cuota({ numero: 2, monto_usd: 2500, pagado: true, fecha_pago: '2026-11-06', proveedor: 'stripe', cobro_id: 9 }), HOY);
  assert.deepEqual([stripe.accion, stripe.boton], ['ninguna', null], 'lo que cobró la pasarela se revierte con «Devolver», en su cobro');
  const pendiente = renglonDeCuota(cuota({ numero: 3, monto_usd: 2500, fecha_esperada: '2026-12-30' }), HOY);
  assert.deepEqual([pendiente.accion, pendiente.boton], ['marcar', 'Marcar pagada']);
});

test('2. el día del pago no puede ser después de hoy, y el error dice cómo volverla a pendiente', () => {
  const error = diaDePagoFuturo('2026-11-30', HOY);
  assert.ok(error, 'el 30/11 con hoy 14/11 es un pago en el futuro');
  assert.match(error, /^¿La cobraste de verdad\?/, 'pregunta antes de explicar');
  assert.match(error, /30\/11\/2026/);
  assert.match(error, /«Volver a pendiente»/, 'dice cómo se hace lo que se quería');
  assert.equal(diaDePagoFuturo(HOY, HOY), null, 'hoy vale');
  assert.equal(diaDePagoFuturo('2026-11-06', HOY), null, 'el pasado vale');
  assert.equal(diaDePagoFuturo(null, HOY), null, 'sin fecha no es asunto de esta regla');
});

test('3. el historial: la cobrada corregida dice «cobrada el», y la vuelta a pendiente dice cuál y de cuándo era el pago', () => {
  assert.deepEqual(lineaDeCobradaEditada(2, { monto_usd: 2500, fecha_pago: '2026-11-06' }, { monto_usd: 2500, fecha_pago: '2026-11-13' }), {
    campo: 'Cuota 2', valor_anterior: 'USD 2500 · cobrada el 06/11/2026', valor_nuevo: 'USD 2500 · cobrada el 13/11/2026',
  });
  assert.equal(textoDeVueltaAPendiente(2, '2026-11-06'), 'Cuota 2 volvió a pendiente (estaba cobrada el 06/11/2026)');
  assert.equal(textoDeVueltaAPendiente(0, null), 'Cobro inicial volvió a pendiente');
  assert.equal(textoDeVueltaAPendiente(undefined, undefined), 'La cuota volvió a pendiente');
});

test('4. el cableado: la corrección y el cobro miran la fecha; la ficha y la API escriben el mismo historial', () => {
  const pagos = codigo('lib/pagos.ts');
  const cobrada = pagos.slice(pagos.indexOf('async function editarCuotaCobrada'), pagos.indexOf('export async function cortarRecordatoriosDeCuota'));
  assert.match(cobrada, /if \(cambio\.fecha !== antes\.fecha_esperada\) \{\s*const futuro = diaDePagoFuturo\(cambio\.fecha, await hoyEnWorkspace\(\)\);\s*if \(futuro\) throw new Error\(futuro\);/);
  const cobro = pagos.slice(pagos.indexOf('export async function cobrarCuota'), pagos.indexOf('await asegurarLeadDelNegocio(leadId);', pagos.indexOf('export async function cobrarCuota')));
  assert.match(cobro, /const futuro = diaDePagoFuturo\(datos\.fecha, await hoyEnWorkspace\(\)\);\s*if \(futuro\) throw new Error\(futuro\);/);
  assert.match(pagos, /return \{ quitada, porLink: null, yaEstaba: false, cuota: \{ numero: Number\(pago\.numero\), fechaPagoAntes:/);

  const accion = codigo('app/crm/[id]/pagos-campo-actions.ts');
  assert.match(accion, /cambio\?\.espera === 'cobrada'\s*\? \[lineaDeCobradaEditada\(r\.numero, \{ monto_usd: antes\.monto, fecha_pago: antes\.fecha \}, \{ monto_usd: despues\.monto, fecha_pago: despues\.fecha \}\)\]/);

  for (const [ruta, autor] of [['app/crm/actions.ts', /await autorActual\(\)/], ['lib/api-mako/areas/crm.run.ts', /autorDe\(ctx\)/]] as const) {
    const src = codigo(ruta);
    assert.match(src, /textoDeVueltaAPendiente\(cuota\?\.numero, cuota\?\.fechaPagoAntes\)/, `${ruta}: el historial de desmarcar`);
    const linea = src.slice(src.indexOf('textoDeVueltaAPendiente(cuota?.numero'), src.indexOf('textoDeVueltaAPendiente(cuota?.numero') + 120);
    assert.match(linea, autor, `${ruta}: con quién lo hizo`);
  }
  assert.match(codigo('app/crm/lead-view/ficha/pagos/cobrar.tsx'), /show\(`\$\{nombreCuota\(q\.numero\)\} volvió a pendiente`/);
});
