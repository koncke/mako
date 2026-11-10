// =============================================================================
// /admin/estrategia — las tortas suman exacto, los números salen de las fuentes
// =============================================================================
// La tab junta el runway, el modelo de costos y la estrategia de adquisición, y
// los números se IMPORTAN (app/admin/estrategia/datos.ts). Estas guardas fijan lo
// que no se ve leyendo el código:
//   · que cada torta sume su total al centavo y sus % den 100,0;
//   · que las cuentas que Martín dio por buenas el 10/10 sigan saliendo de los
//     exports (si alguien cambia UNIT_V2 o IA_POR_PRO, la tab cambia sola — y si
//     el cambio rompe la decisión, esto lo dice);
//   · que «hoy» sea la fecha de Argentina y no la UTC;
//   · y que la tab siga cerrada a quien no es super admin.
//
// Probado rompiéndolo (10/10/2026), una rotura por vez sobre una base de 8/8 en
// verde, restaurando entre una y otra:
//   · los % redondeados cada uno por su lado (sin mayor resto) → 7 pases, 1 fallo:
//     el grupal suma 100,1.
//   · la primera porción con un centavo de más → 6 pases, 2 fallos.
//   · la IA del ruteo (UNIT_V2.pro.iaUsd, 3,47) en vez de la de hoy
//     (IA_POR_PRO.hoyUsd, 10,90) → 6 pases, 2 fallos (la torta del 47 y el techo).
//   · hoyAR con toISOString → 7 pases, 1 fallo (las 22:30 de Buenos Aires).
//   · sin el guard getSesionAdmin en el page → 7 pases, 1 fallo.
// Lo que NO caza: calcular la ganancia por su cuenta (contribución − CAC) en vez
// de «total − el resto» da 19,25 y 35,13 igual con los números de hoy; el guard de
// la suma al centavo vale para el día que el redondeo no acompañe.
//
// Segunda tanda (10/10/2026, tras la verificación), también probada rompiéndola
// sobre una base de 11/11 en verde, restaurando de memoria entre una y otra:
//   · la captación del 47 (y aparte la del 97) como «un tercio de la contribución»
//     (la regla 3:1) en vez de techo ÷ vida → 9 pases, 2 fallos cada una (las
//     porciones y «la captación sale del techo»).
//   · NETO = OBJETIVO − PAUTA (el «Facturado 10.000» de antes) → 10 pases, 1 fallo.
//   · el canal a WhatsApp con el Free adentro (CAC_CANALES crudo, 176) → 10 pases, 1 fallo.
//   · una familia de clientes (FAMILIAS) con un item a /admin/estrategia → 10 pases, 1 fallo.
//   · «2 · Plata» de vuelta en el tramo del revendedor → 10 pases, 1 fallo.
//
// Tercera tanda (10/10/2026, «eliminaste cosas… que estaban buenas» y «utiliza más
// desplegables»): la página DIBUJADA, no el fuente. Probada rompiéndola sobre una
// base de 14/14 en verde, restaurando de memoria entre una y otra (el resultado de
// cada rotura, en el comentario de su test).
//
// Cuarta tanda (10/10/2026, las cuatro decisiones de Martín: la ventana en vez del mes,
// el objetivo de 15.000, el 1 a 1 de 10.000, Jan reescrito y /vsl/costos privada). Cinco
// roturas sobre una base de 15/15 en verde, restaurando de memoria: las cinco dieron 14
// pases y 1 fallo, cada una en su test.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TORTAS, porcentajes, CONTRIB_PRO, LTV_PRO, TECHO_PRO, TECHO_GROWTH, COSTO_REFERIDO,
  VIDA_PRO, VIDA_GROWTH, COMISION_GRUPAL,
  HITO_ANUNCIOS, HITO_PLATA, HITO_FIN, hoyAR, faltan, usd,
  AGENDADAS, EFECTIVAS, VENTAS, PAUTA, FACTURADO, NETO, OBJETIVO_USD, PRECIO_GRUPAL,
  VENTAS_OBJETIVO, AGENDAS_OBJETIVO, PRIMERAS_CUOTAS, DIAS_VENTANA, PAUTA_TOTAL, PRECIO_1A1,
  CAC_GRUPAL, CAC_PRO, CAC_CAMPANA_GRUPAL, DEJA_GRUPAL, CONVERSACIONES_POR_VENTA, CANALES,
  ANALISIS, FUTURO, DIAG, JAN_GANA, JAN_GANO,
} from '../app/admin/estrategia/datos';
import { textoPlazo } from '../app/admin/runway/datos';
import { PASARELA, IMPUESTO, META_CLIENTES, cacPorMes } from '../lib/economia-unitaria';
import { techoDeIa, USO_SUPUESTO } from '../lib/uso-del-cupo';
import { fijoDeMartin } from '../lib/costos-fijos';
import Estrategia from '../app/admin/estrategia/Estrategia';
import { ADMIN_NAV, FAMILIAS, itemsDe } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const centavos = (n: number) => Math.round(n * 100);

