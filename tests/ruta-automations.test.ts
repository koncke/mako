// =============================================================================
// La tab «Chatbot» pasó a llamarse «Automations» (09/10/2026): la ruta, la carpeta y el nombre
// =============================================================================
// Pedido de Martín (sexta tanda, General 1), textual: «Cambia el nombre de la tab "Chatbot" por
// "Automations", el nombre en la sidebar, la ruta, todo.»
//
// Lo que este archivo fija:
//   1. /chatbot REDIRIGE a /automations con la query ENTERA (`?sec=`, `?aviso=`, `?stab=`, el
//      `?ws=`): hay avisos de WhatsApp ya mandados, marcadores y el regreso del OAuth de Zernio
//      que la nombran, y un redirect pelado abre la tab en la primera automatización.
//   2. Los alias viejos (/setting, /chat-bot, /chat-agent, /instagram) van DIRECTO a /automations,
//      sin pasar por /chatbot.
//   3. El nav dice «Automations», su KEY sigue siendo `setting` (está escrita en la base: capas,
//      roles, onboarding.tab.setting) y las URLs viejas siguen marcando la tab.
//   4. EL GUARD: nada del producto vuelve a enlazar /chatbot como DESTINO. El molde es el de
//      /funnel (tests/funnel-estructura.test.ts): se busca una CADENA que ARRANQUE con la ruta,
//      se saltean los comentarios (la casa nombra las rutas viejas en prosa, entre backticks).
//      Las únicas excepciones son el propio redirect y la lista de alias (lib/ruta-automations.ts).
//   5. Y nada importa de la carpeta vieja: app/chatbot tiene un solo archivo, el redirect.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez contra la base en verde de este archivo
// (6 pass / 0 fail), con un arnés que restaura DE MEMORIA y verifica con md5 (pass / fail):
//   · `href: '/chatbot'` de vuelta en el item del nav                        → 4 / 2 (nav + guard)
//   · `linkApp('/chatbot', ws)` de vuelta en app/api/zernio/route.ts          → 5 / 1 (guard)
//   · `router.push(\`/chatbot?stab=…\`)` en app/whatsapp/EmpresaInbox.tsx      → 5 / 1 (guard)
//   · el redirect de /chatbot sin la query (`rutaConWs(RUTA_AUTOMATIONS)`)    → 5 / 1 (redirect)
//   · `destinoConQuery` que se queda con el primer valor de un parámetro      → 5 / 1 (destino)
//   · /chat-agent redirige a '/chatbot' (el doble salto)                      → 4 / 2 (alias + guard)
//   · un import `../chatbot/OnboardingChatAgent` en app/email                 → 5 / 1 (carpeta)
//   · un comentario `// … /chatbot?sec=12 …` en app/api/zernio/route.ts       → 6 / 0 (la prosa no es un link)
// Restaurado: 6 / 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { RUTA_AUTOMATIONS, RUTAS_VIEJAS_AUTOMATIONS, destinoConQuery } from '../lib/ruta-automations';
import { FAMILIAS, itemsDe } from '../app/_components/nav';
import { tituloDe } from '../lib/titulo-tab';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (un `/*` adentro de un `//` abre un bloque falso)
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los .ts/.tsx de `app/` y `lib/` que están EN GIT (un archivo nuevo va con `git add -N`). */
function archivosDeProducto(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib', 'proxy.ts'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 500, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

/**
 * Las líneas de CÓDIGO de un fuente, con su número: sin las de comentario (`//`, `*`, `/*`, `{/*`)
 * ni las que siguen adentro de un bloque abierto al principio de una línea. Por línea y no con un
 * regex sobre el archivo entero: un `accept="image/*"` en el medio de una línea de código abriría un
 * bloque falso y escondería al guard todo lo que viene después.
 */
function lineasDeCodigo(src: string): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  let enBloque = false;
  src.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (enBloque) { if (t.includes('*/')) enBloque = false; return; }
    if (/^(\/\/|\*)/.test(t)) return;
    if (/^(\{\s*)?\/\*/.test(t)) { if (!t.includes('*/')) enBloque = true; return; }
    out.push([i + 1, l]);
  });
  return out;
}

test('destinoConQuery lleva la query ENTERA, con los valores repetidos en orden, y sin `?` cuando no hay nada', () => {
  assert.equal(destinoConQuery('/automations', {}), '/automations');
  assert.equal(destinoConQuery('/automations', { sec: '12', ws: '3' }), '/automations?sec=12&ws=3');
  assert.equal(destinoConQuery('/automations', { aviso: 'cuota vencida/2' }), '/automations?aviso=cuota+vencida%2F2');
  assert.equal(destinoConQuery('/automations', { stab: 'plantillas', tpl: ['a', 'b'] }), '/automations?stab=plantillas&tpl=a&tpl=b');
  // Un parámetro sin valor viaja vacío (`?conectado=` del OAuth de Zernio), uno undefined no viaja.
  assert.equal(destinoConQuery('/automations', { conectado: '', x: undefined }), '/automations?conectado=');
});

