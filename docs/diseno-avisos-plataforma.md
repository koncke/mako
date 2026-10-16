# Los Mensajes de MaKo a sus clientes, como automatizaciones de SuperAdmin

> 15/10/2026 (`claude3`, chat «Chatbot»). Sale del 2 de las doce de Martín: «en Automations de SuperAdmin
> no veo las automatizaciones que armamos para los clientes de MaKo y en general allí deberían haber varias
> automatizaciones más». Lo decidió el coordinador con las reglas escritas de Martín: «un Mensaje de MaKo ES una
> automatización, idéntico» y «MaKo nada por detrás».

## 1. Lo medido

- El catálogo (lib/avisos-catalogo.ts) tiene 72 avisos. Los configura la agencia: `AVISOS_DEL_CLIENTE` está vacía
  desde el 11/10.
- 7 tienen evento de MaKo (`EVENTOS_MAKO`, lib/disparadores.ts) y salen por una automatización. 2 de ésos están
  retirados.
- Los otros 65 los manda el código (`emitirDelCatalogo` → el motor de avisos) por fuera de una automatización.
- El ws de la plataforma (9) tiene UNA automatización viva: «Restablecer Contraseña». Es un evento de una PERSONA que
  se emite en el ws 9.

## 2. Lo que falta construir, una vez

1. **El evento de plataforma.** `emitirDelCatalogo(aviso)` corre en el ws del cliente X. Si el aviso es de plataforma,
   se desvía a las filas del **ws 9** con ese evento, con los datos del negocio X (`negocio_ws`, `negocio_nombre` y lo
   que traiga el aviso). Es el mismo desvío de hoy (`emitirPorEvento`), mirando otro ws.
2. **La tarjeta «MaKo al grupo del negocio»**, sólo en la plataforma (`usePlataforma`, y el server la frena en otro
   ws). Manda con la voz de MaKo al grupo «MaKo <> cliente» del negocio del evento. Es lo que falta para hablarle a
   OTRO negocio desde el ws 9: hoy no existe nada que lo haga.
3. **Sin hueco y sin duplicado.** Mientras no haya una fila prendida en el ws 9, el aviso sale como hoy, por código.
   Con una prendida, sólo por ella. Por eso la mudanza crea la fila del ws 9 PRENDIDA y con el texto de hoy, y recién
   ahí el código deja de mandar.

## 3. El orden de la mudanza (de a uno, cada uno con su test)

1. `wa-desconectado`: «se cayó el WhatsApp del negocio».
2. `wa-reconectado`: «y volvió».
3. `reunion-ocurrio-fathom`: «terminó la reunión y quedó la grabación».
4. `reporte-semanal`. Sale por EMAIL al dueño (`REPORTE_POR_WHATSAPP = false`), así que necesita la tarjeta de email al
   dueño del negocio, no la del grupo.
5. Después, el resto del catálogo, por familias: Meta, reuniones, CRM, Plan, Pixel.

## 4. Lo que no se toca

- Las automatizaciones de cada negocio («MaKo en WhatsApp» en su propio ws): siguen igual.
- Lo que entra por la línea de MaKo: sigue en su canal (camino (a), lib/linea-plataforma.ts).

## 5. Lo hecho (15/10/2026, 729789dfa)

- **La pieza, construida:** `EventoMako.plataforma` (lib/disparadores.ts). `emitirPorEvento` lee las filas de la
  plataforma y corre con `negocioWs`; la tarjeta «MaKo en WhatsApp» resuelve y manda en ese negocio
  (`emitirTarjetaDelEvento`, lib/flujos.ts). No es una tarjeta nueva: en un evento de plataforma, la tarjeta de siempre
  le llega al negocio, y su editor lo dice («Le llega al grupo del negocio del evento»). **Si hace falta avisar también
  al grupo de la plataforma, eso sí sería un campo nuevo de la tarjeta.**
- **Mudados:** `wa-desconectado` → `whatsapp_caido` y `wa-reconectado` → `whatsapp_volvio`, con las plantillas
  «Se Cayó el WhatsApp de un Negocio» y «Volvió el WhatsApp de un Negocio». El texto de siempre no cambia una letra
  (tests/avisos-plataforma.test.ts lo compara).
- **Falta, después del deploy:** `scripts/mudanza-avisos-plataforma.mts --aplicar` crea y prende las dos filas en el ws 9.
  Hasta entonces sale como siempre (`sinFila`).
- **Siguiente:** `reunion-ocurrio-fathom`, y después `reporte-semanal`, que sale por email al dueño (otra tarjeta).
