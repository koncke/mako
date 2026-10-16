# Relevo — MaKo Mobile

<sub>Escrito por el chat «MaKo Mobile» (cuenta 3) el 11/10/2026 a las 15:00, al cruzar el 85% de uso
semanal. Material de primera mano: lo hizo este chat.</sub>

## 16/10/2026 (cuenta 3) — MORE COMPLETO, TANDA 2 DE 3: Second Brain, Experiments y Offer (SIN COMMIT)

Misma rama (`movil-more-9`, en `C:/dev/wt-mobile`); el orquestador commitea por ruta y otra sesión pushea.

**Lo que quedó en el worktree, sin commitear:**
- **Second Brain** (app/m/second-brain, Obsidian y Notion en el teléfono): buscar (también con MaKo), el mapa en
  chico, «Tu negocio» con sus carpetas, cada área y cada dato en una hoja, y subirle al Archivero archivos, fotos o una
  web. Las reglas que comparte con escritorio salieron de Grafo.tsx y Archivero.tsx a lib/cerebro-areas.ts y
  lib/archivero-subida.ts, y escritorio ya las importa.
- **Experiments** (app/m/experimentos): Retro · Experiments · Conclusions · Análisis en `?tab=`, decidir el plan de una
  Retro con Deshacer, cerrar, iniciar o descartar un experimento, el alta con MaKo y el Análisis con sus tres rangos.
  El formato de los números se mudó a lib/experimentos-formato.ts.
- **Offer** (app/m/offer, la app de ChatGPT): el chat entero (texto, links, documentos, nota de voz), armar y bajar el
  PDF, guardar en el funnel y «Probarlo». Los grupos de piezas pasaron a app/offer/ayudas.ts.
- **Escritorio, un bug arreglado**: Offer borraba de Storage la nota de voz que SÍ se mandó y dejaba de sonar
  (app/offer/OfferApp.tsx, `enviarAudio`; hallazgos-offer.md).

**Verificado:** tsc acotado de la rama en 0 (80 archivos); los tests de la tanda y de las pantallas de /m, los guards
y los de escritorio tocados, verdes. `movil-mas-secciones` falla A PROPÓSITO (6/1) con las tres de la tanda 3, y el
guard de voseo (`puente-panel-copy`) falla 8/1 por VistaAfuera.tsx:201, que ya está arreglado en main.

**Lo que falta, en orden:**
1. **Tanda 3:** Copywriting, Curso y Comunidad. ⚠️ El mapa sigue sin poder pushearse sin ellas (404 en todo teléfono).
2. Al rebasar sobre main: el chip de un adjunto del teléfono no muestra `notaDelAdjunto` (f4ed5e069), y Archivero.tsx
   conserva su `urlDelLink`.
3. Mirar las tres pantallas a 390 px y en un teléfono (nada se vio); lo pendiente de cada una, con su archivo, en
   hallazgos-mobile.md → «Las pantallas de More que faltaban» → «Tanda 2».

## 15/10/2026 ~21:55 (cuenta 3) — MORE COMPLETO, TANDA 1 DE 3: el mapa, Calendario, Avisos y Tu cuenta (SIN COMMIT)

Pedido de Martín (14/10): «Implementá TODAS las tabs que construimos, todo». Se trabaja en `C:/dev/wt-mobile`, rama
`movil-more-9` (salió de origin/main c4ef8a68e); el orquestador commitea por ruta y otra sesión pushea.

**Lo que quedó en el worktree, sin commitear:**
- **El mapa:** `SECCIONES_MAS` pasa de 7 a 14 secciones, en el orden de la sidebar, con su vuelta en `rutaEscritorio`
  y la query de cada página de escritorio (`QUERY_DE_SECCION`). Copywriting se titula «Ads Writer» y Offer es pantalla
  de trabajo.
- **Calendario** (app/m/calendario, copia de Google Calendar): Día · Agenda, crear con el «+», marcar hecho, borrar con
  Deshacer. Lo que comparte con escritorio se mudó a app/calendario/comun.ts.
- **Avisos** (la campana de General, app/m/inbox): se titula «Avisos» como en el v3 (`TITULO_INBOX`, en los ocho
  lugares donde decía «Inbox»), con los rótulos de los botones de escritorio.
