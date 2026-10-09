# Guardado automático antes de que se corte la cuota semanal

Implementado el 08/10/2026. Martín trabaja con dos cuentas de Claude y se pasa de una a
la otra cuando se le acaba la **cuota semanal**. Antes de esto, el contexto de cada chat
se guardaba si alguien se acordaba de pedirlo a tiempo; el 06/10 la cuenta 1 escribió
seis briefings y se quedó sin tokens antes de commitearlos.

Ahora hay dos mecanismos, los dos automáticos:

| Cuándo | Qué pasa | Necesita al modelo |
|---|---|---|
| **Cada mensaje**, en cada chat | Si la cuota semanal cruzó el **85%, 90% o 95%**, el chat recibe la orden de guardar (una sola vez por umbral) y queda una **foto** de todo lo sin commitear | Para medir y para escribir el relevo, sí |
| **Al cerrar** cualquier sesión | Si quedó un relevo escrito y sin commitear en `docs/relevo/`, se commitea solo | **No**: corre aunque no quede un token |

---

## Cómo funciona

### El sensor: el modelo mide, el hook lee

**Un script no puede leer el % de la cuota semanal.** No queda en ningún archivo local:
el log de la app sólo lo anota cuando el límite *ya* se pasó (errores 429), y quedó quieto
desde agosto. Lo puede leer el **modelo**, con la herramienta `get_usage` de la app.

Así que se reparte el trabajo:

1. El modelo llama a `get_usage` y deja el número en `~/.claude/uso-semanal.txt`, una
   línea: `<porcentaje> <resetsAt> <cuándo se midió>`. Ejemplo:
   `78 2026-10-13T21:00:00.401Z 2026-10-09T02:44:24Z`
2. El hook `UserPromptSubmit` lee ese archivo **en cada mensaje de cada chat**. Si la
   medición tiene más de 30 minutos, le pide al modelo que vuelva a medir. Si cruzó un
   umbral, dispara la orden.

**La cuota semanal es de la CUENTA, no del chat**: cualquier chat que mida le avisa a
todos. Con varios chats trabajando, el número se mantiene fresco solo.

### Lo que dispara cada umbral

| Umbral | La orden al chat |
|---|---|
| **85%** | Escribí o actualizá tu `docs/relevo/<área>.md` y commitealo por ruta · lo TERMINADO y verificado, commit y push como siempre · lo A MEDIAS no se pushea |
| **90%** | Lo mismo, y no arranques trabajo grande nuevo: cerrá lo abierto en pasos chicos |
| **95%** | Cierre: relevo final ya, pusheá lo terminado, no arranques nada más |

Cada chat recibe cada umbral **una sola vez por semana** (estado en
`~/.claude/umbrales-avisados.tsv`). Y le avisa a Martín en una línea.

### La foto de lo que está a medias

En cada umbral, el hook guarda **todo lo sin commitear** del árbol —incluido lo que no
está trackeado— en una referencia local: `refs/wip/semanal-u85-2026-10-13` (umbral y fecha
de reinicio de la semana). Una por umbral y por semana, para el árbol entero.

Se hace sobre un **índice temporal**, así que no toca el índice compartido (donde otras
sesiones stagean), no mueve la rama, no se pushea y no despliega. Se recupera un archivo
con `git checkout refs/wip/semanal-u85-<fecha> -- <ruta>`, y se listan las fotos con
`git for-each-ref refs/wip/`.

### La red al cerrar

El hook `SessionEnd` commitea `docs/relevo/` y `docs/relevo.md` si quedaron escritos y sin
commitear: **por ruta** (no se lleva lo que otra sesión tenga stageado), con un lock por si
cierran varias a la vez —el 06/10 cerraron cuatro en el mismo segundo— y **sin pushear**.

Dispara aunque la sesión se haya quedado sin tokens: la bitácora tiene los cierres de las
sesiones del 06/10 que se habían quedado sin cuota. **Sólo salva lo que está escrito**: si
el chat se corta antes de escribir su relevo, no hay nada que commitear. Por eso el
umbral del 85% es la parte que importa.

