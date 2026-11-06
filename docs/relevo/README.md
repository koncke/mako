# Briefings por chat del último relevo

**Todo lo pendiente, junto y priorizado: [`../pendientes.md`](../pendientes.md)** (foto del 17/10/2026: 296 puntos
verificados contra el código, por impacto). Al cerrar uno, se borra de ahí en el mismo commit.

Uno por cada chat que hay que retomar. **Se reescriben en cada relevo**; las versiones
anteriores quedan en el historial de git. Esta tabla se rehízo el **17/10/2026 ~15:30** contra lo que hay hoy en
`docs/relevo/` y las 113 transcripciones de esta carpeta (antes estaba al 10/10 y mandaba al orquestador viejo).

Para qué existen: la lista de chats de la app está **partida por cuenta** aunque los
transcripts sean compartidos, así que un chat de la otra cuenta **no se puede reabrir ni
mensajear** desde esta. Verificado el 27/09: `get_session` sobre las 4 sesiones de esa
mañana devuelve *not found*. ⚠️ Lo de «no hay herramienta para crear sesiones» quedó viejo el 17/10: el Cerebro de la
app abre los jefes con `start_session` (nombre, modelo, esfuerzo y la línea de la tabla), pero sólo en un turno que
arranca con un mensaje de Martín (AGENTS.md → «Cómo se reparte el trabajo entre los chats»). Desde la nube no se puede.

**Antes que esta tabla: [`chats.md`](chats.md)** — en qué chats se estuvo trabajando, con la
última actividad de cada uno. Una cuenta nueva ve la barra lateral VACÍA (está partida por
cuenta), así que ése es el índice que contesta «¿dónde estaba trabajando?». Esta tabla
contesta la siguiente: «ya sé cuál, ¿qué le pego?».

El flujo, entonces: Martín abre un chat con el título de siempre y pega **una línea**.

## El orquestador y los jefes

Desde el 15-16/10 el chat orquestador se llama **Cerebro** (antes «Estrategia 2/3 cuentas»). Martín le tira las ideas; el
Cerebro las reparte al **chat JEFE de cada tab** (se llama como la tab), junta las puntas y es el ÚNICO que sube a
producción. **No le escribas a un jefe lo que es de otro, ni pushees por tu cuenta: avisale al Cerebro.** Los jefes no se
hablan entre sí por `SendMessage` (no cruza carpetas de config) — pasan por el Centro de Operaciones.

