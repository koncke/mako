// =============================================================================
// El WhatsApp en el checkout de /planes (31/10/2026, Martín: «que le pida también el whatsapp»)
// =============================================================================
// Lo que se cuida: se pide con su código de país y no frena el pago; llega a la ficha sin pisar lo cargado; el mismo número en la ficha de
// otra persona no pierde la venta ni escribe sobre ella; y llega a la cuenta nueva sin que nada le escriba. Corre con el código real sobre una
// base y un Stripe de mentira (tests/_whatsapp-checkout-hijo.ts).
//
// Probado rompiéndolo: al pie del archivo.
// Correr: node --import tsx --test tests/whatsapp-checkout.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIAL_DEFAULT, ladaDelPais, telefonoDeFormulario } from '../lib/paises';
import { leerPedidoCompra, TEXTO_WHATSAPP_MAL } from '../lib/compra-plan-reglas';
import { whatsappDelPago } from '../lib/origen-cuenta';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_whatsapp-checkout-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el formulario lo pide junto al email, con su código, y no es obligatorio', () => {
  const f = fuente('app/planes/[plan]/CompraPlan.tsx');
  const email = f.indexOf('id="cp-email"');
  const tel = f.indexOf('<TelefonoConPais');
  assert.ok(email > 0 && tel > email && tel < f.indexOf('planes-trampa'), 'va después del email y antes del resto');
  assert.doesNotMatch(f.slice(tel, f.indexOf('/>', tel)), /required/, 'un campo no pierde la venta');
  assert.match(f, /whatsapp: telefonoDeFormulario\(lada, numero\)/);
  assert.match(fuente('app/planes/[plan]/page.tsx'), /ladaInicial=\{ladaDelPais\(pais\)\}/, 'arranca con el país de quien compra');
});

test('la lada del país y lo que manda el formulario', () => {
  assert.equal(ladaDelPais('AR'), '+54');
  assert.equal(ladaDelPais('MX'), '+52');
  assert.equal(ladaDelPais(null), DIAL_DEFAULT);
  assert.equal(ladaDelPais('ZZ'), DIAL_DEFAULT);
  assert.equal(telefonoDeFormulario('+54', ''), '', 'la lada sola no es un número');
  assert.equal(telefonoDeFormulario('+54', '  - '), '');
  assert.equal(telefonoDeFormulario('+54', '9 11 2233-4455'), '5491122334455');
  assert.equal(telefonoDeFormulario('+54', '011 2233-4455'), '541122334455', 'sin el 0 de larga distancia');
  assert.equal(telefonoDeFormulario('+52', '+999 123456'), '999123456', 'un + que el selector no reconoció ya trae su país');
});

test('la regla: vacío sigue, algo que no puede ser un número se dice; en el pedido sin pasarela sigue siendo obligatorio', () => {
  const b = { plan: 'pro', nombre: 'Ana', email: 'a@x.com' };
  const leer = (extra: object) => {
    const r = leerPedidoCompra({ ...b, ...extra });
    assert.equal(r.ok, true);
    return (r as { ok: true; pedido: { whatsapp: string | null; whatsappEscritoMal?: boolean } }).pedido;
  };
  assert.deepEqual([leer({}).whatsapp, leer({}).whatsappEscritoMal], [null, false]);
  assert.deepEqual([leer({ whatsapp: '' }).whatsapp, leer({ whatsapp: '  ' }).whatsappEscritoMal], [null, false]);
  assert.deepEqual([leer({ whatsapp: '5412' }).whatsapp, leer({ whatsapp: '5412' }).whatsappEscritoMal], [null, true]);
  assert.equal(leer({ whatsapp: '5491122334455' }).whatsapp, '5491122334455');
  assert.equal(leerPedidoCompra({ ...b, quiero: true }).ok, false);
});

test('con número, a su ficha nueva y al cobro de esta compra', () => {
  assert.deepEqual(R.nuevo, { status: 200, link: true, campo: null, error: null });
  assert.deepEqual(R.nuevoLead, { telefono: '+5491122334455', norm: '5491122334455' });
  assert.equal(R.nuevoOrigen.whatsapp, '5491122334455');
});

test('sin número, compra igual', () => {
  assert.equal(R.sinNumero.link, true);
  assert.equal(R.sinNumeroLead, null);
  assert.equal(R.sinCampo.link, true, 'una pestaña vieja, sin el campo');
});

test('mal escrito se le dice en el campo y no se crea nada; vacío, sigue', () => {
  assert.deepEqual(R.mal, { status: 400, link: false, campo: 'whatsapp', error: TEXTO_WHATSAPP_MAL });
  assert.equal(R.malNoCreo, true);
  assert.equal(R.malSigue.link, true);
});

