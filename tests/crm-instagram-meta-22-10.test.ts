// =============================================================================
// El Instagram de un lead, con «Conectar Meta» ahí mismo y el buscador también en la ficha (22/10/2026)
// =============================================================================
// Martín, 22/10/2026 (punto 2), textual: «La búsqueda de Instagram: no funciona porque tengo que conectar Meta. No
// entiendo eso». Dos cosas:
//   a) en «Nuevo lead», sin Meta conectado, el campo dejaba escribir el @ a ciegas y recién la lista, después de buscar,
//      decía «Conecta Meta» sin un botón. Ahora el buscador pregunta UNA vez, al enfocar el campo, `?estado=1` (la
//      ruta: token + cuenta de Instagram de la página, sin buscar a nadie); sin conexión, debajo del campo va
//      `AVISO_SIN_META` y «Conectar Meta» (el modal de la casa, sin salir de la tab), y la fila de la lista sin
//      resultados lleva el mismo botón. Al conectar, pregunta otra vez sin la caché y vuelve a buscar;
//   b) en la ficha del lead el Instagram era un texto plano (`EditableInline`): ahora es el MISMO buscador
//      (`InstagramEditable` monta `InstagramBuscador` con `enLaFicha`), y qué se guarda lo decide `instagramDeLaFicha`.
// Lo puro de lib y de campo-inline se EJECUTA; la ruta y los componentes se leen como fuente.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · `pideConectarMeta` también con 'sin-permiso'                                            → 7 / 1
//   · `esConexionMeta` que acepta 'encontro' (un estado de la BÚSQUEDA, no de la conexión)     → 7 / 1
//   · la frase de la fila de vuelta a «Conecta Meta para ver su cuenta» (repite el botón)       → 7 / 1
//   · `instagramDeLaFicha` que reescribe el mismo @ (sin el 'nada')                             → 7 / 1
//   · la ruta sin la rama `?estado=1`                                                           → 7 / 1
//   · `conexionDeMeta` que busca perfiles (`buscarEnMeta`) para contestar                       → 7 / 1
//   · `fresco` sin olvidar la cuenta de la página (`ig:<ws>`)                                    → 7 / 1
// Y el tope de `fresco` (23/10/2026, revisión de Integración), con el archivo en 10 / 0:
//   · `tocaRefrescar` sin la espera de 10 minutos                                                → 9 / 1
//   · `tocaRefrescar` sin el tope del día                                                        → 9 / 1
//   · `tocaRefrescar` que no reinicia la cuenta al otro día                                      → 9 / 1
//   · `clavesQueOlvida` que borra también la pausa de un límite de Meta                          → 9 / 1
//   · `conexionDeMeta` que olvida la caché a mano, sin pasar por `refrescar`                      → 9 / 1
//   · `refrescar` que no anota (el tope nunca se alcanza)                                         → 9 / 1
//   · un segundo lugar de la pantalla que pide `fresco` (fuera de «Conectar Meta»)               → 8 / 2
//   · el campo que no pregunta al enfocarse                                                     → 7 / 1
//   · sin la línea de debajo del campo                                                          → 7 / 1
//   · la fila de la lista sin el botón                                                          → 7 / 1
//   · el blur que confirma aunque el foco se lo haya llevado «Conectar Meta»                    → 7 / 1
//   · el botón sin `onMouseDown` que retiene el foco                                            → 7 / 1
//   · `onConectado` sin volver a preguntar con `fresco`                                         → 7 / 1
//   · el buscador de la ficha buscando el @ con el que abre (sin `tocado`)                       → 7 / 1
//   · Enter con el campo vacío que no confirma en la ficha (no se puede borrar con Enter)        → 7 / 1
//   · el Escape de la ficha sin cancelar                                                        → 7 / 1
//   · `InstagramEditable` de vuelta a `EditableInline`                                          → 7 / 1
//   · `InstagramEditable` sin la guarda de UNA salida por apertura                              → 7 / 1
// Correr: node --import tsx --test tests/crm-instagram-meta-22-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  AVISO_SIN_META, FRESCO_CADA_MS, FRESCO_POR_DIA, avisoSinResultados, clavesQueOlvida, esConexionMeta, pideConectarMeta, tocaRefrescar,
  type AnotadoFresco,
} from '../lib/instagram-buscar';
import { instagramDeLaFicha } from '../app/crm/campo-inline';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de primer nivel: desde su firma hasta la próxima de primer nivel. */
const cuerpo = (src: string, firma: string) => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(?:export )?(?:async )?function |\n\/\/ ── /);
  return fin < 0 ? src.slice(i) : src.slice(i, i + firma.length + fin);
};

