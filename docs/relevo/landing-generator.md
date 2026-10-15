# Relevo · Web Generator, ex Landing Generator (el editor copiado de Gamma)

> **Estado al 15/10/2026 11:40: la TANDA 7 está EN PRODUCCIÓN** (entró con el push de Estrategia, `70172c164`;
> deploy `mako-pcg4b6mub` Ready, verificado en vivo por la política nueva de la página de afuera). Falta que Martín la
> vea con clics y que el clon corra `npx next typegen` cuando se ponga al día (lo hace Estrategia). Ver «Tanda 7» al final. La tab se llama Web Generator y vive en `/web-generator`
> (`app/web-generator`); este archivo conserva su nombre porque lo citan comentarios del código.

Chat del 11/10/2026 (cuenta claude3). Escrito por la sesión que hizo el trabajo, al cruzar el 85%
semanal.

## Qué se hizo
- Pedido de Martín: «Replica por completo a Gamma, que se pueda hacer todo lo que ahí se hace» en la
  tab Landing Generator, apoyándose en presenton.
- Commit «Landing Generator: el editor de landings copiado de Gamma 5» (rama `gamma-editor` del
  worktree `../wt-gamma`, rebasada y pusheada a `main`). Diseño y contratos:
  `docs/diseno-editor-landing.md`; lo aprendido y lo pendiente: `docs/hallazgos-editor-landing.md`.
- Mig 0246 aplicada en la base (tablas `landing_docs`, `landing_doc_versiones`,
  `landing_doc_comentarios` y bucket público `landing-imagenes`).
- Typecheck 0, suite completa 7507/0, build verde (sobre el árbol rebasado se corrieron tipos y suite).

## Qué quedó a medias o sin hacer (con su archivo)
1. **Mirarlo con clics.** La verificación en navegador se cortó por el límite de la cuenta al final;
   no dejó datos de prueba (0 landings, 0 archivos en el bucket). Probar en `/landing-generator`
   impersonando ws 3 (o ws 1, borrando lo creado).
2. **Imágenes con IA por Google Flow** — decisión de Martín: parchear la extensión (sacar la foto de
   referencia para imágenes de landing y no exigir haber aprendido el video), midiendo antes en ws 3
   proporción, costo, semilla y refresco de URL vencida. Nada escrito todavía. Detalle y riesgos en
   `docs/hallazgos-editor-landing.md` → «Lo que quedó sin hacer».
3. HTML personalizado con JS en la página publicada (hoy la CSP no lo deja correr): servirlo desde
   su propia URL con `sandbox`.
4. `npx next typegen` en el clon principal (se borró `app/api/landing-writer/route.ts`).
5. El worktree `../wt-gamma` (rama `gamma-editor`) se puede borrar una vez desplegado: antes de
   `git worktree remove`, sacar el junction `node_modules` con `cmd /c rmdir` y los de `.next/node_modules`.

## Qué espera una decisión de Martín
- Nada nuevo: las dos decisiones (imágenes por Flow; parchear la extensión) ya las tomó.

## Tanda 2 (12/10/2026) — en main (`577d0ebb`, deploy Ready)
Panel por documentos, crear con dictado y 22 plantillas (10 landings + 12 presentaciones), presentaciones 16:9, HTML libre con JS aislado (`/l/html`), diagnóstico como recorrido con «Solucionar con IA» y «Replicar», dominio propio (migs 0263 y 0264, aplicadas), y el feedback de Fiesta Music (landing como página continua; la tira de miniaturas). Pendiente: cargar `VERCEL_API_TOKEN`/`VERCEL_TEAM_SLUG` en producción (sin eso «Dominios» dice que no está activado: decide Martín qué token); `/l/html` desde un dominio aparte; redirecciones y `public/` servidos en el dominio del cliente; mirarlo con clics (tira de miniaturas en Chrome de Windows, Presentar, un análisis real); el parche de la extensión para imágenes con Flow sigue sin empezar. Detalle: `docs/hallazgos-editor-landing.md` → «Tanda 2».

## Tanda 3 (12/10/2026, sin agentes) — en main (`73800383`, deploy Ready por API)
Cierre al cruzar el 95% semanal. Hecho: la barra «＋ | ✨ | ▾» de la sección activa ya no queda tapada por la de abajo; las plantillas de landing son 8 DISEÑOS y el copy se elige en el pop-up «¿De qué quieres crearla?» (caja de crear y galería del Panel: `lib/editor-landing/disenos-landing.ts`, `app/landing-generator/crear/DialogoObjetivo.tsx`); agenda (Calendly/Cal.com), VSL y botón de pago entran solos según el objetivo y son la categoría «Herramientas de MaKo» del menú de bloques; sin el conmutador «Edición manual / Edición con IA» (el agente arranca abierto, se pliega, ✨ o Ctrl+E lo reabre) y sin la cabecera doble. ⚠️ El push no creó ningún deploy: se lanzó por `POST /v13/deployments` (receta en `docs/hallazgos-infra.md`).

