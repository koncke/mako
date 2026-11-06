// =============================================================================
// La venta de un Payment Link PROPIO del negocio, de punta a punta (MAU-10, 28/10/2026)
// =============================================================================
// Mauricio vende el Sprint con un Payment Link de SU Stripe: el aviso llegaba y se ignoraba («no es un cobro de MaKo»). Ahora
// entra como un cobro externo ya pagado, con su lead, su cuota y su compra a Meta (docs/diseno-venta-externa-stripe.md §7,
// paso 4). Lo de abajo NO lee el fuente: corre `procesarEventoStripe` REAL en un node aparte (tests/_venta-externa-hijo.ts,
// `--conditions=react-server`) sobre la base, Stripe y Meta de mentira, en el ws 3. Lo que tiene que pasar:
//
//   1. LA VENTA ENTRA ENTERA: un cobro `pagado` marcado externo, con el `pi_` (o el `in_` de una suscripción), SIN la cuenta
//      principal escrita (viola `cobros_cuenta_check`), un lead (el que estaba por el email, o uno nuevo con origen «stripe»)
//      ganado, una cuota y UNA compra a Meta con `purchase:<cs_>`, al píxel y como evento de la página.
//   2. UNA VEZ: la misma venta otra vez, o dos avisos a la vez, no dejan otro cobro, otro lead, otra cuota ni otra compra.
//   3. LO QUE NO ES, NO ENTRA: con la metadata de un checkout de MaKo, en la plataforma, sin pagar o con el interruptor
//      apagado, nada se escribe. Por decidir entra en prueba y no va a Meta. Sin píxel entra y el historial lo dice.
//   4. NUNCA ESCRIBE EN EL STRIPE DEL NEGOCIO, y un cobro externo no se reembolsa ni se cancela desde MaKo.
//   5. UN CORTE A MITAD SE COMPLETA: si el aviso se corta después de reclamar la venta y antes del lead, el reintento la
//      termina (lead, cuota, compra). Antes caía por el camino de los cobros de MaKo, decía «ya estaba pagado» y la venta quedaba
//      sin lead para siempre.
//
// Probado ROMPIÉNDOLO (28/10/2026), una rotura por vez y restaurando, con este test, tests/venta-externa-no-toca-mako.test.ts
// y tests/cobros-externos-reglas.test.ts (22 pases y 0 fallos con el código como está). Rota:
//   · la puerta del webhook sin `esCobroExterno` (el reintento de una venta cortada va por MaKo)  → 20 / 2
//   · `esVentaExterna` sin el corte de la plataforma                                              → 20 / 2
//   · `esVentaExterna` sin el corte de la metadata de MaKo                                        → 20 / 2
//   · `esVentaExterna` sin exigir el Payment Link                                                 → 21 / 1
//   · `esVentaExterna` sin exigir la sesión pagada                                                → 20 / 2
//   · `esVentaExterna` sin el interruptor                                                         → 20 / 2
//   · `filaDeVentaExterna` escribe la cuenta principal (viola cobros_cuenta_check)                → 20 / 2
//   · `registrarVentaExterna` no busca al comprador por el email                                  → 21 / 1
//   · `registrarVentaExterna`: el que pierde el reclamo sigue igual (dos leads)                   → 21 / 1
//   · `reembolsarCobro` sin el corte del cobro externo                                            → 20 / 2
//   · `cancelarSuscripcionCobro` sin el corte del cobro externo                                   → 20 / 2
//   · `avisarCompraAMeta` sin mirar la marca del historial (la compra sale dos veces)             → 21 / 1
//   · `compraDeLaSesion` manda la venta de prueba a Meta                                          → 21 / 1
//   · T2 sin la guardia de quien pagó                                                             → 21 / 1
//   · `sesionExternaDe` sin pasar el email a minúsculas                                           → 20 / 2
//   · `filaDeVentaExterna`: la suscripción con el `pi_` en vez del `in_`                          → 21 / 1
// Y los arreglos de la verificación de 3ca2d8328 (28/10/2026) que son de este chat (el cruce lo arregló Planes: sus roturas están
// al pie de tests/cobro-sesion-ajena.test.ts). Con este test, venta-externa-no-toca-mako, cobros-externos-reglas y
// compra-payment-link (30 pases y 0 fallos con el código como está). Rota:
//   · el reclamo vuelve a tirar sin status (la ruta contesta 200)                                 → 29 / 1
//   · el cron sin la compra que faltó                                                             → 28 / 2
//   · el cron sin mirar si ya la intentó (una línea por pasada)                                   → 29 / 1
//   · `compraDelCobroExterno` acepta un cobro en modo prueba                                      → 29 / 1
//   · la rama de MaKo sin `sesionDelCobro` (de Planes): el cruce vuelve, y este test lo ve        → 28 / 2
//
// Correr: node --import tsx --test tests/venta-externa.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_venta-externa-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const sinNada = (x: { cobros: unknown[]; leads: unknown[]; cuotas: unknown[]; historial: unknown[] }) => {
  assert.deepEqual(x.cobros, [], 'ningún cobro');
  assert.deepEqual(x.leads, [], 'ningún lead');
  assert.deepEqual(x.cuotas, [], 'ninguna cuota');
  assert.deepEqual(x.historial, [], 'nada en el historial');
};

