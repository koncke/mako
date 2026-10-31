// =============================================================================
// Lo que se GUARDA de una URL de entrada sale de una lista BLANCA (30/10/2026, P6)
// =============================================================================
// El corte del 24/10/2026 saca de `landing_url` los parámetros cuyo NOMBRE está en una lista de datos
// personales. Medido el 30/10/2026 contra producción, con ese corte ya desplegado: `vsl_events.landing_url`
// seguía guardando el nombre de quien agendó, porque Cal.com lo manda en `attendeeName=` y ese nombre no
// estaba en la lista — 38 filas de P2P Consulting, con `user=`, `uid=`, `title=`, `description=`,
// `location=` y `metadata[lead_id]=` al lado. Una lista negra se queda corta en cuanto el proveedor de
// agendas agrega un parámetro, y se queda corta en silencio.
//
// La regla que queda: de la query de una URL de entrada se guarda SÓLO lo nombrado en
// `PARAMS_QUE_SE_GUARDAN` (lib/url-datos-personales.ts), y la migración 0357 limpia lo ya guardado con esa
// MISMA lista — este archivo compara las dos, porque dos copias de una lista divergen, la única pregunta es
// cuándo.
//
// Correr: node --import tsx --test tests/url-de-entrada-lista-blanca.test.ts
// ⚠️ Con `node --test` pelado los imports sin extensión fallan con un ERR_MODULE_NOT_FOUND falso.
//
// PROBADO ROMPIÉNDOLO (a mano, restaurado, con la base en verde: 8 pasan / 0 fallan):
//   · `urlDeEntradaGuardable` → `urlSinDatosPersonales` en las tres rutas .............. 7 / 1
//   · `paramSeGuarda` devolviendo `!esParametroPersonal(k, v)` (volver a la lista negra)  5 / 3
//   · sacar `'attendeename'` de la lista de nombres personales ......................... 7 / 1
//   · sacar `'utm_source'` de `PARAMS_QUE_SE_GUARDAN` .................................. 5 / 3
//   · sacar `'mko_test'` del array de la migración 0357 ................................ 7 / 1
//   · `if (EMAIL.test(k) || EMAIL.test(v)) return false;` fuera de `paramSeGuarda` ..... 7 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PARAMS_QUE_SE_GUARDAN, paramSeGuarda, urlDeEntradaGuardable, urlSinDatosPersonales,
} from '../lib/url-datos-personales';

const RAIZ = join(import.meta.dirname, '..');
/** ⚠️ Se normaliza el CRLF: en el clon de Windows los fuentes llegan con `\r\n` y los regex de abajo esperan `\n`. */
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const MIGRACION = 'supabase/migrations/0357_urls_sin_datos_personales.sql';

test('1 · lo que se guarda vuelve BYTE POR BYTE; lo que no está en la lista se va', () => {
  // Una URL sin query, o con sólo parámetros de la lista, es la identidad: nada que compare URLs cambia.
  for (const u of [
    'https://su-landing.com/oferta',
    'https://su-landing.com/oferta?utm_source=fb&utm_medium=paid&utm_campaign=oct&utm_id=120212345678901',
    'https://su-landing.com/oferta?fbclid=IwVERTSASSua&gclid=abc&mko_test=mapa-7',
    'https://su-landing.com/oferta?v=2&variante=b',
    '/gracias?vsl=3',
    'https://su-landing.com/oferta#precios',
  ]) assert.equal(urlDeEntradaGuardable(u), u, u);

  // Y lo que no está nombrado se va, sin importar si parece de alguien.
  assert.equal(urlDeEntradaGuardable('https://x.com/gracias?name=Ana+P%C3%A9rez&email=ana%40x.com&utm_source=fb'),
    'https://x.com/gracias?utm_source=fb');
  assert.equal(urlDeEntradaGuardable('https://x.com/gracias?plan=pro&page_id=245'), 'https://x.com/gracias',
    'un parámetro que no es de medición no se guarda, aunque no sea de nadie: es la lista BLANCA');
  assert.equal(urlDeEntradaGuardable('https://x.com/gracias?name=Ana'), 'https://x.com/gracias',
    'sin nada que quede, sin «?»');
});

