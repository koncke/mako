# Relevo del chat «onboarding-v2» (21/11/2026, ~09:50 UTC, claude5 al 97 %)

Worktree C:/dev/wt-onboarding-v2, punta `punta/onboarding-v2-motor`. Push: `MAKO_TYPECHECK_SIN_ESPERA=1 git push origin HEAD:punta/onboarding-v2-motor`.
Lo pidió el Cerebro con las 3 capturas de Martín (ws 3, Nutri Vale). Despliegue diario a las 11:05 UTC.

## Hecho en este turno
- **5. El saludo repetido** y **6. las viñetas sin punto**: a8c62ac22 (lib/reto/dias.ts → RETO_HOLA sin «¡Hola!» y «Este» sin tilde;
  app/_components/Markdown.tsx → list-style-type disc/decimal). tests/formato-en-los-globos.test.ts «0».
- **4. A medias:** desde un salto (`senal.desde`) el motor ya no muestra el cartel falso «Tu video de esta pestaña… todavía no está
  grabado» (MotorTutorial.tsx, `!senal.desde` antes de <VideoChico>). FALTA lo que pidió Martín de verdad: que el paso vuelva a mostrar
  SU video y repita la animación. Hoy `desde` corre sin video (lib/onboarding-v2/saltar.ts + MotorTutorial: `video = … senal.desde ? null`).
  Para hacerlo: con `desde`, dejar el video y adelantarlo al `t_inicio` de la primera frase cuyo `sel` es el del paso (`mismoLugar`), y
  que BrainDelRecorrido repita la animación al volver al paso del grafo (hoy `puesta` queda en true y no vuelve a «todo»).

## Hecho después (cuenta reiniciada por Martín: «continúa sin problema con absolutamente todo»)
- **1 y 10. El recuadro** (commit «El recuadro se ancla a lo que se ve»): el motor marca la caja RECORTADA por cada contenedor
  (`cajaVisible`, lib/recorridos.ts) y, si el contenedor la tapa, la lleva a la vista antes (`seVeEntero` → scrollIntoView). El velo de la
  llegada vuelve a medir con cualquier scroll. Banco «recuadro»: con el código viejo, el recuadro sobre la cabecera. OJO: el caso del
  reto del 1 (el hueco sobre los «…») no se reprodujo en el banco; si vuelve a pasar en producción, mirar la medida de LlegadaAlReto.

- **7 y 9. RESET en un espacio de prueba** (commit «RESET en un espacio de prueba»): después de «Reiniciar onboarding», la ruta vacía
  chart_chats, chart_sessions, offer_sesiones y el estado de los coaches (lib/reset-chats-prueba.ts, sólo con `esClienteDePrueba`); el
  botón dice «Borra todo…» en uno de prueba. El grupo de avisos (`grupo_*`) no se toca. SIN PROBAR contra la base: lo mira el Cerebro en
  producción (crear un chat suelto, RESET, que no quede; Offer Coach sin historial).

- **8. El recorrido no persigue** (commit «El recorrido no persigue»): MarcaAlReto una vez por pestaña (sessionStorage), nunca con un
  coach, un grupo o un gurú abiertos, y con «Lo hago después». Falta, si Martín lo pide, un chip «Seguir el recorrido» para retomarlo.

- **URGENTE: el borrado del RESET, lista CERRADA [3, 4]** (806a57cd2): nunca el 9 (el espacio de Martín) ni el 11 (Leila).
- **2. «Ir a un paso» sigue el paso** (commit «Ir a un paso sigue solo»): el server dice el paso del estado guardado
  (lib/onboarding-v2/paso-actual.ts, con las máquinas de verdad) y el desplegable lo muestra; se pone al día cada 5 s y al cambiar de
  pantalla; mientras corre el recorrido, la marca en la que va (el motor la anota en el store: `anotarPasoDelMotor`).

- **3. Second Brain arranca directo** (DEMORA_FASE_MS 1200 → 60: sin el cuadro quieto del cerebro chico) y **4, la animación se
  repite** al volver al paso del grafo (BrainDelRecorrido mira `usePasoDelMotor`). Banco «brain»: al volver, data-fase vuelve a «todo».
- **4, el VIDEO desde un paso del medio: HECHO.** Con `desde`, el video arranca en el `t_inicio` de la frase que marca ese paso
  (`tDesde`, MotorTutorial) y el motor sigue sus frases desde ahí; sin una frase para el paso, va con su tarjeta. Lo mira el Cerebro en
  producción (el banco no tiene un video con frases).

