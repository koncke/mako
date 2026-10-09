# Retomar: Chatbot

**Dónde quedó:** 09/10/2026 ~15:30, cuenta `claude2` (cuota semanal 33 %). La CUARTA y la QUINTA tanda
están ENTERAS en `main` (el push de la rama `chatbot-v2` de esta tarde), con las migraciones 0230 y
0233 aplicadas. El pedido literal de las dos está en `app/admin/dev/chatbot/bitacora.ts` (hitos del
9 oct 11:02 y 12:09); lo que costó, en `docs/hallazgos-chatbot.md`. **Nada se vio con clics** salvo el
lienzo de la quinta 2, que un agente arrastró en el ws1 en sólo lectura.

Y del mismo cierre (Martín: «Termina todo lo que haga falta y cierra las tareas en el plan»): el plan
de «Feature: Chatbot» quedó en **33 de 34 cerradas**; abierta la #350 (el reproductor de audios: con
el reproductor solo no se reproduce, falta probarlo en la pantalla real). Lo que se decidió en el
formulario del 09/10 (no-show que reagenda, línea caída apagable + «volvió», residuo apagado) está
hecho y anotado en `docs/hallazgos-comunicacion.md`.

## Qué hay, por punto

**Cuarta tanda:** 1 el panel mide por TIPO de tarjeta y el selector es el grande · 2 el CRON arranca
en «Productos» / «Etiquetas» · 3 y 17 «Probar» sin ramas, arriba, con «Cerrar» · 4 y 12 el CRON sin
filas, sin REPLY ni GO TO · 5 la reunión por etapas del kanban (sin R1/R2) · 6 «No pagó la cuota N» ·
7 «＋ y» / «＋ o» y sin «＋ Rama» · 8 varias flechas por resultado · 9 el DELAY sólo espera · 10 el ＋
con íconos y por grupos · 11 «Elige una acción», sin las dos que sobraban · 13 el filtro al lado del
buscador · 14 el CRON con varias etapas (mig 0230) · 15 WhatsApp con varias partes por tarjeta, el
número de salida y «✦ MaKo» al lado del título · 16 el email con «De», modo HTML y la firma del negocio.

**Quinta tanda:** 1 «Probar» con el logo, los números y mails guardados de quien prueba, y las
condiciones decididas como un lead RECIÉN LLEGADO · 2 el ＋ en cualquier punto de la flecha y las
tarjetas que se mueven y se guardan (mig 0233) · 3 segundos y minutos en el DELAY: hasta 120 s se
cumple exacto, más que eso sigue con el cron y la pantalla dice cuándo · 4 el filtro del Plan en la
lista y la lista a 320 · 5 los Mensajes de MaKo (Configuraciones › Notificaciones) adentro de /chatbot.

## Lo que falta (no espera a nadie)

- **Verlo con clics** en producción: la tercera, la cuarta y la quinta tanda.
- **11:** sumar las acciones de Customer Success cuando entre la rama de la API de MaKo
  (`wip/api-acciones-0910`) a `ACCIONES_DEL_FLUJO` (lib/editor-acciones.ts).
- Las partes de un mensaje: la marca de cuántas salieron vive en `nutricion_envios.asunto` (lo prolijo
  es una columna `partes_salidas`), y un borrador del setter de varias partes junta los textos en uno.
- «Probar» manda con el remitente del negocio y no con el del paso (da lo mismo mientras haya uno).
- Unificar el selector del CRON (`BOTON_CAMPO_CRON`) con el grande de la casa y darle el grande a la
  CONDITION. `onAgregarRama` de FlujoLienzo ya no lo usa nadie.
- Medir en producción cuánto vive la espera corta que corre después de contestar un webhook.

## Lo que decide Martín

- ¿/mensajes (el catálogo de avisos de la agencia) también se muda a /chatbot?
- ¿Se retira la condición «Agendó»? Dice lo mismo que «Tiene reunión agendada».
- «Felicitar a un alumno que terminó una clase»: la IA elige todas las etapas de entrega, pero llegar a
  una etapa es terminar un MÓDULO, no una clase.