test('2 · el caso que la lista negra dejaba pasar: la página de éxito de Cal.com', () => {
  // Medido el 30/10/2026 en P2P Consulting (38 filas de `vsl_events.landing_url`), con el corte del 24/10 puesto.
  const calcom = 'https://p2plandingnutricion.vercel.app/?attendeeName=Ana+P%C3%A9rez&email=ana%40x.com'
    + '&attendeeStartTime=2026-10-20T18%3A00%3A00Z&description=Consulta&endTime=2026-10-20T18%3A30%3A00Z'
    + '&eventTypeSlug=nutricion&hostName=Pablo&isSuccessBookingPage=true&location=integrations%3Agoogle%3Ameet'
    + '&metadata%5Blead_id%5D=4821&startTime=2026-10-20T18%3A00%3A00Z&title=Consulta&type=nutricion&uid=abc123&user=pablo';
  assert.equal(urlDeEntradaGuardable(calcom), 'https://p2plandingnutricion.vercel.app/');

  // La lista negra lo dejaba pasar: `attendeeName` no era ninguno de sus nombres. Es el porqué de este archivo.
  assert.equal(paramSeGuarda('attendeeName', 'Ana Pérez'), false);
  assert.equal(paramSeGuarda('metadata[lead_id]', '4821'), false, 'un id de lead apunta a una persona');
  assert.equal(paramSeGuarda('user', 'pablo'), false);
  assert.equal(paramSeGuarda('uid', 'abc123'), false);
});

test('3 · lo que apunta a UNA persona no se guarda aunque sea opaco', () => {
  // El token de lead del link de WhatsApp (`?l=`) identifica a un lead concreto. El beacon lo lee del
  // `location.search` y lo manda en el payload (`payload.l`), así que no hace falta en la URL guardada.
  assert.equal(urlDeEntradaGuardable('https://x.com/oferta?l=mko_tok_abc&utm_source=wa'), 'https://x.com/oferta?utm_source=wa');
  assert.equal(paramSeGuarda('l', 'mko_tok_abc'), false);
  // Mailchimp: `mc_cid` es la campaña (se guarda) y `mc_eid` es el id del SUSCRIPTOR (no).
  assert.equal(paramSeGuarda('mc_cid', 'abc'), true);
  assert.equal(paramSeGuarda('mc_eid', 'f1a2b3'), false);
  // El `session_id` de un cobro apunta a una compra, o sea a alguien.
  assert.equal(paramSeGuarda('session_id', 'cs_live_abc'), false);
});

test('4 · estar en la lista autoriza el NOMBRE, no cualquier contenido', () => {
  // `utm_content=<email>` pasa de verdad en las campañas de mail: el nombre está en la lista y el valor no se guarda.
  assert.equal(paramSeGuarda('utm_content', 'ana@x.com'), false);
  assert.equal(paramSeGuarda('utm_content', 'ana%40x.com'), false, 'codificado una vez');
  assert.equal(paramSeGuarda('utm_content', 'ana%2540x.com'), false, 'y dos');
  assert.equal(urlDeEntradaGuardable('/g?utm_source=mail&utm_content=ana%40x.com'), '/g?utm_source=mail');
  assert.equal(paramSeGuarda('utm_content', 'banner-azul'), true);
});

test('5 · el `#…` y una URL adentro de un parámetro pasan por la misma lista', () => {
  assert.equal(urlDeEntradaGuardable('https://x.com/g#email=a@b.co&utm_source=fb'), 'https://x.com/g#utm_source=fb');
  assert.equal(urlDeEntradaGuardable('https://x.com/g#/gracias?attendeeName=Ana&v=1'), 'https://x.com/g#/gracias?v=1');
  // Un `?` repetido y una URL codificada adentro de un valor: los dos esconden la query de URLSearchParams.
  assert.equal(urlDeEntradaGuardable('/gracias?utm_source=fb?name=Ana+Perez&email=ana@x.com'), '/gracias?utm_source=fb');
});

test('6 · las DOS reglas siguen separadas: la identidad de una página no usa la lista blanca', () => {
  // `urlSinDatosPersonales` contesta «¿qué página es ésta?» y «¿a dónde fue este clic?»: ahí un `?plan=pro`
  // informa y tiene que quedar. Fundirlas cambiaría las llaves guardadas de `landing.paginas`.
  assert.equal(urlSinDatosPersonales('https://x.com/oferta?plan=pro'), 'https://x.com/oferta?plan=pro');
  assert.equal(urlDeEntradaGuardable('https://x.com/oferta?plan=pro'), 'https://x.com/oferta');
  // Y la lista negra ya no deja pasar el nombre de quien agendó (vale para `normalizarUrl` y para `detalle`).
  assert.equal(urlSinDatosPersonales('https://x.com/g?attendeeName=Ana+Perez&plan=pro'), 'https://x.com/g?plan=pro');
});

