# Varias cuentas de Claude sobre este repo

El límite del desarrollo no lo ponen las ideas: lo pone la cuota. Con una cuenta sola,
el trabajo se corta a mitad de semana y queda parado hasta el reset. Con cuentas
**desfasadas** hay capacidad los 7 días.

Este documento es el protocolo. Está versionado a propósito: es lo único que **todas** las
cuentas ven igual, porque **la memoria y el login no se comparten por defecto** (ver
abajo qué sí y qué no).

> **Al 10/10/2026 hay dos cuentas y está entrando una tercera.** El documento se escribe
> para N, no para dos: **ningún nombre de titular vive en el código**. La tabla está en
> `~\.claude\cuentas.tsv` y sumar una cuenta es agregarle una línea.

## Sumar una cuenta: los cuatro pasos

Ninguno es opcional, y el que más duele olvidar es el tercero.

1. **Anotala en la tabla de titulares**, `~\.claude\cuentas.tsv`, una línea
   `<cuenta>\t<Nombre <email>>` separada por un TAB de verdad:

   ```
   claude3	Fulano de Tal <fulano@ejemplo.com>
   ```

   El hook `~\.claude\bitacora-sesion.sh` la lee de ahí. Si falta, cada sesión arranca
   diciendo `SIN IDENTIFICAR` — que es a propósito: prefiere avisar antes que inventar un
   titular y hacer que los commits salgan mal atribuidos.

2. **Declará cuál está activa** al entrar, porque del disco **no se deduce**:

   ```sh
   echo claude3 > ~/.claude/cuenta-activa.txt
   ```

   Es lo que el hook lee para decirle a cada chat quién es y con qué trailer firmar
   (`Claude-Cuenta: claude3`).

3. ⚠️ **Si la cuenta nueva usa un config dir PROPIO, recreá el junction de la memoria.**
   Las memorias viven en una sola carpeta física y las demás rutas son junctions (ver
   «Qué comparten y qué no»). Un config dir nuevo nace **sin** ese enlace: la cuenta
   arranca con la memoria vacía y, peor, **empieza a escribir memorias propias** que nadie
   más va a ver. En dos semanas hay dos verdades y ninguna forma de saber cuál es.

   ```powershell
   cmd /c mklink /J "<config dir nuevo>\projects\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\memory" "$HOME\.claude\projects\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\memory"
   ```

   Si en cambio entra por el **mismo** `~\.claude` (logout y login en la misma app), no hay
   que hacer nada: la memoria y las transcripciones ya están ahí.

4. **Mostrale dónde está el trabajo.** La cuenta nueva abre la barra lateral y la ve
   **vacía**: los chats están indexados por cuenta. El índice que reemplaza a esa barra es
   [`relevo/chats.md`](relevo/chats.md) — qué chat tocó qué, cuándo fue la última vez y qué
   briefing le corresponde. Lo primero que va a preguntar es «¿en qué chats estuve
   trabajando?», y ésa es la respuesta.

---

## Cómo se abre cada una

Claude Code guarda credenciales en `CLAUDE_CONFIG_DIR`. Dos sesiones con el mismo
directorio se pisan la sesión; con directorios distintos, conviven.

Ya están las funciones en el `$PROFILE` de PowerShell
(`~\OneDrive\Documentos\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`):

| Comando | Cuenta | Config dir | Ventana |
|---|---|---|---|
| `claude1` | Mauricio | `~\.claude` | miércoles a viernes |
| `claude2` | **Leandro Tejado** | `~\.claude-martin` | sábado a martes |

⚠️ **La cuenta 2 es de Leandro Tejado, no de Martín** (corregido el 2026-08-08 por el
propio Martín). Martín tiene su cuenta, pero **por ahora no se trabaja con ella**. El
nombre del config dir `~\.claude-martin` quedó de cuando se pensaba al revés: es una
ruta, no un dato — no deduzcas de ahí quién está logueado.

⚠️ Y no deduzcas de ahí **ni del disco: no hay ninguna señal que sirva.** Se
midieron las cuatro el 2026-08-25, con la sesión corriendo en la cuenta 2:

