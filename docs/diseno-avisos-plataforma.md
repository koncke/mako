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

## 5. Lo hecho (15/10/2026, 729789dfa; 16/10, 16fa52568 y efcc58d46)

- **La pieza, construida:** `EventoMako.plataforma` (lib/disparadores.ts). `emitirPorEvento` lee las filas de la
  plataforma y corre con `negocioWs`; la tarjeta «MaKo en WhatsApp» resuelve y manda en ese negocio
  (`emitirTarjetaDelEvento`, lib/flujos.ts). No es una tarjeta nueva: en un evento de plataforma, la tarjeta de siempre
  le llega al negocio, y su editor lo dice («Le llega al grupo del negocio del evento»). **Si hace falta avisar también
  al grupo de la plataforma, eso sí sería un campo nuevo de la tarjeta.**
- **Mudados:** `wa-desconectado` → `whatsapp_caido` y `wa-reconectado` → `whatsapp_volvio`, con las plantillas
  «Se Cayó el WhatsApp de un Negocio» y «Volvió el WhatsApp de un Negocio». El texto de siempre no cambia una letra
  (tests/avisos-plataforma.test.ts lo compara).
- **El tercero (16/10/2026, 16fa52568):** `reunion-ocurrio-fathom` → `reunion_grabada`, plantilla «Terminó la Reunión
  de un Negocio». El webhook de Fathom emite con el LEAD del negocio y los datos de la reunión (`datosPostLlamada`,
  lib/reunion-grabada.ts: `grabacion_reunion`, `grabacion_duracion`); el link es `{{link_lead}}`, que ya apunta a
  `/crm/<id>/resumen` del negocio, el mismo que el texto de siempre. **Un cambio de forma, a propósito:** la duración
  pasa de « (42 min)» dentro de la frase a su propio renglón «⏱️ 42 min», porque una plantilla no puede sacar un pedazo
  de renglón cuando el dato falta (sólo el renglón entero).
- **La firma (efcc58d46):** las tres plantillas terminan en «— MaKo», como el texto de siempre. Una tarjeta TAL CUAL no
  le suma envoltorio: sin escribirla, el cliente la habría perdido.
- **HECHO el 16/10/2026** (con e50eaf6c2 desplegada): #253, #254 y #255 en el ws 9, prendidas y verificadas con la
  lectura del motor. Desde ahí esos tres avisos los manda sólo la automatización.
- **Siguiente:** `reporte-semanal`, que sale por email al dueño (otra tarjeta); después, el resto por familias.

## 6. El reporte semanal (16/10/2026): la tarjeta MaKo también por EMAIL

**Lo medido** (sólo lectura, la misma cuenta que el `?dry=1` del cron): el lunes a las 14:20 UTC sale por EMAIL a 8
negocios (ws 1, 9, 10, 11, 13, 14, 18 y 19), a un destinatario cada uno. Los ws 3, 4, 15 y 17 se saltean porque no
tienen a quién. Nunca sale por WhatsApp (`REPORTE_POR_WHATSAPP = false`). El feed no se escribe en ningún lado
(`notificaciones` no existe en producción). Ningún negocio tiene «cada cuánto». Sólo el ws 1 tiene horario de oficina
(de 9 a 21).

**La pieza que falta: «MaKo por email».** La tarjeta MaKo suma dos campos: `canal` (`'email'`; sin elegir, el grupo
de WhatsApp, como siempre) y `asunto`. Por email:
- le escribe a los destinatarios del negocio, uno por uno, desde equipo@hola-mako.com. Es el camino de siempre de un
  aviso con email (`enviarAvisoPorEmail`, lib/avisos.ts). Los destinatarios salen de `getDestinatariosDe`: la lista
  de Notificaciones o, si está vacía, el email del contacto. Es lo mismo que lee el reporte (`destinosDelReporte`).
- va sólo texto: un solo mensaje, sin audio ni archivos. Publicar lo frena con «Por email va un solo texto».
- no manda push al teléfono: la tarjeta dice email, y el reporte de hoy tampoco suena.
- el asunto admite datos, y la banda del correo dice lo mismo que el asunto.

En el lienzo se llama «MaKo por email». Vale en cualquier automatización, no sólo en la plataforma: los dos runners
(el de los leads, `avisar_al_equipo` en lib/api-mako/areas/chatbot.run.ts, y el de los eventos, lib/flujos.ts)
terminan en `emitirAviso`. Un email de MaKo va siempre al EQUIPO, nunca a un lead (regla «Email del negocio NUNCA
con MaKo»).

**El emisor.** El cron sigue igual, por negocio y adentro de su ws:
1. las preferencias del negocio deciden si le toca, como hoy (`decidirReporte`);
2. arma el reporte (`buildReporteSemanal`);
3. emite `reporte_semanal` con dos datos, `reporte_titulo` y `reporte_texto`.

Si la plataforma no tiene fila (`sinFila`), sale por `despacharReporte`, como siempre.

**La plantilla** de SuperAdmin es «Reporte Semanal de un Negocio»: MaKo por email, asunto `{{reporte_titulo}}`, texto
`{{reporte_texto}}`.

**Lo que cambia para el cliente cuando exista la fila,** dicho antes de hacerlo:
1. **El pie del correo.** Hoy firma con el nombre del contacto del propio negocio (`fromName: perfil.nombre`), que es
   un error: los correos de la plataforma firman «MaKo» (lib/email-html.ts). Por el camino del aviso va sin esa línea.
   Asunto, cuerpo, remitente y banda quedan iguales.
2. **El ws 1 lo recibe a las 9, no a las 7:20**, porque tiene horario de oficina y la tarjeta espera por defecto (la
   regla de Martín del 15/10). Los demás no tienen horario.
3. Nada más: el WhatsApp ya estaba apagado y el feed no existe.

**Lo hecho (16/10/2026, 12ac3cb85).**
- La tarjeta: `CanalMako`, `problemaDeEmailMako` y `avisoPorEmail` (lib/mako-tarjeta.ts). En el lienzo, «Por dónde» y el
  asunto (`EditorMako`, app/automations/FlujoLienzo.tsx). Publicar lo frena en los dos runners (`faltaEscribir` y
  `pasosDelEvento`).
- El envío: `emitirAviso` acepta `push: false`. El registro (`avisar_al_equipo`) suma `canal` y `asunto`.
- El evento `reporte_semanal` (`trae: ['reporte']`) y sus datos `reporte_titulo` / `reporte_texto` (`datosDelReporte`,
  lib/reporte-destino.ts).
- El cron: `emitirEventoDePlataforma` (lib/avisos.ts) y, sin fila, `despacharReporte`. Si no pudo leer si hay fila,
  devuelve error y no manda por ninguna de las dos puertas.
- La plantilla `mako-reporte-semanal` y su lugar en el script de la mudanza.
- Test: tests/reporte-semanal-plataforma.test.ts (12 roturas).
- **Antes, un arreglo de la pieza (a5b9e6d06):** la tarjeta de un evento de la plataforma esperaba el horario de oficina
  de la PLATAFORMA (el ws 9 corre la fila). Ahora espera el del negocio que la recibe.
