# Relevo: Infra, build, tests y el oficio de trabajar en este repo

**Área:** cómo se compila, qué frena un push, cuántos tests hay y cómo se corren, y las
trampas de que haya varias sesiones de Claude sobre el MISMO clon.
**Ventana:** 05/10/2026 12:33 (`6785dc16`) → 10/10/2026 19:07 (`bf40ad44`).
**Rutas:** `scripts/`, `tests/`, `next.config.ts`, `package.json`, `.gitattributes`,
`.claude/`, `AGENTS.md`.

Qué es esto para alguien que nunca lo vio: **MaKo es una app de Next.js que se despliega en
Vercel**, y este repo es todo el producto. No hay CI: no hay GitHub Actions ni nada que
corra tests en un servidor. **El único control automático vive en `.git/hooks/pre-push`**,
en la máquina de Martín. Si eso no corre, nada corre.

Commits de la ventana que caen en estas rutas: `tests/` 437, `AGENTS.md` 67, `scripts/` 20,
`package.json` 3, `next.config.ts` 1, `.gitattributes` 1, `.claude/` 1.

---

## 1. Lo primero que tenés que saber, en seis líneas

```bash
npm run dev                  # levanta en :3000 (si está tomado, -p 3100)
npm run build                # compila. NO chequea tipos (a propósito)
npm run typecheck            # los tipos, ~7 s, pasa por un lock de máquina
npm test                     # 6.839 tests. MEDIDO 10/10 19:03: 134-155 segundos
git commit -- <ruta>         # SIEMPRE por ruta. Un commit pelado se lleva lo ajeno
git push                     # dispara el pre-push: 13 chequeos. Nunca --no-verify
```

**El typecheck NO corre en el build.** `next.config.ts:17` tiene
`typescript: { ignoreBuildErrors: true }` porque ese paso eran ~65 de los ~99 segundos de
cada compilación en Vercel. El chequeo se movió a `.git/hooks/pre-push`, que **bloquea el
push** si falla.

⚠️ **Los hooks de git NO se versionan.** Si se reclona el repo, `.git/hooks/pre-push`
desaparece **en silencio** y un error de tipos vuelve a llegar a producción. El contenido
para recrearlo está en `AGENTS.md` (sección «El typecheck NO corre en el build»), y son
**trece** chequeos — los verifiqué uno por uno leyendo el hook el 10/10/2026: tipos,
`sync-contrato-detalle`, `sync-gramatica-doc`, `generar-plugin`, `zip-extension`,
`replay-libs`, `curso-catalogo-verificar`, `sync-operaciones`, `sync-boq-patch`,
`sync-boq-respuesta`, `sync-puede-filmar`, `hooks-en-orden`, `generar-api-doc`.

**Lo que el pre-push NO hace es correr los tests.** Hay que acordarse a mano. Si tocás
`nav.ts`, un título de pestaña, un catálogo o cualquier cosa que un test mire por su
NOMBRE: `npm test` antes de pushear.

---

## 2. En qué quedó (hecho y desplegado)

### El typecheck corre de a UNO por máquina — `75314fc1` (08/10 20:06) y `d0199821` (09/10 00:50)

Esto es lo que más tiempo te va a ahorrar entender, porque el síntoma es «la máquina se
trabó» y no se parece a un problema de código.

`tsc --noEmit` sobre este repo pide entre 1 y 2,4 GB. La máquina tiene 16 GB y hay 3-4
sesiones de Claude sobre el mismo clon; cada `git push` dispara su propio typecheck. Dos o
tres a la vez **no tardan el doble**: agotan la RAM, el sistema pagina y un chequeo de 7
segundos queda 20 minutos. Medido el 08/10 (en el mensaje de `75314fc1`): tres tsc
simultáneos de 2.329 + 1.283 + 474 MB con 0,8 GB libres, uno corriendo hacía 21 minutos.

La cura son dos commits, y el segundo existe porque el primero no alcanzaba:

- **`75314fc1`** puso `"typecheck": "node scripts/typecheck-lock.mjs"` en `package.json`.
  El lock es **por MÁQUINA** (`os.tmpdir()`), se toma con flag `'wx'` (test-and-set
  atómico), el dueño se comprueba con `process.kill(pid, 0)` —que no mata: pregunta— y a
  los 10 minutos **corre igual y lo dice**, porque una guarda frena sólo lo que se arregla
  haciendo lo que ella pide.
