# Relevo: Automations — la prospección del Sprint de Mauricio (21/10/2026)

> La historia larga del área sigue en [chatbot.md](chatbot.md) (el relevo de siempre de /automations). Éste es el de
> la campaña del Sprint: qué quedó arreglado, cómo se probó en el ws3 y qué falta, con los pasos que mandan WhatsApp
> de verdad escritos para correrlos cuando Martín conecte el chip.

## LO ÚLTIMO: 24/10/2026 noche, cuenta 5 (claude5, «Ananda»), rama `aut-2510`

Martín: «eso si es un bug, el goteo debe comenzar a contar desde que se envia el primer mensaje», y sobre la cuenta de
anuncios de Mauricio: «para esto tenemos las notificaciones de advertencia al grupo de mako».

- **El goteo de la #289, medido en producción** (`scripts/medir-goteo-tras-deploy.mts`, sólo lectura, cada negocio en SU
  base): «Contestó» corta (4 de 4). Desde el deploy (~18:06 ART) no salió ningún M1 nuevo; para ver el ritmo de 11 min y la
  condición sin turno hacen falta M1 NUEVOS (que Mauricio mueva leads a «Prospección activa»). Volver a correrlo entonces.
- **Lo agendado antes del deploy sigue con el reloj viejo** (20 activas, M2 de 24 min a 14,7 h tarde).
  `scripts/recalcular-esperas-viejas.mts --ws=1 --sec=289` lo pone en «último mensaje + la espera»; simulado, no aplicado:
  el permiso frenó escribir en la base de Mauricio y se le preguntó a Martín por el cartero (pregunta 33b2217e). Con su sí:
  el mismo comando con `--aplicar` (las horas viejas quedan impresas). Después de las 13:00 ART del 25/10 ya no sirve: los 7
  atrasados habrán salido.
- **P11, el aviso de la cuenta frenada** (`scripts/medir-aviso-cuenta-frenada.mts`): llegó al grupo de Mauricio 26 veces el
  15 y 16/10 y calla desde el 16/10 por el techo de 3 (la cuenta sigue impaga). Si vuelve a avisar un incidente de días es
  decisión de Martín (docs/hallazgos-comunicacion.md, «Una alerta con el techo agotado…»). La cuenta compartida ws1/ws4
  avisaba con dos relojes: arreglado en `lib/alerta-critica.ts`.
- **Los tres rojos de main** (vuelo-mako, dashboard-pedidos-chat, paso-ia): tenía razón el código en los tres; los tests
  fijaban líneas viejas. Al día y probados rompiéndolos.
- **Sin dueño, visto de paso:** `tests/progreso.test.ts` rojo por dos hitos sin `sesion` en
  app/admin/dev/ai-runtime-cascada/bitacora.ts (chat «IA del cliente»). Y el hito de esta tanda firma `claude5`, que en
  `CUENTAS` (app/admin/dev/_registro/tipos.ts) entra con d7b1f9849 del tren (`tren-j`).
- **El arreglo del goteo, visto andar (22:00 ART):** los M2 de las 21:34, 21:46 y 21:58 dejaron la espera siguiente a
  48,00 h exactas. El aviso de arreglo al grupo de Mauricio está probado en seco (`scripts/avisar-arreglo-al-grupo.mts
  --ws 1 --clave goteo-espera:289:2410 --commit cdadbc30f --ws1-seguro`, el texto en docs/hallazgos-chatbot.md). Mandarlo
  (`--enviar`) lo frenó el permiso de la sesión: lo autoriza Martín. No se le pide a otro chat.
- **Dashboard (trabajo 0786cbfe, «Sí, y que la criatura vea la hoja»):** salió el AI Analyst y la estrella ve la hoja
  (eb71fa238; docs/hallazgos-graficos.md). Sin verlo en pantalla.

## El pedido, con el texto entero

