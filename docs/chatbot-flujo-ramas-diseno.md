# /chatbot como flujo con ramas — diseño y contrato (08/10/2026)

El pedido de Martín (literal, 08/10/2026) está al final. Este documento es el CONTRATO entre las
cinco partes que lo construyen en paralelo y la referencia para quien toque /chatbot después.

## 1. El modelo (ya escrito, con tests: `lib/flujo-grafo.ts` y `lib/flujo-legado.ts`)

- **El dato sigue siendo `nutricion_secuencias.pasos`**: cada elemento es un NODO. Campos nuevos,
  todos opcionales: `id` (estable), `siguiente` (ausente = el elemento siguiente del array; null =
  termina), `nodo` (`esperar | condicion | respuesta | ir_a`; ausente = mensaje o acción, como
  siempre), `espera`, `ramas`, `casos`, `si_no`, `destino`, `revisar`, `media_id`, y
  `tipo: 'media'`.
- **Dos raíces**:
  - la SALIDA arranca en la tarjeta CRON (el disparador; NO es un nodo de `pasos`) y sigue por
    `raizSalida(pasos)`;
  - **«Si responde»** es el nodo `respuesta` (uno solo). Sus `casos` son las ramas (lo que antes
    eran `estrategia.escenarios`) y `si_no` es «Otra cosa» (lo que antes era el hand-off).
- **Una respuesta del lead PAUSA la salida** (igual que hoy, `pausarPorRespuesta`) y corre
  «Si responde». Por eso las condiciones de la salida no tienen «respondió»: mientras la salida
  corre, el lead no respondió. Las condiciones son:
  - etiqueta, etapa (+ producto), agendó, pagó;
  - ya le escribiste, te escribió alguna vez;
  - llegó hace menos de N h;
  - tiene WhatsApp, tiene email.
- **Árbol con saltos**. Cada nodo tiene UN padre y sus salidas son puertos al borde derecho, una
  fila por rama (como ManyChat). Para juntar ramas está `ir_a {nodo}`. `validarGrafo` rechaza:
  - dos padres;
  - destinos que no existen;
  - esperas dentro de «Si responde»;
  - un salto hacia atrás sin una espera en el medio;
  - tarjetas sueltas;
  - pasarse de los topes (60 nodos, 8 ramas, 6 filas, 30 casos).
- **`legadoAGrafo`** pasa una secuencia de antes a tarjetas explícitas y devuelve la LIMPIEZA de
  la estrategia (`LIMPIEZA`: `antiguedad_max_horas: null`, un desenlace inerte, `escenarios: []` y
  `modo: 'automatico'`), para que el motor viejo no repita lo que ahora hacen las tarjetas:
  - `delay_horas` → esperar;
  - `ancla` → «N antes de la reunión»;
  - `requiere` → condición, o «Si responde»;
  - «Solo a leads recientes» → la primera condición;
  - «Sale sola» → `revisar` en cada mensaje;
  - «Termina si agenda/paga» → una condición antes de cada mensaje y otra al final del reloj;
  - el fallo por silencio → esperar + acción;
  - los casos → ramas de «Si responde»;
  - el hand-off → «Otra cosa» con la acción `avisar_al_equipo`.

  Probado contra la forma de #198, #212/#213 y #210. **Estos dos archivos son de SÓLO LECTURA
  para las partes.** Si algo falta, se dice en el reporte; no se edita.

## 2. El motor (parte M)

- **Nodo actual.** Se busca por `nodo_actual` (columna nueva). Si no hay o no existe, se usa
  `pasos[paso_actual]`. Siempre se escriben los dos; `paso_actual` = el índice del nodo en el
  array, que lo siguen leyendo las estadísticas y el residuo.
- **Antes de las guardas se resuelven los nodos de control.** Se resuelven, se escribe el
  resultado y se sigue:
  - la condición, con `elegirSalida` y los hechos del lead, leídos en batch;
  - la espera, que programa `proximo_envio_at` y avanza a su `siguiente`;
  - `ir_a`: a otra automatización, inscribe y termina; a un nodo, salta. Tope de 20 saltos por
    corrida.
- **Después de un mensaje o una acción** se avanza a `siguienteDe`. Si lo que sigue ya toca, se
  vuelve a la cola en la MISMA corrida (`otraVuelta`, como ya hace la acción).
- **Lo de antes sigue funcionando en cualquier nodo**: `delay_horas`, `ancla`, `requiere` y
  `desenlace`. Las secuencias convertidas ya no los tienen.
- **«Sale sola» pasa al nodo.** `revisar === true` → borrador; `false` → sale; ausente →
  `!sec.envio_automatico`.
- **Respuesta.** Si la secuencia tiene nodo `respuesta`, el modo asistido se reemplaza por
  `responderConGrafo`, que usa el MISMO clasificador (`clasificarEscenario` con
  `escenariosDeRespuesta`) y el mismo redactor (`responderSimulador`). Recorre la rama elegida:
  - «MaKo contesta» (`tipo: 'ia'`) usa como guía su `cuerpo` y respeta `puedeContestarSolo`;
  - texto, audio y archivo salen sin el anti-ban de 20 h, porque son una respuesta;
  - las acciones corren;
  - las condiciones se evalúan;
  - `ir_a {nodo}` retoma la salida en ese nodo.

  Sin congelar la inscripción en 'handoff'. La ventana de la charla (7 días) y la continuidad
  (`seguirCharla`) se conservan, con la misma tarjeta.
- **Archivos.** `tipo: 'media'` se manda con `enviarMediaYEspejar`, que trae imagen, video o
  documento según el mime y lleva el caption. El borrador con media guarda la referencia: un
  audio o un archivo aprobado sale como lo que es, no como texto.
- **Disparador por etiqueta**: `trigger_tipo 'etiqueta_puesta'` + `nutricion_secuencias.etiqueta_id`.
  Entra con `enrolarPorEvento(leadId, 'etiqueta', { etiquetaId })`, filtrado por etiqueta como el
  de etapa. Para el barrido y el CRON va en `cohorteDeTrigger`/`leadsDeCohorte`.
- **`aTiempo` al inscribir**: `antiguedad_max_horas ?? antiguedadDeEntrada(pasos)`.

## 3. Contratos entre partes

