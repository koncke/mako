// =============================================================================
// La app de escritorio primero, y el Uso con su esqueleto mientras carga (23/10/2026)
// =============================================================================
// Martín: «En Ops Center cuando abro "USO" aún no me sale el loader, al principio me aparecen solo los botones de "Conectar GPT o
// Claude"... Y muy importante, si detecta MaKo que no tienes instalado la app de escritorio, antes de mostrarte nada, o dejarte
// usar cualquier chat, en cualquier tab, te debe aparecer el botón para que puedas descargar la app».
//   1. el criterio, que decidió Martín: «Bloqueá igual: aunque tenga su clave de IA, primero tiene que descargar la app de
//      escritorio antes de usar cualquier chat»; en el teléfono (no se instala), el aviso y el chat sigue;
//   2. el servidor lo dice en `?suIA=1` (el teléfono, del pedido), si no se pudo saber no tapa nada, y bloqueado se destraba solo;
//   3. UNA pieza en el chat común (PiezasCliente.tsx), con la descarga de IA del cliente (NuevoDispositivo), no una copia;
//   4. el Uso: el esqueleto del bloque mientras llega el estado, nunca «Nueva cuenta» sola.
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

test('1. el criterio: con computadora o en la plataforma, nada; sin computadora, bloquea (aunque tenga su clave); en el teléfono, el aviso', () => {
  assert.equal(appDeEscritorio({ plataforma: false, conComputadora: true, telefono: false }), 'tiene');
  assert.equal(appDeEscritorio({ plataforma: true, conComputadora: false, telefono: false }), 'tiene', 'la plataforma contesta con su IA');
  assert.equal(appDeEscritorio({ plataforma: false, conComputadora: false, telefono: false }), 'bloquea');
  assert.equal(appDeEscritorio({ plataforma: false, conComputadora: false, telefono: true }), 'en-la-computadora', 'en el teléfono no se instala: no bloquea');
  assert.equal(appDeEscritorio({ plataforma: false, conComputadora: true, telefono: true }), 'tiene', 'con una conectada, el teléfono chatea');
});

test('2. el servidor lo dice con `?suIA=1`; sin poder saberlo no tapa nada; bloqueado, se destraba solo', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /const \[conectada, cuentas, app\] = await Promise\.all\(\[conSuIA\(persona\), cuentasDeIA\(persona\)\.catch\(\(\) => \[\]\), laApp\(persona, req\)\]\);\n\s*return json\(\{ ok: true, conectada, cuentas, app \}\);/);
  const f = ruta.slice(ruta.indexOf('async function laApp('), ruta.indexOf('async function conSuIA('));
  assert.match(f, /const conComputadora = !plataforma && \(await pcDe\(persona\.ws, persona\.actor\)\) != null;/, 'la computadora de ESTA persona');
  assert.match(f, /const telefono = tipoDeDispositivo\(req\.headers\.get\('user-agent'\), req\.headers\.get\('sec-ch-ua-mobile'\)\) !== 'escritorio';/, 'la misma pregunta del proxy');
  assert.doesNotMatch(f, /claveDelCreditoAsignado|negocioConSuIA/, '«Bloqueá igual»: su clave o el crédito no lo destraban');
  assert.match(f, /\} catch \{\n\s*return 'tiene';/);
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /setApp\(l\.ok && \(l\.datos\.app === 'bloquea' \|\| l\.datos\.app === 'en-la-computadora'\) \? l\.datos\.app : 'tiene'\);/);
  assert.match(motor, /if \(app !== 'bloquea'\) return;\n\s*const t = window\.setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) mirarSuIA\(\); \}, 8_000\);/, 'se destraba sin recargar');
  assert.match(motor, /\|\| !cargado \|\| errorCarga \|\| app === 'bloquea'\) return false;/, 'bloqueado no manda nada, tampoco un pedido de la tab');
});

test('3. UNA pieza en el chat común, EN EL LUGAR DE LA CAJA, con la descarga de IA del cliente', () => {
  const p = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  // 24/10/2026 (Martín: «diseña bien ese cartel, no el botón feo que está al final del modal que no lo ve nadie»): el cartel va donde
  // se escribe; la conversación se sigue viendo, y vacía no ofrece arranques que no se pueden mandar.
  const caja = p.slice(p.indexOf('export function CajaDelCliente('));
  assert.match(caja, /if \(k\.app === 'bloquea'\) return <AppPrimero onConectar=\{\(\) => k\.setConectando\(true\)\} \/>;/, 'el cartel, en el lugar de la caja');
  const hilo = p.slice(p.indexOf('export function HiloDelCliente('), p.indexOf('export function CajaDelCliente('));
  assert.doesNotMatch(hilo, /<AppPrimero/, 'la conversación ya no se tapa');
  assert.match(hilo, /!k\.items\.length && !k\.trabajo \? \(k\.app === 'bloquea' \? null : \(/, 'vacía y bloqueada, sin la portada ni sus arranques');
  assert.match(p, /\{k\.app === 'en-la-computadora' && <FranjaApp \/>\}/, 'en el teléfono, el aviso arriba de la caja');
  const pieza = sinComentarios(leer('app/_chat/AppPrimero.tsx'));
  assert.match(pieza, /import \{ DescargarElOtro, DescargarMaKo, avisoAlAbrir \} from '@\/app\/integraciones\/CuentasYDispositivos';/);
  assert.doesNotMatch(pieza, /\/api\/ia-pc\/descargar|navigator\./, 'la descarga y la detección no se reescriben');
  // La criatura, una frase y UN botón; tocado, el paso siguiente (lo que dice el sistema y «Ya lo instalé: conectar»).
  assert.match(pieza, /<Muneco titulo="MaKo" aspecto=\{ASPECTO_MAKO\} animo="despierto" size=\{44\} \/>/);
  assert.match(pieza, /<p className="ch-app-cartel__frase">\{FRASE_APP\}<\/p>\n\s*<DescargarMaKo className="ch-app-cartel__boton" onClick=\{\(\) => setDescargado\(true\)\} \/>/);
  assert.match(pieza, /<button type="button" className="ch-app-cartel__boton" onClick=\{onConectar\}>Ya lo instalé: conectar<\/button>/);
  assert.match(pieza, /<p className="ch-app-cartel__aviso">\{avisoAlAbrir\(\)\}<\/p>/);
});

test('4. el Uso: el esqueleto del bloque mientras llega el estado, nunca «Nueva cuenta» sola', () => {
  const t = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(t, /\{!estado && !leido && !eligiendo && !tutorial && <EsqueletoDeCuentas \/>\}/);
  assert.match(t, /\{\(estado \|\| leido\) && !eligiendo && !tutorial && \(\n\s*<>\n\s*<NuevaCuenta /, '«Nueva cuenta» recién con el estado (o si no se pudo leer)');
  assert.match(t, /setLeido\(true\);/, 'sin estado después de intentar, no queda el esqueleto para siempre');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0):
//   · el teléfono también bloquea (`'bloquea'` siempre sin computadora)    → 3/1 (1)
//   · el `catch` de `laApp` devolviendo 'bloquea'                          → 3/1 (2)
//   · AppPrimero con su propio link a /api/ia-pc/descargar                 → 3/1 (3)
//   (24/10/2026, el cartel en el lugar de la caja: probado rompiéndolo en tests/tus-cuentas-ia-diseno.test.ts → romper-diseno)
//   · «Nueva cuenta» sin esperar el estado                                 → 3/1 (4)
