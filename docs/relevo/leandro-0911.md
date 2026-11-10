# Relevo: Leandro (ws10, Fiesta Music) — WhatsApp y Automations (9/11/2026)

Chat local, rama `punta/leandro-wa-aut-0911` (en main desde 0b8aac821). Cosecha en `docs/hallazgos-ticketera.md`,
`docs/hallazgos-comunicacion.md` y `docs/hallazgos-chatbot.md`.

## Estado

- **En producción desde el 10/11 01:36 UTC** (despliegue de 082a832c4). Visto en el Chrome de Martín con `?ws=10&sec=710`: la
  tarjeta de respuesta pública tiene el «↻» y abre «+ Otra forma de decirlo» (no se cambió nada).
- **#67 cerrado solo por el cron (01:45 UTC)** y el aviso le llegó a su grupo (01:45:58). El del Desarrollador, con cómo se
  cargan, que «Probar» muestra siempre la primera y que a @jealoficial y @bigmouse_oficial ya no se les puede escribir, salió a las 01:54
  (clave `commit:85249b975`).
- Ya se le contestó en su grupo (9/11 22:40 UTC) lo que quedó sin respuesta por la línea sorda.
- **Las variantes las cargó Leandro, 10/11 12:45-12:51 UTC, en el lienzo.** Primero lo intentó por la API (12:43, token
  «Conexión Claude Code») y le dio un 422: la guarda de duplicadas frenó la #706 («A la misma gente ya le escribe «IG - GUIA»»).
  La API no tenía el «Publicar igual» del lienzo. Arreglado en `cambiar_botones_mensaje` y `cambiar_texto_mensaje` (rama
  `punta/leandro-api-gemela-1011`), como ya estaba en `editar_pasos_secuencia_mensajes`. La causa de fondo es el punto 7, abajo.
- **De punta a punta con un comentario real, 10/11 12:58 UTC**: #707, lead 5972 (@thrashdragonlvt). La respuesta pública («¡Enviado!
  Revisá tus DMs ✨») y el DM del recurso salieron (`enviado`, sin error) y la inscripción 1228 quedó `completada`.
- **Sin hacer, de su caso: que de verdad ROTA.** Con una sola respuesta no se ve. Hay que mirar `nutricion_envios.texto_enviado`
  de la tarjeta `en_comentario` (706-712, desde 12:51:13 UTC) hasta ver dos formas distintas o juntar seis respuestas. Si salen
  seis iguales, el sorteo no anda. Sin comentar nosotros en Instagram (público).

## Para el chat de la nube («Automations: todo lo de ManyChat, y todo en la API», `punta/automations-manychat`)

Lo que apareció con Leandro y NO es de su caso. Cada punto es algo que un usuario real ya chocó.

1. **«Probar» no sortea las variantes.** `app/automations/PanelProbar.tsx` arma el mensaje con `partesDe`; el motor usa
   `partesParaEnviar` (lib/mensaje-partes.ts), que elige una forma de decirlo por envío. Quien carga tres versiones y prueba,
   ve siempre la primera y cree que no funciona.
2. **MaKo inventa funciones de Automations.** A «¿puedo cargarle variantes a esa tarjeta?» contestó que el «{ }» las carga (el
   «{ }» inserta datos del lead). Leandro lo probó y tuvo que volver a preguntar. Una pregunta de «cómo se hace X en Automations» tiene
   que salir del catálogo real (`lib/api-mako/areas/chatbot.def.ts`, `docs/api-mako.md`) o terminar en «eso todavía no
   existe». Inventar es peor que «no sé». La paridad con ManyChat sirve poco si MaKo describe mal lo que hay.
3. **Una pregunta dentro de un ticket abierto queda sin respuesta.** El clasificador (`lib/mako-intencion-ia.ts`) marca
   TICKET como principal con pregunta adentro, y el despachante (`lib/mako-doer-in.ts`) contesta sólo «Lo sumé al ticket
   #67». Las dos repreguntas de Leandro («no funciona así… ¿dónde se cargan?») terminaron así.
