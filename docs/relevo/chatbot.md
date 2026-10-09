# Retomar: Chatbot

**Dónde quedó:** 09/10/2026, ~01:10. Cuenta `claude2`. La segunda tanda está en `main`
(`ecf93d0f`) y **desplegada** (Vercel Ready). La mig **0228** está aplicada y verificada contra
information_schema. La cosecha va en el commit de después de éste.

## El hilo

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

## Lo que falta

- **Mirarlo en un navegador en producción.** Nada de la tanda se vio con clics (bootear local
  escribe en prod). La lista de qué mirar está en `docs/hallazgos-chatbot.md` → «Lo que quedó sin
  hacer».
- **El disparador de la #224** (no-show de Código Inmobiliario): su embudo tiene lead, agenda,
  ganado, st0, manual y reactivación, y no tiene «noresp». Hay que sumar la etapa o usar
  `no_show_j1`, que exige leads abiertos, y ninguno de sus 14 no-shows lo está.
- Los pendientes técnicos chicos están en `docs/hallazgos-chatbot.md`.

## Lo que espera a Martín

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