test('cada torta suma su total al centavo, y sus % dan 100,0', () => {
  assert.equal(TORTAS.length, 3);
  for (const t of TORTAS) {
    const suma = t.porciones.reduce((s, p) => s + centavos(p.usd), 0);
    assert.equal(suma, centavos(t.total), `${t.clave}: las porciones suman ${suma / 100}, no ${t.total}`);
    for (const p of t.porciones) assert.ok(p.usd > 0, `${t.clave}: «${p.label}» vale ${p.usd}`);
    const pcts = porcentajes(t.porciones.map((p) => p.usd), t.total);
    assert.equal(Math.round(pcts.reduce((s, n) => s + n, 0) * 10), 1000, `${t.clave}: los % suman ${pcts}`);
    // Una dona de más de 6 porciones ya no se lee de un vistazo (skill dataviz).
    assert.ok(t.porciones.length <= 6, `${t.clave}: ${t.porciones.length} porciones`);
  }
});

test('las tortas del 47 y del 97 van con el modelo del 7/11 (10/11/2026), y la del grupal no cambió', () => {
  // 97: ganancia 61,53 · captación 10,78 (97 ÷ 9 meses, Martín 10/11; antes 4,37 con 22,2) · servir 14,83 (video 6,06 = 25% de 24,25 + fijo 8,77 = 438,25 ÷ 50)
  //     · impuesto 8,11 (8,36%) · cobro 1,75 (Mercado Pago 1,80%). La de antes decía Paddle y US$25,18 de IA de MaKo.
  const porTorta = Object.fromEntries(TORTAS.map((t) => [t.clave, t.porciones.map((p) => p.usd)]));
  assert.deepEqual(porTorta.pro, [19.74, 10.78, 11.7, 3.93, 0.85]);
  assert.deepEqual(porTorta.growth, [61.53, 10.78, 14.83, 8.11, 1.75]);
  assert.deepEqual(porTorta.grupal, [890.33, 300, 100, 143.37, 66.3]);
  // §9 sigue con UNIT_V2 (no se tocó el 10/11): estos dos siguen siendo los del 10/10.
  assert.equal(CONTRIB_PRO, 28.87);
  assert.equal(LTV_PRO, 251.17);
});

test('cada porción del 47 y del 97 sale de donde vive su número, no escrita en la tab', () => {
  // Rotura: la pasarela escrita a mano (0,018) en vez de PASARELA → si cambia en Costs, la torta ya no lo sigue.
  const de = (clave: string, p: string) => TORTAS.find((t) => t.clave === clave)!.porciones.find((x) => x.clave === p)!.usd;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const [clave, precio, plan] of [['pro', 47, 'pro'], ['growth', 97, 'growth']] as const) {
    assert.equal(de(clave, 'cobro'), r2(precio * PASARELA), `${clave}: el cobro es la pasarela`);
    assert.equal(de(clave, 'impuesto'), r2(precio * IMPUESTO), `${clave}: el impuesto va APARTE de la pasarela`);
    assert.equal(de(clave, 'conseguir'), r2(cacPorMes()), `${clave}: la captación es el CAC repartido, el mismo que usa Costs`);
    assert.equal(de(clave, 'servir'), r2(techoDeIa(plan) * USO_SUPUESTO + fijoDeMartin() / META_CLIENTES), `${clave}: video + fijo`);
  }
  // Lo que ya no existe no se dibuja: ni Paddle ni la IA de texto a cargo de MaKo.
  const textos = TORTAS.filter((t) => t.clave !== 'grupal').flatMap((t) => t.porciones.map((p) => `${p.label} ${p.cuenta}`)).join(' ');
  assert.doesNotMatch(textos, /Paddle/);
  assert.doesNotMatch(textos, /soporte|infra/);
});

