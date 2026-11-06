# Auditoría de pedidos pendientes, medida contra origin/main (5/11/2026)

Base: `origin/main` en `660de5707` (5/11 04:12 UTC). Se leyó código con `git show` y `git grep`; no se corrió la app, ni tests, ni se tocó la base. Lo que sólo se comprueba usando la app va como «sin verificar».

Criterio: HECHO = el código está en main. A MEDIAS = existe una parte, o existe pero hay un paso de Martín o una migración sin confirmar. FALTA = no hay código. Sin verificar = depende de la app, de una decisión, o no es código.

## Conteo

Se miraron 142 ítems: los 94 de la llamada con Leila, 20 de las secciones finales de `pendientes-30-10.md`, 11 de la llamada con Juanfran y Joan y 17 de lo prometido a Thiago.

| Fuente | Ítems | HECHO | A MEDIAS | FALTA | Sin verificar |
|---|---|---|---|---|---|
| Leila, bugs 1.1-1.19 | 19 | 5 | 5 | 5 | 4 |
| Leila, funciones 2.1-2.17 | 17 | 4 | 5 | 7 | 1 |
| Leila, decisiones 3.1-3.20 | 20 | 5 | 6 | 1 | 8 |
| Leila, promesas 4.1-4.23 | 23 | 3 | 6 | 1 | 13 |
| Leila, Black November 5.1-5.15 | 15 | 8 | 1 | 1 | 5 |
| Secciones finales (fallas, a construir, tuyo) | 20 | 6 | 5 | 2 | 7 |
| Juanfran y Joan | 11 | 4 | 4 | 3 | 0 |
| Thiago (los ítems de mayor riesgo del doc) | 17 | 5 | 7 | 5 | 0 |
| **Total** | **142** | **40** | **39** | **25** | **38** |

Los ítems repetidos (2.1=4.5=5.4, 2.5=3.7=4.8, 2.14=3.9=4.10, etc.) se contaron una vez por ID, así que un mismo trabajo aparece varias veces.

Sobre Thiago: se contrastaron las 8 que el doc daba por «no existen» y las de riesgo alto y medio-alto. No se re-auditaron las 27 que el doc ya daba por «hechas» ni las de riesgo medio y bajo (tabla de la sección 4 del doc).

Dónde se discrepó con el agente que midió: 2.2 (nombre del contacto en los chats) lo dio como FALTA y está HECHO (`app/chats/FiltrosChats.tsx` «Como lo agendé / Como se llama», `lib/chats-reglas.ts` `VerNombreChats`). Verificado a mano.

---

## 1. Roto para un cliente

### Leila (Black November y herramientas)

