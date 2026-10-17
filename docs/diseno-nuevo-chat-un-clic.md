# Diseño: abrir un chat de Claude Code con un clic, desde MaKo

**Fecha:** 17/10/2026, de madrugada; corregido a la mañana con la medición. **Estado:** medido, en construcción.
**Dueño:** el chat «Ops Center».

> ⚠️ **Corregido el 17/10 con lo MEDIDO** (abajo, «Medido»): `detached` NO abre nada, y el primer mensaje NO va por la
> línea de comandos. Lo que vale es lo de «3. La PC».

**El pedido.** Martín, por el Cerebro (docs/relevo/cerebro.md, «Al Centro», punto 2): «un clic + el permiso de la PC»,
nunca pegar un comando en PowerShell. Hoy «Nuevo chat» del Centro arma `claude2 -n 'CRM'`, y Martín lo copia y lo pega
(app/admin/operaciones/NuevoChat.tsx, lib/runner.ts → `comandoNuevoChat`).

## En un minuto

- **Para las cuentas de TERMINAL (1, 2 y 3) se puede.** El clic en MaKo deja un trabajo firmado de una clase nueva,
  «abrir un chat», y la PC abre la ventana de PowerShell con el chat ya corriendo.
- **«El permiso de la PC» es el de Claude Code.** El Runner abre la ventana con un comando propio
  (`cartero.mjs abrir`). La primera vez, Claude Code le pide permiso a Martín en el chat Runner, y él elige «no volver a
  preguntar». Después, cada clic abre el chat en menos de 2 minutos (la vuelta del Runner).
- **Para la cuenta de la APP (la 4) NO se puede desde MaKo.** La app rechaza `start_session` en un turno que arrancó un
  mensaje de otra sesión o un evento automático. Los turnos del Runner son del cron, y los del Cerebro cuando le llega un
  trabajo son de un mensaje: los dos quedan afuera. Lo más cerca es que el Runner PROPONGA el chat (una tarjeta en la
  app) y Martín la toque ahí: dos clics, uno en MaKo y otro en la app. A medir.
- **El formato firmado no cambia de versión.** El trabajo «abrir» usa los campos que ya existen: `cuenta` (cuál),
  `titulo` (el nombre del chat) y `texto` (su primer mensaje). Sólo `destino` suma un valor fijo, `nuevo`, en lugar del
  id de una sesión.

## Lo que hay hoy (medido el 17/10)

- **El perfil que define `claude1`, `claude2` y `claude3` es el de Windows PowerShell 5.1**
  (`OneDrive\Documentos\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`). No hay `pwsh`, y `claude4` no existe
  (por eso `tieneTerminal`, lib/runner.ts). `powershell.exe -NoExit -Command …` carga ese perfil, así que la función
  existe en la ventana nueva.
- **El trabajo firmado** es `{v, id, texto, destino, cuenta, titulo, alcance, creado, vence}`
  (lib/operaciones-reglas.ts → `armarFirmable`). El servidor y el cartero lo validan cada uno con su función, y
  `tests/operaciones.test.ts` las compara (el test diferencial). `destino` tiene que ser `local_…` o `cli_…`
  (`DESTINO_RE`), y la columna `operaciones_pedidos.destino` es `text` sin restricción (migración 0285).
- **MaKo entrega sólo a los `entregables`**: los chats vivos con un Runner en su carpeta (`cicloCartero`,
  lib/operaciones.ts). Un chat que todavía no existe no está en esa lista.
- **Una sesión de la APP sí crea chats visibles** (`start_session`; hallazgos-operaciones, «La cuenta 4»), pero sólo en
  un turno que arrancó Martín.

## El diseño

**1. El trabajo «abrir».** Es el mismo payload v1, con:
- `destino: 'nuevo'`;
- `cuenta`: obligatoria, una de las cuentas de terminal que la PC declaró;
- `titulo`: obligatorio, el nombre del chat, con las reglas de `nombreValido` (lib/centro-chats.ts);
- `texto`: el primer mensaje, obligatorio como hoy. Si Martín no escribe nada, la pantalla pone el de siempre: «Hola,
  eres el chat <nombre>. Lee AGENTS.md y espera instrucciones.».

