// Los lectores del Dashboard v5 (lib/graficos-datos.ts y lib/graficos-datos-extra.ts) son `server-only` y
// leen la base: un test no los puede correr. Lo que SÍ se puede fijar es que cada uno pase por la función que
// decide (la misma que usa la API de MaKo o la pantalla), así los dos números no se contradicen: la entrega
// con la cartera de Customer Success, la cobranza con `armarCobranza`, el MRR con `getMrrActivo`, la cartera
// con `cartera()`; que las pruebas y la vista previa del constructor no cuenten; que «vencido» se decida con
// el hoy del negocio; que el video se lea del resumen SQL y caiga a los eventos sólo si la función no está;
// que la conversación no lea el texto de un mensaje; que la visita no guarde la IP; y que un pop-up se lea
// con la definición GUARDADA del gráfico dueño. Las cuentas de esos lectores tienen su test aparte
// (tests/graficos-datos-puro.test.ts, tests/vsl-retencion-resumen.test.ts).
// Correr: npx tsx --test tests/graficos-lectores-v5.test.ts
//
// Probados rompiéndolos (12/10/2026, arnés que restaura de memoria), con la base en 0 fallos (10 tests):
//   · `filasVsl` sin `noEsDelNegocio`                                       → 9 pass / 1 fail («las pruebas y la vista previa…»)
//   · `filasToques` sin saltear el sello                                     → 9 pass / 1 fail («el sello del constructor…»)
//   · `VSL_PRUEBA_VIDEO_ID` de vuelta en lib/graficos-datos.ts              → 9 pass / 1 fail («el video de PRUEBA…»)
//   · `filasPagos` con el hoy de la app (Tijuana) y no el del negocio        → 9 pass / 1 fail («Vencido…»)
//   · `filasEntrega` sin `repartirEnEtapas`                                  → 9 pass / 1 fail («la entrega y la cartera…»)
//   · `leerResumenVsl` cayendo a los eventos con CUALQUIER error             → 9 pass / 1 fail («el video se lee del RESUMEN…»)
//   · `filasConversaciones` leyendo además `body`                            → 9 pass / 1 fail («las conversaciones NUNCA…»)
//   · el insert de `landing_visits` con `ip`                                 → 9 pass / 1 fail («la visita guarda…»)
//   · el closer pidiendo un componente que el pop-up guardado no tiene       → 9 pass / 1 fail («un pop-up…»)
//   · `SIN_VALORES` vacío / los guiones sin miniatura                        → 9 pass / 1 fail cada una («los guiones…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
const DATOS = sinComentarios(leer('lib/graficos-datos.ts'));
const EXTRA = sinComentarios(leer('lib/graficos-datos-extra.ts'));

test('las pruebas y la vista previa del constructor no cuentan en NINGÚN lector de la landing', () => {
  assert.match(EXTRA, /export const noEsDelNegocio = \(x: \{ prueba: string \| null; landing_url: string \| null \}\) => !!x\.prueba \|\| esPreviewDeEditor\(x\.landing_url \?\? ''\);/);
  for (const [src, firma] of [
    [DATOS, 'async function filasVisitas('], [DATOS, 'async function filasVsl('], [DATOS, 'async function filasReplays('],
    [EXTRA, 'async function filasClics('], [EXTRA, 'async function filasScroll('], [EXTRA, 'async function filasToques('],
    [EXTRA, 'async function filasUbicacion('],
  ] as const) assert.match(cuerpoDe(src, firma), /noEsDelNegocio\(x\)/, `${firma} cuenta las pruebas`);
});

test('el sello del constructor de Lovable no es un toque ni un clic del negocio', () => {
  assert.match(cuerpoDe(EXTRA, 'async function filasToques('), /if \(esSelloDelConstructor\(x\.sel\)\) continue;/);
  assert.match(cuerpoDe(EXTRA, 'async function filasClics('), /esSelloDelConstructor\(x\.sel\)\) continue;/);
});

test('el video de PRUEBA cableado ya no se suma a las vistas del negocio', () => {
  assert.doesNotMatch(DATOS, /VSL_PRUEBA_VIDEO_ID/);
  assert.doesNotMatch(EXTRA, /VSL_PRUEBA_VIDEO_ID/);
});

test('«Vencido» y la cobranza se deciden con el HOY DEL NEGOCIO, no con el de la app', () => {
  assert.match(cuerpoDe(DATOS, 'async function filasPagos('), /hoyEnWorkspace\(\)\.catch\(\(\) => hoyEnTijuana\(\)\)/);
  const cobranza = cuerpoDe(EXTRA, 'async function filasCobranza(');
  assert.match(cobranza, /const hoy = await hoyEnWorkspace\(\)\.catch\(\(\) => hoyEnTijuana\(\)\);/);
  assert.match(cobranza, /armarCobranza\(o\.items, hoy\)/);
  assert.match(cuerpoDe(EXTRA, 'async function filasSuscripciones('), /getMrrActivo\(hoy\)/);
});

