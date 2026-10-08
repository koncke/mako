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
// ⚠️ EL ORDEN DE LAS TRES SECCIONES ES DE MARTÍN, textual (05/10/2026): «la primera
// sección debe ser "Origen del lead" y luego "Comportamiento" y por ultimo "Actividad
// registrada"». La noche del 04 se había puesto al revés con una medición de píxeles
// como argumento —el recorrido a 798,5 px del tope sobre 583 visibles—, y la medición
// era cierta y contestaba otra pregunta. Lo que este archivo fija ahora son DOS cosas
// distintas que se habían fundido en una: el orden que él pidió, y que lo EXTERNO
// (Clarity) siga último, que es lo que el reporte original vino a cerrar.
//
// Probado rompiéndolo, las DIECISIETE roturas, con un arnés que muta un archivo, corre
// el test y lo restaura DESDE MEMORIA (nunca `git checkout --`: en este clon se llevaría
// trabajo sin commitear de otra sesión). Con el código como está: 12 pases, 0 fallos.
//
//   · el recorrido vuelve ARRIBA de la sección «Comportamiento»     → 11 / 1
//   · el modal vuelve a montar <OrigenCard> DESPUÉS de la tarjeta   → 11 / 1
//   · la ruta vuelve a montar <OrigenCard> DESPUÉS de la tarjeta    → 11 / 1
//   · la tarjeta vuelve a mapear `porVideo` en vez de `filas`       → 11 / 1
//   · `varios` vuelve a contar `porVideo.length`                    → 11 / 1
//   · la fila del balde pierde su rama propia                       → 11 / 1
//   · el pop-up recibe `porVideo` crudo en vez de `filas`           → 11 / 1
//   · el pop-up copia el predicado a mano                           → 11 / 1
//   · filaDeRetencionInforma dice true para el balde vacío          → 11 / 1
//   · filaDeRetencionInforma dice false para el balde CON plays     → 11 / 1
//   · videoNombrable dice true sin videoId                          → 10 / 2
//   · vuelve el router.push del deep-link ?solucionar=1             → 10 / 2
//   · se le saca `completarDatos` al diálogo                        → 10 / 2
//   · se le saca `faltantes` al diálogo                             → 11 / 1
//   · `onDone` cierra la ficha también al completar datos           → 11 / 1
//   · se saca el stopPropagation que aísla el wizard                → 11 / 1
//   · la ruta deja de pasar `eventos`                               → 10 / 2
//
// Las cuatro que caen DOS veces están bien y dicen algo: `videoNombrable` y
// `completarDatos` los miran dos tests distintos (el que EJECUTA el predicado y el
// cableado; el del modal y el de la paridad con la ruta), y `eventos` deja el recorrido
// sin insumos Y rompe la igualdad entre las dos puertas.
//
// ⚠️ TRES MUTACIONES DIERON «NO MUTÓ» EN LA PRIMERA CORRIDA, y el arnés lo habría dejado
// pasar como si el test fuera flojo: `core.autocrlf=true` deja este árbol MEZCLADO entre
// archivos —LeadSheet.tsx y ComportamientoCard.tsx son CRLF, page.tsx y este test son
// LF— y las anclas con `\n` no calzan en un archivo CRLF. El arnés detecta el salto del
// archivo que va a mutar y convierte sus propias anclas a ÉSE.
//
// Las cuatro roturas de la tanda anterior (el recorrido suelto en cada montaje, Clarity
// arriba, el href a /integraciones, el uuid dibujado, el pop-up sin `anidada`, el pop-up
// escribiendo el setting) siguen cubiertas por los tests de abajo.
//
// ⚠️ El ancla de «lo externo va después» NO puede ser la cadena `Clarity`: la
// palabra aparece en seis comentarios y en el `title` del botón que copia el id,
// así que no distingue las dos posiciones. Va en el <section>, que es código.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Los dos predicados del balde se EJECUTAN acá: un guard que sólo los nombre en el
// fuente contesta «¿está enchufado?», nunca «¿hace lo que dice?».
import { filaDeRetencionInforma, videoNombrable } from '../lib/landing-videos';

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

