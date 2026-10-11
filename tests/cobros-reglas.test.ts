// =============================================================================
// Lo que decide la pasarela sin base ni proveedor (lib/cobros-reglas.ts)
// =============================================================================
// lib/cobros.ts orquesta (base, Stripe, Mercado Pago) y lo que DECIDE vive en lib/cobros-reglas.ts,
// que es puro: acá se ejecuta. Las preguntas que fallan calladas, y por eso se fijan:
//   · ¿con qué pasarela, qué monto y qué moneda? (decidirCobro) — un precio en DÓLARES del catálogo
//     nunca se convierte solo a pesos: en Mercado Pago, sin monto en la moneda local, se PIDE;
//   · ¿cuánto vale en USD? (montoUsdDelCobro / montoUsdDeLaCuota) — nunca con una tasa inventada:
//     sin dato, null, y el cobro no escribe cuota en el CRM (pagos.monto_usd es NOT NULL);
//   · ¿desde qué estado un pago confirmado lo deja pagado? (anulado SÍ: la plata entró);
//   · las claves de idempotencia, DETERMINÍSTICAS: lo que mueve plata se repite con la misma;
//   · y que el módulo no arrastre nada de node: lo importa un componente 'use client', y un
//     `node:crypto` acá rompe el bundle del navegador (ya pasó: el token del cobro vivía acá).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 13 pases, 0 fallos. Rota (pases / fallos):
//   · `import crypto from 'node:crypto'` de vuelta en lib/cobros-reglas.ts                 → 12 / 1
//   · el precio del producto usado en CUALQUIER moneda (`if (monto == null)`)              → 12 / 1
//   · con dos conectadas, la primera sin preguntar                                         → 12 / 1
//   · sin el chequeo de «la elegida no está conectada»                                     → 12 / 1
//   · sin el email obligatorio de la suscripción de Mercado Pago                           → 12 / 1
//   · sin el tope de 1.000.000                                                             → 12 / 1
//   · montoUsdDelCobro con una «tasa» (`monto / 1000`) en vez de null                     → 12 / 1
//   · `reembolsado` entre los estados que pasan a pagado                                   → 12 / 1
//   · esRenovacion sin `c.tipo === 'suscripcion'`                                         → 12 / 1
//   · mesesTranscurridos sin el borde del día                                              → 12 / 1
//   · urlPorVencer: sin fecha = «no vence»                                                 → 12 / 1
//   · idemReembolso con `Date.now()`                                                       → 12 / 1
//   · textoPagoRegistrado sin el «(prueba)»                                                → 12 / 1
//   · emailEnmascarado sin `if (at < 1) return null`                                       → 12 / 1
// Correr: node --import tsx --test tests/cobros-reglas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, dirname } from 'node:path';
import {
  decidirCobro, emailEnmascarado, esRenovacion, idemBaja, idemCobro, idemReembolso, mesesTranscurridos,
  montoUsdDeLaCuota, montoUsdDelCobro, pasaAPagado, textoPagoRegistrado, urlPorVencer,
} from '../lib/cobros-reglas';
import type { Pasarela } from '../lib/cobros-tipos';

const RAIZ = join(__dirname, '..');

// ── decidirCobro ──────────────────────────────────────────────────────────────

test('decidirCobro: qué pasarela (una conectada, dos sin elegir, ninguna, la elegida no conectada)', () => {
  const base = { tipo: 'unico' as const, monto: 47, moneda: 'USD' };
  // Una sola conectada y nadie eligió: ésa.
  const una = decidirCobro({ ...base, conectadas: ['stripe'] });
  assert.deepEqual(una, { ok: true, pasarela: 'stripe', monto: 47, moneda: 'USD' });
  // Dos y nadie eligió: se PIDE (no se toma la primera de la lista).
  const dos = decidirCobro({ ...base, conectadas: ['stripe', 'mercadopago'] });
  assert.equal(dos.ok, false);
  assert.deepEqual(!dos.ok && dos.faltan, ['pasarela']);
  // Ninguna: el error dice qué hacer y no pide un campo (no hay nada que elegir en la pantalla).
  const ninguna = decidirCobro({ ...base, conectadas: [] });
  assert.equal(ninguna.ok, false);
  assert.match(!ninguna.ok ? ninguna.error : '', /Conecta Stripe o Mercado Pago/);
  assert.equal(!ninguna.ok && ninguna.faltan, undefined);
  // La elegida no está conectada: se rechaza con su nombre, aunque la otra sí lo esté.
  const ajena = decidirCobro({ ...base, pasarela: 'mercadopago', conectadas: ['stripe'] });
  assert.equal(ajena.ok, false);
  assert.match(!ajena.ok ? ajena.error : '', /Mercado Pago no está conectado/);
});

