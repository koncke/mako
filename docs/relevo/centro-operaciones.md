# Relevo — Ops Center, ex Centro de Operaciones (17/10/2026, ~08:00; cuenta 4, `claude4`)

Lo tomó el 17/10 a la mañana el chat «Ops Center» de la cuenta 4, el segundo de ese día (el primero cerró con el
contexto al 87%). Lo que costó cada cosa está en `docs/hallazgos-operaciones.md`, en la entrada «Adjuntos hasta la PC,
los "Ya está" en Review, el Runner y la nube» (17/10). Lo pedido, textual, está en
`app/admin/dev/centro-operaciones/bitacora.ts` y `app/admin/dev/second-brain/bitacora.ts`. Worktree:
`C:/dev/wt-centro-chat`, rama `centro-chat` (la sube el Cerebro; merge, nunca rebase).

## URGENTE, ANTES QUE LA A (17/10, ~08:00 UTC): que salga en SEGUNDOS y que la pantalla diga qué pasa

Martín: «Envié un mensaje y no pasó nada por varios segundos... Debería automáticamente comenzar a trabajar». Medido por el
Cerebro: lo mandó a Video Generator a las 07:55 UTC, el buzón salió a las 07:56:57 y el acuse a las 07:57:11. Son unos
2 minutos, porque el Runner da una vuelta cada 2.
1. **Entrega en pocos segundos.** `esperar` ya existía, pero corre la vuelta COMPLETA (sube chats y turnos) cada 15 s y
   sale por stderr con código 2. Lo nuevo:
   - una consulta liviana con el token del cartero, `GET /api/operaciones/cartero?hay=<cuenta>`: un count de lo
     `escrito` para sus entregables guardados, más los `nuevo` de su cuenta;
   - el comando `vigilar [--max-seg N]`: la vuelta completa al empezar, consultas livianas cada ~4 s y, apenas hay algo,
     la vuelta completa y el mismo JSON que `ciclo` (`entregar`, `aperturas`);
   - el cron del Runner corre `vigilar --max-seg 100` en lugar de `ciclo`. El tope de la herramienta Bash es 120 s.
   El costo de Vercel son los builds (memoria «Costo de Vercel = builds»), no las invocaciones. El estado lo dice la
   punta «vigilar» en la tabla de abajo.
2. **La pantalla dice lo que pasa, sin silencio:** «Enviado» → «La PC lo recibió» (tomado) → «Trabajando…» (entregado y
   el chat busy), con la animación del punto E. Si tarda, dice por qué: el Runner no está (`carteroVivo`), la PC está
   dormida (`visto_at` viejo) o la cuota se acabó (`cuota` al 100%). Las piezas: `motivoDeEspera`
   (lib/operaciones-reglas.ts), `Tick` y `ROTULO` (Hilo.tsx), `sinNoticiasDesde`.

## EL FEEDBACK DE MARTÍN DEL 17/10 (~04:45 AR) — A a I, VA ANTES QUE TODO, en este orden

Llegó por el Cerebro, con capturas: la caja con 4 chips, «Plan 1/1» con «Review», la tarjeta «Cuenta 3/4» con «Sin
medir» y la preview pegada de «image.png». Cada punto se hace en computadora Y teléfono, con su test probado rompiéndolo
y su «Ya está» en el chat Ops Center. Lo que no es del Centro lo toman otros:
- el grafo (los puntos 11-13 de Martín) es del chat «Second Brain» (`local_26ff7b73-b712-4726-9882-89617840bf7c`, rama
  second-brain);
- los tickets de usuarios son del chat «Ticketera» (`local_03731046-a5b3-418b-a947-6b4c6b294ce9`). El mazo viejo
  (admin_decisiones, scripts/decisiones.ts, lib/decisiones-aviso.ts) ahora es SUYO.

«Si algo choca con lo que ya está, decide tú con criterio. A Martín, sólo lo que lo escrito no contesta.»

**A) Las preguntas son un FORMULARIO DE OPCIONES en la conversación** (su punto 3). «Ops Center me está preguntando
algo y me pide que responda, en lugar de darme las opciones tipo multiple select.» El caso real: un chat (el Ops Center,
con «¿Abro la ventana? Contestá "sí, ábrela"») preguntó en TEXTO. Toda pregunta de un chat se dibuja en SU conversación
como el formulario: opciones con detalle, la recomendada primero, una o varias. Decidido con criterio (y avisado al chat
Ticketera): un canal PROPIO del Centro, no admin_decisiones.
- **La PC:** `cartero.mjs preguntar <archivo.json>`, con `{ pregunta, contexto?, opciones: [{ titulo, detalle? }],
  recomendada?: <índice>, varias?: true }`. La sesión sale de `$CLAUDE_CODE_HOST_SESSION_ID` (da `local_…` en la app) o
  `cli_<$CLAUDE_CODE_SESSION_ID>` en la terminal. Escribe `preguntas/<uuid>.json`, y `ciclo` lo sube y lo borra cuando
  MaKo dice que entró (el molde es el de los cierres: `cierresIds`).
