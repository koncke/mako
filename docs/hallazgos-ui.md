# Hallazgos de la UI

Las piezas de `app/_ui`, `app/_components` y `app/components` las usan **todas** las tabs:
un cambio acá tiene 20+ llamadores. Esto es lo que hay que saber antes de tocar
`WizardShell`, la pila de modales, el `Dropdown` propio o el progreso de un formulario.
**No es un changelog.** Acá también viven las reglas de UI que el dueño repitió hasta
cansarse: si una pantalla nueva las rompe, vuelve rebotada.

⚠️ **Parte de este material es de segunda mano.** Sale de los journals de las 261 corridas
multi-agente de junio a agosto de 2026 —134 de 260 nunca escribieron nada en el repo— y de
minar 1038 mensajes del dueño, no de releer el código de hoy. Cada entrada dice de qué
corrida y fecha viene; antes de actuar sobre una, verificá contra el código: varias ya
están arregladas. El registro de corridas está en [corridas-multiagente.md](corridas-multiagente.md).

## Iniciales cortadas por índice: quedan seis fuera de Automations (27/10/2026)

`nombre.trim()[0]` es la primera unidad UTF-16, no la primera letra. Con «🚀 Ana» sale medio emoji, el server y el navegador
dibujan cosas distintas, y React tira #418. Automations ya usa `iniciales` (lib/unicode-seguro.ts;
tests/automations-iniciales.test.ts barre app/automations).

**Quedan, sin tocar** (cada uno es de su chat):
- app/_components/ServicioVisual.tsx:106
- app/calendario/ListaLlamadas.tsx:187
- app/classroom/ClientsShell.tsx:335
- app/m/_ui/formato.ts:29
- app/video-editor/_opencut/subtitles/components/texto-a-voz.tsx:72
- app/web-generator/editor/paneles/PanelComentarios.tsx:46

## El clic derecho en las listas: UN hook, y el dedo que cerraba el menú que acababa de abrir (27/10/2026, f26)

**Vive en:** `app/_ui/useMenuContextual.ts` · `app/_ui/MenuContextual.tsx` (`porDedo`) · `app/_ui/ui.css` (`[data-con-menu]`) ·
`app/{chats,customers,offer,integraciones,partners,agency,automations,web-generator}/menu-contextual-*.ts`.
Guard: `tests/clic-derecho-listas.test.ts` (12 tests, 30 roturas cazadas).

- **Pedido:** Leandro (ws10, llamada del 24/10, f26): «el click derecho casi que en toda la app se tiene que poder usar».
  El CRM y el Classroom ya lo tenían; se sumó a Chats, Customers, Offer («Tu oferta»), Integraciones, Partners (la tabla
  del programa y el Agency Dashboard), Automations y el Panel del Web Generator, con la pieza de la casa.
- **Un clic derecho por lista es UN hook, no ocho `onContextMenu`.** Las guardas ya estaban pagadas en el CRM (un evento
  de React sube por los portales, escribiendo va el del navegador, con un modal abierto ninguno, el teclado llega sin
  punto). Copiadas ocho veces, la novena sale sin una. `useMenuContextual` las tiene y cada lista sólo dice QUÉ ofrece.
  En una fila, el filtro de portales es `currentTarget.contains(target)`: más simple que enumerar roles.
- ⚠️ **Mantener presionado es una CARRERA con Android.** Android dispara su propio `contextmenu` al mantener (~450 ms,
  medido en el Ops Center), antes o después del reloj según el teléfono. Si llega antes, abre él con el punto del dedo
  (`dondeAbre`); si llega después, es el ECO del que ya abrimos. Y `MenuContextual` se cierra con todo `contextmenu` de
  afuera (es su regla para el segundo clic derecho): el eco cerraba el menú que el dedo acababa de abrir. Con `porDedo`,
  hasta que baje OTRO toque ni el eco lo cierra ni el clic de levantar el dedo elige: el menú abre BAJO el dedo, con su
  primer renglón ahí. iOS no dispara `contextmenu`: abre el reloj (550 ms), y el CSS saca el globo de los links.
- **El clic que sigue al mantener se traga en la fila** (`onClickCapture`): sin eso, levantar el dedo abría la
  conversación o la landing además del menú.
- **Sin «⋯», el menú ofrece lo que el elemento YA hace**, y nada más: abrir, el botón de su fila (Agency: «Pagar su mes»,
  «Activar renovación» o «Inspeccionar», decidido ahora por una sola función, `accionDeCuenta`), los links de su ficha
  (Customers), sus dos botones («Tu oferta»). Una tarjeta de Integraciones ofrece sólo abrirla: lo de cada conexión vive
  en su modal, y copiarlo al menú sería una segunda copia de cada una.
- ⚠️ **Dos listas que dicen lo mismo, cruzadas por test mientras tanto.** En Chats y en el Web Generator el «⋯» sigue con
  su Dropdown / MenuFlotante: otros chats estaban tocando esas tabs y el pedido era sólo sumar el clic derecho. AGENTS pide
  UN menú; hasta que el «⋯» lo abra, el test cruza rótulo por rótulo y, en el Web Generator, la LLAMADA de cada renglón.
  En Automations no hizo falta: el «⋯» ya salía de una función pura (`opcionesDeFila`) y el menú la usa.
- **El tsc acotado de la nube muere sin decir por qué** («código undefined») con los 2560 MB de heap por defecto al
  importar IntegracionesBoard o SimuladorWhatsApp: con 6000 corre (1 min 38 s). Los 16 errores que da son de arrastre
  (`opencut-wasm` sin compilar por `npm ci --ignore-scripts`, el `<style jsx>` de Compartir.tsx), ninguno de lo tocado.

**«Responder» del clic derecho (30/10/2026):** `app/_chat/useCita.ts` (el estado, sin dibujar: lo usa Soporte, cuyo hook no puede traer `MensajeWA`) y `useCitaDelChat.tsx`, con la cita por conversación (no viaja a otro diseño ni a otro lead). Sumado al Image Editor, Video Editor, Dashboard, WhatsApp Advisor y la ficha del lead. ⚠️ Una nota de voz sale por detrás: no se lleva la cita, que queda para lo que se está escribiendo.

Lo que parecía simple y encontró la revisión (ya arreglado):
- **La clave no era opcional:** el Advisor y el Dashboard cambian de contacto y de hoja sin remontarse, y la cita de un lead salía en el historial de otro.
- **La cita ocupa lugar:** adelante del texto y antes del `.slice`, cortaba el final del mensaje y el cierre de un documento pegado, que se veía crudo. Se descuenta del tope (`reserva`).
- ⚠️ **El renglón citado se interpretaba como un pedido** (lib/mako-pedidos.ts corta en `\n`): citar «Archiva la hoja Ventas» y escribir «mejor no» proponía archivarla. Se interpreta lo escrito y se vuelve a citar (`separarCita`). Web Generator tenía el mismo defecto desde antes.
- **Con adjuntos y sin texto, la cita se perdía** (`armarConCita` con texto vacío), y con un documento `partirPegados` le comía el renglón en blanco que `leerCita` necesita.

### Lo que quedó sin hacer

- **Responder en Automations:** sigue sólo Copiar, acordado aparte (`docs/pendientes.md`). Second Brain usa su propio menú completo. En Offer no se cita en el arranque (lo escrito contesta SU pregunta) ni con archivos en la vista previa (`enviarVista`: la cita queda para el próximo texto).
- Que el «⋯» de Chats y del Web Generator abran ESTE menú (sus chats).
- ⚠️ **La rama estuvo tres días colgada (27 al 30/10) y al traerla el menú de Chats ya mentía:** Martín le había cambiado el «⋯» el 27/10 (sin Cerrar ni Posponer; Agregar al CRM, Abrir ficha, Asignar). Un cherry-pick sin conflicto en ese archivo habría vuelto a ofrecer Cerrar. El cruce por test lo agarra: al traer un menú viejo, se adapta al de ahora y no al revés. Y `docs/pendientes.md` seguía diciendo «sin implementar» de Copiar y del lienzo, que estaban desde el 24/10: antes de implementar algo de esa lista, mirar el código.
- Integraciones: el clic derecho tiene que hacer lo mismo que el clic (`abrirTarjeta`: una red social abre Zernio), no abrir la tarjeta suelta.
- Offer: el selector de arriba (funnels, ofertas, conversaciones) es el Dropdown de la casa; un clic derecho en sus
  renglones es cambiar el desplegable de toda la app. Sin hacer.
- La lista de landings de la tarjeta del editor (`editor/paneles/PanelLandings.tsx`) no tiene «⋯»: sin menú. Tampoco
  la tabla del partner (`PanelPartner`), que no tiene acciones por negocio.
- El teléfono (/m) tiene sus propias listas y no se tocó: mantener presionado vale en las pantallas de computadora con
  dedo (un iPad, «Versión de computadora»).
- Sin mirar en un navegador (la nube no levanta la app con datos): el eco en un Android real, el globo de iOS sobre el
  link de un renglón del Web Generator, y el segundo clic derecho con un menú ya abierto.

## El desplegable que se abre y se cierra solo en el teléfono era el TECLADO (26/10/2026)

**Vive en:** `app/components/Dropdown.tsx` (`onResize`, el foco del buscador) · `app/m/layout.tsx` (`interactive-widget`).
Guard: `tests/settings-movil-26-10.test.ts` #1.

- **Síntoma:** Martín, en su Android, dentro de la hoja de Perfil: «no puedo apretar ningún desplegable, se abre y se cierra
  automáticamente».
- **El diagnóstico obvio era el equivocado:** un doble toque, un clic que se propaga al documento o la hoja (`SheetM`) que se
  come el gesto. Con toques de verdad en el banco (CDP `Input.dispatchTouchEvent`) el menú abría y QUEDABA abierto.
- **La causa:** /m declara `interactive-widget: resizes-content`, así que en el teléfono el TECLADO achica la ventana y manda
  `resize`, y el Dropdown cerraba en todo `resize` (para no quedar despegado del botón). El de la zona horaria enfoca su
  buscador al abrir → teclado → resize → cerrado en el mismo gesto. Y cualquiera, tocado con el teclado ya abierto (venías de
  escribir en «Cargo»), se cerraba cuando el teclado se iba. Se reprodujo achicando el alto de la ventana con el menú abierto.
- **La regla:** en la casa un `resize` no es «el usuario se fue»; en el teléfono es el teclado. Un menú flotante se REUBICA
  con `resize` y se cierra sólo con un scroll afuera o un toque afuera. Y al tacto el buscador no se enfoca solo: el teclado
  tapa media lista justo cuando se va a elegir con el dedo.

## Sacar MaKo Context, AI Models y Dev: lo que se iba con ellas sin que nadie lo supiera (25/10/2026)

Martín (puntos 13 a 15): «Elimina /contexto... Elimina /modelos-ia... Elimina "dev", ya no lo necesitamos». Medido ANTES
de borrar, lo que cada pantalla arrastraba y no se veía desde su nombre:
- ⚠️ **«Prompts» y «Configuración» NO las personaliza cada usuario** (era la premisa del pedido): /contexto era el ÚNICO
  lugar donde se editaban la persona de MaKo y los 33 prompts de cada pantalla (lib/prompt-registry.ts). Borrar la
  pantalla dejaba los prompts sin editor. Se mudaron a **Settings › Prompts** (sólo la plataforma, la regla de «Método»).
  «Conocimiento» (la metodología, `mako_knowledge`) fue a **Classroom › Methodology**, con el editor completo que vivía
  suelto en /conocimiento. «Fases» quedó deprecado: su dato sigue en `mako.fase.*` y sigue entrando al prompt si tiene algo.
- ⚠️ **Las bibliotecas de Ads Writer (Ángulos y Estructuras) sólo se editaban en la página de Dev de Ads Writer**
  (`paneles.tsx`); /admin/guiones redirigía ahí y su TÍTULO de pestaña salía de la fila de Dev. Ahora /admin/guiones las
  dibuja y es una sección de Copywriting («Angles & Structures»).
- **El grafo del Second Brain (la construcción de MaKo) enlazaba cada área a /admin/dev/<área>**: hoy abre su `verEnApp`
  (la tab del área) o nada. Un link a una pantalla que se fue no da error: redirige al Ops Center y parece que anda.
- **La capacidad «contexto» que MaKo ofrece por la API mandaba a /contexto**, que un cliente ni podía abrir (era del
  super admin): ahora manda a Second Brain, donde un negocio carga lo suyo. El id se queda (es el contrato).
- **Lo de Dev que SE QUEDA porque otros lo importan:** las bitácoras (cierre de tickets por `tickets: [n]`, Progreso, el
  Cerebro), `areas.ts`, `registros.ts`, `roadmap.ts` (Runway), `_registro/Registro.tsx` (la página de la API y el catálogo de
  UI) y `pricing/Piezas.tsx` (Landing Analyst). Y /admin/docs y /admin/ui: otras pantallas los enlazan; ya no tienen puerta
  en la barra. Se fueron el mapa de áreas, la página de cada área, sus paneles (Pricing, El semáforo, el roadmap de CS) y el
  historial generado (`gen-dev-historial.mjs`).
- **Las rutas viejas redirigen en next.config.ts**: /contexto y /conocimiento → Classroom › Methodology, /modelos-ia y
  /admin/dev/* → el Ops Center.
- **Quedó sin hacer:** el CSS del modo Dev (`.mk-sidebar--dev`, `--dev-line` en app/_ui/ui.css) ya no lo usa nadie; y los
  comentarios de ~30 archivos que dicen «configurable en /modelos-ia» (el override guardado sigue rigiendo en runtime).

**Vive en:** `app/_components/nav.ts` (`SUPERADMIN_MENU`, `ADMIN_FAMILIAS`) · `app/_components/Sidebar.tsx` · `next.config.ts` ·
`app/classroom/methodology/` · `app/configuraciones/prompts/` · `app/admin/guiones/page.tsx` · `lib/cerebro-construccion.ts`

## La tuerca es Settings en toda la app, y el menú de la foto: sin la cara y con Platform en un ítem (25/10/2026)

Martín (25/10, ~12:00), con la captura del menú: «No me gusta para nada que en el desplegable de super admin me aparezcan
tantas cosas, de ultima engloba todas esas tabs extras en un solo desplegable que a su vez tenga otro desplegable... Y no me
gusta que en general el desplegable del perfil, antes de "settings" tenga nuevamente mi foto de perfil, que esté solo settings.
Y revisa el logo de settings de toda la app, siempre debe ser la tuerca, no ese...».

- **«Ese» era `config`, los controles deslizantes**, y se usaba para Settings y para cosas que no son ajustes (Dev, Uso, los
  registros de /admin/dev). Cambiar el dibujo de `config` habría puesto tuercas donde no van: se sumó `tuerca` y pasó a lo
  que ES Settings (la cuenta, el negocio, en la compu y en el teléfono, y las Configuraciones de una automatización), y
  «Configurar» de los desplegables (`iconos-menu`) es la misma tuerca. `config` queda para lo demás.
- ⚠️ **Los dos sets de íconos se importan entre sí** (`icons.tsx` toma `TRAZOS_BORRAR` de `iconos-menu.tsx`). Definida en uno y
  usada en el otro, la tuerca reventaba al cargar («Cannot access 'TUERCA' before initialization»): lo que se comparte entre
  ellos vive en un módulo aparte (`app/_ui/icono-tuerca.ts`, como `icono-funnel.ts`).
- **El menú de la foto:** sin la cara arriba (la foto y el nombre ya están en el botón que lo abre; la fila llevaba a Settings
  dos veces). Lo de la plataforma es UN ítem, «Platform», que se abre en el mismo menú, y adentro «Coming soon» se abre igual:
  un acordeón, no un menú al costado (nada que se cierre al mover el mouse). El saldo de IA sigue arriba de todo.
- **Sin mirar en producción:** la tuerca y el menú se vieron dibujados con las piezas reales, no en la app.

**Vive en:** `app/_ui/icono-tuerca.ts` · `app/_components/icons.tsx` (`tuerca`) · `app/_ui/iconos-menu.tsx` (`configurar`) ·
`app/_components/Sidebar.tsx` (el menú de la foto) · `app/_components/nav.ts` · `lib/movil-rutas.ts` · `tests/menu-perfil-tuerca.test.ts`

## Un alias del buscador que apunta a una key que la barra no le pasa no encuentra nada, sin error (25/10/2026, f31)

Leandro (la llamada de Fathom, f31): «MaKo, no encuentro la sección de curso... Yo pensé que Clients era algo más CRM». Buscó
en Web Generator y en Offer antes de dar con Clients.

- **El diagnóstico obvio era «falta el alias»: estaba.** `lib/buscador-nav.ts` tenía `curso: 'cs-curso'` y `comunidad:
  'cs-comunidad'` desde el 17/10. Pero `buscarDestinos` resuelve un alias contra la LISTA que recibe, y la barra
  (Sidebar.tsx → `<BuscadorNav destinos=…>`) arma esa lista con las filas y sus `secciones`: Classroom y Community son
  sub-tabs de Clients SIN fila (nav.ts → `SIN_FILA`), así que nunca estaban. El alias no encontraba nada y no se quejaba.
- **La regla:** una pantalla de adentro de una tab sin barra de secciones se nombra en la fila con `adentro: [keys]`, y la
  barra se las pasa al buscador (con `puedeVer`, como todo). Un alias nuevo se prueba contra la lista COMO LA ARMA LA BARRA
  (tests/cursos-en-la-barra.test.ts), no contra `TODOS_LOS_ITEMS`.
- **Cuando el nombre no dice lo que hay adentro**, la fila lleva `bajada` (una línea chica, «Clientes, cursos y comunidad»),
  que el buscador también lee. Es una fila más alta: sólo donde la confusión ya pasó.

**Vive en:** `app/_components/nav.ts` (`bajada`, `adentro`) · `app/_components/Sidebar.tsx` (`NavLink`, el `BuscadorNav`) ·
`lib/buscador-nav.ts` · `app/_ui/ui.css` (`.mk-navrow__bajada`)

## El panel de MaKo de cada tab flota, y en el teléfono la tab NO se corre: si no, el panel se estira con la página (25/10/2026)

Martín (24/10, punto 12): «no me gusta que MaKo sea un cuadrado, cuando ya lo venimos haciendo tipo bloque flotante con
cuadros un poco redondeados... Unifica ese diseño».

- **El marco es UNO: el de `.an`** (el panel de MaKo del Dashboard, app/dashboard/PanelAnalista.tsx): 12 px de aire, bordes de
  14, el filete y `0 18px 44px rgba(18,21,27,.18)`. Lo copiaron la ficha del CRM (`.fb-mako-panel`) y la estrella de cada tab
  (`.ch-tab-panel`, app/_chat/chat.css); tests/mako-en-la-tab-flota.test.ts compara el de la estrella con el de `.an`. Un panel
  de MaKo nuevo copia ese marco, no inventa otro.
- **Con aire, la tab tiene que dejarle el panel MÁS su aire** (`LUGAR_PANEL` = 440 + 2 × 12 en `--ancho-panel-mako`); si no, el
  contenido queda 12 px debajo del panel.
- **Trampa (medida, no supuesta): en el teléfono, `--ancho-panel-mako` corría la tab fuera de la pantalla.** La página pasaba a
  scrollear de costado, y un `position: fixed` con `left: 0; right: 0` se estira con ese ancho: el panel medía 630 px en una
  pantalla de 390. En el teléfono el panel tapa todo, así que la variable vale 0 ahí (`html { --ancho-panel-mako: 0px
  !important; }`: el `!important` de una hoja le gana a una variable puesta en línea). Se mide con `scrollWidth` en un teléfono
  emulado de verdad (CDP); el Edge sin ventana tiene un ancho mínimo de ~500 px y miente.

**Vive en:** `app/_chat/chat.css` (`.ch-tab-panel`) · `app/_chat/MakoEnLaTab.tsx` (`AIRE_PANEL`, `LUGAR_PANEL`) ·
`tests/mako-en-la-tab-flota.test.ts`

## Las iniciales de un avatar con medio emoji: diecisiete copias de `w[0]` (25/10/2026)

- **Síntoma** (lo vio Automations): un nombre que empieza con un emoji («🚀 Martín») dibujaba «�M» en el avatar.
- **Causa:** cada pantalla tenía su copia de «las iniciales» (el Avatar de la casa, la barra dos veces, la Marca, los avisos, la
  comunidad, los cursos, el equipo, la ficha del super admin, el Dropdown, General, Cobranza, el avatar de WhatsApp, la ventana de
  Chats, MiFoto, el Perfil, el Plan y la bandeja de email), y todas tomaban `w[0]`, `charAt(0)` o `slice(0, 1)`: la primera
  UNIDAD UTF-16, que en un emoji es su primera mitad. Es el mismo error de `slice` que tumbó los avisos del ws13 (lib/unicode-seguro.ts).
- **Regla:** las iniciales salen de `iniciales` (lib/unicode-seguro.ts): la primera letra o número de cada palabra, saltando emojis
  y símbolos. tests/iniciales-con-emoji.test.ts barre `app/` y falla con una copia nueva hecha a mano. Quedan afuera el teléfono
  (`inicialesM`, que ya sacaba lo que no es letra) y OpenCut (código de afuera).

- ⚠️ **El mismo día salieron DOS piezas:** la ficha del CRM, por el ticket #10 (React #418: medio emoji es «�» en el HTML del
  servidor y la hidratación tiraba la pantalla), hizo `inicialesPorLetra` en lib/iniciales.ts, con la misma regla. Ninguna
  rama veía la otra: una estaba en tren-j y la otra no. Al juntarlas quedó una (`inicialesPorLetra` llama a ésta). Antes de
  crear una pieza compartida, buscarla también en la rama del tren (`git grep <nombre> tren-j`), no sólo en main.

- ⚠️ **La guarda no conoce `nombre.trim()[0]` (27/10/2026, lo que quedaba del ticket #10).** Barre `split(/\s+/)…w[0]` y
  `${p[0][0]}…`, pero no la forma de una sola inicial. El panel de comentarios del Web Generator la tenía (arreglado, con su
  guarda acotada: tests/web-generator-iniciales.test.ts). **Sin hacer, cada una en su área:**
  - app/automations/PanelProbar.tsx:339
  - app/automations/social-ui.tsx:108
  - app/calendario/ListaLlamadas.tsx:187 (`charAt(0)`)
  - app/classroom/ClientsShell.tsx:335
  - app/m/_ui/formato.ts:29 (el email)
  - app/_components/ServicioVisual.tsx:106

  Cuando estén, la forma `.trim()[0]` / `.charAt(0)` va a la guarda de `app/`.

**Vive en:** `lib/unicode-seguro.ts` (`iniciales`) · `lib/iniciales.ts` (`inicialesPorLetra`, la llama) · `tests/iniciales-con-emoji.test.ts` · `tests/iniciales-hidratacion.test.ts`

## Settings a todo el ancho y en dos columnas; el teléfono que scrolleaba de costado (25/10/2026)

Martín: «En settings no me gusta el diseño de "Perfil, Notificaciones, Instalar App, Equipo, Notificaciones, Identidades fiscales,
Tu plan"... Fijate pagina por pagina como lo hacen otras apps... En mobile tampoco se ven bien... Y en desktop es como que esta
cortado a la mitad, no llega al final del ancho».

- **Copiado de dos referencias abiertas y miradas ese día:** los ajustes de Catalyst (Tailwind, catalyst-demo.tailwindui.com/settings)
  y la página de descargas de Linear (linear.app/download). Las dos usan secciones de DOS COLUMNAS: su título y para qué sirve a la
  izquierda, la tarjeta a la derecha, separadas por una línea. Así el ancho entero trabaja. El de shadcn/ui (forms) se descartó:
  también corta el formulario a 2/3, que es lo que Martín marcó.
- **El cambio es del molde, no de cada página:** `.aj-cuerpo` sin el `max-width: 720px` y `GrupoAjustes` con la tarjeta adentro de
  `.aj-grupo-caja` (dos columnas desde 1100 px; abajo, una debajo de la otra). Una lista con columnas (los miembros del equipo) va
  `ancha`: el título arriba y la tarjeta entera. Lo que dibujaba su propia caja con estilos sueltos (Equipo, Identidades fiscales,
  Notificaciones) pasó a usar las piezas del molde: si no, quedaba a todo el ancho y fuera de la grilla.
- **«Notificaciones» estaba DOS veces en el índice**, una por grupo, y las dos se marcaban a la vez (las dos con `activa=
  "notificaciones"`). Ahora es una, en «Tu cuenta», con lo del negocio abajo para quien lo administra (`#negocio`), y
  /configuraciones/notificaciones redirige ahí. Un test exige que ningún nombre ni clave se repita en el índice.
- **Trampa 1 (el teléfono «no se ve bien»): `flex: 1 1 220px` en una fila que pasa a COLUMNA es su ALTO.** El detalle de cada fila
  medía 220 px de alto en el teléfono: «Nombre» arriba, un hueco, y el valor 200 px más abajo. Era de antes. En columna, `flex: none`.
- **Trampa 2: el índice de chips ensanchaba la página.** `.aj` tenía `align-items: flex-start` también en el teléfono: el índice
  (que se desliza) tomaba su ancho entero, 1215 px, y toda la página scrolleaba de costado con el texto cortado. Con `stretch` mide
  la pantalla y se desliza adentro. Se MIDE así: `scrollWidth === clientWidth` en un teléfono emulado de verdad (CDP, la receta de
  «Una captura de teléfono»), las seis páginas a 390 px.
- **Trampa 3: dos interruptores al lado de un nombre no entran en 390 px.** En la computadora, una grilla compartida (las columnas
  quietas); en el teléfono, la fila es flex y los interruptores bajan debajo del nombre. La fila es `display: contents` arriba de
  1100 px para que sus celdas sigan en la grilla.
- **Sin mirar en producción:** se dibujó con las piezas reales y datos de ejemplo (el arnés de esbuild de «Ver una pantalla de
  cliente sin levantar la app»). Falta recorrerlo con la sesión de Martín.

**Vive en:** `app/_ui/Ajustes.tsx` (`GrupoAjustes`, `ApartadoAjustes`) · `app/_ui/ajustes.css` · `app/perfil/InformacionPersonal.tsx` ·
`app/perfil/NotificacionesPanel.tsx` · `app/perfil/instalar/InstalarApp.tsx` · `app/equipo/EquipoView.tsx` ·
`app/configuraciones/IdentidadesFiscalesPanel.tsx` · `app/configuraciones/plan/PlanPanel.tsx` · `tests/ajustes-cuenta-negocio.test.ts`

## Un `<aside>` que flota con aire: la regla de la barra le fuerza el alto, y con la alerta de la voz SOLA no lo baja (25/10/2026)

**Vive en:** la regla `[data-barra-agencia] aside, [data-alerta-voz] aside[data-sidebar]` (app/globals.css) · el panel de MaKo
de la ficha (`.fb-mako-panel`, app/crm/lead-view/ficha/FichaPorBloques.tsx) · tests/barra-inspeccion-alto.test.ts (4).

- **Síntoma:** rojo del tren, «el panel del AI Analyst de la ficha dejó de ser `<aside>`». Seguía siéndolo: el test buscaba
  la forma vieja (`style={{ position: 'fixed', top: 0, …`) y el panel había pasado a un bloque flotante con 12 px de aire.
- **El diagnóstico obvio era el equivocado:** «es <aside>, la regla lo baja, alcanza con poner el test al día». MEDIDO en Edge
  sin ventana (el CSS real de globals.css y del panel): con la barra de inspección la regla lo bajaba a 50 pero le forzaba
  `height: calc(100vh - barra)` → pegado a la barra y al borde de abajo, sin aire. Y con la alerta de la voz caída SOLA
  (64 px, la que ve un cliente) la regla sólo toca `aside[data-sidebar]`: el panel quedaba en top 12, TAPADO por la alerta.
- **Regla:** algo `fixed` que flota con aire no se apoya en la regla de los `<aside>`: suma la barra él mismo
  (`top: calc(12px + var(--barra-agencia, 0px))`, que vale 50, 64 o 114 según qué barra esté) y, si es `<aside>`, le gana a
  la regla global en `top` y `height` con un selector más fuerte. Se mide con las tres barras, no sólo con la de inspección.
- **Quedó SIN medir (por el CSS, el mismo caso):** todo `<aside>` `fixed`/`sticky` en `top: 0` que no sea la sidebar queda
  debajo de la alerta de la voz cuando está sola. El test 4 da por buena la lateral del Web Generator (`.gp-lateral`,
  sticky top 0) sólo con la barra de inspección.

*25/10/2026, chat «CRM» (`claude5`).*

## Medio emoji en las iniciales tira la pantalla al hidratar: React #418 (ticket #10, 25/10/2026)

**Vive en:** `inicialesPorLetra` (lib/iniciales.ts), que usan `Marca` (app/_components/Marca.tsx, la cabecera de toda
`CabeceraDetalle`), `Avatar` (app/_ui/Avatar.tsx) y el historial de la ficha · tests/iniciales-hidratacion.test.ts.

- **Síntoma:** «La pantalla «CRM» se rompió» al abrir /crm/3445 del Cliente de Prueba, React #418 con «text» (el texto del
  servidor no coincide con el del navegador). En la cabecera de la ficha se leía «�M».
- **El diagnóstico obvio era el equivocado.** Un #418 a las 22:29 de Argentina (01:29 UTC del día siguiente) pide buscar una
  fecha formateada sin zona fija o un «hace X»: se revisaron todas las de la ficha y estaban bien. Lo destapó leer el TEXTO de
  la pantalla en producción (`get_page_text`): «�M» arriba, y el nombre en la base, «🧪 Martín arnés contestó…».
- **Causa:** `w[0]` es la primera unidad de UTF-16, y la de «🧪» (de cualquier emoji, o de una letra fuera del plano básico
  como «𝒜») es MEDIO carácter, un surrogate suelto. El servidor escribe el HTML en UTF-8, que no puede escribir medio
  carácter, y manda «�» (U+FFFD); el navegador hidrata con la mitad cruda. Dos textos distintos y React tira el árbol. No es
  sólo de las iniciales: cualquier `[0]` o `slice` que corte un nombre con emoji y se dibuje en el primer render hace lo mismo.
- **Regla:** un texto del primer render que sale de CORTAR un string corta por punto de código (`[...s]`, `Array.from`),
  nunca por índice. La prueba que sirve no compara contra un valor esperado: pasa el resultado por `TextEncoder` y
  `TextDecoder` (lo que hace el HTML) y exige que vuelva igual.
- **Quedó SIN hacer (el mismo corte, en piezas de otras tabs):** `app/_components/Sidebar.tsx:85` y `:241` (las iniciales del
  negocio y de la persona en la barra, que se dibuja en TODAS las pantallas), `app/components/Dropdown.tsx:44`,
  `app/general/bloques/comun.tsx:203`, `app/general/Cobranza.tsx:41`, `app/automations/social-ui.tsx:108`,
  `app/web-generator/editor/paneles/PanelComentarios.tsx:46`, `app/_components/ServicioVisual.tsx:94`. Un negocio o una
  persona cuyo nombre empiece con un emoji rompe esas pantallas igual.
- **Las otras copias que vio Automations el 24/10 (también SIN hacer):** `app/_components/NotificationsProvider.tsx`,
  `app/_comunidad/piezas.tsx`, `app/_cursos/ComentariosClase.tsx` y `app/admin/AdminView.tsx`. Y `lib/unicode-seguro.ts` ya existía para cortar por
  carácter: la próxima pieza usa una de las dos (`inicialesPorLetra` o esa), no una tercera.

## El `Dropdown` en dos columnas: lo que los tests no ven, y cómo se MIDE que las otras 96 pantallas no cambiaron (24/10/2026)

**Vive en:** `dosColumnas` / `alPie` (app/components/Dropdown.tsx), `columnasDeSeccion` (app/components/dropdown-reglas.ts),
la ficha (`FunnelYEtapa`, app/crm/lead-view/ProductoDelLead.tsx) · tests/crm-etapa-dos-columnas.test.ts.

- **Dos columnas adentro de un menú `max-content`: el diagnóstico obvio fue el equivocado, dos veces.** Todos los tests estaban
  en verde, y en Windows las columnas salían una abajo de la otra. Medido en Chrome:
  - con `flexWrap` y una base de 160 px, la barra de scroll vertical de Windows (15 px) deja 335 px útiles y la derecha baja.
    En Mac la barra no ocupa lugar, así que ahí no se ve;
  - con base `0`, el menú no mide el texto: queda en 337 px y corta «Agendó Reunión 1» con lugar de sobra;
  - lo que anduvo: `nowrap` y `1 1 auto`. El menú crece hasta su tope y, si no entra, las dos se achican y el nombre se
    corta con «…».
- **Partir «lo primero | todo lo demás» desequilibra.** El funnel por defecto (`generateFunnel(DEFAULT_PIPELINE)`) tiene 5
  etapas de recorrido, 9 de nutrición y 3 de salida: quedaba 5 | 13 y seguía scrolleando, que era justo lo que se quería
  evitar. **Regla:** la primera banda a la izquierda, la segunda a la derecha, y las siguientes a la columna más corta.
  Queda 8 | 9. Para medir, se usa el funnel por defecto, no una lista inventada: la mía tenía la banda escrita
  `descarte` y se llama `salidas`, y medí 11 | 3 por mi error, no por el código.
- **«Ninguna de las otras pantallas cambia» se mide, no se razona.** El jsdom de node_modules no arranca (ver
  hallazgos-infra). La receta que anduvo:
  1. `git show <commit>^:app/components/Dropdown.tsx > app/components/__DropdownAntes.tsx`, en la MISMA carpeta para que
     resuelva sus imports, y se borra al terminar.
  2. Una página que monta las dos versiones con las mismas props, abre el menú, entra a secciones, escribe en el buscador y
     compara `document.body.innerHTML`.
  3. Empaquetarla con esbuild (`alias: { '@': repo }`, `nodePaths: [repo/node_modules]`, `jsx: 'automatic'`) y correrla en
     Chrome `--headless=new --mute-audio --virtual-time-budget=… --dump-dom`.
  4. Para probar el comparador, romper a propósito un margen FUERA del `if`: 9 casos se pusieron rojos.
  - Resultado: 16 casos sin `dosColumnas`, HTML idéntico; 2 controles con `dosColumnas`, distintos.
  - Las fotos van adentro de un iframe, también la de escritorio: con la ventana sola, headless sacó la foto antes de que
    el menú abriera.
- **Las pantallas con secciones largas** (inventario con agentes, ninguna arma las opciones esparciendo filas de la base):
  - el «valor» de una condición de /automations (`SelectorValor`): todas las etapas de un funnel, 10 a 20 o más;
  - el «A quién» de un CRON (todas las etiquetas del negocio, sin tope);
  - «Elige la etapa» de un disparador de producto y la galería de plantillas (etapas de un kanban);
  - el selector de acciones (unas 190, curadas por área);
  - /offer (una conversación por renglón, sin tope).
  - El `Select` de la casa le pasa `secciones` al Dropdown, pero hoy ningún `Select` lo usa.
- **Quedó SIN hacer:** con el campo nuevo, el tipo acepta `alPie` y `dosColumnas` en cualquier Dropdown y los ignora sin
  avisar fuera de una sección (antes era un error de exceso de propiedades). Es el mismo diseño que `icono`, `atajo`,
  `grupos` y `resumen`, y hoy nadie lo usa mal, así que se dejó. Si molesta, se parte el tipo en dos.

*24/10/2026, chat «CRM» (claude1), con una corrida de 13 agentes (inventario y refutación adversarial).*

## Un aviso largo duraba 3,2 s: el `Toast` ahora le da tiempo según el largo (24/10/2026)

**Vive en:** `useToast` (app/_ui/Toast.tsx) · test 10 de tests/enriquecer-lote.test.ts.

- El resumen de un lote del CRM («De 221, tu WhatsApp tiene el nombre de… · Faltan 160: vuelve a tocar…») tiene 150 a 250
  letras, y lo importante va al final. Sin `Deshacer` ni tono, el aviso se iba a los 3,2 s: el «se cortó» o el «faltan» no se
  llegaba a leer.
- Ahora la espera es la mayor entre la de siempre y ~60 ms por letra (con techo de 12 s), y un aviso `warn` (algo quedó a
  medias) dura por lo menos 8 s, como uno `bad`. La fórmula de `bad` no cambió: tests/reportar-a-soporte.test.ts la fija,
  porque tiene que dar tiempo a tocar «Reportar a Soporte».
- Para quien llama: un resultado a medias se canta con `tono: 'warn'`, no como un «listo».

*24/10/2026, chat «CRM» (claude1).*

## El pie que flota a la mitad: una lista larga con acciones abajo es UNA pieza, `VistaConPie` (24/10/2026)

- **Síntoma:** en «Traer de un grupo de WhatsApp», Martín: «los botones de abajo no pueden estar a la mitad y que abajo se
  sigan viendo leads, se ve horrible». Y «hay varias que se parecen y están mal».
- **Causa:** el pie era `position: sticky; bottom: 0` DENTRO del cuerpo del `<Modal>`, que es el que scrollea y tiene padding
  abajo. El pie se pega al borde del scroll menos ese padding, y las filas pasan por la franja de abajo.
- **Por qué pasó dos veces:** «Traer de otro funnel» ya se había arreglado el 23/10 (la vista mide el alto del cuerpo con
  `height: 100%` y la que scrollea es la tabla). La vista del grupo se copió de ella ANTES de ese arreglo, y el arreglo
  vivía sólo en la primera. **La regla en una pieza o se pierde en la copia.**
- **Cómo quedó:** `app/_ui/VistaConPie.tsx` (cabecera, la lista como único scroll, el pie como último renglón con fondo
  sólido). La usan las dos vistas de «traer»; el Modal tiene que tener `alto` fijo. El `sticky` queda de respaldo para un
  padre sin alto (el importador). La regla para código nuevo, en AGENTS.md («`<Modal>` guarda su `onCerrar`…»).
- **Barrido por `position: 'sticky', bottom: 0` en `app/`:** sólo esas dos.

**Sin hacer:**
- Barrer el otro molde del mismo error: listas largas cuyas acciones van al final del cuerpo, sin `sticky`, y se
  desplazan con la lista («que el botón no se tenga que desplazar», 22/10). No se barrió todavía.
- Verlo en pantalla, también en el teléfono: el cambio no está desplegado.

*24/10/2026, chat «CRM» (claude1).*

## Al terminar de cargar, la criatura vuela a SU lugar: un movimiento y un vigía para todas las tabs (23/10/2026)

**Pedido (Martín):** «Todos los loaders que tengan la figura de MaKo, luego de terminar de cargar, la figura de MaKo se debe ir
a su lugar, como lo hace en ops center... En Automations se puede ir a su chat, lo mismo que en CRM a su botón de abajo».

**Lo que hay:** el movimiento estaba escrito DOS veces (la entrada del teléfono, `EntradaApp`, y la del Ops Center,
`EntradaOps`) y ahora es uno, `app/_ui/vuelo-mako.ts` (`trayecto` + `volar`). Las tabs vuelan con `VueloDeCarga.tsx`.
`CargandoMako` monta un vigía que se instala la primera vez y queda vivo. El vigía hace falta porque el loader se desmonta justo
cuando llega la página. Mientras hay un loader anota dónde está la criatura; cuando se va, busca su lugar en la pantalla
nueva y hace volar una COPIA que no toma clics. El lugar de cada pantalla, en este orden (`DESTINOS_CASA`):
1. `[data-mako-casa]`, para que una pantalla marque su lugar a mano. Lo nuevo entra por acá, sin tocar la lista. Automations
   lo pone en la figura de MaKo de la cabecera de su lista, que abre el chat.
1. La cabecera de un chat del Ops Center (`.co-cab__muneco`), que es también la del chat de MaKo del grafo del Second Brain.
   Con menos de 1100 px esa columna está plegada, y entonces se funde.
2. La criatura del chat de Automations (`[data-chat-sidebar] [role="img"][aria-label="MaKo"]`).
3. La estrella de abajo, «Escríbele a MaKo» (`.ch-tab-mako`): CRM, Plan, General/Dashboard, Clients.
4. En el teléfono, la criatura del Ops Center en la barra (`[data-mako-foto-barra]`).

Sin lugar visible se va como siempre, de golpe. Son: Chats, Calendario, Web Generator, Ads Manager, Video, Image y
Copywriting, y Offer, donde la criatura sólo está de avatar en un mensaje. **En Automations el chat está ESCONDIDO al
terminar de cargar** (la lista va arriba). Por eso su chat suma, en la cabecera de la lista, la figura de MaKo que abre el
chat, con `data-mako-casa` (rama `aut2-mako-casa` del chat de Automations). Hasta que llegue, en Automations no vuela.

**Trampas que muerden:**
- **El loader se desmonta en el mismo instante en que llega la página**: no puede volar él. Por eso hace falta un vigía que
  sobreviva, y una copia de la criatura.
- **Dos loaders seguidos son UNA carga**: Automations muestra el del `loading.tsx` y después el de la página mientras lee. Un
  loader que se va y otro que llega antes de 120 ms no vuelan entre sí.
- **Con la pestaña de fondo `requestAnimationFrame` no corre**: la posición se anota también en cada cambio del documento,
  no sólo por cuadro.
- **Para verificar en el Chrome conectado**: con la ventana tapada, las animaciones web quedan en `currentTime 0` aunque
  `visibilityState` diga `visible` (y una pestaña 0×0 es un grupo minimizado: se cierra y se crea de nuevo). Lo que se mide
  es el trayecto, adelantando la animación a mano (`a.pause(); a.currentTime = 357`). En /crm aterriza en el centro de la
  estrella con su ancho, y `elementFromPoint` debajo de la copia da la página.
- **La curva hace que llegue antes de la mitad**: el `easing` va sobre toda la animación, así que a 210 ms ya está en su lugar
  y fundiéndose. Es el movimiento del Ops Center tal cual; no es un error.

Lo fija `tests/vuelo-mako.test.ts`, con 5 roturas cazadas.

*23/10/2026, chat «Rendimiento y loaders» (claude2).*

## EL loader de las tabs grandes es UNO: `CargandoMako`, la criatura y una barra que corre (23/10/2026)

**Síntoma (Martín):** «cuando entro a Second Brain tarda muchísimo, y lo peor es que ni siquiera hay un loader aunque sea,
como para indicarme que le di click». Medido en producción con un clic en la barra: sin `loading.tsx` la pantalla
anterior quedaba QUIETA 2,2 s (Second Brain), 3,7 s (Dashboard), hasta 5,6 s (Plan). Y «quiero que sean todos como el
de Ops Center… le falta algún elemento tipo loader, si está solo la criatura no se entiende».

**Lo que hay:** `app/_ui/CargandoMako.tsx` (la criatura del Ops Center + la barra indeterminada de Linear y Material) en
el `loading.tsx` de cada tab grande de escritorio y de /m; el CRM conserva su esqueleto con el loader encima (`cubre`);
/second-brain reexporta el de /admin/operaciones; `EntradaOps` lleva la misma barra. Lo fija `tests/cargando-mako.test.ts`.

**Trampas que muerden:**
- **Se importa DIRECTO** (`@/app/_ui/CargandoMako`), no desde el índice de `app/_ui`: el índice lo importan cientos de
  pantallas de cliente y exportarlo ahí metía la criatura y `lib/centro-munecos` en todos esos bundles (lo mostró
  `tests-afectados`: 82 tests lo veían por el índice).
- **Una animación con `fill: both` le gana a la propiedad**: la barra de `EntradaOps` aparece con `cm-aparece … both`, y
  un `opacity: 0` en `[data-sale]` NO la apagaba. Para apagarla al irse va `animation: none; opacity: 0`.
- **Sin `cubre`, el fondo es transparente**: en /m el fondo no es `--surface` y una caja blanca se notaría.
- **Aparece a los 150 ms** (`MS_APARECE`): una carga más corta no hace parpadear nada; más larga, se ve.
- Un `loading.tsx` es un Suspense: va en `LOADING_PERMITIDOS` (tests/layout-sin-suspense.test.ts) y sólo en segmentos
  privados. Un `redirect()` de esa página llega como redirect de cliente (200), no 307: lo que redirige SIEMPRE (un
  repartidor) va en el proxy.

El «Abriendo Automations…» de `ChatAgentApp.tsx` también pasó a `CargandoMako`: el mismo del `loading.tsx`, así del
server al cliente no hay salto.

El loader al ir al grafo del Second Brain (2,7 s sin nada) queda con la implementación del chat del Ops Center (`yendo` /
`verMapa` en `ChatSecondBrain.tsx`, rama `ops-sb-chat-2310`), que además muestra el chat en el acto al salir. Mi versión
(ea9092f40) entró por las dos ramas y su merge se queda con la de ellos.

⛔ **Una página que redirige SIEMPRE no lleva `loading.tsx`** (ticket #7, 23/10/2026). Con él, su `redirect()` va adentro
del stream: llega un 200 con meta refresh en lugar del 307, y la carrera con la hidratación tiró «Minified React error #310»
en el AppRouter de Next. Pasó en /general, que sólo redirige a /dashboard. El centinela lo reportó y recargó la página.
/plan y /second-brain, que redirigen al super admin y conservan el loader, redirigen ahora en su layout, que queda
afuera del loader (docs/hallazgos-infra.md).

*23/10/2026, chat «Rendimiento y loaders» (claude2).*

## Un panel que se llama `data-sidebar` hereda el alto de la barra de la app (23/10/2026)

**Síntoma:** el chat de MaKo al costado del lienzo de Automations tenía la caja de escribir «pegada al piso» (Martín, a 1920
de ancho). **El diagnóstico obvio («el componente compartido del chat le pone poco margen») era el equivocado:** medido en
producción (1540×732), el panel flotante tenía `top: 16` y `bottom: 16` y medía 732 (terminaba en 748, 16 px fuera de
la ventana). Lo estiraba `@supports (height: 100dvh) { aside[data-sidebar] { height: 100dvh !important } }` de
app/globals.css, que es la regla de la barra de la APP: el panel de Automations se llamaba `data-sidebar="lista|chat"`.
**Regla:** `data-sidebar` es el nombre de la barra de la app (lo leen globals.css, ui.css con sus colores y MakoEnLaTab).
Un panel propio usa su propio atributo. Así quedó: `data-panel-automations`. Y la cabecera del chat tenía un margen negativo heredado del
`ChatHilo` de antes, que tenía relleno: salía 4 px por encima del panel y el hilo le pisaba 4 px abajo. **Medido con los dos
cambios, en la misma pestaña de producción:** el panel va de 16 a 716 y la cabecera queda entera arriba del hilo. **Vive en:**
app/automations/SimuladorWhatsApp.tsx · app/automations/ChatMako.tsx (`S.cabecera`) · tests/chat-mako-costado-sin-cortes.test.ts.
*23/10/2026, chat «Automations» (claude2).*

## «Reportar a Soporte»: UN botón en todo aviso de error, y el guardián que lo exige (23/10/2026)

Martín (22/10): «en toda la app, SIEMPRE que sale un error, en donde sea, debe aparecer el botón de "Reportar a Soporte" y que
cuando lo apreten se mande automático un mensaje aquí [la Ticketera] reportando solo lo que pasó». Es `app/_ui/ReportarASoporte.tsx`
y tests/reportar-a-soporte.test.ts lo exige como hijo directo de TODO elemento JSX con `role="alert"` (o `role={…'alert'…}`) de
app/. Se puso con un script en los 261 avisos de 181 archivos (el AST de TypeScript, no regex: los `=>` de los atributos rompen
cualquier regex de JSX). Lo que no se ve leyendo el código:

- **Hay avisos que están SIEMPRE montados y vacíos** (`<p role="alert">{error}</p>` con `error` null) y otros que cambian de
  `role` («alert» o «status» según el tono). Por eso `<ReportarASoporte />` a secas no se dibuja si su padre está vacío o no es
  `role="alert"`, y lo sigue mirando con un MutationObserver (hay avisos que se llenan sin que su componente se vuelva a dibujar).
- **Lee el TEXTO del aviso, sin el de sus botones y links** («Reintentar», «Cerrar»), no la pantalla. Lo que hacía la persona
  es el último botón que tocó (un listener en captura, vigente 2 minutos), sin los nombres propios que puede traer («Mover a Ana»
  → «Mover a «…»»).
- **Una lista (`<ul role="alert">`) sólo lleva `<li>`**: el botón va en el suyo y lee el aviso de arriba.
- **Los avisos de error que NO son un `role="alert"` del JSX** se hicieron a mano: ErrorState (su marco era `role="status"`
  también con tono `bad`), el Toast con tono `bad` (era `status`; ahora es un aviso y dura 8 s), el toast del teléfono (no tiene
  tono: un error se reconoce por la frase, `esTextoDeError`), los `toast.error` de sonner del Video Editor
  ([hallazgos-video-editor.md](hallazgos-video-editor.md)) y las dos pantallas de error de Next, que no importan nada de la app (si
  la app está rota, el botón también): el mismo pedido, a mano.
- **Privacidad** (la revisión adversarial del 23/10, que encontró cuatro agujeros en la primera versión): el reporte se sanea en el
  navegador Y en el servidor. `sinSecretos`: JWT, «Authorization:/Cookie:», «Bearer/Basic/Token …», todo `…token=`/`client_secret:`
  (el `\b` delante de `secret` no engancha después de `_`: hace falta `\w*`), «password es …», los prefijos conocidos (sk-, AIza,
  EAA de Meta, ya29. de Google, ghp_, whsec_), la query de un link y todo token largo. `sinDatos`: emails, teléfonos y lo citado.
  `sinNombres`: lo que va con mayúscula y no es de MaKo ni una sigla («mover a Roberto Pérez»: `sinDatos` sólo tapaba lo citado).
  `rutaSoporte`: los tokens del CAMINO (/pagar/<token>) y los números que pueden ser un teléfono o un código. El navegador sólo
  con la forma de uno. De quién es lo dice la sesión: el cuerpo no tiene cómo elegir el workspace ni la persona.
- **«Lo que hacía» sale SÓLO de botones de verdad y fuera de una fila**: una tarjeta de lead o de conversación es un
  `[role=button]` (o un botón en una fila) y su `innerText` es el nombre y la vista previa del mensaje. Y no cuenta el propio
  «Reportar a Soporte»: el del toast de sonner está fuera de `[data-soporte]` y se registraba como «lo que hacía».
- **El error que manda el botón no es «lo que vio el sistema»**: va en el detalle del ticket, no en `contexto.error` (el porqué,
  en [hallazgos-ticketera.md](hallazgos-ticketera.md)).
- **Un error de VALIDACIÓN también lo lleva** (el `mk-err` de `Field`, «Escribe un email válido»): Martín dijo «SIEMPRE». Si
  molesta, la salida es sacarle el `role="alert"` a lo que no es un error de la app, no un permiso en el guardián.

**Vive en:** app/_ui/ReportarASoporte.tsx · lib/soporte-reporte.ts · app/api/soporte/reportar/route.ts · app/_ui/Estados.tsx · app/_ui/Toast.tsx · app/m/_ui/ShellM.tsx · app/error.tsx · app/global-error.tsx · tests/reportar-a-soporte.test.ts

## El menú de la casa (MenuContextual) tiene SECCIONES y lo tildado (22/10/2026)

- **`seccion` en un renglón** es el título de la sección que empieza ahí. La pieza dibuja la raya de arriba (si no es el
  primero, y si un `null` no la puso ya) y el título chico. Una sección que quedó sin renglones no deja título: lo pone
  quien arma la lista en el PRIMER renglón que quedó (`itemsCrm`, app/crm/menu-contextual-crm.ts).
- **`marcado`** es lo elegido hoy en un submenú de una sola opción (el tipo de una etapa): un ✓ a la derecha y
  `aria-current`. El renglón sigue siendo `menuitem`: con `menuitemradio`, el teclado (`itemsDe`) no lo encontraba.
- **Por qué no el `Dropdown`**: no dibuja un submenú al costado ni un renglón en rojo, y un menú que se abre con un botón y
  con el clic derecho del mismo lugar tiene que ser UNO (ver docs/hallazgos-crm.md, el «⋯» de una columna).

## Lo que más muerde acá

- **«No se autoguarda» no era el campo: era el MODAL** (14/10/2026). Los campos de la ficha del lead
  guardan en `blur`, y medido en producción guardaban bien al salir. Lo que perdía lo escrito era
  cerrar el modal con un clic en el fondo: `Modal` cerraba en el `mousedown` y desmontaba el campo
  ANTES de que el navegador le mandara el `blur`. Ahora el fondo saca el foco del campo de adentro
  primero y recién después cierra. Un campo nuevo que guarde en `blur` adentro de un `Modal` lo
  hereda; uno que guarde en otro evento (un `onChange` con debounce) tiene que vaciar su respiro al
  desmontar. **Vive en:** `app/_ui/Modal.tsx` · `tests/modal-guarda-al-cerrar.test.ts`

- **«Cards are the lazy container» prohíbe la PILA de sub-tarjetas iguales adentro de una
  sección, no la sección.** Citado sin ese contexto dejó a `/general` como la única pantalla
  del producto sin una sola superficie —medido: `/comercial` 8 bloques con `var(--surface)` +
  borde + radio 18, `/marketing` 1, `/general` 0— y el dueño lo reportó como «se ve mucho
  peor, no se ve nada». La caja de afuera es lo que hace que una pantalla se lea como hermana
  de la de al lado → [hallazgos-objectives.md](hallazgos-objectives.md#una-pantalla-sin-superficies-deja-de-pertenecer-al-producto).
- **El dorado no significa «MaKo», significa «destacado»**: en ~25 superficies marca la tab
  activa, un KPI, un avatar sin foto y hasta la burbuja del **humano** en el chat. Por eso
  la marca se siente a IA — si el color no distingue, la chispa queda sola haciendo todo el
  trabajo → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Un overlay que elige su propio `zIndex` queda **debajo** del backdrop: confirmás y la
  pantalla no se mueve, sin error ni spinner → [Modales y capas](#modales-y-capas).
- `.mk-scroll-x` clipea en los **dos** ejes: cualquier popover `absolute` adentro es
  invisible para todo usuario, en cualquier ancho → [Primitives y sistema visual](#primitives-y-sistema-visual).
- El `Dropdown` de la casa **no** hace clickeable al `placeholder`: migrar un `<select>`
  con `<option value="">` pierde la opción de vaciar → [Primitives y sistema visual](#primitives-y-sistema-visual).
- `router.refresh()` no remonta componentes cliente ni re-corre sus efectos: la pantalla
  se queda vieja y el wizard trabado → [Estado y datos en el cliente](#estado-y-datos-en-el-cliente).
- Una pieza que acepta dos formas de recibir el mismo dato contesta distinto en cada modo:
  "Último paso (7)" con el botón diciendo "Siguiente →" → [Wizards y formularios](#wizards-y-formularios).
- Un `<Icon name>` mal escrito o un `<use>` sin su `<symbol>` **no rompen**: pintan un
  puntito gris o un cuadrado liso, sin error, sin warning → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Una fila de tabs con `overflowX: auto` **y** la scrollbar escondida por CSS borra los
  últimos destinos sin dejar ni una pista → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Que una pantalla no llegue al borde no lo causa ninguna regla: de 44 `<main>`, **solo 3
  centraban** y había 5 topes distintos → [Primitives y sistema visual](#primitives-y-sistema-visual).
- Una guarda que prohíbe una palabra en pantalla engancha identificadores del código y no ve
  el texto que vive en los DATOS: falla donde no importa y calla donde sí →
  [El texto de la UI](#el-texto-de-la-ui).
- El preflight de Tailwind hace `svg { display: block }`: un ícono **no** se centra con el
  `textAlign: 'center'` del padre — queda pegado a la izquierda mientras los textos de abajo
  sí se centran → [Primitives y sistema visual](#primitives-y-sistema-visual).
- **Un alto en línea `calc(100dvh - …)` NO descuenta la barra de arriba** (22/10/2026, medido en Offer): la regla global de
  app/globals.css que resta `--barra-agencia` (la barra de «Estás viendo el dashboard de…», 50 px, o la alerta de la voz de
  MaKo caída, 64 px, que ve también un cliente) sólo toca un estilo que EMPIEZA con `height: 100dvh`. Con `calc(` la página
  queda más alta que la ventana, el navegador la corre al enfocar un campo y lo de abajo queda debajo del borde. Así
  estaban Offer, Image Editor (el inicio y el diseño) y Video Editor (el inicio y el proyecto); los cinco restan ahora
  `var(--barra-agencia, 0px)` en su `calc`. **Lo hace cumplir** tests/barra-inspeccion-alto.test.ts, 7: toda `page.tsx` con
  un alto en línea `calc(100vh…)` o `calc(100dvh…)` tiene que descontarla.
- **Y el `min-height: 100vh` también estira la página** (22/10/2026, medido por CRM y repetido en el CRM del ws3 con una
  ventana de 811). El reporte fue «el menú de la sidebar no entra y la página se estira 50 px», y el diagnóstico obvio era el
  equivocado: la sidebar ya descontaba la barra (su regla de app/globals.css) y su menú scrolleaba adentro (608 px de contenido
  en 548). Lo que estiraba era el CONTENEDOR RAÍZ de app/layout.tsx (`minHeight: '100vh'`): con la barra, `body` gana sus 50 px
  de padding, y el documento medía 860. La regla de `height` dejaba afuera `min-height` a propósito («no desborda nada»), y sí
  desborda. Ahora hay una regla para `min-height: 100vh` y `100dvh` (las dos escrituras del estilo, como la de `height`), que
  cubre el raíz y los otros 21 `main` con ese alto mínimo, y el raíz lo descuenta además en línea. Medido con la regla
  inyectada en la pestaña: documento 811, raíz y `main` 761. Lo fija tests/barra-inspeccion-alto.test.ts, 8.

---

## El oscuro de cada persona: no faltaba el interruptor, faltaba el arranque — y el taller lo borraba (17/10/2026)

Tarjeta #883: «que cada persona elija tema claro u oscuro en la computadora (hoy sólo en el teléfono)». Lo obvio era
«montar el interruptor»: `InterruptorModo` (el de nordtheme) existía y guardaba `mako.modo`. Lo que de verdad faltaba:
- **Nadie aplicaba la elección en la computadora.** El teléfono tiene su script antes del primer pintado
  (app/m/_ui/tema.ts); el escritorio no tenía ninguno, así que la elección sólo existía mientras no se recargara.
  Ahora `ModoArranque` (script, sólo con sesión, nunca en una página pública) y `ModoDelUsuario` (lo vuelve a poner al
  navegar: el shell de /m lo saca al salir y una pantalla que lo PRESTA también).
- **El taller de paletas del super admin borraba el modo en CADA render** fuera del Cliente de Diseño
  (`TemaCandidato`, `removeAttribute(ATTR_MODO)` en un efecto sin dependencias), y sacar un tema borraba la elección
  guardada. Eran de cuando el modo era parte del tema en prueba. Ahora el taller toca sólo el tema.
- **`modoPreferido` seguía al sistema** sin elección: un Windows en oscuro abría MaKo en oscuro. Claro por defecto.
- Lo que sigue sin respetar el oscuro son los colores escritos a mano: medido el 17/10, **43 archivos** con un fondo
  `#fff`/`white` literal (Dashboard, Automations, login, Ads Manager…), y las pantallas que FUERZAN oscuro (onboarding
  —que Martín quiere claro—, ads-writer, video). Pendiente, por área.

**Vive en:** `app/_components/ModoArranque.tsx`, `ModoDelUsuario.tsx`, `TemaCandidato.tsx`, `InterruptorModo.tsx` ·
`tests/tema-por-persona.test.ts`

## Abrir a MaKo pliega la sidebar, y el ícono de una tab vive en DOS listas (22/10/2026)

Martín: «si abro a MaKo, se debería plegar la sidebar principal, para optimizar espacios. Si antes la tenía desplegada y
fija, al cerrar MaKo debe volver a su lugar»; y «no me gusta el ícono de "Automations", cambialo por otro que se entienda más».
- **Para plegar la barra un rato hay UN lugar: `plegadaAca`** (app/_components/Sidebar.tsx), el pliegue temporal que ya usaban
  el Ops Center y la ventana chica. Sumarle una condición la pliega sin tocar lo guardado (`setFija` ahí sólo cambia
  `abiertaAca`), y cuando la condición se apaga `fija` vuelve sola a la guardada. Nunca `setFija`/`guardarFija` para esto:
  pisaría la preferencia de la persona. El panel de la estrella lo avisa con app/_chat/mako-abierto.ts (un estado de módulo, sin
  CSS, que también se suelta al salir de la tab con el panel abierto).
- **`--ancho-panel-mako` no hubo que tocarlo**: el panel se pega al borde MEDIDO de la barra (`useBordeDeLaBarra`, con
  ResizeObserver), así que al plegarse la barra el panel se corre con ella y la tab le sigue dejando lo que mide el panel.
- **El ícono de una tab está en dos listas que nada une**: app/_components/nav.ts (la barra y el buscador, que dibuja
  `item.icon`; y en una tab unificada, la FILA de la tab y cada sección por separado) y lib/movil-rutas.ts (el teléfono, su
  propia lista). Cambiarlo en nav.ts dejaba el teléfono con el viejo. Automations pasó de `chatbot` (el globito con chispas) a
  `flujo` (tres pasos unidos) en las dos, y en lo que propone un flujo en la bandeja del teléfono.

**Vive en:** `app/_components/Sidebar.tsx` (`plegadaAca`) · `app/_chat/mako-abierto.ts` · `app/_chat/MakoEnLaTab.tsx` ·
`app/_components/icons.tsx` (`flujo`) · `tests/sidebar-mako-abierto.test.ts` (8 roturas, las 8 cazadas)

*22/10/2026, chat «Offer» (claude3).*

## La sidebar nueva: sacar una fila de nav.ts cierra puertas que no son de la barra (17/10/2026)

Martín pidió deprecar Analyze, Content Machine y Admin, y sacar WhatsApp y Email de la barra (el diseño:
[diseno-sidebar.md](diseno-sidebar.md)). Lo obvio era «borrar las filas». Lo que se rompía, en silencio:

- **El teléfono abre sus pantallas preguntando por la key EN nav.ts.** `requireMovil({ navKey })` →
  `puedeVerKey` busca el ítem en `TODOS_LOS_ITEMS`; si no está, devuelve `false` para TODOS los roles, sin error.
  Borrar la fila de Experiments cerraba /m/experimentos; borrar la de Second Brain de Analyze cerraba
  /m/second-brain/mapa. Y `rutaMovil` arma el destino con `SECCIONES_MAS.find(id)!.href`: borrar la fila de More
  hacía TIRAR la traducción de /second-brain y /experimentos. **La regla:** una pantalla viva que deja de ser fila
  se mueve a `SIN_FILA` (nav.ts) y, en el teléfono, a una fila `oculta: true`; nunca se borra el ítem.
- **El título de la pestaña y la API de MaKo toman el PRIMER ítem cuyo `match` acepta la ruta.** Si Chats marca
  /whatsapp (para que la barra lo encienda ahí), la pestaña de /whatsapp pasaba a decir «Chats» y `listar_capacidades_mako`
  medía /email con los roles de Chats (el closer «tenía» Email). Por eso `SIN_FILA` va PRIMERO en `TODOS_LOS_ITEMS`:
  la barra se enciende por la fila dibujada, el título y la API siguen leyendo el ítem de siempre.
- **Dos keys iguales en dos menús.** La herramienta de admin «Copywriting» (/admin/copywriting) tenía la key
  `copywriting`, la MISMA que la tab unificada Copywriting. Colgada como su sección, `TODOS_LOS_ITEMS.find(key)` la
  habría encontrado primero (adminOnly) y el teléfono habría escondido Copywriting a los clientes. Pasó a
  `admin-copywriting`: las keys de admin no están en ninguna capa, así que cambiarlas no apaga nada.
- **Una tab que se vuelve UNIFICADA le suma la barra de secciones (40 px) a su pantalla.** Las de alto fijo
  (`height: 100vh`) se pasan de la pantalla y scrollea el documento: hay que restar `var(--alto-secciones, 0px)`. Le
  pasó a Chats, Automations y Offer al recibir secciones del super admin; sólo él ve la barra, así que ningún cliente
  lo habría reportado.
- **El movimiento de los muñecos del Ops Center vive en `centro.css`**, que sólo carga en /admin/operaciones. Usar
  `<Muneco animo="trabajando">` en la barra daba un muñeco QUIETO en todas las demás pantallas (y moviéndose sólo
  después de haber pasado por el Centro, porque Next deja el CSS cargado al navegar). El de la barra va en
  `.mk-criatura` de ui.css, con sus propios nombres de animación.
- **Lo que queda escrito en otro lado con los nombres de las familias:** `FAMILIAS_SIDEBAR` de
  lib/plan-proyectos-catalogo.ts (el Plan prohíbe proyectos con ese nombre; las retiradas quedaron en
  `FAMILIAS_RETIRADAS`), `FAMILIAS_MAS` del teléfono, y 22 tests que fijaban la estructura vieja.

**Vive en:** `app/_components/nav.ts` (`SIN_FILA`, `HERRAMIENTAS`, `ARRIBA`), `lib/movil-rutas.ts`,
`app/_components/Criatura.tsx` · `tests/sidebar-nueva.test.ts`

## En un iPad, la foto de perfil de la sidebar quedaba abajo del borde: `100vh` en Safari (14/10/2026)

Martín, desde un iPad: «no se llega a ver la foto de perfil, para ir a configuraciones… todo como muy achicado, los
iconos muy chicos». Y la regla que dejó: «La app de MaKo se debe adaptar al tamaño de la pantalla siempre» (AGENTS.md,
«La app se adapta al tamaño de la pantalla, SIEMPRE»).

- **Un iPad recibe la vista de COMPUTADORA**, no /m: iPadOS 13+ manda UA de Macintosh, y una tablet Android sin
  «Mobile» también queda en escritorio (lib/movil-dispositivo.ts). Si recibe /m o la de computadora adaptada es una
  decisión de producto pendiente.
- **La causa del perfil cortado no es el contenido.** La columna plegada mide unos 660 px (padding 40, marca 54, ~12
  filas de 35 más el aire entre familias, pie de 108), y entra en los ~700 visibles de un iPad apaisado. Lo que la
  corta es `height: 100vh` del `<aside data-sidebar>`: en Safari, `100vh` es el alto con la barra del navegador
  escondida, ~50 px más que lo visible. El perfil va pegado al fondo (`margin-top: auto`), justo en esos 50 px.
  - Es el mismo síntoma que ya había dado la barra de la agencia (el comentario de `--barra-agencia` en globals.css),
    con otra causa.
  - Arreglo: `100dvh` dentro de `@supports`, en la regla genérica y en la de la barra de agencia, que va DESPUÉS
    porque las dos tienen la misma especificidad y `!important` (tests/sidebar-alto-visible.test.ts).
- **Chrome no lo reproduce**: en Chrome `100vh` es la ventana, así que una captura a 1024×768 con la emulación dice
  que entra. Se razona con los números o se mira en un iPad.
- **Lo que quedó sin hacer** (decisiones de producto, en la Ticketera):
  - qué se agranda y desde qué ancho para que no se vea «achicado»: las filas de la sidebar miden 35 px de toque y la
    letra 13 px;
  - que los desplegables, que se abren al pasar el cursor, tengan su equivalente al tocar;
  - la `<nav>` de la sidebar todavía tiene `overflow-y: auto`: con una familia abierta en una pantalla baja, scrollea,
    y la regla dice que no.

## Primitives y sistema visual

### La esquina de abajo a la derecha es UN contenedor, y un deep-link tiene que poder repetirse

**Vive en:** app/_components/EsquinaAvisos.tsx · app/_components/AvisoPixelViejo.tsx ·
app/_components/MakoConfirmGate.tsx · app/integraciones/IntegracionesBoard.tsx

Al sumar el aviso fijo «Actualiza el Pixel» (06/10/2026), la esquina ya era de «A revisar»
con su propio `position: fixed`, y el IaUsageToast ya se había ido el 27/09 por taparle la
decisión. Dos piezas fijas en la misma esquina se pisan; en un contenedor en columna, cuando
«A revisar» se abre, la de arriba sube con ella. El contenedor va con `pointerEvents: none`
y cada hijo con `auto`, o la columna vacía se traga los clics de lo de abajo.

⚠️ Y el link del aviso (`/integraciones?abrir=landing`) **no hacía nada estando ya en
/integraciones**: la ref que evita reabrir el modal se ponía en true la primera vez y no
volvía nunca. Un efecto que reacciona a un parámetro de la URL tiene que rearmarse cuando el
parámetro se va, o el segundo uso del mismo link es un botón muerto.

*2026-10-06*

### ⚠️ Un aviso fijo que pinta en TODA la app tapa los controles de la esquina de cada pantalla

**Vive en:** app/_components/EsquinaAvisos.tsx · app/globals.css (`:root:has([data-esquina-ocupada])`) ·
app/_components/Lienzo.tsx · app/whatsapp/_shared/ChatHilo.tsx

«A revisar» vivía sólo en /crm. «Actualiza el Pixel» sale en todas las pantallas, y la revisión
del 06/10/2026 lo midió en Chrome. En /chatbot el lienzo llega al borde de la ventana y su
«Publicar» está a 12 px del rincón. La pastilla, que no se cierra, le caía encima: un clic en
«Publicar» abría /integraciones y dejaba la estrategia sin guardar. Lo mismo con el «Enviar» de
cualquier chat. Encima, con z 65 la esquina quedaba sobre cinco modales de z 60.

- **La pantalla declara su rincón ocupado, y la esquina sube.** `data-esquina-ocupada` en el
  control. La regla vive en globals.css con `:root:has(...)`, porque la esquina está en el
  layout y no puede saber qué pinta cada pantalla. Una pantalla que escribiera una variable en
  el layout sería un global que alguien se olvida de limpiar. Medido: sin la marca, el centro de
  «Publicar» era la pastilla; con la marca, la pastilla sube a 64 px y el centro vuelve a ser
  «Publicar».
- **Un aviso flotante va DEBAJO de los modales** (z 55). Un modal es una decisión que la persona
  abrió, y un aviso no puede taparle el botón de cerrar. AlertaVozMaKo ya estaba en 55 por lo
  mismo.

*2026-10-06*

### ⚠️ Una barra de navegación con scroll horizontal esconde destinos, y la scrollbar oculta los borra

**Síntoma:** en la ficha del lead, las últimas tabs no existen para el usuario. No hay
flecha, no hay corte visible, no hay barra de scroll: la fila simplemente termina.

**Causa:** dos decisiones que por separado parecen razonables. `LeadTabs` ponía
`overflowX: 'auto'` en el `role="tablist"` («las tabs scrollean en horizontal si no
entran, nunca doble fila»), y `globals.css` escondía la barra por estética
(`.lead-tabs-scroll { scrollbar-width: none }`). Juntas, el único indicio de que hay más
tabs desaparece.

**Regla de la casa:** una barra de **navegación** no lleva scroll horizontal. Si no
entran, bajan de renglón (`flex-wrap: wrap`). Esto contradice al §19.2 del documento de
rediseño («las tabs deben soportar scroll horizontal en mobile») y gana la regla de la
casa: esconder destinos detrás de un gesto lateral es esconderlos. El scroll lateral
sigue siendo correcto donde lo que se corre es **contenido** —una tabla, una fila de
filtros, un bloque de código—, no el mapa de a dónde se puede ir; para eso está
`.mk-scroll-x`.

**Sin arreglar:** `app/whatsapp/EmojiPicker.tsx:261` (las pestañas de categoría) y
`app/onboarding/OnboardingWizard.tsx:544` (la barra superior del modo agencia, donde el
botón «Salir de la vista» puede quedar detrás del scroll).

**Vive en:** app/_ui/Tabs.tsx · app/crm/lead-view/LeadTabs.tsx:47 (usada por
app/crm/[id]/LeadDetailBody.tsx, app/crm/[id]/EditLeadForm.tsx y app/crm/LeadSheet.tsx) ·
regla en AGENTS.md y app/_ui/LEEME.md · *2026-08-07 ~ui-tab-siete-puntos*

### ⚠️ El ancho de una pantalla no lo achica ninguna regla: lo achica quien la escribe

**Síntoma:** una pantalla nueva «no llega al borde» y queda una franja muerta a la
derecha. Se busca la regla que la está achicando y no existe.

**Causa:** cada pantalla escribía su propio `<main>`, así que cada una elegía su tope por
separado. Medido sobre `app/`: de 44 `<main>`, **solo 3 centraban**; 16 valores de
padding distintos; topes de 720, 980, 1000, 1100 y 1200 según quién la escribió. Copiar
la pantalla de al lado propagaba el número. No hay nada que «arreglar» en el layout: hay
que sacar la decisión de la mano de cada pantalla.

**Regla:** el `<main>` es `Pagina` (`app/_ui/Pagina.tsx`), el tope es el token
`--pagina-max` y el contenido va **centrado** — un `maxWidth` pegado a la izquierda es lo
que deja la franja. Su prop `style` está tipada sin `maxWidth`, `width` ni `margin`: el
compilador rechaza el ancho, así que la regla no depende de que alguien se acuerde.
`ancho="completo"` para tablas y tableros. Si lo que necesita tope es **texto**, va en el
párrafo (`Lectura`, 70ch), nunca en la página: un `maxWidth` en el `<main>` también
angosta las tablas.

**Vive en:** app/_ui/Pagina.tsx · app/globals.css (`--pagina-max`) · *2026-08-07 ~ui-tab-siete-puntos*

### ⚠️ Un catálogo que DIBUJA la pieza en vez de montarla no sirve para revisar nada

**Síntoma:** la sección «la barra» de `/admin/ui` no se parecía a la barra de la app. El
dueño lo dijo así: «no se ve para nada igual».

**Causa:** estaba dibujada a mano — una lista de divs que imitaba el aspecto. Dos códigos
distintos para la misma cosa: no había forma de que coincidieran, y cualquier cambio en la
barra real las separaba más.

**Regla:** en el catálogo se **monta** la pieza, no se dibuja. Si el componente real no se
puede montar tal cual, se extraen sus partes y las comparten los dos. Acá el `Sidebar`
entero no se puede montar y **el motivo no es el obvio**: no es que `usePathname()`
devuelva la ruta equivocada (eso también), es que `adminShell = rol === 'admin' &&
!impersonando` hace que para el super-admin la barra pinte `ADMIN_NAV` en vez de las
familias. O sea: la tab que documenta la barra mostraría otra barra.

**Vive en:** app/_components/BarraPreview.tsx (usa `Marca`, `Familia`, `NavLink`,
`Identidad`, `panelStyle` exportados de app/_components/Sidebar.tsx) · *2026-08-07 ~ui-tab-siete-puntos*

### ⚠️ «Branding MaKo» no es un manual de marca, y las reglas que sí existen están en cinco lugares

**El diagnóstico obvio era el equivocado.** Buscar el material de marca en
`/conocimientos → Branding MaKo` parece lo correcto por el nombre. No hay nada ahí: es una
**galería de archivos descargables** (logos, gráficos, animaciones, íconos, videos) que
vive en el bucket privado `branding` de Storage, con el catálogo en la tabla
`branding_assets` (migraciones 0098 y 0100). Cero líneas sobre color, tipografía o voz.

**Dónde están de verdad:** el dorado y los neutros en `app/globals.css`; las medidas en
`app/_ui/tokens.ts`; el logo y el wordmark en `app/_components/MakoBrand.tsx`; la voz de la
IA en `lib/mako-persona.ts` + `lib/mako-prompts.ts`; las reglas de copy de la UI en
`docs/mapa-del-proyecto.md`; cómo firma la IA en `lib/pipeline.ts` (`MAKO_SETTER`) y
`lib/etapa-historial.ts`.

**Desde el 2026-08-11 los cinco lugares están juntos en `docs/branding-mako.md`**, que es la
versión que se puede llevar afuera (`/admin/ui` → Marca sigue siendo la que tiene los logos
a la vista). Ese documento es DERIVADO: la gramática de los nueve estados y la regla del
nombre las escribe `scripts/sync-gramatica-doc.mjs` desde `lib/mako-gramatica.ts`, con el
pre-push como guarda. No editar esos dos bloques a mano.

⚠️ **Y hay una SEGUNDA fuente de marca viva que contradice a la primera.**
`app/conocimientos/curso-vsl.ts:72` manda que la marca de agua del video lleve «estrella
dorada (#F6D365→#EF9F27)» — los mismos dos dorados que `globals.css:106-116` declara
eliminados. Es el único lugar de Conocimientos con reglas de marca ESCRITAS (color, Geist
bold, voz impersonal, «dinero» y no «plata», todo en «tú»), así que no alcanza con
corregir el hex: hay que decidir si es fuente de verdad o si sus reglas se mudan al manual.
La galería pública ya usa el nuevo (`app/compartido/[token]/Galeria.tsx:31`, `#F2B01E`).

**Lo que quedó SIN hacer** (está listado en `/admin/ui` → Marca → «Lo que todavía no cierra»):

- `lib/mako-grupo.ts:55` todavía pinta la marca con los dos dorados que `globals.css`
  declara eliminados (`#F6D365`/`#EF9F27`). Genera SVG como string en el servidor, así que
  no puede usar `var()`: necesita importar los hex de un módulo único.
- `MakoBrand.tsx` define seis neutros **cálidos** propios que no son tokens
  (`#1A1813`, `#F3F0E7`, `#2A251C`, `#171511`, `#A39E91`, `#6B675C`), y `globals.css` dice
  que los neutros de la app son fríos.
- El wordmark grande usa Georgia serif, que no es la tipografía de la app ni un token.
- La alternancia de color letra por letra (M dorada, a oscura, K dorada, o oscura) es una
  regla de marca que solo vive en un render.
- `lib/branding.ts:17` — el tipo `BrandingSeccion` no incluye `'marca'`, que es la sección
  que abre por defecto. No rompe hoy porque hay un `as`, pero cualquier `switch` exhaustivo
  va a estar incompleto.
- `public/mako.svg` es el logo **viejo** y además no es vector de verdad: lleva PNG en
  base64 adentro. El logo vivo es SVG en línea en `MakoBrand.tsx`.
- Los archivos originales del material de marca **no están versionados**: los scripts los
  leían del escritorio. Storage es la única copia durable.
- **No existe ningún token de letter-spacing.** Cero en `app/_ui` y en `globals.css`,
  contra **564 `letterSpacing` escritos a mano** en `app/**/*.tsx`. Si hace falta una regla
  de tracking, hoy no está escrita en ninguna parte — y con 564 usos sueltos, escribirla
  después es caro.
- **La paleta del portal `/conocimientos` no es la de la app** (lima sobre papel, no
  dorado sobre gris azulado), y su fallback hardcodeado no coincide con su propio token:
  `var(--al-accent, #C8F169)` contra `--lime: #CDF13B`.
- La fórmula **«Sos MaKo, …»** abre ~40 prompts de features y **no está declarada como
  regla en ningún módulo**: es un patrón observado, no un contrato. Un prompt nuevo que la
  omita no rompe nada y nadie se entera.
- `app/conocimientos/BrandingMaKo.tsx:24` — el «179 piezas» está escrito a mano, no
  contado, y quedó viejo cuando el script de limpieza borró gráficos y sumó 13 piezas de
  marca. Los contadores de cada tab sí se calculan.

**Vive en:** app/admin/ui/Marca.tsx · docs/branding-mako.md ·
scripts/sync-gramatica-doc.mjs · app/conocimientos/curso-vsl.ts ·
*2026-08-07 ~ui-tab-siete-puntos · ampliado 2026-08-11 ~branding-mako-fuentes (5 agentes)*

### ⚠️ El dorado no significa «MaKo»: significa «destacado». Y por eso la marca se siente a IA

**El diagnóstico obvio era el equivocado — y es el hallazgo más caro de esta área.** El
dueño dijo «la marca se siente muy IA» y todo apuntaba al mismo sospechoso: la chispa de
cuatro puntas, el ícono que usa media industria. La conclusión natural era cambiar el
símbolo, o el dorado, o los dos.

El inventario de **148 superficies verificadas una por una** (13 agentes, cada afirmación
con archivo:línea reabierto) dice otra cosa. El dorado aparece en 79 superficies y la
chispa en 84, pero **en ~25 de ellas el dorado no marca a MaKo**: marca la tab activa
(`ConfigTabs.tsx:41`), el ícono de encabezado de casi toda pantalla —el uso más repetido de
la app— (`AdminView.tsx:110`), el avatar de una persona sin foto (`AdminView.tsx:58`), el
número grande de un KPI (`comercial/page.tsx:404`), un link de texto
(`MarkdownDoc.tsx:316`), el ON de un toggle (`NotificacionesPanel.tsx:55`), el paso MEDIO
de un semáforo (`crm/lead-view/ComportamientoCard.tsx:15`), la barra destacada de un
gráfico (`pricing/Piezas.tsx:72`), chips de rol y pertenencia (`AdminView.tsx:311`), el
borde de «esta card es tuya» (`ClientesApp.tsx:307`), un spinner genérico de fetch
(`PlantillasView.tsx:83`) y «tu Norte» (`Grafo.tsx:500`, `general/page.tsx:291`).

**La rotura más cara:** en `MakoChat.tsx:192`, la pantalla donde MaKo habla, el dorado
pinta la burbuja del **humano**. Y en `/funnel` las «Automatizaciones de MaKo» se pintan de
**azul**, que en `globals.css:33` es el color declarado de «vos actuás». La marca está
invertida en las dos superficies donde más se nota.

**Causa:** `globals.css:116` declara `--accent` y `--accent-soft` como el mismo dorado con
otro nombre y **sin la restricción semántica**. El comentario de `:122-124` dice «no
agregues usos nuevos», pero `var(--accent)` es hoy el token dorado más usado de la app. Un
alias sin regla es una puerta abierta: nadie que escribe `var(--accent)` está pensando en
MaKo, está pensando «resaltá esto».

**Consecuencia en cadena, y es la que explica el síntoma.** Si el color no distingue a
MaKo, la única señal que queda es la chispa. Una chispa sola, repetida en cada superficie,
sin un color que signifique algo — eso *es* el aspecto de IA genérica. **El problema no era
que MaKo se anunciara demasiado: era que se anunciaba con una sola señal porque la otra ya
no servía.**

**La marca está copiada de oído, no importada.** Contados en el inventario:

- **21 hexes dorados/ámbar distintos** vivos en el repo. `globals.css:106-116` declara
  eliminados a `#F6D365`, `#EF9F27`, `#F0C60A` y `#C8870C` — y los cuatro siguen escritos a
  mano en `experimentos/ui.tsx:19` (tres copias de la chispa), `lib/mako-grupo.ts:53` (SVG
  generado en el servidor, no puede usar `var()`), `ServicioVisual.tsx:83` (gradiente
  `mkGold`), `NotificacionesPanel.tsx:55` y `general/page.tsx:291` (seis apariciones).
  `ScriptsBrowser.tsx:71` inventa un `#A8770F` para decir «Media».
- **6 glifos de estrella distintos**: la chispa vectorial de `MakoBrand.tsx:25`, el carácter
  `✦` (`AvisoFlotante.tsx:50`, `BuscadorTareas`), el emoji `✨` (`EmailApp.tsx:405`,
  `VozGuia`, `WhatsAppAdvisor`), `★` (`CrearTareaModal.tsx:863`), `🌟` (el primer mensaje
  de bienvenida por WhatsApp) y una de **cinco puntas dibujada a mano**
  (`CrearTareaModal.tsx:182`). Y en `BoardShell.tsx:1703` la chispa está pintada de azul,
  conviviendo en la misma pantalla con la dorada de `:984`.
- **`app/compartido/[token]/TareaCliente.tsx:437` redeclara el dorado como `--oro`** porque
  la pantalla se scopea bajo `.cd` para no heredar el chrome. Es la pantalla que ve el
  cliente, y si `--mako` cambia, no se entera.

**Regla que queda:** un color de marca necesita un **alias único y con restricción**, o se
diluye solo. Antes de tocar un hex de marca hay que arreglar `--accent`, o el rebranding
repinta 21 hexes y a los tres meses hay 22. Y la señal de una IA no puede depender de un
símbolo solo: si el color no distingue, el símbolo tiene que hacer todo el trabajo y ahí es
donde empieza a verse genérico.

**Vive en:** app/globals.css:106-126 · app/_components/MakoBrand.tsx ·
app/_components/MakoChat.tsx:164,192 · app/_components/ServicioVisual.tsx:83 ·
app/experimentos/ui.tsx:19 · lib/mako-grupo.ts:53 · app/compartido/[token]/TareaCliente.tsx:437 ·
*2026-08-13 ~inventario-superficies-mako (13 agentes, 148 superficies verificadas)*

### ⚠️ `<Mako>` tiene UN call-site de producción, y ese incumple el contrato de su propio estado

**Síntoma:** la primitive `app/_ui/Mako.tsx` y su gramática de nueve estados
(`lib/mako-gramatica.ts`) parecen el sistema vivo de la marca. Tienen catálogo
(`/admin/ui?tab=mako`), documento derivado con guarda de pre-push, y tres rondas de
rediseño encima.

**Causa:** en producción se usa **una sola vez**, en
`app/crm/[id]/resumen/AnalizarLlamada.tsx:79`. Todo el resto de las apariciones son el
catálogo (`Gramatica.tsx`). Y ese único call-site pasa `estado`, `titulo`, `fuente` y
`datos` pero **no pasa `progreso`** — que `Mako.tsx:178` declara obligatorio para
`analizando`. Verificado en el código: sin `progreso`, `Mako.tsx:333` deja el riel en null y
`Mako.tsx:383` no renderiza la barra. O sea que la única vez que un cliente ve el estado
«Revisando», lo ve **sin progreso real** — exactamente el spinner eterno que
`mako-gramatica.ts:174` prohíbe con la palabra «progreso real». Dispara el `console.warn` de
`Mako.tsx:235` y nadie lo lee.

**Regla:** un primitive sin call-sites no está terminado, está propuesto. Antes de
rediseñarlo otra vez hay que enchufarlo — si no, cada ronda de diseño se valida contra el
catálogo, que es la única pantalla donde se cumplen todos los contratos.

**Vive en:** app/_ui/Mako.tsx:178,235,333,383 · lib/mako-gramatica.ts:174 ·
app/crm/[id]/resumen/AnalizarLlamada.tsx:79 ·
*2026-08-13 ~inventario-superficies-mako*

### ⚠️ Los avisos de MaKo salen por CINCO pop-ups en cuatro esquinas, y cada uno se marca distinto

**Síntoma:** «los avisos de MaKo salen con un pop-up abajo al costado» describe bien lo que
se ve y mal lo que hay. Son cinco piezas independientes, en cuatro posiciones de pantalla,
con cinco criterios distintos de cómo se marca la autoría:

| Pieza | Dónde | Cómo se marca que es MaKo |
|---|---|---|
| `IaUsageToast.tsx:134` | abajo a la **derecha** | señal triple: chispa + dorado + la palabra |
| `AvisoFlotante.tsx:36` | abajo a la **izquierda** | el carácter `✦` en `--accent-soft` — **no** es la chispa de marca |
| `Toast.tsx:43` | abajo al **centro** | ninguna |
| `NotificationsProvider.tsx:515` y `:539` | arriba a la **derecha** | ninguna, a propósito (son de WhatsApp) |
| `MakoConfirmGate.tsx:113` | modal bloqueante | un badge con las letras «MaKo», sin chispa |

**Causa:** cada una se escribió para su caso y ninguna se escribió contra las otras. No hay
un choke point de presentación equivalente al que sí existe para el texto
(`lib/avisos.ts:73` → `emitirAviso`, con 53 mensajes en `lib/avisos-catalogo.ts`).

**Y el motor no tiene pantalla.** `emitirAviso` escribe la fila y **ninguna vista la lee**:
el badge del sidebar (`Sidebar.tsx:54-64`) cuenta otra cosa. Ya está anotado abajo en «El
feed de notificaciones existe en la base y no lo muestra nadie».

**Regla:** la autoría de MaKo se decide en **un** lugar, como el texto. Mientras haya cinco
componentes decidiendo por su cuenta si ponen chispa, cualquier cambio de marca toca cinco
archivos y se olvida de uno.

**Vive en:** app/_components/IaUsageToast.tsx:134 · app/_components/AvisoFlotante.tsx:36 ·
app/_ui/Toast.tsx:43 · app/_components/NotificationsProvider.tsx:515,539 ·
app/_components/MakoConfirmGate.tsx:113 · lib/avisos.ts:73 · lib/avisos-catalogo.ts:136 ·
*2026-08-13 ~inventario-superficies-mako*

### ⚠️ Una lista blanca de UNO se lee como regla; de DOS, se lee como excepción

**El contexto:** `exigirClienteDePrueba` protegía un solo workspace (`WS_PRUEBA = 3`) y ya
había fallado una vez en su versión negativa (`ws !== OWNER_WS`, que dejaba el botón de
vaciar dentro de **todos** los clientes reales). Al sumar el Cliente de Diseño hubo que
pasar de un número a una lista.

**Por qué es el momento peligroso, aunque el cambio sea correcto:** con un solo id, la
igualdad estricta se defiende sola — cualquiera que la lea entiende que enumerar es el
punto. Con dos, aparece la tentación de «esto se está volviendo incómodo, mejor pregunto
si NO es un cliente real», que es literalmente el bug anterior reescrito. El riesgo no
está en pasar de 1 a 2: está en pasar de 2 a 3.

**La regla, y cómo se hace cumplir:** la lista se enumera (`WS_PRUEBAS`) y **un test fija
su largo**. No es ceremonia — es lo que obliga a que un tercer workspace pase por el test
y se justifique en vez de colarse en un `push`:

```ts
assert.deepEqual([...WS_PRUEBAS].sort(), [WS_PRUEBA, WS_DISENO].sort());
assert.equal(WS_PRUEBAS.length, 2);
```

Y el test que importa de verdad no es el que prueba que el de prueba pasa: es el que
prueba que **los clientes reales siguen sin pasar**, con varios ids a la vez para que no
alcance con excluir uno a mano.

**Cómo se verifica en la pantalla, que es donde se ve el agujero:** entrar a un cliente
REAL y contar los botones peligrosos. Si aparece uno, el guard del server puede estar bien
y la UI ya está ofreciendo lo que no debe. Medido acá sobre ws 5: cero temas, cero «Datos
de Mauricio», cero Reset.

**Vive en:** lib/auth-session.ts · tests/reset-workspace.test.ts · app/api/datos-mau/route.ts ·
app/_components/PanelAgencia.tsx · *2026-08-16 ~cliente-diseno*

### ⚠️ Un `transition` sobre una custom property no se ve, y por eso el cambio de tema salta

**Síntoma:** se prende un tema candidato en `/admin/ui?tab=temas` y el cambio de color
tenía que ser gradual (400 ms, como el de nordtheme.com). Con la transición declarada en
`:root` sobre `--bg`, `--surface` y compañía, el cambio es **instantáneo**. No hay error:
simplemente salta.

**Causa:** una custom property no pinta nada por sí misma. Lo que se ve es el
`background-color` de CADA elemento que la consume, y ese es el que hay que animar. Una
transición sobre la variable anima un valor que nadie mira.

**Regla:** la transición va en los **elementos**, no en la variable:

```css
[data-tema-candidato] *,
[data-tema-candidato] *::before,
[data-tema-candidato] *::after {
  transition: background-color 400ms ease-in-out, border-color 400ms ease-in-out,
              color 400ms ease-in-out, fill 400ms ease-in-out, stroke 400ms ease-in-out;
}
```

Es exactamente lo que hace el sitio de Nord —lo declara componente por componente— y se
verificó leyendo el CSS que sirve. **Cómo se comprueba sin ojímetro:** clickear, esperar
200 ms y leer `getComputedStyle(...).backgroundColor`. Si devuelve un valor **intermedio**
(medido: `rgb(160,165,175)` entre `#3B4252` y `#ECEFF4`), la transición corre. Si devuelve
uno de los dos extremos, saltó.

**Vive en:** app/globals.css (bloque «Temas candidatos») · app/_components/TemaCandidato.tsx ·
*2026-08-16 ~tab-temas*

### ⚠️ Un preview global que se apaga a medias deja la app de un color que nadie eligió

**Síntoma:** se sale del preview de temas y la app queda en **modo oscuro** (`--bg`
`#22262E`), sin tema candidato y sin ningún control a la vista para volver.

**Causa:** el preview maneja DOS atributos en `<html>` —`data-tema-candidato` para el tema
y `data-tema` para el modo— y al limpiar solo se sacaba el primero. La rama estaba escrita
`else if (id) raiz.removeAttribute('data-tema')`, o sea que **con `id === null` no corría
ninguna de las dos ramas**.

**Regla, y vale para cualquier modo de prueba global:** el que prende dos cosas apaga dos
cosas, y el apagado se prueba explícitamente — no alcanza con ver que prender funciona. El
test de aceptación es que después de salir, los tokens vuelvan a los valores de fábrica
(`#F4F6F9` / `#8F6709`), no simplemente que «se vea normal».

**Y el corolario que ya está aplicado:** mientras el preview está puesto, un chip fijo lo
dice y ofrece la salida desde **cualquier** pantalla. Si el único lugar donde se apaga
fuera la tab que lo prende, quien se lo olvide puesto ve la app de otro color en todas las
pantallas sin saber por qué — la misma regla de AGENTS.md sobre la salida que vive adentro
de una pantalla condicional.

**Vive en:** app/_components/TemaCandidato.tsx · *2026-08-16 ~tab-temas*

### ⚠️ `.mk-scroll-x` recorta en los DOS ejes: ningún popover `absolute` puede vivir adentro

**Síntoma:** en /ads-writer, tab «Guiones», tocás «Filtrar» y no aparece nada (a lo sumo
asoma una scrollbar vertical en la barra). Los filtros de ángulo, avatar y fecha quedan
inalcanzables para todo usuario, en cualquier ancho.

**Causa:** `.mk-scroll-x` declara solo `overflow-x: auto` y deja `overflow-y` en `visible`;
por spec, si un eje es `auto` el otro `visible` computa a `auto`, así que la caja clipea en
los dos. Medido en navegador real: `getComputedStyle(scroller).overflowY === 'auto'`,
`clientHeight=41px` contra `scrollHeight=308px`, y el popover (`top: calc(100% + 6px)`)
arranca 1px debajo del content box: cero píxeles visibles. El `zIndex` no salva nada — el
clipping de overflow no se saltea con z-index. `overflow-x: clip` sí preservaría
`overflow-y: visible`, pero mata el scroll táctil, que es para lo que existe la clase.

**Regla:** cualquier menú dentro de `.mk-scroll-x` (incluido el slot `filtros` de
`PageHeader`) va en portal `fixed` posicionado por `getBoundingClientRect()` — que es
exactamente lo que hace `app/components/Dropdown.tsx` y por lo que existe.

**Vive en:** app/_ui/ui.css:445-449 (`.mk-scroll-x`) · app/ads-writer/GuionesGlobal.tsx:156,348-352 · patrón correcto en app/components/Dropdown.tsx:114-133 · *2026-08-06 ~review-adversarial-content-machine*

### ⚠️ El placeholder del Dropdown no es una opción: por eso no se puede des-asignar nada

**Síntoma:** en /admin no había manera de dejar a un usuario sin workspace. En el picker de
plantilla de WhatsApp, una vez elegida una plantilla ya no había forma de volver a «sin
plantilla», solo cambiar a otra. Mismo bug, dos pantallas.

**Causa:** el diagnóstico obvio («el backend no soporta null») era el equivocado —
`actualizarUsuario` acepta `workspace_id: null` y la columna es nullable a propósito (mig
0054). La causa real es el `Dropdown` propio: solo emite valores presentes en `options`, y
el `placeholder` es **texto del botón** cuando `value` no matchea, NUNCA un ítem
clickeable. Al migrar un `<select>` nativo que tenía `<option value="">Elegí…</option>`,
esa opción de limpiar se pierde en silencio. Y aunque llegara vacío, `Number('') === 0`
pasa el chequeo `typeof body.workspace_id === 'number'` del route y escribiría workspace 0.

**Regla:** si un campo admite «vacío», va como opción explícita `{ value: '', label: '…' }`
y el onChange manda `v ? Number(v) : null`.

**Vive en:** app/components/Dropdown.tsx:112,121 · app/admin/AdminView.tsx:429-435 · app/api/admin/usuarios/route.ts:121 · app/whatsapp/WhatsAppApp.tsx (picker de plantilla) · *2026-07-02 map-admin-clientes + 2026-07-13 ~review-commits-funnel-dropdowns*

### ⚠️ Un ícono que no existe no rompe: pinta un puntito gris o un cuadrado de color

**Síntoma (a):** un nombre mal escrito en `<Icon name>` se ve como un círculo de 3px y
nadie se entera. **Síntoma (b):** en el onboarding del Chat Agent, el ícono de WhatsApp era
un cuadrado verde liso.

**Causa:** `Icon` resuelve `PATHS[name] ?? PATHS.dot`, sin error ni warning. Para (b) la
hipótesis natural era el gradiente o el CSS, y era falsa: el símbolo usa `fill="#fff"`
plano. Lo que pasaba es que nadie montaba `<BrandDefs />` en ese árbol, así que el
`<symbol id="ic-whatsapp">` no existía en el documento, el `<use href="#ic-whatsapp">` de
`SvcIcon` no resolvía a nada, y lo único pintado era el `<span>` contenedor con background
`#25D366`. El mecanismo no es «gradiente ausente → color plano», es **«símbolo ausente → no
se dibuja NADA y se ve el fondo del tile»**. Falla 100% silenciosa: sin error de tipos, sin
warning de React, sin consola.

**Regla:** el componente que consume íconos de marca monta sus propios defs en vez de
esperar que lo haga el llamador (montarlo dos veces no rompe: el `<use>` toma el primero);
`PanelMarketing.tsx` ya lo hace. Hoy montan `BrandDefs` /integraciones, /onboarding y el
board del plan; **Configuraciones NO**. Detalle de contrato: `Icon` no acepta `color`,
`className` ni `style` — el color se hereda, hay que envolverlo en un `<span style={{color}}>`.

**Vive en:** app/_components/icons.tsx:209 · app/_components/ServicioVisual.tsx (BrandDefs + SvcIcon) · app/_components/PanelMarketing.tsx · *2026-08-01 mako-onboarding-copy-y-bugs + 2026-08-06 rediseno-notificaciones*

### ⚠️ El preflight de Tailwind hace `display:block` a todo `<svg>`: un ícono NO se centra con `textAlign: 'center'`

**Síntoma:** en el dropzone de /video-generator el ícono salía pegado a la izquierda mientras
los dos textos de abajo salían centrados. El dueño lo vio. El div tenía `textAlign: 'center'`
y todo lo demás adentro se centraba bien.

**Causa:** `node_modules/tailwindcss/preflight.css` (línea ~209) declara
`img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle }`.
`text-align` alinea el contenido **inline** de una caja; a una caja de **bloque** no la mueve.
`<Icon>` (app/_components/icons.tsx:281) y `GuardianIcon` no declaran `display` — heredan el
`block` del preflight — y `MakoLogo` pone `display:'block'` explícito. Los tres son bloques.

**El diagnóstico obvio era el equivocado:** «el padre ya está centrado, algo le pisa el estilo
al ícono». No lo pisa nada: el ícono nunca estuvo en el juego del `text-align`.

**Lo que NO es el bug** (barrido de 226 usos de `<Icon>`/`<svg>` contra 244 `textAlign:'center'`
en `app/`): un ícono adentro de un `display:'inline-flex'` **sí** queda centrado, porque el que
se alinea es el span inline-flex, no el svg — es el envoltorio que usa medio repo. Igual de sanos
un `display:flex` con `justifyContent:'center'`, un `flexDirection:'column'` con
`alignItems:'center'`, un `margin:'0 auto'` y la clase `.mk-state` (app/_ui/ui.css:341, la que
usan EmptyState/NoResults/ErrorState). Eso son 44 de los 55 candidatos: falsa alarma.

**El patrón roto real es siempre el mismo:** un ícono de bloque **solo, arriba de textos**, dentro
de una caja que se centra con `text-align`. Aparece en dos formas repetidas: la tarjeta de estado
vacío (`{...card, padding:40, textAlign:'center'}` con `<MakoLogo size={54}/>` arriba del título)
y la pantalla «MaKo está pensando…» de los modales del Perro (`<GuardianIcon/>` arriba del texto).
Once sitios en ocho archivos, todos copiados del mismo molde.

**Regla:** un ícono se centra envolviéndolo, nunca con el `textAlign` del padre:
`<div style={{ display: 'flex', justifyContent: 'center' }}><Icon .../></div>`.

**NO se arregla en `Icon`.** Ponerle `display:'inline-block'` al svg de `icons.tsx` arregla estos
once y le cambia el flujo a los ~215 usos restantes: reaparece el hueco de baseline de los inline
y se corren las filas flex que hoy funcionan. El riesgo es mucho más grande que el bug — se arregla
en el call-site.

**Vive en:** app/_components/icons.tsx:281 · app/plan/board/GuardianIcon.tsx ·
app/_components/MakoBrand.tsx:101 · arreglados: video-generator/CargarGuiones.tsx:224,
carousels/CarouselsApp.tsx:234, stories/StoriesApp.tsx:168, landing-analyst/LandingAnalystApp.tsx:368,
landing-generator/LandingWriterApp.tsx:234, plan/board/CrearProyecto.tsx:65+67,
plan/board/MakoProyecto.tsx:51+53, plan/board/EliminarModal.tsx:97+182,
plan/board/CrearTareaModal.tsx:74 · *2026-08-28 auditoría svg-block*

### ⚠️ El dorado de MaKo no admite texto blanco

Blanco sobre el gradiente `#F2A516 → #E0870A` da **2,06:1 y 2,75:1** — no llega ni al piso
de 3:1, y los labels son de 10,5-14 px (uppercase/bold), o sea texto chico que necesita
4,5:1. Verificado recalculando la luminancia. El resto del documento ya usa la solución
correcta (ámbar oscuro sobre dorado claro: `#C77E08` sobre `#FBEBCB`, `#9A6207` sobre
`#FEF6E4`), así que los badges blancos son el outlier. Oscurecer el gradiente **no
alcanza** (el extremo claro queda en ~3,3:1): la salida que pasa AA es texto casi negro
ámbar (`#3A2604`, ~5,2:1 y ~7:1) manteniendo el dorado brillante.

**Vive en:** app/vsl/estrategia/Estrategia.tsx — BORRADO el 10/10/2026; la página se mudó a app/admin/estrategia/ (Estrategia.tsx + estrategia.css), sin estas clases (.s-tier-ribbon, .s-diff-seg-3, .s-ch-lever .s-ch-id, .s-rung-1 .s-rung-n) · *2026-07-19 ~revision-landing-estrategia-vsl*

### ⚠️ El gris de de-énfasis de una barra no es `--border-strong`: da 1,23:1 y es invisible

**Síntoma:** en un gráfico de barras se ve la barra destacada y nada más. Las otras no se
leen flojo — no están. Como el valor va en texto al lado, la pantalla igual «dice» los
números y el gráfico parece correcto; lo que falta es la comparación, que es para lo que
existe el gráfico.

**Causa:** el gris recesivo era `--border-strong` (#DCE0E7) y el carril de fondo es
`--surface-2` (#F5F7FA). Son dos grises clarísimos a un escalón uno del otro: **1,23:1**.
`--border-strong` es el token de una **línea de 1px sobre el fondo del lienzo**, no el de
un área de 22-26px sobre una superficie que ya es gris. Con `--faint` (#98A0AC) da
**2,46:1**. Medido, no razonado — el validador del método:
`scripts/validate_palette.js "#1E9E57,#98A0AC" --mode light --surface "#F5F7FA"`.

**Los dos siguen abajo de 3:1**, así que el valor TIENE que estar en texto al lado, que es
la regla que el repo ya tiene («el color nunca es el único portador»). 2,46:1 no vuelve
legible la barra sola: la vuelve **visible como masa**, que es exactamente lo que se le
pide a un elemento recesivo. En oscuro el par es `--border-strong` #4A5160 → **1,46:1** y
`--faint` #7C8492 → **3,08:1**, o sea que ahí sí pasa el piso.

**Y el que aparece al arreglarlo: el acento se puede volver MENOS visible que lo
recesivo.** `tono="mako"` pinta la barra destacada con `--mako` (#F2B01E), que contra el
carril da **1,78:1**. Con el gris recesivo en 1,23:1 la jerarquía se sostenía de casualidad;
subirlo a 2,46:1 la **invierte** — las barras que no importan se ven más que la que sí. La
salida ya existe y es un token: `--mako-ink` (#8F6709) da **4,76:1**, y en oscuro
`--mako-ink` ya apunta al dorado brillante (#F2B01E, 6,08:1), así que sirve en los dos
temas sin un cuarto dorado. Los otros tres tonos ya pasaban: `bad` 3,97 · `good` 3,22 ·
`info` 4,24 en claro.

**La regla que queda:** un color de de-énfasis se **mide contra el fondo sobre el que se
apoya**, no contra el lienzo; y cada vez que se toca el gris recesivo hay que volver a
mirar el acento, porque lo que importa es la DISTANCIA entre los dos.

**Verificado en el navegador** sobre las cinco partes a la vez (`?tab=analisis`, con
`PARTES_VISIBLES` abierto a mano): 29 barras en 9 gráficos, 21 recesivas a 2,46:1, cero a
1,23:1, y las 29 filas con su valor en texto.

**Vive en:** app/admin/dev/pricing/Piezas.tsx → `Barras` (el gris y el acento) y `Riel`
(el de `DosMonedas`, que ya nacía con `--faint`) · tokens en app/globals.css ·
*2026-08-10 ~pricing-dos-monedas*

### ⚠️ «La barra de admin no se parece a la del producto» no era un problema de estilos: eran dos JSX

**Síntoma:** la sidebar del super admin no tenía secciones desplegables y se veía distinta de la de
cualquier workspace, por más que compartieran tokens, colores y clases.

**Causa:** el `Sidebar` tenía **dos ramas**. El shell de producto pintaba `<Familia>` —con su
chevron, su caja y su rail—, y el de admin tenía su propio bloque de JSX: un `<div>` con el título
de la sección y una lista de `<NavLink>` abajo. Compartían el archivo y hasta la función de estilo
de fila, así que parecía el mismo componente. No lo era.

**Regla:** **si dos cosas tienen que verse igual, tienen que ser el mismo componente.** Mientras
sean dos ramas de JSX vuelven a divergir a la tercera edición, y el síntoma aparece meses después
como «esto no quedó igual». La forma de arreglarlo no fue estilar la rama de admin: fue borrarla y
convertir sus secciones en `NavFamilia`, de modo que hereden gratis lo que se le agregue a la barra
después.

Corolario del mismo caso: **un `key` de tipo unión hay que ensancharlo antes de agregar variantes**
(`NavFamilia['key']` era `'operate' | 'analyze' | 'create' | 'content'`). El compilador te avisa —es
lo bueno de tenerlo tipado— pero solo si las secciones nuevas son del mismo tipo que las viejas.

**Vive en:** app/_components/Sidebar.tsx · app/_components/nav.ts (`ADMIN_FAMILIAS`) · *2026-08-08 rediseño de la barra de super admin*

### ⚠️ Una tab que «redirige a otra» puede ser la única puerta a una feature

**Síntoma:** un item «MaKo» en la barra de super admin que, al tocarlo, te dejaba en Clientes. Se
lee como un link roto y da ganas de borrarlo.

**Causa, doble:** apuntaba a `/admin?tab=copy`, y ese `?tab=` lo lee un `useEffect` **de montaje**.
Estando ya en `/admin`, la navegación del cliente no remonta nada, así que el efecto no vuelve a
correr y te quedás en la tab que estabas. Solo funcionaba entrando de cero. Y detrás de ese
parámetro vivía una pantalla entera —el cerebro de copywriting de MaKo— que **no tenía ningún otro
acceso**: el tab bar de `/admin` solo mostraba Clientes y Super Admins.

**Regla:** antes de borrar una tab «que no hace nada», seguí a dónde apunta. Un deep-link por query
string no es una puerta: es un atajo que depende de cómo llegaste. Si una pantalla solo se alcanza
así, no está enlazada — está escondida, y el día que alguien limpie el nav desaparece sin que nada
lo note.

**Vive en:** app/admin/AdminView.tsx (`TabCopywriting`, el `useEffect` del `?tab=`) · *2026-08-08*

### ⚠️ El «Semáforo» eran DOS tipos incompatibles, y por eso no lo encontraba nadie

**Síntoma:** ninguno. Ése es el punto. Todo compilaba, nada rompía, y en algún lado se
pintaba un color que no correspondía.

**Causa:** el mismo concepto estaba declarado dos veces, con dos vocabularios:
`Semaforo` (`lib/meta-health-ui.ts`) decía `rojo | ambar | verde | gris`, y
`SemaforoAviso` (`lib/avisos-catalogo.ts`) decía `rojo | amarillo | verde | na`. **No
coincidían en dos de los cuatro valores.** Un `switch` sobre el tipo equivocado es código
perfectamente válido: TypeScript no puede saber que quisiste decir el otro, así que cae al
`default` y pinta gris donde iba ámbar. 158 usos en 22 archivos.

**Regla:** un concepto con nombre propio se declara UNA vez, y si ya está duplicado, el
que sobrevive es el del consumidor más grande. Los valores viejos no se renombran de una:
siguen escritos en los DATOS (las ~48 filas de `CATALOGO_AVISOS`), así que la salida es una
función que acepta las dos escrituras (`normalizarSemaforo`) y una migración aparte para
las filas. Renombrar el tipo y dejar los datos viejos es cambiar un bug silencioso por otro.

Corolario que vale para cualquier color de estado: `colorDeSemaforo`/`bgDeSemaforo` ahora
derivan de la paleta de tonos (`TONO`), no de una lista de `var(--…)` escrita al lado. Es
lo único que impide que el ámbar del semáforo y el warning de un botón vuelvan a separarse.

**Vive en:** lib/mako-gramatica.ts · lib/meta-health-ui.ts · lib/avisos-catalogo.ts · *2026-08-08 rediseño Parte 3*

### ⚠️ Un estado azul en una lista de estados dorados rompe la regla de color justo donde más se mira

**Síntoma:** «MaKo está ejecutando» se veía distinto de los otros ocho estados y nada
explicaba por qué.

**Causa:** al elegir el tono de cada estado, «está pasando algo» tienta a usar el azul de
acción. Pero en la regla de la casa **azul es «VOS actuás» y dorado es «intervino MaKo»** —
y ejecutar es MaKo actuando. Leído de a un estado por vez, el azul parecía razonable; el
error solo apareció **con los nueve renderizados uno debajo del otro**, que es la única
vista donde se ve que ocho comparten significado y uno no.

**Regla:** un sistema de estados no se revisa de a un estado. El catálogo vivo
(`/admin/ui`) no está para documentar: está para poder mirarlos juntos, que es donde
aparecen estas cosas. Si vas a agregar una familia de piezas, renderizala entera antes de
darla por buena.

**Vive en:** lib/mako-gramatica.ts (`GRAMATICA.ejecuta`) · app/admin/ui/Gramatica.tsx · *2026-08-08 rediseño Parte 3*

### Una guarda que grita en falso deja de ser una guarda

`<Mako>` avisa por consola, en desarrollo, cuando a un estado le faltan los campos que el
documento le exige. La primera versión también avisaba en la variante **compacta** — que
por diseño no muestra esos campos. Resultado: nueve advertencias imposibles de resolver en
la pantalla del catálogo, y en una tabla de 40 filas habrían sido 40.

El chip es una **referencia** a un estado («esta fila está en aprobación»), no su
presentación; las obligaciones las debe el lugar donde el estado se muestra entero. La
lección no es sobre este componente: **una guarda con falsos positivos se ignora a la
semana**, y a partir de ahí tampoco avisa de los verdaderos. Antes de agregar un aviso
automático, hay que saber en qué casos NO corresponde.

**Vive en:** app/_ui/Mako.tsx (`useAvisoDeDesarrollo`, `REQUIERE`) · *2026-08-08 rediseño Parte 3*

### ⚠️ «Campos obligatorios» no quiere decir «campos siempre visibles» — y confundirlo cuesta tres rediseños

**Síntoma:** el dueño rechazó la misma pantalla **tres veces seguidas** con las mismas
palabras («está cargado», «muy fea», «no es intuitivo»). Las tres rondas de arreglos
tocaron cómo se veían los elementos y ninguna preguntó **por qué estaban ahí**. Medido:
de 25 elementos de texto se bajó a 21, y dos de las tres tarjetas no se movieron.

**Causa:** el catálogo declara `exige: ['el impacto esperado', 'el esfuerzo', …]` para que
una recomendación no sea un consejo genérico. Eso se leyó como **instrucción de layout**,
así que la tarjeta se dibujaba como un formulario —etiqueta gris, valor, etiqueta gris,
valor— y encima con un `<details>` cuyo `summary` era el **índice de las etiquetas que
había adentro** («Esfuerzo · Responsable · Objetivo · Se revisa»). Se le sacaban filas al
formulario y seguía siendo un formulario.

El agravante, que lo vuelve un defecto y no una cuestión de gusto: **lo que quedaba a la
vista se elegía por POSICIÓN** (`const [primero, ...resto] = datos`). En la aprobación eso
dejaba arriba «A quiénes: 340 contactos» y escondía «Qué reciben» detrás de un click,
mientras el botón que manda los 340 mensajes irreversibles estaba siempre visible. **Se
podía aprobar un envío sin haber visto nunca qué se enviaba.**

**Regla:** un contrato de datos dice qué tiene que TENER una pieza, nunca qué tiene que
MOSTRAR de entrada. El corte entre el primer y el segundo nivel se define por **frecuencia
de uso**, y lo que queda arriba se elige a mano, nunca por el índice de un array — elegir
por posición no es elegir.

**Vive en:** app/_ui/Mako.tsx (`Decision`, props `consecuencia` y `advertencia`) ·
lib/mako-gramatica.ts (`exige`) · *2026-08-09 rediseño de las filas de decisión*

### ⚠️ El rótulo en monospace arriba del título es un «kicker», y está prohibido

**Síntoma:** cada tarjeta de MaKo abría con una palabra chiquita en monospace («Qué
conviene hacer», «Falta un dato») arriba del título. Se defendía como «el estado se tiene
que llamar igual en las cuatro tabs».

**Causa:** es el patrón que la guía de oficio que usamos lista entre lo que **no se
negocia**: *«A kicker or eyebrow above a heading. This one is a ban, not a default: no
brief earns it back. The heading carries its own weight»*. Y en la misma lista: *«Monospace
as a costume for "technical" rather than for code, data, or measurement»*. Encima era
redundante en los tres casos — el rótulo decía «Falta un dato» y el campo de abajo se
llamaba «Falta».

De la misma fuente salió el otro diagnóstico: *«Same-size cards of icon plus heading plus
text as the page structure. **Cards are the lazy container**»*. Tres tarjetas iguales
apiladas era, literalmente, lo que teníamos.

**Regla:** el rótulo del estado sigue viviendo en `GRAMATICA` —el contrato de que se llame
igual en todos lados no se toca— pero **se pinta donde aporta**: en el chip, en una columna
de tabla, y adentro del panel abierto. Arriba del título, no. Y un grupo de cosas del mismo
tipo es una **lista con filete**, no una pila de cajas.

**Vive en:** app/_ui/Mako.tsx (`Decision`) · app/_ui/ui.css (`.mk-dec`) ·
app/admin/ui/Gramatica.tsx · *2026-08-09*

### ⚠️ El punto de color de `<Mako>` nunca se dibujó: medía 0×0, y tres rondas lo ajustaron igual

**Síntoma:** en los estados que no son de tono dorado, la marca de la izquierda era un
hueco. Nadie lo notó porque un espacio vacío de 16 px no se lee como un error.

**Causa:** `<span className="mk-dot">` solo tiene tamaño por la regla
`.mk-status .mk-dot { width:7px; height:7px }` — **descendiente de `.mk-status`**, una clase
que dentro de `<Mako>` no existe. Fuera de `Status` el span medía 0×0.

Lo que hace que valga escribirlo: en `ui.css` había **quince renglones de comentario**
explicando cómo se alinean «una estrella de 14 px y un punto de 7 px» para que las nueve
pastillas tengan la misma geometría, y se hicieron **tres rondas de ajuste fino de
centrado** sobre esa premisa. Todo eso era razonamiento sobre un elemento que no se
dibujaba.

**Regla:** un selector descendiente (`.a .b`) es un contrato con el ancestro. Si la pieza
`.b` se va a usar fuera de `.a`, su tamaño no puede depender de `.a` — y si un comentario
describe una geometría, la geometría hay que **medirla** una vez, no deducirla.

**Vive en:** app/_ui/ui.css (`.mk-mako__marca .mk-dot`) · app/_ui/Mako.tsx (`marca`) ·
*2026-08-09*

### ⚠️ Cinco «piezas» eran una pieza con cuatro juegos de números

**Síntoma:** rediseñada la fila de decisión, el dueño marcó que las otras cuatro secciones
seguían feas. Y no era que faltara aplicarles el mismo estilo: era que **no tenían por qué
existir por separado**.

Convivían cinco tratamientos para lo que MaKo pone en pantalla: una fila para las decisiones,
una línea con una barra suelta para el trabajo en curso, una tarjeta con caja para los avisos,
una caja crema para la sugerencia pegada a un campo, y una pastilla aparte para la tabla.

**Causa:** los cuatro primeros **ya tenían la misma anatomía** —marca de 16 px, columna de
texto que se estira, riel derecho— y se diferenciaban sólo en tres cosas: el relleno, el
separador y qué iba en el riel. Cada uno se escribió en una sesión distinta resolviendo su
caso, y ninguno miró al de al lado.

**Lo que quedó — dos piezas:**

| Antes | Ahora |
|---|---|
| `.mk-dec` (decisión) · `.mk-mako--curso` · `.mk-mako` (tarjeta de aviso) | **`.mk-fila`**, con el modal como su segunda capa |
| `.mk-dec__pill` · `.mk-mako--chip` | **`.mk-pill`**, con un modificador para la marca |
| `.mk-mako--inline` | `.mk-inline` — el único que no vive en una lista, y por eso el único con otro separador |

Lo único que cambia entre los tres usos de la fila es qué va en el riel y si hay chevron:
decisión → cuándo, abre · en curso → el porcentaje, no abre · aviso → importancia y cuándo,
abre. Y **el rótulo es siempre la píldora al final del título**: antes el aviso lo pintaba como
kicker arriba, el curso en gris antes del título, y la decisión como píldora — tres
tratamientos para el mismo dato.

**Regla:** antes de estilar una pieza «parecida» a otra, poné las dos anatomías una al lado de
la otra. Si comparten el esqueleto y difieren en tres números, no son dos piezas: es una con
dos configuraciones, y mantenerlas separadas garantiza que diverjan.

**Vive en:** app/_ui/Mako.tsx (`Fila`, `Pill`) · app/_ui/ui.css · *2026-08-09*

### ⚠️ Una barra de progreso suelta al lado del texto no la usa nadie

**Síntoma:** la fila de «está pasando algo» medía 1134 px y usaba ~500: el texto a la izquierda
y una barra de 220 px flotando al lado, con el resto vacío.

**Causa:** se trató la barra como un elemento más de la fila. Medido sobre el DOM real de tres
productos, ninguno hace eso:

- **GitHub Actions** no dibuja **ninguna** barra, ni en la lista ni en el detalle del run. Un
  anillo de 16 px girando a la izquierda, y en el riel derecho el texto ocupa **el mismo slot
  que la duración** cuando termina — el estado no se suma, reemplaza.
- **Uppy** pone la barra como un elemento absoluto de **2 px pegado al borde de la fila**, a
  ancho completo: no ocupa altura de layout, no tiene track visible, **es** el borde. Lo único
  que cambia es su `width`.
- **Vercel Geist** lo dice textual: *«the bar alone doesn't say what's progressing»*, y el paso
  va al lado, unido con punto medio: `Step 2 of 4 · Building`. Y nunca un porcentaje pelado.

**Regla:** dentro de una lista, la barra es el borde de la fila o no existe. Una barra con
ancho propio adentro de una fila ancha reintroduce el mismo hueco muerto de siempre. Y el
porcentaje va en el riel derecho, con la fuente y el avance en la segunda línea.

**Vive en:** app/_ui/ui.css (`.mk-fila__barra`) · app/_ui/Mako.tsx · *2026-08-09*

### ⚠️ Un `max-width` adentro de una caja ancha no acota: deja la mitad vacía

**Síntoma:** el dueño lo describió como tres cosas distintas —«textos que se cortan al medio
de la card», «cards que llegan al final del ancho y la info se queda aplastada a la
izquierda», «textos desordenados, sueltos, volando»— y era **un solo defecto**.

**Medido:** el contenido ocupaba **603 px dentro de una caja de 1134**. El 47% de la tarjeta
vacío a la derecha. Lo causaban cuatro topes puestos con buena intención: `max-width: 620px`
en la rejilla de campos, `70ch` en los párrafos y en la evidencia, y un `maxWidth: 460` suelto
en una sección del catálogo. Cada uno se agregó para «que no se lea como una tabla», y el
comentario que lo justificaba decía «acotada, la tarjeta vuelve a leerse como una tarjeta».

**La regla, que ya estaba escrita en AGENTS.md y se violó igual:** «un maxWidth pegado a la
izquierda es lo que deja la franja muerta».

**Lo que hay que hacer en su lugar** —verificado en el código fuente de tres sistemas:

- **El único ancho máximo vive en el CONTENEDOR.** En shadcn/Radix el único `max-width` está
  en `DialogContent` y adentro no hay ninguno: todos los hijos van al 100%. En Notion el
  `max-width` de la página se APAGA al entrar al peek.
- **Si hay que acotar la medida de lectura, se acota con `margin-inline: auto`** —el sobrante
  se reparte a los dos lados— o con un padding PORCENTUAL, que es lo que hace Carbon
  (`padding-inline-end: calc(20% - 32px)` en los párrafos, y **solo** en los párrafos: «anything
  besides text/p spans full width»). Un porcentaje se achica solo cuando se achica la caja; un
  `max-width` en px, no.
- Y Linear cuenta en su changelog que tuvo este mismo problema y lo resolvió **centrando** el
  contenido cuando la ventana crece, no dejando el hueco de un lado.

Por eso el detalle de una decisión se mudó a un modal de 600 px: ahí el texto llena su renglón
por construcción, sin que nadie le ponga un tope.

**Vive en:** app/_ui/Modal.tsx · app/_ui/ui.css (`.mk-modal`, `.mk-det__*`) · *2026-08-09*

### ⚠️ La barra de progreso pintaba 1% cuando el dato decía 62%

**Síntoma:** las dos líneas de «está pasando algo» mostraban una barra visualmente vacía. Se le
ajustó el ancho **tres veces** —incluido un `flex: 0 0 220px` con su propio comentario
explicando por qué `maxWidth` no servía— y ninguna miró el número.

**Causa:** desajuste de unidades entre dos contratos que nadie cruzó. `MakoProps.progreso` está
declarado **de 0 a 1**; `Progress.value` está declarado **de 0 a 100**. Con `0.62` la barra
renderizaba `width: 1%`, y con `0.33`, `0%`. El `aria-valuenow` mentía igual.

**Regla:** cuando un valor cruza de un componente a otro, el rango es parte del tipo y
TypeScript no lo ve — los dos son `number`. Si dos APIs vecinas usan escalas distintas para lo
mismo, la conversión va explícita y comentada en el punto de cruce, o se unifica la escala.
El corolario que duele: **si algo se ve mal y ya lo ajustaste tres veces, el problema no es el
estilo — es el dato.**

**Vive en:** app/_ui/Mako.tsx (rama `curso`) · app/_ui/Feedback.tsx (`Progress`) · *2026-08-09*

### ⚠️ Una página que NO hidrata se ve perfecta, y `<details>` te tapa que no hidrata

**Síntoma:** el rediseño de las filas de decisión se «verificó» con Playwright durante toda una
ronda —abrían con clic, abrían con Enter, el caret rotaba, el foco se veía— y al cambiar el
`<details>` por un modal de React **nada respondía al clic**.

**Causa:** el árbol de la app nunca hidrataba. Lo que hacía funcionar la versión anterior era
que `<details>`/`<summary>` **abre y cierra sin una línea de JavaScript**: es comportamiento
nativo del navegador. Toda la evidencia de que «funciona» era evidencia de que el HTML estaba
bien, no de que React estuviera vivo.

**Cómo se detecta, en una línea.** Un nodo hidratado tiene claves de fiber; uno sin hidratar no:

```js
Object.keys(document.querySelector('.mi-clase')).filter(k => k.startsWith('__react'))
// [] → no hidrató. Los onClick no existen.
```

Ojo con el falso positivo: el overlay de desarrollo de Next (`<nextjs-portal>`) **sí** tiene
fiber aunque la app no hidrate, así que preguntar «¿hay React en la página?» da que sí. Hay que
preguntarlo sobre **un nodo de la app**.

**Qué lo causaba, acotado a fuerza de descartar:** **`next dev` no hidrata en este proyecto;
`next build` + `next start` sí.** El camino hasta ahí, porque cada paso descarta una hipótesis
que parecía obvia:

| Se probó | Resultado |
|---|---|
| El dev server de la otra sesión | ❌ no hidrata |
| Un worktree limpio, `npm ci` propio, dev server propio | ❌ tampoco |
| `/inicio`, `/plan`, `/vsl` — páginas que nadie tocó | ❌ tampoco |
| Producción (`hola-mako.com`) | ✅ `__reactFiber$`, `__reactProps$` |
| **Build de producción LOCAL (`next start`)** | ✅ **hidrata y el clic funciona** |

O sea: no era el código, no era la otra sesión, no era el entorno de la máquina. Es el modo
desarrollo. Ni una petición fallaba, ni un error en consola, ni nada en el overlay de Next: la
página se servía entera y muda. El único síntoma lateral era el WebSocket de HMR caído
(`ERR_INVALID_HTTP_RESPONSE`), que el matcher de `proxy.ts` explica —no excluye
`_next/webpack-hmr`, así que el upgrade pasa por el gate de auth— pero excluirlo **no** devolvió
la hidratación, así que no es la causa raíz.

**Cómo verificar una interacción mientras esto siga así**, que es lo único accionable:

```bash
npx next build && npx next start -p 3215
```

Y para entrar, `/api/auth/dev-login` **no sirve**: devuelve 404 en producción a propósito. Se
firma una cookie con el mismo secret y se la inyecta en el navegador:

```ts
import { crearToken, SESSION_COOKIE } from '@/lib/auth-session';
crearToken({ sub: 'dev', email: 'dev@local', nombre: 'Dev (local)', rol: 'admin' })
// node --import tsx --env-file=.env.local … y ctx.addCookies([...])
```

**Regla:** verificar una interacción es verificar que **el handler de React corrió**, no que el
DOM cambió. Si lo que probás puede funcionar sin JavaScript —`<details>`, un `<a href>`, un
`<label for>`, un formulario nativo— la prueba no dice nada sobre tu código.

**Vive en:** cualquier verificación con navegador · `app/api/auth/dev-login/route.ts` ·
`proxy.ts` (el matcher) · *2026-08-09*

### ⚠️ `nota` y `placeholder` del catálogo de credenciales son texto muerto

`ServicioConfigForm` trae `nota` del API y la tipa (l.46) pero **no la pinta en ningún
lado**, y el `placeholder={sem.placeholder}` (l.488) no sale del catálogo: sale de
`semaforo()` (l.93), que devuelve 'Pendiente' / 'Opcional' / '••••1234'. O sea que «Con el
prefijo act_», «Token de usuario de sistema (no expira). Permisos: ads_read,
ads_management, business_management» y las demás notas de `metodo-catalogo.ts` NUNCA se ven
en la pantalla donde se pega la credencial: las pistas de formato solo existen si el
cliente abre el '?'. Costo real: el cliente pega el ad account sin `act_` y el guardado
falla. Es el mismo patrón que las features de la landing — un campo del catálogo que nadie
renderiza.

**Vive en:** app/integraciones/ServicioConfigForm.tsx (nota 46, semaforo 93, placeholder 488) · lib/metodo-catalogo.ts (nota/placeholder por servicio) · *2026-07-31 auditoria-tokens-meta*

### En un grid, el eje vertical también necesita `minmax(0,1fr)`

Ponerle alto fijo a un modal de dos columnas y `overflow:auto` a la columna que scrollea
**no alcanza**: si el grid no declara `grid-template-rows`, la fila implícita es `auto` con
`min-height:auto`, o sea que no deja que los hijos se achiquen por debajo de su contenido —
la fila crece, desborda el alto fijo y el `overflow:auto` no hace absolutamente nada. Hay
que agregar `grid-template-rows: minmax(0,1fr)` y `height:100%` en el grid (un hijo grid no
hereda el alto de un padre `display:block`). Es el mismo truco que ya está en el eje
horizontal de `.mk-svc-modal` y que todos olvidan replicar en el vertical. Ojo también con
el media query de apilado: al pasar a 1 columna se generan 2 filas implícitas y hay que
resetear el `grid-template-rows`.

**Vive en:** app/globals.css:205-208 (.mk-svc-modal) y :214-227 · app/integraciones/IntegracionesBoard.tsx:492-493 (ModalShell) · *2026-07-16 integraciones-modal-v2-investigar*

### `flex:none` + `width:100%` junto a un label `nowrap` desborda siempre

En una fila flex con gap, una barra con `flex:none` y `width:100%` inline se come todo el
ancho del contenedor y no puede encogerse; el label hermano tiene `white-space:nowrap`, así
que su min-content es el texto entero y tampoco encoge. Barra(100 %) + gap + label excede
la fila **siempre** — es independiente del ancho real de la card. Solo desbordaba el primer
paso del embudo (los de 50 % y 24 % dejaban lugar), y el `overflow-x:hidden` de la raíz lo
escondía cortando justo el número. Arreglo: la barra va dentro de un track `flex:1;
min-width:0` y el label `flex:none`, para que el `width:X%` se mida contra el espacio que
sobra.

**Vive en:** app/vsl/estrategia/Estrategia.tsx — BORRADO el 10/10/2026; la página se mudó a app/admin/estrategia/ (Estrategia.tsx + estrategia.css), sin estas clases (.s-fbar-row / .s-fbar / .s-fbar-lbl) · *2026-07-19 ~revision-landing-estrategia-vsl*

### El placeholder animado no cuesta renders: cuesta el NOMBRE del control

La pregunta natural ante un placeholder que se escribe y se borra es «¿cuánto cuesta un
setState por letra?». Se midió en navegador real: escribir el atributo `placeholder` cuesta
**1,2 µs**, o sea nada. El diagnóstico obvio era el equivocado. El daño real es otro: el
algoritmo de nombre accesible cae al placeholder como ÚLTIMO recurso, así que un input sin
label toma su nombre del placeholder, y rotarlo cada 3 segundos le cambia el nombre al
control cada 3 segundos — rompe el control por voz (el usuario dice «hacé clic en X» y para
cuando termina la frase ya es otro) y JAWS/NVDA siguen anunciando el viejo.

**Regla:** animar el placeholder solo es aceptable si el input YA tiene un nombre accesible
fijo que no sea el placeholder (label real conectado por `htmlFor`, como documenta
`app/_ui/Field.tsx`). Dato empírico del mismo barrido: v0, Perplexity, Claude y Linear NO
rotan el placeholder — ponen la animación en el titular y los ejemplos como chips
clickeables.

**Vive en:** app/_ui/Field.tsx (el label conectado por id) · aplica a cualquier input nuevo de captura (/ideas) · *2026-08-07 ideas-content-machine*

### Un componente declarado DENTRO del render remonta todo el subárbol en cada tecla

**Síntoma:** un input dentro de una lista perdía el scroll y el foco con cada tecla, y las
61 opciones se volvían a montar enteras — parecía un problema de virtualización o de `key`.
**Causa:** el componente estaba declarado dentro del render del padre, así que React lo
trata como un TIPO nuevo en cada pasada y remonta el subárbol completo. **Solución:** una
función que devuelve el elemento, no un componente anidado.

**Vive en:** app/crm/SelectorHora.tsx · *2026-08-07 contexto-mako-md*

### `getComputedStyle` con la pane oculta devuelve valores viejos

Verificar por el style inline o por un `data-*`, nunca por el estilo computado de algo que
todavía no se mostró.

**Vive en:** UI general · *cosecha 08/2026*

### Regla: antes de inventar un componente, copiar el molde que ya existe

El dueño lo pidió una y otra vez, y siempre por el mismo motivo: lo reescrito a mano sale
peor y con features faltantes. Vale para el contenedor, el modal, el pop-up de detalle, el
filtro, la barra de búsqueda, el chat de clientes, el resumen del archivero y el botón azul
de subir.

- «debería ser EXACTAMENTE igual al contenedor que ya hicimos… Esa lógica ya la construiste
  en el detail, copiala tal cual» (2026-08-05)
- «NO debe ser un detalle diferente al de siempre, debe ser exactamente el mismo pop-up»
  (2026-06-23)
- «No construyas nada nuevo, replica todo… Cuando construyes un chat nuevo, hay muchas
  cosas que te saltas y omites» (2026-07-14)
- Al replicar una vista para otro rol o ruta: se copia la vista **completa**, no un
  resumen, ni se reconstruye la funcionalidad de nuevo. «Debería ser igual, y con el mismo
  diseño que está en super admin. Solo tienes que copiar lo mismo, no inventar nada nuevo»
  (2026-07-29)
- Al replicar una sección/vista/curso: **tal cual**, mismo orden, mismo copy, misma
  animación. «Tampoco los copy están exactamente iguales… Les agregaste cosas innecesarias»
  (2026-07-23)
- Si pasa una imagen de referencia, se copia hasta que sea igual, no se aproxima. «La llave
  sigue sin parecerse. Copiala bien» (2026-07-01)
- Y antes de construir de cero algo grande, buscar un open source que ya lo tenga y
  copiarle diseño y features: «podemos COPIAR código de proyectos open source como este:
  github.com/TryGhost/Ghost… Eso nos ahorrará muuucho trabajo» (2026-08-06)

**Vive en:** app/_ui (el catálogo vivo está en /admin/ui) · [app/_ui/LEEME.md](../app/_ui/LEEME.md)

### Regla: los desplegables son el `Dropdown` propio, con su comportamiento

Nada de `<select>` nativo ni de listas planas. El comportamiento pedido, junto:

- Diseño propio, no plano; se abre al pasar el cursor y se cierra solo al elegir una opción
  («trabaja en el diseño de todos los desplegables… Que esté así de plano es muy feo»,
  2026-06-22).
- Se abren **a la derecha**, no hacia abajo («Prefiero que todos los desplegables se abran
  a la derecha», 2026-07-01).
- Ninguno empuja la app hacia abajo ni se corta en la topbar: si no entra, **abre hacia
  arriba** («ningún desplegable debería comportarse de esa manera, en donde desplaza a toda
  la app hacia abajo» / «El desplegable se pone solo en la top bar y no se puede ver, omg,
  es básico eso», 2026-06-29).
- En listas de bloques desplegables, **el primero viene abierto y el resto plegados**
  (2026-07-30).

**Vive en:** app/components/Dropdown.tsx · *memoria [[dropdown-custom]]*

### Regla: filtros y ordenamiento tienen una sola forma

- Los filtros y las opciones múltiples van **siempre en un desplegable** (con capas si hace
  falta), a la derecha de la searchbar. Nunca botones acumulados uno al lado del otro,
  nunca filtros debajo. «los filtros deberían ser un desplegable, como siempre… como ya
  habíamos dicho antes» (2026-07-13).
- Si son muchos, se **agrupan** detrás de un solo botón, no se apilan en una lista con
  scroll: «hay que hacer un scroll muy grande para ir abajo del todo. Tienes que agruparlos
  en 4» (2026-07-26).
- El ordenamiento es el clásico de **dos clicks** (asc/desc) y va **antes** que el resto de
  los controles: «apretás una vez se ordena para atrás, apretás otra vez, se ordena para
  adelante. Más simple» (2026-07-26).
- Si él ya definió una forma de ver los filtros, se respeta tal cual: «Diseñé a propósito
  una forma de ver los filtros y lo hiciste como quisiste…» (2026-07-15).

**Vive en:** el slot `filtros` de `PageHeader` (ojo con `.mk-scroll-x`, ver arriba)

### Regla: editar es hacer click sobre el texto

Sin botón de editar, sin que cambie la disposición y sin que aparezca un recuadro
(«Prefiero que no exista el botón de editar… que no cambie en nada la disposición»,
2026-07-27). Cuando sí hace falta un botón, hay **uno solo por pantalla**: nada de un botón
de editar adentro de otro botón de editar («solo hay 1 botón de editar y es el mismo
siempre», 2026-07-04). Y una **preview es preview**: se ve linda y de solo lectura, nada
editable por default; si se puede editar, va un botón de editar/guardar **por caja** («NO
debería ser editable el texto», sobre avatares y razones, 2026-07-27).

---

## Modales y capas

### ⚠️ Un `zIndex` literal en una pieza que se apila queda debajo del backdrop

**Síntoma:** confirmás, la pantalla **no se mueve** y nada explica por qué. Ni error, ni
spinner, ni cartel.

**Causa:** el loader y el cartel final «Datos actualizados» tenían `zIndex: 100`
hardcodeado, y la pila de modales (`useCapaModal`) arranca en **130**. Estaban pintados,
debajo del backdrop. Dos síntomas idénticos, dos literales distintos, el mismo error.

**Regla:** una pieza que se monta apilada **no elige su z**: lo hereda de la capa
(`capa.z`), o se pinta **dentro** de la tarjeta con `position: absolute` sobre un
contenedor `relative` — así hereda el z que la capa ya le dio. Un número literal en un
overlay es una apuesta contra el orden de montaje. Del mismo arreglo: la cortina del loader
usa `var(--surface)` en una capa propia y no un `rgba(255,255,255,.78)` fijo, que en tema
oscuro era un flash blanco. **Ningún color fijo en un overlay.**

**Vive en:** app/_components/pila-modales.ts (`useCapaModal`) · app/_components/WizardShell.tsx

### El loader tiene que tapar también el header y el footer

Es donde están los botones que no hay que tocar: ✕, Atrás, Siguiente/Confirmar y el click
en el backdrop. Tapar solo el cuerpo deja la salida abierta a mitad de una escritura. El
dueño lo pidió más fuerte todavía: toda operación larga **bloquea** el cierre del modal, la
navegación y el refresh, con aviso — «NO debería dejarme cerrar ese modal ni hacer nada.
Incluso si me quiero salir de la tab o refrescar, impedírmelo con un aviso» (2026-07-30).

**Vive en:** app/_components/WizardShell.tsx

### Regla: el modal tiene largo fijo y scrollea por dentro — nunca crece

Jamás se agranda según el contenido ni según la tab, y jamás se sale de la pantalla:
aparece scroll adentro. Desplegar un bloque de contexto tampoco lo agranda.

- «jamás se debe agrandar el modal, debe aparecer un scroll… Se rompe y no se puede leer ni
  apretar el botón de siguiente» (2026-08-05)
- «está muy largo, se sale de la pantalla. Debería tener scroll, pero no salirse»
  (2026-07-15)

**Vive en:** app/_components/WizardShell.tsx · el `ModalShell` de app/integraciones/IntegracionesBoard.tsx:492-493

### Regla: nunca dos modales visibles a la vez, y cerrar devuelve al anterior

Hay un orden. El de abajo **se esconde** y vuelve al cerrarse el de arriba; cerrar el de
arriba **no cierra la pila entera**. Y un modal de trabajo se cierra solo por la ✕, no por
click afuera.

- «había otros atrás, es muy molesto ver 2 modales al mismo tiempo. Siempre tiene que haber
  un orden» (2026-07-19)
- «Te pedí explícitamente que los pop-up no se superpongan y sí lo hacen…» (2026-07-22)
- «no me debe cerrar todo, me debe volver al modal de todas las reuniones, eso como regla
  siempre, es experiencia de usuario» (2026-08-02)
- **Un solo pop-up por flujo:** nada de un modal que abre otro modal para completar el
  mismo paso. «Sigue saltando un pop-up previo donde hay que subir los creativos. No quiero
  que hayan 2 pop-up. Quiero que sea uno solo» (2026-06-30)

**Vive en:** app/_components/pila-modales.ts · *memoria [[pila-de-modales]], [[cerrar-vuelve-al-anterior]]*

### Regla: cerrar un modal no descarta el trabajo a medias

Al salir de un pop-up o de un flujo, el borrador se conserva —incluidos adjuntos y audios
grabados sin enviar—, el modal se vuelve a abrir por el mismo botón, y lo ya extraído queda
guardado para siempre. Si hay un proceso corriendo, sigue corriendo o queda en borrador:
nunca obligarlo a re-analizar ni a reescribir.

- «Al salir del pop-up, debo conservar el borrador, porque sino tengo que empezar todo
  nuevamente» (2026-06-30)
- «si una importación está pendiente y yo cierro el modal, eso debería seguir trabajando
  allí o quedándose en borrador» (2026-08-06)

### Regla: confirmar es un modal de la app que PREVISUALIZA lo que va a pasar

Nunca el `confirm()` nativo del navegador («nunca el típico de HTML que salta arriba,
siempre un pop-up nativo», 2026-07-12). Y toda acción irreversible o generada por IA pasa
por ese modal mostrando exactamente el resultado: «antes me confirmes que hay un modal de
"confirmación" en donde pueda previsualizar todas las tareas que le está por mandar a
evaluar con el perro. Porque de lo contrario, se van a crear muchas tareas que pueden estar
mal» (2026-07-17).

### Un «no volver a mostrar» nunca puede esconder su propia vía de reapertura

`DatosConfirm` decía textual «Podés reabrirlo cuando quieras desde el ícono ⚠ del plan», y
el botón que lo reabría estaba gateado por `!datosOff` — o sea que desaparecía exactamente
cuando el usuario aceptaba apagarlo, dejando la feature de deadlines/checklists inalcanzable
para siempre hasta limpiar localStorage. Agravante del mismo caso: el auto-open era
agnóstico de vista, pero el botón de reapertura solo se renderizaba en kanban, y la vista
por defecto es 'prioridades'.

**Regla:** el copy de un diálogo es un **contrato**; si promete una vía de vuelta, esa vía
tiene que existir en TODAS las vistas donde el diálogo puede aparecer.

**Vive en:** app/plan/board/BoardShell.tsx · app/plan/board/DatosModal.tsx · *2026-07-19 ~review-datosmodal-plan-board*

---

## Wizards y formularios

### ⚠️ `WizardShell` llama a `useCapaModal` pero nunca engancha `capa.refScroll`

La pila de modales promete que al cerrar el de arriba, el de abajo vuelve con el scroll
exactamente donde estaba. **En los wizards no funciona en ninguno:** `WizardShell` usa
`useCapaModal` para el z-index y la visibilidad, pero no le pasa `capa.refScroll` al
contenedor que scrollea. Volvés de un modal apilado y estás arriba de todo. Engancharlo es
un cambio de comportamiento para los **24 llamadores**: merece su propia pasada.

Esto rompe además una regla del dueño que vale para toda la app: volver atrás **por
cualquier vía** devuelve al punto exacto donde estabas (scroll incluido) y a la pantalla
anterior, no a la raíz de la tab («Si vuelvo para atrás de la manera que sea, me tiene que
deslizar al punto en el que estaba antes», 2026-07-22).

**Vive en:** app/_components/WizardShell.tsx · app/_components/pila-modales.ts · *2026-08-07 contexto-mako-md*

### ✅ Una pregunta tipo 'escala' con opciones de texto se contesta con un 3 que no significa nada

**RESUELTO el 2026-08-08.** Se documentó acá el 2026-08-05, con el fix correcto ya escrito
abajo, nadie lo ejecutó, y volvió a la pantalla del dueño tres días después: «¿Cuál es el
deadline para tener los ángulos listos?» con botones del 1 al 5. *Eso* es lo que hay que
recordar de esta entrada — **un hallazgo escrito y no ejecutado no protege de nada**.

Lo que pasaba: los dos renderers pintaban 1..5 pelados cuando `tipo==='escala'` y
**descartaban** `q.opciones`. Y no era un mistype raro: el prompt de reuniones ordenaba
«CERRADAS SIEMPRE: cada pregunta con 2-4 opciones concretas» y metía 'escala' en el enum
**sin definir nunca qué significa**, así que `{tipo:'escala', opciones:['15 de agosto','Fin
de mes']}` era la salida ESPERADA. El saneo se quedaba con el token y tiraba las fechas; al
Perro le llegaba «la pregunta → 3».

Cómo se cerró: el contrato entero (tipos + saneo + el texto que leen los modelos) se mudó a
`lib/preguntas-contrato.ts`, los dos renderizadores se fusionaron en `PreguntaCampo`, y hay
16 tests. La causa de fondo no era el prompt sino que **no existía código que lo validara**
— ver «Una regla en un prompt no es una regla» en AGENTS.md. Detalle completo en
[hallazgos-plan.md](hallazgos-plan.md).

**Vive en:** lib/preguntas-contrato.ts · app/plan/board/guardian-form.tsx (PreguntaCampo) · tests/preguntas-contrato.test.ts · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense · resuelto 2026-08-08*

### ⚠️ El loader de un paso de WizardShell va en la PIEZA: un overlay propio queda por debajo

`TareasRecibidasModal` tiene dos `return`. El overlay con el spinner y el «no cierres ni
refresques» estaba en el segundo (la lista de tareas); cuando `paso === 'preguntas'` la
función corta antes y **no se renderiza nunca**. O sea que al confirmar desde la última
pregunta —el camino normal de una reunión de Fathom— lo único que pasaba en pantalla era
que el botón cambiaba a «Guardando…», con el cuerpo de la pregunta intacto detrás. Crear
las tareas y que el Perro las puntúe tarda minutos: se lee como que la app se colgó.

La salida NO es mover el overlay: uno con z-index propio queda **por debajo** del modal
cuando hay dos abiertos (ya está documentado en el loader de `WizardShell`, que va
`position:absolute` dentro de la tarjeta justo por eso). Para esto existe la prop
`cargando`, que además traba Atrás y el cierre mientras dura; se amplió de `string` a
`ReactNode` para que entrara la segunda línea que explica la espera.

Dos vicios más del mismo overlay, los dos contra reglas que el propio `WizardShell`
documenta: el velo era `rgba(255,255,255,.86)` —un flash en tema oscuro— y estaba aplicado
con `opacity` sobre el contenedor, que apaga también el spinner y el texto. El velo va en
su propia capa y sale de `--surface`.

**Vive en:** app/plan/board/TareasRecibidasModal.tsx (rama `paso === 'preguntas'`) · app/_components/WizardShell.tsx (prop `cargando`) · *2026-08-08*

### ⚠️ Un `?? lista[0]` para un índice fuera de rango convierte «terminaste» en «volvé a empezar»

`const esc = escenarios[escIdx] ?? escenarios[0]`. Al apretar «Terminar el ensayo»,
`siguienteEscenario()` deja `escIdx === escenarios.length`, el `??` cae en el escenario 0 y
el efecto lo **reabre** con semilla nueva, con todos los puntos de progreso apagados y sin
cartel de cierre — la única pista de que terminó es que el «Siguiente» del footer se
habilitó en silencio.

**Regla:** el fallback de un índice fuera de rango es `null` (y una pantalla de cierre),
nunca el primer elemento.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:597 y :1237 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent*

### Dos modos de la misma pieza tienen que contestar igual

**Síntoma:** el wizard pinta **«Último paso (7)»** y justo abajo el botón dice
**«Siguiente →»**.

**Causa:** `WizardShell` acepta el progreso de dos formas —`pasos` + `pasoActual` (el mapa)
o `total` + `idx` (dos números)— y respondían **distinto al mismo estado**. Con la cuenta en
cero y `enUltimo` en `false`, el modo `total` decía «faltan pasos» (bien) y el modo `pasos`
se creía en el final.

**El diagnóstico obvio era el equivocado.** Parecía inalcanzable: en el único llamador del
modo nuevo, el resumen siempre era el último del mapa. Se volvió alcanzable **al migrar el
onboarding**, cuyo mapa son **secciones** y tiene varias pantallas por sección. O sea: el
bug latente lo activa la migración siguiente, no el código que lo contiene. El orden de las
dos tareas importaba y nadie lo había mirado.

**Regla escrita ahí: `enUltimo` gana en las dos direcciones.** Si dice que es el último, no
hay cola; si dice que no lo es y la cuenta da cero, la que miente es **la cuenta**. Y cuando
una pieza acepta dos formas de recibir lo mismo, la aritmética vive en **una** función pura
que las dos llaman — si no, el segundo modo es el que se queda viejo.

**Vive en:** app/_components/wizard-progreso.ts (la aritmética, pura y con tests) · app/_components/WizardShell.tsx

### Los dots mienten si `total` no es confiable

La posición actual siempre es verdad; la **cola solo existe si se puede contar**.
`futuros = -1` (faltan, cantidad desconocida) pinta tres puntitos de 4px, no puntos-paso.
Colapsa cuatro casos: `total` desconocido, `idx >= total`, `enUltimo` con `total` mayor, y
**salto hacia adelante** — si el wizard se saltea pantallas, `total` deja de servir.

Ese estado se marca **en render, no con `useEffect`**: con efecto, el primer frame del salto
sigue mostrando la fila vieja, que es justo la mentira que se quería sacar.

En el modo `pasos` la cuenta es **exacta** mientras el mapa no se mueva; si el mapa cambia
estando a la vista, pasa a «faltan pasos» y se queda ahí (pegajoso). **Los cambios de mapa
mientras la pieza está trabada por `cargando` no cuentan**: ahí el mapa se está armando y el
usuario no pudo leer ninguna promesa. La comparación mira también el `trabado` del render
**anterior**, porque la respuesta que apaga el loader trae el mapa nuevo en el mismo commit.

**Vive en:** app/_components/wizard-progreso.ts

### El chrome forkeado es donde vuelven los bugs ya arreglados

El wizard con ramas de verdad (`app/crm/StageMoveDialog.tsx`) tenía su **propia copia** del
header, los puntitos, el footer y el loader — ~60 líneas. Ahí vivía un bug de z-index que la
pieza compartida no tiene, y ahí no llegaba ninguna mejora del progreso.

**Regla:** el marco se importa; lo que se queda en el llamador es el **contenido** y la
**navegación** (qué pasos hay, cuándo se puede avanzar). Si el llamador necesita algo que el
marco no da, se le agrega al marco como modo — con la aritmética compartida.

**Detalle de contrato** que se descubrió al migrar: el prop `error` es **una línea de
texto**. Una lista de faltantes con un botón «Completar lo que falta →» va como último hijo
del cuerpo, no ahí.

**Vive en:** app/crm/StageMoveDialog.tsx · app/_components/WizardShell.tsx

### Un fetch gateado por paso muere cuando el wizard REANUDA en un paso posterior

El ensayo pintaba «Tu nota de voz (no disponible)» con los 3 audios grabados. Causa: la
biblioteca de audios se hidrataba solo con `pasoKeyRef.current === 'voz'`, y `cargar()`
aterriza en el **primer paso no hecho** — con 'voz' ya completo eso es 'ensayo', así que
nunca se pasaba por 'voz'. En el recorrido secuencial NO fallaba: el bug aparece solo al
**retomar**, que es lo que hace todo el que no termina de una sentada. Y el fix obvio no
alcanzaba: mover la carga al montaje solo convertía la falla determinista en una carrera,
porque el escenario se abre UNA sola vez (`msgs.length > 0`) y nadie vuelve a mirar los
audios — hizo falta además `if (audios === null) return;` con `audios` en las deps.

**Regla:** antes de gatear un loader por paso, preguntá **en qué paso puede montar la
pantalla**.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:460 (viejo), :467 y :632 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent*

### El error normal viene en JSON; el 504 de la plataforma viene en HTML, y ahí revienta el `.json()`

En el paso Archivero del onboarding, el route de preguntas devuelve `{ok:false}` ante un
error normal y el cliente lo manejaba bien. Lo que trababa al usuario era el otro camino: la
ruta llama a la IA con `maxDuration 60`, y un timeout de plataforma devuelve una **página
HTML** de error, así que `res.json()` LANZA y cae al catch — que solo hacía
`setVista('archivos')` sin marcar `huecosRevisados`. Como el guard de «Siguiente» es
`if (gaps.length > 0 && !huecosRevisados) return true`, cada click se consumía y el usuario
quedaba **encerrado en el paso para siempre**.

**Regla:** el catch de un `await (await fetch()).json()` dentro de un wizard tiene que ser
**fail-open** (marcar revisado + avisar), porque ahí no estás atrapando el error del backend
sino el de la infraestructura.

**Vive en:** app/onboarding/Archivero.tsx:259-262 (ya corregido con fail-open explícito) · *2026-07-29 ~auditoria-archivero-onboarding*

### Regla: una pregunta por pantalla, cerrada, sin «Saltar» y con vuelta atrás

Es la regla que más veces repitió —al menos cinco entre julio y agosto— y la que más veces
se rompió. Si un form no está así, se modifica antes de seguir.

- **Una sola pregunta por slide**, minimalista y centrada. Nunca dos preguntas en el mismo
  paso, nunca todas juntas en una pantalla. «Prefiero preguntas concretas, mejor si es 1
  sola pregunta, en el medio de la pantalla, modo minimalista» (2026-06-21) · «hoy viven las
  2 preguntas dentro del mismo paso, cuando dijimos que los formularios se crean de a 1
  pregunta por slide» (2026-08-05) · «JAMÁS debes crear formularios como el que hiciste,
  todas las preguntas juntas en lugar de 1 por slide, y lo peor son las preguntas abiertas»
  (2026-08-05)
- **Preguntas cerradas con opciones pre-escritas.** Las abiertas son el último recurso, y en
  MaKo están directamente prohibidas: si hace falta un dato libre, se convierte en opción
  múltiple o multi-select. «vi que la personalidad al final me dio una pregunta abierta,
  cuando dijimos que está prohibido. Si quiere preguntarme de muletillas, me puede poner
  múltiples opciones con multiple select» (2026-07-31)
- **Variar el formato** según lo que se pregunta: multi-select, escala lineal, puntuación
  1..X, comparación. No todo multiple choice. «TODAS las preguntas siguen siendo multiple
  choice…» (2026-07-22)
- **Sin botón «Saltar».** «Elimina la opción de 'Saltar' de toooodos los formularios. Que no
  exista esa opción nunca» (2026-07-30)
- **Siempre se puede volver atrás** a corregir una respuesta ya dada (2026-07-30).
- **Se guarda dónde ibas.** «Me salí del form y al volver a entrar estaba en la pregunta 1,
  debe guardar el historial» (2026-07-23)
- **Primero archivos, después preguntas:** un solo botón para que suelten TODO, la IA
  rellena internamente, y solo lo que ningún doc resolvió se pregunta. «el archivero es
  TOTALMENTE lo contrario a simple… Lo llenaste de preguntas abiertas, es una tremenda
  fricción… debería ser UN solo botón como siempre hacemos en nuestros forms… Y que rellene
  INTERNAMENTE esas preguntas… ahí sí se le pregunta, DE A 1 PREGUNTA» (2026-07-26)
- **Preguntá hechos, no acciones:** la pantalla 1 es el hecho real; la etapa se **deriva**
  del funnel, no se pregunta. *memoria [[form-preguntar-hechos-no-acciones]]*

**Vive en:** app/_components/WizardShell.tsx (el molde) · app/onboarding/* · *memoria [[minimizar-config-usuario]]*

### Regla: el «Siguiente» se bloquea si el paso anterior no está completo

«aún puedo darle al botón "Siguiente" sin haber definido el entregable, revisa MUY BIEN eso,
NO debería poder avanzar jamás si lo anterior no está listo» (2026-07-30). Ojo con la
contracara: un guard que se traba por un error de infraestructura encierra al usuario (ver
el 504 del Archivero, arriba).

### Regla: cada paso declara PARA QUÉ existe

No alcanza con decir qué hace. «No puede ser simplemente "Leeré tus conversaciones" pero
¿PARA QUÉ?» (2026-08-01). Lo mismo antes de pedir un dato: contextualizá por qué se lo pedís,
y al recibir un archivo demostrá que lo analizaste antes de pedir más — «primero me debe
decir "Veo que este documento trata de X cosa" y ser detallista, para que se note que se
analizó» (2026-07-27). El resultado se muestra en secciones desplegables, como en el resto
de la app.

### El molde de los modales y formularios tiene que estar escrito

No es un detalle: el dueño se cansó de repetirlo ronda tras ronda. «No sé cómo hacer que
guardes los registros de cómo armamos estos modales para que lo hagas bien» (2026-08-01).
Este documento es ese registro — si aparece una variante nueva del molde, se escribe acá
antes de mergearla.

---

## Onboarding

### ⚠️ `marcarPasoTab` pisa la pegajosidad: una tab terminada vuelve a «pendiente»

**Síntoma:** un cliente que ya había cerrado el onboarding de una tab reabre el wizard, toca
cualquier paso y queda encerrado otra vez.

**Causa:** `getEstadoTab` respeta el estado guardado
(`parsed.status === 'done' || todo ? 'done' : 'pendiente'`) justamente para que agregar
pasos no re-encierre a nadie, pero `marcarPasoTab` **recalcula duro contra el catálogo
actual y persiste el resultado**: si el catálogo ganó un paso obligatorio nuevo, el `done`
viejo se pierde para siempre en el primer clic.

**Regla:** si agregás un paso NO opcional a `TAB_ONBOARDINGS`, asumí que todos los
workspaces que ya la tenían cerrada vuelven a pendiente — decidilo antes de desplegar, no
con clientes adentro. Y **no renombres una key existente**: el wizard retoma en el primer
paso incompleto, así que una key nueva aterriza en ese paso a todo el que ya había terminado.

**Vive en:** lib/tab-onboarding-state.ts:214-236 (getEstadoTab vs marcarPasoTab) · *2026-08-02 ~investigar-onboarding-chat-agent*

### ⚠️ El server responde `ok:true` y descarta en silencio: dos formas de perder datos

**(1)** El route de fotos salta cualquier archivo >15 MB, acumula el motivo en `warnings` y
responde igual `{ ok: true, warnings, ...estado }`; el cliente hace `if (j.ok) setEst(j)` y
**nunca lee warnings**, así que la foto no aparece y no hay ningún mensaje. Encima el filtro
del cliente solo mira `type.startsWith('image/')`, no el tamaño, así que el archivo SÍ se
sube.

**(2)** Los routes de entregables y razones hacen `.filter(x => x.nombre)` al guardar: si el
usuario selecciona-todo el nombre para reescribirlo y hace blur antes de tipear, el update
optimista mantiene la tarjeta un instante y la respuesta del server **la borra entera**, con
su `queEs`/`fomo` o su copy y guion. Sin confirmación, sin undo y sin recuperación (el
getter reaplica el mismo filtro).

**Regla:** si el server descarta algo, o falla, o el cliente TIENE que pintar el warning.

**Vive en:** app/api/onboarding/persona/route.ts + app/onboarding/PersonaView.tsx · app/api/onboarding/entregable/route.ts + EntregableView.tsx · app/api/onboarding/razones/route.ts + RazonesView.tsx · *2026-07-28 ~review-onboarding-fabrica-creativos*

### ⚠️ Sin ninguna fuente conectada, /general declara «El negocio está sano»

El semáforo arma `alertas = []` cuando no hay datos y cae al `else` final, que dice «El
negocio está sano · Sin focos activos. Buen momento para empujar volumen». La card de
pendientes con 0 leads afirma «datos al día — el tablero es confiable». Un cliente que gastó
plata en ads y ve luz verde con 0 cierres se lleva un tablero que no sabe de qué habla.

Falta el **cuarto estado, el gris**: «sin datos suficientes para opinar». El sistema para
distinguir *apagado* de *cero* ya existe (`lib/sources.ts`, se usa internamente en
/marketing) y el componente que lo mostraría, `SourceStrip`, existe pero está **desmontado**:
ninguna página monta `DashboardHeader`. Esto es la contracara de la regla del dueño: una tab
que depende de una conexión **no muestra pantalla vacía ni datos inventados**, muestra el
onboarding partido pidiendo esos datos («al entrar NO debería mostrar nada, debería salir la
misma pantalla dividida del onboarding y pedirle esos datos», 2026-07-17).

**Vive en:** app/general/page.tsx:411-415, :441-442 y :477 · lib/sources.ts · app/_components/DashboardHeader.tsx (sin consumidores) · *2026-07-16 mako-onboarding-solo-meta*

### Nada del onboarding puede asumir que los pasos son los de la capa `completo`

El status 'done' del wizard estuvo clavado a `body.step === 'retro'`. Cualquier capa que no
termine en retro quedaba `in_progress` para siempre y `guardOnboarding` devolvía al usuario
al wizard en **loop infinito**, aunque lo hubiera terminado. El último paso sale de
`pasosDeCapaActual()`, nunca de un literal.

Gemelo del mismo subsistema: el escape del onboarding de una tab apuntaba a
`router.refresh()`, que re-corre el guard del server y devuelve el mismo wizard — un
onboarding de tab se cierra con **estado de cliente**. Antes de reabrir un onboarding,
verificá que tenga salida.

**Vive en:** app/api/onboarding/route.ts · lib/onboarding-state.ts · lib/tab-onboarding-state.ts · *2026-08-07 contexto-mako-md*

### Poner una `nota` en un ámbito de Datos de Mau pinta el toast de ÉXITO en rojo

**Síntoma:** los ámbitos con `nota` (perfil, setting, crm, integraciones, whatsapp) muestran
SIEMPRE el aviso en tono error aunque la copia haya salido perfecta.

**Causa real:** el cliente empuja al mismo array `detalle` los errores reales Y los `avisos`
informativos que devuelve el server (`avisos.unshift(def.nota)`), y después decide el tono
con `tono: detalle.length ? 'error' : 'info'`. Un texto explicativo se cuenta como si fuera
una falla.

**Regla:** no mezclar canales — un aviso informativo y un error viajan en campos distintos, o
el tono se decide por el `ok` de cada llamada, nunca por el largo de una lista que acumula
las dos cosas. Mientras no se arregle, agregar un ámbito nuevo con `nota` es garantizar que
su toast salga rojo.

**Vive en:** app/_components/PanelAgencia.tsx:134-139 · app/_components/DatosDeMau.tsx:68-78 · lib/datos-mau.ts (las 5 entradas con `nota`) · *2026-08-02 ~investigar-onboarding-chat-agent*

### Decisiones de producto del onboarding

- **Toda tab, sin excepción, arranca con un onboarding propio** (Conectar → Contexto →
  Ensayo), y su estado (hecho / no hecho) alimenta a MaKo: si algo no se optimizó, MaKo sabe
  que fue por onboarding incompleto. «sin excepción, todas las tabs van a requerir cierta
  configuración» (2026-08-01). Se dispara al entrar por primera vez a WhatsApp, Email,
  Closing Analyst, etc.; hay tabs que dependen de otras (Email/WhatsApp mandan a Setting).
- **Es bloqueante y sin atajos:** ningún usuario sin el onboarding completo entra al
  dashboard, ni siquiera el super admin (solo puede rellenar con los datos de Mauricio desde
  la topbar), y el wizard tiene que verse EXACTAMENTE igual que el del cliente para poder
  probarlo de verdad (2026-07-21, 2026-08-01). Al resetear el cliente de prueba se lo manda
  directo al onboarding.
- **Solo el onboarding principal va sin sidebar**; todas las demás tabs la conservan. «Si
  por error entré ahí no tengo forma de salir» (2026-08-01).
- **Dos pantallas:** form simple a la derecha, carrusel de animaciones «wow» a la izquierda.
  Durante el onboarding MaKo usa la API de Groq del super admin para dar el efecto WOW antes
  de que el usuario conecte las suyas — conectar Claude/Groq es la fricción real; escanear un
  QR no lo es (2026-07-16).
- **Lo aburrido va al final:** conectar APIs y configuración se dejan para el cierre; solo se
  adelanta lo que bloquea el avance (2026-08-01). Onboarding general **corto** +
  mini-onboardings por tab: «quiero el efecto WOW lo antes posible» (2026-07-16).
- **Se llena subiendo un template** descargable (Oferta, Avatar, Personaje de Marca) que la
  IA lee y completa; si faltan campos, no deja avanzar. «Normalmente los infoproductores
  completan templates así todo el tiempo» (2026-06-21).
- **Bajar la fricción con soluciones creativas nuestras:** pedir ejemplos, capturas o
  conectar su WhatsApp en vez de hacerle escribir todo; MaKo propone las secuencias y simula
  escenarios tipo chat. «como regla siempre buscamos soluciones creativas nosotros, para que
  al usuario no le cueste cargar todo eso» (2026-08-01).
- **Todo se configura con prompts y botones**, nada de configuración manual en ninguna
  feature: el usuario no tiene que aprender a configurar un software (2026-06-30).
- **Si el sistema puede detectarlo solo, no se pregunta** ni se pide confirmar: verificar el
  QR, disparar la simulación, resolver un dato faltante. «Elimina la parte de "ya lo escaneé,
  verificar", eso debería hacerlo automático» (2026-08-01). Y el paso se resuelve **donde
  está**: nada de mandar al usuario a otra tab («NO me debe redireccionar a otra tab, la de
  WhatsApp… Me debe aparecer directamente allí el botón para generar el QR», 2026-08-01).
- **Ningún dato cargado a mano es ley:** si llega un documento con mejor data, se sobrescribe
  (2026-07-27).

**Vive en:** lib/capas.ts · lib/onboarding-state.ts · lib/tab-onboarding-state.ts · app/onboarding/* · skill `tab-onboarding` · *memoria [[regla-onboarding-por-tab]], [[onboarding-cliente-wizard]]*

---

## Estado y datos en el cliente

### ⚠️ `router.refresh()` no vuelve a correr los efectos de los componentes cliente

El bug de Gemini tenía una segunda causa que el diagnóstico no vio y que hacía insuficiente
el parche: aunque la copia funcionara, **la pantalla no se enteraba**. `DatosDeMau` se
montaba SIN prop `onListo`, y sin ella hace `router.refresh()`, que re-renderiza server
components pero **no remonta componentes cliente ni re-corre sus efectos**. La tarjeta del
servicio carga su estado en un `useEffect` con deps `[servicioKey]` (una vez por montaje),
así que seguía vacía, `geminiConectada` seguía false y `puedeAvanzar` dejaba el wizard
trabado.

**Regla:** si el dato que cambiaste lo lee un fetch dentro de un `useEffect` de un componente
cliente, refrescar la ruta no alcanza — hay que llamar al recargador explícito o remontar con
un `key` que cambie. (Y del lado del dueño, la regla es más simple: **nunca hace falta
recargar la página** para ver el estado nuevo; refrescar toda la página es un bug de UX, no
una solución — 2026-08-01.)

**Vive en:** app/_components/DatosDeMau.tsx · app/onboarding/OnboardingWizard.tsx · app/integraciones/ServicioConfigForm.tsx · *2026-08-01 mako-onboarding-copy-y-bugs*

### ⚠️ Un callback opcional que nadie pasa es código muerto que el typecheck no ve

`ServicioConfigForm` declaraba `onEstado?: (conectada: boolean) => void` y lo invocaba en
cada carga y en cada guardado; el único call-site del repo lo montaba **sin la prop**. Con
optional chaining eso es un no-op silencioso: `calcConectada()` se calculaba y el booleano se
tiraba, sin error de compilación.

**Síntoma:** la app se contradecía a sí misma en un solo viewport — la fila decía «✓
Guardada» en verde y, a centímetros, el chip del mismo modal seguía en «Por configurar», el
tile ámbar y el contador quieto.

**El fondo es de Next:** el array `integraciones` baja como prop de un server component y el
POST va por `fetch` a un route handler — no es Server Action, no vuelve payload RSC, y
`force-dynamic`/`revalidate = 0` rigen el render **del servidor**, no el estado del cliente
ya montado. Hace falta un `router.refresh()` explícito (hoy cableado como `onCambio`).

**Vive en:** app/integraciones/ServicioConfigForm.tsx:260-262 y :351 · app/integraciones/IntegracionesBoard.tsx:1107 y :381 · *2026-07-16 ~auditoria-refactor-integraciones*

### ⚠️ Un efecto con deps `[]` que lee `pathname` deja las preferencias en null para toda la sesión

El efecto que carga las prefs in-app tiene `deps: []` pero adentro hace
`if (pathname.startsWith('/login') || isPublicLandingPath(pathname)) return;`. Si el provider
monta con /login (bookmark, URL tipeada), sale **antes** del fetch y **antes** de registrar
el listener, y como el root layout no se desmonta en navegaciones soft (verificado contra
Next 16.2.6: el router sigue el 307 sin caer a MPA), nunca vuelve a correr.
`inAppActivo(null,…)` es fail-open, así que el sonido y los toasts salen aunque estén
apagados, y guardar en Configuraciones no cambia nada hasta un F5.

**Regla:** si la guarda de un efecto lee algo, ese algo va en las deps — o derivá un booleano
(`enPublico`) y usalo como dep.

**Vive en:** app/_components/NotificationsProvider.tsx:331-344 (y el efecto gemelo de :301) · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### ⚠️ Las preferencias en localStorage sangran entre inquilinos: el origin es el mismo

Al impersonar clientes en el mismo navegador, las keys sin namespace muestran datos del
anterior: borradores de WhatsApp, el wizard de Nueva Campaña a medio llenar, marcas de leído,
drafts del plan y el board v9. Son **12 keys**: `mako-wa-drafts`,
`mako-wa-empresa-drafts/leido`, `mako-wa-leido`, `mako.nuevaCampana.draft.v2`,
`mako.adsTable.cols.*`, `mako_draft_proyecto`, `mako_draft_tarea`, `mako.revisar.*`,
`mako_ia_last_seen_at`, `mako-wa-tpl-*`, `mako_plan_v9`.

`BoardShell` ya lo resolvió con ``dlKey(base) = `${base}_${scope}` `` — verificado que las
suyas están scopeadas y que `mako-wa-drafts` sigue pelada. Ese es el patrón a copiar. Además,
tras cualquier reset de workspace hay que **barrer las keys `mako*` del navegador** o la app
sigue pareciendo llena.

**Vive en:** app/whatsapp/WhatsAppApp.tsx:280 · app/plan/board/BoardShell.tsx (dlKey, el patrón correcto) · app/ads-manager/NuevaCampanaModal.tsx · *2026-08-01 mako-cliente-prueba-diagnostico*

### ⚠️ Dos copias del mismo estado + un guardado que postea el documento ENTERO = borrado silencioso

**Síntoma:** escribís un guion desde la matriz, se ve bien; después editás o borrás CUALQUIER
otro guion desde la galería y el primero desaparece de la base, sin error y sin aviso.

**Causa:** `MatrizView` tiene su propio estado y guarda contra la API sin avisarle al padre,
mientras el shell `AdsWriterApp` carga UNA sola vez (`useCallback` con deps `[]`) y sus
mutaciones postean el array `celdas` **capturado en el closure** como la matriz COMPLETA
(`action:'guardar'`), y el route hace `setRazones(limpio)` reemplazando todo. La
sincronización quedó de una sola dirección (galería→matriz), así que la copia vieja pisa la
nueva.

**Regla:** si un endpoint reemplaza el documento entero, ningún componente puede tener una
segunda copia del estado sin un canal hijo→padre; y las mutaciones postean desde el updater
funcional (`setX(prev => …)`), nunca desde el array del closure. Efecto secundario del mismo
bug: el contador de cobertura y «Escribir el próximo guion» siguen viendo la celda como vacía
y generan un duplicado.

**Vive en:** app/ads-writer/AdsWriterApp.tsx:49-61,118-127 · app/onboarding/MatrizView.tsx:74,120-124 · app/api/onboarding/razones/route.ts:135-151 · *2026-08-06 ~review-adversarial-content-machine*

### ⚠️ El progreso de una tarea es DERIVADO de la checklist: generarla pisa el avance a 0

`setChecklist` recalcula `progress = round(hechos/total*100)` cada vez que la lista no está
vacía. Una tarea 'alta' con 70% puesto a mano y sin checklist califica para el botón «MaKo
arma la checklist» (el filtro solo pide `checklist.length===0 && progress<100`), y al
generarla todos los ítems nacen en `done:false` → el 70% se va a 0 sin aviso. Y el undo es
**lossy**: la entrada de historial 'ia' solo captura la checklist, así que deshacer restaura
`checklist=[]` y deja `progress` en 0.

**Regla:** si un campo es derivado, cualquier acción que reescriba la fuente tiene que
capturar el derivado en el snapshot de undo.

**Vive en:** app/plan/board/useBoard.ts (setChecklist / undoHist) · app/plan/board/BoardShell.tsx (generarChecklist) · *2026-07-19 ~review-datosmodal-plan-board*

### ⚠️ Una URL firmada guardada en el estado se rompe de dos formas opuestas, y ninguna avisa

Dos corridas distintas encontraron los dos extremos del mismo patrón.

**(a) Congelada:** `abrirEscenario` mete la URL firmada dentro de `msgs` y nadie la refresca;
subir el TTL de 1 h a 12 h corre el acantilado, no lo saca — pasado el plazo el navegador
pinta un reproductor inerte en 0:00.
**(b) Refrescada de más:** la bandeja de empresa re-firma cada media en cada poll de **8 s**,
así que la URL cambia de identidad, las imágenes se re-descargan y reasignar `src` en
`<audio>`/`<video>` **resetea la reproducción** — una nota de voz de más de 8 s es imposible
de escuchar.

En los dos casos el síntoma es mudo: `ChatHilo` no tiene `onError` en `<audio>`, `<img>` ni
`<video>`, así que una URL muerta es indistinguible de un archivo roto.

**Regla:** la URL firmada se resuelve al renderizar (o se mergea por id preservando la
anterior), **nunca se persiste en estado**; y todo medio servido por URL firmada lleva
`onError`.

**Vive en:** app/whatsapp/_shared/ChatHilo.tsx:208-212 · lib/setting-audios.ts:107 · lib/evolution-mensajes.ts:191 · app/whatsapp/EmpresaInbox.tsx:64-69 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent + 2026-07-09 ~auditoria-espejo-evolution-inbox*

### ⚠️ El componente hermano ya resolvió esto: la bandeja de empresa no copió sus dos guardas

`EmpresaInbox` y `WhatsAppApp` son las dos bandejas de la misma pantalla, y la segunda ya
tiene resueltos dos peligros que la primera no.

1. **Race:** `loadMsgs` hace `setMsgs(j.mensajes)` sin verificar que el chat siga
   seleccionado — un fetch en vuelo del chat A resuelve después de cambiar al B y pinta los
   mensajes privados de un lead bajo el nombre de otro. `WhatsAppApp` lo evita con
   `if (selIdRef.current === selId)`.
2. **Autoscroll:** el efecto `[msgs]` fuerza scroll al fondo en cada poll de 8 s (el array es
   nuevo aunque el contenido sea idéntico), así que leer historial es imposible.
   `WhatsAppApp` lo gatea con `stickBottomRef`.

**Regla:** cuando existan dos componentes que hacen lo mismo, la revisión **empieza por
diffear sus guardas**.

**Vive en:** app/whatsapp/EmpresaInbox.tsx:56-71 vs app/whatsapp/page.tsx (WhatsAppApp):447-450 y :501 · *2026-07-09 ~auditoria-espejo-evolution-inbox*

### ⚠️ Un MediaRecorder pausado no está 'recording': el cleanup lo deja colgado con el micrófono abierto

El cleanup al cambiar de chat solo cancela `if (mediaRecRef.current.state === 'recording')`,
pero `pauseRec()` deja el recorder en `'paused'`. Grabar → pausar → cambiar de chat saltea la
cancelación: el stream del micrófono **no se libera** (el indicador del navegador queda
prendido), `recording` sigue en true y `startRec()` hace early-return, así que no se puede
grabar de nuevo hasta desmontar la página. Y el `onstop` capturó el destino del chat
**original** en el closure, así que si de algún modo se reanuda, el audio se manda al contacto
equivocado. La condición correcta es `state !== 'inactive'` (un recorder pausado igual emite
`onstop` al llamar `.stop()`).

**Vive en:** app/whatsapp/page.tsx:387 · *2026-06-23 ~auditoria-inbox-whatsapp-chatwoot*

### Regla: todo cambio persiste solo, avisa, se puede deshacer 5 segundos y queda en el historial

Las cuatro cosas van juntas y no tienen excepción:

- **No hay botón «Guardar»:** cada cambio persiste solo y se avisa con el toast. «la
  metodología de guardar está bien, pero esa confirmación de guardar se debe dar en cada
  cambio» (2026-06-21).
- **Cartel de modificación + pop-up de 5 segundos para deshacer**, en toda acción destructiva
  o cambio de estado. «TODOS estos cambios debe saltar el botón de deshacer de 5 segundos,
  siempre» (2026-07-13) · «Tiene que salir un cartel de modificación como siempre, y el
  pop-up de los 5 segundos para deshacer» (2026-07-12).
- **Historial de cambios siempre**, sin demora y con el actor: si lo hizo la IA, firma
  **MaKo** con ícono de IA, no con foto de usuario ni «vos». «has marcado como check de
  finalizado, pero no aparece en el historial, debería aparecer, y que justamente la IA o
  MaKo hizo esos cambios» (2026-07-14) · «No actualizaste el HISTORIAL de cambios en cada
  tarea o proyecto… Eso es muy grave… Eso tiene que ser regla siempre» (2026-07-17).

**Vive en:** *memoria [[historial-mako-siempre]]*

### Regla: el estado sobrevive al cambio de pestaña

Borradores escritos y datos ya cargados no se pierden ni se recargan al ir y volver. «si
escribo un mensaje largo y me voy de pestaña y vuelvo, ese mensaje que había escrito ya no
está más» (2026-06-23). Y todo el feedback y los aprendizajes se guardan para reusarlos en
las próximas piezas y en todos los orígenes; no se pierden en el chat (2026-07-22).

### Regla: «Ver más» carga un lote más, nunca todo de golpe

Él lo dijo con la palabra *regla*: «siempre debe cargar una cierta cantidad más, no
absolutamente todo» (2026-08-05). Las previews muestran pocos ítems con «Ver más» u otra
ruta; nunca una lista con scroll infinito («haz que se cargue un "Ver más" en el historial de
la tab de proyectos… Que sino, tiene un scroll infinito», 2026-08-05).

### Regla: si MaKo puede resolverlo, lo resuelve

Solo pregunta cuando NO encuentra la respuesta: «Si lo puede hacer MaKo, siempre debería,
solo me debe preguntar en caso de NO encontrar respuesta» (2026-07-19). Y el server decide
crear/ampliar/ignorar por su cuenta — *memoria [[nunca-duplicar-nunca-preguntar-bajas]]*.

---

## Layout, sidebar y tabs

### ⚠️ Una pantalla que se abre desde WhatsApp tiene que APAGAR el chrome, y el sidebar es lo de menos

La app **no tiene tratamiento móvil**: el sidebar es un riel de ancho fijo, sin `@media`, sin
colapso por viewport. Cualquier pantalla pensada para leerse en el celular —y las que MaKo
linkea por WhatsApp lo son por definición— arranca con ese ancho comido.

**Pero lo que de verdad la rompe no es el sidebar: es `MakoConfirmGate`**, que dispara un modal
**bloqueante y no cerrable** en TODO `/crm*`. Una pantalla nueva bajo `/crm` nace tapada por un
modal que pide resolver confirmaciones del CRM automático, justo con la reunión por empezar. No
hay forma de verlo leyendo el archivo de la pantalla: el gate vive en el layout raíz y matchea
por prefijo de ruta.

**Regla:** antes de colgar una pantalla de un prefijo existente, buscá qué se monta por ESE
prefijo en `app/layout.tsx` y en los gates globales. Y si la pantalla es para el celular,
sumala a `esVistaSinChrome` (`app/_components/PublicRouteGate.tsx`).

**Ojo con el predicado que se reusa:** `isPublicLandingPath` responde «¿la puede ver alguien de
afuera?» y es lo que apaga los pollers de notificaciones (sin sesión devolverían 401 en bucle).
`esVistaSinChrome` responde «¿esta pantalla se dibuja sola?». Toda landing pública cumple las
dos, pero al revés no: el resumen del lead exige sesión y aun así va limpio. Meter la ruta en el
primero para conseguir el efecto del segundo es un nombre que miente, y el próximo que lea la
lista va a creer que esa ruta es pública.

**Y un gotcha de verificación, no de código:** con el panel del navegador oculto la página no
compone frames, así que `getBoundingClientRect()` devuelve **0 en todo** aunque el texto se
extraiga perfecto. Los ceros no son un layout roto. Lo que sí sirve sin panel visible:
`document.documentElement.scrollWidth` vs `window.innerWidth` (desborde horizontal),
`getComputedStyle` y `read_page`.

**Vive en:** app/_components/PublicRouteGate.tsx · app/_components/MakoConfirmGate.tsx ·
app/crm/[id]/resumen/page.tsx · *2026-08-11*

### ⚠️ En una lista de matchers, el genérico que va primero anula la exclusión del específico

`nav.ts` se toma el trabajo explícito de separar 'Clientes' (matchea `/admin` pero **no**
`/admin/guiones`) de 'Guiones' (matchea `/admin/guiones`). `titulo-tab.ts` arma `TODOS` con
`...USER_NAV` **antes** que `...ADMIN_NAV`, y USER_NAV tiene un `starts('/admin')` a secas:
`TODOS.find()` corta ahí y las dos pestañas dicen «MaKo - Admin», que es justo lo que el
módulo existe para evitar. Verificado ejecutando el módulo real.

**Segundo filo del mismo archivo:** el fallback `desdeLaRuta()` capitaliza el primer segmento
sin validar nada, así que un 404 (`/crmm`, `/graficos`) pinta «MaKo - Crmm» e inventa una
sección que no existe.

**Vive en:** lib/titulo-tab.ts:45-46 y :50 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

### El `<main>` de una pantalla es `Pagina`, y una pantalla no elige su ancho

Está escrito en [AGENTS.md](../AGENTS.md) y se repite acá porque es el error de layout más
copiado: cada pantalla escribía su propio `<main>` con su `maxWidth` (16 con el mismo padding,
7 variantes sueltas, topes de 1000, 1100 y 1200 según quién la escribió), y copiar la pantalla
de al lado propagaba el número. El `style` de `Pagina` está tipado
`Omit<CSSProperties, 'maxWidth' | 'width'>`: el compilador rechaza el ancho. Si lo que necesita
tope es **texto**, el tope va en el párrafo (`Lectura`, 70ch), nunca en la página.

**Vive en:** app/_ui (Pagina, Lectura) · [app/_ui/LEEME.md](../app/_ui/LEEME.md) · catálogo vivo en /admin/ui

### Regla: la sidebar JAMÁS se scrollea

Si no entra, se resuelve de otra forma —reorganizando o plegando—, nunca con scroll. Está
inspirada en la de Meta, y las notificaciones salen de ahí.

⚠️ **Se violó el 2026-08-11 y el diagnóstico obvio era el equivocado.** El reclamo fue «la
sidebar se ve horrible con esa barra de scroll», así que la primera reacción fue arreglar
**la barra** —adelgazarla y teñirla con `.mk-scroll-oscuro`— y el problema siguió igual. La
barra fea no era el problema: **era el testigo**. Lo roto era que la familia Dev pasó de 10
a 13 filas en 24 horas (Products & Offers, Pricing, Customer Success) y es la única familia
larga que NO usaba el mecanismo de colecciones que el resto de la barra ya tiene — Analyze
esconde siete Analysts en una fila, Content Machine tiene tres grupos. Trece contra las
cinco de Operate. El arreglo real es un `NavGrupo`, no CSS.

**Por qué se volvió a violar una regla que estaba escrita:** era inencontrable por el método
que prescribe AGENTS.md. Su línea «Vive en:» apuntaba a `lib/nav.ts`, **un archivo que no
existe desde el rediseño**, así que grepear la ruta real (`app/_components/nav.ts`) en
`docs/` no devolvía nada. Una ruta muerta en un «Vive en:» no rompe nada y no la ve el
compilador: solo hace que la regla no se encuentre, y entonces cada sesión vuelve a proponer
«le pongo scroll» o «le escondo la barra». Corregidas las tres que había.

**Tres trampas del arreglo, todas verificadas:**

- **El rail PLEGADO desborda ~14 px antes que el expandido**, porque la fila colapsada es más
  alta (`filaStyle(false)` usa `padding: '8px 0'` sobre un ícono de 19). Medir solo con la
  barra abierta subestima el problema — y el rail es el estado por defecto.
- **El flyout hereda el fallo.** Tenía `overflow: 'hidden'` y ningún `maxHeight`: el `alto`
  que calcula `abrirFlyout` solo clampea el `top`. Mover filas ahí sin tocarlo mudaba el
  mismo corte silencioso de la columna al desplegable.
- **La fila del grupo NO lleva contador.** `Contador` pinta sobre `--bad` —rojo de
  notificación— y la regla del catálogo reserva los números a la familia que notifica. La
  pista de que hay más adentro es el chevron, no un número.

**Y lo que NO hay que hacer, con el motivo:** `scrollbar-width: none` no elimina el scroll,
elimina la evidencia — y como el contenedor corta con `overflow: hidden`, el síntoma queda en
exactamente cero: ni degradado, ni media fila. Lo que desaparecía desde abajo era Customer
Success → Pricing → Products & Offers → El semáforo; tres de ésas se habían agregado ese
mismo día, y «Pricing» es literalmente la fila del hallazgo de más abajo.

**Vive en:** `app/_components/nav.ts` (familias, bloques y grupos) ·
`app/_components/Sidebar.tsx` (el flyout y su techo) · `app/_ui/ui.css` (`.mk-scroll-oscuro`) ·
`tests/dev-areas.test.ts` · *2026-08-11*

- «La sidebar se puede scrollear, eso NO debe ser posible NUNCA. Jamás se debe poder
  scrollear en la sidebar» (2026-07-01)
- «Ya hay muchas tabs, no debo scrollear en la barra lateral» (2026-07-01)

Las **secciones** de la sidebar no pueden tener el mismo diseño que las tabs: jerarquías
distintas se ven distintas de un vistazo, para que sea intuitivo.

**Vive en:** app/_components/nav.ts (fuente de verdad de la navegación) · *memoria [[sidebar-nav-estructura]]*

### Regla: las tabs van en UNA fila, sin scroll y sin reacomodar la topbar

- «las tabs se desplazan en doble fila, no debería pasar» / «Las tabs cuando se genera el
  guion tienen SCROLL, no pueden tener scroll las tabs» (2026-07-04). Si no entran, se
  **reorganiza la información**, no se apila ni se scrollea.
- Los botones y controles de una topbar **se quedan en el mismo lugar** al cambiar de tab: si
  en una tab hay buscador o filtro, no se reacomoda todo lo demás. «hay tabs donde aparece la
  barra de búsqueda o el filtro y se desorganizan los botones. Haz que tenga coherencia»
  (2026-08-05).

### Regla: nada desparejo, nada en segunda línea, nada flotando

- Tarjetas del mismo alto, cuadros comparativos a la misma altura, **botones nunca en segunda
  línea**: «Hay botones que se van abajo, en la segunda línea, no debería pasar, todo siempre
  arriba» (2026-08-05).
- **Grillas parejas:** nunca 3+1 ni 5+1. «si hay 3 en una fila y 1 debajo, mejor que sean 2 y
  2. Y mucho peor si hay 5 en una fila y 1 en otra» (2026-07-04). Y los datos van **dentro**
  del recuadro gris, nunca flotando.
- Los **botones de acción van centrados**, nunca alineados a la izquierda: «debería estar en
  el medio. No alineado a la izquierda, ya te lo dije, y como regla» (2026-08-01).
- Las **jerarquías se ven distintas**: proyectos altos, tareas planas y anchas. «las task son
  más planas y anchas, y los proyectos son más altos. Es fácil diferenciarlos» (2026-07-19).
- ⚠️ `flex:1` mata `height:100vh` en el `<main>`: el contenedor colapsa y el loader queda
  diminuto. *memoria [[layout-flex-height-100vh]]*

### Regla: sin opciones ni caminos redundantes

El camino normal es el **default** y no se duplica una acción que ya existe en otro lado de la
misma pantalla: «No debe existir la opción de "completar", normalmente todas las personas
entran en "completar"» (2026-06-21). Lo mismo a nivel navegación: **no se crea una tab o un
chat nuevo para algo que ya existe** — la IA vive DENTRO de la tab donde se trabaja, como
funcionalidad, no como pantalla aparte («una nueva tab con un nuevo chat, cuando ya existía un
"Pregúntale a MaKo"», 2026-07-10).

### Decisiones de navegación

- **Sidebar en secciones (familias)**, con renombres: *Content Machine* reemplaza a *Ads
  Writer*, se agrega *Second Brain*, y *Market Analyst* pasa a *Competitor Spy*. La ruta
  **siempre coincide con el nombre**. Empezaron siendo tres (Operate / Create / Analyze) y
  terminaron en **cuatro**: Content Machine se separó como familia propia el 7/8, porque no es
  UNA herramienta sino un taller con secciones por canal (2026-08-06 → 2026-08-07).
- ⚠️ **Una familia se distingue por su SUPERFICIE, no por su tipografía.** Se pidió cuatro
  veces («haz bien esto de una vez») y las tres primeras fallaron por lo mismo: se intentó
  diferenciarla con tamaño y color de texto, que es exactamente lo que hace un item activo —
  así que en vez de separarlas, las confundía. Lo que funcionó: franja apenas más clara
  cuando está desplegada, pastilla alrededor del ícono en el rail plegado, y el rótulo en
  versalitas mono. **Regla: dos cosas de jerarquía distinta no pueden diferenciarse con el
  mismo recurso visual que ya usa otro estado.** Cerrado el 2026-08-08.
  *Vive en: app/_components/Sidebar.tsx · app/_components/nav.ts · app/_ui/ui.css (`.mk-navrow`)*
- En el sidebar rediseñado, **«Create» pasa a «Sales Machine»**: Landing/VSL/Lead Magnet
  Generator · Chatbot/Sales Email/Newsletters · Closing Script/Sales Roleplay (2026-08-07).
- **«Graphich» pasa a llamarse «Dashboard»** en sidebar, título, landing y ruta: «Dashboard es
  como normalmente todo el mundo conoce ese tablero de métricas». Las features de la landing
  quedan sueltas, no agrupadas en 5 categorías (2026-07-26).
- **Se agrega «Reportar problema»** con ruta `/tickets`, y un **«Chat Analyst»** antes de
  Closing Analyst (2026-08-06).
- **Se elimina Teléfonos y Etiquetas**; Funnel + Archivero + Ángulos y avatares se mudan a una
  tab «Onboarding» accesible desde la foto de perfil — agrupar la configuración fuera del uso
  diario (2026-07-26).
- **Perfil y Notificaciones viven dentro de Configuraciones**, con reportes diarios/por hora
  de lo urgente por WhatsApp y semanales por WhatsApp y email: quiere enterarse de lo que pasa
  sin entrar a mirar (2026-06-30). **Telegram se saca de toda la app** (2026-07-26).
- **La app arranca en modo simple por defecto**, con un botón «Encender modo Avanzado» que
  devuelve todas las tabs y gráficos actuales. El usuario es un infoproductor que ejecuta: «es
  probable que como está hoy la app, no usen el 80% de funcionalidades. NO porque no estén
  buenas, sino porque es mucho» (2026-07-09).
- **/conocimientos se puede compartir por link público**, sin login: «que yo le pueda pasar un
  link a cualquiera y pueda acceder a eso» (2026-07-27).
- La estética general de la app se alinea a la de la landing `/vsl` (2026-07-01).

**Vive en:** app/_components/nav.ts · app/_components/Sidebar.tsx · *memoria [[sidebar-nav-estructura]], [[rediseno-direccion-estetica]]*

### Una tab que existe y no se ve no da ningún síntoma

**Síntoma.** «No veo la tab en la sidebar», sobre un área de `/admin/dev` recién escrita.
La página existía, funcionaba, tenía su Roadmap y su Change History — y no había forma de
llegar salvo tecleando la URL.

**Causa.** El bloque de registros de la familia Dev en `app/_components/nav.ts` es una lista
**escrita a mano**, y la fila nueva no estaba. No era una: **`pricing` llevaba días igual**,
con bitácora completa y sin entrada, y nadie lo había notado.

**Por qué sobrevive tanto.** Es el modo de falla más silencioso que hay: no rompe, no
loguea, no lo ve el typecheck, y no aparece en ningún test porque *nada* pasa. Solo se
descubre cuando una persona la busca — y si nadie la busca, el trabajo queda enterrado.

**Regla.** La lista del nav NO se puede derivar de `registros.ts` (importaría las ocho
bitácoras enteras, ~1.500 líneas de prosa, al bundle del cliente para armar ocho links).
Entonces son dos listas de lo mismo, y eso exige las **dos capas** de siempre: la lista, y
una guarda determinista que falle cuando divergen. Vale para cualquier catálogo que se
duplique por una razón legítima de bundle — la razón justifica la copia, no la falta de
guarda.

**Vive en:** `app/_components/nav.ts` (bloque de registros de `ADMIN_FAMILIAS`) ·
`app/admin/dev/registros.ts` (`REGISTROS_SLUGS`) · `tests/dev-areas.test.ts` (la guarda)

---

## El texto de la UI

### Regla: cero texto de más — sin subtítulos, sin bajadas, sin relleno

Es la corrección que más repitió. Título corto y descriptivo, como mucho un subtítulo corto.
**NUNCA un párrafo explicativo debajo del título**: el contexto va abajo del todo, sin
interrumpir la acción. Él mismo lo llamó regla.

- «es un texto aburrido de leer, que nadie lo lee… va abajo del todo, no interrumpiendo la
  acción» (2026-08-01)
- «no metas texto de más, te lo pedí explícitamente» (2026-07-19)
- «SIEMPRE… NO pongas subtítulos innecesarios» (2026-06-23) · «En general elimina todos los
  subtítulos, todos» (2026-07-23)
- «Elimina "¿Por qué este número?", eso es texto paja» (2026-08-01)
- Ni dos títulos que dicen lo mismo. **Auditá los textos antes de entregar.**

**Vive en:** toda la UI · *memoria [[no-subtitulos-innecesarios]]*

### Regla: nombres explícitos, cero jerga interna

El nombre se entiende **solo**, sin contexto. Nada de apodos nuestros, tecnicismos ni
identificadores de código visibles al usuario. Y no se inventan nombres: se usa el que ya
existe, y el nombre de la tab coincide con la ruta.

- «Es muy importante no caer en jerga interna que solo entendemos nosotros y ningún usuario
  sin contexto entiende… Eso como REGLA… Porque eso vuelve MUY junior la app» (2026-07-26)
- «los textos como 'mako-doer-in' no tienen sentido para el usuario, el cliente jamás
  entenderá qué significa eso» (2026-07-15)
- «Que no ponga "La fábrica de creativos"» · «"Vieron tus videos", nuevamente no se entiende.
  ¿Qué videos? ¿mis reels? ¿mis ads? Sería: vieron tus **anuncios**» · «Baja a tierra a un
  lenguaje simple… no quiero tecnicismos como la matriz 3x3» (2026-06-30)
- «no inventes nombres de etapas, simplemente pon los nombres exactos… No inventes nuevos
  nombres, vamos a confundir» (2026-06-22)
- Los títulos son **descriptivos y neutros**, no informales ni preguntas coloquiales: «El
  título no debería ser ese, debería ser "Verificación de seguridad", un título descriptivo,
  no informal» (2026-08-01)

**Vive en:** toda la UI · *memoria [[nombres-explicitos-sin-jerga]], [[copy-neutro-y-modales]]*

### Regla: íconos profesionales y logos reales, nunca emojis

Las acciones (renombrar, pinear, archivar, eliminar) se nombran por **texto**.

- «no quiero EMOJIS, siempre utiliza iconos, que se vean profesionales, no un mono…»
  (2026-07-10) · «Recuerda no utilizar emojis, mejor los íconos que tenemos en el otro
  WhatsApp» (2026-07-10)
- «con un emoji horrible en lugar de usar un ícono elegante… Ponle correctamente los logos
  siempre» (2026-08-01)
- **Logos reales de la marca** (Fathom, WhatsApp, Meta, Calendly, Panda Video, Resend), sin
  fondo y del mismo tamaño óptico, nunca inventados: «Tienen que ser los mismos logos de la
  empresa, no los inventes» · «es importante que ningún logo tenga fondo… O le sacas el fondo
  o buscas el logo sin fondo por la web» (2026-07-16)
- El **logo de MaKo es solo la estrella**, sin ningún agregado (2026-07-01).

**Vive en:** app/_components/icons.tsx · app/_components/ServicioVisual.tsx (BrandDefs)

### Regla: simple y visual — nunca un bloque de texto plano

Los datos se presentan con contenedores, negritas, bullets y gráficos. Pero **no todo bullet
points**: se varían los recursos con criterio, y el contexto secundario va englobado en un
bloque gris desplegable (que al abrirse **no agranda el modal**: aparece scroll).

- «que se vea simple, que se vea visual, que se entienda rápido, que no sea un texto enorme
  aburrido de leer. Ya sabes esto» (2026-07-30)
- «lo peor es que ahora hiciste que TODO sea bullet points, cuando podés ir variando»
  (2026-08-01)
- «Recuerda nuestro lema para todo: que se vea SIMPLE, entendible… Si quiero acceder a más
  info, sí se debería poder, pero en una primera instancia, siempre SIMPLE» (2026-07-01)
- **Estado vacío = mensaje que explica**, nunca un cuadro con los campos vacíos: «qué feo se
  ven los cuadros de Comportamiento… cuando NO hay datos que traer… en lugar de dejar eso,
  poner un mensaje correspondiente» (2026-07-03)
- **El error sale debajo del campo que lo causó**, no apilado al final de la pantalla: «no
  deben salir al final del todo, deben salir abajo de esa misma key» (2026-07-16)
- **Saltos de línea en los chats de MaKo** — pedido de 2026-06-24, sin cerrar.

### Regla: todo lo que tarda muestra loader, y el loader cuenta qué está haciendo

La UI **nunca** queda inmóvil, nunca muestra la pantalla vieja antes de cargar, nunca un botón
que cambia de texto sin spinner, nunca un estado 'desconectado' mientras carga, nunca una
preview fea antes de tener datos.

- «SIEMPRE un loader… No se tiene que quedar inmóvil nunca, eso da la sensación de que algo
  falló» (2026-08-01)
- «siempre debe aparecer un loader ahí y en todas esas secciones de IA o lo que sea que tarde,
  porque si no, parece que se trabó» (2026-07-30)
- El loader va **describiendo/variando** lo que está haciendo, y en operaciones largas bloquea
  el cierre (ver [Modales y capas](#modales-y-capas)).

### Regla: MaKo tiene acento argentino solo cuando ASESORA

Todo lo que produce **para** el cliente —guiones, copy de anuncios, textos de la app,
onboarding— va en **español plano**. «Está bien que MaKo tenga el acento argentino al asesorar,
pero no al crear cosas para el cliente» · «Cambia todos los textos a español plano, no
argentino. No pongas "¿Tenés algún otro documento para sumar?"» · «No utilices acento
argentino, a veces no se te entiende… ¿A qué te referís con que los tableros "banquen"?»
(2026-06-30). En el chat con el dueño: español neutro, sin voseo (*memoria
[[hablar-espanol-neutro]]*).

### Gráficos y datos: claridad antes que creatividad

- **Un gráfico NUNCA lleva título** (2026-07-23). Los principios completos, en *memoria
  [[graficos-claridad-principios]]*.
- Las **tendencias se miden hasta el día anterior a hoy y por mes**, no por semana: el dato de
  hoy suele estar en 0 no porque sea 0 sino porque todavía no cargó, y eso ensucia la
  tendencia (2026-06-20).
- Antes de llenar una vista con datos reales se hace un **TEMPLATE** de cómo debería verse: el
  diseño venía saliendo mal cuando se armaba sobre la marcha con el análisis ya hecho
  (2026-07-01).
- **Nunca se maquilla un dato.** Si queda feo o sesgado, se revisa el parámetro de medición:
  «(Pero tampoco quiero mentir con los datos.)» (2026-06-25).
- **No poner límites arbitrarios:** ni horas de agenda, ni ventana de días de un público, ni
  cantidad de resultados. El tope lo pone la API, no nosotros. «no limites las horas, que se
  pueda agendar a la madrugada si quieren» (2026-08-07).
- En vez de muchos gráficos por tab, mostrar la **conclusión/insight** que corre un prompt
  sobre toda la tab, y automatizar lo que hoy depende de que el usuario apriete ejecutar: la
  app quedó «Thinker» y tiene que ser «Doer» (2026-07-09). *memoria [[doer-rediseno-norte]]*
- **Experiments** se estructura en Retro → Experiments → Conclusions / Planning, con MaKo
  leyendo todas las demás tabs para generar la Retro — replicar el método SIMPLE de «Nueva
  campaña»; «hoy parece una app barata y mal desarrollada» (2026-07-01).

---

### Exportar/Importar es la ACCIÓN; «Descargar ↓» es el botón. Nunca «Bajar»

**Vive en:** `app/plan/board/ExportarModal.tsx` · `app/crm/ExportarLeadsModal.tsx` ·
`app/crm/CrmToolbar.tsx` · `app/plan/board/ImportarModal.tsx`

El patrón ya estaba cerrado en cuatro pantallas y tiene **dos niveles**, que es la parte
que se saltea el que llega nuevo:

| Nivel | Palabra | Dónde |
|---|---|---|
| La acción, en el header o el menú | **Exportar** / **Importar** | `BoardShell.tsx:727,927`, `CrmToolbar.tsx:149,152` |
| El botón que dispara la descarga, ya adentro del modal | **Descargar ↓** | `ExportarModal.tsx:214`, `ExportarLeadsModal.tsx:334` |

/second-brain decía «BAJAR ↓» en el header y «Bajar tu segundo cerebro» en el modal: la
única pantalla del repo que no usaba ninguna de las dos palabras.

**Y el motivo de fondo por el que «Bajar» está prohibido no es la consistencia: es que
YA SIGNIFICA OTRA COSA en esta app.** `app/conocimiento/ConocimientoView.tsx:164` tiene
un botón «Bajar a tierra ↓» que **no descarga nada** —internaliza un curso— y cuyo
propio label de progreso dice «Importando…». Un usuario que pasó por esa pantalla lee
«BAJAR» como «traer a tierra».

**La prueba sin navegador**, que conviene correr al tocar cualquier pantalla con
entrada o salida de datos:

```bash
grep -rn "Bajar\|Bajás\|te llevás" app/ --include=*.tsx
```

### Un número hardcodeado en un copy es una mentira con fecha de vencimiento

**Vive en:** `lib/cerebro-modelo.ts` (los `que` de `AREAS`)

Las descripciones de las áreas del segundo cerebro decían «los **TRES** segmentos que se
pueden targetear en Meta» y «lo que MaKo entendió del negocio, en sus **SEIS** planos».
Los dos números estaban escritos a mano. Un cliente con cuatro avatares leía un texto
que le mentía, y el del panorama era peor: hay un hallazgo registrado de que el parser
llegó a descartar 5 de 6 secciones, así que ese «seis» afirmaba justo lo que el bug
desmentía.

Y estos `que` en particular son user-facing **por partida doble** —subtítulo de cada
opción en el modal de exportación y renglón de cada carpeta en el README del ZIP—, así
que parecían comentarios internos y no lo eran.

**La regla:** si el copy nombra una cantidad, o sale del dato o no se escribe.

### ⚠️ Una guarda de texto sobre el fuente engancha identificadores, no sólo texto

**Síntoma:** la guarda que impedía que la palabra «techo» —jerga— volviera a la pantalla de
pricing daba **rojo por cosas que no se ven**: `techoIa`, una función importada de otro
módulo, y `a.techo`, un campo de dato. Ninguno de los dos se pinta, y renombrarlos era otro
alcance.

**Causa:** grepear `/techo/i` sobre `Pricing.tsx` con los comentarios sacados sigue mirando
**código**. Un `.tsx` tiene el texto y el programa en el mismo archivo, y la palabra
prohibida vive legítimamente en los dos.

**Regla:** una guarda sobre lo que se LEE mira sólo dos cosas, y las dos **sin las llaves**:
los string literals y el texto suelto de JSX (lo que va entre `>` y `<`). La resta previa
pesa tanto como el match: fuera los comentarios de bloque y de línea, y **fuera los bloques
`import`**, que son puros nombres traídos de otro módulo. Y adentro de `{}` hay expresiones,
no texto — `{usd(techoIa(PRO))}` está entre `>` y `<` y es una llamada.

**Vive en:** `tests/pricing-modelo.test.ts` (`textoEnPantalla`) ·
`app/admin/dev/pricing/Pricing.tsx` · *2026-08-10 cac-dos-monedas*

### ⚠️ Una guarda sobre la pantalla que sólo mira el componente cubre la mitad

**Síntoma:** la guarda de arriba daba verde sobre `Pricing.tsx` y la palabra prohibida
**seguía en pantalla**: la decían **14 strings de `modelo.ts`** que el `.tsx` pinta —
`ECONOMIA`, `CUARTO_PLAN`, `PLAN_MES_1`, cinco meses de `PROYECCION_24`, `RESULTADO_24`,
`TOPE_PAUTA` y `OFERTA_ANUAL`.

**Causa:** en esta pantalla el texto no vive en el JSX, vive en los **DATOS**. El `.tsx` es
el molde y los párrafos son campos de constantes exportadas. Una guarda sobre el componente
mide dónde está el archivo, no dónde está el texto.

**Regla:** la guarda recorre los valores de **los mismos exports que el componente importa**,
y la lista de exports sale **del propio `import`** del archivo leído como texto — así no se
queda vieja cuando alguien agrega uno; una lista escrita a mano al lado de lo que enumera se
separa siempre. Lo que se importa pero no se pinta va en una lista explícita y chica
(`NO_SE_PINTAN`: los `id` que son claves de React y un par de campos de respaldo), con el
comentario de que si alguno empieza a pintarse sale de ahí.

**Vive en:** `tests/pricing-modelo.test.ts` (`stringsDe`, `NO_SE_PINTAN`) ·
`app/admin/dev/pricing/modelo.ts` · *2026-08-10 cac-dos-monedas*

### ⚠️ Con conclusión arriba y conclusiones por sección, la duplicación es el modo de falla por defecto

**Síntoma:** el bloque de conclusión general **copiaba** la conclusión de su parte en vez de
resumirla. Ya había pasado sin guarda adentro de la parte 3, donde el titular repetía palabra
por palabra la frase que estaba sesenta píxeles más abajo — ese caso está en
[hallazgos-ia.md](hallazgos-ia.md) → «La conclusión escrita a mano no se entera de que el
dato de al lado cambió».

**Causa:** no es un descuido. El que escribe el resumen de arriba tiene delante la frase de
abajo, y esa frase es la mejor que hay: copiarla es el camino de menor resistencia, y cada
reescritura de una parte vuelve a abrir la puerta.

**Y enganchó a su propio autor.** La guarda —tramo textual compartido de menos de 40
caracteres contra la conclusión de la parte— se verificó por mutación, como manda
[hallazgos-infra.md](hallazgos-infra.md) → «Un test que nunca viste fallar no sabés si
sirve». Lo que atrapó no fue un texto viejo: fue **el primer borrador del agente que la
estaba escribiendo**, con 44 caracteres textuales. Hubo que reescribir el texto, no aflojar
el tope.

**Regla:** la duplicación entre dos niveles de resumen se ataca con una guarda, no con
revisión — la revisión la hace el mismo que acaba de copiar. Cuando dos capas resumen lo
mismo, la de arriba se queda con el veredicto y la de abajo cuenta lo que sigue.

**Vive en:** `tests/pricing-modelo.test.ts` (`tramoCompartido`, «la conclusión general resume
su parte, no la copia») · `app/admin/dev/pricing/modelo.ts` (`CONCLUSION_GENERAL`) ·
*2026-08-10 cac-dos-monedas*

### ⚠️ Un matcher de números que arranca en `[\d.,]` se come el punto final de la oración

**Síntoma:** el test que exige que ningún número de la conclusión general aparezca si no está
en su parte daba **rojo por un dato que estaba bien**. La conclusión cerraba «…por 62.» y la
parte decía «…por 62, porque».

**Causa:** el matcher era `[\d.,]+`, así que capturaba `"62."` **con el punto** y buscaba esa
cadena en la parte, donde el mismo número termina en coma. Lo único distinto entre los dos
textos era dónde termina la oración.

**Regla:** un matcher de números arranca en dígito (`/\d[\d.,]*/`) y descarta la puntuación
final (`.replace(/[.,]+$/, '')`). Si no, la aserción valida la **redacción** en vez del dato
y falla justo cuando el dato es correcto — el peor rojo posible, porque empuja a cambiar el
texto que estaba bien.

**Vive en:** `tests/pricing-modelo.test.ts` («la conclusión general no dice ningún número que
su parte no diga») · *2026-08-10 cac-dos-monedas*

## Entregar una pantalla

### Regla: todo lo que se construye para el dueño se construye para los clientes, en la misma pasada

La vista de super admin y la del cliente son **la misma pantalla**. Nunca razonar «esto es
solo para el dueño».

- «todo esto tiene que modificarse también para los clientes, que les aparezca lo mismo; hoy
  en los clientes sigue igual que antes» (2026-07-12)
- «los cambios que hacemos tienen que impactar siempre para clientes también» (2026-07-22)
- «no entiendo por qué la vista de superadmin y cliente son diferentes en la tab de Plan,
  deben ser lo mismo» (2026-07-13)

*memoria [[cambios-impactan-clientes]]*

### Regla: verificá en el navegador antes de decir que está listo

No se declara hecho lo que no se ve en la app. Hay **permiso permanente de preview** (Chrome /
Claude in Chrome): usalo.

- «no veo que se haya marcado el progreso en la app. Eso no lo hiciste… revisa porque el fallo
  está de tu lado» (2026-07-14) — si él dice que falla, el fallo es nuestro hasta que se
  pruebe lo contrario.
- «Hay muchos gráficos que están mal, te invito a que hagas Claude in Chrome para verificarlo»
  (2026-07-19)
- «El botón de desconectar está muy pegado a la sección… Nuevamente fallo en el diseño, no sé
  por qué no lo revisas antes de publicar» · «El loader sigue viéndose arriba del todo,
  exactamente como la captura anterior… No puede ser que no sepas solucionar esto»
  (2026-08-01)
- **Probá vos**, no le devuelvas la prueba al usuario: mandá los mensajes, mové un lead y
  devolvelo, cambiá el nombre de una campaña pausada. «No funciona… Por favor, prueba tú»
  (2026-07-20)
- Las pruebas que salgan hacia afuera van **siempre** a martinkoncke@gmail.com y
  **+5493764673479** (2026-07-14).

### Regla: resolver en una pasada, con multiagente si hace falta

Gastar tokens sin arreglar lo pedido es la queja que más se repite al final del período.
Prefiere que gastes recursos antes que entregar algo a medias.

- «Realmente no entiendo en qué te estás gastando tantos tokens y aún no solucionas las cosas
  que te pedí… ¿cuántos prompts más para que lo arregles?» (2026-08-07)
- «si tienes que correr 10000 mil multi agentes para hacer esto bien, o de la manera que se te
  ocurra, pero hazlo bien» (2026-07-22)
- «ya dimos muchas vueltas, no sé qué tengas que hacer, si tienes que lanzar multi agente o lo
  que sea, pero soluciónalo» (2026-07-30) — cuando algo ya se corrigió dos veces y sigue mal,
  no vuelvas con otro parche.
- «corre un multi agente y haz bien esta vista… puedes utilizar la preview de Chrome, los
  multi agentes, todo» (2026-06-30)
- Antes de construir algo grande, **contale cómo lo vas a presentar** para que lo apruebe:
  «antes de hacer el onboarding, dime cómo lo piensas presentar, así te lo apruebo»
  (2026-07-10). Decisión relacionada: instalar skills que obliguen a pensar antes de
  desarrollar —brainstorming, writing-plans, grill-me— porque «no creo que estemos haciendo
  las cosas bien doer o simples» (2026-07-10).

### Regla: la documentación se escribe para que la lea ÉL

No solo para otro agente: depurada, con títulos, ordenada y visible en super admin
(`/admin/docs`). «si yo lo puedo entender fácil, eso me habilita a darle mejores prompts al
otro Claude» (2026-08-07). Este documento se rige por eso.

---

## Pendientes

Cosas escritas y no cableadas, o pedidas y no hechas. Verificá contra el código antes de
tomar una: algunas pueden haberse cerrado.

### ⚠️ El feed de notificaciones existe en la base y no lo muestra nadie

La tabla `notificaciones` se llena y `/api/notificaciones` responde, pero **ningún componente
lo consume**: el badge del sidebar viene de WhatsApp/Evolution, no de este feed. Y cada
reporte que se despacha escribe un link a `/perfil?tab=notificaciones`, una tab que ya no
existe. Es el mismo modo de falla que el resto de este lote: se escribe bien y no se lee.
Contradice lo que dice la memoria [[perfil-notificaciones-reportes]] sobre la campanita
in-app: al 2026-07-19 el feed está escrito y no se ve en ninguna pantalla.

Pendiente relacionado del dueño: **mapear todas las notificaciones existentes** en
Configuraciones → Notificaciones para activarlas/desactivarlas por canal (in-app pop-up y
sonido **por separado**, WhatsApp, email) — 2026-08-06.

**Vive en:** app/api/notificaciones · lib/reportes.ts (link a /perfil?tab=notificaciones) · *2026-07-19 ~landing-24-features-auditoria*

### ⚠️ La tab Teléfonos de /configuraciones no existe: el panel está escrito y nunca se montó

`app/configuraciones/TelefonosPanel.tsx` no lo importa nadie: `ConfigInnerTabs` solo lista
notif · fiscal · equipo. Esto **deroga** lo que dice la memoria [[telefonos-workspace]], que
la da por viva junto con Integraciones. En la misma pasada: `/api/admin/mako-grupo` no tiene
ningún caller en la UI, y `ConfigInnerTabs` arranca fijo en 'notif' **sin leer query params** —
el link `?tab=notif` que usan todos los avisos funciona por coincidencia con el default, y el
día que cambie el default se rompen los 49 avisos a la vez.

> **Resuelto el 15/10/2026** con «Configuración del negocio» (la entrada «Tu cuenta y Configuración del negocio», al
> final): `ConfigInnerTabs` se fue, cada sección es su ruta y `rutaDeTabVieja` (lib/ajustes-secciones.ts) manda el
> `?tab=notif` de los avisos a /configuraciones/notificaciones. El panel de Teléfonos sigue sin montar.

**Vive en:** app/configuraciones/TelefonosPanel.tsx · app/configuraciones/ConfigInnerTabs.tsx:18 y :24 · lib/avisos.ts:81 · *2026-08-06 rediseno-notificaciones*

### ⚠️ Entregable y Persona funcionan en el hub de onboarding pero son huérfanos del wizard

Los dos tienen su View, su route (GET/POST/DELETE) y aparecen como tabs del hub — pero el hub
vive en `/onboarding` y solo se desbloquea cuando el onboarding está 'done', así que un
cliente nuevo, durante el alta bloqueante, **nunca los ve**. No es un flag apagado: no están
cableados. Falta (a) sumarlos al union `PasoOnboarding` de `lib/capas.ts`, que es la fuente de
verdad de qué pasos existen; (b) meterlos en el array `onboarding` de la capa 'completo'; (c)
actualizar el `type Paso` **local** del wizard, que duplica el union y hay que tocar en
paralelo; y (d) agregarles rama en el builder de pantallas — sin la rama, aunque estén en el
array de la capa no se genera ninguna pantalla y el paso desaparece en silencio. Ojo: el hub
**no** está en /configuraciones (esa ruta no tiene nada de onboarding).

**Vive en:** lib/capas.ts:24 y :110 · app/onboarding/OnboardingWizard.tsx:48, :243-299, :484-491 · lib/onboarding-state.ts:56-67,82-93 · app/onboarding/OnboardingTabs.tsx:89-100 (el orden canónico) · *2026-07-28 mapear-onboarding-ajustes*

### ⚠️ El título de la pestaña del navegador siempre dice «MaKo»

Debería decir «MaKo - CRM» o el nombre de la tab donde está parado (2026-08-06). Ojo que el
módulo que lo resuelve tiene los dos bugs de matchers descritos en
[Layout, sidebar y tabs](#layout-sidebar-y-tabs).

Desde entonces lo escribe `app/_components/TituloTab.tsx` en todas las tabs; /crm era la que
faltaba, y lo que costó arreglarla (un observador del `<head>` que entraba en bucle) está en
«Un observador que reescribe lo que observa…», al final (12/10/2026).

**Vive en:** lib/titulo-tab.ts · app/_components/TituloTab.tsx

### La ficha del lead tiene una TERCERA copia, en /whatsapp, y es de solo lectura

[hallazgos-crm.md](hallazgos-crm.md) dice que la ficha vive en dos árboles (el modal
`LeadDetail` del CRM y la página `/leads/[id]`). Hay un tercero: `/whatsapp` no reusa ninguno
de los dos — tiene su propio pop-up inline (page.tsx 777-881) alimentado por
`/api/whatsapp/lead/[id]`, que devuelve un resumen liviano (`getLead` + `getVslEngagement`)
distinto del `CrmLead`. Resultado: desde el inbox la ficha es SOLO LECTURA y con secciones
propias, y su footer manda a `/leads/{id}` para poder editar. El wrapper reusable ya existe y
no hace falta tocar `LeadDetail` (que es controlado): `LeadEditModal` se monta solo con
`leadId` y ya está probado montado dinámico con `ssr:false` en `app/_components/Desglose.tsx:24`.

**Vive en:** app/whatsapp/page.tsx (fichaOpen/abrirFicha 207-210 y 454-469, markup 777-881) · app/api/whatsapp/lead/[id]/route.ts · app/leads/LeadEditModal.tsx · *2026-06-23 wa-inbox-recon*

### 21 llamadores siguen en el modo `total`/`idx` de `WizardShell`

No es deuda por sí sola (ver el descarte de abajo), pero cada uno que tenga el mapa en la mano
y lo aplane a dos números es un `indexOf` duplicado.

**Vive en:** app/** · app/_components/WizardShell.tsx

### Pedidos del dueño sin cerrar

- **Los 5 puntos que él mismo listó como faltantes** (2026-07-01): anidar Onboarding /
  Notificaciones / Funnel dentro de Configuraciones · mover el editor de prompts a «Contexto
  de MaKo» · Perfil con más campos y foto · historial de estados negativos de Meta ·
  recomendaciones de Meta en español.
- **Ruta propia (deep link) para cada entidad que hoy vive en sub-tabs**: cada llamada de
  ventas analizada, cada anuncio ganador, cada retro, cada task/proyecto. Pidió mapear todo lo
  que se está quedando sin ruta (2026-07-15).
- **/conocimientos:** que un recurso ligado a una clase aparezca en la vista general, y que
  los embeds de video de Drive salgan **verticales** (hoy salen horizontales y cortados) —
  2026-07-21.
- **En la vista de Mauricio siguen apareciendo tabs que deberían estar ocultas** cuando está
  todo vacío (2026-07-28).
- **Los íconos tardan en cargar** cada vez que entra a la app (2026-06-29).
- **El botón «Completar con los datos de Mau» sigue apareciendo** en el modal del onboarding
  «cuando ya dijimos que no debe estar ahí» (2026-08-02).
- **Saltos de línea en los chats de MaKo** (2026-06-24).

### Descartado a propósito (no volver a «arreglarlo»)

- **Migrar `app/chat-bot/SecuenciaWizard.tsx` al modo `pasos`.** Se revisó y **no duplica
  nada**: su `idx` es un índice de estado real, no un `pasos.indexOf(...)` recalculado. Es
  exactamente el caso para el que existe `total`/`idx`. El criterio para migrar es *«¿el
  llamador tiene el mapa y está recalculando la posición?»*, no *«¿existe un mapa?»*.

## Una guarda con lista blanca es una guarda que no existe

**El síntoma.** El dueño, sobre una pantalla del Video Generator: *«Que NO tenga
lenguaje argento, nada de lo que hagas debe tenerlo»*. Un escáner sobre el repo
devolvió **1.697 líneas con voseo o argentinismos en 340 archivos**: el board del
plan, el CRM, el onboarding, la landing pública `/vsl` y —lo más caro— los prompts
que definen cómo le habla MaKo a un lead mexicano.

**La causa raíz no era descuido.** Ya existía un test de voseo
(`tests/puente-panel-copy.test.ts`), y pasaba: miraba una **lista blanca de dos
archivos**. Cada pantalla nueva nacía fuera de la red, y nada avisaba. El propio
encabezado del test documentaba el mecanismo de contagio —el kit compartido trae
voseo en sus textos por defecto, y copiar de ahí lo propaga— pero solo protegía las
dos pantallas donde ya se había notado.

**Regla que queda.** Una guarda de texto se escribe **sobre `git ls-files`, no sobre
una lista**. El molde bueno ya estaba en el mismo archivo: el chequeo de
`var(--fs-*)` recorre el repo entero. Si una guarda necesita excepciones, van
declaradas **con su motivo** (acá: `app/admin/dev/**` son bitácoras internas y
`app/conocimientos/curso*` son transcripciones de un curso ajeno), no implícitas en
lo que la lista no menciona.

**Lo que destapó, que vale más que el cambio.**

- `lib/productos-ia.ts` tenía una frase **duplicada** del centinela
  `FRASE_PROHIBIDA` de `lib/ia-mensajes.ts`, y su propio guard no la veía **porque
  las dos diferían por una tilde**. Neutralizar el copy las hizo colisionar carácter
  por carácter y recién ahí falló el test. Corolario: un guard que compara strings
  literales tiene un punto ciego del tamaño de una tilde.
- Tres tests afirmaban el copy **en voseo** anterior. Se los dejó tolerantes a las
  dos variantes a propósito: verifican la **conducta** (que el guion no invente una
  dirección, que a una key vencida se le ofrezca pegar otra), no el dialecto.
- `lib/mako-doer-in.ts` reconoce «hacelo» como confirmación del dueño pero no
  «hazlo». Es lo que el dueño **escribe**, no lo que MaKo dice, así que no se tocó
  — pero queda anotado como hueco funcional.

**Lo que quedó SIN hacer, a propósito.** `lib/checklist-coach.ts` todavía le pide al
modelo *«En español rioplatense»* y `lib/cs-reescritura.ts` *«Voseo, directo»*. Son
**directivas de registro, no copy**: mientras estén, la salida sale en voseo por más
neutro que esté el resto del prompt. Necesitan una decisión de producto, no una
corrección de texto.

**Vive en:** `tests/puente-panel-copy.test.ts` (la guarda repo-wide),
`lib/ia-mensajes.ts`, `lib/checklist-coach.ts`, `lib/cs-reescritura.ts`.

## El `<Icon>` no se centra con `text-align`

El ícono de una zona de soltar salía pegado a la izquierda mientras los dos textos
de abajo, en el mismo contenedor con `textAlign: 'center'`, salían centrados.

**La causa** no está en el estilo del div: el preflight de Tailwind 4
(`node_modules/tailwindcss/preflight.css`, línea ~217) declara
`img, svg, video, canvas, audio, iframe, embed, object { display: block }`. A un
elemento de bloque el `text-align` del padre **no lo mueve**.

**Regla que queda.** Centrar un `<Icon>` (o cualquier `<svg>`) exige `display: flex`
+ `justifyContent: 'center'` —o `margin: '0 auto'`—, nunca `textAlign` heredado. Es
un modo de falla mudo: el resto del bloque se centra bien y el ícono no, así que se
lee como un descuido de diseño y no como una regla del framework.

⚠️ **Y NO se arregla en el componente `Icon`.** Ponerle `display: inline-block` al
svg centraría estos casos, pero cambia el flujo en todos los demás lugares del repo
—un ícono que hoy ocupa su propia línea pasaría a sentarse junto al texto—, que es
un riesgo mucho mayor que el bug.

**Vive en:** `app/_components/icons.tsx`, `app/video-generator/CargarGuiones.tsx`.

## «No se ve alineado» casi nunca es un problema de posición

**Vive en:** `public/cono-doc/ugc.css` → `.ugc-hero-arranque` / `.ugc-hero-primera`.

Una pastilla («Empezar →») con el nombre de la clase al lado se veía corrida. Martín lo
reportó **tres veces**, y las dos primeras respuestas fueron mías y estuvieron mal:

1. *«están descentradas»* → medido, las cajas estaban a **0,01 px**. No era.
2. *«hay que mover el texto»* → se lo subió 2 px, después 1,25 px. **Ambos invisibles**, y
   él contestó lo obvio: «sigue exactamente igual, no cambió nada». Tenía razón: 0,75 px de
   diferencia entre dos intentos no se ve.

**Lo que estaba mal era el CUERPO, no la posición.** El nombre estaba en 11,5 px contra los
13 px del rótulo del botón. Un texto más chico y más claro al lado de una pastilla no se lee
como parte del renglón: **cuelga de ella**. Ningún desplazamiento arregla eso.

Y con los dos al mismo cuerpo, la alineación correcta es la que él nombró —«alineado al
TEXTO de Empezar»— y tiene una sola herramienta: **`align-items: baseline`**, que apoya los
dos textos en la misma línea por definición, sin ningún número que ajustar. El
desplazamiento a mano se eliminó.

⚠️ **`baseline` se había probado ANTES y se descartó, por un síntoma que venía de otro
lado.** Con cuerpos distintos ninguna alineación iba a funcionar, así que la prueba «falló»
y la solución correcta quedó descartada por una razón falsa. **Cuando descartes una opción,
anotá contra qué la probaste**: si esa condición cambia, la opción vuelve a estar viva.

**Las tres reglas que quedan:**

- **Cuando la medición dice que está bien y la persona sigue viéndolo mal, lo que está mal
  es la pregunta.** Medir con más precisión sobre la métrica equivocada no acerca nada: hubo
  tres mediciones —cajas, tinta, baselines— y las tres dieron «medio píxel», que era cierto.
- **Antes de mover algo un píxel, preguntá si las dos cosas tienen el mismo tamaño, el mismo
  peso y el mismo color.** Un desajuste de esos se lee como desalineación y no se arregla
  moviendo.
- **Si el arreglo termina siendo un número, es sospechoso.** El bueno acá no lleva ninguno.

**El método que sí funcionó las tres veces que se usó** (encuadre de tapas, cuerpo del
texto, y este): dibujar las variantes una debajo de otra y mirar. `scratchpad/variantes-fila.mjs`.


---

## Un atributo que la PERSONA toca no puede colgar de estado vivo

`<details open>`, `<dialog open>`, `<input checked>` sin `onChange`: son atributos que el
navegador cambia por su cuenta cuando alguien interactúa. Alimentarlos desde un valor que
se recalcula en cada render los rompe de dos formas a la vez, y una de las dos no da
ningún error.

El caso, del 31/08/2026, en el desplegable «Tu navegador» de `/video-generator`:

```tsx
<details open={!llamo}>          // `llamo` sale del estado que se re-pregunta cada 15 s
```

1. **Mismatch de hidratación.** El server pinta con el snapshot que trajo la página; el
   cliente re-pregunta a los milisegundos y ya contesta otra cosa. React lo denuncia y
   **no lo parcha**.
2. **El que no avisa, y es el caro: React reescribe el atributo cada vez que el valor
   cambia.** La persona abre el panel, el poll vuelve 15 segundos después con otro valor,
   y el panel se cierra solo. No hay error, no hay log: hay un desplegable que «no se
   queda abierto», que es como se reporta y no lleva a ningún lado.

**La cura es colgarlo de un valor que NO cambia nunca** — acá, el dato que vino del
server: `open={!inicial.ultimoVisto}`. Con eso React no vuelve a tocar el atributo en toda
la vida del componente, y el abierto/cerrado queda donde tiene que estar: en manos de
quien mira. Es un `defaultOpen`, y decirlo así en el nombre de la variable ahorra el
próximo intento de «actualizarlo».

⚠️ **Y se verifica ESPERANDO.** Abrirlo y sacar la captura da verde sobre el bug: el
segundo modo de falla necesita que pase un ciclo del poll. Abrir, esperar más que el
intervalo, y recién ahí mirar.

**Vive en:** `app/video-generator/PuentePanel.tsx`.

### La auditoría UX/UI, y lo que se midió sobre la app renderizada (01/09/2026)

**Vive en:** `app/globals.css` · `tests/puente-panel-copy.test.ts` ·
`lib/prompts-video.ts` · `app/video-generator/plan-montaje.ts` ·
`app/video-generator/escenario-reuso.ts` · `scripts/publicar-extension.mjs`

#### ⚠️ Se pudo mirar la app de verdad, y el camino está escrito

Toda la sesión falló al intentarlo: una pestaña CDP nueva no hidrata, y el Chrome
real **no llega al dev server local** (gotcha ya documentado). El camino que sí
anda, y que quedó reusable en el scratchpad como `mirar.mjs`:

1. Un Chrome DEDICADO con `--remote-debugging-port=9333` y `--user-data-dir` aparte.
2. Entrar por `/api/auth/dev-login?ws=1&next=<ruta>` — **`ws=1`, no `ws=3`**: el
   Cliente de Prueba tiene el onboarding pendiente y tapa cualquier tab nueva.
3. `Emulation.setDeviceMetricsOverride` **antes** de navegar: sin viewport
   declarado, `innerWidth` es 0 y toda medición de layout devuelve cero — que se
   lee como «no hay nada», el peor falso negativo.
4. Esperar a que `innerText.length` se quede QUIETO tres vueltas, no a un timeout.

**Y lo que eso cambia:** una auditoría de código dice «este color parece flojo»;
una medición dice «2,46:1 contra un mínimo de 4,5, en 1.045 elementos de /crm».
De los 8 agentes de la corrida, **ninguno** pudo mirar una pantalla autenticada.
Los hallazgos que valieron salieron de medir, no de leer.

#### Un token de texto que no pasaba AA, usado 1.158 veces

`--faint: #98A0AC` daba **2,46:1** sobre `--surface-2` y 2,64 sobre blanco. En 207
archivos. Y fallaba en los DOS temas por caminos opuestos: en oscuro, 3,08.

⚠️ **Y `--dim` se movió aunque NO estaba mal.** Con `--faint` corregido a 4,67 los
dos quedaban a 0,03 de luminancia: tres niveles que se leen como dos. **Arreglar el
contraste aplastando la jerarquía es cambiar un problema por otro.**

⚠️ **El escalado proporcional de RGB era la corrección obvia y estaba mal.** El
azul aporta poca luminancia, así que multiplicar los tres canales dejaba `--faint`
MÁS OSCURO que `--dim` e invertía la escala. Se descartó midiendo. La corrección
correcta baja **sólo la luminosidad**, en HSL, conservando tono y saturación.

#### Un guard de copy con un hueco de forma, no de palabra

Escribí un segundo test de voseo y lo borré: ya existía uno repo-wide y bien
hecho. **Dos guardas para la misma regla es cómo una se queda vieja.**

El hueco del que existía no era el acento: era **el pronombre pegado**. `pedís`
estaba en el mapa desde siempre; `pedíselo` es otra palabra y el límite Unicode
—correctamente— no la parte. Por eso `PermissionState` decía «Pedíselo a quien
administra la cuenta» a todo cliente que choca con un permiso.

**La regla: cuando un detector de formas verbales deja pasar algo, fijate si lo que
falta es una FAMILIA morfológica y no una palabra.** Agregar `pedíselo` sola habría
dejado vivos `mandáselo`, `decíle`, `ponéle` y seis más — que es lo que apareció al
agregar la familia entera.

Y de los nueve que aparecieron, **tres NO eran errores**: son la voz de MaKo
hablándole a Martín, donde el rioplatense es la regla. Van como excepción declarada
con su porqué. Corregirlas habría sido «arreglar» la voz del producto para su dueño.

#### ⚠️ Un detector con falsos positivos se apaga, y apagado no detecta nada

El primer intento usaba las formas SIN tilde y daba **1.103 hallazgos**. `sabes`,
`haces`, `deja`, `mira` y `toca` son español correcto —«tú sabes», «MaKo deja de
usarlo»—. Con la lista acentuada quedaron **2 en 225 archivos**, y una era real.

La precisión no es prolijidad: es lo que decide si la guarda sobrevive.

#### El formato que más dirección necesitaba era el único sin ninguna

`PROMPT_VIDEO` tenía UNA entrada —Car Talks—, así que The Office caía al prompt que
escribe el modelo: genérico, en inglés, compitiendo con la imagen de referencia.

Se había dejado así **a propósito y con razón**: copiarle el de Car Talks le habría
metido «la palanca de cambios» a una oficina, que no es un detalle de más sino una
instrucción falsa. **Pero la conclusión correcta no era «ninguno»: era el suyo.**

**La regla: cuando se descarta bien una solución mala, el trabajo no terminó —
descartar no es resolver.** El repo tenía las reglas del formato medidas desde el
24/08; lo que faltaba era escribirlas como prompt.

⚠️ **Y el formato decide si cubre un clip de voz en off, no un guard global.** Un
test existente decía —con razón— que para Car Talks «esta persona dice» sobre un
clip en off es falso. La respuesta CAMBIA por formato: The Office declara
`habla: 'mixto'` y tiene una rama para cada caso. La plantilla devuelve `null` para
lo que no sabe dirigir.

Antes de esto, `promptDeClip` se caía al prompt del modelo apenas `habla` era false
— y en The Office eso son TRES de sus ocho tomas. **Un clip mudo sin instrucción de
estar mudo es un clip donde el avatar habla encima de la voz en off.**

#### Las tomas de un anuncio no duran todas lo mismo

`porQueNoSirveElPlan` recibía un ESCALAR y se lo llamaba con `clips[0].segundos`.
Falla en las dos direcciones: con la primera más corta rechaza tramos legítimos con
un mensaje falso; con la primera más larga **acepta un plan inválido**, y ffmpeg
devuelve lo que hay y calla.

⚠️ **Y era un bug mío del mismo día, sobre el plan que yo mismo reparé**: el de una
clienta quedó con tomas de 10, 8 y 10 segundos.

**La regla: antes de colapsar una colección a un escalar, preguntá si la UI deja
que sus elementos difieran.** Acá había un botón «Darle 10 segundos» y una fila
para elegir 4/6/8/10 por toma: mezclarlas no es un caso raro, es el camino normal.

Y el mensaje pasa a decir «ESA toma dura N»: decir «cada» vuelve a afirmar la
uniformidad que causaba el bug, sobre el anuncio de alguien que ve en su pantalla
que sus tomas duran cosas distintas.

#### Un escenario es del LUGAR, no del formato

Reusar la imagen ya generada ahorra una generación paga y una espera por escenario
—cuatro en The Office—. Pero el match **no puede ser por formato**: «The Office»
son cuatro rincones de una oficina y el próximo anuncio puede transcurrir en otros
cuatro. Reusar por formato pone a la persona en un sitio que su guion no menciona,
y eso no da error.

Las cuatro que NO se reusan, cada una con su test: lugar distinto, formato distinto
aunque el lugar coincida, **sin `elegidaId`** (la url vence a las 6 h y el mediaId
no: una copia sin él se ve perfecta y no se puede filmar) y **sin confirmar**
(elegir no es confirmar; reusar una no confirmada propaga una decisión que nadie
tomó).

#### Publicar la extensión: lo que sí se pudo hacer

No puedo subirla —acuñar el token OAuth exige autenticarse en la cuenta de Google—
pero sí convertir el trámite en un comando: `scripts/publicar-extension.mjs`.

⚠️ **Y no sirven las credenciales de YouTube que ya están en el `.env.local`.** Un
refresh token está atado a su SCOPE: el de YouTube no puede hablarle a la Chrome
Web Store aunque el `client_id` sea el mismo. Queda escrito porque es exactamente
el atajo que uno intenta.

El script **no dice «publicada»**: `status: OK` significa que Google aceptó el
pedido y lo mandó a REVISIÓN, que tarda días y puede rechazarlo. Y no trata el 200
como éxito — la tienda contesta 200 con `uploadState: FAILURE` y el motivo adentro
de `itemError[]`, el mismo modo de falla ya documentado para Meta y Evolution.

#### Lo que quedó SIN hacer

- **El onboarding de la tab `/video-generator`** (persona, clonación de voz,
  muletillas por país). El contrato está en la skill `tab-onboarding` del repo:
  tres etapas, lo aburrido AL FINAL, y el ensayo con MaKo haciendo de CLIENTE.
- **«Escenarios» como paso propio con variaciones de fondo.** El dato ya existe
  (`item.escenas` con `lugar` + `prompt`, y `variantes-imagen.ts` ya genera
  variantes); lo que falta es la pantalla que deje pedir otra versión del MISMO
  lugar sin rehacer el escenario entero.
- **Los ~40 hallazgos de la auditoría que no se tocaron**, entre ellos tres donde la
  pantalla afirma un hecho que el código no sabe: el plan celebra la caída de
  Supabase (`app/plan/page.tsx:56`), el CRM dice «todavía no hay leads» al lado de
  la cinta roja que dice que no pudo leerlos, y las notas del lead se tragan el
  error con un `.catch(() => {})` e invitan a escribir una duplicada.
- **48 pantallas escriben su propio `<main>`** contra 17 que usan `Pagina`, y
  `Pagina` tiene 88 px de padding lateral fijo que no baja en móvil.
- **Cero `loading.tsx` en toda la app.**

### El onboarding épico: lo épico era el material que ya estaba y no se mostraba (02/09/2026)

**Vive en:** `app/video-generator/AnuncioEnConstruccion.tsx` ·
`app/video-generator/OnboardingVideoGen.tsx` · `app/video-generator/video-datos.ts` ·
`app/globals.css` (`.mk-momento`) · `lib/elevenlabs.ts`

#### La regla que decidió todo, y que ya estaba escrita

`docs/onboarding-nuevo.md` la fija para el producto entero:

> «Cada píxel que se mueve transporta un hecho del negocio del cliente. Si no
> transporta ninguno, no se mueve.»

Con sus tres corolarios operativos: **el dorado es un verbo** (se enciende
mientras MaKo hace algo, se apaga al terminar), **un solo momento por sesión**
—micro 100 ms, transición 250 ms, momento 600 ms— y **la celebración es un dato,
no una animación**.

**Lo que eso cambia al abordar un pedido de «hacelo épico»:** no se busca un
efecto, se busca el material. Y el material estaba.

#### ⚠️ El dato más fuerte del recorrido existía, se leía, y se tiraba

`estadoContextoVideo()` llamaba a `personaEstado()` —que trae la descripción
física que MaKo escribió mirando las fotos— y **no copiaba el campo**. Está
cargada en los cuatro workspaces vivos, con mil y pico de caracteres cada una.

O sea: la primera pantalla del onboarding podía abrir devolviéndole a la persona
algo que MaKo ya sabía de ella, sin una sola llamada nueva, y abría con un botón
de subir archivo.

**La regla: antes de diseñar una pantalla nueva, listá lo que la función que ya la
alimenta está devolviendo y nadie lee.** Un campo que se trae y se descarta es la
forma más barata de contenido que existe.

#### ⚠️ Y el aside no existía, que es la mitad de la pantalla

`WizardShell` sin `escenario` pinta UNA columna de 620 px. Con él son 980 partidos
por `.mk-svc-modal`, la misma grilla del modal de /integraciones, del onboarding
global y del panel de activación de cada tab — los cuatro lugares donde el cliente
ya aprendió esa pieza. **Es un prop opcional: pasarlo no toca a los otros 25
call-sites.**

Lo que va adentro no es un carrusel. La regla del aside negro ya estaba escrita en
`PanelMarketing`: *«sin conexión va la promesa, con conexión van los FACTS de tu
cuenta … un "ok ✓" no prueba nada»*. Acá esa regla se extiende a un recorrido de
seis pasos: el aside **es el anuncio que la persona vino a hacer**, y cada paso lo
llena con algo suyo.

#### El copy afirmaba una deducción que a veces no ocurrió

El paso del acento decía «lo deduje de tu zona horaria» para **todo** acento no
declarado. `default` no es eso: es que la zona horaria **no está en la tabla** y se
cayó al neutro.

Medido: **ws13 tiene `America/Buenos_Aires`, que no figura en `POR_ZONA`** — ahí
está `America/Argentina/Buenos_Aires`. Así que a esa persona le contábamos una
deducción inventada sobre su propia forma de hablar.

`resolverAcento` devuelve `origen` desde que existe; `estadoContextoVideo` no lo
copiaba. **Un tercer estado que el server conoce y la pantalla colapsa en dos es
una mentira esperando a que alguien la lea.**

#### El momento, y por qué va al final

Cinco renglones escalonados a 90 ms y un número que entra a los 450 y cierra a los
600. Va en el **cierre** y no en el paso 1 —que es donde está el dato más fuerte—
porque el wow del paso 1 es **contenido**: llega en tres segundos sin animar nada.
El momento se gasta donde manda el *peak-end*.

⚠️ **`.mk-momento` no se apaga con `prefers-reduced-motion`: se salta al final.**
Es el patrón de la casa, y acá además es obligatorio por una razón técnica —
`animation: none` sobre un `both` deja los elementos en su estado inicial, o sea
**invisibles**. Quien pidió menos movimiento se quedaría sin la pieza entera.

#### La prueba de vida que faltaba: escucharse

El paso de la voz se cerraba con un tilde. La skill del onboarding lo prohíbe con
todas las letras —un paso de conectar se cierra con **evidencia**— y acá la
evidencia es oírse: un clon malo se oye en dos segundos y **no se ve en ninguna
pantalla**. El repo tiene medido que uno hecho con material conversacional sale
~30 Hz por debajo del tono real.

El permiso de TTS se comprobó con la técnica que ya quedó escrita hoy: **pedido
real sin cuerpo, 422 = puede**, sin gastar cuota ni crear nada.

Y es el **único dorado de la pieza**: el borde del cuadro se enciende mientras la
voz habla y se apaga al terminar.

#### Lo que quedó SIN hacer

- **El piso del número.** Hoy es `guiones × formatos` y con cero guiones se ofrece
  la salida correcta. La dirección propone un escalón intermedio —`razones ×
  ángulos`, redactado como CAPACIDAD y con la palabra «puede»— para el cliente que
  tiene razones cargadas y ningún guion. No se construyó: agrega dos lecturas
  nuevas a una página que hoy no las hace.
- **La duración de cada muestra de voz.** Es un campo en el upload, y con él el
  paso tendría un `<Progress>` legítimo («47 de 90 segundos») en vez de una lista
  de nombres de archivo.
- **`costoPorClip()` en la pantalla del puente**, para decir «te alcanza para N
  anuncios». ⚠️ Con su trampa medida: `video-generator.costo-clip` vale **150 en
  ws1** por un bug del lote, así que hay que leerlo por `costoPorClip()` —que lo
  descarta— y nunca la key cruda.


## El «¿seguro?» se dibujaba DETRÁS del modal que lo abrió, y con eso una acción destructiva no se podía completar

**Vive en:** `app/_ui/Confirm.tsx` (`Z_CONFIRM`) · `tests/confirm-encima-de-modales.test.ts`

`Z_CONFIRM` era 500, con un comentario correcto: «por encima de cualquier modal de la pila»
(`app/_components/pila-modales.ts`, `Z_BASE = 130` + niveles). El problema es lo que la frase NO
cubría: **los modales escritos a mano no pasan por la pila y eligen su z-index solos.** Medido el
25/09/2026 barriendo `app/`: /whatsapp usa 1000, la bandeja de empresa hasta 2500, /email 1000,
la ficha del lead del CRM 1000 y /perfil 3000. En todos ellos el confirm quedaba debajo, y el
síntoma es de los peores: **el fondo oscuro del confirm SÍ se ve**, así que parece que la app se
colgó, no que falte un clic en otro lado.

**No era cosmético.** El único camino para recuperar una línea de WhatsApp desvinculada (403) es
«Desconectar» y volver a vincular, y ese botón confirma desde el modal de z-index 1000: la línea
de Mauricio llevaba 22 días caída con su chatbot venciendo el domingo. La otra acción atrapada
era «borrar el historial» de la bandeja.

**La regla que queda: un confirm no es un modal más, es la pregunta de la acción que estás por
hacer, y va arriba de TODO overlay.** Hoy `Z_CONFIRM = 3500`: arriba del techo de modales medido
(3000) y abajo de los carteles flotantes y del login (4000 y 9999), que no tapan una pregunta
centrada a pantalla completa.

⚠️ **Y el guard barre el árbol, no lleva una lista.** `tests/confirm-encima-de-modales.test.ts`
busca los overlays de pantalla completa (`position: 'fixed'` + `inset: 0` + su `zIndex`) en todo
`app/` y falla si alguno llega al z-index del confirm. La prueba de que una lista no servía: al
romperlo a propósito aparecieron DOS archivos más de los tres que había encontrado a mano.

*(25/09/2026, auditando el proyecto del Chatbot: el bug estaba cargado como una tarjeta de 18
puntos sobre 100 y era el candado del entregable de esa semana.)*


## Un pop-up para un estado que BLOQUEA se lee como «sacate esto de encima»

**Vive en:** `app/whatsapp/EvolutionConnect.tsx` (modo `inline`) · `app/whatsapp/WhatsAppApp.tsx`
· `app/globals.css` (`.mk-tab-alarma`)

El 25/09/2026 la tab de WhatsApp pasó a abrir sola la pantalla de conexión cuando el número
está caído. Primera versión: un modal con el QR sobre la bandeja. El dueño lo miró y dijo lo
único que importaba: **«el usuario que entra rápido quiere quitar el pop-up»**. Un cartel
encima de los chats compite con los chats y pierde: se cierra sin leer, y el que lo cerró se
queda sin saber que su chatbot no manda nada.

**La regla: si el estado impide usar la pantalla, el estado ES la pantalla.** El panel ocupa
el lugar de la bandeja —no tapa nada útil: con el número caído lo de atrás son conversaciones
viejas— y no se puede ignorar. El modal queda para lo que sí es opcional: gestionar un número
que YA funciona (sincronizar, desconectar, borrar historial), y se abre tocando la tab en la
que ya estás.

**Y el texto, al mínimo.** Título, la línea que dice dónde tocar en el celular, el QR. Nada de
«número no oficial (por QR)», ni «el QR se renueva solo, esta ventana lo detecta». La única
frase que se conservó es la que nombra un HECHO del mundo del dueño —«WhatsApp cerró la sesión
el 3 de septiembre; tu teléfono está bien»—, que es la que evita el «no entiendo, mi teléfono
anda perfecto».

⚠️ **DOS PREDICADOS PARA EL MISMO HECHO SE CONTRADICEN EN PANTALLA.** El botón de la tab
titilaba en rojo (`canalNoOficial === 'desconectado'`) al lado del chip diciendo «Chatbot: ON»
en verde, porque cada uno tenía su propia cuenta de qué significa «caído». Ahora hay un solo
`canalCaido` y los dos lo leen. Dos fuentes para el mismo hecho no es redundancia: es una
contradicción esperando el día en que difieran.

⚠️ **Y UN TITILEO QUE ANIMA LA OPACIDAD ESCONDE LO QUE QUIERE MOSTRAR.** `blinkRed` baja a
`opacity: .45`: sobre el fondo claro la etiqueta quedaba en 1,75:1 —para leerla había que
esperar al pulso— y `prefers-reduced-motion` no la alcanzaba, porque la animación estaba
inline. La alarma de una tab va por clase (`.mk-tab-alarma`), late en el BORDE y la sombra, y
con movimiento reducido se queda en rojo fijo: dice lo mismo sin moverse.

## La pila de modales: `anidada` y `contenedor` son dos preguntas distintas (27/09/2026)

**Vive en:** `app/_components/pila-modales.ts` · `app/_ui/Modal.tsx` ·
`app/_ui/ui.css` · `tests/modal-contenedor.test.ts`

La pila esconde con `display:none` a toda capa que tenga otra encima. Eso es correcto
mientras los modales sean HOJAS. Dejó de serlo el día que un modal pasó a CONTENER una
pantalla entera con sus propios modales (la ficha de un cliente monta el tablero).

Tres cosas salieron de ahí, y las tres viven en el sistema de diseño:

### 1. `contenedor`: el de ABAJO declara que no lo apaguen

`anidada` lo declara el de ARRIBA («yo no tapo al de abajo»). `contenedor` lo declara el de
ABAJO («lo que se abre encima vive adentro mío»). No son intercambiables y hacen falta las
dos: el de abajo no puede saber quién se va a abrir encima, y el de arriba no sabe dónde
está montado.

⚠️ **El modo de falla, si falta:** el modal de adentro se monta, se pinta `display:flex`,
le toca un z más alto… y no se ve nada, porque su ANCESTRO está en `display:none`. Un
subárbol bajo un `display:none` no se pinta, `position: fixed` incluido. Se reportó como
«se bugea y no abre nada».

⚠️ **Y la regla pura está exportada** (`decidirVisible`), no adentro del hook: adentro no la
puede importar ningún test, y esta condición ya dejó una pantalla en blanco. Mismo criterio
que `exigirClienteDePrueba` en `lib/auth-session.ts`.

### 2. Dos `Modal` apilados se cerraban los DOS con un solo Escape

`stopPropagation()` frena la propagación a otros NODOS, no a los otros listeners del MISMO
nodo — y todos los modales escuchan en `document`. O sea que esto siempre estuvo roto; lo
que cambió es que ahora hay dos capas visibles a la vez y se ve.

Va `capa.esElDeArriba()`, y es una **función** a propósito: un listener de teclado se
registra una vez y vive muchos renders. Con un boolean habría que meterlo en las deps del
efecto —y el del `Modal` devuelve el foco en su cleanup, así que re-ejecutarlo haría saltar
el foco cada vez que algo se abre encima— o guardarlo en un ref escrito durante el render,
que es lo que marca `react-hooks/refs`. Preguntándolo en el momento de la tecla, la
respuesta es siempre la de AHORA y el handler no tiene dependencias.

### 3. Las reglas de bloque del cuerpo alcanzaban a los overlays anidados

`.mk-modal__cuerpo > *` pone `padding: 18px 0` y `border-top: 1px` a cada hijo: es lo que
convierte una pila de textos en grupos. Un modal contenedor tiene capas hijas colgando de su
cuerpo, y un `.mk-modal__fondo` es `position: fixed; inset: 0` — las dos reglas empatan en
especificidad con la suya y están más abajo en el archivo, así que GANAN.

Resultado medido: el selector de portada quedaba con **cero padding lateral** (la caja
tocando los dos bordes en una ventana angosta) y con **un filete de 1 px cruzando el borde
de arriba del viewport**. Se arregla con `:not(.mk-modal__fondo)` en las tres reglas: son
bloques de CONTENIDO, y un overlay no es contenido del cuerpo — sólo vive ahí en el árbol.

**Y el otro lado (24/10/2026):** un hijo que trae su propio margen y su propia raya los DUPLICA. `.co-uso__mas`
(lo del super admin en «Tus cuentas de IA») tenía `margin-top: 18px` y `border-top` encima de los 18 px y la raya que ya pone
el cuerpo del modal: quedaban 54 px de aire entre dos secciones. Un hijo directo del cuerpo no trae separación propia.

**La regla general: toda regla `> *` de un contenedor de layout tiene que preguntarse qué
pasa el día que uno de esos hijos sea un overlay.** Es la misma familia que «un
`max-width` puesto al texto adentro de una caja más ancha»: una regla correcta para el
contenido, aplicada a algo que no es contenido.

---

## El selector de portada dejó de ser un modal: las tres que rompió ser un POPOVER

**Vive en:** `app/_components/PortadaPicker.tsx` · `app/customer-success/FichaCliente.tsx`
· `app/plan/board/BoardShell.tsx` (`CampoPortada`) · `app/plan/board/PrioridadAMano.tsx`

27/09/2026. «Quiero que sea similar a Notion. Replicalo», con la captura del selector de
portada de Notion al lado. Era un `Modal` centrado de 720 px; pasó a ser un panel anclado
al botón que lo abre, que aplica en el acto y **no se cierra al elegir**.

El cambio de forma no es cosmético y por eso lo demás se cayó: un modal centrado tapa
justo la portada que estás eligiendo, así que cerrar-al-elegir era obligatorio. Anclado y
abierto, probar tres degradados son tres clicks.

**Las tres las encontró el navegador, y ninguna da error.**

### 1. El panel no se ubicaba NUNCA: `left:0, top:0, opacity:0`

El portal no existe en el primer render (`if (!montado) return null`), así que la primera
corrida del efecto que mide encuentra `panelRef.current` en `null` y se va sin medir. Como
`recolocar` es un `useCallback` estable, **el efecto no vuelve a correr jamás** y el panel
se queda invisible en la esquina para siempre. Medido en Chrome: `pop {l:0,t:0}`,
`opacity "0"`, con el ancla en `l:650,t:145`.

No tira, no avisa y no se ve en una captura: con `opacity:0` la pantalla se ve **igual que
antes de abrirlo**, así que se lee como que el botón no hace nada. Va `montado` en las
dependencias.

**La regla: un efecto que mide un nodo montado por un portal depende del estado que monta
el portal.** Es la familia de «escribir la salida no es ofrecerla», del lado del layout.

### 2. Un Escape cerraba el panel Y LA FICHA ENTERA

Exactamente el bug que `72aa1109` cerró para los modales, reaparecido del lado del popover
— y la guarda que lo arregló allá (`capa.esElDeArriba()`) **acá no alcanza**. El panel se
registra en la pila y es el de arriba, así que el handler de la ficha se abstiene bien; lo
que no se abstiene es lo que corre DESPUÉS del nuestro sobre el mismo nodo.

`stopPropagation()` frena la propagación a otros NODOS y no toca a los listeners hermanos
del mismo — y todos los Escape de la casa viven en `document`, en captura. Va
**`stopImmediatePropagation()`**, que es el único que los frena. Medido: perdías el cliente
por cerrar el selector de portada.

**La regla: el que está arriba de todo frena con `stopImmediatePropagation`, no con
`stopPropagation`.** `esElDeArriba()` dice si te toca contestar; no impide que conteste
otro.

### 3. Un alto «que justo entra» no entra

Con el cuerpo en 330 px y 13 muestras, el contenido medía 338: ocho píxeles de scroll, que
es la peor cantidad posible. Va fijo en 352 y lo que sobra es aire. El alto **tiene** que
ser fijo: la posición se calcula contra la caja del panel, así que un cuerpo que cambia de
alto al cambiar de pestaña hace saltar el panel de lugar.

### Lo que quedó verificado, y lo que no

Con un arrastre… no: con clicks reales en Chrome (`channel: 'chrome'`, headless false),
sobre la ficha de Leila (ws9, `portada` en `null`, restaurada a `null` al terminar y
comprobada con una lectura aparte):

| | |
|---|---|
| borde derecho del panel = borde derecho del ancla | 790 = 790 ✔ |
| debajo del ancla | `t` 185 = `bottom` 177 + 8 ✔ |
| nada encima (`elementFromPoint` del centro) | «EL PANEL» ✔ |
| la ficha sigue visible detrás | `display: flex` ✔ |
| elegir no cierra y el panel no se mueve | ✔ |
| la banda cambia detrás mientras el panel está abierto | ✔ |
| Escape cierra el panel y **no** la ficha | ✔ |
| click afuera cierra | ✔ |
| desde el detalle de un proyecto: pegado al borde derecho, se da vuelta hacia arriba y entra entero | `r` 1106 = 1106, `b` 610 ≤ ancla 618 ✔ |

⚠️ **SIN VERIFICAR: que el panel siga al ancla cuando la columna scrollea.** Es la única
razón por la que `ancla` es el NODO y no un `DOMRect`, y no se pudo ejercitar: en el
proyecto que se abrió, la columna derecha del detalle **entra sin scroll**
(«ningún ancestro scrollea»). El listener está puesto (`scroll` en captura, porque el de un
contenedor no burbujea) y la matemática la fija `tests/portada-popover-ubicacion.test.ts`;
lo que falta es el gesto. Hace falta un proyecto con la columna derecha más larga que la
ventana.

## Medir un ancho con la fuente de FALLBACK es medir otra cosa — 8,8 px (27/09/2026)

El aviso de «datos sin marcar» tenía que entrar en un renglón debajo del desplegable de
etapa (210 px). Se midió en el navegador, con los estilos exactos, y dio **205,8 px**:
entra. En pantalla se partía en dos.

La medición se hizo en una página donde el bloque declaraba
`font-family: 'Geist', system-ui, sans-serif` y **Geist no estaba cargada**, así que midió
**system-ui**. Con Geist de verdad el mismo contenido mide **214,6**. La diferencia —8,8 px—
era exactamente todo el margen que había.

**La regla:** antes de leer un ancho, esperar la fuente.

```js
await document.fonts.load("650 12.5px Geist");
await document.fonts.ready;
// y comprobarlo, que es una línea:
getComputedStyle(nodo).fontFamily            // qué pidió
document.fonts.check("650 12.5px Geist")     // qué hay
```

⚠️ **Y el olor que lo delata sin medir de nuevo: un resultado que entra por poco.** 205,8
contra 210 son 4,2 px de holgura, o sea 2%. Una medida tipográfica con 2% de margen no es
un «entra»: es un «entra con esta fuente, este peso, este idioma y este número de dígitos».
Cuando el margen es así de fino, la respuesta no es afinar la medición — es sacarle el
problema al layout.

⚠️ **Por eso la garantía va en el CSS y el texto se elige con la medición, no al revés.**
`flex-wrap: nowrap` no depende de ninguna fuente: es un renglón, siempre, en cualquier
idioma y con cualquier conteo. Lo que la medición decide es el COPY —acá, sacar la palabra
«datos» (38 px que no dicen nada nuevo debajo de la etapa del lead) y dejar UNA acción en el
caso raro—, que es lo que además evita que la columna se ensanche. Si la garantía cuelga de
un número, el día que cambie la fuente vuelve el bug.

**Vive en:** `app/crm/lead-view/DatosSinMarcarCard.tsx` · *2026-09-27 aviso-un-renglon*

## Una rotura que no toca el código no prueba nada (27/09/2026)

La regla de la casa es probar cada test rompiéndolo. Dos veces el mismo día la rotura salió
verde, y las dos veces la conclusión rápida —«el test no mide»— era falsa la segunda:

1. **El test no medía.** La aserción de posición pedía «después del desplegable y antes de
   las tabs»; la rotura devolvió el aviso a su franja vieja, que también está entre las dos.
   Arreglo: reanclar al arranque del CUERPO. ⚠️ Y el ancla tiene que ir en **código**: el
   test lee el fuente sin comentarios, así que un ancla comentada no se encuentra nunca y el
   test falla por eso, no por lo que persigue.

2. **El test estaba bien y la ROTURA estaba mal.** `s.replace("flexWrap: 'nowrap'", ...)`
   con `count=1` pegó en el **comentario** que explica la regla —está más arriba en el
   archivo— y no en la línea de estilo. El código quedó intacto, así que el test pasó, con
   razón.

**La regla: después de romper, verificar que se rompió LO QUE SE CREE.** Un `grep -n` del
patrón antes de reemplazar (¿cuántas veces aparece? ¿la primera es la que quiero?) o un diff
de la rotura. Cuesta un comando.

⚠️ **Y el caso 2 es específico de este repo, donde los comentarios explican la regla que el
código implementa.** Cada vez que un comentario cita literalmente la línea que documenta
—que acá es la convención— hay DOS ocurrencias de ese texto, y la del comentario está
primero. Es la misma familia que «el analizador se lee a sí mismo», del lado del que edita.

**Vive en:** `tests/crm-ficha-y-selector.test.ts` · *2026-09-27 aviso-un-renglon*

## Un arreglo correcto puede perder contra lo que la persona espera ver (27/09/2026)

«El tablero abre con 1.138 tarjetas y el pipeline que trabajás son ~34» es un diagnóstico
medido y cierto: las 26 de Activo quedan entre 1.089 de nutrición y 23 descartadas. El
arreglo —arrancar sólo con la banda de Activo, recordando lo que se apague— se aplicó, y se
revirtió el mismo día: *«tampoco hagas que al entrar al CRM esté desmarcado nutrición y
descartado, que estén siempre activos»*.

**El diagnóstico se queda; el remedio se va.** La fila no se marca como aplicada ni se borra
del plan: queda con lo que se probó y por qué volvió. Un relevamiento del que se borran los
intentos fallidos invita a repetirlos.

**Lo que lo explica, y sirve para cualquier «mostrar menos por defecto»:** ver de más cuesta
atención, y no ver algo que uno sabe que existe cuesta CONFIANZA en la herramienta. Lo
segundo es más caro, y no se nota en ninguna métrica de la pantalla — se nota cuando alguien
deja de usarla.

⚠️ **Y la persistencia era la mitad no pedida del problema.** Revertir sólo el default no
alcanzaba: con `localStorage`, apagar nutrición UNA vez dejaba cada entrada siguiente con
ella apagada, que es exactamente «al entrar está desmarcado» por otra puerta. Cuando se
revierte un «por defecto», hay que mirar si además quedó memoria de la elección.

**Vive en:** `app/crm/CrmBoard.tsx` (`KANBAN_BANDS`) · `docs/friccion-crm.md` §4 ·
*2026-09-27 aviso-un-renglon*

## Replicar una vista en otra pantalla: lo que se comparte y lo que se rompe

El 27/09/2026 el dueño pidió que `/admin` fuera «exactamente igual que la vista de
clientes que construimos, solo que con los botones extras». Lo que sigue es lo que
costó, y sobre todo lo que **no** se ve leyendo las dos pantallas en paralelo.

**Vive en:** `app/_components/TarjetaEntidad.tsx` · `app/customer-success/BarraClientes.tsx` · `app/admin/AdminView.tsx` · `app/_components/nav.ts`

### El diagnóstico obvio era el equivocado: no se comparte el CSS, se comparte la pieza

La salida barata es que la pantalla nueva importe la hoja de la vieja y arme su
propia composición. **«Exactamente igual» dura lo que dura la primera edición**: el
día que alguien mueva la bajada en una, la otra se queda vieja y nada avisa.

Lo que cambia entre las dos son sus DATOS —un cliente tiene tres números del
tablero, un workspace tiene su plan y su equipo—, y eso entra por slots (`pie`,
`chips`, `acciones`). La forma es una sola: `TarjetaEntidad`.

### `margin: 0 auto` sin `width: 100%` se encoge en un contenedor FLEX

`.bc` (la barra) declaraba `margin: 0 auto; max-width: 1180px` y nada más. En un
contenedor de BLOQUE —Customer Success— ocupa todo. En uno **flex en columna**
—`/admin`— los márgenes auto de un item absorben el espacio libre: medido, **419 px
de ancho, centrada, y con la mitad de los controles caídos a un segundo renglón**.

No se lee como una barra angosta: se lee como una barra rota. Y el mismo patrón
estaba en `.cl-grid`. Los dos llevan `width: 100%` ahora.

⚠️ **La regla que generaliza:** una pieza que se centra con `margin: 0 auto` da
resultados distintos según el `display` de su padre, y el padre no es suyo. Al
mudar una pieza a otra pantalla, eso es lo primero a mirar.

### La hoja tiene que viajar con lo que se monta

`CSS_CLIENTE` se definía en `ClienteCard.tsx` y lo inyectaba `ClientesApp`.
Montar la tarjeta en otra pantalla sin acordarse de concatenar esa constante la
dibuja **sin un solo estilo** — sin caja, sin banda, sin la fila de números. Es el
mismo modo de falla que el avatar de esa tarjeta ya había pagado una vez.

La cura no es documentarlo: es que el `<style>` lo ponga `GrillaTarjetas`, que es
lo que se monta. Lo que no se puede olvidar es lo que no hay que recordar.

### La tarjeta era un `<button>`, y «con los botones extras» no entra ahí

Un botón adentro de otro es HTML inválido, y el archivo lo tenía escrito como
decisión («la tarjeta ENTERA es el botón»). Para que `/admin` pueda poner
«Inspeccionar» y un menú encima, el botón pasó a ser una **capa que cubre la
tarjeta** (`position:absolute; inset:0; z-index:0`), con el contenido arriba en
`pointer-events: none` y sólo `.cl-acc` volviendo a aceptarlos. Se conserva que
toda la superficie abra, y los controles de verdad reciben su propio click.

El foco se dibuja con `:has(.cl-abrir:focus-visible)` sobre la tarjeta: lo que se
ve es el rectángulo, no la capa invisible.

### Una condición NEGATIVA en un `match` de la barra ya estaba vieja

El item «Clientes» de `nav.ts` matcheaba `starts('/admin')` **menos** guiones, ui,
docs, dev y agente. No excluía `/admin/friccion`, que existe desde el mismo día:
parado ahí se prendía la fila «Clientes» **y** el `<title>` decía «MaKo -
Clientes». Falla en dos superficies a la vez y no da error.

Es la regla de la casa sobre guards aplicada a un `match`: **va en positivo**. El
item ES `/admin`, esa ruta y ninguna más (`p === '/admin'`). Una ruta sin item
propio no prende ninguna fila y lee su nombre del fallback, que es lo correcto —
mejor el nombre de la sección que el de otra pantalla. Lo fija
`tests/notificaciones.test.ts`, probado rompiéndolo: con el match viejo, 19 pases
y 1 fallo.

### Un deep-link leído por un `useEffect` de montaje no es un link

`/admin?tab=copy` abría la tercera sub-tab, y estando ya en `/admin` una
navegación del router no remonta nada: te dejaba mirando Clientes. Se reportó dos
veces como «me redirige». Al mudar la tab a su ruta, el link viejo se resolvió con
un `redirect()` **del server**, que no depende de que nada se monte.

### Lo que un rediseño pierde sin que nada falle

Al cambiar la presentación de una pantalla con 28 capacidades, lo que se cae son
las **invisibles** — las que no se ven mirando la pantalla en su estado normal:

- Dos bloques que no se dibujan cuando están vacíos: las aprobaciones de agencia y
  los usuarios huérfanos.
- Una decisión escondida adentro de un item de `Dropdown`: «Convertir en agencia»,
  que es la mitad del modelo de agencia recién construido.
- El aviso de sesión legacy, que vivía **sólo** adentro de la sub-tab que se
  eliminaba y es lo único que le dice a alguien que está con la cookie vieja.

Se salvan enumerándolas ANTES, no mirando el resultado. Y al terminar, un `grep`
de cada pieza nueva contando sus call sites: `SeccionSuperAdmins` quedó declarada
y sin llamar, y el typecheck lo dio por bueno.

### Lo que quedó SIN hacer

- **`NombreClienteDialog` sigue siendo un modal a mano** (`position:fixed`,
  z-index 90) y **no se registra en `app/_components/pila-modales.ts`**. Hoy no
  molesta porque se abre desde la grilla; el día que se abra desde la ficha de un
  cliente, un Escape va a cerrar las dos.
- **`/api/admin/usuarios` calcula un `resumen`** (integraciones y perfil de negocio
  por workspace, un `integracionConectada` por servicio en cada carga de /admin) y
  **el cliente no lo lee**: el tipo `Respuesta` ni lo declara. Es trabajo de server
  que se tira en cada request.
- **El cerebro de copywriting escribe en `OWNER_WS`**, que vale 1 y es Mauricio, un
  cliente — lo de la plataforma va en `wsSuperAdmin()`. No se tocó en la mudanza
  porque cambiarlo MUEVE datos ya cargados, y eso es una decisión con su backfill.
- **`app/admin/copywriting/` no está en ningún `vive[]`** de `app/admin/dev/areas.ts`,
  así que su Change History nace vacío. `tests/dev-areas.test.ts` sólo comprueba que
  lo declarado exista: la omisión no la ve nadie.


## Tres implementaciones de la misma cabecera, y cómo se reconoce a tiempo

Cosechado el 28/09/2026, del pedido «el detail está mal, te había dicho que idéntico al
del plan, solo que con más opciones para administrar al usuario». Salió de un relevo de
5 lectores + 10 refutadores sobre las tres.

**Vive en:** `app/_components/CabeceraDetalle.tsx` · `app/_components/cabecera-detalle-geo.ts` · `app/plan/board/BoardShell.tsx` · `app/customer-success/FichaCliente.tsx` · `app/admin/FichaWorkspace.tsx`

### El síntoma no era el diseño: eran tres archivos

La cabecera de «el detalle de algo con nombre y cara» —portada a sangre, marca cruzándole
el borde de abajo, cerrar como círculo oscuro, pastillas al hover, nombre al lado de la
marca— estaba escrita **tres veces**: `pd-*` adentro de `BoardShell`, `fc-*` adentro de
`FichaCliente`, y nada en el panel de la plataforma, que era un `Modal` genérico de 720 px
titulado «Equipo».

**El tell, y es el que sirve para la próxima:** dos de las tres hojas tenían reglas **byte
a byte idénticas**. `.pd-pill` y `.fc-pill` eran la misma regla escrita dos veces, y
`.pd-acciones` y `.fc-acciones` también. Cuando dos archivos distintos tienen una regla
CSS carácter por carácter igual, no son dos piezas parecidas: es una pieza y una copia, y
la copia ya empezó a divergir en otra línea.

Lo que había divergido: la banda (124 contra 160), la marca (54 cuadrada con anillo de 3
contra 88 redonda con anillo de 4), el cerrar (propio en una, el de `Modal` reposicionado
por CSS en la otra) y el tinte de la fila (el plan la tiñe con el color, la ficha no).

La cura es la misma que `TarjetaEntidad` ya había aplicado a la TARJETA: un COMPONENTE, no
un CSS compartido. **La escala entra por prop y la anatomía no** — una ficha a 1560 px y un
detalle a 820 no llevan la misma banda, y eso está bien; lo que no puede diferir es dónde
está cada cosa.

### Un par de números acoplados sobrevive porque se prueba con UN solo tamaño

`top: 97px` y `padding-left: 86px` estaban cableados, con la cuenta explicada al lado:
«124 − 27» y «20 + 54 + 12». Son dos números que hay que mover JUNTOS —la marca se monta a
caballo del borde y la fila le deja su hueco—, y el síntoma de que se desincronicen no se
parece a un número viejo: es el título escrito **encima** de la marca.

Ahora se calculan (`geometriaCabecera`, en su propio módulo sin `server-only` para que el
test lo importe). Y la medición que explica por qué duró tanto: probando la sangría fija en
86 contra una marca de **54**, no falla ni uno de los tres casos que la persiguen. Es el
**corolario 3 de OWNER_WS aplicado a un píxel**: con un solo valor configurado no se puede
saber si el número sale del lugar correcto.

### Lo que una MUDANZA DE HOJA se lleva puesto en silencio

Al mover el CSS de un archivo a otro se perdió, sin que nada avisara:

```css
@media(prefers-reduced-motion:reduce){ .pd-acciones{ transition:none; } }
```

La hoja nueva quedó con `transition: opacity .12s` y sin su excepción, así que para quien
pide menos movimiento las pastillas volvieron a aparecer con fundido. **No da error, no
sale en ninguna captura y ningún test lo mira.** Lo encontró un refutador comparando las
dos hojas regla por regla.

⚠️ **La regla operativa: al mudar una hoja, la lista de lo que tiene que viajar incluye las
`@media` y las `:focus-visible`, que son las que nadie mira porque no se ven en el estado
normal.** Un `grep` de `prefers-reduced-motion` y de `focus-visible` sobre el origen y el
destino cuesta dos segundos y es lo único que lo caza.

### Un z-index cableado por debajo de la pila es un botón que no hace nada

`ConfirmDialog` declaraba `zIndex: 90` y los modales de la casa arrancan en `Z_BASE = 130`
(`app/_components/pila-modales.ts`). O sea que preguntar «¿borro a esta persona?» desde
adentro de cualquier modal dibujaba el diálogo **tapado**: la acción se ofrecía, el
click respondía, y en pantalla no pasaba nada. Lo mismo `NombreClienteDialog` de /admin.

Nadie lo reportó porque el camino es raro (abrir un cliente → el menú de un miembro →
Eliminar). Lo encontró el relevo comparando el literal `90` contra el `Z_BASE` del módulo.

**Cómo se busca:** `grep -rn "zIndex: [0-9]" --include=*.tsx app` y se compara cada número
contra `Z_BASE`. Todo lo que pueda abrirse desde adentro de un modal y tenga un z literal
por debajo de 130 es este bug. La cura no es subir el número —el próximo nivel lo vuelve a
tapar— sino registrarse en la pila con `useCapaModal(true, { anidada: true })`: `anidada`
además deja ver lo de abajo, que es lo correcto cuando hay que confirmar SOBRE algo.

### Dos trampas de los comentarios en JSX, y la segunda mordió escribiendo la primera

1. **`{/* … */}` adentro de un `{cond && ( … )}` no es un comentario: es un segundo hijo de
   la expresión**, y no compila. Es la hermana de la que AGENTS.md ya tiene («un `//` entre
   etiquetas es TEXTO»): lo que decide no es qué dice el comentario, es **dónde cae**.
2. **Un comentario de bloque no puede contener la secuencia que lo cierra**, ni siquiera
   como ejemplo. Escribiendo la explicación de (1) puse el cierre entre comillas invertidas
   para citarlo; el parser lo leyó como el cierre de verdad y el `}` siguiente quedó suelto.
   El error sale a 90 columnas de donde uno cree.

### Lo que quedó SIN hacer

- **`FichaCliente` sigue siendo la tercera implementación, y es a propósito.** Su cabecera
  vive adentro de `Modal` con cuatro reglas `:has()` que le matan el padding, tiene dos
  líneas editables (nombre y empresa), el link al CRM y el control de «Inspeccionar» — o
  sea que adoptar la pieza es reacomodar una pantalla que el dueño shapeó campo por campo
  durante dos días. Lo que la pieza ya le compra es que el tablero y la plataforma no
  puedan divergir entre sí; esta tercera queda anotada. Vive en
  `app/customer-success/FichaCliente.tsx`.
- **`.fc-cambiar` es CSS muerto** (cero call sites en JSX, 4 reglas + una `@media`), y dos
  comentarios de esa hoja describen números que ya no son los que la regla de al lado
  declara. Vive en `app/customer-success/FichaCliente.tsx`.
- **`onMako` es un prop OBLIGATORIO de `ProjectDetailModal` que el componente no usa**, y
  dos call sites se lo pasan. Vive en `app/plan/board/BoardShell.tsx`.
- **El cuerpo del detalle de un proyecto no se puede extraer** sin mover antes ~13
  funciones locales sin `export` (`Separador`, `MiniBar`, `BloquePrioridad`,
  `BloqueHistorial`, `CampoCliente`…). Por eso se extrajo sólo la CABECERA. Vive en
  `app/plan/board/BoardShell.tsx`.

## `max-height` no es un tamaño, y lo que cuelga adentro lo paga (29/09/2026)

Cosechado de «ya te había dicho que JAMÁS achiques el tamaño de un detail según lo que
contenga dentro» — la segunda vez que llega el mismo pedido, y la primera con una
captura del daño colateral.

**Vive en:** `app/_ui/Modal.tsx` · `app/_ui/ui.css` (`.mk-modal`) · `app/_components/BarraAcciones.tsx`

### El tope está bien para un diálogo y mal para una ficha

`.mk-modal` lleva `max-height: min(85vh, 720px)`, que es lo correcto para lo que el
componente nació siendo: una caja que pregunta algo en una frase no tiene por qué medir
720 px. Pero **una ficha con un tablero adentro cambia de contenido sin cambiar de
identidad**: cada vista del board trae lo suyo, y la de Equipo de un cliente sin gente
son dos renglones.

Medido antes: la misma ficha pasaba de 720 px en Prioridades a ~430 en Equipo. Todo lo de
abajo salta, y el borde inferior sube 290 px sin aviso.

**La regla que queda: si una caja contiene algo que cambia de tamaño por dentro sin dejar
de ser la misma pantalla, su alto es un NÚMERO, no un tope.** El tope se queda igual
encima, para que un alto mayor que la ventana no saque el pie de la vista.

### Y el borde que sube se lleva puesto lo que cuelga

El daño que el dueño mostró no era el salto: era que **el menú de los tres puntos se veía
cortado a la mitad**. La causa es otra y el alto sólo la disimulaba — medido después de
fijar el alto, **seguía cortándose 140 px en las dos vistas**.

`.mk-modal` lleva `overflow: hidden` para redondear sus esquinas, y el menú era un
`position:absolute; top:44; right:0` colgado de su botón, **adentro** del modal. Un
overflow que recorta no distingue un panel flotante de un párrafo largo.

⚠️ **Un panel anclado que pueda vivir adentro de un contenedor con `overflow` se portalea
al `body` y se ubica por cuenta**, nunca por un `top/right` fijo: ese par no se da vuelta
cuando no entra abajo ni se topa contra el borde de la ventana. La cuenta ya existía
(`ubicarPanel`, del selector de portada) y escribir una segunda habría sido la copia que
diverge.

⚠️ **Y el efecto que la ubica necesita al PANEL en sus dependencias.** Mientras el menú
está cerrado el panel no existe, así que la primera corrida encuentra la ref en `null` y
se va sin medir; sin `abierto` en las dependencias el efecto no vuelve a correr y el panel
queda en `left:0, top:0` — arriba a la izquierda de la pantalla, sin ningún error. Es el
mismo modo de falla que `PortadaPicker` ya tenía documentado y medido.

### Lo que quedó SIN hacer

- **La barra la montan tres pantallas** (`/plan`, la barra de Clientes y el panel de la
  plataforma) y el portal les cambia el z-index a todas. Se verificó en las tres, a dos
  anchos — pero no hay test que lo mire: los tres chequeos son de código, no de pantalla.

## Un control adentro de una capa escalada NO mide lo que declara (04/10/2026)

**Vive en:** `app/_components/Lienzo.tsx` (la zona del ＋ de la flecha)

El lienzo dibuja todo adentro de un `<div>` con `transform: scale(k)`, así que **cada
medida en píxeles que se escriba ahí adentro es `k` veces más chica en pantalla**. La
zona de hover del ＋ del medio de una flecha se declaró en 28 px —gorda a propósito,
porque un trazo de 1,6 px es imposible de apuntar— y medida en el navegador con el
lienzo al 22% daba **6 px**, con el ＋ adentro en 5. O sea inalcanzable: exactamente el
problema que el tamaño venía a resolver.

La cura es un `scale` inverso con el zoom que la pantalla ya muestra
(`scale(${100 / zoomTxt})`), que deja la zona y su botón del mismo tamaño a cualquier
zoom. `zoomTxt` sirve porque es ESTADO y lo escriben los tres caminos que cambian el
zoom (encuadrar, la rueda y los botones).

⚠️ **Y la misma trampa invalida la VERIFICACIÓN.** Para apuntarle al medio de una flecha
se calculó `getPointAtLength(L/2)` sumado al `getBoundingClientRect()` del `<svg>`: el
punto está en unidades de usuario y el rect ya tiene el `scale` aplicado, así que al 68%
el resultado caía **81 px abajo** del lugar real. El chequeo decía «el ＋ no aparece»
sobre un ＋ perfectamente vivo, dos corridas seguidas. **El centro se lee del DOM**
(`getBoundingClientRect()` de la zona), nunca se calcula del `<path>`.

## El lienzo se corre para hacerle lugar al panel, y al cerrarlo DEVUELVE la vista (04/10/2026)

**Vive en:** `lib/lienzo-grafo.ts` → `vistaConPanel` · `vistaAlCerrarPanel`

El panel de edición de un nodo está anclado abajo a la izquierda, así que un nodo de la
primera columna queda detrás y se escribiría a ciegas. Lo que se corre es el lienzo —no
el panel, que iría a tapar otra cosa— y eso ya estaba. Lo que se destapó al agrandar el
panel de 328 a 460 px: abrir el nodo del disparador corría el grafo **443 px** y la
tarjeta de al lado quedaba en x=1485 de una ventana de 1600, cortada por el borde. Y al
cerrar el panel **el lienzo no volvía**, porque reencuadrar solo está prohibido a
propósito (sin esa guarda, tocar un nodo deshace el paneo que la persona acaba de hacer).

⚠️ **Y LA SALIDA QUE PARECÍA LA BUENA ERA PEOR: achicar el grafo para que entren las dos
cosas.** Se escribió, con su test y su rotura. Medido, el lienzo de `/mensajes` tiene
~780 px —a la derecha de la lista de mensajes— así que con 484 de panel quedan ~300 y el
zoom caía al piso del lienzo, **40%**: tarjetas ilegibles, y encima ni así entraban.
Mientras se edita manda el panel, que es lo que se pidió.

Correr y DEVOLVER no pelea por el espacio, y no viola la regla del reencuadre: no se
elige una vista, se deshace la que eligió el código. Con dos condiciones:

- **El `antes` se guarda UNA vez.** Abrir un segundo nodo que necesite más corrimiento no
  puede pisarlo, o volver deja la vista del nodo anterior.
- **Y no se devuelve si la persona paneó o hizo zoom en el medio**: esa vista es suya.

⚠️ **El achique dejó un test CIEGO como recuerdo**, y vale la pena leerlo: afirmaba que
un `Math.min(v.k, …)` evitaba AGRANDAR el zoom, y borrando el clamp daba **0 fallos** —
la rama no se alcanzaba nunca. Era código muerto demostrable por aritmética. Lo que se
puede medir es la desigualdad, no el clamp.

### Lo que quedó SIN hacer

- **El ＋ de la TARJETA sigue midiéndose en unidades del grafo** (22 px, o sea 15 al 68% y
  5 al 22%). Al 68% —el zoom de un flujo normal— se clickea bien, y por eso no se tocó;
  si alguna pantalla monta el lienzo más chico, es el mismo arreglo de una línea.

## Un desplegable en COLUMNAS no dibuja el `sub`, y ahí vive el motivo (04/10/2026)

**Vive en:** `app/components/Dropdown.tsx` · `app/agencia/EditorMensaje.tsx`

`Dropdown` tiene dos modos y no se portan igual: en lista plana dibuja el subtítulo de
cada opción, y en columnas lo OMITE —con su porqué escrito: «el título del grupo ya da ese
contexto»—. Correcto para una lista de personas agrupadas por equipo, y falso cuando el
`sub` no es contexto sino **el dato** (un valor de ejemplo) o **el motivo** por el que la
opción está apagada.

Medido en el navegador con el catálogo de datos de un mensaje: la fila «Cuánto falta
cobrarle» salía gris, sin una palabra que dijera por qué no se podía elegir. Una opción
`disabled` sin su motivo es exactamente lo que esta casa llama un control que se lee como
roto. Va `subEnColumnas` (opt-in, así ningún otro call site cambia).

⚠️ **Y LA BÚSQUEDA NO ENCONTRABA LO QUE LA GENTE BUSCA.** Filtra por título y subtítulo, y
el token de la variable no está escrito en ninguno de los dos: buscar **«saldo»** en una
lista de 42 datos devolvía **cero**, porque la fila se llama «Cuánto falta cobrarle». Va un
campo `buscar` por opción (el token), y el `value` NO se mira: en una lista de personas o
de ids eso haría matchear números sueltos sin que nadie lo pida.

## Ofrecer apagado o no ofrecer: la pregunta no es la misma que «esconder el botón» (04/10/2026)

**Vive en:** `lib/variables-aviso.ts` → `variablesOfrecidas` · `PORQUE_NO_SE_PUEDE`

El selector de datos filtraba lo que ese mensaje no puede resolver, con una regla
correcta: ofrecer un valor que va a salir crudo al WhatsApp del cliente es prometer un
dato que no existe. Lo que la regla no contestaba es qué ve quien abre el menú. Medido: un
mensaje con disparador **por tiempo** —que son casi todos— ofrecía **9 datos de 42**, o sea
que el catálogo extenso que se pidió no existía para quien lo abría.

La casa tiene las dos reglas y parecen contradecirse: «esconder el botón no protege nada» y
«mostrarlo sin poder usarlo se lee como que la app está roto». Lo que las separa es si el
renglón dice **cómo se consigue**: apagado y con «sólo si el mensaje lo dispara una acción»
es información y una salida (cambiar el disparador), que es la misma forma de un guard que
bloquea sólo lo que se arregla haciendo lo que pide. Y un `disabled` del `Dropdown` no se
puede elegir, así que el token no puede entrar al texto.

## Lo que FLOTA sobre un lienzo son TRES cosas, y el encuadre es la cuarta (05/10/2026)

**Vive en:** `app/_components/Lienzo.tsx` → `insetIzq` · `app/automations/SimuladorWhatsApp.tsx`
→ `LISTA_ANCHO` / `LISTA_HUECO` · `app/automations/FlujoLienzo.tsx` · `app/automations/SecuenciaPerfil.tsx`

El pedido era que la lista de secuencias se apoyara ENCIMA del lienzo, con sombra y
bordes redondos, **y que la cuadrícula pasara por detrás** — o sea que el dibujo no se
corte donde empieza la lista. Eso descarta la salida obvia: un `padding` izquierdo del
lienzo vuelve a cortar la cuadrícula justo ahí. La lista va `position: absolute` con
`zIndex`, y el lienzo sigue de borde a borde.

**Lo que eso rompe es todo lo que el lienzo apoya en su propio borde izquierdo, y son
cuatro cosas, no una.** Aparecieron de a una, cada una con el mismo síntoma —un control
dibujado, a la vista, que no responde— y las tres primeras las encontró el ARNÉS, no el
código:

| Qué | Cómo falló | Lo que dijo el arnés |
|---|---|---|
| El `chrome` (título + Activar + Probar) | `left: 0` | `<input … placeholder="Buscar…"> intercepts pointer events`, 56 reintentos |
| El panel del nodo | `left: PANEL_MARGEN`, abajo a la izquierda | `<aside aria-label="Tus secuencias"> intercepts pointer events` |
| La fila del zoom + deshacer | `left: 12` | — (se corrigió con el chrome) |
| **El ENCUADRE** | centra el grafo sobre el ancho TOTAL | hover sobre la tarjeta de entrada: 55 reintentos |

El cuarto es el que más cuesta ver, porque no es un control: es que el nodo de más a la
izquierda del grafo **nace debajo de la lista**. `encuadrar` centraba sobre `w`; ahora
centra sobre el ancho ÚTIL (`w - insetIzq`) y el `tx` arranca después del inset. El
dibujo sigue entrando abajo —la cuadrícula es justo lo que se quería ver ahí— pero
ningún nodo cae en la zona tapada.

⚠️ **Y NINGUNO DE LOS CUATRO DA ERROR.** El elemento existe, es visible, está habilitado,
`getComputedStyle` lo da perfecto y el clic no llega nunca. En pantalla se lee como un
título que no se puede editar y una tarjeta que no se abre, o sea como que la app está
rota. Lo único que los vio fue arrastrar y clickear de verdad en un navegador.

La regla que queda: **al apoyar cualquier cosa sobre el borde de un lienzo, el inset va
en UNA constante y lo consumen los cuatro** (los tres slots flotantes y el encuadre).
Con dos números, el título vuelve a nacer debajo del buscador en cuanto alguien toque
uno — y la firma del encuadre lleva el inset adentro, o cambiarlo no reencuadra.

⚠️ **Y UN SLOT FLOTANTE NO SE PRUEBA CON `scrollY = 0` NI CON EL PANEL CERRADO.** El
panel del nodo sólo existe con un nodo seleccionado, así que una verificación que no abre
un nodo da verde sobre el control tapado. Es la misma familia que «un `sticky` roto se ve
igual que uno sano hasta que scrolleás».

## Una casilla que aparece con el hover se ANIMA con CSS, y el `&&` de React no puede (05/10/2026)

*«Copiá la animación de aparición del checkbox para la selección de múltiples tarjetas que
hizo el CRM. Es una animación que aparece detrás del título y que se desplaza el título
cuando paso el cursor.»* Las tarjetas del Plan (tarea y proyecto) ya mostraban la casilla
al pasar el cursor, pero con `{onElegir && (hover || haySeleccion) && <input>}` sobre un
`useState` de hover: **aparecía de golpe y el título saltaba**. No hay transición que
escribir ahí: un nodo que no existía no tiene de dónde animarse.

La cura es la regla del CRM (`.mk-sel-tarjeta` en `app/globals.css`, ancho 0 → 15 con
`margin-right: -8px` → 0 y opacidad), con la casilla SIEMPRE montada y la tarjeta como
`.mk-tarjeta-sel`. Es UNA regla para el CRM, Customer Success y el Plan: el selector de la
tarjeta lo commiteó la sesión de CS y este commit le sumó `[data-seleccionando='1']`,
porque en el Plan con algo elegido se ven TODAS (así se agrega la segunda sin apuntarle a
una casilla invisible). Lo fija `tests/plan-casilla-tarjeta.test.ts`.

⚠️ **Las dos cosas del inline que la rompen sin error**: un `width` en el `style` de la
casilla le gana a la clase (queda siempre ancha, con la opacidad animando: se ve arreglado
sin estarlo), y un `margin` —aunque sea `'3px 0 0'` para alinearla con el título— **borra
el `margin-right: -8px`** que cancela el `gap` de la fila. El alineo vertical va como
`marginTop` suelto. Y la fila tiene que tener `gap: 8`, que es lo que ese `-8` cancela.

### Dos trampas de la MEDICIÓN, que costaron más que el cambio

Medido en la app real con Playwright, la casilla «no se abría con el hover». No era el
código:

1. **El «reposo» del mouse en (5, 5) cae sobre la barra lateral, y la barra se DESPLIEGA
   con el hover** y tapa la primera columna del tablero. Después, el mouse que «iba a la
   tarjeta» en x = 229 estaba encima del menú desplegado (`elementFromPoint` devolvía el
   div con «General Plan CRM Ads Manager…»). El reposo va en una esquina vacía, lejos de la
   barra.
2. **El scroll del tablero es SUAVE**: leer la posición 300 ms después de `scrollIntoView`
   da una tarjeta que todavía se mueve. Con 900 ms se estabiliza.

Y `locator.hover()` de Playwright se colgaba 30 s esperando «estabilidad» por lo mismo:
con mouse por coordenadas y las dos esperas, Chromium y WebKit dieron idéntico — reposo
0 px de casilla y el título sin sangría; hover +23 px.

**Vive en:** app/plan/board/BoardShell.tsx · app/globals.css · tests/plan-casilla-tarjeta.test.ts · *2026-10-05*

## eslint-plugin-react-hooks 7: un `eslint-disable` de react-hooks apaga el compilador para TODO el componente (08/10/2026)

**Síntoma:** en el rediseño de /chatbot, al sacar un `eslint-disable-next-line
react-hooks/exhaustive-deps` de `app/automations/SimuladorWhatsApp.tsx`, eslint marcó como ERROR
(`react-hooks/set-state-in-effect`) un `useEffect(() => setSelId(...))` que existía sin cambios desde
antes y nunca había fallado. Y el patrón de la casa para montar un portal, `useEffect(() => {
setMontado(true); }, [])`, hoy es un error: `app/_components/IdentidadPicker.tsx:84` ya lo tiene, y
`app/crm/EtapasModal.tsx:142` cae por otra forma de lo mismo.

**Causa:** `eslint-config-next` 16 trae `eslint-plugin-react-hooks` 7.0.1, que corre las reglas del
React Compiler (`set-state-in-effect`, `refs`, `purity`), y el compilador SALTEA el componente entero
si tiene una supresión de una regla de hooks. Un solo disable apagaba el análisis de todo
`SimuladorWhatsApp`: al sacarlo aparecen errores en líneas que nadie tocó. No frena ningún push: el
pre-push corre sólo `rules-of-hooks` (`scripts/hooks-en-orden.sh`).

**Regla:**

- **Un `eslint-disable` de react-hooks no silencia una línea: silencia el compilador para TODO el
  componente.** Antes de sacarlo, o de poner uno, se corre eslint del archivo.
  `app/automations/PanelProbar.tsx` conserva uno a propósito (el efecto de montaje): ese componente no lo
  analiza el compilador.
- **Corregir el estado en un efecto se reemplaza por CALCULARLO**:
  `const selId = elegida === '' ? primera : elegida`. Si lo hallado depende de una clave, se guarda
  junto con su clave (`{ id, e }`) y se DERIVA (`hallada.id === id`) en vez de resetear al principio
  del efecto (`useEtiquetaFuera`, `app/_components/etiquetas-cliente.tsx`).
- **«¿Ya está montado?»** va con `useSyncExternalStore(() => () => {}, () => true, () => false)`, no
  con un `setMontado` en un efecto (`PopoverWA`, `app/whatsapp/_shared/ComposerWhatsApp.tsx`).
- **La posición de un popover** se escribe en el NODO desde un `useLayoutEffect`, no en un estado.
- **«¿Qué cambió desde el render anterior?»**, o un pedido que llega de afuera, va con el patrón de
  ajustar el estado DURANTE el render (un `setState` condicional contra el valor previo); nunca
  leyendo un ref en el render (`react-hooks/refs`). Molde: la prop `abrir` de
  `app/automations/SimuladorWhatsApp.tsx`, y la animación de `app/whatsapp/_shared/ChatHilo.tsx`.
- **`useEffect(() => { void cargar(); }, [cargar])` con un `cargar` que hace `setState` después de un
  `await` también cae**: el compilador no ve el await. Se inlinea el fetch y el `setState` va en el
  `.then`.
- Y `const ahora = Date.now()` en el cuerpo de un componente es `react-hooks/purity` (ya anotado en
  [hallazgos-customer-success.md](hallazgos-customer-success.md)).

**Vive en:** `app/automations/SimuladorWhatsApp.tsx` · `app/automations/PanelProbar.tsx` ·
`app/whatsapp/_shared/ComposerWhatsApp.tsx` · `app/whatsapp/_shared/ChatHilo.tsx` ·
`app/_components/etiquetas-cliente.tsx` · `app/_components/IdentidadPicker.tsx` ·
`app/crm/EtapasModal.tsx` · *2026-10-08 rediseño de /chatbot (partes P, C y E de `wf_8096a9d7-b3f`)*

## Una preferencia de vista guardada por workspace la pisa quien mira con `?ws=` (10/10/2026)

Para el selector de gráficos, guardar la selección en `app_settings` del workspace parece alcanzar
porque hay un usuario por workspace. Pero el super admin abre cada cliente con `?ws=N` y la agencia
ws13 mira a ws15 y ws17 (`lib/workspace.ts:193-224`): fijar un gráfico mientras se mira la cuenta
de otro le cambia la vista a ese cliente. Una preferencia de vista va por **usuario + workspace**,
o no se escribe mientras se mira la cuenta de otro.

**Vive en:** `lib/workspace.ts:193-224` · `app/_components/TendenciasSection.tsx:38` (hoy la
selección vive en `useState`). *Corrida `wf_01c22b1b-91a`, 10/10/2026.*

## Un observador que reescribe lo que observa compara contra lo que el navegador DEVUELVE (12/10/2026)

Pedido de Martín del 12/10 (punto 2 del feedback del CRM): «Todos las tabs tienen su nombre al lado de "MaKo", también
debe tenerlo la de CRM». /crm es la única ruta con `loading.tsx`, y la hipótesis del frente que lo arregló es que ahí el
router cambia la ruta con el ESQUELETO —el efecto de `TituloTab` escribe «MaKo - CRM»— y el `<title>` del layout
(«MaKo») llega después, en streaming, cuando el `requestAnimationFrame` que lo reafirmaba ya pasó. El arreglo fue un
`MutationObserver` sobre el `<head>` que devuelve el título cada vez que alguien lo pisa.

- ⚠️ **Y ese observador entraba en un bucle infinito** (lo cazó la segunda revisión). El getter de `document.title` saca
  los espacios de las puntas y colapsa los repetidos, así que con un título que los tiene, `document.title !== titulo`
  da true SIEMPRE: se escribe, la escritura cambia el `<title>` (un `childList` del `<head>` observado), el callback
  vuelve a escribir, y así sin fin, en microtareas encadenadas: la pestaña se congela en vez de mostrar el 404. Lo
  dispara una ruta inexistente cuyo primer segmento termina en «-» o tiene «--» (`/reportes-` daba «MaKo - Reportes »,
  `/a--b` daba «MaKo - A  b»), o sea un link roto o un typo; ningún label de `nav.ts` lo produce. El
  `requestAnimationFrame` de antes reafirmaba UNA vez, y por eso antes no había bucle. Ahora `conMarca`
  (lib/titulo-tab.ts) devuelve el título como lo va a devolver `document.title`.
- **Regla:** un observador que escribe sobre lo que observa compara contra la forma que el navegador DEVUELVE al leer, no
  contra el string que escribió. `document.title` normaliza espacios, el `value` de un `<textarea>` normaliza los saltos
  de línea, un atributo `style` se reserializa: sobre una escritura que el navegador normaliza, «si no es igual, escribo»
  no compara igual nunca, y es un bucle.

**SIN HACER:** la causa del título de /crm (el `<title>` del layout que llega en streaming detrás de `loading.tsx`) es
una hipótesis y no se midió en un navegador. Si algún día se quiere sacar el observador, se mide primero.

**Vive en:** `app/_components/TituloTab.tsx` · `lib/titulo-tab.ts` (`conMarca`, `tituloDe`) · `app/crm/loading.tsx` ·
*2026-10-12 corrida crm-feedback-12-10 (frente B y segunda revisión)*

## Un control que parte un dato en dos no puede avisar las dos mitades en el mismo evento (12/10/2026)

Pedido de Martín del 12/10 (punto 5 del feedback del CRM): el teléfono con el país primero, con banderas
(`TelefonoConPais`), en el alta del CRM, la ficha, `StageMoveDialog`, `GrupoDetalleModal`, `TelefonosPanel`,
`InvitarAlumnos`, `NuevoCliente`, `PerfilTabs`, `OnboardingChatAgent` y `ReunionTareas`.

- ⚠️ **Un número PEGADO con su «+código» quedaba con DOS códigos** (segunda revisión). El campo borraba el `+` y dejaba
  los dígitos del país adentro del número: con México elegido por default (`DIAL_DEFAULT`), pegar «+54 9 11 2233-4455»
  copiado de WhatsApp guardaba `525491122334455`. Varios de esos montajes eran de texto libre y su ejemplo enseñaba a
  poner la lada («+54 9 …», «52 55 1234 5678», «ej. 5215512345678»), así que es justo lo que la gente pega. El dedupe por
  los últimos 10 dígitos lo sigue encontrando, y lo que falla es el envío: el WhatsApp al lead, el «No se pudo agregar»
  de Evolution en un grupo, el código de verificación del onboarding del Chat Agent que no llega, el WhatsApp de las
  tareas de una reunión. Ahora `numeroTecleado` (lib/paises.ts): si el texto arranca con `+` y se reconoce una lada, la
  lada va al selector y el resto queda como número; mientras el código todavía no se reconoce («+5»), el `+` se queda en
  el campo sin decidir nada.
- ⚠️ **Y la cura obvia —llamar `onLada` y `onNumero` seguidos— pisaba la lada nueva con la vieja.** Cuatro montajes
  guardan lada y número en UN objeto con un spread sobre el estado del render (`setDraft({ ...draft, lada: v })` en
  `TelefonosPanel`; también `InvitarAlumnos`, `PerfilTabs` y `ReunionTareas`): la segunda llamada parte del mismo `draft`
  que la primera y vuelve a escribir la lada de antes. Por eso la lada va primero y el número espera en un ref hasta que
  la lada nueva vuelve por props, y sale con el `onNumero` de ESE render. **Regla:** una pieza compartida que emite dos
  callbacks por un solo gesto no puede suponer que el padre los funde con `setX(prev => …)`: o emite uno con las dos
  mitades, o los encadena por props.
- Es la misma familia que «partir un valor guardado y volver a unirlo NO es neutro», del lado de la entrada:
  `splitTelefono` cae a la lada por defecto con TODOS los dígitos cuando ninguna coincide, y eso es lo que reescribía el
  teléfono de la ficha con sólo abrirlo y cerrarlo. El caso y la regla («se compara contra la partición con la que se
  abrió») están en [hallazgos-crm.md](hallazgos-crm.md) → «La revisión de lo invisible del feedback del 12/10».

**Vive en:** `app/_components/TelefonoConPais.tsx` · `lib/paises.ts` (`numeroTecleado`, `splitTelefono`,
`unirTelefono`) · `tests/crm-tablero-alta-12-10.test.ts` · *2026-10-12 corrida crm-feedback-12-10 (frente B y segunda
revisión)*

## Un clic en OPERATE llevaba a General: el aire de un link es zona de clic (12/10/2026)

**Síntoma** (Martín, la prueba con Fiesta Music): «cuando alguien da clic en Operate... se lo lleva a General».
⚠️ **El diagnóstico obvio era el equivocado.** El botón de la familia no navega: el clic nunca le llegaba. Lo recibía el
LINK DE LA MARCA, que está arriba.

- **El padding es zona de clic.** `Marca` tenía `padding: '2px 6px 20px'` y, como hijo de una columna flex, se estiraba a
  todo el ancho (`align-items: stretch` por defecto). Los 20 px entre el logo y el rótulo OPERATE, en todo el ancho de la
  barra, eran un link a /general.
- **La barra saltaba mientras se abre.** `.mk-seccion` iba sin `nowrap`. Durante los 200 ms de la animación, un rótulo de
  dos palabras («Customer Success», «Sales Machine») baja de renglón y todo salta 16 a 32 px: el clic que iba a un rótulo
  cae en otra cosa.

**La regla:**
- El aire que separa un link de lo que tiene abajo es MARGEN, no padding.
- Un link dentro de una columna flex lleva `alignSelf`, o mide lo que mide la columna.
- Los rótulos de una barra que anima su ancho llevan `whiteSpace: 'nowrap'`.

El arreglo no cambia nada visible (padding 2 + `marginBottom: 18` = los 20 de antes) y no bloquea clics durante la
animación. `BarraPreview` (/admin/ui) lo hereda.

**Vive en:** `app/_components/Sidebar.tsx` (`Marca`, `Familia`) · `tests/barra-clic-operate.test.ts` (renderiza los
reales con `renderToStaticMarkup`; con el padding de 20, 1 fallo; sin el `nowrap`, 1 fallo).

## Un `position: fixed` adentro de una capa con `z-index` es un fixed atrapado (12/10/2026)

El aviso «Enviado · revisa tu WhatsApp» de Probar (Automations) existía desde la décima, y Martín lo reportó como que
faltaba. El `Toast` es `position: fixed; z-index: 600`, pero vivía DENTRO del muelle de Probar (`position` + `zIndex: 3`).
Un z-index sólo compite dentro de su contexto de apilamiento: quedaba debajo de la barra de MaKo (z 4) y de Publicar
(57). `getComputedStyle` lo da perfecto y no hay ningún error.

**La regla:** un aviso lo dibuja quien sigue montado, fuera de cualquier ancestro con `position` + `z-index`. Y un aviso
de algo que YA pasó (salió un mensaje) no se ata a la vida del panel que lo pidió. Ojo también con el tope: `useToast`
corta en 3,2 s sin `onUndo` (`Math.min(ms, 3200)`).

**Vive en:** `app/automations/SimuladorWhatsApp.tsx` (el `<Toast>` en la raíz) · `app/automations/PanelProbar.tsx`
(`onEnviado`) · `app/_ui/Toast.tsx`. El resto, en [hallazgos-chatbot.md](hallazgos-chatbot.md) → «Duodécima tanda».

## Un campo que se mide en su primer efecto adentro de un Modal mide CERO (12/10/2026)

La barra «Pídeselo a MaKo» del modal «Nueva automatización» (Automations) salía sin placeholder y con la barra de scroll, y
Martín lo leyó como «no aparece más la animación». La animación andaba. El campo se medía solo (`height = scrollHeight` en
un `useEffect` que corre cuando cambia el texto), y la pila de modales pinta un `Modal` con `display: none` en su PRIMER
render: `decidirVisible` da false hasta que el efecto de `useCapaModal` lo mete en la pila, y el efecto del hijo corre
ANTES que el del padre. Medía 0, ponía `height: 0px` y no volvía a medir. Sin un error, y con `getComputedStyle` coherente.

**La regla:** lo que se mide solo adentro de un Modal no confía en la medida del primer efecto. O mide con un `minHeight`
que lo sostenga (la barra de WhatsApp, `ComposerWhatsApp`, mide con el borde y tiene `minHeight: 40`), o vuelve a medir
cuando el nodo pasa a ser visible (un `ResizeObserver`). Y `height = scrollHeight` con `box-sizing: border-box` desborda
siempre el borde: se suma `offsetHeight - clientHeight`.

**Vive en:** `app/_components/pila-modales.ts` (`decidirVisible`) · `app/_ui/Modal.tsx` ·
`app/whatsapp/_shared/ComposerWhatsApp.tsx`. El resto, en [hallazgos-chatbot.md](hallazgos-chatbot.md) → «Decimotercera
tanda».

---

## Un `Dropdown` adentro de un popover que se cierra con el clic de afuera: la lista va ADENTRO del popover (14/10/2026)

**Síntoma (anticipado, no medido en el navegador):** el selector de fuente del curso pasó a ser el `Dropdown` de la casa
(«que sea uno como cualquier otro», Martín), y vive adentro del menú de la marca del curso (`MenuMarca`,
`app/_cursos/CursoUgc.tsx`). Ese menú se cierra con cualquier `mousedown` FUERA de su caja (escuchado en `document`, en
captura) y cuando el foco se va a otro lado. El `Dropdown` monta su lista en un portal a `document.body`: el primer clic en
una opción es un `mousedown` fuera del menú, el menú se desmonta con el desplegable adentro, y la opción no se elige. No
da error: se lee como un clic que no registró.

**La regla:** un `Dropdown` dentro de una capa que se cierra por «clic afuera» o por «foco afuera» recibe `portalTo` con el
elemento de esa capa. La lista sigue siendo `position: fixed` (el popover no tiene `transform`, así que su `overflow` no la
recorta) y los dos chequeos de «afuera» la cuentan como adentro. Molde: `SelectorFuente`
(`app/_cursos/SelectorFuente.tsx`), que busca la capa con `closest('.ugc-menu')` en un ref de callback.

**Y lo que el `Dropdown` ganó para eso: `fuente` en cada opción** (la letra del título del renglón, como el selector de Google
Docs), con `data-fuente` en el renglón para que quien carga las hojas de esas letras encuentre lo que se dibuja. Es opcional:
las pantallas que no la pasan quedan exactamente igual.

**Sin medir:** el Escape. El menú de la marca escucha el Escape en captura y se cierra entero, así que con la lista abierta
un Escape cierra las dos cosas en vez de sólo la lista.

**Vive en:** `app/components/Dropdown.tsx` (`fuente`, `portalTo`) · `app/_cursos/SelectorFuente.tsx` · `app/_cursos/CursoUgc.tsx`
(`MenuMarca`) · *2026-10-14 Customer Success*

---

## El clic derecho de la casa: `MenuContextual`, y las guardas que lo dejan convivir con la ficha (14/10/2026)

Nació para el tablero del CRM («implementa el click derecho en todo el CRM», Martín, 14/10) y es GENÉRICO: qué
opciones salen lo decide cada pantalla con una función pura con test (en el CRM, `opcionesCrm`). La pieza resuelve
sólo cómo se abre en el punto del cursor, cómo se ubica sin salirse de la ventana, el teclado y el cierre (clic
afuera, rueda, resize, perder la ventana). Lo que costó está en sus guardas.

**Un menú fuera de la pila de modales es «nada encima», y su Escape cerraba también la ficha.** La ficha del lead
cierra con Escape sólo si `profundidadModales()` da 0. El `MenuFlotante` de `app/_components/Lienzo.tsx`, uno de los
moldes, no se registra en la pila, y ése es el defecto que no se copió. `MenuContextual` entra como capa anidada
(`useCapaModal(true, { anidada: true })`): no esconde lo de abajo, pero cuenta como algo encima. Su Escape va en
captura sobre `document`, contesta sólo si es la capa de arriba (`esElDeArriba`) y frena con
`stopImmediatePropagation`, por lo que explica «Dos `Modal` apilados se cerraban los DOS con un solo Escape», más
arriba.

**En la pila, el primer render mide 0×0.** Es la trampa de «Un campo que se mide en su primer efecto adentro de un
Modal mide CERO», más arriba, en un menú: `idx` es -1 y `visible` da false hasta el efecto de la pila. Un menú
ubicado con tamaño cero se pinta un instante afuera de la ventana. Se espera al `ResizeObserver` con el tamaño real
(`if (!r.width && !r.height) return;`) y va con opacidad 0 hasta ubicarse.

**Un clic derecho afuera NO cierra en el `pointerdown`.** Lo resuelve su `contextmenu`: cierra éste y la pantalla
abre el del lugar nuevo en el mismo gesto. Cerrando en el `pointerdown`, el `contextmenu` llegaba a una pantalla a
medio redibujar.

**La raíz que escucha el clic derecho recibe también los de la ficha y los modales.** En el CRM, un clic derecho en
la ficha del lead, en un desplegable o en un modal abría el menú del tablero. Los eventos de React suben por el árbol
de React, no por el DOM: `LeadEditModal`, los `Dropdown` y los `Modal` viven adentro del `<main>` del tablero aunque
se dibujen en el `<body>` (la misma trampa del `createPortal` de [hallazgos-crm.md](hallazgos-crm.md) → «Un
modal dentro de otro: el Escape ya tenía guarda, el CLICK no»). La regla: todo `onContextMenu` en una raíz arranca con
`e.defaultPrevented || t.closest('[role="dialog"], [role="menu"], [role="listbox"]')`, y quien quiera su propio clic
derecho adentro llama a `e.preventDefault()`.

⚠️ **El diagnóstico obvio no alcanzaba: `closest('[role=dialog]')` no cubre el fondo oscuro de un `Modal`.** El
`role="dialog"` está en la caja (`.mk-modal`), no en `.mk-modal__fondo` (`app/_ui/Modal.tsx:207`): un clic derecho en
el fondo de cualquier modal abría el menú del tablero encima. Lo que cubre todo es
`document.querySelector('[aria-modal="true"]')`, que ya ponen Modal, WizardShell, Confirm y LeadSheet. Contar la pila
(`profundidadModales() > 0`) no sirve, porque mientras se resuelve el segundo clic derecho el propio menú está en la
pila.

**Un renglón rojo se verifica en el `style` de su `<button>`.** El tacho de la casa (`IconoMenu nombre='borrar'`) se
pinta rojo solo, así que un test que busca `color:var(--bad)` cerca de «Eliminar» daba verde con el rótulo en negro.
Salió a la luz rompiéndolo.

**Vive en:** `app/_ui/MenuContextual.tsx` · `app/_components/pila-modales.ts` · `app/crm/CrmBoard.tsx`
(`alClicDerecho`, el ejemplo de las guardas) · `app/_ui/Modal.tsx` · `tests/crm-menu-contextual.test.ts`

### Lo que quedó sin hacer

- Los estilos con `:hover`/`:focus` van en un `<style>` propio (`ESTILOS`, en `app/_ui/MenuContextual.tsx`), y
  `app/_ui/LEEME.md` (regla de crecimiento 3) los pide en `app/_ui/ui.css`. Mudarlos es una línea.
- La pieza no está en el barrel `app/_ui/index.ts` ni en el catálogo `/admin/ui` (LEEME, regla 5).
- `app/_ui/iconos-menu.tsx` no tiene flechas izquierda/derecha. El menú usa `FlechaIzquierdaIcon`/`FlechaDerechaIcon`
  de `app/crm/iconos`.
- Un clic IZQUIERDO afuera cierra en el `pointerdown` y el clic sigue de largo: si cae en una tarjeta, abre la ficha.
  El menú nativo de Chrome, en cambio, se lo traga. No se decidió cuál se quiere.
- Sin ver en un navegador: el segundo clic derecho con el menú abierto, el Escape con la ficha abierta y el submenú
  recorrido en diagonal con el mouse.


## El mazo de la Ticketera: «los botones se superponen con la card» (14/10/2026)

**Vive en:** `app/tickets/decisiones/Mazo.tsx` · `app/tickets/decisiones/mazo.css`

Martín, con una captura del teléfono: «mira como los botones se superponen con la card… quiero un buen
diseño». **El diagnóstico obvio —la franja del pulgar está mal puesta— era el equivocado.** Los tres
controles estaban en su fila, afuera de la pila, con su `gap` de 12 px. Lo que se metía debajo era la
tarjeta de ATRÁS.

La cuenta, que es lo que no se ve leyendo: la carta de atrás se dibuja con `position: absolute; inset: 0`
(o sea, la caja entera de la pila), escalada a 0,94 y bajada 14 px para que asome. Y tenía
`transform-origin: 50% 110%` —el origen FUERA de su propia caja, 10% por debajo del borde inferior—. Con
ese origen, escalar NO achica alrededor del centro: mueve los bordes. El borde de abajo de una caja de
alto `h` va a parar a `1,1h + 0,94 × (h − 1,1h) = 1,006h`, o sea **0,6 % de `h` por DEBAJO de la pila**
(≈ 7 px con la tarjeta del teléfono), más los 14 px del desplazamiento: **21 px afuera contra 12 px de
gap**. Se mete 9 px detrás de los botones, y como la tarjeta de adelante es opaca y tapa casi todo, lo
único que se ve es un borde gris redondeado asomando por detrás del ✕.

- **Una pieza escalada con el `transform-origin` fuera de su caja se sale de su contenedor.** El origen
  queda en el centro y la de atrás asoma por ARRIBA (desplazamiento NEGATIVO), que es el único lado donde
  no hay nada que tapar. Lo fija `tests/tickets-decisiones-mazo.test.ts` (rotura: devolver el +14 → 15
  pases, 1 fallo; devolver el `transform-origin` al CSS → ídem).
- **Y la franja del pulgar es opaca y va encima** (`z-index: 5` + `background: var(--bg)`): es la red para
  todo lo demás que se mueva ahí adentro —el resorte del arrastre, una tarjeta más alta de lo previsto—,
  no el arreglo.

### «Arrastré sin querer una tarjeta y ya no tengo forma de volver»

El mazo tenía deshacer desde el primer día y sólo adentro del aviso de «Respondida», que dura 4,5 s. O sea
que no cubría ninguno de los dos casos en que hace falta: una tarjeta que se fue de un gesto sin querer
(ésa salía como «Después» y **no dejaba aviso**) y una que se contestó y el aviso ya se fue.

- **«Volver» vive en la cabecera y SIEMPRE**, apagado cuando no hay nada que traer; nunca escondido. Un
  control que aparece sólo cuando ya pasó lo malo es un control que se descubre tarde.
- **Y deshacer ESCRIBE en la base** (`deshacerDecision` → `deshacerRespuesta`, que vuelve a poner
  `respuesta`, `respuesta_texto` y `respondida_at` en null): la regla de la casa dice que si el cambio ya
  se guardó, revertir sólo la pantalla miente hasta el próximo F5 — y acá es peor, porque el chat que
  preguntó se llevaría una respuesta que Martín ya deshizo. Si el chat YA la había recogido
  (`recogida_at`), el aviso lo dice: deshacer acá no desanda lo que el chat hizo con ella.
- La que vuelve ENTRA por donde salió (misma dirección, al revés), que es cómo se entiende qué se deshizo
  sin leer nada.

## Las tabs de super admin: 13 en Admin y 55 renglones en Dev (15/10/2026)

**Pedido.** Martín: «me molesta bastante tener tantas tabs desorganizadas en super admin... Hay muchas que las
podríamos eliminar y otras que podrían ser una sola... Revisa eso.» Se midió una fila por tab de
`ADMIN_FAMILIAS` (último commit de su carpeta en main, commits en 30 días, y lo que dice la base). Los
veredictos están en `docs/prototipos/centro-operaciones.html`, al pie; nada se movió ni se borró: espera
la validación de Martín.

**Lo que la medición dio y no se ve desde la barra:**

- **Dos tabs se separaron por una limitación del nav, no por ser dos preguntas.** /mensajes salió de
  /agencia porque el `match` de un item recibe sólo el pathname (lo dice el comentario de
  `app/mensajes/page.tsx`). Para eso la casa ya tiene la tab en `?tab=` leída en el server (molde:
  `app/admin/ui`); juntas contestan «qué me dice MaKo por WhatsApp y por qué línea».
- ⚠️ **«Un Mensaje de MaKo ES una automatización» NO vació /mensajes.** El 11/10 se mudaron sólo los tres
  avisos del cliente (`AVISOS_DEL_CLIENTE` quedó vacía, `lib/avisos-catalogo.ts`); los ~45 de la agencia
  siguen saliendo del store que edita /mensajes. Último guardado: 06/10. Leer la regla como «/mensajes ya
  no se usa» es el diagnóstico obvio, y es el equivocado.
- **Contexto de MaKo tiene DOS editores de prompts**: la pestaña Prompts (`/api/mako/prompts`) y
  Configuración, que monta `Configuraciones` (`/api/mako/config-prompts`).
- **Copywriting y Contexto muestran las mismas filas.** Copywriting escribe en `mako_knowledge` (curso
  «Copywriting & Psicología (MaKo)», área `mensajes`), la tabla que lista Conocimiento. Sus 14 fichas son
  del 31/07 y nunca se editaron; el swipe tiene 0 ejemplos. Y escribe en `OWNER_WS`, o sea en el ws1, que
  es un cliente (ver AGENTS.md).
- **Agente de los clientes: `agente_sesiones` tiene 0 filas, nunca** (medido el 15/10). La tab dibuja ese
  vacío desde el 28/08. No es la misma pregunta que Contexto y Modelos IA, como se sospechaba: mira a los
  clientes, no cómo piensa MaKo.
- **Grafo sirve una foto del 10/07**: en producción no hay `graphify-out` (está en .gitignore) y la ruta
  cae al `graph.html` commiteado ese día. Ver hallazgos-onboarding.md → «El grafo que existe es el del
  código fuente».
- **Dev y Áreas del producto son el mismo destino** (`/admin/dev`), y los Registros son 51 entradas en un
  desplegable que repite, una por una, las filas de Áreas.

**Regla.** Antes de proponer fundir dos tabs se escribe qué PREGUNTA contesta cada una; si es la misma y
se partieron por una limitación técnica, se juntan con `?tab=`. Y «cuándo se usó» no sale del git log: eso
dice cuándo se tocó el código. El uso está en la base, y se mide.

**Vive en:** `app/_components/nav.ts` (`ADMIN_FAMILIAS`) · `app/mensajes/page.tsx` ·
`app/contexto/ContextoTabs.tsx` · `app/admin/copywriting/` · `lib/copywriting-metodo.ts` ·
`app/admin/agente/` · `app/api/admin/graph/`

## «Tu cuenta» y «Configuración del negocio»: lo que no se ve en el código (15/10/2026)

Pedido de Martín: rediseñar Perfil, Integraciones y Configuraciones «como lo hace google», con la Seguridad
«copia tal cual» de la de Google. Aprobó dos lugares (lo de la persona, lo del negocio). La lista de secciones vive
en `lib/ajustes-secciones.ts` (la usan la computadora y el celular) y el molde en `app/_ui/Ajustes.tsx`.

- ⚠️ **El menú le ofrecía «Perfil» a closers y setters y la página los echaba.** El ítem tenía `rolesWs: ['closer',
  'setter']` y `/perfil` llamaba `requireRolWs([])`, que quiere decir «sólo admin»: el closer tocaba su perfil y
  aterrizaba en su casa, sin un error. No lo vio nadie porque quien prueba es admin. **Regla:** el `rolesWs` del ítem
  y el guard de su página dicen lo mismo; el test de las páginas lo fija.
- ⚠️ **La pantalla y su acción no preguntaban por el mismo «admin».** Horario y Criterio de reuniones se mostraban si
  `/api/auth/me` decía `rol === 'admin'` (el de la PLATAFORMA), y sus acciones aceptan `rol_ws === 'admin'` (el del
  negocio). Al cliente se le escondía algo que sí podía cambiar. Se conservó lo que se VE hasta que Martín decida.
  **Regla:** un control que se esconde por rol usa el MISMO rol que su acción.
- **Integraciones no se mudó a `?tab=`, y era lo correcto.** El plan decía secciones por `?tab=`. Mudar Integraciones
  arrastraba 1.800 líneas y su `maxDuration = 300` (el `after()` de una action vive en el techo de la PÁGINA que la
  llama, hallazgos-infra.md). Cada sección es su ruta, como en Google: un link copiado abre lo mismo y ninguna ruta
  vieja necesita redirigir.
- **El `?tab=notif` de los 49 avisos se decide ANTES que la entrada por defecto.** Sin General (todo cliente), la
  entrada es la primera sección que se ve: Equipo. Si el redirect por defecto va primero, «apagar este reporte» cae
  en Equipo.
- **Embeber una pantalla entera en otra da dos `<main>` y dos títulos.** `IntegracionesBoard` y `MetodoWizard`
  traen los suyos; con `embebido` la raíz pasa a `div` y el título lo pone el molde.
- **Una rotura mal armada da verde y parece un test flojo.** La del orden de esos dos redirects movía el viejo justo
  ANTES del otro, que es el orden correcto: dio 8/0. El test estaba bien. Antes de concluir que una guarda no ve,
  mirar que la rotura cambie lo que la guarda mide.
- **Se miró sin el dev server**, con el banco de esbuild y Chrome sin ventana de hallazgos-editor-imagen.md (stubs de
  `next/link` y `next/navigation`, `fetch` simulado). Desde Git Bash, un hash que empieza con `/` llega convertido en
  ruta de Windows y el banco dibuja OTRA pantalla sin un error: `MSYS_NO_PATHCONV=1`.
- **Quedó SIN hacer:**
  · `app/integraciones/IntegracionesBoard.tsx` tiene 6 errores de lint (`react-hooks/set-state-in-effect`) que ya
    estaban en main. El pre-push no corre el lint.
  · «Sesión anterior» en Tus dispositivos: espera el registro de sesiones (docs/diseno-dispositivos-vinculados.md,
    decisiones 1, 2, 4 y 5).
  · Horario y Criterio para el admin de cada negocio: espera la respuesta de Martín.
  · Entrar con huella sin Google, y resetear el 2FA de alguien del equipo: tandas aparte (decisiones del 15/10).
  · En el celular, los detalles de Seguridad son páginas (`?ver=`), no hojas. La Información personal sí es una hoja.

**Vive en:** `lib/ajustes-secciones.ts` · `lib/ajustes-negocio.ts` · `app/_ui/Ajustes.tsx` · `app/_ui/ajustes.css` ·
`app/perfil/` · `app/configuraciones/` · `app/m/cuenta/` · `tests/ajustes-cuenta-negocio.test.ts` · *15/10/2026, chat «Ciberseguridad»*

## El funnel tenía cuatro dibujos: el cubo, en el control, y sólo ése (17/10/2026)

Martín, viendo «De qué funnels» del OKR con el ícono de las etapas en cada renglón: «Los íconos del CRM no son esos... Es
el cubo que tenemos en el CRM... Hay que unificar los íconos». El barrido encontró **cuatro dibujos para lo mismo**: el
cubo del set (`producto`, el selector del CRM), otro cubo trazado a mano con otro path en tres archivos del CRM
(`IconoProducto` en AccionesLoteLeads, CampanasModal y ProductoDelLead), el embudo del sidebar en el selector de Offer
(escritorio y teléfono) y el de las etapas en los dos selectores nuevos de General. Ninguno estaba mal en su archivo:
divergieron porque cada uno lo dibujó donde lo necesitaba.

- **Un solo lugar:** `ICONO_FUNNEL` (app/_ui/icono-funnel.ts, sin JSX para las listas armadas en un `.ts`) y el dibujo
  `IconoFunnel` (app/_ui/iconos-menu.tsx). tests/icono-funnel.test.ts fija cada selector y que nadie vuelva a trazar un
  cubo a mano (barre app/), probado rompiéndolo.
- **Dónde va:** en el CONTROL que elige funnels (el `icono` del Dropdown; `Select` ahora lo deja pasar), la sección de un
  árbol o la píldora del teléfono. NO en cada renglón: la regla del 12/10 del CRM (cada funnel lo nombra el negocio) sigue.
- ⚠️ **El embudo (`Icon name="funnel"`) es FILTRAR**, no un funnel del CRM (Automations, el Ads Manager y el Dashboard lo
  usan para filtrar). Un barrido por el nombre «funnel» los agarra a todos: se separan por lo que el control ELIGE.
- **Lo que no tiene ícono no se tocó**: varios selectores de funnel de otras tabs (Ads Manager, prospectos, la landing,
  «Agregar al CRM», los campos de una acción) no llevan ícono en el control. Si se suman, es `IconoFunnel`.

**Vive en:** app/_ui/icono-funnel.ts · app/_ui/iconos-menu.tsx · tests/icono-funnel.test.ts · *17/10/2026, chat «Dashboard» (claude4)*

## La barra de inspección tapaba las pantallas de alto fijo (17/10/2026, tarjeta #850)

Martín, en la revisión del 16/10 inspeccionando a Brigitte: «la top bar tapa muchas veces funcionalidades… nada se debería
quedar por detrás». En Automations se escondían el título y «Probar», y el cartel «Copiaste un flujo» no se llegaba a ver.

- ⚠️ **No era el z-index de la barra: era el ALTO de las pantallas.** Con la barra, `body` gana `padding-top: 50px`, y toda
  pantalla de `height: 100vh` o `100dvh` en línea (Automations, Email, Dashboard, General, Calendario, Offer, Operaciones)
  medía 50 px más que la ventana. La ventana scrolleaba esos 50 px; cuando algo la corría (el foco en la barra de abajo, un
  scrollIntoView), lo de arriba quedaba debajo de la barra fija, y el lienzo, que se come la rueda para el zoom, no dejaba
  volver («no me deja tirar esto para arriba»).
- **Arreglo en UN lugar** (app/globals.css): con la barra (o la alerta de la voz), un estilo en línea que empieza con
  `height: 100vh/100dvh` o lo trae después de un espacio descuenta `--barra-agencia`. El espacio deja afuera `min-height`, y
  el riel del Sidebar queda afuera (`:not([data-sidebar])`): su regla con `100dvh` es la del iPad y ésta le ganaría por
  especificidad. **Medido en Chrome headless** antes de subirlo: el navegador serializa «flex: 0 0 auto; height: 100dvh; …»
  con «; », y la regla deja 654 de 704 px; `min-height` queda en 704.
- Lo FIJO arriba (`position: fixed; top: N`) no lo arregla esa regla: el cartel de la copia de Automations bajó con
  `calc(18px + var(--barra-agencia, 0px))`.

**La segunda vuelta, el mismo 17/10 (Onboarding).**

- ⚠️ **La regla no tomaba la pantalla que llega del SERVER, y entrar a inspeccionar SIEMPRE llega del server.** El estilo
  que pinta el navegador se serializa con espacios: «flex: 0 0 auto; height: 100dvh;». El que escribe React en el server va
  sin espacios: «flex:0 0 auto;height:100dvh». La hidratación no lo reescribe. Recién cuando React le cambia alguna
  propiedad, el navegador lo vuelve a serializar con espacios. Por eso falla a veces sí y a veces no, y la medición de
  arriba, hecha con un HTML escrito a mano con espacios, dio bien.
  Se entra con `<a href="/general?ws=N">`, que es una carga dura. Medido en Chrome sin ventana con el CSS real (ventana de
  608, barra de 50): la forma del server medía **608**, o sea sin descontar nada. Con las dos formas nuevas (al principio, o
  después de `;` sin espacio) mide **558**, y `min-height` sigue en 608. **Regla:** un selector de atributo sobre `style`
  tiene que reconocer las DOS escrituras.
- **Lo que quedó como «sin hacer» ya estaba hecho, y no por esta regla.** El panel del AI Analyst de la ficha del CRM
  (`fixed; top: 0`) y la lateral del Web Generator (`sticky; top: 0` en una clase) son `<aside>`. Con la barra prendida, la
  regla vieja `[data-barra-agencia] aside` les pone `top` y alto descontados con `!important`. Medido: los dos quedan con
  top 50. El test 4 fija que sigan siendo `<aside>`.
- **Los que de verdad quedaban debajo** salieron de relevar los 18 `sticky`/`fixed` con top 0 de app/. Son los que se pegan
  a la VENTANA y no son `<aside>`:
  - «Editando el deal» (`app/crm/[id]/EditarDeal.tsx`);
  - la fila de la hoja de la ficha en la RUTA /crm/[id] (en el pop-up se pega adentro de la ficha y va en 0: `arribaTabs`
    sólo lo pasa `LeadDetailBody`);
  - la cabecera abierta de /admin/estrategia;
  - el índice de las docs de la API (`.gh-docs-sidebar`, un `<nav>`).

  Los cuatro van a `top: var(--barra-agencia, 0px)`. El resto se pega adentro de un modal o de un panel con scroll, donde
  la barra no llega, o son anclas de 0×0 que se ubican por JS.

- **Las barras de lote: UNA variable que sabe si está en un modal** (la misma tarde). Las barras `sticky; top: 8` del Plan
  (`BarraPegada`, las cuatro del Kanban, una de ellas en 66) y la de Customer Success viven en la página y también
  adentro de modales. Sumarles `--barra-agencia` siempre las bajaba 50 px en el modal. `--pegado-arriba` (globals.css)
  vale la barra en `:root` y 0 en `[aria-modal="true"]`: como las variables se heredan, todo lo de adentro de un modal
  la ve en 0 sin que cada puerta lo diga. Medido en Chrome: en la página 58, en el modal 8. La del CRM la bajó su chat con
  `--barra-agencia` (el tablero del CRM no vive en un modal).

**Sin hacer:**
- **La regla de todo `<aside>` también pisa** el `top: 12; bottom: 12` del panel `<aside className="an">` de PanelAnalista.
  No se miró con la barra puesta.
- **Una ruta pública** cargada en duro con una agencia adentro de un cliente queda con el hueco de la barra y sin barra
  (ver #881 abajo). Es raro y sólo es espacio.
- Verlo con clics inspeccionando el ws3 cuando esté en producción.

**Vive en:** `app/globals.css` (después de la regla del Sidebar) · `app/automations/ChatAgentApp.tsx` (el cartel de la
copia) · los cuatro de arriba · test: `tests/barra-inspeccion-alto.test.ts` (5 tests) y `tests/lead-cabecera.test.ts`
(`arribaTabs`)

## Al inspeccionar, el primer cuadro era el de Mauricio (17/10/2026, tarjeta #881)

Martín, revisión del 16/10 (47:15): «al inspeccionar, muchas veces al entrar se bugea y sale primero el usuario de perfil de
Mauricio y luego sale el usuario que se está inspeccionando».

- ⚠️ **El diagnóstico obvio era el equivocado. No era `lib/perfil-sujeto.ts` ni la ficha del cliente:** el Sidebar nacía con
  `useState('Mauricio')`, un resto de cuando la app era de una sola cuenta, y con `impersonando = false`. Las
  iniciales, sin nombre, caían a «MB». Los dos datos se corregían cuando contestaba `/api/auth/me`. Como se entra a
  inspeccionar con una carga dura (`<a href>` el super admin, `location.href` la agencia), el primer cuadro salía mal en
  CADA entrada. Y no sólo inspeccionando: **cualquier cliente veía «Mauricio» abajo a la izquierda** hasta que
  llegaba su nombre. La barra de arriba tenía la misma demora: aparecía después y corría la pantalla 50 px.
- **El primer cuadro lo arma el server.** `lib/vista-de-otro.ts` dice a quién se mira: el cliente, su nombre, su agencia y la
  salida. El layout se lo pasa al Sidebar (`inicial`) y a la barra, y pone `data-barra-agencia` en `<html>` desde el HTML,
  así no hay salto. `/api/auth/me` llama a la MISMA función, porque con dos cuentas de «a quién se mira» el cartel y los
  datos podrían nombrar a dos clientes. **Regla:** un estado de cliente que se corrige con un fetch nace con lo que sabe el
  server, nunca con un literal.
- Las entradas a inspeccionar son todas cargas duras, así que alcanza con el valor inicial: no hace falta sincronizar
  props → estado en un `router.refresh()`.

**Sin hacer:** `rolWs` y `capa` siguen naciendo vacíos. Las pestañas del Sidebar que dependen de qué compró el cliente se
filtran recién cuando contesta `/api/auth/me`. Pasarlas desde el layout le suma dos lecturas a cada página. La foto del
perfil propio también llega después: hasta entonces se ven las iniciales correctas.

**Vive en:** `lib/vista-de-otro.ts` · `app/layout.tsx` · `app/_components/Sidebar.tsx` (`SidebarInicial`) ·
`app/_components/ImpersonationBanner.tsx` · `app/api/auth/me/route.ts` · test: `tests/inspeccionar-primer-cuadro.test.ts`


## La sidebar del prototipo: lo que no se ve en el código (17/10/2026, noche)

Martín vio `docs/prototipos/sidebar-nueva-1710.html` y `coherencia-1710.html` («la sidebar es confusa, copiá otras
apps»). El diseño quedó en `docs/diseno-sidebar.md` (la v2 arriba de todo); acá, las trampas.

- **Los `--grafo-*` parecían la paleta categórica de la casa y no lo son.** `app/globals.css` los prohíbe fuera del
  lienzo del Second Brain (están pensados contra `#14161B` y suben de brillo a propósito). Los colores de sección son
  tokens propios, `--sec-*` en `app/_ui/ui.css`, con los valores del prototipo (Nord).
- **La barra es OSCURA en el tema de siempre aunque la pantalla sea clara.** Un token de color con sólo «claro» y
  «oscuro» pinta la barra con los tonos de la pantalla: verde oscuro sobre `#14161B`, ilegible. Por eso los `--sec-*`
  tienen una tercera variante adentro de `[data-sidebar]`, y en True North clara (donde la barra también es clara)
  vuelven los oscuros. **Regla:** un color que se usa en la barra Y en la pantalla se define por superficie, no por tema.
- **Dos `Ctrl K` en la misma pantalla.** El inicio del Web Generator ya tenía el suyo (`app/web-generator/Inicio.tsx`,
  escucha en `document`); el de la barra escucha en `window`, que corre DESPUÉS. Los dos hacían `preventDefault` y
  enfocaban su campo: ganaba el último, o sea la barra, y la búsqueda de la pantalla dejaba de responder. **Regla:** el
  atajo global respeta `e.defaultPrevented`; una pantalla con su propio atajo lo marca y gana.
- **La lógica del buscador no puede vivir en el componente.** El test de los alias («home» → Dashboard) importaba
  `BuscadorNav.tsx`, que es `'use client'` y arrastra React y el router. La regla (alias y orden de resultados) está en
  `lib/buscador-nav.ts`, sin React; el componente sólo la dibuja.
- **«Home» fuera de la barra no es borrar su ítem.** La key `general` la leen las capas, el onboarding por tab y el
  título de la pestaña: va a `SIN_FILA` (como WhatsApp y Email) y el `match` del Dashboard acepta /general y /focus,
  para que la barra marque algo mientras exista la ruta.
- **Las filas «My leads», «My tasks», «My reports» y «Favorites» del prototipo de My Profile no tienen con qué.**
  No hay un filtro «míos» en el CRM ni en el Plan, ni favoritos guardados: un link a /crm rotulado «My leads» mostraría
  los de todos. No se dibujaron.

**Sin hacer:** el Dashboard con la hoja fija Focus, el botón Templates y /general → /dashboard (archivos del jefe
«Dashboard»: `app/dashboard/page.tsx`, `app/general/page.tsx`; el plan con lo medido se le mandó el 17/10). Las filas de
My Profile de arriba. El chequeo de tipos de esta tanda lo corrió Actions: en la PC no había RAM para el tsc acotado.

**Vive en:** `app/_components/nav.ts` (FAMILIAS, PRONTO, SIN_FILA) · `app/_components/Sidebar.tsx` (la barra fija, la
cara del menú, Platform › Coming soon) · `app/_components/BuscadorNav.tsx` + `lib/buscador-nav.ts` · `app/_ui/ui.css`
(`--sec-*`) · `lib/ajustes-secciones.ts` (My Profile, Business settings) · test: `tests/sidebar-nueva.test.ts`

## Una familia de tarjetas para CRM, Clients y Plan: el kit vive en app/_ui/TarjetaKanban (17/10/2026)

Martín, 17/10 22:40 (punto 8): «No me gustan las cards… Quiero que tengan coherencia». La fuente fue el prototipo
docs/prototipos/coherencia-1710.html; su kit se escribió UNA vez en `app/_ui/TarjetaKanban.tsx` (`TarjetaPersona`,
`TarjetaTarea`, `PestanasPildora`, `TarjetaDestacada`, `CuerpoFichaRapida`/`FichaRapida`) y lo puro (iniciales, color,
insignia del canal, plata) en `lib/tarjeta-kanban.ts`, con test.
- **La raíz de la tarjeta recibe las props del que la monta** (`draggable`, `onDragStart`, `data-*`, `onClick`): el
  arrastre, el clic derecho y la selección siguen siendo del tablero. La familia dibuja; no decide.
- **Los tokens del kit son `--tk-*`, adentro del componente**, apoyados en los de la casa (`--card-bg`, `--primary`,
  `--good`…): la app no tenía sombra de tarjeta ni los colores de sección del prototipo. Oscuro: `[data-tema="oscuro"]`.
  El CSS va con `<style href precedence>`: React lo deduplica aunque cada tarjeta lo monte.
- ⚠️ **Y los tokens van en TODA pieza `tk-*`, no en unas raíces (18/10, ya en producción).** Se declaraban sólo en
  `.tk-raiz, .tk, .tk-ptabs, .tk-feat, .tk-sheet`, y el Plan y el teléfono usan piezas SUELTAS: el círculo de prioridad
  vive en la tarjeta del Plan (que no es `.tk`) y la cara del teléfono en `.m-kb-tj`. Síntoma: el círculo del Plan
  **invisible** —`--pc` vacío deja el borde en `currentColor`, que es el blanco del tilde, sobre la tarjeta blanca; el de
  prioridad 3 directamente sin borde, porque un `var()` sin valor invalida el `border` entero— y las iniciales del teléfono
  sin su círculo de color. Lo que NO lo delataba: el CSS es válido, el clic andaba y los tests de cableado pasaban; sólo
  se ve mirando la pantalla. El arreglo es la primitiva: `.tk, :where([class^="tk-"], [class*=" tk-"])` (el `:where` no
  suma especificidad, el oscuro sigue ganando). Lo fija tests/tarjetas-familia.test.ts: por cada regla del kit que USA
  una variable, una pieza con sólo esa clase tiene que caer en la que las declara (roto: 5/1 con 20 piezas sin color).
- ⚠️ **Y los ESTILOS los monta cada componente, no el tablero (18/10, cliente roto en producción).** `<EstiloTarjetas />`
  lo montaban el CRM, el teléfono y el Plan; Clients de la computadora usó `TarjetaPersona` sin montarlo y la tarjeta
  salió sin estilos para TODOS los negocios (la foto a todo el ancho; nombre, «Ver info» y «Acciones» como texto suelto).
  Lo que lo escondió: era la única pantalla que el build parcial no dejó ver (su panel pide una API que no estaba en el
  build), y se dio por buena porque «es el mismo componente que el CRM». Regla: cada componente del kit lleva su
  `<EstiloTarjetas />` (React deduplica el `<style href precedence>`), y quien escribe clases `tk-*` a mano lo monta él.
- **`TarjetaEntidad` NO se tocó**: también la usa /admin. Clients dejó de usarla; quien quiera la familia, usa el kit.
- **Un botón adentro de una tarjeta que ya es botón no vale** (el teléfono): el círculo de una tarea y la píldora «Ver
  info» van como `span` (con rol de botón, el círculo; sólo dibujo, la píldora: toda la tarjeta abre la ficha rápida).
- **Una rotura que no cambia nada no prueba nada:** sacar el corte de «Sin origen» en `insigniaDeCanal` daba 4/0 porque
  ese texto también caía al `return null` del final. Se midió otra (sin el caso de WhatsApp: 3/1).

**Vive en:** app/_ui/TarjetaKanban.tsx · lib/tarjeta-kanban.ts · tests/tarjeta-kanban.test.ts y tests/tarjetas-familia.test.ts ·
*17/10/2026 noche, chat «CRM» (claude4).*

## Renombrar una fila de la barra le cambia la tab a los chats jefe (18/10/2026)

El Second Brain de cada negocio pasó a llamarse «Ops Center» (pedido de Martín). Cambiar el `label` en nav.ts parecía
todo, y los tests de la barra pasaban.

- **El Ops Center del super admin busca la tab de cada chat jefe por el NOMBRE de la fila** (`rutaDeLaTab` en
  lib/centro-chats.ts, el primer ítem cuyo `label` coincide). Con el renombre pasaban dos cosas a la vez, sin error:
  - «Ops Center» quedaba repetido, y como la barra del producto va primero, el «Revisar» de los chats «Ops Center»
    llevaba a /second-brain.
  - El jefe «Second Brain» no encontraba ninguna fila con su nombre y caía en la ficha de desarrollo
    (`/admin/dev/second-brain`, que se llama igual en el menú de Dev).
- **Lo obvio era renombrar también el chat jefe.** No sirve: hay un jefe «Ops Center» de verdad (el del Centro), y los
  dos chats tendrían el mismo nombre.
- **La regla que queda:** el ítem puede decir el nombre de su jefe cuando no es el de la fila (`jefe` en `NavItem`), y
  `rutaDeLaTab` y `nombresDeTabs` lo usan. **Antes de renombrar una fila, buscar si un chat jefe se llama como ella.**

**Sin hacer:** los textos de MaKo siguen diciendo «Second Brain → Persona» (lib/secciones-negocio.ts y las reglas del
chat). Son contenido y no se tocaron. Si «Second Brain» deja de nombrarse en la barra del negocio, MaKo manda a un lugar
con un nombre que ya no se ve.

**Vive en:** `app/_components/nav.ts` (MAKO_NAV, `estrella`, `jefe`) · `lib/centro-chats.ts` (`rutaDeLaTab`) ·
`app/admin/operaciones/tabs.ts` · test: `tests/sidebar-nueva.test.ts`, `tests/centro-revisar.test.ts`

## La barra clara no se hace en :root: las --sidebar* son la «isla oscura» de toda la app (20/10/2026)

Martín pidió que la barra siga el modo (feedback del 18/10, pt 10: «si estoy en dark mode se debe adaptar a white mode,
lo contrario»). Hasta ese día era #14161B también con la pantalla clara.

- **Lo obvio era cambiar las `--sidebar*` de `:root` a valores claros.** Está mal: 43 archivos fuera de la barra las
  usan como superficie oscura (los toasts, el grafo del Second Brain, bloques del Dashboard, la cabecera de video, el
  recorrido…). Se habrían puesto blancos todos, sin un error.
- **La regla que queda:** la barra clara se define ACOTADA a `[data-sidebar]` (app/_ui/ui.css). Lo que vive adentro
  de la barra (la campana, el saldo, el interruptor de modo, la foto) hereda los valores solo. Si una pieza nueva quiere
  «el color de la barra», usa las `--sidebar*` y vive adentro de `[data-sidebar]`. Si quiere «una isla oscura», no
  debería usar las de la barra: hoy lo hacen 43 archivos y quedan así.
- **Las criaturas «cambiaban de color» por la CARA, no por el cuerpo.** El cuerpo son pasteles fijos (`--grafo-*`,
  `--mako`). Los ojos y la boca iban con `--ink`, que en oscuro es claro: ojos blancos sobre pastel. Ahora la cara va
  con `--criatura-tinta` y `--criatura-rubor`, que ningún tema redefine (el test lo cuenta).

**Sin hacer:** las 43 islas oscuras que usan `--sidebar*` siguen colgadas del nombre de la barra. Si un tema candidato
cambia la barra a clara, también las cambia a ellas (ya pasó con el selector Kanban/Tabla, por eso existe `--on-ink`).

**Vive en:** `app/_ui/ui.css` (la barra clara, `--sidebar-hover`) · `app/globals.css` (`--criatura-tinta`) ·
`app/admin/operaciones/Muneco.tsx` · `app/_components/Sidebar.tsx` · test: `tests/sidebar-nueva.test.ts`

## Un color «de superficie» no es un color de columna: `--surface-2` es el mismo gris que la página (20/10/2026)

**Síntoma:** Martín, el 20/10: «Muchos cambios que te había pedido aún no están, como que las columnas no sean
invisibles». El 18/10 se había «arreglado» (pt 8) pasando el fondo de la columna de `--surface-2` al 55 % a
`--surface-2` entero, con su test en verde, y se dio por hecho.
**Causa:** en el tema claro `--bg` (la página) es #F4F6F9 y `--surface-2` es #F5F7FA: el mismo color, y hasta un poco
más claro. El arreglo cambió el valor y nunca lo comparó contra lo que tiene detrás; el test fijaba el NOMBRE de la
variable, no que se viera.
- ⚠️ **El diagnóstico obvio era el equivocado:** «falta opacidad» llevó a subir la opacidad de algo que no contrastaba.
  El prototipo (coherencia-1710) no usa una superficie: usa un tono para columnas, `rgba(216,222,233,.55)` en claro y
  `rgba(0,0,0,.16)` en oscuro.
**Arreglo:** `--fondo-columna` en app/globals.css (claro y oscuro), y `FONDO_COLUMNA` apunta a ella en el CRM, Clients,
el Plan y el kanban del teléfono. El test mezcla el color de la columna SOBRE el de la página y pide una diferencia de 8
o más (con `--surface-2` da 1,7).
**Regla:** un color de fondo se prueba contra lo que tiene detrás, no por su nombre. Un test de «usa la variable X»
no dice que se vea.
**Vive en:** app/globals.css · lib/tarjeta-kanban.ts · tests/tarjetas-familia.test.ts (§9). *20/10/2026, chat «CRM» (claude4).*

## Una ventana de escritorio CHICA: la red era el layout, y se mide contando (21/10/2026)

Martín: MaKo se rompía apenas la ventana era un poco más angosta que la pantalla completa. Su caso: 60 % de
1920×1080 con escala 125 %, o sea **934×639 de CSS**. Lo medí en su Chrome, en producción y en el ws3, contando
textos fuera de la ventana, textos pisados, cortados con «…» y scroll de costado (barra abierta → plegada):

| Ancho | /integraciones | /dashboard | /crm |
|---|---|---|---|
| 934 | 38 px de scroll · 5 fuera · 20 cortados → 0 · 0 · 4 | 0 → 0 | 0 → 0 |
| 1027 | 20 cortados → 1 | 1 pisado · 2 cortados → 0 | 1 px de scroll → 0 |
| 1283 | 20 cortados → 18 | 1 pisado → 0 | 0 → 0 |

- **El corte es 1200.** Por debajo, la barra arranca plegada a íconos (`ANCHO_BARRA_PLEGADA`, Sidebar.tsx), con la
  misma regla que el Ops Center: la flecha la fija abierta ahí sin tocar la preferencia guardada. El molde de ajustes
  (índice de 236 → 196, márgenes de 44 → 26) y el modal de un servicio (panel oscuro de 336 → 236) se angostan en el
  MISMO corte; un test lo ata.
- **Lo que la barra no arreglaba era de la página.** Los 20 motivos cortados de «Requiere tu atención» se cortaban
  también a 1283: eran tarjetas de 300 px con el motivo en una línea. Las grillas con `minmax(Npx, 1fr)` desbordan una
  columna más angosta que N; con `minmax(min(Npx, 100%), 1fr)` no. Después: 0 cortados a 934, 1027 y 1283.
- **El panel oscuro del modal no se estiraba a su fila** (medía 566 en una fila de 518 y se cortaba abajo), aunque la
  grilla tenía `minmax(0, 1fr)`. `max-height: 100%` lo topea a su celda.
- **Trampas de la medición.** Las miniaturas de las plantillas (vistas previas achicadas con `transform`) aparecen como
  «textos pisados»: hay que excluirlas o se persigue un fantasma. Un texto con «…» tiene su rectángulo de texto entero
  aunque se vea cortado: hay que mirar si una caja con `overflow` lo recorta. Y en el Chrome de la extensión, después
  de cambiar el tamaño de la ventana, sólo una PESTAÑA NUEVA toma el tamaño nuevo: la vieja se queda con el anterior.
  ⚠️ Con la ventana MAXIMIZADA ni eso: el cambio de tamaño contesta «Successfully resized» y `innerWidth` sigue en el
  ancho de la pantalla, también en una pestaña nueva (medido el 21/10, chat Dashboard). Ahí se emula el ancho de la
  caja que importa (el contenedor, calculado con la barra y los márgenes medidos), no el de la ventana.

**Lo del Dashboard era la trampa de arriba, no un pisado** (lo midió el chat Dashboard el mismo 21/10): «Contenido y
lanzamiento» con «Sugerido» se ve «Contenido y lanza… Sugerido» a 1283 abierta, 1024 y 934 (abierta y plegada), 0
pisadas. La CAJA del título termina antes del chip (907–1045 contra 1053–1101 a 1283); lo que se cruzaba era el
rectángulo del TEXTO (907–1079). Lo sostiene el CSS de la tarjeta (`.nh-nombre` con «…», `.nh-sugerido` sin achicarse,
app/dashboard/NuevaHoja.tsx), atado en tests/plantillas-sugeridas.test.ts.
**Sin hacer:** la vista de lista del CRM, que Martín vio pisada, es del CRM. Lo de después se midió inyectando estas
mismas reglas en la página de producción, no en un build.

**Vive en:** `app/_components/Sidebar.tsx` (`ANCHO_BARRA_PLEGADA`) · `app/_ui/ajustes.css` · `app/globals.css`
(`.mk-svc-modal`) · `app/integraciones/IntegracionesBoard.tsx` · test: `tests/ventana-chica.test.ts`

## «Kanban · Lista» y «Personalizar tarjetas»: UNA pieza cada uno para todos los tableros (21/10/2026)

Martín, 21/10: «Los íconos de "tablero y lista" deberían estar como juntos en una sección, y el placeholder del
"tablero" debe ser "kanban"... Esto en todos lados» y las plantillas de tarjeta «en clientes, plan, etc.».

- **Había TRES selectores de vista** para la misma pregunta: el CRM con dos píldoras `.tk-ptab` sueltas que decían
  «Tablero», Clientes con su `.bc-toggle` y el Plan con un `VistaToggle` propio que decía «Ver en tarjetas». Por eso
  «en todos lados» no se cumplía cambiando uno. Ahora es app/_ui/SelectorVista.tsx, con los nombres cortos del
  catálogo app/_ui/iconos-vista.tsx («Kanban», «Lista»); tests/crm-vista-iconos.test.ts frena una copia nueva
  (ningún tablero puede volver a dibujar `ICONO_VISTA[` por su cuenta). /admin lo hereda por BarraClientes.
- **Una miniatura de plantilla no puede ser un `<button>`**: adentro va la tarjeta DE VERDAD, que trae su píldora «Ver
  info» (otro botón), y un botón dentro de otro no es HTML válido. Es un `div role="radio"` con teclado propio y la
  tarjeta `inert`: se mira, no se toca. app/_ui/PersonalizarTarjetas.tsx.
- **La galería dibuja con la función del tablero** (`vistaPrevia(forma, campos)`), no con un dibujo aparte: si fueran
  dos, la galería podría prometer una tarjeta que el tablero no dibuja.
- **El CRM dejó de usar clases `tk-*` en la barra**: salió de la lista de tests/tarjetas-familia.test.ts que exige montar
  `<EstiloTarjetas />` (si vuelve a usarlas, vuelve a la lista).

## Con la barra de la agencia, TODO `<aside>` toma el alto de la ventana (22/10/2026)

`app/globals.css` tiene `[data-barra-agencia] aside { top: var(--barra-agencia) !important; height: calc(100vh - …)
!important }` desde el 16/08, para el riel del Sidebar. Pero el selector toma CUALQUIER `<aside>`, y sólo cuando el super
admin mira un cliente: un panel flotante (`position: absolute`) que sea un `<aside>` queda más alto que su contenedor y lo
de abajo sale de la vista. Medido en el Dashboard del ws3: «Editar con MaKo» medía 761 px en un lienzo de 612, con la caja
afuera; sin el atributo, 588. **El cliente no lo ve nunca**, así que en una prueba con su sesión todo se ve bien. Con la
alerta de voz ya se había acotado al Sidebar (`aside[data-sidebar]`) por lo mismo, el 11/09. **Regla:** un panel flotante
nuevo es un `<section role="complementary">` o un `<div>`, no un `<aside>`. **Pega también en un panel que NO flota**: el
agente del Web Generator y el chat del Video Editor (dentro de su columna, con `size-full`) medían 761 px en lugares de 668,
con la caja abajo de la vista; los tres pasaron a `<section>` el 22/10. **Y mirar también a los padres:** en el Web Generator
el que se estiraba era la COLUMNA del editor (`aside.gma-izq`, 761 px en un cuerpo de 713), no el panel; pasar sólo el panel
a `<section>` no cambió nada. Las tres columnas del editor (EditorLanding.tsx) son `<section>` desde esa noche. Sin hacer: acotar también la regla de la barra de
agencia a `aside[data-sidebar]` (es de esta área; hay que mirar antes qué otro `<aside>` depende de ella).

## Un pie `sticky` adentro del cuerpo de un Modal deja pasar filas por debajo (23/10/2026)

- **Síntoma** (Martín, captura de «Traer de otro funnel» en el ws1): «se ven leads por detrás y debajo» del pie con
  «← Atrás» y «Agregar aquí», «y parece roto».
- **El diagnóstico obvio era el equivocado:** el pie YA tenía fondo sólido (`var(--surface)`). Lo que pasaba es que era
  `position: sticky; bottom: 0` dentro de `.mk-modal__cuerpo`, el que scrollea, y ese cuerpo tiene 20 px de padding
  abajo: las filas de la tabla pasaban por esa franja, debajo del pie (leído en el código y en la captura; no medido).
- **Lo que quedó:** la vista mide el alto del cuerpo (`height: 100%`, que resuelve porque el Modal tiene `alto` fijo), la
  que scrollea es la TABLA (`flex: 1; minHeight: 0; overflowY: auto`) y el pie es el último renglón: nada pasa por
  detrás. El `sticky` queda de respaldo para un padre sin alto (el importador, en un WizardShell).
- **Regla:** un pie con botones va en el `pie` del Modal, que no scrollea. Si el pie necesita el estado de la vista (la
  selección, «Agregando…»), la vista mide el alto del cuerpo y hace scrollear su propia lista. Un `sticky` adentro del
  cuerpo no alcanza.

**Vive en:** app/crm/TraerDeOtroProducto.tsx · app/_ui/Modal.tsx (`.mk-modal__cuerpo` en app/_ui/ui.css) · tests/crm-traer-23-10.test.ts
*23/10/2026, chat «CRM» (claude3).*

## Ver una pantalla de cliente sin levantar la app, y tres trampas de CSS de un rediseño (24/10/2026, Ops Center)

**El porqué:** levantar la app local ESCRIBE en la base de producción. /integraciones, al abrirse, reconcilia los incidentes de
Meta y crea el token del Pixel. Y el navegador de la app de Claude no abre `localhost` ni `file://`. Para mirar un rediseño antes de
subirlo se dibujaron las piezas REALES en Node (`renderToStaticMarkup`) con el CSS de verdad, y se fotografiaron con un Edge sin
ventana.

- **La receta** (un ejemplo de 24/10 está en el scratchpad de esa sesión; se rearma en minutos):
  - `module.registerHooks` (Node 24), SINCRÓNICOS. tsx carga parte de los archivos como CommonJS, y los ganchos de ESM
    (`module.register`) no atrapan esos `require`: el `require('server-only')` de lib/settings.ts tiró todo abajo;
  - `next/navigation` y `app/_ui/Link.tsx` se cambian por stubs (`useSearchParams` con una búsqueda de prueba, un router que no hace
    nada);
  - un archivo que empieza con `'use server'` se cambia por sus exportaciones como funciones vacías (los nombres salen de una regex
    sobre su fuente);
  - `server-only` y los `.css` se cambian por un módulo vacío;
  - los stubs importan React con la ruta del repo: desde el scratchpad no hay `node_modules`;
  - el estado que la pantalla lee en el navegador (un `useEffect` con `fetch`) no se dibuja: se reemplaza en el HTML y se dice.
- **Trampa 1: un `<summary>` con `display: grid` (o flex) en Safari 16 o anterior.** WebKit lo dibuja como un bloque común (bug
  167111, arreglado en Safari 17), y una flecha hecha con `::after` sale como una raya suelta. La grilla va en un `<span>` de
  adentro, y la flecha es un `<span>` más. Adentro del `<summary>` sólo va texto en línea.
- **Trampa 2: con la misma especificidad gana la regla de más abajo, aunque sea más general.** `.co-uso__credito { display: flex }`
  está más abajo en el archivo que `.co-uso__credito--barra { display: grid }`, y pisaba la grilla. Con la clase doble
  (`.co-uso__credito.co-uso__credito--barra`) gana siempre, esté donde esté.
- **Con interacción (24/10/2026, Chats):** una pantalla que lee todo con `fetch` (ChatsApp) no se ve con `renderToStaticMarkup`.
  Se armó con esbuild (el del repo) un bundle de la pantalla real con un `fetch` falso (datos de ejemplo por ruta) y los mismos
  stubs, y se abrió en el Edge sin ventana con `--virtual-time-budget`; los clics, por selector desde la página. Cuatro trampas:
  - **`process is not defined`**: lib/app-url.ts (que trae un modal compartido) lee `process.env` en el cliente; Next lo
    rellena y esbuild no. Un `banner` con `var process = { env: {} }`;
  - **un menú abierto sale cerrado en la foto**: la captura redimensiona la ventana y el Dropdown de la casa se cierra con el
    `resize`. En el arnés, un `resize` que no llega (`stopImmediatePropagation` en captura, registrado antes de montar);
  - **un modal sale transparente, como si estuviera DEBAJO de la pantalla**: no era un problema de apilamiento (eso parecía);
    las animaciones de CSS (`mkFade`, 0,12 s) no avanzan con el tiempo virtual y la foto las agarra en el primer cuadro. En el
    arnés, `animation: none`;
  - **esbuild colgado**: parecía un ciclo de imports, y era la máquina sin memoria (875 MB libres con cuatro `tsc` enteros de
    otros chats). Mirar la RAM antes de diagnosticar un cuelgue.
- **Trampa 3: reordenar el marcado de una tarjeta rompe tests que no hablan de diseño.** Los tests del Uso leen el texto de cada
  tarjeta en orden. Con `display: contents` en la fila de adentro y una grilla con áreas, el marcado queda igual y se ve en otro
  orden. Un lector de pantalla sigue leyendo el orden lógico.

## Una captura «de teléfono» con `--window-size=390` miente: el Edge sin ventana tiene un ancho mínimo (24/10/2026)

**El síntoma:** las fotos del arnés de Chats a 390 × 844 salían con las burbujas cortadas a la derecha y el botón del
micrófono afuera de la pantalla. Parecía que la caja del teléfono no entraba (justo lo que Martín había reportado el 17/10:
«el chat en mobile se ve muy chico por los botones»).

**La causa:** el Edge (y el Chrome) sin ventana tiene un ancho MÍNIMO de ventana, cerca de 500 px. Con `--window-size=390`
dibuja una página de ~500 px y la foto recorta 390: ni las media queries ni el `pointer: coarse` son los de un teléfono. El
diagnóstico obvio (la caja se desborda) era el equivocado.

**La regla:** una foto de teléfono va por CDP con la emulación de dispositivo, como DevTools:
`Emulation.setDeviceMetricsOverride { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }`, el táctil
(`setTouchEmulationEnabled`) y un user agent de Android. El paquete `ws` del repo alcanza para hablar CDP; no hace falta
Puppeteer. Y `Emulation.setFocusEmulationEnabled`: sin foco en la página, un `focus()` no dispara el evento (lo que la caja
mira para ofrecer «Pegar la captura»). Medida así, la caja del teléfono entra entera en una fila.

## Un aviso que se cierra: la pausa va por el DOM, y un arrastre con el dedo no termina en click (24/10/2026)

Martín: «tengo que esperar a que se vayan para apretar el botón de atrás». Los tres avisos (Toast.tsx, AvisoM del teléfono,
AvisoArriba de NotificationsProvider) usan `app/_ui/descartar.tsx`: la ✕, arrastrarlo 64 px de costado, y `esperarPausa`.

- **La pausa no puede ser un estado compartido.** El temporizador vive en el hook de cada pantalla (`useToast`, decenas) y el
  aviso en otro componente. El aviso se marca `data-mk-aviso` + `data-pausa` mientras el mouse o el dedo está encima, y
  `esperarPausa` mira el DOM antes de cerrar (si hay uno en pausa, vuelve a mirar en 800 ms). Ninguna pantalla cambió.
- **Trampa: un arrastre con el dedo que vuelve a su lugar NO termina en `click`.** El indicador «hubo arrastre» (para que
  soltarlo no abra el chat del aviso de WhatsApp) se limpiaba en el `click`; con el dedo no llegaba, y el primer toque en la ✕
  se lo comía `onClickCapture`. Se limpia en el `pointerdown`, ANTES del corte que deja pasar los botones.
- **Trampa: `flex-wrap` en un aviso `position: fixed; left: 50%` lo encoge a media pantalla.** El ancho disponible para
  ajustarse al contenido va de `left` al borde derecho (195 px en un teléfono). Sin wrap no se notaba porque el contenido no
  se podía partir; va `width: max-content` con el `maxWidth` de siempre. Antes, en una ventana angosta el Toast dejaba una
  palabra por renglón.
- **Un `${…}` en el objeto de estilos rompe a los tests que leen el fuente con `[^}]*?`** (tests/recorrido.test.ts busca el
  z-index del Toast así). El `transform` con el corrimiento va en una variable afuera.
- **El guardián de «Reportar a Soporte» sólo ve hijos LITERALES**: pasarlo por `{children}` desde quien llama no cuenta.
- **La regla:** un aviso nuevo esparce `useDeslizarParaCerrar(onCerrar).props` en su caja y su temporizador es
  `setTimeout(esperarPausa(cerrar), ms)`; nunca `setTimeout(() => setX(null))` (lo fija tests/avisos-se-cierran.test.ts).

## La sidebar plegada por defecto: cambiar un default pide clave nueva, primer cuadro nuevo, y mirar quién lo LEÍA (24-25/10/2026)

Martín: «en web generator, como en todas las tabs, haz que por defecto al entrar se pliegue la sidebar principal, pero no
impidas que se vuelva a desplegar».

- **Hay DOS mecanismos y no son lo mismo.** El default global (`mk-nav-fija-v2`, guardado: la flecha la abre y se recuerda en
  todas las tabs) y `plegadaAca` (Ops Center, Automations, ventana chica, MaKo abierto: por visita, la flecha la abre sólo
  ahí). Web Generator va en el PRIMERO: con `RUTAS_QUE_PLIEGAN` se volvería a plegar en cada visita, que es justo lo que
  Martín pidió no impedir.
- **El default nuevo rompió el SEGUNDO mecanismo sin tocarlo (la regresión del 25/10).** Martín: «La sidebar principal en
  muchas tabs no funciona el botón de "desplegar" para mantenerla desplegada». `fija` era `guardada && (!plegadaAca ||
  abiertaAca)`: el pliegue temporal SUPONÍA que lo guardado era «si» (lo era por defecto). Con lo guardado en «no» para casi
  todos, la flecha en Automations, el Ops Center, una ventana de menos de 1200 px o con MaKo abierto abría `abiertaAca`, y
  `fija` seguía en false: se veía abierta mientras el cursor estaba encima y se plegaba al salir. El diagnóstico obvio
  («la flecha no guarda») era a medias: guardaba bien fuera de esas pantallas. **Regla:** donde la barra se pliega sola manda
  lo que hizo la flecha en esa visita (`barraFija`), y desplegarla se guarda SIEMPRE (`loQueGuardaLaFlecha`); plegarla en una
  de esas pantallas es de ese rato. Al cambiar un default, buscá quién lo leía con un `&&`.
  - **Lo que queda a propósito:** en una ventana de menos de 1200 px, al RECARGAR, la barra vuelve a arrancar plegada aunque
    esté guardada abierta (el corte del 21/10, para que no se rompa todo lo de la derecha). Navegando entre tabs se mantiene.
- **Un default nuevo con la clave vieja no lo ve quien ya tocó la flecha** (tenía «si» guardado). Como el 20/10 con las
  secciones, la clave cambia y todos arrancan plegados una vez.
- **El `useState` inicial es el primer cuadro.** Con `useState(true)` y el default en plegada, cada carga dibujaba la barra
  abierta y la plegaba al montar. Va `useState(false)`; el salto queda sólo para quien la fijó abierta.
- **Sin hacer:** mirar en producción cada tab con la barra plegada. El navegador de la app no tiene sesión y el Chrome no
  estaba conectado; el rail es el mismo que ya veía quien la plegaba, y a 934 y 1027 px (21/10) daba 0 desbordes.

**Vive en:** `app/_components/Sidebar.tsx` (`leerFija`, `barraFija`, `loQueGuardaLaFlecha`, `plegadaAca`) ·
`tests/sidebar-plegada-por-defecto.test.ts` (el recorrido de una persona: Automations → CRM → MaKo abierto y cerrado).

## La criatura «se escondía detrás» de la barra desplegada (24/10/2026, f34)

**El síntoma (la llamada con Leandro, 59:33):** «la animación del muñequito de Mako... cuando se va para abajo y se pone en su
chat, y si está la sidebar desplegada, es como que se oculta detrás y no se entiende a dónde se fue».

**⚠️ El diagnóstico obvio era el equivocado.** No era la copia que vuela: va en `body` con el z-index más alto
(app/_ui/VueloDeCarga.tsx), por delante de la barra. Lo que quedaba debajo era su DESTINO: la estrella de abajo
(`.ch-tab-mako`, z 55) se ponía al lado del `<aside>` de la barra (`useBordeDeLaBarra`, app/_chat/MakoEnLaTab.tsx). Ese
`<aside>` mide lo del riel y no cambia cuando su panel se despliega ENCIMA al pasar el cursor (z 60). La copia aterrizaba
bien y la estrella real estaba tapada.

**Qué quedó:** la estrella se mide con el panel, lo que se ve (`panelDeLaBarra`, app/_chat/borde-barra.ts). Con la barra
desplegada se corre y no queda debajo. El panel del Cerebro sigue con el borde del `<aside>`: si se corriera, saltaría
440 px cada vez que el cursor pasa por la barra.

**Regla:** un elemento fijo que se pone al lado de la barra se mide con lo que se VE de ella (su panel), no con su caja de
layout.

**Sin hacer:** no se vio en pantalla. Si la barra se pliega a mitad del vuelo, la copia aterriza donde estaba la estrella
(son 0,2 s).

Vive en: app/_chat/MakoEnLaTab.tsx · app/_chat/borde-barra.ts · tests/estrella-al-lado-de-la-barra.test.ts.

**Capturas ANTES y DESPUÉS de una pantalla sin levantar la app, con los mismos datos (25/10/2026, Settings).** El banco de
la ficha (24/10, docs/hallazgos-crm.md) arma los componentes REALES con esbuild y APIs simuladas. Para el «antes» no hace
falta otro worktree: un plugin `onLoad` de esbuild que, para cada archivo que cambió la rama (`git diff --name-only <base>
HEAD`), devuelve `git show <base>:<ruta>` en vez del archivo del disco, y el MISMO mock de `fetch`. Así el antes y el después
muestran los mismos datos, y la diferencia es sólo la pantalla. Trampas: (1) un módulo de `lib/` que lee `process.env` deja
la página EN BLANCO sin un error a la vista (en la consola: «process is not defined»); un `window.process = { env: {} }`
antes del bundle lo destraba; (2) el CSS viejo también va por `git show` (si no, el antes sale con el CSS nuevo); (3) las
acciones `'use server'` se cambian por stubs por nombre de archivo (`negocio-actions`, `horario-actions`…), porque el bundle
del navegador no puede importarlas; (4) un `python` dentro de un heredoc de Bash pierde las barras invertidas (`\r?\n` llega
como un salto de línea de verdad): el script va a un archivo con la herramienta de escribir y se corre desde ahí.

## Sacarle las `secciones` a un ítem del nav le cambia las KEYS: el ítem único lleva la de su sección principal (29/10/2026, claude3)

- **Contexto:** Create sin pestañas arriba (docs/diseno-create.md). Lo obvio era borrar `secciones` de «Video» y dejar el
  ítem con su key de siempre, `video`.
- **Por qué estaba mal:** `itemsDe()` (nav.ts) APLANA: un ítem con secciones no existe con su key en `TODOS_LOS_ITEMS`;
  existen las de sus secciones. Las capas (`lib/capas.ts`, `navKeys` con 'video-editor'), la API (`gating.tab`), las
  funciones de MaKo (lib/funciones-mako.ts), las creaciones (`INFO_TIPO.nav`) y la puerta del teléfono (`puedeVerKey`)
  preguntan por la key de la SECCIÓN. Con `video` como key, nada se rompe en el server (`tabEnCapa` compara strings) pero
  el teléfono se cierra en silencio y los tests de funciones fallan.
- **Regla:** el ítem que queda lleva la key de la que era su sección principal ('video-editor', 'image-editor'). Una
  pantalla viva que deja de ser fila va a `SIN_FILA` con su key (el Video Generator, 29/10), nunca se borra el ítem.
  Lo fija tests/crear-pantalla.test.ts.

**Vive en:** app/_components/nav.ts (`itemsDe`, `SIN_FILA`, la familia Create) · tests/crear-pantalla.test.ts

## Un VALOR exportado por un módulo 'use client' llega al server como referencia de cliente (29/10/2026, claude3)

- **Síntoma:** `PantallaCrear.tsx` ('use client') re-exportaba `ESTILO_PAGINA_CREAR` para comodidad; una página server que lo
  pasaba al `style` de su `<Pagina>` recibía una referencia de cliente, no el objeto. Lo cazó el agente del Video Editor.
- **Regla:** los valores que usan las páginas server viven en un módulo SIN 'use client' (`app/_crear/reglas.ts`) y no se
  re-exportan desde el componente: sin el re-export, el import equivocado falla al compilar en vez de romper en silencio.
  (Es la misma frontera de AGENTS.md, «'use client' es una frontera de DATOS».)

**Vive en:** app/_crear/reglas.ts · app/_crear/PantallaCrear.tsx · tests/video-editor-sidebar.test.ts

## «Las plantillas son rectángulos»: no faltaban plantillas, la tarjeta no tenía dónde mostrar el ejemplo (29/10/2026)

- **Síntoma:** en las cinco tabs de Create, «Nuevo …» mostraba un marco gris con un nombre y un rótulo («15 s»).
- **El diagnóstico obvio era el equivocado:** «faltan plantillas». Copywriter ya tenía las estructuras, Video sus
  tiempos y huecos fijados por test, y Offer su agente.
- **Causa:** `PlantillaCrear` solo tiene `id | nombre | formato | imagen | rotulo`, y ninguna tab pasaba contenido. Video
  ni siquiera pasaba la miniatura que ya dibuja `MiniaturaPlantilla` en su pestaña Plantillas.
- **Regla:** una plantilla es la forma más un ejemplo completo de un negocio ficticio más la línea de «cuándo usarla», y
  la tarjeta dibuja ese ejemplo. Los campos se definen UNA vez en `app/_crear/reglas.ts`: `grupo`, `insignia`, `ayuda`,
  `ejemplo`, `extracto`, `chips`, `frase` y `video`. Son todos opcionales, porque `PantallaCrear` la comparten las cinco
  tabs y la que no los pasa se dibuja como hoy. Ninguna tab inventa otro nombre para lo mismo: cada parte del plan
  había propuesto el suyo (la «insignia» era a veces el tipo y a veces «Ejemplo»).

- **Hecho (tanda 0, 29/10/2026):** la tarjeta es `TarjetaPlantilla`. Elige, de lo más propio a lo más pobre: la
  `miniatura` de la tab, el `video` con el mouse encima, la hoja con el `extracto`, la imagen a su proporción y el marco
  de siempre. El rótulo y el primer mensaje del ejemplo salen de app/_crear/ejemplo.ts, iguales en las cinco tabs. Una
  tarjeta sin los campos nuevos se dibuja igual que antes, y el test lo prueba dibujándola.

**Vive en:** app/_crear/reglas.ts · app/_crear/TarjetaPlantilla.tsx · app/_crear/ejemplo.ts · tests/crear-pantalla.test.ts

## La tarjeta recorta todo lo que no es 4:3 (29/10/2026)

- **Síntoma:** con una miniatura real, a una historia 9:16 solo se le vería el tercio del medio.
- **Causa:** `.cr-plantilla__mini img` usa `object-fit: cover` (app/_crear/crear.css:106) dentro de la caja 4:3.
- **Regla:** la miniatura se dibuja a su proporción dentro de la caja (`cajaDeMiniatura(formato)`, `contain`). El
  recorte solo vale para piezas que ya son 4:3. Sin `formato`, la imagen llena la caja como antes.
- **La segunda trampa, al implementarlo:** con `height: 90%` y `aspect-ratio`, la historia salió como una FRANJA
  recortada, igual que antes.
  - **El diagnóstico obvio era el equivocado:** no era `object-fit`, que ya estaba en `contain`.
  - **Medido en el banco:** la `<img>` medía 648 px de alto en una caja de 155. La caja es una grilla con la fila `auto`,
    y esa fila crece hasta el alto NATURAL de la imagen (720 px). El 90 % se calculaba contra eso.
  - **Por qué el marco vacío no lo sufría:** no tiene tamaño propio, así que la fila se estiraba a la caja.
- **Regla:** una grilla que dimensiona a sus hijos con `%` necesita la fila del alto de la caja:
  `grid-template: minmax(0, 1fr) / minmax(0, 1fr)`.

**Vive en:** app/_crear/crear.css (`.cr-plantilla__mini`) · app/_crear/reglas.ts · tests/crear-pantalla.test.ts

## La hoja del ejemplo cede con SU tarjeta, no con la ventana (29/10/2026)

- **Síntoma (banco, a los cuatro anchos):**
  - a 1366, la insignia junto a «Ejemplo» quedaba «📣 Anuncio · 45…»;
  - en el teléfono, el último renglón del cuerpo quedaba partido por la mitad debajo de los chips.
- **Causa:** la grilla decide el ancho de la tarjeta. A 1366, con la tarjeta de MaKo, cada miniatura mide 188 px; en el
  teléfono, 155. Un `-webkit-line-clamp` fijo no sabe cuánto alto le queda.
- **Regla:**
  - la miniatura es `container-type: inline-size` y los renglones ceden con `@container`;
  - primero ceden renglones del cuerpo, y menos de 195 px esconde la insignia de la hoja (el nombre de abajo ya dice el
    formato);
  - el título, los chips y la cinta «Ejemplo» quedan siempre;
  - un chip que no entra se va entero (`flex-wrap` con el alto de una fila), nunca medio chip;
  - los renglones van en el CSS y no en un `style` del componente: el `style` le gana al `@container` sin avisar.
- **Para las tabs:** una insignia larga («Programa · alto ticket») igual se corta con «…» a 1440 (tiene su `title`).
  Conviene que no pase de 18 caracteres.

**Vive en:** app/_crear/crear.css · app/_crear/TarjetaPlantilla.tsx · capturas en C:/dev/revisiones/plantillas-tanda0/

## Lo que el experto de cada tab lee del negocio vive en un solo lugar (29/10/2026)

- **Síntoma:** el Copywriter leía el negocio con `construirCerebro()` entero, con la física del mapa, en cada pedido.
  Video e Image no lo leían.
- **Causa:** `contextoDelNegocio` vivía en lib/copywriter/contexto.ts, y su cabecera decía que `grafoParaChat` no había
  llegado. Llegó a main el 28/10 (`c272b97dd`).
- **Regla:**
  - el negocio y la voz de una pieza de Create se leen de lib/negocio-para-crear.ts: el grafo de los chats, en caché y
    sin física;
  - lib/copywriter/contexto.ts quedó como re-exportación, para los imports de siempre;
  - `vozDelNegocio` se re-exporta y no se muda: sus dos fuentes viven en lib/nutricion-generator.ts y mudarla armaba un
    ciclo;
  - ⚠️ `contextoDelNegocio` de lib/plan-senales.ts es OTRA función con el mismo nombre.

**Vive en:** lib/negocio-para-crear.ts · lib/copywriter/contexto.ts · tests/copywriter.test.ts

## Los nombres obvios para las funciones de la tarjeta ya existen (29/10/2026)

- **Síntoma posible:** un import automático trae la función equivocada, o `tsc` falla lejos de donde se tocó.
- **Causa:** el plan proponía `gruposDePlantillas(plantillas)` y `miniaturaDe(formato)` en app/_crear/reglas.ts.
  `gruposDePlantillas` ya existe en lib/copywriter/plantillas.ts:162, con otro tipo (la usa
  tests/copywriter-plantillas.test.ts), y `miniaturaDe` existe dos veces: app/crm/lead-view/ficha/galeria.ts:99 y
  lib/embeds.ts:665. Es la misma trampa que los dos `contextoDelNegocio` ([COPYWRITER]).
- **Regla:** antes de nombrar una función nueva, `git grep -n "<nombre>" origin/main`. Las de la tarjeta se llaman
  `seccionesDeCrear` y `cajaDeMiniatura`.

**Vive en:** app/_crear/reglas.ts · lib/copywriter/plantillas.ts · app/crm/lead-view/ficha/galeria.ts · lib/embeds.ts

## Un elenco único de negocios ficticios, y los nombres se verifican (29/10/2026)

- **Síntoma posible:** un ejemplo con un negocio real o con un cliente real (ya pasó: hay una lista `REALES` con
  «Martín», «Dental Ramos» y «Vértice»).
- **Regla:**
  - un solo elenco para las cinco tabs: Cierre Consultivo, Consulta Rentable, Pulso Dental, Torre Alameda y Voz de
    Líder, con sus clientes inventados;
  - los nombres se buscan en la web antes de publicar, **todos**, también los de segunda línea («Sonríe Studio» salió
    por genérico; «Desarrolladora Altavista» no estaba en la lista de la búsqueda y coincidía con una constructora y un
    desarrollo de Querétaro, así que salió; un dominio inventado puede existir: el ejemplo usa `example.com`);
  - `REALES` pasa a `tests/_reales.ts` y la usan los tests de las cinco tabs;
  - los datos de cada negocio son los mismos en todas las tabs: si una tab cambia uno, cambia en todas (ver la entrada
    de Offer sobre el marco). **Toda cifra que más de una tab repite va en la tabla del elenco** (README, 2.2). La
    revisión del 29/10 encontró, con la regla «solo las del elenco» ya escrita: tres mensualidades distintas para Torre
    Alameda, «31 clínicas» como total en Offer y como activas en Video, el embudo de una alumna contado como de
    Mariana, y cifras que no estaban en ningún lado («la cohorte se llenó en 6 días»).
  - **Escasez y garantías que el negocio no controla:** «14 de 96» en pantalla se lee «quedan 14» (quedan 46, y 14
    tienen vista), y «la vista no te la tapa nadie» promete algo que una desarrolladora no puede cumplir.

**Vive en:** docs/plantillas-reales/README.md (2.2) · tests/variables-aviso.test.ts · tests/_reales.ts (del plan)

## El guard de voseo no ve el texto que vive en .json (29/10/2026)

- **Síntoma posible:** un lienzo de Image con «Escribime» o «acá» pasa CI.
- **Causa:** `tests/puente-panel-copy.test.ts` recorre solo los `.ts` y `.tsx` (con `git ls-files`). Los ejemplos de
  Copywriter, Video, AI Avatar y Offer viven en `lib/` y los ve; el texto del lienzo de Image está en
  `app/image-editor/mako/plantillas/*.json`.
- **Regla:** todo ejemplo pasa `marcasDeVoseo`, y los que viven en `.json` tienen su propio test. En AI Avatar el guion
  hablado sigue el acento del negocio (`acentoEsVoseante`): ahí la guarda no se aplica a ciegas.
- **Tampoco ve regionalismos que no son voseo:** «darla vuelta» y «dé vuelta» (invertir, rioplatense) se colaron en
  Image y en el prompt `offer.experto`, que va a `lib/`. La lista de argentinismos del test de AI Avatar suma
  `\b(dar|da|dé|darla|darlo)\s+vuelta\b`; «darle la vuelta» es neutro.

**Vive en:** tests/puente-panel-copy.test.ts · tests/image-editor-plantillas-reales.test.ts (del plan)

## El QA visual de Create sin `next dev`: el banco, y la falsa alarma del scroll de costado (29/10/2026, claude3)

Para mirar TODAS las pantallas de Create a 1920/1440/1366/390 sin levantar la app (local escribe en producción) y sin
sesión en producción, un banco: las pantallas REALES compiladas con esbuild, datos inventados y `fetch` simulado. Vive en
la carpeta de notas compartidas del Cerebro, `banco-create-qa/` (build, entrada, capturador con medición, sonda). Lo que
costó, para la próxima:
- **Tailwind de verdad.** El editor de Video está hecho con clases de Tailwind: sin compilarlo sale sin estilos.
  `@tailwindcss/postcss` sobre app/globals.css con `base` en el worktree (~2 min, escanea el repo).
- **La falsa alarma.** La primera medición dio el documento 58 px más ancho que la ventana en TODAS las pantallas: el banco
  ponía la <Pagina> al lado de la sidebar, y en app/layout.tsx va adentro de una COLUMNA (`flex: 1; min-width: 0`). Con
  `flex: 'none'` (ESTILO_PAGINA_CREAR) + el `width: 100%` de Pagina, sin esa columna se pasa por el ancho de la sidebar.
  En la app no pasa. El armado del banco copia la columna.
- **El `fetch` simulado se tragaba lo estático**: el motor del Video Editor (/ve/wasm/…) daba 404. Lo que tiene extensión
  va al servidor de verdad.
- **El capturador MIDE, no sólo fotografía**: rótulos con «…» (`text-overflow: ellipsis` y `scrollWidth > clientWidth`),
  botones que se pisan, el ancho de la tarjeta y del centro. Así salió «Páginas 1 / 1» pisado con la cuadrícula a 1366.

## La tarjeta de MaKo se pliega en los editores: un contexto y no un prop en cada chat (29/10/2026, claude3)

El botón de plegar tenía que estar en la cabecera de TRES chats distintos (el Cerebro, el del Video Editor y el del Image
Editor), cada uno con su `cabecera`. En vez de tocar los tres, `PlegarChatCtx` (app/admin/operaciones/PanelChat.tsx): la
pantalla de Create lo provee y `CabeceraDeChat` dibuja el botón a la derecha si existe. Fuera de Create es `null` y la
cabecera queda igual (lo prueba el test dibujándola con y sin el contexto). Plegada, la tarjeta queda MONTADA con `hidden`
(el hilo y lo escrito siguen). ⚠️ `.cr-tarjeta { display: flex }` le gana al `[hidden]` del navegador: sin
`.cr-tarjeta[hidden] { display: none }` «plegada» no escondía nada. Se recuerda por tab (`mk-crear-plegada:<tab>`), con
`useSyncExternalStore` como la sidebar; en el teléfono no se pliega (ya se ve una cosa por vez).

## La guía de cada pestaña: el velo con huecos, y por qué no es el del recorrido (29/10/2026, claude3)

El núcleo de docs/mako-iniciativa/guia.md (G1): lib/guia/ (tipos, reglas, huecos, la primera vez, el índice de catálogos),
app/_ui/guia/ (el estado, `VeloGuia` montado una vez en app/layout.tsx, `useGuiaDeLaTab`, `ancla()`), app/_ui/useVisto.ts y el
primer catálogo, app/second-brain/guia-ops-center.ts. Reemplaza al recorrido `sb-inicio` (recorrido-inicio.ts y su test, borrados).
- **El velo del recorrido no servía para «con el chat a la vista».** `box-shadow 200vmax` da UN hueco: tapaba el chat. Y el de
  `Senalar` se apagaba con la primera tecla, también la que se escribía en el chat. El nuevo es una máscara SVG con huecos (el
  ancla y cada `[data-mako-chat]`) y `pointer-events: none`: el toque lo decide `queHacerConElToque` (en el ancla avanza, en el
  chat nada, en otra parte de la tab pausa; el toque llega igual).
- **Fuera de la pila de modales.** Registrado como capa, la estrella del Plan y de Clientes se subiría como sobre un modal y
  `profundidadModales()` diría que hay uno. Va en el piso de los recorridos (400), debajo del toast y del «¿seguro?».
- **El velo es `--scrim` (40%), no `--sidebar`**: en el tema candidato `true-north` `--sidebar` es claro y el velo aclararía. Y sin
  `color-mix`: en Safari < 16.2 borra la capa entera.
- **La pregunta es la frase de Martín**, «¿Quieres que te ayude a aprender a usar esta pestaña?», con [Sí, enséñame ★], los
  objetivos y [Ya sé usarla]. Rompe `PREGUNTA_DE_ACCION` a propósito: la excepción es por su id (`guia:*`), con el porqué en
  lib/aperturas/reglas.ts (decisión del Cerebro, docs/mako-iniciativa/README.md).
- **La guía va primero** (la primera vez en la pestaña): mientras decide si pregunta (`esperando`), la escalera del Cerebro calla;
  si no, la apertura salía y a los 1,2 s la pisaba la pregunta, y quedaba «vista» de hoy sin que nadie la leyera.
- **El Ops Center del super admin no tiene guía ni «?»**: su hilo es el de Claude Code, donde MaKo no habla.
- **SIN HACER:** G2 (lib/onboarding-arranque.ts → `rutaDelHilo` sigue poniendo `?recorrido=sb-inicio`: ya no abre nada, se
  ignora); los catálogos de cada tab (G3 a G6: `SIN_GUIA_TODAVIA` de tests/guia-catalogo.test.ts es la lista, y sólo se achica);
  la IA que señala (G4: `senalar_en_pantalla`, el prompt `mako.senalar`); el teléfono (G7); borrar `Recorrido.tsx` y `Senalar.tsx`
  cuando nadie los use (G8: hasta entonces `useVisto` y `useRecorrido` leen lo mismo por dos caminos); mudar `DONDE` de
  app/automations/recorrido-automations.ts a lib/guia/donde.ts (con la guía de Automations: cinco tests lo leen ahí). **Nada se vio
  en el navegador**: falta el recorrido a 1440 y a 700 px con una persona nueva del ws3 (guia.md §6).

---

## Barrer botones muertos: 74 hallazgos, 73 eran mentira (2/11/2026)

**El pedido.** Martín, después de mostrárselo a Emilio en la staff: «siempre quiero poder apretar
en todos los botones, que anden todos los botones». Un botón que se ve apretable y no hace nada
es peor que no tenerlo: en una demo se aprieta, y el que mira concluye que la app está rota.

**El diagnóstico obvio era el equivocado.** La primera pasada —`<button>` sin `onClick`— devolvió
**74 botones en 52 archivos**, y pareció un problema enorme. Después de triar: **uno solo estaba
muerto de verdad.** Las cuatro fuentes de ruido, que son el hallazgo:

1. **El `<button>` dibujado en un comentario de documentación.** Casi todo componente base tiene
   uno. Solo este caso eran ~50 de los 74. Los comentarios se **blanquean** (se reemplazan por
   espacios, no se borran: así las líneas no se corren y el error señala la línea de verdad).
2. **El disparador que recibe el handler del envoltorio.** `<DropdownMenuTrigger asChild>` y
   `<PopoverTrigger asChild>` de Radix clonan al hijo y le meten el `onClick`; nuestro `<Tooltip>`
   (`app/_ui/Tooltip.tsx`) pone `onMouseEnter` y `onFocus` en su propio span. El botón de adentro
   no tiene nada y anda igual. Todo el video-editor caía acá.
3. **El `disabled` de adentro de una expresión.** `disabled={disabled || loading}` y
   `cursor: disabled ? …` tienen la palabra sin ser un botón apagado a mano.
4. **El primitivo que esparce las props del padre** (`{...rest}`).

**La trampa dentro de la trampa, y es de regex:** al pelar las expresiones JSX, lo que se pone en
lugar de `{…}` **no puede tener llaves**. Reemplazar por `{}` vuelve a matchear contra sí mismo, el
bucle corta en la segunda vuelta creyendo que ya no cambia nada, y un `style={{ … }}` con un
`` `…${x}` `` adentro queda sin colapsar. Así `app/agencia/FlujoAviso.tsx` aparecía como «apagado a
mano» teniendo `disabled={disabled}`. Se reemplaza por un espacio.

**El único muerto de verdad:** `app/web-generator/editor/paneles/EstiloSeccion.tsx` — la muestra
del **color propio** (el que no está en la paleta) era la única de su fila sin `onClick`. Después de
tocar otro color ya no se podía volver al propio: se veía elegible y no lo era.

**Y uno que parece muerto y no lo está:** el «Cancelar» de `app/_components/Lienzo.tsx`, en el modo
«conectar a una tarjeta». Lo atiende un `pointerdown` en **captura sobre `window`**, que se lo traga
antes de que llegue al botón. Un `onClick` ahí sería código muerto. Está en la lista de perdonados
del guard, con el motivo.

**La regla que queda:** no alcanza con buscar `onClick`. Un botón está vivo si tiene un handler
**suyo o de su envoltorio**, o es `type="submit"`, o está apagado a propósito **y dice por qué** con
un `title`/`aria-label`. Lo vigila `tests/ningun-boton-muerto.test.ts` (probado rompiéndolo), que
además afirma que miró más de 400 botones: un guard que deja de encontrar no se nota.

**Y una de celular:** `onFocus` solo alcanza. En el teléfono el tap da foco, así que un control que
abre con `onMouseEnter`+`onFocus` —el ⓘ de `app/automations/FilasOpciones.tsx`, las barras de
`app/partners/BarrasPorMes.tsx`— **sí responde al tacto**. Con `onMouseEnter` solo, no.

**Vive en:** tests/ningun-boton-muerto.test.ts · app/_ui/Tooltip.tsx ·
app/web-generator/editor/paneles/EstiloSeccion.tsx