test('decidirCobro: el monto y la moneda (Stripe en USD con el catálogo; MP en su moneda, explícito)', () => {
  // Stripe sin moneda cobra en USD, y sin monto toma el precio del producto (el catálogo está en USD).
  const stripe = decidirCobro({ pasarela: 'stripe', conectadas: ['stripe'], productoMontoUsd: 47, tipo: 'unico' });
  assert.deepEqual(stripe, { ok: true, pasarela: 'stripe', monto: 47, moneda: 'USD' });
  // La moneda explícita se normaliza, y el monto queda en centavos.
  const minus = decidirCobro({ pasarela: 'stripe', conectadas: ['stripe'], monto: 10.006, moneda: 'usd', tipo: 'unico' });
  assert.deepEqual(minus, { ok: true, pasarela: 'stripe', monto: 10.01, moneda: 'USD' });

  // ⚠️ Mercado Pago cobra en la moneda del sitio de SU cuenta, y un precio en dólares NO se
  // convierte solo a pesos: sin monto en ARS se pide el monto (no se cobran «47 pesos»).
  const mp = decidirCobro({ pasarela: 'mercadopago', conectadas: ['mercadopago'], monedaDeLaCuenta: 'ARS', productoMontoUsd: 47, tipo: 'unico' });
  assert.equal(mp.ok, false);
  assert.deepEqual(!mp.ok && mp.faltan, ['monto']);
  assert.equal(!mp.ok && mp.error, 'Falta el monto en ARS.');
  // Lo mismo en Stripe con otra moneda pedida: el precio en USD no es un precio en MXN.
  const mxn = decidirCobro({ pasarela: 'stripe', conectadas: ['stripe'], moneda: 'MXN', productoMontoUsd: 47, tipo: 'unico' });
  assert.deepEqual(!mxn.ok && mxn.faltan, ['monto']);
  // Con el monto explícito, MP cobra en la moneda de la cuenta.
  const mpOk = decidirCobro({ pasarela: 'mercadopago', conectadas: ['mercadopago'], monedaDeLaCuenta: 'ARS', monto: 49900, tipo: 'unico' });
  assert.deepEqual(mpOk, { ok: true, pasarela: 'mercadopago', monto: 49900, moneda: 'ARS' });
  // Sin moneda de la cuenta (un sitio que no conocemos) y sin moneda pedida: se pide la moneda, nunca se asume USD.
  const sinMoneda = decidirCobro({ pasarela: 'mercadopago', conectadas: ['mercadopago'], monedaDeLaCuenta: null, monto: 100, tipo: 'unico' });
  assert.deepEqual(!sinMoneda.ok && sinMoneda.faltan, ['moneda']);
});

