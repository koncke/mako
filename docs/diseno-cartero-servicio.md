# El cartero como servicio de la PC (diseño del 24/10/2026; no se construyó el 26/10, se retomó el 30/10)

> ⚠️ **Lo que compra y lo que NO compra, antes de leer lo demás.** El servicio NO es «el Runner ya no se muere»: es **«si el
> Runner se muere, se ve»**. Sin un chat abierto sigue sin entregarse nada y sin medirse la cuota, porque `SendMessage` y
> `get_usage` sólo los puede llamar un chat. El servicio sube lo que sale de archivos (chats, turnos, pasos, acuses) y hace
> visible la ausencia, pero no reemplaza a un chat. El cartel rojo lo decide MaKo, no el servicio: §4 dice qué agrega cada parte.

> **Activarlo es de Martín.** Se construyó y se probó con el registro simulado: en la PC de verdad no corrió nunca. Hacen falta
> dos pasos, y cada uno lo aprueba él (§4): la clave Run de Windows (`cartero.mjs instalar-servicio`) y el hook `SessionStart`
> (§2.3, sin construir). Un mensaje de otro chat no los autoriza. El `.exe` con Bun (§2.4) no se abre ahora: si hace falta, va
> como pregunta al Cerebro.

Martín, por el Cerebro (24/10): **«¿Podemos hacer que el cartero sea un "servicio" con la app de MaKo en desktop?»**

El 24/10 el cartero estuvo **15 horas muerto** (23/10 23:47 → 24/10 14:10): Martín forzó el apagado de la PC (se trabó
entera) y nadie lo levantó. El Ops Center quedó sin actualizaciones, y **cuatro pedidos suyos quedaron sin entregar**. Uno
llevaba una semana: el del 17/10 (el audio que se duplicaba), que estuvo siete días en «escrito» sin que nadie lo notara.

**La respuesta corta: sí, la mitad.** La mitad que se puede es justo la que falló.

## 1. Lo que hace hoy el cartero, medido en el código

`scripts/operaciones/cartero.mjs` (2123 renglones) corre en la PC de Martín. Su `ciclo` hace cuatro cosas:

| Paso | Qué es | ¿Necesita un chat de Claude? |
|---|---|---|
| **Medir** | Lee los registros de sesiones de cada carpeta (`<dir>/sessions/*.json`), los transcripts (turnos nuevos, pasos de los chats ocupados) y la cuota de cada cuenta. | **No**: archivos locales. |
| **Subir** | Un `POST /api/operaciones/cartero` con los chats, los turnos, los pasos, el uso, y los acuses, cierres y preguntas que los chats dejaron en `~/.claude/operaciones/`. | **No**: una llamada HTTPS. |
| **Reclamar** | MaKo le devuelve los pedidos de los chats que algún Runner puede entregar (`entregables`). El cartero verifica la firma y los deja en el buzón. | **No**, pero sólo tiene sentido si alguien va a entregar. |
| **Entregar** | Manda cada pedido con `SendMessage` y anota el acuse. | **SÍ**: un script no puede escribirle a una sesión de Claude (el encabezado del cartero, renglones 11 y 28). `SendMessage` sólo llega a las sesiones de la misma carpeta de config; `exigirRunner` (renglón 1053) frena a un chat que no se llama «Runner». |

**¿Quién lo dispara hoy?** El chat «Runner» de cada carpeta, con un cron de SESIÓN que corre `vigilar`. Si no hay un chat
Runner abierto, no corre nada: ni se mide, ni se sube, ni se entrega. **Ése es el modo de falla del 24/10.**

**Lo que existía para la ausencia el 24/10, y no alcanzó:**
- la lista del Ops Center mostraba «Sin noticias del Runner desde las HH:MM» (`sinNoticiasDesde`, PiezasCentro.tsx). Era un
  renglón GRIS, sólo en la computadora, y no decía cuántos pedidos de Martín esperan (el estado de la PC va en el Uso desde el 31/10: `estadoDeLaPc`, sin desplegar);
