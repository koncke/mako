import test from 'node:test';
import assert from 'node:assert/strict';

import { mediaDeFlow, esFiltroDeCara, pareceFraseParaPersona } from '../lib/flow-media';
import { detalleFiltroDeCara, accionFiltroDeCara, textoFlow } from '../lib/flow-fallo-texto';

// =============================================================================
// Leer el estado de UN medio dentro de una respuesta de Flow
// =============================================================================
// El molde de abajo NO está inventado: es la forma exacta de la respuesta que
// recibió una clienta el 02/09/2026, sacada de `flow_trabajos.resultado` del
// trabajo 583 y podada a lo que el lector mira. Los dos medios son HERMANOS y el
// segundo —la imagen del escenario— viaja en TODAS las consultas.

const CLIP = '108dc579-6f5e-4838-8691-c0d7a023541b';
const IMAGEN = '68a5ae6c-50cc-4b6d-890a-37bb81b23603';

/** La respuesta real: el clip rechazado por la cara, la imagen bien. */
const RESPUESTA_REAL = {
  media: [
    {
      name: CLIP,
      video: { operation: { name: CLIP }, dimensions: { length: '10s' } },
      mediaMetadata: {
        visibility: 'FILTERED',
        mediaStatus: {
          error: { code: 3, message: 'PUBLIC_ERROR_UNSAFE_GENERATION' },
          failureReasons: ['IDENTIFIABLE_PERSON_SAFETY'],
          mediaGenerationStatus: 'MEDIA_GENERATION_STATUS_FAILED',
        },
      },
    },
    {
      name: IMAGEN,
      video: { operation: { name: IMAGEN } },
      mediaMetadata: {
        visibility: 'PRIVATE',
        mediaStatus: { mediaGenerationStatus: 'MEDIA_GENERATION_STATUS_SUCCESSFUL' },
        mediaBlobSize: '4030059',
      },
    },
  ],
  remainingCredits: 898,
};

test('lee el estado del medio PROPIO, no el del hermano', () => {
  const m = mediaDeFlow(RESPUESTA_REAL, CLIP);
  assert.ok(m);
  assert.equal(m.estado, 'fallo');
  assert.equal(m.razon, 'IDENTIFIABLE_PERSON_SAFETY');
});

test('el hermano de la misma respuesta se lee aparte y da lo suyo', () => {
  const m = mediaDeFlow(RESPUESTA_REAL, IMAGEN);
  assert.ok(m);
  assert.equal(m.estado, 'ok');
  assert.equal(m.razon, '', 'un medio que salió bien no puede traer motivo de fallo');
});

test('⚠️ el caso invertido: el clip BIEN y el hermano mal no lo marca rechazado', () => {
  // Es el bug que el lector viejo tenía vivo. Regexeaba `MEDIA_GENERATION_STATUS_FAILED`
  // sobre el JSON entero, así que un fallo de CUALQUIER medio de la respuesta
  // condenaba al que se estaba mirando. Y no da error: la pantalla afirma que
  // Google rechazó un clip del que Google no dijo nada.
  const invertida = {
    media: [
      {
        name: CLIP,
        mediaMetadata: {
          mediaStatus: { mediaGenerationStatus: 'MEDIA_GENERATION_STATUS_SUCCESSFUL' },
          fifeUrl: 'https://ejemplo/clip.mp4',
        },
      },
      {
        name: IMAGEN,
        mediaMetadata: {
          mediaStatus: {
            failureReasons: ['IDENTIFIABLE_PERSON_SAFETY'],
            mediaGenerationStatus: 'MEDIA_GENERATION_STATUS_FAILED',
          },
        },
      },
    ],
  };
  const m = mediaDeFlow(invertida, CLIP);
  assert.ok(m);
  assert.equal(m.estado, 'ok');
  assert.equal(m.url, 'https://ejemplo/clip.mp4');
});

test('⚠️ la url del hermano NUNCA se devuelve como propia', () => {
  // El modo de falla más caro de los dos: no da error, da una toma que reproduce
  // la imagen fija del escenario. Se ve como un clip.
  const conUrlAjena = {
    media: [
      { name: CLIP, mediaMetadata: { mediaStatus: { mediaGenerationStatus: 'MEDIA_GENERATION_STATUS_SUCCESSFUL' } } },
      { name: IMAGEN, mediaMetadata: { fifeUrl: 'https://ejemplo/LA-IMAGEN.png' } },
    ],
  };
  const m = mediaDeFlow(conUrlAjena, CLIP);
  assert.ok(m);
  assert.equal(m.url, '', 'se llevó la url del escenario como si fuera el video');
});

test('el id que vive DOS veces no confunde: gana el nodo de arriba', () => {
  // `media[i].name` y `media[i].video.operation.name` son el mismo id. El de
  // adentro cuelga de `video`, que no tiene al lado ni estado ni url: entrar por
  // ahí devuelve vacío, y vacío se lee como «esta respuesta no lo menciona».
  const m = mediaDeFlow(RESPUESTA_REAL, CLIP);
  assert.ok(m);
  assert.notEqual(m.estado, 'en_curso', 'entró por el nodo de adentro y se quedó sin el estado');
});

