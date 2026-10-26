# La sidebar nueva (17/10/2026)

> **21/10/2026: la ventana chica.** Por debajo de 1200 px de ancho la barra arranca plegada a íconos (se abre encima al
> pasar el cursor; la flecha la fija ahí sin tocar la preferencia guardada), igual que al entrar al Ops Center. El
> molde de ajustes y el modal de un servicio se angostan en el mismo corte. Medido contando en docs/hallazgos-ui.md.

> **20/10/2026: feedback del 18/10, pt 10 y el pliegue del pt 4** (docs/feedback-18-10.md). Lo diario («Today») lleva
> rótulo, se pliega y tiene el **Ops Center** adentro, primero (el Sidebar le pone `arribaDe`; ARRIBA sigue siendo su
> lista). **Todo desplegado por defecto** (la clave de lo plegado pasó a `mk-nav-plegadas-v2`). **MaKo Partners** salió de
> Sales al menú de la foto (sólo agencias). **La barra sigue el modo**: blanca en claro, oscura en oscuro, acotada a
> `[data-sidebar]` (las `--sidebar*` de `:root` siguen oscuras: son la isla oscura de 43 archivos). **Las criaturas no
> cambian de color**: su cara va con `--criatura-tinta`/`--criatura-rubor`, que ningún tema redefine. Plegada, la **marca
> centrada**. Al entrar al **Ops Center** (/second-brain y /admin/operaciones) la barra se **pliega**; la flecha la abre
> ahí sin cambiar lo elegido para las demás tabs. En el teléfono, More arma la caja «Today» con el Ops Center primero.

> **18/10/2026: «Ops Center» en todos los negocios.** Martín: «En todos los clientes también debe llamarse la tab
> «Ops Center» en lugar de «Second Brain» y tener la criatura de estrella». La fila de arriba de cada negocio (key `mako`,
> /second-brain) se llama **Ops Center** y lleva la **estrella** de MaKo (`estrella: true` en el ítem), igual que el Ops
> Center del super admin (/admin/operaciones). Cambian el nombre y la criatura en la barra, en More del teléfono, en el
> título de la pestaña y en la cabecera del teléfono; la ruta, la key y la pantalla (el chat y el grafo) no. Nadie ve dos:
> el super admin ve sólo el suyo (`arribaDe`). Ctrl K sigue llevando ahí con «second brain» o «cerebro». Su chat JEFE se
> sigue llamando «Second Brain» (`jefe` en el ítem), y los textos de MaKo que dicen «Second Brain → Persona»
> (lib/secciones-negocio.ts) no se tocaron: son contenido.