- cada mensaje que tarda dice por qué (`EstadoDelEnvio.porQue`, lib/centro-chats.ts). Eso se ve sólo en el chat abierto: el
  pedido del 17/10 estaba en un chat que Martín no volvió a abrir.

## 2. El diseño

### 2.1 El servicio MIDE y SUBE. Nunca reclama ni entrega.

- Un comando nuevo, `cartero.mjs servicio`: un proceso que arranca con Windows y da una vuelta de **medir y subir** cada 2
  minutos.
- Manda `entregables: []`. Así MaKo no le reclama ningún pedido, y el buzón no se llena de trabajos que nadie va a mandar.
- **Nunca se cae solo**, con el molde de `mako-pc`: un error de red o de la base espera y reintenta; no hay `process.exit`.
- **Una vuelta a la vez en la PC.** El servicio y un Runner tocan los mismos archivos (las marcas de los turnos, los acuses):
  `~/.claude/operaciones/vuelta.lock`, con el pid y una vigencia de 3 minutos. Quien lo encuentra tomado y vigente, saltea
  su vuelta.
- Sube `servicio: { version, desde }` en el POST. MaKo distingue «hay noticias de la PC» de «hay un Runner que entrega».
- **El servicio NO late como Runner.** Hoy `vuelta()` llama a `latir(propio)` antes de todo, y ese latido es lo que hace
  contar a un chat como Runner (`carpetasConRunner`: el nombre solo no alcanza). Si el servicio corre la misma vuelta, un
  chat «Cartero» abierto y sin cron seguiría contando como vivo, y eso es justo lo que deja un `/clear` (medido el 24/10:
  docs/hallazgos-operaciones.md, «El `/clear` borró el cron del Cartero»). El servicio deja su latido aparte, y el del
  Runner lo escribe sólo la vuelta de un chat.
- **Y el latido que vale es el que llega a MaKo, no el archivo.** Si la PC se apaga o se traba, `latidos/*.json` deja de
  actualizarse y no lo mira nadie. Lo que dice la ausencia es `visto_at` del lado del servidor, con su hora (el cartel 1 de
  §2.2), y lo alimenta el POST del SERVICIO cada 2 minutos, no el chat.

**Cómo quedó construido (30/10/2026, cartero 1.25.0; hay cosas que el diseño no había visto):**
- **`abre: []` además de `entregables: []`.** Son dos reclamos aparte: con `abre` lleno, MaKo le da los chats nuevos, y un chat
  nuevo tomado sin nadie que corra `abrir` se pierde.
- **La lista vacía, nunca sin mandarla.** Sin la lista, `sanearEntregables` reclama todos los vivos (un cartero de antes).
- **Un proceso por vuelta.** El bucle sólo espera y lanza `servicio --una-vez`. Lo que falla, falla en el hijo. Y cada vuelta corre
  el código que está en disco: un proceso de días, con la versión de hace días, le pisaría la `version` al Runner cada 2 minutos.
- **`carpetasConRunner(cfg, null)`.** Un Runner cuenta su propia carpeta siempre. El servicio no tiene carpeta: si contara una,
  sus chats subirían `runner: true` sin nadie que les entregue.
- **Si igual le dan trabajo, lo devuelve** con «Nadie entrega en la PC», sin tocar el buzón.
- **`vigilar` reintenta la vuelta que salteó.** El lock es de TODA la PC, y antes los Runners de carpetas distintas corrían a la
  vez: sin el reintento, el que llega segundo en el mismo minuto no sube nunca su cuenta. Vale aunque el servicio no esté instalado.
- **Vence por la fecha del archivo, no por su contenido:** renovar no reescribe, y nadie lee un lock a medio escribir. Un pid
  que ya no existe no retiene. Quien lo vence se lo quita con un rename y mira lo que se quitó.
- **Un chat no corre el servicio** (`esUnChat`: se quedaría colgado), y `exigirRunner` no cambió: `servicio` no pasa por `vuelta()`. Tampoco corre `instalar-servicio` ni `quitar-servicio` (1.26.1): es una
  baranda, no una llave. Y `instalar-servicio` le pregunta a MaKo (`?servicio-listo=1`) si ya están la migración y el deploy.
