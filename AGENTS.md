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

⚠️ El hook hace CUATRO chequeos: los tipos, que las skills tengan el contrato del
`detalle` al día (`node scripts/sync-contrato-detalle.mjs --check`), que el manual de
marca tenga la gramática de MaKo al día
(`node --import tsx scripts/sync-gramatica-doc.mjs --check`) y que `plugin/` —la copia
PÚBLICA de la skill de Claude— esté generada de la versión viva
(`node --import tsx scripts/generar-plugin.mjs --check`). Si lo recreás, poné los cuatro.

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

