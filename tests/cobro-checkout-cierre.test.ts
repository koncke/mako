// =============================================================================
// crearCobro después de la pasarela: ni un cobro sin link ni un link sin su fila (lib/cobros-reglas.ts `cerrarCheckoutDelCobro`)
// =============================================================================
// crearCobro escribe la FILA, llama a la pasarela y recién ahí guarda el link. `actualizar` TIRA ante un error de la base, así que
// antes (medido el 23/10/2026, a pedido del Cerebro por la revisión de vender_plan_mako):
//   · pasarela rechaza + la base falla al anular → crearCobro TIRABA en vez de decir el motivo, y la fila quedaba `pendiente`
//     sin link. En el link de una CUOTA ese pendiente es «el link vivo»: se devolvía como si anduviera (en Mercado Pago, muerto);
//   · pasarela crea el checkout + la base falla al guardar el link → tiraba, el checkout quedaba creado y su ref perdido: si
//     alguien lo pagaba, nada lo reconocía.
// Acá se EJECUTA la función con las escrituras inyectadas. Lo de la forma de crearCobro (que la use y no escriba el anulado a mano) se
// lee del fuente: lib/cobros.ts es server-only.
// Probado ROMPIÉNDOLO (23/10/2026): ver el pie.
// Correr: node --import tsx --test tests/cobro-checkout-cierre.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cerrarCheckoutDelCobro, type CheckoutCreado } from '../lib/cobros-reglas';
import { PASARELAS, type Pasarela } from '../lib/cobros-tipos';

const BIEN: CheckoutCreado = { ok: true, ref: 'cs_123', url: 'https://checkout.stripe.com/c/pay/cs_123', venceAt: '2026-10-24T10:00:00Z' };
const MAL: CheckoutCreado = { ok: false, error: 'Stripe respondió 402' };

/** Una "base" que anota lo que se le escribe y puede fallar las veces que se le diga. */
function base(fallasAlGuardar = 0, fallaAlAnular = false) {
  const log: string[] = [];
  const avisos: string[] = [];
  let guardadas = 0;
  return {
    log, avisos,
    args: {
      guardar: async (r: { ref: string; url: string }) => {
        guardadas++;
        if (guardadas <= fallasAlGuardar) throw new Error('No pude actualizar el cobro 7: connection reset');
        log.push(`guardado ${r.ref}`);
        return { id: 7, ref: r.ref };
      },
      anular: async (a: { motivo: string; ref?: string; url?: string }) => {
        if (fallaAlAnular) throw new Error('No pude actualizar el cobro 7: connection reset');
        log.push(`anulado ref=${a.ref ?? '-'} url=${a.url ? 'si' : '-'} «${a.motivo}»`);
      },
      aviso: (m: string) => avisos.push(m),
    },
  };
}

test('todo bien: se guarda el link y no se anula nada', async () => {
  const b = base();
  const r = await cerrarCheckoutDelCobro({ checkout: BIEN, ...b.args });
  assert.deepEqual(r, { ok: true, guardado: { id: 7, ref: 'cs_123' } });
  assert.deepEqual(b.log, ['guardado cs_123']);
});

test('la pasarela rechaza: la fila se anula con el motivo y se devuelve el error de la pasarela', async () => {
  const b = base();
  const r = await cerrarCheckoutDelCobro({ checkout: MAL, ...b.args });
  assert.deepEqual(r, { ok: false, error: 'Stripe respondió 402', deLaPasarela: true });
  assert.deepEqual(b.log, ['anulado ref=- url=- «Stripe respondió 402»']);
});

test('⚠️ la pasarela rechaza Y la base falla al anular: NO tira, devuelve el motivo de la pasarela y lo loguea', async () => {
  const b = base(0, true);
  const r = await cerrarCheckoutDelCobro({ checkout: MAL, ...b.args });
  assert.deepEqual(r, { ok: false, error: 'Stripe respondió 402', deLaPasarela: true });
  assert.equal(b.avisos.length, 1);
  assert.match(b.avisos[0], /no pude anular la fila/);
});

test('⚠️ la base falla UNA vez al guardar el link: se reintenta y el link queda guardado', async () => {
  const b = base(1);
  const r = await cerrarCheckoutDelCobro({ checkout: BIEN, ...b.args });
  assert.equal(r.ok, true);
  assert.deepEqual(b.log, ['guardado cs_123']);
  assert.deepEqual(b.avisos, []);
});

