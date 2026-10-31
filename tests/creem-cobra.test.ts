// =============================================================================
// Lo que un cobro de Creem tiene que hacer de punta a punta (31/10/2026)
// =============================================================================
// Ocho lugares donde la tercera pasarela no cobraba o cobraba mal, y ninguno daba error: el `else` de dos ramas le hablaba a
// Mercado Pago. Lo de plata corre REAL en tests/_creem-cobra-hijo.ts, sobre un Creem en memoria y con una Mercado Pago conectada
// al lado (sin ella, el bug no se ve). Lo que NO prueba: que Creem se comporte así de verdad; el doble sale de su OpenAPI.
//
// PROBADO ROMPIÉNDOLO (31/10/2026), una rotura por vez: 67 aplicadas, y las 67 las ve algún test. Base 29 / 0. Cuatro sobrevivieron
// la primera vez y forzaron a reforzarlo: entregar sin `trialing`, pedir transacciones sin el cliente, y no mirar el id ni el
// token del checkout de un reembolso (los tapaba la búsqueda por transacción). Una quinta, «cualquier link con fecha futura», acá
// no se puede ver porque el checkout de Creem tiene su propio candado: esa línea la miran tests/agencia-cobro.test.ts y
// tests/planes-stripe-afuera.test.ts.
//
// Correr: node --import tsx --test tests/creem-cobra.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CAPACIDADES_PASARELA, COMO_SE_PAGA, idDeSuscripcion, NOMBRE_PASARELA, PASARELAS } from '../lib/cobros-tipos';
import { esTextoDeContracargo, finDelPlazo, textoContracargo, tocaCerrarElPlazo } from '../lib/cobros-reglas';
import { cuentaDelCobro, cuentasValidas, proveedorDeCuenta, vinculoDelPago } from '../lib/cobro-etapa';
import { compartenHuella, huellaCreem, huellaMp, huellaStripe, partesDeHuella, transaccionQueCobra } from '../lib/prueba-plan-reglas';
import { decidirSubida } from '../lib/subir-plan-reglas';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { taparClaves } from '../lib/claves-en-el-chat';
import { motivoSinDatos } from '../lib/cobros-eventos';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_creem-cobra-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('Pasar a Pro: pasa la suscripción al producto de Pro, cobra la diferencia y sube la capa, sin tocar Mercado Pago', () => {
  assert.equal(R.subir.r.ok, true, R.subir.r.resumen);
  assert.equal(R.subir.aMp, 0, 'le habló a Mercado Pago por un cobro de Creem');
  assert.equal(R.subir.precio, 9700, 'la suscripción sigue cobrando lo de antes');
  assert.equal(R.subir.prorrateo, 'proration-charge-immediately');
  assert.equal(R.subir.capa, 'agencia');
  assert.equal(R.subir.plan, 'pro');
  assert.equal(R.subir.monto, 97);
  assert.match(R.subir.r.resumen, /Cobramos la diferencia/, 'decía «desde tu próximo cobro», lo de Mercado Pago');
  // Sale un producto mensual: sin esto se crearía uno que no renueva.
  assert.equal(R.subir.producto.billing_type, 'recurring');
});

