// =============================================================================
// Hotmart: qué dice cada aviso para el CRM (lib/hotmart-evento.ts)
// =============================================================================
// Los cuerpos de abajo son los de un repo público, trichains/hotmart-webhooks (MIT, © 2026 Cristhian
// Almeida, src/fixtures/index.ts, bajado el 14/10/2026), que arma un ejemplo por evento «following
// the official examples» de https://developers.hotmart.com/docs/en/2.0.0/webhook/. Todos los datos
// son inventados (@example.com, documentos en cero). Se recortaron a los campos que se leen; la
// forma (dónde vive cada cosa) es la del repo.
//
// Probado rompiéndolo (14/10/2026), una rotura por vez y restaurando desde memoria:
//   · el teléfono del carrito leído de `checkout_phone` (como una compra) → 8 pasan / 1 falla;
//   · el DDD ignorado en `telefonoDeCompra` → 5 / 4 (la compra, el teléfono partido, la suscripción…);
//   · PURCHASE_COMPLETE fuera de EVENTOS_HOTMART → 8 / 1 (la misma transacción);
//   · `creaLead` siempre true → 8 / 1 (los eventos del Club sólo anotan).
// Restaurado: 9 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerEventoHotmart, lineaDelHistorial, telefonoDeCompra, EVENTOS_HOTMART, type EventoHotmart } from '../lib/hotmart-evento';

const CREATED = 1767272400000; // 2026-01-01T13:00:00.000Z

const compra = (event: string, purchase: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  creation_date: CREATED,
  event,
  version: '2.0.0',
  data: {
    product: { id: 1000001, name: 'Curso Exemplo de Marketing Digital' },
    buyer: {
      email: 'maria.exemplo@example.com',
      name: 'Maria Exemplo da Silva',
      first_name: 'Maria',
      last_name: 'Exemplo da Silva',
      checkout_phone: '999990000',
      checkout_phone_code: '11',
      address: { country: 'Brasil', country_iso: 'BR' },
    },
    purchase: {
      transaction: 'HP0000000001',
      status: 'APPROVED',
      price: { value: 97.9, currency_value: 'BRL' },
      checkout_country: { name: 'Brasil', iso: 'BR' },
      origin: { src: 'instagram', sck: 'bio' },
      ...purchase,
    },
  },
});

const ok = (r: ReturnType<typeof leerEventoHotmart>): EventoHotmart => {
  assert.ok(!('ignorado' in r), `se ignoró: ${'ignorado' in r ? r.ignorado : ''}`);
  return r as EventoHotmart;
};

test('una compra aprobada: quién, qué, cuánto y de dónde', () => {
  const e = ok(leerEventoHotmart(compra('PURCHASE_APPROVED')));
  assert.equal(e.tipo, 'compra');
  assert.equal(e.creaLead, true);
  assert.deepEqual(e.contacto, { nombre: 'Maria Exemplo da Silva', email: 'maria.exemplo@example.com', telefono: '+5511999990000' });
  assert.equal(e.producto, 'Curso Exemplo de Marketing Digital');
  assert.equal(e.transaccion, 'HP0000000001');
  assert.deepEqual(e.monto, { valor: 97.9, moneda: 'BRL' });
  assert.deepEqual(e.origen, { src: 'instagram', sck: 'bio' });
  assert.equal(lineaDelHistorial(e), 'Compró «Curso Exemplo de Marketing Digital» por 97.90 BRL (HP0000000001)');
});

test('el carrito abandonado trae el teléfono ENTERO y en otro lugar', () => {
  const e = ok(leerEventoHotmart({
    id: '00000000-0000-4000-8000-000000000011', creation_date: CREATED, event: 'PURCHASE_OUT_OF_SHOPPING_CART', version: '2.0.0',
    data: {
      affiliate: false,
      product: { id: 1000001, name: 'Curso Exemplo de Marketing Digital' },
      buyer: { name: 'Joao Exemplo', email: 'joao.exemplo@example.com', phone: '5511999990001' },
      offer: { code: 'test0001' },
      checkout_country: { name: 'Brasil', iso: 'BR' },
    },
  }));
  assert.equal(e.tipo, 'abandono');
  assert.deepEqual(e.contacto, { nombre: 'Joao Exemplo', email: 'joao.exemplo@example.com', telefono: '+5511999990001' });
  assert.equal(lineaDelHistorial(e), 'Abandonó el carrito de «Curso Exemplo de Marketing Digital» el 01/01/2026');
});

test('el APPROVED y el COMPLETE de la misma transacción arman la MISMA línea: no se anota dos veces', () => {
  const a = lineaDelHistorial(ok(leerEventoHotmart(compra('PURCHASE_APPROVED'))));
  const c = lineaDelHistorial(ok(leerEventoHotmart(compra('PURCHASE_COMPLETE', { status: 'COMPLETE' }))));
  assert.equal(a, c);
  // Y una compra DISTINTA arma otra.
  const otra = lineaDelHistorial(ok(leerEventoHotmart(compra('PURCHASE_APPROVED', { transaction: 'HP0000000099' }))));
  assert.notEqual(a, otra);
});

