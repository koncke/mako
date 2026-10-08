// =============================================================================
// El borrador en el canal OFICIAL: la ventana de 24 h decide si hay BOTÓN
// =============================================================================
// MEDIDO el 05/10/2026: el panel de borradores existía y su único envío era
// `enviarBorrador` (lib/evolution-envio.ts), que sale por Evolution. En un
// workspace que solo tiene el WhatsApp oficial el borrador era INERTE: MaKo lo
// redactaba y no había por dónde mandarlo — y encima el panel vivía en
// EmpresaInbox, que no se dibuja sin Evolution conectado.
//
// Lo que este archivo protege son las dos mitades del arreglo:
//
//   1. La VENTANA. Fuera de las 24 h de Meta solo salen plantillas aprobadas:
//      un botón que manda texto libre a las 25 horas falla del lado de Meta y
//      se lee como que la app está rota. El gate está EN POSITIVO y es puro
//      (lib/ventana-24h.ts), así que acá se EJECUTA con los dos casos.
//   2. Que el botón NO SE DIBUJE cuando no hay por dónde, y que el servidor
//      vuelva a decidir igual (el cliente no elige canal ni calcula ventana).
//
// PROBADO ROMPIÉNDOLO, seis roturas, una por vez, sobre 11 tests:
//   · `ventanaAbierta24h` devolviendo `senal.puedeResponder` (sin mirar la
//     actividad) ................................................ 2 fallos / 9 pases
//   · `{via !== null && (` → `{true && (`: el botón se dibuja fuera
//     de la ventana ............................................. 1 fallo / 10 pases
//   · el botón clicable con el camino sin resolver (sin `sinResolver`
//     en su `disabled`) ......................................... 1 fallo / 10 pases
//   · `caminosDeEnvio` devolviendo `{ via: 'oficial' }` sin mirar
//     `v?.abierta` .............................................. 1 fallo / 10 pases
//   · `enviarBorradorPorSuCanal` dando el camino por bueno en vez
//     de recalcularlo ........................................... 1 fallo / 10 pases
//   · la ruta volviendo a llamar a `enviarBorrador(id, …)` directo   1 fallo / 10 pases
// Con todo en su lugar: 11 pases, 0 fallos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VENTANA_24H_MS, ventanaAbierta24h, venceVentana24h, MOTIVO_FUERA_DE_VENTANA } from '../lib/ventana-24h';

// Normalizar el CRLF: `core.autocrlf=true` deja el repo MEZCLADO entre archivos
// y una búsqueda con `\n` no calza en los que están en CRLF (AGENTS.md).
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const AHORA = Date.parse('2026-10-05T18:00:00Z');
const haceHoras = (h: number) => Math.floor((AHORA - h * 3_600_000) / 1000); // epoch en SEGUNDOS

// ── 1. El gate, ejecutado ────────────────────────────────────────────────────

test('ADENTRO de la ventana: el lead escribió hace 1 h → se puede mandar texto libre', () => {
  assert.equal(ventanaAbierta24h({ puedeResponder: true, ultimaActividadSeg: haceHoras(1) }, AHORA), true);
  // Y el vencimiento que la pantalla muestra son 24 h después de esa actividad.
  assert.equal(venceVentana24h(haceHoras(1)), haceHoras(1) + 86_400);
});

test('AFUERA de la ventana: 25 h sin actividad → no hay botón que valga', () => {
  // Es el caso que el paquete persigue: Meta rechaza el texto libre acá.
  assert.equal(ventanaAbierta24h({ puedeResponder: true, ultimaActividadSeg: haceHoras(25) }, AHORA), false);
  // El borde exacto también está afuera (24 h justas ya venció).
  const justo = Math.floor((AHORA - VENTANA_24H_MS) / 1000);
  assert.equal(ventanaAbierta24h({ puedeResponder: true, ultimaActividadSeg: justo }, AHORA), false);
  // Y 23 h 59 min sigue adentro: el corte está donde dice, no un día antes.
  assert.equal(ventanaAbierta24h({ puedeResponder: true, ultimaActividadSeg: haceHoras(23.9) }, AHORA), true);
});