- Varios remitentes por negocio: hoy «Vincular nuevo» REEMPLAZA el remitente (lo avisa).
- Minutos exactos entre 2 y 59 min (haría falta un tick frecuente), y el cron corre de 15 a 23 UTC: de 17 a
  21 de México no hay ninguna corrida.
- El lienzo: ¿mover una tarjeta se deshace con Ctrl+Z?, ¿un botón «Reacomodar»?, ¿«Duplicar» hereda el
  acomodo (hoy sí)?
- «Probar»: ¿muestra por qué rama siguió? ¿un lead nuevo «tiene email» por defecto (hoy sí)?
- De antes: activar #221/#222 (pausando 212, 213 y 198) y el disparador de #224; la key de Gemini de la
  plataforma está bloqueada por Google; apagar el workflow de n8n «WhatsApp Reminders for Calendly»;
  rotar la key de Fathom.

## La tercera tanda (para contexto)

### Lo que se hizo (pedido del 9 oct 02:05, en la bitácora)

Hecho: el editor mediano (WhatsApp en una columna, sin «Revisar antes de enviar»), «Ir a» fuera del
＋ y de la IA, el CRON por producto → adquisición/entrega → etapa (sin «Eventos»), títulos en inglés
y tarjetas con cara de WhatsApp y de Gmail, la tarjeta MAKO (aviso al grupo con datos del lead), el
emoji del título, los «⋯» de la lista (activar, duplicar, eliminar), «Nueva» al instante, el
catálogo de 48 condiciones por sección filtrado por el CRON (el motor las evalúa en batch), el email
con el editor rico de las lecciones (HTML saneado), «Probar» por canal (teléfono o bandeja Gmail) y
frenado si falta algo, «Publicar» apagado sin cambios, las acciones en una lista corta con un
control por campo (monto y motivo sólo para Ganado/Perdido), y Crear con IA arreglado (Groq entra
con un pedido compacto) con la caja del Plan, dictado en vivo, placeholder animado y la capa con
Cancelar.

Falta: verlo con clics; lo demás está en `docs/hallazgos-chatbot.md` → «Lo que quedó sin hacer».

## La segunda tanda (para contexto)

### El hilo

El pedido de Martín del 08/10 a la noche, 11 puntos. Están literales en
`docs/chatbot-flujo-ramas-diseno.md` → «SEGUNDA TANDA» y en `app/admin/dev/chatbot/bitacora.ts`.
Lo que quedó, punto por punto:

1. **Un solo CRON.** «Si responde» es la segunda fila de la tarjeta CRON («Al entrar» / «Si
   responde») y cuelga de ella. Ya no hay tarjeta fantasma.
2. **Flechas en paralelo** desde el CRON y desde cualquier mensaje, acción o espera. Cada una es un
   hilo que corre a la vez (`hilos` en la inscripción). El freno de 20 h y los topes son por canal, y
   la ventana 9-21 va en la zona del negocio.
3. **El editor de WhatsApp es apaisado**: el chat a la izquierda y el composer a la derecha, en una
   franja abajo del lienzo.
4. **Email tipo Gmail**: De (el remitente del workspace, con aviso si es sandbox o está apagado),
   Para, Asunto, Vista previa y cuerpo con B/I/S. A la derecha, el mail abierto con el mismo render
   que sale. «✉️ Email» está en el ＋.
5. **Dos familias de tarjetas.** Las de control (condición, esperar, etiqueta, ir a) son compactas y
   teñidas, y la espera es una píldora. El CRON tiene su ícono (⏰).
6. **La tarjeta de etiqueta** (🏷️ + / −) se edita con una frase: «[Poner ▾] [etiqueta ▾]».
7. **El editor de acción, simplificado**: un desplegable por secciones con buscador («Más usadas»,
   «Con este lead», una por área, «Avanzado»), una línea de qué hace, lo opcional plegado, y sin los
   campos que llena el flujo.
