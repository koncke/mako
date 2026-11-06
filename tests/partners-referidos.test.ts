// =============================================================================
// MaKo Partners (23/10/2026): las reglas (docs/referidos.md), el cableado y el origen del onboarding
// =============================================================================
// «el sistema de referidos con la página de MaKo Partners... que se gestione de manera automática... el dashboard de
// cuánto dinero tenés acumulado» (Martín, 22/10/2026). Desde el 25/10 Partners paga SÓLO PLATA: el 100% del primer mes;
// lo nuevo (el alta, las visitas, el precio de lista del anual, el carrito) lo cuida tests/partners-solo-plata.test.ts.
//
// Probado rompiéndolo (23/10/2026; base 9 / 0; los dos del libro rehechos el 25/10). Una rotura por vez, restaurando:
//   · PAGOS_PARA_ACREDITAR = 1 (acredita con el primer pago)                     -> 7 / 2
//   · `correspondeAcreditar` deja que alguien se refiera a sí mismo              -> 8 / 1
//   · el cron acredita a quien YA tenía cuenta (sin `alta_estado = hecha`)       -> 8 / 1
//   · /r pisa la cookie del primero que lo trajo                                 -> 8 / 1
//   · (6/11) /r deja que una cookie de un código MUERTO tape el link vigente      -> ver el test de abajo
//   · `interesDeFuncionalidad` no reconoce «crm»                                 -> 8 / 1
//   · el onboarding no siembra el origen                                         -> 8 / 1
//   · (25/10) el que canceló la prueba con 0 meses vuelve a dar 'registrado'     -> 8 / 1
//   · (25/10, ronda 2) los cobros del lugar no se miran (`seFueSegunSusCobros` da false siempre)   -> 8 / 1
//   · (25/10, ronda 2) «ningún otro cobro vivo» no se mira (la prueba caída alcanza)               -> 8 / 1
//   · (25/10, ronda 2) la baja pedida no se mira, o un pago único cobrado no cuenta como vivo      -> 8 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAGOS_PARA_ACREDITAR, codigoDesdeNombre, correspondeAcreditar, gananciaDelReferido, estadoDelReferido, linkDePartner, porGanar, resumenDelLibro,
  seFueSegunSusCobros, refQueVale,
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
  assert.equal(gananciaDelReferido(47), 47, 'el 100% del primer mes de su plan, a precio de lista');
});

test('el estado de cada referido en el tablero', () => {
  assert.equal(estadoDelReferido({ mesesPagados: 0, acreditado: false, vigente: true }), 'registrado');
  assert.equal(estadoDelReferido({ mesesPagados: 1, acreditado: false, vigente: true }), 'primer-pago');
  assert.equal(estadoDelReferido({ mesesPagados: 1, acreditado: false, vigente: false }), 'se-fue');
  assert.equal(estadoDelReferido({ mesesPagados: 3, acreditado: true, vigente: false }), 'acreditado');
  // 25/10/2026 (revisión del tren): el que canceló la prueba sin pagar nada se fue; no es plata «en camino» para el partner.
  assert.equal(estadoDelReferido({ mesesPagados: 0, acreditado: false, vigente: false }), 'se-fue');
  assert.equal(porGanar([
    { estado: estadoDelReferido({ mesesPagados: 0, acreditado: false, vigente: false }), gananciaUsd: 97 },
    { estado: estadoDelReferido({ mesesPagados: 0, acreditado: false, vigente: true }), gananciaUsd: 47 },
  ]), 47, 'sólo el que sigue');
});

test('se fue según SUS COBROS: la prueba caída y ningún otro cobro vivo (ronda 2: con el corte apagado nadie lo pausa)', () => {
  const prueba = (extra: Record<string, unknown>) => ({ tipo: 'suscripcion', alta_capa: 'completo', creado_por: 'planes:pro:prueba', estado: 'pendiente', suscripcion_estado: 'activa', ...extra });
  const plan = (extra: Record<string, unknown>) => ({ tipo: 'suscripcion', creado_por: 'empezar-ya:5', estado: 'pagado', suscripcion_estado: 'activa', ...extra });
  assert.equal(seFueSegunSusCobros([prueba({})]), false, 'sigue en su prueba');
  assert.equal(seFueSegunSusCobros([prueba({ suscripcion_estado: 'cancelada' })]), true, 'canceló la prueba y nunca pagó');
  assert.equal(seFueSegunSusCobros([prueba({ estado: 'pagado', suscripcion_estado: 'cancelada' })]), true, 'pagó el día 8 y canceló: no hay 2º mes');
  assert.equal(seFueSegunSusCobros([prueba({ estado: 'anulado', suscripcion_estado: 'cancelada' }), plan({})]), false, '«Empezar mi plan ya» pagado: sigue');
  assert.equal(seFueSegunSusCobros([prueba({ estado: 'anulado', suscripcion_estado: 'cancelada' }), plan({ suscripcion_estado: 'cancelada' })]), true);
  assert.equal(seFueSegunSusCobros([prueba({ suscripcion_estado: 'cancelada' }), plan({ estado: 'pendiente', suscripcion_estado: null })]), true, 'un link abierto y sin pagar no lo trae de vuelta');
  assert.equal(seFueSegunSusCobros([prueba({ suscripcion_estado: 'cancelada' }), plan({ motivo: 'Baja pedida el 25/10' })]), true, 'con la baja pedida no se cobra más');
  assert.equal(seFueSegunSusCobros([prueba({ suscripcion_estado: 'cancelada' }), { tipo: 'unico', estado: 'pagado', suscripcion_estado: null }]), false, 'un pago único cobrado (a mano) sigue');
  assert.equal(seFueSegunSusCobros([plan({ suscripcion_estado: 'cancelada' })]), false, 'sin una prueba caída no decide: queda workspaces.estado');
});