test('Pasar a Pro: la tarjeta no pasó, o la respuesta se perdió: nunca capa sin cobro, ni dos cobros', () => {
  assert.equal(R.subirFalla.r.ok, false);
  assert.equal(R.subirFalla.capa, 'completo', 'subió la capa con el cobro rechazado');
  assert.doesNotMatch(R.subirFalla.r.resumen, /Mercado Pago/, 'culpa a una pasarela que no usa');
  assert.equal(R.subirReintento.r.ok, true, 'después de un rechazo se tiene que poder volver a intentar');
  assert.equal(R.subirReintento.capa, 'agencia');
  // Creem lo tomó y no se supo: el segundo toque termina, sin un segundo cobro.
  assert.equal(R.subirCorte.primero.ok, true, 'Creem lo tomó, y se le dijo que su plan sigue igual a quien ya pagó la diferencia');
  assert.equal(R.subirCorte.capa, 'agencia', 'pagó la diferencia y sigue sin Pro');
  assert.doesNotMatch(R.subirSinConfirmar.r.resumen, /sigue igual|tarjeta/, 'sin saber si pasó, no se afirma que no pasó');
  assert.match(R.subirSinConfirmar.r.resumen, /no se cobra otra vez/);
  assert.equal(R.subirSinConfirmar.capa, 'completo');
  assert.equal(R.subirYaEstaba.r.ok, true, R.subirYaEstaba.r.resumen);
  assert.equal(R.subirYaEstaba.upgrades, 0, 'volvió a pedirle a Creem el cambio que ya estaba: cobra la diferencia dos veces');
  assert.equal(R.subirYaEstaba.capa, 'agencia');
  assert.equal(R.subirNoActiva.upgrades, 0, 'le cambió el precio a una suscripción con la baja agendada');
  assert.equal(R.subirNoActiva.capa, 'completo');
});

test('Pasar a Pro: el anual sólo donde se cobra por año', () => {
  const planes = PLANES_MAKO_DEFAULT;
  const base = { planActual: 'esencial', planes, moneda: 'USD', montoHoy: 47, capa: 'completo' };
  const de = (proveedor: 'stripe' | 'mercadopago' | 'creem') => decidirSubida({ ...base, proveedor });
  const creem = de('creem');
  assert.equal(creem.accion, 'subir');
  assert.equal(creem.accion === 'subir' ? creem.anual : 'x', null, 'Creem cobra por mes: un anual acá armaría un precio que no existe');
  const stripe = de('stripe');
  assert.equal(stripe.accion === 'subir' ? stripe.anual != null : false, planes.find((p) => p.id === 'pro')?.precioAnualUsd != null);
});

test('La retención, 2 meses al 50%: rebaja sin cobrar nada, y vuelve al precio al cobrarse las dos cuotas', () => {
  assert.ok(R.oferta?.descuento, 'no se le ofrece');
  assert.equal(R.descuento.r.ok, true, R.descuento.r.resumen);
  assert.equal(R.descuento.aMp, 0, 'le habló a Mercado Pago');
  assert.equal(R.descuento.precio, 4850);
  assert.equal(R.descuento.prorrateo, 'proration-none', 'una rebaja no le cobra ni le devuelve nada ahora');
  assert.equal(R.descuento.marca.estado, 'aplicada');
  assert.equal(R.descuento.marca.restaurada, false, 'si queda «restaurada», pagaría a mitad para siempre');
  assert.equal(R.descuento.monto, 97, 'lo que dice el cobro es la mensualidad');
  assert.equal(R.descuentoSinCuotas.precio, 4850, 'volvió antes de cobrar las cuotas prometidas');
  assert.equal(R.descuentoVuelve.precio, 9700, 'nunca volvió al precio lleno');
  assert.equal(R.descuentoVuelve.restaurada, true);
  assert.equal(R.descuentoVuelve.prorrateo, 'proration-none');
  assert.equal(R.segundaOferta.ok, false, 'una oferta por negocio');
});

test('La retención, pausar un mes: la pasarela la ejecuta, y la reanuda el cron un día antes del fin del ciclo cubierto', () => {
  assert.equal(R.pausa.r.ok, true, R.pausa.r.resumen);
  assert.equal(R.pausa.aMp, 0);
  assert.equal(R.pausa.estado, 'paused', 'prometió no cobrar y la pasarela sigue cobrando');
  assert.equal(R.pausa.marca.restaurada, false, 'Creem no vuelve sola: marcada como restaurada, no se reanuda nunca');
  // El próximo cobro + 1 mes - 1 día: con la regla de Stripe (+2 días) cobraría justo el ciclo salteado.
  const proximo = String(R.pausa.proximo).slice(0, 10);
  const esperado = new Date(Date.parse(`${R.pausa.marca.hasta}T00:00:00Z`) - 86_400_000).toISOString();
  assert.equal(R.pausa.marca.reanudaAt, esperado);
  assert.ok(Date.parse(R.pausa.marca.reanudaAt) > Date.parse(proximo) + 20 * 86_400_000, 'reanudada antes de saltear el cobro');
  assert.equal(R.pausaAntes.estado, 'paused', 'se reanudó antes de tiempo');
  assert.equal(R.pausaDespues.estado, 'active', 'no se reanudó nunca: el cliente queda sin pagar para siempre');
  assert.equal(R.pausaDespues.restaurada, true);
  assert.equal(R.canceladaNoReanuda.resumes, 0, 'revivió una suscripción cancelada');
});

