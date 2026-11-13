// =============================================================================
// La app de escritorio primero, y el Uso con su esqueleto mientras carga (23/10/2026)
// =============================================================================
// Martín: «En Ops Center cuando abro "USO" aún no me sale el loader, al principio me aparecen solo los botones de "Conectar GPT o
// Claude"... Y muy importante, si detecta MaKo que no tienes instalado la app de escritorio, antes de mostrarte nada, o dejarte
// usar cualquier chat, en cualquier tab, te debe aparecer el botón para que puedas descargar la app».
//   1. el criterio, que decidió Martín: «Bloqueá igual: aunque tenga su clave de IA, primero tiene que descargar la app de
//      escritorio antes de usar cualquier chat»; en el teléfono (no se instala), el aviso y el chat sigue;
//   2. el servidor lo dice en `?suIA=1` (el teléfono, del pedido), si no se pudo saber no tapa nada, y bloqueado se destraba solo;
//   3. sin la app (24/10/2026), la caja misma no deja escribir y dice «Instalar MaKo» en el lugar del micrófono, con la descarga
//      de IA del cliente, no una copia;
//   4. el Uso: el esqueleto mientras llega el estado; sin ninguna computadora, sólo el botón «Instalar MaKo desktop».
//
// Correr: node --import tsx --test tests/app-de-escritorio-primero.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDeEscritorio } from '../lib/chat-mako-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el criterio: con computadora, nada; sin computadora, bloquea (aunque tenga su clave, también en la plataforma); en el teléfono, el aviso', () => {
  assert.equal(appDeEscritorio({ conComputadora: true, telefono: false }), 'tiene');
  // 25/10/2026 (Martín: «Ni en la cuenta de Mauricio ni en la mia... me sigue dejando enviar mensajes... No debería»): el negocio
  // de la plataforma ya no queda afuera. El recorrido de todos los chats, en tests/app-de-escritorio-todos-los-chats.test.ts.
  assert.equal(appDeEscritorio({ conComputadora: false, telefono: false }), 'bloquea');
  assert.equal(appDeEscritorio({ conComputadora: false, telefono: true }), 'en-la-computadora', 'en el teléfono no se instala: no bloquea');
  assert.equal(appDeEscritorio({ conComputadora: true, telefono: true }), 'tiene', 'con una conectada, el teléfono chatea');
});

test('2. el servidor lo dice con `?suIA=1`; sin poder saberlo no tapa nada; bloqueado, se destraba solo', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /const \[conectada, cuentas, app\] = await Promise\.all\(\[conSuIA\(persona\), cuentasDeIA\(persona\)\.catch\(\(\) => \[\]\), laApp\(persona, req\)\]\);\n\s*return json\(\{ ok: true, conectada, cuentas, app \}\);/);
  const f = ruta.slice(ruta.indexOf('async function laApp('), ruta.indexOf('async function conSuIA('));
  assert.match(f, /const conComputadora = \(await pcDe\(persona\.ws, persona\.actor\)\) != null;/, 'la computadora de ESTA persona (también en la plataforma)');
  assert.doesNotMatch(f, /wsSuperAdmin/, 'la plataforma volvió a quedar afuera');
  assert.match(f, /const telefono = tipoDeDispositivo\(req\.headers\.get\('user-agent'\), req\.headers\.get\('sec-ch-ua-mobile'\)\) !== 'escritorio';/, 'la misma pregunta del proxy');
  assert.doesNotMatch(f, /claveDelCreditoAsignado|negocioConSuIA/, '«Bloqueá igual»: su clave o el crédito no lo destraban');
  assert.match(f, /\} catch \{\n\s*return 'tiene';/);
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /setApp\(l\.ok && \(l\.datos\.app === 'bloquea' \|\| l\.datos\.app === 'en-la-computadora'\) \? l\.datos\.app : 'tiene'\);/);
  assert.match(motor, /if \(app !== 'bloquea'\) return;\n\s*const t = window\.setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) mirarSuIA\(\); \}, 8_000\);/, 'se destraba sin recargar');
  assert.match(motor, /\|\| !cargado \|\| errorCarga \|\| app === 'bloquea'\) return false;/, 'bloqueado no manda nada, tampoco un pedido de la tab');
});