test('el teléfono de una compra: DDD de Brasil, código de país ya puesto, o tal cual', () => {
  assert.equal(telefonoDeCompra('999990000', '11', 'BR'), '+5511999990000');
  assert.equal(telefonoDeCompra('999990000', '11', null), '11999990000', 'sin país no se inventa el +55');
  assert.equal(telefonoDeCompra('5216641234567', '', 'MX'), '+5216641234567', 'con el código de país adentro va con +');
  assert.equal(telefonoDeCompra('6641234', '', 'MX'), '6641234');
  assert.equal(telefonoDeCompra('', '11', 'BR'), null);
});

test('la cancelación de una suscripción trae al suscriptor, con su teléfono partido', () => {
  const e = ok(leerEventoHotmart({
    id: 'x12', creation_date: CREATED, event: 'SUBSCRIPTION_CANCELLATION', version: '2.0.0',
    data: {
      product: { id: 1000002, name: 'Clube Exemplo' },
      subscriber: { code: 'SUB00002', name: 'Ana Exemplo', email: 'ana.exemplo@example.com', phone: { dddCell: '11', cell: '999990002' } },
    },
  }));
  assert.equal(e.tipo, 'suscripcion_cancelada');
  assert.equal(e.contacto.email, 'ana.exemplo@example.com');
  assert.equal(e.contacto.telefono, '11999990002');
  assert.match(lineaDelHistorial(e), /^Canceló su suscripción a «Clube Exemplo»/);
});

test('lo del área de miembros (Club) sólo ANOTA: no crea un lead por un módulo terminado', () => {
  const e = ok(leerEventoHotmart({
    id: 'x16', creation_date: CREATED, event: 'CLUB_MODULE_COMPLETED', version: '2.0.0',
    data: {
      product: { id: 1000001, name: 'Curso Exemplo de Marketing Digital' },
      user: { name: 'Maria Exemplo da Silva', email: 'maria.exemplo@example.com' },
      module: { id: 'mod0000001', name: 'Modulo 1 - Fundamentos' },
    },
  }));
  assert.equal(e.creaLead, false);
  assert.equal(lineaDelHistorial(e), 'Terminó el módulo «Modulo 1 - Fundamentos» de «Curso Exemplo de Marketing Digital»');
});

test('lo que no entra al CRM se ignora DICIENDO por qué', () => {
  const plan = leerEventoHotmart({ id: 'x13', event: 'SWITCH_PLAN', version: '2.0.0', data: {} });
  assert.ok('ignorado' in plan && /SWITCH_PLAN/.test(plan.ignorado));
  // La vista de un AFILIADO no trae comprador: no hay a quién sumar.
  const afiliado = compra('PURCHASE_APPROVED');
  delete (afiliado.data as Record<string, unknown>).buyer;
  const r = leerEventoHotmart(afiliado);
  assert.ok('ignorado' in r && /sin email ni teléfono/.test(r.ignorado));
  for (const basura of [null, 'x', [], { event: 'PURCHASE_APPROVED' }, { id: 'x', event: 'PURCHASE_APPROVED' }]) {
    assert.ok('ignorado' in leerEventoHotmart(basura), `no se ignoró ${JSON.stringify(basura)}`);
  }
});

test('un email mal formado no se guarda, y sin nombre se usa la parte de adelante del email', () => {
  const c = compra('PURCHASE_APPROVED');
  Object.assign(c.data.buyer, { email: 'no-es-un-email', name: '', first_name: '', last_name: '' });
  const e = ok(leerEventoHotmart(c));
  assert.equal(e.contacto.email, null);
  assert.equal(e.contacto.telefono, '+5511999990000', 'con teléfono igual entra');
  const sinNombre = compra('PURCHASE_APPROVED');
  Object.assign(sinNombre.data.buyer, { name: '', first_name: '', last_name: '' });
  assert.equal(ok(leerEventoHotmart(sinNombre)).contacto.nombre, 'maria.exemplo');
});

test('cada evento que entra tiene su línea del historial', () => {
  // Cada familia trae a la persona en su lugar: la suscripción en `subscriber`, el Club en `user`.
  const cuerpoDe = (evento: string) => {
    const c = compra(evento) as { data: Record<string, unknown> };
    if (EVENTOS_HOTMART[evento] === 'suscripcion_cancelada') c.data.subscriber = { name: 'Ana', email: 'ana@example.com' };
    if (EVENTOS_HOTMART[evento] === 'primer_acceso' || EVENTOS_HOTMART[evento] === 'modulo_completo') c.data.user = { name: 'Ana', email: 'ana@example.com' };
    return c;
  };
  for (const evento of Object.keys(EVENTOS_HOTMART)) {
    const e = ok(leerEventoHotmart(cuerpoDe(evento)));
    assert.ok(lineaDelHistorial(e).length > 10, `${evento} sin línea`);
  }
});
