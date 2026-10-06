// =============================================================================
// La tab Instagram salió del producto, y no vuelve sin que alguien lo decida
// =============================================================================
// Decisión de Martín (06/10/2026), sobre qué hacer con la tab y con lib/ig-chatbot.ts:
// «C: sacar la tab» — entera: la bandeja de DMs, el programador de publicaciones y el
// puente de los DMs al Chatbot. Medido ese día en producción: 0 filas en
// ig_conversaciones, ig_mensajes y contenido_posts en toda su historia; dos workspaces
// (ws11 y ws13) habían conectado Zernio. El Chatbot es SÓLO WhatsApp (AGENTS.md).
//
// Retirar una RUTA es enumerar sus links y decidir el destino de cada uno, y esconder
// una integración son cuatro registros más el deep link (AGENTS.md). Por eso este
// test no mira un solo archivo: mira lo que CABLEA Instagram en todo app/ y lib/ —
// un import de un módulo borrado, un link que arranque en /instagram, la API de
// Zernio, sus tablas, su flag— y los registros que la ofrecían (el nav, el
// onboarding, la API de MaKo, las cuatro piezas de la integración).
//
// ⚠️ SE MIRA EL CÓDIGO, NO LA PROSA. Los comentarios que explican por qué se fue la
// nombran (es la convención de la casa) y un guard sobre el archivo entero se acusaría
// a sí mismo. Las líneas `//` primero y los bloques después: al revés, un `/*` adentro
// de un `//` se come el código del medio.
//
// ⚠️ Y SE EXCEPTÚA POR NOMBRE, con su motivo, lo que no es producto:
//   · el registro de /admin/dev (bitácoras, áreas, historial generado): es la HISTORIA
//     de lo que se pidió y se hizo, y la bitácora del área Instagram la nombra entera;
//   · app/conocimientos/: contenido de cursos de TERCEROS que enseñan Instagram.
// Lo que NO se exceptúa es «Instagram» como palabra: los writers de Reels, Carousels y
// Stories escriben piezas PARA Instagram y la Content Machine los agrupa bajo ese
// rótulo. Lo que se fue es la tab que conectaba la cuenta y publicaba.
//
// PROBADO ROMPIÉNDOLO (06/10/2026): siete roturas, una por vez y restaurando de memoria.
// Cada una dio 5 pass / 1 fail, y cayó EXACTAMENTE el test que la cuida:
//   · `import { listAccounts } from '@/lib/zernio';` en app/reels/page.tsx → el barrido.
//   · `<Link href="/instagram">` en app/stories/StoriesApp.tsx → el barrido.
//   · lib/zernio.ts de vuelta (un archivo vacío) → «los módulos de la tab no existen».
//   · `return Response.json({ ok: false }, { status: 500 })` en el POST → el del webhook.
//   · la def `instagram` de vuelta en lib/tab-onboarding-catalogo.ts → el del nav/onboarding/API.
//   · `zernio: { letter: 'Z', … }` de vuelta en ServicioVisual.tsx → el de los cuatro registros.
//   · el redirect apuntando a '/whatsapp' → el de la ruta vieja.
// Restaurado: 6 pass / 0 fail.
//
// Y la revisión adversarial del mismo día (cuatro roturas más, 7 tests):
//   · el lector `contenido_publicado: … contar('contenido_posts', …)` de vuelta en
//     lib/objectives-fuentes.ts → 6 / 1, cae el barrido. Con el patrón viejo
//     (`.from('<tabla>')`) la MISMA rotura daba 7 / 0: el agujero por el que se coló.
//   · las excepciones de lib/workspace.ts y lib/tablas-de-inquilino.ts apagadas → 6 / 1,
//     el barrido nombra las cuatro líneas de las listas de scoping.
//   · la fuente `contenido_publicado` de vuelta en FUENTES_DEF → 6 / 1, cae el de los KPI.
//   · sólo el candidato que la siembra de vuelta en CANDIDATOS_KPI → 6 / 1, el mismo.
// Restaurado: 7 pass / 0 fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS } from '../lib/api-mako/tipos';
import { REGISTRO } from '../lib/api-mako/registro';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { FAMILIAS, itemsDe } from '../app/_components/nav';
import { POST } from '../app/api/webhooks/zernio/route';
import { CANDIDATOS_KPI, FUENTES_KPI } from '../lib/objectives-modelo';

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