test('3. sin la app, LA CAJA MISMA no deja escribir: «Instalar MaKo» en el lugar del micrófono, con la descarga de IA del cliente', () => {
  const p = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  // 24/10/2026 (Martín: «Si no tengo instalada la app de desktop NO debe dejarme escribir nada, directamente en el chat donde está
  // el botón de audio se debería reemplazar por "Instalar MaKo"»): no un cartel en lugar de la caja; la caja, bloqueada.
  const caja = p.slice(p.indexOf('export function CajaDelCliente('));
  assert.match(caja, /const bloqueoApp = useBloqueoApp\(\(\) => k\.setConectando\(true\)\);/);
  assert.ok(caja.indexOf('useBloqueoApp(') < caja.indexOf('return '), 'el hook, antes de cualquier return');
  assert.match(caja, /const bloqueada = k\.app === 'bloquea';/);
  assert.match(caja, /bloqueo=\{bloqueada \? bloqueoApp : undefined\}/, 'la MISMA caja, con su bloqueo');
  assert.match(caja, /alFinal=\{angosta \|\| bloqueada \? null : conectar\}/, 'sin «Conectar tu IA»: sin la app no destraba nada');
  assert.doesNotMatch(p, /<AppPrimero/, 'el cartel que reemplazaba la caja se fue');
  const hilo = p.slice(p.indexOf('export function HiloDelCliente('), p.indexOf('export function CajaDelCliente('));
  // Vacía y bloqueada: sin la portada ni sus arranques, PERO con la apertura (29/10/2026: sus botones no escriben nada).
  assert.match(hilo, /!k\.items\.length && !k\.trabajo \? \(apertura \?\? \(k\.app === 'bloquea' \? null : \(/, 'vacía y bloqueada: la apertura, sin la portada');
  // En la conversación del teléfono la franja va debajo de la cabecera (app/m/_chat/AvisoDeIA.tsx, test 9 de m-chat-pantalla).
  assert.match(p, /\{k\.app === 'en-la-computadora' && !avisosArriba && <FranjaApp \/>\}/, 'en el teléfono, el aviso arriba de la caja');
  // La caja: el campo apagado con la frase, y en el lugar del botón el que la destraba.
  const c = sinComentarios(leer('app/_chat/CajaChat.tsx'));
  assert.match(c, /const quieto = enviando \|\| apagado \|\| !!p\.bloqueo;/);
  assert.match(c, /placeholder=\{p\.bloqueo \? p\.bloqueo\.frase : /);
  assert.match(c, /\{p\.bloqueo \? p\.bloqueo\.boton : grabacion && /);
  // El botón: la descarga de IA del cliente (no se reescribe la detección), y tocado, «Ya lo instalé: conectar».
  const pieza = sinComentarios(leer('app/_chat/AppPrimero.tsx'));
  assert.match(pieza, /import \{ DescargarMaKo, avisoAlAbrir \} from '@\/app\/integraciones\/CuentasYDispositivos';/);
  assert.doesNotMatch(pieza, /\/api\/ia-pc\/descargar|navigator\./, 'la descarga y la detección no se reescriben');
  // El «ya lo descargó» es el compartido de la página (29/10/2026): la apertura y la caja pasan juntas a «Ya lo instalé».
  assert.match(pieza, /const descargado = useDescargado\(\);/);
  assert.match(pieza, /<DescargarMaKo className="co-instalar" texto="Instalar MaKo" onClick=\{marcarDescargado\}>/);
  assert.match(pieza, /<button type="button" className="co-instalar" onClick=\{onConectar\} title=\{avisoAlAbrir\(\)\} data-app-primero="conectar" data-recorrido="mk-conectar">/);
  assert.match(pieza, /Ya lo instalé: conectar/);
});

test('4. el Uso: el esqueleto mientras llega el estado; sin ninguna computadora, SÓLO el botón de instalar', () => {
  const t = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(t, /\{!estado && !leido && !eligiendo && !tutorial && <EsqueletoDeCuentas \/>\}/);
  // 24/10/2026 (Martín: «si no tengo instalada no tengo que ver el modal de siempre, solo el botón bien diseñado de "Instalar MaKo
  // desktop"»): sin computadora, ni cuentas ni «Nueva cuenta».
  assert.match(t, /\{vacia && !eligiendo && !tutorial && <InstalarDesktop onConectar=\{\(\) => abrirTutorialEn\(4\)\} \/>\}/);
  assert.match(t, /\{\(estado \|\| leido\) && !vacia && !eligiendo && !tutorial && \(\n\s*<>\n\s*<NuevaCuenta /, '«Nueva cuenta» recién con el estado, y no sin computadora');
  // 25/10/2026 tarde, LO POSTERIOR GANA (Martín: «elimina las IA dentro de las integraciones, para eso tenemos el bloque que dice
  // "Tus cuentas de IA"»): las claves de API salieron de la grilla y viven acá, así que «sin computadora, SÓLO el botón» pasó a
  // «sin computadora, el botón Y las claves». Sin ellas, quien no tiene MaKo Desktop no tendría dónde pegar su clave.
  assert.match(t, /\{\(estado \|\| leido\) && !eligiendo && !tutorial && <ClavesDeApi /, 'las claves de API, con o sin computadora');
  assert.match(t, /<DescargarMaKo className="tci-instalar__boton" texto="Instalar MaKo desktop" onClick=\{\(\) => setDescargado\(true\)\}>/);
  assert.match(t, /setLeido\(true\);/, 'sin estado después de intentar, no queda el esqueleto para siempre');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0):
//   · el teléfono también bloquea (`'bloquea'` siempre sin computadora)    → 3/1 (1)
//   · el `catch` de `laApp` devolviendo 'bloquea'                          → 3/1 (2)
//   · AppPrimero con su propio link a /api/ia-pc/descargar                 → 3/1 (3)
//   (24/10/2026, el cartel en el lugar de la caja: probado rompiéndolo en tests/tus-cuentas-ia-diseno.test.ts → romper-diseno)
//   · «Nueva cuenta» sin esperar el estado                                 → 3/1 (4)
//   (24/10/2026, la caja bloqueada y el modal con un botón, base 4/0):
//   · la caja del cliente sin `bloqueo` (vuelve a dejar escribir)          → 3/1 (3)
//   · el modal sin computadora con «Nueva cuenta» otra vez                 → 3/1 (4)