// ── 1b · El orden que pidió Martín: Origen → Comportamiento → Actividad ──────
test('la pestaña se lee de dónde vino → qué hizo → evento por evento', () => {
  // Las anclas van en CÓDIGO, no en los rótulos: «Origen del lead» y «Actividad
  // registrada» viven en los componentes y acá se decide el ORDEN DE MONTAJE, que es
  // otra cosa. Y los comentarios están fuera (`leer`), porque los dos montajes
  // explican este mismo orden en prosa y el test encontraría su propia explicación.
  for (const [ruta, cual] of MONTAJES) {
    const f = leer(ruta);
    const iOrigen = f.indexOf('<OrigenCard');
    const iComp = f.indexOf('<ComportamientoCard');
    assert.ok(iOrigen >= 0, `${cual}: falta Origen del lead`);
    assert.ok(iComp >= 0, `${cual}: falta la tarjeta de comportamiento`);
    assert.ok(iOrigen < iComp, `${cual}: «Origen del lead» va PRIMERO — lo decidió Martín`);
  }

  // Y adentro de la tarjeta, «Actividad registrada» va último de lo nuestro. El ancla
  // de la sección «Comportamiento» es su estilo: `card` se usa una sola vez acá, y la
  // caja de lo externo tiene el suyo (`cardExterna`), así que las dos no se confunden.
  const card = leer(CARD);
  const iComportamiento = card.indexOf('<section style={card}>');
  const iRecorrido = card.indexOf('<TrackingTimelineCard');
  assert.ok(iComportamiento >= 0, 'la sección «Comportamiento» tiene su caja');
  assert.ok(iRecorrido >= 0, 'el recorrido');
  assert.ok(iComportamiento < iRecorrido, '«Actividad registrada» va DESPUÉS de «Comportamiento»');
});