test('una respuesta que no menciona el medio devuelve null, no «en curso»', () => {
  // Son dos situaciones distintas: «no habla de esto» y «todavía no terminó».
  // Colapsarlas deja a la pantalla esperando sobre respuestas de otras tomas.
  assert.equal(mediaDeFlow(RESPUESTA_REAL, 'un-id-que-no-esta'), null);
  assert.equal(mediaDeFlow(null, CLIP), null);
  assert.equal(mediaDeFlow(RESPUESTA_REAL, ''), null);
});

test('sin estado declarado, es «en curso» y no un fallo', () => {
  const m = mediaDeFlow({ media: [{ name: CLIP, mediaMetadata: {} }] }, CLIP);
  assert.ok(m);
  assert.equal(m.estado, 'en_curso');
});

// ── El filtro de la cara ───────────────────────────────────────────────────

test('la familia del filtro de cara tiene DOS miembros, no uno', () => {
  // Es lo que dejó a una clienta reescribiendo un guion que estaba bien: el
  // detector sólo conocía `PROMINENT_PERSON`.
  assert.ok(esFiltroDeCara('PROMINENT_PERSON'));
  assert.ok(esFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY'));
  assert.ok(esFiltroDeCara('prominent_people_filter_failed'));
});

test('y no se come lo que SÍ es del texto', () => {
  // `PUBLIC_ERROR_UNSAFE_GENERATION` a secas es del prompt: ahí reescribir SÍ es
  // el camino, y mandarla a regenerar la imagen sería el error espejo.
  assert.ok(!esFiltroDeCara('PUBLIC_ERROR_UNSAFE_GENERATION'));
  assert.ok(!esFiltroDeCara(''));
});

// ── Lo que se puede pintar como frase ──────────────────────────────────────

test('el JSON de Google no se pinta como mensaje, ni recortado', () => {
  assert.ok(!pareceFraseParaPersona('{"media":[{"name":"108dc579-6f5e-4838"'));
  assert.ok(!pareceFraseParaPersona('  [{"error":1}]'));
  assert.ok(!pareceFraseParaPersona('algo antes … "mediaGenerationStatus":"FAILED" … algo después'));
});

test('una instrucción de verdad sí se pinta', () => {
  assert.ok(pareceFraseParaPersona(
    'Todavía no vi a Google Flow generar un video con tu foto de referencia. Abre Flow y genera uno a mano.',
  ));
  assert.ok(!pareceFraseParaPersona(''), 'una cadena vacía no es una frase');
});

// ── El mensaje que se lee ──────────────────────────────────────────────────

test('un rechazo por la cara NO manda a reescribir el guion', () => {
  // Es el daño exacto que se midió: dos tomas rechazadas por
  // `IDENTIFIABLE_PERSON_SAFETY` salían como «hay que reescribirlo», sobre un
  // guion que estaba bien.
  const t = detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY');
  // ⚠️ La aserción mira la INSTRUCCIÓN, no la palabra: el copy correcto nombra
  // reescribir para DESCARTARLO («reescribirlo no cambia nada»), y prohibir la
  // palabra a secas rechazaba justo el texto que arregla el bug.
  assert.doesNotMatch(t, /hay que reescrib/i, 'sigue mandando a reescribir el guion');
  assert.match(t, /reescribirlo no cambia nada/i, 'no descarta el camino equivocado');
  assert.match(t, /imagen del escenario/, 'no nombra lo único que destraba');
  assert.match(t, /no cuesta créditos/i, 'no dice que el camino es gratis');
});

test('y no le inventa a nadie que se parece a un famoso', () => {
  // Los dos filtros son distintos y decir el equivocado afirma un hecho sobre la
  // cara de una persona que nadie midió.
  assert.doesNotMatch(detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY'), /famoso|públicas/i);
  assert.match(detalleFiltroDeCara('PROMINENT_PERSON'), /famoso/i);
  assert.doesNotMatch(detalleFiltroDeCara(''), /famoso|reconocibles/i,
    'sin motivo reconocido no se elige un filtro: se dice lo que se sabe');
});

test('textoFlow no pinta un volcado aunque se lo pasen', () => {
  // La segunda capa. El parámetro ya se usó mal tres veces, así que la guarda
  // vive del lado del que muestra y no de cada llamador.
  const crudo = '{"media":[{"name":"108dc579-6f5e-4838-8691-c0d7a023541b","video":{"operation"';
  const t = textoFlow('contenido', 'la toma 10', undefined, undefined, crudo);
  assert.doesNotMatch(t.detalle, /\{"media"/, 'le dibujó el JSON de Google a una persona');
  assert.match(t.detalle, /filtro de contenido/i, 'y encima se quedó sin mensaje');
});

test('pero sí respeta la instrucción que escribió el server', () => {
  const frase = 'Todavía no vi a Google Flow generar un video con tu foto. Abre Flow y genera uno a mano.';
  const t = textoFlow('puente', 'la toma 3', undefined, undefined, frase);
  assert.ok(t.detalle.includes(frase), 'tiró la única parte accionable del mensaje');
});

// ── Cuando el mismo motivo se repite ───────────────────────────────────────

test('en el primer rechazo el mensaje consuela, y está bien', () => {
  const t = detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 1);
  assert.match(t, /suele pasar/i);
  assert.doesNotMatch(t, /intentos seguidos/i);
});

test('⚠️ a partir del segundo deja de consolar y DICE EL NÚMERO', () => {
  // Medido el 02/09/2026: una clienta acumuló 17 rechazos seguidos con el mismo
  // motivo, sobre la misma imagen, y la pantalla le decía «suele pasar» en el
  // intento 17 igual que en el primero. Un mensaje que consuela en el primer fallo
  // MIENTE en el décimo, y quien lo lee no tiene cómo saber que ya no aplica.
  const t = detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 17);
  assert.match(t, /17 intentos seguidos/, 'no dice cuántas veces van');
  assert.match(t, /volver a filmar no lo va a destrabar/i, 'no descarta el camino que no sirve');
  assert.match(t, /imagen del escenario/, 'no nombra el único camino que queda');
});

test('y el remedio sigue estando, no se lo come el aviso', () => {
  // La escalada no puede reemplazar la instrucción: alguien en el intento 17 es
  // justo quien más necesita leer qué hacer.
  const t = detalleFiltroDeCara('PROMINENT_PERSON', 9);
  assert.match(t, /no cuesta créditos/i);
  assert.match(t, /otra foto tuya/i);
});

// ── De quién es la culpa ───────────────────────────────────────────────────
//
// Martín: «si el problema NO lo tenemos nosotros, NO asumir la culpa. Incluso
// dejar bien en claro quién es el culpable. Si no, los usuarios piensan que MaKo
// falló». Y acá está medido de las dos puntas: la clienta reprodujo el rechazo
// A MANO en su propio Google Flow, con la misma imagen.

test('⚠️ un rechazo de Google NOMBRA a Google, en todas sus variantes', () => {
  for (const [razon, seguidos, probada] of [
    ['IDENTIFIABLE_PERSON_SAFETY', 1, 0],
    ['IDENTIFIABLE_PERSON_SAFETY', 9, 0],
    ['PROMINENT_PERSON', 1, 4],
    ['', 3, 0],
  ] as [string, number, number][]) {
    const t = detalleFiltroDeCara(razon, seguidos, probada);
    assert.match(t, /GOOGLE|Google/, `«${razon}» ${seguidos}/${probada} no dice quién se negó`);
  }
});

test('y NUNCA se lee como que falló MaKo', () => {
  // Un mensaje que arranca por la instrucción se lee como que algo de acá se
  // rompió. El nombre de MaKo sólo puede aparecer para DESCARTARLO.
  const t = detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 1, 0);
  assert.doesNotMatch(t, /MaKo (no pudo|falló|se equivocó)/i);
  assert.match(t, /no MaKo|salió bien de aquí/i, 'no deja claro que el pedido salió bien de acá');
});

