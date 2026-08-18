// =============================================================================
// MaKo UX/UI — el registro de construcción del área
// =============================================================================
// Alcance: el catálogo del sistema renderizado de verdad (/admin/ui) y las
// piezas que muestra — sobre todo `<Mako>`, la pieza con la que la IA habla en
// toda la app, y la gramática de sus nueve estados. Vive en app/admin/ui/ y en
// app/_ui/ (Mako.tsx, Modal.tsx, ui.css), con el contrato en
// lib/mako-gramatica.ts y el catálogo de destinos en lib/mako-capacidades.ts.
//
// De dónde salió esto: fecha, hora, sha y líneas, de `git log` sobre app/_ui/ y
// app/admin/ui/; el porqué, del cuerpo de esos commits; las trampas, de
// docs/hallazgos-ui.md (sección «Primitives y sistema visual») y
// docs/hallazgos-ia.md → «Dónde vive cada estado de MaKo».
//
// ⚠️ El detalle PEDIDO POR PEDIDO del rediseño —con las citas textuales del
// dueño— vive en `app/admin/ui/bitacora.ts` y se pinta en /admin/ui?tab=roadmap.
// Acá va la vista de área: la tanda entera con su causa y lo que dejó abierto.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

/** El título real de la sesión donde pasó casi todo esto. */
const CH = 'Parte 3 · Gramática de MaKo';