test('la captación del grupal es la comisión del referido, y los nombres y colores son los mismos en las tres tortas', () => {
  const captacion = (clave: string) => TORTAS.find((t) => t.clave === clave)!.porciones.find((p) => p.clave === 'conseguir')!.usd;
  assert.equal(captacion('grupal'), COMISION_GRUPAL);
  // Mismo color, mismo nombre en las tres tortas.
  for (const t of TORTAS) {
    assert.equal(t.porciones[0].label, 'Ganancia', `${t.clave}: la porción verde`);
    assert.equal(t.porciones.find((p) => p.clave === 'conseguir')!.label, 'Captación', `${t.clave}: la porción dorada`);
  }
});

test('referidos: los costos de la decisión del 10/10 y cada uno debajo de su techo', () => {
  // Martín escribió 81,50 (techo), 78,23, 80,56 y 124,99. El del 97 quedó en 130,46 (17/10/2026, docs/referidos.md:56):
  // con el 50% del 1er mes ese mes ya es un pago, y «pagó 2 meses» es el mes 2 (r, no r²).
  // Rotura: LLEGA_97 con r² otra vez → 1 fallo (éste).
  assert.ok(Math.abs(TECHO_PRO - 81.5) < 0.05, `techo del 47: ${TECHO_PRO}`);
  assert.equal(TECHO_GROWTH, 158.07);
  const costos = Object.fromEntries(COSTO_REFERIDO.map((c) => [c.clave, c.usd]));
  assert.equal(costos.pro, 78.23);
  assert.equal(costos.revendedor, 80.56);
  assert.equal(costos.growth, 130.46, `97 referido: ${costos.growth}`);
  for (const c of COSTO_REFERIDO) assert.ok(c.usd <= c.techo, `${c.label}: ${c.usd} > techo ${c.techo}`);
});

test('el runway se lee de sus hitos, no de fechas escritas en la tab', () => {
  assert.equal(HITO_ANUNCIOS.fecha, '2026-11-01');
  assert.equal(HITO_PLATA.fecha, '2026-11-30');
  assert.equal(HITO_FIN.fecha, '2026-12-15');
  const src = sinComentarios(leer('app/admin/estrategia/Estrategia.tsx'));
  assert.doesNotMatch(src, /'2026-\d\d-\d\d'/, 'Estrategia.tsx tiene una fecha escrita a mano');
});

test('«hoy» es la fecha de Buenos Aires, no la UTC', () => {
  // 01:30 UTC del 11/10 son las 22:30 del 10/10 en Argentina.
  assert.equal(hoyAR(new Date('2026-10-11T01:30:00Z')), '2026-10-10');
  assert.equal(faltan('2026-11-01', '2026-10-10'), 22);
  const page = sinComentarios(leer('app/admin/estrategia/page.tsx'));
  // Adentro del componente, no a nivel módulo.
  assert.match(page, /export default async function[\s\S]*const hoy = hoyAR\(\)/);
});

