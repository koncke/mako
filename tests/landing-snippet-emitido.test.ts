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