| Señal | Qué dio | Por qué no sirve |
|---|---|---|
| El `userEmail` que el harness inyecta en el system prompt | `mbustos@elevate.com.mx`, o sea **Mauricio / cuenta 1** | Sale de `~\.claude.json` → `oauthAccount.emailAddress`: **es ese archivo, no una lectura viva**. Y **va con retraso**: se actualiza al *loguearse*, no al abrir sesión |
| `~\.claude\.credentials.json` | existe | mtime **21 de julio**. Ningún login por CLI desde entonces |
| `~\.claude-martin\` | sin `.claude.json` ni `.credentials.json` | Nunca se logueó ahí |
| `%APPDATA%\Claude\Local Storage\leveldb` (la app de escritorio) | `martinkoncke@gmail.com` | **Constante desde julio de 2025** — no discrimina una cuenta de la otra |

El token vivo de la app de escritorio está en el `safeStorage` de Electron, cifrado: no hay
dónde leerlo. **El config dir tampoco confirma nada** — el junction hace que las cuatro
rutas apunten a la misma carpeta, y la app de escritorio usa `~\.claude` con cualquier
cuenta.

🕳️ Callejón ya recorrido, no lo repitas: buscando emails en `%APPDATA%\Claude` aparece
`evan.exe@gmail.com` 33 veces. Es **Evan Wallace, el de esbuild**, dentro de
`vm_bundles\claudevm.bundle\rootfs.vhdx` (metadata de npm cacheada). No es una cuenta.

### La solución: un marcador que Martín escribe, un hook que lo lee

Puesto y probado el 2026-08-25. Como ninguna señal de la máquina sirve, la fuente de verdad
es **declarada**, no deducida:

| Pieza | Qué hace |
|---|---|
| `~\.claude\cuenta-activa.txt` | Una línea: `claude1` o `claude2`. Lo actualiza Martín (o Claude, apenas Martín lo diga) al cambiar de cuenta |
| Hook `SessionStart` en `~\.claude\settings.json` | Lo lee y lo inyecta al contexto por `hookSpecificOutput.additionalContext`, **con la fecha en que se anotó** para que se note si quedó viejo |

Así la cuenta llega sola al abrir y no hay que preguntar. **Si el mensaje no aparece, el
hook no corrió: entonces se pregunta — nunca se deduce.** Y si la fecha es de hace varios
días y hubo un cambio en el medio, el archivo miente: se confirma y se reescribe. Nada en
la máquina lo actualiza solo, porque nada en la máquina sabe qué cuenta es.

Lo que diga Martín gana siempre sobre el archivo, y el archivo gana siempre sobre el disco.

### Las tres piezas, y dónde vive cada una

Todo esto vive **fuera del repo**, en el config de Claude, porque tiene que funcionar
aunque el clon se borre y se vuelva a clonar:

| Archivo | Qué es |
|---|---|
| `~/.claude/cuenta-activa.txt` | Una línea: `claude1` o `claude2`. La declara Martín. **Es la fuente de verdad** |
| `~/.claude/bitacora-sesion.sh` | El script que leen los hooks. Está comentado con el porqué de cada decisión |
| `~/.claude/bitacora-sesiones.tsv` | Una línea por apertura y por cierre: fecha, acción, cuenta, id de sesión |

Los hooks son dos, los dos en `~/.claude/settings.json`: `SessionStart` (registra la
apertura, inyecta la cuenta al contexto y avisa si hay otra sesión viva) y `SessionEnd`
(registra el cierre).

### ⚠️ Y ni el id de la app ni el del transcript dicen QUÉ CHAT hizo un commit

Hay **dos espacios de nombres distintos** para la misma sesión, y no se mapean entre sí:

- El de la app: `local_<uuid>`, lo que devuelven `list_sessions` / `send_message`.
- El del disco: `~/.claude/projects/<proyecto>/<otro-uuid>.jsonl`.

Medido el 05/10/2026: el chat «Perro Guardián» es `local_50dc47b3…` para la app y
`48dddbc4…` en el disco. **Dos uuid distintos para el mismo chat.** Y pasó lo mismo con los
otros tres: se les mandó a `local_84421aa0`, `local_06a1bed5` y `local_416dcc4b`, y los
transcripts que despertaron fueron `7a6bc4be`, `461dd390` y `debe2ade`.

Peor: **el `lastActivityAt` de la app también miente.** Ese día reportó `01:35` para «Perro
Guardián» cuando ese mismo chat había commiteado `ba4a2289` a las **10:30**. Sobre esa
lectura le dije que había quedado parado, y me corrigió él.

**La regla:** el conteo de sesiones vivas del hook sirve para lo único que tiene que servir
— avisar *«no estás solo en el clon, commiteá por ruta explícita»* — y **no sirve para
atribuir trabajo**. Para saber quién hizo qué, la única fuente es **el commit**: su trailer
`Claude-Cuenta`, su hora y sus archivos. No el `lastActivityAt`, no el `mtime`, no el nombre
del `.jsonl`. Y si vas a decirle a otra sesión lo que estuvo haciendo, no se lo deduzcas:
preguntáselo.

### Detectar la sesión paralela: por qué el `mtime` no alcanza

El hook cuenta las sesiones con actividad reciente sobre este clon. La primera versión
miraba el `mtime` de los `.jsonl` y **daba 3 donde había 1**: un reindexado de Claude Code
tocó nueve transcripts a la vez el 25/08 y todos quedaron con la misma hora. Lo que no
miente es el **último `timestamp` escrito adentro** del archivo. La versión final usa el
`mtime` como prefiltro barato —descarta rápido las decenas de sesiones viejas— y confirma
con la cola del archivo: leer los 4 KB finales de todos los `.jsonl` tardaba 4,9 s en el
arranque, y con el prefiltro baja a 1,1 s.

⚠️ **Los trailers `Claude-Cuenta` anteriores al 25/08/2026 no son confiables.** Hasta ese
día se firmaba adivinando: en los bloques del 11/08 la firma alterna entre `claude1` y
`claude2` **cada dos o cuatro minutos**, sobre trabajo continuo, y los commits del medio
son features normales y no otra clase de tarea. El trailer registraba la adivinanza. Los
bloques **largos** (97 commits del 16 al 17/08, 68 del 13 al 14) sí son creíbles, porque
cientos de commits seguidos no se explican por ruido. Y la firma **no existe antes del
11/08 16:38**: hay 39 commits sin ella.

ℹ️ De paso, esto explica un corte: el 2026-08-25 a las 16:35:50 las cuatro sesiones del
día murieron casi juntas con «Your organization has disabled Claude subscription access for
Claude Code». Esa organización es la de `mbustos@elevate.com.mx` — la cuenta 1 — y de ahí
el pase a la 2. El `userEmail` siguió mostrando la cuenta vieja después del cambio: es la
firma exacta de un indicador con retraso.

Las dos hacen `cd` al repo **antes** de arrancar, y las dos imprimen el estado de git
al abrir. Eso no es decorativo: si aparecen archivos sin commitear, son de la otra
sesión.

VS Code → terminal → Split → `claude1` de un lado, `claude2` del otro. `/login` una vez
en cada lado y queda.

⚠️ **El repo git NO es la carpeta que dice el nombre.** Está en
`dashboard-marketing-main\dashboard-marketing`; la carpeta padre `dashboard-marketing-main`
no es un repo. Una sesión abierta en la padre no puede correr git, no dispara el
`pre-push` y no ve los hooks. Por eso las funciones hacen el `cd`: no confíes en abrir
Claude "en el escritorio".

---

## Qué comparten y qué no

Acá está el 80% del problema, y es lo que no se ve hasta que muerde.

| Cosa | Dónde vive | ¿Lo ven las dos? |
|---|---|---|
| Las 159 memorias | `~\.claude\projects\<clave>\memory\` | **Sí**, por junction (ver abajo) |
| `AGENTS.md`, `CLAUDE.md` del repo | el repo | Sí — versionado |
| Las 27 skills de `.claude/skills` | el repo | Sí — versionado |
| `docs/hallazgos-*.md` | el repo | Sí — versionado |
| El hook `pre-push` | `.git/hooks/` | Sí, mientras compartan clon (no se versiona) |
| El marcador de cuenta | `~\.claude\cuenta-activa.txt` | **Sí** — por eso lo DECLARA Martín |
| El % de cuota semanal | `~\.claude\uso-semanal.txt` | **Sí** — y por eso lleva la cuenta adentro |
| **La sesión / el login** | `~\.claude\.credentials.json` | **No** — es el punto |
| **Los conectores MCP** (Notion, Fathom, Gmail, Canva) | la cuenta de claude.ai | **No** — van atados a cada cuenta |
| El historial de sesiones (`/resume`) | `<config dir>\projects\<clave>\*.jsonl` | No |

**La memoria se comparte por un junction de NTFS**, no por copia. Una copia se bifurca:
la cuenta 2 escribe una memoria, la 1 nunca la ve, y en dos semanas hay dos verdades.
Con el junction las cuatro rutas posibles apuntan a la **misma carpeta física**:

```
~\.claude\projects\...-main\memory                        <- la carpeta real
~\.claude\projects\...-main-dashboard-marketing\memory     -> junction
~\.claude-martin\projects\...-main\memory                  -> junction
~\.claude-martin\projects\...-main-dashboard-marketing\memory -> junction
```

Las cuatro existen porque históricamente se abrieron sesiones desde la carpeta padre y
desde la interna, y cada una genera su propia clave de proyecto. Así funciona desde
cualquiera de las dos.

Si alguna vez hay que recrear un junction:

```powershell
cmd /c mklink /J "<ruta del link>" "$HOME\.claude\projects\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\memory"
```

⚠️ **Consecuencia sobre el traspaso:** como la memoria ahora sí se comparte, sirve como
canal entre cuentas. Pero lo que gobierna código sigue yendo a `AGENTS.md` y lo que se
aprendió a `docs/hallazgos-<área>.md`, que además lo lee un humano y sobrevive a
cualquier reinstalación del config dir.

### ⚠️ `~\.claude\` ENTERO es compartido, y eso incluye los NÚMEROS

El junction de la memoria es a propósito. Lo que sorprende es el resto: **las dos cuentas
usan el mismo `~\.claude\`**, así que todo archivo suelto que alguien deje ahí lo lee la
otra — y un número no viene con la cara de quién lo midió.

Mordió el 09/10/2026. El hook de uso semanal le avisó a un chat de la cuenta 2
**«USO SEMANAL EN 98% — CIERRE: no arranques nada más»**. Era verdad, pero de la cuenta 1,
que lo había medido a las 15:45. La cuenta 2 estaba en **17%**. La sesión le creyó: recortó
el trabajo, le mandó a otro chat la orden de ir breve «porque Martín está al 98%», y dejó a
medias un `git pull --rebase` que quedó en conflicto sobre el clon compartido. Martín:
*«No crucé el límite semanal… Esta es la otra cuenta, siempre tenés que ejecutar el comando
para ver el % del límite semanal»*.

La cura es que **el dato diga de quién es**. `~\.claude\uso-semanal.txt` lleva cuatro campos
y el cuarto es la cuenta:

```sh
echo <pct> <resetsAt> $(date -u +%FT%TZ) $(head -1 ~/.claude/cuenta-activa.txt) > ~/.claude/uso-semanal.txt
```

`~\.claude\bitacora-sesion.sh` compara ese cuarto campo con `cuenta-activa.txt`: si no
coincide —o falta— trata el número como **sin medir** y pide medirlo de nuevo en vez de
disparar los umbrales del 85, 90 y 95%. Probado con cuatro casos: otra cuenta al 98%, ésta
al 98%, una línea vieja sin cuenta, y ésta al 17%.

**La regla general, que vale para cualquier archivo que se deje en `~\.claude\`:** si lo
escriben las dos cuentas, tiene que decir **cuál lo escribió**, y el que lo lee tiene que
descartar lo ajeno. Es la misma lección que el marcador de cuenta, una capa más abajo: un
archivo compartido sin dueño declarado no es un dato, es una trampa.

Y del lado del que lee: **un aviso que cambia lo que hacés se verifica antes de obedecerlo.**
El % real se mide con la herramienta `get_usage` (ventana «Weekly · all models»), que lee la
cuenta que está corriendo ahora. El hook es una foto; `get_usage` es la lectura viva.

---

## Los dos modos (y por qué el default no es el paralelo)

El desfase de cuotas y el paralelismo se contradicen: si la cuenta 1 corre miércoles a
viernes y la 2 sábado a martes, **casi nunca coinciden**, y toda la infraestructura para
que no se pisen sobra. Elegí a conciencia.

### Modo relevo — el default

Una cuenta por vez, misma carpeta, `main` directo. Cero infraestructura. Es lo que ya se
venía haciendo, y suma la mitad del gasto de builds en vez del doble.

Lo único obligatorio: **la sesión que cierra deja escrito dónde quedó.** Si la cuota se
corta a mitad de camino, eso es lo único que salva el trabajo.

### Modo paralelo — la excepción

Solo cuando hay dos features grandes que no comparten archivos y de verdad hace falta
correrlas juntas. En este repo eso es menos común de lo que parece: `lib/workspace.ts`,
`lib/anthropic.ts`, `lib/model-registry.ts` y el board los toca casi todo.

Si vas igual, worktree por sesión — no dos ramas en la misma carpeta, porque
`git switch` le cambia los archivos a la otra sesión mientras trabaja:

```bash
git worktree add C:/dev/mako-b -b feat/lo-que-sea
```

⚠️ **Tres cosas que hay que hacer a mano en el worktree nuevo:**

1. **Fuera de OneDrive.** `C:\dev\`, no el Escritorio. OneDrive sincroniza `node_modules`
   y `.next`: además de lentísimo, es una fuente real de corrupción.
2. **Recrear `.git/hooks/pre-push`.** Vive en `.git` y no se versiona, así que el
   worktree **no lo hereda** y esa sesión pushea sin chequeo de tipos. El contenido está
   en `AGENTS.md`.
3. **`npm install` y su propio `.env.local`** (que tampoco se versiona).

Cada push cuesta ~US$0.09 de build. Dos sesiones pusheando por separado lo duplican:
agrupá.

---

## El traspaso

Una sesión no termina sin dejar el estado en alguno de estos lugares:

1. **`docs/hallazgos-<área>.md`** — lo que se aprendió y no se deduce del código, y lo
   que quedó SIN hacer con el archivo donde vive. Índice en `docs/hallazgos.md`, se
   actualiza en el mismo commit. La regla completa está en `AGENTS.md` → "La cosecha".
2. **El board `/plan`** — las tareas abiertas. Toda sesión arranca leyéndolas.
3. **Las memorias** — una decisión, una preferencia, un porqué.

---

## Checklist de arranque

- [ ] `claude1` / `claude2` en el `$PROFILE`, las dos con `cd` al repo interno.
- [ ] Cada cuenta logueada una vez en su config dir.
- [ ] Los junctions de `memory` en pie (`Get-Item <ruta> | Select LinkType` dice `Junction`).
- [ ] Al abrir: mirar los archivos sin commitear que imprime la función. Si hay, son de
      la otra sesión.
- [ ] Definido por escrito qué le toca a cada una en este sprint.
- [ ] Si van en paralelo: worktree fuera de OneDrive, con `pre-push` recreado.
- [ ] La cuenta 2 en ayuno miércoles y jueves hasta fijar su ciclo; primera interacción
      fuerte un sábado a la mañana.

---

## Lo que no hay que hacer

- **No** correr las dos sobre la misma carpeta sin worktrees. Es la forma más rápida de
  perder una hora sin que nadie se entere hasta el `git diff`.
- **No** usar `git add -A` cuando el arranque mostró archivos ajenos sin commitear: te
  llevás el trabajo a medias de la otra sesión dentro de tu commit. Commiteá por ruta.
- **No** usar `git push --no-verify`. Es el único chequeo de tipos que queda antes de
  producción (`next build` tiene `ignoreBuildErrors: true` a propósito).
- **No** dejar que las dos editen la misma skill o el mismo prompt a la vez: se pisan
  igual que el código, pero el efecto aparece días después y en otro lado.
- **No** copiar la carpeta `memory` en vez de enlazarla. Se bifurca en silencio.
