// =============================================================================
// La TAB Instagram sigue afuera; Instagram (y Messenger) vuelven como CANAL: de Automations y de Chats
// =============================================================================
// La historia, en tres decisiones de Martín que no se contradicen:
//
//   · 06/10/2026, sobre la tab Instagram y lib/ig-chatbot.ts: «C: sacar la tab» — entera: la bandeja
//     de DMs, el programador de publicaciones y el puente de los DMs al Chatbot. Medido ese día en
//     producción: 0 filas en ig_conversaciones, ig_mensajes y contenido_posts en toda su historia.
//   · 09/10/2026, sexta tanda del Chatbot (CRON 4-7): «Con respecto a agregar Instagram, ya tenemos
//     la integración de Zernio, utiliza eso para poder enviar mensajes por allí», y lo mismo para
//     Messenger. Vuelve como CANAL de las automatizaciones: una tarjeta del lienzo, un disparador del
//     CRON, un webhook que recibe y un motor que manda.
//   · 14/10/2026, la tab Chats: «tener en UNA sola tab centralizado absolutamente todos los chats,
//     WhatsApp, Instagram, Messenger». La BANDEJA de DMs de Instagram y Messenger vuelve, pero ADENTRO
//     de Chats (docs/diseno-chats.md), junto al WhatsApp de cada contacto. Lo que NO vuelve: la tab
//     /instagram (sigue redirigiendo a /automations), su programador de publicaciones y sus 21
//     operaciones de la API (Chats lee y cierra conversaciones con ids neutros: el canal es un parámetro).
//
// Por eso este test pasó de «nada cablea Instagram» a «Instagram se cablea SÓLO por el canal»: la
// lista de quién puede hablar con Zernio y tocar sus tablas va en POSITIVO, archivo por archivo. Un
// archivo nuevo que lo haga es una decisión, no un arreglo: se suma a la lista con su porqué. Chats no
// se suma: sus rutas leen y mandan por las funciones exportadas de lib/canal-zernio.ts, que ya es canal.
//
// ⚠️ SE MIRA EL CÓDIGO, NO LA PROSA: las líneas `//` primero y los bloques después (AGENTS.md).
//
// PROBADO ROMPIÉNDOLO (06/10/2026, la versión de la tab): siete roturas, cada una 5 / 1 en el test que
// la cuida; y cuatro más en la revisión de ese día (7 / 0 restaurado).
// PROBADO ROMPIÉNDOLO (09/10/2026, la versión del canal), con el arnés que restaura de memoria, contra
// una base en verde de 8 pass / 0 fail. Cada rotura dio 7 / 1, en el test que la cuida:
//   · `import { cuentasConectadas } from '@/lib/zernio'` en app/reels/page.tsx → el barrido (Zernio fuera del canal).
//   · `'ig_mensajes'` en lib/leads.ts                                          → el barrido (las tablas fuera del canal).
//   · `'/instagram'` en app/stories/StoriesApp.tsx                             → el barrido (la tab).
//   · la def `instagram` de vuelta en lib/tab-onboarding-catalogo.ts          → «ni el nav, ni el onboarding…».
//   · el ping `zernio` renombrado en lib/metodo-verificar.ts                  → «Zernio está en los cuatro registros».
//   · el redirect de /instagram a /whatsapp                                    → «/instagram redirige a /automations…».
//   · un `JSON.parse(raw)` antes de la firma en el webhook                     → «el webhook procesa de nuevo…».
// Restaurado: 8 / 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS } from '../lib/api-mako/tipos';
import { REGISTRO } from '../lib/api-mako/registro';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { FAMILIAS, itemsDe } from '../app/_components/nav';
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

/**
 * EL CANAL, en positivo: los únicos archivos que hablan con Zernio o tocan las tablas de Instagram,
 * cada uno con lo que hace. Las dos listas de scoping de inquilino nombran las tablas A PROPÓSITO
 * (si alguien las lee, salen scopeadas).
 */
