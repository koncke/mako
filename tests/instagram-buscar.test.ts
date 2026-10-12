// =============================================================================
// instagram-buscar — el buscador de Instagram del alta de un lead (punto 28, 12/10/2026)
// =============================================================================
// Lo puro (lib/instagram-buscar.ts) se EJECUTA sobre cuerpos de ejemplo; la ruta y el componente se
// leen como fuente para fijar lo que no se ve: la sesión, de dónde salen las claves, el Enter.
//
// Los cuerpos siguen la forma documentada de cada API, recortada a lo que se lee:
//   · Google Custom Search JSON API (developers.google.com/custom-search/v1/reference/rest/v1/Search):
//     `items[]` con `title`, `link` y `pagemap.{cse_image,cse_thumbnail,metatags}`; SIN `items` cuando
//     no hay resultados; el fallo en `error.{code,message,errors[].reason,status}`.
//   · Business Discovery de Meta: `{ business_discovery: {...}, id }`; el fallo ADENTRO del cuerpo
//     (`error.code`, `error.error_subcode` 2207013 = «Cannot find User»).
//   · El `og:title` de un perfil se midió el 12/10/2026 bajando una página de perfil de instagram.com:
//     «Instagram (&#064;instagram) &#x2022; Instagram photos and videos», con las ENTIDADES puestas.
// Los nombres son ficticios (AGENTS.md: un ejemplo nunca es la cuenta de un cliente).
//
// PROBADO ROMPIÉNDOLO (12/10/2026), con un arnés que rompe, corre y restaura DE MEMORIA (nunca con
// git checkout) y verifica que cada archivo vuelva idéntico, contra una base en verde de 16 / 0.
// Las 23 roturas cayeron, cada una en el test que la persigue (15 / 1 salvo donde se dice):
//   · lib: sin la lista de secciones reservadas (14 / 2: /explore/ y /reels/ salían como usuarios);
//     URLs de 3 tramos (un post con el usuario adelante); el nombre del título sin cruzarlo con el
//     usuario de la URL; sin `items` como fallo; sin el motivo de cuota; sin el 2207013; sin el
//     motivo de permiso; nombres de 4 palabras a Meta; el mínimo contando espacios y la @; sin tope
//     de resultados; sin decodificar entidades; una foto por http; el dato de Meta ganándole al
//     error; el host comparado con `includes`; la espera en 200 ms.
//   · ruta: las claves de Google con `credWs`; sin pedir la sesión; un cuarto lector de
//     META_PAGE_ACCESS_TOKEN; un fallo de Google guardado en la caché como «no hay».
//   · componente: Enter mandando el formulario; dibujar la respuesta de otro texto; el fetch sin
//     `signal`; el Escape escuchado en `document` (llega después del Modal).
// Restaurado: 16 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ESPERA_MS, MAX_RESULTADOS, MIN_LETRAS, alcanzaParaBuscar, combinarPerfiles, decodificarEntidades,
  leerRespuestaGoogle, leerRespuestaMeta, motivoDeErrorGraph, nombreYUsuarioDeTitulo, normalizarBusqueda, perfilManual,
  urlDePerfil, usuarioDeTexto, usuarioDeUrlInstagram, usuariosCandidatos, type PerfilIg,
} from '../lib/instagram-buscar';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const IMG = 'https://scontent.cdninstagram.com/v/t51.2885-19/ana.jpg?oe=6AD254A7';
const OG = 'https://scontent.cdninstagram.com/v/t51.2885-19/ana-og.jpg?oe=6AD254A7';
const MINI = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:luis';

