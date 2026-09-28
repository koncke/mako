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
  {
    fecha: '27 sep', hora: '18:05', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Vista de agencia: que Juanfran entre a SUS clientes',
    pedido: 'También quiero implementar la "Vista de agencia" en clientes, por ahora pon solo a Juanfran/ Código inmobiliario en ese nivel de acceso. Y dentro del detail de cada cliente deberían poder tener un botón de "Entrar cómo" que sea la misma funcionalidad que hay en admin que te permite ver el dashboard y la cuenta de otro. Es decir que claro, los clientes de "Agencia" tendrán cuenta de MaKo. Entonces te propongo que crees directamente el workspace y que superadmin lo vea dentro de los clientes de esa agencia y deba aprobar la entrada.',
    puntos: [
      'El pedido introduce un TERCER nivel de acceso que hoy no existe: `Rol = admin | usuario` y nada en el medio. Es una decisión de producto, no una feature de UI.',
      '«La misma funcionalidad que hay en admin» no se puede reusar: ese «Entrar como» es un `<a href="/general?ws=N">` y todo su permiso es `sesion.rol === admin` en proxy.ts:164. No hay endpoint, no hay acto, no hay dónde colgar una aprobación.',
    ],
  },
  {
    fecha: '27 sep', hora: '18:43', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'El relevo antes de construir la vista de agencia',
    puntos: [
      'Cinco agentes relevaron impersonación, workspaces, guards, qué significa hoy «agencia» y el modelo de cuentas. Los tres refutadores murieron por un error de API, así que cada afirmación que decide el diseño se verificó a mano contra el archivo antes de escribirla.',
      'Lo que más ahorra después, y es lo contrario de lo que parece: el modo de falla probable NO es un leak. Con rol `usuario`, el proxy no pone el header, `getWorkspaceActual` cae a `sesion.ws` y la pantalla del «cliente» renderiza completa con los datos de la AGENCIA — sin 403, sin error, sin nada roto.',
      'Y el nombre ya está ocupado EN PRODUCCIÓN: `vista_de_agencia` (lib/api-mako/areas/equipo.run.ts:177) significa hoy «esta sesión está impersonando», y lo leen MaKo, el doer de WhatsApp, /api/v1 y la skill del cliente. Reusarlo no rompe el compilador: hace que MaKo conteste mal.',
      'No se escribió una línea de la feature: falta una decisión de producto sobre el nivel de acceso, y el modelo de datos no puede expresar «esta agencia es dueña de estos clientes» (workspaces sin columna de padre, usuarios.workspace_id escalar).',
    ],
    commits: [
      { sha: "0d81d94e", msg: "El relevo de la vista de agencia, antes de escribir una linea", lineas: 152, archivos: 3 },
    ],
  },
  {
    fecha: '27 sep', hora: '20:10', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La vista de agencia, con el nivel de acceso que no existía',
    puntos: [
      'El pedido necesitaba un TERCER nivel de acceso: `Rol = admin | usuario` y nada en el medio. Con rol usuario la pantalla del «cliente» mostraba los datos de la AGENCIA sin un solo error; con rol admin se abrían 154 call-sites de getSesionAdmin. La salida fue una puerta propia: cookie firmada `mako_agencia` que NOMBRA a la agencia (la de impersonación firma sólo el número del workspace, así que es portable entre sesiones) y con el vencimiento adentro de la firma.',
      'Aparecieron DOS tablas donde el plan tenía una, y ése es el hallazgo caro. `agencia_clientes` dice a qué clientes entra cada agencia; faltaba `agencias`, que dice QUIÉN puede tener clientes. Derivar la segunda de la primera deja un huevo-y-gallina con un solo lado abierto: para conseguir la primera fila hay que poder pedirla, o sea que cualquier admin de cualquier workspace crearía inquilinos en la plataforma. Es además lo que Martín pidió textual: «poné SÓLO a Juanfran en ese nivel de acceso» es una fila, no una condición.',
      'El token no alcanza y por eso se le pregunta a la base en CADA request, fail-closed: la aprobación se revoca DESPUÉS de firmarlo. Memoizado y con salida temprana para quien no trae la cookie, así el 99% del tráfico no toca la base.',
      'La salida dejó de ser una constante. Estaba cableada a «/admin» en tres lugares, y /admin está en SOLO_ADMIN: una agencia que apretara «Salir de la vista» se comía el denegarRol y aterrizaba en /inicio.',
      'Verificado en el navegador de punta a punta, incluida la aislación: entrar al cliente de otra agencia y a un workspace inexistente contestan 404 con el MISMO texto — un 403 confirmaría que existe. Los tests van con DOS agencias porque con una, un permiso cableado al número 13 pasaría todo.',
      'Queda ABIERTO: revocar no echa a quien ya está adentro (muere en la próxima navegación, sin aviso); el alta no tiene rollback y lo dice en vez de fingirlo (mismo agujero que /api/admin/workspaces:87); el cliente nuevo nace sin usuario admin; y `vista_de_agencia` de la API de MaKo sigue significando «impersonando», que ahora es ambiguo.',
    ],
    commits: [
      { sha: "69d26b0f", msg: "Vista de agencia (1/2): el nivel de acceso, que no existia", lineas: 861, archivos: 10 },
      { sha: "0460e361", msg: "Vista de agencia (2/2): abrirle cuenta a un cliente, firmarla y entrar", lineas: 800, archivos: 16 },
    ],
  },
  {
    fecha: '27 sep', hora: '20:40', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Inspeccionar, la cadena anidada, y /admin como la vista de Clientes',
    pedido: '1. No debería estar ese cuadro alargado de esa sección, y solamente deberían ver esa sección los usuarios de agencia y super admin. Haz que esté todo a la misma altura pero alineado a la derecha, sutil. Con un ícono de ojo y con el texto "Inspeccionar".\n2. Cuando entro como super admin inspeccionando una cuenta de agencia, y a su vez entro a inspeccionar un cliente de esa agencia, eso debería notarse en la topbar que aparece, que no se bugee, así lo puedo probar.\n3. Rediseña la vista de super admin de clientes, que sea exactamente igual que la vista de clientes que construimos. Solo que con los botones extras. Elimina la sub tab de super admin, que esté todo junto, y lo de copywriting ni siquiera debería estar allí, ponlo como otra tab en la sección de admin en la sidebar',
    puntos: [
      'El punto 1 tiene DOS mitades y la segunda es la que importa: no es sólo sacar la caja, es que el control no lo vea un cliente común. Antes decía «Sin cuenta» para todo workspace que no fuera agencia —o sea, el default— y eso es una afirmación sobre algo que a ese cliente no le incumbe.',
      'El 2 pide poder PROBAR la vista de agencia desde la cuenta de super admin: «así lo puedo probar». O sea que el valor del pedido no es la cadena en sí, es que la cadena haga verificable lo que se construyó.',
      'El 3 dice «exactamente igual», que es una restricción de construcción y no de gusto: obliga a compartir la pieza en vez de copiar el diseño.',
    ],
  },
  {
    fecha: '27 sep', hora: '22:05', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los tres puntos, con un relevo de 12 agentes antes de escribir',
    puntos: [
      'Se relevaron las tres zonas en paralelo antes de tocar nada (5 lectores + 7 lotes de refutación; 52 afirmaciones, 3 refutadas). Lo que más ahorró: el punto 2 NO era un problema de datos —el super admin en /general?ws=N ya ve lo correcto— sino de presentación, y el `?via=` que parecía la salida obvia muere en la primera navegación porque ninguna de las cuatro formas de navegar re-pega un parámetro extra. La cadena se DERIVA de la base, con una función que ya estaba escrita y muerta en el repo.',
      'El renglón bajó a la cabecera y el hueco ya existía: `.fc-quitar` era CSS huérfano desde el 27/09 y era exactamente el molde pedido (flex:none, sin caja, 12px, tinta apagada). Se reusó y se borró la regla sin dueño.',
      'Para el punto 3, la pieza se comparte de verdad: la tarjeta, la grilla y la barra son las mismas en las dos pantallas. Apareció un bug latente al montarlas: `margin:0 auto` sin `width:100%` se ENCOGE en un contenedor flex-column — la barra quedó en 419 px y partida en dos renglones.',
      'Y se arregló un `match` de nav.ts que ya mentía: era una lista de exclusiones que no incluía /admin/friccion, así que esa pantalla prendía la fila «Clientes» y su `<title>` decía lo mismo. Ahora es positivo, con test probado rompiéndolo.',
      'ABIERTO: `NombreClienteDialog` sigue sin registrarse en la pila de modales; `/api/admin/usuarios` calcula un `resumen` que el cliente no lee; el cerebro de copywriting escribe en OWNER_WS, que es un cliente; y app/admin/copywriting/ no está en ningún `vive[]`.',
    ],
    commits: [
      { sha: "a57a540c", msg: "«Inspeccionar» al lado del nombre, y la cadena cuando hay dos niveles", lineas: 300, archivos: 8 },
      { sha: "04a61917", msg: "BarraAcciones sale de BoardShell: la montan tres pantallas", lineas: 300, archivos: 2 },
      { sha: "ddf879fd", msg: "/admin es la MISMA vista que Clientes, sin sub-tabs", lineas: 900, archivos: 14 },
    ],
  },
  {
    fecha: '28 sep', hora: '02:10', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Los ONCE puntos sobre la vista de clientes del super admin',
    pedido: '1. Mira, hay muchos errores en diseño en la vista de clientes de admin. No ocupa el ancho total de la pantalla. El super admin no debe ni tener un form diferente ni una vista diferente abajo de todo, simplemente un usuario más, como super admin. Elimina todos los textos innecesarios, como "Cada cliente ve solo sus propios datos. El Admin del cliente ve todas las tabs de su negocio; Closer y Setter ven solo las suyas. \"Entrar como\" te mete en su dashboard para configurarlo o dar soporte." o "Cada cliente es un espacio de datos aislado. El tipo define qué compró: de él salen las tabs que ve, qué le pide el onboarding y qué se le siembra. El email del admin es opcional: si lo pones, esa persona entra con Google y arma su equipo (Closer/Setter); si no, lo configuras tú entrando como el cliente.".\n2. No entiendo por qué dentro del tipo de usuario aparece una opción de "SuperAdmin (Agencia)", porque un SuperAdmin NO es lo mismo que agencia...\n3. El email NO puede ser opcional... Si justamente le llega la invitación por allí.\n4. En super admin, me tienen que aparecer las notificaciones de cuando una agencia intenta agregar a un nuevo usuario, para poder aceptarlo o rechazarlo.\n5. Podrias mejorar bastante los filtros... Piensa en esas cosas... Filtro por tipo, ordenamiento por antiguedad... Filtro por fecha, etc... Piensa bien todo esto. No solo para superadmin, también para la vista de clientes de todos los usuarios, no pensaste bien en los filtros y ordenamientos.\n6. Quiero que la ruta de admin se elimine, y que yo vea esta tab en customer success de mi cuenta de SuperAdmin.\n7. Por lo tanto, estas tarjetas de clientes también deben tener el plan, cada uno, con normalidad... Solo que además el resto de cosas, que las podemos ver como otras tabs, como el equipo de ese cliente/agencia\n8. Me gusta los botones de "Acciones" e "Inspeccionar" que pusiste en la preview de cada card, eso mantenlo y ponlo también en la vista de agencia.\n9. Si agrego el email, sería bueno que ya ponga la foto de perfil de ese email automáticamente en la card, y en todo caso que yo la pueda modificar.\n10. Un cliente de Agencia NO es super admin y tampoco "Completo", es "Agencia"...\n11. Si entro a inspeccionar a desde superadmin a un cliente de agencia, y luego a su vez, entro a un cliente de esa agencia, primero que JAMÁS me debe dejar completar nada con "Datos de Mauricio" eso solo para el cliente de prueba, ya lo habiamos hablado... Y segundo que al salir, me debe llevar nuevamente a la anterior inspección del cliente de agencia, en la tab de cliente, y si le doy salir nuevamente, recién ahí a super admin.',
    puntos: [
      'El 6 es el que cambia la arquitectura y no se lee como tal: «que la ruta de admin se elimine y yo vea esta tab en customer success». Los clientes del super admin SON los workspaces (Mauricio=ws1, Leila=ws11, Juanfran=ws13), asi que eran la misma pregunta contestada en dos pantallas.',
      'El 10 es el que cierra un agujero de seguridad de paso: si «Agencia» es un PLAN, deja de haber un menu que ofrezca «pasar a SuperAdmin» sobre la tarjeta de un cliente — y eso movia la identidad de la plataforma con un click.',
    ],
  },
  {
    fecha: '28 sep', hora: '11:40', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los once, cerrados: la tab fusionada, el plan, la cara y la firma del super admin',
    puntos: [
      '**La cara (9): el `d=404` es la decision, no un detalle de la URL.** Gravatar sin parametros NO devuelve 404 cuando alguien no tiene foto: dibuja un monigote generado del hash. Eso le pone a esa persona una cara inventada, y una cara inventada se lee como si fuera la suya — peor que unas iniciales. Y el respaldo se calcula al LEER: copiarlo a la columna dejaria a «Quitar la foto» sin ningun lado a donde volver.',
      '**El modulo de la cara NO lleva `server-only`, y no es un olvido.** Lo que hay que testear es la PRECEDENCIA (foto elegida > Gravatar > iniciales), que es la regla; el `node:crypto` de adentro ya rompe el build de cualquier `use client` que lo importe, o sea que el import ES el guard. Eran dos copias del hash en dos rutas y ahora es una.',
      '**La firma del super admin (4) no entro en `propuestas`.** Esa tabla es POR INQUILINO —la escribe y la lee `getTenantDb`— y aca hay tres workspaces en juego: propone la agencia, el efecto cae en el cliente y firma el super admin. La otra salida barata, crear el usuario «suspendido» y activarlo al aprobar, rompe por dos efectos que no se ven en el nombre de `crearUsuario`: crear la fila YA MANDA EL MAIL, y `usuarios.email` es UNICO — un pedido rechazado dejaria a esa persona avisada de una cuenta que no existe y al email quemado para el alta de verdad.',
      '**Dos garantias quedaron en la BASE porque el codigo no puede darlas** (mig 0178): el duplicado lo ataja un indice parcial unico sobre `lower(email)` solo en «pendiente» —parcial a proposito, para que rechazado se pueda volver a pedir—, y aprobar RECLAMA con `.eq(estado, pendiente)` antes de crear nada, porque aprobar crea una cuenta y manda un mail. Medido contra produccion: el duplicado frena incluso con otra capitalizacion (23505) y los dos CHECK frenan agencia=cliente y un rol inventado (23514).',
      '**La medicion que resume todo el guard cruzado:** con UNA sola agencia, un permiso que ignore `agencia_ws` pasa 13 de 15 tests. Los dos que caen son los unicos que necesitan la segunda agencia para existir — corolario 3 de OWNER_WS, con numero.',
      '**«Igual pero con botones» (8) se paga con una variante, no con un componente.** `CuentaDeMaKo` tiene cuatro estados y dos mecanismos de entrada; lo que cambia entre la ficha y la tarjeta es la ropa. Un segundo componente duplica los cuatro, y la copia que se queda con tres es la que nadie mira.',
      'ABIERTO: la tabla `agencias` (mig 0176) quedo MUERTA con la capa nueva y no se dropeo — una fuente de verdad zombi sobre un permiso es peor que ninguna. Rechazar un alta no pide motivo aunque la columna existe. Y no hay aviso fuera de la pantalla: hay bandeja y no hay evento.',
    ],
    commits: [
      { sha: 'e2386510', msg: 'La tab de Clientes es UNA: /admin se fue adentro de Customer Success', lineas: 1200, archivos: 16 },
      { sha: '98bbce3e', msg: 'Filtros de verdad: por plan, por fecha, y con direccion — en las DOS pantallas', lineas: 500, archivos: 8 },
      { sha: '3670d312', msg: 'La cara sale del email, y la tarjeta del cliente tiene plan, botones y equipo', lineas: 600, archivos: 13 },
      { sha: '08dc45d1', msg: 'Una agencia PIDE sumar a alguien; el super admin firma', lineas: 700, archivos: 11 },
    ],
  },
  {
    fecha: '28 sep', hora: '08:05', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'El detalle de un cliente tiene que ser el del plan',
    pedido: 'El detail está mal, te habia dicho que identico al del plan, solo que con más opciones para administrar al usuario',
    puntos: [
      'Lo reporto mirando el modal «Equipo / P2P Consulting» del super admin, que era un Modal generico de 720 con una lista adentro.',
    ],
  },
  {
    fecha: '28 sep', hora: '12:40', chat: 'Portadas, identidad y Clientes', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La cabecera del detalle pasa a ser UNA pieza, y el relevo encontro tres bugs de paso',
    puntos: [
      '**No era un problema de estilos: eran TRES implementaciones.** El detalle de un proyecto (`pd-*`), la ficha de un cliente (`fc-*`) y el del super admin, que ni lo intentaba. El tell que sirve para la proxima: dos de las tres hojas tenian reglas **byte a byte identicas** (`.pd-pill` y `.fc-pill`). Cuando dos archivos tienen una regla CSS caracter por caracter igual, no son dos piezas parecidas — es una pieza y una copia, y la copia ya empezo a divergir en otra linea.',
      '**Los dos numeros de la marca estaban cableados y acoplados** (`top:97` = 124−27, `paddingLeft:86` = 20+54+12). Ahora se calculan, con test. Y la medicion que explica por que duraron tanto: con la marca de 54 del tablero, dejar la sangria fija en 86 NO falla ninguno de los tres casos que la persiguen. Es el corolario 3 de OWNER_WS aplicado a un pixel.',
      '**Mudar una hoja de archivo se lleva puesto lo que no se ve en el estado normal.** El `prefers-reduced-motion` de las pastillas no viajo: no da error, no sale en ninguna captura y ningun test lo mira. Lo cazo un refutador comparando las dos hojas regla por regla.',
      '**Un `zIndex: 90` cableado contra un `Z_BASE` de 130 es un boton que no hace nada.** «¿Borro a esta persona?» desde adentro de cualquier modal dibujaba el dialogo TAPADO. Pasaba con `ConfirmDialog` (15 call sites) y con el de renombrar. Ahora su z sale de la pila y va `anidada`; verificado en el navegador, 132 contra 130.',
      '**Y la fila del equipo tenia la cara vieja:** `u.foto_url` pelado donde la tabla de al lado ya usaba `u.cara`. Es el trap de los dos bloques identicos — el arreglo del dia anterior habia entrado en uno solo de los dos.',
      '⚠️ PROCESO: implementar MIENTRAS la corrida lee hace que sus veredictos se contradigan. Dos de las tres refutaciones fueron contra trabajo mio sin commitear: los lectores describieron HEAD bien y los refutadores leyeron el disco y los refutaron con razon. Quedo escrito en AGENTS.md.',
      'ABIERTO: `FichaCliente` sigue siendo la tercera implementacion, a proposito (su cabecera vive adentro de Modal con cuatro reglas `:has()` y el dueño la shapeo campo por campo). Y `.fc-cambiar` es CSS muerto, `onMako` es un prop obligatorio que nadie usa.',
    ],
    commits: [
      { sha: 'd86fb0d7', msg: 'El detalle de un cliente es LA MISMA PIEZA que el del plan', lineas: 900, archivos: 11 },
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
