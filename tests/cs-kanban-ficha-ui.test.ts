// =============================================================================
// Customer Success: la ficha linkeable, las acciones sin red, la fase en la tabla, los
// contactos en el CSV, de dónde vuelve un producto eliminado y los huérfanos del kanban
// =============================================================================
// Seis piezas chicas de la auditoría del 06/10/2026 (grupo «kanban-ficha-ui»). Lo que es una
// FUNCIÓN se EJECUTA acá (un guard de cableado contesta «¿está enchufado?», nunca «¿hace lo
// que dice?»); lo que es un call site se fija sobre el fuente SIN COMENTARIOS, porque la
// convención de la casa es explicar en el comentario lo que se sacó, y un guard de «esto NO
// está» que lee la prosa se acusa a sí mismo.
//
// ROTO (06/10/2026, con un arnés que restaura de memoria; cada rotura sola, y con el arreglo
// puesto da 12 pass / 0 fail):
//   1. page.tsx sin `clienteInicial={clienteInicial}` en el montaje      → 11 / 1
//   2. ClientesApp con `useState<number | null>(null)` (ignora la prop)  → 11 / 1
//   3. `hrefConFicha` armando la query de cero (pierde el `?ws=`)        → 11 / 1
//   4. el efecto de la URL con `router.replace(destino)`                 → 11 / 1
//   5. `atajar` devolviendo la promesa tal cual                          → 11 / 1
//   6. `moverEntregaAction` sin `atajar` en ClientesApp                  → 11 / 1
//   7. `guardarDatosClienteAction` sin `atajar` en FichaCliente          → 11 / 1
//   8. `clientesEnPantalla` contando huérfanos también en el kanban      → 11 / 1
//   9. ClientesApp pasando `true` en vez de `!enKanban`                  → 11 / 1
//  10. la sección «Fase» de vuelta a `enKanban ? … : undefined`          → 11 / 1
//  11. la tabla con `etapas.map` en vez de `columnasVisibles(…)`         → 11 / 1
//  12. la tabla con «Etapa borrada» también con una fase puesta          → 11 / 1
//  13. la tabla eligiendo el lote del arrastre sobre `filas`             → 11 / 1
//  14. `filasCSV` sin la celda del teléfono                              → 11 / 1
//  15. la línea de «Productos eliminados» sin el `conEmbudo ?`           → 11 / 1
//  16. `entrega.ts` sin `conEmbudo: conEmbudo.has(p.id)`                 → 11 / 1
//  17. el nombre del huérfano sin su `onClick`                           → 11 / 1
// Restaurado: 12 pass / 0 fail.
//
// ROTO (06/10/2026, segunda tanda, la del CSV para Excel; mismo arnés, el archivo ya tiene 13
// tests, y con el arreglo puesto da 13 pass / 0 fail). Cada rotura sola, en exportar.ts:
//  18. `celda` sin la rama del apóstrofo (las fórmulas salen crudas)    → 12 / 1
//  19. `celda` sin la rama `="…"` (el teléfono sale crudo)               → 12 / 1
//  20. las dos ramas en el orden inverso (`+52…` con apóstrofo)          → 12 / 1
//  21. `ARRANCA_FORMULA` sin el `\s*` (« =1+1» pasa)                     → 12 / 1
//  22. `PARECE_NUMERO` como `/\d/` (una comilla entra al literal)        → 12 / 1
//  23. `textoCSV` con el escape del commit 3e87b4ac, el de antes          → 12 / 1
// Las roturas 1-17 se midieron con 12 tests: hoy darían 12 / 1. Restaurado: 13 pass / 0 fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { atajar } from '../app/customer-success/sin-red';
import { hrefConFicha } from '../app/customer-success/url-ficha';
import { filasCSV, textoCSV, CABECERA_CSV } from '../app/customer-success/exportar';
import { clientesEnPantalla } from '../app/customer-success/BarraClientes';
import { leerClienteDeUrl, PARAM_CLIENTE } from '../app/plan/board/filtro-cliente';
import type { ClienteCruce } from '../app/customer-success/cruce';
import type { EtapaEntrega, FaseEntrega } from '../lib/servicio-etapas';

