# Relevo · chat «CRM y Chats» (cuenta claude4, desde el 27/10 20:33)

Quién reparte: el Cerebro (sesión local_797d5445…). Cada pieza va al Cerebro como «VERDE sin tipos <sha>», con los .ts
cambiados, después del rojo-verde, tests-afectados y tsc-acotado (todo lo pesado con `node C:/dev/con-turno.mjs …`).
Nada de esto se pushea desde acá: sube el Cerebro en sus trenes. Notas viejas de la misma cuenta (27/10): la carpeta de
notas del Cerebro, `crm-y-chats-claude4-27-10.md` y `crm-y-chats-estado-28-10.md`.

Actualizado: 28/10/2026 23:40.

## Hecho (con su rama y commit)

| Qué | Rama · worktree | Commit | Estado |
|---|---|---|---|
| El chat nuevo del Ops Center con la caja única y adjuntos | `chatnuevo-adjuntos-2810` · C:/dev/wt-chatnuevo-2810 | 0453923ab, e4d04e7fa (EN PRODUCCIÓN, tren-t), 05d7c3187, d2f690673, 1d586a686, 5ddf1672a | VERDE mandado de cada uno |
| Los dos defectos de la verificación de 5ddf1672a: el ticket de Soporte espera hasta que el mensaje LLEGA a la tarjeta; la caja sin conversación no pierde lo leído al desmontarse | ídem | 31fd30df2 | VERDE mandado (rojo-verde 54/0, 6 roturas; tests-afectados 2725 verde) |
| Las horas en la zona del negocio y los totales del período en lo que lee MaKo (F3 del diagnóstico de MaKo en WhatsApp) + la medición de los pedidos del CRM (docs/pedidos-crm.md) | `crm-horas-2810` · C:/dev/wt-crm-horas-2810 (sobre 506877517) | b799f7ed4 + f13f8bbad (la verificación: el instante no se pisa, la hora del negocio va al lado) | Mergeado por el Cerebro en tren-w (c17134274) |
| Acciones en bloque del tablero (tickets #21 y #22 de Leila): papelera de 30 días (mig 0340), pasar a otro funnel, descalificar con motivo, la columna entera sin truncar, el lugar de la difusión y 5 operaciones de la API de MaKo | `crm-lote-2810` · C:/dev/wt-crm-lote-2810 (sobre 23b329b5e) | cc47d841d | VERDE mandado con el SQL de la 0340 (va ANTES del deploy, con el sí de Martín). Falta: montar `HojaDifusion` cuando Automations la suba |

## A medias

- Nada a medias en código. Lo único abierto de las acciones en bloque es montar la hoja de la difusión (`HojaDifusion`, de
  Automations): la barra ya tiene `onMandarMensaje` y `seleccionDeDifusion` (app/crm/seleccion-difusion.ts); CrmBoard le pasa
  `onMandarMensaje` cuando la hoja exista (al 28/10 22:00 no estaba en ninguna rama).

## La cola (orden del Cerebro, después de lo de arriba)
0. (28/10 22:30, del relevamiento de pedidos perdidos: docs/relevo/pedidos-perdidos-2810.md en tren-w, sección CRM) DESPUÉS
   de los defectos de las horas: (a) Leila, lead Fabi Pedraza: faltan los datos fiscales y al cargarlos sólo salen SETTER y
   CLOSER; y adjuntar la constancia fiscal a la ficha desde el chat (doer_buffer 302-303, C:/dev/revisiones/2710-leila-leila.md
   :95-101). (b) Las cifras de llamadas de Joan (ws13) se contradicen (25 contra 28 no-shows, 14 contra 10 sin marcar): medir
   cuál es la verdad (los totales de b799f7ed4 son la mitad del arreglo). Para después: la lentitud de «Qué escribir», el R1
   obligatorio de Calendly, los emojis en las iniciales.
2. Unir dos fichas que ya son clientes (toca plata: con la revisión de pagos; lib/leads-unificar.ts ya existe).
3. Qué datos muestran los bloques de Pagos. 4. Las 8 decisiones de los requisitos de etapa (docs/pedidos-crm.md).
5. De dónde vino cada lead en varios funnels. 6. Los «Producto» que quedan → «Funnel». 7. Google Calendar en «Asignar
evento» (por el título del evento). 8. Más de 60 perfiles por «Extraer». 9. Las tarjetas del teléfono, «Prioridades» y el
check gris (también en el Plan del teléfono). 10. Cumpleaños (si pide migración, el SQL al Cerebro).
«Enviar a todos» de una etapa: es de Automations. La rama `crm-cuotas-espera-revision` NO se sube. `tienda-cws-2710` no se mezcla.

## Lo que espera a Martín (vía el Cerebro)
- El sí para aplicar la migración 0340 en producción (antes del deploy de las acciones en bloque).