test('el hijo corrió entero, sin salir a la red ni escribir en Stripe', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n1', 'n2', 'n3', 'o', 'p']) {
    assert.deepEqual(R[k].red, [], `${k}: salió a la red`);
    assert.deepEqual(R[k].escriturasStripe, [], `${k}: escribió en el Stripe del negocio`);
  }
});

test('la venta de un Payment Link entra entera: cobro externo pagado, lead nuevo ganado, cuota y una compra a Meta', () => {
  const a = R.a;
  assert.match(a.r, /^procesado/);
  assert.equal(a.cobros.length, 1);
  const c = a.cobros[0];
  assert.deepEqual(
    { estado: c.estado, modo: c.modo, tipo: c.tipo, monto: c.monto, moneda: c.moneda, monto_usd: c.monto_usd, ref: c.proveedor_ref, pago: c.proveedor_pago_id, creado_por: c.creado_por, ws: c.workspace_id },
    { estado: 'pagado', modo: 'real', tipo: 'unico', monto: 270, moneda: 'USD', monto_usd: 270, ref: 'cs_live_A', pago: 'pi_live_A', creado_por: 'externo:stripe:plink_SPRINT', ws: 3 },
  );
  assert.equal(c.cuenta, null, 'la cuenta principal no se escribe (cobros_cuenta_check)');
  assert.equal(c.cuenta_ref, 'acct_NEGOCIO');
  assert.equal(c.concepto, 'Sprint 3 días');
  assert.equal(a.leads.length, 1);
  const l = a.leads[0];
  assert.deepEqual(
    { id: l.id, email: l.email, tel: l.telefono, nombre: l.nombre, origen: l.origen_lead, estado: l.estado_lead, ws: l.workspace_id },
    { id: c.lead_id, email: 'comprador@mail.test', tel: '+5491155550000', nombre: 'Ana Compradora', origen: 'stripe', estado: 'ganado', ws: 3 },
  );
  assert.equal(l.total_cobrado_usd, 270, 'lo cobrado del lead: de ahí sale la guardia «quien pagó no va a No agenda»');
  assert.deepEqual(a.cuotas, [{ lead_id: l.id, pagado: true, monto_usd: 270, cobro_id: a.cuotas[0]?.cobro_id }]);
  assert.deepEqual(a.meta, [{ pixel: '111222333', event_name: 'Purchase', event_id: 'purchase:cs_live_A', action_source: 'website', custom_data: { value: 270, currency: 'USD' } }]);
  assert.ok(a.historial.includes(`${l.id}|Meta|Meta recibió la compra (purchase:cs_live_A)`), 'la marca de la compra en el historial');
});

test('la misma venta otra vez no deja nada nuevo, ni otra compra a Meta', () => {
  assert.match(R.b.r, /^procesado/);
  assert.equal(R.b.cobros.length, 1);
  assert.equal(R.b.leads.length, 1);
  assert.equal(R.b.cuotas.length, 1);
  assert.equal(R.b.meta.length, 1, 'la compra salió una sola vez');
});

test('el comprador que ya estaba (por el email) no se duplica: la venta se ata a él y lo gana', () => {
  const c = R.c;
  assert.deepEqual(c.leads.map((l: { id: number }) => l.id), [40]);
  assert.equal(c.cobros[0].lead_id, 40);
  assert.equal(c.leads[0].estado_lead, 'ganado');
  assert.equal(c.leads[0].nombre, 'Ana de antes', 'lo cargado gana: sólo se completa lo vacío');
  assert.equal(c.leads[0].telefono, '+5491155550000', 'el teléfono vacío se completa');
  assert.equal(c.cuotas.length, 1);
  assert.equal(c.meta.length, 1);
});

