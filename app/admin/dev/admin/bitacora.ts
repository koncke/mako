// =============================================================================
// Admin (SuperAdmin) — registro de construcción
// =============================================================================
// Todo lo que se trabajó sobre el shell de la agencia: la barra, sus tabs, cómo
// se entra a un cliente y qué se puede hacer adentro.
//
// Nace con contenido porque el trabajo ya estaba hecho cuando se creó el área:
// arrancó como «rediseño» y a mitad de camino dejó de serlo. Eso mismo es lo
// primero que vale la pena tener anotado — el registro del rediseño no tenía por
// qué contar cómo funciona la impersonación.
//
// Qué va acá y qué no: el motivo y la trampa, no el changelog. Los tipos, en
// ../_registro/tipos.ts.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Parte 3 · Gramática de MaKo';

export const BITACORA: Hito[] = [
  {
    fecha: '8 ago', hora: '12:10', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La barra de super admin, y limpiar sus tabs',
    pedido: 'Por otro lado, corrige la sidebar de super admin, el diseño tiene que ser exactamente el mismo que en cualquier workspace.\nLas secciones no son así, son desplegables...\n\nTabs a modificar o eliminar en SuperAdmin porque no tienen sentido, revisalas igualmente para ver si hacen algo importante...\n\n1. Ruta /metodo tab "Integraciones". Ya existe una tab de integraciones, no tiene sentido ver eso... Eliminala directamente.\n2. La ruta de /admin/guiones la tab de "Guiones" debería estar dentro de la sección de "dev" con nombre de "Ads Writer" que así se llama la feature...\n3. Hay una tab llamada "MaKo" que me redirije a otra tab, a la de admin, "clientes". Eso no tiene sentido, elimina MaKo.\n4. Lleva a "Grafo" a dev, y ponlo primero.\n5. Quiero que traigas TODAS las secciones de cualquier workspace al super admin. Ya que vamos a salir a vender MaKo y vamos a utilizar todo. Con la particularidad de que en SuperAdmin existirá una sección de "Admin" y otra de "Dev".',
    puntos: [
      'El punto 5 cambia qué ES el shell de admin: dejaba de ser «sin tabs de marketing, solo gestión» —que es como estaba escrito en el código— para ser el producto entero MÁS dos secciones propias. La razón es de negocio: van a vender MaKo usándolo.',
    ],
  },
  {
    fecha: '8 ago', hora: '13:05', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra de admin deja de ser otra barra',
    puntos: [
      '⚠️ **No era un problema de estilos: eran dos JSX distintos.** El shell de admin no usaba `<Familia>` — tenía su propia rama con un rótulo estático y una lista plana. Por eso las secciones no se desplegaban: ninguna cantidad de CSS lo iba a arreglar. `ADMIN_SECCIONES` (que era `{titulo, items}`) pasó a ser `ADMIN_FAMILIAS`: dos `NavFamilia` iguales a las otras cuatro, y quedó UNA sola rama de navegación.',
      '**La regla que queda: si dos cosas tienen que verse igual, tienen que ser el mismo componente.** Mientras sean dos ramas de JSX vuelven a divergir a la tercera edición — que es exactamente lo que había pasado.',
      'El super admin ve las CUATRO familias de producto además de Admin y Dev. Anda sin impersonar porque un admin que no impersona cae en su PROPIO workspace (`resolverDesdeCookies`). ⚠️ Si el usuario admin no tuviera workspace asignado, esas tabs darían 403.',
      '**«MaKo» no era una tab que redirigía: era la ÚNICA puerta a una feature.** Apuntaba a `/admin?tab=copy` y ahí vive el cerebro de copywriting; el tab bar de /admin solo mostraba Clientes y Super Admins. Y casi nunca funcionaba, porque el `?tab=` lo lee un efecto de MONTAJE: estando ya en /admin, la navegación del cliente no remonta nada y te deja donde estabas — eso es lo que se veía como «me redirige». Salió de la barra y recuperó su botón adentro de /admin.',
      '**«Integraciones» (/metodo) sí hace algo**: es el asistente guiado de credenciales. Salió de la barra porque duplica la tab de Integraciones, pero la ruta NO se borró: sigue colgando de Configuraciones → «Método».',
      '«Guiones» era el tercer nombre de la misma cosa (la feature es /ads-writer, el registro decía «Ads Generator»). Todo pasó a **Ads Writer**, con Ángulos y Estructuras como sub-tabs al lado de Roadmap. Las dos rutas viejas redirigen.',
      '«Plan» salió de Admin: ya estaba en Operate, y ahora Operate se ve.',
    ],
    commits: [{ sha: '2d7728a', msg: 'La barra de super admin deja de ser otra barra', lineas: 665, archivos: 16 }],
    archivos: [
      'app/_components/nav.ts — `ADMIN_FAMILIAS` reemplaza a `ADMIN_SECCIONES`',
      'app/_components/Sidebar.tsx — una sola rama de navegación',
      'app/admin/AdminView.tsx — vuelve el botón «Copywriting»',
      'app/admin/guiones/page.tsx — redirige a /admin/dev/ads-writer',
    ],
  },
  {
    fecha: '8 ago', hora: '14:20', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Sacar «Admin» del perfil y mover «Contexto de MaKo»',
    pedido: 'Elimina "Admin" del desplegable del perfil.\nY mueve "Contexto MaKo" dentro de la sección admin.',
    puntos: [
      'Los dos eran `adminOnly`, o sea que solo los veía el super admin — que ya tiene su familia Admin en la barra. Eran dos puertas a lo mismo.',
      '⚠️ De paso apareció que **había un test roto en `main`** desde el renombre de Guiones: esperaba `MaKo - Guiones`. El push había salido verde igual porque **el pre-push corre tipos y el contrato de las skills, NO los tests**. Quedó escrito en AGENTS.md.',
    ],
    commits: [{ sha: '8014aa5', msg: 'Detrás del avatar queda tu cuenta, no las herramientas de la agencia', lineas: 50, archivos: 4 }],
  },
  {
    fecha: '8 ago', hora: '15:40', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Un cliente por pestaña',
    pedido: 'Haz que cuando entre a la vista de un cliente como super admin, solo ESA tab entre a la vista. No toda la cuenta de super admin... Así puedo entrar a muchas tabs de clientes y también puedo seguir viendo la vista de super admin en otras tabs.',
    puntos: [
      'Es un cambio de arquitectura, no de UI: toca el aislamiento multi-inquilino, que es lo más delicado del repo.',
    ],
  },
  {
    fecha: '8 ago', hora: '16:30', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'El workspace viaja en `?ws=` y lo valida el proxy',
    puntos: [
      '⚠️ **Una cookie no puede ser por pestaña.** La impersonación era una cookie firmada (`mako_ws`) y las cookies son del NAVEGADOR: entrar a un cliente cambiaba el contexto en todas las pestañas abiertas.',
      '⚠️ **Y el diagnóstico obvio es el equivocado.** `sessionStorage` sí es por pestaña, pero **el server no lo puede leer cuando pinta la página**, y 61 de las 104 pantallas deciden qué mostrar con un gate server-side. Habría quedado media pantalla de un cliente y media del otro. Lo único que es distinto por pestaña Y llega en el request del documento es **la URL**.',
      '**Dónde está la seguridad:** `?ws=` lo escribe cualquiera, así que leerlo directo sería un IDOR. El único que lo mira es `proxy.ts`, que lo acepta solo si la sesión firmada dice `rol === admin` y que **borra el header interno en cada request** antes de decidir.',
      '⚠️ **El bug que costó el diagnóstico:** todo andaba salvo `/api/auth/me` — justo la ruta que le dice a la barra y al cartel a qué cliente mirás. `seguir()` recibía la sesión por parámetro, pero el proxy tiene CINCO salidas y la de rutas públicas es un early-return anterior a verificar la sesión; `/api/auth/me` cuelga de `/api/auth`, que está en PUBLICOS. **La regla: en un gate con varias salidas, lo que TODAS deben hacer va adentro del helper, no como argumento en cada return.**',
      'Las 340 llamadas a `/api` lo llevan por un parche de `window.fetch` (un choke point, no 340 ediciones) y los 85 links por un envoltorio de `next/link` (57 archivos con un codemod). ⚠️ El parche va al cargar el MÓDULO, no en un `useEffect`: los efectos corren de hijo a padre y llegaría tarde a las llamadas de la carga inicial.',
      'Verificado con la misma sesión y a la vez: `?ws=3` → «Cliente de Prueba», `?ws=1` → «Mauricio Bustos», header forjado a mano → ignorado. Y los datos también se separan: `datos-sin-marcar` devuelve 0 / 5 / 3.',
    ],
    commits: [
      { sha: '00cb95c', msg: 'Cada cliente en su pestaña: el workspace viaja en ?ws=', lineas: 621, archivos: 62 },
      { sha: '78c5383', msg: 'Entrar a un cliente se queda en la misma pestaña', lineas: 45, archivos: 1 },
    ],
    archivos: [
      'lib/ws-tab.ts — NUEVO. Constantes y helpers, isomórfico',
      'proxy.ts — `seguir()` reemplaza a NextResponse.next() en las cinco salidas',
      'lib/workspace.ts — la pestaña gana sobre la cookie, que queda de legado',
      'app/_components/WsFetch.tsx · app/_ui/Link.tsx — NUEVOS',
    ],
  },
  {
    fecha: '8 ago', hora: '17:05', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«El botón de Datos de Mauricio y RESET es MUY peligroso»',
    pedido: 'El botón de "Datos de Mauricio" y "RESET" es MUY peligroso, eso SOLO debe aparecer en el cliente de prueba.',
    puntos: [
      'Lo vio en la interfaz. El síntoma real era ninguno — hasta que alguien apretara.',
    ],
  },
  {
    fecha: '8 ago', hora: '17:40', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'correccion',
    titulo: 'El Reset se ofrecía en TODOS los clientes reales',
    puntos: [
      '⚠️ **El guard era una condición NEGATIVA**, en sus tres capas: `if (ws == null || ws === OWNER_WS) return null`. Eso protege a Mauricio y **a nadie más**: Leandro (10), Martín (9) y Leila (11) tenían disponible el botón de vaciar, y `resetearWorkspace` borra 50+ tablas y 4 buckets de storage sin vuelta atrás.',
      '**Lo más llamativo: la función se llamaba `wsDePrueba()`.** El nombre decía la intención y el código decía otra cosa, así que leerlo por encima no alcanzaba para verlo.',
      '**La regla: un guard sobre algo destructivo se escribe en POSITIVO** («solo ESTE»), nunca en negativo («cualquiera menos aquél»). La lista de lo que hay que proteger crece sola con cada cliente nuevo; la de lo que se puede tocar, no.',
      '⚠️ **La guarda más peligrosa de la app era la única sin test.** `lib/reset-workspace.ts` lleva `server-only`, así que ningún test lo puede importar — se descubrió al intentar escribirlo. Por eso la condición se mudó a `exigirClienteDePrueba` en `lib/auth-session.ts`, que no lo tiene.',
      '**Esconder el botón no habría sido el arreglo:** el que decide es el endpoint. Si solo se ocultara la UI, un POST a mano seguiría vaciando.',
      'Verificado: `?ws=3` → disponible; `?ws=10` (Leandro) y `?ws=9` (Martín) → no. El POST de reset NO se probó contra un cliente real: el `.env.local` apunta a producción y sería justo el accidente que esto viene a evitar.',
    ],
    commits: [{ sha: '50f0fa7', msg: 'El Reset y «Datos de Mauricio» solo en el cliente de prueba', lineas: 187, archivos: 7 }],
    archivos: [
      'lib/auth-session.ts — `WS_PRUEBA` + `exigirClienteDePrueba`',
      'tests/reset-workspace.test.ts — NUEVO. 4 casos, incluido el que el guard viejo dejaba pasar',
    ],
  },

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "9 ago", hora: "01:33", chat: "—", cuenta: "claude1",
    actor: "claude", tipo: "implementacion",
    titulo: "El registro de las 122 áreas: el Roadmap y el Change History se DERIVAN, no se escriben",
    puntos: [
      "/admin/dev pasó de 6 áreas a 122, con mapa propio (ocho familias, filtro por estado, buscador) en vez de alcanzarse solo por el sidebar. La decisión de fondo: ningún panel se escribe a mano. El Roadmap sale del plan (cada área declara sus `proyectos` y la pantalla lee las tareas abiertas), el Change History sale de `git log` sobre las rutas de `vive` (scripts/gen-dev-historial.mjs → _historial.generado.ts), y donde hay bitácora escrita a mano manda ella porque tiene el pedido TEXTUAL del dueño. El porqué está dicho en el commit: «era la única forma de que 121 registros no fueran 121 mentiras». Existe para alimentar a dos agentes futuros (el que cierra tareas solo y el que debuguea), así que un área que falta es un punto ciego.",
      "Tres trampas que ya se pagaron y no están escritas en la bitácora del área. (1) El Roadmap se pintaba «Cerrado» con cero tareas en las 121 filas a la vez: `runWithWorkspace(OWNER_WS)` escrito de memoria, cuando el board /plan vive en el workspace del SUPER-ADMIN. Un workspace equivocado no tira error, devuelve cero filas — la pantalla se veía perfecta y mentía. Por eso `enPlan` se exporta en vez de que cada consumidor rearme la expresión. (2) El conteo decía 121 y eran 122 porque se contó con `grep -c`, que cuenta LÍNEAS y no ocurrencias; el número ahora sale de `AREAS.length`, nunca escrito en la UI. (3) `tests/dev-areas.test.ts` chequea contra el DISCO que exista cada ruta de `vive`: cazó 30 rutas plausibles pero inexistentes que ningún compilador ve y que mandan al próximo agente a leer un archivo que no está. Y una perdida en el propio refactor: el área `pricing` se había caído sin que nada avisara.",
    ],
    commits: [
      { sha: "93cde614", msg: "Las 121 áreas del producto, con su Roadmap y su Change History derivados", lineas: 2453, archivos: 5 },
      { sha: "4d296676", msg: "/admin/dev ya tiene puerta: el mapa de las 121 áreas", lineas: 493, archivos: 7 },
      { sha: "92f9b5f5", msg: "El Roadmap leía el workspace equivocado y no fallaba: devolvía vacío", lineas: 13, archivos: 2 },
      { sha: "9af57984", msg: "El área pricing se había perdido en el refactor de las 121 áreas", lineas: 24, archivos: 3 },
      { sha: "992ea38d", msg: "Son 122 áreas, no 121: grep -c cuenta líneas, no ocurrencias", lineas: 5, archivos: 1 },
      { sha: "5a052ed2", msg: "El mapa de Dev se dibuja con la barra, no parecido a la barra", lineas: 217, archivos: 3 },
      { sha: "5a377be2", msg: "UNA barra, y es la barra: /admin/dev monta BarraPreview", lineas: 311, archivos: 7 },
    ],
  },
  {
    fecha: "11 ago", hora: "01:45", chat: "Productos X Funnels", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La sidebar volvió a scrollear, y la regla del dueño era inencontrable",
    puntos: [
      "«La sidebar se ve horrible con esa barra de scroll, y dentro de la tab que creaste también.» El día anterior se había teñido y adelgazado la barra (.mk-scroll-oscuro) y el problema siguió igual: la barra fea no era el problema, era el testigo. La familia Dev pasó de 10 a 13 filas en 24 horas (Products & Offers, Pricing, Customer Success) y era la única familia larga que NO usaba el mecanismo de colecciones que el resto de la barra ya tenía. Los nueve registros se metieron en un NavGrupo «Registros»: Dev 13 filas → 5, con los 13 destinos alcanzables. En la misma tanda, la página del área se partió en dos tabs (Roadmap / Historial) porque apilaba cinco paneles y el Roadmap quedaba como intro de algo más largo.",
      "La razón por la que se volvió a violar una regla ESCRITA es el hallazgo, y no está en ningún hito: el «Vive en:» del hallazgo apuntaba a `lib/nav.ts`, un archivo que no existe desde el rediseño, así que grepear la ruta real (app/_components/nav.ts) —el método que manda AGENTS.md— no devolvía nada. Una ruta muerta en un «Vive en:» no rompe nada, no la ve el compilador, y hace que cada sesión vuelva a proponer «le pongo scroll». Además: el rail PLEGADO desborda ~14 px ANTES que el expandido, así que medir con la barra abierta subestima el problema; y el flyout hereda el fallo (overflow: hidden sin maxHeight), o sea que mover filas al desplegable muda el corte silencioso en vez de arreglarlo. El corte del contenido en tabs va por PREGUNTA («¿qué falta?» vs «¿qué pasó?»), nunca por longitud. Y las sub-tabs se leían con `useSearchParams` —desaconsejado por escrito en /admin/ui— con el `onCambio` sin escribir la URL: el link que copiabas no era la tab que estabas viendo.",
    ],
    commits: [
      { sha: "9204fc7f", msg: "La barra de scroll deja de gritar, y el registro se parte en dos preguntas", lineas: 81, archivos: 4 },
      { sha: "a999b6ec", msg: "La sidebar no scrollea: era tu regla y la había roto yo", lineas: 166, archivos: 7 },
      { sha: "c5acb160", msg: "Una tab que existe y no se ve: Products & Offers y Pricing entran al sidebar", lineas: 33, archivos: 2 },
      { sha: "c3b81405", msg: "Customer Success en la sidebar, y la cartera sin tocar una terminal", lineas: 447, archivos: 6 },
      { sha: "4c952691", msg: "Mensajes de MaKo tiene lugar propio en la barra, y agendar tiene salida", lineas: 178, archivos: 8 },
    ],
  },
  {
    fecha: "16 ago", hora: "10:47", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Contar TRES formas de navegar fue el error: el reset se sacaba a sí mismo de la vista",
    puntos: [
      "Continuación directa del hito del 8 ago («El workspace viaja en ?ws= y lo valida el proxy»). El dueño reseteó el Cliente de Prueba y al volver a abrirlo cayó en /onboarding sin barra de agencia, con la sidebar de admin y su foto, y sin ninguna forma de volver a entrar: lo reportó como «algo está pasando». El reset dejó al ws3 con el onboarding pendiente, `guardOnboarding()` hizo `redirect('/onboarding')` con la ruta pelada y se perdió la pestaña. Se barrieron los 26 redirect() del server con `rutaConWs` — los tres del guard compartido (requireRolWs / requireCapa / guardOnboarding) primero, porque se disparan desde cualquier pantalla — y los alias de ruta, que sacaban del cliente al abrir un link viejo. Horas después cayó la cuarta forma: los dos `window.location.href` pelados de PanelAgencia.",
      "El barrido de los 26 dio la regla por cerrada y la CUARTA forma quedó viva justo en el peor lugar: PanelAgencia solo se dibuja mientras mirás a otro cliente, así que sus navegaciones duras son las únicas del repo que corren siempre adentro del modo agencia. Eso explica la otra mitad del reporte del dueño —«le di al reset y no pasó nada»—: el reset vaciaba 50+ tablas y acto seguido lo depositaba en SU propio onboarding, donde por supuesto no había cambiado nada; el aviso de «Workspace vaciado: N registros» alcanzaba a pintarse y se lo llevaba la navegación. Un botón que hace su trabajo y después te muestra otra pantalla es indistinguible de uno roto. Y el diagnóstico obvio era el equivocado dos veces: el bug existía desde el 02/07 y estuvo dormido seis semanas porque ese workspace tenía status 'done' — lo que cambió no fue el código sino el DATO, y se había pusheado media hora antes. Un `grep` de `redirect('/` tampoco ve un template literal ni un `<a href>` crudo.",
    ],
    commits: [
      { sha: "897ce26e", msg: "Un redirect es navegación: los 26 que perdían el ?ws= de la pestaña", lineas: 126, archivos: 26 },
      { sha: "9adf2f7d", msg: "La CUARTA forma de navegar: el RESET se sacaba a sí mismo de la vista", lineas: 108, archivos: 8 },
    ],
  },
  {
    fecha: "16 ago", hora: "15:49", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El Cliente de Diseño (ws 4), y el taller de paletas que se le aplicó a un cliente real",
    puntos: [
      "Nace un segundo workspace de prueba dedicado a mirar el rebrand: en el 3 se prueba que las cosas FUNCIONEN, en el 4 cómo se VEN (un reset a mitad de una prueba de tema te deja sin datos, y un cambio de tema te ensucia la prueba funcional). El cambiador de temas vive en la barra de la agencia y solo ahí. El guard destructivo pasó de UN número a una lista blanca de DOS, sigue en positivo, y hay un test que fija el largo de la lista en 2 para que un tercero tenga que justificarse. En el medio la barra de la agencia pasó de `sticky` adentro de la columna a `fixed` de ancho completo con su altura reservada por token, y el interruptor claro/oscuro se ofreció a todos los usuarios en el perfil — y se retiró el mismo día.",
      "Un cliente abrió su tablero y vio «no están mis tareas y están todos los botones mal». No faltaba nada: no se veía nada. `<TemaCandidato>` está montado en el LAYOUT RAÍZ y su script aplica el tema guardado en el localStorage del navegador antes del primer pintado, sin preguntar quién es — o sea, una herramienta de laboratorio EN PRODUCCIÓN. Falla en silencio por diseño: el mismo CSS pone transición de color a todo, así que ni parpadea. Y la mitad más cara fue propia: horas antes se había reportado que el chip de «tema en prueba» tapaba una pantalla y se lo apagó con `display: none` — el chip no era la causa, era el único aviso y la única salida, y el problema volvió sin ninguna pista. El test viejo verificaba que el chip estuviera ESCONDIDO: estaba blindando el error. Dos arreglos más antes de cerrar: el `prefers-color-scheme` como fallback le ponía el modo oscuro a cualquiera con el sistema en oscuro (un experimento de diseño no se ofrece por default, nunca), y el tema vive en el NAVEGADOR, no en el workspace, así que una vez prendido en el ws4 se aplicaba en todas las pestañas — la verificación anterior probó la mitad del caso porque solo había sembrado la clave del modo. Además, un `useEffect` puesto debajo de un `return null` temprano no rompe la barra: en producción minificado rompe la PANTALLA ENTERA (React #310).",
    ],
    commits: [
      { sha: "b8c4422e", msg: "Cliente de Diseño: probar el rebrand sobre datos reales sin tocarle el color a nadie", lineas: 330, archivos: 7 },
      { sha: "c13fdbaf", msg: "La barra de la agencia ocupa su lugar en vez de robarlo, y el modo va en el perfil", lineas: 85, archivos: 20 },
      { sha: "3090ab44", msg: "Modo claro/oscuro para todos, en el perfil — y un botón que era invisible", lineas: 225, archivos: 9 },
      { sha: "4d05184b", msg: "El taller de paletas se le aplicaba a los clientes, y yo había tapado el aviso", lineas: 49, archivos: 3 },
      { sha: "8b4039bb", msg: "El tema en prueba NO existe fuera del Cliente de Diseño", lineas: 89, archivos: 3 },
      { sha: "37a1d200", msg: "El tema vive en el NAVEGADOR, no en el workspace: por eso se escapaba", lineas: 37, archivos: 1 },
    ],
  },
  {
    fecha: "16 ago", hora: "18:44", chat: "CRM", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Dar de alta a alguien no le avisaba a nadie, y el remitente de la plataforma salía de un cliente",
    puntos: [
      "Los tres puntos que crean personas —el cliente nuevo, el usuario suelto de /admin y el equipo que suma el propio cliente— llamaban a `crearUsuario()` y ahí terminaban. La fila en `usuarios` ES la invitación (el callback de Google la busca y la activa sola), así que todo funcionaba exactamente como estaba escrito: faltaba el mensaje. En /equipo la acción se llamaba literal 'invitar' y no invitaba a nadie. Ahora sale un mail de acceso desde los tres call-sites, con botón «Reenviar acceso» en /admin y /equipo, y mig 0138 (`invitacion_enviada_at`).",
      "Tres cosas que ningún commit vuelve a contar. (1) La pantalla afirmaba «Cliente creado. Cuando su admin entre con Google usando ese email, la cuenta se activa sola» — cierto palabra por palabra y falso como mensaje: daba por hecho que iba a entrar solo a una URL que nadie le pasó. El texto ahora dice el paso que FALTA, y si el mail no salió lo dice en ámbar con el link para pasarlo a mano. (2) El hallazgo caro, que no daba ningún síntoma porque funciona de casualidad: mandarlo con `runWithWorkspace(OWNER_WS)` hacía que el remitente de la PLATAFORMA saliera de la config de un cliente — OWNER_WS vale 1 y el 1 es Mauricio. Hoy da bien porque su `resend_from` dice «MaKo»; el día que lo cambie a su negocio, todos los clientes nuevos reciben su acceso firmado por otro cliente. Quedó `REMITENTE_MAKO`, `from` explícito, preflight de sandbox mirando esa constante y el envío en `wsSuperAdmin()`. (3) `invitacion_enviada_at` no es lo mismo que `estado='invitado'`: éste solo dice «nunca entró» y no separa «le llegó y no entró» de «nunca supo que existía», que se arreglan distinto. La fecha se estampa solo si el mail SALIÓ — marcarla en el intento convierte la columna en «¿lo intentamos?» y el botón mentiría. Sin token ni contraseña, y no es un atajo: el login por contraseña se eliminó a propósito porque abría sesión de admin salteando la tabla. FALTA un envío real a una casilla: es lo único que prueba DNS y reputación del dominio.",
    ],
    commits: [
      { sha: "17944fbf", msg: "Dar de alta a alguien ahora le avisa: el mail de acceso que nunca salía", lineas: 634, archivos: 13 },
    ],
  },
];

