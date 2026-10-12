// El corte en HOY en UN lugar (contrato v5, punto 1): hasta el v4 lo repetían a mano seis puertas —la ruta,
// la página, el link compartido, la API de MaKo y el AI Analyst— y ninguna sabía que una fecha puede mirar
// hacia ADELANTE (`futuro`: el vencimiento de una cuota, lo que falta cobrar este mes). Ahora el período llega
// TAL CUAL y lo corta `datosDeGraficos` / `valoresDeCampo` (lib/graficos-datos.ts → `hastaDeFuente`), con la
// regla pura de lib/graficos-agregar.ts (`cortarEnHoy`, `hastaDeLectura`) sobre la de P1 (`hastaDe`).
// Y el plazo blando de cada lectura (`conPlazo`, «la hoja Landing lenta»).
// Correr: npx tsx --test tests/graficos-datos-corte.test.ts
//
// Probados rompiéndolos (12/10/2026, arnés que restaura de memoria), con la base en 0 fallos (8 tests):
//   · `negocio` fuera de HASTA_AYER                                         → 7 pass / 1 fail («la pauta…»)
//   · el «ayer» sin el piso del período (un período de hoy quedaba en ayer)  → 7 pass / 1 fail («la pauta…»)
//   · `fechaDeLectura` sin la primera fecha del conjunto                     → 7 pass / 1 fail («sin fecha pedida…»)
//   · /api/graficos volviendo a cortar el pedido (`hasta > hoy ? hoy : …`)   → 7 pass / 1 fail («las seis puertas…»)
//   · el AI Analyst mostrando el período sin `cortarEnHoy`                  → 7 pass / 1 fail («las seis puertas…»)
//   · `datosDeGraficos` con el hasta PEDIDO y no el de `hastaDeFuente`       → 7 pass / 1 fail («el corte vive…»)
//   · `conPlazo` sin la carrera (devuelve la promesa)                        → 7 pass / 1 fail («conPlazo…»)
//   · `conPlazo` con un `.then` suelto sobre la lectura (rechazo sin dueño) → 7 pass / 1 fail («conPlazo…»)
//   · la tarjeta con «No pude leer» en vez de «Tardó demasiado»              → 7 pass / 1 fail («datosDeGraficos y valoresDeCampo…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conPlazo, cortarEnHoy, hastaDeLectura, PlazoVencidoError } from '../lib/graficos-agregar';

const HOY = '2026-10-12';
const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios: las líneas PRIMERO y los bloques después (AGENTS.md). */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de primer nivel: desde su firma hasta su `}` de la columna 0. */
function cuerpoDe(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `«${firma}» no cierra`);
  return src.slice(i, fin + 2);
}

test('el período se corta en hoy… salvo que la fecha mire hacia adelante', () => {
  // Una fecha cualquiera: «Este mes completo» se lee hasta hoy.
  assert.equal(cortarEnHoy({ fuente: 'leads', fecha: 'alta' }, '2026-10-01', '2026-10-31', HOY), HOY);
  assert.equal(hastaDeLectura({ fuente: 'leads', fecha: 'alta' }, '2026-10-01', '2026-10-31', HOY), HOY);
  // El vencimiento de una cuota mira hacia adelante: lo que vence este mes llega a fin de mes.
  assert.equal(cortarEnHoy({ fuente: 'pagos', fecha: 'vencimiento' }, '2026-10-01', '2026-10-31', HOY), '2026-10-31');
  assert.equal(hastaDeLectura({ fuente: 'pagos', fecha: 'vencimiento' }, '2026-10-01', '2026-10-31', HOY), '2026-10-31');
  // La MISMA fuente con la fecha del pago no: un pago de mañana no existe.
  assert.equal(cortarEnHoy({ fuente: 'pagos', fecha: 'pago' }, '2026-10-01', '2026-10-31', HOY), HOY);
  // Los conjuntos del v5 que miran hacia adelante: lo pendiente del revenue y la cobranza.
  assert.equal(hastaDeLectura({ fuente: 'revenue', fecha: 'fecha' }, '2026-10-01', '2026-10-31', HOY), '2026-10-31');
  assert.equal(hastaDeLectura({ fuente: 'cobranza', fecha: 'vencimiento' }, '2026-10-01', '2026-10-31', HOY), '2026-10-31');
});

test('sin fecha pedida manda la primera del conjunto (la de `sanearGrafico`), también para el «futuro»', () => {
  // La primera fecha de `pagos` es el vencimiento: un gráfico de cuotas sin fecha no se corta.
  assert.equal(cortarEnHoy({ fuente: 'pagos' }, '2026-10-01', '2026-10-31', HOY), '2026-10-31');
  assert.equal(cortarEnHoy({ fuente: 'pagos', fecha: 'inventada' }, '2026-10-01', '2026-10-31', HOY), '2026-10-31');
  // Un conjunto que no existe se corta (lo seguro: no inventa un futuro).
  assert.equal(cortarEnHoy({ fuente: 'no-existe' }, '2026-10-01', '2026-10-31', HOY), HOY);
});

test('un período que ya terminó no se toca, y uno que empieza después de hoy no se da vuelta', () => {
  assert.equal(cortarEnHoy({ fuente: 'leads', fecha: 'alta' }, '2026-09-01', '2026-09-30', HOY), '2026-09-30');
  assert.equal(cortarEnHoy({ fuente: 'leads', fecha: 'alta' }, '2026-11-01', '2026-11-30', HOY), '2026-11-01');
  assert.equal(cortarEnHoy({ fuente: 'pagos', fecha: 'vencimiento' }, '2026-11-01', '2026-11-30', HOY), '2026-11-30');
});

