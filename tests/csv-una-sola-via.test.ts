// =============================================================================
// Toda exportación a CSV pasa por lib/csv-celda.ts: una exportación nueva que arme su propio escape rompe Actions
// =============================================================================
// Pedido del 21/10/2026 (inyección de fórmulas en los CSV): cinco exportadores tenían cada uno su `celda` o su `esc`, cuatro sin defensa contra las celdas que
// arrancan con = + - @ (o con tab / CR), y una sola exportación nueva que olvide el escape reabre el agujero —la de leads del CRM lleva nombres que vienen de
// formularios PÚBLICOS—. Esta guarda barre `app/`, `lib/` y `components/` y exige tres cosas:
//
//   R1. El idioma del escape de CSV —`replace(/"/g, '""')`— vive SÓLO en lib/csv-celda.ts. Quien escribe el suyo, rompe.
//   R2. Un archivo que BAJA o SIRVE un `text/csv` (un `Blob([…], { type: 'text/csv' })`, un `descargar(…, 'text/csv')`, un header `Content-Type: text/csv`) importa el
//       helper, o está en CONSUME_CSV_DE_OTRO con el módulo que arma el CSV y el porqué (ese módulo, a su vez, tiene que importar el helper).
//   R3. Un archivo que DEFINE algo llamado `…csv…` (`textoCSV`, `tareasACsv`, `exportarCsv`) importa el helper, o consume el CSV de otro (CONSUME_CSV_DE_OTRO), o sólo
//       lo LEE (SOLO_LEEN_CSV: un importador).
//
// Las listas se mantienen a propósito chicas y con su porqué: una entrada que ya no hace falta falla (se ve el cambio) y una exportación nueva obliga a decidir.
//
// ⚠️ Los archivos NUEVOS sin `git add` no los ve `git ls-files`: `antes-de-subir` corre los tests con un índice temporal que sí los ve, y en Actions ya están en el commit.
// ⚠️ No es un analizador de JS: los comentarios se sacan con una regex (sin tocar `://` de una URL) y las búsquedas son de texto. Atrapa lo que alguien escribe de buena fe
// sin saber de esta regla —que es el caso—; no atrapa un escape ofuscado, y un `text/csv` armado por concatenación de strings se le escapa a R2 (R1 y R3 siguen).
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['app', 'lib', 'components'];
const AYUDANTE = 'lib/csv-celda.ts';

type Fuente = { ruta: string; codigo: string };

/**
 * Archivos que BAJAN o SIRVEN un CSV que ARMA otro módulo. `constructor` es el módulo (ruta del repo) que lo arma y que tiene que importar el helper.
 * Una entrada nueva es una exportación nueva: pasa por revisión.
 */
const CONSUME_CSV_DE_OTRO = new Map<string, { constructor: string; porque: string }>([
  ['app/crm/ExportarLeadsModal.tsx', { constructor: 'app/crm/leads-exportar.ts', porque: 'el texto llega de exportLeadsAction (server), que lo arma con csvDeLeads; el modal sólo lo baja' }],
  ['app/crm/lead-view/ficha/FichaPorBloques.tsx', { constructor: 'app/crm/lead-view/ficha/exportar-lead.ts', porque: 'el botón de la ficha baja el csvDelLead' }],
  ['app/customer-success/ClientesApp.tsx', { constructor: 'app/customer-success/exportar.ts', porque: 'baja el textoCSV de la cartera' }],
  ['app/dashboard/EditorInforme.tsx', { constructor: 'app/dashboard/exportar.ts', porque: 'baja el csvDeHoja de una hoja del Dashboard' }],
  ['app/plan/board/ExportarModal.tsx', { constructor: 'app/plan/board/exportar.ts', porque: 'baja tareasACSV / proyectosACSV del tablero' }],
  ['app/api/agente/metricas/route.ts', { constructor: 'lib/metricas-modelo.ts', porque: 'sirve metricasACsv a los agentes' }],
  ['app/api/graficos/exportar/route.ts', { constructor: 'app/dashboard/exportar.ts', porque: 'sirve el csvDeHoja que arma la operación leer_hoja_dashboard de la API de MaKo' }],
]);

/**
 * Archivos que sólo LEEN un CSV (un importador): definen `parseCsv`, `esCsv`… y no arman nada. Hoy ninguno hace falta: el importador de leads importa el helper (para
 * `desescaparCeldaCsv`, el camino de vuelta de lo que la app exporta). Queda para el que lea un CSV sin esa necesidad.
 */
const SOLO_LEEN_CSV = new Map<string, string>([]);