/** Una respuesta de Google con un perfil y todo lo que NO es un perfil, mezclado. */
const GOOGLE_OK = {
  kind: 'customsearch#search',
  searchInformation: { totalResults: '11' },
  items: [
    { // un perfil: el nombre sale del og:title (entero y con entidades), la foto de cse_image
      title: 'Ana Pérez (@anaperez.ok) • Instagram photos and ...',
      link: 'https://www.instagram.com/anaperez.ok/',
      pagemap: {
        cse_image: [{ src: IMG }],
        metatags: [{ 'og:title': 'Ana Pérez (&#064;anaperez.ok) &#x2022; Instagram photos and videos', 'og:image': OG }],
      },
    },
    { title: 'Ana Pérez en Instagram: "Lanzamos..."', link: 'https://www.instagram.com/p/C1abcDEF/' },          // un post
    { title: 'Reel de Ana', link: 'https://www.instagram.com/reel/C2xyz/' },                                    // un reel
    { title: 'Post con usuario', link: 'https://www.instagram.com/anaperez.ok/p/C1abc/' },                      // un post con el usuario adelante
    { title: '#marketing', link: 'https://www.instagram.com/explore/tags/marketing/' },                         // /explore/
    { title: 'Explorar', link: 'https://www.instagram.com/explore/' },                                          // una sección, no un usuario
    { title: 'Reels', link: 'https://www.instagram.com/reels/' },                                               // ídem
    { // la pestaña de reels del MISMO perfil: es su página, pero ya está
      title: 'Ana Pérez (@anaperez.ok) • Instagram reels',
      link: 'https://www.instagram.com/anaperez.ok/reels/',
    },
    { // título en español, subdominio de país, query, y sólo la miniatura de Google
      title: 'Luis Gómez (@luis_gomez) • Fotos y videos de Instagram',
      link: 'https://ar.instagram.com/luis_gomez/?hl=es',
      pagemap: { cse_thumbnail: [{ src: MINI, width: '225', height: '225' }] },
    },
    { // el título habla de OTRA cuenta que la URL: el nombre no se le pega
      title: 'Otra Cuenta (@otracuenta) • Instagram photos and videos',
      link: 'https://www.instagram.com/tienda.sol/',
      pagemap: { metatags: [{ 'og:image': 'http://inseguro.example/foto.jpg' }] },     // http: no se usa
    },
    { title: '@solo.usuario • Instagram photos and videos', link: 'https://instagram.com/solo.usuario' },     // sin nombre
    { title: 'Ana Pérez | Facebook', link: 'https://www.facebook.com/anaperez' },                               // otro sitio
  ],
};

test('Google: de los resultados quedan sólo los PERFILES, con el nombre que les corresponde', () => {
  const l = leerRespuestaGoogle(200, GOOGLE_OK);
  assert.ok(l.ok, 'una respuesta sana se lee');
  assert.deepEqual(l.perfiles, [
    { usuario: 'anaperez.ok', nombre: 'Ana Pérez', foto: IMG },
    { usuario: 'luis_gomez', nombre: 'Luis Gómez', foto: MINI },
    { usuario: 'tienda.sol', nombre: null, foto: null },
    { usuario: 'solo.usuario', nombre: null, foto: null },
  ]);
});

test('Google: sin `items` es «no hay»; un cuerpo raro es un fallo, nunca una lista vacía', () => {
  assert.deepEqual(leerRespuestaGoogle(200, { kind: 'customsearch#search', searchInformation: { totalResults: '0' } }), { ok: true, perfiles: [] });
  const raro = leerRespuestaGoogle(200, null);
  assert.equal(raro.ok, false);
  const itemsRaros = leerRespuestaGoogle(200, { items: 'nada' });
  assert.equal(itemsRaros.ok, false);
  const http500 = leerRespuestaGoogle(500, { items: [] });
  assert.ok(!http500.ok && http500.motivo === 'error');
});