- **MaKo:** app_settings, sin migración, con el molde de lib/centro-turnos-db.ts: una clave por chat
  (`operaciones.preguntas.<local>`), lectura estricta antes de escribir. Si hiciera falta, la próxima migración libre es
  la 0312.
- **La respuesta vuelve FIRMADA**, por mandar.ts: un trabajo para esa sesión con «Respuesta a tu pregunta «…»: B — …».
  Después, una acción con `puedeOperar` la marca contestada (compare-and-set: sólo si no lo estaba). Sin trabajo
  firmado no se marca nada.
- **La pantalla:** una línea nueva de la conversación (`LineaChat` tipo `pregunta`, en `historialDelChat`), con un
  formulario propio. Pregunta.tsx sirve de molde visual, pero está atada a `Decision`. Hilo.tsx lo usa la computadora y
  el teléfono, y recibe `onResponder`. Contestada, queda la pregunta con la opción elegida.
- **Cuando ande:** cambiar la regla de AGENTS.md («preguntar por la Ticketera» → «preguntar con el formulario en tu
  chat: `cartero.mjs preguntar`») y avisarle al chat Ticketera. Desde ahí, sacar del mazo las preguntas de los chats es
  suyo. Hasta entonces, la pregunta de admin_decisiones sigue arriba de la caja (Pregunta.tsx), como hoy.

**B) La caja** (sus puntos 4, 14 y 15, y las listas):
- abajo, un solo «+» con un desplegable bien diseñado. Adentro: «Importar archivo» e «Imagen» como dos botones (copiar
  el diseño de la caja de MaKo Mobile o del Second Brain), la cuenta, el modelo y el esfuerzo, y «Tareas vinculadas
  (N)» (ver D);
- «Sólo esto» SE VA: la IA decide sola si guarda una regla. Hay que sacar `alcance` de la caja; la firma lo sigue
  admitiendo, así que se manda siempre `solo_esto` y el texto del mensaje (cartero.mjs → `mensaje`) deja de nombrarlo;
- la preview de un adjunto va como en Claude: sólo la miniatura, sin el nombre, con aire respecto del placeholder
  («Escribe a Pagos» estaba pegado). Al clickearla se amplía ANTES de mandar, también un PDF;
- **las listas de Markdown en vivo**: «1. », «- » y «* » se vuelven lista mientras escribe; Enter sigue la lista y un
  Enter en un ítem vacío la corta. También en los mensajes que se ven (Hilo);
- **el borrador nunca se pierde** (punto 15): uno por chat, guardado mientras escribe (con debounce), que vuelve al abrir
  ese chat, y se borra sólo cuando el mensaje SALIÓ. Va en localStorage (sobrevive a cerrar el navegador) y en una copia
  en MaKo (app_settings, por chat) para que cruce al teléfono. Los adjuntos sin mandar, si se puede (IndexedDB).

**C) «Review» y «En el Plan» SE VAN** (sus puntos 5 y 6). En su lugar, cada «Ya está» es un MENSAJE muy bien
diseñado en la conversación, con:
- qué cambió, en palabras de producto;
- los links a dónde revisar (el `revisar`), y qué se espera que mire;
- una forma fácil de darle feedback ahí mismo;
- la TARJETA del Plan, clickeable, que abre su detalle.

Marcar resuelta una tarea o un proyecto cuando algo ya está es AUTOMÁTICO, siempre. Base: `yaEstaDelChat`, que hoy
alimenta Review (lib/centro-chats.ts), y `rutaDeYaEsta`. Al sacar Review se van `ListaReview`, `SubTabs` y la barra
del Plan (Avance.tsx).

**D) El Plan desde el chat** (sus puntos 6 y 9):
- en el «+», «Tareas vinculadas (N)» trae las tareas del chat;
- la conexión con el Plan es libre: si Martín pide «tráeme las más prioritarias», «cámbiale el nombre» o «bórralas», el
  chat lo hace por la API de MaKo del Plan, con historial con actor MaKo;
