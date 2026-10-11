# Galería v2 de «Nueva automatización», «Pídeselo a MaKo» por la API y el aviso de nuevo agendado — diseño (11/10/2026)

El pedido es la décima tanda (app/admin/dev/chatbot/bitacora.ts, último hito): FEEDBACK NUEVA AUTOMATIZACIÓN 1-9 y GENERAL 7. Es el
CONTRATO de las partes que lo construyen (§6). Lo medido es de producción, sólo lectura (transacción `read only`), el 11/10 a la mañana.

**Lo que no se re-pregunta.** «Todos arrancan vacíos»: lo de fábrica va a la galería y nace APAGADO. Un mensaje de MaKo es una
automatización IDÉNTICA a las demás (docs/diseno-mako-en-whatsapp-unificado.md). Un canal propone y una persona confirma (AGENTS.md).

## 0. Lo medido

| Qué | Medición |
|---|---|
| «🎯 Nuevo agendado» al grupo (`mako_doer_conv`) | ws13: 76 en 30 días (84 en 90); ws1: 3 en 30 días (56 en 90). Último: 10/10 17:30 (ws13). Nadie más |
| Quién PUEDE recibirlo | sólo quien tiene el webhook de agenda en `webhook_routing`: ws1 (Calendly) y ws13 (Cal.com). Con grupo de MaKo hay seis (1, 9, 10, 11, 13, 15) |
| Su interruptor | ningún store lo apaga (`mako.plantillas.store` sin entrada en 1, 3, 4 y 13). ws13 tiene aparte uno propio, «Nueva Agenda VSL», apagado y que nunca salió |
| Filas «Evento de MaKo» (`aviso_mako`) | **cero**, en todos los negocios |
| «Media hora antes» desde el deploy del 11/10 03:07 | 0. En 30 días lo recibían ws1 (7) **y ws11 (4, el mismo lead del 02 al 05/10)**: el §5 del diseño del 11/10 dice «nadie más recibía estos tres», y no es cierto para ws11 |
| `crear_secuencia_mensajes` (API) | 0 llamadas por HTTP (`api_llamadas`) y 0 pendientes: nunca se usó |

**El aviso de nuevo agendado no se perdió**: sigue saliendo por el catálogo (`emitirDelCatalogo`, cuatro llamadas en los webhooks de Calendly y
Cal.com). Nunca fue un mensaje del cliente (no está en `AVISOS_DEL_CLIENTE` en ninguna versión reciente): lo que Martín no ve es la automatización.

## 1. El modal (puntos 1 a 5)

De arriba abajo, sin rótulos de sección (queda sólo el título del Modal, «Nueva automatización»):
1. **«Pídeselo a MaKo»**: la caja de §2, a lo ancho.
2. **Buscador + filtro** en una fila: un campo con lupa y el `Dropdown` de la casa con dos grupos, «Canal» (WhatsApp, Email, Instagram,
   Messenger, MaKo en WhatsApp) y «Objetivo» (Captar, Agendar, Reunión, Recuperar, Vender, Clientes, Cobrar), cada opción con su ícono.
3. **La grilla**: «Lienzo en blanco» PRIMERA SIEMPRE (ningún texto ni filtro la saca), «Pegar lo copiado» si hay algo copiado, y las
   plantillas que pasan el filtro, las del Chatbot y las de MaKo MEZCLADAS, con la misma tarjeta. Sin resultados: «Lienzo en blanco» y una
   línea, «Ninguna plantilla con eso».

- **Sale** «¿Qué la dispara?» (`ROTULO_CRON`, `ElegirClase`, `onCron`) y su consumidor huérfano: `arranque` (ChatAgentApp.tsx:410 y :710,
  el pase por SimuladorWhatsApp.tsx y `arranque`/`claseArranque` de SecuenciaPerfil.tsx:118 y :518). Salen `ROTULO_OTRAS`, `ROTULO_PLANTILLAS`
  y el rótulo de la sección MaKo.
- **«＋ Nuevo mensaje»** (`seccion="mako"`) ya no lleva con scroll: abre con el filtro Canal = «MaKo en WhatsApp» puesto. Se borran el efecto,
  `CADA_MS` e `INTENTOS_MAX`.
