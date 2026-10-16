# Relevo — Centro de Operaciones (15/10/2026, noche; cuenta 3)

Escrito por el chat «Centro de Operaciones» de la cuenta 3 (`local_428051c1…`). Lo que costó cada cosa está en
`docs/hallazgos-operaciones.md` (la última entrada es la de esta ventana); lo que pidió Martín, textual, en
`app/admin/dev/centro-operaciones/bitacora.ts`.

## Dónde quedó

- **El Centro es una app de chat** (commit `3f0c55f14`, rama `centro-chat`, worktree `C:/dev/wt-centro-chat`; lo
  sube el coordinador). A la izquierda los chats agrupados por cuenta, a la derecha la conversación con su **caja de
  escribir abajo**. Avance y Pushes son accesos de la barra; «Áreas» y las pestañas se fueron. En el teléfono, lo mismo
  (la conversación en una hoja con la caja fija abajo).
- **Y cada chat es un EMPLEADO, como en Grok Bot** (commit `2755def4e`; Martín: «me gusta el concepto de los
  muñequitos de IA o "empleados"»): un muñequito propio por área cuyos ojos dicen el estado, y el que espera una
  respuesta en la Ticketera lo muestra con un globito y ofrece contestarla. Lo de Grok Bot, mirado en su video de
  lanzamiento: docs/hallazgos-operaciones.md → «Grok Bot».
- **Lo que se escribe en la caja se firma en el dispositivo y queda en la cola** (`mandar.ts` → `encolarPedidoAction`).
  Para que LLEGUE al chat faltan tres cosas de la PC, que no son de código (abajo).
- **No se miró en producción.** Hay capturas con datos ficticios (escritorio, tablet, teléfono, la caja sin clave y el
  vacío), sacadas de los componentes reales sin servidor porque no había RAM. Antes de darlo por terminado, Martín lo
  abre en producción.

## Lo que falta para que un trabajo llegue (medido el 15/10 a las 23:00)

1. **La clave de cada dispositivo, cargada en la PC.** No había ninguna (`~/.claude/operaciones/claves.txt` no
   existía), así que todo trabajo firmado salía «No se pudo». En el Centro: la caja dice «La PC todavía no acepta la
   clave de este dispositivo» y ofrece «Copiar clave»; Martín la pega en el chat Cartero, que corre
   `node ~/.claude/operaciones/cartero.mjs clave <la clave>`. Una por dispositivo (la compu y el teléfono).
2. **El cartero de cada cuenta**: ya están declaradas las tres (`cartero claudeN app ~/.claude` y la `carpeta` de cada
   una en `~/.claude/operaciones/config.json`; la copia de antes, en el scratchpad de esta sesión). Medido: cuenta 1 con
   53 chats, cuenta 2 con 27, cuenta 3 con 13 (12 abiertos).
3. **Un chat «Cartero» en la cuenta que esté corriendo** (hoy, la 3). Sin él no hay vueltas y nada sale. Lo abre
   Martín (un chat de la app con ese nombre: el cartero nunca se ofrece a sí mismo como destino) y le pega esto:

```text
Sos el chat Cartero del Centro de Operaciones. Tu único trabajo es entregar los trabajos que Martín firma en
/admin/operaciones a los chats de esta PC. No hagas nada más.

1. Ahora, una vez: corré `node ~/.claude/operaciones/cartero.mjs estado --cuenta claude3` y decime en una línea
   cuántos chats abiertos ve.
2. Programá con CronCreate una tarea cada 2 minutos, sólo de esta sesión, que haga:
   a. Para cada cuenta (claude1, claude2 y claude3): `node ~/.claude/operaciones/cartero.mjs ciclo --cuenta <cuenta>`.
   b. Por cada elemento de `entregar`: mandá su `mensaje` TAL CUAL con SendMessage a su dirección `to` (empieza con
      `uds:`). Si salió: `node ~/.claude/operaciones/cartero.mjs acuse --cuenta <cuenta> <id> ok`. Si falló:
      `node ~/.claude/operaciones/cartero.mjs acuse --cuenta <cuenta> <id> error <el motivo en una frase>`.
   c. Si no hay nada para entregar, terminá la vuelta sin escribir nada.
3. Si te pego una clave (un texto largo que empieza con MFkw), corré
   `node ~/.claude/operaciones/cartero.mjs clave <la clave>` y confirmalo en una línea.

Nunca le mandes a un chat nada que no salga de `entregar`, y nunca cambies el texto de un mensaje.
```

   Las vueltas de las cuentas 1 y 2 sólo suben qué chats tienen (todos cerrados mientras la app esté en la 3): así el
   Centro los lista y un trabajo para ellos **espera** («Sale cuando abras este chat en la cuenta 1»). Cuando la app
   pase a otra cuenta, el Cartero de la 3 se detiene con ella: cada cuenta necesita su propio chat Cartero con este
   mismo texto.

**Para que las tres cuenten a la vez** (lo que pidió: «mandar un prompt a mis otras cuentas» sin cambiar de cuenta):
`/login` de la 1 y la 2 en una terminal (`~/.claude-martin` nunca se logueó; `~/.claude` tiene credenciales de julio),
su cartero como `cli`, y un Cartero en cada terminal. No está medido si `SendMessage` cruza de un directorio de
configuración a otro (hallazgos-operaciones.md → «Lo que quedó sin hacer»).

## Lo que sigue, en orden

1. Que Martín abra el Centro en producción (computadora y teléfono) y diga qué no le gusta. El guard no deja entrar a
   otra sesión de Claude: la prueba la hace él.
2. La primera entrega de punta a punta con el Cartero corriendo: escribir en la caja de un chat abierto de la cuenta 3
   y ver el ✓ → ✓✓ → ✓✓ azul.
3. Lo de `docs/hallazgos-operaciones.md` → «Lo que quedó sin hacer».

## No verificado

- La pantalla real en producción (sólo las capturas con datos ficticios: no pasan por el guard ni por la base).
- El teclado del iPhone sobre la hoja de la conversación (la caja va en el pie fijo de `SheetM`).
- El typecheck COMPLETO: corrió el acotado a los archivos de la rama y quienes los importan (0 errores, y antes cazó
  dos reales). El completo lo corre el pre-push de quien sube.