test('una ficha por su email: se completa si está vacía, nunca se pisa', () => {
  assert.equal(R.vacia.link, true);
  assert.deepEqual(R.vaciaLead, { telefono: '+5215512345678', norm: '5215512345678' });
  assert.equal(R.vaciaHistorial, 1, 'queda en su historial');
  assert.equal(R.conOtro.link, true);
  assert.equal(R.conOtroLead, '+5215500000001');
  assert.match(R.conOtroNotas.join(), /\+5215599999999/, 'lo que dejó no se pierde');
  assert.equal(R.igual.link, true);
  assert.deepEqual(R.igualNotas, [], 'el mismo número no se anota');
});

test('el mismo número en la ficha de otra persona: no pierde la venta ni escribe sobre ella', () => {
  assert.deepEqual(R.otraPersona, { status: 200, link: true, campo: null, error: null });
  assert.deepEqual(R.otraPersonaLead, { nueva: true, tel: '+5215577777777', cobroEnLaNueva: true });
  assert.match(R.otraPersonaNotas.join(), /también está en la ficha 13/);
  assert.deepEqual(R.otraPersonaIntacta, { email: 'laotra@ejemplo.com', cliente_ws: 500, estado: 'abierto' });
  assert.deepEqual(R.otraPersonaAlta, { estado: 'hecha', delPago: '5215577777777' });
});

test('el mismo número y la ficha sin email: es la misma persona', () => {
  assert.equal(R.delChat.link, true);
  assert.deepEqual(R.delChatLead, { email: 'delchat@ejemplo.com', cobro: 14 });
});

test('el pedido sin pasarela no pierde el pedido por lo mismo', () => {
  assert.equal(R.quiero.status, 200);
  assert.equal(R.quieroLead, true);
});

test('al pagar, el número llega a la cuenta nueva y no se le escribe a nadie', () => {
  assert.deepEqual(R.altaConNumero, { estado: 'hecha', delPago: '5491122334455' });
  assert.deepEqual(R.altaSinNumero, { estado: 'hecha', delPago: null }, 'sin número no hay clave');
  assert.equal(R.altaDeLaFicha, '5215544444444', 'dejó el campo vacío: el de su ficha');
  assert.deepEqual(R.altaElQueEscribio, { ficha: '+5215500000001', delPago: '5215599999999' }, 'gana el de esta compra');
  assert.equal(R.reintento, '5491122334455', 'un reintento no lo cambia');
  assert.deepEqual(R.otrosHosts, []);
});

test('whatsappDelPago: lo que no puede ser un número no llega al onboarding', () => {
  assert.equal(whatsappDelPago({ whatsapp: '5491122334455' }, '5215500000000'), '5491122334455');
  assert.equal(whatsappDelPago({ landing: 'x' }, '+52 155 0000 0000'), '5215500000000');
  assert.equal(whatsappDelPago(null, null), null);
  assert.equal(whatsappDelPago({ whatsapp: '123' }, '999'), null);
  assert.equal(whatsappDelPago('texto', 5491122334455), null);
});

// Roturas (31/10/2026; base 12 / 0), cada una restaurada (pasan / fallan; 0 / 1 = el hijo no pudo seguir el recorrido):
//   · el lead nace sin el número                       -> 9 / 3
//   · una ficha por email no se completa               -> 11 / 1
//   · se pisa el número de la ficha                    -> 10 / 2
//   · otro número se pierde sin nota                   -> 11 / 1
//   · el mismo número se anota igual                   -> 11 / 1
//   · la compra se ata a la ficha de otra persona      -> 10 / 2
//   · la nueva no dice que el número está en otra      -> 11 / 1
//   · un número mal escrito pasa callado               -> 11 / 1
//   · vacío frena la compra                            -> 0 / 1
//   · el pedido sin pasarela deja de pedirlo           -> 11 / 1
//   · el cobro no guarda el número de esta compra      -> 10 / 2
//   · el alta no lo pasa a la cuenta                   -> 10 / 2
//   · gana la ficha sobre lo que escribió              -> 10 / 2
//   · un reintento pisa el número                      -> 11 / 1
//   · la lada sola cuenta como número                  -> 11 / 1
//   · queda el 0 de larga distancia                    -> 11 / 1
//   · el campo pasa a obligatorio                      -> 11 / 1
//   · el formulario no manda el número                 -> 11 / 1
//   · arranca siempre con el país por defecto          -> 11 / 1
// Sobrevive acá «ni con la ficha sin email se reconoce» (12 / 0): con UN parecido entra por la regla del nombre y da lo mismo. Lo ve
// tests/compra-plan-lead.test.ts, que pasa dos parecidos.
// Lo que NO corre acá: Mercado Pago y Stripe de verdad, y la pantalla en producción (se miró en un banco, con la regla real y la ruta simulada).