> **v2, 17/10/2026 noche: la del prototipo** (`docs/prototipos/sidebar-nueva-1710.html` y `coherencia-1710.html`,
> partes 3 y 7). Martín: «la sidebar es confusa, copiá otras apps». Lo que cambió sobre la v1 de abajo:
> - **Lo diario sin rótulo** arriba (Plan · Chats · Dashboard) y tres secciones: **Sales** (CRM, Calendar, Automations,
>   Clients, MaKo Partners), **Marketing** (Offer, Web Generator, Ads Manager) y **Create** (Video, Image, Copywriting,
>   AI Avatar). Sin nada guardado arranca abierta Sales y plegadas Marketing y Create. Una sección a la que le queda UNA
>   fila se dibuja sin carpeta (el closer ve CRM suelta).
> - **«Home» salió de la barra**: /general queda en `SIN_FILA` (su key sigue: capas, onboarding) y el Dashboard se marca
>   en /general y /focus. Que el Dashboard abra en la hoja fija «Focus» y que /general redirija ahí es del jefe
>   «Dashboard» (sus archivos; pedido mandado el 17/10 con el plan medido).
> - **La barra va abierta y fija** (244 px, como Linear, Notion, Attio y HubSpot); la flecha de arriba la pliega al
>   rail de siempre, que vuelve a abrirse con el cursor. Se recuerda en `mk-nav-fija`.
> - **Buscador `Ctrl K`** (`app/_components/BuscadorNav.tsx`, la regla en `lib/buscador-nav.ts`): un campo de la barra
>   con la lista colgando debajo, **sin modal**. Encuentra tabs, sus secciones de adentro y los ajustes; entiende los
>   nombres viejos («home», «general» → Dashboard; «customer success» → Clients). Una pantalla con su propio Ctrl K
>   (el inicio del Web Generator) gana: su `preventDefault` se respeta.
> - **Un color, un significado**: el ícono de cada fila lleva el color de su sección (azul lo diario, verde Sales,
>   violeta Marketing, turquesa Create, gris ajustes; los `--sec-*` de `app/_ui/ui.css`, por tema y con su variante
>   para la barra oscura). El naranja sigue siendo sólo MaKo.
> - **El menú de la foto** empieza con la cara (la foto real, el nombre y el @usuario, que es la parte del email antes
>   de la arroba) y lleva a **My Profile**; después Integrations · API · Business settings · Report a problem y, para el
>   super admin, **Platform** (MaKo Context, AI Models, Knowledge, Dev, Billing, Client Agents) con **Coming soon**
>   desplegable adentro (las siete «pronto», `PRONTO` de nav.ts, que dejaron de ser filas). Todo en inglés.
> - **Teléfono**: More empieza con la misma cara (la foto real: hasta ese día `AvatarM` sólo dibujaba iniciales), y
>   abajo las mismas secciones con el ícono sobre su chip de color. La barra de abajo es **CRM · Chats · Dashboard ·
>   Plan · More**: el lugar del medio abre la portada de siempre (/m/hoy), que es lo que en escritorio pasó a ser Focus.
>   Las hojas del Dashboard (/m/dashboard) son la fila «Dashboard sheets» de More hasta que la portada las tenga adentro.
> - Lo que NO se hizo: las filas «My leads», «My tasks», «My reports» y «Favorites» de My Profile (no hay un filtro
>   «míos» en el CRM ni en el Plan, ni favoritos: dibujarlas sería mentir), y la barra de abajo flotante con el activo en
>   píldora (es del shell del teléfono, no de la barra).

> Martín, 17/10/2026, textual:
> - «Quiero también eliminar las tabs de "Email y WhatsApp" y unificarlo todo en "Chats", y que por favor te asegures de
>   que todo funcione bien...»
> - «"Ops Center" no debería estar en la sección de Admin en la sidebar: debería estar donde "Second Brain", con una
>   criatura tipo ícono, moviéndose como siempre... Y debería llamarse "Ops Center". Lo mismo para los otros
>   workspaces, ya que Second Brain sigue estando en la sección de "analize" y no debería.»
> - «Dashboard debería estar dentro de la sección "Operate", ya que se quedaría sola "analize", y la deprecamos. Y
>   también elimina "Content Machine" y que todo esté dentro de "Sales Machine"... Y mejora el diseño de la sidebar:
>   investiga, copia de otras apps... Y "Calendario" debería ser "Calendar": siempre todo en inglés los nombres de las
>   tabs.»
> - «También quiero eliminar todas las tabs de la sidebar de "Admin": estoy seguro de que la mayoría ya tienen lugares
>   donde podrían vivir, tabs completamente funcionales que las reemplazan o las toman...»

El código: `app/_components/nav.ts` (qué hay y dónde), `app/_components/Sidebar.tsx` (cómo se dibuja),
`lib/movil-rutas.ts` + `app/m/mas/page.tsx` (el teléfono). Lo fija `tests/sidebar-nueva.test.ts`.
**Una sola persona edita nav.ts: el jefe «Sidebar».** Los demás chats le pasan nombre, ruta, key y roles.

## 1. Lo que se copió (y de quién)