test('dos avisos de la misma venta a la vez: un cobro, un lead, una cuota y una compra; el otro reintenta', () => {
  const d = R.d;
  assert.equal(d.r.filter((r: string) => r.startsWith('procesado')).length, 1);
  assert.equal(d.r.filter((r: string) => r.startsWith('tira')).length, 1, 'el que perdió el reclamo tira: Stripe reintenta');
  assert.equal(d.cobros.length, 1);
  assert.equal(d.leads.length, 1);
  assert.equal(d.cuotas.length, 1);
  assert.equal(d.meta.length, 1);
});

test('lo que no es una venta externa no escribe nada: metadata de MaKo, la plataforma, sin pagar', () => {
  assert.equal(R.e.r, 'ignorado: la sesión es de un checkout de MaKo y no tiene su cobro');
  sinNada(R.e);
  assert.deepEqual(R.e.meta, []);
  assert.equal(R.f.r, 'ignorado: en la cuenta de MaKo no se registran ventas externas');
  sinNada(R.f);
  assert.deepEqual(R.f.meta, []);
  assert.match(R.k.r, /^ignorado: .*no está pagada/);
  sinNada(R.k);
  assert.deepEqual(R.k.meta, []);
});

test('apagado (el estado de todos hasta que MaKo lo prenda): no se registra nada; la compra a Meta sale igual', () => {
  assert.match(R.i.r, /^ignorado: .*apagado en este negocio; compra enviada a Meta$/);
  sinNada(R.i);
  assert.deepEqual(R.i.meta.map((m: { event_id: string }) => m.event_id), ['purchase:cs_live_I']);
});

test('una venta de prueba entra en prueba y no va a Meta; sin píxel entra y el historial lo dice', () => {
  assert.equal(R.g.cobros[0].modo, 'prueba');
  assert.equal(R.g.cobros[0].estado, 'pagado');
  assert.deepEqual(R.g.meta, []);
  assert.match(R.g.r, /venta de prueba: no se le avisa a Meta/);
  assert.equal(R.h.cobros[0].estado, 'pagado');
  assert.equal(R.h.cuotas.length, 1);
  assert.deepEqual(R.h.meta, []);
  assert.ok(R.h.historial.some((h: string) => /\|Meta\|Meta no recibió la compra \(purchase:cs_live_H\): sin_pixel$/.test(h)));
});

test('un cobro externo no se reembolsa ni se cancela desde MaKo', () => {
  assert.deepEqual(R.j.reembolsar, { ok: false, resumen: 'Esta venta entró por un link de pago de tu Stripe: se reembolsa desde Stripe.' });
  assert.deepEqual(R.m.cancelar, { ok: false, resumen: 'Esta suscripción entró por un link de pago de tu Stripe: se cancela desde Stripe.' });
});

test('una suscripción por un Payment Link va con su factura y su sub_, y gana al lead', () => {
  const c = R.m.cobros[0];
  assert.deepEqual({ tipo: c.tipo, pago: c.proveedor_pago_id, monto_usd: c.monto_usd, estado: c.estado }, { tipo: 'suscripcion', pago: 'in_M', monto_usd: 97, estado: 'pagado' });
  assert.equal(R.m.leads[0].estado_lead, 'ganado');
  assert.equal(R.m.cuotas.length, 1);
});

test('un aviso cortado después de reclamar la venta se COMPLETA en el reintento (lead, cuota y compra)', () => {
  const l = R.l;
  assert.match(l.corte, /^503 tira: /, 'el primer aviso se cortó en la red: la ruta contesta 503 y Stripe reintenta');
  assert.deepEqual(l.trasElCorte, { cobros: 1, leads: 0, meta: 0 }, 'quedó la venta reclamada, sin lead');
  // ⚠️ El reintento ENSEGUIDA, dentro de los 2 minutos del reclamo (la verificación de 3ca2d8328): era un 200 («otro aviso la
  // está registrando») y Stripe no volvía nunca. Tiene que ser un 503, y no escribir nada.
  assert.match(l.enseguida, /^503 tira: /, 'el reintento dentro del reclamo contesta 503, no 200');
  assert.deepEqual(l.trasEnseguida, { cobros: 1, leads: 0, meta: 0 });
  assert.match(l.r, /^procesado/);
  assert.equal(l.cobros.length, 1);
  assert.equal(l.leads.length, 1, 'el reintento creó el lead');
  assert.equal(l.cobros[0].lead_id, l.leads[0].id, 'y le ató la venta');
  assert.equal(l.leads[0].estado_lead, 'ganado');
  assert.equal(l.cuotas.length, 1);
  assert.deepEqual(l.meta.map((m: { event_id: string }) => m.event_id), ['purchase:cs_live_L']);
});