test('dice que el intento no se cobra, que es lo que frena el miedo', () => {
  // Medido de las dos puntas: 26 generaciones y los créditos quedaron en 898, y
  // el propio Google Flow escribe «no se te ha cobrado por esta generación».
  assert.match(detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 1, 0), /no te cobra/i);
});

test('⚠️ con la imagen PROBADA no manda a rehacer la imagen', () => {
  // Es el error que costó una hora: la misma imagen había filmado nueve tomas y
  // el mensaje mandaba a regenerarla — o sea a arreglar lo único que ya funciona.
  const t = detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 17, 9);
  assert.match(t, /otras 9 tomas/, 'no dice que la imagen ya está probada');
  assert.doesNotMatch(t, /generar esa imagen otra vez/i, 'sigue mandando a rehacer la imagen');
  assert.match(t, /reescribir esta línea/i, 'no nombra lo único que queda por probar');
});

test('y el BOTÓN cambia con ella: la etiqueta viaja con la acción', () => {
  // Este repo ya pagó un botón que decía «Revisar el puente» y gastaba 15
  // créditos, porque el rótulo salía de la causa y el onClick de otro lado.
  assert.match(accionFiltroDeCara(0), /escenario/i);
  assert.match(accionFiltroDeCara(9), /reescribir/i);
  assert.notEqual(accionFiltroDeCara(0), accionFiltroDeCara(9));
});

test('con UNA sola toma probada el plural no se rompe', () => {
  assert.match(detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 1, 1), /otra toma/);
  assert.doesNotMatch(detalleFiltroDeCara('IDENTIFIABLE_PERSON_SAFETY', 1, 1), /otras 1/);
});