test('Sin dato, con basura, o con can_reply en false: CERRADA (fail-closed)', () => {
  // `puedeResponder` nace de `can_reply !== false`, así que un Chatwoot que no
  // manda el campo se lee como true: el AND con la actividad es lo que cierra.
  for (const seg of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(ventanaAbierta24h({ puedeResponder: true, ultimaActividadSeg: seg }, AHORA), false, `${seg} no puede abrir la ventana`);
    assert.equal(venceVentana24h(seg), null, `${seg} no puede dar un vencimiento`);
  }
  // Y lo que Chatwoot cerró, la actividad no lo reabre.
  assert.equal(ventanaAbierta24h({ puedeResponder: false, ultimaActividadSeg: haceHoras(1) }, AHORA), false);
});

test('La frase que ve la persona nombra la ventana y no culpa a nadie', () => {
  assert.match(MOTIVO_FUERA_DE_VENTANA, /24 h/);
  assert.match(MOTIVO_FUERA_DE_VENTANA, /plantillas aprobadas/);
  // Corta: es el porqué de un botón que no está, no un párrafo.
  assert.ok(MOTIVO_FUERA_DE_VENTANA.length <= 80, `la frase mide ${MOTIVO_FUERA_DE_VENTANA.length}`);
});

// ── 2. El botón que no se dibuja ─────────────────────────────────────────────

const PANEL = leer('../app/whatsapp/_shared/PanelBorradores.tsx');

test('El botón de ENVIAR cuelga del camino, y el motivo ocupa su lugar', () => {
  const iEnviar = PANEL.indexOf('Enviar ✓');
  assert.ok(iEnviar > 0, 'no encontré el botón de enviar en el panel');
  // Se fija la CONDICIÓN, no el cuerpo: lo que decide si el botón existe es el
  // gate. Sin él, `lastIndexOf` no lo encuentra y esto falla.
  const iGate = PANEL.lastIndexOf('{via !== null && (', iEnviar);
  assert.ok(iGate > 0, 'el botón de enviar quedó SIN el gate del camino: se dibuja fuera de la ventana');
  const recorte = PANEL.slice(iGate, iEnviar);
  assert.ok(recorte.length < 500, `el gate quedó a ${recorte.length} caracteres del botón: ya no lo gobierna`);
  // Y cuando no hay camino, la pantalla dice por qué en una frase.
  assert.match(PANEL, /via === null && <div[^>]*>\{b\.camino\?\.motivo/, 'sin botón y sin motivo, el panel no explica nada');
  // «Descartar» sigue disponible siempre: no cuelga de ningún gate.
  const iDescartar = PANEL.indexOf('Descartar<');
  assert.ok(iDescartar > 0 && PANEL.lastIndexOf('{via !== null && (', iDescartar) < iGate - 1, 'Descartar no puede quedar detrás del gate de la ventana');
});

test('El camino lo trae el SERVIDOR: el panel no calcula la ventana', () => {
  assert.match(PANEL, /camino=1/, 'el panel dejó de pedir el camino al servidor');
  assert.match(PANEL, /const via = b\.camino\?\.via;/, 'el via dejó de salir del camino que mandó el servidor');
  // Ninguna cuenta de 24 h del lado del cliente.
  assert.doesNotMatch(PANEL, /86_?400|24 \* 60|Date\.now\(\) -/, 'el panel se puso a calcular la ventana por su cuenta');
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
});

// ── 3. El servidor decide igual ──────────────────────────────────────────────

const LIB = leer('../lib/borrador-oficial.ts');
const RUTA = leer('../app/api/whatsapp/evolution/borradores/route.ts');

/** El cuerpo de una función exportada, hasta su `}` de columna cero. */
function cuerpo(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini > 0, `no encontré ${firma}`);
  const fin = src.indexOf('\n}', ini);
  assert.ok(fin > ini, `no encontré el cierre de ${firma}`);
  return src.slice(ini, fin);
}