Después, la sesión de Chatbot sacó la caja de «¿Qué vas a crear hoy?» a `app/landing-generator/CajaPedido.tsx` (+ `Ico.tsx`) para montarla también en Automations (`51a3ad96`): **el diseño de la caja se cambia ahí** y le llega a las dos pantallas.

Pendiente (con su archivo):
1. Mirarlo con clics: la barra en una sección del medio y en la última; el pop-up desde el Panel y desde la caja; el agente plegado y reabierto.
2. El botón de pago no arma el link desde la pasarela de MaKo (`lib/cobros.ts`, `crearCobro`): hoy se pega el link de Stripe o Mercado Pago.
3. Tres tests rojos en main que NO son de esta área (medido 14:57 UTC): `tests/mover-etapa-validacion.test.ts` (CRM), `tests/plan-filtro-cliente.test.ts` y `tests/plan-proyectos-catalogo.test.ts` (Plan / nav.ts).
4. Lo de la tanda 2 sigue igual (token de Vercel en producción, `/l/html` en dominio aparte, parche de la extensión para imágenes con Flow).

## Tanda 4 (13-14/10/2026, cuenta claude2) — integrada con la 5

Pedido de Martín (13/10, por el chat «Estrategia 3 cuentas»): «En la cuenta 3 quedaron muchos pendientes que frenamos
porque estabamos llegando al limite semanal, dile a esos chats que continuen y cierren lo que ya habiamos planificado».

**Decisiones de Martín (14/10, no se re-preguntan):**
- El botón de pago de una landing pide **nombre y email** antes del checkout (crearCobro exige un lead; así el pago entra
  al CRM a su nombre).
- «Dominios» usa **el token de Vercel de Mauricio que está en `.env.local`** (`VERCEL_API_TOKEN` + `VERCEL_TEAM_SLUG`).
- El HTML con JavaScript de los clientes sale desde **makodigital.app** («el otro dominio que tengo en pork»; ya está en el
  proyecto de Vercel). Si la landing tiene dominio propio, sale desde ese. Las landings siguen en hola-mako.com/l/<slug>.
  Preguntó: «no entiendo lo del login, porque desde landing generator no deberían poder crear logins» → el bloque «HTML
  personalizado» y «Replicar» permiten pegar o copiar cualquier página; el freno `pideContrasena` se esquiva armando el
  campo por JavaScript.
- Medir las imágenes por Flow en ws3: **«Ahora no, más tarde»** (hay que pasar la extensión de su Chrome de Windows,
  hoy en ws10 Leandro Tejado, al ws3). No empezar sin volver a preguntar.

**Hecho:**
- `npx next typegen` en el clon (13/10 18:51 AR): `.next/types/validator.ts` ya no nombra `app/api/landing-writer/route.ts`.
- `VERCEL_API_TOKEN` y `VERCEL_TEAM_SLUG` cargadas en producción por la API de Vercel (14/10, `target: production`,
  encrypted). Entran con el próximo deploy de producción.

**Cerrado el 14/10 a pedido de Martín («que se pushee todo y que los chats cierren»): NO se escribió código.** Los
agentes no llegaron a arrancar: la guardia de RAM los frenó toda la tanda (entre 1,1 y 2,4 GB libres, con 22 chats abiertos).
`wt-gamma` (rama `gamma-editor`) quedó al día con origin/main y sin cambios; el worktree `C:/dev/wt-landing-dom` se borró.

**Lo que falta, en este orden (todo sin empezar):**
1. **Mirarlo con clics** en `/landing-generator?ws=3` (producción): la barra «＋ | ✨ | ▾» en una sección del medio y en la
   última, el pop-up «¿De qué quieres crearla?» desde el Panel y desde la caja, el agente plegado y reabierto (✨ y Ctrl+E),
   la tira de miniaturas con 6-9 secciones con imágenes (sin «ResizeObserver loop») y Presentar. Detalle de cada uno en la
   Tanda 2 y la Tanda 3 de este archivo.
