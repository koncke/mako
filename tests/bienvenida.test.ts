// La bienvenida apaga el chrome del grafo con CSS, y eso solo se sostiene si las clases
// siguen llamándose igual. Un renombre en Grafo.tsx no rompe nada visible en
// /second-brain y haría REAPARECER el filtro, el tirador y el navegador lateral encima de
// la primera pantalla que ve un cliente nuevo — en silencio, que es lo peor.
//
// Es la regla de la casa: si una regla no se puede validar, es una expresión de deseo.
// Ésta sí se puede, así que se valida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');

const bienvenida = leer('../app/onboarding/Bienvenida.tsx');

/**
 * El archivo SIN comentarios. Las aserciones en NEGATIVO —«esto no puede aparecer»— tienen
 * que mirar código: los comentarios de esta pantalla nombran a propósito lo que NO hay que
 * hacer (el <line> de la versión a mano, el módulo que no se puede importar acá), y un test
 * que se dispara con la prosa que explica el bug es un test que se aprende a ignorar.
 */
const sinComentarios = (t: string) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const codigo = sinComentarios(bienvenida);

test('el taller de temas NO se monta para un cliente, y el chip NO se esconde', () => {
  // Dos mitades del mismo error, y la segunda la cometí yo arreglando la primera.
  //
  // El dueño reportó que el chip de «tema en prueba» saltaba encima de la primera
  // pantalla de un cliente. Lo tapé con `display: none`. Pero el chip era el AVISO, no la
  // causa: el tema se seguía aplicando, y una hora después volvió del otro lado —la app
  // entera ilegible en la pantalla de un cliente, «no están sus tareas y están todos los
  // botones mal»— porque una paleta clara del taller pintaba el texto del color del fondo.
  // Con el chip tapado, ni la advertencia quedaba. Es «esconder el botón no protege nada».
  const layout = leer('../app/layout.tsx');
  assert.ok(/\{esAdmin && <TemaCandidato \/>\}/.test(layout), 'el taller de temas volvió a montarse para cualquiera');
  assert.ok(/getSesionAdmin/.test(layout), 'el guard del taller dejó de mirar la sesión');
  // Y la bienvenida ya no tapa el chip: si a Martín le queda un tema puesto, tiene que
  // verlo y poder salir — es su única salida.
  assert.ok(!/\[data-chip-tema\][^\n]*display:\s*none/.test(bienvenida), 'volvió a esconderse la salida del taller');
});

