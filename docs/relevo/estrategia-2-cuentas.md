# Retomar: Estrategia 2 CUENTAS

**Dónde quedó:** 05/10/2026, ~11:40. Sesión `2b1a6e5d` de la cuenta **claude2**, cerrada
porque se agota la cuota del mes. Entra **claude1 (Mauricio)**.

Martín va a abrir este chat y preguntar **«cómo seguimos»**. Esto es lo que tenés que
saber para contestarle sin que te cuente nada.

---

## Qué es este chat

**Es el orquestador** — el «cerebro» de la memoria `cerebro-reparte-a-chats`. No construye
features: lee, reparte y verifica. Lo que hace:

1. Reconstruye el contexto de la ventana que la otra cuenta no vio (lectores en paralelo
   sobre commits, `docs/hallazgos-*.md` y `AGENTS.md`), y lo escribe en
   [`docs/relevo.md`](../relevo.md).
2. Le manda a cada chat por tab su briefing con `send_message`.
3. Cuida el protocolo de las dos cuentas: el marcador, los trailers, las sesiones paralelas.

---

## En qué está trabajando Martín AHORA, y dónde quedó cada uno

Los tres chats cerraron el 05/10 ~11:30, **todos con el árbol en verde, pusheado y
desplegado**. Cada uno escribió su propio briefing: leé el que corresponda antes de
contestar sobre su área.

| Chat | Dónde quedó | Espera de Martín |
|---|---|---|
| **CRM** — [`crm.md`](crm.md) | La ficha sin botón «Editar», **verificada**: un bug arreglado (`1c08d4d7`) y **uno abierto con su razón**. Tablero `Feature: CRM`: hoy cerró #627 y dejó al 50% #800, #18, #40, #671, #701 y #19 | Sí — tiene su propia sección «Lo que espera una decisión de Martín» |
| **Chatbot** — [`chatbot.md`](chatbot.md) | Los **nueve puntos** del editor de `/chatbot`, hechos y verificados en el navegador (30/30 con el arnés). `53ad4ad0`, Ready. Mig **`0192`** aplicada y verificada contra PostgREST | **Sí, y es lo más concreto:** el «**por tiempo**» de una secuencia **lo decidió él**, porque el pedido decía «las 2 opciones» sin definirlo. Dejó escrita la lectura alternativa y qué cambiaría si era ésa (el control, no el motor) |
| **Customer Success** — [`customer-success.md`](customer-success.md) | El **kanban de la entrega de un servicio** andando de punta a punta y como vista por defecto. Diez commits, último `50a2a672`, Ready. Mig `0188` aplicada | Sí — las **secuencias de nutrición** de la entrega: el motor espera un EMBUDO y esto tiene un PRODUCTO. Y el programa de Mauricio (abajo) |
| **Perro Guardián** — [`tareas-llamada-mauricio.md`](tareas-llamada-mauricio.md) | Cerró antes, 10:30. Cosechó en `docs/hallazgos-planes-y-cobro.md` (área nueva) | Sí — la proyección (abajo) |

La idea del hilo del Chatbot, que vale como norte del área: **`/chatbot` y `/mensajes` tienen
que ser la MISMA pieza, no dos pantallas parecidas.**

---

## ⚠️ Lo que NO se toca sin que Martín lo diga

1. **`docs/proyeccion-04oct.md` NO se carga al tablero.** Está sin cargar a propósito: se le
   preguntó y no contestó. El 03/10 una corrida aplicó al tablero el plan de una llamada y
   le **pisó diez deadlines que él había depurado a mano catorce minutos antes**; hubo que
   revertirlos (`3cc5ecb2`). Si leés el documento y lo cargás sin preguntar, repetís eso
   exacto. La regla está en `AGENTS.md:1292` — «la fuente más nueva puede ser el TABLERO
   MISMO».
2. **El programa de Customer Success de Mauricio** salió del producto entero el 26/09 y
   **dónde vive sigue sin decidir**. Se recupera de `07d07139^`. Su fase 1.1 venció el 27/09.
3. **El mensaje de 4 preguntas a Mauricio sigue sin mandarse**, y no hay llamada con él
   hasta el **15/10**: todo lo que dependa de él se destraba por mensaje o no se destraba.

## ⏳ Lo que tiene un reloj corriendo