- **`d0199821`** lo movió al HOOK. El porqué es la trampa que te va a morder: **`npm run`
  resuelve el script del `package.json` DEL WORKTREE**, y este `.git` lo comparten varios
  checkouts. Los que se checkoutearon antes de `75314fc1` traen `"typecheck": "tsc
  --noEmit"` CRUDO, así que el pre-push —que vive en el `.git` común— les disparaba un tsc
  de 2,3 GB sin esperar a nadie. **Un lock que vive en un archivo versionado protege a un
  COMMIT, no a una máquina.** El hook lo llama por la ruta del clon principal:

  ```sh
  LOCK_TSC="$(dirname "$(git rev-parse --git-common-dir)")/scripts/typecheck-lock.mjs"
  ```

**Lo medí funcionando el 10/10/2026 a las 19:11:54.** Corrí `npm run typecheck` y me
contestó:

```
[typecheck] otro typecheck está corriendo (pid 5488); espero mi turno…
```

Esperó, tomó el turno y salió limpio a las 19:12:13 (19 s con la espera incluida, **0
errores de tipos en HEAD**). O sea: el lock no es teoría, hay otra sesión typecheckeando
mientras escribo esto.

El guard es `tests/typecheck-lock.test.ts`, y mira las dos mitades (el `package.json` y el
hook). Se saltea donde no hay hook legible.

### Guardado automático al 85, 90 y 95% de la cuota — `8c05915d` (08/10 23:48)

Martín trabaja con varias cuentas de Claude y se le acaban los tokens a mitad de una tanda.
Antes, el final de la tanda —que es justo cuando se escribe el relevo— era lo que la cuota
se comía.

Ningún script puede leer el % semanal: no queda en ningún archivo local, lo devuelve
`get_usage` (una herramienta de la app). Así que **el modelo mide y lo deja en
`~/.claude/uso-semanal.txt`**, y el hook `UserPromptSubmit` lo lee en cada mensaje de cada
chat: si la medición tiene más de 30 minutos te pide volver a medir, y si se cruzó un umbral
da la orden de cierre una vez y saca una foto local de lo sin commitear
(`refs/wip/semanal-u<N>-<fecha>`, **no se pushea**).

La copia versionada vive en `scripts/claude-hooks/bitacora-sesion.sh` (11.122 bytes) con su
`settings-hooks.json` al lado. **El hook que CORRE vive en `~/.claude/`, fuera del repo** —
el del repo es el respaldo. Los pasos para instalarlo: `docs/guardado-automatico.md`.

**Y la red de abajo funcionó, lo verifiqué:** el hook `SessionEnd` commitea
`docs/relevo/` si quedó escrito y sin commitear. El commit `a6481b4d` (10/10 19:05) dice
textual «Lo hizo el hook SessionEnd, no el modelo: la sesion cerro con su relevo escrito y
sin commitear», y rescató `docs/relevo/chats.md` (72 líneas). Sin eso, ese archivo estaba a
un `git clean` de desaparecer.

⚠️ **La red sólo salva lo que esté ESCRITO.** Si la sesión se corta antes de escribir su
relevo, no hay nada que commitear.

### `.gitattributes`: dos archivos que git no puede normalizar — `f352da78` (08/10 23:49)

El repo corre con `core.autocrlf=true`, así que git le cambia los saltos de línea a todo lo
que considere texto. Hay dos excepciones, las dos escritas:

```
public/replay/** -text                    # un bundle minificado es un binario con suerte
scripts/claude-hooks/*.sh text eol=lf     # con CRLF, bash falla en la 1a línea y el hook
                                          # no corre — y va con suppressOutput, así que
                                          # queda MUDO
```

La primera costó un push (05/10): `public/replay/1/r.js` pesaba 63.925 B en el clon y 63.930
en un worktree recién creado — cinco bytes de cinco saltos convertidos a CRLF — y el guard
del pre-push frenó el push sobre un archivo IDÉNTICO.

### Entra una TERCERA cuenta — `bf40ad44` (10/10 19:07)

El último commit de la ventana, y es literalmente para vos si estás leyendo esto desde la
cuenta nueva. Lo que cambió:

