# Hallazgos — MaKo Mobile (/m, la PWA del teléfono)

Lo que no se ve leyendo el código de `app/m/`, `lib/movil-*`, `lib/push*`, `lib/mako-turno-app*`,
`public/sw.js` y las extracciones que comparte con escritorio. Las decisiones y la spec están en
[diseno-mako-mobile.md](diseno-mako-mobile.md); el pedido textual, en `/admin/dev/mako-mobile`.
Corridas del 11/10/2026: la v1 (relevo de 7 agentes + 11 de implementación + 1 revisión adversarial),
el diseño v2 a la tarde, y a la noche la implementación v2 (12 agentes + la integración) con el desvío
de teléfonos PRENDIDO. Lo de la v2 está en su propia sección, más abajo.

## El Ops Center del teléfono como WhatsApp: cada chat a pantalla completa y el grupo arriba (13/11/2026)

**Síntoma (medido en producción el 3/11, ws3, 390×844):** la conversación con MaKo era una hoja con asa y ✕ que dejaba ver la página
atrás, la caja ocupaba el 23 % de la pantalla (el chip «Conectar tu IA» y el aviso de la computadora encima de la fila), y abrirla
tardaba 0,5 s en blanco. Martín pidió un chat «muy simple, muy parecido a WhatsApp» y aprobó el prototipo
(docs/prototipos/mako-mobile-chat.html, artifact W5vqkTgaaCLsMKwGnGaByM) el 13/11, con el grupo del negocio fijado arriba.

**Lo obvio era lo equivocado: «MaKo nunca contestó en el grupo de la app».** Leído en producción el 13/11: SÍ contestó, dos veces (4/11,
ws 9 «¿estás vivo?» y ws 19, un cliente, con la lista de leads, a menos de un minuto), y los avisos YA caen en el hilo (115 filas con
`aviso_tipo`, porque `copiarAlGrupo` escribe antes de intentar WhatsApp). Lo que no hay es uso: tres mensajes de personas en la app en
total. Lo que falta probar es hoy, con la línea baneada, y en el teléfono.

**Trampas que cuestan tiempo:**
- **La caja es UNA en toda la app** (CajaChat, tests/chat-unico.test.ts): la de WhatsApp no es otra caja. Se reordena con grid en
  `.m-wa` y la píldora es el `::before` de la fila (un pseudo-elemento es un ítem de la grilla: con ubicación explícita para todos,
  si no los demás se van a la fila 2). El clip es el «+» con la máscara del clip, sin tocar el componente.
- **El historial de las hojas es UNO** (hoja-historial.ts): PantallaChatM lo comparte para que el «atrás» de Android la cierre. Por eso
  una SheetM que se abra encima CIERRA la conversación: Participantes, la Info y tus cuentas de IA siguen ADENTRO, con su «‹».
- **Un `.module.css` rompe los tests que dibujan una pantalla con esbuild** («Cannot import … module.css into a JavaScript file without
  an output path»): BotonFlotanteM no se puede usar en ChatClienteM. El «+» verde es NuevoChatFlotante, con su CSS en chat-wa.css.