- **«Lienzo en blanco»** es `crearNueva()`, la vacía de siempre, con la tarjeta punteada y el ＋ que gira (`CSS_NUEVO`, NuevoPlaceholder.tsx).
  **Decisión tomada (a confirmar)**: el lienzo vacío deja de dibujar la caja «Generar con IA» (SecuenciaPerfil.tsx:822-828). Pedirle a MaKo vive
  en el modal, y «en blanco» con una caja de IA abajo es el botón doble que ya se sacó una vez. La barra «Pídele un cambio» sigue con tarjetas.
  Con el filtro «MaKo en WhatsApp», «Lienzo en blanco» crea una normal: un evento nace sólo de su plantilla (diseño del 11/10, §1).
- **El dato**: cada plantilla gana `objetivo` (a mano: no se deduce). El canal se DERIVA, `canalesDe(p)`: los `canal` de sus mensajes, el CRON
  de Instagram o Messenger, y `mako` si `esPlantillaMako`. Escrito a mano se desincroniza de las tarjetas. `filtrarPlantillas(PLANTILLAS,
  { texto, canal, objetivo })`, puro y con test, busca en nombre + línea sin acentos ni mayúsculas.

## 2. «Pídeselo a MaKo» adentro del modal (punto 6)

- **Se reusa lo que hay**: el campo y el micrófono de `CrearConIA` (`BotonDictar` de app/plan/board/CrearTareaModal.tsx: el dictado en vivo del
  navegador y, de respaldo, grabar y transcribir por /api/plan-dictado), el placeholder que se escribe solo (`EJEMPLOS`) y las fases reales con
  «Cancelar». `CrearConIA` suma `modo: 'galeria'`, SIN `secuenciaId`; al terminar llama `onCreada({ secuenciaId })` y ChatAgentApp cierra el
  modal, recarga y abre esa automatización (`setAbrirSec`).
- ⚠️ **La capa de las fases NO se puede portalear tal cual**: es `zIndex: 125` y un Modal de la pila arranca en 130 (`Z_BASE`,
  app/_components/pila-modales.ts:38). Encima del modal quedaría DEBAJO, sin un error. En `galeria` las fases se dibujan ADENTRO del modal.
- **El server crea la fila AL GUARDAR, no antes.** Hoy crear exige una vacía (`secuenciaId` obligatorio, ia/route.ts:328): con `crear_vacia`
  primero, un «Cancelar» o un fallo de la IA dejaría una automatización vacía huérfana en la lista. Sin `secuenciaId`, la fila se inserta
  (`crearSecuenciaVacia`, lib/setting-secuencias.ts:199) recién después de la revisión, pausada, con el flujo, el CRON y el nombre.
- **Una implementación, dos puertas**: el cuerpo de la ruta (`armarContexto`, `generar`, `crearNuevas` y el guardado) se muda a
  `lib/flujo-ia-crear.ts` (server-only), `crearFlujoConIA({ ws, pedido, secuenciaId?, plazoMs?, signal?, alFase? })`. La ruta lo llama y
  convierte `alFase` en el stream; la API (§4) lo llama sin stream. Sigue sin Claude (`chatCheapCascade` sobre `PROVS_CREAR_IA`).

## 3. Las plantillas que faltan (punto 7)

«Sí» = se arma con los CRON y las tarjetas que ya existen. Instagram y Messenger salen por Zernio: dentro de la ventana de 24 h, o la respuesta
privada a un comentario (una sola, sólo texto, dentro de los 7 días).

