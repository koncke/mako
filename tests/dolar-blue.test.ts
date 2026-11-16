// =============================================================================
// El precio en pesos de los planes, al dólar blue del día: la cuenta y los frenos (16/11/2026)
// =============================================================================
// Martín: «el checkout, si se cambia de Mercado Pago o tarjeta… debería cambiar de pesos a dólares… Y obviamente eso, la
// automatización debería estar creada… para actualizar diariamente al dólar blue del día». Lo hace app/api/cron/dolar-blue con
// lib/dolar-blue-corrida.ts (la corrida, con todo lo que toca el mundo por parámetro) y lib/dolar-blue-reglas.ts (la cuenta y los
// frenos). Acá se corre ENTERA, sin red y sin base: la consulta al servicio de cotizaciones, los settings y el aviso son de
// mentira, y lo que se mira es lo que se ESCRIBIRÍA.
//
// Las respuestas de los servicios son las de verdad (dolarapi.com y bluelytics, leídas el 16/11/2026 a las 03:30 ART con un GET):
// el formato que se parsea es el que contestan, no uno imaginado.
//
// LA REVISIÓN DEL 16/11 (hallazgo 1): el freno del salto comparaba contra «la del día anterior», que era la lectura frenada; un dato
// roto dos días seguidos se aplicaba solo y sin aviso. Ahora el salto se mide contra los PRECIOS EN VIGOR, uno de más del 15 % entra
// sólo si dolarapi.com y bluelytics coinciden dentro de un 3 %, todo cambio grande se avisa y el aviso del freno dice qué pasa mañana
// y cómo frenarlo (los tests 7, 8, 11 y 12).
// LA SEGUNDA REVISIÓN DEL 16/11 (los tests 13 a 17): si contestan los dos servicios y no coinciden se frena sea cual sea el salto, y
// todo cambio de más de un 5 % se avisa (hallazgo 1); un precio cambiado a mano no se pisa: el cron se apaga solo y avisa (2); la
// cotización de los precios sale de los planes activos (8); la clave del correo lleva la huella del cuerpo (9); y Settings › Payments
// tiene el cartel (2).
// PROBADO ROMPIÉNDOLO (16/11/2026; base 17 / 0), cada rotura restaurada antes de la siguiente (pasan / fallan): al pie.
// Correr: node --import tsx --test tests/dolar-blue.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { actualizarPesosAlBlue, claveDelAviso, type DepsBlue } from '../lib/dolar-blue-corrida';
import {
  AVISAR_DESDE, BANDA, CARTEL_DEL_BLUE, CLAVE_ESTADO_BLUE, COINCIDEN, DIAS_VIEJA, MONEDA_PESOS, RUTA_DE_LOS_PRECIOS, SALTO_MAXIMO, cotizacionDeLosPrecios,
  decidir, leerBluelytics, leerDolarApi, pesosDelPlan, type AvisoBlue,
} from '../lib/dolar-blue-reglas';
import { CLAVE_PLANES, planesDeSetting } from '../lib/planes-mako';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

// ── Lo de afuera, de mentira ────────────────────────────────────────────────────────────────────────────────────────────
const DOLARAPI = 'https://dolarapi.com/v1/dolares/blue';
const BLUELYTICS = 'https://api.bluelytics.com.ar/v2/latest';
/** Lo que contestó dolarapi.com el 16/11/2026. */
const R_DOLARAPI = { moneda: 'USD', casa: 'blue', nombre: 'Blue', compra: 1555, venta: 1575, fechaActualizacion: '2026-11-15T20:57:00.000Z' };
/** Lo que contestó bluelytics el 16/11/2026 (recortado a lo que se lee). */
const R_BLUELYTICS = { oficial: { value_avg: 1545, value_sell: 1572, value_buy: 1518 }, blue: { value_avg: 1553, value_sell: 1570, value_buy: 1536 }, last_update: '2026-11-13T19:45:52.537115-03:00' };
const AHORA = Date.parse('2026-11-16T21:05:00Z');

/**
 * El setting `planes.mako` como lo tiene producción (medido el 16/11: $ 73.555 y $ 151.805, US$47 y US$97 a 1.565), con dos cosas a
 * propósito: Pro con NUEVE renglones de `incluye` (`planValido` guarda ocho: si la corrida reescribiera desde los planes
 * normalizados, se perdería uno) y un campo que la app no conoce; y un tercer plan SIN precio en pesos, que tiene que seguir sin él.
 */
