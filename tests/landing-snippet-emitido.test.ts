// =============================================================================
// El snippet EMITIDO — no el que se lee en el fuente
// =============================================================================
// El snippet vive adentro de un template literal, y ahí el fuente y lo que
// termina pegado en la página del cliente NO son el mismo texto. Esa diferencia
// ya produjo dos bugs vivos en producción, los dos invisibles leyendo el código:
//
//   · `\s` dentro del template no es la clase «espacio»: es la letra «s». El
//     snippet servido hacía `.replace(/s+/g, ' ')` y le borraba TODAS las eses al
//     texto de los botones. «¿Qué pasa después de agendar una llamada?» le
//     llegaba al dueño como «¿Qué pa a de pué de agendar una». Estuvo así desde
//     la v6, a la vista en el panel, leyéndose como un texto cortado.
//
//   · el snippet SE DELATA A SÍ MISMO. Va pegado en la página del cliente, y el
//     analizador de piezas busca marcas —`cal.com`, `pandavideo`, `<video`— para
//     decidir qué chequeos pedirle a esa landing. Una marca escrita en un
//     comentario del snippet convierte a toda landing con el Pixel puesto en una
//     landing que «tiene» algo que no tiene. Ya pasó con `<video` y `<button`
//     (por eso existe `sinRuido`), y volvió a pasar el 24/08/2026 al documentar
//     el soporte de agendas: el comentario nombraba el dominio que el detector
//     persigue.
//
// Estos tests miran el texto EMITIDO, que es el único que le llega al cliente.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);

const fuente = () =>
  readFileSync(new URL('../lib/landing-token.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/**
 * El snippet tal cual sale, aplicando las reglas de escape del template literal.
 *
 * Se recorta del fuente en vez de importar `landingSnippet()` a propósito: esa
 * función pide el token y la base de la app, o sea la mitad del entorno, y lo
 * que estos tests cuidan es el TEXTO — no hace falta arrancar nada.
 */
function snippetEmitido(): string {
  const s = fuente();
  const desde = s.indexOf('return ' + BT + '<script>');
  const hasta = s.indexOf('</script>' + BT + ';', desde);
  assert.ok(desde > 0 && hasta > desde, 'no se encontró el template del snippet');
  const tpl = s.slice(desde + ('return ' + BT).length, hasta);
  const mapa: Record<string, string> = { n: '\n', t: '\t', r: '\r', [BS]: BS, [BT]: BT, $: '$' };
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] === BS && i + 1 < tpl.length) {
      const sig = tpl[i + 1];
      // Un escape que JS no conoce pierde la barra: así `\s` se vuelve `s`.
      out += mapa[sig] ?? sig;
      i++;
    } else out += tpl[i];
  }
  return out;
}