test('La retención, bajar de plan: el precio desde el próximo período, y la capa al terminar lo pagado', () => {
  assert.equal(R.bajar.r.ok, true, R.bajar.r.resumen);
  assert.equal(R.bajar.precio, 4700);
  assert.equal(R.bajar.prorrateo, 'proration-none');
  assert.equal(R.bajar.plan, 'esencial');
  assert.equal(R.bajar.capa, 'agencia', 'pagó Pro este mes: lo usa entero');
  assert.equal(R.bajar.marca.capaPendiente.capa, 'completo');
});

test('La retención no se quema: un rechazo se libera, una respuesta perdida se da por aplicada, y «no sé» no decide', () => {
  assert.equal(R.rechazada.r.ok, false);
  assert.equal(R.rechazada.estadoError, 'error');
  assert.equal(R.rechazada.marcaDespues, null, 'la marca quedó trabada: perdió su oferta para siempre');
  assert.ok(R.rechazada.oferta?.descuento, 'la oferta tiene que volver a estar');
  assert.equal(R.seCorto.marca, 'aplicada', 'Creem la tomó, y liberarla le daría una segunda oferta');
  assert.equal(R.seCorto.precio, 4850);
  assert.equal(R.sinPrecio, 'error', 'un producto sin precio a la vista no es un «no lo tomó»');
});

test('La prueba gratis se crea, entrega la cuenta al autorizarse y anota su huella', () => {
  assert.equal(R.pruebaCreada.ok, true, `/planes no puede abrir la prueba por Creem: ${R.pruebaCreada.error}`);
  assert.equal(R.pruebaCreada.dias, 7);
  assert.equal(R.pruebaCreada.aMp, 0);
  assert.equal(R.pruebaSinCompletar, null, 'entregó la cuenta sin que cargara la tarjeta');
  assert.equal(R.pruebaActivada.act, 'activada', 'le preguntó a Mercado Pago, y la tarjeta quedó cargada sin cuenta');
  assert.equal(R.pruebaActivada.aMp, 0);
  assert.equal(R.pruebaActivada.estado, 'pendiente', 'una prueba no es un pago');
  assert.equal(R.pruebaActivada.sus, 'activa');
  assert.equal(R.pruebaActivada.susId, 'sub_prueba_1');
  assert.equal(R.pruebaActivada.huella, 'cr:cu_repite|card:-');
  assert.equal(R.pruebaActivada.inicio, true, 'el aviso de 2 días antes lee este día');
  assert.equal(R.pruebaActivada.alta, 'hecha');
  assert.equal(R.pruebaActivada.altaWs, true);
  // Sólo una suscripción en `trialing` y de ESTE cobro entrega la cuenta.
  for (const caso of ['pruebaCancelada', 'pruebaActivaYa', 'pruebaDeOtroCobro']) {
    assert.equal(R[caso].act, null, `${caso}: entregó la cuenta`);
    assert.equal(R[caso].altaWs, null, `${caso}: abrió una cuenta`);
  }
  // Y lo que no sabe hacer sigue dicho: sólo la prueba puede llevar fecha futura.
  assert.equal(R.fechaFuturaSinPrueba.ok, false);
});

