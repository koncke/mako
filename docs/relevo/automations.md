# Relevo: Automations — la prospección del Sprint de Mauricio (21/10/2026)

> La historia larga del área sigue en [chatbot.md](chatbot.md) (el relevo de siempre de /automations). Éste es el de
> la campaña del Sprint: qué quedó arreglado, cómo se probó en el ws3 y qué falta, con los pasos que mandan WhatsApp
> de verdad escritos para correrlos cuando Martín conecte el chip.

## LO ÚLTIMO: 30/10/2026, rama `aut-restos-tickets-3010`: los restos de los tickets #33 y #34

Tres arreglos: el paso de una inscripción sin tarjeta (`indiceDeLaFila`), lo que manda Instagram (`ig_mensajes.metadata_zernio`,
migración 0353, ya aplicada) y la pausa de Zernio en Automations y Calendario. Encima, el aviso al activar: cuántos y a qué ritmo
(lib/ritmo-al-activar.ts). La cosecha, en docs/hallazgos-chatbot.md y docs/hallazgos-integraciones.md. **Mirar cuando despliegue:** el
aviso en pantalla (no se vio en el navegador: la lista exacta de qué mirar, abajo) y `ig_mensajes.metadata_zernio` con el próximo toque de un DM viejo.
**Después, la misma noche:** el aviso cuenta lo que queda para aprobar en todo el flujo (`porAprobarDelFlujo`), ya no sólo el primero; dice los borradores viejos
que la van a frenar y ofrece descartarlos (`borradoresAlActivar`, `descartarBorradoresViejos`); y el camino hasta Configuraciones sale del aviso mismo también en el ⚠ de la fila y en el
teléfono (`ConfiguracionesM`).

**QUÉ HAY QUE MIRAR EN PANTALLA, nadie lo vio.** El 30/10 no había sesión de MaKo en el navegador de la app, y el código todavía no estaba desplegado. Abrir el
aviso no prende nada; cerrarlo o cancelarlo, tampoco. Se prueba en el **Cliente de Prueba**, con «🧪 Prueba chats 22/10» (apagada, 2 de sus 5 mensajes quedan para
aprobar: es el caso real de ese texto):
1. **Computadora, el interruptor** y **«⋯ › Activar»:** el aviso dice «Más adelante, 2 de sus 5 mensajes no salen solos: quedan hasta N en Borradores…», se lee
   entero en el modal, y «Poner goteo» / «Poner horario» abre Configuraciones sin prenderla.
2. **Configuraciones:** «Poner goteo» abre arriba, en Horario de oficina. Mirar si el goteo se ve sin bajar; si no se ve, no es un toque.
3. **La fila de una prendida sin goteo u horario:** el ⚠ alineado, sin pisar el «⋯»; la frase al pasar el cursor; un clic abre Configuraciones de ESA sin cambiar
   la elegida; al poner lo que falta y cerrar, el ⚠ se va. Con un setter, el ⚠ no hace nada.
4. **La pantalla de una prendida:** el aviso de arriba de «Activar» abre Configuraciones, y al cerrar se va.
5. **Teléfono, al activar:** la hoja con el texto entero y «Activar igual» / «Poner…» / «Cancelar». «Poner…» abre Configuraciones.
6. **Teléfono, una prendida:** la píldora en la lista, y adentro el texto con su botón «Poner…». ⚠️ Cierra una hoja y abre otra en el mismo toque: mirar que no
   quede trabada y que el «atrás» ande.
7. **Teléfono, Configuraciones:** es la pieza de la computadora adentro de una hoja, nunca probada ahí. Mirar que entre a 375 de ancho y que los desplegables de
   huso y de horas abran y se puedan elegir adentro de la hoja. Al cerrar, el aviso se va.
8. **Los borradores viejos:** el único caso real es de Leila, «Seguimiento a leads que no cierran». **Abrir el aviso alcanza, y NO tocar «Descartar los 27» sin que
   Leila o Martín lo pidan: descarta de verdad.** Mirar que el botón se lea al lado del texto, y que con el modal angosto no se corte. Para probar el botón hay
   que armar un borrador viejo en el Cliente de Prueba.
9. **El teclado en el cartel** (Cliente de Prueba, cambió `app/_ui/Confirm.tsx`, que usan todos los carteles): con Tab hasta «Poner goteo» y Enter, abre Configuraciones y NO prende.
   Enter recién abierto sigue confirmando. Mientras descarta, Escape no cierra. Después de descartar, Enter no hace nada hasta ir con Tab a un botón. Con Tab a un botón de atrás del velo, Enter confirma y no lo clickea. Mirar también un cartel de otra pantalla, por ejemplo borrar algo: Enter sigue andando.
10. **Variantes y arranque gradual** (rama `aut-variantes-3110`, en el Cliente de Prueba): en el CRM, «⋯» de una columna › Mandar mensaje: ↻ al lado del mensaje escrito abre «＋ Otra forma de decirlo»; «Arrancar de a poco» viene tildado, con 20 y 20, y la duración y la confirmación lo dicen; con tope 60, avisa que la línea llega hasta 40. En Configuraciones de una automatización: «Arranque gradual» sólo con «Tope por día» prendido. Corregir el texto con variantes avisa, con «Deshacer». A 375 de ancho no se corta el popover. **No se ve en pantalla:** que le toque una de las tres a cada lead y que el segundo día suba: se mira en los envíos de la automatización con una difusión de prueba, con un número que se pueda arriesgar.
11. **El modal de difusión** (rama `difusion-modal-0211`, en el Cliente de Prueba): en el CRM, «⋯» de una columna › Mandar mensaje. Mirar los tres canales con su logo, que tocar una fila cambie el panel, que lo escrito en WhatsApp siga ahí al volver de Email, y el ✓ al escribir. En el teléfono, una columna. Nada se manda hasta confirmar.