test('ningún regex del snippet perdió su barra invertida en el template', () => {
  const gen = snippetEmitido();
  // La clase de espacios tiene que llegar ENTERA. Si el fuente escribió `\s` con
  // una sola barra, acá aparece `/s+/` y le come las eses al texto del cliente.
  assert.ok(
    !/[^\\]\/s\+\//.test(gen.replace(/\/\/[^\n]*/g, '')),
    'quedó un /s+/ sin barra: eso borra las letras «s» del texto de los botones',
  );
  assert.ok(
    gen.includes('/' + BS + 's+/g'),
    'el snippet tiene que emitir /' + BS + 's+/g para normalizar los espacios',
  );

  // La regla general, por si mañana entra un `\d` o un `\w`: dentro del template
  // toda clase de regex se escribe con DOS barras.
  //
  // ⚠️ Se miran SOLO los regex literales, y por contexto: buscar `[s]` en todo el
  // texto marcaba `e.seg[s]` —indexar un array— como si fuera una clase. Un test
  // que grita por código sano es un test que se termina apagando.
  const codigo = gen.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Las dos formas en que aparece un regex literal: como argumento —`.replace(/…/g`—
  // y como sujeto —`/…/i.test(x)`—. Con solo la primera se escapaban la mitad.
  const literales = [
    ...(codigo.match(/(?:\.(?:replace|test|match|split|exec|search)\(|=\s*|\(\s*)\/(?:[^/\n\\]|\\.)+\/[gimsuy]*/g) ?? []),
    ...(codigo.match(/\/(?:[^/\n\\]|\\.)+\/[gimsuy]*\.(?:test|exec)\(/g) ?? []),
  ];
  assert.ok(literales.length >= 2, `solo se encontraron ${literales.length} regex en el snippet: el extractor quedó viejo`);
  for (const lit of literales) {
    const cuerpo = lit.slice(lit.indexOf('/') + 1, lit.lastIndexOf('/'));
    for (const c of ['s', 'd', 'w', 'S', 'D', 'W', 'b']) {
      assert.ok(
        !new RegExp('(^|[^\\\\])[\\[(]?' + c + '[+*{]').test(cuerpo),
        `el regex ${lit} usa «${c}» donde parece que se quiso escribir \\${c}: ` +
        'adentro del template esa clase va con DOS barras, si no matchea la letra',
      );
    }
  }
});

test('el snippet no se delata a sí mismo ante el analizador de piezas', async () => {
  const gen = snippetEmitido();
  // ⚠️ Las que se leen del BUNDLE son las que no tienen red: `sinRuido` limpia
  // los <script> del HTML, pero al JavaScript propio de la página no lo filtra
  // nadie. Una marca de estas adentro del snippet es un falso positivo para
  // cualquier cliente que lo copie a su código.
  //
  // ⚠️⚠️ LA LISTA SE IMPORTA, NO SE COPIA. Acá había una copia a mano de cuatro
  // entradas de `DEL_BUNDLE`, y omitía justo `video-panda` — que era la única
  // marca que el snippet sí contenía (`/pandavideo/i` en `tituloVsl`). O sea que
  // el test escrito para cazar esto era estructuralmente incapaz de cazarlo, y la
  // landing del ws13, que copia el código a un archivo propio, salía con un
  // «video de Panda» que no tiene. Medido con el analizador real el 11/09/2026.
  //
  // Importándola, un detector nuevo entra solo: el día que se agregó Wistia, esta
  // guarda ya lo vigilaba sin que nadie tocara el test.
  const { DEL_BUNDLE } = await import('../lib/landing-analisis');
  for (const [pieza, re] of DEL_BUNDLE) {
    const m = gen.match(re);
    assert.ok(
      !m,
      `el snippet contiene «${m?.[0]}», que el analizador lee como «${pieza}». ` +
      'Escribilo sin la marca: si viaja pegado en la página del cliente, toda landing ' +
      'con el Pixel puesto va a parecer tener esa pieza.',
    );
  }
});

test('la agenda embebida tiene camino propio: el submit del formulario no alcanza', () => {
  const gen = snippetEmitido();
  // El caso del ws13 (24/08/2026): la reserva ocurre DENTRO de un iframe de otro
  // dominio, así que el listener de `submit` del documento del cliente no se
  // dispara nunca. Si este handler vuelve a atarse a un solo proveedor, la
  // conversión de todo negocio que vende por llamada se pierde en silencio.
  assert.ok(/originator/.test(gen), 'falta reconocer el postMessage del otro proveedor de agendas');
  assert.ok(/bookingSuccessful/.test(gen), 'falta el evento de reserva confirmada');
  assert.ok(/calendly\.event_scheduled/.test(gen), 'no se puede perder el soporte que ya había');
  // Y la reserva tiene que poder crear el lead, no solo el evento: para quien
  // vende por llamada, esa reserva ES el contacto.
  assert.ok(
    /function mandarOptin/.test(gen) && (gen.match(/mandarOptin\(/g) ?? []).length >= 3,
    'mandarOptin tiene que existir y usarse desde los DOS caminos (formulario y agenda)',
  );
});

test('un video lo mide UNA rama sola, no dos', () => {
  // ⚠️ EL CASO QUE ESTO FIJA, medido en producción el 27/09/2026. El snippet tiene
  // dos enganches que pueden ver el MISMO custom element: el propio del reproductor
  // (lo reconoce por su forma: mediaId + percentWatched) y el genérico, que acepta a
  // cualquier elemento con API de media. Los dos escuchan play/pause/time-update en
  // CAPTURA sobre document, así que los dos lo medían — y con dos ids distintos, uno
  // por el nombre de la etiqueta y otro por el id del media.
  //
  // En el VSL de un cliente real eso dio 348 plays con un id y 348 con el otro, los
  // 348 pares dentro de 2 segundos: las reproducciones al doble y la curva de
  // retención partida entre dos videos que la pantalla no sabía que eran el mismo.
  // Se reportó como «no está trackeando bien la retención del VSL».
  //
  // Probado rompiéndolo (con el arreglo puesto, 5 pasan y 0 fallan):
  //   · se saca el guard (vuelve el doble conteo)        -> 4 pasan / 1 falla
  //   · el guard se pregunta DESPUÉS de registrar        -> 4 / 1
  //
  // No alcanza con mirar el fuente: este archivo mira lo EMITIDO, que es lo único
  // que le llega a la página del cliente.
  const gen = snippetEmitido();
  const i = gen.indexOf('function hostDeMedia');
  assert.ok(i > 0, 'no está el enganche genérico por elemento');
  const fin = gen.indexOf('function alEventoDeHost', i);
  assert.ok(fin > i, 'no se pudo acotar el cuerpo de hostDeMedia');
  const cuerpo = gen.slice(i, fin);

  // 1) Consulta a la rama propia antes de quedarse con el elemento.
  const guard = cuerpo.indexOf('wisHost(t)');
  assert.ok(
    guard > 0,
    'el enganche genérico no le pregunta a la rama propia si ese elemento ya es suyo: ' +
    'vuelve el doble conteo, con dos ids para el mismo video',
  );

  // 2) Y lo consulta ANTES de registrarlo. Preguntar después no evita nada: el
  //    elemento ya quedó en HOSTS y ya tiene su id propio colgado.
  const push = cuerpo.indexOf('HOSTS.push(t)');
  assert.ok(push > 0, 'hostDeMedia tiene que registrar el host en HOSTS');
  assert.ok(guard < push, 'la pregunta por el dueño va ANTES de registrar el elemento');

  // 3) Y la rama propia sigue existiendo: si desaparece, el guard de arriba pasa a
  //    ser una condición que nunca es verdadera y nadie se entera.
  assert.ok(
    /function wisHost\(/.test(gen) && /percentWatched/.test(gen),
    'la rama propia del reproductor tiene que seguir reconociéndolo por su forma',
  );
});

test('el scroll se mide, y SIEMPRE con freno', () => {
  // ⚠️ EL FRENO ES LO QUE SE CUIDA ACÁ, no que el evento exista. El `scroll` del
  // navegador se dispara por cada pixel que se mueve la página: un `enviar()`
  // adentro del handler son cientos de requests por visita desde la página de un
  // cliente, y el que los recibe es nuestro beacon. Eso no se ve en una prueba a
  // mano —una landing corta manda cuatro y parece sano— y se ve en la factura.
  //
  // Dos frenos, los dos verificados: el handler agenda y sale (no calcula nada), y
  // sólo se manda al CRUZAR un hito que no se mandó todavía.
  //
  // Probado rompiéndolo (con el arreglo puesto, 7 pasan y 0 fallan):
  //   · el handler llama a mirarScroll() directo, sin setTimeout  -> 6 pasan / 1 falla
  //   · se saca el guard `h > scrollHito` (manda en cada mirada)  -> 6 / 1
  //   · se saca 'scroll' de CONOCIDOS en el route                 -> 6 / 1
  const gen = snippetEmitido();

  // 1) Se mide, y por el MISMO camino que los clics (enviar(), que es donde se le
  //    pega el token, la página y el marcador de prueba).
  assert.ok(/tipo_evento: 'scroll'/.test(gen), 'el snippet no manda ningún evento de scroll');
  assert.ok(/function profundidadScroll/.test(gen), 'falta la medición de hasta dónde bajó la persona');

  // 2) El handler del evento del navegador NO manda: agenda.
  const i = gen.indexOf("addEventListener('scroll'");
  assert.ok(i > 0, 'el snippet no escucha el scroll');
  const cuerpo = gen.slice(i, gen.indexOf('}', gen.indexOf('scrollTimer = setTimeout', i)));
  assert.ok(
    !/enviar\(/.test(cuerpo),
    'el handler de scroll manda el evento en línea: eso es un request por pixel scrolleado',
  );
  assert.ok(
    /setTimeout/.test(cuerpo) && /if \(scrollTimer\) return/.test(cuerpo),
    'falta el freno: el handler tiene que agendar UNA mirada y salir si ya hay una agendada',
  );

  // 3) Y el envío sólo ocurre al cruzar un hito nuevo. Sin este guard, cada mirada
  //    (una cada 400 ms mientras la persona scrollea) manda un evento igual.
  assert.ok(
    /h > scrollHito/.test(gen),
    'falta el guard del hito: sin él se manda un evento cada 400 ms de scroll',
  );
  assert.ok(/HITOS_SCROLL = \[25, 50, 75, 100\]/.test(gen), 'los hitos del scroll cambiaron de forma');
});

test('el beacon conoce el evento de scroll', () => {
  // El snippet y el receptor son DOS archivos, y el receptor tiene lista blanca:
  // un tipo que no está en CONOCIDOS se guarda como 'desconocido'. O sea que el
  // snippet puede medir perfecto y el dato llegar con un nombre que ninguna
  // pantalla busca. Ya pasó con los eventos de página, que se guardaron bien y la
  // ficha del lead los disfrazaba de retención de video.
  const route = readFileSync(new URL('../app/api/track/vsl/route.ts', import.meta.url), 'utf8');
  const linea = /const CONOCIDOS = \[([^\]]*)\]/.exec(route)?.[1] ?? '';
  assert.ok(
    linea.includes("'scroll'"),
    "el route no acepta 'scroll': el evento entra como 'desconocido' y el dato queda mudo",
  );
});

test('el token no viaja en una línea con cara de secreto (v23)', () => {
  // El editor con IA de un cliente tapaba el código con ******** al pegarlo (08/10/2026),
  // y lo único con cara de secreto era `var TOKEN = 'mko_…'`: una palabra de las que
  // buscan los detectores pegada a un valor de alta entropía. El token es público; sólo
  // tiene que no parecerse a un secreto.
  //
  // PROBADO ROMPIÉNDOLO (09/10/2026): con la declaración renombrada a `var API_ID` →
  // 18 pass / 1 fail (éste), con 19 / 0 antes.
  const valor = 'mko_' + 'd4'.repeat(16);
  const gen = snippetEmitido().split('${token}').join(valor);
  const conValor = gen.split('\n').filter((l) => l.includes(valor));
  assert.equal(conValor.length, 1, 'el token aparece en más de un lugar del snippet');
  assert.doesNotMatch(conValor[0], /token|key|secret|api|auth/i, `la línea del token tiene una palabra que tapan los detectores: ${conValor[0].trim()}`);
  assert.match(conValor[0], /^\s*var CUENTA = 'mko_[0-9a-f]+';$/);
  assert.ok(!/\bvar TOKEN\b/.test(gen), 'volvió `var TOKEN`');
  // Y ninguna asignación del snippet con esas palabras lleva un literal largo.
  assert.doesNotMatch(gen, /\b\w*(?:token|key|secret|auth)\w*\s*[=:]\s*['"][^'"\n]{16,}['"]/i);
});

test('la versión del snippet sube junto con su renglón de novedades', () => {
  // Un cliente al que se le pide repegar el código sin decirle qué gana no lo
  // repega. `novedadesDesde()` arma ese texto leyendo NOVEDADES.
  const s = fuente();
  const v = Number(/export const SNIPPET_VERSION = (\d+);/.exec(s)?.[1]);
  assert.ok(Number.isFinite(v) && v > 0, 'no se pudo leer SNIPPET_VERSION');
  assert.ok(
    new RegExp('^\\s*' + v + ':\\s', 'm').test(s),
    `SNIPPET_VERSION es ${v} y no hay un renglón ${v}: en NOVEDADES: quien lo tenga viejo ` +
    'va a recibir «mejoras de medición», que no le dice qué gana repegando',
  );
});

// ── El PUNTO del clic (snippet v20) ─────────────────────────────────────────────
// Lo que estos cuatro cuidan es que el clic llegue DIBUJABLE. Hasta la v19 el
// snippet guardaba a dónde iba cada clic y nunca en qué punto se hizo, así que el
// dato servía para el embudo y el mapa de calor era imposible — y encima descartaba
// los clics que no son botón ni enlace, que es justo lo que un mapa de calor llama
// «clic al vacío» y lo más informativo que tiene.

test('el clic viaja con SU PUNTO, y el punto es de la PÁGINA', () => {
  // Probado rompiéndolo (con el arreglo puesto, 11 pasan y 0 fallan):
  //   · se saca `ancho_ventana` del enviar()                       -> 10 pasan / 1 falla
  //   · el punto se mide con clientX/clientY sin sumar el scroll   -> 10 / 1
  //   · se saca el guard del (0,0)                                 -> 10 / 1
  const gen = snippetEmitido();

  // 1) Las CUATRO medidas viajan. Un par (x, y) solo no se puede pintar: sin el
  //    ancho de la ventana, un punto de un celular no se puede ubicar sobre la
  //    captura de un escritorio y el mapa sale corrido sin que nadie sepa por qué.
  for (const campo of ['clic_x', 'clic_y', 'ancho_ventana', 'alto_pagina']) {
    assert.ok(
      new RegExp(campo + ': ').test(gen),
      `el clic no manda ${campo}: sin las cuatro, el punto no se puede dibujar sobre la página`,
    );
  }

  // 2) Y la posición es de la PÁGINA, no de la ventana. Con la posición en la
  //    ventana, el mismo clic sobre el mismo botón da un número distinto según
  //    cuánto había bajado la persona: los puntos salen apilados arriba.
  const i = gen.indexOf('function puntoDelClic');
  assert.ok(i > 0, 'no está la función que mide el punto del clic');
  const cuerpo = gen.slice(i, gen.indexOf('function accionable', i));
  assert.ok(cuerpo.length > 300 && cuerpo.length < 3000, `el recorte quedó en ${cuerpo.length}: está mirando otra cosa`);
  assert.ok(/pageX/.test(cuerpo) && /pageY/.test(cuerpo), 'el punto tiene que salir de la posición en la PÁGINA');
  assert.ok(
    /clientX[\s\S]{0,160}pageXOffset/.test(cuerpo) && /clientY[\s\S]{0,160}pageYOffset/.test(cuerpo),
    'el respaldo de clientX/clientY tiene que sumarle el scroll: si no, en una página scrolleada el punto sale corrido',
  );

  // 3) El (0,0) NO es un punto: es lo que reporta un clic disparado por código (el
  //    propio sitio llamando a click(), un cartel de cookies que se cierra solo).
  //    Dejarlo pasar le pone al mapa una mancha fija en la esquina que nadie hizo.
  assert.ok(
    /if \(!px && !py\) return null;/.test(cuerpo),
    'falta descartar el (0,0): un clic sintético pinta una mancha en la esquina de arriba a la izquierda',
  );
});

test('el clic al VACÍO entra, con tipo propio y sin una letra del elemento', () => {
  // Probado rompiéndolo (con el arreglo puesto, 11 pasan y 0 fallan):
  //   · el clic al vacío sale como tipo_evento 'click'            -> 10 pasan / 1 falla
  //   · etiquetaDe devuelve el innerText del elemento             -> 10 / 1
  //   · vuelve el `return` que descartaba lo que no es accionable ->  8 / 3
  //     (ése cae en los tres guards nuevos a la vez, que es lo correcto: sin la rama
  //      no hay tipo propio, no hay tope propio y no queda un enviar() con el punto)
  const gen = snippetEmitido();
  const i = gen.indexOf("addEventListener('click'");
  assert.ok(i > 0, 'el snippet no escucha los clics');
  const bloque = gen.slice(i, gen.indexOf('}, true);', i));
  assert.ok(bloque.length > 1000 && bloque.length < 7000, `el recorte quedó en ${bloque.length}: está mirando otra cosa`);

  // 1) Entra, y con tipo PROPIO. No alcanza con una marca adentro del 'click': todo
  //    lo que hoy cuenta 'click' —el chequeo «hace clic en tus botones», el pulso de
  //    la página, el recorrido del lead— cuenta llamados a la acción del negocio, y
  //    un toque en una foto no es uno. Con una marca, ese chequeo se pondría verde
  //    porque alguien tocó una imagen.
  const tipos = new Set(bloque.match(/tipo_evento: '[a-z_]+'/g) ?? []);
  assert.deepEqual(
    tipos,
    new Set(["tipo_evento: 'click'", "tipo_evento: 'clic_vacio'"]),
    'el handler de clics tiene que emitir DOS tipos distintos: el accionable y el que cae al vacío',
  );

  // 2) ⚠️ PRIVACIDAD. Un clic al vacío cae muchas veces sobre un campo del
  //    formulario YA COMPLETADO, y el texto de esa zona es el nombre, el mail o el
  //    teléfono de quien está mirando. Lo único que viaja es la ETIQUETA (DIV, IMG,
  //    INPUT), que dice todo lo que el mapa necesita y no identifica a nadie.
  const desde = bloque.indexOf('if (!accionable(el))');
  assert.ok(desde > 0, 'no está la rama del clic al vacío');
  const rama = bloque.slice(desde, bloque.indexOf("tipo_evento: 'clic_vacio'"));
  assert.ok(rama.length > 100 && rama.length < 2500, `el recorte de la rama quedó en ${rama.length}: está mirando otra cosa`);
  assert.ok(
    !/innerText|textContent/.test(rama),
    'la rama del clic al vacío lee el texto del elemento: si el clic cae sobre un campo lleno, eso son los datos de la persona',
  );
  const e = gen.indexOf('function etiquetaDe');
  assert.ok(e > 0, 'no está la función que nombra el elemento del clic al vacío');
  const cuerpoEtiqueta = gen.slice(e, gen.indexOf("document.addEventListener('click'", e));
  assert.ok(cuerpoEtiqueta.length > 80 && cuerpoEtiqueta.length < 1200, `el recorte quedó en ${cuerpoEtiqueta.length}`);
  assert.ok(
    /tagName/.test(cuerpoEtiqueta) && !/innerText|textContent|\.value/.test(cuerpoEtiqueta),
    'etiquetaDe tiene que mandar SOLO la etiqueta del elemento, nunca su texto ni el valor de un campo',
  );
});

test('el clic al vacío tiene su PROPIO tope, y no le come el presupuesto al del embudo', () => {
  // ⚠️ ESTO ES LO QUE SE CUIDA ACÁ, no que el evento exista. El tope de 40 por carga
  // está desde la v6 por algo: una visita larga, o un doble toque repetido, manda
  // cientos de eventos a NUESTRO beacon desde la página de un cliente. Los clics al
  // vacío son muchísimo más frecuentes que los CTA —gente tocando fotos, títulos,
  // precios—, así que con un presupuesto compartido una visita que toca doce fotos
  // se queda sin lugar para el clic que ES el embudo.
  //
  // Probado rompiéndolo (con el arreglo puesto, 11 pasan y 0 fallan):
  //   · los dos comparten el contador CLICKS                  -> 10 pasan / 1 falla
  //   · se saca la salida temprana con los dos topes agotados  -> 10 / 1
  const gen = snippetEmitido();
  const i = gen.indexOf("addEventListener('click'");
  const bloque = gen.slice(i, gen.indexOf('}, true);', i));

  assert.ok(/VACIOS >= 12/.test(bloque), 'falta el tope propio de los clics al vacío: una visita larga puede mandar cientos');
  assert.ok(/CLICKS >= 40/.test(bloque), 'se perdió el tope de los clics accionables');
  assert.ok(
    /VACIOS\+\+/.test(bloque) && /CLICKS\+\+/.test(bloque),
    'cada tope necesita su propio contador: con uno solo, los toques al vacío le comen el presupuesto al clic del embudo',
  );
  // Y con los dos agotados el handler sale sin medir: leer el alto del documento
  // fuerza al navegador a recalcular el layout, y eso no se paga por un clic que no
  // se va a mandar.
  assert.ok(
    /if \(CLICKS >= 40 && VACIOS >= 12\) return;/.test(bloque),
    'falta la salida temprana con los dos presupuestos agotados: mide el documento en cada clic para nada',
  );
});

test('el beacon conoce el clic al vacío, y guarda el punto sin inventarlo', () => {
  // El snippet y el receptor son DOS archivos, y el receptor tiene lista blanca: un
  // tipo que no está en CONOCIDOS se guarda como 'desconocido'. Un snippet que mide
  // perfecto y un route que no guarda la columna son el mismo dato perdido, una capa
  // más abajo.
  //
  // Probado rompiéndolo (con el arreglo puesto, 11 pasan y 0 fallan):
  //   · se saca 'clic_vacio' de CONOCIDOS                   -> 10 pasan / 1 falla
  //   · se saca `ancho_ventana` del insert                  -> 10 / 1
  //   · pixel() acota con Math.min en vez de devolver null  -> 10 / 1
  const route = readFileSync(new URL('../app/api/track/vsl/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

  const linea = /const CONOCIDOS = \[([^\]]*)\]/.exec(route)?.[1] ?? '';
  assert.ok(
    linea.includes("'clic_vacio'"),
    "el route no acepta 'clic_vacio': el evento entra como 'desconocido' y el dato queda con un nombre que ninguna pantalla busca",
  );

  for (const col of ['clic_x', 'clic_y', 'ancho_ventana', 'alto_pagina']) {
    assert.ok(
      new RegExp('^\\s*' + col + ': pixel\\(', 'm').test(route),
      `el route no escribe ${col}: el snippet la manda y se tira en el insert`,
    );
  }

  // ⚠️ FUERA DE RANGO VA NULL, NO EL TOPE. Acotar un 999999 a 500000 pone un punto
  // en un lugar donde nadie hizo clic, y un punto inventado en un mapa de calor es
  // indistinguible de uno real.
  const i = route.indexOf('const pixel =');
  assert.ok(i > 0, 'no está el saneador del punto del clic');
  const cuerpo = route.slice(i, route.indexOf(';', route.indexOf('Math.round', i)) + 1);
  assert.ok(cuerpo.length > 80 && cuerpo.length < 400, `el recorte quedó en ${cuerpo.length}: está mirando otra cosa`);
  assert.ok(/v >= 0/.test(cuerpo) && /v <= max/.test(cuerpo), 'pixel() tiene que acotar el rango antes de aceptar el número');
  assert.ok(
    /: null/.test(cuerpo) && !/Math\.min|Math\.max/.test(cuerpo),
    'pixel() recorta en vez de descartar: un número fuera de rango acotado inventa un punto que nadie tocó',
  );
});

// ── El GRABADOR de sesión (snippet v21) ─────────────────────────────────────────
// Lo que estos seis cuidan no es que el grabador exista: es que no pueda hacer daño.
// Va pegado en la página de un tercero, graba a personas que nunca aceptaron nada con
// nosotros, y no se puede volver a tocar. Las decisiones viven en lib/replay-contrato.ts;
// acá se comprueba que el texto que le llega al cliente las cumpla.

/** El snippet sin comentarios: lo único que de verdad se ejecuta. */
function codigoEmitido(): string {
  return snippetEmitido().replace(/\/\/[^\n]*/g, '');
}

test('el grabador se baja APARTE, y si no baja la landing sigue midiendo', async () => {
  // ⚠️ ESTO ES EL ARREGLO DEL PROBLEMA MÁS CARO DEL PIXEL, y se puede deshacer sin
  // que nada falle. El snippet queda congelado en el HTML de un tercero —medido el
  // 05/10/2026: el workspace con 7.052 visitas corre la v14 y la actual es la 21—, así
  // que inlinear la librería acá sería congelar el grabador para siempre.
  //
  // Probado rompiéndolo (con el arreglo puesto, 17 pasan y 0 fallan):
  //   · la URL de la librería se escribe relativa, sin APP_BASE_URL  -> 16 pasan / 1 falla
  //   · se saca el onerror del <script>                              -> 16 / 1
  //   · la visita se manda al FINAL del IIFE, no en la primera línea -> 16 / 1
  const gen = snippetEmitido();
  const cod = codigoEmitido();

  // 1) La librería NO está adentro: lo que hay es un <script> que la trae.
  assert.ok(
    /createElement\('script'\)/.test(cod) && /\.src = RLIB_A \+ v \+ RLIB_B;/.test(cod),
    'el grabador tiene que entrar por un <script> externo, no inlineado en el snippet',
  );

  // 2) ⚠️ LA URL VA ABSOLUTA. La ruta del contrato es relativa (`/replay/<v>/r.js`) y
  //    el snippet vive en el dominio del CLIENTE: pegada tal cual, el navegador la
  //    buscaría en su sitio y daría 404 en todas las landings.
  assert.ok(
    /var RLIB_A = '\$\{APP_BASE_URL\}/.test(cod),
    'la URL de la librería no arranca en APP_BASE_URL: relativa, el navegador la busca en el dominio del cliente',
  );

  // 3) Y la FORMA de la ruta sale del CONTRATO, no escrita de nuevo acá. Las dos
  //    mitades son interpolaciones, así que lo que se comprueba es de dónde salen:
  //    el valor no está en el template, está en el fuente que lo arma.
  const { rutaDeLibreria } = await import('../lib/replay-contrato');
  const [antes, despues] = rutaDeLibreria(7777777).split('7777777');
  assert.ok(antes && despues, 'rutaDeLibreria cambió de forma: el snippet la parte por el número de versión');
  assert.ok(
    cod.includes("var RLIB_A = '${APP_BASE_URL}${libAntes}'") && cod.includes("var RLIB_B = '${libDespues}'"),
    `la ruta de la librería tiene que interpolarse partida; el contrato dice ${antes}<v>${despues}`,
  );
  assert.ok(
    /const \[libAntes, libDespues\] = rutaDeLibreria\(SENAL\)\.split\(String\(SENAL\)\);/.test(fuente()),
    'las dos mitades de la ruta no salen de rutaDeLibreria(): escritas a mano se separan del contrato sin que nada falle',
  );

  // 4) Si no baja, NO PASA NADA MÁS. Una landing no puede dejar de registrar visitas
  //    porque no bajó una librería.
  assert.ok(/s\.onerror = function \(\) \{ Rparado = true; \};/.test(cod), 'el <script> del grabador no maneja el onerror');
  assert.ok(
    /s\.onload = function \(\) \{ try \{ replayGrabar\(\); \} catch \(e\) \{ Rparado = true; \} \};/.test(cod),
    'el arranque del grabador tiene que estar en try/catch: una excepción ahí no puede tocar el resto del Pixel',
  );

  // 4bis) ⚠️ QUE EL <script> CARGUE NO ES QUE LA LIBRERÍA ESTÉ. Un 404 que el router
  //    sirve como HTML dispara `onload` perfectamente y no define nada, así que se
  //    pregunta por el GLOBAL. Es la misma regla que el reproductor ya cumple del
  //    otro lado (lib/replay-reproductor.ts), y acá importa más: sin ella se acuña
  //    el id de sesión y se cuelgan los listeners de una grabación que no existe.
  assert.ok(
    /var grabar = \(window\.rrweb && window\.rrweb\.record\) \|\| window\.rrwebRecord;/.test(cod) &&
      /if \(typeof grabar !== 'function'\) return;/.test(cod),
    'el grabador tiene que preguntar por el global de la librería, no por el onload del <script>',
  );

  // 5) Y la visita ya salió ANTES. El bloque del grabador va al final del IIFE a
  //    propósito: todo esto es un IIFE y una excepción adentro mata lo que viene
  //    después, así que lo peor que puede pasar es que no grabe.
  const visita = gen.indexOf("tipo_evento: 'pageview'");
  const grabador = gen.indexOf('var RLOTE =');
  assert.ok(visita > 0 && grabador > visita, 'el bloque del grabador tiene que ir DESPUÉS del envío de la visita');
});

test('maskAllInputs llega en TRUE, viene del contrato, y no se puede bajar', async () => {
  // ⚠️ rrweb trae maskAllInputs en FALSE: de fábrica tapa la contraseña y nada más, o
  // sea que manda el teléfono, el mail y el nombre que la persona está tecleando,
  // carácter por carácter, antes de que apriete enviar. Clarity los tapa en sus tres
  // modos: el default de la librería es PEOR que la herramienta que esto reemplaza.
  //
  // Probado rompiéndolo (con el arreglo puesto, 17 pasan y 0 fallan):
  //   · el snippet escribe sus opciones a mano en vez de interpolar el contrato -> 16 pasan / 1 falla
  //   · se agrega `o.maskAllInputs = false;` después de copiar ROPT             -> 16 / 1
  //   · el contrato pasa maskAllInputs a false                                  -> 16 / 1
  const cod = codigoEmitido();
  const { REPLAY_OPCIONES_RRWEB } = await import('../lib/replay-contrato');

  // 1) El contrato lo dice, y es lo PRIMERO que dice.
  assert.equal(REPLAY_OPCIONES_RRWEB.maskAllInputs, true, 'el contrato tiene que arrancar con maskAllInputs en true');
  assert.equal(
    Object.keys(REPLAY_OPCIONES_RRWEB)[0], 'maskAllInputs',
    'maskAllInputs va PRIMERO en el contrato: es la primera línea de lo que el grabador recibe',
  );

  // 2) El snippet las INTERPOLA, no las escribe. Copiadas a mano, el día que el
  //    contrato cambie el snippet va a seguir mandando las de antes.
  assert.ok(
    /var ROPT = \$\{JSON\.stringify\(REPLAY_OPCIONES_RRWEB\)\};/.test(cod),
    'las opciones del grabador tienen que salir del contrato interpolado, nunca escritas en el snippet',
  );

  // 3) ⚠️ Y NO SE PUEDEN BAJAR DESDE NINGÚN LADO. El servidor manda el permiso para
  //    grabar; las opciones de privacidad no viajan por la red. Si un día lo hicieran,
  //    algún día van a venir mal.
  for (const clave of ['maskAllInputs', 'maskInputOptions', 'maskTextSelector', 'blockClass']) {
    assert.ok(
      !new RegExp(clave).test(cod),
      `el código del snippet nombra ${clave}: las opciones sólo pueden existir adentro del contrato interpolado`,
    );
  }

  // 4) Lo único que se lee de la respuesta del server es la VERSIÓN de la librería.
  const i = cod.indexOf('function replayArrancar');
  assert.ok(i > 0, 'no está la función que arranca el grabador');
  const cuerpo = cod.slice(i, cod.indexOf('appendChild(s);', i));
  assert.ok(cuerpo.length > 100 && cuerpo.length < 1200, `el recorte quedó en ${cuerpo.length}: está mirando otra cosa`);
  const campos = new Set((cuerpo.match(/cfg(?:\s*&&\s*cfg)?\.\w+/g) ?? []).map((s) => s.split('.').pop()));
  assert.deepEqual(campos, new Set(['v']), 'de la respuesta del server sólo se puede leer la versión de la librería');
});

test('los números del grabador son los del CONTRATO, no copias', async () => {
  // ⚠️ El grabador, el receptor y el reproductor no se ven entre sí, y un número
  // distinto en cualquiera de los tres rompe al otro EN SILENCIO: un tope de lote más
  // chico del lado del server descarta la cola de cada sesión y nadie se entera.
  //
  // Probado rompiéndolo (con el arreglo puesto, 17 pasan y 0 fallan):
  //   · RTOPE_BYTES se escribe 2097152 a mano  -> 16 pasan / 1 falla
  //   · RBEACON_MAX se escribe 65536 a mano    -> 16 / 1
  const cod = codigoEmitido();
  const C = await import('../lib/replay-contrato');

  const pares: Array<[string, string]> = [
    ['RV', 'REPLAY_VERSION'],
    ['RTOPE_MS', 'REPLAY_TOPE_SEGUNDOS'],
    ['RTOPE_BYTES', 'REPLAY_TOPE_BYTES'],
    ['RPISO_MS', 'REPLAY_PISO_SEGUNDOS'],
    ['RPISO_EV', 'REPLAY_PISO_EVENTOS'],
    ['RCADA_MS', 'REPLAY_LOTE_MS'],
    ['RCADA_EV', 'REPLAY_LOTE_EVENTOS'],
    ['RBEACON_MAX', 'REPLAY_BEACON_MAX_BYTES'],
  ];
  for (const [varDelSnippet, delContrato] of pares) {
    assert.ok(
      new RegExp('var ' + varDelSnippet + ' = \\$\\{' + delContrato + '\\}').test(cod),
      `${varDelSnippet} no sale de ${delContrato}: un número escrito a mano acá se desincroniza del receptor sin que nada falle`,
    );
  }

  // Y ninguno está ESCRITO: si alguien pega el valor, las dos cosas dicen lo mismo hoy
  // y mañana no. Se miran los que no pueden aparecer por otra razón.
  const bloque = cod.slice(cod.indexOf('var RLOTE ='));
  for (const n of [C.REPLAY_TOPE_BYTES, C.REPLAY_BEACON_MAX_BYTES, C.REPLAY_LOTE_MS]) {
    assert.ok(
      !new RegExp('[^\\w]' + n + '[^\\w]').test(bloque),
      `el bloque del grabador trae el número ${n} escrito: tiene que venir del contrato`,
    );
  }
});

test('lo pendiente sale por sendBeacon, un false no se finge, y el lote normal no gasta la cuota', () => {
  // ⚠️ DOS TRAMPAS MEDIDAS Y NINGUNA DA ERROR:
  //
  //   · `sendBeacon` devuelve FALSE cuando el cuerpo no entra en la cuota del documento
  //     (64 KiB); `fetch(keepalive)` tiene la MISMA cuota y no avisa — su promesa
  //     resuelve igual. El camino que parece más moderno es el que pierde datos sin
  //     decirlo, y por eso al salir se usa el otro.
  //   · esa cuota es de TODO el documento y la comparten los dos, así que un lote de
  //     ~17 kB marcado keepalive le come un cuarto de la cuota al beacon del final.
  //     Mientras la pestaña está abierta no hace falta.
  //
  // Probado rompiéndolo (con el arreglo puesto, 17 pasan y 0 fallan):
  //   · el lote normal se manda con keepalive: true          -> 16 pasan / 1 falla
  //   · la cola se vacía ANTES de mirar el false del beacon  -> 16 / 1
  //   · el cuerpo del beacon va como application/json        -> 16 / 1
  const cod = codigoEmitido();

  // 1) El lote de todos los días: fetch SIN keepalive.
  const m = cod.indexOf('function replayMandar');
  assert.ok(m > 0, 'no está la función que manda el lote');
  const mandar = cod.slice(m, cod.indexOf('function replayBeacon', m));
  assert.ok(mandar.length > 400 && mandar.length < 3000, `el recorte quedó en ${mandar.length}: está mirando otra cosa`);
  assert.ok(/fetch\(RLOTE/.test(mandar), 'el lote normal tiene que salir por fetch');
  assert.ok(
    !/keepalive/.test(mandar),
    'el lote normal va con keepalive: le come al beacon del final la cuota de 64 KiB que comparten',
  );

  // 2) Al salir, sendBeacon.
  const b = cod.indexOf('function replayBeacon');
  const beacon = cod.slice(b, cod.indexOf('function replayEmitir', b));
  assert.ok(beacon.length > 500 && beacon.length < 3000, `el recorte quedó en ${beacon.length}: está mirando otra cosa`);
  assert.ok(/navigator\.sendBeacon\(RLOTE, b\)/.test(beacon), 'al irse de la página el lote tiene que salir por sendBeacon');

  // 3) ⚠️ Y COMO text/plain. Con application/json el navegador pide permiso primero
  //    (preflight), y un preflight disparado mientras la página se cierra es un lote
  //    que no sale. El receptor parsea el CUERPO, no la etiqueta.
  assert.ok(
    /type: 'text\/plain'/.test(beacon),
    'el cuerpo del beacon tiene que ir como text/plain: con application/json hace falta un preflight que al cerrar no llega',
  );

  // 4) EL FALSE SE MIRA: si el navegador no se quedó con el lote, la cola no se vacía
  //    y el número de lote no avanza. Darlo por enviado deja un agujero que el
  //    reproductor no puede ver — pega dos momentos como si fueran seguidos.
  const guard = beacon.indexOf('if (!salio) return;');
  assert.ok(guard > 0, 'falta mirar el false de sendBeacon: la cola se da por enviada sin que nadie la haya aceptado');
  assert.ok(guard < beacon.indexOf('RCOLA = [];', guard), 'la cola se vacía ANTES de saber si el lote salió');
  assert.ok(guard < beacon.indexOf('RN++', guard), 'el número de lote avanza ANTES de saber si el lote salió');
});

test('el apagador: sin la orden del servidor no se baja NADA', () => {
  // ⚠️ APAGADO POR DEFECTO, y el permiso viaja en la respuesta del pageview que el
  // snippet ya manda (cero requests extra). Mientras el server no diga que sí, la
  // librería ni se baja: lo que se ahorra no es el tiempo de grabar, es la DESCARGA.
  // El código pegado en la página del cliente no decide nada.
  //
  // Probado rompiéndolo (con el arreglo puesto, 17 pasan y 0 fallan):
  //   · replayArrancar() se llama suelto, sin esperar la respuesta -> 16 pasan / 1 falla
  //   · el guard pasa a ser `if (r)` en vez de `if (r && r.rec)`   -> 16 / 1
  //   · se saca el saneo de la versión                             -> 16 / 1
  const cod = codigoEmitido();

  // 1) Un solo call site, y es la respuesta del pageview.
  const usos = cod.match(/replayArrancar\(/g) ?? [];
  assert.equal(usos.length, 2, `replayArrancar aparece ${usos.length} veces: tiene que ser la declaración y UN solo call site`);
  assert.ok(
    /enviar\(\s*\{ tipo_evento: 'pageview'[\s\S]{0,400}?function \(r\) \{ if \(r && r\.rec\) replayArrancar\(r\.rec\); \}/.test(cod),
    'el grabador tiene que arrancar sólo desde la respuesta del pageview, y sólo si trae `rec`',
  );

  // 2) Y la versión que manda el server se sanea antes de armar una URL con ella.
  assert.ok(
    /if \(!\(v >= 1 && v <= 9999\)\) return;/.test(cod),
    'la versión de la librería entra sin saneo: cualquier cosa termina adentro de la URL de un <script>',
  );

  // 3) El receptor del lote es NUESTRO endpoint, no uno que venga en la respuesta.
  assert.ok(
    /var RLOTE = '\$\{APP_BASE_URL\}\/api\/track\/replay';/.test(cod),
    'el endpoint de los lotes tiene que estar fijo en el snippet, nunca venir en una respuesta',
  );
});

test('el grabador se ata al visitor_id que YA existe, y la sesión vive en sessionStorage', () => {
  // ⚠️ LA IDENTIDAD NO SE INVENTA: el lote viaja con el token de landing y con el
  // visitor_id de la cookie nqe_visitor_id, igual que todo lo que manda enviar(). Ése
  // es el enganche que hace que la grabación aparezca en la ficha del lead —
  // leads.visitor_id ya se cose por Calendly y por el Camino 1 del beacon.
  //
  // Probado rompiéndolo (con el arreglo puesto, 17 pasan y 0 fallan):
  //   · el lote acuña su propio id de visitante  -> 16 pasan / 1 falla
  //   · el id de sesión se guarda en una cookie  -> 16 / 1
  const cod = codigoEmitido();

  const i = cod.indexOf('function replayArmar');
  assert.ok(i > 0, 'no está la función que arma el lote');
  const lote = cod.slice(i, cod.indexOf('function replayGzip', i));
  assert.ok(lote.length > 200 && lote.length < 1200, `el recorte quedó en ${lote.length}: está mirando otra cosa`);
  assert.ok(
    // `CUENTA` desde la v23: es el mismo token, con un nombre que no tapan los detectores.
    /t: CUENTA/.test(lote) && /visitor_id: visitorId/.test(lote),
    'el lote tiene que viajar con el token y con el visitor_id que el snippet ya usa, sin inventar una identidad nueva',
  );

  // La sesión en sessionStorage y NO en una cookie: una cookie haría que «la sesión»
  // durara un año, y una sesión es una visita. La misma decisión que mko_test.
  const s = cod.indexOf('function replaySesion');
  const ses = cod.slice(s, cod.indexOf('function replayPiso', s));
  assert.ok(ses.length > 300 && ses.length < 1500, `el recorte quedó en ${ses.length}: está mirando otra cosa`);
  assert.ok(/sessionStorage\.setItem\('mko_rs'/.test(ses), 'el id de sesión tiene que guardarse en sessionStorage');
  assert.ok(!/document\.cookie/.test(ses), 'el id de sesión en una cookie haría que una sesión durara un año');
});

test('el lote se parte con el tope del RECEPTOR, y la foto de la página no se tira en silencio', async () => {
  // ⚠️ EL CASO NORMAL, NO EL RARO. El primer evento de CUALQUIER sesión es la foto
  // entera de la página con su hoja de estilos adentro (inlineStylesheet: true), y
  // sola puede pasar los 256 KiB que el receptor acepta por lote: él la tira
  // ('pesado' en cuerpoDeLote) y el grabador ya tiró los eventos. La grabación queda
  // sin su foto —o sea sin nada que reproducir— y el agujero no lo ve nadie.
  //
  // El productor y el consumidor están en archivos distintos y nadie los toca junto,
  // así que este test lee LOS DOS: el número tiene que ser el mismo.
  //
  // Probado rompiéndolo (con el arreglo puesto, 18 pasan y 0 fallan):
  //   · el tope se escribe 262144 a mano en el snippet              -> 17 pasan / 1 falla
  //   · replayPartir corta también con la tanda vacía (tira el evento
  //     solo que no entra, que es justo la foto de la página)       -> 17 / 1
  //   · el peso de un cuerpo comprimido se mide sobre el base64     -> 17 / 1
  const cod = codigoEmitido();
  const sellado = readFileSync(new URL('../lib/replay-sellado.ts', import.meta.url), 'utf8');

  // 1) El número es UNO, y el snippet lo interpola del módulo que lo define.
  assert.ok(
    /export const REPLAY_LOTE_MAX_BYTES =/.test(sellado),
    'REPLAY_LOTE_MAX_BYTES ya no vive en lib/replay-sellado.ts: el grabador lo interpola de ahí',
  );
  assert.ok(
    /var RLOTE_MAX = \$\{REPLAY_LOTE_MAX_BYTES\};/.test(cod),
    'el tope por lote del grabador no sale de REPLAY_LOTE_MAX_BYTES: escrito a mano se separa del receptor sin que nada falle',
  );
  // Y el que recibe lo sigue mirando: si dejara de rechazar por tamaño, partir acá
  // sería trabajo por nada — pero si lo rechaza y acá no se parte, es una sesión
  // sin foto.
  assert.ok(
    /if \(cuerpo\.length > REPLAY_LOTE_MAX_BYTES\) return \{ rechazo: 'pesado' \};/.test(sellado),
    'el receptor dejó de rechazar un lote por tamaño: revisá si el grabador todavía tiene que partir',
  );

  // 2) Se parte, y la partición la pide el camino que manda.
  assert.ok(/function replayPartir\(eventos\) \{/.test(cod), 'falta la partición por tamaño del lote');
  assert.ok(/var tandas = replayPartir\(eventos\);/.test(cod), 'replayMandar no parte el lote antes de mandarlo');

  // 3) ⚠️ Y SE EJECUTA, no se lee. La función vive adentro del snippet, así que se
  //    saca del texto EMITIDO —el único que le llega al cliente— y se corre.
  const { REPLAY_LOTE_MAX_BYTES } = await import('../lib/replay-sellado');
  const i = cod.indexOf('function replayPartir(eventos) {');
  const fin = cod.indexOf('\n  }', cod.indexOf('return tandas;', i));
  const fuenteFn = cod.slice(i, fin + 4);
  assert.ok(fuenteFn.length > 300 && fuenteFn.length < 1200, `el recorte quedó en ${fuenteFn.length}: está mirando otra cosa`);
  const partir = new Function('RLOTE_MAX', fuenteFn + '\nreturn replayPartir;')(REPLAY_LOTE_MAX_BYTES) as
    (e: unknown[]) => unknown[][];

  // Nada que partir.
  assert.deepEqual(partir([]), [], 'sin eventos no hay tandas');
  // Chicos: UNA tanda, para no gastar un request por evento.
  const chicos = Array.from({ length: 50 }, (_, k) => ({ type: 3, data: { x: k } }));
  assert.equal(partir(chicos).length, 1, '50 eventos chicos tienen que entrar en un solo lote');
  // La FOTO: un solo evento que no entra viaja igual, en su tanda, sin partirse.
  const foto = { type: 2, data: { html: 'x'.repeat(REPLAY_LOTE_MAX_BYTES + 5000) } };
  const soloFoto = partir([foto]);
  assert.equal(soloFoto.length, 1, 'un evento que no entra no se puede partir: va igual');
  assert.deepEqual(soloFoto[0], [foto], 'la foto de la página no se puede tirar: sin ella no hay nada que reproducir');
  // Y la foto no arrastra a los que vienen detrás: se corta ANTES de pasarse.
  const mixto = partir([foto, ...chicos]);
  assert.ok(mixto.length >= 2, 'la foto tiene que quedar sola: con los demás pegados, la tanda entera se pasa del tope');
  assert.deepEqual(mixto[0], [foto], 'la foto va primera y sola');
  assert.equal(mixto.reduce((n, t) => n + t.length, 0), 1 + chicos.length, 'partir no puede perder ni un evento');

  // 4) El peso de un cuerpo comprimido se mide sobre los BYTES del gzip, que es lo
  //    que el receptor mide después de decodificar el base64 — no sobre el base64,
  //    que es un tercio más grande y rechazaría lotes perfectamente buenos.
  assert.ok(
    /var pesa = z === 1 \? Math\.ceil\(cuerpo\.length \* 3 \/ 4\) : cuerpo\.length;/.test(cod),
    'el peso de un lote comprimido se mide sobre el base64: un tercio de los lotes buenos no se mandaría',
  );
});
