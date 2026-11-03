// =============================================================================
// «Mirar a alguien más»: un campo, las filas que se completan solas y la foto que por fin se ve (3/11/2026)
// =============================================================================
// Martín, 3/11: «No se mejoró ni el modal, sigue horrible el diseño... Y no tiene sentido que tenga 2 tabs».
// Lo que se decide (qué se ofrece, qué se lee) vive en lib/spy-alta-reglas.ts y SE EJECUTA acá. Lo que no se
// puede ejecutar sin un navegador o sin la red se mira por la FORMA DEL USO, no por el nombre.
//
// PROBADO ROMPIÉNDOLO: ver la lista al final del archivo.
// Correr: node --import tsx --test tests/spy-buscador-alta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRIMERAS_QUE_SE_COMPLETAN, RESERVA_DEL_ALTA, coincideCompetidor, cualesCompletar, queSeHace, usuarioDelNombre,
} from '../lib/spy-alta-reglas';
import { esImagenServible, fotoPorNosotros } from '../lib/foto-instagram-reglas';
import { APIFY_TOPE_POR_DIA } from '../lib/instagram-perfil';
import type { PerfilIg } from '../lib/instagram-buscar';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const CDN = 'https://scontent-ber1-1.cdninstagram.com/v/t51.2885-19/487783845_n.jpg?oe=1';
const sinDatos = (usuario: string): PerfilIg => ({ usuario, nombre: null, foto: null });
const conDatos = (usuario: string): PerfilIg => ({ usuario, nombre: 'Alguien', foto: CDN });

// ── Qué se hace con lo escrito ───────────────────────────────────────────────

test('un nombre o un @ se buscan; con menos de 3 letras, nada', () => {
  assert.deepEqual(queSeHace(''), { que: 'nada' });
  assert.deepEqual(queSeHace('   '), { que: 'nada' });
  assert.deepEqual(queSeHace('le'), { que: 'nada' });
  assert.deepEqual(queSeHace('leila'), { que: 'buscar', consulta: 'leila' });
  assert.deepEqual(queSeHace('Leila Hormozi'), { que: 'buscar', consulta: 'Leila Hormozi' });
  assert.deepEqual(queSeHace('@Leila'), { que: 'buscar', consulta: '@leila' });
});

test('el link de su perfil viaja como su @: mandado tal cual, la ruta gastaba una búsqueda por nombre en un enlace', () => {
  assert.deepEqual(queSeHace('https://www.instagram.com/Leila/?igsh=x'), { que: 'buscar', consulta: '@leila' });
  assert.deepEqual(queSeHace('https://www.instagram.com/ab/'), { que: 'nada' }, 'cuenta lo que viaja, no las letras del enlace');
});

test('a quien ya se mira no se lo busca: sale en «Ya los miras» sin gastar nada', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /const buscable = accion\.que === 'buscar' && !\(consulta\.startsWith\('@'\) && ya\.has\(consulta\.slice\(1\)\)\);/);
  assert.match(spy, /useBusquedaInstagram\(consulta, buscable, ronda,/);
  assert.match(spy, /if \(!ya\.has\(p\.usuario\)\) out\.push/);
});

test('UN SOLO CAMINO: YouTube, TikTok y un sitio van por el mismo campo y no gastan una búsqueda de Instagram', () => {
  const yt = queSeHace('https://www.youtube.com/@AlexHormozi');
  assert.equal(yt.que, 'directo');
  assert.equal(yt.que === 'directo' && yt.opcion.campo, 'youtube_id');
  const tt = queSeHace('https://www.tiktok.com/@leila');
  assert.equal(tt.que === 'directo' && tt.opcion.campo, 'tiktok');
  const sitio = queSeHace('https://acme.com/precios');
  assert.equal(sitio.que === 'directo' && sitio.opcion.campo, 'landing_url');
  assert.equal(sitio.que === 'directo' && sitio.tambienUsuario, null, 'con https:// no es el @ de nadie');
});

test('«acme.com» puede ser un sitio o un @: ofrece los dos y no gasta nada', () => {
  const r = queSeHace('acme.com');
  assert.equal(r.que, 'directo');
  assert.equal(r.que === 'directo' && r.opcion.campo, 'landing_url');
  assert.equal(r.que === 'directo' && r.tambienUsuario, 'acme.com');
});

