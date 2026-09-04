<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
echo "[pre-push] Chequeando tipos (npm run typecheck)…"
if ! npm run --silent typecheck; then
  echo "\n  ✖ PUSH BLOQUEADO: hay errores de tipos.\n"
  exit 1
fi
echo "[pre-push] ✓ Tipos OK."
```

Reglas para cualquier agente que trabaje acá:
- **Nunca** uses `git push --no-verify` (saltea el único chequeo de tipos que queda).
- Antes de pushear, si tocaste rutas nuevas, corré `npm run build` una vez: el hook usa
  `tsc --noEmit`, que solo valida los tipos generados de rutas si `.next/types` está fresco.
- **Un push cuesta lo mismo dure lo que dure el build** (~US$0,105 con la máquina en
  `turbo`; **US$0** con Standard y on-demand concurrency apagado). Agrupá commits y pusheá
  cuando haya algo que probar, no después de cada paso interno — lo que se ahorra es el
  deploy entero, nunca segundos.

⚠️ El hook hace SIETE chequeos: los tipos, que las skills tengan el contrato del
`detalle` al día (`node scripts/sync-contrato-detalle.mjs --check`), que el manual de
marca tenga la gramática de MaKo al día
(`node --import tsx scripts/sync-gramatica-doc.mjs --check`), que `plugin/` —la copia
PÚBLICA de la skill de Claude— esté generada de la versión viva
(`node --import tsx scripts/generar-plugin.mjs --check`) y que el zip que el cliente
descarga desde /video-generator no haya quedado viejo respecto de `extension/`
(`node scripts/zip-extension.mjs --check`) y que `app/conocimientos/catalogo.ts` no importe
fichas que no estén **en git** (`node scripts/curso-catalogo-verificar.mjs`) y que
ningún hook de React quede detrás de un `return`
(`sh scripts/hooks-en-orden.sh "$1"`). Si lo recreás, poné los siete.

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

⚠️ **Y se prueba en un árbol recién checkouteado, no en el tuyo.** Las cuatro daban «✓ al
día» en el repo, que es el único lugar donde ese bug no puede verse. Comprobar una guarda
donde no puede fallar es no comprobarla.

⚠️ **Si el árbol compartido tiene trabajo ajeno que no compila, se pushea desde un worktree
limpio — nunca con `--no-verify`.** `git worktree add --detach <ruta> main`, un junction a
`node_modules` (`New-Item -ItemType Junction`), `git push origin HEAD:main` desde ahí, y
después `git worktree remove --force` + `git worktree prune`.

⚠️ **Lo que el hook NO hace es correr los tests** (`npm test`), y por eso hay que acordarse
a mano. Un renombre pasa el typecheck perfecto y rompe una aserción sin que nada avise: al
renombrar la tab «Guiones» a «Ads Writer» el push salió verde, se desplegó a producción, y
el test del título quedó roto en `main`. **Si tocás `nav.ts`, los títulos de pestaña, un
catálogo o cualquier cosa que un test mire por su NOMBRE, corré `npm test` antes de
pushear.** No se suma al hook a propósito: son ~9 segundos más en cada push y la mayoría
de los cambios no los necesita — pero los renombres, sí.

# Hay dos cuentas de Claude trabajando sobre este repo

No estás solo en este clon. Hay **dos cuentas** (`claude1` / `claude2` en el `$PROFILE`)
con cuotas desfasadas: una corre miércoles a viernes, la otra sábado a martes. En
principio no coinciden, pero pueden.

Reglas que salen de eso:

- **Antes de tocar nada, `git status`.** Si hay archivos modificados que no son tuyos,
  son de la otra sesión: dejalos donde están.
- **Nunca `git add -A`.** Commiteá por ruta explícita. El día que coincidan, `add -A` se
  lleva el trabajo a medias de la otra sesión adentro de tu commit y nadie se entera
  hasta que rompe.
- **Commitear por ruta explícita NO alcanza: lo que se mira es el HUNK.** Un mismo
  archivo puede tener trabajo de las dos sesiones. Pasó con `lib/razones.ts`: una sesión
  agregó una fila a `PASO_TXT` y la otra una función nueva, y al armar el commit «por
  rutas» el archivo se descartó entero por ajeno — con lo cual el commit quedó sin una
  línea que el compilador exigía. Antes de excluir un archivo tocado por los dos, `git
  diff <archivo>` y separá: `git checkout HEAD -- <archivo>`, reaplicá **solo tu hunk**,
  commiteá, y devolvé el contenido completo al working tree.
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
| Los tipos de pregunta del Perro, su saneo y el texto que leen los modelos | `lib/preguntas-contrato.ts` (**sin `server-only`**, a propósito) | `plan-propuesta`, `plan-fathom`, `mako-doer-acciones`, `PreguntaCampo` |

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

# Hay CUATRO formas de navegar, y las cuatro llevan el `?ws=`

| Cómo | Con qué |
|---|---|
| Un link | `app/_ui/Link` (nunca `next/link`) |
| Una llamada a `/api` | sale sola: el parche de `app/_components/WsFetch.tsx` |
| Un `redirect()` del server | **`rutaConWs`** (`lib/workspace.ts`) |
| Un `window.location.href` | **`conWs(destino, useWs())`** (`lib/ws-tab.ts`) |

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
(molde: `putWithProgress` en `app/ads-manager/NuevaCampanaModal.tsx`). Una barra
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
2. ¿La condición que activa a mi arreglo puede ser falsa **por culpa de lo que el
   arreglo viene a arreglar**? Ése es el caso más caro, porque parece desplegado.
3. Si es texto que alguien tiene que ver: **miralo en la pantalla**, no en el
   código. Un banco de pruebas donde vos escribiste el texto a mano confirma tu
   modelo mental, no la pantalla — eso también pasó ese día.

⚠️ **Y dos campos para el mismo lugar es cómo se muere uno de los dos.** `sub` y
`titulo` apuntaban al mismo renglón; el render eligió uno y el otro quedó vivo en
el tipo, aceptando asignaciones, para siempre.

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
  bien y cualquier verificación local da verde sobre un build roto. **Esto lo caza
  `npm run build` o no lo caza nadie** — y el build no corre en el pre-push, a propósito.

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

Ya mordió en dos, así que no es una rareza de uno:

- **Meta** contesta 200 con `body.error` (incl. subcode 4841013, «Permisos»).
- **Evolution/WhatsApp** contesta 200 con el estado POR PARTICIPANTE adentro:
  `{ "updateParticipants": [ { "status": "403", … } ] }`.

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
las que hablan por bearer y las que exigen navegador.

El detalle, en [docs/hallazgos-infra.md](docs/hallazgos-infra.md).

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