| Canal | Plantilla | CRON → tarjetas | ¿Hoy? |
|---|---|---|---|
| Instagram | Comentario → DM | «comenta tu publicación o Reel» → DM con el link → AI Step | Sí, pero con CUALQUIER comentario de CUALQUIER publicación |
| Instagram | **«Comenta la palabra X en un Reel» → DM** | — | **No**: (a) el texto del comentario llega (`EventoSocial.texto`, lib/canal-social.ts:309) y se tira: no se guarda (`ig_mensajes` sólo con `mensajeId`, null en un comentario) ni viaja al motor (`dispararEventoSocial` pasa sólo el subtipo); (b) el CRON no elige la publicación (`comentario_post_id` se guarda y no se ofrece); (c) no hay respuesta PÚBLICA al comentario: lib/zernio.ts sólo tiene `private-reply` |
| Instagram | Respuesta a tu historia → DM | «responde a tu historia» → DM → AI Step | Sí |
| Instagram | Bienvenida por DM | «envía un mensaje» → DM → AI Step (agendar, precio) | Sí |
| Instagram | Link de referencia (ig.me) / comentario en vivo → DM | `ref` / `en_vivo` → DM | Sí |
| Instagram | DM con palabra clave («escribe INFO») | — | No: el CRON no filtra el texto del DM, y el AI Step mira la RESPUESTA a un mensaje nuestro, no el primero |
| Instagram / Messenger | Clic en un anuncio → DM | — | No: el evento `anuncio` está apagado («Todavía no»: Meta lo habilita por cuenta) |
| Messenger | Bienvenida / escaneó tu QR / link de referencia | `dm` / `qr` / `ref` → mensaje → AI Step | Sí |
| Messenger | Comentario en Facebook → mensaje | `comentario` → mensaje | Sí, con la salvedad de Instagram (cualquier comentario) |
| Email | Bienvenida al newsletter (3 correos) | «Se le puso [Suscriptor]» → email → espera 2 d → email → espera 3 d → email | Sí (la galería pide la etiqueta) |
| Email | **Newsletter semanal** | — | **No es una automatización**: un lead entra UNA vez a cada una (`unique (lead_id, secuencia_id)`, mig 0034; el reuso es sólo de la post-agenda, `reusablesDe` en lib/nutricion.ts), así que un Recurrente semanal le llega una sola vez a cada suscriptor, y con el mismo texto. Lo que existe es el envío masivo de /email (`crearBroadcast`, lib/email-marketing.ts). Una tarjeta que lleve ahí la decide Martín |
| Email | Carrito abandonado | — | No: ninguna tienda conectada ni evento de compra (0 integraciones de e-commerce; los webhooks son calcom, calendly, email-entrante, evolution, fathom, meta-leads, resend y zernio) |
| Email | Recordatorio de la reunión por email | Etapa de agendados → «Próxima reunión en ≤ 720 h» → espera «antes de la reunión» 24 h → email | Sí |
| Email | Respuesta automática a un email | «Recibes un email» → email | Sí |
| WhatsApp | Bienvenida al cliente (post-compra) | Primera etapa de la ENTREGA → mensaje → espera 1 d → email con los accesos | Sí |
| WhatsApp | Pago pendiente después de confirmar | Etapa de venta → espera 24 h → «No pagó» → mensaje (a revisar) → AI Step | Sí |
| WhatsApp | Seguimiento después de la reunión | Etapa «asistió» → espera 2 h → «No pagó» → mensaje con IA (a revisar) | Sí |
| WhatsApp | Pedir un testimonio | Etapa avanzada de la entrega → espera 7 d → mensaje → AI Step | Sí |
| WhatsApp | Último intento a un lead frío | Etapa de entrada → espera 7 d → «Nunca te escribió» y «No agendó» → mensaje → AI Step | Sí |
| WhatsApp | Etiquetar a quien dice que le interesa | Etapa → pregunta → «Si responde» (caso «le interesa») → 🏷️ Etiqueta | Sí |
| WhatsApp | Cumpleaños | — | No: el lead no tiene fecha de nacimiento |
| MaKo | Aviso de nuevo agendado | Evento «Un lead agenda una reunión» → MaKo `{{mensaje_mako}}` | Con el evento de §5 |
| MaKo | Aviso de reunión cancelada / de lead de la landing | Su evento → MaKo | Con su evento (§5, segunda tabla) |

- **Por qué un aviso al grupo NO se arma con una etapa** (Producto → «Agendado» → tarjeta MaKo): al prenderla, el CRON de etapa inscribe a
  TODOS los que ya están ahí (`REUNION_POR_DELANTE`, lib/plantillas-automatizaciones.ts), y el grupo recibiría un aviso por cada agendado viejo.
  Y una R2 no cambia de etapa. Por eso es un evento.