**Los audios de WhatsApp caducan a los ~30 días.** Las fuentes que fijan el Norte del
negocio **no están versionadas**: viven sueltas en la carpeta padre y en Descargas. El
índice es [`docs/fuentes-fuera-del-repo.md`](../fuentes-fuera-del-repo.md) — se escribió el
05/10 porque dos de las tres fuentes principales **no las nombraba ningún archivo del repo**,
incluida `audio-mau-04oct.txt`, que es la fuente de la proyección de arriba. El `.ogg` más
viejo de Descargas es del **21/08**.

---

## Cómo se reparte trabajo a los otros chats

Los chats por tab son **sesiones del Desktop**: `list_sessions` los lista por título
(«CRM», «Chatbot», «Customer Success», «Perro Guardián»…) y se les manda con
`send_message`. Con títulos repetidos, el de actividad más reciente.

**El reparto va por ARCHIVO, no por nombre de chat.** Para saber de quién es un archivo:
`search_session_transcripts` con su ruta. Tareas que tocan los mismos archivos van a UN chat
aunque sean de dos tabs, o se pisan.

Un brief útil lleva: de dónde sale, qué construir, dónde vive en el código, cómo se
verifica, de qué depende y de quién, qué archivos **no** son suyos, y dónde cosechar.

### Los límites, todos medidos — no los redescubras

- ⚠️ **No se puede ABRIR un chat nuevo desde acá.** No existe `start_session` en esta build.
  Si el destino no existe, lo abre Martín.
- ⚠️ **La lista de chats está partida POR CUENTA**, aunque los transcripts sean compartidos
  (`~/.claude/projects/<proyecto>/*.jsonl` tiene los de las dos). Un chat de la otra cuenta
  **no se puede reabrir ni mensajear**: `get_session` devuelve *not found*. Por eso existen
  estos briefings.
- ⚠️ **El id de la app y el del transcript son dos espacios de nombres distintos.** «Perro
  Guardián» es `local_50dc47b3…` para la app y `48dddbc4…` en el disco. Y el
  `lastActivityAt` **miente**: dio `01:35` para un chat que había commiteado a las `10:30`.
  **Para atribuir trabajo la única fuente es el commit**; si vas a decirle a una sesión qué
  estuvo haciendo, preguntáselo en vez de deducirlo.

---

## El protocolo de las dos cuentas, en cuatro líneas

1. La cuenta se lee de **`~/.claude/cuenta-activa.txt`**, nunca se deduce. Un hook de
   `SessionStart` la inyecta, pero **es una foto del arranque**: antes de firmar,
   `head -1 ~/.claude/cuenta-activa.txt`.
2. El trailer `Claude-Cuenta:` va **pegado** a `Co-Authored-By:`, sin línea en blanco, o git
   no lo parsea.
3. **Hay otras sesiones sobre el MISMO clon** (mismo `.git`, mismo índice). `git status`
   antes de commitear. Y ojo: **`git add <ruta>` no acota el commit** — se commitea todo el
   índice, incluido lo que otra sesión stageó. Para acotar de verdad: `git commit <ruta>`.
4. **`/tmp` está compartido** entre las sesiones. Todo temporal va al scratchpad de la
   sesión. La mitad cara es `git commit -F /tmp/msg.txt`: una colisión ahí commitea **el
   mensaje de otra sesión** con tu diff y tu trailer, y sale bien, así que nadie lo audita.

El detalle completo está en [`docs/dos-cuentas.md`](../dos-cuentas.md) y las reglas en
`AGENTS.md` → «Hay dos cuentas» y «La cosecha».

---

## Lo primero que conviene hacer al abrir

1. Leer [`docs/relevo.md`](../relevo.md) — el estado de los 248 commits de la ventana.
2. `git log --oneline -15` y `git status --short`. Al cierre quedó **un solo archivo sucio,
   `lib/workspace.ts`**, que es de la feature `replay` (mig `0191`) de **otra sesión**: no lo
   reclames como propio.
3. Contestarle a Martín **con las decisiones que lo esperan**, no con un resumen de lo hecho.
   Son cuatro: el «por tiempo» del Chatbot, las secuencias de la entrega, dónde vive el
   programa de Mauricio, y si se carga o no la proyección del 04/10.