- **La vuelta tiene un presupuesto de 100 s** (1.26.1): pasado eso no empieza otra cuenta, suelta el lock y la próxima sigue por la que faltó (`servicio-turno.json`). Un corte por el tope de 150 s no es una falla.
- **Con error nunca insiste más que sano** (`esperaDelServicio`: 5 s, 10 s, 30 s, 60 s, 2 min, 4, 8, 10), y con el token rechazado espera 10 minutos o a que se pegue otro. Una falla es lo que manda: el bucle no se apaga por ella.
  Lo de §2.3 (dejar pasar a cualquier chat si no hay Runner) sigue sin hacer.

### 2.2 La AUSENCIA se ve, y se mide desde el SERVIDOR

**31/10/2026, Martín: «Si, ponlo pero en USO».** No hay carteles rojos arriba: lo que sigue se dice adentro del panel de Uso, con `estadoDeLaPc`, como hecho con su edad («Sin noticias de la PC desde las 23:47», «Sin Runner desde…»).

Una PC trabada o apagada no puede avisar que se cayó: su silencio se tiene que notar desde otro lado. MaKo ya guarda cuándo
llegó la última vuelta de cada cuenta (`visto_at`). Con eso, el Ops Center (computadora Y teléfono) dibuja **arriba, en
rojo**, uno de dos carteles:

1. **«La PC no da noticias desde las 23:47»**: ninguna vuelta, ni del servicio ni de un Runner. Es la PC apagada, trabada,
   o el servicio caído.
2. **«Nadie entrega en la PC: N pedidos tuyos esperan (el más viejo, de hace 7 días)»**: hay vueltas (el servicio sube),
   pero ningún Runner. Lo cuenta MaKo con sus propios pedidos en «escrito», sin pedirle nada a la PC.

El renglón gris de hoy (`sinNoticiasDesde`) pasa a ser el cartel 1. Los dos llevan qué hacer («Abre el Runner de la
cuenta 1»), con el comando que ya muestra `PanelRunner`.

### 2.3 Entrega cualquier chat que arranque, no sólo uno llamado «Runner»

> **4/11/2026: esto no se construyó, lo reemplaza la guardia.** Un chat que abre no se puede quedar entregando, y nadie abre un chat cuando Martín escribe desde el teléfono. Sin Runner, entrega la tarea programada `runner-guardia-<cuenta>`, de a una vuelta por corrida: `scripts/operaciones/guardia-runner.md`. El Runner sigue siendo un chat: una corrida no tiene canal de mensajes.

Hoy la entrega depende de que exista un chat con el nombre exacto «Runner» y con su cron andando. Si no está, nadie mira el
buzón. El cambio:

- El hook `SessionStart` de cada carpeta (`~/.claude/bitacora-sesion.sh`) pregunta lo mismo que `vigilar` (`hayAlgo`, hoy
  sin comando propio: `cartero.mjs hay`, que todavía no existe). Si hay pedidos para esa carpeta y **ningún Runner con latido fresco**,
  agrega al contexto del chat que arranca: «Hay N pedidos de Martín para
  entregar: corre `cartero.mjs pendientes` y mándalos con SendMessage».
- `exigirRunner` deja pasar a cualquier chat cuando no hay un Runner vivo en su carpeta. Para que no lo manden dos chats, se
  toma el `vuelta.lock` y la mano de cada archivo (`tomar`, que ya existe).
- El Runner sigue siendo lo normal: es el único que da vueltas solo, con su cron.

### 2.4 Cómo arranca: UNA forma para la PC (a decidir con el chat de IA del cliente)

La app de escritorio (`mako-pc`, el instalador 0.4.x y el programa 0.5.0) es del chat «IA del cliente». El cartero y el Ops
Center son de este chat. Para que no aparezcan dos formas de arrancar algo con Windows:

