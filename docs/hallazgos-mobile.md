# Hallazgos — MaKo Mobile (/m, la PWA del teléfono)

Lo que no se ve leyendo el código de `app/m/`, `lib/movil-*`, `lib/push*`, `lib/mako-turno-app*`,
`public/sw.js` y las extracciones que comparte con escritorio. Las decisiones y la spec están en
[diseno-mako-mobile.md](diseno-mako-mobile.md); el pedido textual, en `/admin/dev/mako-mobile`.
Corridas del 11/10/2026: la v1 (relevo de 7 agentes + 11 de implementación + 1 revisión adversarial),
el diseño v2 a la tarde, y a la noche la implementación v2 (12 agentes + la integración) con el desvío
de teléfonos PRENDIDO. Lo de la v2 está en su propia sección, más abajo.

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
  contra `innerWidth`, no la captura. **Vive en:** docs/prototipos/mako-mobile-v2.html

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
- La pantalla de la cuenta se titula «Perfil» (como escritorio) y el prototipo dice «Cuenta»:
  `TITULO_CUENTA` en app/m/_ui/cabecera.ts, si Martín lo prefiere.
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
- **Al soltar la nota de voz, el mensaje se manda solo, y en WhatsApp la regla de la casa dice «nada sale al soltar».** → No es una contradicción. La regla de WhatsApp protege un AUDIO que le llega a una persona. Acá lo que viaja es la transcripción, a MaKo, que sólo propone: toda acción se confirma en su tarjeta. · app/m/mako/Composer.tsx (comentario de cabecera) · REGLA: Si un día la nota de voz del chat sale como audio hacia afuera (a un lead o a un grupo), vuelve a valer «nada sale al soltar». Martín no lo confirmó: es una decisión de producto abierta.
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
