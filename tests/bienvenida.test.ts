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

test('la bienvenida monta el Grafo REAL, no una copia', () => {
  // El dueño lo corrigió DOS veces: «no es necesario que inventes una animación si el
  // grafo que ya hicimos actúa como animación» y «el grafo no lo inventes, utiliza el
  // real». Entre las dos hubo una versión con un SVG propio; esto la frena.
  assert.ok(/from '@\/app\/second-brain\/Grafo'/.test(bienvenida), 'dejó de importar el Grafo real');
  assert.ok(/<Grafo\s/.test(bienvenida), 'dejó de montar el Grafo');
  // Y el tema oscuro: sin él las etiquetas del mapa se dibujan con el --ink del tema claro
  // y quedan negro sobre negro. Están en el DOM, tienen caja, y no se ven.
  assert.ok(/<TemaOscuro/.test(bienvenida), 'sin TemaOscuro los títulos del mapa son invisibles');
});

test('el revelado se hace RECORTANDO el cerebro, que es lo que lo re-encuadra', () => {
  // Grafo saca su bbox de los nodos que recibe y ajusta la cámara contra ese bbox, así que
  // pasarle un subconjunto lo hace acercarse solo. Si alguien vuelve a pasarle el cerebro
  // entero y esconde con CSS, el encuadre deja de moverse y el revelado pierde el gesto.
  assert.ok(/cerebro\.nodos\.filter/.test(bienvenida), 'dejó de recortar los nodos por paso');
  assert.ok(/cerebro\.aristas\.filter/.test(bienvenida), 'dejó de recortar las aristas');
  assert.ok(/\.bv-p3 \.bv-mapa \{ transform: translateY/.test(bienvenida), 'el mapa dejó de subir antes del texto');
});

test('las clases del chrome que la bienvenida apaga siguen existiendo en el grafo', () => {
  // Un renombre en Grafo.tsx no rompe nada visible en /second-brain y haría REAPARECER el
  // filtro y el navegador lateral encima de la primera pantalla que ve un cliente — en
  // silencio, que es lo peor.
  const grafo = leer('../app/second-brain/Grafo.tsx');
  for (const clase of ['cbg-barra', 'cbg-tirador', 'cbg-detalle']) {
    assert.ok(grafo.includes(clase), `Grafo.tsx ya no usa "${clase}"`);
    assert.ok(bienvenida.includes(clase), `Bienvenida.tsx dejó de apagar "${clase}"`);
  }
});

test('el reloj de la animación del grafo no se reinicia al cambiar lo visible', () => {
  // El bug que destapó el revelado: con `pintar` en las deps del efecto del bucle, cada
  // cambio de lo visible reiniciaba t0 y TODOS los nodos volvían a nacer desplazados. Le
  // pasaba a /second-brain en cada filtro.
  const grafo = leer('../app/second-brain/Grafo.tsx');
  assert.ok(/pintarRef/.test(grafo), 'volvió a llamarse pintar por dependencia');
  assert.ok(!/\}, \[posiciones, pintar\]\);/.test(grafo), 'pintar volvió a las dependencias del bucle');
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