- **Lo que se comparte:** el mecanismo de `mako-pc`. Es la clave `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (sin
  pedir administrador), un ejecutable «de ventana» armado con Bun (sin consola, `publicar-binarios.mts`) y el bucle que nunca
  se cae solo.
- **Lo que NO se comparte: el programa.** El cartero NO va adentro de `mako-pc`. Va como un ejecutable aparte,
  `mako-cartero.exe`, con su valor de Run, «MaKo Cartero». Tres razones:
  1. `mako-pc` promete que **no toca `~/.claude`** (su encabezado, y tests/ia-pc.test.ts): es la PC del CLIENTE, «sólo el
     cerebro, nunca las manos». El cartero lee `~/.claude` entero (sesiones y transcripts). Meterlo adentro rompe esa promesa
     en el binario que instala cada cliente.
  2. **La app se distribuye a los clientes.** El cartero es de Martín: lleva pedidos a sus chats de Claude Code, que ningún
     cliente tiene. Un módulo «apagado» adentro del binario del cliente igual viaja. Un ejecutable aparte, que no está en el
     instalador ni en las descargas públicas, no viaja.
  3. Los dos se actualizan a ritmos distintos: la 0.5.0 está retenida hasta medir Codex, y el cartero se toca casi todos los
     días.
- **Quién lo instala:** `cartero.mjs instalar-servicio`, que corre Martín en su PC. Escribe la clave Run, con el lanzador de abajo
  mientras no haya `.exe` (lo que hace paso por paso, en §4). `cartero.mjs quitar-servicio` la saca.
- **La doble llave:** el servicio sólo arranca si existen `~/.claude/operaciones/config.json` con un token `mkop_…` (los
  acuña /admin/operaciones, sólo el super admin) y `claves.txt`. En la PC de un cliente no existe ninguno de los dos: aunque
  alguien copiara el ejecutable, no tiene a quién hablarle.

**Mientras no haya `.exe` (30/10/2026):** `instalar-servicio` escribe la clave Run con un lanzador,
`wscript.exe //B //Nologo "~/.claude/operaciones/mako-cartero.vbs"`, que abre `node cartero.mjs servicio` sin ventana. Con `node`
directo en la clave Run queda una consola abierta. Sirve porque el servicio es sólo de la PC de Martín, que ya tiene Node. El
límite: Windows está retirando VBScript. El código se probó con el registro simulado: **ni el lanzador ni la clave corrieron en la
PC de verdad.** Si se arma el `.exe`, `vueltaAparte` tiene que relanzarse a sí mismo, y se pierde «cada vuelta corre lo que está en
disco». **La primera pregunta para ese chat: ¿hace falta el `.exe`, o alcanza con esto?**

**Para decidir con el chat de IA del cliente** (no está abierto el 24/10; va en su relevo):
1. ¿Se reusa `publicar-binarios.mts` para armar `mako-cartero.exe`, o el cartero arma el suyo con el mismo Bun?
   La propuesta: un objetivo más del mismo script, que NO lo sube a las descargas públicas.
2. ¿`mako-pc` y `mako-cartero` comparten el código del bucle («nunca se cae solo», la espera sin red), o cada uno el suyo?
   La propuesta: compartir `esperaSinRed` y `esRevocado` como módulo, para no tener dos copias que se separan.
3. En la Mac (MaKo.app, 0.4.2): ¿el mismo patrón con un LaunchAgent? Hoy Martín usa Windows, así que el cartero no lo
   necesita todavía.

### 2.5 Lo que NO se resuelve, y hay que decirlo

- **Sin ningún chat abierto, nada se entrega.** El servicio no puede escribirle a una sesión de Claude: no hay una vía
  documentada, y los named pipes del registro son el protocolo interno de Claude Code. Lo que cambia es que la espera SE VE
  (el cartel 2) y que el primer chat que se abra entrega (2.3, sin construir: hoy sólo entrega un Runner).
- **Sin la PC prendida, tampoco.** El cartel 1 lo dice desde el servidor.

## 2.6 El contrato del POST y lo que tiene que hacer MaKo (30/10/2026)