| App | Lo que hace | Lo que tomamos |
|---|---|---|
| **Linear** | Arriba, sin rótulo: Inbox y My issues. Después secciones («Workspace», «Your teams») con un rótulo chico y tenue y un chevron que se enciende al pasar el cursor. Sin cajas: las filas van sueltas; el activo es un fondo. Cada sección se pliega sola. | El bloque de arriba sin rótulo; el rótulo como letrero (no como fila); filas sueltas; plegar por sección. |
| **Notion** | Home, Search, Inbox y **Notion AI con su carita** arriba de todo; después Favorites, Teamspaces, Private. | La IA va ARRIBA y con cara: Second Brain con su criatura. |
| **Attio** | Notifications, Tasks, Notes arriba; «Records» y «Lists» como secciones; la configuración del workspace detrás del nombre (Settings). | Lo que es configuración de la plataforma va al menú de la foto, no a la barra. |
| **Skool** | No tiene sidebar: pestañas arriba (Community, Classroom, Calendar, Members). | Las tabs que agrupan varias herramientas usan la barra de secciones de arriba (`SeccionesTab`), no filas en la sidebar. |

Lo que NO se copió: el workspace switcher de Linear/Notion (MaKo cambia de workspace con `?ws=` y el banner), y los
favoritos (nadie los pidió). El rail de íconos y el desplegarse al pasar el cursor se quedan: es de MaKo.

**Decisiones de diseño** (en `Sidebar.tsx`, `Familia`):
- Las familias **no son un acordeón**: todas abiertas, cada una se pliega sola y se recuerda en el navegador
  (`mk-nav-plegadas`). Navegar a una tab de una familia plegada la abre. En el **modo Dev** sigue el acordeón (ocho
  familias, 122 áreas).
- El rótulo de familia: mono, 10,5 px, mayúsculas, tenue, sin ícono y con chevron. **Sin la caja** que englobaba las
  tabs: con dos familias ya no separaba nada. Los bloques de adentro se separan con aire (7 px), no con línea.
- Plegada la barra (el rail), el rótulo es una **línea fina** y quedan los íconos; una familia plegada por el usuario
  muestra su ícono, que la despliega.
- Lo «pronto» del super admin (VSL Generator, Lead Magnet, Sales Email, Newsletters, Closing Script, Sales Roleplay,
  Competitor Spy) va en **un desplegable «Coming soon»** dentro de Sales Machine: eran siete filas de «pronto» y la barra
  pasaba los 768 px (regla de la casa: la sidebar no scrollea). Un cliente no lo ve (todas son `adminOnly`).

## 2. La barra nueva

```
[MaKo]
 ☻ Ops Center        ← sólo el super admin (puedeOperar en la página); criatura del Ops Center
 ☻ Second Brain      ← todos los que tienen MaKo (key `mako`); criatura
OPERATE ›
   General · Plan · Calendar · Dashboard
   CRM · Chats · Ads Manager
   Clients · MaKo Partners          (Clients con sus sub-tabs ADENTRO de la pantalla; Partners sólo agencias)
SALES MACHINE ›
   Offer                           (Offer [+ Strategy · Playbook, super admin])
   Web Generator · Automations     (Automations; MaKo Messages salió el 26/10/2026)
   Video · Image · Copywriting     (Copywriting [+ Method, super admin])
   Coming soon ›                   (super admin)
───
[foto] Tu cuenta · API · Configuración del negocio · Reportar problema
       [super admin] MaKo Context · AI Models · Knowledge · Dev
```

Lo de paréntesis son SECCIONES de una tab unificada: la barra de arriba de la pantalla (`SeccionesTab`) las ofrece, y
con una sola visible no se dibuja. Las secciones del super admin llevan `adminOnly`: un cliente ve la tab igual que antes.

**La criatura** es el muñeco del Ops Center de ese nombre (`app/admin/operaciones/Muneco.tsx`, vía
`app/_components/Criatura.tsx`), «trabajando»: flota y parpadea. El movimiento vive en `.mk-criatura` de `ui.css`
porque `centro.css` sólo carga en el Centro. Es el mismo muñeco que el chat «Ops Center» / «Second Brain» tiene en el
Centro (el aspecto sale del nombre).