const PLANES = [
  { id: 'esencial', nombre: 'MaKo Essential', capa: 'completo', precioUsd: 47, preciosLocales: { ARS: 73555 }, resumen: 'Para empezar', incluye: ['a', 'b'], destacado: false, activo: true, precioAnualUsd: 470 },
  { id: 'pro', nombre: 'MaKo Pro', capa: 'agencia', precioUsd: 97, preciosLocales: { ARS: 151805, MXN: 1990 }, resumen: 'El recomendado', incluye: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], destacado: true, activo: true, precioAnualUsd: 970, notaDeMartin: 'no tocar' },
  { id: 'agencia-x', nombre: 'Agencia X', capa: 'agencia', precioUsd: 300, preciosLocales: { MXN: 5000 }, resumen: '', incluye: [], destacado: false, activo: false },
];
const CRUDO = JSON.stringify(PLANES);

type Mundo = { settings: Map<string, string | null>; escrituras: Array<{ clave: string; valor: string; cas: boolean }>; avisos: AvisoBlue[]; consultas: string[] };
function mundo(p: { respuestas?: Record<string, unknown | Error>; estado?: unknown; planes?: string | null; casPierde?: boolean } = {}): { d: DepsBlue; m: Mundo } {
  const m: Mundo = { settings: new Map([[CLAVE_PLANES, p.planes === undefined ? CRUDO : p.planes], [CLAVE_ESTADO_BLUE, p.estado === undefined ? null : JSON.stringify(p.estado)]]), escrituras: [], avisos: [], consultas: [] };
  const respuestas = p.respuestas ?? { [DOLARAPI]: R_DOLARAPI, [BLUELYTICS]: R_BLUELYTICS };
  const d: DepsBlue = {
    consultar: async (url) => {
      m.consultas.push(url);
      const r = respuestas[url];
      if (r === undefined) throw new Error('sin red');
      if (r instanceof Error) throw r;
      return r;
    },
    leer: async (clave) => m.settings.get(clave) ?? null,
    cambiarSi: async (clave, esperado, nuevo) => {
      if (p.casPierde || (m.settings.get(clave) ?? null) !== esperado) return false;
      m.settings.set(clave, nuevo); m.escrituras.push({ clave, valor: nuevo, cas: true }); return true;
    },
    guardar: async (clave, valor) => { m.settings.set(clave, valor); m.escrituras.push({ clave, valor, cas: false }); },
    avisar: async (aviso) => { m.avisos.push(aviso); },
    ahoraMs: () => AHORA,
  };
  return { d, m };
}
const planesEscritos = (m: Mundo) => JSON.parse(m.settings.get(CLAVE_PLANES)!) as typeof PLANES;
const estadoEscrito = (m: Mundo) => JSON.parse(m.settings.get(CLAVE_ESTADO_BLUE) ?? 'null');

// ── La cuenta ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('1. la cuenta: dólares del plan × la venta del blue, HACIA ARRIBA al millar (y la coma flotante no suma un millar)', () => {
  assert.equal(pesosDelPlan(47, 1575), 75_000, '47 × 1575 = 74.025 → 75.000');
  assert.equal(pesosDelPlan(97, 1575), 153_000, '97 × 1575 = 152.775 → 153.000');
  assert.equal(pesosDelPlan(40, 1500), 60_000, 'un número que ya es redondo se queda');
  assert.equal(pesosDelPlan(47, 1540), 73_000, 'nunca hacia abajo: 72.380 → 73.000, no 72.000');
  // 1,1 × 50.000 da 55000.00000000001 en coma flotante: sin redondear a la millonésima antes del techo, cobraría 56.000. Con un
  // plan en dólares enteros y un blue con dos decimales no se encontró ningún caso (se buscó en 1.000 a 3.000 con centavos), pero
  // un plan de US$ 1,10 en el setting alcanza.
  assert.equal(pesosDelPlan(1.1, 50_000), 55_000);
});

test('2. lee las respuestas DE VERDAD de los dos servicios, y descarta lo que no es una cotización', () => {
  assert.deepEqual(leerDolarApi(R_DOLARAPI), { venta: 1575, compra: 1555, fecha: '2026-11-15T20:57:00.000Z' });
  assert.deepEqual(leerBluelytics(R_BLUELYTICS), { venta: 1570, compra: 1536, fecha: '2026-11-13T22:45:52.537Z' });
  assert.equal(leerDolarApi({ ...R_DOLARAPI, casa: 'oficial' }), null, 'el oficial no es el blue');
  for (const venta of ['abc', null, 0, -1500, 15.75, 5_000_000]) assert.equal(leerDolarApi({ ...R_DOLARAPI, venta }), null, `venta ${String(venta)}`);
  assert.equal(leerDolarApi({ ...R_DOLARAPI, compra: 1600 }), null, 'una compra mayor que la venta es un dato roto');
  assert.equal(leerDolarApi({ ...R_DOLARAPI, fechaActualizacion: 'ayer' }), null);
  assert.equal(leerBluelytics({ blue: {} , last_update: '2026-11-13T19:45:52-03:00' }), null);
});