- con «Voy a trabajar en…» y «Ya está», el Plan de cada chat se arma solo: no puede haber chats con el Plan vacío;
- nada de desplegables: tocar un ítem trae el mensaje bien diseñado que ya se mandó.

Base: lib/centro-plan.ts (`/api/centro/plan`, las operaciones del Plan aplicadas en el acto) y `proyectoDelChat`.

**E) Trabajando** (su punto 1): mientras un chat trabaja, una animación con los pasos de su turno en vivo, como Claude.
La fuente: el transcript ya se lee por bytes (cartero.mjs → `turnosNuevos`). Los `tool_use` traen `input.description`
(el Bash) y el nombre de la herramienta. Habría que subir los pasos del turno ABIERTO, cortos y sin contenido.

**F) Criatura** (su punto 7): «Su muñeco» pasa a llamarse «Criatura». Tiene 9 cuerpos, 9 colores y 9 caras, y se
mueve adentro de su recuadro como en el chat (Muneco.tsx, ElegirMuneco.tsx, lib/centro-munecos.ts).

**G) Las cuentas** (su punto 8):
- «Abre su Runner en la app de Claude para conectarlo» no aparece más: si todo se abre solo, el botón «Runners» sobra y
  el Runner se arma automático;
- va el logo de Claude o de GPT según la cuenta. Martín preguntó si ya está GPT: NO. El Centro conoce sólo las cuentas de
  Claude Code (claude1-4), y ya se lo dijo en el chat;
- «Cuenta 1» trae su NOMBRE, editable, y debajo el email de esa cuenta. Los titulares están en `~/.claude/cuentas.tsv`;
- «Sesión de 5 horas: Sin medir» es un bug: medirlo. La cuenta de la app trae la 5 h por `get_usage` (la mide el
  Runner de la app); el cartero descarta la de 5 h si tiene más de 30 min (hallazgos, «Ops Center: una sola pantalla»).

**H) Fuera los tres puntos de arriba a la derecha de cada chat** (su punto 10): renombrar y cambiar la criatura ya
están en la barra lateral. Es `co-cab__mas` en Conversacion.tsx, y el «⋯» de la hoja en ChatsMovil.tsx.

**I) La entrada «Second Brain» del Centro** (su punto 11, la parte del Centro): abre SÓLO el grafo y nunca cambia de
chat, y la entrada «Mapa» se va. Reparto acordado con el chat Second Brain:
- él toca la rama `mapa ? (<section className="co-panel" aria-label="Mapa">…)` de ChatSecondBrain.tsx y VistaCerebro.tsx;
- el Ops Center toca sólo la barra (`enSB`, `irAlSecondBrain`, el botón «Mapa») y app/m/operaciones/CentroAppMovil.tsx.

Él commitea primero: antes de editar ese archivo, mergear origin/integracion.

## Las cinco puntas del 17/10 (Martín: «quiero comenzar a dar feedback de las cosas pero me estás trabando»)

| # | Qué | Commit | Estado |
|---|---|---|---|
| 1 | «Second Brain», debajo de la Ticketera, abre el GRAFO (computadora y teléfono) | `9b4ba4eda` + `3cd7776d3` | **en producción** (run 90); el «Ya está» ya se dijo |
| 2 | Adjuntar fotos y PDF en la caja, y pegar una captura con Ctrl+V, hasta la PC | `f9409f98b` | **en producción** (run 92); «Ya está» dicho |
| 2b | Los dos defectos de la revisión de seguridad: la bajada sin tope de RAM, y lo `tomado` sin salida | `2955b1ec6` | **en producción** (run 92) |
| 3 | Review lista cada «Ya está» de un chat como un hecho, con su ruta | `b644d149e` | **en producción** (run 92); «Ya está» dicho |
| 4 | El Runner y los chats de la nube en la lista (cartero 1.10.0, instalado) | `78165968b` | **en producción** (run 92); «Ya está» dicho |
| 5 | El clic sin PowerShell: medido (con Martín), el diseño corregido y cosechado | `7fc2b2a9a` | hecho |
| 5a | El trabajo «abrir» del lado de la PC y de MaKo (cartero 1.11.0: `abrir`, `abrir-permitir`) | `cd1587939` | en la revisión de seguridad del Cerebro |
| 5b | «Abrir» en «Nuevo chat», computadora y teléfono | `3af6a4e5e` | pasada al Cerebro |