## 3. El mapa: cada tab de antes, a dónde fue

| Tab (antes) | Sección (antes) | Ruta | Ahora |
|---|---|---|---|
| General | Operate | /general | Operate (igual) |
| Plan | Operate | /plan | Operate (igual) |
| Calendario | Operate | /calendario | Operate, **«Calendar»** (la ruta y la key `calendario` no cambian) |
| CRM | Operate | /crm | Operate (igual) |
| Ads Manager | Operate | /ads-manager | Operate (igual) |
| Chats | Operate | /chats | Operate, **la única tab de conversaciones** (tab unificada `bandeja`) |
| WhatsApp | Operate | /whatsapp | **Sale de la barra.** La página sigue: conectar números (QR, líneas, Chatbot ON/OFF). Se entra desde Chats («+» de Canales); estando ahí, la barra marca Chats |
| Email | Operate | /email | **Sale de la barra.** La página sigue: dominio, secuencias y envíos. Se entra desde Chats (pie de la Bandeja y «+»); admin y setter, como su guard |
| Second Brain | Analyze | /second-brain | **Arriba de todo**, con criatura (una sola entrada: la de abajo del todo también se fue) |
| Dashboard | Analyze | /dashboard | **Operate**, al lado de General |
| Experiments | Analyze | /experimentos | **Sale de la barra** (su trabajo va al chat de MaKo; lo lleva el jefe «Dashboard»). La página sigue |
| Competitor Spy («pronto») | Analyze | /competitor-spy | Sales Machine › Coming soon (super admin) |
| Offer | Sales Machine | /offer | Sales Machine (igual; ahora tab unificada) |
| Web Generator | Sales Machine | /web-generator | Sales Machine (igual) |
| Automations | Sales Machine | /automations | Sales Machine (igual; ahora tab unificada) |
| VSL Generator, Lead Magnet Generator, Sales Email, Newsletters, Closing Script, Sales Roleplay («pronto») | Sales Machine | — | Sales Machine › Coming soon (super admin) |
| Video | Content Machine | /video-editor | **Sales Machine** |
| Image | Content Machine | /image-editor | **Sales Machine** |
| Copywriting | Content Machine | /ads-writer | **Sales Machine** |
| Clientes | Customer Success | /customer-success | **Operate › Clients** (/clients, una tab con sus sub-tabs adentro: Clients · Community · Classroom · Calendar · Members · Leaderboards · About; la arma el jefe «Clients»). La vieja redirige |
| Curso | Customer Success | /customer-success/curso | Clients › **Classroom** (sub-tab de la pantalla; /clients/classroom) |
| Comunidad | Customer Success | /customer-success/comunidad | Clients › **Community** (sub-tab; /clients/community) |
| — (nueva) | — | /partners | **Operate › MaKo Partners**: sólo el admin de un workspace agencia y el super admin (`soloCapas`) |
| Second Brain (abajo del todo) | — | /second-brain | Arriba (la misma entrada) |

## 4. Admin: dónde fue cada una

Ninguna tenía una tab que la REEMPLACE; todas tienen una tab que hace su trabajo, y ahí cuelgan como sección que sólo ve
el super admin. Lo que es configuración de la plataforma (no el trabajo de una tab) fue al menú de la foto.