- **El titular de una cuenta sale de `~/.claude/cuentas.tsv`, no de un `case` en el hook.**
  Sumar una cuenta era editar código; ahora es una línea. Si la cuenta no figura, el hook
  dice **SIN IDENTIFICAR** en vez de inventar un titular y dejar commits mal atribuidos.
- `docs/relevo/chats.md` es el índice de los 12 chats con su última actividad y qué briefing
  le toca a cada uno. Existe porque **la lista de chats está partida POR CUENTA**: la barra
  lateral de una cuenta nueva está VACÍA, aunque las transcripciones de todas vivan juntas en
  `~/.claude/projects/<clave>/*.jsonl`.
- `docs/dos-cuentas.md` pasó de «dos» a N, con los cuatro pasos para sumar una cuenta.

---

## 3. Lo que nació en la ventana

| Qué | Dónde vive | Commit |
|---|---|---|
| El lock del typecheck | `scripts/typecheck-lock.mjs` | `75314fc1`, `d0199821` |
| El hook de bitácora y guardado automático | `scripts/claude-hooks/bitacora-sesion.sh` | `8c05915d` |
| `.gitattributes` con el eol del hook | `.gitattributes` | `f352da78` |
| Titular por tabla + índice de chats | `~/.claude/cuentas.tsv`, `docs/relevo/chats.md` | `bf40ad44` |
| El token clásico de la API deja de guardarse en claro | `scripts/agente-token-a-hash.ts` | `dc25a921` |
| Migración de secuencias a grafo | `scripts/migrar-secuencias-a-grafo.mts` | tanda del chatbot 08/10 |
| El recordatorio pasa a ser una automatización | `scripts/recordatorio-a-automatizacion.mts` | `c309b390` |
| Envoltorio del replay | `scripts/replay-envoltorio.js` | tanda del grabador 08/10 |

Scripts agregados en la ventana, completo (12): `agente-token-a-hash.ts`,
`claude-hooks/bitacora-sesion.sh`, `claude-hooks/settings-hooks.json`,
`curso-aplicar-694.mjs`, `curso-cargar-programa.ts`, `curso-marcar-por-area.mjs`,
`migrar-secuencias-a-grafo.mts`, `plantillas-viejas.mts`, `quitar-ir-a.mts`,
`recordatorio-a-automatizacion.mts`, `replay-envoltorio.js`, `typecheck-lock.mjs`.
`scripts/` tiene hoy **306 archivos**.

### Los tests casi se duplicaron

| | 05/10 (`6785dc16`) | 10/10 (HEAD) |
|---|---|---|
| archivos `tests/*.test.ts` | 321 | **598** |
| tests que corren | — | **6.839** |

**Medido el 10/10/2026 19:03→19:05 y de nuevo 19:08→19:11**, dos corridas completas:

```
ℹ tests 6839   ℹ pass 6836   ℹ fail 2   ℹ skipped 1
ℹ duration_ms 134317  (y 155625 en la segunda)
```

---

## 4. Afirmaciones del briefing viejo que medí y son FALSAS

Este archivo no existía antes del 10/10/2026 (`ls docs/relevo/` no lo listaba), así que no
hay un briefing mío que corregir. Lo que sí corregí son **cuatro afirmaciones de
`AGENTS.md`**, que es lo que todas las sesiones leen antes de escribir código. **No las
toqué**: la regla de esta corrida es un solo archivo. Quedan acá para que alguien las
arregle.

**1. `AGENTS.md:293` dice que `npm test` son «~9 segundos».** Es el argumento con el que se
decidió NO sumarlo al pre-push. **Medido el 10/10/2026: 134 y 155 segundos**, en dos
corridas. Está viejo por un factor de ~17, y con eso el razonamiento de «son 9 segundos más
en cada push» ya no se sostiene solo: la suite se duplicó en la ventana (321 → 598
archivos).

**2. «Este `.git` lo comparten 20 checkouts»** (`AGENTS.md`, el mensaje de `d0199821` y el
comentario de `tests/typecheck-lock.test.ts`). **Medido el 10/10/2026 19:11 con `git
worktree list`: SIETE** — el clon principal más seis worktrees. Ninguno prunable
(`git worktree prune --dry-run` no devolvió nada).