2. **Botón de pago por la pasarela de MaKo.** Hoy el botón es un nodo `boton` con el link pegado
   (`lib/editor-landing/catalogo-bloques.ts:121`, `disenos-landing.ts:76-110`, `app/landing-generator/editor/insertar.ts`).
   Con lo decidido (nombre y email antes del checkout): una ruta pública bajo `/api/`, con su ruta exacta en
   `lib/rutas-publicas.ts`. Lee la landing PUBLICADA, reusa el lead por `emailComparable` o lo crea por el camino del
   opt-in (`app/api/track/optin`), y llama a `crearCobro` (`lib/cobros.ts`). Las siete reglas de «Integraciones»:
   - sólo `productoId` sale de la landing; monto, moneda, montoUsd y altaCapa nunca salen del request;
   - nunca `altaCapa` desde una landing;
   - `cobroPendienteDelLead` no filtra por producto: comparar antes de reusar;
   - ante LeadDuplicadoError, reusar el lead que ya existe;
   - error genérico al visitante, y el real donde lo lea el dueño;
   - tope por IP y por email;
   - nada de server action ni de POST a `app/l/**`.
3. **/l/html desde makodigital.app** (decidido). El origen va en UN lugar (junto a `lib/app-url.ts` o en
   `lib/editor-landing/html-libre.ts`). En ese host sólo se sirve `/l/html/*`; el resto sigue con la mudanza 410 de
   `proxy.ts` (`respuestaMudanza`). Se tocan el iframe de `especificacion.ts` y la CSP de `pagina-publica.ts`; con dominio
   propio, como hoy. Van también las redirecciones de `next.config.ts` con `has: host` de MaKo y los estáticos en el dominio
   del cliente (Tanda 2 → «Lo que quedó sin hacer»). ⚠️ Con el token de Vercel ya cargado, «Dominios» queda vivo en el
   próximo deploy, y esos dos agujeros pasan a ser reales.
4. **Imágenes por Flow**: medir en ws3 (proporción, costo, semilla, URL vencida) y recién ahí parchear la extensión. Martín
   dijo «ahora no, más tarde»: preguntarle antes de pasar su extensión a ws3. El plan completo está en el scratchpad de la
   sesión f3876a09 (`plan-flow-imagenes.md`) y resumido en `docs/hallazgos-editor-landing.md` → «Lo que quedó sin hacer».
5. **Feedback de las reuniones del 13/10.** Está VALIDADO y es «de punta a punta». Fuente:
   `C:/Users/marti/Downloads/mako-feedback-y-tareas.md`.
   a. El importador por URL («Sales Machine») no extrae bien el texto de páginas externas (Fathom 858927676 @43:13).
   b. Que el análisis de una landing interactúe con lo dinámico (desplegables, botones, calendarios) (858545195 @49:44).
   c. Discutir el feedback del análisis con MaKo en el chat, y un botón «Aplicar cambios» (858545195 @50:27).
   d. En «Replicar en el editor», un selector de formato antes de mandar al editor: presentación, landing o página web
      (858545195 @59:48).
   «De punta a punta» incluye el código, la capacidad en la API de MaKo si es nueva, tests probados rompiéndolos, mirarlo
   en ws3, el pedido literal en la bitácora de /admin/dev, y el relevo y los hallazgos al cerrar.

Coordinación: «Integraciones» es el dueño de `lib/cobros*` (no tocarlo). «CRM» tocó `app/api/track/optin/route.ts`
(guarda `leads.optin_respuestas`, mig 0274) en su worktree.

## Tanda 5 (14/10/2026, cuenta claude2) — integrada

Pedido de Martín (14/10, textual): «Ya compré: hola-mako.site. Implementalo allí y termina todo lo pendiente» y «Menos el
tema de las imagenes». Y a «¿Qué va en hola-mako.site?» eligió **«Las landings enteras, como gamma.site»**: lo publicado
pasa a `hola-mako.site/<slug>`, la app sigue en hola-mako.com y una landing con dominio propio sigue en el suyo. (Esto
reemplaza lo de makodigital.app de la tanda 4.)

**Hecho (14/10):** hola-mako.site y www.hola-mako.site (308 al apex) agregados al proyecto `mako` de Vercel por la API, y el
DNS en Porkbun por su API: se borraron los dos registros de estacionamiento (ALIAS @ y CNAME * a pixie.porkbun.com) y se
crearon A @ → 216.150.1.1 y 216.150.16.1 y CNAME www → 2db067c06ef29ee8.vercel-dns-016.com (los valores que devolvió
Vercel para ESTE dominio). El certificado lo saca Vercel solo.

**Hecho (14/10, integrado en `C:/dev/wt-landing-int`, rama `landing-int`):** las cuatro ramas construidas, revisadas y
corregidas por agentes, y juntas sobre origin/main:
- **Pago** (`gamma-editor`): «Cobrar con MaKo» en el destino del botón, paso de NOMBRE y EMAIL en la publicada
  (`app/l/[slug]/pagar/[bloque]`), POST público con candado por email y techo por landing (mig **0276, ya aplicada en
  prod**), propuesta en /crm/revisar cuando no se puede cobrar. En un dominio propio el botón va a la base de MaKo.
