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
import { MARCA_APP_IOS, TABS_QUE_VENDEN, esAppIos, esRutaDeVenta, esTabQueVende, masParaAppIos, sinLoQueVende } from '../lib/tienda';
import { masCompleto, RUTA_PRONTO, type GrupoMasCompleto } from '../lib/movil-rutas';
import { pedidoMovil } from '../lib/movil-desvio';
import { USER_NAV } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';
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
  // El cartel del primer mes del cliente de una agencia, en el layout raíz: sin precio ni link.
  const cartel = sinComentarios(leer('app/_components/CartelPagoCliente.tsx'));
  assert.match(cartel, /if \(telefono && !primer\) return null;/);
  assert.match(cartel, /\{!telefono && <div className="cpc-precio">/);
  assert.match(cartel, /\{!telefono && <a className="cpc-pagar" href=\{cartel\.link\}>/);
  assert.match(sinComentarios(leer('app/crm/PasarAPro.tsx')), /if \(typeof navigator !== 'undefined' && esTelefono\(navigator\.userAgent\)\) return null;/);
  // La cuenta pausada: el botón, lo que se debe y el texto que manda a elegir un plan.
  const pausada = sinComentarios(leer('app/cuenta-pausada/page.tsx'));
  assert.match(pausada, /const telefono = esTelefono\(/);
  assert.match(pausada, /const porPago = !telefono && leOfrecePagar\(/);
  assert.match(pausada, /\{telefono \? 'Tus datos están guardados\.' : t\.detalle\}/);
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
    // Agency volvió el 13/11/2026 sin plata (#94, tests/agency-telefono-94.test.ts); Partners, no.
    assert.ok(f.key !== 'partners', `${f.key} existe para vender MaKo a otros`);
  }
  const mas = sinComentarios(leer('app/m/mas/page.tsx'));
  assert.match(mas, /const grupos = appIos \? masParaAppIos\(paraEste, RUTA_PRONTO\) : paraEste;/);
  assert.match(mas, /\{!appIos && \(\s*<div className="m-mas-compu">/, '«Versión de computadora» no va en iPhone');
  assert.match(sinComentarios(leer('app/m/_ui/EnComputadoraM.tsx')), /if \(appIos\) return null;/);
  assert.match(sinComentarios(leer('app/m/pronto/[key]/page.tsx')), /if \(!item \|\| await esAppIosDelPedido\(\)\) redirect/);
});

// 4/11/2026, Martín: el teléfono no vende en NINGÚN teléfono. Android no se distingue de Chrome, y en la clasificación de edad
// de Google Play se contestó que la app no da premios en dinero (MaKo Partners del teléfono decía «Ya cobraste»; Agency
// Dashboard, «Falta pagar»). Hasta ese día, Partners y Agency salían sólo de la app de iPhone.
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  iphoneApp: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${MARCA_APP_IOS}`,
};
/** Lo que /m/mas le dibuja a ese user agent: la misma línea que app/m/mas/page.tsx (la fija la 7). */
const masDelTelefono = (ua: string, completo: GrupoMasCompleto[]) => (esAppIos(ua) ? masParaAppIos(completo, RUTA_PRONTO) : completo);
const keysDe = (grupos: GrupoMasCompleto[]) => grupos.flatMap((g) => g.filas.flatMap((f) => (f.tipo === 'grupo' ? [f.key, ...f.filas.map((x) => x.key)] : [f.key])));

// 13/11/2026, ticket #94 (Martín: «Soluciona esto»): el Agency Dashboard VOLVIÓ al teléfono sin lo que se le debe a MaKo
// (tests/agency-telefono-94.test.ts). MaKo Partners sigue afuera.
test('9. las tabs que existen para vender MaKo a otros no van en NINGÚN teléfono, y las demás sí', () => {
  assert.deepEqual([...TABS_QUE_VENDEN].sort(), ['partners']);
  assert.equal(esTabQueVende('partners'), true);
  assert.equal(esTabQueVende('agency'), false, 'desde el #94 la cartera de una agencia va en el teléfono, sin plata');
  assert.equal(esTabQueVende('crm'), false);
  // El filtro, con filas armadas a mano: también adentro de un desplegable, y el desplegable que queda vacío se va.
  const fila = (key: string, href: string) => ({ tipo: 'pantalla' as const, key, label: key, icon: 'x', href, seccion: null });
  const grupos: GrupoMasCompleto[] = [
    { id: 'menu', titulo: null, filas: [fila('agency', '/m/agency'), fila('partners', '/m/partners'), fila('crm', '/m/crm')] },
    { id: 'sales', titulo: 'Sales', filas: [{ tipo: 'grupo', key: 'mas', label: 'Más', icon: 'x', filas: [fila('partners', '/m/partners')] }] },
  ];
  assert.deepEqual(keysDe(sinLoQueVende(grupos)), ['agency', 'crm']);
  // More de verdad, para el admin de un negocio y el de una agencia: la sidebar les muestra las dos (el control), y ningún
  // teléfono —Android, iPhone en Safari, la app de iPhone— las dibuja.
  for (const capa of ['completo', 'agencia']) {
    const vista = { adminShell: false, rolWs: 'admin', capa };
    for (const key of TABS_QUE_VENDEN) {
      const it = USER_NAV.find((i) => i.key === key);
      assert.ok(it && puedeVerItem(it, vista), `el control: la sidebar de ${capa} muestra ${key}`);
    }
    const completo = masCompleto('admin', capa, false);
    for (const [nombre, ua] of Object.entries(UA)) {
      const dibujadas = keysDe(masDelTelefono(ua, completo)).filter((k) => esTabQueVende(k));
      assert.deepEqual(dibujadas, [], `${capa} en ${nombre}: More las dibuja`);
    }
    // Y el resto del menú de la foto sigue (Settings, Report a problem): no se vació More.
    assert.ok(keysDe(completo).includes('tickets'), `${capa}: se fue el resto del menú de la foto`);
  }
});

test('9b. un link a /partners o /agency en un teléfono cae en su página; la de Partners vuelve a More antes de leer nada', () => {
  for (const [ruta, interna] of [['/partners', '/m/partners'], ['/agency', '/m/agency']] as const) {
    // El teléfono: el proxy le sirve la página de /m en la misma URL (ninguna cubierta «Abrirla igual» con el panel debajo).
    assert.deepEqual(pedidoMovil({ pathname: ruta, search: '', metodo: 'GET', telefono: true }), { tipo: 'reescribir', destino: interna });
    // La computadora: no cambia nada.
    assert.deepEqual(pedidoMovil({ pathname: ruta, search: '', metodo: 'GET', telefono: false }), { tipo: 'seguir' });
  }
  // Agency ya no vuelve a More (#94): su página dibuja la cartera sin plata, con la misma puerta que la computadora.
  assert.doesNotMatch(sinComentarios(leer('app/m/agency/page.tsx')), /esTabQueVende/);
  for (const [rel, key] of [['app/m/partners/page.tsx', 'partners']] as const) {
    const src = sinComentarios(leer(rel));
    const corte = src.indexOf(`if (esTabQueVende('${key}')) redirect(await rutaConWs(RUTA_MAS));`);
    assert.ok(corte > 0, `${rel}: no vuelve a More`);
    // Para todos los teléfonos: no pregunta cuál es.
    assert.doesNotMatch(src, /esAppIosDelPedido/, `${rel}: el corte volvió a ser sólo de iPhone`);
    // Antes de leer el negocio o la query: nada del panel se arma para un teléfono.
    for (const lectura of ['await searchParams', 'getWorkspaceActual()', 'getSesionAdmin()']) {
      const i = src.indexOf(lectura);
      assert.ok(i > 0, `${rel}: el control, «${lectura}» está`);
      assert.ok(corte < i, `${rel}: lee «${lectura}» antes de volver a More`);
    }
  }
});

test('10. Community no va en la app de iPhone (Apple 1.2 pide bloquear desde la app), y en Android se denuncia desde la hoja', () => {
  const pag = sinComentarios(leer('app/m/comunidad/page.tsx'));
  assert.match(pag, /if \(await esAppIosDelPedido\(\)\) redirect\(await rutaConWs\('\/m\/curso'\)\);/);
  assert.match(sinComentarios(leer('app/m/cs/SeccionesClientsM.tsx')), /\(await esAppIosDelPedido\(\)\) \? OPCIONES\.filter\(\(o\) => o\.id !== 'community'\)/);
  const post = sinComentarios(leer('app/m/comunidad/PostM.tsx'));
  assert.equal((post.match(/<ReportarRespuesta /g) ?? []).length, 2, 'la publicación y cada comentario');
});

test('11. todo lo que dibuja el teléfono parsea: los demás tests leen el texto, y un `<div>` de menos no lo ve ninguno', async () => {
  // (Las bajas de cuenta del super admin eran app/admin/BajasDeCuenta.tsx; desde el 6/11/2026, el aviso de la portada de Admin.)
  const ts = (await import('typescript')).default;
  const rotos: string[] = [];
  for (const f of [...archivos('app/m'), 'app/_chat/HiloMako.tsx', 'app/_chat/ReportarRespuesta.tsx', 'app/_components/CartelPagoCliente.tsx', 'app/perfil/EliminarCuenta.tsx', 'app/admin/_polar/web/DashboardOverview/EsperaBanners.tsx']) {
    if (!f.endsWith('.tsx')) continue;
    const s = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX) as unknown as { parseDiagnostics: unknown[] };
    if (s.parseDiagnostics.length) rotos.push(f);
  }
  assert.deepEqual(rotos, []);
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
// 4/11/2026, ningún teléfono (base 12 / 0; una rotura por vez, restaurada de memoria y comparada por hash):
//   · `masCompleto` sin `sinLoQueVende`                       -> 11 / 1 (9: las dos, en Android y en iPhone Safari; y caen
//     también tests/movil-toda-tab.test.ts y tests/sidebar-nueva.test.ts)
//   · `sinLoQueVende` sin mirar adentro de un desplegable     -> 11 / 1 (9)
//   · `partners` fuera de TABS_QUE_VENDEN                     -> 11 / 1 (9)
//   · /m/partners vuelve a cortar sólo en iPhone              -> 11 / 1 (9b)
//   · /m/agency sin el corte                                  -> 11 / 1 (9b)
//   · el corte de /m/partners después de leer la query        -> 11 / 1 (9b)
//   · el botón de Google sin la condición                     -> 8 / 1 (8)
//   · la marca distinta de la de Capacitor                    -> 8 / 1 (5)
//   · un iPhone cualquiera prende el modo                     -> 8 / 1 (5)
//   · un `<div>` de menos en PostM (lo que pasó en 2d833218b, y ningún test lo vio: lo encontró la revisión) -> 11