**3. «SEIS worktrees con `tsc --noEmit` crudo»** (medición del 09/10). **Medido el 10/10
19:11: CUATRO**, y son los cuatro worktrees de agentes
`.claude/worktrees/wf_2927dff7-760-{1,2,3,4}`. Los otros tres (el clon, `C:/dev/mako-api` y
`../wt-chatbot`) tienen el lock cableado. El arreglo de `d0199821` los cubre igual, porque
el hook llama al lock por la ruta del clon principal.

**4. `scripts/typecheck-lock.mjs` dice que `C:\dev\mako-api` es «el otro proyecto» y que
«si algún día se cablea allá el mismo script, los dos se turnan solos».** Las dos mitades
están viejas. Medido el 10/10/2026:

```
$ cat /c/dev/mako-api/.git
gitdir: C:/Users/.../dashboard-marketing/.git/worktrees/mako-api
$ grep '"typecheck"' /c/dev/mako-api/package.json
    "typecheck": "node scripts/typecheck-lock.mjs",
```

O sea: **no es otro proyecto, es un worktree de este mismo `.git`** (en la rama
`wip/api-acciones-0910`), y **ya tiene el lock cableado**. El comentario manda a hacer algo
que ya está hecho.

---

## 5. Lo que quedó a medio hacer o sin verificar

### ⚠️ `~/.claude/cuentas.tsv` NO tiene la tercera cuenta

Es lo más concreto que queda abierto, y es de la cuenta nueva. Leído el 10/10/2026 19:13:

```
claude1	Mauricio Bustos <mbustos@elevate.com.mx>
claude2	Leandro Tejado <tejadomartin@gmail.com>
```

`bf40ad44` dejó el mecanismo listo y **probado con una `claude3` inexistente** (contesta SIN
IDENTIFICAR), pero la línea no está. Hasta que se agregue, los commits de la tercera cuenta
salen sin titular. **Falta un dato que sólo Martín tiene: quién PAGA esa cuenta** (el
comentario del archivo lo dice: el titular es quien paga, no quien la usa — la usa siempre
Martín).

El marcador de cuenta activa es aparte: `~/.claude/cuenta-activa.txt`, que al 10/10 19:13
dice `claude2`. **La cuenta NO se deduce nunca**: se lee de ese archivo, y se relee antes de
firmar un commit porque lo que inyecta el hook al arrancar es una foto.

### Dos tests en rojo que NO son de HEAD

`npm test` da 2 fallos, y **el diagnóstico obvio era el equivocado**. No es un rojo del
repo: es trabajo sin commitear de otra sesión. Lo verifiqué así (10/10 19:11):

```
✖ el tablero filtra por las DOS claves, con «Sin …» para el null…
✖ el filtro por anuncio se llama «Anuncio», la palabra de Martín…
   → tests/crm-filtro-ads.test.ts

$ git status --short
 M app/crm/CrmBoard.tsx          (+60 líneas respecto de HEAD)
 M app/crm/CrmToolbar.tsx        (+108)
 M tests/crm-filtro-ads.test.ts  (+92)
 M lib/campana-atribucion.ts
?? app/crm/arbol-seleccion.ts
```

**El test que falla está él mismo modificado**, junto con los dos archivos que lee. Es una
sesión del CRM tipeando (el último commit de ese archivo es `686c51be`, 10/10 17:08). Un
` M` mientras alguien trabaja es una **ventana, no un bug**: no se toca y no se reporta como
roto. Cuando esa sesión commitee, el rojo se va solo.

### Un test cuyo veredicto depende de la CARGA de la máquina (sin arreglar)

`tests/ads-video-procesando.test.ts`, el caso «esperarVideoListo: "no pude leer" no es "Meta
sigue procesando"». Medido el 10/10/2026:

- en la suite completa (19:03): **FALLA** — `actual: 'tope'`, `expected: 'sin_lectura'`
- el archivo solo (19:07): `ℹ tests 10 ℹ pass 10 ℹ fail 0`
- en la suite completa de nuevo (19:11): **pasa**, y fallan los dos del CRM

