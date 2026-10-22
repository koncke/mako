# Relevo: Automations — la prospección del Sprint de Mauricio (21/10/2026)

> La historia larga del área sigue en [chatbot.md](chatbot.md) (el relevo de siempre de /automations). Éste es el de
> la campaña del Sprint: qué quedó arreglado, cómo se probó en el ws3 y qué falta, con los pasos que mandan WhatsApp
> de verdad escritos para correrlos cuando Martín conecte el chip.

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
  tope por hora a 13+. Lo decide Martín (riesgo de ban: hoy la línea le escribe a 13-16 personas por día).