`DESTINO_RE` no cambia: `nuevo` se valida aparte, en las dos lecturas (servidor y cartero), con su caso en el test
diferencial.

**2. El servidor.** `encolarPedidoAction` lo acepta igual: la guarda (`puedeOperar`), la firma y el texto tal cual.
`cicloCartero` le entrega un `nuevo` sólo a un cartero que declara esa cuenta en su lista nueva `abre`. Si nadie la
declara, el trabajo queda «escrito», y la caja dice qué hacer para darle el permiso a la PC (abajo).

**3. La PC (cartero.mjs).**
- `ciclo` sube `abre`: las cuentas que tienen una fuente de terminal en el config (ya declaradas desde la 1.4.0) Y el
  permiso local prendido (`config.abrir = true`).
- `ciclo` reclama los `nuevo` y los deja en una cola local, `aperturas/<id>.json`. No abre nada por su cuenta: `ciclo`
  ya tiene permiso para correr, y abrir sin que la PC lo haya autorizado sería saltearse lo que pidió Martín.
- Un subcomando nuevo, `abrir`, toma cada apertura y verifica OTRA VEZ la firma contra las claves de la PC. Después
  escribe el primer mensaje en `aperturas/<id>.txt` y abre la ventana:

  ```text
  aperturas/<id>.cmd:   @echo off
                        powershell.exe -NoExit -EncodedCommand <base64 UTF-16LE de:
                          <cuenta> -n '<titulo>' 'Lee el archivo <ruta del .txt> y haz lo que dice: es el primer mensaje de Martín.'>
  spawnSync('explorer.exe', [<ruta del .cmd>])   (su código de salida no dice nada: devuelve 1 aunque abra)
  ```

  Las reglas de ese lanzamiento:
  - **Nunca por `cmd.exe`.** `cmd /c start` expande `%VAR%` y corta en una comilla doble, adentro del nombre.
  - **~~Con `detached`~~ NO: por el Explorador.** Medido el 17/10: un hijo `detached` lanzado desde la herramienta Bash
    de una sesión de la app MUERE al terminar la llamada (la herramienta corre en un job de Windows que mata a sus hijos).
    Lo que abre una ventana visible y duradera es escribir un `.cmd` con `powershell.exe -NoExit -EncodedCommand <b64>`
    y abrirlo con `explorer.exe <ruta del .cmd>`: el Explorador vive fuera del job. La ventana es de Windows Terminal
    (la consola por defecto de Windows 11), no de powershell.exe. El `.cmd` no lleva texto de nadie: sólo base64.
  - **El código de `explorer.exe` no dice nada**: devuelve 1 aunque abra bien. El acuse dice «se pidió abrir», no
    «abierto», y la prueba es que el chat aparezca en la lista en la vuelta siguiente.
  - **Con `-EncodedCommand`.** El comando no pasa por ninguna cita de la línea de comandos.
  - **El nombre va entre comillas simples con la comilla doblada**, como en `comandoNuevoChat`, y **sin comillas
    dobles**: la función del perfil hace `claude @args`, y Windows PowerShell 5.1 parte en varios argumentos un texto con
    `"` al pasarlo a un ejecutable. Un nombre con `"` se rechaza (en la firma, en las dos lecturas).
  - **`cuenta` sale de la lista de la PC**, nunca del texto.
  - **El primer mensaje NO pasa por la línea de comandos, ni siquiera leído de un archivo** (`(Get-Content …)` como
    argumento tiene el mismo problema de las comillas dobles: un `" --algo"` adentro terminaría siendo una opción de
    Claude). La PC lo escribe en `aperturas/<id>.txt`, y el chat arranca con un pedido FIJO que arma ella: «Lee el
    archivo <ruta> y haz lo que dice: es el primer mensaje de Martín». La ruta es la carpeta fija más el id del trabajo.
- El acuse es `entregado` cuando la ventana se lanzó, con el motivo «Abierto en la terminal de la cuenta 2». La PC no
  sabe si el chat arrancó bien: lo dice así, no «listo».

