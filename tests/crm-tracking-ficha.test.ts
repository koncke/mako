// =============================================================================
// El tracking de la ficha del lead — lo NUESTRO primero, y nombrar sin irse
// =============================================================================
// Se reportó como que el producto no mide nada: «aún no se está mostrando la
// grabación, los clicks, aún sigue redirigiendo a clarity». El recorrido YA se
// dibujaba; lo que pasaba es que se montaba SUELTO debajo de dos botones grandes
// a Clarity y de un renglón con un uuid crudo, o sea debajo del scroll.
//
// Las tres cosas de acá son decisiones de FORMA y de ORDEN, que no mira el
// compilador, y las dos primeras viven en DOS montajes que tienen que quedar
// iguales — si se toca uno solo, la misma ficha se ve distinta según por dónde se
// abra.
//
// Probado rompiéndolo, las OCHO roturas. Con el código como está: 6 pases, 0 fallos.
//   · se devuelve el <TrackingTimelineCard/> suelto al modal        → 5 / 1
//   · se devuelve el <TrackingTimelineCard/> suelto a la ruta       → 5 / 1
//   · el bloque de Clarity vuelve ARRIBA del recorrido              → 5 / 1
//   · vuelve el href="/integraciones?abrir=landing"                 → 5 / 1
//   · vuelve el uuid dibujado (<code>{visitorId}</code>)            → 5 / 1
//   · el pop-up se monta sin `anidada`                              → 5 / 1
//   · el pop-up escribe el setting por su cuenta (setSetting)       → 5 / 1
//   · la ruta deja de pasar `eventos`                               → 4 / 2
//
// La última cae DOS veces y está bien: deja el recorrido sin insumos Y rompe la
// igualdad entre las dos puertas, que son dos aserciones distintas.
//
// ⚠️ El ancla de «lo externo va después» NO puede ser la cadena `Clarity`: la
// palabra aparece en seis comentarios y en el `title` del botón que copia el id,
// así que no distingue las dos posiciones. Va en el <section>, que es código.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const crudo = (p: string) => readFileSync(join(import.meta.dirname, p), 'utf8');

/**
 * El archivo SIN sus comentarios.
 *
 * ⚠️ Hace falta: la convención de la casa es explicar en el comentario lo que se
 * sacó, así que todo test que persiga la AUSENCIA de algo encuentra su propia
 * explicación. Los de línea PRIMERO — si no, un `//` con un `/*` adentro abre un
 * bloque que se come el resto del archivo.
 */
const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (p: string) => sinComentarios(crudo(p));

const CARD = '../app/crm/lead-view/ComportamientoCard.tsx';
const MODAL = '../app/crm/lead-view/NombrarVideosModal.tsx';
const MONTAJES: Array<[string, string]> = [
  ['../app/crm/LeadSheet.tsx', 'modal'],
  ['../app/crm/[id]/page.tsx', 'ruta /crm/[id]'],
];