| Chat | Pegar |
|---|---|
| **Cerebro** (el orquestador; antes «Estrategia 3 cuentas») | `Leé docs/relevo/cerebro.md («LEER PRIMERO») y decime cómo seguimos.` Lo viejo: `cerebro-historia.md`. |
| **Sesión en la NUBE** (o una cuenta nueva) | `Lee docs/relevo/nube.md y seguimos desde ahí.` |
| Ops Center (ex Centro de Operaciones) y el **Runner** | `Leé docs/relevo/centro-operaciones.md y seguimos desde ahí.` |
| Ticketera (los tickets de los usuarios) | `Leé docs/hallazgos-ticketera.md y docs/diseno-ticketera-usuarios.md y seguimos desde ahí.` |
| Second Brain | `Leé docs/hallazgos-second-brain.md y docs/diseno-second-brain-centro.md y seguimos desde ahí.` |
| Sidebar | `Leé docs/diseno-sidebar.md y seguimos desde ahí.` |
| Copywriter (mila.gg + Notion, rama copywriter-2810) | `Leé docs/relevo/copywriter.md y seguimos desde ahí.` |
| Settings (las nueve pestañas, el molde de Linear) | `Lee docs/relevo/settings.md y seguimos desde ahí.` |
| MaKo Mobile | `Leé docs/relevo/mako-mobile.md y seguimos desde ahí.` |
| CRM | `Leé docs/relevo/crm.md y seguimos desde ahí.` |
| Automations (ex Chatbot) | `Leé docs/relevo/automations.md y docs/relevo/chatbot.md y seguimos desde ahí.` (automations.md: la prospección del Sprint, 21/10) |
| Dashboard | `Leé docs/relevo/dashboard.md y seguimos desde ahí.` |
| General (vistas personalizables, pagos de Mauricio y el Calendario) | `Leé docs/relevo/general-y-calendario.md y seguimos desde ahí.` |
| Offer | `Leé docs/relevo/offer.md y seguimos desde ahí.` |
| Web Generator (ex Landing Generator) | `Leé docs/relevo/landing-generator.md y seguimos desde ahí.` |
| Video Editor | `Leé docs/relevo/video-editor.md y seguimos desde ahí.` |
| Video Generator (puente a Flow) y AI Avatar | `Lee docs/relevo/video-generator.md y docs/hallazgos-ai-avatar.md y seguimos desde ahí.` |
| Image Editor (el Canva de MaKo, sobre Doory) | `Leé docs/relevo/image-editor.md y seguimos desde ahí.` |
| Pagos (Stripe y Mercado Pago, la pasarela) | `Leé docs/relevo/pagos.md y seguimos desde ahí.` |
| Onboarding | `Leé docs/relevo/onboarding.md y seguimos desde ahí.` |
| Clients (ex Customer Success, el curso y la comunidad) | `Leé docs/relevo/customer-success.md y docs/diseno-clients.md y seguimos desde ahí.` |
| Plan / Perro Guardián | `Leé docs/relevo/plan-perro-guardian.md y seguimos desde ahí.` |
| MaKo en WhatsApp (el doer de los grupos y su vigía) | `Lee docs/relevo/mako-en-whatsapp.md y seguimos desde ahí.` |
| MaKo en WhatsApp: conexiones, ayuda y tickets (las tandas del doer del Cerebro, desde el 27/10) | `Lee docs/relevo/mako-en-whatsapp-conexiones.md y seguimos desde ahí.` |
| Infra (fallas en la PC, build, tests y Actions) | `Leé docs/relevo/infra-y-build.md y seguimos desde ahí.` |
| **Planes** (los planes de MaKo, MaKo Partners y la suscripción) | `Leé docs/relevo/suscripcion.md, docs/hallazgos-partners.md y docs/hallazgos-planes-y-cobro.md y seguimos desde ahí.` |
| Strategy / Pricing MaKo (tab Strategy, runway y referidos) | `Leé docs/relevo/vender-mako-estrategia.md y docs/relevo/super-admin.md y seguimos desde ahí.` |
| Integraciones | `Leé docs/relevo/integraciones.md y seguimos desde ahí.` |
| La suscripción en la ficha del lead y la vista de edición (5/11) | `Lee docs/relevo/suscripciones-ficha-encargo.md y construilo.` |
| La tab Customers de SuperAdmin pasa a ser Admin, entera de nuevo (5/11) | `Lee docs/relevo/admin-encargo.md y construilo.` |
| La tarjeta Pagos de Automations, después de los recibos (5/11) | `Lee docs/relevo/pagos-automations-encargo.md y construilo.` |
| Recibos de pago por correo y WhatsApp, con registro en SuperAdmin (construido en `punta/recibos`, 5/11: falta aplicar la 0397 y cargar el 0001 y el 0002) | `Lee docs/relevo/nube-recibos.md y seguimos desde ahí.` |
| Varias claves de Apify (Spy y la biblioteca de carruseles, 5/11) | `Lee docs/relevo/nube-apify.md y seguimos desde ahí.` |
| Vigía de aprobaciones (App Store, Google Play, la extensión, Meta, Google y Resend) | `Lee docs/relevo/nube-aprobaciones.md y seguimos desde ahí.` |
| Código Inmobiliario: el primer contacto, los tickets de una agencia y el aviso de Meta (5/11) | `Lee docs/relevo/nube-codigo.md y seguimos desde ahí.` |
| Approvals (la pestaña, los paneles sin API y la extensión que se publica sola, 5/11) | `Lee docs/relevo/nube-approvals.md y seguimos desde ahí.` |
| Ops Center: la fecha y el «Ignorar» de lo que espera a Martín (migración 0394 sin aplicar) | `Lee docs/relevo/nube-ops-ignorar.md y seguimos desde ahí.` |
| Black November de Leila (la rampa del número, el horario de las prendidas y los bloques de venta de las landings, 5/11) | `Lee docs/relevo/nube-black-november.md y seguimos desde ahí.` |
| Creem fuera: rechazó la tienda (5/11, definitivo); las legales, la moderación sin proveedor y LatAm sin Creem | `Lee docs/relevo/nube-creem-fuera.md y seguimos desde ahí.` |
| La revisión de Creem: /aup, Creem en las legales, la moderación antes de generar y AI Avatar (5/11; superado por el rechazo) | `Lee docs/relevo/nube-creem-revision.md y seguimos desde ahí.` |
| API de MaKo | `Leé docs/relevo/api-mako.md y seguimos desde ahí.` |
| Media Buyer (la tab /ads-manager desde el 25/10) | `Leé docs/relevo/media-buyer.md y seguimos desde ahí.` |
| Zernio y CAPI (Meta por la Zernio del negocio, el token de Meta deprecado, desde el 25/10) | `Leé docs/relevo/zernio-capi.md y seguimos desde ahí.` |
| Ads Manager (historia: la vista que reemplazó el Media Buyer) | `Leé docs/relevo/ads-manager.md y seguimos desde ahí.` |
| Ciberseguridad | `Leé docs/relevo/ciberseguridad.md y docs/relevo/seguridad-aislamiento.md y seguimos desde ahí.` |
| Chats (la bandeja única de todos los canales) | `Leé docs/diseno-chats.md y seguimos desde ahí.` |
| IA del cliente («Tu ChatGPT», su Claude en su PC, la ola 3 con Codex) | `Leé docs/relevo/ia-del-cliente.md y seguimos desde ahí.` |
| MaKo Desktop (el instalador, la firma y «Conecta MaKo»; la app con todas las tabs) | `Leé docs/relevo/mako-desktop.md y seguimos desde ahí.` |
| Leads Scraper | RETIRADO el 25/10/2026 (Hotmart, Skool, Apify y /crm/prospectos): ver `tests/leads-scraper-retirado.test.ts`. No se retoma. |
| Lector de reuniones | `Leé docs/relevo/lector-reuniones.md y seguimos desde ahí.` |
| Tareas de llamada con Mauricio | `Leé docs/relevo/tareas-llamada-mauricio.md y seguimos desde ahí.` |