- **Tu cuenta** (app/m/cuenta, copia de la cuenta de Google): las secciones de la computadora en su orden, el modo
  oscuro, los avisos del teléfono. Refrescar ahora trae lo nuevo.
- El placeholder de Información personal ya no es un cliente real (app/perfil/InformacionPersonal.tsx).

**Verificado:** tsc acotado contra `HEAD` en 0 (50 archivos más lo que importan); los tests de la tanda y los
guards, verdes; `tests/movil-mas-secciones.test.ts` falla A PROPÓSITO (6/1) nombrando las seis páginas que faltan.

**Lo que falta, en orden:**
1. **Tandas 2 y 3:** Second Brain, Experiments, Offer, Copywriting, Curso y Comunidad. ⚠️ **El mapa no se pushea sin
   ellas**: con `MOVIL_ACTIVO` prendido, /second-brain, /offer, /experimentos… darían 404 en todo teléfono.
2. Mirar las pantallas en un navegador a 390 px y en un teléfono (nada se vio: sin next dev ni Chrome).
3. Lo que quedó sin hacer de la tanda 1, con su archivo, en hallazgos-mobile.md → «Las pantallas de More que faltaban».

## 🆕🆕🆕 14/10/2026 ~21:00 (cuenta 1) — TANDA 1 DEL v3 EN CÓDIGO (Martín: «que lo pushee así por ahora»)

Martín aprobó el v3 («está mucho mejor, sigo teniendo feedback») y pidió pushear sin esperar al resto. Tres commits:

1. **104a26209 (en main)**:
   - la barra CRM · Chats · General · Plan · More, con General al medio y como portada;
   - General dibuja la hoja de General de escritorio, bloque por bloque (app/m/hoy/GeneralM.tsx), con la campana de
     Inbox en el encabezado;
   - More agrupado por las familias de la sidebar;
   - Chats lee WhatsApp con «Sin responder» (app/m/chats).
2. **5e4bed65d**:
   - el tablero común `KanbanM` (app/m/_ui);
   - el CRM pasa a ser el tablero del funnel, con selector y lupa (se borró la lista Hoy · Por responder · Nuevos);
   - Clientes también pasa a tablero.
3. **c2f6863a0**: el Plan con Prioridades · Tareas · Proyectos · Recurrentes. Tareas y Proyectos son tableros por
   prioridad que NO mueven tarjetas.

Los pushes 2 y 3 rebotaron por RAM (el vigía mata el tsc). Los pushea «Estrategia 3 cuentas» con el vigía pausado:
mirar `git log origin/main` antes de dar nada por subido.

**Lo que sigue**, con detalle en hallazgos-mobile.md, «La tanda 1 del v3 en código»:
- las 9 pantallas de More que faltan;
- Chats unificados, cuando lleguen a main;
- mirarlo en un teléfono de verdad;
- el feedback que Martín dijo que todavía tiene.

## 🆕🆕 14/10/2026 ~18:00 (cuenta 1) — PROTOTIPO v3 con el feedback de Martín, y el relevamiento de las tiendas