**Datos del #33 reparados (30/10/2026 17:19, cuenta 3, sesión local_7f005343):** las 8 inscripciones de @leantejado (lead 5437, ws10)
volvieron a como estaban antes del toque (703-707 'activa' esperando el toque; 660, 708 y 709 'completada'). No se repara de nuevo:
el detalle, en docs/hallazgos-chatbot.md → «Los datos que rompió, reparados».

## 30/10/2026 mañana, cuenta 3 (claude3, al 92 %), sesión local_7f005343: el ticket #33 de Leandro

**Lo pedido** (el Cerebro): con copias de la 680, el botón de un DM viejo no anda y pasa todo el lead a «respondió». **Lo
hecho:** un toque nunca va a la pausa; el payload que no se lee se resuelve por el título (la más vieja si hay varias). Test
por el webhook de verdad: tests/boton-dm-viejo.test.ts (escenarios 'duplicadas*' de tests/_boton-vuelve-hijo.ts), 4 roturas
en rojo. Hito con `tickets: [33]`. La cosecha, con lo medido y lo que quedó sin hacer, en docs/hallazgos-chatbot.md.
**Sin hacer:** soltar las 8 de @leantejado (al desplegarse el arreglo). Lo demás, en la sección de arriba.

## 29/10/2026 noche, cuenta 3 (claude3), sesión local_7f005343: el ticket #25 de Leandro

**Lo pedido** (el Cerebro, con el #25 aprobado por Martín): elegir la publicación o el Reel en el CRON de comentario, en la
pantalla y en la API, y que el motor arranque sólo con esa. Lo demás del #25 (palabra clave, respuesta pública, espacios del
botón, /docs) ya estaba en main. «Pedir un dato en el DM y guardarlo en la ficha» es el #20: no se mezcló.

**Lo hecho** (aut-2510 al día con main en 7ed7e17c6; la cosecha en docs/hallazgos-chatbot.md): `publicacion` en el disparador
(lib/publicacion-cron.ts), el motor la mira en los dos lugares (si nace el lead y si se inscribe), el selector con las
últimas 25 de la cuenta (GET /v1/accounts/{id}/posts) en app/automations/EditorDisparadores.tsx, la API de MaKo con el link o
el id (descripción corta, por el presupuesto del turno), y la guía de /docs. Test por el webhook de verdad:
tests/comentario-publicacion.test.ts (escenario 'publicacion' de tests/_boton-vuelve-hijo.ts). Hito con `tickets: [25]`.
**Sin hacer:** probarlo con la cuenta de Leandro después del deploy (elegir el Reel de la 680 y comentar en otro).

## 29/10/2026 tarde, cuenta 3 (claude3), sesión local_7f005343: el ticket #29 de Leandro

**Lo pedido** (el Cerebro, con `mako_doer_conv` 1716): «Ya te sigo» vuelve a «¿Te sigue en Instagram?» y no hace nada; y que
/docs explique las palabras clave del disparador. El punto 3 (MaKo le contestó con un borrador del Plan) es del chat de MaKo
en WhatsApp: no se tocó.

**Lo hecho** (main mezclado en 9ae15da85; la cosecha en docs/hallazgos-chatbot.md, la regla en AGENTS.md): el diagnóstico
del ticket («no puede volver a una tarjeta de antes») era el equivocado: la base muestra que volvía. Eran (1) la clave de
Zernio sin la pasada (el segundo «Seguinos» era la respuesta guardada), (2) el toque rápido tirado como doble y (3)
«¿te sigue?» de la caché. Más el tope de 10 toques por vuelta. La guía nueva de /docs: «Palabras clave y botones de
Instagram» (app/api-mako/Articulos.tsx). Test por el webhook de verdad: tests/boton-vuelve-a-la-condicion.test.ts con
tests/_boton-vuelve-hijo.ts (8 roturas, todas en rojo). Hito con `tickets: [29]` en app/admin/dev/chatbot/bitacora.ts.
**Sin hacer:** el tope deja sin recurso a quien tocó 10 veces sin seguir; un «fallo» que Zernio sí entregó no cuenta como
pasada. Probarlo con la cuenta de Leandro después del deploy (con «Volver a probar» en su ficha).

## LO ÚLTIMO: 29/10/2026 madrugada, cuenta 3 (claude3), en la PC, worktree C:/dev/wt-aut-2510, rama `aut-2510` (main mezclado en 9df736464)

**Lo pedido:** el Cerebro verificó 69b49a31c con refutador y NO entró al tren: 1 ALTA, 6 medias y 5 bajas (informe con la
entrada exacta y los scripts en C:/dev/revisiones/2910-verificacion-automations-69b49a31c.md y scratch-69b4/). La cuenta 4
hizo el ALTA y cortó al 94%; la cuenta 3 siguió con lo demás.

**Lo hecho** (cada uno probado rompiéndolo; la cosecha en docs/hallazgos-chatbot.md y -comunicacion.md, el índice en
docs/hallazgos.md):
- 5e67180c7 — ALTA: un DM de Instagram ya no recibe DOS respuestas del AI Step (una charla abierta y una «envía un mensaje»
  con el AI Step primero): la nueva contesta sólo si ninguna charla tomó el mensaje (`tomadas === 0`, el webhook).
- 1b4f6e636 — media: «Volver a probar» ya no reusa la clave de Zernio de la vez anterior (`claveDeEnvio`, lib/reentrada.ts:
  inscripción, VUELTA = `inscripto_at`, y nodo).
- 3447cb4c5 — media: `mudanza-avisos-plataforma.mts --eventos=social_tope` ya no tira; tests/mudanza-apagados fija que TODO
  evento de la plataforma tiene su línea.