**Lo que hace el Cerebro con la 5:** cuando la 5a pase su revisión de seguridad, instala el cartero **1.11.0** y le pasa
al Runner los pasos nuevos de `INSTRUCCIONES_RUNNER` (lib/runner.ts): el 2c, correr `abrir` si `ciclo` trae aperturas, y
el 5, el permiso. «Abrir» aparece en «Nuevo chat» sólo para una cuenta de terminal cuyo Runner ya tiene la 1.11.0
(`puedeAbrirEn`). Mientras tanto queda «Copiar comando», como antes.

**Los arreglos del Cerebro ya están en la rama** (merge `07d8d43d2`): `achicarImagen` en un archivo sin `'use client'`
(`dc159c742`), y los tests del Ops Center en la lista de `scripts/rutas-windows-en-tests.mjs` (`852198de7`, `c0a62a84d`).

**Antes de pasar una punta** se corren, además de centro-*, operaciones*, second-brain*, cartero*,
puente-panel-copy y progreso:
- `tests/frontera-use-client.test.ts`;
- los barridos que recorren el repo: `grep -lE "ls-files|archivosDelRepo|readdirSync" tests/*.test.ts`.

**Lo que sigue, en este orden:**
1. **Lo que salga de la revisión de seguridad de la 5a** (el Cerebro lo pasa con el escenario): arreglarlo como punta
   aparte, con su test probado rompiéndolo, antes que nada.
2. **El caso de la cuenta de la app en el clic**: sólo puede PROPONER el chat (una tarjeta que Martín toca en la app).
   Sin diseñar del todo: está en docs/diseno-nuevo-chat-un-clic.md, «Sin medir todavía».
3. **Sacar los «Copiar comando» que quedan** cuando el clic ande en las tres terminales: PanelRunner.tsx (abrir un
   Runner de terminal) y el de «Nuevo chat». Martín: ningún «Pega su comando en PowerShell» en ninguna pantalla.
4. Lo que quedó de la tabla del 17/10 (abajo): el plan y la ventana de 5 h de la cuenta de la app en el Uso (punto 4).
5. Las tandas 8, 7, 9 y 6 del Second Brain, y «Skills».

**Lo que Martín tiene que hacer por el Ops Center:**
- probar un adjunto de punta a punta (la 1.10.0 ya está instalada): una captura con Ctrl+V a un chat, y que el chat abra
  la ruta que le llegó;
- cuando el Cerebro instale la 1.11.0: decirle al Runner «prende la apertura de chats» (una vez), y probar «Nuevo chat» →
  «Abrir» con una cuenta de terminal. Si la ventana aparece pero el chat no arranca con su mensaje, es lo que falta medir
  (`claudeN -n '<nombre>' '<pedido>'`).

**Regla de Martín (17/10, en AGENTS.md):** el «Ya está» de lo que llegó a producción lo escribe CADA chat en Ops Center,
con la ruta donde se prueba, cuando el Cerebro avisa que llegó. Dicho de las puntas 1 a 4; falta el de la 5 cuando llegue.

## FEEDBACK DE MARTÍN DEL 17/10 (~01:30 y ~01:45), mirando producción — su estado

| # | Pedido | Estado |
|---|---|---|
| 1 | «los chats no se entienden»: la conversación como un chat de verdad | **en producción** (run 90): de cada turno, el «Voy a trabajar en…» y el «Ya está»; «Sin noticias del Runner desde las…» con la foto vieja. El Cerebro borró las marcas viejas y el Runner volvió a subir las conversaciones (54 chats, 06:22 UTC) |
| 2 | «El Second Brain y el Centro deberían ser exactamente lo mismo en SuperAdmin» | **hecho**: Ops Center, una pantalla con dos puertas (app/second-brain/pagina.tsx) |
| b | «que quede el nombre de "Ops Center"» | **hecho** |
| c | «que "Second brain" sea la sub tab debajo de la Ticketera» | **hecho**, y desde la punta 1 abre el grafo |
| 3 | elegir la cuenta al mandar, con «Automático» por defecto | **hecho** (computadora y teléfono) |
| 4 | el Uso de las CUATRO cuentas, con su plan, la de 5 horas y la semanal | **hecho en la pantalla**; falta que la PC mande el plan y la 5 h de la cuenta de la app |
| 5 | ningún «Pega su comando en PowerShell»: el clic más el permiso de la PC | la punta 5: medida, 5a en revisión, 5b pasada; quedan los «Copiar comando» de PanelRunner y de «Nuevo chat» hasta que ande |
| 6 | Review con TODO lo terminado; sin ruta, la tab de su área | **hecho**, y desde la punta 3 también los «Ya está» |
| 7 | elegir el modelo y el esfuerzo al mandar o abrir un chat | **hecho al mandar** (sólo chats de la APP). Sin medir si la app pregunta cada vez. Al ABRIR, va con el clic |
| a | todo chat abierto se ve | **hecho** con la punta 4: «Sin asignar» abierta, el Runner marcado y la nube con su chip. Sin medir la forma de una fila de la nube |

