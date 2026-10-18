# ¿En qué chats estuve trabajando por último?

<sub>Rehecho el 17/10/2026 ~15:30 (hora AR) por «B1-Infra», con el método del final: 113 transcripciones, 78 nombres de chat. Se rehace
en cada relevo — al final está el comando.</sub>

## Lo primero, porque si no esto no se entiende

Martín trabaja el mismo repo desde **varias cuentas de Claude**, y **la lista de chats de la
app está partida por cuenta**. Una cuenta nueva abre la barra lateral y la ve **vacía**: no es
que se perdió nada, es que esos chats pertenecen a las otras cuentas y desde acá no se pueden
ni abrir ni mensajear.

Lo que **sí** se comparte: el repo (y todo lo que está en `docs/`), y las transcripciones
crudas en `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/*.jsonl`
— 113 sesiones, ~3,3 GB, medidas el 17/10.

**Por eso existe esta tabla.** Es el índice que la barra lateral no puede dar.

**Y desde el 15-16/10 hay un orquestador: el Cerebro.** Martín le tira las ideas; el Cerebro las reparte al chat JEFE de cada
tab (se llama como la tab) y es el único que sube a producción. Si no sabés a quién le toca algo, empezá por `cerebro.md`.

## Los chats vivos (actividad del 13/10 en adelante), por última actividad

Hora local (UTC−3). El peso es el de la(s) transcripción(es) con ese nombre: sirve para medir cuánto pesa un chat, no cuánto
hizo. Un chat se parte cuando se queda sin contexto, y por eso hay nombres con varias sesiones (la fila trae la más reciente).