Martín, 21/10/2026 (llegó por el Cerebro): «que pruebes y valides que todo funcione bien en Automations de punta a
punta para que con Mauricio podamos hacer esta estrategia de prospección con todos los contactos que tiene en su CRM
que nunca fueron contactados para ofrecerle su nuevo low ticket». Es el «Sprint de Diseño para la Ejecución
Empresarial»: 18 al 20/11, USD 270, Stripe, https://sprint.mauriciobustos.com/. El plan de Martín: un CRM nuevo de
prospección con etapas propias; MaKo manda SOLO la apertura (algunos audio, otros texto) a lo largo de unos días;
cuando alguien responde, MaKo le avisa a Mauricio y él sigue A MANO desde Chats.

El relevamiento previo (sólo lectura, con las trampas medidas): C:/dev/cerebro-herramientas/automations-mauricio-21-10.md.

## Qué quedó (rama `aut-prospeccion`, worktree C:/dev/wt-aut-prospeccion, encima de origin/main 2d1d099e0)

1. **El CRM nuevo alcanza a sus leads AGREGADOS.** El CRON por etapa (y el de etiqueta) de una automatización que
   declara un CRM ve también a los de `lead_funnel`, en la etapa que tienen en ESE CRM; la ventana de 90 días mira cuándo
   se los sumó o movió ahí; sólo abiertos; la fila que nace con el lead no entra (la casa ya lo saludó). Medido: ws3
   0 → 288; producción, las 20 cohortes activas iguales.
2. **«Mover de etapa» corre en el CRM que eligió el paso** (agregado → su tarjeta; casa → la casa; donde no está, no
   mueve), sin romper las automatizaciones sin CRM.
3. **«Sale sola» de vuelta, a la vista**, por tarjeta de WhatsApp no oficial, con lo que pasa en cada caso.
4. **El aviso lleva a la charla:** `{{link_chat_lead}}` y la línea «💬» en el aviso armado; la plantilla «Un Lead Te
   Escribió» la trae.
5. **Primero lo que entra:** un lead que llegó por un canal o agendó en 24 h va primero en la cola, y una campaña deja
   una reserva del cupo (6/día y 1/hora de fábrica). Dicho en Configuraciones › Límites.

Revisión adversarial del motor hecha (frenó cuatro cosas, arregladas en el segundo commit). Cosecha en
docs/hallazgos-chatbot.md («La prospección del Sprint»), hallazgos-pagos, hallazgos-crm y la regla en AGENTS.md.

## La prueba en el ws3 (Cliente de Prueba), hasta donde llega sin chip

Hecho en el Chrome de Martín (super admin, `/api/auth/me`: martinkoncke, capa superadmin, ws 9), viendo el ws3:

- PASO 0: el ws3 sin línea conectada, envío apagado, 0 leads con teléfono ajeno (medir-ws3.mts).
- PASO 2: CRM **#43 «Sprint de Diseño»** tipo Prospección: Por contactar (`lead`) · Contactado (`st1`) · Respondió
  (`st0`) · Agenda R1 (`agenda`, de fábrica) · Interesado (`conversando`) · Pagó (`ganado`) · No interesa (el perdido).
  Etiquetas #8 «Sprint · texto» (0 leads: ver el tope de 200 en hallazgos-crm) y #9 «Sprint · audio» (3 leads).
- PASO 3: «Datos de Mau → Leads del CRM»: 300 leads, teléfono `+000000…` y email `leadN@prueba.local`, casa en el CRM
  principal #39; los 301 (con el «Lead de Prueba») AGREGADOS al #43 en «Por contactar» — igual que la base de Mauricio.
- PASO 4/6 (la trampa 1 y su arreglo), medido con `leadsDeCohorte` en cada árbol, sólo lectura: CRON «Sprint › Por
  contactar» → **origin/main 0, con el arreglo 288**; la etiqueta «Sprint · audio» en el CRM Sprint → 0 / 3; el CRM
  principal sin cambios (1 / 1).