test('un /c/ de YouTube no se puede resolver: se dice, no se adivina', () => {
  assert.deepEqual(queSeHace('https://www.youtube.com/c/alguien'), { que: 'no-reconocido' });
});

// ── Las filas que se completan solas ─────────────────────────────────────────

test('se completan LAS PRIMERAS 5, ni una más', () => {
  const siete = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((u) => sinDatos(`${u}${u}${u}`));
  assert.equal(PRIMERAS_QUE_SE_COMPLETAN, 5);
  assert.deepEqual(cualesCompletar(siete, new Set()), ['aaa', 'bbb', 'ccc', 'ddd', 'eee']);
});

test('lo que ya vino con foto y nombre no gasta una lectura', () => {
  assert.deepEqual(cualesCompletar([conDatos('aaa'), sinDatos('bbb')], new Set()), ['bbb']);
  // Con foto pero sin nombre, o al revés, falta algo: se lee.
  assert.deepEqual(cualesCompletar([{ usuario: 'aaa', nombre: 'A', foto: null }, { usuario: 'bbb', nombre: null, foto: CDN }], new Set()), ['aaa', 'bbb']);
});

test('lo ya pedido no se vuelve a pedir: borrar una letra y escribirla no paga dos veces', () => {
  assert.deepEqual(cualesCompletar([sinDatos('aaa'), sinDatos('bbb')], new Set(['aaa'])), ['bbb']);
  assert.deepEqual(cualesCompletar([sinDatos('aaa')], new Set(['aaa'])), []);
});

test('la fila 6 no se completa aunque las primeras ya estén pedidas: es «las primeras 5», no «5 más»', () => {
  const seis = ['a', 'b', 'c', 'd', 'e', 'f'].map((u) => sinDatos(`${u}${u}${u}`));
  assert.deepEqual(cualesCompletar(seis, new Set(['aaa', 'bbb', 'ccc', 'ddd', 'eee'])), []);
});

test('con un nombre se prueba además su @ pegado, primero, y sin pasarse de 5', () => {
  // Medido: «leila hormozi» trajo cuatro cuentas parecidas y a @leilahormozi no.
  assert.equal(usuarioDelNombre('Leila Hormozi'), 'leilahormozi');
  assert.equal(usuarioDelNombre('Martín Koncke'), 'martinkoncke');
  assert.equal(usuarioDelNombre('leila'), null, 'una palabra ya es un usuario: la ruta lee ese @ sola');
  assert.equal(usuarioDelNombre('@leila'), null);
  const cinco = ['a', 'b', 'c', 'd', 'e'].map((u) => sinDatos(`${u}${u}${u}`));
  assert.deepEqual(cualesCompletar(cinco, new Set(), 'leilahormozi'), ['leilahormozi', 'aaa', 'bbb', 'ccc', 'ddd']);
  // Si la búsqueda ya la trajo, no se pide dos veces.
  assert.deepEqual(cualesCompletar([sinDatos('leilahormozi')], new Set(), 'leilahormozi'), ['leilahormozi']);
});

test('la reserva deja margen real: completar no puede agotar el tope del día', () => {
  assert.ok(RESERVA_DEL_ALTA > 0 && RESERVA_DEL_ALTA < APIFY_TOPE_POR_DIA);
  // Quedan lecturas para varias altas, y alcanza para al menos una tanda entera.
  assert.ok(RESERVA_DEL_ALTA >= 10, 'con menos, un par de altas ya lo agotan');
  assert.ok(APIFY_TOPE_POR_DIA - RESERVA_DEL_ALTA >= PRIMERAS_QUE_SE_COMPLETAN + 1, 'tiene que alcanzar para una búsqueda y sus filas');
});

// ── La barra de arriba ───────────────────────────────────────────────────────

test('la barra encuentra por nombre y por cualquier canal, sin que importen tildes ni @', () => {
  const c = { nombre: 'Sofía Contreras', instagram: 'sofia.contreras', youtube_id: 'UCabc', tiktok: null, landing_url: 'https://www.acme.com/' };
  for (const t of ['sofia', 'SOFÍA', 'contreras', '@sofia.contreras', 'https://instagram.com/sofia.contreras', 'acme.com', 'https://acme.com/precios']) {
    assert.ok(coincideCompetidor(c, t), t);
  }
  for (const t of ['leila', '@leila', 'otro.com']) assert.ok(!coincideCompetidor(c, t), t);
});