test('⚠️ la base sigue sin guardar el link: la fila se anula CON el ref y la url (la reconciliación los mira) y no se entrega un link', async () => {
  const b = base(2);
  const r = await cerrarCheckoutDelCobro({ checkout: BIEN, ...b.args });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.deLaPasarela, false, 'el error no es de la pasarela: no se le prefija su nombre');
  assert.match(r.ok === false ? r.error : '', /No pude guardar el link de pago/);
  assert.equal(b.log.length, 1);
  assert.match(b.log[0], /^anulado ref=cs_123 url=si /, 'sin el ref en la fila anulada, un pago por ese link no lo reconoce nadie');
  assert.match(b.avisos[0], /cs_123/, 'el ref queda también en el log');
});

test('⚠️ la base no guarda NI anula: igual devuelve un error (no tira) y el ref queda en el log', async () => {
  const b = base(2, true);
  const r = await cerrarCheckoutDelCobro({ checkout: BIEN, ...b.args });
  assert.equal(r.ok, false);
  assert.equal(b.log.length, 0);
  assert.ok(b.avisos.some((m) => /cs_123/.test(m)) && b.avisos.some((m) => /tampoco pude anular/.test(m)));
});

test('crearCobro usa esa función y no escribe el anulado a mano después de la pasarela', () => {
  const src = readFileSync(join(__dirname, '..', 'lib/cobros.ts'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const i = src.indexOf('export async function crearCobro(');
  const crear = src.slice(i, src.indexOf('\n}\n', i) + 2);
  assert.match(crear, /await cerrarCheckoutDelCobro\(\{/);
  // ── EL CHECKOUT SE CREA ADENTRO DEL CIERRE, CON TODAS LAS CREDENCIALES Y CON SU `inicioAt` ──
  // Esto citaba la línea entera (`crearCheckout(cobro, { stripe, mp }, 0, { inicioAt })`) y se puso ROJA al entrar Creem
  // (31/10/2026) con el código correcto, que además compila mejor. Lo que cuida no era la línea sino cuatro cosas, y cada una
  // va por separado para que el mensaje diga qué se perdió. La RAMA de cada pasarela adentro de `crearCheckout` la cuida
  // tests/creem-pasarela.test.ts: acá se cuida el CALL SITE.
  const llamada = crear.match(/checkout: await crearCheckout\(cobro, \{([^}]*)\}, (\d+), \{ inicioAt \}\)/);
  assert.ok(llamada, 'crearCobro ya no crea el checkout como campo `checkout:` del cierre, con su vuelta y su `inicioAt`: uno creado afuera puede quedar sin fila que lo conozca');
  // `creem: null` escrito a mano COMPILA (el campo es `CredCreem | null`): esa pasarela queda sin poder cobrar, con la fila ya
  // escrita, y nada lo dice. El Record es TOTAL a propósito: la pasarela #4 no compila este test hasta que la nombren acá.
  const CRED_DE: Readonly<Record<Pasarela, string>> = { stripe: 'stripe', mercadopago: 'mp', creem: 'creem' };
  assert.deepEqual(
    llamada[1].split(',').map((s) => s.trim()).filter(Boolean).sort(),
    PASARELAS.map((pas) => CRED_DE[pas]).sort(),
    'crearCheckout recibe la credencial VIVA de cada pasarela: una puesta en null a mano deja esa pasarela sin cobrar, con la fila ya escrita',
  );
  assert.equal(llamada[2], '0', 'la primera vuelta es 0: con otra, la Idempotency-Key deja de ser la del cobro y un reintento crea un SEGUNDO checkout');
  // El `\w+\.error` en vez de `checkout.error`: la regresión vale igual escrita con otro nombre de variable (`cerrado.error`).
  // El anular legítimo de más abajo usa `motivo: a.motivo`, así que no se pisan.
  assert.doesNotMatch(crear, /estado: 'anulado', motivo: \w+\.error/, 'el anulado a mano tira si la base falla');
  assert.ok(crear.indexOf(".from('cobros').insert(") < crear.indexOf('cerrarCheckoutDelCobro'), 'la fila se escribe ANTES de la pasarela');
});

// Probado ROMPIENDO lib/cobros-reglas.ts y lib/cobros.ts (23/10/2026), una rotura por vez y restaurando de memoria.
// Con el código como está: 7 pases, 0 fallos (más tests/cobros-servicio.test.ts: 14 / 0). Rota (pases / fallos):
//   · sin el try/catch al anular tras el rechazo (tira)                                  → 13 / 1
//   · un solo intento al guardar el link                                                 → 13 / 1
//   · el anulado sin ref ni url                                                          → 13 / 1
//   · si no puede guardar devuelve ok (se entrega un link que la fila no conoce)         → 12 / 2
//   · tira si tampoco puede anular tras no poder guardar                                 → 13 / 1
//   · crearCobro sin usar cerrarCheckoutDelCobro                                         → 13 / 1
//   · el anulado de crearCobro sin `soloSi` (pisaría un pago asentado) o sin cerrar el link en la pasarela → fallan en tests/cobros-servicio.test.ts (6 / 1 c/u)