// ── Lo que escribe ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('3. escribe SÓLO el precio en pesos de los planes que ya lo tienen; el resto del setting queda igual, campo por campo', async () => {
  const { d, m } = mundo();
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'aplicado');
  assert.deepEqual(r.cambios, [{ id: 'esencial', antes: 73_555, despues: 75_000 }, { id: 'pro', antes: 151_805, despues: 153_000 }]);
  const escritos = planesEscritos(m);
  const esperado = PLANES.map((p) => (p.id === 'esencial' ? { ...p, preciosLocales: { ARS: 75_000 } } : p.id === 'pro' ? { ...p, preciosLocales: { ARS: 153_000, MXN: 1990 } } : p));
  assert.deepEqual(escritos, esperado, 'cambió algo más que el precio en pesos');
  assert.equal(escritos[1].incluye.length, 9, 'se reescribió desde los planes normalizados (planValido guarda 8 renglones)');
  assert.equal(escritos[1].notaDeMartin, 'no tocar');
  assert.ok(!('ARS' in escritos[2].preciosLocales), 'un plan sin precio en pesos ganó uno: eso prende Mercado Pago donde Martín no lo prendió');
  // Y lo que lee la app sale con los precios nuevos.
  const app = planesDeSetting(m.settings.get(CLAVE_PLANES)!);
  assert.deepEqual(app.map((p) => p.preciosLocales.ARS ?? null), [75_000, 153_000, null]);
  // Con compare-and-set contra LO LEÍDO, y el estado deja la cotización aplicada.
  const cas = m.escrituras.filter((e) => e.clave === CLAVE_PLANES);
  assert.equal(cas.length, 1);
  assert.equal(cas[0].cas, true, 'los planes se escribieron sin compare-and-set: podía pisar un cambio de Martín');
  const estado = estadoEscrito(m);
  assert.equal(estado.ultima.venta, 1575);
  assert.equal(estado.aplicada.venta, 1575);
  assert.equal(estado.freno, null);
  assert.deepEqual(m.avisos, []);
});

test('4. un link de pago ya emitido no cambia: la corrida sólo escribe los planes y su estado (y nada de cobros)', async () => {
  const claves = new Set<string>();
  for (const p of [{}, { estado: { ultima: { venta: 1000 } } }, { casPierde: true }, { respuestas: {} }]) {
    const { d, m } = mundo(p);
    await actualizarPesosAlBlue(d);
    for (const e of m.escrituras) claves.add(e.clave);
  }
  assert.deepEqual([...claves].sort(), [CLAVE_PLANES, CLAVE_ESTADO_BLUE].sort(), `escribió ${[...claves].join(', ')}`);
  // Y no recibe con qué tocar otra cosa: sus dependencias son las de arriba, y el archivo no habla con la base ni con los cobros.
  const fuente = leer('lib/dolar-blue-corrida.ts').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(fuente, /getSupabaseServer|getTenantDb|from\(['"]cobros['"]\)|crearCobro|\.from\(/, 'la corrida habla con la base por su cuenta');
});

test('5. si alguien guardó los planes mientras se calculaba, no los pisa (y mañana vuelve a probar)', async () => {
  const { d, m } = mundo({ casPierde: true });
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'cambio-mientras');
  assert.equal(m.settings.get(CLAVE_PLANES), CRUDO, 'pisó los planes');
  assert.equal(estadoEscrito(m).aplicada, undefined, 'anotó como aplicada una cotización que no se escribió');
});

// ── Los frenos ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('6. freno 1: si la cotización no llega (o no es un número, o es vieja), no toca nada y deja el aviso', async () => {
  for (const [que, respuestas] of [
    ['ningún servicio contesta', {}],
    ['los dos contestan basura', { [DOLARAPI]: { venta: 'abc' }, [BLUELYTICS]: { blue: null } }],
    [`es de hace más de ${DIAS_VIEJA} días`, { [DOLARAPI]: { ...R_DOLARAPI, fechaActualizacion: '2026-11-09T20:00:00Z' } }],
  ] as const) {
    const { d, m } = mundo({ respuestas: respuestas as Record<string, unknown> });
    const r = await actualizarPesosAlBlue(d);
    assert.equal(r.estado, 'frenado', que);
    assert.equal(m.settings.get(CLAVE_PLANES), CRUDO, `${que}: tocó los planes`);
    assert.equal(m.avisos.length, 1, `${que}: sin aviso`);
    assert.equal(estadoEscrito(m).freno.motivo, m.avisos[0].resumen);
    assert.match(m.avisos[0].texto, /Mañana a las 18:05/, `${que}: el aviso no dice qué pasa mañana`);
  }
  // Si el primero no contesta, se usa el segundo.
  const { d, m } = mundo({ respuestas: { [DOLARAPI]: new Error('503'), [BLUELYTICS]: R_BLUELYTICS } });
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'aplicado');
  assert.equal(r.cotizacion?.fuente, 'bluelytics.com.ar');
  assert.deepEqual(m.consultas, [DOLARAPI, BLUELYTICS]);
});

