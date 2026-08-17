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

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "11 ago", hora: "17:39", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El tipo deprecado ganó 12 filas: la deuda del semáforo crece sola",
    puntos: [
      "El primer hito dejó `SemaforoAviso` ('verde'|'amarillo'|'rojo'|'na') marcado deprecado y puso «Migrar los datos» en la cola del roadmap, sobre «las ~48 filas de CATALOGO_AVISOS». Desde entonces siete tandas independientes —los mensajes con link al resumen del lead, la alerta crítica de Meta, el snippet versionado de la landing, el visitor_id de leads, la bandeja de los 8 leads, el cron de Clarity, el pixel v11 y su probador— agregaron 12 avisos nuevos, y los 12 se escribieron con el vocabulario VIEJO: 3 'amarillo', 4 'na', 4 'verde', 1 'rojo'. El catálogo pasó de 47 a 59 filas y la deuda a migrar creció ~25% mientras la tarea estaba «en cola».",
      "Es exactamente el modo de falla que el hito del 8 ago describió y que nadie cerró: «el síntoma era que no había síntoma». El tipo deprecado sigue exportado y sigue compilando, así que escribir 'amarillo' es el camino de MENOS esfuerzo y ninguna de las siete tandas tenía por qué saber que existía otro vocabulario — ninguna estaba trabajando el semáforo. La consecuencia práctica: cuanto más se demora la migración más cara se vuelve, y el día que se haga hay que tocar código de siete áreas distintas en vez de una. La regla que falta escribir es que un tipo deprecado sin nada que lo mire (un lint, un test que cuente filas con el vocabulario viejo y falle) no es una deprecación: es un comentario. Y el corolario para la otra parte en cola, «un solo punto de pintado»: los call-sites de colorDeSemaforo/bgDeSemaforo siguen siendo los mismos 6 de siempre (SaludBoard, los tres de ads-manager, meta-health, la propia tab dev) — o sea que esa mitad no se degradó, pero la de los datos sí, y nadie lo estaba midiendo.",
    ],
    commits: [
      { sha: "b4714a82", msg: "Los mensajes de MaKo dejan de preguntar al vacío: un link al resumen del lead", lineas: 1333, archivos: 16 },
      { sha: "a21d7bef", msg: "Los avisos de Meta existían solo como texto: nadie los emitía nunca", lineas: 435, archivos: 5 },
      { sha: "562f8962", msg: "landing: el snippet se versiona y MaKo avisa cuando quedó viejo", lineas: 132, archivos: 5 },
      { sha: "5d125365", msg: "leads: el visitor_id no llegaba al insert, y los webhooks ya no fusionan callados", lineas: 178, archivos: 8 },
      { sha: "417c539d", msg: "landing: los 8 leads SI habian entrado — lo que faltaba era que alguien se enterara", lineas: 158, archivos: 5 },
      { sha: "517200d1", msg: "clarity: el cron que cachea el resumen y avisa antes de que se borre la grabación", lineas: 227, archivos: 6 },
      { sha: "2a5c338e", msg: "pixel v11: el autoplay no cuenta como play, y todo se acota a la landing elegida", lineas: 675, archivos: 14 },
      { sha: "7008cf60", msg: "prueba del Pixel: los chequeos miraban una ventana de 25 eventos, y el opt-in la tabla equivocada", lineas: 247, archivos: 5 },
    ],
  },
  {
    fecha: "13 ago", hora: "10:56", chat: "Integraciones", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El rojo por fin dispara: un catálogo de mensajes no es un sistema de alertas",
    puntos: [
      "La cuenta de Meta del dueño estuvo con ENTREGA FRENADA —cero anuncios, cero leads— y por WhatsApp no llegó nada. Los cuatro avisos de Meta (meta-cuenta-frenada, meta-token-vencido, meta-cuenta-riesgo…) estaban escritos en CATALOGO_AVISOS con su disparador documentado y tenían CERO call-sites fuera del catálogo: se detectaba (quedaba en service_incidents, /integraciones lo pintaba en rojo) y no se avisaba nunca. Ya había pasado tres veces antes (16/7 dos días frenado, 29/7 cuatro horas). Se construyó lib/alerta-critica.ts + su cron, que INVIERTE el dedup del motor de avisos, arma el titular desde el account_status REAL de Meta con un mapa estado→titular+qué-hacer, y dedupea por META_AD_ACCOUNT_ID. Pedidos textuales del dueño, en orden: «tenemos que ser MUY PESADOS, no solo el mensaje DRAMÁTICO sino la frecuencia MUY alta hasta que se solucione», después «más dramático, usá más emojis (⚠️🚨)», después «y también que sea CLARO: que diga \"tu cuenta publicitaria está SUSPENDIDA por falta de pago\", no simplemente que está frenada», y finalmente lo corrigió él mismo viéndolo andar en prod: cada 1 hora, no cada 10 minutos.",
      "Es la primera vez que el valor del semáforo GOBIERNA una conducta en vez de pintar un puntito, y ninguna de las cuatro trampas está escrita en ningún lado (el grep de `alerta-critica` sobre app/admin/dev y docs/ da CERO). Las cuatro: (1) un semáforo que se pone en rojo y nadie emite se ve igual que uno que nunca se puso en rojo — por eso ahora hay un test que falla si un aviso es rojo, se declara implementado y no tiene quién lo llame; (2) el semáforo dice el SÍNTOMA («frenada») y la CAUSA sale de account_status — un mensaje urgente que no dice qué hacer es solo ansiedad, y sin match no se inventa el paso a seguir; (3) el dedup del motor es correcto para el 95% de los avisos y exactamente al revés de lo que hace falta para el rojo: lo que hace que funcione no es la frecuencia sino que NO SE DETIENE, y el propio dueño bajó 6 mensajes/hora a 1 porque tapaban el resto del grupo; (4) el rojo es de una CUENTA PUBLICITARIA, no de un workspace: ws3 (Cliente de Prueba) tiene su propia copia de las credenciales apuntando a la misma cuenta y el dueño recibió todo dos veces — y NO se arregló excluyendo ws3, porque un guard negativo se queda viejo en silencio con el próximo cliente al que se le copien credenciales. Nada de esto está en la bitácora ni en ningún hallazgos-*.md.",
    ],
    commits: [
      { sha: "a21d7bef", msg: "Los avisos de Meta existían solo como texto: nadie los emitía nunca", lineas: 435, archivos: 5 },
      { sha: "9a081c29", msg: "La alerta dice la CAUSA, no el síntoma — y grita", lineas: 232, archivos: 4 },
      { sha: "5b3ad721", msg: "La alerta avisa cada 1 hora, y una vez por CUENTA (no por workspace)", lineas: 85, archivos: 4 },
    ],
  },
];

export const PARTES: Parte[] = [
  { titulo: 'Un solo tipo', detalle: 'Se unifican `Semaforo` y `SemaforoAviso`, con `normalizarSemaforo()` para leer los nombres viejos', estado: 'hecha' },
  { titulo: 'El color sale de la paleta', detalle: '`colorDeSemaforo`/`bgDeSemaforo` derivan de `TONO`: el ámbar del semáforo no puede separarse del warning', estado: 'hecha' },
  { titulo: 'Migrar los datos', detalle: 'Pasar `amarillo`→`ambar` y `na`→`gris` en las ~48 filas de CATALOGO_AVISOS, y sacar el tipo deprecado', estado: 'cola' },
  { titulo: 'Un solo punto de pintado', detalle: 'Hoy cada pantalla dibuja su propio puntito con `colorDeSemaforo`. Falta la pieza única que lo pinte con su rótulo al lado — un color solo deja afuera a quien no lo distingue', estado: 'cola' },
];