test('decidirCobro: la suscripción de MP pide el email, y el monto tiene tope', () => {
  const sus = decidirCobro({ pasarela: 'mercadopago', conectadas: ['mercadopago'], monedaDeLaCuenta: 'ARS', monto: 15000, tipo: 'suscripcion', email: null });
  assert.equal(sus.ok, false);
  assert.deepEqual(!sus.ok && sus.faltan, ['email']);
  // Con email sí; y en Stripe una suscripción no lo necesita (lo pide su checkout).
  assert.equal(decidirCobro({ pasarela: 'mercadopago', conectadas: ['mercadopago'], monedaDeLaCuenta: 'ARS', monto: 15000, tipo: 'suscripcion', email: 'a@b.com' }).ok, true);
  assert.equal(decidirCobro({ pasarela: 'stripe', conectadas: ['stripe'], monto: 47, tipo: 'suscripcion' }).ok, true);
  // El tope: un millón pasa, uno más no (un cero de más en un link de pago es plata real).
  const conectadas: Pasarela[] = ['stripe'];
  assert.equal(decidirCobro({ conectadas, monto: 1_000_000, tipo: 'unico' }).ok, true);
  const alto = decidirCobro({ conectadas, monto: 1_000_001, tipo: 'unico' });
  assert.equal(alto.ok, false);
  assert.match(!alto.ok ? alto.error : '', /demasiado alto/);
  // Un monto 0, negativo o basura no es un monto: cae al del producto o se pide.
  assert.deepEqual(decidirCobro({ conectadas, monto: 0, productoMontoUsd: 30, tipo: 'unico' }), { ok: true, pasarela: 'stripe', monto: 30, moneda: 'USD' });
  const basura = decidirCobro({ conectadas, monto: Number('abc'), tipo: 'unico' });
  assert.deepEqual(!basura.ok && basura.faltan, ['monto']);
});

// ── El valor en dólares ───────────────────────────────────────────────────────

test('montoUsdDelCobro: USD es el monto; otra moneda, SÓLO lo declarado; si no, null (sin tasa ni precio del producto)', () => {
  assert.equal(montoUsdDelCobro({ monto: 47, moneda: 'USD' }), 47);
  assert.equal(montoUsdDelCobro({ monto: 47.004, moneda: 'usd' }), 47);
  assert.equal(montoUsdDelCobro({ monto: 49900, moneda: 'ARS', montoUsdDeclarado: 47 }), 47);
  // Revisión del 11/10/2026: el precio del producto NO vale en otra moneda (una seña de ARS 50.000 sobre un
  // programa de US$ 2.000 sumaba US$ 2.000 al cash). Se ofrece en pantalla; lo confirma la persona.
  assert.equal(montoUsdDelCobro({ monto: 49900, moneda: 'ARS', productoMontoUsd: 50 }), null);
  // Lo declarado gana sobre el producto (quien armó el link sabe lo que cobró).
  assert.equal(montoUsdDelCobro({ monto: 49900, moneda: 'ARS', montoUsdDeclarado: 45, productoMontoUsd: 50 }), 45);
  // ⚠️ Sin dato: null. Ni el monto en pesos tomado como dólares, ni una tasa de cambio.
  assert.equal(montoUsdDelCobro({ monto: 49900, moneda: 'ARS' }), null);
  assert.equal(montoUsdDelCobro({ monto: 49900, moneda: 'ARS', montoUsdDeclarado: 0, productoMontoUsd: -3 }), null);
  assert.equal(montoUsdDelCobro({ monto: 49900, moneda: 'ARS', montoUsdDeclarado: null, productoMontoUsd: null }), null);
});

test('montoUsdDeLaCuota: una renovación en USD trae su monto; en otra moneda, el del cobro', () => {
  assert.equal(montoUsdDeLaCuota({ montoCuota: 52, monedaCuota: 'USD', cobroMontoUsd: 47 }), 52);
  assert.equal(montoUsdDeLaCuota({ montoCuota: 52, monedaCuota: 'usd', cobroMontoUsd: 47 }), 52);
  assert.equal(montoUsdDeLaCuota({ montoCuota: 60000, monedaCuota: 'ARS', cobroMontoUsd: 47 }), 47);
  assert.equal(montoUsdDeLaCuota({ montoCuota: null, monedaCuota: 'USD', cobroMontoUsd: 47 }), 47);
  assert.equal(montoUsdDeLaCuota({ montoCuota: 0, monedaCuota: 'USD', cobroMontoUsd: 47 }), 47);
  assert.equal(montoUsdDeLaCuota({ montoCuota: 60000, monedaCuota: 'ARS', cobroMontoUsd: null }), null);
});

