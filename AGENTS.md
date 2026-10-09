<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quién es quién: MaKo es de Martín. Mauricio es un CLIENTE

**«El dueño», en todo este repo, es Martín Koncke**: el que decide, el que reporta y el que
le habla a Claude. Las ~30 veces que este archivo dice «el dueño reclamó», «el dueño lo
rechazó», «la pantalla del dueño», es él.

**Mauricio Bustos es un CLIENTE de MaKo. Nunca el dueño.** No se escribe «el dueño»
refiriéndose a él, ni se le atribuye el producto, la marca ni la voz de MaKo.

Se confunde porque todo lo histórico apunta a él, y ninguna de estas cosas lo hace dueño:

- **ws1 es suyo y es `OWNER_WS`.** La constante se llama así porque MaKo nació como el
  dashboard de su agencia: es el *primer* workspace, no el del dueño. Ver «`OWNER_WS` vale
  1 y el 1 es Mauricio, un cliente», más abajo.
- **Parte de la infraestructura está a su nombre**: el equipo de Vercel
  (`mbustos-4239s-projects`) y varias credenciales del ws1.
- **La cuenta 1 de Claude Code es suya** (ver «Hay dos cuentas de Claude»): paga esa cuenta,
  no es dueño del producto.

Ya se corrigió dos veces y volvió las dos, porque una memoria lo afirmaba y cada sesión lo
repetía. La segunda vez (07/10/2026) costó una recomendación entera armada sobre la premisa
falsa: proponer `mauricio@hola-mako.com` como remitente de MaKo.

# LO PRIMERO AL ABRIR: si te preguntan «¿en qué quedamos?», leé `docs/relevo.md`

Martín trabaja con **dos cuentas de Claude** y se pasa de una a la otra cuando se le acaban
los tokens. Al entrar, abre un chat y pregunta **«en qué quedamos»** — y el 100% del trabajo
intermedio lo hizo la otra cuenta, no vos. Contestar desde lo que viviste en ESTA sesión es
contestar sobre el 0%.

**`docs/relevo.md` es la respuesta.** Se pisa en cada traspaso y siempre describe la ventana
que acaba de cerrar: qué se hizo, qué quedó a medio hacer y con qué archivo, y qué espera una
decisión suya. Al lado, `docs/relevo/` tiene un briefing por área o por chat, y su
`README.md` dice cuál le toca a cada uno.

⚠️ **Esta regla existe porque faltaba y se pagó.** El 05/10/2026 la cuenta 2 dejó el relevo
escrito y avisado; aun así, la sesión que entró tuvo que **descubrirlo sola** mirando fechas
de modificación en `docs/`. Nada en este archivo mandaba a leerlo. Un traspaso que depende de
que el que entra tenga la corazonada de buscarlo no es un traspaso.

El orden, y son tres comandos:

1. `cat docs/relevo.md` — la ventana anterior, completa.
2. `git log --oneline -20` y `ls -lt docs/hallazgos-*.md` — qué se tocó DESPUÉS de ese relevo.
3. El `docs/hallazgos-<área>.md` del área que vayas a tocar.

⚠️ **El relevo es material de SEGUNDA MANO** y él mismo lo dice: sale de leer lo que la otra
cuenta escribió, no de releer el árbol. Antes de actuar sobre una afirmación suya,
verificala — y si algo contradice lo que medís, mandá tu medición y decilo.

Y al revés, cuando la ventana se cierra: **el relevo lo escribe cada chat sobre lo suyo**, no
un lector que no estuvo. El que hizo el trabajo es la única fuente de primera mano; a un
briefing ajeno, a lo sumo, se le pegan arriba las correcciones medidas.

⚠️ **Y el relevo se COMMITEA en cuanto se escribe, no al final de la tanda.** El final de la
tanda es justo lo que la cuota se come. El 06/10/2026 la cuenta 1 escribió seis briefings entre
las 16:30 y las 16:53 — 1.461 líneas, uno por área — y se quedó sin tokens antes del commit:
quedaron `??` en `docs/relevo/`, a un `git clean` de desaparecer, y la cuenta que entró no los
veía en el repo. Se rescataron en `035931f7`. Un relevo sin commitear no es un relevo: es un
borrador en el disco de una sesión que ya no existe.

**Cómo se sabe que se viene el corte: lo avisa un hook, solo, al 85, 90 y 95% semanal.** El %
lo devuelve `get_usage` (herramienta de la app), y ningún script lo puede leer: no queda en
ningún archivo local. Así que el modelo mide y lo deja en `~/.claude/uso-semanal.txt`, y el
hook `UserPromptSubmit` (`~/.claude/bitacora-sesion.sh turno`) lo lee **en cada mensaje de
cada chat**: si la medición tiene más de 30 minutos te pide que vuelvas a medir —hacelo, con el
comando que trae—, y si se cruzó un umbral te da la orden de cierre una sola vez y saca una
FOTO local de lo sin commitear (`refs/wip/semanal-u<N>-<fecha>`, no se pushea). **Cuando
llegue la orden, se cumple antes de seguir**: relevo escrito y commiteado, lo terminado
pusheado, lo a medias NO (pushear es desplegar a clientes, y el código sigue en este clon al
cambiar de cuenta). El detalle, las piezas y cómo replicarlo, en
[docs/guardado-automatico.md](docs/guardado-automatico.md); la copia versionada del hook, en
`scripts/claude-hooks/`.

**Y si igual se corta, hay una red que no depende del modelo.** El hook `SessionEnd`
(`~/.claude/bitacora-sesion.sh fin`) commitea `docs/relevo/` y `docs/relevo.md` si quedaron
escritos y sin commitear: por RUTA (no se lleva lo que otra sesión tenga stageado), con lock
para cuando cierran varias a la vez, y **sin pushear** (la otra cuenta usa este mismo clon).
Dispara aunque no quede cuota — la bitácora tiene los `fin` de las sesiones del 06/10 que se
habían quedado sin tokens. Probado en un worktree descartable: commiteó un relevo nuevo y uno
modificado, dejó afuera un archivo ajeno stageado, y una segunda corrida no hizo nada.
**La red sólo salva lo que esté ESCRITO**: si el chat se corta antes de escribir su relevo, no
hay nada que commitear. Por eso el umbral del 85% sigue siendo la parte que importa.

# El typecheck NO corre en el build: lo bloquea un hook de pre-push

`next build` tiene `typescript.ignoreBuildErrors: true` (ver next.config.ts). **No es
descuido**: ese paso eran ~65 de los ~99 segundos de cada compilación. El mismo chequeo
corre local en ~7 segundos y gratis.

⚠️ **El porqué original de este cambio era el diagnóstico equivocado.** Se hizo para bajar
la factura de Build CPU, y no podía: Vercel factura **`ceil(minutos) × vCPU`**, así que
bajar de 99 s a 27 s solo mueve de `ceil(2 min)` a `ceil(1 min)` — un 2x como techo. Lo que
gobierna la factura es el **tamaño de la máquina de build**, no la duración. El detalle
está en [docs/hallazgos-infra.md](docs/hallazgos-infra.md) → «La factura de builds no mide
TIEMPO».

La red de seguridad se movió a **`.git/hooks/pre-push`**: corre `npm run typecheck` y
**bloquea el push** si falla. Vive en `.git`, así que aplica a cualquier sesión que
pushee desde este clon sin que tenga que saberlo (hay varias sesiones en paralelo).

⚠️ **Los hooks de git NO se versionan.** Si se reclona el repo, el hook desaparece **en
silencio** y un error de tipos vuelve a llegar a producción en vez de frenar el build.
Si `.git/hooks/pre-push` no existe, recrealo con este contenido y `chmod +x`:

```sh
#!/bin/sh
LOCK_TSC="$(dirname "$(git rev-parse --git-common-dir)")/scripts/typecheck-lock.mjs"
echo "[pre-push] Chequeando tipos…"
if [ -f "$LOCK_TSC" ]; then node "$LOCK_TSC"; else npm run --silent typecheck; fi
if [ $? -ne 0 ]; then
  echo "\n  ✖ PUSH BLOQUEADO: hay errores de tipos.\n"
  exit 1
fi
echo "[pre-push] ✓ Tipos OK."
```

⚠️ **Y el typecheck se llama POR LA RUTA DEL CLON PRINCIPAL, no con `npm run typecheck`.**
`npm` resuelve el script del `package.json` **del worktree**, y este `.git` lo comparten 20
checkouts: los que se checkoutearon antes de que el lock existiera (commit `75314fc1`,
08/10/2026) traen `"typecheck": "tsc --noEmit"` **crudo**. Medido el 09/10: **SEIS worktrees
con trabajo sin commitear** podían disparar desde el pre-push un `tsc` de 2,3 GB sin esperar
a nadie — que es exactamente lo que trabó la máquina, y el `package.json` del clon estaba
perfecto. **Un lock que vive en un archivo versionado protege a un COMMIT, no a una
máquina**; el único lugar común a todos los árboles de trabajo es el hook. El cwd sigue
siendo el del worktree, así que `tsc` lee SU `tsconfig`: lo que se serializa es la RAM, no
lo que se chequea. Lo fija `tests/typecheck-lock.test.ts`, que se saltea donde no hay hook
legible (un clon nuevo, o un worktree donde `.git` es un archivo).

Reglas para cualquier agente que trabaje acá:
- **Nunca** uses `git push --no-verify` (saltea el único chequeo de tipos que queda).
- Antes de pushear, si tocaste rutas nuevas, corré `npm run build` una vez: el hook usa
  `tsc --noEmit`, que solo valida los tipos generados de rutas si `.next/types` está fresco.
- **Y si BORRASTE una ruta, corré `npx next typegen` en el clon.** `.next/types/validator.ts`
  sigue nombrando la ruta borrada y el typecheck del clon compartido queda rojo para TODAS las
  sesiones — o sea, el pre-push de los vecinos bloqueado por un archivo generado.
- **Un push cuesta lo mismo dure lo que dure el build** (~US$0,105 con la máquina en
  `turbo`; **US$0** con Standard y on-demand concurrency apagado). Agrupá commits y pusheá
  cuando haya algo que probar, no después de cada paso interno — lo que se ahorra es el
  deploy entero, nunca segundos.

⚠️ El hook hace TRECE chequeos: los tipos, que las skills tengan el contrato del
`detalle` al día (`node scripts/sync-contrato-detalle.mjs --check`), que el manual de
marca tenga la gramática de MaKo al día
(`node --import tsx scripts/sync-gramatica-doc.mjs --check`), que `plugin/` —la copia
PÚBLICA de la skill de Claude— esté generada de la versión viva
(`node --import tsx scripts/generar-plugin.mjs --check`) y que el zip que el cliente
descarga desde /video-generator no haya quedado viejo respecto de `extension/`
(`node scripts/zip-extension.mjs --check`) y que `app/conocimientos/catalogo.ts` no importe
fichas que no estén **en git** (`node scripts/curso-catalogo-verificar.mjs`) y que
ningún hook de React quede detrás de un `return`
(`sh scripts/hooks-en-orden.sh "$1"`) y que el catálogo de operaciones del puente a
Flow esté al día (`node --import tsx scripts/sync-operaciones.mjs --check`) y que el
parcheador del cuerpo de BOQ esté al día
(`node --import tsx scripts/sync-boq-patch.mjs --check`) — ése decide el cuerpo de un
pedido que GASTA CRÉDITOS del cliente, así que la versión que corre tiene que ser la
que se probó— y que el lector de respuestas de BOQ y el juicio de puede-filmar de la
extensión estén al día (`node --import tsx scripts/sync-boq-respuesta.mjs --check` y
`node --import tsx scripts/sync-puede-filmar.mjs --check`) y que la referencia de la API
de MaKo (`docs/api-mako.md`) y la lista de lo que sale por HTTP
(`tests/api-mako-http.snapshot.txt`) digan lo mismo que el registro
(`node --import tsx scripts/generar-api-doc.mjs --check`, que compara contra HEAD y se
abstiene si `lib/api-mako` tiene cambios sin commitear, para no frenar a la sesión
vecina). Y que los artefactos del replay de sesion (`public/replay/<v>/`) no hayan quedado viejos
respecto de `node_modules` (`node scripts/replay-libs.mjs --check`): ese `r.js` lo baja el
navegador de un VISITANTE de la landing de un cliente, asi que si queda viejo el que graba
es el de `public/` y no hay un solo error que lo diga. Es la misma familia que el zip de la
extension y que `plugin/`. Si lo recreás, poné los trece.

⚠️ El último se agregó el 29/08/2026, después de que **producción estuviera 46 minutos en
la versión vieja sin que nada lo dijera**: un commit subió `catalogo.ts` con 18 imports
nuevos y no los archivos que esos imports nombran —al commitear por ruta explícita se sube
el índice y no lo indexado—, el build murió con 18 «Module not found» y el `git push` había
salido con 0. **El typecheck no lo caza a propósito**: corre contra el árbol de trabajo,
donde los archivos existen; lo que falta es que existan EN GIT. Son dos preguntas distintas
y sólo una tenía guarda. Y ahora es más fácil que pase, no menos: la cola llama sola a
`curso-al-catalogo.mjs` después de publicar cada curso, así que cada curso nuevo agrega un
import por su cuenta.

El de los hooks de React se agregó el 03/09/2026, después de que un
**«Minified React error #300»** llegara a producción. Es `didRenderTooFewHooks`, y
no es un componente que se ve mal: es la **pantalla entera en blanco**, con un
error que no dice ni el archivo ni la línea. La causa fue un `useExtensionVieja()`
que había quedado DESPUÉS de un `return` temprano, así que en unos renders se
llamaba y en otros no.

**No lo cazaba nadie**: llamar un hook es una llamada a función perfectamente
tipada, así que el typecheck lo deja pasar, y el hook no corre los tests. `npm run
lint` sí lo caza y tarda **3 min 19 s** — un chequeo que cuesta eso o se saltea o se
saca. `scripts/hooks-en-orden.sh` corre UNA regla sobre los `.tsx` que cambian
contra `origin/main`, y son ~15 s.

⚠️ **Saltea los archivos con cambios sin commitear**, y los lista. Con dos sesiones
sobre el mismo clon, el archivo de al lado puede estar a medio escribir por el
vecino, y frenar un push por trabajo ajeno es el candado sin llave que la regla de
la casa prohíbe.

⚠️ Y su config (`scripts/eslint-hooks.config.mjs`) **hereda la del repo y le vacía
las reglas**, en vez de declarar un solo plugin. Con un plugin solo, todo archivo
que tenga un `eslint-disable` de otro plugin hace que eslint conteste «Definition
for rule … was not found» y salga con error — o sea, el guard bloquearía el push por
un comentario perfectamente válido. Y le saca `parserOptions.project`: con el
análisis de tipos puesto son 64 s en vez de 15, y `rules-of-hooks` mira la FORMA del
código, no los tipos.

El del zip existe por la misma razón que el de `plugin/`: **el artefacto que se
distribuye no es el fuente**. `public/mako-puente.zip` se commitea para que Vercel lo
sirva estático, así que una extensión arreglada y un zip sin regenerar dejan al cliente
instalando la versión vieja — sin error, sin síntoma, y con el bug que se acaba de
arreglar todavía adentro. La huella se calcula sobre el CONTENIDO de los archivos y no
sobre el zip, porque un zip trae timestamps y no es reproducible byte a byte.

⚠️ **UNA GUARDA DEL PRE-PUSH CONTESTA SOBRE LO QUE SE PUBLICA, NO SOBRE TU DISCO.** Todo
lo que lea del árbol de trabajo es una pregunta sobre otra cosa — y con dos sesiones sobre
el mismo clon, sobre el trabajo a medias de la otra. Ya bloqueó pushes en las dos
direcciones: el verificador del catálogo frenó a la sesión vecina el 29/08, y el del zip
de la extensión frenó al portal de cursos el 30/08 porque el vecino tenía tres `.js` sin
commitear. En `--check` se lee de **HEAD** (`git ls-tree` + `git show`); generando se lee
el disco, que ahí sí es lo correcto.

⚠️ **Y TODA GUARDA QUE COMPARE TEXTO GENERADO CONTRA UN ARCHIVO NORMALIZA LOS `
`.** El
bloque se inserta con `
` sobre un archivo que en disco es CRLF (`core.autocrlf=true`), así
que el archivo queda MEZCLADO y la comparación exacta pasa **sólo en el clon donde el script
corrió alguna vez**. En un clon nuevo, un worktree o CI, git normaliza todo a CRLF y la
guarda frena el push sobre un archivo idéntico. Las CUATRO de esta familia lo tenían
(`sync-contrato-detalle`, `sync-gramatica-doc`, `generar-plugin`, `zip-extension`). Va
`const sinCR = (s) => s.replace(/
/g, '
')` para DECIDIR si escribir; lo que se
escribe no se toca.

⚠️ **Y normalizar al COMPARAR no alcanza si antes se TRANSFORMA el fuente.** `sync-boq-patch`
(la quinta) comparaba con `sinCR` pero pasaba el `.ts` crudo por regex que esperan `
`: en un
worktree el fuente llega en CRLF, las regex no calzan y el `--check` frena sobre un archivo
idéntico (11/09/2026). El `sinCR` va sobre la ENTRADA, antes de cualquier `replace`.

⚠️ **Y se prueba en un árbol recién checkouteado, no en el tuyo.** Las cuatro daban «✓ al
día» en el repo, que es el único lugar donde ese bug no puede verse. Comprobar una guarda
donde no puede fallar es no comprobarla.

⚠️ **Y VALE IGUAL PARA LOS TESTS QUE LEEN FUENTE.** El 06/10/2026 seis agentes, cada uno en su
worktree, encontraron por separado los mismos 7 rojos en cuatro tests que cortaban el fuente
con `'\n}\n'`: en el clon los archivos estaban en LF y pasaban. Todo test que haga
`readFileSync` de un fuente normaliza con `.replace(/\r\n/g, '\n')` ANTES de buscar.

⚠️ **Si el árbol compartido tiene trabajo ajeno que no compila, se pushea desde un worktree
limpio — nunca con `--no-verify`.** `git worktree add --detach <ruta> main`, un junction a
`node_modules` (`New-Item -ItemType Junction`), `git push origin HEAD:main` desde ahí, y
después `git worktree remove --force` + `git worktree prune`.

⚠️ **Y en ese worktree `npm run build` NO corre**: con `node_modules` como junction, Turbopack
aborta con «Symlink [project]/node_modules is invalid, it points out of the filesystem root»
(`turbopack.root = __dirname`). El junction sirve para `tsc` y los tests; el build va en el
clon. Y antes de `git worktree remove`, el junction se saca con `cmd /c rmdir`: un
`Remove-Item -Recurse` de PowerShell 5.1 sobre él borra el `node_modules` del clon.

⚠️ **Lo que el hook NO hace es correr los tests** (`npm test`), y por eso hay que acordarse
a mano. Un renombre pasa el typecheck perfecto y rompe una aserción sin que nada avise: al
renombrar la tab «Guiones» a «Ads Writer» el push salió verde, se desplegó a producción, y
el test del título quedó roto en `main`. **Si tocás `nav.ts`, los títulos de pestaña, un
catálogo o cualquier cosa que un test mire por su NOMBRE, corré `npm test` antes de
pushear.** No se suma al hook a propósito: son ~9 segundos más en cada push y la mayoría
de los cambios no los necesita — pero los renombres, sí.

# En un archivo `'use server'` SOLO se exportan funciones async

Un `export const`, un `export type` con valor, un `export function` sincrónico: los tres
**tipan perfecto, pasan el typecheck y TIRAN EL BUILD**. Y no lo tiran con un error que
nombre la línea: Turbopack escupe **125 errores** que listan media app por el grafo de
imports, con el archivo culpable en el primero de la lista y el resto puro ruido.

Medido el 05/10/2026: `export const TOPE_LOTE = 200;` en `app/crm/actions.ts`. El
typecheck dio **0 errores** —es una constante perfectamente tipada—, el pre-push pasó sus
trece chequeos, el push salió, y el deploy quedó en **Error** con producción sirviendo la
versión anterior. O sea el modo de falla de siempre: no se rompe nada para el cliente y
**tampoco llega nada**, sin que ninguna pantalla lo diga.

- **La constante va donde se la pueda exportar**: un módulo de datos sin `'use server'`,
  o sin exportar si sólo la usa ese archivo (un guard que la lee del fuente no necesita
  que se exporte).
- **El typecheck NO es la red acá, y el pre-push tampoco**: los trece chequeos no compilan
  la app. Lo caza `npm run build`, que es justamente lo que AGENTS.md ya pide correr
  «si tocaste rutas nuevas» — y hay que leerlo también como **«si tocaste un archivo
  `'use server'`»**.
- **Y el síntoma delata el archivo en el PRIMER error, no en el último.** Con 125 errores
  la reacción es mirar el final; ahí están los `Import traces`, que nombran a cualquiera.
- **Y desde el mismo día tiene GUARD**: `tests/campana-producto.test.ts` barre `app/` y `lib/`
  y falla nombrando archivo y línea si un archivo `'use server'` exporta algo que no sea una
  función async. Probado rompiéndolo. La regla escrita sola no alcanzó ni para la sesión que la
  escribió.

# Hay dos cuentas de Claude trabajando sobre este repo

No estás solo en este clon. Hay **dos cuentas** (`claude1` / `claude2` en el `$PROFILE`)
con cuotas desfasadas: una corre miércoles a viernes, la otra sábado a martes. En
principio no coinciden, pero pueden.

Reglas que salen de eso:

- **Antes de tocar nada, `git status`.** Si hay archivos modificados que no son tuyos,
  son de la otra sesión: dejalos donde están.
- **Pero un `status` sucio puede no ser de nadie: puede ser el árbol VIEJO.** Si la otra
  sesión commiteó desde un worktree y este clon se puso al día con **`git reset` sin
  `--hard`**, HEAD y el índice avanzan y **el árbol de trabajo no se toca**: los archivos
  de ese commit quedan en disco con el contenido ANTERIOR, y `git status` los muestra como
  «modificados» — o sea, como un revert exacto disfrazado de trabajo en curso. Pasó el
  03/09/2026 (`a3c7db19` a las 21:39 desde el worktree, `reset: moving to origin/main` a
  las 21:46) y duró cuatro días sobre `app/admin/dev/areas.ts`, `tests/dev-areas.test.ts`
  y `docs/hallazgos-infra.md`. Acá «commiteá por ruta explícita» no salva: **la ruta
  explícita es justo la envenenada.** Se distingue en dos comandos, y conviene correrlos
  sobre cualquier modificado que no reconozcas: `git show HEAD:<ruta> | tr -d '\r' |
  md5sum` contra el archivo (si el disco es el PADRE de un commit reciente, es esto) y
  `ls -l` (una mtime vieja dice que nadie lo editó). La cura es `git checkout -- <rutas>`.
- **Nunca `git add -A`.** Commiteá por ruta explícita. El día que coincidan, `add -A` se
  lleva el trabajo a medias de la otra sesión adentro de tu commit y nadie se entera
  hasta que rompe.
- ⚠️ **Y «por ruta explícita» es también el `git commit`, no sólo el `git add`.** Un `git
  commit` PELADO commitea el ÍNDICE ENTERO, así que se lleva lo que el vecino ya tenía
  stageado aunque vos hayas hecho `git add` sólo de lo tuyo. Medido el 30/09/2026: la otra
  sesión tenía STAGEADO el borrado de `app/agencia/Disparador.tsx` y todavía no había
  commiteado el `FlujoAviso.tsx` que deja de importarlo; un commit del CRM se llevó el
  borrado, publicó **la mitad de un cambio ajeno** y tiró el build de producción con
  «Module not found: Can't resolve './Disparador'». El typecheck no lo caza —en el árbol de
  trabajo el import ya no está— y los tests tampoco. Va `git commit -- <rutas>`, o
  `git status --short` antes de cada commit mirando la PRIMERA columna: lo que está en
  verde y no es tuyo, viaja.
- **Commitear por ruta explícita NO alcanza: lo que se mira es el HUNK.** Un mismo
  archivo puede tener trabajo de las dos sesiones. Pasó con `lib/razones.ts`: una sesión
  agregó una fila a `PASO_TXT` y la otra una función nueva, y al armar el commit «por
  rutas» el archivo se descartó entero por ajeno — con lo cual el commit quedó sin una
  línea que el compilador exigía. Antes de excluir un archivo tocado por los dos, `git
  diff <archivo>` y separá: `git checkout HEAD -- <archivo>`, reaplicá **solo tu hunk**,
  commiteá, y devolvé el contenido completo al working tree.
- ⚠️ **Y un `git status` encadenado con `&&` no frena nada.** Mirar el estado de una ruta antes de
  `git checkout <sha> -- <ruta>` es la regla, y en una sola línea no sirve: `status` sale con 0
  aunque la ruta esté modificada, así que el `checkout` corre igual y pisa el trabajo ajeno sin
  aviso. Medido el 08/10/2026: así se borró un cambio sin commitear de la sesión de Customer
  Success en `docs/hallazgos.md`. El `status` va en su PROPIO comando, se lee, y si la ruta
  aparece ` M`, esa ruta no se toca y se avisa.
- **Nunca `--amend` sin volver a mirar que HEAD siga siendo tuyo.** Entre tu commit y tu
  amend, la otra sesión puede haber commiteado: el amend le reescribe el commit A ELLA,
  con tu mensaje. Pasó. Se recupera con `git reset --soft <su-hash>` (nunca `--hard`: se
  llevaría su trabajo sin commitear), pero la forma de no llegar ahí es `git log -1`
  antes de cada amend.
- **Y la app puede dejar de hidratar por culpa de la otra sesión.** Un `export` a medias
  en un client component rompe el bundle ENTERO: la página se ve perfecta (el HTML es
  del server) pero ningún botón responde. Antes de diagnosticar tu propio cambio, probá
  otra ruta cualquiera — si tampoco hidrata, no es tuyo.
- **La sesión que ABRE lee dónde quedó la otra, y arranca por ahí.** El desfase de cuotas
  no parte el trabajo en dos temas: Martín viene de trabajar en la otra cuenta y **lo
  natural es que siga con lo último**. Así que lo último trabajado es el contexto por
  defecto de tu sesión, no un dato de archivo. Se averigua en tres comandos: `git log
  --oneline -20` (de qué se trató), `ls -lt docs/hallazgos-*.md` (qué ÁREA se tocó
  último) y `ls -lt` sobre la carpeta de memoria. Recién ahí, abrí el
  `docs/hallazgos-<área>.md` de esa área.
- **Antes de tocar un área — y SIEMPRE antes de contestar «¿dónde quedamos?» — leé su
  `docs/hallazgos-<área>.md`.** Es la contraparte de la cosecha de acá abajo, y sin ella
  la regla funciona solo para el que escribe. **La asimetría que lo explica:** la memoria
  se auto-carga al arrancar (y solo el ÍNDICE, no el contenido), pero `docs/hallazgos-*`
  **no se carga nunca solo** — si no lo abrís, para vos no existe. Pasó el 18/08: a
  «¿dónde quedamos?» contesté con lo que había hecho yo + `git log`, cuando lo último
  (bienvenida + grafo, temas/paletas, portal de cursos) estaba escrito con detalle en
  `hallazgos-second-brain.md`, `hallazgos-ui.md` y `hallazgos-conocimiento.md`. Nunca
  contestes «dónde quedamos» desde lo que viviste vos: el 100% del trabajo intermedio es
  de la otra sesión.
- **La sesión que cierra deja escrito dónde quedó** — en `docs/hallazgos-<área>.md`, en
  el board `/plan` o en una memoria. Si la cuota corta a mitad de camino, eso es lo único
  que sobrevive.
- **Dos sesiones no editan la misma skill ni el mismo prompt a la vez.** Se pisan igual
  que el código, pero el efecto aparece días después y en otro lado.
- **Cerrá cada commit con el trailer `Claude-Cuenta: claude1` o `claude2`.** Las dos
  cuentas commitean con el mismo autor sobre el mismo clon, así que git no las distingue
  y sin el trailer no hay forma de saber a cuál preguntarle por una decisión. Lo leen
  `/admin/docs` (la ficha de cada documento) y el Change History de `/admin/ui`; donde
  falta muestran «—», que es lo correcto: no se inventa.

  ⚠️ **La cuenta NO se deduce: se lee de `~/.claude/cuenta-activa.txt`**, que trae
  `claude1` o `claude2` y lo declara Martín. Un hook de `SessionStart` la inyecta a tu
  contexto al abrir, junto con el titular. **No la infieras de ninguna otra cosa**: el
  `userEmail` de tu contexto sale de `~/.claude.json`, se actualiza al *loguearse* y no
  al abrir sesión, así que va con retraso y miente después de cada cambio. Tampoco sirven
  el día de la semana, el config dir ni el nombre que trae el email adentro. Si el mensaje
  del hook no aparece, **preguntá** — nunca firmes adivinando. Por qué esto es tan
  terminante: hasta el 25/08/2026 se firmaba adivinando, y la firma alterna cada 2-4
  minutos sobre trabajo continuo. **Los trailers anteriores a esa fecha no son
  confiables**, y por eso no se puede reconstruir quién hizo qué antes del 25/08.

- **Fijate si hay otra sesión viva antes de tocar git.** El mismo hook cuenta las sesiones
  con actividad en los últimos 20 minutos sobre este clon y te avisa. Cuando hay otra:
  `git status` primero, commitea **por ruta explícita** (nunca `git add -A`, te llevás su
  trabajo a medio hacer dentro de tu commit) y `git pull --rebase` antes de pushear.
  El 25/08 dos sesiones trabajaron en paralelo y una reportó como «pendiente» un curso
  que la otra estaba terminando en ese mismo momento: el corpus documenta bien el pasado,
  pero **nadie documenta el presente concurrente**.

- **Cada apertura y cierre de sesión queda en `~/.claude/bitacora-sesiones.tsv`** (fecha,
  acción, cuenta, id de sesión), que lo escriben los hooks `SessionStart` y `SessionEnd`.
  Vive fuera del repo a propósito: no ensucia el árbol ni se pisa entre sesiones
  paralelas. Es la respuesta a «¿desde qué fecha a qué fecha estuve en tal cuenta?», que
  antes no se podía contestar.

- ⚠️ **El trailer va PEGADO a `Co-Authored-By`, sin línea en blanco en el medio.** Git
  sólo parsea como trailers el último bloque contiguo del mensaje: una línea vacía entre
  `Claude-Cuenta:` y `Co-Authored-By:` deja el primero AFUERA. Medido el 27/09/2026:
  `git log --format='%(trailers:key=Claude-Cuenta,valueonly)'` devuelve **vacío** para
  `72aa1109`, `50df1cb2`, `cbb6fcd2`, `6625b361`, `d9c8cf73` y `95052783`, y sólo contesta
  en `22528fd5`, que es el único con el bloque pegado. El trailer se ve perfecto leyendo
  el mensaje a ojo — por eso nadie lo notó — y cualquier herramienta que cuente commits
  por cuenta lee **0**. Es el modo de falla de siempre: no da error, da un cero plausible.

- ⚠️ **Antes de firmar, RELEÉ el marcador; lo que te inyectó el hook es una foto del
  arranque.** El contexto de `SessionStart` se calcula una vez y no se entera si Martín
  cambia de cuenta con la sesión abierta. Pasó el 27/09: tres sesiones arrancaron 10:12,
  10:13 y 10:13 leyendo `claude1`, Martín avisó a las 10:13 que se pasaba a la otra cuenta
  y reescribió el marcador **10:14:43** — y dos commits posteriores (`cbb6fcd2`, `72aa1109`)
  salieron firmados `claude1` con el marcador diciendo `claude2`. En la bitácora eso se ve
  como una sesión con `inicio claude1` y `fin claude2`, que **no es corrupción**: es el
  registro correcto de una cuenta que cambió a mitad. El comando, una línea:

  ```bash
  head -1 ~/.claude/cuenta-activa.txt
  ```

  Y si Martín dice en el chat que cambió, eso gana sobre el archivo y sobre el hook:
  reescribí el marcador en el acto, antes de seguir.

⚠️ **Y NO SON DOS SESIONES: PUEDEN SER TRES. El árbol compartido no tiene un ESTADO,
tiene una HORA.** El 04/10/2026 hubo tres a la vez sobre este clon (CRM, Chatbot y Perro
Guardián), y en un mismo día se pagó tres veces el mismo error: leer el árbol como si
fuera un hecho. Va en las DOS direcciones, y la segunda es la que no se nota:


- ⚠️ **`/tmp` está COMPARTIDO entre las sesiones: usá el scratchpad de la tuya.** Medido el
  05/10/2026 por la sesión de Chatbot: escribió `/tmp/probe.mjs`, lo corrió, y le volvió **la
  salida del script de OTRO chat** que se llamaba igual. No da error — da el resultado
  equivocado, que es peor, porque se lee como un hallazgo propio. Los nombres genéricos
  (`probe`, `t`, `check`, `out.json`) colisionan solos cuando hay tres sesiones trabajando.
  Lo mismo vale para cualquier archivo intermedio: va al directorio de scratchpad de la
  sesión, que es único por `sessionId`.

- ⚠️ **El próximo número de migración es un recurso COMPARTIDO, y dos sesiones eligen el
  mismo a la vez.** El 05/10 la sesión de Chatbot creó `0190_secuencia_cron.sql` mientras la
  del CRM ya tenía `0190_clic_con_su_punto.sql` commiteada y aplicada. Se destrabó porque el
  CRM avisó y Chatbot renumeró a `0192`; sin ese aviso entraban dos migraciones distintas con
  el mismo número. **Antes de nombrar una migración: `git pull` y `ls supabase/migrations/ |
  tail -5`,** y si al commitear alguien se te adelantó, renumerá **antes** de pushear. Si
  renumerás, borrá el archivo viejo del clon: un `0190_secuencia_cron.sql` huérfano en otro
  worktree se aplica solo el día que alguien corre las migraciones en orden.
- ⚠️ **`git add <ruta>` NO acota el commit: se commitea TODO el índice.** Si otra sesión ya
  stageó algo, `git add mi-archivo && git commit` se lo lleva adentro de tu commit, con tu
  mensaje y tu trailer. Pasó el 05/10/2026: un commit de docs salió con una baja ajena de 430
  líneas (`app/crm/[id]/EditLeadForm.tsx`) que la sesión del CRM había stageado — minutos
  después de que el mismo autor les advirtiera eso a cuatro chats. **Para acotar de verdad, la
  ruta va AL COMMIT:** `git commit <ruta> [<ruta>…] -F <msg>`, que ignora el resto del índice.
  Un archivo nuevo no se puede commitear por ruta sin estar trackeado: `git add -N <ruta>`
  primero (intent-to-add, no lo stagea). Y antes de pushear, `git show --stat HEAD` dice qué
  salió de verdad.

- ⚠️ **Y `git push` publica los commits locales de TODAS las sesiones, no sólo los tuyos.**
  Es la misma rama del mismo clon. El 06/10/2026 una sesión retenía un commit de docs para no
  taparle a su deploy anterior la señal de si compilaba, y el push de otra sesión lo publicó
  igual (`c0e2570b..6e2350f3` con el commit ajeno en el medio). Zafó porque ese deploy ya estaba
  Ready. **No existe «retener un commit» en un clon compartido**: si algo no tiene que salir
  todavía, no se commitea — se deja en el árbol o en un worktree propio. Y quien pushea mira
  `git log origin/main..HEAD` antes, porque ahí puede haber trabajo de otros.

- **Rojo que no es tuyo y al minuto está verde.** Dos sesiones distintas corrieron el
  typecheck sobre un archivo que la tercera estaba tipeando: una vio cuatro errores de
  sintaxis y la otra, un minuto después, cero, sin que nadie tocara nada. Una de las dos
  lo reportaó como «tu código está roto» y mandó a buscar un bug que no existía.
  Re-correrlo cuesta 7 segundos.
- **Verde sobre algo que el vecino acaba de romper.** El espejo, y nadie lo nota porque
  un verde no se audita.
- ⚠️ **Y si se lo reportás a la otra sesión, FECHÁ la observación y volvé a medir
  antes de mandarla.** No alcanza con verificar de quién es el archivo — eso puede estar
  bien y el reporte igual llegar mintiendo, porque entre que mediste y el otro lee pasaron
  minutos y él siguió tipeando. Medido el 05/10/2026: el árbol estuvo **rojo ∼10:48, verde
  ∼10:57** (un push pasó los hooks ahí) y el commit que lo cerraba de verdad llegó **11:13**.
  En el medio salió un mensaje diciendo «tu edición está BLOQUEANDO EL PUSH DE TODO EL
  REPO» sobre algo que ya estaba verde: mandó a cazar un bloqueo que no existía, y el dueño
  del archivo tuvo que gastar un turno en demostrar que no.

  **«Leí esto a las 11:08» es una observación; «tu edición bloquea el repo» es una
  acusación.** La primera envejece sola y el otro la puede descartar en un vistazo; la
  segunda obliga a defenderse. Un ` M` en `git status --short` mientras alguien trabaja es
  una **ventana**, no un bug: se nombra como tal. Re-medir cuesta 7 segundos y el mensaje
  lleva la hora.


De ahí tres cosas que valen siempre que haya más de una sesión:

1. **Un reporte sobre el árbol se FECHA o no se entiende.** «Leí esto a las 21:40» es una
   observación; «lo tuyo está roto» es una cacería. Los dos lados pueden tener razón
   sobre momentos distintos — ya estaba escrito para las corridas de agentes y vale igual
   entre sesiones.
2. **Si el pre-push da rojo, lo PRIMERO es `git status --short` de los archivos que el
   error nombra.** `??` o ` M` ajeno → no es tuyo: worktree limpio y seguir. `M ` propio
   → es tuyo y se arregla. Saltearse ese paso es lo que produce el reporte equivocado.

   ⚠️ **Y UN GUARD QUE LEE FUENTE NO NOMBRA SU SUJETO: nombra al GUARD.** La regla de
   arriba se aplica sobre el archivo que el assert LEE, que casi nunca es el que aparece
   en el error. Medido el 06/10/2026: `tests/landing-optin.test.ts` falló, y como el test
   dice «landing» se miró el `git status` de `app/integraciones/` y `app/crm/` —las dos
   limpias— y de ahí salió «es un rojo de HEAD, del commit b42c5194». Las dos
   afirmaciones eran falsas. El assert hace
   `leer('../app/api/cron/tracking-vigilante/route.ts')`, y ESE archivo estaba ` M`,
   escrito a las 02:24 por una tercera sesión que está pasando los links de los avisos a
   `linkApp(ruta, ws)`: en HEAD `LINK_LANDING` aparece 3 veces y en el disco 0.

   O sea que el reporte acusó al commit equivocado de otra sesión sobre una falla que no
   existía en HEAD. Son dos comandos y contestan las dos preguntas distintas:

   ```bash
   grep -n "leer('\|readFileSync" tests/<el-test>.ts   # a quién mira de verdad
   git show HEAD:<ese-archivo> | grep -c "<lo que el assert pide>"
   ```

   Si HEAD lo tiene y el disco no, no hay nada que arreglar: hay alguien tipeando.
3. ⚠️ **UN `tmp-` SIN COMMITEAR ES UN CANDADO PARA TODOS, Y EL QUE LO ESCRIBE ES EL ÚNICO
   QUE NO LO SUFRE.** Un script de diagnóstico con un error de tipos bloqueó el push de
   las otras dos sesiones durante **~3 horas** y les costó dos pushes desde worktree
   limpio (`a8168162`, `83dce3b8`); su autor no se enteró nunca, porque su sesión sabía
   que era suyo y lo ignoraba. **Un script temporal se borra al terminar la medición**, y
   si hay que dejarlo, se commitea con el tipo bien o se deja fuera del repo. Y antes de
   borrar uno ajeno: se PREGUNTA — con tres sesiones, borrar el archivo de otro es cómo
   se pierde trabajo que nadie puede recuperar.
4. ⚠️ **UN «remote rejected» PUEDE SIGNIFICAR «YA ESTÁ SUBIDO».** Las sesiones comparten
   el `.git`, así que el push de una se lleva los commits de la otra que ya estaban en
   `main` local. Medido dos veces el 04/10/2026, en las dos direcciones: un push salió
   con `cannot lock ref 'refs/heads/main': is at X but expected Y` y, tras el `fetch`,
   contestó **«Everything up-to-date»** — el commit ya viajaba adentro del push del
   vecino. Reintentar a ciegas, rebasar o armar un worktree para «arreglar» esa
   divergencia es trabajo sobre un problema que no existe. **Primero se pregunta si ya
   está:**

   ```bash
   git merge-base --is-ancestor <tu-commit> origin/main && echo "ya está en el remoto"
   ```

5. ⚠️ **Y UN `grep` SOBRE UN ARCHIVO CONTESTA «ese archivo no lo hace», NUNCA «nadie lo
   hace».** Es «un cero perfectamente correcto sobre la pregunta equivocada» aplicado a
   la medición entre sesiones, y se cometió el 04/10 con la regla ya escrita: un grep de
   `funnel` sobre `app/crm/leads-importar.ts` dio **0** y de ahí salió «la importación
   manda los leads al embudo genérico», que es falso — ese archivo PARSEA el CSV y el
   lead lo escribe `app/crm/actions.ts:1667`, con el `funnel_id` puesto. Lo que lo evita
   es invertir el orden: **primero se pregunta QUIÉN ESCRIBE, y recién ahí se busca el
   campo en ese archivo.** El nombre de un archivo no dice qué hace: dice cómo lo
   llamaron.

   Y es caro en una sesión compartida, porque el reporte de un vecino se lee como una
   medición y viaja a un entregable: acá llegó a uno que iba a leer Martín para decidir
   trabajo, y lo frena únicamente que alguien del otro lado verifique antes de aceptarlo.

6. ⚠️ **`/tmp` ES COMPARTIDO ENTRE LAS SESIONES: NINGUNA MEDICIÓN SE ESCRIBE AHÍ.** En Git
   Bash, `/tmp` es `C:\Users\marti\AppData\Local\Temp` — el mismo directorio para las
   tres sesiones, con 3.593 entradas al 05/10/2026. Un `cmd > /tmp/out.txt` y un
   `grep … /tmp/out.txt` separados por treinta segundos pueden leer **la salida de otro
   chat con el mismo nombre**, y como el nombre que a uno se le ocurre es el que se le
   ocurre a todos (`out.txt`, `tc.txt`, `test.txt`), la colisión es probable y no rara. El
   resultado no es un error: es un número plausible de otra pregunta. Lo encontró el chat
   de Chatbot el 05/10 recibiendo la salida de un script ajeno.

   ⚠️ **Y LA MITAD CARA NO ES LEER: ES `git commit -F /tmp/msg.txt`.** Ahí una colisión no
   devuelve un número equivocado — **commitea el mensaje de otra sesión**, con tu diff
   adentro y tu trailer, y nadie lo audita porque el commit sale bien. Se cometió el mismo
   día, en este repo, y zafó por suerte del nombre: `067310aa` llevaba el mensaje correcto
   (verificado con `git log -1 --format='%b'` **después** de commitear, que es lo único que
   lo contesta).

   Las dos reglas: **todo archivo temporal va al scratchpad de la sesión**, que es
   específico por sesión y está aislado; y si una medición ya salió por `/tmp`, **se
   re-corre antes de escribirla en un entregable**. Acá se re-corrieron el typecheck y la
   suite (3410 pass / 0 fail, 0 errores de tipos) y se verificó el cuerpo del commit.

El protocolo completo —qué comparten las dos cuentas y qué no, cuándo usar worktrees y
las tres cosas que hay que recrear a mano en uno— está en
[docs/dos-cuentas.md](docs/dos-cuentas.md).

# Una cosa, un lugar

Lo que gobierna a la IA —contratos, catálogos, criterios— vive en UN módulo y todos lo
importan. **Si tenés que copiar la misma regla en dos archivos, el segundo se va a quedar
viejo.** No es una hipótesis: pasó con el contrato del `detalle`. Se actualizó en el camino
de Claude Code, nadie tocó el de WhatsApp, y desde WhatsApp siguió saliendo mal durante
días sin que nada avisara. El dueño lo vio antes que nosotros.

Los que hoy son fuente única:

| Qué | Dónde vive | Quién lo consume |
|---|---|---|
| El contrato del `detalle` | `lib/detalle-contrato.ts` | `plan-fathom`, `mako-doer-acciones`, `checklist-coach`, `agente-skill` |
| Los proyectos del tablero | `lib/plan-proyectos-catalogo.ts` (dueño) · `lib/todo-proyectos-catalogo.ts` (clientes) | el ruteo del Perro, los dos boards |
| Cómo se llama un proyecto nuevo (`Feature: `, `Cliente: `) | `PREFIJO_FEATURE` + `REGLA_NOMBRE_PROYECTO` en `lib/plan-proyectos-catalogo.ts` · `PREFIJO_CLIENTE` en `lib/todo-proyectos-catalogo.ts` | el prompt de ruteo (`mako-guardian`), la skill `plan-tareas` |
| Qué archivos se pueden leer | `lib/formatos-archivo.ts` (**sin `server-only`**, a propósito) | `archivo-a-texto` (el lector), `mako-doer-in` (WhatsApp), `ImportarModal` (el `accept` y los íconos) |
| Qué modelo usa cada feature | `lib/model-registry.ts` | `chatClaude`/`chatCheap`, con override en /modelos-ia |
| Cómo se funden dos descripciones | `lib/detalle-fusion.ts` | el board del dueño y el del cliente |
| Cómo se llama y se ve cada estado de la IA, y el Semáforo | `lib/mako-gramatica.ts` | la primitive `<Mako>`, `meta-health-ui`, `avisos-catalogo` |
| Qué cliente mira ESTA pestaña (`?ws=`) | `lib/ws-tab.ts` + la validación en `proxy.ts` | `getWorkspaceActual`, el `<Link>` de `app/_ui`, el parche de fetch |
| Cómo se escribe **MaKo** (`corregirMarca`, `REGLA_MARCA`) | `lib/mako-gramatica.ts` | `transcribirAudio` (STT), `limpiarTarea`, `MAKO_NUCLEO`, `docs/branding-mako.md` (generado) |
| Los tipos de pregunta del Perro, su saneo y el texto que leen los modelos | `lib/preguntas-contrato.ts` (**sin `server-only`**, a propósito) | desde el 05/10/2026 **nadie las genera al cargar tareas** (el alta no pregunta: `tests/alta-sin-preguntas.test.ts`); quedan `plan-prueba` y `PreguntaCampo`, este último sin call site |
| Lo que un agente puede leer o hacer en MaKo | `lib/api-mako/areas/<área>.def.ts` + `.run.ts`, reunidos en `lib/api-mako/registro.ts` | el doer de WhatsApp, el chat de la app, `/api/v1`, `docs/api-mako.md` (generado), la skill del cliente |

⚠️ **El rótulo de un estado de MaKo no es un prop.** Sale de `GRAMATICA` y no se puede
pasar por parámetro, a propósito. El día que se pueda, tres pantallas escriben
«Analizando…», «Pensando…» y «MaKo está trabajando» para el mismo estado y el usuario no
tiene forma de saber que son lo mismo — que es exactamente el diagnóstico que la Parte 3
del rediseño vino a cerrar. Si a un estado le falta algo, se le agrega **al catálogo**.

⚠️ **NUNCA leas `?ws=` de la URL para decidir de quién son los datos.** El super admin
abre cada cliente en su propia pestaña y el workspace viaja ahí, pero un parámetro de URL
lo escribe cualquiera: leerlo directo es un IDOR que abre los datos de otro cliente. El
único que lo mira es `proxy.ts`, que lo acepta **solo** si la sesión firmada dice
`rol === 'admin'` y que borra el header interno en cada request. De ahí para adentro se
pregunta siempre a `getWorkspaceActual()`, como siempre. Para links y navegación usá
`import Link, { useRouter } from '@/app/_ui/Link'` en vez de `next/link` y
`next/navigation`: preservan el cliente que estás mirando. Las llamadas a `/api` no hay
que tocarlas — el parche de `app/_components/WsFetch.tsx` les pega el parámetro solo.

Las skills son `.md` y no pueden importar nada. Para esas, el módulo se copia con un
script y **el pre-push falla si quedaron viejas** — esa guarda es lo único que impide que
el problema vuelva. `scripts/sync-contrato-detalle.mjs` copia hoy DOS cosas (el molde del
`detalle` y la regla del nombre de un proyecto), cada una entre sus marcadores. Si agregás
una skill que repite una de estas reglas, sumala a `DESTINOS` en vez de copiar el texto.

Lo mismo vale para **cualquier `.md` del repo que documente un catálogo**, no solo las
skills. `docs/branding-mako.md` trae la gramática de los nueve estados y la regla del
nombre, y las dos las escribe `scripts/sync-gramatica-doc.mjs` desde
`lib/mako-gramatica.ts`. No tardó ni una hora en probarse: el documento se escribió a
mano el 2026-08-11 y **en la misma sesión** ya decía «el impacto» donde el código dice
«el impacto esperado». Ahí el módulo SÍ se puede importar —su única dependencia es un
`import type`, que tsx borra en runtime—, así que se importa: parsear objetos anidados
con regex es cómo se cuelan los desfases que el script viene a evitar.

# El tablero es UNO y las tablas son DOS: un campo nuevo son SEIS lugares

`app/plan/board/BoardShell.tsx` lo montan dos parents sobre tablas distintas — el
super-admin (`plan_tareas` + `plan_proyectos`) y cada cliente (`experimento_tareas` +
`tarea_categorias`). Un campo nuevo se escribe en los seis, y **el typecheck no ve ninguno**:

| | dueño | cliente |
|---|---|---|
| columna | `plan_*` | `experimento_*` / `tarea_categorias` |
| lectura | `rowToTask` / `rowToLabel` (`lib/plan-board.ts`) | `toBoard` / `toLabel` (`app/plan/board/desde-todo.ts`) |
| escritura | `taskToRow` / `labelToRow` | `editPatch` y los payloads de `categoria-crear` / `-editar` |
| puerta | — | el TIPO del patch en `app/api/todo/route.ts` |
| server | — | el `upd` campo por campo de `lib/todo.ts` |

Ya se pagó CUATRO veces —la prioridad a mano, el Quarter (0162), la recurrencia (0164) y el
cliente (0172)— y el modo de falla es siempre el mismo: **el control se dibuja, la request
contesta 200 y no se guarda nada**, que se lee como que la app está rota.

⚠️ **Y olvidarlo en la LECTURA es DESTRUCTIVO, no inerte.** El guardado es un `upsert` de la
fila ENTERA armada desde el estado del navegador: un campo que el mapper de lectura no trae
vuelve como `undefined`, sale como `null` y **borra la columna** en el próximo guardado de
cualquier otro campo.

⚠️ **Y las dos mitades ni siquiera comparten el TIPO del id**: `plan_*` usa texto,
`experimento_tareas` / `tarea_categorias` usan bigint. Cualquier cosa que lea «el tablero»
desde afuera (Customer Success, un analyst, un export) tiene que poder con los dos — el id
de texto contiene al numérico, al revés hay que inventar una conversión que después miente.
Cuál de los dos te toca lo decide `lib/tablero-actual.ts`, y ahí se decide una sola vez.

# Una capacidad nueva de MaKo se DECLARA en el registro de la API, no se escribe en una ruta

Todo lo que un agente puede leer o hacer en MaKo —MaKo por WhatsApp, el chat de la app,
la skill de Claude del cliente, cualquier integración con un bearer— vive en UN registro:
`lib/api-mako/areas/<área>.def.ts` (qué es, parámetros, por qué canales sale, cómo se
confirma) y `<área>.run.ts` (el cuerpo). De ahí salen solos los ToolDefs del doer, el
catálogo y las rutas de `/api/v1`, la referencia `docs/api-mako.md` y lo que enseña la
skill. El porqué de cada decisión está en [docs/api-mako-diseno.md](docs/api-mako-diseno.md);
lo que costó, en [docs/hallazgos-api-mako.md](docs/hallazgos-api-mako.md).

**Si agregás una capacidad y no la declarás ahí, existe para la pantalla y no existe para
nadie más.** Y si la escribís en una ruta aparte, es la segunda implementación de lo mismo.

Lo que una definición tiene que declarar, y por qué no tiene default:

- **`canales`, en positivo.** Declarar `tipo: 'lectura'` no es decidir que salga por HTTP a
  un token que vive en la máquina de un tercero. Conversaciones de personas, transcripts y
  links de grabaciones, datos del equipo y costos de IA no llevan `'http'`.
  `tests/api-mako-http.snapshot.txt` es la lista de lo que sale; exponer algo nuevo es
  regenerarla y commitearla — decidirlo. Y «no sale por HTTP» se verifica también contra
  las rutas viejas con bearer (`/api/agente/*`), que el snapshot no ve.
- **`confirmacion`: `chat` o `pantalla`, nunca «directo».** `chat` deja una pendiente que
  confirma una PERSONA (un «sí» en WhatsApp o la bandeja `/mako/pendientes`); `pantalla`
  deja una propuesta con link a una pantalla editable. **Lo que cuesta plata es `pantalla`
  y `rolMinimo: 'admin'`, sin excepción** (el test lo exige).
- **`gating.rolMinimo: 'admin'`** en cada operación de un área cuya página hace
  `requireRolWs([])`. `gating.tab` mira la CAPA del workspace, no a la persona: sin
  `rolMinimo`, un closer lee o hace por MaKo lo que su pantalla le esconde.
- **`tipoPendiente`** cuando la acción hereda un slug que ya hay en la base.
- **`vaciaEsValor`** en toda lista que REEMPLAZA algo entero (las tareas de una clase). Sin la marca,
  el validador tira `[]` como «no vino» —lo correcto para un filtro— y no queda forma de vaciarla: la
  operación contesta «no pasaste nada para cambiar» (medido el 08/10/2026 con `tareas: []`).
- **`datosDeGoogle: true`** si el runner lee la agenda de Google (Calendar), aunque sea de
  rebote. **La agenda no pasa por ningún modelo de IA** (decisión de Martín, 07/10/2026:
  «si la IA solo procesa la info que le pide el usuario, y la app se debe ejecutar con
  código interno, no con IA»). El modelo pasa lo que dijo la persona (ids del CRM, fecha
  y hora como las dijo); el runner SÓLO lee la agenda y llama a un constructor puro de
  `lib/agenda-sin-ia.ts`, que arma lo que ve el modelo (un estado, o un resumen sin nada
  de la agenda) y lo que va a la persona por `paraLaPersona` (el doer lo agrega a la
  respuesta y no lo guarda en el historial). Ojo con los caminos de rebote: el `resumen`
  de una pendiente vuelve al modelo en cada turno, y el historial del lead lo lee
  `historial_lead`. Y no sale por HTTP: ahí no hay persona, sólo otro modelo.
  `tests/agenda-sin-ia.test.ts` prueba los constructores con CENTINELAS (títulos, horas y
  motivos falsos) y falla si un runner arma su propio texto o llega a `lib/google-calendar`
  sin declararlo. ⚠️ La primera versión de ese test buscaba NOMBRES de variable y daba
  verde sobre la forma exacta del bug de antes: un guard sobre datos se prueba con datos.
  ⚠️ **No se resuelve eligiendo a QUÉ IA va el dato**: eso se probó el mismo día (sólo a
  proveedores que no entrenan), le sacó Gemini a un cliente que sólo tiene Gemini y dejó
  abiertos el «sí», la pendiente y el historial. Ver `docs/hallazgos-ia.md`.

Ocho cosas que no se ven en el código y ya mordieron:

1. **Con el token CLÁSICO, por HTTP nadie confirma por su cuenta.** Un bearer que propone y
   confirma con un `sleep` en el medio es escribir directo con delay. Solo un clásico
   acuñado con alcance `ejecutar` ve `confirmar_accion`, y el alcance viaja en el PREFIJO
   del token (`mkoag_e_…`): rotar lo resetea. **Un token DETALLADO (`mako_pat_`) con
   «Lectura y escritura» en el área SÍ escribe en el acto** (decisión de Martín, 08/10/2026:
   «como GitHub»), salvo `costo: 'dinero'`, que propone igual. Escribir directo es una
   propiedad del TOKEN, no de la definición: la def sigue declarando `chat` o `pantalla`, y la
   escritura pasa por `aplicarEnElActo` (`lib/api-mako/flujo.ts`), el mismo camino con que
   confirma un flujo — `lib/api-mako/rutas-http.ts` (`correr`) es el único lugar que lo decide.
2. **El gating se mira al PROPONER y al CONFIRMAR.** Entre los dos momentos cambia quién
   está (el dueño propone por WhatsApp, un closer abre la bandeja). La guarda vive en
   `lib/api-mako/acciones.ts` (`gatingOk`), no en cada pantalla que confirma.
3. **Confirmar RECLAMA antes de ejecutar** (`reclamarPendiente`: update con
   `.eq('estado','pendiente')`). Dos «sí», dos pestañas o un reintento de n8n ejecutaban dos
   veces; con presupuesto, eso es plata. La contracara: lo reclamado no vuelve a
   `pendiente`, así que **todo lo que se pueda saber sin escribir falla en `preparar()`**
   —un candado en `ejecutar()` consume la pendiente aunque rechace— y lo lento no sale por
   `/api/v1`, que corta a 60 s.
4. **Una acción de pantalla no tiene gemela de chat.** Si queda una tool vieja en
   `MAKO_ACCION_TOOLS` con el mismo nombre, el doer de WhatsApp la prefiere y pide un «sí».
   Al pasar una operación a `pantalla`, se saca la vieja; `confirmarPendiente` cierra sin
   ejecutar toda pendiente que resuelva a una acción de pantalla.
5. **Un link que lee un modelo lo escribe el código.** El doer captura los links a
   `/plan/revisar`, `/crm/revisar` y `/mako/revisar` que devuelve una ACCIÓN y los escribe
   él; una lectura que devuelva un link así no se captura. Una operación nueva que devuelva
   un id al azar en un link tiene que entrar en esa captura.
6. **Una `.def.ts` no importa VALORES de módulos con `server-only`**, ni transitivamente: el
   generador de la referencia corre en el pre-push bajo `node --import tsx` sin
   `--conditions react-server` y reventaría el push de las dos cuentas con un error que no
   nombra la def. Los módulos de datos puros SÍ se importan: copiar su enum a mano es
   crear uno que se desincroniza. **Y sin `server-only` no es apto para el navegador:**
   ningún `'use client'` importa un valor del registro.
7. **Un turno que se RE-ARRANCA no repite acciones.** El doer de WhatsApp vuelve a correr el
   turno entero en cinco caminos (otra cuenta, la tool forzada, la red de plataforma, Claude,
   Groq). Cada corrida recibe `nuevoIntento()`, nunca `runTool` pelado: lo que una acción ya
   hizo en un intento anterior vuelve sin correr (`crearMemoDeAcciones`,
   `lib/turno-sin-duplicar.ts`). Sin eso quedan dos pendientes iguales y el «sí» contesta
   «Hay 2 acciones pendientes, aclara cuál»; `tests/turno-sin-duplicar.test.ts` frena un
   camino de reintento nuevo que se olvide. Y quien propone desde el doer le pasa a
   `crearPendiente` el inicio del turno (`mismoTurnoDesde`): la misma pendiente no se guarda
   dos veces en un turno.
8. **Una capacidad nueva del doer se prueba con el turno que CORRE, no con uno armado a
   mano.** Qué herramientas viajan lo decide `herramientasDelTurno` (`lib/doer-herramientas.ts`)
   sobre el veredicto de `clasificarIntencion`, y el test pasa por las dos con las frases como
   las escribe la persona (molde: `tests/agenda-whatsapp.test.ts`). Armado con
   `toolsDelRegistro` suelto, el test de agenda dio verde mientras 3 de sus 5 pedidos llegaban
   sin la herramienta (08/10/2026). Y el presupuesto de 12.000 caracteres ordena por
   relevancia CONTRA EL TEXTO: sumar un área sin sumar relevancia no trae la acción.

`/api/v1` es la única carpeta que entra a `PUBLICOS` como PREFIJO: toda ella es bearer por
construcción, y `tests/api-mako-registro.test.ts` enumera en positivo los `route.ts` que puede
tener. Una ruta nueva ahí falla ese test hasta que alguien decide que también es bearer.

**Y los tokens son dos clases, con dos puertas.** El CLÁSICO (`agente_token`, el de la skill,
se acuña en Integraciones → Claude con su trato de consentimiento) vale en `/api/agente/*` y en
`/api/v1`. Los DETALLADOS (`mako_pat_`, la tab `/api-mako`, guardados por hash, con permisos por
área y vencimiento) valen **sólo en `/api/v1`**: resuelven en `resolverTokenApi`
(`lib/api-mako/tokens.ts`), y `/api/agente/*` sigue con `wsPorAgenteToken`, que no los conoce. No
es prolijidad: `/api/agente/skill` mete el token CLÁSICO en el archivo que entrega, y `/hook` y
`/telemetria` tienen el consentimiento atado a él — aceptar ahí un detallado le daba el de la
skill a cualquier token del workspace y abría el reporte sin trato.
`tests/api-mako-tokens.test.ts` lo fija leyendo el fuente.

**La API copiada de GitHub (08/10/2026): lo que exige al escribir código nuevo.**

- **Los permisos por área de un token detallado viven en `gatingOk`**, no en `visible()` ni en
  la ruta: esa misma guarda corre al CONFIRMAR, y fuera de ahí un token con escritura sólo en
  «mako» confirmaba pendientes de cualquier área. Una puerta nueva que corra operaciones con un
  `Ctx` de token pasa `permisos` en el `Ctx` (y `vistaDe` los lleva a la `Vista`).
- **Una operación nueva con `'http'` necesita su fila en `lib/api-mako/rest.ts`** (la ruta REST:
  sustantivo en plural, kebab-case, el verbo de GitHub, parámetros de ruta con el MISMO nombre
  que en la def). `tests/api-mako-rest.test.ts` falla hasta que alguien le diseña la URL.
- **Ninguna operación del registro administra credenciales** (acuñar, editar, regenerar o revocar
  tokens): un token filtrado se perpetuaría. El mismo test lo frena.
- **Una acción que CREA algo devuelve su id en `Ejecutado.datos`** (`{ claseId }`, `{ clave }`): viaja
  hasta la respuesta 200 de la escritura directa (`ResultadoFlujo.datos`, lib/api-mako/flujo.ts). Sin el
  id, quien crea por la API no puede seguir trabajando sobre lo que creó.
- **«Ya está así» con `yaEstaba: true` también importa por HTTP:** con un detallado, una acción
  que no cambia nada devuelve 200 `sinCambios` (lo idempotente de un `PUT`); sin la marca es un
  422 que el integrador lee como falla.
- **La tab `/api-mako` NO usa `PageHeader` ni `Tabs` de `app/_ui`, a propósito**: Martín pidió
  «que se vea igual a GitHub», y su CSS (`app/api-mako/github.css`, los valores de Primer) vive
  limitado a `.gh`. No se «arregla» a los componentes de la casa. Lo que sí sigue: la vista en
  `?tab=` leída en el server, los links de `app/_ui/Link` y el registro fuera del navegador.

**Y un FLUJO corre acciones por UNA puerta: `ejecutarDesdeFlujo` (`lib/api-mako/flujo.ts`).**
Decisión de Martín (08/10/2026): un paso «⚡ Acción» de un lienzo —una secuencia de `/chatbot` o
un aviso de `/mensajes`— «que pueda hacer todo, sin limitaciones»: corre cualquier acción del
registro sin pedir un «sí», porque el dueño la confirmó al configurar el paso. Lo que eso exige al
escribir código nuevo:

- **Ningún motor escribe la acción por su cuenta.** Se propone por `ejecutarOperacion` (validador,
  gating, `preparar()` contra la base) y se confirma en el acto por el camino que ya tiene cada
  forma: la pendiente, la propuesta genérica, o la pantalla propia. Así cada ejecución deja su
  fila con el flujo como origen. Un `.from('…')` en el ejecutor es una segunda implementación, y
  `tests/flujo-acciones.test.ts` lo frena.
- **Una acción nueva con pantalla PROPIA (`proponer` en su runner) necesita su forma de aplicarse
  en el ejecutor.** Si no, cae en `aplicarPropuestaGenerica`, que contesta «la propuesta no
  existe». El mismo test cuenta las de pantalla propia (7 al 08/10) y falla con una más.
- **«Ya está así» se marca `yaEstaba: true` en `preparar()`.** Para una persona es un rechazo; para
  un flujo (y para un token detallado por HTTP) es un éxito sin nada que hacer. Sin la marca, «cuando agenda, movelo a Agendado» le
  manda una alarma al dueño en cada reagenda.
- **Un paso que no es un mensaje lo tiene que saltear TODO lo que recorre pasos.** La prueba de una
  secuencia, el generador de copy, la ficha que lee MaKo y las tools que reescriben pasos lo
  trataban como un mensaje vacío (salía un WhatsApp de prueba en blanco por cada acción). Antes de
  sumar un tipo de paso, `grep` de `.pasos` y de `setSecuenciaPasos`.
- **Un paso de acción del store de la PLATAFORMA no se hereda** (`leerPar`, `lib/plantillas.ts`, al
  lado del borrador): heredado, corría en el tablero y el CRM de cada cliente.
- **El ejecutor fija el workspace él mismo** (`runWithWorkspace`): confirmar corre el `ejecutar()`
  de la acción tal cual, y sin contexto `getTenantDb` cae a las cookies — un cron no tiene.
- **Un evento que el proveedor puede REENTREGAR le pasa su `dedupKey` a `dispararEvento`**, la
  misma con la que el webhook deduplica su aviso. Con un paso que corre solo, una reentrega ya no
  duplica una línea al grupo: duplica una tarea o un WhatsApp al lead.
- **Un id que se saca de un link va sin la query** (`split(/[?#]/)[0]`): `linkApp` le pega el
  `?ws=N` adentro de un contexto con workspace, y con eso pegado el id no existe.

Y del doer de WhatsApp, que sale de la misma tanda: **una receta del protocolo va en
`lib/doer-recetas.ts`, atada a la herramienta que la usa**, y viaja sólo con ella
(`recetasDelTurno`). Escrita suelta en el preámbulo se paga en cada pedido de cada turno.

# Un permiso de UN inquilino sobre OTRO son DOS decisiones, y ninguna se deriva de la otra

Cuando alguien tiene que poder ver los datos de otro workspace —la vista de agencia es
el primer caso, y no va a ser el único— hay dos preguntas y hace falta contestarlas por
separado:

1. **¿Este workspace puede tener clientes?** (tabla `agencias`, mig 0176). La decide el
   super admin, una vez.
2. **¿A CUÁL de ellos puede entrar?** (tabla `agencia_clientes`, mig 0175). Se decide por
   cliente, con autor y fecha.

**Derivar la primera de la segunda —«es agencia el que tenga alguna fila»— deja un
huevo-y-gallina con un solo lado abierto**: para conseguir la primera fila hay que poder
pedirla, así que cualquier admin de cualquier workspace crea inquilinos en la plataforma.
No es un agujero de datos; es un inquilino creando objetos de plataforma, que es una
puerta que nadie abrió.

Lo que gobierna el código nuevo de esta familia:

- **La condición vive en un módulo SIN `server-only`** (`lib/agencia-cartera.ts`), y se
  escribe **en positivo**: «hay una fila aprobada», nunca «todas menos». Es la regla del
  Reset, y es la que permite que haya test.
- **Se prueba con DOS sujetos, no con uno.** Con una sola agencia, un permiso cableado al
  número 13 —o uno que ignore `agencia_ws` y mire sólo el cliente— pasa TODAS las pruebas.
  Medido: sacar `f.agencia_ws === agenciaWs` deja 14 de 16 en verde, y los 2 que caen son
  los únicos que necesitan la segunda agencia para existir.
- **Un token que autoriza a un sujeto tiene que NOMBRARLO.** `firmarImpersonacion` firma
  sólo el número del workspace, así que su cookie es portable entre sesiones; eso da igual
  mientras la honre únicamente un admin global, y deja de dar igual en cuanto la honre
  alguien más. `firmarAgencia` mete el sujeto y el vencimiento adentro de la firma — el
  `max-age` de una cookie es una promesa del navegador, no del servidor.
- **Y el token no alcanza: el permiso se repregunta en cada request.** La aprobación
  cambia DESPUÉS de firmarlo. Un permiso que sólo se chequea al emitir es un permiso que
  se puede quitar y no se quita. Va memoizado por request y con salida temprana para quien
  no trae la cookie, así el 99% del tráfico no toca la base. Fail-closed si la consulta
  falla.
- **La SALIDA de una «vista de otro» no es una constante.** Estaba cableada a `/admin` en
  tres lugares, y `/admin` está en `SOLO_ADMIN`: quien no sea super admin se come el
  `denegarRol`. Sale de `rutaDeSalida` y viaja por `/api/auth/me`, junto con por cuál de
  las dos puertas hay que borrar la cookie — un DELETE al endpoint equivocado la deja
  puesta y el cartel vuelve solo, que se lee como un botón roto.
- **Y `estado: 'pausado'` de `workspaces` NO sirve como «pendiente de aprobación»**, que
  es la salida barata que aparece primero. Medido: no bloquea el acceso a nada —lo miran
  cuatro crons y la UI de /admin— y la columna ni siquiera tiene CHECK. El único corte
  real de acceso es `usuarios.estado='suspendido'`, y es por PERSONA.

⚠️ **Y un `bigint` puede llegar como STRING.** Las columnas de estas tablas son `bigint`;
el driver `postgres` de los scripts los devuelve como texto (`'13'`). Si el cliente que
usa el guard hiciera lo mismo, un `===` sería false SIEMPRE y **nadie entraría nunca** —
un fail-closed silencioso que se lee como «el botón no hace nada». Medido contra prod el
27/09/2026: supabase-js devuelve `number`. Si esa lectura sale algún día por otro camino,
se vuelve a medir.

# Hay CINCO formas de navegar, y las cinco llevan el `?ws=`

| Cómo | Con qué |
|---|---|
| Un link | `app/_ui/Link` (nunca `next/link`) |
| Una llamada a `/api` | sale sola: el parche de `app/_components/WsFetch.tsx` |
| Un `redirect()` del server | **`rutaConWs`** (`lib/workspace.ts`) |
| Un `window.location.href` | **`conWs(destino, useWs())`** (`lib/ws-tab.ts`) |
| **Un link que se MANDA afuera** (un aviso, un mail, un mensaje de WhatsApp) | **`linkApp(ruta, ws)`** (`lib/app-url.ts`) |

Si alguna pierde la pestaña, **la forma en que falla no se parece a un bug: te deja
mirando otra cuenta.**

⚠️ **Contar tres es el error que ya se cometió.** El 16/08 se barrieron los 26 `redirect()`
del server dando la regla por cerrada, y la cuarta forma quedó viva **justo en el peor
lugar**: `PanelAgencia.tsx`, el panel que SOLO se dibuja mientras mirás a otro cliente.
Sus dos `window.location.href` pelados son las únicas navegaciones duras del repo que
corren siempre adentro del modo agencia. Antes de dar por cerrado un barrido de
navegación, enumerá las cuatro y buscá cada una por separado — un `grep` de `redirect('/`
no ve un `window.location`, y tampoco ve un `redirect(\`/x/${id}\`)` con template literal
(ése también se escapó).

⚠️ **Y LA QUINTA SE DESCUBRIÓ EL 05/10/2026, con la regla de arriba ya escrita.** Las
cuatro de la tabla son navegaciones desde ADENTRO de la app; un link que viaja en un aviso
se abre desde AFUERA, y ahí el parámetro es lo único que dice de quién son los datos. A
Martín le llegó un aviso, lo abrió, y la app le contestó **«este lead no es de esta cuenta»**
sobre un lead que sí era suyo: el link se armaba `${APP_BASE_URL}/crm/<id>/resumen` a mano,
sin `?ws=`, y abría la pantalla en el workspace de la pestaña. Eran **22 links en 15
archivos**, y se lee como una fuga entre clientes cuando es un destino que falta.

- **Va por `linkApp(ruta, ws)`**, que es `APP_BASE_URL` + `conWs`. Con `ws` en null devuelve
  el link tal cual: un cron que todavía no itera inquilinos no tiene workspace, y un link
  sin parámetro abre donde la persona esté, mientras uno con `ws=null` abre una pantalla
  vacía.
- **El `ws` sale de `wsEnContexto()`** (`lib/workspace.ts`), que lee el store de
  `runWithWorkspace` sin `await`. ⚠️ Fuera de ese contexto devuelve `null` y **no mira las
  cookies**: no reemplaza a `getWorkspaceActual()`.
- **Y se busca por otro patrón que las cuatro de arriba**: acá no hay `redirect` ni `<Link>`
  que grepear, hay una interpolación de `APP_BASE_URL`. Lo fija
  `tests/link-con-workspace.test.ts`, que barre `lib/` y `app/api/` sobre el FUENTE —un
  template literal con la URL pegada compila perfecto— y deja afuera, con su motivo escrito,
  el prompt que describe la forma de una URL y el archivo donde vive el helper.

El caso, del 16/08/2026: el dueño reseteó el Cliente de Prueba, que con eso quedó con el
onboarding pendiente. Al volver a abrirlo, `guardOnboarding()` hizo `redirect('/onboarding')`
sin el `?ws=` → aterrizó en **su propio** onboarding, con el chrome de admin, sin barra de
agencia y **sin ninguna forma de volver a entrar al cliente**. Lo reportó como «algo está
pasando», que es exactamente cómo se reporta esto: no hay error, no hay pantalla rota, hay
una cuenta distinta.

- **El guard compartido es el que más pega.** `requireRolWs` / `requireCapa` rebotan por
  capa y por rol, así que ese redirect se dispara desde cualquier pantalla. Ahí primero.
- **Los alias de ruta cuentan.** `/setting → /chatbot`, `/dashboard → /marketing`,
  `/plan → /plan/agencia`: abrir un link viejo de un cliente te sacaba del cliente.
- **Y un botón que hace su trabajo y después te muestra otra pantalla es
  indistinguible de un botón roto.** El RESET del cliente de prueba vaciaba el workspace
  entero —50+ tablas— y acto seguido hacía `window.location.href = '/onboarding'` sin la
  pestaña: el dueño terminaba en SU propio onboarding, donde por supuesto no había
  cambiado nada. Lo reportó como «le di al reset y no pasó nada». El aviso de «Workspace
  vaciado: N registros» alcanzaba a pintarse y se lo llevaba puesto la navegación.
- **La excepción es `/login`**, y una sola: sin sesión no hay pestaña que preservar, y
  arrastrar el id a una URL que se comparte sola sería contar a quién se estaba mirando.
- **Ponerlo de más no cuesta nada.** `rutaConWs` devuelve el href intacto cuando no hay
  pestaña, así que para un cliente normal es el mismo string de siempre.

Y un corolario que vale para cualquier «vista de otro»: **si la única salida vive adentro
de una pantalla condicional, no hay salida.** El botón SALIR DE LA VISTA vivía en la barra
del wizard; cuando el wizard no se dibujaba, no quedaba ninguna.

# Un guard sobre algo destructivo se escribe en POSITIVO

«Solo ESTE workspace», nunca «cualquiera menos aquél». La condición negativa protege una
cosa y deja pasar todo lo demás, y se queda vieja sola: cada cliente nuevo entra en la
lista de los que NO estaban contemplados, sin que nada avise.

No es hipotético. El Reset que vacía un workspace —50+ tablas y 4 buckets de storage— se
ofrecía adentro de **todos los clientes reales**, porque las tres capas de guard decían
`ws !== OWNER_WS`. La función que lo decidía se llamaba `wsDePrueba()`: el nombre decía la
intención y el código decía otra cosa, así que leerlo por encima no alcanzaba para verlo.

Y donde haya un guard así, dos cosas más:

- **La condición va en un módulo SIN `server-only`**, para que se pueda testear. Si vive
  adentro del que hace el trabajo sucio, ningún test la puede importar — y termina siendo
  lo único sin red justo donde más duele. Ver `exigirClienteDePrueba` en `lib/auth-session.ts`.
- **Esconder el botón no protege nada.** El que decide es el server; la UI solo pinta lo
  que él contesta.

# `OWNER_WS` NO es la plataforma: es un cliente. Lo de MaKo va en `wsSuperAdmin()`

`OWNER_WS` vale 1 y el 1 es **Mauricio, un cliente**. El nombre engaña y ya se llevó
puestas varias cosas. Cuando algo que manda **MaKo** —un mail de acceso, una credencial
de plataforma, el catálogo del producto— necesita contexto de workspace, va en
`wsSuperAdmin()` (capa `superadmin`, resuelto por capa y no por número).

La forma en que falla no se parece a un bug: **funciona**. El mail de acceso de un cliente
nuevo salía desde `runWithWorkspace(OWNER_WS, …)` y el remitente resultante era
`MaKo <equipo@hola-mako.com>`, correcto — porque ese es el `resend_from` que ese cliente
tiene puesto hoy. El día que lo cambie a su negocio, todos los clientes nuevos reciben su
acceso firmado por otro cliente; si carga su propia `RESEND_API_KEY`, los mails de la
plataforma salen por **su** cuenta. Sale un mail válido las dos veces.

Tres corolarios que valen para cualquier recurso compartido:

1. **La identidad de la plataforma vive en el código, no en un `app_settings` de un
   inquilino.** Un `from`, un nombre, un logo que firma en nombre de MaKo es «una cosa, un
   lugar» aplicada a quién firma. Y va **explícito** en la llamada: `sendEmail` sin `from`
   resuelve el del workspace en curso, así que omitirlo vuelve a atar el mail al inquilino.
2. **El preflight tiene que mirar LO QUE SE VA A USAR.** `remitenteEsSandbox()` contesta
   por el workspace actual; si el envío usa una constante, chequear esa función es
   verificar otra cosa y creerte cubierto.
3. **Con UN solo valor configurado no se puede saber si lo leés del lugar correcto.**
   Probalo mentalmente con dos: si la respuesta cambia según de quién sea el segundo, el
   lugar está mal aunque hoy dé bien.

⚠️ **Y EN UNA FUNCIÓN QUE ACEPTA `ws` POR PARÁMETRO, RESOLVERLO ES LA PRIMERA LÍNEA DEL
CUERPO.** Cualquier lectura de un setting que ocurra antes está preguntando por el inquilino
del CONTEXTO, que para un cron que itera clientes es el dueño. Medido el 29/09/2026 en
`emitirDelCatalogo` (`lib/avisos.ts`): leía `plantillaActiva(id)` arriba y resolvía
`opts.ws` ocho líneas más abajo, así que consultaba el interruptor del DUEÑO ahí y el del
CLIENTE después — un aviso que el dueño tenía apagado moría para todos sus clientes, con el
interruptor de cada uno decorativo para ese camino. No da error: el aviso no sale, que es
indistinguible de «no pasó nada que avisar».

# Una herramienta de laboratorio montada en el layout raíz es una herramienta EN PRODUCCIÓN

Si algo vive en `app/layout.tsx`, se lo come **todo el mundo**. Y si además arranca desde
`localStorage`, no sabe de sesiones: el navegador no distingue quién está logueado.

El caso, del 16/08/2026: `<TemaCandidato>` —el taller para elegir la paleta del rebrand—
aplica el tema guardado en el browser con un `<script>` que corre antes del primer
pintado. Un cliente abrió su tablero en un navegador donde se habían probado paletas y vio
**la app entera ilegible**: las 15 tareas cargadas (el header decía «27% · 4/15») con las
tarjetas, las columnas y los botones pintados del color del fondo, porque los temas
candidatos incluyen paletas CLARAS. Lo reportó como «no están sus tareas y están todos los
botones mal». No faltaba nada: no se veía nada.

- **El guard va en el SERVER y en positivo.** «Solo admin», nunca «cualquiera menos…», y
  nunca del lado del cliente: el `localStorage` lo escribe el navegador.
- **Esconder el aviso es peor que el bug.** Horas antes se había reportado que el chip de
  «tema en prueba» tapaba una pantalla de cliente, y se lo apagó con `display: none`. El
  chip no era la causa: era el único aviso de que había un tema de laboratorio aplicado, y
  su única salida. Con el aviso tapado, el mismo problema volvió sin ninguna pista.
- **Y una herramienta de laboratorio que falla en silencio no avisa nunca.** Ese mismo CSS
  le pone una transición de color a todos los elementos, así que al aplicarse ni parpadea.

**Cómo se ve desde afuera, para reconocerlo rápido:** cuando está *todo* lavado —texto,
bordes y botones a la vez— no es hidratación ni son los datos. **Es una paleta.**

# Cuando algo «no aparece», el orden es datos → server → navegador, y no se saltea

Tres preguntas, en este orden, y cada una descarta un tercio del sistema:

1. **¿Están los datos?** Una query a la tabla.
2. **¿Los manda el server?** `curl` con la cookie y buscá un título en el HTML. Si el HTML
   los trae, **el problema es del navegador** y todo el código de servidor queda afuera.
3. **Recién ahí el navegador — y lo primero es la CONSOLA DE QUIEN LO ESTÁ VIENDO.**

⚠️ El paso 3 se hace pidiendo, no reproduciendo. **Un bug que depende del estado del
navegador (localStorage, una cookie, un bundle cacheado) no se puede reproducir en otra
máquina: el estado que lo causa no viaja.** Se perdió media hora peleando con Chrome
headless y cookies de impersonación para ver en local una pantalla cuyo problema vivía en
el Safari del dueño.

**Y el reverso, que es el que muerde al escribir código nuevo: tu navegador tiene estado y el
del cliente no.** Todo lo que se restaura de `localStorage` te anda a vos porque vos ya pasaste
por el camino que lo escribe. Dos reglas:

- **`localStorage` restaura una PREFERENCIA, nunca pisa una DECISIÓN.** Si la pantalla ya
  recibió el dato por props o por la URL, lo del navegador no compite: no se lee. Restaurar «lo
  último que usaste» encima de lo que la persona acaba de elegir arriba deja, en el mejor caso,
  un control muerto; en el peor, mide otra cosa sin decirlo.
- **Un `disabled` que se alimenta de un estado restaurado se prueba con la clave BORRADA.** Es
  el único modo de ver lo que ve un cliente nuevo. Y si el control que arregla la condición no
  está en esa pantalla, no es un botón deshabilitado: es una pantalla sin salida.

El caso, del 24/08/2026: el botón «Probar» del Pixel nacía apagado para **todo cliente nuevo** —
detalle completo en [docs/hallazgos-landing.md](docs/hallazgos-landing.md).

# Una regla en un prompt no es una regla

Si una regla sólo vive en la prosa de un prompt, **no se cumple**: se cumple casi
siempre, que es otra cosa. El contrato de las preguntas del Perro decía desde hacía
meses «una escala sin extremos explicados es una pregunta muerta» y «el tipo y las
opciones tienen que ser coherentes» — en cinco prompts distintos, con cinco redacciones
distintas — y no había **una sola línea de código** que lo mirara. El resultado llegó a
la pantalla del dueño: «¿Cuál es el deadline?» con botones del 1 al 5.

La regla que queda: **toda regla que gobierne la salida de un modelo necesita las dos
capas.** El texto en el prompt (para que el modelo acierte) y una validación
determinista en el saneo (para cuando no acierte). Si la segunda no se puede escribir,
la regla es una expresión de deseo y hay que decirlo en el comentario.

El corolario que más cuesta ver: **un DATO EXACTO que pasa por las manos de un LLM deja
de ser exacto.** El link de un borrador es `…/plan/revisar/propmskimbc4s4b4h` — 17
caracteres al azar, sin ninguna redundancia. El código lo armaba bien y le pedía al
modelo que lo mandara; falló de las dos formas, y la silenciosa es la peor: un link que
resolvía a un borrador REAL pero equivocado. El mismo link, cuando lo escribe el código
(`lib/reunion-destinatarios.ts`), nunca falló. Si un id, un número o una URL tienen que
llegar intactos, **no los transporta el modelo**: los pone el código, o se corrigen
contra el valor real antes de salir (`lib/link-borrador.ts`).

Y cuando el saneo tenga que elegir entre dos señales que se contradicen, **gana la más
cara de producir**. Un `tipo` es un token que el modelo tira sin pensar; una lista de
opciones concretas sólo se escribe sabiendo qué contesta la pregunta. El saneo viejo
hacía lo contrario —ante `{tipo:'escala', opciones:[fechas]}` se quedaba con el token y
tiraba las fechas— y esas respuestas no quedaban en ningún lado: ni en la base, ni en la
pantalla, ni en el log.

# Tres topes del entorno que no dan error: te dan otra cosa

Los tres se descubrieron el mismo día, los tres escribiendo código nuevo, y los tres
producen un resultado plausible en vez de un fallo.

**1. Una server action topea el cuerpo en 1 MB.** Este proyecto no define
`serverActions.bodySizeLimit`, así que mandar un archivo en base64 como argumento
falla con cualquier foto de celular. Lo que sube archivos es un **route handler
multipart** — ya está escrito, con su caso, en `docs/hallazgos-infra.md`, y se
escribió mal igual. Peor que el bug fue el tope declarado: la función anunciaba 12 MB
sobre un límite físico de 1.

**2. `fetch` NO expone el progreso de SUBIDA.** Su `ReadableStream` sirve para la
bajada. Para saber cuántos bytes salieron hace falta `xhr.upload.onprogress`
(molde: `putWithProgress` en `app/ads-manager/creativeUpload.ts`). Una barra
alimentada por un `fetch` sólo puede saltar de 0 a 100: miente sobre lo único que
promete.

**3. Un `var(--token)` inexistente NO falla: HEREDA.** Y sin nadie que lo defina
arriba, resuelve a nada. `marginTop: 'var(--gap)'` —un token con cero definiciones en
todo el repo— valía 0 y la sección quedaba pegada a la anterior sin que nada lo
dijera. Es el mismo modo de falla que `<Icon name="inventado">`, que dibuja un punto.

⚠️ **El patrón que comparten: el entorno tiene un tope y tu código declara otro.**
Antes de escribir un límite —de tamaño, de progreso, de espaciado— comprobá cuál es
el límite real de la capa de abajo. Un número tuyo por encima del suyo no protege:
promete.

# La pantalla dice QUÉ pasó; el PORQUÉ va al código

Pedido tres veces el mismo día y la tercera con todas las letras: **«el mensaje del botón de
deshacer es MUY largo, por dios deja de escribir textos así de largos, que sea una regla»**
(26/09/2026). Antes: «no tanta paja de texto, lo importante» y «no pongas texto innecesario
nunca».

Lo que lo produce no es descuido: es escribir el comentario del código y pegarlo en la UI. El
porqué de una decisión es caro de reconstruir, así que se escribe largo — y ese texto termina
en un toast de 5 segundos o en una glosa bajo un interruptor, donde nadie lo lee y tapa lo que
la persona estaba mirando.

**La regla: cada superficie tiene un techo, y el porqué NUNCA es una de ellas.**

| Superficie | Techo | Qué dice |
|---|---|---|
| Toast del deshacer | **3-4 palabras** | qué pasó: «Se repite», «Sin deadline» |
| Rótulo de un campo | 1-3 palabras | el nombre de la cosa: «Tarea recurrente», no «¿Se repite para siempre?» |
| Estado vacío | **una** frase | qué falta y dónde se arregla |
| Cabecera de una vista | el nombre y el número | nada más |
| `title` / `aria-label` | una frase | la acción y su objeto (acá SÍ va texto: no ocupa lugar) |
| Confirmación de algo irreversible | una frase | la consecuencia, pegada al botón |
| **Una fila de una lista de N** | **una frase, ~110 caracteres** | lo que distingue a ESA fila de las otras |

⚠️ **Y EL VOLCADO DE UNA CORRIDA DE AGENTES NO ES UN ENTREGABLE: es materia prima.** Lo
que devuelven N lectores son N párrafos de 900 a 2.000 caracteres con su evidencia, y
están bien así — el error es publicarlos. Medido el 30/09/2026: una auditoría de 25
tareas salió a pantalla con 105.013 caracteres y Martín contestó «te pedí poco texto,
que sea entendible… y mirá lo que hiciste». **La línea se ESCRIBE leyendo las N, no se
saca truncando el párrafo del agente**: cortar a los 110 caracteres deja la frase por la
mitad y se lee peor todavía. Y en una lista larga el rótulo repetido deja de informar —
se AGRUPA por veredicto en vez de ponerle un chip a cada fila.

Y tres cortes que se repiten:

- **Si el texto narra lo que la pantalla ya hace, se va.** «Queda fuera de Prioridades y del
  avance» sobra cuando se VE que la tarjeta pierde el deadline y desaparece de la vista.
- **Si explica un criterio, va al comentario del código.** Ahí se busca, ahí se versiona, y
  ahí el largo se paga una sola vez. `PORQUE_NO_COMPITE` existe para eso y **no** para
  pegarlo en un toast.
- **Si la pantalla necesita un párrafo para entenderse, el problema es la pantalla.** El
  párrafo tapa el síntoma y encima ocupa el lugar del arreglo.

⚠️ **Y EL NOMBRE INTERNO DE UNA COSA NO ES EL NOMBRE DE LA COSA.** «g15», «recording
179438975», «ws13», «la corrida del 25/09»: son etiquetas de un relevamiento, de una
tabla o de una sesión, y quien abre la pantalla no tiene de dónde sacarlas. Medido el
30/09/2026 sobre una tarjeta del tablero que decía «faltan las notas manuales de g15 y
g17»; el dueño contestó **«NO pongas cosas tecnicas como "g15" eso no se entiende»**.

Es la misma regla de arriba aplicada a un nombre propio: **si el título necesita un
glosario, está en otro idioma.** Lo que se escribe es lo que la cosa ES para quien la
lee — «la junta del 3 de septiembre», «Código Inmobiliario»— y el identificador, si hace
falta para trabajar, va en el detalle o en el comentario del código. Vale para títulos de
tarjetas, toasts, avisos, mensajes de WhatsApp y cualquier texto que salga del repo.

⚠️ **Y CUANDO LA PANTALLA SÍ MUESTRA UN PORQUÉ, ES EL PORQUÉ DE LA DECISIÓN QUE
ESTÁ AL LADO — no el del problema.** Una columna «por qué» pegada a una columna
«qué hacemos» promete explicar ESA celda, y es facilísimo llenarla con lo que uno
sabe del tema en vez de con lo que sostiene el veredicto.

Medido el 04/10/2026 en `/admin/runway`: la fila de «salvar los datos de Meta»
decía **«Lo ÚNICO que se pierde de verdad: Meta lo borra a los 90 días»** al lado de
un chip que decía **«Se pospone»**. Las dos cosas son ciertas y juntas se leen como
una contradicción — el texto es un argumento para HACERLA. Martín: *«¿qué carajos me
dice eso? no me explica por qué se pospone»*.

El molde, y es una pregunta distinta por veredicto:

| El chip dice | El porqué contesta |
|---|---|
| **se queda** | qué se ROMPE si no está |
| **se pospone** | cómo se SOBREVIVE sin eso: el camino a mano, o por qué hoy no le toca a nadie |
| **se va** | por qué ya NO QUEDA NADA que hacer |

La advertencia que no entra en ese molde —«ojo, esto es lo único que no se recupera»—
va igual, pero **después** del motivo y marcada como lo que es. Primero se contesta la
pregunta de la columna.

⚠️ **Y CUANDO ESA FILA SE TERMINA, EL PORQUÉ DE LA DECISIÓN YA ES HISTORIA.** El
motivo de un «se pospone» es, por construcción, un argumento para NO hacerla: al
lado de un chip que diga «Hecha» se lee como una contradicción, que es justo lo
que esta columna no puede producir. Medido el 04/10/2026 al marcar lo terminado en
`/admin/runway`: «Mientras tanto se corrige a mano en la ficha. Y si lo quieres de
paso, es una línea» al lado de un ✓.

Lo que la columna dice de una fila cerrada es **qué quedó funcionando**, y eso es
un dato nuevo que no se deriva de nada: va en su propio campo (`hecho`), que gana
cuando la fila está hecha. El motivo de un «se queda» sobrevive solo —dice qué se
rompía sin eso, o sea por qué se hizo—, así que el campo hace falta sólo donde el
veredicto era NO hacerla. Y como «cerrada» sale del tablero en vivo, nada puede
exigirlo: la advertencia va en el comentario del catálogo, que es lo que lee el
que cierre la próxima.

⚠️ **Esto NO aplica a lo que se escribe en el repo.** Los comentarios, los mensajes de commit
y `docs/hallazgos-*` siguen yendo completos y con su porqué: ahí el largo se paga solo la
primera vez que alguien lo busca. Lo que se recorta es lo que se dibuja.

# Si el estado correcto se puede CALCULAR, calcularlo le gana a dispararlo

Cuando una pantalla tiene que estar de cierta forma *mientras* pasa algo —la grilla
desplegada mientras hay una selección, un panel abierto mientras se edita, un botón apagado
mientras se guarda—, la salida que aparece primero es engancharlo a los eventos que lo
producen. Y esa salida es correcta exactamente hasta que aparece un camino más.

Medido el 04/10/2026 en `/plan`. El «Ver más» de la grilla de proyectos tenía que
desplegarse al empezar una selección en lote y plegarse al soltarla. Se escribió como gesto:
un `cambiarSel()` por el que pasaban los DOS caminos que cambian la selección —la casilla de
la tarjeta y el `onLimpiar` que la barra dispara en seis lugares internos—, con su ref para
no pisar la decisión de la persona. Los dos caminos cubiertos, con guard y con test.

Y en la MISMA tanda, otro pedido creó el tercero: que la selección sobreviva al cambio de
formato. Tildar en la TABLA y conmutar a tarjetas no pasa por ninguno de los dos caminos —
tres tildados, cinco tarjetas dibujadas, y una barra de lote actuando sobre lo que no está
en pantalla. La cura no fue sumar el tercer camino: fue dejar de tener caminos.

```tsx
const desplegadoPorSeleccion = selProy.size > 0;
const visibles = (verTodos || needle || desplegadoPorSeleccion) ? shown : shown.slice(0, REALES);
```

- **Un cálculo no tiene caminos que olvidar**, y el que se invente mañana lo hereda gratis.
- **Y el control que ese cálculo deja sin trabajo NO SE DIBUJA.** Con la expansión mandada
  por la selección, el botón de «Ver más» no puede plegar nada mientras haya algo tildado:
  un control que no hace nada se lee como que la app está rota.
- ⚠️ **Lo que NO se deriva es lo que la persona DECIDIÓ.** Acá el cálculo gana porque
  «desplegado» es una consecuencia de estar seleccionando, no una elección; un `localStorage`
  restaurado encima de lo que alguien acaba de elegir es el error opuesto, y está más abajo.
- **El olor que lo delata a tiempo:** si estás escribiendo un wrapper para que «todos los
  caminos pasen por acá», contá los caminos. Si son más de uno, probablemente haya un
  cálculo.

# Si algo no entra, preguntá primero si tiene el TAMAÑO que le corresponde

Antes de acomodar las piezas alrededor de lo que se desborda, mirá si lo que se desborda
está más grande de lo que le toca. El bloque de prioridad del plan se reportó roto CUATRO
veces —el ícono mal puesto, la banda partida en dos renglones, el apilado— y el diagnóstico
real llegó en una línea del dueño: «está ENORME la tipografía». Estaba en 15px bold porque
venía de cuando era un titular con su slider debajo; al volverse un campo más de una columna
de 236px nadie le bajó la escala. Tres de los cuatro arreglos fueron acomodar cosas
alrededor de un número que estaba mal.

⚠️ **El olor: un elemento con el tamaño de cuando era OTRA cosa.** Cada vez que algo baja de
jerarquía —de pantalla a sección, de sección a fila— se le baja la escala en el mismo
commit, o queda gritando donde ya no manda.

⚠️ **Y cuando igual hay que apretar, no le acertés a la suma de anchos: declará quién
CEDE.** Fila con `flex-wrap: nowrap`, lo que menos informa con `flex: 0 1 auto` +
`text-overflow: ellipsis`, y el dato con `flex: none`. Así entra con cualquier texto, en
cualquier ancho y con cualquier zoom, sin depender de una cuenta que acierta hoy y falla
mañana.

# Al SEGUNDO «sigue igual», se pregunta — con las lecturas enumeradas

Un reporte que se repite sobre la misma interacción no significa que falte una hipótesis
más: significa que la palabra que usa quien reporta abarca varias cosas y estás arreglando
la que no es.

Medido el 24/09/2026: el arrastre del Kanban del plan se reportó roto **seis veces**. Las
cinco primeras respuestas fueron hipótesis propias —la foto del `dragstart`, el re-render
por píxel, el auto-scroll, la opacidad, colapsar el nodo—; cuatro eran problemas reales y
ninguna era la que él veía. Lo cerró una pregunta con opciones concretas, contestada en un
mensaje: «la copia que sigue al cursor» + «la tarjeta original queda fantasma», y del CRM
«que la tarjeta no cambie nada». El arreglo fueron diez líneas.

**La pregunta no es «¿qué ves?»** —eso ya lo contestó a su manera y no se entendió— sino una
con las lecturas posibles enumeradas: quien reporta no tiene por qué saber que
«transparente» puede significar tres cosas en tres capas distintas (el elemento, la copia
que dibuja el SO, el placeholder).

# La imagen que sigue al cursor en un arrastre la dibuja el SISTEMA OPERATIVO

No es un nodo del DOM y **no la gobierna ninguna regla CSS**: en Windows, Chrome la pinta
semitransparente y la ancla donde quiere. Por eso un `getComputedStyle` sobre el elemento
puede dar `opacity: 1` mientras en pantalla se ve un fantasma — son dos cosas distintas.

`setDragImage(nodo, x, y)` la reemplaza, y eso alcanza para muchos casos — pero **sigue
dejando el dibujo del lado del SO**: cambia QUÉ se fotografía, no CÓMO se pinta. Si lo que
molesta es que se vea translúcida, fantasmal o torcida, `setDragImage` no lo arregla.

**La salida es no usar la imagen del navegador: se le pasa una VACÍA y la copia la
dibujamos nosotros.**

```tsx
const vacio = document.createElement('canvas'); vacio.width = 1; vacio.height = 1;
e.dataTransfer.setDragImage(vacio, 0, 0);   // el SO no pinta nada
// y el contenedor monta un clon en position:fixed, z-index alto, fondo opaco,
// movido con translate3d desde un `dragover` en `document` EN CAPTURA.
```

- **La copia se mueve escribiendo `transform` sobre un ref, NUNCA con `setState`.** Un
  `setState` por `dragover` redibuja el tablero 60 veces por segundo, que es el otro bug
  clásico de esta familia.
- **El listener va en `document` y en captura.** El `dragover` de las columnas no cubre los
  huecos entre ellas ni el fondo de la página, y ahí la copia se queda clavada.
- **Se saca en `dragend` Y en `drop`**, los dos, o queda un nodo colgado por arrastre.

Si aún así usás `setDragImage` con un nodo real, estas cuatro siguen valiendo:

- El nodo tiene que estar **en el documento y DENTRO DEL VIEWPORT** en ese instante. Con
  `display: none` —o en `top: -10000px`, que es la receta que circula por todos lados— el
  navegador **ignora el pedido en silencio**: la llamada no falla, no avisa, y vuelve la
  imagen por defecto. Un nodo fuera del viewport no tiene capa pintada y el compositor no
  tiene de dónde sacar la imagen. Va en `position: fixed; top: 0; left: 0; z-index: -1`: el
  renderer lo pinta, el ojo no lo ve, y vive un solo tick.
- ⚠️ **Y esto NO se ve en Chromium headless.** Ahí el dibujo del arrastre no pasa por el
  compositor del sistema operativo, así que la verificación da verde sobre algo roto. Para
  cualquier cosa que dibuje el SO —la imagen de un arrastre, un menú nativo, un diálogo de
  archivos— se verifica con `channel: 'chrome'` y `headless: false`.
- **El fondo se fuerza opaco.** Si el fondo computado del original es transparente, la copia
  hereda lo que haya detrás y se ve igual de fantasmal.
- El offset es `cursor − borde del elemento`, o la copia salta a una esquina.
- Y se quita en el tick siguiente: la foto ya está tomada.

# Al nodo ORIGEN de un arrastre no se le toca el tamaño

Colapsarlo a altura cero mientras se arrastra —la forma en que Trello y Linear hacen que la
tarjeta «se vaya» y quede sólo el hueco— deja el gesto sin salida: medido el 23/09/2026 en
el Kanban del plan, con `height: 0` + `opacity: 0` en la tarjeta arrastrada el arnés no pudo
completar un solo drop (se colgaba hasta el timeout) mientras la misma página cargaba
perfecto; al revertirlo, funcionó en el primer intento.

Lo que se está moviendo se marca sin tocar su caja: un **borde**, una sombra, un `scale`
chico. Y si además hay un hueco en el destino, la tarjeta de origen **no se atenúa**: con
las dos cosas el mismo ítem aparece tres veces (fantasma, foto del cursor, hueco).

⚠️ **Y la foto que sigue al cursor sale OPACA aunque atenúes la tarjeta en el mismo
handler.** Medido con un listener de `dragstart` en `window` y `getComputedStyle`: el
snapshot se toma con `opacity: 1` porque React aplica el estilo un frame después. Es una
hipótesis que suena bien, se sostiene tres rondas y no es la causa de nada.

# Un GESTO no se verifica leyendo el handler: se arrastra en un navegador

Al segundo «sigue sin andar» sobre la misma interacción, se abre el navegador. No al cuarto.

El arrastre del Kanban del plan se reportó roto cuatro veces y las tres primeras rondas
razonaron sobre el código. La cuarta levantó el dev server y lo arrastró con Playwright:
en diez minutos dio que **el mecanismo ya funcionaba** (hueco, tarjeta atenuada, pop-up al
soltar) y que lo que faltaba era otra cosa — `document.body.scrollHeight` = **19.630 px**
contra una ventana de 900, o sea el 4,6% del tablero a la vista, y **sin auto-scroll en el
camino del mouse**. Agarrás la tarjeta y no la podés llevar a ningún lado.

- **Verificar sale barato**: `npm run dev`, `/api/auth/dev-login?ws=9&next=…` y un script de
  40 líneas. Playwright se instala FUERA del repo (`npm i` en una carpeta del scratchpad)
  para no tocar `package.json`.
- **Lo que hay que medir es el estado DURANTE el gesto**, no el resultado: cuántos elementos
  se redibujan, qué hay en pantalla a mitad de camino, cuánto scrolleó.

⚠️ **Y durante un arrastre nativo, el navegador congela `requestAnimationFrame` Y los
timers.** Medido: un auto-scroll sobre rAF movía 0 px en 1,2 s sobre el borde (y su único
tick llegaba DESPUÉS de soltar), con `setInterval` 0 px, y con `window.scrollBy` adentro del
`dragover` 306 px. Lo único que el navegador sigue entregando durante el arrastre es
`dragover`: el auto-scroll va ahí. Y el timer no se deja «por las dudas» — al soltar largaba
los ticks acumulados, 112 px de scroll con el gesto ya terminado.

# «Allá funciona y acá no» es el método, no una queja

Cuando el mismo mecanismo anda en una pantalla y no en otra, la respuesta está en las
DIFERENCIAS entre las dos, no en la que está rota. Poner las dos implementaciones en dos
columnas y listarlas cuesta cinco minutos.

Medido el 23/09/2026: el arrastre del Kanban del plan «no agarraba la tarjeta» y el del CRM
sí, con el mismo HTML5 drag-and-drop y el mismo efecto visual. La diferencia no estaba en la
tarjeta —donde busqué dos rondas— sino en el `dragover` de la columna: el CRM re-renderiza
cuando cambiás DE COLUMNA (4 veces en todo el gesto) y el plan leía el
`getBoundingClientRect` de las 55 tarjetas de «Alta» y redibujaba el tablero entero en CADA
evento, ~60 veces por segundo. Con el DOM reconstruyéndose así, el arrastre se ve roto.

⚠️ **Y una hipótesis puede ser CIERTA y no ser la causa.** La primera fue que el navegador
saca la foto del arrastre al terminar el handler de `dragstart` — es verdad, está abajo como
regla propia, y no era esto: el CRM hace lo mismo y funciona. Una explicación que no
distingue el caso que anda del que no anda, no explica nada.

⚠️ **Y «allá funciona» es una HIPÓTESIS de quien reporta, no un dato — volvé a
preguntarla si el reporte se repite.** El mismo arrastre se reportó SIETE veces, y las seis
primeras rondas compararon contra un CRM que **también estaba mal**: era la referencia, y una
referencia no se audita. Lo cerró el dueño mirando las dos pantallas: «me doy cuenta que en
el CRM pasa lo mismo… es un problema de diseño». La pregunta que faltaba es de una línea:
**«¿allá se ve BIEN, o se ve igual de mal y no te habías fijado?»**. Comparar sirve mucho
—ahí salieron cuatro bugs reales— y deja de servir en el momento en que la diferencia que
buscás no existe.

# En HTML5 drag-and-drop, el navegador saca la FOTO al terminar tu handler

Lo que sigue al cursor mientras arrastrás no es el elemento: es una foto que el navegador
toma de él **cuando el handler de `dragstart` termina**. Así que todo cambio visual que
hagas adentro de ese handler —bajarle la opacidad, achicarlo, teñirlo— sale también en la
foto.

Medido el 23/09/2026 en el Kanban del plan: `setAgarrada(true)` dentro de `dragstart` dejaba
la tarjeta desvanecida Y la copia que viajaba con el cursor transparente encima del
original. Se reportó como «no agarra la tarjeta, se queda invisible». Va con
`setTimeout(fn, 0)`: la foto se toma con el elemento entero y recién después se atenúa el
que queda en su lugar.

Vale para cualquier feedback visual del arrastre. Si querés una imagen distinta de la del
elemento, eso es `e.dataTransfer.setDragImage(nodo, x, y)`, y el nodo tiene que estar en el
documento y visible en ese instante.

# Un layout se prueba con el valor MÁS LARGO del conjunto, no con el primero

Si el ancho es fijo y el texto lo decide el dato, «entra» es una propiedad del dato, no del
layout. El bloque de prioridad del plan ponía rótulo + banda + número + ícono en una fila de
236px: con `ALTA`, `MEDIA` y `BAJA` entraba, y con **`A FUTURO`** el flex partía la palabra
en dos renglones y empujaba el ícono fuera de la vista. Se reportó tres veces antes de que
mirara que el problema no era dónde estaban las piezas sino que no entraban.

- **Los valores posibles casi siempre están enumerados** (`PLABEL`, un enum, un catálogo).
  Mirar el más largo cuesta dos segundos.
- **Y si el más largo no entra, no se achica: se apila.** Rótulo chico arriba, valor grande
  abajo — que además suele ser el molde que ya usan los campos de al lado.

# Sacar un patrón es ENUMERAR dónde está, no arreglarlo donde se vio

Cuando el dueño decide que algo se va —la fricción de un wizard, una checklist, un cartel—,
el trabajo no es sacarlo de la pantalla que reportó: es hacer la lista de TODOS los lugares
donde ese patrón vive y sacarlo de todos en la misma pasada.

Medido el 23/09/2026: la fricción del Perro se sacó de la prioridad, después del alta de
tarea, después del alta de proyecto — y al cuarto reporte seguía apareciendo en «Cambiar
proyecto», con su pantalla de presentación y un campo obligatorio de justificación. Tres
tandas de feedback para cuatro instancias del mismo patrón, y la persona que lo reporta
yendo a buscarlas de a una.

Un `grep` del componente compartido (`WizardShell`, `IntroBody`) las lista en segundos. La
pregunta al cerrar no es «¿lo saqué de acá?» sino **«¿dónde más está esto?»**.

⚠️ **Y la otra mitad, que no sale con ningún grep del componente: «¿quién MIRA el campo que
esto llenaba?»** Lo que alimentás se va con la feature; lo que la consumía se queda, en otro
archivo y con otro nombre. Las checklists salieron del producto el 22/09/2026 y el filtro
«Comenzadas» del board —progreso entre 1 y 99— sobrevivió dos días **seleccionando siempre
cero tarjetas**: no tira, no avisa, contesta «no hay nada», que es indistinguible de un
tablero vacío. Un consumidor huérfano de un campo que ya nadie escribe no falla: **miente en
silencio y en la dirección tranquilizadora**.

# Antes de optimizar algo lento, preguntá si el CAMINO es el correcto

«Tarda mucho» casi nunca se arregla acelerando el camino que ya existe. El dictado del plan
se reportó como transcripción lenta y no era la transcripción: era que **grabar → parar →
subir → esperar a un modelo** no muestra una sola letra hasta que terminás de hablar. El
navegador tiene reconocimiento de voz local (`SpeechRecognition`), escribe palabra por
palabra y no cuesta nada — o sea que lo que había que cambiar no era el proveedor sino la
forma.

- **Una capacidad del navegador no es un estándar parejo.** `SpeechRecognition` está en
  Chrome, Edge y Safari (`webkit`) y no en Firefox. El camino viejo no se borra: queda de
  respaldo, y se elige mirando si la API existe.
- **Un stream de reconocimiento CORRIGE lo ya dicho.** Acumular cada parcial duplica media
  frase: se guarda el valor previo del campo y cada parcial lo reescribe entero.
- **El idioma es un campo, no una deducción** — `navigator.language` es el de la interfaz,
  no el que la persona habla.

# Lo que vale para TODOS los cambios se escribe donde pasan todos, no en cada uno

«El deshacer tiene que salir en todos los cambios», «todo cambio queda en el historial»,
«todo lo que escribe la IA lleva su rastro»: son reglas sobre un CONJUNTO, y puestas en
cada call site sólo cubren los que existían el día que se escribieron.

Medido el 23/09/2026: el toast de deshacer lo pedían TRES lugares a mano —borrar, mover de
columna y completar— y los otros ~20 campos de una tarea (título, detalle, fecha, quarter,
avance, notas, proyecto, score) cambiaban sin red. Se mudó a `patchLog` /
`patchLogExplicit` / `setScore` / `patchLabelLog`, que es por donde pasan todos los cambios
logueados: **un campo nuevo lo hereda sin que nadie se acuerde**.

- ⚠️ **Y ENUMERÁ LOS CAMINOS QUE NO PASAN POR AHÍ.** Ponerlo en el choke point no cierra el
  trabajo: al día siguiente se reportó «cambié la prioridad y NO me apareció el deshacer» —
  `aplicarCascadaManual` muta el score directo (ahí terminan el slider, el lápiz y el
  arrastre) y era el único camino que no pasaba por `patchLog`. O sea que quedó sin red
  justo el número que ordena el tablero entero. Un `grep` de quién muta el campo a mano los
  lista.
- ⚠️ **Y si el cambio YA se guardó en el server, deshacer tiene que escribir en el server.**
  Revertir sólo la pantalla es mentir hasta el próximo F5. Acá el deshacer vuelve a llamar
  al mismo camino con el valor anterior — y restaura también el estado que ese cambio trajo
  de arrastre (el candado de `score_manual` lo puso el cambio, no la persona).
- **Al mudarlo, sacá los que quedaron a mano** o salen dos: `toggleDone` y `moveTo` tenían
  su propio `show` encima del que ahora dispara el choke point.
- **Y filtrá por AUTOR.** Lo que hace la IA no se deshace con un toast —queda en el
  historial, que es donde se audita— y un toast por cada tarjeta que toca el Perro sería un
  toast permanente.
- **Una acción en LOTE necesita UN deshacer, no N.** Con el toast en el choke point, una
  acción sobre 12 tareas dispara 12 toasts y el que queda arriba deshace UNA. El lote toma
  su propio snapshot y pisa con un toast que revierte todo junto, que es la unidad en la que
  la persona decidió.
- ⚠️ **Y si el campo lo escribe el SERVER, el lote tiene que poder APAGAR el deshacer de cada
  paso.** Lo de arriba alcanza cuando el board persiste solo: el lote saca su foto y pisa. El
  score del plan no se persiste desde el navegador (`plan-reprio`, a propósito), así que la
  pantalla se sincroniza con una función que ofrece SU deshacer por ítem — y ahí pisar no es
  suficiente: durante el lote la persona ve N carteles parpadear y puede apretar el de uno
  intermedio. Va un parámetro que lo apague (`aplicarCascadaManual(..., conDeshacer = false)`)
  y el deshacer del lote **vuelve a llamar al server** con el valor anterior, porque revertir
  sólo la pantalla miente hasta el próximo F5.

# Un ACCIONABLE no es una TAREA, y volcar una lista de accionables al tablero lo arruina

Lo que sale de una reunión es lo que se DIJO: decisiones tomadas, decisiones pendientes,
intenciones, cosas que ya están hechas y algún trabajo de verdad. Una tarea es otra cosa:
**algo con un entregable que se puede completar**. Volcar lo primero como si fuera lo
segundo llena el tablero de tarjetas que nadie puede cerrar — y tapa lo único que sí hay
que entregar.

Medido el 25/09/2026 sobre «Vender MaKo: Oferta y precios», el proyecto #1 del tablero. Se
le habían creado 12 tarjetas desde la lista de accionables del 20/09. El dueño las miró:

> «Una cantidad impresionante de tareas innecesarias, que muchas YA están finalizadas o que
> directamente no deberían ser tareas… ¿Subir el precio? ¿Cómo se completa esa tarea?… Una
> cantidad de tareas de decisión que se podrían agrupar en una sola… **Y lo peor es que lo
> que SÍ es importante no está**: bajar a tierra la oferta en un documento.»

Las tres preguntas, antes de convertir un accionable en una tarjeta:

1. **¿Se puede completar?** «Subir el precio» no: la decisión ya está tomada y no hay nada
   que tildar. Lo que se puede completar es **dónde se aplica** — sacar el plan viejo de
   `modelo.ts`, escribir el escalón nuevo en la landing, avisarle a los dos clientes que
   compraron con el precio viejo. Ésa es la tarjeta.
2. **¿Es una decisión?** Entonces no son N tarjetas: es UNA, y su entregable es el
   documento donde se escriben. Seis «decidir si…» sueltas no se pueden cerrar por separado
   —son piezas de la misma definición— y juntas tapan el documento, que era lo que la fase
   había fechado.
3. **¿Ya está decidido o ya está hecho?** Se cierra. Una decisión tomada arrastrada como
   pendiente es ruido con cara de trabajo.
4. **¿Se repite para siempre?** Entonces no es una tarea de este tablero. Es el criterio de
   Mauricio y lo dijo con su nombre el 16/07/2026: *«tienes reunión todos los miércoles con
   X clientes… eso sí es una tarea, pero es como, yo cuando trabajaba en el mundo
   corporativo le llamábamos **BAU, Business As Usual**. Una tarea recurrente que se repite
   infinitamente… Acá lo que entran son tareas que tienen un inicio y tienen un fin»*.
   Reaparece el 18/08 sobre el seguimiento diario a los leads: *«esto es un bau»*.

   ⚠️ **Esta pregunta NO la cubren las tres de arriba, y por eso hay que hacerla aparte.**
   «Reunión de los miércoles» *sí* se puede completar —esta semana—, no es una decisión y no
   está hecha: pasa las tres y no debería estar en el tablero igual. Lo que la delata es que
   al cerrarla haya que volver a crearla.

   ⚠️ **Y desde el 26/09/2026 el producto SÍ lo modela** (mig 0163): la columna
   `recurrente` en `plan_tareas` y en `experimento_tareas`, el contrato compartido en
   `lib/plan-recurrentes.ts` (`esRecurrente`, `sinRecurrentes`, `ROTULO_RECURRENTE`) y la
   cuarta vista del tablero. **En el producto se llama RECURRENTES / «Se repite», nunca
   BAU** — el nombre se descartó a propósito porque no lo conoce nadie fuera del mundo
   corporativo.

   Lo que esa columna hace, y es la razón de existir: una recurrente **no compite**. Sale
   del reparto diario, de la herencia de urgencia, de Prioridades, del Perro, de los avisos,
   del cierre por commits, de Graphics y del markdown exportado; no lleva deadline (se lo
   borra el mapper, que es por donde pasan todas las escrituras) y no cuenta para el avance
   de su proyecto. Un proyecto de puras recurrentes no dice 0% ni 100% —las dos mienten—
   sino «en marcha · N se repiten».

   ⚠️ **Y la pregunta sigue siendo tuya al extraer.** El flag existe, pero lo pone quien
   crea la tarea: no hay backfill ni detección por palabra clave, y se midió por qué —
   buscando «semanal / diaria / recurrente» en las 212 tareas del ws1 salieron 11 y NINGUNA
   era una recurrencia: eran «Diseñar la estructura de la junta semanal», o sea trabajo CON
   FIN que monta un ritual. Marcar por palabra clave llenaría la vista con lo contrario de
   lo que busca. Lo recurrente es ASISTIR a la junta, no armarla.

   La regla hermana a nivel proyecto ya estaba escrita desde el 13/07 —«un proyecto tiene
   inicio y fin»— y le faltaba la mitad de las tareas.

**El resultado de aplicar las tres: 13 tarjetas abiertas → 5**, y arriba de todo la que
faltaba (el documento de oferta y precio), con las seis decisiones enumeradas adentro para
que no se pierda ni una.

⚠️ **Y lo que delata el problema en el resto del tablero se mide en una consulta:**
**24 de 248 tareas abiertas dicen EN SU PROPIO DETALLE que el trabajo ya está hecho**
(«ya está construido», «YA ESTÁ HECHO en el repo», «nada nuevo»). No hace falta juicio para
encontrarlas — el que escribió el detalle ya lo dijo.

⚠️ **Y ojo con el proxy fácil:** buscar los títulos que empiezan con «decidir / definir /
evaluar» cazó **13 de 248 (5%)**, y eso NO significa que el problema no esté: significa que
el patrón que se mide es el que uno mismo acaba de crear. Lo que encuentra el resto es mirar
proyecto por proyecto con las tres preguntas, con la fuente al lado.

# Si la pantalla agrupa por BANDAS, un reorden que no cambia de banda es invisible

El Kanban del plan agrupa por `prioFromScore` (`app/plan/board/types.ts`): **ALTA ≥ 75 ·
MEDIA ≥ 50 · BAJA ≥ 25 · A FUTURO < 25**. Con 40 proyectos arriba de 75, ordenarlos entre
sí de 99 a 76 no mueve ni una columna — y para el que mira es indistinguible de no haber
hecho nada. El dueño reportó el mismo problema dos veces sobre un orden que ya estaba bien
escrito: «la Fase 1 no debería incluir absolutamente todo lo técnico».

**Al reordenar algo que la pantalla agrupa, el corte se escribe en el GRUPO.** Acá: ALTA
quedó con exactamente los 15 proyectos de la etapa (100 → 86) y los números 85-75 vacíos a
propósito, para que la columna se termine ahí. Y la escalera se escribe ENTERA de una vez:
empujar de a uno hace que el resolvedor de empates camine un proyecto de vuelta a su valor
viejo (medido: 81 → 88 → 81).

⚠️ **Y el corolario del catálogo: dos proyectos del mismo tema, y el que no tiene trabajo
abierto adentro, no son dos proyectos.** «Feature: CRM» (24 abiertas) y «Agente: CRM
automático» (0) partían en dos la respuesta a «¿dónde está lo del CRM?». Se funden mudando
las tareas al que tiene la fecha y tachando el vacío al fondo con su motivo — nada se
borra. Lo que decide es **tema compartido + cero trabajo abierto**, las dos juntas: contar
tareas solo no sirve (9 proyectos con cero y 14 con una son legítimos), y dos proyectos del
mismo tema con trabajo abierto distinto —el WhatsApp del cliente y la línea propia de
MaKo— no se tocan.

# Un tablero auditado contra SÍ MISMO reproduce sus propios errores

El `detalle` de un proyecto, su `score_razon` y su «Qué falta» son un DOCUMENTO FECHADO:
describen el mundo del día en que se escribieron. Auditar el tablero leyendo el tablero
contesta «¿es coherente consigo mismo?», que no es la pregunta — y cuando la respuesta se
usa para reordenar prioridades, **reinstala como trabajo pendiente lo que ya se había
descartado**.

Medido el 24-25/09/2026. La auditoría de los 70 proyectos salió del `detalle` de cada uno
(más el código, para verificar lo construido). De ahí se crearon 14 tarjetas para los dos
proyectos comerciales, y el dueño las rechazó una por una:

- El detalle de «Cobros y planes» describe el modelo de **suscripción de 47 USD** con Free,
  tiers y contador de tokens. En la sesión del 20/09 ese modelo se había **matado**: «MaKo
  47 deja de existir, el mínimo pasa a USD 500 por 3 meses y USD 1.500 el grupal». Las cinco
  tarjetas nuevas resucitaron el modelo muerto, y el proyecto subió al segundo puesto del
  tablero por tener trabajo nuevo adentro.
- El detalle de «Oferta y precios» hizo lo mismo con el freemium y la estructura de 49/400.
- Y el orden quedó al revés de las **tres fases** que el dueño había dictado: «Landing y
  VSL» en el puesto 5 cuando su fase empieza el 11/10, después de todo lo técnico.

**La regla: la prioridad NO sale del tablero.** Sale de las decisiones —audios, reuniones,
la sesión donde se puntuó proyecto por proyecto— y **esas fuentes no están en el repo**: el
consolidado del 20/09 es `accionables-mako-20-sep.html` (110 accionables con su cita
textual, su estado medido contra el código y su cruce con el board), y el criterio de
extracción del cliente vive en `C:\Users\marti\Downloads\`. Antes de tocar una prioridad, se abren.

⚠️ **Y el olor que lo delata a tiempo: dos fuentes con fecha distinta que se contradicen.**
Un detalle que enumera un modelo de negocio y una sesión posterior que lo descarta no son
«dos opiniones»: gana la más NUEVA, siempre. Si no sabés cuál es más nueva, todavía no
tenés el contexto para reordenar nada.

⚠️ **Y LA FUENTE MÁS NUEVA PUEDE SER EL TABLERO MISMO — lo que la persona tocó HOY.** Es la
misma regla mirada del otro lado, y se pagó el 03/10/2026. Una corrida aplicó al tablero el
plan de una llamada del 1/10; catorce minutos antes Martín había depurado las fechas a mano
—le sacó el deadline a SEIS proyectos y se lo cambió a otros cuatro— y la corrida escribió
las fechas del plan encima de los diez sin mirar una sola vez si lo que iba a pisar había
cambiado desde que ese plan se decidió. Lo reportó al día siguiente: «yo había depurado y
sacado muchos deadline… me cambiaste todo eso».

**Antes de escribir un plan sobre un tablero, compará lo que vas a escribir contra lo que
HAY, y frená en todo lo que una persona tocó después de que ese plan se decidiera.** Es una
consulta y no una intuición —`updated_at` y la última entrada del historial de cada fila lo
dicen—, y lo que aparezca no se resuelve solo: se reporta y lo decide quien lo cambió.

⚠️ **Y el caso que NO se ve en un diff de valores es la AUSENCIA.** Que una fecha cambie de
10-14 a 10-21 se nota; que aparezca una fecha donde alguien la había sacado A PROPÓSITO no
se lee como «te pisé una decisión» sino como «apareció una fecha». Una depuración es trabajo
que deja el campo VACÍO, y un vacío es exactamente lo que un plan que enumera fechas no
tiene cómo distinguir de un hueco por llenar. Si tu plan escribe un campo, la pregunta no es
sólo «¿qué valor tiene hoy?» sino **«¿alguien lo vació a propósito?»** — y eso lo contesta
el historial, no la columna.

# Crear tareas dispara al Perro, y el Perro re-curva TODOS los proyectos

`aplicarPropuesta` corre la priorización sobre el tablero entero, no sólo sobre lo que
acabás de crear: al volver, los scores que habías fijado a mano ya no están. Medido el
25/09/2026 — se ordenaron los 70 proyectos por las tres fases, se crearon nueve tareas, y
el tablero volvió con el más alto en **70** y un proyecto de fase 2 primero.

- **El orden a mano va DESPUÉS de crear**, nunca antes. Si hay que hacer las dos cosas, se
  crea, se deja correr al Perro, y recién ahí se escribe el orden.
- **Y el ruteo de una tarea nueva lo decide el Perro por TEMA**, que no siempre es el
  proyecto donde el dueño la espera: las tres del «criterio de Mau» se fueron a «Agente:
  Lector de reuniones» —correcto por tema— cuando el compromiso con el cliente las agrupa
  en «el Plan y el Perro Guardián», que es el que tiene la fecha. Después de crear, se
  comprueba DÓNDE cayó cada una.

# Una regla que se aplica AL ESCRIBIR no arregla ni una fila ya escrita

Toda regla nueva sobre los datos —derivar un campo, sanear un formato, poner un default—
empieza a valer para lo que se escriba de ahora en más. Las filas que ya están sólo se
arreglan si alguien vuelve a tocarlas, y en un tablero la mayoría no se toca nunca. Para el
que mira la pantalla eso es indistinguible de que la regla no se implementó.

Medido el 24/09/2026: el 23 se escribió «si la tarea tiene deadline, el Quarter sale de la
fecha» y al día siguiente el dueño lo reclamó de nuevo — **«te había pedido antes…»**. Las
dos mitades que faltaban:

- **El choke point de un campo DERIVADO es el mapper de la fila, no el handler del
  formulario.** La regla vivía en `useBoard.setDeadline`, o sea en el único camino que pasa
  por el navegador. Todo deadline que pone el SERVER —el Perro al priorizar, una reunión al
  crear la tarea, un lote— seguía naciendo sin Quarter, y ese es el camino por el que entra
  la mayoría. Ahora se deriva en `taskToRow` / `labelToRow` (`lib/plan-board.ts`), por donde
  pasan TODAS las escrituras.
- **Y después se hace el BACKFILL**, en el mismo commit, contando las filas que arregló y
  verificando lo que el producto va a LEER. Eran 6 tareas y 22 proyectos con fecha y sin
  trimestre: nada dramático, y suficiente para que la pantalla siguiera dándole la razón a
  quien decía que no andaba.

⚠️ **Y el ORDEN del backfill importa cuando hay dos arreglos en la misma corrida.** Acá se
borraban además los deadlines vencidos hace 6+ días: derivar primero habría inventado un
trimestre a partir de una fecha que el mismo script estaba por declarar muerta.

# Un `<select>` cuyo `value` no está entre sus `<option>` no muestra nada — y el primer click lo borra

No es un error ni un warning: el control queda mostrando la PRIMERA opción (típicamente
«Sin asignar») sobre una fila que tiene el dato guardado, y en cuanto alguien lo toca se
escribe esa primera opción. O sea que una lista de opciones que se calcula puede BORRAR
datos sin que nadie lo haya pedido.

Pasa siempre que la lista se calcula y el valor viene de la base: trimestres futuros, sólo
clientes activos, sólo miembros del equipo que siguen, sólo categorías vigentes. Todas esas
reglas son correctas **para ELEGIR** y ninguna vale **para MOSTRAR**: que algo ya no se pueda
elegir no es lo mismo que esconder lo que ya está elegido.

La cura es una línea: el valor actual entra a la lista aunque no cumpla la regla, marcado
(`Q2 2026 (pasado)`). Molde: `quartersElegibles(hoy, cuantos, incluir)` en
`app/plan/board/cuando.ts`.

# Un layout que se auto-mide tiene que acertar SIEMPRE; uno fijo no tiene casos

Antes de escribir una medición que decide el layout —«¿pliego los botones?», «¿escondo el
rótulo?»— preguntá qué se pierde con la versión FIJA. Casi siempre es un rótulo y un chip, y
casi siempre vale menos que el riesgo.

El header del Plan se midió de tres formas distintas en dos días y las tres fallaron con el
zoom puesto. La tercera era correcta como medición (ver la sección de abajo) y el header
seguía bajando los botones a un segundo renglón. Lo que lo cerró fue `const compacto = true`:
plegado siempre, un renglón con cualquier zoom. Se perdieron la palabra «Plan» y un chip de
progreso que ya viajaba adentro del menú.

**Por qué es tan difícil acertar:** la medición tiene que dar bien en todas las combinaciones
de ancho, zoom, tipografía cargada o no, cantidad de botones —que cambia sola cuando un aviso
aparece o desaparece— y vista abierta. Cada arreglo tapa un caso y destapa otro. Y el modo de
falla es el peor: la barra baja de renglón pegada al borde izquierdo, que se lee como una
pantalla rota, no como un layout apretado.

# `scrollWidth` no es el ancho NATURAL de un contenedor flex

Es el ancho natural de un elemento cuyo **contenido desborda**. Si el flex ya le achicó los
hijos y con eso el contenido entra, `scrollWidth` devuelve el ancho **ya aplastado** — o sea
que cualquier «¿me entra esto?» construido sobre él contesta que sí exactamente en el caso
en que no entra.

Medido el 23/09/2026 en el header del Plan: el buscador declara `flex: 0 1 280px` con
`minWidth: 150`, el flex lo achica a 150 y su contenido entra, así que la suma de los hijos
daba 130px menos de lo que hacía falta. El header no plegaba sus botones y —como una barra
de navegación envuelve por regla de la casa— los tiraba a un segundo renglón pegado al borde
izquierdo. **Se nota primero con el zoom**, que es un viewport más chico en píxeles CSS sin
que cambie ninguna otra cosa.

La medición correcta es recursiva: un contenedor flex es la suma de sus hijos más sus gaps;
una hoja es el mayor entre lo que mide, lo que declara como `flex-basis` y su `scrollWidth`.
Molde: `anchoNatural` en `app/plan/board/BoardShell.tsx`.

⚠️ **Y con zoom los anchos son FRACCIONARIOS**: `offsetWidth`/`scrollWidth` redondean, y
redondear para abajo en cada hijo vuelve a inclinar la balanza hacia «entra». Va
`getBoundingClientRect().width`.

# Un tope se aplica ANTES de decidir si hubo cambio, y lo que recorta queda escrito

Cuando algo se agrega al final de un campo con tope —un detalle, un log, una descripción—,
la comparación que decide si hay que escribir tiene que hacerse contra el texto **ya
recortado**. Comparar contra el texto entero es comparar con algo que nunca se va a guardar.

El caso, del 23/09/2026. `ampliarTareasPlanOwner` fusiona el contexto nuevo al FINAL del
`detalle` y guarda `slice(0, 6000)`. En una tarjeta ya clavada en 6000 caracteres el
fusionado era distinto → se decidía escribir; el `slice` devolvía exactamente lo que ya
estaba → se escribía lo mismo; y el historial estampaba **«MaKo le sumó contexto»**. Medido:
**6 tarjetas del tablero en el tope exacto**, y lo que se perdía era el contenido de una
reunión, que es justamente lo que no se puede volver a extraer — con la tarjeta afirmando
que lo había incorporado, así que nadie iba a ir a buscarlo.

- **El tope va en una constante compartida** (`TOPE_DETALLE` en `lib/detalle-contrato.ts`),
  no repetido en cada `slice`: el que escribe, el que amplía y el que lo declara en la API
  de MaKo tienen que topear en el MISMO número.
- **Lo que quedó afuera se escribe donde alguien lo lea**, con el número de caracteres. Si
  no entró NADA, se escribe igual: un descarte sin rastro hace indistinguibles «no llegó» de
  «lo tiramos nosotros».
- **Y si entró a medias, el mensaje lo dice.** «Le sumé contexto» sobre una ampliación
  truncada es la misma mentira, más difícil de ver.

# Mover una acción a un lugar más accesible cambia sus supuestos de FRECUENCIA

Lo que era seguro porque «nadie lo hace dos veces» deja de serlo el día que pasa a
estar a un clic. No hay ninguna línea que cambie y ningún test que falle: la misma
función, llamada más seguido, se vuelve peligrosa.

El caso, del 31/08/2026: `crearTokenPuente` hace `upsert … onConflict:'workspace_id'`,
o sea que conectar un navegador **desconecta al anterior**. Vivía detrás de un panel de
cuatro pasos en la web, así que pasaba casi nunca. Al mudarse a un botón «Conectar» del
popup de la extensión, pasaba a ser el camino normal — y desconectar en silencio la
máquina que estaba trabajando.

**Antes de mudar una acción, enumerá qué la protegía además de su código.** La fricción
es una salvaguarda real, y es la primera que se pierde. Lo que quedó acá: un guard
explícito, y una salida que **nombra** lo que se va a romper («ya hay otro navegador
conectado: {cuál}»), porque lo que convierte esto en una decisión y no en una sorpresa
es que la persona sepa a quién está desconectando.

⚠️ **Y el corolario de la instrumentación: contá las salidas tempranas antes de elegir
dónde escribir el rastro.** Un estado escrito «al final de la función» no registra los
returns de arriba — y esos son justo los fallos. El síntoma es una pantalla que muestra
el último estado BUENO para siempre, que se lee como que todo anda. Va con un acumulador
antes del `try` y un `finally`. Es la misma familia que «la métrica puesta después del
early-return no mide el fallo».

# Escribir la salida no es ofrecerla: después de escribirla, preguntá QUIÉN LA LLAMA

Cuatro veces en un mismo día, en el mismo archivo, con cuatro formas distintas y
el mismo resultado: código correcto, compilando, con tests en verde, que **no se
ejecuta nunca**.

| Qué se escribió | Por qué no hacía nada |
|---|---|
| `sub: 'Se filma en 7 tomas de 8 segundos'` | el render pasa `titulo={p.titulo}` y jamás menciona `p.sub` |
| `accion` y `secundaria` del estado a ciegas | la pantalla dibujaba el texto y ningún botón |
| una etiqueta sacada de `txt.accion` | el `onClick` de al lado llamaba siempre a otra cosa — decía «Revisar el puente» y gastaba 15 créditos |
| una cura que borra un error obsoleto | vivía en la action que el sondeo llama, y el sondeo se apagaba con `if (!v.error)` — **la puerta que la cura tenía que abrir** |

Ninguna da error. TypeScript acepta un campo del tipo de retorno que el
consumidor no destructura, una constante exportada que nadie importa, y una
función a la que no llega ningún call site. Los tests también: prueban que la
salida se produzca, no que alguien la pida.

**La regla: al agregar un campo, una acción o un arreglo, el trabajo no termina
al escribirlo — termina cuando comprobaste el CALL SITE.** Tres preguntas, y son
treinta segundos:

1. `grep` del nombre. Si aparece una sola vez, es la declaración: no lo lee nadie.

   ⚠️ **Y SI APARECE DOS VECES, PREGUNTÁ QUÉ RAMA CORTA ANTES: un call site que EXISTE
   puede no ejecutarse, y eso el grep no lo ve.** Medido el 06/10/2026 en el portal de
   cursos. Martín reportó que faltaba el botón de compartir por curso; leer el camino
   contestaba que ya estaba, y las tres piezas estaban bien —`Conocimientos.tsx` pasa
   `compartir`, `CursoPortal` se lo pasa al `Hub`, el `Hub` lo dibuja en su hero—. Lo que
   no nombra a `compartir` en ninguna línea es el `return` de 30 líneas más arriba:

   ```tsx
   if (curso.replica) return <CursoReplica curso={curso} onSalir={salir} />;   // ⛔
   ```

   Y `replica: true` **no es un flag por curso**: lo pone el catálogo para TODOS. O sea
   que el hub no se alcanza nunca y su call site era **código muerto**: la capacidad
   estaba escrita y adentro de un curso no había forma de usarla. El prop es opcional,
   así que el compilador no dice nada y el grep lista dos usos perfectamente plausibles.

   Lo encontró **abrir la pantalla y contar los nodos** (`.al-hero-top` → 0), no leer el
   archivo. Dos cosas que lo cierran en segundos: el grep listando los números de línea
   —si el único uso vive DESPUÉS de un `return` de la misma función, no corre— y, para
   cualquier capacidad que se reporte como faltante y «esté escrita», contar los nodos en
   el navegador **antes** de leer una línea.
2. ¿La condición que activa a mi arreglo puede ser falsa **por culpa de lo que el
   arreglo viene a arreglar**? Ése es el caso más caro, porque parece desplegado.
3. Si es texto que alguien tiene que ver: **miralo en la pantalla**, no en el
   código. Un banco de pruebas donde vos escribiste el texto a mano confirma tu
   modelo mental, no la pantalla — eso también pasó ese día.

⚠️ **Y dos campos para el mismo lugar es cómo se muere uno de los dos.** `sub` y
`titulo` apuntaban al mismo renglón; el render eligió uno y el otro quedó vivo en
el tipo, aceptando asignaciones, para siempre.

⚠️ **Y REPARTIR TRABAJO POR ARCHIVO GARANTIZA SALIDAS HUÉRFANAS.** Cuando una corrida
le da a cada agente su propio archivo para que no se pisen —que es lo correcto—, en React
la CAPACIDAD queda en un archivo y el CALL SITE en otro: el único que podía enchufar la
prop nueva tenía prohibido tocar el archivo donde se enchufa. No es un descuido del
agente, es la forma del reparto.

Medido el 25/09/2026 en `/plan`: un paquete escribió el arrastre de filas entero —marca
de destino, auto-scroll, copia que sigue al cursor, número sugerido— y `onSoltar` terminó
con **cero call sites**. La prop es opcional, así que el typecheck pasa, los tests pasan, y
en pantalla no hay nada que agarrar. La tanda anterior lo había pagado con otra cara (dos
paquetes dimensionando contra el mismo ancho con valores distintos).

- **El que CIERRA la corrida grepea cada prop nueva y cuenta sus call sites antes del
  commit.** Son treinta segundos, y es lo único que separa «lo escribí» de «se puede
  usar». Un `grep` de la prop que devuelve sólo la declaración y el destructuring es el
  síntoma exacto.
- **Y al agente se le PIDE que declare en positivo lo que no pudo enchufar**, con las
  líneas exactas del archivo ajeno. Un paquete que vuelve diciendo «hecho» sobre un gesto
  muerto se commitea sin que nada avise; uno que vuelve con «BLOQUEANTE — falta el call
  site» cuesta minutos.

# Un `console.warn` no es un control, y un «no» tiene que sobrevivir al fallback

Dos mitades del mismo error, medidas el 12/8/2026 sobre cinco proyectos que el Perro
había RECHAZADO y nacieron igual.

**Un aviso que solo va a los logs no frena nada.** En la rama que creaba esos proyectos
había un `console.warn` que decía exactamente lo que estaba mal — «proyecto FUERA del
catálogo y sin justificar»— y los cinco nacieron con el warn puesto. Los logs de Vercel
no los lee nadie y a los 60 minutos no existen. **Si el que se tiene que enterar es el
dueño, el aviso va donde él mira**: el historial de la tarjeta, un chip, la pantalla. El
`console.warn` sirve para depurar después, no para evitar antes.

**Y un rechazo que deja un hueco es un rechazo que se va a rellenar con lo rechazado.**
El Perro descartaba el proyecto propuesto, y al descartarlo la tarea perdía su
asignación; río abajo, un `ruteo[i] || it.proyecto` la mandaba a crear justo el nombre
que se acababa de tirar. Cada `A || B` donde `A` es «lo que decidió el control» y `B` es
«lo que pidió el modelo» es esa misma trampa: **cuando el control dice que no, `A` queda
vacío y `B` gana.** Las dos reglas que quedan:

1. **Rechazar deja una deuda.** Si el control invalida la respuesta, alguien tiene que
   producir la buena — un reintento acotado, un default explícito — y no el fallback que
   estaba pensado para otra cosa.
2. **El fallback es más débil que el camino feliz, nunca más fuerte.** Si el camino
   normal exige aval y el degradado no, el degradado es la política real del sistema.

# `'use client'` es una frontera de DATOS, no solo de interactividad

Un `import` en un componente cliente no trae la funcion que pediste: **trae el modulo
entero, y todo lo que ese modulo importa**, al navegador de quien abre la pagina.
TypeScript no avisa, el lint no avisa, y la pantalla se ve igual.

El caso, del 25/08/2026: `lib/metodo-catalogo.ts` son 145 KB —los tutoriales de las 20
integraciones, los nombres de TODAS las envs y el copy interno de la agencia, incluida
la entrada de GitHub, que es una credencial de PLATAFORMA— y lo importaban tres
componentes `'use client'`. De todo eso usaban: **dos campos, un tutorial y una lista**.

Y lo que mas duele: existia `serviciosPara()`, la funcion escrita justo para no
mostrarle al cliente lo que no es suyo. No servia de nada. **Filtrar al PINTAR no sirve
si el dato ya viajo.**

⚠️ **Y LA CARA OPUESTA, QUE ES LA QUE TIRA EL BUILD: lo que NO LLEGA al server.** Un
objeto de datos exportado desde un `.tsx` con `'use client'` NO es ese objeto para quien lo
importe desde el grafo del server: es una referencia de cliente. No falla al importar —
falla al USARLO, en otro archivo y sin nombrar ninguno de los dos.

El 30/08/2026 costó **una hora de producción sirviendo el deploy viejo**: `catalogo.ts`
importaba dos fichas de curso desde `AnalisisNegocio.tsx` y `BrandingMaKo.tsx`, así que dos
de las 94 entradas llegaban sin `titulo` y Vercel moría con «Failed to collect configuration
for /compartido/[token]: Cannot read properties of undefined». La ruta que aparece en el
error no tiene nada que ver con el bug: es la primera server component que importa el
catálogo.

- **Un objeto de datos va en un `.ts`, y el `.tsx` lo importa** — nunca al revés. Si hay que
  mudarlo, `import` + `export` en el componente: un `export … from` no crea binding local y
  el propio componente deja de compilar.
- **Se busca mirando de dónde importa VALORES el módulo de datos**: las fichas son `.ts` en
  kebab-case, así que un import de un `PascalCase` es un componente y ahí está.
- ⚠️ **`tsx` IGNORA la directiva**, así que importar el catálogo con `npx tsx` devuelve todo
  bien y cualquier verificación local da verde sobre un build roto.
- ⚠️ **Y EL BUILD SÓLO LO CAZA CUANDO EL VALOR SE USA EN TIEMPO DE BUILD.** Medido el
  29/09/2026: `tabDeUrl` —tres líneas exportadas de un `OnboardingTabs.tsx` con `use client`—
  la llamaba el `page.tsx`, y `npm run build` terminó en **0 las dos veces** mientras
  `/onboarding` quedaba en «Esta pantalla se rompió al dibujarse» en producción. El caso del
  30/08 sí tiraba el build porque el valor se usaba al recolectar la configuración de una
  ruta; acá se usa en cada REQUEST. Son dos síntomas de la misma frontera y sólo uno tiene al
  build como red. El que los caza a los dos es `tests/frontera-use-client.test.ts`, que barre
  el repo y falla si un módulo del server importa un VALOR de un `use client` (y su espejo).

1. **Lo que el cliente necesita se resuelve en el SERVER y baja por props**, ya
   filtrado. Si el componente necesita dos campos de un catalogo de 20 entradas, bajan
   los dos campos — no el catalogo.
2. **El guard es `import 'server-only'` en el modulo, no la disciplina.** Con el puesto,
   importar un VALOR desde un `'use client'` rompe el build; sin el, el proximo que
   necesite un dato de ahi lo importa y nadie se entera. Los TIPOS siguen viajando
   gratis con `import type`, que se borra en compilacion.
3. **Un tipo copiado a mano para no importar del server es la senal de que falta esta
   frontera.** Ese componente tenia el suyo escrito al lado, y por eso al sumarle dos
   campos en el server la copia se quedo vieja sin que nada fallara.
4. **Se comprueba mirando el bundle, no el codigo**: `grep` de una cadena distintiva del
   modulo sobre `.next/static/chunks/*.js`. Si aparece, viajo.

# Una integracion son TRES registros, y ninguno falla ruidoso

Agregar una integracion no es agregarla a un lugar. Son tres archivos distintos, y el
compilador no ve ninguno:

  1. `lib/integraciones-catalogo.ts`  → la TARJETA (existe, en que categoria)
  2. `lib/metodo-catalogo.ts`         → los CAMPOS (que se le pide, y su tutorial)
  3. `lib/metodo-verificar.ts`        → el PING (como se comprueba)
  +  `app/_components/ServicioVisual.tsx` → el LOGO

Cada uno falla distinto, y ninguno grita:

- **Sin el PING**, el tilde de cada campo contesta «servicio invalido» — y como el tilde
  verifica ANTES de guardar, el cliente **no puede guardar nada**. Le paso a un cliente
  con Cal.com el 24/08/2026, en produccion: el mensaje culpa al servicio que el acababa
  de elegir bien. `lib/metodo-verificar.ts` YA tenia el aviso escrito («SIN ESTO LA BARRA
  DICE "servicio invalido"… es el TERCER registro») y aun asi volvio a pasar. **Un
  comentario no es un control**; por eso ahora hay test.
- **Sin el LOGO**, el fallback dibujaba el de OTRA MARCA (Supabase). La tarjeta de una
  agenda salio con el logo de una base de datos y se reporto como «el logo esta mal». No
  estaba mal: era de otro producto. **Un logo ajeno es peor que uno inventado**: no se lee
  como un error nuestro, se lee como que la app se confundio de servicio. El fallback es
  un letter-mark, feo a proposito.

⚠️ **Y SI LA INTEGRACIÓN RECIBE UN WEBHOOK, EL CAMPO QUE CREA SU FILA DE RUTEO NO ES
OPCIONAL.** Un webhook entrante llega sin sesión: lo único que dice de quién es el evento es
`webhook_routing`, y esa fila la escribe el guardado de una credencial de `ROUTING_CREDS`
(`lib/webhook-routing.ts`). Los webhooks son fail-CLOSED a propósito, así que un servicio
cuyas claves de ruteo son TODAS `opcional: true` deja conectar «bien» y no recibir nada —
200, un `console.warn` que no lee nadie, y el cliente creyendo que quedó andando. Medido el
04/10/2026: de los 2 workspaces con Calendly conectado, uno tenía token y signing key y CERO
filas de ruteo. La regla, en positivo y con guard
(`tests/webhook-ruteo-obligatorio.test.ts`): **cada servicio de ruteo tiene al menos una
clave que el cliente no puede dejar vacía** — obligatoria, o `auto` (la completa MaKo, como
`META_PAGE_ID` al pegar el token). Y la nota del campo dice qué se pierde si se deja vacío,
no sólo que hace falta.

⚠️ **Y UN WEBHOOK CONTESTA 5xx SÓLO A LO QUE SE ARREGLA REINTENTANDO.** Un 5xx le dice al
proveedor «reintentá», y Calendly reintenta un par de días y después **deshabilita la
suscripción entera**, sin avisar. Un evento que falla SIEMPRE —un dato que no cierra, una
excepción del código— apaga así la integración de todos: pasó el 11/09 y otra vez el 21/09
(tres cancelaciones del anfitrión en un minuto, y 4 reservas perdidas). Lo transitorio (la base
caída) va 5xx; lo que va a fallar igual en el próximo intento va **2xx y se registra** donde se
pueda leer. Es la otra mitad de «un 200 es un ACK» (`docs/hallazgos-infra.md` → «Webhooks»).

⚠️ **Y LA LECTURA QUE DECIDE DE QUIÉN ES EL EVENTO VA ESTRICTA** (`wsPorIdentificadorEstricto`,
`credWsEstricta`). `wsPorIdentificador` y `credWs` no leen el `error` de supabase-js: con la base
caída devuelven null, y un webhook lee ese null como «no es de ningún negocio» y lo contesta 200 —
perdido, con un mensaje que culpa a la configuración y sin pasar por el 503 que existe para eso.
Medido el 06/10/2026 en Calendly, cuyo clasificador ya estaba en verde: el ruteo no lo usaba.
Desde el 07/10/2026 vale para los CINCO webhooks que rutean, y `tests/webhooks-ruteo-estricto.test.ts`
barre `app/api/webhooks/` entero: un webhook nuevo con la lectura tolerante no pasa. El fallo va por
`responderFalloDeRuteo` (`lib/webhook-fallo-ruteo.ts`), que siempre lo anota — y qué conviene
contestar depende del PROVEEDOR, que se mide antes de elegir: Calendly y Svix (Fathom) reintentan y
**deshabilitan**, Meta reintenta ~36 h, Cal.com y Chatwoot **no reintentan nunca**.

Y hay un CUARTO registro que no es obligatorio y cambia lo que la gente lee: `AYUDA_CAMPO`
(en `metodo-catalogo.ts`). El componente hace `ayuda={c.ayuda ?? servicio.tutorial}`, asi
que **si un campo tiene ayuda propia, el tutorial del servicio no se ve nunca para ese
campo**. Escribir uno y no el otro deja dos textos que se contradicen, y el que gana es el
que nadie reviso.

**La regla del tutorial de un campo**: el del servicio contesta «como conecto esto»; el
del campo contesta **«que pongo ACA»**, que es la pregunta de quien tiene el cursor
adentro del input. Si los cuatro campos abren el mismo texto de 20 pasos, tres de esos
cuatro estan contestando otra cosa.

# Un flag de visibilidad protege la PANTALLA; la API hay que cerrarla aparte

`soloPlataforma`, `oculto`, `esSuper`: los flags que deciden qué se dibuja no protegen
nada hasta que alguien los consulta, y el que los consulta casi siempre es la capa que
pinta. El dato sigue saliendo por la API.

El caso, del 24/08/2026. GitHub —el token del repo de la AGENCIA— estaba marcado
`soloPlataforma: true`, la regla `defsVisibles()` lo respetaba y tenía test. La grilla de
/integraciones filtraba bien. Y aun así `GET /api/integraciones/credencial?servicio=github`
le devolvía **200 con la ficha entera** a un admin de workspace cliente: el copy interno de
la agencia, el tutorial y los nombres de las envs. `serviciosPara(esSuperAdmin)` existía en
el catálogo justo para eso y **no la llamaba nadie**: código muerto.

1. **Un guard de visibilidad se prueba pidiéndole el dato al SERVER con una sesión de
   cliente**, no mirando la pantalla. Si el JSON lo trae, está filtrado — aunque la UI no
   lo pinte.
2. **El guard va en el CHOKE POINT.** Ahí había cuatro caminos que resolvían un servicio
   (`GET`, `guardar`, `descubrir-github`, `verificar`), todos llamando al accessor crudo.
   Cerrar tres deja el cuarto: se pone UN resolvedor y todos pasan por él.
3. **404, no 403.** Un 403 confirma que la integración existe, y eso ya es contar algo de
   la plataforma. A quien no le corresponde, no existe.
4. **La pregunta es por el WORKSPACE, no por el usuario.** `getSesionAdmin()` contesta
   «¿quien mira es admin?», y el super admin lo sigue siendo dentro del workspace de un
   cliente con `?ws=N` — por ahí la tarjeta del token del repo se dibujaba adentro del
   panel de dos clientes. Va `wsActual === await wsSuperAdmin()`. Es la otra mitad de la
   regla de `OWNER_WS` que ya está más arriba, y ya falló tres veces.

**Y el corolario que decide dónde escribir:** se guarda DONDE SE LEE. Ese modal guardaba
con `ctx.ws` mientras `lib/github-commits.ts` leía de `wsSuperAdmin()`: cargarlo desde el
workspace de un cliente habría dejado el token de la agencia en la fila del cliente **y sin
que la feature funcione**, porque el que lo consume mira otro lado.

# Una política puede RECHAZAR; no puede no dejar rastro

Un endpoint que descarta algo y devuelve 200 sin escribir nada hace indistinguibles dos
diagnósticos opuestos: **«no llegó» y «lo tiramos nosotros»**. Y el que investiga después
—mirando la base, mirando los logs, repitiendo la prueba— va a llegar a la conclusión
equivocada las tres veces, porque las tres muestran lo mismo: nada.

El caso, del 24/08/2026: `/api/track/optin` tira el opt-in si el workspace no declaró la
landing como entrada de leads en `/funnel`. La política es correcta —el mismo snippet se le
da a todos, y a nadie se le llena el CRM de algo que no esperaba—, pero la rama devolvía
`ok({ ignorado })` y se iba: sin insert, sin `console.warn`, sin contador. Un cliente se
agendó en su propia landing **durante una prueba en vivo**, el lead se cayó por ahí, y la
pantalla le contestó «no aplica».

1. **Rechazar se registra.** Una fila, un contador, algo que se pueda consultar. Sin datos
   personales: lo que se guarda es que PASÓ y por qué, no quién — el motivo del rechazo no
   necesita saberlo, y una tabla de eventos no es lugar para el contacto de alguien que el
   negocio decidió no ingestar.
2. **Y el rechazo se muestra donde se lee la consecuencia.** El log es para depurar después.
   El renglón que decía «no aplica» es el que tiene que decir «llegó, y NO entró».
3. **Un `na` no puede afirmar un hecho del negocio si solo conoce su config.** «Nadie marcó
   la casilla» y «este negocio no capta por ahí» son cosas distintas, y el texto elegía la
   que no era. Si además sabés que la puerta existe —el analizador la vio, o ya bloqueaste
   uno— no es «no aplica»: es **una puerta abierta sin conectar**, va en ámbar y lleva al
   lugar donde se arregla.

**Corolario: un verde que cierra la pregunta sobre algo que se está perdiendo es peor que un
rojo.** Medir la reserva no es quedarse con la persona que reservó.

# El fuente y lo que se sirve no son el mismo texto

Todo lo que se genera dentro de un **template literal** —el snippet del Pixel es el caso
grande— se lee bien en el editor y sale distinto por el otro lado. Leer el código no alcanza
para revisarlo: **hay que renderizarlo**.

Dos formas en que muerde, las dos medidas el 24/08/2026 en `lib/landing-token.ts`:

1. **`\s` adentro de un template no es la clase «espacio»: es la letra `s`.** El fuente decía
   `.replace(/\s+/g, ' ')` y en la página del cliente se pegaba `.replace(/s+/g, ' ')`, que
   le borraba todas las eses al texto de los botones. «¿Qué pasa después de agendar una
   llamada?» llegaba como «¿Qué pa a de pué de agendar una». Vivo desde la v6, a la vista en
   el panel, leyéndose como un texto cortado del cliente. **Toda clase de regex va con DOS
   barras.**
2. **El código generado se DELATA ante quien lo lee después.** El snippet viaja pegado en la
   página del cliente, y el analizador de piezas busca marcas ahí (`cal.com`, `pandavideo`,
   `<video`) para decidir qué chequeos pedirle a esa landing. Una marca escrita en un
   **comentario** del snippet convierte a toda página con el Pixel puesto en una página que
   «tiene» algo que no tiene. Ya había pasado con `<video` y `<button` —por eso existe
   `sinRuido()`— y volvió a pasar apenas se documentó el soporte de agendas.

La guardia es `tests/landing-snippet-emitido.test.ts`: reconstruye el snippet aplicando las
reglas de escape y lo audita contra los propios detectores. **Si escribís código generado,
el test mira lo EMITIDO, no el fuente.**

⚠️ **Y LA LANDING NO SE EDITA A MANO: `app/vsl/landing-html.ts` ES GENERADO.** No es un
template literal — son **170.816 caracteres** de un string entre comillas dobles,
auto-generado desde Claude Design. Se lee como un archivo fuente y no lo es: cualquier
cambio escrito ahí se desincroniza de su origen y **la próxima regeneración se lo come**,
sin dar error y sin aparecer en ningún diff que alguien vaya a mirar.

Lo que se agrega a la landing —una sección de precios, un botón de compra, un bloque
nuevo— se monta desde `app/vsl/Landing.tsx`, que ya inserta nodos sobre ese HTML en cuatro
lugares (`:66`, `:114`, `:135-142`, `:204`) con `insertAdjacentElement`. Y todo lo que
necesite estado o un handler **tiene** que vivir ahí igual: un string no puede tener un
`onClick`.

⚠️ **Y adentro de un template literal no va NINGÚN backtick, ni siquiera en un comentario.**
Es la convención del repo nombrar una clase o una función entre backticks, y adentro de una
cadena eso la CIERRA a la mitad. Pasó el 30/08/2026 en la hoja de estilos del portal de
cursos (`CursoPortal.tsx`, la constante `CSS` de 250 reglas): un comentario que decía
`` `.al-rescard-desc` `` partió la hoja, y **la pantalla contestó HTTP 200 con el layout
entero y ni una tarjeta** — que se lee igual que «mi componente renderiza vacío» y manda a
depurar el componente, que estaba bien.

## Y en JSX, un `//` entre etiquetas NO es un comentario: es TEXTO

En posición de hijo de JSX no hay sintaxis de comentario. Un bloque `//` ahí es una
cadena como cualquier otra, y React la pinta. Sólo `{/* … */}` comenta, y sólo porque
es una expresión.

Y **el compilador no puede ayudar**: `<div>// hola</div>` es JSX perfectamente válido.
Tampoco lo cazan los tests, que miran datos y no pantallas. Lo caza mirar la pantalla, o
no lo caza nadie.

El 31/08/2026 llegó a producción así: catorce líneas explicando por qué la pantalla usa
`Estudio` y no `WizardShell` —con sus backticks, sus flechas y sus «⚠️»— impresas arriba
de todo en la tab del cliente. Lo escribí yo mudando ese paso, y salió por la misma
puerta que el bug de arriba: se movió un bloque desde un contexto donde `//` comenta
(entre sentencias) a uno donde no (entre etiquetas). **Es un cambio de CONTEXTO, no de
contenido**, así que el diff no muestra nada raro.

⚠️ La regla operativa: **cuando muevas un comentario, mirá dónde CAE, no qué dice.**
Entre `return (` y `<Tag>` seguís en JS. Después del primer `<`, ya no. Y un barrido lo
encuentra en segundos: una línea que empieza con `//` cuyo vecino de arriba cierra una
etiqueta y cuyo vecino de abajo abre otra.

Lo mismo vale para todo lo grande que vive en una cadena de este repo: los prompts, el
snippet del Pixel, el SQL embebido. Nombrá la clase sin comillas de ningún tipo. Y el `${`
es el otro carácter con esa propiedad: `$100M` es inofensivo, `${algo}` no.

## Y el gemelo: una regex CITADA adentro de un comentario de bloque lo cierra

El mismo accidente, del otro lado. La convención de la casa es explicar en el comentario qué
hacía el código que se sacó — y si eso que se sacó es una regex, puede traer adentro la
secuencia que cierra el bloque. Medido el 29/09/2026 en `lib/email-html.ts`: un `/** … */`
que citaba el `replace` que borraba los asteriscos **partió el archivo al medio**, y el
typecheck escupió seis errores de sintaxis en líneas que no tenían nada que ver.

Se cuenta lo que hacía **en palabras**, o se parte la secuencia. Y si el archivo no compila
después de escribir un comentario largo, es esto antes que cualquier otra cosa.

**Cómo se diagnostica en 7 segundos:** cuando una ruta devuelve 200 y le falta el CUERPO,
corré `npm run typecheck` antes de leer nada. Lo caza — pero lo dice al revés, como
`Property 'al' does not exist on type '"\n.cono.ahc {…"'`: el nombre de la propiedad es el
pedazo que quedó afuera de la cadena.

# «No puedo hacer X con este dato» no es «este dato es falso»

Un control que descubre que no puede ACTUAR sobre algo tiene una sola salida honesta:
apagar la acción. Nunca borrar el hecho.

El caso, del 12/8/2026. La extracción de una reunión clasificó bien las 37 tareas: 26
eran de Mauricio, con su email. Después un gate preguntó «¿le puedo repartir a este
email?», la respuesta fue no, y borró **dos** campos:

    duenoEmail: repartible(t.dueñoEmail) ? t.dueñoEmail : undefined,
    esDeOtro:   t.esDeOtro && repartible(t.dueñoEmail) ? true : undefined,   // ⛔

El primero está bien: sin cuenta no hay a dónde escribirle. El segundo borró **de quién
es la tarea**, que no tiene nada que ver con si le podemos escribir. Las 26 entraron al
tablero del dueño y la pantalla de esa persona no llegó a existir.

**La prueba de que son cosas distintas: el comentario que estaba justo arriba lo decía
bien** —«el nombre se conserva SIEMPRE; lo que se corta es el reparto»— y la línea de
abajo hacía otra cosa. Quien lo escribió tenía la distinción en la cabeza y la perdió en
una sola expresión booleana.

**La regla: cada pregunta, su campo.** «¿De quién es?» (clasificación), «¿a dónde le
escribo?» (dato de contacto) y «¿le puedo mandar?» (capacidad) son tres, y meterlas en
una sola variable hace que la más débil se lleve puestas a las otras dos. Cuando veas un
`&&` que junta un hecho con un permiso, ahí hay un dato a punto de desaparecer.

**Y el corolario del default:** si la comprobación de capacidad falla (la consulta de
usuarios se cayó, la lista vino vacía), se pierde la ACCIÓN y nunca el HECHO. Degradar
hacia «entonces todo es mío» es exactamente el modo de falla de arriba, servido por el
camino de error.

# `res.ok` no es «salió bien»: los proveedores mandan el fallo ADENTRO del 200

Ya mordió en **tres**, así que no es una rareza de uno:

- **Meta** contesta 200 con `body.error` (incl. subcode 4841013, «Permisos»).
- **Evolution/WhatsApp** contesta 200 con el estado POR PARTICIPANTE adentro:
  `{ "updateParticipants": [ { "status": "403", … } ] }`.
- **Google BOQ** (el Flow nuevo) contesta 200 con un frame `"er"`. Con `res.ok` el
  popup le dijo al dueño «Listo, lo verás en tu Flow» sobre un pedido que no creó
  nada, y fue a buscar un video que nunca se pidió. Lo peor: **el crédito puede
  haberse gastado igual**, así que el éxito falso no sólo miente, además tapa la
  única pregunta que importaba.

BOQ agregó dos formas que las otras dos no tenían, y las dos se leen igual que un
éxito si sólo se busca «¿hay un frame bueno?»:

- **El error y el frame bueno pueden venir en la MISMA respuesta.** Quedarse con el
  primero que matchea es exactamente cómo se afirma un éxito que no pasó: el frame
  de error se busca **antes**, siempre.
- **Un frame con payload vacío (`''`, `null`, `[]`) no es un éxito.** Es la forma en
  que BOQ dice «te escuché y no hice nada», y es indistinguible de un ok si sólo se
  mira que el frame exista.

El lector vive en `lib/flow-boq-respuesta.ts`, con test, y se copia a la extensión
por `scripts/sync-boq-respuesta.mjs` (chequeo de pre-push).

Un cliente reportó «le di a enviar y no pasó nada, ni siquiera un mensaje de error»
justamente por esto: `agregarParticipanteGrupo` hacía `return r.ok ? { ok: true } : …`,
así que informaba un éxito que no ocurría. **No había error que mostrar porque el sistema
creía que había funcionado.**

- **Cuando el síntoma es «no pasa absolutamente nada», sospechá de un éxito falso antes que
  de un error tragado.** Un error tragado al menos deja un log y una excepción; un éxito
  falso no deja nada, y encima envenena todo lo que viene después (se cierra el modal, se
  marca el paso como hecho, se limpia el formulario).
- Al escribir un cliente de una API nueva, **buscá en su respuesta 200 el campo donde vive
  el fallo por-ítem** antes de dar el camino feliz por cerrado. Si mandás N cosas en una
  llamada, la respuesta casi siempre trae N estados y el HTTP es uno solo.
- Y **traducí ese estado a una frase**, no lo pases crudo: `403` no le dice nada a nadie
  (ver `RESULTADO_PARTICIPANTE` en `lib/mako-grupo.ts`).

# La salida de un estado trabado no puede pasar por lo que está trabado

La línea de voz de MaKo quedó con el socket muerto y Evolution diciendo `open`. Para
volver a dar un QR había que soltar la sesión, y `logout`, `delete` y `restart` **le
hablan a WhatsApp por ese mismo socket**: los tres fallan o no hacen nada, y ninguna
ruta de la API la saca de `open` (medido el 11/09/2026). El código hacía `logout`,
**no leía el 500**, esperaba 1,5 s y le decía al dueño «reintenta». Iba a fallar siempre.

- Antes de dar por buena una recuperación, preguntá **por dónde pasa**. Si depende del
  componente que se rompió, no es una salida: buscá una que no lo toque (acá, una
  instancia nueva, `conectarCanalMaKo` en `lib/mako-canal.ts`).
- El resultado de cada paso de la recuperación **se lee**. Un paso que se da por hecho
  convierte un callejón sin salida en un «reintenta en unos segundos».
- Es la regla de la alarma que no viaja por el canal caído (`lib/canal-vigilante.ts`),
  vista del otro lado.

# Una sonda se valida en los DOS estados, con reloj

La sonda de vida de WhatsApp (`sondearSocket` en `lib/evolution.ts`) se eligió el 08/09
comprobando que fallara sobre instancias MUERTAS, y fallaba bien. Nadie la midió contra
una VIVA grande: ahí `fetchAllGroups` no terminaba ni en 90 s, así que nunca decía
«vivo». El 11/09 Martín escaneó el QR, la línea anduvo, MaKo contestó un mensaje, y el
panel le mostró «WhatsApp Admin con error». Su conclusión fue «no funcionó».

- Una sonda se prueba contra algo que SABÉS muerto y algo que SABÉS vivo, y se anota
  cuánto tarda en cada uno. Una que no puede decir «vivo» miente igual que una que no
  puede decir «muerto», y cuesta más verla porque parece prudencia.
- Un 200 idéntico en los dos lados descarta el endpoint: `whatsappNumbers`,
  `fetchProfile`, `fetchProfilePictureUrl` y `fetchPrivacySettings` contestan 200 con el
  socket muerto.
- Y se prueba EJECUTÁNDOLA, no leyéndola. La reescrita del 11/09 pasaba sus tests por regex
  y daba `sin_respuesta` sobre las tres muertas: Evolution anida el mensaje de error y el
  lector buscaba otro campo. El veredicto va en un módulo puro con test sobre los bodies
  medidos (`lib/evolution-sonda.ts`).
- «No pude leer» tampoco es un valor. `getSetting` convierte un 5xx en null y un `||` lo
  vuelve un default: así el canal de MaKo pasaba a ser la línea zombi y la voz la de un
  cliente. Si el default decide algo destructivo (qué línea soltar, a quién alarmar), se lee
  con `getSettingEstricto` (lib/settings.ts), que tira.

# Un mapeo a un workspace sirve para UN handler, no para todos

`wsDeInstancia` (app/api/webhooks/evolution/route.ts) mapea la línea de WhatsApp de MaKo a
`OWNER_WS` para que el doer corra en sus grupos. Pero lo usaban TODOS los handlers del webhook, y
`OWNER_WS` es el ws1, un cliente: el 11/09/2026, al escanear la línea, la agenda del teléfono de
MaKo pisó los nombres de 1438 contactos de Mauricio, sin historial para volver atrás.

- Cuando se le da workspace a algo que no es de ningún cliente para UN propósito, los demás
  caminos que leen ese mapeo tienen que cortar explícitamente, y el corte va con test.
- Antes de escanear o conectar algo que sincroniza datos (contactos, historial, etiquetas),
  preguntá a qué workspace van a caer.

# Un mensaje de error dice DE QUIÉN fue y QUÉ HACER, o no sirve

Cuando algo falla del lado del usuario —su cuota, su credencial, su configuración—
el mensaje tiene que decirlo y linkear a dónde se arregla. Comerse una culpa ajena
no es humildad: **es esconder la única información accionable que hay.**

El pedido del dueño, textual (25/8/2026): *«Si la culpa es DEL CLIENTE, porque no
cargó sus key, el mensaje tiene que reflejar eso. No un "He fallado en la
transcripción"… ahí MaKo queda como el culpable. Tiene que decir "Te quedaste sin
tokens, cargá tus otras key aquí" y enviar el link.»*

MaKo le decía a un cliente «se me cayó la transcripción» cuando lo que pasaba era
que tenía UNA sola API key y estaba agotada. Dos daños, y el segundo es el caro:

1. El producto queda como el roto cuando no lo está.
2. **«Reintentá en un momento» sobre una cuota agotada manda a repetir algo que va
   a fallar igual**, mientras la solución está a dos clics y el cliente no se entera.

Las cuatro reglas, que valen para cualquier error que llegue a un usuario:

- **Clasificá la causa antes de redactar.** No hay un mensaje de error, hay uno por
  causa. Ver `lib/fallo-ia-texto.ts`: sin keys / sin cuota / sin respaldo /
  proveedor caído son cuatro frases distintas porque son cuatro acciones distintas.
- **Mirá TODOS los errores, no el último.** El último suele ser el casillero vacío
  del final de la cascada («falta OPENAI_API_KEY») cuando lo que pasó fue el 429 del
  primero. Clasificar por el último manda a arreglar lo que no era.
- **Si hay algo que hacer, va el LINK a la pantalla exacta** —con su deep-link, no
  la home— dentro del mismo mensaje.
- ⚠️ **Y LA CONTRACARA: cuando NO es del usuario, decilo con todas las letras.**
  Culpar al cliente por un bache ajeno es el mismo error con el signo cambiado y
  se paga peor, porque lo manda a tocar algo que está bien. `proveedor_caido`
  dice «no es nada tuyo, tus keys están bien» y **no** lleva link.

- ⚠️ **Y CUANDO EL QUE FALLA ES UN TERCERO, SE LO NOMBRA — no alcanza con decir
  «no es tuyo».** Martín, sobre un rechazo de Google que una clienta leyó como un
  fallo de MaKo: *«si el problema NO lo tenemos nosotros, NO asumir la culpa.
  Incluso dejar bien en claro quién es el culpable. Si no, los usuarios piensan
  que MaKo falló»*.

  Un mensaje que arranca por la instrucción se lee como que algo de acá se rompió,
  aunque después aclare. **El nombre del que dijo que no va PRIMERO**, y con las
  tres cosas que lo vuelven verificable: que el pedido salió bien de acá, que pasa
  igual haciéndolo a mano en la herramienta del tercero, y si cobra o no.

  ⚠️ Pero sólo si está MEDIDO. «Pasa igual a mano» es una afirmación fuerte y
  falsa el día que no lo sea: acá se pudo escribir porque la clienta lo reprodujo
  en su propio Google Flow y mandó la captura. Sin esa prueba, se dice quién
  contestó el error y nada más — echarle la culpa a un tercero sin medirlo es el
  mismo error otra vez, con el dedo apuntando para afuera.

# La voz de MaKo es rioplatense, y el texto DEL CLIENTE no

`brandSystem()` antepone `getActivePersona()` —la voz de MaKo— a todo prompt que lo use.
Eso es correcto para lo que MaKo le dice a Martín, y **se filtra** a lo que MaKo escribe
*para* el cliente si nadie lo corta.

Pasó el 25/08/2026 con `lib/video-planner.ts`: el primer guion generado para un cliente
**norteño de México** decía «el cuello de botella **sos vos**», «**¿y vos qué vas a
hacer?**» y «**Tocá** el botón», con los siete prompts pidiendo acento
`Argentine (Rioplatense)`.

**Y la prohibición ya existía, textual, en otro writer** — `lib/campaign-structurer.ts:83`:
*«Tu voz rioplatense va SOLO en el "rationale" […] JAMÁS en los textos del anuncio.»* Es
«una regla aplicada en un lugar de dos no está implementada, está documentada», otra vez.

- **Todo prompt que pase por `brandSystem()` y produzca texto que el CLIENTE va a leer o
  decir lleva su bloque de idioma explícito.** La pregunta al escribir un writer nuevo no
  es «¿qué le pido al modelo?» sino **«¿de quién es la voz de lo que sale?»**.
- **Y la segunda capa mide la salida**, porque el prompt solo no alcanza: `marcasDeVoseo()`
  (`lib/puestas-data.ts`, sin `server-only` para que se pueda testear) marca el texto y la
  pantalla lo muestra. No corrige —reemplazar formas verbales a mano rompe la prosodia—:
  avisa y se rehace.
- **Cuando el texto lo va a DECIR una persona, el acento es un campo, no un default.**
  No se puede adivinar, y equivocarlo no se nota al leer: se nota cuando alguien
  lo dice en voz alta. Ya costó seis versiones de guion.

  ⚠️ **Y UN VALOR QUE SE RESCATA DE OTRO CAMPO DESAPARECE PARA EL REGISTRO QUE
  NACE SIN ESE CAMPO.** El bloque de acento se saca del prompt que escribió el
  modelo (`acentoDe(clip.prompt)`), con un porqué correcto: el acento que vale es
  el de cuando se escribió el plan, no el del perfil de hoy. Lo que ese
  razonamiento no contempla es al clip que **nunca tuvo prompt** — los que crea el
  botón «Partirla en N tomas», que es el camino normal para una línea que no entra
  en el tope, no un caso raro.

  Medido el 02/09/2026: de las 11 tomas de un anuncio, las 9 originales salieron
  con `Spoken in …` y las 2 nacidas de partir una toma salieron sin nada, 24 veces.
  El prompt se ve completo, el texto sale en español igual, y el único síntoma es
  que el modelo no sabe en qué variedad hablarlo.

  **Antes de derivar un valor de otro campo, preguntá qué pasa con las filas que
  nacen sin él** — y si la respuesta es «se pierde en silencio», hace falta un
  respaldo a nivel del conjunto (acá `acentoDelPlan`, que además arregla los planes
  ya rotos sin tocar un dato).

⚠️ **Y el detector: `\b` de JavaScript es ASCII, incluso con el flag `u`.** En `tocá` no
hay borde de palabra entre la `á` y el espacio, así que `\b(tocá)\b` da **cero
coincidencias, sin error** — y lo que se escapa son justo los imperativos (`tocá`, `andá`,
`mandá`, `dejá`, `mirá`), que son la forma de todo CTA. En cualquier regex sobre español
los límites van por Unicode: `(?<!\p{L})(…)(?!\p{L})`. El test que lo caza **tiene que
incluir una palabra terminada en vocal acentuada**: probando solo las que terminan en `s`,
el bug pasa verde.

⚠️ **Y la lista de formas NO se escribe a mano: se GENERA desde infinitivos.** Enumerarlas
es lo que dejó «¿Cuánto **invertís** por día en Meta Ads?» en producción con
`tests/puente-panel-copy.test.ts` en VERDE — una lista escrita a mano cubre lo que ya se
escribió, nunca el verbo que todavía no usó nadie. La conjugación voseante es regular y sale
del infinitivo; lo único que se escribe es lo irregular del lado NEUTRO (`tener` → tienes).
Al ampliarlo aparecieron **224 casos vivos en 96 archivos**. Cuando un chequeo se queda
corto, la pregunta no es «¿qué le falta a la lista?» sino **«¿por qué hay una lista?»**.

⚠️ **Y ese mismo guard daba verde sobre código que NUNCA MIRÓ.** Un `text/*` —un MIME con
comodín, adentro de un comentario `//`— abría un bloque `/* … */` que se cerraba 71 líneas
después, y todo eso quedaba invisible. Vale para cualquier pipeline de `replace`: **si el
paso B puede consumir lo que el paso A tenía que borrar, es un bug de ORDEN** (acá: los
comentarios de línea van ANTES que los de bloque), y antes de escribir un parser probá si
alcanza con reordenar — el scanner que se escribió en el medio salió peor que el regex.

El detalle, con las dos familias de homógrafos que no se pueden marcar y el agujero
permanente de los imperativos `-ir`, en [docs/hallazgos-copy.md](docs/hallazgos-copy.md).

# Un mensaje HONESTO también puede afirmar de más, y ahí es donde se cuela

La regla de abajo cubre el mensaje que acusa. Ésta cubre al que ya dejó de acusar y
todavía inventa: **la parte de «qué hacer»**.

Un error bien escrito tiene dos mitades —de quién fue, y qué hacer al respecto— y la
segunda se escribe de memoria mucho más seguido que la primera. Es la mitad que nadie
revisa, porque el mensaje ya *suena* honesto.

El caso, del 05/09/2026, en tres pasadas sobre el mismo botón:

1. «Tu sesión de Flow venció, o Google la pausó» — a alguien con la sesión perfecta.
   Se arregló: dejó de acusar al cliente.
2. «Google reescribió Flow y cambió por dónde se piden. Míralos en Flow, arriba a la
   derecha.» Suena honesto y tiene DOS afirmaciones sin medir: que los créditos se
   movieron, y que están arriba a la derecha.
3. Medido en una cuenta PRO con el proyecto abierto: **no hay ningún número de
   créditos en la pantalla, ni en el menú de la cuenta, ni en una sola de las
   respuestas que la app recibe.** Google los sacó.

O sea que el arreglo del paso 2 movió el defecto un renglón: dejó de culpar a la
sesión y pasó a **inventar un lugar**. Y esa versión es peor de detectar, porque el
que la lee ya no siente que lo están culpando — siente que está ciego.

- **Si no sabés DÓNDE está algo, el mensaje dice qué pasó y se calla.** Una
  instrucción inventada cuesta más que ninguna: la persona la sigue, no encuentra
  nada, y concluye que el problema es ella.
- **Y no lleva botón.** Un botón que va a cualquier lado se lee como «ahí está la
  respuesta». Sin destino verdadero, no hay botón.
- **El test rápido antes de escribir un remedio:** ¿lo VISTE, o lo estás deduciendo
  de cómo era antes? Los tres mensajes de este caso salieron de recordar la app
  vieja.

# Un mensaje que sale solo no puede AFIRMAR lo que no verificó

Un aviso automático llega con la autoridad del sistema: el que lo lee no tiene cómo
chequearlo y no está en condiciones de dudar. Por eso cada afirmación de un mensaje que
se manda sin que nadie lo lea antes tiene que colgar de un dato que se midió, y no del
hecho de que el mensaje se esté mandando.

El caso, del 21/8/2026. A un cliente le salieron cuatro WhatsApps: «⛔ Tu cuenta
publicitaria está **NO SE PUDO LEER EL ESTADO DE META**. 🛑 3 H 25 MIN SIN ENTREGAR. 💸
Seguís sin recibir un solo lead». Su cuenta estaba **Activa**, sin deuda y entregando.

Tres formas distintas de afirmar de más, y las tres valen para cualquier mensaje:

- **Una ranura de texto asume un TIPO.** `Tu cuenta publicitaria está *${estado}*` solo
  acepta un estado; el día que le entra un mensaje de error, la gramática de la frase le
  presta autoridad a un dato que no la tiene. Antes de interpolar, preguntá **de qué
  conjunto** sale el valor — y si el conjunto no está cerrado, no hay ranura.
- **No poder leer un dato no es un valor del dato.** Un error de lectura tiene que quedar
  marcado como tal (acá: `service_incidents.confirmado`, mig 0139) y **nunca** puede
  disparar la acción que dispara el hecho. Es «"No puedo hacer X con este dato" no es
  "este dato es falso"» aplicada a la salida en vez de a la entrada.
- **Una regla aplicada en un lugar de cuatro no está implementada, está documentada.**
  `lib/alerta-critica-texto.ts` decía textual «si Meta no lo confirma, no se afirma» y
  colgaba de `entrega_frenada` **solo la línea de al lado**; las otras tres afirmaciones
  sobre leads salían siempre. Cuando escribas la regla en un comentario, contá cuántas
  líneas del archivo deberían obedecerla.

**Y el guard va en POSITIVO:** «solo se persigue lo que el proveedor CONFIRMÓ», nunca
«todo menos el texto de error que ya conocemos» — el próximo error de lectura dirá otra
cosa y entra igual.

Corolario operativo: **buscá también los renders, no solo los crons.** Ese incidente no
lo abrió el cron, lo abrió `app/integraciones/page.tsx` al dibujarse. Un cron corre
siempre y deja log; una escritura colgada de un render depende de que alguien haya
mirado, así que no queda ningún rastro de por qué empezó ese día y no otro.

# Un mensaje que habla de un MOMENTO se re-pregunta al salir, no al programarse

Un reintento conserva el texto del mensaje, no su sentido. «Te dejo el video para que llegues
con contexto» es verdad cuando se programa y mentira cuando sale dos días después de la reunión
— y la cola no se entera, porque para ella es la misma fila esperando.

Medido el 25/09/2026 en el ws 1. Con la línea de WhatsApp caída 22 días, cada fallo reprogramaba
el envío +24 h. Los dos únicos leads en cola de todo el producto terminaron con la reunión el
23/09 y el 25/09 a las 20:00 y su primer audio programado para el 25/09 a las 21:00: una
preparación que llegaba después de la llamada, con la voz del dueño.

La guarda «sin reunión futura no hay nada que mandar» ya existía… para el paso con
`ancla: 'reunion'`. Y los pasos de la post-agenda NO están anclados: salen 1 h y 24 h después de
AGENDARSE, así que no la tocaban. **Una guarda no cubre a los pasos que HABLAN de la condición,
sino a los que la DECLARAN** — y esos dos conjuntos casi nunca son el mismo.

- **Preguntá qué condición hace falsa al mensaje** (la reunión pasó, el lead ya pagó, el anuncio
  ya se aprobó) y volvé a evaluarla en el momento del envío, no solo al encolar.
- **Si la condición ya no vale, cerrá sin mandar y sin dejar `proximo_envio_at`**: un reintento
  es lo que produjo el atraso, así que reintentar lo empeora.
- **El alcance va por PROPÓSITO, no por campo declarado.** Acá: `preparaUnaReunion(trigger)` en
  `lib/nutricion-familias.ts` cubre la familia entera de la post-agenda, y el guard de
  `tests/reunion-ya-paso.test.ts` falla si el motor vuelve a mirar solo `paso.ancla`.

# Un DIAGNÓSTICO escrito de antemano deja de ser cierto sin avisar

Un mensaje de error puede explicar la causa. Lo que no puede es **traer la causa
escrita en el código**. `/api/meta-recommendations` devolvía, cuando Meta contestaba
vacío, un `reason:` literal que culpaba al token de página, al `account_status=3` y a
la 2FA. Era verdad — de UNA cuenta, en junio. En septiembre esa cuenta ya estaba al
día y el párrafo seguía saliendo, palabra por palabra, sobre la cuenta de otro cliente
que está `account_status=1` y con `ads_management` concedido: una acusación falsa que
manda a arreglar una factura que no existe.

**La regla:** el motivo de un vacío o de un fallo se arma con lo que la respuesta
ACABA de decir, en la misma llamada. Si el diagnóstico no sale de un campo que
recibiste, no lo escribas: decí que no pudiste determinarlo. «No sé por qué» es un
mensaje útil; «es por X» cuando X no se midió es peor que el silencio, porque manda a
alguien a buscar donde el problema no está.

Y hay una prueba barata para saber si estás cayendo en esto: **¿el texto cambiaría si
la respuesta fuera otra?** Si no, es una constante disfrazada de explicación. Lo mismo
vale para un `catch` que asume la causa (ver «Un `console.warn` no es un control»).

# Un campo con una moneda o un país en el NOMBRE es una constante disfrazada de dato

`daily_budget_mxn`, `{ countries: ['MX'] }`, `usdToMxn(...)`. Los tres describen una
decisión de negocio de UN cliente, cableada en un tipo o en una constante. Cuando el
segundo cliente no es de ese país ni cobra en esa moneda, **nada falla**: la campaña se
crea, se segmenta y se presupuesta — en el país equivocado y por 17 veces el monto que
la persona tipeó. La falla silenciosa es la que cuesta plata.

**La regla:** la moneda, el país y la zona horaria los define **la cuenta del
proveedor**, y hay que ir a preguntárselos por API. En Meta:
`/api/ads-manager/targeting?kind=cuenta` → `{ currency, country }`, y los lugares del
público salen del buscador de Meta (`kind=lugares`: país, provincia, ciudad, código postal,
barrio, partido, dirección), no de una lista nuestra. Y aun teniendo el default bien, **la
pantalla lo pregunta igual**: adivinar bien no reemplaza a poder editar.

⚠️ Y ojo con qué campo se usa para adivinar: `business_country_code` de la cuenta
publicitaria es el país **fiscal**, no el del público. Una LLC estadounidense que vende
en Argentina da `US`. El que acierta es `timezone_name`, que es la zona con la que se
eligió operar la cuenta (`lib/meta-pais.ts`).

⚠️ **Y LO QUE SE LEE TAMBIÉN: el gasto de Meta en dólares sale de `conversorGastoMeta()`
(`lib/moneda-meta.ts`), nunca de dividir por `TIPO_DE_CAMBIO_USD_MXN`.** Las escrituras se
arreglaron en septiembre y la lectura siguió dividiendo por 17,3 para todos: el 08/10/2026
ws13, ws14 y ws15 —que cobran en USD— veían su gasto 17 veces más chico en el dashboard, el
CAC y MaKo. `spend`, `balanceMxn` y compañía están en la moneda de la CUENTA aunque se
llamen distinto. `tests/moneda-meta.test.ts` barre `lib/` y `app/` y falla nombrando el
archivo si un lector vuelve a asumir pesos.

# Un estimador que devuelve CERO no es un validador

Meta tiene dos endpoints que contestan «¿a cuántas personas llega esta segmentación?», y
contestan distinto a lo que importa. Medido el 11/09/2026 contra la creación real de un
conjunto con `validate_only`: para lugares que se pisan, un radio fuera de rango y un pin
de 0,5 km, `delivery_estimate` devuelve **`0–0` personas, sin error**, y `reachestimate`
devuelve **el mismo subcode con el que la creación rechaza**. 8 de 8.

Un cero es un valor plausible —se lee «público chico»—, así que un validador armado sobre
el primero dice que todo está bien sobre una campaña que Meta no va a dejar publicar.

**La regla:** para validar algo antes de escribirlo, se usa el endpoint que **falla igual
que la escritura**, y eso se comprueba dándole a propósito una entrada que se sabe mala.
Si contesta un número en vez de un error, no valida: estima. Vale para cualquier
«estimate», «preview» o «dry-run» de un proveedor. Molde: `alcanceGeo` en
`lib/meta-ads-create.ts`; las mediciones, en `docs/hallazgos-ads.md`.

# La conexión de Meta de un cliente son DOS tokens, y el que se olvida sigue mandando

`META_ACCESS_TOKEN` y `META_PAGE_ACCESS_TOKEN` son dos filas de `credenciales`, y el de
página **guardado le gana al derivado** (`lib/meta-ads-create.ts`:
`if (guardado && !guardado.startsWith('PENDING')) return guardado;`). Además lo leen, por
su cuenta, la ingesta de leads (`lib/meta-leads.ts`) y el webhook
(`app/api/webhooks/meta-leads/route.ts`).

O sea que reconectar Meta cambiando sólo el token de acceso **deja viva la conexión vieja**:
los anuncios se crean con la nueva y los leads siguen entrando —o dejan de entrar— con la de
la app anterior, sin un solo error que lo diga. Se vio el 16/09/2026 al planear pasar a
Código Inmobiliario (ws13) de la app de su cliente a la de MaKo.

**La regla: cambiar la conexión de Meta de un workspace es ESCRIBIR las dos filas en el mismo
movimiento** — el token de página nuevo también, derivado del de acceso nuevo
(`GET /{página}?fields=access_token`).

⚠️ **Borrar la fila de página NO alcanza, y rompe.** `tokenDePagina` (privada, en
`lib/meta-ads-create.ts`) la derivaría, pero los otros dos lectores leen la fila directa y sin
ella tiran «META_PAGE_ACCESS_TOKEN no configurado»: borrarla corta la entrada de leads. Y por lo
mismo, código nuevo que necesite el token de página no agrega un cuarto lector de la fila.

⚠️ **Y el que GUARDA una conexión es UNO: `guardarConexionMeta` (`lib/meta-conexion.ts`).** Por
ahí pasan las dos puertas —pegar un token y el botón «Conectar con Meta»— y ahí vive la regla
de arriba, incluido el caso que no cubría: con VARIAS páginas no se guardaba ningún token de
página, así que reconectar dejaba el viejo. Una tercera puerta que escriba las filas a mano es
la que se va a olvidar de esto. (07/10/2026)

⚠️ **Y `META_APP_SECRET` es el secreto de la app VIEJA**, con el que se verifica la firma de
cada lead del webhook. El de la app MaKo es `MAKO_META_APP_SECRET` (`lib/meta-login.ts`).
Pisar el primero con el valor del segundo no da error al guardar: rechaza todos los leads
entrantes.

# Un umbral es un proxy, y el proxy hay que MEDIRLO contra los datos reales

Un número en una condición (`>= 3 tareas`, `>= 2 destinos`, `>= 15 caracteres`) casi
nunca es la regla: es un proxy barato de la regla, elegido porque suena razonable. El
problema es que después nadie vuelve a mirar si mide lo que se creía.

Dos casos del mismo día, y en los dos el número razonable estaba al revés:

**«Un proyecto necesita al menos 3 tareas».** Suena obvio. Medido contra el tablero: de
73 proyectos, 9 tienen CERO tareas y 14 tienen una sola, y casi todos son legítimos —
mientras que el peor proyecto que se abrió en agosto era el que **más** tareas traía. El
proxy estaba anticorrelacionado con lo que quería medir. Peor: hacía que el veredicto
dependiera de con quién viajó la tarjeta en el mensaje de WhatsApp.

**«Una palabra que ya vive en 2 proyectos es un tema, no un lugar».** También suena
obvio. Corrido contra el catálogo real, rechaza cuatro tabs que existen y son legítimas,
porque un proyecto padre conviviendo con uno derivado (`CRM` / `CRM automático`) es el
patrón de nombres de la casa. Con 3 queda limpio.

**La regla: antes de shippear un umbral, corrélo contra los datos que ya tenés y contá
los falsos positivos.** Son diez minutos y un script que se tira. Y dejá el test que
falla cuando el margen se acaba: el catálogo crece, y el número que hoy tiene aire
mañana no. Un umbral sin esa red envejece en silencio, que es la peor forma de
envejecer.

# Un nombre derivado de datos es una CLAVE, y un acento la parte en dos

Cuando la ruta de un recurso se arma concatenando campos —`<curso> - <autor>`,
`<cliente>/<proyecto>`, `<ws>_<slug>`— ese string dejó de ser una etiqueta: es la clave
que decide dónde se escribe. Y una clave derivada de texto libre se rompe con cualquier
diferencia invisible: un acento, un espacio doble, un guion largo, una mayúscula, una `ñ`
normalizada distinto (NFC vs NFD).

El caso, del 23/8/2026. La carpeta de un curso en Drive sale de `plan.curso` +
`plan.autor`. La carpeta existente decía **«MasteryHaus - Sofia Contreras»** y el plan
nuevo traía **«Sofía»** con tilde. Resultado: **una segunda carpeta**, con 23 videos y
**60 GB**, para el mismo curso. No falló nada — ni un error, ni un aviso. El curso quedó
partido en dos y se descubrió por casualidad, buscando por qué no se liberaba el disco.

**La forma en que falla es la peor:** el destino nuevo se crea solo y todo el proceso
reporta éxito. Un destino equivocado no da 404; da una carpeta vacía que se llena.

Tres reglas:

1. **Si un nombre se deriva de datos y decide DÓNDE se escribe, normalizalo antes de
   usarlo** —`normalize('NFC')`, colapsar espacios, y comparar sin acentos ni
   mayúsculas—, y buscá si ya existe un destino que matchee normalizado **antes** de crear
   uno nuevo. Crear es la última opción, no la primera.
2. **Nunca compares dos nombres «iguales» a ojo.** Los que difieren en un acento o en la
   forma Unicode se ven idénticos en cualquier listado, en cualquier log y en cualquier
   mensaje de error. Se comparan normalizados o no se comparan.
3. **Y al buscar, buscá con el criterio flojo.** El script que fue a listar la carpeta
   «Sofia» contestó «0 archivos» con los 23 ahí al lado, en «Sofía» — un cero perfectamente
   correcto sobre la pregunta equivocada. Cualquier barrido sobre un destino derivado tiene
   que mirar **todos** los que matcheen normalizado, no el que uno construyó.

# Un guard puede ser correcto y aun así ser el problema

`--liberar` no borra un video hasta que Drive confirma, del lado del SERVIDOR, que terminó
de subirlo. Es la condición correcta y no hay que ablandarla en el script.

Pero el 23/8/2026 esa condición dejó **60 GB** de video local esperando confirmación con
**2,4 GB de disco libre**. El guard estaba haciendo exactamente su trabajo y el trabajo,
en ese estado, iba a romper la máquina — incluido el propio Drive, que necesita disco para
su caché. Un guard protege de un riesgo; que ese sea el riesgo MAYOR en ese momento es una
hipótesis, no una constante.

**La regla: cuando un guard bloquea y el bloqueo tiene su propio costo creciente, la salida
es una excepción ACOTADA Y ESCRITA, no ablandar el guard.** En el caso: se liberó contra la
copia en el montaje —que no es una copia local sino el sistema de archivos del proveedor,
así que borrar la propia no cancela la subida—, manteniendo intacta la condición que sí era
irreemplazable (**el audio ya extraído**). El script del repo quedó sin tocar; la excepción
vivió en un script aparte que dice en su cabecera qué garantía se resigna y por qué.

**Y el corolario:** antes de aflojar, enumerá qué se pierde exactamente. Acá se perdía «la
certeza de que llegó al servidor» —recuperable rebajando un archivo— y no se perdía la
transcripción, que era lo irrecuperable. Si no podés nombrar qué garantía estás resignando,
no la resignes.

# Antes de restaurar lo que había, preguntá cuánto DEBERÍA haber

Cuando algo aparece incompleto y existe una versión anterior, la reacción es restaurarla.
Eso solo es correcto si la versión anterior **era** correcta — y eso es una hipótesis, no
un dato.

El caso, del 22/8/2026. El dueño reportó «no veo ningún recurso» en un curso. Una
regeneración había borrado los **8** que la ficha publicaba, así que se restauraron los 8,
se verificó en pantalla que se vieran, y se cerró el tema con su commit. La plataforma de
origen tiene **92**. El arreglo dejó el agujero de 84 tapado y **con cara de arreglado**,
que es peor que no haberlo tocado: un síntoma resuelto apaga la búsqueda.

**La regla: ante un faltante, la pregunta no es «¿qué había?» sino «¿cuánto hay en la
fuente?».** Y la fuente es el sistema que produce el dato, no nuestra copia anterior de él.

**Corolario del reporte:** cuando alguien dice «falta X», está describiendo lo que ve, no
acotando el problema. «No veo ningún recurso» era literalmente cierto **y** el problema era
diez veces más grande. Tomar el síntoma como especificación del alcance es cómo se entrega
un arreglo parcial con confianza total.

# Un número redondo es una hipótesis de truncamiento

Un `limit=20000` que devuelve **exactamente 1000** no devolvió mil filas: devolvió el tope
del servidor. PostgREST corta ahí por defecto y **no lo dice** — no hay error, no hay
header que uno mire por reflejo, y la respuesta es indistinguible de un resultado completo
salvo por el redondeo.

Costó un censo entero: un curso que la consulta acotada mostraba con 92 recursos aparecía
con **7**, y eso se leyó como un problema de permisos.

- **Si un total sale redondo (1000, 100, 500), asumí que está cortado hasta probar lo
  contrario.** Paginá y compará: el número real acá era 3107.
- **La contradicción es la que delata.** El truncamiento se detectó porque el censo
  contradecía una medición previa que se sabía buena. Sin ese segundo número, 1000 pasaba.
  Cuando midas algo grande, medí también una parte por otro camino.

**Y al ESCRIBIR una lectura: si la tabla crece con el uso, pasa por `leerTodo` o
`leerPorPaginas` (`lib/supabase-paginado.ts`) con un orden que termine en una columna
ÚNICA.** Un `.select()` suelto anda perfecto hasta el día que la tabla pasa las 1000 filas, y
desde ahí pierde datos sin un log: el CRM mostró 4 ganados de 13 (US$52.700) porque
`_listLeads` no paginaba — y era la lectura más importante de la app, que un barrido anterior
no vio porque buscó lo que paginaba MAL y no lo que no paginaba. `.limit(2000)` no sube el
techo. El orden de presentación por una columna que se repite (`created_at`, `fecha`) se
aplica en memoria DESPUÉS de paginar por `id`. Las otras formas de truncar sin parecerlo, y
qué tablas ya pasaron las 1000, en [docs/hallazgos-infra.md](docs/hallazgos-infra.md) → «El
techo de 1000 filas no da error».

# Contar filas no es contar cosas — cruzá por clave

Dos conteos que no coinciden invitan a restar y llamar «faltante» a la diferencia. Casi
siempre están contando universos distintos.

Medido el 22/8/2026: el portal publicaba **183** archivos de un curso y la plataforma
declaraba **283** recursos → «faltan 100». No faltaba **ninguno**: varias filas comparten
título (el mismo material colgado de varios módulos), así que 183 archivos cubren 283
filas. Se estuvo a un comando de bajar 100 archivos que ya estaban.

Y el error espejo, el mismo día: otro curso figuraba con «39 faltantes» estando bajados,
porque 39 archivos habían quedado con nombre genérico (`recurso-NN`) y ningún cruce por
título los encuentra.

**La regla: dos números sirven para SOSPECHAR, nunca para CONCLUIR.** Lo que decide es el
cruce por una clave — un id, un uuid, un hash. **El id es una clave; el título es un
parecido**, y un parecido inventa faltantes en las dos direcciones.

## Y `existsSync(<nombre>)` no es un cruce: es una coincidencia de nombre

Preguntar si existe un archivo llamado como el dato **se lee igual que una validación y no
valida nada**. La portada de cada clase se enganchaba con
`existsSync(public/cono-ugc/${c.codigo}.webp)`; los `.webp` se habían generado con la
numeración del ORIGEN y el curso usa otra, así que el `existsSync` daba **verdadero** para
el archivo equivocado. Resultado: tres clases mostrando la portada de otra —con el título
de la otra escrito DENTRO de la imagen, o sea imposible de leer como un parecido— y cinco
sin portada teniendo la suya al lado bajo el nombre corrido.

Si el nombre de archivo es la única unión entre dos universos, **es una clave y hay que
tratarla como tal**: se normaliza, se cruza en las dos direcciones (qué dato no tiene
archivo Y qué archivo no tiene dato) y se arregla renombrando el archivo, no parcheando el
lookup. Un huérfano de un lado y un faltante del otro casi siempre son la misma cosa
corrida un lugar.

**Y un contador que se llama «eventos de X» se filtra por los TIPOS de X, nunca por «todo
menos Y».** El 24/08/2026 el chequeo de retención acusaba a una landing que no tiene un solo
video, con un ámbar que decía «solo llega el inicio, no el avance». La causa era
`eventos.filter((e) => e.tipo !== 'pageview').length`, llamado `soloVsl`. El nombre decía la
verdad el día que se escribió —entonces lo único que no era `pageview` era un evento del
VSL—, pero después se sumaron los clics, y después «se fue», «volvió» y «cerró»: con eso,
cualquiera que abra la página y haga un clic queda contado como si hubiera reproducido un
video. Medido: 25 eventos contados, **cero de video en toda la historia de ese workspace**.

La definición por descarte **crece sola con cada tipo nuevo, y crece en silencio**: el que
agrega el evento no tiene por qué saber que hay un contador definido al revés a tres archivos
de distancia, y nada falla — solo empieza a contestar otra cosa.

# Un patrón trae CANDIDATOS; quién es quién lo decide una comparación exacta

`ilike` no es «igual sin mayúsculas»: `_` es comodín de un carácter y `%` de cualquier
cosa, y el `_` es de lo más común en un email. `.ilike('email', email)` con el valor crudo
hace que `juan_perez@x.com` matchee `juanXperez@x.com`. Lo mismo `ilike '%últimos 10
dígitos'` sobre un teléfono: un IGSID de Instagram también tiene diez últimos dígitos.

El censo del 17/09/2026 dio seis `.ilike(` en el código, y la diferencia entre el que
estaba roto y el que no la hace la línea de **después**:

- `leadDeAlumno` (`lib/cs-avance.ts`) tomaba el resultado del `ilike` **como la respuesta**
  y le anotaba avance de clases a ese lead. Roto: escribe en la ficha de otro cliente.
- `duplicadosDeLead` (`lib/leads.ts`) hace el mismo `ilike` crudo y después pasa todo por
  `buscarDuplicados`, que compara `emailComparable(l.email) === email`. Sano: el patrón
  solo trae de más, y lo de más se descarta.

**La regla: si el resultado decide identidad —a qué lead se le escribe, qué dos fichas se
funden—, o se escapan `\`, `%` y `_` (molde: `leadDeAlumno`), o el patrón es un prefiltro
y la decisión la toma una igualdad exacta después.** Y si hay más de un candidato, no se
elige el primero: se desempata con un dato (el único `ganado`) o no se elige.

# Si hay que desempatar, todavía estás adivinando

Cuando una extracción necesita **scoring** para elegir entre candidatos —frecuencia,
tamaño, proporción, «el más grande», «el que aparece una sola vez»— eso no es un dato: es
una heurística, y la señal de que la fuente está mal elegida.

El caso, del 24/8/2026. El bajador de portadas raspaba el `<img>` de la tarjeta del
catálogo, con tres capas de desempate encima: frecuencia para no traer el logo del sitio,
proporción para no traer el avatar del autor, área para el resto. **Cada capa se había
agregado arreglando una portada equivocada de verdad**, así que el andamiaje se sentía cada
vez más sólido — mientras se alejaba más del dato. La tapa real vivía en la columna
`cover_image` de la tabla `courses`, poblada en las 130 filas, en storage público: una
request, sin navegador. Lo que se venía publicando era la **miniatura de la grilla, de
456x256**, contra los 1536x1024 que la API entregaba al lado: 13,5 veces menos píxeles, en
18 de 21 cursos.

⚠️ **Y el comentario que defendía el camino equivocado era CORRECTO.** Decía, con razón,
que «la imagen más grande de la landing» sería una heurística que agarra cualquier cosa, y
concluía que el `<img>` de la tarjeta era «un dato». Descartar bien una heurística no
convierte a la que queda en un dato. Un dato es una columna con el valor adentro; si estás
ordenando candidatos, seguís adivinando mejor.

**Antes de escribir el segundo desempate, andá a buscar la tabla.**

## Y detectar la ambigüedad sin actuar es lo mismo que no detectarla

Peor, en realidad: **parece cubierto**. La resolución del id de Drive de cada archivo era
una búsqueda por nombre en TODO el Drive, y el código hacía esto:

```js
if (reales.length === 1) out.set(n, { id: reales[0].id });
else if (reales.length > 1) out.set(n, { ambiguo: reales.length, id: reales[0].id });
```

La segunda rama sabe que hay varios candidatos, se lo anota en un campo que nadie mira, y
**elige el primero igual**. Con nombres genéricos —`recurso-01.pdf` existe cinco veces— eso
publicó, en tres cursos distintos, un recurso que abre el PDF de otro.

Y no hay síntoma: el recurso tiene su título correcto, su tamaño plausible y abre un PDF de
verdad. No hay 404, ni imagen rota, ni error. La única pregunta que lo encuentra —«¿de qué
carpeta cuelga este id?»— no se le ocurre a nadie.

**La regla: si una rama de tu código puede escribir «esto es ambiguo», esa rama no puede
terminar en `[0]`.** O desambigua con un dato más (acá: el subárbol de la carpeta del
curso), o se abstiene y lo dice donde alguien lo lea. Un `ambiguo: n` guardado al lado del
valor elegido es documentación de un bug, no una salvaguarda.

# Lo que un material dice DE SÍ MISMO le gana a la etiqueta que le puso el sistema

Un curso venía titulado «Agency Navigator» en la plataforma, con ese slug, y bajo ese
nombre se bajó y se planificó. En los videos, el autor dice **«Agency Incubator»** 34 veces
en 22 de las 26 clases; «Agency Navigator» no aparece ni una. Son dos productos distintos.

Lo caro no fue el nombre: fue que había un diagnóstico ya cerrado colgando de él. La
numeración del autor llegaba a ~40 con 26 lecciones presentes, y la tabla `lessons`
confirmaba 26 filas sin borrar — o sea «la plataforma tiene el curso incompleto». La
medición era correcta, la conclusión no. **No era un curso mutilado: era otro curso.**

**La regla: cuando el contenido es texto —transcripciones, documentos, copy—, preguntale al
contenido qué es antes de razonar sobre su metadata.** Un `grep` lo contesta en un segundo y
ninguna consulta a la base lo iba a contestar nunca: la base repite la etiqueta, no el
material. Vale para cualquier ingesta de algo que otro sistema nombró.

# «No pasó nada» y «pasó y se murió» se ven iguales si mirás el resultado

Cuando una acción no deja el efecto esperado, mirar solo el efecto no distingue entre *no
arrancó*, *arrancó y falló* y *arrancó y lo cancelaron*. Son tres causas con tres arreglos
distintos, y el resultado es idéntico.

El caso: un botón de descarga que no dejaba archivo. Mirar la carpeta decía «no bajó» y
mandó a buscar permisos que no faltaban. Escuchando los eventos del navegador
(`Browser.downloadWillBegin` / `downloadProgress`) apareció la verdad: **arrancaba** —con
nombre y bytes— y terminaba en `canceled`, porque era un *blob* y la automatización los
cancela. La causa no tenía nada que ver con permisos.

**La regla: instrumentá el PROCESO, no solo su resultado.** Si una operación puede fallar
de varias maneras, el diagnóstico necesita ver los estados intermedios; si solo mirás el
final, vas a arreglar la causa equivocada con seguridad y a veces vas a tener suerte.

**Y un corolario para las APIs:** `permission denied for table X` y `column X does not
exist` son respuestas DISTINTAS y la diferencia es información. La primera dice que la
columna existe y no te la dan — o sea que el dato está y hay que buscar otra puerta.

# Sacar algo de un catálogo no es borrarlo: hay gente APUNTÁNDOLE

Un `Set` de exclusiones contesta «este id ya no va» y con eso alcanza para que no se
dibuje. Lo que **no** contesta es la pregunta que rompe: *¿y el que YA está apuntando
ahí?* Un recurso no vive solo en la grilla donde se lo elige — vive en cada **link
compartido**, cada favorito, cada `?id=` que alguien mandó por WhatsApp y cada webhook
configurado.

El caso, del 22/8/2026. Se sacó un curso del catálogo por una razón correcta (se había
rehecho, y dejar los dos cortes hace que alguien abra el viejo creyendo que es el bueno).
La exclusión era un `Set` y `buscarCurso` dejó de resolver ese slug. Medido contra
producción: un **share sin revocar, en modo invitados, con 13 visitas**, dando 404 desde
hacía **cinco días**.

**La regla: reemplazar es REDIRIGIR.** La exclusión va como `Map<viejo, nuevo>` y el salto
se resuelve en el ÚNICO punto por el que pasan todos los caminos —el `buscarX` del
catálogo—, nunca en cada pantalla: puesto en el llamador, la próxima pantalla que resuelva
ese recurso nace sin él. Y antes de sacar cualquier cosa compartible, **preguntá si hay un
share apuntándole**; es una query, no una intuición.

## ⚠️ Y el corolario que más cuesta ver: la métrica puesta después del early-return no mide el fallo

`registrarVisita()` corría **después** del `notFound()`, así que **un golpe al 404 no suma
al contador**. Las 13 visitas eran todas anteriores al quiebre. **Un link roto y un link
que nadie abrió se ven exactamente igual desde la métrica** — y el roto se ve *mejor*,
porque su contador se congela en un número que parece sano.

Es «un `console.warn` no es un control» aplicada a la observabilidad: si el registro vive
en el camino feliz, mide **cuántas veces funcionó**, nunca cuántas falló. Cuando
instrumentes un acceso, el contador va **antes** de las salidas tempranas, o hay dos
contadores. Vale igual para un rate limit, un log de auditoría y cualquier «última vez
usado».

# Un chequeo enumera ENTIDADES, no archivos — y si no encuentra, lo dice

Dos mitades del mismo bug, medidas el 22/8/2026 sobre el verificador de módulos faltantes
del portal de cursos.

**La unidad era el archivo, y un archivo tenía cinco cursos adentro.** El script hacía
`archivos.unshift('curso.ts')` y bautizaba a los cinco con el nombre del primero. Con eso,
pedir cualquiera de los otros cuatro contestaba **«Los 0 cursos revisados están
completos»**. Cero revisados, y el texto decía completos.

**Y la fusión no solo no revisaba: BORRABA evidencia.** Concatenados, los módulos de un
curso rellenan los huecos del otro — uno acusaba que le faltaban los módulos 4 y 7, y
fusionado acusaba solo el 7, porque el módulo 4 del vecino tapaba el agujero. Un chequeo
que junta dos universos no da un resultado más pobre: da uno **más limpio de lo que la
realidad justifica**, que es lo contrario de lo que un verificador tiene que hacer.

Tres reglas:

1. **La unidad de un chequeo es la ENTIDAD que le importa al usuario**, no el archivo, la
   tabla o la request que la transporta. Si un contenedor trae N entidades, se abre.
2. **La identidad sale del CONTENIDO, no del nombre.** El slug derivado del nombre de
   archivo no encontraba 7 de 29 cursos, porque `curso-producto-app.ts` es
   `construir-app`. Un nombre de archivo es una convención; el id es un dato.
3. **«No encontré nada que revisar» y «revisé y está todo bien» son respuestas
   DISTINTAS,** y el código tiene que poder decir la primera. Pedir algo inexistente ahora
   sale con código distinto de 0 y lista lo que sí hay. Un verificador que contesta
   «completo» sobre un universo vacío **apaga la búsqueda**, que es el daño más caro que
   puede hacer.

# Un umbral protege del modo de falla contra el que se escribió, y de ninguno más

La guarda de transcripciones truncadas mira **palabras por minuto por debajo de** un piso.
Correcta, y midió 0 truncadas sobre 1933 clases. Lo que no ve es la falla espejo: una clase
con **348 wpm** sobre 43 segundos de audio — el modelo no fabricó desde el silencio,
**infló audio real**. La otra guarda existente (bitrate mínimo, contra el audio mudo)
tampoco la ve, porque ese audio tiene bitrate normal.

**La regla: cuando escribas un umbral, preguntá cuál es la MISMA falla en la otra
dirección.** Truncado e invención son la misma métrica con el signo cambiado, y el chequeo
nació mirando una sola punta. Lo mismo vale para «demasiado lento / demasiado rápido»,
«muy chico / muy grande», «cero resultados / demasiados resultados»: una distribución tiene
dos colas, y la que no se mira es por donde entra.

# Dos números que se comparan salen de UN juicio — no de una fórmula sobre el otro

Si en la misma pantalla un número se lee CONTRA otro —el score de un proyecto y el de sus
tareas, el presupuesto de una campaña y el de sus anuncios—, la incoherencia entre los dos
es real y hay que arreglarla. **Lo que NO se puede hacer es derivar uno del otro con una
cuenta.** Esa salida parece la barata y es la que tira la parte cara del sistema.

Se cometieron los dos errores seguidos, con un día de diferencia, y conviene leer los dos.

**El síntoma (21/8/2026).** `describirProyectosNuevos` puntuaba proyectos y `puntuarNuevas`
puntuaba tareas, en llamadas distintas y con prompts distintos. Medido: **154 de 550 tareas
puntuaban por encima de su propio proyecto** y 8 proyectos sin una sola tarea abierta
ocupaban de 50 a 80. El dueño lo reportó como *«en Prioridades me sale que el proyecto más
importante es de ciberseguridad, pero en el kanban hay muchas tareas más importantes»*.

**El arreglo equivocado, el mismo día.** Se hizo `score(proyecto) = max(sus tareas) +
densidad`. La invariante quedó garantizada por construcción, los tests pasaron, y el
tablero quedó peor. El dueño lo rechazó al verlo:

> *«¿Cómo que "vale lo mismo que su tarea más alta"? Si quisiera hacer eso, ¿para qué me
> tomé el trabajo de meter IA? Para eso simplemente lo pongo con código. Pero justamente
> está el perro guardián, para asignar prioridades según lo que MUEVE LA AGUJA. Y hay una
> metodología para eso.»*

Y no era una cuestión de gusto: la metodología del propio Perro **ya prohibía por escrito**
las tres cosas que esa fórmula hacía — premiaba el TAMAÑO («uno con 30 tarjetas no es más
norte que uno con 2»), amontonaba doce proyectos entre 95 y 98 con empates («EN TODA LA
ESCALA, PROHIBIDO empatar»), y escribía una razón que describía el mecanismo («PROHIBIDO
que la razón sea una paráfrasis»). Ninguna línea de código miraba nada de eso.

**Las tres reglas que quedan:**

1. **La cura de dos números incoherentes es que los produzca UN juicio, no que uno se
   calcule del otro.** Si dos cosas se comparan en pantalla, se juzgan en la misma pasada,
   con el mismo criterio y viéndose entre sí. Derivar es correcto solo cuando el segundo
   número **no es un juicio** (un total, un porcentaje, un promedio de avance). En el
   momento en que el número expresa una PRIORIDAD, una VALORACIÓN o un RIESGO, derivarlo es
   apagar el sistema que lo produce.
2. **Una invariante conseguida por construcción puede estar tapando el problema en vez de
   resolverlo.** «Ninguna tarea puede quedar por encima de su proyecto» sonaba a invariante
   y era un SÍNTOMA. La prueba de que estaba mal como invariante es un contraejemplo obvio:
   un proyecto secundario con un bug en llamas adentro — la tarea DEBE estar arriba, y el
   proyecto no. Antes de blindar una invariante, buscá el caso en que violarla es lo
   correcto; si existe, lo que tenías era un indicador, no una ley.
3. **Un test verde sobre la propiedad equivocada es la forma más cara de estar seguro.** Los
   tests de esa fórmula pasaban y fijaban bien lo que fijaban. Lo que hay que testear de la
   salida de un modelo no es la fórmula (no hay fórmula): es que **cumpla las reglas de su
   propia metodología** — que no empate, que use todo el rango, que no infle, y que cada
   razón compare contra algo que EXISTE. Eso vive en `app/plan/board/metodologia.ts`, sin
   `server-only`, y es la segunda capa que «una regla en un prompt no es una regla» exige.

**Y el olfato, para reconocerlo rápido:** si la razón que se muestra explica el MECANISMO
(«vale lo que su mejor tarea», «es el promedio de sus hijos») en vez de comparar contra otra
cosa del negocio, ya no hay juicio adentro — hay una cuenta con voz de juicio, que es peor
que no tener nada porque se lee igual de convincente.

# Un guard que impide MOVER un valor no impide ESCRIBIRLO

Cuando un control decide que NO, lo que hay que contar es **cuántas escrituras cuelgan de esa
rama**, no cuántas variables. Es distinto de «el fallback es más débil que el camino feliz»:
acá el control funciona, el valor es el correcto, y la escritura pasa igual con las columnas
de al lado puestas.

El caso, del 21-22/8/2026, y se cometió en dos días seguidos. Se arregló que un
`veredicto: 'rechaza'` del Perro no moviera el score (`score: veredicto === 'rechaza' ?
scoreActual : propuesto`). El arreglo era correcto **y no alcanzaba**, porque el que escribía
era el navegador y no miraba el veredicto: `onApply(ver.score, ver.razon)` terminaba en
`patchLabelLog(id, { score, scoreManual: true, … }, 'Fijaste la prioridad en N debatiéndola',
'user')`. O sea **perder un debate le clavaba el candado de la mig 0143 al número que el
propio Perro acababa de defender**: la corrida automática ya no lo podía mover nunca más, y
la razón que el dueño leía decía «Lo fijaste vos en 32» cuando él había perdido. El número
era el correcto, así que ninguna pantalla lo delataba.

Tres reglas que salen de ahí, y las tres valen para cualquier decisión que tome un control:

1. **Si la decisión la toma el server, el server escribe.** No «el server decide y el cliente
   aplica»: eso son dos lugares donde la misma regla puede estar, y el segundo se queda viejo.
   `lib/plan-reprio.ts` no le deja al navegador **ningún** camino a la columna `score` — un
   camino que no existe no se puede olvidar de cerrar.
2. **Un `upsert` de fila entera armada en el cliente escribe TODAS las columnas**, incluidas
   las que ese formulario no muestra. `guardarPlanProyecto` hacía `upsert(labelToRow(l))`, así
   que una pestaña vieja que cambiaba el emoji pisaba el score con lo que tenía en memoria. Si
   una columna la decide el server, **no puede viajar en el payload del navegador**; no alcanza
   con que la UI no la edite.
3. **La etiqueta de una decisión se DERIVA de lo que se hizo, no se lee de lo que el modelo
   dijo.** `coerceVeredicto` hacía `subio ? 'acepta' : 'rechaza'` sin saber qué se había
   PEDIDO: una bajada que el dueño pidió y el Perro concedió salía etiquetada «rechaza», y el
   guard le descartaba la concesión. Peor: cualquier string fuera del enum colapsaba a uno de
   los dos, así que un `veredicto: "pregunta"` con el número subido se leía como ACEPTACIÓN.
   Lo reemplaza `veredictoDe(pedido, actual, final)` (`app/plan/board/metodologia.ts`).

**Y el corolario del enum, que es el que más cuesta ver:** por eso las preguntas del Perro
**no son un cuarto veredicto**. Cualquier valor nuevo que un modelo pueda escribir en un campo
que el código colapsa con un default es una decisión tomada por el default. Si hace falta un
estado nuevo, lo pone el CÓDIGO —o va en otro campo—, nunca el modelo.

# Un total solo se puede sumar si el recurso se puede MOVER DE LUGAR

Una clienta con tres cuentas de Gemini vio «240,6k / 750,0k» —le sobra el 68% del día— al
lado de un error que decía que no tenía IA. Las dos cifras eran ciertas. Medido:

    cuenta 1: 241k tok → 96%  ⛔ sin cuota      cuenta 2: 0%      cuenta 3: 0%

El free tier se agota **por cuenta**: no era un tanque de 750k, eran tres tanques de 250k
que no se trasvasan. Y como la cascada arranca siempre por la primera y solo salta cuando
la anterior FALLA, todo el uso se apila en una sola.

**La regla: antes de sumar N cosas en un indicador, preguntá si lo de una le sirve a la
otra.** Plata en dos cuentas del mismo dueño, sí. Cuota diaria de dos API keys, horas de
dos personas distintas, espacio en dos discos que no están en RAID: **no**. Cuando no se
puede mover, el total sirve para «cuánto consumí» y **nunca** para «cuánto me queda»; el
estado (`agotado`, el semáforo, lo que gobierna una decisión) sale del PEOR de los
componentes, y el reparto se muestra.

Y el corolario que se paga aparte: **rotar solo por error es pagar un peaje por llamada.**
Si hay tres cuentas y la primera está muerta, cada llamada gasta un 429 antes de llegar a
la que tiene nafta. Si el sistema puede saber cuál está gastada, empezá por la que no.

## Y al DES-sumar, cada parte necesita su propio casillero

El arreglo de arriba se hizo y el bug volvió trece meses después con el signo cambiado, en
la misma pantalla. `claveCuenta(provider, 1)` devolvía el nombre pelado del proveedor —la
misma clave donde se acumula el TOTAL—, así que la fila «cuenta 1» del reparto mostraba la
suma de las tres keys contra el tope de una. **Conectar una key más empeoraba el mensaje.**

Y se sostenía solo: el orden de rotación va por % consumido, la cuenta 1 salía siempre la
más gastada, se probaba última y no la usaba nadie. Medido: cero llamadas en la cuenta 1 en
treinta días. El mecanismo que escondía el problema era el problema.

**Si `clave(parte_1) === clave(total)`, no des-sumaste nada.** Es la primera línea a mirar
cuando un indicador por ítem se contradice con su propio total — y la señal en pantalla es
un numerador por encima del denominador («841,5k / 750,0k»), que se lee como un dato raro
y es la aritmética delatándose.

## Y un tope de un tercero lleva su UNIDAD verificada contra el uso real

`tokensDia: 250_000` para Gemini es el tope por **minuto** (TPM) cargado como tope del
**día**: 1440 veces más chico. Nadie lo notó porque el otro eje del mismo cálculo —los 250
pedidos/día, que sí existen— nunca se acercaba, y el `Math.max` de los dos dejaba mandar
siempre al inventado.

Lo delata medir contra lo que ya está en la base: **veinte días-workspace pasaron ese
«tope», del 139% al 469%, y el proveedor contestó todas las llamadas.** Un límite que se
revienta a diario sin una sola queja del que lo impone no es un límite.

**Antes de escribir un tope ajeno, corrélo contra el uso histórico y contá cuántas veces se
pasó.** Si se pasa seguido y no hay error del proveedor, el que está mal es el tope — y
mientras tanto está apagando la rotación y diciéndole al cliente que se quedó sin nada.

## Y el corolario del tamaño: un tope elegido contra UN proveedor apaga a los demás

La misma trampa, un escalón más abajo. Tres proveedores configurados no son tres
proveedores **disponibles** si lo que se les manda solo le entra a uno.

El caso, del 22/8/2026. La cascada de transcripción tiene tres escalones — Groq (25 MB),
OpenAI (25 MB) y Gemini, que manda el audio INLINE dentro del request y topea en **14**.
El script que parte el audio lo hacía en piezas de **20 MB**, un número elegido contra el
tope de los dos primeros. Resultado: toda clase larga nacía **sin fallback**, y las largas
son justo las que más chance tienen de encontrar a Groq en su cuota horaria. Medido: 32
clases con «ningún proveedor pudo transcribir», **las 32** con una pieza por encima de 14
MB, ninguna por otra causa. El arreglo fue una cifra —20 → 13— y ninguna línea de lógica.

**La regla: un límite de formato (tamaño, duración, tokens, tipo de archivo) se elige
contra el proveedor MÁS RESTRICTIVO de los que se piensa usar, no contra el primero de la
lista.** Si no se puede, el escalón que no lo acepta **no está en la cascada** y hay que
decirlo donde se lea, porque desde afuera la lista de fallbacks se ve completa.

**Y cómo se detecta, que es lo que más ahorra:** el error decía los tres motivos, con el
tamaño y el tope al lado, desde el primer día. Lo que faltaba era **contar**. 32 de 32 con
la misma marca no es mala suerte con una cuota: es una condición. Cuando un fallo se
repite, la pregunta no es «¿por qué falló éste?» sino **«¿qué comparten TODOS los que
fallaron?»**.

# Claude está VETADO salvo excepción escrita, y el veto vive en el `fetch`

`lib/veto-claude.ts` es la única puerta a `api.anthropic.com/v1/messages`. Una feature
nueva **ya está vetada el día que se escribe**: si querés que pague, va una fila en
`CLAUDE_PERMITIDO` con modelo, fecha de vencimiento y quién lo pidió.

**Por qué en el `fetch` y no en el registro de modelos:** había CINCO caminos a Anthropic
—el `def` del catálogo, el fallback pago de `chatClaude`, el de `chatClaudeTools` (que ni
consultaba la lista), un `opts.model` explícito, y el `MODEL` del módulo cuando la feature
no estaba registrada— y **cerrar cuatro deja la quinta**. Pasó: `fallback: []` tapó dos y
las otras tres siguieron cobrando US$12,79. Los cinco terminan en el mismo `fetch`; ahí va
el control y en ningún otro lado.

`lib/anthropic.ts` ya no tiene `MODEL` ni `ENDPOINT`. La URL sale de `permiso.endpoint`,
así que **un `fetch` a Claude escrito por fuera del veto no tipa**. Y no hay modelo por
default: mientras `MODEL` fue `claude-opus-4-8`, olvidarse de registrar una feature costaba
el modelo más caro que existe — el camino de MENOS esfuerzo era el MÁS caro.

**Tres cosas que hacen que el veto no se apague solo:**

1. **La lista blanca vive en CÓDIGO, no en `app_settings`.** La asimetría es el diseño:
   bloquear es instantáneo, desbloquear necesita commit, pre-push y deploy. Un veto que se
   apaga con la misma palanca que gobierna se apaga solo.
2. **Los permisos VENCEN.** Sin fecha, una excepción de hoy es una excepción para siempre y
   nadie la vuelve a mirar — la misma forma del cobro silencioso.
3. **El bloqueo se REGISTRA, no se loguea.** Una fila de US$0 y 0 tokens en el mismo
   gráfico que el dueño mira, con el motivo escrito. Sin eso, un veto que funciona y un
   veto que nadie disparó se ven iguales.

**Y el interruptor de pánico (`mako.claude.pausa`) va en UNA sola dirección:** puede
apagar, nunca encender. Si la base se cae, el resultado es «no pausado» — y eso no abre
nada, porque lo que autoriza es la lista de código. Un store que puede fallar solo tiene
permitido hacer las cosas MÁS restrictivas.

# Un default que cobra es un cobro silencioso

El `def` de una feature en `lib/model-catalogo.ts` no es «lo que usa hoy el código»: es
**lo que va a pagar cualquier feature que nadie se acordó de configurar**. `/modelos-ia`
escribe un override **solo cuando alguien toca el botón**, así que una feature nueva con
`def: SONNET` cobra desde el día uno y no lo dice en ningún lado.

El caso: el dueño reclamó dos veces el mismo día «el Perro sigue usando Claude para tareas
simples». La segunda vez el Perro no tenía nada que ver — hacía horas que corría en
Mistral a US$0. Lo que cobraba era **`plan-fathom`**, que corre sola en cada reunión nueva
y parte el transcript en cuatro pedazos de ~40k: **US$37 en 30 días**, contra US$0,81 del
Perro. Nunca tuvo override porque nadie se lo tocó. Y **trece features más tenían
`def: SONNET` mientras un override las corría en Gemini**: el catálogo decía una cosa y la
realidad otra.

La regla, con las dos capas de siempre:

1. **El `def` de una feature es un proveedor GRATIS.** No la deja sin red: si el proveedor
   falla se recorre la cascada gratis entera antes de pagar (ver la sección siguiente).
2. **Si cobra, `pagoPorque` dice en una frase qué se compra**, y
   `tests/model-registry.test.ts` **falla si falta**. Hoy son tres, a propósito: `closing`,
   `lead_insights` y `experimentos` — análisis pesado sobre datos reales, que es lo que el
   cliente paga a sabiendas.

Por eso el catálogo vive en `lib/model-catalogo.ts` **sin `server-only`**, separado del
`model-registry.ts` que lee la base: un módulo con `server-only` no lo puede importar
ningún test, y la guarda del gasto quedaba sin red. Es el mismo criterio que
`exigirClienteDePrueba`.

Y para saber qué modelo corre **de verdad** una feature, el catálogo solo no alcanza:
es `override del ws1 ?? def del catálogo`. Los overrides están en `app_settings` con
`key='mako.modelos'`, siempre del workspace 1.

# Y un fallback que NO cobra es una degradación silenciosa

El espejo de la regla de arriba, y peor: **el cobro al menos deja rastro en la factura;
esto no deja nada.**

Medido el 12/8/2026. La MISMA llamada de Fathom, leída por dos workspaces con 65 segundos
de diferencia: uno corrió sus 7 partes en `gemini-flash` y el otro las suyas en
`mistral-small`, porque el 429 de la cuota compartida lo mandó cascada abajo. Mismo
prompt, mismo transcript, misma versión del código. Resultado: **74% de precisión contra
46%, y 2 tareas inventadas contra 12.** La tab decía «Gemini» y decía la verdad sobre la
configuración — lo que corrió fue otra cosa, y no había forma de enterarse.

La cascada barata está bien y hay que dejarla. Lo que faltaba es **decir dónde NO se puede
degradar**, y el criterio no es «esta feature es importante»: es **qué forma tiene su
error**.

- Si un modelo peor **rompe** —JSON inválido, una tool que no se llama—, degradar es
  gratis: se ve al toque y se reintenta.
- Si un modelo peor **contesta mal** —un juicio, una clasificación, una extracción—, la
  respuesta floja se ve exactamente igual que la buena. Nadie la revisa, no hay pantalla
  que lo diga, y el daño aparece semanas después como «esto funciona mal y no sé por qué».

Para las segundas va `fallback: []` en `lib/model-catalogo.ts`: antes que degradar el
modelo, se paga Claude con la nota `⚠ fallback pago` visible. Es más caro y es honesto.

**Y el corolario operativo, que es la causa real:** N llamadas grandes en paralelo contra
UNA sola key son un 429 garantizado, y un 429 en la cascada no se reintenta — se degrada
de proveedor. Si troceás un input y mandás las partes con `Promise.all`, estás eligiendo
el modelo peor sin saberlo. Limitá la concurrencia; en un cron el tiempo no lo paga nadie.

# El precio de un proveedor no es un dato hasta que lo verificás vos

Antes de meter un modelo o un proveedor nuevo en `lib/model-catalogo.ts`, tres chequeos.
Ninguno es opcional y los tres ya fallaron una vez:

1. **Recalculá el precio contra la página del FABRICANTE, ese día.** La columna «precio
   oficial» que publica un revendedor es propaganda: la de APImart es, en las ~200 filas
   revisadas, exactamente su propio precio × 1,25. Y un número sacado de un curso, un blog
   o un benchmark tampoco es un precio — el curso de la casa enseña a comprar Sora a
   US$0,15 por 15s y hoy eso está roto por un factor de **8**.
2. **Leé sus términos de reventa.** Es la otra mitad del dato y es lo único que nadie
   publica de frente. APImart **prohíbe** por escrito facturar encima sin autorización;
   Kie.ai **no dice nada**, que no es lo mismo que permitir; fal.ai y Replicate lo
   contemplan explícitamente. Un SaaS que cobra no se para sobre un vacío contractual.
3. **Desconfiá del descuento redondo.** Un −72% uniforme sobre toda una familia de modelos
   no sale de un acuerdo de reventa: sale de un intermediario que puede desaparecer de un
   día para el otro. 20-40% variando por modelo es creíble; 75-86% parejo, no.

El detalle, con las citas textuales de cada contrato y la tabla de qué modelo barato va en
cada tarea, en [docs/hallazgos-ia.md](docs/hallazgos-ia.md) → «Comprar modelos».

# Claude es el ÚLTIMO recurso, no el segundo

Cuando una feature está ruteada a IA barata en `/modelos-ia` y el proveedor falla, se
recorre **toda la cascada gratis** antes de pagar (`chatCheapCascade` en `lib/anthropic.ts`).
Nunca un solo intento y a Claude.

El caso que lo probó: el Perro Guardián está en Gemini desde hace meses, Gemini devolvió
**HTTP 429** —la cuota del minuto, el error más transitorio y más previsible cuando el
Perro corre en tandas— y el código caía derecho a Sonnet. Dos corridas de priorización
costaron US$0,25 con otros cuatro proveedores gratis configurados y sin usar. Un fallback
que cobra tiene que ser la excepción rara y ruidosa, no la reacción al primer 429.

⚠️ **Y `CASCADA_GRATIS` NO TIENE GEMINI.** Medido el 06/10/2026: tres clientes (ws13, ws15,
ws17) tienen cargada SÓLO la key de Gemini, así que todo lo que corra por esa lista no tiene a
quién preguntarle — y `errorDeCascada`, que mide con `CASCADA_DOCS`, les contesta «tu IA está
conectada pero no pudo». **Lo que tiene que andar con la key gratis del CLIENTE va por
`CASCADA_DOCS`**, que es la misma lista con la que se juzga el error. El detalle, en
`docs/hallazgos-ia.md`.

⚠️ **Y TODO CAMINO DE IA QUE USE UN CLIENTE NECESITA SU RED DE PLATAFORMA.** Un cliente con
una sola key no tiene cascada: cada bache de ese proveedor es MaKo muda para él. El chat del
doer tenía la red desde el 25/8 y el AUDIO no: el 07/10/2026 Google saturó
`gemini-flash-latest` («HTTP 503: high demand») y a Código Inmobiliario se le perdió una nota de
voz con un mensaje que le pedía cargar otra key. Dos reglas al escribir un camino nuevo:

- **Un «saturado» (503 / high demand / overloaded) se cubre con OTRO MODELO del mismo proveedor,
  no con otra key.** La segunda key de Gemini le pega al mismo Google; otro modelo tiene su
  propia capacidad. Medido esa noche: `gemini-flash-latest` 503 y `gemini-flash-lite-latest` 200
  en 560 ms. Y el mensaje al cliente no le pide una key que no lo arregla (`esSaturacion`,
  `lib/fallo-ia-texto.ts`).
- **La red de plataforma va DESPUÉS de las keys del cliente, gratis, empezando por OTRO proveedor
  que el que falló, y con el motivo «⚠ red de plataforma»** (`provsGratisDePlataforma`; el molde
  es `transcribirAudio` en `lib/ai-cheap.ts`). Y los errores de la red viajan SEPARADOS de los
  del cliente: con ellos se fabricaría el texto que lee él.
- **Un 429 del MINUTO también se cubre con otro modelo, y repetir un PEDIDO no repite
  herramientas.** El 07/10/2026 a Brigitte (una sola key) una pregunta de 6-8 pedidos de ~15k
  tokens llenó el cupo del minuto, y el 429 tiraba el turno con seis pasos hechos por una regla
  que decía «nunca reintentar después de una tool». Esa regla es para RE-ARRANCAR el turno (otro
  proveedor desde el mensaje original, que vuelve a correr las tools); el pedido que falló no
  ejecutó nada. Todo loop de herramientas decide en `crearRotacion` (`lib/ia-rotacion-modelo.ts`):
  otro modelo, y si no queda, la espera que dice el PROVEEDOR, nunca una inventada. Y la red de
  la agencia para el doer es sólo Gemini: los cuatro modelos gratis de Groq topean en 8.000
  tokens por minuto y un pedido del doer pesa 13-16 mil (413 medido en los cuatro).

⚠️ **Y UN 200 DE UN STT NO ES UNA TRANSCRIPCIÓN HASTA QUE PASA `salidaDegenerada`**
(`lib/stt-degenerado.ts`). Medido el 08/10/2026: Gemini devolvió un minuto de habla y después
«1 2 3 … 699» con `finishReason: STOP`, y la cascada lo tomó como el texto del audio — siete minutos
perdidos sin un error. Un bucle es un FALLO de esa cuenta: se anota con su motivo y se prueba la
siguiente; nunca un texto a recortar. Todo camino que transcriba llama al detector (`lib/transcribe.ts`,
el de los cursos, todavía no). El detalle, en `docs/hallazgos-ia.md`.

# Un contrato de datos no es un layout

`exige` en `lib/mako-gramatica.ts` dice qué tiene que **tener** un estado de MaKo para no
ser un consejo genérico. No dice qué tiene que **mostrar de entrada**. Confundir las dos
cosas costó tres rediseños seguidos de la misma pantalla: el dueño la rechazó tres veces
por «cargada», y las tres rondas de arreglos movieron cómo se veían los campos sin
preguntar nunca por qué estaban todos a la vista.

Lo que queda:

- **Lo que se ve sin abrir se elige a mano, nunca por el índice de un array.** La versión
  vieja mostraba `datos[0]` y escondía el resto; en la aprobación eso dejaba «A quiénes»
  arriba y «Qué reciben» detrás de un click, con el botón que manda 340 mensajes
  irreversibles siempre visible. Se podía aprobar un envío sin haber visto qué se enviaba.
  Por eso `consecuencia` es un prop propio de `<Mako>` y **no se deriva de `datos`**.
- **Nada de kicker.** El rótulo del estado no va en monospace arriba del título. Sigue en
  `GRAMATICA` —el contrato de que se llame igual en las cuatro tabs no se toca— y se pinta
  en el chip, en una columna de tabla y adentro del panel abierto. Vale para cualquier
  pieza nueva, no solo para `<Mako>`.
- **Un grupo de cosas del mismo tipo es una lista con filete, no una pila de cajas.** Tres
  tarjetas del mismo tamaño apiladas son el contenedor perezoso; la caja se gana.
- **Ningún botón puede ser «Sí», «No», «Aceptar», «Cancelar» ni «Descartar» a secas.** Cada
  uno nombra su acción y su objeto, y el par de salidas resume qué pasa con cada una:
  «Enviar 340 mensajes» / «No enviar», no «Enviar» / «Cancelar».
- **La consecuencia de lo irreversible va pegada al botón**, en tinta normal y no en gris,
  y **antes** del click. Arriba de todo y en gris no la lee nadie.
- **El único `max-width` del diseño vive en el CONTENEDOR.** Nada adentro lleva ancho
  propio: todo va al 100%. Un `max-width` puesto al texto dentro de una caja más ancha no
  acota nada — deja la mitad de la caja vacía a la derecha y el contenido aplastado a la
  izquierda. Si hay que cuidar la medida de lectura, se acota el contenedor (para eso está
  `Modal`, 600 px) o se centra con `margin-inline: auto`. Medido acá: 603 px de contenido en
  una caja de 1134.
- **`Confirm` pregunta · `Modal` muestra el detalle · `WizardShell` conduce un flujo.** Son
  tres cosas distintas, no tres tamaños de lo mismo. Para el detalle de algo, `Modal`.
- **Todo lo que MaKo pone en una lista es `.mk-fila`, y su nombre de estado es `.mk-pill`.**
  Eran cinco tratamientos —fila, línea con barra, tarjeta, caja crema, pastilla— que
  compartían la misma anatomía y diferían en tres números. Antes de estilar una pieza
  «parecida» a otra, poné las dos anatomías al lado: si comparten esqueleto, es una pieza con
  dos configuraciones, y mantenerlas separadas garantiza que diverjan.
- **Adentro de una lista, una barra de progreso es el BORDE de la fila (2 px, ancho completo)
  o no existe.** Una barra con ancho propio deja el mismo hueco muerto que un `max-width`.
- **Si el contenido se EDITA en otra pantalla, el modal NO lo dibuja: lo nombra y linkea**
  (prop `ver`, que sale de `lib/mako-capacidades.ts`, nunca un href a mano). La excepción es
  el estado que BLOQUEA: una aprobación que linkea es una aprobación que se da sin leer, así
  que ahí el modal muestra el texto entero. Cuando linkea, la evidencia es **una muestra y el
  conteo**, nunca la lista. El mapa completo de escenarios, en
  [docs/hallazgos-ia.md](docs/hallazgos-ia.md) → «Dónde vive cada estado de MaKo».

El detalle de cada uno, con las citas de las guías, en
[docs/hallazgos-ui.md](docs/hallazgos-ui.md).

# Restaurar un diseño no es restaurar el código, y un veto sin su contexto se aplica de más

Dos errores de la misma familia, los dos pagados sobre `/general` entre el 6 y el 8/09/2026,
y los dos con el mismo aire de estar haciendo lo correcto.

**1. La forma se restaura mirando la captura; el código se escribe de nuevo.** Cuando el
dueño pide volver a un diseño anterior, `git show <sha>:<archivo>` devuelve la forma **y
todo lo que se arregló desde entonces**. Acá el archivo viejo traía, entre otras: el
veredicto que afirma «el negocio está sano» sobre un workspace sin un solo dato (la tarea
#165, que el rediseño había venido a arreglar), un editor que escribe settings que la
migración ya no lee —o sea un guardado que no hace nada y no da error—, una server action
sin guard de rol, y el «hoy» clavado a la zona de Tijuana para todo inquilino.

Antes de restaurar un archivo: `git log` de los commits que lo reemplazaron, y la lista de
las **guardas** que agregaron. Lo que se restaura es el layout, los tamaños y los bloques;
las condiciones son las de hoy.

**2. Un veto de diseño citado sin su contexto prohíbe de más.** *«Cards are the lazy
container»* habla de **una pila de tarjetas iguales de ícono + título + texto como
estructura de página**. Leído como «ninguna caja nunca» dejó a `/general` como la única
pantalla del producto sin una sola superficie: `/comercial` arma 8 bloques con
`background: var(--surface)` + borde + radio 18, `/marketing` 1, `/general` cero. El dueño
lo reportó como «se ve mucho peor, no se ve nada». La caja de afuera es lo que hace que una
pantalla se lea como hermana de la de al lado; lo prohibido es la pila de sub-tarjetas
iguales **adentro**.

⚠️ Y el corolario que vale para cualquier rediseño: **agrandar un bloque le sube el precio a
todo lo que ese bloque pueda mentir.** La guarda de la #165 vivía sólo adentro del semáforo,
así que el «vas al día con todo lo que te comprometiste» sobre un workspace sin datos era un
renglón perdido — hasta que la cabecera nueva lo convirtió en el segundo texto más grande de
la pantalla. Cuando algo pasa a ser lo primero que se lee, se audita lo que ese algo afirma
en cada estado, incluidos los vacíos.

⚠️ Y cuando dos bloques que antes vivían separados quedan en la misma pantalla, **hay que
mirar si pueden contradecirse**: la cabecera decía «vas US$15.217 abajo de lo esperado» y dos
bloques más abajo la lámpara verde del semáforo certificaba que estaba todo bien, porque sus
seis reglas miran señales operativas y ninguna mira el compromiso del trimestre. Juntarlos no
es sólo acomodarlos.

El detalle, con la tabla de las siete cosas que no volvieron y por qué, en
[docs/hallazgos-objectives.md](docs/hallazgos-objectives.md).

# Dos reglas de layout que se rompen solas

**1. El `<main>` de una pantalla es `Pagina`.** Una pantalla no elige su propio ancho.
Síntoma repetido: se agrega una vista y no llega al borde, queda una franja vacía a la
derecha que nadie puso a propósito.

No había ninguna regla escondida, y ese era el problema: cada pantalla escribía su
propio `<main>`, así que cada una elegía su `maxWidth` por separado — 16 con el mismo
padding, 7 variantes sueltas más, y topes de 720, 980, 1000, 1100 y 1200 según quién la
escribió. Copiar la pantalla de al lado propagaba el número.

```tsx
import { Pagina } from '@/app/_ui';
<Pagina>…</Pagina>   // topea en --pagina-max y CENTRA
                     // ancho="completo" para tablas/tableros · densidad="compacta"
```

El `style` de `Pagina` está tipado sin `maxWidth`, `width` ni `margin`: el compilador
rechaza el ancho. Y si el contenido no llega al tope, va **centrado** — un `maxWidth`
pegado a la izquierda es lo que deja la franja muerta. Si lo que necesita tope es
**texto**, va en el párrafo (`Lectura`, 70ch), nunca en la página: un `maxWidth` en el
`<main>` también angosta las tablas.

**2. Una barra de navegación NO lleva scroll horizontal.** Esconder destinos detrás de
un gesto lateral es esconderlos. Si no entran, bajan de renglón (`flex-wrap`). Esto va
en contra del §19.2 del documento de rediseño, y gana esta regla. El caso que lo probó:
las tabs de la ficha del lead scrolleaban de costado *y* tenían la barra de scroll
oculta por CSS, así que las últimas no daban ni una pista de existir.

El scroll lateral sigue bien donde lo que se corre es **contenido** —una tabla, una
fila de filtros, un bloque de código—: para eso está `.mk-scroll-x`.

**3. Una vista a pantalla completa ESTIRA con flex; `height: 100%` no existe acá.** El
padre saca su alto de `flex: 1`, y eso para el motor es un alto **indefinido**: un
porcentaje contra un alto indefinido no resuelve. Chrome lo resuelve igual (por eso pasa
las revisiones), **Safari devuelve CERO** — y con el `overflow: hidden` que suele tener
ese contenedor, cero de alto es una **pantalla en blanco**: el header dibujado y debajo
nada. Un cliente lo reportó tres veces como «el plan está vacío» desde su Mac mientras
desde una PC con Windows se veía perfecto, con los mismos datos y el mismo servidor.

El patrón que funciona en los dos: el contenedor es `display: flex; flex-direction:
column` y el hijo estira con `flex: 1; min-height: 0`. Si el hijo scrollea, el
`overflow-y: auto` va en el hijo, no en el padre.

⚠️ **Y esto NO lo caza ninguna prueba hecha en Chrome**, que es donde se prueba todo.
Cuando algo se ve en blanco en un navegador y no en otro, con el header dibujado, es esto
antes que cualquier otra cosa.

**4. Y una COLUMNA de navegación no scrollea, aunque una barra sí pueda envolver.** La
regla de arriba no cubre este caso y la diferencia es de eje: una barra horizontal que no
entra baja de renglón y no pierde nada; una columna no puede envolver, así que si no entra
o scrollea o corta. Por eso el eje vertical lleva la regla más dura, y el dueño ya la había
escrito dos veces el 1/7/2026: **«La sidebar se puede scrollear, eso NO debe ser posible
NUNCA»**. Si no entra, se reorganiza o se pliega.

- **La columna no crece: se agrupa.** Una familia con más de ~6 destinos mete en un
  `NavGrupo` los que se consultan de a uno. Cuesta UNA fila y abre al costado. El
  precedente está en la misma barra: «Analysts» esconde siete destinos en una fila, con el
  porqué escrito al lado — *«sin esto, Analyze eran nueve filas y la barra se volvía una
  lista de todo»*.
- **`scrollbar-width: none` está prohibido en los dos ejes.** No elimina el scroll: elimina
  la evidencia, y con `overflow: hidden` en el contenedor el síntoma es exactamente cero —
  ni degradado, ni media fila cortada, ni nada. Sobre fondo oscuro va `.mk-scroll-oscuro`,
  que adelgaza y tiñe. Es la RED por si igual desborda, **nunca** el arreglo.
- **Plegar sí, esconder no.** Lo que se pliega lleva rótulo, ícono y chevron, y abre por
  hover y por click. Lo que la regla prohíbe es esconder SIN pista.
- **El desplegable hereda el problema.** Si la colección puede crecer, el flyout lleva
  `maxHeight` + `overflowY` + `.mk-scroll-oscuro`: un menú con `overflow: hidden` clipea sus
  últimas filas en silencio.

**En el CONTENIDO de una pantalla el equivalente es partir en tabs**, y es obligatorio
cuando se apilan paneles de fuentes de verdad distintas. El corte va por **pregunta, no por
longitud** —«¿qué falta?» vs «¿qué pasó?» en `app/admin/dev/[area]/RegistroArea.tsx`— porque
partir por largo da tabs arbitrarias que después nadie sabe dónde buscar. El techo son seis
(`app/_ui/Tabs.tsx`: más de seis es que falta una decisión de arquitectura, no una tab). Y la
tab viaja en `?tab=` **leída en el server** y escrita de vuelta con `router.replace(…, {
scroll: false })` —el router de `app/_ui/Link`, que preserva el `?ws=`—: si solo se lee, el
link que copiás no es la tab que estás viendo. El molde completo es `app/admin/ui/`.

El resto del sistema, en [app/_ui/LEEME.md](app/_ui/LEEME.md); el catálogo vivo, en
`/admin/ui`, que además lleva el historial de por qué cada cosa quedó así.

# El destino de «Volver» es una propiedad de la PANTALLA, no del camino

`router.back()` (o un `pop` de una pila de vistas) contesta «de dónde viniste», y eso **no
es** lo que un botón «Volver» promete: promete el nivel de arriba. Mientras haya un solo
camino a la pantalla las dos cosas coinciden, y ahí es donde envejece — cada camino nuevo
(un rótulo clicable, un botón de marca, un deep-link, el Atrás del navegador) las separa,
semanas después y sin nada que lo explique.

El mismo botón de `/conocimientos` se reportó roto **tres veces**, con tres causas
distintas, y los dos primeros arreglos eran correctos: fallaron por compartir la premisa.

La regla: **cada nivel declara su destino y se navega explícitamente.** Recurso → clase,
clase → índice, índice → cursos. Si el nivel de arriba no existe (un share de UN curso), el
botón **no se dibuja**: uno que no lleva a ningún lado es peor que no tenerlo.

Y cuando el destino depende de verdad del contexto —un recurso se abre desde el índice o
desde una clase—, **el contexto se hace DATO, no se deduce del historial**: viaja en la
vista (`?…&de=N`), así sobrevive a un reload y a un link copiado, que es justo lo que el
historial no hace.

El detalle, con los tres síntomas y los gotchas de verificarlo con Playwright, en
[docs/hallazgos-conocimiento.md](docs/hallazgos-conocimiento.md).

# Un reescritor de codigo fuente reporta exito sobre un archivo roto

Cualquier script que EDITE un `.ts` del repo —insertar en un mapa, reemplazar un valor,
regenerar un bloque— termina con su «✓ listo» aunque haya dejado el archivo sin compilar.
El script no parsea lo que escribió; el que se entera es el typecheck, tres pasos después
y culpando a otra línea.

Dos formas de romperlo que ya pasaron acá, las dos el mismo día:

1. **`$1`, `$&`, `` $` `` y `$'` son SUSTITUCIONES en un string de reemplazo.** Varias
   descripciones de cursos hablan de plata («escálala hasta **$10,000+** mensuales»), así
   que `.replace(re, '$1' + texto + '$2')` expandió el `$1` del TEXTO al grupo de captura y
   partió la línea en dos. **El escapado de comillas no protege de esto**: el problema no
   es el texto insertado sino el string que lo envuelve. Va como función:
   `.replace(re, (_, ini, fin) => ini + texto + fin)`.
2. **Un `
` suelto** al insertar en un archivo CRLF — no rompe el build ni el typecheck y
   no se ve en ningún listado (ver la sección de Windows más abajo).

**La regla: un script que escribe código fuente valida su salida ANTES de escribirla**, o
como mínimo corre el typecheck él mismo y falla ruidoso. `escribir()` en
`scripts/curso-categoria-portada.mjs` es el molde: chequea el CR suelto y, si aparece, no
escribe NADA — mejor no hacer el trabajo que dejarlo a medias.

⚠️ **Y EL ANCLA NO PUEDE SER LA COLA DE UN TIPO CON GEMELO.** `BoardTask` y `Label`
(`app/plan/board/types.ts`) terminan con EXACTAMENTE el mismo comentario de `clienteNombre`
y el mismo `};`, así que un `replace` anclado ahí inserta en el primero. Pasó dos veces el
27/09/2026 en la misma sesión —el campo `portada` y la prop `onPortada`, esta última porque
`  onAsignarCliente: () => void;` es el PREFIJO de una línea más larga en `TaskModal`— y
las dos veces el error de tipos salió en OTROS archivos, sin nombrar el que estaba mal. Se
ancla en algo que sólo tenga el tipo que buscás, o se usa `rindex`. Y si dos tipos hermanos
comparten la cola, la cura de fondo es que dejen de compartirla: el campo nuevo lleva su
propio párrafo diciendo por qué es de ése y no del otro.

# Que un agente verifique a otro agente no reemplaza un chequeo determinista

Un auditor que lee el texto de otro auditor puede compartir su punto ciego, y «lo
verifiqué» sin volver a la fuente es una tautología. Lo que el código hace y el modelo no
es **ser exhaustivo sin cansarse**.

Medido: se pidieron 87 descripciones más cortas con la regla «acortar es TIRAR, no
reescribir». Dos auditores por lote las dieron por buenas. Un chequeo determinista de 30
líneas —partir las dos versiones en palabras de contenido, aplicar una raíz burda para no
marcar «campaña»/«campañas», y listar lo que aparece en la corta y no en la larga—
encontró **16 con contenido nuevo**.

⚠️ **Y el resultado del chequeo NO era «están mal»: era «hay que mirarlas».** De esas 16, la
mayoría había mirado el material del curso y quedado más precisa que el texto original;
sólo cuatro afirmaban algo sin respaldo. **Un chequeo automático de divergencia señala
dónde mirar, no qué rechazar** — automatizar el rechazo habría tirado las diez que
mejoraban junto con las cuatro que había que corregir.

# Cambiar la ETIQUETA de un elemento arrastra su hoja por defecto, y eso no sale en el diff

`a` → `button`, `div` → `section`, `span` → `p`: el diff muestra una palabra cambiada y lo
que cambia de verdad es `text-align`, `font`, `cursor`, `margin`, `display` y el
comportamiento del `type`. No hay ninguna regla del proyecto que lo explique, porque el
estilo no vive en el proyecto.

El hero del portal de cursos se replicó de un origen donde es un `<a>` y acá se escribió
`<button>`, porque tiene que ejecutar una acción de React. **Mordió dos veces por el mismo
agujero**: primero colapsaba a 0×0 sin un `display: block` —un `<button>` no es `block`—, y
meses después resultó que todo su contenido salía CENTRADO, porque un botón trae
`text-align: center` y un enlace no. Lo segundo vivió invisible mientras el contenido fue
una cejilla y un título corto: centrado, eso se lee como una decisión de diseño. Se hizo
visible el día que se le metió un párrafo adentro.

**Se comprueba con `getComputedStyle` sobre el elemento nuevo, nunca leyendo el CSS del
repo** — ahí no está escrito, justamente. Y si el cambio de etiqueta es por interactividad
(el caso normal: hace falta un `onClick`), acordate del otro costado: el nombre accesible.
Un `<button>` con un párrafo adentro se anuncia leyendo el párrafo entero, así que lleva
`aria-label` propio.

# Una pantalla oscura se hace redefiniendo TOKENS, no reglas

La app es **tema claro con islas oscuras** (el sidebar, el tooltip, el toast). No hay
`prefers-color-scheme` ni modo oscuro global, y no se está agregando uno. Cuando una
pantalla tiene que ser oscura —hoy solo `/second-brain`— se marca `<html data-tema="oscuro">`
y se redefinen los tokens en `app/globals.css`. Todo lo que ya consume `var(--surface)`,
`var(--ink)`, `var(--border)`… se da vuelta solo. El inventario de esa pantalla contó **40
usos** repartidos en tres archivos: tocarlos uno por uno era garantizar que el próximo se
olvidara.

Tres cosas que el scope NO resuelve solo, y que hay que mirar a mano:

- **Los tokens que existen PARA un fondo.** `--mako-ink` es, textual, «el dorado bajado de
  luminosidad para que se LEA sobre fondo claro». En oscuro da 2,97:1. No se inventa un
  cuarto dorado: en el scope apunta a `--mako`.
- **Las relaciones invertidas.** Si el estado ENCENDIDO de algo es un gris oscuro y el
  apagado es casi blanco, en oscuro el apagado pasa a ser lo más brillante de la pantalla.
  Pasó con las aristas del grafo.
- **`--focus-ring`**, que trae un halo interno de `var(--surface)`. En oscuro hay que
  apuntarlo al FONDO o pinta un aro blanco puro.

Y dos reglas de valores: en oscuro las superficies **suben** de luminosidad (`--sidebar-2`
es MÁS oscuro que el fondo del lienzo y da 1,06:1), y las líneas van con un color **opaco**
a dos escalones del fondo, nunca un gris claro bajado de `opacity`.

El detalle, con las mediciones, en
[docs/hallazgos-second-brain.md](docs/hallazgos-second-brain.md).

# Una página pública de más de ~12 KB llega VACÍA a quien no ejecuta JavaScript

El layout raíz envuelve toda la app en un `<Suspense fallback={null}>` (por el
`useSearchParams` del `WsProvider`), y React escribe aparte —en un `<div hidden id="S:0">`,
hasta que un script lo inserta— **todo bloque de Suspense de más de 12.800 bytes, aunque ya
esté listo**. O sea que cualquier página pública grande se lee VACÍA sin JavaScript: el
verificador de Meta, las vistas previas de WhatsApp, cualquier crawler que no lo corra.

Medido el 08/10/2026: Meta rechazó la verificación del negocio dos veces por «la razón social
debe aparecer en el sitio web», la segunda con el nombre ya en el HTML. Con Chromium sin
JavaScript, `/` tenía 0 caracteres visibles. Detalle en
[docs/hallazgos-landing.md](docs/hallazgos-landing.md) → «La portada viajaba VACÍA…».

- **Lo que una página pública TIENE que mostrar sin JavaScript va fuera del bloque grande**: lo
  grande en su propio `<Suspense>`, con un fallback CHICO que se vea (molde:
  `app/vsl/PortadaSinJs.tsx` en `app/page.tsx`).
- **Se verifica leyendo como sin JavaScript**, nunca con `grep`: un texto oculto aparece en el
  HTML igual que uno visible. Sacar los `<div hidden id="S:…">` cerrando por profundidad, o
  Chromium con `javaScriptEnabled: false`.
- **El test renderiza en streaming y adentro de `<html><body>`.** `renderToStaticMarkup` no
  reproduce nada, y React sólo saca bloques aparte cuando renderiza un documento.
- ⚠️ `/privacidad` sigue así: el arreglo de fondo (sacar `{children}` del Suspense del layout)
  toca toda la app y pide un `npm run build` en el clon.

# Una ruta con auth propia va en `lib/rutas-publicas.ts`, o no existe en producción

Si una ruta se autentica sola —por firma, por secreto o por **bearer**— tiene que estar en
`PUBLICOS` (`lib/rutas-publicas.ts`). Si no está, `proxy.ts` la corta con un 401 **antes**
de que su código corra, y no hay síntoma que apunte al lugar correcto.

⚠️ **En local esto NO se ve.** Sin `AUTH_SECRET`, `gateConfigurado()` es false y el
middleware hace no-op: la ruta anda perfecta contra `localhost` y falla solo en producción.
La integración con Claude vivió meses así, y la descubrió una clienta.

**La pista, y sirve para cualquier ruta con auth propia:** pegarle con una credencial
inválida y leer el TEXTO del 401.

| Respuesta | Quién contesta |
|---|---|
| `no autenticado` | **el middleware** — la ruta ni se ejecutó |
| el error propio de la ruta | **la ruta** — ahí sí el problema es la credencial |

Los dos son 401 y desde afuera se ven iguales. Sin distinguirlos se buscan headers y
entornos que no tienen nada que ver.

Y estar en esa lista significa **dos** cosas: que la ruta se hace cargo de su auth, y que
**no lee la cookie de sesión para nada** — el early-return se saltea el chequeo CSRF de
Origin. Se listan rutas exactas, nunca un prefijo de carpeta: en `/api/agente` conviven
las que hablan por bearer y las que exigen navegador. **La única excepción es `/api/v1`**:
toda la carpeta es bearer por construcción, y `tests/api-mako-registro.test.ts` enumera en
positivo los `route.ts` que puede tener (ver «Una capacidad nueva de MaKo se DECLARA…»).

El detalle, en [docs/hallazgos-infra.md](docs/hallazgos-infra.md).

## ⚠️ Una PÁGINA pública sólo se lee: si acepta POST, ejecuta server actions sin sesión

Medido el 06/10/2026 en local: un POST **sin cookie y sin Origin** a `/login` con el header
`next-action` de `listConfirmacionesAction` contestó 200 con las confirmaciones pendientes del
CRM del ws1 —nombres de leads, cambios y el `revert` para deshacerlos—. Lo mismo por
`/privacidad`, `/terminos` y `/vsl`. Se suman tres cosas, y ninguna sola es el bug:

- el early-return de las rutas públicas se saltea el chequeo de Origin;
- **Next REENVÍA una acción a cualquier worker que la tenga**, así que por la puerta de una
  página pública entra CUALQUIER server action de la app, no sólo las de esa página;
- sin cookie, `getWorkspaceActual()` cae al dueño (`OWNER_WS`, el ws1, un cliente).

**La regla, en positivo y en el proxy:** toda página pública (lo que no es `/api/`) acepta sólo
GET/HEAD/OPTIONS (`esPublicaSoloLeer`, `lib/rutas-publicas.ts`). No alcanza con cortar el header:
Next también procesa una acción que llega como formulario multipart con el id en el cuerpo. Lo que
escribe sin sesión son route handlers bajo `/api/`, que no procesan acciones. Una página pública
nueva que de verdad necesite un POST se agrega por nombre, con su porqué.

Y el segundo corte, para no depender de la ruta: **una server action que monta el LAYOUT raíz
exige sesión adentro** — su id viaja en todas las páginas. Lo fija
`tests/acciones-sin-sesion.test.ts`. El detalle, en
[docs/hallazgos-seguridad.md](docs/hallazgos-seguridad.md).

# Un canal PROPONE; una persona confirma. Nada escribe directo

Todo lo que llega de afuera —Claude, WhatsApp, una automatización, un formulario— deja
una **propuesta** y devuelve **UN LINK** a una pantalla de MaKo donde alguien la mira, la
corrige y confirma. Recién ahí se escribe.

Ya funcionaba así el plan (`plan_propuestas` → `/plan/revisar`) y funcionaba bien. Lo que
faltaba era que fuera LA regla: cuando se agregó el alta de leads del agente, escribió
directo en `leads` — no porque alguien decidiera saltear la revisión, sino porque no había
ningún lugar del que la revisión saliera sola.

**El porqué ya está pagado** y es el corolario de «una regla en un prompt no es una regla»:
un DATO EXACTO que pasa por las manos de un LLM deja de ser exacto. Un teléfono con un
dígito cambiado entra al CRM, no matchea su chat de WhatsApp ni su Calendly, y no se nota
hasta que falta una conversación. La confirmación no es burocracia: **es el único momento
en que un humano ve el dato antes de que valga.**

Cómo se cumple, y son cuatro piezas:

1. **La propuesta va a `propuestas`** (`lib/propuestas.ts`, mig 0128), con `tipo` +
   `datos`. Es genérica a propósito: una tabla por área garantiza que la tercera también
   sea propia y que cada una reinvente estado, idempotencia y caducidad.
2. **La respuesta del canal es un LINK ABSOLUTO**, nunca un id ni un path suelto. Un path
   no es clicable en un chat, y este repo ya pagó que un link armado a medias resolviera a
   un borrador REAL pero equivocado.
3. **La pantalla de confirmación es EDITABLE.** Si solo pregunta «¿confirmás?», obliga a
   aceptar el dato mal y arreglarlo después — o sea, a confirmar algo que se sabe
   equivocado. El momento de mirarlo es el momento de corregirlo.
4. **Idempotencia en las dos puntas**: `ref` al proponer (un formulario dispara dos veces
   con mala conexión) y `.eq('estado','pendiente')` al aplicar (dos pestañas, un doble
   click). Sin las dos, el dueño confirma un duplicado creyendo que son dos personas.

5. **Y tiene que existir una BANDEJA**, no solo el link. El link alcanza cuando el canal
   puede contestar por donde entró (WhatsApp, Claude). Un formulario de landing **no tiene
   canal de vuelta**: quien lo completa ve la página de gracias del cliente, así que si el
   link no sale por un aviso no sale por ningún lado. Y un aviso solo tampoco basta: **un
   aviso es un EVENTO, una bandeja es un ESTADO**, y lo que se pierde siempre es lo que solo
   era un evento — uno que no se manda, no llega, o se lee y se olvida no deja nada atrás.

   No es hipotético. `propuestasPendientes()` vivió desde el día uno con **cero call-sites**;
   la única pantalla era `/crm/revisar/<id>`, por id. El 14/08/2026 había **ocho** propuestas
   de lead en `pendiente` en el workspace de una clienta, cuatro de gente real con nombre y
   teléfono, que nadie vio nunca. El sistema funcionaba exactamente como estaba escrito. La
   bandeja es `/crm/revisar`.

⚠️ **La excepción no es «el dato viene de un sistema, no de un modelo».** Un lead de un
formulario es un dato real, pero si el que lo transporta es un modelo, el modelo lo puede
transcribir mal. Lo que decide es **quién escribe la request**, no de dónde salió el dato.

⚠️ **Y un indicador que afirma la mitad verdadera de un proceso de dos pasos es peor que uno
roto**, porque nadie lo va a auditar. El chequeo de la landing decía «llegó al menos un
formulario ✓» y era **cierto** — le faltaba el segundo verbo: llegó ¿y **entró**? Se leyó como
«esto anda, seguí» durante los días en que esos ocho leads se enfriaban. Cuando midas un
proceso que tiene un paso humano en el medio, el estado sale del paso que **falta**, no del
que se cumplió.

# Para decir «esto no afecta a nadie», se mide lo que LEE el código que corre

No un campo con el mismo nombre. Medido el 06/10/2026: se le afirmó a Martín que Microsoft
Clarity estaba «muerto en datos» porque `landing.config[].clarityProjectId` —el proyecto POR
PÁGINA— tenía cero filas. El código que corría leía otra cosa: la credencial del WORKSPACE
(`credWs('CLARITY_PROJECT_ID')`), viva en 5 workspaces, 3 de ellos clientes con tráfico. Con
esa afirmación él decidió sacarlo entero; el retiro salió bien porque antes de borrar se midió
de nuevo, y se encontró que además el reemplazo no estaba prendido para ninguno de esos
clientes.

- **Antes de afirmarlo, `grep` del LECTOR**: qué función decide si la feature corre, y qué
  consulta hace. Recién ahí se cuenta en la base.
- **Y «muerto en código» y «muerto en datos» son dos mediciones**, cada una con su número. Una
  sola dicha como las dos es la forma en que se cuela esto.
- **El olor:** dos lugares donde vive «el mismo» dato (por workspace y por página, el global y
  el override). Si medís uno, decí cuál.

# Lo que se SACA del código pegado en la página de un cliente también sube la versión

El snippet del Pixel vive congelado en el HTML del cliente: una mejora no le llega a quien ya
lo tenía, y por eso existen `SNIPPET_VERSION` y el aviso de repegar. Lo que se SACA tampoco le
llega — un tercero que el snippet inyectaba, un comportamiento que se retiró — y la tentación
es no subir la versión porque «no trae nada nuevo».

Medido el 06/10/2026 al retirar Microsoft Clarity: se razonó «los clientes ya están por debajo
de la v21, el aviso ya les llega» y la portada del ws1 —la de más tráfico— se había repegado
con la v21 cuatro horas ANTES del retiro: servía `SV = 21` con el tag de Microsoft adentro y,
con la versión en 21, contaba como al día para siempre.

- **Retirar algo del snippet es una versión nueva**, con su renglón en `NOVEDADES` aunque el
  renglón diga lo que ya no hace.
- **Y el razonamiento «ya les llega el aviso» se mide contra lo que SIRVEN las páginas**, no
  contra el número que anotó el beacon: un `curl` del HTML de la página principal de cada
  cliente lo contesta en un minuto.

# Un control en el rincón de abajo a la derecha lleva `data-esquina-ocupada`

La esquina de los avisos (`app/_components/EsquinaAvisos.tsx`) pinta en TODA la app desde el
06/10/2026, y uno de sus avisos no se cierra. Medido ese día: tapaba el «Publicar» del lienzo
de /chatbot y el «Enviar» de los chats. Un clic en «Publicar» llevaba a /integraciones y dejaba
la estrategia sin guardar, y no había forma de destaparlo.

- **Un botón nuevo pegado al rincón de abajo a la derecha de la ventana** (un pie flotante,
  la acción de un lienzo, el composer de un chat) **lleva `data-esquina-ocupada`**, y la esquina
  sube sola (`:root:has(...)` en globals.css). Sin la marca, el botón existe, está habilitado y
  el clic no le llega nunca.
- **Un aviso flotante nuevo va DEBAJO de los modales** (z < 60). Un modal es algo que la persona
  abrió, y un aviso no puede taparle el cerrar.

# Un alta que pasa a crear N filas choca con su propio chequeo de duplicados

Cuando una función que creaba UNA fila pasa a crear varias de la misma entidad —el mismo
lead en tres embudos, el mismo cliente en dos productos, la misma tarea en dos tableros— el
chequeo de duplicados que la protegía se vuelve el obstáculo: la PRIMERA entra y la SEGUNDA
**encuentra a la primera**.

Medido el 06/10/2026 en el opt-in de la landing, cuando el Pixel pasó a poder asignar varios
productos. `createLead` corre `duplicadosDeLead` por nombre, email y teléfono; la segunda
ficha tiraba `LeadDuplicadoError`, y en esa ruta **un alta que falla cae a propuesta** — o
sea que el reparto dejaba a la persona esperando un click que nadie sabe que hay que dar,
que es exactamente el agujero que la bandeja de revisión vino a cerrar. No da error visible:
el lead entra al primer producto y el resto se convierte en un borrador.

- **Se chequea UNA vez, afuera del bucle, y adentro se declara que ya está chequeado**
  (`permitirDuplicado: true`). Pasarlo sin haber chequeado es lo contrario de esta regla.
- **Y cada fila extra es best-effort, con su propio `try`.** Si falla la tercera, la persona
  YA está en el CRM: tratarla como un fallo del alta crearía un duplicado o un borrador de
  alguien que ya entró. Se registra CUÁL falló y se sigue.
- **El olor:** un `for` nuevo alrededor de una llamada que antes estaba sola, cuyo cuerpo
  valida contra lo que el propio bucle acaba de escribir.

⚠️ **Y ANTES DE ESCRIBIR EL BUCLE, PREGUNTÁ SI SON N COSAS O UNA COSA EN N LUGARES.** El opt-in
de arriba ya no crea N fichas: desde el 06/10/2026 (`f26c0a94`) crea UNA y le AGREGA los otros
productos (`agregarAProducto`, `lib/lead-funnel.ts`, mig 0207), porque un lead en tres
productos es UNA persona — y tres fichas son tres personas para todo lo que cuenta leads, manda
mensajes o dispara la conversión de Meta. Martín, cuando el «Mover a prueba» le sacó un lead
del producto principal: «No se debe "Mover", se debe agregar al otro producto». La regla de
arriba sigue valiendo para las entidades que SÍ son N (una tarea por tablero, una fila por
cuota); la pregunta es la primera línea.

# Si la misma pregunta se contesta en DOS lugares, el BORRADO va por una función

La regla de arriba autoriza partir un dato en dos claves, y está bien. Lo que no
dice es lo que se paga después: la misma pregunta queda contestada dos veces, el
camino de LECTURA las cruza —para eso se hizo— y el de BORRADO casi siempre toca
una sola. El resultado no es un dato a medias: es un **borrado que no borra**, y
que además reporta éxito.

El caso, del 03/09/2026. «¿Este paso del onboarding está hecho?» vive en
`onboarding.tab.<key>` (el estado de la tab) **y** en `onboarding.tab.pasos` (el
registro compartido del workspace, para que conectar el WhatsApp desde una tab
cuente en la otra). `getEstadoTab` las cruza y **RECALCULA** el status. Se
«reseteó» el Video Generator de un cliente borrando la fila propia, se verificó que
la fila ya no estuviera, y al entrar **la tab abrió normal**: los seis pasos
seguían vivos en el compartido. Se reportó como «no me salta el onboarding apenas
entre».

Y no fue la primera vez: `scripts/reset-chatbot-leila.ts` tenía el mismo bug desde
agosto, escribiendo la clave propia a mano e imprimiendo «✓ paso reabierto».

- **El borrado va por la función que toca las dos**, y los caminos a mano se
  cierran. Acá ya existían `reabrirOnboardingTab` (la tab entera) y
  `desmarcarPasoEnTodasLasTabs` (un paso): el bug no fue que faltara la función,
  fue que había una puerta al costado.
- **Se verifica el valor CALCULADO, no la fila escrita.** La fila es lo que uno
  controla; el cruce es lo que el producto lee. Toda la falla vive en la distancia
  entre las dos, así que comprobar la fila es comprobar la mitad que no falla.
  Molde: `scripts/reabrir-onboarding-tab.ts`, que relee `getEstadoTab` y tira si
  sigue diciendo `done`.
- **Y el respaldo también es de las dos.** Guardar sólo la clave que se está
  mirando es el mismo error aplicado al respaldo, y deja restaurar con confianza.

⚠️ **Y una MIGRACIÓN que decide si le toca mirando el estado que ella misma
escribe es un bucle.** `puentearPasosCopyGen` corría cuando la tab no estaba
`done` — indistinguible de «la reabrieron a propósito»—, así que la primera carga
después de un reset BIEN hecho volvía a cerrarla. Reabrir esa tab era imposible por
diseño, sin ningún síntoma: el operador ya había visto su tilde. Una migración de
una sola vez deja su propia marca (`onboarding.tab.ads-writer.puenteado`) y sale
temprano; nunca deduce «ya corrí» de un estado que otro puede reabrir.

## Y dos pasos distintos que comparten NOMBRE se marcan solos entre sí

El corolario del registro compartido. Está bien que dos tabs compartan una key
cuando es la MISMA configuración vista desde dos puertas (el mismo número de
WhatsApp en `/whatsapp` y en `/chatbot`). Cuando no lo es, el cruce deja de ser una
comodidad y pasa a ser un **salteo**: la segunda tab da por hecha una pantalla que
nadie vio.

`lib/tab-onboarding-catalogo.ts` advertía la trampa **cuatro veces en prosa** y aun
así `instagram` usaba `contexto` y `ensayo` a secas, las mismas dos keys del Chat
Agent. Medido en dos clientes: en el ws11, `instagram.contexto` tiene el timestamp
`2026-08-10T20:36:51.948Z` y el `contexto` del Chat Agent `…52.603Z` — 0,6 s
después. Lo marcó `/chatbot`. Lo caro es el segundo: el ensayo de Instagram
previsualiza el borrador de un DM, y saltearlo **enciende el auto-respondedor sin
que nadie haya leído una sola respuesta**.

Lo que faltaba no era otra advertencia: eran **tres tests** que preguntaban «¿esta
tab respeta su prefijo?», uno por tab. Un test así es estructuralmente incapaz de
encontrar esta colisión, porque las dos tabs que colisionaban no tenían ninguna
regla de prefijo que romper. La pregunta correcta es **«¿qué key aparece en más de
una tab?»** — `tests/onboarding-keys-colision.test.ts`, con una lista blanca
EXPLÍCITA de las compartidas a propósito, para que compartir una key sea una
decisión escrita y no un descuido. El test lleva su inverso: una entrada de la
lista blanca que ya no comparte nadie también falla, porque si no queda permiso
escrito para una colisión futura.

# Una barra de gráfico se recorta al 100%, siempre

`width: ${pct}%` adentro de un carril NO desborda la barra: **desborda la página**.
Un valor 14× por encima del `max` del gráfico se dibujó con `width: 1468%` y llevó el
documento de 1.440 px a **7.656 px** de ancho — con el scroll horizontal en toda la
app, no en el gráfico.

No fue un dato raro: `max` es una prop explícita justamente para que dos gráficos se
puedan comparar, así que un valor por encima del tope es lo NORMAL. Toda escala con
tope fijo necesita las dos cosas:

- `Math.min(100, …)` en el ancho, y `overflow: hidden` en el carril.
- **Que se vea que está cortada.** Una barra recortada con la punta redondeada miente:
  parece que ahí termina el valor. Va a filo, con una marca, y el número al lado —
  que ya es obligatorio por la regla de que el color nunca es el único portador.

Vive en `app/admin/dev/pricing/Piezas.tsx` → `Barras`.

# Montar una PANTALLA adentro de un modal: lo que el componente asume por ser la pantalla

Un componente de ruta toca cosas GLOBALES sin decirlo, y adentro de otra pantalla cada una
de esas cosas deja de ser suya. Antes de montar uno adentro de un modal (o de un panel, o
de otra ruta), enumerá las seis y decidí QUÉ hace cada una embebido:

| Qué | Por qué rompe |
|---|---|
| La URL como estado | Escribe y LEE los parámetros de OTRA ruta. Al volver a entrar, se reabre solo lo que dejó escrito |
| `document` / `window` listeners | Escape, teclas, `dragover`. Dos pantallas escuchando lo mismo cierran las dos |
| `localStorage` | La clave es la misma: la preferencia de una se aplica en la otra, y lo que una «marca como visto» se lo consume a la otra |
| `<main>` y los altos en `vh` | Un `<main>` dentro de otro no es HTML válido, y 100vh adentro de una caja topada fuerza scroll siempre |
| `window.location.reload()` | Lo que la pantalla de afuera tiene en estado de React no vuelve. Recargar la EXPULSA |
| Los pop-ups que se auto-abren | Contestan «acabás de entrar a tu tablero», que embebido es la pregunta de otro alcance |

Va UNA prop —`embebido`— y no seis: son la misma decisión. Y es una PROP, no algo deducido
de otra (en este repo, de `clienteFijo`): «es de este cliente» y «no soy la ruta» son dos
hechos distintos, y el día que uno valga sin el otro, deducirlo miente.

⚠️ **Y LA PILA DE MODALES NECESITA QUE EL DE ABAJO SE DECLARE.** `app/_components/pila-modales.ts`
esconde con `display:none` a la capa que tenga otra encima — y si el que se abre encima es
un DESCENDIENTE del DOM del de abajo (el caso de un modal que contiene una pantalla), se
apaga con él: se monta, se pinta `display:flex`, le toca un z más alto, y no se ve nada.
Eso es `contenedor`. No se arregla marcando `anidada` a los de arriba: `anidada` también
apaga la semántica de REEMPLAZO que esos modales tienen entre sí donde SÍ son la pantalla.

⚠️ **Y UN POPOVER ANCLADO TAMBIÉN ES UNA CAPA: se registra en la pila y frena con
`stopImmediatePropagation`.** Registrarse (`useCapaModal(true, { anidada: true })`) es lo
que le da el z-index correcto y hace que el de abajo se abstenga del Escape. Pero
`esElDeArriba()` sólo dice **si te toca contestar**: no impide que conteste otro. Todos los
Escape de la casa viven en `document` y en captura, y `stopPropagation` frena la
propagación a otros NODOS, nunca a los listeners hermanos del mismo. Medido el 27/09/2026
en el selector de portada: una tecla cerraba el panel **y la ficha del cliente**, o sea que
perdías el cliente por cerrar un selector. El de arriba de todo frena con
`stopImmediatePropagation()`.

⚠️ **Y UN EFECTO QUE MIDE UN NODO MONTADO POR UN PORTAL DEPENDE DEL ESTADO QUE MONTA EL
PORTAL.** El patrón `const [montado, setMontado] = useState(false)` + `if (!montado) return
null` hace que la primera corrida del efecto no encuentre nada que medir; si lo que mide es
un `useCallback` estable, el efecto **no vuelve a correr nunca**. El mismo día, el popover
de la portada quedaba en `left:0, top:0, opacity:0` — invisible, en la esquina, sin un solo
error, y en pantalla indistinguible de un botón que no hace nada. Va `montado` en las
dependencias.

⚠️ **Y UN VALOR QUE INYECTA EL REPO TIENE QUE VOLVER AL ESTADO.** Si el parent envuelve
`createX` para agregarle un campo (acá, el cliente de la ficha), el merge posterior al alta
tiene que copiarlo de vuelta: el guardado siguiente es un upsert de la fila ENTERA armada
desde el navegador, así que lo que el estado local no tenga sale como `null`. Nace bien y
se borra solo, sin un error, sin un 4xx y con la tarjeta a la vista. Es la misma trampa que
los mappers de lectura, del lado de la escritura.

# Un componente COMPARTIDO no lleva el endpoint adentro: lleva la capacidad del Repo

Si dos productos distintos montan el mismo componente —en este repo, `BoardShell` es el
tablero del dueño Y el de cada cliente—, un `fetch('/api/loQueSea')` escrito adentro le
promete a los dos algo que sólo uno puede cumplir. No falla al compilar, no falla al
renderizar: falla cuando alguien lo usa, y contesta 403.

Medido el 23/09/2026: el slider de prioridad salió a producción con
`fetch('/api/plan-board')` adentro. Esa ruta abre con `getSesionAdmin()`, así que **cada
cliente tenía un control cuya única respuesta posible era «solo admin»** — y además
`score_manual` (mig 0143) es una columna que la tabla del cliente no tiene, o sea que
tampoco había dónde escribirlo. Con el mismo molde salieron ese día otros tres: la casilla
de prioridad del alta, el arrastre del Kanban y el botón de dictar.

**La escritura entra por el `Repo`, y el que no la implementa NO DIBUJA EL CONTROL.** Es
opcional en el tipo (`prioridadManual?`) justamente para que la ausencia se pueda ver.

- **Esconder el botón no protege nada** —el que decide es el server, y eso ya es regla de
  esta casa— **pero mostrarlo sin poder usarlo es un daño aparte**: se lee como que la app
  está rota, que es peor que no tener la función.
- ⚠️ **Y la pregunta no es «¿lo escondo o lo muestro?» sino «¿QUIÉN PUEDE HACER ESTO DE
  VERDAD?».** El mismo día, el botón de dictar estaba en el mismo caso y la respuesta fue la
  opuesta: transcribir diez segundos de audio con la cascada gratis es algo que un cliente
  SÍ puede hacer en su propio tablero, y el gasto va contra las keys de su workspace. Ahí lo
  correcto era abrir la ruta, no esconder el botón.
- **El olor que lo delata:** un componente que importa una constante de ruta, o que tiene
  `fetch(` y un `action:` adentro. Si además lo monta más de un parent, ya es esto.

⚠️ **Y ANTES DE AGREGAR UN CONTROL, CONTÁ LOS QUE YA CONTESTAN ESA MISMA PREGUNTA.** El
panel del detalle terminó con TRES formas de cambiar la prioridad —un slider inline, un botón
que abre la audiencia y el pop-up del arrastre—, cada una con su cara y su resultado. Ninguna
se agregó de más: se agregaron de a una, cada una resolviendo algo real. El reporte fue
«¿para qué está el deslizable si para eso teníamos el pop-up?». Un control nuevo que contesta
una pregunta ya contestada no suma una opción, **parte la respuesta en dos**.

⚠️ **Y AL CERRAR EL CONTROL, ENUMERÁ QUÉ LE QUEDA A CADA TABLERO.** Esconderlo es correcto
y no es el final del trabajo: al día siguiente se midió que el tablero del cliente había
quedado sin slider, **sin arrastre** (`draggable={!!repo.prioridadManual}`) y sin la casilla
del alta, o sea con la prioridad que le puso MaKo y ninguna forma de cambiarla — que es
justo lo que la regla de abajo prohíbe. El único camino que le quedaba, «Cambiar prioridad»,
era peor: abre la audiencia, que lee y escribe `plan_tareas`, así que arrancaba, **pagaba el
razonamiento del modelo** y moría en «no encontré eso en el tablero». Si después de cerrar
no queda ningún camino, el trabajo no es esconder: es **implementar la capacidad donde
falta**, con la escritura que ESE tablero sí puede hacer. Y no la ates a una capacidad
vecina: exigir `prioridadManual` **y** `prioridadAlPerro` juntas dejaba el slider fuera de
todo tablero sin candado, por una columna que su caso no necesita.

# Una medición que CAMBIA lo que mide no puede decidir

Si el veredicto («¿pliego los botones?», «¿muestro el resumen corto?») se toma mirando el
estado ACTUAL, y aplicarlo cambia ese estado, la pregunta de ida y la de vuelta no son la
misma: queda un ping-pong que termina donde lo agarre el último evento. Y cuando el
contenedor **no cambia de tamaño** —un header es siempre el 100% del ancho—, el
`ResizeObserver` no vuelve a disparar y el resultado se congela roto.

La firma para reconocerlo en dos minutos: **el resultado no es monótono**. Medido en el
header del `/plan` el 23/09/2026, achicando la ventana: a 880 se pasaba 8px, a 860 28 y a
780 108 —con los botones dibujados encima del filtro— y entremedio anchos perfectos. Eso no
es un umbral mal elegido: es un empate técnico entre dos reglas.

**La decisión se calcula como función de lo que NO cambia** (acá, el ancho disponible):
sumar el `scrollWidth` de cada hijo —su ancho natural aunque el flex lo esté aplastando— y
compararlo con el `clientWidth` del contenedor. Tres corolarios que costaron una vuelta cada
uno:

- **Lo que se mide se busca ADENTRO de la medición.** Al plegarse, ese nodo se DESMONTA:
  una referencia tomada al montar mide `scrollWidth: 0` para siempre y el número real no se
  vuelve a leer nunca.
- **Hay que re-medir en `window.resize`.** El zoom del navegador es, para la página, un
  viewport más chico en píxeles CSS: puede no mover el tamaño de nada observado, pero
  `resize` sí sale.
- **Y si ni plegando entra, se baja de renglón** (`flex-wrap`), nunca se scrollea de costado
  ni se dibuja encima — ver la regla de las barras de navegación más arriba.

# Un tope que vive en la RUTA no protege al cliente: el `fetch` va con `signal`

`maxDuration` acota lo que tarda el server. No acota nada del lado del navegador: un `fetch`
sin `signal` con la conexión caída en el medio **no resuelve nunca**, y lo que se ve es un
spinner eterno. Pasó en el modal de reuniones del plan y se reportó tal cual: *«elegir una
reunión y ver lo que sacó se queda esperando para siempre»*.

- El `signal` va con el tope de la ruta + un margen (`AbortSignal.timeout(305_000)` para una
  ruta de 300 s), y el mensaje del corte dice **dónde quedó el trabajo**, no solo que falló.
- **Y todo spinner que pueda durar más de ~8 segundos dice cuánto puede tardar y qué pasa si
  cerrás.** Un spinner mudo durante minutos es indistinguible de algo colgado, y la persona
  cierra sin saber si perdió lo que estaba haciendo.

# Un color de acento dice algo, y puede decir lo contrario

`tono="bad"` pinta de rojo la barra DESTACADA. Si lo que se destaca es «el único canal
que sí entra en el techo», el gráfico afirma exactamente lo contrario de lo que afirma
el dato, y se lee antes que el texto.

La regla: **el tono se elige por lo que significa la barra destacada, no por el tema de
la sección.** Un gráfico sobre costos no es «malo» por ser sobre costos.

# Dos gráficos que hay que comparar comparten el ORDEN de las filas, o no se comparan

En «¿Cuánto cuesta conseguir un cliente?» el costo de cada canal se pinta en dos monedas
que nunca se suman: plata y horas. Eran dos `<Barras>` apilados, y cada uno venía
ordenado por SU propio valor —`sort` por `plataPorCliente` en uno, por `horasDe()` en el
otro—. Resultado: un canal estaba en el renglón 1 del gráfico de arriba y en el 4 del de
abajo. La RELACIÓN entre las dos monedas —que era todo lo que la sección tenía para
decir— era exactamente lo único que no se podía seguir con el ojo.

El dueño lo reportó como «no se entiende», y **el diagnóstico obvio era el equivocado**:
no sobraba texto. El texto era correcto; lo roto era que cada gráfico se ordenaba solo.

**La regla: el orden de las filas es UNO, se fija explícitamente en un solo lugar, y lo
fija quien llama.** Un `sort` adentro de cada gráfico es el bug.

Y el corolario, que es la parte que más ahorra después: el método de dataviz manda
**small multiples** para dos medidas de escalas distintas, y hasta ahí todo bien — pero
**small multiples SIN eje de categorías compartido no son small multiples: son dos
gráficos sueltos**. En un gráfico de barras horizontales el eje de categorías ES el orden
de los renglones. Se puede tener la forma correcta del catálogo y un gráfico que igual no
se lee.

Vive en `app/admin/dev/pricing/Piezas.tsx` → `DosMonedas`: un renglón por ítem, dos
carriles con su propia escala y su propio tope, y el orden lo fija quien llama.

# Lo que devuelve la búsqueda NO es el archivo

La herramienta de búsqueda de este entorno **reescribe `/` como `\` en el contenido que
devuelve** — no en el path del resultado, en la LÍNEA del archivo. Medido el 14/08/2026:

| El archivo dice | El `Grep` devuelve |
|---|---|
| `` `${base}/app/accounts/${acc}/conversations/${convId}` `` | `` `${base}\app\accounts\${acc}\conversations\${convId}` `` |
| `// Habla de un CONTACTO` (`lib/avisos-catalogo.ts:106`) | `\ Habla de un CONTACTO` |

**Un `//` que vuelve como `\` es la firma.** Eso no es código que exista en ningún lado. Solo
pasa en los resultados cuyo path viene acortado a relativo, así que en un mismo bloque hay
líneas sanas y líneas mangleadas — no se puede confiar en «las otras se ven bien». `Read`,
`sed | cat -A` y `readFileSync` devuelven la verdad.

Costó un hallazgo publicado como **bug vivo en producción** sobre una línea que nunca estuvo
rota, con autopsia completa en [docs/hallazgos-comunicacion.md](docs/hallazgos-comunicacion.md).
Tres reglas:

1. **`Grep` sirve para ENCONTRAR, no para CITAR.** Antes de reportar un bug que depende de un
   CARÁCTER —una barra, una comilla, un escape, un operador— releé esa línea con `Read`.
2. **«Lo verifiqué ejecutándolo» no verifica nada si lo que ejecutás es tu transcripción.**
   El agente pegó en node el string que le había devuelto el `Grep`; node confirmó, con toda
   razón, la cadena mangleada. Una verificación que no vuelve a la FUENTE es una tautología.
   Vale igual para un subagente: lo que devuelve es prosa, no evidencia.
3. **Antes de escribir «bug vivo en producción», `git log -L <n>,<n>:<archivo>`.** Si la línea
   nunca tuvo la forma que reportás, el bug es del diagnóstico. Es la otra mitad de la regla
   de abajo: un agente no distingue «nunca estuvo roto» de «se arregló hace una hora», y
   **tampoco distingue «está roto» de «lo leí mal»**.

## Y el otro modo: el archivo que la búsqueda declara BINARIO y no muestra

Un solo byte `NUL` (0x00) en el fuente hace que ripgrep conteste **«Binary file matches»** y
no devuelva ni una línea. En una búsqueda de un archivo se nota; en una de veinte, la línea
se pierde entre los resultados y **el archivo se lee igual que si no tuviera lo que buscabas**.
Es peor que la trampa del `\` de arriba, porque acá no queda ninguna firma rara que delate el
problema: contesta vacío y el vacío parece una respuesta.

Pasó el 16/08/2026 buscando `extraFooter` en `app/_components/WizardShell.tsx`: cero líneas,
y hubo que leerlo con un script aparte. Eran cinco archivos, todos con el byte crudo donde el
código quería el escape (`pasos.join('<NUL>')`, un centinela, dos clases de regex).

- **Si escribís un carácter de control, escribilo como escape** (`\u0000`, `\u001f`), nunca
  como byte. Significa lo mismo en una string, en una clase de regex y en un comentario.
- **Si una búsqueda contesta vacío en un archivo donde jurabas que estaba, mirá si es
  binario** (`file <ruta>` dice `data`) antes de concluir que no está.
- **Sacar el NUL genera un diff de archivo entero y no se puede evitar.** Con el byte adentro
  git guardaba el blob como binario —verbatim, sin normalizar—; al sacarlo pasa a texto y
  `core.autocrlf` lo pasa a LF de una. El `git blame` de ese archivo queda apuntando a ese
  commit. Vale la pena igual, pero va en un commit propio y avisado.

# Un eje en `hidden` convierte el otro en `auto`, y eso rompe todo `sticky` de adentro

`overflow-x: hidden` con `overflow-y: visible` **no** deja el eje Y quieto: su valor USADO
pasa a `auto` y el elemento se vuelve un **contenedor de scroll**. Un `position: sticky` se
posiciona contra su ancestro que scrollea; si ese ancestro pasa a ser uno que no scrollea,
el sticky deja de pegarse **del todo** — no se degrada, desaparece.

El caso: se puso `overflow-x: hidden` en `html` y `body` para matar una barra horizontal, y
con eso la barra lateral de una pantalla se iba con el scroll. Medido a 1920x880 con
`scrollY = 302`: el elemento en `y = -302`, con su `top: 0` puesto y aplicando.

- **Si necesitas recortar un eje, recorta en el elemento que ya scrollea**, no en el
  documento; o usa `overflow-x: clip`, que no crea contenedor de scroll.
- ⚠️ **Y UN `sticky` CON z-index CREA UN CONTEXTO DE APILAMIENTO, y le clampea el z-index a
  todo lo que nazca adentro.** Un modal montado desde una barra pegada declara su
  `zIndex: 150` y se dibuja igual DEBAJO de cualquier cosa con z mayor, porque ese 150 se
  resuelve contra el 20 del sticky y no contra la página. No da error y no hay nada en el
  código que lo explique. Va con `createPortal` al `body`. Medido el 04/10/2026 con el
  pop-up de prioridad abierto desde la barra de lote del tablero.
- ⚠️ **Y el corolario al escribir: un `sticky` va AFUERA de la caja que recorta.** Mordió de
  nuevo el 04/10/2026 con la barra de lote de las tablas del plan, que vivía adentro de un
  contenedor con `overflow-x: auto`. Ese contenedor nunca scrollea en vertical —crece con su
  contenido—, así que el sticky se posiciona contra algo que no se mueve y queda clavado
  igual que antes, **con el `position: sticky` puesto y sin un solo error**. Antes de
  escribirlo, caminá los ancestros hasta el primero con `overflow-y` en `auto`/`scroll` y
  preguntá si ÉSE es el que la persona scrollea.
- **Y verificalo SCROLLEANDO.** Con `scrollY = 0` un sticky roto se ve igual que uno sano,
  asi que cualquier chequeo que no mueva la pagina da verde sobre algo roto. Esto se pago
  cinco veces seguidas sobre la misma pantalla.
- El detalle, con la cadena completa de arreglos que se causaron entre si, en
  [docs/hallazgos-conocimiento.md](docs/hallazgos-conocimiento.md) → «Cuando la pagina deja
  de scrollear».

# En una hoja GENERADA, lo escrito a mano va al final del archivo

Un generador que arma `cabecera + origen` pone tus overrides **antes** de lo que querias
pisar. Con la misma especificidad gana la ultima regla, asi que `!important` no alcanza y
el sintoma es «le pongo `!important` y no pasa nada». Va `cabecera + origen + COLA`.

Y adentro de la cola vale lo mismo que en el codigo: **una regla, un lugar**. Tres pares de
reglas propias se estaban contradiciendo en el mismo archivo; ganaba siempre la de mas
abajo, y la de arriba —la que tenia el comentario explicando el porque— mentia.

# Toda migración decide su ORDEN de despliegue, y el `.sql` lo dice en su cabecera

Son dos órdenes opuestos y elegir el equivocado no da error: da la pantalla genérica.

- **La que SACA algo** (un drop, un rename) va **después** del deploy. Mientras haya una
  versión desplegada que emita esa columna, dropearla hace que PostgREST rechace la fila
  ENTERA y falle cada guardado, con la pantalla ya pintada. Pasó el 26/09/2026 con la
  0167/0168 y duró minutos: «agregar → desplegar → sacar».
- **La que AGREGA algo que el código nuevo YA LEE** va **antes o junto** con el deploy. Es
  el caso de la 0170 (`funnels`): el mismo commit deja de leer la tabla vieja, así que entre
  un deploy sin tabla y la migración, el lector cae a su default y todo el mundo ve el
  embudo genérico. No se pierde nada y no hay un solo error.

Lo que hace fácil equivocarse es que el reflejo aprendido con la primera —«primero el
código»— produce exactamente el síntoma que la segunda venía a evitar. Por eso el orden va
escrito en la cabecera del `.sql`, que es lo que lee el que la aplica.

⚠️ **Y un backfill que le crea fila a TODOS invierte en silencio a todo el que cuenta
filas.** «¿Hay fila en esta tabla?» era la señal de «este cliente lo configuró»; después del
INSERT es verdad para los 9 workspaces. Antes de escribir el backfill, grepeá quién cuenta
filas ahí — la existencia dejó de ser información, y lo que distingue pasa a ser una columna
(acá `funnels.declarado`).

⚠️ **Y una VISTA no tiene RLS: lleva su `revoke` y su `security_invoker`, siempre.**
`alter table … enable row level security` no existe para una vista, y una vista corre con los
permisos de su DUEÑO — así que aunque las tablas de abajo tengan RLS, quien pueda hacerle SELECT
lee las filas de TODOS los workspaces. El molde que se copia de la tabla de al lado
(`enable row level security` + `revoke all`) deja afuera justo la mitad que ahí importa.

Y que el grant llegue o no **depende de quién aplique el DDL**, así que no se puede dejar al azar.
Medido en prod el 26/09: `v_cohortes_semanales` (vista, mig 0001) tiene hoy `anon=arwdDxtm` con
`security_invoker` apagado, leyendo `leads`; `funnel_config` y `productos`, aplicadas con el
`postgres` de `scripts/apply-migration.mjs`, tienen sólo `postgres` + `service_role`. Lo único que
mantiene afuera a las tablas nuevas es el revoke explícito.

```sql
alter view v_loquesea set (security_invoker = on);
revoke all on v_loquesea from anon, authenticated;
```

El servidor no cambia: lee con `service_role`, que tiene `BYPASSRLS`. Lo fija
`tests/funnel-declarado.test.ts`, que barre todas las vistas de `supabase/migrations/` con una
lista de excusas **por nombre de vista, no por archivo** — una misma vista se re-crea en varias
migraciones, y exceptuar un archivo dejaría entrar cualquier vista nueva escrita ahí.

# Lo que está OCULTO se deriva de lo que se DIBUJA, nunca se enumera al lado

Cuando una función parte una colección en «lo que se ve» y «lo que no», la segunda mitad
se escribe como filtro propio porque es lo que está a mano. Y entonces hay dos listas
contestando la misma pregunta: el día que un tipo cambia de lado, queda en las dos.

Medido el 04/10/2026 en `insertarPasoTras` (`lib/flujo-aviso.ts`). El ＋ del lienzo
inserta un paso y, para no perder lo que no se dibuja, hacía:

```ts
const vivos = pasosDibujados(pasos);
const otros = pasos.filter((p) => esInsistir(p) || p.tipo === 'esperar');   // ⛔
```

Ese mismo día `esperar` pasó a DIBUJARSE —porque pasó a ejecutarse— y quedó en las dos
listas: **cada inserción duplicaba todas las esperas**. Un click en «Delay» dejaba 3
tarjetas ⏳ donde había 1, y el siguiente 6.

⚠️ **Y `npm test` estaba en verde con 3064 tests.** Los tres tests que cuidan esa función
usan `insistir` como el paso oculto —mudados a propósito ese mismo día, justamente porque
`esperar` dejó de estar escondido— así que ninguna fixture tenía una espera adentro. Lo
delató la pantalla. La cura es una línea, y no puede divergir:

```ts
const otros = pasos.filter((p) => !vivos.includes(p));
```

El olor: un `filter` que repite, con otras palabras, la condición de la función de al
lado. Vale para cualquier «lo demás»: los nodos que no se dibujan, las filas que no
entran en la vista, los campos que no se editan.

# Una medida en píxeles adentro de una capa con `transform: scale(k)` NO es la que vas a ver

Todo lo que viva dentro de un contenedor escalado —un lienzo, un minimapa, un preview con
zoom— se dibuja `k` veces más chico. Un tamaño elegido para que se pueda APUNTAR (una zona
de hover, un botón, un handle de arrastre) deja de cumplir su promesa en cuanto el zoom
baja, y no hay error: hay un control que no se puede tocar.

Medido el 04/10/2026 en `app/_components/Lienzo.tsx`: la zona de hover del ＋ del medio de
una flecha se declaró en 28 px —gorda a propósito, porque un trazo de 1,6 px es imposible
de apuntar— y con el lienzo al 22% daba **6 px**, con su botón en 5. La cura es un `scale`
inverso con el zoom que la pantalla ya muestra, que lo deja igual a cualquier zoom.

⚠️ **Y LA MISMA TRAMPA INVALIDA LA VERIFICACIÓN.** Para apuntarle al medio de una flecha se
calculó `getPointAtLength(L/2)` + el `getBoundingClientRect()` del `<svg>`: el punto está
en unidades de usuario y el rect ya trae el `scale`, así que al 68% el resultado caía 81 px
abajo del lugar real. El chequeo dijo «el ＋ no aparece» sobre un ＋ perfectamente vivo, dos
corridas seguidas. **La posición de algo que vive en una capa transformada se LEE del DOM**
(`getBoundingClientRect()` del propio elemento), nunca se calcula a mano.

# Si una pantalla corre la vista para hacerle lugar a un panel, al cerrarlo la DEVUELVE

Correr el lienzo para que el panel de edición no tape el nodo que se está editando es
correcto y ya estaba escrito. Lo que no estaba es la vuelta: al cerrar el panel la vista
quedaba corrida, con la tarjeta de al lado cortada por el borde y ninguna pista de que
había más. Reencuadrar solo está prohibido a propósito —deshace el paneo que la persona
acaba de hacer— y por eso el lienzo no volvía nunca.

**Devolver no es elegir una vista: es deshacer la que eligió el código**, así que no choca
con esa prohibición. Con dos condiciones, las dos medidas: el `antes` se guarda UNA vez
(abrir un segundo nodo que necesite más corrimiento no puede pisarlo, o volver deja la
vista del nodo anterior), y no se devuelve si la persona paneó o hizo zoom en el medio —
esa vista es suya.

⚠️ **Y LA SALIDA QUE PARECE LA BUENA ES PEOR: achicar para que entren las dos cosas.** Se
escribió, con su test y su rotura. Medido: el lienzo de `/mensajes` tiene ~780 px, así que
con 484 de panel quedan ~300 y el zoom caía al piso (40%), con tarjetas ilegibles y sin
entrar igual. Mientras se edita manda el panel.

# Un arnés que rompe código a propósito restaura de MEMORIA, nunca con `git checkout --`

Probar un test rompiendo la pieza es la regla de esta casa, y el arnés que lo hace guarda
el original en memoria y lo reescribe al final. Agregarle un `git checkout -- <ruta>` «por
si acaso» es lo que lo vuelve destructivo: con dos sesiones sobre el mismo clon, ese
archivo casi siempre tiene trabajo sin commitear — y en el 04/10/2026 ese comando borró de
un saque DOS cambios míos sin commitear en `lib/lienzo-grafo.ts` (una función nueva con su
test y un tipo ampliado), sin ningún aviso: `git status` quedó limpio, que se lee como que
no había nada.

`git checkout -- <ruta>` está en este documento como la CURA de un caso muy puntual —el
árbol que quedó viejo tras un `git reset` sin `--hard`—, y fuera de ése es una pérdida de
trabajo. Antes de escribirlo: `git status --short` de esa ruta, y si está modificada, no.

# Arreglar un bug de CONTEXTO en una función: contá cuántas veces esa función pregunta

Cuando se arregla un «esto lee el workspace equivocado» —o la zona horaria, o el tenant, o
la sesión— el reflejo es envolver la línea que falló. Y si la función hace la MISMA
pregunta en otro lado, queda medio arreglada: la mitad buena le da cobertura a la mitad
rota, porque el síntoma grande desaparece.

Medido el 04/10/2026 en `emitirDelCatalogo` (`lib/avisos.ts`). En septiembre se arregló
que el INTERRUPTOR de un aviso se leyera en el workspace del aviso y no en el ambiente,
con su comentario de ocho líneas y su test. En la misma función, **dos líneas más abajo
del comentario**, el TEXTO seguía resolviéndose afuera: un cron que itera inquilinos
pasando `ws` explícito —así llaman todos— le mandaba a cada cliente **el texto del
DUEÑO**, con el interruptor del cliente respetado justo arriba. Y el TÍTULO salía del
catálogo de fábrica, así que renombrar un mensaje no se veía en el feed ni en el asunto
del correo.

- **Contá las lecturas del mismo store en esa función, y dejá UNA.** Acá eran tres
  (`plantillaActiva`, `referenciaPlantilla`, `cat.titulo`) y ahora es un `getPlantilla`:
  una sola no se puede desincronizar consigo misma.
- **Y el guard mira las DOS mitades**, no la que se arregló. El que existía fijaba
  `runWithWorkspace(ws, () => plantillaActiva(id))` — o sea exactamente la línea buena,
  mientras la de al lado estaba mal y en verde.

# Una regla de admisión que nadie puede cumplir no protege: se MIDE y se reescribe

Un comentario que dice «acá sólo entra lo que no cuesta nada» envejece de la peor forma:
el código lo desobedece de a poco, nadie lo nota porque la regla sigue escrita, y el día
que alguien la toma en serio bloquea trabajo legítimo.

Medido el 04/10/2026 en `lib/variables-aviso.ts`. La regla decía «cero queries nuevas,
cero proveedores» y el resolvedor hacía **dos lecturas a Supabase** el día que se
escribió. Con la vara literal, casi todo el CRM quedaba afuera del catálogo de datos de
un mensaje — que era exactamente lo que el dueño había pedido.

La que quedó, y protege lo mismo: **una lectura por ENTIDAD que el texto NOMBRA, y sólo
si la nombra. Cero proveedores.** Lo que la regla vieja cuidaba era el webhook con
`maxDuration` esperando 900 ms a Meta, no un `select` indexado por id.

- **Antes de ampliar un catálogo, releé su regla de admisión y comprobá si el código la
  cumple.** Si no la cumple, la regla ya no es la regla: es documentación de una
  intención.
- **Y la nueva se escribe con el mecanismo que la hace cierta**, no en prosa: acá es
  `necesitaFichaDelLead(texto)`, que decide mirando los tokens que el mensaje trae de
  verdad.

# Un dato EXACTO que viaja con un trabajo diferido es la FOTO de cuando se guardó

Pasar los valores por código en vez de dejar que un modelo los transporte es la regla de
esta casa, y está bien. Lo que esa regla no dice es qué pasa cuando el trabajo no sale
ahora: un monto, un contador de días o un «hace cuánto» guardados en el contexto de una
corrida que despierta en 48 horas siguen siendo exactos **respecto del momento en que se
guardaron**, que ya no es el momento en que alguien los lee.

Medido el 04/10/2026 escribiendo la cobranza por WhatsApp: el cron pasa el número, el
monto, el vencimiento y los días de atraso de la cuota; los recordatorios salen 48 y 120
horas después. `{{cuota_dias}}` guardado diría «1 día» sobre un atraso de cuatro, con la
autoridad de un dato puesto por código.

- **Al guardar datos para un paso diferido, partilos en los que ENVEJECEN y los que no.**
  Número, monto y fecha de vencimiento no envejecen; «hace cuánto» y «cuánto falta», sí.
- **Lo que envejece se usa sólo en el mensaje que sale AHORA**, o se vuelve a calcular en
  el momento del envío.
- **El olor:** un valor que es una resta contra `hoy`. Si se puede escribir como una
  cuenta con la fecha de hoy adentro, es una foto.

# El WhatsApp del chatbot es el NO OFICIAL: ni ventana de 24 h ni plantillas aprobadas

Decisión de Martín, textual (05/10/2026): **«olvidate de WhatsApp oficial, no entiendo de
dónde lo sigues sacando, si todo esto es para la no oficial»**. Vale para el editor de
flujos, los recordatorios, `/chatbot` y todo lo que ese editor produzca.

El producto habla WhatsApp por DOS caminos y se parecen sólo en el nombre:

| | la línea de MaKo / el chatbot | el canal del CRM de algunos clientes |
|---|---|---|
| Qué es | Evolution: un WhatsApp Web automatizado | WABA oficial, vía Chatwoot |
| Ventana de 24 h | **no existe** | existe: fuera de ella sólo plantillas aprobadas |
| Plantillas aprobadas | no hay, y no hacen falta | hay que registrarlas en Meta |
| Botones / listas interactivas | no | sí |
| El riesgo real | que **baneen la línea** | que Meta rechace el mensaje |

Lo que se sigue de eso al escribir código nuevo del editor:

- **No se escribe un gate que cuelgue de la ventana de 24 h.** Un botón apagado por una
  regla que no rige ese canal es un control que no funciona por una razón inventada, y es
  más caro que no tener el control.
- **Lo que protege a una línea no oficial es el RITMO y el CONTENIDO**, no una API: no
  mandar cientos de mensajes idénticos, no escribirle primero a quien nunca escribió, no
  disparar en ráfaga. Si hay que poner un límite, ése es el que importa.
- **Y antes de copiar una regla de «WhatsApp», preguntá por qué CONEXIÓN sale ese
  mensaje.** La mitad de lo que se lee sobre WhatsApp Business API no aplica acá, y la
  otra mitad aplica sólo en el CRM de los clientes que tengan WABA.

⚠️ Esto NO borra la pared de 24 h donde sí existe: el panel de borradores del CRM la mira
con razón (`lib/ventana-24h.ts`). Lo que la decisión fija es el ALCANCE — son dos canales,
y el del chatbot no es el oficial.

**Y el Chatbot es SÓLO WhatsApp: Instagram se sacó del producto el 06/10/2026** (decisión de
Martín, «C: sacar la tab»: 0 DMs y 0 publicaciones en toda su historia). Se borraron la tab,
su bandeja, su programador, el puente de los DMs al setter y sus 21 operaciones de la API de
MaKo; `/instagram` redirige a `/chatbot` y el webhook de Zernio contesta 200 sin procesar
nada. Las tablas quedan. Sumarle un canal al Chatbot es una decisión del dueño, no un
arreglo: `tests/sin-instagram.test.ts` falla si algo vuelve a cablear Instagram.

**Y Chatwoot (el WhatsApp OFICIAL) está APAGADO desde el 09/10/2026** (Martín: «que no exista
más. Guardalo en privado»). Un interruptor en `lib/chatwoot.ts` (`CHATWOOT_APAGADO`) corta toda
llamada en `cfg()`; el código dormido sigue en 122 archivos y entero en la etiqueta de git
`archivo/chatwoot-2026-10-09`. **Código nuevo no usa Chatwoot**: el WhatsApp es Evolution.
`tests/sin-chatwoot.test.ts` falla si se prende sin decidirlo.

# Evolution le BORRA un dígito a los números de Argentina y México: un número que dio WhatsApp viaja como jid

Su `createJid` (2.3.7, `formatMXOrARNumber`) agarra todo número de 13 dígitos que empiece con
52 o 54 y le saca el TERCERO: `5491125052605` sale como `541125052605`, `5215512345678` como
`525512345678`. WhatsApp conoce a esos números con el dígito puesto (el `ownerJid` de una línea
argentina es `549…`), así que el pedido va a OTRO número — y no da error: da un `403`
(`addressable: false`) adentro de un 201, sobre un jid que no es el que mandaste.

Medido el 07/10/2026 en la primera mudanza de MaKo a su número nuevo: «Quedó admin en 0 de 6
grupos». El lector buscaba la fila por la forma exacta, no la encontraba, y el 403 se contaba
como éxito.

- **Un número que dio WhatsApp** (un `ownerJid`, el jid de `whatsappNumbers`) **se manda como
  jid completo**: `jidCanonico` (`lib/participantes-grupo.ts`). Evolution devuelve intacto todo
  lo que ya trae `@s.whatsapp.net`.
- **Lo que tipeó una persona NO** (puede traer un 0 o un 15 de más): ése va crudo, o se
  canoniza antes con `whatsappNumbers`.
- **Y al leer la respuesta, la fila puede volver con la otra forma**: `leerResultados` busca
  las dos.
- ⚠️ **NO MEDIDO para el envío de texto** (`sendText` con el número crudo pasa por el mismo
  `createJid`). Para México llegan (salieron mensajes del ws1 a números 521…); para Argentina
  no se probó.

# Un negocio tiene VARIAS líneas de WhatsApp: por cuál sale un mensaje lo decide `elegirLinea`

Desde el 06/10/2026 (`0936f1da`, migs 0198+0199) `evolution_instancias` tiene N filas por
workspace. Mandar por la línea equivocada es mandar desde el WhatsApp de OTRO número — o de otro
cliente —, y no da error: el mensaje sale.

- **Todo camino nuevo que mande, lea o conecte por el no oficial recibe una `linea` y la pasa a
  las funciones de `lib/evolution.ts`**, que la resuelven con `elegirLinea`
  (`lib/lineas-whatsapp.ts`, pura y con test). Sin `linea`, la de por default. Nunca se deriva
  el nombre del workspace (`instanceNameDeWs(ws)` sólo existe como respaldo de lecturas sin
  línea pedida), y nunca se elige «a mano».
- **Una línea pedida que no es del negocio, o que ya no está, NO manda y NO cae a la de por
  default.** Elegir otra que la pedida es mandar desde el número equivocado sin que nadie lo vea.
  El motivo vuelve como el error del envío.
- **Lo que tiene un destinatario guarda su línea**: la secuencia (`nutricion_secuencias.instance_name`),
  el borrador (`wa_borradores.instance_name`), cada fila del espejo. Un borrador que nombra su
  línea sale por ella o falla — no se re-apunta ni cae al oficial.
- **Una respuesta va por la línea a la que la persona escribió**, no por la de la secuencia ni
  la de por default: es el número que esa persona conoce.
- **Un link a un chat lleva la línea del chat** (`&linea=`), y una caché de la bandeja lleva la
  línea en la clave. Las dos cosas se olvidaron en la primera versión y las cazó la revisión.
- **El nombre de una línea nueva nunca se reusa** (sufijo al azar): el espejo de una línea
  quitada se queda, y un nombre reusado lo hereda.

# Lo que una persona aprueba por id no cambia bajo ese id: reemplazar es descartar y crear otro

Un borrador, una propuesta, una pendiente: si la pantalla manda «Enviar» o «Aprobar» con el ID y
el server ejecuta lo que la fila tiene AL HACER CLIC, pisar el contenido de esa fila hace que la
persona apruebe algo que no leyó. Medido en la revisión del 06/10/2026 sobre el borrador del
setter: el dueño mira la respuesta A, el lead escribe de nuevo, la fila pasa a decir B —quizás una
despedida— y el clic manda B. Es «un canal propone y una persona confirma» roto sin que nada falle.

- **Reemplazar = pasar la fila vieja a 'descartado' e insertar otra con id nuevo.** El clic sobre
  la vieja contesta «ya no está pendiente» y la pantalla muestra la nueva. Molde:
  `guardarBorradorSetter` (lib/evolution-envio.ts).
- **Y si un índice único limita a una pendiente por sujeto, se descarta ANTES de insertar**; el
  `23505` de dos escrituras en paralelo se resuelve con una vuelta más, no pisando.
- **La alternativa, si la fila tiene que conservar el id**: que el cliente mande lo que vio (el
  texto o su `updated_at`) y el claim lo exija en el `WHERE`.
- ⚠️ **Y vale para un ARCHIVO: la ref nombra lo que se VIO, no el casillero donde estaba.** Medido
  en la revisión de la #797 (07/10/2026): «Mis creativos» mandaba `toma:<plan>:<n>` y el server
  subía lo que esa toma guardara al hacer clic; si se volvía a filmar en el medio, a Meta iba otro
  video que el de la miniatura. La ref lleva el clip (`toma:<plan>:<n>:<op>`) y si cambió es un 409
  — con la lista vuelta a pedir, o «vuelve a elegirla» no tiene salida. Molde: `tomaPedida`
  (lib/creativo-mako.ts).

# Una clave de idempotencia sale de la FIRMA de lo que se manda, y cambia cuando eso cambia

Lo que crea algo afuera y puede perder su respuesta —publicar en Meta, mandar, cobrar— lleva
una clave que el server guarda ANTES de crear, y un pedido con una clave ya usada contesta desde
esa fila. El duplicado real no es el doble clic: es la respuesta que se pierde (un 504 a los
300 s, la pestaña cerrada) con el borrador intacto, que se vuelve a mandar igual.

- **Mismo payload → misma clave; payload distinto → otra.** Después de un parcial conocido el
  cliente RECORTA lo que ya entró y reintenta; con la misma clave, el server contestaría «creados
  N» desde la fila vieja y el cliente recortaría N más que nunca se crearon. Molde:
  `claveParaPayload` (lib/meta-idempotencia.ts), que compara la firma y no un evento de la pantalla.
- ⚠️ **Salvo la clave que quedó SIN RESPUESTA: ésa queda ABIERTA y manda sobre la firma hasta
  que el server la cierre** (un ok, un «a medias», un parcial). Después de un 504 la pantalla deja
  editar, y corregir una palabra acuñaba otra clave: el server, sin fila para ella, creaba una
  SEGUNDA campaña (revisión de la #59). Mandar la abierta con otro payload es seguro —el server
  contesta desde la fila si algo se creó y publica lo nuevo si no—, pero esa respuesta puede hablar
  del payload de ANTES: no se pinta como éxito de lo que está en pantalla ni se le recorta. Vive
  FUERA del componente: en un ref, cerrar y reabrir el modal la perdía. Molde: `claveAMandar` /
  `trasRespuesta` + `claveAbierta` (app/ads-manager/creativeUpload.ts).
- **La fila es lo único que lee un reintento, así que los persist TERMINALES reescriben todo lo
  que hay en memoria**: los intermedios tragan su error. Y un rollback cuenta sólo si el proveedor
  CONFIRMÓ el borrado — «(revertido)» sin confirmar es lo que hace crear otra encima.
- **La regla de reintento depende de quién escribió la fila**, y puede haber dos para la misma
  tabla: en una campaña `meta_campaign_id` es lo que ESE pedido creó; en un lote es la campaña que
  ya existía. Aplicar la de la campaña al lote deja trabado para siempre un lote que no creó nada.
- **Con clave, el registro es estricto** (sin base, no se crea nada: sin fila no hay cómo
  deduplicar), **y se abre DESPUÉS de los chequeos que pueden cortar**: una fila en 'creando'
  dejada por un 409 hace esperar al reintento legítimo.

# La cosecha: lo que aprende un subagente no vuelve solo

Cuando se despliegan subagentes, **lo único que llega de vuelta es el texto que
devuelven**. Todo lo que leyeron y razonaron se queda afuera. Las transcripciones sí
quedan en disco (`~/.claude/projects/<proyecto>/<sesión>/subagents/workflows/<runId>/`),
pero son megas de crudo que nadie va a abrir y que la próxima sesión ni sabe que
existen. En la práctica: lo que no se escribe, se pierde.

No es hipotético. Una corrida de 14 agentes sobre el formulario "¿Qué hacer ahora?"
encontró 13 problemas reales; los 5 que quedaron fuera de alcance sobrevivieron
únicamente porque se escribieron.

**Regla: toda corrida con subagentes termina escribiendo en `docs/hallazgos-<área>.md`.**

Un documento **por área**, no uno solo: `hallazgos-crm.md`, `hallazgos-plan.md`,
`hallazgos-ia.md`, `hallazgos-ads.md`, `hallazgos-landing.md`,
`hallazgos-comunicacion.md` (WhatsApp/email), `hallazgos-infra.md` (build, deploy,
Supabase, auth). El área es **dónde vive el código**, no de qué hablaba la tarea. Si
el hallazgo cruza áreas, va donde vive el código y se enlaza desde la otra.

Si el área todavía no tiene documento, se crea. `docs/hallazgos.md` es el índice: una
línea por documento, y se actualiza en el mismo commit.

Qué va ahí:

| Sí | No |
|---|---|
| Síntoma visto → causa real → dónde vive → la regla que queda | El changelog de lo que se hizo (ya está en el commit) |
| Las trampas del entorno: una API que devuelve vacío en vez de error, un límite que corta en silencio, un default que inventa un dato | Resúmenes de la corrida |
| **Cuándo el diagnóstico obvio era el equivocado** — lo que más tiempo ahorra después | Relleno |
| Lo que quedó SIN hacer, con el archivo donde vive | |

Una entrada por tema, se integra sin duplicar, se lee en 5 minutos. Si la lección
gobierna código nuevo (no es un hallazgo sino una regla), va acá en `AGENTS.md`, que
es lo que todos leen antes de escribir.

## Y el tercer destino, que es el que se olvida: el registro de `/admin/dev`

Los dos de arriba guardan **lo que aprendimos**. Falta **lo que Martín pidió**, y eso no
se deduce de ningún commit. Va a `app/admin/dev/<área>/bitacora.ts`, con el tipo `Hito`
de `app/admin/dev/_registro/tipos.ts`:

- Un hito **`tipo: 'prompt'`** con el campo **`pedido`**: el texto **literal** de Martín,
  sin resumir. La mitad de las reglas de esta casa salieron de una frase suya, y resumida
  se pierde el matiz que la hacía una regla.
- Y los hitos de lo que salió de ahí (`implementacion`, `investigacion`, `correccion`,
  `cosecha`), con sus `commits[]` y `archivos[]`.
- `fecha` y `hora` salen del commit, nunca del recuerdo. `cuenta` sale del marcador
  (ver «Hay dos cuentas»), nunca de una deducción.

⚠️ **Medido el 27/09/2026, y por eso esta sección existe.** Del 11/09 al 27/09 la cuenta 1
hizo **152 commits, 19 de ellos de cosecha**, y tocó 25 documentos de contexto
(`hallazgos-plan.md` 49 veces, este archivo 45). La cosecha se cumplió a rajatabla. En las
mismas 16 jornadas, las **39 bitácoras de `/admin/dev` sumaron CERO hitos**: ni un prompt,
ni una implementación. No fue desidia — **la regla de los hallazgos estaba escrita acá y
la del registro no**. Vivía en un comentario de `_registro/tipos.ts` y en una memoria, que
son dos lugares que nadie abre antes de commitear.

**La lección que generaliza, y vale para cualquier proceso de esta casa:** una regla que
no está en `AGENTS.md` **no existe** para una sesión nueva. No alcanza con acordarla con
Martín, ni con dejarla en una memoria, ni con escribirla en el comentario del módulo que
la implementa. Si depende de que alguien se acuerde, en dos semanas no se cumple — y el
modo de falla es silencioso, porque el trabajo sale igual y lo único que falta es el
rastro de quién lo pidió y por qué.

# El default de un refutador es parte de la PREGUNTA, no de su rigor

Un panel adversarial se calibra con una frase: «por default `refutado: true`; sólo `false`
cuando fuiste al código y confirmaste que no queda nada». Eso es correcto para una afirmación
CARA y difícil de revertir —«esto ya está hecho, ciérrenlo»— y es la vara equivocada para
cualquier otra cosa.

Medido el 25/09/2026 sobre el tablero: un mismo refutador recibió dos clases de afirmación
mezcladas, «cerrar esta tarjeta» (fuerte, irreversible) y «este título promete otra cosa de la
que queda» (débil, reversible, y que ni siquiera pregunta si está hecho). Resultado:
**80 refutados de 87**, incluidos 54 de 57 títulos — el barrido entero quedaba en nada. Una
tercera pasada con la pregunta correcta devolvió 35 reescrituras, 22 títulos intactos y **cero
cierres nuevos**: el refutador tenía razón en lo suyo y estaba contestando otra cosa en el resto.

- **Un refutador por CLASE de afirmación.** Si un lote mezcla dos, se parte en dos.
- **El síntoma, en dos minutos:** una tasa de refutación arriba del 80% no es rigor, es una vara
  mal puesta. Mirá qué clase de afirmación entró por la puerta.
- ⚠️ **Y el trabajo del refutador no se tira con su veredicto.** Las refutaciones traen la
  medición más cara de la corrida (archivo:línea, la puerta que falta, el caso que no cubre) y
  eso vive sólo en el transcript de un agente. Cosechar no es guardar el veredicto: es guardar
  lo que se midió para llegar a él.

## Y un agente no distingue «inventado» de «decidido hace una hora»

Es la otra mitad de «un agente no distingue "nunca estuvo roto" de "se arregló hace una hora"»,
y es peor porque suena a integridad. Un refutador escribió, textual: *«La cita del auditor no
aparece en ninguna parte del repo: grep sobre docs/ da CERO resultados. Es una afirmación, no
evidencia.»* Tenía razón sobre el repo y estaba equivocado sobre la autoridad: la frase salía de
una decisión que el dueño había tomado esa misma mañana.

- **El contexto que les pasás viaja con su PROCEDENCIA** —qué audio, qué fecha, qué pregunta
  contestó el dueño—, no sólo con su contenido. Sin eso, un agente escrupuloso lo trata como una
  alucinación y lo tumba con buenos argumentos.
- **Una refutación que ataca la decisión del dueño se REPORTA, no se ejecuta.**

## Y tu propio documento de contexto te gobierna a vos

El archivo que escribís para que todos los agentes midan contra lo mismo es una fuente, y te
aplica. El 25/09 enumeré 24 proyectos «fuera de fase» en una pregunta al dueño, entre ellos
«VSL Generator»; él contestó «todos a BAJA»; y más tarde subí ese mismo proyecto leyendo un
audio. **Lo cazó un agente citando mi propio documento.** Si no lo hubiera cazado, quedaba una
decisión del dueño revertida en silencio por una lectura mía. Con la duda se pregunta, no se
resuelve.

## Un agente no distingue «nunca estuvo roto» de «se arregló hace una hora»

Un subagente lee el código de **ahora**. Si un hallazgo escrito ayer describe un bug que se
arregló esta mañana, lo va a reportar como **«el plan arranca de una premisa falsa»** — que es
la conclusión más cara posible, porque invita a descartar un diagnóstico correcto y a rehacer
el análisis desde cero.

Pasó el 2026-08-10: una corrida de 11 agentes devolvió «dos correcciones de hecho» diciendo que
`upsertProducto` sí escribía `orden` y que `seedProductosDesdeOferta()` sí tenía call-site, y
que por lo tanto los hallazgos de `docs/hallazgos-onboarding.md` y `docs/hallazgos-crm.md`
estaban viejos. Las dos cosas eran ciertas **porque el commit anterior de esa misma sesión las
había cableado**, dos horas antes.

**La regla, para las dos puntas:**

- **Al escribir un hallazgo**, fechalo. Los documentos de `docs/hallazgos-*.md` ya cierran cada
  entrada con la corrida que la produjo; eso es lo que después permite cruzarla con `git log`.
- **Antes de declarar viejo un hallazgo**, `git log -1 -- <archivo>`. Si el último commit que
  lo toca es posterior al hallazgo, no está viejo: está **arreglado**, que es otra cosa y se
  reporta distinto.
- **Al lanzar la corrida**, decile qué acabás de tocar. Un agente que sabe que F0 se commiteó
  hace una hora no gasta un reporte en descubrirlo.

⚠️ **Y SI IMPLEMENTÁS MIENTRAS LA CORRIDA LEE, sus veredictos se van a contradecir entre
sí — y no es un error de ellos.** Medido el 28/09/2026: mientras 5 lectores relevaban las
tres implementaciones del detalle, yo escribía la unificación en el mismo árbol. Los
lectores describieron HEAD correctamente («`workspaces` no tiene columna de portada»,
«/api/admin/workspaces acepta CUATRO acciones») y los refutadores, que corrieron después,
leyeron el disco y las **refutaron con razón** — dos de las tres refutaciones de la corrida
fueron contra trabajo mío sin commitear. Los dos lados tenían razón sobre momentos
distintos.

No es gratis: se pagan agentes para descubrir lo que uno acaba de escribir, y queda un
informe donde no se distingue «esto estaba mal» de «esto ya lo arreglé hace diez minutos».
Las dos salidas, y la primera es mejor:

- **Esperar el relevo antes de tocar el área que se está relevando.** Lo que sí se puede
  hacer en el medio es lo que la corrida no mira (otra área, la migración, los tests).
- **Si igual hay que avanzar, decírselo al refutador en el prompt**: qué archivos están
  modificados sin commitear y que compare contra `git show HEAD:<archivo>`, no contra el
  disco. El refutador de esta corrida lo dedujo solo —corrió `git status` y lo escribió en
  la corrección— pero eso fue suerte, no diseño.

## Un panel de agentes al que le preguntas por una decision YA TOMADA siempre trae un argumento en contra

Un jurado de N agentes que evalua una opcion produce criticas: para eso se lo llama. Si lo
que se le pone a votar es algo que el dueno ya decidio, va a devolver un argumento en
contra —bien escrito, con su porque— y ese argumento **no es evidencia**: es el output que
la pregunta pedia. Cambiar la decision del dueno por eso es reemplazar a quien tiene el
contexto por quien tiene la retorica.

Costo dos rondas de rediseno del mismo wizard, en la misma semana:

- La regla **«un solo paso a la vez, cosas grandes, casi sin texto»** se sometio a un panel
  de diseno que la penalizo — cualquier jurado castiga a un wizard frente a una pantalla
  densa, porque cuenta clicks y no cuenta comprension. El dueno tuvo que repetirla.
- La frase **«Asi se vera tu anuncio»**, que el habia escrito textual en su pedido, la
  saco una ronda de rediseno con un argumento propio (le prometia al usuario que ese video
  era el suyo). El argumento tenia sentido y aun asi estaba mal, y al sacarla la pantalla
  se quedo sin la unica linea que decia para que servia la pieza. Lo reporto de nuevo.

**La regla: lo que el dueno decidio es una RESTRICCION del problema, no una opcion del
espacio de soluciones.** Al panel se le pregunta *como cumplirla mejor*, nunca *si
conviene*. Y si un agente igual devuelve un argumento en contra —va a pasar—, eso se
REPORTA como observacion, no se ejecuta: la decision de cambiar de opinion es de quien
tomo la decision.

⚠️ **Y el copy que el dueno escribio en su pedido se usa TEXTUAL.** Que suene mejorable no
es motivo: el sabe a quien le habla. Si de verdad ambiguo, se DESAMBIGUA agregando —acá
fueron dos rotulos, uno diciendo para que sirve y otro aclarando de quien es el video—, no
se reemplaza.

## Un agente no puede validar el dato que VOS le pasaste: te lo devuelve confirmado

Cuando le das a un subagente un volcado en vez de la fuente, tu error de medición viaja
adentro y vuelve con la autoridad de una conclusión ajena. No hay forma de que lo cace: para
él, tu archivo **es** el mundo.

El 30/08/2026 el volcado de material de 13 cursos se armó con `/grupo: '([^']*)'/g`, que
**también matchea adentro de `subgrupo: '`**. Los agentes vieron módulos y secciones
mezclados, y uno reportó como contradicción que MasteryHaus declarara «12 módulos»
teniendo 47. Bien medido tiene 12: los 47 eran mi regex. El barrido que hice sobre los 91
cursos con la misma regex dio **15 rotos, los 15 falsos**.

- **Antes de volcar, verificá el volcado contra UN caso conocido.** Abrir el curso en
  pantalla y contar los módulos de la barra cuesta un minuto y descarta la clase entera de
  error.
- **Y si un agente reporta una contradicción en TU archivo, la primera hipótesis es el
  archivo.** Es más barato de comprobar que la conclusión, y es la que más veces gana.
- El corolario del pedido: pedile la CITA, no el número. Una afirmación con su frase
  textual al lado se puede verificar contra la fuente; un conteo, no.

## Un cruce que no encuentra nada no está diciendo que no esté

Todo enganche entre dos sistemas —nuestro slug contra el `slug` de un proveedor, un id
contra un nombre de archivo, un email contra una fila— falla en silencio y con la misma
cara que el vacío legítimo. **Cero resultados es una respuesta, no un hecho.**

- **Contá cuántos NO cruzaron y andá a mirar tres a mano.** Si el cruce está roto, se ve en
  el primero. `scripts/curso-categoria-portada.mjs` daba 13 cursos «que no están en la
  plataforma»: nueve estaban, y tres con el título idéntico carácter por carácter.
- **Si el índice tiene N claves, consultalo con las N.** Ese índice se armaba con slug Y
  título y los tres call-sites preguntaban sólo por slug — la mitad no se leyó nunca. Un
  `Map` al que no le preguntás no se queja.
- ⚠️ **Y cuando dos síntomas de áreas distintas aparecen juntos, buscá la función que
  comparten antes de arreglar los dos.** Ese mismo cruce decide la categoría, la tapa y la
  descripción, así que el bug se reportó como «hay muchos que no tienen portada» —un pedido
  de UI— y como «faltan descripciones». Era uno solo.

## El dato de un tercero describe SU producto, no nuestra copia de él

Copiar un campo de un proveedor —una descripción, un temario, una duración— trae también
sus promesas, y nuestra copia casi siempre es parcial. Dos de las nueve descripciones que
se recuperaron del catálogo de origen prometían material que acá no está: «un módulo de
macroeconomía con el economista Juan Odar» (aparece una vez en 630k caracteres, y es la
recomendación de un curso ajeno suyo) y «clases en vivo, comunidad y acompañamiento» (cero
menciones de las dos últimas en 370k).

**Que el texto sea un dato no lo hace cierto sobre lo que nosotros publicamos.** Antes de
mostrar un campo ajeno, buscá cada cosa que promete en el material que sí tenemos, y
recortá lo que no esté — dejando escrito al lado qué se sacó y por qué, o el próximo lo
«arregla» devolviéndolo. Una promesa hueca no se descubre como un bug: se descubre como que
el producto miente.

⚠️ **Y verificá alerta por alerta antes de recortar.** De tres promesas marcadas en ese
mismo barrido, **una era falsa alarma** y recortarla habría empobrecido una descripción
correcta.

## Y para leerlos: grepeá la ruta, no abras el documento

**Antes de tocar un archivo, `Grep` su ruta en `docs/`.** Cada hallazgo trae adentro
la línea `**Vive en:** <archivo>`, así que buscar `lib/nutricion.ts` te lleva directo a
los tres que importan.

No es una preferencia de estilo, es plata: `docs/hallazgos-comunicacion.md` pasó las 500
líneas y abrirlo entero para encontrar una cosa son ~17.000 tokens, multiplicados por
cada vez que se abre el documento equivocado. Grepear la ruta cuesta dos órdenes de
magnitud menos y no falla por elegir mal el área.

Por la misma razón **no existe un índice inverso**: sería un segundo lugar donde vive el
mismo dato, y se quedaría viejo. La ruta ya está adentro de cada entrada — `Grep` **es**
el índice.

Los mismos documentos se leen con los ojos en `/admin/docs`, que los renderiza desde el
repo (no tiene copia propia, por la regla de arriba).

# Un filtro escrito en un comentario no filtra nada: va en el choke point

El 24/08/2026 se arregló un contador que trataba **cualquier evento que no fuera `pageview`**
como evento de video, y la corrida dejó escrita la regla en un comentario de 12 líneas:
*«un contador que se llama "eventos de X" se filtra por los tipos de X, nunca por todo menos
Y»*. Con lista blanca, con el caso medido, con todo.

El 25/08 el **mismo bug** apareció tres archivos más allá, produciendo el número que de
verdad se muestra: `avanceDe()` convertía los `segundos` de `salio`/`volvio`/`cierre` —tiempo
en la **página**— en porcentaje de retención del **video**. Medido en producción: 3.416 filas
con un avance inventado, un lead con `11,698379140239605 %` sin un solo `play`, y una landing
**sin video** reportando 30 espectadores a un prompt de Claude.

La regla estaba escrita. No estaba **aplicada donde se cruza la frontera**.

**Regla — cuando dos clases de dato viajan por el mismo canal y a la misma columna, el corte
va en la función por la que pasan las dos, no en cada consumidor.** Filtrar en los tres
llamadores deja la regla escrita tres veces y rompible la cuarta; y el que agrega el evento
nuevo no tiene por qué saber que hay un contador definido por descarte a tres archivos de
distancia. Un `!== 'play'` era correcto el día que se escribió y quedó viejo sin que nadie lo
tocara: **una lista de exclusiones crece sola y crece en silencio.**

Corolario al aplicarlo: revisá si el corte alcanza. En `avancePorPersona` no bastaba con que
el avance diera `null` — la persona entraba al mapa igual, y `.size` era lo que se contaba
como «espectadores». **Un valor nulo y una clave ausente no son lo mismo.**

# «No pude leer» es un tercer estado, y confundirlo con «no tiene» le miente al cliente

Todo lo que se afirma sobre una página ajena sale de bajarla por HTTP, y eso falla por
motivos que no tienen nada que ver con el cliente: el CDN sirve una copia vieja (medido:
`X-Vercel-Cache: HIT` con `Age` de casi 4 h), un chunk pasa el timeout, el host contesta 403
a un user-agent que no reconoce. **Un análisis vacío por un timeout es idéntico, en memoria,
a un análisis vacío porque la página está vacía.**

**Regla — al comparar el estado de algo que no controlamos, la lectura fallida no escribe ni
anuncia nada,** y la comparación es **asimétrica**:

- **Aparece algo → se cree a la primera.** Un `<video>` no se alucina, y si se equivocara se
  corrige solo en la lectura siguiente.
- **Desaparece algo → hacen falta dos lecturas buenas seguidas,** y mientras tanto sigue
  contando como presente.
- **La lectura falló → no se toca el estado guardado.**

No es prolijidad: «te sacaron el video de tu landing» disparado por un chunk lento no es un
aviso equivocado, es **el aviso que le enseña al cliente a ignorar todos los demás**.

# Una lectura que cae al DEFAULT sirve para dibujar, nunca para DECIDIR

Muchas lecturas de esta casa, cuando la consulta falla, devuelven el valor por defecto en vez
de tirar — y está bien, porque la pantalla tiene que dibujarse igual. El problema aparece
cuando la MISMA función la usa quien tiene que decidir algo: el default es un dato
inventado y la decisión se toma sobre él sin un solo error.

Medido el 06/10/2026 en Customer Success: `entregaDeProducto` devolvía las etapas de FÁBRICA
(onboarding, arranque…) con la lectura caída, y el choke point que mueve clientes validaba
la etapa destino contra eso. Una clienta del ws1 quedó en «onboarding», una etapa que su
producto —con nueve etapas declaradas— no tiene: el kanban no la dibuja y nadie se enteró.
El diagnóstico obvio («alguien borró la etapa en el editor») era el equivocado.

- **Que no haya fila sí es el default legítimo; que la lectura falle no lo es.** Son dos
  respuestas y la función tiene que poder darlas por separado (`null`, o tirar).
- **Quien valida antes de escribir, o decide a quién se le escribe, usa la versión
  ESTRICTA** (`entregaDeProductoEstricta`, `entregasDeProductos({ estricto: true })`). La
  tolerante queda para dibujar.
- **El olor:** una función de lectura con un `catch`/`if (error)` que devuelve un default, y
  un call site que con ese resultado hace un `insert`, un `update` o un envío. Es la misma
  familia que «No pude leer» es un tercer estado, del lado del que decide.

# Dos escritores con dos ritmos son dos claves

`landing.config` la escribe la persona desde un modal con read-modify-write del JSON
**entero**. Guardar ahí el snapshot que escribe un cron —el lugar obvio, porque el dato
«pertenece» a la landing— hace que un cron corriendo mientras alguien borra una página **le
devuelva la página borrada**, o le pise el `clarityProjectId` que acaba de cargar.

**Regla — antes de sumar un campo a una estructura que ya se persiste, preguntá quién más la
escribe y con qué frecuencia.** Si las respuestas no coinciden, va en su propia clave. El
costo de la clave nueva es un módulo de saneo; el de compartirla es perder datos del usuario
en una carrera que nadie va a poder reproducir.

Y si la clave nueva es un mapa keyeado por un dato derivado (una URL normalizada, un slug),
**las dos puntas tienen que derivarlo con la MISMA función**. Con dos normalizaciones el
cruce falla en silencio y se ve como «esto nunca se analizó» sobre algo que se analiza todos
los días.

# Enseñarle al sistema a VER algo nuevo no es un cambio del usuario, y el diff no lo sabe

Todo lo que compare «lo que hay hoy» contra «lo que había» —un snapshot, un inventario, una
lista de features detectadas— tiene DOS fuentes de cambio y las trata igual: que el mundo
cambie, y que nosotros hayamos aprendido a mirarlo. La segunda no es del usuario, y anunciarla
como si lo fuera le miente.

Medido el 11/09/2026: el snapshot de una landing decía `["botones","embed-agenda"]` porque el
analizador no sabía reconocer su reproductor. Al enseñarle, el VSL que ese cliente tenía desde
el principio aparecía como pieza NUEVA, y el aviso automático decía «Le agregaste un video a tu
página. Ya lo estoy midiendo» — falso dos veces, porque además no se medía hasta que él
reemplazara su copia del código. Con dos URLs declaradas para la misma página, dos WhatsApps.

**Regla — el estado guardado lleva la VERSIÓN del detector que lo produjo**, y lo que un
detector nuevo trae se incorpora **en silencio**: sin aviso, y quedando como parte del «antes»
para que un cambio real de esa misma pieza sí se anuncie a la vuelta siguiente. Tres cosas que
lo hacen funcionar:

- **El parser del estado tiene que CONSERVAR el campo.** Si reconstruye la fila campo por
  campo —lo normal en un saneador— uno nuevo que no se lea ahí vuelve ausente en cada lectura,
  y entonces el re-baseline se repite para siempre o no ocurre nunca, según el default.
- **El re-baseline no puede tapar un cambio real del mismo día.** Se absorbe solo lo que el
  detector nuevo introdujo; lo que ya se sabía ver se anuncia como siempre.
- **Y el aviso no promete lo que no puede cumplir.** «Ya lo estoy midiendo» salía para
  cualquier pieza nueva, incluidas las que el sistema NO puede medir: a quien sube un video a
  un host que no expone nada se le prometía una retención que no iba a llegar nunca.

# Un campo nuevo en un objeto que se guarda ENTERO se busca en TODOS los que lo escriben

Lo de arriba es el parser. El otro lado son los ESCRITORES: si un JSON se guarda completo
(la `estrategia` de una secuencia, un setting) y la API lo pasa por su parser, todo campo que
el cliente no mande vuelve en su default. Un campo nuevo que se agrega al tipo, al parser y a
UNA pantalla queda vivo hasta que alguien guarda desde OTRA — y ahí se apaga sin decir nada.

Medido el 17/09/2026 con `estrategia.envio_automatico` (si una secuencia le escribe sola a un
lead que no pagó): el perfil de la secuencia armaba el objeto a mano, así que **cambiar el
gancho apagaba el auto-envío**; el wizard de redacción, que reescribe la estrategia entera,
lo mismo. El typecheck no avisó: `{ ...est, x }` y los literales construidos desde otro
objeto pasan aunque falte el campo en la intención.

**Regla:** al agregar un campo, grepeá quién construye el objeto (`estrategia: {`,
`parseEstrategia(`, los spreads) y hacé que cada uno lo MANDE — lo edite o lo conserve con
`existente?.campo ?? default`. Y si el campo decide algo con consecuencias (mandar un
mensaje, cobrar), el default es el que no las tiene y solo un valor literal lo prende.
Ver `docs/hallazgos-comunicacion.md`, «La post-agenda "prendida"…».

# Un bloqueo derivado de una versión GLOBAL bloquea a todos, incluidos los que no ganan nada

Un guard que compara «versión instalada» contra «versión actual» y frena, frena a todo el
mundo el día que la versión sube — sin preguntar si a ese caso la versión nueva le cambia algo.
Y si el número que lee es de una unidad más grande que la que se está mirando (el workspace en
vez de la página), además miente en los dos sentidos.

Medido: el setting que guarda la versión del Pixel es del WORKSPACE y es «último evento gana»,
así que con dos páginas en versiones distintas el veredicto era verdad para una y mentira para
la otra. Al subir de versión, los cuatro clientes quedaban sin poder probar **ninguna** página,
incluida una a la que la versión nueva no le cambiaba nada.

**Regla — la condición se evalúa en la unidad que GANA algo, y con la versión de esa unidad.**
Si la unidad chica tiene su propia fuente (acá: la versión que viaja en cada evento de esa
página), se usa esa, tomando el **máximo** contra la global — la global puede estar más
adelantada cuando el cambio ya se hizo y todavía no llegó un evento nuevo. Y cuando la versión
nueva no le aporta nada a ese caso, el renglón lo **dice** y no frena: mandar a hacer un
trámite que no va a medir distinto es cómo se aprende a ignorar los avisos.

⚠️ **Y la versión de una página no se entera sólo por los eventos.** Desde el 06/10/2026 la
pregunta «¿hay que repegar el Pixel?» la contesta `estadoPixel` (`lib/pixel-estado.ts`): por
página (el mapa que anota el beacon en cada pageview) y, si las visitas dicen viejo, mirando lo
que la página SIRVE (`versionServida`). Con los eventos solos, a quien acababa de republicar se
le seguía diciendo «Actualiza el Pixel» hasta la próxima visita. Un consumidor nuevo de esa
pregunta llama a `estadoPixel`; no lee `landing.snippet_version`, que es del workspace y lo
escribe el último evento.

# Un arnés que no le pasa todas las entradas al código bajo prueba reporta una regresión que no existe

Verificar un cambio llamando a la función con menos insumos de los que recibe en producción
devuelve una diferencia REAL con el comportamiento anterior, y se lee como que el cambio rompió
algo. El 11/09/2026 una verificación mostró que una pieza detectada «había desaparecido»: el
analizador la detecta desde el JavaScript de la página y el arnés solo le pasaba el HTML. Diez
minutos de buscar un bug que no existía, con el riesgo peor de «arreglarlo».

**Regla — antes de creerle a una diferencia contra el comportamiento anterior, enumerá los
argumentos que la función recibe en producción y comprobá que el arnés le pase todos.** Y si
falta uno a propósito, la salida tiene que decirlo, o el próximo que lea ese output concluye lo
mismo.

# Un contador construido sumando sólo lo que aparece no puede decir CERO

Es el modo de falla más barato de escribir y el más difícil de ver leyendo:

```ts
const out: Record<string, number> = {};
for (const x of filas) out[clave(x)] = (out[clave(x)] ?? 0) + 1;
```

Eso cuenta bien lo que hay. Lo que **no** puede es distinguir «cero» de «no sé»: una clave sin
filas no entra al mapa, y el lector recibe `undefined`. Si río abajo alguien escribió
`if (n === 0)` —lo correcto— esa rama **no se ejecuta nunca**, y si escribió `if (!n)` trata
un error de lectura como un cero, que es peor.

Medido el 29/09/2026: el conteo de leads por etapa del CRM. El pedido era «si la columna no
tiene ningún lead, que no haya fricción al borrarla», la pantalla preguntaba `n === 0`, y la
fricción volvía **exactamente en el único caso donde no tenía que estar**. El código se ve
correcto y la feature no existe.

**La regla: un contador se inicializa con el UNIVERSO, no con lo que encontró.** Una línea
(`for (const k of todas) out[k] = 0;`) y `undefined` vuelve a significar lo único que debería
significar: no se pudo leer.

⚠️ **Y lo delató el navegador, no el código.** Es la misma familia que «un cero perfectamente
correcto sobre la pregunta equivocada»: nada falla, nada se loguea, y la única forma de verlo
es hacer la acción y mirar qué pasa.

# Deshacer una acción destructiva devuelve la MISMA identidad, no una igual

Un «Deshacer» que vuelve a llamar a la función de crear parece la implementación obvia y es
una trampa: **casi siempre acuña una identidad nueva**. El nombre vuelve, la fila vuelve, y
todo lo que apuntaba a la identidad vieja queda huérfano.

Medido el 29/09/2026 al sacar la fricción de «quitar una etapa» del CRM. Deshacer con la op
`agregar` habría devuelto una columna con el mismo nombre y una clave nueva — y la clave es
lo que ata un lead a su etapa. Los leads habrían quedado afuera del embudo con la columna a la
vista, que es peor que no deshacer: **parece que funcionó**.

La operación destructiva **devuelve lo que sacó** (la entidad entera y su posición), y hay una
op aparte que la vuelve a poner tal cual. Dos cosas más:

- **La op de restaurar es idempotente**: si la identidad ya volvió por otro lado, no duplica.
- ⚠️ **Y el payload del deshacer se declara FUERA del `try`.** Declarado adentro, el `return`
  de abajo no lo puede nombrar. Acá lo dice el compilador; en el puente a Flow la misma trampa
  de scope hizo que un campo que decidía plata fuera `undefined` y se le cobrara dos veces a un
  cliente, sin que nada avisara.

# Antes de optimizar una consulta, preguntá si hace falta hacerla

«Tarda mucho en abrir» se ataca mirando qué se pide, no cómo. Medido el 29/09/2026 sobre un
pop-up que «quedaba en cargando»: de las cuatro consultas del camino crítico, **dos
contestaban preguntas que ya tenían respuesta a mano** — un nombre que la pantalla ya dibuja y
viaja como prop, y un booleano que venía en la misma fila que el resto.

Y para la que sí hacía falta y era cara, la salida no es acelerarla: es **sacarla del camino
crítico**. La pantalla abre con lo que necesita para dibujarse y el dato caro llega después —
con un default SEGURO mientras tanto. Acá el dato era «¿cuántos leads tiene esta etapa?», y el
default seguro es preguntar antes de borrar: nunca borrar sin avisar porque el conteo todavía
no llegó.

⚠️ **PERO «DESPUÉS» NO ES «EN PARALELO»: LOS SERVER ACTIONS SE ENCOLAN.** Next.js los despacha
de a uno, así que mudar la lectura cara a una segunda action la pone DETRÁS de la primera, no
al lado. Medido el 29/09/2026 con un `fetch` instrumentado, desde el click: la primera sale a
+121 ms y vuelve a +439; la segunda sale a **+442** —3 ms después— y vuelve a +752. La suma
es peor que la única consulta de antes, y por eso sacar dos consultas del detalle bajó la
action de 550 a 250 ms **sin mover el tiempo hasta dibujar**: 1036 ms contra 1053.

⚠️ **Y ANTES DE PREGUNTAR, MIRÁ SI LA PANTALLA YA LO TIENE.** Lo que arregló ese caso no fue
una consulta más rápida: fue no hacerla. Las etapas que el pop-up iba a buscar ya estaban
dibujadas arriba, como las columnas del tablero, y viajan como prop desde el server en cada
carga. El pop-up abre pintando eso y el server confirma detrás: **941 ms → 167 ms**. Tres
condiciones para que no mienta:

- **El mapeo vive en UN lugar** y lo llaman los dos. Con dos copias, la pantalla abre
  mostrando una lista y medio segundo después muestra otra — que se lee como que cambia sola.
- **La foto se pasa sólo cuando es del MISMO sujeto.** Si el pop-up puede abrirse sobre otra
  cosa que la que la pantalla está mirando, pintar lo de al lado es mostrar el dato
  equivocado durante medio segundo, que es peor que el giro.
- **Lo que la pantalla NO sabe sigue esperando.** Una foto parcial pintada como si fuera
  completa afirma ceros: acá, las casillas de «cómo entra tu gente» vacías le dirían a un
  negocio que las declaró que no tiene ninguna.

⚠️ **Y un «Cargando…» escrito no es un loader.** Un texto no dice que algo está pasando: dice
que algo dice que está pasando. Va el giro, siempre.

# Un SQL escrito en un documento ES código, y se audita igual

Una receta de migración en un `.md` —con su `where not exists`, su orden de pasos y su
nota de cuándo re-correrla— no es una nota: es una instrucción con la autoridad del repo,
y el que la siga dentro de tres semanas no va a tener el contexto de por qué está mal.

Medido el 30/09/2026 en `docs/modelo-oferta-producto-funnel.md`: un
`update leads set funnel_id = …` listo para copiar. El tablero del embudo por defecto
busca los leads con `.is('funnel_id', null)` y **los 1.530 de los 6 workspaces lo tienen
en NULL**, así que correrlo dejaba el CRM en cero para todo el mundo — sin un error, sin
un log y sin una fila borrada. Nadie lo había corrido todavía; el documento lo esperaba.

**La regla: lo que se documenta como ejecutable entra en los guards.** Si un barrido busca
un patrón peligroso en `supabase/migrations/`, busca también en `docs/`.

⚠️ **Y el guard va con su PAREJA.** «Nadie rellena esta columna» sólo es peligroso mientras
el lector la interprete de cierta forma: si mañana el filtro deja de ser `.is(null)`, el
primer guard estaría prohibiendo algo inocente y nadie sabría por qué. El segundo guard fija
el lector. Los dos se leen juntos o ninguno de los dos se entiende.

⚠️ **Y un `add column if not exists … references` sobre una columna que YA existe no agrega
la FK: es un no-op silencioso** que deja creyendo que la restricción está.

# Para ganarle a 129 estilos inline, elegí una propiedad que ninguno use

Cuando una regla nueva tiene que aplicarse a un conjunto de elementos que escriben su
estilo en línea, la pregunta no es «¿qué quiero pintar?» sino **«¿qué propiedad está
libre?»** — un estilo en línea le gana a cualquier regla de hoja sin `!important`, y esta
casa ya lo pagó dos veces.

Medido el 30/09/2026 sobre «en todos los botones, si les paso el cursor debería pasar
algo»: de los **149 `<button>` de `app/crm/**`, cuatro reaccionaban** — y cada uno por un
mecanismo distinto. De los 145 mudos:

| propiedad | cuántos la escriben inline |
|---|---|
| `background` · `color` | **129** cada una |
| `border-radius` | 96 |
| `opacity` | 20 |
| `transition` | 2 |
| `box-shadow` · `transform` | **1** |
| `filter` · `outline` | **0** |

Un `:hover { background: … }` habría perdido contra 129 de 145. El velo va con
`box-shadow: inset 0 0 0 999px var(--token)`: pinta encima de cualquier fondo —azul, rojo,
crema o transparente—, respeta el `border-radius` que ya trae el inline, y no re-maqueta
nada. Contar cuántos escriben cada propiedad son treinta segundos y decide el diseño entero.

⚠️ **Y la regla va en el CHOKE POINT**, que acá es el `<main>` de cada ruta: es una regla
sobre un CONJUNTO («TODOS los botones»), así que la heredan los botones que todavía no
existen. Puesta con un `data-` por botón, cada botón nuevo dependería de que alguien se
acuerde — y en dos semanas no. Los caminos que NO pasan por ahí (un `createPortal`, un
hover inline propio) se enumeran en el comentario.

# Una verificación que no verifica es la otra mitad de un test que no prueba

Ya está escrito que «un test que no probaste rompiéndolo es una afirmación». El espejo, que
muerde igual: **una comprobación en el navegador que busca la cosa equivocada reporta que
la feature no está, y manda a arreglar algo que funciona.**

Medido el 30/09/2026 dos veces en la misma tanda:

- Un chequeo buscó `innerText === 'Nuevo lead'` y el botón dice `＋ Nuevo lead`: reportó
  **cero placeholders** sobre diecisiete que estaban dibujados.
- Una rotura de guard cambió `data-sin-filetes` por `data-sin-filetes-NO`, que el propio
  regex sigue matcheando: el archivo dio verde y por un momento pareció un guard flojo.

En los dos casos **la primera hipótesis correcta es la medición, no el código** — es más
barata de comprobar y es la que más veces gana. La señal: un resultado redondo e inesperado
(cero de diecisiete, 25 de 25) sobre algo que se acaba de escribir.

# Si lo que cambió es QUÉ EXISTE, se navega DURO: `router.refresh()` llega tarde

`router.refresh()` es para «los datos de esta pantalla cambiaron». Cuando lo que cambia es el
CONJUNTO del que cuelga la pantalla —qué embudos hay, qué workspaces, qué tabs— llega un paso
atrás, y lo que se ve es una acción que parece no haber pasado.

Medido el 29/09/2026 en el navegador, archivando un embudo desde el CRM con
`router.push('/crm') + router.refresh()`:

| Momento | La base | El selector |
|---|---|---|
| tras eliminar «Prueba 2» | `activo = false` | **sigue mostrándola** |
| tras recuperarla | `activo = true` | muestra la lista de ANTES de recuperarla |

Cuatro segundos de espera y `networkidle` no alcanzaron. **Un borrado que parece no haber
pasado es peor que uno lento**: la persona lo aprieta de nuevo, o concluye que la app está rota.

Va `window.location.href`, y con eso se paga la recarga entera — que es barata al lado de
mentir sobre algo destructivo. Dos cosas más:

- ⚠️ **Es la CUARTA forma de navegar, así que lleva `conWs(destino, useWs())`.** Sin el `?ws=`
  el super admin que está mirando a un cliente termina en SU propia pantalla — el mismo caso
  del reset del cliente de prueba del 16/08.
- ⚠️ **Y la URL puede haber dejado de resolver.** Si se archivó el embudo que el `?funnel=N`
  nombra, refrescar EN ESA URL deja a la persona mirando algo que ya no existe. Se navega al
  que siempre está.

**Y el corolario del efecto que se pregunta UNA vez:** un `useEffect` con `[]` que decide si
se dibuja la PUERTA DE VUELTA corre al montar y nunca más — o sea que la puerta se vuelve
invisible justo después de la única acción que crea algo para recuperar. Se re-pregunta
cuando cambia el dato que la justifica, no al montar.

# Si una fila de una tabla compartida pasa a significar OTRA cosa, cada LECTOR de la tabla decide

Agregar un sentido nuevo a filas de una tabla que ya tiene lectores —un post que es el hilo de una
clase, una tarea que es una plantilla, un campo que no se contesta— se piensa en la pantalla que lo
dibuja, y se escapan los lectores que NO dibujan. Medido el 08/10/2026 con los comentarios de clase
(`comunidad_posts.clase_id`): el feed y la búsqueda los sacaban, y la lista de posts para armar una
tarea «Comentar» y su verificación no — una tarea podía apuntar al hilo de una clase cerrada. Y el
«autor» del hilo (quien comentó primero) hacía que «sacar a un alumno con su contenido» se llevara los
comentarios de todos.

- **Se barren TODOS los lectores de la tabla** (`grep` del nombre de la tabla y de la columna) y cada
  uno decide si las filas nuevas le tocan, en positivo.
- **Y queda un guard que barre el repo**: cada consulta a la tabla nombra la columna o está en una lista
  de excepciones con su porqué, y una excepción que ya no corresponde a nada también falla. Moldes:
  `tests/curso-comentarios-clase.test.ts` y, para los campos `seccion`, `tests/curso-tareas-secciones.test.ts`.

# Retirar una RUTA es enumerar sus links y decidir el destino de cada uno POR SEPARADO

Cuando una pantalla se reemplaza por otra —un pop-up, una tab, una pantalla nueva—, el
reflejo es borrar el `page.tsx` y arreglar lo que rompa. Y lo que rompe no rompe: una ruta
retirada devuelve un 404, o peor, un redirect que deja a alguien en un lugar donde lo que
fue a hacer no existe.

Medido el 28/09/2026 al retirar `/funnel`: **ocho lugares la enlazaban y el destino correcto
NO era el mismo para los ocho.** Tres destinos distintos para una sola ruta.

- **Los que llevaban a lo que la pantalla nueva SÍ hace** → la pantalla nueva.
- **Los que prometían un control que la pantalla nueva NO tiene** → donde vive ese control.
  Acá eran dos botones que dicen «Activar la landing como entrada de leads», y esa casilla
  quedó en el editor completo, que hoy vive en una de once pastillas de otra tab.
- **Los que sólo existían para llegar a la ruta** (una sub-tab, un `match` del nav, un
  título) → se borran. Un destino que rebota no es un destino.

⚠️ **SE REDIRIGE, NO SE BORRA, si alguien de afuera la puede seguir.** Marcadores, avisos
de WhatsApp ya mandados, mails viejos y —el caso caro— el panel que ve el CLIENTE en su
propia landing. Un 404 ahí es peor que la pantalla vieja. El redirect va con `rutaConWs`,
y si la ruta vieja leía un parámetro con otro nombre, lo traduce.

⚠️ **Y UN LINK QUE PROMETE UN CONTROL TIENE QUE ATERRIZAR DONDE ESTÁ ESE CONTROL.** Si el
destino es una pantalla con tabs, el link lleva la tab (`?tab=`, leída en el server) o deja
a la persona buscando entre once pastillas una palabra que no conoce. Es la misma familia
que «un paso que nombra un botón que su pantalla no tiene»: la persona busca hasta que se
cansa y concluye que el producto está roto.

⚠️ **Y LOS COMPONENTES NO SE VAN CON LA RUTA.** Next sólo hace ruta de un `page.tsx`: lo
que el `page.tsx` montaba puede seguir donde está y seguir montándose desde otras pantallas.
Antes de mover o borrar un componente de esa carpeta, `grep` de quién más lo importa.

⚠️ **Y LA TERCERA ENUMERACIÓN: QUIÉN LEE LO QUE ESA PANTALLA ESCRIBÍA.** Al sacar Instagram
(06/10/2026) se buscó quién importaba la carpeta y quién enlazaba la ruta, y quedó viva una
fuente de KPI que contaba `contenido_posts` — filas que sólo escribía la tab borrada. Daba 0
para siempre y se ofrecía como KPI automático, o sea que nacía en rojo por un problema nuestro.
Las fuentes de KPI de Objectives son lectores de tablas de OTRAS áreas. Y el guard busca el nombre
de la tabla como CADENA: `.from('<tabla>')` no ve `contar('<tabla>')`.

**El guard que lo sostiene** barre `git ls-files app lib` y falla si alguien vuelve a
enlazar la ruta (`tests/funnel-estructura.test.ts` es el molde). Dos afinados que costaron
una vuelta cada uno y valen para cualquier guard que busque una ruta en el fuente:

- **Se busca una CADENA, no la palabra.** Un patrón que acepte la ruta rodeada de comillas
  **o de espacios** caza la prosa de los comentarios de medio repo: quince falsos positivos
  a la primera. El patrón exige que la ruta **arranque** una cadena.
- **Y se saltean las líneas de comentario**, porque la convención de la casa es nombrar una
  ruta entre backticks — o sea que el guard se acusa a sí mismo por los comentarios que
  explican que la ruta se retiró.

# Una ruta que apunta a la nada no rompe nada, y por eso es cara

Las rutas escritas a mano son el enganche de todo el sistema: el `**Vive en:**` de cada
hallazgo, el `vive[]` de cada área de `/admin/dev`, el `archivos[]` de cada hito. Ninguna
la mira el compilador. Cuando una queda vieja **no falla: desaparece en silencio**, y se
lleva con ella todo lo que colgaba de ahí.

Dos casos medidos, los dos de agosto de 2026:

- La regla de que **la sidebar no scrollea** estaba escrita, y se violó igual. Su
  `Vive en:` decía `lib/nav.ts`, un archivo que no existe desde el rediseño. Grepear la
  ruta real (`app/_components/nav.ts`) —el método que manda «Y para leerlos»— no devolvía
  nada, así que para cada sesión nueva esa regla no existía.
- El `vive[]` del área **Conocimientos** lista cinco archivos de `app/conocimientos/` y
  omite `public/cono-tx`, `public/cono-ugc` y los scripts del pipeline. Su panel de
  historial ve **11 de 68 commits**, y un barrido que preguntaba «qué se trabajó y no
  quedó anotado» declaró el área tranquila cuando era la más movida del mes.

**Regla:** al mover o renombrar un archivo, grepeá su ruta vieja en `docs/`, en
`app/admin/dev/areas.ts` y en los `bitacora.ts` antes de cerrar. Y al declarar un área, el
`vive[]` cubre **dónde cae el trabajo de verdad** —incluidos `public/`, `scripts/` y las
migraciones—, no solo los componentes de la pantalla.

`tests/dev-areas.test.ts` ya chequea contra el disco que cada ruta de `vive[]` exista, y
cazó 30 rutas plausibles pero inexistentes. Lo que NO puede chequear es la OMISIÓN: una
ruta que falta no da error, da un punto ciego.

**El barrido que SÍ ve la omisión pregunta por archivos, no por áreas.** «¿Qué área quedó
sin anotar?» siempre contesta tranquilo, porque un área que falta no se queja y una que
miente parece completa. La pregunta que encuentra el agujero es **«¿qué archivo caliente
no lo declara ninguna área?»**, y se contesta cruzando `git log --since=<fecha>
--name-only --format=''` contra la unión de todos los `vive[]`:

```js
const cubre = (f) => [...rutas].some((r) => r === f || f.startsWith(r.endsWith('/') ? r : r + '/'));
```

El 07/09/2026 eso destapó lo más grande: el **puente a Google Flow** —89 commits solo
sobre `extension/manifest.json` desde el 18/08— no existía como área, y `video-generator`
figuraba `por-construir` con 35 archivos adentro. Su conocimiento estaba cosechado
(`docs/hallazgos-generativa.md`, ~6.900 líneas); lo que faltaba era el índice que lo
encuentra. Cosechar y registrar son dos cosas: se puede escribir todo y que igual no se
encuentre.

# En Windows, TODO texto que cruza de una herramienta a otra trae `\r`

Un `\r` al final de una línea es **invisible en cualquier listado, en cualquier log y en
cualquier mensaje de error**, y no rompe: hace que la comparación dé false. El síntoma no
es una excepción, es **un cero perfectamente correcto sobre la pregunta equivocada** — que
es la forma más cara de equivocarse, porque se lee como un resultado.

El 27/08/2026 mordió **tres veces en el mismo día**, en tres lugares que no se parecen:

| Dónde | Qué pasó |
|---|---|
| La cola de cursos leyendo su lista | `C:/cursos/<curso>\r/plan.json` no existe → salteó los 12 cursos **en un segundo y salió con éxito** |
| El panel de estado | mismo archivo, misma lista rota |
| El barrido por categorías | `python` imprime CRLF → la categoría quedó `"Trading\r"` → «ENTRA: 0 · REBOTA: 0» sobre una categoría con 5 cursos |

**La regla: si un valor cruza de un proceso a otro por texto —un archivo de lista, la
salida de `python`/`node` leída por `sh`, un `read` de un `.txt`, una variable de entorno—
se limpia el `\r` EN EL QUE LEE, no en el que escribe.** El que escribe puede ser el
próximo script que alguien edite en el Bloc de notas, y ahí ya no controlás la punta.

```sh
d=$(printf %s "$d" | tr -d '\r')          # en un while read
CATS=$(python -c "…" | tr -d '\r' | tr '\n' '|')
```

Y al ESCRIBIR una lista que va a leer un `sh`, forzá LF: `writeFileSync` con `\n` explícito
o `io.open(..., newline='\n')` en python — el modo texto por defecto de python **traduce
`\n` a CRLF en Windows** aunque vos hayas escrito `\n`.

**Y el corolario que hizo que se encontrara rápido las tres veces:** los tres lugares
**avisaban**. «no tiene plan.json — lo salto», «ENTRA: 0», la lista vacía en pantalla. Un
proceso que no encuentra nada y termina con éxito tiene que decir **por qué** no encontró
nada: sin esa línea, «no había nada que hacer» y «no supe leer la entrada» son el mismo
log. Es la misma regla que «"No encontré nada que revisar" y "revisé y está todo bien" son
respuestas DISTINTAS», aplicada a la entrada en vez de a la salida.

# Todo proceso largo necesita algo que lo MIRE, no solo que lo lance

Un trabajo de horas se muere. Siempre. Lo que hay que decidir no es cómo evitarlo sino
**cuánto tarda alguien en enterarse** — y si la respuesta es «cuando Martín pregunte», el
costo real no es la caída: es el silencio.

La cola de cursos se murió **tres veces en dos días, por tres causas distintas**:

| Cuándo | Causa | Cuánto estuvo parada |
|---|---|---|
| 27/08 | el harness mató el grupo al cerrar la sesión | ~10 h |
| 28/08 | un Ctrl+C (`Last Result: -1073741510`) | horas |
| 28/08 | el pipeline arrancó y nunca escribió su línea de salida | **7 h 30** |

Cada arreglo fue correcto y ninguno alcanzó, porque **arreglar causas de a una no cierra el
agujero**: siempre hay una cuarta. Lo que lo cierra es que algo mire solo.

**La regla: si un proceso dura más que una sesión, se lanza con un vigilante.** Dos tareas
programadas, no una: la que hace el trabajo y la que lo mira. `scripts/cursos-perro.sh`
corre cada 15 minutos, y el molde sirve para cualquier otro trabajo largo.

Tres cosas que lo hacen funcionar, y las tres se aprendieron fallando:

1. **La señal de vida es el LOG, no los procesos.** El log se escribe en TODAS las fases
   —bajando, transcribiendo, subiendo, dando rondas—. Contar procesos falla en las dos
   direcciones: da «0» sobre una cola sana que está entre dos clases, y da «1» sobre una
   colgada hace horas.
2. **UN PROCESO VIVO NO ES PROGRESO.** Hacen falta dos umbrales: a los 20 min sin escribir
   *y sin procesos* está muerta; a los 45 min sin escribir está **colgada aunque tenga
   procesos**, y hay que matarlos. Sin el segundo, el 410 de un CDN tiene a yt-dlp
   «trabajando» siete horas sobre fragmentos muertos y el vigilante no hace nada.
3. **No revivir lo que terminó bien, ni lo que paró por una razón que sigue vigente.** Si la
   cola paró por DISCO, levantarla repite el mismo paro cada 15 minutos. Se anota y se sale.

⚠️ **Y el bug que cazó la PRIMERA corrida del vigilante:** contaba **su propia consulta**
como proceso vivo — la línea de comandos del shell que la ejecuta contiene el patrón que
busca. Veía «1 proceso vivo» sobre una cola muerta hacía 7 horas y le daba más tiempo, para
siempre. El vigilante habría sido decorativo y nadie se habría enterado. **Un chequeo que se
mide a sí mismo siempre da que está todo bien:** filtrá por `Name='node.exe'` (o el binario
que sea), nunca sólo por la línea de comandos.

⚠️ **Y el que MIRA necesita que haya UN SOLO ESCRITOR.** Un mes después el mismo vigilante
volvió a quedar decorativo, por el otro lado: `schtasks /end` mata el proceso que la tarea
registró y **deja vivos a sus nietos** —Git Bash re-ejecuta el script en un hijo—, así que
cada resurrección dejaba una cola huérfana. El 28/08/2026 había **dos colas corriendo sobre
el mismo curso**, con dos pipelines escribiendo la misma carpeta. Y como la señal de vida es
la fecha del log, **con dos escritores una cola colgada parece viva para siempre porque la
otra escribe**. No hay síntoma: el log avanza y los cursos salen.

- **Todo proceso largo lleva un LOCK, y el lock no depende de que el vigilante mate bien.**
  Aunque quede un huérfano, el segundo se niega a arrancar. Es la guarda que sobrevive al
  fallo del que la protege — y el vigilante, aparte, mata el ÁRBOL (`taskkill /T /F`), no el
  proceso suelto.
- **El lock se chequea con `kill -0`, no preguntándole a Windows.** El `$$` de Git Bash es
  el pid de MSYS y **no existe** para Windows: `Get-CimInstance` contesta «no existe» sobre
  un proceso vivo, y el lock se creería huérfano siempre.
- **Se suelta al final del script, NUNCA con `trap … EXIT`:** en sh ese trap también corre
  al salir de una subshell, y cualquier `$(…)` o `&` lo borraría al minuto de arrancar.
- **Y la firma para reconocerlo: dos formatos de log en el mismo archivo son dos procesos.**
  Acá se descubrió de rebote, porque un parser encontró 8 rondas y **cero cronometradas**:
  el log mezclaba el formato viejo con el nuevo, que es imposible con un solo escritor.

⚠️ **UN ARCHIVO DE LOG TIENE UN SOLO ESCRITOR.** Ni siquiera con `>>`: al correr el bajador
con `&`, él y el pipeline escribían al mismo `cola.log` y **se perdió el 10,5% de las
líneas** (315 de 3.000, medido reproduciéndolo), más 1.471 líneas con UTF-8 roto y líneas
de dos procesos fundidas en una. Si hay dos procesos, hay dos archivos.

- **Lo que se pierde NO es aleatorio: es justo lo que pasó durante la concurrencia.** La
  línea `pipeline (1a pasada) salió` sobrevivió 5 de 23 veces —es la única que se escribe
  mientras el otro escribe—, o sea que el log borra exactamente lo único que uno quería
  medir. Se quemaron cuatro métodos de medición contra ese log antes de encontrarlo.
- ⚠️ **Una prueba de concurrencia que no imita el TAMAÑO de escritura no prueba nada.** Dos
  `echo` de sh con líneas cortas dan 8.000 de 8.000 y el bug se declara inexistente; hace
  falta que uno escriba en chunks grandes, como `node`. Un verde así apaga la búsqueda.
- **Y separar los logs le rompe la vista al vigilante:** si la señal de vida era la fecha
  de un archivo que mantenía fresco el OTRO proceso, ahora hay que mirar **el más reciente
  de los dos**. Sin eso, una descarga larga se ve como una cola muerta y el perro mata una
  cola sana. Arreglar un problema creó otro peor.

⚠️ **Y no compares dos ventanas de tiempo si el código cambió entre medio.** «¿El
paralelismo aceleró la cola?» no se pudo contestar, y no por falta de muestra: en el mismo
commit entraron cuatro cambios, y uno de ellos —`--concurrent-fragments` de 4 a 8— vale
1,6x él solo. Peor: el salto de velocidad empieza **diez horas antes** de que existiera el
modo paralelo. Todo número serie-vs-paralelo medía los flags de yt-dlp y se lo atribuía al
scheduler. Lo que contesta es un A/B con el mismo código, alternando el modo ítem por ítem.
Y **la hora de cada fase se escribe desde el día uno**: el formato viejo no la tenía, así
que ese pasado no se puede medir ni con el mejor análisis.

# Un proceso largo que está corriendo no se edita en el lugar

Editar un `.sh` mientras lo ejecuta `bash` no rompe nada en el momento —el `while … done`
ya está parseado en memoria— y por eso se pasa por alto. Lo que cambia es el **offset**:
bash guarda la posición de byte donde quedó leyendo y la reusa cuando el bucle termina.
Con líneas insertadas antes de ese punto, esa posición cae en otro lado y el intérprete
ejecuta un fragmento cortado.

El 31/08/2026, en `scripts/cursos-cola.sh`, el final agendado era un error de sintaxis que
saltaba el `rm -f "$LOCK"` de las últimas líneas: la cola moría dejando el lock puesto, y
con el lock puesto el perro guardián **no puede levantarla**. Una cola muerta que nadie
revive es exactamente lo que el lock y el perro vienen a evitar.

- **Se edita y se REINICIA el proceso.** Que «no se haya roto» no es una verificación: el
  daño está agendado para cuando el intérprete vuelva a leer.
- **Y sin reiniciar el cambio tampoco corre.** El bucle en memoria es el viejo, así que lo
  nuevo no se aplica y el archivo igual queda minado — lo peor de los dos mundos.
- **Reiniciar es matar el ÁRBOL** (`taskkill /PID <raíz> /T /F`), nunca el proceso suelto:
  Git Bash re-ejecuta el script en un hijo y `schtasks /end` deja vivos a los nietos.
- Vale igual para cualquier archivo que un proceso vivo lea de a poco: un `.sh`, una lista
  que se consume línea por línea, un log del que otro proceso hace `tail`.

# Un registro DERIVADO se recalcula entero, nunca se le agrega

Todo archivo que dice «esto ya está» —un `--download-archive`, un caché de índices, una
lista de procesados— y que se DERIVA de otro dato tiene que reescribirse completo cada
vez. Si sólo crece, acumula las decisiones equivocadas de todas las corridas anteriores y
no hay forma de distinguir una marca vigente de una que quedó vieja.

El 31/08/2026 costó 23 clases de un curso de 237: se marcaron como bajadas contra un
`drive.json` que la corrida siguiente cambió, y quedaron anotadas sin video local y sin
Drive. yt-dlp las saltea porque el registro dice que ya están, el pipeline no las
transcribe, y el curso se publica incompleto **sin un solo error en ningún log**.

- **Recomputar y reescribir**, avisando cuántas marcas se sacaron. La prueba es correrlo
  dos veces seguidas y comprobar que el contenido no cambia.
- **Y el estado que afirma «esto ya está» tiene que poder confrontarse contra el mundo.**
  Lo que encontró el bug no fue leer el código: fue escribir la pregunta al revés —«¿cuántas
  están marcadas y no están en ningún lado?»— y correrla. Un registro que nadie puede
  desmentir es una afirmación, no un dato.

# Cuando un paso manual se automatiza, la lista de lo que tocaba se SACA DEL LOG

Un script que reemplaza a una mano se escribe enumerando de memoria lo que esa mano hacía,
y esa lista siempre viene corta. Lo que falta no falla: se publica a medias, con la parte
visible entera.

El 31/08/2026, `scripts/cursos-publicar.sh` commiteaba la ficha, el catálogo y la tapa de
cada curso, y **nunca `public/cono-tx/`** —el texto de las clases—. Los commits manuales
que reemplazó sí lo subían. Resultado: **12 cursos publicados con la pestaña
«Transcripción» vacía**, siete de ellos con el 100% de su texto faltando. El curso se ve
entero —portada, módulos, clases, video reproduciéndose— y el `.catch(() => setTx(null))`
del fetch deja el panel en nada. Sin error, sin 404 visible, sin nada que lleve al script.

- **La lista sale de `git log --name-only` sobre los últimos commits de esa mano**, no de
  acordarse. Es un comando, y es la única fuente que no depende de la memoria de nadie.
- **Y la pregunta se le hace a GIT, no al disco.** `existsSync` contesta que sí sobre el
  mismo agujero: en el árbol de trabajo están todos los archivos. Lo que se despliega es el
  commit — `git ls-tree`.
- Es la misma familia que «el catálogo importa fichas que no están en el commit», corrida
  una capa: ahí el índice nombraba fichas, acá las fichas nombran archivos. **Si algo que
  se commitea NOMBRA otra cosa, esa otra cosa necesita su propia guarda.**

# Una guarda bloquea sólo lo que se arregla haciendo lo que ella pide

⚠️ **Y vale igual para un AVISO y para el ORDEN de las ramas de un aviso, no sólo
para un `puedeAvanzar`.** Un paso del onboarding pedía «conecta tu navegador» y no
dejaba avanzar mientras `estadoDelPuente` dijera que no anda — pero uno de esos
estados es `marcada`, que es Google pausando la sesión de Flow y no se arregla
conectando nada. Una clienta con la extensión al día y latiendo hace cuatro
segundos quedó trabada ahí.

Peor: la pantalla la mandaba a **instalar la extensión que ya tenía**, y el botón
que sí resuelve —«Ya lo hice, volver a habilitar»— vivía en un componente que esa
pantalla no dibujaba. El popup de la extensión lo nombraba por su nombre. Ella
escribió: «no encuentro el Ya lo hice».

**Dos preguntas antes de escribir un guard o un aviso:** ¿todos los estados que
bloquea se arreglan haciendo lo que pido? Y si nombro un botón, ¿está en ESTA
pantalla? Un paso que nombra un control que su propia pantalla no tiene es peor que
uno que no dice nada: la persona busca hasta que se cansa.

Si un chequeo frena por algo que el que empuja no puede resolver —el archivo no existe en
ningún lado, el dato lo tiene otro equipo, la causa está en otro repo—, deja de ser una
red y pasa a ser un candado sin llave. Y de un candado sin llave lo único que se aprende es
a saltearlo, con lo cual se pierde también la mitad que sí servía.

Al escribir un guard, partí los casos por **«¿esto se arregla haciendo lo que digo?»**:

- **Sí** → frena, y el mensaje trae el comando exacto.
- **No** → avisa y deja pasar. Sigue siendo información, y no toma a nadie de rehén.

Es la misma razón por la que el verificador del catálogo pregunta por HEAD y no por el
árbol de trabajo: un archivo sin commitear no rompe ningún build, así que frenar por él
sólo traba a la sesión de al lado por algo que no es suyo.

# Antes de reusar el `null` de un campo, leé qué afirma ya ese `null`

Un campo booleano que admite `null` tiene TRES estados, y el `??` de río abajo ya le dio
un significado al tercero. Reusarlo para un caso nuevo —«acá no sé»— no agrega un estado:
lo colapsa contra el que ya existía, y el default decide por vos.

Medido el 04/10/2026, y el caso es caro porque **los dos lados eran correctos**:
`applyFathomRecording` resuelve `const asistValue = attended ?? true`, con su porqué
escrito al lado («null = no me consta, pero hubo grabación con el invitado presente»). Un
arreglo de OTRO archivo abrió una fuente nueva de links —los que una persona pega a mano en
la ficha— y, con razón, se negó a que eso afirmara la asistencia: devolvió `null`. Ese
`null` entró como `true`: marcó al lead como asistido, lo movió de etapa y disparó el
QualifiedLead de Meta, que el `revert` de la regla no deshace.

- **Cada pregunta, su campo.** «No me consta la asistencia» y «no quiero que esta llamada
  afirme nada» son dos cosas; la segunda necesita su propio parámetro
  (`opts.marcarAsistencia`), no un valor más del primero.
- **El olor:** un `??` sobre un campo que otro módulo rellena. Grepealo antes de devolver
  `null` desde un camino nuevo.
- **Y el contrato entre dos archivos que nadie toca junto no lo cubre ningún test de
  ninguno de los dos.** Si un paquete escribe el productor y otro el consumidor, el guard
  va sobre LOS DOS lados en el mismo test, o el día que uno cambie el otro no se entera.

# El fin de línea es POR ARCHIVO, y las herramientas de Git Bash mienten

`core.autocrlf=true` no deja el repo parejo: lo deja MEZCLADO entre archivos, y dos
vecinos del mismo directorio pueden estar en formatos distintos. Medido el 04/10/2026
por cuatro paquetes en paralelo, que tropezaron todos con lo mismo:

| CRLF puro | LF puro |
|---|---|
| `lib/leads.ts` · `lib/metodo-catalogo.ts` · `lib/tab-activacion.ts` · `app/crm/crm-map.ts` · `app/crm/[id]/DealDetailsCard.tsx` | `lib/fathom-auto.ts` · `lib/auto-reuniones.ts` · `lib/crm-auto.ts` · `app/crm/actions.ts` · `app/crm/[id]/deal-actions.ts` |

El síntoma no es un error: un script de parcheo contesta **«0 coincidencias»** sobre un
ancla copiada carácter por carácter del propio archivo. Y si el script igual escribe, deja
el archivo mezclado, que no se ve en ningún diff ni en ningún listado.

- **Un script que edita fuente DETECTA el salto de ese archivo y convierte sus propias
  anclas a ÉSE**, y lo devuelve igual. Normalizar a LF «de paso» es lo que mezcla.
- **Y se niega a escribir** si la búsqueda no aparece exactamente una vez, o si el
  resultado quedaría mezclado. `escribir()` en `scripts/curso-categoria-portada.mjs` es el
  molde.
- ⚠️ **`cat -A`, `od -c` y `grep $'
'` del Git Bash MIENTEN en la dirección
  tranquilizadora** sobre estos archivos. Se cuenta con node:
  `(s.match(/
/g)||[]).length` contra `(s.match(/[^
]
/g)||[]).length`.
- ⚠️ **Y un worktree no contesta «cómo estaba este archivo»**: es un checkout nuevo, con la
  normalización aplicada de cero. Para eso está `git show HEAD:<ruta>`.

# Que un archivo EXISTA no dice nada de si sirve, y el respaldo tampoco

Un `.mp4` corrupto, un JSON a medio escribir, un PDF truncado: pesan lo que tienen que
pesar, tienen el nombre final, y todo el sistema los da por buenos. `existsSync` contesta
que sí, el registro de descargas contesta que sí, y **la copia en el respaldo también** —
porque un respaldo guarda lo que le subimos, sin validar nada. Si lo que se subió estaba
roto, el respaldo termina AVALANDO el archivo malo.

El 31/08/2026 costó una clase de 28 minutos que estuvo publicada e incompleta: el video
pesaba 175.422.520 bytes y duraba 27:35 —exactamente lo que declaraba el plan— y su pista
de audio se cortaba a los 7:27. La descarga nueva pesó **exactamente lo mismo** y salió
entera, así que ni siquiera comparar tamaños lo habría encontrado.

- **Un respaldo, un caché o un CDN responden por la EXISTENCIA, nunca por el contenido.**
  Cuando un guard pregunta «¿lo tenemos en algún lado?», la respuesta no es «está bien».
- **El que descubre que un archivo no sirve tiene que dejarlo ANOTADO donde el que lo trae
  lo vea** — acá, apartarlo como `.roto`, que el bajador lee. Un fallo que sólo se reporta
  en un log deja el archivo malo en su lugar y el próximo paso lo vuelve a aceptar.
- **Y ese reintento se acota a UNO.** Si el material vuelve igual, es así. Sin el tope, un
  archivo que siempre falla es un lazo de descargas infinito.

# Un mensaje recortado sirve para MOSTRAR un error, no para DECIDIR sobre su causa

Recortar el stderr de un proceso a las últimas N líneas es correcto para que una persona lo
lea, y destruye la evidencia para el código que tiene que clasificarlo: la causa suele estar
al PRINCIPIO y las últimas líneas son el desenlace genérico.

Con ffmpeg sobre un video roto, las últimas cuatro dicen `Task finished with error code:
-22 (Invalid argument)` —que no distingue un material corrupto de un argumento mal puesto—
mientras que `Invalid data found when processing input` sale al principio, sepultado bajo
cientos de líneas. Un arreglo bien escrito no hizo nada durante una iteración entera porque
matcheaba contra el texto ya truncado.

**Si algo va a decidir sobre la causa de un fallo, la salida entera viaja aparte** (`e.stderr`
al lado de `e.message`). Lo recortado es para la pantalla.

# Una observación verdadera que también vale para los casos buenos no explica nada

Antes de dar por encontrada la causa de N fallos, medí la proporción — nunca el hecho:

- «Las 14 clases que fallaron son de Vimeo» era **cierto** y vacío: esos cursos son 100%
  Vimeo, y Vimeo anda 107 de 109.
- «Los 108 videos decodifican bien» venía de probar los primeros **3 segundos**; la
  corrupción empezaba a los 7:27. **Un test parcial no da un resultado parcial: da un
  verde**, y un verde apaga la búsqueda.
- «Son duplicados, el plan repite lecciones» tenía buena evidencia —dos clases con el mismo
  título— y cada una tenía **su propio id**. El id es una clave; el título es un parecido.

Lo que sí sirve es la tabla de dos por dos. En el mismo caso, la `duracion` vacía en el plan
resultó un predictor real: **62,5% de fallo contra 2,0%**, 31 veces más riesgo. Eso alcanza
para AVISAR antes de gastar la descarga, y no para descartar: de los seis que daban 404, uno
traía su duración puesta.

# Un hecho que sólo vive en la salida de un proceso no existe para el siguiente

Cuando un paso descubre algo que cambia lo que otro paso debería hacer —«esta clase no
tiene audio», «este archivo está corrupto», «este ítem no existe en el origen»—, imprimirlo
no alcanza. El proceso siguiente no lee logs: lee el disco y la base. Si el hallazgo no
queda escrito donde él mira, cada corrida vuelve a empezar sin saberlo.

El 31/08/2026, `curso-audio.mjs` sabía perfectamente cuáles clases no tenían pista de
audio y lo decía en pantalla; `curso-pipeline.mjs` las esperaba igual, porque medía
`texto N/M` sobre el total del plan. N no llegaba a M nunca: el curso no decía «completo»
ni una vez, quemaba su tope de reintentos en cada pasada, y figuraba incompleto para
siempre. Se arregló con un archivo vacío al lado del audio.

- **Lo que cambia la decisión de otro paso se persiste**, aunque sea un archivo vacío con
  el nombre correcto. Es más barato que cualquier protocolo entre procesos.
- **Y «resuelto» no es «hecho».** La diferencia entre «falta trabajo» y «no hay nada que
  hacer» es la que decide si un proceso termina o gira para siempre; si el contador sólo
  sabe contar lo hecho, no puede expresarla.

# Dos números que se comparan tienen que medir lo mismo

Un bucle que decide si hubo progreso con `ahora > antes` es correcto sólo mientras las dos
puntas midan lo mismo. Cambiar una sola —lo natural al agregar un caso nuevo— no rompe
nada visible: convierte la condición en verdadera para siempre, y el proceso se lee a sí
mismo progresando sin fin.

Pasó al hacer que las clases mudas contaran como resueltas: con `antes = textos()` y
`ahora = resueltas()`, una sola clase muda deja `ahora > antes` verdadero en TODAS las
rondas, el contador de rondas secas no sube nunca y el pipeline gira hasta el tope de 12
horas. **Comparar dos cosas distintas es peor que no comparar**, y el arreglo habría hecho
exactamente lo contrario de lo que buscaba.

Al tocar un contador que participa de una comparación, buscá la OTRA punta antes de
guardar. Y si las dos salen de funciones distintas, que se llamen parecido es la señal de
que se van a desincronizar.

# Antes de contar algo, decidí el universo — y decilo en el código

Un censo sobre el conjunto equivocado no da un número grande: da un número **sin
significado**, y a veces con cara de catástrofe. «Clases sin transcribir» sobre los 77
cursos de la cola dio **1.911**; los 10 que ni se empezaron aportaban 1.897 por definición
y ahogaban las 14 que había que mirar.

- **El universo va escrito arriba del contador**, con el porqué. La próxima persona que lo
  corra no tiene forma de saber que «todos» era la elección equivocada.
- **Y un total que no se puede accionar hay que partirlo.** Las 14 eran 6 que no existen en
  el origen, 5 caídas transitorias, 2 sin rastro y 1 sin pista de audio: cuatro respuestas
  distintas. «Faltan 14» invita a seguir buscando; «7 no existen» dice que se escribe y se
  para.

# Una verificación equivocada sale más cara que no verificar

Un chequeo nuevo se estrena sobre un caso donde ya se sabe la respuesta, y se cuentan los
DOS errores: lo que marca de más y lo que deja pasar. Encontrar lo que se buscaba no
alcanza — un chequeo que acierta el caso conocido y se equivoca en el resto es peor que no
tenerlo, porque el que no existe no hace nada y el que pregunta mal manda a rehacer trabajo
que estaba bien.

El 31/08/2026, al verificar que la copia en Drive de cada clase existiera de verdad: por
RUTA daba 0 de 104 —«el curso entero es un fantasma»— y con los videos ya liberados eso son
cientos de GB bajados de nuevo. Por NOMBRE daba 103 de 104, que era la verdad, y la que
faltaba era exactamente la que se había reportado. La causa: el archivo de anotaciones se
escribe desde **dos** rutinas distintas y sólo una guarda la ruta real.

- **Antes de confiar en un chequeo nuevo, corrélo sobre un universo con respuesta conocida
  y contá los falsos positivos.** Si marca casi todo, el que está mal es el chequeo.
- **Un formato que escriben dos rutinas tiene dos formas**, aunque el nombre del campo sea
  el mismo. Mirá quién más escribe ese archivo antes de asumir qué contiene.

# Un chequeo que no puede mirar se abstiene

La ausencia de evidencia no es evidencia de ausencia, y en código eso se escribe como una
rama explícita. Un disco desmontado, una carpeta que todavía no sincronizó, una API que
timeoutea: ninguno de los tres significa «no existe», y tratarlos así convierte una falla de
infraestructura en una decisión destructiva.

Va como salvedad ANTES del veredicto: si el montaje no responde o el listado viene vacío, se
cree lo anotado y no se concluye nada. Es la misma regla que «"No puedo hacer X con este
dato" no es "este dato es falso"», del lado del que verifica.

# Cuando N cosas fallan, contá cuántas CAUSAS hay antes de buscar la causa

«Faltan 14 clases» se lee como un problema; eran **siete problemas distintos**, uno por
eslabón, y ninguno daba error: cinco caídas 5xx, una marca de descarga huérfana, un video
que se bajó corrupto, una sobra de descarga con el header ilegible, una anotación de
respaldo que apuntaba a la nada, seis borrados en el origen y una clase sin pista de audio.

Buscar «por qué falla la descarga» no habría encontrado ninguno. Lo que los separó fue
clasificar los catorce por su evidencia —el error en los logs, qué archivos hay, qué dice
cada registro— ANTES de arreglar el primero. Un grupo de fallos que comparten el síntoma no
comparte la causa por defecto: eso hay que medirlo, y el conteo de causas se hace primero
porque decide si lo que sigue es un arreglo o siete.

# El mismo error puede tener dos veredictos, y lo que los separa suele ser un dato del material

Clasificar un fallo por su código —«5xx es transitorio, se reintenta»— es correcto hasta que
deja de serlo, y entonces manda a reintentar para siempre algo que no puede funcionar. El
código dice qué contestó el servidor, no si el recurso existe.

El 01/09/2026: 16 clases con HTTP 500 se dieron por transitorias —lo razonable, y lo que
había funcionado doce veces— y volvieron a fallar seis horas después, con tres referers
distintos y también sin ninguno. Lo que las separaba estaba en nuestros propios datos: la
`duracion` que el origen publica para cada lección. **Vacía: 0 de 15 bajadas. Puesta: 122 de
122.** La duración sale de la ficha del origen, así que vacía significa que el origen tampoco
sabía cuánto duraba.

- **Cuando un código de error da veredictos contradictorios, buscá el discriminador en los
  DATOS, no en más categorías de error.** Suele haber un campo que ya tenés y que sabe algo
  que el protocolo no.
- **Y dejá la precedencia escrita.** Un 404 es definitivo por sí solo y dice más: el
  predictor manda sobre los ambiguos, no sobre los que ya decidieron.
- **Un predictor fortísimo no es una ley.** 100% en un curso y 62,5% en otros siete: decide
  junto al código, nunca solo.

# Un patrón temporal se explica por el sistema o por los datos: repetí sin el sistema

Fallos agrupados —cinco seguidos, dos veces— se leen como límite de tasa, y esa lectura es
razonable. También puede ser que lo que falla esté agrupado en el ORIGEN.

Acá eran las lecciones «EXTRA» y «PREGUNTA FRECUENTE» de cada módulo: material secundario
que la plataforma nunca terminó de subir, y que en el temario va junto. El ritmo de las
requests no tenía nada que ver.

**La prueba que los distingue es reintentar en frío**, horas después y sin carga. Si el
patrón sobrevive, no era el sistema. Cuesta una corrida y descarta la mitad de las
hipótesis.

# Verificar una pantalla ESCRIBE, y hay que enumerar dónde

Mirar un wizard en el navegador no es leerlo: para llegar al paso 4 hay que
apretar «Siguiente» tres veces, y cada «Siguiente» llama a la action de ese paso.
La verificación deja de ser una lectura y pasa a ser una escritura sobre los datos
de quien esté logueado — y el único workspace donde una tab se puede ver es el
**ws1, que es Mauricio, un cliente real**.

El 02/09/2026 costó el acento de su avatar. Se guardó `onboarding.tab.video-generator`
antes de recorrer y se restauró después, con lo cual el progreso quedó intacto y el
respaldo se sintió completo. Lo que no estaba en esa clave: el paso del acento
escribe en `video.voz` con su propia action, así que el recorrido le guardó a un
cliente de **Baja California** el acento **argentino** que la detección por zona
horaria había elegido mirando la máquina del que verificaba. Sin error y sin
síntoma: la pantalla mostraba un acento perfectamente válido, y el siguiente video
habría salido rioplatense.

- **El respaldo se hace por lo que las ACTIONS tocan, no por el estado que estás
  mirando.** Antes de recorrer, `grep` de las actions del componente y de la clave
  que escribe cada una. Un respaldo incompleto es peor que ninguno: te deja
  restaurar con confianza.
- **Y si la clave no existía antes, restaurar es BORRARLA**, no dejarla con el valor
  que puso el recorrido.
- **Si ya pasó, el valor viejo casi siempre está en otro lado.** Acá salió de los
  366 trabajos ya mandados a Flow: 22 prompts decían «Northern Mexican Spanish(…)»
  y ninguno traía bloque de muletillas. **Un dato derivado que quedó escrito en
  algo ya emitido es un registro del valor que había** — y le gana a reconstruirlo
  de memoria, que es como se restaura mal con cara de restaurado.
- **Nunca uses el workspace de un cliente para probar lo que se puede probar en el
  Cliente de Prueba (ws3).** La única razón por la que acá se usó el ws1 es que es
  el único exento del onboarding global; si eso cambia, cambia también esto.

⚠️ Y el corolario del que verifica: **una detección automática mide TU máquina.**
Cualquier cosa que salga de `Intl`, `navigator.language`, la geolocalización o la
hora local va a dar tu valor y no el del cliente. En una captura eso se lee como un
dato del cliente, y si además hay un botón que guarda, se convierte en uno.

# Lo que le devuelve una tool a un modelo es TODO lo que el modelo sabe: la unidad y el recorte van ADENTRO

`listar_campanas_meta` (`lib/mako-doer-acciones.ts`) sumaba `spend` —que Meta entrega en la
**moneda de la cuenta**, MXN en las nuestras— y lo devolvía en un campo llamado
`gasto_reciente_usd`. Pesos con etiqueta de dólares, **17,3× inflado**, en la única tool que
le da números de Meta a MaKo por WhatsApp: el número lo leía el dueño en un chat.

Una pantalla pone la unidad en el encabezado de la columna y el período en el selector de
rango. Un modelo **no ve nada de eso**: lo único que le llega es el JSON de la tool. De ahí
las tres:

- **La unidad va pegada al número, en el NOMBRE del campo** (`gasto_mxn`), no en la
  descripción de la tool. La descripción se lee una vez, al elegir la tool; cuando el modelo
  redacta la respuesta está mirando el resultado, no el catálogo.
- **Un derivado se declara derivado.** `gasto_usd` sale de un tipo de cambio FIJO escrito a
  mano en `lib/config.ts`, así que va con su nota en el payload — el mismo contrato que ya
  usa `lib/metricas-modelo.ts` (`meta_inversion` + `meta_inversion_usd` + bloque `moneda`).
- **Un adjetivo de tiempo no es un recorte.** El segundo defecto de la misma tool:
  `.limit(600)` sin filtro de fecha sobre una tabla con una fila por ANUNCIO por día, o sea
  que cuántos días entraban lo decidía cuántos anuncios estuvieran corriendo (~50 días con
  12, ~6 con 100) — y el campo se llamaba «reciente». **Si el nombre de un campo trae
  «reciente», «último» o «actual», la ventana no está definida en ningún lado: definila,
  leela entera y devolvela** (`{ desde, hasta, dias }`), con una `instruccion` de repetirla
  al decir el monto.

Es el gemelo de «Una regla en un prompt no es una regla», del otro lado del cable: aquella
mira lo que el modelo ESCRIBE, ésta lo que el modelo LEE.

# Un test que comprueba que un MODULO carga tiene que correr en un `node` de verdad

`tsx` transpila los tests a **CommonJS**, y ahi un `import()` dinamico se resuelve con
interop de CJS: **no exige que los exports nombrados existan**. Un test que hace
`await import(...)` para comprobar que un modulo carga da VERDE sobre un modulo que no
carga.

Medido el 05/09/2026 con el service worker de la extension: `background.js` importaba
`A_PEDIR` del catalogo y el catalogo no lo exportaba. Eso es un error de LINKEO — en
Chrome, un service worker que no arranca, o sea una extension que aparece instalada y
no hace nada, sin un solo error visible. El test decia «carga» y `node` de verdad
contestaba `does not provide an export named A_PEDIR`.

**Y el test existia justamente para cubrir ese fallo.** Un test verde sobre la
propiedad equivocada es la forma mas cara de estar seguro; cuando ademas es la unica
red de ese fallo, es peor que no tenerlo.

La cura: escribir un `.mjs` al vuelo y correrlo con `execFileSync(process.execPath, …)`.
Ahi el linker de modulos ES es el de produccion. Molde:
`tests/extension-worker-carga.test.ts`.

**Y el corolario que vale para cualquier import:** la lista de nombres que se comprueba
se LEE del import real (`/import\s*\{([^}]+)\}\s*from/`), nunca se escribe a mano — una
lista a mano se queda vieja al proximo import y vuelve el mismo agujero.

# Una operacion que no le PIDE nada a la persona no es un paso de un wizard

«Se aprende gratis» y «no le pide nada a nadie» **no son lo mismo**, y confundirlas
produce una pantalla que pide algo imposible.

El 05/09/2026 el popup del puente mostraba «Ensename a usar tu Flow» con la lectura de
creditos como paso siguiente —que se aprende sola mirando lo que Flow hace igual— y un
boton «Entendido» que solo cerraba la ventana. El dueno lo reporto textual: **«le doy a
Entendido y no hace nada»**. Y no hacia nada porque no habia nada que hacer.

Lo caro no era el boton muerto: dejaba **TRABADO** ahi, sin llegar nunca a los pasos que
si necesitaban a la persona. Es «una guarda bloquea solo lo que se arregla haciendo lo
que ella pide», aplicada a un wizard.

- **El catalogo distingue `pide` de `cuesta`.** Subir una foto es gratis y aun asi pide
  algo; leer el saldo no cuesta y no pide nada. Son dos preguntas.
- **El wizard sale de lo que se PIDE**, y el «N de M» cuenta eso. Contar lo que se
  aprende solo hace que el numero no baje haga lo que haga la persona — y un progreso
  que no se mueve se lee como que esta roto.
- **Lo que se aprende solo se NOMBRA aparte**, no se calla. Sin esa linea, quien ve
  menos operaciones de las que el sistema necesita concluye que falta algo que hacer.
- **Ningun boton puede no hacer nada.** Uno que solo cierra no se lee como «no hay nada
  que hacer»: se lee como que la app esta rota.

# Un guard de ORIGEN se escribe con `origin`, nunca con un prefijo de la url

Medido con node el 05/09/2026, con el prefijo `https://flow.google.com`:

| url | `startsWith` | `origin` real |
|---|---|---|
| `https://flow.google.com.evil.tld/x` | true | `https://flow.google.com.evil.tld` |
| `https://flow.google.com@evil.tld/x` | true | **`https://evil.tld`** |
| `https://flow.google.comevil.tld/` | true | `https://flow.google.comevil.tld` |
| `https://flow.google.com:8443/x` | true | `https://flow.google.com:8443` |

El segundo es el que importa: su origen REAL es `evil.tld`, asi que un pedido nuestro
sale a un tercero **con las credenciales del cliente** — y la url se lee bien en
cualquier listado, log o mensaje de error.

⚠️ **La linea que habia en el repo no era explotable de milagro**: comparaba contra
`https://aisandbox-pa.googleapis.com/` y la salva la BARRA FINAL. Eso es suerte del
formato, no del metodo — y no sobrevive al dia que alguien escriba la de al lado sin
la barra, que es exactamente lo que estaba por pasar al sumar un origen.

Va `new URL(u).origin` contra un `Set` congelado, exigiendo `https:`, y con el test que
enumera los cuatro parecidos (`tests/flow-origenes.test.ts` es el molde). Vale para
cualquier allowlist de host: un webhook, un redirect, una imagen remota, un CORS.

# Un chequeo de sincronia que compara dos COPIAS no ve que las dos se movieron

El repo tiene cinco scripts de la familia «una cosa, un lugar» que copian un modulo a
un destino que no puede importarlo (`sync-contrato-detalle`, `sync-gramatica-doc`,
`generar-plugin`, `zip-extension`, `sync-operaciones`), y el pre-push corre su
`--check`. Ese chequeo compara el ARCHIVO GENERADO contra lo que la plantilla produce
hoy — asi que caza «alguien edito el generado» y **no** caza «la plantilla y la fuente
se movieron juntas».

Y eso ultimo pasa apenas la plantilla tenga algo escrito a mano. `sync-operaciones` se
desincronizo **el mismo dia en que se escribio**: copia los DATOS del catalogo, pero
las FUNCIONES estaban tipeadas adentro de su template. Se arreglo `operacionDelCuerpo`
en el `.ts`, el `.js` siguio con la version vieja, y el `--check` decia «al dia».

**La regla: si la plantilla contiene logica y no solo datos, hace falta ademas un guard
DIFERENCIAL** — importar las dos implementaciones y comprobar que contestan lo mismo
sobre una bateria de entradas. Molde: `tests/flow-operaciones-paridad.test.ts`.

Los dos guards son complementarios y ninguno reemplaza al otro. Y hay una salida mejor
cuando se puede: que la plantilla **no tenga logica**, solo datos. Logica duplicada es
logica que va a divergir; la unica pregunta es cuando.

# Al volver async algo que se INTERPOLA en un string, borralo: no lo cambies de tipo

Un `await` olvidado no rompe: interpola **`[object Promise]`**. La URL sale mal, el
proveedor contesta un error que no se parece a la causa, y **ni `tsc` ni el eslint del
repo lo ven** — no hay `restrict-template-expressions`, así que un `Promise<string>`
dentro de `` `${…}` `` es código perfectamente válido.

Medido en la tarea #170: de los 60 call-sites de `ver()`/`acct()`/`token()` en
`lib/meta-ads-create.ts`, **36 vivían dentro de template literals**. Volverlos async
in-place habría dejado esos 36 compilando en verde y fallando en runtime, en un archivo
que crea y borra campañas con plata.

**La regla: borrá el identificador viejo y dejá que el compilador te reclame los
call-sites.** «Cannot find name» los enumera todos, incluidos los del string; cambiarle
el tipo a la función deja verdes justo los que fallan. Vale para cualquier helper
sincrónico que se vuelve async: una credencial, un id de tenant, una versión de API.

Y el corolario del rendimiento, que aparece en la misma pasada: si el valor se usa
adentro de un bucle, **se hoistea afuera**. `credWs` no cachea (un SELECT por llamada),
así que un sondeo de 37 vueltas pasaba a 74 consultas — y cada una es una chance
independiente de abortar a mitad de un árbol ya creado.

# Un `select` de PostgREST con UNA columna que no existe rechaza la consulta ENTERA

Y el error **no sube si nadie lo lee**: con supabase-js, `data` vuelve `undefined`, la
lista queda en `[]`, y el código sigue como si la fila no tuviera nada del otro lado. No
hay excepción, no hay log, y «no hay filas» y «no pude leerlas» se ven exactamente igual.

Muerde justo donde este repo lo tiene garantizado: **el tablero es UNO y las tablas son
DOS**, y las columnas se llaman distinto. El avance es `progress` en `plan_tareas` y
`progreso` en `experimento_tareas`, así que pedir las dos «por las dudas» no es defensivo:
rompe la consulta en las dos mitades. La columna se elige según la tabla, y el `error` se
lee SIEMPRE — es lo único que separa las dos respuestas.

⚠️ **Y UN CANDADO EN LA BASE PUEDE TAPARLO Y DARTE UN VERDE POR LA RAZÓN EQUIVOCADA.**
Medido el 30/09/2026 en el generador de recurrentes: con la lista vacía, el código no veía
la instancia abierta y reintentaba una fecha ya creada; el insert rebotaba con `23505`, el
código lo trataba como «ya existía», y la prueba de punta a punta decía «no duplicó». Era
CIERTO — y lo estaba logrando el índice único, no la lógica. Cuando un test pasa gracias a
una guarda de integridad, no probó lo que creés: probó la guarda.

**Lo que lo delató fue un CONTADOR que no cerraba** (`conAbierta: 0` sobre una plantilla
que sí tenía una abierta). Un proceso que decide vale lo que cuentan sus contadores: si
imprime sólo «creadas», el único estado que se puede auditar es el que funcionó.

# Un test que no probaste ROMPIÉNDOLO es una afirmación, no una medición

Un test nuevo que sale verde no dice nada: no sabés si mide lo que creés o si mide
nada. La comprobación es de dos líneas y hay que hacerla **siempre**: rompé a
propósito lo que el test persigue, corré, mirá que falle, restaurá.

Pasó acá, en el test escrito para cazar un `datos:` donde el server lee `data:`.
Extraía las claves con `/^\s*(\w+):/gm` —ancla de principio de línea— y el `return`
que había que cazar estaba escrito en UNA sola línea. Cero claves, cero fallos,
verde. **El test pasaba sobre el mismísimo bug que existía para cazar.** Lo delató
romperlo: con `datos:` seguía dando 2 de 2.

La misma pasada tuvo el caso hermano: `tests/extension-worker-carga.test.ts` daba
verde sobre un worker que no cargaba, porque `tsx` transpila a CJS y ahí el
`import()` dinámico no exige exports nombrados.

**En el comentario del test va el resultado de la rotura**, con números: «verificado
quitando el arreglo: 1 fallo, 1 pase». El que lo lea dentro de seis meses no tiene
por qué creerte, y ese renglón es la diferencia entre un test probado y uno escrito.

⚠️ **Y LA ROTURA SE LEE CONTRA UNA BASE EN VERDE.** Si el archivo ya tenía un rojo antes de
romper, el «1 fallo» que da la rotura puede ser ESE rojo, y se anota como detectado algo que
nadie detectó. Medido el 09/10/2026 en `tests/lead-quieto.test.ts`: romper el cableado de
`relojDesde` dio «1 fallo, 14 pases», y el fallo era otro test que un cambio propio había
dejado rojo minutos antes. Con la base en verde, el guard real no existía todavía. Primero
`0 fallos`, después cada rotura.

⚠️ **Y UN GUARD QUE LEE EL ARCHIVO ENTERO ENCUENTRA LO QUE EL ARCHIVO DICE DE SÍ.** Un
`assert.match(SRC, /notas:/)` sobre un módulo de 700 líneas no prueba que el campo esté en
el mapper: prueba que la palabra aparece en algún lado — en el tipo gemelo, en el otro
mapper, en un comentario, o en la línea que lo pasa. Medido el 30/09/2026 sobre el guard de
los seis lugares de un campo: **dio VERDE sobre CUATRO DE LAS CINCO roturas**. Y el assert
de al lado, un `doesNotMatch(MIG, /default \d/)`, fallaba contra **su propio comentario**,
el que explicaba por qué esa migración no lleva default.

Se extrae el BLOQUE antes de buscar (la función, el tipo, la sentencia SQL, las líneas que
no son comentario) y recién ahí se pregunta. Y cada capa lleva SU test: un guard que junta
seis en uno dice que algo se rompió y no cuál, que es lo único que ahorra tiempo.

⚠️ **Y UN `doesNotMatch` SE PREGUNTA SOBRE EL TEXTO SIN COMENTARIOS, SIEMPRE.** Es la misma
regla llevada a su caso más frecuente, y es inevitable acá: la convención de la casa es
explicar en el comentario lo que se sacó y CITAR el pedido que lo pidió, así que todo guard
de «esto NO está» se acusa a sí mismo. Medido el 05/10/2026: la primera corrida de
`tests/cs-kanban-fases.test.ts` falló **tres de once** por el ⛔ que explica que «Sin
clientes.» se fue, el ⚠️ que dice que ya no se lee `e.dot`, y el encabezado que cita «no
existe el botón de "No cambiar nada"». Los tres son prosa correcta y los tres hacían fallar
un guard sano — que es peor que un falso negativo, porque manda a «arreglar» algo que está
bien.

```ts
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, '');  // y los bloques después
```

Las líneas antes que los bloques, por lo que ya está escrito más arriba: un `/*` que
aparezca dentro de un comentario de línea abre un bloque que se cierra páginas abajo y se
come el código del medio. Y sólo las líneas que ARRANCAN con `//`, para no partir un
`https://` adentro de una cadena.

⚠️ **Y «EL BLOQUE» ES SU CIERRE REAL, NUNCA UN NÚMERO DE CARACTERES.** Un `slice(i, i + 800)`
elegido a ojo es el mismo bug con otra cara: el universo sigue siendo más grande que la
pregunta. Medido el 04/10/2026 en el tablero — un guard que exigía `!verTodos && !needle`
adentro de una función daba VERDE con esa condición borrada, porque sus 800 caracteres
llegaban hasta la función de al lado, que tiene la MISMA condición para otro gesto. Va
`slice(ini, SRC.indexOf('<lo que abre el bloque siguiente>', ini))`, y conviene afirmar
además el largo del recorte: si mañana mide 4.000, está mirando otra cosa.

⚠️ **Y SE FIJA LA CONDICIÓN, NO EL CUERPO QUE CUELGA DE ELLA.** El mismo día, otro guard
afirmaba que el cuerpo del `if` existiera: reemplazar la condición por `if (false)` lo dejó
intacto y en verde. Lo que decide si algo se ejecuta es la condición — el cuerpo es lo que
se ve.

⚠️ **Y UN GUARD DE CABLEADO NO REEMPLAZA A UN TEST DE LA FUNCIÓN.** Contesta «¿está
enchufado?», nunca «¿hace lo que dice?». En esa misma tanda se escribió una función pura con
su comentario y sus guards, y quitarle el `filter` y quitarle el `sort` pasaron los dos en
verde: no la llamaba nadie. Toda función pura nueva lleva su test que la EJECUTA, aunque ya
tenga tres guards que la nombren.

⚠️ **Y UN TEST QUE LEE UN ARCHIVO POR SU RUTA NO SE ENTERA DE QUE ESE ARCHIVO MURIÓ.**
Los guards de esta casa leen fuente con `readFileSync` y preguntan por una cadena, así
que siguen en VERDE sobre un componente con **cero call sites** — y el verde se lee como
«la pantalla lo hace». Medido el 29/09/2026 al reemplazar el modal de destinatarios por un
editor en la página: cuatro assertions seguían leyendo `DestinatariosModal.tsx` (que el
link del grupo se pueda copiar, que nada se rechace en silencio) mientras el editor VIVO
salía sin el botón de copiar, o sea sin la única salida cuando WhatsApp se niega a sumar a
alguien.

**Al reemplazar una pieza, sus tests se MUEVEN con ella en el mismo commit, y lo que la
vieja tenía de propio se enumera antes de borrarla.** Si el archivo viejo se va, un test
que pregunte «¿no volvió?» (`readdirSync` del directorio) vale más que uno que lo lea: un
segundo editor del mismo dato es lo que produjo este agujero.

# Una regla DERIVADA necesita el UNIVERSO, no las filas

Cuando la respuesta a «¿dónde está esto?» no se lee de una tabla sino que se DERIVA —«un
cliente sin fila está en la primera etapa», «una tarea sin quarter lo saca de su deadline»,
«un paso sin estado está pendiente»—, la función que la aplica sólo puede derivársela a lo
que RECIBE. Alimentarla con las filas de la tabla en vez de con las entidades es un cero
perfectamente correcto sobre la pregunta equivocada, y **el que cuenta filas siempre cuenta
de menos**.

Medido el 05/10/2026 en Customer Success, con 8 clientes y 3 filas de `cliente_entrega`: el
tablero dibujaba **5 tarjetas** en la primera columna y el editor de etapas decía **0**, los
dos leyendo el mismo overlay y los dos llamando a la MISMA función —que delega en
`repartirEnEtapas` justamente para que no puedan contar distinto—. La función estaba bien: a
una le pasaban un cliente por tarjeta y a la otra `Object.values(asignacion)`, o sea las
filas.

- **No es cosmético: casi siempre ese número gobierna una decisión.** Acá era lo único que
  hacía que sacar una columna fuera una decisión, así que con el 0 puesto el «¿seguro?» **no
  se dispara** y la columna se va con cinco clientes adentro, en silencio.
- **El comentario de al lado puede ser cierto y esconder el bug.** Decía «sale del MISMO
  overlay que dibuja el tablero», que es verdad — y la pregunta era otra.
- **Y el universo se elige:** se cuenta sobre la cartera ENTERA, nunca sobre lo que un
  filtro o un buscador dejaron a la vista, o el aviso deja de contar a los que se
  escondieron.
- **El olor:** dos llamadas a la misma función de conteo cuyos argumentos salen de colecciones
  de distinto tamaño. Si una es `Object.values(<mapa de filas>)` y la otra una lista de
  entidades, ya es esto.
- **Lo encuentra el navegador, no el código.** Las dos pantallas compilan, los tests pasan y
  los dos números son plausibles; lo que lo delató fue ver el 0 al lado de las cinco
  tarjetas.

# El copy que ve un cliente no relevé un campo LIBRE

Una pantalla que pinta un string que escribe otro proceso convierte en copy de
producto cualquier cosa que ese proceso ponga adentro, **sin que nadie lo revise**.

`detalle` del puente de Flow es un campo libre que escribe la extensión en cada
latido, y `/video-generator` lo pintaba tal cual. Salió dos veces a la pantalla del
dueño: una como un volcado de JSON del espía cortado a la mitad
(`{"boq:cPZSdc":{"metodo":"POST",…`), y otra como un párrafo nuestro —«Google
reescribió Flow y lo movió a flow.google.com; la forma en que MaKo se conectaba con
la versión anterior ya no existe ahí»— a alguien que no sabía qué era Flow.

Recortar a 120 caracteres no arregla nada: **el problema no es el largo**.

- **La pantalla deriva su rótulo de un estado CERRADO**, no de un texto que le
  mandan. Si hace falta distinguir más casos, se agrega un código al contrato, no
  una frase (`estadoDelPuente` en `app/video-generator/puente-avisos.tsx`).
- El campo libre **sigue viajando y sigue guardándose**: es para diagnosticar.
  Diagnóstico y copy son dos trabajos y no comparten campo.
- Y lo mismo del otro lado: **nada de lo que nos pasa a nosotros va en el copy.**
  Ni «aprendí», ni «ya sé usar tu Flow», ni la historia de qué nos rompió Google.
  Quien abre MaKo no sabe que hay un puente y no tiene nada que hacer con eso. Se
  dice qué puede hacer ÉL. Lo fija `tests/extension-copy-cliente.test.ts`.

# Una capacidad que se paga entra por el TRABAJO REAL, no por un botón de probar

Un «pedir un video de prueba» parece prudente y es al revés: gasta un crédito del
cliente para producir algo que no le sirve, y —cuando la herramienta existe
justamente para que no tenga que usar la de Google a mano— **lo saca del producto
para mandarlo a hacerlo a mano**. El dueño lo dijo así: *«¿qué es eso de sacarlo de
MaKo para redireccionarlo a Flow, si JUSTAMENTE estamos creando una herramienta para
que no tengan que utilizar Flow a mano?»*.

**El primer trabajo de verdad ES la prueba.** Se cablea en la cola real, y si falla,
el error aparece donde la persona está esperando el resultado. Un botón de probar
además duplica el camino: el que se prueba no es el que corre.

# Cuando sólo cambian las PALABRAS, las condiciones no se tocan

Reescribir un copy es tentador de hacer de una sentada, y en esa sentada se reescribe
la condición que estaba abajo. Pasó acá, en la misma pantalla, el mismo día: al
cambiar los textos del popup el rótulo del botón volvió a depender de «¿hay frase?»
en vez de «¿dónde está la persona?». Esa es exactamente la condición que ya se había
reportado **tres veces** —`subir_imagen` no tiene frase, cae por el `else`, y le dice
«Ir a Google Flow» a alguien parado en Google Flow—.

Lo cazó el test que fija la condición (`tests/extension-boton-donde-estas.test.ts`).
**Ése es el permiso para tocar el copy:** si la condición está fijada por un test, se
puede reescribir todo el texto sin miedo; si no lo está, fijala antes de reescribir.

# En lo que gasta plata ajena, el default es NO reintentar

Un reintento después de que el pedido salió le cobra dos veces al cliente. El crédito
se gasta **cuando el pedido viaja**: que la respuesta no vuelva no lo devuelve.

El puente a Flow tenía `reintentable: !r.salio`, o sea que un `salio` **ausente** se
leía como «no salió». Y ausente es exactamente lo que mandaban los dos caminos donde
sí había salido: el timeout de 120 s (`{ error: 'BOQ_TIMEOUT' }` pelado) y el `catch`
de afuera del espejo, que no veía `salio` **por scope** —estaba declarado adentro del
`try`— cuando fallaba `await res.text()` con Google ya cobrando. Cinco intentos =
cinco créditos por un video.

- **Se reintenta sólo con una afirmación explícita** de que el pedido nunca viajó
  (`salio === false`), nunca con la truthiness de un campo que puede faltar. Lo peor
  de este default es que alguien tenga que apretar de nuevo; lo peor del otro es
  cobrarle.
- **Un dato que decide plata no puede depender del scope de un bloque.** El comentario
  decía «se pone JUSTO antes del await» y lo hacía; lo que no se vio es que el `catch`
  de afuera no podía nombrarlo.
- Y los caminos que **provablemente** no mandaron nada declaran `salio: false`
  explícito, o el default los deja trabados.

# «El mismo predicado que la ejecución» no vale si son DOS COPIAS del predicado

Un chequeo previo sólo es confiable si es **la misma función** que corre después, no
una reescritura con las mismas reglas. Dos copias divergen en cuanto una crece.

Medido: el ensayo que decide si el puente puede filmar y el replay que manda el
pedido hacían cada uno su propio `find(p => p.op === op)` — la primera plantilla por
orden de inserción. Un navegador que aprendió en labs.google y migró a
flow.google.com tiene DOS para la misma operación, y la vieja pasa todos los chequeos
menos el último (no tiene dónde poner el `at`). Verde, y el pedido moría cinco veces
con la plantilla buena a una clave de distancia. La elección se mudó a una función
que llaman los dos, y ahí apareció el chequeo que le faltaba a las dos.

# Dos pantallas que se contradicen no son un problema de copy

Cuando dos superficies describen el mismo hecho y dicen lo contrario, el bug no es el
texto: es que hay **dos definiciones**. Contalas antes de tocar una palabra.

En el puente a Flow había **nueve** —una por superficie, cada una armada con los
insumos que tenía a mano— y ninguna era alcanzable en el Flow nuevo. El síntoma que
se veía era un cartel contradictorio; lo que había debajo era el botón de crear, la
cola de la extensión, el reparto del server y el guard de filmar, los cuatro
cerrados. Y la cura no fue un campo más: con nueve definiciones, la décima es el
problema. Cambió lo que **significa** la que ya existía.

# Un campo que dice «esto se aprendió» no protege el dato que se aprendió

La bandera es barata y el dato es caro, y la regla que cuida a la bandera tiene que
cuidar al dato — o queda un sistema que declara saber hacer algo que ya no puede hacer.

El puente a Flow conservaba `op` y `sentinela` («esta clase alguna vez llevó la frase
de aprendizaje») a través de espejo, worker y server, y dejaba que la siguiente
generación de la misma clase PISARA el cuerpo que la llevaba. Medido en producción:
`SIN_ANCLA(generar_clip)` con la sentinela intacta al lado, y el popup pidiéndole a
Martín que volviera a generar lo que había generado decenas de veces.

- Identificá **cuál es el dato que costó plata o trabajo** (acá: el cuerpo con la
  frase, un crédito) y aplicale la misma regla de «se descubre una vez y no se pisa»
  que ya tenga su bandera. En **todas** las capas donde viva una copia.
- La entrada protegida se conserva **entera**: mezclar la url de hoy con el cuerpo de
  ayer arma un pedido que ninguna versión del proveedor mandó.
- Y una siembra/restauración que «nunca pisa lo local» tiene que pisar lo local
  cuando lo local perdió el dato y la copia remota lo tiene: para eso existe.

# Lo que un saneador DESCARTA queda escrito, con motivo

Un `continue` sin rastro hace indistinguibles «no llegó» de «lo tiramos nosotros». El
respaldo de plantillas de un workspace estuvo con CERO plantillas del protocolo nuevo
durante días, con el navegador mandándolas en cada latido: `sanearPlantillas` tiraba
por cuatro motivos distintos y ninguno dejaba una línea. La regla ya estaba escrita
para `ajenas`, veinte líneas más abajo, y el saneador no la cumplía.

Todo filtro que descarte entradas de un productor externo recibe un colector de
motivos, y el llamador lo persiste donde se pueda leer sin abrir logs
(`flow.plantillas_descartes`: `{cuando, llegaron, quedaron, motivos[]}`).

# «No lo mandó» y «mandó vacío» son dos cosas, y `.length` las confunde

Un campo opcional que llega como lista vacía NO es lo mismo que un campo que no
llegó. `Array.isArray(x)` distingue; `x.length` no.

El route del puente hacía `clasesQueTiene.length ? faltantes(…) : []`, pensado para
una extensión VIEJA que no manda `clases` («no saber qué tiene no autoriza a decidir
por él»). Pero un navegador NUEVO —recién instalado, sin nada aprendido— manda
`clases: []`, y `[].length === 0` cae en la misma rama: no recibía NADA del respaldo,
y la persona tenía que ir a Flow a generar a mano lo que el respaldo ya tenía. Era
exactamente el caso para el que existe el respaldo, y era el único que no cubría.

- Si el comportamiento cambia según el emisor sea viejo o nuevo, la pregunta es
  **«¿mandó el campo?»** (`Array.isArray`, `"x" in body`, `!== undefined`), nunca
  «¿tiene contenido?».
- Y escribí el test con la lista vacía y con `undefined` por separado: son los dos
  casos que la condición tiene que separar.

# El espejo MAIN-world sobrevive a la actualización: el server tolera espejos viejos

Un script inyectado en el mundo de la página vive hasta el F5, no hasta el próximo
deploy. Con la guarda de idempotencia (`if (window.__makoEspejo) return`) el nuevo ni
siquiera se instala encima. Medido: `manifest 0.64.0, espejo 0.63.0` en la pestaña
del dueño, con el popup en verde.

Consecuencia para el código: **todo arreglo del espejo es inerte hasta que la persona
recargue**, y las pestañas abiertas antes del deploy son la mayoría. Así que:

- Lo que el server RECIBE del espejo se normaliza del lado del server también
  (la url relativa `/_/…` se resuelve contra flow.google.com aunque el espejo nuevo
  ya la mande absoluta). Un arreglo que sólo vive en el espejo llega a producción
  a medida que la gente recarga, o sea nunca del todo.
- El popup DICE que la pestaña quedó vieja y ofrece recargar (`espejoViejo`), antes
  de cualquier pantalla de «ya puede». Un espejo que no contesta NO cuenta como
  viejo: puede ser una pestaña dormida.
- Y si hay algo que leer del espejo viejo antes de que muera —una respuesta que ya
  no se puede volver a provocar sin gastar plata—, se lee PRIMERO y se pide el F5
  DESPUÉS. El orden es parte del arreglo.

# El que encola y el que ejecuta comparten un contrato: el test lo CRUZA

Un productor y un consumidor de la misma cola se escriben en archivos distintos, a
veces en semanas distintas, y cada uno compila perfecto con su propia idea del
payload. Nada falla hasta que un trabajo real cruza de uno al otro.

Pasó con el puente a Flow, en la pantalla de un cliente durante una demo: la rama
de BOQ de `ejecutar()` (extensión) leía `pedido.prompt`; los dos `encolar` del
server (`video-action.ts`) llevaban el prompt ADENTRO —en `body` el clip, en
`parches` la imagen— y arriba no había nada. Video e imagen morían con un mensaje
nuestro: «El trabajo no trae texto para filmar».

- Cuando escribas un consumidor nuevo de una cola, **abrí los `encolar` que la
  alimentan** y leé el objeto literal. No el tipo: el literal.
- Y dejá un test que lea LOS DOS ARCHIVOS: el objeto que se encola por tipo y el
  campo que el ejecutor exige (`tests/cola-prompt-al-tope.test.ts`). Es la única
  forma de que el contrato no se vuelva a separar sin que nada avise.
- Si el mismo dato tiene que viajar en dos lugares (arriba para el protocolo nuevo,
  adentro para el viejo), se calcula UNA vez y se pone en los dos: dos cálculos
  son dos anuncios distintos según el protocolo.

# El JSON de un modelo se repara SÓLO si el parse directo falla

Los modos de falla son pocos y siempre los mismos —coma que falta, coma que sobra,
comilla de diálogo sin escapar, salto de línea crudo, cercas y prosa alrededor— y se
reparan sin ambigüedad caminando el texto con estado de string
(`lib/json-del-modelo.ts`). Tres reglas:

- **Un JSON válido no se toca.** Toda heurística corre después de que `JSON.parse`
  falló; sobre texto válido es una oportunidad de romperlo.
- **Tres escalones, del más barato al más caro:** reparar sin red → pedirle a la
  cascada barata que COPIE el mismo contenido como JSON válido (no que piense) →
  tirar con la salida cruda en el log, que es la única evidencia del próximo caso.
- **No escribas otro `parseJsonObject`.** Había tres copias idénticas e ingenuas;
  las tres delegan. Importalo.

# Lo que la IA decide, la persona lo tiene que poder cambiar — y `score_manual` no lo pone una corrida

`score_manual` en `plan_tareas` / `plan_proyectos` significa **«esto lo decidió el dueño,
discutiéndolo»** (mig 0143): el Perro no lo pisa nunca más. Una corrida automática que lo
escribe no está guardando una decisión, está poniendo un candado sin llave.

El 20/09 una depuración fijó los **71 proyectos** con `score_manual: true` para preservar el
orden que el dueño había dictado en una sesión. Dos días después él no podía mover una sola
prioridad: *«ni siquiera me da la opción de cambiarlo… no hay maleabilidad, me obliga a hacer
algo que encima ni siquiera está bien»*, y la sesión de revisión se trabó ahí. El acompañante
lo remató con la versión de producto: *«para los 50 clientes que lo usen puede gestionar mal
las tareas, y encima cuando quiera modificarlo no lo deje»*.

- **Una corrida automática NO escribe `score_manual`.** Lo pone la persona al debatir una
  prioridad, y nadie más. Si una corrida quiere conservar un orden, escribe el `score` y la
  `score_razon`, que es discutible, y se va.
- **Toda prioridad que pone la IA tiene que poder cambiarse a mano en la pantalla**, sin
  debate previo y sin fricción. Si el modelo se equivoca —y se va a equivocar— la salida no
  puede ser «discutilo con el Perro»: es cambiarlo y seguir. El debate es una opción, no un
  peaje.
- **Y no se le pide a nadie que puntúe algo que todavía no existe.** Las dos altas —tarea y
  proyecto— preguntaban la prioridad con un slider del 1 al 100, la de proyecto encima con la
  lista de los otros 70 al lado para comparar. Es la pregunta que peor se contesta y la que
  más fricción mete, y el sistema ya sabe contestarla: la pone el Perro en la misma corrida
  en la que escribe el detalle. **Cuando una pantalla pide un dato que el sistema ya deduce
  en OTRO camino, el problema no es la pantalla: falta un call site.** (El alta manual era el
  único camino que no ruteaba la tarea a un proyecto, teniendo `asignarTareasAProyectos`
  escrita desde agosto.)
- **Y lo que decide solo se tiene que poder apagar.** El pedido textual: *«permitime
  desactivarla… o simplemente quitar la fricción: que él te asigne la prioridad y si la
  asignó mal, que vos la cambies»*. Un automatismo sin interruptor, cuando falla, no se
  arregla: se abandona, y se lleva puesta la feature entera.

⚠️ **EL QUE DICE RESPETAR EL CANDADO TIENE QUE MIRARLO — Y EL COMENTARIO NO CUENTA.**
`recurvarPlanOwner` declaraba, textual, que preservaba «cualquier corrección a mano del
dueño» y **no leía `score_manual` en ninguna línea**: a una tarjeta fijada en 90 se le sumaba
el empuje del deadline y el castigo por quietud, y después la curva le reescribía el número.
O sea que el candado era cierto para los proyectos y mentira para las tareas, mientras la
pantalla anunciaba «la fijaste a mano: MaKo ya no la toca». **La forma en que falla es la
peor: el número se mueve solo, de a poco, todos los días**, sin una entrada de historial que
lo explique. Lo fijado entra al reparto con su número tal cual (para que el resto se ordene
alrededor) y sale sin que se le escriba nada — y el cron **cuenta cuántas respetó**, porque
un candado que funciona y uno que nadie disparó se ven iguales si no se cuentan.

⚠️ **Y el corolario de la priorización: un proyecto se juzga por lo que tiene ADENTRO, no por
su nombre.** En esa misma corrida «Cliente: Mauricio» quedó primero porque las decisiones
decían «lo que pide Mauricio va primero» — pero sus tareas abiertas eran el mapa de México,
descuadres del dashboard y avatares, ninguna de las que él había nombrado. *«Son tareas
random… no son las prioritarias que habíamos hablado.»* Lo obligatorio de ese cliente vivía
en otros tres proyectos. Antes de ordenar por un criterio, hay que mirar si las tareas del
proyecto son las que ese criterio nombra; y lo que van a usar TODOS los clientes es producto
y va a su tab, aunque lo haya pedido uno (`lib/plan-proyectos-catalogo.ts`).

# Si el final de una acción es «alguien de afuera se entera», contá las filas del otro lado

Que la acción devuelva `ok` prueba que la acción corrió, no que la persona exista. El 28/09
una agencia abrió la cuenta de un cliente, el super admin la aprobó, y **no le llegó nada a
nadie**: workspace creado, estado `aprobado`, **cero usuarios**, el lead sin email, y ni un
solo error en el camino. El alta creaba el inquilino y el pedido y **nunca creaba a la
persona**; la aprobación marcaba una fila y no le escribía a nadie. Las dos mitades andaban
perfecto y entre ellas no había nada.

La verificación que lo delata es de una línea (`usuarios where workspace_id = N`), y ninguna
pantalla podía mostrar ese cero: dibujaba «aprobado» y listo.

- **Después de una acción que termina afuera, verificá el EFECTO, no el retorno.** Contá la
  fila que tiene que existir, o pedí el registro que dice que el mensaje salió.
- **`crearUsuario` no manda mail; `invitarPorEmail` sí.** Confundirlos falla en los dos
  sentidos, y los dos son caros: avisarle a un tercero de un acceso que todavía **no está
  autorizado**, o no avisarle nunca. El reparto de la casa: el canal PROPONE (crea en
  silencio) y la confirmación de una persona es la que manda el acceso.
- **El chequeo de unicidad va antes de la PRIMERA escritura, no antes de la que choca.**
  `usuarios.email` es único: chequear después de `crearWorkspace` deja, ante un email
  repetido, un inquilino huérfano que ningún listado marca como roto.
- **Y el aviso no puede tumbar la decisión.** Si el mail falla cuando la aprobación ya se
  escribió, revertirla es deshacer lo que una persona decidió porque se cayó un servicio de
  correo. El resultado del envío viaja como aviso pegado al renglón —se mandó / ya se había
  mandado / no hay a quién— y nunca como un 500.
- **Un estado «autorizado» sin nadie adentro tiene que ser visible.** Hoy hay que
  preguntárselo a la base; debería ser una fila roja en el panel.

# Antes de construir una máquina nueva, buscá qué pantalla del producto ya hace algo parecido

El 28/09 leí «aun no veo el plan, las tareas y proyectos de cada cliente» como «montá el
tablero DEL cliente adentro de su ficha». Era «mostrá el trabajo del SUPER ADMIN atribuido a
ese cliente» —same-tenant, sin `?ws=`, sin escrituras cruzadas—, que es exactamente lo que ya
hacía la ficha de un lead ganado en Customer Success. **El pedido decía «los de SUPER ADMIN»
y lo leí como una aclaración de permisos cuando era una aclaración de sujeto.**

Costó un relevo de 4 lectores con refutación, un endpoint, una lib, un componente, un test y
una máquina de `?ws=` en dos archivos más — todo borrado, para un problema que el producto no
tiene. Lo que tenía que haberme frenado estaba a la vista:

- **La misma ficha ya tenía «Inspeccionar»**, que es literalmente «ver el mundo de ese
  cliente». Si el control de al lado hace lo que estoy construyendo, una de las dos cosas
  está mal — y es casi siempre la que estoy construyendo.
- **La pantalla hermana lo resolvía sin la máquina.** Si dos pantallas del mismo producto
  muestran «el cliente X» y una necesita cruzar de inquilino y la otra no, la que cruza es la
  sospechosa.

**La señal es el TAMAÑO: cuando una feature que se pidió en una frase pide una máquina nueva
y grande, la hipótesis a descartar primero no es técnica, es que entendiste otra cosa.**
Preguntar cuesta una frase. Y el corolario para el resto de la casa: la reescritura no se
esconde — se dice qué se borró y por qué, o el próximo agente reconstruye la máquina leyendo
el hallazgo viejo.

# Una lista de nombres de la base se mide contra `information_schema`, no contra las migraciones

Las migraciones son lo que alguien **quiso** aplicar. El esquema es lo que **está**. En
este repo hay migraciones escritas que nunca corrieron —`0157_meta_campaign_drafts_workspace`
lo dice en su propio encabezado— así que cualquier lista de tablas o columnas armada
leyendo `supabase/migrations/` es un techo, no un inventario.

Medido el 29/09/2026 sobre `TABLAS_RESET`, la lista que decide qué se vacía de un
inquilino: nombraba **70** tablas, de las cuales **cuatro no existen** y le faltaban
**24** que sí. O sea que «vaciar un workspace» vaciaba **66 de 90**, y lo que quedaba se
arrastraba a la corrida siguiente sin que nada lo dijera.

- **Los nombres que no existen son plausibles y por eso sobreviven**: `archivero` contra
  `archivero_files`, `branding` contra `branding_assets`, `contratos` contra la tabla que
  se renombró. Son strings: ningún compilador los mira y ningún test que no consulte la
  base los puede ver.
- **Y el modo de falla los esconde.** Un `delete` de supabase-js contra una tabla que no
  existe devuelve error igual que un choque de FK, así que un bucle con reintentos lo
  trata como un problema de integridad y avisa tres pasadas después, en críptico. Hay que
  distinguir el `42P01` del `23503` y decirlos distinto.
- **La consulta va escrita al lado de la lista**, para que el que agregue una tabla sepa
  cómo remedirla: `select c.table_name from information_schema.columns c … where
  c.column_name = 'workspace_id'`.
- **Y una lista, no dos.** El reset y el borrado hacían la misma pregunta; con dos listas,
  la que se queda vieja es por donde quedan las filas huérfanas.

# Un ancho que sale de una métrica tipográfica no se verifica en un solo motor

El 29/09/2026 el dueño reportó un título cortado, yo lo medí en Chromium y NO se cortaba.
Los dos teníamos razón: sobraban **2,3 px**.

La causa es que **un `<input>` no mide su texto**. Su `max-content` sale del atributo
`size` (20 por default) contado en **avances del dígito «0» de la fuente activa**, y el
`width:100%` que declare es inerte en esa cuenta. O sea que el ancho de la caja depende de
la FUENTE y no del contenido:

| | ancho |
|---|---|
| Geist 600/20 | 308 px de borde-caja |
| la fallback (`sans-serif` → Arial) | 275 px |
| WebKit, misma fuente | 297 px |

Con el texto en 285,7: **sobran 2,3 px en Chromium, faltan 8,7 en WebKit y faltan 30,4
mientras la webfont no llegó** (`display=swap`). Sobre el catálogo de 70 nombres, cuatro
ya se cortaban en el caso más favorable.

- **Un margen de 2 px no es «entra», es «entra por casualidad».** Cuando lo que decide es
  una métrica de fuente, el número a mirar es el MARGEN, no el booleano «se corta».
- **El primer paint cuenta como otro motor.** Con `display=swap`, el layout se calcula una
  vez con la fallback: si ahí no entra, se ve cortado y después salta.
- **Y si el padre se dimensiona al hijo, un `margin` negativo se descuenta dos veces.** El
  par `paddingLeft:10 / marginLeft:-10` (para que el foco respire) le comía otros 10 px, y
  es lo que invalida `field-sizing: content` como arreglo: deja la caja MÁS chica que el
  texto en los dos motores.
- **La salida no era medir mejor: era no usar un input.** Un `contentEditable` ocupa
  exactamente lo que dice, y además puede recortar con «…», cosa que un input no.


# `npm test` antes del `git add` no ve los archivos nuevos

Los guards que barren el repo —el de voseo, el de los tokens `var(--fs-*)`, el de las
rutas de `/admin/dev`— enumeran con `git ls-files`, que lista **el ÍNDICE y no el disco**.
Un archivo nuevo sin stagear es invisible para ellos.

Medido el 29/09/2026: `npm test` dio **2619 en verde** con un `volvé` escrito en un módulo
nuevo, y el mismo comando dio **2618 y un rojo** después del `git add` — el guard de voseo
recién ahí pudo verlo. O sea que la corrida anterior al commit no probaba lo que parecía.

- **Con archivos NUEVOS, el orden es `git add` y después `npm test`.** El pre-push lo
  agarra igual, pero ahí ya está el commit escrito y el mensaje redactado.
- **Y vale al revés:** un archivo borrado que sigue en el índice se sigue revisando, así
  que un guard puede fallar por algo que ya no está en el disco.

# Esconder un control es distinto de esconder la PANTALLA donde vive

Una condición del tipo «mostrar esto sólo si hay algo adentro» parece de sentido común y
se vuelve otra cosa en cuanto uno de sus términos es un PERMISO: deja de decir «si hay
contenido» y pasa a decir «si vos podés».

Medido el 29/09/2026 sobre la ficha de un cliente. La tab «Equipo» existía si
`equipo.length || altas.length || puedePedir`, y `puedePedir` lleva `!cuentas.superAdmin`
porque el super admin no PIDE altas: crea. En un cliente con **cero usuarios** ese botón
era lo único que habría estado adentro, así que la tab entera desaparecía **sólo para
él** — y lo que no veía era justo «no hay nadie adentro de esta cuenta», el dato más caro
de ese cliente.

| | fila de tabs, misma ficha |
|---|---|
| la agencia | `["Tablero", "Equipo"]` |
| el super admin | `[]` |

- **Un permiso apaga el CONTROL, no el contenedor.** La vista se ofrece igual y adentro
  falta el botón que esa persona no puede usar.
- **El modo de falla no lo puede reportar nadie**: cada uno ve su versión y las dos son
  coherentes. Salió porque un usuario mandó una captura, no porque algo fallara.
- **Y el dueño lo va a leer como «me mostrás algo distinto de lo que ven mis usuarios»**,
  que es lo peor que puede pensar de una pantalla de administración. Antes de condicionar
  cualquier cosa en una ficha que dos roles miran, la pregunta es «¿esto lo veo distinto
  yo?» — y se contesta abriendo la misma pantalla con las dos sesiones, no leyendo.

# Una caja cuyo alto es un TOPE cambia de tamaño, y se lleva puesto lo que cuelga adentro

`max-height` no es un tamaño: es un techo. Está bien para un diálogo —una caja que
pregunta algo en una frase no tiene por qué medir 720 px— y está mal para cualquier
pantalla cuyo contenido cambie de alto sin dejar de ser la misma pantalla.

Medido el 29/09/2026: la ficha de un cliente pasaba de **720 px a ~430** al elegir, en el
tablero que tiene adentro, la vista de Equipo de un cliente sin gente. Es el segundo
reporte del mismo pedido: «JAMÁS achiques el tamaño de un detail según lo que contenga
dentro».

- **Si adentro vive algo que cambia de tamaño, el alto es un NÚMERO.** El tope se queda
  igual encima, para que un alto mayor que la ventana no saque el pie de la vista.
- **Y el borde que se mueve se lleva lo que cuelga.** Lo que el dueño mostró no fue el
  salto: fue un menú cortado a la mitad. Esa causa era OTRA —el contenedor lleva
  `overflow: hidden`— y fijar el alto sólo la disimulaba: medido después, el panel seguía
  terminando 140 px por debajo del borde.
- **Un panel anclado que pueda vivir adentro de un contenedor con `overflow` se portalea
  al `body` y se ubica por cuenta**, nunca con un `top/right` fijo: ese par no se da
  vuelta cuando no entra abajo ni se topa contra el borde de la ventana. Y el efecto que
  lo ubica lleva al panel en sus dependencias, o queda en `left:0, top:0` sin un error.

# «Más» y «otro» afirman que ya hay uno

Un estado vacío redactado en comparativo miente sobre lo que hay. «Nadie **más** entra a
la cuenta de Brigitte» se lee como «Brigitte sí entra y nadie la acompaña», y lo que
pasaba era que esa cuenta tenía **cero** usuarios: no podía entrar nadie, ella incluida.
El dueño lo leyó como una falla del producto — «pareciera que se bugeó».

**Antes de escribir un vacío, mirá si el cero incluye al sujeto de la frase.** Si lo
incluye, el comparativo es falso y además esconde el hecho más caro de esa pantalla.

# Un control que decide cuántos mensajes salen sólo puede ESPACIAR, nunca apretar

Cuando una pantalla pasa a gobernar la frecuencia de algo que ya sale solo —un aviso, un
reporte, un recordatorio—, el número que ya estaba en el código no se reemplaza: se toma
el **mayor** de los dos. Lo que pide quien emite es el TECHO de frecuencia y está puesto
por algo (el cron de alerta crítica revisa cada 10 minutos y avisa cada hora a propósito:
detectar rápido e insistir seguido son dos cosas distintas).

```ts
const minutos = Math.max(delCallSite ?? 0, loQueEligioElNegocio);   // frecuenciaEfectiva
```

Con un `??` en vez del `Math.max`, elegir «cada vez» **borra** la protección del call
site y la pantalla pasa a poder producir MÁS mensajes que antes — lo único que un control
así no puede hacer. Con el `Math.max`, en el peor caso produce uno de menos, que es
exactamente lo que la persona eligió. Vale igual para un tope de gasto, un límite de
reintentos o cualquier cosa donde el código puso un número defensivo.

⚠️ **Y dónde CORTA decide si el hecho queda en la bitácora.** El mismo mecanismo va en
lugares opuestos según qué se esté espaciando: en un AVISO, después de escribir el feed
—el hecho pasó igual y tiene que quedar, como con el interruptor: se apaga el WhatsApp,
no el registro—; en un REPORTE, antes, porque ahí el feed ES el mensaje. La pregunta que
lo resuelve: **¿estoy espaciando el MENSAJE o el HECHO del que habla?**

⚠️ **Y antes de contestar «esto no se puede configurar», mirá la dimensión de al lado.**
El pedido fue «el disparador se DEBE poder configurar» y la primera respuesta —medir que
para 60 de 65 mensajes el disparador es el call site, y dejarlo en prosa— era cierta y
contestaba media pregunta. QUÉ lo produce no es una opción; CADA CUÁNTO llega sí, y era
la que faltaba. El pedido volvió textual: «el "Qué lo dispara" NO es editable». Lo que lo
destraba es buscar el MECANISMO antes que el control: el número ya existía y estaba
cableado en cada call site en vez de salir de la pantalla.

# Un lienzo DIBUJA UNA AFIRMACIÓN: las aristas salen del DATO, no de un gesto

Una flecha que se bifurca dice «acá el motor decide». Se lee sin abrir nada y parece
la estructura del sistema, así que un diagrama miente con más autoridad que un campo
en un formulario: nadie va a auditar una flecha.

De ahí las dos reglas de cualquier pantalla tipo flujo en este repo:

1. **Las aristas se DERIVAN del dato, no se configuran.** Lo que conecta dos cosas ya
   está escrito y el motor ya lo ejecuta (el orden de los pasos, una condición, la
   clave de la secuencia que sigue). Nadie arrastra una flecha — el editor de flechas
   del funnel se construyó, el dueño lo llamó «rebuscado» y se borró. Y el beneficio
   no es sólo de UX: una arista derivada no puede quedar vieja respecto del motor, y
   una dibujada a mano sí.
2. **Sólo se dibuja la rama que el motor EJECUTA.** Se ata con un guard que lee las
   condiciones de la fuente del motor y falla si las dos listas se separan, en
   cualquiera de las dos direcciones (molde: `CONDICIONES_VIVAS` en
   `lib/flujo-conversacion.ts` + `tests/flujo-conversacion.test.ts`, que lo mide contra el
   `switch` de `cumpleFila` en `lib/flujo-grafo.ts`: lo que evalúan el motor y «Probar»).

⚠️ **Y al medir qué ejecuta el motor, contá las líneas que DECIDEN, no las que nombran
el campo.** La primera versión de ese guard sumaba el SANEO —que sólo dice qué valores
se guardan— y concluía que el motor evalúa una condición que ignora: habría dado
permiso para dibujar la bifurcación muerta. Lo que decidía era un `if` del despachador o
el `findIndex` que salta al paso siguiente; desde el flujo con ramas (08/10/2026), el
`switch` de `cumpleFila`.

⚠️ **Y el layout de /chatbot no se guarda.** Guardar posiciones es un campo nuevo, y en
este repo los pasos pasan por un saneo que reconstruye cada uno CAMPO POR CAMPO y descarta
lo que no conoce: el layout se perdería en silencio en el primer guardado hecho desde otra
pantalla. Cuando se decidió, la secuencia más grande de la base tenía TRES pasos; desde el
08/10/2026 una convertida tiene hasta 12 tarjetas (el tope es 60) y la razón es otra: el
flujo es un ÁRBOL (un padre por tarjeta, las ramas se juntan con «Ir a»), así que el layout
se DERIVA del dato igual que las aristas (`lib/flujo-conversacion.ts`). Las posiciones
guardadas son del lienzo de /mensajes (`app/agencia/FlujoAviso.tsx`).

## Y el gesto de un lienzo: pointer events, con tres trampas medidas

No es HTML5 drag-and-drop —acá no se transporta nada, se mueve un valor continuo— y no
aplican las reglas de la foto que dibuja el SO. Las que sí:

- **`setPointerCapture` RETARGETEA el `pointerup` al elemento que capturó**, así que el
  `e.target` de ese evento es el CONTENEDOR y `closest(...)` devuelve null siempre. El
  nodo del clic se anota en el `pointerdown`. Síntoma: tocar un nodo no abre nada, con
  el handler leyéndose perfecto. Y `releasePointerCapture` puede TIRAR: va adentro de un
  `try` y DESPUÉS de resolver el clic, o una excepción se lleva el clic puesto.
- **`overflow: hidden` no impide que el contenedor se scrollee POR CÓDIGO** (un
  `scrollIntoView`, el foco de un input fuera de cuadro, el buscar-en-página). Ahí el
  `transform` y lo que se ve dejan de coincidir y el clic cae al lado: medido, 330 px de
  corrimiento con el transform intacto. `onScroll` devuelve el scroll a cero.
- **`ResizeObserver.observe()` dispara al suscribirse**, así que cualquier cosa que
  reinstale el observer vuelve a encuadrar y deshace el paneo que la persona acaba de
  hacer — se lee como que el lienzo «rebota solo». Reencuadrar es una decisión: se
  guarda la firma de lo último encuadrado y sólo el botón de centrar la fuerza.

⚠️ **Y `innerText` aplica `text-transform`.** Un rótulo en `uppercase` vuelve en
MAYÚSCULAS, así que una verificación que busca el texto como se escribió da «no
aparece» sobre una pantalla perfectamente abierta. Antes de diagnosticar el código, leé
`aria-pressed` o el `textContent`, que no se transforman.

## Y CUÁL pantalla lo dice quien pide, no la medición

Un relevo contesta «¿dónde está el modelo que más se parece a esto?». Eso NO es
«¿qué pantalla tenía abierta?», y la segunda decide el trabajo entero. El pedido del
lienzo se midió bien —el modelo con filas y con ramas estaba en el Chat Agent— y se
construyó en la pantalla equivocada, porque quien lo pidió estaba mirando otra.

⚠️ **Y el aviso estaba en el propio relevo.** En su lista de «no medido» decía, con
todas las letras, «cuál de las dos pantallas quiere… es la ambigüedad que más cambia
el alcance». **Un «no medido» que el relevo describe como lo que más cambia el
alcance no es una nota al pie: es la pregunta.** Si no se puede medir y decide el
trabajo, se pregunta antes de construir — cuesta una frase, y es la misma regla que
«al SEGUNDO "sigue igual", se pregunta».

Lo que abarata equivocarse igual: que la pieza nazca sin saber a qué pantalla sirve.
El lienzo se pudo mudar en una hora porque `app/_components/Lienzo.tsx` no sabe qué
dibuja — lo propio de cada flujo son el grafo y los editores por nodo.

⚠️ **Y si la misma pieza va a servir a dos pantallas, se extrae ANTES de la segunda,
no después.** Copiar cuesta cero y deja las mismas trampas resueltas en dos lugares.
Lo que hace visible la mudanza es que los guards que leen la ruta vieja se pongan
ROJOS: un test que lee un archivo por su ruta hay que mudarlo a mano, y la versión
silenciosa —un guard que sigue verde sobre un archivo que ya no manda— es peor.

⚠️ **Y un guard que RECORTA el archivo antes de buscar elige un universo a ojo.** El
del `margin: 0 auto` leía los 1400 caracteres anteriores al montaje del lienzo; el
contenedor estaba ochenta líneas más arriba, así que devolver el bug pasó en VERDE.
Si la afirmación es «esto no vuelve a aparecer», el universo es el archivo entero.

## Y qué es un nodo, qué flota, y cómo se arrastra

- **Un nodo es algo que OCURRE, no un campo del objeto.** «Te llega al grupo de
  WhatsApp» era un nodo y el dueño lo tumbó con la frase que lo resume: «es un paso
  que no hace nada». Por dónde sale un mensaje es una propiedad del mensaje. La
  prueba antes de agregar un nodo: **¿esto ocurre, o esto es un campo?** Si es un
  campo, va adentro del nodo al que pertenece — incluida su advertencia. La espera de
  /chatbot es la prueba al revés: era un campo (`delay_horas`, dibujado sobre la flecha y sin
  forma de quitarla) y el 08/10/2026 pasó a ser la tarjeta «Esperar», porque ocurre.
- **Todo lo que no es el dibujo FLOTA sobre el lienzo.** Con topbar, cabecera y pie
  en sus propios renglones se le comían ~180 px de 620 y el grafo entraba al 33%:
  tarjetas del tamaño de una uña. Y lo que estaba abajo queda DEBAJO, no al lado —
  el botón de guardar terminó pintado detrás del dibujo. La capa flotante va con
  `pointerEvents: none` y su contenido con `auto`, o la franja se traga el paneo.
- **Al arrastrar un nodo (en el lienzo de /mensajes: el de /chatbot no guarda posiciones),
  el delta del mouse se DIVIDE POR LA ESCALA.** Al 50%, mover
  el cursor 100 px tiene que mover la tarjeta 200 en coordenadas del grafo. El
  guardado va al soltar y con un respiro (un POST por `pointermove` son sesenta por
  segundo), es optimista, y las posiciones se PODAN: la coordenada de un nodo que ya
  no existe sobrevive para siempre y el próximo con ese id nace en su lugar.

⚠️ **Y un componente que puede no mostrar nada tiene que poder NO DIBUJARSE.**
Envuelto en una tarjeta desde afuera, un `return null` se convierte en una cajita
vacía flotando. El envoltorio lo elige quien monta y lo APLICA el componente,
después del early-return.

⚠️ **Y DOS COMPONENTES QUE LLAMAN AL MISMO SETTER DE UN OBJETO COMPLETO SON UN BUG
ESPERANDO.** `setFlujo(id, flujo)` reemplaza el flujo entero: con dos dueños, cada
uno con su copia, el que guarda segundo escribe la suya vieja encima. No hace falta
que se pisen hoy — basta con que los dos puedan escribir. La cura no es coordinarlos,
es que haya uno; y al absorber al otro se enumera lo que tenía de propio antes de
borrarlo.

# Un BORRADOR no es un DEFAULT, y publicar promueve lo GUARDADO

Cuando una pantalla pasa a tener «guardar sin publicar», aparecen dos campos donde
antes había uno —lo que el motor manda y lo que alguien está escribiendo— y tres
reglas que no se ven en el código:

- **El borrador NO se hereda.** En este repo los settings de un cliente heredan los
  del dueño campo por campo (`leerStore` en `lib/plantillas.ts`), y eso es correcto
  para todo lo terminado. Un borrador no está terminado: heredado, cada cliente abre
  la pantalla con un «Sin publicar» que no escribió y al publicar publica en SU
  negocio el borrador de la agencia. Es el ÚNICO campo con esa excepción, y la
  excepción va escrita en el merge — no en el tipo, que nadie abre.
- **El motor no puede leerlo.** Lo que sale sigue saliendo del campo publicado, y eso
  se ata con un guard que barre los módulos del motor buscando el nombre del campo.
  Si el motor pudiera leerlo, «solo cuando le doy a publicar, se publica» sería falso
  sin que nada avise.
- **Publicar manda el borrador PRIMERO y cancela el debounce.** El autoguardado tiene
  un respiro (uno por tecla serían sesenta por segundo), así que publicar «lo
  guardado» sin ese paso publica el texto de hace un segundo: no da error, sale la
  versión anterior y el cartel dice «Publicado ✓».

⚠️ **Y «salir de la vista, de la manera que sea» son DOS caminos.** El desmonte del
componente cubre cerrar y cambiar de ítem; `visibilitychange` cubre cambiar de pestaña
y cerrar el navegador, donde el desmonte **no corre**. Lo que queda sin cubrir es la
ventana del debounce, y eso se escribe en el comentario: un «no se pierde nada» sin su
letra chica es una promesa que el código no puede cumplir.

⚠️ **Y el borrador que iguala a lo publicado se BORRA.** Un «Sin publicar» sobre un
texto idéntico al que sale es un cartel que no se puede apagar — deshacer a mano lo que
se escribió tiene que devolver la pantalla a limpio.

⚠️ **Y AL MOVER UN CONTROL FLOTANTE A UNA ESQUINA, ENUMERÁ QUÉ YA VIVE AHÍ.** Un lienzo
tiene cuatro y las cuatro están tomadas. Medido el 30/09/2026: la barra de zoom se mudó
abajo a la izquierda —lo pidió el dueño— y el panel del editor de un nodo, de 328x355,
la tapaba ENTERA. La esquina la elige quien usa la pantalla; lo que se mueve es lo que
ya estaba. Y si el control nuevo repite el rótulo de uno que ya existe, hay dos botones
que dicen lo mismo y hacen cosas distintas: lo delató el strict mode de Playwright
(«resolved to 2 elements»), no leer el código.

# Un «no cambió nada» sobre PRODUCCIÓN se contesta con `git log`, no releyendo el código

En este clon hay dos sesiones y el árbol de trabajo casi nunca está limpio, así que **«lo
escribí» y «está desplegado» son dos preguntas distintas** y sólo una la contesta el editor.

Medido el 30/09/2026: se implementó el editor de nutrición del CRM entero —cinco archivos,
verificado en el navegador— y la sesión siguió con los pedidos siguientes sin commitear.
Martín abrió `hola-mako.com`, miró la subtab y escribió **«No cambió nada el editor de
nutrición»**. Producción servía la versión anterior, que es lo correcto. El reporte se lee
exactamente igual que una feature rota y manda a depurar código que está bien.

- **Ante «no cambió», el primer comando es `git log --oneline -5 -- <archivo>` y `git status`**,
  y recién después el código. `vercel ls` para la otra mitad: pushear no es desplegar.
- **Y un pedido que se implementa y no se commitea en la misma tanda es trabajo que, para
  quien lo pidió, NO EXISTE.** Si entran pedidos nuevos encima, se cierra el anterior primero
  o se dice en el chat que quedó sin salir — el modo de falla es que el próximo reporte lo
  describa como un bug, y entonces se paga dos veces.

# Si un TIPO declara qué SIGNIFICA un campo, lo que hay que medir es la implementación

Un comentario en el tipo no es una implementación, y cuando los dos se contradicen **gana el
código y nadie se entera**: no hay error, hay un valor plausible.

Medido el 30/09/2026: `EmbudoEnDetalle.nombre` dice textual «el nombre que la persona ve: el
del producto si lo hay, si no el del embudo», y la action devolvía `cfg.nombre` pelado. El
desplegable del CRM decía «Negocio que Escala» y el título del pop-up del mismo embudo decía
**«Funnel principal»** —el nombre que puso la migración 0170, igual en todos los workspaces—.
Martín: «eso está muy mal».

- **Y el costo casi nunca es cosmético: hay que mirar QUIÉN MÁS lee ese campo.** Acá ese
  título es un `<input>`: era el `defaultValue` del campo que renombra y el valor contra el
  que se compara para decidir si escribir. Quien renombraba arrancaba desde el valor
  equivocado, y tipear el nombre que el producto YA tenía contaba como un cambio.
- **La cura es UNA función que llamen los dos lectores**, y un guard que CUENTE cuántos
  lugares resuelven el dato. Dos implementaciones de la misma pregunta no divergen por
  descuido: divergen porque una se arregla y la otra no se entera.

# Un horario que se repite se ancla en la OCURRENCIA ANTERIOR, nunca en `now()`

Todo lo que vuelve a salir —un aviso programado, un recordatorio, un reintento con
cadencia— calcula su próxima vez desde algún lado, y elegir `now()` produce DERIVA: un
mensaje de los lunes a las 9 que sale 9:07 agenda el lunes siguiente 9:07, después
9:14, y una semana sin tick corre el horario para siempre. No da error, manda en el
horario equivocado, y es el modo de falla que nadie reporta porque no se nota.

El repo ya lo tiene de las dos formas: `proximaSalida` de `lib/insistencias.ts` es
`desde + cadaMin` con `desde = ahora` —y su propio comentario dice que la hora es «una
estimación deliberada»— y `proximaOcurrencia` de `lib/cron-aviso.ts` recibe la
ocurrencia **agendada** anterior. Para una insistencia la primera alcanza; para un
horario, no.

- **El ancla es la ocurrencia AGENDADA, no el envío real.** Guardar «cuándo salió» y
  calcular desde ahí es la deriva con otro nombre. Van los dos campos: `proxima_at`
  para calcular y `ultimo_envio_at` para mirar.
- **Y avanza SALTÁNDOSE las perdidas.** Con el cron caído un día, un «cada 2 horas»
  tiene que mandar UNO y seguir en su grilla — no doce de golpe.
- **Marcar va ANTES de mandar, con compare-and-set** (`.eq('proxima_at', <lo que se
  acaba de leer>)`). Al revés, dos invocaciones del mismo tick mandan dos veces, y el
  precedente está medido: 21 pares duplicados el 27/09 por los 7-10 s que el envío por
  WhatsApp retiene el HTTP abierto entre la lectura y la marca. El costo de este orden
  es el opuesto y es el correcto: si el envío falla se pierde UNA ocurrencia, y eso se
  nota menos que dos mensajes iguales en el teléfono de un cliente.

⚠️ **Y UNA HORA DE PARED NO ES UN INSTANTE: la conversión necesita DOS pasadas.** «A las
9» es la hora de alguien, en su zona. Convertirla a un instante leyendo de vuelta un
candidato y corrigiendo el desvío acierta casi siempre — y falla justo en el salto de
horario de verano. Barrido de fuerza bruta sobre 11 zonas × 366 días × 7 horas: **49
casos de 28.182 difieren**, y uno es `America/Tijuana` el 8/3 a las 9:00, o sea la zona
POR DEFECTO de este repo y la hora típica de un aviso diario. Con una sola pasada, ese
día el mensaje sale a las 10 sin un solo error. (La primera versión del test probaba el
15/7 y el 15/12, lejos del salto, donde una pasada también acierta: daba VERDE.)

⚠️ **Y LA ZONA SE CONGELA EN LA FILA, Y LA PANTALLA LA DICE.** Medido el 30/09/2026: de
los 10 workspaces activos, SEIS no tienen `mako.timezone` y caen a `America/Tijuana`; si
la averiguación falla, la hora local cae a 12. Decir «a la mañana» sobre eso es afirmar
algo que nadie verificó — «9:00 de America/Tijuana» deja que el dueño lo vea y lo
corrija. Y resolverla en cada tick sería pagar la carrera de red de `tzDeWorkspace` por
workspace y por tick, y dejar que el horario se mueva solo el día que conteste otra cosa.

⚠️ **Y EL AGENDADO VA EN UNA TABLA, NO EN EL JSON DE CONFIGURACIÓN.** Dos razones, las
dos medidas: el store de plantillas SE HEREDA del dueño campo por campo, así que un
«todos los lunes a las 9» guardado ahí se le aplica a los otros nueve workspaces por
default; y el store lo reescribe el navegador entero mientras el drenador escribe
`proxima_at` en cada tick, que es la carrera que la mig 0161 ya documentó.

⚠️ **Y UNA TABLA NUEVA CON `workspace_id` TOCA DOS ARCHIVOS: el `.sql` y
`TENANT_TABLES`.** `getTenantDb()` es PASSTHROUGH para lo que no está en ese `Set` — no
«sin scope»: passthrough. Medido con `avisos_programados`: la lectura devolvía la fila
de cualquier workspace y el drenador de un cliente avanzaba y mandaba las filas de
todos. No da error; contesta con las filas de más. El compilador no ve nada: es un `Set`
de strings.

# El hover de una tarjeta es la UNIÓN de sus hijos, y un `margin` no recibe eventos

Un contenedor `position: absolute` **sin ancho ni alto** no tiene caja propia: los
descendientes absolutos no cuentan para su shrink-to-fit, así que mide 0×0 y su región
de hover es sólo la unión de los hijos posicionados. Cualquier separación entre dos de
esos hijos es aire del ABUELO, y cruzarlo dispara `pointerleave`.

Medido el 30/09/2026 con Playwright, moviendo el cursor en diez pasos de una tarjeta al
botón «＋» que cuelga 8 px a su derecha: **se apagaba en el paso 9 de 10**. No era
difícil de apretar — era INALCANZABLE, y el dueño lo reportó como «no me deja apretar
el botón de +, porque al intentar arrastrar el cursor desaparece».

- **La cura es que no haya aire**: el botón va adentro de un elemento que ARRANCA en el
  borde del vecino y se come la separación como `padding`. Un `margin` no sirve: el
  margen no recibe eventos de puntero.
- **La marca que exime del gesto va en el ENVOLTORIO, no sólo en el botón.** Un
  `pointerdown` en el padding no encuentra el nodo —el envoltorio no está adentro de la
  tarjeta— y el lienzo lo toma como un paneo.
- **Un control que se deshabilita NO se desmonta.** Estaba montado detrás de
  `!ocupado`, así que el primer clic lo hacía desaparecer: un control que se borra bajo
  el dedo se lee como un clic que no registró.
- **Y durante un arrastre con `setPointerCapture` no se dispara ni un enter ni un
  leave**: el estado de hover queda congelado, así que todo lo que cuelgue de la
  tarjeta hay que moverlo a mano en el mismo handler o se queda flotando en el vacío.

⚠️ **Y AL SACAR UN NODO DE UN LIENZO, SU HECHO SE QUEDA SIN DUEÑO.** El título del nodo
del mensaje ERA «por dónde te llega» — el único lugar de la pantalla donde ese dato se
afirmaba. Renombrarlo, que es lo que se pidió, lo habría borrado sin que nada fallara.
Antes de renombrar o borrar un nodo, la pregunta es **qué AFIRMA hoy** y dónde se dice
después.

# Un token `{{…}}` se parte solo contra las marcas de WhatsApp

La itálica del dialecto de la casa es `_texto_`, y un token de variable trae guiones
bajos adentro: con dos tokens en la misma línea, el `_` de uno cierra con el del otro y
`Hola {{lead_nombre}}, mirá {{link_crm}}` se dibuja «Hola {{leadnombre}}, mirá
{{linkcrm}}» en itálica. Con una negrita en el medio salen etiquetas CRUZADAS, el
navegador reparenta, y el serializador del editor devuelve un texto distinto del que se
escribió — o sea que además corrompe lo guardado, sin que nada falle.

- **Los tokens se separan ANTES de aplicar las marcas, y en los DOS renderers**: el que
  escribe y el que lee. Con uno solo arreglado se ve bien de un lado y partido del otro.
- **El token se inserta como TEXTO PLANO, nunca como un chip.** El serializador aplana
  todo lo que no sea negrita, itálica o tachado y NO avisa: un `<span>` que diga «Nombre
  del lead» se guarda como ese texto y la variable desaparece entera.
- **Y no se reusa la sustitución de otra área.** La de la nutrición acepta `{una llave}`,
  su regex no tiene dígitos y la misma función decide qué parámetros se registran en
  Meta: ampliarla convertiría un `{1}` de un copy en un candidato.

⚠️ **LA REGLA DE ADMISIÓN DE UN CATÁLOGO DE VARIABLES ES «lo que el emisor YA TIENE en
la mano».** Cero queries nuevas y cero proveedores: una llamada a Meta son ~900 ms
medidos, y un webhook con `maxDuration` que espera eso es un aviso que no sale. Para un
número que hay que ir a buscar va el LINK a la pantalla donde está fresco.

⚠️ **Y SE OFRECE SÓLO LO QUE ESE MENSAJE PUEDE RESOLVER.** Lo que no se resuelve sale
CRUDO —a propósito: crudo se nota, borrado deja el mensaje cojo y nadie se entera— así
que el filtro del selector es lo único que evita que un token llegue así al cliente.

⚠️ **Y LA SUSTITUCIÓN VA EN EL CALL SITE, CUBRIENDO LOS RETORNOS QUE SE SALTEAN EL
MODELO.** El generador de texto con IA tiene tres salidas y dos no pasan por el modelo
(la respuesta vacía y el `catch`): con la sustitución sólo en el camino feliz, la
variable falla exactamente cuando falla la IA, que es cuando menos se la mira.

# Agotar los PASOS de un tool-use no es un fallo: el modelo ya trabajó y falta que escriba

Un loop de herramientas que llega a su `maxSteps` tiene todo el trabajo hecho y guardado
en el hilo (las `tool_calls` y sus resultados). Lo único que falta es la redacción, que es
justo lo que no pudo hacer solo — con `tools` puesto puede volver a llamar en vez de
contestar. Devolver un centinela ahí tira el desenlace del ÚNICO proveedor que contestó.

Medido el 30/09/2026: Gemini contestó **8 × HTTP 200 en nueve segundos** —una fila en
`anthropic_usage` ES un 200, porque `recordUsage` corre después del `throw`—, agotó los 8
pasos sin redactar, el doer lo descartó con un `continue` **mudo**, y el veredicto terminó
juzgando con los errores de los proveedores que no importaban: el dueño leyó «se acabaron
tus 4 cuentas de IA» con el día al 21% de su cuota.

- **Un pedido más SIN herramientas lo cierra** (`cerrarSinTools` en lib/ai-cheap.ts). Va
  sin `tools` y **no** con `tool_choice: 'none'`: ese valor lo aceptan OpenAI y Groq y no
  está garantizado en la capa compatible de Gemini. Y envuelto: si el cierre falla, vuelve
  el centinela y decide el caller.
- ⚠️ **Y NINGUNA SALIDA DE UN LOOP DE PROVEEDORES PUEDE SER MUDA.** La regla «todos los
  errores, no sólo el último» ya estaba escrita y no cubría los `continue`: un `continue`
  que descarta el resultado de quien SÍ contestó es evidencia que se tira antes de juzgar.
  Cada salida escribe su motivo en la lista con la que se decide.

# Si el `[]` de una función significa DOS cosas, el caller tiene que preguntar CUÁL

Una lista vacía es una respuesta perfectamente válida, así que un caller que lee una sola
de las dos lecturas no falla: contesta de menos, en silencio y para siempre.

Medido el 30/09/2026: `clavesCargadas` devuelve `[]` por «este workspace no tiene ninguna»
y por «este proveedor no admite varias cuentas» —el caso de OpenAI, que cobra por token, y
su propio módulo lo dice en el comentario: *«los dos casos dan [] y se distinguen
preguntando primero por el catálogo»*—. `provsDe` no preguntaba, así que **OpenAI no
existía en NINGUNA cascada del producto desde el 13/08/2026** (commit `85a020b8`): es el
último escalón de `CASCADA_GRATIS`, `CASCADA_DOCS` y `CASCADA_STT`, o sea el respaldo que
existe justo para cuando los gratis se caen, y no corrió ni una vez en seis semanas. Y
como `cheapDisponible()` y `sttDisponible()` iteran eso, a un workspace cuya ÚNICA key sea
de OpenAI el producto le contesta «no tenés IA» teniéndola cargada.

- **La decisión se muda a un módulo PURO para que tenga test** (`clavesAProbar` en
  lib/ia-keys.ts). Adentro de un `server-only` ningún test la puede importar, y termina
  siendo lo único sin red justo donde más duele.
- **El olor: una función cuyo comentario explica los dos significados de su vacío.** Si el
  módulo tuvo que aclararlo, hay un caller que no lo leyó.

# Un texto de error de un tercero FABRICA veredictos: filtralo por ÍTEM, no por la bolsa

Cuando la causa de un fallo se elige con una regex sobre los errores juntados, cualquier
error que traiga por casualidad la palabra que se busca decide por todos.

Dos casos medidos el 30/09/2026, los dos sobre el mismo mensaje al cliente:

- **El 413 de Groq trae `rate-limits` en la URL de su documentación** («Request too large
  … please reduce your message size … Visit https://console.groq.com/docs/rate-limits»),
  así que la regex de cuota lo contaba como cuota agotada. Dos daños: le echa la culpa a
  las cuentas del cliente por algo NUESTRO (le mandamos un prompt que no entra en el tope
  de entrada) y le dice «reintentá en un rato» sobre lo único que NO se destraba con el
  tiempo. Es una causa aparte, sin link y sin «reintentá».
- **Un proveedor que rebota SIEMPRE no es un escalón de la cascada: es una línea de «rate
  limit» garantizada en la lista con la que se decide.** Mistral devuelve 429 siempre
  (`limit-req-minute: 0`) y las siete keys de Cerebras devuelven 402. Antes de dejar un
  proveedor en una lista, **probá la key que YA está en la base**.

El filtro **saca el error de la bolsa**, nunca descarta la bolsa: si otro proveedor rebotó
con un 429 de verdad, ése sigue siendo el veredicto. Al revés es el mismo bug con el signo
cambiado.

⚠️ **Y UN NÚMERO QUE SALE DE CONTAR FILAS NO PUEDE AFIRMAR INTENTOS.** «Probé tus 4 cuentas
y las 4 me rebotaron» mezclaba dos preguntas en una variable: cuántas keys tiene cargadas
el cliente (que es la que elige la RAMA del mensaje — con dos o más, pedirle «cargá otra»
es un insulto porque ya lo hizo) y cuántas se probaron de verdad. Cada pregunta, su campo;
y si el dato no se tiene, no se escribe el número.

# Un cartel de la PLATAFORMA no es un turno de la conversación

Todo lo que se guarde como algo que el asistente DIJO se le devuelve al modelo como su
propia biografía, y el modelo la continúa. Un «no pude por tus cuotas» guardado con
`role: 'assistant'` le enseña una caída que nunca tuvo.

Medido el 30/09/2026: después del cartel de fallo, MaKo arrancó el turno siguiente con
**«Ya estoy de vuelta»**. No era una alucinación — era coherencia con el historial que le
dimos. El dueño lo reportó como «es aún más raro».

- **El cartel se MANDA y no se guarda.** La persona tiene que leerlo; el incidente queda
  donde se audita (el log, las filas de uso, la marca del rebote). Diagnóstico y
  conversación son dos trabajos y no comparten campo.
- **Lo que escribió la PERSONA se guarda siempre**, pase lo que pase.
- **Contá las salidas que escriben un cartel antes de marcarlas**: eran TRES y lejos entre
  sí (el `catch` del modelo, la guarda de «ningún proveedor contestó» y el bloqueo por
  respuesta inválida). El guard busca cualquier línea que use el texto de aviso, así caza
  también la cuarta.
- ⚠️ **El olor: el modelo dice algo sobre SÍ MISMO que nadie le contó.** Lo primero que hay
  que mirar no es el prompt: es qué hay guardado en el historial con su nombre.

# Un prompt que ORDENA usar algo que no se mandó no es una instrucción: es una trampa

Si el system nombra herramientas una por una y dice «úsalas», el modelo las llama —y si
no viajaron en el request, el turno no tiene desenlace bueno. Medido el 01-02/10/2026
contra las dos APIs, con el preámbulo del doer (8.516 caracteres) y la lista de tools
vacía: **Groq contesta HTTP 400** («Tool choice is none, but model called a tool», 3/3) y
**Gemini contesta HTTP 200 con el contenido vacío** y `finish_reason: tool_calls` (2/2).
Con un system corto y la misma lista vacía, los dos contestan perfecto.

⚠️ **Y SACAR EL CAMPO `tools` DEL BODY NO ARREGLA NADA: falla igual (2/2).** Lo que rompe
es el texto. Es «una regla en un prompt no es una regla» con el signo dado vuelta — un
prompt que PROMETE una capacidad que la API no concede.

- **El bloque de herramientas del prompt cuelga de que HAYA herramientas**, y el system se
  arma DESPUÉS de resolverlas. Si se arma antes, no las puede mirar: así estaba.
- **Los nombres se escriben DESDE el array que viaja**, no a mano. Enumerarlos en prosa
  hace que cualquier recorte posterior de la lista vuelva a producir esto.
- **`tools: []` no es «no mandar herramientas»**: el proveedor resuelve `tool_choice` a
  `none`. Con la lista vacía no viajan ni `tools` ni `tool_choice`.
- ⚠️ **Y EL CONTRATO SE APLICA AL EJECUTAR, NO SÓLO AL DECLARAR.** Gemini llamó una tool
  que sólo estaba en el TEXTO del system y el código **la ejecutó**: nadie miraba la
  lista. El caso caro no es una lectura de más — es la acción que crea algo. La guarda va
  con un CORTE (segundo rechazo → salir), o una tool fantasma quema los pasos del turno.

# Al SACAR un bloque de prompt, enumerá qué reglas vivían adentro

Un prompt largo acumula reglas de temas distintos, y la que se pierde al recortarlo no da
ningún error: cambia lo que el modelo contesta.

Medido el 02/10/2026. Al partir el preámbulo del doer se fue con él «nunca inventes
nombres, números ni fechas», que era una frase del protocolo de herramientas. Groq, sin
esa línea, contestó en 548 ms **«hemos tenido 6 reuniones: 3 internas (planificación,
revisión de KPIs, brainstorming), 2 con cliente…»** — seis reuniones que no existen, con
su desglose. **Eso es peor que el cartel de error que el arreglo venía a reemplazar: un
número inventado no se lee como un error.** Con la línea puesta: «Eso lo miro y te lo paso.»

Y la regla ya estaba escrita en el camino barato de al lado (`cheapSys`), que es la señal
de siempre: era la tercera escritura de la misma regla y la única que faltaba.

# Dos clasificadores que contestan preguntas distintas dan el PEOR de los dos mundos

En este repo, sobre el mismo mensaje, el ROUTER contesta «¿cuánto gastar?» (el tier) y
`clasificarIntencion` contesta «¿qué herramientas ve el modelo?». Cada uno acierta lo
suyo. El problema es la compuerta que decide si el turno entra al camino con herramientas:
preguntaba por el **tier**, o sea por el COSTO.

Medido el 01/10/2026: el router escaló «hola mako, como venimos de reuniones los ultimos
15 dias» a sonnet (su regex de datos matchea «reuni» y «ultimo») y el contrato de la
intención dijo `tools: []`. Resultado: el camino caro, con el prompt de tool-use, y cero
herramientas. Sobre los 155 turnos reales de la historia del doer: 5 son charla + tier
barato y andan bien; **8 son el choque y revientan** — y el filtro selecciona justo los
mensajes que piden algo.

**Cuando dos decisiones se derivan de dos preguntas distintas, la compuerta pregunta por
la que gobierna lo que está a punto de pasar**, no por la que estaba a mano.

# Un prefijo de saludo no es el mensaje

La regla decía en su comentario «saludo suelto, corto y **sin nada más**» y la condición
era `t.length <= 80`: un proxy del LARGO, no de «no pidió nada». Con eso, «hola mako, como
venimos de reuniones los ultimos 15 dias» (55 caracteres) era charla — y la pregunta más
importante que hace ese cliente llegaba al modelo sin una herramienta para mirar el CRM.
Medido: la misma frase SIN el «hola» adelante se clasificaba y se contestaba bien.

**Se PELA el saludo y se clasifica el resto**; charla sólo si no quedó nada. Y el
vocabulario del saludo vive en UNA constante que usan el detector y el pelador: ya había
dos listas (la del router incluye `mako`, la del contrato no) y esa diferencia es
exactamente la que produjo el bug.

⚠️ **Y OJO CON UN LOOKAHEAD QUE HACE IMPOSIBLE SU PROPIA ALTERNATIVA.** `cu[aá]nt` seguido
de `(?![a-záéíóúñ])` no matcheó NUNCA: en español después de «cuánt» siempre viene una
letra. Era código muerto, y por eso «cuantas agendas tengo» sin signo de pregunta se
clasificaba como material para anotar en vez de como una pregunta. La regex de al lado
(`INTERROGATIVO`) lo tenía bien desde siempre — dos escrituras, una arreglada.

# Los errores de NUESTRAS credenciales no eligen el texto que lee el cliente

La red de plataforma corre con las keys de la AGENCIA cuando al cliente no le contesta
nadie. Sus errores entraban a la MISMA lista con la que se elige el mensaje.

Medido el 01/10/2026: de las ocho entradas de ese turno, **SIETE eran de la agencia** y los
únicos tres 429 —lo único que matchea la regex de cuota— también. El «te quedaste sin cuota
de IA» que leyó un cliente lo fabricaron nuestras propias keys, con la suya contestando 200.

- **Se separan en el ORIGEN**, en dos listas, y no por un prefijo adentro del texto: una
  convención dentro de una cadena libre es lo que esta casa ya pagó dos veces.
- ⚠️ **Y FILTRARLAS NO ALCANZA.** Con sólo las del cliente el veredicto pasaba a «tu
  proveedor se cayó justo ahora», que también es falso: contestó 200. Faltaba la causa
  honesta —**fue nuestro**—, sin link y sin «cargá otra key», porque no hay nada que él
  pueda hacer. **Un 200 del cliente manda sobre cualquier texto de error.**
- **El veredicto necesita hechos que ningún texto de error puede decir**: cuántas
  instancias se probaron y cuántas contestaron. Cero probadas no es «se cayó tu proveedor».
- ⚠️ **Y un proveedor que rebota siempre hay que sacarlo de TODAS las listas.** Mistral
  salió de la cascada del doer el 30/09 por fabricar el veredicto de cuota, y quedó vivo en
  la red de plataforma — la lista que corre justo cuando el cliente ya se quedó sin nada.

# Si la pantalla DESHABILITA un control, el server aplica lo que ese control significa

Un campo que la interfaz nunca puede cambiar no es una decisión de la persona: es un
**default**. Y si el server lee ese campo para decidir, el default es la política real del
sistema — por más que el comentario de al lado diga que ahí hay una decisión humana.

Medido el 03/10/2026 en la importación de leads del CRM, y las cuatro piezas son correctas
por separado:

| Dónde | Qué hace |
|---|---|
| `app/crm/leads-importar.ts:219` | toda fila nace con `incluir: true` |
| `:144-163` | `recalcular` escribe `motivo` y **nunca toca `incluir`** |
| `app/crm/TablaRevisionLeads.tsx:60` y `:88` | la fila marcada **no se puede destildar** (`disabled`), y se dibuja sin ✓ |
| `app/crm/actions.ts:1498` y `:1507` | el server saltea con `!f.incluir` y le pasa `permitirDuplicado: !!f.motivo` |

Resultado: la pantalla dibuja la fila repetida gris, con la casilla vacía y el cartel «ya
existe», **y el server la crea igual, con la guarda anti-duplicado apagada**. El comentario
que lo gobierna dice, con razón, «lo que se pidió es avisar y dejar decidir» — y la decisión
que la pantalla ofrece **no existe**, porque el único control que la expresa está
deshabilitado justo en esas filas.

- **El par a mirar es `disabled` + el campo que ese control escribe.** Si el control está
  apagado, preguntá quién más baja ese valor. Si la respuesta es «nadie» o «un botón
  opcional», el server está leyendo una constante.
- **Y un contador correcto no lo delata.** Acá el botón decía «Crear 80 leads» contando bien
  (sólo las limpias) mientras el server creaba 80 **más** las repetidas: dos números
  correctos sobre preguntas distintas. Por eso sobrevivió siete semanas a la vista.
- Es el espejo de «esconder el botón no protege nada»: ahí la UI escondía y el server
  protegía; acá la UI muestra que no va a pasar y el server lo hace igual. La pregunta es la
  misma — **quién decide de verdad** — y la respuesta siempre es el server.

# Lo que alguien LEE de la pantalla compartida no es su testimonio

En una llamada donde se muestra el producto, la mitad de lo que dice quien mira es **el
texto de la app en voz alta**. Extraído como si fuera su opinión, convierte copy nuestro en
un pedido del cliente, y un ejemplo sembrado por nosotros en un dato de su negocio.

Mordió **tres veces en la misma llamada** (Leila, 01/10/2026), y las tres se leen perfecto
como testimonio:

| Lo que parece | Lo que es |
|---|---|
| «la cuota 2 de Vertice venció hace 3 días» — el caso de cobranza de la clienta | El `ejemplo:` de un aviso del catálogo, verbatim en `lib/avisos-catalogo.ts:697`, escrito **dos días antes**. Vértice es una cuenta del tablero, no de ella |
| «quedó guardado pero no entró al grupo / WhatsApp no deja agregarlo directo / tampoco pude mandarle la invitación» — tres bugs reportados | Tres strings del repo (`DestinatariosCanal.tsx:113`, `lib/mako-grupo.ts:316` y `:393`). **Uno** de los tres sí era una falla real |
| «está tomando ejemplos de Mauricio siempre, que se note que es un ejemplo» — la clienta pidiendo despersonalizar | Es **Martín** criticando su propia pantalla |

Tres reglas, y la tercera es la que gobierna código nuevo:

1. **Antes de atribuirle una frase a quien reporta, grepeala en el repo.** Si aparece
   verbatim en un `.ts`, no es testimonio: es la pantalla. Cuesta un `grep` y cambia de quién
   salió el pedido.
2. **La etiqueta de hablante de un transcript no vale dentro de un bloque fusionado.** Fathom
   mete varias voces en una línea, así que el que comparte pantalla aparece como autor de lo
   que el otro le dicta. Lo que decide es el CONTENIDO (quién puede saber eso, quién habla en
   primera persona del producto), y cuando la etiqueta y el contenido se contradicen hay que
   **decir que es una inferencia**, no marcarla como verificada.
3. ⚠️ **Y el ejemplo que una pantalla dibuja con datos de un cliente REAL se lee como un
   dato.** El `ejemplo:` de cada aviso del catálogo salía del workspace de un cliente, con su
   nombre y sus montos — así que cualquiera que abra esa pantalla ve la cuenta de otro, y
   cualquiera que lo cuente en una reunión lo cuenta como propio. **Un ejemplo de UI es
   ficticio por regla**, como cualquier placeholder: «hola fulanito», «$1.000». Es el mismo
   criterio que la frontera de `'use client'` —no mostrarle a un cliente lo que no es suyo—
   aplicado al copy en vez de al bundle.

   ⚠️ **Y SE ROMPIÓ EL MISMO DÍA, en el commit de la tarde.** Al escribir las 42 filas del
   catálogo de datos de un mensaje salieron el closer «Mauricio», el setter «Leila» y el
   negocio «Código Inmobiliario»: dos clientes y una clienta de muestra en la pantalla que
   abren los demás. Lo encontró un barrido de la sesión vecina, no el que escribió la
   regla. Lección: **esta regla necesita un guard, no un párrafo** — hay uno en
   `tests/variables-aviso.test.ts` con la lista de nombres reales (caza los conocidos, que
   es lo que se puede automatizar) y los otros dos lugares con placeholders reales quedan
   anotados en `docs/hallazgos-comunicacion.md`.

   ⚠️ Y un nombre de ejemplo no puede ser un **verbo voseado**: «Tomás» frenó los tests
   porque el guard del voseo mira la FORMA, y un nombre y una conjugación son la misma. No
   se excepciona — se cambia el nombre.

# Una pila de deshacer se llena en el CHOKE POINT, y el Ctrl+Z nativo gana en un texto

Tres decisiones que no se ven en la firma de `usePilaDeshacer` (`app/_ui/`) y que valen
para cualquier deshacer nuevo.

**1. Se apila donde pasan TODOS los cambios, no en cada handler.** Es la regla de la
casa sobre lo que vale para un conjunto, aplicada al historial: en el editor de mensajes
el choke point es `guardarFlujo`, por donde pasan las seis mutaciones del tablero —y la
que se agregue mañana la hereda sin que nadie se acuerde—. Puesto en cada handler cubre
sólo los que existían el día que se escribió.

**Y los caminos que NO pasan por ahí se enumeran.** Acá era uno: `mover`, el arrastre,
que guarda la posición por su cuenta.

**2. ⚠️ SE APILA UNA VEZ POR GESTO, NO POR CAMBIO.** Un arrastre dispara decenas de
`setX` por segundo: apilando en cada uno, Ctrl+Z deshace un píxel y hay que apretarlo
cuarenta veces para volver donde uno estaba. El gesto se reconoce por el HUECO —si
pasaron más de N ms desde el último evento, esto es el primero de un gesto nuevo— y el N
se toma del debounce que ya guarda ese dato, para no mantener un segundo número.

**3. ⚠️ EL CTRL+Z NATIVO DEL TEXTO GANA, Y ESO ES UNA DECISIÓN POR PANTALLA.** La pila
que ya existía (`app/video-generator/EditorAnuncio.tsx`) escucha en `window` y hace
`preventDefault()` **sin mirar el foco**, con su porqué escrito: «un atajo que sólo anda
con el foco en el lugar correcto es un atajo que no anda». Ahí es correcto, porque ese
modal no tiene dónde tipear. Pegado igual en una pantalla que SÍ tiene un editor de
texto, le roba a la persona el deshacer de lo que está escribiendo para deshacerle otra
cosa. Son dos pilas y el atajo es uno: **gana la de más cerca del foco**, y lo que se
mira es el FOCO (`document.activeElement`, incluido `isContentEditable`), no el evento.

⚠️ **Y un `<input type="checkbox">` no recibe texto**: la guarda pregunta por el `type`,
no por el `tagName`, o el atajo queda muerto con el foco en una casilla.

**4. Y DESHACER ESCRIBE EN EL SERVER.** Si el cambio ya se guardó, revertir sólo el
estado de React es mentir hasta el próximo F5 — ya está escrito para el toast del
tablero y vale igual acá: el deshacer vuelve a llamar al MISMO camino con el valor
anterior. Por eso `aplicar` devuelve el estado que reemplazó: sin ese retorno, rehacer
no tiene qué reaplicar.

**5. Rehacer se BORRA al apilar.** Si se deshacen tres pasos y después se hace algo
nuevo, esos tres ya no son un futuro alcanzable: dejarlos deja un «rehacer» que
reaparece un estado que nadie puede volver a producir.

⚠️ **Y un botón de deshacer apagado es obligatorio, no un detalle.** `app/_ui/Toast.tsx`
ya lo tiene escrito para su `onUndo` opcional: «ofrecer un "Deshacer" que no deshace nada
es peor que no ofrecerlo».

# El respaldo CORROMPIO lo que venia a proteger, y la verificación no lo vio

Medido el 04/10/2026 sobre `mako.plantillas.store` del ws1, que es un cliente real.

Un script de respaldo leía el store, lo mutaba y lo devolvía con
`update … set value = ${JSON.stringify(obj)}::jsonb`. **El driver `postgres` ya
serializa para `jsonb`**, así que pasarle el TEXTO guarda un jsonb que **contiene un
string con el JSON adentro**. El síntoma es que `Object.keys(store)` devuelve
`['0','1','2','3'…]` —los índices del string— en vez de los ids.

**Y no se nota.** El UPDATE contesta ok, la pantalla sigue dibujando las 65 plantillas
—el catálogo vive en el CÓDIGO y el store sólo guarda los OVERRIDES—, y lo que
desaparece en silencio es exactamente lo del cliente: qué apagó, qué renombró, sus
plantillas propias y sus borradores. Para `jsonb` va el OBJETO: `sql.json(obj)`.

⚠️ **Y LO QUE MÁS CUESTA: LA VERIFICACIÓN PASÓ EN VERDE.** El script hacía lo correcto
—releer y comparar, no confiar en el UPDATE— y releía con SU PROPIO lector, que hacía
`typeof v === 'string' ? JSON.parse(v) : v`. Esa línea deshace exactamente la capa de
más, así que el verificador veía el objeto correcto sobre una fila rota.

**La regla: una relectura que usa el MISMO lector que escribió no puede ver una capa de
codificación de más.** Se verifica con el lector del PRODUCTO, o con una pregunta que
el lector propio no pueda contestar bien — acá alcanzaba con `Object.keys()[0]`: un id
de plantilla nunca es `"0"`. Es la misma familia que «lo verifiqué ejecutándolo» no
verifica nada si lo que ejecutás es tu transcripción.

⚠️ **Y la que sigue: un script que escribe en la base de un CLIENTE se prueba primero
contra el Cliente de Prueba (ws3).** Acá el respaldo se estrenó directo sobre el ws1
porque es el único workspace donde esa pantalla se puede abrir — eso es una razón para
tener más cuidado, no menos. Lo que lo salvó fue que el daño era reversible
(`scripts/reparar-store-plantillas.ts` decodifica hasta llegar a un objeto sano), y eso
fue suerte del formato, no del método.

# Un `useState` sembrado de props no se resiembra: si la vista deja de desmontarse, hay que poner el `key`

Un componente que hace `useState(props.x)` muestra el valor del PRIMER render para
siempre. Mientras esa pantalla se abra y se cierre, no se nota: cada apertura es un
montaje nuevo. El día que pasa a ser la vista por DEFAULT deja de desmontarse, y
empieza a mostrar —y a guardar— los datos del anterior.

Medido el 04/10/2026 en el editor de mensajes: al volverlo la vista por default, la
lista marcaba «Reporte semanal» y el editor seguía mostrando «Proyectos atrasados».
Seis `useState` sembrados de props (título, categoría, texto, el publicado contra el
que compara, el interruptor). **Lo encontró la captura, no el código**: no hay error,
no hay pantalla rota — hay dos nombres distintos en la misma pantalla.

La cura es el `key` con la identidad de lo que se edita: fuerza el remonte, que además
es el camino que ya guarda el borrador al desmontar.

**Y la regla general: cuando cambies CUÁNDO se monta un componente, grepeá sus
`useState(props.…)`.** Pasar de «se abre» a «siempre visible» no toca una línea del
componente y le cambia el ciclo de vida entero.

# /chatbot es un FLUJO CON RAMAS: lo que gobierna el código nuevo

Desde el 08/10/2026 una automatización del Chatbot es un grafo dentro de
`nutricion_secuencias.pasos`: el modelo vive en `lib/flujo-grafo.ts`, el porqué en
`docs/chatbot-flujo-ramas-diseno.md` y lo que costó en `docs/hallazgos-chatbot.md`. Lo leen cuatro
lugares —el motor, el lienzo, «Probar» y el conversor de las secuencias de antes— y se separan en la
primera edición si uno tiene su propia idea del orden.

- **Un paso es un NODO con `id` estable y su `siguiente`**; el orden del array no es el orden del
  flujo. Un escritor que inserta un paso le da `nuevoId`: uno sin id toma `o<índice>`, y al principio
  de la lista le cambia el id al paso que ya estaba ahí.
- **La entrada es `raizSalida(pasos)`, nunca `pasos[0]`**, y dónde está una inscripción lo traduce
  UNA puerta, `indiceActual` (`lib/nutricion-grafo-motor.ts`): `paso_actual` es un índice y no se lee
  directo.
- **«Lo que viene después» sale de `puertosDe` y de los «Ir a»** (`alcanzablesDesde`), nunca de
  `pasos.slice(i + 1)`: lo de abajo en el array puede ser otra rama.
- **Tener ids no es ser un flujo.** La pregunta es `esFlujoExplicito` (`lib/flujo-legado.ts`), y un
  flujo nunca pasa por `legadoAGrafo`, que lo aplasta en una fila. `esGrafo` no sirve para esto:
  `setSecuenciaPasos` le pone ids `o<i>` a cualquier lista de antes.
- **La limpieza de una secuencia convertida conserva el logro** (`limpiezaPara`), y sin estrategia no
  se escribe ninguna. Se convierte lo que el motor LEE: la estrategia parseada. Y toda operación que
  el conversor o el lienzo generan existe en el registro (`porId`).
- **«Otra cosa» sin respuesta de MaKo cierra la CHARLA, no el estado**: `conversacion_cerrada_at`
  puesto y `conversacion_cierre` null explícito (`cerradaPorUnaPersona`). Una inscripción congelada
  en 'handoff' ya no tiene quién la suelte.
- **Lo que la pantalla pinta como heredado sale de la misma función que usa el motor**
  (`revisarHeredado` → `saleSolo`, `escenariosDeRespuesta`), y «Probar» corre el MISMO dato con las
  MISMAS funciones (`lib/simulador-grafo.ts`): ninguno tiene su propio orden ni su propio reemplazo
  de variables.
- **Todo destino «a mi…» sale de la fila PROPIA de la sesión** (`destinoDelQueMira`), nunca de
  `getPerfil` (que, viendo como cliente, devuelve al admin del cliente) ni del contacto de reportes
  del workspace.
- **Todo escritor de `pasos` pasa por `setSecuenciaPasos`**, que normaliza, valida con `validarGrafo`
  y rechaza lo imposible: un archivo por el oficial o por email, un «Ir a» a la misma automatización,
  una acción que no existe. Y una lista SIN IDS no pisa un flujo de tarjetas (`puedePisarFlujo`):
  un escritor que arma `pasos` de cero se rechaza en vez de aplanar las ramas en silencio, porque
  una lista lineal es un flujo válido. Re-grabar un audio del onboarding sobre un flujo sólo le
  cambia el audio a su tarjeta (`audiosDeLaListaEnElFlujo`).
- **Una migración con columnas que el código ya lee va ANTES del deploy** (la 0223, la 0224 y la
  0225), y lo que tolera su ausencia distingue la tabla que falta (PGRST205 o 42P01) de la columna que
  falta (42703 o PGRST204): sólo la tabla se tolera.
- **Un guard con regex sobre un fuente tolera CRLF**: `\r?\n`, nunca `\n` solo. En el clon de
  Windows los archivos llegan en CRLF.

**Y desde la segunda tanda (09/10/2026), el flujo tiene HILOS EN PARALELO** (`paralelos` en una
tarjeta y en el nodo `inicio` = el CRON; el motor los lleva en `nutricion_inscripciones.hilos`,
mig 0228). Lo que eso exige al escribir código nuevo:

- **Las salidas en paralelo son puertos `par:<id>`**, y las raíces de la salida son `raicesSalida`
  (nunca sólo `raizSalida`, que es la principal). El inicio NUNCA es un paso: ni el motor ni «Probar»
  lo ejecutan.
- **Toda escritura de `hilos` sube `hilos_rev`**, o el compare-and-set del motor deja de proteger: una
  retoma que escribe `hilos: null` sin subirla revivía hilos congelados.
- **En modo hilos, el estado con que cierra el ÚLTIMO hilo es el de la inscripción**: un cierre
  terminal se prueba en los dos órdenes (este hilo primero y último).
- **El freno anti-ban y los topes son por canal** (WhatsApp por un lado, email por el otro), y el freno
  de la corrida se actualiza en memoria después de cada envío. Un camino nuevo que mande algo pasa por
  esa misma guarda.
- **Lo que el lienzo OFRECE sale de la regla que Publicar RECHAZA** (`validarGrafo` sobre el flujo
  hipotético), nunca de una copia parcial de sus reglas.

# Un TIPO DE NODO nuevo son CINCO puertas; un CAMPO del nodo es UNA rama

Cuando a un paso del lienzo le falta una capacidad —que el mensaje lo escriba la IA, que
lleve un archivo— la salida que aparece primero es un tipo de
nodo nuevo. ManyChat eligió eso (su AI Step es un paso del lienzo) y acá se paga cinco
veces: hay que agregarlo a `lib/lienzo-grafo.ts`, al constructor del grafo
(`grafoDeSecuencia` en `lib/flujo-conversacion.ts`), al panel (`EditorDeNodo` en
`app/chatbot/FlujoLienzo.tsx`), al motor (`lib/nutricion.ts`) y a `setSecuenciaPasos`
—que **reconstruye cada paso campo por campo y borra lo que no conoce**—. La quinta puerta
ya costó las `variantes` borradas en silencio.

**La regla: si la capacidad nueva sigue siendo «este nodo manda un mensaje», es un `tipo`
adentro del paso y una rama en el motor.** Nodo nuevo sólo cuando el nodo hace OTRA cosa
(esperar, bifurcar, saltar). Y el discriminante va **ausente = el caso de siempre**
(`tipo?: 'texto' | 'audio' | 'media' | 'ia'`, sin valor = texto): cero migración, cero
campo nuevo en la pantalla para quien sólo escribe texto, y las filas que ya están siguen
válidas sin tocar una.

**Y el 08/10/2026 SÍ nacieron cuatro clases de nodo** —`esperar`, `condicion`, `respuesta` («Si
responde») e `ir_a`— porque cada una hace OTRA cosa que mandar un mensaje: esperar, bifurcar por el
lead, bifurcar por lo que contesta y saltar. Van en un campo APARTE, `nodo`, y no en `tipo`: `tipo`
dice de qué está hecho un mensaje y lo tocan `pasoAVoz`, `pasoATexto` y la API, así que con un solo
campo «pasar a voz» convertía una condición en un audio. Y la clase la decide UNA función
(`claseDe`, `lib/flujo-grafo.ts`) que leen el lienzo, el motor, «Probar» y el conversor: las puertas
siguen siendo varias, pero ya ninguna adivina. La que sigue cobrando es la de siempre: todo lo que
recorre `pasos` (la prueba, el generador, las tools de la API, `lib/secuencias-audios.ts`,
`email.run`) tiene que saltear lo que no es un mensaje, y un campo nuevo del nodo pasa por
`camposDelFlujo` en `setSecuenciaPasos` o se pierde en el primer guardado.

Tres corolarios, los tres con precedente pagado:

- **El campo de siempre no se mueve adentro de un sub-objeto.** `cuerpo` es obligatorio
  también en el modo IA, porque es el texto que sale si el modelo falla — y el fallback
  tiene que ser algo que una persona escribió. La doctrina de la rama de audio es la
  inversa y por el mismo motivo: si el binario no está, **falla y reintenta, no degrada a
  texto en silencio** («mandaría un mensaje que nadie escribió»). Lo prohibido, en los dos
  casos, es el silencio: un fallback que se usa se REGISTRA.
- ⚠️ **UN ADJUNTO VA POR REFERENCIA A UNA BIBLIOTECA, NUNCA EMBEBIDO EN EL PASO.** Es lo
  único compatible con un saneo que reconstruye campo por campo: un base64 metido en el
  jsonb del paso se pierde en el primer guardado hecho desde otra pantalla. Y de paso es
  mejor producto — el mismo PDF de precios se usa en diez secuencias y se cambia en un
  lugar. El molde es `audio_id` (`lib/setting-audios.ts`), y desde el 08/10/2026 el archivo
  también: `media_id` → `setting_adjuntos` (mig 0225).
- **Una combinación IMPOSIBLE es una validación al guardar, no una nota en la
  documentación.** Un paso con adjunto por la vía oficial exige `template_wa`, y una
  plantilla aprobada por Meta no lleva un archivo arbitrario: media + oficial no se puede
  guardar. Sin esa puerta, el dueño lo descubre en el log de un cron. Desde el 08/10/2026 la
  puerta existe: `problemaDeMedia` (en `setSecuenciaPasos`, `lib/nutricion.ts`) rechaza un archivo
  sin elegir, uno por email y uno por el oficial.

# La previsualización de un editor no puede resolver un token que el motor NO resuelve

Un editor que dibuja «cómo le va a llegar» y un motor que manda son dos resolvedores del
mismo texto, y el día que no coinciden el que miente es el que la persona mira.

Medido el 05/10/2026: `VistaMensaje` (`app/chatbot/FlujoLienzo.tsx`) resolvía
`{{negocio}}` con un `replace` propio para pintar la burbuja, y el envío usa
`aplicarVariables` con el catálogo de `lib/template-vars.ts`, que tenía CUATRO claves y
ninguna era `negocio` — dejando literal lo que no conoce. **Un paso que diga «te escribo
de {{negocio}}» se veía perfecto en el editor y al lead le llegaba con las llaves
puestas.** No da error, y lo que se rompe es la única cosa que el editor prometía.

- **Un token lo resuelve UNA función, y la pantalla llama a ésa.** Si la pantalla necesita
  resolver algo más, se agrega al catálogo del motor; nunca se parchea el preview.
- **Y lo que el motor no puede resolver, el selector no lo OFRECE** (ya es regla de la
  casa). Un token escrito a mano que llega literal al cliente es el mismo bug por la otra
  puerta.

# Apoyar algo sobre el borde de un lienzo son CUATRO lugares, y el encuadre es el que no se ve

Cuando una pantalla pone una pieza ENCIMA del lienzo —una lista, un panel, una barra— y
se pide que el dibujo pase por detrás (o sea: `position: absolute`, no una columna del
flex), el lienzo sigue midiendo el ancho entero y **todo lo que él apoya en su propio
borde izquierdo nace debajo de esa pieza**. Son cuatro, y la cuarta no es un control:

1. el `chrome` (lo que flota arriba),
2. la fila del zoom y las herramientas,
3. el panel del nodo seleccionado (abre abajo a la izquierda),
4. **el ENCUADRE**, que centra el grafo sobre el ancho total y mete el nodo de más a la
   izquierda en la zona tapada.

Va UNA constante (`insetIzq` en `app/_components/Lienzo.tsx`) y la consumen las cuatro
—incluida la FIRMA del encuadre, o cambiarla no reencuadra—. No es un `padding`: el
dibujo tiene que seguir de borde a borde, que es lo que se pidió.

⚠️ **NINGUNO DE LOS CUATRO DA ERROR.** El elemento existe, es visible, está habilitado,
`getComputedStyle` lo da perfecto y el clic no llega nunca. En pantalla se lee como un
título que no se puede editar y una tarjeta que no se abre — o sea como que la app está
rota. Lo único que los encontró (los cuatro, el 05/10/2026) fue clickear y arrastrar de
verdad en un navegador: el arnés contesta `<aside …> intercepts pointer events` con 55
reintentos, que es la firma exacta de esta familia.

⚠️ **Y SE PRUEBA CON EL PANEL ABIERTO.** El panel del nodo sólo existe con un nodo
seleccionado, así que una verificación que no abre un nodo da verde sobre el control
tapado. Es la misma forma que «un `sticky` roto se ve igual que uno sano hasta que
scrolleás».

# Un test sobre un horario periódico mide el ancla con la unidad RELATIVA

Todo lo que vuelve a salir se ancla en la ocurrencia AGENDADA anterior y no en `now()` —
eso ya es regla de esta casa. Lo que falta es cómo se PRUEBA, y la salida intuitiva da un
verde falso.

Medido el 05/10/2026 escribiendo `tests/nutricion-agenda.test.ts`: el test del ancla usaba
«todos los lunes a las 9» y pasó **11/11 EN VERDE con el ancla cambiada a `ahora`**. La
causa es que `proximaOcurrencia` (`lib/cron-aviso.ts`), para `dia`, `semana`, `mes` y
`anio`, **reconstruye la hora de pared desde el cron** (`instanteDe(tz, y, m, d, c.hora,
c.minuto)`): la deriva de minutos no puede sobrevivir a eso. El único lado donde el ancla
decide el resultado es **`unidad: 'hora'`**, que es aritmética pura sobre el timestamp
(`anterior + cada × 3.600.000`) — y era justo el que el test no miraba.

**La regla: el caso que mide un ancla es el de la unidad relativa.** Con `{unidad:'hora',
cada:2}`, un ancla en `ahora` sobre una corrida 7 minutos tarde devuelve `18:07:33` en vez
de `18:00:00`, y el test cae. Con cualquier unidad de calendario, no.

Y el corolario general, que vale para cualquier guard sobre una función con ramas: **si la
función tiene un camino que NO pasa por la normalización que te protege, ése es el único
caso que prueba algo.**