- **hola-mako.site** (`landing-dom`): lo publicado vive en `hola-mako.site/<slug>`; `/l/…` en la app es un 308; el proxy
  decide por host (en hola-mako.site sólo GET/HEAD y el POST del pago con Origin del host); redirección abierta `/l//x`
  cerrada; una landing declarada con la dirección de antes sigue siendo la misma (`urlLandingVigente` en landingDe,
  paginaDeGracias y el Diagnóstico).
- **API de MaKo** (`landing-api`): listar, leer, crear desde un diseño, publicar (pantalla) y despublicar; la dirección
  es la de hola-mako.site (`urlPublicaLanding`).
- **Diseños con video** (`landing-vsl`, pedido del 14/10: «que la mayoría de las plantillas sean con un VIDEO… tipo VSL
  Funnel»): 8 de 9 con VSL en el inicio, «MaKo» primero (tema propio, video al costado); miniaturas con ▶; Publicar avisa
  «Falta el enlace del video». Y la barra de la agencia ya no tapa el editor.
- Verificación con clics en el Chrome de Martín (ws9, ws3 lleva al onboarding): 6/6 ok. Dejó en la Papelera de ws9 las
  landings 18, 19 y 20 (borrarlas para siempre lo hace Martín) y una foto en el bucket.
- Lo que se aprendió está en `docs/hallazgos-editor-landing.md` (las tres secciones «Tanda 4» y «Diseños con video»).

**Push:** desde `C:/dev/wt-landing-int` con `git push origin HEAD:main` (el pre-push espera 5,3 GB libres para el
typecheck). Si quedó sin pushear, es lo PRIMERO: `cd C:/dev/wt-landing-int && git log --oneline origin/main..HEAD`, y
después `vercel ls` + abrir https://hola-mako.site/<slug de una landing publicada> y https://hola-mako.site/l//evil.com
(tiene que dar el 404 de hola-mako.site). Después borrar los worktrees `C:/dev/wt-landing-{int,vsl,dom,api}` y
`../wt-gamma` (junction con `cmd /c rmdir` ANTES de `git worktree remove`).

## Tanda 6 — lo que sigue: el feedback de las reuniones, con las decisiones de Martín (14/10)

Fuente de los pedidos: `C:/Users/marti/Downloads/mako-feedback-y-tareas.md` (Fathom 858927676 @43:13 y 858545195
@49:44, @50:27, @59:48). Decisiones que NO se vuelven a preguntar:
- **(b) Leer la landing «como un visitante»** (abrir desplegables, anotar a dónde lleva cada botón SIN seguirlo, ver si
  el calendario carga SIN reservar): «Haz ambas opciones disponibles, si detecta que tenes el pixel instalado, que lo
  haga desde allí y sino desde la ventana emergente». Con el **Pixel**: el Diagnóstico abre la landing en una pestaña al
  lado con un id de lectura (como `prueba` de «Probar»), el Pixel servido por `/m.js` (siempre la versión actual) corre
  el lector y manda la lectura a MaKo; quien tiene el snippet largo viejo no lo trae. **Sin Pixel**: una VENTANA
  EMERGENTE con la página servida por MaKo (la ruta del Diagnóstico, `app/api/landing-generator/diagnostico/pagina`) con
  el lector inyectado, que le contesta a `window.opener`. Y: **«previo a abrir la página, es muy importante que si el
  usuario no tiene la opción de "habilitar ventanas emergentes" de Chrome, no continue, no abra la página, sino que
  indique dentro de MaKo que lo tiene que habilitar. Me imagino como el mensaje que tenemos en Video Generator que es una
  flecha apuntando arriba con el mensaje. Esto para ambos, para esto y para el pixel»** — o sea también para «Probar»
  del Pixel. Técnica: abrir la ventana EN el clic (`window.open('about:blank')` sincrónico); si vuelve null, no se abre
  nada y se muestra el aviso con la flecha; si abrió, recién ahí se navega. Nada de Chrome en el servidor ni pago. Lo que
  corre sin persona (el cron y `analizar_landing`) sigue con el extractor del punto (a).
- **(c) «Aplicar»** de cada comentario del Diagnóstico = un clic, con la versión guardada antes y «Deshacer»; más
  «Aplicar todos» (de a una sección, un solo Deshacer) y «Preguntar a MaKo» (MakoChat al costado con el comentario). En
  una landing externa, «Aplicar» lleva a replicar primero y los comentarios pasan a la copia.
- **(d) «Replicar en el editor»** pregunta 3 formatos: Presentación = diapositivas, Landing = secciones editables,
  Página web = la copia idéntica de hoy. Al replicar como landing se COPIA el estilo (colores y fuentes leídos en el
  navegador → tema propio; imágenes al bucket), nada de fotos de stock.