// ⚠️ SIN LOS `\r`: con `core.autocrlf=true` un worktree trae estos archivos en CRLF, y las
// anclas de `bloque` llevan `\n` (AGENTS.md: «toda guarda que compare texto normaliza»).
const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Las líneas `//` PRIMERO y los bloques después: al revés, un `/*` dentro de un comentario
 *  de línea abre un bloque que se come el código de abajo. */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** De `abre` hasta `cierra`, con anclas REALES y nunca un largo a ojo. */
function bloque(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.notEqual(i, -1, `no encontré el ancla de apertura: ${abre}`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.notEqual(j, -1, `no encontré el ancla de cierre: ${cierra}`);
  return src.slice(i, j);
}

const APP = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
const PAGE = sinComentarios(leer('app/customer-success/page.tsx'));
const FICHA = sinComentarios(leer('app/customer-success/FichaCliente.tsx'));
const TABLA = sinComentarios(leer('app/customer-success/TablaClientes.tsx'));
const KANBAN = sinComentarios(leer('app/customer-success/KanbanEntrega.tsx'));
const EDITOR = sinComentarios(leer('app/customer-success/EtapasEntregaModal.tsx'));
const ENTREGA = sinComentarios(leer('app/customer-success/entrega.ts'));

// ── 1. La ficha linkeable: `?cliente=<leadId>` ─────────────────────────────────

test('page.tsx lee ?cliente= en el SERVER, sólo en la rama de la cartera, y lo pasa', () => {
  assert.match(PAGE, /export default async function CustomerSuccessPage\(\{ searchParams \}: \{ searchParams: Promise</);
  assert.match(PAGE, /const clienteInicial = leerClienteDeUrl\(\(await searchParams\)\[PARAM_CLIENTE\]\);/);
  // Después del `return <AdminView`: la grilla del super admin es de WORKSPACES, no de leads.
  assert.ok(PAGE.indexOf('leerClienteDeUrl(') > PAGE.indexOf('<AdminView'), 'el super admin sin impersonar no tiene fichas de leads');
  const montaje = bloque(PAGE, '    <ClientesApp\n      clientes={clientesConFicha}', '/>');
  assert.match(montaje, /clienteInicial=\{clienteInicial\}/);
});

test('el parser es el del Plan: entero estricto, y el parámetro se llama igual', () => {
  assert.equal(PARAM_CLIENTE, 'cliente');
  assert.equal(leerClienteDeUrl('21'), 21);
  assert.equal(leerClienteDeUrl('21abc'), null, 'un parámetro a medio escribir no abre la ficha de OTRO');
  assert.equal(leerClienteDeUrl(['7', '9']), 7);
  assert.equal(leerClienteDeUrl(undefined), null);
});

test('ClientesApp abre la ficha que pidió la URL y escribe en la URL la que se VE', () => {
  assert.match(APP, /clienteInicial = null \}: \{/);
  assert.match(APP, /const \[abiertoId, setAbiertoId\] = useState<number \| null>\(clienteInicial\);/);
  // Lo que se ve (`abierto`, buscado en la lista), no lo que se pidió: un id ajeno se limpia.
  assert.match(APP, /const idEnUrl = abierto\?\.leadId \?\? null;/);
  const efecto = bloque(APP, 'const idEnUrl = abierto', '}, [idEnUrl]);');
  assert.match(efecto, /hrefConFicha\(\{ pathname, search, hash \}, idEnUrl\)/);
  assert.match(efecto, /window\.history\.replaceState\(null, '', destino\)/);
  // `router.replace` sobre esta página `force-dynamic` vuelve a pedir el RSC de la cartera.
  assert.doesNotMatch(efecto, /router\.(replace|push)/);
});

test('hrefConFicha pone y saca ?cliente= SIN perder el ?ws=', () => {
  const u = { pathname: '/customer-success', search: '?ws=13', hash: '' };
  assert.equal(hrefConFicha(u, 21), '/customer-success?ws=13&cliente=21');
  assert.equal(hrefConFicha({ ...u, search: '?ws=13&cliente=21' }, null), '/customer-success?ws=13');
  assert.equal(hrefConFicha({ ...u, search: '?cliente=21' }, null), '/customer-success');
  // Cambiar de ficha reemplaza, no suma un segundo parámetro.
  assert.equal(hrefConFicha({ ...u, search: '?cliente=21&ws=13' }, 40), '/customer-success?cliente=40&ws=13');
  assert.equal(hrefConFicha({ ...u, hash: '#x' }, 5), '/customer-success?ws=13&cliente=5#x');
});

// ── 2. Las acciones sin red ─────────────────────────────────────────────────────

test('atajar convierte el rechazo en { ok: false, error } y deja pasar lo demás', async () => {
  const errorOriginal = console.error;
  console.error = () => {};   // el rechazo va a la consola a propósito; acá no ensucia
  try {
    const caida = await atajar(Promise.reject(new TypeError('Failed to fetch')), 'No se pudo mover.');
    // El texto es el NUESTRO: «Failed to fetch» es inglés técnico y cambia por navegador.
    assert.deepEqual(caida, { ok: false, error: 'No se pudo mover.' });
    const ok = { ok: true as const, n: 3 };
    assert.equal(await atajar(Promise.resolve(ok), 'x'), ok);
    const malDelServer = { ok: false as const, error: 'Ese cliente no es de este workspace.' };
    assert.equal(await atajar(Promise.resolve(malDelServer), 'x'), malDelServer, 'el texto del server manda');
  } finally {
    console.error = errorOriginal;
  }
});

/** Cada llamada a una server action (`xxxAction(`) del fuente, y si va envuelta en `atajar(`. */
function llamadas(src: string): { total: number; sueltas: string[] } {
  const codigo = src.replace(/^import\b.*$/gm, '');
  const sueltas: string[] = [];
  let total = 0;
  for (const m of codigo.matchAll(/\b(\w+Action)\(/g)) {
    total++;
    const antes = codigo.slice(Math.max(0, (m.index ?? 0) - 'atajar('.length), m.index);
    if (antes !== 'atajar(') sueltas.push(m[1]);
  }
  return { total, sueltas };
}

test('TODA llamada a una acción de ClientesApp y FichaCliente pasa por atajar', () => {
  const app = llamadas(APP);
  // «No encontré nada» y «está todo bien» son respuestas distintas: el universo se cuenta.
  assert.ok(app.total >= 14, `ClientesApp: ${app.total} llamadas, esperaba al menos 14`);
  assert.deepEqual(app.sueltas, [], `sin red, estas tumban la pantalla: ${app.sueltas.join(', ')}`);
  const ficha = llamadas(FICHA);
  assert.ok(ficha.total >= 2, `FichaCliente: ${ficha.total} llamadas, esperaba al menos 2`);
  assert.deepEqual(ficha.sueltas, [], `sin red, el «no se guardó» no llega: ${ficha.sueltas.join(', ')}`);
  // Y nadie vuelve a atajar a mano con `e.message` (inglés técnico al banner).
  assert.doesNotMatch(APP, /\.catch\(\(e: unknown\) => \(\{ ok: false/);
});

// ── 3. La fase filtra también la TABLA ─────────────────────────────────────────

const E = (key: string, fase?: string) => ({ key, label: key, tone: 'neutral', dot: '#123456', ...(fase ? { fase } : {}) }) as unknown as EtapaEntrega;
const F = (key: string) => ({ key, label: key.toUpperCase(), tone: 'neutral', dot: '#abcdef' }) as unknown as FaseEntrega;

test('clientesEnPantalla: la fase con la misma regla que el riel, y los huérfanos sólo donde se dibujan', () => {
  const etapas = [E('a', 'f1'), E('b', 'f2'), E('c')];
  const fases = [F('f1'), F('f2')];
  // id → etapa guardada. Sin etapa = la PRIMERA (derivado). `x` es una etapa BORRADA.
  const asig: Record<string, string | undefined> = { ana: undefined, beto: 'b', caro: 'c', hue: 'x', dani: 'a' };
  const cs = ['ana', 'beto', 'caro', 'hue', 'dani'];
  const etapaDe = (c: string) => asig[c];

  // Kanban (`conHuerfanos = false`): sin tarjeta no se cuenta, ni siquiera sin fase.
  assert.deepEqual(clientesEnPantalla(etapas, fases, null, cs, etapaDe, false), ['ana', 'beto', 'caro', 'dani']);
  // Tabla sin fase: el grupo «Etapa borrada» le dibuja una fila, así que cuenta.
  assert.deepEqual(clientesEnPantalla(etapas, fases, null, cs, etapaDe, true), cs);
  // Con una fase, en las DOS vistas: sólo sus columnas, y el huérfano no es de ninguna.
  assert.deepEqual(clientesEnPantalla(etapas, fases, 'f1', cs, etapaDe, true), ['ana', 'dani']);
  assert.deepEqual(clientesEnPantalla(etapas, fases, 'f2', cs, etapaDe, false), ['beto']);
  assert.deepEqual(clientesEnPantalla(etapas, fases, '', cs, etapaDe, true), ['caro']);
  // El orden es el que llegó (lo decidió «Ordenar»), no el del reparto.
  assert.deepEqual(clientesEnPantalla(etapas, fases, 'f1', ['dani', 'ana'], etapaDe, true), ['dani', 'ana']);
  // Sin etapas no hay columnas que esconder.
  assert.deepEqual(clientesEnPantalla([], [], 'f1', cs, etapaDe, false), cs);
});

test('la pantalla cuenta con clientesEnPantalla, y los huérfanos sólo fuera del kanban', () => {
  const en = bloque(APP, 'const enPantalla =', 'const elegidosVisibles');
  assert.match(en, /clientesEnPantalla\(servicio\.etapas, servicio\.fases, faseVista, visiblesServ,\s*\(c\) => asigServicio\[c\.leadId\]\?\.etapa, !enKanban\)/);
  // La sección «Fase» de Filtrar en las dos vistas (con servicio), y la tabla la recibe vigente.
  assert.match(APP, /fases=\{servicio \? opcionesFase : undefined\} fase=\{faseVista\}/);
  assert.match(bloque(APP, '<TablaClientes', '/>'), /fase=\{faseVista\}/);
});

test('la tabla esconde grupos con columnasVisibles, y «Etapa borrada» sólo sin fase', () => {
  assert.match(TABLA, /import \{ columnasVisibles \} from '\.\/BarraClientes';/);
  assert.match(TABLA, /^  fase: string \| null;$/m, 'sin default: olvidarla vuelve a mostrar todo con el filtro puesto');
  const grupos = bloque(TABLA, 'const grupos = reparto && etapas', 'const dibujadas');
  assert.match(grupos, /\.\.\.columnasVisibles\(etapas, fases, fase\)\.map\(/);
  assert.doesNotMatch(grupos, /\.\.\.etapas\.map\(/);
  assert.match(grupos, /reparto\.huerfanos\.length && fase === null/);
  // El reparto sigue con las etapas ENTERAS: filtrarlas volvería huérfanos a los escondidos.
  assert.match(TABLA, /repartirEnEtapas\(etapas, filas, \(c\) => asignacion\[c\.leadId\]\?\.etapa\)/);
  // Lo que se arrastra en lote es lo que se DIBUJA, no la lista entera.
  assert.match(TABLA, /const dibujadas = agrupada \? grupos\.flatMap\(\(g\) => g\.clientes\) : filas;/);
  assert.match(bloque(TABLA, 'const agarrar = (', 'const soltarEn = ('), /const selVisibles = dibujadas\.filter\(/);
});

// ── 4. Los contactos en el CSV (opción A, sin botón nuevo) ──────────────────────

const C = (leadId: number, extra: Partial<ClienteCruce> = {}): ClienteCruce =>
  ({ leadId, nombre: `Cliente ${leadId}`, empresa: null, ...extra }) as ClienteCruce;

test('el CSV lleva Email y Teléfono, de los datos que ya están en el navegador', () => {
  assert.deepEqual([...CABECERA_CSV], ['Cliente', 'Nombre', 'Empresa', 'Email', 'Teléfono', 'Proyectos', 'Tareas', 'Recurrentes']);
  const filas = filasCSV(
    [
      C(21, { empresa: 'Acme', email: ' ana@x.com ', ficha: { contacto: { telefono: '+52 55 1', web: null, fotoGuardada: null }, llamadas: null } as ClienteCruce['ficha'] }),
      // Sin email y con la lectura de contactos caída: celdas vacías, nunca un texto en la columna.
      C(22, { nombre: '  ', email: null, ficha: { contacto: null, llamadas: null } as ClienteCruce['ficha'] }),
    ],
    new Map([[21, 1], [22, 2]]),
    (id) => (id === 21 ? { proyectos: 2, abiertas: 5, recurrentes: 1 } as never : null),
  );
  // `filasCSV` devuelve las celdas SIN escapar: el teléfono sale crudo acá a propósito. Cómo lo
  // lee Excel lo decide `textoCSV`, y eso se fija en el test de abajo.
  assert.deepEqual(filas[1], [1, 'Cliente 21', 'Acme', 'ana@x.com', '+52 55 1', 2, 5, 1]);
  assert.deepEqual(filas[2], [2, 'Sin nombre', '', '', '', 0, 0, 0]);
  const txt = textoCSV([['a"b', 'c\nd'], [1, 2]]);
  assert.ok(txt.startsWith('﻿'), 'sin BOM, Excel en español se come los acentos');
  assert.equal(txt.slice(1), '"a""b";"c d"\r\n"1";"2"');
  // Y la pantalla exporta ESO, no una copia propia de las columnas.
  assert.match(bloque(APP, 'function exportarCSV(', 'URL.createObjectURL'), /textoCSV\(filasCSV\(filas, numeroDe, resumenDe\)\)/);
  assert.doesNotMatch(APP, /'Cliente', 'Nombre', 'Empresa'/, 'dos listas de columnas se separan');
});

// El CSV está hecho para Excel en español (el `;` y el BOM), así que lo que importa es cómo lo
// LEE Excel: una celda que arranca con `=`, `+`, `-` o `@` se ejecuta como fórmula, y un teléfono
// de puros dígitos se redondea a notación científica. Lo que se fija es el TEXTO del archivo:
// esta máquina no tiene Excel ni LibreOffice para abrirlo (ver el comentario de `celda`).
test('el CSV no ejecuta fórmulas y el teléfono llega como texto', () => {
  const linea = (celdas: Array<string | number>) => textoCSV([celdas]).slice(1);
  // Lo que Excel volvería número va como `="…"`: con su `+`, sus espacios y su cero adelante.
  assert.equal(linea(['5215512345678']), '"=""5215512345678"""');
  assert.equal(linea(['+5215512345678']), '"=""+5215512345678"""', 'el + no puede llevar apóstrofo: es un teléfono');
  assert.equal(linea(['+52 55 1234 5678']), '"=""+52 55 1234 5678"""');
  assert.equal(linea(['0221 456']), '"=""0221 456"""');
  // Lo que arranca como fórmula lleva un apóstrofo, y la comilla de adentro se duplica igual.
  assert.equal(linea(['=1+1']), `"'=1+1"`);
  assert.equal(linea(['=HYPERLINK("http://x","clic")']), `"'=HYPERLINK(""http://x"",""clic"")"`);
  assert.equal(linea(['@SUM(A1)']), `"'@SUM(A1)"`);
  assert.equal(linea(['-Sin empresa-']), `"'-Sin empresa-"`);
  assert.equal(linea([' =1+1']), `"' =1+1"`, 'un espacio adelante no la desarma');
  assert.equal(linea(['\t=1+1']), `"'\t=1+1"`);
  assert.equal(linea(['\r\n=1+1']), `"' =1+1"`, 'el salto se aplana ANTES de mirar el arranque');
  // Una comilla NUNCA entra a `="…"`: ahí cerraría el literal y lo de atrás se ejecutaría.
  assert.equal(linea(['+52"&HYPERLINK(1)&"']), `"'+52""&HYPERLINK(1)&"""`);
  // Lo de siempre sigue igual, y un número de JS sigue siendo número.
  assert.equal(linea(['Acme', 'ana@x.com', '', 3, 0]), '"Acme";"ana@x.com";"";"3";"0"');
  assert.equal(linea(['Ana a=b']), '"Ana a=b"', 'sólo cuenta el arranque');
  // Y la fila de verdad: el teléfono del cliente 21 sale como texto en el archivo que se baja.
  const archivo = textoCSV(filasCSV(
    [C(21, { ficha: { contacto: { telefono: '+52 55 1', web: null, fotoGuardada: null }, llamadas: null } as ClienteCruce['ficha'] })],
    new Map([[21, 1]]),
    () => null,
  ));
  assert.equal(archivo.split('\r\n')[1], '"1";"Cliente 21";"";"";"=""+52 55 1""";"0";"0";"0"');
});

// ── 5. «Productos eliminados», sólo si el producto tiene embudo ─────────────────

test('la confirmación dice de dónde vuelve SÓLO con conEmbudo, y el dato viaja desde entrega.ts', () => {
  const eliminar = bloque(EDITOR, 'const eliminar = () => {', 'hacer: () =>');
  assert.match(eliminar, /\+ \(conEmbudo \? ' Lo recuperas en Productos eliminados del CRM\.' : ''\)/);
  // Una sola vez en el editor, y siempre bajo la condición.
  assert.equal(EDITOR.split('Lo recuperas en Productos eliminados del CRM.').length - 1, 1);
  assert.match(EDITOR, /^  conEmbudo: boolean;$/m, 'sin default: olvidárselo calla la línea sin que nada avise');
  assert.match(bloque(APP, '<EtapasEntregaModal', 'onCerrar='), /conEmbudo=\{servicio\.conEmbudo\}/);
  // entrega.ts: la misma pregunta que `eliminarServicioAction` («¿algún embudo vivo?»).
  assert.match(ENTREGA, /for \(const \[pid, si\] of algunoVivo\) if \(si\) conEmbudo\.add\(pid\);/);
  assert.match(ENTREGA, /conEmbudo: conEmbudo\.has\(p\.id\),/);
});

// ── 6. Los huérfanos del kanban: cada nombre abre su ficha ──────────────────────

test('el aviso de huérfanos nombra a cada uno con un botón que abre su ficha', () => {
  const aviso = bloque(KANBAN, '{huerfanos.length > 0 && (', '</p>');
  assert.match(aviso, /huerfanos\.map\(\(c, i\) => \(/);
  assert.match(aviso, /<button type="button" className="ke-huerfano" onClick=\{\(\) => onAbrir\(c\.leadId\)\}/);
  // Texto plano no se toca, y «Muévelos a una columna» pedía algo que el kanban no deja hacer.
  assert.doesNotMatch(aviso, /\.join\(', '\)/);
  assert.doesNotMatch(aviso, /Muévelos a una columna/);
  // Y el botón existe en la hoja (un className sin regla es un botón gris del navegador).
  assert.match(leer('app/customer-success/KanbanEntrega.tsx'), /\n\.ke-huerfano \{ background: none; border: 0;/);
});