**4. El Runner.** Sus instrucciones (`INSTRUCCIONES_RUNNER`, lib/runner.ts) suman un paso: si `ciclo` dice que hay
aperturas, correr `node ~/.claude/operaciones/cartero.mjs abrir`. Eso es lo que activa «el permiso de la PC»: la
primera vez Claude Code lo pregunta, y Martín elige «no volver a preguntar».

**5. La pantalla.** «Nuevo chat» (Centro y Second Brain) tiene el nombre, la cuenta (sólo las de `abre`) y un primer
mensaje opcional, con el botón **«Abrir»**. Mientras ninguna PC declare `abre`, el botón dice qué hacer: «Prende la
apertura en la PC para abrir chats desde aquí» (la línea para el Runner, abajo). Copiar el comando queda como segunda
opción, más chica, hasta que la apertura ande.

**Prender la apertura en la PC** se hace UNA vez, en el chat Runner de la app. Martín le escribe «prende la apertura de
chats», y el Runner corre `cartero.mjs abrir-permitir`. Ése es el permiso de la PC: lo da Martín, en su PC, y se
apaga igual (`abrir-permitir off`). El texto exacto se copia desde la pantalla, como las instrucciones del Runner.

## Seguridad (lo que no se negocia)

- **La confianza sigue en la PC.** La PC abre sólo lo firmado con una clave que ella aceptó, y sólo para una cuenta
  que ella declaró. El servidor no puede pedir una apertura sin firma, ni elegir el comando.
- **Del texto no se ejecuta nada.** El nombre se valida y va citado; la cuenta sale de la lista local; el primer
  mensaje va por un archivo. Un `titulo` con `'; Remove-Item …` queda como nombre literal o se rechaza, con test.
- **El permiso se apaga**: `abrir-permitir off`. Un `nuevo` que llega con el permiso apagado queda «escrito», no se
  pierde.

## Medido (17/10/2026, ~07:15 UTC, con el OK de Martín)

Lo midió el primer chat «Ops Center» desde la herramienta Bash de una sesión de la app, la misma que usa el Runner. El
detalle está en docs/hallazgos-operaciones.md («El clic, medido»).
- **`detached` no sirve**: el proceso muere al terminar la llamada, sin ventana y sin correr nada.
- **Atado, el comando corre y carga el perfil**: `claude2` existe en esa ventana.
- **Por el Explorador SÍ**: un `.cmd` abierto con `explorer.exe` deja una ventana de Windows Terminal en pie, con el perfil
  cargado. `explorer.exe` devuelve 1 igual.

**Sin medir todavía:**
- que `claudeN -n '<nombre>' '<pedido>'` arranque la sesión interactiva con ese pedido. La ayuda de la CLI dice que
  `claude [prompt]` lo hace; lo confirma el primer clic de verdad;
- **el caso de la app**: si un Runner de la app puede dejar la PROPUESTA de un chat (la tarjeta), y cuántos clics le
  quedan a Martín.

## Archivos

- **Servidor y PC:** lib/operaciones-reglas.ts (el `nuevo` en la lectura y su test diferencial) ·
  scripts/operaciones/cartero.mjs (`abre`, `aperturas/`, `abrir`, `abrir-permitir`; VERSION nueva, reinstalar) ·
  lib/operaciones.ts (`cicloCartero`: entregar `nuevo` a quien lo declara) · lib/runner.ts (las instrucciones).
- **Pantalla:** app/admin/operaciones/NuevoChat.tsx, CentroApp.tsx, ChatsMovil.tsx y la sección «Claude Code» del Second
  Brain (hoy no tiene «Nuevo chat»).
- **Tests:** tests/operaciones.test.ts (el diferencial y la guarda) y tests/cartero-carpetas.test.ts (la PC entera,
  contra un servidor falso).
- ⚠️ cartero.mjs está instalado en `~/.claude/operaciones` y lo corre el chat Runner. Cambiarlo es como tocar un hook
  compartido: se avisa ANTES al Cerebro y al Runner, y el Cerebro lo reinstala.