- **(a) Importar desde URL**: el extractor lee el texto de div/span/summary/td (sin duplicar), `<summary>` y
  `aria-expanded` como pregunta, `maxHeaderSize` 64 KB y tope de 5 MB, la URL tal cual (no sin www), y si la página se
  arma en el navegador se ofrece el lector de (b) o «Pega el texto». «Analizar una página» entra al «+».

El plan con archivo:línea de cada punto lo dejó el relevo del 14/10; lo esencial, por punto:
- (a) `lib/landing-fetch.ts` (:33 MAX_BYTES, :179 pedirPagina, :311 RE_BLOQUE, :317-346 extraerBloques) → mudar lo puro a
  `lib/landing-extraer.ts` con test; `lib/editor-landing/ia.ts:234-235` (talCual + `pegable`);
  `app/landing-generator/crear/CrearConIA.tsx:476-477, :837-840`; `CajaCrear.tsx:218-227`. Lo leen 7 módulos (Offer,
  landing-writer, cargar-guiones, la API, imagenes-stock, pixel-servido, replicar): correr sus tests.
- (b) el lector va al lado de `SCRIPT_DIAGNOSTICO` (`lib/editor-landing/diagnostico.ts:497-604`) y, para el Pixel, en
  `lib/landing-token.ts` (cargado sólo con el id de lectura en la URL); la lectura entra al análisis por
  `PedidoDiagnostico` (diagnostico.ts:73-77), la ruta, `diagnostico-server.ts:204-226` y `analizarLanding`
  (`lib/landing-analyst.ts:628`, el `meta` en :360-378) como `contenidoNoConfiable`. El lector abre UNO por vez
  (`details`, `[aria-expanded=false]` que no sea link ni submit, tabs), captura clics y submits con preventDefault, y
  detecta Calendly/Cal/GHL embebidos. Al ir a una cita dentro de un desplegable, lo abre antes del scroll.
- (c) `Comentario.tsx` (:56, :79-109), `RecorridoDiagnostico.tsx:236-242`, `PanelDiagnostico.tsx:213-273, :297-320`;
  `instruccionDeSugerencias` y `contextoDeComentario` puras en diagnostico.ts; API: `listar_comentarios_landing`,
  `cambiar_estado_comentario_landing`, `aplicar_comentario_landing` (pantalla, admin).
- (d) `lib/editor-landing/replicar-reglas.ts` (:33, :36-41, :64, :439-472), `replicar.ts:47-130` (hoy usa stock al azar
  y nace con el tema pewter), `app/api/landing-generator/replicar/route.ts:30-35`, el test de
  `tests/editor-landing-htmllibre.test.ts:420`; API: `replicar_landing`.

Pendientes chicos (cada uno con su archivo): «Probar nuevo diseño» no recibe el formato (`ia.ts:507`,
`AskAgent.tsx:177`); el PDF de una presentación sale vertical (`css.ts:871`, `exportar-html.ts:166-171`); «Dominios» no
avisa la reserva vencida (`dominios-reglas.ts:365`, `dominios.ts:317`); el www no se agrega solo al conectar un apex; las
rutas analyze/sync/pulso del Landing Analyst no miran el rol (`app/api/landing-analyst/*/route.ts`); de una landing
nuestra sólo se analiza la página de inicio (`diagnostico-server.ts:163`); el puntaje de una landing nuestra no se guarda
(`diagnostico-server.ts:141, :195`, columna nueva `landing_docs.diagnostico`); la copia fiel de una página armada como app
queda en 400 px (`html-libre.ts:165-195`, `replicar-reglas.ts:467-472`); el sandbox de los popups del bloque HTML
(`html-libre.ts:47`, sumar `allow-popups-to-escape-sandbox`); el clasificador de WhatsApp no reconoce «publicá la
landing» (`lib/mako-intencion.ts`, `esPedidoDeLanding`: es el `todo` de `tests/api-mako-landing-editor.test.ts`); de los
diseños con video, la 2.ª página de gracias sin video, el orden en el teléfono con el video al costado y la pista del
proveedor que se pierde al pegar HTML. Y las imágenes por Flow siguen afuera por pedido de Martín.

Decisiones que dejé tomadas por default (Martín no las pidió revisar): techo de 120 pedidos de pago por landing y hora;
cuando no se puede cobrar, propuesta y no ficha; `despublicar_landing` sigue reversible (avisando en el resumen);
`publicar_landing` con un token detallado publica en el acto, como el resto de la API («como GitHub»).

## Tanda 6 — EN CURSO (14/10 ~13:30, cuenta claude2 al 89% semanal)