- PASO 5: automatización **#288 «Sprint · apertura»** armada en el lienzo, SIN publicar: CRON Sprint › Por contactar
  (Reentrada «Una sola vez») → «Nunca le escribiste» → «Tiene Sprint · audio» → WhatsApp (pie del audio) / WhatsApp
  (texto) → ⚡ Mover de etapa → Sprint › Contactado. «Si responde» con un caso «Respondió» (cualquier mensaje) y su
  «Si no» → MaKo en WhatsApp («💬 {{nombre_completo}} respondió… síguelo a mano desde Chats») → ⚡ Mover de etapa →
  Sprint › Respondió. Al Publicar saltó el aviso de Prospección («revisa su horario y sus límites»).
- **Lo que NO se pudo:** ni Publicar ni «Probar» abren sin una línea: los dos abren «Vincular número». Al abrirlo se
  creó la fila `mako_ws3` en «conectando» (sin QR escaneado: no manda nada). El audio no se grabó (no hay «Audios
  guardados» en el ws3 y grabar es el micrófono de Martín): la tarjeta de audio tiene sólo su pie.
- ⚠️ Lo que está en pantalla es PRODUCCIÓN: «Sale sola» y `{{link_chat_lead}}` aparecen recién cuando esta rama se
  despliegue. Hasta entonces, «Mover de etapa» del Sprint escribiría `st1` en la casa (el bug de arriba): no prender
  #288 antes del deploy.

## Los pasos que mandan WhatsApp de verdad (7 a 10), para el Cerebro cuando Martín conecte el chip

Antes de cada uno, repetir el PASO 0 (`medir-ws3.mts`). Nunca en el ws1; la línea de Mauricio no se toca.

0. **Requisitos:** esta rama desplegada. Un chip de descarte escaneado en el ws3 (/chats o /whatsapp?canal=no-oficial,
   ya existe la fila `mako_ws3`). El número de dueño en Configuraciones › Notificaciones = el de Martín (crea el grupo
   «MaKo <> Cliente de Prueba»). «Eliminar los datos de Mau» (o quitarlos del Sprint), y crear a mano en el CRM
   principal #39 UN lead con el número de Martín (sin origen: no cuenta como «entrada») y sumarlo al Sprint con
   «Funnel»; con la etiqueta «Sprint · audio» si se quiere el audio. En Configuraciones › Límites: 2 por día, 1 por hora
   (la reserva deja 1 por día para lo que entra: la campaña manda 1 por día).
1. **En #288:** grabar el audio en la tarjeta de audio; prender «Sale sola» en las DOS tarjetas de WhatsApp; Publicar
   (aceptar el aviso de Prospección); en el «{ }» de la tarjeta MaKo se puede sumar «Link a su conversación» (igual sale
   solo en «Si responde»).
2. **PASO 7 «Probar en WhatsApp»** al número de Martín: llega «🧪 Prueba de MaKo» con el audio o el texto y el link.
3. **PASO 8 envío real:** Activar #288 y «Chatbot: ON» en /whatsapp del ws3; esperar el barrido de la hora. Se da por
   bueno si: hay una inscripción y un `nutricion_envios` 'enviado'; la apertura llega sin «🧪»; el lead pasa a
   «Contactado» en el Sprint y su etapa PRINCIPAL no cambia; 0 filas en `wa_borradores`.
4. **PASO 9 el lead responde:** Martín contesta desde su teléfono. Se da por bueno si: la inscripción queda 'respondio';
   al grupo llega el aviso con la cita, la ficha y **💬 la charla**; el lead pasa a «Respondió» en el Sprint; MaKo NO le
   contesta; la charla está en /chats.
5. **PASO 10 a mano:** desde el link del aviso, contestar en /chats con el link del Sprint; MaKo no se mete después.
6. **Cerrar:** «Chatbot: OFF», archivar #288, desconectar el chip si es prestado.

## 22/10: la llamada con Mauricio cambió el plan