Martín rechazó el v1 por siete puntos (relevados por «Estrategia 3 cuentas»): sin referencias; el CRM no lleva «Hoy»;
General tiene que ser ÉPICA y todo tenía demasiado texto; faltaba la tab **Chats** (todos los chats juntos); el Plan no
se cambia (destilar el escritorio, no rediseñar); More no seguía las familias de la sidebar y la mitad no estaba
diseñada; el ícono del medio de la barra es General y es la que abre. **El v3 los resuelve los siete**, en el MISMO link
(https://claude.ai/artifact/XchrEDjJiTajd9Hq8nhAi8, versión 2; archivo docs/prototipos/mako-mobile-tableros.html):
barra CRM · Chats · General · Plan · More; cada una de las 14 pantallas de More sale del relevamiento de su tab de
escritorio (vistas, orden y rótulos reales); Chats sigue el diseño de escritorio que está SIN COMMITEAR en
`C:/dev/wt-chats` (la rama `chats-1410` no tiene commits). Las referencias van en el costado del prototipo. La regla
quedó en AGENTS.md («EL TELÉFONO DESTILA EL ESCRITORIO»). **Espera su OK; la tanda 1 de código NO empezó.**

**Tiendas (encargo nuevo, sólo relevado):** Play por TWA (Bubblewrap) y App Store por Capacitor. Lo que frena, en
hallazgos-mobile.md: `/.well-known` bloqueado por el proxy, el login de Google bloqueado en WKWebView, el Web Push que no
anda en iOS empaquetado, el borrado de cuenta que falta, Sign in with Apple vs. invitaciones, y la prueba de 12 testers
× 14 días de Play con cuenta personal. Lo que hace Martín: elegir titular (persona u organización con D-U-N-S), abrir
las dos cuentas (US$25 y US$99/año), conseguir Mac o compilación en la nube y 15-20 testers con Android.

## 🆕 14/10/2026 ~16:30 (cuenta 1) — PEDIDO NUEVO: TODAS las tabs y TODOS los kanban en el teléfono. Plan propuesto, SIN código todavía

Pedido de Martín, relevado por «Estrategia 3 cuentas» (textual en lo que importa): «Implementá TODAS las tabs que
construimos, todo» · «quiero que TODOS los kanban que hay en MaKo se vean en mobile de alguna forma» (CRM, Customer
Success y Plan; «de alguna forma» queda a criterio) · «agarrá referencias de otras apps… Preocupate MUCHO por el diseño»
(skills `thumb-first`, `thumb-first-design`, `mobile-native`, en `.claude/skills/`) · la publicación
https://www.instagram.com/p/DeBds9diCoY/ (de @junaid_jamel, «How to Avoid Overbuilding Your App»: «Build what matters
now. Let the product earn the rest». Sin sesión sólo se lee la portada y el texto; las demás láminas no).

**Medido en `origin/main` (ab2641963):** LAS MISMAS RUTAS ya están (7b82bcde), `MOVIL_ACTIVO = true`, 21 páginas en
`app/m`. Tienen teléfono: Today, CRM (lista + ficha + chat), Plan (Hoy · Semana · Prioridades), Inbox, More, Dashboard
(una pantalla PROPIA, no las hojas que se arman en el editor), Ads Manager, Customer Success (la entrega como lista
agrupada), Automations, Video Generator, Landing Generator, MaKo y Cuenta. **Sin teléfono, construidas y visibles para
clientes:** General (en el teléfono es Today, que no lee el informe de General), Calendario, WhatsApp, Email, Second
Brain, Experiments, Offer, Ads Writer, Curso y Comunidad. Sólo super admin: Video Editor, Image Editor, Reels, Carousels,
Stories, Agencia, Mensajes, Conocimientos. Ningún kanban se ve como tablero: CRM y CS son listas, Plan no tiene tablero.

**Plan propuesto (espera el OK de Martín):**
1. Un patrón de tablero para los tres (`KanbanM` en `app/m/_ui`): una columna por pantalla con la siguiente asomando
   (scroll-snap), arriba el riel de etapas con su conteo, mover con mantener apretado → barra de destinos abajo, y
   «Mover a…» en el sheet como salida visible, con Deshacer por el mismo camino del server. Referencias: Pipedrive,
   Trello, Linear y HubSpot en el teléfono. CRM: segmentado «Hoy | Tablero»; CS: tablero por etapa de entrega y
   segmentado por producto; Plan: «Tablero» con las bandas de prioridad.
2. General en el teléfono = el informe de General en la pila del celular (los mismos bloques del editor), y Dashboard =
   las hojas reales en pila, no la pantalla propia de hoy.
3. Cada tab que falta, con UNA acción clara en el teléfono y el resto «en la computadora»: WhatsApp (copia de WhatsApp),
   Calendario (copia de Google Calendar: Programación + Día + crear), Comunidad (copia de la app de Skool), Offer (el
   chat y el PDF), Email (números y pausar/mandar), Ads Writer (pedir dictando y copiar), Second Brain (buscar y
   capturar), Experiments (estado y registrar resultado), Curso (módulos, publicar/ocultar, avance).
4. Tandas: (1) kanbans + General + Dashboard → (2) WhatsApp, Calendario, Comunidad, Offer → (3) Email, Ads Writer,
   Second Brain, Experiments, Curso → (4) las de super admin.