test('el runway cuenta contra el «hoy» de Buenos Aires y dice VENCIDO, no «0 días»', () => {
  // El 7/10 pasó y la tarjeta «Al primer deadline» quedó en «0 días» en rojo, que se lee
  // «es hoy», para siempre: `Math.max(0, …)` tapaba el vencimiento.
  // Rota: `textoPlazo` con el `Math.max(0, …)` de vuelta → 15 pases, 1 fallo; `hoy` con
  // `toISOString()` en vez de `hoyAR()` → 15 pases, 1 fallo.
  assert.equal(textoPlazo(faltan('2026-10-07', '2026-10-13')), 'venció hace 6 días');
  assert.equal(textoPlazo(faltan('2026-10-14', '2026-10-13')), '1 día');
  assert.equal(textoPlazo(0), 'hoy');
  assert.equal(textoPlazo(-1), 'venció ayer');
  assert.equal(textoPlazo(22), '22 días');
  const page = sinComentarios(leer('app/admin/runway/foto/page.tsx'));
  // Adentro del componente y en hora de acá, igual que Strategy.
  assert.match(page, /export default async function[\s\S]*const hoy = hoyAR\(\)/);
  assert.doesNotMatch(page, /toISOString/, 'el runway volvió a contar en UTC');
  assert.doesNotMatch(page, /Math\.max\(0/, 'el runway volvió a tapar los vencidos con un 0');
});

test('la proyección es la de la ventana entera, y lo facturado sale de las ventas, no del objetivo', () => {
  // Decisión del 10/10: la pauta es US$2.000 EN TOTAL de punta a punta de la ventana de
  // los anuncios (1/11 al 15/12), el objetivo es US$15.000 en esa ventana, y la
  // prospección se estira proporcional (1.000 por mes × 1,5).
  // Rota: PAUTA_TOTAL en 1.000 → 14 pases, 1 fallo; la prospección SIN estirar (1.000
  // en total) → 14 pases, 1 fallo.
  assert.equal(DIAS_VENTANA, 45);
  assert.equal(PAUTA, PAUTA_TOTAL);
  assert.deepEqual(CANALES.map((c) => c.embudo.map((e) => e.n)), [[1500, 300, 10], [800, 560, 16]]);
  assert.deepEqual([AGENDADAS, EFECTIVAS, VENTAS, PAUTA], [26, 21, 8, 2000]);
  assert.equal(FACTURADO, VENTAS * PRECIO_GRUPAL);
  assert.deepEqual([FACTURADO, NETO, PRIMERAS_CUOTAS], [12000, 10000, 4000]);
  assert.equal(OBJETIVO_USD, 15000);
  assert.notEqual(NETO, OBJETIVO_USD - PAUTA, 'el neto no puede salir del objetivo');
  // La brecha: lo que hace falta para llegar al objetivo con la misma asistencia y cierre.
  assert.deepEqual([VENTAS_OBJETIVO, AGENDAS_OBJETIVO], [10, 32]);
});

test('el costo de conseguir un cliente: el grupal contra lo que deja, el 47 sin el Free', () => {
  // La campaña de esta página vende el grupal: 2.000 ÷ (16 × 0,8 × 0,4) = 390,625
  // (en coma flotante 5,12 no es exacto, y redondea a 390,62). Es el mismo costo que
  // con la pauta de 1.000: cambia el volumen, no la tasa.
  assert.ok(Math.abs(CAC_CAMPANA_GRUPAL - 390.625) < 0.01, `campaña: ${CAC_CAMPANA_GRUPAL}`);
  assert.equal(DEJA_GRUPAL, 1190.33);
  for (const f of CAC_GRUPAL) assert.ok(f.usd <= DEJA_GRUPAL, `${f.label}: ${f.usd}`);
  assert.equal(CONVERSACIONES_POR_VENTA, 89);
  // El 47 solo, con sus medios y sin el Free que hoy no existe.
  const pro = Object.fromEntries(CAC_PRO.map((f) => [f.label, f.usd]));
  assert.equal(pro['Mensajes a WhatsApp → registro'], 100);
  assert.equal(pro['Anuncio a la landing'], 124.22);
  assert.equal(pro['Referido'], COSTO_REFERIDO[0].usd);
  // Las filas del 47 NO se llaman como los canales A y B de la estrategia (que venden el grupal).
  const nombresCanales = CANALES.map((c) => c.nombre);
  for (const f of CAC_PRO) assert.ok(!nombresCanales.includes(f.label), `«${f.label}» se confunde con un canal de la estrategia`);
});

test('copy en español neutro: ni «plata» ni «anuncios pagos» en lo que se dibuja', () => {
  for (const r of ['app/admin/estrategia/Estrategia.tsx', 'app/admin/estrategia/datos.ts']) {
    const src = sinComentarios(leer(r));
    // Ni `est-riel-plata` (una clase) ni `HITO_PLATA` (un nombre): sólo la palabra suelta.
    assert.doesNotMatch(src, /(?<![-\w])plata(?![-\w])/i, `${r} dice «plata»`);
    assert.doesNotMatch(src, /anuncios pagos/i, `${r} dice «anuncios pagos»`);
  }
});

test('formato: punto de miles y coma decimal', () => {
  assert.equal(usd(1500), 'US$1.500');
  assert.equal(usd(43.77), 'US$43,77');
  assert.equal(usd(0.03), 'US$0,03');
});

test('la tab es sólo para el super admin, y /vsl/estrategia redirige a ella', () => {
  const page = sinComentarios(leer('app/admin/estrategia/page.tsx'));
  assert.match(page, /const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\('\/inicio'\);/);
  assert.doesNotMatch(page, /requireRolWs/, 'requireRolWs([]) la abriría al dueño de cada workspace');
  // /vsl/costos también, desde el 10/10: cae bajo '/vsl' (pública por la landing), así
  // que el guard es lo ÚNICO que la cierra. Rota: sin las dos líneas → 14 pases, 1 fallo.
  const costos = sinComentarios(leer('app/vsl/costos/page.tsx'));
  assert.match(costos, /const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\('\/inicio'\);\s*return <Costos \/>/);
  const vieja = sinComentarios(leer('app/vsl/estrategia/page.tsx'));
  assert.match(vieja, /redirect\('\/admin\/estrategia'\)/);
  // El item es una herramienta del super admin (ADMIN_NAV). Del 17/10 al 29/10/2026 fue una SECCIÓN de Offer que sólo veía
  // él; desde el 29/10 Offer no tiene pestañas (Martín: «sin otras tabs, incluso en SuperAdmin») y Strategy es un link al
  // pie de la lista de ofertas, que la pantalla dibuja sólo con `superAdmin` (el server lo saca de getSesionAdmin).
  const admin = ADMIN_NAV.find((i) => i.key === 'admin-estrategia');
  assert.equal(admin?.href, '/admin/estrategia');
  const enBarra = FAMILIAS.flatMap(itemsDe).filter((i) => i.href.startsWith('/admin/estrategia'));
  assert.deepEqual(enBarra, [], 'Strategy volvió a ser una pestaña');
  assert.match(sinComentarios(leer('app/offer/OfferApp.tsx')),
    /pieLista=\{superAdmin \? \([\s\S]*?<Link href="\/admin\/estrategia">Strategy<\/Link>[\s\S]*?\) : undefined\}/,
    'Strategy cuelga del pie de Offer y sólo para el super admin');
  assert.match(sinComentarios(leer('app/offer/page.tsx')), /const superAdmin = \(await getSesionAdmin\(\)\) != null;/);
  // ⚠️ 2/11/2026 — ANTES ESTO PEDÍA QUE LA BARRA MARCARA «OFFER» ESTANDO EN STRATEGY, porque
  // Strategy no tenía renglón propio en la barra del cliente y colgaba del de Offer. Al sacar Offer
  // («la de offer no la quiero»), lo que corresponde es que marque SU PROPIO renglón, que existe:
  // `admin-estrategia` en ADMIN_NAV. O sea que Strategy NO quedó huérfana — eso se verificó antes
  // de sacar el renglón, no después.
  assert.equal(FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'offer')?.match('/admin/estrategia'), true,
    'estando en Strategy, la barra no marca Offer');
  // ⚠️ Y desde el 2/11/2026 Offer no se DIBUJA («la de offer no la quiero»), así que estando en
  // Strategy quien marca es su propio renglón de ADMIN_NAV. Se verificó que existe ANTES de sacar
  // Offer de la barra: si no, Strategy se quedaba sin nada que la marcara.
  assert.equal(admin?.match('/admin/estrategia'), true, 'Strategy se quedó sin renglón propio: la barra no marcaría nada');
  assert.equal(puedeVerItem(admin!, { adminShell: false, rolWs: 'admin', capa: 'completo' }), false, 'el admin de un cliente la vería');
  assert.equal(puedeVerItem(admin!, { adminShell: true, rolWs: '', capa: 'superadmin' }), true);
});

