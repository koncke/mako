// =============================================================================
// La tab Pagos de un vistazo: qué debe, qué pagó y qué hago ahora (16/10/2026)
// =============================================================================
// Martín (por Cerebro): «la tab de PAGOS que está un desastre también en funcionalidad, no se entiende». Lo que no
// se entendía está medido en docs/hallazgos-pagos.md §1. Lo que se fija acá, EJECUTANDO lib/pagos-vistazo.ts:
//   1. el titular dice lo que se DEBE (lo vencido), no «$X cobrado de $Y», y la acción es UNA y la que toca;
//   2. una cuota DEVUELTA no es deuda: no lleva «Marcar pagada» ni suma al pendiente (la tarjeta de antes sí);
//   3. una mensualidad no se «paga por completo»: está al día o le falta registrar meses;
//   4. un cobro pagado no se cuenta dos veces en los movimientos, y el devuelto no desaparece;
//   5. un contracargo es un AVISO (cada frase de `textoContracargo` se reconoce), y un rechazo común no.
//
// PROBADO ROMPIÉNDOLO (16/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 9 pases, 0 fallos. Rota, cada una da 8 / 1:
//   · el botón cobra la cuota vencida más NUEVA, no la más vieja;
//   · la próxima cuota lleva botón aunque falte un mes (sin el tope de 14 días);
//   · la cuota devuelta sin su corte (vuelve a ser deuda con «Marcar pagada»);
//   · la venta devuelta dice «todavía no hay pagos»;
//   · la cobrada por la pasarela se deshace a mano;
//   · la mensualidad sin el aviso de meses sin registrar;
//   · el plan corto dice «Pagó todo»;
//   · un ganado sin monto se calla;
//   · un cobro pagado se cuenta dos veces en los movimientos;
//   · la devolución no es un movimiento;
//   · los movimientos del más viejo al más nuevo;
//   · un contracargo no es aviso;
//   · el reconocedor de contracargos sin «La disputa se», o sin la fase de Mercado Pago (lib/cobros-reglas.ts).
// Correr: node --import tsx --test tests/pagos-vistazo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobradoDelLead } from '../lib/cobrado-lead';
import { estadoDeCuenta, movimientosDelLead, renglonDeCuota, avisoDelCobro, type CuotaDelLead, type CobroParaMovimientos } from '../lib/pagos-vistazo';
import { textoContracargo, esTextoDeContracargo, textoDevolucionFallida } from '../lib/cobros-reglas';

const HOY = '2026-10-16';
type Q = CuotaDelLead & { concepto?: string | null; metodo?: string | null };
let n = 0;
const cuota = (o: Partial<Q> & { numero: number; monto_usd: number }): Q =>
  ({ id: ++n, pagado: false, fecha_esperada: null, fecha_pago: null, proveedor: null, cobro_id: null, moneda: null, monto_original: null, ...o });

function estado(o: { tipo?: string | null; cierre?: number | null; mensualidad?: number | null; meses?: number | null; fechaCierre?: string | null; pagos: Q[]; cobros?: CobroParaMovimientos[]; ganado?: boolean }) {
  const cobrado = cobradoDelLead({
    ventaTipo: o.tipo ?? 'unico', montoCierreUsd: o.cierre ?? null, suscripcionMontoUsd: o.mensualidad ?? null,
    suscripcionMeses: o.meses ?? null, fechaCierre: o.fechaCierre ?? null, pagos: o.pagos, cobros: o.cobros ?? [], hoy: HOY,
  });
  return estadoDeCuenta({ cobrado, pagos: o.pagos, ganado: o.ganado ?? true, hoy: HOY });
}

test('lo vencido manda: «Debe $X» en rojo y el botón cobra la cuota vencida MÁS VIEJA', () => {
  const vieja = cuota({ numero: 1, monto_usd: 500, fecha_esperada: '2026-10-02' });
  const otra = cuota({ numero: 2, monto_usd: 500, fecha_esperada: '2026-10-10' });
  const e = estado({ cierre: 1500, pagos: [cuota({ numero: 0, monto_usd: 500, pagado: true, fecha_pago: '2026-09-02' }), otra, vieja] });
  assert.equal(e?.titular, 'Debe $1,000');
  assert.equal(e?.tono, 'rojo');
  assert.equal(e?.detalle, '2 cuotas vencidas · la primera, hace 14 días');
  assert.deepEqual(e?.accion, { tipo: 'cobrar-cuota', pagoId: vieja.id, numero: 1, montoUsd: 500, vencida: true, boton: 'Cobrar la cuota 1' });
  assert.equal(e?.barra?.texto, '$500 cobrado de $1,500');
});