test('la pauta (y lo que la cruza) se LEE hasta ayer; se MUESTRA hasta hoy', () => {
  for (const fuente of ['meta', 'negocio', 'presupuesto']) {
    assert.equal(cortarEnHoy({ fuente }, '2026-10-01', '2026-10-31', HOY), HOY, fuente);
    assert.equal(hastaDeLectura({ fuente }, '2026-10-01', '2026-10-31', HOY), '2026-10-11', fuente);
    // Un período de un solo día que es hoy: ayer queda antes del período, así que se lee su primer día.
    assert.equal(hastaDeLectura({ fuente }, HOY, HOY, HOY), HOY, fuente);
    // Uno que terminó antes de ayer no se toca.
    assert.equal(hastaDeLectura({ fuente }, '2026-09-01', '2026-09-30', HOY), '2026-09-30', fuente);
  }
});

test('las seis puertas YA NO cortan a mano: el período llega tal cual', () => {
  const puertas = [
    'app/api/graficos/route.ts',
    'app/dashboard/page.tsx',
    'app/compartido/[token]/informe-compartido.ts',
    'lib/api-mako/areas/dashboard.run.ts',
    'lib/graficos-analisis-server.ts',
  ];
  for (const p of puertas) {
    const src = sinComentarios(leer(p));
    assert.doesNotMatch(src, /hasta\s*>\s*hoy/, `${p} vuelve a cortar el período a mano`);
    assert.doesNotMatch(src, /\bacotar(AHoy)?\(/, `${p} vuelve a acotar el período a mano`);
  }
  // El AI Analyst y la API de MaKo MUESTRAN el período cortado con la regla de cada conjunto, no con la suya.
  assert.match(sinComentarios(leer('lib/graficos-analisis-server.ts')), /cortarEnHoy\(g, ef\.desde, ef\.hasta, p\.hoy\)/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/dashboard.run.ts')), /cortarEnHoyDe\(/);
});

test('el corte vive en datosDeGraficos y valoresDeCampo, con la regla de cada conjunto', () => {
  const src = sinComentarios(leer('lib/graficos-datos.ts'));
  assert.match(cuerpoDe(src, 'export function hastaDeFuente('), /return hastaDeLectura\(g, desde, hasta, hoyEnTijuana\(\)\);/);
  const datos = cuerpoDe(src, 'export async function datosDeGraficos(');
  assert.match(datos, /const hasta = hastaDeFuente\(g, p\.desde, p\.hasta\);/);
  // La lectura, el período anterior y el agregado usan ESE hasta, no el pedido.
  assert.match(datos, /const rg: Rango = \{ desde: p\.desde, hasta, sinRango \};/);
  assert.match(datos, /periodoAnterior\(p\.desde, hasta\)/);
  assert.match(datos, /agregar\(g, filtrarFilas\(await lecturas\.get\(clave\)!, filtros\), p\.desde, hasta\)/);
  const valores = cuerpoDe(src, 'export async function valoresDeCampo(');
  assert.match(valores, /hasta: hastaDeFuente\(\{ fuente: fid, fecha: fecha\.id \}, desde, hasta\)/);
});

test('conPlazo: llega a tiempo → el valor; no llega → «Tardó demasiado», sin un rechazo suelto después', async () => {
  assert.equal(await conPlazo(Promise.resolve(7), 50, 'x'), 7);
  // Sin plazo (0 o no finito) es la promesa tal cual.
  const p = Promise.resolve(1);
  assert.equal(conPlazo(p, 0, 'x'), p);
  assert.equal(conPlazo(p, Number.NaN, 'x'), p);

  let sueltos = 0;
  const contar = () => { sueltos++; };
  process.on('unhandledRejection', contar);
  try {
    const lenta = new Promise<number>((_, rechazar) => setTimeout(() => rechazar(new Error('se cayó la base')), 40));
    await assert.rejects(conPlazo(lenta, 5, 'Tardó demasiado: Visitas'), (e: unknown) => e instanceof PlazoVencidoError && e.message === 'Tardó demasiado: Visitas');
    // La lectura lenta se cae DESPUÉS del plazo: no puede quedar como un rechazo sin dueño.
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(sueltos, 0);
    // Un error de la lectura ANTES del plazo es ese error, no «tardó».
    await assert.rejects(conPlazo(Promise.reject(new Error('sin conexión')), 50, 'x'), /sin conexión/);
  } finally {
    process.off('unhandledRejection', contar);
  }
});

test('datosDeGraficos y valoresDeCampo ponen el plazo a CADA lectura y la tarjeta dice cuál tardó', () => {
  const src = sinComentarios(leer('lib/graficos-datos.ts'));
  assert.match(src, /export const PLAZO_LECTOR_MS = 45_000;/);
  const datos = cuerpoDe(src, 'export async function datosDeGraficos(');
  assert.match(datos, /conPlazo\(lector\(g\.fecha, r, g\), plazo, tardoDemasiado\(fuente\.nombre\)\)/);
  // El período anterior también pasa por el plazo (si no, el chip «↑ 1,3×» colgaría la tarjeta).
  assert.match(datos, /lecturas\.set\(claveAnt, leerConPlazo\(/);
  // El mensaje del plazo llega TAL CUAL a la tarjeta; cualquier otro error, el genérico.
  assert.match(datos, /e instanceof PlazoVencidoError \? e\.message : 'No pude leer los datos'/);
  assert.match(cuerpoDe(src, 'export async function valoresDeCampo('), /await conPlazo\(lector\(/);
});
