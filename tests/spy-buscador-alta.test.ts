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
import { RESERVA_DEL_ALTA, coincideCompetidor } from '../lib/spy-alta-reglas';
import { PRIMERAS_QUE_SE_COMPLETAN } from '../lib/spy-buscar-reglas';
import { esImagenServible, fotoPorNosotros } from '../lib/foto-instagram-reglas';
import { TOPE_LECTURAS_SPY_POR_DIA } from '../lib/instagram-perfil';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const CDN = 'https://scontent-ber1-1.cdninstagram.com/v/t51.2885-19/487783845_n.jpg?oe=1';

// ⚠️ 4/11/2026: qué se busca con lo escrito, las filas que se completan y el orden se mudaron a
// lib/spy-buscar-reglas.ts, y se EJECUTAN en tests/spy-buscar.test.ts. Acá queda lo que no cambió.

test('la reserva deja margen real: completar no puede agotar el cupo del día', () => {
  assert.ok(RESERVA_DEL_ALTA > 0 && RESERVA_DEL_ALTA < TOPE_LECTURAS_SPY_POR_DIA);
  assert.ok(RESERVA_DEL_ALTA >= 10, 'con menos, un par de altas ya lo agotan');
  assert.ok(TOPE_LECTURAS_SPY_POR_DIA - RESERVA_DEL_ALTA >= PRIMERAS_QUE_SE_COMPLETAN * 10, 'tiene que alcanzar para varias búsquedas con sus filas');
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
  assert.match(spy, /<Cara src=\{fotoPorNosotros\(p\.foto\)\}/);
  assert.match(spy, /fotoPorNosotros\(vista\?\.foto\)/);
  assert.doesNotMatch(spy, /src=\{(f\.p\.foto|f\.perfil\.foto|vista\??\.foto|p\.foto)\}/);
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
  // Un grupo con algo en camino dibuja sus huesos (3 si todavía no tiene filas, 1 debajo de las que ya llegaron).
  assert.match(spy, /const huesos = \(n: number, red: 'instagram' \| 'youtube'\) => Array\.from\(\{ length: n \}/);
  assert.match(spy, /\{g\.cargando && huesos\(deEste\.length \? 1 : 3,/);
  assert.match(spy, /spy-hueso spy-hueso--cara/);
});

test('nada entra sin el «sí»: elegir una fila confirma, sólo el botón guarda', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.equal((spy.match(/onAgregar\(/g) ?? []).length, 1);
  const agregar = spy.slice(spy.indexOf('const agregar = () => {'), spy.indexOf('};', spy.indexOf('const agregar = () => {')));
  assert.match(agregar, /!elegido \|\| !vista \|\| ocupado/);
  assert.match(spy, /onClick=\{agregar\}>/);
  const elegir = spy.slice(spy.indexOf('const elegir = (f: FilaBusqueda) => {'), spy.indexOf('const volver ='));
  assert.doesNotMatch(elegir, /onAgregar/);
});

test('elegir una fila que ya se está completando espera esa corrida: pedir otra pagaría dos veces', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  const elegir = spy.slice(spy.indexOf('const elegirPerfil ='), spy.indexOf('const elegir = (f: FilaBusqueda)'));
  const iEspera = elegir.indexOf('await completando.current.get(p.usuario);');
  const iLee = elegir.indexOf("fuente=ig&u=");
  assert.ok(iEspera > 0 && iLee > iEspera, 'primero la corrida que está en camino, y recién después se lee ese @');
});

test('Enter confirma una sola vez: dejar la tecla apretada no contesta «sí»', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /elegido && e\.key === 'Enter' && !e\.repeat && e\.target === cajaRef\.current/);
});

test('la barra de arriba ABRE el buscador, igual que el «+»: ya no filtra en silencio', () => {
  // Martín, 4/11: «La barra principal de búsqueda debería funcionar igual que cuando le doy al "+"... No hace nada».
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const barra = app.slice(app.indexOf('<div className="spy-barra">'), app.indexOf('className="spy-mas"'));
  assert.doesNotMatch(barra, /<input\b/, 'la barra no es un campo propio: es el que abre el buscador');
  assert.match(barra, /<button type="button" className="spy-campo"[^>]*onClick=\{\(\) => abrirAlta\(\)\}/);
  assert.doesNotMatch(app, /no está en tu lista|Buscarlo y agregarlo/, 'el cartel de «no está» con otro botón se fue');
  assert.match(app, /<BuscadorAlta\s+textoInicial=\{textoAlta\}/);
});

// ── El tope ──────────────────────────────────────────────────────────────────