Pedido literal de Martín (mirando «No pude leer el texto de esa página.» sobre la landing de un cliente, y «Crear con IA»):
«1. El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa página.". Soluciona eso... 2. La sección de
"Importar con IA" no debería ser otra ruta, todo siempre en la misma ruta. 3. La sección de "Crear con IA", le faltan las
opciones de "Analizar Landing" y "Replicar Landing". Y que el botón de "Importar" que solo sea importar, no que sea con URL
[…] Y esta sección de "Crear con IA" debería estar en la tab principal de landing generator, en la sección de "¿Qué vas a
crear hoy?". 4. […] elimina todas las opciones actuales dentro del "+" en el cuadro del chat. Y que en ese + solo quede la
opción de importar archivo y otras opciones así, para subir imagen y esas cosas... 5. En el chat, si yo pego un link, me
debería aparecer pintado de azul y que diga "Analiza esta landing" y que se pueda cambiar a "Replica esta landing". 6. Las
miniaturas y el título de abajo en las plantillas, deberían estar englobadas en un contendor […] Elimina los subtitulos de
cada plantilla. […] que esos bloques tengan como una sombra […] que los [] que el usuario debe completar, se queden como de
otro color […] y que eso se vea también en la miniatura».

Se está construyendo con el workflow `wf_8f7c15cf-56d` en `C:/dev/wt-landing-t6` (rama `landing-t6`, sobre origin/main
`fac31909`): lector en el navegador (Pixel o ventana emergente, con el aviso de ventanas bloqueadas también en «Probar»),
el extractor y Replicar con 3 formatos en el server, los [ ] resaltados en el editor y la miniatura, y la pantalla (Crear
con IA en la tab, el «+», el link en el chat, las tarjetas). Si la cuenta se corta: `git -C C:/dev/wt-landing-t6 log
--oneline origin/main..HEAD` dice qué quedó commiteado; el journal está en
`~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/b8862985-74eb-48c0-a235-c3eee83116be/subagents/workflows/wf_8f7c15cf-56d/`.
NO se pushea a medias. Copiar el estilo de la original al replicar queda para después.

## Tanda 6 — retomada (14/10 ~16:15 AR, cuenta claude1, chat «Landing Generator»)

Pedido de Martín (por «Estrategia 3 cuentas»): cerrar lo pendiente del área al 100%, y primero el rojo de main.

**El rojo de `tests/integracion-sin-salir.test.ts`** (el barrido: `DialogoPublicar.tsx:541` y `CobroBoton.tsx:110` con
`<Link href="/integraciones" target="_blank">` para conectar Stripe) ya tenía arreglo en `landing-t6` (`3a439cd95` +
`1c9bb8beb`). Se pasaron SOLOS a la rama `landing-rojo` (worktree `C:/dev/wt-landing-rojo`, = origin/main + 2 commits,
`0be209e23` y `8be4a7da4`): test 5/5, `tests/editor-landing-*` + `integracion-*` 462/0. **SIN PUSHEAR**: tres intentos
cortados por RAM (no son errores de tipos; con ~20 chats quedaban 0,2-0,9 GB libres). Para pushearlo:
`cd C:/dev/wt-landing-rojo && git fetch -q && git rebase origin/main && MAKO_TYPECHECK_SIN_ESPERA=1 git push origin HEAD:main`
con el vigía pausado (receta en `docs/relevo/estrategia-3-cuentas.md`). Cuando `landing-t6` entre a main, los dos
commits llegan iguales (el merge no choca).

**Lo de la tanda 6 que quedó del corte:** las Piezas (lector en el navegador, extractor/replicar en el server, los [ ]
resaltados) estaban commiteadas; la Pantalla no había escrito nada (0 ediciones), y Verificar/Corregir no corrieron.
`landing-t6` ya tiene origin/main mergeado (`ed681504d`, sin conflictos).

**Actualización (15/10 ~01:00 AR, cuenta claude1): el rojo entró a main con el push integrado de «Estrategia 3 cuentas»
(`8be4a7da4`), y `landing-rojo` se borró. La TANDA 6 ESTÁ EN PRODUCCIÓN:** push `3900567a8..bb0da02ae` (00:37), deploy
`mako-nrgybiei0` Ready, migraciones 0281 y 0282 aplicadas ANTES del deploy y verificadas (columna jsonb; la función de
la 0282 sólo la ejecuta service_role). Comprobado en producción: `hola-mako.site/l//evil.com` termina en el 404 del
mismo host, el POST de pago sin Origin da 403 y la ventana de lectura sin firma da 401.