| Tab de Admin | Ruta | Ahora | Por qué ahí |
|---|---|---|---|
| Ops Center | /admin/operaciones | **Arriba de todo**, con criatura | El pedido |
| Ticketera | /admin/operaciones?ticketera= | Adentro del Ops Center (ya vivía ahí desde el 16/10) | Era un atajo |
| WhatsApp de MaKo | /agencia | Chats › **MaKo WhatsApp** | Es la línea de WhatsApp de MaKo y sus grupos: una conversación |
| ~~Mensajes de MaKo~~ | ~~/mensajes~~ | salió el 26/10/2026 (Martín: «elimina eso»); redirige a Automations | docs/hallazgos-comunicacion.md |
| Strategy | /admin/estrategia | Offer › **Strategy** | Empieza por la oferta y de ella sale la grilla de precios |
| Offer Playbook | /admin/offer-playbook | Offer › **Playbook** | Es el criterio de la tab Offer |
| Copywriting (método de MaKo) | /admin/copywriting | Copywriting › **Method** | Es con qué escribe MaKo; key nueva `admin-copywriting` (la vieja era la de la tab Copywriting) |
| Cobros | /admin/cobros | Menú de la foto › **Billing** | Es de la plataforma (vender MaKo), y vive fuera de /clients: como sub-tab, la cabecera de Clients desaparecía (lo decidió su jefe) |
| Agente de los clientes | /admin/agente | Menú de la foto › **Client Agents** | Lo mismo que Billing: de la plataforma y fuera de /clients |
| Contexto de MaKo | /contexto | Menú de la foto › **MaKo Context** | Configuración de la plataforma (con qué sabe MaKo) |
| Modelos IA | /modelos-ia | Menú de la foto › **AI Models** | Configuración de la plataforma (con qué piensa) |
| Conocimientos | /conocimientos | Menú de la foto › **Knowledge** | Formación interna del equipo; portal oscuro autocontenido (una barra de secciones arriba lo rompería) |
| Dev | /admin/dev | Menú de la foto › **Dev** | Es un modo (la barra entera cambia); era su única puerta |

Pantallas de alto fijo que ahora pueden llevar la barra de secciones (sólo el super admin): Chats (`chats.css`),
Automations (`ChatAgentApp.tsx`) y Offer (`app/offer/page.tsx`) restan `--alto-secciones`.

## 5. Chats: Email y WhatsApp

Medido el 17/10 (antes de tocar nada):
- **Lo conversacional de WhatsApp ya estaba en Chats**: enviar texto, adjuntos, voz y emoji, borradores de MaKo,
  bloquear, sincronizar, agregar al CRM, asignar, etapa, notas, cerrar y posponer.
- **Lo que /whatsapp tiene y Chats no**: ver «Ocultos» y desocultar, borrar el historial de un chat, el panel Advisor,
  gestionar líneas (renombrar, predeterminar, desconectar, reparar), Chatbot ON/OFF y la alarma de número caído. Por eso
  **la página /whatsapp no se borra**: sale de la barra y se entra desde Chats. Nada se pierde.
- **Email NO es una bandeja.** /email es marketing: secuencias, envíos masivos (broadcasts) y el dominio de Resend. Lo
  que llega por email sólo dispara automatizaciones (`lib/email-entrante.ts`), guarda el sobre y no el cuerpo, y
  «Receiving» de Resend todavía no está prendido. Por eso **la página /email no se borra**: se entra desde Chats.

**Segunda entrega (17/10/2026): el email ES un canal de la bandeja** (`lib/chats-email.ts`, mig 0312
`email_mensajes`, `POST /api/chats/email`, `tests/chats-email.test.ts`):
- **Recibir**: el webhook de Resend (`email.received`) sigue disparando las automatizaciones como siempre y, DESPUÉS
  (`after()`), lee el cuerpo y los adjuntos con `GET /emails/receiving/{id}`, sube los adjuntos al bucket privado
  `chats-email` y deja el email en el hilo. Con lead (cae en su conversación) y sin lead (`em:<email>`: alguien que
  todavía no está en el CRM también se ve).
- **Hilos**: un contacto con lead junta su WhatsApp, su Instagram y su email en UNA conversación (el modelo de
  respond.io). La burbuja muestra lo que escribió, sin la cita del email anterior; arriba, el asunto.
- **Enviar**: «Email · ana@…» en el selector de canal del composer, con un campo de asunto (vacío = «Re:» del último
  que llegó) y la respuesta en el hilo del cliente de correo (`In-Reply-To`). Sale con el remitente DEL NEGOCIO
  (`sendEmail`; sin dominio propio, la identidad se ve gris: «Sin email propio»).
