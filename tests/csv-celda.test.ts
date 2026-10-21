// =============================================================================
// lib/csv-celda.ts — el helper único del CSV: celdas sin fórmulas, opciones, archivo, y el camino de vuelta
// =============================================================================
// Pedido del 21/10/2026: las exportaciones a CSV no escapaban las celdas que arrancan con = + - @ (ni con tab o CR), y la de leads del CRM es la más expuesta:
// los nombres y los campos vienen de formularios PÚBLICOS. Un lead llamado «=HYPERLINK(…)» o «=cmd|…» se abría como fórmula en el Excel de quien exporta (OWASP,
// «CSV Injection»). Acá se prueba el helper y, con entradas HOSTILES, cada exportador que pasa por él. Que NINGUNA exportación se salga del helper lo fija
// tests/csv-una-sola-via.test.ts.
//
// ⚠️ Lo que se fija es el TEXTO del archivo, que es lo único que decide este código; cómo lo lee Excel o Sheets es la receta de OWASP (esta máquina no tiene ninguno
// de los dos para abrirlo).
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARRANCA_FORMULA, armarCsv, BOM_CSV, celdaCsv, desescaparCeldaCsv, filaCsv, neutralizarFormula, numeroCsv,
} from '../lib/csv-celda';
import { csvDeLeads } from '../app/crm/leads-exportar';
import { filasDesdeCsv } from '../app/crm/leads-importar';
import { proyectosACSV, tareasACSV } from '../app/plan/board/exportar';
import { textoCSV } from '../app/customer-success/exportar';
import { celda as celdaMetricas } from '../lib/metricas-modelo';
import type { BoardTask, Label } from '../app/plan/board/types';

// Lo que un atacante manda por un formulario público (OWASP + las variantes de DDE y de Sheets).
const HOSTILES = [
  '=1+1', '=HYPERLINK("http://malo.example/x","clic")', "=cmd|' /C calc'!A0", '+1+1', '-2+3', '@SUM(1+1)', '=IMPORTXML("http://malo.example","//a")',
  '\t=1+1', '\r=1+1', '\n=1+1', ' =1+1', '  \t@x', '+cmd|calc', '-Sin empresa-',
];