5. Antes del código, un prototipo HTML del tablero en los tres y de General, para mirarlo en el teléfono.

**HECHO el prototipo (14/10 ~16:20), ESPERANDO A MARTÍN:** `docs/prototipos/mako-mobile-tableros.html`, publicado privado
en https://claude.ai/artifact/XchrEDjJiTajd9Hq8nhAi8 (`#crm-tablero`, `#crm-mover`, `#crm-deshacer`, `#cs`,
`#plan-tablero`, `#general` abren cada estado). Pasó por `thumb-first-design` (auditoría) y `mobile-native`, y se miró a
390 px en Chrome headless. Lo que cambió por esas pasadas: zonas de toque de 44 (barra de etapas, selector, «Marcar
cobrada»), la barra lleva el CONTEO de cada etapa (dónde está la gente sin recorrer las columnas, la objeción de NN/g al
carrusel), el conteo de la etapa destino late al mover (a dónde fue la tarjeta), la tarjeta casi no se levanta al
mantenerla (un menú, no un arrastre que después no sigue al dedo), y `-webkit-touch-callout: none` en todos los controles.

**Recortado con la lente de la publicación («no construir de más»):** sin arrastrar tarjetas con el dedo (mantener →
«Mover a…» y el detalle alcanzan, y no se rompen); un solo patrón para los tres tableros con un selector a la izquierda
(funnel, producto o Tareas/Proyectos), en vez de tres diseños; Ads Writer, Reels, Carousels y Stories comparten una
pantalla de «pedir y copiar»; el Video Editor y el Image Editor NO van al teléfono (se quedan con «se usa en la
computadora»); Second Brain sólo busca y captura; Email sólo números y pausar.

**Decisiones del diseño que puede querer cambiar (forks):** el CRM abre en «Hoy» y no en «Tablero» (escritorio abre en
el kanban); una columna por pantalla y no dos angostas; mover con un menú y no arrastrando.

## ⚠️⚠️⚠️⚠️⚠️⚠️ 13/10 (cuenta 2) — LAS MISMAS RUTAS, HECHO; el CRM que abría vacío y un script roto en producción

Retomado por pedido de Martín («En la cuenta 3 quedaron muchos pendientes… dile a esos chats que continuen y cierren lo
que ya habiamos planificado»). En la rama `mobile-mismas-rutas` del worktree `.claude/worktrees/wt-mobile`; si ya está
en `main` lo dice `git log --oneline -5 -- proxy.ts`.

- **LAS MISMAS RUTAS:** el teléfono abre /crm, /general, /plan… y el proxy le sirve /m en esa URL (rewrite); una URL /m
  vieja redirige a la de escritorio; los links de /m salen traducidos por `conWs`. Las pantallas sólo del teléfono
  tienen URL propia: /mas, /configurar, /perfil/instalar, /crm/<id>/chat. Detalle: docs/hallazgos-mobile.md → «LAS MISMAS
  RUTAS». Verificado con tests (incluido el proxy de verdad con UA de iPhone). **NO mirado en un navegador**: la máquina
  estuvo con 0,5-2 GB libres toda la sesión, sin lugar para un `next dev` ni para el typecheck (el vigía lo mató).
- **«El CRM no funciona»: medido en producción** (ws9, sólo leyendo): abría «Nada pendiente por hoy.» con 13 leads. Ahora,
  sin nada pendiente, muestra las etapas con su conteo. La ficha, el filtro y el chat se dibujaron bien.