// ── 1 · El recorrido vive ADENTRO de la tarjeta, y en los DOS montajes ────────
test('el recorrido se monta dentro de ComportamientoCard, no suelto', () => {
  const card = leer(CARD);
  assert.ok(/<TrackingTimelineCard eventos=\{eventos\} pixelPuesto=\{pixelPuesto\} \/>/.test(card),
    'la tarjeta monta el recorrido ella misma');

  for (const [ruta, cual] of MONTAJES) {
    const f = leer(ruta);
    // ⚠️ NO PUEDEN QUEDAR LOS DOS. Si la tarjeta lo monta adentro y el montaje lo
    // sigue montando suelto, la misma ficha dibuja el recorrido dos veces.
    assert.ok(!f.includes('<TrackingTimelineCard'), `${cual}: el recorrido ya no se monta suelto`);
    assert.ok(!f.includes('TrackingTimelineCard'), `${cual}: y su import se fue con el call site`);
    // Y los insumos del recorrido viajan por la tarjeta: sin esto el recorrido
    // nace vacío y la pantalla dice «sin eventos» sobre un lead con 36.
    assert.ok(/<ComportamientoCard[^>]*\seventos=\{/.test(f), `${cual}: le pasa los eventos`);
    assert.ok(/<ComportamientoCard[^>]*\spixelPuesto=\{/.test(f), `${cual}: le pasa pixelPuesto`);
  }
});

test('los DOS montajes le pasan exactamente las mismas props', () => {
  // La ficha es la MISMA pantalla por dos puertas, y ya se pagó que una se quedara
  // con la versión anterior: en septiembre la ruta tenía las pestañas viejas
  // mientras el modal estaba al día, y al cliente que llega por el link del
  // WhatsApp le toca justo la ruta.
  const props = (ruta: string) => {
    const f = leer(ruta);
    const i = f.indexOf('<ComportamientoCard');
    assert.ok(i >= 0, `${ruta}: no encuentro el montaje`);
    const tag = f.slice(i, f.indexOf('/>', i));
    return [...tag.matchAll(/\s([a-zA-Z]+)=\{/g)].map((m) => m[1]).sort();
  };
  const [a, b] = MONTAJES.map(([ruta]) => props(ruta));
  assert.deepEqual(a, b, 'las dos puertas tienen que dibujar la misma ficha');
});

// ── 2 · Lo externo va DESPUÉS, y más chico ───────────────────────────────────
test('el bloque de Clarity va después del recorrido y no compite con él', () => {
  const card = leer(CARD);
  // El ancla va en CÓDIGO: la palabra «Clarity» aparece en los comentarios y en el
  // `title` del botón que copia el id, así que buscarla no distingue las dos
  // posiciones que este test quiere distinguir.
  const iRecorrido = card.indexOf('<TrackingTimelineCard');
  const iExterno = card.indexOf('<section style={cardExterna}>');
  assert.ok(iRecorrido >= 0, 'el recorrido');
  assert.ok(iExterno >= 0, 'el bloque externo tiene su propia caja, más chica');
  assert.ok(iExterno > iRecorrido, 'lo externo va DESPUÉS: era lo que dominaba la pantalla');

  // Y DICE dónde se abre. Sin esa frase la ficha se lee como si la app debiera
  // mostrar la grabación adentro — y no puede: Clarity responde
  // `X-Frame-Options: SAMEORIGIN` y el navegador rechaza el iframe.
  assert.ok(/Se abre en Clarity/.test(card), 'una frase corta que dice que se abre afuera');

  // Nada de embeber ni de proxiar: ya se descartó dos veces con evidencia.
  assert.ok(!/<iframe/.test(card), 'no hay iframe de Clarity, y no puede haberlo');

  // Los dos botones dejaron de ser el acento de la pantalla.
  assert.ok(!/background: 'var\(--primary-bg\)'/.test(card), 'ningún botón a Clarity pintado de acento');
});

test('el uuid del visitante queda copiable y deja de dibujarse', () => {
  const card = leer(CARD);
  // Era `<code>{visitorId}</code>` con el uuid a la vista en la ficha de una
  // PERSONA: ruido técnico que competía con el recorrido. Sigue accesible, en un
  // botón, porque el link a Clarity no llega filtrado solo.
  assert.ok(!/>\s*\{visitorId\}\s*</.test(card), 'el uuid no se dibuja');
  assert.ok(!/Su ID para el filtro de Clarity/.test(card), 'ni su renglón');
  assert.ok(/writeText\(visitorId\)/.test(card), 'pero se puede copiar');
  assert.ok(/Filtros personalizados/.test(card), 'y el title dice dónde se pega');
});

// ── 3 · El pop-up para nombrar, en la ficha ──────────────────────────────────
test('nombrar un video abre un pop-up acá mismo, no una redirección', () => {
  const card = leer(CARD);
  assert.ok(!/href="\/integraciones/.test(card), 'el link que sacaba de la ficha se fue');
  assert.ok(!/abrir=landing/.test(card), 'ni su parámetro');
  assert.ok(/<NombrarVideosModal/.test(card), 'el pop-up se monta en la ficha');
  assert.ok(/setNombrando\(true\)/.test(card), 'y lo abre un botón, no una navegación');

  const modal = leer(MODAL);
  // ⚠️ `anidada`: la ficha del lead es un overlay propio que se abstiene del Escape
  // mientras haya algo en la pila (`profundidadModales() > 0`). Sin registrarse, el
  // Escape del pop-up cerraría también la ficha — ya pasó con el selector de portada.
  assert.ok(/<Modal[\s\S]{0,200}?\sanidada\b/.test(modal), 'se registra en la pila como anidada');
  assert.ok(/createPortal\(/.test(modal), 'y se dibuja en el body, fuera de cualquier overflow');
});

test('el pop-up REUSA la escritura de /integraciones, no escribe una segunda', () => {
  const modal = leer(MODAL);
  assert.ok(/import \{ guardarVideoAction \} from '@\/app\/integraciones\/landing-actions'/.test(modal),
    'llama a la misma action');
  assert.ok(/guardarVideoAction\(\{ id, nombre, esVsl: esTipoVsl\(nombre\) \}\)/.test(modal),
    'con las MISMAS semánticas: `esVsl` explícito, o renombrar degradaría al VSL');
  // Una segunda escritura del catálogo sería un segundo lugar donde vive «un solo
  // VSL» y el saneo del id, y el que se arregle no va a ser el otro.
  assert.ok(!/setSetting|VIDEOS_KEY|conVideo\(/.test(modal), 'no toca el setting por su cuenta');
});