---

## Por qué NO pushea el código a medias

Fue lo primero que se pidió («que vayan pusheando») y se decidió que no, por dos razones:

1. **Pushear a `main` es desplegar a producción.** Un cambio a medio hacer le llega a los
   clientes. El hook de `pre-push` sólo chequea tipos, no que la feature esté terminada.
2. **No hace falta para no perderlo.** Las dos cuentas trabajan sobre **el mismo clon en la
   misma máquina**: el código sin commitear sigue ahí al cambiar de cuenta. Lo que se
   pierde es el **contexto** —qué se estaba haciendo y por qué—, y eso lo cubre el relevo.

Lo terminado sí se pushea, como siempre. Lo a medias queda en el árbol y en la foto.

---

## Las piezas

Todo vive en `~/.claude/`, fuera del repo, porque es configuración de la máquina. Hay una
copia versionada en [`scripts/claude-hooks/`](../scripts/claude-hooks/) para replicarlo.

| Archivo | Qué es |
|---|---|
| `~/.claude/bitacora-sesion.sh` | El script. Tres acciones: `inicio`, `turno` y `fin` |
| `~/.claude/settings.json` → `hooks` | `SessionStart` → `inicio` · `UserPromptSubmit` → `turno` · `SessionEnd` → `fin` |
| `~/.claude/uso-semanal.txt` | El último % semanal medido. Lo escribe el modelo |
| `~/.claude/umbrales-avisados.tsv` | Qué chat ya recibió qué umbral esta semana |
| `~/.claude/bitacora-sesiones.tsv` | Arranque y cierre de cada sesión, con su cuenta |
| `~/.claude/cuenta-activa.txt` | `claude1` o `claude2`. Lo declara Martín |

## Cómo replicarlo en la otra cuenta

**En la app de escritorio no hay nada que hacer.** Las dos cuentas usan el mismo
`~/.claude`, así que los hooks corren en las dos. Verificado: la bitácora tiene los
arranques y cierres de las sesiones de `claude1` del 05 y 06/10, escritos por estos
mismos hooks.

**Sólo hace falta copiarlo si se usa la terminal** con la función `claude2` del `$PROFILE`,
que apunta a otro directorio de configuración (`~/.claude-martin`):

1. Copiar `scripts/claude-hooks/bitacora-sesion.sh` a `~/.claude/bitacora-sesion.sh`
   (el script siempre lee y escribe en `~/.claude/`, así que una sola copia sirve).
2. Fusionar el bloque `hooks` de `scripts/claude-hooks/settings-hooks.json` dentro del
   `settings.json` de ese directorio de configuración. **Fusionar, no reemplazar**: el
   archivo tiene otras claves.
3. Verificar con los pasos de abajo.

## Cómo verificar que anda

```bash
cat ~/.claude/uso-semanal.txt
```

Tiene que tener una línea con un % y una fecha de los últimos 30 minutos, si hubo chats
trabajando. Para ver qué dispararía el hook ahora, sin esperar a un mensaje:

```bash
echo '{"session_id":"prueba"}' | bash ~/.claude/bitacora-sesion.sh turno
```

Sin salida = la cuota está por debajo del 85% y la medición es fresca. Las fotos tomadas:

```bash
git for-each-ref refs/wip/
```

## Cómo se probó

En un worktree descartable y con archivos de estado propios del test, sin tocar los reales:
sin medición pide medir · 70% no dice nada · 86% dispara el 85% y saca la foto · la misma
sesión otra vez no repite · otra sesión al 86% recibe el aviso sin foto nueva · 91% dispara
el 90%. La foto trajo el archivo sin trackear y el modificado, el índice compartido quedó
intacto y `main` no se movió. La red del cierre: commiteó un relevo nuevo y uno modificado,
dejó afuera un archivo ajeno stageado, y una segunda corrida no hizo nada.