Qué entró (los pedidos 1-6 de Martín + las decisiones c y d + el backlog sin decisión): leer en el navegador (Pixel o
ventana emergente, con el aviso con flecha), el extractor que lee div/span y los acordeones, Crear con IA en la tab
(Pegar texto · Generar · Importar · Analizar · Replicar en 3 formatos copiando colores, fuentes e imágenes), el «+»
sólo adjunta, el link pegado en azul, las plantillas en tarjetas, los [ ] resaltados, «Aplicar» con Deshacer, el
Diagnóstico de todas las páginas con su puntaje, el pago en el dominio propio con su rastro, el PDF horizontal, y los
dos agujeros de seguridad de la ventana cerrados con una firma del server. Lo aprendido y lo que queda, con archivo y
quién decide: `docs/hallazgos-editor-landing.md` → «Tanda 6». Bitácora: `app/admin/dev/landing-generator/bitacora.ts`.

## Lo que sigue (15/10)

1. ~~**Las 7 decisiones que el orquestador tomó con criterio**~~: (1) `allow-popups-to-escape-sandbox`, (5) el www
   automático y (11) «Aplicar» de afuera deja el original resuelto se CONSTRUYERON en la tanda 7. Sigue: (8) checkout de
   Stripe con dominio propio: MEDIR en Chrome y Safari antes de decidir. Las otras tres (estáticos, HSTS, despublicar
   reversible) quedan como están.
2. ~~**«Todos los botones a la API de MaKo»**~~ (Martín, 15/10 00:10, textual: «Ambos, tienen que pasarle absolutamente
   todos los botones. Todas las funciones a la API de MaKo»): hecho en la tanda 7 (70 de 82 funciones; las 12 que
   faltan, con su motivo, en `docs/hallazgos-api-mako.md`), con `esPedidoDeLanding` y los 420 s donde corre de verdad.
3. **El parpadeo del hero**: la rama `landing-parpadeo` ya está en main (`f90398723`, y medido en producción en
   `c717510c6`).
4. **Animaciones**, con TODAS las decisiones tomadas (15/10/2026; ya no hay nada esperando en la Ticketera): el panel
   se copia del de Canva, el interruptor sigue prendido por defecto, el video de fondo sólo por el puente a Flow
   (720p / 480×854), y al replicar se avisa lo que no se copia del scroll. Relevamiento en
   `docs/hallazgos-editor-landing.md` → «Animaciones» (tres secciones, Lottie incluido), etapas 0-9; la lista de las
   decisiones, en «Etapas propuestas… y lo que falta decidir». Es la segunda mitad del punto 8 de la tanda 7.
5. **Lo decidido sin hacer** (misma fecha): renombrar el proyecto del Plan a «Web Generator» migrando por id (y, en la
   misma pasada, las tareas que lo nombran en el TÍTULO, para que el proyecto nuevo no quede huérfano de su historia:
   pedido de Estrategia); el aviso del www, informativo; comentar como MaKo; el aviso de un pago rechazado al negocio,
   como plantilla del catálogo.
6. **La ventana del lector en el mismo clic** (pedido de Martín del 15/10): HECHO en la tanda 7 (`a38b68270`,
   `d7b20f20d`). Falta verlo con un clic real en Chrome (el bloqueador no se mide en headless). Por qué existía el
   segundo botón: docs/hallazgos-editor-landing.md → «La ventana del lector se abre en el MISMO clic».
7. **El `window.opener` del camino del Pixel**: es de Martín (aceptar un riesgo de seguridad), con la explicación
   pasada a Estrategia el 15/10. Si no lo acepta: que el lector conteste por el server con la firma de la lectura.

## Tanda 7 (15/10/2026, cuenta claude1, chat «Landing Generator») — EN PRODUCCIÓN (`70172c164`, deploy `mako-pcg4b6mub`)

Pedidos de Martín, literales en `app/admin/dev/landing-generator/bitacora.ts`: el feedback de la tanda 6 en ocho puntos
(01:02, por «Estrategia 3 cuentas»: todo se llama «Web Generator», el cuadro de chat se TRANSFORMA en vez de navegar,
Generar = Pegar texto, Importar y los links como estados del mismo cuadro, el ▶ descentrado, faltan diseños con
animaciones) y «todas las funciones a la API de MaKo» (00:10).

**Qué trae** (rama `web-t7`, worktree `C:/dev/wt-web-t7`, 18 commits sobre origin/main + el merge `b325297dc`):
- La tab se llama **Web Generator** en la ruta (`/web-generator`), la sidebar, el More del teléfono, el onboarding y lo
  que cuenta MaKo; todo link viejo (`/landing-generator/…`, `/landing-writer`) redirige al mismo lugar con la query.
- **UN cuadro con modos**: Generar · Importar · Analizar landing · Replicar landing arriba del cuadro; elegir uno lo
  transforma, nada navega, y lo tipeado no se pierde. Importar y los links vuelven al texto como miniatura o chips;
  arrastrar un archivo o un link anda en cualquier modo. «Plan» y «Más ajustes» llevan las opciones; sin tarjetas de
  ejemplos ni «Aleatorio»; «Pegar texto» es pegar en el cuadro.