const IMPORTA_AYUDANTE = /from\s+['"](?:@\/lib\/csv-celda|(?:\.{1,2}\/)+(?:lib\/)?csv-celda)['"]/;
/** El escape de CSV escrito a mano: duplicar las comillas con `replace` / `replaceAll`. */
const IDIOMA_ESCAPE = /\.replace(?:All)?\(\s*(?:\/"\/g|"\\""|'"'|`"`)\s*,\s*(?:'""'|"\\"\\""|`""`)\s*\)/;
/** Un `text/csv` que sale de verdad: Blob, `descargar(…)` o un header Content-Type (no una lista de MIME permitidos). */
const SUMIDERO_CSV = /(?:\bBlob\s*\(|\bdescargar\s*\(|['"]content-type['"]\s*[:,])[^;]{0,400}?text\/csv/i;
/** Algo que se DEFINE (function / const / let). */
const DEFINE = /\b(?:function|const|let)\s+([A-Za-z_$][\w$]*)/g;
/**
 * «csv» como PALABRA del nombre: `CSV`, `Csv`, o `csv` al principio o tras un guion bajo. A propósito NO es un `/csv/i` suelto: «Do-csV-iew» (DocsView) y «Graphi-csV-iew»
 * lo tienen adentro y no tienen nada que ver.
 */
const PALABRA_CSV = /CSV|Csv|^csv|_csv/;
const definidosConCsv = (limpio: string): string[] => [...limpio.matchAll(DEFINE)].map((m) => m[1]).filter((n) => PALABRA_CSV.test(n));

/** El código sin comentarios (los de bloque, y los de línea que no sean el `//` de una URL). */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;,)}{(])\/\/.*$/gm, '$1');
}

/** Lo que está mal en esas fuentes, como líneas legibles. */
function revisar(fuentes: readonly Fuente[], consume: ReadonlyMap<string, { constructor: string; porque: string }> = CONSUME_CSV_DE_OTRO, soloLeen: ReadonlyMap<string, string> = SOLO_LEEN_CSV): string[] {
  const problemas: string[] = [];
  for (const { ruta, codigo } of fuentes) {
    if (ruta === AYUDANTE) continue;
    const limpio = sinComentarios(codigo);
    const importa = IMPORTA_AYUDANTE.test(limpio);
    if (IDIOMA_ESCAPE.test(limpio)) problemas.push(`${ruta}: arma su propio escape de CSV (\`replace(/"/g, '""')\`): usá celdaCsv / armarCsv de lib/csv-celda.ts`);
    if (SUMIDERO_CSV.test(limpio) && !importa && !consume.has(ruta)) {
      problemas.push(`${ruta}: baja o sirve un text/csv y no importa lib/csv-celda.ts; si lo arma otro módulo, sumalo a CONSUME_CSV_DE_OTRO con su porqué`);
    }
    const nombres = definidosConCsv(limpio);
    if (nombres.length && !importa && !consume.has(ruta) && !soloLeen.has(ruta)) {
      problemas.push(`${ruta}: define ${[...new Set(nombres)].join(', ')} y no importa lib/csv-celda.ts (¿arma un CSV a mano? si sólo lo lee, sumalo a SOLO_LEEN_CSV)`);
    }
  }
  return problemas;
}

function fuentesReales(): Fuente[] {
  const lista = execFileSync('git', ['ls-files', '--', ...DIRS], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').map((l) => l.trim()).filter((l) => /\.(?:ts|tsx|mjs|js|jsx)$/.test(l) && !/\.d\.ts$/.test(l));
  return lista.filter((ruta) => existsSync(join(RAIZ, ruta))).map((ruta) => ({ ruta, codigo: readFileSync(join(RAIZ, ruta), 'utf8') }));
}

// ---------------------------------------------------------------------------
// El repo de verdad
// ---------------------------------------------------------------------------

test('TODA exportación a CSV del repo pasa por lib/csv-celda.ts (R1: ningún escape propio; R2: todo text/csv que sale; R3: todo lo que se llame «csv»)', () => {
  const fuentes = fuentesReales();
  assert.ok(fuentes.length > 1000, `leyó ${fuentes.length} archivos de app/, lib/ y components/`);
  // Los detectores ven lo que tienen que ver (si dejaran de verlo, el assert de abajo pasaría en vacío).
  const sumideros = new Set(fuentes.filter((x) => SUMIDERO_CSV.test(sinComentarios(x.codigo))).map((x) => x.ruta));
  for (const conocido of ['app/admin/_polar/web/Orders/ExportCsvModal.tsx', 'app/crm/ExportarLeadsModal.tsx', 'app/customer-success/ClientesApp.tsx', 'app/plan/board/ExportarModal.tsx', 'app/api/agente/metricas/route.ts', 'app/api/graficos/exportar/route.ts']) {
    assert.ok(sumideros.has(conocido), `el detector de sumideros ya no ve ${conocido}`);
  }
  const conCsv = new Set(fuentes.filter((x) => definidosConCsv(sinComentarios(x.codigo)).length > 0).map((x) => x.ruta));
  for (const conocido of ['app/customer-success/exportar.ts', 'app/plan/board/exportar.ts', 'lib/metricas-modelo.ts', 'app/crm/leads-exportar.ts', 'app/dashboard/exportar.ts']) {
    assert.ok(conCsv.has(conocido), `el detector de nombres «csv» ya no ve ${conocido}`);
  }
  assert.ok(!conCsv.has('app/admin/docs/DocsView.tsx'), 'DocsView no tiene un «csv» como palabra');
  assert.deepEqual(revisar(fuentes), []);
});

test('las listas no se pudren: cada entrada de CONSUME_CSV_DE_OTRO y SOLO_LEEN_CSV existe y sigue haciendo lo que dice, y cada constructor importa el helper', () => {
  const porRuta = new Map(fuentesReales().map((f) => [f.ruta, sinComentarios(f.codigo)]));
  for (const [ruta, { constructor, porque }] of CONSUME_CSV_DE_OTRO) {
    const codigo = porRuta.get(ruta);
    assert.ok(codigo != null, `${ruta} ya no existe: sacalo de CONSUME_CSV_DE_OTRO`);
    assert.ok(SUMIDERO_CSV.test(codigo!) || definidosConCsv(codigo!).length > 0, `${ruta} ya no baja ni arma un CSV (${porque}): sacalo de CONSUME_CSV_DE_OTRO`);
    const armador = porRuta.get(constructor);
    assert.ok(armador != null, `${constructor} (el que arma el CSV de ${ruta}) no existe`);
    assert.ok(IMPORTA_AYUDANTE.test(armador!), `${constructor} arma el CSV de ${ruta} y NO importa lib/csv-celda.ts`);
  }
  for (const [ruta, porque] of SOLO_LEEN_CSV) {
    const codigo = porRuta.get(ruta);
    assert.ok(codigo != null, `${ruta} ya no existe: sacalo de SOLO_LEEN_CSV (${porque})`);
    assert.ok(!IDIOMA_ESCAPE.test(codigo!) && !SUMIDERO_CSV.test(codigo!), `${ruta} figura como «sólo lee» pero arma o baja un CSV`);
  }
});

test('el helper es el ÚNICO que tiene el escape: está en lib/csv-celda.ts y en ningún otro lado', () => {
  const duenos = fuentesReales().filter((f) => IDIOMA_ESCAPE.test(sinComentarios(f.codigo))).map((f) => f.ruta);
  assert.deepEqual(duenos, [AYUDANTE], 'el idioma está en el helper (si no estuviera, este test pasaría en vacío) y en ningún otro archivo de app/, lib/ ni components/');
});

// ---------------------------------------------------------------------------
// Los detectores, con fuentes de mentira
// ---------------------------------------------------------------------------

const f = (ruta: string, codigo: string): Fuente => ({ ruta, codigo });
const ninguna = new Map<string, { constructor: string; porque: string }>();

test('R1: un escape de CSV escrito a mano se reporta, en sus variantes; en un comentario o en otra cosa, no', () => {
  for (const mal of [
    `const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';`,
    `const esc = (s: string) => \`"\${s.replace(/"/g, '""')}"\`;`,
    `return s.replaceAll('"', '""');`,
    `x.replace(/"/g, "\\"\\"")`,
    `x.replace(/"/g,'""')`,
  ]) assert.equal(revisar([f('app/x/nuevo.ts', mal)], ninguna).length, 1, `no lo vio: ${mal}`);
  assert.deepEqual(revisar([f('app/x/doc.ts', `// replace(/"/g, '""') es el escape del formato\n/* y s.replace(/"/g, '""') */\nconst a = 1;`)], ninguna), [], 'un comentario no cuenta');
  assert.deepEqual(revisar([f('app/_ui/HtmlSeguro.tsx', `tag.replace(/"[^"]*"|'[^']*'/g, '""')`)], ninguna), [], 'otro replace con "" no es un CSV');
  assert.deepEqual(revisar([f(AYUDANTE, `s.replace(/"/g, '""')`)], ninguna), [], 'el helper es el dueño');
});

test('R2: un archivo que baja o sirve text/csv sin el helper se reporta; con el helper, o consumiendo de otro módulo declarado, no; una lista de MIME no cuenta', () => {
  const blob = `const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));`;
  const header = `return new Response(c, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });`;
  const descarga = `descargar(nombre, contenido, f.formato === 'md' ? 'text/markdown' : 'text/csv');`;
  for (const sumidero of [blob, header, descarga]) {
    assert.equal(revisar([f('app/x/nuevo.tsx', sumidero)], ninguna).length, 1, `no lo vio: ${sumidero}`);
    assert.deepEqual(revisar([f('app/x/nuevo.tsx', `import { armarCsv } from '@/lib/csv-celda';\n${sumidero}`)], ninguna), [], 'con el helper');
    assert.deepEqual(revisar([f('app/x/nuevo.tsx', `import { celdaCsv } from '../../lib/csv-celda';\n${sumidero}`)], ninguna), [], 'con el helper por ruta relativa');
    assert.deepEqual(revisar([f('app/x/nuevo.tsx', sumidero)], new Map([['app/x/nuevo.tsx', { constructor: 'app/x/arma.ts', porque: 'lo arma otro' }]])), [], 'consumiendo de otro declarado');
  }
  assert.deepEqual(revisar([f('lib/x/mimes.ts', `export const PERMITIDOS = ['text/plain', 'text/csv', 'application/pdf'];\nconst EXT = { 'text/csv': 'csv' };`)], ninguna), [], 'una lista de MIME no es una exportación');
  assert.deepEqual(revisar([f('app/x/doc.ts', `// new Blob([x], { type: 'text/csv' })\nconst a = 1;`)], ninguna), [], 'un comentario no cuenta');
});

test('R3: algo definido con «csv» en el nombre sin el helper se reporta, salvo que sólo lea el archivo o lo consuma de otro', () => {
  assert.equal(revisar([f('app/x/nuevo.ts', `export function tareasACsv(t: string[]) { return t.join(','); }`)], ninguna).length, 1);
  assert.equal(revisar([f('app/x/nuevo.ts', `export const textoCSV = (f: string[][]) => f.join('\\n');`)], ninguna).length, 1);
  assert.equal(revisar([f('app/x/nuevo.tsx', `const exportarCsv = () => bajar();`)], ninguna).length, 1);
  assert.deepEqual(revisar([f('app/x/ok.ts', `import { armarCsv } from '@/lib/csv-celda';\nexport const textoCSV = (f: string[][]) => armarCsv(f);`)], ninguna), []);
  assert.deepEqual(revisar([f('app/x/lee.ts', `export function parseCsv(t: string) { return t.split(','); }`)], ninguna, new Map([['app/x/lee.ts', 'sólo lee']])), []);
  assert.deepEqual(revisar([f('app/x/consume.tsx', `const exportarCsv = () => bajar();`)], new Map([['app/x/consume.tsx', { constructor: 'app/x/arma.ts', porque: 'p' }]])), []);
  assert.deepEqual(revisar([f('app/x/otra.ts', `const nombre = 'vocsvo';\nconst basicos = 1;`)], ninguna), [], 'sólo cuentan los identificadores definidos');
});

test('sinComentarios: saca los comentarios y deja las URL', () => {
  assert.equal(sinComentarios('a /* x */ b // c\nd'), 'a  b \nd');
  assert.equal(sinComentarios("const u = 'http://x.test/a'; // nota"), "const u = 'http://x.test/a'; ");
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corre este archivo con los de CSV, se restaura): 7 roturas de la guarda, 7 rojas.
//   · R1: un exportador (el del Plan) que vuelve a escribir su propio `replace(/"/g, '""')` → 2 rojas (la barrida y la del dueño único)
//   · R1: el detector que no ve `replaceAll` → 1 · el que no saca los comentarios → 3
//   · R2: el detector que no ve un `new Blob(…text/csv…)` → 2 · AdminView sin el import del helper → 1 (AdminView se borró el
//     6/11/2026 con la copia de Polar: el sumidero conocido de Admin es ahora app/admin/_polar/web/Orders/ExportCsvModal.tsx)
//   · R3: un `export const nuevoACsv` en un archivo SIN el helper → 1 (la primera versión de esta rotura la ponía en un archivo que YA importaba el helper y no podía dar rojo)
//   · «csv» como substring (`/csv/i`): DocsView y GraphicsView —«Do-csV-iew»— entran → 1 (es lo que pasó en la primera versión del detector, y por eso la regla es «csv» como PALABRA)
// =============================================================================