test('al día: la próxima con su fecha; el botón sólo si vence en 14 días o menos', () => {
  const lejos = estado({ cierre: 1000, pagos: [cuota({ numero: 0, monto_usd: 500, pagado: true, fecha_pago: '2026-10-01' }), cuota({ numero: 1, monto_usd: 500, fecha_esperada: '2026-11-20' })] });
  assert.equal(lejos?.titular, 'Al día');
  assert.equal(lejos?.detalle, 'Próxima: $500 el 20/11');
  assert.equal(lejos?.accion, null, 'una cuota de dentro de un mes no es «qué hago ahora»');
  const cerca = estado({ cierre: 1000, pagos: [cuota({ numero: 1, monto_usd: 500, fecha_esperada: '2026-10-19' }), cuota({ numero: 2, monto_usd: 500, fecha_esperada: '2026-11-19' })] });
  assert.equal(cerca?.detalle, 'Próxima: $500 el 19/10 · en 3 días');
  assert.equal(cerca?.tono, 'ambar');
  assert.equal(cerca?.accion?.tipo, 'cobrar-cuota');
});

test('una cuota DEVUELTA no es deuda: no se cobra, no suma al pendiente y se dice «devuelta»', () => {
  const devuelta = cuota({ numero: 0, monto_usd: 1000, proveedor: 'stripe', cobro_id: 9 });
  const r = renglonDeCuota(devuelta, HOY);
  assert.equal(r.estado, 'devuelta');
  assert.equal(r.accion, 'ninguna', 'la tarjeta de antes le ponía «Marcar pagada»');
  assert.equal(r.cuando, 'devuelta por Stripe');
  const e = estado({ cierre: 1000, pagos: [devuelta] });
  assert.deepEqual([e?.titular, e?.faltaUsd, e?.accion], ['Devuelto', 0, null], 'una venta devuelta no «todavía no tiene pagos»');
});

test('el renglón: la cobrada a mano se deshace; la de la pasarela, no (se devuelve en su cobro)', () => {
  const mano = renglonDeCuota(cuota({ numero: 1, monto_usd: 300, pagado: true, fecha_pago: '2026-10-05', metodo: 'transferencia' }), HOY);
  assert.deepEqual([mano.accion, mano.cuando], ['deshacer', 'cobrada el 05/10 · transferencia']);
  const stripe = renglonDeCuota(cuota({ numero: 1, monto_usd: 300, pagado: true, fecha_pago: '2026-10-05', proveedor: 'stripe', cobro_id: 3 }), HOY);
  assert.deepEqual([stripe.accion, stripe.cuando, stripe.editable], ['ninguna', 'cobrada el 05/10 · por Stripe', false]);
  const vencida = renglonDeCuota(cuota({ numero: 2, monto_usd: 300, fecha_esperada: '2026-10-15' }), HOY);
  assert.deepEqual([vencida.estado, vencida.cuando, vencida.accion, vencida.editable], ['vencida', 'venció el 15/10 · hace 1 día', 'marcar', true]);
  const pesos = renglonDeCuota(cuota({ numero: 1, monto_usd: 50, pagado: true, fecha_pago: '2026-10-05', moneda: 'ARS', monto_original: 50000 }), HOY);
  assert.match(pesos.montoTexto, /50\.000 ARS · \$50$/, 'la moneda en que se cobró, y al lado su valor en dólares');
});

test('pago único: sin cuotas pide registrar el pago; con el plan corto, la cuota que falta; todo cobrado, «Pagó todo»', () => {
  const sin = estado({ cierre: 3000, pagos: [] });
  assert.deepEqual([sin?.titular, sin?.accion?.tipo], ['Vendido en $3,000', 'registrar-pago']);
  const corto = estado({ cierre: 3000, pagos: [cuota({ numero: 0, monto_usd: 1000, pagado: true, fecha_pago: '2026-10-01' })] });
  assert.deepEqual([corto?.titular, corto?.accion], ['Faltan $2,000', { tipo: 'agregar-cuota', faltaUsd: 2000, boton: 'Agregar la cuota' }]);
  const todo = estado({ cierre: 1000, pagos: [cuota({ numero: 0, monto_usd: 1000, pagado: true, fecha_pago: '2026-10-01' })] });
  assert.deepEqual([todo?.titular, todo?.tono, todo?.detalle, todo?.accion], ['Pagó todo', 'verde', 'Último pago el 01/10', null]);
});

