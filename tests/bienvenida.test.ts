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

test('la flotación se controla nodo por nodo, y no comparte elemento con la entrada', () => {
  // Dos animaciones que tocan `transform` en el MISMO elemento se pisan y la segunda gana.
  // Este repo ya lo pagó en /second-brain: los nodos «no flotaban», 0,03 px medidos.
  assert.ok(/className="bv-flota"/.test(bienvenida), 'desapareció la capa de flotación');
  assert.ok(/--dur/.test(bienvenida) && /--fase/.test(bienvenida), 'la flotación dejó de ser por nodo');
  // Y períodos distintos por nodo: uno solo hace que el mapa lata al unísono y se vea
  // mecánico, que es el «se comporta de forma muy extraña» que reportó el dueño.
  assert.ok(/dur: 7 \+ az/.test(bienvenida), 'los períodos volvieron a ser todos iguales');
});

test('el chip del taller de diseño no se dibuja encima de la bienvenida', () => {
  // «Eso NO debería saltar aquí, y mucho menos en un onboarding real». El chip vive en el
  // layout raíz con z-index 5000, así que le gana a la pantalla por más fixed que sea.
  assert.ok(/body:has\(\.bv\) \[data-chip-tema\]/.test(bienvenida), 'la bienvenida dejó de apagar el chip');
  const chip = leer('../app/_components/TemaCandidato.tsx');
  assert.ok(/data-chip-tema/.test(chip), 'el chip perdió su marca y la regla dejó de encontrarlo');
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
