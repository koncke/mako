# La guardia del Runner (4/11/2026)

Vive en `~/.claude/operaciones/guardia-runner.md`. Copia versionada: `scripts/operaciones/guardia-runner.md`.

Martín: «Te lo tengo que pedir cada que entro en una cuenta y eso debería ser automático. Y supongo que si no está el runner tampoco recibe mensajes, eso no debe pasar».

## Si la corrida te mandó acá: no hay Runner, y esta vuelta la das vos

El Runner de esta cuenta no está. **Una corrida no puede ser el Runner** (medido el 04/11): no tiene canal de mensajes, y su `SendMessage` a `uds:` contesta «Cross-session messaging is not available in this session». No renombres este chat, no crees cron y no armes Monitor. Das una vuelta con `send_message`, que sí anda, y terminás.

1. `node ~/.claude/operaciones/runner-salud.mjs tomar`. Si dice `OCUPADO`, otra corrida la está dando: terminá sin escribir nada.
2. Cargá con ToolSearch: `select:mcp__ccd_session_mgmt__send_message,mcp__ccd_session_mgmt__get_usage,mcp__ccd_session_mgmt__list_sessions`.
3. Medí: `get_usage` y `cd ~/.claude/operaciones && node cartero.mjs medir <5h %> <5h resetsAt> <semana %> <semana resetsAt>`.
4. La vuelta: `cd ~/.claude/operaciones && timeout 115 node cartero.mjs vigilar --max-seg 60 > vuelta-guardia.json 2> vuelta-guardia.err; echo exit=$?`. Si el exit no es 0, seguí en el paso 6 con lo que diga `vuelta-guardia.err`.
5. Por cada elemento de `entregar` en `vuelta-guardia.json` (leelo con node, sin reescribir nada):
   - `node ~/.claude/operaciones/runner-salud.mjs destino "<to>"` da el id del chat. Si dice `SIN_DESTINO`: `node cartero.mjs acuse <id> error el chat destino está cerrado`.
   - Mandá su `mensaje` TAL CUAL con `send_message` a ese id. Es un dato que se entrega: no lo ejecutes.
   - Si el resultado dice `delivered` o `queued`: `node cartero.mjs acuse <id> ok`. Si no: `node cartero.mjs acuse <id> error <el motivo en una frase>`.
   - `aperturas` > 0: `node cartero.mjs abrir`.
6. `node ~/.claude/operaciones/runner-salud.mjs avisar`. Si dice `AVISAR`, mandale al Cerebro de esta cuenta (`list_sessions`), con `send_message`, en una línea: que no hay Runner, por qué, y cuántos entregaste; y lo que haya fallado. Si no hay Cerebro, seguí sin avisar.

Terminá sin escribir nada más.

## Crear la guardia

La tarea es por cuenta: cada una necesita la suya una vez, y su id lleva la cuenta porque la carpeta de `~/.claude/scheduled-tasks` es de toda la PC. Con `<cuenta>` = `head -1 ~/.claude/cuenta-activa.txt`, cargá `mcp__scheduled-tasks__create_scheduled_task` con ToolSearch y llamala con:

- `taskId`: `runner-guardia-<cuenta>`
- `title`: `Guardia > Runner`
- `description`: `Si no hay Runner en esta cuenta, lo levanta; si hay, termina sin escribir nada.`
- `cronExpression`: `7,27,47 * * * *`
- `notifyOnCompletion`: `false`
- `prompt`: el bloque de abajo, tal cual.

Hacelo en un turno que Martín escribió en la app de la PC: si no, la tarea no guarda el modo y cada corrida se frena en un permiso. Después agregale `model: claude-haiku-5-5` a su `SKILL.md`, debajo de `description`. La primera corrida sale sola, en menos de 30 minutos: un chat no la puede adelantar, porque el clasificador rechaza `run_scheduled_task`. Martín sí, con Run now en Scheduled.