test('la barra busca lo que SE VE: una tarjeta titulada con su nombre real, guardada con su @', () => {
  const c = { nombre: '@ahormozi' };
  assert.ok(!coincideCompetidor(c, 'alex'));
  assert.ok(coincideCompetidor(c, 'alex', 'Alex Hormozi'));
});

test('sin nada escrito están todos; con algo que no es comparable, ninguno', () => {
  assert.ok(coincideCompetidor({ nombre: 'Ana' }, ''));
  assert.ok(coincideCompetidor({ nombre: 'Ana' }, '   '));
  assert.ok(!coincideCompetidor({ nombre: 'Ana' }, '—'), 'un texto que se reduce a nada no puede ser comodín');
});

// ── La foto ──────────────────────────────────────────────────────────────────

test('la foto del CDN de Instagram se pide por nuestra ruta; directo el navegador la descarta', () => {
  assert.equal(fotoPorNosotros(CDN), `/api/crm/instagram-foto?url=${encodeURIComponent(CDN)}`);
  assert.match(fotoPorNosotros('https://x.fbcdn.net/a.jpg') as string, /^\/api\/crm\/instagram-foto\?url=/);
  // Lo nuestro carga directo: pasarlo por la ruta la rechazaría, porque ahí sólo entra Meta.
  const bucket = 'https://abc.supabase.co/storage/v1/object/public/avatars/1.jpg';
  assert.equal(fotoPorNosotros(bucket), bucket);
  assert.equal(fotoPorNosotros('/caricaturas/alex.webp'), '/caricaturas/alex.webp');
  assert.equal(fotoPorNosotros(null), null);
  assert.equal(fotoPorNosotros(''), null);
});

test('la ruta de la foto no sirve cualquier cosa', () => {
  for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/jpeg; charset=x']) assert.ok(esImagenServible(t), t);
  for (const t of ['image/svg+xml', 'text/html', 'application/json', '']) assert.ok(!esImagenServible(t), t);
  const r = sinComentarios(leer('app/api/crm/instagram-foto/route.ts'));
  const iSesion = r.indexOf('getUsuarioActual()');
  const iHost = r.indexOf('!esFotoDeInstagram(url)');
  const iFetch = r.indexOf('await fetch(url');
  assert.ok(iSesion > 0 && iHost > iSesion && iFetch > iHost, 'primero la sesión, después el host, y recién ahí se baja');
  assert.match(r, /r\.url && !esFotoDeInstagram\(r\.url\)/, 'una redirección tampoco saca del CDN de Meta');
  assert.match(r, /!esImagenServible\(tipo\)/);
  assert.match(r, /buf\.byteLength > TOPE_BYTES/);
});

test('ninguna pantalla del buscador dibuja la URL del CDN directo', () => {
  const crm = sinComentarios(leer('app/crm/new/InstagramBuscador.tsx'));
  assert.match(crm, /const src = rota \? null : fotoPorNosotros\(perfil\.foto\);/);
  assert.doesNotMatch(crm, /<img src=\{perfil\.foto\}/);
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /<Cara src=\{fotoPorNosotros\(f\.p\.foto\)\}/);
  assert.match(spy, /fotoPorNosotros\(vista\?\.foto\)/);
  assert.doesNotMatch(spy, /src=\{(f\.p\.foto|vista\??\.foto|p\.foto)\}/);
});

// ── El modal ─────────────────────────────────────────────────────────────────

test('sin pestañas, un solo campo y sin ningún «Buscar»', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.equal((spy.match(/<input\b/g) ?? []).length, 1, 'un solo campo');
  assert.doesNotMatch(spy, /spy-pestana|role="tab"/);
  assert.doesNotMatch(spy, />\s*Buscar\s*</);
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.doesNotMatch(app, /function ModalAlta|Pegar un dato|Cargar a mano|spy-modal-pestanas/);
  assert.match(app, /<BuscadorAlta\b/);
});

