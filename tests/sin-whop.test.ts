// =============================================================================
// Whop salió del producto, y no vuelve sin que alguien lo decida
// =============================================================================
// Pedido de Martín el 06/10/2026, textual: «Quiero eliminar Whop de la ecuación,
// que utilicemos directamente MaKo... Quiero que se puedan cargar vídeos, ya sea
// con un link o subiendo el video del curso».
//
// El curso vive en MaKo: las clases, los videos (link o subidos al bucket
// `curso-videos`), cuánto vio cada cliente y sus tareas (mig 0202, lib/curso*.ts).
// Lo que este test cuida es que nada vuelva a CABLEAR Whop: su módulo, su webhook,
// sus credenciales en el catálogo, su API.
//
// ⚠️ POR QUÉ HACÍA FALTA ESTE RETIRO, AUNQUE EL WEBHOOK YA NO ESTABA. El 26/09/2026
// (`07d07139`) se fueron el webhook, el sync y el mapa de lecciones, pero la
// integración quedó registrada: la tarjeta en /integraciones, sus campos con un
// tutorial que mandaba a pegar `{{APP_URL}}/api/webhooks/<whop>` —una ruta que ya
// daba 404—, el ping que pintaba el tilde verde con el nombre del negocio, y
// `lib/whop.ts` con cero consumidores. O sea: un cliente podía conectarla, verla
// en verde y apuntar su webhook a la nada. Una integración son TRES registros más
// el logo (AGENTS.md), y sacar una es sacarla de los cuatro.
//
// ⚠️ SE MIRA EL CÓDIGO, NO LA PROSA, y en POSITIVO: lo que CABLEA Whop, no la
// palabra suelta. Los comentarios que explican por qué se fue la pueden nombrar.
//
// ⚠️ Y SE EXCEPTÚA POR NOMBRE, con su motivo, lo que es HISTORIA y no producto:
//   · el registro de /admin/dev (bitácoras, áreas, historial generado de git): es
//     lo que se pidió y lo que se hizo, y la historia de agosto nombra lo que había;
//   · app/admin/dev/customer-success/roadmap-cs.ts: se declara a sí mismo «HISTORIA,
//     NO UN PLAN» desde el 26/09, y sus pasos citan el webhook que existió.
// Mismo patrón que tests/sin-clarity.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` PRIMERO y los bloques después: al revés, un `/*` que aparezca
// adentro de un comentario de línea se come el código del medio (AGENTS.md).
// El bloque se vacía CONSERVANDO sus saltos de línea: borrado entero, el número de
// línea del hallazgo queda corrido y manda a mirar otra línea (en la rotura de abajo
// decía `:99` sobre una línea que en el archivo es la 128; así, dice `:128`).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

const EXCEPTUADOS = [
  /^app\/admin\/dev\/.*bitacora\.ts$/,
  /^app\/admin\/dev\/areas\.ts$/,
  /^app\/admin\/dev\/_historial\.generado\.ts$/,
  /^app\/admin\/dev\/customer-success\/roadmap-cs\.ts$/,
];

const CABLEADO: Array<[RegExp, string]> = [
  [/api\.whop\.com/i, 'la API de Whop'],
  [/whop\.com\/dashboard/i, 'un link al panel de Whop'],
  [/WHOP_(API_KEY|WEBHOOK_SECRET)/, 'una credencial de Whop'],
  [/from ['"][^'"]*\/whop(-evento)?['"]/, 'un import del módulo de Whop'],
  [/\/api\/webhooks\/whop/i, 'el webhook de Whop'],
  [/key: ['"]whop['"]/, 'una entrada de catálogo de Whop'],
];

// PROBADO ROMPIÉNDOLO (06/10/2026): agregando
// `const URL_WHOP_PRUEBA = 'https://api.whop.com/api/v1/accounts/me';` al final de
// lib/standard-webhooks.ts, este test cae (1 fallo, 2 pases) con 1 hallazgo que
// nombra el archivo y «la API de Whop»; sacada la línea, 3 de 3 en verde.
test('nada en app/, lib/ ni scripts/ vuelve a cablear Whop', () => {
  // ⚠️ `git ls-files` y no un recorrido del disco: un guard contesta sobre lo que se
  // publica (AGENTS.md). Por eso un archivo NUEVO hay que stagearlo antes de correr,
  // y el `existsSync` saca los borrados que siguen en el índice.
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((x) => x.trim())
    .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !EXCEPTUADOS.some((r) => r.test(f)) && existsSync(join(RAIZ, f)));
  assert.ok(archivos.length > 500, `se revisaron ${archivos.length} archivos: el listado está mal`);

  const hallazgos: string[] = [];
  for (const f of archivos) {
    const lineas = sinComentarios(leer(f)).split('\n');
    lineas.forEach((l, i) => {
      for (const [re, que] of CABLEADO) if (re.test(l)) hallazgos.push(`${f}:${i + 1} — ${que}: ${l.trim().slice(0, 110)}`);
    });
  }
  assert.deepEqual(hallazgos, [], 'Whop volvió a cablearse. Si es a propósito, es una decisión del dueño, no un arreglo.');
});

test('el módulo, su parser, su webhook y sus scripts no existen', () => {
  for (const rel of ['lib/whop.ts', 'lib/whop-evento.ts', 'app/api/webhooks/whop', 'scripts/cargar-programa-whop.ts', 'scripts/apuntar-webhook-whop.ts']) {
    assert.ok(!existsSync(join(RAIZ, rel)), `volvió ${rel}`);
  }
  // Vercel no le pega a un cron que no existe: una entrada colgada dispara a un 404
  // todos los días sin que nada lo diga.
  assert.ok(!/whop/i.test(leer('vercel.json')), 'vercel.json agenda algo de Whop');
});

// PROBADO ROMPIÉNDOLO (06/10/2026): devolviendo `whop: { letter: 'W', bg: '#FF6243' },`
// al ICON de app/_components/ServicioVisual.tsx, este test cae (1 fallo, 2 pases)
// nombrando ese archivo; sacada la línea, 3 de 3 en verde.
test('Whop no está en ninguno de los cuatro registros de una integración', () => {
  // Si quedara en uno solo, /integraciones dibujaría una tarjeta (o pediría campos, o
  // verificaría una key) de algo que nadie lee: verde y mudo, que es lo que había.
  for (const f of ['lib/integraciones-catalogo.ts', 'lib/metodo-catalogo.ts', 'lib/metodo-verificar.ts', 'app/_components/ServicioVisual.tsx']) {
    assert.ok(!/\bwhop\b/i.test(sinComentarios(leer(f))), `${f} todavía declara Whop`);
  }
});