## PRIORIDAD DEL 17/10: escribirle a Claude Code desde el Second Brain (tanda 5) — HECHA, falta probarla

Martín: «quiero dejar de mandar prompts por aquí, quiero mandar prompts por MaKo en el Second Brain, terminemos de
configurar eso así ya comenzamos».

- **Escritorio.** En `/second-brain`, quien `puedeOperar` (Martín, con su segundo factor) ve en la barra la sección
  **«Claude Code»**. Tiene el Cerebro y cada jefe con sus sub-chats, los mismos del Centro. Al elegir uno se abre su
  conversación con la caja firmada, el avance y la pregunta de la Ticketera, y el «⋯» trae Renombrar y el muñeco. La
  URL: `?centro=<clave>`.
- **Teléfono.** En `/m/second-brain`, la hoja «Tus chats» muestra los mismos chats debajo de los de MaKo. Al tocar uno se
  abre su conversación en una hoja aparte.
- **Cómo.** El Centro pasó a ser un adaptador: `useCentro` es el motor, `PiezasCentro.tsx` las piezas y
  `datosDelCentroSiOpera` la lectura, con la guarda adentro. Lo montan las cuatro pantallas. La regla quedó en
  AGENTS.md, y el test en `tests/second-brain-centro.test.ts`.
- **Lo que se queda en /admin/operaciones:** la Ticketera entera, los Runners con el Uso y el comando de «Nuevo chat».
- **No verificado:** la pantalla real (no se levantó `next dev`, que no entra en la RAM). El chequeo de tipos acotado
  dio 0 errores en los 13 archivos tocados, y los tests del Centro y del Second Brain están en verde (151).

**También en esta punta, del reparto del Cerebro (docs/relevo/cerebro.md, «Al Centro»):** el panel de Uso ya no le
ofrece `claude4 -n Runner` a la cuenta 4, que no tiene función en el `$PROFILE`. Ahora le dice que abra su Runner en
la app (`tieneTerminal`, lib/runner.ts, con test).

**Lo que sigue del reparto del Cerebro, antes de las tandas:** Martín quiere abrir un chat de terminal con «un clic + el
permiso de la PC», nunca pegando un comando en PowerShell. **El diseño está escrito: docs/diseno-nuevo-chat-un-clic.md**
(17/10, sin construir).
- Para las cuentas de terminal: un trabajo firmado con `destino: 'nuevo'`, que la PC abre en PowerShell.
- El permiso de la PC es el de Claude Code sobre `cartero.mjs abrir`, más uno local que Martín prende una vez en el
  Runner.
- Para la cuenta de la app no se puede desde MaKo: `start_session` se rechaza en los turnos del cron y en los de un
  mensaje.

Antes de construir hay que medir tres cosas (están en el diseño). Una es que la ventana se vea, y abre una ventana en la
pantalla de Martín: hacerlo con él despierto. Toca cartero.mjs, que corre el Runner: avisar ANTES al Cerebro.

**La prueba de punta a punta la hace Martín.** Abre `/second-brain` → «Claude Code» → «Cerebro», escribe algo y lo
manda. Tiene que ver el tick y la respuesta del Cerebro. Si la caja dice «Pégale tu Token al Runner», copia el Token
desde ahí y se lo pega al Runner de la cuenta 4.

## FEEDBACK DE MARTÍN DEL 16/10/2026 a la tarde — Second Brain: «Skills» como skills.sh

Un botón «Skills» con un catálogo como skills.sh:
- «agregar» instala la skill sola;
- se crea un chat con esa skill, que usa todo el equipo;
- corre con el Claude o el GPT que el cliente conectó.

Está textual en **docs/feedback-16-10-crm-onboarding-second-brain.md** (sección Second Brain). Va después de las
tandas que faltan (abajo), y el diseño va primero: antes, mirar skills.sh entero.

## Lo que sigue: el orden del Cerebro (17/10)

Orden: **10, 8, 7 y 9**, después la **6** y después «Skills». La etapa 2 está en docs/diseno-mako-ai-native.md. Rama
`centro-chat` (la sube el Cerebro; merge, nunca rebase).