/** Lo que contestan los dos servicios con una venta dada (la compra, 20 pesos menos; la fecha, la de hoy). */
const DICEN = (dolarapi: number | null, bluelytics: number | null): Record<string, unknown> => ({
  ...(dolarapi != null ? { [DOLARAPI]: { ...R_DOLARAPI, compra: dolarapi - 20, venta: dolarapi } } : {}),
  ...(bluelytics != null ? { [BLUELYTICS]: { ...R_BLUELYTICS, blue: { value_avg: bluelytics - 10, value_sell: bluelytics, value_buy: bluelytics - 20 } } } : {}),
});

test(`7. frenos 2 y 3: un salto de más del ${SALTO_MAXIMO * 100} % contra los PRECIOS EN VIGOR entra sólo si los dos servicios coinciden (${COINCIDEN * 100} %)`, async () => {
  // Los precios de hoy dicen 1.565 (151.805 / 97). dolarapi dice 1.850 (+18,2 %) y bluelytics 1.570: no coinciden, no se toca nada.
  const { d, m } = mundo({ respuestas: DICEN(1850, 1570) });
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'frenado');
  assert.equal(Math.round(r.contra!), 1565, 'el salto no se midió contra los precios en vigor');
  assert.equal(m.settings.get(CLAVE_PLANES), CRUDO);
  assert.match(m.avisos[0].resumen, /dolarapi\.com dice \$ 1\.850 y bluelytics\.com\.ar dice \$ 1\.570: difieren un 17,8 %.*sería un salto de 18,2 %/);
  // El aviso del día 1 dice qué pasa mañana y cómo frenarlo.
  assert.match(m.avisos[0].texto, /Mañana a las 18:05.*si dolarapi\.com y bluelytics coinciden dentro de un 3 %, el precio nuevo se aplica solo/);
  assert.ok(m.avisos[0].texto.includes(`{"apagada":true}`) && m.avisos[0].texto.includes(CLAVE_ESTADO_BLUE), 'el aviso no dice cómo frenarlo');
  // Mañana, lo mismo: sigue frenado (antes, el día 2 se aplicaba solo porque comparaba contra la lectura frenada).
  assert.equal((await actualizarPesosAlBlue(d)).estado, 'frenado', 'el día 2 un dato sin confirmar se aplicó');
  assert.equal(m.settings.get(CLAVE_PLANES), CRUDO);
  // Con un solo servicio que contesta, tampoco.
  const { d: d2, m: m2 } = mundo({ respuestas: DICEN(1850, null) });
  assert.equal((await actualizarPesosAlBlue(d2)).estado, 'frenado');
  assert.match(m2.avisos[0].resumen, /el otro servicio no contestó/);
  // Un salto de menos del 15 % se aplica con uno solo; como es de más del 5 %, con aviso (el día a día, sin: el test 13).
  const { d: d3, m: m3 } = mundo({ respuestas: DICEN(1760, null) });
  assert.equal((await actualizarPesosAlBlue(d3)).estado, 'aplicado', '+12,5 % tenía que aplicarse');
  assert.equal(m3.avisos.length, 1, '+12,5 % se aplicó sin aviso');
  assert.match(m3.avisos[0].texto, /Sólo contestó dolarapi\.com/);
  // La lectura guardada ya no decide: con una «de ayer» cualquiera, se mide igual contra los precios (1.565 → 1.575: +0,6 %).
  const { d: d4 } = mundo({ estado: { ultima: { venta: 1300, compra: 1280, fecha: '2026-11-14T20:00:00Z', fuente: 'dolarapi.com', leidaEn: '2026-11-15T21:05:00Z' } } });
  const r4 = await actualizarPesosAlBlue(d4);
  assert.equal(r4.estado, 'aplicado');
  assert.equal(Math.round(r4.contra!), 1565);
});

test(`8. freno 4: nunca a más del doble o a menos de la mitad (×${BANDA}) de los precios en vigor, aunque los dos servicios coincidan`, async () => {
  const { d, m } = mundo({ respuestas: DICEN(4000, 3990) });
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'frenado');
  assert.match(r.motivo ?? '', /más del doble/);
  assert.equal(m.settings.get(CLAVE_PLANES), CRUDO);
  assert.match(m.avisos[0].texto, /no se aplica solo nunca/);
});

