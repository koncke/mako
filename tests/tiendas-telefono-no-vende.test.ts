// =============================================================================
// El teléfono no vende (T5) y la app de iPhone no muestra relleno ni Google (3/11/2026)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md, pasos 2 y 3. Apple (3.1.1(a)) y Google (política de pagos) prohíben vender algo digital
// sin su cobro, o mandar a pagar afuera. Medido el 3/11/2026, el paso 2 no estaba hecho: «Tu plan» abría el pago con «Empezar
// mi plan ya» y decía el precio; Agency Dashboard tenía «Pagar su primer mes», «Pagar con mi tarjeta» y el alta con el
// precio; los carteles de la prueba llevaban «Pasar al plan ya» a la vista de cada pantalla, y More y el tope de Equipo,
// «Pasar a Pro». `git grep checkout app/m`, el «hecho cuando» del plan, no veía NADA de esto: el pago salía por una
// variable (`r.link`, `c.cobro.pagar`). Por eso esta guarda busca las PALABRAS que se le ofrecen a la persona.
//
// Correr: node --import tsx --test tests/tiendas-telefono-no-vende.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { MARCA_APP_IOS, esAppIos, esRutaDeVenta, masParaAppIos } from '../lib/tienda';
import { masCompleto, RUTA_PRONTO } from '../lib/movil-rutas';
import { esPublica } from '../lib/rutas-publicas';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\}/g, '');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(p) ? [p] : [];
  });
}

/** Lo que se le OFRECE a la persona: comprar, pagar, pasar de plan. El cobro de un negocio a SUS clientes es otra cosa (/m/cobros). */
const OFERTAS = [
  /empezarPlanYaAction/, /RUTA_EMPEZAR_PLAN/, /RUTA_CAMBIAR_PLAN/, /ROTULO_PASAR_A_PRO/, /Pasar a Pro/, /Pasar al plan ya/, /Empezar mi plan ya/,
  /Pagar su primer mes/, /Pagar con mi tarjeta/, /Activar la renovaci[oó]n/, /LandingAgency/, /US\$\$\{usd\}/,
  /href="\/planes/, /checkout/i, /\.stripe\.com/, /mercadopago\.com/, /suscripcion\.monto/,
];

// Los cobros del NEGOCIO a sus clientes no son una compra dentro de la app (plan, paso 2), y Customers es del super admin.
const AFUERA = /^app\/m\/(cobros|customers)\//;

test('1. ninguna pantalla del teléfono ofrece comprar, pagar ni subir de plan', () => {
  const lista = archivos('app/m').filter((f) => !AFUERA.test(f));
  assert.ok(lista.length > 100, `el recorrido no vio las pantallas: ${lista.length}`);
  const hallados: string[] = [];
  for (const f of lista) {
    const src = sinComentarios(leer(f));
    for (const re of OFERTAS) if (re.test(src)) hallados.push(`${f}: ${re}`);
  }
  assert.deepEqual(hallados, []);
});

test('2. los carteles de la prueba dicen lo que queda, sin botón y sin precio', async () => {
  const { AvisoPruebaM, CartelPruebaM } = await import('../app/m/_prueba/PruebaM');
  const datos = { dias: 3, plan: 'MaKo Pro', despues: 'US$ 97/mes' };
  for (const html of [renderToStaticMarkup(React.createElement(AvisoPruebaM, datos)), renderToStaticMarkup(React.createElement(CartelPruebaM, datos))]) {
    assert.match(html, /quedan 3 días/);
    assert.doesNotMatch(html, /<a\b/, 'un link a pagar');
    assert.doesNotMatch(html, /US\$|97/, 'el precio');
  }
});

test('3. «Tu plan»: el estado y darse de baja, sin el precio', () => {
  const pm = sinComentarios(leer('app/m/configuraciones/plan/PlanM.tsx'));
  assert.doesNotMatch(pm, /suscripcion\.monto|primerMes/, 'el precio en pantalla');
  assert.match(pm, /darmeDeBajaAction\(\)/, 'darse de baja se queda: no es una compra');
});