**Lo que manda una vuelta del servicio.** Lo mismo que una de Runner, con tres diferencias: `entregables: []`, `abre: []` y
`servicio: { version: '1.25.0', desde: '<ISO: cuándo arrancó el proceso>' }`. Una de Runner nunca trae `servicio`. La PC no
espera nada nuevo en la respuesta. Un servidor de hoy ignora el campo (`cicloCartero` no lo lee): no se rompe, **pero miente**.

**Lo que pisa esa vuelta en `operaciones_carteros`, medido en `cicloCartero`:**

| Campo | Qué pasa | ¿Problema? |
|---|---|---|
| `entregables` | No se guarda: sólo vale en ese POST. El Runner manda los suyos en su vuelta | No |
| `chats` | La misma foto. `runner` sale honesto (nombre + latido fresco), y es lo que lee `hayParaElCartero` | No |
| `claves`, `titular`, `pasos` | Los mismos archivos de la PC | No |
| `cuota` | Se manda con su `medido`. El servicio no mide: eso sólo lo hace un chat con `get_usage` | No |
| acuses, cierres, preguntas, turnos | Se suben y se borran igual, bajo el lock | No |
| **`visto_at`** | Queda fresco sin ningún Runner, y **`carteroVivo` lo lee como «hay Runner»** | **SÍ** |
| **`version`** | La pisa el servicio. Hoy es la misma (el mismo archivo); con un `.exe` podría no serlo | **SÍ** |
| vencer | Un `escrito` de 15 días y un `tomado` de 2 horas vencen en cualquier POST. Antes, sin Runner no vencía nada | **Avisar** |

**Lo que necesita MaKo, y va ANTES de `instalar-servicio`:**
1. Migración (sólo agrega): `operaciones_carteros.runner_visto_at timestamptz` y `servicio jsonb`, con
   `runner_visto_at = visto_at` en lo que ya hay.
2. `cicloCartero`: sanear `e.servicio` (version corta, `desde` con fecha válida; si no es un objeto, no es del servicio). Sin él,
   como hoy y además `runner_visto_at`. Con él: `visto_at`, `chats`, `claves` y `cuota` como hoy, más `servicio: { version, desde,
   visto_at }`, y **sin tocar `version` ni `runner_visto_at`**. Un upsert que no los nombra los deja como están.
3. Separar las dos preguntas. **«¿Hay noticias de la PC?»** sigue con `visto_at`: `sinNoticiasDesde`, que pasa a ser el cartel 1.
   **«¿Hay un Runner?»** pasa a `runner_visto_at`: `PanelRunner.tsx` (82, 99), `Uso.tsx` (175, 243), `CentroAppMovil.tsx` (37),
   `operaciones.run.ts` (83), `lib/centro-chats.ts` (`envioDe` 1067, `porQue` 1123), `lib/centro-cuentas.ts` (38) y
   `lib/operaciones-reglas.ts` (887). `leerCarteros` tiene que leer las columnas nuevas.
4. Los dos carteles de §2.2. El cartel 2 sale ANTES de vencer: con el servicio, vencer corre siempre, y vencer es mudo.

**`hayParaElCartero` no cambia:** su comentario dice «entregables», pero lee `chats` (`vivo`, `runner`), y eso el servicio lo
sube honesto. Un Runner vivo sigue recibiendo sus pedidos, y un chat sin cron cuenta 0.

**Cómo quedó construido (30/10/2026, sin desplegar):**
- **Migración `0355_operaciones_runner_visto.sql`, sin aplicar.** Sin ella, todo anda como antes y `visto_at` responde las dos preguntas.
- **En el código, `vistoAt` sigue siendo «el Runner»** y sale de `runner_visto_at` (`vistoDeLaFila`, lib/operaciones-reglas.ts). `noticiasAt` es
  «la PC» o «de cuándo es la foto», y lo leen `sinNoticiasDesde`, `cartelDeLaPc`, el `viejo` de `completarChats` y `preguntaDeChatCerrado`. Es el revés de lo que proponía el
  punto 3: en vez de cambiar nueve lectores de `vistoAt`, cambian esos. Los demás preguntan por el Runner, y uno que se olvide queda del lado seguro. **`carteroVivo` y los
  demás renglones de la lista no se tocaron.**