test('La prueba repetida: el mismo cliente se corta sin cobrar; otra tarjeta no se puede distinguir, y queda escrito', () => {
  assert.equal(R.pruebaRepetida.act, 'rechazada');
  assert.equal(R.pruebaRepetida.estado, 'anulado');
  assert.equal(R.pruebaRepetida.enCreem, 'canceled', 'anulada en MaKo y viva en Creem: el día 8 cobra');
  assert.equal(R.pruebaRepetida.altaWs, null, 'le dio otra cuenta');
  // ⚠️ El límite de Creem, a propósito en un test: si un día expone la tarjeta, esto avisa que hay que usarla.
  assert.equal(R.pruebaOtroCliente, 'activada');
  assert.equal(CAPACIDADES_PASARELA.creem.huellaDeTarjeta, false);
  // Las huellas conviven: la de Creem se compara con la de Creem, y no se cruza con las otras por casualidad.
  const h = huellaCreem('cu_1');
  assert.deepEqual(partesDeHuella(h), { cuenta: 'cu_1', tarjeta: null });
  assert.ok(compartenHuella(h, huellaCreem('cu_1')));
  assert.ok(!compartenHuella(h, huellaCreem('cu_2')));
  assert.ok(!compartenHuella(h, huellaStripe('abc')));
  assert.ok(!compartenHuella(h, huellaMp({ pagadorId: 'otro', tarjetaId: 't' })));
  assert.equal(huellaCreem(null), null);
  assert.equal(huellaCreem('con espacio'), null, 'esto va a un filtro de PostgREST');
});

test('El cobro del día 8 que se rechaza no saca a la prueba de su plan: mora, y se puede dar de baja', () => {
  assert.equal(R.pruebaDia8.estado, 'pendiente', 'en `fallido` queda sin plan, sin deuda y sin corte');
  assert.equal(R.pruebaDia8.tienePlan, true, '«Tu plan no se cobra por la pasarela», y sin baja');
  assert.equal(R.pruebaDia8.baja, true);
  assert.equal(R.pruebaDia8.enCreem, 'canceled', 'Creem le sigue reintentando con la tarjeta guardada');
});

test('Una transacción en cero no es el primer cobro de una prueba', () => {
  const prueba = { tipo: 'suscripcion', alta_capa: 'agencia', creado_por: 'planes:pro:prueba' };
  const plan = { tipo: 'suscripcion', alta_capa: 'agencia', creado_por: 'planes:pro' };
  assert.equal(transaccionQueCobra(prueba, { estado: 'paid', monto: 0 }), false, 'pasaría la prueba a pagada sin plata');
  assert.equal(transaccionQueCobra(prueba, { estado: 'paid', monto: 9700 }), true);
  assert.equal(transaccionQueCobra(prueba, { estado: 'pending', monto: 9700 }), false);
  assert.equal(transaccionQueCobra(plan, { estado: 'paid', monto: 0 }), true, 'fuera de la prueba se asienta lo que hay');
});

test('El plazo: se agenda en el último ciclo pagado, no antes, no dos veces, y un aviso perdido no agrega un mes', () => {
  assert.equal(R.plazoPrimerMes.estado, 'active', 'cortó una suscripción de 6 meses en el primero');
  assert.equal(R.plazoPrimerMes.cancels, 0);
  assert.equal(R.plazoUltimoMes.estado, 'scheduled_cancel', 'el séptimo mes se cobraría');
  assert.equal(R.plazoUltimoMes.modo, 'scheduled', 'cortada en el acto, se queda sin el mes que pagó');
  assert.equal(R.plazoNoRepite, 0);
  assert.equal(R.plazoDeUnMes, 'scheduled_cancel');
  assert.equal(R.sinPlazo.estado, 'active', 'cortó una suscripción sin plazo');
  assert.equal(R.sinPlazo.cancels, 0);
  assert.match(R.plazoFallaMotivo, /cancélala a mano/, 'si no se pudo agendar, nadie se entera');
  assert.equal(R.plazoRed.estado, 'scheduled_cancel', 'la red del día no terminó lo que faltó');
  assert.equal(R.plazoRed.motivo, null, 'sigue diciendo «cancélala a mano» algo que ya quedó');
  assert.equal(R.plazoAvisoPerdido.antes, 'active');
  assert.equal(R.plazoAvisoPerdido.despues, 'scheduled_cancel');
});