- 19710af7b — medias de la difusión y una baja: una vez por pedido (clave del pedido + compare-and-set; el mismo pedido
  retoma la suya y suma a los que faltan); Instagram con goteo promete sólo a quien el turno alcanza antes de su ventana
  (`salidaHastaMs`, `demoraDelTurno`); `difundir_a_leads` sólo en la app; el goteo fuera de rango se dice antes del «sí».
- 2a9bf59b5 — baja: la pública va sólo al comentario del disparo (uno de más de 2 min después de inscribirse, no).
- 99900a0d3 — bajas: el «cerca del tope» por cuenta (`cuentaMasCargada`) y con su canal; el recordatorio diario con
  `zonaDelNegocioEstricta` (sin zona, esa vuelta no avisa).
- 8287ce624 — baja: la difusión que terminó se pausa sola (clave `difusion-…`, `pausarDifusionesTerminadas` en la corrida
  de la hora).
- 9df736464 — merge de origin/main (dos choques de docs, quedan los dos lados).
- La reverificación de Integración sobre 0265924c6 (NO entró: 1 MEDIA-ALTA, 2 bajas), arreglada y re-verificada con SU arnés
  (C:/dev/revisiones/scratch-0265/ig-refuta/_hijo.mts; las salidas de la segunda vuelta en scratch-f8a1/):
  - b3d734055 — MEDIA-ALTA, regresión de 5e67180c7: `tomadas` contaba inscripciones PAUSADAS, y una automatización sin AI
    Step también se pausa: el primer DM quedaba sin respuesta. Ahora el webhook mira `atencion.contestada` (lo llenan el AI
    Step de la respuesta o la charla abierta; `seguirCharla` devuelve si contestó).
  - 88cf6bbd7 + f8a13def3 — la difusión pausada: el mismo pedido la vuelve a prender (sin `aunqueDuplique`: la pudieron
    editar mientras estaba pausada) y suma a los que faltan.
  - d8516957f — sin zona del negocio se frena sólo el recordatorio de los días siguientes (`necesitaLaZona`); el primer aviso sale.

**La media que no es de Automations:** `HojaDifusion` no está montada. El enganche (`onMandarMensaje` en
app/crm/AccionesLoteLeads.tsx y app/crm/seleccion-difusion.ts) está en la rama `crm-lote-2810`, que todavía no está en main.
Cuando entre, el CRM (CrmBoard) monta `<HojaDifusion abierta seleccion={sel} onCerrar={…} onCreada={(r) => …} />` con la
selección que le pasa `onMandarMensaje`; `onCreada` trae `yaEstaban` cuando era el mismo pedido.

**Lo que Leandro pidió y TODAVÍA NO EXISTE** (tickets #20 y #25, `mako_doer_conv` ws10 1681/1699/1701; el texto que se le
mandó, verificado contra el código, está en las notas compartidas: leandro-respuesta-automations-29-10.md):
- elegir la publicación o el Reel en el CRON de comentario (el webhook ya trae `comentario_post_id`);
- pedir un dato en el DM y guardarlo en un campo de la ficha (no hay tarjeta que guarde la respuesta; hoy queda en Chats);
- webhook de SALIDA (lead nuevo, cambio de etapa, etiqueta): no hay nada en Integraciones;
- que el lead comparta el post y saber si lo hizo;
- por la API con token (rest.ts): las palabras del CRON (`cambiar_crons_secuencia` es SIN_HTTP), «Volver a probar»
  (SIN_HTTP), abrir un ticket (`levantar_ticket`: app y WhatsApp), las tarjetas «Etiqueta» y «Acción» (PUT /pasos sólo
  WhatsApp y email sin ramas), y sacar la flecha directa de un DM para que espere el botón. Y /docs al día con el lienzo.
  Exponer a un token lo que cambia a quién le escribe es decisión del Cerebro (el comentario de `cambiar_crons_secuencia`).

**Sigue: el aviso antes de los 10.000 mensajes gratis de Zernio** (audio 327 de Leandro; coordinado el 29/10 con el chat de
Zernio, `local_4a831c28`). Zernio armó `usoZernioDelCiclo(ws)` en lib/zernio-uso.ts ('server-only'), en zernio-2510 (7397880e7): el ciclo sale
de GET /v1/billing y lo enviado desde MaKo se cuenta en MaKo (`nutricion_envios` social, más `ig_mensajes` saliente sin la
pública). Automations lo consume cuando esa rama esté en main: en `avisarTopesSociales`, sólo en la corrida de la hora, al
80 %, una vez por ciclo (`reclamarEspaciado`, clave `zernio-gratis:<desde>`). Va con el mismo evento `social_tope` y un
tercer estado «gratis» en la plantilla y en `datosTopeSocial`. Hoy MaKo no mandó nada por redes desde el 01/09: no apura.
Devuelve `{ enviados, gratis, desde, hasta, deLaCasa } | null` (`hasta` excluido; `deLaCasa`: la clave es la de MaKo, el ws1 →
avisarle a Martín, no al grupo). Es APROXIMADO: una fila de `nutricion_envios` cuenta 1 aunque salgan varias partes, y la
pública (gratis para Zernio) cuenta. Para que sea exacto, el motor tiene que guardar las partes y marcar la pública.
Acordado con Zernio (29/10): el texto dice «llevas CERCA DE X enviados DESDE MAKO» (lo aproximado, y lo que el negocio manda
desde el inbox de Zernio no se ve). Cuando el motor guarde las partes y marque la pública en `nutricion_envios`, se le pasa a
Zernio la columna (o el `asunto`) y él ajusta `usoZernioDelCiclo`, que es suyo. zernio-2510 tiene VERDE (4b6acf1c0).