La causa está a la vista en el fuente: el test llama
`esperarVideoListo('123', null, { cadaMs: 1, topeMs: 40 })`. **Con 40 ms de presupuesto y
6.839 tests corriendo en paralelo, el segundo sondeo no llega antes del tope**, así que
devuelve `'tope'` en vez de la última lectura. No es un bug del código que prueba: es un
presupuesto de tiempo elegido para una máquina en reposo. **Sin verificar**: no probé si
subir `topeMs` lo estabiliza.

Por qué importa más de lo que parece: un rojo intermitente en la única red que queda enseña
a ignorar la suite entera, que es justo lo que no se puede permitir sin CI.

### Cuatro worktrees de agentes con el typecheck crudo

`.claude/worktrees/wf_2927dff7-760-{1,2,3,4}` tienen `"typecheck": "tsc --noEmit"` sin lock.
El pre-push los cubre (llama al lock por la ruta del clon principal), **pero un
`npm run typecheck` corrido a mano DESDE adentro de uno de ellos no tiene lock** y puede
volver a trabar la máquina. Tres de los cuatro están en el mismo commit (`de64b5b7`), o sea
que son restos de una corrida de agentes que no se limpió.

---

## 6. Las trampas del área (esto es lo que ahorra tiempo)

Son todas de la misma familia: **varias sesiones de Claude sobre el MISMO clon, con el mismo
`.git` y el mismo índice.** Ninguna da error; todas dan un resultado plausible.

**1. `git add <ruta>` NO acota el commit.** Se commitea TODO el índice. Si otra sesión ya
stageó algo, se va adentro de tu commit, con tu mensaje y tu trailer. Pasó el 05/10: un
commit de docs salió con una baja ajena de 430 líneas. **La ruta va AL COMMIT:**
`git commit <ruta> -F <msg>`. Y `git show --stat HEAD` después, que es lo único que dice qué
salió de verdad. Nunca `git add -A`.

**2. `git push` publica los commits de TODAS las sesiones.** Es la misma rama del mismo
clon. **No existe «retener un commit»**: si algo no tiene que salir, no se commitea. Antes
de pushear, `git log origin/main..HEAD`.

**3. `/tmp` ES COMPARTIDO.** En Git Bash es `C:\Users\marti\AppData\Local\Temp`, el mismo
para todas las sesiones. Un `probe.mjs` tuyo te devuelve la salida del script de otro chat
— y la mitad cara es `git commit -F /tmp/msg.txt`, que commitea **el mensaje de otra
sesión** con tu diff y tu trailer, y sale bien, así que nadie lo audita. Todo temporal va al
scratchpad de la sesión.

**4. Un rojo del pre-push: lo PRIMERO es `git status --short` de los archivos que el error
nombra.** `??` o ` M` ajeno → no es tuyo. Y ojo: **un guard que lee fuente no nombra su
sujeto, nombra al guard.** El test que falla casi nunca es el archivo que está mal. Dos
comandos lo resuelven:

```bash
grep -n "leer('\|readFileSync" tests/<el-test>.ts    # a quién mira de verdad
git show HEAD:<ese-archivo> | grep -c "<lo que pide>" # ¿HEAD lo tiene?
```

Si HEAD lo tiene y el disco no, no hay nada que arreglar: hay alguien tipeando. **Es
exactamente lo que me pasó con los dos rojos del CRM de la sección 5.**

**5. El `status` va en su PROPIO comando.** Un `git status && git checkout <sha> -- <ruta>`
no frena nada: `status` sale con 0 aunque la ruta esté modificada, y el `checkout` pisa el
trabajo ajeno sin aviso. Así se borró un cambio sin commitear el 08/10.

**6. Un `status` sucio puede no ser de nadie: puede ser el árbol VIEJO.** Si otra sesión
commiteó desde un worktree y este clon se puso al día con `git reset` SIN `--hard`, los
archivos quedan en disco con el contenido ANTERIOR y `status` los muestra modificados — un
revert exacto disfrazado de trabajo en curso. Duró cuatro días en septiembre. Se distingue
con `git show HEAD:<ruta> | md5sum` contra el archivo, y con `ls -l` (mtime vieja = nadie lo
editó).

**7. Un `tmp-` sin commitear es un candado para todos, y el que lo escribe es el único que
no lo sufre.** Un script de diagnóstico con un error de tipos bloqueó el push de las otras
dos sesiones ~3 horas; su autor no se enteró nunca, porque su sesión sabía que era suyo.
**Un script temporal se borra al terminar la medición.** Y antes de borrar uno ajeno, se
pregunta.