4. **La ventana de 24 h de Instagram, sin decirla.** Pedido #65: «mandales el recurso a estos 2 leads». La ventana de
   @jealoficial y @bigmouse_oficial se cerró el 8/11 (23:12 y 23:46 UTC) y MaKo contestó «eso no lo tengo en esta sesión: .»
   (con el motivo vacío). Hacen falta dos cosas: decirle a la persona que la ventana de 24 h se cerró y desde cuándo, y para
   la paridad, la etiqueta «Human Agent» de ManyChat (7 días). Hay que ver si Zernio la expone.
5. **Lo pedido salió y nadie le avisó.** La alerta y el reintento que pidió Leandro están en producción desde el 9/11 14:23 UTC
   (5b24d93dd, c484aa5d9). Los commits no llevaban su ticket en el hito de la bitácora (`tickets: [n]`), así que el cierre
   no se disparó ni le llegó el aviso (`lib/tickets-cierre.ts`). Todo commit que resuelva un ticket lleva su número.
6. **La ficha de la API mostraba «variantes: 0» sin forma de cargarlas.** Ahora está `variantes` en
   `cambiar_botones_mensaje`. Falta confirmar, con el deploy, que la ficha cuente bien las de una tarjeta de Instagram.
7. **La guarda de duplicadas ve como «la misma gente» a dos automatizaciones de comentario cualquiera.** `mismaCohorte`
   (lib/automatizacion-duplicada.ts) compara un CRON de comentario sólo por `subtipo`, sin `palabras` ni `publicacion`, y
   `duplicadaDe` no compara el texto. El patrón de ManyChat, una automatización por palabra, avisa en cada «Publicar» de cada una
   (Leandro tiene 7: lo vio 7 veces seguidas el 10/11). Hay que decidir si palabras o publicaciones distintas son gente distinta.
   Un comentario con dos palabras dispara las dos, y el test que ata la guarda al motor
   (tests/automations-activar-todos-los-caminos.test.ts, «por EVENTO») hoy pide avisar. Lo de la API ya está arreglado (ver Estado).
8. **Admin › Activity dice «ok» para una escritura de la API que falló.** `ejecutarOperacion` anota el resultado de `preparar`
   (la propuesta salió bien). En la escritura directa (`aplicarEnElActo`, lib/api-mako/flujo.ts) el `ejecutar` que falla después
   no se anota. El 422 de Leandro figura como `cambiar_botones_mensaje · ok`. El motivo real está en `propuestas.resultado`.

## Para el Cerebro (no es de Automations)

- **Alarma de la línea sorda, sin hacer.** `lib/canal-vigilante.ts` mira si el socket contesta, y una línea sorda contesta.
  Falta la alarma por lo que NO llega: horas sin un entrante en la línea de grupos mientras las otras reciben, y por EMAIL.
- **La línea de Martín (`mako_ws9`, …3479) sigue sorda.** Necesita su propio QR.
- **Mauricio (ws1)**: su mensaje del 9/11 14:13 ART (los clics de la API, ticket #66) quedó sin respuesta.
- **#62, #63 y #64 de Leandro: arreglados desde el 9/11 14:23 UTC y abiertos** (ningún hito los nombra). Son «Obtener recurso no
  manda nada y la inscripción se cancela»: lo arreglaron 5b24d93dd y c484aa5d9 (el reintento de 4 h y el aviso al negocio), y
  sacar ManyChat (verificado el 8/11: cuatro envíos, cero fallos). #62 es el mismo que #63, levantado dos veces. Los cierra
  el Cerebro con `scripts/tickets-cerrar-resueltos.mjs` (AGENTS.md, 28/10). Ojo, la respuesta tiene que decir que a los dos
  leads del 7/11 (5938 y 5939) ya se les cerró la ventana de 24 h. No se metieron en el hito del #67 porque a los dos de
  la app les llegaría el mismo «Arreglamos un error…» dos veces.
- **#65 de Leandro** (mandarle el recurso a @jealoficial y @bigmouse_oficial): no se puede, la ventana de 24 h se cerró el
  8/11. Hay que decírselo y cerrarlo, o que lo mande él a mano desde Instagram.
- **#61 de Leandro** (landing, dominio y precio): espera a Martín por «token» y «pago». No es de Automations.