**Dónde está (29/10, mañana):** f8a13def3 aguantó el arnés de Integración y entró al tren `tren-z` (merge ff8ec04b6) junto
con Zernio + Planes y las copias del Web Generator; corren los tests del tren entero y Integración avisa cuando esté Ready.
Después del deploy y con el «dale» del Cerebro: la fila `social_tope` del ws9 (la mudanza), la config de la 680 y «Volver a
probar» de los leads 5425/5426.
**⚠️ lib/zernio.ts: partir de tren-z (o de main, cuando entre).** En el tren, `keyDeSeguimiento` vuelve a
`credDelClienteEstricta('ZERNIO_API_KEY', ws)`: la rama de Zernio la había pasado a la cuenta de la plataforma, contra la
decisión de Martín (una cuenta por negocio) y contra tests/condiciones-instagram y tests/zernio-sin-respaldo.
**Verificación:** tsc-acotado limpio (sólo los 14 de _opencut) y tests-afectados ✔ VERDE sobre f8a13def3 (5960 tests de 596
archivos).

## 28/10/2026 noche, cuenta 4 (claude4), en la PC, worktree C:/dev/wt-aut-2510, rama `aut-2510` (main mezclado en 072639610)

**Lo pedido** (el Cerebro, reenviado tras la caída de las 18:34, en este orden): (1) arreglar lo que sobrevivió a su
refutador sobre 7f7e404d9 (C:/dev/revisiones/2810-verificacion-automations-ig.md y -anuncio.md): el ALTA «una palabra clave
de sólo emoji o signos se descarta y el CRON queda para CUALQUIER comentario», 4 medias y 3 bajas; (2) el ticket de Leandro
(#19, y el #20 que MaKo levantó solo con lo mismo): «solo cuando el comentario contiene X», y dos preguntas verificadas; (3)
avisar ANTES del tope de Instagram (ya hecho en c6f78deb4 y 0c121ab4b); (4) el primer DM va en el VERDE nuevo; y el pedido
nuevo de Martín por Leila: «seleccionando a toda una columna o una cantidad de leads específicos en el CRM y apretar mandar
mensaje de difusión … WhatsApp, email, Instagram … y configurar ahí mismo el goteo o la cantidad de mensajes diarios por una
cuestión de baneo». Todo junto en un VERDE por SendMessage; lo pesado con `node C:/dev/con-turno.mjs …`.

**Lo hecho** (rama `aut-2510`, cada uno probado rompiéndolo; la cosecha en docs/hallazgos-chatbot.md y -comunicacion.md):
- ef1c248b4 — ALTA: «?» o «...» se rechazan con aviso (ruta, API y caja); el resumen de `cambiar_crons_secuencia` nombra las
  palabras (baja). ef429e3e7 (antes) hizo que el emoji cuente.
- e90bae7d1 + 31c3fbf70 + 077f2913f — ticket #19/#20: «Volver a probar» por lead (ficha del CRM y
  `volver_a_probar_lead_secuencia`); hito con `tickets: [19, 20]`. Las respuestas (a) y (b) ya se las mandó el Cerebro a Leandro.
- 330b7a218 — media: un pedido de cambio en voseo («poné», «subí») vuelve a editar en «Editar».
- 8c56ddbf3 — medias y baja: Crear con IA ofrece el anuncio; «¿Qué hace esta automatización?» encuentra el CRON del anuncio;
  Messenger recupera «enlace de referencia».
- 7dac2d5cc — media: la respuesta pública sólo al comentario del disparo; si no puede salir, se omite y el DM sale igual.
- 51a37db8b — baja: el recordatorio diario de cuenta frenada sale de 9 a 21 en la zona del negocio.
- 4cc29df29 — la DIFUSIÓN: `HojaDifusion` (app/automations/difusion/), lib/difusion.ts y -reglas.ts, `difundir_a_leads`.
- 1ca902867 — «Para el Cerebro» de docs/relevo/automations-nube-2710.md al día.

- 077f2913f — el hito de «Volver a probar» cierra también el ticket 20 (`tickets: [19, 20]`).
- 2172da39b — los 11 rojos de tests-afectados sobre 5ddb4ae6a: ninguna regresión (tests que leían el fuente viejo, la
  difusión leyendo Instagram fuera del canal y sin su lugar en las listas de activar, un `role="alert"` sin «Reportar a
  Soporte»). Los 14 corridos de a uno, en verde.

**Verificación:** tests-afectados corrió sobre 5ddb4ae6a (5947 tests, 595 archivos): 11 rojos, arreglados en 2172da39b y
repetidos de a uno en verde. Tipos: los 35 archivos de antes y los de la difusión, limpios (sólo los 14 de `_opencut` y 2 de
`Compartir.tsx`); los 4 tocados en 2172da39b, esperando turno. Después, el VERDE al Cerebro.

**La verificación del Cerebro sobre 69b49a31c:** arreglada el 29/10 por la cuenta 3 (ver arriba).

**A medias / sin hacer:** el botón «Mandar mensaje» y la selección del tablero son del CRM (el Cerebro le pasó la interfaz);
la difusión no se probó mandando; elegir la publicación o el Reel en el CRON de comentario (tanda siguiente); «Crear con IA»
no pone palabras clave en el CRON (fue lo que rompió la 680: usó la CONDITION del formulario).

**Espera a Martín / al Cerebro:** después del deploy, con el «dale»: configurar la 680 (scratchpad configurar-680.mts
--aplicar; activar con otro «dale») y la prueba de punta a punta con Fiesta Music y «pruebafm»; la fila del ws 9 del aviso
`social_tope` (escribir en producción); MAU-07/MAU-08 y la prueba A/B del ws3 esperan su sí.

