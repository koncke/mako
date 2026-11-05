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
  {
    fecha: '17 oct', hora: '06:20', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'La sidebar nueva: Ops Center arriba, dos familias, todo en inglés',
    pedido: "\"Ops Center\" no debería estar en la sección de Admin en la sidebar: debería estar donde \"Second Brain\", con una criatura tipo ícono, moviéndose como siempre... Lo mismo para los otros workspaces, ya que Second Brain sigue estando en la sección de \"analize\" y no debería. Dashboard debería estar dentro de la sección \"Operate\", ya que se quedaría sola \"analize\", y la deprecamos. Y también elimina \"Content Machine\" y que todo esté dentro de \"Sales Machine\"... Y mejora el diseño de la sidebar: investiga, copia de otras apps... Y \"Calendario\" debería ser \"Calendar\": siempre todo en inglés los nombres de las tabs. También quiero eliminar todas las tabs de la sidebar de \"Admin\": estoy seguro de que la mayoría ya tienen lugares donde podrían vivir...",
    puntos: ['Llegó por el Cerebro, con el pedido de unificar Email y WhatsApp en Chats (esa parte está en la bitácora de Chats).'],
  },
  {
    fecha: '17 oct', hora: '09:40', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'La sidebar nueva, copiada de Linear, Notion y Attio',
    puntos: [
      'Arriba, sin rótulo: Ops Center (sólo el super admin) y Second Brain (todos), cada uno con su criatura del Ops Center, que flota y parpadea.',
      'Dos familias: Operate (General, Plan, Calendar, Dashboard · CRM, Chats, Ads Manager · Clients) y Sales Machine (Offer · Web Generator, Automations · Video, AI Avatar, Image, Copywriting). Las familias van abiertas y cada una se pliega sola; sin cajas.',
      'Las tabs de Admin viven en la tab que hace su trabajo, sólo para el super admin: MaKo WhatsApp en Chats, MaKo Messages en Automations, Strategy y Playbook en Offer, el método en Copywriting, Billing y Agents en Clients. Contexto, Modelos IA, Conocimientos y Dev, en el menú de la foto.',
      'Ninguna ruta cambió. El mapa de cada tab, en docs/diseno-sidebar.md.',
    ],
    archivos: ['app/_components/nav.ts', 'app/_components/Sidebar.tsx', 'app/_components/Criatura.tsx', 'lib/movil-rutas.ts', 'app/m/mas/page.tsx', 'tests/sidebar-nueva.test.ts'],
    revisar: '/general',
  },
  {
    fecha: '17 oct', hora: '11:30', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Claro u oscuro, lo elige cada persona en la computadora',
    puntos: [
      'El interruptor de luna y sol vuelve al lado de la foto de la barra (con la barra abierta). Claro por defecto: oscuro sólo si la persona lo elige, nunca por el sistema.',
      'La elección se aplica antes de pintar y se mantiene al navegar; nunca en una página pública.',
      'Queda pendiente por área: 43 archivos con un fondo blanco escrito a mano y las pantallas que fuerzan oscuro (el onboarding, avisado).',
    ],
    archivos: ['app/_components/ModoArranque.tsx', 'app/_components/ModoDelUsuario.tsx', 'app/_components/TemaCandidato.tsx', 'tests/tema-por-persona.test.ts'],
    revisar: '/general',
  },
  {
    fecha: '18 oct', hora: '00:15', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: la sidebar del prototipo, en la computadora y en el teléfono',
    pedido: 'la sidebar es confusa, copiá otras apps',
    puntos: [
      'Arriba, sin título, lo de todos los días: Plan, Chats y Dashboard. Abajo, Sales, Marketing y Create, cada una con su color.',
      'Home salió de la barra: el Dashboard abre en Focus. La barra va abierta y una flecha la pliega.',
      'Ctrl K busca tabs, pantallas y ajustes; «home» lleva al Dashboard.',
      'El menú de la foto empieza con tu foto real, tu nombre y tu @usuario, y abre My Profile.',
      'En el teléfono, More empieza con tu foto real; la barra de abajo es CRM · Chats · Dashboard · Plan · More.',
      'Sin hacer: «My leads» y «My tasks» en My Profile (falta un filtro de lo tuyo) y la barra de abajo flotante.',
    ],
    archivos: ['app/_components/nav.ts', 'app/_components/Sidebar.tsx', 'app/_components/BuscadorNav.tsx', 'lib/movil-rutas.ts', 'app/m/mas/page.tsx', 'tests/sidebar-nueva.test.ts'],
    revisar: '/crm',
  },
  {
    fecha: '18 oct', hora: '09:30', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: «Ops Center» con la estrella en todos los negocios',
    pedido: 'En todos los clientes también debe llamarse la tab «Ops Center» en lugar de «Second Brain» y tener la criatura de estrella',
    puntos: [
      'La fila de arriba de cada negocio se llama Ops Center y lleva la estrella, en la computadora y en el teléfono. Abre lo mismo que antes.',
      'Nadie ve dos: el super admin sigue viendo sólo el suyo.',
      'Ctrl K con «second brain» o «cerebro» sigue llevando ahí.',
      'Sin hacer: los textos de MaKo todavía dicen «Second Brain → …».',
    ],
    archivos: ['app/_components/nav.ts', 'app/_components/Sidebar.tsx', 'lib/buscador-nav.ts', 'lib/centro-chats.ts', 'tests/sidebar-nueva.test.ts'],
    revisar: '/second-brain',
  },
  {
    fecha: '20 oct', hora: '18:30', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: la barra sigue el modo y el Ops Center va dentro de Today',
    pedido: 'La sidebar, si estoy en dark mode se debe adaptar a white mode, lo contrario... quiero que Ops center esté dentro de la sección de «Plan, chats y dashboard»',
    puntos: [
      'La barra es blanca en modo claro y oscura en oscuro; las criaturas mantienen su color en los dos.',
      'El Ops Center va primero dentro de «Today» (Plan, Chats, Dashboard), que tiene título y se pliega; todo arranca desplegado.',
      'MaKo Partners está en el menú de la foto (sólo agencias), en la computadora y en el teléfono.',
      'Plegada la barra, el logo queda centrado. Al entrar al Ops Center la barra se pliega; la flecha la abre ahí.',
      'Sin hacer: las barras oscuras de otras pantallas siguen colgadas de los colores de la barra (docs/hallazgos-ui.md).',
    ],
    archivos: ['app/_components/Sidebar.tsx', 'app/_components/nav.ts', 'app/_ui/ui.css', 'app/admin/operaciones/Muneco.tsx', 'lib/movil-rutas.ts', 'tests/sidebar-nueva.test.ts'],
    revisar: '/crm',
  },
  {
    fecha: '21 oct', hora: '17:10', chat: 'Sidebar', sesion: "local_789aebfb-8196-468e-96d2-1f4964c12a1c", cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: MaKo en una ventana chica de escritorio',
    pedido: 'MaKo se rompe apenas la ventana es un poco más angosta que la pantalla completa',
    puntos: [
      'Por debajo de 1200 px de ancho la barra arranca plegada a íconos; la flecha la deja abierta.',
      '/integraciones sin scroll de costado, con los nombres y los motivos enteros; Configuración del negocio deja más lugar al contenido.',
      'La ficha de un servicio: el panel oscuro se angosta y ya no se corta abajo.',
      'Medido contando a 934, 1027 y 1283 de ancho. Sin mirar: 768 de alto ni tableta.',
    ],
    archivos: ['app/_components/Sidebar.tsx', 'app/_ui/ajustes.css', 'app/globals.css', 'app/integraciones/IntegracionesBoard.tsx', 'tests/ventana-chica.test.ts'],
    revisar: '/integraciones',
  },
  {
    fecha: '23 oct', hora: '17:30', chat: 'Rendimiento y loaders', sesion: "local_1c58f6ef-9076-48da-a3ae-1c9915dbe834", cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: un loader con la criatura en todas las tabs, y más rápido',
    pedido: 'Al abrir Automations tarda mucho... cuando entro a Second Brain tarda muchísimo, y ni siquiera hay un loader. Los loader de las tabs, que sean todos como el de Ops Center, con la criatura de MaKo',
    puntos: [
      'Todas las tabs grandes muestran la criatura con una barra que corre apenas se toca la tab (a los 0,1-0,5 s); antes, 2 a 5 s sin nada.',
      'Automations se puede usar a los 2-3,5 s (antes 15 s); /api/auth/me, que se pide en cada carga, pasó de 4,9 s a 0,6 s.',
      'La Ticketera y el Uso de IA del Ops Center ya no esperan detrás de la lectura de Vercel.',
      'Sin hacer: el Dashboard todavía tarda 4-6 s; la región de las funciones va en otro tren.',
    ],
    archivos: ['app/_ui/CargandoMako.tsx', 'lib/sesion-por-pedido.ts', 'app/api/operaciones/lectura/route.ts', 'app/automations/ChatAgentApp.tsx', 'tests/cargando-mako.test.ts', 'tests/rendimiento-pedido.test.ts'],
    revisar: '/automations',
  },
  {
    fecha: '23 oct', hora: '20:10', chat: 'Rendimiento y loaders', sesion: "local_1c58f6ef-9076-48da-a3ae-1c9915dbe834", cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: al terminar de cargar, la criatura vuela a su lugar',
    pedido: 'Todos los loaders que tengan la figura de MaKo, luego de terminar de cargar, la figura de MaKo se debe ir a su lugar, como lo hace en ops center',
    puntos: [
      'En CRM, Plan, General y Clients vuela a la estrella de abajo; en el teléfono, a la criatura de la barra; en el Ops Center, como siempre.',
      'Es el mismo movimiento del Ops Center, y la pantalla se puede usar mientras vuela.',
      'Con movimiento reducido no vuela; donde no hay criatura (Chats, Calendario, Web Generator, Ads, Video, Image, Copywriting, Offer) se va como antes.',
      'Sin hacer: en Automations el chat está escondido al terminar de cargar; falta que su chat marque el lugar.',
    ],
    archivos: ['app/_ui/vuelo-mako.ts', 'app/_ui/VueloDeCarga.tsx', 'app/m/_ui/EntradaApp.tsx', 'app/second-brain/EntradaOps.tsx', 'tests/vuelo-mako.test.ts'],
    revisar: '/crm',
  },
  {
    fecha: '23 oct', hora: '20:50', chat: 'Rendimiento y loaders', sesion: "local_1c58f6ef-9076-48da-a3ae-1c9915dbe834", cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: Plan y Second Brain conservan el loader sin el riesgo de General',
    pedido: 'Que no aparezca el error de General en la pantalla que Martín abre todos los días',
    puntos: [
      'Plan (para el super admin) y Second Brain (para quien opera) mandan a su pantalla antes del loader, como un salto normal del servidor.',
      'El loader sigue para todos los demás.',
      'Sin probar en producción con la cuenta de Martín: la sesión del Chrome conectado no es super admin.',
    ],
    archivos: ['app/plan/layout.tsx', 'app/second-brain/layout.tsx', 'lib/pedido-actual.ts', 'proxy.ts', 'tests/redirige-antes-del-loader.test.ts'],
    revisar: '/plan',
  },
  {
    fecha: '25 oct', hora: '03:30', chat: 'Automations', sesion: 'local_f1f2610a-6994-4bbf-8ad4-dff49fe09b49', cuenta: 'claude5', actor: 'claude', tipo: 'correccion',
    titulo: 'La criatura de MaKo ya no se esconde detrás de la barra desplegada',
    puntos: [
      'Lo marcó Martín en su llamada con Leandro del 24/10: con la barra de la izquierda abierta, la criatura volaba a su lugar y desaparecía.',
      'Con la barra abierta, la estrella de abajo se corre al lado y la criatura se ve llegar.',
    ],
    archivos: ['app/_chat/MakoEnLaTab.tsx', 'app/_chat/borde-barra.ts', 'tests/estrella-al-lado-de-la-barra.test.ts'],
    revisar: '/crm',
  },
  {
    fecha: '28 oct', hora: '03:16', chat: 'CRM y Chats', sesion: 'local_61bd6f00-153b-4b0e-8860-b021cd730759', cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: todos los chats de MaKo adjuntan, y tu audio sale en el acto',
    pedido: '«Revisa... que esté unificado, que se pueda utilizar el chat de la misma manera en todos lados» (Martín, 28/10, por el Cerebro).',
    puntos: [
      '**Adjuntar, en todas las cajas:** archivos, capturas y documentos también en Soporte, el asesor de WhatsApp, Editar con MaKo, ChartIA, Diagnóstico y los editores de Imagen y Video. Donde la IA lee sólo texto, MaKo lee cada archivo y se lo pasa como un dato, nunca como una orden.',
      '**Tu audio, en el acto, en todas:** se ve y se escucha apenas lo grabas, y se pasa a texto por detrás. Lo que escribes después sale detrás de él.',
      '**Los 3 puntos** mientras MaKo escribe, también en Soporte.',
      '**Lo que una caja no tiene, escrito con su porqué** en un solo lugar: si nace una caja sin adjuntos o sin voz, un test da rojo.',
      'En producción desde el 28/10 a las 04:53 (dbe271979). Faltaba el chat nuevo del Ops Center: va aparte.',
    ],
    commits: [
      { sha: 'cea580b7c', msg: 'Cajas de chat unificadas, tanda 1: la lista con su porqué, el barrido y la nota de voz en el acto', lineas: 690, archivos: 26 },
      { sha: 'b6680844d', msg: 'Soporte · los 3 puntos', lineas: 120, archivos: 5 },
      { sha: '001b27faf', msg: 'Tanda 2: el asesor de WhatsApp, Editar con MaKo y MakoChat adjuntan fotos y PDF', lineas: 537, archivos: 20 },
      { sha: '250d572ea', msg: 'Tanda 3: el Image y el Video Editor adjuntan fotos y PDF', lineas: 231, archivos: 16 },
      { sha: '025bf9089', msg: 'La revisión: la lectura con plazo y como dato, y la nota atada a su conversación', lineas: 509, archivos: 24 },
    ],
    archivos: [
      'lib/cajas-de-chat.ts — cada caja y lo que no tiene, con su porqué',
      'app/_chat/useNotaEnElActo.ts · notas-en-el-acto.ts · useAdjuntosDelChat.ts',
      'lib/adjuntos-del-chat.ts · lib/mako-adjuntos.ts — la lectura en el servidor, con plazo y como dato',
      'tests/cajas-de-chat-unificadas.test.ts · adjuntos-chats-de-texto.test.ts',
    ],
    revisar: '/dashboard?ws=3',
  },
  {
    fecha: "5 nov", hora: "18:05", chat: "Iniciativa (nube)", sesion: "cli_d5a9b850-5f45-5173-b8c4-5c551ce46310", cuenta: "nube",
    actor: "claude", tipo: "implementacion",
    titulo: "MaKo toma la iniciativa en Create: el ejemplo pregunta para cuál de tus ofertas es",
    puntos: [
      "Al abrir una plantilla, el primer mensaje de MaKo pregunta un hecho, «¿Para cuál de tus ofertas es?», con tus ofertas como botones, en vez de «¿Lo adapto a tu negocio?».",
      "La tarjeta de MaKo de cada tab de Create ya puede mostrar lo que esa tab pregunta primero.",
    ],
    revisar: "/copywriter",
    archivos: [
      "app/_crear/ejemplo.ts — la pregunta de pasoOferta con la frase del ejemplo",
      "app/_crear/PantallaCrear.tsx — reenvía `apertura` a la tarjeta del Cerebro",
      "tests/iniciativa-create.test.ts — probado rompiéndolo (2 roturas)",
    ],
  },
];
