// =============================================================================
// MaKo Partners (23/10/2026): las reglas decididas el 10/10 (docs/referidos.md), el cableado y el origen del onboarding
// =============================================================================
// «el sistema de referidos con la página de MaKo Partners... que se gestione de manera automática... el dashboard de
// cuánto dinero tenés acumulado... y también si es que te ganaste meses gratuitos» (Martín, 22/10/2026).
//
// Probado rompiéndolo (23/10/2026; base 9 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · PAGOS_PARA_ACREDITAR = 1 (acredita con el primer pago)                     -> 7 / 2
//   · `correspondeAcreditar` deja que alguien se refiera a sí mismo              -> 8 / 1
//   · los meses gratis no redondean para abajo                                   -> 8 / 1
//   · el revendedor no cobra lo que sobra en plata                               -> 8 / 1
//   · el cron acredita a quien YA tenía cuenta (sin `alta_estado = hecha`)       -> 8 / 1
//   · /r pisa la cookie del primero que lo trajo                                 -> 8 / 1
//   · `interesDeFuncionalidad` no reconoce «crm»                                 -> 8 / 1
//   · el onboarding no siembra el origen                                         -> 8 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAGOS_PARA_ACREDITAR, codigoDesdeNombre, correspondeAcreditar, creditoDelReferido, estadoDelReferido, linkDePartner, resumenDelLibro,
} from '../lib/partners-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

test('el código sale del nombre: minúsculas, sin acentos, con guiones; y el link es /r/<código>', () => {
  assert.equal(codigoDesdeNombre('Código Inmobiliario'), 'codigo-inmobiliario');
  assert.equal(codigoDesdeNombre('Ñu & Cía.', '1234'), 'nu-cia-1234');
  assert.equal(codigoDesdeNombre('X'), 'mako-x');
  assert.equal(linkDePartner('https://hola-mako.com/', 'juan'), 'https://hola-mako.com/r/juan');
});

test('cuenta desde el 2º mes pagado, una vez, y nunca a uno mismo', () => {
  assert.equal(PAGOS_PARA_ACREDITAR, 2);
  assert.equal(correspondeAcreditar({ referidorWs: 1, referidoWs: 2, mesesPagados: 1, yaAcreditado: false }), false);
  assert.equal(correspondeAcreditar({ referidorWs: 1, referidoWs: 2, mesesPagados: 2, yaAcreditado: false }), true);
  assert.equal(correspondeAcreditar({ referidorWs: 1, referidoWs: 2, mesesPagados: 5, yaAcreditado: true }), false);
  assert.equal(correspondeAcreditar({ referidorWs: 3, referidoWs: 3, mesesPagados: 5, yaAcreditado: false }), false);
  assert.equal(creditoDelReferido(47), 47, 'el primer mes de su plan, a precio de lista');
});

test('el estado de cada referido en el tablero', () => {
  assert.equal(estadoDelReferido({ mesesPagados: 0, acreditado: false, vigente: true }), 'registrado');
  assert.equal(estadoDelReferido({ mesesPagados: 1, acreditado: false, vigente: true }), 'primer-pago');
  assert.equal(estadoDelReferido({ mesesPagados: 1, acreditado: false, vigente: false }), 'se-fue');
  assert.equal(estadoDelReferido({ mesesPagados: 3, acreditado: true, vigente: false }), 'acreditado');
});

test('el libro: lo acumulado, lo usado, y los meses gratis de un usuario común (2 de 47 = su mes de 97)', () => {
  const r = resumenDelLibro([{ tipo: 'referido', monto_usd: 47 }, { tipo: 'referido', monto_usd: 47 }, { tipo: 'referido', monto_usd: 47 }], { precioPropioUsd: 97, revendedor: false });
  assert.deepEqual(r, { acumuladoUsd: 141, usadoUsd: 0, saldoUsd: 141, mesesGratis: 1, aCobrarUsd: 0 });
  const usado = resumenDelLibro([{ tipo: 'referido', monto_usd: 97 }, { tipo: 'uso', monto_usd: -97 }], { precioPropioUsd: 47, revendedor: false });
  assert.equal(usado.saldoUsd, 0);
  assert.equal(resumenDelLibro([{ tipo: 'referido', monto_usd: 97 }], { precioPropioUsd: null, revendedor: false }).mesesGratis, 0, 'sin suscripción no hay meses');
  assert.equal(resumenDelLibro([{ tipo: 'referido', monto_usd: 80 }], { precioPropioUsd: 47, revendedor: false }).mesesGratis, 1, 'un mes y pico es UN mes gratis');
});