test('EL CRUCE: un Payment Link con el token de un cobro de MaKo en la referencia no lo marca pagado ni fallido', () => {
  // La verificación de 3ca2d8328: una venta de US$1 por un Payment Link abierto con ?client_reference_id=<token> marcaba PAGADO
  // un cobro de MaKo de US$1.500 (cuota de 1.500, lead ganado), con el interruptor apagado o prendido. Lo arregló Planes
  // (a5f61f0c8, `sesionDelCobro`: se ignora y abre un ticket; lo fija tests/cobro-sesion-ajena.test.ts). Acá se mira de punta a
  // punta junto con la venta externa: ni el cobro de MaKo, ni una venta externa con el cobro adentro.
  for (const k of ['n1', 'n2', 'n3']) {
    assert.deepEqual(R[k].cobro77, { estado: 'pendiente', pago: null, lead41: 'abierto', cuotas41: 0 }, `${k}: tocó el cobro de MaKo`);
    assert.match(R[k].r, /^ignorado: /, k);
    assert.equal(R[k].cuotas.length, 0, `${k}: dejó una cuota`);
  }
});

test('la sesión que MaKo armó para el cobro sí lo cobra, también en otra moneda con la conversión de Stripe; por menos, no', () => {
  assert.match(R.n4.r, /^procesado/);
  assert.deepEqual(R.n4.cobro77, { estado: 'pagado', pago: 'pi_live_MAKO77', lead41: 'ganado', cuotas41: 1 });
  assert.match(R.n5.r, /^procesado/, 'pagada en MXN con currency_conversion desde USD: es la del cobro');
  assert.equal(R.n5.cobro77.estado, 'pagado');
  assert.match(R.n6.r, /^ignorado: /);
  assert.deepEqual(R.n6.cobro77, { estado: 'pendiente', pago: null, lead41: 'abierto', cuotas41: 0 });
});

test('una venta cortada en la cuota: el cron la repara y la compra a Meta sale, una sola vez', () => {
  const o = R.o;
  assert.match(o.corte, /^200 tira: /, 'un CHECK no se arregla reintentando: la ruta contesta 200 y Stripe no vuelve');
  assert.deepEqual(o.trasLaCuota, { cobros: 1, leads: 1, cuotas: 0, meta: 0 });
  assert.equal(o.trasElCron.cuotas, 1, 'el cron repara la cuota');
  // Dentro de los 10 minutos la compra la puede estar mandando el aviso: si la mandaba el cron también, salían DOS (la
  // verificación de a196d5a93; z-meta.ts R2: antes 2 envíos, ahora 1). Se deja para la vuelta siguiente. Rota (el cron sin
  // esperar al aviso): 14 / 1.
  assert.deepEqual(o.trasElCron.meta, [], 'el cron no la manda mientras el aviso puede estar trabajando');
  assert.deepEqual(o.trasElCron2.meta, ['purchase:cs_live_O'], 'pasados los 10 minutos, la compra a Meta que faltaba');
  assert.deepEqual(o.meta.map((m: { event_id: string }) => m.event_id), ['purchase:cs_live_O'], 'la pasada siguiente del cron no la repite');
  assert.equal(o.historial.filter((h: string) => /\|Meta\|/.test(h)).length, 1);
});

test('sin píxel, el cron intenta la compra UNA vez: no deja una línea por cada pasada', () => {
  const p = R.p;
  assert.deepEqual(p.meta, []);
  assert.equal(p.cuotas.length, 1);
  assert.deepEqual(p.historial.filter((h: string) => /\|Meta\|/.test(h)).map((h: string) => h.replace(/^\d+\|/, '')), ['Meta|Meta no recibió la compra (purchase:cs_live_P): sin_pixel']);
});