| Última actividad | Chat | De qué se trata | Su briefing |
|---|---|---|---|
| 17/10 15:17 | **Cerebro** (63 MB, 3 sesiones) | El orquestador (antes «Estrategia 3 cuentas»): reparte las ideas de Martín a los chats jefe, junta las puntas y es el ÚNICO que sube a producción | `cerebro.md` |
| 17/10 15:16 | **Runner** (11 MB) | El chat que corre el Runner de esta cuenta: entrega al Centro lo que se firma en la app (pedidos y avisos) — no es un jefe de tab | `centro-operaciones.md` (+ `lib/runner.ts`) |
| 17/10 15:14 | **MaKo en WhatsApp** (32 MB, 3 sesiones) | El doer de los grupos de WhatsApp y su vigía: avisos de arreglos al cliente, «agendarle», la falla que se registra sola como ticket | `mako-en-whatsapp.md` |
| 17/10 12:30 | **Automations** (363 MB, 4 sesiones) | El más grande del repo: flujos con ramas, secuencias, el AI Step, «nada por detrás» y la mudanza de los avisos (lotes) | `chatbot.md` |
| 17/10 11:27 | **Infra** (15 MB, 2 sesiones) | Tests, Actions, typecheck acotado y las trampas de trabajar varios chats sobre el mismo clon | `infra-y-build.md` |
| 17/10 11:22 | **Ticketera** (9 MB) | Los tickets que levantan los usuarios: triage, bandeja de Martín, cierre por bitácora y errores de la app | `../hallazgos-ticketera.md` · `../diseno-ticketera-usuarios.md` |
| 17/10 11:20 | **Plan (extracción de Fathom)** (5 MB) | El Plan / Perro Guardián: extracción de tareas de las reuniones (Fathom) sin inventos | `plan-perro-guardian.md` |
| 17/10 11:16 | **Onboarding** (32 MB, 2 sesiones) | El wizard del cliente nuevo y el onboarding de cada tab (el onboarding ES el chat de Offer) | `onboarding.md` |
| 17/10 11:14 | **Ops Center 3 (relevo del Ops Center)** (7 MB) | Tercera vuelta del Ops Center (el Centro de Operaciones renombrado): relevo del chat anterior | `centro-operaciones.md` |
| 17/10 11:13 | **Clients** (10 MB) | Clients: Clientes, Curso y Comunidad como UNA tab (antes Customer Success) | `customer-success.md` · `../diseno-clients.md` |
| 17/10 11:13 | **CRM** (286 MB, 4 sesiones) | Leads, embudos, la ficha del lead por bloques, campañas → producto, «Llevar a MaKo Partners» | `crm.md` |
| 17/10 11:06 | **Second Brain** (11 MB, 2 sesiones) | El grafo del Second Brain y el chat con MaKo (la mudanza del Centro de Operaciones adentro) | `../hallazgos-second-brain.md` · `../diseno-second-brain-centro.md` |
| 17/10 11:06 | **Offer (pendientes de las llamadas del 16/10)** (6 MB) | La tab Offer (chat → diagnóstico → oferta → PDF) con los pendientes de las llamadas del 16/10 | `offer.md` |
| 17/10 11:01 | **Dashboard** (160 MB, 3 sesiones) | El Dashboard como un Looker Studio: editor de informes, bloques, plantillas y el editor de General | `dashboard.md` |
| 17/10 10:36 | **Sidebar** (7 MB) | La barra lateral nueva: Ops Center y Second Brain arriba, Operate y Sales Machine, todo en inglés | `../diseno-sidebar.md` |
| 17/10 09:44 | **Pagos** (29 MB, 3 sesiones) | La pasarela (Stripe y Mercado Pago), los cobros de MaKo y la tab Pagos del lead | `pagos.md` |
| 17/10 09:26 | **AI Avatar** (7 MB) | La tab AI Avatar (tipo HeyGen) sobre el puente a Flow: looks, voces, plantillas | `../hallazgos-ai-avatar.md` |
| 17/10 05:36 | **Ops Center** (13 MB, 2 sesiones) | Ops Center: la pantalla única del super admin (chats de Claude Code con su caja firmada, Ticketera, Uso y Runners) | `centro-operaciones.md` |
| 16/10 23:40 | **Cartero Centro de Operaciones** (4 MB) | El Runner de antes (cuando se llamaba Cartero) | `centro-operaciones.md` |
| 16/10 11:41 | **Centro de Operaciones** (105 MB, 2 sesiones) | El Centro de Operaciones de la vuelta anterior (hoy «Ops Center») | `centro-operaciones.md` |
| 16/10 11:39 | **Video Editor** (41 MB, 2 sesiones) | La copia de CapCut Desktop sobre el motor de OpenCut y la unificación de las tabs de contenido | `video-editor.md` |
| 16/10 11:06 | **MaKo Mobile** (56 MB, 3 sesiones) | La PWA del teléfono en /m: las mismas rutas, el teléfono destila el escritorio | `mako-mobile.md` |
| 16/10 11:00 | **Web Generator** (21 MB) | Web Generator (ex Landing Generator): el editor copiado de Gamma, tandas 1-8 | `landing-generator.md` |
| 16/10 10:54 | **Offer** (43 MB, 2 sesiones) | La tab Offer: chat → diagnóstico → oferta → PDF, atada a un funnel | `offer.md` |
| 15/10 19:29 | **Strategy** (6 MB) | La tab Strategy del super admin: pauta, ventana de venta, referidos | `vender-mako-estrategia.md` |
| 15/10 19:08 | **Estrategia 3 cuentas** (62 MB, 2 sesiones) | El orquestador de antes del Cerebro (hasta el 15/10) | `estrategia-3-cuentas.md` → hoy `cerebro.md` |
| 15/10 12:34 | **Leads Scraper** (7 MB) | La tab Leads Scraper (diseño) | `../diseno-leads-scraper.md` |
| 15/10 11:40 | **Landing Generator** (29 MB, 2 sesiones) | El nombre anterior de Web Generator | `landing-generator.md` |
| 15/10 06:30 | **Ciberseguridad** (20 MB) | Auditoría y endurecimiento: 2FA obligatorio al 21/10, rate limit, aguantar un ataque | `ciberseguridad.md` · `seguridad-aislamiento.md` |
| 15/10 06:13 | **Image Editor** (11 MB) | El Canva de MaKo sobre Doory, dentro de Content Machine › Image | `image-editor.md` |
| 15/10 06:08 | **Pricing MaKo** (52 MB, 2 sesiones) | Precios, costos, runway y el programa de referidos | `super-admin.md` · `../referidos.md` |
| 15/10 06:00 | **Plan - Perro Guardian** (119 MB) | El Plan / Perro Guardián (la sesión larga de antes del 15/10) | `plan-perro-guardian.md` |
| 15/10 05:53 | **Customer Success** (146 MB, 2 sesiones) | El kanban de la ENTREGA, la ficha del cliente, el curso dentro de MaKo y la comunidad | `customer-success.md` |
| 15/10 01:44 | **Ads Manager** (107 MB, 2 sesiones) | Campañas de Meta: crear, pausar, presupuesto, renombrar, creativos; la conexión con Meta e Instagram | `ads-manager.md` |
| 15/10 00:19 | **General** (87 MB, 2 sesiones) | /general personalizable, los pagos de Mauricio y el Calendario | `general-y-calendario.md` |
| 14/10 16:12 | **Integraciones** (116 MB, 3 sesiones) | Lo que MaKo conecta: credenciales por cliente (BYOK), Pixel, cifrado, y los restos de Chatwoot | `integraciones.md` |
| 14/10 13:54 | **Imagen Generator** (8 MB) | El arranque del Image Editor (el «Canva» dentro de MaKo) del 14/10 | `image-editor.md` |
| 14/10 06:04 | **Perro Guardián** (149 MB, 2 sesiones) | El Plan / Perro Guardián (versión anterior del chat) | `plan-perro-guardian.md` |
| 14/10 05:09 | **Graphics** (11 MB) | El Dashboard / los gráficos (versión anterior del chat «Dashboard») | `dashboard.md` |
| 14/10 04:30 | **Chats** (3 MB) | La tab Chats: una sola bandeja con todos los canales (WhatsApp, Instagram, Messenger…) | `../diseno-chats.md` |
| 14/10 02:28 | **Content Machine** (182 MB) | La generación de videos e imágenes para anuncios (la sesión larga de la cuenta 1) | `video-editor.md` · `image-editor.md` |
| 14/10 02:25 | **Fallas en la PC** (13 MB) | Por qué se traba la máquina (Chrome, RAM, el typecheck): el chat de Infra de antes del 11/10 | `infra-y-build.md` |
| 14/10 02:22 | **Productos X Funnels** (5 MB) | Concluir la carga de múltiples productos por funnel | `crm.md` |
| 14/10 02:10 | **CURSOS (SuperAdmin)** (108 MB) | El pipeline que baja cursos comprados y los publica en `/conocimientos` | — (sin briefing propio) |
| 14/10 00:41 | **Reducir COSTOS** (6 MB) | Alternativas más baratas a Vercel y Supabase (la factura de builds) | `../hallazgos-infra.md` → «La factura de builds» |
| 13/10 23:02 | **Onboarding épico** (104 MB, 2 sesiones) | El onboarding «marketinero» (versión anterior del chat Onboarding) | `onboarding.md` |
| 13/10 20:04 | **Admin** (14 MB) | Super admin: clientes, agencia, links compartidos | `super-admin.md` |
| 13/10 20:03 | **Instagram** (6 MB) | El canal de Instagram (ManyChat o directo) para el chatbot de MaKo | `instagram-afuera-y-curso.md` |