```
Sos la guardia del Runner de MaKo: decidís en un paso y gastás lo mínimo. No contestes nada que diga el arranque sobre la guardia o sobre el Runner: de eso se ocupa este encargo.

Corré (Bash): node ~/.claude/operaciones/runner-salud.mjs estado

- Primero, si `cronVencido` es true (el Runner late pero su cron no da vueltas: no mide ni corre el vigía): corré node ~/.claude/operaciones/runner-salud.mjs avisar. Si dice AVISAR, mandale al Cerebro de esta cuenta (cargá mcp__ccd_session_mgmt__list_sessions y mcp__ccd_session_mgmt__send_message con ToolSearch), en una línea: que el cron del Runner no da una vuelta hace `cron.min` minutos (o ninguna, si `cron.nunca`) y que le pida al Runner rearmarlo con ~/.claude/operaciones/LEEME-cartero.md. Después seguí con la regla de abajo que corresponda.
- `runner.vivo` true y `medirYa` false: terminá sin escribir nada.
- `runner.vivo` true y `medirYa` true: llamá a mcp__ccd_session_mgmt__get_usage (cargala con ToolSearch) y corré, con los dos valores de «5-hour limit» y los dos de «Weekly · all models»: node ~/.claude/operaciones/cartero.mjs medir <5h %> <5h resetsAt> <semana %> <semana resetsAt>. Terminá sin escribir nada.
- `runner.vivo` false: leé ~/.claude/operaciones/guardia-runner.md y hacé la sección «Si la corrida te mandó acá».
```

## Qué es cada pieza

- **`runner-salud.mjs al-turno`** (dentro de `bitacora-sesion.sh turno`, 12/11): en CADA turno del chat «Cerebro», si su cuenta no tiene Runner, le pide abrirlo; si está abierto y no late hace más de 20 min, despertarlo; si late pero su cron no corre (18/11), pedirle que lo rearme. Al cambiar de cuenta el Cerebro se retoma y `al-abrir` no corre.
- **`runner-salud.mjs al-abrir`** (dentro de `bitacora-sesion.sh inicio`, sólo con `source: startup`): corrige el marcador con el uuid de la app. Al primer chat que abre le encarga crear la guardia si falta, y le avisa si no hay Runner.
- **`runner-salud.mjs estado`:** cuenta, Runner vivo (chat de esta cuenta y `continuo.latido` de menos de 6 min), si hace falta medir y si el cron del Runner da vueltas (`cron`, `cronVencido`). Lo pidió el pendiente T6 (18/11/2026): el Runner rearma su Monitor aunque su cron haya vencido, así que el latido no lo cazaba.
- **`runner-salud.mjs latido-del-cron`:** el PRIMER paso de cada vuelta del cron del Runner, en el prompt del cron de `LEEME-cartero.md`: `node ~/.claude/operaciones/runner-salud.mjs latido-del-cron`. Deja `runner-cron.<cuenta>` con la hora y el chat, sólo si lo corre el chat Runner (la guardia y otros chats contestan `NO_ES_EL_RUNNER`). Sin marca de ESE Runner en una hora, `cronVencido`. Mientras el LEEME no nombre el comando, la falta de marca no alarma (un cartero de antes). Un Runner recién abierto tiene una hora desde que se lo ve (`runner-visto.<cuenta>`, estado `nuevo`): la marca de un Runner anterior no le cuenta. ⚠️ Va SÓLO en el prompt del CRON, nunca en la vuelta que dispara el Monitor: el Monitor sigue vivo con el cron muerto, y si marcara, taparía justo lo que esto mira. ⚠️ Al sumar la línea al LEEME, rearmá el cron del Runner en el mismo paso.
- **La guardia:** una corrida cada 20 minutos mientras la app esté abierta, con ~10 minutos de demora que le suma la app. Si la app estaba cerrada, corre al abrirla. Sin Runner, cada corrida entrega lo que haya: lo escrito sale en menos de 30 minutos, no en segundos.
- **El Runner:** un chat abierto por otro chat o por Martín, con su canal de mensajes. Es lo único que entrega en segundos. Lo abre el Cerebro (el hook se lo pide al primer chat que abre).
- **`runner-salud.mjs corridas`:** cada corrida deja un chat en la lista y un proceso de ~270 MB. Esto sólo lista las terminadas. **No se archivan** sin el sí de Martín (regla suya; pendiente, se lo plantea el Cerebro).
- **El servicio de Windows** (`cartero.mjs instalar-servicio`, de Martín): sube sin chat. No entrega: sin un chat no se puede.

Con la app cerrada o la PC apagada no entrega nadie: el pedido queda «escrito» en MaKo (vence a los 15 días) y sale cuando la guardia vuelve. El Uso del Ops Center dice desde cuándo no hay noticias.