const RUTA = sinComentarios(leer('app/api/crm/instagram-buscar/route.ts'));
const COMP = sinComentarios(leer('app/crm/new/InstagramBuscador.tsx'));
const EDIT = sinComentarios(leer('app/crm/lead-view/CampoEditable.tsx'));

// ── lib ──────────────────────────────────────────────────────────────────────

test('lib: el estado de la conexión y cuándo va «Conectar Meta»', () => {
  for (const e of ['conectado', 'sin-conexion', 'sin-permiso', 'no-pude']) assert.ok(esConexionMeta(e), e);
  for (const e of ['encontro', 'no-esta', '', null, undefined, true]) assert.ok(!esConexionMeta(e), String(e));
  // Sólo sin conexión: sin permiso o sin respuesta, «Conectar» mandaría a conectar lo que ya está conectado.
  assert.equal(pideConectarMeta('sin-conexion'), true);
  for (const e of ['conectado', 'sin-permiso', 'no-pude', 'encontro', 'no-esta', null] as const) assert.equal(pideConectarMeta(e), false, String(e));
  // La línea y la fila dicen el PORQUÉ (la búsqueda es con la Meta del negocio); la orden la dice el botón.
  assert.equal(AVISO_SIN_META, 'Las cuentas se buscan con tu Meta');
  const fila = avisoSinResultados({ esUsuario: true, meta: 'sin-conexion', porNombre: null });
  assert.equal(fila, 'Su cuenta se busca con tu Meta');
  for (const t of [AVISO_SIN_META, fila]) {
    assert.doesNotMatch(t, /conecta/i, `«${t}» repite lo que dice el botón`);
    assert.ok(t.length <= 40, `«${t}» es largo`);
  }
});

test('lib: qué guarda la ficha al cerrar su campo (instagramDeLaFicha)', () => {
  // Un usuario nuevo, normalizado con la regla de siempre (@, mayúsculas, el link del perfil).
  assert.deepEqual(instagramDeLaFicha('martinkoncke', '@Ana.Perez'), { guardar: 'ana.perez' });
  assert.deepEqual(instagramDeLaFicha(null, 'https://www.instagram.com/ana_perez/?igsh=x'), { guardar: 'ana_perez' });
  // Lo mismo de antes: no se escribe (ni queda una línea en el historial).
  assert.equal(instagramDeLaFicha('martinkoncke', '@martinkoncke'), 'nada');
  assert.equal(instagramDeLaFicha('@MartinKoncke', ' martinkoncke '), 'nada');
  // Vaciado: se borra; vacío sobre vacío, nada.
  assert.deepEqual(instagramDeLaFicha('martinkoncke', '  '), { guardar: null });
  assert.equal(instagramDeLaFicha(null, ''), 'nada');
  // Un nombre o un post no son un usuario: se avisa, no se guarda.
  assert.equal(instagramDeLaFicha('martinkoncke', 'Martin Koncke'), 'invalido');
  assert.equal(instagramDeLaFicha(null, 'https://www.instagram.com/p/ABC123/'), 'invalido');
});

// ── La ruta ──────────────────────────────────────────────────────────────────