test('el campo no se ve gris: va sobre la tarjeta, sin fondo y sin borde', () => {
  const spy = leer('app/competitor-spy/BuscadorAlta.tsx');
  const regla = spy.match(/\.spy-finder__in input\{[^}]*\}/)?.[0] ?? '';
  assert.match(regla, /background:none/);
  assert.match(regla, /border:0/);
  assert.doesNotMatch(regla, /surface-2/);
});

test('copiado de la referencia: las medidas del .finder de merrin, con los tokens de MaKo', () => {
  const spy = leer('app/competitor-spy/BuscadorAlta.tsx');
  const caja = spy.match(/\.spy-finder\{[^}]*\}/)?.[0] ?? '';
  assert.match(caja, /top:12vh/);
  assert.match(caja, /width:min\(620px,calc\(100vw - 24px\)\)/);
  assert.match(caja, /border-radius:22px/);
  assert.match(caja, /background:var\(--surface\)/);
  assert.match(spy, /\.spy-finder__in\{[^}]*height:60px/);
  assert.match(spy, /\.spy-finder__lista\{max-height:min\(56vh,460px\)/);
  assert.match(spy, /\[data-tema="oscuro"\] \.spy-velo\{background:rgba\(0,0,0,\.55\)\}/);
  // Sin colores sueltos: el velo es lo único que no es un token, como en la referencia.
  const css = spy.slice(spy.indexOf('const CSS = `'), spy.indexOf('`;', spy.indexOf('const CSS = `')));
  assert.deepEqual(css.match(/#[0-9a-f]{3,8}\b/gi) ?? [], []);
});

test('mientras busca hay filas esqueleto, no un texto', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /const huesos = buscando && \(/);
  assert.match(spy, /Array\.from\(\{ length: 5 \}/);
  assert.match(spy, /spy-hueso spy-hueso--cara/);
});

test('nada entra sin el «sí»: elegir una fila confirma, sólo el botón guarda', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.equal((spy.match(/onAgregar\(/g) ?? []).length, 1);
  const agregar = spy.slice(spy.indexOf('const agregar = () => {'), spy.indexOf('};', spy.indexOf('const agregar = () => {')));
  assert.match(agregar, /!elegido \|\| !vista \|\| ocupado/);
  assert.match(spy, /onClick=\{agregar\}>/);
  const elegir = spy.slice(spy.indexOf('const elegir = (f: Fila) => {'), spy.indexOf('const volver ='));
  assert.doesNotMatch(elegir, /onAgregar/);
});

test('elegir una fila que ya se está leyendo espera esa lectura: pedir otra pagaría dos veces', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /void irAConfirmar\(`@\$\{usuario\}`, c \? vistaDe\(c\) : null, enCamino\.current\.get\(usuario\)\);/);
  const ir = spy.slice(spy.indexOf('const irAConfirmar ='), spy.indexOf('const elegirUsuario ='));
  assert.ok(ir.indexOf('const c = leyendo ? await leyendo : null;') > 0 && ir.indexOf('vistaPreviaAction(pegado)') > ir.indexOf('await leyendo'), 'primero la que está en camino, y recién sin ella se pide otra');
});

test('Enter confirma una sola vez: dejar la tecla apretada no contesta «sí»', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /elegido && e\.key === 'Enter' && !e\.repeat && e\.target === cajaRef\.current/);
});

test('la barra no guarda: sin coincidencias ofrece «Buscarlo y agregarlo», que abre el modal con lo escrito', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.doesNotMatch(app, /pegarArriba/, 'Enter daba de alta sin mostrar quién era');
  assert.match(app, /!!filtro\.trim\(\) && !coinciden\.length && \(/);
  assert.match(app, /onClick=\{\(\) => abrirAlta\(filtro\.trim\(\)\)\}>Buscarlo y agregarlo</);
  assert.match(app, /if \(!coinciden\.length\) abrirAlta\(filtro\.trim\(\)\);/);
  assert.match(app, /<BuscadorAlta\s+textoInicial=\{textoAlta\}/);
});

// ── El tope ──────────────────────────────────────────────────────────────────

