// =============================================================================
// Ningún chat pide la app de escritorio para escribir (20/11/2026, la llamada con Leila)
// =============================================================================
// Martín (Fathom 205366178, 00:31:18): «hoy en día utilizamos los MaKo Tokens. Entonces, no pongas la restricción de instalar MaKo
// para enviar mensajes». Pisa el «Bloqueá igual» del 23/10 y el «En ningún chat» del 25/10: hasta hoy, sin la computadora
// conectada, la caja de todo chat con MaKo se apagaba con «Instala MaKo para escribir». Ahora se escribe y MaKo contesta con los
// MaKo Tokens. Lo que fija este archivo (las cajas con motor propio, en tests/app-de-escritorio-todos-los-chats.test.ts):
//   1. el servidor contesta `tiene` siempre (`?app=1` y `?suIA=1`), sin leer la computadora ni el dispositivo;
//   2. el cliente ya no pregunta: ni el pedido a `?app=1` ni la relectura cada 8 s (las dos piezas que lo hacían se borraron);
//   3. la caja común (el Ops Center, la estrella de cada tab, el Second Brain, los coaches): sin `bloqueo`, sin la franja del
//      teléfono, y el envío no mira la app;
//   4. las aperturas y la guía: ningún paso «Instalar MaKo»; la escalera pregunta sólo por su IA;
//   5. ningún texto «Instala MaKo» en las piezas de los chats;
//   6. (de antes, sigue) el Uso de «Tus cuentas de IA», donde la app se sigue ofreciendo para trabajar con SU Claude.
//
// Correr: node --import tsx --test tests/app-de-escritorio-primero.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as OPS from '../lib/aperturas/ops';
import * as COMUNES from '../lib/aperturas/comunes';
import * as REGLAS from '../lib/aperturas/reglas';
import { GUIA_OPS_CENTER } from '../app/second-brain/guia-ops-center';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const suelto = (m: object, k: string) => (m as Record<string, any>)[k];

test('1. el servidor contesta `tiene` siempre, sin leer la computadora ni el dispositivo', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(sp\.get\('app'\)\) return json\(\{ ok: true, app: 'tiene' \}\);/, 'una pestaña de antes del 20/11 que pregunta, se destraba');
  assert.match(ruta, /return json\(\{ ok: true, conectada, cuentas, app: 'tiene' \}\);/);
  assert.doesNotMatch(ruta, /async function laApp\(|appDeEscritorio|tipoDeDispositivo/, 'nada decide si el chat bloquea');
  assert.doesNotMatch(sinComentarios(leer('lib/chat-mako-reglas.ts')), /export function appDeEscritorio\(/, 'la regla del bloqueo se fue');
});

test('2. el cliente ya no pregunta por la app: las piezas que lo hacían se borraron', () => {
  for (const f of ['app/_chat/app-de-escritorio.ts', 'app/_chat/useAppDeEscritorio.tsx']) assert.equal(existsSync(join(RAIZ, f)), false, `${f} volvió`);
  const preguntan: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(join(RAIZ, d), { withFileTypes: true })) {
      if (n.isDirectory()) { if (n.name !== 'node_modules') recorrer(`${d}/${n.name}`); continue; }
      // Las bitácoras de /admin/dev son historia: nombran las piezas de antes a propósito.
      if (!/\.(ts|tsx)$/.test(n.name) || n.name === 'bitacora.ts') continue;
      if (/\/api\/mako\/chat\?app=1|app-de-escritorio'|useAppDeEscritorio/.test(sinComentarios(leer(`${d}/${n.name}`)))) preguntan.push(`${d}/${n.name}`);
    }
  };
  recorrer('app');
  assert.deepEqual(preguntan, [], 'nadie pregunta `?app=1` ni importa las piezas del bloqueo');
  assert.doesNotMatch(sinComentarios(leer('app/_chat/ModalCuentasIA.tsx')), /mirarApp/, 'cerrar «Tus cuentas de IA» ya no relee la app');
});

test('3. la caja común: sin bloqueo ni franja, y el envío no mira la app', () => {
  const p = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.doesNotMatch(p, /useBloqueoApp|FranjaApp|FRASE_RESPONDER|'bloquea'|en-la-computadora/);
  const caja = p.slice(p.indexOf('export function CajaDelCliente('));
  assert.doesNotMatch(caja, /bloqueo=\{/, 'la caja vuelve a apagarse');
  assert.match(caja, /alFinal=\{angosta \? null : conectar\}/);
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.doesNotMatch(motor, /'bloquea'/, 'el motor no frena ni relee por la app');
  assert.match(motor, /\|\| ocupadoRef\.current \|\| !cargado \|\| errorCarga\) return false;/, 'el envío no mira la app');
  // El teléfono: la línea de debajo de la cabecera sólo dice lo de su IA.
  const aviso = sinComentarios(leer('app/m/_chat/AvisoDeIA.tsx'));
  assert.doesNotMatch(aviso, /FRANJA_APP|data-app-franja/);
});