const CANAL: Record<string, string> = {
  'lib/zernio.ts': 'el cliente de la API de Zernio (cuentas, webhook, DM, respuesta privada)',
  // Desde el 14/10/2026 también es la puerta de la tab Chats: sus rutas (app/api/chats/**) y lib/chats.ts leen las
  // conversaciones y mandan la respuesta a mano por funciones exportadas de acá, sin nombrar las tablas ni Zernio.
  'lib/canal-zernio.ts': 'el motor manda un paso de Instagram o Messenger, lee las conversaciones y «te sigue» para las condiciones, y la bandeja de Chats lee y responde por acá',
  'lib/zernio-entrante.ts': 'la persona, su mensaje y el disparador de un evento',
  'app/api/webhooks/zernio/route.ts': 'el webhook (firma, ruteo, dedup)',
  'app/api/zernio/route.ts': 'la cuenta de salida del editor y «Conectar»',
  // Décima tanda (11/10/2026, GENERAL 6): «una automatización que usa un medio que aún no conectó, en la tarjeta
  // lo debe decir... y no dejar publicarlo». Es la MISMA pregunta que la ruta de arriba (¿hay una cuenta?), hecha
  // por el server para el chip, Publicar y Activar (`estadoMedios`). Desde la duodécima (12/10/2026) Publicar y Activar
  // además aseguran el webhook de Zernio (`asegurarAvisosSociales`): no le manda nada a un lead.
  'lib/disparadores-canales.ts': '¿está conectada la cuenta de Instagram o Messenger? (`estadoMedios`), y el webhook al publicar',
  'lib/metodo-verificar.ts': 'el ping de la integración (GET /profiles)',
  'lib/workspace.ts': 'TENANT_TABLES',
  'lib/tablas-de-inquilino.ts': 'las tablas de un inquilino',
};