- **Un SyntaxError en cada página de /m** (el script del tema, roto por el minificador del build): arreglado y con guard.
- ⚠️ **EL TYPECHECK NO CORRIÓ** (14/10, cierre pedido por Martín). Dos intentos: al primero lo mató el vigía de RAM;
  el segundo se quedó sin heap, porque el lock lo larga con 2 GB (`CAP_HEAP_MB = 2048`, un cambio SIN COMMITEAR de
  «Fallas en la PC» en `scripts/typecheck-lock.mjs` del clon). Lo que sí está en verde: los tests de todo lo tocado
  (movil-*, m-*, push, links con ws, alumno-sesion, layout-sin-suspense, titulo, crm-tablero: 300+). **Antes de pushear
  esta rama, el typecheck tiene que pasar.** Archivos tocados: `proxy.ts`, `lib/movil-rutas.ts`, `lib/movil-desvio.ts`,
  `lib/ws-tab.ts`, `lib/push-payload.ts`, `app/_components/{VistaMovil,DesvioMovil,PublicRouteGate,NotificationsProvider,
  MakoConfirmGate,AvisoPixelViejo,TituloTab,TemaOscuroScript}.tsx`, `app/layout.tsx`, `app/inicio/page.tsx`,
  `app/manifest.ts`, `public/sw.js`, `app/m/_ui/{ShellM.tsx,tema.ts}`, `app/m/crm/ListaCrm.tsx`,
  `app/m/dashboard/DashboardM.tsx`, y los tests `tests/movil-mismas-rutas.test.ts` y `tests/minificador-templates.test.ts`.
- **Lo que mirar primero, con el deploy:** en un teléfono, /crm, /general, una ficha (/crm/<id>) y More (/mas): que se vea
  la versión del teléfono con la URL de escritorio, y que la computadora siga igual en esas mismas URLs.
- **Sigue sin hacer:** probar en un iPhone y un Android reales (la ficha: agendar, mover, dictar; el chat con PDF; la
  franja de la barra de estado; instalar; los avisos). Y dos decisiones de Martín: el título «Perfil» o «Cuenta», y si
  desde el teléfono se gastan créditos de Flow.

## ✅ 12/10, 09:26 — LAS MISMAS RUTAS (pedido de Martín) — HECHO el 13/10, ver arriba

Martín, textual, mirando /m/hoy en su celular: «de igual manera esta mal porque se ve muy chiquito todo,
no como una app de celular... Y sobre todo lo que esta mal es que funcione por rutas, eso no debe ser
así... Las rutas deben ser las mismas, solo debe detectar si estoy en mobile». Y: «hay cosas que no
funcionan, como el CRM...» (sin detalle todavía).

- **Lo «muy chiquito»** de sus dos capturas (/general de la cuenta de Mauricio y /m/hoy) es Chrome en
  «Sitio para computadoras»: las dos se dibujan a ~980 px de ancho (la barra lateral ocupa ¼ de la
  pantalla; la columna de /m queda al medio), y la meta `width=device-width` de /m SÍ está en producción.
  En ese modo Chrome también manda un UA de escritorio, así que `prefiereMovil` dice que no — con
  cualquier cuenta. Él contestó «No estaba tildado, ahí me saltó el problema»: confirmar en
  Configuración → Configuración de sitios → «Sitio para computadoras» (el global) y la excepción de
  hola-mako.com.
