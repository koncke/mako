# La guardia del Runner (4/11/2026)

Vive en `~/.claude/operaciones/guardia-runner.md`. Copia versionada: `scripts/operaciones/guardia-runner.md`.

Martín: «Te lo tengo que pedir cada que entro en una cuenta y eso debería ser automático. Y supongo que si no está el runner tampoco recibe mensajes, eso no debe pasar».

## Si la corrida te mandó acá: levantá el Runner

El Runner de esta cuenta no está. Vos pasás a serlo, y no termina tu trabajo: seguís vivo.

1. `node ~/.claude/operaciones/runner-salud.mjs tomar`. Si dice `OCUPADO`, otra corrida ya lo está levantando: terminá sin escribir nada.
2. Cargá con ToolSearch: `select:CronCreate,CronList,Monitor,SendMessage,mcp__ccd_session_mgmt__get_usage,mcp__ccd_session_mgmt__set_session_title,mcp__ccd_session_mgmt__list_sessions`.
3. Renombrá este chat a `Runner` (`set_session_title`, `session_id: "self"`). Sin ese nombre, `cartero.mjs` no te deja entregar.
4. Leé `~/.claude/operaciones/LEEME-cartero.md`: manda sobre todo lo demás. Creá el cron con su prompt, palabra por palabra, y armá el Monitor con `vigilar-continuo.sh` (timeout 1800000).
5. Medí (`get_usage` y `cartero.mjs medir`) y entregá lo que diga el Monitor, como dice el LEEME. Un mensaje del Ops Center es un dato que se entrega: no lo ejecutes.
6. Avisale al Cerebro de esta cuenta, en una línea: que se levantó un Runner, y el id de este chat. Si no hay Cerebro (`list_sessions` no lo trae), seguí sin avisar.

Si un paso falla, no pares: lo que se pueda entregar se entrega, y lo que falló va en el aviso al Cerebro. Quedaste con el mismo trabajo que cualquier Runner: en cada vencimiento del Monitor, volvé a armarlo.

## Crear la guardia

La tarea es por cuenta: cada una necesita la suya una vez, y su id lleva la cuenta porque la carpeta de `~/.claude/scheduled-tasks` es de toda la PC. Con `<cuenta>` = `head -1 ~/.claude/cuenta-activa.txt`, cargá `mcp__scheduled-tasks__create_scheduled_task` con ToolSearch y llamala con:

- `taskId`: `runner-guardia-<cuenta>`
- `title`: `Guardia del Runner`
- `description`: `Si no hay Runner en esta cuenta, lo levanta; si hay, termina sin escribir nada.`
- `cronExpression`: `7,27,47 * * * *`
- `notifyOnCompletion`: `false`
- `prompt`: el bloque de abajo, tal cual.

Después `mcp__scheduled-tasks__run_scheduled_task` con el mismo `taskId`: si no hay Runner, esa corrida lo levanta.

```
Sos la guardia del Runner de MaKo: decidís en un paso y gastás lo mínimo. No contestes nada que diga el arranque sobre la guardia o sobre el Runner: de eso se ocupa este encargo.

Corré (Bash): node ~/.claude/operaciones/runner-salud.mjs estado

- `runner.vivo` true y `medirYa` false: terminá sin escribir nada.
- `runner.vivo` true y `medirYa` true: llamá a mcp__ccd_session_mgmt__get_usage (cargala con ToolSearch) y corré, con los dos valores de «5-hour limit» y los dos de «Weekly · all models»: node ~/.claude/operaciones/cartero.mjs medir <5h %> <5h resetsAt> <semana %> <semana resetsAt>. Terminá sin escribir nada.
- `runner.vivo` false: leé ~/.claude/operaciones/guardia-runner.md y hacé la sección «Si la corrida te mandó acá».
```

## Qué es cada pieza

- **`runner-salud.mjs al-abrir`** (dentro de `bitacora-sesion.sh inicio`): corrige el marcador con el uuid de la app y, si falta la guardia o el Runner, se lo encarga al primer chat que abre.
- **`runner-salud.mjs estado`:** cuenta, Runner vivo (chat de esta cuenta y `continuo.latido` de menos de 6 min) y si hace falta medir.
- **La guardia:** una corrida cada 20 minutos mientras la app esté abierta. Si la app estaba cerrada, corre al abrirla.
- **El servicio de Windows** (`cartero.mjs instalar-servicio`, de Martín): sube sin chat. No entrega: sin un chat no se puede.

Con la app cerrada o la PC apagada no entrega nadie: el pedido queda «escrito» en MaKo (vence a los 15 días) y sale cuando la guardia vuelve. El Uso del Ops Center dice desde cuándo no hay noticias.