- **Adjuntos**: hasta 5 por email, 4 MB cada uno, en un solo email; los que llegan se bajan (hasta 10 MB) y se abren
  con una URL firmada.
- La API de MaKo filtra la bandeja por `canal: email` (`listar_chats`).

⚠️ **Para que LLEGUE un email hace falta «Receiving» prendido en Resend y el MX del dominio del negocio apuntando a
Resend.** Es de la cuenta, no del código: sin eso, la bandeja muestra lo que se contesta desde Chats y nada más.

Lo que queda:
1. Traer a Chats lo que sólo tiene /whatsapp: la bandeja «Ocultos», «Borrar historial» en el «⋯», conectar un número
   en un modal (el `ConectarMedio` de Automations) y la alarma de número caído.
2. Después, /whatsapp queda sólo para las líneas y /email sólo para dominio, secuencias y envíos (o se mudan a
   Integraciones y Automations).
3. El teléfono (/m/chats) lee la bandeja de WhatsApp: el email se suma cuando se sumen Instagram y Messenger.

## 6. Lo que NO cambió (y no se cambia)

- **Ninguna ruta.** Todo lo que salió de la barra sigue abriendo (Experiments, WhatsApp, Email, el Mapa del Second
  Brain); nada redirige porque nada se movió.
- **Ninguna key** de las capas: `calendario`, `graphics`, `customer-success`, `cs-curso`, `cs-comunidad`, `setting`,
  `offer`, `whatsapp`, `email`, `experimentos`, `second-brain`, `mako`. Las tabs unificadas nuevas (`bandeja`, `oferta`,
  `automatizaciones`, `clients`) son keys de la BARRA, no de capas.
- **`SIN_FILA`** (nav.ts): las pantallas vivas que dejaron de ser fila. El teléfono abre /m/experimentos y
  /m/second-brain/mapa preguntando por la key EN nav.ts (`puedeVerKey`): sin el ítem, la puerta se cerraba para todos.

## 7. El teléfono (/m)

More sigue a la sidebar: Second Brain arriba sin título (con el Ops Center del super admin, cada uno con su criatura),
y las cajas de la sidebar (desde la v2: lo diario sin título, Sales, Marketing y Create, cruzadas con nav.ts por su KEY).
La caja «Super admin» del final se fue (la Ticketera vive en el Ops Center). La barra de abajo, desde la v2:
CRM · Chats · Dashboard · Plan · More. El Mapa y Experiments son filas OCULTAS
(`oculta: true`): sus páginas siguen y los links de escritorio llegan.

## 8. Coordinación

- **Clients** (jefe «Clients»): une Clientes, Curso y Comunidad y suma «MaKo Partners». La tab `clients` de nav.ts ya
  está armada con sus secciones; nombres y la fila de MaKo Partners los pasa ese jefe.
- **Dashboard** (jefe «Dashboard»): lleva Experiments al chat de MaKo. Si /experimentos redirige, se saca de `SIN_FILA`.
- **Ops Center 3**: dueño del dibujo de las criaturas (la estrella de MaKo y las reacciones). La barra usa su componente.
- **Ticketera**: su rama cambia el atajo a `?ticketera=tickets` y suma el registro `dev-reportar-problema`; al
  integrar, el atajo vive en `HERRAMIENTAS.ticketera` de nav.ts.

## 9. Pendiente

- Email como canal de Chats y lo que sólo tiene /whatsapp (§5).
- ~~El menú de la foto sigue en castellano~~: desde la v2 son «My Profile» y «Business settings», juntos con
  `lib/ajustes-secciones.ts` (las secciones de adentro siguen en castellano: son del jefe de Ajustes).
- Dashboard con la hoja fija Focus, Templates y /general → /dashboard: jefe «Dashboard».
- My Profile con «My leads / My tasks / My reports / Favorites»: hace falta antes un filtro «míos» en el CRM y el Plan.