test('completar va con reserva, en UNA corrida, por una ruta y no por una action (las actions hacen fila)', () => {
  const r = sinComentarios(leer('app/api/competitor-spy/buscar/route.ts'));
  assert.match(r, /completarPerfiles\(ws, usuarios, RESERVA_DEL_ALTA\)/);
  assert.ok(r.indexOf('getUsuarioActual()') > 0 && r.indexOf('getUsuarioActual()') < r.indexOf('fuente ==='), 'primero la sesión, después lo que se pide');
  assert.match(r, /\.slice\(0, PRIMERAS_QUE_SE_COMPLETAN\)/, 'el cupo no se gasta por un pedido armado a mano');
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(spy, /fetch\(`\/api\/competitor-spy\/buscar\?fuente=completar&u=\$\{encodeURIComponent\(faltan\.join\(','\)\)\}`/);
  assert.match(spy, /\}, ESPERA_COMPLETAR_MS\);/);
  assert.match(spy, /if \(busqueda\.sinCupo\) return;/, 'al quedarse sin cupo deja de pedir');
  const l = sinComentarios(leer('lib/instagram-perfil-server.ts'));
  const lote = l.slice(l.indexOf('export async function leerPerfilesEnLote'));
  assert.match(lote, /body: JSON\.stringify\(\{ usernames: lote \}\)/, 'una corrida para todas las filas');
  assert.match(lote, /TOPE_LECTURAS_SPY_POR_DIA - \(opts\.reserva \?\? 0\) - usadas/);
});

test('el lector respeta la reserva en las DOS fuentes de Apify, y la reserva no le tapa nada a quien no la tiene', () => {
  const l = sinComentarios(leer('lib/instagram-perfil-server.ts'));
  assert.equal((l.match(/usadas >= APIFY_TOPE_POR_DIA - reserva/g) ?? []).length, 1, 'la de la plataforma');
  assert.equal((l.match(/usadas >= TOPE_LECTURAS_SPY_POR_DIA - reserva/g) ?? []).length, 1, 'la clave de Spy, con su propio cupo');
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

test('el @ exacto lee con la clave de Spy PRIMERO: las esperas de Meta casi nunca traían nada', () => {
  const b = sinComentarios(leer('lib/spy-buscar.ts'));
  assert.match(b, /fuentes: conClave \? \['apify-spy', 'meta-negocio'\] : \['meta-negocio', 'meta-plataforma'\]/);
  assert.doesNotMatch(sinComentarios(leer('app/competitor-spy/actions.ts')), /leerPerfilInstagram\(/);
});

test('cada búsqueda por nombre cuenta en el cupo ANTES de gastar, y sin cupo la pantalla lo dice', () => {
  const r = sinComentarios(leer('app/api/crm/instagram-buscar/route.ts'));
  const iGasta = r.indexOf('if (!gastarBusquedaDeSpy(ws)) return [];');
  assert.ok(iGasta > 0 && r.indexOf('await buscarPerfilesApify(texto, token)') > iGasta, 'el CRM se anota ANTES de gastar');
  const b = sinComentarios(leer('lib/spy-buscar.ts'));
  // 5/11/2026: la búsqueda de Instagram pide con la primera clave de Spy con crédito (`pedirBusquedaApify`, varias claves).
  for (const [quien, gasta] of [['buscarEnGoogle', 'fetch(`https://api.apify.com'], ['buscarEnInstagram', 'pedirBusquedaApify(nombre, token)']] as const) {
    const cuerpo = b.slice(b.indexOf(`export async function ${quien}`));
    const iCupo = cuerpo.indexOf('if (!gastarBusquedaDeSpy(ws))');
    assert.ok(iCupo > 0 && cuerpo.indexOf(gasta) > iCupo, `${quien} se anota antes de gastar`);
  }
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

// «Escribí tal cual @herasmedia y no me trajo al perfil» (Martín, 4/11/2026; el Cerebro lo midió en el código): la fila «Usar @x»
// confirmaba sin leer, y salía una letra «H». Va por `elegirPerfil`, que lee con `/api/competitor-spy/buscar?fuente=ig`.
// Verificado rompiéndolo: con la línea de antes (`irAConfirmar(...)` sin leer) este test cae.
test('«Usar @x tal como lo escribiste» lee su perfil, igual que un perfil hallado', () => {
  const spy = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  const elegir = spy.slice(spy.indexOf('const elegir = (f: FilaBusqueda) => {'), spy.indexOf('const volver ='));
  const usar = elegir.split('\n').find((l) => l.includes("f.tipo === 'usar'")) ?? '';
  assert.match(usar, /elegirPerfil\(\{ usuario: f\.usuario/, 'la fila «Usar @x» va por el camino que lee el perfil');
  assert.doesNotMatch(usar, /irAConfirmar/, 'confirmar sin leer deja la tarjeta sin foto ni seguidores');
});