- **El servicio no reclama, aunque traiga la lista:** `cicloCartero` lo fuerza (`vivos = []`, sin `abre`). La PC igual lo devuelve.
- **El cartel 2 cuenta TODOS los «escrito»**, también los de un chat abierto y los de un chat nuevo: sin Runner no sale ninguno. Sin pedidos, igual lo dice,
  sin número. **Con un Runner andando en alguna cuenta se calla, y lo demás lo dice el cartel de los mensajes** (CartelLimbo.tsx), con su causa: un chat cerrado, el Runner de OTRA cuenta (también con su foto vieja), un chat por abrir o vencido.
- **El comando se copia sólo en la computadora** (`COMANDO_TERMINAL`, con su `tieneTerminal`). En el teléfono no hay dónde pegarlo.

**Y el orden, sin moverse:** migración → deploy del servidor → `instalar-servicio`.

## 2.7 Lo que espera un chat cerrado se lo dice el Runner al Cerebro (cartero 1.26.0, 30/10/2026)

El cartel se lo dice a Martín; esto, al chat «Cerebro» vivo. Es el molde de `mensajeTicketNuevo` (texto FIJO que arma la PC, sin firma), con
`pedidosSinChatVivo` (la regla del cartel). Vive en `lib/limbo-al-cerebro.ts` y en `cartero.mjs` (`mensajeLimbo`), con test diferencial.

- **Sólo lo que una foto AL DÍA dice cerrado.** Su texto fijo dice «espera un chat cerrado»: con la cuenta callada, lo que falta es su Runner, y eso lo dice el cartel.
- **Sale una vez por pedido, y otra con 3 días para vencer.** El que aparece recién cerca de vencer sale una sola vez, con ese texto.
- **Sólo id, cuenta y fecha.** La consulta ni lee el texto ni el título: no están firmados para este destino. El Cerebro lo lee con
  `scripts/tickets.ts mensaje <id>`, que sólo lee, y si hace falta le pide a Martín que se lo mande desde el cartel: la firma fija el destino.
- **Sin columnas: lo avisado lo sabe la PC.** MaKo ofrece la lista entera en cada vuelta (`limbo`), y la PC arma un id fijo por (pedido, etapa) y lo saltea si
  ya está en el buzón o en `entregados/`. Por eso sale cuando el Cerebro esté, y no sale dos veces con dos Cerebros abiertos.
- **El tope va en la PC** (5 por vuelta). Con un tope en MaKo, los primeros ya avisados tapan a los demás para siempre.
- **`hayParaElCartero` no lo cuenta:** MaKo no sabe qué ya se avisó, y `vigilar` saldría en cada vuelta. No es urgente: sale en la vuelta del cron.
- **Un Runner de antes no recibe nada** (`VERSION_CARTERO_LIMBO`), y una vuelta del servicio tampoco: no tiene entregables.
- **Nunca un acuse con el id del pedido:** el aviso lleva su propio id. Con el del pedido, un acuse le podría pisar el estado si está `tomado`.

**Lo que no resuelve:** si el aviso quedó sin acuse 30 minutos en el buzón (`BUZON_VENCE_MS`), se vuelve a ofrecer. Puede salir dos veces. Es un texto fijo: se prefirió eso a perderlo.

## 3. El plan (escrito para el 26/10; ese día no se hizo, y se retomó el 30/10)

**Estado (30/10/2026):** el 1, la parte de código del 3 y el 2 están hechos, sin subir (`scripts/operaciones/cartero.mjs` 1.26.1,
`tests/cartero-servicio.test.ts`, `tests/centro-cartel-pc.test.ts`, `tests/limbo-al-cerebro.test.ts`). Falta el `.exe` si hace falta (§2.4), el 4 y el 5.
Lo demás que quedó sin hacer, con su archivo: docs/hallazgos-operaciones.md, «Seis días sin Runner».