test('tocaCerrarElPlazo: por fechas, con margen, y sólo sobre una activa', () => {
  const inicio = Date.UTC(2026, 0, 31, 12);
  const periodo = (m: number, dias = 0) => new Date(finDelPlazo(inicio, m) + dias * 86_400_000).toISOString();
  const toca = (finDelPeriodo: string | null, estado = 'active', meses = 6) => tocaCerrarElPlazo({ inicioMs: inicio, meses, finDelPeriodo, estado });
  assert.equal(toca(periodo(5)), false, 'el quinto período no es el último de seis');
  assert.equal(toca(periodo(6)), true);
  assert.equal(toca(periodo(6, -2)), true, 'un ciclo que cae dos días antes es el mismo');
  assert.equal(toca(periodo(5, 20)), false, 'el margen no se come un mes');
  assert.equal(toca(periodo(6), 'scheduled_cancel'), false, 'ya está agendada');
  assert.equal(toca(periodo(6), 'trialing'), false);
  assert.equal(toca(null), false, 'sin fecha no se corta nada');
  assert.equal(tocaCerrarElPlazo({ inicioMs: NaN, meses: 6, finDelPeriodo: periodo(6), estado: 'active' }), false);
});

test('La plata de un aviso: en unidades, no en centavos, y sólo la de esta suscripción', () => {
  assert.equal(R.renovacion.r.estado, 'procesado', JSON.stringify(R.renovacion.r));
  assert.equal(R.renovacion.nCuotas, 1, 'la renovación no entró');
  assert.equal(Number(R.renovacion.usd), 47, 'una renovación de US$47 entra al cash como US$4.700');
  assert.equal(R.renovacion.ajenas, 0, 'le asentó a este cobro la plata de otra suscripción');
  // `created_at` de una transacción es un NÚMERO: leído como texto, la cuota llevaba la fecha de hoy.
  assert.ok(R.renovacion.fecha && R.renovacion.fecha < R.renovacion.hoy, `la cuota no lleva la fecha del pago: ${R.renovacion.fecha}, hoy ${R.renovacion.hoy}`);
  assert.equal(R.laQueDiceLaSuscripcion, 1, 'la suscripción dice cuál se pagó, y se eligió otra por la fecha');
  assert.deepEqual(R.paginaDos, ['tran_p2'], 'la de la página 2 de ese cliente no existe para MaKo: un pago sin asentar');
  assert.equal(R.paginasTope, false, 'mirar sólo una parte se lee como «no pagó»');
  // Sin el filtro por cliente vuelven las de toda la tienda de a 100, y las de este cobro pueden no estar: no asentaría nada.
  assert.ok(R.pedidoPorCliente.pedidos.length > 0 && R.pedidoPorCliente.pedidos.every((c: string | null) => c === R.pedidoPorCliente.cliente), 'se pidieron sin decir de qué cliente');
});

test('Un reembolso devuelve lo que se devolvió, de la transacción que se devolvió', () => {
  assert.equal(R.reembolsoParcial.r.estado, 'procesado', JSON.stringify(R.reembolsoParcial.r));
  assert.equal(R.reembolsoParcial.estado, 'pagado', 'US$5 devueltos de una renovación dejan el plan «reembolsado»');
  assert.equal(R.reembolsoParcial.pagada, true, 'un parcial no desmarca la cuota');
  assert.equal(R.reembolsoRenovacion.estado, 'pagado', 'devolver una renovación no devuelve el primer pago');
  assert.equal(R.reembolsoRenovacion.devuelta, false, 'la cuota devuelta sigue contada como cobrada');
  assert.equal(R.reembolsoAjeno.estado, 'ignorado', 'tocó este cobro por la transacción de otro');
  assert.equal(R.reembolsoSinAsentar, 'tiró', 'una transacción que sigue pagada: Creem reintenta, no se registra');
  assert.equal(R.reembolsoUnico.r.estado, 'procesado', `no encontró el cobro del pago único: ${JSON.stringify(R.reembolsoUnico.r)}`);
  assert.equal(R.reembolsoUnico.estado, 'reembolsado');
});