test('una mensualidad no se «paga por completo»: al día con la próxima, o le falta registrar meses', () => {
  const alDia = estado({ tipo: 'suscripcion', mensualidad: 800, fechaCierre: '2026-10-05', pagos: [cuota({ numero: 1, monto_usd: 800, pagado: true, fecha_pago: '2026-10-05' })] });
  assert.deepEqual([alDia?.titular, alDia?.detalle], ['Al día', '$800/mes · próxima el 05/11']);
  const atrasada = estado({ tipo: 'suscripcion', mensualidad: 800, fechaCierre: '2026-08-05', pagos: [cuota({ numero: 1, monto_usd: 800, pagado: true, fecha_pago: '2026-08-05' })] });
  assert.deepEqual([atrasada?.titular, atrasada?.accion?.tipo], ['Falta registrar 2 meses', 'registrar-mes']);
  const nueva = estado({ tipo: 'suscripcion', mensualidad: 800, fechaCierre: '2026-10-16', pagos: [] });
  assert.deepEqual([nueva?.titular, nueva?.accion?.boton], ['Sin cobros registrados', 'Registrar el primer mes']);
});

test('se calla con un becado y con un lead abierto sin venta; un ganado sin monto pide cargarlo', () => {
  assert.equal(estado({ tipo: 'sin_cobro', pagos: [] }), null);
  assert.equal(estado({ cierre: null, pagos: [], ganado: false }), null);
  const sinMonto = estado({ cierre: null, pagos: [], ganado: true });
  assert.deepEqual([sinMonto?.titular, sinMonto?.accion?.tipo], ['Sin monto', 'cargar-venta']);
});

const cobro = (o: Partial<CobroParaMovimientos> & { id: number; estado: CobroParaMovimientos['estado'] }): CobroParaMovimientos =>
  ({ proveedor: 'stripe', tipo: 'unico', concepto: null, monto: 1000, moneda: 'USD', created_at: '2026-10-01T10:00:00Z', pagado_at: null, reembolsado_at: null, motivo: null, ...o });

test('los movimientos: un cobro pagado va una vez (por su cuota); el devuelto no desaparece; del más nuevo al más viejo', () => {
  const pagos = [
    cuota({ numero: 0, monto_usd: 1000, pagado: true, fecha_pago: '2026-10-03', proveedor: 'stripe', cobro_id: 1 }),
    cuota({ numero: 1, monto_usd: 1000, proveedor: 'stripe', cobro_id: 2 }), // devuelta
    cuota({ numero: 2, monto_usd: 200, pagado: true, fecha_pago: '2026-10-10', metodo: 'efectivo' }),
  ];
  const cobros = [
    cobro({ id: 1, estado: 'pagado', pagado_at: '2026-10-03T15:00:00Z' }),
    cobro({ id: 2, estado: 'reembolsado', pagado_at: '2026-10-04T15:00:00Z', reembolsado_at: '2026-10-08T09:00:00Z' }),
    cobro({ id: 3, estado: 'fallido', created_at: '2026-10-12T09:00:00Z', motivo: 'La tarjeta no tiene fondos.' }),
    cobro({ id: 4, estado: 'pendiente' }),
  ];
  const { movimientos, avisos } = movimientosDelLead({ pagos, cobros });
  assert.deepEqual(movimientos.map((m) => `${m.fecha} ${m.tipo} ${m.titulo} ${m.via}`), [
    '2026-10-12 rechazo Pago rechazado por Stripe',
    '2026-10-10 cobro Cuota 2 efectivo',
    '2026-10-08 devolucion Devolución por Stripe',
    '2026-10-04 cobro Pago con link por Stripe',
    '2026-10-03 cobro Cobro inicial por Stripe',
  ]);
  assert.equal(movimientos[0].detalle, 'La tarjeta no tiene fondos.', 'el motivo de un rechazo va en su renglón');
  assert.deepEqual(avisos, [], 'un rechazo común no es un aviso');
});

test('cada frase de un contracargo es un AVISO en rojo; una devolución fallida, en ámbar', () => {
  for (const fase of ['abierto', 'plata_salio', 'plata_volvio', 'cerrado', 'mp'] as const) {
    for (const pasarela of ['stripe', 'mercadopago'] as const) {
      for (const estado of [null, 'won', 'lost', 'warning_closed', 'in_process', 'otro']) {
        const t = textoContracargo({ pasarela, fase, estado });
        assert.ok(esTextoDeContracargo(t), `no reconozco «${t}»`);
        assert.equal(avisoDelCobro(t)?.tono, 'rojo');
      }
    }
  }
  assert.equal(avisoDelCobro(textoDevolucionFallida({ razon: null, sigueDevuelto: false }))?.tono, 'ambar');
  assert.equal(esTextoDeContracargo('La tarjeta no tiene fondos.'), false);
});