- **El CRON de una plantilla** suma dos formas a `CronDePlantilla`: `{ fijo: 'instagram' | 'messenger' | 'email_recibido', evento }`, escrita
  en `disparadores` como la de MaKo (`filaDePlantilla`) pero NO del emisor (se puede cambiar después), y `{ pide: 'etiqueta' }` (el desplegable
  de etiquetas; sin elegir, nace con el CRON a elegir). Cada plantilla nueva pasa `validarGrafo` y el freno de Publicar en el test de siempre, y
  sin datos de un cliente.

## 4. La API: «Pídeselo a MaKo» por WhatsApp (puntos 8 y 9)

**No existe nada así.** El área `chatbot` crea con `crear_secuencia_mensajes`: dos pasos de esqueleto sin texto, el modelo lineal de antes, 0 usos
medidos. **Decisión tomada (a confirmar): se retira** (def, run, su fila de lib/api-mako/rest.ts y su línea del snapshot). Con las dos, el doer
elige por relevancia y puede crear el esqueleto viejo. `crearSecuenciaDesdeEtapa` se queda: la usan la ruta y las semillas.

```
id: 'crear_automatizacion_con_ia', area: 'chatbot', tipo: 'accion', confirmacion: 'chat'
titulo: 'Crear una automatización con IA'
descripcion: 'PROPONE crear una automatización nueva a partir de un pedido en palabras: MaKo arma el CRON, las tarjetas y el nombre (lo mismo
  que «Pídeselo a MaKo» en Automations). Nace PAUSADA: no le escribe a nadie hasta que alguien la active. Si la persona mandó un audio, pasa
  la transcripción.'
parametros: [{ nombre: 'pedido', tipo: 'string', obligatorio: true, max: 2000, descripcion: 'qué tiene que hacer, con las palabras de la persona.' }]
reversible: true, escribe: 'inserta una fila pausada en nutricion_secuencias con el flujo que arma la IA (y las etiquetas nuevas que nombre)'
canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'setting', rolMinimo: 'admin' }
```

- **`chat` y no `pantalla`**: crea algo PAUSADO y gratis, como la que se retira; la automatización misma es la pantalla editable. Un «sí» y listo.
- **Sin `http`**: tarda minutos y `/api/v1` corta a 60 s (AGENTS.md, regla 3), y gasta la IA del negocio. El snapshot no cambia por ésta (sí por la retirada).
- **`preparar`**: pedido no vacío; que haya IA gratis (si no, el error con el link a /integraciones, `falloDeIA`); y **rechaza si viene de un
  flujo** (`ctx.canalKey` con `PREFIJO_FLUJO`). `ctxDeFlujo` usa el canal `app`, así que toda acción `app` aparece SOLA como «⚡ Acción» en los
  lienzos (`accionesParaFlujo` filtra sólo por `visible`); además se saca de esa lista con un `Set` en lib/api-mako/flujo.ts. Resumen: «Crear con
  IA: «<pedido, 120 caracteres>» (nace pausada)».
- **`ejecutar`**: `crearFlujoConIA({ ws: ctx.ws, pedido, plazoMs: 170_000 })` (el turno del doer corre en un `after()` con `maxDuration` 300 y ya
  gastó lo suyo). Éxito → `{ ok: true, resumen, datos: { secuenciaId }, paraLaPersona: '🧩 «<nombre>» quedó pausada. Ábrela y actívala 👉 <link>' }`.
  **El link lo escribe el código**: `linkApp(`/automations?sec=${id}`, ctx.ws)` viaja por `paraLaPersona` (`ctx.aPersona`,
  lib/api-mako/acciones.ts:264), que nunca pasa por el modelo: no hace falta otra captura en lib/mako-doer-in.ts. Fallo → `{ ok: false }` con el
  motivo y NADA escrito (la fila nace al guardar, §2).