// ── Estados ───────────────────────────────────────────────────────────────────

test('pasaAPagado: pendiente, fallido y ANULADO sí (la plata entró); reembolsado y pagado no', () => {
  assert.equal(pasaAPagado('pendiente'), true);
  assert.equal(pasaAPagado('fallido'), true);
  assert.equal(pasaAPagado('anulado'), true, 'un link anulado de MP que igual se pagó escondería plata que entró');
  assert.equal(pasaAPagado('reembolsado'), false, 'un «aprobado» viejo reentregado después del reembolso lo «despagaría»');
  assert.equal(pasaAPagado('pagado'), false);
});

test('esRenovacion: otra factura de la MISMA suscripción; el primer pago y un pago único, no', () => {
  assert.equal(esRenovacion({ tipo: 'suscripcion', proveedor_pago_id: 'in_1' }, 'in_2'), true);
  assert.equal(esRenovacion({ tipo: 'suscripcion', proveedor_pago_id: 'in_1' }, 'in_1'), false, 'la reentrega del primero');
  assert.equal(esRenovacion({ tipo: 'suscripcion', proveedor_pago_id: null }, 'in_1'), false, 'el primero');
  assert.equal(esRenovacion({ tipo: 'unico', proveedor_pago_id: 'pi_1' }, 'pi_2'), false, 'un pago único no se renueva');
});

test('mesesTranscurridos: meses enteros con el borde del día, mínimo 1', () => {
  assert.equal(mesesTranscurridos('2026-01-15', '2026-07-15'), 6);
  assert.equal(mesesTranscurridos('2026-01-15', '2026-07-14'), 5, 'un día antes del aniversario todavía no es el mes');
  assert.equal(mesesTranscurridos('2025-11-30', '2026-01-29'), 1);
  assert.equal(mesesTranscurridos('2026-10-01', '2026-10-11'), 1, 'cancelada el mismo mes: 1 (0 sería «plazo fijo de 0 meses»)');
  assert.equal(mesesTranscurridos('2026-01-15T23:59:00Z', '2026-03-20'), 2, 'una fecha con hora se lee por su día');
  assert.equal(mesesTranscurridos(null, '2026-10-11'), 1);
  assert.equal(mesesTranscurridos('basura', '2026-10-11'), 1);
});

test('urlPorVencer: la sesión de Stripe se rehace si le quedan menos de 5 minutos, ya venció o no tiene fecha', () => {
  const ahora = Date.parse('2026-10-11T12:00:00Z');
  assert.equal(urlPorVencer('2026-10-11T12:10:00Z', ahora), false);
  assert.equal(urlPorVencer('2026-10-11T12:05:00Z', ahora), false, 'justo 5 minutos todavía sirve');
  assert.equal(urlPorVencer('2026-10-11T12:04:59Z', ahora), true);
  assert.equal(urlPorVencer('2026-10-11T11:00:00Z', ahora), true);
  assert.equal(urlPorVencer(null, ahora), true, 'sin fecha no se sabe: se crea otra');
  assert.equal(urlPorVencer('mañana', ahora), true);
  assert.equal(urlPorVencer('2026-10-11T12:10:00Z', ahora, 15), true, 'el margen es configurable');
});

// ── Idempotencia ──────────────────────────────────────────────────────────────

test('las claves de idempotencia son DETERMINÍSTICAS: misma operación y mismo cobro, misma clave', () => {
  // La vuelta 0 es la creación (crearCobro); las siguientes, las sesiones nuevas de un link vencido.
  assert.equal(idemCobro(7), 'mako-cobro-7');
  assert.equal(idemCobro(7, 0), idemCobro(7));
  assert.equal(idemCobro(7, 3), 'mako-cobro-7-3');
  assert.equal(idemReembolso(7), 'mako-reembolso-7');
  assert.equal(idemBaja(7), 'mako-baja-7');
  // Dos llamadas, la misma clave (una confirmación repetida no devuelve dos veces la plata).
  assert.equal(idemReembolso(7), idemReembolso(7));
  assert.equal(idemBaja(7), idemBaja(7));
  // Y no chocan entre operaciones ni entre cobros.
  const todas = [idemCobro(7), idemCobro(8), idemCobro(7, 1), idemReembolso(7), idemReembolso(8), idemBaja(7)];
  assert.equal(new Set(todas).size, todas.length);
});

