# Diseño: abrir un chat de Claude Code con un clic, desde MaKo

**Fecha:** 17/10/2026, de madrugada. **Estado:** diseño, sin construir. **Dueño:** el chat «Centro de Operaciones».

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
  spawn('powershell.exe', ['-NoExit', '-EncodedCommand', <base64 UTF-16LE de:
      <cuenta> -n '<titulo>' (Get-Content -Raw '<ruta del .txt>')>], { detached: true, stdio: 'ignore' })
  ```

  Las reglas de ese lanzamiento:
  - **Nunca por `cmd.exe`.** `cmd /c start` expande `%VAR%` y corta en una comilla doble, adentro del nombre.
  - **Con `detached`.** En Windows, el hijo `detached` tiene su propia ventana (la doc de Node).
  - **Con `-EncodedCommand`.** El comando no pasa por ninguna cita de la línea de comandos.
  - **El nombre va entre comillas simples con la comilla doblada**, como en `comandoNuevoChat`.
  - **`cuenta` sale de la lista de la PC**, nunca del texto.
  - **El primer mensaje no pasa por la línea de comandos**: PowerShell lo lee del archivo.
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

## A medir antes de construir

- **Que la ventana se vea.** Hay que confirmar que un `powershell.exe` lanzado `detached` por node, desde la
  herramienta Bash del Runner de la app, abre una ventana visible en el escritorio de Martín. No se probó: a las 4 de
  la mañana le habría aparecido una ventana en la pantalla.
- **Que `claudeN -n '<nombre>' '<primer mensaje>'` arranque el chat con ese mensaje**: `claude [prompt]` abre la sesión
  interactiva con el pedido, según la ayuda de la CLI. Hay que mirarlo con la función del perfil.
- **El caso de la app**: si un Runner de la app puede dejar la PROPUESTA de un chat (la tarjeta), y cuántos clics le
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
