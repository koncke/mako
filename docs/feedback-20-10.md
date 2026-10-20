# Feedback de Martín · 20/10/2026

Lo pidió en la app, al chat del Cerebro, con cuatro capturas: Automations de Leila (ws11), la tarjeta, el Ops Center y
el Offer de Florencia (ws21). Las capturas están en la carpeta compartida de los chats
(`side-session-notes/local_797d5445-…/feedback-20-10/`), no en el repo, porque son de clientes.

Antes de repartir, cinco agentes investigaron un punto cada uno, en sólo lectura contra producción. Lo aprendido quedó
en los hallazgos de cada área (se nombran abajo). Este documento es el **registro**: qué pidió, de quién es y en qué
quedó.

## Los cinco puntos

### 1. «El chat de OFFER no está llegando al Ops Center, eso está muy mal»
- **Causa:** Offer guarda en `offer_sesiones` y el Ops Center sólo lista `chart_sessions` con la clave exacta
  `mako-movil:<persona logueada>`. Hoy ninguna tab llega: ni Offer, ni Automations, ni CRM, ni Dashboard.
- **Lo que hay:** 6 conversaciones de Offer (ws1 ×2, ws10, ws11, ws13, ws21), y ninguna se ve.
- **Trampa al verificar:** Martín, mirando un ws como super admin, ve SUS chats, no los del cliente. Se mide en la base.
- **Encargo:** **Ops Center 3**. Una proyección sin copia: el índice por origen de la decisión 5 de
  docs/diseno-mako-ai-native.md, con Offer primero.
  - Coordina con Onboarding para que la conversación del onboarding no salga dos veces.
- **Hallazgo:** docs/hallazgos-second-brain.md.

### 2. «Florencia debería haber llegado a un chat llamado "Onboarding" en su Ops Center... Y no llegó»
- **Causa:** el chat «Onboarding» (13b, b222b34fc) no está desplegado. Y aunque se suba, sólo lo crea a quien termine
  DESPUÉS. Florencia terminó el 18/10, y el ws21 tiene 0 chats.
- **Encargo:** **Onboarding**, que además tiene que cubrir a quien ya terminó.

### 3. «Hizo muchas cosas mal el onboarding… no supo identificar cómo se llama su negocio» + la llamada 864249059
- **La llamada:** es su onboarding en vivo, del 18/10 (3 h 30 min).
- **El nombre:** «mi marca personal: Florencia Ayelen Carballo» salió de un regex que no entiende «mi marca personal:».
  - Se escribió sin confirmar en el ws, el funnel 40, el producto 48, el PDF y El Archivero.
  - En la llamada ella dice [00:06:19] que la marca ahora es su nombre: «Florencia Ayelen Carballo».
- **Duración:** 45 minutos contra «menos de 5».
  - Con las 3 piezas anotadas, MaKo siguió 6 preguntas y 10 minutos más, porque el cierre lo decide el modelo.
  - Preguntó el precio 4 veces.
- **Lo que quedó mal guardado:**
  - Respuestas rápidas inventadas por MaKo quedaron como datos de su oferta.
  - «sin dato:» llegó a la promesa y al PDF.
  - Dijo «vi tu Instagram» sin haberlo leído.
- **De la llamada, para Onboarding:**
  - un texto de más de 12.000 caracteres rebota;
  - las preguntas con opciones no aceptan texto;
  - la salida no pregunta qué hacer primero ni muestra el soporte.
- **Encargo:** **Onboarding**, todo junto con el punto 2.
- **Reparar el ws21:** es una escritura en una clienta, así que espera el sí de Martín.
- **Hallazgo:** docs/hallazgos-onboarding.md.

### 4. «Leila le pidió una automatización usando el CRON de Recurrente, y creó cualquier cosa»
- **Causa:** «Crear con IA» no puede poner un Recurrente: `opcionesCronIA` lo excluye a propósito.
  - Eligió la etapa de nombre más parecido («sesión» → «1ª sesión sin costo»).
  - Mandó a una sola etapa en vez de a todo el funnel.
  - No avisó que se perdía «martes 15:00».
- **Las tarjetas que nadie pidió** salen de la regla 8 del system de crear («completa: aviso al equipo, si responde…»).
- **«Cambié 2»** es por diseño: el resumen sólo cuenta.
- **Trampa del motor:** un Recurrente semanal le llega UNA vez a cada lead.
- **En vivo:** la #284 está ACTIVA. Alguien la prendió a mano y le sumó un Recurrente los martes 16:15, pero sigue el
  disparador equivocado. No sale nada solo: los borradores esperan aprobación. Qué hacer con ella lo decide Martín.
- **Encargo:** **Automations**.
- **Hallazgo:** docs/hallazgos-chatbot.md.

### 5. «El chat de Automations… SIEMPRE abierto en donde está la sidebar… ¿No tienes el registro?»
- **Sí estaba registrado.** Lo pidió el 16/10 a las 02:22 ART, puntos 5 y 6 del «Feedback Automations»:
  - Configuraciones por automatización, en el «⋯» de cada una.
  - La tuerca en el lugar del logo de MaKo.
  - La sidebar convertida en el chat, siempre abierta, con una flecha para volver.
  - En la lista, sólo el «?» del tutorial.
  - El aviso de Prospección al Publicar o Probar.