test('9. lo que no hace nada: apagada a mano, sin precio en pesos, y en seco', async () => {
  const apagada = mundo({ estado: { apagada: true } });
  assert.equal((await actualizarPesosAlBlue(apagada.d)).estado, 'apagado');
  assert.deepEqual([apagada.m.escrituras, apagada.m.consultas, apagada.m.avisos], [[], [], []]);
  // Sin el setting, los planes son los de fábrica (sin pesos): Mercado Pago no se ofrece y no hay nada que poner al día. Sin aviso.
  for (const planes of [null, JSON.stringify(PLANES.map((p) => ({ ...p, preciosLocales: {} })))]) {
    const sin = mundo({ planes });
    assert.equal((await actualizarPesosAlBlue(sin.d)).estado, 'sin-pesos');
    assert.deepEqual([sin.m.escrituras, sin.m.avisos], [[], []]);
  }
  const seco = mundo();
  const r = await actualizarPesosAlBlue(seco.d, { enSeco: true });
  assert.equal(r.estado, 'en-seco');
  assert.equal(r.cambios.length, 2, 'en seco tiene que decir qué cambiaría');
  assert.deepEqual([seco.m.escrituras, seco.m.avisos], [[], []]);
});

test('10. el cron: protegido como los otros, agendado una vez por día y con la corrida de verdad', () => {
  const ruta = leer('app/api/cron/dolar-blue/route.ts');
  assert.match(ruta, /export async function GET\(req: NextRequest\) \{\n  const auth = checkCronAuth\(req\);\n  if \(auth\) return auth;/, 'el cron no empieza con checkCronAuth');
  assert.match(ruta, /actualizarPesosAlBlue\(depsDeProduccion\(\)/);
  const crons = (JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons;
  const cron = crons.find((c) => c.path === '/api/cron/dolar-blue');
  assert.ok(cron, 'el cron no está en vercel.json: no corre nunca');
  assert.match(cron.schedule, /^\d{1,2} \d{1,2} \* \* \*$/, `una vez por día, no ${cron.schedule}`);
  assert.match(ruta, new RegExp(`«${cron.schedule.replace(/\*/g, '\\*')}»`), 'la cabecera del cron dice otro horario que vercel.json');
  // Lo de verdad lee el blue de los servicios de cotizaciones (Mercado Pago no lo publica) y con un tope de tiempo.
  const deVerdad = leer('lib/dolar-blue.ts');
  assert.match(deVerdad, /AbortSignal\.timeout\(/, 'la consulta al servicio de cotizaciones no tiene tope de tiempo');
  assert.match(deVerdad, /getSettingEstricto/, 'los planes se leen con getSetting: un error de lectura se leería como «no hay planes»');
});

test('11. la revisión: un servicio roto dos días seguidos (3.000 y 800) no mueve los precios, y cada día queda un aviso que lo dice', async () => {
  for (const roto of [3000, 800]) {
    const { d, m } = mundo({ respuestas: DICEN(roto, 1570) });
    for (let dia = 1; dia <= 2; dia++) {
      const r = await actualizarPesosAlBlue(d);
      assert.equal(r.estado, 'frenado', `${roto}, día ${dia}`);
    }
    assert.equal(m.settings.get(CLAVE_PLANES), CRUDO, `${roto}: los precios cambiaron`);
    assert.equal(m.avisos.length, 2, `${roto}: un aviso por día`);
    for (const a of m.avisos) assert.match(a.texto, /Los precios siguen como estaban[\s\S]*Mañana a las 18:05[\s\S]*"apagada":true/);
  }
});

test('12. un cambio grande que confirman los dos servicios se aplica, y SIEMPRE se avisa con lo que cambió', async () => {
  // Una devaluación de verdad: los dos dicen ~1.850 (1.850 y 1.830: 1,1 % de diferencia).
  const { d, m } = mundo({ respuestas: DICEN(1850, 1830) });
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'aplicado');
  assert.equal(r.confirmacion?.fuente, 'bluelytics.com.ar');
  assert.deepEqual(planesDeSetting(m.settings.get(CLAVE_PLANES)!).map((p) => p.preciosLocales.ARS ?? null), [pesosDelPlan(47, 1850), pesosDelPlan(97, 1850), null]);
  assert.equal(m.avisos.length, 1, 'un cambio grande se aplicó sin aviso');
  const a = m.avisos[0];
  assert.equal(a.tipo, 'cambio');
  assert.match(a.titulo, /subió un 18,2 %/);
  assert.ok(a.texto.includes('MaKo Essential: de $ 73.555 a $ 87.000 por mes'), a.texto);
  assert.ok(a.texto.includes('MaKo Pro: de $ 151.805 a $ 180.000 por mes'), a.texto);
  assert.match(a.texto, /Si está mal: frenar la automatización/);
  // En seco dice lo mismo sin escribir ni avisar.
  const seco = mundo({ respuestas: DICEN(1850, 1830) });
  assert.equal((await actualizarPesosAlBlue(seco.d, { enSeco: true })).estado, 'en-seco');
  assert.deepEqual([seco.m.escrituras, seco.m.avisos], [[], []]);
});

// ── La segunda revisión del 16/11 ───────────────────────────────────────────────────────────────────────────────────────

test(`13. (hallazgo 1) si contestan los dos y no coinciden, se frena con aviso SEA CUAL SEA EL SALTO; y todo cambio de más del ${AVISAR_DESDE * 100} % se avisa`, async () => {
  // El caso de la revisión: dolarapi 1.790 (+14,4 % contra 1.565) y bluelytics 1.570. Antes se aplicaba 1.790, sin aviso.
  const cot = (venta: number, fuente: string) => ({ venta, compra: null, fecha: '2026-11-16T20:00:00Z', fuente });
  assert.equal(decidir([cot(1790, 'dolarapi.com'), cot(1570, 'bluelytics.com.ar')], { vigente: 1565, ahoraMs: AHORA }).tipo, 'frenar');
  // Por la corrida, con un salto de +14,4 % y con uno de +2,2 % (difieren un 14 % y un 3,9 %): no se toca nada y queda el aviso.
  for (const [a, b] of [[1790, 1570], [1600, 1540]]) {
    const { d, m } = mundo({ respuestas: DICEN(a, b) });
    assert.equal((await actualizarPesosAlBlue(d)).estado, 'frenado', `${a} y ${b}`);
    assert.equal(m.settings.get(CLAVE_PLANES), CRUDO, `${a} y ${b}: tocó los precios`);
    assert.equal(m.avisos.length, 1, `${a} y ${b}: sin aviso`);
    assert.match(m.avisos[0].resumen, /difieren un/);
  }
  // Un cambio de +9,4 %, con los dos de acuerdo (1.712 y 1.700) o con uno solo: se aplica, y con aviso de lo que cambió.
  for (const respuestas of [DICEN(1712, 1700), DICEN(1712, null)]) {
    const { d, m } = mundo({ respuestas });
    assert.equal((await actualizarPesosAlBlue(d)).estado, 'aplicado');
    assert.equal(m.avisos.length, 1, 'un cambio de +9,4 % se aplicó sin aviso');
    assert.equal(m.avisos[0].tipo, 'cambio');
    assert.ok(m.avisos[0].texto.includes('MaKo Pro: de $ 151.805 a $ 167.000 por mes.'), m.avisos[0].texto);
  }
  // El día a día no llena la casilla: +2,2 % con los dos de acuerdo (1.600 y 1.590) se aplica sin aviso.
  const { d, m } = mundo({ respuestas: DICEN(1600, 1590) });
  assert.equal((await actualizarPesosAlBlue(d)).estado, 'aplicado');
  assert.deepEqual(m.avisos, []);
});

test('14. (hallazgo 2) un precio en pesos cambiado a mano no se pisa: la automatización se apaga sola, lo avisa y se puede prender', async () => {
  // Día 1: el cron pone los precios al blue y anota lo que dejó.
  const { d, m } = mundo();
  assert.equal((await actualizarPesosAlBlue(d)).estado, 'aplicado');
  assert.deepEqual(estadoEscrito(m).escritos, { esencial: 75_000, pro: 153_000 });
  assert.equal(estadoEscrito(m).escribiendo, undefined, 'quedó anotado como pendiente lo que ya se escribió');
  // Martín pone Pro en $ 140.000 en Settings › Payments. Antes, a las 18:05 volvía a $ 153.000 (+9,3 %, menos que el 15 %).
  const aMano = planesEscritos(m).map((p) => (p.id === 'pro' ? { ...p, preciosLocales: { ...p.preciosLocales, ARS: 140_000 } } : p));
  m.settings.set(CLAVE_PLANES, JSON.stringify(aMano));
  const consultas = m.consultas.length;
  assert.equal((await actualizarPesosAlBlue(d)).estado, 'a-mano');
  assert.equal(m.settings.get(CLAVE_PLANES), JSON.stringify(aMano), 'pisó el precio puesto a mano');
  assert.equal(m.consultas.length, consultas, 'leyó el blue igual');
  assert.equal(estadoEscrito(m).apagada, true, 'no se apagó: mañana lo pisa');
  assert.equal(estadoEscrito(m).escritos, undefined, 'al prenderla, compararía contra lo viejo y se volvería a apagar');
  const a = m.avisos.at(-1)!;
  assert.equal(a.tipo, 'freno');
  assert.ok(a.texto.includes('MaKo Pro: el cron lo había dejado en $ 153.000, y ahora está en $ 140.000.'), a.texto);
  assert.match(a.texto, /Para prenderla: sacar «apagada» del ajuste «planes\.dolar_blue»/);
  // Al día siguiente sigue apagada: ni lee, ni escribe, ni avisa otra vez.
  const antes = [m.escrituras.length, m.avisos.length];
  assert.equal((await actualizarPesosAlBlue(d)).estado, 'apagado');
  assert.deepEqual([m.escrituras.length, m.avisos.length], antes);
  // Prendida de nuevo: vuelve a poner todo al blue (también el de a mano: +9,1 %, con aviso) y anota lo nuevo.
  m.settings.set(CLAVE_ESTADO_BLUE, JSON.stringify({ ...estadoEscrito(m), apagada: undefined }));
  assert.equal((await actualizarPesosAlBlue(d)).estado, 'aplicado');
  assert.deepEqual(planesDeSetting(m.settings.get(CLAVE_PLANES)!).map((p) => p.preciosLocales.ARS ?? null), [75_000, 153_000, null]);
  assert.deepEqual(estadoEscrito(m).escritos, { esencial: 75_000, pro: 153_000 });
  assert.equal(m.avisos.at(-1)!.tipo, 'cambio');
  // Un plan que GANA precio en pesos a mano (le prendieron Mercado Pago) también es un cambio a mano; en seco, sin escribir.
  const conPesos = PLANES.map((p) => (p.id === 'agencia-x' ? { ...p, preciosLocales: { ARS: 400_000, MXN: 5000 } } : p));
  const nuevo = mundo({ planes: JSON.stringify(conPesos), estado: { escritos: { esencial: 73_555, pro: 151_805 } } });
  assert.equal((await actualizarPesosAlBlue(nuevo.d, { enSeco: true })).estado, 'a-mano');
  assert.deepEqual([nuevo.m.escrituras, nuevo.m.avisos], [[], []]);
  assert.equal((await actualizarPesosAlBlue(nuevo.d)).estado, 'a-mano');
  assert.ok(nuevo.m.avisos[0].texto.includes('Agencia X (apagado, no se ofrece): el cron no le había puesto precio en pesos, y ahora está en $ 400.000.'), nuevo.m.avisos[0].texto);
  // Lo que el cron dejó, o lo que estaba por escribir cuando se cortó (`escribiendo`), sigue siendo suyo: no es un cambio a mano.
  for (const estado of [{ escritos: { esencial: 73_555, pro: 151_805 } }, { escritos: { esencial: 70_000, pro: 150_000 }, escribiendo: { esencial: 73_555, pro: 151_805 } }]) {
    assert.equal((await actualizarPesosAlBlue(mundo({ estado }).d)).estado, 'aplicado', JSON.stringify(estado));
  }
});

test('15. (hallazgo 8) un plan apagado con pesos viejos no decide la cotización de los precios', async () => {
  // Un US$ 300 apagado con $ 200.000 (667 por dólar): antes mandaba él (el más caro) y el salto contra 1.575 daba +136 %.
  const conViejo = PLANES.map((p) => (p.id === 'agencia-x' ? { ...p, preciosLocales: { ARS: 200_000, MXN: 5000 } } : p));
  assert.equal(Math.round(cotizacionDeLosPrecios(conViejo)!), 1565);
  const { d, m } = mundo({ planes: JSON.stringify(conViejo) });
  const r = await actualizarPesosAlBlue(d);
  assert.equal(r.estado, 'aplicado');
  assert.equal(Math.round(r.contra!), 1565, 'el salto se midió contra el plan apagado');
  // Su precio en pesos se pone al día igual (si se vuelve a prender, ya está), y como cambia más del 5 %, se avisa diciendo que está apagado.
  assert.equal((planesEscritos(m)[2].preciosLocales as Record<string, number>)[MONEDA_PESOS], pesosDelPlan(300, 1575));
  assert.ok(m.avisos[0]?.texto.includes('Agencia X (apagado, no se ofrece): de $ 200.000 a $ 473.000 por mes.'), m.avisos[0]?.texto);
  // Sin ningún plan ACTIVO con pesos no hay nada que hacer: los pesos del apagado no cuentan.
  assert.equal(cotizacionDeLosPrecios(conViejo.map((p) => (p.activo ? { ...p, preciosLocales: {} } : p))), null);
});

test('16. (hallazgo 9) la clave del correo lleva la huella del cuerpo: dos avisos distintos del mismo día no chocan en Resend', () => {
  const base = { tipo: 'freno', dia: '2026-11-16', to: 'equipo@hola-mako.com', tag: 'dolar-blue', asunto: 'El precio en pesos de los planes no se actualizó hoy', preheader: 'x' };
  const a = claveDelAviso({ ...base, cuerpo: 'No llegó la cotización' }), b = claveDelAviso({ ...base, cuerpo: 'dolarapi.com dice $ 1.790' });
  assert.notEqual(a, b, 'dos avisos distintos del mismo tipo y día con la misma clave: Resend contesta 409 y el segundo se pierde');
  assert.equal(a, claveDelAviso({ ...base, cuerpo: 'No llegó la cotización' }), 'el mismo aviso reintentado tiene que llevar la misma clave');
  assert.match(a, /^dolar-blue-freno-2026-11-16-[0-9a-f]{32}$/);
  assert.match(leer('lib/dolar-blue.ts'), /idempotencyKey: claveDelAviso\(\{ \.\.\.correo, tipo: a\.tipo, dia \}\)/, 'el correo de verdad no usa la clave con la huella');
});

test('17. (hallazgo 2) Settings › Payments dice que el cron mueve los pesos y cómo apagarlo; los avisos llevan ahí, no a /admin/cobros', () => {
  assert.ok(CARTEL_DEL_BLUE.texto.includes(`{"apagada":true}`) && CARTEL_DEL_BLUE.texto.includes(CLAVE_ESTADO_BLUE), 'el cartel no dice cómo apagarlo');
  assert.match(CARTEL_DEL_BLUE.texto, /Si cambias uno a mano, el cron no lo pisa/);
  const pantalla = leer('app/admin/_polar/web/Settings/OrganizationPaymentSettings.tsx');
  assert.match(pantalla, /\{locales\.moneda === MONEDA_PESOS \? \(\s*<Box[^>]*>\s*<Alert variant="info" title=\{CARTEL_DEL_BLUE\.titulo\} description=\{CARTEL_DEL_BLUE\.texto\} \/>/, 'el cartel no está en el grupo de Mercado Pago');
  // /admin/cobros es un redirect a Sales: un aviso que lleva ahí no lleva a los precios.
  assert.equal(RUTA_DE_LOS_PRECIOS, '/admin/settings/payments');
  const deVerdad = leer('lib/dolar-blue.ts');
  assert.doesNotMatch(deVerdad.replace(/\/\/.*$/gm, ''), /'\/admin\/cobros'/, 'el aviso todavía lleva a /admin/cobros');
  assert.match(deVerdad, /linkApp\(RUTA_DE_LOS_PRECIOS, plataforma\)/);
});

// ── Probado rompiéndolo (16/11/2026) ───────────────────────────────────────────────────────────────────────────────────
// Base: 12 pasan / 0 fallan. Cada rotura, restaurada después (pasan / fallan):
//   · sin redondear a la millonésima antes del techo                          -> 9 / 1 (el 1)
//   · redondeo al millar más cercano, no hacia arriba                         -> 8 / 2 (el 1 y el 3)
//   · acepta una compra mayor que la venta                                    -> 9 / 1 (el 2)
//   · un plan sin precio en pesos gana uno                                    -> 8 / 2 (el 3 y el 9)
//   · los planes se escriben sin compare-and-set                              -> 8 / 2 (el 3 y el 5)
//   · el salto máximo pasa a 25 %                                             -> 10 / 2
//   · sin la red de la banda                                                  -> 11 / 1
//   · el salto vuelve a medirse contra la lectura guardada (`ultima`)         -> 10 / 2
//   · un salto grande se aplica con un solo servicio (sin pedir que coincidan) -> 10 / 2
//   · «coinciden» con un 30 % en vez de un 3 %                                -> 11 / 1
//   · un cambio grande aplicado no se avisa                                   -> 11 / 1
//   · el aviso del freno sin «qué pasa mañana»                                -> 8 / 4
//   · ignora el apagado a mano                                                -> 9 / 1 (el 9)
//   · el cron sin checkCronAuth                                               -> 9 / 1 (el 10)
// La segunda revisión. Base: 17 pasan / 0 fallan (scratchpad ronda-3/romper-blue.mjs, una rotura por vez y restaurada):
//   · los dos que no coinciden frenan sólo con un salto de más del 15 %        -> 16 / 1 (el 13)
//   · sólo se avisa el cambio grande                                          -> 13 / 4 (7, 13, 14 y 15)
//   · se avisa por el salto del blue, sin mirar cuánto cambia cada precio     -> 16 / 1 (el 15)
//   · no mira lo que dejó el cron (`escritos`)                                -> 16 / 1 (el 14)
//   · con un precio a mano frena pero no se apaga                             -> 16 / 1 (el 14)
//   · al apagarse deja `escritos` (al prenderla se volvería a apagar)          -> 16 / 1 (el 14)
//   · sin lo que estaba por escribir (`escribiendo`)                          -> 16 / 1 (el 14)
//   · no anota lo que dejó                                                    -> 16 / 1 (el 14)
//   · la cotización de los precios con los planes apagados                    -> 16 / 1 (el 15)
//   · la clave del correo sin la huella del cuerpo                            -> 16 / 1 (el 16)
//   · los avisos vuelven a /admin/cobros                                      -> 16 / 1 (el 17)
//   · Settings › Payments sin el cartel                                       -> 16 / 1 (el 17; y el 41 de admin-polar-ajustes)