| Qué | Lo escribe | Lo usa |
|---|---|---|
| `lib/flujo-grafo.ts`, `lib/flujo-legado.ts` (sólo lectura) | base | todas |
| `PasoSecuenciaDto & CamposDelFlujo` (app/chatbot/ChatAgentApp.tsx) | base | L, C, P |
| `SecuenciaPerfil` props `onProbar`, `onCambioLocal(EdicionLocal)`, `insetDer` | base (tipo) / **L** (implementa) | P |
| `ChatHilo` prop `animarNuevos` | base (tipo) / **C** | P |
| `EditorMensajeWhatsApp` (props en el archivo) | base (esqueleto) / **C** | L, P |
| `BurbujaHilo` (props en el archivo) | base (esqueleto) / **C** | L, P |
| `lib/setting-adjuntos.ts` `getAdjunto`, `adjuntoBase64` | base (esqueleto) / **C** | M, P |
| POST `/api/chat-agent/secuencias` `{action:'trigger', id, trigger_tipo, etapa?, producto_id?, funnel_id?, etiqueta_id?}` | **M** | L |
| PATCH `/api/whatsapp/secuencias` acepta los campos del flujo (pasa por `setSecuenciaPasos`, que normaliza y valida con `validarGrafo`; rechaza con 400 y el primer error) | **M** | L |
| GET `/api/crm/etiquetas` → `{ etiquetas: [{id, nombre, color, funnel_id, etapa_key, archivada_at}] }`; POST `{action:'crear', nombre, color?}` → `{ etiqueta }` | **E** | L |
| operación `avisar_al_equipo` `{ leadId?: number, titulo?: string, mensaje: string }` (área chatbot, gratis, reversible: sí; avisa al grupo del dueño con `emitirAviso`, `ws` explícito, dedup por lead 12 h) | **M** | conversor, lienzo |
| operaciones `listar_etiquetas`, `etiquetas_lead`, `crear_etiqueta`, `editar_etiqueta`, `archivar_etiqueta`, `poner_etiqueta_lead`, `sacar_etiqueta_lead` (área crm; `leadId` + `etiquetaId`; `yaEstaba` cuando ya la tenía o ya no la tenía) | **E** | ⚡ Acción |
| `crm_etiquetas`, `crm_lead_etiquetas` (mig 0224) | **E** | M (condición y cohorte) |
| columnas `nutricion_inscripciones.nodo_actual text`, `nutricion_envios.nodo_id text`, `nutricion_secuencias.etiqueta_id bigint`, `wa_borradores.audio_id/adjunto_id` (mig 0223) | **M** | — |
| `setting_adjuntos` (mig 0225) | **C** | M, P |

### Lo que avisaron las otras sesiones (08/10/2026)

- **API de MaKo** (estilo GitHub, sin pushear todavía):
  - `lib/api-mako/rest.ts` tiene una ruta REST por cada operación que sale por `http`, y
    `tests/api-mako-rest.test.ts` falla si alguna no la tiene. Las de las etiquetas y la del
    aviso las suma quien pushee segundo:
    - `GET /crm/etiquetas`;
    - `POST /crm/etiquetas`;
    - `PATCH /crm/etiquetas/{etiquetaId}`;
    - `PUT /crm/etiquetas/{etiquetaId}/archivado`;
    - `GET /crm/leads/{leadId}/etiquetas`;
    - `PUT` y `DELETE /crm/leads/{leadId}/etiquetas/{etiquetaId}`;
    - `POST /chatbot/avisos-equipo`.

    Los parámetros se llaman `leadId` y `etiquetaId`.
  - Con un token de escritura, una acción corre EN EL ACTO (`aplicarEnElActo`). Por eso
    poner o sacar una etiqueta tiene que contestar `yaEstaba` cuando no cambia nada.
- **CRM**:
  - la ficha del lead (`app/crm/LeadSheet.tsx`) se relee después de cada escritura. Si un
    componente de `app/crm/lead-view/` guarda algo, usa `useRefrescarFicha()`
    (`app/crm/lead-view/ficha-cambio.tsx`), nunca `router.refresh()` suelto: lo fija
    `tests/ficha-se-relee.test.ts`;
  - `moverEtapaEnProducto` ya tiene un gancho «al ganar»: el de las etiquetas va al lado.

Las migraciones van de la 0223 a la 0225: Customer Success reservó de la 0216 a la 0222 para su tanda del curso.

## 4. Quién es dueño de qué (nadie toca un archivo de otra parte)

- **M — motor y servidor**:
  - código: lib/nutricion.ts, lib/nutricion-desenlace.ts, lib/setting-secuencias.ts,
    lib/chat-agent-handoff.ts, lib/evolution-envio.ts, lib/nutricion-generator.ts (COHORTE_GLOSS),
    lib/setting-estrategia.ts, lib/nutricion-*.ts;
  - API: app/api/chat-agent/secuencias/route.ts, app/api/whatsapp/secuencias/route.ts,
    lib/api-mako/areas/chatbot.def.ts y .run.ts y sus helpers;
  - mig 0223 y scripts/migrar-secuencias-a-grafo.mts;
  - tests de todo eso.
- **E — etiquetas**:
  - datos: mig 0224, lib/etiquetas.ts, lib/workspace.ts (TENANT_TABLES), lib/tablas-de-inquilino.ts,
    lib/clonar-config.ts;
  - API: lib/api-mako/areas/crm.def.ts y .run.ts, app/api/crm/etiquetas/route.ts;
  - ganchos y sincronización: lib/leads.ts y lib/lead-funnel.ts (sólo los ganchos de etapa),
    lib/evolution.ts (sólo las etiquetas), lib/evolution-labels.ts, lib/chatwoot.ts (sólo las
    etiquetas), lib/email-marketing.ts (TRIGGERS y segmentos);
  - pantallas: app/_components/EditorAccionMako.tsx (selector de etiqueta), la pantalla del CRUD y
    las fichas del CRM;
  - tests.
- **C — composer**:
  - componentes: app/whatsapp/_shared/ComposerWhatsApp.tsx (nuevo), BurbujaHilo.tsx,
    ChatHilo.tsx, VoiceRecorder.tsx, app/whatsapp/EmojiPicker.tsx, app/whatsapp/EmpresaInbox.tsx,
    app/chatbot/EditorMensajeWhatsApp.tsx;
  - biblioteca: mig 0225, lib/setting-adjuntos.ts, app/api/chat-agent/adjuntos/route.ts,
    lib/datos-mau.ts (remap de `media_id`);
  - tests.