- **Por qué no se hizo:** se perdió en el relevo entre cuentas. Quedó escrito «los puntos 5-6», sin el texto. El chat
  siguiente buscó otro documento del mismo día y lo marcó «sin ubicar». Nunca se construyó ni se revirtió.
- **Encargo:** **Automations**, con el texto literal.
- **Regla nueva (AGENTS.md):** un pedido que llega por otro chat se pega literal como hito ese mismo día.
- **Hallazgo:** docs/hallazgos-chatbot.md.

### 6. «Leila configuró una automatización recurrente y me dijo que no salió»
- **Lo que no salió no era el Recurrente:** era #282, por etapa. Los 31 mensajes están como borradores esperando aprobación: por WhatsApp no oficial, un lead sin pago no recibe nada directo (anti-baneo). La pantalla no se lo dice.
- **El Recurrente de #284** (martes 16:15 de ella) sale a la hora en punto siguiente (22:00Z), y va al mismo grupo que #282: si se aprueban las dos, el lead recibe el recordatorio dos veces.
- **Encargo:** **Automations**: la pantalla dice cuántos borradores esperan y dónde se aprueban, el Recurrente sale a su minuto, y un aviso cuando dos automatizaciones van al mismo grupo con el mismo mensaje.
- **Decide Martín (o Leila):** aprobar los 31 y pausar #284 para no duplicar.
- **Hallazgo:** docs/hallazgos-chatbot.md.

### 7. «Otro error que Leila me envía»: «Ese número no tiene WhatsApp» (lead #2313)
- **Causa:** `enviarTexto` (lib/evolution.ts:857) manda el número tal cual. 53 de los 70 leads del ws11 lo tienen en 10 dígitos, sin el 52, y 27 de sus 32 borradores pendientes fallarían igual.
- **Encargo:** **MaKo Alert**, urgente. Al mandar, un número de 10 dígitos lleva el código de país de la línea, sin tocar los datos del cliente. Pasa por revisión adversarial antes de subir.
- **Mientras tanto:** la #284 quedó PAUSADA (Martín, 20/10 21:37 UTC) para no duplicar el recordatorio de la #282.
- **Al desplegar:** aviso en el grupo del ws11, firmado «Desarrollador de MaKo» (regla nueva de AGENTS.md).

### 8. «Te pedí que unificaras el chat del Ops Center en todos lados, su diseño y funcionalidades... en el onboarding y en otros lugares el chat sigue siendo diferente»
- **Registro:** la regla «un solo chat en toda la app» es del 18/10 (docs/feedback-18-10.md, pts 1, 5, 7, 11, 12 y 15), y quedó «después del 20/10». Ese después ya llegó.
- **Inventario del 20/10.** Los chats de MaKo que NO usan las piezas del Ops Center:
  - app/second-brain/ChatSecondBrain.tsx: el Ops Center de los clientes, con su propia versión;
  - app/offer/ChatOffer.tsx y app/m/offer/ComposerOfferM.tsx: `ComposerWhatsApp`;
  - app/automations/ChatMako.tsx: `ComposerWhatsApp`;
  - app/crm/lead-view/MakoAnalystLead.tsx: `ComposerWhatsApp`;
  - app/dashboard/EditorMako.tsx;
  - app/web-generator/editor/paneles/PanelAgente.tsx;
  - app/video-editor/_opencut/chat/PanelChat.tsx;
  - app/image-editor/mako/chat/PanelMakoIA.tsx;
  - app/plan/board/MakoProyecto.tsx;
  - app/_components/MakoChat.tsx.
- **El onboarding** ya tiene el composer del Ops Center (punto 3, rama onboarding-v3), todavía sin desplegar.
- **Encargo:** **Ops Center 3** saca el chat del Ops Center (Conversacion.tsx / ChatsMovil.tsx) como UNA pieza compartida.
  - Migra primero el Ops Center de los clientes.
  - Suma un test que falle si una pantalla de MaKo arma su propio chat.
  - Después, cada chat de área migra la suya con esa pieza.

### 9. «No sé de dónde sacaste eso de "Mapa" en los clientes... Para todos tiene que ser "Second Brain"»
- Ya estaba pedido el 18/10 (pt 1). Quedó arreglado en cf255c7f1 (Second Brain, 20/10), que sale con el deploy de abdb2504a.
- La captura era de antes de ese deploy.

### 10. «El Second Brain de SuperAdmin ya te había pedido que no se dividiera en 2... En ningún caso jamás los cerebros se deben dividir en 2»
- **Registro:** lo pidió el 17/10 («no pongas 2 grafos, todo 1 solo… para eso existen los filtros») y el 18/10 (pt 4: «el super admin con UN solo grafo»).
- **El código:** desde 08c34967b (17/10) dibuja un solo `<Grafo>` con `unirCerebros` (lib/cerebro-union.ts).
- **El diagnóstico obvio («ya está hecho») no alcanza:** Martín lo ve partido. Hay que mirar QUÉ se dibuja, por ejemplo dos raíces o dos racimos que la física separa.
- **Encargo:** **Second Brain**, verificado en el navegador.
- **Regla nueva (AGENTS.md):** ningún cerebro, de ningún negocio, se divide en dos.