test('el revendedor: primero su mes, lo que sobra en plata', () => {
  const r = resumenDelLibro([{ tipo: 'referido', monto_usd: 47 }, { tipo: 'referido', monto_usd: 47 }, { tipo: 'referido', monto_usd: 97 }], { precioPropioUsd: 97, revendedor: true });
  assert.equal(r.saldoUsd, 191);
  assert.equal(r.aCobrarUsd, 94);
  assert.equal(r.mesesGratis, 1);
});

test('el cron acredita SÓLO a clientes nuevos (la compra que creó la cuenta) y el primer código vale', () => {
  const p = fuente('lib/partners-programa.ts');
  assert.match(p, /\.not\('ref_codigo', 'is', null\)\.not\('alta_ws', 'is', null\)\.eq\('alta_estado', 'hecha'\)/);
  assert.match(p, /if \(!primero\.has\(Number\(c\.alta_ws\)\)\) primero\.set/);
  assert.match(p, /\.update\(\{ referido_por_ws: referidor \}\)\.eq\('id', referido\)\.is\('referido_por_ws', null\)/, 'las bienvenidas, una vez');
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await acreditarReferidos\(\)/);
});

test('/r/<código> deja la cookie sólo si no había otra (el primero vale)', () => {
  const r = fuente('app/r/[codigo]/route.ts');
  assert.match(r, /if \(!previo\) \{\s*res\.cookies\.set\(COOKIE_REF, codigo/);
  assert.match(r, /export function HEAD\(\)/);
});

test('la funcionalidad de la landing es lo que el onboarding pregunta primero', async () => {
  const { interesDeFuncionalidad, origenDeLlegada } = await import('../lib/origen-negocio.ts').catch(() => ({ interesDeFuncionalidad: null, origenDeLlegada: null })) as {
    interesDeFuncionalidad: ((f: string) => string | null) | null; origenDeLlegada: ((o: unknown, r: string | null) => string | null) | null;
  };
  // El módulo es server-only: si no carga en el test, se lee del fuente.
  if (!interesDeFuncionalidad || !origenDeLlegada) {
    const f = fuente('lib/origen-negocio.ts');
    assert.match(f, /if \(\/crm\|venta\|seguimiento/);
    assert.match(f, /if \(refCodigo\) return 'Me lo recomendaron';/);
    return;
  }
  assert.equal(interesDeFuncionalidad('crm-inmobiliario'), 'ventas');
  assert.equal(interesDeFuncionalidad('whatsapp'), 'whatsapp');
  assert.equal(interesDeFuncionalidad('anuncios-meta'), 'anuncios');
  assert.equal(interesDeFuncionalidad('algo-raro'), null);
  assert.equal(origenDeLlegada({ fbclid: 'x' }, null), 'Un anuncio');
  assert.equal(origenDeLlegada(null, 'juan'), 'Me lo recomendaron');
});

test('el onboarding siembra el origen antes de dibujar el chat, sin pisar lo contestado', () => {
  assert.match(fuente('app/onboarding/page.tsx'), /if \(wsOrigen != null\) await sembrarArranqueDesdeOrigen\(wsOrigen\);\s*const vista = await vistaArranque\(\);/);
  const o = fuente('lib/origen-negocio.ts');
  assert.match(o, /if \(interes && !e\.interes\) patch\.interes = interes;/);
  assert.match(o, /if \(llegada && !e\.origen\) patch\.origen = llegada;/);
});