1. `cartero.mjs servicio`: la vuelta de medir y subir, con `entregables: []`, el `vuelta.lock` y su test (medir sin
   reclamar; dos vueltas a la vez, una espera).
2. MaKo: `servicio` en el POST, y los dos carteles en la computadora y el teléfono, con su test (la PC apagada → cartel 1;
   vueltas sin Runner y un pedido viejo en «escrito» → cartel 2).
3. Con el chat de IA del cliente: el ejecutable (`mako-cartero.exe`) y `instalar-servicio`, con el mecanismo de `mako-pc`.
4. El hook `SessionStart` y `exigirRunner` (2.3), al final: es lo que toca cómo se comportan todos los chats.
5. Probado rompiéndolo, en la PC de verdad: matar el servicio (cartel 1 a los 4 minutos, `CARTERO_VIVO_MS`), cerrar el Runner con
   un pedido escrito (cartel 2), y reiniciar Windows (el servicio vuelve solo).

## 4. La activación: lo que aprueba Martín (30/10/2026)

Nada de esto corrió. Son decisiones de él, una por una, y ninguna la toma un chat.

**Antes, sin tocar su PC:** subir la rama, aplicar la migración 0355 (sólo agrega) y desplegar. **Eso solo ya compra casi todo lo
que se ve:** con todos los Runners parados, `cartelDeLaPc` dice «La PC no da noticias desde…», y el cartel de los mensajes dice qué
espera y por qué, sin instalar nada. Lo decide MaKo con lo que ya tiene. El servicio agrega dos cosas: separar «la PC está apagada» de
«está prendida y no hay Runner», y tener al día la foto de los chats y lo que dejaron (turnos, pasos, acuses).

**Paso 1, la clave Run (construido, nunca corrió fuera de un test).**
- **Qué corre:** en una ventana de PowerShell de Windows, `node <clon>\scripts\operaciones\cartero.mjs instalar-servicio`.
- **Qué escribe:** copia `cartero.mjs` a `~/.claude/operaciones/`, deja ahí `mako-cartero.vbs`, y agrega el valor «MaKo Cartero» en
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. No pide administrador. Arranca con el próximo inicio de Windows, y el comando
  devuelve cómo arrancarlo sin esperar.
- **Se niega si:** corre desde un chat, falta el token o `claves.txt`, la PC no tiene cuentas, o MaKo no contesta que ya entiende el
  servicio (`?servicio-listo=1`: sin la migración y el deploy, no instala).
- **Lo que trae con él:** esa copia es la misma que corre el Runner. Al instalar, los Runners pasan a la versión nueva, y al Cerebro le
  llegan de una los mensajes que esperan, de a 5 por vuelta (9, medidos el 30/10). Si quiere descartar alguno, antes.
- **Lo que cuesta:** una vuelta cada 2 minutos relee sesiones y transcripts de todas las cuentas, en una PC con 16 GB llenos. No se midió
  cuánta RAM pide. Y vencer un pedido pasa a correr aunque no haya nadie que entregue (§2.6).
- **Se saca con** `cartero.mjs quitar-servicio`, también desde PowerShell.
- **Sin medir:** si la terminal de la app de Claude le pasa `CLAUDECODE` a su consola, el comando le va a pedir otra.

**Paso 2, el hook `SessionStart` (sin construir).** Es lo que hace que entregue cualquier chat que arranque (§2.3). Falta `cartero.mjs hay` y
aflojar `exigirRunner`. Tocaría `~/.claude/bitacora-sesion.sh` de cada carpeta, que corre en TODOS los chats. Lo que aprueba es eso: que
un chat cualquiera, si no hay un Runner vivo, reciba la orden de entregar.

**Paso 3, probarlo en la PC de verdad:** el punto 5 del plan, recién con el paso 1 hecho.

**Una pregunta, no una tarea (no se abre ahora):** ¿hace falta `mako-cartero.exe` con Bun, o alcanza con el lanzador y `node`, ya que el servicio
es sólo de la PC de Martín? Lo que la podría cambiar: Windows está retirando VBScript. Va para el chat de IA del cliente (§2.4).