**8. Un «remote rejected» PUEDE significar «ya está subido».** El push de una sesión se
lleva los commits de la otra. Antes de rebasar o armar un worktree para arreglar una
divergencia que no existe:

```bash
git merge-base --is-ancestor <tu-commit> origin/main && echo "ya está en el remoto"
```

**9. El próximo número de migración es un recurso COMPARTIDO.** Dos sesiones eligen el mismo
a la vez (pasó el 05/10 con `0190`). Antes de nombrar una: `git pull` y
`ls supabase/migrations/ | tail -5`.

**10. `npm test` antes del `git add` no ve los archivos nuevos.** Los guards que barren el
repo enumeran con `git ls-files`, que lista **el ÍNDICE y no el disco**. Medido el 29/09: la
suite dio verde con un `volvé` escrito en un módulo nuevo, y rojo después del `git add`. Con
archivos nuevos: `git add` primero, `npm test` después.

**11. El fin de línea es POR ARCHIVO y las herramientas de Git Bash mienten.**
`core.autocrlf=true` deja el repo MEZCLADO: dos vecinos del mismo directorio pueden estar en
formatos distintos. El síntoma no es un error — un script de parcheo contesta «0
coincidencias» sobre un ancla copiada carácter por carácter del propio archivo. **`cat -A`,
`od -c` y `grep $'\r'` del Git Bash mienten en la dirección tranquilizadora**: se cuenta con
node. Y **todo test que haga `readFileSync` de un fuente normaliza con
`.replace(/\r\n/g, '\n')` ANTES de buscar** — el 06/10 seis agentes encontraron por separado
los mismos 7 rojos por esto.

**12. Pushear desde un worktree limpio cuando el árbol tiene trabajo ajeno que no compila
—nunca `--no-verify`.** `git worktree add --detach <ruta> main`, un junction a
`node_modules` (`New-Item -ItemType Junction`), `git push origin HEAD:main` desde ahí.

⚠️ **Y en ese worktree `npm run build` no corre tal cual**: con `node_modules` como
junction, Turbopack aborta con «Symlink … points out of the filesystem root». Hay que
apuntar `turbopack.root` a una carpeta que contenga a los dos, SÓLO para ese build, y
restaurar `next.config.ts` después (comprobando con `git diff -- next.config.ts` vacío).

⚠️ **Y el build deja MÁS junctions que el que pusiste:**
`.next/node_modules/postcss-<hash>` y `sharp-<hash>` apuntan a los paquetes DEL CLON (medido
el 10/10). `git worktree remove --force` no los sigue y deja la carpeta a medias — que es
cuando aparece la tentación de un `Remove-Item -Recurse`, **y ése sí los seguiría y le
borraría `postcss` y `sharp` al clon**. Se listan
(`Get-ChildItem <ruta> -Recurse -Force -Attributes ReparsePoint`), se saca cada uno con
`cmd /c rmdir`, y recién con cero enlaces se borra la carpeta.

**13. Un `'use server'` que exporta algo que no sea una función async TIRA EL BUILD, y el
typecheck da 0 errores.** Turbopack escupe 125 errores que listan media app, con el archivo
culpable en el PRIMERO de la lista (la reacción es mirar el final: ahí está el ruido). El
deploy queda en Error y producción sirve la versión anterior. Si tocaste un archivo
`'use server'` o una ruta nueva, corré `npm run build` una vez antes de pushear. Hay guard
desde el 05/10 (`tests/campana-producto.test.ts`).

**14. Si BORRASTE una ruta, corré `npx next typegen`.** `.next/types/validator.ts` sigue
nombrando la ruta borrada y el typecheck del clon compartido queda rojo para TODAS las
sesiones — o sea, el pre-push de los vecinos bloqueado por un archivo generado.

**15. Un push cuesta lo mismo dure lo que dure el build** (~US$0,105 con la máquina en
`turbo`; US$0 con Standard y on-demand concurrency apagado). Agrupá commits. Y **pushear no
es desplegar**: se verifica con `vercel ls`.

### Y la trampa de escribir, que no es de git