test('el botón es el del sistema, y de ancho completo', () => {
  // «hoy en día es mucho texto y el botón chiquito en el medio» (16/08) y «el diseño del
  // botón está muy feo» (17/08). Las dos cosas se resuelven con la MISMA pieza: el Button
  // de app/_ui, que ya trae el ancho completo como prop.
  //
  // ⚠️ Y el dorado queda PROHIBIDO acá: app/_ui/Button.tsx lo dice textual — «mako es para
  // pedirle algo a la inteligencia, nunca para navegar». Este botón navega.
  assert.ok(/from '@\/app\/_ui'/.test(bienvenida), 'dejó de usar el sistema de diseño');
  assert.ok(/<Button[\s\S]{0,160}variant="primary"/.test(bienvenida), 'el botón dejó de ser primary');
  const jsx = bienvenida.slice(bienvenida.indexOf('<Button'), bienvenida.indexOf('<Button') + 200);
  assert.ok(jsx.includes(' full '), 'el botón dejó de ser de ancho completo');
  // El dorado no puede volver como estilo propio del botón. Se busca la regla, no el token
  // suelto: `--mako` sigue siendo legítimo en el nodo central del mapa y en el cursor.
  const reglaBoton = bienvenida.match(/\n\.bv[ .][^\n]*\.bv-boton[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(!reglaBoton.some((r) => r.includes('--mako')), 'volvió el dorado al botón');
});

test('la barra de agencia se DIBUJA, no se tapa', () => {
  // La pantalla es fixed y pisa a la barra del modo agencia, que es la ÚNICA salida del
  // super-admin. AGENTS.md: «si la única salida vive adentro de una pantalla condicional,
  // no hay salida». Ya pasó una vez con el botón SALIR DE LA VISTA.
  assert.ok(/adminBar/.test(bienvenida), 'la bienvenida dejó de recibir la barra');
  assert.ok(/\{adminBar\}/.test(bienvenida), 'la recibe pero no la dibuja');
  assert.ok(/stopPropagation/.test(bienvenida), 'sin stopPropagation, tocar la barra avanza el revelado');
});

test('el bloque de estilos no tiene comillas invertidas adentro', () => {
  // ⚠️ ESTO PASÓ TRES VECES EN UNA SOLA SESIÓN. El CSS vive dentro de un template
  // literal, así que una comilla invertida en un comentario —`.bv-ojo`, escrito como se
  // escribe un identificador— CIERRA el string y rompe el build ENTERO. No hay síntoma
  // parcial: la app no compila.
  //
  // La cabecera del archivo ya lo advertía y volvió a pasar igual, que es exactamente el
  // caso de AGENTS.md: una regla que solo vive en prosa no se cumple, se cumple casi
  // siempre. Esto es la otra capa, la determinista.
  const i = bienvenida.indexOf('const ESTILOS = ');
  assert.ok(i > 0, 'no encontré el bloque ESTILOS');
  const backticks = (bienvenida.slice(i).match(/`/g) ?? []).length;
  assert.equal(backticks, 2, 'hay comillas invertidas DENTRO del template de CSS: rompen el build');
});


test('monta el Grafo REAL, no un SVG dibujado a mano', () => {
  // ⚠️ ESTA PANTALLA YA SE REESCRIBIÓ A MANO DOS VECES, y las dos veces se cayó por lo
  // mismo: reimplementar un grafo es reimplementar todo lo que un grafo hace. La última
  // versión animaba los nodos por rAF y dejaba las aristas como <line> de coordenadas
  // fijas — los nodos flotaban y las líneas no, así que se despegaban. Reportado como «se
  // rompe la animación», y ni el drag ni el click existían.
  //
  // Mover un nodo es mover TODO lo que lo toca. Eso ya está resuelto en Grafo.tsx.
  assert.ok(/from '@\/app\/second-brain\/Grafo'/.test(bienvenida), 'dejó de montar el grafo real');
  assert.ok(/<Grafo\s+cerebro=/.test(bienvenida), 'importa el grafo pero no lo dibuja');
  // Y NO vuelve a dibujar nodos por su cuenta: un <circle> o un <line> propios acá son la
  // firma de que alguien empezó a reimplementarlo otra vez.
  const jsx = codigo.slice(0, codigo.indexOf('const ESTILOS = '));
  for (const tag of ['<circle', '<line', 'requestAnimationFrame']) {
    assert.ok(!jsx.includes(tag), `volvió a dibujar el mapa a mano (${tag})`);
  }
});

test('los datos son FICCIÓN y la forma pasa por el layout real', () => {
  // Las dos decisiones conviven y cada una se ganó por separado: el cliente nuevo no tiene
  // datos («justamente esto es ficción, es un grafo sin info»), pero la FORMA tiene que ser
  // la del producto («tipo cerebro, no como un árbol»).
  const page = leer('../app/onboarding/page.tsx');
  assert.ok(/cerebroBienvenida\(\)/.test(page), 'la portada dejó de usar el cerebro de ficción');
  assert.ok(!/construirCerebro/.test(page), 'volvió a mostrarle al cliente su cerebro REAL, que está vacío');
  // ⚠️ Y el layout se calcula en el SERVER. Si `bienvenida-cerebro` lo importara un
  // 'use client', d3-force entra al bundle del browser y el typecheck no lo ve.
  assert.ok(!/bienvenida-cerebro/.test(codigo), 'la pantalla (use client) importó el módulo con d3-force');
  const fic = leer('../lib/bienvenida-cerebro.ts');
  assert.ok(/layoutCerebro\(/.test(fic), 'la ficción dejó de pasar por el layout de fuerzas');
});

test('el revelado crece el cerebro; no toca el grafo ni las posiciones', () => {
  // El truco entero: se le pasa un `cerebro` con menos nodos y el grafo se encuadra solo.
  // Las posiciones NUNCA se recalculan, así que un nodo aparece siempre en su lugar
  // definitivo — recalcularlas por click es lo que el dueño vio como «se comporta de forma
  // muy extraña».
  assert.ok(/function idsDelPaso/.test(bienvenida), 'desapareció el recorte por paso');
  assert.ok(/cerebroPaso/.test(bienvenida), 'el grafo dejó de recibir el cerebro recortado');
  assert.ok(/encuadre: encuadreDe\(/.test(bienvenida),
    'se recortan los nodos pero no el encuadre: con un nodo solo queda descentrado (ya pasó)');
  assert.ok(/posiciones/.test(codigo) && !/layoutCerebro/.test(codigo),
    'la pantalla no puede recalcular posiciones: las calcula el server una sola vez');
});

test('la primera frase espera más que las demás', () => {
  // «No se llega a leer eso apenas aparece porque al segundo ya se comienza a borrar».
  // Llega con el fundido del bloque, el título y el botón, y sin escribirse.
  assert.ok(/MS_QUIETA_PRIMERA/.test(bienvenida), 'volvió a borrar la primera frase con el tiempo de las otras');
  const primera = Number((bienvenida.match(/MS_QUIETA_PRIMERA = (\d+)/) ?? [])[1]);
  const resto = Number((bienvenida.match(/MS_QUIETA = (\d+)/) ?? [])[1]);
  assert.ok(primera > resto * 1.5, `la primera espera ${primera} y las otras ${resto}: no alcanza`);
});
