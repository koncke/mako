# La sidebar nueva (17/10/2026)

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
   Clients                         (Clients · Course · Community [+ Billing · Agents, super admin])
SALES MACHINE ›
   Offer                           (Offer [+ Strategy · Playbook, super admin])
   Web Generator · Automations     (Automations [+ MaKo Messages, super admin])
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
| Clientes | Customer Success | /customer-success | **Operate › Clients** (tab unificada; la arma el jefe «Clients») |
| Curso | Customer Success | /customer-success/curso | Operate › Clients › **Course** |
| Comunidad | Customer Success | /customer-success/comunidad | Operate › Clients › **Community** |
| Second Brain (abajo del todo) | — | /second-brain | Arriba (la misma entrada) |

## 4. Admin: dónde fue cada una

Ninguna tenía una tab que la REEMPLACE; todas tienen una tab que hace su trabajo, y ahí cuelgan como sección que sólo ve
el super admin. Lo que es configuración de la plataforma (no el trabajo de una tab) fue al menú de la foto.

| Tab de Admin | Ruta | Ahora | Por qué ahí |
|---|---|---|---|
| Ops Center | /admin/operaciones | **Arriba de todo**, con criatura | El pedido |
| Ticketera | /admin/operaciones?ticketera= | Adentro del Ops Center (ya vivía ahí desde el 16/10) | Era un atajo |
| WhatsApp de MaKo | /agencia | Chats › **MaKo WhatsApp** | Es la línea de WhatsApp de MaKo y sus grupos: una conversación |
| Mensajes de MaKo | /mensajes | Automations › **MaKo Messages** | AGENTS.md: «Un Mensaje de MaKo ES una automatización» |
| Strategy | /admin/estrategia | Offer › **Strategy** | Empieza por la oferta y de ella sale la grilla de precios |
| Offer Playbook | /admin/offer-playbook | Offer › **Playbook** | Es el criterio de la tab Offer |
| Copywriting (método de MaKo) | /admin/copywriting | Copywriting › **Method** | Es con qué escribe MaKo; key nueva `admin-copywriting` (la vieja era la de la tab Copywriting) |
| Cobros | /admin/cobros | Clients › **Billing** | Vende un plan y da de alta la cuenta: los clientes de MaKo |
| Agente de los clientes | /admin/agente | Clients › **Agents** | Qué hace cada cliente en su Claude Code |
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

Lo que queda para que Chats sea TODO (la segunda entrega del jefe «Sidebar»):
1. **Email como canal de la bandeja**: prender Receiving en Resend, guardar cuerpo y adjuntos del email entrante,
   ampliar `CanalChat` con `email`, responder desde el composer con el dominio del negocio (hilo con `In-Reply-To`) y
   adjuntos. Toca `lib/chats.ts`, `lib/email-entrante.ts` (de Automations) y el webhook.
2. Traer a Chats lo que sólo tiene /whatsapp: la bandeja «Ocultos», «Borrar historial» en el «⋯», conectar un número
   en un modal (el `ConectarMedio` de Automations) y la alarma de número caído.
3. Después, /whatsapp queda sólo para las líneas y /email sólo para dominio, secuencias y envíos (o se mudan a
   Integraciones y Automations).

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
y las cajas Operate y Sales Machine. La caja «Super admin» del final se fue (la Ticketera vive en el Ops Center). La
barra de abajo no cambia (CRM · Chats · General · Plan · More). El Mapa y Experiments son filas OCULTAS
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
- El menú de la foto sigue en castellano («Tu cuenta», «Configuración del negocio»): son los dos lugares de ajustes
  decididos el 15/10 y sus páginas se titulan así; si se pasan al inglés, van juntos con `lib/ajustes-secciones.ts`.