## Los que quedaron quietos (antes del 13/10)

Siguen estando en disco; el recorte lo hace Martín, no esta tabla (el 07/09/2026 se filtró por «actividad desde que yo empecé»
y se cayeron ocho chats que él sí tenía a la vista).

| Última actividad | Chat | De qué se trata | Su briefing |
|---|---|---|---|
| 17/09 22:36 | **CURSOS** (195 MB, 2 sesiones) | El pipeline que baja cursos comprados y los publica en `/conocimientos` (la sesión larga de julio-septiembre) | `../hallazgos-conocimiento.md` |
| 17/09 22:24 | **MaKo API endpoints y documentación** (12 MB) | La API de MaKo: endpoints, tokens y documentación | `api-mako.md` |
| 16/09 00:43 | **Rediseño de MaKo** (65 MB, 2 sesiones) | — | — |
| 11/09 21:50 | **Pixel de MaKo** (16 MB) | El Pixel, Clarity y el Landing Analyst | `pixel-clarity-landing.md` |
| 10/09 01:03 | **MaKo: pesos MX a dólares** (3 MB) | — | — |
| 08/09 13:03 | **Diseño de tab general dañado** (5 MB) | — | — |
| 03/09 22:04 | **Ampliar el detector de voseo con las formas que se le escapan** (2 MB) | — | — |
| 03/09 13:00 | **listar_campanas_meta devuelve MXN etiquetado como USD** (1 MB) | — | — |
| 02/09 23:47 | **Paginar los 8 getters de queries.ts (bug latente, 838/1000)** (1 MB) | — | — |
| 01/09 01:34 | **Edición de Mauricio** (6 MB) | — | — |
| 30/08 13:08 | **Abrir /mako-puente.zip a quien no tiene cuenta** (1 MB) | — | — |
| 25/08 16:35 | **Creativos IA - Mauricio** (22 MB) | — | — |
| 22/08 17:52 | **Creative Factory** (35 MB) | — | — |
| 15/08 21:25 | **Colapsar las URLs de preview de Lovable** (1 MB) | — | — |
| 14/08 23:21 | **Arreglar el link roto del aviso de Chatwoot** (1 MB) | — | — |
| 10/08 19:38 | **Cosechar la regla del orden compartido en gráficos** (1 MB) | — | — |
| 06/08 09:40 | **Notificaciones y título de tab** (3 MB) | — | — |
| 06/08 02:31 | **Landing Analyst y Generator tareas pendientes** (3 MB) | — | — |
| 06/08 01:41 | **Dominio makodigital.app en MaKo** (6 MB) | — | — |
| 05/08 19:01 | **VSL Analyst y Generator tareas pendientes** (2 MB) | — | — |
| 31/07 21:54 | **Subir creativos a campaña existente** (4 MB) | — | — |
| 31/07 12:20 | **Post-llamada redactado por MaKo con el análisis de Fathom** (1 MB) | — | — |
| 31/07 12:15 | **Registrar y verificar el webhook de Chatwoot desde la app** (1 MB) | — | — |
| 31/07 12:08 | **Arreglar el page id partido en dos (cron de leads roto)** (1 MB) | — | — |
| 29/07 14:21 | **Foto de perfil en invitaciones de cursos** (2 MB) | — | — |
| 27/07 16:10 | **MaKo landing page** (117 MB) | La landing pública /vsl de MaKo (la sesión larga de junio-julio) | `../hallazgos-landing.md` |
| 26/07 14:44 | **Registrar prompt editable del Archivero** (0 MB) | — | — |
| 26/07 10:48 | **MaKo · cont. Skills recuperada** (32 MB) | La skill y el hook que el cliente instala en SU Claude Code | `../hallazgos-agente.md` |
| 24/07 10:50 | **Bluehacker cerrar ingesta** (0 MB) | — | — |
| 19/07 11:37 | **VSL copy y detail pop-up** (33 MB) | — | — |

