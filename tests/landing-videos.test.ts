// =============================================================================
// Los videos de la landing: quién es quién
// =============================================================================
// Una landing puede tener el VSL, un testimonio y una demo. El sistema los
// DETECTA (cada evento trae su `video_id`) pero no puede saber cuál es cuál;
// eso lo declara la persona. Lo que se puede equivocar acá es el saneo, y por
// eso el módulo va sin `server-only`: un id repetido, un nombre vacío, o dos
// videos marcados como VSL a la vez.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VIDEOS,
  TIPOS_VIDEO,
  conVideo,
  esTipoVsl,
  nombreDe,
  nombrePorDefecto,
  parsearVideos,
  rotuloDe,
  sinVideo,
  unSoloVsl,
  vslDe,
  type VideoLanding,
} from '../lib/landing-videos';

const v = (id: string, nombre: string, esVsl?: boolean): VideoLanding => (esVsl ? { id, nombre, esVsl } : { id, nombre });

test('un JSON roto no rompe la pantalla: devuelve lista vacía', () => {
  for (const x of [null, '', '   ', 'no es json', '{"no":"un array"}', '[1,2,3]', '[null]']) {
    assert.deepEqual(parsearVideos(x), [], `«${x}» tendría que dar []`);
  }
});

test('sin id o sin nombre, la entrada no entra', () => {
  // Sin id no se puede atribuir un evento; sin nombre, el renglón no distingue
  // nada — que es todo lo que esta lista existe para hacer.
  const l = parsearVideos(JSON.stringify([
    { id: 'a', nombre: 'VSL' },
    { id: '', nombre: 'sin id' },
    { id: 'b', nombre: '   ' },
    { id: 'c' },
    { nombre: 'sin id tampoco' },
  ]));
  assert.deepEqual(l, [v('a', 'VSL')]);
});

test('el id es la identidad: no puede repetirse', () => {
  const l = parsearVideos(JSON.stringify([{ id: 'a', nombre: 'Uno' }, { id: 'a', nombre: 'Otro' }]));
  assert.equal(l.length, 1);
  assert.equal(l[0].nombre, 'Uno', 'gana el primero, no el último');
});

test('los nombres se sanean: espacios de más y largo', () => {
  const l = parsearVideos(JSON.stringify([{ id: '  a  ', nombre: '  Video   Testimonio  ' }]));
  assert.deepEqual(l, [v('a', 'Video Testimonio')]);
  const largo = parsearVideos(JSON.stringify([{ id: 'a', nombre: 'x'.repeat(200) }]));
  assert.equal(largo[0].nombre.length, 60, 'un nombre de 200 caracteres rompe cualquier desplegable');
});

// =============================================================================
// LA INVARIANTE QUE IMPORTA: un solo VSL
// =============================================================================
// No es cosmética. Las pantallas que hablan de «el VSL» en singular —el
// semáforo, la retención del embudo— preguntan cuál es y esperan UNA respuesta.
// Con dos marcados, cada una elegiría uno distinto según cómo ordene, y los
// números dejarían de cerrar entre sí sin que nada falle.

test('dos marcados como VSL entran como uno solo', () => {
  const l = unSoloVsl([v('a', 'A', true), v('b', 'B', true), v('c', 'C')]);
  assert.deepEqual(l.filter((x) => x.esVsl).map((x) => x.id), ['a'], 'gana el primero');
  assert.equal(l.length, 3, 'los otros no se pierden, solo dejan de ser el VSL');
});

test('la invariante también se aplica al LEER, no solo al escribir', () => {
  // Un setting escrito a mano, o por una versión vieja del código, puede traer
  // dos. Si la invariante viviera solo en el guardar, el dato roto entraría igual.
  const l = parsearVideos(JSON.stringify([
    { id: 'a', nombre: 'A', esVsl: true },
    { id: 'b', nombre: 'B', esVsl: true },
  ]));
  assert.equal(l.filter((x) => x.esVsl).length, 1);
});

test('marcar uno como VSL DESMARCA al anterior', () => {
  // Es una elección, no una etiqueta que se acumula. Si no desmarcara, marcar el
  // segundo dejaría dos y ganaría el orden — o sea, el click no haría nada visible.
  const antes = [v('a', 'A', true), v('b', 'B')];
  const despues = conVideo(antes, v('b', 'B', true));
  assert.ok(despues);
  assert.equal(vslDe(despues)?.id, 'b', 'el que se acaba de marcar es el VSL');
  assert.equal(despues.filter((x) => x.esVsl).length, 1);
  assert.ok(!despues.find((x) => x.id === 'a')?.esVsl, 'el anterior quedó desmarcado');
});