- **Después del recorrido del Cerebro en producción (cfcaf2bda):** RESET suma los chats de los EDITORES (image_editor_chats,
  video_editor_chats: «Image Editor» y «Prueba · contraste sobre blur» venían de ahí, lib/chat-mako-indice.ts) y dice lo que no pudo borrar;
  y «Ir a un paso» sigue la marca del recorrido también en el MODO VIDEO (ahí `i` queda en -1: se anota el paso de la frase). Y después
  (el Cerebro: «una cuenta nueva no tiene chats de automatizaciones»), las charlas de las AUTOMATIZACIONES (app_settings,
  `automatizacion.chat:%`) y cualquier fuente que la lista lateral sume: `FUENTES_DE_LA_LISTA` + test «4». Lo mira el Cerebro en el ws 3
  después del despliegue del 22/11 (un chat del Image Editor y uno de automatizaciones creados antes). Trampa: el banco atrapó un choque de
  nombres (`ultimoPaso`) que los tests de texto no ven y el tsc acotado no corrió: compilar el banco antes de subir.

## Falta (con por dónde empezar)
1. **El recuadro del recorrido mal ubicado** (/second-brain?reto=1: el hueco sobre los «…» de MaKo escribiendo, arriba a la izquierda,
   en vez de la fila del reto). Mirar `lugarDe(sel)` en app/_ui/tutorial/MotorTutorial.tsx (toma el PRIMER elemento visible del selector)
   y el efecto que mide (`recorteDe`): ¿mide antes de que la lista termine de pintar y no vuelve a medir? Pedido: re-medir con scroll,
   resize y cambios de contenido (ResizeObserver sobre el elemento + MutationObserver sobre su contenedor). Banco: un escenario por paso
   del recorrido que compare el hueco con `getBoundingClientRect()` del elemento (scripts/banco-onboarding).
2. **«Ir a un paso» sigue solo el paso actual**: el <select> de app/_components/SaltarAPaso.tsx tiene `value=""` fijo. Hace falta saber
   el paso de ahora: del server (GET /api/admin/saltar-onboarding puede devolver `actual`: la etapa del arranque, si terminó; el día del
   reto) y, en el navegador, el paso del motor (`senalAhora()`: tutorial + índice) para las marcas.
3. **Second Brain: aparece el grafo chico un instante antes de la animación.** BrainDelRecorrido entra con next/dynamic y busca el
   `.cbg-marco` cada 100 ms: entre que el grafo pinta y la capa llega se ve el grafo. Opción: con el recorrido corriendo, tapar el marco
   (fondo oscuro) desde ChatSecondBrain hasta que la capa monte, o importar la capa sin dynamic cuando `retoV2 && loQueSabe`.
7. **RESET no borra los chats sueltos** («Image Editor», «Prueba · contraste sobre blur» en el ws 3). OJO: el texto del RESET hoy PROMETE
   «No borra nada de lo suyo: … conversaciones … quedan» (TEXTO_REINICIAR, app/_components/ReiniciarOnboarding.tsx). Lo nuevo de Martín:
   en los espacios de PRUEBA, RESET borra todos los chats creados menos los fijos (Ops Center, Reto, Offer Coach, Funnel Coach, el grupo
   de avisos). Va en lib/reiniciar-onboarding-server.ts, sólo con `esClienteDePrueba(ws)`, con su test (chats sueltos creados antes).

## Sumado después (Martín, /second-brain?ws=3&coach=offer, 2 capturas)
8. **El recorrido no puede perseguirlo.** Si se va a otro chat por su cuenta (Offer Coach), hoy le vuelve a salir «Tu reto de 7 días ·
   Haz clic en Reto de 7 días» en cada pantalla. Mirar quién lo marca: app/second-brain/reto/useVueltaAlReto.ts (MARCA_VUELTA, cada
   CADA_MS_VUELTA) y la marca `tocaHoy` de ChatDelReto.tsx. Pedido: si sale del camino, el recorrido se PAUSA y queda retomable (un chip
   «Seguir el recorrido») o se adapta a donde está; nunca un cartel que la obliga a volver. Banco: salir del recorrido a mitad.
9. **Offer Coach con historial viejo después de RESET** («Ayer» y varios mensajes seguidos). Es el mismo pedido que el 7: RESET deja el
   espacio de PRUEBA como una cuenta recién creada. Los coaches (Offer Coach y Funnel Coach), sin historial, con sólo su primer mensaje
   y su video; los chats sueltos, borrados; quedan los fijos. Va en lib/reiniciar-onboarding-server.ts con `esClienteDePrueba(ws)` (y
   cambiar TEXTO_REINICIAR, que hoy promete no borrar conversaciones). Banco/test: chats sueltos e historial en los coaches antes del RESET.
10. **El recuadro de «Offer Coach: dale play» desplazado** (se dibuja más arriba que el video y se sale por arriba del encabezado). Mismo
   error de anclaje que el 1: se calcula sin el scroll del contenedor del chat. Usar `getBoundingClientRect()` del elemento al dibujar,
   volver a calcular cuando el contenedor hace scroll (el listener de scroll en captura sobre `document`, o sobre el `.co-hilo`), y
   `scrollIntoView` del video ANTES de resaltarlo. Banco: el recuadro sobre un video con el chat scrolleado.

La cosecha de todo lo de hoy está en docs/hallazgos-onboarding.md, docs/hallazgos-ui.md y docs/hallazgos-chat.md.
