// =============================================================================
// El semáforo — registro de construcción
// =============================================================================
// Qué va acá y qué no es lo mismo que en el resto de los registros: el motivo y
// la trampa, no el changelog. Los tipos y la forma de una entrada están en
// ../_registro/tipos.ts.
//
// Este registro nace con UNA entrada y no vacío, al revés que los otros, porque
// el trabajo ya estaba hecho cuando se creó el área: se hizo creyendo que era
// parte del rediseño y no lo era. Esa confusión es justamente lo primero que
// vale la pena dejar escrito.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Parte 3 · Gramática de MaKo';

export const BITACORA: Hito[] = [
  {
    fecha: '8 ago', hora: '11:34', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Un solo tipo, y el color sale de la paleta',
    puntos: [
      '⚠️ **Eran DOS tipos incompatibles.** `Semaforo` (lib/meta-health-ui.ts) decía `rojo | ambar | verde | gris` y `SemaforoAviso` (lib/avisos-catalogo.ts) decía `rojo | amarillo | verde | na`: **no coincidían en dos de los cuatro valores**, sobre 158 usos en 22 archivos.',
      '**El síntoma era que no había síntoma.** Un `switch` sobre el tipo equivocado compila perfecto, no rompe nada y cae al `default` — o sea que pinta el color de otra cosa y nunca avisa. Por eso sobrevivió tanto.',
      'La salida NO fue renombrar el tipo: los valores viejos están escritos en los DATOS (las ~48 filas de `CATALOGO_AVISOS`). Se lee con `normalizarSemaforo()`, que acepta las dos escrituras; migrar las filas es aparte. Renombrar y dejar los datos viejos era cambiar un bug silencioso por otro.',
      '`colorDeSemaforo` y `bgDeSemaforo` ahora derivan de `TONO` en vez de una lista de `var(--…)` escrita al lado. Devuelven exactamente los mismos valores que antes — cambió de dónde salen, no el pixel. Es lo único que impide que el ámbar del semáforo y el warning de un botón vuelvan a separarse.',
    ],
    commits: [{ sha: 'bad3b90', msg: 'Parte 3 · La gramática de MaKo: los nueve estados, en un solo lugar', lineas: 737, archivos: 9 }],
    archivos: [
      'lib/mako-gramatica.ts — el tipo `Semaforo`, `normalizarSemaforo()`, `tonoDeSemaforo()` y `EMOJI_SEMAFORO`',
      'lib/meta-health-ui.ts — re-exporta el tipo; los colores salen de la paleta de tonos',
      'lib/avisos-catalogo.ts — `SemaforoAviso` marcado deprecado',
    ],
  },
  {
    fecha: '8 ago', hora: '12:10', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«No entiendo qué tiene que ver el semáforo con el rediseño»',
    pedido: 'No entiendo que tiene que ver el semaforo con la rediseño... Te fuiste a ejecutar algo que no tiene nada que ver con lo que estamos haciendo...\nYa está, guarda eso en una nueva tab llamada "El semáforo" que viva en la sección de "dev" de super admin. Claro que hazlo como ya acostumbramos con su roadmap y su change history.',
    puntos: [
      '**Tenía razón, y el error vale más que el trabajo.** El semáforo apareció al unificar los estados de MaKo, pero no es parte del rediseño: no es una pieza del sistema de diseño, es un CONCEPTO del producto que lo cruza entero.',
      'La regla que queda: **que dos cosas se toquen no las hace la misma tarea.** Un hallazgo que aparece trabajando X va donde vive, no adentro del registro de X — si no, el registro del rediseño termina contando cosas que no son el rediseño y deja de servir para lo que se hizo.',
      'Por eso el semáforo tiene área propia: su historia no pertenece a ninguna pantalla en particular, y metida en la de otra se pierde.',
    ],
  },
];

export const PARTES: Parte[] = [
  { titulo: 'Un solo tipo', detalle: 'Se unifican `Semaforo` y `SemaforoAviso`, con `normalizarSemaforo()` para leer los nombres viejos', estado: 'hecha' },
  { titulo: 'El color sale de la paleta', detalle: '`colorDeSemaforo`/`bgDeSemaforo` derivan de `TONO`: el ámbar del semáforo no puede separarse del warning', estado: 'hecha' },
  { titulo: 'Migrar los datos', detalle: 'Pasar `amarillo`→`ambar` y `na`→`gris` en las ~48 filas de CATALOGO_AVISOS, y sacar el tipo deprecado', estado: 'cola' },
  { titulo: 'Un solo punto de pintado', detalle: 'Hoy cada pantalla dibuja su propio puntito con `colorDeSemaforo`. Falta la pieza única que lo pinte con su rótulo al lado — un color solo deja afuera a quien no lo distingue', estado: 'cola' },
];