// Lo que cablea Instagram. El tercer elemento: los archivos donde ESE patrón está a propósito.
const CANAL_ARCHIVOS = Object.keys(CANAL);
const CABLEADO: Array<[RegExp, string, string[]?]> = [
  // La TAB: sigue afuera, sin excepciones.
  [/from ['"](@\/lib\/(ig-chatbot|ig-contenido)|\.{1,2}\/(lib\/)?(ig-chatbot|ig-contenido))['"]/, 'un import de un módulo de la tab que se borró'],
  // Con `../` y no `./`: app/admin/dev/registros.ts importa './instagram/bitacora' (la HISTORIA del área).
  [/from ['"](@\/app\/instagram\/|(\.\.\/)+instagram\/)/, 'un import de la carpeta de la tab retirada'],
  [/['"`]\/instagram\b/, 'un link a /instagram (redirige a /automations: la tab no existe)'],
  [/['"`]\/api\/instagram\//, 'la ruta de envío de DMs de la tab'],
  [/['"`]contenido_posts['"`]/, 'el programador de publicaciones de la tab', ['lib/workspace.ts', 'lib/tablas-de-inquilino.ts']],
  [/ig_auto_respuesta|KEY_IG_AUTO_RESPUESTA/, 'el flag de la respuesta automática de DMs de la tab'],
  // El CANAL: sólo desde sus archivos.
  [/from ['"](@\/lib\/zernio|\.{1,2}\/(lib\/)?zernio)['"]/, 'un import del cliente de Zernio fuera del canal', CANAL_ARCHIVOS],
  // La API (`zernio.com/api`), no el dominio: el tutorial de la integración linkea a zernio.com.
  [/zernio\.com\/api/, 'la API de Zernio fuera del canal', CANAL_ARCHIVOS],
  [/['"`](ig_conversaciones|ig_mensajes|zernio_workspace|zernio_eventos)['"`]/, 'las tablas del canal fuera del canal', CANAL_ARCHIVOS],
];

test('Instagram se cablea SÓLO por el canal, y la tab no vuelve', () => {
  // ⚠️ `git ls-files` y no el disco: un guard contesta sobre lo que se publica (AGENTS.md). Un archivo
  // NUEVO hay que stagearlo (o `git add -N`) antes de correr.
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
  assert.deepEqual(hallazgos, [], 'Si es a propósito, va a CANAL con su porqué: es una decisión, no un arreglo.');
  // Y la lista no tiene permisos viejos: cada archivo del canal existe.
  assert.deepEqual(CANAL_ARCHIVOS.filter((f) => !existsSync(join(RAIZ, f))), [], 'un permiso para un archivo que ya no existe');
});

test('los módulos de la tab no existen, y de la carpeta sólo queda el redirect', () => {
  for (const f of ['lib/ig-chatbot.ts', 'lib/ig-contenido.ts', 'app/api/instagram', 'lib/api-mako/areas/instagram.def.ts', 'lib/api-mako/areas/instagram.run.ts', 'lib/api-mako/areas/instagram.helpers.ts']) {
    assert.ok(!existsSync(join(RAIZ, f)), `volvió ${f}`);
  }
  assert.deepEqual(readdirSync(join(RAIZ, 'app/instagram')), ['page.tsx']);
  // El cliente de Zernio SÍ existe (09/10/2026): es del canal.
  assert.ok(existsSync(join(RAIZ, 'lib/zernio.ts')));
});

test('/instagram redirige a /automations preservando el workspace de la pestaña', () => {
  const page = sinComentarios(leer('app/instagram/page.tsx'));
  // DIRECTO a /automations desde el 09/10/2026 (la tab Chatbot se renombró; /chatbot también
  // redirige y un salto de más es un redirect más). Roto devolviendo '/chatbot': 7 / 1 (base 8 / 0).
  assert.match(page, /redirect\(await rutaConWs\('\/automations'\)\)/);
});

test('el webhook de Zernio procesa de nuevo: firma verificada antes de leer nada', () => {
  // Hasta el 09/10/2026 contestaba 200 sin procesar. Ahora es el receptor del canal: la firma va sobre
  // el cuerpo CRUDO, fail-closed, y sin ella nada se lee ni se escribe. Lo demás (ruteo estricto,
  // dedup, el orden) lo fija tests/canal-social.test.ts.
  const src = sinComentarios(leer('app/api/webhooks/zernio/route.ts'));
  const iFirma = src.indexOf('verificarFirmaZernio(raw');
  assert.ok(iFirma > 0 && iFirma < src.indexOf('JSON.parse(raw)'), 'la firma va antes de parsear');
  assert.ok(iFirma < src.indexOf('getSupabaseServer()'), 'la firma va antes de tocar la base');
  assert.match(src, /status: 401/);
});

test('ni el nav, ni el onboarding, ni la API de MaKo ofrecen la tab', () => {
  const hrefs = FAMILIAS.flatMap(itemsDe).map((i) => i.href);
  assert.ok(!hrefs.some((h) => h.startsWith('/instagram')), 'volvió la entrada de Instagram al nav');

  assert.ok(!('instagram' in TAB_ONBOARDINGS), 'volvió el onboarding de la tab Instagram');
  const pasosIg = Object.entries(TAB_ONBOARDINGS)
    .flatMap(([tab, def]) => def.pasos.filter((p) => /instagram/i.test(p.key + p.label)).map((p) => `${tab}.${p.key}`));
  assert.deepEqual(pasosIg, [], 'un paso que pide conectar Instagram es un onboarding que no se puede terminar');

  assert.ok(!(AREAS as readonly string[]).includes('instagram'), 'volvió el área instagram de la API de MaKo');
  const ops = REGISTRO.map((d) => d.id).filter((id) => /instagram|zernio/.test(id) && id !== 'limites_formato_instagram');
  assert.deepEqual(ops, [], 'volvió una operación de Instagram a la API de MaKo: el canal no es la tab');
  assert.ok(!REGISTRO.some((d) => d.gating?.tab === 'instagram'), 'una operación gateada por una tab que no existe no la ve ninguna capa con lista');
});

test('ningún KPI cuenta lo que escribía la tab retirada', () => {
  assert.ok(!FUENTES_KPI.some((f) => f.id === 'contenido_publicado'), 'volvió la fuente contenido_publicado');
  assert.deepEqual(CANDIDATOS_KPI.filter((c) => c.fuenteId === 'contenido_publicado').map((c) => c.nombre), [],
    'un candidato sembraría un KPI que no puede contar nada');
});

test('Zernio está en los cuatro registros de una integración', () => {
  // Una integración son TRES registros más el logo (AGENTS.md). Sale del canal, y vuelve a los cuatro:
  // sin el ping, el tilde del campo dice «servicio inválido» y no se puede guardar la key.
  assert.match(sinComentarios(leer('lib/integraciones-catalogo.ts')), /key: 'zernio'/);
  assert.match(sinComentarios(leer('lib/metodo-catalogo.ts')), /key: 'zernio'/);
  assert.match(sinComentarios(leer('lib/metodo-verificar.ts')), /async zernio\s*\(/);
  assert.match(sinComentarios(leer('app/_components/ServicioVisual.tsx')), /^\s{2}zernio:\s*\{/m);
});

test('el ruteo de Zernio NO sale de una credencial: la key es secreta y el server acuña el profile', () => {
  // Una key jamás se espeja en claro a webhook_routing. El ruteo lo reclama lib/zernio.ts (el profile
  // al crearlo y cada cuenta al listarla), y por eso Zernio no está en ROUTING_CREDS.
  assert.doesNotMatch(sinComentarios(leer('lib/webhook-routing.ts')), /ZERNIO_API_KEY/);
  const z = sinComentarios(leer('lib/zernio.ts'));
  assert.match(z, /upsertRouting\(RUTEO_PERFIL, profileId, ws\)/);
  assert.match(z, /upsertRouting\(RUTEO_CUENTA, a\._id, ws\)/);
});
