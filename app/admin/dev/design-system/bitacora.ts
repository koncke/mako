// =============================================================================
// Design System — el registro de construcción del área
// =============================================================================
// Alcance: el PROGRAMA DE ADOPCIÓN del sistema visual. No es el catálogo (eso
// es MaKo UX/UI, en /admin/ui): es la capa de abajo — los tokens de
// `app/globals.css`, el dorado de la marca, la paleta del rebrand con sus dos
// modos, y la deuda de los estilos inline que todavía no consumen nada de eso.
//
// De dónde salió esto: fecha, hora, sha y líneas, de `git log` sobre
// app/globals.css, lib/temas-candidatos.ts y app/_components/Tema*.tsx; el
// porqué de cada decisión, del cuerpo de esos commits (en este repo son largos
// y explican el motivo); las trampas y lo que quedó sin hacer, de
// docs/hallazgos-ui.md (entradas «El dorado no significa MaKo», «Un transition
// sobre una custom property», «Un preview global que se apaga a medias» y «Una
// lista blanca de UNO») y de docs/hallazgos-second-brain.md.
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Un solo dorado', detalle: '#F2B01E como `--mako`; los cuatro dorados de la casa quedaron como alias apuntando al mismo token', estado: 'hecha' },
  { titulo: 'Los tokens que faltaban', detalle: '`--on-ink` («se lee sobre un relleno de tinta») y `--faint` devuelto a placeholders · el contraste medido, no estimado', estado: 'hecha' },
  { titulo: 'El dorado con restricción semántica', detalle: '`--accent` sigue siendo el token dorado MÁS usado de la app y no significa MaKo: marca la tab activa, un KPI, un avatar sin foto. Sin esa restricción, el rebrand repinta 21 hexes y a los tres meses hay 22', estado: 'sigue' },
  { titulo: 'La paleta True North', detalle: 'Nord + el azul de Meta bajado hasta pasar AA · los dos modos resueltos · vive bajo `[data-tema-candidato]` y solo se aplica en el Cliente de Diseño (ws 4)', estado: 'sigue' },
  { titulo: 'Modo claro/oscuro para todos', detalle: 'Construido y REPLEGADO: se le prendió solo a clientes que tenían el sistema operativo en oscuro. Vuelve cuando el rebrand cierre su cola de contraste', estado: 'cola' },
  { titulo: 'La adopción: los estilos inline', detalle: 'Medido el 17/08 sobre app/**/*.tsx: **8.906** `style={{…}}`. Un inline le gana a cualquier clase, así que cada uno es una superficie a la que el sistema no llega', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '9 ago', hora: '03:11', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'cosecha',
    titulo: 'Un token de área valía EXACTAMENTE el dorado de la marca',
    puntos: [
      '`--grafo-norte` era, byte a byte, `#F2B01E` = `--mako`. En el mapa del Second Brain el nodo `fase` se pinta con `--mako` porque está destacado y sus vecinos del área Norte con `--grafo-norte`: **el único nodo dorado con significado era indistinguible de cuatro nodos comunes**. No hay error, no hay pantalla rota — hay un color que dejó de decir algo.',
      'La regla que queda, y es la que gobierna todo lo que se pinte después: **`--mako` y `--warn-fill` se pintan por ESTADO, nunca por área.** Ningún área puede usarlos. `--grafo-norte` pasó a `#BFC8DC`.',
      'Y la comprobación que casi nadie corre: bajo deuteranopía `--mako` y `--warn-fill` colapsan entre sí, así que esa zona tenía **tres** clases que para ~6% de los hombres eran **dos**. Dos tokens distintos no son dos señales hasta que se verifica que se distinguen.',
    ],
    commits: [
      { sha: 'e4c2957e', msg: 'Cosecha del rediseño de Second Brain, y el dorado que se pisaba', lineas: 204, archivos: 4 },
    ],
    archivos: [
      'app/globals.css — el bloque de tokens de marca y los de área del grafo',
      'docs/hallazgos-second-brain.md — la colisión de tokens y lo que quedó sin hacer, con números',
    ],
  },
  {
    fecha: '13 ago', hora: '15:32', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'investigacion',
    titulo: '«La marca se siente muy IA»: el diagnóstico obvio era el equivocado',
    puntos: [
      '⚠️ **El hallazgo más caro del área.** El dueño dijo que la marca se sentía a IA y todo apuntaba a la chispa de cuatro puntas, el ícono que usa media industria. El inventario de **148 superficies verificadas una por una** (13 agentes, cada afirmación con archivo:línea reabierto) dice otra cosa: **el problema es el dorado, no el símbolo**.',
      'En ~25 superficies el dorado **no marca a MaKo**: marca la tab activa, el ícono de encabezado de casi toda pantalla, el avatar de alguien sin foto, el número grande de un KPI, un link de texto, el ON de un toggle. Y la rotura más cara: en `MakoChat.tsx` —la pantalla donde MaKo habla— el dorado pinta la burbuja del **humano**.',
      '**La cadena que explica el síntoma:** si el color ya no distingue, la única señal que queda es la chispa; una chispa sola repetida en todas partes ES el aspecto de IA genérica. No se anunciaba de más — se anunciaba con **una sola señal** porque la otra ya no servía.',
      '**Causa raíz, y sigue viva:** `--accent` y `--accent-soft` son el mismo dorado con otro nombre y **sin la restricción semántica**. El comentario del archivo dice «no agregues usos nuevos» y `var(--accent)` es hoy el token dorado más usado de la app. Un alias sin regla es una puerta abierta: nadie que escribe `var(--accent)` está pensando en MaKo, está pensando «resaltá esto».',
      'Lo que hay que hacer ANTES de tocar un hex de marca: hay **21 hexes dorados distintos** vivos —cuatro de ellos declarados eliminados y todavía escritos a mano— y **6 glifos de estrella** conviviendo (la chispa vectorial, `✦`, `✨`, `★`, `🌟` y una de cinco puntas dibujada a mano). Repintar sin cerrar `--accent` deja 22.',
    ],
    commits: [
      { sha: '9af5dad9', msg: 'El dorado no significa MaKo: significa destacado', lineas: 126, archivos: 2 },
    ],
    archivos: [
      'docs/hallazgos-ui.md → «El dorado no significa MaKo» — el inventario completo con archivo:línea',
      'app/globals.css — donde vive `--accent` / `--accent-soft`, que es lo que hay que cerrar primero',
      'app/_components/MakoBrand.tsx · app/compartido/[token]/TareaCliente.tsx — el dorado redeclarado a mano fuera del sistema',
    ],
  },
  {
    fecha: '14 ago', hora: '23:13', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Tres intentos de cambiar un color que no podían funcionar: estaba inline',
    puntos: [
      '«Se sigue viendo EXACTAMENTE igual», tres veces. Tenía razón las tres, y **el problema nunca fue el valor del color**: el botón lo pintaba con `style={{ color }}` porque «depende del tone». Un estilo inline le gana a cualquier clase, así que la regla del CSS existía, se aplicaba, y el inline la pisaba. Cambiar el hex **no podía** cambiar nada en pantalla.',
      '⚠️ **Y era el mismo bug ya arreglado en ese mismo botón.** El fondo y el borde habían estado inline por la misma razón, se movieron a la clase, y quedó el comentario explicándolo… con el `color` justo abajo, todavía inline, y una línea diciendo «lo único que sigue inline es el color, que depende del tone». Se escribió la excepción en vez de ver que era el mismo caso.',
      'La regla: **lo que depende de una variante viaja como atributo (`data-tone`), no como estilo inline.** Así una barra puede redefinirlo por especificidad, que es justamente lo que el sistema de diseño existe para permitir.',
      'Por qué esto es EL problema del área y no una anécdota: los estilos inline son la deuda declarada del programa de adopción —medidos hoy, 8.906 en `app/**/*.tsx`— y cada uno es una superficie donde ningún token, ningún tema y ningún rebrand llegan. El síntoma siempre es el mismo: se toca el CSS y no pasa nada.',
      'El test también mentía: solo miraba el fondo y el borde, así que pasaba en verde sobre un botón que no se podía repintar. Ahora exige las dos cosas — que no vuelva el color inline **y** que exista el tono por atributo.',
    ],
    commits: [
      { sha: 'c9fef41e', msg: 'integraciones: el color del ícono estaba INLINE, por eso los tres intentos no hacían nada', lineas: 34, archivos: 3 },
    ],
  },
  {
    fecha: '16 ago', hora: '13:48', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El rebrand se prueba sobre la app real, no sobre una maqueta',
    puntos: [
      'Una maqueta siempre se ve bien: tiene siete filas y datos inventados. **Lo que decide si una paleta sirve es el CRM con 946 leads**, el tablero del plan y un gráfico de gasto. Por eso el tema se elige en `/admin/ui?tab=temas` y se aplica a TODA la app, con un chip fijo que te sigue a todas las pantallas con el interruptor y la salida.',
      'Los tres candidatos son mixes de **Nord + el azul de Meta**: `#0B5EE5`, que es el azul de «Modern Minimal» bajado de luminosidad hasta pasar AA — y queda a un hex de `#0866FF`, el de Meta.',
      '**Los hexes viven SOLO en `globals.css`**, dentro de `[data-tema-candidato="…"]`. `lib/temas-candidatos.ts` trae el catálogo (nombre, idea, falla) y no repite un solo hex; la tabla de la tab los LEE con `getComputedStyle` sobre sondas ocultas, así que **no puede desincronizarse de lo que se aplica**. Es «una cosa, un lugar» aplicada a un color.',
      '⚠️ **Un `transition` sobre una custom property no se ve.** Declarada en `:root` sobre `--bg` y compañía, el cambio de tema salta de golpe: una variable no pinta nada por sí misma, lo que se ve es el `background-color` de CADA elemento que la consume. La transición va en los **elementos**. Cómo se comprueba sin ojímetro: clickear, esperar 200 ms y leer `getComputedStyle(...).backgroundColor` — si devuelve un valor intermedio, corre; si devuelve uno de los dos extremos, saltó.',
      '⚠️ **El que prende dos cosas apaga dos cosas.** El preview maneja `data-tema-candidato` (el tema) y `data-tema` (el modo), y al salir solo se sacaba el primero: la app quedaba en oscuro sin tema y **sin ningún control a la vista para volver**. El test de aceptación no es «se ve normal»: es que los tokens vuelvan a los valores de fábrica.',
      'El tema tiene que estar puesto ANTES del primer pintado o la app parpadea del tema viejo al nuevo en cada navegación: de ahí el `<script>` inline en el layout.',
    ],
    commits: [
      { sha: '7a1b807a', msg: 'ui: tab «Temas» — probar el rebrand sobre la app real, no sobre una maqueta', lineas: 704, archivos: 6 },
    ],
    archivos: [
      'app/globals.css — el bloque «Temas candidatos»: los únicos hexes',
      'lib/temas-candidatos.ts — el catálogo (nombre, idea, falla), sin un solo hex',
      'app/_components/TemaCandidato.tsx — el arranque sin fogonazo y la salida',
    ],
  },
  {
    fecha: '16 ago', hora: '15:49', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Cliente de Diseño, y el momento peligroso de una lista blanca',
    puntos: [
      'Un workspace de prueba aparte (id 4) dedicado a mirar el rediseño. En el 3 se prueba que las cosas **funcionen**; en éste, cómo se **ven**. Separados porque un reset a mitad de una prueba de tema te deja sin datos, y un cambio de tema te ensucia la prueba funcional.',
      '⚠️ **El riesgo no está en pasar de 1 a 2: está en pasar de 2 a 3.** El guard destructivo pasó de un número (`WS_PRUEBA`) a una lista, y sigue siendo POSITIVO —enumera lo que se puede, nunca «distinto del dueño»— porque en su versión negativa este guard ya se rompió una vez y el botón de vaciar aparecía dentro de **todos** los clientes reales. Con un solo id la igualdad estricta se defiende sola; con dos aparece la tentación de «mejor pregunto si NO es un cliente real», que es el bug anterior reescrito.',
      'Por eso hay **un test que fija el largo de la lista en 2**. No es ceremonia: es lo que obliga a que un tercer workspace pase por ahí y se justifique en vez de colarse en un push. Y el test que importa no es el que prueba que el de prueba pasa — es el que prueba que **los clientes reales siguen sin pasar**, con varios ids a la vez.',
      'Cómo se verifica en la pantalla, que es donde se ve el agujero: entrar a un cliente REAL y **contar los botones peligrosos**. Medido sobre ws 5: cero temas, cero «Datos de Mauricio», cero Reset. El guard del server puede estar bien y la UI ya estar ofreciendo lo que no debe.',
    ],
    commits: [
      { sha: 'b8c4422e', msg: 'Cliente de Diseño: probar el rebrand sobre datos reales sin tocarle el color a nadie', lineas: 330, archivos: 7 },
    ],
    archivos: [
      'lib/auth-session.ts — `WS_PRUEBAS` y `exigirClienteDePrueba`, sin `server-only` para que un test lo pueda importar',
      'tests/reset-workspace.test.ts — el test que fija el largo en 2',
    ],
  },
  {
    fecha: '16 ago', hora: '17:29', chat: 'CRM', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Queda UNA paleta, y aparece el token que faltaba desde siempre',
    puntos: [
      '**Tener tres paletas es no haber elegido.** Queda **True North** —Nord, que ya traía resueltos los dos modos, con el azul de Meta— y se van Nord Hardline y Ember North, que perdían justo lo que hacía valer a Nord: una borraba Frost, la otra el sesgo azul de los neutros.',
      '⚠️ **Un botón invisible, y la causa era un NOMBRE.** El selector Kanban/Tabla/Pendientes se pintaba con `background: var(--ink)` y `color: var(--on-sidebar)`. Los dos tokens coincidían en el tema de fábrica, pero el segundo significa «se lee sobre LA BARRA», no «se lee sobre LA TINTA». El día que una paleta puso la barra clara, el botón activo quedó **tinta sobre tinta: contraste 1,00** — e invisible IGUAL en claro y en oscuro, o sea que ningún vistazo lo iba a encontrar. Lo encontró medirlo.',
      '**El arreglo no es cambiarle el color: es que exista el token que faltaba.** `--on-ink` («lo que se lee encima de un relleno de tinta») está ahora en las cuatro paletas, y reemplaza a 16 archivos que usaban `--on-sidebar` o un `#F3F5F8` a mano. Medido después: 10,84 en los dos modos. Un token cuyo nombre describe **dónde se lee** y no **qué color es** es lo único que sobrevive a un cambio de paleta.',
      'Segundo bug de la misma forma: `--faint` usado como TEXTO. Su propia definición dice que es para placeholders y deshabilitados; como texto da 2,4-2,6 en los dos modos. Un token usado fuera de su definición no falla — se lee mal.',
      'Y se separaron dos cosas que estaban juntas: **el MODO es del producto y de cada usuario; el TEMA CANDIDATO es de obra**. `aplicarTemaCandidato` ya no toca el modo. Eso arregló de paso que `/second-brain` prendiera y apagara el oscuro al montar y desmontar, apagándole al usuario su propia preferencia.',
      'La barra de la agencia pasó de `sticky` adentro de la columna a `fixed` de ancho completo, con el documento reservándole su altura en un token — y la sidebar descontándola, o quedaba 50 px más larga que la ventana y su última fila caía fuera. ⚠️ Un `useEffect` puesto DEBAJO de un `return null` temprano cuenta como «más hooks que en el render anterior» (React #310) y en producción minificado no rompe la barra: **rompe la pantalla entera**.',
    ],
    commits: [
      { sha: '3090ab44', msg: 'Modo claro/oscuro para todos, en el perfil — y un botón que era invisible', lineas: 225, archivos: 9 },
      { sha: 'c13fdbaf', msg: 'La barra de la agencia ocupa su lugar en vez de robarlo, y el modo va en el perfil', lineas: 85, archivos: 20 },
    ],
    archivos: [
      'app/globals.css — `--on-ink` en las cuatro paletas · el bloque True North',
      'app/_components/InterruptorModo.tsx — el interruptor luna/sol de Nord, reimplementado desde su fuente',
      'app/_components/TemaCandidato.tsx — deja de tocar el modo',
    ],
  },
  {
    fecha: '17 ago', hora: '09:09', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Un experimento de diseño se le escapó a los clientes, dos veces',
    puntos: [
      '**Un cliente NUEVO abrió MaKo en oscuro sin haber tocado nada**, y se comió entera la cola de contraste que el rebrand todavía no cerró. La causa era una línea: el arranque miraba `prefers-color-scheme` como fallback, así que cualquiera con el sistema operativo en oscuro se llevaba el modo puesto. **Un experimento de diseño no se ofrece a los clientes por defecto. Nunca.**',
      '⚠️ **Y el primer arreglo no alcanzó, porque probé la mitad del caso.** Se sacó el `prefers-color-scheme` y se replegó el interruptor al Cliente de Diseño… pero la elección del tema vive en `localStorage`, que es **del navegador, no del workspace**: una vez prendido, el script de arranque lo volvía a aplicar en TODAS las pantallas — el super admin y el otro cliente de prueba incluidos. La verificación no lo vio porque a ese navegador solo se le había sembrado la clave del MODO, nunca la del TEMA.',
      'La regla que queda de las dos rondas: **para verificar que algo se apagó, el navegador tiene que estar SUCIO con todas las claves que el bug pone**, no con la que uno se acuerda. Sembrar una de dos es un verde que no prueba nada.',
      'Son **dos capas** y una sola no alcanza: el `<script>` de arranque para el documento nuevo (sin fogonazo), y un efecto en cada render para la navegación por links — que es como se usa la app y donde el script no vuelve a correr. Sin el segundo, salir del Cliente de Diseño por un link se llevaba el tema puesto.',
      'Sí, mira el `?ws=` de la URL, que está prohibido para decidir de quién son los datos. **Acá no decide ningún dato: decide un COLOR.** Lo peor que puede hacer alguien escribiéndolo a mano es pintarse su propio navegador; de los datos sigue decidiendo el server. La excepción está escrita al lado del código para que nadie la generalice.',
      'Consecuencia para el roadmap: el modo claro/oscuro **existe y está replegado**. Vuelve a los clientes cuando el rebrand cierre la cola de contraste, no antes.',
    ],
    commits: [
      { sha: '8b4039bb', msg: 'El tema en prueba NO existe fuera del Cliente de Diseño', lineas: 89, archivos: 3 },
      { sha: '37a1d200', msg: 'El tema vive en el NAVEGADOR, no en el workspace: por eso se escapaba', lineas: 37, archivos: 1 },
    ],
    archivos: [
      'app/_components/TemaCandidato.tsx — las dos capas (script de arranque + efecto por render) y la limpieza de la clave del modo',
      'app/_components/PanelAgencia.tsx — el único control, y solo en WS_DISENO',
    ],
  },
];
