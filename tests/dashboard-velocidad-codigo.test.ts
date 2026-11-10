// «Velocidad de llamada», la hoja de los clientes de Código Inmobiliario, terminada (9/11/2026).
// Juanfran (Código) preguntó: «¿ya se implementó en Mako la métrica que permite saber cuánto tarda cada inmobiliario en contactar a
// un lead desde que ingresa al CRM?». Martín: «Les estoy creando un dashboard especial para sus clientes. Que le sirva para esa
// métrica, que tenga el botón de grabar». Y el 9/11 a la noche: «En los clientes de Código casi todos salen "sin contactar" porque
// llaman sin grabar. Que el dashboard lo diga claro y les explique cómo grabar».
//
// Lo que este archivo fija:
//   · `faltaGrabar` (lib/primer-contacto.ts): el aviso va cuando la mayoría sale sin contactar (lo medido: 123 de 126, 41 de 41), y
//     no cuando el negocio ya contacta (ni cuenta a los que entraron hace menos de una hora: todavía están a tiempo);
//   · la tarjeta «Primer contacto» (app/dashboard/disenos/HojaClosing.tsx) pone el aviso con el botón «Grabar llamada» (la misma
//     grabadora de la ficha) en el lugar de la lista de los más lentos, y nunca el botón en un link compartido;
//   · la hoja trae, a la vista y debajo del primer contacto, la tabla «Cada lead nuevo» del conjunto `primer_contacto`, por lead,
//     con cuánto tardó y por dónde, y la fila abre la ficha;
//   · cada cliente de Código la ve PRIMERO sin armarla y sin que se escriba nada en su negocio: es su informe inicial
//     (`tableroInicialDe`, lib/graficos-plantillas.ts, leído por lib/graficos-tablero.ts con las agencias aprobadas del negocio).
// Correr: npx tsx --test tests/dashboard-velocidad-codigo.test.ts
//
// ── Roturas (9/11/2026, una por vez, con copia y verificada por hash, nunca con git). Base 5 / 0; al final 5 / 0:
//   · `faltaGrabar` sin descontar a los que están a tiempo                 -> 4 / 1  «el aviso de grabar va…»
//   · el aviso ADEMÁS de la lista de los más lentos                        -> 4 / 1  «la tarjeta «Primer contacto»…»
//   · el botón «Grabar llamada» también en un link compartido              -> 4 / 1  «la tarjeta «Primer contacto»…»
//   · la tabla con `minutos_contacto` (vacía si nadie contactó)            -> 4 / 1  «la hoja trae «Cada lead nuevo»…»
//     (medido con `minutos_espera`, que después pasó a `espera` en segundos: la misma guarda)
//   · la tabla plegada en «Todas las piezas» (y = 200)                     -> 4 / 1  «la hoja trae «Cada lead nuevo»…»
//   · `HOJA_DE_AGENCIA` vacío                                              -> 3 / 2  «cada cliente…», «quien nunca guardó…»
//   · la página la pasa como `agregar` (se guardaría al abrir)             -> 4 / 1  «quien nunca guardó…»
//   · la tira sin la hoja de la agencia                                    -> 4 / 1  «quien nunca guardó…»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { faltaGrabar } from '../lib/primer-contacto';
import { HOJA_DE_AGENCIA, VELOCIDAD_LLAMADA, esHojaDeAgencia, instanciarPlantilla, tableroInicial, tableroInicialDe } from '../lib/graficos-plantillas';
import { esElemento, esGrafico, sanearHoja, sanearTablero, type Hoja } from '../lib/graficos-catalogo';
import { panelesALaVista } from '../lib/graficos-secciones';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('el aviso de grabar va cuando la mayoría sale sin contactar, y no cuando el negocio ya contacta', () => {
  assert.equal(faltaGrabar({ sinContactar: 123, aTiempo: 0, contactados: 3 }), true, 'Natalia: 123 de 126 sin contactar');
  assert.equal(faltaGrabar({ sinContactar: 41, aTiempo: 0, contactados: 0 }), true, 'Brigitte: 41 de 41');
  assert.equal(faltaGrabar({ sinContactar: 5, aTiempo: 0, contactados: 5 }), true, 'la mitad sin contactar, también');
  assert.equal(faltaGrabar({ sinContactar: 4, aTiempo: 0, contactados: 30 }), false, 'un negocio que ya contacta no lo ve');
  assert.equal(faltaGrabar({ sinContactar: 6, aTiempo: 6, contactados: 2 }), false, 'los que entraron hace menos de una hora están a tiempo');
  assert.equal(faltaGrabar({ sinContactar: 0, aTiempo: 0, contactados: 0 }), false, 'sin leads, nada que decir');
});