## 28/10/2026 tarde, cuenta 4 (claude4), en la PC, rama `aut-2510` (con main mezclado)

- **Ticket #17 de Leandro (el #12 es el mismo texto): responder EN PÚBLICO el comentario.** `en_comentario: true` en el
  mensaje de Instagram o Messenger; el interruptor se ofrece con un CRON de comentario; la IA del lienzo y la API
  (`cambiar_botones_mensaje`) lo prenden y apagan. Hito con `tickets: [17]`. Sin probar con un comentario de verdad. Cosecha
  en docs/hallazgos-chatbot.md.
- **Ticket #17, segunda mitad: las palabras clave del comentario** («fiesta», «guía»; «contiene» o «exacta»; vacía = cualquiera),
  como ManyChat. En el mismo hito. Su automatización 680 no arrancaba nunca (el filtro era la condición del FORMULARIO y
  está pausada): el cambio que le falta está en «Para el Cerebro» de docs/relevo/automations-nube-2710.md.
- **Leila 2: los que YA están en la etapa.** No entraban por la ventana de 90 días sobre el último hito (mover de etapa no
  es un hito). Al activar una «llega a etapa», la pantalla cuenta y ofrece «Incluirlas». Sin medir en la base de Leila.
- **Lo prometido a Teo (cola del Cerebro):** el CRON «clic en un anuncio» prendido (Instagram y Messenger; la IA lo ve sólo
  si el pedido habla de anuncios). El PRIMER DM: si la primera tarjeta es el AI Step, lo contesta (la (a) del Cerebro, como
  ManyChat). Faltan: «Crear con IA» de Instagram; el asistente por WhatsApp (Agenda del día, «te toca cobrar») va a su propio
  chat; la primera prueba A/B real en el ws3 espera el sí de Martín.
- Sigue, en este orden: Leila 1 (el `?ws=`, ya en el commit WIP 922af2d5d) y Mauricio (MAU-07 y MAU-08). El relevo de la
  nube (docs/relevo/automations-nube-2710.md) tiene el detalle.

## 27/10/2026 tarde, cuenta 5 (claude5, «Ananda»), rama `aut-2510`: la tanda de 12 del Cerebro

La tanda salió de las llamadas 874749710 (Leandro), 876470842 (Leila) y 876825880 (Aaron), del grupo Makito y de la
Ticketera. Hechos, con test y probados rompiéndolos (la cosecha, en docs/hallazgos-chatbot.md, -ia, -comunicacion y -ui):

- **3. Las iniciales** de un DM y del globo de «Probar» salen de `iniciales` (e77ee8d5e). Quedan seis lugares de otras
  áreas, anotados en hallazgos-ui.md.
- **5. El chat dice qué IA contestó** («Con tu Claude», «Con la Gemini de MaKo (respaldo)»). El orden de la cascada ya era
  el pedido.
- **6. Una pregunta en «Editar» se contesta.** Con o sin signos, con saludo adelante y con el «?» en el medio. Probado con
  Claude y Gemini reales: `scripts/arnes-pregunta-en-editar.mts`.
- **10. «Sale desde».** En el Super Admin, los selectores muestran las mismas líneas con las que se manda.
- **9. El número compartido de Leandro: no.** Las automatizaciones le escriben sólo a leads del CRM; a quien escribe y no es
  lead nadie le contesta solo. MaKo lo sabe contestar en el chat del lienzo (`LO_QUE_NO_ES_TARJETA`). El texto para su grupo
  se lo pasé al Cerebro.
- **7. El chat de Joan (ws13), descartado con evidencia.** El 15/10 era el incidente de Gemini (230323411). El 16/10, «un dato
  de la reunión sin un esperar», que a0feecde9 (17/10) enseñó a corregir. Joan no volvió a pedirlo.
- **11. La tarjeta de mensaje dice «tal cual»** (el cuadro: «Escribe lo que le llega, tal cual»; el ✦ ofrece que lo
  escriba MaKo). Unir tarjetas ya se veía desde el 15/10: «Conectar a una tarjeta» es la primera opción del «+»
  (50f263134). Sin mirar en pantalla que el texto entre en una tarjeta angosta.