test('renombrar no toca quién es el VSL ni el orden', () => {
  const antes = [v('a', 'A'), v('b', 'B', true), v('c', 'C')];
  const despues = conVideo(antes, v('a', 'Testimonio de Ana'));
  assert.ok(despues);
  // La POSICIÓN se conserva: en un desplegable, que un renglón salte al final
  // porque le cambiaste el nombre es desconcertante.
  assert.deepEqual(despues.map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(despues[0].nombre, 'Testimonio de Ana');
  assert.equal(vslDe(despues)?.id, 'b', 'renombrar otro no le saca el título al VSL');
});

// ⚠️ EL BUG QUE ESTE TEST ENCONTRÓ (no lo encontró la pantalla). `conVideo`
// reconstruía el objeto con solo `{id, nombre}` salvo que el caller mandara
// `esVsl`, así que renombrar el VSL lo DEGRADABA en silencio: la pantalla de
// renombrar no manda ese flag porque no está preguntando eso.
// Es «cada pregunta, su campo»: contestar «cómo se llama» no puede contestar
// «cuál es el VSL» por omisión.
test('renombrar EL VSL no le saca el título', () => {
  const despues = conVideo([v('a', 'VSL', true)], v('a', 'VSL nuevo'));
  assert.equal(vslDe(despues ?? [])?.id, 'a', 'corregir el nombre no es dejar de ser el VSL');
  assert.equal(despues?.[0].nombre, 'VSL nuevo', 'y el nombre sí cambió');
});

test('esVsl tiene TRES valores: marcar, desmarcar y no tocar', () => {
  const marcado = [v('a', 'A', true)];
  // undefined = no lo toques
  assert.equal(vslDe(conVideo(marcado, { id: 'a', nombre: 'A' }) ?? [])?.id, 'a');
  // false = desmarcalo explícitamente. Sin esta salida, un VSL elegido por error
  // no se podría deselegir salvo marcando otro — y puede no haber otro.
  assert.equal(vslDe(conVideo(marcado, { id: 'a', nombre: 'A', esVsl: false }) ?? []), null);
  // true = marcalo
  assert.equal(vslDe(conVideo([v('a', 'A')], { id: 'a', nombre: 'A', esVsl: true }) ?? [])?.id, 'a');
});

test('un video nuevo se agrega al final', () => {
  const despues = conVideo([v('a', 'A')], v('b', 'B'));
  assert.deepEqual(despues?.map((x) => x.id), ['a', 'b']);
});

test('sin nombre no se guarda, y se avisa devolviendo null', () => {
  // El caller decide qué decirle a la persona; acá no se inventa un valor para no
  // fallar, que es como se cuelan las entradas basura.
  assert.equal(conVideo([], v('a', '   ')), null);
  assert.equal(conVideo([], v('', 'Sin id')), null);
});

test('la lista tiene tope', () => {
  let l: VideoLanding[] = [];
  for (let i = 0; i < MAX_VIDEOS + 5; i++) l = conVideo(l, v(`id${i}`, `Video ${i}`)) ?? l;
  assert.equal(l.length, MAX_VIDEOS);
});

test('borrar saca uno y deja el resto', () => {
  assert.deepEqual(sinVideo([v('a', 'A'), v('b', 'B')], 'a').map((x) => x.id), ['b']);
  assert.deepEqual(sinVideo([v('a', 'A')], 'no-existe').map((x) => x.id), ['a'], 'borrar lo que no está no rompe');
});

test('sin VSL elegido, vslDe dice null en vez de elegir uno', () => {
  // ⚠️ Inventar «el primero es el VSL» es exactamente el modo de falla que este
  // módulo viene a cerrar: una pantalla mostraría la retención de un testimonio
  // rotulada como la del VSL, y se vería idéntica a la correcta.
  assert.equal(vslDe([]), null);
  assert.equal(vslDe([v('a', 'A'), v('b', 'B')]), null);
});

test('un video sin nombre guardado se muestra por su id, no con un rótulo inventado', () => {
  const l = [v('a', 'VSL', true)];
  assert.equal(nombreDe(l, 'a'), 'VSL');
  // Feo pero VERDADERO. Llamarlos «Video» a secas los haría indistinguibles entre
  // sí, que es peor que un id feo: dos curvas con el mismo rótulo no se comparan.
  assert.equal(nombreDe(l, 'zzz'), 'zzz');
  assert.equal(nombreDe(l, null), 'Video sin identificar');
  assert.equal(nombreDe(l, ''), 'Video sin identificar');
});

test('el rótulo del CRM: nombre puesto > título del player > id cortado', () => {
  const l = [v('abc', 'Testimonio de Ana', true)];
  // 1. El nombre que puso la persona gana siempre, y viene marcado como propio.
  assert.deepEqual(rotuloDe(l, 'abc', 'Titulo del iframe'), { texto: 'Testimonio de Ana', propio: true, esVsl: true });
  // 2. Sin nombre guardado, el título del player. `propio: false` es lo que le
  //    permite a la pantalla ofrecer ponerle uno: sin esa marca, un título
  //    inferido se ve idéntico a uno elegido y nadie sabe que falta algo.
  assert.deepEqual(rotuloDe(l, 'zzz', '  Mi VSL  '), { texto: 'Mi VSL', propio: false, esVsl: false });
  // 3. Sin nada, el id CORTADO — un UUID de Panda entero vuelve ilegible la ficha.
  //    Pero sigue siendo el id: dos videos que se llamen «Video» no se comparan,
  //    que es todo lo que la pantalla existe para hacer.
  const r = rotuloDe(l, '4f2b8c1e-aaaa-bbbb-cccc-1234567890ab');
  assert.equal(r.texto, 'Video 4f2b8c1e…');
  assert.equal(r.propio, false);
  assert.equal(rotuloDe(l, 'corto').texto, 'Video corto', 'un id corto se muestra entero');
  // 4. Sin id no hay nada que rotular, y se dice.
  assert.equal(rotuloDe(l, null).texto, 'Video sin identificar');
  assert.equal(rotuloDe(l, null, '   ').texto, 'Video sin identificar', 'un título en blanco no es un título');
});

test('el nombre ES la respuesta a «cuál es el VSL»: una pregunta, no dos', () => {
  // La alternativa era un desplegable para el nombre y aparte un control «marcar
  // como VSL»: dos controles para una decisión, y el segundo se queda sin
  // contestar porque no se entiende qué agrega.
  assert.ok(esTipoVsl('VSL'));
  assert.ok(esTipoVsl('vsl'), 'sin distinguir mayúsculas');
  assert.ok(esTipoVsl('Mi VSL'));
  assert.ok(esTipoVsl('VSL de ventas'));
  assert.ok(esTipoVsl('  VSL  '), 'los espacios de más no cambian la respuesta');
  // Palabra suelta: lo que se busca es la palabra, no la secuencia de letras.
  assert.ok(!esTipoVsl('Testimonio'));
  assert.ok(!esTipoVsl('Demo del producto'));
  assert.ok(!esTipoVsl('VSLuego'), 'una palabra que la contiene no la declara');
  assert.ok(!esTipoVsl(''));
  // El primer tipo del catálogo es el VSL: es el que más se elige y va arriba.
  assert.ok(esTipoVsl(TIPOS_VIDEO[0]));
  assert.equal(TIPOS_VIDEO.filter(esTipoVsl).length, 1, 'solo UNO de los tipos ofrecidos puede declarar el VSL');
});

test('el nombre por defecto usa el título del player si lo hay', () => {
  assert.equal(nombrePorDefecto('  Mi   VSL ', 1), 'Mi VSL');
  assert.equal(nombrePorDefecto(null, 2), 'Video 2');
  assert.equal(nombrePorDefecto('   ', 3), 'Video 3');
});

test('lo que se guarda vuelve a leerse igual (ida y vuelta por JSON)', () => {
  // La lista viaja como texto en `app_settings`. Si el saneo de lectura y el de
  // escritura no coinciden, el dato se degrada de a poco en cada guardada.
  const original = conVideo(conVideo([], v('a', 'VSL', true)) ?? [], v('b', 'Testimonio')) ?? [];
  assert.deepEqual(parsearVideos(JSON.stringify(original)), original);
});

// =============================================================================
// CABLEADO — que exista no es que se use
// =============================================================================
// Este repo ya pagó dos veces la misma factura: `curvaRetencion` acepta un
// `videoId` desde hace meses y NADIE se lo pasa; `urlsDescubiertas` existe y se
// usa, pero su gemela para videos no existía. Un módulo con tests verdes y cero
// call-sites se ve exactamente igual que uno que funciona.

import { readFileSync } from 'node:fs';
const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('CABLEADO: el CRM desglosa la retención por video', () => {
  // 1. El dato: getVslEngagement tiene que AGRUPAR, no hacer un solo Math.max.
  const leads = leer('../lib/leads.ts');
  assert.ok(/porVideo: VideoEngagement\[\]/.test(leads), 'VslEngagement tiene que traer el desglose');
  assert.ok(/const porVideo = new Map<string, VideoEngagement>/.test(leads), 'sin agrupar, el desglose sería el mismo número repetido');

  // 2. ⚠️ LA TRAMPA QUE ESTO CIERRA: el respaldo de «la única duración conocida»
  //    era incondicional. Con dos videos le aplicaba al testimonio de 40 s la
  //    duración del VSL de 20 min y su avance daba ~0% para siempre — un
  //    porcentaje inventado que se ve igual que uno correcto.
  assert.ok(/function resolverDuracion/.test(leads), 'la duración se resuelve sabiendo cuántos videos hay en juego');
  assert.ok(/hayUnoSolo \? unica : null/.test(leads), 'el respaldo tiene que CHEQUEAR que haya un solo video antes de asumirlo');
  assert.ok(!/durs\.size === 1 \? \[\.\.\.durs\.values\(\)\]\[0\] : null;\s*\n\}/.test(leads), 'volvió el respaldo incondicional');

  // 3. La pantalla, en los DOS call-sites: la ruta y el modal. Cablear uno solo
  //    deja la mitad de la app mostrando el número fundido, y son la misma ficha.
  //    ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026 (la ficha por bloques): las dos puertas montan la MISMA
  //    ficha (`FichaPorBloques`) y la tarjeta se monta UNA vez, en el registro de Tracking. Así no se
  //    puede cablear «uno solo»: se fija el único montaje y que las dos puertas lo usen.
  for (const p of ['../app/crm/[id]/LeadDetailBody.tsx', '../app/crm/LeadSheet.tsx']) {
    assert.ok(/<FichaPorBloques\b/.test(leer(p)), `${p}: no monta la ficha compartida`);
  }
  {
    const p = '../app/crm/lead-view/ficha/registro-tracking.tsx';
    const s = leer(p);
    assert.ok(/porVideo=\{vslEng\.porVideo\}/.test(s), `${p}: no le pasa el desglose a la tarjeta`);
    assert.ok(/videos=\{data\.videos\}/.test(s), `${p}: sin el catálogo, los videos se rotulan con el id`);
  }

  // 4. Y la tarjeta tiene que DEJAR DE pintar «Retención del VSL» en singular
  //    cuando hay varios: ese rótulo sobre el máximo de todos es la mentira.
  const card = leer('../app/crm/lead-view/ComportamientoCard.tsx');
  assert.ok(/\{!varios && \(/.test(card), 'con varios videos el número único no se puede seguir mostrando');
  assert.ok(/Retención por video/.test(card), 'falta el desglose');
});

test('CABLEADO: se puede nombrar cada video desde la app', () => {
  // El dueño no le pasa nada al cliente: si el nombre no se pone desde la
  // pantalla, la función no existe para quien la necesita.
  const panel = leer('../app/integraciones/ProbarTracking.tsx');
  assert.ok(/<NombrarVideos/.test(panel), 'el panel de la landing tiene que ofrecer nombrarlos');

  const ui = leer('../app/integraciones/NombrarVideos.tsx');
  assert.ok(/guardarVideoAction\(\{ id, nombre, esVsl: esTipoVsl\(nombre\) \}\)/.test(ui), 'el nombre y el VSL se contestan juntos, y esVsl va SIEMPRE explícito');
  // ⚠️ SIN LOS COMENTARIOS. Este repo ya tropezó cuatro veces con lo mismo: un
  // test que lee el fuente hace match con el comentario que EXPLICA la regla
  // («el <select> nativo está prohibido») y falla sobre código que la cumple.
  // Lo que se busca es lo que se ejecuta, no lo que está escrito al lado.
  const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g, '');
  const codigo = sinComentarios(ui);
  assert.ok(/from '@\/app\/_ui'/.test(codigo), 'los controles salen del sistema de diseño');
  // ⚠️ SIN el flag `i`, y no es un detalle: en JSX la mayúscula ES la diferencia
  // entre el elemento del DOM y el componente. Con `/i` esta aserción prohibía
  // justo el `<Select>` de la casa que viene a exigir.
  assert.ok(!/<select[\s>]/.test(codigo), 'el <select> nativo está prohibido: va el Select de la casa');
  assert.ok(/<Select\b/.test(codigo), 'y el de la casa tiene que estar');

  // Y el server tiene que poder decir QUÉ videos hay, o el desplegable está vacío.
  const token = leer('../lib/landing-token.ts');
  assert.ok(/export async function videosDetectados/.test(token), 'sin detección no hay nada que nombrar');
  const route = leer('../app/api/integraciones/landing/estado/route.ts');
  assert.ok(/videosDetectados: detectados, videos: guardados/.test(route), 'la pantalla no puede leer lo que la ruta no expone');
});