- **El doer no conoce la palabra.** `AREA_KEYWORDS.chatbot` (lib/mako-intencion.ts:768) es «secuencias, nutrición, chatbot, bot, seguimiento
  autom, handoff»: desde el renombre a Automations, «créame una automatización que…» no trae ninguna herramienta del área. Suma
  `automatizaci[oó]n(es)?|automations?|flujos?`. El test pasa por el turno que CORRE (`clasificarIntencion` → `herramientasDelTurno`, molde
  tests/agenda-whatsapp.test.ts), con frases como las escribe Martín.
- **La URL (punto 9) ya existe**: `/automations?sec=<id>` abre el lienzo de esa automatización (ChatAgentApp.tsx:487; también por `clave`). Falta
  que la barra la DIGA: al elegir una en la lista, `router.replace` con `?sec=` (el router de app/_ui/Link, `scroll: false`). Si sólo se lee, el
  link que se copia no es la que se está viendo.
- **Pre-push**: `node --import tsx scripts/generar-api-doc.mjs` (sin `--check`) regenera docs/api-mako.md y tests/api-mako-http.snapshot.txt;
  van en el mismo commit que el registro (el chequeo compara contra HEAD).

## 5. GENERAL 7: el aviso de nuevo agendado como Evento de MaKo

- **El evento** (lib/disparadores.ts, `EVENTOS_MAKO` y `SubtipoMako`): `{ subtipo: 'lead_agendo', aviso: 'reunion-nuevo-agendado', label: 'Un lead
  agenda una reunión', trae: ['lead', 'mensaje'] }`. lib/aviso-evento.ts NO cambia: `AVISOS_POR_EVENTO`, el desvío de `emitirDelCatalogo`, la
  salida de /mensajes (`listarPlantillas`) y el rechazo de `configurar_aviso_whatsapp` salen de esa tabla.
- **El catálogo**: `reunion-nuevo-agendado` suma `textoDelCodigo: true`. Sin eso, `conMensaje` no ofrece `{{mensaje_mako}}` y el freno la
  rechaza. Los cuatro llamadores ya pasan `texto` (el de Cal.com con el teléfono y lo completado: Código Inmobiliario pidió «un único WhatsApp»).
- **Los cuatro llamadores pasan `lead: { id, nombre }`** (calendly/route.ts:446 y :608, calcom/route.ts:218 y :267). Hoy no lo pasan, y sin el
  lead la CONDITION no ve nada y `{{lead_nombre}}` o `{{link_lead}}` salen crudos. El dedup no cambia (180 min por reserva + hora): las marcas vivas valen.
- **La plantilla** `mako-agendado` 🎯 «Aviso de nuevo agendado» — «Te avisa en el grupo cuando alguien agenda, con su contacto y el link.» —
  `mako('ma_aviso', '{{mensaje_mako}}', null)`, objetivo Agendar.
- **La mudanza, ANTES del deploy** (scripts/mudanza-nuevo-agendado.mts, simulacro por default y `--aplicar`): en ws1 y ws13 crea la fila desde la
  plantilla (`crearDesdePlantilla`) y la prende por la misma puerta que «Activar»; idempotente (saltea si ya hay una `aviso_mako` con
  `lead_agendo`). Con el código viejo esas filas no corren (su emisor conoce tres eventos) y el aviso sigue por el catálogo; con el deploy pasa a la
  fila. Ni hueco ni doble.
- **Los demás negocios**: hoy no lo recibe nadie más (ninguno tiene Calendly ni Cal.com), así que nadie pierde nada. Desde el deploy, uno que
  conecte su agenda NO recibe el aviso hasta que agregue la plantilla; hoy le saldría solo (`porDefecto: 'on'`). Es «todos arrancan vacíos».

**Otros avisos que conviene pasar a plantilla** (la misma medición, mensajes al grupo en 30 / 90 días):