test('Una disputa de un pago único encuentra su cobro, aunque sólo traiga la transacción', () => {
  assert.equal(R.disputaUnico.r.estado, 'procesado', JSON.stringify(R.disputaUnico.r));
  assert.ok(esTextoDeContracargo(R.disputaUnico.motivo), 'una disputa que nadie ve se pierde por defecto');
  assert.equal(R.disputaSoloTransaccion.r.estado, 'procesado', JSON.stringify(R.disputaSoloTransaccion.r));
  assert.ok(esTextoDeContracargo(R.disputaSoloTransaccion.motivo));
  // Cada camino por sí solo: la transacción no alcanza si el aviso del pago se perdió.
  assert.equal(R.disputaSoloCheckout.r.estado, 'procesado', `el id del checkout no encontró su cobro: ${JSON.stringify(R.disputaSoloCheckout.r)}`);
  assert.equal(R.disputaSoloToken.r.estado, 'procesado', `el token del checkout no encontró su cobro: ${JSON.stringify(R.disputaSoloToken.r)}`);
});

test('Un link anulado de Creem: cancelar con el checkout no corta nada, y si se paga igual no sigue cobrando', () => {
  assert.deepEqual(R.anularSinPagar.cancels, [], 'le pidió cancelar una suscripción con el id de un checkout');
  assert.equal(R.anularSinPagar.estado, 'anulado');
  assert.equal(R.anuladoPagado.enCreem, 'canceled', 'pagó un link anulado y Creem le cobra todos los meses');
  assert.equal(R.anularYaCompleto, 'canceled', 'la suscripción del checkout ya completo quedó viva');
});

test('Conectar Creem deja el aviso con su id: si no, todos los pagos rebotan con 401 y nunca entra uno', () => {
  assert.equal(R.conectar.ok, true);
  assert.equal(R.conectar.url, `https://mako.test/api/webhooks/creem?w=${R.conectar.id}`, 'la URL guardada en Creem no lleva su id');
  assert.equal(R.conectar.status, 200, 'un aviso bien firmado, a la URL que MaKo registró, se rechaza');
  assert.equal(R.conectar.statusSinW, 401, 'sin el id no se sabe de quién es: fail-closed');
  assert.equal(R.reparaLaVieja.ok, true);
  assert.match(R.reparaLaVieja.url, /\?w=wh_viejo$/, 'una ya registrada sin id no se repara');
  assert.equal(R.sinPatchNoConecta, false, 'sin poder escribir el id se conectaría una cuenta cuyos avisos rebotan todos');
});

test('Desconectar no pide borrar el aviso: su id es la identidad de la cuenta en sus cobros', () => {
  const s = fuente('lib/cobros-conexion.ts');
  assert.doesNotMatch(s, /Quita el aviso de MaKo en Creem/, 'borrado, al reconectar nace otro id y las suscripciones quedan huérfanas');
});

test('Una clave de Creem no llega al modelo ni se guarda en un motivo', () => {
  const t = taparClaves('mi clave es creem_6DaBxY12abcDEF34xyz, y la de prueba creem_test_9aB8cD7eF6');
  assert.equal(t.tapadas, 2);
  assert.doesNotMatch(t.texto, /6DaBxY12|9aB8cD7e/);
  assert.equal(taparClaves('la etiqueta creem_webhook_pendiente_de_revisar').tapadas, 0, 'una etiqueta del negocio no es una clave');
  assert.doesNotMatch(motivoSinDatos('Falló con creem_6DaBxY12abcDEF34xyz'), /6DaBxY12/);
});