test('celdaCsv: todo texto que arranca como fórmula lleva un apóstrofo adelante (con comillas si hacen falta), y el resto queda como estaba', () => {
  for (const h of HOSTILES) {
    const celda = celdaCsv(h);
    const sinComillas = celda.startsWith('"') ? celda.slice(1, -1).replace(/""/g, '"') : celda;
    assert.ok(sinComillas.startsWith("'"), `${JSON.stringify(h)} → ${JSON.stringify(celda)}: no quedó con el apóstrofo`);
    assert.ok(!ARRANCA_FORMULA.test(sinComillas), `${JSON.stringify(h)}: lo que sale todavía arranca como fórmula`);
  }
  assert.equal(celdaCsv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`, 'apóstrofo, y la comilla duplicada');
  assert.equal(celdaCsv('=1+1'), "'=1+1");
  assert.equal(celdaCsv('Ana a=b'), 'Ana a=b', 'sólo cuenta el ARRANQUE');
  assert.equal(celdaCsv('2+2=4'), '2+2=4');
  assert.equal(celdaCsv('María'), 'María');
});

test('celdaCsv: un NÚMERO sigue siendo número; un decimal negativo escrito como texto también; null y undefined salen VACÍOS', () => {
  assert.equal(celdaCsv(-5), '-5', 'un número negativo no es una fórmula');
  assert.equal(celdaCsv(0), '0');
  assert.equal(celdaCsv(1234.56789), '1234.5679', 'hasta 4 decimales');
  assert.equal(celdaCsv(NaN), '');
  assert.equal(celdaCsv('-5'), '-5', 'un decimal negativo como texto: no hay fórmula posible y el apóstrofo lo volvería texto en una columna de cifras');
  assert.equal(celdaCsv('-12.50'), '-12.50');
  assert.equal(celdaCsv('-5+1'), "'-5+1", 'pero -5+1 sí es una cuenta');
  assert.equal(celdaCsv('+5'), "'+5", 'el + nunca se exime (un teléfono, o un +cmd)');
  assert.equal(celdaCsv(null), '');
  assert.equal(celdaCsv(undefined), '');
  assert.equal(numeroCsv(-0), '0');
});

test('celdaCsv: comillas cuando el campo trae el separador, una comilla, un salto de línea o espacios en los bordes; el separador manda', () => {
  assert.equal(celdaCsv('a,b'), '"a,b"');
  assert.equal(celdaCsv('a;b'), 'a;b', 'con la coma por separador, el ; no obliga');
  assert.equal(celdaCsv('a;b', ';'), '"a;b"');
  assert.equal(celdaCsv('a,b', ';'), 'a,b');
  assert.equal(celdaCsv('dijo "hola"'), '"dijo ""hola"""');
  assert.equal(celdaCsv('dos\nlíneas'), '"dos\nlíneas"');
  assert.equal(celdaCsv(' con espacio'), '" con espacio"');
  assert.equal(celdaCsv('con espacio '), '"con espacio "');
});

test('celdaCsv: las opciones — siempreComillas, aplanarSaltos, telefonosComoTexto, comillasTambien, numero', () => {
  assert.equal(celdaCsv('ana', { siempreComillas: true }), '"ana"');
  assert.equal(celdaCsv(null, { siempreComillas: true }), '""', 'un vacío entre comillas, como lo escribía el Plan');
  assert.equal(celdaCsv(5, { siempreComillas: true }), '"5"');
  assert.equal(celdaCsv('uno\r\ndos', { aplanarSaltos: true }), 'uno dos');
  assert.equal(celdaCsv('\r\n=1+1', { aplanarSaltos: true, siempreComillas: true }), `"' =1+1"`, 'el salto se aplana ANTES de mirar el arranque');
  assert.equal(celdaCsv('+5215512345678', { telefonosComoTexto: true }), '"=""+5215512345678"""', 'un teléfono llega como texto, con su +');
  assert.equal(celdaCsv('0221 456', { telefonosComoTexto: true }), '"=""0221 456"""');
  assert.equal(celdaCsv('+52"&HYPERLINK(1)&"', { telefonosComoTexto: true }), `"'+52""&HYPERLINK(1)&"""`, 'una comilla NUNCA entra al literal ="…"');
  assert.equal(celdaCsv('+52"1', { telefonosComoTexto: true }), `"'+52""1"`, 'dígitos CON una comilla: no entra al literal ="…" (cerraría el literal y lo de atrás se ejecutaría)');
  assert.equal(celdaCsv('+5215512345678'), "'+5215512345678", 'sin la opción, el teléfono lleva el apóstrofo como cualquier +');
  assert.equal(celdaCsv('a;b', { comillasTambien: ';' }), '"a;b"');
  assert.equal(celdaCsv(0.123456, { numero: String }), '0.123456');
});

test('filaCsv y armarCsv: separador, BOM, saltos y salto final', () => {
  assert.equal(filaCsv(['a', 'b,c', 3, null]), 'a,"b,c",3,');
  assert.equal(filaCsv(['a', 'b;c'], { sep: ';' }), 'a;"b;c"');
  assert.equal(armarCsv([['x', '=1+1'], [1, 2]]), `${BOM_CSV}x,'=1+1\r\n1,2`);
  assert.equal(armarCsv([['x'], ['y']], { saltos: '\n', saltoFinal: true }), `${BOM_CSV}x\ny\n`);
  assert.equal(armarCsv([['x']], { bom: false }), 'x');
  assert.equal(BOM_CSV.charCodeAt(0), 0xfeff, 'el BOM es el U+FEFF');
});

test('EL CAMINO DE VUELTA: lo que la app exporta se puede importar sin que el apóstrofo ni el ="…" queden pegados al dato', () => {
  for (const h of HOSTILES.filter((x) => !/^\s/.test(x) && !/^[\t\r\n]/.test(x))) assert.equal(desescaparCeldaCsv(neutralizarFormula(h)), h, `ida y vuelta de ${JSON.stringify(h)}`);
  assert.equal(desescaparCeldaCsv('="+5215512345678"'), '+5215512345678');
  assert.equal(desescaparCeldaCsv("'90s"), "'90s", "un apóstrofo que NO precede una fórmula no se toca");
  assert.equal(desescaparCeldaCsv("O'Brien"), "O'Brien");
  // Y por el importador de verdad: exportar → importar deja el nombre como estaba.
  const csv = csvDeLeads([['nombre', 'Nombre'], ['email', 'Email'], ['telefono', 'Teléfono']], [{ nombre: '=HYPERLINK("http://malo.example","clic")', email: 'a@b.com', telefono: '+5491122334455' }]);
  const { filas, error } = filasDesdeCsv(csv);
  assert.equal(error, undefined);
  assert.equal(filas[0].nombre, '=HYPERLINK("http://malo.example","clic")', 'el apóstrofo no se queda en el nombre importado');
});

// ---------------------------------------------------------------------------
// Cada exportador, con entradas hostiles
// ---------------------------------------------------------------------------

test('los LEADS del CRM: un lead llamado «=HYPERLINK(…)» no se abre como fórmula; las cifras siguen siendo cifras; los booleanos, Sí/No', () => {
  const csv = csvDeLeads(
    [['id', 'ID'], ['nombre', 'Nombre'], ['empresa', 'Empresa'], ['monto', 'Monto'], ['ganado', 'Ganado']],
    [
      { id: 1, nombre: '=HYPERLINK("http://malo.example","clic")', empresa: "=cmd|' /C calc'!A0", monto: -50, ganado: true },
      { id: 2, nombre: '@SUM(1+1)', empresa: '+1+1', monto: 1234.5, ganado: false },
      { id: 3, nombre: 'María, la de "Ventas"', empresa: null, monto: null, ganado: null },
    ],
  );
  assert.equal(csv.charCodeAt(0), 0xfeff, 'con BOM');
  const lineas = csv.slice(1).split('\r\n');
  assert.equal(lineas[0], 'ID,Nombre,Empresa,Monto,Ganado');
  assert.equal(lineas[1], `1,"'=HYPERLINK(""http://malo.example"",""clic"")",'=cmd|' /C calc'!A0,-50,Sí`, 'el DDE de OWASP lleva apóstrofo; sin comillas dobles ni comas adentro no necesita comillas');
  assert.equal(lineas[2], `2,'@SUM(1+1),'+1+1,1234.5,No`);
  assert.equal(lineas[3], '3,"María, la de ""Ventas""",,,');
  for (const l of lineas.slice(1)) assert.ok(!/(^|,)"?[=+@]/.test(l.replace(/,-?\d[\d.]*(?=,|$)/g, '')), `una celda arranca como fórmula: ${l}`);
});

const tarea = (o: Record<string, unknown> = {}) => ({
  id: 't1', num: 7, title: 'Llamar', labels: ['p1'], progress: 0, priority: 'alta', score: 80, scoreRazon: '', deadline: '', deadlineRazon: '', detalle: '', notas: '',
  haceloEn: undefined, origen: 'user', fuente: undefined, ...o,
}) as unknown as BoardTask;
const proyecto = (o: Record<string, unknown> = {}) => ({ id: 'p1', pid: 'P1', emoji: '📁', name: 'Proyecto', color: '#000', score: 50, scoreRazon: '', deadline: '', detalle: '', notas: '', ...o }) as unknown as Label;

test('el PLAN: el título, el detalle y las notas de una tarea (de un cliente, de una reunión) no se abren como fórmula; todo sigue entre comillas', () => {
  const csv = tareasACSV(
    [tarea({ title: '=HYPERLINK("http://malo.example","clic")', detalle: '@cmd', notas: '+1+1\nsegunda línea' })],
    [proyecto({ name: '-Proyecto-' })],
  );
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [cab, fila] = csv.slice(1).split('\n');
  assert.ok(cab.startsWith('"#","Título"'), 'el encabezado sigue igual: todo entre comillas');
  assert.ok(fila.includes(`"'=HYPERLINK(""http://malo.example"",""clic"")"`), `el título: ${fila}`);
  assert.ok(fila.includes(`"'@cmd"`), 'el detalle');
  assert.ok(fila.includes(`"'+1+1 segunda línea"`), 'las notas (el salto ya venía aplanado por el exportador)');
  assert.ok(fila.includes(`"'-Proyecto-"`), 'el nombre del proyecto');
  assert.ok(fila.startsWith('"7","'), 'un número sigue entre comillas, como siempre');
  const p = proyectosACSV([proyecto({ name: '=1+1', detalle: '-x' })], [tarea()]);
  assert.ok(p.includes(`"'=1+1"`) && p.includes(`"'-x"`));
});

test('CUSTOMER SUCCESS: sigue igual (teléfonos como texto, fórmulas con apóstrofo), ahora con el helper', () => {
  assert.equal(textoCSV([['=1+1', '+5215512345678', 'Acme', 3]]).slice(1), `"'=1+1";"=""+5215512345678""";"Acme";"3"`);
});

test('las MÉTRICAS: una celda de texto que arranca como fórmula lleva apóstrofo; un null sale vacío y un 0 sale 0; el ; también obliga comillas', () => {
  assert.equal(celdaMetricas('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(celdaMetricas(null), '');
  assert.equal(celdaMetricas(0), '0');
  assert.equal(celdaMetricas(12.345678), '12.345678', 'los decimales de una métrica no se redondean a 4');
  assert.equal(celdaMetricas('a;b'), '"a;b"');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estos tests más los de ficha, Customer Success, métricas y Dashboard, se restaura): 28 roturas, 28 rojas.
//   El helper (16): no neutraliza · ARRANCA_FORMULA sin `+` / sin `@` / sin el tab-CR-LF de adelante / sin los espacios antes del signo (12 / 7 / 5 / 3 / 3 rojas) · el
//   decimal negativo en texto con apóstrofo · un DECIMAL_NEGATIVO que deja pasar «-5+1» · un número tipado que se vuelve texto · sin duplicar las comillas (14) · neutralizar
//   después de decidir las comillas (12) · siempreComillas ignorado · `null` como «null» (9) · PARECE_NUMERO que deja pasar la comilla al `="…"` (salió VERDE la primera vez: el caso
//   con letras no la probaba; se sumó `+52"1`) · armarCsv sin BOM (5) · desescapar de más / sin el `="…"`.
//   Los exportadores (5): leads del CRM a mano · el importador sin deshacer el apóstrofo · el Plan con su celda propia (3, la guarda también) · Customer Success sin
//   telefonosComoTexto · las métricas sin comillas por `;`.  La guarda (tests/csv-una-sola-via.test.ts, 7): ver su pie.
//   Un detalle del oficio: dos roturas no se aplicaron la primera vez porque buscaban un texto de varias líneas y el árbol está en CRLF (el script lo avisa con «??»: no es verde).
// =============================================================================