**Todo texto va por `Write` a un archivo, nunca por la línea de comandos.** El Bash de este
entorno se come las barras invertidas y **EJECUTA los backticks**. Vale para mensajes de
commit, para documentos y para cualquier cosa con comillas o `$`. Escribí este archivo con
`Write` por esa razón.

**Y `Grep` sirve para ENCONTRAR, no para CITAR.** La herramienta de búsqueda reescribe `/`
como `\` en el CONTENIDO que devuelve: un `//` que vuelve como `\` es la firma. Costó un
hallazgo publicado como «bug vivo en producción» sobre una línea que nunca estuvo rota.
Antes de reportar un bug que depende de un CARÁCTER, releé la línea con `Read`.

---

## 7. Qué espera una decisión de Martín

**1. La línea de `claude3` en `~/.claude/cuentas.tsv`.** Es un dato, no una decisión
técnica: **quién paga la tercera cuenta**, con su mail. El mecanismo ya está
(`bf40ad44`, probado con una cuenta inexistente). Mientras falte, los commits de la cuenta
nueva salen sin titular y no se puede reconstruir quién hizo qué.

**2. ¿`npm test` entra al pre-push?** El argumento escrito para dejarlo afuera
(`AGENTS.md:293`) es «son ~9 segundos más en cada push», y eso hoy es falso: medí 134-155 s.
Las opciones:
- **(a) Dejarlo afuera** y corregir el número en `AGENTS.md`. Sigue dependiendo de que cada
  sesión se acuerde — y ya se pagó una vez (el renombre de «Guiones» a «Ads Writer» se
  desplegó con el test del título roto en `main`).
- **(b) Sumarlo entero:** +134 s en cada push, con el pre-push ya corriendo 13 chequeos.
- **(c) Sumar sólo los tests que tocan lo que cambió**, al estilo de
  `scripts/hooks-en-orden.sh` (que corre UNA regla sobre los `.tsx` que cambian contra
  `origin/main`, en ~15 s). Es más trabajo y es lo único que escala con una suite que se
  duplicó en cinco días.

**3. El presupuesto de `tests/ads-video-procesando.test.ts`.** Falla sólo en la suite
completa por `topeMs: 40`. Opciones: subir el tope (el test pasa a tolerar carga y mide un
poco menos), o aislar ese caso del paralelismo. **Hoy el costo real es que la suite tiene un
rojo intermitente**, y eso enseña a ignorarla.

**4. ¿Se limpian los cuatro worktrees de agentes?**
`.claude/worktrees/wf_2927dff7-760-{1..4}` tienen el typecheck crudo y tres están en el mismo
commit. **Antes de borrarlos hay que mirar si tienen trabajo sin commitear** — en septiembre
seis no se pudieron borrar por eso. Y la limpieza va con el protocolo de junctions de la
trampa 12, no con un `Remove-Item -Recurse`.

---

## Apéndice: el mapa de dónde está escrito el resto

| Qué | Dónde |
|---|---|
| Las reglas que gobiernan código nuevo | `AGENTS.md` (7.562 líneas; es lo que todos leen antes de escribir) |
| El protocolo de las N cuentas | `docs/dos-cuentas.md` |
| El guardado automático por cuota | `docs/guardado-automatico.md` |
| En qué chats estuvo trabajando | `docs/relevo/chats.md` |
| El estado de la ventana, por área | `docs/relevo/` + su `README.md` |
| Los hallazgos de infra | `docs/hallazgos-infra.md` (índice en `docs/hallazgos.md`) |

**Cómo se leen los hallazgos: `Grep` de la RUTA del archivo que vas a tocar, no abriendo el
documento.** Cada entrada trae adentro la línea `**Vive en:** <archivo>`. Abrir
`docs/hallazgos-comunicacion.md` entero son ~17.000 tokens; grepear la ruta cuesta dos
órdenes de magnitud menos y no falla por elegir mal el área. `Grep` **es** el índice.

---

*Escrito el 10/10/2026 entre las 19:00 y las 19:20, desde el clon principal, con la cuenta
`claude2` y HEAD en `bf40ad44`. Las mediciones de tests y typecheck son de esta sesión y
tienen la hora puesta: la suite se corrió tres veces y los rojos cambiaron entre corridas
porque hay otra sesión trabajando en el CRM sobre este mismo clon. Si vas a repetir un dato
de acá, volvé a medirlo.*