export const PARTES: Parte[] = [
  { titulo: 'Los nueve estados', detalle: 'Definen qué campos son obligatorios, no cuántas cajas hay. En pantalla son TRES formas: decisión, curso y aviso', estado: 'hecha' },
  { titulo: 'Una sola pieza: `.mk-fila` + `.mk-pill`', detalle: 'Cinco tratamientos con la misma anatomía colapsados en uno · la barra de progreso es el BORDE de la fila', estado: 'hecha' },
  { titulo: 'El detalle en `Modal`', detalle: 'La tercera caja de la casa: Confirm pregunta · Modal muestra · WizardShell conduce. 600 px, sin un solo ancho adentro', estado: 'hecha' },
  { titulo: 'Linkear en vez de redibujar', detalle: 'Si el campo se EDITA en otra pantalla, el modal lo nombra y linkea (`ver`, desde lib/mako-capacidades.ts). La excepción es el estado que BLOQUEA', estado: 'hecha' },
  { titulo: 'La gramática, aplicada en producción', detalle: 'El barrido de 42 lugares dice que NO es trabajo de vista: en los 8 «recomienda» faltan 4 de los 5 campos, ningún «analizando» tiene progreso real y ningún «ejecuta» persiste. Primero hay que producir el dato', estado: 'sigue' },
  { titulo: 'La tab «Temas»', detalle: 'El rebrand se prueba desde acá sobre la app real. La paleta y sus tokens son del área Design System', estado: 'sigue' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '9 ago', hora: '01:17', chat: CH, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El mapa de 42 lugares: lo que falta no es la vista, es el DATO',
    puntos: [
      '⚠️ **El diagnóstico obvio era el equivocado, y decidió el roadmap del área.** Parecía que aplicar la gramática de MaKo era cambiar el markup pantalla por pantalla. Barrido de 7 superficies con 16 agentes, ninguno descartado al verificar: **el campo que el estado EXIGE no está en el tipo.** En los 8 `recomienda` faltan CUATRO de los cinco campos; los 6 `analizando` no tienen progreso real (todos booleano + animación indefinida, que es lo que el propio documento prohíbe); los 3 `ejecuta` no persisten nada, viven en `useState`; y ninguno de los 5 `completo` tiene próximo control.',
      'La regla que queda: **antes de aplicar un contrato de presentación, verificá que el dato exista.** Si no existe, lo que sale no es una pieza mal estilada — es una pieza que miente con buena tipografía.',
      'Y cuatro que no son huecos sino bugs: una pantalla se traga el error y lo firma como recomendación de MaKo; otra pinta «no puedo concluir» como error rojo; un modal finge progreso con un `setInterval` de 1700 ms; y un `catch` vacío borra el motivo del fallo.',
      'Del rediseño de la pieza, la trampa de centrado: las palabras del chip no estaban centradas por tres razones y **ninguna era de ajuste fino**. `line-height: 1.45` hacía que `align-items: center` centrara la CAJA del texto y no los glifos; el padding era asimétrico, calibrado para una estrella de 12 px cuando cinco de los nueve estados usan un punto de 7; y la marca no tenía caja propia. Se resuelve con un cuadrado fijo que centra lo que le pongas adentro.',
      'Sobre la corrida: los tres intentos anteriores dejaron 21 agentes arrancados y **cero completados** — se les daban globs y salían a rastrear medio repo, así que la interrupción siempre los agarraba a mitad y el caché, que guarda por agente terminado, no guardaba nada. Con **lista cerrada de archivos y tope de hallazgos**: 16 de 16 en cuatro minutos.',
    ],
    commits: [
      { sha: '12e3ae54', msg: 'Los nueve estados, rediseñados — y el mapa dice que faltan los datos', lineas: 124, archivos: 4 },
    ],
    archivos: [
      'docs/hallazgos-ia.md — el mapa de los 42 lugares y qué campo falta en cada uno',
      'app/_ui/Mako.tsx · app/_ui/ui.css — la pieza y su CSS',
    ],
  },
  {
    fecha: '9 ago', hora: '02:46', chat: CH, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Nueve estados no son nueve formas: la madrugada de los tres replanteos',
    puntos: [
      '«Esto realmente está muy feo, no se entiende a simple vista». **El problema no era la pintura**, y en tres rondas seguidas quedó claro que el planteo estaba mal, no el estilo. Investigación sobre las guías canónicas (HAX de Microsoft, PAIR de Google, HIG de Apple) y sobre Linear, Notion, Copilot, Intercom Fin, Stripe.',
      '**Los nueve estados siguen existiendo —definen qué campos son obligatorios, que es para lo que sirven— pero frente a la pantalla el usuario se hace TRES preguntas**: ¿tengo que decidir algo? (decisión), ¿está pasando algo? (curso), ¿me estoy enterando? (aviso). Linear usa cinco tipos para sus agentes; Copilot, tres.',
      '«Está pasando algo» **dejó de ser una caja**: que MaKo esté trabajando no merece una tarjeta que ocupa el lugar de lo que sí hay que leer y encima desaparece a los segundos dejando un hueco que salta.',
      '⚠️ **El ejemplo del catálogo estaba mal elegido, y eso torcía el diseño.** Pausar anuncios SE PUEDE DESHACER, y toda la investigación converge: para lo reversible se hace y se ofrece Deshacer. NN/g lo dice seco —«if you warn people too much, they stop paying attention»—, así que gastar una confirmación en algo que se desanda deja sin efecto el día que MaKo quiera borrar algo. El ejemplo pasó a mandar una secuencia a 340 contactos, que no se desmanda.',
      '**El copy: cinco de nueve rótulos decían «MaKo».** Era la IA hablando de sí misma en vez de decir qué pasa. «MaKo detectó» → «Algo cambió», «MaKo recomienda» → «Qué conviene hacer», «MaKo vigila» → «En seguimiento» (sin objeto, se leía como que te vigilan a vos). Y «Analizando» a secas es el «Processing…» que Apple marca explícitamente como el copy a evitar: hay que nombrar la subtarea real.',
      '**El botón lleno es solo de la tarjeta que te FRENA.** Un botón lleno es un compromiso; navegar y aceptar una sugerencia no lo son. ⚠️ El primer intento lo condicionó a `esperando` y no alcanzó —«falta un dato» también espera al usuario—, así que la tarjeta menos urgente se quedó con el elemento más fuerte de la página. La condición tiene que ser la MISMA que la del tinte.',
      '⚠️ **«Campos obligatorios» no quiere decir «campos siempre visibles», y confundirlo costó tres rediseños.** Material lo nombra literal: «la card enciclopedia: intenta ahorrarle el click al usuario y termina siendo una página comprimida que nadie escanea». Queda expandir EN EL LUGAR, con las dos reglas duras de NN/g: máximo dos niveles, y el corte por **frecuencia de uso**, no por importancia percibida.',
      '⚠️ Y una que solo aparece mirando la captura: **las barras de progreso no se veían**. Adentro de una fila flex, un contenedor con solo `maxWidth` se encoge a su contenido, y como la barra mide 100% del padre el resultado era **0 px**. Existía y era invisible, justo en el estado que sin progreso no comunica nada.',
    ],
    commits: [
      { sha: '72c85c9f', msg: 'Los nueve estados, repensados de cero: tres formas, no nueve cajas', lineas: 266, archivos: 4 },
      { sha: '41fd5112', msg: 'Las tres tarjetas de «tenés que decidir» dejan de leerse iguales', lineas: 22, archivos: 2 },
      { sha: 'f1c3c23f', msg: 'La tarjeta vuelve a ser un resumen: un campo a la vista, el resto detrás', lineas: 67, archivos: 2 },
    ],
  },
  {
    fecha: '9 ago', hora: '10:20', chat: CH, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Tercer rechazo de la misma pantalla: la decisión deja de ser una tarjeta',
    puntos: [
      '⚠️ **Cuando el mismo pedido vuelve tres veces, el problema no es el que se está arreglando.** Las dos rondas anteriores arreglaron cómo se veían los elementos y ninguna preguntó por qué estaban ahí: de 25 elementos de texto se bajó a 21 y **dos de las tres tarjetas ni se tocaron**.',
      '**La causa de raíz: la tarjeta dibujaba los CAMPOS del estado en vez de la consecuencia de decidir.** `exige` se leyó como instrucción de layout, así que salía un formulario, y el `summary` del `<details>` era el índice de las etiquetas que había adentro. Se le sacaban filas al formulario y seguía siendo uno. Medido con Playwright, antes y después: **de 7/8/6 elementos de texto visibles a 2/2/2**, y de 171/198/169 px de alto a **69**.',
      '⚠️ **Lo que quedaba a la vista se elegía por POSICIÓN (`datos[0]`).** En la aprobación eso dejaba arriba «A quiénes» y escondía «Qué reciben» detrás de un click, **con el botón que manda 340 mensajes irreversibles siempre visible**: se podía aprobar un envío sin haber visto nunca qué se enviaba. Por eso `consecuencia` es un prop propio y no se deriva de `datos`.',
      '**El kicker es un ban, no un default.** El rótulo en monospace arriba del título estaba en las nueve tarjetas; el test es si dice algo que el título no diga ya, y en 3 de 4 avisos la respuesta era no. Y tres tarjetas iguales apiladas son «the lazy container» → lista con filete.',
      '⚠️ **El punto de color nunca se dibujó.** `.mk-dot` solo tenía tamaño por `.mk-status .mk-dot`, y dentro de `<Mako>` no hay ningún `.mk-status`: medía **0×0**. Había quince renglones de comentario explicando cómo alinear «una estrella de 14 px y un punto de 7» y tres rondas de ajuste fino de centrado, sobre un elemento que no existía.',
      'De la revisión adversarial (24 agentes, 7 confirmados de 20): **el control irreversible era el MENOS legible de la app** —2,81:1 en reposo, y el hover sí pasaba— ahora 6,52; el anillo de foco daba 1,45 y desaparecía en alto contraste de Windows (una prueba automatizada confirmaba que el `box-shadow` existe, y **que exista no es que se vea**); y el aviso de desarrollo no eximía a `inline`, con lo cual el falso positivo quemaba la clave del dedup y **el aviso verdadero ya no se imprimía**.',
      '**El rediseño destapó un dato falso:** decía «Enviar 340 mensajes» y son 1.020 (tres a cada uno). Con la tarjeta abierta el número queda tres veces a la vista y se ve que uno miente. Sacar la redundancia no es solo estética: es lo que deja ver los errores.',
      '`esperaAlUsuario` pasó a **`bloquea`** y lo tiene solo la aprobación: el nombre viejo agrupaba por «¿tiene botones?» cuando la pregunta es **qué pasa si no hago nada**.',
    ],
    commits: [
      { sha: '7a6c65ce', msg: 'La decisión deja de ser una tarjeta: es una fila que se abre', lineas: 680, archivos: 8 },
    ],
    archivos: [
      'app/_ui/Mako.tsx — props `consecuencia`, `advertencia`, `arrancaAbierta`; muere `const [primero, ...resto] = datos`',
      'lib/mako-gramatica.ts — `esperaAlUsuario` → `bloquea`',
      'AGENTS.md → «Un contrato de datos no es un layout» · docs/hallazgos-ui.md (3 entradas)',
    ],
  },
  {
    fecha: '9 ago', hora: '11:36', chat: CH, cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El detalle se va a un Modal — y la verificación anterior no probaba nada',
    puntos: [
      '⚠️ **El hallazgo más caro del día.** El rediseño anterior se «verificó» con Playwright —abría con clic, abría con Enter, el caret rotaba, el foco se veía— y al cambiar el `<details>` por un modal de React **nada respondía**. Causa: el árbol de la app nunca hidrataba, y lo que hacía funcionar la versión anterior es que **`<details>`/`<summary>` abre y cierra sin una línea de JavaScript**. Toda la evidencia era evidencia de que el HTML estaba bien.',
      'Cómo se detecta en una línea: `Object.keys(document.querySelector(".mi-clase")).filter(k => k.startsWith("__react"))`. Vacío = no hidrató. ⚠️ El overlay de Next (`<nextjs-portal>`) SÍ tiene fiber aunque la app no hidrate, así que hay que preguntarlo sobre un nodo de la app. **La causa quedó acotada: `next dev` no hidrata en este proyecto; `next build` + `next start` sí.**',
      '**El ancho muerto, medido:** el contenido ocupaba **603 px dentro de una caja de 1134** — 47% vacío a la derecha y el párrafo cortado al medio. La regla ya estaba escrita en AGENTS.md y se violó igual **cuatro veces, cada una con su comentario justificándola**.',
      '**La regla que queda, y vale para toda la app: el único `max-width` del diseño vive en el CONTENEDOR.** Verificado en el código fuente de tres sistemas: en shadcn/Radix el único ancho está en `DialogContent` y adentro no hay ninguno; en Notion el `max-width` de la página se APAGA al entrar al peek; Carbon usa padding porcentual —que se achica solo— en vez de un tope en px.',
      'Por eso nace `app/_ui/Modal.tsx`, **la tercera caja de la casa**: `Confirm` pregunta, `Modal` muestra el detalle, `WizardShell` conduce un flujo. Son tres cosas distintas, no tres tamaños de lo mismo.',
      '⚠️ **La barra de progreso pintaba 1% con el dato en 62%.** `MakoProps.progreso` va de 0 a 1 y `Progress.value` de 0 a 100; los dos son `number` y el compilador no ve nada. Se le había ajustado el ancho **tres veces sin mirar el valor**. Si algo se ve mal y ya lo ajustaste tres veces, el problema no es el estilo — es el dato.',
      'La fila se copió de la lista de advisories de GitHub: píldora de estado **inline al final del título** y no alineada a la derecha, porque con nombres de largo distinto a la derecha dejan el borde izquierdo dentado fila por fila.',
    ],
    commits: [
      { sha: '7128270e', msg: 'WIP: el detalle de una decisión pasa a un modal de 600 px', lineas: 687, archivos: 6 },
      { sha: '6021bcf5', msg: 'El detalle de una decisión se va a un modal, y el ancho muerto se muere', lineas: 349, archivos: 7 },
      { sha: '97690156', msg: 'Cosecha: el clic SÍ se pudo verificar, y la causa quedó acotada', lineas: 46, archivos: 3 },
    ],
    archivos: [
      'app/_ui/Modal.tsx — NUEVO: header + cuerpo que scrollea + pie, ESC, foco atrapado y devuelto, pila de modales',
      'docs/hallazgos-infra.md — la receta para probar una interacción y el chequeo de una línea que distingue «el DOM cambió» de «el handler corrió»',
    ],
  },
  {
    fecha: '9 ago', hora: '12:40', chat: CH, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Cinco «piezas» eran una pieza con cuatro juegos de números',
    puntos: [
      '**No era que faltara aplicarles el mismo estilo a las otras cuatro secciones: era que no tenían por qué existir por separado.** Convivían cinco tratamientos —fila, línea con barra suelta, tarjeta con caja, caja crema y pastilla— y los cuatro primeros **ya tenían la misma anatomía** (marca de 16 px, columna de texto que se estira, riel derecho): diferían solo en el relleno, el separador y qué iba en el riel. Cada uno se escribió en una sesión distinta resolviendo su caso, y ninguno miró al de al lado.',
      'Queda **`.mk-fila`** —con el modal como su segunda capa, no como un tratamiento aparte— y **`.mk-pill`**. Lo único que cambia entre los tres usos: decisión → riel con el cuándo, abre · en curso → riel con el porcentaje, no abre · aviso → riel con importancia y cuándo, abre.',
      '⚠️ **La duplicación de la píldora la creé yo en la ronda anterior**: hice `.mk-dec__pill` y dejé `.mk-mako--chip` viva. El criterio para saber si hacen falta dos lo publica Primer y son dos ejes —¿es clickeable?, ¿el vocabulario es cerrado?—: los nueve estados caen los dos en la misma celda. Polaris tiene UN Badge; Material 3 tiene cuatro chips con nombres distintos y **la caja es idéntica en los cuatro**.',
      '**Cajas adentro de cajas:** los avisos eran cuatro tarjetas dentro de una `Section card`. Es el «nested cards are always wrong» que ya se había citado para sacarle la caja a las decisiones y no se aplicó abajo.',
      '**La barra de progreso suelta no la usa nadie.** Medido sobre el DOM real: GitHub Actions no dibuja ninguna y el estado ocupa el MISMO slot que la duración; Uppy la pone absoluta, 2 px, pegada al borde de la fila y a ancho completo; Geist lo dice textual: «the bar alone doesn\'t say what\'s progressing». Ahora es **el borde de la fila**, el porcentaje va al riel y la fuente y el avance a la segunda línea.',
      '**La sugerencia pegada al dato pierde la caja.** Copilot no le pone ni fondo ni borde, Attio tiñe la CELDA, Grammarly subraya el texto y se lleva la tarjeta afuera. Queda un filete dorado al costado. Y una sola acción: «Asignar a Carolina» al lado de un valor que ya decía «Carolina» repetía el dato adentro del botón.',
      'La regla que queda en AGENTS.md: **antes de estilar una pieza «parecida» a otra, poné las dos anatomías al lado.** Si comparten esqueleto, es una pieza con dos configuraciones, y mantenerlas separadas garantiza que diverjan.',
    ],
    commits: [
      { sha: '41b7ab0d', msg: 'Las cinco formas de MaKo eran una sola: queda la fila y la píldora', lineas: 425, archivos: 6 },
    ],
    archivos: [
      'app/_ui/ui.css — `.mk-fila*`, `.mk-pill*`, `.mk-inline*`; mueren `.mk-dec*` y `.mk-mako--chip/--curso/--inline`',
      'app/_ui/Mako.tsx — `Fila` y `Pill` reemplazan a `Decision` y a las tres ramas',
    ],
  },
  {
    fecha: '9 ago', hora: '20:21', chat: CH, cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El modal linkea a la tab que ya lo resuelve, y el catálogo mentía en dos filas',
    puntos: [
      'Pedido del dueño: «un mapeo COMPLETO de en qué escenarios se usan estas cosas, y personalicemos por cada escenario — no cosas genéricas. Dejando links, como los mensajes de nutrición: no mostrar la secuencia allí, sino permitirles verla yendo a la tab correspondiente».',
      'Mapeadas las 8 áreas de la app. **Tres tests, y manda el primero que aplica:** (1) ¿el estado BLOQUEA? → el modal MUESTRA, aunque exista pantalla propia — *una aprobación que linkea es una aprobación que se da sin leer*; (2) ¿ese campo se EDITA en algún lado? → LINK, porque un modal que dibuja lo que otra pantalla edita queda viejo respecto de ella y nadie se entera; (3) ¿hay URL que seleccione la entidad? Si no hay, el modal es el hogar. Cuando linkea, la evidencia es **una muestra y el conteo**, nunca la lista.',
      'La prop nueva es `ver: { capacidad, ancla?, label? }` y sale de una **lista cerrada**, no es un href. ⚠️ **Y eso ya estaba pasando: el catálogo mentía en dos filas** —`nutricion` decía tab «Chat Agent» con ruta `/chat-agent` cuando la tab se llama Chatbot y esa ruta es un REDIRECT; `metricas` mandaba a `/dashboard`, que redirige a `/marketing`—. **Una ruta que es un redirect no es un destino:** el rebote se ve como lentitud, no como error.',
      '**Elegir el estado ES elegir si se redibuja.** El ejemplo del dueño cambió de estado de paso: la secuencia de nutrición es `completo`, no `aprobacion`, porque nace PAUSADA — MaKo hizo algo reversible y te lo cuenta. Elegir `aprobacion` habría OBLIGADO a meter los cinco mensajes en 600 px.',
      '⚠️ **Lo que el mapeo encontró y no se ve en el commit:** `<Mako>` **no tiene un solo call-site de producción**; lo que hoy actúa de MaKo son 8 modales a mano de 200 a 1.040 líneas. El riesgo no es el contrato: es escribir la fila nueva AL LADO de la vieja y quedarnos con las dos.',
      'Y el orden correcto para lo que sigue: **anclas primero, modales después.** `/chatbot` no tiene un solo `useSearchParams` en toda la carpeta y `/experimentos` tampoco (su tab es un `useState`), así que hoy todo link cae en la pantalla por default.',
    ],
    commits: [
      { sha: 'a83efbd9', msg: 'El modal linkea a la tab que ya lo resuelve, en vez de redibujarla', lineas: 335, archivos: 6 },
    ],
    archivos: [
      'lib/mako-capacidades.ts — la lista cerrada de destinos, que es de donde salen todos los links',
      'docs/hallazgos-ia.md → «Dónde vive cada estado de MaKo» — el mapa de escenarios completo',
    ],
  },
  {
    fecha: '11 ago', hora: '01:45', chat: 'Productos X Funnels', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra de scroll no se esconde, y el registro se parte por PREGUNTA',
    puntos: [
      '«La sidebar se ve horrible con esa barra de scroll». La barra nativa de Windows es blanca, ancha y opaca: sobre el rail oscuro es lo más brillante de la pantalla y se lee como un elemento de la interfaz, no como un control. `.mk-scroll-oscuro` la adelgaza a 6 px y le pone el color de línea de la propia isla.',
      '⚠️ **No se esconde, y eso es a propósito.** `scrollbar-width: none` sacaría la única señal de que abajo hay más destinos — que es exactamente lo que ya prohíbe la regla de las barras de navegación. **Un control feo se arregla; un destino invisible no se descubre nunca.** La causa de fondo (que la familia Dev llegó a 12 filas) es otra cosa y se trata aparte: la columna no crece, se agrupa.',
      'La pantalla de cada área apilaba CINCO paneles bajo una sola tab. Con un registro real (16 fases y 6 hitos con sus puntos) eso son cuatro pantallas de scroll para llegar a los commits, y el Roadmap —que es lo que se viene a mirar— queda como la intro de algo más largo.',
      '**El corte NO es por longitud sino por PREGUNTA:** «¿qué falta?» (Roadmap) y «¿qué pasó?» (Historial) son dos preguntas distintas y nadie las hace a la vez. Partir por longitud da tabs arbitrarias que después nadie sabe dónde buscar. El molde es el de /admin/ui, con la tab en `?tab=` leída en el server.',
      'De paso: **las dos secciones de la tab Roadmap se llamaban IGUAL.** Un `<h3>` decía «Roadmap» al lado del Roadmap escrito a mano, y el subtítulo chiquito no alcanzaba para distinguirlas. Dos títulos idénticos en la misma pantalla no son un detalle de copy: son dos cosas que el lector no puede separar.',
    ],
    commits: [
      { sha: '9204fc7f', msg: 'La barra de scroll deja de gritar, y el registro se parte en dos preguntas', lineas: 81, archivos: 4 },
    ],
    archivos: [
      'app/_ui/ui.css — `.mk-scroll-oscuro`, la RED por si igual desborda; nunca el arreglo',
      'app/admin/dev/[area]/RegistroArea.tsx — las dos tabs, con el badge de cada una',
    ],
  },
];