test('Google: la cuota agotada y la clave sin acceso son motivos distintos', () => {
  const cuota = leerRespuestaGoogle(429, {
    error: { code: 429, message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'", errors: [{ reason: 'rateLimitExceeded' }], status: 'RESOURCE_EXHAUSTED' },
  });
  assert.ok(!cuota.ok && cuota.motivo === 'sin-cuota');
  // Google también manda la cuota por `reason` con otro código.
  const cuota403 = leerRespuestaGoogle(403, { error: { code: 403, message: 'Daily Limit Exceeded', errors: [{ reason: 'dailyLimitExceeded' }] } });
  assert.ok(!cuota403.ok && cuota403.motivo === 'sin-cuota');
  // La API está cerrada a clientes nuevos: un proyecto sin acceso contesta 403 PERMISSION_DENIED.
  const sinAcceso = leerRespuestaGoogle(403, { error: { code: 403, message: 'This project does not have the access to Custom Search JSON API.', status: 'PERMISSION_DENIED' } });
  assert.ok(!sinAcceso.ok && sinAcceso.motivo === 'sin-acceso');
  const claveMala = leerRespuestaGoogle(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', errors: [{ reason: 'badRequest' }], status: 'INVALID_ARGUMENT' } });
  assert.ok(!claveMala.ok && claveMala.motivo === 'sin-acceso');
});

test('una URL de Instagram es un perfil sólo con UN tramo (o la pestaña de un perfil)', () => {
  assert.equal(usuarioDeUrlInstagram('https://www.instagram.com/AnaPerez.OK/'), 'anaperez.ok');
  assert.equal(usuarioDeUrlInstagram('https://instagram.com/anaperez.ok'), 'anaperez.ok');
  assert.equal(usuarioDeUrlInstagram('https://www.instagram.com/anaperez.ok/tagged/'), 'anaperez.ok');
  for (const no of [
    'https://www.instagram.com/',
    'https://www.instagram.com/p/C1abcDEF/',
    'https://www.instagram.com/anaperez.ok/p/C1abc/',
    'https://www.instagram.com/anaperez.ok/reel/C2xyz/',
    'https://www.instagram.com/explore/',
    'https://www.instagram.com/stories/anaperez.ok/3456/',
    'https://www.instagram.com/accounts/login/',
    'https://notinstagram.com/anaperez.ok/',
    'https://www.instagram.com.evil.tld/anaperez.ok/',
    'no es una url',
  ]) assert.equal(usuarioDeUrlInstagram(no), null, no);
});

test('el título de un perfil: nombre y usuario, con o sin nombre, y con entidades', () => {
  assert.deepEqual(nombreYUsuarioDeTitulo('Juan (Johnny) Díaz (@juandiaz) • Instagram photos and videos'), { nombre: 'Juan (Johnny) Díaz', usuario: 'juandiaz' });
  assert.deepEqual(nombreYUsuarioDeTitulo('Instagram (&#064;instagram) &#x2022; Instagram photos and videos'), { nombre: 'Instagram', usuario: 'instagram' });
  assert.deepEqual(nombreYUsuarioDeTitulo('@solo.usuario • Instagram'), { nombre: null, usuario: 'solo.usuario' });
  assert.equal(nombreYUsuarioDeTitulo('Login • Instagram'), null);
  assert.equal(decodificarEntidades('a &amp; b &#064;c &#x2022;'), 'a & b @c •');
});

test('Meta: el perfil sale de business_discovery, y el fallo se mira ANTES que el dato', () => {
  const ok = leerRespuestaMeta(200, {
    business_discovery: { username: 'Tienda.Sol', name: 'Tienda Sol', profile_picture_url: 'https://scontent.xx.fbcdn.net/v/t51.2885-15/sol.jpg', followers_count: 1520, id: '17841400000000001' },
    id: '17841400000000002',
  });
  assert.deepEqual(ok, { ok: true, perfil: { usuario: 'tienda.sol', nombre: 'Tienda Sol', foto: 'https://scontent.xx.fbcdn.net/v/t51.2885-15/sol.jpg' } });

  const sinFoto = leerRespuestaMeta(200, { business_discovery: { username: 'tienda.sol', id: '1' }, id: '2' });
  assert.deepEqual(sinFoto, { ok: true, perfil: { usuario: 'tienda.sol', nombre: null, foto: null } });

  // «Cannot find User»: no existe o es personal. Con 400 y adentro de un 200 (Meta hace las dos).
  const noEsta = { error: { message: 'Invalid user id', type: 'OAuthException', code: 110, error_subcode: 2207013, error_user_title: 'Cannot find User' } };
  for (const status of [400, 200]) {
    const l = leerRespuestaMeta(status, noEsta);
    assert.ok(!l.ok && l.motivo === 'no-esta', `con HTTP ${status}`);
  }
  // Un error junto al dato: gana el error.
  const mezclado = leerRespuestaMeta(200, { ...noEsta, business_discovery: { username: 'tienda.sol' } });
  assert.ok(!mezclado.ok);
});

test('Meta: la conexión que no sirve (token o permiso) es otro motivo que «no está»', () => {
  for (const code of [190, 10, 200, 3]) {
    const l = leerRespuestaMeta(400, { error: { message: 'x', type: 'OAuthException', code } });
    assert.ok(!l.ok && l.motivo === 'sin-permiso', `código ${code}`);
  }
  const otro = leerRespuestaMeta(500, { error: { message: 'An unknown error occurred', code: 1 } });
  assert.ok(!otro.ok && otro.motivo === 'error');
  const sinDato = leerRespuestaMeta(200, { id: '17841400000000002' });
  assert.ok(!sinDato.ok && sinDato.motivo === 'error', 'un 200 sin business_discovery no es «no está»');
});

test('lo escrito: cuándo es un @, cuándo alcanza para buscar, y qué se le pregunta a Meta', () => {
  assert.equal(usuarioDeTexto('@AnaPerez.OK'), 'anaperez.ok');
  assert.equal(usuarioDeTexto('  anaperez_ok  '), 'anaperez_ok');
  assert.equal(usuarioDeTexto('Ana Pérez'), null);
  assert.equal(usuarioDeTexto('martín'), null, 'una tilde no es de un usuario');
  assert.equal(usuarioDeTexto('...'), null);
  assert.equal(usuarioDeTexto('a'.repeat(31)), null);

  assert.equal(MIN_LETRAS >= 3, true);
  assert.equal(alcanzaParaBuscar('ab'), false);
  assert.equal(alcanzaParaBuscar('@ab'), false, 'la @ no es una letra');
  assert.equal(alcanzaParaBuscar(' a b '), false, 'los espacios no son letras');
  assert.equal(alcanzaParaBuscar('ana'), true);

  assert.deepEqual(usuariosCandidatos('@anaperez'), ['anaperez']);
  assert.deepEqual(usuariosCandidatos('Ana Pérez'), ['anaperez', 'ana.perez', 'ana_perez']);
  assert.deepEqual(usuariosCandidatos('Ana María Pérez'), ['anamariaperez', 'ana.maria.perez', 'ana_maria_perez']);
  assert.deepEqual(usuariosCandidatos('Ana María Pérez Gómez'), [], 'cuatro palabras pegadas no son el @ de nadie');
  assert.deepEqual(usuariosCandidatos('Ana!! Pérez'), []);

  assert.equal(normalizarBusqueda('  @Ana   PÉREZ '), 'ana perez');
  assert.deepEqual(perfilManual('@AnaPerez'), { usuario: 'anaperez', nombre: null, foto: null });
  assert.equal(perfilManual('Ana Pérez'), null);
  assert.equal(urlDePerfil('anaperez.ok'), 'https://www.instagram.com/anaperez.ok/');
});

test('combinar: sin repetidos, la primera fuente manda y completa lo que le falta, con tope', () => {
  const meta: PerfilIg[] = [{ usuario: 'tienda.sol', nombre: 'Tienda Sol', foto: null }];
  const google: PerfilIg[] = [
    { usuario: 'tienda.sol', nombre: 'Otro nombre', foto: 'https://x.example/sol.jpg' },
    { usuario: 'luis_gomez', nombre: null, foto: null },
  ];
  assert.deepEqual(combinarPerfiles(meta, google), [
    { usuario: 'tienda.sol', nombre: 'Tienda Sol', foto: 'https://x.example/sol.jpg' },
    { usuario: 'luis_gomez', nombre: null, foto: null },
  ]);
  const muchos = Array.from({ length: 12 }, (_, i) => ({ usuario: `cuenta${i}`, nombre: null, foto: null }));
  assert.equal(combinarPerfiles(muchos).length, MAX_RESULTADOS);
});

// ── La ruta: sesión, claves de la plataforma, la conexión de Meta del negocio ─────────────────────

const RUTA = sinComentarios(leer('app/api/crm/instagram-buscar/route.ts'));

test('la ruta exige sesión ANTES de leer lo que se busca, y no es pública', () => {
  const iSesion = RUTA.indexOf('await getUsuarioActual()');
  const iQ = RUTA.indexOf("searchParams.get('q')");
  assert.ok(iSesion > 0 && iQ > iSesion, 'la sesión se pide antes de leer `q`');
  assert.match(RUTA, /if \(!s \|\| ws == null\) return Response\.json\(\{ ok: false, error: 'No autorizado' \}, \{ status: 401 \}\)/);
  assert.doesNotMatch(leer('lib/rutas-publicas.ts'), /instagram-buscar/);
});

test('las claves de Google son de la PLATAFORMA: credDelCliente sobre wsSuperAdmin, nunca credWs ni el entorno', () => {
  assert.match(RUTA, /const ws = await wsSuperAdmin\(\);\s*\[key, cx\] = await Promise\.all\(\[credDelCliente\('GOOGLE_CSE_KEY', ws\), credDelCliente\('GOOGLE_CSE_CX', ws\)\]\)/);
  assert.doesNotMatch(RUTA, /(credWs|envCred|credWsEstricta)\('GOOGLE_CSE/);
  assert.doesNotMatch(RUTA, /process\.env\.GOOGLE_CSE/);
  // Sin las claves no se rompe: se sigue con Meta.
  assert.match(RUTA, /if \(!key \|\| !cx\) return \{ perfiles: \[\], respondio: false \}/);
});

test('Meta va con la conexión del negocio de la SESIÓN, y sin un cuarto lector del token de página', () => {
  assert.match(RUTA, /credWs\('META_ACCESS_TOKEN', ws\)/);
  assert.match(RUTA, /credWs\('META_PAGE_ID', ws\)/);
  assert.doesNotMatch(RUTA, /META_PAGE_ACCESS_TOKEN/, 'AGENTS.md: código nuevo no agrega un lector de esa fila');
  // El ws sale de la sesión (getWorkspaceActual), nunca de la query.
  assert.doesNotMatch(RUTA, /searchParams\.get\('ws'\)/);
});

test('un FALLO no se guarda en la caché: sólo lo que una fuente CONTESTÓ', () => {
  // Las escrituras de la caché, enumeradas en positivo y en orden. Una nueva (un `[]` guardado en un
  // `catch`, que convertiría «no pude» en «no hay» por diez minutos) hace fallar esto hasta que alguien
  // decida que es una respuesta.
  const escrituras = [...RUTA.matchAll(/(?<!function )guardarCache\(([^;]*)\);/g)].map((m) => m[1].replace(/\s+/g, ' '));
  assert.deepEqual(escrituras, [
    'clave, null',                              // la página del negocio no tiene Instagram (Meta contestó)
    'clave, id',                                // su cuenta de Instagram
    '`mx:${ws}`, true',                         // leerla dio token, permiso o límite: se pausa (revisión 12/10)
    '`m:${ws}:${u}`, lectura.perfil',           // Meta encontró el @ (por NEGOCIO)
    '`m:${ws}:${u}`, null',                     // Meta contestó «no está» (2207013)
    '`mx:${ws}`, true',                         // la conexión no sirve o está limitada: no en cada tecla
    'clave, lectura.perfiles',                  // Google contestó (vacío incluido)
    "'g:sin-cuota', true, TTL_SIN_CUOTA_MS",    // Google sin cuota: no se le pregunta un rato
  ]);
});

// Revisión del 12/10/2026: la caché de Business Discovery era GLOBAL (`m:<usuario>`) y se leía antes
// de mirar si el negocio tiene conexión de Meta: un negocio sin Meta recibía el perfil que otro cliente
// había buscado hacía menos de diez minutos (la prospección de otro inquilino, leída con SU token).
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 18 / 0 de base: la lectura con
// `m:${u}` (sin el ws) → 17 / 1.
test('lo que dijo Meta de un @ se guarda POR NEGOCIO: un negocio nunca lee lo que buscó otro', () => {
  const claves = [...RUTA.matchAll(/(?:leerCache|guardarCache)(?:<[^>(]*>)?\(`(m:[^`]*)`/g)].map((m) => m[1]);
  assert.equal(claves.length, 3, `las lecturas y escrituras de \`m:\`: ${claves.join(' | ')}`);
  for (const c of claves) assert.equal(c, 'm:${ws}:${u}', 'una clave de Meta sin el workspace la comparten todos los negocios');
});

// Revisión del 12/10/2026: con un límite de Meta (4, 17, 32, 613, 80001, 80002) cada tecla volvía a
// llamar a Graph, y con el token vencido también, porque la pausa de `mx:<ws>` sólo se alcanzaba si
// la lectura de la cuenta de Instagram de la página salía bien.
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 18 / 0 de base:
//   · sin `esLimite` (los códigos de límite vuelven a ser `error`)               → 17 / 1
//   · el catch de la cuenta de la página sin pausar `mx:<ws>`                    → 16 / 2 (cae
//     también la lista de escrituras de la caché)
test('un límite de Meta, o la conexión que no sirve al leer la cuenta de la página, pausan la búsqueda en Meta', () => {
  for (const code of [4, 17, 32, 613, 80001, 80002]) {
    const l = leerRespuestaMeta(400, { error: { message: 'x', code } });
    assert.ok(!l.ok && l.motivo === 'limite', `código ${code}`);
    assert.equal(motivoDeErrorGraph({ code }), 'limite', `código ${code}`);
  }
  assert.equal(motivoDeErrorGraph({ code: 190 }), 'sin-permiso');
  assert.equal(motivoDeErrorGraph({ code: 1 }), 'error');
  assert.equal(motivoDeErrorGraph(undefined), 'error');
  // La ruta: el error de la cuenta de la página viaja con su motivo, y el catch pausa con él.
  assert.match(RUTA, /throw Object\.assign\(new Error\([^;]*\), \{ motivo: motivoDeErrorGraph\(j\?\.error\) \}\);/);
  const ini = RUTA.indexOf('ig = token ? await igDelNegocio(ws, token) : null;');
  const atrapa = RUTA.slice(ini, RUTA.indexOf('if (!token || !ig) return encontrados;', ini));
  assert.ok(ini > 0 && atrapa.length < 600, 'no encontré el catch de la cuenta de la página');
  assert.match(atrapa, /if \(motivo === 'sin-permiso' \|\| motivo === 'limite'\) guardarCache\(`mx:\$\{ws\}`, true\);/);
  assert.match(RUTA, /else if \(lectura\.motivo === 'sin-permiso' \|\| lectura\.motivo === 'limite'\) \{/);
});

// ── El componente del alta: el contrato y lo que no se ve ─────────────────────────────────────────

const COMP = sinComentarios(leer('app/crm/new/InstagramBuscador.tsx'));

test('el componente cumple el CONTRATO del alta', () => {
  assert.match(COMP, /^'use client';/);
  assert.match(COMP, /export type \{ PerfilIg \};/);
  // `onTexto` (opcional, revisión del 12/10/2026): el alta recibe lo ESCRITO para no perder un @
  // tipeado y no elegido (`instagramDelAlta`, app/crm/campo-inline.ts). El contrato de antes sigue
  // valiendo tal cual: quien no lo pasa, monta el mismo componente.
  assert.match(COMP, /export function InstagramBuscador\(\{ valor, onElegir, onTexto \}: \{\s*valor: PerfilIg \| null;\s*onElegir: \(p: PerfilIg \| null\) => void;\s*onTexto\?: \(texto: string\) => void;\s*\}\)/);
  // Un solo <input>, sin `name` ni `type="hidden"`: no le suma nada al FormData del alta a escondidas;
  // el padre decide qué guarda (`valor.usuario`).
  const inputs = COMP.match(/<input\b[\s\S]*?\/>/g) ?? [];
  assert.equal(inputs.length, 1);
  assert.doesNotMatch(inputs[0], /\bname=|type="hidden"/);
});

test('espera antes de buscar, cancela lo viejo y tiene tope', () => {
  assert.ok(ESPERA_MS >= 500, `la espera es ${ESPERA_MS} ms`);
  assert.match(COMP, /setTimeout\(async \(\) => \{[\s\S]*?\}, ESPERA_MS\)/);
  assert.match(COMP, /fetch\(`\/api\/crm\/instagram-buscar\?q=\$\{encodeURIComponent\(consulta\)\}`, \{ signal: ctrl\.signal \}\)/);
  assert.match(COMP, /return \(\) => \{ vigente = false; clearTimeout\(espera\); ctrl\.abort\(\); \};/);
  // Una respuesta de otro texto no se dibuja.
  assert.match(COMP, /const actual = resp && resp\.texto === consulta \? resp : null;/);
});

test('Enter no manda el formulario con una búsqueda a medias, y el Escape se ataja antes que el del Modal', () => {
  assert.match(COMP, /\} else if \(e\.key === 'Enter' && consulta\) \{\s*e\.preventDefault\(\);/);
  assert.match(COMP, /window\.addEventListener\('keydown', escape, true\)/);
  // Los botones del campo no son de envío.
  const botones = COMP.match(/<button\b[^>]*>/g) ?? [];
  assert.ok(botones.length > 0 && botones.every((b) => /type="button"/.test(b)), 'todo botón lleva type="button"');
});
