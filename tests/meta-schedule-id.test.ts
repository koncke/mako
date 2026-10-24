// =============================================================================
// El Schedule no se cuenta dos veces: un solo id para el navegador y para el servidor
// =============================================================================
// Martín (24/10/2026): «soluciona esto... Es error de mako». Meta junta el Schedule del navegador con el de CAPI sólo si
// traen el MISMO event_id. El servidor mandaba `schedule:<email>:<inicio>` y el navegador ninguno; y la página de un
// cliente que ya dispara su propio fbq sin id recibía además el de MaKo por CAPI. AGENTS.md, «SI LA PÁGINA YA MANDA UN
// EVENTO DESDE EL NAVEGADOR…»; el diseño, docs/diseno-eventos-meta-por-funnel.md.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { eventIdSchedule, idDeReservaCalendly, repiteScheduleDeLaPagina } from '../lib/meta-capi-payload';
import { eventIdScheduleDelAviso } from '../lib/meta-pixel-mako';
import { uuidDeUri } from '../lib/calendly-error';
import { analizarHtml, analizarLanding, pixelesMetaDe, scheduleDelNavegador } from '../lib/landing-analisis';
import { SCRIPT_DISENO } from '../lib/editor-landing/html-editable';

const raiz = new URL('..', import.meta.url);
const leer = (rel: string) => readFileSync(new URL(rel, raiz), 'utf8');
/** Sin los comentarios de línea entera ni los de bloque: la casa explica en comentarios lo que se sacó. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const URI = 'https://api.calendly.com/scheduled_events/GBGBDCAADAEDCRZ2';
const AVISO = { event: 'calendly.event_scheduled', payload: { event: { uri: URI }, invitee: { uri: `${URI}/invitees/AAAA` } } };

test('el navegador y el servidor arman el MISMO id con la URI del evento', () => {
  const server = eventIdSchedule({ eventoUri: URI, email: 'Ana@X.com', inicioIso: '2026-10-25T15:00:00Z' });
  assert.equal(server, 'schedule:GBGBDCAADAEDCRZ2');
  assert.equal(eventIdScheduleDelAviso(AVISO), server, 'Landing.tsx (hola-mako.com) y el webhook tienen que coincidir');
  assert.ok(!server.includes('@'), 'el id no lleva el email');
  // La tercera cuenta (la del webhook para la clave del aviso) tiene que ser la misma, también con barras finales.
  for (const u of [URI, `${URI}/`, `${URI}//`, ` ${URI} `]) assert.equal(idDeReservaCalendly(u), uuidDeUri(u));
  // Y la del script de las páginas del Web Generator, que es JavaScript suelto: se ejecuta la misma expresión.
  const linea = SCRIPT_DISENO.split('\n').find((l) => l.includes('var id = typeof u === "string"'));
  assert.ok(linea, 'SCRIPT_DISENO tiene que armar el id');
  const armar = new Function('u', `${linea.trim()} return id;`) as (u: unknown) => string;
  for (const u of [URI, `${URI}/`, ` ${URI} `]) assert.equal(armar(u), idDeReservaCalendly(u));
});

test('sin la URI, el navegador NO manda (un evento bien contado vale más que dos)', () => {
  assert.equal(eventIdScheduleDelAviso({ event: 'calendly.event_scheduled' }), null);
  assert.equal(eventIdScheduleDelAviso({ event: 'calendly.event_scheduled', payload: { event: {} } }), null);
  assert.equal(eventIdScheduleDelAviso(null), null);
  const armar = new Function('u', `${SCRIPT_DISENO.split('\n').find((l) => l.includes('var id = typeof u'))!.trim()} return id;`) as (u: unknown) => string;
  assert.equal(armar(undefined), '');
  assert.match(SCRIPT_DISENO, /if \(!id\) return;\s*'?,?\s*'?\s*agendo = true;/, 'sin id, SCRIPT_DISENO sale antes de mandar');
  // El servidor sin URI cae al formato de antes: sólo deduplica sus propios reintentos (el navegador no lo manda).
  assert.equal(eventIdSchedule({ eventoUri: null, email: 'A@x.com', inicioIso: 'T' }), 'schedule:a@x.com:T');
});

test('⚠️ NINGÚN fbq Schedule del repo sale sin eventID', () => {
  // El que pidió el Cerebro: si alguno de los dos (Landing.tsx, SCRIPT_DISENO) o uno nuevo queda sin id, rojo.
  const archivos: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) recorrer(p);
      else if (/\.(ts|tsx|mts)$/.test(n)) archivos.push(p);
    }
  };
  for (const d of ['app', 'lib']) recorrer(join(raiz.pathname.replace(/^\/([A-Za-z]:)/, '$1'), d));
  const sinId: string[] = [];
  let vistos = 0;
  for (const f of archivos) {
    const src = sinComentarios(readFileSync(f, 'utf8'));
    const r = scheduleDelNavegador(src);
    if (r.sinId || r.conId) vistos++;
    if (r.sinId) sinId.push(f);
  }
  assert.ok(vistos >= 2, 'el barrido tiene que ver por lo menos Landing.tsx y SCRIPT_DISENO (si no, no está mirando)');
  assert.deepEqual(sinId, [], 'un fbq Schedule sin eventID cuenta aparte del de CAPI');
});

test('el analizador ve el Schedule de la página: el de Mauricio (sin id), el de ws13 (con id) y las formas raras', () => {
  // El del bundle de Lovable de un cliente, minificado tal cual (24/10/2026).
  const mau = 'const s=l=>{var a;typeof l.data=="object"&&((a=l.data)==null?void 0:a.event)==="calendly.event_scheduled"&&(window.fbq&&(window.fbq("track","Schedule"),window.fbq("track","Lead")),console.log("x"))};';
  assert.deepEqual(scheduleDelNavegador(mau), { sinId: true, conId: false });
  // Con un objeto de parámetros largo y el id al final (la forma de ws13).
  const ws13 = 'window.fbq("track","Schedule",{content_name:"Llamada de diagnóstico con el equipo",value:0,currency:"MXN",status:"ok"},{eventID:`schedule_${uid}`})';
  assert.deepEqual(scheduleDelNavegador(ws13), { sinId: false, conId: true });
  assert.deepEqual(scheduleDelNavegador('window.fbq?.("track","Schedule",{},{eventID:x})'), { sinId: false, conId: true });
  assert.deepEqual(scheduleDelNavegador("e('trackSingle','2410000000000571','Schedule')"), { sinId: true, conId: false });
  // El id de OTRO evento no tapa al Schedule sin id.
  assert.deepEqual(scheduleDelNavegador('fbq("track","Schedule");fbq("track","Purchase",{},{eventID:"p"})'), { sinId: true, conId: false });
  assert.deepEqual(scheduleDelNavegador('fbq("track","Lead")'), { sinId: false, conId: false });
  // Las páginas de MaKo, ya arregladas.
  assert.deepEqual(scheduleDelNavegador(SCRIPT_DISENO), { sinId: false, conId: true });
  assert.deepEqual(pixelesMetaDe("fbq('init', '2410000000000571');fbq('init','2410000000000571')"), ['2410000000000571']);

  const html = `<html><head><script>fbq('init', '2410000000000571');fbq('track','PageView');</script></head><body><div id="root"></div></body></html>`;
  const a = analizarHtml('https://cliente.com', html, mau);
  assert.ok(a.piezas.has('meta-schedule'), 'Schedule sin id en el bundle');
  assert.ok(a.piezas.has('meta-px:2410000000000571'), 'el píxel sale del init inline (que sinRuido borra)');
  assert.ok(!analizarHtml('https://cliente.com', '<html><body>hola</body></html>').piezas.has('meta-schedule'));
});

test('MaKo no repite el Schedule que la página ya manda sin id, al mismo píxel; en la duda de «no sé», manda', () => {
  assert.equal(repiteScheduleDeLaPagina(null, 'P1'), false, 'sin análisis: MaKo manda como siempre');
  assert.equal(repiteScheduleDeLaPagina(['embed-agenda'], 'P1'), false);
  assert.equal(repiteScheduleDeLaPagina(['meta-schedule-id', 'meta-px:P1'], 'P1'), false, 'con id: MaKo manda con el mismo');
  assert.equal(repiteScheduleDeLaPagina(['meta-schedule', 'meta-px:P1'], 'P1'), true);
  assert.equal(repiteScheduleDeLaPagina(['meta-schedule', 'meta-px:OTRO'], 'P1'), false, 'a otro píxel no se duplica');
  assert.equal(repiteScheduleDeLaPagina(['meta-schedule'], 'P1'), true, 'sin saber a qué píxel: se asume el mismo');
  assert.equal(repiteScheduleDeLaPagina(['meta-schedule', 'meta-px:P1'], null), true);
});

test('CABLEADO: el webhook arma el id compartido y pregunta antes de mandar', () => {
  const ruta = sinComentarios(leer('app/api/webhooks/calendly/route.ts'));
  assert.doesNotMatch(ruta, /eventId: `schedule:\$\{email/, 'volvió el id que el navegador no puede armar');
  assert.match(ruta, /eventId: eventIdSchedule\(\{ eventoUri: payload\.scheduled_event\?\.uri/);
  const pregunta = ruta.indexOf('repiteScheduleDeLaPagina(');
  const manda = ruta.indexOf("eventName: 'Schedule'");
  assert.ok(pregunta > 0 && manda > pregunta, 'la pregunta va ANTES del envío');
  assert.match(ruta, /yaLoMandaLaPagina \? null : await sendMetaCAPIEvent/);
  const landing = sinComentarios(leer('app/vsl/Landing.tsx'));
  assert.match(landing, /if \(!eventID\) return;\s*agendo = true;\s*window\.fbq\?\.\('track', 'Schedule', \{\}, \{ eventID \}\)/);
});

test('un host que da 403 al UA «compatible» se lee con el de bot honesto, y sus scripts también', async () => {
  // Medido el 24/10/2026: el hosting del Sprint de un cliente da 403 a «Mozilla/5.0 (compatible; MaKoPixel/1.0; …)» y
  // 200 a «MaKoPixel/1.0 (+…)». Sin el reintento, sus tres análisis terminaron en «no deja que MaKo la lea sola».
  const pedidos: string[] = [];
  const html = '<html><head><script src="/assets/app.js"></script></head><body><a href="https://buy.stripe.com/x">Pagar</a></body></html>';
  const bundle = 'window.fbq("track","Schedule")';
  const buscador = async (url: string, init?: RequestInit) => {
    const ua = String((init?.headers as Record<string, string> | undefined)?.['User-Agent'] ?? '');
    pedidos.push(`${url.endsWith('.js') ? 'js' : 'html'}:${ua.startsWith('Mozilla') ? 'compatible' : 'bot'}`);
    if (ua.startsWith('Mozilla')) return new Response('bloqueado', { status: 403 });
    return new Response(url.endsWith('.js') ? bundle : html, { status: 200 });
  };
  const a = await analizarLanding('https://sitio-con-waf.com/', buscador);
  assert.equal(a.ok, true, a.error ?? '');
  assert.ok(a.piezas.has('botones'));
  assert.ok(a.piezas.has('meta-schedule'), 'el bundle también se baja con el reintento');
  assert.deepEqual(pedidos, ['html:compatible', 'html:bot', 'js:compatible', 'js:bot']);
});

test('CABLEADO: el lector común (Offer, Diagnóstico, Replicar) reintenta un 403 con el UA de bot honesto', () => {
  // Martín lo vio en Offer y en el Diagnóstico (24/10/2026): «La página respondió 403: está bloqueando la lectura
  // automática». Es el mismo WAF que bloqueaba al analizador del Pixel.
  const src = sinComentarios(leer('lib/landing-fetch.ts'));
  assert.match(src, /const UA_BOT = 'MaKoLandingAnalyst\/1\.0 \(\+https:\/\/hola-mako\.com\)';/);
  assert.match(src, /let res = await pedirPagina\(check\.url, check\.ips\);\s*if \(res\.status === 403\) res = await pedirPagina\(check\.url, check\.ips, UA_BOT\);/);
  assert.match(src, /headers: \{ 'user-agent': ua,/, 'el pedido usa el UA que le pasan, no el fijo');
});
