# El Chatbot según la llamada con Leila del 01/10

[Ver la grabación](https://fathom.video/calls/845462628) · 5 lectores sobre el transcript
completo (1.001 intervenciones) + el estado de producción medido contra la base.

> **Es el complemento de [llamada-leila-01oct.md](llamada-leila-01oct.md)**, que contestaba
> otra pregunta —el orden, las fechas y la poda— y del Chatbot sólo trae dos líneas.

## Quién empuja el Chatbot: Mauricio, no Leila

Conviene saberlo antes de leer el resto, porque el hilo se lee como si el Chatbot fuera el
pedido de Leila y no lo es. Ella lo dice: «también me lo está pidiendo ya Mauricio»
(00:26:25). Y Martín dos veces: «le estoy dando más prioridad porque también Mauricio ahí
me está insistiendo» (00:40:38) y «esto es otra cosa, que es lo que quiere Mauricio»
(00:51:00). **Leila es la primera usuaria y la que puso la especificación; el que lo puso
en el P1 es Mauricio.**

## El encargo, en dos frases y de dos personas

> «el chatbot debería ser **un soporte para la masa**… no para esos nueve que tenés ahí»
> — **MARTÍN**, 01:37:00

> «quiero dejar la secuencia armada y que **no dependa de que yo tenga el tiempo**»
> — Leila, 01:36:45 · «mínimamente dos mensajes a la semana» (01:38:34)

Es el criterio de corte más reusable de la llamada y **no estaba en la extracción
anterior**. Los «nueve» son los tratos calientes que Leila atiende a mano: **121.500 pesos
que ya habían dicho sí** (01:29:31), y son inbound, los pidieron ellos (01:31:06). Esos van
«aparte, en el CRM o en tu cabeza» (01:38:00). El chatbot es para el resto.

## El problema central, y la salida que se eligió

> «lo tengo que hacer **como muy libre**, pero todavía no se me ocurre la manera de cómo
> hacer para **vincularlo con tal persona**» — Martín, 00:34:00

La contestó Leila en dos palabras —«**Por CRM, ¿no?**» (00:34:14)— y Martín la cerró: «los
que caen en tal etapa y tal vez de última agregar además de las etapas **la funcionalidad
de tags**» (00:34:18) → «elegís la etapa o elegís la tag **y se envía**» (00:34:31). El
mensaje «puede contener archivos, puede contener audio, puede contener **lo que sea**»
(00:34:41), y lo desarrolla sin cortar: «si le querés enviar un audio a todo, le enviás un
audio… un link, mande, lo que sea» (00:34:45-00:34:54).

⚠️ **Y hoy el paso de mensaje del flujo es SÓLO TEXTO.** En `lib/flujos-tipos.ts` un paso
`mensaje` es `{ canal, texto }` y nada más. El transporte sí lo soporta —`lib/evolution.ts`
tiene `enviarMedia` (imagen, video, documento) y el audio como nota de voz— pero **desde el
editor no hay forma de adjuntar nada**. Es la tercera pata del mismo pedido, junto con la
miniatura del link y las piezas literales de Leila.

Y lo que murió con criterio fue el catálogo exhaustivo: «escanear todas las acciones que
hace MaKo» → «**Imposible**» (00:35:08-00:35:16), no por esfuerzo de desarrollo sino por
**complejidad para el usuario**: «va a entrar ahí y va a decir, ¿qué es todo esto?»
(00:35:22, Leila).

### Medido contra el código: las tres mitades están en tres estados distintos

| La salida acordada | Estado real |
|---|---|
| **Por ETAPA del CRM** | **YA EXISTE** desde el 31/07 — trigger `etapa_actual` (`lib/nutricion.ts:342`), funnel-agnóstico, con la etapa EFECTIVA del lead |
| **Por TAG** | **CERO** como campo de MaKo. No hay columna, no hay tabla, no hay migración; los `tags:` del repo son de caché de Next. **Pero ver abajo: puede que no haga falta construirlos** |
| **Atar a UNA persona** | **No existe la función.** Anotado como pendiente desde el 16/09 (`docs/hallazgos-comunicacion.md:2672`) |

⚠️ **«TAG» significa DOS cosas distintas en esta misma llamada, y la diferencia vale una
migración.** A 00:34:18 Martín dice «la funcionalidad de tags, o sea, de etiquetas **dentro
de MaKo**» — un campo nuevo. A 01:43:16 pide que «el chatbot también maneje **las etiquetas
del propio WhatsApp**». Son dos sistemas, y el segundo **ya está sincronizado**: la base
tiene las 23 etiquetas reales del celular de Leila. Si el disparador puede leer la etiqueta
nativa, el eje que falta no hay que construirlo: hay que enchufarlo. **Es la pregunta que
abarata o encarece el ítem entero**, y conviene hacérsela a Martín antes de cotizar tags.

⚠️ **Y la etapa dispara TARDE.** Sólo la levanta el cron, una vez por hora y de 9 a 17 de
México: mover una tarjeta un viernes a las 18 no manda nada hasta el lunes. «Elegís la etapa
y **se envía**» es, hoy, «se envía dentro de 16 horas».

⚠️ **Y el trigger `manual` que la UI ofrece no inscribe a nadie nunca.** Cae en el
fallthrough de `lib/nutricion.ts:528-530`. Se ofrece con la etiqueta «Manual (no se dispara
solo)», y lo que no dice es que tampoco se dispara a mano, porque el botón no existe.

### El hallazgo que nadie tenía anotado: el motor que SÍ es lo pedido está roto en el último metro

`lib/flujos-tipos.ts` es **un segundo motor**, genérico y editable, con exactamente la forma
que se acordó: disparador + pasos, y los pasos son *mensaje al lead* · *inscribir en
nutrición* · *crear tarea* · *marcar lead* · *esperar* · *insistir*.

**Y las cuatro acciones que tocan al lead mueren al confirmarse.** `flujo_wa_lead`,
`flujo_inscribir_nutricion`, `flujo_crear_tarea` y `flujo_marcar_lead` no están ni en el
registro de la API de MaKo ni en `TIPOS_HEREDADOS` (`lib/api-mako/acciones.ts:70-72`), así
que la pendiente resuelve a «operación desconocida» (`:238`). Más: un paso `esperar` corta
la ejecución porque **falta el cron drenador** (`lib/flujos.ts:50`).

O sea: «atar una automatización a una persona» ya está construido, y falla donde nadie miró.

## Tres cosas que la llamada trató como nuevas y ya están pagas

1. **Las etiquetas de WhatsApp** (01:43:16, «sería bueno que el chatbot también maneje las
   etiquetas del propio WhatsApp»). `lib/evolution-labels.ts` corre entero desde el 28/08 y
   `lib/leads.ts` lo llama al mover un lead. **Y la base lo confirma:** `evolution_labels` ya
   sincroniza las etiquetas REALES del celular —23 en el workspace de Leila, con nombres como
   «Respondidos por la IA», «Transferencia de la IA», «Seguimiento», «Nuevo cliente»— y el
   puente `evolution_stage_labels` (`workspace_id`, `etapa`, `label_id`) **existe y está
   vacío**, con el panel que lo configura declarado huérfano (`app/admin/dev/areas.ts:255`).
   Lo único que falta es que poner una etiqueta sea una ACCIÓN del flujo y no sólo un efecto
   de la etapa.
2. **El link con miniatura** (01:43:02). Es la bandera `linkPreview` en el payload de
   `enviarTexto` (`lib/evolution.ts`).
3. **Que MaKo ARME la automatización desde un audio** (00:37:00-00:38:04: «le envías un audio
   al grupo… ni siquiera entrás adentro de MaKo» → «te hago el preset… te doy el link,
   corroborá que está bien»). El audio ya se transcribe (`lib/mako-doer-in.ts:649`) y el área
   `chatbot` de la API ya tiene `crear_secuencia_mensajes`, `editar_pasos_secuencia_mensajes`,
   `guardar_estrategia_secuencia` y `agregar_escenario_secuencia`, las cuatro con canal
   `whatsapp`. Falta el último tramo, no el camino. **Y es la doctrina de la casa tal cual:**
   un canal propone, una persona confirma.

**Y los TAGS no hay que inventarlos.** A 01:39:11 Leila lee su propia taxonomía en pantalla:
**prospecto nuevo · alumno miembro · cliente de marketing · empresa o evento**, con los
contenidos de cada una (01:39:28: «la primera sesión sin costo, la guía del cuello de
botella, los casos de éxito, el inicio, los servicios»). Lo armó sola en Claude (01:38:52) y
hoy lo usa a fuerza de «alguien me puede pedir y yo copio y pego» (01:39:40).

⚠️ **Pero sus piezas no pueden salir literales por este motor.** `lib/plantillas.ts` decide
por diseño que una plantilla **no es un molde literal** y que Claude la reescribe. Contra
«todo me lo estoy haciendo **en mi formato**» (01:41:51), falta un modo literal por paso.
Nunca se habló en la llamada.

## El choque que nadie planteó, y es el que define si le sirve

`lib/flujos.ts` lo dice textual: **«wa_lead → SIEMPRE por confirmación (regla del negocio:
nunca disparar auto al lead)»**. Y `lib/nutricion.ts` manda automático **sólo a quien YA
PAGÓ**. Toda la «masa» de Leila —confirmados sin pagar— cae del lado manual.

**Tal como está, el chatbot le cambia el trabajo (confirmar en vez de escribir), no la
dependencia** — que es exactamente lo que ella pidió que se vaya. Nadie lo planteó en la
llamada y es la decisión más importante del 7/10.

## La cobranza: se decidió del chatbot y terminó en el hueco entre las dos tabs

Leila dictó la secuencia entera (00:32:39): «se acerca tu fecha de pago · hoy es tu
vencimiento · ayer no pagaste · ya pasaron cinco días, ¿cómo estás?», más «hay algo que me
quieras contar» (00:32:58). **Cinco momentos.** Martín la convirtió en disparador en el acto
—«la cuota vencida, eso es una acción también» (00:32:28)— y admitió que no sabía cómo: «son
tantas acciones las de MaKo» (00:33:01).

El veredicto fue «esto no sería tanto de CRM, sino que sería **de chatbot**» (00:47:23,
Leila) y se ablandó en la misma frase a «integra ambos» (00:47:28). **Dos días después la
tarjeta #19 se postergó al 15/12** en `docs/depuracion-crm-03oct.md` con criterio de CRM, y
ese documento **no menciona al chatbot una sola vez**. Hoy no está en ninguna de las dos.

⚠️ **TRAMPA MEDIDA: «la cuota 2 de Vertice venció hace 3 días» (00:30:26) NO es un ejemplo
de Leila.** Es texto del propio MaKo, verbatim en `lib/avisos-catalogo.ts:697` —«💸 *Cobranza*: la
cuota 2 de Vértice venció hace 3 días — *$1.700 sin cobrar*»—, escrito el **30/09**, dos días
antes de la llamada, y leído de la pantalla que Leila estaba compartiendo. «Cuenta Vértice
Industrial» es una cuenta del tablero (`scripts/reordenar-boards-clientes.ts:55`), no de
ella. Y es justo la queja de un minuto antes —«está tomando ejemplos de Mauricio siempre…
que se note que es un ejemplo» (00:29:15)—, **que es de MARTÍN criticando su propia
pantalla**, no de Leila.

⚠️ **Y EL DATO ESTÁ ENVENENADO.** El botón «Registrar mensualidad cobrada» **crea una cuota
IMPAGA** — se leyó en voz alta en la llamada (00:43:24) y es la tarjeta #697. Prender la
cobranza hoy le reclamaría plata por WhatsApp, desde la línea del cliente, a gente que ya
pagó. **#697 va antes de #19**, y las dos se postergaron por separado el 03/10 sin que quede
escrito que una depende de la otra.

Y aunque existiera el disparador, **el mensaje no puede nombrar la cuota**: faltan las cuatro
variables de plata (monto, vencimiento, número de cuota, días de atraso). `aplicarVariables`
sustituye cuatro claves y ninguna es de dinero.

El dato en sí **ya existe y ya se calcula** (`getCuotasPendientes` devuelve vencidas y
por-vencer): lo que falta es el cable.

## Lo que impide que salga un solo mensaje, medido en producción

- **El motor nunca entregó nada.** `nutricion_envios` tiene **12 filas en total, las 12 en
  `fallo`, las 12 del ws1**, la última el 24/09 — con 27 secuencias en el ws1 (15 activas) y
  11 en cada uno de ws9/10/11.
- **Código Inmobiliario no tiene línea.** Su instancia está `desconectado`, con `numero` en
  null y sin un evento desde el 18/08: **cero** filas en `wa_mensajes` (ws1 tiene 16.377 y el
  de Leila 31.576).
- **Los links salen LITERALES al lead.** Nada reemplaza `[tu link de agenda]`, y el prompt
  del generador **le jura al modelo que el sistema lo hace**
  (`lib/nutricion-generator.ts:146`). Su hermano es peor: un corchete que no sea de la lista
  deja el paso congelado para siempre, sin aviso.
- **El anti-ban es el techo de cualquier secuencia**, no un detalle
  (`lib/nutricion.ts:105-115`): 40 mensajes por día y por workspace, 6 por corrida, 20 horas
  entre mensajes al mismo lead, ventana de 9 a 21 de México. Los «dos por semana» de Leila
  entran cómodos; una masa grande, no.
- **El lead magnet no se entrega**, y hoy no hay nada que entregar: el wizard deja elegir uno
  y el motor no tiene una sola referencia a `entregable`. Medido el 17/09: 0 de 62 secuencias
  lo usan, y los 13 Entregables cargados tienen 0 con enlace.

## El mecanismo que falta se pidió y se descartó en la misma llamada

A 00:48:37 se habló del **SLA por etapa y el aviso de lead estancado**: «poner un plazo en
cada etapa de funnel» (00:48:43), «que cada persona pueda configurar un plazo» (00:48:46,
Martín). Es exactamente el mecanismo etapa→disparo que todo el hilo del Chatbot dice que no
existe. Lo cerró Leila: «**Bueno, no es urgente**» (00:48:52), y salió del P1 — es la
tarjeta #800, que la extracción anterior sí registró.

Vale nombrarlo porque **el mismo plazo por etapa es lo que le falta al disparador del
Chatbot**: descartarlo por el CRM no lo descarta para el Chatbot, y hoy no está en ninguno
de los dos.

## El canal: el número nuevo no es «el canal del chatbot»

Es **la voz de MaKo entera** — grupos, avisos y reportes salen por `instanciaVoz()`, hoy
`mako_ws1`, **la línea personal de Martín**. Y el mismo celular que trae el chip nuevo tiene
que alojar el chip VIEJO recuperado para entrar a Meta for Developers (00:40:00), o sea que
**un aparato destraba dos de los cuatro proyectos del 7/10**.

- **El método técnico existe y está escrito**: la tarjeta #172 dice que ya hay canal dedicado
  (`mako_superadmin`) y la función para usarlo como voz, y que falta el chip y escanear el QR
  una vez.
- **Lo que no tiene método es el CURADO** del número fresco: «creo que voy a tener que curar
  un poquito» (00:28:27) → «Sí, tardarás y tardarás». Sin días, sin volumen y sin criterio de
  «ya está curado». Y el repo no tiene ninguna rampa de calentamiento: sólo el presupuesto de
  régimen permanente de arriba.
- **Para probar con Leila se puede saltear**: su número de la academia ya tiene historial y
  **ya está en Meta** (00:03:22, 00:03:37). Pero **vincular varios números no existe** —
  `lib/evolution.ts` es una instancia por workspace, así que vincular el de la academia
  REEMPLAZA el del workspace. (`workspace_telefonos` existe y tiene 0 filas.)
- **Y el grupo de WhatsApp es parte del canal, no decorado**: es la entrada que vende el
  chatbot (00:38:04), y las instancias **ignoran grupos por defecto** por regla anti-ban.

## Correcciones de atribución (el transcript tiene los hablantes cruzados)

Varias líneas decisivas figuran como Leila **y son de Martín**: la que define el alcance
(01:37:00), la intención de diseño (00:27:05 y 00:28:47), «no sé muy bien cómo hacerlo»
(00:33:01) y «vincular varios números» (00:03:41, que además es él dictándole una tarea al
grabador). Y hay un bloque duplicado: 01:39:02-01:39:54 se repite en 01:40:02-01:40:54.

⚠️ **Y [00:27:14] no es un reporte de bug: es la app leída en voz alta.** «quedó guardado
pero no entró al grupo / WhatsApp no deja agregarlo directo / tampoco pude mandarle la
invitación» son, palabra por palabra, tres strings del repo (`DestinatariosCanal.tsx:113`,
`lib/mako-grupo.ts:316` y `:393`). Lo que sí falló de verdad es la **invitación**: cayó en la
rama «tampoco pude», y `enviarInvitacionGrupo` devuelve sólo el status de Evolution, así que
la causa **no quedó determinada**.

## La promesa con fecha

> «lo del chatbot ya dentro de poquito, bueno, **dentro de seis días**… ya vas a poder
> aprovecharlo también» — Martín, 01:42:01 y 01:42:10

El 7/10 no es una fecha interna: es **la primera usuaria externa del chatbot**, con una
promesa dicha en voz alta.

## Las cuatro decisiones que son de Martín

1. **¿Un lead que confirmó y no pagó puede recibir un mensaje sin que nadie apriete un
   botón?** Hoy el código dice NO, en dos lugares y por decisión escrita. El pedido de Leila
   exige que sí. **Sin esto, el chatbot no le resuelve lo que ella pidió.**
2. **¿La cobranza es del chatbot o del CRM?** Se decidió «chatbot», se ablandó a «ambos», y
   terminó postergada al 15/12 por el CRM. Hoy no está en ninguna de las dos.
3. **¿Qué es un «tag»: un campo nuevo de MaKo (00:34:18) o la etiqueta nativa de WhatsApp
   (01:43:16)?** Las dos cosas se pidieron con la misma palabra en la misma llamada y la
   diferencia es de un orden de magnitud: la etiqueta nativa **ya está sincronizada en la
   base**, y un campo propio es migración + escritura + lectura + rama nueva en
   `leadsDeCohorte` + catálogo de UI. Y la taxonomía de Leila ya está dictada, así que en
   los dos casos el contenido existe.
4. **Los links: ¿catálogo de links del negocio, o se saca el `[tu link …]` de los prompts?**
   Mientras no se decida, **toda secuencia que mande un link sale rota**.

## Lo que haría primero, por tamaño

1. **Las cuatro variables de plata y sacar el `[tu link …]`.** Es el trabajo más chico de la
   lista y el que convierte todo el resto en algo que se puede mandar.
2. **#697 (la cuota impaga) antes de cualquier cobranza.** Es la única pieza que, prendida
   mal, le cobra a quien ya pagó.
3. **Atar una secuencia a UNA persona**: una función y un botón. Es la pieza exacta que la
   llamada pidió, y la más chica de todas.
4. **Enchufar los cuatro `flujo_*` al registro, más el cron drenador del `esperar`.** Con eso
   el motor que ya tiene la forma correcta empieza a ejecutar.
5. **Montar el panel de etiquetas** —el backend ya corre— y llenar `evolution_stage_labels`.
6. **Que un paso de mensaje pueda llevar un adjunto.** Hoy es `{ canal, texto }` y el
   transporte ya sabe mandar media: es la pata que convierte «lo que sea» (00:34:41) en algo
   que se puede cumplir.

## Lo que quedó SIN medir

- **Para qué sirven las etiquetas de WhatsApp.** El pedido entró a 1h43 con la priorización
  cerrada y la única respuesta fue «Está bueno» y «Entonces es mucho más sencillo»
  (01:43:33). Más sencillo **para qué** no se dijo nunca.
- **La cadencia de cinco toques de la cobranza no está diseñada, sólo dictada.** Falta
  decidir si es una secuencia de nutrición o cinco avisos.
- **Qué pasa con el historial de WhatsApp al escanear un número nuevo.** El repo ya pagó que
  la agenda de un teléfono pisara los nombres de 1.438 contactos de un cliente (11/09).
- **Riesgo de ban, tope de envío o bloqueo: no se nombró ni una vez en 1h44.** Cero
  apariciones de bloqueo, spam, baneo, masivo o difusión en las 1.001 intervenciones. El
  transporte del canal nunca se discutió, y por eso «curar el número» quedó flotando sin
  conectarse con cómo manda la app de verdad.

*Extraído el 04/10/2026 · 5 lectores sobre el transcript completo (recording 188898333) con
panel de verificación · el estado de producción medido contra la base con
`scripts/probe-chatbot-estado.ts` y `scripts/probe-chatbot-canal.ts`.*