- **Mirar sin servidor (la PC no tiene RAM para `next dev`):** las pantallas REALES armadas con esbuild, el router de Next con
  `AppRouterContext`/`PathnameContext`/`SearchParamsContext`, un `fetch` que contesta con datos de ejemplo, los archivos `'use server'`
  cambiados por funciones que dicen «no», globals.css sin sus `@import`/`@source` de Tailwind, y Chrome sin pantalla a 375 con toque por
  CDP (un servidor estático en el mismo proceso: un `type="module"` no carga desde file://). ⚠️ `outdir` relativo se resuelve contra
  `absWorkingDir`: escribió la salida ADENTRO del worktree.
- **La guardia de RAM toma `tsc` en cualquier lugar del comando**, también un `ls node_modules/.bin/tsc`: el `git switch` que lo llevaba
  quedó frenado tres veces.
- **Una caja de chat nueva nace en TRES listas, o la corrida de GitHub da rojo** (corrida 1185, el chat con un lead): `lib/cajas-de-chat.ts`
  (qué ofrece), `EXENTAS` de tests/app-de-escritorio-todos-los-chats.test.ts (si no se bloquea sin la app de escritorio, por qué) y
  `SIN_ADJUNTOS` de tests/chat-formatos.test.ts (si usa `sinAdjuntos`, por qué). Los tests de la pantalla pasan igual: los guards barren
  el repo entero y en la PC no se corren solos.

**Reglas:**
- Toda conversación del teléfono va en PantallaChatM (app/m/_chat): a pantalla completa, con el historial de las hojas. Lo que sigue
  la conversación la busca con `closest(CUERPO_CHAT)`, nunca `.m-sheet__cuerpo` (el chat no bajaba a lo último).
- El aspecto de WhatsApp sólo adentro de `.m-wa`: el hilo y la caja son los de toda la app y la computadora no cambia
  (tests/m-chat-pantalla.test.ts, 3, rechaza una regla sin alcance).

**Sin hacer, con su archivo:**
- Volver a una pestaña sin esperar (cada vuelta re-pide la página: 0,5–1,4 s medidos) y los 364 KB del polyfill de `node:crypto` en
  cada pantalla (cinco importadores de cliente de lib/auth-session.ts: PanelAgencia, TemaCandidato, pila-modales, LoginForm, bitacora).
- Verlo en un teléfono de verdad y en producción, y que MaKo conteste HOY en el grupo de la app cuando lo nombran (espera el sí de
  Martín para escribir en su grupo y la sesión del navegador de la app).

**Hecho después, el mismo día:** la última línea de cada chat con MaKo en la lista (`listarSesiones` la lee con `ultimosDeSesiones`, una lectura
para todas; si falla, la lista sale igual), y la caricatura del Funnel Coach «rota» de las capturas era del arnés, que no servía `public/`
(en producción /asesores/hormozi.png da 200). Y el chat con un lead (ComposerChatsM): la caja de WhatsApp con el clip (WhatsApp y email, con la vista previa a pantalla
completa VistaAdjuntosM y el multipart de escritorio) y la nota de voz por WhatsApp; los globos verde y blanco en app/m/chats/chats.css.
Su trampa: el foco del campo ya no es de un <textarea> propio, así que el teclado de iOS (#51) se mide escuchando focus/blur del `campo` de la caja.

**Vive en:** app/m/_chat/PantallaChatM.tsx · app/m/_chat/pantalla-chat.ts · app/m/_chat/chat-wa.css · app/m/_chat/NuevoChatFlotante.tsx ·
app/m/second-brain/ChatClienteM.tsx · app/m/second-brain/HojaDelGrupo.tsx · app/m/second-brain/FilasDelGrupoM.tsx ·
app/m/operaciones/ChatsMovil.tsx · tests/m-chat-pantalla.test.ts

*13/11/2026, chat «MaKo Mobile: diseño» (claude5).*


## Un título vacío y una palabra larga: lo que el teléfono dibujaba de más y de menos (11/11/2026)

**Vive en:** `app/m/_ui/SeccionM.tsx` · `app/m/m.css` (`.m-fila__t`). Lo fija `tests/mirada-prod-11-11.test.ts` (casos 3 y 7).

- **More: 66 px de hueco entre Create y Settings.** El grupo de Settings no tiene título, pero `SeccionM` dibujaba igual su
  cabecera (un `<h2>` vacío de 28 px más 10 de margen). Ahora, sin título ni acción, no hay cabecera.
- **«Acquisition.com» se veía «Acquisition.con».** `.m-fila__t` corta a dos renglones con `-webkit-line-clamp`, pero una sola
  palabra más ancha que la fila no tiene dónde partirse: se cortaba en seco, sin «…», y se leía como un error de tipeo. Ahora
  `overflow-wrap: anywhere` la baja de renglón. En Spy, además, «Revisado hace 14 h» le quitaba 130 px desde el riel.

**La regla:** lo que va a la derecha de una fila (`riel`) es corto: un número o una palabra. Un «hace cuánto» va en la segunda línea.

## «En mobile aparecen 2 dashboards»: la fila de las hojas quedó de antes del Dashboard unido (24/10/2026)

**Síntoma** (Martín, Android, captura de More › Today): «Dashboard» y «Dashboard sheets», uno abajo del otro. **Causa:**
«Dashboard sheets» (/m/dashboard, las hojas) se sumó el 17/10, cuando la portada todavía no las tenía adentro, con ese
nombre «para no repetir el de la barra». El mismo día el Dashboard se UNIÓ (lib/dashboard-focus.ts): /m/hoy trae Focus y
las hojas del Dashboard en el mismo segmentado. La fila quedó repitiendo lo que la portada ya mostraba. **Regla:** un solo
«Dashboard» en More, el mismo que en la computadora (`masCompleto`, lib/movil-rutas.ts). Quien ve General lo abre en
/m/hoy. El closer y el setter, que no ven General, tienen como Dashboard SU hoja (/m/dashboard), y la portada Today no
sale en More: lo suyo vive en Calendar, el Inbox y el Plan, y /m/hoy sigue siendo adonde rebota una puerta. **Trampa:**
dos tests fijaban las DOS filas (tests/sidebar-nueva.test.ts y tests/movil-mas-secciones.test.ts). Pasaban en verde con
el duplicado porque describían lo que había, no lo que tenía que haber. *24/10/2026, chat «Automations» (claude5).*

## Un lead sin email ni teléfono en el teléfono: el @ cuando es su único canal (23/10/2026)

El escritorio ya dibujaba el @ de un lead que entró sólo con él (docs/hallazgos-crm.md, «Un lead puede entrar con sólo su @»); el
teléfono mostraba una tarjeta vacía y una ficha con Llamar y WhatsApp apagados. **Vive en:** `app/m/crm/reglas.ts` (`soloInstagram`),
`app/m/crm/TableroCrm.tsx`, `app/m/crm/[id]/FichaLead.tsx`, `app/m/crm/datos.ts` · `tests/movil-crm-instagram.test.ts`.

- **El predicado vive DOS veces** (`CrmBoard.soloInstagram` y el del teléfono): no se importa un componente del escritorio. Un test
  extrae el statement del escritorio por AST de TypeScript y lo evalúa junto al del teléfono sobre 200 combinaciones (email y teléfono en
  blanco, null, undefined, @ con espacios, @ que no es usuario). **Cualquier cambio de uno rompe el test del otro, a propósito.**
- **El diagnóstico obvio era el equivocado: «sin `f.telefono` = sin teléfono».** `FichaMovil.telefono` es `numeroCanonico`, que da null
  con menos de 10 dígitos: un lead con un teléfono corto guardado pasaba por «sólo Instagram» en el teléfono y con teléfono en la
  computadora. La ficha usa `lead.telefono_normalizado`, igual que la tarjeta del escritorio (`telefonoNorm`).
- **El @ llega al teléfono porque `LISTA_COLS` (`lib/leads.ts`) incluye `instagram`.** Sin la columna no falla nada: llega `undefined` y el
  chip nunca sale. Está fijado por un test que lo rompe EN MEMORIA (no se rompe el archivo real: otros chats corren tests a la vez).

**Sin hacer:** la ficha del teléfono sigue dibujando «Teléfono: Sin teléfono» y Llamar/WhatsApp grises con un toast para un lead SIN ningún
canal o con sólo email (`FichaLead.tsx`, `case 'contacto'` y la fila `m-crm-acciones`): un botón muerto y un rótulo de falta, contra la regla
de Martín (22/10). El «Redes» del Resumen puede repetir el @ junto a la fila «Instagram». `app/m/hoy`, `app/m/chats` y `app/m/cs` no se
revisaron para un lead de sólo @. Nunca se vio a 390 px (el chip dentro de `.m-crm-tj__txt` y la fila de acciones a tres columnas).

*23/10/2026, chat «Ventas de MaKo» (`claude2`).*

## Las apps de las tiendas: cuentas personales, la TWA y Capacitor armados en Windows, sin Mac (23/10/2026)

Martín (23/10, 02:17): «Sí, a mi nombre ahora»: no hay empresa ni D-U-N-S, las dos cuentas son PERSONALES. El plan, con las
fuentes de ese día: [tiendas-play-appstore.md](tiendas-play-appstore.md); cómo se arma cada app: `nativo/README.md`.

- **Con cuenta personal, el camino crítico es Play, no Apple.** Pide 14 días SEGUIDOS de prueba cerrada con 12 testers antes
  de dejar pedir producción (era de 20 hasta diciembre de 2024), y quien se baja y vuelve empieza de cero: se juntan 15 o 16.
- **Trampa de Apple sin aparato de Apple:** el 2FA se prende desde account.apple.com, pero la verificación de identidad va
  por la app Apple Developer, que sólo corre en iPhone, iPad o Mac, y pide el MISMO aparato para todo el alta. Sin uno: un iPhone
  prestado de punta a punta, o pedirle otro método a soporte. En Argentina no hay Apple Store online: se paga con una tarjeta
  que cobre en dólares.
- **Lo que se ve en la tienda con cuenta personal:** en Play, el nombre legal, el país y el email de desarrollador (va
  `equipo@hola-mako.com`); la dirección completa sólo si la app cobra. En Apple, el nombre legal es el vendedor, y en la UE la
  ficha «trader» muestra SU domicilio (T3 sigue abierta).
- **El diagnóstico obvio era el equivocado: «iOS sin Mac no se puede armar».** `npx cap add ios --packagemanager SPM` corre en
  Windows: con Swift Package Manager no hace falta CocoaPods, y el proyecto de Xcode sale entero. Lo que sí pide una Mac es
  COMPILAR (Xcode 26): eso va en Codemagic (`codemagic.yaml`), no en Actions.
- **Bubblewrap tampoco pide el JDK para generar.** `bubblewrap init` es interactivo y pide el JDK y el SDK de entrada; con
  `@bubblewrap/core` (`TwaManifest.fromFile` + `TwaGenerator`) el proyecto se genera sin ellos. Trampa: los colores del manifiesto
  son objetos de la librería `color`, no strings (`themeColorDark.hex is not a function`). La plantilla de la 1.27.0 ya apunta a
  la API 36.
- **El micrófono dentro del WebView de iOS no hay que escribirlo:** Capacitor 8 ya concede la captura
  (`WebViewDelegationHandler.requestMediaCapturePermissionFor` → `.grant`); queda sólo el aviso del sistema, una vez, con el
  porqué del Info.plist.
- **El ícono de Apple no sale de agrandar el de la PWA:** `public/icon-512.png` tiene las esquinas transparentes y es de 512.
  Se redibuja (`scripts/gen-iconos-tiendas.mjs`) con las medidas y los colores leídos de sus píxeles.
- **`nativo/` va fuera de `tsconfig` y del lint:** son proyectos con su propio `package.json`, y el `**/*.ts` de la raíz los
  agarraría.

**Vive en:** nativo/ · codemagic.yaml · scripts/gen-iconos-tiendas.mjs · docs/tiendas-play-appstore.md · tests/tiendas-nativo.test.ts

**Lo que quedó sin hacer:** la clave de subida y el primer `.aab` (Gradle pide una ventana de RAM: con 1,5 GB libres no se
corrió); las dos huellas en `public/.well-known/assetlinks.json`; el Team ID en `apple-app-site-association` (sale de la cuenta);
la primera corrida de `codemagic.yaml`; y lo de la web para iOS (el modo iOS, guardar y compartir con los plugins, el token de
APNs al servidor y `lib/push.ts` por APNs, abrir los links universales): tabla en `nativo/README.md`.

## «Me sigue apareciendo el logo… y entre medio se ve el Ops Center» (22/10/2026, 09:46, Android de Martín, app instalada)

**Síntoma:** al tocar el ícono, el splash con el ícono (baldosa oscura con la estrella), después el Ops Center unos
segundos, y recién ahí la animación de la criatura. Martín quiere ver SÓLO la criatura hasta que la app está lista.

**Lo que se midió:**
- **Logs de Vercel de la apertura de las 09:45** (UA `Chrome/155`, Android: es una WebAPK): `GET /inicio` 307 →
  `/admin/operaciones` en el borde (32 ms) y UN documento, `GET /admin/operaciones` 200 en **3.039 ms**. La primera acción
  del Centro (React ya hidratado) salió **0,7 s** después de terminar el HTML. Lo del 21/10 (un solo documento) se sostiene.
- **La entrada no estaba en el HTML.** ShellM la cargaba con `dynamic(() => import(EntradaMako), { ssr: false })` y la
  prendía un `useEffect`: existía recién después de hidratar y de bajar su chunk. Chrome saca el splash en el primer
  pintado de la página, y lo primero que se pintaba era el Centro del server, sin hidratar. De ahí «el ops center por unos
  segundos» y la criatura que entra después.
- **El splash lo dibuja la WebAPK, con el ícono MASKABLE.** No es el splash de Android 12: el shell lo apaga
  (`windowIsTranslucent`) y dibuja el suyo, un ImageView de 240 dp (`SplashUtilsForS.createSplashView`). Chrome elige el
  maskable para el splash y también para la pantalla de inicio (`ShortcutInfo::UpdateBestSplashIcon` prefiere MASKABLE).
  Le agrega un margen del 15 % por lado (`webapk_adaptive_icon_size`, 83 dp) y lo recorta con la forma del lanzador. En la
  captura (1080×2316 a 2,625 px por punto; la barra de 3 botones mide 126 px = 48 dp): fondo `#F4F6F9` (el
  `background_color`), la forma una superelipse n ≈ 2,7 de 615 px (235 dp), el maskable dibujado a 720 px (274 dp), todo
  centrado en la pantalla ENTERA (y = 1157 de 2316).
- **El splash dura lo que tarda el server en mandar el primer byte** (~3 s): sin un Suspense arriba, React no escribe
  nada hasta que el Centro tiene sus datos.

**Lo obvio era lo equivocado:**
- (a) **«El splash usa el ícono "any"».** La proporción estrella/forma de la captura (0,52) se parece a la del "any"
  (0,54) y no a la del maskable (0,45). Pero es el maskable con el margen de la WebAPK. Lo decidió el degradé del fondo en
  las franjas laterales: error 0,26–0,35 con el maskable contra 0,65–0,79 con el "any".
- (b) **«Es el splash de Android 12»** (160 dp, AdaptiveIconDrawable recortado a 2/3). Ese cálculo da una estrella 25 %
  más grande que la que se ve. La WebAPK lo apaga.
- (c) **«Se puede cambiar el splash sin tocar el ícono de inicio».** No: es el mismo archivo. Separarlos por tamaños
  (`FindBestMatchingIcon` toma el más chico ≥ al ideal) depende de la densidad de cada teléfono, y en uno de 3,5x la
  pantalla de inicio se llevaría el del splash.
- (d) **El reloj de una animación CSS terminada se queda quieto.** El `currentTime` de `ea-nace` queda en 800 ms aunque
  pasen 2,5 s (medido con CDP en Chromium). Para saber cuánto lleva la entrada en pantalla se lee una animación que sigue
  corriendo (`ea-seguro`, 15 s), no el primer pintado de la página: con ese reloj, una entrada montada navegando (después
  del login) se iba en el acto.

**Lo que se hizo:** la entrada es `EntradaApp` (app/m/_ui), dibujada por el server con CSS en línea. ShellM la hace nacer
prendida y la pone PRIMERA en el shell. Su primer cuadro es el splash copiado: medido contra la captura en Chromium a
411×882 @2,625, la diferencia media es de 1,6/255, ruido de JPEG. Después la baldosa se va y la chispa se vuelve la
criatura, que flota y parpadea. Cuando React hidrató Y la página terminó de llegar (`paginaLista`, ver la revisión de
abajo), nunca antes de 1 s y como mucho a los 15 s, vuela a su lugar en la barra en 420 ms. Con movimiento reducido
queda quieta (sólo fundidos). Sin JavaScript, el CSS la saca a los 15 s. Un script de antes de pintar
(`ARRANQUE_ANTES_DE_PINTAR`) la apaga si ya salió en esta apertura y corrige el centro en la app instalada. El
`background_color` del manifest sale de la misma constante que el fondo de la entrada.

**Reglas:**
- Lo que se ve al abrir va en el HTML del server, con CSS. Nunca un `dynamic(..., { ssr: false })` ni un estado que
  prende un efecto: hasta que hidrata se ve lo de abajo.
- El ícono maskable ES el splash y el ícono de inicio a la vez. Cambiarlo obliga a medir de nuevo `app/m/_ui/entrada.ts`
  (el test fija su sha256).
- Un script de antes de pintar no lee estilos: `getComputedStyle` fuerza el cálculo y las animaciones CSS arrancan antes
  de que se vean.

**Sin hacer:**
- **El splash sigue durando lo que tarda el primer byte (~3 s).** Para que la criatura se mueva antes, el server tendría
  que escribir el shell antes de los datos del Centro (un Suspense/`loading.tsx` en /m/operaciones). Eso trae de vuelta
  el redirect adentro del stream del 21/10: la página tiene `redirect()`. Vive en `app/m/operaciones/page.tsx` y en
  `app/m/layout.tsx` (espera `contextoMovil`, los badges y el perfil).
- **La forma de la baldosa es la de Samsung.** En un Pixel el splash se recorta en círculo, y ahí el primer cuadro difiere
  en las esquinas.
- **El centro vertical se corrige sólo con la página edge-to-edge** (`safe-area-inset-bottom` > 0). Si no, puede quedar
  ~8 dp arriba. No se midió el `innerHeight` real de la app instalada: no hay telemetría del viewport.
- **Sin verlo en el teléfono:** se verificó en Chromium headless y con los tests. Los tipos de `app/m/layout.tsx` no se
  pudieron chequear en esta PC (el tsc acotado se queda sin heap con 2,3 GB libres); el cambio ahí es un import de un
  texto y un `<script>`.

**Vive en:** `app/m/_ui/EntradaApp.tsx` · `app/m/_ui/entrada.ts` (medidas, `ARRANQUE_ANTES_DE_PINTAR`, `trazoForma`) ·
`app/m/_ui/ShellM.tsx` · `app/m/layout.tsx` · `app/manifest.ts` · tests: `tests/movil-entrada.test.ts`,
`tests/movil-entrada-salida.test.ts`

### La revisión adversarial del mismo día: tres agujeros que los tests (regex sobre el fuente) no veían

- **«El efecto corrió = la app está lista» es falso con streaming.** El efecto de EntradaApp corre cuando React hidrata el
  SHELL. En una ruta con `loading.tsx` —la entrada de los CLIENTES (`/second-brain`, su «Ops Center»), y /crm, /inbox,
  /plan, /chats… al abrir un aviso— el server manda primero el layout con el esqueleto, el shell hidrata enseguida y la
  página llega después por el stream. La criatura se iba al segundo y dejaba a la vista el esqueleto a medio cargar: el
  mismo reclamo de Martín, en el camino de los clientes. En el de Martín (super admin → /m/operaciones, sin `loading.tsx`)
  no se notaba, por eso pasó. Ahora espera además a `paginaLista`: `readyState` ya no es `'loading'` (el stream cerró) y no
  queda ningún comentario `<!--$?-->` (borde de Suspense cuyo contenido no llegó) ni `<!--$~-->`. **La trampa del `$~`:**
  React 19.2 (también el que trae Next 16 en `next/dist/compiled`) JUNTA las revelaciones: `$RC` marca el borde `$~` y lo
  revela `$RV` en el próximo cuadro o hasta 300 ms después (`$RT+300`; si cae entre los 2,0 y 2,3 s de la navegación, espera
  a los 2,3 s). Mirar sólo `$?` destapa un esqueleto que ya llegó pero todavía no se ve. Comprobado en Chrome headless
  (`--dump-dom`): durante el parseo da no-lista, con `$?` y con `$~` también, con `$` lista.
- **«Está en el HTML del server» no es «es lo primero que se pinta».** La capa venía AL FINAL del shell, detrás del Centro
  entero (en el SSR de ShellM: la capa en el carácter 1.870, el contenido en el 373). Chrome pinta por tandas mientras lee
  el documento, y el splash de la WebAPK se va en el primer pintado con contenido: ese cuadro podía ser el Centro. Ahora es
  el primer hijo de `.m-shell`; arriba la pone su z-index, no el orden.
- **Un `useEffect` que saca algo ya visto corre DESPUÉS de pintar.** Si ShellM se vuelve a montar navegando (ida y vuelta
  por /mi-curso, /onboarding: fuera del layout de /m), la entrada nace prendida y la marca de sessionStorage la saca en el
  efecto, un cuadro tarde: se veía un parpadeo de la baldosa. El script de antes de pintar no ayuda (corre una vez por
  documento). Al irse, la entrada marca `<html>` con el mismo atributo (`marcarDocumento`) y el CSS la apaga desde el
  primer cuadro.
- **Lo que engaña de los tests:** (a) jsdom está en `node_modules` pero NO en package.json y le falta una dependencia
  (`@asamuzakjp/css-color`): `import 'jsdom'` revienta. No hay DOM para hidratar en node; la salida vive en funciones con el
  navegador inyectado (`programarSalida`, `paginaLista`, `marcarDocumento`) y se corre con un reloj falso. (b) ShellM SÍ se
  puede dibujar en node con `renderToString` dándole `AppRouterContext`, `PathnameContext` y `SearchParamsContext`: así se
  prueba lo que ve el teléfono, no el fuente. (c) Un test escrito como `reloj(MS_MINIMO - 300)` se mueve con la constante:
  con `MS_MINIMO = 0` seguía verde. El número de la regla va escrito a mano.

**Reglas que suma:** una pantalla que tapa la carga se va cuando la PÁGINA llegó (`paginaLista`), no cuando hidrató su
componente; lo que tapa va primero en el HTML; lo que «ya se vio» se apaga por CSS desde un atributo de `<html>`, nunca
sólo en un efecto.

**Sin hacer (revisión):** con el tema OSCURO, ShellM pinta la meta `theme-color` oscura al hidratar mientras la capa clara
sigue arriba: la barra de estado se oscurece ~1 s antes que la app (`pintarBarraDelSistema`, app/m/_ui/ShellM.tsx). Sin ver
en el teléfono: ni la salida nueva ni el orden.

*22/10/2026, pedido de Martín desde el Ops Center (claude3); revisión adversarial el mismo día (claude3).*

## «Siempre que entro me sale el reload» y la entrada de MaKo que nunca se veía (21/10/2026, 22:54, Android de Martín)

**Síntoma:** al abrir la app instalada, el splash y después, en negro, «This page couldn't load. Reload to try again, or
go back.» Con «Reload» andaba. Y la entrada de MaKo (la criatura que cae y saluda) no aparecía nunca.

**Lo que se midió** (logs de Vercel de sus aperturas, `GET https://api.vercel.com/logs/request-logs`, filtrando su UA):
- **Cada apertura eran DOS documentos.** `/inicio` → 307 → `/second-brain` (200) → y recién ahí la página decide «super
  admin → Centro» con un `redirect()`. Como /m/second-brain tiene `loading.tsx`, el redirect viaja ADENTRO del stream:
  Next lo manda como `<meta http-equiv="refresh">` + redirect de cliente, y el navegador hace una navegación DURA a
  /admin/operaciones (un segundo documento, sin `_rsc`). En la apertura de las 22:37 el segundo no llegó nunca: después
  de /second-brain y del POST de `detectarZonaAction` el teléfono no pidió nada más en 45 s: la app quedó muerta ahí
  (la pantalla del reload; el log no la ve).
- **La entrada se gastaba en el documento que se iba.** ShellM ponía la marca de sessionStorage al MONTAR; el primer
  documento la montaba y moría a los 1-3 s con la navegación dura; el Centro ya la encontraba marcada.
- **La pantalla es la de Next, no la nuestra.** «This page couldn't load» con «Reload»/«Back» es
  `next/dist/client/components/builtin/global-error.js`. Next 16 anida dos boundaries en AppRouter: el de afuera con esa
  pantalla, y adentro el de app/global-error.tsx. Que se vea la de Next quiere decir que el error saltó POR ENCIMA de
  app/global-error.tsx y app/error.tsx. Leyendo next 16.2.6, lo que llega ahí es una acción del router cuya promesa se
  rechazó (`use(state)` en el Router); la excepción en sí no se vio.
- **El reportador estaba ciego en el teléfono.** `errores_app` tenía 2 filas en total, las dos de MaKo, ninguna del
  navegador: `ReportadorDeErrores` iba adentro de `<HideOnPublicLanding>`, que en un teléfono apaga TODO.

**Lo obvio era lo equivocado:** (a) el service worker sirviendo chunks viejos — public/sw.js no tuvo nunca un handler
`fetch` (toda su historia), cada apertura pidió HTML nuevo del deploy vigente, el HTML sale `no-store` y los chunks
con `?dpl=` (skew protection prendido); (b) y (c) una excepción de /m o de la animación al montar — habrían caído en
NUESTRA pantalla («Esta pantalla se rompió al dibujarse»), no en la de Next.

**Lo que se hizo:**
- El super admin entra al Centro desde el BORDE (`entradaMovil`, lib/movil-desvio.ts): `/inicio` y `/second-brain` pelado,
  sin `?ws=`, son un 307 directo a /admin/operaciones. Un documento; la entrada sale ahí.
- La marca de la entrada se pone al TERMINAR (`finEntrada` en ShellM).
- `CentinelaArranque` (app/_components): un `<script>` sin React en el layout. Si `<html>` pasa a `id="__next_error__"`
  (sólo la pantalla de Next lo pone), manda el último error de la ventana a /api/errores como `PantallaDeNext` (que nunca
  es ruido) y recarga UNA vez; otro choque dentro de 60 s deja la pantalla. El reportador ahora corre también en el
  teléfono (`FueraDeLoPublico`) y se calla ante la pantalla de Next (un choque, un ticket).

**Reglas:**
- Lo que REDIRIGE sin dibujar va en el proxy. Un `redirect()` de una página con `loading.tsx` encima es una navegación
  dura de cliente: dos documentos, y todo lo que «pasa una vez por apertura» se gasta en el primero.
- Lo que «pasa una vez» se marca cuando PASÓ, no cuando se montó.
- La pantalla de Next («This page couldn't load») no la ven nuestros boundaries: la mira el centinela.
- `<HideOnPublicLanding>` es para el CROMO. Lo que es de la persona logueada va con `FueraDeLoPublico`.

**Sin medir:** la excepción exacta que tumbó la apertura de las 22:37 (no hay forma de verla sin el teléfono). La próxima
vez llega a la Ticketera como «PantallaDeNext» con su mensaje. Si con un solo documento sigue cayendo, ése es el dato.
**Sin hacer:** /m/second-brain sigue redirigiendo adentro del stream para quien entra con `?ws=` de su propio negocio
(app/m/second-brain/page.tsx); y su `loading.tsx` dice «mientras se arma el mapa», pero esa página ya es el chat.

**Vive en:** `lib/movil-desvio.ts` (`entradaMovil`, `CENTRO_MOVIL`) · `proxy.ts` (`seguirOMovil`, `operador`) ·
`app/m/_ui/ShellM.tsx` · `app/_components/CentinelaArranque.tsx` · `app/_components/ReportarErrores.tsx` ·
`app/_components/PublicRouteGate.tsx` (`FueraDeLoPublico`) · `lib/errores-app-reglas.ts` (`PANTALLA_DE_NEXT`) ·
test: `tests/movil-carga-sin-error.test.ts`

*21/10/2026, pedido de Martín desde el Ops Center (claude3).*

## El Ops Center al medio de la barra y como portada (20/10/2026, pedido del Ops Center bb885d5f)

Martín: «Que en Mobile, el Ops Center esté donde está el Dashboard, que sea la tab principal». La barra es CRM · Chats ·
Ops Center · Plan · More; la app entra ahí (`ENTRADA_MOVIL`, en el borde de `/inicio`, en `app/inicio` y en `/m` pelado), y
el Dashboard (/m/hoy) encabeza lo diario de More. El lugar del medio tiene la id `mako`, la misma de su fila de More, así
que More no lo repite sin una regla aparte. Para el super admin sin mirar un cliente el lugar abre el Centro
(/m/operaciones); para los demás, su chat (/m/second-brain).

**El diagnóstico obvio era el equivocado: `quienOpera()` NO sirve en el teléfono.** Parece la pregunta justa («¿es Martín
en lo suyo?») y es la que usa escritorio, pero mira `estaImpersonando()`, que cuenta CUALQUIER `?ws=` de la pestaña. En el
teléfono el super admin siempre lleva el `?ws=` de su negocio (la puerta se lo pone), así que ahí `quienOpera()` siempre
dice que no: la rama `|| await quienOpera()` de /m/second-brain, que debía mandarlo al grafo, era código muerto en el
teléfono y nadie lo notó. **La regla:** en /m la pregunta es `ctx.sesion.rol === 'admin' && !ctx.impersonando`
(`contextoMovil` sí distingue el negocio propio); es la de la fila del Centro en More, la de la barra (app/m/layout.tsx) y
la de /m/second-brain.

**Trampas al mover un lugar de la barra (no dan error):**
- El primer destino del super admin no lo decide `/inicio` sino la puerta: sin `?ws=`, `requireMovil` lo redirige a donde
  diga (era el Dashboard; ahora el Centro). Cambiar sólo la entrada lo dejaba en el Dashboard.
- El número de «lo que espera una decisión» (`app/m/badges.ts`) colgaba de la id del lugar del Dashboard (`hoy`): al sacar
  el lugar, el número desaparece en silencio. Ahora va en More y en la fila del Dashboard.
- La cabecera buscaba el Dashboard en `DESTINOS_MOVIL` con `find(...)!`: sin él, `undefined` en el «volver» de Avisos.
- **El ícono declarado no es el que se dibuja** (21/10/2026, Martín lo vio en su Android: «Pusiste a Ops Center con el logo
  del Second Brain»). La fila de More dice `icon: 'cerebro'`, pero More y la sidebar dibujan el Ops Center con la CRIATURA de
  MaKo (`criatura(…, estrella)`), aparte del dato. Al subirlo a la barra se copió el dato y salió el cerebro. Ahora el
  destino lleva `criatura: true` y ShellM dibuja `<Criatura estrella>`, que flota y parpadea. **Regla:** al mover algo a
  otro lugar, mirá CÓMO se dibuja donde estaba, no sólo sus datos. La pantalla del Centro tampoco volvía a More: es raíz.
- **La entrada de MaKo al abrir la app** (21/10/2026, mismo pedido): es la de app/onboarding/EntradaMako.tsx, reusada con
  un `destino`, una vez por apertura (sessionStorage) y volando a la criatura de la barra. Copiarla la habría dejado vieja.
  ⚠️ Va con `next/dynamic` en ShellM: importada de frente, su criatura arrastra `criatura.css` al índice de app/m/_ui y
  tumba los tests de node que lo importan (run 182 cayó en tests/m-offer.test.ts; es la misma trampa del `.module.css`).

## Las tabs de CREACIÓN en el teléfono: editores, AI Avatar y writers (17/10/2026, «Mobile 1»)

Pedido de Martín (17/10, 12:56): «Implementa completamente MaKo Mobile en todas las tabs, porque hay muchas que aun no se
pueden acceder… Siempre copia de otras apps que ya lo hacen bien». Rama `mobile-creacion-1710` (C:/dev/wt-mobile). Hasta
ese día un teléfono que abría /video-editor, /image-editor, /reels, /stories, /carousels, /ai-avatar o /admin/copywriting
veía la cubierta «Esta pantalla se usa en la computadora». Ahora cada una tiene su pantalla (copiada de CapCut, Canva,
HeyGen, el compositor y el visor de Instagram, y Readwise), y Video, Image, Copywriting y AI Avatar llevan arriba la barra
de secciones de escritorio (`SeccionesTabM`, con la regla de la sidebar). Todo mirado a 390 px con Chrome headless.

**El diagnóstico obvio era el equivocado: los dos editores NO necesitaban un editor nuevo.**
- Image Editor: el motor (Doory) ya tiene su modo para pantallas chicas: por debajo de 1024 px las herramientas pasan a una
  tira abajo y cada una abre como hoja (`EditorApp.tsx` → `compact`). Es el editor de Canva del celular. El teléfono monta
  el MISMO editor por su única puerta (`ImageEditorCliente`) en una capa a pantalla completa (`_creacion/PantallaCompletaM`).
- Video Editor: el motor (OpenCut) dibuja y EXPORTA en el teléfono (WebGL2; medido: un proyecto con dos clips, Dividir,
  Deshacer y el MP4 exportado). El teléfono no copia lógica: cada herramienta INVOCA la acción del motor
  (`invokeAction('split' | 'delete-selected' | 'undo' | 'redo' | 'toggle-play')`), que registra el `EditorProvider`. Lo
  único propio es CÓMO se elige (la tira de clips, en vez de la línea de tiempo).
- **La regla:** antes de escribir la versión del teléfono de una pantalla pesada, mirar si su motor ya tiene modo chico
  (Doory) o si sus acciones se pueden invocar sin su UI (OpenCut). Una «versión reducida» propia duplica el motor.

**Trampas del entorno (no dan error):**
- **Una fila OCULTA de `SECCIONES_MAS` le BORRA a una tab `adminOnly` su fila de More.** `masCompleto` (Mobile 2) saltea
  una tab que «tiene sección en el teléfono» pero que la regla del teléfono no muestra; y `puedeVerKey` no mira
  `adminOnly`. AI Avatar va SIN fila: More la arma desde la sidebar por su ruta, y su cabecera la pone cada page con
  `<CabeceraM>`. (Lo que se pierde: More no se marca en la barra de abajo, `destinoActivo`.) Copy Method sí tiene fila,
  con el `superAdmin` de Mobile 2 (una herramienta de ADMIN_NAV: su page se cuida con `getSesionAdmin()`).
- **Un `.module.css` en una pieza de `app/m/_ui` exportada por el ÍNDICE tumba tests de node** (tests/m-offer: «Unexpected
  token '.'»): el índice lo importan tests que no cargan CSS. `BotonFlotanteM` se importa por su ruta, y la barra de
  secciones lleva sus clases en m.css (tests/m-superadmin importa `seccionesDeTabM`).
- **Dos agentes hicieron la MISMA barra de secciones el mismo día** (Mobile 2 para Automations, éste para Video, Image,
  Copywriting y AI Avatar), con el mismo nombre de archivo y otra API. Quedó UNA: la API de Mobile 2
  (`<SeccionesTabM tab activa vista>`, `seccionesDeTabM`) con el dibujo de ésta (`BarraSeccionesM`: se desliza, «pronto» y
  centra la elegida).
- **`next build --debug-build-paths` con `[param]` en la ruta no compila esa página y no avisa**: los corchetes son una
  clase de caracteres del glob. Se pide la carpeta (`app/m/video-editor/**`). Después, el parche de `dynamicRoutes` de
  siempre (receta en el relevo).
- **El reproductor de escritorio no entra en 390 px**: su fila de abajo (HH:MM:SS:FF + cuatro menús) se pisaba con ▶. El
  teléfono la esconde por sus clases de Tailwind (`video-editor.css`) y tests/m-creacion falla si el motor las cambia.
- **Una barra que se desliza abre en su comienzo**: en Image › Carousels y Copywriting › Stories (la cuarta) la sección que
  se miraba quedaba afuera, sin nada que dijera dónde se estaba. `SeccionesTabM` la centra al montar.
- **Ver el Image Editor sin tocar la base**: Chrome con `Fetch.enable` sobre `*/api/image-editor/*` y la respuesta del
  diseño armada a mano (y un `{ ok: true }` a cada PATCH). El ws9 es sólo para leer y no tiene diseños.
- **Los proyectos del Video Editor son de CADA aparato** (IndexedDB/OPFS, por negocio): los del teléfono no aparecen en la
  computadora ni al revés. No es un bug del teléfono; lo dice la fila «En la computadora» del inicio.
- **Dos agentes hicieron las «Coming soon»**: Mobile 2 con `/m/pronto/<key>` (se deriva de nav.ts) y éste con una carpeta
  por tab. Quedó la de Mobile 2; antes de sumar pantallas de una lista compartida, mergear `origin/integracion`.
- Lo que el teléfono reusa de una pantalla `'use client'` de escritorio se MUDÓ a un módulo puro y escritorio lo importa:
  el texto de «Copiar» de Stories (`app/stories/texto.ts`) y de Carousels (`app/carousels/pieza.ts`).

**SIN HACER (con su archivo):**
- AI Avatar: escritorio todavía filma con su copia del lazo (CrearVideo en app/ai-avatar/AiAvatarCliente.tsx); que use
  `app/ai-avatar/filmar.ts` es del chat «AI Avatar». Generar un look o un video desde el teléfono no se probó (pide el
  puente vivo y gasta); las tomas se filman mientras la pantalla esté abierta.
- Video Editor del teléfono (app/m/video-editor): sin línea de tiempo, texto, audio, efectos, «Relación» ni «Editar con
  IA»; exporta sólo MP4 en alta. «Guardar en el teléfono» (`navigator.share`) no se probó en un iPhone.
- Image Editor del teléfono: crea con los seis tamaños de la API (los demás y el personalizado, en la computadora); los
  gestos de fabric con el dedo no se probaron en un teléfono.
- Reels, Stories y Carousels: generar no se probó (gasta IA del negocio); Stories y Carousels guardan la sesión en la
  pantalla, como escritorio.
- More no se marca en la barra en AI Avatar (no tiene fila: ver arriba).
- Nada se vio en un teléfono de verdad.

**Vive en:** lib/movil-creacion.ts (rutas y filas) · app/m/_creacion/ (`secciones.ts`, `escritor.tsx`,
`PantallaCompletaM.tsx`) · app/m/_ui/SeccionesTabM.tsx y BotonFlotanteM.tsx · app/m/{video-editor, image-editor,
ai-avatar, reels, stories, carousels, admin/copywriting} · tests/m-creacion.test.ts.
*17/10/2026, claude4 (chat «Mobile 1: tabs de creación»).*

## Toda tab del nav con su lugar en el teléfono: More derivado de la sidebar, el guardián y las pantallas de negocio (17/10/2026)

Pedido de Martín (17/10, 12:56, desde el Centro): «Implementa completamente MaKo Mobile en todas las tabs, porque hay
muchas que aun no se pueden acceder». Lo hizo el agente «Mobile 2» (rama `mobile-negocio-1710`, C:/dev/wt-general-epico).
Las pantallas nuevas son Reportar problema, Configuración del negocio (Equipo, Integraciones, Notificaciones, Fiscal y Tu
plan), API, las «Coming soon», MaKo Messages, AI Models, MaKo Context, Knowledge, Billing y Client Agents.

**Por qué «no se podían acceder»: More era una lista APARTE.**
- Síntoma: Image, AI Avatar y todo el menú de la foto no estaban en ningún lado del teléfono. Su URL abría «Esta pantalla
  se usa en la computadora» sin que nadie lo hubiera decidido.
- Causa: More se armaba sólo con `SECCIONES_MAS`. Una tab que se sumaba a nav.ts no tenía por dónde aparecer.
- **La regla:** More se DERIVA de lo que dibuja la sidebar (`masCompleto`, con `puedeVerItem`/`resolverTab` de
  lib/nav-visibilidad.ts). Una tab sin pantalla aparece como «En la computadora», con su motivo y la salida
  (`FilaEnComputadoraM`). Cada key de nav.ts tiene uno de tres estados: pantalla, `SOLO_ESCRITORIO` (con el motivo
  que lee la persona) o `EN_CAMINO` (con el chat que la escribe). tests/movil-toda-tab.test.ts lo exige y falla también
  con una marca VIEJA, la de una tab que ya tiene pantalla y sigue anotada. Está en AGENTS.md (MaKo Mobile).

**General salía dos veces en More, y sólo se vio a 390 px.** Lo que está en la barra se salteaba por key, y General
(la portada) es `navKey: null` en `DESTINOS_MOVIL`. Ahora se saltea también por su ruta del teléfono, y el guardián falla
si More repite algo de la barra o una fila dos veces. Los tests de la primera versión pasaban: miraban que no FALTARA nada,
no que sobrara.

**Las herramientas del super admin no pasan por `requireMovil({ navKey })`.** Sus keys (nav.ts → `HERRAMIENTAS`) no
están en `TODOS_LOS_ITEMS`, y `puedeVerKey` cierra la puerta a todos sin error. Su fila lleva `superAdmin: true` y la
página pregunta `getSesionAdmin()` antes de leer nada, como la de escritorio. Y al revés: `puedeVerKey` no sabe del
super admin, así que MaKo Partners (`soloCapas`), que la sidebar le muestra, en el teléfono no lo ve. El guardián lo
tiene anotado como diferencia conocida (`MAS_ESTRICTO_EN_EL_TELEFONO`).

**El `?tab=notif` de los 49 avisos iba a OTRO lugar en el teléfono.** Escritorio lo manda desde el 15/10 a las
Notificaciones DEL NEGOCIO (`rutaDeTabVieja`); el teléfono seguía mandándolo a «Tu cuenta». Ahora va donde la
computadora. Dos tests de otras áreas fijaban rutas del teléfono y no eran `movil-*`: tests/push-payload.test.ts e
integracion-sin-salir.test.ts. El run 120 cayó por ellos. Lo mismo pasó con tickets-decisiones-mazo («/tickets no
se toca») y con los ejemplos de «se usa en la computadora» de movil-desvio y movil-mismas-rutas. **Antes de un VERDE,
`node scripts/antes-de-subir.mjs --rapido`** (con `C:/dev/pesado.lock`): elige los tests que miran lo que tocaste, sean
del área que sean.

**Knowledge: la computadora guarda dónde estás en el `#hash`, que el server no ve.** El proxy no puede saber qué curso
pidió el link. Lo que sí llega son los links de antes (`?curso=<slug>&clase=<n>`), que la computadora traduce sola a su
hash: el teléfono se cuelga de esos en los dos sentidos.

**MaKo Messages: la página de escritorio siembra con OTRO store que el que edita.** /mensajes llama
`listarPlantillas()` directo (en el ws de la plataforma, el store efectivo del ws9), y /api/admin/plantillas lee y
escribe la BASE (`enSuStore`). Hoy dan lo mismo porque el ws9 no tiene entradas propias, pero si las tuviera, un
interruptor guardado no se vería al recargar. El teléfono usa el de la ruta (`enElStoreDeLaPestana`, lib/plantillas.ts).
Escritorio quedó como estaba.

**Más rápido: abrir con lo que leyó el server.** Equipo, Notificaciones, MaKo Messages, AI Models y MaKo Context
pintaban un esqueleto y recién después pedían su lista al navegador: 0,3-0,8 s más, medido a 390 px. Ahora la página
lee en el server con la MISMA función que su ruta y monta el componente con `key={Date.now()}`, así que tirar hacia
abajo trae lo nuevo. Si el server no pudo leer, el cliente la pide como en la computadora. Un archivo `route.ts` no
puede exportar ayudantes, así que la lectura se mudó a lib (`equipoDe` en lib/usuarios.ts,
lib/destinatarios-negocio.ts, `enElStoreDeLaPestana`) y la ruta la usa.

**Lo que mueve plata o muestra un secreto UNA vez queda en la computadora, y la fila lo dice.** Son crear o regenerar un
token de la API, vender un plan, anular o reembolsar un cobro y conectar una integración. El modal de conectar es un
`Modal` de escritorio: tests/integracion-sin-salir.test.ts anota la pantalla del teléfono en `QUEDAN` con ese motivo.

**Trampas del entorno (las que costaron tiempo):**
- **El scratchpad de la sesión lo comparten los agentes hermanos.** Otro agente dejó un `romper.py` y mi arnés lo
  importó por el mismo nombre: corrió SUS roturas sobre C:/dev/wt-mobile (las restauró por hash). Cada agente usa su
  subcarpeta (`scratchpad/mobile2/`).
- **El disco tenía 3 GB y `node_modules` pesa 1,3 GB:** no entraba una copia. Lo que anduvo es apuntar el junction del
  worktree al `node_modules` REAL de un hermano (C:/dev/wt-mobile) y subir `turbopack.root` a C:/dev, sólo en el
  `next.config.ts` local y sin commitear. Al terminar, el build deja `.next/node_modules/postcss-*` y `sharp-*` como
  junctions a ESE `node_modules`: se sacan de a uno con `[System.IO.Directory]::Delete(ruta, $false)` antes de borrar
  `.next`, o se vacía el del hermano.
- **`--debug-build-paths` con `[[]id]` no compiló las páginas `[param]`;** `app/m/tickets/**` sí.
- **Git Bash convierte «/mas» en «C:/Program Files/Git/mas»** cuando es un argumento de `node`: las rutas que se le
  pasan al medidor van con `MSYS_NO_PATHCONV=1`.
- **El primer pedido después de `next start` tarda ~2 s más** por la hidratación de credenciales («boot: hidratando»).
  No es la página: se mide desde el segundo.

**SIN HACER (con su archivo):**
- Strategy, Offer Playbook y MaKo WhatsApp siguen en `EN_CAMINO` «sin dueño» (lib/movil-rutas.ts). Las de Mobile 1, igual.
- MaKo Partners para el super admin en el teléfono: `puedeVerKey` (lib/movil-rutas.ts) y `requireMovil` (lib/movil-guard.ts)
  no saben de `adminShell`.
- Conectar una integración desde el teléfono: una hoja con lo del `ServicioModal` (app/m/configuraciones/integraciones).
- General (Horario y Criterio) y Método en el teléfono (hoy «En la computadora», app/m/configuraciones/page.tsx).
- Los campos de formulario de app/m/configuraciones/configuraciones.css los importa también /m/contexto: son una primitiva
  esperando su lugar en app/m/m.css.
- Nada se miró en un teléfono de verdad, ni con un cliente (el ws3 tiene el onboarding pendiente y tapa /m).

**Vive en:** lib/movil-rutas.ts (`masCompleto`, `SOLO_ESCRITORIO`, `EN_CAMINO`, `UNA_A_UNA`, `SECCIONES_NEGOCIO_M`) ·
app/m/mas/ · app/m/_ui/EnComputadoraM.tsx · app/m/_ui/SeccionesTabM.tsx · app/m/{tickets,configuraciones,pronto,mensajes,
modelos-ia,contexto,api-mako,conocimientos,cobros,agente}/ · tests/movil-toda-tab.test.ts y los m-* de cada pantalla.
*17/10/2026, claude4 (agente «Mobile 2»).*

## El CRM y el Plan del teléfono rediseñados copiando Pipedrive, HubSpot, Todoist y Linear (17/10/2026)

Pedido de Martín (17/10, 12:56, por el Centro de Operaciones): «rediseña las actuales de CRM, Plan, etc… Siempre copia
de otras apps que ya lo hacen bien». Rama `mobile-rediseno-1710` (C:/dev/wt-graphics). Qué se copió de cuál está en la
cabecera de cada pantalla (app/m/crm/TableroCrm.tsx, app/m/crm/[id]/FichaLead.tsx y page.tsx, app/m/plan/ListaPlan.tsx);
las capturas antes/después, en docs/prototipos/mobile-rediseno-1710-crm.png y -plan.png.

**Para ABRIR la referencia de una app de teléfono sin un teléfono: la API de búsqueda de iTunes.**
- `https://itunes.apple.com/search?term=pipedrive&entity=software&country=us` devuelve, por app, `screenshotUrls`: las
  capturas de la App Store. Cambiando el final de la URL por `600x0w.jpg` se bajan a buen tamaño y se leen con la
  herramienta de imágenes (con `sharp` del repo se arma una hoja con las seis).
- Lo obvio era la página de la App Store (`apps.apple.com/us/app/<nombre>/id<n>`) con un id adivinado: devuelve 1 KB sin
  capturas. Las búsquedas web devuelven la documentación de ESCRITORIO de Pipedrive y nada de cómo se ve en el teléfono.

**El rediseño es PIEL del componente compartido, desde la carpeta de la pantalla.**
- KanbanM (app/m/_ui) lo usan el CRM, Clientes y el Plan. La piel va en `crm.css` / `plan.css` debajo de una clase que
  envuelve al tablero (`.m-crm-tablero`, `.m-plan-tablero`) y el componente no se toca: Clientes sigue como estaba.
- ⚠️ **La copia que sigue al dedo al arrastrar cuelga de `#m-root`, FUERA del envoltorio**: las clases de lo de adentro de
  la tarjeta (`.m-crm-tj*`) van sin el envoltorio delante, o la tarjeta arrastrada se dibuja desarmada. Las de la caja
  (filete, sin radio) sí van con él: la copia se ve como tarjeta levantada.
- Las reglas de m.css con la misma especificidad pierden contra las de la pantalla (se cargan después): al pisar el
  fondo de la columna se perdió el resaltado de destino (`[data-destino]`) y la animación de llegada; hubo que
  reponerlos con el envoltorio delante, también en `prefers-reduced-motion`.

**«Sin empresa» es un RELLENO, no un dato.**
- Síntoma: la segunda línea de casi todas las tarjetas del CRM del teléfono decía «Sin empresa» (todas las de la
  columna mirada del ws9), y nunca decía por dónde llegó el lead, que era su respaldo (`company || llegoPor(...)`).
- Causa: `mapToCrmLead` (app/crm/crm-map.ts) pone `company: l.empresa ?? 'Sin empresa'`, así que el `||` nunca cae.
- Regla: un campo de `CrmLead` puede venir RELLENADO para la tarjeta de escritorio; antes de usarlo como «¿hay dato?»,
  mirar el mapper. El teléfono compara contra `SIN_EMPRESA` (app/m/crm/datos.ts).

**El `chevron` de app/_components/icons.tsx apunta hacia ABAJO.** FilaM lo rota para el «›». Rotarlo 90° «para que
apunte abajo» lo dejó en «‹» (visto a 390 px). Antes de rotar un ícono, mirá hacia dónde apunta.

**Lo que NO se copió, y por qué** (para que nadie lo «complete»):
- El triángulo amarillo de Pipedrive («sin actividad planificada»): escritorio no tiene esa alarma, y un tablero que
  reclama algo en cada tarjeta es lo que hacía abandonar el CRM a Mauricio (memoria crm-guardar-nunca-bloquea). La
  señal se alimenta SÓLO con el pie de la tarjeta de escritorio: la reunión que viene (verde) y la Nutrición manual
  vencida (rojo). Una reunión que ya pasó no es «agendado».
- Las flechas ‹ › y los botones Won/Lost de la ficha de Pipedrive: desde el teléfono no se va a cualquier etapa (Ganado,
  cobros y las del wizard son de la computadora, `seMueveEnElTelefono`); la barra abre «Mover de etapa», que dice a
  cuáles sí.
- El «+» de Pipedrive (nuevo deal) y el agregar rápido de Todoist: escritorio los tiene, pero en el teléfono son
  funciones nuevas (el alta de una tarea dispara al Perro, AGENTS.md). Quedan en el relevo.

**Mirar /m en local, lo que costó esta vez:**
- **Copiar `node_modules` desde el clon de OneDrive tardó 49 minutos**, no «~1-3 min»: 60.823 archivos a 20 MB/min,
  con el disco tan ocupado que un `grep` de 120 s y un `du` se cortaron por tiempo. Y 7 archivos de `onnxruntime-node`
  fallaron la primera pasada (una segunda pasada con `/XO` los copió). Se lanza en segundo plano y se trabaja el código
  mientras.
- **Desde el Git Bash, `robocopy … /E` falla**: el Bash convierte `/E` en `E:/` («Invalid Parameter #3»). Va por
  PowerShell. Y por lo mismo, **un argumento `/crm` a un script de node llega como `C:/Program Files/Git/crm`**: CDP
  contesta «Cannot navigate to invalid URL» y la foto sale en blanco sin error. `MSYS_NO_PATHCONV=1`.
- **`--debug-build-paths` lee GLOBS: `app/m/crm/[id]/page.tsx` es una clase de caracteres** y la ficha no se compila (sin
  aviso; la tabla de rutas del build parcial no se imprime). `app/m/crm/*/page.tsx` sí; `[[]id]` tampoco anduvo. Se
  confirma en `.next/app-path-routes-manifest.json`.
- El ws3 sigue con el onboarding pendiente (todo /m va a `/configurar`): se miró con el ws9 sólo leyendo. **Las capturas
  que van al repo no llevan datos de leads**: antes de la foto, un script cambia los nombres por ficticios y desenfoca
  teléfono, email y notas (el diseño es el real).
- «Mover a…» se abrió en el navegador con `PointerEvent` sintéticos (pointerdown, 700 ms, pointerup): KanbanM lo
  escucha con los handlers de React y la hoja se abre sin escribir nada. Arrastrar de verdad no se probó (sin ws3).

**SIN HACER (con su archivo):**
- Mover un lead y una tarea en el ws3 con la piel nueva, en un teléfono (arrastrar y «Mover a…»): app/m/crm/crm.css,
  app/m/plan/plan.css. Y ver el punto verde con una reunión real (el ws9 no tenía ninguna próxima).
- El «+» para cargar un lead (Pipedrive) y el agregar rápido de una tarea (Todoist): app/m/crm/TableroCrm.tsx,
  app/m/plan/ListaPlan.tsx; el alta de tareas pasa por el Perro (AGENTS.md, «Crear tareas dispara al Perro»).
- Calendar (app/m/calendario) ya es la copia de Google Calendar (Día · Agenda) y la portada General (app/m/hoy) dibuja
  la hoja de escritorio por decisión: no se rediseñaron en esta tanda.

**Vive en:** app/m/crm/ (`senalDeTarjeta`, `progresoEnFunnel` en reglas.ts; `SIN_EMPRESA` en datos.ts; la piel en
crm.css) · app/m/plan/ListaPlan.tsx y plan.css · tests/m-crm-rediseno.test.ts · tests/m-plan-rediseno.test.ts ·
docs/prototipos/mobile-rediseno-1710-*.png.
*17/10/2026, claude4 (agente «Mobile 3: rediseño de CRM y Plan»).*

## Chats del teléfono con todos los canales, y la primera auditoría MIRADA a 390 px (17/10/2026)

Pedido de Martín (17/10, 10:35): «Implementa end to end MaKo mobile, hay muchas cosas que faltan o podrían
mejorarse». Rama `mobile-e2e-1710` (C:/dev/wt-mobile). Por primera vez se miraron TODAS las pantallas de /m en un
navegador (Chrome headless, iPhone a 390 px) contra un `next start` local: ninguna rompía; lo roto para un cliente
era Chats.

**Chats vacío con la bandeja de la computadora llena.**
- Síntoma: un negocio que vende por Instagram (o Messenger, o Email) veía «Todavía no hay chats.» en el teléfono, y
  un aviso de Instagram (`/chats?c=ig:…`) abría esa lista vacía.
- Causa: `app/m/chats/datos.ts` leía `getConversacionesNoOficial` (sólo WhatsApp, sólo con lead). Su cabecera decía
  «cuando lleguen los chats unificados, la lectura cambia acá»: llegaron a main el 15/10 y nadie volvió.
- **La regla:** cuando escritorio cambia DE DÓNDE lee una tab (una bandeja que se unifica, una tabla nueva), la
  lectura del teléfono se cambia en el mismo trabajo. Se busca quién lee la fuente vieja en `app/m`
  (`grep -rn <lector viejo> app/m`): un teléfono que lee la fuente vieja no rompe, muestra VACÍO.
- Ahora: la lista es `listarChats` (lib/chats.ts, la misma de GET /api/chats) con `paginasWhatsapp: 3` (la opción
  nueva: sin ella, el espejo entero, 5,5-7,8 s en el ws1); los filtros son los de escritorio (`filtrarChats`,
  `contarBandejas`, `coincideBusqueda`); una conversación es `/m/chats/<clave>` (en escritorio `/chats?c=<clave>`),
  con `hiloDeChat` y un composer que sale por las MISMAS rutas que escritorio (WhatsApp con su línea, social con
  idempotencia, email). `/chats?c=` y `?lead=` van directo a la conversación; `?linea=&chat=` se busca en la lista
  con `resolverLinkProfundo`, que nunca elige otra.
- **El día del hilo sale de la zona del NEGOCIO.** `armarHilo` de escritorio usa la hora local porque dibuja en el
  navegador; el teléfono dibuja en el server (UTC) y un mensaje de las 22 h de Buenos Aires caía en el día siguiente
  (`diasDelHilo`, app/m/chats/hilo-modelo.ts).
- El botón «WhatsApp» de la ficha del teléfono abre la conversación en Chats con `rutaChatsDeLead`, la función de
  escritorio (antes, el hilo de sólo WhatsApp `/m/crm/<id>/chat`, que sigue existiendo).
- Los rótulos (bandejas, Mostrar, Orden, canales) se escriben una vez en app/m/chats/modelo.ts y
  tests/m-chats.test.ts los cruza contra app/chats/PanelBandejas.tsx y ListaChats.tsx.
- **Los tests que fijan rutas del teléfono no son sólo los `movil-*`**: tests/chats-verificacion.test.ts esperaba
  `/chats?lead=7` → `/m/crm/7/chat`, y tests/chats-datos.test.ts contaba TRES argumentos en cada lectura de WhatsApp
  de lib/chats.ts (el cuarto, las páginas del teléfono, se leía como «sin la línea»). Los encontró el Cerebro al
  integrar. Antes de un VERDE que toque lib/chats.ts o una ruta de Chats: `tests/chats*.test.ts` y
  tests/sidebar-nueva.test.ts, además de los del teléfono.

**Mirar /m en local sin `next dev` (lo que costó una hora):**
- **`next start -H 127.0.0.1` + LAS MISMAS RUTAS = ERR_TOO_MANY_REDIRECTS en TODA pantalla.** El diagnóstico obvio
  («el desvío arma un bucle») era el equivocado: el proxy reescribe a `new URL('/m/crm', req.url)` con host
  `localhost`, y Next trata un rewrite a OTRO host como externo — lo pide de nuevo por HTTP, entra por el proxy como
  `/m/crm` («URL /m vieja») y lo redirige a `/crm`. Con `-H localhost` (y el navegador en `localhost`) anda.
  Producción no lo tiene: el host del pedido y el del rewrite son el mismo.
- **Un build parcial (`--debug-build-paths`) deja `dynamicRoutes` vacío en `.next/routes-manifest.json`**: toda ruta
  con `[param]` da 404 en `next start` aunque compiló (y la tabla «Route (app)» no se imprime). Se parchea el
  manifest con la regex de cada página (script en el relevo). No es un bug de la pantalla.
- El vigía mata un build parcial de más de ~8 páginas de /m (3,4 GB con 16 chats abiertos): de a 3-8 páginas,
  con el server parado (comparten `.next`).
- **La sesión firmada a mano se firma con `ws: 9`** (lo que tiene la fila de Martín). Sin `ws`, `requireMovil`
  manda al admin a `/general?ws=9`, y con `?ws=9` el admin «está mirando un cliente»: el Plan lee el tablero de
  CLIENTE del ws9 y dice «No hay tareas abiertas». Parecía un bug del Plan del teléfono; era la sesión de prueba.
- El ws3 tiene el onboarding pendiente y tapa todo /m (`/configurar`): las tabs se miraron en el ws9 sólo leyendo,
  y el ws3 sirvió para ver el onboarding (el chat de Offer anda a 390 px). La píldora del funnel de Offer tocaba la línea de la cabecera: 8 px arriba (app/m/offer/offer.css).

**Lo que se vio y no es nuestro:** al redirigir el server en medio del render (`/general` → `/configurar` con el
onboarding pendiente) la consola registra el error de React #310 dentro del AppRouter de Next; la página llega bien.

**Y el Second Brain del teléfono dibuja el markdown de escritorio** (listas y títulos; antes, sólo negritas):
`<Markdown>` en app/m/mako/ChatMako.tsx, tests/m-mako-markdown.test.ts.

**SIN HACER (con su archivo):**
- Chats: adjuntar archivos y notas de voz, notas internas, asignar, mover de etapa y posponer desde el teléfono
  (escritorio: app/chats/Composer.tsx y VentanaChat.tsx); buscar en el servidor un lead sin mensajes
  (`listarChats({ buscar })`); la página no se vio con chats reales (el ws9 no tiene y el ws1 no se toca): mirarla
  en el ws3 cuando termine el onboarding, con un Instagram conectado.

**Vive en:** app/m/chats/ (`modelo.ts`, `hilo-modelo.ts`, `datos.ts`, `ListaChats.tsx`, `[clave]/`) ·
lib/chats.ts (`paginasWhatsapp`) · lib/movil-rutas.ts (`rutaMovil`, `rutaEscritorio`) · app/m/_ui/cabecera.ts
(`CHAT_DE_CHATS`) · tests/m-chats.test.ts.
*17/10/2026, claude4 (chat «MaKo Mobile»).*

## El Second Brain del teléfono es el chat con MaKo; el Mapa, su propia página (16/10/2026)

Tanda 3 de la etapa 2 (docs/diseno-mako-ai-native.md): como en escritorio, «Second Brain» es el chat con MaKo y el
grafo es su «Mapa».

- **Una ruta, dos filas, y nadie ve las dos.** La fila de Analyze (key `second-brain`, el admin) y la de abajo (key
  `mako`, closer y setter) llevan las dos a `/m/second-brain`, y `gruposMas` saca la de abajo cuando se ve la de
  Analyze. Sin eso el admin tenía dos «Second Brain» en More. El test de «ninguna ruta repetida» nombra esa
  excepción y nada más.
- **El Mapa no podía ser un estado del chat**, por dos razones. `/m/second-brain` es una pantalla de TRABAJO (sin
  barra de abajo), y el mapa no. Además, una página es una cosa para el refrescar (tests/movil-refrescar). Por eso es
  `/m/second-brain/mapa`, con la key `second-brain`. En escritorio sigue siendo `/second-brain?panel=mapa`, y
  `rutaMovil`/`rutaEscritorio` traducen en los dos sentidos.
- **La trampa: un `?area=` de otra pantalla cae en el CHAT.** Los links de `rutaSeccion` no saben del panel, y
  `rutaMovil('/second-brain?area=voz')` da `/m/second-brain?area=voz`. La página lo manda al Mapa sólo si es del
  admin; a un closer le queda el chat, sin el área.
- **El chat entra con la key `mako`, no con `second-brain`.** Con la de la tab, closer y setter se quedaban sin su
  chat del teléfono. Lo prueba el test de esa pantalla, roto así: 73 / 3.
- `/m/mako` redirige a `/m/second-brain`, y `/mako` y `/mako-doer` llevan ahí desde un teléfono.

**SIN HACER:**
- El hilo del teléfono no dibuja las listas de Markdown: los «- » salen como texto. El de escritorio sí las dibuja
  (`app/_chat/HiloMako.tsx`). El teléfono sigue con su pieza (`app/m/mako/ChatMako.tsx`) y todavía no usa la única.

**Vive en:** `lib/movil-rutas.ts` (`SECCIONES_MAS`, `gruposMas`, `rutaMovil`, `rutaEscritorio`) ·
`app/m/second-brain/page.tsx` · `app/m/second-brain/mapa/page.tsx` · `app/m/_ui/cabecera.ts` (`esTrabajo`) ·
tests/movil-mas-secciones.test.ts (las siete roturas)

## Las pantallas de More que faltaban (15/10/2026)

Martín (14/10): «Implementá TODAS las tabs que construimos, todo», con la regla del v3: «en el celular todo se ve
SIMILAR al escritorio, pero con menos texto y menos cosas». Tres tandas en `C:/dev/wt-mobile` (rama `movil-more-9`).
**Tanda 1:** el mapa de More (de 7 a 14 secciones, en el orden de la sidebar), Calendario, Avisos (la campana, ex
Inbox) y Tu cuenta. **Tanda 2** (16/10, más abajo): Second Brain, Experiments y Offer. **Tanda 3** (16/10, más abajo):
Ads Writer (la sección `copywriting`), Curso y Comunidad; con ella las 14 secciones tienen página
(tests/movil-mas-secciones.test.ts 7 / 0).

**El mapa (lib/movil-rutas.ts):**
- **Una sección mapeada sin página es un 404 en todo teléfono, y LAS MISMAS RUTAS no lo ve**:
  tests/movil-mismas-rutas.test.ts recorre las page.tsx que HAY en disco. Lo frena tests/movil-mas-secciones.test.ts
  («TIENE su página»: cada fila exige `app/m/<carpeta>/page.tsx` con `requireMovil({ navKey })` de SU key). Al cerrar la
  tanda 1 falla a propósito nombrando las seis que faltan: el mapa no sale sin ellas.
- **Llevar una ruta al teléfono sin su query la rompe también en la COMPUTADORA**: un Web Push sale por
  `rutaMovilOHome` y vuelve por `conWs` → `rutaEscritorio` (lib/push-payload.ts), así que /experimentos?tab=analisis
  llegaría como Retro. Cada sección declara en `QUERY_DE_SECCION` lo que lee su página de escritorio.
- **El diagnóstico obvio era el equivocado: un test que recorre la tabla que prueba no ve una fila borrada.** Borrar
  'post' de QUERY_DE_SECCION daba el mismo 6/1 que la base. La tabla esperada va escrita a mano en el test.
- **`'copywriting'` no sirve de navKey**: `itemsDe` aplana las tabs unificadas (TODOS_LOS_ITEMS tiene 'ads-writer') y la
  'copywriting' de ADMIN_NAV es /admin/copywriting, así que `puedeVerKey` contesta false para todos. Una tab unificada se
  gatea con la key de la sección que muestra (`video-generator`, `ads-writer`).
- **Sumar una sección a More cambia la barra de otros roles sin tocar la barra**: los huecos se llenan con la primera de
  More, y el admin pm pasó a tener Calendario abajo. Con cada sección nueva se mira `barraMovil` por capa.
- **Un string '/analisis' en lib/movil-rutas.ts hace fallar tests/analisis-mudada.test.ts** («link vivo a una ruta que
  sólo redirige»): una ruta vieja que sólo se reconoce va como regex.
- **`assert.deepEqual` ACHICA el tipo** (es un `asserts`): después de `assert.deepEqual(QUERY_DE_SECCION, {…})`,
  `QUERY_DE_SECCION[s.id]` da TS7053 para las secciones sin query. tsx no chequea tipos: el test pasaba y el tsc no. Se
  lee con una función de módulo tipada con el tipo de la lib (`queryDe`).

**Vive en:** lib/movil-rutas.ts (`SECCIONES_MAS`, `QUERY_DE_SECCION`, `barraMovil`, `tituloSeccion`) ·
tests/movil-mas-secciones.test.ts · tests/movil-desvio.test.ts

**Calendario** (copia de Google Calendar: Día · Agenda, con los rótulos de `VISTAS_CALENDARIO`):
- **Lo flotante va por portal a `#m-pie`, nunca dentro de la página**: PantallaM le pone `transform` a `.m-pantalla`
  mientras se tira para refrescar, y un `position: fixed` adentro se corre con el gesto. `#m-pie` está dentro de
  `.m-shell` y resuelve `--m-abajo`; `#m-root` está FUERA y ahí `--m-abajo` no existe (la copia del arrastre de KanbanM
  sí cuelga de `#m-root`: no lo necesita).
- **Lo que cambia con el estado no va en el título grande**: `<CabeceraM titulo>` lo pisa en un efecto y el HTML del
  server trae el de la ruta; el mes como título parpadearía «Calendario» → «Octubre». El mes va en su fila.
- **La línea de ahora se calcula después de montar** (el server y el teléfono tienen otra hora): `setTimeout` 0 y un
  intervalo de 60 s. Si ahora cae fuera de 8-20, la ventana se estira después de hidratar.
- **En el Día, lo dibujado es más alto que el tiempo**: uno de 15 min con el mínimo de 44 px tapaba al de las 10:30,
  porque `columnasDelDia` de escritorio agrupa con 30 min. Las columnas se cuentan con el fin DIBUJADO (`diaEnGrilla`).

**Vive en:** app/m/calendario/ (`modelo.ts`, `CalendarioM.tsx`) · app/m/_ui/PantallaM.tsx · app/m/_ui/CabeceraM.tsx ·
app/calendario/comun.ts (lo que comparte con escritorio; ver hallazgos-calendario.md)

**Avisos (la campana de General):**
- **Escritorio NO tiene campana ni feed de avisos**: el feed (lib/notificaciones.ts) sólo lo lee el teléfono, y
  escritorio tiene su configuración en /perfil. Los rótulos «de escritorio» salen de quien LEE el dato: /mako/pendientes
  (BandejaPendientes.tsx) y /mako/revisar/[id] (RevisarAccion.tsx). Se busca el lector, no el nombre.
- **Un rótulo escrito dos veces se desvía sin error**: el teléfono decía «Ejecutar la acción» y escritorio «Confirmar y
  ejecutar». Van en constantes (`BOTONES_ESCRITORIO`, `DATOS_ESCRITORIO`) que tests/m-avisos.test.ts cruza contra el
  código de escritorio.
- **El nombre de la pantalla estaba escrito en ocho lugares** (la cabecera, la pestaña, la tarjeta y la campana de
  General, la fila del chat de MaKo, el toast de una tarjeta, el atajo del manifest y LEEME), más tres aserciones de
  tests/movil-shell.test.ts. Pasó a «Avisos»
  (el v3) con UNA constante, `TITULO_INBOX`; el manifest la escribe literal (no importa nada) y tests/movil-shell.test.ts
  la fija. La carpeta y las claves siguen siendo `inbox`.

**Vive en:** app/m/inbox/inbox-ui.ts · lib/movil-rutas.ts (`TITULO_INBOX`) · tests/m-avisos.test.ts

**Tu cuenta** (copia de «Administrar tu cuenta» de Google):
- **Tirar para refrescar no traía nada**: las preferencias de push se copiaban a un `useState` al montar, y el permiso y
  la suscripción se leían en un `useEffect([])`. Las props del server se adoptan cuando cambian; lo del dispositivo se
  relee con la prop en las deps y en `visibilitychange` (al volver de los Ajustes del teléfono), NUNCA con una acción
  en curso: un «apagado» viejo pisaría el «activo» recién llegado.
- **«Instalar la app» desaparecía en Android sin el aviso de Chrome** (`ofertaInstalar` es null sin
  `beforeinstallprompt`). Una sección de Tu cuenta está siempre: sin el aviso, lleva a los pasos del menú del navegador.
- **Lo que se esconde mirando a un cliente y la salida se deciden con la MISMA pregunta** (`salidaDeVista`):
  `leerPerfil().vista.deOtro` y `ctx.impersonando` comparan contra workspaces distintos y podrían separarse (no medido),
  y quedarían Seguridad y Notificaciones escondidas sin «Salir de…».
- **SheetM cierra distinto por GESTO que por código.** Por código saca el `?sheet=` con `replaceState` (lo de «La tanda
  1 del v3» sigue valiendo); por gesto (botón, velo, arrastre) hace un `history.back()` asíncrono, y un
  `router.refresh()` pedido en el mismo tick del `onCerrar` puede quedar pisado. /m/cuenta lo difiere 400 ms (no medido).
- **Un test que fija una línea de import exacta se rompe al sumar un nombre** (tests/ajustes-cuenta-negocio.test.ts:79):
  `seccionesCuenta` y `TITULO_NEGOCIO` se resuelven en page.tsx y viajan como datos.
- **El placeholder de Información personal era un cliente real** (el nombre de Mauricio y su negocio,
  app/perfil/InformacionPersonal.tsx), y el teléfono lo muestra en su hoja. Ahora es inventado.

**Vive en:** app/m/cuenta/ (`CuentaM.tsx`, `cuenta-ui.ts`, `page.tsx`) · app/m/_ui/SheetM.tsx (`soltarPorGesto`)

**SheetM, de la revisión de la tanda 1** (la primitiva: vale para las 18 pantallas con hoja):
- **Una hoja que se cierra sigue en pantalla, y recibía toques.** Síntoma: un doble toque en «Borrar evento» borraba dos
  veces, y el segundo borrado, vacío (`borrarEventoAction` da null si la fila ya no está), decía «Evento borrado» SIN
  Deshacer y reemplazaba al toast bueno: el evento quedaba borrado y sin vuelta atrás. «Guardar evento» podía crear dos
  (crear no es idempotente). **El diagnóstico obvio, una guarda en `borrar` del Calendario, dejaba el hueco en las otras
  17**: SheetM desmonta recién al terminar la salida (220 ms; con «Reducir movimiento», 200 ms de fundido SIN moverse, el
  botón sigue bajo el dedo) y nada apagaba los toques. Además, un toque en el velo durante la salida dejaba `porGesto` en
  true y el próximo cierre por código no sacaba el `?sheet=` (leído en el código, no medido). Regla: cerrándose, el panel y el velo van `inert`; la capa
  NO (sigue tapando la página y se come el toque; si no, caería en la fila de abajo y abriría otra hoja).
- **Una respuesta vacía no pisa un toast con Deshacer**: el toast nuevo reemplaza al anterior (ShellM), así que lo que
  llega tarde sin haber hecho nada no dice nada. «Evento borrado» sale sólo con su Deshacer.
- **Dos actions seguidas desde una hoja no van en cola** (leído en Next 16.2.6 por el verificador, no medido): cerrar por
  código hace `replaceState`, Next lo despacha como ACTION_RESTORE y descarta la action en curso de la cabeza de la cola
  (app-router-instance.js:142-151); la siguiente corre en paralelo, y la descartada igual resuelve. Pueden llegar al
  server en cualquier orden.
- **Un test que lee reglas CSS con `matchAll` no se ancla al `}` de la regla anterior**: matchAll ya lo consumió, la regla
  siguiente no se lee y el test pasaba con la rotura puesta.

**Vive en:** app/m/_ui/SheetM.tsx (`cerrando`) · app/m/calendario/CalendarioM.tsx (`borrar`) ·
tests/m-sheet-cierre.test.ts · tests/m-calendario.test.ts

**Del entorno (sin tsc, sin next dev, sin Chrome):** un bundle de esbuild (`packages: 'external'`, el tsconfig,
`write: false`, css 'empty') caza en segundos un «No matching export» y la sintaxis de una mudanza entre módulos, no los
tipos; los archivos del worktree están en CRLF y el grep de Git Bash esconde el `\r` (se mide con `git ls-files --eol`);
`python3` abre el stub de la Microsoft Store y cuelga hasta el timeout (los scripts van en node).

**Sin hacer (tanda 1):**
- nada se miró en un navegador ni en un teléfono: 390 px, el «+» frente al toast, fecha y hora en iOS, la baldosa de 32 y
  el punto de no leído de Avisos; tampoco que la capa de SheetM se coma el toque mientras sale (iOS < 15.5 ignora
  `inert` y queda como antes);
- el teléfono no marca el paso `cal_agenda` del onboarding (escritorio lo marca en app/calendario/page.tsx);
- cambiar de día dentro del rango leído no cambia la URL: un link copiado abre la fecha con la que se entró;
- un link a /perfil/notificaciones abre Tu cuenta, no su hoja (falta leer la URL o una subpantalla con su fila en
  `rutaMovil` y `rutaEscritorio`);
- la tarjeta de General no abre la decisión directo (`/m/inbox?abrir=<key>` existe; app/m/hoy/page.tsx);
- el toast «Se revisa en Avisos» (`ERRORES_DE_TARJETA`, lib/mako-turno-app-reglas.ts) sale también en la ficha de
  escritorio (MaKo Analyst), donde la campana no existe (antes decía «Inbox», igual de mal).

### Tanda 2 (16/10/2026): Second Brain, Experiments y Offer

**Second Brain** (Obsidian y Notion en el teléfono: la búsqueda arriba, el mapa como foto chica en una isla oscura, las
carpetas de «Tu negocio», el dato como hoja con sus propiedades):
- **Las reglas que el teléfono necesitaba vivían adentro de dos componentes `'use client'`**: el conteo por área, el
  color de cada punto y qué documento se puede ver (app/second-brain/Grafo.tsx), y los tres pasos de la subida
  (app/onboarding/Archivero.tsx). Se mudaron a lib/cerebro-areas.ts y lib/archivero-subida.ts, y en la integración
  escritorio pasó a importarlas: tests/m-second-brain.test.ts falla si cualquiera vuelve a tener su copia (10 / 1).
- **«Ver el documento» no va con el Link de la casa**: es una ruta /api (Next la prefetchearía) y una pestaña nueva no
  pasa por el parche de fetch: el super-admin mirando a un cliente recibía «Archivo no encontrado». Va como `<a>`
  pelado con `conWs(rutaVistaDocumento(id), useWs())`.
- **`data-tema="oscuro"` funciona en cualquier elemento, no sólo en `<html>`**: la isla del mapa sale con el atributo
  en su caja, sin inventar colores. Pero los `--grafo-*` son pastel para fondo oscuro y sobre `--surface` se pierden:
  el punto de cada fila va en una baldosa `--sidebar` (app/globals.css:315).
- **Abrir una hoja desde otra es SÓLO abrir la nueva**: cerrar la primera por código deja una entrada de más en el
  historial (su `replaceState` más el `pushState` de la nueva); `registrarApertura` ya cierra la anterior y le pasa SU
  entrada (app/m/_ui/SheetM.tsx). Leído, no medido.
- **Un nodo `falta:<área>` listado dentro de su área duplica el vacío**: se saca de la hoja del área («Todavía no sé
  nada de esto.») y queda en la búsqueda, donde abre su área (lib/cerebro-grafo.ts:936-950, `datosDelArea`).
- **Un test de ORDEN pasaba sin el sort**: el fixture ya llegaba ordenado por grado. Se arma con datos desordenados.

**Vive en:** app/m/second-brain/ (`modelo.ts`, `SecondBrainM.tsx`, `ArchiveroM.tsx`) · lib/cerebro-areas.ts ·
lib/archivero-subida.ts · tests/m-second-brain.test.ts

**Experiments** (Retro · Experiments · Conclusions · Análisis, en `?tab=` como escritorio; la tarjeta es la de un
ticker de la app de Bolsa de iOS, el plan copia el Triage de Linear y Conclusions el feed de Apple Notes):
- **Un rótulo cruzado con `includes` pasaba con el rótulo equivocado**: «Guardados» está ADENTRO de «Guardados · sin
  arrancar» (el diagnóstico obvio, «el test cruza contra el fuente», era el equivocado). Se cruza ENTERO, delimitado
  por comillas o por `>…<`, aceptando el «+ », «← » o « →» que escritorio le pone. Medido: includes 11 / 0, entero 10 / 1.
- **Sobre una recomendación ACEPTADA el teléfono no ofrece Deshacer**: en el server sólo borra la marca y el
  experimento y sus tareas siguen corriendo (hallazgos-plan.md, «Tres formas de que algo aceptado deje de ser deuda»).
  Escritorio todavía lo ofrece (app/experimentos/RetroReport.tsx:732).
- **Lo que un toast llama después se lee de un `useRef`**: el «Deshacer» guardaba el callback de un render viejo, con
  `ocupado` en null, y /api/retro hace leer-modificar-escribir del reporte entero: dos escrituras seguidas se pisan.
  Leído, no medido (app/m/experimentos/VistaRetroM.tsx, `decidir`).
- **La tab se deriva de `useSearchParams`, nunca de un `useState` copiado de la prop** (a escritorio le pasó el 11/10:
  el «atrás» pintaba otra tab): `replaceState` para las tabs ya bajadas y `router.replace` en una transición sólo para
  Análisis, que calcula el server.
- **Un parámetro de «una sola vez» (`?hipotesis=` del «Probarlo» de Offer) se consume mirando `window.location`**, no
  la prop: al volver «atrás» el router restaura el árbol RSC viejo con la prop puesta y reabría el alta.
- **El sub-estado de una hoja se resetea al ABRIR la próxima, nunca al cerrar**: SheetM sigue dibujando los 220 ms de
  la salida y el cuerpo cambiaba mientras se iba.
- **`SegmentadoM` con cuatro opciones largas corta con «…»**: `.m-seg` reparte partes iguales (app/m/m.css:424).
  Experiments lo pisa en su carpeta con `grid-auto-columns: auto`; al Plan le pasa lo mismo y el shell no se tocó.
- **El formateador se mudó a lib/experimentos-formato.ts**: vivía en app/experimentos/ui.tsx (`'use client'`, con
  recharts); ui.tsx y VistaAnalisis.tsx lo re-exportan.

**Vive en:** app/m/experimentos/ (`ExperimentosM.tsx`, `VistaRetroM.tsx`, `modelo.ts`, `experimentos.css`) ·
lib/experimentos-formato.ts · tests/m-experimentos.test.ts

**Offer** (la app de ChatGPT para iOS: pantalla de trabajo, el camino «Funnel › Oferta» en una píldora, el hilo como el
chat de MaKo):
- **Un composer fijo adentro de PantallaM se corre al tirar para refrescar**: va por portal a `#m-pie` (nunca a
  `#m-root`, sin `--m-abajo`) y el hilo deja su alto medido con ResizeObserver.
- **Refrescar un chat no le cambia la conversación a nadie**: el server abre la MÁS RECIENTE. Si llegó la misma, se
  adopta con `reemplaza`; si llegó otra, se relee la abierta con 'abrir'; con algo en vuelo, nada (`trasRefrescar`).
- **Toda capa a pantalla completa que no es SheetM lleva `data-m-sin-pull`**: con la vista previa de adjuntos abierta,
  tirar hacia abajo refrescaba la página de atrás (PantallaM sólo excluye `.m-sheet-capa` y `[data-m-sin-pull]`). Hoy
  OfferM marca `#m-capas` mientras la vista está abierta. Leído, no medido.
- **Lo de adentro de un SheetM nunca depende de `abierto`**: la hoja sigue en pantalla los 220 ms de la salida y se
  quedaba en blanco.
- **Copiar la orquestación de escritorio destapó un bug de escritorio**: la nota de voz que SÍ se mandó se borraba de
  Storage. Arreglado en los dos lados; detalle en hallazgos-offer.md («Y ese "descartar-subida" borraba también…»).
- **Los grupos de piezas se mudaron a app/offer/ayudas.ts** (vivían en PiezasRail.tsx, `'use client'`). La lista de
  secciones de la oferta nueva sigue copiada (`seccionesDe` es JSX en Conclusion.tsx) y el test cruza las dos.
- Del entorno: `\btocá\b` no encuentra «tocá » (sin la bandera u, la «á» no es letra para `\b`): `(?<!\p{L})…(?!\p{L})`
  con /u. Y `--m-abajo` vive en app/m/m.css, adentro de una regla en la misma línea: un test de tokens que sólo mira
  globals.css o el principio de la línea lo da por inexistente.

**Vive en:** app/m/offer/ (`OfferM.tsx`, `modelo.ts`, `HojasOfferM.tsx`) · app/offer/ayudas.ts · tests/m-offer.test.ts

**De la integración:**
- **El tsc acotado de la rama entera (80 archivos) lo mató el vigía dos veces, con 1,6 y 2,8 GB libres; por partes
  (12, 16 y 13 archivos) corrió en 0**, y con 3,8 GB libres la entera también. Una tanda chica da `toggleEtiqueta does
  not exist on type 'ChainedCommands'` (app/web-generator/editor/insertar.ts:548): es la augmentation de TipTap de
  app/web-generator/editor/extensiones/marcas.ts, que no entra al programa si nada la importa. Se suma ese archivo a
  la lista; no es un error de la rama.
- **origin/main ya tocó lo que esta rama toca**: renombró la `normalizarUrl` de Archivero.tsx a `urlDelLink`
  (607ceb205; por eso esa parte no pasó a `normalizarUrlArchivero`), sumó `notaDelAdjunto` y `AdjuntoVista.archivero`
  (f4ed5e069: el chip de escritorio dice «No quedó en El Archivero», el del teléfono todavía no) y arregló el «acá» de
  VistaAfuera.tsx que deja rojo el guard de voseo en esta base.

**La revisión de la tanda 2 (16/10):**
- **«Mismo gating que escritorio» era cierto porque escritorio tenía el mismo hueco.** Experiments y Second Brain del
  teléfono llaman a las rutas de escritorio (/api/experimentos, /api/retro, /api/second-brain/buscar), y ninguna miraba
  el rol: `requireMovil({ navKey })` y `requireRolWs([])` cierran la PANTALLA, y el proxy sólo pide sesión. Un closer
  las usaba desde la consola. Se cerró en las rutas con `soloAdminDeTab(nav)` (lib/puerta-admin-tab.ts; detalle en
  hallazgos-seguridad.md, que además lo había dado por refutado el 14/10). REGLA: antes de que una pantalla de /m llame
  a una ruta /api de escritorio, se leen las primeras líneas de la ruta; si no mira el rol, el teléfono le suma una
  puerta, y se cierra en la ruta con la nav de la página. Lo fija tests/puerta-admin-tab.test.ts.
- **Copiar el DIBUJO del composer de MaKo trajo su GRABADOR.** ComposerOfferM se calcó de app/m/mako/Composer.tsx,
  que usa `useVoiceRecorder` (entrega el blob al parar): «Enviar audio» mandaba la nota en el mismo toque, sin
  escucharla, y quedaba guardada en la conversación y en el diagnóstico. La excepción del chat de MaKo (viaja la
  transcripción, ver «Chat de MaKo» más abajo) no alcanza a Offer, donde viaja el AUDIO. Ahora graba con
  `useGrabacionVoz`, como escritorio: ✓ termina, se escucha, y recién «Enviar audio» la manda. REGLA: una nota de voz que
  queda como audio (guardada o enviada) usa la sesión `useGrabacionVoz`; `useVoiceRecorder` sólo cuando lo que viaja es
  el texto. Lo fija tests/m-offer.test.ts (R16-R18).

**`varias` de Offer, el mismo día a la tarde:**
- **Un campo nuevo del MENSAJE que cambia cómo se contesta no llega solo al teléfono.** Offer sumó `varias` a
  `OfferMensaje` (las otras ofertas se marcan varias y salen como una respuesta, «A, b y c»); ChatOffer.tsx lo leía y
  HiloOfferM no, así que cada toque mandaba una sola opción. Nada fallaba: el tipo es opcional y el hilo dibujaba las
  opciones bien. La causa es la orquestación escrita dos veces (abajo, «Sin hacer»). REGLA: hasta que exista el hook
  común, un campo nuevo de `OfferMensaje` que lea ChatOffer.tsx u OfferApp.tsx se busca en app/m/offer en el mismo
  trabajo. Ahora `marcable` sale de `opcionesRapidas` (modelo.ts) y lo fija tests/m-offer.test.ts (V1-V8).

**Sin hacer (tanda 2):**
- nada se miró en un navegador ni en un teléfono: 390 px, la isla oscura, el segmentado de cuatro, el «atrás» con
  `?retro=` y `?sheet=`, la franja de Offer con el teclado de iOS, el PDF y la nota de voz en una PWA de iOS, el
  selector de archivos con la cámara;
- Offer: la orquestación de OfferApp está escrita dos veces (falta un hook común: app/offer/OfferApp.tsx:280-706 →
  app/offer/useChatOffer.ts); `seccionesDe` (app/offer/Conclusion.tsx:402-541) sigue en JSX; la capa de adjuntos
  (app/m/mako/VistaAdjuntosM.tsx, `altoTeclado`, `duracion`, IconoChat) y la barra del composer (app/m/mako/Composer.tsx
  y app/m/offer/ComposerOfferM.tsx) las usan dos pantallas y van a app/m/_ui; app/m/offer/page.tsx importa
  '../mako/mako.css' sólo por esa capa; el chip del teléfono no muestra `notaDelAdjunto` (llega con el rebase);
- Experiments: el «Deshacer» sobre una aceptada en escritorio (RetroReport.tsx:732); columnas `auto` como default de `.m-seg`;
- Second Brain: Archivero.tsx conserva su normalización del link (`urlDelLink` en main); `?vista=` no viaja del
  teléfono a la computadora; en el teléfono no están las preguntas del Archivero, borrar un documento ni la carga a mano;
- ~~la tanda 3 (Copywriting, Curso y Comunidad)~~: hecha el 16/10, abajo; tests/movil-mas-secciones.test.ts pasa 7 / 0.

### Tanda 3 (16/10/2026): Ads Writer, Curso y Comunidad

**Ads Writer** (la sección `copywriting`, en /ads-writer: Anuncios · Guiones · Analizar guion en `?tab=`; Anuncios copia
una lista agrupada de Linear, Guiones la cita de Readwise, Analizar guion el campo de Grammarly):
- **El pedido decía «pedir un copy dictando o escribiendo», y el diagnóstico obvio (un campo libre que manda la `nota`
  que /api/onboarding/razones acepta) era el equivocado**: escritorio lo prohíbe a propósito («acá NUNCA hay un campo de
  texto abierto (pedido explícito)», app/onboarding/MatrizView.tsx:20 y :479). Que la ruta acepte un campo no quiere
  decir que la pantalla lo ofrezca. REGLA: antes de sumar en /m un campo que escritorio no tiene, se busca «pedido
  explícito» en los comentarios de la tab. El dictado fue al único campo de escritorio, el guion a valorar; el test
  falla si api.ts manda `nota`.
- **La matriz caída se dibujaría como «Todavía no hay anuncios»**: `getRazones` lee con `getSetting`, que convierte un
  error de Supabase en null y null en [] (lib/razones.ts:107). Una pantalla de /m que lee un JSON de app_settings usa el
  lector ESTRICTO (`getRazonesEstricto`, lib/api-mako/areas/contenido.helpers.ts) y muestra ErrorM.
- **«Copiar» decía «Copiado» sin copiar**: `navigator.clipboard.writeText` rechaza (permiso, contexto) y un catch que se
  lo traga miente. `copiarTexto` (app/m/copywriting/api.ts) devuelve si copió, cae a `execCommand('copy')` y el toast
  dice «No se pudo copiar». Se prueba con un `navigator` falso en node.
- **«Escribir el próximo guion» elige recorriendo los AVATARES en su orden, no el array de celdas** (la celda de un avatar
  borrado cuenta al final; `proximaCeldaDe`, app/ads-writer/reglas.ts). Un fixture ordenado dejaba pasar la regla rota:
  el del test pone primero la celda del segundo avatar.
- **«Se adopta lo del server salvo con algo en vuelo» tiene una segunda mitad: si lo que estaba en vuelo FALLA, lo que
  llegó en el medio se adopta.** Con un guion escribiéndose (60-120 s), la copia del server (tirar para refrescar, o el
  refresco solo de ShellM al volver la red o al volver al frente tras 60 s) se guardaba aparte; si la escritura salía
  `ok: false`, la pantalla se quedaba con la foto de antes y esa copia no volvía hasta el próximo cambio de props. Si el
  server ya había guardado el guion (se cortó en `estado()` o se perdió la respuesta), la celda seguía en «Que MaKo lo
  escriba», `proximaCeldaDe` la elegía otra vez y el próximo toque pagaba IA por un segundo guion en el mismo anuncio.
  **El arreglo obvio (al fallar, poner la última del server) era el equivocado**: sin un refresco en el medio, la de
  pantalla es MÁS nueva que la del server (la devolvió la escritura anterior) y volver a la del server borraba de la
  pantalla el guion recién escrito, con el mismo IA pagado de nuevo. REGLA: la copia del server se toma en un ref ANTES
  del await y se relee DESPUÉS; si cambió (por identidad), se adopta; si no, se deja la de pantalla (`matrizSiFalla`,
  app/m/copywriting/modelo.ts). El ref se escribe en el mismo bloque que guarda la copia, porque el render que arrancó
  la escritura no ve lo que llega en sus 60-120 s. Sin DOM en los tests: la decisión es pura y el cableado se fija leyendo
  el fuente (13/1 con cada una de las cinco roturas).
- **El prototipo v3 dibuja «Guiones · Anuncios»; manda escritorio**: `VISTAS` sale de `VISTAS_ADS_WRITER` y el test
  cruza los `{ k, label }` de AdsWriterApp.tsx.
- Lo que el teléfono necesitaba vivía inline en cinco lugares `'use client'` (la cobertura y el próximo guion en
  useMemos de AdsWriterApp.tsx, el orden de GuionesGlobal.tsx, el parser del gancho de SeccionCard.tsx, el día y el
  extracto de AnalizarGuion.tsx). Se mudaron a app/ads-writer/reglas.ts, lib/guion-secciones.ts y
  app/ads-writer/analizar.ts, y escritorio los importa o re-exporta (los 8 importadores de SeccionCard no cambian).

**Vive en:** app/m/copywriting/ (`modelo.ts`, `api.ts`, `AnalizarM.tsx`) · app/ads-writer/reglas.ts ·
lib/guion-secciones.ts · app/ads-writer/analizar.ts · tests/m-copywriting.test.ts

**Curso** (el Classroom de Skool en su app: el curso arriba, cada módulo con su conteo, cada clase con su duración y lo
cerrado marcado; la hoja de una clase copia un ítem de Ajustes de iPhone):
- **El pedido decía «el avance de los alumnos», y copiar la tabla Avance a Curso volvía a meter lo que Martín sacó el
  07/10** («Elimina la tab de Avance de clientes en este lugar, solo se va a editar el curso»; la tabla por cliente vive
  en Clientes › Avance, app/customer-success/page.tsx). En el teléfono el avance va POR CLASE, en su hoja y con las
  reglas del portal (`claseCompleta`, `PCT_VISTO`): «Terminada: 3 de 8», «Visto: 5 de 8». REGLA: antes de sumar una
  vista que nombra el pedido, se mira si escritorio la tuvo y la sacó (app/customer-success/curso/page.tsx:52-60).
- **Un rótulo «de escritorio» que no está escrito ENTERO en escritorio va a la tabla de lo propio del teléfono** (T, no
  R): «Avance» es un nombre de comentario, y el rótulo real es «Ver el avance del curso» (app/_ui/iconos-vista.tsx:65).
  Lo encontró el test que cruza cada rótulo entero contra su fuente (el de la tanda 2).
- **tsx pasa y tsc fallaría con filas armadas con constantes `as const`**: `[{ k: T.terminada, v }]` infiere
  `k: 'Terminada'`, y el `push({ k: R.visto })` que sigue es TS2322. Un array que se arma y se extiende se anota
  (`{ k: string; v: string }[]`; `filasAvance`, app/m/curso/modelo.ts).
- **Desde /m, `replaceState` escribe sobre la ruta de ESCRITORIO**: por LAS MISMAS RUTAS la barra dice
  /customer-success/curso. Se parte de `new URL(window.location.href)` y se toca sólo la query (`elegirCurso`,
  app/m/curso/CursoM.tsx); un «/m/curso?…» escrito a mano deja en la barra una URL /m que el desvío redirige.

**Vive en:** app/m/curso/ (`modelo.ts`, `datos.ts`, `CursoM.tsx`) · `guardarBloqueoAction`
(app/customer-success/curso/modulos-actions.ts, la misma de escritorio) · tests/m-curso.test.ts

**Comunidad** (la app de Skool para iPhone: Comunidad · Miembros · Ranking, que son las `PESTANAS` de
app/_comunidad/Comunidad.tsx; el post en una hoja alta con «Escribe un comentario» pegado al pie, como un chat):
- **Un `<Ico n>` de la comunidad con un nombre que no existe dibuja un SVG VACÍO**, no el punto de `Icon`: nadie lo ve.
  Los íconos que faltan en icons.tsx (pulgar, globo, chinche) vivían en app/_comunidad/piezas.tsx (`'use client'`, con
  el menú y la pila de modales); se mudaron a app/_comunidad/iconos.tsx, sin directiva y con `NOMBRES_ICO`, piezas.tsx
  los re-exporta, y el test cruza cada `<Ico n=…>` del teléfono contra la lista.
- **Consumir un parámetro de una sola vez se lleva lo que el server deducía de él**: sin `?producto=`, el server saca el
  producto del `?post=`; al consumir `post` (como el `?hipotesis=` de Experiments), refrescar abría el PRIMER producto.
  REGLA: al consumirlo se escribe en la URL lo deducido (acá, `producto`).
- **El contador que vuelve a montar una hoja limpia al ABRIRLA es POR HOJA**: con una sola llave `vez` para todas, abrir
  el perfil desde Buscar volvía a montar Buscar, todavía abierta, y empujaba una entrada de más al historial
  (app/m/comunidad/ComunidadM.tsx; el test da 11/1 con `key={vez.post}` en el perfil). Leído en SheetM, no medido.
- **Un guard de voseo por lista sólo ve las formas que nombra**: «Cerrá sin publicar» pasaba el de la carpeta (12/0)
  porque «cerrá» no estaba. Cada pantalla suma los imperativos de SUS rótulos (cerrá, votá, publicá, comentá…).
- **Que el teléfono tenga el mismo permiso que escritorio no prueba que el permiso sea correcto**: la página de
  escritorio pide sólo la capa (`requireCapa`), y `actorDelEquipo` deja pasar a cualquier rol del workspace, mientras la
  sidebar la muestra sólo al admin. ABIERTO, lo decide Martín (hallazgos-seguridad.md, «La Comunidad del equipo»).

**Vive en:** app/m/comunidad/ (`ComunidadM.tsx`, `modelo.ts`, `datos.ts`) · app/_comunidad/iconos.tsx ·
tests/m-comunidad.test.ts

**SheetM y el router en el mismo tick** (salió en dos de las tres; leído en Next 16.2.6, no medido): Next despacha un
`pushState` o un `replaceState` como restore, y puede descartar lo que tiene en la cola. Ads Writer difiere 400 ms el
`router.refresh()` después de abrir la hoja de la valoración (como /m/cuenta), y Comunidad, al cambiar de producto con
la hoja «Producto» abierta, no la cierra: la deja desmontarse con la página nueva (la llave `productoId` en page.tsx).
⚠️ Contradice lo de «La tanda 1 del v3» («cerrar la hoja por código y navegar en el mismo tick es seguro»): hasta
medirlo, el refresh se difiere y la hoja se deja desmontar.

**De la integración:**
- **Un guard que ya falla en la base esconde la falla nueva**: `puente-panel-copy` daba 8/1 en la base (VistaAfuera.tsx:201,
  ya arreglado en main) y siguió en 8/1 con un `const aca` de app/m/copywriting/HojasM.tsx, que el detector lee como
  «acá». El conteo no cambia; la LISTA sí. Con un guard rojo de antes, se lee la lista, no el número. La variable pasó a
  `escribeEsta`; lo vio la Comunidad leyendo la lista.
- **El tsc acotado de la rama entera (143 archivos, con los importadores de lo mudado) lo mató el vigía con 3,3 GB
  libres; por partes (23, 30, 18, 34, 22 y 21 archivos) dio 0.** La parte de Ads Writer vuelve a traer el
  `toggleEtiqueta` de la tanda 2 si la lista no lleva app/web-generator/editor/extensiones/marcas.ts.

**Sin hacer (tanda 3):**
- nada se miró en un navegador ni en un teléfono: 390 px, los segmentados de tres (en Comunidad, con el título grande
  encima), el pie fijo de Ads Writer frente al toast, el dictado en una PWA de iOS (sin SpeechRecognition cae a grabar y
  transcribir con /api/plan-dictado), copiar en iOS, la hoja de una clase mientras guarda, el «atrás» con `?sheet=` y
  `?producto=`, y el campo de comentar con el teclado de iOS (el `dvh` no se achica);
- Ads Writer: Elegir con MaKo, editar, borrar, bajar el .md y cambiar el estado de un guion (app/onboarding/MatrizView.tsx,
  app/ads-writer/GuionLector.tsx); búsqueda y filtros de la galería (GuionesGlobal.tsx); la línea de cobertura del
  PageHeader; los bloques, patrones, plan y ángulo saturado de la valoración (ValoracionGuion.tsx); armar la matriz y
  el asistente del onboarding;
- Curso: el acceso de un MÓDULO, las condiciones de Privado (el teléfono guarda `privadoInicial`; el resto, en
  app/customer-success/curso/MenuCurso.tsx), «Obligatoria» y «Comentarios», Invitar (InvitarAlumnos.tsx); después de
  elegir otro curso, el «atrás» vuelve al anterior antes de salir (la entrada que empuja SheetM queda con el producto
  viejo; no medido). `SegmentadoM` no tiene `deshabilitado` (app/m/_ui/ControlesM.tsx:34): el Curso frena el toque en el
  handler, pero el control no se apaga mientras guarda;
- Comunidad: elegir el orden del feed (app/_comunidad/Feed.tsx); publicar con video, encuesta, archivo o @menciones;
  editar o borrar un comentario y «Seguir» un post (PostAbierto.tsx); la miniatura de YouTube (`tapaDeVideo` vive en
  Feed.tsx, `'use client'`) y «Miembro desde» (una const de Miembros.tsx): hay que mudarlas a un módulo puro;
- ninguna de las dos anota su onboarding (`sincronizarOnboardingCurso`, app/customer-success/curso/page.tsx:117;
  `sincronizarOnboardingComunidad`, app/customer-success/comunidad/onboarding-sync.ts), como el Calendario de la tanda 1;
- Ads Writer, el mismo hueco del otro lado (leído, no medido): un refresco que el server armó ANTES de guardar el guion
  y que llega DESPUÉS de la respuesta de la escritura encuentra `escribiendo == null` y pisa la matriz con la copia vieja
  (app/m/copywriting/CopywritingM.tsx, el bloque que adopta las props). La ventana son los 1-3 s del refresco alrededor
  del guardado. Offer tiene la misma forma: con algo en vuelo `trasRefrescar` dice «nada» (app/m/offer/OfferM.tsx:228),
  y si eso falla nadie relee lo que llegó; falta mirar si su rama de error ya vuelve a abrir la sesión;
- copiar al portapapeles está escrito en tres pantallas: Ads Writer con la salida vieja, y app/m/landing/[id]/AccionesLandingM.tsx
  y app/m/crm/[id]/FichaLead.tsx sin ella (la ficha no dice nada si no hay `navigator.clipboard`). Va a app/m/_ui.

## Refrescar en TODAS las pantallas: el gesto era opt-in (15/10/2026)

Martín: «En el centro y otras tabs no está la funcionalidad de refrescar, eso debe estar presente en
tooodos lados en mobile». Tiró varias veces en el Centro de Operaciones esperando ver algo nuevo.

**Causa:** el pull-to-refresh vivía en PantallaM detrás de `refrescable` (apagado por defecto). Lo
pedían las pantallas que existían el día que se escribió; el Centro se construyó el 15/10 y nació sin él,
sin que nadie se equivocara. Además, 7 páginas ni siquiera montaban PantallaM: el Centro, la Ticketera
(mazo y lista), Video, el detalle de un video, el de una landing y Configurar.

**El diagnóstico obvio era incompleto:** «faltaba en el Centro» era cierto. Al recorrer las 26 páginas
aparecieron 11 returns más sin PantallaM en páginas que SÍ refrescaban, todos en el vacío o el error
(«No pude leer…», «Meta no contestó»: Ads, Automations, Landing, la ficha del lead y su chat). Es
justo donde refrescar más sirve, y donde no estaba.

**La otra mitad: refrescar tiene que TRAER lo nuevo.** `router.refresh()` vuelve a correr el server
component y pasa props nuevas, pero el mazo de la Ticketera copia sus decisiones a un `useState` al
montarse, a propósito (rearmar la cola con cada revalidación haría volver una «después»). Con eso, el
gesto animaba y no traía nada. Ahora suma al final lo que nunca pasó por el mazo (`nuevasParaElMazo`,
app/tickets/decisiones/reglas.ts). Medido con toques reales por CDP sobre la PantallaM y el mazo reales:
de «2 por decidir» a «3», con la tarjeta de adelante intacta.

**La regla que queda:** el refresco viene PRENDIDO; `refrescable={false}` sólo donde tirar hacia abajo
es otra cosa, y con su motivo. tests/movil-refrescar.test.ts recorre las páginas de app/m y falla si
alguna devuelve sin PantallaM (sigue a un componente del mismo archivo, como `GeneralPagina` de Today)
o la apaga sin anotar. Excepciones: `/m` (sólo redirige) y el chat de MaKo.

**Sin medir:** un teléfono de verdad; ahí el gesto compite con el pull-to-refresh del navegador
(app/m/m.css lo apaga con `overscroll-behavior`), y eso Chrome emulado no lo reproduce.

**Vive en:** `app/m/_ui/PantallaM.tsx` · las `page.tsx` de app/m · `app/tickets/decisiones/Mazo.tsx` ·
`app/tickets/decisiones/reglas.ts` · `tests/movil-refrescar.test.ts`

## Arrastrar una tarjeta con el dedo, y el toque del iPad (15/10/2026)

Las seis decisiones de MaKo Mobile y del iPad que estaban en la Ticketera las retiró el orquestador
(«Usa criterio hay cosas muy obvias»): cuatro ya estaban contestadas por lo escrito y hechas en el código
(el CRM abre en el Tablero; una columna por pantalla con la siguiente asomando, como Trello; el iPad recibe
la computadora adaptada). Faltaban dos, copiadas de Trello y de la regla de AGENTS.md:

- **Mover una tarjeta se copia de Trello:** se ARRASTRA con el dedo, y además hay «Mover a…» (mantener y
  soltar sin mover). Notion hace lo mismo (arrastrar, o cambiar el estado).
- **El iPad horizontal no tenía la escala táctil.** El `@media (max-width: 820px)` cubría un iPad parado
  hasta 820 px; uno acostado (1024-1366) quedaba con 40 px de toque y campos de 14 px, y iOS hace zoom al
  enfocar un campo de menos de 16. Va un `@media (pointer: coarse)` aparte que sube sólo el toque y la letra
  chica: los títulos del teléfono (26 en vez de 30) son de una pantalla ANGOSTA, no de una táctil.

**La trampa del arrastre: sin frenar el scroll, el navegador se queda con el gesto.** Después de mantener
presionado, el primer movimiento del dedo arranca el scroll de la columna y el navegador corta el puntero con
`pointercancel`: la tarjeta se levanta y no se mueve. Lo frena un `touchmove` NO pasivo en la pista que hace
`preventDefault` sólo con la tarjeta levantada (antes, el dedo scrollea como siempre). Y como ese
`preventDefault` corre en la pista, el `touchmove` pasivo de PantallaM (el pull-to-refresh, en `document`) lo
ve con `defaultPrevented` y no tira.

- **Con el dedo QUIETO en el borde no llegan `pointermove`:** pasar de columna lo da un reloj (120 ms), y el
  `onScroll` de la pista vuelve a calcular la columna de abajo (la pista se corre bajo un dedo quieto).
- **La copia que sigue al dedo cuelga de `#m-root`**, que lleva los tokens (`[data-m]`) y no tiene transform:
  un `position: fixed` adentro de un nodo con transform se ubica contra ese nodo.

**Cómo se verificó, sin `next dev` y sin tocar la base:** un banco con esbuild que monta el KanbanM REAL
(con el `Link` de la casa cambiado por un `<a>`, que el de verdad usa el router de Next) y el CSS de la casa
sin Tailwind, en Chrome sin ventana con toques de `Input.dispatchTouchEvent` (`mobile: true` +
`setTouchEmulationEnabled`). Playwright no sirve para esto: su `touchscreen` sólo toca, no arrastra. Medido:
toque abre, deslizar rápido scrollea, mantener y soltar abre «Mover a…», arrastrar al borde pasa de columna
(0 → 320 px) y al soltar mueve, y sobre una columna a la que no puede ir no mueve.

**Sin medir:** Safari de iOS y un iPad de verdad; el pull-to-refresh durante un arrastre (el banco no monta
PantallaM); un iPad con trackpad, que puede reportar `pointer: fine` y quedarse con la escala de escritorio.

**Vive en:** `app/m/_ui/KanbanM.tsx` · `app/m/_ui/PantallaM.tsx` · `app/m/m.css` (`.m-kb-tj--fantasma`,
`[data-arrastrada]`, `.m-kb__col[data-destino]`) · `app/globals.css` (`@media (pointer: coarse)`) ·
`tests/movil-shell.test.ts`

## «Tarda muchísimo»: lo que se midió y lo que se arregló (14/10/2026, noche)

Martín: «entrar al CRM toma ~10 segundos, y así con cada cosa». Se midió antes de tocar, con 4 agentes (sólo
lectura): los request-logs de Vercel, los edge_logs de Supabase, consultas reales a la base y el JS de producción.

- **Los 10 s del CRM eran reales, y la causa no era la obvia.** Mediana de 8,2 s de función (7,3-12,0; n=5), y
  no por el JS ni por los leads: el «Por responder» de la lista v2 barría el espejo de WhatsApp ENTERO en cada
  apertura (`getConversacionesNoOficial`): 19 páginas de wa_mensajes EN SERIE más 6 de contactos, 5,5-7,8 s. El
  tablero ya no lo lee: 1,8-3,3 s (n=3). **Chats heredó la misma lectura**: ahora va acotada (3 páginas, sin la
  agenda; `opts` en lib/evolution-mensajes.ts) y con el nombre de los 40 leads que se dibujan, no la cartera entera.
- **El JS NO explica una navegación lenta**: ir al CRM baja ~14 KB gzip y el JS común compila en 25 ms (PC). Sí pesa
  en la apertura en frío: 1,3 MB crudos / 397 KB gzip en toda página, y se vuelven a bajar en cada deploy (`?dpl=`).
- **Lo que se siente lento sin ser servidor:**
  - sólo Plan tenía `loading.tsx`. Al tocar una pestaña, la pantalla anterior quedaba congelada sin señal (Martín
    tocó el CRM 3 veces en 10 s y triplicó la carga). Ahora hay esqueletos en General, CRM, ficha, chat, Chats, More,
    Inbox y Clientes (`SkeletonTablero`, `SkeletonTarjetas`);
  - después de una action que ya revalida, el cliente hacía otro `router.refresh()`: dos renders completos en serie;
  - el conteo del Inbox corría dos veces por render en General (ahora `cache()` por pedido, con rol y capa SUELTOS:
    `cache` compara los argumentos por identidad y un objeto nuevo nunca acierta);
  - el filtro «Sin responder» de Chats iba al servidor (ahora filtra en el cliente).
- **«Deslizo y no pasa nada»**: el pull-to-refresh escuchaba sólo dentro del div de la página. El título grande (lo
  dibuja el shell) y el vacío debajo de una lista corta no respondían. Ahora escucha en el documento. Se lo quedan
  los sheets y cualquier contenedor con overflow que ya bajó (no una marca: se sube por los ancestros).
- **La Sidebar de escritorio al abrir la app (el diagnóstico obvio era otro).** No era la detección del teléfono
  (proxy y layout usan la misma `vaAMovil`). Los request-logs mostraron `GET /inicio 200` y recién después
  `GET /general` (2,5-3,8 s). /inicio, el `start_url` y el destino de cada login, se dibujaba con el layout de
  escritorio, porque para el desvío es «nada», y su `redirect()` llegaba como redirect de CLIENTE. Arreglado de raíz:
  - el proxy manda /inicio a /general en un teléfono (307 en el borde, `pedidoMovil`);
  - en un teléfono `HideOnPublicLanding` no dibuja el cromo NUNCA (`useTelefono`).

**Lo que quedó sin hacer (pide una decisión que no es de esta área; la llevó el orquestador al tablero):**
- funciones en iad1 y base en us-west-2: 97 ms medidos por consulta en serie (en pdx1, ~5-10 ms);
- el arranque de cada instancia: instrumentation.ts tarda 1,3-2,7 s, con 51/114 TimeoutError;
- 28 deploys por día: Martín casi siempre ve el primer toque, el lento;
- las constantes de lib/auth-session.ts, que meten 450 KB de polyfills de `node:crypto` en toda página;
- `staleTimes.dynamic`.

Y de esta área, sin hacer:
- General todavía arma TODOS los bloques y lee el tablero del Plan 3 veces (~8 MB por render en ws9);
- el CRM baja los leads con 47 columnas.

## La tanda 1 del v3 en código: barra, General, Chats y los tableros (14/10/2026, noche)

Tres pushes: 104a26209 (barra, General de portada, More por familias, Chats), 5e4bed65d (KanbanM, el CRM y Clientes
como tablero) y c2f6863a0 (el Plan con las cuatro vistas de escritorio).

- **Un worktree con un push esperando NO se toca.** El pre-push corre `tsc` sobre el árbol ENTERO del worktree,
  archivos sin commitear incluidos. Si se empieza la tanda siguiente en el mismo worktree mientras otro chat pushea
  desde ahí, el código a medio hacer entra al typecheck del push ajeno. Se sigue en otro worktree. El que quedó
  pusheado se reusa con `git switch -c <rama> <la última>`.
- **El push con `MAKO_TYPECHECK_SIN_ESPERA=1` igual lo mata el vigía** cuando la RAM libre baja de ~750 MB a mitad del
  tsc (pasó dos veces, con 3,1 y 4,3 GB libres al arrancar). El hook lo dice bien: «NO son errores de tipos». Lo
  destraba quien puede pausar el vigía (el orquestador, `push_<letra>.sh`). No se corre `tsc` a mano para diagnosticar.
- **Los tests NO son vitest.** `npx vitest run` falla en el worktree con «Cannot find package '@/lib/…'». Parece un
  alias roto por el junction de node_modules, y no lo es: el repo corre `node --import tsx --test tests/x.test.ts`
  (`npm test`).
- **FilaM con `href` IGNORA `onClick`.** Una fila de un sheet que tiene que cerrar el sheet Y navegar (el selector de
  funnel del CRM) va con `onClick` + `router.push` (el de `@/app/_ui/Link`, que conserva el cliente). Cerrar la hoja
  por código y navegar en el mismo tick es seguro: SheetM saca su `?sheet=` con `replaceState`, no con `back()`.
  ⚠️ (16/10) Puesto en duda: la revisión de la tanda 1 de More y la Comunidad leyeron que Next despacha ese
  `replaceState` como restore y puede descartar lo que tiene en la cola. No medido; ver «Tanda 3», «SheetM y el router».
- **El pull-to-refresh se robaba el gesto de las columnas.** PantallaM arranca si `window.scrollY === 0`, y con un
  tablero eso es casi siempre: tirar hacia abajo dentro de una columna scrolleada subía la lista Y refrescaba la página.
  Ahora un scroll anidado con `data-m-scroll` que no está arriba de todo se queda con el gesto (app/m/_ui/PantallaM.tsx).
- **Lo optimista de KanbanM se limpia por la FIRMA de las tarjetas (id:columna), no por la identidad del array.**
  Con la identidad, una pantalla que arma las tarjetas en cada render (todas) hacía rebotar la tarjeta recién movida.
- **Las reglas del Plan atrapadas en un `'use client'`**: `projProgress` vive en app/plan/board/piezas.tsx, que es
  `'use client'`. Importada desde el server llega como referencia de cliente, no como función. Se copió en
  app/m/plan/tableros.ts (`avanceProyecto`) y el test fija los dos casos (la familia de «las reglas atrapadas en
  módulos `'use client'`», arriba).
- **Proyectos en escritorio NO es un kanban**: es una grilla de tarjetas (`ProyectosView`). El teléfono los agrupa por
  los cuatro escalones de prioridad porque así quedó en el prototipo v3 que aprobó Martín.

**Lo que encontró la verificación de mover y deshacer** (3 agentes, sólo lectura, después del push; arreglado en el
commit siguiente):
- **El Deshacer del teléfono BORRABA LA VENTA.** Mover a un lead FUERA de Ganado borra el monto, el motivo y la fecha
  de cierre (lib/lead-desenlace.ts). El Deshacer vuelve la etapa pero no esos datos: un Ganado de US$4.200 movido y
  deshecho quedaba Ganado sin monto, y Revenue perdía la venta. Salir de «Nutrición - Manual» borra su plazo igual.
  La regla del teléfono miraba sólo el DESTINO. Ahora también el ORIGEN: `seSacaEnElTelefono` (app/m/crm/reglas.ts)
  no deja sacar a un lead de un desenlace, de un cobro ni de manual. La usan el tablero, la ficha y el server.
- **Deshacer a la etapa CRUDA escribía una que el funnel no tiene.** Un lead dibujado por fallback (su etapa ya no
  está en el funnel) volvía a `pipeline_stage` con la etapa vieja, y en escritorio pasaba a «fuera del funnel». Y la
  de un agregado huérfano hacía fallar el Deshacer siempre. Ahora `antes` es la columna DIBUJADA (`etapaEnTablero`),
  como hace CrmBoard. Y la columna de cada lead se cuenta con las etapas en el orden del FUNNEL, no en el de las
  columnas, porque la «primera» del fallback es la del funnel.
- **El timer de 220 ms de KanbanM resucitaba un mover fallido.** Sin red, la action rechaza en el acto: la tarjeta
  volvía y 220 ms después el timer la ponía en el destino. Un refresh no lo corregía: trae la misma firma y no limpia
  nada. Ahora el timer se cancela al fallar, y una tarjeta con un mover o un deshacer en vuelo no se vuelve a mover.
- **El Deshacer de Clientes reponía lo que CREÍA el teléfono.** Si MaKo (el curso) u otra persona había movido al
  cliente, deshacer borraba ese avance y le ponía un reloj viejo. El server ya devuelve de dónde venía (`r.desde`).
  Ahora el Deshacer se ofrece sólo si coincide con la pantalla, y nunca desde una etapa borrada. Con
  `cambio: false` se pide `router.refresh()` en vez de pintar un reloj inventado.
- **El diagnóstico obvio era el equivocado:** el comentario de CustomerSuccessM decía que la action «revalida
  /customer-success, no esta ruta». Es falso: `revalidatePath` revalida la respuesta entera (ver hallazgos-infra), así
  que /m/cs vuelve fresca después de cada movimiento que cambió algo. Sólo `cambio: false` la dejaba vieja.

**Lo que quedó sin hacer** (esta tanda):
- **More tiene sólo las secciones que ya existían** (Ads, Dashboard, Landing, Automations, Video, Clientes, MaKo).
  Las otras 9 pantallas del prototipo v3 (Calendario, Second Brain, Experiments, Offer, Copywriting, Curso, Comunidad,
  Avisos, Perfil nuevo) siguen sin código. Se agregan en `SECCIONES_MAS` (lib/movil-rutas.ts), cada una con su página.
  (15/10/2026: en curso, ver «Las pantallas de More que faltaban», arriba.)
- **Chats lee sólo WhatsApp** (app/m/chats/datos.ts). Los chats unificados siguen SIN COMMITEAR en `C:/dev/wt-chats`.
  Cuando lleguen a main, cambia la lectura de `listaChats` y se suman las bandejas del prototipo. Las conversaciones
  sin lead se cuentan pero no se abren: el hilo del teléfono es el del lead.
- **En el teléfono no se cambia la prioridad del Plan**: es la audiencia con el Perro, y los tableros de Tareas y
  Proyectos no mueven tarjetas. Para que muevan, `moverA`/`onMover` en app/m/plan/ListaPlan.tsx contra
  `prioridadManual`, sólo en el tablero del dueño.
- **Nada de esto se miró en un teléfono de verdad** (con 7+ chats no había RAM para `next dev`). El CSS de KanbanM sale
  del prototipo, que sí se miró a 390 px. Pendiente: el alto de la pista (`100dvh − 64px`) con el segmentado de
  Clientes o del Plan arriba, que hace scrollear un poco el documento.

## El prototipo v3 y el relevamiento de las tiendas (14/10/2026, tarde)

- **El v1 se rechazó por REINVENTAR, no por feo.** Martín: el CRM no lleva «Hoy» (ya está el Plan), el Plan no se
  cambia (sus vistas son Prioridades · Tareas · Proyectos · Recurrentes), More tiene que seguir las familias de la
  sidebar, faltaba la tab Chats, General va al medio de la barra y como la que abre, y TODO tenía demasiado texto. La
  regla quedó en AGENTS.md (sección MaKo Mobile). Lo que la hizo posible en el v3: relevar CADA tab de escritorio con
  sus rótulos reales antes de dibujar (tres lectores en paralelo, ~10 min) en vez de diseñar desde el v2.
- **«Hay una rama `chats-1410`» no quería decir que hubiera trabajo en ella.** La rama tiene CERO commits propios (sale
  de origin/main y `git diff origin/main...chats-1410` es vacío). La bandeja Chats (copia de respond.io) existe SIN
  COMMITEAR en el worktree `C:/dev/wt-chats`: ~55 archivos (app/chats, app/api/chats, lib/chats*, migración 0275,
  docs/diseno-chats.md). El relevo general decía «sin trabajo nuevo sobre origin», cierto en commits y ciego al disco.
  El teléfono sigue ese diseño (bandejas Todos · Míos · Sin asignar · MaKo · Canales, un contacto con todos sus
  canales). **Vive en:** C:/dev/wt-chats/docs/diseno-chats.md.
- **Pinterest y Dribbble no se leen sin navegador.** WebFetch devuelve «Instagram»/nada; curl a Dribbble, 0 bytes. Una
  búsqueda de Pinterest SÍ se ve en Chrome headless (los pins quedan detrás de un cartel de login, pero se leen los
  patrones). Las referencias de apps (Pipedrive, HubSpot, Kommo, Beeper, Stripe, Shopify) salen de su documentación.
- **Publicar en las tiendas, lo que frena aunque hoy no dé error** (relevado con fuentes oficiales, sin código):
  - el proxy manda a `/login` todo lo que no está en `PUBLICOS`, así que `/.well-known/assetlinks.json` (Android) y
    `apple-app-site-association` (iOS) no se sirven: la TWA abre con la barra del navegador y iOS no verifica el dominio
    (ver hallazgos-infra.md);
  - Google bloquea su login dentro de un WKWebView (`disallowed_useragent`) y en MaKo es la ÚNICA forma de entrar: en
    iOS el login va por el navegador del sistema (ASWebAuthenticationSession) con traspaso de sesión;
  - el Web Push con VAPID no anda en WKWebView: en iOS hace falta APNs del lado del servidor;
  - no hay «Eliminar mi cuenta» dentro de la app (lo exigen Google y Apple; /privacidad dice «escríbenos»);
  - Sign in with Apple (guía 4.8, si no se argumenta la excepción de app de negocio) da un correo de reenvío que no
    coincide con el email invitado en `usuarios`;
  - Play con cuenta PERSONAL exige una prueba cerrada de 12 testers durante 14 días antes de producción; Apple exige
    Xcode 26 / SDK de iOS 26 desde el 28/04/2026 (Mac o compilación en la nube).
  - Las passkeys del 2FA (rama `2fa-tanda1`, chat Ciberseguridad) usan RP ID `hola-mako.com`: en una TWA andan solas;
    en un WKWebView de Capacitor necesitan `webcredentials` en el apple-app-site-association del dominio raíz.

## Los tableros en el teléfono: el prototipo y cómo se miró (14/10/2026)

- **Un tablero en 390 px:** una columna por pantalla con la siguiente asomando (scroll-snap nativo, sin JS de gesto),
  y arriba una barra de UN renglón con un tramo y el conteo por etapa. Una barra de navegación que se scrollea de costado
  está prohibida en esta casa; con N tramos de ancho fijo entra cualquier cantidad de etapas. Mover es mantener presionada
  la tarjeta → «Mover a…», o el detalle; nunca arrastrar. **Vive en:** docs/prototipos/mako-mobile-tableros.html.
- **El ancho de una columna se mide con `offsetWidth`, no con `getBoundingClientRect`.** Dentro de algo escalado con
  `transform` (la escena del prototipo, y cualquier vista previa de teléfono en un editor), el rect viene escalado y
  `scrollLeft` no, así que «qué columna estoy viendo» sale mal sin un error.
- **Chrome headless con `--screenshot` y `--virtual-time-budget` puede no terminar nunca** (una de siete capturas colgó
  tres minutos con el mismo archivo). Cada captura va con `timeout 45`, `--mute-audio`, un perfil en el scratchpad, y al
  terminar se paran los `chrome.exe` de ese perfil.
- **Una publicación de Instagram se lee sin sesión** pidiendo `/p/<id>/embed/captioned/` con el user-agent
  `facebookexternalhit/1.1`: trae el texto y la portada (las demás láminas de un carrusel, no). WebFetch y la página
  normal devuelven sólo «Instagram».

## LAS MISMAS RUTAS (13/10/2026): /m es la carpeta interna, nunca una URL

Martín, 12/10/2026 09:26, mirando /m/hoy en su celular: «lo que esta mal es que funcione por rutas, eso no debe ser
así... Las rutas deben ser las mismas, solo debe detectar si estoy en mobile». Cómo quedó: un teléfono abre /crm,
/general, /plan… y el PROXY le sirve la página de /m en esa misma URL (`NextResponse.rewrite`, `pedidoMovil`); una URL
/m vieja (un favorito, un push, un atajo) se REDIRIGE a la de escritorio; y todo link que arman las pantallas de /m sale
como la ruta de escritorio. Lo que no se ve leyendo el código:

- **Son dos fronteras y cada una es UNA función.** Al LEER la URL, `rutaInterna` (el shell la usa por `useRutaInterna`:
  la cabecera, la barra y la animación siguen hablando en rutas /m). Al NAVEGAR, `rutaEscritorio`, que la aplica
  `conWs`. El diagnóstico obvio —cambiar los ~30 `href="/m/…"` de las pantallas— dejaba afuera lo que no es un href
  (`router.replace`, los `redirect` del guard, el `linkApp` de los push) y al próximo href que alguien escriba. Por
  `conWs` pasan las cinco formas de navegar. La sexta, un `redirect('/m')` PELADO en /inicio, no pasaba: se cambió a
  mano. **Vive en:** lib/movil-rutas.ts, lib/ws-tab.ts, app/inicio/page.tsx
- **Lo del layout raíz necesita saber si es un TELÉFONO, no sólo la ruta.** El Sidebar, los banners, la esquina de
  avisos, la tarjeta del CRM automático y los pollers de WhatsApp se apagaban con `esRutaMovil(pathname)`, y con el
  rewrite el navegador dice /crm. Preguntan `useVistaMovil()` / `useTelefono()` (un contexto con el `telefono` que el
  layout ya calculaba). ⚠️ **NO MEDIDO en un navegador:** si `usePathname` en el SSR de una página reescrita devuelve
  /crm o /m/crm (en Next 16.2 el cliente arranca de `location.href` y el server de `req.url`). El código anda con las
  dos respuestas a propósito: `rutaInterna` acepta las dos y `esVistaMovil` da true para las dos, así que el SSR y la
  hidratación dibujan lo mismo. **Vive en:** app/_components/VistaMovil.tsx, app/_components/PublicRouteGate.tsx,
  app/_components/NotificationsProvider.tsx, app/_components/MakoConfirmGate.tsx, app/_components/AvisoPixelViejo.tsx
- **Una pantalla que sólo existe en el teléfono necesita una URL sin /m y un respaldo de escritorio** (`SOLO_TELEFONO`):
  /mas (More), /configurar, /perfil/instalar y /crm/<id>/chat. Una computadora que la abre (un link copiado del
  teléfono) va a /general, /onboarding, /perfil y la ficha. **Vive en:** lib/movil-rutas.ts
- **`?hoja=` en /dashboard ES la página de una hoja propia** (`rutaMovil` lo manda a /m/dashboard/<hoja>). DashboardM
  escribía `hoja` en la URL también con UNA sola hoja: al closer, cambiar el período lo mandaba a la página de su hoja,
  que lo devuelve sin el período. Sólo con el segmentado. **Vive en:** app/m/dashboard/DashboardM.tsx
- **/inicio va en `SE_ABREN_IGUAL`**: es el repartidor y no dibuja nada; sin eso, el proxy le servía Today en la URL
  /inicio. **Vive en:** lib/movil-desvio.ts
- **El POST de una server action también se reescribe**: la respuesta trae el árbol de la página, y sin el rewrite el
  server armaría el de escritorio para un navegador que tiene el de /m. Una /m vieja se redirige sólo en GET y HEAD.
- Lo fija tests/movil-mismas-rutas.test.ts: la ida y vuelta de CADA page.tsx de app/m (una página nueva sin su fila en
  `rutaEscritorio` falla ahí), la decisión del proxy, y el proxy de verdad con UA de iPhone y una sesión firmada.

## El CRM del teléfono abría VACÍO con 13 leads (13/10/2026, medido en producción)

«Hay cosas que no funcionan, como el CRM...» (Martín, 12/10, sin detalle). Medido en hola-mako.com/m/crm con su sesión
(ws9, sólo leyendo): la pantalla decía «Nada pendiente por hoy.» y nada más, con 13 leads en el embudo (8 en Círculo
ROJO). Los tres grupos son lo de HOY (reuniones de hoy, chats sin responder de 7 días, nuevos de 7 días en la etapa de
entrada): sin nada de eso, los leads quedaban detrás del ícono del filtro, que nadie adivina. El filtro, la ficha
(/m/crm/2659) y el chat del lead se dibujaron bien, sin errores de la app. Arreglo: sin nada pendiente, debajo del
aviso van las etapas con su conteo (la lista del sheet «Ver por etapa»). ⚠️ **NO MEDIDO:** si Martín se refería a otra
cosa (en un teléfono real: agendar, mover de etapa, dictar), y que «Todas» del sheet sigue mostrando lo pendiente, no
todos los leads. **Vive en:** app/m/crm/ListaCrm.tsx

## Un SyntaxError en CADA página de /m: el minificador se comía el script del tema (13/10/2026)

Medido en la consola de producción: `SyntaxError: missing ) after argument list`. El script que pone el oscuro antes del
primer pintado llegaba como `getItem('mako.modoif(o){…`: el SWC del build junta los templates con `+` cuyas `${…}` son
constantes y se come el texto entre ellos. El fuente se leía perfecto, y en pantalla sólo se notaba como un fogonazo
claro a quien eligió el oscuro (el shell lo aplica después de pintar). El detalle y la regla, en docs/hallazgos-infra.md → «El minificador se come texto». **Vive en:**
app/m/_ui/tema.ts, tests/minificador-templates.test.ts

## Lo que más cuesta redescubrir

- **El manifest abría la LANDING de venta a la persona logueada.** `start_url: '/'` y la raíz es la
  landing pública desde que el repartidor se mudó a `/inicio`. Se cambió a `/inicio` con `id: '/'`
  fijo: sin `id`, el id ES el `start_url`, y cambiarlo convierte la app instalada en «otra app» para
  Chrome. En iOS el ícono ya agregado congela el manifest viejo: hay que volver a agregarlo.
  **Vive en:** app/manifest.ts
- **`/m` no se puede salir del layout raíz** (no hay route groups): se apaga el cromo de escritorio
  sumando `esRutaMovil(p)` a `esVistaSinChrome`, nunca a `isPublicLandingPath` (ésa significa
  «público» y apaga los pollers). Y **nunca `startsWith('/m')`**: atrapa `/mako`, `/marketing`,
  `/mensajes` y la ruta PÚBLICA `/m.js` del Pixel. **Vive en:** lib/movil-rutas.ts,
  app/_components/PublicRouteGate.tsx
- **La home es `/m/hoy`, no `/m`**: Next redirige `/m/` → `/m` (trailingSlash false) y un scope
  `'/m/'` no cubre `/m`. `/m` sólo reparte. **Vive en:** app/m/page.tsx
- **Los guards de escritorio sacan al usuario de la app**: `requireRolWs`, `requireCapa` y
  `guardOnboarding` redirigen a `/crm`, `/plan` y `/onboarding`. En `/m` va `requireMovil` (los
  mismos predicados, destinos `/m`) en CADA página: los layouts no se re-ejecutan al navegar.
  **Vive en:** lib/movil-guard.ts
- **`black-translucent` obliga a un header OSCURO** (v1): iOS pinta reloj y batería en blanco sobre lo
  que haya debajo. `env(safe-area-inset-*)` vale 0 sin `viewportFit: 'cover'`. Desde la v2 el header es
  CLARO y va `default` (ver «El rediseño v2»). **Vive en:** app/m/layout.tsx, app/layout.tsx, app/m/m.css
- **«Háptica = navigator.vibrate» deja al iPhone sin háptica**: en iOS no existe. El patrón que anda
  (web-haptics) es un click sincrónico a un `<input type=checkbox switch>` oculto (iOS 18+).
  **Vive en:** lib/haptico.ts
- **La campanita no existía**: la tabla `notificaciones` (mig 0048) nunca se aplicó y
  `crearNotificacion` se tragaba el error; además no tenía `workspace_id` (aplicada tal cual le
  mostraba a cada cliente los avisos de todos). Ahora es la 0250, con workspace y leído por persona
  (marca de agua en `usuarios.perfil`). Los avisos son de admin, en el feed y en el push.
  **Vive en:** lib/notificaciones.ts, app/api/notificaciones/route.ts
- **Una suscripción push se ata a la PERSONA, no al workspace de la pestaña**: un super admin con
  `?ws=N` habría recibido en su celular los avisos del cliente que miraba. Y al cambiar de cuenta en
  el mismo teléfono la suscripción seguía siendo de la anterior: se re-ata al abrir el shell y se
  suelta al cerrar sesión desde /m (el logout del Sidebar de escritorio todavía NO la suelta).
  **Vive en:** app/api/push/suscripcion/route.ts, lib/push-cliente.ts, app/m/_ui/ShellM.tsx
- **El par VAPID NO se regenera nunca en runtime**: regenerar una fila ilegible (otro
  `CREDENCIALES_SECRET`) invalida todas las suscripciones. Se generó UNA vez por script,
  insert-if-absent, en el workspace de plataforma (`envCred` resuelve contra el ws1, un cliente).
  **Vive en:** scripts/push-vapid-generar.mts, lib/push.ts
- **`?ws=` con el propio workspace es impersonación para un admin global**: un push a Martín con
  `?ws=9` le abría el plan vacío (el tablero de cliente). Los links al workspace de plataforma salen
  sin `?ws=`. El diagnóstico obvio («todo link que sale lleva `?ws=`») era el equivocado para ese
  caso. **Vive en:** lib/push-payload.ts (`wsDelLink`)
- **Un aislamiento por persona sobre una tabla compartida se cae por la ruta vieja**: los chats del
  teléfono son por persona (`mako-movil:<persona>`), pero `chart_sessions` también la leen por id
  `/api/chart-insights` y `/api/mako-doer` (ids correlativos): un closer leía los chats del dueño.
  Al restringir filas, grep de TODO lo que lee o escribe esa tabla por id. Y esa privacidad es un PREFIJO
  de texto, no RLS: un chat por persona NUEVO sobre `chart_sessions` la hereda sólo si su clave empieza con
  `mako-movil:` (lo hizo MaKo Analyst de la ficha del lead, 12/10/2026: ver «El turno del teléfono, prestado
  a la ficha del lead», abajo). **Vive en:** lib/chart-chats.ts
- **Un default de límite silencioso convierte un conteo en mentira**: `listPropuestasPendientes()`
  sin argumento topa en 8, y el teléfono decía «8 borradores» con 133. **Vive en:** lib/plan-hoy.ts
- **El parche de fetch (WsFetch) no cubre `XMLHttpRequest`**: la subida con progreso del chat le
  pega el `?ws=` a mano. **Vive en:** app/m/mako/
- **La imagen NO llega a Gemini como bloque por chatCheapTools** (medido): se lee antes con el lector
  compartido y su texto entra al turno; lo leído no queda en la memoria del chat (sólo el
  placeholder). **Vive en:** lib/mako-adjuntos.ts
- **Infra: un `next dev` lanzado en segundo plano por esta corrida quedó huérfano, llegó a 8 GB y
  tumbó la app de Claude con 7 chats** (el diagnóstico, en docs/hallazgos-infra.md). Desde entonces el
  vigía mata los `next dev` grandes; al reintentar, mató el mío a los 4 GB compilando `/m/hoy` con
  750 MB libres. Consecuencia: **ninguna pantalla de /m se renderizó antes del deploy**, y salió con el
  reparto de teléfonos apagado (`MOVIL_ACTIVO = false` en lib/movil-desvio.ts). Se prendió con la v2
  (11/10 a la noche), todavía sin haberla visto en un navegador: ver «Lo que quedó sin hacer».
- **tsc salta todo el chequeo de tipos si cualquier archivo tiene un error de SINTAXIS** (TS1005):
  «los errores son de otro archivo» no prueba que lo tuyo compile. Con errores semánticos (TS2304) el
  resto sí se chequea.

## El rediseño v2 (11/10/2026, tarde): lo que el relevo midió

Diseño y prototipo en [diseno-mako-mobile-v2.md](diseno-mako-mobile-v2.md) (tres lectores sobre las
pantallas de escritorio; implementado esa misma noche: ver la sección siguiente).

- **«El editor de video estilo CapCut (/video-generator)» no está en `/video-generator`.** La lectura
  obvia del pedido manda a diseñar sobre un editor que en `main` no existe: ahí hay un wizard de tomas
  (`PasoTomas.tsx`). El CapCut vive en la rama `video-editor` (`C:/dev/wt-video-editor`), sin mergear.
  Antes de diseñar una versión reducida de algo, se mira qué hay en `main`. **Vive en:** app/video-generator/
- ⚠️ **Y el relevo se equivocó con el Gamma, en la dirección contraria**: dijo que el editor tipo Gamma
  NO estaba en `main`, y SÍ estaba (commit `c27d4f82`: `landing_docs`, app/landing-generator/[id],
  lib/editor-landing). La implementación v2 casi recorta el alcance de Landing por una frase de un
  documento de esa misma tarde. Regla: antes de achicar un alcance por lo que dice un relevo,
  `git log -- <carpeta>` sobre `main`. **Vive en:** app/landing-generator/, lib/editor-landing/
- **El verde y el rojo de la casa no sirven como TEXTO chico**: `--good` da 3,45:1 y `--bad` 4,26:1
  sobre blanco (AA pide 4,5), y `--primary` da 4,20:1 sobre `--bg`. En el teléfono el color va en la
  marca (punto, flecha) con el texto en tinta, y los links sobre `--bg` en `--primary-strong` (5,27).
  **Vive en:** app/globals.css
- **Un header claro invierte el hallazgo de `black-translucent`**: con el header claro va `default`
  (texto oscuro) y `themeColor` claro; en iOS instalada `default` pinta su propia franja, que hay que
  mirar en un iPhone contra `--bg`. **Vive en:** app/m/layout.tsx
- **Ads Manager no tiene propuestas de MaKo para aprobar** (son de Meta) y **Automations no muestra
  números** (están en `/chat-analyst`): un diseño que los dé por existentes inventa trabajo de
  backend. **Vive en:** app/ads-manager/, app/automations/, app/automations/DashboardChatAgent.tsx
- **`chrome --headless --window-size=390,844 --screenshot` NO mira un teléfono: diagnostica un
  desborde que no existe.** Chrome en Windows topea el ancho de la ventana en ~500 px; la página se
  arma a 500 (y el `@media (max-width: 520px)` igual aplica, así que no se nota) y la captura sale
  recortada a 390. Medido el 11/10 sobre el prototipo: las tarjetas cortadas en el borde derecho y
  la barra con 4 de sus 5 destinos, sobre una página que a 390 de verdad mide 390 justos. Para mirar
  a ancho de teléfono va `Emulation.setDeviceMetricsOverride` por CDP (molde: el puente `mirar.mjs`
  de `verificar-en-navegador`), y la medición que lo confirma es `document.documentElement.scrollWidth`
  contra `innerWidth`, no la captura. Sin CDP también sirve un iframe del ancho exacto: adentro, `innerWidth` y los `@media` son
  los del iframe (medido el 22/10/2026 con el grafo del Second Brain a 375, 360 y 340). **Vive en:** docs/prototipos/mako-mobile-v2.html

## La implementación v2 y el desvío PRENDIDO (11/10/2026, noche)

Doce agentes escribieron el armazón y las pantallas sobre el prototipo; una integración enchufó lo que
cada uno dejó afuera de su carpeta y prendió `MOVIL_ACTIVO`. Nada se vio en un navegador (la máquina
no tuvo RAM para un `next dev`): todo lo de acá se midió con typecheck, tests y lectura de código.

### Lo que más cuesta redescubrir

- ⚠️ **Prender el desvío TAPABA LO PÚBLICO.** `prefiereMovil` mira el teléfono (UA + cookie), no la
  sesión: un VISITANTE sin cuenta en un celular —el comprador que vuelve de pagar a
  `/pagar/<token>/listo`, quien lee `/reembolsos`— habría leído «Esta pantalla se usa en la
  computadora». `SE_ABREN_IGUAL` era una lista a mano que no seguía a `PUBLICOS`. Regla: lo público
  no se tapa nunca, y se pregunta con `esPublica` (lib/rutas-publicas.ts), no con una segunda lista.
  **Vive en:** lib/movil-desvio.ts (`decidirDesvio`)
- ⚠️ **Y armaba un BUCLE para el admin global sin cliente**: /inicio lo manda a /customer-success →
  el desvío a /m/cs → `requireMovil` (sin workspace) a /inicio → /customer-success… Antes de la v2
  /customer-success era «en la computadora» y no había bucle: lo creó MAPEAR una sección nueva.
  ⚠️⚠️ **La primera cura fue la EQUIVOCADA y salió a producción:** sacar a ese admin del desvío
  (`adminSinCliente`). Ese admin es MARTÍN cuando entra a hola-mako.com sin mirar a un cliente, o
  sea la única persona que había pedido la app: abrió el celular el 12/10 y vio el escritorio («No
  aún no veo la versión mobile, me sale todo igual...»). Cortar el síntoma (el bucle) dejaba afuera
  justo el caso que importaba. La cura de raíz: `requireMovil` lo manda a /m de SU negocio
  (`?ws=` de `wsSuperAdmin()`, la plataforma) en vez de a /inicio; el desvío le pone ese `?ws=` en el
  destino (`destinoMovil`), /inicio en un teléfono lo manda a /m, y en lo suyo no se dibuja la
  píldora de «viendo a un cliente» (`enLoPropio`, lib/movil-guard.ts). **Y por qué ninguna
  verificación lo vio:** el login de desarrollo (`/api/auth/dev-login?ws=9`) SIEMPRE trae un
  workspace, así que el camino «admin sin cliente» no existe en local; las 13 pantallas a 390 px
  pasaron en un estado que el dueño nunca tiene. Regla: una exclusión por ROL o por ESTADO de sesión
  se pregunta «¿quién cae acá en producción?» antes de escribirla — y si la respuesta es «el dueño»,
  no es una exclusión. **Vive en:** lib/movil-desvio.ts, lib/movil-guard.ts, app/layout.tsx,
  app/inicio/page.tsx, app/_components/DesvioMovil.tsx
- **Sumar una ruta a `rutaMovil` cambia ENSEGUIDA lo que abren los Web Push y los links de Today e
  Inbox**, no sólo el desvío: `MOVIL_ACTIVO` no lo frena. Las páginas de esas secciones salen en el
  mismo deploy que el mapa. **Vive en:** lib/movil-rutas.ts, lib/push-payload.ts
- **Donde el id es EL MISMO en los dos lados, el link abre ESA cosa**: el plan de un video
  (`/video-generator?plan=<uuid>` → `/m/video/<uuid>`) y una landing (`/landing-generator/<id>` →
  `/m/landing/<id>`). El comentario de `rutaMovil` decía que ningún id coincidía, y era falso para
  los dos. Y `rutaMovil` conserva la query de una ruta que ya es /m (`/m/inbox?vista=avisos`) pero
  NUNCA un `?ws=` (conWs no pisa el que ya está: ganaría el del link). **Vive en:** lib/movil-rutas.ts
- **La pantalla que entra animada con `transform` se vuelve el contenedor de todo lo `position:
  fixed` de adentro**: el composer del chat y el pie fijo saltaban al fondo de la columna durante
  320 ms. Se anima `left` sobre `.m-columna` (position relative) y `.m-contenido` lleva
  `overflow-x: clip`; lo fija un test. **Vive en:** app/m/_ui/ShellM.tsx
- **La profundidad de una pantalla no son los segmentos de su URL**: /m/mas y /m/dashboard tienen
  los mismos y uno está ADENTRO del otro. Se mide en el árbol de navegación (`nivel()`), con la barra
  DEL ROL: si a un rol le falta CRM o Plan, una sección de More sube a la barra y pasa a ser raíz.
  `destinoActivo`, `cabeceraPorRuta` y `nivel` reciben `barra`. **Vive en:** app/m/_ui/cabecera.ts
- **Con la pantalla entrando desde la derecha, el título grande está fuera de la ventana POR EL
  COSTADO** y el IntersectionObserver hacía parpadear el nombre chico: `rootMargin` con los costados
  agrandados un ancho entero. **Vive en:** app/m/_ui/ShellM.tsx
- **`[data-m] :is(h1,h2,h3,p){margin:0}` pesa (0,1,1) y le gana a una clase sola**: un margen de
  título se pierde sin error. Todo h1/h2/p con margen va con `[data-m]` delante. Y al pisar `.mk-btn`
  desde una pantalla: `[data-m] .mk-btn--tertiary:hover` pesa (0,4,0) y en táctil el `:hover` queda
  pegado; se sube a (0,5,0) y se repite en el `:hover`. **Vive en:** app/m/m.css
- **Un filete que arranque donde arranca el texto** (como Ajustes): un `::before` con `left:auto`
  toma la posición estática, pero con `right:0` el ancho se calcula shrink-to-fit y da 0 px sin
  error. `left:auto` + `width:100vw` y que corte el overflow del envoltorio. **Vive en:** app/m/m.css
- **Dos pantallas de /m chocaban por el prefijo de clases** (`.mc-*` era «m crm» y «m cuenta»): Next
  deja la hoja cargada al salir de la ruta, y abrir el CRM le cambiaba los estilos a la cuenta. El
  prefijo es el nombre ENTERO de la carpeta (`.m-crm-*`, `.m-cuenta-*`). **Vive en:** app/m/*/*.css
- **Lo pegado abajo va con `bottom: var(--m-abajo)`, nunca con `--m-tabbar` a mano**: el chat de MaKo
  pasó a pantalla de trabajo sin barra y el composer quedó flotando 56 px. **Vive en:** app/m/mako/mako.css
- **Un ícono inventado dibuja un punto, sin error** (Inbox llegó a apuntar a `'inbox'`). Cada ícono de
  la barra, de More y de las pantallas se fija contra `NOMBRES_ICONO`; al set se sumaron `bandeja`,
  `computadora`, `mas`, `reloj`, `flecha` y `calendario`. **Vive en:** app/_components/icons.tsx
- **Una regla que vive en un módulo `'use client'` no la puede llamar el server, y desde el cliente
  arrastra la pantalla entera al bundle del teléfono**: `estadoDeToma` (PasoTomas.tsx), el texto de un
  CRON (el hook `useTextoDisparador`), el rótulo «Chatbot» y la apertura de un borrador del lienzo.
  Las pantallas los copiaron; la integración los mudó a módulos puros (app/video-generator/
  tomas-estado.ts, `deSiempreDisparador` en lib/disparadores.ts, `ROTULO_CHATBOT` en
  lib/plantillas-automatizaciones.ts, `borradorAlAbrir` en lib/flujo-conversacion.ts) y escritorio
  los re-exporta. Regla: la lógica pura de una pantalla va en lib o en un módulo sin `'use client'`.
- **«Para hoy» de Today y la pestaña «Hoy» de Plan podían ser dos cuentas distintas**: `PlanHoy.hoy`
  viene SIN las prioridades (Today v1 pintaba las dos listas juntas), así que tomar sólo `plan.hoy`
  hacía desaparecer la prioridad #1 que vence hoy. Los dos usan `listaHoy`, y la misma casilla
  (`CasillaM`). **Vive en:** app/plan/board/hoy.ts, app/m/plan/formato.ts, app/m/_ui/CasillaM.tsx
- **La hora de una reunión puede ser la de la reunión ANTERIOR**: reagendar sin hora deja
  `junta_N_at` viejo. La hora vale sólo si su día es `fecha_junta_N`: lo cuidaban el CRM
  (`reunionesDeHoy`, `proximaLlamada`) y NO Today (`leerReuniones`), que se arregló en la
  integración. `proximaReunionDe` de escritorio (lib/lead-resumen.ts) mira sólo `junta_N_at`: no
  medido si ya mostró una hora vieja. **Vive en:** lib/hoy-movil.ts, lib/crm-movil.ts, app/m/crm/reglas.ts
- **Lo que se aprueba no se recorta**: `lineasDelPayload` cortaba todo texto a 160 caracteres y el
  sheet del Inbox mostraba un WhatsApp con «…»: se aprobaba sin ver el final. El texto va entero
  (tope de peso 2000); la fila corta una línea con CSS. **Vive en:** lib/inbox-movil-reglas.ts
- **Desde /m, un link pelado a una pantalla de escritorio rebota**: el desvío la manda de vuelta a su
  versión móvil (un botón que «no hace nada»). Se escribe la cookie de vista de escritorio y se
  navega con `conWs`, como «Versión de computadora». **Vive en:** app/m/inbox/InboxM.tsx, app/m/mas/

### Por pantalla (síntoma → causa → regla)

- **Dashboard.** Los «30 días» de Marketing son 29 y la última barra es AYER: `hastaDeFuente` corta en
  ayer lo que llega por cron. El rótulo dice «vs. el período anterior», nunca «vs. los 30
  anteriores». Hay DOS CAC (`negocio.cac` = gasto ÷ cierres; `getRevenuePeriod.cac_usd` = gasto ÷
  primeros pagos): el teléfono muestra el de la hoja, como escritorio. Un gráfico que acompaña a un
  número sale de las MISMAS filas que ese número (el cash por semana, de `rev.cashItems`). El closer
  tiene `graphics` en nav.ts pero escritorio le muestra sólo Closing: `seccionesMasVisibles` no le
  ofrece la fila si su capa no tiene Closing. **Vive en:** lib/graficos-datos.ts, app/m/dashboard/,
  lib/movil-rutas.ts. Sospecha sin medir: `getCashCollectedPeriodo` y `_getRevenueBreakdowns`
  (lib/pagos.ts) leen pagos sin paginar.
- **Ads Manager.** «Hoy» no existe para el gasto por campaña: `marketing_metrics_daily` la llena el
  cron una vez por día con AYER (escritorio muestra US$0 en «Hoy» de verdad). Con una moneda sin tasa
  (ARS), `spend_usd` trae el monto CRUDO con el nombre `_usd`: quien dibuja pide
  `conversorGastoMeta().moneda`. Activar desde escritorio re-prende TODOS los hijos, incluidos los
  pausados a mano; el teléfono prende sólo los que no estaban activos y su Deshacer pausa exactamente
  esos (escritorio sigue con el problema). En MXN el presupuesto se compara contra lo TIPEADO, o
  abrir y cerrar marca un cambio. `toLocaleString('es-AR')` agrupa 4 dígitos y `es-ES` no: todo /m
  usa es-AR. **Vive en:** app/m/ads/modelo.ts, app/ads-manager/CampanasBrowser.tsx
- **Customer Success.** El conteo por etapa es sobre los MIEMBROS del servicio, no sobre las filas de
  `cliente_entrega` (quien nunca se movió no tiene fila y está en la primera). Desde un servicio se
  invita con `invitarAlCursoDelProductoAction`, NO con la de la ficha: el mismo cliente puede estar
  invitado a OTRO curso (el diagnóstico obvio era el equivocado). `moverEntregaAction` revalida sólo
  /customer-success: /m pinta lo que devolvió la action encima de los props. Antes de enlazar a otra
  sección de /m se pregunta `puedeVerKey` (sin CRM, `wa.me`). Y ante un choque entre el prototipo y
  una decisión registrada de Martín en el código («Sin clientes en esta etapa.», que él sacó el
  05/10), manda la decisión. **Vive en:** app/m/cs/, lib/servicio-etapas.ts, app/customer-success/actions.ts
- **Automations.** El «Probar» de una sola vez (`action:'probar'`) existe en la ruta pero escritorio
  ya no lo llama, y manda TODAS las tarjetas de todas las ramas: que exista una action no la hace «la
  de escritorio» (grep de quién la llama hoy). `setSecuenciaPasos` (lo que corre Publicar) valida el
  grafo pero NO un mensaje vacío: toda pantalla que publique corre `frenoDelFlujo` antes. Las métricas
  «de 30 días» sólo tienen ventana en los envíos. Con un borrador de pasos `[]`, la lista de
  escritorio dice «sin publicar» y el lienzo abre lo publicado: el teléfono sigue al lienzo. **Vive
  en:** lib/setting-secuencias.ts, lib/nutricion.ts, app/m/automations/datos.ts
- **Video.** `estadoMontajeAction` se puede llamar desde un server component como lectura; con un rol
  no admin da `ok:false` y se toma como «sin montaje». Y sólo se pregunta con TODAS las tomas
  filmadas: un montaje viejo no se muestra sobre clips que ya no son los suyos. iOS no pinta el primer
  cuadro de un `<video>` sin reproducir: `src#t=0.1` (sin medir en un iPhone). **Vive en:** app/m/video/
- **Landing.** Una vista previa interna NUNCA es un iframe de la URL pública: carga el Pixel y cada
  vista del dueño sumaría una visita en `landing_visits`; se dibuja con `htmlDeTarjeta`. `analitica()`
  lee la foto publicada entera (hasta 10 MB): en una lista, Suspense por fila, concurrencia 3 y tope
  12. `listar()` no trae `sitio_activo` (una pausada se dibujaría «Publicada»), y `publicar()` vuelve
  a poner EN LÍNEA un sitio pausado: la consecuencia pegada al botón lo dice. **Vive en:**
  lib/editor-landing/server.ts, lib/editor-landing/publicar.ts, app/m/landing/
- **CRM.** El nombre de «Por responder» sale del lead, no del `push_name` de WhatsApp
  (`getConversacionesNoOficial` sólo usa el del lead si el push_name es el número). Contar «como el
  tablero» aplica su regla de columna: una etapa que el funnel ya no tiene cae en la PRIMERA
  (`etapaEnTablero`). `getLeadAudit` traga el error: una actividad vacía no se afirma. Una acción de
  `<CabeceraM accion>` va memoizada (el ReactNode está en las dependencias del efecto). El dictado de
  Safari se arranca en el `onClick`, nunca en un efecto. Y abrir /m/crm ya no escribe: la v1 llamaba a
  `getPendientesDeMarcar` (adjunta Fathom y cierra historial) y la v2 la sacó. **Vive en:** app/m/crm/,
  lib/crm-movil.ts, lib/leads.ts
- **Plan.** La fila completada podía irse a mitad de la animación porque el `refresh()` de la action
  llega antes: la fila en tránsito se repone hasta terminar (`conEnTransito`). Estado indexado por id
  del tablero del cliente va en un `Map`: un objeto reordena solo las claves enteras. El prototipo
  dibuja PROYECTOS en «Prioridades» y el dato real son 5 TAREAS: replicar es copiar la forma de la
  fila, no inventar un ranking. **Vive en:** app/m/plan/ListaPlan.tsx
- **Inbox.** `etiquetaDeOrigen` devuelve «vino de MaKo» también para un origen DESCONOCIDO: la
  estrella se decide contra las mismas funciones que escriben la etiqueta, y lo desconocido la lleva.
  `listNotificaciones` traga el error y una lectura caída se dibuja «Sin avisos todavía.». **Vive
  en:** app/m/inbox/decision-m.ts, lib/notificaciones.ts
- **Today.** La tarjeta de lo que bloquea trabaja con CONTEOS: el detalle sale de `leerParaDecidir`,
  que ESCRIBE (vence pendientes) y es del Inbox. Una bandeja sin leer es null, nunca un 0 sumado.
  **Vive en:** lib/inbox-movil.ts, app/m/hoy/modelo.ts

## Lo que quedó sin hacer

- ⚠️ **VER /m EN UN NAVEGADOR Y EN UN TELÉFONO, YA CON EL DESVÍO PRENDIDO.** Ninguna pantalla v2 se
  miró (ni el título grande, ni los sheets, ni el composer con el teclado, ni el oscuro). Con
  `MOVIL_ACTIVO = true`, el primer deploy hace que todo celular que abra MaKo caiga en /m: si una
  pantalla tira, es lo que ven los clientes. El interruptor está en lib/movil-desvio.ts.
- **Medir en un iPhone y un Android reales**: la voz (SpeechRecognition en una PWA standalone), el push
  (activar dentro del toque, iOS 16.4+ instalada), instalar, el teclado con el composer, los gestos del
  sheet y del mic, la háptica, el primer cuadro de un video (`#t=0.1`), y la franja de iOS con
  `statusBarStyle: 'default'` contra `--bg`.
- **Lo que el prototipo dibuja y el teléfono no hace** (decisiones por default del 11/10, sin respuesta
  de Martín; ver docs/diseno-mako-mobile-v2.md): filmar de nuevo una toma y crear un anuncio (gasta
  créditos de Flow), editar una sección de una landing (sería un segundo editor), «Hoy» en Ads
  Manager (la pauta llega hasta ayer), «Probar en mi WhatsApp», «Conclusiones con MaKo» (/m/mako no
  acepta un mensaje inicial) y propuestas de MaKo en Ads Manager.
- **El badge de Inbox puede ser más alto que el «Para decidir · N»**: `contarParaDecidir` cuenta las
  acciones complejas y los cambios del CRM sin opciones, que la lista pliega en «En la computadora».
  Contarlos bien pide leer los payloads. **Vive en:** lib/inbox-movil.ts
- **La tarjeta de Today no abre la decisión directo** (`/m/inbox?abrir=<key>` ya existe): Today sólo
  tiene conteos. Por lo mismo no lleva la estrella de MaKo: un conteo no dice quién propuso.
- **Copias que siguen en el teléfono, a propósito o por riesgo**: la cascada, el rollup y el cruce por
  nombre de Ads Manager (app/m/ads/modelo.ts, copiados de closures de CampanasBrowser.tsx: mudarlos a
  lib toca la tabla de escritorio sin poder verla, y la cascada del teléfono es distinta a
  propósito); `sinPublicarDe` (el teléfono sigue al lienzo con un borrador vacío, no a la lista);
  `ETAPA_LABEL` repetida en ChatAgentApp.tsx y ChatAnalystVista.tsx.
- `listNotificaciones` (lib/notificaciones.ts) necesita una variante estricta: hoy «No pudimos leer
  los avisos» no se alcanza nunca.
- Los íconos del composer del chat (enviar, cámara, foto, archivo, candado, «+») siguen en
  app/m/mako/iconos.tsx y no en el set; las salidas de la cuenta (`SalirDeLaVista`, `CerrarSesion`)
  se repintan como fila desde app/m/cuenta/cuenta.css en vez de tener una variante `como="fila"`.
- Un link de escritorio `/automations?sec=<id>` abre la lista en el teléfono, no esa automatización
  (la pantalla no lee `?sec=`).
- El orden por defecto del kanban de Customer Success en escritorio es Z→A por nombre
  (ClientesApp.tsx, `useState('desc')`); el teléfono ordena A→Z.
- El logout del Sidebar de escritorio no suelta la suscripción push (sólo el de /m).
- lib/mako-intencion.ts (ACCION_CUENTA_RE) no reconoce imperativos con tú («mueve», «pausa»): el chat
  del teléfono no propone mover etapas con copy neutro. Afecta también a WhatsApp.
- lib/api-mako/ejecutar.ts:184 escribe la instrucción de WhatsApp («confirmen con un sí») para todos
  los canales; el teléfono la reemplaza con `conInstruccionDeTarjeta`.
- `tarjetaDePendiente` (lib/mako-turno-app-reglas.ts) repite la decisión de `aFila`
  (lib/bandeja-filas.ts): que la llame.
- Latencia del chat: gemini-flash-latest cortó o dio 503 y rotó a flash-lite (23-108 s por turno).
- `setNotifPush` y `setNotifVistoHasta` reescriben el perfil sin comparar: dos guardados pueden pisarse.
- El proyecto «Feature: MaKo Mobile» no existe en el tablero del dueño.
- **La nota desde el teléfono recorta a 4000 caracteres en silencio al crearla** (`notaLeadAction`,
  app/m/crm/acciones.ts:80, `slice(0, 4000)`). Desde el 12/10/2026 el alta de escritorio y la edición RECHAZAN lo que
  pasa `TOPE_NOTA` (app/crm/notas-reglas.ts) en vez de recortar, pero /m corta ANTES de llamar al alta, así que el
  rechazo nunca la ve: una nota dictada más larga se guarda cortada y el teléfono contesta que quedó. Lo que falta es
  rechazar con `TOPE_NOTA` y decirlo en el toast. El porqué, en hallazgos-crm.md → «La segunda revisión del 12/10».
- Los mensajes fijos de `lib/mako-turno-app-reglas.ts` (`MENSAJE_BORRADOR_APP` :272 y la ficha preparada :277) dicen
  «confírmalo en Inbox», y desde el 12/10/2026 ese turno también corre en ESCRITORIO (MaKo Analyst de la ficha del
  lead), donde Inbox no existe. En el chat la fila sí lleva a su pantalla.

## Las trampas que midieron los agentes, por área

Tal como las devolvieron (síntoma → causa · dónde · regla). Son la materia prima de lo de arriba.


### Shell y PWA
- **Un test que dice «coincide con el ua-parser de Next» no podía correr desde el scratchpad: «Cannot find package 'next'».** → Un .mts en el scratchpad resuelve los paquetes desde su propia carpeta, no desde el repo. · tests/movil-dispositivo.test.ts (importa userAgentFromString de next/server) · REGLA: Lo que importa paquetes del repo se prueba como test dentro de tests/ (o con imports dinámicos por ruta absoluta), no como script suelto en el scratchpad.
- **El guard «toda regla de m.css tiene alcance» marcaba 10 selectores sin alcance (h2, label, select…) que sí lo tenían.** → Partir la lista de selectores por coma corta adentro de :is(h1, h2, h3, p), así que los pedazos pierden el prefijo [data-m]. · tests/movil-shell.test.ts → partirPorComas · REGLA: Para partir una lista de selectores CSS se usan sólo las comas de primer nivel (contando paréntesis), nunca split(',').
- **Un flick suave hacia abajo desde «alto» a mitad de camino terminaba en «medio», y se leía como bug del sheet.** → destinoDelSheet elige el snap más cercano a la proyección. A 600 de 800, con medio en 400, el más cercano es medio; el flick sólo fuerza un escalón si supera 0,11 px/ms. · app/m/_ui/gestos.ts → destinoDelSheet · REGLA: La expectativa de un test de snaps se calcula con la proyección (visible − v·99), no a ojo; si cae al medio de dos snaps, el resultado es el más cercano.
- **/inicio y la redirección a /m no se pueden probar en local sin el dev server, y el server compartido desapareció a mitad de la corrida.** → Otra sesión (o la guardia de RAM) cerró el next dev de localhost:3000. Un node de 2,8 GB seguía vivo, pero sin escuchar el puerto. · localhost:3000 (dev compartido) · REGLA: Si el dev compartido no contesta, la verificación visual se declara PENDIENTE en el reporte con el comando exacto. No se arranca otro server ni se declara «verificado».
- **El comentario de ejemplo de badges.ts decía `inbox: (ctx) => contarParaDecidir(ctx)`, y eso compilaría con un objeto donde se espera un número.** → contarParaDecidir devuelve { total, porTipo }, no un número. El ejemplo se escribió antes de que existiera lib/inbox-movil.ts. · app/m/badges.ts (comentario de cabecera) · REGLA: Un ejemplo de enchufe en un comentario se reescribe contra la firma REAL cuando el módulo aparece. Acá ya está corregido a `.total`, donde null = no se pudo leer = sin badge.


### Push y feed
- **Un script de diagnóstico en el scratchpad tira ERR_MODULE_NOT_FOUND para 'dotenv' aunque el comando se corra con cwd en el repo.** → En un .mts, el import('dotenv') se resuelve contra la carpeta del SCRIPT y no contra el cwd. Como el scratchpad no tiene node_modules, no lo encuentra. · Scripts en scratchpad/<clave>/*.mts corridos con npx tsx --conditions=react-server. · REGLA: Para los paquetes, usar import(pathToFileURL(path.join(process.cwd(),'node_modules','dotenv','lib','main.js')).href).default, y para los módulos del repo, rutas absolutas con pathToFileURL. Nunca un especificador pelado desde un script que vive fuera del repo.
- **Hay que medir si un paquete nuevo (web-push) compila con Turbopack, y el dev server 'compartido' de localhost:3000 contesta HTTP 000.** → El dev server no estaba corriendo a esa hora. La regla de la corrida prohíbe levantar uno, así que la medición del bundle queda sin hacer. · next.config.ts (serverExternalPackages) y el primer request a /api/push/clave. · REGLA: Que un paquete cargue bajo tsx no dice que Turbopack lo empaquete. La medición queda pendiente y se declara como no medida; no se agrega serverExternalPackages a ciegas.
- **Los avisos alDueno aparecerían en el feed del CLIENTE y su push iría a los teléfonos del cliente.** → Antes, crearNotificacion y la cola usaban el ws del contexto en que se emitía el aviso. Un aviso de agencia sobre un cliente se emite adentro del workspace de ese cliente. · lib/avisos.ts, emitirAviso: wsLector = alDueno ? wsSuperAdmin() : ws. Lo comparten el feed, la cola y el push. · REGLA: El workspace de un aviso es el de quien lo va a LEER, no el de quien lo generó. Un canal nuevo de emitirAviso usa wsLector, nunca ws.
- **Una pendiente que se confirma en el mismo pedido (un token detallado con escritura directa por /api/v1, o el paso de un flujo) igual haría sonar «MaKo te pide confirmar».** → crearPendiente y crearPropuesta se llaman también desde caminos que las aplican en el acto (aplicarEnElActo). · lib/mako-pendientes.ts (avisarPendiente) y lib/propuestas.ts (avisarPropuesta): se saltean los orígenes 'app' y 'flujo:*', y pushPorDetras vuelve a preguntar el estado justo antes de mandar. · REGLA: Un push sobre algo que espera a una persona se manda después de la respuesta (after) y re-preguntando si sigue vigente; nunca en el mismo instante del insert.


### Turno de MaKo
- **Un turno real del doer corrido con tsx fuera de Next contesta «tuve un problemita técnico al consultar la base de datos» o «no pude localizar al lead»: parece un bug del turno o del runner.** → Las lecturas pasan por cachedRead → unstable_cache, que fuera del servidor de Next tira primero «Invariant: AsyncLocalStorage accessed in runtime where it is not available» y después «Invariant: incrementalCache missing in unstable_cache». El runner devuelve {ok:false,error} y el modelo lo traduce a una excusa. buscar_leads es una de esas lecturas; metricas_negocio no. · lib/cache.ts:46-62 (cachedRead); node_modules/next/dist/server/web/spec-extension/unstable-cache.js:60 · REGLA: Un script que corre un turno o una lectura del doer pone, ANTES de importar nada del repo, `globalThis.AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage` y un `globalThis.__incrementalCache` que no guarda nada ({generateCacheKey: async k=>k, get: async()=>null, set: async()=>{}, isOnDemandRevalidate:false}); molde en scratchpad/turno/e2e.mts. Si en un script el modelo dice «no pude consultar», se corre esa herramienta a mano antes de tocar el turno.
- **El system del chat del teléfono dice «se confirma TOCANDO la tarjeta» y aun así el modelo contesta «Confirma con un «sí» para que quede registrada».** → La salida de toda acción que deja una pendiente trae `instruccion: 'Di qué vas a hacer y pide que confirmen con un «sí»'`, fija para todos los canales. Lo que dice el resultado de la herramienta le gana al system. · lib/api-mako/ejecutar.ts:184; se resolvió en conInstruccionDeTarjeta (lib/mako-turno-app-reglas.ts), aplicada en runTool de lib/mako-turno-app.ts · REGLA: Un canal donde se confirma distinto que en WhatsApp reescribe la `instruccion` de la salida de la pendiente antes del memo. Cambiar el texto del system no alcanza (medido el 11/10/2026: con la reescritura, el modelo dice «tocando la tarjeta de aquí abajo»).
- **Se manda una foto como bloque de imagen al doer (chatClaudeTools, feature 'mako-doer') y el modelo contesta como si no hubiera foto: a «si no te llegó, responde NO_VEO» respondió «NO_VEO».** → El registro resuelve la feature a Gemini, que corre por chatCheapTools. bloqueATexto aplana cada mensaje y descarta todo lo que no es texto: la imagen no sale nunca, sin error. El diagnóstico obvio («Gemini no ve imágenes») es falso: por el lector nativo (archivoATexto → leerDocumentoIA, inline_data) la misma imagen da «Imagen completamente roja». · lib/ai-cheap.ts:772 (bloqueATexto); lib/mako-adjuntos.ts (cabecera) · REGLA: Una foto o un PDF que tiene que entender el doer se LEE antes con lib/archivo-a-texto.ts y entra al turno como texto; el bloque nativo sirve solo por un camino que mande bloques (Claude, vetado). El turno completo con foto tardó 108 s: la ruta necesita maxDuration 300 y el cliente un AbortSignal de 305 s.
- **Un script de diagnóstico que «prueba» una acción llamando a runnerDelRegistro(ctx)(nombre, input) deja una fila nueva en mako_acciones_pendientes (pasó con la #148, que hubo que cancelar).** → El runner del registro no tiene modo de prueba: una ACCIÓN con confirmación 'chat' corre preparar() y crea la pendiente de verdad en la base de producción (.env.local). · lib/api-mako/ejecutar.ts (runnerDelRegistro) → lib/api-mako/acciones.ts:88 proponerChat → crearPendiente · REGLA: En un script de diagnóstico se llaman sólo LECTURAS por el runner. Para probar una acción, por el turno completo y con cancelarPendiente al final; se revisa `select … where grupo_jid like 'app:%' and estado='pendiente'` antes de cerrar.
- **En el chat del teléfono (copy neutro con «tú»), «mueve a Rosana a Agendado», «pasa a Rosana a Agendado» o «pausa la campaña» no traen ninguna herramienta de acción: MaKo no puede proponer y responde de largo.** → clasificarIntencion los clasifica como 'capturar' (dudosa) porque ACCION_CUENTA_RE sólo reconoce imperativos en voseo («pausá» → actuar, «pausar» o «pausa» → capturar). Notas («agrega una nota al lead…») sí entran por el área crm. · lib/mako-intencion.ts (ACCION_CUENTA_RE); medido con scratchpad/turno/frases.mts · REGLA: El clasificador tiene que reconocer los imperativos en tú (mueve, pasa, pausa, cambia) además del voseo. Hasta que eso pase, un test que necesite una acción de cuenta usa la frase en voseo y lo dice en un comentario (tests/mako-turno-app.test.ts lo hace).


### Vista general (/general y Today)
- **La cabecera de /general escondía la acción del día comparando foco.hrefLabel === 'Cargar el objetivo'.** → No había un campo que dijera qué falta configurar, así que la pantalla dependía del copy del botón. Cambiar ese texto en lib/focus.ts rompía la cabecera en silencio, y el móvil iba a copiar la misma comparación. · lib/focus.ts (Foco.pideConfigurar) y app/general/Cabecera.tsx:248 · REGLA: Una pantalla decide por un campo explícito del modelo (pideConfigurar, tipo de alerta), nunca por el texto que ese modelo dibuja.
- **Con getDataSources() caído, el semáforo podía prender el verde y el foco decía «vas al día» sobre un negocio del que no se sabía nada.** → La página hacía fuentes = [] en el catch, y la guarda era `fuentes.length > 0 && ninguna con lastSync`, o sea que con [] daba sinFuentes=false. Lo mismo pasaba por fuente: un error de supabase dejaba lastSync null, que se leía como «nunca entregó nada» y mandaba a «conectar» una fuente conectada. · lib/vista-general-modelo.ts (estadoFuentes, en positivo: sólo 'con-datos' permite opinar) y lib/sources.ts (DataSource.error) · REGLA: Una lectura caída es un tercer estado ('sin-leer'), no [] ni null de un campo. La guarda #165 se escribe en positivo: se puede opinar sólo si hay al menos una fuente con datos, y si ninguna tiene datos pero alguna no se pudo leer, la respuesta es «no sé», no «sin datos».
- **La marca del tiempo de un objetivo ANUAL caía en el último día del trimestre (en Q4, al 100% del año).** → Cabecera llamaba fraccionDeRango(desde, hasta, progreso.hasta): pasaba el FIN del trimestre como si fuera hoy. No se veía porque no había ningún objetivo anual en la base. · lib/vista-general-modelo.ts fraccionDelObjetivo (antes en app/general/Cabecera.tsx) · REGLA: Un parámetro llamado `hoy` recibe el hoy del workspace, nunca un borde del período que está a mano.
- **El escalón «Plan» del foco no disparaba nunca para el dueño (ws9).** → Leía siempre experimento_tareas (el tablero del cliente, con 0 filas en ws9) en vez de plan_tareas. Además dejaba competir a las recurrentes, que no tienen un fin que se pueda adelantar. · lib/vista-general.ts (tableroActual + listPlanBoard/listTareas) y lib/focus.ts (sinRecurrentes dentro de elegirFoco) · REGLA: Quien lee «el tablero» desde afuera elige la mitad con tableroActual(). Y el filtro de recurrentes va dentro del que ELIGE, no sólo en quien llama, para que una pantalla nueva no las pueda colar.
- **El dev server compartido de localhost:3000, que la tarea daba por corriendo, no respondía (curl 000, ningún listener en 3000-3010). La captura «antes» de la corrida anterior es la página de error de Chrome guardada como PNG.** → El servidor se cayó o lo apagaron entre corridas. mirar.mjs no falla: guarda un PNG de «localhost refused to connect» y un JSON con hidrato:false. · scratchpad/mirar.mjs y shots/hoy-antes-ws1.png · REGLA: Antes de dar por buena una captura, leer el JSON de mirar.mjs: con url chrome-error:// o hidrato:false no hay captura. Y antes de capturar, `curl -m 5 localhost:3000/login`.


### Plan
- **La rotura 'banda del ítem con la urgencia heredada en vez de t.score' pasaba 12/0: ningún test la detectaba aunque el tablero de prueba tenía una dependencia.** → La única dependencia del fixture la ponía una tarea de score 12 frenando a una de 15: la urgencia heredada caía en la misma banda ('futuro'), así que las dos fórmulas daban igual. · tests/plan-hoy.test.ts (fixture `tablero()`), app/plan/board/hoy.ts (`banda: prioFromScore(t.score)`) · REGLA: Para probar una regla de urgencia heredada, la tarea bloqueada tiene que estar en OTRA banda que la que la frena (95 contra 10). Si la herencia no cruza de banda, el test no puede distinguir las dos fórmulas.
- **El script de prueba contra el ws3 decía 'SIN TAREAS ABIERTAS', y con el filtro .eq('recurrente', false) daba lo mismo.** → El Cliente de Prueba (ws3) está vacío de tareas abiertas: es un dato, no un error del filtro. · experimento_tareas del ws3 · REGLA: Para probar escrituras del plan del cliente en el ws3, hay que crear la tarea con crearTarea (lib/todo.ts no llama al Perro) y borrarla en un finally, comprobando con una relectura que quedan 0 filas.
- **El deshacer de marcarHecha deja la fila idéntica salvo updated_at.** → editarTarea es parcial y vuelve a derivar estado y hecho_at a partir del avance. El único rastro que queda es el timestamp de actualización. · lib/plan-marcar.ts → lib/todo.ts editarTarea · REGLA: Al verificar 'quedó exactamente como estaba', comparar la fila ENTERA y aceptar solo updated_at como diferencia. Cualquier otro campo distinto es un bug del deshacer.
- **La captura de /plan 'antes' de la corrida anterior era la página de Chrome 'This site can’t be reached', guardada como si fuera la evidencia.** → El dev server compartido de :3000 estaba caído y mirar.mjs igual escribe un png sin fallar. · scratchpad/mirar.mjs, shots/plan-antes.png · REGLA: Antes de usar una captura como evidencia, hay que leer su 'texto' u 'hidrato' en la salida de mirar.mjs o hacer `curl -w %{http_code}` al server. Un png existente no prueba que la pantalla cargó.


### Datos del Inbox
- **La bandeja de pendientes de MaKo o la de borradores del plan aparece vacía, y el badge diría 0, cuando en realidad la lectura falló.** → `pendientesDelWorkspace` y `listPropuestasPendientes` no miran el `error` de supabase-js y devuelven `[]` si la lectura falla. «No pude leer» queda igual que «no hay nada». · lib/mako-pendientes.ts y lib/plan-propuesta.ts. Se trabaja alrededor en lib/inbox-movil.ts (leerPendientes y leerBorradores). · REGLA: Para estas lecturas, un conteo que sí mira el error se hace ANTES de la lista y sirve de prueba. Si el conteo falla, o dice que hay y la lista volvió vacía, es una falla y no un vacío. Un badge nunca suma una bandeja caída como 0: el total queda null.
- **Al tocar dos veces «Deshacer el cambio» o una opción del CRM automático, el lead se revierte o se mueve de etapa dos veces. Mover de etapa puede mandar una conversión a Meta que no se deshace.** → `resolverConfirmacion` leía el estado, aplicaba y cerraba la confirmación AL FINAL con `.eq('id')` y nada más. Los dos toques leían 'pendiente' y aplicaban los dos. · lib/mako-confirmaciones.ts, resolverConfirmacion. · REGLA: Lo que escribe cosas no idempotentes se reclama primero con compare-and-set (`.eq('estado','pendiente')` + `.select('id')`; si vuelve vacío, no se aplica nada), igual que reclamarPendiente. Si lo que se aplica falla, se suelta con `.eq('estado', <el que reclamé>)` para que se pueda reintentar.
- **Una server action de /m saltea un permiso que en el escritorio sí se cumplía. Ejemplo: un rol con una capa sin 'mako' podría confirmar acciones de MaKo.** → La capa la chequeaba la PÁGINA de escritorio (`requireRolWs([], { nav: 'mako' })`). Las acciones de escritorio sólo miran la sesión y el rol, y una server action no hereda ningún guard de la página que la monta. · app/mako/pendientes/acciones.ts y app/mako/revisar/[id]/acciones.ts. El chequeo nuevo está en app/m/inbox/acciones.ts (noPuede). · REGLA: Antes de reexportar una acción de escritorio, revisar qué guard ponía su página. Las de /m vuelven a chequear rol y capa con la MISMA regla que arma la lista (`tiposVisibles`).
- **Después de confirmar desde el teléfono, el ítem sigue en el Inbox y el badge lo sigue contando.** → Las acciones de escritorio hacen `revalidatePath` de su propia ruta (/mako/...), no de /m. · app/m/inbox/acciones.ts, función refrescar. · REGLA: Las acciones de /m llaman a `refresh()` de next/cache después de escribir, envuelto en try para que un fallo al refrescar no convierta en error una escritura que ya se hizo.
- **`descartarLeadsAction` contestaba «ok» con cualquier id, aunque fuera de otro tipo.** → `descartarPropuesta` no mira el tipo, y la acción pedía cualquier sesión. Un closer podía descartar por id una propuesta de ACCIÓN de MaKo, que sólo debería tocar el admin. · app/crm/revisar/[id]/acciones.ts. · REGLA: Una acción que recibe un id de propuesta verifica tipo y estado antes de escribir. No alcanza con confiar en que la pantalla sólo muestra las suyas.


### Today
- **La capa del super admin (ws9) recibiría el Pulso de /general en Today, aunque el diseño dice que su Today es plan + vencimientos + aprobaciones.** → tabEnCapa deja pasar 'general' para la capa superadmin (userNavKeys null), así que puedeVerKey('general','admin','superadmin') da true. Medido con tsx el 11/10/2026. · lib/movil-rutas.ts puedeVerKey / lib/capas.ts tabEnCapa; resuelto en lib/hoy-movil-modelo.ts composicionHoy · REGLA: La COMPOSICIÓN de Today nombra la capa (superadmin/pm) además de puedeVerKey; derivar el Pulso sólo de la visibilidad de 'general' le muestra al dueño un tablero de cliente.
- **Un Today que pide el Inbox o los leads sin marcar escribe en la base en cada apertura.** → leerParaDecidir marca vencidas y getPendientesDeMarcar dispara adjuntarFathomAutoThrottled y cierra historial; leerVistaGeneral corre migrarSettingsAObjectives. Parecen lecturas. · lib/inbox-movil.ts, lib/queries.ts getPendientesDeMarcar, lib/vista-general.ts · REGLA: Desde Today el Inbox se CUENTA (contarParaDecidir, no escribe) y getPendientesDeMarcar se llama a lo sumo una vez por render (el admin la recibe dentro del Pulso); fijado por test.
- **La reunión de hoy no tiene hora si se usa sólo getJuntasProximas.** → JuntaProxima no expone junta_N_at aunque la columna está poblada (ws13: 5 de 5 con hora). · lib/queries.ts getJuntasProximas / lib/hoy-movil.ts leerReuniones · REGLA: La hora se completa con una lectura por ids (getTenantDb) y se formatea en la zona del NEGOCIO (tzDeWorkspace), nunca la del teléfono.
- **Un proyecto vencido con sólo tareas recurrentes se dibujaría «0 tareas abiertas».** → Desde la mig 0163 las recurrentes no cuentan como abiertas; el texto correcto vive en `carga` de lib/plan-vencimientos.ts, que es privada. · lib/plan-vencimientos.ts carga; app/m/hoy/page.tsx carga · REGLA: Quien dibuje FilaVencimiento mira abiertas Y recurrentes; mejor exportar `carga` que copiarla.
- **El dev server compartido de :3000 estuvo caído ~12 min y no se pudo mirar la pantalla.** → No es del código: ninguna sesión lo tenía arriba (sin listener). · entorno · REGLA: No arrancarlo desde un subagente (regla de la corrida); declarar la captura como BLOQUEANTE con el comando exacto.


### Inbox y Cuenta
- **Una confirmación del CRM que ya resolvió otra persona contesta ok:true, no «ya no está pendiente».** → resolverConfirmacion (lib/mako-confirmaciones.ts:273 y :287) hace `return` silencioso cuando el estado ya no es 'pendiente' o cuando otro toque ganó el reclamo. No hay error que leer. · lib/mako-confirmaciones.ts → app/m/inbox/acciones.ts resolverConfirmacionMovil · REGLA: En el teléfono, una confirmación ya resuelta se ve como «Listo» y la fila sale. Si hace falta decir «ya la resolvió otro», el server tiene que devolver un dato distinto. La pantalla no lo puede deducir.
- **La ruta /api/push/prueba nunca devuelve ok:true con enviados=0, así que la rama «ok y cero enviados» de un toast es código muerto.** → La ruta calcula ok = r.enviados > 0 (app/api/push/prueba/route.ts). sinSuscripciones cuenta USUARIOS sin teléfono suscrito, no teléfonos. · app/api/push/prueba/route.ts + app/m/cuenta/cuenta-ui.ts toastDePrueba · REGLA: Antes de escribir las ramas de un resultado, leé cómo la ruta arma `ok`. Si es un derivado de otro campo, la combinación contradictoria no existe.
- **El detalle de una acción mostraba dos veces el mismo parámetro (como campo editable y como línea de lectura), o lo filtraba mal.** → Las líneas de `detalle` usan rotuloDeParametro(def), que sale de un diccionario de respaldo, y no `p.rotulo ?? p.nombre`. Con dos fuentes del rótulo, el filtro por nombre no calza. · lib/inbox-movil-reglas.ts lineasDelPayload ↔ app/m/inbox/InboxM.tsx · REGLA: Para cruzar un parámetro con su línea de detalle, usá la MISMA función de rótulo (rotuloDeParametro de lib/editor-acciones.ts, que es apta para el cliente).
- **El botón «Probar aviso» y el resto de la sección dependen del teléfono, y pintados en el primer render provocaban un desfase de hidratación.** → esIOS, estaInstalada, Notification.permission y la suscripción sólo existen en el navegador. · app/m/cuenta/CuentaM.tsx AvisosTelefono · REGLA: Todo lo que depende del dispositivo se lee en un useEffect y arranca en 'cargando'. Nunca se decide en el render del server.


### Chat de MaKo
- **Un super admin que mira a un cliente sube una foto al chat del teléfono y el turno corre en el workspace equivocado (el suyo).** → El parche de app/_components/WsFetch.tsx sólo le pega el ?ws= a fetch(); XMLHttpRequest no pasa por ahí. El XHR, que es el único camino con progreso de subida, salía sin el ws. · app/m/mako/ChatMako.tsx (postConProgreso(conWs(RUTA, ws), …)) y app/m/mako/subir.ts · REGLA: Todo XMLHttpRequest a /api arma la URL con conWs(ruta, useWs()). La regla «las llamadas a /api salen solas con el ?ws=» vale sólo para fetch. Lo fija tests/m-mako-chat.test.ts.
- **Mantener el mic para grabar una nota también arrancaba el dictado, o lo cortaba al soltar.** → Después de pointerdown/pointerup el navegador igual dispara click. Si el toque se resuelve en onClick y el mantener en los pointer events, el click de después de mantener cuenta como un toque. · app/m/mako/Composer.tsx (gesto.current.suprimirClick) · REGLA: Cuando un mismo botón tiene tocar y mantener, el temporizador de mantener marca que hay que suprimir el próximo click. El toque se resuelve SÓLO en onClick, que es lo que también cubre el teclado (Enter/Espacio).
- **Al soltar la nota de voz, el mensaje se manda solo, y en WhatsApp la regla de la casa dice «nada sale al soltar».** → No es una contradicción. La regla de WhatsApp protege un AUDIO que le llega a una persona. Acá lo que viaja es la transcripción, a MaKo, que sólo propone: toda acción se confirma en su tarjeta. · app/m/mako/Composer.tsx (comentario de cabecera) · REGLA: Si un día la nota de voz del chat sale como audio hacia afuera (a un lead o a un grupo), vuelve a valer «nada sale al soltar». Martín no lo confirmó: es una decisión de producto abierta. Offer del teléfono lo pagó el 16/10 (ver «La revisión de la tanda 2», arriba).
- **Un error de red o un corte por tiempo al mandar un turno invita a «Reintentar», y eso puede dejar dos acciones pendientes iguales y pagar el modelo dos veces.** → El route guarda el mensaje y corre el turno antes de contestar. Un 5xx, un status 0 o el corte a los 305 s pueden haber corrido el turno entero. · app/m/mako/chat-ui.ts (leerRespuesta / ERROR_INCIERTO) · REGLA: Sólo es reintentable un 4xx con su {ok:false,error}: el route lo devuelve antes de guardar nada. Todo lo demás se muestra como «No sé si llegó» con «Recargar el chat». Es el default de la casa: no reintentar lo que gasta.


### CRM
- **Ninguna lectura del CRM que viaja con React/Next corre en un script tsx: «Invariant: incrementalCache missing in unstable_cache».** → getJuntasProximas, getPendientesDeMarcar y listLeads son cachedRead (unstable_cache), que necesita el incrementalCache del server de Next. runWithWorkspace no alcanza. · lib/queries.ts:2512 y :2270, lib/leads.ts:359; lo encontré al probar lib/crm-movil.ts · REGLA: Para probar sin navegador, las funciones que no tocan cachedRead (fichaMovil, quietos) se llaman directo con runWithWorkspace. Lo que pasa por cachedRead se mide en Next real, o se llama a su _versión privada.
- **Un error de tipos «EtapaM[] no es asignable a readonly EtapaLite[]» al pasar las etapas de etapasDeProducto a etapaVigenteDe o pideWizardAlElegir.** → etapasDeProducto devuelve kind?: string|null y EtapaLite (lib/funnel-etapas.ts) acepta kind?: string, sin null. · lib/lead-funnel.ts:26 contra lib/funnel-etapas.ts:41 · REGLA: Se pasa por comoLite() (app/m/crm/reglas.ts). No se castea.
- **La lista de etapas a las que se puede mover viajaba al teléfono con colores, columnas y bandas de cada etapa.** → etapasDeProducto devuelve el objeto Stage entero aunque el tipo declarado sólo nombre key, label, kind, band y dot. · lib/lead-funnel.ts:26 · REGLA: Lo que va a un componente cliente se mapea a los campos que usa, como etapasMovibles en reglas.ts.
- **El chequeo de voseo marcaba «acá» en archivos nuevos, y un sed con \bacá\b no lo reemplazaba.** → \b es ASCII: no hay borde de palabra después de la á (la misma trampa que AGENTS.md documenta para las regex sobre español). · Al editar app/m/crm/* y lib/crm-movil.ts · REGLA: Los reemplazos en español se hacen con node y un string literal, o con (?<!\p{L})…(?!\p{L}). Nunca con \b en sed o grep.
- **Un heredoc de node -e con backticks se comió el texto del comentario del test sin dar error.** → En bash los backticks dentro de comillas dobles ejecutan comandos. · tests/crm-movil.test.ts, al editar el comentario de la rotura · REGLA: Los textos con backticks se editan con la herramienta Edit, o con un heredoc 'EOF' entre comillas simples.
- **Mover desde el teléfono a una etapa de reunión o de nutrición manual habría salteado la pregunta de la fecha o del plazo.** → setLeadStageAction «guarda SIEMPRE» y no valida nada. El wizard lo decide sólo el cliente de escritorio (pideWizardAlElegir). · app/crm/actions.ts:1129 · REGLA: La regla del teléfono (seMueveEnElTelefono) se vuelve a mirar en la server action. Esconder la etapa en la lista no protege nada. Lo fija tests/crm-movil.test.ts.


### Plan (pantalla)
- **leerPlanHoy devuelve la misma tarea en `prioridades` y en `semana`, así que en /m/plan aparecería dos veces** → hoyDelTablero le saca a `hoy` las tareas de prioridades, pero a `semana` no (dice textual «Todas, estén o no en prioridades»): está pensado para Today, que pinta prioridades+hoy · app/plan/board/hoy.ts (tipo HoyDelTablero.semana); se resuelve en app/m/plan/ListaPlan.tsx (el filtro `vistos`) · REGLA: Una pantalla que pinta las tres listas deduplica por id y gana la primera. Lo fija tests/movil-plan-formato.test.ts
- **Un check dentro de una FilaM con onClick sería un <button> dentro de otro <button> (HTML inválido, y el toque cae en el padre)** → FilaM con onClick renderiza la fila entera como <button>, y `leading` vive adentro · app/m/_ui/FilaM.tsx (rama p.onClick) · REGLA: Para una fila con un control propio a la izquierda Y que abre algo al tocarla: FilaM sin onClick (un div, que conserva el swipe) + un botón position:absolute;inset:0 adentro del título (z-index 1) + el control en z-index 2. El botón vive dentro de .m-fila__t (overflow hidden), pero su bloque contenedor es .m-fila (position relative), así que no lo recorta
- **Después de un swipe confirmado, la fila vuelve a su lugar un frame antes de irse** → FilaM llama a onAccion() y en el mismo tick hace mover(0). Un setState normal se pinta después · app/m/_ui/FilaM.tsx alSoltar → setTimeout(accion.onAccion(); mover(0)) · REGLA: Si el onAccion de un swipe saca la fila, la oculta de forma síncrona (flushSync) o la deja invisible antes de que FilaM la devuelva
- **Un script tsx que importa módulos del repo con path.join tira ERR_UNSUPPORTED_ESM_URL_SCHEME en Windows** → import() de una ruta absoluta C:/… se lee como un esquema de URL «c:» · scripts de diagnóstico del scratchpad (patrón de la tarea: imports dinámicos con path.join) · REGLA: En Windows los imports dinámicos van con pathToFileURL(p).href

## Un rol con hoja única del Dashboard: el teléfono preguntaba sólo por el closer (12/10/2026)

**Síntoma (cazado antes del deploy):** con el setter sumado al Dashboard (ve SÓLO la hoja Chat Analyst), los tests
del teléfono cambiaron solos: el setter ganaba «Dashboard» en More. **Causa:** `/m/dashboard` preguntaba
`ctx.rol === 'closer'` para darle su hoja; cualquier otro rol caía en la rama del ADMIN — Marketing, Comercial y las
hojas del informe, los números del negocio que su escritorio no le muestra. **La regla:** el teléfono pregunta por
`hojaDeRol`/`informeDeRol` (`HOJA_DE_ROL`, lib/graficos-plantillas.ts), igual que escritorio, y More saca la fila
si el negocio no tiene la tab de esa hoja (`capaDeHojaDeRol`, lib/graficos-roles.ts: `lib/movil-rutas.ts` va al
navegador en cada página y no puede importar las plantillas). Lo fija `tests/movil-dashboard-rol.test.ts` (probado
volviendo al chequeo del closer: 0/1). **Vive en:** `app/m/dashboard/page.tsx`, `app/m/dashboard/[hoja]/page.tsx`,
`lib/movil-rutas.ts`.

## El turno del teléfono, prestado a la ficha del lead (MaKo Analyst, 12/10/2026)

Pedido de Martín (12/10/2026, punto 19 del feedback del CRM): «Cambia el nombre de la tab "Análisis" por "MaKo Analyst"
y replica el chat que tenemos en la tab de "Offer", basicamente que sea un chat con la IA que por defecto tenga atado los
datos de ese lead, para eso tenemos una API de todo». No hay un motor nuevo: la pestaña corre el turno de MaKo Mobile
(`lib/mako-turno-app.ts`), que lee datos reales, propone acciones en tarjetas y deja que una persona confirme. Lo que no
se ve en el código:

- **El turno no tenía por dónde recibir contexto.** El system se armaba siempre con el mismo contexto vacío; para atarle
  un lead hubo que sumar `EntradaTurnoApp.contexto` (opcional), que va al FINAL del system —manda sobre la voz del
  teléfono— y **no se guarda en el hilo**: los datos de un lead cambian mientras se conversa, y guardados serían la foto
  del primer mensaje. Lo arma `contextoDelLead` en CADA turno, leyendo seis operaciones de la API de MaKo con el rol de
  quien pregunta (lo que su pantalla no le muestra, el chat tampoco), con un tope de 14.000 caracteres
  (`TOPE_CONTEXTO`) y diciendo lo que se cortó o no se pudo leer. Sin `contexto`, el turno es el de siempre para los
  demás llamadores.
- **La privacidad de ese chat es el PREFIJO de su clave.** Las sesiones van como `mako-movil:u5:lead:123` a propósito:
  con ese prefijo la lista de /mako (que es por workspace) no las muestra, y /api/chart-insights y /api/mako-doer
  contestan 404 a su id (`esSesionDelTelefono`, lib/chart-chats.ts). Con un prefijo nuevo, cualquiera del workspace las
  leía por id, y los ids son correlativos. El string vive en TRES copias (lib/chart-chats.ts,
  lib/mako-turno-app-reglas.ts, lib/mako-analyst-lead-reglas.ts) porque esos módulos no se importan entre sí sin traer el
  registro de la API; los atan `tests/movil-privacidad.test.ts` y `tests/mako-analyst-lead.test.ts`. **Regla:** un chat
  por persona nuevo sobre `chart_sessions` lleva ese prefijo, o no es privado.
- **Lo que se lee en CADA turno no puede ir a un tercero.** `reuniones_lead` quedó fuera de `LECTURAS_DEL_LEAD` porque es
  lenta y externa (le pregunta a Calendly en cada llamada) y correría en cada mensaje; las fechas de R1 y R2 con su
  asistencia ya vienen en la ficha y en el recorrido.
- El permiso es el de VER el CRM, no el de la tab MaKo: un closer que ve la ficha ve el chat. Lo decidió el frente, no
  Martín.

**SIN HACER:**
- «confírmalo en Inbox» en escritorio: ver «Lo que quedó sin hacer», arriba.
- No medido: si al releerse la ficha (app/crm/LeadSheet.tsx) la pestaña se desmonta mientras carga, el chat pierde el
  mensaje en curso. El historial no se pierde: vuelve del servidor.

**Vive en:** `lib/mako-turno-app.ts` (`EntradaTurnoApp.contexto`) · `lib/mako-analyst-lead.ts` ·
`lib/mako-analyst-lead-reglas.ts` (`chartKeyDelLead`, `LECTURAS_DEL_LEAD`, `contextoDelLead`) ·
`app/api/crm/analyst/route.ts` · `app/crm/lead-view/MakoAnalystLead.tsx` · `app/crm/lead-view/AnalystDelLead.tsx` ·
`lib/chart-chats.ts` · `tests/mako-analyst-lead.test.ts` · *2026-10-12 corrida crm-feedback-12-10 (frente E-analyst)*

## Un gesto horizontal que no arranca: el `touch-action` se corta en el contenedor con scroll (14/10/2026)

**Síntoma:** la Ticketera (el mazo tipo Tinder de `/tickets/decisiones`) «funciona bastante mal» en el teléfono. Medido con toques en Chrome (`Input.dispatchTouchEvent` con emulación móvil): la tarjeta no se movía (`transform: none` a mitad del gesto), y un deslizamiento largo hacía que la página NAVEGARA para atrás. Con el mouse andaba perfecto.

**Causa:** los eventos eran `pointerdown → pointermove → pointercancel`. La tarjeta tenía `touch-action: pan-y`, pero adentro hay un bloque con scroll propio (`.mazo-cuerpo`, `overflow-y: auto`), y el navegador calcula el touch-action de un toque sólo hasta el contenedor con scroll más cercano. Para un dedo sobre la pregunta, el valor efectivo era `auto`: Chrome se quedaba con el gesto horizontal, cancelaba el puntero y lo usaba como «volver».

**El diagnóstico obvio era el equivocado:** «la física escrita a mano anda mal» era cierto y no era todo. Se pasó a `motion` (la librería del gesto, ya en el repo) y SEGUÍA sin moverse con el dedo, porque la librería nunca recibía el movimiento.

**La regla:** en una superficie que se arrastra, el `touch-action` va también en cada contenedor con scroll que tenga adentro. Se prueba con TOQUES, no con el mouse: con el mouse no hay touch-action y todo anda.

**Y al simular toques por CDP, cada `dispatchTouchEvent` espera un cuadro:** un «tirón» de 70 px en 5 pasos salió a ~460 px/s y no cruzó el umbral de 500 px/s. Con 3 pasos midió 70 px en 52 ms (~1.300 px/s) y contó. Antes de culpar al umbral, mirar los `timeStamp` reales de los `pointermove`.

**Se descartó react-tinder-card:** hace `preventDefault` en `touchstart`, lo que mata el scroll de una tarjeta larga y los toques en las opciones.

**Sin medir:** un teléfono de verdad. Lo de arriba es la entrada táctil de Chrome; Safari en iOS no se probó.

**Vive en:** `app/tickets/decisiones/mazo.css` (`.mazo-cuerpo`) · `app/tickets/decisiones/Mazo.tsx` · `tests/tickets-decisiones-mazo.test.ts`

## La ficha del teléfono destila TODAS las tabs del escritorio, no sólo el Resumen (16/10/2026)

Leído al pie de la letra, «el teléfono sigue el Resumen de la ficha del funnel» dejaba a todas las plantillas sin
«Última llamada», que el teléfono tiene desde la v2: `lo-que-salio-de-la-llamada` vive en Reuniones en todas, y
una plantilla sin lista para una tab usa la del respaldo.

- **La regla:** el teléfono destila cada tab que ESE lead ve en escritorio, una debajo de la otra y en el orden de
  `FichaPorBloques`. Una pieza de otra tab sale sólo si esa tab sale para el lead (Reuniones por
  `tieneEtapaDeReunion` de SUS etapas, Tracking por `verTrackingDeLead`). Un bloque nuevo con versión de teléfono
  se suma a `PIEZA_DE_BLOQUE` y a la tabla del test.
- **Para mirar una pantalla de /m sin `next dev`:** esbuild con un stub del Link que exporte `useWs` y
  `WsProvider` (el index de app/m/_ui arrastra `SalirDeLaVista`), y un plugin que a todo archivo que empieza con
  'use server' le exporta una async vacía por cada `export async function`. Se compila con la máquina quieta, no
  durante un barrido.

**Vive en:** app/m/crm/ficha-bloques.ts (`piezasDelTelefono`, `tabsQueVe`, `PIEZA_DE_BLOQUE`) ·
app/m/crm/[id]/page.tsx · tests/m-ficha-bloques.test.ts ·
*16/10/2026, chat «CRM» (claude3), corrida wf_e3cc574c-723 (`cc6cf405b`).*

## General en el teléfono con varias hojas: la URL ya traía la hoja, faltaba con qué elegirla (17/10/2026)

**Síntoma (#872, llamada Mau <> Martín del 16/10, 33:14):** Mauricio creó plantillas de General y en su celular sólo
veía una hoja, sin forma de pasar a la otra. La portada del teléfono dibujaba `tablero.hojas[0]` (app/m/hoy/page.tsx).

- **No hizo falta una ruta nueva:** el teléfono abre /general con la MISMA URL que la computadora y el desvío la
  reescribe a /m/hoy con la query ENTERA (`urlReescrita`, lib/movil-desvio.ts). Así que `/general?hoja=<id>` —el link
  de escritorio— llega al teléfono con su hoja; sólo faltaba leerla y ofrecer las otras.
- El selector es el `SegmentadoM` de la casa con un link por hoja (la página es de server). ⚠️ El segmentado reparte el
  ancho en partes iguales: con más de tres hojas los nombres se cortaban, así que ahí cada botón mide su nombre y la
  fila se desliza de costado (`HOJAS_SIN_DESLIZAR`, app/m/hoy/modelo.ts).

Test: tests/m-hoy-hojas.test.ts (probado rompiéndolo). **Nadie lo miró en un teléfono.** Después del deploy: ws3 con dos
hojas de General, abrir hola-mako.com/general en el celular y tocar la segunda.
**Vive en:** app/m/hoy/page.tsx · app/m/hoy/modelo.ts · app/m/hoy/hoy.css.
*17/10/2026, claude4 (chat Dashboard).*

## Una hoja en «medio» no deja ver el final de su cuerpo (17/10/2026, lo halló el Ops Center)

**Síntoma:** Martín, en «Uso y Runners» del Ops Center: «esa sección se traba y no se puede scrollear hasta el final».

**Causa:** SheetM (app/m/_ui/SheetM.tsx) mide el panel con el alto de «alto» y en «medio» lo CORRE hacia abajo
(`translateY(hPanel − hMedio)`). El cuerpo scrollea dentro de ese panel, así que al llegar al fondo lo último queda debajo de la
pantalla. El pie sí se compensa (sube lo mismo); el cuerpo no. Desde el cuerpo el gesto sólo baja la hoja (cerrar), nunca la
sube a «alto»: sin agarrar la manija no hay forma de ver el final. Lo obvio era «un contenedor con alto fijo o un overflow
hidden» y no era eso.

**Arreglo hecho:** esa hoja abre en `snap="alto"` (app/m/operaciones/CentroAppMovil.tsx).

**Sin hacer (es de SheetM, para todas):** en «medio», sumarle al cuerpo un `padding-bottom` igual al corrimiento (el mismo
número que ya se usa para el pie), o subir a «alto» cuando el cuerpo llega al fondo. Toda hoja que abre en «medio» con un
cuerpo más largo que el 55% de la pantalla tiene el mismo defecto.


## More y la barra de abajo con la sidebar del prototipo (17/10/2026, noche)

- **More cruzaba las familias de la sidebar por POSICIÓN.** `masCompleto` hacía `FAMILIAS_MAS[i]` para la familia `i`
  de nav.ts. Con dos familias daba igual; con cuatro (lo diario · Sales · Marketing · Create) una lista más corta dejaba
  afuera a las últimas **sin ningún error**: Create desaparecía del teléfono y ningún test lo veía, porque todos miraban
  las dos primeras. Ahora se cruzan por la KEY y un test fija que `FAMILIAS_MAS` tenga las mismas keys y nombres que
  nav.ts. **Regla:** dos listas paralelas se cruzan por id, nunca por índice.
- **«Hoy no se ve la foto» no era la foto: era `AvatarM`.** La foto vive en `usuarios.foto_url` (la lee `leerPerfil`), no
  en la sesión. Escritorio la pedía a /api/perfil; el teléfono armaba la cara con `ctx.sesion`, que no la tiene, y
  `AvatarM` ni siquiera aceptaba una foto: dibujaba iniciales siempre. Ahora `AvatarM` acepta `foto` y quien la pasa
  decide si es SUYA (`leerPerfil().vista.deOtro`: mirando a un cliente, la foto no es la de quien mira).
- **El lugar del medio se llama Dashboard y abre la portada de siempre.** En escritorio, General pasó a ser la hoja fija
  Focus del Dashboard; en el teléfono el destino `hoy` (/m/hoy) se renombró a Dashboard y su id quedó (lo usan los
  badges, la campana y la cabecera). Las hojas (/m/dashboard) marcan ese mismo lugar de la barra y siguen como fila
  «Dashboard sheets» de More, para no repetir el nombre.

**Sin hacer:** que la portada (/m/hoy) tenga las hojas adentro, como Focus en escritorio, y quitar la fila «Dashboard
sheets» (jefe «Dashboard»). La barra de abajo flotante con el activo en píldora del prototipo (es del shell). Ninguna de
estas pantallas se miró a 390 px en un navegador: lo fijan los tests.

**Vive en:** `lib/movil-rutas.ts` (FAMILIAS_MAS, DESTINOS_MOVIL, `masCompleto`, `destinoActivo`) · `app/m/mas/page.tsx` +
`mas.css` · `app/m/_ui/Piezas.tsx` (`AvatarM`) · `app/m/layout.tsx` + `app/m/_ui/ShellM.tsx` (la foto de la cabecera) ·
test: `tests/sidebar-nueva.test.ts`

## KanbanM con la familia de tarjetas: las etapas con nombre, y su «Mover a…» se pide desde afuera (17/10/2026)

- **KanbanM es de los tres tableros del teléfono (CRM, Clientes, Plan):** tocar `app/m/m.css` (`.m-kb__*`, `.m-kb-tj`) los
  cambia a los tres. Se cambió a propósito: la barra de etapas pasó de rayitas con un número a pestañas píldora con el
  NOMBRE y el contador (había que adivinar qué etapa era cada raya), y la tarjeta base y la columna a la familia (22 y 26
  de radio, sombra suave). Sin colores hex en m.css: todo con `color-mix` sobre los tokens (lo frena tests/movil-shell).
- **`pedirMover`** (prop nueva): abre el MISMO «Mover a…» del toque largo desde afuera (la ficha rápida del CRM), con su
  toast y su deshacer. Mover por la acción directo habría duplicado las dos cosas y la marca optimista del tablero.
- **El CRM del teléfono cambió de gesto:** tocar una tarjeta abre la ficha rápida (en su SheetM, con historial y gestos);
  «Abrir ficha» lleva a la completa. Antes tocar abría la completa.

**Vive en:** app/m/_ui/KanbanM.tsx · app/m/m.css · app/m/crm/TableroCrm.tsx · *17/10/2026 noche, chat «CRM» (claude4).*

## «Abrir en la computadora» dejaba el teléfono 12 h en la versión de escritorio, sin vuelta (20/10/2026)

Martín, desde su Android: «Veo MaKo mobile roto, como si estuviera en desktop, solucionalo». La captura mostraba la
barra de escritorio y Configuración del negocio › General (Horario, Criterio de reuniones).

- **El desvío estaba bien; lo obvio era buscar ahí y no era eso.** `pedidoMovil` con un UA de Android y sin cookie
  reescribe todo a /m.
- **La causa era la cookie de vista.** «General» no tiene pantalla en el teléfono; su fila abre la hoja «Abrir en la
  computadora», que ponía `mako_vista=escritorio` por 12 h para TODA la app. `cookieVistaMovil()` existía pero nadie
  la llamaba, y una ruta /m con la cookie puesta va al escritorio. Una sola fila «En la computadora» dejaba a la persona
  sin MaKo Mobile medio día.
- **La regla que queda:** «Abrir en la computadora» abre UNA pantalla. La cookie guarda la ruta
  (`escritorio:/configuraciones`), y el proxy y el server deciden con la ruta (`vaAMovil(d, vista, pathname)`; el
  server la lee de `x-mako-ruta`, que pone sólo el proxy). Cualquier otra ruta vuelve al teléfono. `escritorio` a
  secas sigue siendo toda la app («Versión de computadora» de More).
- **Y siempre hay vuelta:** un teléfono en la versión de computadora ve «Volver al teléfono» fijo abajo
  (app/_components/VueltaAlTelefono.tsx), que borra la cookie y recarga la misma URL.
- **Trampa de la navegación interna:** el layout raíz no se vuelve a pedir en una navegación de cliente, y ése ya decidió
  «computadora». Con la cookie de una pantalla, al salir de esa ruta la vuelta recarga la página entera para que el proxy
  decida de nuevo. Si no, la página del teléfono se dibujaba adentro del cromo de escritorio.

**Sin hacer:** General (Horario y Criterio) no tiene pantalla en /m. La regla de MaKo Mobile es toda tab en el teléfono
(lib/movil-rutas.ts, la nota de `SECCIONES_NEGOCIO_M`).

**Vive en:** `lib/movil-dispositivo.ts` (`vistaEscritorioEn`, `cookieVistaEscritorio(ruta)`) · `proxy.ts` ·
`lib/movil-guard.ts` (`prefiereMovil`, `vistaEscritorioEnTelefono`) · `app/layout.tsx` ·
`app/m/_ui/EnComputadoraM.tsx` · test: `tests/movil-vuelta-telefono.test.ts`

## Nada que traiga .css adentro de ShellM: el índice de app/m/_ui lo reexporta (20/10/2026)

**Síntoma:** tests/m-offer.test.ts cayó al cargar con `SyntaxError: Unexpected token '.'` en
app/admin/operaciones/criatura.css, sin que nadie tocara Offer. **Lo obvio era lo equivocado:** no había un error de
sintaxis ni en m-offer ni en lo que importa directo. La entrada de MaKo al abrir la app (EntradaMako → CriaturaMako →
Criatura → criatura.css) se había montado en ShellM, y `app/m/_ui/index.ts` reexporta ShellM: todo test que importa algo
de `@/app/m/_ui` (HojasOfferM lo hace) arrastraba el .css. **Regla:** lo que trae CSS no se IMPORTA directo en ShellM:
o se monta en app/m/layout.tsx, o se carga diferido con `dynamic(() => import(…))` (así quedó la entrada el 21/10, run
182). Lo fija tests/movil-entrada.test.ts.

*20/10/2026, chat «Onboarding» (claude4).*

## Dos ramas hicieron el mismo pedido, y al juntarlas el teléfono mostraba DOS entradas de MaKo (21/10/2026)

**Síntoma:** al mergear main en onboarding-v3, el VERDE cayó en tests/movil-entrada.test.ts («ShellM no monta la
entrada»). El test no estaba roto: ShellM ahora SÍ montaba una entrada. Martín había pedido lo mismo dos veces, el 18/10
(punto 2) y el 21/10 (pedidos del Ops Center 91ebee6f y e180365d), y dos chats lo hicieron por su lado:
- onboarding-v3: EntradaMobile, en el layout, con un script antes de pintar.
- main: en ShellM, diferida, que vuela a la criatura de la barra y arranca en `false` (no se pinta en el server).

Juntas, salían dos seguidas. **Lo obvio era «arreglar el test»**: lo que había que arreglar eran dos implementaciones del
mismo pedido. Quedó la de main, porque es la más nueva, sale del pedido literal del 21/10 y no tiene el problema del
server. La de onboarding-v3 se fue. Quedó UNA clave de sessionStorage (`CLAVE_ENTRADA_MOVIL`, app/m/_ui/entrada.ts),
que leen ShellM y el final del onboarding, para que quien termina el onboarding en el teléfono no la vea dos veces.
**Regla:** un test que «se rompe» porque otro chat hizo lo mismo no se ajusta: se elige UNA implementación y se borra la
otra. Antes de hacer un pedido de Martín, `git log origin/main --grep` con sus palabras: puede estar hecho.

*21/10/2026, chat «Onboarding» (claude4).*

## `/.well-known` daba 307 a /login: ni la TWA de Play ni los links universales de iOS podían andar (22/10/2026)

Paso 1 del plan de las tiendas (C:/dev/cerebro-herramientas/tiendas-play-appstore.md). Android verifica la TWA leyendo
`https://hola-mako.com/.well-known/assetlinks.json` e iOS los links universales con `apple-app-site-association`, los dos
SIN sesión. El matcher de proxy.ts no los eximía y la lista de extensiones no lleva `.json` a propósito (hay endpoints
`.json` que sí van con sesión): el teléfono recibía la página de login y daba la app por no verificada, sin error.

- **Ahora:** `public/.well-known/` con los dos archivos (vacíos y válidos: `[]` y `{"applinks":{"details":[]}}`), el matcher
  saltea `\.well-known/`, la ruta está en PUBLICOS por si el matcher cambia (sólo se lee), y next.config le pone
  `Content-Type: application/json` al de Apple, que va SIN extensión y Next lo serviría como binario.
- **El punto del matcher va escapado**, como el de `favicon\.ico`: suelto, `/xwell-known/gracias` (un slug válido de
  hola-mako.site) quedaba fuera del proxy y su landing daba el 404 de la app. tests/well-known-publico.test.ts compila
  el matcher como Next y lo prueba con slugs parecidos.
- Se sirve en CUALQUIER host, también en el dominio de una landing de un cliente: no hace daño, porque la app sólo
  declara hola-mako.com.
- **Sin hacer:** las huellas reales. Van DOS en `assetlinks.json` (la de subida de Bubblewrap y la de Play App Signing),
  y la segunda existe recién después del primer AAB: este archivo se toca dos veces. El de Apple lleva el Team ID y el
  bundle id cuando exista la cuenta.
- **Medido en producción el 22/10 (tren 3, b6192722b):** los dos dan 200 sin `Location` (assetlinks.json como
  `application/json; charset=utf-8`, el de Apple como `application/json`), y `/xwell-known/gracias` sigue pasando por el
  proxy (307 a /login en hola-mako.com).

**Vive en:** proxy.ts (`config.matcher`) · lib/rutas-publicas.ts (`PUBLICOS`) · next.config.ts · public/.well-known/ ·
tests/well-known-publico.test.ts · *22/10/2026, chat «Chats de las tabs», por pedido del Cerebro.*

## Entrar a la cuenta de otro desde /m: recarga entera, nunca un Link (26/10/2026)

- **Síntoma (revisión del tren, b26a8ac40):** en el teléfono, «Entrar a su cuenta» de Customers abría el negocio del
  cliente sin el chip «Viendo a X», con la barra y los avisos del super admin.
- **Causa:** era un `ButtonLink`, que navega del lado del cliente. El proxy manda `/inicio?ws=N` a
  `/m/second-brain?ws=N` y, como el árbol viejo y el nuevo comparten el segmento `m`, **app/m/layout.tsx no se vuelve a
  ejecutar**. Ese layout es el que arma `contextoMovil`: el chip, la barra del cliente y sus badges.
- **Regla:** todo botón que cambia el negocio que se está mirando (entrar o salir) va con
  `window.location.href = ...`, como AgencyM y PartnersApp. Un test fija que Customers no vuelva al Link
  (tests/customers.test.ts).

**Vive en:** app/m/customers/CustomersM.tsx · app/m/layout.tsx (`contextoMovil`) · *26/10/2026, chat «Agencias y
clientes» (claude5).*

## La fila «Video» de More abría el Video Generator, no el editor (29/10/2026, claude3)

- **Síntoma:** al dejar Video como UNA pantalla (el editor) en escritorio, el teléfono seguía abriendo /m/video, la lista de
  anuncios del Video Generator, con su key `video-generator`.
- **Causa:** en `SECCIONES_MAS` (lib/movil-rutas.ts) la fila de una tab unificada lleva la key y la ruta de la sección que
  el teléfono eligió mostrar, no la de la tab. Al cambiar la tab de escritorio, la fila no se entera.
- **Regla:** cuando una tab de escritorio cambia de forma, la fila de More se revisa a mano: `href` y `navKey` de la
  pantalla que la tab abre ahora. Lo que deja de ser la entrada (el Video Generator) queda como fila OCULTA en
  `SECCIONES_CREACION` (lib/movil-creacion.ts), con su key en `SIN_FILA` de nav.ts: sin el ítem, `requireMovil` cierra
  en silencio.

**Vive en:** lib/movil-rutas.ts (`SECCIONES_MAS`) · lib/movil-creacion.ts · tests/m-creacion.test.ts

## Cerrar una hoja y navegar en el mismo toque perdía la navegación, siempre (ticket #27, 29/10/2026)

- **Síntoma:** Joan (ws13, una agencia) en el CRM del teléfono de su cliente Natalia: «toco ahí en "Venta Props" para
  cambiar, y no hace nada». La hoja «Funnel» se cerraba y el tablero seguía en «Funnel principal». Siempre.
- **El diagnóstico obvio era el equivocado, dos veces.** (1) «Natalia» no es un lead: es el chip del negocio que mira la
  agencia (ws19). En ws13 no hay ningún «Venta Props»; está en ws19 (funnel 41, activo, 5 leads). Medir sobre el ws del
  ticket no lo encontraba. (2) El `?funnel=` NO se pierde en el reescrito de `/crm` a `/m/crm`: `rutaMovil('/crm?…')`
  devuelve `/m/crm` pelado, pero el proxy arma la URL interna con la query ORIGINAL entera (`urlReescrita`).
- **Causa:** el renglón hacía `setElegirFunnel(false); router.push(url)`. El push queda en curso (pide la página al
  server). Cuando React dibuja la hoja cerrada, SheetM saca su `?sheet=` con `replaceState`. Next 16 parcha
  `window.history` (app-router.js): un `replaceState`/`pushState` sin `__NA` se despacha como **ACTION_RESTORE**, y un
  RESTORE **descarta** la navegación en curso (app-router-instance.js: «Navigations (including back/forward) take
  priority over any pending actions»). El comentario de SheetM («replaceState y NO back()») salvaba del `back()`
  asíncrono, no de esto, y el del renglón decía «es seguro». Lo mismo rompía «Abrir ficha» desde «Ver info», la ficha
  de un lead recién creado (onCreado y onAgregado), el «Lead» de una decisión de la Bandeja y el Calendario (guardar un
  evento fuera de lo leído cerraba la hoja y navegaba: el evento se creaba y no se veía). Al Calendario lo encontró el
  barrido del test, no la lectura.
- **Regla:** cerrar una hoja y navegar en el mismo toque va con
  `setAbierta(false); navegarAlCerrar(() => router.push(url))` (app/m/_ui/hoja-historial.ts): la navegación espera a
  que ESA hoja suelte su URL y sale después del RESTORE (una navegación nueva gana, no al revés). Sin hoja abierta,
  navega ya; un gesto la tira (su `back()` la desharía igual); al desmontarse la hoja, sale; una apertura nueva tira la
  que quedó. Un test barre app/m para que nadie vuelva a escribir `set…(false); router.push(` pelado.
- **No medido en un teléfono:** leído en Next 16.2.6 y reproducido con el historial real de las hojas contra la regla de
  la cola (tests/m-hoja-navegar-al-cerrar.test.ts, que también lee la regla de node_modules). No se pudo abrir la app
  local (escribe en producción). Cuando suba: elegir «Venta Props» en el CRM del teléfono de ws19.

**Vive en:** app/m/_ui/hoja-historial.ts (salió de SheetM.tsx tal cual) · app/m/crm/TableroCrm.tsx ·
app/m/inbox/InboxM.tsx · app/m/calendario/CalendarioM.tsx · *29/10/2026, chat «CRM y Chats» (claude3), hotfix `hotfix-ticket27-2910`.*

## Lo que no se veía de la app de las tiendas: el teléfono vendía, y borrar un negocio no borraba todo (3/11/2026)

Los pasos del plan de las tiendas, medidos contra el código. Estado y fuentes: [tiendas-play-appstore.md](tiendas-play-appstore.md).

- **El «hecho cuando» del plan no medía nada.** Decía `git grep` de checkout, Stripe o MercadoPago en `app/m`, y daba limpio con el teléfono vendiendo: «Tu plan» abría el pago con `window.location.href = r.link`, Agency con `href={c.cobro.pagar}`, y los carteles de la prueba, More, Equipo, `/no-esta-en-tu-plan`, `EmpezarPlanYa` y `/cuenta-pausada` lo ofrecían con otras palabras. **Regla:** una guarda de esto busca lo que se le OFRECE a la persona, no el nombre de la pasarela (`tests/tiendas-telefono-no-vende.test.ts`). Y varias pantallas de escritorio también se abren en el teléfono: la guarda de `app/m` no las ve.
- **`eliminarWorkspace` no borraba los archivos**, aunque su cabecera lo prometía: `vaciarTablas` sólo toca tablas. Tampoco cortaba el WhatsApp en Evolution ni la voz clonada en ElevenLabs; eso lo hacía sólo el reset del negocio de prueba. Con «Eliminar mi cuenta» eso era prometerle a Apple un borrado que no pasaba. **Regla:** las dos salidas comparten `cerrarLoDeAfuera` y `borrarArchivos`, y lo de afuera va ANTES de vaciar, porque sus ids viven en las tablas.
- **Pedirlo no borra.** Un toque apaga la cuenta y deja la marca; borra el super admin, con el nombre escrito a mano. Y el negocio de prueba anota sin apagar nada: si no, un revisor toca el botón y el siguiente ya no entra.
- **La puerta del permiso de IA no podía ir en `conD6bDelPedido`, la puerta obvia:** el turno entra con `entrarSoloSuIA` y la saltea. Va antes, en cada función pública de la capa, y en `turnoApp`, porque el turno también sale por la PC del cliente, que no pasa por ninguna.
- **`a.click(); URL.revokeObjectURL(url);` en la misma línea** es lo que hace casi todo el repo, y en WKWebView `<a download>` no anda. Un `fetch` del blob llega tarde. **Regla:** `lib/nativo.ts` guarda el blob al crearlo y parcha `click` adentro de la app. Un `<a download>` nuevo ya está cubierto.
- **Lo que encontró la revisión adversarial, y ningún test veía.** (1) Un `<div>` de menos en `PostM.tsx` rompía el build entero: los tests leen el texto, no parsean. Ahora parsean todo `app/m`. (2) Quedaba un cartel de pago, en el layout raíz: `sinCartel` mira `esVistaSinChrome`, y con LAS MISMAS RUTAS un teléfono dice `/crm`. (3) `avisarDePlataforma` no tira: devuelve `enviado`, y los `.catch` no veían nada. (4) El borrado no llegaba a `chats-email`, `lead-notas`, `portadas` ni a las fotos de los contactos, y un error de `list` se leía como «no hay archivos». (5) `borrarVoz` corría con la clave de quien llama, no la del negocio (BYOK): daba 404, y eso se lee como «ya no estaba». (6) Dos admins: lo que uno confirmó («tu negocio sigue») no era lo que se ejecutaba. **Regla:** el POST de algo irreversible manda lo que la persona leyó, y si cambió da 409.
- **La puerta del permiso no va en la clave:** en `elevenKey` frenaba también a quien quería BORRAR su voz clonada. Va donde sale algo al proveedor. Y `embed` frenado es «sin con qué»: si tira otro error, `embedRow` deja la fila en error.
- **Un test le mandó un pedido de verdad a Apple** (claves de prueba, token inventado; contestó 403 y no llegó a nadie). El JWT vivía en la misma memoria que las claves, así que firmar «de paso» las dejaba cargadas para el siguiente `clavesApns()`. Son dos memorias. Y una guarda probada rompiéndola no debe tocar esa rama.
- **Las roturas que el test no vio dijeron más que las que vio.** Tres: «More deja pasar Agency» (con el super admin esa fila no sale), «un trozo que no es múltiplo de 3» (el mock decodificaba de a trozos) e «instalarDescargas sin preguntar» (la tapaba otra pregunta).
- **Para probar `headers()` afuera de Next** hace falta `globalThis.AsyncLocalStorage` ANTES de cargar los storages, y correr adentro de `workAsyncStorage` y `workUnitAsyncStorage`: `tests/_ia-permiso-hijo.ts`. Un control que lee el user agent de vuelta evita medir «sin pedido» sin querer.
- **Las filas de APNs no tocaron la tabla:** `endpoint` es `apns:<token>`, y `p256dh`/`auth` llevan una marca. Una columna `tipo` en el `SELECT` de `enviarPush` habría dejado sin avisos a todos si el deploy llegaba antes que el cambio en la base.
- **Cada tienda tiene otro titular** (3/11, Martín: «Sí, a propósito»): Apple a nombre de Leandro Tejado y Play a nombre de Martín. Las páginas legales nombran a `RAZON_SOCIAL_MAKO`, que coincide con Apple y no con Play: el plan lo pone primero.
- **El ws3 no tiene IA:** el revisor entraría a un chat que contesta «No hay ninguna IA conectada» (riesgo R14).
- **La excepción de 2FA vive en la rama `tiendas-revisor-0311`**, sin subir: `lib/mfa-reglas.ts` (`esCuentaDeRevision`), con su fila revisada en cada pedido y su rastro antes de dar la sesión.

**Sin hacer:** el `.aab` (`nativo/android`, pide aceptar los términos del Android SDK y una ventana de RAM) · correr `scripts/tiendas-cuenta-revision.mts` después de la revisión · mirar en TestFlight guardar, links, push y modo avión · un `href` con `?download=1` sin el atributo `download` (`app/crm/lead-view/ficha/pagos/bloques-deal.tsx`) puede no bajar en WKWebView · las capturas y el feature graphic · bloquear y moderar desde el teléfono, para volver a sumar Community a iPhone · que MaKo no cite precios en el chat dentro de la app: su contexto no distingue · `textoTope` (`lib/topes-plan.ts`) todavía dice «Pasa a MaKo Pro» sin link en pantallas del teléfono: sólo le sale a quien paga por la pasarela al llegar a un tope, no a la cuenta de revisión · `enviarApns` abre una conexión por aviso, y Apple prefiere una compartida: con pocos iPhones no molesta, y con muchos hay que compartirla · sin las claves de VAPID tampoco sale APNs (`enviarPush` corta antes): hoy están.

**Vive en:** lib/tienda.ts · lib/baja-cuenta.ts · lib/ia-permiso.ts · lib/nativo.ts · lib/push-apns.ts · scripts/tiendas-asociar.mjs · *3/11/2026, chat «tiendas», claude5.*

---

## «Me saca el botón de audio» y el campo que flota: dos cosas en un ticket (#51 de Leandro, 4/11/2026)

**El micrófono.** El botón de la caja es UNO (Martín, 17/10): micrófono sin nada, flecha con algo. Un adjunto lo volvía flecha, y quien quería
explicar una captura hablando no podía. Mostrarlo no alcanzaba: cada pantalla manda su nota por su camino (`voz`, `onGrabada`) y lo adjuntado
se queda en la caja, así que MaKo habría contestado el audio sin ver la imagen. **La salida no toca ningún motor:** con lo adjuntado, esa nota se
transcribe y sale por el `onMandar` de la pantalla, el que ya lleva texto y archivos juntos. Es una sesión aparte en `Caja`, y la arranca sólo el
micrófono de al lado de la flecha. Lo que se pierde: en ESE mensaje no queda el audio para escuchar, sólo lo que se entendió.

**El campo que flota (captura IMG_2572).** El diagnóstico obvio es «falta medir el teclado», y faltaba, pero no alcanza: **con la pantalla ya corrida
por Safari, `altoTeclado` da 0.** Por eso `tecladoDelComposer` separa lo que hay que subir (`corrimiento`) de si el teclado está (`abierto`, por lo que
le falta a la pantalla visible). Y lo que se veía por debajo no era un error de capas: el teclado de iOS 26 tiene una barra translúcida (^ v ✓), y se ve
pasar lo que haya atrás. El fondo del composer se extiende por debajo.

**La regla:** un composer pegado abajo en /m mide el teclado con `tecladoDelComposer`, y su fondo sigue por debajo. Una caja nueva sale de `CajaChat`.

**Sin hacer:** `VistaAdjuntos` (la vista previa a pantalla completa: Offer en el teléfono, los hilos de `ChatHilo`) sigue sin micrófono.
**No se pudo ver:** nada de esto se probó en un iPhone: el teclado de iOS no se reproduce sin el teléfono.

**Vive en:** `Caja` (app/_chat/CajaChat.tsx) · `micAlLadoDeLaFlecha` (lib/centro-caja.ts) · `tecladoDelComposer` (app/m/mako/chat-ui.ts) ·
app/m/chats/[clave]/ComposerChatsM.tsx · tests/caja-nota-con-adjuntos.test.ts.

---

## Montar una pieza de escritorio en /m: lo que NO viaja con ella (6/11/2026)

Competitor Spy en el teléfono (`app/m/competitor-spy`) se escribió REUSANDO los componentes de `app/competitor-spy`,
como /m/ads reusa el árbol del Media Buyer. Lo que costó no es el reuso: es lo que el componente da por sentado de la
pantalla que lo monta.

- **El CSS no viaja con el componente, y no se nota hasta que se ve.** Montar `TarjetaPieza`, `GrillaPiezas` o
  `MejoresPiezas` fuera de `SpyApp` las deja SIN una sola regla: el catálogo queda como texto suelto, sin grilla y sin
  miniaturas recortadas. **El diagnóstico obvio era el equivocado** —el relevo decía «cada componente de Spy trae su
  propio CSS en un `const CSS` con `<style>{CSS}</style>`»— y es verdad de SEIS de ellos (`GraficoSpy`, `DetallePieza`,
  `SuOferta`, `Esqueletos`, `BuscadorAlta`, `SusPaginas`); el resto vive en el `const CSS` de 39 KB de
  `app/competitor-spy/SpyApp.tsx`. **Regla:** antes de montar una pieza de escritorio en /m, `grep '<style>{CSS'` en ESE
  archivo; lo que no lo trae se viste en la hoja de /m, como DESCENDIENTE del prefijo entero de la carpeta
  (`.m-competitor-spy .spy-pcard{…}`), que además es lo que permite destilarla —una columna, no cinco— sin tocar la
  computadora. No alcanza con mirar si el componente «se ve bien» en la computadora: ahí lo viste su página.
- **Los tokens de color de una tab viven en SU clase raíz.** `.spy` declara `--t1..--t4`, `--t-ink`, `--t-dim`, `--ig`,
  `--yt` y `--gap`, y los usan la tarjeta de pieza (el tinte por canal) y el buscador de alta. Fuera de `.spy` resuelven
  a NADA (un `var()` sin valor no es un error: es nada), así que la raíz de la pantalla de /m los declara de nuevo. Y
  ⚠️ `@keyframes spy-latido` está declarado DOS veces en SpyApp, con definiciones distintas: un keyframe es global y no
  se puede acotar a una clase, así que /m usa un nombre propio y se lo pone al elemento, en vez de declararlo otra vez.
- **Una pieza que es dueña de su CAJA necesita que la caja sea una prop.** `DetallePieza` ERA un `Modal` de
  `@/app/_ui/Modal`, que /m no usa (AGENTS.md). Se le abrió UNA puerta, `marco` (`MarcoDetalle`): el `Modal` sigue
  siendo el default y el teléfono le pasa su `SheetM`. Es uno de los DOS cambios que necesitó el escritorio (el otro,
  `columnas`, en la entrada de acá abajo); copiar la pieza habría duplicado el guion, «Hacer uno así» y sus números.
- **Un `!important` arregla lo que se VE y deja intacto lo que se CUENTA.** `GrillaPiezas` escribe
  `grid-template-columns` en el estilo EN LÍNEA con las columnas que mide (dos a 390 px) **y pagina con ese mismo
  número** (`porPagina = columnas * FILAS_POR_PAGINA`). Un estilo en línea le gana a cualquier clase, así que **el
  diagnóstico obvio era el equivocado**: la hoja de /m forzaba la columna única con `!important`, la galería se veía
  de una tarjeta por fila… y cada página seguía trayendo seis tarjetas, el doble de miniaturas que bajar con datos en
  un teléfono. Un `!important` no es una opinión sobre el layout: es el aviso de que alguien calculó un número, lo
  escribió en el estilo en línea y lo está usando para algo más. **Regla:** cuando un número del componente gobierna a
  la vez el CSS y una cuenta, la pantalla que lo monta lo PIDE por prop —`columnas?: number`, con el cálculo de siempre
  como default, igual que `marco`— en vez de taparle el estilo en línea. Cerrado el 6/11/2026: /m pasa `columnas={1}`,
  la hoja ya no declara columnas y el escritorio quedó igual (tests/spy-telefono-una-columna.test.ts). Y la cuenta hacia
  el otro lado: una página del teléfono son ahora **tres** tarjetas (1 × `FILAS_POR_PAGINA`); si eso es demasiado poco
  para un pulgar, lo que se sube es `FILAS_POR_PAGINA` o una prop `filas`, no las columnas.
- **`MejoresPiezas` se dibuja en `position: absolute` para no sumarle alto al riel**, y mide el hueco que quedó. En una
  columna sola eso es 0 y la tarjeta no se ve: su salida es `--mejores-fluye: 1`, que el componente pregunta por CSS
  (`getComputedStyle`), y la declara quien lo monta.
- **Y un componente que ESPERA una lectura no se puede montar sin ella.** `SuOferta` con `vista={undefined}` dibuja
  el bloque con lo que ya hay guardado —parecía justo lo que el teléfono necesita— y, al lado, un `EsqueletoPuntaje`:
  su `leyendo` es `!vista || vista.estado === 'leyendo'`, así que sin la lectura queda un loader PUESTO PARA SIEMPRE
  («una espera que no termina no es un loader», AGENTS.md). Se destiló a las filas clave → valor de /m, con los MISMOS
  cuatro rótulos. **Regla:** antes de montar una pieza con `vista`/`estado`, se mira qué dibuja con el valor que /m le
  va a pasar de verdad, no el que tiene en la computadora.
- **`estadoDeResultados` (lib/spy-vista.ts) no sirve para una pantalla que no LEE.** Con `lecturas: null` —lo que tiene
  quien sólo muestra lo ya leído— devuelve `'cargando'` a propósito (sin la lectura en la mano no se puede afirmar «no
  hay»), y eso en pantalla es un esqueleto que no termina nunca. Lo que /m sabe es `mirado_en`: leído y vacío, o nunca
  leído. **Regla:** una función que decide un estado a partir de una lectura es de quien hace la lectura.

**Lo que quedó SIN hacer, con el archivo donde vive:**

- **La primera lectura de un competidor sigue siendo de la computadora.** `app/m/competitor-spy/page.tsx` NO llama a
  `debeLeerAlAbrir`/`revisarAction`: abrir una ficha vieja en el teléfono no dispara la lectura que paga Apify y YouTube
  con la clave del negocio, porque eso es una decisión de producto (y arrastra la película de la lectura,
  `app/competitor-spy/OrdenSpy.tsx`, que no está montada). Mientras tanto, la ficha de alguien sin nada leído lo DICE.
- **El diagnóstico de su oferta nota por nota** (el analista de Offer, `/api/competitor-spy/oferta`) no se pide desde el
  teléfono por lo mismo: es una corrida de IA del negocio disparada por abrir una pantalla. El teléfono muestra lo que
  la IA ya dejó escrito en `spy_competidores.oferta` (`SuOferta` con `parte="cabeza"`).
- **Guardar un anuncio pegado y dejar de mirar a un competidor** quedaron en la computadora (se dicen en la fila
  `ComputadoraM` de `app/m/competitor-spy/SpyM.tsx`), igual que replicar su sitio y el recorrido con la extensión, que
  son los dos que el diseño manda decir (docs/diseno-competitors-spy.md §8).
- **El riel de análisis** («¿En qué publica?» y «A dónde manda») no está: `RielAnalisis`/`CajaMix` no se exportan de
  `SpyApp.tsx`, y sacarlos de ahí era mudar dos componentes más.
- **Nunca se vio en un teléfono de verdad.** Lo medido a 390 px es lo de la computadora (`GraficoSpy`, el detalle y
  «Copiar estructura»: docs/relevo/nube-spy.md); la columna de esta pantalla, su hoja de filtros y el `BuscadorAlta`
  adentro de `PantallaM` (que le pone `transform` mientras se tira el pull, y `transform` mueve lo `fixed`) no.

**Vive en:** `app/m/competitor-spy/` (page.tsx, SpyM.tsx, competitor-spy.css) · las dos puertas del escritorio: `marco`
en `app/competitor-spy/DetallePieza.tsx` y `columnas` en `app/competitor-spy/GrillaPiezas.tsx` · la fila
`competitor-spy` de `SECCIONES_MAS` y su `QUERY_DE_SECCION` (lib/movil-rutas.ts).

## El Dashboard del teléfono decía «No es nada tuyo» de algo que no falló (10/11/2026)

**Síntoma:** en el ws 3, la hoja Closing en el teléfono mostraba DOS veces «No pudimos leer estos números. No es nada tuyo», con
«Volver a cargar» y «Reportar a Soporte». En la compu, la misma hoja decía «Conecta tu grabador de reuniones…».

**Causa:** el lector (`datosDeGraficos`) devolvía «falta conectar» (`SinConexionError`) como un `{ ok: false, error }` más, y
`hojaPropia` convertía TODO `ok: false` en `ERROR_LECTURA`. Y `DashboardM` dibujaba el aviso único de «no se pudo leer nada» y, debajo,
la lista de números con el mismo error: la condición de la lista no excluía el caso de los dos errores.

**La regla:** el lector marca `sinConexion: true`; si NADA se leyó y lo que volvió es eso, el teléfono dice ese texto, una vez, con
`VacioM` (no `ErrorM`: no hay reintento ni Soporte que sirvan) — `faltaConectar` en el modelo, con su test. Un estado que la compu
explica no se traduce a «falló» en el teléfono.

**Vive en:** app/m/dashboard/datos.ts (`hojaPropia`), modelo.ts (`faltaConectar`), DashboardM.tsx · lib/graficos-datos.ts (`DatosGrafico`).

## «No pudimos leer» de una hoja que se leyó bien: vacío no es falla (11/11/2026)

**Síntoma:** en el teléfono, Anuncio ganador y Hooks del ws 3 decían «No pudimos leer estos números. No es nada tuyo» con «Reportar a
Soporte». **Causa:** `hojaPropia` marcaba `numerosError` cuando todos los números mostraban «—», y `fmtValor(null)` también da «—». Un
período sin datos, leído bien, se pintaba como lectura caída. **La regla:** «no pudimos leer» sólo si las lecturas FALLARON (`noSeLeyo`,
app/m/dashboard/modelo.ts); sin datos, la lista dice «—». Es la misma familia que «falta conectar» (arriba): el teléfono no puede tener
menos categorías que la compu (falló / falta conectar / sin datos).

## La hoja copiada en el teléfono no dice lo mismo que en la compu (11/11/2026, a 375 con captura)

- **La frase:** en la compu, Marketing arma su frase con su diseño (`fraseMarketing`); el teléfono armaba la de la PLANTILLA (`tramosDeFrase`
  sobre la pieza `frase`), y sin pauta decía «Gastaste US$0 en anuncios · trajeron 3 agendas · cada una costó US$0» cuando la compu ya decía
  «Llegaron 3 agendas.». Un arreglo de una hoja con diseño hay que mirarlo también en el teléfono: son dos caminos.
- **La unidad:** el catálogo la dice en el nombre de la métrica («Mediana de respuesta (min)») y la tarjeta tiene su propio título («Tiempo de
  respuesta»): el teléfono mostraba «10» a secas. `conUnidad` la suma si el título no la dice.
- **Vive en:** app/m/dashboard/datos.ts (`hojaPropia`), modelo.ts (`esCostoSobreGasto`, `conUnidad`).

## Una vista nueva por query se pierde en el teléfono: el paso a /m sólo lleva las claves que tiene anotadas (11/11/2026)

- **Síntoma:** en Copywriting, «Crear desde cero» (`/copywriter?nueva=`) y «Mis guiones» (`?ver=guiones`) mostraban en el teléfono
  la portada de outliers. En la computadora andaban.
- **Causa:** el paso de la ruta de computadora a la del teléfono (lib/movil-creacion.ts → `conQuery`) conserva sólo las claves
  de la lista de su fila (`query: ['nuevo']`), y además **descarta los parámetros vacíos**: `?nueva=` se caía aunque estuviera.
- **La regla:** una pantalla que suma una vista por query anota la clave en DOS lugares: su fila de lib/movil-creacion.ts y
  `QUERY_DE_SECCION` (lib/movil-rutas.ts, lo fija tests/movil-mas-secciones.test.ts). Y el link lleva un valor (`?nueva=1`).
## El teléfono dibuja la PRIMERA métrica de cada pieza, con el título de la pieza (11/11/2026, producción a 375)

- **Síntoma:** Velocidad de llamada en el teléfono: «Leads por día · 0 en 30 días» y debajo «Primer contacto 129». Natalia (ws 19) tiene
  129 leads y 126 esperando; la compu lo dice bien.
- **Causa:** la forma fija del teléfono (app/m/dashboard/datos.ts, `hojaPropia`) toma `columnas[0]` de la serie y `totales[0]` de cada
  número. En Velocidad la serie es `[contactados, sin_contactar]` (dibujaba sólo los contactados: 0) y el número es la pieza «tramos» de
  ocho métricas (mostraba `leads`, con el título de la pieza).
- **Lo que quedó:** con varias métricas, el rótulo es el NOMBRE de la que se ve (`rotuloDePieza`, app/m/dashboard/modelo.ts): «Contactados»,
  «Leads 129». Lo que dice el rótulo es lo que se dibuja.
- **Lo que falta (decide Martín):** el teléfono de Velocidad sigue lejos de Tend (la lista de quién espera, con «Llamar»).

## «Todo ······ Todo» encima del aviso de «falta conectar» (11/11/2026)

El aviso «Conecta tu grabador…» iba adentro de una sección con el período de título y el período de botón; con «Todo» las dos palabras son
iguales. `falta` es que no se leyó NADA de la hoja: cambiar el período no lo arregla. El aviso va solo (`VacioM`, app/m/dashboard/DashboardM.tsx).

## El eje del teléfono redondeaba los centavos a cero (11/11/2026)

Lo gastado en IA (US$0,027 en el mes) daba un eje «0 · 0 · 0 · 0»: `ejeCompacto` escribía hasta un decimal, y `geometria` redondeaba los
pasos a milésimas. Debajo de 1, dos cifras significativas; los pasos, a precisión relativa (`toPrecision(10)`). app/m/dashboard/modelo.ts.