⚠️ **Los chats sin briefing propio (`—`)** son tareas puntuales de agosto o septiembre que se cerraron con su commit: lo que
aprendieron está en `docs/hallazgos-<área>.md` (el índice es `docs/hallazgos.md`), no en un relevo.

## Cómo se retoma uno

La cuenta nueva **no puede reabrir** el chat viejo. Lo que se hace es abrir un chat **con el
mismo nombre** y pegar una línea:

```
Leé docs/relevo/<el-de-la-tabla>.md y seguimos desde ahí.
```

`docs/relevo/README.md` tiene la línea exacta de cada uno. Y el panorama completo de la
ventana está en [`../relevo.md`](../relevo.md) (escrito el 14-15/10) y, para hoy, en `cerebro.md` — que **siempre hay que
mirar con qué fecha está escrito**, porque se pisa en cada traspaso y entre medio el repo sigue moviéndose.

## Cómo se rehace esta tabla

Las fechas y los títulos salen de las transcripciones, no de la app. Cada `.jsonl` trae
registros sueltos `{"type":"custom-title"}` (el nombre que le puso Martín, manda éste) y
`{"type":"ai-title"}` (el que generó Claude, el fallback), más un `timestamp` por línea —
en **UTC**, hay que restar 3 horas.

Se recorre el directorio de arriba, se toma el último `timestamp` de cada archivo y se ordena.
Son 113 archivos (hasta ~180 MB cada uno) y la pasada completa tarda ~1 minuto si cada uno se lee **en streaming, línea
por línea**, quedándose sólo con esos tres campos; abrirlos enteros es lo caro. Dos trampas de la pasada del 17/10:
(1) hay líneas de más de 3 MB (una salida de herramienta pegada entera): de ésas sólo se mira el `timestamp` con una regex, no
se parsean; (2) `du -sh` sobre esa carpeta tardó más de 2 minutos (el límite de la herramienta) — contá con `ls`.

⚠️ **No cortes la lista por fecha, y menos por una fecha tuya.** Esta versión parte la lista en dos tablas por comodidad, pero
las dos juntas son la lista completa y el recorte lo hace él.
