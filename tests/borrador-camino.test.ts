// =============================================================================
// El borrador de WhatsApp: el camino decide si hay BOTÓN, y el servidor decide igual
// =============================================================================
// Lo que este archivo protege:
//
//   1. Que el botón de enviar NO SE DIBUJE cuando no hay por dónde (el número del
//      borrador desconectado o ya desvinculado), y que en su lugar vaya el motivo.
//   2. Que el servidor vuelva a decidir al enviar: el cliente no elige canal, y la
//      línea sale de la fila del borrador, no del navegador.
//
// ⛔ Hasta el 09/10/2026 este archivo era tests/borrador-ventana-24h.test.ts y protegía
// además el camino OFICIAL (Chatwoot) y su ventana de 24 h de Meta (lib/ventana-24h.ts).
// Chatwoot se borró con toda la integración, y con él esa mitad: el número de empresa no
// tiene ventana. Lo viejo está en la etiqueta de git `archivo/chatwoot-2026-10-09`.
//
// PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez y restaurando de memoria, sobre 6 tests:
//   · `{via !== null && (` → `{true && (` en el panel ............... 1 fallo / 5 pases
//   · el botón clicable con el camino sin resolver (sin `sinResolver`
//     en su `disabled`) ............................................ 1 fallo / 5 pases
//   · `caminosDeEnvio` mandando por la de por default a un borrador
//     que nombra su línea caída ...................................... 1 fallo / 5 pases
//   · `enviarBorradorPorSuCanal` mandando sin recalcular el camino ... 1 fallo / 5 pases
//   · la ruta volviendo a llamar a `enviarBorrador(id, …)` directo .. 1 fallo / 5 pases
//   · el panel volviendo a nombrar el canal oficial ................ 1 fallo / 5 pases
// Con todo en su lugar: 6 pases, 0 fallos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Normalizar el CRLF: `core.autocrlf=true` deja el repo MEZCLADO entre archivos
// y una búsqueda con `\n` no calza en los que están en CRLF (AGENTS.md).
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const PANEL = leer('../app/whatsapp/_shared/PanelBorradores.tsx');
const LIB = sinComentarios(leer('../lib/borrador-camino.ts'));
const RUTA = leer('../app/api/whatsapp/evolution/borradores/route.ts');

/** El cuerpo de una función exportada, hasta su `}` de columna cero. */
function cuerpo(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const fin = src.indexOf('\n}', ini);
  assert.ok(fin > ini, `no encontré el cierre de ${firma}`);
  return src.slice(ini, fin);
}

// ── 1. El botón que no se dibuja ─────────────────────────────────────────────

test('El botón de ENVIAR cuelga del camino, y el motivo ocupa su lugar', () => {
  const iEnviar = PANEL.indexOf('Enviar ✓');
  assert.ok(iEnviar > 0, 'no encontré el botón de enviar en el panel');
  // Se fija la CONDICIÓN, no el cuerpo: lo que decide si el botón existe es el gate.
  const iGate = PANEL.lastIndexOf('{via !== null && (', iEnviar);
  assert.ok(iGate > 0, 'el botón de enviar quedó SIN el gate del camino: se dibuja sin por dónde mandarlo');
  const recorte = PANEL.slice(iGate, iEnviar);
  assert.ok(recorte.length < 500, `el gate quedó a ${recorte.length} caracteres del botón: ya no lo gobierna`);
  // Y cuando no hay camino, la pantalla dice por qué en una frase.
  assert.match(PANEL, /via === null && <div[^>]*>\{b\.camino\?\.motivo/, 'sin botón y sin motivo, el panel no explica nada');
  // «Descartar» sigue disponible siempre: no cuelga de ningún gate.
  const iDescartar = PANEL.indexOf('Descartar<');
  assert.ok(iDescartar > 0 && PANEL.lastIndexOf('{via !== null && (', iDescartar) < iGate - 1, 'Descartar no puede quedar detrás del gate del camino');
  // Y ya no hay un canal oficial que nombrar.
  assert.doesNotMatch(sinComentarios(PANEL), /oficial/i, 'el panel volvió a nombrar el canal oficial (Chatwoot se borró)');
});

test('Mientras el camino no llegó, el botón está DESHABILITADO (no aparece y se borra)', () => {
  // La cinta se refresca con la lectura barata, que no trae camino: dibujar el
  // botón ahí y quitarlo al abrir es un control que desaparece bajo el dedo.
  assert.match(PANEL, /const sinResolver = b\.camino === undefined;/);
  const iEnviar = PANEL.indexOf("'Enviar ✓'");
  const iDisabled = PANEL.lastIndexOf('disabled={busy === b.id || sinResolver}', iEnviar);
  assert.ok(iDisabled > 0 && iEnviar - iDisabled < 600, 'el botón de enviar quedó clicable con el camino sin resolver');
  // Y el servidor no manda `null`, que sería un «Comprobando…» para siempre.
  assert.match(RUTA, /caminos\.get\(b\.id\) \?\? CAMINO_INDETERMINADO/);
  assert.match(PANEL, /camino=1/, 'el panel dejó de pedir el camino al servidor');
});

// ── 2. El servidor decide igual ──────────────────────────────────────────────

test('Un borrador que nombra su línea sale por ELLA o no sale', () => {
  const b = cuerpo(LIB, 'export async function caminosDeEnvio');
  assert.ok(b.length < 1600, `el recorte de caminosDeEnvio mide ${b.length}: está mirando otra cosa`);
  // La CONDICIÓN, no el objeto que cuelga de ella.
  assert.match(b, /fila \? \(viva\(fila\.estado\) \? POR_EMPRESA : LINEA_CAIDA\)/, 'un borrador con su línea caída sale por otra');
  assert.match(b, /estado === 'conectado' \|\| estado === 'conectando'/);
  assert.match(b, /def && viva\(def\.estado\)/);
});

test('El camino se vuelve a calcular al enviar, con la línea de la FILA', () => {
  const b = cuerpo(LIB, 'export async function enviarBorradorPorSuCanal');
  assert.ok(b.length < 700, `el recorte mide ${b.length}: está mirando otra cosa`);
  assert.match(b, /caminosDeEnvio\(\[\{ id: b\.id, linea: b\.instance_name \}\]\)/, 'el envío dejó de recalcular el camino con la línea del borrador: confía en el botón');
  assert.match(b, /if \(camino\?\.via === 'empresa'\) return enviarBorrador\(id, porEmail\);/);
  // Sin camino no se manda nada y se devuelve el motivo.
  assert.match(b, /return \{ ok: false, error: camino\?\.motivo/);
});

test('La ruta manda por la ÚNICA puerta que verifica', () => {
  assert.match(RUTA, /enviarBorradorPorSuCanal\(id,/, 'la ruta dejó de usar la puerta que decide el canal');
  assert.doesNotMatch(RUTA, /enviarBorrador\(id,/, 'la ruta volvió a mandar directo, sin mirar si el número está vivo');
  assert.doesNotMatch(RUTA, /import \{[^}]*\benviarBorrador\b[^}]*\} from '@\/lib\/evolution-envio'/, 'la ruta sigue importando el envío sin gate');
  // Y el GET ofrece el camino sólo cuando se lo piden (?camino=1).
  assert.match(RUTA, /searchParams\.get\('camino'\) !== '1'/);
  assert.match(RUTA, /caminosDeEnvio\(borradores\.map/);
});

test('El módulo no tiene otro camino que el número de empresa', () => {
  assert.doesNotMatch(LIB, /chatwoot|ventana-24h|oficial/i, 'volvió un camino por el WhatsApp oficial');
});