| Tanda | Qué | Estado |
|---|---|---|
| 1 | La pieza única en `/second-brain` (jefe «Second Brain» y sus sub-chats, conversación, caja) | `ad60dedfa` + `a26929c4d` |
| 2 | «Pregúntale a MaKo» es el Second Brain; `/mako` y `/mako-doer` redirigen; «Antes» | `1af0906b6` + `1971c9a89` |
| 3 | El teléfono: `/m/second-brain` es el chat, el Mapa en `/m/second-brain/mapa` | `36fcaa16e` |
| 4 | Los adjuntos se guardan en el Archivero (mig **0305**) + lo que encontró la revisión | `4da56c37c` + `129eed9b9` |
| **5** | **El Centro como adaptador: Claude Code desde el Second Brain** | **`8835e17aa` (la punta del 17/10)** |
| 10 | «Entender el pedido»: los «Ir a …» debajo de la respuesta de MaKo | la punta del 17/10 (después de `6d3a4e0b9`) |
| 7, 8, 9 | La parte de SERVIDOR, sin pantalla todavía (abajo) | `440bd6eea` |
| 6 | Sin empezar | — |

⚠️ **La migración 0305 (`chart_chats.bloques`) la aplica el Cerebro**, con `node scripts/apply-migration.mjs
supabase/migrations/0305_chart_chats_bloques.sql`. Sólo agrega, y el código la tolera ausente: sin ella los adjuntos le
llegan a MaKo pero no vuelven al recargar. Una migración nueva se le pide al Cerebro (la próxima libre era la 0306).

**Cada tanda que falta, con su archivo listo:**
1. ~~**Tanda 10, «entender el pedido».**~~ Hecha el 17/10. Los links se piden en paralelo al turno y se cuelgan de la
   respuesta a ESE mensaje (`colgarIrA`). Lo que costó está en hallazgos-second-brain.md. El link también se dibuja en
   HiloMako, así que los chats de cada tab lo tienen si lo piden.
2. **Tanda 8, el grupo de WhatsApp en la barra (sólo admin).** Ya están:
   - `grupoDeMaKo` y `hiloDelGrupoMaKo` (lib/chat-mako-indice.ts);
   - `hiloDelGrupo` (lib/mako-doer-conv.ts);
   - `TITULO_GRUPO`, `AVISO_GRUPO` y `antesValido` (lib/chat-mako-reglas.ts).

   Falta:
   - `GET /api/mako/chat?grupo=1` y `?grupoHilo=1&antes=`, con `persona` de `personaDelRequest`;
   - la fila en la barra;
   - la caja reemplazada por `AVISO_GRUPO`.

   NO va a la API de MaKo: no va a ningún modelo (pii).
3. **Tanda 7, el riel «Lo que hizo».** Ya están `loQueHizo` (lib/chat-mako-hecho.ts), `estadoDeLoHecho` (con test) y la
   lectura `lo_que_hizo_chat_mako` de la API. Falta:
   - el riel en la pieza: `ListaAvance` de Avance.tsx, con `PILL_PROPUESTA`;
   - su `GET ?hecho=<sessionId>`, mirando `sesionDe` antes de leer.
4. **Tanda 9, muñecos y Renombrar.** Ya están el almacén `lib/chat-munecos(-db).ts` (compare-and-set, con test) y la
   acción `renombrar_chat_mako`. Falta:
   - el «⋯» de cada fila: Renombrar con `nombreValido`, y «Cambiar su muñeco» con `ElegirMuneco`. El «⋯» de las filas
     de Claude Code ya existe (`MenusCentro`, PiezasCentro.tsx): copiarlo;
   - leer `munecosDeChats` al listar.

   La acción `muneco_chat_mako` se sacó hasta que la pantalla lea los muñecos: un «Listo» que no cambia nada en
   pantalla sería mentira.
5. **Tanda 6:** los sub-chats del CRM y del lead en la barra, «Second Brain › <Área>» y el Mapa limpio.
6. **Después, la etapa 5:** los chats y las creaciones como nodos del grafo, con el layout guardado.

**SIN HACER que no es de la etapa:**
- retirar `/api/mako-doer`, que no tiene pantalla desde la tanda 2;
- que el hilo del teléfono dibuje las listas de Markdown: es de MaKo Mobile, no de este chat.