| ID | Estado | Evidencia | Si falta, qué hacer |
|---|---|---|---|
| 2.1 / 4.5 / 5.4 Segundo nombre en saludos | HECHO | `6701545e2` (31/10), `lib/nombre-partes.ts`, `lib/variables-del-lead.ts`: `{{nombre}}` salta códigos de país y números; hay `segundo_nombre`, `tercer_nombre` y la lista `crm.nombres.no_son` | Confirmar con Leila que el editor ofrece las variables nuevas (`lib/variables-aviso.ts:288`) |
| 1.7 Automatización que mandó hasta las 23 h | HECHO | `docs/hallazgos-chatbot.md`: fue configuración, no falla. Las que se prenden desde el 30/10 nacen con horario de fábrica 9 a 21 | Ver 5.7 |
| 5.7 Reglas de envío (10 a 20 h) | HECHO, con reserva | `lib/horario-envio.ts` (`mako.horario_envio`) | `lib/nutricion.ts:498`: «por defecto no hay ninguno». Las ya prendidas (12 de 15 negocios) siguen sin horario. Ponerles el de fábrica, o al menos a Leila: `lib/horario-envio.ts` |
| 5.8 Variantes y ramp-up gradual (bloqueo de 24 h en Mauricio) | A MEDIAS | Variantes: `lib/secuencias-variantes.ts`. Rampa de 20 + 20 por día sólo en la difusión (`chatbot.run.ts:134`, `lib/goteo.ts`) | `topeConRampa` (`lib/goteo-db.ts:42`) sólo rampa el email; el tope diario de WhatsApp de las secuencias (`wa.dia` en `lib/limites-envio.ts`) es fijo. Aplicar `arranqueDia` y `arranqueSube` también a `limites.wa` |
| 5.1 / 5.2 / 5.3 Volumen, segmentos por etiqueta, importar CRM | HECHO | `lib/goteo.ts`, `app/crm/leads-importar.ts:35`, `seleccion-difusion.ts` | Límite: no hay un segmento guardado que «mande a un funnel» solo; se hace con filtro más difusión |
| 5.6 / 4.4 / 5.9 Lógica del embudo de Black November | Sin verificar | Es trabajo entre Martín y Leila, no código | — |
| 1.3 Carruseles: aplicar la marca completa | A MEDIAS | Texto, tipografía y fondo se aplican. El chat de Imagen sólo recibe persona y núcleo MaKo (`lib/landing-writer.ts:153`), sin colores ni logo | Pasar colores, logo y fuentes al prompt: `lib/image-editor/chat/ia.ts`, `prompts.ts`. Va con 2.9 |
| 2.9 Brand board (PDF) en el Segundo Cerebro, varios kits | FALTA | No hay código de brand board ni de kits | Pedir el PDF en el onboarding y guardarlo en el Second Brain: `app/second-brain/`, `app/onboarding/`, `lib/image-editor/chat/ia.ts`, `lib/editor-video/chat-catalogo.ts`, `lib/editor-landing/ia.ts` |
| 1.1 Carruseles: el chat no recuerda | HECHO, sin ver en pantalla | `72f13ac7d`, `0d00abc59` (30/10): medido con IA real en ws9, 24 operaciones y 0 descartes | Dos propuestas pendientes aceptadas duplican páginas (`docs/hallazgos-editor-imagen.md`) |
| 1.2 Carruseles: no pone imágenes | HECHO, sin ver en pantalla | `agregar_foto` y `fondo_foto` en `lib/image-editor/chat/catalogo.ts`; el hallazgo dice que no se vio el flujo completo | — |
| 1.4 Pantalla rota con sidebar y chat abiertos, «Página 1, 2, 3» | A MEDIAS | `122071b5c` arregla el encabezado en una réplica, no en el editor real | Mirarlo en pantalla con la barra fijada y el chat abierto: `PageSlot.module.css` |
| 1.5 Carrusel a Web Generator «como presentación» | FALTA | Sin diagnosticar; «usar de guía» no aparece en código | Preguntar a Leila qué pantalla era; `app/image-editor/carruseles/`, `lib/editor-landing/plantillas-presentaciones.ts` |
| 1.6 Chat «oferta con Glitch» buggeado | FALTA | Sin diagnosticar | Reproducir; ver 2.12 |
| 2.12 / 4.12 Discutir / Editar siempre en el chat de edición | A MEDIAS | `SelectorIntencion` está en Automations, Copywriter y Web Generator; no está en el chat de Imagen ni en el de Video | Sumarlo en `app/image-editor/mako/chat/PanelMakoIA.tsx` y `app/video-editor/_opencut/chat/PanelChat.tsx`; que `lib/image-editor/chat/ia.ts` respete «Discutir» |
| 1.12 / 4.13 / 3.13 Conectar ChatGPT/Claude, una conexión sale como no conectada | A MEDIAS | `docs/relevo/ia-del-cliente.md`: «Tu ChatGPT» sin medir; ChatGPT en la PC espera el `codex login` de Martín y `scripts/ia-pc/medir-codex-mcp.mjs` | Ese login y esa medición; revisar por qué una conexión sale desconectada en Ajustes |
| 1.13 / 3.18 Que Claude levante el ticket | A MEDIAS | `levantar_ticket` en `lib/api-mako/areas/tickets.def.ts` y su ruta REST (#44, 3/11). Que Claude la encuentre al conectarse no se ve en código | — |
| 1.14 / 2.7 Subtítulos: resaltado automático y presets | A MEDIAS | Karaoke y resaltado por palabra existen (`text/resaltado.ts`). «Resaltar palabras clave automáticamente» sigue en «Próximamente» (`subtitles/components/assets-view.tsx:224`) | Implementar el resaltado automático y presets por marca o cliente |
| 1.8 Copywriter: arrastrar un bloque deja su contenido atrás | FALTA | `docs/recorrido-visual-30-10.md`: «sin hacer»; BlockNote mueve sólo el bloque arrastrado | `app/copywriter/editor/CuerpoNotion.tsx` (`DragHandleMenu`/`SideMenu`): arrastrar con sus hijos |
| 1.9 Plantilla vuelve a preguntar «¿qué vendo?» | Sin verificar | Esas frases no están en código; hoy `app/copywriter/PanelMaKo.tsx` pregunta «¿Lo adapto a tu oferta?» | — |
| 1.11 MaKo reta por tener varias ofertas | FALTA (decisión) | `alertaFoco` en `lib/offer-reglas.ts:2084` avisa desde 3 ofertas si factura menos de 10.000. Es el método, a propósito | Decidir si se silencia para quien vende varias a propósito |
| 1.10 «Ver ejemplo» escondido | HECHO | `63f5b473d`, `app/copywriter/notion.css` | — |
| 1.15 Video Editor «se volvía atrás» | Sin verificar | Leila dijo que se solucionó | — |
| 1.16 Replicar landing sin imágenes | HECHO | `docs/recorrido-visual-30-10.md` W2: de 0 a 32 de 32 imágenes. `lib/landing-fetch.ts`, `lib/editor-landing/replicar-reglas.ts` | — |
| 1.17 Scrapeo de grupos cae en un funnel por defecto | Sin verificar | `ExtraccionModal` recibe `funnelActivo` (`app/crm/CrmBoard.tsx:3778`); no se ve qué pasa sin funnel activo | Probar sin funnel elegido y obligar a elegir destino |
| 1.18 / 1.19 Desktop sin explicación; Agency en el menú de perfil | FALTA / Sin verificar | Offline existe (`b0c92d59e`); no hay pantalla que explique para qué sirve. Agency fuera de la barra por diseño (`app/_ui/nav.ts:116-127`) | Una pantalla de onboarding de Desktop; acceso más visible a Agency |
| 2.3 / 5.11 «Respondieron» clicable | HECHO | `lib/automatizacion-quienes.ts`, `app/automations/QuienesDeMetricas.tsx`, `app/api/automations/metricas/route.ts` | — |
| 2.2 / 5.5 Nombre del contacto en chats | HECHO | `app/chats/FiltrosChats.tsx`, `lib/chats-reglas.ts` | — |
| 2.13 Plegar la sidebar al entrar a una tab | HECHO | `Sidebar.tsx:105-111`, plegada por defecto desde el 24/10, queda abierta sólo si se fijó | Sumar Create a `RUTAS_QUE_PLIEGAN` choca con una decisión previa; la toma Martín |
| 2.10 / 5.14 Cuenta regresiva, pops de prueba social, escasez en landings | FALTA | No hay nada en `app/web-generator/` ni `lib/editor-landing/` | Bloques nuevos en `app/web-generator/BloqueWeb.tsx` y `lib/editor-landing/`. Lo necesita la landing de Black November |
| 2.14 / 3.9 / 4.10 Carrusel 4:5 también en Web Generator | A MEDIAS | Existe en Imagen (`lib/carruseles/`, `app/image-editor/carruseles/`) | Ofrecerlo en `app/web-generator` |
| 2.15 / 4.9 B-roll y cambio de plano automático (Submagic) | FALTA | No hay en `lib/editor-video` ni `app/video-editor` (`docs/edicion-video-automatica.md` es de anuncios de Flow) | Pipeline de B-roll en el editor de Video |
| 2.4 / 4.14 / 5.10 Mandar mensajes desde los tres puntitos | A MEDIAS | El envío está (`app/crm/seleccion-difusion.ts`, `AccionesLoteLeads.tsx`); el rediseño del desplegable no tiene commit (C4 abierto en `docs/recorrido-visual-30-10.md`) | Rediseñar el desplegable |
| 2.5 / 3.7 / 4.8 Plantillas propias en toda la app, con estrellas | A MEDIAS | Hay «Guardar como plantilla» en Web Generator y tarjetas del CRM, estrellas y galería en `app/creaciones/*` | Faltan plantillas propias en Video e Imagen y compartir con la comunidad |
| 2.6 Estrellas y ranking de plantillas públicas | FALTA | Sin código de ranking | — |
| 2.8 Clips mágicos | FALTA | Sin código | Cortador de video largo a cortos en `app/video-editor` |
| 2.11 / 2.16 / 2.17 Pops exportables, B-roll en blur, arsenal de contenido | FALTA / FALTA / Sin verificar | Sin código | — |
| 4.1 Prueba de 7 días para Percho | Sin verificar | La prueba de 7 días existe (`lib/planes-mako.ts:70`); mandar el link es de Martín | — |
| 4.2 / 4.3 / 4.15 / 4.18-4.23 Reunión del lunes, resolver errores, videos, Loom, anuncios, Zernio | Sin verificar (no es código) | Compromisos de Martín y Leila | — |

### Código Inmobiliario (Juanfran y Joan)

| Promesa | Estado | Evidencia | Si falta, qué hacer |
|---|---|---|---|
| A1 Métrica de tiempo de respuesta de leads (entra al CRM hasta primer contacto) | FALTA | Sólo existe «Tiempo de respuesta» de Chat Analyst (`lib/chat-diseno.ts`, `be54b7222`), que mide conversaciones. No hay campo de primer contacto (grep sin resultados) | Campo «primer contacto» en el lead, la métrica y una pieza en la plantilla Closing: `lib/leads.ts`, `lib/closing-diseno.ts`, `lib/graficos-fuentes-extra.ts` |
| A2 Aviso de Meta «todavía no recibe leads… volver a conectar» estando conectado | A MEDIAS | El texto sigue en `app/integraciones/ConectarMetaZernio.tsx:220` y ahora sale sólo si el webhook no está registrado en Zernio (`lib/zernio.ts:487`); el cron `meta-leads-poll` lo re-registra cada 10 min | Sin verificar que ya no salga en falso. La condición mira lo registrado, no si llegó un lead (`lib/meta-conexion-zernio.ts:98`) |
| A3 Notificaciones, Seguridad e Instalar al inspeccionar | A MEDIAS | Notificaciones volvió (`f6ce96dbf`, ticket #49; `lib/ajustes-secciones.ts:61`). Seguridad e Instalar se esconden a propósito (`:66`) | Decidir si Joan los necesita |
| A4 Plantilla Closing y Fathom al lead | HECHO | `f0027f8db`, `app/dashboard/disenos/HojaClosing.tsx`, `83ef4e3c4`; Fathom: `app/api/webhooks/fathom/route.ts`, `applyFathomRecording` (`lib/leads.ts:1776`) | Falta el «% de tiempo al aire» que se mencionó (`lib/closing-diseno.ts`). Joan debe crear la cuenta de Fathom de Charlie |
| A5 Aviso con el total del 1 al 5 | FALTA | No hay consolidación mensual de agencia (grep sin resultados en `lib/agencia-cobro.ts` y `lib/agencia-cobro-reglas.ts`) | Cron del día 1 que sume los clientes de la agencia y avise: `lib/agencia-cobro.ts`, `app/api/cron/` |
| A6 Reloj automático de 2 semanas por cliente de agencia | A MEDIAS | El mes corre desde que el cliente termina el onboarding (`lib/agencia-cobro-reglas.ts:10`). No hay reloj fijo de 14 días | `inicio_at = alta + 14 días` y que el cron de renovaciones lo respete: `lib/agencia-cobro.ts`, `lib/agencia-cobro-reglas.ts` |
| A7 Partner: 100% del primer mes, link de referidos | HECHO | `lib/partners-reglas.ts:28`, `app/partners/referidos/page.tsx`. Juanfran prefiere recurrente (40% de por vida): no está | Decisión de Martín |
| A7c Prueba gratis de 15 días | A MEDIAS | Sólo hay 7 (`lib/planes-mako.ts:75`); lo de 15 se dijo como ejemplo | Sumarlo si se promete |
| A8 Prioridad a los tickets de Joan y Juanfran | **HECHO** (este renglón decía FALTA: estaba desactualizado el mismo día) | `subirPorAgencia` y la marca `agencia` en el triage (`lib/tickets-reglas.ts:311`, `clasificar` con `deAgencia`), cableado en `lib/tickets-db.ts:305` con `deAgencia: n.identidad.agencia === true`, que sale de `administraUnaAgencia` en `identidadDe` (`lib/tickets-db.ts:146`). Baja→media, media→alta, nunca urgente; lo de un tercero y lo automático no suben; el mazo los pone DETRÁS de los de su prioridad que llegaron solos (`ordenDelMazo`). 5 casos en `tests/tickets-agencia.test.ts`, probados rompiéndolo | — |

---

## 2. Plata (cobros, Thiago)

Reunión con Thiago: HOY 5/11 a las 17 h. Su agencia tiene 27 clientes en España.

| Ítem | Estado | Evidencia | Si falta, qué hacer |
|---|---|---|---|
| B9 Cobro por Stripe en EUR/USD para cuentas de España | A MEDIAS | `lib/agencia-cobro-reglas.ts:128-146` | Lo bloquea un paso de Martín: Stripe en modo real y precios en euros. Sin eso no sale el link y la cuenta queda pendiente |
| B2 «Subime este anuncio» con Drive o video | A MEDIAS | `lib/anuncio-desde-archivo.ts` (`b860ef8f8`), detrás de `ZERNIO_ANUNCIOS_PROBADO = false` (`lib/zernio-ads-cuerpo.ts:28`, confirmado en main) | El clic de la prueba de anuncios por Zernio y poner el flag en true. Hasta entonces, no prometerlo |
| B3 / B4 Media Buyer «Dónde» y «Hasta» | A MEDIAS | `lib/media-buyer/zona.ts`, `corrida.ts:128,146`. Migración `0350` | Confirmar que la 0350 está aplicada en producción; sin ella el campo no guarda y la táctica se aísla (`corrida.ts:173`). No se pudo verificar desde acá |
| B7 Publicaciones recurrentes | HECHO | `lib/calendario-recurrentes*.ts`, cron en `vercel.json` | Confirmar que la 0349 está aplicada |
| B1 Dar de baja la cuenta de un cliente | HECHO | `lib/agencia-baja.ts`, `app/agency/DarDeBaja.tsx`, `1f49ea387`: cancela cobro, revoca cartera y avisa | El doc de Thiago (del 30/10) lo daba por inexistente: ya está |
| B10 Elegir Esencial o Pro al abrir la cuenta | HECHO | `app/agency/NuevoCliente.tsx:50`, `lib/agencia-plan.ts` | — |
| B12 «Lánzame una campaña» | HECHO | `app/ads-manager/NuevaCampana.tsx`, `lib/media-buyer/campana.ts` | — |
| B16 El cliente de agencia no ve «Pasar a Pro», Recomienda ni Partners | HECHO | `lib/agencia.ts` (`esClienteDeAgencia`), `PlanPanel.tsx:38-136`, `nav.ts:622` | El candado de Pro sigue en la barra (`Sidebar.tsx:294`) |
| B11 Leads de formularios por Zernio | A MEDIAS | Barrido cada 10 min y aviso de permiso | Sin verificar con un lead real por Zernio: el doc dice que nunca llegó uno |
| B13 AI Avatar abierto a todos | A MEDIAS | `app/ai-avatar/acceso.ts`. Pide extensión, cuenta de Flow y foto | El motor nunca generó un look en producción; lo prueba Martín |
| B17 Offer: diseño roto | A MEDIAS | Arreglo en main (`d8a25b1c6`) | Sin verificar visualmente. Sin la app de escritorio, el chat dice «Instala MaKo para escribir» |
| B14 Guía «Migrar tu CRM con Claude» y token de agencia | FALTA | Sólo hay la guía de curso (`app/api-mako/articulos-meta.ts:19`); el token se acuña por cuenta (`lib/api-mako/tokens-creador.ts`) | Artículo en `app/api-mako/articulos-meta.ts`, leads migrados sin disparar «Un Lead Entró», y un token para toda la cartera |
| B15 «Usar en un anuncio» desde editores y AI Avatar | FALTA | Sólo «Publicar en redes» (`EditorGuion.tsx:339`, `DownloadDialog.tsx:382`) | Botón que llame a `proponer_crear_campana` (`lib/api-mako/areas/ads.def.ts:953`) |
| B6 «Guardar en MaKo» desde perfil de Instagram o LinkedIn | FALTA | Sin coincidencias en `extension/` | Botón sobre el perfil, de a uno: `extension/` |
| B5 / B8 LinkedIn en Chats y en Automations | FALTA | `lib/zernio-redes.ts:94`: «Sus mensajes no llegan a MaKo». Decisión de Martín pendiente | Decidir: no oficial, partner o no hacerlo |

Decir hoy a Thiago que NO existe: LinkedIn en Chats y Automations; «Guardar en MaKo» desde Instagram y LinkedIn; la guía «Migrar tu CRM con Claude» y el token único (sus 27 clientes se migran de a una cuenta); «Usar en un anuncio»; «Súbeme este anuncio» con archivo nuevo (hasta el clic de Zernio); cobro en EUR por Stripe (hasta que esté en modo real).

Otros cobros:
- Pasarela: Stripe real y precios en euros son tuyos (sección «Lo que es tuyo»).
- Newsletter: A MEDIAS. Las cuatro fallas están cubiertas (`8342021ab`, `app/newsletters/puerta.ts`), pero la migración 0351 sigue sin aplicar y quedan M5 y las bajas (`docs/hallazgos-newsletters.md`). Hoy nadie tiene el email prendido.

---

## 3. Lo que traba a Martín

| Ítem | Estado | Evidencia | Qué hacer |
|---|---|---|---|
| Image Editor usa Gemini por defecto (Martín decidió «sin Gemini», 22/10) | FALTA | `lib/model-catalogo.ts:245`: `image-editor-ia` con `def: GEMINI()`. El catálogo tiene 57 defaults con Gemini (Video, Copywriter, landing, Newsletter) | Cambiar el default y el comentario de `lib/image-editor/chat/ia.ts:6`; si «sin Gemini» es global, repasar los 57 |
| MaKo toma la iniciativa: primer ingreso y aperturas por tab | A MEDIAS | `lib/aperturas/` sólo tiene `ops.ts`, `comunes.ts` y `reglas.ts`. Falta bienvenida, cargar oferta, elegir funnel, y las aperturas de CRM, Dashboard, Automations, Web Generator, Calendario, Video, Image, Classroom, AI Avatar y Mobile | Un archivo por tab en `lib/aperturas/` y `app/api/aperturas/route.ts`, según `docs/mako-iniciativa/plan.md` |
| Plantillas con estructura y «Ver ejemplo» en todas las tabs | A MEDIAS | Está en Copywriter, `app/_crear` e Image | Sumarlo al resto |
| Lead Magnet Generator | A MEDIAS | Competitors Spy está construido; `app/lead-magnet-generator/page.tsx` sigue en `ComingSoon`, sin backend | Construir el generador |
| Patrones de email usados de verdad | A MEDIAS | El documento está (`docs/conocimiento/patrones-email.md`); no se verificó que Copywriter, Newsletter, Automations y WhatsApp los usen | Medirlo |
| Video Editor «revisá bien todo» (cabecera y Motion) y recorrido visual (faltan 14 pantallas, 22 problemas sin repartir) | Sin verificar | Necesita ojo | Motion está suspendido a propósito (`nube-ramas.md`, rama `motion-imagen-2610` anotada, no subida) |
| Conocimiento de cursos modular | HECHO | `31197c0de`, `8db0b2108`, `lib/knowledge*.ts` | — |
| Calendario y Classroom (privacidad de fichas), botón de MaKo que tapa contenido, Zernio «pausa», restos de tickets | HECHO | `docs/hallazgos-customer-success.md:6125`, `246bae899`, `f68c2d37c` | Por medir en pantalla: el botón en Plan, CRM y Dashboard |
| Tuyo: look real del AI Avatar, grabación de Fathom a Thiago, Stripe real y euros, clic de anuncios por Zernio, decisión LinkedIn | Sin verificar | Son pasos de Martín | — |

Lo que dejan a medias los relevos de la nube (`docs/relevo/nube-*.md`, `cerebro.md`):
- Grupos en la app (Joan): rearmado en `punta/grupos-app`, falta probarlo en producción en el ws3 (`nube-grupos.md`). Después, la rama `avisos-bot-corte-0311` con el sí de Martín.
- Email de Mauricio (`nube-email.md`): el envío real del ws1 sigue apagado hasta que confirme; la tarjeta de Resend dice «conectada» con la clave de MaKo (`lib/integraciones.ts`).
- Grabar llamadas (`nube-grabar.md`): falta aplicar la migración 0390 para usarlo.
- Tiendas: nada enviado a revisión; esperan a Martín 6 testers, DSA de Leandro y crédito de IA del revisor (`docs/tiendas-play-appstore.md`).
- Gurús del Ops Center (`nube-gurus.md`): las 10 fichas están escritas pero faltan las caricaturas.
- Spy (`nube-spy.md`): los anuncios por Apify están armados y apagados (`ANUNCIOS_POR_APIFY = false`), falta medir el actor.
- Carruseles de Instagram (`nube-carruseles.md`): falta volver a clasificar lo guardado y mirar la pantalla; quedan US$1,07 de crédito del mes.
- Ticket #58 (agendar el pago de la segunda cuota de Giselle Belanti para el 19/12): hay que pedírselo de nuevo cuando llegue el arreglo del eco (`cerebro.md`).
- Ticket #57 y Funnel Coach: chocó al llevar a main (`punta/ticket-57`).
- Lo que espera a Martín (`cerebro.md`): instalar el servicio del Runner, subir el tope de Actions a US$130, correos de 12 a 15 testers, clave de Resend y plan para Mauricio, clave de Apple Push, prototipo del chat móvil.
- Migraciones que no pude confirmar como aplicadas: 0349, 0350, 0351, 0390. Hay que medirlas contra la base (yo no la toco).

---

## 4. Funciones nuevas (BAJA y decisiones de Martín)

Sin código aún o sin verificar: 3.2 plantillas «de influencers» (A MEDIAS), 3.3 / 3.4 Estratega multicanal y unión con el script de Leila (A MEDIAS, hoy el Media Buyer sólo hace Meta Ads), 3.5 AI Avatar (en curso), 3.6 «¿qué hago acá?» con tutorial personalizado (A MEDIAS: existe `app/_ui/guia/`), 3.8 QA con Claude simulando usuarios (sin script), 3.17 Classroom desde el Segundo Cerebro (FALTA), 3.1 Competitors Spy (HECHO), 3.14 programar desde el calendario (HECHO), 3.15 Zernio sin costo por mensaje (dato, sin verificar), 3.11 / 3.12 / 3.16 / 3.20 (sin verificar).

## Cosecha

No se escribió nada en el repo (auditoría de sólo lectura). Los hallazgos que ahorran tiempo, para llevar a `docs/hallazgos-<área>.md` cuando se arreglen:
- 1.7: el diagnóstico obvio («falla del motor») era el equivocado; era configuración, y sin horario nada cierra el envío. Sigue vigente para los negocios ya prendidos.
- Privacidad de fichas en Customer Success: el diagnóstico obvio era el equivocado (`docs/hallazgos-customer-success.md:6125`).
- Un doc de promesas queda viejo en 5 días: `docs/promesas/2910-llamada-thiago.md` daba por inexistentes «dar de baja», «Lánzame una campaña» y las publicaciones recurrentes, y ya están en main.