test('4. una pantalla de escritorio abierta en un teléfono tampoco ofrece el plan', () => {
  const b = sinComentarios(leer('app/_ui/EmpezarPlanYa.tsx'));
  assert.match(b, /if \(typeof navigator !== 'undefined' && esTelefono\(navigator\.userAgent\)\) return null;/);
  const p = sinComentarios(leer('app/no-esta-en-tu-plan/page.tsx'));
  assert.match(p, /const telefono = esTelefono\(/);
  assert.match(p, /pro && !deAgencia && !telefono \? ROTULO_PASAR_A_PRO/);
});

test('5. la marca es la que Capacitor le suma al user agent, y sólo ella prende el modo', () => {
  const cap = JSON.parse(leer('nativo/ios/capacitor.config.json')) as { ios: { appendUserAgent: string } };
  assert.equal(cap.ios.appendUserAgent, MARCA_APP_IOS);
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  assert.equal(esAppIos(`${iphone} ${MARCA_APP_IOS}`), true);
  // Un iPhone en Safari, el Samsung de Martín y la computadora quedan como siempre.
  assert.equal(esAppIos(iphone), false);
  assert.equal(esAppIos('Mozilla/5.0 (Linux; Android 14; SM-S911B) Chrome/130 Mobile'), false);
  assert.equal(esAppIos(null), false);
});

test('6. lo que vende no se abre en la app de iPhone; lo que necesita la tienda, sí', () => {
  for (const r of ['/', '/planes', '/planes/pro', '/pagar/abc', '/pagar/abc/listo', '/r/codigo', '/mako-partners', '/vsl', '/reembolsos']) {
    assert.equal(esRutaDeVenta(r), true, r);
  }
  for (const r of ['/inicio', '/login', '/login/2fa', '/crm', '/privacidad', '/terminos', '/soporte', '/eliminar-cuenta', '/planesx', '/rutas', '/m/cobros']) {
    assert.equal(esRutaDeVenta(r), false, r);
  }
  const proxy = sinComentarios(leer('proxy.ts'));
  const corte = proxy.indexOf("if (esAppIos(req.headers.get('user-agent')) && esRutaDeVenta(pathname))");
  assert.ok(corte > 0, 'el proxy no corta lo que vende');
  assert.ok(corte < proxy.indexOf("if (pathname === '/')"), 'tiene que ir antes de dejar pasar la raíz');
  assert.ok(corte < proxy.indexOf('if (esPublica(pathname))'), 'tiene que ir antes de dejar pasar lo público: /planes y /pagar lo son');
  assert.equal(esPublica('/planes'), true, 'el control: /planes sigue público para el navegador');
});

test('7. More en iPhone: sólo lo que tiene pantalla; sin la marca, entero', () => {
  const completo = masCompleto('admin', 'superadmin', true);
  const filas = completo.flatMap((g) => g.filas);
  assert.ok(filas.some((f) => f.tipo !== 'pantalla'), 'el control: en More hay filas sin pantalla');
  const ios = masParaAppIos(completo, RUTA_PRONTO).flatMap((g) => g.filas);
  assert.ok(ios.length > 0);
  for (const f of ios) {
    assert.equal(f.tipo, 'pantalla', `${f.key} en iPhone no tiene pantalla`);
    if (f.tipo === 'pantalla') assert.ok(!f.href.startsWith(`${RUTA_PRONTO}/`), `${f.key} es «Coming soon»`);
    assert.ok(f.key !== 'agency' && f.key !== 'partners', `${f.key} existe para vender MaKo a otros`);
  }
  const mas = sinComentarios(leer('app/m/mas/page.tsx'));
  assert.match(mas, /const grupos = appIos \? masParaAppIos\(completo, RUTA_PRONTO\) : completo;/);
  assert.match(mas, /\{!appIos && \(\s*<div className="m-mas-compu">/, '«Versión de computadora» no va en iPhone');
  assert.match(sinComentarios(leer('app/m/_ui/EnComputadoraM.tsx')), /if \(appIos\) return null;/);
  assert.match(sinComentarios(leer('app/m/pronto/[key]/page.tsx')), /if \(!item \|\| await esAppIosDelPedido\(\)\) redirect/);
});

test('9. las tabs que existen para vender MaKo a otros no van en iPhone, y las demás sí', () => {
  const fila = (key: string, href: string) => ({ tipo: 'pantalla' as const, key, label: key, icon: 'x', href, seccion: null });
  const grupos = [{ id: 'menu' as const, titulo: null, filas: [fila('agency', '/m/agency'), fila('partners', '/m/partners'), fila('crm', '/m/crm')] }];
  assert.deepEqual(masParaAppIos(grupos, RUTA_PRONTO).flatMap((g) => g.filas.map((f) => f.key)), ['crm']);
  for (const rel of ['app/m/agency/page.tsx', 'app/m/partners/page.tsx']) {
    assert.match(sinComentarios(leer(rel)), /if \(await esAppIosDelPedido\(\)\) redirect\(await rutaConWs\(RUTA_MAS\)\);/, `${rel}: un link directo tampoco`);
  }
});

test('8. el login de la app de iPhone no tiene Google y abre el correo; sin la marca, igual que siempre', () => {
  const form = sinComentarios(leer('app/login/LoginForm.tsx'));
  assert.match(form, /\{!sinGoogle && <a\s+href=\{`\/api\/auth\/google/);
  assert.match(form, /<ConCorreo next=\{next\} abiertoDeEntrada=\{sinGoogle\} \/>/);
  const pagina = sinComentarios(leer('app/login/page.tsx'));
  assert.match(pagina, /const sinGoogle = await esAppIosDelPedido\(\);/);
  assert.match(pagina, /<LoginForm sinGoogle=\{sinGoogle\} \/>/);
  // El otro camino a Google de esta pantalla, el del alumno: tampoco.
  assert.match(pagina, /\{!sinGoogle && \(\s*<a href="\/api\/auth\/google\?next=%2Finicio"/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 9 pases / 0 fallos; una rotura por vez, restaurada de memoria y comprobada):
//   · PlanM vuelve a mostrar el precio                        -> 7 / 2 (1 y 3)
//   · AgencyM vuelve a ofrecer «Pagar su primer mes»          -> 8 / 1 (1)
//   · el cartel de la prueba con un link a pagar              -> 8 / 1 (2)
//   · More con «Pasar a Pro» otra vez                         -> 8 / 1 (1)
//   · EmpezarPlanYa también en el teléfono                    -> 8 / 1 (4)
//   · /pagar, o la raíz, se abren en la app de iPhone         -> 8 / 1 (6)
//   · el corte del proxy, sacado                              -> 8 / 1 (6)
//   · More deja pasar lo que no tiene pantalla                -> 8 / 1 (7)
//   · More deja pasar Agency                                  -> 8 / 1 (9). La primera versión NO la veía: con el super admin
//     en la plataforma esa fila no sale. Por eso la 9 arma las filas a mano.
//   · el botón de Google sin la condición                     -> 8 / 1 (8)
//   · la marca distinta de la de Capacitor                    -> 8 / 1 (5)
//   · un iPhone cualquiera prende el modo                     -> 8 / 1 (5)