**Lo que necesita a Martín:**
- la prueba de punta a punta (arriba);
- renombrar los «Estrategia 3 cuentas» de las otras cuentas a «Cerebro»: con «⋯ Renombrar», que ahora también está en
  el Second Brain, porque firma su dispositivo;
- abrir los Runners de terminal (abajo);
- el OK para que un archivo baje a la PC (los adjuntos del CENTRO, no los del Second Brain);
- el alcance de la sección (f) del diseño AI-native.

## El Centro (lo de antes del 16/10, sigue valiendo)

- **El Centro es una app de chat, con cada chat como un empleado** (Grok Bot), en producción desde el 15/10. A la
  izquierda los chats, a la derecha la conversación con su **caja de escribir abajo**. En el teléfono, lo mismo.
- **El feedback de Martín del 15/10 son siete puntos** (textual en la bitácora). Van en este orden, uno por punta:
  1. **Hecho (punta 1): los textos (6) y el nombre (5).** Cada texto dice qué hacer y para qué («Crea tu Token para
     comenzar a chatear», frase suya); el cartero se llama **Runner** en pantalla (copiado de GitHub Actions) y su
     modal es la página de Runners de GitHub (lista + «Nuevo Runner» con tres pasos). Lo fija
     `tests/centro-textos.test.ts`; la regla quedó en AGENTS.md.
  2. **Hecho (punta 2): el avance por chat (1) y la cuenta como chip (3).** El botón «Avance 3/5» de la cabecera abre la
     barra derecha (copiada de Offer) con un rombo por cosa pedida, como los milestones de Linear (`Avance.tsx`); se
     fueron las vistas Avance y Pushes y los grupos por cuenta.
  3. **Hecho (punta 3): el chat jefe (2), un nombre para las tres cuentas con «⋯ Renombrar» (4) y los muñequitos
     elegibles (7).** La convención quedó en AGENTS.md: el jefe se llama como la tab y un sub-chat «CRM › Lead Detail».
     Renombrar le manda a cada sesión un trabajo firmado; el muñeco elegido se guarda por nombre.
- **Lo que se escribe en la caja se firma en el dispositivo y queda en la cola** (`mandar.ts` → `encolarPedidoAction`).
  Para que LLEGUE al chat falta lo de abajo, que no es código.

## Lo que falta para que un trabajo llegue

**La cuenta 4 (17/10, lo armó el Cerebro):**
- el Runner de la app (`~/.claude`) ya está abierto;
- la carpeta `7d03ccd6…` está declarada como `claude4` en el cartero;
- la PC acepta un Token (`9813c2b3…`).

`claude4` ya está en `CUENTAS` (app/admin/dev/_registro/tipos.ts, `6d3626f95`). **NO** se suma a `CUENTAS_TERMINAL`: no
hay función `claude4` en el `$PROFILE`, y la pantalla ofrecería un comando que falla.

1. **El Token de cada dispositivo, pegado en el Runner.** Medido el 15/10 (`cartero.mjs estado`): la PC acepta UN
   Token (`9813c2b3…`); el de cada dispositivo que falte se pega igual. En el Centro: Runners → la fila «Este dispositivo» (o la caja de cualquier chat) dice «Pégale tu Token al
   Runner para comenzar a chatear» y ofrece «Copiar Token»; Martín lo pega en el chat Runner, que corre
   `cartero.mjs clave`. Uno por dispositivo (la compu y el teléfono).
2. **Un Runner en cada CARPETA donde haya chats abiertos** (16/10: `SendMessage` no cruza carpetas de config, medido).
   Sus instrucciones viven en `lib/runner.ts` (`INSTRUCCIONES_RUNNER`) y se copian desde el Centro: Runners → **Nuevo
   Runner** → «Copiar». El de la app (`~/.claude`) le llega a la app y a la terminal de la cuenta 1; las cuentas 2 y 3
   en terminal necesitan el suyo (los pasos, abajo).
3. **Renombrar el chat que hoy se llama «Cartero».** La línea para pegarle (la PC ya lo reconoce por los dos nombres,
   `esElCartero` en cartero.mjs 1.3.0, instalado el 15/10):

```text
Renombra este chat a "Runner" con set_session_title. Desde ahora eres el Runner del Centro de Operaciones: el trabajo es el mismo (cada 2 minutos, ciclo y entregar), y si te pego un token que empieza con mkop_, corre `node ~/.claude/operaciones/cartero.mjs token <el token>` y confírmalo en una línea.
```

**Para que las tres cuenten a la vez (16/10, cartero 1.4.0 instalado y con las tres terminales declaradas)**: las tres
están logueadas; falta abrir un Runner por cuenta de terminal. Lo que hace Martín, una ventana de PowerShell por cuenta:

1. Abre PowerShell y pega el comando de la cuenta (Centro → Uso → Nuevo Runner, uno por cuenta con su botón de copiar):
   `claude2 -n Runner --settings $HOME\.claude\operaciones\runner-settings.json` (y lo mismo con `claude3`; `claude1`
   cuando deje de usar la app). El `--settings` le pone la barra de estado que mide el Uso de esa cuenta (16/10/2026).
2. Pégale las instrucciones (Centro → Runners → Nuevo Runner → Copiar).
3. La primera vez que pida permiso para `node ~/.claude/operaciones/cartero.mjs …`, elige la opción que no vuelve a
   preguntar: si no, la vuelta de cada 2 minutos se frena esperándolo.
4. Deja la ventana abierta (puede ir minimizada): cerrarla apaga el Runner de esa cuenta, y el Centro lo dice («Abre el
   Runner en la terminal de la cuenta 2 para que salga»).

Para que un chat de terminal se llame como su tab y se una con los de las otras cuentas: `claude2 -n "CRM"`. Por qué
una carpeta y no una cuenta: hallazgos-operaciones.md → «SendMessage no cruza carpetas».

## El contrato con «Centro de Operaciones › Review» (16/10/2026)

Martín pidió (punto 6) que el avance se llame «Plan» y tenga dos sub-tabs: «Plan» (lo de hoy) y «Review» (lo que el chat
implementó y hay que revisar, con «Revisar»), y que «Revisar» abra la página para clickear sus elementos y dejar
devolución en un chat de MaKo al costado, con cada elemento mencionado en azul. Se parte en dos sesiones que no tocan los
mismos archivos:

| | Este chat (Centro de Operaciones) | El sub-chat «Centro de Operaciones › Review» |
|---|---|---|
| Archivos | `Avance.tsx` (las sub-tabs), `lib/centro-chats.ts` (`enlaceRevisar`), `cartero.mjs` y `lib/operaciones-reglas.ts` (el campo `revisar`) | `app/admin/operaciones/revisar/**` (página, visor, su CSS) |
| Hace | la lista de «Review» y el link «Revisar» | el visor: la página clickeable y el chat con las menciones |

**De dónde sale lo que se revisa.** Un nodo del avance va a «Review» cuando está terminado y trae una página: el chat que lo
hizo la deja en su cierre (`cartero.mjs cierre <id> … --revisar "/crm?lead=12"`) o en el hito de su bitácora
(`revisar: '/crm?lead=12'`). Siempre una ruta INTERNA de MaKo (`esHrefInterno`, app/admin/runway/decisiones.ts).

**Lo que recibe el visor** (el link «Revisar»): `/admin/operaciones/revisar?pagina=<ruta interna, con su ?ws=, codificada>
&chat=<clave del chat: nombre:…>&sesion=<local_… o cli_… de la sesión que lo hizo>&nodo=<id del nodo: p:<pedido> o
t:<trabajo>>`. El visor vive debajo de /admin/operaciones, así que hereda la guarda del Centro (`getSesionAdmin` +
`puedeOperar`, primeras líneas de la página). ⚠️ `pagina` se valida con `esHrefInterno` antes de dibujarla: nunca
una URL de afuera adentro del visor.

**Dónde vuelve la devolución.** Al chat que lo hizo (`sesion`), como un TRABAJO FIRMADO, por el único camino que hay para
escribirle a un chat: `useFirma(sub).mandar({ sesion, cuenta, titulo }, texto, 'solo_esto')` de
app/admin/operaciones/mandar.ts (AGENTS.md: «Escribirle a un chat se hace desde SU conversación, y por UN camino»). El texto
arranca con «Revisión de <pagina> (<nodo>):» y cada mención va como «[en «<texto visible del elemento>» · <selector>]».
Después de mandar, el visor vuelve a `/admin/operaciones?chat=<chat>`. El visor no inventa otra puerta a la PC ni otra
tabla: si necesita algo de este lado, lo pide acá.

## No verificado

- La pantalla real en producción: las capturas del 16/10 son del arnés con datos ficticios (el guard no deja entrar a
  otra sesión). La tanda 5 (17/10) no se miró en ninguna pantalla. Martín lo abre él.
- El teclado del iPhone sobre la hoja de la conversación.
- El typecheck COMPLETO: corrió el acotado a los archivos tocados (0 errores). El completo lo corre Actions.