// Lo que CABLEA la tab retirada, en positivo. No se busca la palabra suelta. El tercer
// elemento, si está, son los archivos donde ESE patrón está a propósito (con su motivo).
const CABLEADO: Array<[RegExp, string, string[]?]> = [
  [/from ['"](@\/lib\/(zernio|ig-chatbot|ig-contenido)|\.{1,2}\/(lib\/)?(zernio|ig-chatbot|ig-contenido))['"]/, 'un import de un módulo de Instagram que se borró'],
  // Con `../` y no `./`: app/admin/dev/registros.ts importa './instagram/bitacora', que
  // es la bitácora del ÁREA (la historia), no la carpeta de la tab.
  [/from ['"](@\/app\/instagram\/|(\.\.\/)+instagram\/)/, 'un import de la carpeta de la tab retirada'],
  [/['"`]\/instagram\b/, 'un link a /instagram (redirige a /chatbot: lo que prometía ya no existe)'],
  [/['"`]\/api\/instagram\//, 'la ruta de envío de DMs'],
  [/zernio\.com/, 'la API de Zernio'],
  // El nombre de la tabla como CADENA, no sólo adentro de `.from(...)`: la fuente de KPI
  // `contenido_publicado` (lib/objectives-fuentes.ts) contaba `contenido_posts` con
  // `contar('contenido_posts', …)` y la versión con `.from(` la dejaba pasar (revisión del
  // 06/10/2026). Las dos listas de scoping de inquilino las nombran A PROPÓSITO: las
  // tablas quedan en la base, y si alguien vuelve a leerlas tienen que salir scopeadas.
  [/['"`](ig_conversaciones|ig_mensajes|contenido_posts|zernio_workspace)['"`]/, 'una lectura o escritura de las tablas de Instagram',
    ['lib/workspace.ts', 'lib/tablas-de-inquilino.ts']],
  [/ig_auto_respuesta|KEY_IG_AUTO_RESPUESTA/, 'el flag de la respuesta automática de DMs'],
];

test('nada en app/ ni lib/ vuelve a cablear la tab Instagram', () => {
  // ⚠️ `git ls-files` y no un recorrido del disco: un guard contesta sobre lo que se
  // publica (AGENTS.md). Y por eso un archivo NUEVO hay que stagearlo antes de correr.
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((x) => x.trim())
    .filter((f) => /\.(ts|tsx)$/.test(f) && !EXCEPTUADOS.some((r) => r.test(f)) && existsSync(join(RAIZ, f)));
  assert.ok(archivos.length > 500, `se revisaron ${archivos.length} archivos: el listado está mal`);

  const hallazgos: string[] = [];
  for (const f of archivos) {
    sinComentarios(leer(f)).split('\n').forEach((l, i) => {
      for (const [re, que, salvo] of CABLEADO) {
        if (salvo?.includes(f)) continue;
        if (re.test(l)) hallazgos.push(`${f}:${i + 1} — ${que}: ${l.trim().slice(0, 110)}`);
      }
    });
  }
  assert.deepEqual(hallazgos, [], 'Instagram volvió a cablearse. Si es a propósito, es una decisión del dueño, no un arreglo.');
});

test('los módulos de la tab no existen, y de la carpeta sólo queda el redirect', () => {
  for (const f of ['lib/zernio.ts', 'lib/ig-chatbot.ts', 'lib/ig-contenido.ts', 'app/api/instagram', 'lib/api-mako/areas/instagram.def.ts', 'lib/api-mako/areas/instagram.run.ts', 'lib/api-mako/areas/instagram.helpers.ts']) {
    assert.ok(!existsSync(join(RAIZ, f)), `volvió ${f}`);
  }
  // Una pantalla nueva adentro de app/instagram resucitaría la tab sin pasar por el nav.
  assert.deepEqual(readdirSync(join(RAIZ, 'app/instagram')), ['page.tsx']);
});

test('/instagram redirige a /chatbot preservando el workspace de la pestaña', () => {
  // Hay links afuera del repo (marcadores, avisos ya mandados, el redirect_uri del OAuth
  // de Zernio): un 404 ahí es peor que la pantalla vieja. Y sin `rutaConWs` el super
  // admin que mira a un cliente aterriza en su propia cuenta.
  const page = sinComentarios(leer('app/instagram/page.tsx'));
  assert.match(page, /redirect\(await rutaConWs\('\/chatbot'\)\)/);
});

test('el webhook de Zernio contesta 200 sin procesar nada, y deja rastro', async () => {
  // Dos cuentas lo pueden seguir llamando: un 404 o un 5xx haría que Zernio reintente
  // cada evento para siempre. Se EJECUTA el handler, no se lee: lo que importa es lo que
  // contesta.
  const logs: string[] = [];
  const original = console.info;
  console.info = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
  try {
    const body = JSON.stringify({ event: 'message.received', message: { id: 'm1', text: 'hola', platform: 'instagram' } });
    const res = await POST(new Request('https://hola-mako.com/api/webhooks/zernio', { method: 'POST', body }) as never);
    assert.equal(res.status, 200);
    const json = await res.json() as { ok: boolean; ignored: string; event: string };
    assert.equal(json.ok, true);
    assert.equal(json.ignored, 'instagram-retirado');
    assert.equal(json.event, 'message.received');
    // Basura tampoco tira: un body que no es JSON sigue siendo un 200.
    const basura = await POST(new Request('https://hola-mako.com/api/webhooks/zernio', { method: 'POST', body: '<<no json>>' }) as never);
    assert.equal(basura.status, 200);
  } finally {
    console.info = original;
  }
  assert.ok(logs.some((l) => l.includes('[webhook:zernio] ignorado') && l.includes('message.received')),
    'un 200 mudo hace indistinguibles «no llegó» y «lo tiramos nosotros»');
  // Y no escribe ni lee: el payload trae DMs de personas y no hay pantalla que los lea.
  assert.doesNotMatch(sinComentarios(leer('app/api/webhooks/zernio/route.ts')), /getSupabaseServer|getTenantDb|runWithWorkspace|\.from\(/);
});

test('ni el nav, ni el onboarding, ni la API de MaKo ofrecen la tab', () => {
  const hrefs = FAMILIAS.flatMap(itemsDe).map((i) => i.href);
  assert.ok(!hrefs.some((h) => h.startsWith('/instagram')), 'volvió la entrada de Instagram al nav');

  assert.ok(!('instagram' in TAB_ONBOARDINGS), 'volvió el onboarding de la tab Instagram');
  const pasosIg = Object.entries(TAB_ONBOARDINGS)
    .flatMap(([tab, def]) => def.pasos.filter((p) => /instagram/i.test(p.key + p.label)).map((p) => `${tab}.${p.key}`));
  assert.deepEqual(pasosIg, [], 'un paso que pide conectar Instagram es un onboarding que no se puede terminar');

  assert.ok(!(AREAS as readonly string[]).includes('instagram'), 'volvió el área instagram de la API de MaKo');
  // `limites_formato_instagram` se queda a propósito: son los límites de cada formato,
  // que los writers de Reels, Carousels y Stories siguen usando. No publica nada.
  const ops = REGISTRO.map((d) => d.id).filter((id) => /instagram|zernio/.test(id) && id !== 'limites_formato_instagram');
  assert.deepEqual(ops, [], 'volvió una operación de Instagram a la API de MaKo');
  assert.ok(!REGISTRO.some((d) => d.gating?.tab === 'instagram'), 'una operación gateada por una tab que no existe no la ve ninguna capa con lista');
});

test('ningún KPI cuenta lo que escribía la tab retirada', () => {
  // `contenido_publicado` contaba las filas de `contenido_posts` publicadas, que sólo
  // escribía el programador de /instagram. Sin la tab daba 0 para siempre, y el candidato
  // «Contenido publicado» la sembraba con un compromiso de 7 por semana: un KPI en rojo
  // por un problema nuestro. Que no se vuelva a leer la tabla lo cuida el barrido de
  // arriba; esto cuida que el catálogo no la vuelva a ofrecer con el mismo nombre.
  assert.ok(!FUENTES_KPI.some((f) => f.id === 'contenido_publicado'), 'volvió la fuente contenido_publicado');
  assert.deepEqual(CANDIDATOS_KPI.filter((c) => c.fuenteId === 'contenido_publicado').map((c) => c.nombre), [],
    'un candidato sembraría un KPI que no puede contar nada');
});

test('Zernio no está en ninguno de los registros de una integración', () => {
  // Una integración son TRES registros más el logo (AGENTS.md). Sale de los cuatro: si
  // quedara en uno, /integraciones o /metodo pedirían una key que ya no lee nadie.
  for (const f of ['lib/integraciones-catalogo.ts', 'lib/metodo-catalogo.ts', 'lib/metodo-verificar.ts', 'app/_components/ServicioVisual.tsx']) {
    assert.ok(!/\bzernio\b/i.test(sinComentarios(leer(f))), `${f} todavía declara Zernio`);
  }
});
