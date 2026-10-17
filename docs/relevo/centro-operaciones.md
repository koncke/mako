# Relevo — Centro de Operaciones (17/10/2026; cuenta 4, `claude4`)

Lo retomó el chat «Centro de Operaciones» de la cuenta 4 el 17/10 a la madrugada, donde lo dejó el de la cuenta 3
(16/10, 95% semanal). Lo que costó cada cosa está en `docs/hallazgos-operaciones.md` (la tanda 5, la entrada del
17/10), `docs/hallazgos-second-brain.md` y `docs/hallazgos-mobile.md`. Lo pedido, textual, está en
`app/admin/dev/second-brain/bitacora.ts` y `app/admin/dev/centro-operaciones/bitacora.ts`.

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