- **L — lienzo**:
  - lib/lienzo-grafo.ts, lib/flujo-conversacion.ts, app/_components/Lienzo.tsx (compartido con
    /mensajes: todo lo nuevo es opcional), app/_components/EditorCron.tsx;
  - app/chatbot/FlujoLienzo.tsx, app/chatbot/SecuenciaPerfil.tsx;
  - tests.
- **P — página y «Probar»**:
  - pantalla: app/chatbot/ChatAgentApp.tsx (menos el tipo del DTO), SimuladorWhatsApp.tsx,
    PanelProbar.tsx (nuevo), RecordatorioFlujo.tsx (nuevo), HandoffsPanel.tsx y
    RecordatorioReunion.tsx (se borran);
  - simulación y prueba real: lib/simulador-grafo.ts (nuevo), lib/prueba-paso.ts (nuevo),
    app/api/chat-agent/simulador/route.ts;
  - tests (incluido tests/recordatorio-lead.test.ts:440-452).

Los tests que leen archivos de VARIAS partes se tocan sólo en las aserciones del archivo propio.

## 5. Decisiones que tomé yo (Martín las puede dar vuelta)

- **Las etiquetas vinculadas a una etapa son un ESPEJO en las dos direcciones**: entrar a la
  etapa pone la etiqueta, salir la saca, y poner la etiqueta mueve a la etapa. El bucle se corta
  por idempotencia.
- **Sincronizar etiquetas a WhatsApp no oficial** es poner o sacar una etiqueta QUE YA EXISTE en
  el celular: Evolution 2.3.7 no expone crearlas. En el CRUD se elige a cuál del celular
  corresponde.
- **Chatwoot** (oficial): se crea y se asigna, porque su API lo permite.
- **Email: no hay plataforma a la que sincronizar.** Resend es una cuenta compartida de MaKo y
  ningún lado lee sus segmentos. Las etiquetas sirven en email como segmento de un envío masivo y
  como disparador o condición de las secuencias de email.
- **Una acción en LOTE no dispara automatizaciones**, y la misma (etiqueta, lead) se espacia
  30 s, como ManyChat.
- **Las esperas se ofrecen en horas y días**: el motor corre una vez por hora. Los minutos
  quedan en el dato para el recordatorio.
- **El recordatorio de la reunión** se dibuja como una automatización más de la lista, con sus
  tarjetas. Lo sigue mandando su emisor de siempre (cada 10 min, con sus marcas): pasarlo al
  motor horario rompía el de 15 min y podía duplicar envíos.
- **«Probar»**:
  - es un panel acoplado a la derecha, con ✕ Cerrar y ↻;
  - recorre el flujo LOCAL sin publicar, y en una condición pregunta por qué rama seguir;
  - «Enviar a mi WhatsApp» manda de verdad cada mensaje que aparece al número que se escribe
    ahí, que viene precargado con el del negocio.

---

## El pedido, literal (Martín, 08/10/2026)

> Por favor, soluciona la UX/UI de chatbot... Mucho texto por todos lados, muchos botones... No se entiende nada...
> 1. Elimina completamente lo de arriba ese form que ocupa toda la pantalla, eso debería configurarse en las tarjetas en todo caso...
> 2. No entiendo por qué está el "Recordatorio de la reunión" cuando eso debe configurarse en las tarjetas!!!
> 3. En la sidebar de chatbor, en las automatizaciones existentes, elimina el subtitulo, solo el título. Y procura que se vea todo, con un máximo de caracteres para los títulos...
> 4. En el CRON sigue diciendo "Se dispara" como título, cuando muchas veces dijimos que debe ser CRON.
> 5. Pon mucho menos títulos dentro del editable, todo debe entenderse por su propia cuenta... Elimina los títulos de Cuando y Que... Deja solo la flecha, sin aclarar nada. No pongas un botón de "Cambiar a etapa", eso debe ser un desplegable para seleccionar las acciones que pueden disparar esa automatización... Ya habiamos hecho un desplegable así.
> 6. No entiendo "Solo a leads recientes" dentro del CRON, cuando justamente habiamos configurado una tarjeta de CONDICIONAL... Y mucho menos se entiende el checkbox de "Sale sola"... Las tarjetas de condicional y Delay ya no existen... No se por qué las quitaste.
> 7. Por defecto entre el CRON la siguiente tarjeta ponés siempre un delay, cuando no debe ser así... Eso lo debe configurar el usuario. Y lo peor es que no se puede hacer nada con ese delay, no de puede editar, quitar, nada...
> 8. El editable del audio también está horrible, todos los botones amontonados... Te pedí que todo lo que tenga que ver con WhatsApp tenga un mismo editable, ya sea audio, texto, archivos, lo que sea... Que sea un editable con la interfaz tipo WhatsApp que ya creamos, como lo que te adjunto... Que se grabe audio desde el costado, que se pueda adjuntar archivos, emojis etc... Copialo tal cual... Obvio que hay que agregarle tal vez otras funciones, pero haz bien el diseño.
> 9. Yo debería poder crear CONDICIONALES, justamente... A raíz de cada condicional, debería poder crear tarjetas arriba y abajo, no solo a la derecha, hoy en día no es un flujo, es solamente una secuencia lineal, no puedo realmente automatizarlo condicionalmente. Ya te había pedido que revises como lo hace Manychat, copiemos de allí.
> 10. El botón de probar se rompe, aparece detrás de la sidebar y se ve horrible. No tiene la animación de entrada de los mensajes y tampoco puedo interactuar, para probarlo de verdad... Y tampoco veo la opción de probarlo realmente, con el número o email del usuario... Y para cerrar, un botón de CERRAR, no un "editar"... Y no hace falta que ocupe toda la pantalla. Mira como lo hace Manychat... Y el botón de probar deberóa estar a la derecha del todo, no pegado a "Activar".
> 11. Elimina lo de "Termina si agenda", esa tarjeta no se entiende... Esa tarjeta debería ser la misma tarjeta de condicional... Es simple, en ese caso el CONDICIONAL es por si responde X cosa para algo, y de lo contrario pasa otra cosa... Piensa bien la lógica de los condicionales, porque podrían haber multiples condiciones.
> 12. Deberías agregar todo un sistema de ETIQUETAS... Porque justamente eso servirá y terminará de tener sentido en los condicionales... Por ejemplo, si no respondió, se le pone la etiqueta de seguimiento. Si respondió y está cualificado, se le pone la etiqueta de "Cualificado"... Pero esas etiquetas debería poder editarse, como un CRUD, que el usuario elija que nombres ponerles y si están vinculadas a etapas del CRM. Y claro, debería también poder salir acciones y CRON desde etiquetas... Sería bueno que también, como los usuarios conectan sus WhatsApp y Email, esas mismas etiquetas que se asignan en MaKo, se pongan en esas ambas plataformas.