La lista entera (A1-A7, con la cita de Fathom 195129619): C:/dev/cerebro-herramientas/feedback-llamada-mau-22-10.md.
**El plan nuevo:** Mauricio armó el CRM **«Sprint 3 días» (#44 en el ws1)**: Lead entrante → Prospección activa → Oferta /
Checkout → Ganado → Grupo de WhatsApp → Webinar. Trae ~1.050 leads a «Lead entrante» y cada día mueve A MANO 50 a
«Prospección activa»: ESO dispara la apertura (CRON en «Prospección activa», nunca un barrido de «Lead entrante»). Los
envíos empiezan el sábado 24/10, 50 por día, hasta el 13/11. La secuencia honesta: el .md de la campaña
(campana-sprint-mauricio.md en la carpeta del proyecto). El «Hola, ya me llegó tu pago…» que se pegó en la llamada NO
se arma: es un recibo falso.
> Corregido el 23/10 por Martín: es a propósito, la técnica de levantamuertos (confirmar un pago para después disculparse, sólo para que respondan el primer mensaje). No se marca ni se toca.

Lo que quedó en la rama (encima de 9c8f106c0):

1. **A3 — goteo por automatización** (2b5a03115): en Configuraciones › Límites de cada automatización, «Uno cada N
   minutos» y «Hasta M por día», adentro del tope de la línea (que sigue siendo el techo anti-ban). Lo frenado por el
   goteo pasa a su turno; por la API de MaKo, `configurar_automatizacion` con `goteoMinutos` / `goteoPorDia`.
2. **A1/A2 — el chat obedece** (bbbfe38ff): arriba del composer, **Discutir** (sólo contesta) o **Editar** (cambia el
   flujo; nunca explica; los textos pegados van tal cual). La charla viaja al modelo: «hazlo como te lo indiqué» ya
   tiene a qué referirse.
3. **A4 — la plantilla «Prospección: apertura»** y **A5 — el aviso dice qué etapa y de qué CRM** (661146056). A5 no era
   un cache: «Contactado» no existe en «Sprint 3 días».

**La cuenta de la línea del ws1 para que pasen 50:** reserva para lo que entra (10/día, 1/hora) + las bienvenidas +
la campaña. Con goteo de 5 min la campaña pide 12 por hora: línea en **65 por día y 15 por hora**.

**A6, cómo quedó en el ws1 (22/10 ~04:18, en producción 4de3fe769, run 232):** #289 «Sprint · apertura», **pausada**,
0 inscripciones. CRM #44, CRON `etapa_actual` en `st0` = «Prospección activa». Tres tarjetas: «Nunca le escribiste» →
WhatsApp «Hola {{nombre}}, soy Mauricio. ¿Sigues al frente de tu empresa?» (para aprobar: «Sale sola» lo decide
la reunión) → «Si responde» = AI Step sin escenarios (no contesta: avisa al grupo con el link a la charla), objetivo «…lo
pase a «Oferta / Checkout» cuando le mande el link». Goteo 5 min / 50 por día. Línea del ws1: `mako.limites_envio` =
65 por día y 15 por hora (era la de fábrica, 40 / 6). Se hizo con Chrome desconectado, por las funciones de la pantalla
(`publicarPasos` con las comprobaciones de la ruta, `descartarBorradorSecuencia`, `guardarConfigAutomatizacion`,
`limitesParaGuardar` + `setSetting`), y se releyó contra `grafoDeSecuencia`. Salió: la rama «Tiene Sprint · audio» (el
audio #1 era la «Bienvenida» de agosto, con un pie inventado) y **un borrador vigente con el recibo falso** («Hola
{{nombre}}! ya me llegó tu pago, muchas gracias» + «¿Me das tu email para registrarte?»), que era lo que abría el lienzo.
> Corregido el 23/10 por Martín: es a propósito, la técnica de levantamuertos (confirmar un pago para después disculparse, sólo para que respondan el primer mensaje). No se marca ni se toca.
Si Mauricio graba el audio del Sprint, la rama se vuelve a armar con su etiqueta. **Falta mirarla en pantalla** cuando
vuelva la extensión de Chrome.

## Sin hacer (con dónde vive)

- El pago por el link propio de Stripe no entra a MaKo; con el link de MaKo gana al lead en su casa y la tarjeta del
  Sprint no pasa a «Pagó» (hallazgos-pagos; lib/cobros-webhook.ts, lib/cobros.ts).
- Los agregados entran sólo por el barrido de la hora, no por un evento (`agregarAProducto` / `moverEtapaEnProducto`,
  lib/lead-funnel.ts, no llaman a `enrolarPorEvento`).
- La etapa de un agregado no se deriva (agendar no lo mueve en ese CRM): un «Sigue en la etapa» le seguiría escribiendo
  a quien agendó (lib/condiciones-catalogo.ts).
- En un CRM agregado, «Mover a Ganado» no registra la venta ni lo dice; `setPipelineStage` acepta una key que el CRM
  del lead no tiene (lib/leads.ts).
- La tarjeta MaKo en «Si responde» sale con el formato armado aunque sea «tal cual», y Publicar rechaza
  `{{lead_escribio}}` ahí (lib/mako-tarjeta.ts `armarAvisoDeTarjeta`, lib/tokens-del-flujo.ts `contextoDeTarjeta`).
- Publicar y «Probar» exigen una línea conectada aun para el simulador (app/automations, `ConectarMedio`).
- La etiqueta en lote corta en 200 sin decirlo antes (app/api/crm/etiquetas/route.ts).
- Para Mauricio: 1.094 nunca contactados a 40/día son ~28 días; una semana pide ~157/día (el máximo es 150) y subir el
  tope por hora a 13+. Lo decide Martín (riesgo de ban: hoy la línea le escribe a 13-16 personas por día). 22/10: se
  decidió 50 por día, moviéndolos a mano (arriba).
- A7: el link al grupo de WhatsApp después de «Ganado» espera el link que pasa Mauricio.
- Al CREAR (no al editar), el modelo sigue inventando el texto de una tarjeta de audio que la persona graba ella;
  crear no tiene «Discutir / Editar» (app/api/chat-agent/secuencias/ia/route.ts, rama `crear`).
- Los días del goteo son los del horario propio de la automatización; no hay un «sólo estos días» aparte del horario
  (lib/config-automatizacion.ts).
- **AU4 (P2), después de que entre el AU2:** (1) ChatMako pasa a CajaChat + HiloMako (app/_chat) con SU motor
  (/api/chat-agent/secuencias/ia: crear en el lienzo vacío, las fases, el borrador en vivo), y Discutir/Editar va al
  slot de modo de la pieza (Discutir = 'analizar', Editar = 'editar'); cuidar lo del 22/10 (el mensaje al instante y
  «Reintentar», la capa en toda la pantalla, las fases en una línea: tests/chat-mako-envio-a-la-vista.test.ts). (2) La
  «Pídeselo a MaKo» de la galería (CajaPedido) pasa a CajaChat. (3) La estrella (`MakoEnLaTab`, OC6) CONVIVE, no
  reemplaza: `tab="Automations"`, `entidad={{ tipo: 'automatizacion', id: <secuenciaId>, titulo: <nombre> }}`,
  `modo="analizar"` (lo general con la automatización de contexto; su turno es el del Cerebro, por la API de MaKo, sin las
  fases ni el borrador). Que la estrella edite el lienzo en vivo sería otra pieza (el Cerebro llamando a esta ruta): se
  decide con Martín antes. Las charlas del lienzo ya se ven en el Ops Center (OC5), de sólo lectura.
- Cuando IA16 (chat «IA del cliente») esté en main: sacar de `sinIAPropia` las ramas «La IA gratis de MaKo llegó a su
  tope / está al tope / está saturada / no contestó» (con IA16 la red no corre fuera del ws9) y dejar «No tienes una IA
  conectada: conecta {SU_IA}» y los dos marcadores de red salteada (lib/flujo-ia.ts; su test,
  tests/ia-aviso-sin-ia-propia.test.ts). IA16 está retenido hasta que el ws1 conecte su IA o el lunes 26/10.
