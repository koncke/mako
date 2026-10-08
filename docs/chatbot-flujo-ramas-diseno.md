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
| `crm_etiquetas`, `crm_lead_etiquetas` (mig 0221) | **E** | M (condición y cohorte) |
| columnas `nutricion_inscripciones.nodo_actual text`, `nutricion_envios.nodo_id text`, `nutricion_secuencias.etiqueta_id bigint`, `wa_borradores.audio_id/adjunto_id` (mig 0220) | **M** | — |
| `setting_adjuntos` (mig 0222) | **C** | M, P |

## 4. Quién es dueño de qué (nadie toca un archivo de otra parte)

- **M — motor y servidor**:
  - código: lib/nutricion.ts, lib/nutricion-desenlace.ts, lib/setting-secuencias.ts,
    lib/chat-agent-handoff.ts, lib/evolution-envio.ts, lib/nutricion-generator.ts (COHORTE_GLOSS),
    lib/setting-estrategia.ts, lib/nutricion-*.ts;
  - API: app/api/chat-agent/secuencias/route.ts, app/api/whatsapp/secuencias/route.ts,
    lib/api-mako/areas/chatbot.def.ts y .run.ts y sus helpers;
  - mig 0220 y scripts/migrar-secuencias-a-grafo.mts;
  - tests de todo eso.
- **E — etiquetas**:
  - datos: mig 0221, lib/etiquetas.ts, lib/workspace.ts (TENANT_TABLES), lib/tablas-de-inquilino.ts,
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
  - biblioteca: mig 0222, lib/setting-adjuntos.ts, app/api/chat-agent/adjuntos/route.ts,
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