8. **«Probar» ancho y bajo**, arriba a la derecha. Recorre los hilos con reloj virtual y muestra el
   email como un mail.
9. **Auditoría de ManyChat**: `docs/chatbot-auditoria-manychat.md`. Trae lo que hacemos mejor, lo
   que hacíamos mal (y qué se arregló), lo que falta en orden, lo que decide Martín y lo que no hay
   que copiar.
10. **Secuencias de los clientes, creadas EN PAUSA** (09/10, ~01:40). No se tocó ninguna prendida:
    - ws1: **#221** «Agendó: confirmar y preparar» (reemplaza a 212 y 213, pone la etiqueta
      «Confirmó», que se creó), **#222** «Bienvenida con email» (reemplaza a 198; sus «Ir a» van a
      #221), y la **#220** suma «Si responde» (sigue apagada).
    - ws13: **#223** «Agendó: confirmación de auditoría», con el WhatsApp y el email EN PARALELO desde
      el CRON, y **#224** «No asistió: reagendar auditoría», todavía sin disparador (queda en «A
      mano»): la etapa «noresp» de sus leads no existe en su embudo.
    - Las especificaciones están en `docs/relevo/chatbot-secuencias.json`.
    Para Código Inmobiliario quedó hecho lo que pidieron: el aviso «Nuevo agendado» trae teléfono,
    email y las respuestas del formulario de Cal.com, que ahora se guardan en la ficha.
11. **Crear con IA.** «＋ Nueva» crea una automatización vacía y pausada y abre la caja del pedido. El
    modelo es Gemini o Groq gratis, nunca Claude. Las tarjetas aparecen de a una, y el ✦ de las
    herramientas pide cambios (sólo agrega). El wizard de 9 pasos se borró.

La revisión adversarial reportó 38 hallazgos: 32 confirmados, los 32 arreglados con test. Suite:
5938 tests, 0 rojos.

### Lo que faltaba de la segunda tanda (08/10)

- **Mirarlo en un navegador en producción.** Nada de la tanda se vio con clics (bootear local
  escribe en prod). La lista de qué mirar está en `docs/hallazgos-chatbot.md` → «Lo que quedó sin
  hacer».
- **El disparador de la #224** (no-show de Código Inmobiliario): su embudo tiene lead, agenda,
  ganado, st0, manual y reactivación, y no tiene «noresp». Hay que sumar la etapa o usar
  `no_show_j1`, que exige leads abiertos, y ninguno de sus 14 no-shows lo está.
- Los pendientes técnicos chicos están en `docs/hallazgos-chatbot.md`.

### Lo que esperaba a Martín en la segunda tanda (08/10)

- **Activar las secuencias nuevas**: pausar 212 y 213 y activar la #221. Para la #222 (que
  reemplaza a la 198), el email del ws1 tiene que estar prendido y el remitente no puede seguir
  siendo «MaKo». La copia nueva («voy a liberar el espacio» 4 h antes, «no vio el video», «puede no
  calificar») sale como borrador hasta que la mires.
- **Código Inmobiliario no tiene canal** hacia sus leads: la línea está desconectada y el email sale
  del sandbox.
- **Decisiones mías de la tanda (con su default)**, en el diseño:
  - una respuesta pausa todos los hilos;
  - el «Ir a» de «Si responde» retoma uno;
  - dos hilos de WhatsApp se permiten, y el freno los espacia;
  - los topes de 40 por día y 6 por corrida son sólo de WhatsApp, y el email tiene 100 por día;
  - «Si responde» cuelga sólo del CRON;
  - las flechas en paralelo de una tarjeta borrada pasan a la que la reemplaza.
- **Guardar la zona del ws1** (`mako.timezone` = America/Tijuana): hoy decide con Ciudad de México.
- **De la auditoría**: varias acciones por tarjeta o una; «Si responde» con tiempo límite; guardar lo
  que el lead contesta en un campo.
- **Las cuatro de la primera tanda que siguen sin respuesta**: el espejo etiqueta↔etapa, la
  sincronización de email, las esperas en horas y días, y que archivar apague.