| Aviso | Hoy lo reciben | ¿Plantilla? |
|---|---|---|
| `reunion-cancelada` | ws1 3 / 3 (último 21/09; Cal.com no lo emite) | **Sí**: evento `lead_cancela`, mudanza a ws1. Misma familia que el agendado |
| `lead-de-landing` | ws13 23 / 24, ws11 2 / 16 | **Sí**: evento `lead_landing`, mudanza a ws13 y ws11 |
| `lead-formulario-meta` | nadie (0 / 0) | Sí: evento `lead_meta`, sin mudanza (no le quita nada a nadie) |
| `cs-cliente-sin-contacto` | ws1 6, ws11 3 | Después: es de la entrega (Customer Success), otra tanda |
| `lead-fusionado` | ws13 23 / 25, ws1 5 / 12 | No: es un aviso de integridad que pregunta («¿lo separo?») |
| «Leí tu reunión», trimestre, objetivos, Pixel y landing, línea, Fathom, reporte | varios | No: son de MaKo misma, preguntan algo o son del super admin |

## 6. Archivos por parte (no se pisan) y contrato

- **A — galería y modal**: app/automations/{GaleriaPlantillas, ChatAgentApp, SimuladorWhatsApp (el `arranque` que pasa y el `?sec=` al elegir),
  SecuenciaPerfil, CrearConIA}.tsx · lib/plantillas-automatizaciones.ts (`objetivo`, `canalesDe`, `filtrarPlantillas`, las plantillas de §3 y
  `mako-agendado`) · lib/plantilla-crear.ts (las dos formas de CRON) · tests/{plantillas-automatizaciones, automations-mako-en-whatsapp,
  chatbot-crear-nueva}.test.ts.
- **B — crear con IA sin id**: lib/flujo-ia-crear.ts (NUEVO, server-only) · app/api/chat-agent/secuencias/ia/route.ts · lib/flujo-ia.ts (si cambia
  el tipo de `EventoIA`) · su test.
- **C — la API**: lib/api-mako/areas/chatbot.{def,run}.ts · lib/api-mako/flujo.ts · lib/api-mako/rest.ts · lib/mako-intencion.ts · docs/api-mako.md
  y tests/api-mako-http.snapshot.txt (generados) · los tests del registro y uno del turno.
- **E — GENERAL 7**: lib/disparadores.ts · lib/avisos-catalogo.ts · app/api/webhooks/{calendly,calcom}/route.ts · scripts/mudanza-nuevo-agendado.mts
  · tests/aviso-evento.test.ts.
- **Contrato**: E exporta `'lead_agendo'` en `SubtipoMako` (A lo usa en la plantilla). B exporta `crearFlujoConIA(...)` →
  `{ ok: true, secuenciaId, nombre, pasos, avisos, disparador } | { ok: false, error, link? }`, y la ruta acepta `modo: 'crear'` sin `secuenciaId`
  (A y C lo usan). Orden: E y B primero, A y C después; la mudanza, antes del push.

## 7. Tests y roturas sugeridas

- **A**: con texto y con filtro, la primera tarjeta es `data-empezar="blanco"` (rotura: filtrarla); `seccion="mako"` pone el filtro (rotura: no
  ponerlo); `canalesDe` de cada plantilla contra una tabla escrita a mano (rotura: cambiarle el canal a una tarjeta).
- **B**: crear sin id no inserta nada si la IA falla o se cancela (rotura: insertar antes de generar).
- **C**: `preparar` desde un flujo rechaza (rotura: sacar el chequeo); «créame una automatización…» trae la herramienta por el turno real
  (rotura: sacar `automatizaci` del regex); `paraLaPersona` trae `?sec=` y `?ws=`.
- **E**: `EVENTOS_MAKO` con cuatro; `pasosDelEvento` traduce `mako-agendado` (rotura: sin `textoDelCodigo`); los cuatro llamadores pasan `lead`
  (rotura: quitarlo de uno).

## 8. No medido

- Si el confirmar de la bandeja (/mako/pendientes) aguanta los ~3 min de `ejecutar` (su `maxDuration`).
- Por qué ws11 recibió «media hora antes» del mismo lead cuatro días seguidos (02 al 05/10, 16:01).
- Cuántos de los 76 «Nuevo agendado» de ws13 son reservas de prueba (cuatro dicen «Codigo Inmobiliario»).
- Si `deIAEdicion` sirve sobre un lienzo vacío (haría falta si Martín prefiere conservar la caja de IA en «Lienzo en blanco»).