test('la tarjeta «Primer contacto» explica cómo grabar y trae el botón, en el lugar de la lista de los más lentos', () => {
  const src = leer('app/dashboard/disenos/HojaClosing.tsx');
  assert.match(src, /\{faltaGrabar\(r\) \? <AvisoGrabar sinContactar=\{sinContactar\} compartido=\{compartido\} \/> : c\.esperaron\.length > 0 && \(/,
    'el aviso reemplaza la lista (cabe en la tarjeta sin agrandarla)');
  const aviso = src.slice(src.indexOf('function AvisoGrabar'));
  assert.match(aviso, /MaKo sólo ve las llamadas que se graban/, 'dice por qué salen sin contactar');
  assert.match(aviso, /Toca <b>Grabar llamada<\/b> y elige el lead/, 'dice cómo');
  assert.match(aviso, /una llamada del mismo celular no se graba/, 'y lo que no se puede (lib/grabar-llamada-reglas.ts, `queSeGraba`)');
  assert.match(aviso, /\{!compartido && <button[^>]*onClick=\{\(\) => setGrabando\(true\)\}>Grabar llamada<\/button>\}/, 'el botón, nunca en un link compartido');
  assert.match(aviso, /<GrabarEnFrio \/>/, 'la misma grabadora de la ficha del lead');
  assert.match(src, /const GrabarEnFrio = dynamic\(\(\) => import\('@\/app\/_components\/grabar\/GrabarEnFrio'\)/);
});

test('la hoja trae «Cada lead nuevo» a la vista, debajo del primer contacto, por lead y con cuánto tardó', () => {
  const h = sanearHoja(instanciarPlantilla(VELOCIDAD_LLAMADA), 0) as Hoja;
  const vista = panelesALaVista(h.componentes);
  const i = vista.findIndex((c) => esGrafico(c) && c.fuente === 'primer_contacto');
  assert.ok(i >= 0, 'la tabla está a la vista (no plegada en «Todas las piezas»)');
  const t = vista[i];
  assert.ok(esGrafico(t));
  assert.equal(t.tipo, 'tabla');
  assert.equal(t.dimension, 'lead', 'una fila por lead');
  // Hasta el contacto o esperando (9/11/2026, medido en Giselle, ws 17): con `minutos_contacto`, donde nadie contactó a nadie
  // todas las filas venían sin valor y la tabla decía «Sin datos en este período».
  // Y en segundos, para que se lea como duración («26 días 5 h») y no «37790» minutos.
  assert.deepEqual(t.metricas, ['espera']);
  const lector = leer('lib/graficos-datos-extra.ts');
  assert.match(lector, /pc\.estado === 'sin_contactar' && pc\.esperandoMinutos != null \? \{ espera: Math\.round\(pc\.esperandoMinutos\) \* 60 \}/, 'un lead sin contactar trae lo que lleva esperando');
  assert.match(leer('lib/graficos-fuentes-extra.ts'), /\{ \.\.\.m\('espera', 'Cuánto tardó, o lleva esperando', 'segundos'\), sinTotal: true \}/, 'con formato de duración');
  assert.deepEqual(t.tabla?.columnas, ['tramo', 'canal'], 'cuánto tardó (el tramo) y por dónde');
  assert.equal(t.tabla?.acciones, true, 'la fila abre la ficha del lead');
  const contacto = vista.find((c) => esElemento(c) && c.tipo === 'diseno' && c.diseno?.parte === 'contacto');
  assert.ok(contacto, 'la tarjeta de primer contacto');
  assert.equal(t.y, contacto.y + contacto.h, 'justo debajo del primer contacto');
  assert.equal(t.w, 12, 'a lo ancho');
});

test('cada cliente de Código arranca con «Velocidad de llamada» adelante, sin escribir nada en su negocio', () => {
  assert.equal(HOJA_DE_AGENCIA[13], 'velocidad-llamada', 'Código Inmobiliario es el ws 13');
  const t = tableroInicialDe([13]);
  assert.deepEqual(t.hojas.map((h) => h.plantilla), ['velocidad-llamada', ...tableroInicial().hojas.map((h) => h.plantilla)], 'adelante, y después las de siempre');
  // Ids fijos (el inicial se lee igual cada vez) y sin chocar con los de Marketing y Comercial.
  assert.deepEqual(tableroInicialDe([13]), t, 'el mismo cada vez');
  const ids = t.hojas.flatMap((h) => [h.id, ...h.componentes.map((c) => `${h.id}/${c.id}`)]);
  assert.equal(new Set(t.hojas.map((h) => h.id)).size, t.hojas.length, 'cada hoja con su id');
  assert.equal(new Set(ids).size, ids.length);
  // Guardarlo tal cual (el autoguardado cuando la persona lo toca) no pierde la hoja.
  assert.deepEqual(sanearTablero(JSON.parse(JSON.stringify(t)))?.hojas.map((h) => h.plantilla), t.hojas.map((h) => h.plantilla));
  // Sin agencia, o de otra agencia: el de siempre.
  assert.deepEqual(tableroInicialDe([]), tableroInicial());
  assert.deepEqual(tableroInicialDe([7]), tableroInicial());
  // La lectura lo usa con las agencias APROBADAS del negocio, y si la cartera no se lee, el de siempre (no rompe la pantalla).
  const src = leer('lib/graficos-tablero.ts');
  assert.match(src, /const agencias = await agenciasAprobadasDe\(ws\)\.catch\(\(\) => \[\] as number\[\]\);\n  return tableroInicialDe\(agencias\);/);
  assert.equal((src.match(/tablero: await inicialDe\(informe, ws\)/g) ?? []).length, 2, 'las dos salidas del inicial');
});

test('quien nunca guardó su Dashboard VE la hoja de su agencia (la pantalla en blanco no la tapa), y abrir no la guarda', () => {
  // Medido en producción el 9/11/2026 (Giselle, ws 17): con la hoja en el inicial, la pantalla seguía EN BLANCO —desde el 12/10 el
  // inicial no se muestra («que no le salga ninguna página»)—. La hoja de la agencia es lo único del inicial que se ve.
  const t = tableroInicialDe([13]);
  assert.deepEqual(t.hojas.filter(esHojaDeAgencia).map((h) => h.plantilla), ['velocidad-llamada'], 'se reconoce la de la agencia');
  assert.deepEqual(tableroInicial().hojas.filter(esHojaDeAgencia), [], 'Marketing y Comercial del inicial, no');
  assert.equal(esHojaDeAgencia(instanciarPlantilla(VELOCIDAD_LLAMADA)), false, 'una que la persona creó desde la galería, no');
  const pagina = leer('app/dashboard/page.tsx');
  assert.match(pagina, /const hojasDe = \(l: LecturaTablero\): Hoja\[\] => \(l\.estado === 'inicial' \? l\.tablero\.hojas\.filter\(esHojaDeAgencia\)/,
    'la tira (también la de Focus) la muestra');
  assert.match(pagina, /if \(enAgencia\) \{ tablero = \{ \.\.\.tablero, hojas: deAgencia \}; agregar = null; hoja = enAgencia;/,
    'se muestra sin `agregar`: no se guarda al abrir');
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /const ultimoGuardado = useRef\(JSON\.stringify\(inicial\)\);/, 'el autoguardado compara contra lo que vino: sin tocar nada, no escribe');
});
