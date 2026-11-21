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
