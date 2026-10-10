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
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TORTAS, porcentajes, CONTRIB_PRO, LTV_PRO, TECHO_PRO, TECHO_GROWTH, COSTO_REFERIDO,
  VIDA_PRO, VIDA_GROWTH, COMISION_GRUPAL,
  HITO_ANUNCIOS, HITO_PLATA, HITO_FIN, hoyAR, faltan, usd,
  AGENDADAS, EFECTIVAS, VENTAS, PAUTA, FACTURADO, NETO, OBJETIVO_MES_USD, PRECIO_GRUPAL,
  VENTAS_OBJETIVO, AGENDAS_OBJETIVO, COBRADO_EN_EL_MES,
  CAC_GRUPAL, CAC_PRO, CAC_CAMPANA_GRUPAL, DEJA_GRUPAL, LOOMS_POR_VENTA, CANALES,
} from '../app/admin/estrategia/datos';
import { ADMIN_FAMILIAS, FAMILIAS, itemsDe } from '../app/_components/nav';

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

test('las porciones son las que se decidieron el 10/10 (IA de HOY, no la del ruteo)', () => {
  const porTorta = Object.fromEntries(TORTAS.map((t) => [t.clave, t.porciones.map((p) => p.usd)]));
  assert.deepEqual(porTorta.pro, [19.5, 9.37, 14.9, 3.23]);
  assert.deepEqual(porTorta.growth, [42.49, 10.2, 38.18, 6.13]);
  assert.deepEqual(porTorta.grupal, [890.33, 300, 100, 143.37, 66.3]);
  assert.equal(CONTRIB_PRO, 28.87);
  assert.equal(LTV_PRO, 251.17);
});

test('la captación de cada torta sale del MISMO techo que dibuja «Lo que cuesta conseguir un cliente»', () => {
  // Con «un tercio de la contribución», la torta del 97 implicaba un techo de 272,23
  // mientras la barra del techo, en la misma página, decía 158,07 (payback).
  const captacion = (clave: string) => TORTAS.find((t) => t.clave === clave)!.porciones.find((p) => p.clave === 'conseguir')!.usd;
  assert.equal(captacion('pro'), Math.round((TECHO_PRO / VIDA_PRO) * 100) / 100);
  assert.equal(captacion('growth'), Math.round((TECHO_GROWTH / VIDA_GROWTH) * 100) / 100);
  assert.equal(captacion('grupal'), COMISION_GRUPAL);
  // Mismo color, mismo nombre en las tres tortas.
  for (const t of TORTAS) {
    assert.equal(t.porciones[0].label, 'Ganancia', `${t.clave}: la porción verde`);
    assert.equal(t.porciones.find((p) => p.clave === 'conseguir')!.label, 'Captación', `${t.clave}: la porción dorada`);
  }
});

test('referidos: los costos de la decisión del 10/10 y cada uno debajo de su techo', () => {
  // Martín escribió 81,50 (techo), 78,23, 80,56 y 124,99. El 124,99 sale de
  // redondear 45,435 antes de sumar; calculado de una vez da 124,98.
  assert.ok(Math.abs(TECHO_PRO - 81.5) < 0.05, `techo del 47: ${TECHO_PRO}`);
  assert.equal(TECHO_GROWTH, 158.07);
  const costos = Object.fromEntries(COSTO_REFERIDO.map((c) => [c.clave, c.usd]));
  assert.equal(costos.pro, 78.23);
  assert.equal(costos.revendedor, 80.56);
  assert.ok(Math.abs(costos.growth - 124.99) <= 0.01, `97 referido: ${costos.growth}`);
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

test('la proyección es la de la página de estrategia, y lo facturado sale de las ventas, no del objetivo', () => {
  assert.deepEqual([AGENDADAS, EFECTIVAS, VENTAS, PAUTA], [15, 12, 5, 1000]);
  // Los 10.000 salían del mix viejo (1 a 1 de 4.000 + grupales): con la oferta de hoy,
  // 5 ventas son 5 grupales.
  assert.equal(FACTURADO, VENTAS * PRECIO_GRUPAL);
  assert.deepEqual([FACTURADO, NETO, COBRADO_EN_EL_MES], [7500, 6500, 2500]);
  assert.notEqual(NETO, OBJETIVO_MES_USD - PAUTA, 'el neto no puede salir del objetivo');
  // La brecha: lo que hace falta para llegar al objetivo con la misma asistencia y cierre.
  assert.deepEqual([VENTAS_OBJETIVO, AGENDAS_OBJETIVO], [7, 22]);
});

test('el costo de conseguir un cliente: el grupal contra lo que deja, el 47 sin el Free', () => {
  // La campaña de esta página vende el grupal: 1.000 ÷ (8 × 0,8 × 0,4) = 390,625
  // (en coma flotante 2,56 es 2,5600000000000005, y redondea a 390,62).
  assert.ok(Math.abs(CAC_CAMPANA_GRUPAL - 390.625) < 0.01, `campaña: ${CAC_CAMPANA_GRUPAL}`);
  assert.equal(DEJA_GRUPAL, 1190.33);
  for (const f of CAC_GRUPAL) assert.ok(f.usd <= DEJA_GRUPAL, `${f.label}: ${f.usd}`);
  assert.equal(LOOMS_POR_VENTA, 89);
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
  const vieja = sinComentarios(leer('app/vsl/estrategia/page.tsx'));
  assert.match(vieja, /redirect\('\/admin\/estrategia'\)/);
  // El item vive en la familia de ADMIN, y ninguna familia de clientes enlaza la tab:
  // buscar la línea en el archivo daba verde aunque se mudara a la barra de los clientes.
  const admin = ADMIN_FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'admin-estrategia');
  assert.equal(admin?.href, '/admin/estrategia');
  const deClientes = FAMILIAS.flatMap(itemsDe).filter((i) => i.href.startsWith('/admin/estrategia'));
  assert.deepEqual(deClientes.map((i) => i.key), []);
});