test('el libro: lo ganado, lo transferido y lo que queda a cobrar, en dinero (sin meses ni revendedor)', () => {
  const r = resumenDelLibro([{ tipo: 'referido', monto_usd: 47 }, { tipo: 'referido', monto_usd: 97 }, { tipo: 'uso', monto_usd: -47 }]);
  assert.deepEqual(r, { ganadoUsd: 144, pagadoUsd: 47, aCobrarUsd: 97 });
  assert.equal(resumenDelLibro([{ tipo: 'referido', monto_usd: 97 }, { tipo: 'uso', monto_usd: -120 }]).aCobrarUsd, 0, 'nunca negativo');
  assert.deepEqual(resumenDelLibro([{ tipo: 'ajuste', monto_usd: 10 }, { tipo: 'ajuste', monto_usd: -4 }]), { ganadoUsd: 10, pagadoUsd: 4, aCobrarUsd: 6 }, 'los ajustes, a favor o en contra');
});

test('el cron acredita SÓLO a clientes nuevos (la compra que creó la cuenta) y el primer código vale', () => {
  const p = fuente('lib/partners-programa.ts');
  // La compra que creó la cuenta, o la de «Empezar mi plan ya» que reemplaza a esa prueba (25/10/2026): de punta a punta en
  // tests/partners-empezar-ya.test.ts.
  assert.match(p, /const COMPRA_QUE_TRAJO = 'alta_estado\.eq\.hecha,creado_por\.like\.empezar-ya:\*';/);
  assert.match(p, /\.not\('ref_codigo', 'is', null\)\.not\('alta_ws', 'is', null\)\.or\(COMPRA_QUE_TRAJO\)/);
  assert.match(p, /if \(!primero\.has\(Number\(c\.alta_ws\)\)\) primero\.set/);
  assert.match(p, /\.update\(\{ referido_por_ws: referidor \}\)\.eq\('id', referido\)\.is\('referido_por_ws', null\)/, 'las bienvenidas, una vez');
  assert.match(fuente('app/api/cron/cobros-reconciliar/route.ts'), /await acreditarReferidos\(\)/);
});

test('/r/<código> deja la cookie sólo si no había otra (el primero vale)', () => {
  const r = fuente('app/r/[codigo]/route.ts');
  assert.match(r, /const \{ ref, ponerCookie \} = refQueVale\(\{ previo, previoEsDePartner, codigo \}\);/);
  assert.match(r, /destino\.searchParams\.set\('ref', ref\);/);
  assert.match(r, /if \(ponerCookie\) \{\s*res\.cookies\.set\(COOKIE_REF, codigo/);
  assert.match(r, /export function HEAD\(\)/);
});

// Y SI EL PRIMERO YA NO ES DE NADIE (6/11/2026): la cookie de un código muerto tapaba el link vigente, y como /r pone el mismo
// código en `?ref=`, la compra salía sin partner. Probado rompiéndolo: `refQueVale` sin mirar `previoEsDePartner` → 1 fallo;
// el route sin preguntar por la cookie (`previoEsDePartner` fijo en null) → 1 fallo.
test('/r/<código>: una cookie de un código muerto no tapa el link de hoy; con la base caída, vale el primero', () => {
  assert.deepEqual(refQueVale({ previo: 'ana', previoEsDePartner: true, codigo: 'luis' }), { ref: 'ana', ponerCookie: false });
  assert.deepEqual(refQueVale({ previo: 'muerto', previoEsDePartner: false, codigo: 'luis' }), { ref: 'luis', ponerCookie: true });
  assert.deepEqual(refQueVale({ previo: 'ana', previoEsDePartner: null, codigo: 'luis' }), { ref: 'ana', ponerCookie: false });
  assert.deepEqual(refQueVale({ previo: null, previoEsDePartner: null, codigo: 'luis' }), { ref: 'luis', ponerCookie: true });
  const r = fuente('app/r/[codigo]/route.ts');
  assert.match(r, /const previoEsDePartner = previo \? await esCodigoDePartner\(previo\)\.catch\(\(\) => null\) : null;/);
});

// Y «no pude leer» no es «no es de nadie» (la revisión del 6/11/2026): la lectura de los códigos ANTERIORES se tragaba el error y
// daba null, así que un código viejo de un partner contaba como muerto y /r dejaba que otro link le pisara la cookie. Ejecutado en
// un node aparte (tests/_partners-codigo-viejo-hijo.ts, la base de mentira). Probado rompiéndolo (volver a `!error && data ? … : null`):
// 1 fallo.
test('el código viejo de un partner con la base caída TIRA (y /r deja la cookie); sin la tabla, no es de nadie', () => {
  const correr = (caso: string) => JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_partners-codigo-viejo-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, env: { ...process.env, CASO: caso },
  })) as { es?: boolean; tiro?: boolean; fallo?: string };
  const caida = correr('caida');
  assert.equal(caida.fallo, undefined, `el hijo falló: ${caida.fallo}`);
  assert.equal(caida.tiro, true, 'con la base caída, un código viejo no puede leerse como muerto');
  assert.deepEqual(correr('sin-tabla'), { es: false }, 'sin la mig 0341 los anteriores son ninguno, como antes');
  assert.deepEqual(correr('vivo'), { es: true });
});

test('la funcionalidad de la landing es lo que el onboarding pregunta primero', async () => {
  const { interesDeFuncionalidad, origenDeLlegada } = await import('../lib/origen-negocio').catch(() => ({ interesDeFuncionalidad: null, origenDeLlegada: null })) as {
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