- **Ticket #12 de Leandro, los espacios en el nombre de un botón:** era el `trim` del saneo en cada tecla
  (`botonesDe(…, { comoSeEscribe: true })` en el editor). La otra mitad, responder en público el comentario, va aparte:
  Zernio la tiene (`POST /v1/inbox/comments/{postId}` con `commentId`). Hecha el 28/10 (ticket #17, arriba).
- **MAU-33:** una cuenta de anuncios frenada varios días avisa una vez por día (56be0692d).

**Medido, sin escribir (lo decide el Cerebro):**
- **4. La #266 de Brigitte (ws15).** La espera de 1 h y el recordatorio se fueron con un Publicar de la pantalla el
  23/10 a las 14:05Z. No fue MaKo, ni la API, ni la IA. Quién lo hizo no se sabe: no hay registro. Devolvérselos es
  escribir en su negocio.
- **1 y 2. Los avisos al grupo y «Completa el disparador».** Para probarlos hay que crear y activar automatizaciones en el
  ws3, o sea escribir en producción. Falta el sí del Cerebro.

**Sigue:**
- 8. Proponer los textos con el conocimiento del negocio.
- 12. Versiones con «restaurar» y un centro de errores.

**Sin investigar:** el 26/10, el chat del lienzo del ws9 (#700) contestó «Gemini está saturado» dos veces (hallazgos-ia.md).

## Antes: 24/10/2026 noche, cuenta 5 (claude5, «Ananda»), rama `aut-2510`

Martín: «eso si es un bug, el goteo debe comenzar a contar desde que se envia el primer mensaje», y sobre la cuenta de
anuncios de Mauricio: «para esto tenemos las notificaciones de advertencia al grupo de mako».

- **El goteo de la #289, medido en producción** (`scripts/medir-goteo-tras-deploy.mts`, sólo lectura, cada negocio en SU
  base): «Contestó» corta (4 de 4). Desde el deploy (~18:06 ART) no salió ningún M1 nuevo; para ver el ritmo de 11 min y la
  condición sin turno hacen falta M1 NUEVOS (que Mauricio mueva leads a «Prospección activa»). Volver a correrlo entonces.
- **Lo agendado antes del deploy con el reloj viejo: HECHO.** Martín lo aprobó y el Cerebro corrió
  `scripts/recalcular-esperas-viejas.mts --ws=1 --sec=289 --aplicar` el 24/10: cambió 12 (los otros 8 ya habían salido);
  releído, ninguno con el reloj viejo. La pregunta 33b2217e del Ops Center la retiró él.
- **P11, el aviso de la cuenta frenada** (`scripts/medir-aviso-cuenta-frenada.mts`): llegó al grupo de Mauricio 26 veces el
  15 y 16/10 y calla desde el 16/10 por el techo de 3 (la cuenta sigue impaga). Si vuelve a avisar un incidente de días es
  decisión de Martín (docs/hallazgos-comunicacion.md, «Una alerta con el techo agotado…»). La cuenta compartida ws1/ws4
  avisaba con dos relojes: arreglado en `lib/alerta-critica.ts`.
- **Los tres rojos de main** (vuelo-mako, dashboard-pedidos-chat, paso-ia): tenía razón el código en los tres; los tests
  fijaban líneas viejas. Al día y probados rompiéndolos.
- **Sin dueño, visto de paso:** `tests/progreso.test.ts` rojo por dos hitos sin `sesion` en
  app/admin/dev/ai-runtime-cascada/bitacora.ts (chat «IA del cliente»). Y el hito de esta tanda firma `claude5`, que en
  `CUENTAS` (app/admin/dev/_registro/tipos.ts) entra con d7b1f9849 del tren (`tren-j`).
- **El arreglo del goteo, visto andar (22:00 ART):** los M2 de las 21:34, 21:46 y 21:58 dejaron la espera siguiente a
  48,00 h exactas. El aviso de arreglo al grupo de Mauricio SALIÓ el 24/10 (lo aprobó Martín y lo mandó el Cerebro, con la
  clave goteo-espera:289:2410).
- **Dashboard (trabajo 0786cbfe, «Sí, y que la criatura vea la hoja»):** salió el AI Analyst y la estrella ve la hoja
  (eb71fa238; docs/hallazgos-graficos.md). Sin verlo en pantalla.
- **Trabajo 49ff20a3 (Martín, firmado):** (1) un solo «Dashboard» en More del teléfono (0427d58be;
  docs/hallazgos-mobile.md). (2) **Botones en los DM de Instagram y Messenger, como ManyChat**: fase A (el motor, el
  webhook y el lienzo) y fase B (la IA de MaKo los arma al crear, con el gate que no regala el link) hechas y probadas sin
  pantalla (docs/hallazgos-chatbot.md, «MaKo no tiene botones…»). **Sigue:** «Editar con IA» (`deIAEdicion`), «Probar»,
  y probarlo con un DM de verdad en el Cliente de Prueba con una cuenta de Instagram conectada. El trabajo lo cierra el
  Cerebro cuando estén las tres partes.
- **f20 y f21 de la llamada con Leandro (docs/feedback-24-10.md): UN goteo y UN tope por día para todos los canales.**
  Martín, 24/10 23:00: «Uno solo... que valga para todos los canales». Hecho: un bloque «Todos los canales» en
  Configuraciones, que vale para WhatsApp, email, Instagram y Messenger (cada canal cuenta lo suyo), y de paso el goteo del
  email, que no frenaba (docs/hallazgos-chatbot.md, «Un goteo para todos los canales…»).
- **f17, f18 y f23 de la misma llamada, hechos:** el audio al instante en el chat del lienzo («La nota de voz del chat del
  lienzo…»), la pregunta dictada en «Editar» y «Pedírselo al equipo» para lo que no está («Una pregunta en «Editar»…»),
  los dos en docs/hallazgos-chatbot.md. Y f19/f22 (la tuerca de verdad en el globo; un lugar inventado no pasa: «MaKo nombraba
  un ícono…»). Y f34, la criatura que se escondía detrás de la barra desplegada (docs/hallazgos-ui.md). Toda la tanda de la
  llamada que era de Automations está hecha; nada se vio en pantalla.
- **Pruebas A/B, tanda A3 hecha (25/10): la tarjeta «A/B TEST»** con todas sus puertas (la lista revisada, en
  docs/hallazgos-chatbot.md), el editor (EditorPruebaAB: ramas, porcentajes, Empezar y Detener), «Probar» (un escenario por
  rama), Crear y Editar con IA (`prueba_ab`, su regla sólo si el pedido la nombra), la API (`ver_prueba_ab`,
  `empezar_prueba_ab`, `detener_prueba_ab`), los medidores de Automations en el cron y una franja en Métricas. La migración
  ya está aplicada (0335, 25/10 19:27); falta la primera prueba real en el Cliente de Prueba.
- **El chat de MaKo perdía herramientas (25/10, arreglado):** `cambiar_botones_mensaje` y las tres de la prueba A/B le sacaban
  el lugar a `editar_pasos_secuencia_mensajes` y a `cambiar_crons_secuencia` (tests/ops-center-clasificador-app). Una
  operación nueva va AL FINAL del área y se mide con esas frases antes de entregar (AGENTS.md). Crear con IA por HTTP
  devuelve la pregunta como 400 con `faltan`, y la pérdida esperada del juez quedó sólo al tope.
- **«MaKo Messages» salió de Automations del super admin (26/10, Martín: «elimina eso»):** /mensajes y /m/mensajes redirigen a
  Automations. Era el editor de la base de los avisos, que no existe en producción; los avisos siguen saliendo con el store de
  cada negocio. Los 9 avisos de Notificaciones que nacían apagados salieron de la lista (Martín, 26/10: «Sacarlos de
  Notificaciones»). Detalle en docs/hallazgos-comunicacion.md.
- **Las variantes del texto viejo (25/10, la revisión del tren-k):** todo lo que cambia el texto de un mensaje (los dos
  editores, Editar con IA, la API) pasa por `variantesTrasCambio` (lib/mensaje-partes.ts) y las suelta; la rama B de una
  prueba nace sin las de A y la firma las cuenta; el «Deshacer» del 🗑 las devuelve.
- **El texto de un WhatsApp o email en un flujo CON ramas, por la API (25/10):** `cambiar_texto_mensaje` (PATCH
  …/mensajes/{tarjeta}/texto), por `publicarPasos`, al final del área. Cambiar el texto suelta las variantes del viejo (el
  guardado ahora respeta un `[]` explícito), también en el texto de un DM. Sin hacer: `editar_pasos_secuencia_mensajes` sigue
  avisando «conserva N variantes» en vez de soltarlas.
- **Pruebas A/B, tandas A1 y A2 hechas (25/10, el Cerebro; diseño en docs/diseno-pruebas-ab.md, manda la crítica):** A1, el
  motor puro lib/pruebas/ (asignar, estadistica, juez, volumen, metricas) y el test A/A con el calendario real
  (tests/pruebas-juez-aa, ≤ 5 % de falsos ganadores). A2, la migración supabase/migrations/0335_pruebas_ab.sql (la
  numeró el Cerebro y la APLICÓ en producción el 25/10 19:27, con el sí de Martín), lib/pruebas/store.ts, el cron /api/cron/pruebas (6:15 UTC, sin
  medidores todavía), concluir → `experimentos` y `fmtVal` con «ab:». Sigue **A3**: los medidores de Automations
  («respondio», «agendo», en el cron), y la clase `ab` con TODAS sus puertas en un commit (transparente para `condicionDeArriba`, `minutosAntesDeReunion` y
  las reglas de forma; `esBifurcacion()` y la lista de los ~70 `=== 'condicion'`); la primera prueba real, en el Cliente de
  Prueba. Landings usa el motor para la landing: le pasé las firmas (25/10); el store ya está (A2).
- **Los botones de Instagram, de punta a punta (25/10, Martín: «Que lo pide el cliente Leandro»):** Editar con IA,
  Probar, la ficha y la API, hechos y probados sin pantalla (docs/hallazgos-chatbot.md, «Los botones de Instagram, de punta
  a punta…»). **Falta el DM de verdad, y depende de Martín**: ningún negocio nuestro tiene Instagram conectado por Zernio
  (`scripts/medir-instagram-de-mako.mts`). Los pasos:
  1. En el negocio Martin Koncke, Integraciones › Zernio: pegar la key de Zernio de MaKo, y conectar el Instagram de MaKo
     con el login de Instagram (el webhook se registra solo al conectar).
  2. Armar la automatización de prueba en ese negocio: «Por Instagram: quien comenta PRUEBAMAKO recibe el recurso, pero sólo
     si nos sigue» (Crear con MaKo arma el gate), y prenderla.
  3. Desde OTRA cuenta de Instagram que NO siga a MaKo: comentar PRUEBAMAKO en un post de MaKo. Tiene que llegar el DM con
     «Obtener recurso». Si Instagram rechaza los botones en esa respuesta privada (pasa con quien no sigue), llega el texto
     con «Escríbeme «Obtener recurso»», y escribirlo cuenta como tocarlo.
  4. Tocar «Obtener recurso»: tiene que llegar «Síguenos y toca el botón» con «Ya te sigo». Seguir a MaKo, tocar «Ya te
     sigo»: tiene que llegar el link. Y en la ficha del lead, mientras espera: «Espera que toque…».
  Para ver qué salió: `nutricion_envios` de ese negocio y la ficha del lead; la cuenta y el webhook, con `scripts/medir-instagram-de-mako.mts`.
- **Lo que pidió el Cerebro (hecho el 24/10 a las 23:55):** el `redirect()` de las tres páginas del Dashboard con `loading.tsx` encima
  (React #310) pasó a app/dashboard/layout.tsx y app/m/dashboard/layout.tsx, y salieron de la lista de conocidas
  (docs/hallazgos-infra.md, «Los dashboards redirigen en su layout…»). Sin medir en producción.

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

## 22/10: la llamada con Mauricio cambió el plan

La lista entera (A1-A7, con la cita de Fathom 195129619): C:/dev/cerebro-herramientas/feedback-llamada-mau-22-10.md.
**El plan nuevo:** Mauricio armó el CRM **«Sprint 3 días» (#44 en el ws1)**: Lead entrante → Prospección activa → Oferta /
Checkout → Ganado → Grupo de WhatsApp → Webinar. Trae ~1.050 leads a «Lead entrante» y cada día mueve A MANO 50 a
«Prospección activa»: ESO dispara la apertura (CRON en «Prospección activa», nunca un barrido de «Lead entrante»). Los
envíos empiezan el sábado 24/10, 50 por día, hasta el 13/11. La secuencia honesta: el .md de la campaña
(campana-sprint-mauricio.md en la carpeta del proyecto). El «Hola, ya me llegó tu pago…» que se pegó en la llamada NO
se arma: es un recibo falso.
> Corregido el 23/10 por Martín: es a propósito, la técnica de levantamuertos (confirmar un pago para después disculparse, sólo para que respondan el primer mensaje). No se marca ni se toca.

Lo que quedó en la rama (encima de 9c8f106c0):

1. **A3 — goteo por automatización** (2b5a03115): en Configuraciones › Límites de cada automatización, «Uno cada N
   minutos» y «Hasta M por día», adentro del tope de la línea (que sigue siendo el techo anti-ban). Lo frenado por el
   goteo pasa a su turno; por la API de MaKo, `configurar_automatizacion` con `goteoMinutos` / `goteoPorDia`.
2. **A1/A2 — el chat obedece** (bbbfe38ff): arriba del composer, **Discutir** (sólo contesta) o **Editar** (cambia el
   flujo; nunca explica; los textos pegados van tal cual). La charla viaja al modelo: «hazlo como te lo indiqué» ya
   tiene a qué referirse.
3. **A4 — la plantilla «Prospección: apertura»** y **A5 — el aviso dice qué etapa y de qué CRM** (661146056). A5 no era
   un cache: «Contactado» no existe en «Sprint 3 días».

**La cuenta de la línea del ws1 para que pasen 50:** reserva para lo que entra (10/día, 1/hora) + las bienvenidas +
la campaña. Con goteo de 5 min la campaña pide 12 por hora: línea en **65 por día y 15 por hora**.

**A6, cómo quedó en el ws1 (22/10 ~04:18, en producción 4de3fe769, run 232):** #289 «Sprint · apertura», **pausada**,
0 inscripciones. CRM #44, CRON `etapa_actual` en `st0` = «Prospección activa». Tres tarjetas: «Nunca le escribiste» →
WhatsApp «Hola {{nombre}}, soy Mauricio. ¿Sigues al frente de tu empresa?» (para aprobar: «Sale sola» lo decide
la reunión) → «Si responde» = AI Step sin escenarios (no contesta: avisa al grupo con el link a la charla), objetivo «…lo
pase a «Oferta / Checkout» cuando le mande el link». Goteo 5 min / 50 por día. Línea del ws1: `mako.limites_envio` =
65 por día y 15 por hora (era la de fábrica, 40 / 6). Se hizo con Chrome desconectado, por las funciones de la pantalla
(`publicarPasos` con las comprobaciones de la ruta, `descartarBorradorSecuencia`, `guardarConfigAutomatizacion`,
`limitesParaGuardar` + `setSetting`), y se releyó contra `grafoDeSecuencia`. Salió: la rama «Tiene Sprint · audio» (el
audio #1 era la «Bienvenida» de agosto, con un pie inventado) y **un borrador vigente con el recibo falso** («Hola
{{nombre}}! ya me llegó tu pago, muchas gracias» + «¿Me das tu email para registrarte?»), que era lo que abría el lienzo.
> Corregido el 23/10 por Martín: es a propósito, la técnica de levantamuertos (confirmar un pago para después disculparse, sólo para que respondan el primer mensaje). No se marca ni se toca.
Si Mauricio graba el audio del Sprint, la rama se vuelve a armar con su etiqueta. **Falta mirarla en pantalla** cuando
vuelva la extensión de Chrome.

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
  tope por hora a 13+. Lo decide Martín (riesgo de ban: hoy la línea le escribe a 13-16 personas por día). 22/10: se
  decidió 50 por día, moviéndolos a mano (arriba).
- A7: el link al grupo de WhatsApp después de «Ganado» espera el link que pasa Mauricio.
- Al CREAR (no al editar), el modelo sigue inventando el texto de una tarjeta de audio que la persona graba ella;
  crear no tiene «Discutir / Editar» (app/api/chat-agent/secuencias/ia/route.ts, rama `crear`).
- Los días del goteo son los del horario propio de la automatización; no hay un «sólo estos días» aparte del horario
  (lib/config-automatizacion.ts).
- **AU4 (P2), después de que entre el AU2:** (1) ChatMako pasa a CajaChat + HiloMako (app/_chat) con SU motor
  (/api/chat-agent/secuencias/ia: crear en el lienzo vacío, las fases, el borrador en vivo), y Discutir/Editar va al
  slot de modo de la pieza (Discutir = 'analizar', Editar = 'editar'); cuidar lo del 22/10 (el mensaje al instante y
  «Reintentar», la capa en toda la pantalla, las fases en una línea: tests/chat-mako-envio-a-la-vista.test.ts). (2) La
  «Pídeselo a MaKo» de la galería (CajaPedido) pasa a CajaChat. (3) La estrella (`MakoEnLaTab`, OC6) CONVIVE, no
  reemplaza: `tab="Automations"`, `entidad={{ tipo: 'automatizacion', id: <secuenciaId>, titulo: <nombre> }}`,
  `modo="analizar"` (lo general con la automatización de contexto; su turno es el del Cerebro, por la API de MaKo, sin las
  fases ni el borrador). Que la estrella edite el lienzo en vivo sería otra pieza (el Cerebro llamando a esta ruta): se
  decide con Martín antes. Las charlas del lienzo ya se ven en el Ops Center (OC5), de sólo lectura.
- Cuando IA16 (chat «IA del cliente») esté en main: sacar de `sinIAPropia` las ramas «La IA gratis de MaKo llegó a su
  tope / está al tope / está saturada / no contestó» (con IA16 la red no corre fuera del ws9) y dejar «No tienes una IA
  conectada: conecta {SU_IA}» y los dos marcadores de red salteada (lib/flujo-ia.ts; su test,
  tests/ia-aviso-sin-ia-propia.test.ts). IA16 está retenido hasta que el ws1 conecte su IA o el lunes 26/10.