### 11. «En la preview de los chats… Jamás debe decir el subtítulo las cosas que ponen… O debe decir "Trabajando..." o "Espera tu respuesta" o no tener subtítulo»
- **Hoy:** la fila de cada chat en /admin/operaciones muestra el paso en curso («Check onboarding guard…», «Escribe flujo-ia-recurrente.ts»), lo de los `pasos` del cartero 1.15.3.
- **Encargo:** **Ops Center 3**, antes del chat unificado. La fila dice sólo «Trabajando…», «Espera tu respuesta» o nada, en la computadora y en el teléfono. El paso puede seguir adentro del hilo.

### 12. CRM: «No veo el chat con MaKo… Muchos cambios aún no están, como que las columnas no sean invisibles… las cards personalizables… "Tablero y lista" sólo con íconos… ¿está lo de vincular una etapa de reunión a un evento?»
- **El chat con MaKo en el CRM:** ChatMakoCrm existe, pero Martín no lo ve. Va como barra fija a la derecha (regla del 18/10, «Editar = el patrón de Web Generator») y con la pieza única del chat del Ops Center.
- **Las columnas invisibles:** pedidas el 18/10 (pt 8: «la columna con su bloque de fondo») y nunca hechas.
- **Las cards personalizables** y **«Tablero» y «Lista» sólo con íconos:** nuevos.
- **Vincular una etapa de reunión a un evento: YA ESTÁ** desde el 16/10 (c7f7b5609), en el «⋯» de la etapa → «Asignar evento», con Calendly y Cal.com.
  - Google Calendar no está: su API no lista las páginas de reserva (app/crm/EventosDeEtapaModal.tsx:18).
- **Encargo:** **CRM**, que primero arma docs/pedidos-crm.md con TODO lo que Martín pidió para el CRM y su estado. Eso contesta «muchos cambios aún no están».

### 13. «Debate me dice que espera mi respuesta, pero ya respondí... Y no veo que se esté utilizando la funcionalidad que creamos de respuestas múltiples en Ops Center...»
- **Causa:** Debate sí recibió la respuesta (21:10Z). Después cerró sus turnos sólo con el recuadro de la app (`wrap_up`, con pregunta y botones), sin texto. El cartero sube sólo texto, así que nada de eso llegó al Ops Center.
- **Hecho:** Debate vuelve a preguntar con `cartero preguntar`, el formulario de opciones.
- **Encargo de fondo:** **Ops Center 3**. El cartero sube el resumen de un `wrap_up` como mensaje, y su pregunta y sus botones como formulario.
- **Hallazgo:** docs/hallazgos-operaciones.md.

### 14. «Comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo, mapea al 100% todo lo que eso conlleva, y la inteligencia que tienen que tener cada chat... No elimines por ahora las tabs... quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...»
- **En curso (20/10):** el mapeo al 100%, con ocho agentes por áreas más uno de síntesis y un crítico.
  - Por cada acción de cada tab mide si el Ops Center ya puede hacerla, qué falta (herramienta, motor, bloque en el chat, confirmación) y qué inteligencia necesita el chat del área.
  - Sale un documento maestro con el plan por olas y por chat.
- **Después:** reparto por olas a los chats de área. Lo transversal (los bloques en el chat, la confirmación adentro, los sub-chats) va a Ops Center 3.
- Las tabs quedan.

## Lo demás que salió de la llamada 864249059 (no es del onboarding)

| Pedido (minuto) | Estado | De quién |
|---|---|---|
| El botón del grafo dice «Mapa»: «debería llamarse second brain» [00:50:28] | no hecho | Second Brain |
| No pudo adjuntar documentos al chat del Web Generator [01:27:40] | no hecho | Web Generator (sin chat abierto) |
| La llamada no llegó al Plan: el clasificador la descarta como «ventas» porque ella sigue «prospecto» en el CRM del ws9 | no hecho | Plan (extracción de Fathom) |
| Acceso al curso con vencimiento y corte automático por cuota impaga [00:58:52, 01:02:00] | no hecho | Clients |
| La app en español y un selector ES/EN [00:58:05, 01:29:22] | no hecho | Sidebar / UI |
| Botones que se vean como botones; el de conectar WhatsApp [00:52:14, 00:53:04, 01:49:00] | no hecho | Sidebar / UI y Automations |
| «Que pueda analizar mi WhatsApp… mi cliente ideal» [01:13:14] | no hecho | Chats / Second Brain |
| Su Fathom no está conectado al ws21: su llamada no va a aparecer [01:25:27] | no hecho | se conecta en la reunión del domingo |
| Pasar a Florencia y a Leila a «ganado» en el CRM del ws9 | no hecho | Martín o CRM, con su sí |

Ya en curso por otro lado: el chat único sin tabs (la idea nace en esta llamada, [02:31:46]), los bloques al costado,
la pasarela, la landing y el VSL, y referidos.