- El ▶ de los videos centrado en su círculo, en la galería Y en el editor.
- Dominio propio: al conectar una raíz, MaKo suma el www redirigiendo a ella.
- Diagnóstico: «Aplicar» un comentario de una landing de afuera deja el original resuelto, con «Ver en tu copia»; y
  cuando las IAs del cliente no contestan, usa la red de plataforma y dice la causa real (también la tab Landing Analyst).
- El HTML personalizado abre ventanas sin el sandbox (un checkout ajeno ya no falla); la página de afuera del
  Diagnóstico tiene su propia política y la ventana del lector suelta su opener (dos agujeros cerrados).
- **API de MaKo**: el editor entero (40 operaciones: crear y editar con IA, el contenido, el tema, el sitio, el dominio,
  el historial, la biblioteca), y por WhatsApp llegan «publicá / creame / replicá / analizá / cambiá… mi landing».
  420 s donde una confirmación por chat corre replicar.

**Para pushear** (es lo PRIMERO): origin/main avanzó durante la corrección (9 commits al 05:20). `cd C:/dev/wt-web-t7 &&
git fetch -q && git merge-tree --write-tree origin/main HEAD` (con main en `b8b298600` daba limpio), `git merge origin/main`,
`node --import tsx scripts/generar-api-doc.mjs --check`, los lotes de tests de la rama y los que leen el fuente de lo
que tocaron los dos lados (docs/hallazgos-infra.md), y `git push origin HEAD:main` (el pre-push corre el typecheck
completo). Después, `vercel ls` y verlo en producción.

**Lo que quedó sin hacer, con su archivo** (el detalle en `docs/hallazgos-editor-landing.md` → «Tanda 7» y
`docs/hallazgos-api-mako.md` → «El editor entero del Web Generator»):
- Reclamar una raíz AJENA bloquea su www para otro negocio y no vence; las raíces conectadas antes de la tanda 7 no
  tienen www; `agregarAVercel` sólo mira el 409 (`lib/editor-landing/dominios.ts`, `dominios-reglas.ts`). La pestaña
  «Dominios» no explica el www (`app/web-generator/editor/dialogos/DialogoPublicar.tsx`, `PARA_REGISTRO`).
- «quítale el formulario a la landing» no trae `acomodar_bloque_landing` (`lib/api-mako/registro.ts`).
- Las reglas copiadas de archivos `'use client'` a `lib/api-mako/areas/landing-contenido.helpers.ts`, sin unificar.
- «Aplicar todos» por la API va justo contra los 300 s de `/mako/revisar` (`landing-editor.run.ts`,
  `PLAZO_EMPEZAR_VUELTA_MS`).
- Las versiones «Antes de un cambio de MaKo» no se podan (`lib/editor-landing/server.ts`, `podarVersionesAuto`).
- El rótulo «PowerPoint, Word o PDF» se queda corto (`app/web-generator/CajaCrear.tsx`); MaKo Mobile (`/m/landing`)
  sin el cuadro (`lib/movil-rutas.ts`); el guard de links viejos no ve uno absoluto
  (`tests/web-generator-renombre.test.ts`).
- **Verlo con clics** (Martín, en `/web-generator?ws=3`): la lista está en el hallazgo.

**Decisión de Martín pendiente (UNA, la única que es suya por la vara de AGENTS.md `9f4585931`):** el camino del
Pixel conserva `window.opener` (una landing declarada del negocio): ¿se acepta el riesgo? Es seguridad, va a la
Ticketera. Las otras cuatro que estaban acá (el proyecto del Plan, el aviso del www, comentar como MaKo, los diseños
con animaciones) quedaron DECIDIDAS el 15/10 y anotadas arriba, en «Lo que sigue» → 4 y 5.

**Decisiones que Martín YA contestó (15/10/2026, textuales vía Estrategia; no se re-preguntan):**
- `landing-video-fondo` → «B · Sólo generado por MaKo, cuando el puente pueda»: no hay camino de «el cliente sube su
  video»; la función aparece cuando el puente a Flow la pueda cumplir, y hasta entonces no se ofrece.
- `landing-video-modelo` → «Eso lo elige el usuario»: el modelo de Flow es un control del cliente.
- `landing-subdominio` → «A · Seguir como están, ya funcionando»: lo publicado se queda en `hola-mako.site/<slug>`.
- Y la regla nueva de AGENTS.md (`272b7e038`): ninguna pantalla se diseña de cero; se copia de una app que ya lo
  resolvió, abriendo la fuente de verdad y nombrándola en el commit.
