// =============================================================================
// Microsoft Clarity salió del producto, y no vuelve sin que alguien lo decida
// =============================================================================
// Pedido de Martín el 06/10/2026, textual: «Reemplaza a clarity al 100%... no
// quiero saber nada mas de clarity, quiero que MaKo haga todo».
//
// La grabación de cada visita la hace MaKo (lib/replay-*): queda atada al lead, se
// mira en su ficha y no le manda los datos de los visitantes de un cliente a un
// tercero. Lo que este test cuida es que nada vuelva a CABLEAR Clarity: un import
// del módulo que ya no existe, el tag de Microsoft adentro del snippet, una
// credencial de Clarity en el catálogo, su cron.
//
// ⚠️ SE MIRA EL CÓDIGO, NO LA PROSA. Los comentarios que explican por qué Clarity
// se fue lo nombran — es la convención de la casa —, y un guard sobre el archivo
// entero se acusaría a sí mismo. Se sacan las líneas `//` primero y los bloques
// después (al revés, un `/*` adentro de un `//` se come el código del medio).
//
// ⚠️ Y SE EXCEPTÚA POR NOMBRE, con su motivo, lo que NO es producto:
//   · el registro de /admin/dev (bitácoras, áreas, historial generado): es la
//     HISTORIA de qué se pidió y qué se hizo, y la entrada que documenta este
//     retiro nombra lo que se retiró;
//   · app/conocimientos/: es contenido de cursos de TERCEROS. Usa «clarity» como
//     palabra en inglés adentro de prompts de video, y hay lecciones que enseñan
//     Microsoft Clarity como herramienta (curso-master-escala-100k.ts): el curso
//     es de quien lo dicta, no una integración de MaKo.
// Es el mismo patrón que tests/funnel-estructura.test.ts usó para el retiro de /funnel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const EXCEPTUADOS = [
  /^app\/admin\/dev\/.*bitacora\.ts$/,
  /^app\/admin\/dev\/areas\.ts$/,
  /^app\/admin\/dev\/_historial\.generado\.ts$/,
  /^app\/conocimientos\//,
];

// Lo que CABLEA Clarity, en positivo. No se busca la palabra suelta: «MaKo ya no
// usa Microsoft Clarity» es un hecho que se le dice al modelo, y está bien.
const CABLEADO: Array<[RegExp, string]> = [
  [/clarity\.ms/i, 'el tag o la API de Microsoft Clarity'],
  [/from ['"](@\/lib\/clarity|\.\/clarity|\.\.\/clarity)['"]/, 'un import del módulo de Clarity'],
  [/CLARITY_(PROJECT_ID|API_TOKEN)/, 'una credencial de Clarity'],
  [/clarityProjectId/, 'el proyecto de Clarity de una página'],
  [/bloqueClarity|urlSesionesDe(Lead|Prueba)|resumenClarity/, 'una función de lib/clarity.ts'],
];

// PROBADO ROMPIENDOLO: agregando `const t = 'https://www.clarity.ms/tag/x';` a
// lib/landing-token.ts, este test falla nombrando el archivo y la línea.
test('nada en app/ ni lib/ vuelve a cablear Clarity', () => {
  // ⚠️ `git ls-files` y no un recorrido del disco: un guard contesta sobre lo que se
  // publica (AGENTS.md). Y por eso un archivo NUEVO hay que stagearlo antes de correr.
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((x) => x.trim())
    .filter((f) => /\.(ts|tsx)$/.test(f) && !EXCEPTUADOS.some((r) => r.test(f)) && existsSync(join(RAIZ, f)));
  assert.ok(archivos.length > 500, `se revisaron ${archivos.length} archivos: el listado está mal`);

  const hallazgos: string[] = [];
  for (const f of archivos) {
    const lineas = sinComentarios(leer(f)).split('\n');
    lineas.forEach((l, i) => {
      for (const [re, que] of CABLEADO) if (re.test(l)) hallazgos.push(`${f}:${i + 1} — ${que}: ${l.trim().slice(0, 110)}`);
    });
  }
  assert.deepEqual(hallazgos, [], 'Clarity volvió a cablearse. Si es a propósito, es una decisión del dueño, no un arreglo.');
});

test('el módulo, su cron y su test no existen', () => {
  assert.ok(!existsSync(join(RAIZ, 'lib/clarity.ts')), 'volvió lib/clarity.ts');
  assert.ok(!existsSync(join(RAIZ, 'app/api/cron/clarity-vigilante')), 'volvió el cron de Clarity');
  // Y Vercel no le pega a un cron que no existe: borrar la ruta sin borrar la
  // entrada lo deja disparando a un 404 todos los días, sin que nada lo diga.
  assert.ok(!/clarity/i.test(leer('vercel.json')), 'vercel.json todavía agenda algo de Clarity');
});

test('Clarity no está en ninguno de los registros de una integración', () => {
  // Una integración son TRES registros más el logo (AGENTS.md). Sale de los cuatro:
  // si quedara en uno, el formulario de /metodo pediría credenciales que nadie lee.
  for (const f of ['lib/integraciones-catalogo.ts', 'lib/metodo-catalogo.ts', 'lib/metodo-verificar.ts', 'app/_components/ServicioVisual.tsx']) {
    assert.ok(!/\bclarity\b/i.test(sinComentarios(leer(f))), `${f} todavía declara Clarity`);
  }
});