test('Antes de cortar por impago se le pregunta a SU pasarela', () => {
  assert.equal(R.impagoPagoPerdido.aMp, 0, 'le preguntó a Mercado Pago si pagó un cliente de Creem');
  assert.equal(R.impagoPagoPerdido.r, 'pagado', 'le corta el acceso a alguien que pagó');
  assert.equal(R.impagoPagoPerdido.asentada, 1, 'lo que faltaba no se asentó');
  assert.equal(R.impagoDeVerdad, 'impago');
  assert.equal(R.impagoSinRespuesta, 'no-se-sabe', 'una pasarela que no contesta no es un impago');
  assert.equal(R.moraViva.cobrosNuevos, 0, 'abrió un cobro aparte mientras Creem reintenta: son dos cobros');
  assert.equal(R.moraViva.r.url, `https://creem.io/portal/${R.moraViva.cliente}`, `quien debe no tiene dónde cambiar la tarjeta: ${JSON.stringify(R.moraViva.r)}`);
  assert.match(R.moraSinPortal.texto ?? '', /en proceso/);
  assert.equal(R.moraCancelada.cobrosNuevos, 1, 'Creem ya la canceló: sin el cobro aparte no hay cómo pagar');
});

test('La baja del plan: Creem sigue hasta el fin de lo pagado, y la base no dice «cancelada» antes de tiempo', () => {
  assert.equal(R.baja.ok, true);
  assert.equal(R.baja.aMp, 0);
  assert.equal(R.baja.modo, 'scheduled', 'cortada en el acto, pierde lo que ya pagó');
  assert.equal(R.baja.enCreem, 'scheduled_cancel');
  assert.equal(R.baja.finEsElDelPeriodo, true, 'la pantalla no sabría decirle hasta cuándo');
  assert.equal(R.baja.enBase, 'activa', 'la cancela el aviso de Creem, cuando pasa de verdad');
});

test('Vincular cobro: una cuenta de Creem es una cuenta, y el vínculo la guarda', () => {
  assert.equal(proveedorDeCuenta('creem:principal'), 'creem');
  assert.equal(proveedorDeCuenta('creem:c2'), 'creem');
  assert.equal(proveedorDeCuenta('paypal:principal'), null);
  const cuentas = [{ id: 'creem:principal', proveedor: 'creem' as const, nombre: 'Creem', principal: true }];
  assert.deepEqual(cuentasValidas(['creem:principal', 'paypal:principal'], cuentas), ['creem:principal'], 'se guardaba SIN la cuenta');
  // Y lo que importa: el pago encuentra el vínculo, que es lo que lo pasa a Ganado.
  const c = { producto_id: 7, pago_id: null, proveedor: 'creem' as const, cuenta: null };
  assert.equal(cuentaDelCobro(c), 'creem:principal');
  const v = vinculoDelPago(c, [{ id: 1, funnelId: 2, etapa: 'ganado', productoId: 7, cuentas: cuentasValidas(['creem:principal'], cuentas) }], { renovacion: false });
  assert.equal(v?.funnelId, 2, 'el cobro entra y el lead no pasa a Ganado');
});

test('Un contracargo de cualquier pasarela, en cualquier fase, es un aviso', () => {
  for (const pasarela of PASARELAS) {
    for (const fase of ['abierto', 'plata_salio', 'plata_volvio', 'cerrado', 'mp'] as const) {
      const texto = textoContracargo({ pasarela, fase, estado: fase === 'cerrado' ? 'lost' : null });
      assert.ok(esTextoDeContracargo(texto), `${pasarela}/${fase} se dibuja en letra chica: «${texto}»`);
    }
  }
  assert.ok(!esTextoDeContracargo('Creem: past_due'), 'un rechazo no es una disputa');
  assert.ok(!esTextoDeContracargo(null));
});