test('completar va con reserva, por una ruta y no por una action (las actions hacen fila)', () => {
  const r = sinComentarios(leer('app/api/competitor-spy/perfil/route.ts'));
  assert.match(r, /leerPerfilParaElAlta\(usuario, \{ reserva: RESERVA_DEL_ALTA \}\)/);
  assert.match(r, /getUsuarioActual\(\)[\s\S]*leerPerfilParaElAlta/);
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /fetch\(`\/api\/competitor-spy\/perfil\?usuario=\$\{encodeURIComponent\(u\)\}`, \{ signal: ctrl\.signal \}\)/);
  assert.match(spy, /cualesCompletar\(encontrados, pedidos\.current, delNombre\)/);
  assert.match(spy, /\}, ESPERA_COMPLETAR_MS\);/);
  assert.match(spy, /if \(!encontrados \|\| sinCupo\.current\) return;/, 'al quedarse sin cupo deja de pedir');
});

test('el lector respeta la reserva en las DOS fuentes de Apify, y la reserva no le tapa nada a quien no la tiene', () => {
  const l = sinComentarios(leer('lib/instagram-perfil-server.ts'));
  assert.equal((l.match(/usadas >= APIFY_TOPE_POR_DIA - reserva/g) ?? []).length, 2);
  assert.match(l, /\|\$\{reserva\}\|\$\{claveDeSpy \? 'spy' : ''\}`/, 'con reserva es otra clave de caché');
});

test('un perfil leído no se paga dos veces aunque cambie la lista de fuentes', () => {
  const l = sinComentarios(leer('lib/instagram-perfil-server.ts'));
  assert.doesNotMatch(l.match(/const claveLeido = `[^`]*`/)?.[0] ?? 'falta', /fuentes/);
  assert.match(l, /const leido = cache\.get\(claveLeido\);\s*if \(leido && leido\.hasta > Date\.now\(\)\) return leido\.lectura;/);
  assert.match(l, /if \(l\.ok\) guardarEnCache\(claveLeido,/);
  // La lectura ancha lleva piezas: una angosta no la puede contestar (dibujaría «no publica sus me gusta»).
  assert.match(l.match(/const claveLeido = `[^`]*`/)?.[0] ?? '', /anchas/);
});

test('la vista previa puede leer con la clave de Spy, por el mismo camino que completar', () => {
  const s = sinComentarios(leer('lib/spy.ts'));
  assert.match(s.slice(s.indexOf('export async function leerPerfilParaElAlta')), /fuentes: \['meta-negocio', 'meta-plataforma', 'apify', 'apify-spy'\]/);
  const a = sinComentarios(leer('app/competitor-spy/actions.ts'));
  assert.match(a, /const l = await leerPerfilParaElAlta\(leido\.valor\);/);
  assert.doesNotMatch(a, /leerPerfilInstagram\(/);
});

test('la búsqueda por nombre cuenta en el tope, y sin cupo la pantalla lo dice', () => {
  const r = sinComentarios(leer('app/api/crm/instagram-buscar/route.ts'));
  const iGasta = r.indexOf('if (!gastarBusquedaDeSpy(ws)) return [];');
  assert.ok(iGasta > 0 && r.indexOf('await buscarPerfilesApify(texto, token)') > iGasta, 'se anota ANTES de gastar');
  assert.match(r, /limite: !meta\.perfiles\.length && !google\?\.perfiles\.length && topeDeSpyAgotado\(ws\)/);
  assert.match(sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx')), /Ya no quedan búsquedas por hoy/);
});

// ── El cron ──────────────────────────────────────────────────────────────────

test('la poda tiene su cron, y un fallo no se ve igual que «no había nada»', () => {
  const vercel = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.equal(vercel.crons.filter((c) => c.path === '/api/cron/spy-poda').length, 1);
  const r = sinComentarios(leer('app/api/cron/spy-poda/route.ts'));
  assert.match(r, /const denied = checkCronAuth\(req\);\s*if \(denied\) return denied;\s*const r = await podarLecturasCompartidas\(\);/);
  assert.match(r, /if \(r\.error\) return Response\.json\(\{ ok: false, error: r\.error \}, \{ status: 500 \}\);/);
  const db = sinComentarios(leer('lib/spy-compartido-db.ts'));
  assert.match(db, /if \(error\) return \{ podadas: 0, error: error\.message \};/);
  assert.doesNotMatch(db, /NO HAY CRON/);
});

// PROBADO ROMPIÉNDOLO: ver docs/hallazgos-competitors-spy.md («El modal de Spy»).