test('/chatbot es SÓLO el redirect: a /automations, con `rutaConWs` y con la query entera', () => {
  // Nada más vive en la carpeta vieja: los componentes se mudaron con `git mv` a app/automations.
  assert.deepEqual(readdirSync(join(RAIZ, 'app/chatbot')), ['page.tsx']);
  const page = sinComentarios(leer('app/chatbot/page.tsx'));
  assert.match(page, /redirect\(await rutaConWs\(destinoConQuery\(RUTA_AUTOMATIONS, await searchParams\)\)\)/,
    'el redirect de /chatbot perdió la query (los `?sec=`/`?aviso=` de los avisos ya mandados) o el `?ws=`');
  assert.equal(RUTA_AUTOMATIONS, '/automations');
  // La pantalla de verdad vive en app/automations, con el MISMO guard y la MISMA key de siempre.
  assert.match(sinComentarios(leer('app/automations/page.tsx')), /requireRolWs\(\['setter'\], \{ nav: 'setting' \}\)/);
});

test('los alias viejos van DIRECTO a /automations (sin el salto por /chatbot)', () => {
  for (const f of ['app/setting/page.tsx', 'app/chat-bot/page.tsx', 'app/chat-agent/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /redirect\(await rutaConWs\(destinoConQuery\(RUTA_AUTOMATIONS, await searchParams\)\)\)/, `${f} no va directo a /automations con la query`);
    assert.doesNotMatch(src, /\/chatbot/, `${f} todavía nombra /chatbot`);
  }
  // /instagram es una tab retirada: no traduce parámetros (su `?conectado=1` era de un OAuth muerto).
  assert.match(sinComentarios(leer('app/instagram/page.tsx')), /redirect\(await rutaConWs\('\/automations'\)\)/);
});

test('el nav dice «Automations», su key sigue siendo `setting`, y las URLs viejas siguen marcando la tab', () => {
  const items = FAMILIAS.flatMap(itemsDe);
  const it = items.find((i) => i.key === 'setting');
  assert.ok(it, 'se fue el item `setting` del nav (la key está escrita en la base: capas, roles, onboarding)');
  assert.equal(it.label, 'Automations');
  assert.equal(it.href, '/automations');
  for (const p of ['/automations', ...RUTAS_VIEJAS_AUTOMATIONS]) assert.ok(it.match(p), `el nav no marca la tab en ${p}`);
  assert.deepEqual([...RUTAS_VIEJAS_AUTOMATIONS], ['/chatbot', '/chat-bot', '/chat-agent']);
  // Nadie más del nav apunta a la ruta vieja.
  assert.deepEqual(items.filter((i) => RUTAS_VIEJAS_AUTOMATIONS.some((r) => i.href === r || i.href.startsWith(r + '?'))).map((i) => i.key), []);
  // El título de la pestaña del navegador sale del nav (lib/titulo-tab.ts), y la ruta vieja dice lo mismo.
  for (const p of ['/automations', '/chatbot', '/setting']) assert.equal(tituloDe(p), 'MaKo - Automations', p);
  // El onboarding de la tab: la key y el href nuevos, el nombre nuevo.
  assert.equal(TAB_ONBOARDINGS.setting.href, '/automations');
  assert.equal(TAB_ONBOARDINGS.setting.nombre, 'Automations');
});

test('⚠️ nada del producto ENLAZA /chatbot: es un redirect, y la única lista que la nombra es la de alias', () => {
  // ⚠️ SE BUSCA UN LINK, NO LA PALABRA: `/chatbot` tiene que ARRANCAR una cadena y terminar ahí o en
  // `?`/`#`. Así no cazan ni la prosa de los comentarios ni las rutas REST de /api/v1 del ÁREA
  // `chatbot` de la API de MaKo (`'/chatbot/secuencias'`, lib/api-mako/rest.ts), que no se renombran.
  //
  // Las bitácoras de /admin/dev y el historial generado son DOCUMENTACIÓN: cuentan en prosa lo que
  // pasó y nombran la ruta como era, sólo que la prosa vive en una cadena.
  const PERMITIDOS = new Set(['app/chatbot/page.tsx', 'lib/ruta-automations.ts']);
  const DOCUMENTACION = [/^app\/admin\/dev\/.*bitacora\.ts$/, /^app\/admin\/dev\/_historial\.generado\.ts$/, /^app\/conocimientos\//];
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (PERMITIDOS.has(f) || DOCUMENTACION.some((re) => re.test(f))) continue;
    for (const [n, l] of lineasDeCodigo(readFileSync(join(RAIZ, f), 'utf8'))) {
      if (/['"`]\/chatbot(['"`?#]|$)/.test(l)) malos.push(`${f}:${n} — ${l.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(malos, [], 'hay links vivos a /chatbot, que hoy sólo redirige: van a /automations (RUTA_AUTOMATIONS)');
  // Y la lista de alias sigue nombrándola (si no, el nav dejaría de marcar la tab en los links viejos).
  assert.match(leer('lib/ruta-automations.ts'), /RUTAS_VIEJAS_AUTOMATIONS = \['\/chatbot',/);
});

test('nada importa de la carpeta vieja (app/chatbot): ni `@/app/chatbot`, ni un `../chatbot/` que resuelva ahí', () => {
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (f === 'app/chatbot/page.tsx') continue;
    for (const [n, l] of lineasDeCodigo(readFileSync(join(RAIZ, f), 'utf8'))) {
      if (/['"]@\/app\/chatbot\//.test(l)) malos.push(`${f}:${n}`);
      for (const m of l.matchAll(/['"]((?:\.\.?\/)+)chatbot\//g)) {
        // `./chatbot/bitacora` desde app/admin/dev es el REGISTRO del área, que no se movió.
        if (posix.normalize(posix.join(posix.dirname(f), m[1] + 'chatbot')) === 'app/chatbot') malos.push(`${f}:${n}`);
      }
    }
  }
  assert.deepEqual(malos, [], 'un import de la carpeta vieja: la pantalla vive en app/automations');
});
