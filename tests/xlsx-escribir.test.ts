// =============================================================================
// lib/xlsx-escribir.ts — la planilla que se baja del CRM se abre, y se vuelve a importar (ticket 106, 17/11/2026)
// =============================================================================
// No hay Excel en la PC ni en Actions para abrirla: se la lee con el MISMO lector con que el CRM importa planillas
// (`xlsxATexto`, lib/office-a-texto.ts), así un export se puede volver a subir, y se mira que cada parte del ZIP sea XML bien
// formado, que es lo que hace que Excel diga «encontramos un problema con el contenido».
//
//   1. Ida y vuelta: encabezado, textos con acentos y emojis, números y vacíos, por el lector del importador.
//   2. Un texto que arranca como fórmula se guarda como TEXTO (inlineStr, sin <f>): ningún «=HYPERLINK» se ejecuta.
//   3. Un carácter de control o un medio emoji (lo que puede traer un formulario) no rompe el XML.
//   4. Una celda más larga que el tope de Excel se corta antes, sin partir un emoji.
//   5. La primera fila queda fija y con filtro; las columnas pasan de la Z.
//
// PROBADO ROMPIÉNDOLO (17/11/2026), cada rotura sola y vuelta atrás:
//   a. `textoXml` sin sacar los caracteres de control         → falla 3.
//   b. `textoXml` sin escapar «<» y «&»                        → falla 1.
//   c. los textos como número (sin t="inlineStr")              → fallan 2 y 5 (el lector del importador los lee igual).
//   d. `letraDeColumna` que no pasa de la Z                    → falla 5.
//   e. sin el tope de 32.767                                   → falla 4.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import Module from 'node:module';
import { letraDeColumna, nombreDeHoja, textoXml, TOPE_CELDA_XLSX, xlsxDeTabla } from '../lib/xlsx-escribir';

// lib/office-a-texto.ts trae `server-only`: se lo stubea como en tests/creem-pasarela.test.ts, y el lector se carga después.
type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;
const xlsxATexto = async (buf: Buffer): Promise<string> => (await import('../lib/office-a-texto')).xlsxATexto(buf);

const partes = (bytes: Uint8Array): Record<string, string> =>
  Object.fromEntries(Object.entries(unzipSync(bytes)).map(([ruta, b]) => [ruta, strFromU8(b)]));

/** XML bien formado, lo justo para esta planilla: sin caracteres prohibidos, entidades válidas y etiquetas que cierran. */
function bienFormado(xml: string): string | null {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)) return 'carácter de control';
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(xml)) return 'medio emoji';
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(xml)) return '& suelto';
  const cuerpo = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const pila: string[] = [];
  for (const m of cuerpo.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>/g)) {
    const [, cierra, nombre, , sola] = m;
    if (sola) continue;
    if (cierra) { if (pila.pop() !== nombre) return `</${nombre}> sin abrir`; } else pila.push(nombre);
  }
  if (pila.length) return `<${pila.at(-1)}> sin cerrar`;
  if (cuerpo.replace(/<[^<>]*>/g, '').includes('<')) return '< suelto';
  return null;
}

const todasBienFormadas = (bytes: Uint8Array) => {
  for (const [ruta, xml] of Object.entries(partes(bytes))) assert.equal(bienFormado(xml), null, ruta);
};

test('1. ida y vuelta por el lector del importador: encabezado, acentos, emojis, números y vacíos', async () => {
  const bytes = xlsxDeTabla([
    ['ID', 'Nombre', '¿Hace cuánto que formas parte del rubro inmobiliario?', 'Vendido USD'],
    [501, 'Ana Núñez 🏠', 'Más de 5 años & <contando>', 1500.5],
    [502, 'Beto', null, ''],
  ], { hoja: 'Leads' });
  todasBienFormadas(bytes);
  const texto = await xlsxATexto(Buffer.from(bytes));
  assert.equal(texto, [
    '===== Hoja: Leads =====',
    'ID\tNombre\t¿Hace cuánto que formas parte del rubro inmobiliario?\tVendido USD',
    '501\tAna Núñez 🏠\tMás de 5 años & <contando>\t1500.5',
    '502\tBeto',
  ].join('\n'));
});

test('2. lo que arranca como fórmula se guarda como texto: ninguna celda con <f>', () => {
  const hoja = partes(xlsxDeTabla([['Nombre'], ['=HYPERLINK("http://x","clic")'], ['+54 9 11'], ['@usuario']]))['xl/worksheets/sheet1.xml'];
  assert.doesNotMatch(hoja, /<f>/);
  assert.match(hoja, /<c r="A2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK\(&quot;http:\/\/x&quot;,&quot;clic&quot;\)<\/t><\/is><\/c>/);
  assert.match(hoja, /<c r="A3" t="inlineStr">/);
});

test('3. un carácter de control o un medio emoji de un formulario no rompe el XML', async () => {
  const sucio = `Hola\u0001 mundo\u000B${'\uD83D'} fin\u0008`;
  const bytes = xlsxDeTabla([['Respuesta'], [sucio]]);
  todasBienFormadas(bytes);
  assert.equal(textoXml(sucio), 'Hola mundo fin');
  assert.match(await xlsxATexto(Buffer.from(bytes)), /Hola mundo fin/);
});

test('4. una celda más larga que el tope de Excel se corta, sin partir un emoji', () => {
  const largo = 'a'.repeat(TOPE_CELDA_XLSX - 1) + '🏠🏠';
  const t = textoXml(largo);
  assert.equal(t.length, TOPE_CELDA_XLSX - 1);
  assert.ok(!/[\uD800-\uDBFF]$/.test(t));
});

test('5. la primera fila fija y con filtro, el nombre de la hoja válido, y columnas más allá de la Z', () => {
  assert.deepEqual([0, 25, 26, 51, 701, 702].map(letraDeColumna), ['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA']);
  assert.equal(nombreDeHoja('Leads: [ganados]/nov*'), 'Leads ganados nov');
  assert.equal(nombreDeHoja('   '), 'Hoja 1');
  const encabezado = Array.from({ length: 30 }, (_, i) => `P${i + 1}`);
  const p = partes(xlsxDeTabla([encabezado, encabezado.map((_, i) => i)], { hoja: 'Leads' }));
  const hoja = p['xl/worksheets/sheet1.xml'];
  assert.match(hoja, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(hoja, /<autoFilter ref="A1:AD2"\/>/);
  assert.match(hoja, /<c r="AD1" s="1" t="inlineStr">/);
  assert.match(p['xl/workbook.xml'], /<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Leads'!\$A\$1:\$AD\$2<\/definedName>/);
  assert.ok(p['[Content_Types].xml'].includes('/xl/worksheets/sheet1.xml'));
});
