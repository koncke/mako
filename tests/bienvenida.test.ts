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

test('el mapa es ficción, pero la paleta y los nombres son los de verdad', () => {
  // El mapa NO es el cerebro real, y eso está decidido: «justamente esto es ficción, es un
  // grafo sin info». Un cliente nuevo tiene 25 nodos y casi todos son etapas de un funnel
  // que no armó — mostrarle eso es mostrarle el negocio de otro.
  //
  // Pero los NOMBRES de las áreas y los COLORES salen del catálogo real, para que cuando
  // llegue a su Second Brain reconozca lo que vio el primer día. Sin esta atadura, el día
  // que se agregue un área esta pantalla queda mostrando un mapa que ya no existe.
  assert.ok(/from '@\/lib\/cerebro-modelo'/.test(bienvenida), 'dejó de importar el catálogo real');
  assert.ok(/AREAS\.filter/.test(bienvenida), 'dejó de derivar las áreas del catálogo');
  for (const et of ['Tus anuncios', 'Tu Oferta', 'Tu Avatar', 'Tu Funnel', 'Tu Mensaje']) {
    assert.ok(bienvenida.includes(et), `falta el rótulo "${et}"`);
  }
});

test('el movimiento es el del grafo real, no uno inventado', () => {
  // «Haz que se comporte igual que nuestro grafo, solo que CONTROLA qué sí y qué no». Los
  // datos son ficción; el MOVIMIENTO no puede serlo, o la portada promete una cosa y el
  // producto entrega otra. Estas constantes están portadas de Grafo.tsx y tienen que
  // seguir coincidiendo: si allá cambian y acá no, la portada envejece sin que nadie lo
  // note — se ve igual de bien.
  const grafo = leer('../app/second-brain/Grafo.tsx');
  assert.ok(/const FLOTE = 16;/.test(bienvenida) && /const FLOTE = 16;/.test(grafo), 'FLOTE dejó de coincidir con el grafo');
  for (const periodo of ['7100', '11300']) {
    assert.ok(bienvenida.includes(periodo), `falta el período ${periodo} de la flotación`);
    assert.ok(grafo.includes(periodo), `el grafo real ya no usa el período ${periodo}`);
  }
  // La fase sale del hash del id, no de un sorteo: el nodo flota igual en cada visita.
  assert.ok(/2166136261/.test(bienvenida) && /2166136261/.test(grafo), 'el hash FNV-1a dejó de compartirse');
  // Y la entrada nace desplazada hacia afuera, con el mismo decaimiento.
  assert.ok(/\(1 - u\) \*\* 3/.test(bienvenida), 'la entrada dejó de decaer como en el grafo');
});

test('el reloj de la entrada es POR NIVEL, no global', () => {
  // Es la mitad «controla» del pedido: con un reloj único, cada click volvería a lanzar
  // hacia afuera a los nodos que ya llegaron. Ese es literalmente el bug que /second-brain
  // tiene al filtrar, y lo que el dueño vio como «se comporta de forma muy extraña».
  assert.ok(/nacido\.current\[n\.nivel\]/.test(bienvenida), 'el reloj de entrada volvió a ser global');
  // Y la flotación va en un <g> propio: dos animaciones sobre el mismo transform se pisan.
  assert.ok(/refs\.current\.set/.test(bienvenida), 'los nodos dejaron de tener su propia capa de movimiento');
});

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