// ── Textos ────────────────────────────────────────────────────────────────────

test('textoPagoRegistrado: la moneda REAL, el USD si es otra, y «(prueba)» cuando lo es', () => {
  const ars = textoPagoRegistrado({ concepto: 'Plan Pro', monto: 49900, moneda: 'ARS', montoUsd: 47, pasarela: 'mercadopago', prueba: true, renovacion: false });
  assert.equal(ars, 'Pago de Plan Pro: $ 49.900 ARS (US$ 47) por Mercado Pago (prueba)');
  assert.doesNotMatch(ars, /US\$ 49/, 'los pesos no se rotulan como dólares');
  const usd = textoPagoRegistrado({ concepto: 'Plan Pro', monto: 47, moneda: 'USD', montoUsd: 47, pasarela: 'stripe', prueba: false, renovacion: true });
  assert.equal(usd, 'Renovación de Plan Pro: US$ 47 por Stripe');
  assert.doesNotMatch(usd, /prueba/);
  // Sin valor en USD no se inventa el paréntesis.
  assert.equal(
    textoPagoRegistrado({ concepto: 'Curso', monto: 15000, moneda: 'MXN', montoUsd: null, pasarela: 'stripe', prueba: false, renovacion: false }),
    'Pago de Curso: $ 15.000 MXN por Stripe',
  );
});

test('emailEnmascarado: dos letras y el dominio; lo que no es un email, null', () => {
  assert.equal(emailEnmascarado('martin@gmail.com'), 'ma***@gmail.com');
  assert.equal(emailEnmascarado('  a@x.com '), 'a***@x.com');
  assert.equal(emailEnmascarado('@x.com'), null);
  assert.equal(emailEnmascarado('sin-arroba'), null);
  assert.equal(emailEnmascarado(''), null);
  assert.equal(emailEnmascarado(null), null);
});

// ── El módulo lo puede importar el navegador ─────────────────────────────────

/** Sin comentarios: las líneas PRIMERO y los bloques después (AGENTS.md). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NODE = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

/** Lo que importa un archivo, y lo de sus imports relativos (un 'use client' arrastra el grafo entero). */
function grafo(rel: string, vistos = new Map<string, string[]>()): Map<string, string[]> {
  if (vistos.has(rel)) return vistos;
  const src = sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
  const specs = [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
  vistos.set(rel, specs);
  for (const s of specs) {
    if (!s.startsWith('.') && !s.startsWith('@/')) continue;
    const base = s.startsWith('@/') ? s.slice(2) : join(dirname(rel), s).replace(/\\/g, '/');
    const archivo = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((f) => existsSync(join(RAIZ, f)));
    if (archivo) grafo(archivo, vistos);
  }
  return vistos;
}

test('lib/cobros-reglas.ts (y lo que importa) no trae NADA de node ni server-only', () => {
  const g = grafo('lib/cobros-reglas.ts');
  // El guard tiene que ver el grafo de verdad: si no encuentra los imports, no cubre nada.
  assert.ok(g.has('lib/cobros-tipos.ts') && g.has('lib/pasarela-moneda.ts'), `el grafo no siguió los imports: ${[...g.keys()].join(', ')}`);
  const malos: string[] = [];
  for (const [archivo, specs] of g) {
    for (const s of specs) if (NODE.has(s) || s === 'server-only') malos.push(`${archivo} → ${s}`);
    if (/\bBuffer\./.test(sinComentarios(readFileSync(join(RAIZ, archivo), 'utf8')))) malos.push(`${archivo} → Buffer`);
  }
  assert.deepEqual(malos, [], `un componente 'use client' que importe las reglas rompería el bundle del navegador:\n${malos.join('\n')}`);
});