test('Toda decisión por pasarela está en la tabla, completa, y lo que se le dice al cliente también', () => {
  assert.equal(idDeSuscripcion({ proveedor: 'mercadopago', proveedor_suscripcion_id: null, proveedor_ref: 'pre_1' }), 'pre_1', 'en MP el ref es la suscripción');
  assert.equal(idDeSuscripcion({ proveedor: 'creem', proveedor_suscripcion_id: null, proveedor_ref: 'ch_1' }), null, 'en Creem el ref es el checkout: pedirle algo da 404');
  assert.equal(idDeSuscripcion({ proveedor: 'stripe', proveedor_suscripcion_id: null, proveedor_ref: 'cs_1' }), null);
  assert.equal(idDeSuscripcion({ proveedor: 'creem', proveedor_suscripcion_id: 'sub_1', proveedor_ref: 'ch_1' }), 'sub_1');
  assert.equal(CAPACIDADES_PASARELA.creem.ofertaVuelveSola, false);
  assert.equal(CAPACIDADES_PASARELA.mercadopago.ofertaVuelveSola, false);
  assert.equal(CAPACIDADES_PASARELA.stripe.ofertaVuelveSola, true);
  assert.equal(CAPACIDADES_PASARELA.creem.subidaCobraLaDiferencia, true);
  assert.equal(CAPACIDADES_PASARELA.mercadopago.subidaCobraLaDiferencia, false);
  for (const p of PASARELAS) {
    assert.ok(NOMBRE_PASARELA[p]);
    assert.ok(COMO_SE_PAGA[p], `«Tu plan» no sabe decir cómo paga ${p}`);
  }
  assert.doesNotMatch(COMO_SE_PAGA.creem, /Mercado Pago/);
});

// ── La ficha necesita sesión para correr entera: lo que CUIDA se mira en el fuente, por lo que no puede volver ──

const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function* archivos(dir: string): Generator<string> {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) { if (n !== 'node_modules' && n !== '_opencut') yield* archivos(rel); }
    else if (/\.tsx?$/.test(n)) yield rel;
  }
}

test('Nadie lista dos pasarelas a mano: un literal es asignable a `Pasarela[]` y el compilador no lo ve', () => {
  const malos: string[] = [];
  for (const dir of ['app', 'lib']) {
    for (const f of archivos(dir)) {
      const s = fuente(f);
      if (/\[\s*'stripe'\s*,\s*'mercadopago'\s*\]|\[\s*'mercadopago'\s*,\s*'stripe'\s*\]/.test(s)) malos.push(f);
      if (/===\s*'stripe'\s*\|\|\s*\w+\s*===\s*'mercadopago'/.test(s)) malos.push(`${f} (dos comparaciones)`);
    }
  }
  assert.deepEqual(malos, [], 'una lista de dos descarta a la tercera pasarela en silencio');
});

test('La ficha le ofrece Creem a quien lo tiene conectado, y su moneda no sale de su Mercado Pago', () => {
  const s = fuente('app/crm/[id]/cobros-actions.ts');
  const opciones = s.slice(s.indexOf('export async function opcionesCobroAction('), s.indexOf('export type MonedasCobro'));
  assert.match(opciones, /pasarelas: PASARELAS\.filter\(/, 'las pasarelas de «¿Con qué cobras?» tienen que salir de la tabla');
  const monedas = s.slice(s.indexOf('export async function monedasCobroAction('), s.indexOf('function visible('));
  assert.match(monedas, /case 'creem':[^\n]*monedaFija/, 'a una cuenta de Creem se le leía la moneda de la Mercado Pago del negocio');
  assert.match(monedas, /const _x: never = c\.proveedor/, 'sin el `never`, la cuarta pasarela vuelve a caer al último caso');
});

test('La clave de un negocio en Creem no sale hacia la API de otra pasarela', () => {
  const s = fuente('app/api/integraciones/cuentas/route.ts');
  const f = s.slice(s.indexOf('async function idEnElProveedor('), s.indexOf('export async function POST('));
  assert.match(f, /case 'creem': return null;/);
  assert.doesNotMatch(f, /\?\s*await leerCuentaStripe/, 'con un ternario, la clave de Creem se la lleva leerCuentaMp');
});

test('La red del plazo corre una vez por día, por negocio', () => {
  const s = fuente('app/api/cron/cobros-reconciliar/route.ts');
  assert.match(s, /if \(delDia\) await runWithWorkspace\(ws, \(\) => asegurarPlazosCreem\(ws\)\)/);
});