- **LAS MISMAS RUTAS (decisión suya, no se rediscute):** el teléfono abre /crm, /general, /plan… con las
  MISMAS URLs que la computadora, y se ve la versión móvil. Plan: en `proxy.ts`, un pedido de página de
  un teléfono (UA + sin la cookie de «Versión completa», lo mismo que `prefiereMovil`) cuya ruta tiene
  equivalente (`rutaMovil`) se REESCRIBE (`NextResponse.rewrite`, no redirect) a la página de /m; y todo
  href de /m pasa a apuntar a la ruta de escritorio (una función inversa de `rutaMovil`, en
  lib/movil-rutas.ts, y los `href` de DESTINOS_MOVIL / SECCIONES_MAS y de cada pantalla). /m/* queda
  sólo como la carpeta interna. Ojo: el proxy es el choke point de seguridad (AGENTS.md) — el rewrite va
  DESPUÉS de los chequeos de sesión y nunca para /api ni lo público; y `DesvioMovil` deja de navegar
  (la cubierta «se usa en la computadora» sigue para las rutas sin equivalente).
- Se frenó al 90 % de uso semanal de la cuenta 3: no se arrancó.

## ⚠️⚠️⚠️⚠️ 12/10, mañana: Martín seguía viendo el escritorio en el celular — ARREGLADO

«No aún no veo la versión mobile, me sale todo igual...». Causa: la integración había dejado FUERA del
desvío al admin global sin cliente (`adminSinCliente`, para cortar un bucle), y ese admin es él cuando
entra sin mirar a un cliente. Ahora va a /m de SU negocio (`?ws=` de la plataforma, `wsSuperAdmin`):
`requireMovil` ya no lo manda a /inicio, el desvío le pone el `?ws=` (`destinoMovil`), /inicio en el
teléfono lo manda a /m y en lo suyo no ve la píldora de cliente. Detalle y por qué ninguna
verificación lo vio: docs/hallazgos-mobile.md → «Y armaba un BUCLE…». **Falta que él lo confirme en
su celular** (si había tocado «Versión completa», esa cookie dura 12 h).

## ⚠️⚠️⚠️ DÓNDE QUEDÓ (12/10, madrugada) — LEER ESTO PRIMERO

**La v2 está en `main` y PRENDIDA** (`MOVIL_ACTIVO = true`): cualquier celular con sesión que abra MaKo cae
en /m. Es lo que Martín pidió el 11/10 a las 21:54: «Entré desde mi celular a la web de MaKo y no se ven los
cambios... No solamente tienes que hacerlo como "app" sino a cualquiera que entre desde mobile le debe salir
este diseño». Se hizo en el worktree `.claude/worktrees/wt-mobile` (rebasado sobre la undécima de Automations).

- Hecho: Today, Inbox, CRM (lista, ficha, chat), Plan, More, Dashboard, Ads Manager, Customer Success,
  Automations (UNA lista, como la undécima), Video, Landing, MaKo (con la vista previa de adjuntos de Offer)
  y Cuenta, sobre el prototipo y con datos reales. Las 3 preguntas del diseño, por default (lo conservador):
  docs/diseno-mako-mobile-v2.md.
- Verificado: typecheck en cero, 8379/8383 tests (los 2 rojos que quedan, `mover-etapa-validacion` y
  `plan-filtro-cliente`, ya fallaban en main y leen archivos que esto no toca), `next build` verde con las 21
  rutas de /m, y 13 pantallas miradas a 390 px con UA de iPhone (ws 9 y el CRM del ws 1, sólo leyendo): sin
  desborde y sin errores de la app. `/plan/agencia` en un teléfono lleva a `/m/plan`, `/integraciones` dice
  «se usa en la computadora». **La ficha de un lead NO se pudo mirar** (el dev server muere de memoria al
  compilarla en esta máquina; el build sí la compila).
- **Lo que falta, en un iPhone y un Android reales:** la ficha (agendar, mover de etapa, dictar), el chat de
  MaKo con la vista previa de un PDF, la franja de la barra de estado con `statusBarStyle: default`, instalar
  y los avisos. Si algo sale mal para un cliente: `MOVIL_ACTIVO = false` en lib/movil-desvio.ts y deploy.
- Lo que el prototipo dibuja y el teléfono no hace, y por qué: docs/hallazgos-mobile.md → «Lo que quedó sin
  hacer». Lo que Martín tiene que decidir: el título «Perfil» o «Cuenta», y si el teléfono puede gastar
  créditos de Flow o mostrar propuestas de MaKo en Ads Manager.

## ⚠️⚠️ EL REDISEÑO PEDIDO (11/10, ~16:30) — ESTO MANDA SOBRE TODO LO DE ABAJO

Martín vio /m en producción (recorrida a ancho de teléfono, las seis tabs andan) y la RECHAZÓ, textual:
«Todo eso se ve bastante mal... Ese no es el icono de MaKo... Tampoco quiero que ese icono tenga tanto
protagonismo... MaKo no es una app de un chat con una IA... Decidiste sacar muchas cosas que tal vez si
sería bueno tenerlas... Pusiste por defecto blackmode, cuando por defecto es white mode. Hay una cantidad
de texto en esas capturas, y otros que estan flotando... No se ve para nada como lo que es MaKo, se ve
bastante feo.»

Y contestó (decisiones, no se rediscuten):
- **Estilo: «Estilo app nativa, pero sin perder el diseño que ya hicimos en MaKo».** Estructura de app de
  iPhone (títulos grandes, listas agrupadas, sheets) con la identidad de MaKo de escritorio: CLARO, la
  paleta Nord + el azul de acción, Geist, las tarjetas de la casa, el dorado sólo para la marca.
- **Secciones que van al teléfono, además de Today, Inbox, CRM y Plan:** Dashboard, Ads Manager,
  Customer Success, Automations, **el editor de video estilo CapCut** (/video-generator, el editor de
  anuncios) y **el constructor de landings estilo Gamma** (/landing-generator), aunque sea en versión
  reducida. (WhatsApp no lo marcó.)
- **El ícono de MaKo:** el del destino central de la barra NO es el logo de MaKo (era una chispa genérica
  del set de íconos). Va el logo real (app/_components/MakoBrand.tsx / Marca.tsx) y SIN protagonismo:
  MaKo no es «una app de chat con una IA», así que el chat deja de ser un destino central de la barra
  (va dentro de «Más» o como acción secundaria).
- **Claro por defecto:** ya arreglado (app/m/_ui/tema.ts y ShellM: oscuro SÓLO si la persona lo eligió;
  antes seguía al sistema operativo).
- **Menos texto y nada flotando:** sacar la «Actualizado hh:mm» flotando al lado del título, los
  subtítulos, las segundas líneas largas, las pills que no deciden nada. Un paso por pantalla, cosas
  grandes (memoria un-paso-por-pantalla).

La barra con más de cinco secciones: cinco destinos máximo (Today · CRM · Inbox · Plan · Más) y «Más»
abre la lista de las demás (Dashboard, Ads Manager, Customer Success, Automations, Video, Landing, MaKo,
Cuenta) — o la composición que se decida con él viendo un prototipo.

`MOVIL_ACTIVO` sigue en `false` hasta que Martín apruebe el rediseño. (Superado: se prendió con la v2
el 11/10 a la noche, cuando pidió que cualquier teléfono viera el diseño nuevo. Ver arriba.)

**El próximo paso, acordado: un PROTOTIPO antes de implementar.** Un diseñador escribe
`docs/diseno-mako-mobile-v2.md` (barra de 5 con «Más», encabezado nativo con el logo real chico, tarjetas
y listas en claro, qué texto se va, y por sección qué hace el teléfono y qué queda en la computadora —
el editor de video y el de landings en versión reducida honesta) y un HTML autocontenido de 390×844 con
Today, Más, CRM y ficha, Inbox, Dashboard, Ads Manager y el editor de video reducido, con los tokens reales
de globals.css, el SVG real del logo y datos de ejemplo FICTICIOS. Se publica como artifact para que
Martín lo vea en el celular y lo apruebe; recién ahí se implementa.

**HECHO el 11/10 a la noche, ESPERANDO A MARTÍN:** `docs/diseno-mako-mobile-v2.md` y
`docs/prototipos/mako-mobile-v2.html` (las 12 pantallas, navegables; `#more`, `#crm`, `#editor`… abre cada
una). Publicado privado en https://claude.ai/artifact/DiP5DFkdjk5BWzC1khhVa3. Se miró a 390×844 con
Chrome headless + Emulation (ver hallazgos-mobile: `--window-size=390` NO sirve, Chrome topea en ~500 y
recorta la captura): sin desborde horizontal, sin errores de script. **Antes de implementar faltan sus
3 respuestas:** (1) Video y Landing sobre lo que hay en `main` o esperar a mergear el CapCut
(rama `video-editor`) y el Gamma (`wt-gamma`); (2) si el teléfono puede gastar créditos de Flow
(«Filmar de nuevo») o sólo mira, cambia el texto y descarga; (3) Ads Manager con lo que ya existe o con
propuestas de MaKo para aprobar en el Inbox (no existen ni en escritorio).

Ya arreglado en esta tanda (commit de la tarde): el Inbox cuenta y muestra sólo lo que se decide en el
teléfono (los 68 borradores del plan van plegados en «N para revisar en la computadora»), Today corta
«Para hoy» en 5, el globo propio del chat de WhatsApp era ilegible en oscuro, el email de Cuenta.

## LA DEVOLUCIÓN DE MARTÍN (11/10, 15:16)

Abrió MaKo en su teléfono y vio **el escritorio** (/general con el Sidebar en miniatura y botones
chicos): «Se ve bastante mal... Realmente no tiene mucho de app mobile eso... Revisalo bien y vuelvelo
a hacer... Tienes que revisar tab por tab que sea funcional y que se vea bien. Seguro que hay cosas que
deberás sacar en la versión mobile... O incluso tabs que solo se puedan abrir en la versión de desktop».

Lo que vio NO era /m: el reparto estaba apagado, así que el teléfono cayó en el escritorio. Quedó
escrito (y subido INERTE) el arreglo de raíz: **un teléfono no ve el escritorio** —
`lib/movil-desvio.ts` decide, `app/_components/DesvioMovil.tsx` (en el layout raíz) tapa desde el
primer pintado y lleva a /m o dice «Esta pantalla se usa en la computadora» con «Abrirla igual»—, y
un solo interruptor: **`MOVIL_ACTIVO` en lib/movil-desvio.ts, hoy `false`** (gobierna el desvío y el
reparto de /inicio).

**Lo que falta, que es lo que pidió:** revisar /m TAB POR TAB en un teléfono (390 px) — Today,
Inbox, MaKo, CRM (lista, ficha, chat), Plan, Cuenta —, que cada una funcione y se vea como app, sacar
lo que sobre, y recién ahí poner `MOVIL_ACTIVO = true`. Hoy no se pudo: la máquina no tuvo RAM para un
next dev (el vigía lo mata), la extensión de Chrome no estaba conectada y el uso semanal llegó al 92%.

## Dónde quedó

- **Está en `main` y desplegado** (commit `ef8626ce`): la app del teléfono en `/m` (Today, Inbox,
  MaKo, CRM, Plan y Cuenta), Web Push por persona, el feed de avisos con workspace y el chat de MaKo
  que propone acciones y se aprueba desde el hilo. Las decisiones, en `docs/diseno-mako-mobile.md`;
  las trampas y lo pendiente, en `docs/hallazgos-mobile.md`.
- **Salió ESCALONADO: el reparto de teléfonos está APAGADO** (`MOVIL_ACTIVO = false` en
  `lib/movil-desvio.ts`). Nadie cae en `/m` solo: se abre por URL (`hola-mako.com/m`).
- **Ninguna pantalla de `/m` se vio todavía en un navegador.** La máquina no tuvo RAM para un
  `next dev` (el vigía lo mató a los 4 GB). Tampoco se miraron `/general`, `/plan/agencia` y
  `/mako/pendientes` después de las extracciones: se revisaron por diff (sin hallazgos), no por
  pantalla. Typecheck en cero, 195 tests nuevos y 622 de los guards del repo en verde, y una
  revisión adversarial que encontró y cerró tres bugs (chats ajenos, suscripción de la cuenta
  anterior, links con `?ws=9`).
- Ya aplicado en producción: las migraciones 0249 (`push_suscripciones`) y 0250 (`notificaciones`
  con workspace) y la credencial `WEB_PUSH_VAPID` del ws 9.

## Lo próximo, en orden

1. **Abrir `hola-mako.com/m` en el teléfono** (y en escritorio `/general`, `/plan/agencia` y
   `/mako/pendientes`) y mirar que todo se dibuje. Si hay un error de pantalla, se arregla antes que
   nada: hoy no afecta a ningún cliente porque nadie llega solo a `/m`, pero `/general` sí es de todos.
2. Si `/m` anda: **poner `MOVIL_ACTIVO = true`** en `lib/movil-desvio.ts` y desplegar.
3. **Probar en un iPhone y un Android reales**: agregar a la pantalla de inicio (el ícono viejo hay que
   volver a agregarlo: iOS congela el manifest), activar los avisos desde `/m/cuenta` y «Probar aviso»,
   dictar y mantener el micrófono en MaKo, aprobar una propuesta, agendar desde la ficha de un lead (en
   un lead de prueba: manda invitaciones reales).
4. La lista «Lo que quedó sin hacer» de `docs/hallazgos-mobile.md`.

Para verificar local sin tumbar la máquina: `node_modules/.bin/next dev` SÓLO con más de 6 GB
disponibles, y apagarlo al terminar (regla de AGENTS.md). El puente de capturas a 390 px con UA de
iPhone que usó esta corrida era un script del scratchpad; el método completo está en la memoria
`verificar-en-navegador`.