test('Fuera de la ventana, el camino es null: no se intenta mandar', () => {
  const b = cuerpo(LIB, 'export async function caminosDeEnvio');
  // 06/10/2026: el tope pasó de 1800 a 2800 porque la función ahora decide POR LÍNEA (varios
  // números por negocio) y trae su comentario; el recorte sigue terminando en su `}`.
  assert.ok(b.length < 2800, `el recorte de caminosDeEnvio mide ${b.length}: está mirando otra cosa`);
  // La CONDICIÓN, no el objeto que cuelga de ella.
  assert.match(b, /v\?\.abierta \? \{ via: 'oficial'/, 'el camino oficial dejó de mirar si la ventana está abierta');
  assert.match(b, /: FUERA_DE_VENTANA/, 'la ventana cerrada dejó de devolver su motivo');
  // El no oficial gana cuando está vivo (no se le cambia el número al lead): la de por default
  // para un borrador sin línea, la SUYA para uno que la nombra.
  assert.match(b, /estado === 'conectado' \|\| estado === 'conectando'/);
  assert.match(b, /def && viva\(def\.estado\)/);
});

test('La ventana se vuelve a verificar al enviar, y sale por el canal que puede', () => {
  const b = cuerpo(LIB, 'export async function enviarBorradorPorSuCanal');
  assert.ok(b.length < 1200, `el recorte mide ${b.length}: está mirando otra cosa`);
  // 08/10/2026: con el audio y el archivo del borrador, que no tienen camino oficial.
  assert.match(b, /caminosDeEnvio\(\[\{ id: b\.id, telefono: b\.telefono, linea: b\.instance_name, audioId: b\.audio_id, adjuntoId: b\.adjunto_id \}\]\)/, 'el envío dejó de recalcular el camino (con la línea y la media del borrador): confía en el botón');
  assert.match(b, /camino\?\.via === 'empresa'/);
  assert.match(b, /camino\?\.via === 'oficial'/);
  // Sin camino no se manda nada y se devuelve el motivo.
  assert.match(b, /return \{ ok: false, error: camino\?\.motivo/);
  // `mandarPorOficial` NO se exporta: entrar por ahí saltearía la verificación.
  assert.doesNotMatch(LIB, /export\s+(async\s+)?function mandarPorOficial/, 'exportar mandarPorOficial abre un camino sin gate de ventana');
});

test('El envío oficial RECLAMA el borrador antes de llamar a Chatwoot', () => {
  const b = cuerpo(LIB, 'async function mandarPorOficial');
  // Mismo patrón que enviarBorrador: dos setters no le mandan dos veces al lead.
  assert.match(b, /\.update\(\{ estado: 'enviando' \}\)/);
  assert.match(b, /\.eq\('estado', 'pendiente'\)/, 'sin el claim atómico, un doble clic manda el mismo mensaje dos veces');
  // Y si Chatwoot falla, el borrador vuelve a la cola.
  assert.match(b, /update\(\{ estado: 'pendiente' \}\)/);
  // No espeja en wa_mensajes: esa tabla es el espejo del NO oficial.
  assert.doesNotMatch(b, /wa_mensajes/, 'el camino oficial no puede dejar un mensaje fantasma en el inbox de empresa');
});

test('La ruta manda por la ÚNICA puerta que verifica', () => {
  assert.match(RUTA, /enviarBorradorPorSuCanal\(id,/, 'la ruta dejó de usar la puerta que decide el canal');
  assert.doesNotMatch(RUTA, /enviarBorrador\(id,/, 'la ruta volvió a mandar por Evolution directo: el oficial queda inerte');
  assert.doesNotMatch(RUTA, /import \{[^}]*\benviarBorrador\b[^}]*\} from '@\/lib\/evolution-envio'/, 'la ruta sigue importando el envío sin gate');
  // Y el GET ofrece el camino sólo cuando se lo piden (?camino=1): sin eso,
  // cada refresco del panel de empresa pagaría una lectura de Chatwoot.
  assert.match(RUTA, /searchParams\.get\('camino'\) !== '1'/);
  assert.match(RUTA, /caminosDeEnvio\(borradores\.map/);
});