// ── La página dibujada ───────────────────────────────────────────────────────
const HTML = renderToStaticMarkup(createElement(Estrategia, { hoy: '2026-10-10' }));
/** Lo que se LEE: sin los `title` (un hover no se ve en el celular) y con las entidades resueltas. */
const VISIBLE = HTML.replace(/ title="[^"]*"/g, '')
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** Los desplegables de primer nivel: los que no llevan el modificador de hijo. */
const SECCIONES = [...HTML.matchAll(/<details class="est-det"( open="")?>([\s\S]*?)<\/summary>/g)];

test('cada sección es un desplegable numerado 01-12 con la pregunta que contesta, y sólo la 01 abre sola', () => {
  // Rota: sacar el `abierta` de la 01 → 13 pases, 1 fallo; la 08 numerada 07 → 13 pases,
  // 1 fallo. Una sección sin pregunta no compila (la prop es obligatoria): ésa es la otra red.
  assert.equal(SECCIONES.length, 12, `secciones: ${SECCIONES.length}`);
  const numeros = SECCIONES.map((m) => /est-det-n[^>]*>(\d\d)</.exec(m[2])?.[1]);
  assert.deepEqual(numeros, Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')));
  for (const [i, m] of SECCIONES.entries()) {
    const q = /est-det-q">([^<]*)</.exec(m[2])?.[1] ?? '';
    assert.ok(q.trim().length > 3, `la sección ${i + 1} no dice qué contesta`);
  }
  assert.deepEqual(SECCIONES.map((m) => !!m[1]), SECCIONES.map((_, i) => i === 0), 'abierta de entrada: sólo la 01');
  // Y los tres grupos, para saber de qué parte de la página es lo que se lee.
  for (const g of ['La estrategia', 'Los números', 'Lo que sigue']) assert.match(HTML, new RegExp(`est-grupo-t">${g}<`));
});

test('lo que Martín reclamó vuelve A LA VISTA: la intro, el cliente ideal y lo que estaba en un hover', () => {
  // Rota: los ejes sin su renglón (o sea, sólo en el `title`) → 13 pases, 1 fallo; sin «Qué
  // se mira antes de grabar» → 13/1; sin la intro → 13/1. Un `title` DE MÁS con el renglón
  // a la vista da verde, y está bien: lo que se pide es que se vea, no que no haya hover.
  assert.match(VISIBLE, /Cómo vamos a vender <span[^>]*>MaKo<\/span>/);
  assert.match(VISIBLE, /El cliente ideal/);
  assert.match(VISIBLE, /quiere correr/);
  assert.match(VISIBLE, /~US\$20 por día/);
  const faltan = [
    ...ANALISIS.map((a) => a.w), ...FUTURO.map((c) => c.que),
    ...DIAG, ...JAN_GANA.map((f) => f.t), ...JAN_GANO.map((f) => f.t),
  ].filter((t) => !VISIBLE.includes(t));
  assert.deepEqual(faltan, [], 'se dibujan sólo en un title, o no se dibujan');
});

test('la propuesta a Jan está escrita con el programa de referidos: no promete lo que el programa no da', () => {
  // Decisión del 10/10: «Reescribirla». Lo de julio prometía cinco cosas que el programa
  // no da (datos.ts, el comentario de JAN_GANA); ninguna puede volver por un copy viejo.
  // Rota: «Acceso personal de por vida» de vuelta en JAN_GANA → 14 pases, 1 fallo; el
  // premio del grupal escrito a mano («US$300») en vez de usd(COMISION_GRUPAL) da verde
  // con los números de hoy, y está bien: lo que se fija es que diga el del programa.
  const filas = [...JAN_GANA, ...JAN_GANO].map((f) => f.t);
  const prohibido = /de por vida|licencia de reventa|prueba gratuita extendida|% de las ganancias|recurrencia|sin mover un dedo/i;
  assert.deepEqual(filas.filter((t) => prohibido.test(t)), []);
  assert.ok(JAN_GANA.some((f) => f.t.includes(usd(COMISION_GRUPAL))), 'el premio del grupal');
  assert.doesNotMatch(VISIBLE, /Choca con referidos/);
  assert.match(HTML, /<details class="est-det est-det--hijo">/, 'Jan va en su propio desplegable');
});

test('el 1 a 1 está en la oferta a US$10.000, su contenido se arma con Offer y queda fuera de la proyección', () => {
  // Martín, 10/10: «que salga 10k» y «La defino yo»; 15/10: «Para esto justamente está la
  // funcionalidad de offer»: el contenido no se escribe en Strategy. Rota: sin la tarjeta → 14 pases, 1 fallo.
  assert.equal(PRECIO_1A1, 10000);
  assert.match(VISIBLE, /1 a 1<\/span><div class="est-precio"><b class="est-num">US\$10\.000<\/b>/);
  assert.match(VISIBLE, /Se arma con Offer/);
  // No hay embudo que lo venda: lo facturado son sólo grupales.
  assert.equal(FACTURADO % PRECIO_GRUPAL, 0);
});

test('la prospección va sin Loom: lo decidió Martín, y la sección 06 deja de ser una duda', () => {
  // Martín, 15/10/2026, en la Ticketera: «¿Un Loom personalizado por cada lead en la
  // prospección?» → «No». Rota: devolver «Un Loom VSL por cada lead» a la prospección → 16 pases, 1 fallo.
  assert.doesNotMatch(VISIBLE, /Un Loom VSL por cada lead|Grabo un Loom|Qué se mira antes de grabar/);
  assert.match(VISIBLE, /Sin Loom: un mensaje para todos/);
  assert.match(VISIBLE, /Decidido: sin Loom/);
  assert.doesNotMatch(VISIBLE, /Duda abierta/);
});
