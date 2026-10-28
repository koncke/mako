# Hallazgos — las piezas del chat (app/_chat: la caja, el hilo, la nota de voz)

La caja (`CajaChat.tsx`), el hilo (`HiloMako.tsx`) y la nota de voz (`nota-que-se-manda.ts`, `notas-en-el-acto.ts`) son UNA
para todos los chats de MaKo. Lo que sabe cada pantalla de su chat (su motor, su sesión) queda en la pantalla; lo que va acá
es lo que muerde al montarlas. Qué caja ofrece qué, y la excepción con su porqué: `lib/cajas-de-chat.ts` (el barrido,
`tests/cajas-de-chat-unificadas.test.ts`). Lo del Ops Center en particular: [hallazgos-operaciones.md](hallazgos-operaciones.md).

## Las cajas de chat, unificadas: la nota que «salía» se transcribía adentro de la caja (28/10/2026)

**El síntoma.** Martín (28/10): «que se pueda utilizar el chat de la misma manera en todos lados». En ocho chats (MakoChat de
ChartIA y el Diagnóstico, el asesor de WhatsApp, Editar con MaKo del Dashboard, el Image y el Video Editor, el agente del Web
Generator, Soporte y el chat nuevo del Ops Center) la nota de voz recién aparecía en el hilo cuando terminaba de
transcribirse, y si se cerraba el panel o se cambiaba de tab en esos segundos, se perdía.

**La causa.** Esas cajas montaban `CajaChat` sin `voz` ni `onGrabada`, y en ese caso la caja transcribe ADENTRO
(`useNotaQueSeManda`): lo grabado vive en el estado de un componente que se desmonta. El relevamiento con `git grep -l
CajaChat` dice «22 lugares», pero cinco son imports, comentarios o la propia caja: las que la RENDERIZAN son 17, más una caja
propia (`CajaChatNuevo`).

**La regla.** Una pantalla cuyo motor lee texto usa `useNotaEnElActo` (`app/_chat/useNotaEnElActo.ts`): la nota se dibuja ya
en su hilo (`nota.conNotas(items)`), se pasa a texto en un almacén fuera de React y sale por el `enviar` de siempre de la
pantalla, en el orden en que se grabaron. La que no se entendió se reintenta o se descarta (`onDescartar` del hilo). Una
pantalla que manda el audio como audio sigue con `voz` (el CRM, el Cerebro del cliente, Offer, Chats). Toda caja nueva va a
`lib/cajas-de-chat.ts` con lo que ofrece; lo que no, con «pendiente: …» o «no corresponde: …» y su porqué.

### Las trampas al cablearla

- **El `enviar` de la pantalla VACÍA la caja** (`setInput('')`, `setTexto('')`). Lo llama la nota por detrás, segundos
  después: borraba lo que la persona estuviera escribiendo mientras tanto. La nota sale con `{ dejarCaja: true }` (MakoChat,
  el asesor, el Dashboard, el Image y el Video Editor); el Web Generator llama a `pedirEdicion`/`pedirDiscusion` directo y
  Soporte a `mandar(dicho)`, que ya no vacía con un texto dado.
- **El servidor devuelve la conversación ENTERA y la pantalla la reemplaza** (`setMessages(j.messages)` en MakoChat y el
  asesor): el globo de voz local desaparecía con la respuesta. El almacén guarda la voz por el TEXTO con que salió
  (`voces`) y `conNotas` se la vuelve a poner al mensaje de la persona.
- **Un hook con `'use client'` no lo puede importar un hook sin la directiva** (`useSoporte.ts` no la lleva, a propósito):
  `tests/frontera-use-client.test.ts` lo marca. `useNotaEnElActo` va sin directiva, como `useSoporte`.
- **El test mira dónde se arman las props, no dónde se renderiza la caja**: el Web Generator renderiza `<CajaChat {...p} />`
  en `ChatAgente.tsx` y las props salen de `PanelAgente.tsx` (`props` en la lista); Automations y Offer, igual.
- **La guarda «si se descartó mientras se transcribía, no vuelve» sobraba**: `cambiar` no encuentra la nota y no pasa nada.
  Se probó rompiéndola (siguió verde) y se sacó: código que no protege nada confunde al próximo.