// ── 2 · Lo externo va DESPUÉS, y más chico ───────────────────────────────────
// PROBADO ROMPIENDOLO: devolviendo «Se abre en Clarity» al JSX de la tarjeta,
// este test falla.
test('ya no hay nada «fuera de MaKo»: la ficha no manda a Clarity', () => {
  // ⚠️ ESTA SECCIÓN FIJABA LO CONTRARIO HASTA EL 06/10/2026: que el bloque de
  // Clarity fuera DESPUÉS del recorrido y más chico, que dijera «Se abre en
  // Clarity», y que el id del visitante quedara copiable para pegarlo en su filtro.
  // Todo eso se fue con Clarity entero: la grabación la hace MaKo y se mira en la
  // misma ficha. Lo que se fija ahora es que no vuelva.
  const card = leer(CARD);
  assert.ok(!/Fuera de MaKo/.test(card), 'volvió la sección de lo externo');
  assert.ok(!/Se abre en Clarity|Mapa de calor de la página/.test(card), 'volvió un link al panel de Clarity');
  assert.ok(!/writeText\(visitorId\)/.test(card), 'volvió el botón para pegar el id en el filtro de otra herramienta');
  // Y lo que se descartó dos veces con evidencia sigue descartado.
  assert.ok(!/<iframe/.test(card), 'no hay iframe de nada externo');
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

// ── 4 · El BALDE: ni se nombra ni se dibuja vacío ─────────────────────────────
// Dos pedidos de Martín en la misma frase (05/10/2026): «sigue sin dejarme poner de
// que video es el "Video sin identificar" y en caso de que ya no haya video para
// identificar, porque solo hay 1, está mal que aparezca eso allí».
//
// Lo medido: el balde es la entrada que `getVslEngagement` crea para las filas de
// `vsl_events` SIN `video_id` —la clave `''` del mapa, con `videoId: null`—. Y esa
// consulta no filtra por tipo, así que ahí caen también los eventos de la PÁGINA
// (pageview, click, scroll, salio, volvio, cierre): todos sin id, y todos descartados
// por `avanceDe` vía `esEventoDeVideo`. O sea `plays: 0, maxPct: null` para cualquier
// lead que haya visitado la landing, al lado de su video real.
//
// Las ocho roturas que cubren esto están en la tabla de arriba.

test('el balde vacío no informa nada, y el balde con plays sí', () => {
  // Un video concreto se dibuja SIEMPRE, aunque nadie lo haya reproducido: es un
  // video de la página, y «nadie lo vio» es un dato.
  assert.equal(filaDeRetencionInforma({ videoId: 'abc', plays: 0, maxPct: null }), true, 'un video con id siempre se dibuja');
  // El balde vacío es el renglón fantasma que se reportó.
  assert.equal(filaDeRetencionInforma({ videoId: null, plays: 0, maxPct: null }), false, 'sin id, sin plays y sin avance no dice nada');
  // Y las mediciones reales de antes de la v5 del snippet NO se esconden.
  assert.equal(filaDeRetencionInforma({ videoId: null, plays: 3, maxPct: null }), true, 'reproducciones sin atribuir siguen siendo plays');
  assert.equal(filaDeRetencionInforma({ videoId: null, plays: 0, maxPct: 42 }), true, 'un avance medido tampoco se tira');
});

test('nombrable es tener un id, y nada más', () => {
  // El balde no tiene id y no lo va a tener: `getVslEngagement` lo inicializa en null
  // y no lo escribe nunca. Ofrecerle un nombre es invitar a algo imposible.
  assert.equal(videoNombrable({ videoId: 'abc', plays: 0, maxPct: null }), true);
  assert.equal(videoNombrable({ videoId: null, plays: 9, maxPct: 80 }), false, 'con plays sigue sin tener contra qué guardar');
});

test('la tarjeta y el pop-up miran el MISMO universo', () => {
  const card = leer(CARD);
  const modal = leer(MODAL);

  // Un solo filtro, y todo lo de abajo cuelga de él. Recortar en un lugar y contar en
  // otro es lo que dejaba `varios` en true con un video solo — y con eso desaparecía
  // el minicard «Retención del VSL» y se dibujaba un desglose de uno.
  assert.ok(/const filas = porVideo\.filter\(filaDeRetencionInforma\)/.test(card), 'el balde se filtra una vez, con el predicado compartido');
  assert.ok(/const varios = filas\.length > 1/.test(card), '«varios» cuenta lo que se dibuja, no lo que llegó');
  assert.ok(/filas\.map\(\(v\) => <FilaVideo/.test(card), 'la lista se dibuja desde `filas`');
  assert.ok(/entre \{filas\.length\} videos/.test(card), 'y el contador también');
  assert.ok(/porVideo=\{filas\}/.test(card), 'y el pop-up recibe el mismo universo');
  // Ningún camino puede seguir leyendo la lista cruda: ahí está el balde.
  assert.ok(!/porVideo\.length/.test(card), 'nada cuenta `porVideo` crudo');
  assert.ok(!/porVideo\.map\(/.test(card), 'nada mapea `porVideo` crudo');
  assert.ok(!/porVideo\.some\(/.test(card), 'ni lo recorre para decidir la oferta');

  // Y las dos puntas usan el predicado, no una copia escrita a mano.
  assert.ok(/filas\.filter\(videoNombrable\)/.test(card), 'la oferta de nombrar usa el predicado');
  assert.ok(/porVideo\.filter\(videoNombrable\)/.test(modal), 'y el pop-up, el mismo');

  // La fila del balde deja de rotularse como algo a identificar: ése era el rótulo que
  // invitaba a apretar («Video sin identificar»), y no hay nada que apretar.
  assert.ok(/const balde = !videoNombrable\(v\)/.test(card), 'la fila sabe si es el balde');
  assert.ok(/Reproducciones sin identificar/.test(card), 'y lo dice como lo que es');
  assert.ok(/no se pueden nombrar/.test(card), 'con la frase que explica por qué no hay botón');
});

// ── 5 · «Solucionar» se resuelve en el MODAL, sin irse a otra ruta ────────────
// Pedido textual (05/10/2026): «el botón de "Solucionar" debería permitirme solucionar
// allí mismo, sin redirigirme a otra ruta, en el mismo modal». Antes navegaba a
// `/crm/<id>?solucionar=1` (o a `?edit=1&tab=…` según qué faltara): cerraba el modal y
// cargaba otra pantalla para abrir el MISMO wizard que el modal ya monta.
//
// No hay una segunda escritura: el wizard es el único que marca los datos del
// worklist, y es exactamente lo que hace la ruta (`setMoveTo(currentStage)`).
//
// Las cinco roturas que cubren esto están en la tabla de arriba.

test('«Solucionar» abre el wizard en la ficha, no una navegación', () => {
  const sheet = leer('../app/crm/LeadSheet.tsx');

  // La navegación se fue, y con ella los deep-links que la armaban.
  assert.ok(!/solucionar=1/.test(sheet), 'el deep-link que sacaba de la ficha se fue');
  assert.ok(!/solucionarHref/.test(sheet), 'ni la variable que lo armaba');
  assert.ok(!/tab=cobranza&ia=1/.test(sheet), 'ni el desvío a Cobranza');

  // Lo que queda es el wizard, acá mismo, sobre la etapa ACTUAL — que es lo que lo
  // convierte en «Completar datos» en vez de un movimiento.
  assert.ok(/const solucionar = \(\) => setMoveTo\(stageKey\)/.test(sheet), 'Solucionar abre el wizard sobre la etapa actual');
  assert.ok(/onSolucionar=\{solucionar\}/.test(sheet), 'y es lo que el aviso dispara');
  assert.ok(/const completandoDatos = moveTo === stageKey/.test(sheet), 'la condición de «completar» es una sola');
  assert.ok(/completarDatos=\{completandoDatos\}/.test(sheet), 'el diálogo tiene que saberlo');
  assert.ok(/faltantes=\{completandoDatos \? faltantes : undefined\}/.test(sheet), 'con la lista autoritativa del server');

  // Y al terminar, la ficha SE QUEDA: cerrarla sería la redirección que esto vino a
  // sacar. Mover de etapa sí la cierra — la tarjeta ya no vive en esa columna.
  // (Y desde el 08/10/2026, si se queda, se RELEE: con la foto vieja, el próximo «Solucionar» abría
  // el wizard con la etapa de antes — tests/ficha-se-relee.test.ts.)
  assert.ok(/if \(quedarse\) releer\(\); else onClose\(\)/.test(sheet), 'completar datos no puede cerrar la ficha');

  // ⚠️ Y el click del fondo del wizard no puede cerrar la ficha de atrás. El wizard se
  // monta DENTRO del overlay, que tiene `onClick={onClose}`, y en React los eventos
  // suben por el árbol de COMPONENTES: un portal no lo evitaría.
  assert.ok(/<div onClick=\{\(e\) => e\.stopPropagation\(\)\}>\s*<StageMoveDialog/.test(sheet), 'el wizard va aislado del backdrop de la ficha');
});

test('la ruta y el modal resuelven «Solucionar» igual', () => {
  // Es la MISMA ficha por dos puertas. Lo que no puede pasar es que una abra el wizard
  // y la otra navegue: ya se pagó que una se quedara con la versión anterior.
  const puertas: Array<[string, string]> = [
    ['../app/crm/LeadSheet.tsx', 'modal'],
    ['../app/crm/[id]/LeadDetailBody.tsx', 'ruta /crm/[id]'],
  ];
  for (const [ruta, cual] of puertas) {
    const f = leer(ruta);
    assert.ok(/setMoveTo\((stageKey|currentStage)\)/.test(f), `${cual}: Solucionar abre el wizard sobre la etapa actual`);
    assert.ok(/completarDatos=\{/.test(f), `${cual}: y lo abre en modo «completar datos»`);
  }
});