Y los de ÁREA, que no tienen un chat con ese nombre pero sí briefing propio —se pegan en el
chat que toque ese código: `seguridad-aislamiento.md`, `pixel-clarity-landing.md`,
`avisos-y-whatsapp.md`, `instagram-afuera-y-curso.md`.

**Documentos de tanda o históricos** (no se pegan a un chat; se leen si el briefing de arriba los cita):
`crm-tanda-b1.md` y `crm-tanda-b1.workflow.js` (lo que devolvieron los agentes de la tanda B1 del CRM, 14/10),
`dashboard-v4.md` y `dashboard-v5.md` (los contratos de las tandas del Dashboard), `chatbot-secuencias.json`,
`estrategia-3-cuentas.md` y `estrategia-2-cuentas.md` (los orquestadores anteriores al Cerebro: sólo historia).

⚠️ **Esta tabla la editan varias sesiones a la vez y por eso choca.** Dos sesiones que
agregan su fila tocan la MISMA línea y el rebase da conflicto (pasó el 09/10 entre
`integraciones` y `api-mako`). La resolución es siempre la misma: **se quedan las dos filas**,
nunca se elige una. Si ves marcas de conflicto acá, juntá y seguí.

⚠️ **Antes de actuar sobre un «abierto» o «sin integrar» de un briefing, medilo** (`git cherry origin/main <rama>`,
`git log --since=<la fecha del briefing> -- <archivos>`): el fallo más caro de estos documentos es mandar a resolver lo ya
resuelto (`../relevo.md`, «Lo de arriba no es un detalle»). La fecha de escritura de cada uno está en su `git log`.

El estado completo de la ventana está en [`../relevo.md`](../relevo.md) (OJO: ese está escrito el 14-15/10 y no se
reescribe en cada relevo; para el estado de hoy, el de `cerebro.md`).