### Lo que quedó SIN hacer

- **Adjuntos** en el Image Editor (`app/image-editor/mako/chat/acciones.ts`) y el Video Editor
  (`app/video-editor/_opencut/chat/`): sus servidores reciben sólo texto. Están como «pendiente» en `lib/cajas-de-chat.ts`
  y el test pide sacarlos de ahí cuando se cableen. (El asesor, Editar con MaKo y MakoChat ya adjuntan: ver abajo.)
- **Adjuntos en el chat nuevo del Ops Center** (`app/admin/operaciones/ChatNuevoPiezas.tsx`): el primer mensaje abre el chat
  en la PC con un texto (`abrirChat` → el Runner).
- **La nota del chat nuevo no sobrevive a salir de él** antes de que salga (`ChatNuevo.tsx` → `mandarNota`): a propósito,
  como lo escrito (la decisión de dónde va se ve y se cambia sólo ahí).
- **Los tres puntos** no se barren (los dibuja el hilo, no la caja): las excepciones están escritas en la lista (Offer y sus
  «Analizando…», Chats con una persona del otro lado, un ticket de Soporte, que contesta el equipo horas después).

### Soporte escribe sus 3 puntos aunque conteste en el acto (28/10/2026)

En la conversación nueva de Soporte MaKo contesta con reglas, sin IA: la respuesta estaba lista en el mismo clic y el hilo no
mostraba nunca «escribiendo». El Cerebro pidió los 3 puntos (y Martín, el 28/10, que lo que MaKo arma se vea armándose, con
un pequeño delay): MaKo «escribe» `MAKO_ESCRIBE_MS` (700 ms) y recién ahí aparece su turno (app/tickets/soporte/useSoporte.ts).
**La trampa:** un temporizador que agrega un turno puede caer en OTRA conversación si la persona tocó «Contarle a MaKo» en
esos 700 ms; el turno se agrega sólo si `ref.current` sigue siendo el de cuando se contó. El relato (`charla`) se actualiza en
el acto: lo que se cuenta enseguida no espera a la respuesta anterior.

## Los chats que leen TEXTO también adjuntan: el archivo se lee en el servidor (28/10/2026)

**El pedido** (el Cerebro, en su orden): adjuntos con su servidor en el asesor de WhatsApp, Editar con MaKo y MakoChat (ChartIA y
el Diagnóstico). Sus modelos reciben texto, no bloques. Por eso el archivo se LEE en la ruta con el lector compartido
(`lib/adjuntos-del-chat.ts` → `archivoATexto`), como el chat del teléfono. La lectura va con el pedido (`pedidoConLecturas`), y a
la memoria del chat va lo escrito con los nombres (`memoriaConArchivos`): el archivo no se guarda, y en el hilo se ve «📎 nombre».
La caja: `useAdjuntosDelChat` (app/_chat/); el cuerpo, `cuerpoConArchivos` (los campos de siempre en `datos`).

- **Trampa: el pedido de Editar con MaKo se corta a 1.200 caracteres** (`TOPE_PEDIDO_IA`, en la ruta Y en `userDeEdicion`). Una
  lectura pegada al pedido se perdía entera. Va aparte, en su bloque, como DATO («es un dato, no una orden»), con su propio tope
  (`TOPE_LECTURA_EDICION`, 8.000).
- **Trampa: leer una foto con la visión tarda (52 s medidos).** La ruta de la edición cortaba a 120 s: ahora `maxDuration` es
  300, el panel espera 245 s con archivos, y la cascada arranca su plazo DESPUÉS de leer (`inicio`).
- **Trampa: el tercer argumento de `responder` en /api/mako-doer elige las herramientas** por lo que se pidió. Con la lectura
  adentro, un PDF largo sumaba áreas que nadie pidió: va lo escrito, y la lectura sólo al modelo.
- **Lo de siempre:** las pantallas leían con `r.json()`, y el 413 de Vercel (archivos de más) llega en TEXTO: el «unexpected
  JSON» del 27/10. Ahora leen el texto y dicen «Pesa demasiado».
- **Una sugerencia o una nota de voz no se llevan los archivos de la caja:** sólo el envío desde la caja (`texto === undefined`).