export const PARTES: Parte[] = [
  { titulo: 'La barra, igual que en un workspace', detalle: 'Admin y Dev son `NavFamilia` como las otras cuatro y las pinta `<Familia>`: desplegables, chevron, caja y rail', estado: 'hecha' },
  { titulo: 'Todo el producto en el super admin', detalle: 'Las cuatro familias de producto además de Admin y Dev, para poder vender MaKo usándolo', estado: 'hecha' },
  { titulo: 'Las tabs que no tenían sentido', detalle: '/metodo y «MaKo» fuera de la barra (sin perder sus features), Guiones → Ads Writer en Dev, Grafo primero, «Administración» → «Admin»', estado: 'hecha' },
  { titulo: 'Un cliente por pestaña', detalle: 'El workspace viaja en `?ws=` y lo valida el proxy contra la sesión firmada. Varios clientes abiertos a la vez, y el panel de admin vivo en su pestaña', estado: 'hecha' },
  { titulo: 'Lo destructivo, solo en el cliente de prueba', detalle: '`WS_PRUEBA` + `exigirClienteDePrueba` en las tres capas, con test', estado: 'hecha' },
  {
    titulo: 'Jubilar la cookie de impersonación',
    detalle: 'La UI ya no escribe `mako_ws`, pero `lib/workspace.ts` la sigue leyendo por las sesiones que la tienen puesta, y `/api/admin/impersonate` sigue en pie. Sacarla cuando no quede ninguna viva — mientras esté, hay dos fuentes para el mismo dato',
    estado: 'sigue',
  },
  {
    titulo: 'El admin sin workspace propio',
    detalle: 'Si el usuario admin no tiene workspace asignado, las tabs de producto le dan 403. El flag `entrarComoDueno` existe y está enchufado en `<Familia>`, pero hoy ningún item lo usa: hay que decidir si esa es la salida o si el admin siempre debe tener su espacio',
    estado: 'cola',
  },
  {
    titulo: 'Lo que el Reset no puede limpiar',
    detalle: '`notificaciones` y `meta_campaign_drafts` no tienen `workspace_id`, así que la campanita del cliente de prueba muestra la de Mauricio. Hace falta una migración que les agregue la columna',
    estado: 'cola',
  },
];
