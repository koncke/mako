# Dos cuentas de Claude sobre este repo

El límite del desarrollo no lo ponen las ideas: lo pone la cuota. Con una cuenta sola,
el trabajo se corta a mitad de semana y queda parado hasta el reset. Con dos cuentas
**desfasadas** hay capacidad los 7 días.

Este documento es el protocolo. Está versionado a propósito: es lo único que las dos
cuentas ven igual, porque **la memoria y el login no se comparten por defecto** (ver
abajo qué sí y qué no).

---

## Cómo se abre cada una

Claude Code guarda credenciales en `CLAUDE_CONFIG_DIR`. Dos sesiones con el mismo
directorio se pisan la sesión; con directorios distintos, conviven.

Ya están las funciones en el `$PROFILE` de PowerShell
(`~\OneDrive\Documentos\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`):

| Comando | Cuenta | Config dir | Ventana |
|---|---|---|---|
| `claude1` | Mauricio | `~\.claude` | miércoles a viernes |
| `claude2` | Martín | `~\.claude-martin` | sábado a martes |

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