test('7 · las tres rutas del Pixel guardan con la lista blanca', () => {
  const vsl = sinComentarios(leer('app/api/track/vsl/route.ts'));
  assert.match(vsl, /const urlGuardable = \(v: unknown\): string \| null => texto\(typeof v === 'string' \? urlDeEntradaGuardable\(v\) : v, 500\);/,
    'el choke point de la ruta vsl tiene que usar la lista blanca');
  // `landing_url` de `vsl_events` (2 inserts) y de la visita (1), más la página que se busca en /gracias.
  assert.equal((vsl.match(/urlGuardable\(payload\.landing_url\)/g) ?? []).length, 3);
  assert.match(vsl, /referrer: urlGuardable\(payload\.referrer\),/);
  const replay = sinComentarios(leer('app/api/track/replay/route.ts'));
  assert.match(replay, /landingUrl: texto\(typeof payload\.landing_url === 'string' \? urlDeEntradaGuardable\(payload\.landing_url\) : payload\.landing_url, 500\),/);
  const optin = sinComentarios(leer('app/api/track/optin/route.ts'));
  assert.match(optin, /landing_url: txt\(typeof body\.pagina === 'string' \? urlDeEntradaGuardable\(body\.pagina\) : body\.pagina\),/);
  // Y ninguna de las tres vuelve a guardar la URL de entrada cruda en una columna de analítica.
  for (const [nombre, src] of [['vsl', vsl], ['replay', replay]] as const) {
    assert.doesNotMatch(src, /(landing_url|landingUrl): texto\(payload\.(landing_url|referrer), 500\)/,
      `${nombre}: una escritura volvió a ir cruda`);
  }
  assert.doesNotMatch(optin, /landing_url: txt\(body\.pagina\)/, 'optin: una escritura volvió a ir cruda');
  // La página que viaja en la PROPUESTA es otra pregunta («¿de dónde vino?», la lee una persona) y va por la
  // lista negra; lo que no puede es ir cruda. Medido el 30/10/2026: 0 de 24 propuestas de lead traían datos.
  assert.match(optin, /pagina: urlSinDatosPersonales\(txt\(body\.pagina\)/);
});

test('8 · la migración 0357 limpia con la MISMA lista, y sólo MODIFICA la columna', () => {
  const sql = leer(MIGRACION);
  const cuerpo = sql.replace(/^--.*$/gm, '');

  // La lista de la migración, leída del array de SQL, tiene que ser exactamente la del módulo.
  const m = /parametros_que_se_guardan text\[\] := array\[([\s\S]*?)\];/.exec(cuerpo);
  assert.ok(m, 'la migración tiene que declarar `parametros_que_se_guardan`');
  const deLaMigracion = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual([...deLaMigracion].sort(), [...PARAMS_QUE_SE_GUARDAN].sort(),
    'la lista blanca de la migración se separó de PARAMS_QUE_SE_GUARDAN');

  // Las cuatro columnas que guardan una URL de entrada, y ninguna más.
  for (const par of ["('vsl_events', 'landing_url')", "('landing_visits', 'landing_url')",
    "('landing_visits', 'referrer')", "('replay_sesiones', 'landing_url')"]) {
    assert.ok(cuerpo.includes(par), `la migración no limpia ${par}`);
  }

  // ⚠️ SÓLO MODIFICA: una migración que limpia datos no puede borrar filas ni tocar el esquema.
  for (const prohibido of [/\bdelete\s+from\b/i, /\btruncate\b/i, /\bdrop\s+(table|column|view)\b/i, /\balter\s+table\b/i]) {
    assert.doesNotMatch(cuerpo, prohibido, `la migración 0357 no puede ${prohibido}`);
  }
  assert.match(cuerpo, /update public\.%2\$I x\s*\n\s*set %1\$I = a\.despues/, 'lo único que escribe es la columna');

  // Y no se da por hecha una limpieza a medias: si queda una fila, tira (y el .sql se aplica en una transacción).
  assert.match(cuerpo, /raise exception '0357: %\.% quedó con % filas con datos personales/);
});