test('4. las aperturas y la guía: ningún paso «Instalar MaKo»', () => {
  assert.deepEqual([...suelto(REGLAS, 'ACCIONES_COMUNES')], ['conectar'], '«instalar» ya no es una acción');
  const catalogo = (suelto(OPS, 'CATALOGO') as Array<{ id: string }>).map((c) => c.id);
  assert.ok(!catalogo.includes('ops:ia-instalar'), 'el paso de instalar se fue del catálogo');
  // Con cualquier respuesta, ningún botón instala; la escalera es la de su IA.
  const aperturaOps = suelto(OPS, 'aperturaOps') as (h: object, r: object) => { id: string; botones: Array<{ accion?: string }> } | null;
  for (const iaConectada of [true, false]) {
    for (const ia of [undefined, OPS.IA_CLAUDE, OPS.IA_CHATGPT, OPS.IA_NINGUNA]) {
      const a = aperturaOps({ app: 'tiene', iaConectada }, ia ? { [OPS.ID_IA]: ia } : {});
      assert.ok(!a?.botones.some((b) => b.accion === 'instalar'), `ia=${ia}`);
      if (iaConectada) assert.equal(a, null, 'con su IA, nada');
    }
  }
  assert.equal(aperturaOps({ app: 'tiene', iaConectada: false }, { [OPS.ID_IA]: OPS.IA_CLAUDE })?.id, 'ops:ia-conectar');
  const pasoSinIA = suelto(COMUNES, 'pasoSinIA') as (o: object) => { id: string } | null;
  assert.equal(pasoSinIA({ superficie: 'x' }), null, 'nada que instalar ni conectar antes de pedir (tests/chat-su-ia-opcional.test.ts)');
  assert.doesNotMatch(sinComentarios(leer('app/_chat/AperturaMako.tsx')), /InstalarMaKo|'instalar'|'bloquea'/);
  const anclas = GUIA_OPS_CENTER.anclas as readonly { id: string; antes?: string }[];
  assert.ok(!anclas.some((a) => a.id === 'mk-instalar' || a.antes === 'mk-instalar'), 'la guía no señala «Instalar MaKo»');
});

test('5. ningún texto «Instala MaKo» en las piezas de los chats', () => {
  assert.equal(existsSync(join(RAIZ, 'app/_chat/InstalarMaKo.tsx')), false, 'el botón del bloqueo se fue');
  assert.equal(existsSync(join(RAIZ, 'app/_chat/AppPrimero.tsx')), false, 'la caja tapada y la franja se fueron');
  const dirs = ['app/_chat', 'app/second-brain', 'app/m/_chat', 'app/m/second-brain', 'lib/aperturas'];
  const con: string[] = [];
  for (const d of dirs) {
    for (const n of readdirSync(join(RAIZ, d))) {
      if (!/\.(ts|tsx)$/.test(n)) continue;
      if (/Instala(r)? MaKo|Descarga MaKo en tu computadora/.test(sinComentarios(leer(`${d}/${n}`)))) con.push(`${d}/${n}`);
    }
  }
  assert.deepEqual(con, []);
});

test('6. el Uso: el esqueleto mientras llega el estado; sin ninguna computadora, el botón de instalar y las claves', () => {
  const t = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(t, /\{!estado && !leido && !eligiendo && !tutorial && <EsqueletoDeCuentas \/>\}/);
  // 24/10/2026 (Martín: «si no tengo instalada no tengo que ver el modal de siempre, solo el botón bien diseñado de "Instalar MaKo
  // desktop"»): sin computadora, ni cuentas ni «Nueva cuenta». Es «Tus cuentas de IA», no un chat: la app se ofrece para SU Claude.
  assert.match(t, /\{vacia && !eligiendo && !tutorial && <InstalarDesktop onConectar=\{\(\) => abrirTutorialEn\(4\)\} \/>\}/);
  assert.match(t, /\{\(estado \|\| leido\) && !vacia && !eligiendo && !tutorial && \(\n\s*<>\n\s*<NuevaCuenta /, '«Nueva cuenta» recién con el estado, y no sin computadora');
  // 25/10/2026 tarde (Martín: «elimina las IA dentro de las integraciones, para eso tenemos el bloque que dice "Tus cuentas de
  // IA"»): las claves de API viven acá, con o sin computadora.
  assert.match(t, /\{\(estado \|\| leido\) && !eligiendo && !tutorial && <ClavesDeApi /, 'las claves de API, con o sin computadora');
  assert.match(t, /<DescargarMaKo className="tci-instalar__boton" texto="Instalar MaKo desktop" onClick=\{\(\) => setDescargado\(true\)\}>/);
  assert.match(t, /setLeido\(true\);/, 'sin estado después de intentar, no queda el esqueleto para siempre');
});

// PROBADO ROMPIÉNDOLO (20/11/2026, base 6/0; contra el código de antes 1/5, sólo pasaba el 6), de a una y restaurando:
//   · `?app=1` contestando `bloquea`                                       → 5/1 (1)
//   · `useAppBloqueada` devolviendo true                                   → 5/1 (2) (con el gancho borrado, el 2 mira que
//     nadie pregunte `?app=1`: una pieza que vuelve a preguntar             → 5/1 (2))
//   · la caja común otra vez con `bloqueo=`                                → 5/1 (3)
//   · el envío de useChatCliente mirando `app === 'bloquea'`               → 5/1 (3)
//   · la línea del teléfono con la franja de la app                        → 5/1 (3)
//   · «instalar» otra vez en ACCIONES_COMUNES                              → 5/1 (4)
//   · la escalera pidiendo instalar al elegir Claude                       → 5/1 (4)
//   · la guía con «Instalar MaKo» y «Conectar» detrás                      → 4/2 (4, 5)
// Las de las cajas con motor propio, en tests/app-de-escritorio-todos-los-chats.test.ts.