---

# SEGUNDA TANDA (08/10/2026, noche): un solo CRON, flechas en paralelo, editores anchos, Gmail, etiqueta, acciones e IA

El pedido literal está al final de esta sección. Los relevos que la sostienen (sólo lectura, con
mediciones contra producción del 08/10/2026) quedaron en el scratchpad de la sesión: R1 auditoría
de ManyChat, R2 las secuencias de Mauricio y de Código Inmobiliario, R3 el mapa de la pantalla,
R4 el diseño del motor en paralelo, R5 crear con IA. Lo que importa de cada uno está acá.

## Lo medido que manda (08/10/2026)

- **0 inscripciones activas** en toda la base; 6 secuencias sin archivar, todas ya en tarjetas
  (#198, #212, #213 prendidas; #220, #209, #210 apagadas). Las migraciones 0223-0225 ESTÁN
  aplicadas (lo que dice «Estado de producción al cerrar» en hallazgos-chatbot.md es de antes).
- **Nunca salió un email por nutrición** (0 filas con canal email en `nutricion_envios`).
- **El freno anti-ban de 20 h y los topes (40/día, 6/corrida) cuentan TODOS los canales**, y el
  freno se calcula UNA vez por lote: WhatsApp y email «en paralelo» saldrían a un toque cada 20 h,
  y dos hilos de WhatsApp del mismo lead saldrían en la misma vuelta.
- **La ventana 9-21 está fija en hora de México** (`TZ_OFFSET_MX`): a Código Inmobiliario
  (Buenos Aires) le saldría corrida.
- **El ＋ del lienzo no puede crear un email** y el editor de email no tiene preheader.
- `crm_etiquetas`: 0 filas en todos los workspaces.
- **Lo no publicado se pierde sin aviso** al cambiar de automatización (`key={sel.id}`).

## Decisiones (mías; Martín las puede dar vuelta)

1. **Un solo CRON.** «Si responde» se dibuja COLGANDO del CRON, como la segunda fila de su
   tarjeta: «Al entrar» y «Si responde». Sigue escuchando desde que el lead entra y una respuesta
   sigue pausando TODA la salida. No es una flecha más de «Al entrar»: es un evento, no un camino
   en el tiempo. Desaparece la tarjeta fantasma. Regla nueva: «Si responde» no tiene padre.
2. **Varias flechas = hilos en paralelo.** Campo `paralelos?: string[]` en un mensaje, una acción
   o una espera: los ids que arrancan A LA VEZ cuando esa tarjeta termina. El CRON los lleva en un
   nodo `inicio` con el id reservado `'entrada'` (el mismo `ID_ENTRADA` del lienzo), que se crea
   SÓLO con la primera flecha en paralelo desde el CRON y va al FINAL del array. Una condición,
   «Si responde» y un «Ir a» no tienen paralelos (sus ramas se excluyen entre sí o terminan).
   Topes: 3 flechas en paralelo por tarjeta, 6 hilos por inscripción.
3. **El motor lleva los hilos en UNA inscripción** (`hilos jsonb` + `hilos_rev int`, mig 0228).
   NULL = un cursor, como hoy: los 6 flujos vigentes nunca entran al modo hilos. Se descartó una
   fila por hilo (rompe 12 lectores que cuentan «una fila = un lead en una secuencia») y una tabla
   hija (dos tablas coherentes sin transacciones).
4. **Una respuesta pausa todos los hilos** (como hoy). Un «Ir a {tarjeta}» desde «Si responde»
   retoma UN hilo en esa tarjeta y descarta los congelados.
5. **El freno anti-ban y los topes son POR CANAL.** Los 20 h, los 40 por día y los 6 por corrida
   miran sólo WhatsApp. El email tiene su propio freno por lead (20 h) y su propio tope diario. Y
   el freno se actualiza en memoria después de cada envío de la corrida.
6. **La ventana 9-21 va en la zona del workspace** (`mako.timezone`); sin zona, Ciudad de México
   (lo de hoy).
7. **En modo hilos, lo terminal de un email cierra SÓLO su hilo**: sin email, dado de baja,
   remitente sandbox, o el email apagado sin nada prendido adelante (si hay otros hilos vivos).
   Un email que no puede salir no mata el WhatsApp.
8. **La etiqueta es una tarjeta de PRESENTACIÓN** sobre la ⚡ Acción `poner_etiqueta_lead` /
   `sacar_etiqueta_lead`: el motor no cambia. Se dibuja como «🏷️ + Cualificado» con el color de
   la etiqueta y se edita con una frase: «[Poner ▾] [etiqueta ▾]».
9. **Dos familias de tarjetas.** Contenido (CRON, mensaje, email, acción): la tarjeta blanca.
   Control (condición, esperar, etiqueta, ir a): compactas y teñidas; la espera es una píldora.
   El CRON deja de compartir el ⚡ con la Acción. Sólo tokens que se redefinen en oscuro.
10. **Los editores son apaisados** en /chatbot (`panelForma='apaisado'`, alto FIJO): el de
    WhatsApp en dos columnas (el chat a la izquierda, el composer a la derecha). En ventanas
    angostas vuelve a columna.
11. **«Probar» es ancho y bajo**, arriba a la derecha. El editor ocupa la franja de abajo. Dónde
    va cada uno lo decide UNA función pura (`muelles`), no tres componentes.
12. **Email tipo Gmail** (`EditorEmailGmail`): De (sólo lectura, el remitente del workspace, con
    aviso si es sandbox o el envío está apagado), Para «El lead», Asunto, Vista previa
    (preheader), cuerpo con B/I/S y datos, y a la derecha el mail abierto con el MISMO render que
    sale (`renderEmailHtml`). Sin HTML ni imágenes: el envío escapa el HTML. /email no cambia.
13. **El selector de acciones va por secciones** (el patrón del Plan, `Dropdown secciones`) con
    buscador que aplana: «Más usadas», «Con este lead», una por área, y «Avanzado» al final con
    las que piden JSON. El editor muestra la acción con una línea de qué hace, lo obligatorio
    arriba y lo opcional plegado. No se muestra lo que llena el flujo (`respuesta` del aviso, el
    lead del evento).
14. **Crear con IA**: «＋ Nueva» crea una automatización vacía y PAUSADA y abre el lienzo con la
    caja del pedido. Gemini por la cascada gratis (`CASCADA_DOCS`), nunca Claude. El modelo
    devuelve un JSON propio con NOMBRES; el código resuelve ids, crea las etiquetas nuevas,
    descarta lo que no existe y valida con `validarGrafo`. Acciones en lista blanca (gratis y
    reversibles). Las tarjetas aparecen de a una sobre el layout FINAL. Editar con IA sólo
    AGREGA (v1). El wizard de 9 pasos deja de ser la entrada.
15. **Antes de perder lo no publicado se pregunta**, y Activar valida lo mismo que Publicar.
16. **Las secuencias de los clientes nacen PAUSADAS** y no se tocan las que están prendidas: las
    nuevas REEMPLAZAN a las viejas cuando Martín las active (un canal propone, una persona
    confirma). Código Inmobiliario no tiene canal hoy (línea desconectada, email en sandbox).

## El contrato del modelo (`lib/flujo-grafo.ts`, parte 0)

```ts
export const ID_INICIO = 'entrada';
// PasoGrafo suma:
paralelos?: string[];                 // mensaje, acción, espera, inicio
nodo?: 'esperar' | 'condicion' | 'respuesta' | 'ir_a' | 'inicio';
// ClaseNodo suma 'inicio'
export const TOPE_PARALELOS = 3;      // por tarjeta
export const TOPE_HILOS = 6;          // 1 + la suma de todos los paralelos
export function puedeTenerParalelos(p: PasoGrafo): boolean;
export function raicesSalida(pasos): string[];       // [principal, ...paralelos del inicio]
export function hiloDe(pasos): Map<string, string>;  // nodo → raíz de su hilo ('p' = principal)
```

- `puertosDe` de un nodo simple (y del inicio): `[{ puerto: 'sig' }, ...paralelos.map(d => ({ puerto: 'par:' + d, destino: d }))]`.
  Con eso `apuntados`, `padreDe`, `descendientes`, la regla de «un padre» y las sueltas
  funcionan sin cambios.
- `raizSalida`: con nodo de inicio devuelve su `siguiente` (la primera tarjeta REAL); sin él, la
  regla de hoy (saltando el inicio). `antiguedadDeEntrada` devuelve null si hay más de una raíz.
- `siguienteDe` del inicio: su `siguiente` explícito, nunca «el de abajo del array».
- `normalizar`: conserva `paralelos` sólo en las clases que lo admiten, sin repetidos, sin ids
  vacíos ni a sí mismo; un inicio sin `siguiente` y con paralelos promueve el primero.
- `validarGrafo` rechaza además: paralelos en una clase que no los admite; paralelos dentro de
  «Si responde»; «Si responde» con padre; más de `TOPE_PARALELOS` en una tarjeta o más de
  `TOPE_HILOS` posibles; una tarjeta con paralelos dentro de un bucle de «Ir a» (crearía un hilo
  por vuelta); un «Ir a {tarjeta}» de la salida hacia la tarjeta de OTRO hilo (dos cursores en
  la misma tarjeta = el mismo mensaje dos veces); más de un inicio o un inicio con otro id.
- `LugarInsercion` suma `{ nodo, puerto: 'par' }` (una flecha en paralelo nueva; desde el CRON
  crea el inicio si no está, y si no hay salida principal la tarjeta nueva PASA a ser la
  principal) y `{ nodo, puerto: 'par:<id>' }` (el ＋ del medio de una flecha en paralelo).
  `{ inicio: true }` con nodo de inicio inserta en su `sig`.
- `conectarPuerto` sobre `'par:<id>'` reemplaza ese elemento; con `null` lo saca.
- `borrarNodo`: si colgaba de una flecha en paralelo, el padre se reconecta por esa flecha. Si
  la tarjeta borrada TENÍA paralelos, pasan a la que la reemplaza si puede tenerlos (si no había
  `siguiente`, el primer paralelo pasa a ser el reemplazo); si no, se van con su subárbol y el
  deshacer los devuelve. El inicio no se borra.
- `esFlujoExplicito` (lib/flujo-legado.ts) es true con un inicio o con paralelos.
- `camposDelFlujo` / `CamposFlujo` / `NODOS` / `esLineal` (lib/nutricion-grafo-motor.ts) sanean
  `paralelos` y la clase `inicio`: si no, `setSecuenciaPasos` los BORRA en el primer guardado
  («la quinta puerta»). `esLineal` es false con inicio o paralelos.
- Mig `0228_hilos_paralelos.sql`: `nutricion_inscripciones.hilos jsonb` (CHECK array, con nombre,
  aparte) y `hilos_rev integer not null default 0`. ORDEN: ANTES del deploy (la cola las lee y
  PostgREST rechaza la consulta entera si falta una columna). Sin backfill.

## El contrato del motor (parte M)

- `type Hilo = { h: string; nodo: string; proximo: string }` (`h` = 'p' o el id donde nació).
- Funciones puras con test: `hilosIniciales(pasos, proximoDe)` (null con una sola raíz),
  `hilosVencidos(hilos, ahoraMs)`, `aplicarAHilo(pasos, hilos, h, cambio, nuevos)` →
  `{ hilos | null, resumen: { paso_actual, nodo_actual, proximo_envio_at, estado } }`.
- UNA puerta para escribir la posición, `escribir(...)`, reemplaza las ~23 escrituras de
  `procesarEnvios`. Primero con `hilos` siempre null (refactor sin cambio de comportamiento,
  tests anclados al día), después el modo hilos. Compare-and-set por `hilos_rev`.
- Las columnas de siempre (`proximo_envio_at`, `nodo_actual`, `paso_actual`) RESUMEN el hilo que
  vence primero: la cola y su índice no cambian.
- Un hilo por vuelta; un hilo frenado (20 h, borrador pendiente) se marca visto sin escribir y
  los demás siguen. `resolverControl` devuelve los repartos que encuentra al pasar una espera.
- Cierra el HILO: no hay más tarjetas, una condición termina, «Ir a otra automatización», lo
  terminal de un email (decisión 7). Cierra la INSCRIPCIÓN: la reunión ya pasó, el residuo ya no
  aplica, el tope de saltos, la respuesta del lead. La inscripción termina cuando no queda hilo.
- Freno y topes por canal (decisión 5), con `enviadoEnCorrida: Map<leadId, Set<canal>>`.
- La acción espera el borrador de SU padre, no el de cualquier hilo.
- Ventana en la zona del workspace (decisión 6), una lectura por workspace por corrida.
- `camposDeReactivacion` vuelve `hilos` a null; los 5 lugares que inscriben no cambian salvo
  `proximoDeEntrada(pasos, …)` (el mínimo entre las raíces).
- `setSecuenciaActiva(…, true)` valida lo mismo que Publicar.
- `fechaReunion` (lib/nutricion-desenlace.ts) escribe la hora en la zona del workspace: medido
  hoy en el grupo de Mauricio, «sábado 10, 01:00 a.m.» para una reunión del viernes 9 a las 18
  de Tijuana.

## Los muelles y el lienzo (parte L)

- CRON: dos filas («Al entrar» con `paralelo: true`, «Si responde»). Las flechas en paralelo
  salen de «Al entrar». El ＋ de «Si responde» vacío llama a `crearRespuesta`.
- `PuertoNodo.paralelo?: boolean`: el punto ocupado TAMBIÉN ofrece un ＋, que agrega «en
  paralelo». /mensajes no lo pasa: no cambia.
- `NodoFlujo.familia?: 'contenido' | 'control'`; `TipoNodo` suma `'etiqueta'` y `'email'` si
  hace falta. Altos y anchos de las tarjetas compactas se ESTIMAN en lib/flujo-conversacion.ts.
- `QueAgregar` suma `'email'` y `'etiqueta'`. El menú del ＋: 💬 WhatsApp · ✉️ Email · ⏳
  Esperar · 🔀 Condición · 🏷️ Etiqueta · ⚡ Acción · ↪ Ir a (sin Email ni Esperar adentro de «Si
  responde»; sin «Ir a» en el medio de una flecha).
- `Lienzo`: `panelForma?: 'columna' | 'apaisado'`, `panelAlto?`, `revelar?: { orden: string[];
  clave: number } | null` (las tarjetas aparecen de a una en ese orden; un clic lo completa; con
  `prefers-reduced-motion`, todo junto). Todo opcional.
- `muelles(caja, { listaAbierta, probarAbierto, editorAbierto })` en lib/lienzo-grafo.ts,
  pura y con test: los rectángulos de «Probar» y del editor, y los insets del encuadre.
- `vistaConPanelAbajo(...)`, pura y con test: corre la vista en VERTICAL para que la tarjeta
  editada quede arriba del panel apaisado.
- Lo no publicado: confirmación al cambiar de automatización y `beforeunload`.

## Los editores (parte E) — componentes que monta la integración

```ts
// app/chatbot/EditorMensajeWhatsApp.tsx — suma:
disposicion?: 'columna' | 'fila';   // 'fila': chat a la izquierda, composer y herramientas a la derecha

// app/chatbot/EditorEmailGmail.tsx (nuevo)
export function EditorEmailGmail(p: {
  asunto: string; preheader: string; cuerpo: string;
  onChange: (patch: { asunto?: string; preheader?: string; cuerpo?: string }) => void;
  negocio?: string; deshabilitado?: boolean;
}): JSX.Element;   // lee el remitente solo (GET /api/email/dominio)

// app/chatbot/EditorEtiqueta.tsx (nuevo)
export function EditorEtiqueta(p: {
  operacion: 'poner_etiqueta_lead' | 'sacar_etiqueta_lead';
  etiquetaId: number | null;
  onChange: (operacion: 'poner_etiqueta_lead' | 'sacar_etiqueta_lead', etiquetaId: number | null) => void;
  deshabilitado?: boolean;
}): JSX.Element;   // usa el SelectorEtiqueta EXPORTADO (con «＋ Nueva»)

// app/_components/EditorAccionMako.tsx — mismas props de hoy ({ valor, onCambio, disabled })
```

## «Probar» (parte P)

- `lib/simulador-grafo.ts`: `EstadoSim` con `hilos: Array<{ cursor: string; reloj: number }>`;
  corre el hilo de reloj más bajo; una espera suma a su reloj; un reparto agrega hilos con el
  reloj del padre; una condición pendiente frena la prueba entera; la respuesta pausa todos y el
  «Ir a» desde «Si responde» deja uno, igual que el motor.
- `PanelProbar` llena el rectángulo que le da su padre (`width/height: 100%`): ancho y bajo, los
  interruptores en UNA fila, el chat abajo. El email se ve como un mail (asunto + vista previa),
  no como una burbuja.

## Crear con IA (parte I)

- `lib/flujo-ia.ts` (puro, con tests): `deIA(json, ctx, rnd)` → `{ pasos, etiquetasNuevas,
  avisos }`; `validarIA(pasos, ctx)`; `aIA(pasos)`; `ordenDeRevelado(pasos)` (a lo ancho desde
  el CRON, después «Si responde»). Formato: tarjetas `mensaje | email | esperar | condicion |
  etiqueta | accion | ir_a | si_responde` con ids temporales y `sigue: string | string[]` (el
  primero es el `siguiente`, el resto son paralelos); `inicio: string | string[]`; «si_responde»
  sin padre. Un link NUNCA pasa por el modelo: campo `link` con una clave; la URL la pone el
  código. Las únicas variables son las del motor.
- `POST /api/chat-agent/secuencias/ia` `{ pedido, secuenciaId?, modo: 'crear' | 'editar' }`,
  NDJSON de fases reales (`contexto` con lo que leyó, `modelo`, `revision`, `listo` | `error`),
  guard de admin, `maxDuration`, el cliente con `signal`.
- Feature `chatbot-crear-ia` en lib/model-catalogo.ts (`def: GEMINI()`, sin fila en
  CLAUDE_PERMITIDO); prompts `chatbot.crear-ia.system` y `chatbot.editar-ia.system` en
  lib/prompt-registry.ts, sin slots (lo variable va en el `user`), sin persona de MaKo.
- Crear GUARDA pausada (setSecuenciaPasos + trigger + nombre). Editar devuelve los pasos para el
  borrador local (UNA foto de deshacer).

## Código Inmobiliario: lo que pidieron (parte C)

Su automatización «Nueva Agenda VSL» (30/09, vacía) y su documento piden «un único WhatsApp al
inmobiliario con nombre, teléfono y resumen de lo completado». Ya les llega uno, «Nuevo agendado»
(webhook de Cal.com), sin teléfono y sin las respuestas. Se ENRIQUECE ese aviso (no se crea otro:
serían dos WhatsApp por agenda): teléfono, email y las respuestas del formulario de Cal.com, que
hoy se tiran (`normalizarReserva`). Las respuestas se guardan en `lead_respuestas` como las de
Calendly, y el webhook inscribe por evento (`enrolarPorEvento(…,'agenda_nueva')`) como Calendly.

## Quién es dueño de qué en esta tanda

| Parte | Archivos |
|---|---|
| **0 modelo** | lib/flujo-grafo.ts, lib/flujo-legado.ts, lib/nutricion-grafo-motor.ts (sólo `camposDelFlujo`, `CamposFlujo`, `NODOS`, `esLineal`), supabase/migrations/0228_hilos_paralelos.sql, tests del modelo |
| **M motor** | lib/nutricion.ts, lib/nutricion-grafo-motor.ts (el resto), lib/nutricion-hilos.ts (nuevo), lib/nutricion-reinscripcion.ts, lib/nutricion-desenlace.ts, lib/evolution-envio.ts, lib/api-mako/areas/chatbot.helpers.ts y chatbot.run.ts (sólo lo de hilos), tests del motor |
| **L lienzo** | lib/flujo-conversacion.ts, lib/lienzo-grafo.ts, app/_components/Lienzo.tsx, app/chatbot/FlujoLienzo.tsx, app/chatbot/SecuenciaPerfil.tsx, app/chatbot/SimuladorWhatsApp.tsx, tests |
| **E editores** | app/chatbot/EditorMensajeWhatsApp.tsx, app/chatbot/EditorEmailGmail.tsx, app/chatbot/EditorEtiqueta.tsx, app/_components/EditorAccionMako.tsx, app/_ui/Select.tsx, app/components/Dropdown.tsx (sólo si hace falta), lib/api-mako/tipos.ts (`rotulo?`), app/_components/etiquetas-cliente.tsx, app/agencia/EditorMensaje.tsx (sólo lo que haga falta para reusarlo), tests |
| **P probar** | lib/simulador-grafo.ts, app/chatbot/PanelProbar.tsx, tests |
| **I ia** | lib/flujo-ia.ts, app/api/chat-agent/secuencias/ia/route.ts, lib/model-catalogo.ts (una fila), lib/prompt-registry.ts (dos entradas), app/chatbot/CrearConIA.tsx, lib/setting-secuencias.ts (crear vacía), app/api/chat-agent/secuencias/route.ts (la acción de crear vacía), tests |
| **C calcom** | lib/calcom.ts, app/api/webhooks/calcom/route.ts, lo mínimo de lib/leads.ts para guardar respuestas, tests |
| **integración** | los call sites entre partes: montar los editores de E en FlujoLienzo, `CrearConIA` y `revelar` en SecuenciaPerfil/SimuladorWhatsApp, unificar el SelectorEtiqueta local de FlujoLienzo, retirar el wizard como entrada |

Los tests que leen archivos de varias partes se tocan sólo en las aserciones del archivo propio.
Cada parte declara EN POSITIVO lo que no pudo enchufar en un archivo ajeno, con las líneas exactas.

---

## El pedido de la segunda tanda, literal (Martín, 08/10/2026)

Vino con tres capturas: el lienzo de la Bienvenida (con «Si responde» como una fila suelta), el
editor de la nota de voz (alto y angosto) y el de la acción «Avisar al equipo» (con «Lead» y
«Respuesta» a la vista).

> 1. No pueden haber 2 flujos por separado. Solo 1 CRON y de ahí desprende todo.
> 2. Del CRON inicial debería poder sacar varias flechas... En realidad de varias tarjetas debería poder sacar varias flechas, para que se pueda personalizar. Por ejemplo, de un mismo cron puedo sacar todo una secuencia para WhatsApp y toda otra secuencia de email.
> 3. El editor de WhatsApp debes hacerlo más ancho que largo, sino, se amontona todo.
> 4. De la misma manera que creaste el editor de WhatsApp, crea el editor de Email, con la interfaz de Gmail, que se parezca.
> 5. Las tarjetas de condición, esperar y etiqueta, deberían tener un diseño diferente a las de mensaje y CRON.
> 6. Falta la tarjeta de etiqueta, para poder colocar una etiqueta al lead.
> 7. El editor de Acción esta muy complejo, simplificalo, hazlo entendible de la mejor manera que te parezca... Y sobre todo el desplegable de acciones, como son tantas, tantas, debe estar muy bien diseñado. Tener barra de busuqeda y también que sea modular, como tenemos el desplegable de Plan, de una sección se abren opciones.
> 8. El "Probar" debe ser más ancho también, no tan largo, sino, se rompe el diseño.
> 9. Quiero que audites, como ya hiciste en el pasado, o si te quedó contexto, todo lo que hace Manychat, si nosotros lo estamos haciendo "mal" o "poco eficiente" y revises lo que nos falta y podriamos mejorar.
> 10. Quiero que crees las secuencias que necesita Mauricio por sobre todo y la que quería Código Inmobiliario.
> 11. Quiero que implementes la funcionalidad de crear un secuencia con IA, mendiente un "prompt", y que ahí se vayan creando...


---

# TERCERA TANDA (09/10/2026, madrugada): editores medidos, títulos en inglés, CRON por producto, condiciones de todo el negocio

El pedido literal (16 puntos + 6 de «Crear con IA») está en `app/admin/dev/chatbot/bitacora.ts` (hito
del 9 oct 02:05). Martín lo mandó con siete capturas de producción después de la segunda tanda.

## Decisiones (mías; Martín las puede dar vuelta)

1. **El editor es mediano, no apaisado de borde a borde**: un panel de hasta ~720 px de ancho y alto
   fijo (~420), pegado a la lista. El de WhatsApp vuelve a UNA columna (el chat arriba con su scroll,
   el composer abajo, como un teléfono): partido en dos se leía roto.
2. **«Revisar antes de enviar» sale de la pantalla.** El dato `revisar` queda: lo que ya tiene valor
   sigue igual; lo nuevo hereda lo de la secuencia.
3. **«Ir a» sale del ＋ y de Crear con IA.** Los que ya existen (la 198 salta a la 212, el «Ir a» que
   junta ramas) se siguen dibujando, corriendo y se pueden borrar.
4. **El CRON elige: producto → «Adquisición de clientes» o «Entrega del servicio» → la etapa de ese
   kanban.** Con un solo producto, el primer paso no está. «Eventos» sale del CRON y pasa a las
   condiciones. Un disparador de antes (un evento) se sigue mostrando como lo que es, sin ofrecerse.
   El modo «Por tiempo» se queda.
5. **Los títulos de las tarjetas, en inglés**: CRON · WHATSAPP · EMAIL · DELAY · CONDITION · TAG ·
   ACTION · MAKO · REPLY. «Nota de voz» deja de existir como título: un WhatsApp puede llevar audio,
   texto o archivo. La tarjeta de WhatsApp lleva la identidad de WhatsApp (verde, fondo de chat) y la de
   Email la de Gmail (blanco, el sobre rojo), con tokens que funcionan en oscuro.
6. **Los tres puntos de cada automatización en la lista**: Activar/Pausar, Duplicar y Eliminar (archiva,
   con confirmación; se recupera desde la base).
7. **«Nueva» aparece YA en la lista y abre su lienzo**; lo que tarda se ve adentro del lienzo, con un
   loader. El botón tiene su animación al pasar el cursor.
8. **El emoji del título se edita** con el selector de emoji de la casa (`app/plan/board/EmojiPicker.tsx`).
   Va en una columna propia (`nutricion_secuencias.emoji`, mig 0229).
9. **El editor de la condición es una frase por fila**, con «＋ Condición» y, cuando hay más de una, un
   «Todas / Cualquiera» claro. Nada de «+y +o».
10. **Las condiciones salen de UN catálogo por secciones** (`lib/condiciones-catalogo.ts`), filtrado
    por el ámbito del CRON: adquisición = el CRM (información del lead, origen y tracking, etapa,
    llamadas y agenda, pagos, mensajes, etiquetas, plan); entrega = Customer Success (el curso y su
    avance, la comunidad, las tareas, los pagos del cliente, la etapa de entrega). Cada condición la
    EVALÚA el motor con un dato que lee en batch; una condición que el motor no puede evaluar no se
    ofrece. Profesional y genérico: nada armado para un cliente.
11. **La tarjeta MAKO** manda un mensaje al grupo de WhatsApp del negocio con MaKo: es la acción
    `avisar_al_equipo` con su propio editor (el mensaje, con los datos del lead) y su propia tarjeta.
12. **El email se edita en UNA columna, como redactar en Gmail, con el editor enriquecido de las
    lecciones del curso** (`app/_ui/EditorRico.tsx`). El paso guarda `cuerpo_html` (saneado con una
    lista blanca) y el motor lo manda como HTML; `cuerpo` queda como texto plano de respaldo.
13. **«Probar» se frena con lo mismo que Publicar** (`validarGrafo` + lo que falta escribir) y abre la
    tarjeta que falta, como las tareas del curso.
14. **«Probar» es un desplegable: WhatsApp o Email** (sólo los canales que el flujo usa). WhatsApp es el
    teléfono; Email es una bandeja tipo Gmail. Arranca solo, como recibiendo la automatización, y abajo
    está el botón para probarlo de verdad con tu número o tu email.
15. **Sin «Sin publicar»**: «Publicar» está apagado cuando no hay cambios.
16. **Las acciones de un flujo son una lista CORTA y curada**, cada campo con su control: la etapa con el
    selector de producto y etapa, la etiqueta, la automatización, la persona del equipo, el producto; y
    los campos que dependen de otro aparecen sólo cuando aplican (monto y motivo sólo al mover a Ganado o
    Perdido).
17. **Crear con IA**: se arregla la falla de proveedores (se diagnostica con las keys reales), la caja
    copia el «Nueva tarea» del Plan (minimalista, con micrófono que transcribe en vivo:
    `app/plan/board/CrearTareaModal.tsx` + `dictado-vivo.ts`), el título es «Generar con IA», el
    placeholder escribe y borra ejemplos genéricos como el onboarding (`app/onboarding/OnboardingWizard.tsx`)
    y para del todo al tocar la caja, y mientras crea oscurece el resto, bloquea el lienzo y ofrece
    Cancelar.

## Quién es dueño de qué

| Parte | Archivos |
|---|---|
| **A condiciones** | lib/condiciones-catalogo.ts (nuevo), lib/flujo-grafo.ts (CampoCondicion, FilaCondicion, cumpleFila, textoFila, validación de filas), lib/nutricion-grafo-motor.ts (sanearFila, necesitaHechos), lib/nutricion.ts (sólo hechosDeLeads y lo que lee para las condiciones), lib/simulador-grafo.ts (sólo lo que toque condiciones), app/chatbot/EditorCondicion.tsx (nuevo: el editor de la condición sale de FlujoLienzo), tests |
| **B lienzo y CRON** | lib/flujo-conversacion.ts, lib/lienzo-grafo.ts, app/_components/Lienzo.tsx, app/_components/EditorCron.tsx, app/chatbot/FlujoLienzo.tsx (todo menos el editor de la condición), app/chatbot/SecuenciaPerfil.tsx, supabase/migrations/0229_secuencia_emoji.sql, app/api/chat-agent/secuencias/route.ts (la acción del emoji), lib/setting-secuencias.ts (el emoji), tests |
| **C editores de mensaje** | app/chatbot/EditorMensajeWhatsApp.tsx, app/chatbot/EditorEmailGmail.tsx, lib/email-html.ts, lib/nutricion.ts (sólo el saneo y el envío del email con `cuerpo_html`), un saneador de HTML nuevo en lib, tests |
| **D acciones** | app/_components/EditorAccionMako.tsx, lib/editor-acciones.ts, lib/api-mako/flujo.ts (el catálogo de flujo), widgets nuevos de parámetros, tests |
| **E probar, lista y nueva** | app/chatbot/PanelProbar.tsx, app/chatbot/SimuladorWhatsApp.tsx, app/chatbot/ChatAgentApp.tsx, tests |
| **F crear con IA** | app/chatbot/CrearConIA.tsx, app/api/chat-agent/secuencias/ia/route.ts, lib/flujo-ia.ts, lib/flujo-ia-cliente.ts, lo mínimo de la cascada si la falla está ahí, tests |

Contratos entre partes (la integración enchufa lo que falte):
- `SecuenciaPerfil` (B) llama `onProbar(canal: 'whatsapp' | 'email')`; `SimuladorWhatsApp` (E) se lo pasa a
  `PanelProbar` como `canal`.
- `EditorCondicion` (A) recibe `{ paso, cambiar, ambito: 'adquisicion' | 'entrega', etapas, productos, busy }`
  y lo monta `FlujoLienzo` (B). `ambitoDeDisparo(trigger_tipo)` vive en lib/condiciones-catalogo.ts.
- La tarjeta MAKO (B) es una acción `avisar_al_equipo` con `tipo: 'mako'` en el lienzo, como la etiqueta.