test('la entrega y la cartera leen lo MISMO que Customer Success (un cliente sin fila está en la primera etapa)', () => {
  const entrega = cuerpoDe(DATOS, 'async function filasEntrega(');
  assert.match(entrega, /await carteraEnEntrega\(\)/);
  assert.match(entrega, /repartirEnEtapas\(s\.etapas, delProducto,/);
  assert.match(cuerpoDe(EXTRA, 'async function filasCartera('), /cartera\(\), rotulosDelCrm\(\)/);
});

test('el video se lee del RESUMEN de la base, con el workspace explícito, y cae a los eventos SÓLO si la función no está', () => {
  const r = cuerpoDe(EXTRA, 'async function leerResumenVsl(');
  assert.match(r, /db\.rpc\('retencion_vsl_resumen', \{\s*p_ws: ws, p_desde: rg\.desde, p_hasta: rg\.hasta, p_tz: TZ_TIJUANA,/);
  // Otro error no se tapa con la lectura lenta: se dice.
  assert.match(r, /if \(!funcionNoExiste\(error\)\) throw new Error\(/);
  assert.match(r, /return resumirEventos\(crudos\.filter\(/);
  // Un error no queda recordado: el próximo pedido vuelve a intentar.
  assert.match(r, /p\.catch\(\(\) => memoResumen\.delete\(clave\)\)/);
  // Nadie más baja los eventos del video para la retención.
  assert.match(cuerpoDe(EXTRA, 'export async function videosDelPeriodo('), /leerResumenVsl\(rg, visitantes\)/);
});

test('las conversaciones NUNCA leen el texto de un mensaje', () => {
  const c = cuerpoDe(EXTRA, 'async function filasConversaciones(');
  const sel = /leer<FWaChat>\('wa_mensajes', '([^']+)'/.exec(c);
  assert.ok(sel, 'no encontré la lectura de wa_mensajes');
  const columnas = sel[1].split(',').map((x) => x.trim()).sort();
  assert.deepEqual(columnas, ['chat_jid', 'created_at', 'from_me', 'id', 'instance_name', 'lead_id', 'wa_timestamp']);
});

test('los guiones traen su miniatura y su anuncio; los valores de «Página» no releen el video', () => {
  const g = cuerpoDe(EXTRA, 'async function filasGuiones(');
  assert.match(g, /r: refDe\(x\.ad_id\),\s*img: ventana\.get\(x\.ad_id\)\?\.img \?\? null,/);
  assert.match(DATOS, /const SIN_VALORES: Readonly<Record<string, readonly string\[\]>> = \{ pagina: \['vsl'\] \};/);
  assert.match(cuerpoDe(DATOS, 'export async function valoresDeCampo('), /const caros = SIN_VALORES\[campo\.id\] \?\? \[\];/);
});

test('la visita guarda país, región, ciudad y coordenadas redondeadas — NUNCA la IP', () => {
  const src = sinComentarios(leer('app/api/track/vsl/route.ts'));
  assert.match(src, /const ubicacion = ubicacionDeHeaders\(\(n\) => request\.headers\.get\(n\)\);/);
  const i = src.indexOf(".from('landing_visits').insert({");
  assert.ok(i >= 0);
  const insert = src.slice(i, src.indexOf('});', i));
  assert.match(insert, /pais: ubicacion\.pais, region: ubicacion\.region, ciudad: ubicacion\.ciudad, lat: ubicacion\.lat, lon: ubicacion\.lon/);
  assert.doesNotMatch(insert, /\bip\b/i, 'la IP no se guarda');
  // Sin las columnas (mig 0262 sin aplicar) la visita entra igual, sin la ubicación.
  assert.match(src, /if \(error && ubicacion && columnaFaltante\(error\)\)/);
  // La migración no crea una columna para la IP, y lo puro no lee los headers de la IP.
  // (El `comment on column` sí nombra la IP: para decir que no se guarda. Lo que no puede haber es la columna.)
  const mig = leer('supabase/migrations/0262_landing_visits_ubicacion.sql').replace(/^\s*--.*$/gm, '');
  const columnas = [...mig.matchAll(/add column if not exists (\w+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(columnas, ['ciudad', 'lat', 'lon', 'pais', 'region']);
  assert.doesNotMatch(sinComentarios(leer('lib/graficos-datos-puro.ts')), /x-forwarded-for|x-real-ip/i);
});

test('un pop-up se lee con la definición GUARDADA del gráfico dueño; el closer no pide lo que no está', () => {
  const src = sinComentarios(leer('app/api/graficos/route.ts'));
  assert.match(cuerpoDe(src, 'function componentesDePopup('), /esGrafico\(c\) && c\.id === id/);
  assert.match(src, /const dueno = closer \? informeCloser\(\) : \(await leerTablero\(\)\)\.tablero;/);
  assert.match(src, /if \(!comps && closer\) return err\(403,/);
  assert.match(src, /if \(guardado\) grafico = guardado;\s*else if \(closer\) continue;/);
});