test('ningún nodo del mapa comparte id con otro', () => {
  // ⚠️ ESTO PRODUJO 444 ERRORES POR CARGA y ninguno se veía. Los cinco pilares se llaman
  // `oferta`, `avatar`, `mensaje`, `funnel`, `negocio`, y el catálogo REAL de áreas —de
  // donde salen los nodos del nivel 2— trae varios con esos mismos ids. Dos nodos con el
  // mismo id rompen DOS cosas a la vez y las dos calladas:
  //   · React ve dos hijos con la misma `key` y omite uno («may cause children to be
  //     duplicated and/or omitted», textual de la consola).
  //   · `refs.current` es un Map por id, así que el segundo nodo PISA al primero y uno de
  //     los dos se queda sin su <g>: no flota. Ese era el movimiento raro que yo le había
  //     atribuido al reloj de entrada.
  //
  // Se valida la forma que hace imposible la colisión —un prefijo por nivel— en vez de
  // contar ids: el catálogo de áreas crece, y una lista que hoy no choca mañana sí.
  const cons = bienvenida.match(/nuevo\(\{\s*id: `[^`]+`/g) ?? [];
  assert.ok(cons.length >= 4, `esperaba 4 construcciones de nodo, encontré ${cons.length}`);
  const prefijos = cons.map((c) => (c.match(/id: `([a-z])-/) ?? [])[1]);
  assert.ok(prefijos.every(Boolean), `hay nodos cuyo id no arranca con un prefijo de nivel: ${cons.join(' | ')}`);
  assert.equal(new Set(prefijos).size, prefijos.length, `dos niveles comparten prefijo: ${prefijos.join(', ')}`);
});

test('la línea sigue a SUS DOS puntas, no a una', () => {
  // ⚠️ EL BUG QUE ESTO CIERRA: la <line> se dibujaba entre dos coordenadas FIJAS —la
  // posición de reposo del padre y la del hijo— mientras los dos nodos se movían por
  // `transform`. Los nodos flotaban, las líneas se quedaban, y se despegaban. Reportado
  // como «los nodos flotan, pero las líneas conectoras no, haciendo que se rompa la
  // animación».
  //
  // No se arregla con un transform sobre la línea: eso la traslada RÍGIDA, y sus dos
  // puntas se mueven distinto porque cada una sigue a un nodo con su propia fase. Hay que
  // reescribir las cuatro coordenadas por frame.
  assert.ok(/padre: string;/.test(bienvenida), 'el nodo dejó de saber quién es su padre');
  for (const attr of ['x1', 'y1', 'x2', 'y2']) {
    assert.ok(bienvenida.includes(`setAttribute('${attr}'`), `la línea no actualiza ${attr} por frame`);
  }
  // Y el desplazamiento del padre se busca por ID, que es lo único que permite seguirlo.
  assert.ok(/corrido\.get\(n\.padre\)/.test(bienvenida), 'la punta de arriba dejó de seguir al padre');
});

test('el corrido se calcula en una pasada APARTE de dibujar', () => {
  // El orden del array es de construcción, no topológico: un hijo puede venir antes que su
  // padre. Calculando y dibujando en la misma pasada, la mitad de las líneas usaría la
  // posición del padre del frame ANTERIOR — un temblor de 1/60 s que se ve como que las
  // líneas vibran respecto de los nodos.
  const i1 = bienvenida.indexOf('PASADA 1');
  const i2 = bienvenida.indexOf('PASADA 2');
  assert.ok(i1 > 0 && i2 > i1, 'se fusionaron las dos pasadas del motor de movimiento');
});

test('el zoom por click solo se habilita con TODO revelado', () => {
  // «Pero esto último solo cuando ya estén todos, al terminar los 3 clicks que tiene que
  // dar el usuario». Y además es lo correcto: durante el revelado el click ES el gesto que
  // avanza, así que uno que también hiciera zoom haría dos cosas en el mismo gesto.
  assert.ok(/onClick=\{paso >= 3 \?/.test(bienvenida), 'el zoom dejó de esperar a que estén todos');
  // Sin cortar la burbuja, tocar un nodo haría zoom Y saldría de la sección a la vez.
  assert.ok(/e\.stopPropagation\(\)/.test(bienvenida), 'el click del nodo volvió a burbujear al lienzo');
  // La cámara va en su propia capa: .bv-svg ya anima su transform al entrar el texto, y
  // dos animaciones sobre el mismo transform se pisan.
  assert.ok(/className="bv-camara"/.test(bienvenida), 'desapareció la capa de cámara');
  assert.ok(/\.bv-camara \{[^}]*transform-origin: 0 0/.test(bienvenida),
    'la cámara sin transform-origin en 0 0 suma medio lienzo de corrimiento');
  // Y hay tope de acercamiento: encuadrar un nodo solo daría un zoom absurdo.
  assert.ok(/2\.6\)/.test(bienvenida), 'se fue el tope de zoom por sección');
});