test('ruta: ?estado=1 contesta después de la sesión y sin buscar a nadie', () => {
  const i401 = RUTA.indexOf("{ ok: false, error: 'No autorizado' }, { status: 401 }");
  const iEstado = RUTA.indexOf("if (sp.get('estado') === '1') return Response.json({ ok: true, conexion: await conexionDeMeta(ws, sp.get('fresco') === '1') });");
  const iQ = RUTA.indexOf("searchParams.get('q')");
  assert.ok(i401 > 0 && iEstado > i401 && iQ > iEstado, 'la rama del estado va después de la sesión y antes de leer lo que se busca');
  const fn = cuerpo(RUTA, 'async function conexionDeMeta(');
  // Lee lo MISMO que la búsqueda: el token del negocio de la sesión y la cuenta de Instagram de su página (con caché).
  // Con token y sin la cuenta de Instagram de la página es `sin-instagram` desde el 24/10/2026: Meta ESTÁ conectada.
  assert.match(fn, /const token = await credWs\('META_ACCESS_TOKEN', ws\);\s*const ig = token \? await igDelNegocio\(ws, token\) : null;[\s\S]{0,160}return token && ig \? 'conectado' : token \? 'sin-instagram' : 'sin-conexion';/);
  // Y no gasta nada: ni Business Discovery, ni Google, ni Apify, ni escribe en la caché por su cuenta.
  assert.doesNotMatch(fn, /buscarEnMeta|buscarEnGoogle|leerPerfilInstagram|business_discovery|guardarCache/);
  // Lo que no se pudo leer no es «sin conexión».
  assert.match(fn, /catch \(e\) \{[\s\S]*?return \(e as \{ motivo\?: unknown \} \| null\)\?\.motivo === 'sin-permiso' \? 'sin-permiso' : 'no-pude';/);
});

test('ruta: después de conectar (fresco) olvida la caché de ESE negocio, con su tope', () => {
  const fn = cuerpo(RUTA, 'async function conexionDeMeta(');
  assert.ok(fn.includes('if (fresco) refrescar(ws);'), 'fresco pasa por `refrescar` (el tope)');
  assert.doesNotMatch(fn, /cache\.delete/, 'conexionDeMeta olvida a mano, sin el tope');
  assert.ok(fn.indexOf('if (fresco)') < fn.indexOf('const pausa = leerCache'), 'se olvida ANTES de leer la pausa');
  const r = cuerpo(RUTA, 'function refrescar(');
  assert.match(r, /const t = tocaRefrescar\(frescos\.get\(ws\), Date\.now\(\)\);\s*if \(!t\.si\) return;\s*frescos\.set\(ws, t\.anotado\);/);
  assert.match(r, /for \(const k of clavesQueOlvida\(ws, leerCache<string>\(`mx:\$\{ws\}`\)\)\) cache\.delete\(k\);/);
});

test('lib: el tope de `fresco` (una cada 10 minutos, 20 por día) y la pausa de un límite de Meta que no se borra', () => {
  const t0 = Date.UTC(2026, 9, 23, 3, 0, 0);
  const a = tocaRefrescar(undefined, t0);
  assert.ok(a.si, 'la primera vez, sí');
  const anotado = (a as { anotado: AnotadoFresco }).anotado;
  assert.deepEqual(anotado, { ultimo: t0, dia: '2026-10-23', enElDia: 1 });
  assert.equal(tocaRefrescar(anotado, t0 + 1000).si, false, 'un bucle: la segunda, enseguida, no');
  assert.equal(tocaRefrescar(anotado, t0 + FRESCO_CADA_MS - 1).si, false);
  assert.ok(tocaRefrescar(anotado, t0 + FRESCO_CADA_MS).si, 'a los 10 minutos, sí');
  // El tope del día, y al otro día vuelve a empezar.
  const lleno: AnotadoFresco = { ultimo: t0, dia: '2026-10-23', enElDia: FRESCO_POR_DIA };
  assert.equal(tocaRefrescar(lleno, t0 + 2 * FRESCO_CADA_MS).si, false, 'pasado el tope del día, no');
  const manana = tocaRefrescar(lleno, Date.UTC(2026, 9, 24, 0, 5, 0));
  assert.ok(manana.si);
  assert.equal((manana as { anotado: AnotadoFresco }).anotado.enElDia, 1);
  assert.equal(FRESCO_CADA_MS, 10 * 60_000);
  assert.equal(FRESCO_POR_DIA, 20);
  // La pausa por un límite de Meta queda; la de un permiso (que se arregla conectando) se olvida.
  assert.deepEqual(clavesQueOlvida(7, 'limite'), ['ig:7']);
  assert.deepEqual(clavesQueOlvida(7, 'sin-permiso'), ['ig:7', 'mx:7']);
  assert.deepEqual(clavesQueOlvida(7, undefined), ['ig:7', 'mx:7']);
});

test('pantalla: `fresco` lo pide SÓLO la vuelta de «Conectar Meta» (un clic de la persona), nunca otro lado', () => {
  // En toda la pantalla, un solo lugar arma el pedido con `fresco`, y una sola llamada lo prende: la de `onConectado`.
  assert.equal((COMP.match(/fresco=1/g) ?? []).length, 1);
  assert.equal((COMP.match(/preguntarConexion\(true\)/g) ?? []).length, 1);
  assert.match(COMP, /onConectado: \(\) => \{ void preguntarConexion\(true\)/);
  // Y en toda la app, ningún otro archivo le pide la ruta con `fresco` (ni un cron, ni un bucle de otra pantalla).
  const piden = execFileSync('git', ['grep', '-l', '-e', 'instagram-buscar?', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .trim().split('\n').filter((f) => /fresco/.test(leer(f)));
  assert.deepEqual(piden, ['app/crm/new/InstagramBuscador.tsx']);
});

// ── El buscador ──────────────────────────────────────────────────────────────

test('buscador: pregunta al enfocarse, una vez, y sin conexión ofrece «Conectar Meta» debajo del campo y en la fila', () => {
  assert.match(COMP, /const r = await fetch\(`\/api\/crm\/instagram-buscar\?estado=1\$\{fresco \? '&fresco=1' : ''\}`, \{ signal: AbortSignal\.timeout\(TOPE_MS\) \}\);/);
  assert.match(COMP, /if \(r\.ok && j\?\.ok && esConexionMeta\(j\.conexion\)\) setConexion\(j\.conexion\);/);
  assert.match(COMP, /onFocus=\{\(\) => \{\s*setAbierto\(true\);\s*if \(!preguntada\.current\) \{ preguntada\.current = true; void preguntarConexion\(false\); \}/);
  // La línea va AFUERA de la caja del campo (la lista se ubica contra el campo) y antes del modal.
  const iCaja = COMP.indexOf('<div ref={cajaRef}');
  const iLinea = COMP.indexOf("{(pideConectarMeta(conexion) || conexion === 'sin-instagram') && (");
  assert.ok(iCaja > 0 && iLinea > iCaja, 'falta la línea de debajo del campo');
  assert.ok(COMP.slice(iCaja, iLinea).includes('document.body,'), 'la línea quedó adentro de la caja del campo');
  // Con Meta conectada pero sin Instagram (24/10/2026), la línea dice eso y SIN el botón.
  assert.match(COMP.slice(iLinea, iLinea + 700), /<span>\{conexion === 'sin-instagram' \? AVISO_SIN_INSTAGRAM : AVISO_SIN_META\}<\/span>\s*\{pideConectarMeta\(conexion\) && botonConectar\}/);
  // La fila de la lista sin resultados: la frase y, sin conexión, el botón.
  // ⚠️ UNA VEZ (24/10/2026, Martín vio «Conectar Meta» DOS veces): si la línea de debajo del campo ya lo ofrece, la fila no.
  assert.match(COMP, /<span>\{avisoSinResultados\(\{[\s\S]*?\}\)\}<\/span>\s*\{pideConectarMeta\(metaDeLaBusqueda\) && !pideConectarMeta\(conexion\) && botonConectar\}/);
});

test('buscador: el modal de la casa sin salir de la tab, y sin perder el campo al abrirlo', () => {
  // El hook de la pieza única (no un formulario propio, no un link a /integraciones).
  assert.match(COMP, /import \{ useConectarIntegracion \} from '@\/app\/_components\/ConectarIntegracion';/);
  assert.doesNotMatch(COMP, /href=["'`{][^>]*\/integraciones/);
  // Se marca ANTES de soltar el foco; ese blur no confirma (en la ficha cerraría el campo y el modal con él).
  assert.match(COMP, /const conectar = \(\) => \{\s*conectandoRef\.current = true;\s*setAbierto\(false\);\s*inputRef\.current\?\.blur\(\);\s*integracion\.abrir\('meta'\);\s*\};/);
  assert.match(COMP, /onBlur=\{\(\) => \{\s*setAbierto\(false\);\s*if \(!conectandoRef\.current\) fichaRef\.current\?\.confirmar\(texto\);\s*\}\}/);
  // El clic no le saca el foco al campo antes de su `click`.
  assert.match(COMP, /<button type="button" data-conectar-integracion="meta" onMouseDown=\{\(e\) => e\.preventDefault\(\)\}\s*onClick=\{\(e\) => \{ e\.stopPropagation\(\); conectar\(\); \}\}/);
  // Conectado: pregunta otra vez SIN la caché y vuelve a buscar lo escrito.
  assert.match(COMP, /onConectado: \(\) => \{ void preguntarConexion\(true\)\.then\(\(\) => \{ setResp\(null\); setRonda\(\(n\) => n \+ 1\); \}\); \},/);
  assert.match(COMP, /\}, \[buscable, consulta, ronda\]\);/);
  // Cerrado el modal, el foco vuelve al campo; y el modal vive en el componente, no en la lista que se cierra.
  assert.match(COMP, /if \(conectando \|\| !conectandoRef\.current\) return;\s*conectandoRef\.current = false;\s*inputRef\.current\?\.focus\(\);/);
  assert.equal((COMP.match(/\{integracion\.modal\}/g) ?? []).length, 2, 'el modal se dibuja en las dos ramas del componente');
});

test('buscador en la ficha: no busca el @ con el que abre, Enter y salir confirman, Escape cancela', () => {
  assert.match(COMP, /const \[tocado, setTocado\] = useState\(!enLaFicha\);/);
  assert.match(COMP, /const buscable = !valor && tocado && alcanzaParaBuscar\(consulta\);/);
  assert.match(COMP, /onChange=\{\(e\) => \{ setTexto\(e\.target\.value\);[^}]*setTocado\(true\); \}\}/);
  // Enter: elige lo marcado; si no hay nada que elegir, confirma lo escrito; vacío, también (es borrar).
  assert.match(COMP, /if \(listaVisible && iActivo >= 0\) elegir\(opciones\[iActivo\]\);\s*else enLaFicha\?\.confirmar\(texto\);\s*\} else if \(e\.key === 'Enter' && enLaFicha\) \{\s*e\.preventDefault\(\);\s*enLaFicha\.confirmar\(texto\);/);
  // Escape en `window` y en captura (antes que el de la ficha), también sin la lista, y no con el modal encima.
  assert.match(COMP, /if \(!listaVisible && !enFicha\) return;\s*const escape = /);
  assert.match(COMP, /if \(e\.key !== 'Escape' \|\| conectandoRef\.current\) return;\s*if \(!listaVisible && document\.activeElement !== inputRef\.current\) return;[\s\S]{0,160}setAbierto\(false\);\s*fichaRef\.current\?\.cancelar\(\);/);
  // Abre con el foco y el cursor al final del @.
  assert.match(COMP, /el\.focus\(\);\s*el\.setSelectionRange\(el\.value\.length, el\.value\.length\);/);
});

// ── La ficha ─────────────────────────────────────────────────────────────────

test('la ficha corrige el Instagram con el MISMO buscador del alta', () => {
  const ed = cuerpo(EDIT, 'export function InstagramEditable(');
  assert.match(EDIT, /import \{ InstagramBuscador \} from '@\/app\/crm\/new\/InstagramBuscador';/);
  assert.doesNotMatch(ed, /<EditableInline\b/, 'volvió el texto plano');
  assert.match(ed, /useGuardarCampo\(leadId, 'instagram'\)/);
  assert.match(ed, /<InstagramBuscador\s+valor=\{null\}\s+textoInicial=\{actual \? `@\$\{actual\}` : ''\}\s+onElegir=\{\(p\) => \{ if \(p\) cerrar\(p\.usuario\); \}\}\s+enLaFicha=\{\{ confirmar: cerrar, cancelar: \(\) => cerrar\(null\) \}\}\s+\/>/);
  assert.match(ed, /const r = instagramDeLaFicha\(valor, escrito\);\s*if \(r === 'nada'\) return;\s*if \(r === 'invalido'\) \{ show\('Usuario no válido', undefined, 'bad'\); return; \}\s*guardar\(r\.guardar, valor\);/);
  // UNA salida por apertura: el blur del campo que se desmonta después de elegir no vuelve a escribir.
  assert.match(ed, /if \(cerrado\.current\) return;\s*cerrado\.current = true;/);
  // Cerrado, el dato es el botón que abre (lo busca `CajaCampo`); abierto, la tarjeta sabe que se está editando.
  assert.match(ed, /<button type="button" data-campo-abrir title=\{titulo\} onClick=\{\(\) => \{ cerrado\.current = false; setAbierto\(true\); \}\}/);
  assert.match(ed, /<span data-campo-editando /);
  // Las dos fichas lo montan igual que siempre.
  assert.match(leer('app/crm/lead-view/ficha/resumen/contacto.tsx'), /<InstagramEditable leadId=\{lead\.id\} valor=\{lead\.instagram \?\? null\} \/>/);
  assert.match(leer('app/crm/lead-view/InfoPrincipalCard.tsx'), /editor=\{<InstagramEditable leadId=\{leadId\} valor=\{instagram\} \/>\}/);
});
